/**
 * ConnectionManager — Intelligent network failover for MEXC API.
 *
 * Strategy:
 * 1. All requests try DIRECT connection first.
 * 2. If direct fails (ERR_CONNECTION_RESET, timeout, etc.), auto-switch to RELAY mode
 *    using free CORS proxy relays (only for PUBLIC unsigned endpoints).
 * 3. Background health probes run every 30s when in RELAY mode.
 *    When 3 consecutive direct probes succeed, auto-revert to DIRECT.
 * 4. Private/signed requests (API key headers) NEVER go through relay for security.
 *
 * Cost: $0 — uses free public CORS proxy relays with round-robin fallback.
 */

import { CircuitBreaker } from './circuitBreaker';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ConnectionMode = 'DIRECT' | 'RELAY';

interface RelayProvider {
  name: string;
  /** Transform the original URL into a relayed URL */
  transform: (url: string) => string;
  /** Whether this provider is currently considered healthy */
  healthy: boolean;
}

interface ProbeResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

type ModeChangeCallback = (mode: ConnectionMode, reason: string) => void;

// ─── Constants ──────────────────────────────────────────────────────────────

const PROBE_URL = 'https://contract.mexc.com/api/v1/contract/ping';
const PROBE_TIMEOUT_MS = 8_000;
const RELAY_PROBE_INTERVAL_MS = 30_000;       // Check direct every 30s while in relay mode
const DIRECT_HEALTH_CHECK_INTERVAL_MS = 60_000; // Light check every 60s while in direct mode
const CONSECUTIVE_SUCCESS_TO_REVERT = 3;       // Need 3 good probes to revert to direct
const CONSECUTIVE_FAILURES_TO_RELAY = 2;       // Need 2 failures to switch to relay
const REQUEST_TIMEOUT_MS = 12_000;              // Per-request timeout for direct
const RELAY_REQUEST_TIMEOUT_MS = 6_000;         // Shorter timeout for relay (fail fast)
const MAX_CONSECUTIVE_RELAY_FAILURES = 5;       // Auto-revert to DIRECT after this many relay failures

// ─── Relay Providers (free, no cost) ────────────────────────────────────────

const RELAY_PROVIDERS: RelayProvider[] = [
  {
    name: 'corsproxy.io',
    transform: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    healthy: true,
  },
  {
    name: 'allorigins',
    transform: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    healthy: true,
  },
  {
    name: 'cors.sh',
    transform: (url) => `https://cors.sh/${url}`,
    healthy: true,
  },
];

// ─── ConnectionManager Singleton ────────────────────────────────────────────

class ConnectionManager {
  private mode: ConnectionMode = 'DIRECT';
  private consecutiveDirectSuccesses = 0;
  private consecutiveDirectFailures = 0;
  private currentRelayIndex = 0;
  private probeIntervalId: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<ModeChangeCallback> = new Set();
  private totalRelayRequests = 0;
  private totalDirectRequests = 0;
  private consecutiveRelayFailures = 0;
  private relayCircuitBreaker = new CircuitBreaker('relay-proxy', {
    failureThreshold: 3,
    cooldownMs: 45_000, // 45 seconds before probing relay again
  });

  constructor() {
    // Start health monitoring
    this.startHealthMonitor();
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /** Current connection mode */
  getMode(): ConnectionMode {
    return this.mode;
  }

  /** Get stats for UI display */
  getStats() {
    return {
      mode: this.mode,
      consecutiveDirectSuccesses: this.consecutiveDirectSuccesses,
      consecutiveDirectFailures: this.consecutiveDirectFailures,
      consecutiveRelayFailures: this.consecutiveRelayFailures,
      totalRelayRequests: this.totalRelayRequests,
      totalDirectRequests: this.totalDirectRequests,
      currentRelay: this.mode === 'RELAY' ? RELAY_PROVIDERS[this.currentRelayIndex]?.name : null,
      relayProviders: RELAY_PROVIDERS.map(p => ({ name: p.name, healthy: p.healthy })),
      relayCircuitBreaker: this.relayCircuitBreaker.getSnapshot(),
    };
  }

  /** Subscribe to mode changes */
  onModeChange(cb: ModeChangeCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /**
   * Execute a fetch request with automatic failover.
   * - If mode is DIRECT, tries direct first. On failure, retries via relay.
   * - If mode is RELAY, goes through relay directly.
   * - Private requests (hasAuthHeaders=true) NEVER use relay.
   */
  async fetch(
    url: string,
    options: RequestInit,
    hasAuthHeaders = false,
  ): Promise<Response> {
    // Private/signed requests: always direct, never relay
    if (hasAuthHeaders) {
      this.totalDirectRequests++;
      return this.fetchDirect(url, options);
    }

    if (this.mode === 'DIRECT') {
      try {
        const res = await this.fetchDirect(url, options);
        this.onDirectSuccess();
        this.totalDirectRequests++;
        return res;
      } catch (err) {
        this.onDirectFailure();
        // If we just switched to relay, try relay
        if (this.getMode() === 'RELAY') {
          this.totalRelayRequests++;
          return this.fetchViaRelay(url, options);
        }
        throw err;
      }
    } else {
      // Already in relay mode — check circuit breaker first
      if (this.relayCircuitBreaker.isOpen()) {
        // Relay circuit is open — fall back to direct silently
        try {
          const res = await this.fetchDirect(url, options);
          this.onDirectSuccess();
          return res;
        } catch (directErr) {
          throw directErr;
        }
      }

      try {
        this.totalRelayRequests++;
        const res = await this.fetchViaRelay(url, options);
        this.relayCircuitBreaker.recordSuccess();
        this.consecutiveRelayFailures = 0;
        return res;
      } catch (relayErr) {
        console.warn('[ConnMgr] Relay request failed, falling back to direct:', relayErr);
        this.relayCircuitBreaker.recordFailure();
        this.consecutiveRelayFailures++;

        // Auto-revert to DIRECT if relay keeps failing
        if (this.consecutiveRelayFailures >= MAX_CONSECUTIVE_RELAY_FAILURES) {
          console.warn(`[ConnMgr] ⚠️ ${MAX_CONSECUTIVE_RELAY_FAILURES} consecutive relay failures — reverting to DIRECT`);
          this.setMode('DIRECT', 'relay circuit exhausted');
          this.consecutiveRelayFailures = 0;
        }

        // Relay failed — try direct as last resort
        try {
          const res = await this.fetchDirect(url, options);
          this.onDirectSuccess();
          return res;
        } catch (directErr) {
          throw directErr;
        }
      }
    }
  }

  /**
   * Get a relay-transformed URL for WebSocket fallback polling.
   * Returns null if direct mode or no healthy relay.
   */
  getRelayUrl(url: string): string | null {
    if (this.mode === 'DIRECT') return null;
    const provider = this.getHealthyRelay();
    if (!provider) return null;
    return provider.transform(url);
  }

  /** Force switch to a specific mode (for testing/manual override) */
  forceMode(mode: ConnectionMode, reason = 'manual'): void {
    if (mode === 'DIRECT') {
      this.consecutiveRelayFailures = 0;
      this.relayCircuitBreaker.reset();
    }
    this.setMode(mode, reason);
  }

  /** Clean up intervals */
  destroy(): void {
    if (this.probeIntervalId) {
      clearInterval(this.probeIntervalId);
      this.probeIntervalId = null;
    }
    this.listeners.clear();
  }

  // ─── Private: Fetch Methods ─────────────────────────────────────────────

  private async fetchDirect(url: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok && (res.status >= 500 || res.status === 0)) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  private async fetchViaRelay(url: string, options: RequestInit): Promise<Response> {
    const errors: string[] = [];

    // Try each healthy relay provider
    for (let i = 0; i < RELAY_PROVIDERS.length; i++) {
      const idx = (this.currentRelayIndex + i) % RELAY_PROVIDERS.length;
      const provider = RELAY_PROVIDERS[idx];

      if (!provider.healthy) continue;

      const relayUrl = provider.transform(url);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), RELAY_REQUEST_TIMEOUT_MS);

      try {
        // Strip auth headers for relay (safety)
        const safeHeaders = { ...options.headers } as Record<string, string>;
        delete safeHeaders['ApiKey'];
        delete safeHeaders['Signature'];
        delete safeHeaders['Request-Time'];

        const res = await fetch(relayUrl, {
          ...options,
          headers: safeHeaders,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (res.ok) {
          // This relay works — prefer it next time
          this.currentRelayIndex = idx;
          console.log(`[ConnMgr] ✅ Relay success via ${provider.name}`);
          return res;
        }

        errors.push(`${provider.name}: HTTP ${res.status}`);
        provider.healthy = false;
      } catch (err: any) {
        clearTimeout(timeoutId);
        errors.push(`${provider.name}: ${err.message}`);
        provider.healthy = false;
      }
    }

    // All relays failed — reset health for next attempt
    RELAY_PROVIDERS.forEach(p => (p.healthy = true));
    throw new Error(`All relay providers failed: ${errors.join('; ')}`);
  }

  // ─── Private: Health Monitoring ──────────────────────────────────────────

  private startHealthMonitor(): void {
    if (this.probeIntervalId) return;

    this.probeIntervalId = setInterval(() => {
      void this.runHealthProbe();
    }, this.mode === 'RELAY' ? RELAY_PROBE_INTERVAL_MS : DIRECT_HEALTH_CHECK_INTERVAL_MS);
  }

  private restartHealthMonitor(): void {
    if (this.probeIntervalId) {
      clearInterval(this.probeIntervalId);
      this.probeIntervalId = null;
    }
    this.startHealthMonitor();
  }

  private async runHealthProbe(): Promise<void> {
    const result = await this.probeDirect();

    if (this.mode === 'RELAY') {
      if (result.ok) {
        this.consecutiveDirectSuccesses++;
        console.log(
          `[ConnMgr] 🔍 Direct probe OK (${result.latencyMs}ms) — ` +
          `${this.consecutiveDirectSuccesses}/${CONSECUTIVE_SUCCESS_TO_REVERT} to revert`,
        );

        if (this.consecutiveDirectSuccesses >= CONSECUTIVE_SUCCESS_TO_REVERT) {
          this.setMode('DIRECT', `direct recovered (${CONSECUTIVE_SUCCESS_TO_REVERT} consecutive probes OK)`);
        }
      } else {
        this.consecutiveDirectSuccesses = 0;
        console.log(`[ConnMgr] 🔍 Direct probe failed while in relay: ${result.error}`);
      }
    } else {
      // In direct mode — just track failures
      if (!result.ok) {
        this.consecutiveDirectFailures++;
        if (this.consecutiveDirectFailures >= CONSECUTIVE_FAILURES_TO_RELAY) {
          this.switchToRelay('health probe detected instability');
        }
      } else {
        this.consecutiveDirectFailures = 0;
      }
    }
  }

  private async probeDirect(): Promise<ProbeResult> {
    const t0 = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    try {
      const res = await fetch(PROBE_URL, { signal: controller.signal });
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - t0;

      if (!res.ok) {
        return { ok: false, latencyMs, error: `HTTP ${res.status}` };
      }

      return { ok: true, latencyMs };
    } catch (err: any) {
      clearTimeout(timeoutId);
      return { ok: false, latencyMs: Date.now() - t0, error: err.message };
    }
  }

  // ─── Private: State Transitions ─────────────────────────────────────────

  private onDirectSuccess(): void {
    this.consecutiveDirectFailures = 0;
  }

  private onDirectFailure(): void {
    this.consecutiveDirectFailures++;

    if (this.consecutiveDirectFailures >= CONSECUTIVE_FAILURES_TO_RELAY) {
      this.switchToRelay('consecutive request failures');
    }
  }

  private switchToRelay(reason: string): void {
    if (this.mode === 'RELAY') return;
    this.setMode('RELAY', reason);
  }

  private setMode(newMode: ConnectionMode, reason: string): void {
    if (this.mode === newMode) return;

    const oldMode = this.mode;
    this.mode = newMode;

    // Reset counters
    if (newMode === 'DIRECT') {
      this.consecutiveDirectFailures = 0;
      this.consecutiveDirectSuccesses = 0;
    } else {
      this.consecutiveDirectSuccesses = 0;
      // Reset relay provider health
      RELAY_PROVIDERS.forEach(p => (p.healthy = true));
    }

    console.log(`[ConnMgr] 🔄 Mode: ${oldMode} → ${newMode} | Reason: ${reason}`);

    // Restart monitor with appropriate interval
    this.restartHealthMonitor();

    // Notify listeners
    this.listeners.forEach(cb => {
      try {
        cb(newMode, reason);
      } catch (listenerErr) {
        console.warn('[ConnMgr] Listener callback error:', listenerErr);
      }
    });
  }

  private getHealthyRelay(): RelayProvider | null {
    for (let i = 0; i < RELAY_PROVIDERS.length; i++) {
      const idx = (this.currentRelayIndex + i) % RELAY_PROVIDERS.length;
      if (RELAY_PROVIDERS[idx].healthy) return RELAY_PROVIDERS[idx];
    }
    return null;
  }
}

// ─── Singleton Export ───────────────────────────────────────────────────────

export const connectionManager = new ConnectionManager();
