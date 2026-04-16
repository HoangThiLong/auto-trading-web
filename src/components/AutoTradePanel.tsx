import { useState, useEffect } from 'react';
import { useAutoTradePanelState } from '../store/hooks';
import { calcDailyPnL } from '../services/capitalManager';
import { isSafeToTrade } from '../services/newsService';
import toast from 'react-hot-toast';
import {
  Bot, X, StopCircle, Activity, Settings2, Zap,
  AlertTriangle, CheckCircle, Shield, Newspaper, DollarSign,
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
  const totalTrades = autoTradeLogs.filter(l => ['TP_HIT','SL_HIT','CLOSED'].includes(l.status)).length;
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;

  const safetyCheck = isSafeToTrade(marketSentiment, news, {
    newsFilter: autoTradeConfig.newsFilter,
    quietHours: autoTradeConfig.quietHours,
  });

  const modeColor = autoTradeMode === 'live' ? '#f6465d' : autoTradeMode === 'simulation' ? '#f0b90b' : '#6b7280';
  const modeLabel = autoTradeMode === 'live' ? 'LIVE' : autoTradeMode === 'simulation' ? 'SIMULATION' : 'OFF';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setAutoTradePanelOpen(false)} />
      <div className="relative w-full sm:max-w-2xl bg-[#0f1520] border border-[#2a3045] sm:rounded-3xl shadow-2xl overflow-hidden animate-fade-up">

        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-[#1e2535] bg-gradient-to-r from-[#0f1520] to-[#161b25]">
          <div className="relative">
            <Bot className="w-6 h-6" style={{ color: modeColor }} />
            {autoTradeRunning && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            )}
          </div>
          <div>
            <div className="font-bold text-white text-lg flex items-center gap-3">
              Auto-Trade Bot
              <span className="text-xs font-bold px-2.5 py-1 rounded-full border"
                style={{ background: modeColor + '15', color: modeColor, borderColor: modeColor + '40' }}>
                {modeLabel}
              </span>
            </div>
            <div className="text-sm text-gray-500 mt-1">Tự động giao dịch theo tín hiệu AI</div>
          </div>
          <button onClick={() => setAutoTradePanelOpen(false)} className="ml-auto text-gray-600 hover:text-gray-400 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode selector */}
        <div className="grid grid-cols-3 gap-4 p-5 border-b border-[#1e2535]">
          {([
            { mode: 'off', label: '⛔ DỪNG', color: '#6b7280' },
            { mode: 'simulation', label: '🟡 PAPER TRADE', color: '#f0b90b' },
            { mode: 'live', label: '🔴 LIVE REAL', color: '#f6465d' },
          ] as const).map(({ mode, label, color }) => {
            const active = autoTradeMode === mode;
            return (
              <button key={mode} onClick={() => {
                if (mode === 'live' && !credentials) { toast.error('Cần MEXC API Key!'); return; }
                setAutoTradeMode(mode);
                setAutoTradeRunning(mode !== 'off');
              }}
                className={`py-3.5 rounded-2xl text-sm font-bold transition-all border ${
                  active ? 'text-black shadow-lg' : 'bg-[#0b0e14] text-gray-500 hover:text-gray-300 border-[#2a3045]'
                }`}
                style={active ? { background: color, borderColor: color } : {}}>
                {label}
              </button>
            );
          })}
        </div>

        {/* Kill Switch */}
        {autoTradeMode !== 'off' && (
          <div className="px-6 py-4 bg-red-950/20 border-b border-red-900/30">
            <button onClick={() => { setAutoTradeMode('off'); setAutoTradeRunning(false); toast.success('⛔ Đã dừng Auto-Trade!'); }}
              className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-red-700 to-red-600 text-white rounded-2xl font-bold text-base hover:from-red-600 hover:to-red-500 transition-all shadow-lg shadow-red-900/30">
              <StopCircle className="w-5 h-5" /> KILL SWITCH — Dừng khẩn cấp
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-[#1e2535]">
          {([
            { id: 'status', icon: Activity, label: 'Trạng thái' },
            { id: 'config', icon: Settings2, label: 'Cấu hình' },
            { id: 'logs', icon: Zap, label: `Logs (${autoTradeLogs.length})` },
            { id: 'summary', icon: Activity, label: 'Tổng kết' },
          ] as const).map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setConfigTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-4 text-sm font-bold transition-all ${
                configTab === id ? 'text-[#f0b90b] border-b-2 border-[#f0b90b] bg-[#f0b90b]/5' : 'text-gray-500 hover:text-gray-300'
              }`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        <div className="p-6 max-h-[36rem] overflow-y-auto">

          {/* Status */}
          {configTab === 'status' && (
            <div className="space-y-5">
              <div className="grid grid-cols-4 gap-4">
                {[
                  { label: 'Đang mở', value: activeOrders, color: '#f0b90b' },
                  { label: 'Win Rate', value: `${winRate}%`, color: winRate >= 60 ? '#0ecb81' : '#f6465d' },
                  { label: 'Daily P&L', value: `${dailyPnL >= 0 ? '+' : ''}${dailyPnL.toFixed(1)}$`, color: dailyPnL >= 0 ? '#0ecb81' : '#f6465d' },
                  { label: 'Logs', value: autoTradeLogs.length, color: '#9ca3af' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-[#161b25] rounded-xl p-4 text-center border border-[#2a3045]">
                    <div className="text-xs text-gray-500 mb-2">{label}</div>
                    <div className="font-bold text-lg" style={{ color }}>{value}</div>
                  </div>
                ))}
              </div>

              <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${
                safetyCheck.safe ? 'bg-green-950/30 border-green-900/40 text-green-400' : 'bg-red-950/30 border-red-900/40 text-red-400'
              }`}>
                {safetyCheck.safe ? <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />}
                <div><div className="font-bold mb-1">News Filter</div><div>{safetyCheck.reason}</div></div>
              </div>

              <div className="bg-[#161b25] border border-[#2a3045] rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Đang theo dõi</div>
                <div className="flex flex-wrap gap-2">
                  {autoTradeConfig.scanAllMarket ? (() => {
                    const trackedCount = Object.values(signals).filter(s => s.type !== 'NEUTRAL' && Date.now() - s.timestamp < 3600000).length;
                    return (
                      <span className="text-sm px-3 py-1.5 rounded-full font-mono font-bold bg-purple-900/15 text-purple-400 border border-purple-900/40">
                        ĐỒNG BỘ SCAN ({trackedCount > 0 ? trackedCount : 10} CẶP)
                      </span>
                    );
                  })() : (
                    autoTradeConfig.symbols.map(sym => {
                      const sig = signals[sym];
                      const col = sig?.type === 'LONG' ? '#0ecb81' : sig?.type === 'SHORT' ? '#f6465d' : '#6b7280';
                      return (
                        <span key={sym} className="text-sm px-3 py-1.5 rounded-full font-mono font-bold"
                          style={{ background: col + '15', color: col, border: `1px solid ${col}40` }}>
                          {sym.replace('_USDT', '')}
                          {sig && sig.type !== 'NEUTRAL' && ` ${sig.type}`}
                        </span>
                      );
                    })
                  )}
                </div>
              </div>

              {autoTradeMode === 'off' && (
                <div className="flex items-start gap-3 p-4 bg-blue-950/20 border border-blue-900/30 rounded-xl text-sm text-blue-300">
                  <Shield className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>Bắt đầu với <strong>PAPER TRADE</strong> để test chiến lược không mất tiền. Chuyển LIVE khi hài lòng.</div>
                </div>
              )}
            </div>
          )}

          {/* Config */}
          {configTab === 'config' && (
            <div className="space-y-4">
              {[
                { key: 'minConfidence', label: 'Confidence tối thiểu', min: 50, max: 95, step: 1, color: '#f0b90b', suffix: '%' },
                { key: 'riskPercentPerTrade', label: 'Rủi ro mỗi lệnh', min: 0.5, max: 5, step: 0.5, color: '#f97316', suffix: '%' },
                { key: 'maxConcurrentOrders', label: 'Lệnh đồng thời tối đa', min: 1, max: 10, step: 1, color: '#a855f7', suffix: '' },
              ].map(({ key, label, min, max, step, color, suffix }) => (
                <div key={key}>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-xs text-gray-500">{label}</label>
                    <span className="text-xs font-bold" style={{ color }}>
                      {String(autoTradeConfig[key as keyof typeof autoTradeConfig])}{suffix}
                    </span>
                  </div>
                  <input type="range" min={min} max={max} step={step}
                    value={autoTradeConfig[key as keyof typeof autoTradeConfig] as number}
                    onChange={e => setAutoTradeConfig({ [key]: +e.target.value })}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{ accentColor: color }} />
                </div>
              ))}

              <div>
                <label className="text-xs text-gray-500 mb-1.5 block">Daily Loss Limit (USDT)</label>
                <input type="number" value={autoTradeConfig.dailyLossLimit}
                  onChange={e => setAutoTradeConfig({ dailyLossLimit: +e.target.value })}
                  className="w-full bg-[#0b0e14] border border-[#2a3045] rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-red-500 transition-colors" />
              </div>

              <div className="space-y-2">
                {[
                  { key: 'scanAllMarket', icon: Activity, label: 'Đồng bộ tuyệt đối cùng SCAN', desc: 'Auto Trade tự động đổi hướng bám theo các coin được Scan phát hiện.' },
                  { key: 'newsFilter', icon: Newspaper, label: 'News Filter', desc: 'Dừng khi có tin tức xấu' },
                  { key: 'trailingStop', icon: DollarSign, label: 'Trailing Stop', desc: 'Tự động kéo SL theo lợi nhuận' },
                ].map(({ key, icon: Icon, label, desc }) => (
                  <div key={key} className="flex items-center gap-3 p-3 bg-[#161b25] rounded-xl border border-[#2a3045]">
                    <Icon className="w-4 h-4 text-gray-500" />
                    <div className="flex-1">
                      <div className="text-xs font-medium text-gray-300">{label}</div>
                      <div className="text-[10px] text-gray-600">{desc}</div>
                    </div>
                    <button onClick={() => setAutoTradeConfig({ [key]: !autoTradeConfig[key as keyof typeof autoTradeConfig] })}
                      className="w-9 h-5 rounded-full transition-all relative flex-shrink-0"
                      style={{ background: autoTradeConfig[key as keyof typeof autoTradeConfig] ? '#f0b90b' : '#374151' }}>
                      <div className="absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow"
                        style={{ left: autoTradeConfig[key as keyof typeof autoTradeConfig] ? '17px' : '2px' }} />
                    </button>
                  </div>
                ))}
              </div>

              <button onClick={() => { clearAutoTradeLogs(); toast.success('Đã xóa lịch sử'); }}
                className="w-full py-2 border border-red-900/50 text-red-500 rounded-xl text-xs hover:bg-red-950/30 transition-colors">
                Xóa toàn bộ lịch sử
              </button>
            </div>
          )}

          {/* Logs */}
          {configTab === 'logs' && (
            <div className="space-y-1">
              {autoTradeLogs.length === 0 ? (
                <div className="text-center py-10 text-gray-600 text-sm">Chưa có lệnh auto-trade nào</div>
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
                    <div key={log.id} className={`flex flex-col gap-1 p-2.5 rounded-xl border text-xs transition-colors ${
                      log.status === 'OPENED' ? 'bg-blue-950/20 border-blue-900/30' :
                      log.status === 'TP_HIT' ? 'bg-green-950/20 border-green-900/30' :
                      log.status === 'SL_HIT' ? 'bg-red-950/20 border-red-900/30' :
                      'bg-[#161b25] border-[#2a3045]'
                    }`}>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                          log.mode === 'simulation' ? 'bg-yellow-900/50 text-yellow-400' : 'bg-red-900/50 text-red-400'
                        }`}>{log.mode === 'simulation' ? 'SIM' : 'LIVE'}</span>
                        <span className={`font-bold ${log.side === 'LONG' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{log.side}</span>
                        <span className="text-gray-400 font-mono">{log.symbol.replace('_USDT', '')}</span>
                        <span className="text-gray-600">@{log.entry.toFixed(4)}</span>
                        <span className="text-gray-600 border-l border-gray-700 pl-2">{log.confidence}% conf</span>
                        <span className={`ml-auto font-bold ${
                          log.status === 'TP_HIT' ? 'text-green-400' :
                          log.status === 'SL_HIT' ? 'text-red-400' :
                          log.status === 'OPENED' ? 'text-blue-400' : 'text-gray-600'
                        }`}>{log.status}</span>
                      </div>
                      
                      {/* Lợi nhuận và Action */}
                      <div className="flex items-center justify-between pl-10 mt-1">
                        <div className="flex gap-4">
                            <span className="text-gray-500 font-mono">TP: {log.tp.toFixed(4)}</span>
                            <span className="text-gray-500 font-mono">SL: {log.sl.toFixed(4)}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          {livePnL !== undefined && (
                            <span className={`font-mono font-bold ${livePnL >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                              {livePnL >= 0 ? '+' : ''}{livePnL.toFixed(2)}$
                            </span>
                          )}
                          {log.status === 'OPENED' && (
                            <button
                              onClick={() => {
                                updateAutoTradeLog(log.id, { status: 'CLOSED', pnl: livePnL });
                                toast.success(`Đã đóng lệnh ${log.symbol}`);
                              }}
                              className="text-[10px] bg-red-900/40 text-red-400 hover:bg-red-800/60 px-2.5 py-1 rounded transition-colors"
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
                  <div className="text-center py-10 text-gray-600 text-sm">Chưa có dữ liệu tổng kết</div>
                ) : (
                  months.map(m => {
                    const { trades, wins, pnl } = byMonth[m];
                    const wr = trades > 0 ? Math.round((wins / trades) * 100) : 0;
                    return (
                      <div key={m} className="bg-[#161b25] border border-[#2a3045] rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-bold text-gray-300">Tháng {m}</div>
                          <div className="text-xs text-gray-500 mt-1">{trades} lệnh đã đóng</div>
                        </div>
                        <div className="flex gap-4 text-right">
                          <div>
                            <div className="text-xs text-gray-500">Win Rate</div>
                            <div className={`font-bold ${wr >= 50 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{wr}%</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500">P&L</div>
                            <div className={`font-bold ${pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
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
