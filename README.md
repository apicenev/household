# Household

A mobile-first web app for the people living in one home: shared tasks with recurring chores and rotation, a shopping list, a household calendar with recurring events, and an activity feed.

Portfolio project: a client-only React SPA on Firebase, live at **https://household.apicella.dev**. The demo logins are on my portfolio, not in this repository.

> **Status:** Phase 9 (hardening, demo household, v1.0) implemented on `dev`: leaving, removing, handing over and deleting a household, single occurrences of recurring events, the demo household and an error boundary. The release follows after the manual check.
>
> **Private app:** only accounts created by the admin in the Firebase console can use it; self sign-up is disabled in Firebase. There is no sign-up and no password reset in the app. Two published demo accounts live in a guarded demo household (see [Demo household](#demo-household)). The UI is German only (de-CH).

## Features

- **Start:** greeting, overdue and today's tasks, the shopping list, the next 7 days of events, recently completed; check off right there.
- **Aufgaben:** tasks with assignee, due date, priority and notes; filters in the URL; recurring tasks (daily, weekly on chosen days, every N weeks / days, monthly, yearly) that create their next occurrence on completion, optionally rotating between members.
- **Einkauf:** one shared list grouped by category, suggestions and «Oft gekauft» from the purchase history, «Gekaufte entfernen» with undo.
- **Kalender:** month view and «Demnächst», all-day and timed events across days, recurring events with end conditions, and single occurrences that can be cancelled or changed on their own.
- **Aktivität:** a live, filterable feed of what happened, grouped by day.
- **Haushalt:** members, invite code, settings, profile; leave, remove a member, hand over, delete.
- Everything updates live on every member's device; works offline for the open session.

## Architecture

```text
React pages & components ──► services/ (all Firestore I/O) ──► lib/converters ──► Firebase SDK
        │                                                                        │
        └──► domain/ (pure logic: recurrence, rotation, calendar, dashboard…)   ▼
                                                              Cloud Firestore + firestore.rules
                                                              (the rules are the backend)
```

There's no server: the client writes multi-document changes as single batches, and `firestore.rules` checks each batch as a whole (`getAfter()`), including the household membership, the invite code and every field.

**Recurrence:** one engine (`src/domain/recurrence.ts`) for tasks and events. A recurring **task** is one open occurrence at a time; completing it creates the next one in the same batch, scheduled from the rule, not from the completion date, so a late completion doesn't shift the schedule. A recurring **event** is stored once (its first occurrence plus the rule) and expanded on the client for the visible range; single occurrences are stored as exceptions keyed by their schedule date. Times stay in the household's local time across DST changes.

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

`npm run seed -- --household` also creates the household «Musterstrasse 12» with Nevio as owner, the example tasks of the design (relative to today, only if the household has none yet) plus three recurring tasks («Pflanzen giessen» every 4 days, «Bettwäsche wechseln» every 2 weeks, «Bad putzen» weekly; added whenever missing) and prints its invite code. Anna stays without a household: log in as Anna in a second browser profile and join with the code («Mit Code beitreten»). The household also gets the design's shopping list (six open items, four bought) and a purchase history for the suggestions («Brot» 14×, «Milch» 12×, …), and eleven calendar events relative to today: five one-off events («Möbellieferung» tomorrow, «Znacht mit Freunden», «Arzttermin» for Anna, the 8-day «Ferien» and a «Spieleabend» past midnight) and six series («Grossputz» every 2 weeks with one date inside «Ferien», «Altpapiersammlung» every 2 weeks, «Miete bezahlen» monthly, «Geburtstag Nevio» yearly, «Yoga-Kurs» for 8 times and a «Schwimmkurs» that has ended), all added whenever missing. Since Phase 8 it also writes an activity feed over the last weeks (68 entries, once): every entry type, single purchases and a burst of four that the feed groups, entries whose targets are gone, and enough older ones for «Mehr laden». An emulator seeded before Phase 7 keeps its one-off «Grossputz» / «Altpapiersammlung» next to the new series; start from a fresh emulator to avoid the duplicates. `npm run seed -- --with-anna` makes Anna a member right away, so «Bad putzen» rotates Nevio → Anna (and, on a fresh household, the bought items show «von Anna»). Running it again keeps the household and replaces the code once it has expired.

`npm run seed -- --demo` also writes the demo household «Demo-Haushalt» with its two accounts (below), rebuilt on every run, exactly as `npm run demo:setup` does in the real project. `--now=2026-10-23T07:30:00Z` fixes its moment; `--extras` adds two tasks due today (for screenshots).

Uses `.env.emulator` and the demo project ID `demo-household`; nothing touches a real project. Emulator data is kept in `emulator-data/` between restarts (git-ignored).

Seeded accounts (password `household-dev`):

| Account             | Display name                                     |
| ------------------- | ------------------------------------------------ |
| `nevio@example.ch`  | Nevio                                            |
| `anna@example.ch`   | Anna                                             |
| `demo1@example.com` | Demo User 1 (`--demo`, owner of «Demo-Haushalt») |
| `demo2@example.com` | Demo User 2 (`--demo`)                           |

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

### Demo household

The live app has one household for portfolio visitors: «Demo-Haushalt» with **Demo User 1** (owner) and **Demo User 2**. Its logins are published on the portfolio. It lives in the same Firebase project as the real household, so the rules keep it apart:

- The household carries `demo: true`, which only the Admin SDK can set. The rules then deny leaving, removing, handing over, deleting and renaming it, and its members can't change their names. Since demo users can never leave, the one-household rule stops them from creating or joining another household.
- Invite codes can be read only without a household, as a member of the code's household, or when the code doesn't exist (the free-code check of «Neuer Code»), so a demo user can't read another household's preview.
- The data never goes stale: tasks have no due dates and every event repeats without an end. There's no automatic reset; changes by visitors stay until the next `--reset`.

Setup (once):

1. **Authentication → Users → Add user** twice: the two demo emails, one shared password.
2. **Authentication → Settings → User actions:** keep «Enable create (sign-up)» off and turn **«Enable deletion»** off too.
3. **Project settings → Service accounts → Generate new private key**; save it **outside** the repository.
4. `npm run deploy:rules` (the demo guard must be live first), then:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\outside\the\repo\key.json"
npm run demo:setup -- --emails demo1@…,demo2@… --dry-run   # shows what it would write
npm run demo:setup -- --emails demo1@…,demo2@…             # asks for «yes», then writes
```

`--reset` deletes the demo household's content and writes it fresh (after vandalism, or to renew the history). The script runs only against `household-apicella-dev` (or the emulators with a `demo-…` project), only touches the two demo accounts, their household and its invite, refuses anything else and never changes passwords. Delete the key file afterwards or keep it in a password manager. If a visitor changes the demo password through the public Auth API, reset it in the console.

## Scripts

| Script                            | What it does                                                                               |
| --------------------------------- | ------------------------------------------------------------------------------------------ |
| `npm run dev`                     | Dev server against the project in `.env.local`                                             |
| `npm run dev:emu`                 | Dev server against the local emulators                                                     |
| `npm run emulators`               | Start the Auth + Firestore emulators with the UI (keeps data)                              |
| `npm run seed`                    | Create the test accounts in the emulators                                                  |
| `npm run seed -- --household`     | … plus «Musterstrasse 12» with tasks, a shopping list and calendar events; prints the code |
| `npm run seed -- --with-anna`     | … plus Anna as a member («Bad putzen» rotates Nevio → Anna)                                |
| `npm run seed -- --demo`          | … plus the demo household with Demo User 1 / 2 (rebuilt every run)                         |
| `npm run demo:setup`              | Set up or `--reset` the demo household in the real project (admin key, see above)          |
| `npm run build`                   | Type-check and build to `dist/`                                                            |
| `npm run preview`                 | Serve the production build locally                                                         |
| `npm run typecheck`               | TypeScript only                                                                            |
| `npm run lint`                    | ESLint                                                                                     |
| `npm run format` / `format:check` | Prettier write / check                                                                     |
| `npm test` / `test:run`           | Unit and component tests (watch / single run)                                              |
| `npm run test:coverage`           | Tests with coverage report in `coverage/`                                                  |
| `npm run test:rules`              | Firestore security rules tests (starts the emulator)                                       |
| `npm run deploy:rules`            | Deploy `firestore.rules` and indexes to the default project                                |

## Testing

- **Unit & component tests** (`src/tests/**`, jsdom): Firebase is mocked, nothing leaves the machine.
- **Security rules tests** (`src/tests/rules/**`, Node): run against the Firestore emulator via `firebase emulators:exec`. Every collection gets rules tests in the same phase that introduces it. `services.rules.test.ts` also runs the real services against the emulator, so their batches are checked by the real rules. `demo.rules.test.ts` writes the demo dataset through the rules (a shape check: timestamps and counts are swapped for what the rules expect) and checks the demo guard and the isolation from a real household; `demoWriter.rules.test.ts` checks the setup script's writer.
- **Manual checks:** the flows in the browser, accessibility (keyboard, VoiceOver, axe) and Lighthouse are checked by hand per phase.

## Data Model & Security

All app data belongs to a **household**; a user belongs to at most one (`users/{uid}.householdId`).

```text
users/{uid}                          own profile: name, initials, avatar colour, householdId
households/{hid}                     name, ownerId, memberIds[], weekStartsOn, timeZone, rotationOrder?, inviteCode, inviteCreatedAt,
                                     deleting? (a delete in progress), demo? (the demo household, Admin SDK only)
households/{hid}/members/{uid}       profile copy for display, role (owner | member), joinedAt
households/{hid}/tasks/{taskId}      title, notes?, assigneeId, dueDate ("YYYY-MM-DD"), priority, status, completedAt/By,
                                     recurring: recurrence, rotation?, seriesId, seriesIndex
                                     (next occurrence id «{seriesId}-{seriesIndex}», created on completion)
households/{hid}/shoppingItems/{id}  name, quantity?, notes?, category, checked, checkedAt/By
households/{hid}/itemStats/{key}     purchase history for suggestions: name, category, count, lastPurchasedAt
                                     (key = lowercased name, «/» as «∕»; survives «Gekaufte entfernen»)
households/{hid}/events/{id}         title, description?, category, allDay, start, end, participants ("household" | uids),
                                     recurrence? (a series: start / end are its first occurrence; the others are
                                     expanded on the client, never stored), exceptions? (single occurrences
                                     cancelled or changed, keyed by schedule date) + lastExceptionKey
                                     (timed: instants in the household time zone; all-day: 00:00 UTC of the first /
                                     last day, so a time-zone change never moves them)
households/{hid}/activity/{id}       append-only log (member joined / left / removed; task created / completed / assigned;
                                     item added / purchased; event created); the feed reads it newest
                                     first, optionally by targetType (index in firestore.indexes.json)
invites/{code}                       code lookup (ABC-1234) with a small preview for «Code gefunden»
```

`firestore.rules` is the security boundary (details: `docs/requirements.md` §7):

- Only members read a household and its subcollections; only the owner changes settings, creates a new code, removes members, hands over or deletes the household.
- Joining requires the household's **current, unexpired** code (7 days after `inviteCreatedAt`, server time) and adds only the caller. Codes are read one at a time, never listed: without a household, as a member of the code's household, or when the code doesn't exist.
- Multi-document writes (create, join, new code, profile edits, leave, remove, hand over, delete) are single batches, and the rules cross-check the other documents of the batch with `getAfter()`, so an incomplete batch is rejected as a whole.
- **Leaving** takes only the caller out (not the owner, who hands over first), together with their member doc and their profile's household id. **Removing** takes exactly one other member out with their member doc. **Handing over** moves `ownerId` and swaps both roles in one batch. **Deleting** first sets `deleting` and shrinks `memberIds` to the owner (everyone else is shut out at once), then deletes the content in chunks (activity and purchase stats only while `deleting`), then the household; it can be resumed. Someone removed or left in a deleted household clears their own stale household id.
- The demo household (`demo: true`) blocks leave, remove, hand-over, delete and renames (see [Demo household](#demo-household)).
- Every member reads and writes every task; the rules validate the fields (title 1–200, notes ≤ 2000, priority, date format, assignee is a member) and the status changes (complete sets `completedBy` = caller and server time; reopen removes both).
- Recurring tasks: the rules validate the rule (frequencies, interval 1–52, weekdays, day / month), the rotation (current members, no duplicates, the assignee is the member at `index`), that a rule has a due date, and the series ids. Completing an occurrence and creating the next one is one batch; the next occurrence's fixed id means a second completion or «Nur diese» can't create it twice.
- Every member reads and writes every shopping item; the rules validate the fields (name 1–100 without stray whitespace, quantity ≤ 30, notes ≤ 500, category) and the check (`checkedBy` = caller, server time) / uncheck. A checked item may only be created as a restore («Rückgängig» after «Gekaufte entfernen» or a delete).
- `itemStats` docs are created with count 1 and change by exactly +1 (a purchase, server time) or −1 (an uncheck, never below 0); they're never deleted. The id must be the lowercased name for ASCII names (the rules' `lower()` leaves other letters alone, so non-ASCII names only need a plausible id). An uncheck never depends on the stats doc.
- Every member reads and writes every event; the rules check each write as a whole event (title 1–200 without leading / trailing spaces, description ≤ 2000, category, end ≥ start, at most 366 calendar days, all-day dates at 00:00 UTC, participants «household» or 1–20 distinct **current** members, checked when they change, so an event of someone who left stays editable). A series' `recurrence` is checked like a task rule, plus monthly by weekday (one weekday + position 1–4 or last) and either `until` («YYYY-MM-DD») or `count` (2–99). A single occurrence is written as one exception: the write names its key in `lastExceptionKey` (rules can't read an element of a Set), exactly that key may change, its value is validated like the event (at most 100); a series edit may only drop the exceptions. Tasks still reject the event-only keys.
- Task, shopping and event activity entries must match their target after the batch (title / name snapshot, «done» or checked for a completion / purchase).
- Activity entries are append-only; members list them (the feed's filter by type needs the composite index, deployed with `npm run deploy:rules`); everything not matched is denied.

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
├── lib/           firebase.ts, auth/ (provider, profile), household/ (realtime provider), format.ts (de-CH), copy.ts, converters
├── services/      all Firestore I/O, one module per entity
├── domain/        pure business logic (no Firebase, no React — enforced by ESLint)
├── types/         shared domain types
├── demo/          the demo household's dataset (used by the scripts and tests, not by the app)
├── pages/         one component per route
├── hooks/         small shared hooks (online status, document title, media query)
├── components/    layout/ (shell, auth layout), ui/ (design-system primitives), feature folders
└── tests/         unit/component tests + rules/ (emulator)
scripts/           seed-emulator.ts (emulator only), demo/ (demo household setup)
docs/design/       design system: tokens, components, screens (local, not in git)
```

## Windows Notes

- If PowerShell blocks `npm`/`npx` ("running scripts is disabled"), run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.
- The Firestore emulator uses port **8180** (8080 is commonly taken by other local services).
- After `npm run test:rules` the emulator's Java process can keep running, and the next run fails with «port taken». Stop it with `Get-NetTCPConnection -LocalPort 8180 -State Listen | % { Stop-Process -Id $_.OwningProcess }`.
