#!/usr/bin/env python3
import random
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, ttk
from types import SimpleNamespace

import levelGenerator

PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = PROJECT_ROOT / "src/game/TierOneLevels.json"
CELL_PREVIEW_MAX = 760


class LevelGeneratorUi:
    def __init__(self, root):
        self.root = root
        self.root.title("Endless Matrix Level Generator")
        self.root.minsize(1120, 760)

        self.level = None
        self.status = tk.StringVar(value="Randomize a candidate, then export it when the layout is worth keeping.")

        self.vars = {
            "level": tk.IntVar(value=1),
            "base_type": tk.StringVar(value="forest-lake"),
            "width": tk.IntVar(value=50),
            "height": tk.IntVar(value=50),
            "road_length": tk.IntVar(value=150),
            "turn_rate": tk.DoubleVar(value=0.42),
            "min_straight": tk.IntVar(value=5),
            "trees": tk.IntVar(value=20),
            "boulders": tk.IntVar(value=20),
            "lakes": tk.IntVar(value=1),
            "monoliths": tk.IntVar(value=2),
            "tiles": tk.IntVar(value=25),
            "seed": tk.StringVar(value=""),
        }

        self._build_layout()
        self.randomize()

    def _build_layout(self):
        shell = ttk.Frame(self.root, padding=12)
        shell.grid(row=0, column=0, sticky="nsew")
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)

        controls = ttk.Frame(shell)
        controls.grid(row=0, column=0, sticky="ns", padx=(0, 12))
        preview = ttk.Frame(shell)
        preview.grid(row=0, column=1, sticky="nsew")
        shell.columnconfigure(1, weight=1)
        shell.rowconfigure(0, weight=1)

        title = ttk.Label(controls, text="Tier 1 Map Authoring", font=("Segoe UI", 16, "bold"))
        title.grid(row=0, column=0, columnspan=2, sticky="w", pady=(0, 12))

        row = 1
        row = self._entry(controls, row, "Level", "level")
        row = self._entry(controls, row, "Base Type", "base_type")
        row = self._entry(controls, row, "Width", "width")
        row = self._entry(controls, row, "Height", "height")
        row = self._entry(controls, row, "Road Length", "road_length")
        row = self._slider(controls, row, "Turn Rate", "turn_rate", 0.0, 1.0)
        row = self._entry(controls, row, "Min Straight", "min_straight")
        row = self._entry(controls, row, "Trees", "trees")
        row = self._entry(controls, row, "Boulders", "boulders")
        row = self._entry(controls, row, "Lakes", "lakes")
        row = self._entry(controls, row, "Monoliths", "monoliths")
        row = self._entry(controls, row, "Tiles", "tiles")
        row = self._entry(controls, row, "Seed", "seed")

        buttons = ttk.Frame(controls)
        buttons.grid(row=row, column=0, columnspan=2, sticky="ew", pady=(12, 0))
        buttons.columnconfigure((0, 1), weight=1)

        ttk.Button(buttons, text="Randomize", command=self.randomize).grid(row=0, column=0, sticky="ew", padx=(0, 6))
        ttk.Button(buttons, text="Export Level", command=self.export_level).grid(row=0, column=1, sticky="ew")
        ttk.Button(buttons, text="Use New Seed", command=self.use_new_seed).grid(row=1, column=0, sticky="ew", pady=(8, 0), padx=(0, 6))
        ttk.Button(buttons, text="Seed All 100", command=self.seed_all).grid(row=1, column=1, sticky="ew", pady=(8, 0))

        self.metrics = ttk.Label(controls, text="", justify="left", wraplength=300)
        self.metrics.grid(row=row + 1, column=0, columnspan=2, sticky="ew", pady=(18, 0))

        ttk.Label(controls, textvariable=self.status, wraplength=300, foreground="#6a778a").grid(
            row=row + 2, column=0, columnspan=2, sticky="ew", pady=(14, 0)
        )

        self.canvas = tk.Canvas(preview, background="#05070b", highlightthickness=1, highlightbackground="#334155")
        self.canvas.grid(row=0, column=0, sticky="nsew")
        preview.columnconfigure(0, weight=1)
        preview.rowconfigure(0, weight=1)
        self.canvas.bind("<Configure>", lambda _event: self.draw_preview())

    def _entry(self, parent, row, label, key):
        ttk.Label(parent, text=label).grid(row=row, column=0, sticky="w", pady=4)
        ttk.Entry(parent, textvariable=self.vars[key], width=18).grid(row=row, column=1, sticky="ew", pady=4)
        return row + 1

    def _slider(self, parent, row, label, key, minimum, maximum):
        ttk.Label(parent, text=label).grid(row=row, column=0, sticky="w", pady=4)
        frame = ttk.Frame(parent)
        frame.grid(row=row, column=1, sticky="ew", pady=4)
        frame.columnconfigure(0, weight=1)
        ttk.Scale(frame, variable=self.vars[key], from_=minimum, to=maximum, orient="horizontal").grid(row=0, column=0, sticky="ew")
        ttk.Label(frame, textvariable=self.vars[key], width=5).grid(row=0, column=1, padx=(8, 0))
        return row + 1

    def randomize(self):
        try:
            args = self._args()
            self.level = levelGenerator.generate_level(args, args.level, seed=args.seed)
            self.status.set(f"Candidate generated. Seed {self.level['generator']['seed']}.")
            self._refresh_metrics()
            self.draw_preview()
        except Exception as exc:
            messagebox.showerror("Generation failed", str(exc))

    def use_new_seed(self):
        self.vars["seed"].set(str(random.randrange(1, 2_000_000_000)))
        self.randomize()

    def export_level(self):
        if not self.level:
            self.randomize()
        levelGenerator.save_level(DATA_PATH, self.level)
        self.status.set(f"Exported level {self.level['level']} to {DATA_PATH}.")

    def seed_all(self):
        if not messagebox.askyesno("Seed all Tier 1 levels", "Replace generated entries for all 100 Tier 1 levels?"):
            return

        base_args = self._args()
        data = levelGenerator.load_database(DATA_PATH)
        for level_number in range(1, 101):
            seed = (base_args.seed or 70000) + level_number * 997
            level = levelGenerator.generate_level(base_args, level_number, seed=seed)
            levelGenerator.upsert_level(data, level)
        levelGenerator.write_database(DATA_PATH, data)
        self.status.set(f"Seeded all 100 Tier 1 levels into {DATA_PATH}.")

    def draw_preview(self):
        if not self.level:
            return

        self.canvas.delete("all")
        width = self.level["dimensions"]["width"]
        height = self.level["dimensions"]["height"]
        canvas_width = max(1, self.canvas.winfo_width())
        canvas_height = max(1, self.canvas.winfo_height())
        cell = max(3, min(CELL_PREVIEW_MAX / width, CELL_PREVIEW_MAX / height, canvas_width / width, canvas_height / height))
        offset_x = (canvas_width - width * cell) / 2
        offset_y = (canvas_height - height * cell) / 2

        self._rect(offset_x, offset_y, width * cell, height * cell, "#08111d", "#334155")
        for x in range(width + 1):
            pos = offset_x + x * cell
            self.canvas.create_line(pos, offset_y, pos, offset_y + height * cell, fill="#132033")
        for y in range(height + 1):
            pos = offset_y + y * cell
            self.canvas.create_line(offset_x, pos, offset_x + width * cell, pos, fill="#132033")

        for element in self.level["elements"]:
            fill = {"tree": "#4f9a54", "boulder": "#6f7482", "lake": "#2367a8", "monolith": "#e2e8f0"}.get(element["type"], "#64748b")
            outline = {"tree": "#8fe388", "boulder": "#cbd5e1", "lake": "#60acff", "monolith": "#ffffff"}.get(element["type"], "#cbd5e1")
            self._cell_rect(element["x"], element["y"], element["width"], element["height"], cell, offset_x, offset_y, fill, outline)

        for tile in self.level.get("tiles", []):
            self._cell_rect(tile["x"], tile["y"], tile["width"], tile["height"], cell, offset_x, offset_y, "", "#ffffff")

        road = self.level["road"]["cells"]
        if len(road) > 1:
            points = []
            for point in road:
                points.extend([offset_x + (point["x"] + 0.5) * cell, offset_y + (point["y"] + 0.5) * cell])
            self.canvas.create_line(*points, fill="#aaf4ff", width=max(2, cell * 0.6), capstyle="butt", joinstyle="miter")
            self.canvas.create_line(*points, fill="#ffffff", width=max(1, cell * 0.16), capstyle="butt", joinstyle="miter")

    def _cell_rect(self, x, y, width, height, cell, offset_x, offset_y, fill, outline):
        self._rect(offset_x + x * cell, offset_y + y * cell, width * cell, height * cell, fill, outline)

    def _rect(self, x, y, width, height, fill, outline):
        self.canvas.create_rectangle(x, y, x + width, y + height, fill=fill, outline=outline)

    def _refresh_metrics(self):
        road_count = len(self.level["road"]["cells"])
        counts = {}
        for element in self.level["elements"]:
            counts[element["type"]] = counts.get(element["type"], 0) + 1
        self.metrics.config(text=(
            f"Level: {self.level['level']}\n"
            f"Dimensions: {self.level['dimensions']['width']} x {self.level['dimensions']['height']}\n"
            f"Road: {road_count} / {self.level['road']['targetLength']} cells\n"
            f"Tiles: {len(self.level.get('tiles', []))}\n"
            f"Trees: {counts.get('tree', 0)}   Boulders: {counts.get('boulder', 0)}   Lakes: {counts.get('lake', 0)}   Monoliths: {counts.get('monolith', 0)}"
        ))

    def _args(self):
        seed_text = self.vars["seed"].get().strip()
        seed = int(seed_text) if seed_text else random.randrange(1, 2_000_000_000)
        self.vars["seed"].set(str(seed))
        return SimpleNamespace(
            level=max(1, min(100, self.vars["level"].get())),
            base_type=self.vars["base_type"].get().strip() or "forest-lake",
            width=max(18, self.vars["width"].get()),
            height=max(18, self.vars["height"].get()),
            road_length=max(12, self.vars["road_length"].get()),
            turn_rate=max(0.0, min(1.0, self.vars["turn_rate"].get())),
            min_straight=max(2, self.vars["min_straight"].get()),
            trees=max(0, self.vars["trees"].get()),
            boulders=max(0, self.vars["boulders"].get()),
            lakes=max(0, self.vars["lakes"].get()),
            monoliths=max(0, self.vars["monoliths"].get()),
            tiles=max(0, self.vars["tiles"].get()),
            seed=seed,
        )


if __name__ == "__main__":
    root = tk.Tk()
    LevelGeneratorUi(root)
    root.mainloop()
