# Feature Tasks

This file tracks development tasks for new functionality. Each task includes scope, approach, and acceptance criteria so we can implement iteratively and verify easily.

---

## Task 1 — Full-Match Frame Index & Timeline Scrubber

**Status:** Completed

- Goal: Cache/index all frames for a match in memory, enable a scrubber to navigate from the first frame to the latest (live) or last (finished). Until the first frame is fully backfilled, show only the latest live state.

- User flow
  - Open a live or completed game: UI renders the latest frame immediately.
  - In the background, the app backfills history by requesting frames in 10-second steps backward until the first frame is reached (API may return 204 when the game hasn’t started yet).
  - Once the first frame is present in memory, enable the timeline scrubber so users can scroll through the full match.

- Data sources
  - `GET /livestats/v1/window/{gameId}?startingTime=ISO8601` (team/gold/objectives)
  - `GET /livestats/v1/details/{gameId}?startingTime=ISO8601` (participants/advanced stats)
  - Both return `frames[*].rfc460Timestamp` for alignment.

- Key decisions
  - In-memory cache for the entire match is acceptable (≈2.3k frames for 30 min @ ~1.3 fps; a few MB).
  - Use the earliest observed `rfc460Timestamp` as the anchor for indexing; dedupe frames by timestamp.
  - Backfill in 10s steps: each request sets `startingTime` to `(currentEarliest - 10s)` until no older frames arrive or a 204 indicates pre-start.
  - Scrubber stays disabled until the first frame is cached; during backfill, UI remains pinned to “Live”.

- State model
  - `framesWindow: Map<number, FrameWindow>` keyed by `epochMillis(rfc460Timestamp)`
  - `framesDetails: Map<number, FrameDetails>` keyed by the same
  - `orderedTimestamps: number[]` sorted ascending for scrubber/index
  - `hasFirstFrame: boolean`
  - `livePointer: number` index of the most recent timestamp
  - `playbackPointer: number | null` (null means “Live”)

- Algorithm (background backfill)
  1) On game selection, fetch current `window` and `details` using `startingTime = nowRoundedTo10s - 60s` to populate latest frames; render last items immediately.
  2) Compute `earliestTs` from returned frames; if none, retry on next poll.
  3) While mounted and not `hasFirstFrame`:
     - Next `startingTime = toISO(earliestTs - 10s)`; request both endpoints in parallel.
     - Insert any newly discovered earlier frames (dedupe by timestamp).
     - Update `earliestTs` to the new minimum. If a request yields 204 or produces no earlier frames than `earliestTs`, stop and set `hasFirstFrame = true`.
  4) Continue live polling every 500ms for latest frames (using existing flow). Append any newer frames and advance `livePointer` when `playbackPointer === null`.

- Scrubber behavior
  - Disabled until `hasFirstFrame === true`.
  - Range: `orderedTimestamps[0] … orderedTimestamps[orderedTimestamps.length - 1]`.
  - On change: set `playbackPointer` to the closest timestamp; UI reads frames from both caches at that index.
  - “Live” button clears `playbackPointer` (returns to tail and resumes live advancing).

- Rendering rules
  - If a timestamp exists in `framesWindow` but not in `framesDetails`, prefer nearest neighbor within ±1 frame or fall back to partial UI (null-guard).
  - Keep event toasts/audio suppressed during historical scrub; only play during live mode.

- Utilities
  - `roundToPrevious10s(date: Date): Date`
  - `toISO(date: Date): string`
  - `isoToEpoch(iso: string): number`

- Integration points
  - `src/components/LiveStatusGameCard/LiveGame.tsx`
    - Replace ad-hoc frame state with a `useFrameIndex(gameId)` hook.
    - Pass either the live frame (when `playbackPointer === null`) or the selected historical frame to `PlayersTable`.
  - New: `src/components/LiveStatusGameCard/TimelineScrubber.tsx`
    - Props: `timestamps`, `value`, `onChange`, `onLive` (jump to latest), `disabled`.

- Hook sketch: `useFrameIndex(gameId)`
  - Returns: `{ currentWindow, currentDetails, timestamps, hasFirstFrame, isBackfilling, isLive, goLive(), setPlaybackByEpoch(ts) }`
  - Internals: manages polling, backfill loop, dedupe, and cleanup on unmount.

- Error/edge handling
  - Stop backfill on 204, on identical earliest result, or when `gameState` indicates pre-start boundaries.
  - Guard network errors; retry with jitter (but don’t spam).
  - Abort on game switch or unmount.

- Acceptance criteria
  - Opening a game displays the latest frame immediately.
  - Background backfill requests 10s earlier windows until the first frame is cached.
  - Once complete, timeline scrubber is enabled and scrolling updates the tables to historical states.
  - “Live” resumes auto-advancing and event sounds/toasts.

- Out of scope (for this task)
  - Persisting frames to IndexedDB.
  - Event feed UI (can be a follow-up task powered by diffs).

---

## Task 2 — Real‑Time Paced Live Playback (Frame‑by‑Frame)

- Goal: While in “Live” mode, render every incoming frame in order at real‑time cadence derived from `rfc460Timestamp` deltas, instead of jumping straight to the last frame of each 10s fetch window. Maintain a small, configurable buffer (default ≈10s) behind the true live edge to ensure smooth playback.

- Rationale
  - The live APIs often deliver bursts of frames per 10s query window. Showing only the last frame causes visible jumps and missed micro‑events. Pacing playback by timestamps yields smoother, TV‑like snapshots.

- Live buffer model
  - `desiredLagMs` (default 10_000). We target displaying frame `F(t)` at wall‑clock time `now ≈ anchorWall + (t - anchorTs)` where `anchorWall = now() - desiredLagMs` and `anchorTs` is the timestamp of the first frame in the current buffer window.
  - If we fall behind (drift grows), temporarily increase `speedFactor` (e.g., 1.25×) to catch up to the target lag; if we get ahead, pause briefly until scheduled display time.

- Data structures
  - Reuse Task 1’s in‑memory stores; add a lightweight scheduler state:
    - `playQueue: number[]` referencing `orderedTimestamps` indices awaiting display (monotonic ascending).
    - `displayIndex: number` pointer into `orderedTimestamps` for the currently shown frame in live mode.
    - `desiredLagMs: number` and `speedFactor: number` (default 1.0).
    - `schedulerTimer: number | null` for `setTimeout` handle.

- Ingestion → queueing
  - On each poll, append any newly arrived frames (by timestamp) to the caches and push their indices to `playQueue` if greater than the last queued index.
  - Dedupe strictly by `epochMillis(rfc460Timestamp)`.

- Scheduling algorithm
  1) If `schedulerTimer` is null and `playQueue` has items, start the loop.
  2) For consecutive frames `i` and `i+1`, compute `dt = (ts[i+1] - ts[i]) / speedFactor`.
  3) Clamp `dt` to `[minFrameMs, maxFrameMs]` (e.g., 150ms … 4000ms) to avoid extreme stalls/fast‑forwards due to irregular feeds.
  4) `setTimeout(dt, showNext)` where `showNext` advances `displayIndex` to the next timestamp and updates the UI frame from caches.
  5) Drift control: periodically compute `currentLag = latestTs - displayedTs`. If `currentLag > desiredLagMs + 5s`, raise `speedFactor` (max 2.0) until within target. If `currentLag < desiredLagMs - 2s`, briefly idle (don’t display early).

- Modes and interactions
  - Live mode: scheduler owns `displayIndex` and advances frames on time.
  - Scrub mode (from Task 1): scheduler pauses; user-selected frame renders immediately. `Go Live` resumes scheduler and re‑bases anchors using the latest available timestamp.
  - Pause: freeze scheduler but keep ingesting new frames into the caches/queue.

- Edge handling
  - Empty queue: stop scheduler; resume when new frames arrive.
  - Large gaps (`dt > maxFrameMs`): optionally accelerate with `speedFactor` to reduce visual stalls; show a subtle “buffering” indicator if we must wait >1s.
  - Burst arrivals with out‑of‑order timestamps: insert and keep `orderedTimestamps` sorted; scheduler reads by index to ensure correct order.
  - Missing `details` for a given timestamp: render available `window` data; backfill `details` on the next poll and swap in when ready.

- Hook API changes (`useFrameIndex`)
  - Add live playback controls:
    - State: `{ isLive, desiredLagMs, speedFactor, displayedTs }`
    - Actions: `{ goLive(), pause(), setDesiredLagMs(ms), setSpeedFactor(x) }`
  - Expose `currentWindow`/`currentDetails` based on `displayIndex` when `isLive === true`.

- UI surfaces
  - Small status pill: `LIVE (−10s)` with a hover tooltip explaining the buffer.
  - Controls: `Pause`, `Go Live`, optional speed menu (`1.0×, 1.25×, 1.5×`).

- Acceptance criteria
  - In live mode, frames advance one by one in timestamp order; no jumps to last of window.
  - Average inter‑frame display interval matches `Δ rfc460Timestamp` within ±100ms (subject to clamps and drift control).
  - Playback maintains ≈10s lag during steady state; catches up smoothly if ingestion stalls.
  - Switching to scrub mode pauses live scheduler; `Go Live` resumes within 500ms.

---

## Task 3 — Stop Polling Completed Games

**Status:** Completed

- Goal: Eliminate unnecessary polling once we have captured a frame whose `gameState` indicates the match is finished so we do not hammer the live API when no new data will arrive.

- Why it matters
  - Reduces wasted network traffic and Riot API quota usage.
  - Prevents duplicate toast notifications and timeline jitter after the nexus falls.
  - Makes it cheaper to keep finished games open in multiple tabs or on shared displays.

- Task tree
  - **Detection**
    - Normalize `gameState` strings from both window/details frames (expect `finished`, `postgame`, or `completed`).
    - Fall back to `gameMetadata.gameState` or persisted schedule status if live frames lag.
  - **Polling lifecycle**
    - Teach `useFrameIndex` / `LiveAPIWatcher` to stop scheduling new `getLiveWindowGame` / `getLiveDetailsGame` calls once a terminal state is observed.
    - Persist the terminal frame in state and mark the hook as `{ isLive: false, isFinal: true }`.
    - Ensure timers/intervals are cleared and no retries fire while in final state.
  - **UI sync**
    - Bubble `isFinal` through `PlayersTable` / `LiveGame` so playback controls disable or switch to “Final” mode.
    - Skip live-only behaviors (e.g., kill toasts, timeline auto-advance) when `isFinal` is true.
  - **Reset path**
    - On game switch or manual “Go Live” for a different match, re-enable polling from a clean slate.
    - Cover edge case where a finished game briefly resumes (e.g., remakes) by rearming polling if fresh frames with non-terminal `gameState` arrive.
  - **Instrumentation & QA**
    - Add lightweight debug logging (behind a flag) to confirm polling stop/start transitions.
    - Optional: unit test the hook’s state machine to verify intervals clear on final state.

- Acceptance criteria
  - Within one polling cycle of receiving a `gameState` that is terminal, no further window/details requests are sent for that game.
  - The UI shows the final frame data but indicates the game is finished; “Live” controls are disabled until a new live game is selected.
  - Switching to another live game resumes polling immediately; returning to the finished game does not restart polling unless fresh live frames appear.
- The app never calls the live endpoints for a finished game more than once per minute after the terminal frame (guard timer/backoff).

- Out of scope
  - Archiving final frames to disk/IndexedDB.
  - Updating persisted schedule metadata outside the live card workflow.
  - Handling forfeits/remakes beyond respecting the API-provided `gameState`.

---

## Task 4 — Series Meta Scoreboard Upgrade

- Goal: Replace the current per-game list with a series-centric header that shows both teams, their logos, live series score, and color-coded game outcomes, leveraging Proposed Feature #3 (Series meta) plus #6 (accurate per-game side mapping).

- Why it matters
  - Gives viewers instant context on where the series stands without deciphering “Game 1, Game 2…” labels.
  - Keeps series status synchronized with official LoL Esports data, avoiding manual best-of assumptions.
  - Provides a consistent look/feel between the schedule cards and the live game view.

- Task tree
  - **Data plumbing**
    - Use `match.strategy.count` to determine best-of length and compute required win threshold.
    - Gather per-game outcomes from `match.games[*]` and/or live frames to know winners and completion state.
    - Normalize `game.teams[*].side` (feature #6) so we can tag each team with a canonical color per series: first team on the card = “blue theme”, second = “red theme”, regardless of in-game side swaps.
  - **Series header component**
    - Design a new `SeriesScoreboard` (or refactor existing selector) that displays team logos/names, win tally (e.g., `2 – 1`), and best-of label.
    - Highlight the team that has clinched the series once they reach the win threshold; show “Series Final” state for completed series.
    - Ensure stale game-number chip UI is removed or fully hidden behind the new component.
  - **Game pills**
    - Render one pill per played game (do not show unplayed future games).
    - Fill pill background with the winning team’s theme color; unfinished games retain neutral styling.
    - Display quick metadata per pill (e.g., `G1`, winner logo, final score). For ongoing games, show live indicator.
  - **Interactions & responsiveness**
    - Clicking a pill should still allow selecting historical games when available; disable interaction for games that never occurred.
    - Maintain accessibility: announce series score changes and mark the clinched team via aria-live or status text.
  - **Styling**
    - Derive base colors from existing team palette if available; fall back to blue/red themes tied to scoreboard position.
    - Ensure contrast on pill text after applying background color; add CSS vars for reuse.
  - **QA & regression checks**
    - Test best-of-1, 3, and 5 series with partial and complete game sets.
    - Verify series resets correctly when switching between matches in the UI.
    - Confirm that remade/cancelled games (no result) remain excluded from pill list but do not break indexing.

- Acceptance criteria
  - Live game view renders a series header showing both team logos, names, best-of information, and current win totals.
  - Only completed or currently-active games appear as pills; each pill’s background reflects the winning team’s assigned theme color.
  - When a team reaches the win threshold, the scoreboard marks the series as finished and stops showing future scheduled games.
  - Selecting a game pill updates the underlying frame/game state exactly as the old game-number selector did.
  - Color assignment is stable per series (same team always blue or red theme) even if that team swapped in-game sides.

- Out of scope
  - Persisting user-selected team colors beyond the live session.
  - Implementing hover tooltips for detailed box scores (can be a follow-up).
  - Updating non-live schedule cards (handled separately when feature #3 is applied globally).

---

## Task 5 — Mobile Simple Player Table

- Goal: Introduce a simplified “mobile” layout for the live player table that surfaces only core stats (player name, champion, HP bar, K/D/A, gold) by default on small screens, while preserving the existing detailed view for tablet/desktop users.

- Why it matters
  - Current layout overflows on narrow viewports; columns become unreadable and require horizontal scrolling.
  - Mobile-first users need quick access to essential info without losing context.
  - Establishes the responsive foundation needed before we add a “detailed” mobile toggle in a follow-up task.

- Task tree
  - **Responsive breakpoints**
    - Define viewport breakpoints (e.g., `< 768px = mobile`, `768–1023px = tablet`, `>= 1024px = desktop`).
    - Determine detection mechanism (CSS media queries plus React state or only CSS).
  - **Simple layout structure**
    - Create a `PlayerTableSimple` variant or slot-based layout within `PlayersTable`.
    - Show columns/rows for: player name, champion (with icon), HP bar, K/D/A, total gold.
    - Hide items, CS, and gold difference fields in simple mode unless user explicitly expands.
  - **Mode switching**
    - Default to simple mode when breakpoint reports mobile.
    - Maintain base/normal layout as default for tablet/desktop.
    - Provide UI toggle (e.g., `View details`) for mobile users to reveal full table; remember preference per session if practical.
  - **Styling & UX**
    - Ensure touch targets are ≥44px; HP bar remains legible.
    - Stack or wrap team headers/logos to fit mobile width without clipping.
    - Confirm toast notifications and live indicators remain visible.
  - **Integration**
    - Audit existing CSS modules to avoid regressions; adjust `timelineScrubber` widths if needed.
    - Update storybook/demo (if available) or add screenshots for QA reference.
  - **Testing**
    - Manual QA on iOS Safari, Android Chrome, and desktop resize.
    - Verify toggling simple/normal modes doesn’t re-trigger polling or re-mount components unexpectedly.

- Acceptance criteria
  - On viewports below the mobile breakpoint, the simplified table renders by default with only name, champion, HP, K/D/A, and gold visible.
  - Tablet/desktop view continues to show the current full table without regressions.
  - Users can toggle from simple to full detail on mobile; state persists while viewing the match.
  - Layout adapts without causing horizontal scrolling or text overflow on mobile devices.

- Out of scope
  - Implementing the “detailed mobile” variant (handled in a later task).
  - Persisting layout preference across sessions or devices.
  - Refactoring non-player-table components for responsive behavior beyond necessary adjustments.

---

## Task 6 — Advanced Player Detail Drawer

- Goal: Extend the desktop/tablet player table with an expandable “pro” view that reveals advanced player stats, rune loadouts, and skill order (per Proposed Features #8–#10) when the user hovers/clicks on a player row or role indicator.

- Why it matters
  - Power users want richer context (damage share, vision, runes, ability ranks) without leaving the live page.
  - Consolidates existing data payloads into a single discovery point, reducing the need for external tools.
  - Builds on the responsive split from Task 5 by keeping advanced info opt-in and desktop-focused.

- Task tree
  - **Trigger design**
    - Decide on interaction model: hover for desktop, tap-to-toggle for touch/tablet.
    - Reuse role icon or add a “More” affordance to open the drawer.
  - **Data binding**
    - Plumb advanced stats from `details.frames[*].participants[*]` (damage share, vision, warding, gold earned, etc.).
    - Attach rune metadata (`perkMetadata`) and ability order (`abilities[]`) from the same frames.
    - Ensure fallback handling when fields are missing or still loading.
  - **UI layout**
    - Create a dedicated component (e.g., `PlayerDetailDrawer`) to render:
      - Advanced stat grid (KP, damage share, wards placed/destroyed, etc.).
      - Rune display (primary/sub styles, keystone icon).
      - Skill order timeline (18-slot row highlighting maxed ability).
    - Incorporate subtle transitions so the table height adapts smoothly.
  - **State management**
    - Track which player row (if any) is expanded; only one drawer open at a time.
    - Reset expanded state on game/frame switch to avoid stale data.
  - **Integration with modes**
    - Drawer available in normal/desktop mode only; hide/disable when simple mobile mode is active.
    - Ensure keyboard accessibility (focus, Enter/Space to toggle; ESC to close).
  - **Styling & UX**
    - Align visuals with existing theme; respect color roles from Task 4.
    - Provide tooltips or legend for less obvious stats.
    - Keep layout responsive so it doesn’t overflow on narrower tablets.
  - **Testing**
    - Manual QA across browsers for hover/tap behaviors.
    - Verify performance impact is minimal (memoize heavy calculations).
    - Optional unit tests for data formatting helpers.

- Acceptance criteria
  - Users on desktop/tablet can expand a player row to view advanced stats, rune loadout, and skill order sourced from live details frames.
  - Only one drawer is open at a time; switching players or closing collapses the previously expanded row cleanly.
  - Drawer auto-hides when the table switches to simple mobile mode.
  - Missing data gracefully hides individual sections without breaking layout.

- Out of scope
  - Surfacing advanced drawer in the mobile simple mode (to be reconsidered later).
  - Persisting drawer-open state between sessions.
  - Adding new data fields beyond those already retrieved from live details frames.
