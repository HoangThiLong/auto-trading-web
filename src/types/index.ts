// ─── Core Types ─────────────────────────────────────────────────────────────

export type AutoTradeMode = 'live' | 'simulation' | 'off';
export type ConnectionMode = 'DIRECT' | 'RELAY';
export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
export type TradeSignalType = 'LONG' | 'SHORT' | 'NEUTRAL';
export type TradeSignalStrength = 'WEAK' | 'MODERATE' | 'STRONG';
export type MarketRegime = 'TRENDING' | 'RANGING' | 'VOLATILE';
export type TimeInterval = 'Min1' | 'Min5' | 'Min15' | 'Min30' | 'Min60' | 'Hour4' | 'Hour8' | 'Day1' | 'Week1' | 'Month1';
export type AiProviderId = 'gemini' | 'groq' | 'openrouter' | 'together';

export const AI_PROVIDERS: Array<{
  id: AiProviderId;
  name: string;
  description: string;
  color: string;
  freeLimit: string;
  getKeyUrl: string;
}> = [
  {
    id: 'gemini',
    name: 'Gemini',
    description: 'Google Gemini 1.5 Flash',
    color: '#4285F4',
    freeLimit: 'Free tier available',
    getKeyUrl: 'https://aistudio.google.com/app/apikey',
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Llama 3.3 70B via Groq',
    color: '#F55036',
    freeLimit: 'Free tier available',
    getKeyUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'DeepSeek R1 via OpenRouter',
    color: '#7C3AED',
    freeLimit: 'Credits may be required',
    getKeyUrl: 'https://openrouter.ai/keys',
  },
  {
    id: 'together',
    name: 'Together',
    description: 'Mixtral 8x7B via Together',
    color: '#059669',
    freeLimit: 'Free credits may be available',
    getKeyUrl: 'https://api.together.xyz/settings/api-keys',
  },
];

// ─── API Types ──────────────────────────────────────────────────────────────

export interface ApiCredentials {
  apiKey: string;
  secretKey: string;
  mexcNetwork: 'live' | 'demo';
}

export interface AiModelCredentials {
  gemini?: string;
  groq?: string;
  openrouter?: string;
  together?: string;
  cryptopanic?: string;
  preferredProvider?: 'gemini' | 'groq' | 'openrouter' | 'together';
}

export interface TelegramCredentials {
  botToken: string;
  adminChatId: string;
}

// ─── Market Data Types ──────────────────────────────────────────────────────

export interface CandlePoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ContractTicker {
  symbol: string;
  lastPrice: number;
  bid1?: number;
  ask1?: number;
  volume24?: number;
  amount24: number;
  holdVol: number;
  lower24Price: number;
  high24Price: number;
  riseFallRate: number;
  riseFallValue?: number;
  indexPrice: number;
  fairPrice: number;
  fundingRate?: number;
  timestamp?: number;
  updateTime?: number;
}

export interface KlineData {
  success?: boolean;
  symbol?: string;
  interval?: string;
  time: number[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  vol: number[];
  amount?: number[];
  data?: CandlePoint[];
}

export interface OrderBook {
  symbol: string;
  asks: [number, number][];
  bids: [number, number][];
  updateTime: number;
}

export interface FundingRate {
  symbol: string;
  fundingRate: number;
  nextFundingTime: number;
  nextSettleTime?: number;
}

export interface ContractInfo {
  symbol: string;
  baseAsset?: string;
  quoteAsset?: string;
  priceScale?: number;
  quantityScale?: number;
  minLeverage?: number;
  maxLeverage?: number;
  maxOrderQty?: number;
  status?: string;
  contractSize?: number;
  state?: number;
}

export interface RecentTrade {
  id?: number;
  price?: number;
  qty?: number;
  time?: number;
  isBuyerMaker?: boolean;
  p?: number;
  v?: number;
  T?: number;
  t?: number;
}

// ─── Signal & Analysis Types ────────────────────────────────────────────────

export interface TradeSignal {
  type: TradeSignalType;
  strength: TradeSignalStrength;
  entry: number;
  takeProfit: number;
  stopLoss: number;
  riskReward: number;
  winRate: number;
  confidence: number;
  reasons: string[];
  indicators: {
    rsi: number;
    macd: { macd: number; signal: number; histogram: number };
    ema20: number;
    ema50: number;
    ema200: number;
    bollingerBands: { upper: number; middle: number; lower: number };
    volume: number;
    volumeAvg: number;
    atr: number;
    marketRegime: MarketRegime;
    volatility: number;
  };
  timestamp: number;
  marketRegime: MarketRegime;
  aiAnalysis?: string;
  aiProvider?: string;
}

export interface OrderIntentBuildPayload {
  symbol: string;
  mode: 'simulation' | 'live';
  side: 'LONG' | 'SHORT';
  entry: number;
  tp: number;
  sl: number;
  quantity: number;
  leverage: number;
  confidence: number;
  winRate: number;
  aiProvider: string;
}

export interface OrderIntent {
  intentId: string;
  logId: string;
  symbol: string;
  mode: 'simulation' | 'live';
  side: 'LONG' | 'SHORT';
  entry: number;
  tp: number;
  sl: number;
  quantity: number;
  leverage: number;
  confidence: number;
  winRate: number;
  aiProvider: string;
  createdAt: number;
}

// ─── Auto Trade Types ───────────────────────────────────────────────────────

export interface AutoTradeConfig {
  minConfidence: number;
  riskPercentPerTrade: number;
  maxConcurrentOrders: number;
  dailyLossLimit: number;
  trailingStop: boolean;
  newsFilter: boolean;
  quietHours: { start: number; end: number } | null;
  symbols: string[];
  scanAllMarket: boolean;
}

export interface AutoTradeLog {
  id: string;
  intentId?: string;
  timestamp: number;
  symbol: string;
  mode: AutoTradeMode;
  side: 'LONG' | 'SHORT';
  entry: number;
  tp: number;
  sl: number;
  quantity: number;
  leverage: number;
  confidence: number;
  winRate: number;
  aiProvider: string;
  aiAnalysis?: string;
  status: 'OPENED' | 'TP_HIT' | 'SL_HIT' | 'CLOSED' | 'SKIPPED';
  skipReason?: string;
  pnl?: number;
  orderId?: string;
}

export interface PendingOrder {
  id: string;
  intentId?: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  type: 'LIMIT' | 'MARKET';
  price: number;
  quantity: number;
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED';
  createdAt: number;
  isSimulation?: boolean;
  aiAnalysis?: string;
  signal?: TradeSignal;
}

export interface TradeLesson {
  id: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry: number;
  exit: number;
  pnl: number;
  reason: string;
  timestamp: number;
}

// ─── News & Sentiment Types ─────────────────────────────────────────────────

export interface NewsItem {
  id: string | number;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  votes: {
    positive: number;
    negative: number;
    important: number;
  };
}

export type MarketSentiment = 'BULLISH' | 'BEARISH' | 'FEARFUL' | 'NEUTRAL';

// ─── Telegram Bot Types ─────────────────────────────────────────────────────

export interface TelegramBotConfig {
  token: string;
  adminChatId: string;
  logger: {
    info: (message: string, context?: unknown) => void;
    warn: (message: string, context?: unknown) => void;
    error: (message: string, context?: unknown) => void;
  };
}

export interface TelegramBotEvent {
  type: 'trade_opened' | 'trade_closed' | 'circuit_breaker' | 'system';
  message: string;
  symbol?: string;
  side?: 'LONG' | 'SHORT';
  pnl?: number;
}

// ─── Analysis Worker Types ──────────────────────────────────────────────────

export type AnalysisWorkerRequest =
  | {
      id: number;
      type: 'GENERATE_SIGNAL';
      payload: {
        candles: CandlePoint[];
      };
    }
  | {
      id: number;
      type: 'BUILD_ORDER_INTENT';
      payload: {
        order: OrderIntentBuildPayload;
      };
    };

export type AnalysisWorkerResponse =
  | {
      id: number;
      type: 'GENERATE_SIGNAL_RESULT';
      signal: TradeSignal;
    }
  | {
      id: number;
      type: 'ORDER_INTENT_RESULT';
      orderIntent: OrderIntent;
    }
  | {
      id: number;
      type: 'ANALYSIS_ERROR';
      error: string;
    };

// ─── AI Types ─────────────────────────────────��─────────────────────────────

export interface AiAnalysisResult {
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidence: number;
  analysis: string;
  keyLevels: { support: number; resistance: number };
  riskWarning: string | null;
  provider: AiProviderId;
  speedMs: number;
  debateHistory?: string;
}

// ─── Database Types ─────────────────────────────────────────────────────────

export interface DbAutoTradeLog {
  id: string;
  intentId?: string;
  timestamp: number;
  symbol: string;
  mode: string;
  side: string;
  entry: number;
  tp: number;
  sl: number;
  quantity: number;
  leverage: number;
  confidence: number;
  winRate: number;
  aiProvider: string;
  aiAnalysis?: string;
  status: string;
  skipReason?: string;
  pnl?: number;
  orderId?: string;
}

export interface DbOrderRecord {
  id: string;
  intentId?: string;
  symbol: string;
  side: string;
  type: string;
  price: number;
  quantity: number;
  leverage: number;
  stopLoss?: number;
  takeProfit?: number;
  status: string;
  createdAt: number;
  isSimulation: boolean;
  aiAnalysis?: string;
}

// ─── Store Types ────────────────────────────────────────────────────────────

export interface StoreState {
  autoTradeMode: AutoTradeMode;
  autoTradeRunning: boolean;
  autoTradeConfig: AutoTradeConfig;
  autoTradeLogs: AutoTradeLog[];
  pendingOrders: PendingOrder[];
  tradeLessons: TradeLesson[];
  credentials: ApiCredentials | null;
  aiCredentials: AiModelCredentials | null;
  telegramCredentials: TelegramCredentials | null;
  signals: Record<string, TradeSignal>;
  tickers: ContractTicker[];
  contracts: ContractInfo[];
  news: NewsItem[];
  marketSentiment: MarketSentiment;
  accountBalance: number | null;
  demoBalance: number;
  activeTab: string;
  sidebarOpen: boolean;
  selectedSymbol: string;
  apiModalOpen: boolean;
  autoTradePanelOpen: boolean;
  mexcNetwork: 'live' | 'demo';
  isApiConnected: boolean;
}
