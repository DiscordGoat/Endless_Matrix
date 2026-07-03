import tierOneLevels from "./TierOneLevels.json";

export function getTierOneLevel(level) {
  return tierOneLevels.levels.find((definition) => definition.level === level) || tierOneLevels.levels[0];
}

export function createFlavorFromLevel(definition) {
  return {
    tier: definition.tier,
    level: definition.level,
    rarity: {
      id: definition.rarity || "common",
      label: titleCase(definition.rarity || "common")
    },
    biome: {
      id: definition.baseType,
      label: definition.label || titleCase(definition.baseType || "authored")
    },
    elements: definition.elements || []
  };
}

export function createRoadFromLevel(definition) {
  return {
    side: definition.road?.side || "west",
    start: definition.road?.start || definition.road?.cells?.[0] || { x: 0, y: 0 },
    end: definition.road?.end || definition.road?.cells?.at(-1) || { x: 0, y: 0 },
    targetLength: definition.road?.targetLength || definition.road?.cells?.length || 0,
    cells: definition.road?.cells || []
  };
}

export function createTilesFromLevel(definition) {
  if (Array.isArray(definition.tiles)) return definition.tiles;

  const width = definition.dimensions?.width || 50;
  const height = definition.dimensions?.height || 50;
  const count = Math.max(0, definition.generator?.tiles ?? Math.round((width * height) / 100));
  if (count <= 0) return [];
  return buildRoadProximityTiles({
    width,
    height,
    count,
    road: definition.road?.cells || [],
    elements: definition.elements || [],
    seed: (definition.generator?.seed || definition.level || 1) + 379
  });
}

function buildRoadProximityTiles({ width, height, count, road, elements, seed }) {
  const blocked = new Set();
  for (const cell of road) blocked.add(cellKey(cell.x, cell.y));
  for (const element of elements) {
    for (let y = element.y; y < element.y + element.height; y++) {
      for (let x = element.x; x < element.x + element.width; x++) {
        blocked.add(cellKey(x, y));
      }
    }
  }

  const candidates = [];
  for (let y = 1; y < height - 2; y++) {
    for (let x = 1; x < width - 2; x++) {
      const cells = rectCells(x, y, 2, 2);
      if (cells.some((cell) => blocked.has(cellKey(cell.x, cell.y)))) continue;

      const distance = Math.min(...road.map((cell) => {
        const dx = Math.max(x - cell.x, 0, cell.x - (x + 1));
        const dy = Math.max(y - cell.y, 0, cell.y - (y + 1));
        return Math.abs(dx) + Math.abs(dy);
      }));
      if (!Number.isFinite(distance) || distance > 5) continue;
      candidates.push({ x, y, distance, roll: seededRandom(seed + x * 73856093 + y * 19349663) });
    }
  }

  const tiles = [];
  const occupied = new Set();
  candidates
    .sort((a, b) => a.distance - b.distance || a.roll - b.roll)
    .some((candidate) => {
      const cells = rectCells(candidate.x, candidate.y, 2, 2);
      if (cells.some((cell) => occupied.has(cellKey(cell.x, cell.y)))) return false;
      cells.forEach((cell) => occupied.add(cellKey(cell.x, cell.y)));
      tiles.push({
        id: `tile-${tiles.length}`,
        type: "tile",
        x: candidate.x,
        y: candidate.y,
        width: 2,
        height: 2
      });
      return tiles.length >= count;
    });

  return tiles;
}

function rectCells(x, y, width, height) {
  const cells = [];
  for (let yy = y; yy < y + height; yy++) {
    for (let xx = x; xx < x + width; xx++) {
      cells.push({ x: xx, y: yy });
    }
  }
  return cells;
}

function cellKey(x, y) {
  return `${x},${y}`;
}

function seededRandom(seed) {
  let value = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
  value ^= value >>> 13;
  value = Math.imul(value, 0xc2b2ae35);
  value ^= value >>> 16;
  return (value >>> 0) / 4294967296;
}

function titleCase(value) {
  return String(value || "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
