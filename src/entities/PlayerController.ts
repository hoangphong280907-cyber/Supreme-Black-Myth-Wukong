import {
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

  constructor(scene: Scene) {
    this.scene = scene;

    this.root.position.set(
      Math.sin(2.7) * 0.65,
      0.16,
      9.6,
    );

    this.root.rotation.y = Math.PI;

    // Separate movement lean from procedural animation.
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

  update(
    deltaTime: number,
    movementDirection: Vector3,
    sprinting: boolean,
  ): Vector3 {
    if (deltaTime <= 0) {
      return new Vector3();
    }

    const hasInput = movementDirection.lengthSq() > 0.0001;
    const targetSpeed = sprinting ? RUN_SPEED : WALK_SPEED;

    this.desiredVelocity
      .copy(movementDirection)
      .multiplyScalar(hasInput ? targetSpeed : 0);

    // Determine whether the player is reversing direction.
    const reversing =
      hasInput &&
      this.velocity.dot(movementDirection) < -0.1;

    const acceleration = !hasInput
      ? BRAKING
      : reversing
        ? REVERSAL_ACCELERATION
        : ACCELERATION;

    // Move current velocity toward desired velocity using
    // a maximum acceleration per second.
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

    this.updateFacing(deltaTime);
    this.updateMovementLean(deltaTime, currentSpeed);
    this.updateAnimation(deltaTime, currentSpeed);

    this.previousSpeed = currentSpeed;

    // Rapier remains responsible for the actual position.
    return new Vector3(
      this.velocity.x * deltaTime,
      0,
      this.velocity.z * deltaTime,
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

    // Lean into the turn, using the actual angular movement.
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

  private updateAnimation(
    deltaTime: number,
    currentSpeed: number,
  ): void {
    this.animation.update(
      deltaTime,
      currentSpeed,
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
