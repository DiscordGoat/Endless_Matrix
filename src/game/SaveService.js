import { GEM_ORDER, STARTER_GEMS } from "./GemDefinitions.js";

const STORAGE_KEY = "endlessMatrixSaveV1";
const FOUR_EACH_GEM_GRANT = GEM_ORDER.flatMap((gemId) => Array.from({ length: 4 }, () => gemId));

const DEFAULT_SAVE = {
  tier: "I",
  coins: 100,
  gems: STARTER_GEMS.length,
  crates: 30,
  highestUnlockedLevel: 1,
  starterCoinsGranted: true,
  starterGemsGranted: true,
  starterCratesGranted: true,
  fourEachGemGrant20260629: false,
  gemInventory: STARTER_GEMS,
  crateInventory: {
    bronze: 10,
    silver: 10,
    gold: 10
  },
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
    return Boolean(this.#save.towerUnlocks[towerId]?.includes(rarity));
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
    normalized.gemInventory = [...STARTER_GEMS, ...(save.gemInventory || [])];
    normalized.starterGemsGranted = true;
    changed = true;
  }

  if (!save.starterCratesGranted) {
    normalized.crateInventory = {
      bronze: (normalized.crateInventory?.bronze || 0) + 10,
      silver: (normalized.crateInventory?.silver || 0) + 10,
      gold: (normalized.crateInventory?.gold || 0) + 10
    };
    normalized.starterCratesGranted = true;
    changed = true;
  }

  if (!save.fourEachGemGrant20260629) {
    normalized.gemInventory = [...normalized.gemInventory, ...FOUR_EACH_GEM_GRANT];
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
