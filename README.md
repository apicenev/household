# Household

A mobile-first web app for the people living in one home: shared tasks with recurring chores and rotation, a shopping list, a household calendar with recurring events, and an activity feed.

Portfolio project: a client-only React SPA on Firebase.

> **Status:** Phase 0 (project setup).

## Tech Stack

| Area    | Technology                                                               |
| ------- | ------------------------------------------------------------------------ |
| UI      | React 19, TypeScript (strict), React Router 7                            |
| Build   | Vite 7                                                                   |
| Styling | Tailwind CSS 4 (CSS-first `@theme` tokens), Heroicons                    |
| Backend | Firebase Authentication (Email/Password) + Cloud Firestore — no server   |
| Dates   | date-fns + @date-fns/tz                                                  |
| Tests   | Vitest, React Testing Library, `@firebase/rules-unit-testing` (emulator) |
| Quality | ESLint 9 (flat config), Prettier                                         |
| Hosting | Vercel (`household.apicella.dev`)                                        |
| CI      | GitHub Actions                                                           |

## Prerequisites

- **Node.js 20+** (see `.nvmrc`)
- **Java JDK 21+** — only for the Firebase emulators (rules tests, local development with fake data)

## Getting Started

```bash
npm ci
```

### Option A — local emulators (no Firebase project needed)

```bash
npm run emulators   # terminal 1 — Emulator UI at http://127.0.0.1:4000
npm run dev:emu     # terminal 2 — app at http://localhost:5173
```

Uses `.env.emulator` and the demo project ID `demo-household`; nothing touches a real project.

### Option B — real Firebase project

1. In the [Firebase console](https://console.firebase.google.com), create a project and register a web app. Enable **Authentication → Email/Password** and create a **Firestore** database in production mode.
2. `cp .env.example .env.local` and fill in the `VITE_FIREBASE_*` values from **Project settings → Your apps → Config**.
3. Set your project ID in `.firebaserc`.
4. `npm run dev`

## Scripts

| Script                            | What it does                                                |
| --------------------------------- | ----------------------------------------------------------- |
| `npm run dev`                     | Dev server against the project in `.env.local`              |
| `npm run dev:emu`                 | Dev server against the local emulators                      |
| `npm run emulators`               | Start the Auth + Firestore emulators with the UI            |
| `npm run build`                   | Type-check and build to `dist/`                             |
| `npm run preview`                 | Serve the production build locally                          |
| `npm run typecheck`               | TypeScript only                                             |
| `npm run lint`                    | ESLint                                                      |
| `npm run format` / `format:check` | Prettier write / check                                      |
| `npm test` / `test:run`           | Unit and component tests (watch / single run)               |
| `npm run test:coverage`           | Tests with coverage report in `coverage/`                   |
| `npm run test:rules`              | Firestore security rules tests (starts the emulator)        |
| `npm run deploy:rules`            | Deploy `firestore.rules` and indexes to the default project |

## Testing

- **Unit & component tests** (`src/tests/**`, jsdom): Firebase is mocked, nothing leaves the machine.
- **Security rules tests** (`src/tests/rules/**`, Node): run against the Firestore emulator via `firebase emulators:exec`. Every collection gets rules tests in the same phase that introduces it.

## Deployment

| What            | Where                                                                                                                                        |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Quality gate    | GitHub Actions (`.github/workflows/ci.yml`): format, lint, type-check, tests + coverage, rules tests, build on every PR and push to `master` |
| Frontend        | **Vercel** Git integration: a preview deployment per PR/branch, production on `master` at **https://household.apicella.dev**                 |
| Firestore rules | Manual: `npm run deploy:rules`                                                                                                               |

Vercel builds with `vercel.json` (Vite, `npm ci`, `npm run build`, `dist/`, SPA rewrite, cache and security headers). The `VITE_FIREBASE_*` values are set as Vercel project environment variables. The custom domain must also be listed under **Firebase Authentication → Settings → Authorized domains**.

## Project Structure

```text
src/
├── main.tsx · App.tsx · index.css   entry, root component, design tokens
├── router/        routes and guards
├── lib/           firebase.ts, auth/household providers, converters
├── services/      all Firestore I/O, one module per entity
├── domain/        pure business logic (no Firebase, no React — enforced by ESLint)
├── types/         shared domain types
├── pages/         one component per route
├── components/    layout/, ui/ and feature folders
└── tests/         unit/component tests + rules/ (emulator)
```

## Windows Notes

- If PowerShell blocks `npm`/`npx` ("running scripts is disabled"), run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.
- The Firestore emulator uses port **8180** (8080 is commonly taken by other local services).
