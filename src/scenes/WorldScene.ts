import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  FogExp2,
  HemisphereLight,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Scene,
  TorusGeometry,
} from 'three';

export class WorldScene {
  readonly scene = new Scene();

  private readonly relic: Mesh<
    IcosahedronGeometry,
    MeshStandardMaterial
  >;

  private readonly orbit: Mesh<
    TorusGeometry,
    MeshStandardMaterial
  >;

  constructor() {
    this.scene.background = new Color(0x0a101a);
    this.scene.fog = new FogExp2(0x0a101a, 0.023);

    this.createLighting();
    this.createGround();
    this.createArchitecture();
    this.createPath();

    this.relic = new Mesh(
      new IcosahedronGeometry(0.58, 1),
      new MeshStandardMaterial({
        color: 0x91edff,
        emissive: 0x126a91,
        emissiveIntensity: 2.5,
        metalness: 0.55,
        roughness: 0.18,
      }),
    );

    this.relic.position.set(0, 2.45, 0);
    this.relic.castShadow = true;
    this.scene.add(this.relic);

    this.orbit = new Mesh(
      new TorusGeometry(0.95, 0.025, 8, 64),
      new MeshStandardMaterial({
        color: 0x76dcff,
        emissive: 0x268bab,
        emissiveIntensity: 1.4,
        metalness: 0.65,
        roughness: 0.25,
      }),
    );

    this.orbit.rotation.x = Math.PI / 2;
    this.orbit.position.y = 2.45;
    this.scene.add(this.orbit);
  }

  update(elapsedTime: number): void {
    this.relic.rotation.y = elapsedTime * 0.55;
    this.relic.rotation.x = elapsedTime * 0.18;

    this.relic.position.y =
      2.45 + Math.sin(elapsedTime * 1.4) * 0.13;

    this.orbit.rotation.z = elapsedTime * 0.3;
    this.orbit.position.y = this.relic.position.y;
  }

  private createLighting(): void {
    const hemisphere = new HemisphereLight(
      0xa8c9ff,
      0x2c1d20,
      1.8,
    );

    this.scene.add(hemisphere);

    const sunlight = new DirectionalLight(
      0xffd9a8,
      3,
    );

    sunlight.position.set(8, 12, 6);
    sunlight.castShadow = true;

    sunlight.shadow.mapSize.set(2048, 2048);
    sunlight.shadow.camera.near = 0.5;
    sunlight.shadow.camera.far = 40;
    sunlight.shadow.camera.left = -12;
    sunlight.shadow.camera.right = 12;
    sunlight.shadow.camera.top = 12;
    sunlight.shadow.camera.bottom = -12;
    sunlight.shadow.bias = -0.0002;

    this.scene.add(sunlight);

    const relicLight = new PointLight(
      0x45c9ff,
      35,
      18,
      2,
    );

    relicLight.position.set(0, 3.5, 0);
    this.scene.add(relicLight);
  }

  private createGround(): void {
    const ground = new Mesh(
      new PlaneGeometry(120, 120),
      new MeshStandardMaterial({
        color: 0x151d28,
        roughness: 0.96,
        metalness: 0.05,
      }),
    );

    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;

    this.scene.add(ground);

    this.createBox(
      9,
      0.7,
      6,
      new MeshStandardMaterial({
        color: 0x343b45,
        roughness: 0.85,
        metalness: 0.15,
      }),
      0,
      0.35,
      0,
    );
  }

  private createArchitecture(): void {
    const stone = new MeshStandardMaterial({
      color: 0x55515a,
      roughness: 0.78,
      metalness: 0.18,
    });

    const darkStone = new MeshStandardMaterial({
      color: 0x34313a,
      roughness: 0.72,
      metalness: 0.25,
    });

    const redWood = new MeshStandardMaterial({
      color: 0x5a292b,
      roughness: 0.62,
      metalness: 0.25,
    });

    for (const x of [-3, 3]) {
      const pillar = new Mesh(
        new CylinderGeometry(0.42, 0.58, 4.3, 12),
        redWood,
      );

      pillar.position.set(x, 2.85, 0);
      pillar.castShadow = true;
      pillar.receiveShadow = true;

      this.scene.add(pillar);

      this.createBox(
        1.25, 0.28, 1.25,
        stone,
        x, 0.86, 0,
      );

      this.createBox(
        1.25, 0.28, 1.25,
        stone,
        x, 4.85, 0,
      );
    }

    this.createBox(
      7.6, 0.48, 0.8,
      darkStone,
      0, 4.85, 0,
    );

    const leftRoof = this.createBox(
      5, 0.28, 2.5,
      redWood,
      -2.05, 5.3, 0,
    );

    leftRoof.rotation.z = 0.18;

    const rightRoof = this.createBox(
      5, 0.28, 2.5,
      redWood,
      2.05, 5.3, 0,
    );

    rightRoof.rotation.z = -0.18;

    this.createBox(
      1.15, 0.35, 2.7,
      stone,
      0, 5.52, 0,
    );
  }

  private createPath(): void {
    const material = new MeshStandardMaterial({
      color: 0x444b56,
      roughness: 0.9,
    });

    for (let index = 0; index < 6; index++) {
      const x = Math.sin(index * 0.9) * 0.65;
      const z = 4.5 + index * 1.7;

      this.createBox(
        1.25,
        0.18,
        1.2,
        material,
        x,
        0.09,
        z,
      );
    }
  }

  private createBox(
    width: number,
    height: number,
    depth: number,
    material: MeshStandardMaterial,
    x: number,
    y: number,
    z: number,
  ): Mesh<BoxGeometry, MeshStandardMaterial> {
    const mesh = new Mesh(
      new BoxGeometry(width, height, depth),
      material,
    );

    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    this.scene.add(mesh);

    return mesh;
  }
}
