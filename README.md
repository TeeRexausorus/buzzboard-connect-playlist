# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/bc3c4584-e13e-4e23-b0de-d485aac58ce4

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/bc3c4584-e13e-4e23-b0de-d485aac58ce4) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## Backend Quiz (PostgreSQL)

Le projet inclut maintenant un backend API pour lire/écrire les quizzes.

### 1. Configuration

Copiez `.env.example` vers `.env` et renseignez les variables PostgreSQL:

- `DATABASE_URL` (option DSN unique), ou
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_SSL`

Variables utiles:

- `BACKEND_PORT` (défaut `3001`)
- `CORS_ORIGIN` (défaut `*`, recommandé `http://localhost:5173` en dev)

### 2. Lancer le backend

```sh
npm run server:dev
```

API disponible sur `http://localhost:3001`.

### 3. Endpoints

- `GET /api/health`
- `POST /api/auth/login`
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

Le SQL d'initialisation est dans `server/sql/001_init.sql` (la table est aussi créée automatiquement au démarrage).

### 4. Front connecté au backend

Le hook `useQuiz` appelle maintenant l'API `/api/quizzes`.

- En dev, Vite proxy automatiquement `/api` vers `http://localhost:3001`.
- En production, vous pouvez définir `VITE_API_BASE_URL` (ex: `https://api.mon-domaine.com`) pour préfixer les appels.
- Si le backend est indisponible, le front bascule en fallback `localStorage`.
