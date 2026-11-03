import { Group, MathUtils } from 'three';

export interface CharacterRig {
  body: Group;
  leftArm: Group;
  rightArm: Group;
  leftLeg: Group;
  rightLeg: Group;
}

const WALK_SPEED = 4.2;
const RUN_SPEED = 6.2;

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
  ): void {
    if (deltaTime <= 0) return;

    this.elapsedTime += deltaTime;

    // Blend animation intensity based on actual velocity.
    const movementTarget = MathUtils.clamp(
      movementSpeed / 2.5,
      0,
      1,
    );

    const runTarget = MathUtils.clamp(
      (movementSpeed - WALK_SPEED) /
        (RUN_SPEED - WALK_SPEED),
      0,
      1,
    );

    this.movementBlend = this.smoothBlend(
      this.movementBlend,
      movementTarget,
      9,
      deltaTime,
    );

    this.runBlend = this.smoothBlend(
      this.runBlend,
      runTarget,
      7,
      deltaTime,
    );

    // Stride cadence follows the character's real movement speed.
    const cadence = 6.5 + movementSpeed * 1.05;

    this.walkPhase +=
      deltaTime * cadence * this.movementBlend;

    const legAmplitude = 0.38 + this.runBlend * 0.14;
    const armAmplitude = legAmplitude * 0.68;

    const step = Math.sin(this.walkPhase);

    this.rig.leftLeg.rotation.x =
      step * legAmplitude * this.movementBlend;

    this.rig.rightLeg.rotation.x =
      -step * legAmplitude * this.movementBlend;

    this.rig.leftArm.rotation.x =
      -step * armAmplitude * this.movementBlend;

    this.rig.rightArm.rotation.x =
      step * armAmplitude * this.movementBlend;

    // Breathing, stride bob and subtle torso sway.
    const idleBreathing =
      Math.sin(this.elapsedTime * 2.1) *
      0.012 *
      (1 - this.movementBlend);

    const movementBob =
      Math.abs(Math.sin(this.walkPhase * 2)) *
      0.04 *
      this.movementBlend;

    this.rig.body.position.y =
      idleBreathing + movementBob;

    this.rig.body.rotation.z =
      Math.sin(this.walkPhase) *
      0.018 *
      this.movementBlend;
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
