# PRD — Live LoL Esports vNext (Vite + React 18, Router v6)

## Overview
- Purpose: Keep the current app’s functionality while modernizing the build (Vite + React 18) and routing (React Router v6), switching UI/locale to English, and preserving static hosting (GitHub Pages) and small-server deploy options.
- Approach: Client-only SPA, no backend, no database. Keep parity with current features first; new features will follow after this PRD is complete.
- Audience: Personal use, casual viewing of live and upcoming LoL esports matches.

## Goals (Part 1)
- Achieve full feature parity with the current app.
- Migrate to Vite + React 18 + TypeScript.
- Upgrade routing to React Router v6 with `HashRouter` (for GitHub Pages).
- Switch UI text and API locale to English only.
- Preserve static deploy to GitHub Pages and simple static servers.

## Non‑Goals (Part 1)
- No backend or database.
- No internationalization switcher (English only).
- No polling interval control (keep current behavior).
- No major design/UX overhaul beyond necessary updates.

## Current Feature Parity (must keep)
- Landing view: lists live matches (`LiveGameCard`) and today’s upcoming matches (`ScheduleGameCard`).
- Match details route: `#/live/:gameId` shows `LiveGame` with per-player and team data.
- Scoreboard UI: team objectives, gold totals, dragons, barons, towers, inhibitors; per-player level, CS, K/D/A, inventory, gold delta.
- Event watcher: compares successive frames to trigger toast notifications and audio cues for kills/objectives.
- Experience tweaks: theme toggle (light/dark via `localStorage`), sound toggle (mutes watcher clips), basic navbar/footer.
- Mobile/static friendliness: responsive layout, SVG assets, loading placeholders.
- Data sources: persisted schedule/live APIs and live frame endpoints; champion/item art via Data Dragon/CDN mirrors; client-only calls.

## Functional Requirements
- FR1: Show live matches and today’s schedule on the landing screen.
- FR2: Navigate to a match details view via route `#/live/:gameId`.
- FR3: Stream live frames and update scoreboard & per‑player stats in near‑real‑time.
- FR4: Trigger toast notifications and English audio cues for kills/objectives.
- FR5: Provide theme toggle (persisted) and sound toggle (persisted).
- FR6: Keep app responsive and usable on mobile and desktop.
- FR7: Use React Router v6 with `HashRouter` and equivalent route structure.
- FR8: Use English strings throughout UI and request API data with `hl=en-US`.

## Non‑Functional Requirements
- NFR1: Static build and hosting; no server-side code required.
- NFR2: Reasonable performance: initial bundle size ≤ current CRA build; comparable or faster TTI under Vite.
- NFR3: Polling behavior remains as-is (currently ~500 ms) with unmount cleanup.
- NFR4: Client-only use of Riot endpoints; API key remains exposed (acceptable risk for personal project).

## Technical Decisions
- Stack: Vite, React 18, TypeScript.
- Routing: React Router v6 with `HashRouter` to avoid GH Pages 404s; `base` set in `vite.config.ts`.
- Data: Axios for HTTP; keep existing API wrappers (`src/utils/LoLEsportsAPI.ts`).
- State: Keep current local/component state; no state library introduced.
- Styling: Keep current CSS/global modules and theme context.
- Locale: English-only UI copy; API calls use `hl=en-US`.
- Env vars: Rename to Vite format (`VITE_*`); provide `.env.example`.

## Migration Plan (High Level)
1) Bootstrap Vite React‑TS project in a new branch; set `vite.config.ts` `base: '/live-lol-esports/'`.
2) Copy `public/` and `src/` assets; adjust index mount to React 18 `createRoot`.
3) Upgrade routing to v6: replace `Switch` with `Routes`, `Route component` with `element`, `useHistory` → `useNavigate`, confirm `useParams` usage; wrap with `HashRouter`.
4) Update all UI strings to English; set API query param `hl=en-US`.
5) Keep polling cadence and watcher logic; swap Portuguese audio files for English equivalents, preserving toggle behavior.
6) Replace CRA scripts with Vite scripts in `package.json`; update deploy script to `gh-pages -d dist`.
7) Convert env usage: `REACT_APP_*` → `VITE_*`; update references to `import.meta.env.VITE_*`.
8) Validate build output (`dist`) works on GH Pages; smoke test on a local static server.

## Acceptance Criteria (Parity)
- AC1: Landing view shows identical set/order of live and scheduled matches (given the same API responses).
- AC2: Navigation to and within `#/live/:gameId` works under Router v6 with `HashRouter`.
- AC3: Scoreboard and per‑player stats update continuously with no regressions vs. current app.
- AC4: Toasts and audio fire for the same events as current app, in English.
- AC5: Theme and sound toggles persist via `localStorage` and behave the same.
- AC6: App builds with Vite, deploys to GH Pages, and loads without 404s on refresh/deep links.

## Risks & Mitigations
- Router v6 breaking changes: Audit all navigation APIs and route declarations; add small utilities if needed.
- Env var differences (Vite vs CRA): Provide `.env.example`; CI and local docs for `VITE_*`.
- Asset path differences: Replace `process.env.PUBLIC_URL` with Vite‑compatible asset imports/paths.
- Riot API instability/rate limits: Keep current throttling; no retries added in Part 1.
- English audio sourcing: If exact clips aren’t available, choose concise SFX; keep volumes and toggles consistent.

## Deployment
- GitHub Pages: `gh-pages -d dist`; `vite.config.ts` `base` set to repo subpath; use `HashRouter`.
- Small server: serve static `dist/` via Nginx/Caddy or `npx serve dist`.

## Open Questions (to resolve before implementation freeze)
- Confirm repository subpath for `base` (assumed `/live-lol-esports/`).
- Confirm exact list of English audio assets and desired mapping to events.
- Keep Data Dragon mirror URLs as-is or add a simple fallback list?

## Next (Part 2 — later)
- After parity: consider query/polling helpers, error surfaces, schedule timezone toggle, and small UX refinements. Not included in Part 1 scope.

## Part 1 — Tasks (Migration + Bootstrap)
- [ ] Prep
  - [ ] Create a new git branch `feat/vite-migration-part1`.
  - [ ] Confirm GitHub Pages repo subpath for Vite base (assume `/live-lol-esports/`).
  - [ ] Snapshot env: list current `REACT_APP_*` variables; plan `VITE_*` names; add `.env.example`.

- [ ] Move current CRA to `legacy/`
  - [ ] Create `legacy/` at repo root.
  - [ ] Move CRA files into `legacy/`: `src/`, `public/`, `package.json`, `package-lock.json`/`yarn.lock`, `.env`, `tsconfig.json`, any CRA configs.
  - [ ] Keep root: `.git/`, `README.md`, `LICENSE`, `Context.md`, `PRD.md`, `.gitignore`.
  - [ ] Update `legacy/README.md` (or add a short note) on how to run the old app.
  - [ ] Sanity check: from `legacy/`, `yarn && yarn start` still runs locally (optional).

- [ ] Bootstrap new Vite + React 18 project (root)
  - [ ] Scaffold: use `npm create vite@latest` (template `react-ts`) into a temp dir, then copy into repo root (to avoid clobbering `.git`).
  - [ ] Install deps: `react-router-dom@^6`, `axios`, `react-helmet`, `react-toastify`, `use-sound`, `bignumber.js` (match usage), `gh-pages`.
  - [ ] Configure `vite.config.ts` with `base: '/live-lol-esports/'`.
  - [ ] Add scripts in `package.json`: `dev`, `build`, `preview`, `predeploy: vite build`, `deploy: gh-pages -d dist`.

- [ ] Port assets and code
  - [ ] Copy static assets from `legacy/public` (favicon, icons, audio, images) into Vite `public/` or `src/assets/` as appropriate.
  - [ ] Copy feature code from `legacy/src/` and adapt:
    - [ ] React 18 root: `createRoot` in `main.tsx`.
    - [ ] Router v6: wrap with `HashRouter`; replace `Switch` → `Routes`, `Route component` → `element`, `useHistory` → `useNavigate`.
    - [ ] Verify `useParams` typing under v6.
    - [ ] Replace any `process.env.PUBLIC_URL` with Vite asset paths/imports.
  - [ ] Keep theme context, toasts, and sound toggle wiring unchanged.

- [ ] English‑only locale changes
  - [ ] Update `src/utils/LoLEsportsAPI.ts` to request `hl=en-US`.
  - [ ] Replace all UI strings to English.
  - [ ] Swap Portuguese audio clips for English equivalents; keep filenames/paths stable where possible or update references.

- [ ] Env var migration
  - [ ] Rename `REACT_APP_*` → `VITE_*` in code (`import.meta.env.VITE_*`).
  - [ ] Add `.env.example` with placeholder values; update README with usage.

- [ ] Verify parity locally
  - [ ] `yarn dev` runs and shows live/today lists on landing.
  - [ ] Navigate to `#/live/:gameId`; frames stream; scoreboard and player stats update.
  - [ ] Toasts and English audio fire for expected events; toggles persist.

- [ ] Build & deploy
  - [ ] `yarn build` produces `dist/`; `yarn preview` serves locally.
  - [ ] `yarn deploy` publishes to GH Pages; refresh/deep links work (no 404s) via `HashRouter`.

- [ ] Definition of Done (Part 1)
  - [ ] Full feature parity per Acceptance Criteria in this PRD.
  - [ ] English-only UI and `hl=en-US` in API calls.
  - [ ] Vite build + GH Pages deploy scripts working end-to-end.
  - [ ] Legacy CRA app preserved in `/legacy` with a short run guide.
