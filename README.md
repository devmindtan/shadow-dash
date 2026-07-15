# Shadow Dash (Né Tránh Bóng Đêm)

Minimalist 2D survival game. Babylon.js renders the black void and the Dark Orb
enemies / Power-ups (flat circles via an orthographic camera); the player
character is a plain CSS element layered on top, so it stays crisply 2D — pick
one of 3 characters, dodge homing orbs, Dash past danger, collect Power-ups for
a temporary Shield. Score = survival time in seconds.

## Status: playable, core loop complete

Built:
- Vite + TypeScript + `@babylonjs/core` (orthographic camera for orbs/power-ups; no 3D perspective)
- Player is a CSS `clip-path` shape (`#player` div), not a Babylon mesh — arrow-key/WASD movement only (no mouse), rotates to face its last movement direction
- 3 selectable characters (start-screen picker), each with distinct shape/color/stats: Vanguard (balanced), Phantom (small & fast, short cooldown), Titan (big & slow, tanky)
- Dash skill (Shift): instant burst in the facing direction, per-character distance/cooldown, leaves a fading afterimage trail + brief glow flash, HUD badge dims while on cooldown
- Dark Orbs spawn from off-screen edges, home toward the player, speed/spawn-rate ramp up over 60s
- Power-ups spawn randomly, grant a 5s Shield (visible ring + HUD badge) that absorbs one orb hit
- Score HUD, Game Over screen with final score, instant restart (Space or click only — not any key)
- All visuals are procedural (CSS shapes for the player/shield/dash trail, Babylon primitives + GlowLayer for orbs/power-ups) — no generated image assets needed

Left / possible next steps:
- Sound effects / music (none yet)
- Persisted best-score (localStorage) — skipped as unrequested, trivial to add later
- Mobile touch input (currently keyboard only)
- Character re-select between runs (currently locked in after the first Start; game-over → restart reuses the same character)

## Run it

```
npm install
npm run dev
```

Dev server binds to `0.0.0.0:5173` — open `http://localhost:5173` or the LAN URL Vite prints.

## Assets

| Asset | Source | Notes |
|---|---|---|
| Player, shield ring, dash trail | Procedural CSS (`clip-path` + `translate`/`rotate` custom properties) | Flat 2D by construction — no 3D mesh, no generated images |
| Dark orbs, power-ups | Procedural Babylon (`MeshBuilder.CreateSphere` + emissive materials + GlowLayer) | Already read as flat circles head-on through the ortho camera |

## Known gotchas (for future edits)

- The orthographic camera sits far back (`z = -1000`) on purpose: a camera placed too close to the origin ends up *inside* a mesh's own depth extent, which back-face-culls it to invisible. Keep the camera distance well beyond any mesh's half-depth. (Only matters for orbs/power-ups now — the player isn't a mesh.)
- The player, shield ring, and dash-trail ghosts are DOM elements, not Babylon meshes — deliberately, so nothing can look "3D" or tumble. `worldToScreen()` in `main.ts` is the single conversion point between game-world coordinates and their on-screen `translate` position; `playerPos` stays the source of truth for collision math against the Babylon-space orbs/power-ups.
- Character stats/visuals live in `src/entities.ts` (`CHARACTERS`) — add a new playable character by adding one entry there (color, radius, speed, dash distance/cooldown, `clipPath`); `main.ts` builds the picker UI from that array automatically.
