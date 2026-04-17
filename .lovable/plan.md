

## Intégration Spotify — mode Blind Test

### Vue d'ensemble
Ajouter un panneau "Blind Test" qui se connecte à Spotify (compte Premium de l'animateur), contrôle un appareil Spotify déjà actif (PC, enceinte, app mobile…), permet de chercher un morceau et l'envoie en lecture. La musique se met automatiquement en pause quand un buzzer est pressé, reprend sur "Faux", et s'arrête sur "Correct" / "Reset".

### Authentification Spotify
L'API Spotify Web (search + player control) exige un OAuth utilisateur. Le mode connecteur Lovable (gateway) authentifie un seul compte côté workspace : c'est exactement ce qu'il nous faut puisqu'un seul animateur lance les morceaux.

Deux options possibles, à confirmer si besoin :
- **Option A — Connecteur Lovable Spotify** : si un connecteur Spotify existe dans la liste, on l'utilise via la gateway depuis une edge function (Lovable Cloud requis). Plus simple, pas de redirect URI à gérer.
- **Option B — OAuth manuel "Authorization Code with PKCE"** côté frontend : on enregistre un Client ID Spotify (l'utilisateur le crée sur developer.spotify.com), on stocke le refresh token en localStorage. Pas besoin de backend.

→ Je propose de partir sur **Option B (PKCE frontend)** car :
- Aucune edge function nécessaire, l'app reste 100% client comme aujourd'hui (cohérent avec l'archi MQTT actuelle).
- Pas de dépendance à Lovable Cloud.
- L'utilisateur saisit son Client ID Spotify une fois, persisté en localStorage.

Si tu préfères passer par le connecteur Lovable, dis-le et je révise le plan.

### Endpoints Spotify utilisés
- `GET /v1/me/player/devices` — lister les appareils actifs
- `GET /v1/search?type=track&q=...` — recherche morceau
- `PUT /v1/me/player/play` (avec `device_id` + `uris`) — lancer un morceau
- `PUT /v1/me/player/pause` — pause
- `PUT /v1/me/player/play` (sans body) — reprise

### Architecture des fichiers
```text
src/
├── hooks/
│   ├── useMQTT.ts                  (modifié : expose pressedBuzzerId déjà OK,
│   │                                ajout d'un callback onBuzzerPressed via useEffect côté Index)
│   └── useSpotify.ts               (nouveau : OAuth PKCE, token refresh, API calls)
├── components/
│   └── BlindTestPanel.tsx          (nouveau : login, sélection device,
│                                    barre de recherche, résultats, contrôles play/pause,
│                                    affichage piste en cours masquée/révélée)
└── pages/
    └── Index.tsx                   (modifié : insertion du panneau + branchement
                                    auto-pause sur pressedBuzzerId,
                                    auto-resume dans handleWrong, stop dans handleCorrect/reset)
```

### Comportement UI
1. **Bloc Blind Test** (visible uniquement quand MQTT connecté) avec :
   - Bouton "Connecter Spotify" → flow PKCE, redirige sur Spotify puis revient sur `/` avec le code dans l'URL.
   - Une fois loggé : sélecteur d'appareil Spotify actif (refresh manuel si rien).
   - Champ de recherche + liste de résultats (titre, artiste, pochette). Clic sur un résultat → lance le morceau sur l'appareil sélectionné.
   - Affichage du morceau en cours **masqué par défaut** (cache "???") avec un bouton "Révéler" pour spoiler titre/artiste après la manche.
   - Boutons Play / Pause manuels en backup.

2. **Liaison automatique avec les buzzers** (dans `Index.tsx`) :
   - `useEffect` sur `pressedBuzzerId` : si ≠ null et morceau en cours → `pause()`.
   - Wrapper autour de `handleWrong` : appelle l'original puis `resume()`.
   - Wrapper autour de `handleCorrect` et `reset` : appelle l'original puis `pause()` (manche terminée).

### Détails techniques (PKCE)
- Génération code_verifier + code_challenge (SHA-256, base64url) via `crypto.subtle`.
- Scopes demandés : `user-read-playback-state user-modify-playback-state`.
- Token + refresh token + expiration stockés dans localStorage (`spotifyAuth`).
- Auto-refresh dans `useSpotify` quand expiration < 60s avant chaque appel.
- Redirect URI = `window.location.origin + '/'` (l'utilisateur devra ajouter cette URL dans son app Spotify Developer Dashboard).

### Ce que l'utilisateur devra faire une fois
1. Créer une app sur https://developer.spotify.com/dashboard (gratuit).
2. Copier le Client ID dans le panneau Blind Test.
3. Ajouter l'URL de l'app Lovable comme Redirect URI dans le dashboard Spotify.
4. Avoir Spotify ouvert quelque part (PC, mobile, enceinte connectée…) avec un compte **Premium** (obligatoire pour le contrôle distant).

### Limitations à noter
- Spotify Premium requis (limitation API, pas de contournement).
- Si aucun appareil n'est actif, la lecture échoue → message d'erreur clair + bouton "Rafraîchir devices".
- L'API a un délai de ~200-500ms sur play/pause, donc la pause sur buzz ne sera pas instantanée.

### Suite
Une fois ce plan validé, je passe en mode édition pour créer `useSpotify.ts`, `BlindTestPanel.tsx`, et brancher le tout dans `Index.tsx`.

