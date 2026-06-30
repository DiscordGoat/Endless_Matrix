const MIN_ROAD_LENGTH = 100;
const MAX_ROAD_LENGTH = 300;
const MIN_STRAIGHT_BEFORE_TURN = 5;
const PREFERRED_STRAIGHT_BEFORE_TURN = 10;
const EDGE_AVOID_DISTANCE = 4;

export class RoadGenerator {
  generate({ gridSize, obstacles, seed }) {
    const random = createSeededRandom(seed);
    const side = pickSide(random);
    const start = getStartCell(side, gridSize, random);
    const end = getOppositeEndCell(side, gridSize, random);
    const blocked = buildBlockedSet(obstacles);
    const targetLength = randomInt(random, MIN_ROAD_LENGTH, MAX_ROAD_LENGTH);

    let path = this.#findPath({ gridSize, start, end, blocked, random });

    if (!path) {
      path = this.#findPath({ gridSize, start, end, blocked: new Set(), random });
    }

    return {
      side,
      start,
      end,
      targetLength,
      cells: fitRoadLength(path || [start, end], targetLength, gridSize, blocked, start, end)
    };
  }

  #findPath({ gridSize, start, end, blocked, random }) {
    const requiredEntryDirection = getEntryDirection(start, gridSize);
    const requiredExitDirection = getRequiredExitDirection(end, gridSize);
    const startState = { ...start, dir: null, straight: 0 };
    const queue = [startState];
    const cameFrom = new Map();
    const cost = new Map();
    const startKey = stateKey(startState);

    cameFrom.set(startKey, null);
    cost.set(startKey, 0);

    while (queue.length > 0) {
      queue.sort((a, b) => {
        const aKey = stateKey(a);
        const bKey = stateKey(b);
        return cost.get(aKey) + heuristic(a, end) - (cost.get(bKey) + heuristic(b, end));
      });

      const current = queue.shift();
      const currentKey = stateKey(current);

      if (
        current.x === end.x &&
        current.y === end.y &&
        current.dir === requiredExitDirection &&
        current.straight >= MIN_STRAIGHT_BEFORE_TURN
      ) {
        return rebuildPath(cameFrom, current);
      }

      const neighbors = shuffledNeighbors(current, random);

      for (const next of neighbors) {
        if (next.x < 0 || next.y < 0 || next.x >= gridSize || next.y >= gridSize) continue;
        if (blocked.has(key(next.x, next.y))) continue;
        if (!current.dir && next.dir !== requiredEntryDirection) continue;
        if (current.dir && isOppositeDirection(current.dir, next.dir)) continue;
        if (current.dir && current.dir !== next.dir && current.straight < MIN_STRAIGHT_BEFORE_TURN) continue;

        const nextState = {
          ...next,
          straight: current.dir === next.dir ? current.straight + 1 : 1
        };
        const nextKey = stateKey(nextState);
        const turnCost = getTurnCost(current, next);
        const edgeCost = getEdgeBiasCost(next, gridSize, start, end);
        const newCost = cost.get(currentKey) + 1 + turnCost + edgeCost;

        if (!cost.has(nextKey) || newCost < cost.get(nextKey)) {
          cost.set(nextKey, newCost);
          cameFrom.set(nextKey, current);
          queue.push(nextState);
        }
      }
    }

    return null;
  }
}

function fitRoadLength(path, targetLength, gridSize, blocked, start, end) {
  if (path.length === targetLength) return path;
  if (path.length > targetLength) return path;

  const result = [...path];
  let guard = 0;

  while (result.length + 2 <= targetLength && guard < targetLength * 20) {
    guard++;
    const inserted = insertDetour(result, gridSize, blocked, guard, targetLength - result.length, start, end);
    if (!inserted) break;
  }

  return result;
}

function insertDetour(path, gridSize, blocked, offset, remainingCells, start, end) {
  const candidates = [];

  for (let attempt = 1; attempt < path.length; attempt++) {
    const index = 1 + ((attempt + offset) % Math.max(1, path.length - 2));
    const a = path[index - 1];
    const b = path[index];
    const dx = b.x - a.x;
    const dy = b.y - a.y;

    if (Math.abs(dx) + Math.abs(dy) !== 1) continue;
    const straightRun = getStraightRunSides(path, index - 1, dx, dy);
    if (straightRun.backward < MIN_STRAIGHT_BEFORE_TURN) continue;
    if (straightRun.forward < MIN_STRAIGHT_BEFORE_TURN * 2) continue;

    const perpendiculars = dx !== 0
      ? [{ x: 0, y: 1 }, { x: 0, y: -1 }]
      : [{ x: 1, y: 0 }, { x: -1, y: 0 }];

    for (const perpendicular of perpendiculars) {
      const maxDepth = Math.min(18, Math.floor(remainingCells / 2));
      const maxSpan = Math.min(18, straightRun.forward);

      for (let depth = maxDepth; depth >= 1; depth--) {
        if (depth < MIN_STRAIGHT_BEFORE_TURN) continue;

        for (let span = maxSpan; span >= MIN_STRAIGHT_BEFORE_TURN; span--) {
          const endpoint = path[index - 1 + span];
          const forwardAfterEndpoint = getForwardRunLength(path, index - 1 + span, dx, dy);

          if (forwardAfterEndpoint < MIN_STRAIGHT_BEFORE_TURN && index - 1 + span < path.length - 1) {
            continue;
          }

          const detour = buildDetour(a, endpoint, { x: dx, y: dy }, perpendicular, depth, span);
          const replacedCells = path.slice(index, index - 1 + span);

          if (!detour.every((cell) => isRoadCellAvailable(cell, gridSize, blocked, path, replacedCells))) {
            continue;
          }

          const clearance = getDetourClearance(detour, path, index);
          const tightLanePenalty = clearance < 4 ? (4 - clearance) * 240 : 0;

          candidates.push({
            index,
            removeCount: span - 1,
            detour,
          score: scoreDetour({ detour, path, depth, index, tightLanePenalty, straightRun, gridSize, start, end })
        });
        }
      }
    }
  }

  if (candidates.length === 0) return false;

  candidates.sort((a, b) => b.score - a.score);
  const selected = candidates[0];
  path.splice(selected.index, selected.removeCount, ...selected.detour);
  return true;
}

function isRoadCellAvailable(cell, gridSize, blocked, path, replacedCells = []) {
  if (cell.x < 0 || cell.y < 0 || cell.x >= gridSize || cell.y >= gridSize) return false;
  if (blocked.has(key(cell.x, cell.y))) return false;
  return !path.some((item) => {
    if (replacedCells.some((replaced) => replaced.x === item.x && replaced.y === item.y)) {
      return false;
    }

    return item.x === cell.x && item.y === cell.y;
  });
}

function buildDetour(a, endpoint, direction, perpendicular, depth, span) {
  const detour = [];

  for (let step = 1; step <= depth; step++) {
    detour.push({
      x: a.x + perpendicular.x * step,
      y: a.y + perpendicular.y * step
    });
  }

  for (let step = 1; step <= span; step++) {
    detour.push({
      x: a.x + direction.x * step + perpendicular.x * depth,
      y: a.y + direction.y * step + perpendicular.y * depth
    });
  }

  for (let step = depth - 1; step >= 1; step--) {
    detour.push({
      x: endpoint.x + perpendicular.x * step,
      y: endpoint.y + perpendicular.y * step
    });
  }

  return detour;
}

function scoreDetour({ detour, path, depth, index, tightLanePenalty, straightRun, gridSize, start, end }) {
  let proximityPenalty = 0;
  let spacingReward = 0;
  let edgePenalty = 0;
  const shortestStraight = Math.min(straightRun.backward, straightRun.forward);
  const earlyTurnPenalty = shortestStraight < PREFERRED_STRAIGHT_BEFORE_TURN
    ? (PREFERRED_STRAIGHT_BEFORE_TURN - shortestStraight) * 70
    : 0;

  for (const cell of detour) {
    let nearest = Infinity;
    edgePenalty += getEdgeBiasCost(cell, gridSize, start, end) * 6;

    for (let roadIndex = 0; roadIndex < path.length; roadIndex++) {
      if (Math.abs(roadIndex - index) <= 5) continue;

      const roadCell = path[roadIndex];
      const distance = Math.abs(cell.x - roadCell.x) + Math.abs(cell.y - roadCell.y);
      if (distance === 0) proximityPenalty += 100;
      else if (distance === 1) proximityPenalty += 90;
      else if (distance === 2) proximityPenalty += 42;
      else if (distance === 3) proximityPenalty += 16;
      else if (distance === 4) proximityPenalty += 5;

      nearest = Math.min(nearest, distance);
    }

    spacingReward += Math.min(nearest, 10);
  }

  return depth * 90 + spacingReward * 9 - proximityPenalty - tightLanePenalty - earlyTurnPenalty - edgePenalty;
}

function getDetourClearance(detour, path, index) {
  let clearance = Infinity;

  for (const cell of detour) {
    for (let roadIndex = 0; roadIndex < path.length; roadIndex++) {
      if (Math.abs(roadIndex - index) <= 5) continue;

      const roadCell = path[roadIndex];
      clearance = Math.min(clearance, Math.abs(cell.x - roadCell.x) + Math.abs(cell.y - roadCell.y));
    }
  }

  return clearance;
}

function buildBlockedSet(obstacles) {
  const blocked = new Set();

  for (const obstacle of obstacles) {
    for (let y = obstacle.y; y < obstacle.y + obstacle.height; y++) {
      for (let x = obstacle.x; x < obstacle.x + obstacle.width; x++) {
        blocked.add(key(x, y));
      }
    }
  }

  return blocked;
}

function shuffledNeighbors(cell, random) {
  const neighbors = [
    { x: cell.x + 1, y: cell.y, dir: "east" },
    { x: cell.x - 1, y: cell.y, dir: "west" },
    { x: cell.x, y: cell.y + 1, dir: "south" },
    { x: cell.x, y: cell.y - 1, dir: "north" }
  ];

  return neighbors
    .map((neighbor) => ({ neighbor, sort: random() }))
    .sort((a, b) => a.sort - b.sort)
    .map((item) => item.neighbor);
}

function rebuildPath(cameFrom, end) {
  const path = [];
  let current = end;

  while (current) {
    path.push({ x: current.x, y: current.y });
    current = cameFrom.get(stateKey(current));
  }

  return path.reverse();
}

function getStraightRunSides(path, startIndex, dx, dy) {
  let backward = 0;
  for (let index = startIndex; index > 0; index--) {
    const current = path[index];
    const previous = path[index - 1];
    if (current.x - previous.x !== dx || current.y - previous.y !== dy) break;
    backward++;
  }

  let forward = 0;
  for (let index = startIndex + 1; index < path.length; index++) {
    const current = path[index];
    const previous = path[index - 1];
    if (current.x - previous.x !== dx || current.y - previous.y !== dy) break;
    forward++;
  }

  return { backward, forward };
}

function getForwardRunLength(path, startIndex, dx, dy) {
  let forward = 0;

  for (let index = startIndex + 1; index < path.length; index++) {
    const current = path[index];
    const previous = path[index - 1];
    if (current.x - previous.x !== dx || current.y - previous.y !== dy) break;
    forward++;
  }

  return forward;
}

function getTurnCost(current, next) {
  if (!current.dir || current.dir === next.dir) return 0;

  if (current.straight >= PREFERRED_STRAIGHT_BEFORE_TURN) {
    return 14;
  }

  return 14 + (PREFERRED_STRAIGHT_BEFORE_TURN - current.straight) * 22;
}

function getEdgeBiasCost(cell, gridSize, start, end) {
  if (isEndpointCorridor(cell, start, end, gridSize)) return 0;

  const edgeDistance = Math.min(
    cell.x,
    cell.y,
    gridSize - 1 - cell.x,
    gridSize - 1 - cell.y
  );

  if (edgeDistance >= EDGE_AVOID_DISTANCE) return 0;
  return (EDGE_AVOID_DISTANCE - edgeDistance) * 18;
}

function isEndpointCorridor(cell, start, end, gridSize) {
  return isNearEndpointCorridor(cell, start, gridSize) || isNearEndpointCorridor(cell, end, gridSize);
}

function isNearEndpointCorridor(cell, endpoint, gridSize) {
  if (endpoint.x === 0 || endpoint.x === gridSize - 1) {
    return cell.y === endpoint.y && Math.abs(cell.x - endpoint.x) <= MIN_STRAIGHT_BEFORE_TURN;
  }

  return cell.x === endpoint.x && Math.abs(cell.y - endpoint.y) <= MIN_STRAIGHT_BEFORE_TURN;
}

function isOppositeDirection(a, b) {
  return (
    (a === "north" && b === "south") ||
    (a === "south" && b === "north") ||
    (a === "east" && b === "west") ||
    (a === "west" && b === "east")
  );
}

function heuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function pickSide(random) {
  return ["north", "east", "south", "west"][Math.floor(random() * 4)];
}

function getStartCell(side, gridSize, random) {
  const offset = randomInt(random, 6, gridSize - 7);
  if (side === "north") return { x: offset, y: 0 };
  if (side === "east") return { x: gridSize - 1, y: offset };
  if (side === "south") return { x: offset, y: gridSize - 1 };
  return { x: 0, y: offset };
}

function getOppositeEndCell(side, gridSize, random) {
  const offset = randomInt(random, 6, gridSize - 7);
  if (side === "north") return { x: offset, y: gridSize - 1 };
  if (side === "east") return { x: 0, y: offset };
  if (side === "south") return { x: offset, y: 0 };
  return { x: gridSize - 1, y: offset };
}

function getRequiredExitDirection(end, gridSize) {
  if (end.y === 0) return "north";
  if (end.x === gridSize - 1) return "east";
  if (end.y === gridSize - 1) return "south";
  return "west";
}

function getEntryDirection(start, gridSize) {
  if (start.y === 0) return "south";
  if (start.x === gridSize - 1) return "west";
  if (start.y === gridSize - 1) return "north";
  return "east";
}

function key(x, y) {
  return `${x},${y}`;
}

function stateKey(cell) {
  return `${cell.x},${cell.y},${cell.dir || "none"},${cell.straight}`;
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
