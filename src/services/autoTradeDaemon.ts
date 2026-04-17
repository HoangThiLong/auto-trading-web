import { useStore } from '../store/useStore';
import { buildOrderIntentInWorker, generateSignalInWorker } from './analysisWorkerClient';
import { guardedNetworkQueue } from './asyncTaskQueue';
import { calcPositionSize, calcDailyPnL } from './capitalManager';
import { isSafeToTrade } from './newsService';
import { fetchKlines, placeOrder } from './mexcApi';
import { analyzeWithAI } from './geminiAi';
import { fetchTimesFmForecast } from './timesfmService';
import type { AutoTradeLog, CandlePoint, TradeSignal } from '../types';
import type { OrderIntentBuildPayload } from './analysis';
import toast from 'react-hot-toast';

class AutoTradeDaemonService {
  private intervalRef: ReturnType<typeof setInterval> | null = null;
  private checkPnlIntervalRef: ReturnType<typeof setInterval> | null = null;
  private scanIndex = 0;
  private trailingStops: Record<string, { originalSl: number; lastUpdated: number }> = {};

  // Mutex lock to prevent overlap execution
  private isRunning = false;

  public start() {
    this.stop();
    console.log('[AutoTradeDaemon] Started');

    // Check PnL Interval
    const checkPnL = () => this.checkSimulationPnL();
    this.checkPnlIntervalRef = setInterval(checkPnL, 15000); // check every 15s

    // Main Trade Loop
    const runTick = async () => {
      // Prevent overlapping runs
      if (this.isRunning) {
        console.warn('[AutoTradeDaemon] Previous tick is still running. Skipping to prevent overlap.');
        return;
      }
      this.isRunning = true;
      try {
        await this.runLoop();
      } finally {
        this.isRunning = false;
      }
    };

    runTick();
    this.intervalRef = setInterval(runTick, 30 * 1000);
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
    this.isRunning = false;
    console.log('[AutoTradeDaemon] Stopped');
  }

  private isKillSwitchEngaged(): boolean {
    const store = useStore.getState();
    return store.autoTradeMode === 'off' || !store.autoTradeRunning;
  }

  private isDuplicateIntent(intentId: string): boolean {
    const store = useStore.getState();
    const hasPendingIntent = store.pendingOrders.some(
      (order) => order.intentId === intentId && order.status === 'PENDING',
    );
    if (hasPendingIntent) return true;

    return store.autoTradeLogs.some(
      (log) => log.intentId === intentId && log.status === 'OPENED',
    );
  }

  private getContractSizeBySymbol(symbol: string): number {
    const contractSize = useStore
      .getState()
      .contracts?.find((contract) => contract.symbol === symbol)?.contractSize;

    return typeof contractSize === 'number' && Number.isFinite(contractSize) && contractSize > 0
      ? contractSize
      : 1;
  }

  // --- Trailing Stops Logic ---
  public updateTrailingStops() {
    const store = useStore.getState();
    const tickerData = store.tickers;
    const autoTradeMode = store.autoTradeMode;
    const autoTradeConfig = store.autoTradeConfig;

    if (autoTradeMode === 'off' || !autoTradeConfig.trailingStop) return;

    const liveLogs = store.autoTradeLogs.filter((l) => l.status === 'OPENED');
    const trailingLogs = liveLogs.filter((log) => {
      const ticker = tickerData.find((t) => t.symbol === log.symbol);
      const currentPrice = ticker?.lastPrice;
      return (
        currentPrice
        && ((log.side === 'LONG' && currentPrice > log.entry) || (log.side === 'SHORT' && currentPrice < log.entry))
      );
    });

    trailingLogs.forEach((log) => {
      const ticker = tickerData.find((t) => t.symbol === log.symbol);
      if (!ticker) return;

      const currentPrice = ticker.lastPrice;
      const trailingMultiplier = 1.5;
      const atr = ticker.high24Price - ticker.lower24Price;
      const currentTrail =
        currentPrice - (log.side === 'LONG' ? atr * trailingMultiplier : -atr * trailingMultiplier);

      if (
        (log.side === 'LONG' && currentTrail > (this.trailingStops[log.id]?.originalSl || log.sl))
        || (log.side === 'SHORT' && currentTrail < (this.trailingStops[log.id]?.originalSl || log.sl))
      ) {
        if (
          !this.trailingStops[log.id]
          || (log.side === 'LONG' && currentTrail > this.trailingStops[log.id].originalSl)
          || (log.side === 'SHORT' && currentTrail < this.trailingStops[log.id].originalSl)
        ) {
          this.trailingStops[log.id] = { originalSl: currentTrail, lastUpdated: Date.now() };

          if (autoTradeMode === 'live' && store.credentials) {
            console.log(`[AutoTradeDaemon] Expected to update SL for ${log.id} to ${currentTrail}`);
          }
        }
      }
    });
  }

  // --- Simulation PnL Logic Check ---
  private checkSimulationPnL() {
    const store = useStore.getState();
    if (store.autoTradeMode === 'off') return;

    // Need to constantly update trailing stops in simulation and before any pnl checks
    this.updateTrailingStops();

    const logs = store.autoTradeLogs;
    const currentTickers = store.tickers;
    const openLogs = logs.filter((l) => l.status === 'OPENED');

    for (const log of openLogs) {
      const ticker = currentTickers.find((t) => t.symbol === log.symbol);
      if (!ticker) continue;
      const price = ticker.lastPrice;
      const contractSize = this.getContractSizeBySymbol(log.symbol);
      if (log.side === 'LONG') {
        if (price >= log.tp) {
          const pnl = (log.tp - log.entry) * log.quantity * contractSize * log.leverage;
          store.updateAutoTradeLog(log.id, { status: 'TP_HIT', pnl: Math.round(pnl * 100) / 100 });
          toast.success(`✅ [${log.mode === 'simulation' ? 'SIM' : 'LIVE'}] ${log.symbol} TP HIT! +${pnl.toFixed(2)}$`);
        } else if (price <= log.sl) {
          const pnl = (log.sl - log.entry) * log.quantity * contractSize * log.leverage;
          store.updateAutoTradeLog(log.id, { status: 'SL_HIT', pnl: Math.round(pnl * 100) / 100 });
          store.addTradeLesson(
            `Lệnh ${log.side} ${log.symbol} giá ${log.entry} thất bại (hit SL). Cần cẩn trọng xác nhận lại xu hướng.`,
          );
          toast.error(`❌ [${log.mode === 'simulation' ? 'SIM' : 'LIVE'}] ${log.symbol} SL HIT! ${pnl.toFixed(2)}$`);
        }
      } else if (price <= log.tp) {
        const pnl = (log.entry - log.tp) * log.quantity * contractSize * log.leverage;
        store.updateAutoTradeLog(log.id, { status: 'TP_HIT', pnl: Math.round(pnl * 100) / 100 });
        toast.success(`✅ [${log.mode === 'simulation' ? 'SIM' : 'LIVE'}] ${log.symbol} TP HIT! +${pnl.toFixed(2)}$`);
      } else if (price >= log.sl) {
        const pnl = (log.entry - log.sl) * log.quantity * contractSize * log.leverage;
        store.updateAutoTradeLog(log.id, { status: 'SL_HIT', pnl: Math.round(pnl * 100) / 100 });
        store.addTradeLesson(
          `Lệnh ${log.side} ${log.symbol} giá ${log.entry} thất bại (hit SL). Rút kinh nghiệm đánh giá lại volume động lượng.`,
        );
        toast.error(`❌ [${log.mode === 'simulation' ? 'SIM' : 'LIVE'}] ${log.symbol} SL HIT! ${pnl.toFixed(2)}$`);
      }
    }
  }

  // --- Main Tick Loop ---
  private async runLoop() {
    const store = useStore.getState();
    if (store.autoTradeMode === 'off' || !store.autoTradeRunning) {
      this.stop();
      return;
    }

    const config = store.autoTradeConfig;
    const safetyCheck = isSafeToTrade(store.marketSentiment, store.news, {
      newsFilter: config.newsFilter,
      quietHours: config.quietHours,
    });
    if (!safetyCheck.safe) return;

    const dailyPnL = calcDailyPnL(store.autoTradeLogs);
    if (dailyPnL <= -config.dailyLossLimit) {
      toast.error(`⛔ Daily loss limit reached: -${config.dailyLossLimit} USDT`);
      store.setAutoTradeMode('off');
      store.setAutoTradeRunning(false);
      this.stop();
      return;
    }

    const activeLogs = store.autoTradeLogs.filter((l) => l.status === 'OPENED');
    if (activeLogs.length >= config.maxConcurrentOrders) return;

    let targetSymbols = config.symbols;
    const cachedSignals: Record<string, TradeSignal> = {};

    if (config.scanAllMarket) {
      const scannedSignals = Object.entries(store.signals).filter(
        ([, sig]) => sig.type !== 'NEUTRAL' && Date.now() - sig.timestamp < 3600000,
      );

      if (scannedSignals.length > 0) {
        const start = this.scanIndex % scannedSignals.length;
        const end = Math.min(start + 5, scannedSignals.length);
        const chunk = scannedSignals.slice(start, end);
        targetSymbols = chunk.map(([sym]) => sym);
        chunk.forEach(([sym, sig]) => {
          cachedSignals[sym] = sig as TradeSignal;
        });
        this.scanIndex = end >= scannedSignals.length ? 0 : end;
      } else {
        targetSymbols = store.tickers
          .filter((t) => t.symbol.endsWith('_USDT'))
          .sort((a, b) => b.amount24 - a.amount24)
          .slice(0, 10)
          .map((t) => t.symbol);
      }
    }

    for (const sym of targetSymbols) {
      if (this.isKillSwitchEngaged()) {
        this.stop();
        return;
      }

      try {
        const guardStore = useStore.getState();
        const openCount = guardStore.autoTradeLogs.filter((l) => l.status === 'OPENED').length;
        if (openCount >= config.maxConcurrentOrders) break;

        const hasActive = guardStore.autoTradeLogs.some((l) => l.symbol === sym && l.status === 'OPENED');
        if (hasActive) continue;

        let tradeSignal: TradeSignal | undefined = cachedSignals[sym];
        let currentPriceRaw = guardStore.tickers.find((t) => t.symbol === sym)?.lastPrice;

        if (!tradeSignal) {
          const klines = await guardedNetworkQueue.enqueue(() => fetchKlines(sym, 'Min15', 300));
          if (!klines || !klines.time?.length) continue;

          const candles: CandlePoint[] = klines.time.map((t, i) => ({
            time: t,
            open: klines.open[i],
            high: klines.high[i],
            low: klines.low[i],
            close: klines.close[i],
            volume: klines.vol[i],
          }));

          const signal = await generateSignalInWorker(candles, {
            timeoutMs: 25000,
            fallbackToMainThread: true,
          });
          if (signal.type === 'NEUTRAL') continue;

          tradeSignal = signal;
          const fallbackTakeProfit = signal.takeProfit;
          const fallbackStopLoss = signal.stopLoss;
          const hasAiKey =
            guardStore.aiCredentials
            && Object.values(guardStore.aiCredentials).some(
              (v) => typeof v === 'string' && v.length > 0,
            );

          if (hasAiKey && guardStore.aiCredentials) {
            const timesFmForecast = await guardedNetworkQueue.enqueue(() =>
              fetchTimesFmForecast(candles.map((c) => c.close), 12),
            );
            const marketContext = {
              volumeTrend: 'increasing' as 'increasing' | 'decreasing' | 'neutral',
              volatility:
                signal.indicators?.marketRegime === 'VOLATILE'
                  ? ('high' as const)
                  : ('normal' as const),
            };
            const safePriceAI = currentPriceRaw || signal.entry;
            const aiResult = await guardedNetworkQueue.enqueue(() =>
              analyzeWithAI(
                { ...guardStore.aiCredentials },
                sym,
                signal,
                candles,
                safePriceAI,
                guardStore.tradeLessons,
                timesFmForecast,
                marketContext,
              ),
            );

            if (aiResult) {
              if (aiResult.direction === 'NEUTRAL') continue;
              if (aiResult.direction !== signal.type) {
                tradeSignal = {
                  ...signal,
                  type: aiResult.direction,
                  confidence: aiResult.confidence,
                  aiProvider: aiResult.provider,
                  aiAnalysis: aiResult.debateHistory || aiResult.analysis, // Store the full debate
                };
                const temp = tradeSignal.takeProfit;
                tradeSignal.takeProfit = tradeSignal.stopLoss;
                tradeSignal.stopLoss = temp;
              } else {
                tradeSignal = {
                  ...signal,
                  confidence: aiResult.confidence,
                  aiProvider: aiResult.provider,
                  aiAnalysis: aiResult.debateHistory || aiResult.analysis,
                };
                if (
                  aiResult.keyLevels
                  && aiResult.keyLevels.support > 0
                  && aiResult.keyLevels.resistance > 0
                ) {
                  if (tradeSignal.type === 'LONG') {
                    if (aiResult.keyLevels.resistance > safePriceAI) {
                      tradeSignal.takeProfit = aiResult.keyLevels.resistance;
                    }
                    if (aiResult.keyLevels.support < safePriceAI) {
                      tradeSignal.stopLoss = aiResult.keyLevels.support;
                    }
                  } else if (tradeSignal.type === 'SHORT') {
                    if (aiResult.keyLevels.support < safePriceAI) {
                      tradeSignal.takeProfit = aiResult.keyLevels.support;
                    }
                    if (aiResult.keyLevels.resistance > safePriceAI) {
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

        if (!tradeSignal) continue;

        const currentPrice: number = currentPriceRaw || tradeSignal.entry || 0;
        if (!Number.isFinite(currentPrice) || currentPrice <= 0) continue;

        if (tradeSignal.confidence < config.minConfidence) {
          if (tradeSignal.marketRegime && tradeSignal.marketRegime !== 'VOLATILE') {
            // Let it pass with slightly lower conf
          } else {
            continue;
          }
        }

        const hasValidLevels =
          tradeSignal.type === 'LONG'
            ? tradeSignal.takeProfit > currentPrice && tradeSignal.stopLoss < currentPrice
            : tradeSignal.takeProfit < currentPrice && tradeSignal.stopLoss > currentPrice;

        if (!hasValidLevels) continue;

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

        const freshStore = useStore.getState();
        const activePositions = freshStore.autoTradeLogs.filter((l) => l.status === 'OPENED');
        const activeMarginUsed = activePositions.reduce((sum, l) => {
          const tempSize = this.getContractSizeBySymbol(l.symbol);
          return sum + (l.entry * l.quantity * tempSize) / l.leverage;
        }, 0);

        const balance = freshStore.accountBalance || 100;
        const riskPercent =
          freshStore.autoTradeConfig.riskPercentPerTrade * volatilityAdjustment * regimeAdjustment;

        const contractSize = this.getContractSizeBySymbol(sym);
        const qty = calcPositionSize(
          balance,
          riskPercent,
          currentPrice,
          tradeSignal.stopLoss,
          dynamicLeverage,
          activeMarginUsed,
          0.85,
          contractSize,
        );

        if (!Number.isFinite(qty) || qty <= 0) {
          console.warn(`[AutoTrade] Skip ${sym}: invalid quantity`, qty);
          continue;
        }

        const mode = freshStore.autoTradeMode;
        if (mode === 'off') {
          continue;
        }

        const intentPayload: OrderIntentBuildPayload = {
          symbol: sym,
          mode,
          side: tradeSignal.type as 'LONG' | 'SHORT',
          entry: currentPrice,
          tp: tradeSignal.takeProfit,
          sl: tradeSignal.stopLoss,
          quantity: qty,
          leverage: dynamicLeverage,
          confidence: tradeSignal.confidence,
          winRate: tradeSignal.winRate || 50,
          aiProvider: tradeSignal.aiProvider || 'local',
        };

        const orderIntent = await buildOrderIntentInWorker(intentPayload, {
          timeoutMs: 10000,
          fallbackToMainThread: true,
        });

        if (this.isDuplicateIntent(orderIntent.intentId)) {
          console.warn(`[AutoTradeDaemon] Duplicate order intent blocked: ${orderIntent.intentId}`);
          continue;
        }

        const log: AutoTradeLog = {
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

        this.trailingStops[log.id] = { originalSl: log.sl, lastUpdated: log.timestamp };

        if (mode === 'simulation') {
          if (this.isKillSwitchEngaged()) {
            this.stop();
            return;
          }

          freshStore.addAutoTradeLog(log);
          freshStore.addOrder({
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
          toast(
            `🤖 [SIM] ${orderIntent.side} ${orderIntent.symbol} (${orderIntent.leverage}x) @ ${orderIntent.entry.toFixed(2)}`,
            { icon: '🟡', duration: 3000 },
          );
        } else if (mode === 'live') {
          const result: any = await guardedNetworkQueue.enqueue(async () => {
            const liveStore = useStore.getState();
            if (liveStore.autoTradeMode !== 'live' || !liveStore.autoTradeRunning) {
              return {
                success: false,
                message: 'Kill switch active before order execution',
              };
            }

            if (!liveStore.credentials) {
              return {
                success: false,
                message: 'Missing API credentials',
              };
            }

            return placeOrder(liveStore.credentials.apiKey, liveStore.credentials.secretKey, {
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

          const postExecutionStore = useStore.getState();
          if (result?.success) {
            const orderId = result.data?.toString();
            postExecutionStore.addAutoTradeLog({
              ...log,
              orderId,
            });
            postExecutionStore.addOrder({
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
            toast.success(
              `🤖 [LIVE] ${orderIntent.side} ${orderIntent.symbol} (${orderIntent.leverage}x) @ ${orderIntent.entry.toFixed(2)}`,
            );
          } else {
            postExecutionStore.addAutoTradeLog({
              ...log,
              status: 'SKIPPED',
              skipReason: result?.message || 'Order execution failed',
            });
          }
        }
      } catch (err: any) {
        console.error('[AutoTradeDaemon] Error for', sym, err);
      }
    }
  }
}

export const autoTradeDaemon = new AutoTradeDaemonService();
