

## Objectif

Ajouter un système de **Quiz scénarisé** : enchaîner des questions de 3 types (texte lu par l'animateur, image à identifier, musique Spotify), avec gestion de plusieurs quiz nommés persistés en localStorage. Cohabite avec le Blind Test actuel (pas de remplacement).

## Modèle de données

```ts
type Question =
  | { id: string; type: "text"; prompt: string; answer?: string }
  | { id: string; type: "image"; imageUrl: string; prompt?: string; answer?: string }
  | { id: string; type: "music"; trackUri: string; trackName: string; trackArtists: string; albumImage?: string; prompt?: string };

type Quiz = { id: string; name: string; questions: Question[]; createdAt: number };
```

Persistance : `localStorage["quizzes"]` (liste) + `localStorage["activeQuizId"]`.

## Nouveaux fichiers

### 1. `src/hooks/useQuiz.ts`
Hook central :
- CRUD quiz (create/rename/duplicate/delete)
- CRUD questions au sein du quiz actif (add/edit/remove/reorder)
- Navigation runtime : `currentIndex`, `next()`, `prev()`, `goTo(i)`, `reset()`
- État `revealed` (réponse cachée/affichée)
- Persistance auto en localStorage

### 2. `src/components/QuizBuilder.tsx`
Éditeur du quiz actif (en mode "préparation") :
- Sélecteur de quiz (dropdown) + boutons Nouveau/Renommer/Dupliquer/Supprimer
- Liste des questions avec drag-to-reorder (ou flèches haut/bas pour rester simple, sans dépendance)
- Bouton "Ajouter question" → mini-form avec onglet Texte / Image / Musique
  - **Texte** : champ prompt + champ réponse optionnelle
  - **Image** : URL + preview live + champ réponse optionnelle
  - **Musique** : réutilise `search()` de `useSpotify` pour piocher un track, stocke uri+meta
- Édition inline / suppression par question

### 3. `src/components/QuizPlayer.tsx`
Lecteur runtime (en mode "jeu") :
- Affiche la question courante en grand selon son type :
  - **Text** : prompt en gros, bouton "Révéler la réponse"
  - **Image** : image plein cadre, bouton révéler réponse
  - **Music** : déclenche `playTrack()` Spotify au lancement, contrôles pause/resume/reveal (réutilise la logique du `BlindTestPlayer`)
- Barre de progression "Question X / Y"
- Boutons Précédent / Suivant
- Auto-pause Spotify quand un buzzer est pressé (déjà géré dans `Index.tsx`, on étend pour couvrir music quiz)
- "Correct" passe à la question suivante automatiquement (même logique que le Blind Test)

## Modifications

### `src/pages/Index.tsx`
- Nouveau toggle **"Mode Quiz"** à côté de "Mode Blind Test" (mutuellement exclusifs ou indépendants — je propose mutuellement exclusifs pour éviter la confusion)
- Si Mode Quiz activé : afficher `<QuizBuilder>` (toujours visible) et `<QuizPlayer>` (visible quand un quiz est chargé)
- Étendre les handlers `onCorrect`/`onWrong`/`onReset` :
  - `onCorrect` en mode Quiz → `quiz.next()` ; si question musique → `spotify.pause()`
  - `onWrong` en mode Quiz → si question musique en cours, `spotify.resume()`
- Le mode Quiz **ne nécessite pas Spotify** pour les questions text/image (toggle dispo même sans auth Spotify) ; questions musique grisées si pas authed.

### `src/components/BlindTestPlayer.tsx`
Aucun changement (cohabitation propre).

### Mémoire
Ajouter `mem://features/quiz-system` : décrit les 3 types de questions, la structure Quiz, la persistance localStorage, l'intégration avec les boutons Correct/Faux.
Mettre à jour `mem://index.md` pour référencer cette nouvelle feature.

## UX clés

- **Pas de dépendance ajoutée** : drag-and-drop remplacé par flèches ↑↓ (suffit pour l'usage).
- **Preview image** dans le builder pour valider l'URL avant de lancer.
- **Fallback image cassée** : afficher un placeholder + warning si l'URL ne charge pas.
- **Raccourcis clavier** dans le QuizPlayer : flèche droite = suivant, R = révéler (nice-to-have, à valider).
- Quand on lance le mode Quiz et qu'aucun quiz n'existe, créer un "Quiz par défaut" vide automatiquement.

## Ce que je ne touche pas

- Logique MQTT / buzzers / scoring : inchangée.
- Blind Test existant : intact, juste cohabite.
- Spotify hook : juste consommé (search/playTrack/pause/resume), pas d'ajout d'API.

## Fichiers touchés (récap)

- **Nouveau** `src/hooks/useQuiz.ts`
- **Nouveau** `src/components/QuizBuilder.tsx`
- **Nouveau** `src/components/QuizPlayer.tsx`
- **Modifié** `src/pages/Index.tsx` (toggle + intégration handlers)
- **Nouveau** `mem://features/quiz-system`
- **Modifié** `mem://index.md`

