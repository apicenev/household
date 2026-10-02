# Household

A mobile-first web app for the people living in one home: shared tasks with recurring chores and rotation, a shopping list, a household calendar with recurring events, and an activity feed.

Portfolio project: a client-only React SPA on Firebase.

> **Status:** Phase 1 (private login & app shell) implemented on `dev`; the app areas show «Bald verfügbar» until their phases.
>
> **Private app:** only accounts created by the admin in the Firebase console can use it; self sign-up is disabled in Firebase. There is no sign-up and no password reset in the app. The UI is German only (de-CH).

## Tech Stack

| Area    | Technology                                                                                                              |
| ------- | ----------------------------------------------------------------------------------------------------------------------- |
| UI      | React 19, TypeScript (strict), React Router 7                                                                           |
| Build   | Vite 7                                                                                                                  |
| Styling | Tailwind CSS 4 with the design tokens from `docs/design` (`@theme`), Heroicons, Newsreader (self-hosted via Fontsource) |
| Backend | Firebase Authentication (Email/Password) + Cloud Firestore — no server                                                  |
| Dates   | date-fns + @date-fns/tz                                                                                                 |
| Tests   | Vitest, React Testing Library, `@firebase/rules-unit-testing` (emulator)                                                |
| Quality | ESLint 9 (flat config), Prettier                                                                                        |
| Hosting | Vercel (`household.apicella.dev`)                                                                                       |
| CI      | GitHub Actions                                                                                                          |

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
npm run seed        # terminal 2, once — test accounts
npm run dev:emu     # terminal 2 — app at http://localhost:5173
```

Uses `.env.emulator` and the demo project ID `demo-household`; nothing touches a real project. Emulator data is kept in `emulator-data/` between restarts (git-ignored).

Seeded accounts (password `household-dev`):

| Account            | Display name |
| ------------------ | ------------ |
| `nevio@example.ch` | Nevio        |
| `anna@example.ch`  | Anna         |

In development, `/dev/ui` shows every UI primitive in every state for comparison with `docs/design/Components.dc.html` (`?open=sheet|wide|confirm|typed` opens an overlay).

### Option B — real Firebase project

1. In the [Firebase console](https://console.firebase.google.com), create a project and register a web app. Enable **Authentication → Email/Password** and create a **Firestore** database in production mode.
2. `cp .env.example .env.local` and fill in the `VITE_FIREBASE_*` values from **Project settings → Your apps → Config**.
3. Set your project ID in `.firebaserc`.
4. `npm run deploy:rules`
5. `npm run dev`

### Giving someone access

Access is managed in the Firebase console only:

1. **Authentication → Settings → User actions:** untick **Enable create (sign-up)**. This is required: it's the only thing that keeps strangers from creating an account with the public API key. Leave email enumeration protection on.
2. **Authentication → Users → Add user:** email + password (at least 8 characters). The profile (`users/{uid}`) is created on the first login; its name is the part of the email before the @ and can be changed in Firestore.

To remove someone: disable or delete the account (an open session can stay valid for up to an hour). Don't delete and re-add an account to change a password: the new account gets a new UID.

## Scripts

| Script                            | What it does                                                  |
| --------------------------------- | ------------------------------------------------------------- |
| `npm run dev`                     | Dev server against the project in `.env.local`                |
| `npm run dev:emu`                 | Dev server against the local emulators                        |
| `npm run emulators`               | Start the Auth + Firestore emulators with the UI (keeps data) |
| `npm run seed`                    | Create the test accounts in the emulators                     |
| `npm run build`                   | Type-check and build to `dist/`                               |
| `npm run preview`                 | Serve the production build locally                            |
| `npm run typecheck`               | TypeScript only                                               |
| `npm run lint`                    | ESLint                                                        |
| `npm run format` / `format:check` | Prettier write / check                                        |
| `npm test` / `test:run`           | Unit and component tests (watch / single run)                 |
| `npm run test:coverage`           | Tests with coverage report in `coverage/`                     |
| `npm run test:rules`              | Firestore security rules tests (starts the emulator)          |
| `npm run deploy:rules`            | Deploy `firestore.rules` and indexes to the default project   |

## Testing

- **Unit & component tests** (`src/tests/**`, jsdom): Firebase is mocked, nothing leaves the machine.
- **Security rules tests** (`src/tests/rules/**`, Node): run against the Firestore emulator via `firebase emulators:exec`. Every collection gets rules tests in the same phase that introduces it.

## Deployment

| What            | Where                                                                                                                                                 |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Quality gate    | GitHub Actions (`.github/workflows/ci.yml`): format, lint, type-check, tests + coverage, rules tests, build on every PR and push to `master` or `dev` |
| Frontend        | **Vercel** Git integration: preview deployments for `dev` and PRs, production on `master` at **https://household.apicella.dev**                       |
| Firestore rules | Manual: `npm run deploy:rules`                                                                                                                        |

Vercel builds with `vercel.json` (Vite, `npm ci`, `npm run build`, `dist/`, SPA rewrite, cache and security headers). The `VITE_FIREBASE_*` values are set as Vercel project environment variables. The custom domain must also be listed under **Firebase Authentication → Settings → Authorized domains**.

## Project Structure

```text
src/
├── main.tsx · App.tsx · index.css   entry, root component, design tokens
├── router/        routes and guards
├── lib/           firebase.ts, auth/ (provider, profile), format.ts (de-CH), copy.ts, converters
├── services/      all Firestore I/O, one module per entity
├── domain/        pure business logic (no Firebase, no React — enforced by ESLint)
├── types/         shared domain types
├── pages/         one component per route
├── hooks/         small shared hooks (online status, document title)
├── components/    layout/ (shell, auth layout), ui/ (design-system primitives), feature folders
└── tests/         unit/component tests + rules/ (emulator)
scripts/           seed-emulator.ts (emulator only)
docs/design/       design system: tokens, components, screens (local, not in git)
```

## Windows Notes

- If PowerShell blocks `npm`/`npx` ("running scripts is disabled"), run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.
- The Firestore emulator uses port **8180** (8080 is commonly taken by other local services).
