import { CameraManager } from '../camera/CameraManager';
import { InputManager } from '../input/InputManager';
import { PlayerController } from '../entities/PlayerController';
import { EnemyDummy } from '../entities/EnemyDummy';
import { MeleeCombatSystem, type AttackResolution } from '../combat/MeleeCombatSystem';
import { EnemyAIController } from '../ai/EnemyAIController';
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
  private readonly combat: MeleeCombatSystem;
  private readonly enemyAI: EnemyAIController;

  private readonly dodgeCooldownFill: HTMLElement | null;
  private readonly dodgeCooldownLabel: HTMLElement | null;
  private readonly attackCooldownFill: HTMLElement | null;
  private readonly attackCooldownLabel: HTMLElement | null;
  private readonly combatFeedbackLabel: HTMLElement | null;
  private readonly playerHealthFill: HTMLElement | null;
  private readonly playerHealthLabel: HTMLElement | null;

  private combatFeedbackTimer = 0;

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

    this.combat = new MeleeCombatSystem(
      this.player,
      this.enemyDummy,
    );
    this.enemyAI = new EnemyAIController(
      this.enemyDummy,
      this.player,
    );

    const appRoot = viewport.parentElement;

    this.dodgeCooldownFill =
      appRoot?.querySelector<HTMLElement>('#dodge-cooldown-fill') ?? null;

    this.dodgeCooldownLabel =
      appRoot?.querySelector<HTMLElement>('#dodge-cooldown-label') ?? null;

    this.attackCooldownFill =
      appRoot?.querySelector<HTMLElement>('#attack-cooldown-fill') ?? null;

    this.attackCooldownLabel =
      appRoot?.querySelector<HTMLElement>('#attack-cooldown-label') ?? null;

    this.combatFeedbackLabel =
      appRoot?.querySelector<HTMLElement>('#combat-feedback') ?? null;
    this.playerHealthFill =
      appRoot?.querySelector<HTMLElement>('#player-health-fill') ?? null;
    this.playerHealthLabel =
      appRoot?.querySelector<HTMLElement>('#player-health-label') ?? null;

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

  private updateAttackHud(deltaTime: number): void {
    if (this.attackCooldownFill) {
      this.attackCooldownFill.style.transform =
        `scaleX(${this.player.attackCooldownProgress})`;
    }

    if (this.attackCooldownLabel) {
      if (this.player.isAttacking) {
        this.attackCooldownLabel.textContent = 'STRIKE';
      } else if (this.player.attackCooldownRemaining > 0) {
        this.attackCooldownLabel.textContent =
          `${this.player.attackCooldownRemaining.toFixed(1)}s`;
      } else {
        this.attackCooldownLabel.textContent = 'READY';
      }
    }

    if (this.combatFeedbackTimer > 0) {
      this.combatFeedbackTimer = Math.max(
        0,
        this.combatFeedbackTimer - deltaTime,
      );

      if (
        this.combatFeedbackTimer === 0 &&
        this.combatFeedbackLabel
      ) {
        this.combatFeedbackLabel.textContent = 'LMB TO ATTACK';
      }
    }
  }

  private showCombatFeedback(result: AttackResolution | string): void {
    if (!this.combatFeedbackLabel) return;

    this.combatFeedbackLabel.textContent = result;
    this.combatFeedbackTimer = 0.9;
  }

  private updatePlayerHealthHud(): void {
    const health = this.player.health;

    if (this.playerHealthFill) {
      this.playerHealthFill.style.transform = `scaleX(${health.healthRatio})`;
    }

    if (this.playerHealthLabel) {
      this.playerHealthLabel.textContent = health.isDead
        ? 'DEFEATED'
        : `${Math.ceil(health.currentHealth)} / ${health.maxHealth}`;
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

    if (this.input.consumeAttackRequest()) {
      this.combat.tryStartAttack(physics.grounded);
    }

    const desiredMovement = this.player.update(
      deltaTime,
      movementDirection,
      this.input.isSprinting,
    );

    if (deltaTime > 0) {
      const enemyAttack = this.enemyAI.update(deltaTime);
      if (enemyAttack === 'HIT') {
        this.showCombatFeedback('ENEMY HIT');
      } else if (enemyAttack === 'BLOCKED') {
        this.showCombatFeedback('DODGED');
      } else if (enemyAttack === 'MISS') {
        this.showCombatFeedback('ENEMY MISS');
      }

      this.enemyDummy.update(deltaTime);

      const groundHeight = physics.getGroundHeight(this.enemyDummy.position);
      if (groundHeight !== null) {
        this.enemyDummy.setGroundHeight(groundHeight);
      }

      physics.syncTrainingDummyPosition(this.enemyDummy.position);

      const jumpRequested = this.input.consumeJumpRequest();

      const correctedPosition = physics.moveCharacter(
        this.player.position,
        desiredMovement,
        deltaTime,
        jumpRequested,
      );

      this.player.setPosition(correctedPosition);

      const attackResolution = this.combat.update();

      if (attackResolution) {
        this.showCombatFeedback(attackResolution);

        if (attackResolution === 'DEFEATED') {
          physics.removeTrainingDummyCollider();
        }
      }

      this.player.updateAnimationState(
        deltaTime,
        physics.grounded,
        physics.verticalSpeed,
        physics.consumeLanding(),
      );
    }

    this.updateDodgeHud();
    this.updateAttackHud(deltaTime);
    this.updatePlayerHealthHud();

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
