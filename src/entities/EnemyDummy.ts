import {
  BoxGeometry,
  BufferGeometry,
  CapsuleGeometry,
  Group,
  Material,
  Mesh,
  MeshStandardMaterial,
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

  private readonly baseY: number;

  private elapsedTime = 0;
  private hitFlashTimer = 0;
  private disposed = false;

  constructor(
    scene: Scene,
    x: number,
    y: number,
    z: number,
  ) {
    this.scene = scene;
    this.baseY = y;

    this.root.position.set(x, y, z);

    this.createModel();
    this.createHealthBar();

    this.scene.add(this.root);
  }

  get position(): Vector3 {
    return this.root.position;
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

    // Small idle movement to make the training target visible.
    this.root.position.y =
      this.baseY + Math.sin(this.elapsedTime * 1.6) * 0.012;

    this.root.rotation.z =
      Math.sin(this.elapsedTime * 0.9) * 0.012;

    this.hitFlashTimer = Math.max(
      0,
      this.hitFlashTimer - deltaTime,
    );

    const flashIntensity =
      this.hitFlashTimer > 0
        ? 0.8 * (this.hitFlashTimer / 0.14)
        : 0;

    this.bodyMaterial.emissive.setRGB(
      flashIntensity,
      flashIntensity * 0.8,
      flashIntensity * 0.8,
    );

    this.bodyMaterial.emissiveIntensity = flashIntensity;
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

    // Arms.
    const leftArm = this.addPart(
      new CapsuleGeometry(0.105, 0.42, 5, 8),
      this.bodyMaterial,
      -0.43, 1.12, 0,
    );

    leftArm.rotation.z = -0.22;

    const rightArm = this.addPart(
      new CapsuleGeometry(0.105, 0.42, 5, 8),
      this.bodyMaterial,
      0.43, 1.12, 0,
    );

    rightArm.rotation.z = 0.22;

    // Legs.
    this.addPart(
      new CapsuleGeometry(0.13, 0.42, 5, 8),
      this.darkMaterial,
      -0.16, 0.37, 0,
    );

    this.addPart(
      new CapsuleGeometry(0.13, 0.42, 5, 8),
      this.darkMaterial,
      0.16, 0.37, 0,
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
  ): Mesh {
    const mesh = new Mesh(geometry, material);

    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.root.add(mesh);

    return mesh;
  }
}
