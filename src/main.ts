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
import { CHARACTERS, SHIELD_RING, DARK_ORB, POWER_UP } from "./entities";
import type { CharacterDef } from "./entities";

type GameState = "start" | "playing" | "gameover";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const playerEl = document.getElementById("player")!;
const shieldRingEl = document.getElementById("shieldRing")!;
const scoreEl = document.getElementById("score")!;
const shieldBadgeEl = document.getElementById("shield")!;
const dashBadgeEl = document.getElementById("dash")!;
const overlayEl = document.getElementById("overlay")!;
const gameoverEl = document.getElementById("gameover")!;
const finalScoreEl = document.getElementById("finalScore")!;
const characterSelectEl = document.getElementById("characterSelect")!;

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

// --- orbs / power-ups -------------------------------------------------------
interface Orb {
  mesh: Mesh;
  vx: number;
  vy: number;
}
interface PowerUp {
  mesh: Mesh;
  spawnedAt: number;
}

const orbMat = new StandardMaterial("orbMat", scene);
orbMat.emissiveColor = DARK_ORB.color;
orbMat.diffuseColor = DARK_ORB.dimColor;
orbMat.disableLighting = true;

const powerMat = new StandardMaterial("powerMat", scene);
powerMat.emissiveColor = POWER_UP.color;
powerMat.disableLighting = true;

let orbs: Orb[] = [];
let powerUps: PowerUp[] = [];

function spawnOrb(speed: number) {
  const angle = Math.random() * Math.PI * 2;
  const spawnDist = Math.max(halfW, halfH) * 1.2;
  const sx = Math.cos(angle) * spawnDist;
  const sy = Math.sin(angle) * spawnDist;
  const dx = playerPos.x - sx;
  const dy = playerPos.y - sy;
  const len = Math.hypot(dx, dy) || 1;
  const mesh = MeshBuilder.CreateSphere("orb", { diameter: DARK_ORB.radius * 2 }, scene);
  mesh.material = orbMat;
  mesh.position.x = sx;
  mesh.position.y = sy;
  orbs.push({ mesh, vx: (dx / len) * speed, vy: (dy / len) * speed });
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

// --- dash --------------------------------------------------------------------
let lastDashAt = -Infinity;

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

function tryDash() {
  if (state !== "playing") return;
  const now = performance.now();
  if (now - lastDashAt < selectedCharacter.dashCooldownMs) return;
  lastDashAt = now;

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

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min);
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
  lastDashAt = -Infinity;
  shieldRingEl.classList.add("hidden");
  shieldBadgeEl.classList.add("hidden");
  overlayEl.classList.add("hidden");
  gameoverEl.classList.add("hidden");
}

function endGame() {
  state = "gameover";
  finalScoreEl.textContent = `Điểm số: ${elapsed.toFixed(1)}s`;
  gameoverEl.classList.remove("hidden");
}

scene.onBeforeRenderObservable.add(() => {
  const dt = engine.getDeltaTime() / 1000;

  if (state !== "playing") {
    renderPlayerEl();
    return;
  }

  elapsed += dt;
  scoreEl.textContent = elapsed.toFixed(1);

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

  // dash cooldown badge
  const dashReady = performance.now() - lastDashAt >= selectedCharacter.dashCooldownMs;
  dashBadgeEl.classList.toggle("cooldown", !dashReady);

  // difficulty ramp
  const t = Math.min(elapsed / DARK_ORB.difficultyRampSeconds, 1);
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
  if (shieldActive) {
    const r = selectedCharacter.radius * SHIELD_RING.radiusMultiplier;
    const { sx, sy } = worldToScreen(playerPos.x, playerPos.y);
    shieldRingEl.style.setProperty("translate", `${sx - r}px ${sy - r}px`);
  }

  // update orbs, cull off-screen, check collision
  const cullDist = Math.max(halfW, halfH) * 1.8;
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    o.mesh.position.x += o.vx * dt;
    o.mesh.position.y += o.vy * dt;

    const distFromCenter = Math.hypot(o.mesh.position.x, o.mesh.position.y);
    if (distFromCenter > cullDist) {
      o.mesh.dispose();
      orbs.splice(i, 1);
      continue;
    }

    const dPlayer = Math.hypot(o.mesh.position.x - playerPos.x, o.mesh.position.y - playerPos.y);
    if (dPlayer < DARK_ORB.radius + selectedCharacter.radius) {
      if (shieldActive) {
        o.mesh.dispose();
        orbs.splice(i, 1);
      } else {
        endGame();
        return;
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
