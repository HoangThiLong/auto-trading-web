import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  ColorType,
  CrosshairMode,
} from 'lightweight-charts';
import { fetchKlines } from '../services/mexcApi';
import { calcEMA, calcBollingerBands } from '../services/analysis';
import type { AutoTradeLog, CandlePoint, PendingOrder, TimeInterval } from '../types';
import {
  useAutoTradeLogs,
  useCurrentSignal,
  usePendingOrders,
  useSelectedInterval,
  useSelectedSymbol,
  useSetSelectedInterval,
} from '../store/hooks';
import { useStore } from '../store/useStore';
import { RefreshCw, Activity, X } from 'lucide-react';

const INTERVALS: { label: string; value: TimeInterval }[] = [
  { label: '1m', value: 'Min1' },
  { label: '5m', value: 'Min5' },
  { label: '15m', value: 'Min15' },
  { label: '30m', value: 'Min30' },
  { label: '1H', value: 'Min60' },
  { label: '4H', value: 'Hour4' },
  { label: '8H', value: 'Hour8' },
  { label: '1D', value: 'Day1' },
  { label: '1W', value: 'Week1' },
];

type VisualOrderSource = 'AUTO_LIVE' | 'AUTO_SIM' | 'MANUAL' | 'SIM_DRAFT';

interface VisualOrder {
  key: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry: number;
  tp?: number;
  sl?: number;
  quantity: number;
  leverage: number;
  source: VisualOrderSource;
  createdAt: number;
  cancelable?: boolean;
}

interface Props {
  onCandlesReady?: (candles: CandlePoint[]) => void;
}

const calcMarginEstimate = (
  entry: number,
  quantity: number,
  leverage: number,
  contractSize: number,
) => {
  if (!Number.isFinite(entry) || !Number.isFinite(quantity) || !Number.isFinite(leverage) || leverage <= 0) return 0;
  if (!Number.isFinite(contractSize) || contractSize <= 0) return 0;
  return (entry * quantity * contractSize) / leverage;
};

const sourceLabelMap: Record<VisualOrderSource, string> = {
  AUTO_LIVE: 'LIVE BOT',
  AUTO_SIM: 'SIM BOT',
  MANUAL: 'MANUAL',
  SIM_DRAFT: 'SIM DRAFT',
};

interface ChartCancelButton {
  orderKey: string;
  top: number;
  side: 'LONG' | 'SHORT';
}

export default function TradingChart({ onCandlesReady }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstanceRef = useRef<any>(null);
  const candleSeriesRef = useRef<any>(null);
  const volumeSeriesRef = useRef<any>(null);
  const ema20Ref = useRef<any>(null);
  const ema50Ref = useRef<any>(null);
  const ema200Ref = useRef<any>(null);
  const bbUpperRef = useRef<any>(null);
  const bbLowerRef = useRef<any>(null);
  const bbMiddleRef = useRef<any>(null);
  const priceLinesRef = useRef<any[]>([]);

  const selectedSymbol = useSelectedSymbol();
  const selectedInterval = useSelectedInterval();
  const setSelectedInterval = useSetSelectedInterval();
  const signal = useCurrentSignal();
  const autoTradeLogs = useAutoTradeLogs();
  const pendingOrders = usePendingOrders();
  const contracts = useStore((state) => state.contracts);
  const removeOrder = useStore((state) => state.removeOrder);
  const [loading, setLoading] = useState(false);
  const [showEMA, setShowEMA] = useState(true);
  const [showBB, setShowBB] = useState(true);
  const [currentCandle, setCurrentCandle] = useState<CandlePoint | null>(null);
  const [chartReady, setChartReady] = useState(false);
  const [chartCancelButtons, setChartCancelButtons] = useState<ChartCancelButton[]>([]);

  const debouncedUpdatesRef = useRef<{candle: any, volume: any} | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const updateTimeoutRef = useRef<number | null>(null);

  const getContractSizeBySymbol = useCallback((symbol: string) => {
    const contractSize = contracts.find((contract) => contract.symbol === symbol)?.contractSize;
    return Number.isFinite(contractSize) && (contractSize as number) > 0 ? (contractSize as number) : 1;
  }, [contracts]);

  const activeVisualOrders = useMemo(() => {
    const merged: VisualOrder[] = [];
    const seen = new Set<string>();

    const pushOrder = (order: VisualOrder) => {
      if (!Number.isFinite(order.entry) || order.entry <= 0) return;
      if (seen.has(order.key)) return;
      seen.add(order.key);
      merged.push(order);
    };

    autoTradeLogs
      .filter((l: AutoTradeLog) => l.status === 'OPENED')
      .forEach((log: AutoTradeLog) => {
        pushOrder({
          key: log.id,
          symbol: log.symbol,
          side: log.side,
          entry: log.entry,
          tp: log.tp,
          sl: log.sl,
          quantity: log.quantity,
          leverage: log.leverage,
          source: log.mode === 'live' ? 'AUTO_LIVE' : 'AUTO_SIM',
          createdAt: log.timestamp,
          cancelable: false,
        });
      });

    pendingOrders
      .filter((o: PendingOrder) => o.status === 'PENDING')
      .forEach((order: PendingOrder) => {
        pushOrder({
          key: order.id,
          symbol: order.symbol,
          side: order.side,
          entry: order.price,
          tp: order.takeProfit,
          sl: order.stopLoss,
          quantity: order.quantity,
          leverage: order.leverage,
          source: order.isSimulation ? 'SIM_DRAFT' : 'MANUAL',
          createdAt: order.createdAt,
          cancelable: Boolean(order.isSimulation),
        });
      });

    return merged.sort((a, b) => b.createdAt - a.createdAt);
  }, [autoTradeLogs, pendingOrders]);

  const chartVisualOrders = useMemo(
    () => activeVisualOrders.filter((order) => order.symbol === selectedSymbol),
    [activeVisualOrders, selectedSymbol]
  );

  const cancelableChartOrders = useMemo(
    () => chartVisualOrders.filter((order) => order.cancelable),
    [chartVisualOrders]
  );

  const updateCancelButtonCoordinates = useCallback(() => {
    if (!candleSeriesRef.current || !chartRef.current || cancelableChartOrders.length === 0) {
      setChartCancelButtons((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    const chartHeight = chartRef.current.clientHeight;
    const nextButtons = cancelableChartOrders
      .map((order) => {
        const y = candleSeriesRef.current.priceToCoordinate(order.entry);
        if (typeof y !== 'number' || !Number.isFinite(y) || y < -12 || y > chartHeight + 12) {
          return null;
        }
        const top = Math.max(8, Math.min(chartHeight - 8, y));
        return { orderKey: order.key, top, side: order.side };
      })
      .filter((item): item is ChartCancelButton => Boolean(item));

    setChartCancelButtons((prev) => {
      if (
        prev.length === nextButtons.length
        && prev.every((item, index) => {
          const next = nextButtons[index];
          return item.orderKey === next.orderKey
            && item.side === next.side
            && Math.abs(item.top - next.top) < 0.5;
        })
      ) {
        return prev;
      }
      return nextButtons;
    });
  }, [cancelableChartOrders]);

  useEffect(() => {
    if (!chartReady || !chartInstanceRef.current || !candleSeriesRef.current || cancelableChartOrders.length === 0) {
      setChartCancelButtons((prev) => (prev.length === 0 ? prev : []));
      return;
    }

    let animationFrameId = 0;
    const syncLoop = () => {
      updateCancelButtonCoordinates();
      animationFrameId = window.requestAnimationFrame(syncLoop);
    };

    updateCancelButtonCoordinates();
    animationFrameId = window.requestAnimationFrame(syncLoop);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
    };
  }, [chartReady, cancelableChartOrders, updateCancelButtonCoordinates]);

  const loadData = useCallback(async () => {
    if (!selectedSymbol) return;
    setLoading(true);
    try {
      const klines = await fetchKlines(selectedSymbol, selectedInterval, 300);
      if (!klines || !klines.time?.length) return;

      const candles: CandlePoint[] = klines.time.map((t, i) => ({
        time: t,
        open: klines.open[i],
        high: klines.high[i],
        low: klines.low[i],
        close: klines.close[i],
        volume: klines.vol[i],
      }));

      onCandlesReady?.(candles);
      setCurrentCandle(candles[candles.length - 1]);

      const sorted = [...candles].sort((a, b) => a.time - b.time);
      const uniqueTime = new Set<number>();
      const deduped = sorted.filter(c => {
        if (uniqueTime.has(c.time)) return false;
        uniqueTime.add(c.time);
        return true;
      });

      if (candleSeriesRef.current) {
        candleSeriesRef.current.setData(deduped.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })));
      }
      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.setData(deduped.map(c => ({ time: c.time, value: c.volume, color: c.close >= c.open ? '#0ecb8133' : '#f6465d33' })));
      }

      const closes = deduped.map(c => c.close);
      const times = deduped.map(c => c.time);

      // EMA lines
      if (showEMA && ema20Ref.current && ema50Ref.current && ema200Ref.current) {
        const ema20 = calcEMA(closes, 20);
        const ema50 = calcEMA(closes, 50);
        const ema200 = calcEMA(closes, 200);
        ema20Ref.current.setData(times.map((t, i) => ({ time: t, value: ema20[i] })));
        ema50Ref.current.setData(times.map((t, i) => ({ time: t, value: ema50[i] })));
        ema200Ref.current.setData(times.map((t, i) => ({ time: t, value: ema200[i] })));
      }

      // Bollinger Bands
      if (showBB && bbUpperRef.current && bbMiddleRef.current && bbLowerRef.current) {
        const bbData = closes.map((_, i) => {
          if (i < 20) return null;
          return calcBollingerBands(closes.slice(0, i + 1));
        });
        const bbUpper = bbData.map((b, i) => b ? { time: times[i], value: b.upper } : null).filter(Boolean);
        const bbMiddle = bbData.map((b, i) => b ? { time: times[i], value: b.middle } : null).filter(Boolean);
        const bbLower = bbData.map((b, i) => b ? { time: times[i], value: b.lower } : null).filter(Boolean);
        bbUpperRef.current.setData(bbUpper);
        bbMiddleRef.current.setData(bbMiddle);
        bbLowerRef.current.setData(bbLower);
      }

    } catch (err) {
      console.error('Chart load error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedSymbol, selectedInterval, showEMA, showBB, onCandlesReady]);

  // Initialize chart
  useEffect(() => {
    if (!chartRef.current) return;

    const chart = createChart(chartRef.current, {
      layout: { background: { type: ColorType.Solid, color: '#0b0e14' }, textColor: '#9ca3af' },
      grid: { vertLines: { color: '#1e2535' }, horzLines: { color: '#1e2535' } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: '#1e2535' },
      timeScale: { borderColor: '#1e2535', timeVisible: true, secondsVisible: false },
      width: chartRef.current.clientWidth,
      height: chartRef.current.clientHeight,
    });

    chartInstanceRef.current = chart;
    setChartReady(true);

    // Volume (bottom)
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'volume',
    });
    chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
    volumeSeriesRef.current = volumeSeries;

    // Candlestick
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#0ecb81', downColor: '#f6465d',
      borderUpColor: '#0ecb81', borderDownColor: '#f6465d',
      wickUpColor: '#0ecb81', wickDownColor: '#f6465d',
    });
    candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.1, bottom: 0.2 } });
    candleSeriesRef.current = candleSeries;

    // EMA lines
    ema20Ref.current = chart.addSeries(LineSeries, { color: '#f0b90b', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    ema50Ref.current = chart.addSeries(LineSeries, { color: '#2196F3', lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    ema200Ref.current = chart.addSeries(LineSeries, { color: '#9C27B0', lineWidth: 2 as any, priceLineVisible: false, lastValueVisible: false });

    // Bollinger Bands
    bbUpperRef.current = chart.addSeries(LineSeries, { color: '#64748b80', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineStyle: 2 });
    bbMiddleRef.current = chart.addSeries(LineSeries, { color: '#64748b60', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineStyle: 1 });
    bbLowerRef.current = chart.addSeries(LineSeries, { color: '#64748b80', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineStyle: 2 });

    const ro = new ResizeObserver(() => {
      if (chartRef.current) {
        chart.applyOptions({ width: chartRef.current.clientWidth, height: chartRef.current.clientHeight });
      }
    });
    ro.observe(chartRef.current);

    return () => {
      ro.disconnect();
      // Clean up series references to prevent memory leaks
      if (volumeSeriesRef.current) {
        chart.removeSeries(volumeSeriesRef.current);
        volumeSeriesRef.current = null;
      }
      if (candleSeriesRef.current) {
        chart.removeSeries(candleSeriesRef.current);
        candleSeriesRef.current = null;
      }
      if (ema20Ref.current) {
        chart.removeSeries(ema20Ref.current);
        ema20Ref.current = null;
      }
      if (ema50Ref.current) {
        chart.removeSeries(ema50Ref.current);
        ema50Ref.current = null;
      }
      if (ema200Ref.current) {
        chart.removeSeries(ema200Ref.current);
        ema200Ref.current = null;
      }
      if (bbUpperRef.current) {
        chart.removeSeries(bbUpperRef.current);
        bbUpperRef.current = null;
      }
      if (bbMiddleRef.current) {
        chart.removeSeries(bbMiddleRef.current);
        bbMiddleRef.current = null;
      }
      if (bbLowerRef.current) {
        chart.removeSeries(bbLowerRef.current);
        bbLowerRef.current = null;
      }
      chartInstanceRef.current = null;
      setChartReady(false);
      chart.remove();
    };
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time updates via WebSocket
  useEffect(() => {
    let disposed = false;
    let unsub: (() => void) | null = null;
    const activeSymbol = selectedSymbol;
    const activeInterval = selectedInterval;

    const updateChartWithDebounce = () => {
      if (!debouncedUpdatesRef.current || disposed) return;

      const now = Date.now();
      // Debounce updates to every 80ms for smoother real-time rendering without flooding the UI thread
      if (now - lastUpdateTimeRef.current > 80) {
        if (candleSeriesRef.current && debouncedUpdatesRef.current.candle) {
          try {
            candleSeriesRef.current.update(debouncedUpdatesRef.current.candle);
          } catch (updateErr) {
            console.error('Error updating candle series:', updateErr);
          }
        }
        if (volumeSeriesRef.current && debouncedUpdatesRef.current.volume) {
          try {
            volumeSeriesRef.current.update(debouncedUpdatesRef.current.volume);
          } catch (updateErr) {
            console.error('Error updating volume series:', updateErr);
          }
        }
        setCurrentCandle(debouncedUpdatesRef.current.candle);
        debouncedUpdatesRef.current = null;
        lastUpdateTimeRef.current = now;
      } else {
        // Schedule the update for later if we're still within the debounce window
        if (updateTimeoutRef.current !== null) {
          window.clearTimeout(updateTimeoutRef.current);
        }
        updateTimeoutRef.current = window.setTimeout(updateChartWithDebounce, 80 - (now - lastUpdateTimeRef.current));
      }
    };

    // Wrap in try-catch and defer execution to prevent blocking the main thread
    const subscribeHandler = async () => {
      if (disposed) return;

      try {
        const { mexcWs } = await import('../services/mexcApi');
        if (disposed) return;

        mexcWs.connect();
        unsub = mexcWs.subscribeKline(activeSymbol, activeInterval, (msg) => {
          if (disposed) return;

          try {
            // Handle both formats: msg.channel='push.kline' and nested msg.data.channel
            const channel = msg.channel || (msg.data && msg.data.channel);
            if (channel !== 'push.kline') return;

            const msgSymbol = msg.symbol || msg.data?.symbol || msg.data?.s;
            if (msgSymbol && msgSymbol !== activeSymbol) return;
            if (msg.data && msg.data.c) {
              const d = msg.data;
              const timestamp = d.t || d.T;
              if (typeof timestamp !== 'number') return;

              // MEXC Contract kline fields: o, c, h, l, q (amount in USD), a (volume in contracts)
              const newCandle = {
                time: timestamp,
                open: Number(d.o),
                high: Number(d.h),
                low: Number(d.l),
                close: Number(d.c),
                volume: Number(d.q || d.a || 0)
              };

              // Store in debounced buffer
              debouncedUpdatesRef.current = {
                candle: newCandle,
                volume: {
                  time: timestamp,
                  value: newCandle.volume,
                  color: newCandle.close >= newCandle.open ? '#0ecb8133' : '#f6465d33'
                }
              };

              // Trigger the update
              updateChartWithDebounce();
            }
          } catch (processErr) {
            console.error('Error processing WebSocket message:', processErr);
          }
        });
      } catch (err) {
        if (!disposed) {
          console.error('WebSocket subscription error:', err);
        }
      }
    };

    subscribeHandler();

    return () => {
      disposed = true;
      if (unsub) {
        unsub();
      }
      if (updateTimeoutRef.current !== null) {
        window.clearTimeout(updateTimeoutRef.current);
        updateTimeoutRef.current = null;
      }
    };
  }, [selectedSymbol, selectedInterval]);

  // Draw Price Lines for Active Orders of current symbol only
  useEffect(() => {
    if (!candleSeriesRef.current) return;

    // Clear old lines
    priceLinesRef.current.forEach((line) => candleSeriesRef.current.removePriceLine(line));
    priceLinesRef.current = [];

    chartVisualOrders.forEach((order) => {
      const contractSize = getContractSizeBySymbol(order.symbol);
      const margin = calcMarginEstimate(order.entry, order.quantity, order.leverage, contractSize);
      const entryColor = order.side === 'LONG' ? '#f0b90b' : '#a855f7';
      const sourceLabel = sourceLabelMap[order.source];

      // Entry Line
      priceLinesRef.current.push(candleSeriesRef.current.createPriceLine({
        price: order.entry,
        color: entryColor,
        lineWidth: 2,
        lineStyle: 0,
        axisLabelVisible: true,
        title: `${sourceLabel} ${order.side} ${order.leverage}x • Q:${order.quantity.toFixed(2)} • M:${margin.toFixed(2)} USDT`,
      }));

      // TP Line
      if (typeof order.tp === 'number' && Number.isFinite(order.tp) && order.tp > 0) {
        priceLinesRef.current.push(candleSeriesRef.current.createPriceLine({
          price: order.tp,
          color: '#0ecb81',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `TP • ${sourceLabel}`,
        }));
      }

      // SL Line
      if (typeof order.sl === 'number' && Number.isFinite(order.sl) && order.sl > 0) {
        priceLinesRef.current.push(candleSeriesRef.current.createPriceLine({
          price: order.sl,
          color: '#f6465d',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `SL • ${sourceLabel}`,
        }));
      }
    });
  }, [chartVisualOrders, getContractSizeBySymbol, updateCancelButtonCoordinates]);


  return (
    <div className="flex flex-col h-full bg-[#0b0e14]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[#1e2535] flex-wrap">
        {/* Intervals */}
        <div className="flex gap-1.5">
          {INTERVALS.map(({ label, value }) => (
            <button key={value} onClick={() => setSelectedInterval(value)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${selectedInterval === value ? 'bg-[#f0b90b] text-black font-bold' : 'text-gray-500 hover:text-gray-300 hover:bg-[#1e2535]'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="h-5 w-px bg-[#1e2535]" />

        {/* Indicators toggle */}
        <button onClick={() => setShowEMA(v => !v)}
          className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${showEMA ? 'border-[#f0b90b] text-[#f0b90b]' : 'border-[#2a3045] text-gray-600'}`}>
          EMA
        </button>
        <button onClick={() => setShowBB(v => !v)}
          className={`text-sm px-3 py-1.5 rounded-md border transition-colors ${showBB ? 'border-blue-500 text-blue-400' : 'border-[#2a3045] text-gray-600'}`}>
          BB
        </button>

        <button onClick={loadData} disabled={loading}
          className="ml-auto text-gray-500 hover:text-gray-300 transition-colors p-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Signal bar */}
      {signal && signal.type !== 'NEUTRAL' && (
        <div className="flex items-center gap-3 px-4 py-2 text-sm border-b border-[#182033] bg-[#0e1421]/85 backdrop-blur-sm">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold tracking-wide ${
              signal.type === 'LONG'
                ? 'bg-[#0ecb81]/15 text-[#0ecb81]'
                : 'bg-[#f6465d]/15 text-[#f6465d]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            {signal.type === 'LONG' ? 'TÍN HIỆU LONG' : 'TÍN HIỆU SHORT'}
          </span>
          <span className="text-gray-400">{signal.strength}</span>
          <span className="text-gray-400">Entry: <span className="text-white font-mono">{signal.entry.toFixed(2)}</span></span>
          <span className="text-green-400">TP: <span className="font-mono">{signal.takeProfit.toFixed(2)}</span></span>
          <span className="text-red-400">SL: <span className="font-mono">{signal.stopLoss.toFixed(2)}</span></span>
          <span className="text-yellow-400">R:R <span className="font-mono">{signal.riskReward.toFixed(2)}</span></span>
          <span className="ml-auto text-gray-500">Confidence: <span className="text-white font-bold">{signal.confidence}%</span></span>
        </div>
      )}

      {/* Indicator legend */}
      {showEMA && (
        <div className="flex gap-4 px-4 py-2 text-xs border-b border-[#0f1420]">
          <span className="text-[#f0b90b]">● EMA20</span>
          <span className="text-[#2196F3]">● EMA50</span>
          <span className="text-[#9C27B0]">● EMA200</span>
          {showBB && <span className="text-[#64748b]">- - BB(20,2)</span>}
          {currentCandle && (
            <span className="ml-auto text-gray-500">
              O:<span className={currentCandle.close >= currentCandle.open ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>{currentCandle.open.toFixed(2)}</span>
              {' '}H:<span className="text-[#0ecb81]">{currentCandle.high.toFixed(2)}</span>
              {' '}L:<span className="text-[#f6465d]">{currentCandle.low.toFixed(2)}</span>
              {' '}C:<span className={currentCandle.close >= currentCandle.open ? 'text-[#0ecb81]' : 'text-[#f6465d]'}>{currentCandle.close.toFixed(2)}</span>
            </span>
          )}
        </div>
      )}

      {/* Chart */}
      <div className="relative flex-1 min-h-0">
        <div ref={chartRef} className="absolute inset-0" />

        <div className="pointer-events-none absolute inset-0 z-[120]">
          {chartCancelButtons.map((button) => (
            <div
              key={button.orderKey}
              className="absolute right-12 -translate-y-1/2"
              style={{ top: `${button.top}px` }}
            >
              <button
                id={`chart-line-cancel-${button.orderKey}`}
                onClick={() => removeOrder(button.orderKey)}
                className="pointer-events-auto inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-rose-300 bg-rose-600 text-white shadow-[0_0_0_2px_rgba(15,23,42,0.9),0_0_18px_rgba(244,63,94,0.65)] transition-all hover:scale-110 hover:bg-red-700"
                title="Hủy lệnh SIM DRAFT"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
