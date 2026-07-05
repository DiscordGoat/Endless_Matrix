export const CRATE_ORDER = ["gold", "silver", "bronze"];

export const CRATE_DEFINITIONS = {
  bronze: {
    id: "bronze",
    label: "Copper Crate",
    asset: "bronze_crate",
    baseValue: 100,
    singularityChance: 0.1,
    color: "rgba(205, 127, 50, 0.95)"
  },
  silver: {
    id: "silver",
    label: "Silver Crate",
    asset: "silver_crate",
    baseValue: 250,
    singularityChance: 0.2,
    color: "rgba(198, 214, 226, 0.95)"
  },
  gold: {
    id: "gold",
    label: "Gold Crate",
    asset: "gold_crate",
    baseValue: 500,
    singularityChance: 0.4,
    color: "rgba(255, 207, 79, 0.95)"
  }
};

export function getRandomCrate(random = Math.random) {
  const roll = random();
  if (roll < 0.2) return "gold";
  if (roll < 0.5) return "silver";
  return "bronze";
}
