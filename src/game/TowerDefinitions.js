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
      common: { placementCost: 30, rangeCells: 3, damage: 10, attackInterval: 2.0 },
      uncommon: { placementCost: 60, rangeCells: 4, damage: 20, attackInterval: 1.8 },
      rare: { placementCost: 120, rangeCells: 5, damage: 30, attackInterval: 1.6 },
      epic: { placementCost: 240, rangeCells: 6, damage: 40, attackInterval: 1.4 },
      legendary: { placementCost: 480, rangeCells: 12, damage: 50, attackInterval: 1.0 }
    }
  }
};

export function getNextRarity(rarity) {
  const index = RARITIES.indexOf(rarity);
  return RARITIES[index + 1] || null;
}
