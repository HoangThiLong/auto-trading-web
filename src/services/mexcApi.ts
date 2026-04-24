/// <reference types="vite/client" />
import CryptoJS from 'crypto-js';
import { readRuntimeEnv } from '../utils/runtimeEnv';
import { connectionManager } from './connectionManager';
import type { ContractTicker, KlineData, OrderBook, FundingRate, ContractInfo, TimeInterval, RecentTrade } from '../types';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** Detect if request options contain authentication headers (ApiKey/Signature) */
function hasAuthHeaders(options?: RequestInit): boolean {
  if (!options?.headers) return false;
  const h = options.headers as Record<string, string>;
  return !!(h['ApiKey'] || h['Signature']);
}

/**
 * Smart fetch with retry + automatic failover via ConnectionManager.
 * - Public requests: direct first, auto-relay on failure.
 * - Private/signed requests: always direct (never relayed for security).
 */
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  const isPrivate = hasAuthHeaders(options);
  let attempt = 0;

  while (true) {
    try {
      // Use ConnectionManager for intelligent routing
      const res = await connectionManager.fetch(url, {
        ...options,
        headers: { ...options.headers as Record<string, string> },
      }, isPrivate);

      // Retry on 429 (Rate Limit) or 5xx (Server Error)
      if (!res.ok && (res.status === 429 || res.status >= 500)) {
        if (attempt >= maxRetries) {
          throw new Error(`HTTP ${res.status}: Max retries reached after ${attempt} attempts`);
        }

        const delay = (Math.pow(2, attempt) * 1000) + Math.random() * 500;
        console.warn(`[MEXC HTTP] Status ${res.status} (attempt ${attempt + 1}). Retrying in ${Math.round(delay)}ms...`);
        await wait(delay);
        attempt++;
        continue;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err: any) {
      if (attempt >= maxRetries) {
        throw err;
      }

      const isNetworkError = err.name === 'AbortError' || err.message?.includes('network') || err.message?.includes('reset');
      const delay = (Math.pow(2, attempt) * 1000) + Math.random() * 500;

      console.warn(`[MEXC HTTP] ${isNetworkError ? 'Network Error' : 'Error'}: ${err.message}. Retrying in ${Math.round(delay)}ms...`);
      await wait(delay);
      attempt++;
    }
  }
}

// MEXC Network URLs - determined at runtime
// Note: MEXC Futures have a dedicated endpoint: wss://contract.mexc.com/edge
// REST API uses https://api.mexc.com
const MEXC_NETWORKS: Record<'live' | 'demo', { rest: string; ws: string }> = {
  live: {
    rest: 'https://api.mexc.com',
    ws: 'wss://contract.mexc.com/edge',
  },
  demo: {
    rest: 'https://api.mexc.com',
    ws: 'wss://contract.mexc.com/edge',
  },
};

// Runtime global override for UI-driven network switching
const GLOBAL_NETWORK_KEY = '__ctxMexcNetwork' as const;

const getMexcNetwork = (): 'live' | 'demo' => {
  // 1. Check globalThis override (set by UI when switching networks)
  const globalOverride = (globalThis as unknown as Record<string, string>)[GLOBAL_NETWORK_KEY];
  if (globalOverride === 'demo' || globalOverride === 'live') return globalOverride;

  // 2. Check runtime environment variable
  try {
    const envNetwork = readRuntimeEnv('MEXC_NETWORK');
    if (envNetwork === 'demo' || envNetwork === 'live') return envNetwork;
  } catch {
    // readRuntimeEnv might throw if file not found, ignore
  }

  // 3. Default to live
  return 'live';
};

/**
 * Called by UI when user toggles network in ApiKeyModal.
 * Updates the global override so mexcApi uses the new network immediately without reload.
 */
export function setRuntimeMexcNetwork(network: 'live' | 'demo') {
  (globalThis as unknown as Record<string, string>)[GLOBAL_NETWORK_KEY] = network;
  console.log(`[MEXC API] 🌐 Switched to ${network.toUpperCase()} network`);
}

// Current network config
export const getMexcApiRoot = (): string => {
  const net = getMexcNetwork();
  return MEXC_NETWORKS[net].rest;
};

export const getMexcWsUrl = (): string => {
  const net = getMexcNetwork();
  return MEXC_NETWORKS[net].ws;
};

// ─── Time Sync Manager (NTP-like offset against MEXC server) ────────────────

class TimeSyncManager {
  private offsetMs = 0;
  private lastSyncAt = 0;
  private syncIntervalRef: ReturnType<typeof setInterval> | null = null;
  private static readonly SYNC_INTERVAL_MS = 5 * 60_000; // 5 minutes
  private static readonly SYNC_TIMEOUT_MS = 5_000;
  private static readonly MAX_RETRIES = 3;

  /**
   * Returns the current server-corrected timestamp as a string.
   * If sync has never succeeded, falls back to local time (offset = 0).
   */
  getServerTimestamp(): string {
    return (Date.now() + this.offsetMs).toString();
  }

  /** Current offset in ms (server - local). Positive = server ahead. */
  getOffset(): number {
    return this.offsetMs;
  }

  /** Timestamp of last successful sync. */
  getLastSyncAt(): number {
    return this.lastSyncAt;
  }

  /**
   * Synchronize local clock against MEXC `/api/v1/contract/ping`.
   * Uses round-trip compensation for accuracy.
   */
  async syncTime(): Promise<void> {
    for (let attempt = 0; attempt < TimeSyncManager.MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(
          () => controller.abort(),
          TimeSyncManager.SYNC_TIMEOUT_MS,
        );

        const t0 = Date.now();
        const res = await fetch(`${getMexcApiRoot()}/api/v1/contract/ping`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          console.warn(`[TimeSync] Ping returned HTTP ${res.status}, attempt ${attempt + 1}`);
          await wait(1000 * (attempt + 1));
          continue;
        }

        const data = await res.json();
        const t1 = Date.now();
        const roundTripMs = t1 - t0;

        // MEXC contract /ping returns { data: serverTime(ms) }
        const serverTime = data?.data ?? data?.serverTime ?? null;
        if (typeof serverTime !== 'number' || serverTime <= 0) {
          console.warn('[TimeSync] Invalid server time response:', data);
          await wait(1000 * (attempt + 1));
          continue;
        }

        // Estimate: serverTime was captured at t0 + roundTrip/2
        this.offsetMs = serverTime - (t0 + Math.floor(roundTripMs / 2));
        this.lastSyncAt = t1;

        console.log(
          `[TimeSync] ✅ Synced | offset=${this.offsetMs}ms | roundTrip=${roundTripMs}ms`,
        );
        return;
      } catch (err: any) {
        const isAbort = err?.name === 'AbortError';
        console.warn(
          `[TimeSync] ${isAbort ? 'Timeout' : 'Error'} (attempt ${attempt + 1}/${TimeSyncManager.MAX_RETRIES}):`,
          err?.message || err,
        );
        await wait(1000 * (attempt + 1));
      }
    }

    console.error('[TimeSync] ❌ All sync attempts failed, using local time (offset=0)');
  }

  /** Start periodic sync. Safe to call multiple times. */
  startAutoSync(): void {
    if (this.syncIntervalRef) return;

    // Initial sync
    void this.syncTime();

    this.syncIntervalRef = setInterval(() => {
      void this.syncTime();
    }, TimeSyncManager.SYNC_INTERVAL_MS);
  }

  /** Stop periodic sync. */
  stopAutoSync(): void {
    if (this.syncIntervalRef) {
      clearInterval(this.syncIntervalRef);
      this.syncIntervalRef = null;
    }
  }
}

export const timeSyncManager = new TimeSyncManager();

// Auto-start time sync on module load
timeSyncManager.startAutoSync();

const buildRequestUrl = (url: string): string => {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const normalizedPath = url.startsWith('/') ? url : `/${url}`;
  return `${getMexcApiRoot()}${normalizedPath}`;
};

const api = {
  async get(url: string, options?: { params?: Record<string, any>; headers?: Record<string, string> }) {
    const finalUrl = buildRequestUrl(url);

    const queryStr = options?.params
      ? '?' + new URLSearchParams(
          Object.entries(options.params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])
        ).toString()
      : '';
      
    const res = await fetchWithRetry(finalUrl + queryStr, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
    return res.json();
  },
  async post(url: string, body: any, options?: { headers?: Record<string, string> }) {
    const finalUrl = buildRequestUrl(url);

    const res = await fetchWithRetry(finalUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      body: JSON.stringify(body),
    });
    return res.json();
  },
};

// ─── Public Market Data (no auth required) ─────────────────────────────────

export async function fetchAllTickers(): Promise<ContractTicker[]> {
  try {
    const data = await api.get('/api/v1/contract/ticker');
    if (data.success) {
      const result = data.data;
      return Array.isArray(result) ? result : [result];
    }
    return [];
  } catch (err) {
    console.warn('[MEXC] fetchAllTickers error:', err);
    return [];
  }
}

export async function fetchTicker(symbol: string): Promise<ContractTicker | null> {
  try {
    const data = await api.get('/api/v1/contract/ticker', { params: { symbol } });
    if (data.success) return data.data;
    return null;
  } catch (err) {
    console.warn('[MEXC] fetchTicker error:', err);
    return null;
  }
}

export async function fetchKlines(symbol: string, interval: TimeInterval = 'Min15', limit = 500): Promise<KlineData | null> {
  try {
    const end = Math.floor(Date.now() / 1000);
    const intervalSeconds: Record<TimeInterval, number> = {
      Min1: 60, Min5: 300, Min15: 900, Min30: 1800, Min60: 3600,
      Hour4: 14400, Hour8: 28800, Day1: 86400, Week1: 604800, Month1: 2592000,
    };
    const start = end - intervalSeconds[interval] * limit;
    const data = await api.get(`/api/v1/contract/kline/${symbol}`, {
      params: { interval, start, end },
    });
    if (data.success) return data.data;
    return null;
  } catch (err) {
    console.warn('[MEXC] fetchKlines error:', err);
    return null;
  }
}

export async function fetchOrderBook(symbol: string, limit = 20): Promise<OrderBook | null> {
  try {
    const data = await api.get(`/api/v1/contract/depth/${symbol}`, { params: { limit } });
    if (data.success) return data.data;
    return null;
  } catch (err) {
    console.warn('[MEXC] fetchOrderBook error:', err);
    return null;
  }
}

export async function fetchFundingRate(symbol: string): Promise<FundingRate | null> {
  try {
    const data = await api.get(`/api/v1/contract/funding_rate/${symbol}`);
    if (data.success) return data.data;
    return null;
  } catch (err) {
    console.warn('[MEXC] fetchFundingRate error:', err);
    return null;
  }
}

export async function fetchContractInfo(symbol?: string): Promise<ContractInfo[]> {
  try {
    const data = await api.get('/api/v1/contract/detail', { params: symbol ? { symbol } : {} });
    if (data.success) {
      const d = data.data;
      return Array.isArray(d) ? d : [d];
    }
    return [];
  } catch (err) {
    console.warn('[MEXC] fetchContractInfo error:', err);
    return [];
  }
}

export async function fetchRecentTrades(symbol: string, limit = 50): Promise<RecentTrade[]> {
  try {
    const data = await api.get(`/api/v1/contract/deals/${symbol}`, { params: { limit } });
    if (data.success) return data.data;
    return [];
  } catch (err) {
    console.warn('[MEXC] fetchRecentTrades error:', err);
    return [];
  }
}

// ─── Signed Requests (requires API key) ────────────────────────────────────

function signRequest(apiKey: string, secretKey: string, timestamp: string, body?: string): string {
  // V1 Contract API Signature: apiKey + timestamp + (body || '') — NO recvWindow
  const signStr = body ? apiKey + timestamp + body : apiKey + timestamp;
  return CryptoJS.HmacSHA256(signStr, secretKey).toString();
}

export async function fetchAccountInfo(apiKey: string, secretKey: string) {
  try {
    const timestamp = timeSyncManager.getServerTimestamp();
    const signature = signRequest(apiKey, secretKey, timestamp);

    console.log(`[MEXC] Fetching account info with timestamp=${timestamp}`);

    const data = await api.get('/api/v1/private/account/assets', {
      headers: {
        'ApiKey': apiKey,
        'Request-Time': timestamp,
        'Signature': signature,
        'Content-Type': 'application/json',
      },
    });
    if (data.success) return data.data;
    return null;
  } catch (err: any) {
    console.error('[MEXC] fetchAccountInfo error:', err);
    return null;
  }
}

export async function placeOrder(
  apiKey: string,
  secretKey: string,
  params: {
    symbol: string;
    price: number;
    vol: number;
    leverage: number;
    side: number;
    type: number;
    openType: number;
    stopLossPrice?: number;
    takeProfitPrice?: number;
  }
) {
  try {
    const timestamp = timeSyncManager.getServerTimestamp();
    const body = JSON.stringify(params);
    const signature = signRequest(apiKey, secretKey, timestamp, body);

    const data = await api.post('/api/v1/private/order/submit', params, {
      headers: {
        'ApiKey': apiKey,
        'Request-Time': timestamp,
        'Signature': signature,
        'Content-Type': 'application/json',
      },
    });
    return data;
  } catch (err: any) {
    return { success: false, message: err?.message || 'Network error' };
  }
}

export async function fetchOpenPositions(apiKey: string, secretKey: string) {
  try {
    const timestamp = timeSyncManager.getServerTimestamp();
    const signature = signRequest(apiKey, secretKey, timestamp);

    const data = await api.get('/api/v1/private/position/open_positions', {
      headers: {
        'ApiKey': apiKey,
        'Request-Time': timestamp,
        'Signature': signature,
      },
    });
    if (data.success) return data.data;
    return [];
  } catch (err) {
    console.warn('[MEXC] fetchOpenPositions error:', err);
    return [];
  }
}

export async function fetchOpenOrders(apiKey: string, secretKey: string, symbol?: string) {
  try {
    const timestamp = timeSyncManager.getServerTimestamp();
    const signature = signRequest(apiKey, secretKey, timestamp);

    const data = await api.get('/api/v1/private/order/list/open_orders/' + (symbol || ''), {
      params: symbol ? { symbol } : {},
      headers: {
        'ApiKey': apiKey,
        'Request-Time': timestamp,
        'Signature': signature,
      },
    });
    if (data.success) return data.data;
    return [];
  } catch (err) {
    console.warn('[MEXC] fetchOpenOrders error:', err);
    return [];
  }
}

// ─── WebSocket Subscriptions ───────────────────────────────────────────────

type WsCallback = (data: any) => void;

class MexcWebSocketManager {
  private ws: WebSocket | null = null;
  private url = getMexcWsUrl();
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;

  // Exponential Backoff state
  private reconnectAttempts = 0;
  private static readonly BASE_DELAY_MS = 1_000;   // Start at 1 second
  private static readonly MAX_DELAY_MS = 30_000;    // Cap at 30 seconds
  private static readonly MAX_JITTER_MS = 1_000;    // Random jitter 0-1s

  private subscriptions: Set<string> = new Set();
  private subscriptionRefCounts: Map<string, number> = new Map();
  private callbacks: Map<string, Set<WsCallback>> = new Map();

  /**
   * Calculate next reconnection delay using exponential backoff with jitter.
   * delay = min(baseDelay * 2^attempt + random_jitter, maxDelay)
   */
  private getReconnectDelay(): number {
    const exponentialDelay = MexcWebSocketManager.BASE_DELAY_MS * Math.pow(2, this.reconnectAttempts);
    const jitter = Math.random() * MexcWebSocketManager.MAX_JITTER_MS;
    return Math.min(exponentialDelay + jitter, MexcWebSocketManager.MAX_DELAY_MS);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = this.getReconnectDelay();
    console.log(
      `[MEXC WS] Scheduling reconnect attempt #${this.reconnectAttempts + 1} in ${Math.round(delay)}ms`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, delay);
  }

  connect() {
    if (this.ws || this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.url = getMexcWsUrl();
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        this.isConnecting = false;
        // Reset backoff counter on successful connection
        const wasReconnect = this.reconnectAttempts > 0;
        this.reconnectAttempts = 0;
        console.log(
          `[MEXC WS] ✅ Connected${wasReconnect ? ' (reconnected successfully)' : ''}`,
        );
        this.startPing();
        this.resubscribeAll();
      };

      this.ws.onmessage = (event) => {
        try {
          if (typeof event.data !== 'string') return;
          const msg = JSON.parse(event.data);
          const channel = msg.channel || msg.ch || msg.topic || msg.method;
          if (channel === 'pong') return;
          if (!channel) return;

          // MEXC WS sends channel like "push.ticker" with symbol in msg.symbol or msg.data.symbol.
          // We subscribe with symbol-specific keys like "push.ticker.BTC_USDT".
          // Route to the symbol-specific channel if symbol info is available.
          const msgSymbol = msg.symbol || msg.data?.symbol || msg.data?.s;

          if (msgSymbol && this.callbacks.has(`${channel}.${msgSymbol}`)) {
            this.callbacks.get(`${channel}.${msgSymbol}`)!.forEach(cb => cb(msg));
          } else if (this.callbacks.has(channel)) {
            // Fallback: route to generic channel for backward compatibility
            this.callbacks.get(channel)!.forEach(cb => cb(msg));
          }
        } catch (err) {
          console.error('[MEXC WS] Parse error', err);
        }
      };

      this.ws.onclose = () => {
        console.log('[MEXC WS] ⚠️ Disconnected');
        this.cleanup();
        this.scheduleReconnect();
      };

      this.ws.onerror = (err) => {
        console.error('[MEXC WS] Error', err);
        this.ws?.close();
      };
    } catch (err) {
      console.error('[MEXC WS] Init error', err);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private cleanup() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = null;
    // NOTE: Do NOT clear reconnectTimer here — scheduleReconnect() is called after cleanup()
    // in onclose handler, and it manages its own timer lifecycle.
    this.ws = null;
    this.isConnecting = false;
  }

  private startPing() {
    this.pingInterval = setInterval(() => {
      this.send({ method: 'ping' });
    }, 10000);
  }

  private send(payload: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  private resubscribeAll() {
    this.subscriptions.forEach(sub => {
      this.send(JSON.parse(sub));
    });
  }

  private buildUnsubscribePayload(payload: any) {
    const method = typeof payload?.method === 'string' ? payload.method : '';
    if (!method.startsWith('sub.')) return null;
    return { ...payload, method: method.replace('sub.', 'unsub.') };
  }

  subscribe(channel: string, payload: any, callback: WsCallback) {
    if (!this.callbacks.has(channel)) {
      this.callbacks.set(channel, new Set());
    }
    this.callbacks.get(channel)!.add(callback);

    const subStr = JSON.stringify(payload);
    const currentRef = this.subscriptionRefCounts.get(subStr) || 0;
    this.subscriptionRefCounts.set(subStr, currentRef + 1);

    if (!this.subscriptions.has(subStr)) {
      this.subscriptions.add(subStr);
      this.send(payload);
    }

    return () => {
      // Unsubscribe callback
      const cbs = this.callbacks.get(channel);
      if (cbs) {
        cbs.delete(callback);
        if (cbs.size === 0) {
          this.callbacks.delete(channel);
        }
      }

      const refCount = this.subscriptionRefCounts.get(subStr) || 0;
      if (refCount <= 1) {
        this.subscriptionRefCounts.delete(subStr);
        this.subscriptions.delete(subStr);

        const unsubPayload = this.buildUnsubscribePayload(payload);
        if (unsubPayload) {
          this.send(unsubPayload);
        }
      } else {
        this.subscriptionRefCounts.set(subStr, refCount - 1);
      }
    };
  }

  subscribeTicker(symbol: string, cb: WsCallback) {
    return this.subscribe(`push.ticker.${symbol}`, { method: 'sub.ticker', param: { symbol } }, cb);
  }

  subscribeKline(symbol: string, interval: TimeInterval, cb: WsCallback) {
    return this.subscribe(`push.kline.${symbol}.${interval}`, { method: 'sub.kline', param: { symbol, interval } }, cb);
  }

  subscribeDepth(symbol: string, cb: WsCallback) {
    return this.subscribe(`push.depth.${symbol}`, { method: 'sub.depth', param: { symbol } }, cb);
  }

  subscribeDeals(symbol: string, cb: WsCallback) {
    return this.subscribe(`push.deal.${symbol}`, { method: 'sub.deal', param: { symbol } }, cb);
  }
}

export const mexcWs = new MexcWebSocketManager();

// Re-export connection manager for UI consumption
export { connectionManager } from './connectionManager';
export type { ConnectionMode } from './connectionManager';
