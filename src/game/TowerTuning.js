import TOWER_TUNING from "./TowerTuning.json";

export { TOWER_TUNING };

export function getTowerTuning(towerType) {
  return TOWER_TUNING.towers?.[towerType] || {};
}

export function getTowerCombatTuning(towerType) {
  return getTowerTuning(towerType).combat || {};
}

export function getResearchTuning(towerOrType, researchId = null) {
  const towerType = typeof towerOrType === "string" ? towerOrType : towerOrType?.type;
  const id = researchId ?? (typeof towerOrType === "string" ? "" : towerOrType?.research);
  if (!towerType || !id) return {};
  return getTowerTuning(towerType).research?.[id] || {};
}

export function applyResearchStatTuning(stats, tower) {
  const tuning = getResearchTuning(tower);
  const nextStats = { ...stats };
  applyNumericMap(nextStats, tuning.statMultipliers, (value, modifier) => value * modifier);
  applyNumericMap(nextStats, tuning.statAdd, (value, modifier) => value + modifier);
  applyNumericMap(nextStats, tuning.statOverrides, (_value, modifier) => modifier);
  return nextStats;
}

export function getResearchEffectNumber(towerOrType, researchOrKey, keyOrFallback, fallback = 0) {
  let towerType = typeof towerOrType === "string" ? towerOrType : towerOrType?.type;
  let researchId = typeof towerOrType === "string" ? researchOrKey : towerOrType?.research;
  let key = typeof towerOrType === "string" ? keyOrFallback : researchOrKey;
  let defaultValue = typeof towerOrType === "string" ? fallback : keyOrFallback;
  const value = getResearchTuning(towerType, researchId).effects?.[key];
  return Number.isFinite(Number(value)) ? Number(value) : defaultValue;
}

export function getCombatNumber(towerType, key, fallback = 0) {
  const value = getTowerCombatTuning(towerType)?.[key];
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

export function getCombatRarityNumber(towerType, key, rarity, fallback = 0) {
  const values = getTowerCombatTuning(towerType)?.[key];
  const value = values?.[rarity];
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function applyNumericMap(stats, modifiers, apply) {
  if (!modifiers || typeof modifiers !== "object") return;

  for (const [key, modifier] of Object.entries(modifiers)) {
    const base = Number(stats[key]);
    const numericModifier = Number(modifier);
    if (!Number.isFinite(base) || !Number.isFinite(numericModifier)) continue;
    stats[key] = apply(base, numericModifier);
  }
}
