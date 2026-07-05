import "./styles/base.css";
import { FlavorManager } from "./game/FlavorManager.js";
import { SaveService } from "./game/SaveService.js";
import { ScreenManager } from "./ui/ScreenManager.js";
import { MainMenuScreen } from "./ui/screens/MainMenuScreen.js";
import { MainScreen } from "./ui/screens/MainScreen.js";
import { LevelSelectScreen } from "./ui/screens/LevelSelectScreen.js";
import { GameFrameScreen } from "./ui/screens/GameFrameScreen.js";
import { TowersScreen } from "./ui/screens/TowersScreen.js";
import { GemsScreen } from "./ui/screens/GemsScreen.js";
import { CratesScreen } from "./ui/screens/CratesScreen.js";
import { ShopScreen } from "./ui/screens/ShopScreen.js";
import { ResearchScreen } from "./ui/screens/ResearchScreen.js";
import { GameEndScreen } from "./ui/screens/GameEndScreen.js";
import { preloadImages } from "./ui/AssetCache.js";

const appRoot = document.querySelector("#app");
const runtimeAssetBase = `${import.meta.env.BASE_URL}assets/runtime`;
const saveService = new SaveService();
const flavorManager = new FlavorManager();

const screenManager = new ScreenManager(appRoot);
screenManager.register("main-menu", new MainMenuScreen());
screenManager.register("main-screen", new MainScreen({ saveService }));
screenManager.register("level-select", new LevelSelectScreen({ saveService }));
screenManager.register("towers", new TowersScreen({ saveService }));
screenManager.register("gems", new GemsScreen({ saveService }));
screenManager.register("crates", new CratesScreen({ saveService }));
screenManager.register("shop", new ShopScreen({ saveService }));
screenManager.register("research", new ResearchScreen({ saveService }));
screenManager.register("game-frame", new GameFrameScreen({ flavorManager, saveService }));
screenManager.register("game-end", new GameEndScreen({ saveService }));
screenManager.show("main-menu");

const preloadRuntimeAssets = () => {
  preloadImages([
    `${runtimeAssetBase}/other/recycle.png`,
    `${runtimeAssetBase}/other/upgrade.png`,
    `${runtimeAssetBase}/other/research.png`,
    `${runtimeAssetBase}/other/singularity.png`,
    `${runtimeAssetBase}/scenery/tree.png`,
    `${runtimeAssetBase}/scenery/boulder.png`,
    `${runtimeAssetBase}/towers/cannon_common.png`,
    `${runtimeAssetBase}/towers/minigun_common.png`,
    `${runtimeAssetBase}/towers/raygun_common.png`,
    `${runtimeAssetBase}/towers/missile_common.png`,
    `${runtimeAssetBase}/towers/antiair_common.png`,
    `${runtimeAssetBase}/towers/factory_common.png`,
    `${runtimeAssetBase}/raiders/walker_frame1_common.png`,
    `${runtimeAssetBase}/raiders/walker_frame2_common.png`,
    `${runtimeAssetBase}/raiders/car_common.png`,
    `${runtimeAssetBase}/crates/bronze_crate.png`,
    `${runtimeAssetBase}/crates/silver_crate.png`,
    `${runtimeAssetBase}/crates/gold_crate.png`
  ]).catch(() => {});
};

if ("requestIdleCallback" in window) {
  window.requestIdleCallback(preloadRuntimeAssets, { timeout: 1800 });
} else {
  window.setTimeout(preloadRuntimeAssets, 600);
}
