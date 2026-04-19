import { useShallow } from 'zustand/react/shallow';
import { useStore } from './useStore';

type StoreState = ReturnType<typeof useStore.getState>;

const marketSelectionSelector = (state: StoreState) => ({
  selectedSymbol: state.selectedSymbol,
  selectedInterval: state.selectedInterval,
  setSelectedSymbol: state.setSelectedSymbol,
  setSelectedInterval: state.setSelectedInterval,
});

const signalPanelSelector = (state: StoreState) => ({
  selectedSymbol: state.selectedSymbol,
  signals: state.signals,
  setSignal: state.setSignal,
  isAnalyzing: state.isAnalyzing,
  setIsAnalyzing: state.setIsAnalyzing,
  aiCredentials: state.aiCredentials,
  setCurrentAiProvider: state.setCurrentAiProvider,
  signalScanInterval: state.signalScanInterval,
  setSignalScanInterval: state.setSignalScanInterval,
  tickers: state.tickers,
  setSelectedSymbol: state.setSelectedSymbol,
  tradeLessons: state.tradeLessons,
});

const tradingChartSelector = (state: StoreState) => ({
  selectedSymbol: state.selectedSymbol,
  selectedInterval: state.selectedInterval,
  setSelectedInterval: state.setSelectedInterval,
  signal: state.signals[state.selectedSymbol],
  autoTradeLogs: state.autoTradeLogs,
  pendingOrders: state.pendingOrders,
});

const orderBookSelector = (state: StoreState) => ({
  selectedSymbol: state.selectedSymbol,
  ticker: state.tickers.find((ticker) => ticker.symbol === state.selectedSymbol),
  contracts: state.contracts,
});

const coinListSelector = (state: StoreState) => ({
  tickers: state.tickers,
  selectedSymbol: state.selectedSymbol,
  setSelectedSymbol: state.setSelectedSymbol,
  signals: state.signals,
});

const orderPanelSelector = (state: StoreState) => ({
  selectedSymbol: state.selectedSymbol,
  tickers: state.tickers,
  contracts: state.contracts,
  credentials: state.credentials,
  addOrder: state.addOrder,
  pendingOrders: state.pendingOrders,
  updateOrder: state.updateOrder,
});

const settingsPanelSelector = (state: StoreState) => ({
  setApiModalOpen: state.setApiModalOpen,
  setAutoTradePanelOpen: state.setAutoTradePanelOpen,
  setActiveTab: state.setActiveTab,
  aiCredentials: state.aiCredentials,
  autoTradeMode: state.autoTradeMode,
  autoTradeConfig: state.autoTradeConfig,
});

const newsFeedSelector = (state: StoreState) => ({
  news: state.news,
  setNews: state.setNews,
  marketSentiment: state.marketSentiment,
  setMarketSentiment: state.setMarketSentiment,
  newsLoading: state.newsLoading,
  setNewsLoading: state.setNewsLoading,
  aiCredentials: state.aiCredentials,
});

const autoTradePanelSelector = (state: StoreState) => ({
  autoTradePanelOpen: state.autoTradePanelOpen,
  setAutoTradePanelOpen: state.setAutoTradePanelOpen,
  autoTradeMode: state.autoTradeMode,
  setAutoTradeMode: state.setAutoTradeMode,
  autoTradeConfig: state.autoTradeConfig,
  setAutoTradeConfig: state.setAutoTradeConfig,
  autoTradeLogs: state.autoTradeLogs,
  clearAutoTradeLogs: state.clearAutoTradeLogs,
  autoTradeRunning: state.autoTradeRunning,
  setAutoTradeRunning: state.setAutoTradeRunning,
  updateAutoTradeLog: state.updateAutoTradeLog,
  credentials: state.credentials,
  signals: state.signals,
  tickers: state.tickers,
  contracts: state.contracts,
  news: state.news,
  marketSentiment: state.marketSentiment,
});

const apiKeyModalSelector = (state: StoreState) => ({
  apiModalOpen: state.apiModalOpen,
  setApiModalOpen: state.setApiModalOpen,
  credentials: state.credentials,
  setCredentials: state.setCredentials,
  setIsApiConnected: state.setIsApiConnected,
  aiCredentials: state.aiCredentials,
  setAiCredentials: state.setAiCredentials,
  mexcNetwork: state.mexcNetwork,
  setMexcNetwork: state.setMexcNetwork,
});

export const useTickers = () => useStore((state) => state.tickers);

export const useSelectedSymbol = () => useStore((state) => state.selectedSymbol);

export const useSelectedSymbolTicker = () =>
  useStore((state) => state.tickers.find((ticker) => ticker.symbol === state.selectedSymbol));

export const useSelectedInterval = () => useStore((state) => state.selectedInterval);

export const useSetSelectedInterval = () => useStore((state) => state.setSelectedInterval);

export const useCurrentSignal = () => useStore((state) => state.signals[state.selectedSymbol]);

export const useAutoTradeLogs = () => useStore((state) => state.autoTradeLogs);

export const usePendingOrders = () => useStore((state) => state.pendingOrders);

export const useMarketSelection = () => useStore(useShallow(marketSelectionSelector));

export const useSignalPanelState = () => useStore(useShallow(signalPanelSelector));

export const useTradingChartState = () => useStore(useShallow(tradingChartSelector));

export const useOrderBookState = () => useStore(useShallow(orderBookSelector));

export const useCoinListState = () => useStore(useShallow(coinListSelector));

export const useOrderPanelState = () => useStore(useShallow(orderPanelSelector));

export const useSettingsPanelState = () => useStore(useShallow(settingsPanelSelector));

export const useNewsFeedState = () => useStore(useShallow(newsFeedSelector));

export const useAutoTradePanelState = () => useStore(useShallow(autoTradePanelSelector));

export const useApiKeyModalState = () => useStore(useShallow(apiKeyModalSelector));
