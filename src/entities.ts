import { Color3 } from "@babylonjs/core/Maths/math.color";

// Design catalog: every game object's visual look and gameplay stats live here,
// separate from the update/spawn logic in main.ts. Add a new enemy, power-up,
// or projectile by adding an entry here, then wiring its spawn/behavior in main.ts.
//
// The player is rendered as a plain CSS element (not a Babylon mesh) so it stays
// flat 2D — no accidental 3D rotation. Add a new selectable character by adding
// an entry to CHARACTERS; main.ts reads whichever one the player picks at the
// start screen.

// Dash effects are a real gameplay mechanic, not just a visual flourish:
//   pierce     — destroys any orb swept by the dash's travel path
//   phase      — grants brief invulnerability instead (pure evasion, no kill)
//   shockwave  — destroys every orb in a radius around the landing point
export type DashEffect = "pierce" | "phase" | "shockwave";

export interface CharacterDef {
  id: string;
  name: string;
  color: string; // CSS color
  radius: number;
  speed: number; // px/s
  maxHp: number; // hits taken before game over
  dashDistance: number; // px, instant burst distance
  dashCooldownMs: number;
  dashEffect: DashEffect;
  dashRadiusMultiplier?: number; // shockwave only: kill radius = radius * this
  clipPath: string; // CSS clip-path polygon, drawn pointing right (0 deg = facing +X)
  description: string; // shown on the character-select screen
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: "vanguard",
    name: "Vanguard",
    color: "#6cf0ff",
    radius: 14,
    speed: 460,
    maxHp: 3,
    dashDistance: 150,
    dashCooldownMs: 1400,
    dashEffect: "pierce",
    clipPath: "polygon(100% 50%, 0% 0%, 28% 50%, 0% 100%)", // arrow/ship — balanced
    description: "Cân bằng. Tốc độ & máu vừa phải. Dash Xuyên Phá: phá hủy mọi quái vật nằm trên đường lướt.",
  },
  {
    id: "phantom",
    name: "Phantom",
    color: "#c86bff",
    radius: 11,
    speed: 560,
    maxHp: 2,
    dashDistance: 190,
    dashCooldownMs: 1000,
    dashEffect: "phase",
    clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)", // slim diamond — fast, fragile
    description: "Nhanh & mỏng manh (chỉ 2 máu), hồi Dash rất ngắn. Dash Ẩn Thân: không phá quái, nhưng bất tử tức thời để né đòn.",
  },
  {
    id: "titan",
    name: "Titan",
    color: "#ffd166",
    radius: 18,
    speed: 360,
    maxHp: 4,
    dashDistance: 110,
    dashCooldownMs: 1900,
    dashEffect: "shockwave",
    dashRadiusMultiplier: 5.5,
    clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)", // hexagon — tanky, slow
    description: "To xác, chậm, nhiều máu nhất (4 máu). Dash Chấn Động: nổ ra một vùng lớn quanh điểm đáp, phá hủy mọi quái vật trong bán kính đó.",
  },
];

export const SHIELD_RING = {
  color: "#4fd8ff",
  thickness: 3, // px
  radiusMultiplier: 1.6, // relative to the active character's radius
};

export const DARK_ORB = {
  radius: 12,
  dimColor: new Color3(0.05, 0.02, 0.05), // shared non-lit base tint, keeps every type "dark"
  speedStart: 130, // px/s
  speedMax: 420,
  spawnIntervalStartMs: 1100,
  spawnIntervalMinMs: 220,
  difficultyRampSeconds: 60,
  // difficulty isn't a flat ramp — a sine wave rides on top of it so intensity
  // breathes (quieter dips, denser bursts) instead of climbing monotonically
  waveAmplitude: 0.25,
  wavePeriodSeconds: 18,
};

// Orb variety: same base power level as DARK_ORB above (not "stronger"), just a
// different movement mechanic + a distinct tint so the player can read the
// threat. Add a new monster type by adding an entry here and a `behavior`
// branch in main.ts's orb-update loop.
export interface OrbTypeDef {
  id: string;
  color: Color3; // Babylon material emissive
  cssColor: string; // same color, for DOM effects (hit-burst, split-burst)
  behavior: "drift" | "wobble" | "split";
  wobbleAmplitude?: number; // px lateral offset (wobble only)
  wobbleFrequency?: number; // radians per px traveled (wobble only)
  splitAfterMs?: number; // time alive before splitting (split only)
}

export const ORB_TYPES: OrbTypeDef[] = [
  {
    id: "drifter",
    color: new Color3(0.5, 0.05, 0.15),
    cssColor: "#a30d26",
    behavior: "drift", // straight line toward the player's position at spawn time
  },
  {
    id: "wobbler",
    color: new Color3(0.55, 0.15, 0.5),
    cssColor: "#8c2680",
    behavior: "wobble", // weaves side to side while advancing — harder to predict
    wobbleAmplitude: 55,
    wobbleFrequency: 0.012,
  },
  {
    id: "splitter",
    color: new Color3(0.18, 0.1, 0.55),
    cssColor: "#2e1a8c",
    behavior: "split", // travels straight, then splits into 2 shards after a delay
    splitAfterMs: 900,
  },
];

export const POWER_UP = {
  radius: 10,
  color: new Color3(1, 0.85, 0.3),
  spawnIntervalMinMs: 4000,
  spawnIntervalMaxMs: 8000,
  shieldDurationMs: 5000,
};

// Shadow Dash has no win state — it's endless survival, score = time survived.
// These are just a felt "you cleared that stretch" checkpoint every N seconds
// (banner + sound + a small HP reward), not a pass/fail gate.
export const WAVE = {
  intervalSeconds: 20,
  healReward: 1,
};
