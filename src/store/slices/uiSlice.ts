import type { StateCreator } from 'zustand';

export type AppTab = 'chart' | 'signals' | 'orders' | 'account' | 'settings' | 'news';

export interface UiSlice {
  activeTab: AppTab;
  sidebarOpen: boolean;
  apiModalOpen: boolean;
  autoTradePanelOpen: boolean;
  setActiveTab: (tab: AppTab) => void;
  setSidebarOpen: (v: boolean) => void;
  setApiModalOpen: (v: boolean) => void;
  setAutoTradePanelOpen: (v: boolean) => void;
}

export const createUiSlice = <T extends UiSlice>(): StateCreator<T, [], [], UiSlice> =>
  (set) => ({
    activeTab: 'chart',
    sidebarOpen: true,
    apiModalOpen: false,
    autoTradePanelOpen: false,
    setActiveTab: (activeTab) => set({ activeTab } as Partial<T>),
    setSidebarOpen: (sidebarOpen) => set({ sidebarOpen } as Partial<T>),
    setApiModalOpen: (apiModalOpen) => set({ apiModalOpen } as Partial<T>),
    setAutoTradePanelOpen: (autoTradePanelOpen) => set({ autoTradePanelOpen } as Partial<T>),
  });
