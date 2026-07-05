export const RESEARCH_ORDER = ["minigun", "cannon"];

export const RESEARCH_DEFINITIONS = {
  minigun: {
    towerId: "minigun",
    label: "Minigun",
    nodes: {
      gatling: {
        id: "gatling",
        towerId: "minigun",
        label: "Gattling Gun",
        shortLabel: "Gattling",
        cost: 1,
        summary: "+30% Attack Speed",
        detail: "Fires 30% faster.",
        position: { q: 0, r: -1 }
      },
      high_caliber: {
        id: "high_caliber",
        towerId: "minigun",
        label: "High Caliber",
        shortLabel: "Caliber",
        cost: 1,
        summary: "-30% Speed, +60% Penetration",
        detail: "Fires slower. Shots have a 60% chance to spread to raiders within 2 cells.",
        position: { q: 1, r: 0 }
      },
      sniper: {
        id: "sniper",
        towerId: "minigun",
        label: "Sniper",
        shortLabel: "Sniper",
        cost: 1,
        summary: "-90% Speed, +60% Range, +30% Penetration",
        detail: "Fires much slower, reaches farther, and can spread shots.",
        position: { q: 0, r: 1 }
      },
      armor_piercing: {
        id: "armor_piercing",
        towerId: "minigun",
        label: "Armor Piercing",
        shortLabel: "Piercing",
        cost: 1,
        summary: "+50% Shield Damage",
        detail: "Deals extra damage to shields.",
        position: { q: -1, r: 0 }
      }
    }
  },
  cannon: {
    towerId: "cannon",
    label: "Cannon",
    nodes: {
      airburst: {
        id: "airburst",
        towerId: "cannon",
        label: "Airburst",
        shortLabel: "Airburst",
        cost: 1,
        summary: "-50% Damage, Enables Bombs",
        detail: "Shots deal half damage, then drop 4 delayed 2x2 area bombs.",
        position: { q: -1, r: 0 }
      },
      armor_piercing: {
        id: "armor_piercing",
        towerId: "cannon",
        label: "Armor Piercing",
        shortLabel: "Piercing",
        cost: 1,
        summary: "-50% Speed, +80% Shield Damage",
        detail: "Fires slower and hits shields much harder.",
        position: { q: 1, r: 0 }
      }
    }
  }
};

export const RESEARCH_NODE_LOOKUP = Object.fromEntries(
  Object.values(RESEARCH_DEFINITIONS).flatMap((group) => (
    Object.values(group.nodes).map((node) => [getResearchKey(node.towerId, node.id), node])
  ))
);

export function getResearchKey(towerId, researchId) {
  return `${towerId}:${researchId}`;
}

export function createDefaultResearch() {
  return Object.fromEntries(
    Object.values(RESEARCH_DEFINITIONS).flatMap((group) => (
      Object.values(group.nodes).map((node) => [getResearchKey(node.towerId, node.id), 0])
    ))
  );
}

export function getTowerResearchNodes(towerId) {
  return Object.values(RESEARCH_DEFINITIONS[towerId]?.nodes || {});
}

export function getResearchNode(towerId, researchId) {
  return RESEARCH_DEFINITIONS[towerId]?.nodes?.[researchId] || null;
}

export function getResearchCost(node, currentCapacity = 0) {
  return node.cost + Math.max(0, Math.round(Number(currentCapacity) || 0)) * node.cost;
}
