import { Group } from 'three';

export interface CharacterRig {
  body: Group;
  leftArm: Group;
  rightArm: Group;
  leftLeg: Group;
  rightLeg: Group;
}

export class CharacterAnimationController {
  private readonly rig: CharacterRig;

  private elapsedTime = 0;
  private walkPhase = 0;

  private movementBlend = 0;
  private runBlend = 0;

  constructor(rig: CharacterRig) {
    this.rig = rig;
  }

  update(
    deltaTime: number,
    movementSpeed: number,
    sprinting: boolean,
  ): void {
    if (deltaTime <= 0) return;

    this.elapsedTime += deltaTime;

    const isMoving = movementSpeed > 0.18;

    const movementTarget = isMoving ? 1 : 0;
    const runTarget = isMoving && sprinting ? 1 : 0;

    this.movementBlend = this.smoothBlend(
      this.movementBlend,
      movementTarget,
      10,
      deltaTime,
    );

    this.runBlend = this.smoothBlend(
      this.runBlend,
      runTarget,
      8,
      deltaTime,
    );

    // Walking and running have different animation speeds.
    const cadence = 8.5 + this.runBlend * 4.5;

    this.walkPhase +=
      deltaTime * cadence * this.movementBlend;

    const legAmplitude =
      0.42 + this.runBlend * 0.18;

    const armAmplitude = legAmplitude * 0.72;

    const step = Math.sin(this.walkPhase);

    // Alternating legs.
    this.rig.leftLeg.rotation.x =
      step * legAmplitude * this.movementBlend;

    this.rig.rightLeg.rotation.x =
      -step * legAmplitude * this.movementBlend;

    // Arms swing opposite to the legs.
    this.rig.leftArm.rotation.x =
      -step * armAmplitude * this.movementBlend;

    this.rig.rightArm.rotation.x =
      step * armAmplitude * this.movementBlend;

    // Gentle breathing while idle and subtle body movement while walking.
    const idleBreathing =
      Math.sin(this.elapsedTime * 2.1) *
      0.012 *
      (1 - this.movementBlend);

    const movementBob =
      Math.abs(Math.sin(this.walkPhase * 2)) *
      0.035 *
      this.movementBlend;

    this.rig.body.position.y =
      idleBreathing + movementBob;

    this.rig.body.rotation.z =
      step * 0.012 * this.movementBlend;
  }

  private smoothBlend(
    current: number,
    target: number,
    response: number,
    deltaTime: number,
  ): number {
    const blend = 1 - Math.exp(-response * deltaTime);

    return current + (target - current) * blend;
  }
}
