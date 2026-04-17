import { useCallback, useEffect, useState } from "react";
import { toast } from "@/hooks/use-toast";

const AUTH_STORAGE_KEY = "spotifyAuth";
const CLIENT_ID_STORAGE_KEY = "spotifyClientId";
const VERIFIER_STORAGE_KEY = "spotifyCodeVerifier";
const SCOPES = "user-read-playback-state user-modify-playback-state playlist-read-private playlist-read-collaborative";

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

export const useSpotify = () => {
  const [clientId, setClientIdState] = useState<string>(
    () => localStorage.getItem(CLIENT_ID_STORAGE_KEY) || ""
  );
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

  const isAuthed = !!auth;

  const setClientId = (id: string) => {
    setClientIdState(id);
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, id);
  };

  const persistAuth = (a: SpotifyAuth | null) => {
    setAuth(a);
    if (a) localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(a));
    else localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  // ---------- OAuth login ----------
  const login = useCallback(async () => {
    if (!clientId) {
      toast({ title: "Client ID manquant", description: "Renseigne ton Client ID Spotify", variant: "destructive" });
      return;
    }
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    sessionStorage.setItem(VERIFIER_STORAGE_KEY, verifier);

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: getRedirectUri(),
      scope: SCOPES,
      code_challenge_method: "S256",
      code_challenge: challenge,
    });
    window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
  }, [clientId]);

  const exchangeCodeForToken = useCallback(
    async (code: string) => {
      const verifier = sessionStorage.getItem(VERIFIER_STORAGE_KEY);
      const cid = localStorage.getItem(CLIENT_ID_STORAGE_KEY) || clientId;
      if (!verifier || !cid) return;

      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: getRedirectUri(),
        client_id: cid,
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
      sessionStorage.removeItem(VERIFIER_STORAGE_KEY);
      toast({ title: "Spotify connecté" });
    },
    [clientId]
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
    if (!auth) return null;
    const cid = localStorage.getItem(CLIENT_ID_STORAGE_KEY) || clientId;
    if (!cid) return null;

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: auth.refresh_token,
      client_id: cid,
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
    return newAuth.access_token;
  }, [auth, clientId]);

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

  // ---------- API ----------
  const fetchDevices = useCallback(async () => {
    try {
      const res = await apiFetch("/me/player/devices");
      if (!res.ok) return;
      const data = await res.json();
      setDevices(data.devices || []);
      if (!selectedDeviceId && data.devices?.length) {
        const active = data.devices.find((d: SpotifyDevice) => d.is_active) || data.devices[0];
        setSelectedDeviceId(active.id);
        localStorage.setItem("spotifyDeviceId", active.id);
      }
    } catch (e) {
      console.error(e);
    }
  }, [apiFetch, selectedDeviceId]);

  const selectDevice = (id: string) => {
    setSelectedDeviceId(id);
    localStorage.setItem("spotifyDeviceId", id);
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
    async (track: SpotifyTrack) => {
      if (!selectedDeviceId) {
        toast({ title: "Aucun appareil", description: "Sélectionne un appareil Spotify actif", variant: "destructive" });
        return;
      }
      const res = await apiFetch(`/me/player/play?device_id=${selectedDeviceId}`, {
        method: "PUT",
        body: JSON.stringify({ uris: [track.uri] }),
      });
      if (res.ok || res.status === 204) {
        setCurrentTrack(track);
      } else {
        const err = await res.text();
        toast({ title: "Erreur lecture", description: err, variant: "destructive" });
      }
    },
    [apiFetch, selectedDeviceId]
  );

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
    persistAuth(null);
    setCurrentTrack(null);
    setDevices([]);
  };

  // Auto-fetch devices once authed
  useEffect(() => {
    if (isAuthed) fetchDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed]);

  return {
    clientId,
    setClientId,
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
  };
};
