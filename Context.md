# Live LoL Esports – Project Context

## Purpose
- Client-side dashboard that surfaces live and scheduled League of Legends esports matches.
- Built for quick consumption of match status, player stats, and in-game objective events directly from Riot’s esports feeds.
- Intended for static hosting (HashRouter + `homepage` set) so it can run on GitHub Pages without backend support.

## Tech Stack
- React 17 with TypeScript and React Router for SPA navigation.
- Axios for interacting with Riot’s persisted (`esports-api.lolesports.com`) and live (`feed.lolesports.com`) endpoints using the bundled API key.
- Styling delivered through global CSS modules; theming handled via custom `ThemeContext`.
- React Toastify + `use-sound` enable toast notifications and audio cues.

## Data Pipelines
- Live games and daily schedule fetched from the persisted API (`getLive`, `getSchedule`) with `hl=pt-BR`.
- Per-match statistics pulled from live endpoints (`window`, `details`) every 500 ms, using `getISODateMultiplyOf10()` to request 10-second-aligned snapshots.
- Champion and item art sourced from Data Dragon mirrors (`ddragon.bangingheads.net`) and legacy CDN URLs.
- All calls happen client-side; API key and requests are exposed in the browser.

## Current Features
- **Landing view:** lists matches currently in progress via `LiveGameCard` and upcoming matches for the current day via `ScheduleGameCard`.
- **Match details route (`#/live/:gameId`):** `LiveGame` derives the active game instance (using `bignumber.js` to match the correct map) and streams frames to `PlayersTable`.
- **Scoreboard UI:** displays team objective counts, gold totals, dragons, and per-player stats (level, CS, K/D/A, inventory, gold delta).
- **Event watcher:** `LiveAPIWatcher` compares successive frames to trigger toast notifications and localized Portuguese audio clips for kills, dragons, towers, barons, and inhibitors.
- **Experience tweaks:** Navbar includes theme toggle (light/dark persisted via `localStorage`) and “sound” toggle that mutes the watcher clips; footer links to the original author’s GitHub/Twitter.
- **Mobile/static friendliness:** uses SVG assets and loading placeholder while live data is still being retrieved.

## Project Layout
- `src/components/LiveGameCard/*` – cards and lists for live/today games.
- `src/components/LiveStatusGameCard/*` – detailed live match dashboard, watcher, health bars, item display, and supporting types.
- `src/theme/*` – theme definitions and context provider consumed by `App`.
- `src/utils/LoLEsportsAPI.ts` – centralized Riot API wrappers, constants, and time-alignment helper.
- `public/` & `src/assets/` – static images, audio clips, and icons used across the UI.

## Notable Observations
- UI strings and locale parameters are predominantly Portuguese (“pt-BR”).
- Polling interval is aggressive (500 ms); no throttling or cancellation beyond unmount cleanup.
- Logic to detect Herald possession is documented but disabled because it cannot be enforced client-side.
- Teams are heuristically swapped if metadata indicates sides are inverted (addresses edge cases in certain leagues).
- Deployment scripts and config target GitHub Pages (`gh-pages`).
