#!/usr/bin/env python3
import json
import subprocess
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, simpledialog, ttk

PROJECT_ROOT = Path(__file__).resolve().parents[1]
TUNING_PATH = PROJECT_ROOT / "src/game/TowerTuning.json"
RESEARCH_PATH = PROJECT_ROOT / "src/game/ResearchRegistry.json"
RARITIES = ["common", "uncommon", "rare", "epic", "legendary"]
RESEARCH_SECTIONS = ["statMultipliers", "statAdd", "statOverrides", "effects"]

COLORS = {
    "bg": "#0b1020",
    "panel": "#111827",
    "panel2": "#172033",
    "card": "#0f172a",
    "card2": "#18243a",
    "text": "#e5edf8",
    "muted": "#93a4b8",
    "dim": "#64748b",
    "accent": "#38bdf8",
    "accent2": "#22c55e",
    "danger": "#ef4444",
    "border": "#263246",
    "entry": "#07111f",
}

RARITY_COLORS = {
    "common": "#f8fafc",
    "uncommon": "#90de78",
    "rare": "#60acff",
    "epic": "#b166ff",
    "legendary": "#ffb636",
}

SECTION_LABELS = {
    "statMultipliers": ("Stat Multipliers", "Scales existing stats. 0.7 attack interval means 30 percent faster. 1.3 means 30 percent slower."),
    "statAdd": ("Flat Stat Bonuses", "Adds directly to an existing stat. Use this for simple flat boosts."),
    "statOverrides": ("Stat Overrides", "Replaces the base stat entirely while this research is active."),
    "effects": ("Special Numeric Effects", "Numbers used by special behavior. The behavior stays hardcoded; these values tune it."),
    "combat": ("Tower Rules", "Shared numeric behavior for this tower type."),
    "rarities": ("Base Stats", "Stats for the selected tower rarity before research is applied."),
}

FIELD_META = {
    "placementCost": ("Resource Cost", "Resources required to place or upgrade to this rarity.", "resources", 5),
    "rangeCells": ("Range", "How many grid cells the tower can reach.", "cells", 0.5),
    "damage": ("Damage", "Base damage per shot or missile before research effects.", "damage", 5),
    "attackInterval": ("Fire Delay", "Seconds between attacks. Lower is faster; higher is slower.", "seconds", 0.05),
    "rarityMultiplier": ("Factory Yield Multiplier", "Factory resource output multiplier for this rarity.", "x", 0.25),
    "revealDuration": ("Reveal Duration", "Seconds a radar keeps a cloaked raider revealed.", "seconds", 0.5),
    "missileDuration": ("Missile Travel Time", "Seconds a missile takes before lock-on speed modifiers.", "seconds", 0.25),
    "shieldDamageMultiplier": ("Shield Damage Multiplier", "Multiplier applied when damage hits shields.", "x", 0.1),
    "projectileDurationMs": ("Projectile Visual Speed", "Projectile animation duration. Lower looks faster.", "ms", 5),
    "muzzleDurationMs": ("Muzzle Flash Duration", "How long the muzzle flash visual lasts.", "ms", 5),
    "penetrationChance": ("Spread Shot Chance", "Chance per shot to damage nearby raiders.", "0-1", 0.05),
    "penetrationRadiusCells": ("Spread Radius", "Spread shot radius measured in grid cells.", "cells", 0.25),
    "penetrationDamageMultiplier": ("Spread Damage Multiplier", "Damage multiplier used for the spread hit.", "x", 0.1),
    "criticalChance": ("Critical Chance", "Chance per hit to apply critical damage.", "0-1", 0.05),
    "criticalDamageMultiplier": ("Critical Damage Multiplier", "Damage multiplier when a critical hit triggers.", "x", 0.25),
    "airburstEnabled": ("Airburst Enabled", "1 enables airburst bombs. 0 disables them.", "0/1", 1),
    "airburstBombCount": ("Airburst Bomb Count", "Number of bombs dropped per cannon shot.", "bombs", 1),
    "airburstBombDamageMultiplier": ("Bomb Damage Multiplier", "Each bomb deals this fraction of the shot damage.", "x", 0.05),
    "airburstBombRadiusCells": ("Bomb Radius", "Explosion radius in grid cells.", "cells", 0.25),
    "airburstBombDelaySeconds": ("Bomb Delay", "Seconds before each airburst bomb detonates.", "seconds", 0.05),
    "freezeSpeedMultipliers": ("Freeze Speed By Rarity", "Lower values slow raiders harder. 0 means stopped.", "map", 0.05),
    "freezeDurations": ("Freeze Duration By Rarity", "Seconds a raygun freeze lasts by rarity.", "map", 1),
    "fastEnemySlowBonus": ("Fast Enemy Slow Bonus", "Extra slow against fast cars and jets. 0.6 means 60 percent more slow.", "0-1", 0.05),
    "slowBonus": ("Slow Bonus", "Extra slow applied to every raygun freeze.", "0-1", 0.05),
    "brittleDamageMultiplier": ("Embrittled Damage Multiplier", "Damage multiplier when hitting a frozen embrittled raider.", "x", 0.25),
    "freezeSpeedMultiplierOverride": ("Freeze Speed Override", "Overrides freeze speed. 0 fully stops the raider.", "speed", 0.05),
    "missileSpeedMultiplier": ("Missile Speed Multiplier", "Higher values make missiles reach targets faster.", "x", 0.1),
    "factoryYieldMultiplier": ("Factory Output Multiplier", "Multiplies factory resource output.", "x", 0.1),
    "damageRefundMultiplier": ("Emergency Refund Multiplier", "Resources refunded per point of player damage.", "x", 0.1),
    "upgradeDiscount": ("Upgrade Discount", "Resources removed from upgrade costs while Assembly Line is active.", "resources", 1),
    "coinsPerWave": ("Coins Per Wave", "Coins staged into hidden coin yield each wave.", "coins", 1),
    "gemChancePerWave": ("Gem Chance Per Wave", "Chance each wave to mine a random gem.", "0-1", 0.05),
    "auraAttackIntervalMultiplier": ("Aura Fire Delay Multiplier", "Multiplies fire delay for towers in range. 0.8 means 20 percent faster.", "x", 0.05),
    "auraRangeMultiplier": ("Aura Range Multiplier", "Multiplies range for towers in range. 1.5 means 50 percent more range.", "x", 0.05),
    "railgunProgressThreshold": ("Railgun Exit Threshold", "Progress to the exit required before Railgun executes a raider. 0.99 means 99 percent.", "0-1", 0.01),
}


class TowerTweaker:
    def __init__(self, root):
        self.root = root
        self.root.title("Endless Matrix Tower Tweaker")
        self.root.minsize(1220, 780)
        self.root.configure(bg=COLORS["bg"])

        self.status = tk.StringVar(value="Ready. Edit numbers, save tuning, then build Pages when you want dist/docs refreshed.")
        self.tuning = self._load_json(TUNING_PATH)
        self.registry = self._load_json(RESEARCH_PATH)
        self._sync_missing_research()

        tower_ids = list(self.tuning.get("towers", {}).keys())
        self.tower_var = tk.StringVar(value=tower_ids[0] if tower_ids else "")
        self.rarity_var = tk.StringVar(value="common")
        self.research_var = tk.StringVar(value="")
        self.field_vars = {}
        self.active_mode = "base"

        self._configure_style()
        self._build_layout()
        self._refresh_research_options()
        self._render_base_fields()

    def _configure_style(self):
        style = ttk.Style()
        style.theme_use("clam")
        style.configure(".", background=COLORS["panel"], foreground=COLORS["text"], fieldbackground=COLORS["entry"], bordercolor=COLORS["border"], lightcolor=COLORS["border"], darkcolor=COLORS["border"])
        style.configure("TFrame", background=COLORS["panel"])
        style.configure("Shell.TFrame", background=COLORS["bg"])
        style.configure("Card.TFrame", background=COLORS["card"], relief="flat")
        style.configure("Soft.TFrame", background=COLORS["panel2"])
        style.configure("TLabel", background=COLORS["panel"], foreground=COLORS["text"])
        style.configure("Muted.TLabel", background=COLORS["panel"], foreground=COLORS["muted"])
        style.configure("Card.TLabel", background=COLORS["card"], foreground=COLORS["text"])
        style.configure("CardMuted.TLabel", background=COLORS["card"], foreground=COLORS["muted"])
        style.configure("Title.TLabel", background=COLORS["bg"], foreground=COLORS["text"], font=("Segoe UI", 18, "bold"))
        style.configure("Section.TLabel", background=COLORS["panel"], foreground=COLORS["text"], font=("Segoe UI", 12, "bold"))
        style.configure("TButton", background=COLORS["panel2"], foreground=COLORS["text"], borderwidth=1, focusthickness=0, padding=(10, 7))
        style.map("TButton", background=[("active", COLORS["card2"])], foreground=[("disabled", COLORS["dim"])])
        style.configure("Accent.TButton", background=COLORS["accent"], foreground="#03111f", font=("Segoe UI", 9, "bold"))
        style.map("Accent.TButton", background=[("active", "#7dd3fc")])
        style.configure("Danger.TButton", background="#3a1720", foreground="#fecdd3")
        style.configure("TCombobox", selectbackground=COLORS["entry"], fieldbackground=COLORS["entry"], background=COLORS["entry"], foreground=COLORS["text"], arrowcolor=COLORS["accent"])
        style.configure("TNotebook", background=COLORS["panel"], borderwidth=0)
        style.configure("TNotebook.Tab", background=COLORS["card"], foreground=COLORS["muted"], padding=(16, 9), borderwidth=0)
        style.map("TNotebook.Tab", background=[("selected", COLORS["panel2"])], foreground=[("selected", COLORS["text"])])
        style.configure("Vertical.TScrollbar", background=COLORS["panel2"], troughcolor=COLORS["bg"], bordercolor=COLORS["border"], arrowcolor=COLORS["muted"])

    def _build_layout(self):
        shell = ttk.Frame(self.root, padding=16, style="Shell.TFrame")
        shell.grid(row=0, column=0, sticky="nsew")
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)

        sidebar = ttk.Frame(shell, padding=14, style="Soft.TFrame")
        sidebar.grid(row=0, column=0, sticky="ns", padx=(0, 14))
        editor = ttk.Frame(shell, padding=0)
        editor.grid(row=0, column=1, sticky="nsew")
        shell.columnconfigure(1, weight=1)
        shell.rowconfigure(0, weight=1)

        tk.Label(sidebar, text="Tower Tweaker", bg=COLORS["panel2"], fg=COLORS["text"], font=("Segoe UI", 18, "bold")).grid(row=0, column=0, sticky="w")
        tk.Label(sidebar, text="Balance editor for source JSON", bg=COLORS["panel2"], fg=COLORS["muted"], font=("Segoe UI", 9)).grid(row=1, column=0, sticky="w", pady=(2, 14))

        ttk.Label(sidebar, text="Tower", style="Muted.TLabel").grid(row=2, column=0, sticky="w")
        self.tower_combo = ttk.Combobox(sidebar, textvariable=self.tower_var, values=list(self.tuning["towers"].keys()), state="readonly", width=26)
        self.tower_combo.grid(row=3, column=0, sticky="ew", pady=(4, 12))
        self.tower_combo.bind("<<ComboboxSelected>>", lambda _event: self._tower_changed())

        ttk.Button(sidebar, text="Save Tuning", style="Accent.TButton", command=self.save).grid(row=4, column=0, sticky="ew", pady=(8, 0))
        ttk.Button(sidebar, text="Build Pages", command=self.build_pages).grid(row=5, column=0, sticky="ew", pady=(8, 0))
        ttk.Button(sidebar, text="Show Tuning Diff", command=self.open_diff).grid(row=6, column=0, sticky="ew", pady=(8, 0))
        ttk.Button(sidebar, text="Reload From Disk", command=self.reload).grid(row=7, column=0, sticky="ew", pady=(8, 0))

        guide = tk.Frame(sidebar, bg=COLORS["card"], highlightbackground=COLORS["border"], highlightthickness=1)
        guide.grid(row=8, column=0, sticky="ew", pady=(18, 0))
        tk.Label(guide, text="How to read values", bg=COLORS["card"], fg=COLORS["text"], font=("Segoe UI", 10, "bold")).pack(anchor="w", padx=12, pady=(10, 2))
        tk.Label(guide, text="Multipliers: 1 is unchanged, 0.7 is 30 percent lower, 1.3 is 30 percent higher.\nChances: 0.2 means 20 percent.\nFire Delay: lower is faster.", bg=COLORS["card"], fg=COLORS["muted"], justify="left", wraplength=240).pack(anchor="w", padx=12, pady=(0, 12))

        ttk.Label(sidebar, textvariable=self.status, wraplength=260, style="Muted.TLabel").grid(row=9, column=0, sticky="ew", pady=(16, 0))
        sidebar.columnconfigure(0, weight=1)

        tk.Label(editor, text="Tower Balance", bg=COLORS["panel"], fg=COLORS["text"], font=("Segoe UI", 20, "bold")).grid(row=0, column=0, sticky="w", padx=4)
        self.context_label = tk.Label(editor, text="", bg=COLORS["panel"], fg=COLORS["muted"], font=("Segoe UI", 10))
        self.context_label.grid(row=1, column=0, sticky="w", padx=4, pady=(2, 12))

        self.tabs = ttk.Notebook(editor)
        self.tabs.grid(row=2, column=0, sticky="nsew")
        editor.columnconfigure(0, weight=1)
        editor.rowconfigure(2, weight=1)

        self.base_tab = ttk.Frame(self.tabs, padding=14)
        self.rules_tab = ttk.Frame(self.tabs, padding=14)
        self.research_tab = ttk.Frame(self.tabs, padding=14)
        self.tabs.add(self.base_tab, text="Base Stats")
        self.tabs.add(self.rules_tab, text="Tower Rules")
        self.tabs.add(self.research_tab, text="Research")
        self.tabs.bind("<<NotebookTabChanged>>", lambda _event: self._tab_changed())

        self._build_base_tab()
        self._build_rules_tab()
        self._build_research_tab()

    def _build_base_tab(self):
        header = ttk.Frame(self.base_tab)
        header.grid(row=0, column=0, sticky="ew")
        ttk.Label(header, text="Rarity to edit", style="Muted.TLabel").grid(row=0, column=0, sticky="w")
        self.rarity_buttons = {}
        for index, rarity in enumerate(RARITIES):
            button = tk.Button(
                header,
                text=rarity.title(),
                command=lambda value=rarity: self._select_rarity(value),
                bg=COLORS["card"],
                fg=RARITY_COLORS[rarity],
                activebackground=COLORS["card2"],
                activeforeground=RARITY_COLORS[rarity],
                relief="flat",
                padx=12,
                pady=7,
                highlightthickness=1,
                highlightbackground=COLORS["border"],
            )
            button.grid(row=1, column=index, sticky="ew", padx=(0 if index == 0 else 6, 0), pady=(6, 0))
            self.rarity_buttons[rarity] = button
            header.columnconfigure(index, weight=1)

        self.base_fields = self._scroll_frame(self.base_tab, row=1)
        ttk.Button(self.base_tab, text="Add Custom Base Stat", command=lambda: self._add_field("base")).grid(row=2, column=0, sticky="w", pady=(10, 0))
        self.base_tab.columnconfigure(0, weight=1)
        self.base_tab.rowconfigure(1, weight=1)

    def _build_rules_tab(self):
        self.rules_fields = self._scroll_frame(self.rules_tab, row=0)
        ttk.Button(self.rules_tab, text="Add Custom Tower Rule", command=lambda: self._add_field("rules")).grid(row=1, column=0, sticky="w", pady=(10, 0))
        self.rules_tab.columnconfigure(0, weight=1)
        self.rules_tab.rowconfigure(0, weight=1)

    def _build_research_tab(self):
        layout = ttk.Frame(self.research_tab)
        layout.grid(row=0, column=0, sticky="nsew")
        self.research_tab.columnconfigure(0, weight=1)
        self.research_tab.rowconfigure(0, weight=1)
        layout.columnconfigure(1, weight=1)
        layout.rowconfigure(0, weight=1)

        left = ttk.Frame(layout, padding=(0, 0, 14, 0))
        left.grid(row=0, column=0, sticky="ns")
        tk.Label(left, text="Research Node", bg=COLORS["panel"], fg=COLORS["muted"], font=("Segoe UI", 9, "bold")).pack(anchor="w", pady=(0, 8))
        self.research_list = tk.Listbox(
            left,
            width=28,
            bg=COLORS["entry"],
            fg=COLORS["text"],
            selectbackground=COLORS["accent"],
            selectforeground="#03111f",
            highlightthickness=1,
            highlightbackground=COLORS["border"],
            relief="flat",
            activestyle="none",
            exportselection=False,
            font=("Segoe UI", 10),
        )
        self.research_list.pack(fill="y", expand=True)
        self.research_list.bind("<<ListboxSelect>>", lambda _event: self._research_selected())

        right = ttk.Frame(layout)
        right.grid(row=0, column=1, sticky="nsew")
        right.columnconfigure(0, weight=1)
        right.rowconfigure(2, weight=1)
        self.research_title = tk.Label(right, text="", bg=COLORS["panel"], fg=COLORS["text"], font=("Segoe UI", 16, "bold"))
        self.research_title.grid(row=0, column=0, sticky="w")
        self.research_detail = tk.Label(right, text="", bg=COLORS["panel"], fg=COLORS["muted"], justify="left", wraplength=760)
        self.research_detail.grid(row=1, column=0, sticky="ew", pady=(3, 10))
        self.research_fields = self._scroll_frame(right, row=2)
        ttk.Button(right, text="Add Custom Research Tuning", command=lambda: self._add_field("research")).grid(row=3, column=0, sticky="w", pady=(10, 0))

    def _scroll_frame(self, parent, row):
        outer = ttk.Frame(parent)
        outer.grid(row=row, column=0, sticky="nsew", pady=(12, 0))
        canvas = tk.Canvas(outer, bg=COLORS["panel"], highlightthickness=0)
        scrollbar = ttk.Scrollbar(outer, orient="vertical", command=canvas.yview)
        inner = ttk.Frame(canvas)
        window_id = canvas.create_window((0, 0), window=inner, anchor="nw")
        inner.bind("<Configure>", lambda _event: canvas.configure(scrollregion=canvas.bbox("all")))
        canvas.bind("<Configure>", lambda event: canvas.itemconfigure(window_id, width=event.width))
        canvas.configure(yscrollcommand=scrollbar.set)
        canvas.grid(row=0, column=0, sticky="nsew")
        scrollbar.grid(row=0, column=1, sticky="ns")
        outer.columnconfigure(0, weight=1)
        outer.rowconfigure(0, weight=1)
        return inner

    def _tower_changed(self):
        self._commit_fields()
        self._refresh_research_options()
        self._render_active_tab()

    def _tab_changed(self):
        self._commit_fields()
        selected = self.tabs.index(self.tabs.select())
        self.active_mode = ["base", "rules", "research"][selected]
        self._render_active_tab()

    def _render_active_tab(self):
        if self.active_mode == "research":
            self._render_research_fields()
        elif self.active_mode == "rules":
            self._render_rules_fields()
        else:
            self._render_base_fields()

    def _refresh_context(self):
        tower_id = self.tower_var.get()
        tower_label = self.registry.get("definitions", {}).get(tower_id, {}).get("label", tower_id.title())
        self.context_label.configure(text=f"Editing {tower_label}. Changes save to src/game/TowerTuning.json.")

    def _select_rarity(self, rarity):
        self.rarity_var.set(rarity)
        self._render_base_fields()

    def _refresh_research_options(self):
        self._refresh_context()
        self.research_list.delete(0, "end")
        tower_id = self.tower_var.get()
        nodes = self.registry.get("definitions", {}).get(tower_id, {}).get("nodes", {})
        values = list(nodes.keys())
        for research_id in values:
            node = nodes[research_id]
            self.research_list.insert("end", node.get("label", research_id))
        if values:
            if self.research_var.get() not in values:
                self.research_var.set(values[0])
            self.research_list.selection_clear(0, "end")
            self.research_list.selection_set(values.index(self.research_var.get()))
            self.research_list.activate(values.index(self.research_var.get()))
        else:
            self.research_var.set("")

    def _research_selected(self):
        tower_id = self.tower_var.get()
        nodes = list(self.registry.get("definitions", {}).get(tower_id, {}).get("nodes", {}).keys())
        selection = self.research_list.curselection()
        if not selection or selection[0] >= len(nodes):
            return
        self.research_var.set(nodes[selection[0]])
        self._render_research_fields()

    def _render_base_fields(self):
        self._commit_fields()
        self.active_mode = "base"
        self._refresh_context()
        self._clear(self.base_fields)
        for rarity, button in self.rarity_buttons.items():
            selected = rarity == self.rarity_var.get()
            button.configure(bg=COLORS["card2"] if selected else COLORS["card"], highlightbackground=RARITY_COLORS[rarity] if selected else COLORS["border"])

        tower_id = self.tower_var.get()
        rarity = self.rarity_var.get()
        values = self.tuning["towers"].setdefault(tower_id, {}).setdefault("rarities", {}).setdefault(rarity, {})
        self._section(self.base_fields, SECTION_LABELS["rarities"][0], f"{rarity.title()} rarity values. These are the stats before research modifies them.", 0)
        self._render_value_fields(self.base_fields, ["towers", tower_id, "rarities", rarity], values, start_row=1)

    def _render_rules_fields(self):
        self._commit_fields()
        self.active_mode = "rules"
        self._refresh_context()
        self._clear(self.rules_fields)
        tower_id = self.tower_var.get()
        combat = self.tuning["towers"].setdefault(tower_id, {}).setdefault("combat", {})
        self._section(self.rules_fields, SECTION_LABELS["combat"][0], SECTION_LABELS["combat"][1], 0)
        if combat:
            self._render_value_fields(self.rules_fields, ["towers", tower_id, "combat"], combat, start_row=1)
        else:
            self._empty(self.rules_fields, "This tower has no shared tower-rule numbers yet.", 1)

    def _render_research_fields(self):
        self._commit_fields()
        self.active_mode = "research"
        self._refresh_context()
        self._clear(self.research_fields)
        tower_id = self.tower_var.get()
        research_id = self.research_var.get()
        node = self.registry.get("definitions", {}).get(tower_id, {}).get("nodes", {}).get(research_id)
        if not research_id or not node:
            self.research_title.configure(text="No research for this tower")
            self.research_detail.configure(text="This tower does not currently define research nodes.")
            self._empty(self.research_fields, "No research nodes for this tower.", 0)
            return

        self.research_title.configure(text=node.get("label", research_id))
        self.research_detail.configure(text=f"{node.get('summary', '')}\n{node.get('detail', '')}")
        research = self.tuning["towers"].setdefault(tower_id, {}).setdefault("research", {}).setdefault(research_id, {})
        row = 0
        for section in RESEARCH_SECTIONS:
            title, detail = SECTION_LABELS[section]
            values = research.setdefault(section, {})
            self._section(self.research_fields, title, detail, row)
            row += 1
            if values:
                row = self._render_value_fields(self.research_fields, ["towers", tower_id, "research", research_id, section], values, start_row=row)
            else:
                row = self._empty(self.research_fields, "No values in this section.", row)

    def _section(self, parent, title, detail, row):
        frame = tk.Frame(parent, bg=COLORS["panel"])
        frame.grid(row=row, column=0, sticky="ew", pady=(0 if row == 0 else 16, 8))
        tk.Label(frame, text=title, bg=COLORS["panel"], fg=COLORS["text"], font=("Segoe UI", 13, "bold")).pack(anchor="w")
        tk.Label(frame, text=detail, bg=COLORS["panel"], fg=COLORS["muted"], justify="left", wraplength=820).pack(anchor="w", pady=(2, 0))
        parent.columnconfigure(0, weight=1)

    def _empty(self, parent, message, row):
        frame = tk.Frame(parent, bg=COLORS["card"], highlightbackground=COLORS["border"], highlightthickness=1)
        frame.grid(row=row, column=0, sticky="ew", pady=(0, 8))
        tk.Label(frame, text=message, bg=COLORS["card"], fg=COLORS["dim"], padx=12, pady=10).pack(anchor="w")
        return row + 1

    def _render_value_fields(self, parent, path, values, start_row=0):
        row = start_row
        for key in sorted(values.keys(), key=self._field_sort_key):
            value = values[key]
            if isinstance(value, dict):
                title, desc, _unit, _step = self._field_meta(key)
                self._section(parent, title, desc, row)
                row += 1
                for child_key in sorted(value.keys(), key=self._field_sort_key):
                    row = self._field_row(parent, path + [key], child_key, value[child_key], row, parent_key=key)
            else:
                row = self._field_row(parent, path, key, value, row)
        parent.columnconfigure(0, weight=1)
        return row

    def _field_row(self, parent, path, key, value, row, parent_key=None):
        title, desc, unit, step = self._field_meta(key, parent_key)
        full_path = tuple(path + [key])
        var = tk.StringVar(value=self._format_number(value))
        self.field_vars[full_path] = var

        card = tk.Frame(parent, bg=COLORS["card"], highlightbackground=COLORS["border"], highlightthickness=1)
        card.grid(row=row, column=0, sticky="ew", pady=(0, 8))
        card.columnconfigure(0, weight=1)

        left = tk.Frame(card, bg=COLORS["card"])
        left.grid(row=0, column=0, sticky="ew", padx=12, pady=10)
        label_text = title if not parent_key else f"{title}: {key.title()}"
        tk.Label(left, text=label_text, bg=COLORS["card"], fg=COLORS["text"], font=("Segoe UI", 10, "bold")).pack(anchor="w")
        raw_path = ".".join(str(part) for part in full_path[2:])
        tk.Label(left, text=f"{desc}  Path: {raw_path}", bg=COLORS["card"], fg=COLORS["muted"], justify="left", wraplength=650).pack(anchor="w", pady=(2, 0))

        controls = tk.Frame(card, bg=COLORS["card"])
        controls.grid(row=0, column=1, sticky="e", padx=12, pady=10)
        tk.Button(controls, text="-", command=lambda p=full_path, s=step: self._nudge(p, -s), bg=COLORS["panel2"], fg=COLORS["text"], activebackground=COLORS["card2"], relief="flat", width=3).grid(row=0, column=0, padx=(0, 4))
        entry = tk.Entry(controls, textvariable=var, bg=COLORS["entry"], fg=COLORS["text"], insertbackground=COLORS["text"], relief="flat", width=12, justify="right")
        entry.grid(row=0, column=1, padx=(0, 6), ipady=5)
        tk.Button(controls, text="+", command=lambda p=full_path, s=step: self._nudge(p, s), bg=COLORS["panel2"], fg=COLORS["text"], activebackground=COLORS["card2"], relief="flat", width=3).grid(row=0, column=2, padx=(0, 8))
        tk.Label(controls, text=unit, bg=COLORS["card"], fg=COLORS["dim"], width=9, anchor="w").grid(row=0, column=3, sticky="w")
        tk.Button(controls, text="Remove", command=lambda p=full_path: self._remove_field(p), bg="#351722", fg="#fecdd3", activebackground="#4a1d2b", activeforeground="#fecdd3", relief="flat").grid(row=0, column=4, padx=(8, 0), ipady=3)
        return row + 1

    def _field_meta(self, key, parent_key=None):
        if parent_key in ("freezeSpeedMultipliers", "freezeDurations"):
            title, desc, unit, step = FIELD_META[parent_key]
            return title, desc, "seconds" if parent_key == "freezeDurations" else "speed", step
        if key in FIELD_META:
            return FIELD_META[key]
        friendly = key.replace("_", " ").replace("-", " ").title()
        return friendly, "Custom numeric field. The runtime will use it only if code reads this key.", "value", 0.1

    def _field_sort_key(self, key):
        preferred = [
            "placementCost", "damage", "rangeCells", "attackInterval", "rarityMultiplier", "revealDuration", "missileDuration",
            "shieldDamageMultiplier", "projectileDurationMs", "freezeSpeedMultipliers", "freezeDurations",
        ]
        return (preferred.index(key) if key in preferred else 999, key)

    def _nudge(self, path, delta):
        self._commit_one(path)
        target = self._get_parent_for_path(path)
        if target is None:
            return
        current = float(target.get(path[-1], 0))
        next_value = current + delta
        if abs(next_value) < 1e-9:
            next_value = 0
        target[path[-1]] = int(next_value) if float(next_value).is_integer() else round(next_value, 6)
        var = self.field_vars.get(path)
        if var:
            var.set(self._format_number(target[path[-1]]))

    def _add_field(self, mode):
        self._commit_fields()
        if mode == "base":
            target = self.tuning["towers"][self.tower_var.get()]["rarities"][self.rarity_var.get()]
            self._add_field_to_target(target, "Add base stat", "Example: damage, rangeCells, attackInterval")
            self._render_base_fields()
            return
        if mode == "rules":
            target = self.tuning["towers"][self.tower_var.get()].setdefault("combat", {})
            self._add_field_to_target(target, "Add tower rule", "Example: shieldDamageMultiplier, projectileDurationMs")
            self._render_rules_fields()
            return

        section = self._choose_section()
        if not section:
            return
        research = self.tuning["towers"][self.tower_var.get()]["research"][self.research_var.get()]
        target = research.setdefault(section, {})
        self._add_field_to_target(target, f"Add {SECTION_LABELS[section][0]}", "Example: attackInterval, penetrationChance, shieldDamageMultiplier")
        self._render_research_fields()

    def _add_field_to_target(self, target, title, prompt):
        key = simpledialog.askstring(title, f"Field name\n{prompt}:")
        if not key:
            return
        value = self._ask_number("Field value")
        if value is None:
            return
        target[key] = value

    def _choose_section(self):
        dialog = tk.Toplevel(self.root)
        dialog.title("Choose Research Section")
        dialog.configure(bg=COLORS["bg"])
        dialog.resizable(False, False)
        choice = tk.StringVar(value=RESEARCH_SECTIONS[0])
        tk.Label(dialog, text="Where should this number live?", bg=COLORS["bg"], fg=COLORS["text"], font=("Segoe UI", 12, "bold")).pack(anchor="w", padx=16, pady=(16, 8))
        for section in RESEARCH_SECTIONS:
            title, detail = SECTION_LABELS[section]
            tk.Radiobutton(dialog, text=f"{title}\n{detail}", variable=choice, value=section, bg=COLORS["bg"], fg=COLORS["text"], selectcolor=COLORS["entry"], activebackground=COLORS["bg"], activeforeground=COLORS["text"], justify="left", wraplength=520).pack(anchor="w", padx=16, pady=4)
        result = {"value": None}
        tk.Button(dialog, text="Continue", command=lambda: (result.update(value=choice.get()), dialog.destroy()), bg=COLORS["accent"], fg="#03111f", relief="flat", padx=12, pady=7).pack(anchor="e", padx=16, pady=16)
        dialog.grab_set()
        self.root.wait_window(dialog)
        return result["value"]

    def _remove_field(self, path):
        self._commit_fields()
        target = self._get_parent_for_path(path)
        if target and path[-1] in target:
            del target[path[-1]]
        self._render_active_tab()

    def _commit_one(self, path):
        var = self.field_vars.get(path)
        if not var:
            return
        target = self._get_parent_for_path(path)
        if target is None:
            return
        target[path[-1]] = self._parse_number(var.get(), ".".join(path))

    def _commit_fields(self):
        if not hasattr(self, "field_vars"):
            return
        for path in list(self.field_vars.keys()):
            self._commit_one(path)
        self.field_vars.clear()

    def _get_parent_for_path(self, path):
        if path[0] != "towers":
            return None
        target = self.tuning.setdefault("towers", {}).setdefault(path[1], {})
        for part in path[2:-1]:
            target = target.setdefault(part, {})
        return target

    def save(self):
        try:
            self._commit_fields()
            self._sync_missing_research()
            TUNING_PATH.write_text(json.dumps(self.tuning, indent=2) + "\n", encoding="utf-8")
            self.status.set(f"Saved {TUNING_PATH}.")
            self._render_active_tab()
        except Exception as exc:
            messagebox.showerror("Save failed", str(exc))

    def build_pages(self):
        self.save()
        try:
            result = subprocess.run(["npm", "run", "build:pages"], cwd=PROJECT_ROOT, check=True, capture_output=True, text=True, shell=False)
            self.status.set("Built Pages output into dist/ and docs/.")
            if result.stderr.strip():
                print(result.stderr)
        except Exception as exc:
            messagebox.showerror("Build failed", str(exc))

    def open_diff(self):
        try:
            result = subprocess.run(["git", "diff", "--", str(TUNING_PATH.relative_to(PROJECT_ROOT))], cwd=PROJECT_ROOT, check=False, capture_output=True, text=True)
            self._show_text_window("TowerTuning diff", result.stdout or "No TowerTuning.json diff.")
            self.status.set("Displayed TowerTuning.json diff.")
        except Exception as exc:
            messagebox.showerror("Diff failed", str(exc))

    def _show_text_window(self, title, content):
        window = tk.Toplevel(self.root)
        window.title(title)
        window.configure(bg=COLORS["bg"])
        window.minsize(940, 620)
        text = tk.Text(window, wrap="none", font=("Consolas", 10), bg=COLORS["entry"], fg=COLORS["text"], insertbackground=COLORS["text"], relief="flat")
        y_scroll = ttk.Scrollbar(window, orient="vertical", command=text.yview)
        x_scroll = ttk.Scrollbar(window, orient="horizontal", command=text.xview)
        text.configure(yscrollcommand=y_scroll.set, xscrollcommand=x_scroll.set)
        text.insert("1.0", content)
        text.configure(state="disabled")
        text.grid(row=0, column=0, sticky="nsew", padx=(12, 0), pady=(12, 0))
        y_scroll.grid(row=0, column=1, sticky="ns", pady=(12, 0))
        x_scroll.grid(row=1, column=0, sticky="ew", padx=(12, 0), pady=(0, 12))
        window.columnconfigure(0, weight=1)
        window.rowconfigure(0, weight=1)

    def reload(self):
        if not messagebox.askyesno("Reload tuning", "Discard unsaved edits and reload from disk?"):
            return
        self.tuning = self._load_json(TUNING_PATH)
        self.registry = self._load_json(RESEARCH_PATH)
        self._sync_missing_research()
        self._refresh_research_options()
        self._render_active_tab()
        self.status.set("Reloaded tuning from disk.")

    def _sync_missing_research(self):
        towers = self.tuning.setdefault("towers", {})
        for tower_id, group in self.registry.get("definitions", {}).items():
            tower = towers.setdefault(tower_id, {})
            research = tower.setdefault("research", {})
            for research_id in group.get("nodes", {}):
                research.setdefault(research_id, {"effects": {}})

    def _ask_number(self, title):
        value = simpledialog.askstring(title, "Numeric value:")
        if value is None:
            return None
        return self._parse_number(value, title)

    def _parse_number(self, text, label):
        try:
            number = float(str(text).strip())
            return int(number) if number.is_integer() else number
        except ValueError:
            messagebox.showerror("Invalid number", f"{label} must be numeric.")
            raise

    @staticmethod
    def _format_number(value):
        if isinstance(value, float):
            return f"{value:.6f}".rstrip("0").rstrip(".")
        return str(value)

    @staticmethod
    def _load_json(path):
        return json.loads(path.read_text(encoding="utf-8"))

    @staticmethod
    def _clear(parent):
        for child in parent.winfo_children():
            child.destroy()


if __name__ == "__main__":
    root = tk.Tk()
    TowerTweaker(root)
    root.mainloop()
