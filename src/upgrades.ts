import { WAVE, UPGRADES } from "./entities";
import type { UpgradeDef, CharacterDef } from "./entities";

// Level tables for the 6 effect upgrades — index 0 = level 1. These are the
// single source of truth; entities.ts's levelDetails text is written to match
// these exactly, so keep both in sync when tuning. Every effect upgrade caps
// at 5 levels (see MAX_EFFECT_LEVEL / pickRandomUpgrades()'s pool filter).
export const MAX_EFFECT_LEVEL = 5;
export const CHAIN_REFUND = [0.15, 0.28, 0.4, 0.52, 0.65];
export const MAGNET_RADIUS = [220, 300, 380, 460, 560];
export const MAGNET_PULL = [0.5, 0.55, 0.6, 0.65, 0.75];
export const SHOCKBURST_MULT = [2.2, 3.0, 3.8, 4.8, 6.5];
export const RETALIATE_MULT = [1.8, 2.6, 3.4, 4.2, 5.2];
export const AURA_MULT = [1.6, 2.1, 2.6, 3.2, 4.5];

// Per-run, upgradeable copy of the character's numbers. Upgrades scale this,
// never the shared CHARACTERS entries — nothing carries over between runs or
// leaks into other characters.
export interface RunStats {
  maxHp: number;
  speed: number;
  dashCooldownMs: number;
  dashDistance: number;
  dashPowerMultiplier: number; // scales pierce/shockwave radius or phase duration
  dashChainLevel: number; // 0 = not picked yet
  dashMagnetLevel: number;
  dashShockburstLevel: number;
  retaliateLevel: number;
  auraLevel: number;
  secondWindCharges: number;
}

export function freshRunStats(character: CharacterDef): RunStats {
  return {
    maxHp: character.maxHp,
    speed: character.speed,
    dashCooldownMs: character.dashCooldownMs,
    dashDistance: character.dashDistance,
    dashPowerMultiplier: 1,
    dashChainLevel: 0,
    dashMagnetLevel: 0,
    dashShockburstLevel: 0,
    retaliateLevel: 0,
    auraLevel: 0,
    secondWindCharges: 0,
  };
}

// Mutates runStats in place; returns the hp value the caller should use afterward.
export function applyUpgrade(runStats: RunStats, id: UpgradeDef["id"], hp: number): number {
  switch (id) {
    case "heal":
      return Math.min(hp + WAVE.healReward, runStats.maxHp);
    case "max_hp":
      runStats.maxHp += 1;
      return hp + 1;
    case "dash_cooldown":
      runStats.dashCooldownMs = Math.round(runStats.dashCooldownMs * 0.82);
      return hp;
    case "dash_distance":
      runStats.dashDistance = Math.round(runStats.dashDistance * 1.2);
      return hp;
    case "dash_power":
      runStats.dashPowerMultiplier *= 1.25;
      return hp;
    case "move_speed":
      runStats.speed = Math.round(runStats.speed * 1.1);
      return hp;
    case "dash_chain":
      runStats.dashChainLevel = Math.min(runStats.dashChainLevel + 1, MAX_EFFECT_LEVEL);
      return hp;
    case "dash_magnet":
      runStats.dashMagnetLevel = Math.min(runStats.dashMagnetLevel + 1, MAX_EFFECT_LEVEL);
      return hp;
    case "dash_shockburst":
      runStats.dashShockburstLevel = Math.min(runStats.dashShockburstLevel + 1, MAX_EFFECT_LEVEL);
      return hp;
    case "retaliate":
      runStats.retaliateLevel = Math.min(runStats.retaliateLevel + 1, MAX_EFFECT_LEVEL);
      return hp;
    case "aura":
      runStats.auraLevel = Math.min(runStats.auraLevel + 1, MAX_EFFECT_LEVEL);
      return hp;
    case "second_wind":
      runStats.secondWindCharges = Math.min(runStats.secondWindCharges + 1, MAX_EFFECT_LEVEL);
      return hp;
    default:
      return hp;
  }
}

export function getEffectLevel(runStats: RunStats, id: UpgradeDef["id"]): number {
  switch (id) {
    case "dash_chain":
      return runStats.dashChainLevel;
    case "dash_magnet":
      return runStats.dashMagnetLevel;
    case "dash_shockburst":
      return runStats.dashShockburstLevel;
    case "retaliate":
      return runStats.retaliateLevel;
    case "aura":
      return runStats.auraLevel;
    case "second_wind":
      return runStats.secondWindCharges;
    default:
      return 0;
  }
}

// Training Room only: directly dials an effect level, bypassing the normal
// pick-an-upgrade flow.
export function setEffectLevel(runStats: RunStats, id: UpgradeDef["id"], level: number) {
  const clamped = Math.max(0, Math.min(MAX_EFFECT_LEVEL, level));
  switch (id) {
    case "dash_chain":
      runStats.dashChainLevel = clamped;
      break;
    case "dash_magnet":
      runStats.dashMagnetLevel = clamped;
      break;
    case "dash_shockburst":
      runStats.dashShockburstLevel = clamped;
      break;
    case "retaliate":
      runStats.retaliateLevel = clamped;
      break;
    case "aura":
      runStats.auraLevel = clamped;
      break;
    case "second_wind":
      runStats.secondWindCharges = clamped;
      break;
  }
}

export function pickRandomUpgrades(acquiredUpgrades: Map<UpgradeDef["id"], number>, count: number): UpgradeDef[] {
  const pool = UPGRADES.filter((u) => !u.maxLevel || (acquiredUpgrades.get(u.id) ?? 0) < u.maxLevel);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}
