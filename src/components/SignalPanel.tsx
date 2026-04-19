import { useState, useEffect, useRef } from 'react';
import { useSignalPanelState } from '../store/hooks';
import { generateSignalInWorker } from '../services/analysisWorkerClient';
import { analyzeWithAI } from '../services/geminiAi';
import { fetchKlines } from '../services/mexcApi';
import { fetchTimesFmForecast } from '../services/timesfmService';
import { AI_PROVIDERS, type CandlePoint, type TradeSignal } from '../types';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Sparkles,
  Target,
  BarChart2,
  Zap,
  Activity,
} from 'lucide-react';

interface Props {
  candles: CandlePoint[];
  onPlaceOrder?: (signal: TradeSignal) => void;
}

function Gauge({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' }) {
  const pct = Math.max(0, Math.min(100, value));
  const color =
    pct >= 70
      ? 'var(--color-success)'
      : pct >= 50
        ? 'var(--color-warning)'
        : 'var(--color-danger)';
  const radius = size === 'sm' ? 23 : 32;
  const circumference = 2 * Math.PI * radius;
  const progress = (pct / 100) * circumference * 0.75;
  const dimension = size === 'sm' ? 68 : 92;

  return (
    <div
      className="relative grid place-items-center"
      style={{ width: dimension, height: dimension }}
    >
      <svg className="h-full w-full" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="rgba(99, 115, 155, 0.28)"
          strokeWidth="8"
          strokeDasharray={`${circumference * 0.75} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(135 50 50)"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(135 50 50)"
          style={{ transition: 'stroke-dasharray 400ms ease' }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-lg font-black leading-none" style={{ color }}>
          {pct}%
        </div>
        <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--text-muted)]">
          Độ tin cậy
        </div>
      </div>
    </div>
  );
}

function WinRateBadge({ rate }: { rate: number }) {
  const tone =
    rate >= 60
      ? 'border-[rgba(0,230,138,0.45)] bg-[var(--color-success-dim)] text-[var(--color-success)]'
      : rate >= 50
        ? 'border-[rgba(255,184,46,0.45)] bg-[var(--color-warning-dim)] text-[var(--color-warning)]'
        : 'border-[rgba(255,77,106,0.45)] bg-[var(--color-danger-dim)] text-[var(--color-danger)]';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${tone}`}>
      <Target className="h-3.5 w-3.5" />
      Win rate {rate}%
    </span>
  );
}

export default function SignalPanel({ candles, onPlaceOrder }: Props) {
  const {
    selectedSymbol,
    signals,
    setSignal,
    isAnalyzing,
    setIsAnalyzing,
    aiCredentials,
    setCurrentAiProvider,
    signalScanInterval,
    setSignalScanInterval,
    tickers,
    setSelectedSymbol,
    tradeLessons,
  } = useSignalPanelState();
  const [scanResults, setScanResults] = useState<Record<string, TradeSignal>>({});
  const [scanning, setScanning] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const signal = signals[selectedSymbol];

  const analyzeWithWorker = (data: CandlePoint[]) =>
    generateSignalInWorker(data, { timeoutMs: 20000, fallbackToMainThread: true });

  const analyze = async (withAI = true) => {
    setIsAnalyzing(true);
    try {
      let data = candles;
      if (!data || data.length < 50) {
        const klines = await fetchKlines(selectedSymbol, 'Min15', 300);
        if (klines) {
          data = klines.time.map((t, i) => ({
            time: t,
            open: klines.open[i],
            high: klines.high[i],
            low: klines.low[i],
            close: klines.close[i],
            volume: klines.vol[i],
          }));
        }
      }
      if (!data || data.length < 50) return;

      const sig = await analyzeWithWorker(data);

      if (withAI && aiCredentials) {
        setAiLoading(true);
        try {
          const marketContext: {
            volumeTrend: 'increasing' | 'decreasing' | 'neutral';
            volatility: 'high' | 'normal' | 'low';
          } = {
            volumeTrend: 'increasing',
            volatility:
              sig.indicators?.marketRegime === 'VOLATILE'
                ? 'high'
                : sig.indicators?.marketRegime === 'TRENDING'
                  ? 'normal'
                  : 'low',
          };

          let timesFmForecast: number[] | null = null;
          try {
            timesFmForecast = await fetchTimesFmForecast(data.map((c) => c.close), 12);
          } catch (error) {
            console.error('TimesFm failed', error);
          }

          const aiResult = await analyzeWithAI(
            aiCredentials,
            selectedSymbol,
            sig,
            data,
            sig.entry,
            tradeLessons || [],
            timesFmForecast,
            marketContext,
          );

          if (aiResult) {
            const providerInfo = AI_PROVIDERS.find((provider) => provider.id === aiResult.provider);
            sig.aiAnalysis = aiResult.analysis;
            sig.aiProvider = providerInfo?.name || aiResult.provider;
            sig.confidence = Math.round((sig.confidence + aiResult.confidence) / 2);
            if (aiResult.riskWarning) {
              sig.reasons.push(`⚠️ AI: ${aiResult.riskWarning}`);
            }
            setCurrentAiProvider(sig.aiProvider);
          }
        } finally {
          setAiLoading(false);
        }
      }

      setSignal(selectedSymbol, sig);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const scanMarket = async () => {
    setScanning(true);
    const targets = tickers
      .filter((ticker) => ticker.symbol.endsWith('_USDT'))
      .sort((a, b) => b.amount24 - a.amount24)
      .slice(0, 24)
      .map((ticker) => ticker.symbol);

    const results: Record<string, TradeSignal> = {};

    for (const symbol of targets) {
      try {
        const klines = await fetchKlines(symbol, 'Min15', 200);
        if (klines && klines.time?.length >= 50) {
          const chartCandles: CandlePoint[] = klines.time.map((time, index) => ({
            time,
            open: klines.open[index],
            high: klines.high[index],
            low: klines.low[index],
            close: klines.close[index],
            volume: klines.vol[index],
          }));
          const computedSignal = await analyzeWithWorker(chartCandles);
          results[symbol] = computedSignal;
          setSignal(symbol, computedSignal);
        }
      } catch {
        // Skip failed symbol
      }
    }

    setScanResults(results);
    setScanning(false);
  };

  const isScanningRef = useRef(scanning);
  isScanningRef.current = scanning;

  useEffect(() => {
    if (signalScanInterval <= 0) return;
    const interval = setInterval(() => {
      if (!isScanningRef.current) {
        scanMarket();
      }
    }, signalScanInterval * 60 * 1000);
    return () => clearInterval(interval);
  }, [signalScanInterval]);

  const typeBg = (type: TradeSignal['type']) =>
    type === 'LONG'
      ? 'border-[rgba(0,230,138,0.42)] bg-[linear-gradient(145deg,rgba(0,230,138,0.17),rgba(6,11,22,0.9))]'
      : type === 'SHORT'
        ? 'border-[rgba(255,77,106,0.42)] bg-[linear-gradient(145deg,rgba(255,77,106,0.17),rgba(6,11,22,0.9))]'
        : 'border-[var(--border)] bg-[linear-gradient(145deg,rgba(0,82,255,0.08),rgba(6,11,22,0.9))]';

  const typeText = (type: TradeSignal['type']) =>
    type === 'LONG'
      ? 'text-[var(--color-success)]'
      : type === 'SHORT'
        ? 'text-[var(--color-danger)]'
        : 'text-[var(--text-muted)]';

  const typeIcon = (type: TradeSignal['type']) =>
    type === 'LONG' ? (
      <TrendingUp className="h-5 w-5 text-[var(--color-success)]" />
    ) : type === 'SHORT' ? (
      <TrendingDown className="h-5 w-5 text-[var(--color-danger)]" />
    ) : (
      <Minus className="h-5 w-5 text-[var(--text-muted)]" />
    );

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-[var(--bg-panel)] p-4 text-[var(--text-main)]">
      <section className="coinbase-surface rounded-2xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-[rgba(0,82,255,0.4)] bg-[var(--color-brand-dim)]">
              <Brain className="h-5 w-5 text-[var(--color-brand)]" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">AI Signal Engine</h2>
              <p className="mt-0.5 text-xs text-[var(--text-muted)]">
                {selectedSymbol.replace('_', '/')} • Phân tích kỹ thuật + AI đa mô hình
              </p>
            </div>
            {aiCredentials && Object.values(aiCredentials).some((value) => value) && (
              <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(34,211,238,0.4)] bg-[rgba(34,211,238,0.12)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-cyan)]">
                <Sparkles className="h-3 w-3" />
                Multi AI
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              id="signal-scan-interval-select"
              value={signalScanInterval}
              onChange={(event) => setSignalScanInterval(Number(event.target.value))}
              className="rounded-xl border border-[var(--border)] bg-[var(--bg-main)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)] outline-none transition-all focus:border-[var(--color-brand)]"
            >
              <option value={0}>Auto scan: Off</option>
              <option value={1}>Auto scan: 1m</option>
              <option value={5}>Auto scan: 5m</option>
              <option value={15}>Auto scan: 15m</option>
              <option value={30}>Auto scan: 30m</option>
            </select>

            <button
              id="signal-scan-button"
              onClick={scanMarket}
              disabled={scanning}
              className="coinbase-pill-btn inline-flex items-center gap-2 bg-[rgba(139,92,246,0.16)] px-4 py-2 text-xs font-bold text-[#d8bcff] hover:bg-[rgba(139,92,246,0.24)] disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${scanning ? 'animate-spin' : ''}`} />
              Scan thị trường
            </button>

            <button
              id="signal-analyze-button"
              onClick={() => analyze(true)}
              disabled={isAnalyzing || aiLoading}
              className="coinbase-pill-btn inline-flex items-center gap-2 bg-[var(--color-brand)] px-5 py-2 text-xs font-extrabold uppercase tracking-[0.08em] text-white shadow-[0_12px_24px_rgba(0,82,255,0.35)] hover:bg-[var(--color-brand-hover)] disabled:opacity-60"
            >
              {isAnalyzing || aiLoading ? (
                <>
                  <Zap className="h-3.5 w-3.5 animate-pulse" />
                  Đang phân tích
                </>
              ) : (
                <>
                  <Brain className="h-3.5 w-3.5" />
                  Phân tích AI
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {signal ? (
        <section className={`coinbase-surface rounded-2xl border p-4 ${typeBg(signal.type)}`}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                {typeIcon(signal.type)}
                <span className={`text-2xl font-black tracking-tight ${typeText(signal.type)}`}>
                  {signal.type}
                </span>
                <span className="rounded-full border border-[var(--border)] bg-[var(--bg-surface-soft)] px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                  {signal.strength}
                </span>
                {signal.winRate !== undefined && <WinRateBadge rate={signal.winRate} />}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {signal.aiProvider && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(0,82,255,0.42)] bg-[var(--color-brand-dim)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--accent-soft)]">
                    <Sparkles className="h-3 w-3" />
                    {signal.aiProvider}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-surface-soft)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  <Activity className="h-3 w-3" />
                  {selectedSymbol.replace('_USDT', '')}
                </span>
              </div>
            </div>

            <Gauge value={signal.confidence} />
          </div>

          {signal.aiAnalysis && (
            <div className="mb-4 rounded-xl border border-[rgba(34,211,238,0.35)] bg-[rgba(34,211,238,0.08)] p-3.5">
              <div className="mb-1.5 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-[0.08em] text-[var(--color-cyan)]">
                <Sparkles className="h-3.5 w-3.5" />
                Nhận định AI
              </div>
              <p className="text-sm leading-relaxed text-[#cde9f6]">{signal.aiAnalysis}</p>
            </div>
          )}

          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-main)] p-3 text-center">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Entry
              </div>
              <div className="font-mono text-lg font-bold text-[var(--text-main)]">
                {signal.entry.toFixed(2)}
              </div>
            </div>
            <div className="rounded-xl border border-[rgba(0,230,138,0.4)] bg-[var(--color-success-dim)] p-3 text-center">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-success)]">
                Take Profit
              </div>
              <div className="font-mono text-lg font-bold text-[var(--color-success)]">
                {signal.takeProfit.toFixed(2)}
              </div>
            </div>
            <div className="rounded-xl border border-[rgba(255,77,106,0.4)] bg-[var(--color-danger-dim)] p-3 text-center">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-danger)]">
                Stop Loss
              </div>
              <div className="font-mono text-lg font-bold text-[var(--color-danger)]">
                {signal.stopLoss.toFixed(2)}
              </div>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-main)] p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Risk : Reward
              </div>
              <div className="font-mono text-sm font-bold text-[var(--color-warning)]">
                1 : {signal.riskReward.toFixed(2)}
              </div>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-main)] p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Backtest
              </div>
              <div
                className={`font-mono text-sm font-bold ${
                  signal.winRate === undefined
                    ? 'text-[var(--text-muted)]'
                    : signal.winRate >= 60
                      ? 'text-[var(--color-success)]'
                      : signal.winRate >= 50
                        ? 'text-[var(--color-warning)]'
                        : 'text-[var(--color-danger)]'
                }`}
              >
                {signal.winRate === undefined ? '—' : `${signal.winRate}% thắng`}
              </div>
            </div>
          </div>

          <div className="mb-4 grid grid-cols-1 gap-2 md:grid-cols-2">
            {[
              {
                label: 'RSI (14)',
                value: signal.indicators.rsi.toFixed(1),
                note:
                  signal.indicators.rsi < 30
                    ? '(Quá bán)'
                    : signal.indicators.rsi > 70
                      ? '(Quá mua)'
                      : '(Trung lập)',
                color:
                  signal.indicators.rsi < 30
                    ? 'text-[var(--color-success)]'
                    : signal.indicators.rsi > 70
                      ? 'text-[var(--color-danger)]'
                      : 'text-[var(--color-warning)]',
              },
              {
                label: 'MACD Histogram',
                value: signal.indicators.macd.histogram.toFixed(4),
                color:
                  signal.indicators.macd.histogram > 0
                    ? 'text-[var(--color-success)]'
                    : 'text-[var(--color-danger)]',
              },
              {
                label: 'Volume vs Avg',
                value: `${((signal.indicators.volume / signal.indicators.volumeAvg) * 100).toFixed(0)}%`,
                color:
                  signal.indicators.volume > signal.indicators.volumeAvg * 1.2
                    ? 'text-[var(--color-success)]'
                    : 'text-[var(--text-secondary)]',
              },
              {
                label: 'ATR (14)',
                value: signal.indicators.atr.toFixed(2),
                color: 'text-[var(--text-secondary)]',
              },
            ].map(({ label, value, note, color }) => (
              <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-main)] p-3">
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                  {label}
                </div>
                <div className={`font-mono text-sm font-bold ${color}`}>
                  {value}
                  {note && <span className="ml-1.5 text-[10px] text-[var(--text-muted)]">{note}</span>}
                </div>
              </div>
            ))}
          </div>

          <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg-main)] p-3.5">
            <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              <BarChart2 className="h-3.5 w-3.5" />
              Lý do phân tích
            </div>
            <div className="space-y-1.5">
              {signal.reasons.map((reason, index) => (
                <div key={index} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <span className="mt-1 text-[var(--text-muted)]">•</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>

          {onPlaceOrder && signal.type !== 'NEUTRAL' && (
            <button
              id="signal-place-order-button"
              onClick={() => onPlaceOrder(signal)}
              className={`coinbase-pill-btn w-full py-3 text-sm font-extrabold uppercase tracking-[0.08em] text-white shadow-[0_14px_28px_rgba(0,0,0,0.35)] ${
                signal.type === 'LONG'
                  ? 'bg-[var(--color-success)] hover:brightness-105'
                  : 'bg-[var(--color-danger)] hover:brightness-110'
              }`}
            >
              Đặt lệnh {signal.type} theo tín hiệu
            </button>
          )}

          <p className="mt-2 text-center text-[10px] font-medium text-[var(--text-muted)]">
            ⚠️ Chỉ là gợi ý, luôn quản lý rủi ro khi giao dịch.
          </p>
        </section>
      ) : (
        <section className="coinbase-surface rounded-2xl border border-[var(--border)] p-8 text-center">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-[rgba(0,82,255,0.3)] bg-[var(--color-brand-dim)]">
            <Brain className="h-7 w-7 text-[var(--color-brand)]" />
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Nhấn <span className="font-bold text-[var(--accent-soft)]">Phân tích AI</span> để bắt đầu cho {selectedSymbol.replace('_', '/')}
          </p>
          {!aiCredentials && (
            <p className="mt-2 text-xs text-[var(--color-cyan)]">💡 Thêm API key AI để tăng chất lượng nhận định</p>
          )}
        </section>
      )}

      {Object.keys(scanResults).length > 0 && (
        <section className="coinbase-surface rounded-2xl p-4">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            <CheckCircle className="h-3.5 w-3.5 text-[var(--color-success)]" />
            Kết quả scan thị trường
          </div>

          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {Object.entries(scanResults).map(([symbol, scannedSignal]) => (
              <button
                id={`signal-scan-result-${symbol}`}
                key={symbol}
                onClick={() => setSelectedSymbol(symbol)}
                className={`w-full rounded-xl border p-3 text-left transition-all hover:-translate-y-[1px] ${typeBg(scannedSignal.type)}`}
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-sm font-bold text-[var(--text-main)]">{symbol.replace('_USDT', '')}</span>
                  <span className={`text-xs font-black uppercase tracking-[0.08em] ${typeText(scannedSignal.type)}`}>
                    {scannedSignal.type}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-[11px] text-[var(--text-secondary)]">
                  <span>{scannedSignal.strength}</span>
                  <span>•</span>
                  <span>{scannedSignal.confidence}% conf</span>
                  <span>•</span>
                  <span>WR {scannedSignal.winRate ?? '—'}%</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-[rgba(255,184,46,0.3)] bg-[var(--color-warning-dim)] p-3">
        <div className="flex items-start gap-2 text-xs leading-relaxed text-[#ffd77a]">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Phân tích AI dựa trên chỉ báo kỹ thuật và mô hình ngôn ngữ. Không phải lời khuyên tài chính.
          </span>
        </div>
      </section>
    </div>
  );
}
