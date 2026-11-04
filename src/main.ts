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

  <section class="death-overlay" id="death-overlay" hidden aria-live="assertive">
    <div class="death-panel">
      <span class="death-kicker">THE JOURNEY IS NOT OVER</span>
      <h2>YOU HAVE FALLEN</h2>
      <p>Returning to the path in <strong id="respawn-countdown">3</strong></p>
    </div>
  </section>

  <footer class="hud hud-bottom">
    <div class="dodge-hud" id="dodge-hud">
      <span class="dodge-key">Q</span>

      <div class="dodge-details">
        <div class="dodge-row">
          <span class="dodge-title">DODGE</span>
          <span id="dodge-cooldown-label">READY</span>
        </div>

        <div class="dodge-cooldown-track">
          <span id="dodge-cooldown-fill"></span>
        </div>
      </div>
    </div>
    <div class="attack-hud" id="attack-hud">
      <span class="attack-key">LMB</span>

      <div class="attack-details">
        <div class="attack-row">
          <span class="attack-title">MELEE</span>
          <span id="attack-cooldown-label">READY</span>
        </div>

        <div class="attack-cooldown-track">
          <span id="attack-cooldown-fill"></span>
        </div>

        <span id="combat-feedback">LMB TO ATTACK</span>
      </div>
    </div>
    <div class="player-health-hud" id="player-health-hud">
      <div class="player-health-row">
        <span class="player-health-title">VITALITY</span>
        <span id="player-health-label">100 / 100</span>
      </div>
      <div class="player-health-track">
        <span id="player-health-fill"></span>
      </div>
    </div>
    <span class="bottom-mark">THE PATH TO THE WEST</span>
    <span class="bottom-note">COMBAT FOUNDATION · BUILD 0008</span>
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
