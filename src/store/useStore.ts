import { create } from 'zustand';
import { persist, type StateStorage } from 'zustand/middleware';
import type {
  ApiCredentials,
  AiModelCredentials,
  AutoTradeConfig,
  AutoTradeLog,
  AutoTradeMode,
  MarketSentiment,
  NewsItem,
  PendingOrder,
  TradeSignal,
  TelegramCredentials,
} from '../types';
import { encryptCredentials, decryptCredentials, isElectronSecureMode } from '../utils/credentialCrypto';
import { createMarketDataSlice, type MarketDataSlice } from './slices/marketDataSlice';
import { createUiSlice, type UiSlice } from './slices/uiSlice';

interface AppState extends MarketDataSlice, UiSlice {
  // API credentials
  credentials: ApiCredentials | null;
  isApiConnected: boolean;
  aiCredentials: AiModelCredentials | null;
  mexcNetwork: 'live' | 'demo';

  // Trading signals
  signals: Record<string, TradeSignal>;
  isAnalyzing: boolean;
  currentAiProvider: string;
  signalScanInterval: number;

  // Orders
  pendingOrders: PendingOrder[];

  // Account
  accountBalance: number | null;
  demoBalance: number;
  openPositions: any[];

  // Auto-Trade
  autoTradeMode: AutoTradeMode;
  autoTradeConfig: AutoTradeConfig;
  autoTradeLogs: AutoTradeLog[];
  autoTradeRunning: boolean;
  tradeLessons: string[];

  // News
  news: NewsItem[];
  marketSentiment: MarketSentiment;
  newsLoading: boolean;

  // Telegram
  telegramCredentials: TelegramCredentials | null;

  // Actions
  setCredentials: (creds: ApiCredentials | null) => void;
  setIsApiConnected: (v: boolean) => void;
  setAiCredentials: (creds: AiModelCredentials | null) => void;
  setMexcNetwork: (network: 'live' | 'demo') => void;
  setTelegramCredentials: (creds: TelegramCredentials | null) => void;
  setSignal: (symbol: string, signal: TradeSignal) => void;
  setIsAnalyzing: (v: boolean) => void;
  setCurrentAiProvider: (provider: string) => void;
  setSignalScanInterval: (v: number) => void;
  addOrder: (order: PendingOrder) => void;
  updateOrder: (id: string, updates: Partial<PendingOrder>) => void;
  removeOrder: (id: string) => void;
  setAccountBalance: (balance: number | null) => void;
  setDemoBalance: (balance: number) => void;
  setOpenPositions: (positions: any[]) => void;
  setAutoTradeMode: (mode: AutoTradeMode) => void;
  setAutoTradeConfig: (config: Partial<AutoTradeConfig>) => void;
  addAutoTradeLog: (log: AutoTradeLog) => void;
  updateAutoTradeLog: (id: string, updates: Partial<AutoTradeLog>) => void;
  clearAutoTradeLogs: () => void;
  setAutoTradeRunning: (v: boolean) => void;
  addTradeLesson: (lesson: string) => void;
  setNews: (news: NewsItem[]) => void;
  setMarketSentiment: (s: MarketSentiment) => void;
  setNewsLoading: (v: boolean) => void;
}

type SecureCredentialPayload = {
  credentials: ApiCredentials | null;
  aiCredentials: AiModelCredentials | null;
  telegramCredentials: TelegramCredentials | null;
  mexcNetwork: 'live' | 'demo';
  isApiConnected: boolean;
};

type ElectronApiBridge = {
  saveCredentials: (payload: SecureCredentialPayload) => Promise<{ success: boolean; error?: string }>;
  loadCredentials: () => Promise<SecureCredentialPayload | null>;
  clearCredentials: () => Promise<{ success: boolean; error?: string }>;
};

declare global {
  interface Window {
    electronAPI?: ElectronApiBridge;
  }
}

const getElectronApi = (): ElectronApiBridge | null => {
  if (typeof window === 'undefined' || !window.electronAPI) {
    return null;
  }
  return window.electronAPI;
};

const syncSecureCredentials = async (payload: SecureCredentialPayload) => {
  const electronApi = getElectronApi();
  if (!electronApi) return;

  try {
    if (!payload.credentials && !payload.aiCredentials && !payload.telegramCredentials) {
      await electronApi.clearCredentials();
      return;
    }
    await electronApi.saveCredentials(payload);
  } catch (error) {
    console.error('[secure-credentials] Failed to sync credentials:', error);
  }
};

const DEFAULT_AUTO_TRADE_CONFIG: AutoTradeConfig = {
  minConfidence: 70,
  riskPercentPerTrade: 1,
  maxConcurrentOrders: 3,
  dailyLossLimit: 50,
  trailingStop: false,
  newsFilter: true,
  quietHours: null,
  symbols: ['BTC_USDT', 'ETH_USDT', 'SOL_USDT'],
  scanAllMarket: true,
};

// ─── Encrypted Storage Adapter ──────────────────────────────────────────────
// For non-Electron mode, sensitive fields are AES-encrypted before localStorage.
// Electron mode uses OS-level safeStorage instead (no encryption needed here).

const SENSITIVE_KEYS = ['credentials', 'aiCredentials', 'mexcNetwork'] as const;
const ENCRYPTED_MARKER = '__enc__';

const encryptedStorage: StateStorage = {
  getItem: (name: string): string | null => {
    const raw = localStorage.getItem(name);
    if (!raw) return null;

    // If Electron safeStorage is available, skip AES decryption
    if (isElectronSecureMode()) return raw;

    try {
      const parsed = JSON.parse(raw);
      if (parsed?.state) {
        for (const key of SENSITIVE_KEYS) {
          const markerKey = `${ENCRYPTED_MARKER}${key}`;
          if (typeof parsed.state[markerKey] === 'string') {
            const decrypted = decryptCredentials(parsed.state[markerKey]);
            if (decrypted !== null) {
              parsed.state[key] = decrypted;
            }
            delete parsed.state[markerKey];
          }
        }
      }
      return JSON.stringify(parsed);
    } catch {
      return raw;
    }
  },

  setItem: (name: string, value: string): void => {
    // If Electron safeStorage is available, skip AES encryption
    if (isElectronSecureMode()) {
      localStorage.setItem(name, value);
      return;
    }

    try {
      const parsed = JSON.parse(value);
      if (parsed?.state) {
        for (const key of SENSITIVE_KEYS) {
          if (parsed.state[key] != null) {
            parsed.state[`${ENCRYPTED_MARKER}${key}`] = encryptCredentials(parsed.state[key]);
            delete parsed.state[key];
          }
        }
      }
      localStorage.setItem(name, JSON.stringify(parsed));
    } catch {
      localStorage.setItem(name, value);
    }
  },

  removeItem: (name: string): void => {
    localStorage.removeItem(name);
  },
};

export const useStore = create<AppState>()(
  persist(
    (...args) => ({
      ...createMarketDataSlice<AppState>()(...args),
      ...createUiSlice<AppState>()(...args),

      credentials: null,
      isApiConnected: false,
      aiCredentials: null,
      mexcNetwork: 'live',
      signals: {},
      isAnalyzing: false,
      currentAiProvider: 'local',
      signalScanInterval: 0,
      pendingOrders: [],
      accountBalance: null,
      demoBalance: 10000,
      openPositions: [],
      autoTradeMode: 'off',
      autoTradeConfig: DEFAULT_AUTO_TRADE_CONFIG,
      autoTradeLogs: [],
      autoTradeRunning: false,
      tradeLessons: [],
      news: [],
      marketSentiment: 'NEUTRAL',
      newsLoading: false,
      telegramCredentials: null,

      setCredentials: (credentials) => {
        args[0]({ credentials });
        void syncSecureCredentials({
          credentials,
          aiCredentials: args[1]().aiCredentials,
          telegramCredentials: args[1]().telegramCredentials,
          mexcNetwork: args[1]().mexcNetwork,
          isApiConnected: args[1]().isApiConnected,
        });
      },
      setIsApiConnected: (isApiConnected) => {
        args[0]({ isApiConnected });
        void syncSecureCredentials({
          credentials: args[1]().credentials,
          aiCredentials: args[1]().aiCredentials,
          telegramCredentials: args[1]().telegramCredentials,
          mexcNetwork: args[1]().mexcNetwork,
          isApiConnected,
        });
      },
      setAiCredentials: (aiCredentials) => {
        args[0]({ aiCredentials });
        void syncSecureCredentials({
          credentials: args[1]().credentials,
          aiCredentials,
          telegramCredentials: args[1]().telegramCredentials,
          mexcNetwork: args[1]().mexcNetwork,
          isApiConnected: args[1]().isApiConnected,
        });
      },
      setMexcNetwork: (mexcNetwork) => {
        args[0]({ mexcNetwork });
        void syncSecureCredentials({
          credentials: args[1]().credentials,
          aiCredentials: args[1]().aiCredentials,
          telegramCredentials: args[1]().telegramCredentials,
          mexcNetwork,
          isApiConnected: args[1]().isApiConnected,
        });
      },
      setTelegramCredentials: (telegramCredentials) => {
        args[0]({ telegramCredentials });
        void syncSecureCredentials({
          credentials: args[1]().credentials,
          aiCredentials: args[1]().aiCredentials,
          telegramCredentials,
          mexcNetwork: args[1]().mexcNetwork,
          isApiConnected: args[1]().isApiConnected,
        });
      },
      setSignal: (symbol, signal) =>
        args[0]((state) => ({ signals: { ...state.signals, [symbol]: signal } })),
      setIsAnalyzing: (isAnalyzing) => args[0]({ isAnalyzing }),
      setCurrentAiProvider: (currentAiProvider) => args[0]({ currentAiProvider }),
      setSignalScanInterval: (signalScanInterval) => args[0]({ signalScanInterval }),
      addOrder: (order) => args[0]((state) => ({ pendingOrders: [order, ...state.pendingOrders] })),
      updateOrder: (id, updates) =>
        args[0]((state) => ({
          pendingOrders: state.pendingOrders.map((order) =>
            order.id === id ? { ...order, ...updates } : order
          ),
        })),
      removeOrder: (id) =>
        args[0]((state) => ({ pendingOrders: state.pendingOrders.filter((order) => order.id !== id) })),
      setAccountBalance: (accountBalance) => args[0]({ accountBalance }),
      setDemoBalance: (demoBalance) => args[0]({ demoBalance }),
      setOpenPositions: (openPositions) => args[0]({ openPositions }),
      setAutoTradeMode: (autoTradeMode) => args[0]({ autoTradeMode }),
      setAutoTradeConfig: (config) =>
        args[0]((state) => ({ autoTradeConfig: { ...state.autoTradeConfig, ...config } })),
      addAutoTradeLog: (log) =>
        args[0]((state) => ({ autoTradeLogs: [log, ...state.autoTradeLogs].slice(0, 200) })),
      updateAutoTradeLog: (id, updates) =>
        args[0]((state) => ({
          autoTradeLogs: state.autoTradeLogs.map((log) =>
            log.id === id ? { ...log, ...updates } : log
          ),
        })),
      clearAutoTradeLogs: () => args[0]({ autoTradeLogs: [] }),
      setAutoTradeRunning: (autoTradeRunning) => args[0]({ autoTradeRunning }),
      addTradeLesson: (lesson) =>
        args[0]((state) => ({ tradeLessons: [lesson, ...state.tradeLessons].slice(0, 50) })),
      setNews: (news) => args[0]({ news }),
      setMarketSentiment: (marketSentiment) => args[0]({ marketSentiment }),
      setNewsLoading: (newsLoading) => args[0]({ newsLoading }),
    }),
    {
      name: 'mexc-pro-v2',
      storage: encryptedStorage as any,
      partialize: (state) => ({
        selectedSymbol: state.selectedSymbol,
        selectedInterval: state.selectedInterval,
        sidebarOpen: state.sidebarOpen,
        autoTradeConfig: state.autoTradeConfig,
        pendingOrders: state.pendingOrders,
        tradeLessons: state.tradeLessons,
        signalScanInterval: state.signalScanInterval,
        autoTradeLogs: state.autoTradeLogs,
        autoTradeMode: state.autoTradeMode,
        autoTradeRunning: state.autoTradeRunning,
        demoBalance: state.demoBalance,
        // Sensitive fields — encrypted via encryptedStorage adapter
        credentials: state.credentials,
        aiCredentials: state.aiCredentials,
        telegramCredentials: state.telegramCredentials,
        mexcNetwork: state.mexcNetwork,
        isApiConnected: state.isApiConnected,
      }) as unknown as AppState,
    }
  )
);

const hydrateSecureCredentials = async () => {
  const electronApi = getElectronApi();
  if (!electronApi) return;

  try {
    const loaded = await electronApi.loadCredentials();
    if (!loaded) return;

    useStore.setState({
      credentials: loaded.credentials ?? null,
      aiCredentials: loaded.aiCredentials ?? null,
      telegramCredentials: loaded.telegramCredentials ?? null,
      mexcNetwork: loaded.mexcNetwork ?? 'live',
      isApiConnected: loaded.isApiConnected ?? false,
    });
  } catch (error) {
    console.error('[secure-credentials] Failed to load credentials:', error);
  }
};

if (typeof window !== 'undefined') {
  queueMicrotask(() => {
    void hydrateSecureCredentials();
  });
}
