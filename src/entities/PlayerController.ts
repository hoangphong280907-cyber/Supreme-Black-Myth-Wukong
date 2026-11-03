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
} from 'three';

import type { Scene } from 'three';

export class PlayerController {
  private readonly scene: Scene;
  private readonly root = new Group();
  private readonly visual = new Group();

  private readonly velocity = new Vector3();
  private readonly desiredVelocity = new Vector3();

  private walkTime = 0;

  constructor(scene: Scene) {
    this.scene = scene;

    // Spawn on the first stepping stone.
    this.root.position.set(
      Math.sin(2.7) * 0.65,
      0.16,
      9.6,
    );

    this.root.rotation.y = Math.PI;
    this.root.add(this.visual);

    this.createCharacter();
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
    const speed = sprinting ? 6.2 : 4.2;

    this.desiredVelocity
      .copy(movementDirection)
      .multiplyScalar(hasInput ? speed : 0);

    const response = hasInput ? 14 : 9;
    const blend = 1 - Math.exp(-response * deltaTime);

    this.velocity.lerp(this.desiredVelocity, blend);

    // PhysicsWorld will apply this desired displacement.
    if (this.velocity.lengthSq() > 0.04) {
      const targetRotation = Math.atan2(
        this.velocity.x,
        this.velocity.z,
      );

      const angleDifference = Math.atan2(
        Math.sin(targetRotation - this.root.rotation.y),
        Math.cos(targetRotation - this.root.rotation.y),
      );

      this.root.rotation.y +=
        angleDifference * (1 - Math.exp(-14 * deltaTime));
    }

    if (this.velocity.lengthSq() > 0.06) {
      this.walkTime += deltaTime * (sprinting ? 13 : 9);

      this.visual.position.y =
        Math.abs(Math.sin(this.walkTime)) * 0.045;

      this.visual.rotation.z =
        Math.sin(this.walkTime * 0.5) * 0.015;
    } else {
      this.visual.position.y = 0;
      this.visual.rotation.z = 0;
    }

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

    this.addPart(
      new CapsuleGeometry(0.105, 0.48, 5, 8),
      robe,
      -0.39, 1.12, 0,
    );

    this.addPart(
      new CapsuleGeometry(0.105, 0.48, 5, 8),
      robe,
      0.39, 1.12, 0,
    );

    this.addPart(
      new CapsuleGeometry(0.13, 0.38, 5, 8),
      dark,
      -0.16, 0.38, 0,
    );

    this.addPart(
      new CapsuleGeometry(0.13, 0.38, 5, 8),
      dark,
      0.16, 0.38, 0,
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
  ): Mesh {
    const mesh = new Mesh(geometry, material);

    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.visual.add(mesh);

    return mesh;
  }
}
