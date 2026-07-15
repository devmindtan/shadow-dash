# Shadow Dash (Né Tránh Bóng Đêm)

Minimalist 2D survival game. Babylon.js renders the black void and the Dark Orb
enemies / Power-ups (flat circles via an orthographic camera); the player
character is a plain CSS element layered on top, so it stays crisply 2D — pick
one of 3 characters, dodge orbs (3 distinct movement mechanics), Dash to burst
past danger and destroy orbs in your path, collect Power-ups for a temporary
Shield. Health is 2-4 hits depending on character. Score = survival time.

## Status: playable, core loop complete

Built:
- Vite + TypeScript + `@babylonjs/core` (orthographic camera for orbs/power-ups; no 3D perspective)
- Player is a CSS `clip-path` shape (`#player` div), not a Babylon mesh — arrow-key/WASD movement only (no mouse), rotates to face its last movement direction
- 3 selectable characters, each with distinct shape/color/stats: Vanguard (balanced, 3 HP), Phantom (small & fast, short dash cooldown, 2 HP), Titan (big & slow, tanky, 4 HP)
- Character select is part of the single persistent `#menu` screen shown on both first start and every Game Over — always reachable, no page reload needed to switch characters, with a description of each character's stats/dash effect shown below the picker
- Dash skill (Shift): instant burst in the facing direction, per-character distance/cooldown, leaves a fading afterimage trail + glow flash; HUD badge shows a live cooldown countdown (`DASH 1.2s`)
- **Dash effect is per-character, a real mechanic not just a visual** (`DashEffect` in `entities.ts`): Vanguard = **Pierce** (destroys orbs swept by the dash path), Phantom = **Phase** (no kill, but brief invulnerability — pure evasion), Titan = **Shockwave** (destroys everything in a radius around the landing point)
- HP system: hitting an orb without a Shield costs 1 HP (not instant death), with a brief invulnerability + flicker after each hit; HUD shows HP as small pips per character's max
- 3 Dark Orb types, same power level, different mechanics: **Drifter** (straight line at the player's spawn-time position), **Wobbler** (weaves side-to-side while advancing), **Splitter** (travels straight, then splits into 2 shards after ~0.9s, with a burst effect)
- Power-ups spawn randomly, grant a 5s Shield (visible ring + HUD badge) that fully absorbs orb hits (no HP cost, with its own burst + sound when it blocks a hit)
- Wave-clear checkpoints every 20s (`WAVE` in `entities.ts`): a "WAVE N" banner + sound, then the game pauses and offers a roguelite-style pick of 3 random upgrades (`UPGRADES` in `entities.ts`). A felt milestone, not a win/pass gate (Shadow Dash has no win state, score is just survival time). Upgrades scale a per-run `runStats` copy, never the shared character data.
  - **Stat upgrades**: heal, +max HP, faster dash cooldown, longer dash, stronger dash effect, +move speed.
  - **Effect upgrades — new Dash mechanics, not just bigger numbers**: **Dash Nối Tiếp** (a dash that kills refunds part of the cooldown), **Từ Trường** (dash pulls nearby power-ups toward you), **Dư Chấn** (every dash also triggers a small bonus AoE kill-burst around the landing point, stacking on top of whatever the character's core dash effect already does — so even Vanguard/Phantom get a taste of Titan-style splash).
  - Picking the same upgrade again stacks it to the next level (tracked per-run, shown as `Lv.N` badges under the HUD and as "(Lv.N+1)" on the offer card).
- Difficulty is a ramp with a sine wave riding on top (`waveAmplitude`/`wavePeriodSeconds` in `entities.ts`) — intensity breathes (quieter dips, denser bursts) instead of climbing in a flat line
- Game pauses on tab/window blur (`visibilitychange`) — alt-tabbing away doesn't cost you a run; frame delta is also clamped so a long stall never flings orbs/the player or dumps a huge chunk onto the score
- Best score persists via `localStorage`, shown as a permanent HUD badge
- Procedural sound effects via the native Web Audio API (`src/audio.ts`, oscillator-based blips) — start, dash, hit, shield pickup, orb-kill, game over. No audio asset files.
- Score HUD, Game Over screen with final score, instant restart (Space or click only — not any key)
- All visuals are procedural (CSS shapes for the player/shield/dash trail/hit-bursts, Babylon primitives + GlowLayer for orbs/power-ups) — no generated image or audio assets needed

Left / possible next steps:
- More power-up variety beyond Shield (e.g. Nuke, Magnet, Slow-field)
- Mobile touch input (currently keyboard only)
- Unlockable characters/skins gated on score milestones

## Run it

```
npm install
npm run dev
```

Dev server binds to `0.0.0.0:5173` — open `http://localhost:5173` or the LAN URL Vite prints.

A `.claude/hooks/build-doctor-check.sh` Stop hook (adapted from `~/.claude/templates/project-starter`) auto-typechecks (`tsc -b --noEmit`) whenever a source file changed since the last check, and only speaks up if it fails.

## Assets

| Asset | Source | Notes |
|---|---|---|
| Player, shield ring, dash trail, hit-burst effects | Procedural CSS (`clip-path` + `translate`/`rotate` custom properties) | Flat 2D by construction — no 3D mesh, no generated images |
| Dark orbs (3 types), power-ups | Procedural Babylon (`MeshBuilder.CreateSphere` + emissive materials + GlowLayer) | Already read as flat circles head-on through the ortho camera |
| Sound effects | Procedural Web Audio (`src/audio.ts`, `OscillatorNode` + `GainNode` envelopes) | No audio files |

## Known gotchas (for future edits)

- The orthographic camera sits far back (`z = -1000`) on purpose: a camera placed too close to the origin ends up *inside* a mesh's own depth extent, which back-face-culls it to invisible. Keep the camera distance well beyond any mesh's half-depth. (Only matters for orbs/power-ups now — the player isn't a mesh.)
- The player, shield ring, dash-trail ghosts, and hit-bursts are DOM elements, not Babylon meshes — deliberately, so nothing can look "3D" or tumble. `worldToScreen()` in `main.ts` is the single conversion point between game-world coordinates and their on-screen `translate` position; `playerPos` stays the source of truth for collision math against the Babylon-space orbs/power-ups.
- Character stats/visuals live in `src/entities.ts` (`CHARACTERS`) — add a new playable character by adding one entry there (color, radius, speed, maxHp, dash distance/cooldown, `dashRadiusMultiplier` for shockwave-style effects, `clipPath`, `description`); `main.ts` builds the picker UI and description text from that array automatically.
- Orb mechanics live in `src/entities.ts` (`ORB_TYPES`) — each orb's position is computed parametrically each frame from `spawnX/Y + dir*traveled (+ perp*wobble if any)`, so adding a new movement mechanic means adding a `behavior` branch in the orb-update loop in `main.ts`, not touching the spawn code.
- `#menu` is reused for both the start screen and Game Over (title/hint/score text swapped via JS) specifically so the character picker never becomes unreachable — don't reintroduce a separate always-hidden game-over-only screen.
- `sfx*()` calls in `audio.ts` lazily create/resume the single shared `AudioContext`; every call site is reached from a keydown/pointerdown handler (Space/Shift/click), which satisfies the browser's user-gesture requirement for audio. Don't call an `sfx*()` function from a `setTimeout`/async callback with no gesture in its call stack — create the sound at the point of the input handler instead, and let the effect it's paired with reference it.
- Dash's gameplay effect is chosen by `selectedCharacter.dashEffect`, branched in `tryDash()` in `main.ts` — add a 4th effect by adding a new `DashEffect` variant in `entities.ts` and a branch there, not by adding a new orthogonal "loadout" UI.
- The shield ring's on-screen position must be set (`updateShieldRingPosition()`) in the *same* code path that un-hides it — setting visibility one frame and position the next causes a one-frame flash at a stale position. Follow this pattern for any future effect that toggles visibility and position together.
- Upgrade effects live in `runStats` (`main.ts`), not on `CHARACTERS` — `freshRunStats()` is the one place that resets them at `startGame()`. Add a new upgrade by: adding an entry + id to `UPGRADES` in `entities.ts`, adding the matching field to `RunStats`/`freshRunStats()`, a case in `applyUpgrade()`, and (for effect upgrades) a check in `tryDash()`. `acquiredUpgrades` (a `Map<id, level>`) is separate bookkeeping purely for the "next level" UI — the actual power lives in `runStats`.
