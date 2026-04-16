import type { StateCreator } from 'zustand';
import type { ContractInfo, ContractTicker, TimeInterval } from '../../types';

export interface MarketDataSlice {
  tickers: ContractTicker[];
  contracts: ContractInfo[];
  selectedSymbol: string;
  selectedInterval: TimeInterval;
  setTickers: (tickers: ContractTicker[]) => void;
  updateSingleTicker: (symbol: string, updates: Partial<ContractTicker>) => void;
  setContracts: (contracts: ContractInfo[]) => void;
  setSelectedSymbol: (symbol: string) => void;
  setSelectedInterval: (interval: TimeInterval) => void;
}

export const createMarketDataSlice = <T extends MarketDataSlice>(): StateCreator<T, [], [], MarketDataSlice> =>
  (set) => ({
    tickers: [],
    contracts: [],
    selectedSymbol: 'BTC_USDT',
    selectedInterval: 'Min15',
    setTickers: (tickers) => set({ tickers } as Partial<T>),
    updateSingleTicker: (symbol, updates) =>
      set((state) => ({
        tickers: state.tickers.map((ticker) =>
          ticker.symbol === symbol ? { ...ticker, ...updates } : ticker
        ),
      }) as Partial<T>),
    setContracts: (contracts) => set({ contracts } as Partial<T>),
    setSelectedSymbol: (selectedSymbol) => set({ selectedSymbol } as Partial<T>),
    setSelectedInterval: (selectedInterval) => set({ selectedInterval } as Partial<T>),
  });
