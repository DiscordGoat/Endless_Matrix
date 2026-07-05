export const SHOP_CELL_COUNT = 100;
export const SHOP_COLUMN_COUNT = 6;
export const BASE_COIN_DROP_CHANCE = 0.25;
export const BASE_GEM_DROP_CHANCE = 0.02;
export const BASE_CRATE_DROP_CHANCE = 0.03;
export const BASE_RAIDER_RESOURCE_MULTIPLIER = 1.5;

export const PERK_DEFINITIONS = {
  gemseeker: {
    id: "gemseeker",
    label: "Gemseeker",
    icon: "gemseeker",
    maxLevel: 10,
    cell: 0,
    bonusPerLevel: 0.005,
    costForLevel: (level) => level * 100,
    getDescription: (level) => `Increase Gem Chance by ${formatDecimalPercent(level * 0.005)}`,
    getShortBonus: (level) => `+${formatDecimalPercent(level * 0.005)} Gem Chance`
  },
  gilded: {
    id: "gilded",
    label: "Gilded",
    icon: "Gilded",
    maxLevel: 10,
    cell: 1,
    bonusPerLevel: 0.1,
    costForLevel: (level) => level * 100,
    getDescription: (level) => `Increase Coin Yield by ${level * 10}%`,
    getShortBonus: (level) => `+${level * 10}% Coin Yield`
  },
  cratehoarder: {
    id: "cratehoarder",
    label: "Crate Hoarder",
    icon: "crate_hoarder",
    maxLevel: 5,
    cell: 2,
    bonusPerLevel: 0.002,
    costForLevel: (level) => level * 200,
    getDescription: (level) => `Increase Crate Chance by ${formatDecimalPercent(level * 0.002)}`,
    getShortBonus: (level) => `+${formatDecimalPercent(level * 0.002)} Crate Chance`
  },
  reserved: {
    id: "reserved",
    label: "Locked Perk",
    maxLevel: 0,
    cell: 4,
    locked: true,
    getDescription: () => "Empty perk slot",
    getShortBonus: () => "Coming Soon"
  }
};

export const SHOP_PERK_ORDER = Object.keys(PERK_DEFINITIONS);

export function createDefaultPerks() {
  return Object.fromEntries(
    SHOP_PERK_ORDER
      .filter((perkId) => !PERK_DEFINITIONS[perkId].locked)
      .map((perkId) => [perkId, 0])
  );
}

export function getPerkRarity(level) {
  return getPerkRarityForProgress(level, 10);
}

export function getPerkRarityForProgress(level, maxLevel) {
  const progress = maxLevel > 0 ? level / maxLevel : 0;
  if (progress >= 1) return "legendary";
  if (progress > 0.6) return "epic";
  if (progress > 0.4) return "rare";
  if (progress > 0.2) return "uncommon";
  return "common";
}

export function getGemDropChance(perks = {}) {
  const gemseekerLevel = clampLevel(perks.gemseeker || 0, PERK_DEFINITIONS.gemseeker.maxLevel);
  return BASE_GEM_DROP_CHANCE + gemseekerLevel * PERK_DEFINITIONS.gemseeker.bonusPerLevel;
}

export function getCrateDropChance(perks = {}) {
  const crateHoarderLevel = clampLevel(perks.cratehoarder || 0, PERK_DEFINITIONS.cratehoarder.maxLevel);
  return BASE_CRATE_DROP_CHANCE + crateHoarderLevel * PERK_DEFINITIONS.cratehoarder.bonusPerLevel;
}

export function getCoinYieldMultiplier(perks = {}) {
  const gildedLevel = clampLevel(perks.gilded || 0, PERK_DEFINITIONS.gilded.maxLevel);
  return 1 + gildedLevel * PERK_DEFINITIONS.gilded.bonusPerLevel;
}

export function formatPercent(value) {
  return `${Math.round(value * 100)}%`;
}

export function formatDecimalPercent(value) {
  const percent = value * 100;
  return `${Number.isInteger(percent) ? percent : percent.toFixed(1)}%`;
}

export function toRoman(value) {
  const numerals = [
    ["X", 10],
    ["IX", 9],
    ["V", 5],
    ["IV", 4],
    ["I", 1]
  ];
  let remaining = value;
  let output = "";

  for (const [numeral, amount] of numerals) {
    while (remaining >= amount) {
      output += numeral;
      remaining -= amount;
    }
  }

  return output || "0";
}

function clampLevel(level, maxLevel) {
  return Math.max(0, Math.min(maxLevel, Number(level) || 0));
}
