# Shadow Dash (Né Tránh Bóng Đêm)

Minimalist 2D survival game in Babylon.js. Player is a glowing neon cube dodging
homing "Dark Orb" enemies in a black void; collect Power-ups for a temporary Shield.
Score = survival time in seconds.

## Status: playable, core loop complete

Built:
- Vite + TypeScript + `@babylonjs/core` (orthographic camera, no 3D perspective — pure 2D feel)
- Neon player cube (mouse-follow + arrow-key movement, clamped to screen bounds)
- Dark Orbs spawn from off-screen edges, home toward the player, speed/spawn-rate ramp up over 60s
- Power-ups spawn randomly, grant a 5s Shield (visible ring + HUD badge) that absorbs one orb hit
- Score HUD, Game Over screen with final score, instant restart (any key or click)
- GlowLayer for the neon look; all visuals are procedural primitives (box/sphere/torus + emissive materials) — no generated image assets needed

Left / possible next steps:
- Sound effects / music (none yet)
- Persisted best-score (localStorage) — skipped as unrequested, trivial to add later
- Mobile touch input (currently mouse + arrow keys only)

## Run it

```
npm install
npm run dev
```

Dev server binds to `0.0.0.0:5173` — open `http://localhost:5173` or the LAN URL Vite prints.

## Assets

| Asset | Source | Notes |
|---|---|---|
| Player, orbs, power-ups, shield ring | Procedural (`MeshBuilder` primitives + emissive materials) | No generated images/models — kept the minimalist look zero-cost |

## Known gotchas (for future edits)

- The orthographic camera sits far back (`z = -1000`) on purpose: a camera placed too close to the origin ends up *inside* the meshes' own depth extent (a 28-unit-thick box or a 24-unit sphere), which back-face-culls everything and renders invisible. Keep the camera distance well beyond any mesh's half-depth.
- Babylon's `CreateTorus` is built flat in the XZ plane (axis along Y). To face the camera (which looks down +Z), it needs `rotation.x = Math.PI / 2`; that's what makes the shield ring visible.
