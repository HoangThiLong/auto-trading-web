import { useStore } from '../store/useStore';
import { HeadlessBotService, type HeadlessBotState, type HeadlessBotActions, type HeadlessBotLogger } from './headlessBot';
import type { AutoTradeLog, TradeSignal } from '../types';

/**
 * Desktop/UI Adapter
 * 
 * This is the adapter layer that connects the Zustand useStore (React UI) with HeadlessBotService.
 * It delegates heavy computation to HeadlessBotService while providing a lightweight mapping layer
 * for the UI to interact with via Zustand.
 * 
 * Architecture:
 * 
 *   ┌──────────────┐      Adapter       ┌─────────────────────┐
 *   │   UI Layer   │◄──────────────────►│  HeadlessBotService  │
 *   │ (Zustand)  │   autoTradeDaemon   │  (Pure Business     │
 *   └──────────────┘   (thin bridge)   │    Logic Engine)    │
 *                                    └─────────────────────┘
 */

class DesktopAdapterLogger implements HeadlessBotLogger {
  info(message: string, context?: Record<string, unknown>): void {
    console.log(message, context || {});
  }
  warn(message: string, context?: Record<string, unknown>): void {
    console.warn(message, context || {});
  }
  error(message: string, context?: Record<string, unknown>): void {
    console.error(message, context || {});
  }
  debug(message: string, context?: Record<string, unknown>): void {
    console.debug(message, context || {});
  }
}

// State Mapping: Zustand Store → HeadlessBotState
const mapStoreToHeadlessState = (): HeadlessBotState => {
  const store = useStore.getState();
  return {
    autoTradeMode: store.autoTradeMode,
    autoTradeRunning: store.autoTradeRunning,
    autoTradeConfig: store.autoTradeConfig,
    autoTradeLogs: store.autoTradeLogs,
    pendingOrders: store.pendingOrders,
    tradeLessons: store.tradeLessons,
    credentials: store.credentials,
    aiCredentials: store.aiCredentials,
    signals: store.signals,
    tickers: store.tickers,
    contracts: store.contracts,
    news: store.news,
    marketSentiment: store.marketSentiment,
    accountBalance: store.accountBalance,
    demoBalance: store.demoBalance || 10000,
  };
};

// Actions Mapping: HeadlessBotActions → Zustand Actions
const mapStoreActions = (): HeadlessBotActions => {
  const store = useStore.getState();
  return {
    setAutoTradeMode: (mode) => store.setAutoTradeMode(mode),
    setAutoTradeRunning: (running) => store.setAutoTradeRunning(running),
    addAutoTradeLog: (log) => store.addAutoTradeLog(log),
    updateAutoTradeLog: (id, updates) => store.updateAutoTradeLog(id, updates),
    addOrder: (order) => store.addOrder(order),
    addTradeLesson: (lesson) => store.addTradeLesson(lesson),
    setSignal: (symbol: string, signal: TradeSignal) => store.setSignal?.(symbol, signal),
  };
};

class DesktopAutoTradeAdapter {
  private readonly botService: HeadlessBotService;
  private readonly store = useStore;

  constructor() {
    this.botService = new HeadlessBotService({
      getState: mapStoreToHeadlessState,
      actions: mapStoreActions(),
      logger: new DesktopAdapterLogger(),
      tickIntervalMs: 30_000,
      pnlCheckIntervalMs: 15_000,
    });
  }

  /**
   * Start the auto trading daemon from UI.
   * Corresponds to the old autoTradeDaemon.start() behavior.
   */
  public start(): void {
    console.log('[DesktopAutoTradeAdapter] Starting via HeadlessBotService');
    this.botService.start();
  }

  /**
   * Stop the auto trading daemon from UI.
   * Corresponds to the old autoTradeDaemon.stop() behavior.
   */
  public stop(): void {
    console.log('[DesktopAutoTradeAdapter] Stopping HeadlessBotService');
    this.botService.stop();
  }

  /**
   * Check if the daemon is currently running.
   */
  public isStarted(): boolean {
    return this.botService.isStarted();
  }

  /**
   * Manually trigger a single trading loop tick.
   * Useful for testing or manual trading force.
   */
  public async runSingleTick(): Promise<void> {
    await this.botService.runSingleTick();
  }

  /**
   * Get the underlying HeadlessBotService instance.
   * Exposed for advanced use cases only.
   */
  public getEngine(): HeadlessBotService {
    return this.botService;
  }
}

// Export singleton instance for UI components
export const desktopAutoTradeAdapter = new DesktopAutoTradeAdapter();

// Alias export — used by App.tsx and AutoTradePanel.tsx dynamic imports
// CRITICAL: Without this, the daemon auto-resume on page reload is silently broken
//           because those files destructure `{ autoTradeDaemon }` from this module.
export { desktopAutoTradeAdapter as autoTradeDaemon };
