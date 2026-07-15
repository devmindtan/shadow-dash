import { Color3 } from "@babylonjs/core/Maths/math.color";

// Design catalog: every game object's visual look and gameplay stats live here,
// separate from the update/spawn logic in main.ts. Add a new enemy, power-up,
// or projectile by adding an entry here, then wiring its spawn/behavior in main.ts.
//
// The player is rendered as a plain CSS element (not a Babylon mesh) so it stays
// flat 2D — no accidental 3D rotation. Add a new selectable character by adding
// an entry to CHARACTERS; main.ts reads whichever one the player picks at the
// start screen.

export interface CharacterDef {
  id: string;
  name: string;
  color: string; // CSS color
  radius: number;
  speed: number; // px/s
  dashDistance: number; // px, instant burst distance
  dashCooldownMs: number;
  clipPath: string; // CSS clip-path polygon, drawn pointing right (0 deg = facing +X)
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: "vanguard",
    name: "Vanguard",
    color: "#6cf0ff",
    radius: 14,
    speed: 460,
    dashDistance: 150,
    dashCooldownMs: 1400,
    clipPath: "polygon(100% 50%, 0% 0%, 28% 50%, 0% 100%)", // arrow/ship — balanced
  },
  {
    id: "phantom",
    name: "Phantom",
    color: "#c86bff",
    radius: 11,
    speed: 560,
    dashDistance: 190,
    dashCooldownMs: 1000,
    clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)", // slim diamond — fast, fragile
  },
  {
    id: "titan",
    name: "Titan",
    color: "#ffd166",
    radius: 18,
    speed: 360,
    dashDistance: 110,
    dashCooldownMs: 1900,
    clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)", // hexagon — tanky, slow
  },
];

export const SHIELD_RING = {
  color: "#4fd8ff",
  thickness: 3, // px
  radiusMultiplier: 1.6, // relative to the active character's radius
};

export const DARK_ORB = {
  radius: 12,
  color: new Color3(0.5, 0.05, 0.15),
  dimColor: new Color3(0.05, 0.02, 0.05), // non-lit base tint, keeps it "dark"
  speedStart: 130, // px/s
  speedMax: 420,
  spawnIntervalStartMs: 1100,
  spawnIntervalMinMs: 220,
  difficultyRampSeconds: 60,
};

export const POWER_UP = {
  radius: 10,
  color: new Color3(1, 0.85, 0.3),
  spawnIntervalMinMs: 4000,
  spawnIntervalMaxMs: 8000,
  shieldDurationMs: 5000,
};
