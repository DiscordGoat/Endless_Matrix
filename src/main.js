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

const appRoot = document.querySelector("#app");
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
screenManager.register("game-frame", new GameFrameScreen({ flavorManager, saveService }));
screenManager.show("main-menu");
