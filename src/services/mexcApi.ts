/// <reference types="vite/client" />
import CryptoJS from 'crypto-js';
import type { ContractTicker, KlineData, OrderBook, FundingRate, ContractInfo, TimeInterval, RecentTrade } from '../types';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let attempt = 0;
  while (true) {
    try {
      const controller = new AbortController();
      const signal = controller.signal;
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s absolute timeout

      const res = await fetch(url, { ...options, signal });
      clearTimeout(timeoutId);
      
      // Retry on 429 (Rate Limit) or 5xx (Server Error)
      if (!res.ok && (res.status === 429 || res.status >= 500)) {
        if (attempt >= maxRetries) {
          throw new Error(`HTTP ${res.status}: Max retries reached after ${attempt} attempts`);
        }
        
        // Jittered backoff: (2^attempt * 1000ms) + 0-500ms
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

const stripTrailingSlashes = (value: string) => value.replace(/\/+$/, '');
const stripLeadingSlashes = (value: string) => value.replace(/^\/+/, '');

const joinUrl = (base: string, path: string): string => {
  const safeBase = stripTrailingSlashes(base);
  const safePath = stripLeadingSlashes(path);
  return `${safeBase}/${safePath}`;
};

const resolveMexcApiRoot = (): string => {
  const configuredBaseUrl = import.meta.env.VITE_TIMESFM_API_BASE_URL?.trim();

  // Production must go through backend proxy.
  if (import.meta.env.PROD) {
    if (!configuredBaseUrl) {
      console.error('[MEXC API] Missing VITE_TIMESFM_API_BASE_URL in production environment.');
      return '/__missing_backend_base_url__/api/proxy/mexc_v1';
    }
    return joinUrl(configuredBaseUrl, '/api/proxy/mexc_v1');
  }

  // Local dev can use Vite proxy. If env is set locally, still allow proxy routing via backend.
  if (configuredBaseUrl) {
    return joinUrl(configuredBaseUrl, '/api/proxy/mexc_v1');
  }

  return '';
};

const MEXC_API_ROOT = resolveMexcApiRoot();

const mapEndpointForTarget = (url: string): string => {
  if (!MEXC_API_ROOT) {
    return url;
  }
  // Backend proxy expects: /api/proxy/mexc_v1/<endpoint-after-/api/v1/>
  return url.replace(/^\/api\/v1\//, '/');
};

const buildRequestUrl = (url: string): string => {
  const endpoint = mapEndpointForTarget(url);
  return MEXC_API_ROOT ? joinUrl(MEXC_API_ROOT, endpoint) : endpoint;
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
    console.error('[MEXC] fetchAllTickers error:', err);
    return [];
  }
}

export async function fetchTicker(symbol: string): Promise<ContractTicker | null> {
  try {
    const data = await api.get('/api/v1/contract/ticker', { params: { symbol } });
    if (data.success) return data.data;
    return null;
  } catch (err) {
    console.error('[MEXC] fetchTicker error:', err);
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
    console.error('[MEXC] fetchKlines error:', err);
    return null;
  }
}

export async function fetchOrderBook(symbol: string, limit = 20): Promise<OrderBook | null> {
  try {
    const data = await api.get(`/api/v1/contract/depth/${symbol}`, { params: { limit } });
    if (data.success) return data.data;
    return null;
  } catch (err) {
    console.error('[MEXC] fetchOrderBook error:', err);
    return null;
  }
}

export async function fetchFundingRate(symbol: string): Promise<FundingRate | null> {
  try {
    const data = await api.get(`/api/v1/contract/funding_rate/${symbol}`);
    if (data.success) return data.data;
    return null;
  } catch (err) {
    console.error('[MEXC] fetchFundingRate error:', err);
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
    console.error('[MEXC] fetchContractInfo error:', err);
    return [];
  }
}

export async function fetchRecentTrades(symbol: string, limit = 50): Promise<RecentTrade[]> {
  try {
    const data = await api.get(`/api/v1/contract/deals/${symbol}`, { params: { limit } });
    if (data.success) return data.data;
    return [];
  } catch (err) {
    console.error('[MEXC] fetchRecentTrades error:', err);
    return [];
  }
}

// ─── Signed Requests (requires API key) ────────────────────────────────────

function signRequest(apiKey: string, secretKey: string, timestamp: string, body?: string): string {
  const signStr = body ? apiKey + timestamp + body : apiKey + timestamp;
  return CryptoJS.HmacSHA256(signStr, secretKey).toString();
}

export async function fetchAccountInfo(apiKey: string, secretKey: string) {
  try {
    const timestamp = Date.now().toString();
    const signature = signRequest(apiKey, secretKey, timestamp);

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
  } catch (err) {
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
    const timestamp = Date.now().toString();
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
    const timestamp = Date.now().toString();
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
  } catch {
    return [];
  }
}

export async function fetchOpenOrders(apiKey: string, secretKey: string, symbol?: string) {
  try {
    const timestamp = Date.now().toString();
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
  } catch {
    return [];
  }
}

// ─── WebSocket Subscriptions ───────────────────────────────────────────────

type WsCallback = (data: any) => void;

class MexcWebSocketManager {
  private ws: WebSocket | null = null;
  private url = 'wss://contract.mexc.com/edge';
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  
  private subscriptions: Set<string> = new Set();
  private subscriptionRefCounts: Map<string, number> = new Map();
  private callbacks: Map<string, Set<WsCallback>> = new Map();

  connect() {
    if (this.ws || this.isConnecting) return;
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        this.isConnecting = false;
        console.log('[MEXC WS] Connected');
        this.startPing();
        this.resubscribeAll();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          const channel = msg.channel;
          if (channel === 'pong') return;
          
          if (this.callbacks.has(channel)) {
            this.callbacks.get(channel)!.forEach(cb => cb(msg));
          }
        } catch (err) {
          console.error('[MEXC WS] Parse error', err);
        }
      };

      this.ws.onclose = () => {
        console.log('[MEXC WS] Disconnected, reconnecting in 3s...');
        this.cleanup();
        // Prevent multiple reconnection timers by clearing the existing one
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
        }
        this.reconnectTimer = setTimeout(() => this.connect(), 3000);
      };

      this.ws.onerror = (err) => {
        console.error('[MEXC WS] Error', err);
        this.ws?.close();
      };
    } catch (err) {
      console.error('[MEXC WS] Init error', err);
      this.isConnecting = false;
      // Prevent multiple reconnection timers by clearing the existing one
      if (this.reconnectTimer) {
        clearTimeout(this.reconnectTimer);
      }
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    }
  }

  private cleanup() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.pingInterval = null;
    this.reconnectTimer = null;
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
    return this.subscribe(`push.ticker`, { method: 'sub.ticker', param: { symbol } }, cb);
  }

  subscribeKline(symbol: string, interval: TimeInterval, cb: WsCallback) {
    return this.subscribe(`push.kline`, { method: 'sub.kline', param: { symbol, interval } }, cb);
  }

  subscribeDepth(symbol: string, cb: WsCallback) {
    return this.subscribe(`push.depth`, { method: 'sub.depth', param: { symbol } }, cb);
  }

  subscribeDeals(symbol: string, cb: WsCallback) {
    return this.subscribe(`push.deal`, { method: 'sub.deal', param: { symbol } }, cb);
  }
}

export const mexcWs = new MexcWebSocketManager();
