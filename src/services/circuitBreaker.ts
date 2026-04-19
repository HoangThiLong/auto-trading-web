/**
 * CircuitBreaker u2014 Generic fault-tolerance pattern implementation.
 *
 * States:
 *   CLOSED     u2192 Normal operation (all requests pass through)
 *   OPEN       u2192 Blocking all requests (failure threshold exceeded)
 *   HALF_OPEN  u2192 Probing: allows ONE request to test if service recovered
 *
 * State machine:
 *   CLOSED  u2500u2500[failures >= threshold]u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u25ba OPEN
 *   OPEN    u2500u2500[cooldown elapsed]u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u25ba HALF_OPEN
 *   HALF_OPEN u2500[success]u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u25ba CLOSED
 *   HALF_OPEN u2500[failure]u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u25ba OPEN (reset timer)
 */

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening the circuit. Default: 3 */
  failureThreshold: number;
  /** Milliseconds to wait in OPEN state before transitioning to HALF_OPEN. Default: 60_000 */
  cooldownMs: number;
  /** Optional callback invoked whenever the breaker state changes. */
  onStateChange?: (name: string, from: CircuitBreakerState, to: CircuitBreakerState) => void;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private consecutiveFailures = 0;
  private openedAt: number | null = null;
  private readonly name: string;
  private readonly config: Required<Omit<CircuitBreakerConfig, 'onStateChange'>> & {
    onStateChange?: CircuitBreakerConfig['onStateChange'];
  };

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = {
      failureThreshold: config.failureThreshold ?? 3,
      cooldownMs: config.cooldownMs ?? 60_000,
      onStateChange: config.onStateChange,
    };
  }

  // u2500u2500u2500 State Queries u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500

  getName(): string {
    return this.name;
  }

  /**
   * Get the current state, transitioning OPEN u2192 HALF_OPEN if cooldown has elapsed.
   * Always call this to get the "live" state before making a decision.
   */
  getState(): CircuitBreakerState {
    if (this.state === 'OPEN' && this.openedAt !== null) {
      const elapsed = Date.now() - this.openedAt;
      if (elapsed >= this.config.cooldownMs) {
        this.transitionTo('HALF_OPEN');
      }
    }
    return this.state;
  }

  /**
   * Returns true if the circuit is OPEN (blocking requests).
   * Use this as a fast-path check before calling an external service.
   */
  isOpen(): boolean {
    return this.getState() === 'OPEN';
  }

  /**
   * Returns true if the circuit allows a request to pass through.
   * CLOSED u2192 always allowed
   * HALF_OPEN u2192 allowed (probe request)
   * OPEN u2192 blocked
   */
  isAllowed(): boolean {
    const state = this.getState();
    return state === 'CLOSED' || state === 'HALF_OPEN';
  }

  /** Get current consecutive failure count. */
  getFailureCount(): number {
    return this.consecutiveFailures;
  }

  /** Get timestamp when circuit was last opened, or null. */
  getOpenedAt(): number | null {
    return this.openedAt;
  }

  /** Get milliseconds remaining until HALF_OPEN transition (if OPEN). */
  getCooldownRemaining(): number {
    if (this.state !== 'OPEN' || this.openedAt === null) return 0;
    const remaining = this.config.cooldownMs - (Date.now() - this.openedAt);
    return Math.max(0, remaining);
  }

  /** Serializable snapshot for REST API responses. */
  getSnapshot() {
    return {
      name: this.name,
      state: this.getState(),
      consecutiveFailures: this.consecutiveFailures,
      failureThreshold: this.config.failureThreshold,
      cooldownMs: this.config.cooldownMs,
      cooldownRemainingMs: this.getCooldownRemaining(),
      openedAt: this.openedAt,
    };
  }

  // u2500u2500u2500 Recording Outcomes u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500

  /**
   * Record a successful call. Resets failure count.
   * HALF_OPEN u2192 CLOSED on success.
   */
  recordSuccess(): void {
    const prevState = this.state;
    this.consecutiveFailures = 0;

    if (prevState === 'HALF_OPEN') {
      this.transitionTo('CLOSED');
    }
    // CLOSED stays CLOSED on success (no state change needed)
  }

  /**
   * Record a failed call. Increments failure counter.
   * CLOSED  u2192 OPEN when failures >= threshold
   * HALF_OPEN u2192 OPEN immediately (probe failed)
   */
  recordFailure(): void {
    this.consecutiveFailures++;
    const prevState = this.state;

    if (prevState === 'HALF_OPEN') {
      // Probe failed: go back to OPEN and reset cooldown timer
      this.openedAt = Date.now();
      this.transitionTo('OPEN');
    } else if (prevState === 'CLOSED' && this.consecutiveFailures >= this.config.failureThreshold) {
      this.openedAt = Date.now();
      this.transitionTo('OPEN');
    }
    // OPEN stays OPEN (failures already counted, we just accumulate)
  }

  /**
   * Manually reset the breaker to CLOSED state.
   * Useful for admin override via REST API.
   */
  reset(): void {
    this.consecutiveFailures = 0;
    this.openedAt = null;
    this.transitionTo('CLOSED');
  }

  // u2500u2500u2500 Wrap Helper u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500

  /**
   * Execute a function protected by the circuit breaker.
   * Returns the function result, or the `fallback` value if the circuit is OPEN.
   *
   * @example
   * const forecast = await timesfmBreaker.execute(
   *   () => fetchTimesFmForecast(closes, 12),
   *   null  // fallback when circuit is open
   * );
   */
  async execute<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    if (!this.isAllowed()) {
      const remaining = Math.round(this.getCooldownRemaining() / 1000);
      console.warn(
        `[CircuitBreaker:${this.name}] u26a0ufe0f OPEN u2014 skipping call. Retry in ${remaining}s.`,
      );
      return fallback;
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[CircuitBreaker:${this.name}] u274c Failure recorded (${this.consecutiveFailures}/${this.config.failureThreshold}): ${msg}`);
      return fallback;
    }
  }

  // u2500u2500u2500 Private u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500

  private transitionTo(next: CircuitBreakerState): void {
    const prev = this.state;
    if (prev === next) return;

    this.state = next;

    const label = next === 'OPEN'
      ? 'u26d4 OPENED'
      : next === 'HALF_OPEN'
        ? 'ud83dudfe1 HALF-OPEN (probing)'
        : 'u2705 CLOSED (recovered)';

    console.log(
      `[CircuitBreaker:${this.name}] ${prev} u2192 ${next} ${label}`,
    );

    this.config.onStateChange?.(this.name, prev, next);
  }
}

// u2500u2500u2500 Singleton instances for shared use u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500u2500

/**
 * Pre-configured Circuit Breaker for the TimesFM Python backend.
 * Opens after 3 consecutive 5xx / network failures.
 * Cooldown: 60 seconds before probing again.
 */
export const timesfmCircuitBreaker = new CircuitBreaker('timesfm', {
  failureThreshold: 3,
  cooldownMs: 60_000,
});

/**
 * Pre-configured Circuit Breaker for external AI providers (Gemini, Groq, etc.).
 * More lenient: 5 failures, 30 second cooldown.
 */
export const aiCircuitBreaker = new CircuitBreaker('ai-providers', {
  failureThreshold: 5,
  cooldownMs: 30_000,
});
