import {
  BoxGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  TorusGeometry,
  Vector3,
} from 'three';

import type { Scene } from 'three';

const EFFECT_DURATION = 0.22;
const SPARK_COUNT = 7;

export class CombatImpactEffect {
  private readonly scene: Scene;
  private readonly root = new Group();

  private readonly ringMaterial = new MeshBasicMaterial({
    color: 0xffd28a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  });

  private readonly sparkMaterial = new MeshBasicMaterial({
    color: 0xfff0c2,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
  });

  private readonly ring = new Mesh(
    new TorusGeometry(0.24, 0.035, 6, 28),
    this.ringMaterial,
  );

  private readonly sparkGeometry = new BoxGeometry(0.045, 0.16, 0.035);
  private readonly sparks: Mesh[] = [];

  private elapsed = 0;
  private active = false;

  constructor(scene: Scene) {
    this.scene = scene;
    this.ring.castShadow = false;
    this.ring.receiveShadow = false;
    this.root.add(this.ring);

    for (let index = 0; index < SPARK_COUNT; index += 1) {
      const spark = new Mesh(this.sparkGeometry, this.sparkMaterial);
      spark.castShadow = false;
      spark.receiveShadow = false;
      this.sparks.push(spark);
      this.root.add(spark);
    }

    this.root.visible = false;
    this.scene.add(this.root);
  }

  trigger(position: Vector3, sourcePosition: Vector3): void {
    this.active = true;
    this.elapsed = 0;
    this.root.visible = true;
    this.root.position.set(position.x, position.y + 1.05, position.z);
    this.root.scale.setScalar(1);

    const dx = sourcePosition.x - position.x;
    const dz = sourcePosition.z - position.z;
    if (dx * dx + dz * dz > 0.0001) {
      this.root.rotation.y = Math.atan2(dx, dz);
    }

    this.ring.scale.setScalar(0.7);
    this.ringMaterial.opacity = 0.95;
    this.sparkMaterial.opacity = 1;

    for (let index = 0; index < this.sparks.length; index += 1) {
      const angle = (index / this.sparks.length) * Math.PI * 2;
      const spark = this.sparks[index];
      if (!spark) continue;
      spark.position.set(
        Math.cos(angle) * 0.28,
        Math.sin(angle) * 0.28,
        0.015,
      );
      spark.rotation.z = angle - Math.PI / 2;
      spark.scale.set(1, 1, 1);
    }
  }

  update(deltaTime: number): void {
    if (!this.active || deltaTime <= 0) return;

    this.elapsed += deltaTime;
    const progress = Math.min(this.elapsed / EFFECT_DURATION, 1);
    const easedProgress = 1 - (1 - progress) ** 2;

    this.ring.scale.setScalar(0.7 + easedProgress * 1.35);
    this.ringMaterial.opacity = 0.95 * (1 - progress);
    this.sparkMaterial.opacity = 1 - progress;
    this.ring.rotation.z += deltaTime * 1.8;

    for (let index = 0; index < this.sparks.length; index += 1) {
      const angle = (index / this.sparks.length) * Math.PI * 2;
      const radius = 0.28 + easedProgress * 0.34;
      const spark = this.sparks[index];
      if (!spark) continue;
      spark.position.set(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        0.015,
      );
      spark.scale.y = 1 - progress * 0.45;
    }

    if (progress >= 1) {
      this.active = false;
      this.root.visible = false;
    }
  }

  dispose(): void {
    this.scene.remove(this.root);
    this.ring.geometry.dispose();
    this.sparkGeometry.dispose();
    this.ringMaterial.dispose();
    this.sparkMaterial.dispose();
  }
}
