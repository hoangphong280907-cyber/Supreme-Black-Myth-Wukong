export interface DamageResult {
  requestedDamage: number;
  appliedDamage: number;
  currentHealth: number;
  maxHealth: number;
  isDead: boolean;
  blockedByInvulnerability: boolean;
}

export class HealthComponent {
  readonly maxHealth: number;

  private health: number;

  constructor(maxHealth: number) {
    if (!Number.isFinite(maxHealth) || maxHealth <= 0) {
      throw new Error('Max health must be a positive finite number.');
    }

    this.maxHealth = maxHealth;
    this.health = maxHealth;
  }

  get currentHealth(): number {
    return this.health;
  }

  get healthRatio(): number {
    return this.health / this.maxHealth;
  }

  get isDead(): boolean {
    return this.health <= 0;
  }

  applyDamage(
    requestedDamage: number,
    invulnerable = false,
  ): DamageResult {
    const damage =
      Number.isFinite(requestedDamage)
        ? Math.max(0, requestedDamage)
        : 0;

    const blocked =
      invulnerable &&
      damage > 0 &&
      !this.isDead;

    const previousHealth = this.health;

    if (!this.isDead && !blocked) {
      this.health = Math.max(
        0,
        this.health - damage,
      );
    }

    return {
      requestedDamage: damage,
      appliedDamage: previousHealth - this.health,
      currentHealth: this.health,
      maxHealth: this.maxHealth,
      isDead: this.isDead,
      blockedByInvulnerability: blocked,
    };
  }

  restoreToFull(): void {
    this.health = this.maxHealth;
  }

  heal(amount: number): number {
    if (this.isDead || !Number.isFinite(amount) || amount <= 0) {
      return 0;
    }

    const previousHealth = this.health;

    this.health = Math.min(
      this.maxHealth,
      this.health + amount,
    );

    return this.health - previousHealth;
  }
}
