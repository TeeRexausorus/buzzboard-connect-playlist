import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/hooks/use-toast";

const AUTH_STORAGE_KEY = "spotifyAuth";
const VERIFIER_STORAGE_KEY = "spotifyCodeVerifier";
const SCOPES =
  "streaming user-read-email user-read-private user-read-playback-state user-modify-playback-state playlist-read-private playlist-read-collaborative";
const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID?.trim() || "";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim() || "";

interface SpotifyAuth {
  access_token: string;
  refresh_token: string;
  expires_at: number; // epoch ms
}

export interface SpotifyDevice {
  id: string;
  name: string;
  type: string;
  is_active: boolean;
}

export interface SpotifyTrack {
  uri: string;
  name: string;
  artists: { name: string }[];
  album: {
    name: string;
    images: { url: string; width: number; height: number }[];
  };
}

export interface SpotifyPlaylist {
  id: string;
  name: string;
  images: { url: string }[];
  tracks: { total: number };
  owner: { display_name: string };
}

type SpotifyWebPlayer = {
  connect: () => Promise<boolean>;
  disconnect: () => void;
  addListener: (event: string, cb: (payload?: unknown) => void) => void;
  removeListener: (event: string) => void;
};

declare global {
  interface Window {
    Spotify?: {
      Player: new (options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
      }) => SpotifyWebPlayer;
    };
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

// ---------- PKCE helpers ----------
const base64url = (bytes: ArrayBuffer) => {
  const bin = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const generateCodeVerifier = () => {
  const arr = new Uint8Array(64);
  crypto.getRandomValues(arr);
  return base64url(arr.buffer);
};

const generateCodeChallenge = async (verifier: string) => {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64url(digest);
};

const getRedirectUri = () => window.location.origin + "/";

type InitialSpotifyTokens = {
  accessToken: string;
  refreshToken: string;
} | null;

export const useSpotify = (initialTokens: InitialSpotifyTokens = null, quizAuthToken: string | null = null) => {
  const [auth, setAuth] = useState<SpotifyAuth | null>(() => {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SpotifyAuth) : null;
  });
  const [devices, setDevices] = useState<SpotifyDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>(
    () => localStorage.getItem("spotifyDeviceId") || ""
  );
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>(
    () => localStorage.getItem("spotifyPlaylistId") || ""
  );
  const [playlistQueue, setPlaylistQueue] = useState<SpotifyTrack[]>([]);
  const refreshInFlightRef = useRef<Promise<string | null> | null>(null);
  const sdkLoadPromiseRef = useRef<Promise<void> | null>(null);
  const webPlayerRef = useRef<SpotifyWebPlayer | null>(null);
  const [browserDeviceId, setBrowserDeviceId] = useState<string>("");

  const isAuthed = !!auth;

  const persistAuth = (a: SpotifyAuth | null) => {
    setAuth(a);
    if (a) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(a));
    else localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const syncTokensToBackend = useCallback(
    async (nextAuth: SpotifyAuth) => {
      if (!quizAuthToken) return;
      try {
        await fetch(`${API_BASE_URL}/api/me/tokens`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${quizAuthToken}`,
          },
          body: JSON.stringify({
            accessToken: nextAuth.access_token,
            refreshToken: nextAuth.refresh_token,
          }),
        });
      } catch (error) {
        console.error("Failed to sync Spotify tokens to backend", error);
      }
    },
    [quizAuthToken]
  );

  const loadSpotifySdk = useCallback(async (): Promise<void> => {
    if (window.Spotify) return;
    if (sdkLoadPromiseRef.current) {
      await sdkLoadPromiseRef.current;
      return;
    }

    sdkLoadPromiseRef.current = new Promise<void>((resolve, reject) => {
      const existing = document.getElementById("spotify-web-playback-sdk");
      if (existing) {
        const waitForSdk = () => {
          if (window.Spotify) {
            resolve();
            return;
          }
          window.setTimeout(waitForSdk, 50);
        };
        waitForSdk();
        return;
      }

      const script = document.createElement("script");
      script.id = "spotify-web-playback-sdk";
      script.src = "https://sdk.scdn.co/spotify-player.js";
      script.async = true;
      script.onerror = () => reject(new Error("Failed to load Spotify Web Playback SDK"));
      window.onSpotifyWebPlaybackSDKReady = () => resolve();
      document.body.appendChild(script);
    });

    await sdkLoadPromiseRef.current;
  }, []);

  useEffect(() => {
    if (auth || !initialTokens?.accessToken || !initialTokens.refreshToken) return;
    // Force a refresh on first API call because we don't persist token expiry server-side.
    persistAuth({
      access_token: initialTokens.accessToken,
      refresh_token: initialTokens.refreshToken,
      expires_at: Date.now() - 1,
    });
  }, [auth, initialTokens]);

  // ---------- OAuth login ----------
  const login = useCallback(async () => {
    if (!SPOTIFY_CLIENT_ID) {
      toast({
        title: "Client ID Spotify manquant",
        description: "Configure VITE_SPOTIFY_CLIENT_ID dans les variables d'environnement frontend",
        variant: "destructive",
      });
      return;
    }
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    sessionStorage.setItem(VERIFIER_STORAGE_KEY, verifier);

    const params = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      response_type: "code",
      redirect_uri: getRedirectUri(),
      scope: SCOPES,
      code_challenge_method: "S256",
      code_challenge: challenge,
    });
    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  }, []);

  const exchangeCodeForToken = useCallback(
    async (code: string) => {
      const verifier = sessionStorage.getItem(VERIFIER_STORAGE_KEY);
      if (!verifier || !SPOTIFY_CLIENT_ID) return;

      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: getRedirectUri(),
        client_id: SPOTIFY_CLIENT_ID,
        code_verifier: verifier,
      });

      const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      if (!res.ok) {
        const err = await res.text();
        toast({ title: "Erreur Spotify", description: err, variant: "destructive" });
        return;
      }
      const data = await res.json();
      const newAuth: SpotifyAuth = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + data.expires_in * 1000,
      };
      persistAuth(newAuth);
      await syncTokensToBackend(newAuth);
      sessionStorage.removeItem(VERIFIER_STORAGE_KEY);
      toast({ title: "Spotify connecté" });
    },
    [syncTokensToBackend]
  );

  // ---------- Catch redirect on mount ----------
  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    if (code) {
      url.searchParams.delete("code");
      url.searchParams.delete("state");
      window.history.replaceState({}, "", url.pathname + url.search);
      exchangeCodeForToken(code);
    }
  }, [exchangeCodeForToken]);

  // ---------- Token refresh ----------
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (refreshInFlightRef.current) {
      return await refreshInFlightRef.current;
    }

    const refreshPromise = (async (): Promise<string | null> => {
      if (!auth) return null;
      if (!SPOTIFY_CLIENT_ID) return null;

      const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: auth.refresh_token,
        client_id: SPOTIFY_CLIENT_ID,
      });
      const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!res.ok) {
        persistAuth(null);
        return null;
      }
      const data = await res.json();
      const newAuth: SpotifyAuth = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || auth.refresh_token,
        expires_at: Date.now() + data.expires_in * 1000,
      };
      persistAuth(newAuth);
      await syncTokensToBackend(newAuth);
      return newAuth.access_token;
    })();

    refreshInFlightRef.current = refreshPromise;
    try {
      return await refreshPromise;
    } finally {
      if (refreshInFlightRef.current === refreshPromise) {
        refreshInFlightRef.current = null;
      }
    }
  }, [auth, syncTokensToBackend]);

  const getValidToken = useCallback(async (): Promise<string | null> => {
    if (!auth) return null;
    if (auth.expires_at - Date.now() > 60_000) return auth.access_token;
    return await refreshAccessToken();
  }, [auth, refreshAccessToken]);

  const apiFetch = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const token = await getValidToken();
      if (!token) throw new Error("No Spotify token");
      const res = await fetch(`https://api.spotify.com/v1${path}`, {
        ...init,
        headers: {
          ...(init.headers || {}),
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      return res;
    },
    [getValidToken]
  );

  const transferPlayback = useCallback(
    async (deviceId: string, play = false): Promise<boolean> => {
      const token = await getValidToken();
      if (!token) return false;

      const res = await fetch("https://api.spotify.com/v1/me/player", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          device_ids: [deviceId],
          play,
        }),
      });

      return res.ok || res.status === 204;
    },
    [getValidToken]
  );

  const ensureWebPlaybackDevice = useCallback(async () => {
    if (!isAuthed) return;
    if (webPlayerRef.current) return;

    try {
      await loadSpotifySdk();
      if (!window.Spotify) return;

      const player = new window.Spotify.Player({
        name: "Cette page",
        getOAuthToken: (cb) => {
          void getValidToken().then((token) => {
            if (token) cb(token);
          });
        },
        volume: 0.8,
      });

      player.addListener("ready", ({ device_id }: { device_id: string }) => {
        setBrowserDeviceId(device_id);
        if (!selectedDeviceId) {
          setSelectedDeviceId(device_id);
          localStorage.setItem("spotifyDeviceId", device_id);
        }
        void transferPlayback(device_id, false);
      });

      player.addListener("not_ready", () => {
        setBrowserDeviceId("");
      });

      player.addListener("initialization_error", ({ message }: { message: string }) => {
        console.error("Spotify SDK initialization error", message);
      });
      player.addListener("authentication_error", ({ message }: { message: string }) => {
        console.error("Spotify SDK authentication error", message);
      });
      player.addListener("account_error", ({ message }: { message: string }) => {
        console.error("Spotify SDK account error", message);
      });

      const connected = await player.connect();
      if (connected) {
        webPlayerRef.current = player;
      }
    } catch (error) {
      console.error("Failed to initialize Spotify Web Playback SDK", error);
    }
  }, [isAuthed, loadSpotifySdk, getValidToken, selectedDeviceId, transferPlayback]);

  // ---------- API ----------
  const fetchDevices = useCallback(async () => {
    try {
      const res = await apiFetch("/me/player/devices");
      if (!res.ok) return;
      const data = await res.json();
      const apiDevices = (data.devices || []) as SpotifyDevice[];
      const hasBrowserDevice = browserDeviceId && apiDevices.some((d) => d.id === browserDeviceId);
      const mergedDevices = hasBrowserDevice
        ? apiDevices
        : browserDeviceId
          ? [
              {
                id: browserDeviceId,
                name: "Ce navigateur",
                type: "Computer",
                is_active: selectedDeviceId === browserDeviceId,
              },
              ...apiDevices,
            ]
          : apiDevices;

      setDevices(mergedDevices);
      if (!selectedDeviceId && mergedDevices.length) {
        const active = mergedDevices.find((d) => d.is_active) || mergedDevices[0];
        setSelectedDeviceId(active.id);
        localStorage.setItem("spotifyDeviceId", active.id);
      }
    } catch (e) {
      console.error(e);
    }
  }, [apiFetch, selectedDeviceId, browserDeviceId]);

  const selectDevice = (id: string) => {
    setSelectedDeviceId(id);
    localStorage.setItem("spotifyDeviceId", id);
    void transferPlayback(id, false);
  };

  const search = useCallback(
    async (query: string): Promise<SpotifyTrack[]> => {
      if (!query.trim()) return [];
      const res = await apiFetch(`/search?type=track&limit=10&q=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.tracks?.items || [];
    },
    [apiFetch]
  );

  const playTrack = useCallback(
    async (track: SpotifyTrack): Promise<boolean> => {
      if (!selectedDeviceId) {
        toast({ title: "Aucun appareil", description: "Sélectionne un appareil Spotify actif", variant: "destructive" });
        return false;
      }
      const res = await apiFetch(`/me/player/play?device_id=${selectedDeviceId}`, {
        method: "PUT",
        body: JSON.stringify({ uris: [track.uri] }),
      });
      if (res.ok || res.status === 204) {
        setCurrentTrack(track);
        return true;
      }
      const err = await res.text();
      toast({ title: "Erreur lecture", description: err, variant: "destructive" });
      return false;
    },
    [apiFetch, selectedDeviceId]
  );

  // ---------- Playlists ----------
  const shuffle = <T,>(arr: T[]): T[] => {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  const fetchPlaylists = useCallback(async () => {
    try {
      const all: SpotifyPlaylist[] = [];
      let url: string | null = "/me/playlists?limit=50";
      while (url) {
        const res = await apiFetch(url);
        if (!res.ok) break;
        const data = await res.json();
        all.push(...(data.items || []));
        url = data.next ? data.next.replace("https://api.spotify.com/v1", "") : null;
      }
      setPlaylists(all);
    } catch (e) {
      console.error(e);
    }
  }, [apiFetch]);

  const loadPlaylistQueue = useCallback(
    async (playlistId: string): Promise<SpotifyTrack[]> => {
      const all: SpotifyTrack[] = [];
      let url: string | null = `/playlists/${playlistId}/tracks?limit=100&fields=items(track(uri,name,artists(name),album(name,images))),next`;
      while (url) {
        const res = await apiFetch(url);
        if (!res.ok) break;
        const data = await res.json();
        for (const it of data.items || []) {
          if (it?.track?.uri) all.push(it.track as SpotifyTrack);
        }
        url = data.next ? data.next.replace("https://api.spotify.com/v1", "") : null;
      }
      const shuffled = shuffle(all);
      setPlaylistQueue(shuffled);
      toast({ title: "Playlist chargée", description: `${shuffled.length} morceaux mélangés` });
      return shuffled;
    },
    [apiFetch]
  );

  const selectPlaylist = useCallback(
    async (id: string) => {
      setSelectedPlaylistId(id);
      localStorage.setItem("spotifyPlaylistId", id);
      if (id) await loadPlaylistQueue(id);
      else setPlaylistQueue([]);
    },
    [loadPlaylistQueue]
  );

  const playNextFromPlaylist = useCallback(async (): Promise<boolean> => {
    let queue = playlistQueue;
    if (queue.length === 0 && selectedPlaylistId) {
      queue = await loadPlaylistQueue(selectedPlaylistId);
    }
    if (queue.length === 0) return false;
    const [next, ...rest] = queue;
    setPlaylistQueue(rest);
    return await playTrack(next);
  }, [playlistQueue, selectedPlaylistId, loadPlaylistQueue, playTrack]);

  const pause = useCallback(async () => {
    if (!isAuthed) return;
    try {
      await apiFetch(`/me/player/pause${selectedDeviceId ? `?device_id=${selectedDeviceId}` : ""}`, {
        method: "PUT",
      });
    } catch (e) {
      console.error(e);
    }
  }, [apiFetch, isAuthed, selectedDeviceId]);

  const resume = useCallback(async () => {
    if (!isAuthed) return;
    try {
      await apiFetch(`/me/player/play${selectedDeviceId ? `?device_id=${selectedDeviceId}` : ""}`, {
        method: "PUT",
      });
    } catch (e) {
      console.error(e);
    }
  }, [apiFetch, isAuthed, selectedDeviceId]);

  const logout = () => {
    webPlayerRef.current?.disconnect();
    webPlayerRef.current = null;
    persistAuth(null);
    setBrowserDeviceId("");
    setCurrentTrack(null);
    setDevices([]);
    setPlaylists([]);
    setPlaylistQueue([]);
  };

  // Auto-fetch devices + playlists once authed
  useEffect(() => {
    if (isAuthed) {
      ensureWebPlaybackDevice();
      fetchDevices();
      fetchPlaylists();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  useEffect(() => {
    if (!isAuthed || !browserDeviceId) return;
    fetchDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [browserDeviceId, isAuthed]);

  useEffect(() => {
    return () => {
      webPlayerRef.current?.disconnect();
      webPlayerRef.current = null;
    };
  }, []);

  // Reload queue if a playlist was previously selected
  useEffect(() => {
    if (isAuthed && selectedPlaylistId && playlistQueue.length === 0) {
      loadPlaylistQueue(selectedPlaylistId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  return {
    spotifyClientIdConfigured: Boolean(SPOTIFY_CLIENT_ID),
    isAuthed,
    login,
    logout,
    devices,
    selectedDeviceId,
    selectDevice,
    fetchDevices,
    search,
    playTrack,
    pause,
    resume,
    currentTrack,
    playlists,
    selectedPlaylistId,
    selectPlaylist,
    fetchPlaylists,
    playlistQueueLength: playlistQueue.length,
    playNextFromPlaylist,
  };
};
