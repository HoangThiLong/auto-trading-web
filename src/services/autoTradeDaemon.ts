import { useStore } from '../store/useStore';
import { HeadlessBotService, type HeadlessBotState, type HeadlessBotActions, type HeadlessBotLogger } from './headlessBot';
import type { TradeSignal } from '../types';

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

class DesktopAutoTradeAdapter {
  private readonly botService: HeadlessBotService;

  constructor() {
    // IMPORTANT: Pass a function that creates fresh actions on every call.
    // Zustand action references are stable, but wrapping ensures we always
    // read from the latest store state for any future-proofing.
    const freshActions: HeadlessBotActions = {
      setAutoTradeMode: (mode) => useStore.getState().setAutoTradeMode(mode),
      setAutoTradeRunning: (running) => useStore.getState().setAutoTradeRunning(running),
      addAutoTradeLog: (log) => useStore.getState().addAutoTradeLog(log),
      updateAutoTradeLog: (id, updates) => useStore.getState().updateAutoTradeLog(id, updates),
      addOrder: (order) => useStore.getState().addOrder(order),
      removeOrder: (id) => useStore.getState().removeOrder(id),
      addTradeLesson: (lesson) => useStore.getState().addTradeLesson(lesson),
      setSignal: (symbol: string, signal: TradeSignal) => useStore.getState().setSignal?.(symbol, signal),
    };

    this.botService = new HeadlessBotService({
      getState: mapStoreToHeadlessState,
      actions: freshActions,
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
    this.botService.start();
  }

  /**
   * Stop the auto trading daemon from UI.
   * Corresponds to the old autoTradeDaemon.stop() behavior.
   */
  public stop(): void {
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
