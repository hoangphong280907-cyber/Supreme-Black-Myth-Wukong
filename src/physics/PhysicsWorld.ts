import { Vector3 } from 'three';

import type {
  Collider,
  KinematicCharacterController,
  World as RapierWorld,
} from '@dimforge/rapier3d-compat';

type RapierModule = typeof import('@dimforge/rapier3d-compat');

const GRAVITY = 9.81;
const JUMP_SPEED = 6.3;

const JUMP_BUFFER_DURATION = 0.14;
const COYOTE_TIME_DURATION = 0.12;

const MAX_FALL_SPEED = 35;

const CAPSULE_HALF_HEIGHT = 0.63;
const CAPSULE_RADIUS = 0.32;
const CAPSULE_CENTER_OFFSET = 0.97;
const CHARACTER_OFFSET = 0.02;

export class PhysicsWorld {
  private readonly rapier: RapierModule;
  private readonly world: RapierWorld;

  private readonly playerCollider: Collider;
  private readonly characterController: KinematicCharacterController;
  private trainingDummyCollider: Collider | null = null;

  private verticalVelocity = 0;
  private jumpBufferTimer = 0;
  private coyoteTimer = 0;

  private isGrounded = false;
  private hasInitializedGroundState = false;
  private landedThisFrame = false;

  private disposed = false;

  private constructor(
    rapier: RapierModule,
    spawnPosition: Vector3,
  ) {
    this.rapier = rapier;

    this.world = new this.rapier.World({
      x: 0,
      y: -GRAVITY,
      z: 0,
    });

    this.createEnvironmentColliders();

    const playerColliderDesc = this.rapier.ColliderDesc
      .capsule(CAPSULE_HALF_HEIGHT, CAPSULE_RADIUS)
      .setTranslation(
        spawnPosition.x,
        spawnPosition.y + CAPSULE_CENTER_OFFSET,
        spawnPosition.z,
      )
      .setFriction(0);

    this.playerCollider = this.world.createCollider(
      playerColliderDesc,
    );

    this.characterController =
      this.world.createCharacterController(CHARACTER_OFFSET);

    this.characterController.setUp({
      x: 0,
      y: 1,
      z: 0,
    });

    this.characterController.setMaxSlopeClimbAngle(
      50 * Math.PI / 180,
    );

    this.characterController.setMinSlopeSlideAngle(
      30 * Math.PI / 180,
    );

    this.characterController.enableAutostep(
      0.8,
      0.2,
      false,
    );

    this.characterController.enableSnapToGround(0.3);

    this.world.step();
  }

  static async create(
    spawnPosition: Vector3,
  ): Promise<PhysicsWorld> {
    const rapier = await import('@dimforge/rapier3d-compat');

    await rapier.init();

    return new PhysicsWorld(rapier, spawnPosition);
  }

  get grounded(): boolean {
    return this.isGrounded;
  }

  get verticalSpeed(): number {
    return this.verticalVelocity;
  }

  consumeLanding(): boolean {
    const landed = this.landedThisFrame;
    this.landedThisFrame = false;

    return landed;
  }

  removeTrainingDummyCollider(): void {
    if (
      this.disposed ||
      this.trainingDummyCollider === null
    ) {
      return;
    }

    this.world.removeCollider(
      this.trainingDummyCollider,
      true,
    );

    this.trainingDummyCollider = null;
  }

  moveCharacter(
    currentRootPosition: Vector3,
    desiredMovement: Vector3,
    deltaTime: number,
    jumpRequested = false,
  ): Vector3 {
    if (this.disposed) {
      throw new Error('PhysicsWorld has already been disposed.');
    }

    if (deltaTime <= 0) {
      return currentRootPosition.clone();
    }

    const dt = Math.min(deltaTime, 0.05);

    const wasGrounded = this.isGrounded;

    // Remember a recent jump input.
    if (jumpRequested) {
      this.jumpBufferTimer = JUMP_BUFFER_DURATION;
    } else {
      this.jumpBufferTimer = Math.max(
        0,
        this.jumpBufferTimer - dt,
      );
    }

    // Allow a short jump window after leaving a ledge.
    if (wasGrounded) {
      this.coyoteTimer = COYOTE_TIME_DURATION;
    } else {
      this.coyoteTimer = Math.max(
        0,
        this.coyoteTimer - dt,
      );
    }

    const canJump =
      this.jumpBufferTimer > 0 &&
      this.coyoteTimer > 0;

    if (canJump) {
      this.verticalVelocity = JUMP_SPEED;

      this.jumpBufferTimer = 0;
      this.coyoteTimer = 0;
      this.isGrounded = false;
    } else {
      this.verticalVelocity = Math.max(
        this.verticalVelocity - GRAVITY * dt,
        -MAX_FALL_SPEED,
      );
    }

    const desiredTranslation = {
      x: desiredMovement.x,
      y: this.verticalVelocity * dt,
      z: desiredMovement.z,
    };

    this.characterController.computeColliderMovement(
      this.playerCollider,
      desiredTranslation,
    );

    const correctedMovement =
      this.characterController.computedMovement();

    // Stop upward movement if the character hits a ceiling.
    if (
      this.verticalVelocity > 0 &&
      correctedMovement.y < desiredTranslation.y - 0.0001
    ) {
      this.verticalVelocity = 0;
    }

    const currentColliderPosition =
      this.playerCollider.translation();

    const nextPosition = {
      x: currentColliderPosition.x + correctedMovement.x,
      y: currentColliderPosition.y + correctedMovement.y,
      z: currentColliderPosition.z + correctedMovement.z,
    };

    this.playerCollider.setTranslation(nextPosition);

    this.isGrounded =
      this.characterController.computedGrounded();

    // Detect landing transitions, but ignore initial ground contact.
    this.landedThisFrame =
      this.hasInitializedGroundState &&
      !wasGrounded &&
      this.isGrounded;

    this.hasInitializedGroundState = true;

    if (this.isGrounded && this.verticalVelocity < 0) {
      this.verticalVelocity = 0;
    }

    return new Vector3(
      nextPosition.x,
      nextPosition.y - CAPSULE_CENTER_OFFSET,
      nextPosition.z,
    );
  }

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;

    this.world.removeCharacterController(
      this.characterController,
    );

    this.world.removeCollider(
      this.playerCollider,
      true,
    );

    this.world.free();
  }

  private createEnvironmentColliders(): void {
    // Ground plane.
    this.addStaticBox(
      60, 0.1, 60,
      0, -0.15, 0,
    );

    // Raised stone platform.
    this.addStaticBox(
      4.5, 0.35, 3,
      0, 0.35, 0,
    );

    // Stepping stones.
    for (let index = 0; index < 6; index++) {
      const x = Math.sin(index * 0.9) * 0.65;
      const z = 4.5 + index * 1.7;

      this.addStaticBox(
        0.625, 0.09, 0.6,
        x, 0.09, z,
      );
    }

    // Training dummy blocker.
    const enemyCollider = this.rapier.ColliderDesc
      .capsule(0.58, 0.38)
      .setTranslation(
        Math.sin(1.8) * 0.65,
        0.16 + 0.97,
        7.9,
      )
      .setFriction(0);

    this.trainingDummyCollider = this.world.createCollider(enemyCollider);

    // Pillars and their stone bases.
    for (const x of [-3, 3]) {
      this.addStaticBox(
        0.54, 2.15, 0.54,
        x, 2.85, 0,
      );

      this.addStaticBox(
        0.625, 0.14, 0.625,
        x, 0.86, 0,
      );
    }
  }

  private addStaticBox(
    halfWidth: number,
    halfHeight: number,
    halfDepth: number,
    x: number,
    y: number,
    z: number,
  ): void {
    const collider = this.rapier.ColliderDesc
      .cuboid(halfWidth, halfHeight, halfDepth)
      .setTranslation(x, y, z)
      .setFriction(0.8);

    this.world.createCollider(collider);
  }
}
