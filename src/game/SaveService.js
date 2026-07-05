import { RARITIES } from "./TowerDefinitions.js";
import { createDefaultPerks, PERK_DEFINITIONS } from "./PerkDefinitions.js";
import { createDefaultResearch, getResearchCost, getResearchKey, getResearchNode } from "./ResearchDefinitions.js";

const STORAGE_KEY = "endlessMatrixSaveV1";

const DEFAULT_SAVE = {
  tier: "I",
  coins: 100,
  gems: 0,
  crates: 0,
  singularities: 10,
  highestUnlockedLevel: 1,
  completedLevels: [],
  activeRun: null,
  starterCoinsGranted: true,
  starterGemsGranted: true,
  starterCratesGranted: true,
  starterSingularitiesGranted: true,
  fourEachGemGrant20260629: true,
  gemInventory: [],
  crateInventory: {
    bronze: 0,
    silver: 0,
    gold: 0
  },
  perks: createDefaultPerks(),
  research: createDefaultResearch(),
  towerUnlocks: {
    factory: [],
    minigun: [],
    cannon: [],
    raygun: []
  }
};

export class SaveService {
  #save;

  constructor() {
    this.#save = this.#load();
  }

  getSnapshot() {
    return structuredClone(this.#save);
  }

  getActiveRun() {
    return this.#save.activeRun ? structuredClone(this.#save.activeRun) : null;
  }

  saveActiveRun(run) {
    this.#save.activeRun = run ? structuredClone(run) : null;
    this.#persist();
  }

  clearActiveRun() {
    if (!this.#save.activeRun) return;
    this.#save.activeRun = null;
    this.#persist();
  }

  canAffordCoins(amount) {
    return this.#save.coins >= amount;
  }

  canAffordSingularities(amount) {
    return this.#save.singularities >= amount;
  }

  spendCoins(amount) {
    if (!this.canAffordCoins(amount)) return false;
    this.#save.coins -= amount;
    this.#persist();
    return true;
  }

  spendSingularities(amount) {
    if (!this.canAffordSingularities(amount)) return false;
    this.#save.singularities -= amount;
    this.#persist();
    return true;
  }

  unlockTower(towerId, rarity) {
    const unlocks = this.#save.towerUnlocks[towerId] || [];
    if (!unlocks.includes(rarity)) {
      unlocks.push(rarity);
    }

    this.#save.towerUnlocks[towerId] = unlocks;
    this.#persist();
  }

  isTowerUnlocked(towerId, rarity) {
    const requestedIndex = RARITIES.indexOf(rarity);
    if (requestedIndex < 0) return false;

    return Boolean(this.#save.towerUnlocks[towerId]?.some((ownedRarity) => {
      const ownedIndex = RARITIES.indexOf(ownedRarity);
      return ownedIndex >= requestedIndex;
    }));
  }

  addCoins(amount) {
    this.#save.coins += amount;
    this.#persist();
  }

  addSingularities(amount) {
    this.#save.singularities += Math.max(0, Math.round(Number(amount) || 0));
    this.#persist();
  }

  addGems(gemIds) {
    this.#save.gemInventory.push(...gemIds);
    this.#save.gems = this.#save.gemInventory.length;
    this.#persist();
  }

  addCrates(crateIds) {
    for (const crateId of crateIds) {
      this.#save.crateInventory[crateId] = (this.#save.crateInventory[crateId] || 0) + 1;
    }

    this.#syncCrateCount();
    this.#persist();
  }

  spendCrates(crateId, count) {
    if ((this.#save.crateInventory[crateId] || 0) < count) return false;
    this.#save.crateInventory[crateId] -= count;
    this.#syncCrateCount();
    this.#persist();
    return true;
  }

  removeGemsByIndices(indices) {
    const sorted = [...indices].sort((a, b) => b - a);
    const removed = [];

    for (const index of sorted) {
      const [gemId] = this.#save.gemInventory.splice(index, 1);
      if (gemId) removed.push(gemId);
    }

    this.#save.gems = this.#save.gemInventory.length;
    this.#persist();
    return removed;
  }

  sellGem(index, value) {
    const [gemId] = this.#save.gemInventory.splice(index, 1);
    if (!gemId) return null;

    this.#save.coins += value;
    this.#save.gems = this.#save.gemInventory.length;
    this.#persist();
    return { gemId, index, value };
  }

  undoSellGem(sale) {
    if (!sale) return;

    this.#save.coins = Math.max(0, this.#save.coins - sale.value);
    this.#save.gemInventory.splice(sale.index, 0, sale.gemId);
    this.#save.gems = this.#save.gemInventory.length;
    this.#persist();
  }

  completeLevel(level) {
    const completedLevel = Math.max(1, Math.round(Number(level) || 1));
    if (!this.#save.completedLevels.includes(completedLevel)) {
      this.#save.completedLevels.push(completedLevel);
      this.#save.completedLevels.sort((a, b) => a - b);
    }

    this.#save.highestUnlockedLevel = Math.max(this.#save.highestUnlockedLevel || 1, completedLevel + 1);
    this.#persist();
  }

  upgradePerk(perkId) {
    const definition = PERK_DEFINITIONS[perkId];
    if (!definition || definition.locked) return false;

    const currentLevel = this.#save.perks[perkId] || 0;
    const nextLevel = currentLevel + 1;
    if (nextLevel > definition.maxLevel) return false;

    const cost = definition.costForLevel(nextLevel);
    if (!this.spendCoins(cost)) return false;

    this.#save.perks[perkId] = nextLevel;
    this.#persist();
    return true;
  }

  upgradeResearch(towerId, researchId) {
    const node = getResearchNode(towerId, researchId);
    if (!node) return false;

    const key = getResearchKey(towerId, researchId);
    const currentCapacity = this.#save.research[key] || 0;
    const cost = getResearchCost(node, currentCapacity);
    if (!this.spendSingularities(cost)) return false;

    this.#save.research[key] = currentCapacity + 1;
    this.#persist();
    return true;
  }

  #load() {
    try {
      const found = localStorage.getItem(STORAGE_KEY);
      const normalized = normalizeSave(found ? JSON.parse(found) : DEFAULT_SAVE);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      return normalized;
    } catch {
      const fallback = normalizeSave(DEFAULT_SAVE);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fallback));
      } catch {
        // Continue with an in-memory fallback when browser storage is unavailable.
      }
      return fallback;
    }
  }

  #persist() {
    this.#syncCrateCount();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.#save));
  }

  #syncCrateCount() {
    this.#save.crates = Object.values(this.#save.crateInventory || {}).reduce((sum, count) => sum + count, 0);
  }
}

function normalizeSave(save) {
  const normalized = {
    ...DEFAULT_SAVE,
    ...save,
    towerUnlocks: {
      ...DEFAULT_SAVE.towerUnlocks,
      ...(save.towerUnlocks || {})
    },
    completedLevels: Array.isArray(save.completedLevels)
      ? [...new Set(save.completedLevels.map((level) => Math.max(1, Math.round(Number(level) || 1))))].sort((a, b) => a - b)
      : [...DEFAULT_SAVE.completedLevels],
    activeRun: normalizeActiveRun(save.activeRun),
    perks: normalizePerks(save.perks),
    research: normalizeResearch(save.research),
    singularities: Math.max(0, Math.round(Number(save.singularities) || 0)),
    gemInventory: [...(save.gemInventory || DEFAULT_SAVE.gemInventory)],
    crateInventory: {
      ...DEFAULT_SAVE.crateInventory,
      ...(save.crateInventory || {})
    }
  };

  if (!save.starterCoinsGranted) {
    normalized.coins = (Number(save.coins) || 0) + 100;
    normalized.starterCoinsGranted = true;
  }

  if (!save.starterGemsGranted) {
    normalized.starterGemsGranted = true;
  }

  if (!save.starterCratesGranted) {
    normalized.starterCratesGranted = true;
  }

  if (!save.starterSingularitiesGranted) {
    normalized.singularities = (Number(save.singularities) || 0) + 10;
    normalized.starterSingularitiesGranted = true;
  }

  if (!save.fourEachGemGrant20260629) {
    normalized.fourEachGemGrant20260629 = true;
  }

  normalized.gems = normalized.gemInventory.length;
  normalized.crates = Object.values(normalized.crateInventory).reduce((sum, count) => sum + count, 0);
  normalized.highestUnlockedLevel = Math.max(
    1,
    Math.round(Number(normalized.highestUnlockedLevel) || 1),
    (normalized.completedLevels.at(-1) || 0) + 1
  );

  return normalized;
}

function normalizeActiveRun(run) {
  if (!run || typeof run !== "object") return null;

  const level = Math.max(1, Math.round(Number(run.level) || 1));
  const raiders = Array.isArray(run.raiders) ? run.raiders.map(normalizeRaider).filter(Boolean) : [];
  const towers = Array.isArray(run.towers) ? run.towers.map(normalizeTower).filter(Boolean) : [];
  const nextRaiderId = Math.max(1, Math.round(Number(run.nextRaiderId) || 1), maxEntityId(raiders) + 1);
  const nextTowerId = Math.max(1, Math.round(Number(run.nextTowerId) || 1), maxEntityId(towers) + 1);

  return {
    schemaVersion: 1,
    savedAt: Number(run.savedAt) || Date.now(),
    level,
    activeRunLevel: Math.max(1, Math.round(Number(run.activeRunLevel || level) || level)),
    playerHealth: clampNumber(Number(run.playerHealth), 0, 100, 100),
    resources: Math.max(0, Number(run.resources) || 0),
    wave: Math.max(1, Math.round(Number(run.wave) || 1)),
    waveStarted: Boolean(run.waveStarted),
    spawning: Boolean(run.spawning),
    spawnQueue: Array.isArray(run.spawnQueue) ? run.spawnQueue.map(normalizeSpawnEntry).filter(Boolean) : [],
    spawnTimer: Number(run.spawnTimer) || 0,
    raiders,
    nextRaiderId,
    towers,
    nextTowerId,
    runCoins: Math.max(0, Math.round(Number(run.runCoins) || 0)),
    runGems: Array.isArray(run.runGems) ? run.runGems.filter((id) => typeof id === "string") : [],
    runCrates: Array.isArray(run.runCrates) ? run.runCrates.filter((id) => typeof id === "string") : [],
    running: Boolean(run.running),
    time: Math.max(0, Number(run.time) || 0),
    gameSpeed: Math.max(1, Math.min(16, Number(run.gameSpeed) || 1))
  };
}

function normalizePerks(perks = {}) {
  return Object.fromEntries(
    Object.keys(DEFAULT_SAVE.perks).map((perkId) => [
      perkId,
      Math.max(0, Math.round(Number(perks[perkId]) || 0))
    ])
  );
}

function normalizeResearch(research = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_SAVE.research).map(([key, defaultCapacity]) => [
      key,
      Math.max(defaultCapacity, Math.round(Number(research[key]) || 0))
    ])
  );
}

function maxEntityId(items) {
  return items.reduce((max, item) => Math.max(max, Math.round(Number(item.id) || 0)), 0);
}

function clampNumber(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function normalizeSpawnEntry(entry) {
  if (!entry || typeof entry !== "object" || typeof entry.type !== "string" || typeof entry.rarity !== "string") return null;
  return {
    type: entry.type,
    rarity: entry.rarity,
    spawnInterval: Math.max(0.01, Number(entry.spawnInterval) || 1)
  };
}

function normalizeTower(tower) {
  if (!tower || typeof tower !== "object" || typeof tower.type !== "string") return null;
  return {
    id: Math.max(1, Math.round(Number(tower.id) || 1)),
    type: tower.type,
    x: Math.round(Number(tower.x) || 0),
    y: Math.round(Number(tower.y) || 0),
    surface: typeof tower.surface === "string" ? tower.surface : "ground",
    rarity: typeof tower.rarity === "string" ? tower.rarity : "common",
    spent: Math.max(0, Number(tower.spent) || 0),
    cooldown: Number(tower.cooldown) || 0,
    targetPriority: typeof tower.targetPriority === "string" ? tower.targetPriority : "first",
    research: typeof tower.research === "string" ? tower.research : "",
    angle: Number(tower.angle) || 0
  };
}

function normalizeRaider(raider) {
  if (!raider || typeof raider !== "object" || typeof raider.type !== "string" || typeof raider.rarity !== "string") return null;
  return {
    ...raider,
    id: Math.max(1, Math.round(Number(raider.id) || 1)),
    health: Math.max(0, Number(raider.health) || 0),
    maxHealth: Math.max(0, Number(raider.maxHealth) || 0),
    shield: Math.max(0, Number(raider.shield) || 0),
    maxShield: Math.max(0, Number(raider.maxShield) || 0),
    speed: Math.max(0, Number(raider.speed) || 0),
    resources: Math.max(0, Number(raider.resources) || 0),
    damage: Math.max(0, Number(raider.damage) || 0),
    progress: Math.max(0, Number(raider.progress) || 0),
    alive: raider.alive !== false,
    frozenUntil: Math.max(0, Number(raider.frozenUntil) || 0),
    freezeSpeedMultiplier: Number(raider.freezeSpeedMultiplier) || 1,
    flightPhase: typeof raider.flightPhase === "string" ? raider.flightPhase : undefined,
    flightTime: Math.max(0, Number(raider.flightTime) || 0)
  };
}
