# Buzzboard Connect Playlist

Application web de régie pour piloter des buzzers MQTT, gérer un blind test Spotify et jouer des quiz (texte, image, musique) avec un affichage public synchronisé.

## Stack

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Backend Node.js + PostgreSQL (API quiz)

## Démarrage rapide

### Frontend

```sh
npm install
npm run dev
```

UI disponible sur `http://localhost:5173`.

### Backend API (quiz)

```sh
npm run server:dev
```

API disponible sur `http://localhost:3001`.

## Configuration backend

Copier `.env.example` vers `.env`, puis renseigner PostgreSQL:

- `DATABASE_URL` (DSN complet), ou
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL`

Variables utiles:

- `BACKEND_PORT` (défaut: `3001`)
- `CORS_ORIGIN` (recommandé en dev: `http://localhost:5173`)
- `VITE_API_BASE_URL` (optionnel en prod)

## UI: guide rapide

L’interface est organisée autour de 2 écrans:

- `/` : écran régie (animateur)
- `/display` : écran public (projecteur / TV)

### 1. Écran régie (`/`)

#### En-tête et état de connexion

- Badge `Connecté / Déconnecté`
- Bouton `Connecter / Déconnecter`
- Bouton `Configurer` pour ouvrir le panneau MQTT

#### Panneau de connexion MQTT

- `Broker URL` (ex: `ws://localhost:9001/`)
- `Topic` (défaut: `buzzers/#`)
- `Username / Password` optionnels
- Bloc Spotify intégré (auth + device) dans le même panneau

#### Contrôles globaux (visibles quand connecté)

- `Correct`: valide le buzzer pressé, attribue les points
- `Faux`: invalide la réponse, relance la lecture audio si besoin
- `Reset All Buzzers`: réinitialise les états de buzzers
- `Lock All`: verrouille tous les buzzers
- `Config`: ouvre/ferme les réglages avancés
- `Mode Blind Test` (si Spotify connecté)
- `Mode Quiz`

#### Grille des buzzers

Chaque carte buzzer affiche:

- Nom modifiable
- État: `En attente`, `Pressé`, `Bloqué`, ou `Verrouillé`
- Score + boutons `+/-`
- Heure de pression quand actif
- Bouton lock/unlock individuel

#### Panneau Config (bouton `Config`)

- Valeur d’un point
- `RAZ Scores`
- Configuration LEDs envoyée via MQTT:
  - `blocked_color`
  - `valid_color`
  - `idle` (rainbow ou couleur fixe)

### 2. Mode Blind Test

Quand activé:

- Sélection d’une playlist Spotify
- Bouton `Suivant` pour enchaîner
- Recherche manuelle de morceaux
- Bloc “Morceau en cours” avec masquage/révélation (`?` / infos)
- Contrôles `Pause` / `Lecture`

Comportement automatique:

- Si un buzzer est pressé pendant une question musicale: la lecture se met en pause
- `Correct` passe au morceau suivant (si playlist sélectionnée)

### 3. Mode Quiz

Affiche 2 colonnes: `Quiz Builder` + `Quiz Player`.

#### Quiz Builder (création)

- Créer, sélectionner, renommer, dupliquer, supprimer un quiz
- Ajouter des questions:
  - `Texte` (question + réponse optionnelle)
  - `Image` (URL + prompt + réponse)
  - `Musique` (recherche Spotify)
- Réordonner, modifier, supprimer les questions

#### Quiz Player (pilotage)

- Navigation `Précédent / Suivant`
- `Révéler / Cacher` la réponse
- Barre de progression
- Bouton `Affichage public` (ouvre `/display`)
- `Recommencer` pour relancer le run
- Raccourcis clavier:
  - `ArrowRight`: question suivante
  - `ArrowLeft`: question précédente
  - `R`: révéler/cacher

### 4. Affichage public (`/display`)

Écran lecture seule synchronisé automatiquement avec la régie:

- Nom du quiz actif
- Index question (`n / total`) + barre de progression
- Rendu adapté au type de question:
  - Texte
  - Image
  - Musique
- Réponse/infos masquées tant que non révélées

## API backend

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/me` (`Authorization: Bearer <token>`)
- `GET /api/me/tokens` (`Authorization: Bearer <token>`)
- `PUT /api/me/tokens` (`Authorization: Bearer <token>`)
- `PATCH /api/me/tokens` (`Authorization: Bearer <token>`)
- `GET /api/quizzes` (`Authorization: Bearer <token>`)
- `GET /api/quizzes/:id` (`Authorization: Bearer <token>`)
- `POST /api/quizzes` (`Authorization: Bearer <token>`)
- `PATCH /api/quizzes/:id` (`Authorization: Bearer <token>`)
- `DELETE /api/quizzes/:id` (`Authorization: Bearer <token>`)
- `GET /api/quizzes/:id/share` (`Authorization: Bearer <token>`)
- `POST /api/quizzes/:id/share` (`Authorization: Bearer <token>`)
- `DELETE /api/quizzes/:id/share/:login` (`Authorization: Bearer <token>`)

`POST /api/auth/login` crée automatiquement le compte si le login n'existe pas encore, puis renvoie un token Bearer.
`POST /api/quizzes/:id/share` ajoute un collaborateur à partir de son login. Un collaborateur peut lire et modifier la playlist, sans en devenir propriétaire.
`GET /api/me` renvoie les infos du user connecté, dont `accessToken` et `refreshToken`.

Exemples payload tokens:

```json
{
  "accessToken": "spotify_access_token",
  "refreshToken": "spotify_refresh_token"
}
```

```json
{
  "accessToken": null
}
```

Migrations SQL:

- `server/sql/001_init.sql`
- `server/sql/002_add_user_streaming_tokens.sql`

## Notes

- En dev, le frontend proxy `/api` vers `http://localhost:3001`.
- Si le backend est indisponible, le front peut basculer en fallback `localStorage` pour les quiz.
