import { RARITIES } from "./TowerDefinitions.js";
import { createDefaultPerks, PERK_DEFINITIONS } from "./PerkDefinitions.js";

const STORAGE_KEY = "endlessMatrixSaveV1";

const DEFAULT_SAVE = {
  tier: "I",
  coins: 100,
  gems: 0,
  crates: 0,
  highestUnlockedLevel: 1,
  starterCoinsGranted: true,
  starterGemsGranted: true,
  starterCratesGranted: true,
  fourEachGemGrant20260629: true,
  gemInventory: [],
  crateInventory: {
    bronze: 0,
    silver: 0,
    gold: 0
  },
  perks: createDefaultPerks(),
  towerUnlocks: {
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

  canAffordCoins(amount) {
    return this.#save.coins >= amount;
  }

  spendCoins(amount) {
    if (!this.canAffordCoins(amount)) return false;
    this.#save.coins -= amount;
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

  #load() {
    try {
      const found = localStorage.getItem(STORAGE_KEY);
      if (!found) return normalizeSave(DEFAULT_SAVE);
      return normalizeSave(JSON.parse(found));
    } catch {
      return normalizeSave(DEFAULT_SAVE);
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
  let changed = false;
  const normalized = {
    ...DEFAULT_SAVE,
    ...save,
    towerUnlocks: {
      ...DEFAULT_SAVE.towerUnlocks,
      ...(save.towerUnlocks || {})
    },
    perks: {
      ...DEFAULT_SAVE.perks,
      ...(save.perks || {})
    },
    gemInventory: [...(save.gemInventory || DEFAULT_SAVE.gemInventory)],
    crateInventory: {
      ...DEFAULT_SAVE.crateInventory,
      ...(save.crateInventory || {})
    }
  };

  if (!save.starterCoinsGranted) {
    normalized.coins = (Number(save.coins) || 0) + 100;
    normalized.starterCoinsGranted = true;
    changed = true;
  }

  if (!save.starterGemsGranted) {
    normalized.starterGemsGranted = true;
    changed = true;
  }

  if (!save.starterCratesGranted) {
    normalized.starterCratesGranted = true;
    changed = true;
  }

  if (!save.fourEachGemGrant20260629) {
    normalized.fourEachGemGrant20260629 = true;
    changed = true;
  }

  normalized.gems = normalized.gemInventory.length;
  normalized.crates = Object.values(normalized.crateInventory).reduce((sum, count) => sum + count, 0);

  if (changed) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }

  return normalized;
}
