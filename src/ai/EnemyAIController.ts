import { Vector3 } from 'three';

import { EnemyDummy } from '../entities/EnemyDummy';
import { PlayerController } from '../entities/PlayerController';

export type EnemyAIState =
  | 'IDLE'
  | 'CHASE'
  | 'WINDUP'
  | 'RECOVERY'
  | 'STAGGER'
  | 'RETURN'
  | 'DEAD';

export type EnemyAttackOutcome = 'HIT' | 'BLOCKED' | 'MISS';

const DETECTION_RADIUS = 7.5;
const LEASH_RADIUS = 10;
const CHASE_SPEED = 2.25;
const RETURN_SPEED = 2.8;
const ATTACK_RANGE = 1.5;
const ATTACK_CANCEL_RANGE = 1.95;
const STRIKE_RANGE = 1.72;
const ATTACK_HALF_ANGLE = Math.PI / 3;
const STOP_DISTANCE = 1.08;
const ATTACK_WINDUP = 0.82;
const ATTACK_RECOVERY = 1.35;
const ATTACK_DAMAGE = 10;
const STAGGER_DURATION = 0.46;
const KNOCKBACK_DURATION = 0.16;
const KNOCKBACK_DISTANCE = 0.58;

export class EnemyAIController {
  private readonly enemy: EnemyDummy;
  private readonly player: PlayerController;
  private readonly homePosition: Vector3;
  private readonly direction = new Vector3();
  private readonly lockedAttackDirection = new Vector3();
  private readonly knockbackDirection = new Vector3();
  private knockbackElapsed = 0;

  private currentState: EnemyAIState = 'IDLE';
  private stateTimer = 0;

  constructor(enemy: EnemyDummy, player: PlayerController) {
    this.enemy = enemy;
    this.player = player;
    this.homePosition = enemy.position.clone();
  }

  get state(): EnemyAIState {
    return this.currentState;
  }

  applyStagger(sourcePosition: Vector3): void {
    if (!this.enemy.isAlive) return;

    this.knockbackDirection.set(
      this.enemy.position.x - sourcePosition.x,
      0,
      this.enemy.position.z - sourcePosition.z,
    );

    if (this.knockbackDirection.lengthSq() < 0.0001) {
      this.knockbackDirection.copy(this.enemy.forwardDirection);
    } else {
      this.knockbackDirection.normalize();
    }

    this.knockbackElapsed = 0;
    this.stateTimer = 0;
    this.currentState = 'STAGGER';
    this.enemy.setCombatPose('STAGGER');
  }

  update(deltaTime: number): EnemyAttackOutcome | null {
    if (deltaTime <= 0) return null;

    if (!this.enemy.isAlive) {
      this.transition('DEAD');
      return null;
    }

    const distanceToPlayer = this.horizontalDistance(
      this.enemy.position,
      this.player.position,
    );
    const distanceFromHome = this.horizontalDistance(
      this.enemy.position,
      this.homePosition,
    );

    if (!this.player.isAlive && this.currentState !== 'RETURN') {
      this.transition('RETURN');
    }

    switch (this.currentState) {
      case 'IDLE': {
        if (
          this.player.isAlive &&
          distanceToPlayer <= DETECTION_RADIUS
        ) {
          this.transition('CHASE');
        }
        break;
      }

      case 'CHASE': {
        if (distanceFromHome > LEASH_RADIUS) {
          this.transition('RETURN');
          break;
        }

        this.enemy.faceTarget(this.player.position, deltaTime);

        if (distanceToPlayer <= ATTACK_RANGE) {
          // Lock the attack direction at the start of the telegraph.
          // The enemy must not rotate to track the player during windup.
          this.enemy.faceTargetImmediately(this.player.position);
          this.lockedAttackDirection.copy(this.enemy.forwardDirection);
          this.transition('WINDUP');
          break;
        }

        this.moveTowards(
          this.player.position,
          CHASE_SPEED,
          STOP_DISTANCE,
          deltaTime,
        );
        break;
      }

      case 'WINDUP': {
        // The facing direction is locked; the ground wedge shows this exact hit zone.
        this.stateTimer += deltaTime;

        if (distanceToPlayer > ATTACK_CANCEL_RANGE) {
          this.transition('CHASE');
          break;
        }

        if (this.stateTimer >= ATTACK_WINDUP) {
          this.transition('RECOVERY');

          this.direction.set(
            this.player.position.x - this.enemy.position.x,
            0,
            this.player.position.z - this.enemy.position.z,
          );

          if (
            distanceToPlayer > STRIKE_RANGE ||
            this.direction.lengthSq() < 0.0001
          ) {
            return 'MISS';
          }

          this.direction.normalize();
          const facingDot = this.lockedAttackDirection.dot(this.direction);
          if (facingDot < Math.cos(ATTACK_HALF_ANGLE)) {
            return 'MISS';
          }

          const damage = this.player.takeDamage(
            ATTACK_DAMAGE,
            this.enemy.position,
          );
          if (damage.blockedByInvulnerability) return 'BLOCKED';
          return damage.appliedDamage > 0 ? 'HIT' : 'MISS';
        }
        break;
      }

      case 'RECOVERY': {
        this.enemy.faceTarget(this.player.position, deltaTime);
        this.stateTimer += deltaTime;

        if (this.stateTimer >= ATTACK_RECOVERY) {
          this.transition(this.player.isAlive ? 'CHASE' : 'RETURN');
        }
        break;
      }

      case 'STAGGER': {
        const previousProgress = Math.min(
          this.knockbackElapsed / KNOCKBACK_DURATION,
          1,
        );
        this.knockbackElapsed = Math.min(
          KNOCKBACK_DURATION,
          this.knockbackElapsed + deltaTime,
        );
        const currentProgress = this.knockbackElapsed / KNOCKBACK_DURATION;
        const previousEase = 1 - (1 - previousProgress) ** 2;
        const currentEase = 1 - (1 - currentProgress) ** 2;
        const knockbackStep = KNOCKBACK_DISTANCE * (currentEase - previousEase);

        this.enemy.position.x += this.knockbackDirection.x * knockbackStep;
        this.enemy.position.z += this.knockbackDirection.z * knockbackStep;
        this.stateTimer += deltaTime;

        if (this.stateTimer >= STAGGER_DURATION) {
          const shouldReturn =
            !this.player.isAlive || distanceFromHome > LEASH_RADIUS;
          this.transition(shouldReturn ? 'RETURN' : 'CHASE');
        }
        break;
      }

      case 'RETURN': {
        const distanceHome = this.horizontalDistance(
          this.enemy.position,
          this.homePosition,
        );

        if (distanceHome <= 0.16) {
          this.enemy.position.x = this.homePosition.x;
          this.enemy.position.z = this.homePosition.z;
          this.transition('IDLE');
          break;
        }

        this.enemy.faceTarget(this.homePosition, deltaTime);
        this.moveTowards(this.homePosition, RETURN_SPEED, 0, deltaTime);
        break;
      }

      case 'DEAD':
        break;
    }

    return null;
  }

  private transition(nextState: EnemyAIState): void {
    if (this.currentState === nextState) return;

    this.currentState = nextState;
    this.stateTimer = 0;

    if (nextState === 'WINDUP') {
      this.enemy.setCombatPose('WINDUP');
    } else if (nextState === 'RECOVERY') {
      this.enemy.setCombatPose('RECOVERY');
    } else if (nextState === 'STAGGER') {
      this.enemy.setCombatPose('STAGGER');
    } else {
      this.enemy.setCombatPose('IDLE');
    }
  }

  private moveTowards(
    target: Vector3,
    speed: number,
    stopDistance: number,
    deltaTime: number,
  ): void {
    this.direction.set(
      target.x - this.enemy.position.x,
      0,
      target.z - this.enemy.position.z,
    );

    const distance = this.direction.length();
    if (distance <= stopDistance || distance <= 0.0001) return;

    const travelDistance = Math.min(
      speed * deltaTime,
      distance - stopDistance,
    );

    this.direction.multiplyScalar(1 / distance);
    this.enemy.position.x += this.direction.x * travelDistance;
    this.enemy.position.z += this.direction.z * travelDistance;
  }

  private horizontalDistance(a: Vector3, b: Vector3): number {
    const dx = a.x - b.x;
    const dz = a.z - b.z;
    return Math.sqrt(dx * dx + dz * dz);
  }
}
