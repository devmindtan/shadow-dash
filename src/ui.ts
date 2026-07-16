import { CHARACTERS, SHIELD_RING, ORB_TYPES, UPGRADES } from "./entities";
import type { CharacterDef, UpgradeDef } from "./entities";

// --- DOM references ----------------------------------------------------------
export const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
export const playerEl = document.getElementById("player")!;
export const shieldRingEl = document.getElementById("shieldRing")!;
export const scoreEl = document.getElementById("score")!;
export const bestScoreEl = document.getElementById("bestScore")!;
export const healthEl = document.getElementById("health")!;
export const shieldBadgeEl = document.getElementById("shield")!;
export const dashBadgeEl = document.getElementById("dash")!;
export const menuEl = document.getElementById("menu")!;
export const menuTitleEl = document.getElementById("menuTitle")!;
export const menuHintEl = document.getElementById("menuHint")!;
export const startHintEl = document.getElementById("startHint")!;
export const finalScoreEl = document.getElementById("finalScore")!;
export const waveBannerEl = document.getElementById("waveBanner")!;
export const characterSelectEl = document.getElementById("characterSelect")!;
export const characterPortraitEl = document.getElementById("characterPortrait")!;
export const characterInfoEl = document.getElementById("characterInfo")!;
export const upgradePickEl = document.getElementById("upgradePick")!;
export const upgradeCardsEl = document.getElementById("upgradeCards")!;
export const upgradeLogEl = document.getElementById("upgradeLog")!;
export const libraryBtn = document.getElementById("libraryBtn")!;
export const libraryEl = document.getElementById("library")!;
export const libraryCloseBtn = document.getElementById("libraryCloseBtn")!;
export const orbLibraryEl = document.getElementById("orbLibrary")!;
export const upgradeLibraryEl = document.getElementById("upgradeLibrary")!;
export const trainingBtn = document.getElementById("trainingBtn")!;
export const trainingBadgeEl = document.getElementById("trainingBadge")!;
export const trainingPanelEl = document.getElementById("trainingPanel")!;
export const trainingRowsEl = document.getElementById("trainingRows")!;
export const trainingExitBtn = document.getElementById("trainingExitBtn")!;
export const trainingSpawnOrbBtn = document.getElementById("trainingSpawnOrb")!;
export const trainingSpawnPowerBtn = document.getElementById("trainingSpawnPower")!;

// --- viewport (world <-> screen conversion) ----------------------------------
let halfW = window.innerWidth / 2;
let halfH = window.innerHeight / 2;

export function getHalfDimensions() {
  return { halfW, halfH };
}
export function setHalfDimensions(w: number, h: number) {
  halfW = w;
  halfH = h;
}
export function worldToScreen(x: number, y: number) {
  return { sx: halfW + x, sy: halfH - y };
}
export function clampToBounds(x: number, y: number, margin: number) {
  return {
    x: Math.max(-halfW + margin, Math.min(halfW - margin, x)),
    y: Math.max(-halfH + margin, Math.min(halfH - margin, y)),
  };
}

// --- player / shield ring rendering (CSS elements, not Babylon meshes) -------
export function renderPlayerEl(
  radius: number,
  playerPos: { x: number; y: number },
  facing: { x: number; y: number },
  isMoving: boolean
) {
  const { sx, sy } = worldToScreen(playerPos.x, playerPos.y);
  playerEl.style.setProperty("translate", `${sx - radius}px ${sy - radius}px`);
  const angleDeg = (Math.atan2(-facing.y, facing.x) * 180) / Math.PI;
  playerEl.style.setProperty("rotate", `${angleDeg}deg`);
  playerEl.classList.toggle("moving", isMoving);
}

export function updateShieldRingPosition(characterRadius: number, playerPos: { x: number; y: number }) {
  const r = characterRadius * SHIELD_RING.radiusMultiplier;
  const { sx, sy } = worldToScreen(playerPos.x, playerPos.y);
  shieldRingEl.style.setProperty("translate", `${sx - r}px ${sy - r}px`);
}

export function applyCharacterVisual(char: CharacterDef) {
  playerEl.dataset.character = char.id;
  playerEl.style.setProperty("--char-color", char.color);
  playerEl.style.width = `${char.radius * 2}px`;
  playerEl.style.height = `${char.radius * 2}px`;
  playerEl.style.clipPath = char.clipPath;
  const ringSize = char.radius * 2 * SHIELD_RING.radiusMultiplier;
  shieldRingEl.style.width = `${ringSize}px`;
  shieldRingEl.style.height = `${ringSize}px`;
  characterInfoEl.textContent = char.description;
  characterPortraitEl.style.setProperty("--char-sprite", `url(${char.spriteUrl})`);
  characterPortraitEl.style.setProperty("--char-color", char.color);
}

// --- HUD -----------------------------------------------------------------------
export function renderHealthPips(hp: number, maxHp: number) {
  healthEl.innerHTML = "";
  for (let i = 0; i < maxHp; i++) {
    const pip = document.createElement("span");
    pip.className = "hp-pip" + (i >= hp ? " lost" : "");
    healthEl.appendChild(pip);
  }
}

export function renderBestScore(best: number) {
  bestScoreEl.textContent = `BEST ${best.toFixed(1)}`;
}

export function showWaveBanner(waveNum: number) {
  waveBannerEl.textContent = `WAVE ${waveNum}`;
  waveBannerEl.classList.remove("show");
  void waveBannerEl.offsetWidth; // reflow so the animation restarts every time
  waveBannerEl.classList.remove("hidden");
  waveBannerEl.classList.add("show");
  setTimeout(() => waveBannerEl.classList.add("hidden"), 1600);
}

// --- visual effects (plain DOM, matches the player being CSS-only) -----------
export function spawnBurst(x: number, y: number, cssColor: string, sizePx: number) {
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

export function spawnDashGhost(x: number, y: number, char: CharacterDef) {
  const ghost = document.createElement("div");
  ghost.className = "dash-ghost";
  const r = char.radius;
  ghost.style.width = `${r * 2}px`;
  ghost.style.height = `${r * 2}px`;
  ghost.style.background = char.color;
  ghost.style.clipPath = char.clipPath;
  const { sx, sy } = worldToScreen(x, y);
  ghost.style.setProperty("translate", `${sx - r}px ${sy - r}px`);
  ghost.style.setProperty("rotate", playerEl.style.getPropertyValue("rotate"));
  document.body.appendChild(ghost);
  setTimeout(() => ghost.remove(), 260);
}

// --- character select ---------------------------------------------------------
export function initCharacterSelect(onSelect: (char: CharacterDef) => void): CharacterDef {
  const buttons: HTMLButtonElement[] = [];
  for (const char of CHARACTERS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "character-btn";
    btn.style.setProperty("--btn-color", char.color);
    btn.style.setProperty("--btn-sprite", `url(${char.spriteUrl})`);
    btn.innerHTML = `<span class="swatch"></span><span>${char.name}</span>`;
    btn.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      applyCharacterVisual(char);
      for (const b of buttons) b.classList.remove("selected");
      btn.classList.add("selected");
      onSelect(char);
    });
    characterSelectEl.appendChild(btn);
    buttons.push(btn);
  }
  buttons[0]?.classList.add("selected");
  applyCharacterVisual(CHARACTERS[0]);
  return CHARACTERS[0];
}

// --- library (bestiary + upgrade reference, styled like an open album) ------
function libraryCard(index: number, color: string, name: string, description: string, tag?: string, levelDetails?: string[]) {
  const card = document.createElement("div");
  card.className = "library-card";
  card.style.setProperty("--item-color", color);
  card.innerHTML = `
    <span class="library-index">${String(index).padStart(2, "0")}</span>
    ${tag ? `<span class="library-tag">${tag}</span>` : ""}
    <span class="swatch"></span>
    <span class="library-name">${name}</span>
    <span class="library-desc">${description}</span>`;
  if (levelDetails) {
    card.classList.add("expandable");
    const hint = document.createElement("span");
    hint.className = "library-expand-hint";
    hint.textContent = "Bấm để xem 5 cấp độ ▾";
    card.appendChild(hint);
    const levels = document.createElement("ul");
    levels.className = "library-levels hidden";
    levels.innerHTML = levelDetails.map((line) => `<li>${line}</li>`).join("");
    card.appendChild(levels);
    card.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      const expanded = card.classList.toggle("expanded");
      levels.classList.toggle("hidden", !expanded);
      hint.textContent = expanded ? "Bấm để thu gọn ▴" : "Bấm để xem 5 cấp độ ▾";
    });
  }
  return card;
}

export function initLibrary() {
  ORB_TYPES.forEach((orbType, i) => {
    orbLibraryEl.appendChild(libraryCard(i + 1, orbType.cssColor, orbType.name, orbType.description));
  });
  UPGRADES.forEach((upg, i) => {
    upgradeLibraryEl.appendChild(
      libraryCard(
        i + 1,
        upg.category === "effect" ? "#6cf0ff" : "#9fb8c8",
        upg.name,
        upg.description,
        upg.category === "effect" ? "Hiệu ứng" : "Chỉ số",
        upg.levelDetails
      )
    );
  });

  const libraryTabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".library-tab"));
  const libraryGrids: Record<string, HTMLElement> = { orbLibrary: orbLibraryEl, upgradeLibrary: upgradeLibraryEl };
  for (const tab of libraryTabs) {
    tab.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      for (const t of libraryTabs) t.classList.remove("selected");
      tab.classList.add("selected");
      for (const [key, grid] of Object.entries(libraryGrids)) {
        grid.classList.toggle("hidden", key !== tab.dataset.tab);
      }
    });
  }

  libraryBtn.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    libraryEl.classList.remove("hidden");
  });
  libraryCloseBtn.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    libraryEl.classList.add("hidden");
  });
}

// --- training room panel ------------------------------------------------------
export function initTrainingRows(getLevel: (id: UpgradeDef["id"]) => number, setLevel: (id: UpgradeDef["id"], level: number) => void) {
  for (const upg of UPGRADES) {
    if (upg.category !== "effect") continue;
    const row = document.createElement("div");
    row.className = "training-row";
    row.innerHTML = `
      <span class="training-name">${upg.name}</span>
      <span class="training-stepper">
        <button type="button" class="training-minus">−</button>
        <span class="training-level">0</span>
        <button type="button" class="training-plus">+</button>
      </span>`;
    const levelEl = row.querySelector(".training-level")!;
    const refresh = () => {
      levelEl.textContent = String(getLevel(upg.id));
    };
    row.querySelector(".training-minus")!.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      setLevel(upg.id, getLevel(upg.id) - 1);
      refresh();
    });
    row.querySelector(".training-plus")!.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      setLevel(upg.id, getLevel(upg.id) + 1);
      refresh();
    });
    trainingRowsEl.appendChild(row);
  }
}

export function resetTrainingRowDisplays() {
  for (const row of Array.from(trainingRowsEl.children)) {
    row.querySelector(".training-level")!.textContent = "0";
  }
}
