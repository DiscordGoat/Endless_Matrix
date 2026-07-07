import TOWER_TUNING from "./TowerTuning.json";

export const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];

export const RARITY_LABELS = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary"
};

export const RARITY_COLORS = {
  common: "rgba(255, 255, 255, 0.92)",
  uncommon: "rgba(144, 222, 120, 0.95)",
  rare: "rgba(96, 172, 255, 0.95)",
  epic: "rgba(177, 102, 255, 0.95)",
  legendary: "rgba(255, 182, 54, 0.95)"
};

export const TOWER_DEFINITIONS = {
  factory: {
    id: "factory",
    label: "Factory",
    asset: "factory",
    footprint: 4,
    unlockCosts: {
      common: 100,
      uncommon: 200,
      rare: 400,
      epic: 800,
      legendary: 1600
    },
    rarities: TOWER_TUNING.towers.factory.rarities
  },
  minigun: {
    id: "minigun",
    label: "Minigun",
    asset: "minigun",
    footprint: 2,
    unlockCosts: {
      common: 100,
      uncommon: 200,
      rare: 400,
      epic: 800,
      legendary: 1600
    },
    rarities: TOWER_TUNING.towers.minigun.rarities
  },
  cannon: {
    id: "cannon",
    label: "Cannon",
    asset: "cannon",
    footprint: 2,
    unlockCosts: {
      common: 100,
      uncommon: 200,
      rare: 400,
      epic: 800,
      legendary: 1600
    },
    rarities: TOWER_TUNING.towers.cannon.rarities
  },
  raygun: {
    id: "raygun",
    label: "Raygun",
    asset: "raygun",
    footprint: 2,
    unlockCosts: {
      common: 100,
      uncommon: 200,
      rare: 400,
      epic: 800,
      legendary: 1600
    },
    rarities: TOWER_TUNING.towers.raygun.rarities
  },
  radar: {
    id: "radar",
    label: "Radar",
    asset: "Radar",
    footprint: 2,
    unlockCosts: {
      common: 100,
      uncommon: 200,
      rare: 400,
      epic: 800,
      legendary: 1600
    },
    rarities: TOWER_TUNING.towers.radar.rarities
  },
  antiair: {
    id: "antiair",
    label: "Anti Air",
    asset: "antiair",
    emptyAsset: "antiair_empty",
    missileAsset: "missile",
    footprint: 2,
    canTargetFlying: true,
    flyingOnly: true,
    unlockCosts: {
      common: 100,
      uncommon: 200,
      rare: 400,
      epic: 800,
      legendary: 1600
    },
    rarities: TOWER_TUNING.towers.antiair.rarities
  }
};

export function getNextRarity(rarity) {
  const index = RARITIES.indexOf(rarity);
  return RARITIES[index + 1] || null;
}
