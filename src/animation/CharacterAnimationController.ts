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
  private airborneBlend = 0;
  private landingImpact = 0;

  constructor(rig: CharacterRig) {
    this.rig = rig;
  }

  update(
    deltaTime: number,
    movementSpeed: number,
    verticalSpeed: number,
    grounded: boolean,
    landed: boolean,
  ): void {
    if (deltaTime <= 0) return;

    this.elapsedTime += deltaTime;

    if (landed) {
      this.landingImpact = 1;
    } else {
      this.landingImpact *= Math.exp(-12 * deltaTime);
    }

    const movementTarget = grounded
      ? MathUtils.clamp(movementSpeed / 2.5, 0, 1)
      : 0;

    const runTarget = grounded
      ? MathUtils.clamp(
          (movementSpeed - WALK_SPEED) /
            (RUN_SPEED - WALK_SPEED),
          0,
          1,
        )
      : 0;

    const airborneTarget = grounded ? 0 : 1;

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

    this.airborneBlend = this.smoothBlend(
      this.airborneBlend,
      airborneTarget,
      12,
      deltaTime,
    );

    // Walking cadence is based on actual movement speed.
    const cadence = 6.5 + movementSpeed * 1.05;

    this.walkPhase +=
      deltaTime * cadence * this.movementBlend;

    const legAmplitude = 0.38 + this.runBlend * 0.14;
    const armAmplitude = legAmplitude * 0.68;

    const step = Math.sin(this.walkPhase);

    const risingBlend =
      this.airborneBlend *
      MathUtils.clamp(verticalSpeed / 3.5, 0, 1);

    const fallingBlend =
      this.airborneBlend *
      MathUtils.clamp(-verticalSpeed / 4, 0, 1);

    // Alternating leg movement while grounded.
    this.rig.leftLeg.rotation.x =
      step * legAmplitude * this.movementBlend +
      risingBlend * 0.12 -
      fallingBlend * 0.2;

    this.rig.rightLeg.rotation.x =
      -step * legAmplitude * this.movementBlend +
      risingBlend * 0.12 -
      fallingBlend * 0.2;

    // Arms swing during movement and react while airborne.
    this.rig.leftArm.rotation.x =
      -step * armAmplitude * this.movementBlend -
      risingBlend * 0.45 +
      fallingBlend * 0.22;

    this.rig.rightArm.rotation.x =
      step * armAmplitude * this.movementBlend -
      risingBlend * 0.45 +
      fallingBlend * 0.22;

    this.rig.leftArm.rotation.z =
      -this.airborneBlend * 0.1;

    this.rig.rightArm.rotation.z =
      this.airborneBlend * 0.1;

    // Idle breathing, walking bob and landing reaction.
    const idleBreathing =
      Math.sin(this.elapsedTime * 2.1) *
      0.012 *
      (1 - this.movementBlend) *
      (1 - this.airborneBlend);

    const movementBob =
      Math.abs(Math.sin(this.walkPhase * 2)) *
      0.04 *
      this.movementBlend;

    const landingDip = this.landingImpact * 0.08;

    this.rig.body.position.y =
      idleBreathing + movementBob - landingDip;

    this.rig.body.rotation.x =
      -risingBlend * 0.08 +
      fallingBlend * 0.12 +
      this.landingImpact * 0.1;

    this.rig.body.rotation.z =
      step * 0.018 * this.movementBlend +
      this.landingImpact * 0.025;
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
