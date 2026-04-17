import { useState, useEffect } from 'react';
import { useAutoTradePanelState } from '../store/hooks';
import { calcDailyPnL } from '../services/capitalManager';
import { isSafeToTrade } from '../services/newsService';
import toast from 'react-hot-toast';
import {
  Bot, X, StopCircle, Activity, Settings2, Zap,
  AlertTriangle, CheckCircle, Shield, Newspaper, DollarSign,
  PlayCircle, PauseCircle,
} from 'lucide-react';

export default function AutoTradePanel() {
  const {
    autoTradePanelOpen, setAutoTradePanelOpen,
    autoTradeMode, setAutoTradeMode,
    autoTradeConfig, setAutoTradeConfig,
    autoTradeLogs, clearAutoTradeLogs,
    autoTradeRunning, setAutoTradeRunning,
    updateAutoTradeLog,
    credentials,
    signals, tickers, contracts,
    news, marketSentiment,
  } = useAutoTradePanelState();

  const [configTab, setConfigTab] = useState<'status' | 'config' | 'logs' | 'summary'>('status');

  useEffect(() => {
    import('../services/autoTradeDaemon').then(({ autoTradeDaemon }) => {
      if (autoTradeMode !== 'off' && autoTradeRunning) {
        autoTradeDaemon.start();
      } else {
        autoTradeDaemon.stop();
      }
    });
  }, [autoTradeMode, autoTradeRunning]);

  if (!autoTradePanelOpen) return null;

  const dailyPnL = calcDailyPnL(autoTradeLogs);
  const activeOrders = autoTradeLogs.filter(l => l.status === 'OPENED').length;
  const wins = autoTradeLogs.filter(l => l.status === 'TP_HIT').length;
  const totalTrades = autoTradeLogs.filter(l => ['TP_HIT', 'SL_HIT', 'CLOSED'].includes(l.status)).length;
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;

  const safetyCheck = isSafeToTrade(marketSentiment, news, {
    newsFilter: autoTradeConfig.newsFilter,
    quietHours: autoTradeConfig.quietHours,
  });

  const modeColor = autoTradeMode === 'live' ? 'var(--color-danger)' : autoTradeMode === 'simulation' ? 'var(--color-warning)' : '#6b7280';
  const modeLabel = autoTradeMode === 'live' ? 'LIVE' : autoTradeMode === 'simulation' ? 'SIMULATION' : 'OFF';

  const handleToggleRunning = () => {
    if (autoTradeMode === 'off') {
      toast.error('Chọn PAPER TRADE hoặc LIVE trước khi khởi động bot');
      return;
    }

    const nextRunning = !autoTradeRunning;
    setAutoTradeRunning(nextRunning);
    toast.success(nextRunning ? '▶️ Bot đã bắt đầu chạy' : '⏸️ Bot đã tạm dừng');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setAutoTradePanelOpen(false)} />

      <div className="relative w-full overflow-hidden border border-[var(--border)] bg-[var(--bg-panel)] shadow-[0_30px_90px_rgba(2,6,23,0.78)] sm:max-w-2xl sm:rounded-3xl">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-[var(--border-soft)] bg-gradient-to-r from-[rgba(15,21,32,0.96)] to-[rgba(22,27,39,0.92)] px-6 py-4">
          <div className="relative">
            <Bot className="h-6 w-6" style={{ color: modeColor }} />
            {autoTradeRunning && (
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 animate-pulse rounded-full bg-[var(--color-success)]" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-3 text-lg font-bold text-[var(--text-main)]">
              Auto-Trade Bot
              <span
                className="rounded-full border px-2.5 py-1 text-xs font-bold"
                style={{ background: `color-mix(in srgb, ${modeColor} 12%, transparent)`, color: modeColor, borderColor: `color-mix(in srgb, ${modeColor} 36%, transparent)` }}
              >
                {modeLabel}
              </span>
            </div>
            <div className="mt-1 text-sm text-[var(--text-muted)]">Tự động giao dịch theo tín hiệu AI</div>
          </div>

          <button
            id="autotrade-close-button"
            onClick={() => setAutoTradePanelOpen(false)}
            className="ml-auto rounded-lg p-1.5 text-[var(--text-muted)] transition-all hover:bg-[rgba(87,139,250,0.16)] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-3 gap-4 border-b border-[var(--border-soft)] px-5 py-5">
          {([
            { mode: 'off', label: '⛔ DỪNG', color: '#6b7280' },
            { mode: 'simulation', label: '🟡 PAPER TRADE', color: 'var(--color-warning)' },
            { mode: 'live', label: '🔴 LIVE REAL', color: 'var(--color-danger)' },
          ] as const).map(({ mode, label, color }) => {
            const active = autoTradeMode === mode;
            return (
              <button
                key={mode}
                onClick={() => {
                  if (mode === 'live' && !credentials) { toast.error('Cần MEXC API Key!'); return; }
                  setAutoTradeMode(mode);
                  setAutoTradeRunning(mode !== 'off');
                }}
                className={`rounded-2xl border py-3.5 text-sm font-bold transition-all ${
                  active
                    ? 'text-[#04140f] shadow-lg'
                    : 'border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-muted)] hover:text-[#c9d7f4]'
                }`}
                style={active ? { background: color, borderColor: color } : {}}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Start / Stop Bot */}
        <div className="border-b border-[var(--border-soft)] px-6 py-4">
          <button
            id="autotrade-start-stop-button"
            onClick={handleToggleRunning}
            className={`coinbase-pill-btn inline-flex w-full items-center justify-center gap-2 py-3.5 text-sm font-extrabold transition-all ${
              autoTradeRunning
                ? 'border-[rgba(246,70,93,0.5)] bg-[var(--color-danger)] text-white shadow-[0_12px_26px_rgba(246,70,93,0.3)] hover:bg-rose-600'
                : 'border-[rgba(0,82,255,0.5)] bg-[var(--color-brand)] text-white shadow-[0_12px_26px_rgba(0,82,255,0.3)] hover:bg-[var(--color-brand-hover)]'
            }`}
          >
            {autoTradeRunning ? <PauseCircle className="h-5 w-5" /> : <PlayCircle className="h-5 w-5" />}
            {autoTradeRunning ? 'Stop Bot' : 'Start Bot'}
          </button>
        </div>

        {/* Kill Switch */}
        {autoTradeMode !== 'off' && (
          <div className="border-b border-[rgba(246,70,93,0.28)] bg-[rgba(246,70,93,0.1)] px-6 py-4">
            <button
              onClick={() => { setAutoTradeMode('off'); setAutoTradeRunning(false); toast.success('⛔ Đã dừng Auto-Trade!'); }}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-700 to-red-600 py-3.5 text-base font-bold text-white shadow-[0_12px_26px_rgba(246,70,93,0.35)] transition-all hover:from-red-600 hover:to-red-500"
            >
              <StopCircle className="h-5 w-5" /> KILL SWITCH — Dừng khẩn cấp
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-[var(--border-soft)]">
          {([
            { id: 'status', icon: Activity, label: 'Trạng thái' },
            { id: 'config', icon: Settings2, label: 'Cấu hình' },
            { id: 'logs', icon: Zap, label: `Logs (${autoTradeLogs.length})` },
            { id: 'summary', icon: Activity, label: 'Tổng kết' },
          ] as const).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setConfigTab(id)}
              className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm font-bold transition-all ${
                configTab === id
                  ? 'border-b-2 border-[var(--color-brand)] bg-[rgba(0,82,255,0.1)] text-[#b7ceff]'
                  : 'text-[var(--text-muted)] hover:text-[#d8e5ff]'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <div className="max-h-[36rem] space-y-0 overflow-y-auto p-6">
          {/* Status */}
          {configTab === 'status' && (
            <div className="space-y-5">
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Đang mở', value: activeOrders, color: 'var(--color-warning)' },
                  { label: 'Win Rate', value: `${winRate}%`, color: winRate >= 60 ? 'var(--color-success)' : 'var(--color-danger)' },
                  { label: 'Daily P&L', value: `${dailyPnL >= 0 ? '+' : ''}${dailyPnL.toFixed(1)}$`, color: dailyPnL >= 0 ? 'var(--color-success)' : 'var(--color-danger)' },
                  { label: 'Logs', value: autoTradeLogs.length, color: '#9ca3af' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="coinbase-surface-soft rounded-xl p-4 text-center">
                    <div className="mb-2 text-xs text-[var(--text-muted)]">{label}</div>
                    <div className="text-lg font-bold" style={{ color }}>{value}</div>
                  </div>
                ))}
              </div>

              <div
                className={`flex items-start gap-3 rounded-xl border p-4 text-sm ${
                  safetyCheck.safe
                    ? 'border-[rgba(14,203,129,0.38)] bg-[rgba(14,203,129,0.14)] text-[#8ff3c8]'
                    : 'border-[rgba(246,70,93,0.38)] bg-[rgba(246,70,93,0.14)] text-[#ffb2bf]'
                }`}
              >
                {safetyCheck.safe ? <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />}
                <div>
                  <div className="mb-1 font-bold">News Filter</div>
                  <div>{safetyCheck.reason}</div>
                </div>
              </div>

              <div className="coinbase-surface-soft rounded-xl p-4">
                <div className="mb-3 text-xs uppercase tracking-wider text-[var(--text-muted)]">Đang theo dõi</div>
                <div className="flex flex-wrap gap-2">
                  {autoTradeConfig.scanAllMarket ? (() => {
                    const trackedCount = Object.values(signals).filter(s => s.type !== 'NEUTRAL' && Date.now() - s.timestamp < 3600000).length;
                    return (
                      <span className="rounded-full border border-[rgba(168,85,247,0.45)] bg-[rgba(168,85,247,0.14)] px-3 py-1.5 font-mono text-sm font-bold text-[#d8bcff]">
                        ĐỒNG BỘ SCAN ({trackedCount > 0 ? trackedCount : 10} CẶP)
                      </span>
                    );
                  })() : (
                    autoTradeConfig.symbols.map(sym => {
                      const sig = signals[sym];
                      const col = sig?.type === 'LONG' ? 'var(--color-success)' : sig?.type === 'SHORT' ? 'var(--color-danger)' : '#6b7280';
                      return (
                        <span
                          key={sym}
                          className="rounded-full border px-3 py-1.5 font-mono text-sm font-bold"
                          style={{ background: `color-mix(in srgb, ${col} 12%, transparent)`, color: col, borderColor: `color-mix(in srgb, ${col} 28%, transparent)` }}
                        >
                          {sym.replace('_USDT', '')}
                          {sig && sig.type !== 'NEUTRAL' && ` ${sig.type}`}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>

              {autoTradeMode === 'off' && (
                <div className="flex items-start gap-3 rounded-xl border border-[rgba(0,82,255,0.35)] bg-[rgba(0,82,255,0.12)] p-4 text-sm text-[#b7ceff]">
                  <Shield className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>Bắt đầu với <strong>PAPER TRADE</strong> để test chiến lược không mất tiền. Chuyển LIVE khi hài lòng.</div>
                </div>
              )}
            </div>
          )}

          {/* Config */}
          {configTab === 'config' && (
            <div className="space-y-4">
              {[
                { key: 'minConfidence', label: 'Confidence tối thiểu', min: 50, max: 95, step: 1, color: 'var(--color-warning)', suffix: '%' },
                { key: 'riskPercentPerTrade', label: 'Rủi ro mỗi lệnh', min: 0.5, max: 5, step: 0.5, color: '#f97316', suffix: '%' },
                { key: 'maxConcurrentOrders', label: 'Lệnh đồng thời tối đa', min: 1, max: 10, step: 1, color: '#a855f7', suffix: '' },
              ].map(({ key, label, min, max, step, color, suffix }) => (
                <div key={key} className="coinbase-surface-soft rounded-xl p-3.5">
                  <div className="mb-1.5 flex justify-between">
                    <label className="text-xs text-[var(--text-muted)]">{label}</label>
                    <span className="text-xs font-bold" style={{ color }}>
                      {String(autoTradeConfig[key as keyof typeof autoTradeConfig])}{suffix}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={autoTradeConfig[key as keyof typeof autoTradeConfig] as number}
                    onChange={e => setAutoTradeConfig({ [key]: +e.target.value })}
                    className="w-full cursor-pointer appearance-none rounded-full"
                    style={{ accentColor: color }}
                  />
                </div>
              ))}

              <div>
                <label className="mb-1.5 block text-xs text-[var(--text-muted)]">Daily Loss Limit (USDT)</label>
                <input
                  type="number"
                  value={autoTradeConfig.dailyLossLimit}
                  onChange={e => setAutoTradeConfig({ dailyLossLimit: +e.target.value })}
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-main)] px-3 py-2 font-mono text-sm text-white transition-colors focus:border-[var(--color-danger)] focus:outline-none focus:ring-2 focus:ring-[rgba(246,70,93,0.35)]"
                />
              </div>

              <div className="space-y-2">
                {[
                  { key: 'scanAllMarket', icon: Activity, label: 'Đồng bộ tuyệt đối cùng SCAN', desc: 'Auto Trade tự động đổi hướng bám theo các coin được Scan phát hiện.' },
                  { key: 'newsFilter', icon: Newspaper, label: 'News Filter', desc: 'Dừng khi có tin tức xấu' },
                  { key: 'trailingStop', icon: DollarSign, label: 'Trailing Stop', desc: 'Tự động kéo SL theo lợi nhuận' },
                ].map(({ key, icon: Icon, label, desc }) => (
                  <div key={key} className="coinbase-surface-soft flex items-center gap-3 rounded-xl p-3">
                    <Icon className="h-4 w-4 text-[var(--text-muted)]" />
                    <div className="flex-1">
                      <div className="text-xs font-medium text-[#d4ddf2]">{label}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">{desc}</div>
                    </div>
                    <button
                      onClick={() => setAutoTradeConfig({ [key]: !autoTradeConfig[key as keyof typeof autoTradeConfig] })}
                      className="toggle-track flex-shrink-0"
                      style={{ background: autoTradeConfig[key as keyof typeof autoTradeConfig] ? 'var(--color-brand)' : '#374151' }}
                    >
                      <div
                        className="toggle-thumb"
                        style={{ left: autoTradeConfig[key as keyof typeof autoTradeConfig] ? '17px' : '2px' }}
                      />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => { clearAutoTradeLogs(); toast.success('Đã xóa lịch sử'); }}
                className="w-full rounded-xl border border-[rgba(246,70,93,0.42)] py-2 text-xs text-[var(--color-danger)] transition-colors hover:bg-[rgba(246,70,93,0.16)]"
              >
                Xóa toàn bộ lịch sử
              </button>
            </div>
          )}

          {/* Logs */}
          {configTab === 'logs' && (
            <div className="space-y-1">
              {autoTradeLogs.length === 0 ? (
                <div className="py-10 text-center text-sm text-[var(--text-muted)]">Chưa có lệnh auto-trade nào</div>
              ) : (
                autoTradeLogs.map(log => {
                  const ticker = tickers.find(t => t.symbol === log.symbol);
                  const contractSize = contracts.find((contract) => contract.symbol === log.symbol)?.contractSize ?? 1;
                  let livePnL = log.pnl;
                  if (log.status === 'OPENED' && ticker?.lastPrice) {
                    const diff = log.side === 'LONG' ? ticker.lastPrice - log.entry : log.entry - ticker.lastPrice;
                    livePnL = diff * log.quantity * contractSize * log.leverage;
                  }

                  return (
                    <div
                      key={log.id}
                      className={`flex flex-col gap-1 rounded-xl border p-2.5 text-xs transition-colors ${
                        log.status === 'OPENED' ? 'border-blue-900/30 bg-blue-950/20' :
                          log.status === 'TP_HIT' ? 'border-green-900/30 bg-green-950/20' :
                            log.status === 'SL_HIT' ? 'border-red-900/30 bg-red-950/20' :
                              'border-[var(--border)] bg-[rgba(22,27,39,0.72)]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
                          log.mode === 'simulation' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-red-900/50 text-red-400'
                        }`}>{log.mode === 'simulation' ? 'SIM' : 'LIVE'}</span>
                        <span className={`font-bold ${log.side === 'LONG' ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>{log.side}</span>
                        <span className="font-mono text-gray-400">{log.symbol.replace('_USDT', '')}</span>
                        <span className="text-gray-600">@{log.entry.toFixed(4)}</span>
                        <span className="border-l border-gray-700 pl-2 text-gray-600">{log.confidence}% conf</span>
                        <span className={`ml-auto font-bold ${
                          log.status === 'TP_HIT' ? 'text-green-400' :
                            log.status === 'SL_HIT' ? 'text-red-400' :
                              log.status === 'OPENED' ? 'text-blue-400' : 'text-gray-500'
                        }`}>{log.status}</span>
                      </div>

                       <div className="mt-1 flex items-center justify-between pl-10">
                        <div className="flex gap-4">
                          <span className="font-mono text-gray-500">TP: {log.tp.toFixed(4)}</span>
                          <span className="font-mono text-gray-500">SL: {log.sl.toFixed(4)}</span>
                        </div>
                      </div>

                      {log.aiAnalysis && (
                        <div className="mt-1 border-l-2 border-gray-700 bg-black/30 px-2 py-1.5 font-mono text-[10px] leading-relaxed text-blue-300/80 whitespace-pre-wrap">
                          {log.aiAnalysis}
                        </div>
                      )}

                      <div className="mt-1 flex items-center justify-between pl-10">
                        <div className="flex items-center gap-3">
                          {livePnL !== undefined && (
                            <span className={`font-mono font-bold ${livePnL >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                              {livePnL >= 0 ? '+' : ''}{livePnL.toFixed(2)}$
                            </span>
                          )}
                          {log.status === 'OPENED' && (
                            <button
                              onClick={() => {
                                updateAutoTradeLog(log.id, { status: 'CLOSED', pnl: livePnL });
                                toast.success(`Đã đóng lệnh ${log.symbol}`);
                              }}
                              className="rounded border border-[rgba(246,70,93,0.4)] bg-[rgba(246,70,93,0.14)] px-2.5 py-1 text-[10px] text-[#ffb4c0] transition-colors hover:bg-[rgba(246,70,93,0.22)]"
                            >
                              Đóng Market
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Monthly Summary */}
          {configTab === 'summary' && (() => {
            // Group by month
            const byMonth: Record<string, { trades: number; wins: number; pnl: number }> = {};
            autoTradeLogs.filter(l => ['TP_HIT', 'SL_HIT', 'CLOSED'].includes(l.status)).forEach(l => {
              const d = new Date(l.timestamp);
              const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
              if (!byMonth[mKey]) byMonth[mKey] = { trades: 0, wins: 0, pnl: 0 };
              byMonth[mKey].trades++;
              if (l.status === 'TP_HIT') byMonth[mKey].wins++;
              if (l.pnl) byMonth[mKey].pnl += l.pnl;
            });
            const months = Object.keys(byMonth).sort().reverse();
            return (
              <div className="space-y-3">
                {months.length === 0 ? (
                  <div className="py-10 text-center text-sm text-[var(--text-muted)]">Chưa có dữ liệu tổng kết</div>
                ) : (
                  months.map(m => {
                    const { trades, wins, pnl } = byMonth[m];
                    const wr = trades > 0 ? Math.round((wins / trades) * 100) : 0;
                    return (
                      <div key={m} className="coinbase-surface-soft flex items-center justify-between rounded-xl p-4">
                        <div>
                          <div className="text-sm font-bold text-[#d4ddf2]">Tháng {m}</div>
                          <div className="mt-1 text-xs text-[var(--text-muted)]">{trades} lệnh đã đóng</div>
                        </div>
                        <div className="flex gap-4 text-right">
                          <div>
                            <div className="text-xs text-[var(--text-muted)]">Win Rate</div>
                            <div className={`font-bold ${wr >= 50 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>{wr}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-[var(--text-muted)]">P&L</div>
                            <div className={`font-bold ${pnl >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                              {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}$
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
