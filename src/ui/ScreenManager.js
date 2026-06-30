export class ScreenManager {
  #root;
  #screens = new Map();
  #activeScreen = null;
  #activeName = null;

  constructor(root) {
    if (!root) {
      throw new Error("ScreenManager requires a root element.");
    }

    this.#root = root;
    this.#root.classList.add("app-root");
  }

  register(name, screen) {
    if (!name || typeof name !== "string") {
      throw new Error("Screen name must be a non-empty string.");
    }

    if (!screen || typeof screen.mount !== "function") {
      throw new Error(`Screen "${name}" must provide a mount(context) method.`);
    }

    this.#screens.set(name, screen);
  }

  show(name, params = {}) {
    const nextScreen = this.#screens.get(name);

    if (!nextScreen) {
      throw new Error(`Screen "${name}" is not registered.`);
    }

    if (this.#activeScreen && typeof this.#activeScreen.unmount === "function") {
      this.#activeScreen.unmount();
    }

    this.#root.replaceChildren();
    this.#activeName = name;
    this.#activeScreen = nextScreen;

    const context = {
      params,
      activeName: this.#activeName,
      navigate: (targetName, targetParams = {}) => this.show(targetName, targetParams)
    };

    const element = nextScreen.mount(context);

    if (!(element instanceof HTMLElement)) {
      throw new Error(`Screen "${name}" must mount an HTMLElement.`);
    }

    element.dataset.screen = name;
    this.#root.append(element);
  }
}
