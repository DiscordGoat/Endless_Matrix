#!/usr/bin/env python3
import argparse
import heapq
import json
import math
import random
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_PATH = PROJECT_ROOT / "src/game/TierOneLevels.json"
RARITY_SIZE = 20
RARITIES = ["common", "uncommon", "rare", "epic", "legendary"]
OBSTACLE_SIZES = {
    "tree": (2, 2),
    "boulder": (2, 2),
    "lake": (8, 8),
    "monolith": (4, 4),
}


def main():
    parser = argparse.ArgumentParser(description="Generate and export authored Endless Matrix level maps.")
    parser.add_argument("--data", default=str(DEFAULT_DATA_PATH), help="JSON level database to read/write.")
    sub = parser.add_subparsers(dest="command", required=True)

    randomize = sub.add_parser("randomize", help="Generate one candidate level and optionally export it.")
    add_generation_args(randomize)
    randomize.add_argument("--level", type=int, default=1, help="Tier 1 level number to preview/export.")
    randomize.add_argument("--export", action="store_true", help="Replace this level in the JSON database.")
    randomize.add_argument("--preview-png", help="Optional PNG preview path.")

    seed_tier = sub.add_parser("seed-tier1", help="Generate starter authored maps for all 100 Tier 1 levels.")
    add_generation_args(seed_tier)
    seed_tier.add_argument("--start-level", type=int, default=1)
    seed_tier.add_argument("--end-level", type=int, default=100)

    args = parser.parse_args()
    data_path = Path(args.data)

    if args.command == "randomize":
      level = generate_level(args, args.level, seed=args.seed)
      print_level(level)
      if args.preview_png:
          write_preview_png(level, Path(args.preview_png))
      if args.export:
          save_level(data_path, level)
          print(f"Exported level {level['level']} to {data_path}")
      return

    if args.command == "seed-tier1":
      data = load_database(data_path)
      for level_number in range(args.start_level, args.end_level + 1):
          seed = (args.seed or 70000) + level_number * 997
          level = generate_level(args, level_number, seed=seed)
          upsert_level(data, level)
      write_database(data_path, data)
      print(f"Seeded Tier 1 levels {args.start_level}-{args.end_level} into {data_path}")


def add_generation_args(parser):
    parser.add_argument("--base-type", default="forest-lake", help="Level base type label/id.")
    parser.add_argument("--width", type=int, default=50, help="Map width in cells.")
    parser.add_argument("--height", type=int, default=50, help="Map height in cells.")
    parser.add_argument("--road-length", type=int, default=150, help="Target road length in cells.")
    parser.add_argument("--turn-rate", type=float, default=0.42, help="0..1; higher allows more frequent turning.")
    parser.add_argument("--min-straight", type=int, default=5, help="Minimum straight cells before turns.")
    parser.add_argument("--trees", type=int, default=20)
    parser.add_argument("--boulders", type=int, default=20)
    parser.add_argument("--lakes", type=int, default=1)
    parser.add_argument("--monoliths", type=int, default=2)
    parser.add_argument("--tiles", type=int, default=25)
    parser.add_argument("--seed", type=int, help="Candidate seed. Omit to randomize.")


def generate_level(args, level_number, seed=None):
    seed = seed if seed is not None else random.randrange(1, 2_000_000_000)
    rng = random.Random(seed)
    width = max(18, args.width)
    height = max(18, args.height)
    obstacle_counts = {
        "tree": max(0, args.trees),
        "boulder": max(0, args.boulders),
        "lake": max(0, args.lakes),
        "monolith": max(0, args.monoliths),
    }
    road = build_road(
        rng=rng,
        width=width,
        height=height,
        elements=[],
        target_length=max(12, args.road_length),
        min_straight=max(2, args.min_straight),
        turn_rate=max(0.0, min(1.0, args.turn_rate)),
    )
    elements = build_obstacles(rng, width, height, obstacle_counts, blocked=road_cell_set(road))
    tiles = build_tiles(rng, width, height, max(0, args.tiles), road, blocked=road_cell_set(road) | blocked_cells(elements))

    return {
        "tier": 1,
        "level": level_number,
        "baseType": args.base_type,
        "label": title_case(args.base_type),
        "rarity": RARITIES[min(len(RARITIES) - 1, (level_number - 1) // RARITY_SIZE)],
        "dimensions": {
            "width": width,
            "height": height,
        },
        "generator": {
            "seed": seed,
            "roadLength": args.road_length,
            "turnRate": args.turn_rate,
            "minStraight": args.min_straight,
            "obstacles": obstacle_counts,
            "tiles": max(0, args.tiles),
        },
        "elements": elements,
        "tiles": tiles,
        "road": road,
    }


def build_obstacles(rng, width, height, counts, blocked=None):
    elements = []
    occupied = set(blocked or set())
    order = ["lake", "monolith", "boulder", "tree"]

    for obstacle_type in order:
        obstacle_width, obstacle_height = OBSTACLE_SIZES[obstacle_type]
        placed = 0
        attempts = 0
        target = counts.get(obstacle_type, 0)
        while placed < target and attempts < target * 80 + 200:
            attempts += 1
            x = rng.randint(3, max(3, width - obstacle_width - 4))
            y = rng.randint(3, max(3, height - obstacle_height - 4))
            gap = 2 if obstacle_type not in ("lake", "monolith") else 4
            cells = rect_cells(x, y, obstacle_width, obstacle_height)
            if any(cell in occupied for cell in expand_cells(cells, gap)):
                continue

            for cell in cells:
                occupied.add(cell)

            elements.append({
                "id": f"{obstacle_type}-{placed}",
                "type": obstacle_type,
                "x": x,
                "y": y,
                "width": obstacle_width,
                "height": obstacle_height,
                "rotation": round(rng.random() * math.tau, 4),
                "scale": round(rng.uniform(0.82, 1.18), 3),
                "cant": directional_cant(x + obstacle_width / 2, y + obstacle_height / 2, width, height),
            })
            placed += 1

    return elements


def build_tiles(rng, width, height, target, road, blocked=None):
    if target <= 0:
        return []

    tiles = []
    occupied = set(blocked or set())
    road_cells = road_cell_set(road)
    candidates = []

    for y in range(1, height - 2):
        for x in range(1, width - 2):
            cells = rect_cells(x, y, 2, 2)
            if any(cell in occupied for cell in cells):
                continue

            distance = min(tile_road_distance(x, y, road_cell) for road_cell in road_cells)
            if distance > 5:
                continue

            candidates.append((distance, rng.random(), x, y))

    candidates.sort()
    for _, _, x, y in candidates:
        cells = rect_cells(x, y, 2, 2)
        if any(cell in occupied for cell in cells):
            continue

        occupied.update(cells)
        tiles.append({
            "id": f"tile-{len(tiles)}",
            "type": "tile",
            "x": x,
            "y": y,
            "width": 2,
            "height": 2,
        })
        if len(tiles) >= target:
            break

    return tiles


def tile_road_distance(x, y, road_cell):
    dx = max(x - road_cell[0], 0, road_cell[0] - (x + 1))
    dy = max(y - road_cell[1], 0, road_cell[1] - (y + 1))
    return abs(dx) + abs(dy)


def build_road(rng, width, height, elements, target_length, min_straight, turn_rate):
    side = rng.choice(["north", "east", "south", "west"])
    start = start_cell(rng, side, width, height)
    end = opposite_end_cell(rng, side, width, height)
    blocked = blocked_cells(elements)
    path = find_path(width, height, start, end, blocked, rng, min_straight, turn_rate)

    if not path:
        path = find_path(width, height, start, end, set(), rng, min_straight, turn_rate)

    path = fit_road_length(path or [start, end], target_length, width, height, blocked, min_straight)
    return {
        "side": side,
        "start": start,
        "end": end,
        "targetLength": target_length,
        "cells": path,
    }


def find_path(width, height, start, end, blocked, rng, min_straight, turn_rate):
    required_entry = entry_direction(start, width, height)
    required_exit = exit_direction(end, width, height)
    start_state = (start["x"], start["y"], None, 0)
    frontier = []
    heapq.heappush(frontier, (heuristic(start_state, end), 0, start_state))
    came_from = {start_state: None}
    cost = {start_state: 0}
    counter = 0

    while frontier:
        _, _, current = heapq.heappop(frontier)
        x, y, direction, straight = current

        if x == end["x"] and y == end["y"] and direction == required_exit and straight >= min_straight:
            return rebuild_path(came_from, current)

        neighbors = shuffled_neighbors(rng, x, y)
        for nx, ny, ndir in neighbors:
            if nx < 0 or ny < 0 or nx >= width or ny >= height:
                continue
            if (nx, ny) in blocked:
                continue
            if direction is None and ndir != required_entry:
                continue
            if direction and is_opposite(direction, ndir):
                continue
            if direction and direction != ndir and straight < min_straight:
                continue

            next_straight = straight + 1 if direction == ndir else 1
            next_state = (nx, ny, ndir, next_straight)
            new_cost = cost[current] + 1 + turn_cost(direction, ndir, straight, min_straight, turn_rate)
            if next_state not in cost or new_cost < cost[next_state]:
                cost[next_state] = new_cost
                came_from[next_state] = current
                counter += 1
                heapq.heappush(frontier, (new_cost + heuristic(next_state, end), counter, next_state))

    return None


def fit_road_length(path, target_length, width, height, blocked, min_straight):
    result = list(path)
    guard = 0
    while len(result) + 2 <= target_length and guard < target_length * 20:
        guard += 1
        if not insert_detour(result, width, height, blocked, target_length - len(result), min_straight, guard):
            break
    return result[:target_length + 24]


def insert_detour(path, width, height, blocked, remaining, min_straight, offset):
    candidates = []
    for attempt in range(1, len(path) - 2):
        index = 1 + ((attempt + offset) % max(1, len(path) - 2))
        a = path[index - 1]
        b = path[index]
        dx = b["x"] - a["x"]
        dy = b["y"] - a["y"]
        if abs(dx) + abs(dy) != 1:
            continue
        backward, forward = straight_run_sides(path, index - 1, dx, dy)
        if backward < min_straight or forward < min_straight * 2:
            continue
        perpendiculars = [(0, 1), (0, -1)] if dx else [(1, 0), (-1, 0)]
        for px, py in perpendiculars:
            for depth in range(min(18, remaining // 2), min_straight - 1, -1):
                span = min(18, forward)
                endpoint = path[index - 1 + span]
                detour = build_detour(a, endpoint, dx, dy, px, py, depth, span)
                replaced = path[index:index - 1 + span]
                if all(road_cell_available(cell, width, height, blocked, path, replaced) for cell in detour):
                    candidates.append((depth * span, index, span - 1, detour))

    if not candidates:
        return False
    candidates.sort(reverse=True, key=lambda item: item[0])
    _, index, remove_count, detour = candidates[0]
    path[index:index + remove_count] = detour
    return True


def build_detour(a, endpoint, dx, dy, px, py, depth, span):
    detour = []
    for step in range(1, depth + 1):
        detour.append({"x": a["x"] + px * step, "y": a["y"] + py * step})
    for step in range(1, span + 1):
        detour.append({"x": a["x"] + dx * step + px * depth, "y": a["y"] + dy * step + py * depth})
    for step in range(depth - 1, 0, -1):
        detour.append({"x": endpoint["x"] + px * step, "y": endpoint["y"] + py * step})
    return detour


def road_cell_available(cell, width, height, blocked, path, replaced):
    point = (cell["x"], cell["y"])
    if cell["x"] < 0 or cell["y"] < 0 or cell["x"] >= width or cell["y"] >= height:
        return False
    if point in blocked:
        return False
    replaced_points = {(item["x"], item["y"]) for item in replaced}
    for item in path:
        item_point = (item["x"], item["y"])
        if item_point in replaced_points:
            continue
        if item_point == point:
            return False
    return True


def print_level(level):
    print(
        f"Level {level['level']} seed={level['generator']['seed']} "
        f"{level['dimensions']['width']}x{level['dimensions']['height']} "
        f"road={len(level['road']['cells'])}/{level['road']['targetLength']}"
    )
    print(ascii_preview(level))


def ascii_preview(level):
    width = level["dimensions"]["width"]
    height = level["dimensions"]["height"]
    road = {(cell["x"], cell["y"]) for cell in level["road"]["cells"]}
    marks = {}
    for element in level["elements"]:
        char = {"tree": "T", "boulder": "B", "lake": "~", "monolith": "M"}.get(element["type"], "#")
        for cell in rect_cells(element["x"], element["y"], element["width"], element["height"]):
            marks[cell] = char
    for tile in level.get("tiles", []):
        for cell in rect_cells(tile["x"], tile["y"], tile["width"], tile["height"]):
            marks[cell] = "P"
    lines = []
    for y in range(height):
        line = []
        for x in range(width):
            if (x, y) in road:
                line.append("=")
            else:
                line.append(marks.get((x, y), "."))
        lines.append("".join(line))
    return "\n".join(lines)


def write_preview_png(level, path):
    from PIL import Image, ImageDraw

    cell = 10
    width = level["dimensions"]["width"]
    height = level["dimensions"]["height"]
    image = Image.new("RGB", (width * cell, height * cell), (7, 10, 16))
    draw = ImageDraw.Draw(image)
    colors = {
        "tree": (74, 148, 74),
        "boulder": (105, 105, 118),
        "lake": (42, 103, 168),
        "monolith": (226, 232, 240),
    }
    for element in level["elements"]:
        draw.rectangle(
            [
                element["x"] * cell,
                element["y"] * cell,
                (element["x"] + element["width"]) * cell - 1,
                (element["y"] + element["height"]) * cell - 1,
            ],
            fill=colors.get(element["type"], (120, 120, 120)),
        )
    for tile in level.get("tiles", []):
        draw.rectangle(
            [
                tile["x"] * cell,
                tile["y"] * cell,
                (tile["x"] + tile["width"]) * cell - 1,
                (tile["y"] + tile["height"]) * cell - 1,
            ],
            outline=(255, 255, 255),
            width=1,
        )
    for road_cell in level["road"]["cells"]:
        draw.rectangle(
            [
                road_cell["x"] * cell,
                road_cell["y"] * cell,
                (road_cell["x"] + 1) * cell - 1,
                (road_cell["y"] + 1) * cell - 1,
            ],
            fill=(170, 244, 255),
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path)
    print(f"Wrote preview {path}")


def save_level(path, level):
    data = load_database(path)
    upsert_level(data, level)
    write_database(path, data)


def load_database(path):
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    return {"schemaVersion": 1, "levels": []}


def upsert_level(data, level):
    levels = [item for item in data.get("levels", []) if item.get("level") != level["level"]]
    levels.append(level)
    data["schemaVersion"] = 1
    data["levels"] = sorted(levels, key=lambda item: item["level"])


def write_database(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def rect_cells(x, y, width, height):
    return {(xx, yy) for yy in range(y, y + height) for xx in range(x, x + width)}


def expand_cells(cells, gap):
    expanded = set()
    for x, y in cells:
        for yy in range(y - gap, y + gap + 1):
            for xx in range(x - gap, x + gap + 1):
                expanded.add((xx, yy))
    return expanded


def blocked_cells(elements):
    blocked = set()
    for element in elements:
        blocked.update(rect_cells(element["x"], element["y"], element["width"], element["height"]))
    return blocked


def road_cell_set(road):
    return {(cell["x"], cell["y"]) for cell in road["cells"]}


def shuffled_neighbors(rng, x, y):
    neighbors = [
        (x + 1, y, "east"),
        (x - 1, y, "west"),
        (x, y + 1, "south"),
        (x, y - 1, "north"),
    ]
    rng.shuffle(neighbors)
    return neighbors


def rebuild_path(came_from, current):
    path = []
    while current:
        path.append({"x": current[0], "y": current[1]})
        current = came_from[current]
    path.reverse()
    return path


def straight_run_sides(path, start_index, dx, dy):
    backward = 0
    for index in range(start_index, 0, -1):
        current = path[index]
        previous = path[index - 1]
        if current["x"] - previous["x"] != dx or current["y"] - previous["y"] != dy:
            break
        backward += 1
    forward = 0
    for index in range(start_index + 1, len(path)):
        current = path[index]
        previous = path[index - 1]
        if current["x"] - previous["x"] != dx or current["y"] - previous["y"] != dy:
            break
        forward += 1
    return backward, forward


def start_cell(rng, side, width, height):
    if side == "north":
        return {"x": rng.randint(6, width - 7), "y": 0}
    if side == "east":
        return {"x": width - 1, "y": rng.randint(6, height - 7)}
    if side == "south":
        return {"x": rng.randint(6, width - 7), "y": height - 1}
    return {"x": 0, "y": rng.randint(6, height - 7)}


def opposite_end_cell(rng, side, width, height):
    if side == "north":
        return {"x": rng.randint(6, width - 7), "y": height - 1}
    if side == "east":
        return {"x": 0, "y": rng.randint(6, height - 7)}
    if side == "south":
        return {"x": rng.randint(6, width - 7), "y": 0}
    return {"x": width - 1, "y": rng.randint(6, height - 7)}


def entry_direction(start, width, height):
    if start["y"] == 0:
        return "south"
    if start["x"] == width - 1:
        return "west"
    if start["y"] == height - 1:
        return "north"
    return "east"


def exit_direction(end, width, height):
    if end["y"] == 0:
        return "north"
    if end["x"] == width - 1:
        return "east"
    if end["y"] == height - 1:
        return "south"
    return "west"


def is_opposite(a, b):
    return (a, b) in {
        ("north", "south"),
        ("south", "north"),
        ("east", "west"),
        ("west", "east"),
    }


def turn_cost(current_direction, next_direction, straight, min_straight, turn_rate):
    if not current_direction or current_direction == next_direction:
        return 0
    preferred = max(min_straight, round(min_straight + (1 - turn_rate) * 8))
    if straight >= preferred:
        return 6 + (1 - turn_rate) * 18
    return 20 + (preferred - straight) * (8 + (1 - turn_rate) * 20)


def heuristic(state, end):
    return abs(state[0] - end["x"]) + abs(state[1] - end["y"])


def directional_cant(x, y, width, height):
    center_x = (width - 1) / 2
    center_y = (height - 1) / 2
    return {
        "x": round((x - center_x) / center_x, 4),
        "y": round((y - center_y) / center_y, 4),
    }


def title_case(value):
    return " ".join(part.capitalize() for part in value.replace("_", "-").split("-") if part)


if __name__ == "__main__":
    main()
