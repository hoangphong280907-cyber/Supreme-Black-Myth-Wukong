import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MathUtils,
  Sphere,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from 'three';

import type { Scene } from 'three';

import {
  HealthComponent,
  type DamageResult,
} from '../combat/HealthComponent';

export class EnemyDummy {
  readonly health = new HealthComponent(100);

  private readonly scene: Scene;
  private readonly root = new Group();
  private readonly healthBar = new Group();
  private attackTelegraph!: Mesh<BufferGeometry, MeshBasicMaterial>;
  private readonly leftArmPivot = new Group();
  private readonly rightArmPivot = new Group();
  private readonly leftLegPivot = new Group();
  private readonly rightLegPivot = new Group();

  private readonly bodyMaterial = new MeshStandardMaterial({
    color: 0x71383b,
    roughness: 0.82,
  });

  private readonly skinMaterial = new MeshStandardMaterial({
    color: 0xb98768,
    roughness: 0.9,
  });

  private readonly darkMaterial = new MeshStandardMaterial({
    color: 0x252932,
    roughness: 0.9,
  });

  private readonly goldMaterial = new MeshStandardMaterial({
    color: 0xb9955d,
    metalness: 0.45,
    roughness: 0.5,
  });

  private readonly healthFillMaterial = new MeshStandardMaterial({
    color: 0x65c98b,
    emissive: 0x174d2b,
    emissiveIntensity: 0.45,
  });

  private healthFill!: Mesh<
    BoxGeometry,
    MeshStandardMaterial
  >;

  private readonly hurtbox = new Sphere(
    new Vector3(),
    0.72,
  );

  private readonly previousPosition = new Vector3();

  private elapsedTime = 0;
  private walkPhase = 0;
  private movementBlend = 0;
  private hitFlashTimer = 0;
  private combatPose: 'IDLE' | 'WINDUP' | 'RECOVERY' = 'IDLE';
  private attackAnimationTimer = 0;
  private disposed = false;

  constructor(
    scene: Scene,
    x: number,
    y: number,
    z: number,
  ) {
    this.scene = scene;

    this.root.position.set(x, y, z);
    this.previousPosition.copy(this.root.position);

    this.createModel();
    this.createHealthBar();
    this.createAttackTelegraph();

    this.scene.add(this.root);
  }

  get position(): Vector3 {
    return this.root.position;
  }

  setGroundHeight(surfaceHeight: number): void {
    if (!Number.isFinite(surfaceHeight)) return;

    // Match the enemy root to the sampled floor height.
    // The original spawn root was 0.02m below the path collider top.
    this.root.position.y = surfaceHeight - 0.02;
  }

  get isAlive(): boolean {
    return !this.health.isDead;
  }

  getHurtbox(): Sphere {
    this.hurtbox.center.set(
      this.root.position.x,
      this.root.position.y + 1.05,
      this.root.position.z,
    );

    return this.hurtbox;
  }

  faceTarget(target: Vector3, deltaTime: number): void {
    const dx = target.x - this.root.position.x;
    const dz = target.z - this.root.position.z;

    if (dx * dx + dz * dz < 0.0001 || deltaTime <= 0) return;

    const targetRotation = Math.atan2(dx, dz);
    const difference = Math.atan2(
      Math.sin(targetRotation - this.root.rotation.y),
      Math.cos(targetRotation - this.root.rotation.y),
    );

    this.root.rotation.y += MathUtils.clamp(
      difference,
      -7.5 * deltaTime,
      7.5 * deltaTime,
    );
  }

  get forwardDirection(): Vector3 {
    return new Vector3(
      Math.sin(this.root.rotation.y),
      0,
      Math.cos(this.root.rotation.y),
    );
  }

  faceTargetImmediately(target: Vector3): void {
    const dx = target.x - this.root.position.x;
    const dz = target.z - this.root.position.z;

    if (dx * dx + dz * dz < 0.0001) return;
    this.root.rotation.y = Math.atan2(dx, dz);
  }

  setCombatPose(pose: 'IDLE' | 'WINDUP' | 'RECOVERY'): void {
    if (this.combatPose === pose) return;

    this.combatPose = pose;
    this.attackTelegraph.visible = pose === 'WINDUP';

    if (pose === 'WINDUP') {
      this.attackTelegraph.material.opacity = 0.18;
      this.attackTelegraph.scale.set(0.96, 1, 0.96);
    } else {
      this.attackTelegraph.material.opacity = 0;
      this.attackTelegraph.scale.set(1, 1, 1);
    }

    if (pose === 'RECOVERY') {
      this.attackAnimationTimer = 0.38;
    } else if (pose === 'IDLE') {
      this.attackAnimationTimer = 0;
    }
  }

  takeDamage(
    amount: number,
    invulnerable = false,
  ): DamageResult {
    const result = this.health.applyDamage(
      amount,
      invulnerable,
    );

    if (result.appliedDamage > 0) {
      this.hitFlashTimer = 0.14;
      this.updateHealthBar();

      if (result.isDead) {
        this.root.visible = false;
      }
    }

    return result;
  }

  update(deltaTime: number): void {
    if (this.disposed || deltaTime <= 0 || this.health.isDead) {
      return;
    }

    this.elapsedTime += deltaTime;

    if (this.combatPose === 'WINDUP') {
      const pulse = 0.5 + 0.5 * Math.sin(this.elapsedTime * 20);
      const scale = 0.94 + pulse * 0.06;
      this.attackTelegraph.material.opacity = 0.14 + pulse * 0.2;
      this.attackTelegraph.scale.set(scale, 1, scale);
    }

    // Derive locomotion from actual horizontal displacement, not AI state.
    // This keeps the walk cycle synchronized with real movement and return motion.
    const deltaX = this.root.position.x - this.previousPosition.x;
    const deltaZ = this.root.position.z - this.previousPosition.z;
    const movementSpeed = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ) / deltaTime;
    this.previousPosition.copy(this.root.position);

    const movementTarget = MathUtils.clamp(movementSpeed / 2.25, 0, 1);
    const movementResponse = 1 - Math.exp(-12 * deltaTime);
    this.movementBlend +=
      (movementTarget - this.movementBlend) * movementResponse;

    this.walkPhase +=
      deltaTime * (6.5 + movementSpeed * 1.05) * this.movementBlend;

    const legSwing = Math.sin(this.walkPhase) * 0.38 * this.movementBlend;
    this.leftLegPivot.rotation.x = legSwing;
    this.rightLegPivot.rotation.x = -legSwing;

    this.root.rotation.z =
      Math.sin(this.elapsedTime * 0.9) * 0.012;

    this.attackAnimationTimer = Math.max(
      0,
      this.attackAnimationTimer - deltaTime,
    );

    const walkArmSwing = Math.sin(this.walkPhase) * 0.16 * this.movementBlend;
    let desiredRightArm = this.combatPose === 'WINDUP' ? 0.78 : -walkArmSwing;
    const desiredLeftArm = this.combatPose === 'WINDUP' ? -0.18 : walkArmSwing;

    if (this.attackAnimationTimer > 0) {
      const progress = 1 - this.attackAnimationTimer / 0.38;
      if (progress < 0.32) {
        const swing = progress / 0.32;
        desiredRightArm = 0.78 + (-1.25 - 0.78) * swing;
      } else {
        const recovery = (progress - 0.32) / 0.68;
        desiredRightArm = -1.25 * (1 - recovery);
      }
    }

    const armBlend = 1 - Math.exp(-20 * deltaTime);
    this.rightArmPivot.rotation.x +=
      (desiredRightArm - this.rightArmPivot.rotation.x) * armBlend;
    this.leftArmPivot.rotation.x +=
      (desiredLeftArm - this.leftArmPivot.rotation.x) * armBlend;

    this.hitFlashTimer = Math.max(
      0,
      this.hitFlashTimer - deltaTime,
    );

    const flashIntensity =
      this.hitFlashTimer > 0
        ? 0.8 * (this.hitFlashTimer / 0.14)
        : 0;
    const telegraphIntensity =
      this.combatPose === 'WINDUP'
        ? 0.32 + Math.sin(this.elapsedTime * 18) * 0.12
        : 0;
    const emissiveIntensity = Math.max(flashIntensity, telegraphIntensity);

    this.bodyMaterial.emissive.setRGB(
      emissiveIntensity,
      flashIntensity * 0.8,
      flashIntensity * 0.8,
    );

    this.bodyMaterial.emissiveIntensity = emissiveIntensity;
  }

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
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

  private createAttackTelegraph(): void {
    const radius = 1.72;
    const halfAngle = Math.PI / 3;
    const segments = 28;
    const positions: number[] = [0, 0, 0];
    const indices: number[] = [];

    for (let index = 0; index <= segments; index += 1) {
      const angle = -halfAngle + (2 * halfAngle * index) / segments;
      positions.push(
        Math.sin(angle) * radius,
        0,
        Math.cos(angle) * radius,
      );
    }

    for (let index = 0; index < segments; index += 1) {
      indices.push(0, index + 1, index + 2);
    }

    const geometry = new BufferGeometry();
    geometry.setAttribute(
      'position',
      new Float32BufferAttribute(positions, 3),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    this.attackTelegraph = new Mesh(
      geometry,
      new MeshBasicMaterial({
        color: 0xffb347,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: DoubleSide,
        toneMapped: false,
      }),
    );
    this.attackTelegraph.position.y = 0.025;
    this.attackTelegraph.visible = false;
    this.attackTelegraph.renderOrder = 2;
    this.root.add(this.attackTelegraph);
  }

  private createModel(): void {
    // Main robe.
    this.addPart(
      new CapsuleGeometry(0.35, 0.72, 6, 12),
      this.bodyMaterial,
      0, 1.02, 0,
    );

    // Head.
    this.addPart(
      new SphereGeometry(0.23, 16, 12),
      this.skinMaterial,
      0, 1.78, 0,
    );

    // Helmet / head covering.
    this.addPart(
      new SphereGeometry(0.25, 16, 10),
      this.darkMaterial,
      0, 1.94, 0,
    ).scale.set(1, 0.48, 1);

    // Arms are pivoted so the enemy can telegraph and perform a melee strike.
    this.leftArmPivot.position.set(-0.43, 1.38, 0);
    this.rightArmPivot.position.set(0.43, 1.38, 0);
    this.root.add(this.leftArmPivot, this.rightArmPivot);

    const leftArm = this.addPart(
      new CapsuleGeometry(0.105, 0.42, 5, 8),
      this.bodyMaterial,
      0, -0.26, 0,
      this.leftArmPivot,
    );
    leftArm.rotation.z = -0.08;

    const rightArm = this.addPart(
      new CapsuleGeometry(0.105, 0.42, 5, 8),
      this.bodyMaterial,
      0, -0.26, 0,
      this.rightArmPivot,
    );
    rightArm.rotation.z = 0.08;

    // Legs use pivots so locomotion can drive a visible alternating gait.
    this.leftLegPivot.position.set(-0.16, 0.65, 0);
    this.rightLegPivot.position.set(0.16, 0.65, 0);
    this.root.add(this.leftLegPivot, this.rightLegPivot);

    this.addPart(
      new CapsuleGeometry(0.13, 0.38, 5, 8),
      this.darkMaterial,
      0, -0.27, 0,
      this.leftLegPivot,
    );

    this.addPart(
      new CapsuleGeometry(0.13, 0.38, 5, 8),
      this.darkMaterial,
      0, -0.27, 0,
      this.rightLegPivot,
    );

    // Waist ornament.
    const waist = this.addPart(
      new TorusGeometry(0.34, 0.045, 8, 24),
      this.goldMaterial,
      0, 1.31, 0,
    );

    waist.rotation.x = Math.PI / 2;

    // Training target emblem on the chest, facing +Z.
    this.addPart(
      new TorusGeometry(0.18, 0.025, 8, 24),
      this.goldMaterial,
      0, 1.12, 0.31,
    );
  }

  private createHealthBar(): void {
    const background = new Mesh(
      new BoxGeometry(1.1, 0.09, 0.045),
      new MeshStandardMaterial({
        color: 0x171a20,
        roughness: 0.8,
      }),
    );

    background.position.z = 0;
    background.castShadow = false;
    background.receiveShadow = false;

    this.healthFill = new Mesh(
      new BoxGeometry(0.96, 0.055, 0.055),
      this.healthFillMaterial,
    );

    this.healthFill.position.z = 0.03;

    this.healthBar.add(
      background,
      this.healthFill,
    );

    this.healthBar.position.set(0, 2.42, 0);

    this.root.add(this.healthBar);
    this.updateHealthBar();
  }

  private updateHealthBar(): void {
    const ratio = this.health.healthRatio;

    this.healthFill.scale.x = ratio;
    this.healthFill.position.x =
      -0.48 * (1 - ratio);

    this.healthBar.visible = !this.health.isDead;
  }

  private addPart(
    geometry: BufferGeometry,
    material: Material,
    x: number,
    y: number,
    z: number,
    parent: Group = this.root,
  ): Mesh {
    const mesh = new Mesh(geometry, material);

    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    parent.add(mesh);

    return mesh;
  }
}
