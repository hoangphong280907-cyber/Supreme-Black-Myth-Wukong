import { GameRenderer } from '../renderer/GameRenderer';
import { CameraManager } from '../camera/CameraManager';
import { WorldScene } from '../scenes/WorldScene';

export class Game {
  private readonly renderer: GameRenderer;
  private readonly camera = new CameraManager();
  private readonly world = new WorldScene();

  private elapsedTime = 0;
  private previousFrameTime = 0;
  private isRunning = false;

  constructor(viewport: HTMLElement) {
    this.renderer = new GameRenderer(viewport);

    window.addEventListener('resize', this.handleResize);
    this.handleResize();
  }

  start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.previousFrameTime = 0;

    this.renderer.instance.setAnimationLoop(this.handleFrame);
  }

  dispose(): void {
    this.isRunning = false;

    this.renderer.instance.setAnimationLoop(null);
    window.removeEventListener('resize', this.handleResize);

    this.renderer.dispose();
  }

  private readonly handleResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer.resize(width, height);
    this.camera.resize(width, height);
  };

  private readonly handleFrame = (time: number): void => {
    if (!this.isRunning) return;

    const deltaTime =
      this.previousFrameTime === 0
        ? 0
        : Math.min((time - this.previousFrameTime) / 1000, 0.05);

    this.previousFrameTime = time;
    this.elapsedTime += deltaTime;

    this.world.update(this.elapsedTime);

    this.renderer.render(
      this.world.scene,
      this.camera.camera,
    );
  };
}
