import { useEffect, useState, useRef } from 'react';
import { Toaster } from 'react-hot-toast';
import { useStore } from './store/useStore';
import { fetchAllTickers, fetchContractInfo, connectionManager, setRuntimeMexcNetwork } from './services/mexcApi';
import type { ConnectionMode } from './services/connectionManager';
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
import { ErrorBoundary } from './components/ErrorBoundary';
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
  const mexcNetwork = useStore(s => s.mexcNetwork);
  const selectedSymbol = useStore(s => s.selectedSymbol);
  const setApiModalOpen = useStore(s => s.setApiModalOpen);
  const setAutoTradePanelOpen = useStore(s => s.setAutoTradePanelOpen);
  const autoTradeMode = useStore(s => s.autoTradeMode);
  const currentSignal = useStore(s => s.signals[s.selectedSymbol]);
  const marketSentiment = useStore(s => s.marketSentiment);
  const autoTradeRunning = useStore(s => s.autoTradeRunning);

  // Tracks whether public market data endpoints are reachable (no API key needed)
  const [isMarketDataLive, setIsMarketDataLive] = useState(false);
  // Tracks connection mode: DIRECT = normal, RELAY = routed through proxy
  const [connMode, setConnMode] = useState<ConnectionMode>('DIRECT');
  const autoTradeDaemonRef = useRef<{ start: () => void; stop: () => void } | null>(null);

  // Resume/stop Auto Trade Daemon based on persisted runtime state
  useEffect(() => {
    let disposed = false;

    import('./services/autoTradeDaemon')
      .then(({ autoTradeDaemon }) => {
        if (disposed) return;

        autoTradeDaemonRef.current = autoTradeDaemon;

        if (autoTradeMode !== 'off' && autoTradeRunning) {
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

  // Ensure bot and local orders are stopped when app window is closed
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const shutdownAutoTradeSafely = () => {
      autoTradeDaemonRef.current?.stop();

      useStore.setState((state) => ({
        autoTradeRunning: false,
        autoTradeMode: 'off',
        pendingOrders: state.pendingOrders.map((order) =>
          order.status === 'PENDING' ? { ...order, status: 'CANCELLED' } : order,
        ),
        autoTradeLogs: state.autoTradeLogs.map((log) =>
          log.status === 'OPENED' ? { ...log, status: 'CLOSED' } : log,
        ),
      }));
    };

    window.addEventListener('beforeunload', shutdownAutoTradeSafely);
    return () => {
      window.removeEventListener('beforeunload', shutdownAutoTradeSafely);
    };
  }, []);

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


  // Derive the real API key connection status:
  // isApiConnected should ONLY be true when a private API key has been validated.
  // It must NOT be set by public endpoints like fetchContractInfo / fetchAllTickers.
  const hasApiKey = !!(credentials?.apiKey && credentials?.secretKey);

  // Keep runtime MEXC network in sync with persisted store (important on app startup).
  useEffect(() => {
    setRuntimeMexcNetwork(mexcNetwork);
  }, [mexcNetwork]);

  // Subscribe to ConnectionManager mode changes (DIRECT <-> RELAY)
  useEffect(() => {
    const unsubscribe = connectionManager.onModeChange((mode, reason) => {
      setConnMode(mode);
      console.log(`[App] Connection mode: ${mode} (${reason})`);
    });
    // Sync initial state
    setConnMode(connectionManager.getMode());
    return unsubscribe;
  }, []);

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
  // NOTE: fetchContractInfo is a PUBLIC endpoint — does NOT require API keys.
  // We must NOT set isApiConnected here; only track market data availability.
  useEffect(() => {
    let cancelled = false;

    const loadContracts = async () => {
      try {
        const contracts = await fetchContractInfo();
        if (cancelled) return;
        if (contracts.length) {
          setContracts(contracts);
          setIsMarketDataLive(true);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Contract init error:', err);
        }
      }
    };

    loadContracts();

    return () => {
      cancelled = true;
    };
  }, [setContracts]);

  // Poll ticker snapshot
  // NOTE: fetchAllTickers is a PUBLIC endpoint — does NOT require API keys.
  // We must NOT set isApiConnected here; only track market data availability.
  useEffect(() => {
    let cancelled = false;
    let isFetching = false;

    const loadTickers = async () => {
      // Skip if previous request is still in-flight (prevents pile-up in relay mode)
      if (isFetching) {
        console.warn('[App] Skipping ticker poll — previous request still pending');
        return;
      }

      isFetching = true;
      try {
        const tickers = await fetchAllTickers();
        if (cancelled) return;
        if (tickers.length) {
          setTickers(tickers);
          setIsMarketDataLive(true);
        }
      } catch (err) {
        if (!cancelled) {
          // Use warn instead of error to avoid red console spam during relay failures
          console.warn('[App] Ticker snapshot error:', err);
          setIsMarketDataLive(false);
        }
      } finally {
        isFetching = false;
      }
    };

    loadTickers();
    const id = setInterval(loadTickers, 10000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [setTickers]);

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
            const updates: Partial<import('./types').ContractTicker> = {
              lastPrice: Number(msg.data.lastPrice || msg.data.p),
            };
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
    marketSentiment === 'BULLISH'  ? <TrendingUp  className="w-3.5 h-3.5 text-[var(--color-success)]" /> :
    marketSentiment === 'FEARFUL'  ? <TrendingDown className="w-3.5 h-3.5 text-[var(--color-danger)]" /> :
    marketSentiment === 'BEARISH'  ? <TrendingDown className="w-3.5 h-3.5 text-[var(--color-warning)]" /> :
    <Minus className="w-3.5 h-3.5 text-[var(--text-dim)]" />;


  return (
    <ErrorBoundary>
      <div className="coinbase-shell flex h-screen flex-col overflow-hidden text-[var(--text-main)] select-none">
        <Toaster position="top-right" toastOptions={{
        style: {
          background: 'var(--bg-card)',
          color: 'var(--text-main)',
          border: '1px solid var(--border)',
          fontSize: '13px',
          borderRadius: '16px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          fontFamily: 'Sora, sans-serif',
        },
      }} />

      {/* Modals */}
      <ApiKeyModal />
      <AutoTradePanel />

      {/* ── Header ── */}
      <header className="z-40 flex h-[72px] shrink-0 items-center gap-4 overflow-x-auto overflow-y-hidden whitespace-nowrap border-b border-[var(--border)] bg-[var(--bg-surface-glass)] px-5 backdrop-blur-2xl">
        {/* Logo */}
        <div className="mr-4 flex shrink-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0052ff] to-[#22d3ee] shadow-[0_8px_24px_rgba(0,82,255,0.3)] animate-breathe">
            <span className="text-sm font-extrabold text-white tracking-tight">M</span>
          </div>
          <div>
            <div className="text-[15px] font-bold leading-none tracking-tight">
              <span className="text-[var(--text-main)]">MEXC</span>{' '}
              <span className="text-gradient-brand font-extrabold">PRO</span>
            </div>
            <div className="mt-1 text-[10px] font-semibold uppercase leading-none tracking-[0.16em] text-[var(--text-muted)]">Futures Terminal v2</div>
          </div>
        </div>

        {/* Viewing badge */}
        <div className="hidden md:flex items-center gap-2.5 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface-soft)] px-4 py-2.5 text-sm shrink-0">
          <span className="text-[var(--text-muted)] text-xs">Viewing</span>
          <span className="font-bold text-[var(--text-main)] tracking-tight">{selectedSymbol.replace('_', '/')}</span>
          {currentSignal && currentSignal.type !== 'NEUTRAL' && (
            <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${
              currentSignal.type === 'LONG' ? 'border-[rgba(0,230,138,0.4)] bg-[var(--color-success-dim)] text-[var(--color-success)]' : 'border-[rgba(255,77,106,0.4)] bg-[var(--color-danger-dim)] text-[var(--color-danger)]'
            }`}>{currentSignal.type}</span>
          )}
        </div>

        {/* Sentiment pill */}
        <div className="hidden lg:flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--bg-surface-soft)] px-4 py-2.5 text-sm shrink-0">
          <div className="scale-110">{sentimentIcon}</div>
          <span className="font-semibold text-[var(--text-secondary)]">{marketSentiment}</span>
        </div>

        {/* Desktop Nav */}
        <nav className="ml-8 hidden shrink-0 items-center gap-1.5 md:flex">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-semibold tracking-[0.01em] rounded-xl transition-all ${
                activeTab === id
                  ? 'bg-[var(--color-brand-dim)] text-[var(--text-main)] shadow-[0_0_20px_rgba(0,82,255,0.1)]'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface-soft)] hover:text-[var(--text-secondary)]'
              }`}>
              <Icon className="w-4.5 h-4.5" />
              {label}
              {activeTab === id && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-[var(--color-brand)]" />
              )}
            </button>
          ))}
        </nav>

        {/* Right controls */}
        <div className="ml-auto flex shrink-0 items-center gap-2.5 pl-3">
          {/* Network Status — Market data + connection mode */}
          <div className={`hidden xl:flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${ 
            connMode === 'RELAY'
              ? 'border-[rgba(255,184,46,0.35)] text-[var(--color-warning)] bg-[var(--color-warning-dim)]'
              : isMarketDataLive
              ? 'border-[rgba(0,230,138,0.25)] text-[var(--color-success)] bg-[var(--color-success-dim)]'
              : 'border-[rgba(255,77,106,0.25)] text-[var(--color-danger)] bg-[var(--color-danger-dim)]'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              connMode === 'RELAY'
                ? 'bg-[var(--color-warning)] animate-pulse'
                : isMarketDataLive ? 'bg-[var(--color-success)] animate-pulse' : 'bg-[var(--color-danger)]'
            }`} />
            {connMode === 'RELAY' ? 'Relay Mode' : isMarketDataLive ? 'Market Live' : 'Market Offline'}
          </div>

          {/* Force Direct button — only visible when stuck in RELAY mode */}
          {connMode === 'RELAY' && (
            <button
              onClick={() => {
                connectionManager.forceMode('DIRECT', 'user forced via UI');
                setConnMode('DIRECT');
              }}
              className="hidden xl:flex items-center gap-1.5 rounded-full border border-[rgba(0,82,255,0.4)] bg-[var(--color-brand-dim)] px-3 py-2 text-xs font-bold text-[var(--color-brand)] transition-all hover:bg-[var(--color-brand)] hover:text-white"
              title="Chuyển sang kết nối trực tiếp (không qua proxy)"
            >
              <Wifi className="w-3 h-3" />
              Force Direct
            </button>
          )}

          {/* API Key Status button */}
          <button onClick={() => setApiModalOpen(true)}
            className={`coinbase-pill-btn hidden md:flex items-center gap-2 text-sm px-4 py-2.5 font-semibold ${
              hasApiKey && isApiConnected
                ? 'bg-[var(--color-success-dim)] border-[rgba(0,230,138,0.35)] text-[var(--color-success)]'
                : hasApiKey
                ? 'bg-[var(--color-warning-dim)] border-[rgba(255,184,46,0.35)] text-[var(--color-warning)]'
                : 'bg-[var(--bg-surface-soft)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--color-brand-hover)] hover:text-[var(--text-secondary)]'
            }`}>
            <Key className="w-4 h-4" />
            {hasApiKey && isApiConnected ? 'API Verified' : hasApiKey ? 'API Saved' : 'API Keys'}
            {hasAiKey && <span className="w-2 h-2 rounded-full bg-[var(--color-cyan)] animate-glow" />}
          </button>

          {/* Auto-trade button */}
          <button onClick={() => setAutoTradePanelOpen(true)}
            className={`coinbase-pill-btn hidden md:flex items-center gap-2 text-sm px-4 py-2.5 font-semibold ${
              autoTradeBadge
                ? autoTradeMode === 'live'
                  ? 'bg-[var(--color-danger-dim)] border-[rgba(255,77,106,0.35)] text-[var(--color-danger)]'
                  : 'bg-[var(--color-warning-dim)] border-[rgba(255,184,46,0.35)] text-[var(--color-warning)]'
                : 'bg-[var(--bg-surface-soft)] border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--color-brand-hover)] hover:text-[var(--text-secondary)]'
            }`}>
            <Bot className="w-4 h-4" />
            <span className={autoTradeMode !== 'off' ? undefined : 'hidden lg:inline'}>
              {autoTradeBadge ? `Auto • ${autoTradeBadge.label}` : 'Auto-Trade'}
            </span>
            {autoTradeMode !== 'off' && <span className="w-2 h-2 rounded-full bg-current animate-pulse" />}
          </button>

          {/* Connection status — shows API key status clearly */}
          <div className={`hidden lg:flex items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium ${
            hasApiKey
              ? isApiConnected
                ? 'border-[rgba(0,230,138,0.3)] text-[var(--color-success)] bg-[var(--color-success-dim)]'
                : 'border-[rgba(255,184,46,0.3)] text-[var(--color-warning)] bg-[var(--color-warning-dim)]'
              : 'border-[var(--border)] text-[var(--text-muted)] bg-[var(--bg-surface-soft)]'
          }`}>
            {hasApiKey ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {hasApiKey ? (isApiConnected ? 'API Connected' : 'API Not Verified') : 'No API Key'}
          </div>

          {/* Mobile menu */}
          <button className="p-2 text-[var(--text-muted)] transition-colors hover:text-[var(--text-main)] md:hidden rounded-xl hover:bg-[var(--bg-surface-soft)]" onClick={() => setMobileMenuOpen(v => !v)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile nav */}
      {mobileMenuOpen && (
        <div className="md:hidden flex shrink-0 gap-1.5 overflow-x-auto border-b border-[var(--border)] bg-[var(--bg-surface-glass)] px-3 py-2.5 backdrop-blur-2xl">
          {navItems.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => { setActiveTab(id); setMobileMenuOpen(false); }}
              className={`flex shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs whitespace-nowrap transition-all ${
                activeTab === id ? 'border-[rgba(0,82,255,0.4)] bg-[var(--color-brand-dim)] text-[var(--text-main)]' : 'border-[var(--border-soft)] text-[var(--text-muted)] hover:border-[var(--color-brand-hover)] hover:bg-[var(--bg-surface-soft)]'
              }`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
          <button onClick={() => setApiModalOpen(true)}
            className="flex shrink-0 items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-soft)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:border-[var(--color-brand-hover)]">
            <Key className="w-3 h-3" /> API
          </button>
        </div>
      )}

      {/* ── Main content ── */}
      <div ref={appMainLayoutRef} className="flex flex-1 min-h-0 overflow-hidden bg-transparent">

        {/* LEFT: Coin sidebar */}
        <div
          style={sidebarOpen ? { width: `${sidebarWidth}px`, minWidth: '250px' } : { width: 0 }}
          className={`shrink-0 border-r border-[var(--border-soft)] transition-[width] duration-200 overflow-hidden ${sidebarOpen ? '' : 'w-0'}`}
        >
          <CoinList />
        </div>

        {sidebarOpen && (
          <div
            onMouseDown={() => setDragging('sidebar-width')}
            className="w-1 shrink-0 cursor-col-resize bg-[var(--bg-main)] transition-colors hover:bg-[var(--color-brand)] hover:shadow-[0_0_8px_var(--accent-glow)]"
            title="Kéo để đổi kích thước Coin List"
          />
        )}

        {/* Toggle */}
        <button onClick={() => setSidebarOpen(!sidebarOpen)}
          className="flex w-4 shrink-0 items-center justify-center border-r border-[var(--border-soft)] bg-[var(--bg-panel)] transition-colors hover:bg-[var(--color-brand-dim)]">
          {sidebarOpen ? <ChevronLeft className="w-3 h-3 text-[var(--text-dim)]" /> : <ChevronRight className="w-3 h-3 text-[var(--text-dim)]" />}
        </button>

        {/* CENTER + RIGHT */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-transparent">

          {/* ── CHART tab ── */}
          {activeTab === 'chart' && (
            <div className="flex flex-1 min-h-0 flex-col overflow-hidden gap-2 p-2.5">
              <div className="shrink-0 overflow-hidden rounded-2xl glass-card">
                <TickerBar />
              </div>

              <div className="glass-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
                <div className="flex-1 min-h-0 overflow-hidden">
                  <div ref={chartMainSplitRef} className="flex h-full min-h-0 overflow-hidden">
                    {/* Chart area */}
                    <div className="flex-1 overflow-hidden min-w-0">
                      <TradingChart onCandlesReady={setCandles} />
                    </div>

                    {/* Resize handle: chart vs right panel */}
                    <div
                      onMouseDown={() => setDragging('chart-right-width')}
                      className="w-1 shrink-0 cursor-col-resize bg-[var(--bg-main)] transition-colors hover:bg-[var(--color-brand)] hover:shadow-[0_0_8px_var(--accent-glow)]"
                      title="Kéo để đổi kích thước panel"
                    />

                    {/* RIGHT panel: OrderBook top + Order Form bottom */}
                    <div
                      ref={chartRightPanelRef}
                      style={{ width: `${chartRightWidth}px` }}
                      className="shrink-0 border-l border-[var(--border-soft)] flex flex-col min-w-0 bg-[var(--bg-panel)]"
                    >
                      {/* Order Book — top */}
                      <div className="flex-1 min-h-[180px] overflow-hidden border-b border-[var(--border-soft)]">
                        <OrderBook />
                      </div>

                      {/* Resize handle: orderbook vs order form */}
                      <div
                        onMouseDown={() => setDragging('chart-right-height')}
                        className="h-1 shrink-0 cursor-row-resize bg-[var(--bg-main)] transition-colors hover:bg-[var(--color-brand)] hover:shadow-[0_0_8px_var(--accent-glow)]"
                        title="Kéo để đổi chiều cao Order Form"
                      />

                      {/* Order Form — bottom */}
                      <div style={{ height: `${chartSignalHeight}px` }} className="shrink-0 overflow-hidden border-t border-[var(--border-soft)]">
                        <div className="h-full overflow-y-auto">
                          <OrderPanel prefillSignal={prefillSignal} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-[30%] min-h-[220px] overflow-y-auto border-t border-[var(--border-soft)] bg-[var(--bg-panel)]">
                  <PendingOrdersPanel />
                </div>
              </div>
            </div>
          )}

          {/* ── SIGNALS tab ── */}
          {activeTab === 'signals' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="glass-card px-5 py-3 flex items-center gap-3 shrink-0 border-b border-[var(--border)]">
                <Brain className="w-5 h-5 text-[var(--color-brand)]" />
                <span className="text-sm font-bold tracking-tight">AI Signal Engine</span>
              </div>
              <div className="flex-1 overflow-hidden flex">
                <div className="w-full max-w-xl overflow-y-auto">
                  <SignalPanel candles={candles} onPlaceOrder={handlePlaceOrder} />
                </div>
                <div className="flex-1 border-l border-[var(--border-soft)] min-w-0">
                  <TradingChart onCandlesReady={setCandles} />
                </div>
              </div>
            </div>
          )}

          {/* ── ORDERS tab ── */}
          {activeTab === 'orders' && (
            <div className="flex-1 flex flex-col overflow-hidden p-3">
              <div className="glass-card mb-3 px-5 py-3 rounded-2xl flex items-center gap-3 shrink-0">
                <ShoppingBag className="w-5 h-5 text-[var(--color-brand)]" />
                <span className="text-sm font-bold tracking-tight">Lệnh đang hoạt động</span>
              </div>

              <div className="glass-panel flex-1 min-h-0 overflow-hidden rounded-2xl">
                <PendingOrdersPanel />
              </div>
            </div>
          )}

          {/* ── ACCOUNT tab ── */}
          {activeTab === 'account' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="glass-card px-5 py-3 flex items-center gap-3 shrink-0 border-b border-[var(--border)]">
                <Wallet className="w-5 h-5 text-[var(--color-brand)]" />
                <span className="text-sm font-bold tracking-tight">Tài khoản</span>
              </div>
              <div className="flex-1 overflow-y-auto max-w-3xl mx-auto w-full p-3">
                <div className="glass-panel rounded-2xl overflow-hidden">
                  <AccountPanel />
                </div>
              </div>
            </div>
          )}

          {/* ── NEWS tab ── */}
          {activeTab === 'news' && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="glass-card px-5 py-3 flex items-center gap-3 shrink-0 border-b border-[var(--border)]">
                <Newspaper className="w-5 h-5 text-[var(--color-brand)]" />
                <span className="text-sm font-bold tracking-tight">Tin tức & Sentiment</span>
              </div>
              <div className="flex-1 overflow-hidden max-w-3xl mx-auto w-full p-3">
                <div className="glass-panel h-full rounded-2xl overflow-hidden">
                  <NewsFeed />
                </div>
              </div>
            </div>
          )}

          {/* ── SETTINGS tab ── */}
          {activeTab === 'settings' && (
            <div className="flex-1 overflow-y-auto p-3">
              <div className="glass-panel rounded-2xl overflow-hidden">
                <SettingsPanel />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
    </ErrorBoundary>
  );
}
