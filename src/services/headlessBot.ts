import type { OrderIntentBuildPayload } from './analysis';
import { buildOrderIntentInWorker, generateSignalInWorker } from './analysisWorkerClient';
import { guardedNetworkQueue } from './asyncTaskQueue';
import { calcDailyPnL, calcPositionSize } from './capitalManager';
import { analyzeWithAI } from './geminiAi';
import { fetchKlines, placeOrder } from './mexcApi';
import { isSafeToTrade } from './newsService';
import { fetchTimesFmForecast } from './timesfmService';
import type { DatabaseAdapter } from '../database/db';
import type {
  AiModelCredentials,
  ApiCredentials,
  AutoTradeConfig,
  AutoTradeLog,
  AutoTradeMode,
  ContractInfo,
  ContractTicker,
  MarketSentiment,
  NewsItem,
  PendingOrder,
  TradeSignal,
} from '../types';

export interface HeadlessBotLogger {
  info: (message: string, context?: Record<string, unknown>) => void;
  warn: (message: string, context?: Record<string, unknown>) => void;
  error: (message: string, context?: Record<string, unknown>) => void;
  debug: (message: string, context?: Record<string, unknown>) => void;
}

export interface HeadlessBotState {
  autoTradeMode: AutoTradeMode;
  autoTradeRunning: boolean;
  autoTradeConfig: AutoTradeConfig;
  autoTradeLogs: AutoTradeLog[];
  pendingOrders: PendingOrder[];
  tradeLessons: string[];
  credentials: ApiCredentials | null;
  aiCredentials: AiModelCredentials | null;
  signals: Record<string, TradeSignal>;
  tickers: ContractTicker[];
  contracts: ContractInfo[];
  news: NewsItem[];
  marketSentiment: MarketSentiment;
  accountBalance: number | null;
  demoBalance: number;
}

export interface HeadlessBotActions {
  setAutoTradeMode: (mode: AutoTradeMode) => void;
  setAutoTradeRunning: (running: boolean) => void;
  addAutoTradeLog: (log: AutoTradeLog) => void;
  updateAutoTradeLog: (id: string, updates: Partial<AutoTradeLog>) => void;
  addOrder: (order: PendingOrder) => void;
  addTradeLesson: (lesson: string) => void;
  setSignal?: (symbol: string, signal: TradeSignal) => void;
}

export interface HeadlessBotDependencies {
  getState: () => HeadlessBotState;
  actions: HeadlessBotActions;
  logger?: HeadlessBotLogger;
  tickIntervalMs?: number;
  pnlCheckIntervalMs?: number;
  /** Optional SQLite adapter for persistent storage (headless bot only). */
  db?: DatabaseAdapter;
}

const noopLogger: HeadlessBotLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
  debug: () => undefined,
};

/**
 * Generate a unique correlation ID for tracing a single tick or PnL check cycle.
 * Format: tick_<timestamp>_<random4hex>
 */
function generateCorrelationId(prefix = 'tick'): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(16).slice(2, 6);
  return `${prefix}_${ts}_${rand}`;
}

/**
 * Create a scoped logger that auto-injects correlationId into every log call.
 */
function scopedLogger(base: HeadlessBotLogger, correlationId: string): HeadlessBotLogger {
  const inject = (ctx?: Record<string, unknown>) => ({ correlationId, ...ctx });
  return {
    info: (msg, ctx) => base.info(msg, inject(ctx)),
    warn: (msg, ctx) => base.warn(msg, inject(ctx)),
    error: (msg, ctx) => base.error(msg, inject(ctx)),
    debug: (msg, ctx) => base.debug(msg, inject(ctx)),
  };
}

// ─── Symbol Blacklist Constants ────────────────────────────────────────────

const SYMBOL_ERROR_THRESHOLD = 5;       // Consecutive errors before blacklisting
const SYMBOL_BLACKLIST_DURATION_MS = 15 * 60_000; // 15 minutes

interface SymbolBlacklistEntry {
  blacklistedAt: number;
  errorCount: number;
  lastError: string;
}

export class HeadlessBotService {
  private readonly getState: () => HeadlessBotState;
  private readonly actions: HeadlessBotActions;
  private readonly logger: HeadlessBotLogger;
  private readonly tickIntervalMs: number;
  private readonly pnlCheckIntervalMs: number;
  public readonly db: DatabaseAdapter | null;

  private intervalRef: ReturnType<typeof setInterval> | null = null;
  private checkPnlIntervalRef: ReturnType<typeof setInterval> | null = null;
  private scanIndex = 0;
  private trailingStops: Record<string, { originalSl: number; lastUpdated: number }> = {};
  private isTickRunning = false;

  // Symbol error tracking & blacklist
  private symbolErrorCounts: Map<string, number> = new Map();
  private symbolBlacklist: Map<string, SymbolBlacklistEntry> = new Map();

  constructor(deps: HeadlessBotDependencies) {
    this.getState = deps.getState;
    this.actions = deps.actions;
    this.logger = deps.logger ?? noopLogger;
    this.tickIntervalMs = deps.tickIntervalMs ?? 30_000;
    this.pnlCheckIntervalMs = deps.pnlCheckIntervalMs ?? 15_000;
    this.db = deps.db ?? null;
  }

  // ─── Symbol Blacklist Management ────────────────────────────────────────

  private isSymbolBlacklisted(symbol: string): boolean {
    const entry = this.symbolBlacklist.get(symbol);
    if (!entry) return false;

    const elapsed = Date.now() - entry.blacklistedAt;
    if (elapsed >= SYMBOL_BLACKLIST_DURATION_MS) {
      // Blacklist expired — remove and reset error count
      this.symbolBlacklist.delete(symbol);
      this.symbolErrorCounts.delete(symbol);
      this.logger.info('[HeadlessBot] Symbol removed from blacklist (expired)', { symbol });
      return false;
    }

    return true;
  }

  private recordSymbolError(symbol: string, error: string): void {
    const count = (this.symbolErrorCounts.get(symbol) || 0) + 1;
    this.symbolErrorCounts.set(symbol, count);

    if (count >= SYMBOL_ERROR_THRESHOLD) {
      this.symbolBlacklist.set(symbol, {
        blacklistedAt: Date.now(),
        errorCount: count,
        lastError: error,
      });
      this.logger.warn('[HeadlessBot] ⛔ Symbol BLACKLISTED (too many consecutive errors)', {
        symbol,
        errorCount: count,
        durationMinutes: SYMBOL_BLACKLIST_DURATION_MS / 60_000,
        lastError: error,
      });
    }
  }

  private resetSymbolErrors(symbol: string): void {
    this.symbolErrorCounts.delete(symbol);
  }

  /** Get a snapshot of the current blacklist for REST API. */
  public getBlacklistSnapshot(): Record<string, SymbolBlacklistEntry & { remainingMs: number }> {
    const snapshot: Record<string, SymbolBlacklistEntry & { remainingMs: number }> = {};
    for (const [symbol, entry] of this.symbolBlacklist) {
      const remaining = SYMBOL_BLACKLIST_DURATION_MS - (Date.now() - entry.blacklistedAt);
      if (remaining > 0) {
        snapshot[symbol] = { ...entry, remainingMs: remaining };
      }
    }
    return snapshot;
  }

  public start() {
    this.stop();
    this.logger.info('[HeadlessBot] Started', {
      tickIntervalMs: this.tickIntervalMs,
      pnlCheckIntervalMs: this.pnlCheckIntervalMs,
    });

    const checkPnL = () => this.checkSimulationPnL();
    this.checkPnlIntervalRef = setInterval(checkPnL, this.pnlCheckIntervalMs);

    const runTick = async () => {
      if (this.isTickRunning) {
        this.logger.warn('[HeadlessBot] Previous tick still running, skipping overlap tick');
        return;
      }

      this.isTickRunning = true;
      try {
        await this.runLoop();
      } finally {
        this.isTickRunning = false;
      }
    };

    void runTick();
    this.intervalRef = setInterval(() => {
      void runTick();
    }, this.tickIntervalMs);
  }

  public stop() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }

    if (this.checkPnlIntervalRef) {
      clearInterval(this.checkPnlIntervalRef);
      this.checkPnlIntervalRef = null;
    }

    this.isTickRunning = false;
    this.logger.info('[HeadlessBot] Stopped');
  }

  public isStarted(): boolean {
    return this.intervalRef !== null;
  }

  public async runSingleTick(): Promise<void> {
    if (this.isTickRunning) {
      this.logger.warn('[HeadlessBot] runSingleTick skipped: tick already in progress');
      return;
    }

    this.isTickRunning = true;
    try {
      await this.runLoop();
    } finally {
      this.isTickRunning = false;
    }
  }

  private isKillSwitchEngaged(): boolean {
    const state = this.getState();
    return state.autoTradeMode === 'off' || !state.autoTradeRunning;
  }

  private isDuplicateIntent(intentId: string): boolean {
    const state = this.getState();

    const hasPendingIntent = state.pendingOrders.some(
      (order) => order.intentId === intentId && order.status === 'PENDING',
    );
    if (hasPendingIntent) return true;

    return state.autoTradeLogs.some(
      (log) => log.intentId === intentId && log.status === 'OPENED',
    );
  }

  private getContractSizeBySymbol(symbol: string): number {
    const contractSize = this.getState().contracts.find(
      (contract) => contract.symbol === symbol,
    )?.contractSize;

    return typeof contractSize === 'number' && Number.isFinite(contractSize) && contractSize > 0
      ? contractSize
      : 1;
  }

  private updateTrailingStops() {
    const state = this.getState();

    if (state.autoTradeMode === 'off' || !state.autoTradeConfig.trailingStop) {
      return;
    }

    const openLogs = state.autoTradeLogs.filter((log) => log.status === 'OPENED');

    for (const log of openLogs) {
      const ticker = state.tickers.find((item) => item.symbol === log.symbol);
      if (!ticker) continue;

      const currentPrice = ticker.lastPrice;
      const inProfit =
        (log.side === 'LONG' && currentPrice > log.entry) ||
        (log.side === 'SHORT' && currentPrice < log.entry);

      if (!inProfit) continue;

      const trailingMultiplier = 1.5;
      const atrApprox = ticker.high24Price - ticker.lower24Price;
      const currentTrail =
        currentPrice - (log.side === 'LONG' ? atrApprox * trailingMultiplier : -atrApprox * trailingMultiplier);

      const existingTrail = this.trailingStops[log.id]?.originalSl ?? log.sl;
      const canTighten =
        (log.side === 'LONG' && currentTrail > existingTrail) ||
        (log.side === 'SHORT' && currentTrail < existingTrail);

      if (!canTighten) continue;

      this.trailingStops[log.id] = {
        originalSl: currentTrail,
        lastUpdated: Date.now(),
      };

      this.logger.info('[HeadlessBot] Trailing stop updated', {
        symbol: log.symbol,
        logId: log.id,
        side: log.side,
        newStop: currentTrail,
      });
    }
  }

  private checkSimulationPnL() {
    const state = this.getState();

    if (state.autoTradeMode === 'off') {
      return;
    }

    const cid = generateCorrelationId('pnl');
    const slog = scopedLogger(this.logger, cid);

    this.updateTrailingStops();

    const openLogs = state.autoTradeLogs.filter((log) => log.status === 'OPENED');

    for (const log of openLogs) {
      const ticker = state.tickers.find((item) => item.symbol === log.symbol);
      if (!ticker) continue;

      const price = ticker.lastPrice;
      const contractSize = this.getContractSizeBySymbol(log.symbol);

      if (log.side === 'LONG') {
        if (price >= log.tp) {
          const pnl = (log.tp - log.entry) * log.quantity * contractSize * log.leverage;
          this.actions.updateAutoTradeLog(log.id, {
            status: 'TP_HIT',
            pnl: Math.round(pnl * 100) / 100,
          });

          this.logger.info('[HeadlessBot] TP hit', {
            correlationId: cid,
            symbol: log.symbol,
            side: log.side,
            mode: log.mode,
            pnl,
          });
        } else if (price <= log.sl) {
          const pnl = (log.sl - log.entry) * log.quantity * contractSize * log.leverage;
          this.actions.updateAutoTradeLog(log.id, {
            status: 'SL_HIT',
            pnl: Math.round(pnl * 100) / 100,
          });

          this.actions.addTradeLesson(
            `Lệnh ${log.side} ${log.symbol} giá ${log.entry} thất bại (hit SL). Cần cẩn trọng xác nhận lại xu hướng.`,
          );

          this.logger.warn('[HeadlessBot] SL hit', {
            correlationId: cid,
            symbol: log.symbol,
            side: log.side,
            mode: log.mode,
            pnl,
          });
        }
      } else if (price <= log.tp) {
        const pnl = (log.entry - log.tp) * log.quantity * contractSize * log.leverage;
        this.actions.updateAutoTradeLog(log.id, {
          status: 'TP_HIT',
          pnl: Math.round(pnl * 100) / 100,
        });

        this.logger.info('[HeadlessBot] TP hit', {
          correlationId: cid,
          symbol: log.symbol,
          side: log.side,
          mode: log.mode,
          pnl,
        });
      } else if (price >= log.sl) {
        const pnl = (log.entry - log.sl) * log.quantity * contractSize * log.leverage;
        this.actions.updateAutoTradeLog(log.id, {
          status: 'SL_HIT',
          pnl: Math.round(pnl * 100) / 100,
        });

        this.actions.addTradeLesson(
          `Lệnh ${log.side} ${log.symbol} giá ${log.entry} thất bại (hit SL). Rút kinh nghiệm đánh giá lại volume động lượng.`,
        );

        this.logger.warn('[HeadlessBot] SL hit', {
          correlationId: cid,
          symbol: log.symbol,
          side: log.side,
          mode: log.mode,
          pnl,
        });
      }
    }
  }

  private async runLoop() {
    const cid = generateCorrelationId('tick');
    const log = scopedLogger(this.logger, cid);
    const state = this.getState();

    if (state.autoTradeMode === 'off' || !state.autoTradeRunning) {
      this.stop();
      return;
    }

    const config = state.autoTradeConfig;

    const safetyCheck = isSafeToTrade(state.marketSentiment, state.news, {
      newsFilter: config.newsFilter,
      quietHours: config.quietHours,
    });

    if (!safetyCheck.safe) {
      log.warn('[HeadlessBot] Tick skipped by safety check', {
        reason: safetyCheck.reason,
      });
      return;
    }

    const dailyPnL = calcDailyPnL(state.autoTradeLogs);
    if (dailyPnL <= -config.dailyLossLimit) {
      log.error('[HeadlessBot] Daily loss limit reached, shutting down bot', {
        dailyPnL,
        dailyLossLimit: config.dailyLossLimit,
      });

      this.actions.setAutoTradeMode('off');
      this.actions.setAutoTradeRunning(false);
      this.stop();
      return;
    }

    const openedOrdersCount = state.autoTradeLogs.filter((item) => item.status === 'OPENED').length;
    if (openedOrdersCount >= config.maxConcurrentOrders) {
      log.debug('[HeadlessBot] Max concurrent orders reached, skip tick', {
        openedOrdersCount,
        maxConcurrentOrders: config.maxConcurrentOrders,
      });
      return;
    }

    let targetSymbols = config.symbols;
    const cachedSignals: Record<string, TradeSignal> = {};

    if (config.scanAllMarket) {
      const scannedSignals = Object.entries(state.signals).filter(
        ([, signal]) => signal.type !== 'NEUTRAL' && Date.now() - signal.timestamp < 60 * 60 * 1000,
      );

      if (scannedSignals.length > 0) {
        const start = this.scanIndex % scannedSignals.length;
        const end = Math.min(start + 5, scannedSignals.length);
        const chunk = scannedSignals.slice(start, end);

        targetSymbols = chunk.map(([symbol]) => symbol);
        for (const [symbol, signal] of chunk) {
          cachedSignals[symbol] = signal;
        }

        this.scanIndex = end >= scannedSignals.length ? 0 : end;
      } else {
        targetSymbols = state.tickers
          .filter((ticker) => ticker.symbol.endsWith('_USDT'))
          .sort((a, b) => b.amount24 - a.amount24)
          .slice(0, 10)
          .map((ticker) => ticker.symbol);
      }
    }

    for (const symbol of targetSymbols) {
      if (this.isKillSwitchEngaged()) {
        this.stop();
        return;
      }

      // Skip blacklisted symbols
      if (this.isSymbolBlacklisted(symbol)) {
        log.debug('[HeadlessBot] Skipping blacklisted symbol', { symbol });
        continue;
      }

      try {
        const guardState = this.getState();
        const openCount = guardState.autoTradeLogs.filter((item) => item.status === 'OPENED').length;
        if (openCount >= config.maxConcurrentOrders) {
          break;
        }

        const hasActiveTrade = guardState.autoTradeLogs.some(
          (item) => item.symbol === symbol && item.status === 'OPENED',
        );
        if (hasActiveTrade) {
          continue;
        }

        let tradeSignal: TradeSignal | undefined = cachedSignals[symbol];
        let currentPriceRaw = guardState.tickers.find((ticker) => ticker.symbol === symbol)?.lastPrice;

        if (!tradeSignal) {
          const klines = await guardedNetworkQueue.enqueue(() => fetchKlines(symbol, 'Min15', 300));
          if (!klines || !klines.time?.length) {
            continue;
          }

          const candles = klines.time.map((time, index) => ({
            time,
            open: klines.open[index],
            high: klines.high[index],
            low: klines.low[index],
            close: klines.close[index],
            volume: klines.vol[index],
          }));

          const generatedSignal = await generateSignalInWorker(candles, {
            timeoutMs: 25_000,
            fallbackToMainThread: true,
          });
          if (generatedSignal.type === 'NEUTRAL') {
            continue;
          }

          tradeSignal = generatedSignal;
          this.actions.setSignal?.(symbol, generatedSignal);

          const fallbackTakeProfit = generatedSignal.takeProfit;
          const fallbackStopLoss = generatedSignal.stopLoss;

          const hasAiKey =
            guardState.aiCredentials &&
            Object.values(guardState.aiCredentials).some(
              (value) => typeof value === 'string' && value.length > 0,
            );

          if (hasAiKey && guardState.aiCredentials) {
            const timesFmForecast = await guardedNetworkQueue.enqueue(() =>
              fetchTimesFmForecast(candles.map((item) => item.close), 12),
            );

            const marketContext = {
              volumeTrend: 'increasing' as const,
              volatility: generatedSignal.indicators?.marketRegime === 'VOLATILE' ? ('high' as const) : ('normal' as const),
            };

            const safePriceForAi = currentPriceRaw || generatedSignal.entry;

            const aiResult = await guardedNetworkQueue.enqueue(() =>
              analyzeWithAI(
                { ...guardState.aiCredentials } as AiModelCredentials,
                symbol,
                generatedSignal,
                candles,
                safePriceForAi,
                guardState.tradeLessons,
                timesFmForecast,
                marketContext,
              ),
            );

            if (aiResult) {
              if (aiResult.direction === 'NEUTRAL') {
                continue;
              }

              if (aiResult.direction !== generatedSignal.type) {
                tradeSignal = {
                  ...generatedSignal,
                  type: aiResult.direction,
                  confidence: aiResult.confidence,
                  aiProvider: aiResult.provider,
                  aiAnalysis: aiResult.debateHistory || aiResult.analysis,
                };

                const temporaryTp = tradeSignal.takeProfit;
                tradeSignal.takeProfit = tradeSignal.stopLoss;
                tradeSignal.stopLoss = temporaryTp;
              } else {
                tradeSignal = {
                  ...generatedSignal,
                  confidence: aiResult.confidence,
                  aiProvider: aiResult.provider,
                  aiAnalysis: aiResult.debateHistory || aiResult.analysis,
                };

                if (aiResult.keyLevels && aiResult.keyLevels.support > 0 && aiResult.keyLevels.resistance > 0) {
                  if (tradeSignal.type === 'LONG') {
                    if (aiResult.keyLevels.resistance > safePriceForAi) {
                      tradeSignal.takeProfit = aiResult.keyLevels.resistance;
                    }

                    if (aiResult.keyLevels.support < safePriceForAi) {
                      tradeSignal.stopLoss = aiResult.keyLevels.support;
                    }
                  } else if (tradeSignal.type === 'SHORT') {
                    if (aiResult.keyLevels.support < safePriceForAi) {
                      tradeSignal.takeProfit = aiResult.keyLevels.support;
                    }

                    if (aiResult.keyLevels.resistance > safePriceForAi) {
                      tradeSignal.stopLoss = aiResult.keyLevels.resistance;
                    }
                  }
                }
              }
            }
          }

          const safePriceFinal = currentPriceRaw || tradeSignal.entry;
          const hasValidLevels =
            tradeSignal.type === 'LONG'
              ? tradeSignal.takeProfit > safePriceFinal && tradeSignal.stopLoss < safePriceFinal
              : tradeSignal.takeProfit < safePriceFinal && tradeSignal.stopLoss > safePriceFinal;

          if (!hasValidLevels) {
            tradeSignal = {
              ...tradeSignal,
              takeProfit: fallbackTakeProfit,
              stopLoss: fallbackStopLoss,
            };
          }
        }

        if (!tradeSignal) {
          continue;
        }

        const currentPrice = currentPriceRaw || tradeSignal.entry || 0;
        if (!Number.isFinite(currentPrice) || currentPrice <= 0) {
          continue;
        }

        if (tradeSignal.confidence < config.minConfidence) {
          if (!(tradeSignal.marketRegime && tradeSignal.marketRegime !== 'VOLATILE')) {
            continue;
          }
        }

        const hasValidLevels =
          tradeSignal.type === 'LONG'
            ? tradeSignal.takeProfit > currentPrice && tradeSignal.stopLoss < currentPrice
            : tradeSignal.takeProfit < currentPrice && tradeSignal.stopLoss > currentPrice;

        if (!hasValidLevels) {
          continue;
        }

        const volatility = tradeSignal.indicators?.volatility;
        const volatilityAdjustment = volatility
          ? Math.max(0.3, Math.min(1.2, 1.0 / volatility))
          : 1.0;

        const regimeAdjustment =
          tradeSignal.marketRegime === 'VOLATILE'
            ? 0.5
            : tradeSignal.marketRegime === 'TRENDING'
              ? 1.5
              : 1.0;

        const slDistancePct = Math.abs(currentPrice - tradeSignal.stopLoss) / currentPrice;
        let dynamicLeverage = 10;
        if (slDistancePct > 0) {
          let leverageAdjustment = 1;
          if (tradeSignal.marketRegime === 'VOLATILE') leverageAdjustment = 0.8;
          else if (tradeSignal.marketRegime === 'TRENDING') leverageAdjustment = 1.3;

          dynamicLeverage = Math.floor((0.7 / slDistancePct) * leverageAdjustment);
          dynamicLeverage = Math.max(3, Math.min(dynamicLeverage, 40));
        }

        const freshState = this.getState();
        const activePositions = freshState.autoTradeLogs.filter((item) => item.status === 'OPENED');
        const activeMarginUsed = activePositions.reduce((sum, item) => {
          const size = this.getContractSizeBySymbol(item.symbol);
          return sum + (item.entry * item.quantity * size) / item.leverage;
        }, 0);

        const balance = freshState.accountBalance || freshState.demoBalance || 100;
        const riskPercent = freshState.autoTradeConfig.riskPercentPerTrade * volatilityAdjustment * regimeAdjustment;

        const contractSize = this.getContractSizeBySymbol(symbol);
        const quantity = calcPositionSize(
          balance,
          riskPercent,
          currentPrice,
          tradeSignal.stopLoss,
          dynamicLeverage,
          activeMarginUsed,
          0.85,
          contractSize,
        );

        if (!Number.isFinite(quantity) || quantity <= 0) {
          log.debug('[HeadlessBot] Skip trade due to invalid quantity', {
            symbol,
            quantity,
            balance,
            riskPercent,
          });
          continue;
        }

        const mode = freshState.autoTradeMode;
        if (mode === 'off') {
          continue;
        }

        const intentPayload: OrderIntentBuildPayload = {
          symbol,
          mode,
          side: tradeSignal.type as 'LONG' | 'SHORT',
          entry: currentPrice,
          tp: tradeSignal.takeProfit,
          sl: tradeSignal.stopLoss,
          quantity,
          leverage: dynamicLeverage,
          confidence: tradeSignal.confidence,
          winRate: tradeSignal.winRate || 50,
          aiProvider: tradeSignal.aiProvider || 'local',
        };

        const orderIntent = await buildOrderIntentInWorker(intentPayload, {
          timeoutMs: 10_000,
          fallbackToMainThread: true,
        });

        if (this.isDuplicateIntent(orderIntent.intentId)) {
          log.warn('[HeadlessBot] Duplicate intent blocked', {
            intentId: orderIntent.intentId,
            symbol,
          });
          continue;
        }

        const logEntry: AutoTradeLog = {
          id: orderIntent.logId,
          intentId: orderIntent.intentId,
          timestamp: orderIntent.createdAt,
          symbol: orderIntent.symbol,
          mode: orderIntent.mode,
          side: orderIntent.side,
          entry: orderIntent.entry,
          tp: orderIntent.tp,
          sl: orderIntent.sl,
          quantity: orderIntent.quantity,
          leverage: orderIntent.leverage,
          confidence: orderIntent.confidence,
          winRate: orderIntent.winRate,
          aiProvider: orderIntent.aiProvider,
          aiAnalysis: tradeSignal.aiAnalysis,
          status: 'OPENED',
        };

        this.trailingStops[logEntry.id] = {
          originalSl: logEntry.sl,
          lastUpdated: logEntry.timestamp,
        };

        if (mode === 'simulation') {
          if (this.isKillSwitchEngaged()) {
            this.stop();
            return;
          }

          this.actions.addAutoTradeLog(logEntry);
          this.actions.addOrder({
            id: `sim_${orderIntent.intentId}`,
            intentId: orderIntent.intentId,
            symbol: orderIntent.symbol,
            side: orderIntent.side,
            type: 'MARKET',
            price: orderIntent.entry,
            quantity: orderIntent.quantity,
            leverage: orderIntent.leverage,
            stopLoss: orderIntent.sl,
            takeProfit: orderIntent.tp,
            status: 'PENDING',
            createdAt: orderIntent.createdAt,
            signal: tradeSignal,
            isSimulation: true,
          });

          log.info('[HeadlessBot] Simulated order opened', {
            symbol: orderIntent.symbol,
            side: orderIntent.side,
            leverage: orderIntent.leverage,
            entry: orderIntent.entry,
            confidence: orderIntent.confidence,
          });
        } else if (mode === 'live') {
          const result = await guardedNetworkQueue.enqueue(async () => {
            const liveState = this.getState();

            if (liveState.autoTradeMode !== 'live' || !liveState.autoTradeRunning) {
              return {
                success: false,
                message: 'Kill switch active before order execution',
              };
            }

            if (!liveState.credentials) {
              return {
                success: false,
                message: 'Missing API credentials',
              };
            }

            return placeOrder(liveState.credentials.apiKey, liveState.credentials.secretKey, {
              symbol: orderIntent.symbol,
              price: orderIntent.entry,
              vol: orderIntent.quantity,
              leverage: orderIntent.leverage,
              side: orderIntent.side === 'LONG' ? 1 : 3,
              type: 5,
              openType: 1,
              stopLossPrice: orderIntent.sl,
              takeProfitPrice: orderIntent.tp,
            });
          });

          if (result?.success) {
            const orderId = result.data?.toString();

            this.actions.addAutoTradeLog({
              ...logEntry,
              orderId,
            });

            this.actions.addOrder({
              id: orderId || orderIntent.intentId,
              intentId: orderIntent.intentId,
              symbol: orderIntent.symbol,
              side: orderIntent.side,
              type: 'MARKET',
              price: orderIntent.entry,
              quantity: orderIntent.quantity,
              leverage: orderIntent.leverage,
              stopLoss: orderIntent.sl,
              takeProfit: orderIntent.tp,
              status: 'PENDING',
              createdAt: orderIntent.createdAt,
              signal: tradeSignal,
              isSimulation: false,
            });

            log.info('[HeadlessBot] Live order submitted', {
              symbol: orderIntent.symbol,
              side: orderIntent.side,
              leverage: orderIntent.leverage,
              entry: orderIntent.entry,
              orderId,
            });
          } else {
            this.actions.addAutoTradeLog({
              ...logEntry,
              status: 'SKIPPED',
              skipReason: result?.message || 'Order execution failed',
            });

            log.warn('[HeadlessBot] Live order skipped/failed', {
              symbol: orderIntent.symbol,
              side: orderIntent.side,
              reason: result?.message || 'Order execution failed',
            });
          }
        }
      // Reset error counter on successful symbol processing
        this.resetSymbolErrors(symbol);
      } catch (error) {
        const errMessage = error instanceof Error ? error.message : 'Unknown error';
        this.recordSymbolError(symbol, errMessage);
        log.error('[HeadlessBot] Error during symbol processing', {
          symbol,
          error: errMessage,
          errorCount: this.symbolErrorCounts.get(symbol) || 0,
        });
      }
    }
  }
}
