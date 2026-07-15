import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Camera } from "@babylonjs/core/Cameras/camera";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { DARK_ORB, POWER_UP, SHIELD_RING, WAVE, UPGRADES } from "./entities";
import type { CharacterDef, UpgradeDef } from "./entities";
import { sfxStart, sfxDash, sfxHit, sfxShield, sfxShieldBlock, sfxKill, sfxGameOver, sfxWave } from "./audio";
import { getMoveDirection } from "./input";
import {
  canvas,
  playerEl,
  shieldRingEl,
  scoreEl,
  shieldBadgeEl,
  dashBadgeEl,
  menuEl,
  menuTitleEl,
  menuHintEl,
  startHintEl,
  finalScoreEl,
  upgradePickEl,
  upgradeCardsEl,
  upgradeLogEl,
  trainingBtn,
  trainingBadgeEl,
  trainingPanelEl,
  trainingExitBtn,
  trainingSpawnOrbBtn,
  trainingSpawnPowerBtn,
  getHalfDimensions,
  setHalfDimensions,
  clampToBounds,
  renderPlayerEl,
  updateShieldRingPosition,
  renderHealthPips,
  renderBestScore,
  showWaveBanner,
  spawnBurst,
  spawnDashGhost,
  initCharacterSelect,
  initLibrary,
  initTrainingRows,
  resetTrainingRowDisplays,
} from "./ui";
import { initOrbMaterials, spawnOrb, spawnSplitShards, updateOrbMovement, shouldSplitNow } from "./orbs";
import type { Orb } from "./orbs";
import { initPowerUpMaterial, spawnPowerUp, pulsePowerUp } from "./powerups";
import type { PowerUp } from "./powerups";
import {
  freshRunStats,
  applyUpgrade,
  getEffectLevel,
  setEffectLevel,
  pickRandomUpgrades,
  MAX_EFFECT_LEVEL,
  CHAIN_REFUND,
  MAGNET_RADIUS,
  MAGNET_PULL,
  SHOCKBURST_MULT,
  RETALIATE_MULT,
  AURA_MULT,
} from "./upgrades";
import type { RunStats } from "./upgrades";

type GameState = "start" | "playing" | "gameover";

// Orbs and power-ups stay Babylon meshes (they already read as flat 2D circles
// head-on through the orthographic camera). The player is a plain CSS element —
// see entities.ts for why — positioned each frame via ui.ts's worldToScreen.
const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
const scene = new Scene(engine);
scene.clearColor = new Color4(0.02, 0.02, 0.04, 1);

const camera = new FreeCamera("cam", new Vector3(0, 0, -1000), scene);
camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
camera.setTarget(Vector3.Zero());
applyCameraBounds();

new HemisphericLight("light", new Vector3(0, 0, -1), scene);

const glow = new GlowLayer("glow", scene);
glow.intensity = 0.9;

initOrbMaterials(scene);
initPowerUpMaterial(scene);

function applyCameraBounds() {
  const { halfW, halfH } = getHalfDimensions();
  camera.orthoLeft = -halfW;
  camera.orthoRight = halfW;
  camera.orthoTop = halfH;
  camera.orthoBottom = -halfH;
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
let selectedCharacter: CharacterDef = initCharacterSelect((char) => {
  selectedCharacter = char;
});

initLibrary();

let playerPos = { x: 0, y: 0 };
let facing = { x: 0, y: 1 };
renderPlayerEl(selectedCharacter.radius, playerPos, facing);

// --- best score (persisted) --------------------------------------------------
const BEST_SCORE_KEY = "shadowdash-best-score";
let bestScore = Number(localStorage.getItem(BEST_SCORE_KEY) ?? 0);
renderBestScore(bestScore);

// --- health / run stats -------------------------------------------------------
let hp = 0;
let invulnerableUntil = 0;
let runStats: RunStats = freshRunStats(selectedCharacter);

function takeDamage() {
  hp -= 1;

  // Hồi Sinh (Second Wind): a fatal hit is survived instead, once per charge
  if (hp <= 0 && runStats.secondWindCharges > 0) {
    runStats.secondWindCharges -= 1;
    hp = 1;
    renderHealthPips(hp, runStats.maxHp);
    sfxShield();
    invulnerableUntil = performance.now() + 1200;
    playerEl.classList.add("invulnerable");
    setTimeout(() => playerEl.classList.remove("invulnerable"), 1200);
    return;
  }

  renderHealthPips(hp, runStats.maxHp);
  sfxHit();
  invulnerableUntil = performance.now() + 900;
  playerEl.classList.add("invulnerable");
  setTimeout(() => playerEl.classList.remove("invulnerable"), 900);
  if (runStats.retaliateLevel > 0) {
    // Retaliate: getting hit destroys nearby orbs too, turning a hit into a small clear
    const radius = selectedCharacter.radius * RETALIATE_MULT[runStats.retaliateLevel - 1];
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      if (Math.hypot(o.mesh.position.x - playerPos.x, o.mesh.position.y - playerPos.y) < radius + o.radius) {
        destroyOrb(o, i);
      }
    }
    spawnBurst(playerPos.x, playerPos.y, "#ff5566", radius * 2);
    if (runStats.retaliateLevel >= MAX_EFFECT_LEVEL) {
      // Lv.5 capstone: a brief moment of safety right after retaliating
      invulnerableUntil = Math.max(invulnerableUntil, performance.now() + 300);
      playerEl.classList.add("invulnerable");
      setTimeout(() => playerEl.classList.remove("invulnerable"), 300);
    }
  }
  if (hp <= 0) {
    if (trainingMode) {
      // Training Room: can't permanently die, so every on-hit effect (Trả
      // Đòn, Hồi Sinh) can still be exercised for real through normal play
      hp = runStats.maxHp;
      renderHealthPips(hp, runStats.maxHp);
    } else {
      endGame();
    }
  }
}

// --- orbs / power-ups ---------------------------------------------------------
let orbs: Orb[] = [];
let powerUps: PowerUp[] = [];

function destroyOrb(o: Orb, i: number) {
  spawnBurst(o.mesh.position.x, o.mesh.position.y, o.type.cssColor, o.radius * 2.6);
  o.mesh.dispose();
  orbs.splice(i, 1);
  sfxKill();
}

function clearEntities() {
  for (const o of orbs) o.mesh.dispose();
  for (const p of powerUps) p.mesh.dispose();
  orbs = [];
  powerUps = [];
}

// --- dash ----------------------------------------------------------------------
let lastDashAt = -Infinity;

function tryDash() {
  if (state !== "playing") return;
  const now = performance.now();
  if (now - lastDashAt < runStats.dashCooldownMs) return;
  lastDashAt = now;
  sfxDash();

  const startX = playerPos.x;
  const startY = playerPos.y;
  const clamped = clampToBounds(
    playerPos.x + facing.x * runStats.dashDistance,
    playerPos.y + facing.y * runStats.dashDistance,
    selectedCharacter.radius
  );
  playerPos.x = clamped.x;
  playerPos.y = clamped.y;
  renderPlayerEl(selectedCharacter.radius, playerPos, facing);

  let killedCount = 0;

  // dash effect is a real gameplay mechanic, not just visual — see entities.ts DashEffect
  // dashPowerMultiplier (from picked-up upgrades) scales whichever of these applies
  if (selectedCharacter.dashEffect === "pierce") {
    // destroys any orb swept by the dash's travel path
    const hitRadius = (selectedCharacter.radius + DARK_ORB.radius) * runStats.dashPowerMultiplier;
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      if (distToSegment(o.mesh.position.x, o.mesh.position.y, startX, startY, playerPos.x, playerPos.y) < hitRadius) {
        destroyOrb(o, i);
        killedCount++;
      }
    }
  } else if (selectedCharacter.dashEffect === "shockwave") {
    // destroys everything in a radius around the landing point
    const radius = selectedCharacter.radius * (selectedCharacter.dashRadiusMultiplier ?? 3.5) * runStats.dashPowerMultiplier;
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      if (Math.hypot(o.mesh.position.x - playerPos.x, o.mesh.position.y - playerPos.y) < radius + o.radius) {
        destroyOrb(o, i);
        killedCount++;
      }
    }
    spawnBurst(playerPos.x, playerPos.y, selectedCharacter.color, radius * 2);
  } else {
    // phase: pure evasion — brief invulnerability, no orb destruction
    const phaseDurationMs = 350 * runStats.dashPowerMultiplier;
    invulnerableUntil = Math.max(invulnerableUntil, now + phaseDurationMs);
    playerEl.classList.add("invulnerable");
    setTimeout(() => playerEl.classList.remove("invulnerable"), phaseDurationMs);
    // Phase never destroys anything, but Dash Nối Tiếp needs a trigger that
    // works for every character — a close call (dashing within near-miss
    // range of an orb) counts the same as a kill would for pierce/shockwave.
    const nearMissRadius = (selectedCharacter.radius + DARK_ORB.radius) * 2;
    for (const o of orbs) {
      if (distToSegment(o.mesh.position.x, o.mesh.position.y, startX, startY, playerPos.x, playerPos.y) < nearMissRadius) {
        killedCount++;
        break;
      }
    }
  }

  // effect upgrades layer on top of whatever the character's core dashEffect does
  if (runStats.dashShockburstLevel > 0) {
    const bonusRadius = selectedCharacter.radius * SHOCKBURST_MULT[runStats.dashShockburstLevel - 1];
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      if (Math.hypot(o.mesh.position.x - playerPos.x, o.mesh.position.y - playerPos.y) < bonusRadius + o.radius) {
        destroyOrb(o, i);
        killedCount++;
      }
    }
    spawnBurst(playerPos.x, playerPos.y, "#ffffff", bonusRadius * 2);
  }

  if (runStats.dashMagnetLevel > 0) {
    const pullRadius = MAGNET_RADIUS[runStats.dashMagnetLevel - 1];
    const pullStrength = MAGNET_PULL[runStats.dashMagnetLevel - 1];
    const instaRadius = runStats.dashMagnetLevel >= MAX_EFFECT_LEVEL ? pullRadius / 2 : 0;
    for (const p of powerUps) {
      const d = Math.hypot(p.mesh.position.x - playerPos.x, p.mesh.position.y - playerPos.y);
      if (d < instaRadius) {
        // Lv.5 capstone: power-ups already close in get collected outright
        p.mesh.position.x = playerPos.x;
        p.mesh.position.y = playerPos.y;
      } else if (d < pullRadius) {
        p.mesh.position.x += (playerPos.x - p.mesh.position.x) * pullStrength;
        p.mesh.position.y += (playerPos.y - p.mesh.position.y) * pullStrength;
      }
    }
  }

  if (runStats.dashChainLevel > 0 && killedCount > 0) {
    lastDashAt -= runStats.dashCooldownMs * CHAIN_REFUND[runStats.dashChainLevel - 1];
    if (runStats.dashChainLevel >= MAX_EFFECT_LEVEL && Math.random() < 0.25) {
      // Lv.5 capstone: a chance at a full instant reset on top of the refund
      lastDashAt = -Infinity;
    }
  }

  const steps = 4;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    spawnDashGhost(startX + (playerPos.x - startX) * t, startY + (playerPos.y - startY) * t, selectedCharacter);
  }
  playerEl.classList.add("dashing");
  setTimeout(() => playerEl.classList.remove("dashing"), 150);
}

// --- input -------------------------------------------------------------------
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault(); // Space also natively scrolls/re-clicks a focused button — suppress that
    if (state === "playing") tryDash();
    else startGame();
  }
});
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
let trainingMode = false;

function randRange(min: number, max: number) {
  return min + Math.random() * (max - min);
}

// --- upgrades -----------------------------------------------------------------
// Picking the same upgrade again stacks it — tracked here purely for the
// "next level" display and to know how far each effect upgrade has stacked.
const acquiredUpgrades = new Map<UpgradeDef["id"], number>();

function renderUpgradeLog() {
  upgradeLogEl.innerHTML = "";
  for (const [id, level] of acquiredUpgrades) {
    const def = UPGRADES.find((u) => u.id === id)!;
    const badge = document.createElement("span");
    badge.className = "hud-badge";
    badge.textContent = `${def.name} Lv.${level}`;
    upgradeLogEl.appendChild(badge);
  }
}

function applyUpgradeAndRefresh(id: UpgradeDef["id"]) {
  hp = applyUpgrade(runStats, id, hp);
  acquiredUpgrades.set(id, (acquiredUpgrades.get(id) ?? 0) + 1);
  renderHealthPips(hp, runStats.maxHp);
  renderUpgradeLog();
}

function offerUpgrades() {
  paused = true;
  const choices = pickRandomUpgrades(acquiredUpgrades, 3);

  upgradeCardsEl.innerHTML = "";
  for (const upg of choices) {
    const ownedLevel = acquiredUpgrades.get(upg.id) ?? 0;
    const title = ownedLevel > 0 ? `${upg.name} (Lv.${ownedLevel + 1})` : upg.name;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "upgrade-btn";
    btn.innerHTML = `<span class="upgrade-name">${title}</span><span class="upgrade-desc">${upg.description}</span>`;
    btn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      applyUpgradeAndRefresh(upg.id);
      upgradePickEl.classList.add("hidden");
      paused = false;
    });
    upgradeCardsEl.appendChild(btn);
  }
  upgradePickEl.classList.remove("hidden");
}

// --- training room (practice mode: can't permanently die, manual level dials) --
initTrainingRows(
  (id) => getEffectLevel(runStats, id),
  (id, level) => {
    setEffectLevel(runStats, id, level);
    const clamped = getEffectLevel(runStats, id);
    if (clamped > 0) acquiredUpgrades.set(id, clamped);
    else acquiredUpgrades.delete(id);
    renderUpgradeLog();
  }
);

function startTraining() {
  trainingMode = true;
  startGame();
  trainingPanelEl.classList.remove("hidden");
  trainingBadgeEl.classList.remove("hidden");
  resetTrainingRowDisplays();
}

function exitTraining() {
  trainingMode = false;
  state = "start";
  clearEntities();
  trainingPanelEl.classList.add("hidden");
  trainingBadgeEl.classList.add("hidden");
  menuTitleEl.textContent = "SHADOW DASH";
  menuHintEl.classList.remove("hidden");
  finalScoreEl.classList.add("hidden");
  startHintEl.textContent = "Nhấn Space hoặc bấm chuột để bắt đầu";
  menuEl.classList.remove("hidden");
}

trainingBtn.addEventListener("pointerdown", (e) => {
  e.stopPropagation();
  startTraining();
});
trainingExitBtn.addEventListener("pointerdown", (e) => {
  e.stopPropagation();
  exitTraining();
});
trainingSpawnOrbBtn.addEventListener("pointerdown", (e) => {
  e.stopPropagation();
  const { halfW, halfH } = getHalfDimensions();
  orbs.push(spawnOrb(scene, DARK_ORB.speedStart, halfW, halfH, playerPos));
});
trainingSpawnPowerBtn.addEventListener("pointerdown", (e) => {
  e.stopPropagation();
  const { halfW, halfH } = getHalfDimensions();
  powerUps.push(spawnPowerUp(scene, halfW, halfH));
});

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
  runStats = freshRunStats(selectedCharacter);
  acquiredUpgrades.clear();
  renderUpgradeLog();
  hp = runStats.maxHp;
  invulnerableUntil = 0;
  playerEl.classList.remove("invulnerable");
  renderHealthPips(hp, runStats.maxHp);
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
    renderBestScore(bestScore);
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
    renderPlayerEl(selectedCharacter.radius, playerPos, facing);
    return;
  }

  elapsed += dt;
  scoreEl.textContent = elapsed.toFixed(1);

  // wave-clear checkpoint — a felt milestone (banner/sound + a roguelite-style
  // upgrade pick), Shadow Dash has no win state, this doesn't gate progress.
  // Skipped in the Training Room — levels are set manually there instead.
  const wave = Math.floor(elapsed / WAVE.intervalSeconds) + 1;
  if (wave > currentWave && !trainingMode) {
    currentWave = wave;
    showWaveBanner(currentWave);
    sfxWave();
    offerUpgrades();
  }

  // keyboard movement — arrow keys or WASD only
  const dir = getMoveDirection();
  if (dir.x !== 0 || dir.y !== 0) {
    const len = Math.hypot(dir.x, dir.y);
    facing = { x: dir.x / len, y: dir.y / len };
    const clamped = clampToBounds(
      playerPos.x + facing.x * runStats.speed * dt,
      playerPos.y + facing.y * runStats.speed * dt,
      selectedCharacter.radius
    );
    playerPos.x = clamped.x;
    playerPos.y = clamped.y;
  }
  renderPlayerEl(selectedCharacter.radius, playerPos, facing);

  // dash cooldown badge, with time remaining
  const cooldownLeftMs = runStats.dashCooldownMs - (performance.now() - lastDashAt);
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

  const { halfW, halfH } = getHalfDimensions();

  orbSpawnTimer += dt * 1000;
  while (orbSpawnTimer >= orbInterval) {
    orbSpawnTimer -= orbInterval;
    orbs.push(spawnOrb(scene, orbSpeed, halfW, halfH, playerPos));
  }

  powerUpTimer += dt * 1000;
  if (powerUpTimer >= powerUpNextIn) {
    powerUpTimer = 0;
    powerUpNextIn = randRange(POWER_UP.spawnIntervalMinMs, POWER_UP.spawnIntervalMaxMs);
    powerUps.push(spawnPowerUp(scene, halfW, halfH));
  }

  // shield timeout
  if (shieldActive && performance.now() >= shieldUntil) {
    shieldActive = false;
    shieldRingEl.classList.add("hidden");
    shieldBadgeEl.classList.add("hidden");
  }
  if (shieldActive) updateShieldRingPosition(selectedCharacter.radius, playerPos);

  // update orbs (per-type movement mechanic), cull off-screen, check collision
  const cullDist = Math.max(halfW, halfH) * 1.8;
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    updateOrbMovement(o, dt, playerPos);

    if (shouldSplitNow(o)) {
      o.hasSplit = true;
      const shards = spawnSplitShards(scene, o, spawnBurst);
      orbs.push(...shards);
      o.mesh.dispose();
      orbs.splice(i, 1);
      continue;
    }

    // Vòng Hào Quang (aura): passive kill radius, always on, no Dash needed
    if (runStats.auraLevel > 0) {
      const auraRadius = selectedCharacter.radius * AURA_MULT[runStats.auraLevel - 1];
      if (Math.hypot(o.mesh.position.x - playerPos.x, o.mesh.position.y - playerPos.y) < auraRadius + o.radius) {
        destroyOrb(o, i);
        continue;
      }
    }

    const distFromCenter = Math.hypot(o.mesh.position.x, o.mesh.position.y);
    if (distFromCenter > cullDist) {
      o.mesh.dispose();
      orbs.splice(i, 1);
      continue;
    }

    const dPlayer = Math.hypot(o.mesh.position.x - playerPos.x, o.mesh.position.y - playerPos.y);
    if (dPlayer < o.radius + selectedCharacter.radius) {
      const wasInvulnerable = performance.now() < invulnerableUntil;
      const px = o.mesh.position.x;
      const py = o.mesh.position.y;
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
      updateShieldRingPosition(selectedCharacter.radius, playerPos); // set position now — don't wait a frame and flash at the stale spot
      sfxShield();
    } else {
      pulsePowerUp(p, i);
    }
  }
});

engine.runRenderLoop(() => scene.render());

window.addEventListener("resize", () => {
  setHalfDimensions(window.innerWidth / 2, window.innerHeight / 2);
  applyCameraBounds();
  engine.resize();
});
