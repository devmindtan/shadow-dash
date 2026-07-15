import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";

// --- tunables ---------------------------------------------------------
const PLAYER_RADIUS = 14;
const PLAYER_SPEED = 480; // px/s, keyboard control
const ORB_RADIUS = 12;
const ORB_INTERVAL_START = 1100; // ms between spawns
const ORB_INTERVAL_MIN = 220;
const ORB_SPEED_START = 130; // px/s
const ORB_SPEED_MAX = 420;
const DIFFICULTY_RAMP_SECONDS = 60;
const POWERUP_RADIUS = 10;
const POWERUP_INTERVAL_MIN = 4000;
const POWERUP_INTERVAL_MAX = 8000;
const SHIELD_DURATION_MS = 5000;

type GameState = "start" | "playing" | "gameover";

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const scoreEl = document.getElementById("score")!;
const shieldEl = document.getElementById("shield")!;
const overlayEl = document.getElementById("overlay")!;
const gameoverEl = document.getElementById("gameover")!;
const finalScoreEl = document.getElementById("finalScore")!;

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

function screenToWorld(clientX: number, clientY: number) {
  return { x: clientX - halfW, y: halfH - clientY };
}

function clampToBounds(x: number, y: number, margin: number) {
  return {
    x: Math.max(-halfW + margin, Math.min(halfW - margin, x)),
    y: Math.max(-halfH + margin, Math.min(halfH - margin, y)),
  };
}

// --- player -------------------------------------------------------------
const player = MeshBuilder.CreateBox("player", { size: PLAYER_RADIUS * 2 }, scene);
const playerMat = new StandardMaterial("playerMat", scene);
playerMat.emissiveColor = new Color3(0.6, 0.95, 1);
playerMat.disableLighting = true;
player.material = playerMat;

const shieldRing = MeshBuilder.CreateTorus("shield", { diameter: PLAYER_RADIUS * 3.2, thickness: 3 }, scene);
const shieldMat = new StandardMaterial("shieldMat", scene);
shieldMat.emissiveColor = new Color3(0.3, 0.8, 1);
shieldMat.disableLighting = true;
shieldMat.alpha = 0.7;
shieldRing.material = shieldMat;
shieldRing.isVisible = false;
shieldRing.rotation.x = Math.PI / 2;

let playerPos = { x: 0, y: 0 };

// --- entities -------------------------------------------------------------
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
orbMat.emissiveColor = new Color3(0.5, 0.05, 0.15);
orbMat.diffuseColor = new Color3(0.05, 0.02, 0.05);
orbMat.disableLighting = true;

const powerMat = new StandardMaterial("powerMat", scene);
powerMat.emissiveColor = new Color3(1, 0.85, 0.3);
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
  const mesh = MeshBuilder.CreateSphere("orb", { diameter: ORB_RADIUS * 2 }, scene);
  mesh.material = orbMat;
  mesh.position.x = sx;
  mesh.position.y = sy;
  orbs.push({ mesh, vx: (dx / len) * speed, vy: (dy / len) * speed });
}

function spawnPowerUp() {
  const margin = 60;
  const x = (Math.random() * 2 - 1) * (halfW - margin);
  const y = (Math.random() * 2 - 1) * (halfH - margin);
  const mesh = MeshBuilder.CreateSphere("power", { diameter: POWERUP_RADIUS * 2 }, scene);
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

// --- input ----------------------------------------------------------------
const keys = new Set<string>();
window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) keys.add(e.key);
  if (state !== "playing") startGame();
});
window.addEventListener("keyup", (e) => keys.delete(e.key));
window.addEventListener("pointerdown", () => {
  if (state !== "playing") startGame();
});
canvas.addEventListener("pointermove", (e) => {
  if (state !== "playing") return;
  const w = screenToWorld(e.clientX, e.clientY);
  const clamped = clampToBounds(w.x, w.y, PLAYER_RADIUS);
  playerPos.x = clamped.x;
  playerPos.y = clamped.y;
});

// --- game state -------------------------------------------------------------
let state: GameState = "start";
let elapsed = 0;
let orbSpawnTimer = 0;
let orbInterval = ORB_INTERVAL_START;
let powerUpTimer = 0;
let powerUpNextIn = randRange(POWERUP_INTERVAL_MIN, POWERUP_INTERVAL_MAX);
let shieldActive = false;
let shieldUntil = 0;

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function startGame() {
  clearEntities();
  playerPos = { x: 0, y: 0 };
  state = "playing";
  elapsed = 0;
  orbSpawnTimer = 0;
  orbInterval = ORB_INTERVAL_START;
  powerUpTimer = 0;
  powerUpNextIn = randRange(POWERUP_INTERVAL_MIN, POWERUP_INTERVAL_MAX);
  shieldActive = false;
  shieldRing.isVisible = false;
  shieldEl.classList.add("hidden");
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
    player.position.x = playerPos.x;
    player.position.y = playerPos.y;
    return;
  }

  elapsed += dt;
  scoreEl.textContent = elapsed.toFixed(1);

  // keyboard movement (mouse sets playerPos directly on pointermove)
  let dx = 0;
  let dy = 0;
  if (keys.has("ArrowLeft")) dx -= 1;
  if (keys.has("ArrowRight")) dx += 1;
  if (keys.has("ArrowUp")) dy += 1;
  if (keys.has("ArrowDown")) dy -= 1;
  if (dx !== 0 || dy !== 0) {
    const len = Math.hypot(dx, dy);
    const clamped = clampToBounds(
      playerPos.x + (dx / len) * PLAYER_SPEED * dt,
      playerPos.y + (dy / len) * PLAYER_SPEED * dt,
      PLAYER_RADIUS
    );
    playerPos.x = clamped.x;
    playerPos.y = clamped.y;
  }
  player.position.x = playerPos.x;
  player.position.y = playerPos.y;

  // difficulty ramp
  const t = Math.min(elapsed / DIFFICULTY_RAMP_SECONDS, 1);
  orbInterval = ORB_INTERVAL_START + (ORB_INTERVAL_MIN - ORB_INTERVAL_START) * t;
  const orbSpeed = ORB_SPEED_START + (ORB_SPEED_MAX - ORB_SPEED_START) * t;

  orbSpawnTimer += dt * 1000;
  while (orbSpawnTimer >= orbInterval) {
    orbSpawnTimer -= orbInterval;
    spawnOrb(orbSpeed);
  }

  powerUpTimer += dt * 1000;
  if (powerUpTimer >= powerUpNextIn) {
    powerUpTimer = 0;
    powerUpNextIn = randRange(POWERUP_INTERVAL_MIN, POWERUP_INTERVAL_MAX);
    spawnPowerUp();
  }

  // shield timeout
  if (shieldActive && performance.now() >= shieldUntil) {
    shieldActive = false;
    shieldRing.isVisible = false;
    shieldEl.classList.add("hidden");
  }
  if (shieldActive) {
    shieldRing.position.x = playerPos.x;
    shieldRing.position.y = playerPos.y;
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
    if (dPlayer < ORB_RADIUS + PLAYER_RADIUS) {
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
    if (dPlayer < POWERUP_RADIUS + PLAYER_RADIUS) {
      p.mesh.dispose();
      powerUps.splice(i, 1);
      shieldActive = true;
      shieldUntil = performance.now() + SHIELD_DURATION_MS;
      shieldRing.isVisible = true;
      shieldEl.classList.remove("hidden");
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
