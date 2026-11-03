import { PerspectiveCamera } from 'three';

export class CameraManager {
  readonly camera: PerspectiveCamera;

  constructor() {
    this.camera = new PerspectiveCamera(
      50,
      1,
      0.1,
      250,
    );

    this.camera.position.set(10, 8, 13);
    this.camera.lookAt(0, 1.8, 0);
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }
}
