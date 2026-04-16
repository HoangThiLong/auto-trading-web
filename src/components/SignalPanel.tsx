import { useState, useEffect, useRef } from 'react';
import { useSignalPanelState } from '../store/hooks';
import { generateSignalInWorker } from '../services/analysisWorkerClient';
import { analyzeWithAI } from '../services/geminiAi';
import { fetchKlines } from '../services/mexcApi';
import { fetchTimesFmForecast } from '../services/timesfmService';
import { AI_PROVIDERS, type CandlePoint, type TradeSignal } from '../types';
import { Brain, TrendingUp, TrendingDown, Minus, RefreshCw, AlertTriangle, CheckCircle, Sparkles, Target, BarChart2, Zap } from 'lucide-react';

interface Props {
  candles: CandlePoint[];
  onPlaceOrder?: (signal: TradeSignal) => void;
}

function Gauge({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' }) {
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 70 ? '#0ecb81' : pct >= 50 ? '#f0b90b' : '#f6465d';
  const r = size === 'sm' ? 22 : 34;
  const circ = 2 * Math.PI * r;
  const strokeDash = (pct / 100) * circ * 0.75;
  const dim = size === 'sm' ? 'w-16 h-16' : 'w-22 h-22';

  return (
    <div className={`relative flex items-center justify-center ${dim}`} style={{ width: size === 'sm' ? 64 : 88, height: size === 'sm' ? 64 : 88 }}>
      <svg className="w-full h-full" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#1e2535" strokeWidth="8"
          strokeDasharray={`${circ * 0.75} ${circ}`} strokeDashoffset={0} strokeLinecap="round"
          transform="rotate(135 50 50)" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${strokeDash} ${circ}`} strokeDashoffset={0} strokeLinecap="round"
          transform="rotate(135 50 50)" style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      </svg>
      <div className="absolute text-center">
        <div className="font-black leading-none" style={{ color, fontSize: size === 'sm' ? 14 : 20 }}>{pct}%</div>
        <div className="text-xs text-gray-600 mt-0.5">Tin cậy</div>
      </div>
    </div>
  );
}

function WinRateBadge({ rate }: { rate: number }) {
  const color = rate >= 60 ? '#0ecb81' : rate >= 50 ? '#f0b90b' : '#f6465d';
  return (
    <div className="flex items-center gap-1 text-sm font-bold" style={{ color }}>
      <Target className="w-4 h-4" />
      {rate}% win
    </div>
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
            time: t, open: klines.open[i], high: klines.high[i],
            low: klines.low[i], close: klines.close[i], volume: klines.vol[i],
          }));
        }
      }
      if (!data || data.length < 50) return;

      const sig = await analyzeWithWorker(data);

      // Enhance with AI if available
      if (withAI && aiCredentials) {
        setAiLoading(true);
        try {
          const marketContext: { volumeTrend: 'increasing' | 'decreasing' | 'neutral', volatility: 'high' | 'normal' | 'low' } = {
            volumeTrend: 'increasing',
            volatility: sig.indicators?.marketRegime === 'VOLATILE' ? 'high' :
              sig.indicators?.marketRegime === 'TRENDING' ? 'normal' : 'low'
          };

          // Fetch TimesFm forecast
          let timesFmForecast: number[] | null = null;
          try {
            timesFmForecast = await fetchTimesFmForecast(data.map(c => c.close), 12);
          } catch (e) { console.error('TimesFm failed', e); }

          const aiResult = await analyzeWithAI(
            aiCredentials,
            selectedSymbol,
            sig,
            data,
            sig.entry,
            tradeLessons || [],
            timesFmForecast,
            marketContext
          );
          if (aiResult) {
            const providerInfo = AI_PROVIDERS.find(p => p.id === aiResult.provider);
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
    // Focus on potential coins by volume & volatility (top 24 active USDT pairs)
    const targets = tickers
      .filter(t => t.symbol.endsWith('_USDT'))
      .sort((a, b) => b.amount24 - a.amount24)
      .slice(0, 24)
      .map(t => t.symbol);

    const results: Record<string, TradeSignal> = {};

    for (const sym of targets) {
      try {
        const klines = await fetchKlines(sym, 'Min15', 200);
        if (klines && klines.time?.length >= 50) {
          const cds: CandlePoint[] = klines.time.map((t, i) => ({
            time: t, open: klines.open[i], high: klines.high[i],
            low: klines.low[i], close: klines.close[i], volume: klines.vol[i],
          }));
          const computedSignal = await analyzeWithWorker(cds);
          results[sym] = computedSignal;
          setSignal(sym, computedSignal);
        }
      } catch {
        // skip symbol on failure
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

  const typeBg = (t: TradeSignal['type']) =>
    t === 'LONG' ? 'bg-green-950/40 border-green-800/50' :
    t === 'SHORT' ? 'bg-red-950/40 border-red-800/50' :
    'bg-[#1a2235] border-[#2a3045]';

  const typeText = (t: TradeSignal['type']) =>
    t === 'LONG' ? 'text-[#0ecb81]' : t === 'SHORT' ? 'text-[#f6465d]' : 'text-gray-500';

  const typeIcon = (t: TradeSignal['type']) =>
    t === 'LONG' ? <TrendingUp className="w-5 h-5 text-[#0ecb81]" /> :
    t === 'SHORT' ? <TrendingDown className="w-5 h-5 text-[#f6465d]" /> :
    <Minus className="w-5 h-5 text-gray-500" />;

  return (
    <div className="flex flex-col gap-3 p-3 text-white h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-[#f0b90b]" />
          <span className="font-bold text-base text-[#f0b90b]">AI Signal Engine</span>
          {aiCredentials && Object.values(aiCredentials).some(v => v) && (
            <span className="text-[10px] bg-blue-900/50 text-blue-400 px-2 py-1 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Multi-AI
            </span>
          )}
        </div>
        <div className="flex gap-1.5 items-center">
          <select 
            value={signalScanInterval} 
            onChange={e => setSignalScanInterval(Number(e.target.value))}
            className="text-xs bg-[#161b25] border border-[#2a3045] rounded-lg px-2 py-1.5 focus:outline-none"
          >
            <option value={0}>Auto off</option>
            <option value={1}>1m</option>
            <option value={5}>5m</option>
            <option value={15}>15m</option>
            <option value={30}>30m</option>
          </select>
          <button onClick={scanMarket} disabled={scanning}
            className="text-sm px-3 py-1.5 bg-purple-900/50 text-purple-300 border border-purple-800/50 rounded-lg hover:bg-purple-800/50 transition-colors flex items-center gap-1">
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            Scan ({tickers.filter(t => t.symbol.endsWith('_USDT')).length > 24 ? '24 pairs' : 'Tất cả'})
          </button>
          <button onClick={() => analyze(true)} disabled={isAnalyzing || aiLoading}
            className="text-sm px-4 py-1.5 bg-[#f0b90b] text-black rounded-lg font-bold hover:bg-[#d4a517] transition-colors flex items-center gap-1 disabled:opacity-60">
            {(isAnalyzing || aiLoading)
              ? <><Zap className="w-4 h-4 animate-pulse" /> Đang phân tích...</>
              : <><Brain className="w-4 h-4" /> Phân tích AI</>}
          </button>
        </div>
      </div>

      {/* Current signal */}
      {signal ? (
        <div className={`rounded-xl border p-3.5 ${typeBg(signal.type)}`}>
          {/* Top row: direction + gauge */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                {typeIcon(signal.type)}
                <span className={`text-2xl font-black ${typeText(signal.type)}`}>{signal.type}</span>
                <span className={`text-sm font-bold px-2.5 py-1 rounded-full border ${
                  signal.type === 'LONG' ? 'border-green-700/50 text-green-400' :
                  signal.type === 'SHORT' ? 'border-red-700/50 text-red-400' :
                  'border-gray-700 text-gray-500'
                }`}>{signal.strength}</span>
              </div>
              {signal.winRate !== undefined && <WinRateBadge rate={signal.winRate} />}
              {signal.aiProvider && (
                <div className="text-xs text-blue-400 flex items-center gap-1 mt-1">
                  <Sparkles className="w-3 h-3" /> {signal.aiProvider}
                </div>
              )}
            </div>
            <Gauge value={signal.confidence} />
          </div>

          {/* AI Analysis box */}
          {signal.aiAnalysis && (
            <div className="mb-4 p-3 bg-blue-950/30 border border-blue-900/40 rounded-lg">
              <div className="text-xs text-blue-400 font-bold mb-1.5 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> NHẬN ĐỊNH AI
              </div>
              <p className="text-sm text-blue-200 leading-relaxed">{signal.aiAnalysis}</p>
            </div>
          )}

          {/* Entry / TP / SL */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-[#0b0e1480] rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500 mb-1 uppercase">Entry</div>
              <div className="text-base font-mono font-bold text-white">{signal.entry.toFixed(2)}</div>
            </div>
            <div className="bg-green-950/50 rounded-lg p-3 text-center">
              <div className="text-xs text-green-600 mb-1 uppercase">Take Profit</div>
              <div className="text-base font-mono font-bold text-green-400">{signal.takeProfit.toFixed(2)}</div>
            </div>
            <div className="bg-red-950/50 rounded-lg p-3 text-center">
              <div className="text-xs text-red-600 mb-1 uppercase">Stop Loss</div>
              <div className="text-base font-mono font-bold text-red-400">{signal.stopLoss.toFixed(2)}</div>
            </div>
          </div>

          {/* R:R + Win rate row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 flex items-center justify-between bg-[#0b0e1480] rounded-lg p-3">
              <span className="text-xs text-gray-500">Risk:Reward</span>
              <span className="font-mono font-bold text-yellow-400 text-sm">1 : {signal.riskReward.toFixed(2)}</span>
            </div>
            {signal.winRate !== undefined && (
              <div className="flex-1 flex items-center justify-between bg-[#0b0e1480] rounded-lg p-3">
                <span className="text-xs text-gray-500">Backtest</span>
                <span className={`font-mono font-bold text-sm ${signal.winRate >= 60 ? 'text-green-400' : signal.winRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {signal.winRate}% thắng
                </span>
              </div>
            )}
          </div>

          {/* Indicators */}
          <div className="grid grid-cols-2 gap-1.5 text-xs mb-3">
            {[
              {
                label: 'RSI (14)',
                value: signal.indicators.rsi.toFixed(1),
                note: signal.indicators.rsi < 30 ? '(Quá bán)' : signal.indicators.rsi > 70 ? '(Quá mua)' : '(Trung lập)',
                color: signal.indicators.rsi < 30 ? 'text-green-400' : signal.indicators.rsi > 70 ? 'text-red-400' : 'text-yellow-400',
              },
              {
                label: 'MACD Hist.',
                value: signal.indicators.macd.histogram.toFixed(4),
                color: signal.indicators.macd.histogram > 0 ? 'text-green-400' : 'text-red-400',
              },
              {
                label: 'Volume vs Avg',
                value: `${((signal.indicators.volume / signal.indicators.volumeAvg) * 100).toFixed(0)}%`,
                color: signal.indicators.volume > signal.indicators.volumeAvg * 1.2 ? 'text-green-400' : 'text-gray-400',
              },
              {
                label: 'ATR (14)',
                value: signal.indicators.atr.toFixed(2),
                color: 'text-gray-300',
              },
            ].map(({ label, value, note, color }) => (
              <div key={label} className="bg-[#0b0e1480] rounded-lg p-3">
                <div className="text-gray-600 text-xs mb-1">{label}</div>
                <div className={`font-mono font-bold text-sm ${color}`}>
                  {value}{note && <span className="text-[10px] text-gray-600 ml-1.5">{note}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Reasons */}
          <div className="mb-4">
            <div className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wider flex items-center gap-1.5">
              <BarChart2 className="w-4 h-4" /> Lý do phân tích
            </div>
            <div className="space-y-1.5">
              {signal.reasons.map((r, i) => (
                <div key={i} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="shrink-0 mt-0.5 text-xs text-gray-600">›</span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Place Order Button */}
          {onPlaceOrder && signal.type !== 'NEUTRAL' && (
            <button
              onClick={() => onPlaceOrder(signal)}
              className={`w-full py-3 rounded-lg font-bold text-base transition-all shadow-lg ${
                signal.type === 'LONG'
                  ? 'bg-gradient-to-r from-green-600 to-green-500 text-white hover:from-green-500 hover:to-green-400'
                  : 'bg-gradient-to-r from-red-600 to-red-500 text-white hover:from-red-500 hover:to-red-400'
              }`}>
              📋 Đặt lệnh {signal.type} theo tín hiệu này
            </button>
          )}

          <div className="text-[9px] text-gray-700 text-center mt-2">
            ⚠️ Chỉ là gợi ý — luôn tự chịu trách nhiệm khi giao dịch
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center gap-4 py-10 bg-[#1a2235]/60 rounded-xl border border-[#2a3045]">
          <div className="w-12 h-12 rounded-xl bg-[#f0b90b]/10 flex items-center justify-center">
            <Brain className="w-6 h-6 text-[#f0b90b]/70" />
          </div>
          <div className="text-center">
            <p className="text-gray-400 text-sm mb-1">Nhấn <strong className="text-[#f0b90b]">Phân tích AI</strong> để bắt đầu</p>
            <p className="text-gray-600 text-xs">{selectedSymbol} — Phân tích kỹ thuật + AI tích hợp</p>
          </div>
          {!aiCredentials && (
            <p className="text-[10px] text-blue-400 text-center">
              💡 Thêm AI API key để có nhận định thông minh hơn
            </p>
          )}
        </div>
      )}

      {/* Multi-symbol scan results */}
      {Object.keys(scanResults).length > 0 && (
        <div>
          <div className="text-xs text-gray-500 font-semibold mb-2 flex items-center gap-1">
            <CheckCircle className="w-3 h-3 text-green-500" />
            KẾT QUẢ SCAN THỊ TRƯỜNG
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {Object.entries(scanResults).map(([sym, sig]) => (
              <div key={sym} className={`rounded-lg p-2.5 border cursor-pointer hover:opacity-80 transition-opacity ${typeBg(sig.type)}`}
                onClick={() => setSelectedSymbol(sym)}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-white">{sym.replace('_USDT', '')}</span>
                  <span className={`text-[10px] font-bold ${typeText(sig.type)}`}>{sig.type}</span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>{sig.strength}</span>
                  <span className="flex items-center gap-1">
                    <Target className="w-2.5 h-2.5" />{sig.winRate ?? '—'}%
                  </span>
                  <span>{sig.confidence}% conf</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <div className="mt-auto flex items-start gap-2 p-2.5 bg-yellow-950/30 border border-yellow-900/40 rounded-lg text-[10px] text-yellow-600">
        <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
        <span>Phân tích AI dựa trên chỉ báo kỹ thuật + mô hình ngôn ngữ. Không phải lời khuyên tài chính. Luôn quản lý rủi ro.</span>
      </div>
    </div>
  );
}
