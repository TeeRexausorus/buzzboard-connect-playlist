

## Décision retenue

UI servie en **HTTP** depuis le Pi (ou le PC portable), broker MQTT en **`ws://`** local. Pas de TLS, pas de tunnel, pas de prise de tête. Spotify reste utilisable car la redirect URI peut pointer vers `http://127.0.0.1:PORT/` côté loopback si besoin (ou on s'en passe en mobilité).

## Ce que je propose de modifier

Trois petits ajustements code pour rendre ce setup robuste et rattraper les erreurs courantes :

### 1. Garde-fou mixed-content dans `useMQTT.ts`
Avant de tenter `mqtt.connect()`, détecter le cas où l'UI est servie en HTTPS et l'URL broker commence par `ws://` (ou inversement, HTTP + wss qui marche mais qu'on signale). Afficher un toast clair plutôt que de laisser le navigateur planter en silence.

```ts
if (window.location.protocol === 'https:' && broker.startsWith('ws://')) {
  toast.error("UI en HTTPS : le broker doit être en wss://. Sers l'UI en HTTP ou utilise un broker WSS.");
  return;
}
```

### 2. URL broker par défaut adaptative dans `ConnectionPanel.tsx`
Au lieu du hardcodé `ws://localhost:9001/`, calculer un défaut basé sur l'origine courante :
- Si HTTP → `ws://<hostname>:9001/` (utilise le hostname courant, pratique sur le Pi)
- Si HTTPS → `wss://<hostname>:9001/`

Toujours overridable par l'utilisateur, et toujours persisté en localStorage (comportement actuel conservé).

### 3. Nettoyage SpotifyConfigPanel
Retirer la mention `.local` ajoutée précédemment (devenue caduque) et la remplacer par une note courte : "Pour usage local : sers l'UI en HTTP et déclare `http://127.0.0.1:PORT/` comme redirect URI Spotify (loopback autorisé sans HTTPS)."

## Ce que je ne touche pas

- Pas de changement protocole MQTT (toujours icicabuzz, topics inchangés).
- Pas de changement scoring, buzzers, blind test.
- Pas d'ajout de dépendance.

## Mémoire à mettre à jour

Ajouter une note dans `mem://mqtt/connection-details` : "Déploiement cible = HTTP local (Pi ou PC), broker en `ws://`. HTTPS interdit côté UI pour éviter mixed-content avec broker non-TLS."

## Fichiers touchés

- `src/hooks/useMQTT.ts` — garde-fou mixed-content
- `src/components/ConnectionPanel.tsx` — défaut broker basé sur `window.location`
- `src/components/SpotifyConfigPanel.tsx` — corriger la mini-doc
- `mem://mqtt/connection-details` — noter la décision archi

