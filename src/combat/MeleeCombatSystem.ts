import { Sphere, Vector3 } from 'three';

import { EnemyDummy } from '../entities/EnemyDummy';
import { PlayerController } from '../entities/PlayerController';

export type AttackResolution = 'HIT' | 'MISS' | 'DEFEATED';

const ATTACK_DAMAGE = 25;
const ATTACK_FORWARD_OFFSET = 0.95;
const ATTACK_RADIUS = 0.88;
const PLAYER_CHEST_HEIGHT = 1.05;

export class MeleeCombatSystem {
  private readonly player: PlayerController;
  private readonly enemy: EnemyDummy;

  private readonly attackVolume = new Sphere(
    new Vector3(),
    ATTACK_RADIUS,
  );

  private readonly verticalOffset = new Vector3(
    0,
    PLAYER_CHEST_HEIGHT,
    0,
  );

  private readonly targetDirection = new Vector3();

  constructor(
    player: PlayerController,
    enemy: EnemyDummy,
  ) {
    this.player = player;
    this.enemy = enemy;
  }

  tryStartAttack(grounded: boolean): boolean {
    return this.player.tryStartAttack(grounded);
  }

  update(): AttackResolution | null {
    if (!this.player.consumeAttackImpact()) {
      return null;
    }

    if (!this.enemy.isAlive) {
      return null;
    }

    const forward = this.player.forwardDirection;

    this.attackVolume.center
      .copy(this.player.position)
      .add(this.verticalOffset)
      .addScaledVector(forward, ATTACK_FORWARD_OFFSET);

    this.targetDirection.subVectors(
      this.enemy.position,
      this.player.position,
    );

    const forwardDistance =
      this.targetDirection.x * forward.x +
      this.targetDirection.z * forward.z;

    if (
      forwardDistance <= 0 ||
      !this.attackVolume.intersectsSphere(
        this.enemy.getHurtbox(),
      )
    ) {
      return 'MISS';
    }

    const damage = this.enemy.takeDamage(ATTACK_DAMAGE);

    if (damage.isDead) {
      return 'DEFEATED';
    }

    return damage.appliedDamage > 0 ? 'HIT' : 'MISS';
  }
}
