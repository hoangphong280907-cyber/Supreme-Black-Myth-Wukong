import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  MathUtils,
} from 'three';

import type { Scene } from 'three';

import { CharacterAnimationController } from '../animation/CharacterAnimationController';

const WALK_SPEED = 4.2;
const RUN_SPEED = 6.2;

const ACCELERATION = 8;
const BRAKING = 8.5;
const REVERSAL_ACCELERATION = 20;

const MAX_TURN_RATE = 10;
const MAX_TURN_LEAN = 0.12;
const MAX_FORWARD_LEAN = 0.07;

const DODGE_DURATION = 0.24;
const DODGE_DISTANCE = 2.1;
const DODGE_COOLDOWN = 0.85;
const INVULNERABILITY_DURATION = 0.16;

const ATTACK_DURATION = 0.42;
const ATTACK_HIT_TIME = 0.15;
const ATTACK_COOLDOWN = 0.62;

export class PlayerController {
  private readonly scene: Scene;

  private readonly root = new Group();
  private readonly leanPivot = new Group();
  private readonly visual = new Group();

  private readonly leftArmPivot = new Group();
  private readonly rightArmPivot = new Group();

  private readonly leftLegPivot = new Group();
  private readonly rightLegPivot = new Group();

  private readonly animation: CharacterAnimationController;

  private readonly velocity = new Vector3();
  private readonly desiredVelocity = new Vector3();
  private readonly velocityDifference = new Vector3();

  private previousSpeed = 0;
  private forwardLean = 0;
  private turnLean = 0;

  private readonly dodgeDirection = new Vector3();

  private readonly dodgeTrailMaterial = new MeshStandardMaterial({
    color: 0x8be7ff,
    emissive: 0x187ca8,
    emissiveIntensity: 1.8,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    roughness: 0.35,
    metalness: 0.2,
  });

  private readonly dodgeTrailMeshes: Mesh[] = [];

  private dodging = false;
  private dodgeElapsed = 0;
  private dodgeCooldownTimer = 0;
  private invulnerabilityTimer = 0;

  private attacking = false;
  private attackElapsed = 0;
  private attackCooldownTimer = 0;
  private attackImpactPending = false;

  constructor(scene: Scene) {
    this.scene = scene;

    this.root.position.set(
      Math.sin(2.7) * 0.65,
      0.16,
      9.6,
    );

    this.root.rotation.y = Math.PI;

    this.root.add(this.leanPivot);
    this.leanPivot.add(this.visual);

    this.createCharacter();

    this.animation = new CharacterAnimationController({
      body: this.visual,
      leftArm: this.leftArmPivot,
      rightArm: this.rightArmPivot,
      leftLeg: this.leftLegPivot,
      rightLeg: this.rightLegPivot,
    });

    this.scene.add(this.root);
  }

  get position(): Vector3 {
    return this.root.position;
  }

  setPosition(position: Vector3): void {
    this.root.position.copy(position);
  }

  get isDodging(): boolean {
    return this.dodging;
  }

  get isInvulnerable(): boolean {
    return this.invulnerabilityTimer > 0;
  }

  get isAttacking(): boolean {
    return this.attacking;
  }

  get attackCooldownRemaining(): number {
    return this.attackCooldownTimer;
  }

  get attackCooldownProgress(): number {
    return MathUtils.clamp(
      1 - this.attackCooldownTimer / ATTACK_COOLDOWN,
      0,
      1,
    );
  }

  get forwardDirection(): Vector3 {
    return new Vector3(
      Math.sin(this.root.rotation.y),
      0,
      Math.cos(this.root.rotation.y),
    );
  }

  tryStartAttack(grounded: boolean): boolean {
    if (
      !grounded ||
      this.dodging ||
      this.attacking ||
      this.attackCooldownTimer > 0
    ) {
      return false;
    }

    this.attacking = true;
    this.attackElapsed = 0;
    this.attackCooldownTimer = ATTACK_COOLDOWN;
    this.attackImpactPending = false;

    return true;
  }

  consumeAttackImpact(): boolean {
    const pending = this.attackImpactPending;
    this.attackImpactPending = false;

    return pending;
  }

  get dodgeCooldownRemaining(): number {
    return this.dodgeCooldownTimer;
  }

  get dodgeCooldownProgress(): number {
    return MathUtils.clamp(
      1 - this.dodgeCooldownTimer / DODGE_COOLDOWN,
      0,
      1,
    );
  }

  tryStartDodge(
    movementDirection: Vector3,
    grounded: boolean,
  ): boolean {
    if (
      !grounded ||
      this.dodging ||
      this.attacking ||
      this.dodgeCooldownTimer > 0
    ) {
      return false;
    }

    if (movementDirection.lengthSq() > 0.0001) {
      this.dodgeDirection
        .copy(movementDirection)
        .normalize();
    } else {
      this.dodgeDirection.set(
        Math.sin(this.root.rotation.y),
        0,
        Math.cos(this.root.rotation.y),
      );
    }

    this.velocity.set(0, 0, 0);
    this.previousSpeed = 0;

    this.dodgeElapsed = 0;
    this.dodging = true;

    this.dodgeCooldownTimer = DODGE_COOLDOWN;
    this.invulnerabilityTimer = INVULNERABILITY_DURATION;

    this.dodgeTrailMaterial.opacity = 0.42;

    for (const trail of this.dodgeTrailMeshes) {
      trail.visible = true;
    }

    this.root.rotation.y = Math.atan2(
      this.dodgeDirection.x,
      this.dodgeDirection.z,
    );

    this.forwardLean = 0;
    this.turnLean = 0;
    this.leanPivot.rotation.set(0, 0, 0);

    return true;
  }
  update(
    deltaTime: number,
    movementDirection: Vector3,
    sprinting: boolean,
  ): Vector3 {
    if (deltaTime <= 0) {
      return new Vector3();
    }

    this.dodgeCooldownTimer = Math.max(
      0,
      this.dodgeCooldownTimer - deltaTime,
    );

    this.invulnerabilityTimer = Math.max(
      0,
      this.invulnerabilityTimer - deltaTime,
    );

    this.attackCooldownTimer = Math.max(
      0,
      this.attackCooldownTimer - deltaTime,
    );

    if (this.attacking) {
      const previousAttackElapsed = this.attackElapsed;

      this.attackElapsed = Math.min(
        ATTACK_DURATION,
        this.attackElapsed + deltaTime,
      );

      if (
        previousAttackElapsed < ATTACK_HIT_TIME &&
        this.attackElapsed >= ATTACK_HIT_TIME
      ) {
        this.attackImpactPending = true;
      }

      if (this.attackElapsed >= ATTACK_DURATION) {
        this.attacking = false;
      }
    }

    if (this.dodging) {
      return this.updateDodge(deltaTime);
    }

    const hasInput = movementDirection.lengthSq() > 0.0001;
    const targetSpeed = sprinting ? RUN_SPEED : WALK_SPEED;

    this.desiredVelocity
      .copy(movementDirection)
      .multiplyScalar(hasInput ? targetSpeed : 0);

    const reversing =
      hasInput &&
      this.velocity.dot(movementDirection) < -0.1;

    const acceleration = !hasInput
      ? BRAKING
      : reversing
        ? REVERSAL_ACCELERATION
        : ACCELERATION;

    this.velocityDifference.subVectors(
      this.desiredVelocity,
      this.velocity,
    );

    const differenceLength = this.velocityDifference.length();
    const maximumChange = acceleration * deltaTime;

    if (differenceLength <= maximumChange) {
      this.velocity.copy(this.desiredVelocity);
    } else if (differenceLength > 0.0001) {
      this.velocity.addScaledVector(
        this.velocityDifference,
        maximumChange / differenceLength,
      );
    }

    const currentSpeed = this.velocity.length();

    if (!this.attacking) this.updateFacing(deltaTime);
    this.updateMovementLean(deltaTime, currentSpeed);

    this.previousSpeed = currentSpeed;

    return new Vector3(
      this.velocity.x * deltaTime,
      0,
      this.velocity.z * deltaTime,
    );
  }

  updateAnimationState(
    deltaTime: number,
    grounded: boolean,
    verticalSpeed: number,
    landed: boolean,
  ): void {
    this.animation.update(
      deltaTime,
      this.velocity.length(),
      verticalSpeed,
      grounded,
      landed,
      this.dodging,
      this.attacking,
    );
  }

  dispose(): void {
    this.scene.remove(this.root);

    const geometries = new Set<BufferGeometry>();
    const materials = new Set<Material>();

    this.root.traverse((object) => {
      if (!(object instanceof Mesh)) return;

      geometries.add(object.geometry);

      const objectMaterials = Array.isArray(object.material)
        ? object.material
        : [object.material];

      for (const material of objectMaterials) {
        materials.add(material);
      }
    });

    for (const geometry of geometries) {
      geometry.dispose();
    }

    for (const material of materials) {
      material.dispose();
    }
  }

  private updateDodge(deltaTime: number): Vector3 {
    const previousProgress = this.dodgeElapsed / DODGE_DURATION;

    this.dodgeElapsed = Math.min(
      DODGE_DURATION,
      this.dodgeElapsed + deltaTime,
    );

    const currentProgress = this.dodgeElapsed / DODGE_DURATION;

    this.dodgeTrailMaterial.opacity =
      0.42 * (1 - currentProgress);

    const ease = (value: number): number =>
      value * value * (3 - 2 * value);

    const distance = DODGE_DISTANCE * (
      ease(currentProgress) - ease(previousProgress)
    );

    const displacement = this.dodgeDirection
      .clone()
      .multiplyScalar(distance);

    if (this.dodgeElapsed >= DODGE_DURATION) {
      this.dodging = false;

      for (const trail of this.dodgeTrailMeshes) {
        trail.visible = false;
      }

      this.dodgeTrailMaterial.opacity = 0;
      this.velocity.set(0, 0, 0);
      this.previousSpeed = 0;
    }

    return displacement;
  }
  private updateFacing(deltaTime: number): void {
    if (this.velocity.lengthSq() < 0.04) {
      return;
    }

    const targetRotation = Math.atan2(
      this.velocity.x,
      this.velocity.z,
    );

    const angleDifference = Math.atan2(
      Math.sin(targetRotation - this.root.rotation.y),
      Math.cos(targetRotation - this.root.rotation.y),
    );

    const rotationStep = MathUtils.clamp(
      angleDifference,
      -MAX_TURN_RATE * deltaTime,
      MAX_TURN_RATE * deltaTime,
    );

    this.root.rotation.y += rotationStep;

    const normalizedTurnRate = MathUtils.clamp(
      rotationStep / deltaTime / MAX_TURN_RATE,
      -1,
      1,
    );

    const targetTurnLean =
      -normalizedTurnRate * MAX_TURN_LEAN;

    this.turnLean = this.damp(
      this.turnLean,
      targetTurnLean,
      9,
      deltaTime,
    );
  }

  private updateMovementLean(
    deltaTime: number,
    currentSpeed: number,
  ): void {
    const acceleration =
      (currentSpeed - this.previousSpeed) / deltaTime;

    const targetForwardLean = MathUtils.clamp(
      acceleration / ACCELERATION,
      -1,
      1,
    ) * MAX_FORWARD_LEAN;

    this.forwardLean = this.damp(
      this.forwardLean,
      targetForwardLean,
      7,
      deltaTime,
    );

    this.leanPivot.rotation.set(
      this.forwardLean,
      0,
      this.turnLean,
    );
  }

  private damp(
    current: number,
    target: number,
    response: number,
    deltaTime: number,
  ): number {
    const blend = 1 - Math.exp(-response * deltaTime);

    return current + (target - current) * blend;
  }

  private createCharacter(): void {
    const robe = new MeshStandardMaterial({
      color: 0x29394d,
      roughness: 0.86,
    });

    const skin = new MeshStandardMaterial({
      color: 0xc99571,
      roughness: 0.9,
    });

    const hair = new MeshStandardMaterial({
      color: 0x171a20,
      roughness: 0.92,
    });

    const gold = new MeshStandardMaterial({
      color: 0xc29b58,
      metalness: 0.58,
      roughness: 0.42,
    });

    const dark = new MeshStandardMaterial({
      color: 0x1c222c,
      roughness: 0.88,
    });

    this.addPart(
      new CapsuleGeometry(0.32, 0.72, 6, 12),
      robe,
      0, 1.05, 0,
    );

    this.addPart(
      new SphereGeometry(0.225, 16, 12),
      skin,
      0, 1.79, 0,
    );

    const hairCap = this.addPart(
      new SphereGeometry(0.245, 16, 10),
      hair,
      0, 1.98, 0,
    );

    hairCap.scale.set(1, 0.52, 1);

    this.leftArmPivot.position.set(-0.39, 1.43, 0);
    this.rightArmPivot.position.set(0.39, 1.43, 0);

    this.visual.add(
      this.leftArmPivot,
      this.rightArmPivot,
    );

    this.addPart(
      new CapsuleGeometry(0.105, 0.48, 5, 8),
      robe,
      0, -0.31, 0,
      this.leftArmPivot,
    );

    this.addPart(
      new CapsuleGeometry(0.105, 0.48, 5, 8),
      robe,
      0, -0.31, 0,
      this.rightArmPivot,
    );

    this.leftLegPivot.position.set(-0.16, 0.65, 0);
    this.rightLegPivot.position.set(0.16, 0.65, 0);

    this.visual.add(
      this.leftLegPivot,
      this.rightLegPivot,
    );

    this.addPart(
      new CapsuleGeometry(0.13, 0.38, 5, 8),
      dark,
      0, -0.27, 0,
      this.leftLegPivot,
    );

    this.addPart(
      new CapsuleGeometry(0.13, 0.38, 5, 8),
      dark,
      0, -0.27, 0,
      this.rightLegPivot,
    );

    const sash = this.addPart(
      new TorusGeometry(0.34, 0.055, 8, 24),
      gold,
      0, 1.31, 0,
    );

    sash.rotation.x = Math.PI / 2;

    this.addPart(
      new SphereGeometry(0.13, 12, 10),
      gold,
      -0.37, 1.43, 0,
    );

    this.addPart(
      new SphereGeometry(0.13, 12, 10),
      gold,
      0.37, 1.43, 0,
    );

    const leftTrail = this.addPart(
      new BoxGeometry(0.04, 0.04, 1.25),
      this.dodgeTrailMaterial,
      -0.22, 0.78, -0.72,
    );

    const rightTrail = this.addPart(
      new BoxGeometry(0.04, 0.04, 1.25),
      this.dodgeTrailMaterial,
      0.22, 0.78, -0.72,
    );

    leftTrail.visible = false;
    rightTrail.visible = false;

    this.dodgeTrailMeshes.push(leftTrail, rightTrail);
  }

  private addPart(
    geometry: BufferGeometry,
    material: Material,
    x: number,
    y: number,
    z: number,
    parent: Group = this.visual,
  ): Mesh {
    const mesh = new Mesh(geometry, material);

    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    parent.add(mesh);

    return mesh;
  }
}
