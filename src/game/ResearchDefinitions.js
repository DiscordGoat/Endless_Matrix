export const RESEARCH_ORDER = ["minigun", "cannon", "raygun", "antiair", "factory"];

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
      },
      headshot: {
        id: "headshot",
        towerId: "minigun",
        label: "Headshot",
        shortLabel: "Headshot",
        cost: 1,
        summary: "20% Chance for Double Damage",
        detail: "Each hit has a 20% chance to deal double damage.",
        position: { q: -1, r: -1 }
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
      },
      shellshocked: {
        id: "shellshocked",
        towerId: "cannon",
        label: "Shellshocked",
        shortLabel: "Shocked",
        cost: 1,
        summary: "20% Chance for Double Damage",
        detail: "Each hit has a 20% chance to deal double damage.",
        position: { q: 0, r: -1 }
      },
      bigger_guns: {
        id: "bigger_guns",
        towerId: "cannon",
        label: "Bigger Guns",
        shortLabel: "Big Guns",
        cost: 1,
        summary: "-90% Speed, +120% Damage",
        detail: "Fires much slower, but hits much harder.",
        position: { q: 0, r: 1 }
      }
    }
  },
  raygun: {
    towerId: "raygun",
    label: "Raygun",
    nodes: {
      tracer: {
        id: "tracer",
        towerId: "raygun",
        label: "Tracer",
        shortLabel: "Tracer",
        cost: 1,
        summary: "+60% Slow to Fast Enemies",
        detail: "Fast enemies are slowed harder by raygun freeze.",
        position: { q: -1, r: 0 }
      },
      cryo: {
        id: "cryo",
        towerId: "raygun",
        label: "Cryo",
        shortLabel: "Cryo",
        cost: 1,
        summary: "+30% Slow Effect",
        detail: "All raygun freezes slow enemies harder.",
        position: { q: 1, r: 0 }
      },
      embrittlement: {
        id: "embrittlement",
        towerId: "raygun",
        label: "Embrittlement",
        shortLabel: "Brittle",
        cost: 1,
        summary: "Frozen Enemies Take Double Damage",
        detail: "Damaging a frozen enemy deals double damage, then ends freeze.",
        position: { q: 0, r: -1 }
      },
      absolute_stasis: {
        id: "absolute_stasis",
        towerId: "raygun",
        label: "Absolute Stasis",
        shortLabel: "Stasis",
        cost: 1,
        summary: "-90% Speed, Full Stop",
        detail: "Fires much slower, but completely stops enemies during freeze.",
        position: { q: 0, r: 1 }
      }
    }
  },
  antiair: {
    towerId: "antiair",
    label: "Anti Air",
    nodes: {
      lock_on_array: {
        id: "lock_on_array",
        towerId: "antiair",
        label: "Lock-on Array",
        shortLabel: "Lock-on",
        cost: 1,
        summary: "+30% Missile Speed",
        detail: "Missiles reach targets 30% faster.",
        position: { q: 0, r: -1 }
      }
    }
  },
  factory: {
    towerId: "factory",
    label: "Factory",
    nodes: {
      overtime: {
        id: "overtime",
        towerId: "factory",
        label: "Overtime",
        shortLabel: "Overtime",
        cost: 1,
        summary: "+1 Wave of Resources",
        detail: "Factory output is increased across its two wave activations.",
        position: { q: -1, r: 0 }
      },
      emergency: {
        id: "emergency",
        towerId: "factory",
        label: "Emergency",
        shortLabel: "Emergency",
        cost: 1,
        summary: "Refund Damage as Resources",
        detail: "When enemies damage you, this factory grants matching resources.",
        position: { q: 0, r: -1 }
      },
      assembly_line: {
        id: "assembly_line",
        towerId: "factory",
        label: "Assembly Line",
        shortLabel: "Assembly",
        cost: 1,
        summary: "-5 Upgrade Cost",
        detail: "Tower upgrades cost 5 fewer resources. Does not stack.",
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
