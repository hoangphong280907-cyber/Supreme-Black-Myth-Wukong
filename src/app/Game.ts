import { CameraManager } from '../camera/CameraManager';
import { InputManager } from '../input/InputManager';
import { PlayerController } from '../entities/PlayerController';
import { EnemyDummy } from '../entities/EnemyDummy';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { GameRenderer } from '../renderer/GameRenderer';
import { WorldScene } from '../scenes/WorldScene';

export class Game {
  private readonly renderer: GameRenderer;
  private readonly camera = new CameraManager();
  private readonly world = new WorldScene();

  private readonly input: InputManager;
  private readonly player: PlayerController;
  private readonly enemyDummy: EnemyDummy;

  private readonly dodgeCooldownFill: HTMLElement | null;
  private readonly dodgeCooldownLabel: HTMLElement | null;

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

    // Place the training target on the stepping stone ahead of the player.
    this.enemyDummy = new EnemyDummy(
      this.world.scene,
      Math.sin(1.8) * 0.65,
      0.16,
      7.9,
    );

    const appRoot = viewport.parentElement;

    this.dodgeCooldownFill =
      appRoot?.querySelector<HTMLElement>('#dodge-cooldown-fill') ?? null;

    this.dodgeCooldownLabel =
      appRoot?.querySelector<HTMLElement>('#dodge-cooldown-label') ?? null;

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
    this.enemyDummy.dispose();

    this.physics?.dispose();
    this.physics = null;

    this.renderer.dispose();
  }

  private updateDodgeHud(): void {
    const remaining = this.player.dodgeCooldownRemaining;
    const progress = this.player.dodgeCooldownProgress;

    if (this.dodgeCooldownFill) {
      this.dodgeCooldownFill.style.transform =
        `scaleX(${progress})`;
    }

    if (this.dodgeCooldownLabel) {
      if (this.player.isDodging) {
        this.dodgeCooldownLabel.textContent = 'EVADING';
      } else if (remaining > 0) {
        this.dodgeCooldownLabel.textContent =
          `${remaining.toFixed(1)}s`;
      } else {
        this.dodgeCooldownLabel.textContent = 'READY';
      }
    }
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

    if (this.input.consumeDodgeRequest()) {
      this.player.tryStartDodge(
        movementDirection,
        physics.grounded,
      );
    }

    const desiredMovement = this.player.update(
      deltaTime,
      movementDirection,
      this.input.isSprinting,
    );

    if (deltaTime > 0) {
      const jumpRequested = this.input.consumeJumpRequest();

      const correctedPosition = physics.moveCharacter(
        this.player.position,
        desiredMovement,
        deltaTime,
        jumpRequested,
      );

      this.player.setPosition(correctedPosition);

      this.player.updateAnimationState(
        deltaTime,
        physics.grounded,
        physics.verticalSpeed,
        physics.consumeLanding(),
      );
    }

    this.updateDodgeHud();

    this.camera.update(
      this.player.position,
      deltaTime,
    );

    this.world.update(this.elapsedTime);
    this.enemyDummy.update(deltaTime);

    this.renderer.render(
      this.world.scene,
      this.camera.camera,
    );
  };
}
