

## Le problème

Spotify exige des Redirect URIs **exactes** dans le dashboard de l'app : pas de wildcards (`*`), pas de plages IP, pas de `0.0.0.0`. Or sur ton réseau local, le Pi aura `192.168.1.42` chez toi, `192.168.0.17` chez un pote, `10.0.0.5` au bureau…

Bonne nouvelle : Spotify accepte **plusieurs Redirect URIs** dans une même app, ET autorise `http://127.0.0.1` et `http://localhost` sans HTTPS. On peut s'en sortir proprement.

## Solution recommandée : un hostname mDNS stable

Au lieu de viser le Pi par son IP, on le vise par un **nom local** type `http://buzzer.local:8080`. Le Pi s'annonce sur le réseau via **Avahi/mDNS** (déjà inclus dans Raspberry Pi OS), et tous les appareils du LAN (mobile, PC, Mac) le résolvent automatiquement — **peu importe l'IP du moment**.

Tu déclares **une seule** Redirect URI dans Spotify : `http://buzzer.local:8080/` → ça marche sur tous les réseaux, pour tous tes clients.

### Étapes côté Pi (config système, pas de code)
1. `sudo raspi-config` → changer le hostname en `buzzer` (ou ce que tu veux).
2. Vérifier qu'Avahi tourne : `sudo systemctl status avahi-daemon` (actif par défaut sur Raspberry Pi OS).
3. Servir l'app sur un port fixe (ex: 8080) avec `vite preview --host --port 8080` ou via un Caddy/nginx.
4. Tester depuis un autre appareil : `ping buzzer.local` doit répondre.

### Côté Spotify Dashboard
- Redirect URI à ajouter : `http://buzzer.local:8080/`
- Spotify accepte les URIs `http://` uniquement pour `localhost`, `127.0.0.1` **et** les hostnames `.local` (mDNS). C'est documenté et stable.

### Côté code (changement minime)
Actuellement `getRedirectUri()` retourne `window.location.origin + "/"`. Si tu accèdes au Pi via `http://buzzer.local:8080`, ça génère automatiquement `http://buzzer.local:8080/` → match parfait avec ce qui est déclaré chez Spotify. **Aucun changement de code nécessaire**, à condition de toujours taper `buzzer.local:8080` dans la barre d'adresse (jamais l'IP brute).

## Plan B : si mDNS ne marche pas (certains Android, réseaux d'entreprise)

Ajouter dans le dashboard Spotify **plusieurs Redirect URIs en parallèle** :
- `http://buzzer.local:8080/`
- `http://127.0.0.1:8080/` (si tu y accèdes parfois depuis le Pi lui-même)
- `http://192.168.1.42:8080/`, `http://192.168.0.17:8080/`… (les IPs des réseaux que tu fréquentes)

Spotify accepte autant d'URIs qu'on veut. Inconvénient : à chaque nouveau réseau, faut éditer le dashboard une fois.

Pour rendre ça moins pénible côté UI, je peux **petit ajout de code optionnel** :
- Dans `SpotifyConfigPanel`, afficher dynamiquement la Redirect URI actuelle (`window.location.origin + "/"`) avec un bouton "Copier", pour qu'au premier lancement sur un nouveau réseau tu puisses la coller en 2 secondes dans le dashboard Spotify.

## Plan C : tunnel public (Tailscale / Cloudflare Tunnel)

Si tu veux **zéro config réseau** et un accès même hors LAN :
- **Tailscale** : installe sur le Pi + tes appareils → ils se voient via une IP `100.x.x.x` stable, peu importe le réseau. Redirect URI = `http://buzzer-pi.tailnet-name.ts.net:8080/`. Gratuit perso.
- **Cloudflare Tunnel** : expose le Pi sur un sous-domaine public HTTPS gratuit (`buzzer.tonnom.workers.dev`). Plus lourd à setup mais HTTPS natif.

## Recommandation

**Plan A (mDNS `buzzer.local`)** pour 90% des cas — robuste, sans code, sans dépendance externe. Plan B (afficher/copier l'URI) en complément UX si tu veux que je l'ajoute. Plan C uniquement si t'as besoin d'accès hors LAN.

## Ce que je peux coder maintenant (si tu veux)

1. Afficher la Redirect URI courante avec un bouton "Copier" dans `SpotifyConfigPanel` (utile pour Plan B).
2. Ajouter une mini doc dans le panneau ("Pour Raspberry Pi : utilise `http://buzzer.local:PORT/`").

Sinon, c'est purement de la config Pi + dashboard Spotify, pas besoin de toucher au code.

