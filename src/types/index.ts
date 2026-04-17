export interface ContractTicker {
  symbol: string;
  lastPrice: number;
  bid1: number;
  ask1: number;
  volume24: number;
  amount24: number;
  holdVol: number;
  lower24Price: number;
  high24Price: number;
  riseFallRate: number;
  riseFallValue: number;
  indexPrice: number;
  fairPrice: number;
  fundingRate: number;
  timestamp: number;
}

export interface KlineData {
  time: number[];
  open: number[];
  close: number[];
  high: number[];
  low: number[];
  vol: number[];
  amount: number[];
}

export interface CandlePoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderBook {
  asks: [number, number, number][];
  bids: [number, number, number][];
  timestamp: number;
}

export interface FundingRate {
  symbol: string;
  fundingRate: number;
  maxFundingRate: number;
  minFundingRate: number;
  collectCycle: number;
  nextSettleTime: number;
  timestamp: number;
}

export interface ContractInfo {
  symbol: string;
  displayNameEn: string;
  baseCoin: string;
  quoteCoin: string;
  minLeverage: number;
  maxLeverage: number;
  takerFeeRate: number;
  makerFeeRate: number;
  minVol: number;
  maxVol: number;
  priceScale: number;
  volScale: number;
  contractSize: number;
  state: number;
  baseCoinIconUrl?: string;
}

export type TimeInterval = 'Min1' | 'Min5' | 'Min15' | 'Min30' | 'Min60' | 'Hour4' | 'Hour8' | 'Day1' | 'Week1' | 'Month1';

export interface TradeSignal {
  type: 'LONG' | 'SHORT' | 'NEUTRAL';
  strength: 'STRONG' | 'MODERATE' | 'WEAK';
  entry: number;
  takeProfit: number;
  stopLoss: number;
  riskReward: number;
  confidence: number;
  winRate?: number;          // NEW: backtested win rate %
  aiAnalysis?: string;       // NEW: AI text analysis
  aiProvider?: string;       // NEW: which AI provider generated this
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
    marketRegime?: 'TRENDING' | 'RANGING' | 'VOLATILE';
    volatility?: number;
  };
  marketRegime?: 'TRENDING' | 'RANGING' | 'VOLATILE'; // Include market regime at signal level
  timestamp: number;
}

export interface ApiCredentials {
  apiKey: string;
  secretKey: string;
}

// ─── Multi-AI Provider Credentials ─────────────────────────────────────────
export type AiProviderId = 'gemini' | 'groq' | 'openrouter' | 'together';

export interface AiProviderInfo {
  id: AiProviderId;
  name: string;
  model: string;
  freeLimit: string;
  getKeyUrl: string;
  color: string;
}

export const AI_PROVIDERS: AiProviderInfo[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    model: 'gemini-1.5-flash',
    freeLimit: '15 req/phút',
    getKeyUrl: 'https://aistudio.google.com/app/apikey',
    color: '#4285f4',
  },
  {
    id: 'groq',
    name: 'Groq (Llama 3.3)',
    model: 'llama-3.3-70b-versatile',
    freeLimit: '30 req/phút',
    getKeyUrl: 'https://console.groq.com/keys',
    color: '#f55036',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (DeepSeek)',
    model: 'deepseek/deepseek-r1:free',
    freeLimit: 'Miễn phí có giới hạn',
    getKeyUrl: 'https://openrouter.ai/keys',
    color: '#7c3aed',
  },
  {
    id: 'together',
    name: 'Together.ai (Mixtral)',
    model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    freeLimit: '$1 free credits',
    getKeyUrl: 'https://api.together.ai/',
    color: '#059669',
  },
];

export interface AiModelCredentials {
  gemini?: string;
  groq?: string;
  openrouter?: string;
  together?: string;
  cryptopanic?: string; // for news
  preferredProvider?: AiProviderId;
}

// ─── Auto-Trade ─────────────────────────────────────────────────────────────
export type AutoTradeMode = 'off' | 'simulation' | 'live';

export interface AutoTradeConfig {
  minConfidence: number;       // 0-100, default 70
  riskPercentPerTrade: number; // % of balance per trade, default 1
  maxConcurrentOrders: number; // default 3
  dailyLossLimit: number;      // USDT, default 50
  trailingStop: boolean;
  newsFilter: boolean;         // block trading on fearful news
  quietHours: { start: number; end: number } | null; // UTC hours
  symbols: string[];           // which symbols to auto-trade if not scanning all
  scanAllMarket: boolean;      // NEW: scan all USDT pairs slowly
}

export interface AutoTradeLog {
  id: string;
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
  aiAnalysis?: string; // Persisted AI debate result
  status: 'OPENED' | 'TP_HIT' | 'SL_HIT' | 'CLOSED' | 'SKIPPED';
  skipReason?: string;
  pnl?: number;
  orderId?: string;
  intentId?: string;
}

// ─── News ────────────────────────────────────────────────────────────────────
export type MarketSentiment = 'BULLISH' | 'BEARISH' | 'FEARFUL' | 'NEUTRAL';

export interface NewsItem {
  id: number;
  title: string;
  url: string;
  source: string;
  publishedAt: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  votes: { positive: number; negative: number; important: number };
}

// ─── Orders ─────────────────────────────────────────────────────────────────
export interface PendingOrder {
  id: string;
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
  signal?: TradeSignal;
  isSimulation?: boolean;    // NEW
  intentId?: string;
}

export interface RecentTrade {
  p: number;
  v: number;
  T: 1 | 2;
  t: number;
}
