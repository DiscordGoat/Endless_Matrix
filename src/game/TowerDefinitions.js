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
    rarities: {
      common: { placementCost: 50, rangeCells: 0, resourceYield: 10, attackInterval: 30.0 },
      uncommon: { placementCost: 100, rangeCells: 0, resourceYield: 20, attackInterval: 30.0 },
      rare: { placementCost: 200, rangeCells: 0, resourceYield: 30, attackInterval: 30.0 },
      epic: { placementCost: 400, rangeCells: 0, resourceYield: 40, attackInterval: 30.0 },
      legendary: { placementCost: 800, rangeCells: 0, resourceYield: 50, attackInterval: 30.0 }
    }
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
    rarities: {
      common: { placementCost: 10, rangeCells: 3, damage: 10, attackInterval: 0.1 },
      uncommon: { placementCost: 20, rangeCells: 4, damage: 15, attackInterval: 0.1 },
      rare: { placementCost: 40, rangeCells: 5, damage: 20, attackInterval: 0.1 },
      epic: { placementCost: 80, rangeCells: 6, damage: 25, attackInterval: 0.1 },
      legendary: { placementCost: 160, rangeCells: 7, damage: 30, attackInterval: 0.1 }
    }
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
    rarities: {
      common: { placementCost: 20, rangeCells: 5, damage: 100, attackInterval: 3.0 },
      uncommon: { placementCost: 40, rangeCells: 7, damage: 200, attackInterval: 2.8 },
      rare: { placementCost: 80, rangeCells: 9, damage: 400, attackInterval: 2.6 },
      epic: { placementCost: 160, rangeCells: 11, damage: 800, attackInterval: 2.4 },
      legendary: { placementCost: 320, rangeCells: 13, damage: 1600, attackInterval: 2.2 }
    }
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
    rarities: {
      common: { placementCost: 10, rangeCells: 3, damage: 10, attackInterval: 2.0 },
      uncommon: { placementCost: 20, rangeCells: 4, damage: 20, attackInterval: 1.8 },
      rare: { placementCost: 40, rangeCells: 5, damage: 30, attackInterval: 1.6 },
      epic: { placementCost: 80, rangeCells: 6, damage: 40, attackInterval: 1.4 },
      legendary: { placementCost: 160, rangeCells: 12, damage: 50, attackInterval: 1.0 }
    }
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
    rarities: {
      common: { placementCost: 30, rangeCells: 15, damage: 100, attackInterval: 30.0, missileDuration: 5.0 },
      uncommon: { placementCost: 60, rangeCells: 25, damage: 150, attackInterval: 25.0, missileDuration: 5.0 },
      rare: { placementCost: 120, rangeCells: 35, damage: 200, attackInterval: 20.0, missileDuration: 5.0 },
      epic: { placementCost: 240, rangeCells: 45, damage: 250, attackInterval: 15.0, missileDuration: 5.0 },
      legendary: { placementCost: 480, rangeCells: 55, damage: 300, attackInterval: 10.0, missileDuration: 5.0 }
    }
  }
};

export function getNextRarity(rarity) {
  const index = RARITIES.indexOf(rarity);
  return RARITIES[index + 1] || null;
}
