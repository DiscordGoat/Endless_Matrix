const RARITY_SIZE = 20;
const TIER_ONE_GRID_SIZE = 50;

const RARITIES = [
  { id: "common", label: "Common", biome: "forest" },
  { id: "uncommon", label: "Uncommon", biome: "unassigned" },
  { id: "rare", label: "Rare", biome: "unassigned" },
  { id: "epic", label: "Epic", biome: "unassigned" },
  { id: "legendary", label: "Legendary", biome: "unassigned" }
];

const BIOMES = {
  forest: {
    id: "forest",
    label: "Forest Biome",
    elements: [
      { id: "forest-tree", type: "tree", count: 20, minGap: 2 },
      { id: "forest-boulder", type: "boulder", count: 20, minGap: 2 }
    ]
  },
  unassigned: {
    id: "unassigned",
    label: "Unassigned Biome",
    elements: []
  }
};

export class FlavorManager {
  getFlavor({ tier = 1, level = 1, gridSize = TIER_ONE_GRID_SIZE, seedOffset = 0 }) {
    const rarity = this.#getRarity(level);
    const biome = BIOMES[rarity.biome] || BIOMES.unassigned;
    const random = createSeededRandom(tier * 10000 + level * 101 + seedOffset * 9973 + hashString(biome.id));

    return {
      tier,
      level,
      rarity,
      biome,
      elements: this.#buildElements({ biome, gridSize, random })
    };
  }

  #getRarity(level) {
    const index = Math.min(RARITIES.length - 1, Math.floor((level - 1) / RARITY_SIZE));
    return RARITIES[index];
  }

  #buildElements({ biome, gridSize, random }) {
    const elements = [];
    const occupied = new Set();

    for (const definition of biome.elements) {
      let placed = 0;
      let attempts = 0;
      const maxAttempts = definition.count * 40;

      while (placed < definition.count && attempts < maxAttempts) {
        attempts++;

        const x = randomInt(random, 3, gridSize - 5);
        const y = randomInt(random, 3, gridSize - 5);
        const key = `${x},${y}`;

        if (occupied.has(key) || hasNeighbor(occupied, x, y, definition.minGap)) {
          continue;
        }

        occupied.add(key);
        elements.push({
          id: `${definition.id}-${placed}`,
          type: definition.type,
          x,
          y,
          width: 2,
          height: 2,
          rotation: random() * Math.PI * 2,
          scale: randomRange(random, 0.82, 1.18),
          cant: getDirectionalCant(x + 1, y + 1, gridSize)
        });
        placed++;
      }
    }

    return elements;
  }
}

function hasNeighbor(occupied, x, y, gap) {
  for (let yy = y - gap; yy <= y + gap; yy++) {
    for (let xx = x - gap; xx <= x + gap; xx++) {
      if (occupied.has(`${xx},${yy}`)) return true;
    }
  }

  return false;
}

function createSeededRandom(seed) {
  let state = seed >>> 0;

  return function random() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInt(random, min, max) {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randomRange(random, min, max) {
  return random() * (max - min) + min;
}

function hashString(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index++) {
    hash = Math.imul(31, hash) + value.charCodeAt(index) | 0;
  }

  return hash;
}

function getDirectionalCant(x, y, gridSize) {
  const center = (gridSize - 1) / 2;
  return {
    x: (x - center) / center,
    y: (y - center) / center
  };
}
