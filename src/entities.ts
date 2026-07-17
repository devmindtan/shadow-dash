import { Color3 } from "@babylonjs/core/Maths/math.color";
import vanguardSprite from "./assets/img/vanguard.png";
import phantomSprite from "./assets/img/phantom.png";
import titanSprite from "./assets/img/titan.png";

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
  description: string; // shown on the character-select screen
  spriteUrl: string; // character art — rendered in-game (scaled well above hit radius for readability) and on the select screen
  directionalSprite: boolean; // true: art was generated facing right, rotate to face travel like the old clip-path shapes did.
  // false: art is a front-facing portrait (e.g. a humanoid) — rotating it to face travel looks broken (sideways/upside-down),
  // so it stays upright and only mirrors horizontally for left vs right instead.
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
    description: "Cân bằng. Tốc độ & máu vừa phải. Dash Xuyên Phá: phá hủy mọi quái vật nằm trên đường lướt.",
    spriteUrl: vanguardSprite,
    directionalSprite: true,
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
    description: "Nhanh & mỏng manh (chỉ 2 máu), hồi Dash rất ngắn. Dash Ẩn Thân: không phá quái, nhưng bất tử tức thời để né đòn.",
    spriteUrl: phantomSprite,
    directionalSprite: true,
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
    description: "To xác, chậm, nhiều máu nhất (4 máu). Dash Chấn Động: nổ ra một vùng lớn quanh điểm đáp, phá hủy mọi quái vật trong bán kính đó.",
    spriteUrl: titanSprite,
    directionalSprite: false,
  },
];

export const SHIELD_RING = {
  color: "#4fd8ff",
  thickness: 3, // px
  radiusMultiplier: 1.15, // relative to the character's on-screen sprite size (see SPRITE_VISUAL_SCALE in ui.ts), not the hit radius
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
  name: string; // shown in the in-game Library
  description: string;
  color: Color3; // Babylon material emissive
  cssColor: string; // same color, for DOM effects (hit-burst, split-burst)
  behavior: "drift" | "wobble" | "split" | "track" | "charge";
  wobbleAmplitude?: number; // px lateral offset (wobble only)
  wobbleFrequency?: number; // radians per px traveled (wobble only)
  splitAfterMs?: number; // time alive before splitting (split only)
  chargeAfterMs?: number; // time crawling slowly before the speed burst (charge only)
}

export const ORB_TYPES: OrbTypeDef[] = [
  {
    id: "drifter",
    name: "Kẻ Trôi Dạt",
    description: "Lao thẳng một đường theo hướng bạn đứng lúc nó xuất hiện — dễ đoán nếu bạn né sớm.",
    color: new Color3(0.5, 0.05, 0.15),
    cssColor: "#a30d26",
    behavior: "drift", // straight line toward the player's position at spawn time
  },
  {
    id: "wobbler",
    name: "Kẻ Lượn Sóng",
    description: "Vừa tiến vừa lượn sang hai bên theo hình sin — khó đoán quỹ đạo hơn Kẻ Trôi Dạt.",
    color: new Color3(0.55, 0.15, 0.5),
    cssColor: "#8c2680",
    behavior: "wobble", // weaves side to side while advancing — harder to predict
    wobbleAmplitude: 55,
    wobbleFrequency: 0.012,
  },
  {
    id: "splitter",
    name: "Kẻ Phân Rã",
    description: "Bay thẳng, sau khoảng 0.9s tách làm 2 mảnh nhỏ hơn bay chéo ra hai bên.",
    color: new Color3(0.18, 0.1, 0.55),
    cssColor: "#2e1a8c",
    behavior: "split", // travels straight, then splits into 2 shards after a delay
    splitAfterMs: 900,
  },
  {
    id: "tracker",
    name: "Kẻ Săn Đuổi",
    description: "Liên tục đổi hướng bám theo vị trí hiện tại của bạn — không thể né bằng cách đứng yên hay đi vòng.",
    color: new Color3(0.05, 0.4, 0.45),
    cssColor: "#0d7a8c",
    behavior: "track", // re-aims toward the player's *current* position every frame
  },
  {
    id: "charger",
    name: "Kẻ Xung Phong",
    description: "Bò chậm rãi lúc đầu, rồi bất ngờ lao nhanh gấp nhiều lần — né sớm vì khi nó lao thì đã quá trễ.",
    color: new Color3(0.55, 0.28, 0.02),
    cssColor: "#8c4705",
    behavior: "charge", // crawls, then bursts to a much higher speed after chargeAfterMs
    chargeAfterMs: 700,
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

// In-run upgrade pool (roguelite-style): each wave-clear pauses the game and
// offers 3 random picks from here. These scale a per-run stat copy, not the
// CHARACTERS entries themselves — a run's upgrades never carry over or affect
// other characters. Picking the same upgrade again stacks it to the next
// level (main.ts tracks levels and shows "next level" on the card).
//
// Two categories, mixed together in the random draw rather than gated behind
// a separate picker:
//   stat   — scales an existing number (cooldown, distance, speed, HP)
//   effect — a genuinely new Dash mechanic layered on top of whatever the
//            character's core dashEffect already does (see tryDash() in main.ts)
export interface UpgradeDef {
  id:
    | "heal"
    | "max_hp"
    | "dash_cooldown"
    | "dash_distance"
    | "dash_power"
    | "move_speed"
    | "dash_chain"
    | "dash_magnet"
    | "dash_shockburst"
    | "retaliate"
    | "aura"
    | "second_wind";
  name: string;
  description: string;
  category: "stat" | "effect";
  // Effect upgrades only: every one caps at 5 levels, and every level makes
  // it bigger/faster/stronger (numeric growth) — a couple also unlock a small
  // extra behavior at level 5 as a capstone. levelDetails is what the Library
  // detail view and the offer-card level text are both built from, so the
  // displayed text and the actual behavior can't drift apart.
  maxLevel?: number;
  levelDetails?: string[];
}

export const UPGRADES: UpgradeDef[] = [
  { id: "heal", name: "Hồi Máu", description: "Hồi ngay 1 ô máu.", category: "stat" },
  { id: "max_hp", name: "Máu Tối Đa", description: "+1 máu tối đa, hồi luôn ô đó.", category: "stat" },
  { id: "dash_cooldown", name: "Hồi Chiêu Nhanh", description: "Giảm 18% thời gian hồi Dash.", category: "stat" },
  { id: "dash_distance", name: "Lướt Xa", description: "+20% khoảng cách Dash.", category: "stat" },
  { id: "dash_power", name: "Dash Mạnh Hơn", description: "Tăng 25% hiệu lực Dash (bán kính phá quái hoặc thời gian bất tử, tùy nhân vật).", category: "stat" },
  { id: "move_speed", name: "Nhanh Nhẹn", description: "+10% tốc độ di chuyển.", category: "stat" },
  {
    id: "dash_chain",
    name: "Dash Nối Tiếp",
    description: "Dash phá được quái (hoặc lướt sát quái nếu bạn dùng hiệu ứng né tránh) sẽ được hoàn lại một phần thời gian hồi chiêu.",
    category: "effect",
    maxLevel: 5,
    levelDetails: [
      "Lv.1: Hoàn 15% thời gian hồi chiêu.",
      "Lv.2: Hoàn 28% thời gian hồi chiêu.",
      "Lv.3: Hoàn 40% thời gian hồi chiêu.",
      "Lv.4: Hoàn 52% thời gian hồi chiêu.",
      "Lv.5: Hoàn 65% thời gian hồi chiêu, cộng 25% cơ hội hồi chiêu toàn bộ ngay lập tức.",
    ],
  },
  {
    id: "dash_magnet",
    name: "Từ Trường",
    description: "Dash hút các điểm sáng (power-up) gần đó lại phía bạn.",
    category: "effect",
    maxLevel: 5,
    levelDetails: [
      "Lv.1: Hút trong bán kính 220px, kéo lại 50% khoảng cách.",
      "Lv.2: Bán kính 300px, kéo lại 55% khoảng cách.",
      "Lv.3: Bán kính 380px, kéo lại 60% khoảng cách.",
      "Lv.4: Bán kính 460px, kéo lại 65% khoảng cách.",
      "Lv.5: Bán kính 560px, kéo lại 75% — power-up trong nửa bán kính được nhặt ngay lập tức.",
    ],
  },
  {
    id: "dash_shockburst",
    name: "Dư Chấn",
    description: "Mọi cú Dash đều gây thêm một vụ nổ nhỏ quanh điểm đáp, phá quái xung quanh — kể cả với Vanguard/Phantom.",
    category: "effect",
    maxLevel: 5,
    levelDetails: [
      "Lv.1: Bán kính nổ = 2.2x cơ thể.",
      "Lv.2: Bán kính nổ = 3.0x cơ thể.",
      "Lv.3: Bán kính nổ = 3.8x cơ thể.",
      "Lv.4: Bán kính nổ = 4.8x cơ thể.",
      "Lv.5: Bán kính nổ = 6.5x cơ thể — bước nhảy lớn nhất trong chuỗi nâng cấp.",
    ],
  },
  {
    id: "retaliate",
    name: "Trả Đòn",
    description: "Khi bạn bị trúng đòn, mọi quái vật gần đó lập tức bị phá hủy theo — biến cú trúng đòn thành một đợt dọn quái.",
    category: "effect",
    maxLevel: 5,
    levelDetails: [
      "Lv.1: Phá quái trong bán kính 1.8x cơ thể quanh bạn.",
      "Lv.2: Bán kính 2.6x cơ thể.",
      "Lv.3: Bán kính 3.4x cơ thể.",
      "Lv.4: Bán kính 4.2x cơ thể.",
      "Lv.5: Bán kính 5.2x cơ thể, cộng 0.3s bất tử ngay sau khi trả đòn.",
    ],
  },
  {
    id: "aura",
    name: "Vòng Hào Quang",
    description: "Một vùng sát thương thụ động luôn bao quanh bạn, tự động phá hủy quái vật lại gần — không cần Dash.",
    category: "effect",
    maxLevel: 5,
    levelDetails: [
      "Lv.1: Bán kính hào quang = 1.6x cơ thể.",
      "Lv.2: Bán kính = 2.1x cơ thể.",
      "Lv.3: Bán kính = 2.6x cơ thể.",
      "Lv.4: Bán kính = 3.2x cơ thể.",
      "Lv.5: Bán kính = 4.5x cơ thể — bước nhảy lớn nhất trong chuỗi nâng cấp.",
    ],
  },
  {
    id: "second_wind",
    name: "Hồi Sinh",
    description: "Đòn chí mạng sẽ không giết bạn — thay vào đó hồi máu và cho một khoảng bất tử dài. Mỗi lần nhặt thêm 1 lượt dùng.",
    category: "effect",
    maxLevel: 5,
    levelDetails: [
      "Lv.1: 1 lượt hồi sinh khả dụng.",
      "Lv.2: 2 lượt hồi sinh khả dụng.",
      "Lv.3: 3 lượt hồi sinh khả dụng.",
      "Lv.4: 4 lượt hồi sinh khả dụng.",
      "Lv.5: 5 lượt hồi sinh khả dụng — tối đa.",
    ],
  },
];
