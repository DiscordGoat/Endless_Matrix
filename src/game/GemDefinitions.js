export const GEM_ORDER = ["legendary_diamond", "epic_sapphire", "rare_black_opal", "uncommon_topaz", "common_amethyst"];

export const GEM_DEFINITIONS = {
  common_amethyst: {
    id: "common_amethyst",
    label: "Common Amethyst",
    rarity: "common",
    asset: "common_amethyst",
    sellValue: 20
  },
  uncommon_topaz: {
    id: "uncommon_topaz",
    label: "Uncommon Topaz",
    rarity: "uncommon",
    asset: "uncommon_topaz",
    sellValue: 40
  },
  rare_black_opal: {
    id: "rare_black_opal",
    label: "Rare Black Opal",
    rarity: "rare",
    asset: "rare_black_opal",
    sellValue: 80
  },
  epic_sapphire: {
    id: "epic_sapphire",
    label: "Epic Sapphire",
    rarity: "epic",
    asset: "epic_sapphire",
    sellValue: 160
  },
  legendary_diamond: {
    id: "legendary_diamond",
    label: "Legendary Diamond",
    rarity: "legendary",
    asset: "legendary_diamond",
    sellValue: 320
  }
};

export const STARTER_GEMS = [
  "legendary_diamond",
  "epic_sapphire",
  "epic_sapphire",
  "rare_black_opal",
  "uncommon_topaz",
  "uncommon_topaz",
  "common_amethyst"
];

export function getRandomGem(random = Math.random) {
  const roll = random();
  if (roll < 0.02) return "legendary_diamond";
  if (roll < 0.08) return "epic_sapphire";
  if (roll < 0.2) return "rare_black_opal";
  if (roll < 0.45) return "uncommon_topaz";
  return "common_amethyst";
}
