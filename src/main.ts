import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { CHARACTERS, SHIELD_RING, DARK_ORB, ORB_TYPES, POWER_UP, WAVE } from "./entities";
import type { CharacterDef, OrbTypeDef } from "./entities";
import { sfxStart, sfxDash, sfxHit, sfxShield, sfxShieldBlock, sfxKill, sfxGameOver, sfxWave } from "./audio";

type GameState = "start" | "playing" | "gameover";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const playerEl = document.getElementById("player")!;
const shieldRingEl = document.getElementById("shieldRing")!;
const scoreEl = document.getElementById("score")!;
const bestScoreEl = document.getElementById("bestScore")!;
const healthEl = document.getElementById("health")!;
const shieldBadgeEl = document.getElementById("shield")!;
const dashBadgeEl = document.getElementById("dash")!;
const menuEl = document.getElementById("menu")!;
const menuTitleEl = document.getElementById("menuTitle")!;
const menuHintEl = document.getElementById("menuHint")!;
const startHintEl = document.getElementById("startHint")!;
const finalScoreEl = document.getElementById("finalScore")!;
const waveBannerEl = document.getElementById("waveBanner")!;
const characterSelectEl = document.getElementById("characterSelect")!;
const characterInfoEl = document.getElementById("characterInfo")!;

// Orbs and power-ups stay Babylon meshes (they already read as flat 2D circles
// head-on through the orthographic camera). The player is a plain CSS element —
// see entities.ts for why — positioned each frame via worldToScreen below.
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
const scene = new Scene(engine);
scene.clearColor = new Color4(0.02, 0.02, 0.04, 1);

let halfW = window.innerWidth / 2;
let halfH = window.innerHeight / 2;

const camera = new FreeCamera("cam", new Vector3(0, 0, -1000), scene);
camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
camera.setTarget(Vector3.Zero());
applyCameraBounds();

new HemisphericLight("light", new Vector3(0, 0, -1), scene);

const glow = new GlowLayer("glow", scene);
glow.intensity = 0.9;

function applyCameraBounds() {
  camera.orthoLeft = -halfW;
  camera.orthoRight = halfW;
  camera.orthoTop = halfH;
  camera.orthoBottom = -halfH;
}

function clampToBounds(x: number, y: number, margin: number) {
  return {
    x: Math.max(-halfW + margin, Math.min(halfW - margin, x)),
    y: Math.max(-halfH + margin, Math.min(halfH - margin, y)),
  };
}

function worldToScreen(x: number, y: number) {
  return { sx: halfW + x, sy: halfH - y };
}

// distance from point (px,py) to segment (ax,ay)-(bx,by)
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + dx * t;
  const cy = ay + dy * t;
  return Math.hypot(px - cx, py - cy);
}

// --- character select -------------------------------------------------------
let selectedCharacter: CharacterDef = CHARACTERS[0];

function applyCharacterVisual(char: CharacterDef) {
  playerEl.style.setProperty("--char-color", char.color);
  playerEl.style.width = `${char.radius * 2}px`;
  playerEl.style.height = `${char.radius * 2}px`;
  playerEl.style.clipPath = char.clipPath;
  const ringSize = char.radius * 2 * SHIELD_RING.radiusMultiplier;
  shieldRingEl.style.width = `${ringSize}px`;
  shieldRingEl.style.height = `${ringSize}px`;
  characterInfoEl.textContent = char.description;
}

const characterButtons: HTMLButtonElement[] = [];
for (const char of CHARACTERS) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "character-btn";
  btn.style.setProperty("--btn-color", char.color);
  btn.innerHTML = `<span class="swatch" style="clip-path: ${char.clipPath}"></span><span>${char.name}</span>`;
  btn.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    selectedCharacter = char;
    applyCharacterVisual(char);
    for (const b of characterButtons) b.classList.remove("selected");
    btn.classList.add("selected");
  });
  characterSelectEl.appendChild(btn);
  characterButtons.push(btn);
}
characterButtons[0]?.classList.add("selected");
applyCharacterVisual(selectedCharacter);

let playerPos = { x: 0, y: 0 };
let facing = { x: 0, y: 1 };

function renderPlayerEl() {
  const { sx, sy } = worldToScreen(playerPos.x, playerPos.y);
  const r = selectedCharacter.radius;
  playerEl.style.setProperty("translate", `${sx - r}px ${sy - r}px`);
  const angleDeg = (Math.atan2(-facing.y, facing.x) * 180) / Math.PI;
  playerEl.style.setProperty("rotate", `${angleDeg}deg`);
}
renderPlayerEl();

function updateShieldRingPosition() {
  const r = selectedCharacter.radius * SHIELD_RING.radiusMultiplier;
  const { sx, sy } = worldToScreen(playerPos.x, playerPos.y);
  shieldRingEl.style.setProperty("translate", `${sx - r}px ${sy - r}px`);
}

// --- best score (persisted) --------------------------------------------------
const BEST_SCORE_KEY = "shadowdash-best-score";
let bestScore = Number(localStorage.getItem(BEST_SCORE_KEY) ?? 0);

function renderBestScore() {
  bestScoreEl.textContent = `BEST ${bestScore.toFixed(1)}`;
}
renderBestScore();

// --- health -------------------------------------------------------------------
let hp = 0;
let invulnerableUntil = 0;

function renderHealthPips() {
  healthEl.innerHTML = "";
  for (let i = 0; i < selectedCharacter.maxHp; i++) {
    const pip = document.createElement("span");
    pip.className = "hp-pip" + (i >= hp ? " lost" : "");
    healthEl.appendChild(pip);
  }
}

function takeDamage() {
  hp -= 1;
  renderHealthPips();
  sfxHit();
  invulnerableUntil = performance.now() + 900;
  playerEl.classList.add("invulnerable");
  setTimeout(() => playerEl.classList.remove("invulnerable"), 900);
  if (hp <= 0) endGame();
}

// --- orbs / power-ups -------------------------------------------------------
interface Orb {
  mesh: Mesh;
  type: OrbTypeDef;
  radius: number;
  spawnX: number;
  spawnY: number;
  dirX: number;
  dirY: number;
  perpX: number;
  perpY: number;
  speed: number;
  traveled: number;
  ageMs: number;
  hasSplit: boolean;
}
interface PowerUp {
  mesh: Mesh;
  spawnedAt: number;
}

const orbMaterials = new Map<string, StandardMaterial>();
for (const type of ORB_TYPES) {
  const mat = new StandardMaterial(`orbMat-${type.id}`, scene);
  mat.emissiveColor = type.color;
  mat.diffuseColor = DARK_ORB.dimColor;
  mat.disableLighting = true;
  orbMaterials.set(type.id, mat);
}

const powerMat = new StandardMaterial("powerMat", scene);
powerMat.emissiveColor = POWER_UP.color;
powerMat.disableLighting = true;

let orbs: Orb[] = [];
let powerUps: PowerUp[] = [];

function createOrb(x: number, y: number, dirX: number, dirY: number, speed: number, type: OrbTypeDef, radius: number): Orb {
  const mesh = MeshBuilder.CreateSphere("orb", { diameter: radius * 2 }, scene);
  mesh.material = orbMaterials.get(type.id)!;
  mesh.position.x = x;
  mesh.position.y = y;
  return {
    mesh,
    type,
    radius,
    spawnX: x,
    spawnY: y,
    dirX,
    dirY,
    perpX: -dirY,
    perpY: dirX,
    speed,
    traveled: 0,
    ageMs: 0,
    hasSplit: false,
  };
}

function spawnOrb(speed: number) {
  const angle = Math.random() * Math.PI * 2;
  const spawnDist = Math.max(halfW, halfH) * 1.2;
  const sx = Math.cos(angle) * spawnDist;
  const sy = Math.sin(angle) * spawnDist;
  const dx = playerPos.x - sx;
  const dy = playerPos.y - sy;
  const len = Math.hypot(dx, dy) || 1;
  const type = ORB_TYPES[Math.floor(Math.random() * ORB_TYPES.length)];
  orbs.push(createOrb(sx, sy, dx / len, dy / len, speed, type, DARK_ORB.radius));
}

function spawnSplitShards(o: Orb) {
  const shardType = ORB_TYPES[0]; // plain drifter shards — no chained re-splitting
  const baseAngle = Math.atan2(o.dirY, o.dirX);
  const spreadRad = (35 * Math.PI) / 180;
  for (const sign of [-1, 1]) {
    const angle = baseAngle + sign * spreadRad;
    orbs.push(createOrb(o.mesh.position.x, o.mesh.position.y, Math.cos(angle), Math.sin(angle), o.speed * 1.1, shardType, o.radius * 0.65));
  }
  spawnBurst(o.mesh.position.x, o.mesh.position.y, o.type.cssColor, o.radius * 3);
  sfxKill();
}

function spawnPowerUp() {
  const margin = 60;
  const x = (Math.random() * 2 - 1) * (halfW - margin);
  const y = (Math.random() * 2 - 1) * (halfH - margin);
  const mesh = MeshBuilder.CreateSphere("power", { diameter: POWER_UP.radius * 2 }, scene);
  mesh.material = powerMat;
  mesh.position.x = x;
  mesh.position.y = y;
  powerUps.push({ mesh, spawnedAt: performance.now() });
}

function clearEntities() {
  for (const o of orbs) o.mesh.dispose();
  for (const p of powerUps) p.mesh.dispose();
  orbs = [];
  powerUps = [];
}

// --- visual effects (plain DOM, matches the player being CSS-only) -----------
function spawnBurst(x: number, y: number, cssColor: string, sizePx: number) {
  const burst = document.createElement("div");
  burst.className = "hit-burst";
  burst.style.width = `${sizePx}px`;
  burst.style.height = `${sizePx}px`;
  burst.style.color = cssColor;
  const { sx, sy } = worldToScreen(x, y);
  burst.style.setProperty("translate", `${sx - sizePx / 2}px ${sy - sizePx / 2}px`);
  document.body.appendChild(burst);
  setTimeout(() => burst.remove(), 300);
}

function spawnDashGhost(x: number, y: number) {
  const ghost = document.createElement("div");
  ghost.className = "dash-ghost";
  const r = selectedCharacter.radius;
  ghost.style.width = `${r * 2}px`;
  ghost.style.height = `${r * 2}px`;
  ghost.style.background = selectedCharacter.color;
  ghost.style.clipPath = selectedCharacter.clipPath;
  const { sx, sy } = worldToScreen(x, y);
  ghost.style.setProperty("translate", `${sx - r}px ${sy - r}px`);
  ghost.style.setProperty("rotate", playerEl.style.getPropertyValue("rotate"));
  document.body.appendChild(ghost);
  setTimeout(() => ghost.remove(), 260);
}

// --- dash ----------------------------------------------------------------------
let lastDashAt = -Infinity;

function destroyOrb(o: Orb, i: number) {
  spawnBurst(o.mesh.position.x, o.mesh.position.y, o.type.cssColor, o.radius * 2.6);
  o.mesh.dispose();
  orbs.splice(i, 1);
  sfxKill();
}

function tryDash() {
  if (state !== "playing") return;
  const now = performance.now();
  if (now - lastDashAt < selectedCharacter.dashCooldownMs) return;
  lastDashAt = now;
  sfxDash();

  const startX = playerPos.x;
  const startY = playerPos.y;
  const clamped = clampToBounds(
    playerPos.x + facing.x * selectedCharacter.dashDistance,
    playerPos.y + facing.y * selectedCharacter.dashDistance,
    selectedCharacter.radius
  );
  playerPos.x = clamped.x;
  playerPos.y = clamped.y;
  renderPlayerEl();

  // dash effect is a real gameplay mechanic, not just visual — see entities.ts DashEffect
  if (selectedCharacter.dashEffect === "pierce") {
    // destroys any orb swept by the dash's travel path
    const hitRadius = selectedCharacter.radius + DARK_ORB.radius;
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      if (distToSegment(o.mesh.position.x, o.mesh.position.y, startX, startY, playerPos.x, playerPos.y) < hitRadius) {
        destroyOrb(o, i);
      }
    }
  } else if (selectedCharacter.dashEffect === "shockwave") {
    // destroys everything in a radius around the landing point
    const radius = selectedCharacter.radius * (selectedCharacter.dashRadiusMultiplier ?? 3.5);
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      if (Math.hypot(o.mesh.position.x - playerPos.x, o.mesh.position.y - playerPos.y) < radius + o.radius) {
        destroyOrb(o, i);
      }
    }
    spawnBurst(playerPos.x, playerPos.y, selectedCharacter.color, radius * 2);
  } else {
    // phase: pure evasion — brief invulnerability, no orb destruction
    invulnerableUntil = Math.max(invulnerableUntil, now + 350);
    playerEl.classList.add("invulnerable");
    setTimeout(() => playerEl.classList.remove("invulnerable"), 350);
  }

  const steps = 4;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    spawnDashGhost(startX + (playerPos.x - startX) * t, startY + (playerPos.y - startY) * t);
  }
  playerEl.classList.add("dashing");
  setTimeout(() => playerEl.classList.remove("dashing"), 150);
}

// --- input -------------------------------------------------------------------
const MOVE_KEYS = new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"]);
const keys = new Set<string>();
window.addEventListener("keydown", (e) => {
  const key = e.key.toLowerCase();
  if (MOVE_KEYS.has(key)) keys.add(key);
  if (key === "shift") tryDash();
  if (e.code === "Space" && state !== "playing") startGame();
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("pointerdown", () => {
  if (state !== "playing") startGame();
});

// --- game state -------------------------------------------------------------
let state: GameState = "start";
let elapsed = 0;
let orbSpawnTimer = 0;
let orbInterval = DARK_ORB.spawnIntervalStartMs;
let powerUpTimer = 0;
let powerUpNextIn = randRange(POWER_UP.spawnIntervalMinMs, POWER_UP.spawnIntervalMaxMs);
let shieldActive = false;
let shieldUntil = 0;
let currentWave = 1;

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function showWaveBanner(waveNum: number) {
  waveBannerEl.textContent = `WAVE ${waveNum}`;
  waveBannerEl.classList.remove("show");
  void waveBannerEl.offsetWidth; // reflow so the animation restarts every time
  waveBannerEl.classList.remove("hidden");
  waveBannerEl.classList.add("show");
  setTimeout(() => waveBannerEl.classList.add("hidden"), 1600);
}

function startGame() {
  clearEntities();
  playerPos = { x: 0, y: 0 };
  facing = { x: 0, y: 1 };
  state = "playing";
  elapsed = 0;
  orbSpawnTimer = 0;
  orbInterval = DARK_ORB.spawnIntervalStartMs;
  powerUpTimer = 0;
  powerUpNextIn = randRange(POWER_UP.spawnIntervalMinMs, POWER_UP.spawnIntervalMaxMs);
  shieldActive = false;
  currentWave = 1;
  lastDashAt = -Infinity;
  hp = selectedCharacter.maxHp;
  invulnerableUntil = 0;
  playerEl.classList.remove("invulnerable");
  renderHealthPips();
  shieldRingEl.classList.add("hidden");
  shieldBadgeEl.classList.add("hidden");
  menuEl.classList.add("hidden");
  sfxStart();
}

function endGame() {
  state = "gameover";
  menuTitleEl.textContent = "GAME OVER";
  menuHintEl.classList.add("hidden");
  finalScoreEl.textContent = `Điểm số: ${elapsed.toFixed(1)}s`;
  finalScoreEl.classList.remove("hidden");
  startHintEl.textContent = "Nhấn Space hoặc bấm chuột để chơi lại";
  menuEl.classList.remove("hidden");
  sfxGameOver();
  if (elapsed > bestScore) {
    bestScore = elapsed;
    localStorage.setItem(BEST_SCORE_KEY, String(bestScore));
    renderBestScore();
  }
}

// pause while the tab/window isn't visible — an alt-tab shouldn't cost you a run
let paused = false;
document.addEventListener("visibilitychange", () => {
  paused = document.hidden;
});

scene.onBeforeRenderObservable.add(() => {
  if (paused) return;
  // clamp dt so a long stall (or resuming from a paused/hidden tab) can't fling
  // orbs/the player across the screen or dump a huge chunk onto the score
  const dt = Math.min(engine.getDeltaTime() / 1000, 1 / 30);

  if (state !== "playing") {
    renderPlayerEl();
    return;
  }

  elapsed += dt;
  scoreEl.textContent = elapsed.toFixed(1);

  // wave-clear checkpoint — purely a felt milestone (banner/sound/small heal),
  // Shadow Dash has no win state, this doesn't gate or change difficulty
  const wave = Math.floor(elapsed / WAVE.intervalSeconds) + 1;
  if (wave > currentWave) {
    currentWave = wave;
    showWaveBanner(currentWave);
    sfxWave();
    if (hp < selectedCharacter.maxHp) {
      hp += WAVE.healReward;
      renderHealthPips();
    }
  }

  // keyboard movement — arrow keys or WASD only
  let dx = 0;
  let dy = 0;
  if (keys.has("arrowleft") || keys.has("a")) dx -= 1;
  if (keys.has("arrowright") || keys.has("d")) dx += 1;
  if (keys.has("arrowup") || keys.has("w")) dy += 1;
  if (keys.has("arrowdown") || keys.has("s")) dy -= 1;
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    facing = { x: dx / len, y: dy / len };
    const clamped = clampToBounds(
      playerPos.x + facing.x * selectedCharacter.speed * dt,
      playerPos.y + facing.y * selectedCharacter.speed * dt,
      selectedCharacter.radius
    );
    playerPos.x = clamped.x;
    playerPos.y = clamped.y;
  }
  renderPlayerEl();

  // dash cooldown badge, with time remaining
  const cooldownLeftMs = selectedCharacter.dashCooldownMs - (performance.now() - lastDashAt);
  if (cooldownLeftMs > 0) {
    dashBadgeEl.textContent = `DASH ${(cooldownLeftMs / 1000).toFixed(1)}s`;
    dashBadgeEl.classList.add("cooldown");
  } else {
    dashBadgeEl.textContent = "DASH";
    dashBadgeEl.classList.remove("cooldown");
  }

  // difficulty ramp, with a wave riding on top so intensity breathes (dips and
  // bursts) instead of climbing in a flat line
  const baseT = Math.min(elapsed / DARK_ORB.difficultyRampSeconds, 1);
  const waveMod = Math.sin((elapsed / DARK_ORB.wavePeriodSeconds) * Math.PI * 2) * DARK_ORB.waveAmplitude;
  const t = Math.max(0, Math.min(1, baseT + waveMod));
  orbInterval = DARK_ORB.spawnIntervalStartMs + (DARK_ORB.spawnIntervalMinMs - DARK_ORB.spawnIntervalStartMs) * t;
  const orbSpeed = DARK_ORB.speedStart + (DARK_ORB.speedMax - DARK_ORB.speedStart) * t;

  orbSpawnTimer += dt * 1000;
  while (orbSpawnTimer >= orbInterval) {
    orbSpawnTimer -= orbInterval;
    spawnOrb(orbSpeed);
  }

  powerUpTimer += dt * 1000;
  if (powerUpTimer >= powerUpNextIn) {
    powerUpTimer = 0;
    powerUpNextIn = randRange(POWER_UP.spawnIntervalMinMs, POWER_UP.spawnIntervalMaxMs);
    spawnPowerUp();
  }

  // shield timeout
  if (shieldActive && performance.now() >= shieldUntil) {
    shieldActive = false;
    shieldRingEl.classList.add("hidden");
    shieldBadgeEl.classList.add("hidden");
  }
  if (shieldActive) updateShieldRingPosition();

  // update orbs (per-type movement mechanic), cull off-screen, check collision
  const cullDist = Math.max(halfW, halfH) * 1.8;
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    o.traveled += o.speed * dt;
    o.ageMs += dt * 1000;

    let px = o.spawnX + o.dirX * o.traveled;
    let py = o.spawnY + o.dirY * o.traveled;
    if (o.type.behavior === "wobble") {
      const offset = Math.sin(o.traveled * (o.type.wobbleFrequency ?? 0)) * (o.type.wobbleAmplitude ?? 0);
      px += o.perpX * offset;
      py += o.perpY * offset;
    }
    o.mesh.position.x = px;
    o.mesh.position.y = py;

    if (o.type.behavior === "split" && !o.hasSplit && o.ageMs >= (o.type.splitAfterMs ?? Infinity)) {
      o.hasSplit = true;
      spawnSplitShards(o);
      o.mesh.dispose();
      orbs.splice(i, 1);
      continue;
    }

    const distFromCenter = Math.hypot(px, py);
    if (distFromCenter > cullDist) {
      o.mesh.dispose();
      orbs.splice(i, 1);
      continue;
    }

    const dPlayer = Math.hypot(px - playerPos.x, py - playerPos.y);
    if (dPlayer < o.radius + selectedCharacter.radius) {
      const wasInvulnerable = performance.now() < invulnerableUntil;
      o.mesh.dispose();
      orbs.splice(i, 1);
      if (shieldActive) {
        // shield fully absorbs, no damage — but give it its own feedback
        spawnBurst(px, py, SHIELD_RING.color, o.radius * 2.6);
        sfxShieldBlock();
      } else if (!wasInvulnerable) {
        takeDamage();
        if (state !== "playing") return;
      }
    }
  }

  // power-up collection
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const p = powerUps[i];
    const dPlayer = Math.hypot(p.mesh.position.x - playerPos.x, p.mesh.position.y - playerPos.y);
    if (dPlayer < POWER_UP.radius + selectedCharacter.radius) {
      p.mesh.dispose();
      powerUps.splice(i, 1);
      shieldActive = true;
      shieldUntil = performance.now() + POWER_UP.shieldDurationMs;
      shieldRingEl.classList.remove("hidden");
      shieldBadgeEl.classList.remove("hidden");
      updateShieldRingPosition(); // set position now — don't wait a frame and flash at the stale spot
      sfxShield();
    } else {
      const pulse = 1 + Math.sin(performance.now() / 150 + i) * 0.15;
      p.mesh.scaling.setAll(pulse);
    }
  }
});

engine.runRenderLoop(() => scene.render());

window.addEventListener("resize", () => {
  halfW = window.innerWidth / 2;
  halfH = window.innerHeight / 2;
  applyCameraBounds();
  engine.resize();
});
