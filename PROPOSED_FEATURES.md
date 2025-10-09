# Proposed Features Using Unused LoL Esports API Fields

This document outlines product/UI features we can add by leveraging fields already retrieved from Riot’s LoL Esports APIs but not yet used in the app.

## Summary
- Stream links by locale/provider (+ deep links)
- Per‑game VOD buttons and recap state
- Series meta: Best‑of indicator and live series score
- League/tournament badges and context
- Patch version badge and links to patch notes
- Accurate per‑game side mapping (Blue/Red) without heuristics
- Player role icons and player profile deep links
- Advanced player stats (KP, damage share, vision, combat/defense)
- Runes (primary/sub styles + perks) and skill order display
- Timeline/scrubber using frame timestamps and event feed
- Shareable deep links using esportsGameId/matchId

---

## 1) Stream Links by Locale & Provider
Source: `getEventDetails().data.event.streams[*]` (provider, locale, parameter, countries, offset)

- UI: Add a “Watch Live” dropdown with provider icons (Twitch/YouTube), language/locale tags, and availability by country.
- Behavior: Default to user locale; fall back to English. Open external link in new tab.
- Where: Home cards and live view header.
- Acceptance:
  - Streams render when available; hidden if none.
  - Correct locale/provider labeling and links.

## 2) VOD Buttons per Game
Source: `getEventDetails().data.event.match.games[*].vods`

- UI: Add a VOD button next to each game in the series selector, visible when not live or after finish.
- Behavior: Opens VOD in a new tab; disabled if missing.
- Acceptance:
  - Button appears only when VOD exists.
  - VOD opens and matches the game number.

## 3) Series Meta (Best‑of + Live Series Score)
Source: `match.strategy.count` (BOx) and `match.teams[*].result.gameWins`

- UI: Display “Best of N” and current series score below league name.
- Behavior: Update wins live; highlight match point.
- Acceptance:
  - Shows BOx and correct live series score.

## 4) League & Tournament Badges
Source: `event.league.*`, `event.tournament.id`

- UI: Show league logo/name in cards and live header; optional tooltip with tournament context.
- Acceptance:
  - Badge renders; hides gracefully if missing.

## 5) Patch Version Badge
Source: `window.gameMetadata.patchVersion`

- UI: Badge next to title (e.g., “Patch 15.20”). Link to official patch notes.
- Acceptance:
  - Badge renders from metadata; hidden if field missing.

## 6) Accurate Per‑Game Side Mapping
Source: `event.match.games[*].teams[*].side` (blue/red)

- Replace current name‑based heuristic with explicit side for the selected game.
- Acceptance:
  - No team flip issues (e.g., TCL edge cases addressed).

## 7) Player Role Icons and Player Links
Source: `window.gameMetadata.*TeamMetadata.participantMetadata[*].role`, `esportsPlayerId`

- UI: Role icon (TOP/JNG/MID/ADC/SUP) next to champion; clickable player name linking to lolesports player page (when available).
- Acceptance:
  - Correct role mapping per participant; links open in new tab.

## 8) Advanced Player Stats
Source: `details.frames[*].participants[*]`
- Not yet used: `killParticipation`, `championDamageShare`, `wardsPlaced`, `wardsDestroyed`, `attackDamage`, `abilityPower`, `criticalChance`, `attackSpeed`, `lifeSteal`, `armor`, `magicResistance`, `tenacity`, `totalGoldEarned`.

- UI: Expandable “Advanced” row or tooltip on hover per player.
- Acceptance:
  - Values render for selected game’s latest frame; hidden if unavailable.

## 9) Runes (Perk Metadata)
Source: `details.frames[*].participants[*].perkMetadata` (styleId, subStyleId, perks[])

- UI: Small rune panel showing primary/sub styles and keystone rune; tooltips for full perk list.
- Acceptance:
  - Shows styles and keystone; degrades silently if IDs not mapped.

## 10) Skill Order Display
Source: `details.frames[*].participants[*].abilities[]`

- UI: 18‑slot skill order row per player (Q/W/E/R markers). Highlight maxed ability.
- Acceptance:
  - Sequence updates live; matches expected level progression.

## 11) Timeline / Scrubber & Event Feed
Source: `window.frames[*].rfc460Timestamp`, `details.frames[*].rfc460Timestamp`

- UI: Full-game timeline scrubber that spans from the first captured frame through the most recent frame (live) or final frame (completed). Event feed (kills/objectives) syncs to the scrubber.
- Behavior: Maintain a bounded in-memory buffer of recent frames; cache the earliest `rfc460Timestamp` when the first frame arrives so we can convert scrubber offsets into absolute timestamps. When historic frames are not delivered, derive the anchor timestamp from `window.gameMetadata.gameStartTime` and treat earlier frames as zero offset.
- Acceptance:
  - Scrubbing anywhere on the timeline updates the tables; returning to “Live” resumes polling display from the latest frame.

## 12) Shareable Deep Links
Source: `window.esportsGameId`, `window.esportsMatchId`

- UI: “Copy link” that includes match/game IDs; optional share button.
- Acceptance:
  - Link points to the same match/game selection when reloaded.

---

## Implementation Notes
- Components to touch
  - `src/components/LiveStatusGameCard/LiveGame.tsx`: pass new fields to UI; manage selected game’s side; manage frame buffers for timeline.
  - `src/components/LiveStatusGameCard/PlayersTable.tsx`: render series score, patch badge, sides, role icons, advanced stats, rune and skill order blocks.
  - `src/components/LiveStatusGameCard/LiveAPIWatcher.tsx`: optionally drive event feed from frame diffs.
  - `src/components/LiveGameCard/*`: render league badges, BOx, stream links, VOD buttons on cards.
  - New small components: `StreamLinks`, `VodButton`, `SeriesScore`, `PatchBadge`, `RoleIcon`, `RunesDisplay`, `SkillOrderRow`, `AdvancedStatsTooltip`, `TimelineScrubber`.

- Data handling
  - Keep existing 500ms polling. Hydrate the scrubber with full-history `details.frames` on load, then append live updates from a bounded ring buffer of recent `window.frames` (e.g., last 120 frames ≈ 60s) so we don't balloon memory.
  - On initial frame load, record the minimum `rfc460Timestamp` for the game; cache it in state so scrubber math can convert slider positions to absolute timestamps. If historic frames aren’t delivered, derive a pseudo-first-frame timestamp from `gameMetadata.gameStartTime` and adjust subsequent frame offsets accordingly.
  - Null‑guard all fields; hide elements if data absent.

- Styling/UX
  - Reuse `playerStatusStyle.css` conventions.
  - Keep new UI collapsible/hover‑driven to avoid clutter.

- Performance
  - Memoize derived values (gold bars, KP, damage share) by frame.
  - Lazy load heavy tooltip content.

- Compatibility
  - If `patchVersion` doesn’t match pinned DDragon version, continue using current CDN images; no hard dependency.

## Prioritization
- Tier 1 (High value / Low effort)
  - Series meta (BOx + score)
  - Accurate side mapping per game
  - Patch version badge
  - Stream links
  - VOD buttons

- Tier 2
  - Role icons and player links
  - Advanced player stats (KP, damage share, vision)
  - League/tournament badges

- Tier 3
  - Runes display
  - Skill order display
  - Timeline/scrubber and event feed

## Acceptance Criteria (Selected)
- Series Score: Shows BOx and live `gameWins`; matches official site.
- Side Mapping: Blue/Red mapping matches `games[*].teams[*].side` for selected game; no heuristic swaps.
- Patch Badge: Displays `patchVersion` (major.minor) and links to patch notes.
- Streams: Dropdown renders by `provider`/`locale`; opens correct URL.
- VODs: Buttons appear for games with `vods`; open in new tab.

## Open Questions
- Do we want region locking on streams (use `countries`)?
- Where should VODs live when multiple links exist (primary vs. fallback)?
- Should timeline pause polling or merely disconnect rendering?
- What is the canonical player/team page URL scheme for deep links?

## Risks & Mitigations
- API Rate/Load: Keep polling frequency; compute diffs client‑side.
- Data Gaps: Some fields may be missing per league; ensure UI hides gracefully.
- Versioning: DDragon assets pinned; `patchVersion` used only for display unless we implement dynamic asset mapping.

## Files Likely Affected
- `src/components/LiveStatusGameCard/LiveGame.tsx`
- `src/components/LiveStatusGameCard/PlayersTable.tsx`
- `src/components/LiveStatusGameCard/LiveAPIWatcher.tsx`
- `src/components/LiveGameCard/GameCardList.tsx`
- `src/components/LiveGameCard/LiveGameCard.tsx`
- `src/components/LiveGameCard/ScheduleGameCard.tsx`
- New small UI components under `src/components/LiveStatusGameCard/`

## Why This Helps
- Improves discoverability (streams/VODs), context (league/series/patch), and depth (runes, skill order, advanced stats) without new backends — all data already arrives from current endpoints.
