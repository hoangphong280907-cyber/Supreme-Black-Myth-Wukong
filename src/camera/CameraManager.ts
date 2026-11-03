import {
  MathUtils,
  PerspectiveCamera,
  Vector3,
} from 'three';

import type { PointerDelta } from '../input/InputManager';

export class CameraManager {
  readonly camera: PerspectiveCamera;

  private yaw = 0;
  private pitch = 0.28;
  private distance = 7;

  private initialized = false;

  private readonly target = new Vector3();
  private readonly focusTarget = new Vector3();
  private readonly desiredPosition = new Vector3();
  private readonly movementDirection = new Vector3();

  constructor() {
    this.camera = new PerspectiveCamera(
      55,
      1,
      0.1,
      250,
    );
  }

  applyInput(
    pointerDelta: PointerDelta,
    wheelDelta: number,
  ): void {
    this.yaw -= pointerDelta.x * 0.004;

    this.pitch = MathUtils.clamp(
      this.pitch - pointerDelta.y * 0.0035,
      0.08,
      0.85,
    );

    this.distance = MathUtils.clamp(
      this.distance + wheelDelta * 0.004,
      3.5,
      9,
    );
  }

  update(
    followTarget: Vector3,
    deltaTime: number,
  ): void {
    this.focusTarget.set(
      followTarget.x,
      followTarget.y + 1.2,
      followTarget.z,
    );

    if (!this.initialized) {
      this.target.copy(this.focusTarget);
      this.initialized = true;
    } else {
      const targetBlend = 1 - Math.exp(-10 * deltaTime);
      this.target.lerp(this.focusTarget, targetBlend);
    }

    const horizontalDistance =
      Math.cos(this.pitch) * this.distance;

    this.desiredPosition.set(
      this.target.x + Math.sin(this.yaw) * horizontalDistance,
      this.target.y + Math.sin(this.pitch) * this.distance,
      this.target.z + Math.cos(this.yaw) * horizontalDistance,
    );

    if (deltaTime === 0) {
      this.camera.position.copy(this.desiredPosition);
    } else {
      const cameraBlend = 1 - Math.exp(-12 * deltaTime);

      this.camera.position.lerp(
        this.desiredPosition,
        cameraBlend,
      );
    }

    this.camera.lookAt(this.target);
  }

  getMovementDirection(
    horizontalAxis: number,
    verticalAxis: number,
  ): Vector3 {
    this.movementDirection.set(
      Math.cos(this.yaw) * horizontalAxis -
        Math.sin(this.yaw) * verticalAxis,

      0,

      -Math.sin(this.yaw) * horizontalAxis -
        Math.cos(this.yaw) * verticalAxis,
    );

    if (this.movementDirection.lengthSq() > 1) {
      this.movementDirection.normalize();
    }

    return this.movementDirection;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(height, 1);
    this.camera.updateProjectionMatrix();
  }
}
