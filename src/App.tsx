import { useEffect, useState, useRef } from 'react';
import { Toaster } from 'react-hot-toast';
import { useStore } from './store/useStore';
import { fetchAllTickers, fetchContractInfo } from './services/mexcApi';
import CoinList from './components/CoinList';
import TradingChart from './components/TradingChart';
import OrderBook from './components/OrderBook';
import SignalPanel from './components/SignalPanel';
import OrderPanel from './components/OrderPanel';
import AccountPanel from './components/AccountPanel';
import PendingOrdersPanel from './components/PendingOrdersPanel';
import SettingsPanel from './components/SettingsPanel';
import TickerBar from './components/TickerBar';
import NewsFeed from './components/NewsFeed';
import ApiKeyModal from './components/ApiKeyModal';
import AutoTradePanel from './components/AutoTradePanel';
import type { CandlePoint, TradeSignal } from './types';
import {
  BarChart2, Brain, ShoppingBag, Wallet, Settings,
  Menu, X, Wifi, WifiOff, ChevronLeft, ChevronRight,
  Key, Bot, Newspaper,
  TrendingUp, TrendingDown, Minus,
} from 'lucide-react';

const LAYOUT_STORAGE_KEY = 'mexc_layout_sizes_v1';
const DEFAULT_LAYOUT = {
  sidebarWidth: 280,
  chartRightWidth: 360,
  chartSignalHeight: 450,
  ordersFormWidth: 320,
  ordersBookWidth: 208,
};

type DragTarget =
  | null
  | 'sidebar-width'
  | 'chart-right-width'
  | 'chart-right-height'
  | 'orders-form-width'
  | 'orders-book-width';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const readInitialLayout = () => {
  if (typeof window === 'undefined') return DEFAULT_LAYOUT;
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw);
    return {
      sidebarWidth: Number(parsed.sidebarWidth) || DEFAULT_LAYOUT.sidebarWidth,
      chartRightWidth: Number(parsed.chartRightWidth) || DEFAULT_LAYOUT.chartRightWidth,
      chartSignalHeight: Number(parsed.chartSignalHeight) || DEFAULT_LAYOUT.chartSignalHeight,
      ordersFormWidth: Number(parsed.ordersFormWidth) || DEFAULT_LAYOUT.ordersFormWidth,
      ordersBookWidth: Number(parsed.ordersBookWidth) || DEFAULT_LAYOUT.ordersBookWidth,
    };
  } catch {
    return DEFAULT_LAYOUT;
  }
};

export default function App() {
  const setTickers = useStore(s => s.setTickers);
  const setContracts = useStore(s => s.setContracts);
  const activeTab = useStore(s => s.activeTab);
  const setActiveTab = useStore(s => s.setActiveTab);
  const sidebarOpen = useStore(s => s.sidebarOpen);
  const setSidebarOpen = useStore(s => s.setSidebarOpen);
  const credentials = useStore(s => s.credentials);
  const isApiConnected = useStore(s => s.isApiConnected);
  const aiCredentials = useStore(s => s.aiCredentials);
  const selectedSymbol = useStore(s => s.selectedSymbol);
  const setApiModalOpen = useStore(s => s.setApiModalOpen);
  const setAutoTradePanelOpen = useStore(s => s.setAutoTradePanelOpen);
  const autoTradeMode = useStore(s => s.autoTradeMode);
  const currentSignal = useStore(s => s.signals[s.selectedSymbol]);
  const marketSentiment = useStore(s => s.marketSentiment);
  const autoTradeRunning = useStore(s => s.autoTradeRunning);

  // Resume/stop Auto Trade Daemon based on persisted runtime state
  useEffect(() => {
    let disposed = false;

    import('./services/autoTradeDaemon')
      .then(({ autoTradeDaemon }) => {
        if (disposed) return;

        if (autoTradeMode !== 'off' && autoTradeRunning) {
          console.log('🔄 Tự động khôi phục Auto-Trade từ phiên trước...');
          autoTradeDaemon.start();
        } else {
          autoTradeDaemon.stop();
        }
      })
      .catch((err) => {
        if (!disposed) {
          console.error('AutoTrade daemon init error:', err);
        }
      });

    return () => {
      disposed = true;
    };
  }, [autoTradeMode, autoTradeRunning]);

  const [candles, setCandles] = useState<CandlePoint[]>([]);
  const [prefillSignal, setPrefillSignal] = useState<TradeSignal | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const initialLayoutRef = useRef(readInitialLayout());
  const [sidebarWidth, setSidebarWidth] = useState(initialLayoutRef.current.sidebarWidth);
  const [chartRightWidth, setChartRightWidth] = useState(initialLayoutRef.current.chartRightWidth);
  const [chartSignalHeight, setChartSignalHeight] = useState(initialLayoutRef.current.chartSignalHeight);
  const [ordersFormWidth, setOrdersFormWidth] = useState(initialLayoutRef.current.ordersFormWidth);
  const [ordersBookWidth, setOrdersBookWidth] = useState(initialLayoutRef.current.ordersBookWidth);
  const [dragging, setDragging] = useState<DragTarget>(null);

  const appMainLayoutRef = useRef<HTMLDivElement>(null);
  const chartMainSplitRef = useRef<HTMLDivElement>(null);
  const chartRightPanelRef = useRef<HTMLDivElement>(null);
  const ordersMainSplitRef = useRef<HTMLDivElement>(null);
  const ordersChartSplitRef = useRef<HTMLDivElement>(null);

  const setIsApiConnected = useStore(s => s.setIsApiConnected);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(
      LAYOUT_STORAGE_KEY,
      JSON.stringify({ sidebarWidth, chartRightWidth, chartSignalHeight, ordersFormWidth, ordersBookWidth })
    );
  }, [sidebarWidth, chartRightWidth, chartSignalHeight, ordersFormWidth, ordersBookWidth]);

  useEffect(() => {
    if (!dragging) return;

    const onMouseMove = (event: MouseEvent) => {
      if (dragging === 'sidebar-width' && appMainLayoutRef.current) {
        const rect = appMainLayoutRef.current.getBoundingClientRect();
        const next = event.clientX - rect.left;
        const max = Math.max(320, rect.width - 560);
        setSidebarWidth(clamp(next, 250, max));
      }

      if (dragging === 'chart-right-width' && chartMainSplitRef.current) {
        const rect = chartMainSplitRef.current.getBoundingClientRect();
        const next = rect.right - event.clientX;
        const max = Math.max(300, rect.width - 420);
        setChartRightWidth(clamp(next, 280, max));
      }

      if (dragging === 'chart-right-height' && chartRightPanelRef.current) {
        const rect = chartRightPanelRef.current.getBoundingClientRect();
        const next = rect.bottom - event.clientY;
        const max = Math.max(280, rect.height - 180);
        setChartSignalHeight(clamp(next, 220, max));
      }

      if (dragging === 'orders-form-width' && ordersMainSplitRef.current) {
        const rect = ordersMainSplitRef.current.getBoundingClientRect();
        const next = event.clientX - rect.left;
        const max = Math.max(320, rect.width - 380);
        setOrdersFormWidth(clamp(next, 260, max));
      }

      if (dragging === 'orders-book-width' && ordersChartSplitRef.current) {
        const rect = ordersChartSplitRef.current.getBoundingClientRect();
        const next = rect.right - event.clientX;
        const max = Math.max(240, rect.width - 320);
        setOrdersBookWidth(clamp(next, 180, max));
      }
    };

    const onMouseUp = () => setDragging(null);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = dragging === 'chart-right-height' ? 'row-resize' : 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [dragging]);

  // Init contract metadata once on mount
  useEffect(() => {
    let cancelled = false;

    const loadContracts = async () => {
      try {
        const contracts = await fetchContractInfo();
        if (cancelled) return;
        if (contracts.length) {
          setContracts(contracts);
          setIsApiConnected(true);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Contract init error:', err);
          setIsApiConnected(false);
        }
      }
    };

    loadContracts();

    return () => {
      cancelled = true;
    };
  }, [setContracts, setIsApiConnected]);

  // Poll ticker snapshot
  useEffect(() => {
    let cancelled = false;

    const loadTickers = async () => {
      try {
        const tickers = await fetchAllTickers();
        if (cancelled) return;
        if (tickers.length) {
          setTickers(tickers);
          setIsApiConnected(true);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Ticker snapshot error:', err);
          setIsApiConnected(false);
        }
      }
    };

    loadTickers();
    const id = setInterval(loadTickers, 10000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [setTickers, setIsApiConnected]);

  // WebSocket for active ticker real-time updates
  useEffect(() => {
    let disposed = false;
    let unsubscribe: (() => void) | null = null;
    const activeSymbol = selectedSymbol;

    import('./services/mexcApi')
      .then(({ mexcWs }) => {
        if (disposed) return;

        mexcWs.connect();
        let lastUpdate = 0;

        unsubscribe = mexcWs.subscribeTicker(activeSymbol, (msg) => {
          if (disposed) return;

          const msgSymbol = msg.symbol || msg.data?.symbol || msg.data?.s;
          if (msgSymbol && msgSymbol !== activeSymbol) return;

          const now = Date.now();
          if (now - lastUpdate < 500) return;

          if (msg.data && (msg.data.lastPrice || msg.data.p)) {
            lastUpdate = now;
            const updates: any = {};
            updates.lastPrice = Number(msg.data.lastPrice || msg.data.p);
            if (msg.data.riseFallRate !== undefined) updates.riseFallRate = Number(msg.data.riseFallRate);
            if (msg.data.fairPrice !== undefined) updates.fairPrice = Number(msg.data.fairPrice);
            if (msg.data.indexPrice !== undefined) updates.indexPrice = Number(msg.data.indexPrice);

            useStore.getState().updateSingleTicker(activeSymbol, updates);
          }
        });
      })
      .catch((err) => {
        if (!disposed) {
          console.error('Ticker WS init error:', err);
        }
      });

    return () => {
      disposed = true;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [selectedSymbol]);

  const handlePlaceOrder = (signal: TradeSignal) => {
    setPrefillSignal(signal);
    setActiveTab('orders');
  };

  const navItems = [
    { id: 'chart',    icon: BarChart2,  label: 'Chart' },
    { id: 'signals',  icon: Brain,      label: 'AI Signals' },
    { id: 'orders',   icon: ShoppingBag, label: 'Lệnh' },
    { id: 'account',  icon: Wallet,     label: 'Tài khoản' },
    { id: 'news',     icon: Newspaper,  label: 'Tin tức' },
    { id: 'settings', icon: Settings,   label: 'Settings' },
  ] as const;

  const autoTradeBadge =
    autoTradeMode === 'live' ? { label: 'LIVE', style: 'bg-rose-950/40 border-rose-800/60 text-rose-400' } :
    autoTradeMode === 'simulation' ? { label: 'SIM', style: 'bg-amber-950/40 border-amber-800/60 text-amber-400' } :
    null;

  const hasAiKey = aiCredentials && Object.values(aiCredentials).some(v => typeof v === 'string' && v.length > 0);

  const sentimentIcon =
    marketSentiment === 'BULLISH'  ? <TrendingUp  className="w-3 h-3 text-emerald-400" /> :
    marketSentiment === 'FEARFUL'  ? <TrendingDown className="w-3 h-3 text-rose-400" /> :
    marketSentiment === 'BEARISH'  ? <TrendingDown className="w-3 h-3 text-amber-400" /> :
    <Minus className="w-3 h-3 text-slate-500" />;


  return (
    <div className="flex h-screen flex-col overflow-hidden bg-slate-950 text-slate-200 select-none">
      <Toaster position="top-right" toastOptions={{
        style: { background: '#0f172a', color: '#e2e8f0', border: '1px solid #334155', fontSize: '13px', borderRadius: '12px' },
      }} />

      {/* Modals */}
      <ApiKeyModal />
      <AutoTradePanel />

      {/* ── Header ── */}
      <header className="flex h-14 shrink-0 items-center gap-3 overflow-x-auto overflow-y-hidden whitespace-nowrap border-b border-slate-800 bg-slate-950/95 px-3 backdrop-blur-sm z-40">
        {/* Logo */}
        <div className="flex items-center gap-2 shrink-0 mr-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-sm shadow-amber-900/30">
            <span className="text-slate-950 font-black text-sm">M</span>
          </div>
          <div>
            <div className="text-sm font-extrabold text-slate-100 leading-none">MEXC <span className="text-amber-400">Pro</span></div>
            <div className="text-[11px] text-slate-500 leading-none mt-1">Futures Terminal v2</div>
          </div>
        </div>

        {/* Dang xem badge */}
        <div className="hidden md:flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-sm shrink-0">
          <span className="text-slate-400">Đang xem:</span>
          <span className="font-semibold text-slate-100">{selectedSymbol.replace('_', '/')}</span>
          {currentSignal && currentSignal.type !== 'NEUTRAL' && (
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
              currentSignal.type === 'LONG' ? 'border-emerald-800/60 bg-emerald-950/50 text-emerald-400' : 'border-rose-800/60 bg-rose-950/50 text-rose-400'
            }`}>{currentSignal.type}</span>
          )}
        </div>

        {/* Sentiment pill */}
        <div className="hidden lg:flex items-center gap-2 text-sm rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-1.5 shrink-0">
          <div className="scale-110">{sentimentIcon}</div>
          <span className="text-slate-300">{marketSentiment}</span>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-3 ml-6 shrink-0">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                activeTab === id
                  ? 'border-slate-700 bg-slate-800 text-slate-100'
                  : 'border-transparent text-slate-400 hover:border-slate-800 hover:bg-slate-900 hover:text-slate-200'
              }`}>
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </nav>

        {/* Right controls */}
        <div className="ml-auto flex items-center gap-2.5 shrink-0 pl-3">
          {/* API Status button */}
          <button onClick={() => setApiModalOpen(true)}
            className={`hidden md:flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-colors font-medium ${
              isApiConnected
                ? 'bg-emerald-950/30 border-emerald-800/60 text-emerald-400'
                : credentials
                ? 'bg-amber-950/30 border-amber-800/60 text-amber-400'
                : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}>
            <Key className="w-4 h-4" />
            {isApiConnected ? 'Connected' : credentials ? 'API Saved' : 'API Keys'}
            {hasAiKey && <span className="w-2 h-2 rounded-full bg-sky-400" />}
          </button>

          {/* Auto-trade button */}
          <button onClick={() => setAutoTradePanelOpen(true)}
            className={`hidden md:flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-colors font-medium ${
              autoTradeBadge
                ? autoTradeMode === 'live'
                  ? 'bg-rose-950/30 border-rose-800/60 text-rose-400'
                  : 'bg-amber-950/30 border-amber-800/60 text-amber-400'
                : 'border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}>
            <Bot className="w-4 h-4" />
            <span className={autoTradeMode !== 'off' ? undefined : 'hidden lg:inline'}>
              {autoTradeBadge ? `Auto • ${autoTradeBadge.label}` : 'Auto-Trade'}
            </span>
            {autoTradeMode !== 'off' && <span className="w-2 h-2 rounded-full bg-current animate-pulse" />}
          </button>

          {/* Connection */}
          <div className={`hidden lg:flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${
            credentials
              ? isApiConnected ? 'border-emerald-800/50 text-emerald-400 bg-emerald-950/20' : 'border-amber-800/50 text-amber-400 bg-amber-950/20'
              : 'border-slate-800 text-slate-500 bg-slate-900/60'
          }`}>
            {credentials ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {credentials ? (isApiConnected ? 'API Connected' : 'API Status') : 'No API Key'}
          </div>

          {/* Mobile menu */}
          <button className="md:hidden text-slate-400 hover:text-slate-200 p-1" onClick={() => setMobileMenuOpen(v => !v)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile nav */}
      {mobileMenuOpen && (
        <div className="md:hidden flex shrink-0 gap-1 overflow-x-auto border-b border-slate-800 bg-slate-900/70 px-2 py-1.5">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => { setActiveTab(id); setMobileMenuOpen(false); }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs whitespace-nowrap shrink-0 border transition-colors ${
                activeTab === id ? 'border-slate-700 bg-slate-800 text-slate-100' : 'border-transparent text-slate-400 hover:border-slate-700 hover:bg-slate-800'
              }`}>
              <Icon className="w-3 h-3" />{label}
            </button>
          ))}
          <button onClick={() => setApiModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs border border-slate-700 bg-slate-800 text-slate-200 shrink-0 hover:bg-slate-700">
            <Key className="w-3 h-3" /> API
          </button>
        </div>
      )}

      {/* ── Main content ── */}
      <div ref={appMainLayoutRef} className="flex flex-1 min-h-0 overflow-hidden bg-slate-950">

        {/* LEFT: Coin sidebar */}
        <div
          style={sidebarOpen ? { width: `${sidebarWidth}px`, minWidth: '250px' } : { width: 0 }}
          className={`shrink-0 border-r border-slate-800 bg-slate-900/60 transition-[width] duration-200 overflow-hidden ${sidebarOpen ? '' : 'w-0'}`}
        >
          <CoinList />
        </div>

        {sidebarOpen && (
          <div
            onMouseDown={() => setDragging('sidebar-width')}
            className="w-1.5 shrink-0 cursor-col-resize bg-slate-900 hover:bg-slate-700 transition-colors"
            title="Kéo để đổi kích thước Coin List"
          />
        )}

        {/* Toggle */}
        <button onClick={() => setSidebarOpen(!sidebarOpen)}
          className="shrink-0 w-3.5 border-r border-slate-800 bg-slate-900/80 hover:bg-slate-800 flex items-center justify-center transition-colors">
          {sidebarOpen ? <ChevronLeft className="w-3 h-3 text-slate-500" /> : <ChevronRight className="w-3 h-3 text-slate-500" />}
        </button>

        {/* CENTER + RIGHT */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-slate-950">

          {/* ── CHART tab ── */}
          {activeTab === 'chart' && (
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden p-2 gap-2">
              <div className="shrink-0 overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60">
                <TickerBar />
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
                <div className="flex-1 min-h-0 overflow-hidden">
                  <div ref={chartMainSplitRef} className="flex h-full min-h-0 overflow-hidden">
                    {/* Chart area */}
                    <div className="flex-1 overflow-hidden min-w-0">
                      <TradingChart onCandlesReady={setCandles} />
                    </div>

                    {/* Resize handle: chart vs right panel */}
                    <div
                      onMouseDown={() => setDragging('chart-right-width')}
                      className="w-1.5 shrink-0 cursor-col-resize bg-slate-900 hover:bg-slate-700 transition-colors"
                      title="Kéo để đổi kích thước panel"
                    />

                    {/* RIGHT panel: OrderBook top + Order Form bottom */}
                    <div
                      ref={chartRightPanelRef}
                      style={{ width: `${chartRightWidth}px` }}
                      className="shrink-0 border-l border-slate-800 flex flex-col min-w-0 bg-slate-900/70"
                    >
                      {/* Order Book — top */}
                      <div className="flex-1 min-h-[180px] overflow-hidden border-b border-slate-800">
                        <OrderBook />
                      </div>

                      {/* Resize handle: orderbook vs order form */}
                      <div
                        onMouseDown={() => setDragging('chart-right-height')}
                        className="h-1.5 shrink-0 cursor-row-resize bg-slate-900 hover:bg-slate-700 transition-colors"
                        title="Kéo để đổi chiều cao Order Form"
                      />

                      {/* Order Form — bottom */}
                      <div style={{ height: `${chartSignalHeight}px` }} className="shrink-0 overflow-hidden border-t border-slate-800">
                        <div className="h-full overflow-y-auto">
                          <OrderPanel prefillSignal={prefillSignal} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-[30%] min-h-[220px] overflow-y-auto border-t border-slate-800 bg-slate-900/55">
                  <PendingOrdersPanel />
                </div>
              </div>
            </div>
          )}

          {/* ── SIGNALS tab ── */}
          {activeTab === 'signals' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2 shrink-0 bg-slate-900/70">
                <Brain className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-sm text-slate-100">AI Signal Engine</span>
              </div>
              <div className="flex-1 overflow-hidden flex">
                <div className="w-full max-w-xl overflow-y-auto">
                  <SignalPanel candles={candles} onPlaceOrder={handlePlaceOrder} />
                </div>
                <div className="flex-1 border-l border-slate-800 min-w-0">
                  <TradingChart onCandlesReady={setCandles} />
                </div>
              </div>
            </div>
          )}

          {/* ── ORDERS tab ── */}
          {activeTab === 'orders' && (
            <div className="flex-1 flex flex-col overflow-hidden p-3">
              <div className="mb-3 px-4 py-2 rounded-lg border border-slate-800 flex items-center gap-2 shrink-0 bg-slate-900/70">
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-sm text-slate-100">Lệnh đang hoạt động</span>
              </div>

              <div className="flex-1 min-h-0 overflow-hidden rounded-xl border border-slate-800 bg-slate-900/45">
                <PendingOrdersPanel />
              </div>
            </div>
          )}

          {/* ── ACCOUNT tab ── */}
          {activeTab === 'account' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2 shrink-0 bg-slate-900/70">
                <Wallet className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-sm text-slate-100">Tài khoản</span>
              </div>
              <div className="flex-1 overflow-y-auto max-w-3xl mx-auto w-full p-3">
                <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
                  <AccountPanel />
                </div>
              </div>
            </div>
          )}

          {/* ── NEWS tab ── */}
          {activeTab === 'news' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 border-b border-slate-800 flex items-center gap-2 shrink-0 bg-slate-900/70">
                <Newspaper className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-sm text-slate-100">Tin tức & Sentiment</span>
              </div>
              <div className="flex-1 overflow-hidden max-w-3xl mx-auto w-full p-3">
                <div className="h-full rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
                  <NewsFeed />
                </div>
              </div>
            </div>
          )}

          {/* ── SETTINGS tab ── */}
          {activeTab === 'settings' && (
            <div className="flex-1 overflow-y-auto p-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden">
                <SettingsPanel />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
