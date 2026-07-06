export class MainMenuScreen {
  #element = null;

  mount(context) {
    const screen = document.createElement("main");
    screen.className = "screen main-menu-screen";
    screen.setAttribute("aria-label", "Endless Matrix main menu");

    screen.innerHTML = `
      <div class="wire-grid" aria-hidden="true"></div>
      <section class="main-menu-shell" aria-labelledby="mainMenuTitle">
        <div class="title-block">
          <h1 id="mainMenuTitle" class="wire-title">Endless Matrix</h1>
        </div>

        <nav class="menu-stack" aria-label="Main menu">
          <button class="wire-button primary" type="button" data-action="play">
            <span>Play</span>
            <span class="button-index">01</span>
          </button>
          <button class="wire-button" type="button" data-action="settings">
            <span>Settings</span>
            <span class="button-index">02</span>
          </button>
        </nav>

        <footer class="screen-footer">
          <span>v0.1</span>
          <span class="footer-rule"></span>
          <span>Online</span>
        </footer>
      </section>
    `;

    screen.querySelector('[data-action="play"]').addEventListener("click", () => {
      context.navigate("main-screen");
    });

    screen.querySelector('[data-action="settings"]').addEventListener("click", () => {
      context.navigate("settings");
    });

    this.#element = screen;
    return screen;
  }

  unmount() {
    this.#element = null;
  }
}
