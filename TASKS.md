# Feature Tasks

This file tracks development tasks for new functionality. Each task includes scope, approach, and acceptance criteria so we can implement iteratively and verify easily.

---

## Task 1 — Full-Match Frame Index & Timeline Scrubber

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
