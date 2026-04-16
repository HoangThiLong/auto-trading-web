import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
} from '../types';
import { createMarketDataSlice, type MarketDataSlice } from './slices/marketDataSlice';
import { createUiSlice, type UiSlice } from './slices/uiSlice';

interface AppState extends MarketDataSlice, UiSlice {
  // API credentials
  credentials: ApiCredentials | null;
  isApiConnected: boolean;
  aiCredentials: AiModelCredentials | null;

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

  // Actions
  setCredentials: (creds: ApiCredentials | null) => void;
  setIsApiConnected: (v: boolean) => void;
  setAiCredentials: (creds: AiModelCredentials | null) => void;
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

export const useStore = create<AppState>()(
  persist(
    (...args) => ({
      ...createMarketDataSlice<AppState>()(...args),
      ...createUiSlice<AppState>()(...args),

      credentials: null,
      isApiConnected: false,
      aiCredentials: null,
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

      setCredentials: (credentials) => args[0]({ credentials }),
      setIsApiConnected: (isApiConnected) => args[0]({ isApiConnected }),
      setAiCredentials: (aiCredentials) => args[0]({ aiCredentials }),
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
      partialize: (state) => ({
        credentials: state.credentials,
        aiCredentials: state.aiCredentials,
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
      }),
    }
  )
);
