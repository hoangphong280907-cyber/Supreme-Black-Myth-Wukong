import { CameraManager } from '../camera/CameraManager';
import { InputManager } from '../input/InputManager';
import { PlayerController } from '../entities/PlayerController';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { GameRenderer } from '../renderer/GameRenderer';
import { WorldScene } from '../scenes/WorldScene';

export class Game {
  private readonly renderer: GameRenderer;
  private readonly camera = new CameraManager();
  private readonly world = new WorldScene();

  private readonly input: InputManager;
  private readonly player: PlayerController;

  private physics: PhysicsWorld | null = null;

  private elapsedTime = 0;
  private previousFrameTime = 0;

  private isRunning = false;
  private isInitializing = false;
  private isDisposed = false;

  constructor(viewport: HTMLElement) {
    this.renderer = new GameRenderer(viewport);

    this.input = new InputManager(
      this.renderer.instance.domElement,
    );

    this.player = new PlayerController(this.world.scene);

    window.addEventListener('resize', this.handleResize);
    this.handleResize();
  }

  async start(): Promise<void> {
    if (
      this.isRunning ||
      this.isInitializing ||
      this.isDisposed
    ) {
      return;
    }

    this.isInitializing = true;

    try {
      const physics = await PhysicsWorld.create(
        this.player.position,
      );

      if (this.isDisposed) {
        physics.dispose();
        return;
      }

      this.physics = physics;
      this.previousFrameTime = 0;
      this.isRunning = true;

      this.renderer.instance.setAnimationLoop(
        this.handleFrame,
      );
    } finally {
      this.isInitializing = false;
    }
  }

  dispose(): void {
    if (this.isDisposed) return;

    this.isDisposed = true;
    this.isRunning = false;

    this.renderer.instance.setAnimationLoop(null);
    window.removeEventListener('resize', this.handleResize);

    this.input.dispose();
    this.player.dispose();

    this.physics?.dispose();
    this.physics = null;

    this.renderer.dispose();
  }

  private readonly handleResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.renderer.resize(width, height);
    this.camera.resize(width, height);
  };

  private readonly handleFrame = (time: number): void => {
    const physics = this.physics;

    if (!this.isRunning || !physics) return;

    const deltaTime =
      this.previousFrameTime === 0
        ? 0
        : Math.min((time - this.previousFrameTime) / 1000, 0.05);

    this.previousFrameTime = time;
    this.elapsedTime += deltaTime;

    const pointerDelta = this.input.consumePointerDelta();
    const wheelDelta = this.input.consumeWheelDelta();

    this.camera.applyInput(pointerDelta, wheelDelta);

    const movementDirection =
      this.camera.getMovementDirection(
        this.input.horizontalAxis,
        this.input.verticalAxis,
      );

    const desiredMovement = this.player.update(
      deltaTime,
      movementDirection,
      this.input.isSprinting,
    );

    if (deltaTime > 0) {
      const correctedPosition = physics.moveCharacter(
        this.player.position,
        desiredMovement,
        deltaTime,
      );

      this.player.setPosition(correctedPosition);
    }

    // Camera follows the position resolved by physics.
    this.camera.update(
      this.player.position,
      deltaTime,
    );

    this.world.update(this.elapsedTime);

    this.renderer.render(
      this.world.scene,
      this.camera.camera,
    );
  };
}
