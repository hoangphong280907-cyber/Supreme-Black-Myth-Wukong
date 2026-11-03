import './style.css';

import { Game } from './app/Game';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Application root #app was not found.');
}

app.innerHTML = `
  <div id="game-viewport"></div>

  <header class="hud hud-top">
    <div class="brand">
      <span class="brand-kicker">A 3D ACTION ADVENTURE RPG</span>

      <h1>
        ĐƯỜNG TỚI
        <span>TÂY THIÊN</span>
      </h1>

      <p>
        Một hành trình vượt khỏi tam giới.
        Một bí mật đang chờ được khai mở.
      </p>
    </div>

    <div class="build-card">
      <span class="card-label">DEVELOPMENT BUILD</span>
      <strong>WORLD 00</strong>
      <span class="card-detail">PLAYER PHYSICS</span>
    </div>
  </header>

  <footer class="hud hud-bottom">
    <span class="bottom-mark">THE PATH TO THE WEST</span>
    <span class="bottom-note">EARLY ENGINE PROTOTYPE · BUILD 0002</span>
  </footer>
`;

const viewport = app.querySelector<HTMLDivElement>('#game-viewport');

if (!viewport) {
  throw new Error('Game viewport was not found.');
}

const showRuntimeError = (error: unknown): void => {
  console.error('Game initialization failed:', error);

  const message =
    error instanceof Error
      ? error.message
      : 'An unknown error occurred.';

  const errorPanel = document.createElement('section');
  errorPanel.className = 'runtime-error';

  const heading = document.createElement('h2');
  heading.textContent = 'Unable to start the 3D engine';

  const detail = document.createElement('code');
  detail.textContent = message;

  errorPanel.append(heading, detail);
  app.appendChild(errorPanel);
};

try {
  const game = new Game(viewport);

  window.addEventListener(
    'pagehide',
    () => game.dispose(),
    { once: true },
  );

  void game.start().catch((error: unknown) => {
    game.dispose();
    showRuntimeError(error);
  });
} catch (error) {
  showRuntimeError(error);
}
