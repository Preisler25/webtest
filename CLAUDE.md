# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**FluencyPilot** — a language-learning SPA (Hungarian UI) built with React 19 + TypeScript + Vite, backed by Firebase Auth and Firestore. No routing library; navigation is tab-based state in `App.tsx`.

## Commands

```bash
npm run dev       # start dev server
npm run build     # tsc -b && vite build
npm run lint      # eslint .
npm run preview   # preview the production build
```

There is no test suite.

## Architecture

### Data flow

`App.tsx` owns the single top-level `loadDashboard(uid)` function that fetches all data on login (user profile, own + public wordsets, last-year activity). It passes everything down as props to tab components — there is no global state store or context.

Tab components receive `{ user, profile, wordsets, activity?, onRefresh, onNavigate? }`. When a mutation happens inside a tab (add word, complete practice session), the component calls `onRefresh()` to re-run `loadDashboard` in App.

### Component hierarchy

```
App.tsx               — auth gate, tab state, loadDashboard
├── HomeTab           — streak, daily goal, XP/level, quick wordset links
├── WordsetsTab       — CRUD for wordsets and words; .txt import
├── PracticeTab       — wordset browser → mode selector → active mode → results/leaderboard
│   ├── FlashcardMode
│   ├── QuizMode
│   ├── MatchPairsMode
│   └── WriteMode
└── ProfileTab        — activity heatmap, stats, sign-out
```

`PracticeTab` uses a discriminated union `Stage` (`library | selector | practicing | results`) as local state machine — rendering is driven by `stage.kind`.

### Firebase / Firestore

`src/firebase.ts` exports `auth` and `db`. Firebase config is read from `VITE_FIREBASE_*` env vars; if the API key is missing, `firebaseConfigError` is set and App renders a config-missing screen instead of the auth form.

Firestore collections (see `firestore.rules` for security rules):

| Collection | Purpose |
|---|---|
| `users/{uid}` | Profile: `displayName`, `tasksCompleted`, `totalWords` |
| `wordsets/{id}` | Wordset metadata; subcollection `words/{id}` |
| `userActivity/{uid}/days/{date}` | Per-day `tasksCount` / `wordsLearned` |
| `leaderboard/{wordsetId}/entries/{uid}` | Per-user best % per wordset |
| `userProgress/{uid}/wordsets/{wordsetId}` | Per-wordset progress (rules defined, reserved for future use) |

`wordCount` on a wordset document is kept in sync manually via `increment(±1)` on every word add/delete. It is not derived at read time.

### .txt import formats

Two distinct import flows in `WordsetsTab`:

1. **Import words into an existing wordset** — any `.txt` file, one `source:target` pair per line.
2. **Create a new wordset from .txt** — filename must follow `Title_sourceLang_targetLang_pu|pr.txt` (e.g. `Basic Phrases_hu_en_pu.txt`). `pu` = public, `pr` = private. Multiple files can be uploaded at once.

### Styling

All styles live in `src/App.css` and `src/index.css`. CSS class names follow a flat BEM-like convention (`.stat-card`, `.stat-card--coral`, `.wordset-card-btn`, etc.). No CSS modules or styled-components.

## Environment variables

Copy `.env.example` to `.env` and fill in the Firebase project values:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID   # optional, for Analytics
```

For GitHub Pages CI builds, add the same keys as repository secrets (Settings → Secrets and variables → Actions).
