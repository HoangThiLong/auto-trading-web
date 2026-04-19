import { readRuntimeEnv } from '../utils/runtimeEnv';
import { timesfmCircuitBreaker } from './circuitBreaker';

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const resolveTimesFmBaseUrl = (): string => {
  const configuredBaseUrl = readRuntimeEnv('VITE_TIMESFM_API_BASE_URL')
    || readRuntimeEnv('TIMESFM_API_BASE_URL');

  if (configuredBaseUrl) {
    return normalizeBaseUrl(configuredBaseUrl);
  }

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  return isLocalhost ? 'http://127.0.0.1:8000' : '';
};

const TIMESFM_API_BASE_URL = resolveTimesFmBaseUrl();

/**
 * Fetch time-series forecast from the TimesFM Python backend.
 *
 * Protected by a Circuit Breaker:
 *   - CLOSED: Normal operation, calls the API.
 *   - OPEN: Skips the API call immediately, returns null (fallback).
 *   - HALF_OPEN: Sends one probe request. If it succeeds, circuit closes.
 *
 * When the circuit is OPEN, the bot automatically falls back to
 * AI Debate + Technical Analysis only (no quantitative forecast).
 */
export async function fetchTimesFmForecast(historyData: number[], horizon = 12): Promise<number[] | null> {
  if (!TIMESFM_API_BASE_URL) {
    console.warn('TimesFM API base URL is missing. Set VITE_TIMESFM_API_BASE_URL or TIMESFM_API_BASE_URL.');
    return null;
  }

  // Circuit Breaker protection: if OPEN, return null immediately
  return timesfmCircuitBreaker.execute(
    async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000); // 10s timeout

      try {
        const res = await fetch(`${TIMESFM_API_BASE_URL}/api/forecast`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ history: historyData, horizon }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
          // Throw to trigger circuit breaker recordFailure
          throw new Error(`TimesFM API returned HTTP ${res.status}`);
        }

        const data = await res.json();
        return data.point_forecast || null;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err; // Rethrow so CircuitBreaker.execute() catches it
      }
    },
    null, // fallback when circuit is open
  );
}

/**
 * Re-export the circuit breaker instance so bot.ts / REST API can inspect its state.
 */
export { timesfmCircuitBreaker } from './circuitBreaker';
