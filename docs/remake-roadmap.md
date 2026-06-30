# Endless Matrix Remake Roadmap

This document maps the current prototype in `ref/temp/index` into staged development chapters. The first goal is parity: rebuild the same functionality 1:1 with better UI design, cleaner implementation, stronger feedback, local server testing, and GitHub Pages deployment readiness.

## Parity Target

The remake should initially match the prototype's current behavior:

- Main menu with Play and Settings.
- Game hub with Tier, Coins, Gems, Crates, and feature buttons.
- Level selector with 100 levels and color bands.
- Level 1 starts a playable run.
- Full-screen canvas game view.
- Procedural map generation with road and boulders.
- Play/Pause wave control.
- Reroll current run map.
- Abort run modal.
- Touch/click tower placement.
- One minigun tower type.
- Tower upgrade and recycle behavior.
- Raider enemies following the path.
- Wave spawning and automatic wave advancement.
- Local save fallback for persistent player resources.

Do not expand the game design until this parity pass is complete.

## Stage 0: Project Foundation

Purpose: replace the one-file prototype with a maintainable static web app.

Deliverables:

- GitHub Pages-compatible static app structure.
- Local dev server command.
- Source folders for UI, game logic, renderer, data, assets, and styles.
- Central tuning/config file replacing inline constants.
- Basic smoke-test or preview workflow.

Prototype mapping:

- Everything currently embedded in `ref/temp/index`.

## Stage 1: App Shell and Screen Router

Purpose: rebuild prototype screen switching as an explicit app state layer.

Screens:

- Main Menu.
- Game Menu.
- Level Selector.
- Run/Game Canvas.
- Abort Modal.
- Tower Popup.

Deliverables:

- Central screen state machine.
- Shared layout primitives.
- Mobile safe-area support.
- Portrait-first layout with desktop scaling rules.

Prototype mapping:

- `showView(name)`
- `mainMenu`
- `gameMenu`
- `levelSelector`
- `runView`
- `abortModal`
- `towerPopup`

## Stage 2: Main Menu Chapter

Purpose: replace the placeholder `DEFENSE CORE` identity with `Endless Matrix`.

UI:

- Title: `Endless Matrix`.
- Play button.
- Settings button placeholder.
- Version/footer line.
- Stronger grid, digital, or infinite-system visual identity.

Buttons:

- Play opens the Game Menu.
- Settings may remain placeholder-only for parity.

Animation and feedback:

- Menu entrance transition.
- Button hover/tap response.
- Subtle background motion.

Prototype mapping:

- `mainMenu`
- `playButton`
- Settings visual button.

## Stage 3: Game Menu / Hub Chapter

Purpose: rebuild the hub screen and preserve current navigation.

UI:

- Resource/status bar:
  - Tier.
  - Coins.
  - Gems.
  - Crates.
- Central identity/icon area.
- Navigation buttons:
  - Level Select.
  - Shop.
  - Gems.
  - Crates.
  - Abilities.
  - Towers.
- Back button.

Buttons:

- Level Select opens Level Selector.
- Back returns to Main Menu.
- Other feature buttons remain placeholder-only for parity.

Prototype mapping:

- `gameMenu`
- `tierDisplay`
- `coinsDisplay`
- `gemsDisplay`
- `cratesDisplay`
- `levelSelectButton`
- `backButton`

## Stage 4: Save System Chapter

Purpose: preserve local progress behavior with a cleaner persistence layer.

Saved data:

- Tier.
- Coins.
- Gems.
- Crates.
- Highest unlocked level.

Deliverables:

- `SaveService`.
- Versioned Endless Matrix save key.
- Safe load fallback.
- Migration hook, even if initially empty.

Prototype mapping:

- `STORAGE_KEY`
- `defaultSave`
- `loadSave()`
- `saveGame()`
- `updateResourceDisplay()`

## Stage 5: Level Select Chapter

Purpose: rebuild the 100-level grid.

UI:

- Scrollable level grid.
- 100 level buttons.
- Locked styling.
- Back button.

Level color bands:

- Levels 1-20: white.
- Levels 21-40: green.
- Levels 41-60: blue.
- Levels 61-80: purple.
- Levels 81-100: gold.

Buttons:

- Level 1 starts a run.
- Locked levels are visually inactive.
- Other levels can remain nonfunctional until progression exists.

Prototype mapping:

- `levelSelector`
- `levelGrid`
- `buildLevelGrid()`
- `getLevelColor(level)`
- `startLevel(1)`

## Stage 6: Run / Gameframe Chapter

Purpose: rebuild the full-screen gameplay screen.

UI:

- Full-screen canvas.
- HUD:
  - Level.
  - Wave.
  - Resources.
  - Run coins/gems.
- Controls:
  - Abort.
  - Reroll.
  - Play/Pause.
- Tower popup panel.

Animation and feedback:

- Canvas render loop.
- Enemy movement.
- Tower rotation.
- Hit flash.
- Explosion effect.
- Button state changes.

Prototype mapping:

- `runView`
- `mapCanvas`
- `run-hud`
- `playWaveButton`
- `abortButton`
- `rerollButton`
- `loop(now)`

## Stage 7: Map Generation Chapter

Purpose: preserve procedural map behavior while isolating it from UI code.

Features:

- 44x44 grid.
- 24px logical cells.
- Target road length around 150.
- Boulder placement.
- Road carved after boulders.
- Road avoids or removes boulder conflicts.
- Start and end markers.
- Placement blocked near roads and boulders.

Deliverables:

- `MapGenerator`.
- Plain map data output:
  - columns.
  - rows.
  - cell size.
  - path points.
  - path cell keys.
  - boulders.
- Optional seed support later.

Prototype mapping:

- `generateMap()`
- `addBouldersFirst()`
- `carvePathAfterBoulders()`
- `forceExitConnection()`
- `addPathCell()`
- `roadWouldHitBoulder()`
- `clearBouldersTouchingRoad()`

## Stage 8: Renderer Chapter

Purpose: improve visuals while keeping gameplay readable.

Render layers:

- Background/void.
- Grid.
- Boulders.
- Road cells.
- Road line.
- Placement selection.
- Towers.
- Enemies.
- Explosions.
- Start/end markers.

Visual improvements:

- Stronger Endless Matrix identity.
- Better road and obstacle styling.
- Clearer placement highlight.
- Better tower silhouettes.
- Better enemy readability.
- Stronger impact effects.

Engineering:

- `CanvasRenderer`.
- Pure drawing methods.
- No gameplay state mutation from render methods.

Prototype mapping:

- `drawMap()`
- `drawVoid()`
- `drawGrid()`
- `drawBoulders()`
- `drawRoadCells()`
- `drawPathLine()`
- `drawPlacementSelection()`
- `drawTowers()`
- `drawEnemies()`
- `drawExplosions()`
- `drawStartEnd()`

## Stage 9: Tower System Chapter

Purpose: preserve current minigun behavior with cleaner data and feedback.

Current tower:

- Minigun.
- 2x2 placement.
- Base cost: 10 resources.
- Tier range: 1-5.
- Upgrade cost doubles by tier.
- Recycle returns 50% of resources spent.
- Range: 7 cells.
- Damage: 10.
- Fire rate: 0.1 seconds.
- Targets enemy with highest path progress in range.
- Rotates toward target.

Input behavior:

- Tap valid empty 2x2 area once to select.
- Tap the same selected area again to open placement popup.
- Tap tower to open tower GUI.
- Buy, Upgrade, Recycle, and Close controls.

Feedback improvements:

- Invalid placement feedback.
- Affordable/unaffordable button states.
- Range preview when tower is selected.
- Better attack feedback.

Prototype mapping:

- `canPlace2x2()`
- `openPlacementPopup()`
- `placeMinigun()`
- `openTowerGui()`
- `upgradeSelectedTower()`
- `recycleSelectedTower()`
- `findTowerTarget()`
- `getTowerCenter()`

## Stage 10: Enemy and Wave Chapter

Purpose: preserve current wave progression while making it extensible.

Current enemy:

- Raider.
- Health: 100.
- Speed: 1 cell per second.
- Follows map path.
- Disappears at end.
- Displays hit flash and temporary health bar.

Current wave rules:

- 100 waves.
- Enemies per wave: `5 + wave * 2`.
- Spawn interval: 0.4 seconds.
- When all enemies are gone, wave increments and the run pauses.

Deliverables:

- `WaveController`.
- `EnemySystem`.
- Enemy definition data.
- Wave tuning data.

Prototype mapping:

- `beginWave()`
- `spawnRaider()`
- `updateSpawning()`
- `updateEnemies()`
- `killEnemy()`
- `checkWaveEnd()`

## Stage 11: Run Lifecycle Chapter

Purpose: formalize start, reset, reroll, abort, and close behavior.

Current run behavior:

- Start Level 1.
- Generate map.
- Set resources to 30.
- Reset run loot to 0.
- No permanent rewards are applied.
- Abort shows current coins/gems but does not add them.
- Reroll resets map, towers, waves, enemies, and run loot.

Deliverables:

- `RunState`.
- `startRun(level)`.
- `resetRun()`.
- `abortRun()`.
- `closeRunToMenu()`.
- `rerollRunMap()`.

Intentionally missing for parity:

- Victory payout.
- Core health.
- Fail state.
- Level unlock progression.

Prototype mapping:

- `startLevel(level)`
- `resetRunLootAndWaves()`
- `abortRun()`
- `closeRunToMenu()`

## Stage 12: Modal and Feedback Chapter

Purpose: improve clarity without changing mechanics.

Current modal:

- Run Aborted.
- Coins Made.
- Gems Made.
- Continue.
- Note that rewards are not added to permanent progress.

Feedback to improve:

- Invalid placement pulse.
- Insufficient resource button state.
- Pause/play clarity.
- Tower selected state.
- Level locked state.
- Abort modal readability.

Prototype mapping:

- `abortModal`
- `abortCoins`
- `abortGems`
- `abortContinueButton`
- `towerPopup`

## Stage 13: Mobile Website and GitHub Pages Chapter

Purpose: make the project deploy and behave like a real mobile web game.

Deliverables:

- GitHub Pages-compatible static build.
- Correct relative asset paths.
- Local dev server preview.
- Mobile viewport testing.
- Desktop browser testing.
- Optional later PWA-ready structure:
  - manifest.
  - icons.
  - offline cache.

## Stage 14: Parity Verification

Purpose: prove the remake matches the prototype before expanding design.

Checklist:

- Main menu opens.
- Play enters hub.
- Back returns to menu.
- Resource bar displays.
- Level Select opens.
- 100 levels render with correct color bands.
- Level 1 starts a run.
- Map generates.
- Reroll regenerates and resets run.
- Play starts wave.
- Pause pauses wave.
- Enemies spawn and move.
- Towers can be placed on valid cells.
- Towers cannot be placed on roads, boulders, or occupied cells.
- Towers shoot enemies.
- Enemies die and grant resources.
- Tower upgrades work.
- Recycling works.
- Abort modal opens.
- Continue returns to hub.
- Local save loads without crashing.
- Mobile layout is usable.

## Recommended Build Order

1. Foundation and screen router.
2. Main Menu.
3. Game Menu.
4. Save system.
5. Level Select.
6. Run screen shell.
7. Map generator.
8. Canvas renderer.
9. Input and placement.
10. Tower system.
11. Enemy and wave system.
12. Abort, reroll, and run lifecycle.
13. Feedback polish.
14. GitHub Pages deployment and parity testing.

## Design Rule for the Remake

The first production milestone is not a redesigned game. It is the existing prototype rebuilt cleanly. Improvements should make the same mechanics easier to understand, easier to test, and easier to extend without changing the gameplay contract.
