import { useCallback, useMemo, type MouseEvent } from 'react';
import { X } from 'lucide-react';
import type { AutoTradeLog, ContractTicker, PendingOrder } from '../types';
import { useStore } from '../store/useStore';

type PositionSource = 'AUTO_LIVE' | 'AUTO_SIM' | 'MANUAL_LIVE' | 'MANUAL_SIM';

interface VisualOrder {
  key: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  entry: number;
  tp?: number;
  sl?: number;
  quantity: number;
  leverage: number;
  source: PositionSource;
  createdAt: number;
  cancelable: boolean;
}

const sourceToneMap: Record<PositionSource, string> = {
  AUTO_LIVE: 'border-indigo-500/50 bg-indigo-500/20 text-indigo-200',
  AUTO_SIM: 'border-cyan-500/50 bg-cyan-500/20 text-cyan-200',
  MANUAL_LIVE: 'border-emerald-500/50 bg-emerald-500/20 text-emerald-200',
  MANUAL_SIM: 'border-amber-500/50 bg-amber-500/20 text-amber-200',
};

const calcMarginEstimate = (entry: number, quantity: number, leverage: number, contractSize: number) => {
  if (!Number.isFinite(entry) || !Number.isFinite(quantity) || !Number.isFinite(leverage) || leverage <= 0) return 0;
  if (!Number.isFinite(contractSize) || contractSize <= 0) return 0;
  return (entry * quantity * contractSize) / leverage;
};

const calcUnrealizedPnl = (
  side: 'LONG' | 'SHORT',
  entry: number,
  markPrice: number,
  quantity: number,
  contractSize: number,
) => {
  if (!Number.isFinite(entry) || !Number.isFinite(markPrice)) return null;
  if (!Number.isFinite(quantity) || quantity <= 0) return null;
  if (!Number.isFinite(contractSize) || contractSize <= 0) return null;

  const signedDiff = side === 'LONG' ? markPrice - entry : entry - markPrice;
  return signedDiff * quantity * contractSize;
};

const formatSignedMoney = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)} USDT`;

const formatSignedPercent = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;

const resolveMarkPrice = (ticker: ContractTicker | undefined) => {
  if (!ticker) return null;
  if (Number.isFinite(ticker.lastPrice)) return ticker.lastPrice;
  if (Number.isFinite(ticker.fairPrice)) return ticker.fairPrice;
  if (Number.isFinite(ticker.indexPrice)) return ticker.indexPrice;
  return null;
};

const formatTime = (rawTimestamp: number) => {
  const timestamp = rawTimestamp > 1e12 ? rawTimestamp : rawTimestamp * 1000;
  return new Date(timestamp).toLocaleTimeString('vi-VN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const getPnlClass = (value: number | null) => {
  if (value === null || !Number.isFinite(value) || value === 0) return 'text-slate-400';
  return value > 0 ? 'text-emerald-400' : 'text-rose-400';
};

const sourceBadges = (source: PositionSource) => {
  const badges: Array<{ label: 'SIM' | 'LIVE' | 'AI'; tone: string }> = [];

  if (source === 'AUTO_LIVE' || source === 'AUTO_SIM') {
    badges.push({ label: 'AI', tone: 'border-violet-500/50 bg-violet-500/20 text-violet-200' });
  }

  if (source === 'AUTO_SIM' || source === 'MANUAL_SIM') {
    badges.push({ label: 'SIM', tone: 'border-cyan-500/50 bg-cyan-500/20 text-cyan-200' });
  } else {
    badges.push({ label: 'LIVE', tone: 'border-emerald-500/50 bg-emerald-500/20 text-emerald-200' });
  }

  return badges;
};

export default function PendingOrdersPanel() {
  const autoTradeLogs = useStore((state) => state.autoTradeLogs);
  const pendingOrders = useStore((state) => state.pendingOrders);
  const contracts = useStore((state) => state.contracts);
  const tickers = useStore((state) => state.tickers);
  const removeOrder = useStore((state) => state.removeOrder);
  const setSelectedSymbol = useStore((state) => state.setSelectedSymbol);

  const tickerMap = useMemo(() => {
    const map = new Map<string, ContractTicker>();
    tickers.forEach((ticker) => {
      map.set(ticker.symbol, ticker);
    });
    return map;
  }, [tickers]);

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
      .filter((log: AutoTradeLog) => log.status === 'OPENED')
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
      .filter((order: PendingOrder) => order.status === 'PENDING')
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
          source: order.isSimulation ? 'MANUAL_SIM' : 'MANUAL_LIVE',
          createdAt: order.createdAt,
          cancelable: true,
        });
      });

    return merged.sort((a, b) => b.createdAt - a.createdAt);
  }, [autoTradeLogs, pendingOrders]);

  const handleCancelOrder = (orderId: string, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    removeOrder(orderId);
  };

  return (
    <div className="h-full overflow-auto bg-slate-900 text-slate-200">
      <div className="min-w-[1400px]">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur">
            <tr className="border-b border-slate-700/80 text-[11px] uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2 text-left font-semibold">Thời gian</th>
              <th className="px-3 py-2 text-left font-semibold">Cặp giao dịch & Vị thế</th>
              <th className="px-3 py-2 text-left font-semibold">Kích thước</th>
              <th className="px-3 py-2 text-left font-semibold">Giá vào</th>
              <th className="px-3 py-2 text-left font-semibold">Giá hiện tại</th>
              <th className="px-3 py-2 text-left font-semibold">Ký quỹ</th>
              <th className="px-3 py-2 text-left font-semibold">PnL chưa thực hiện</th>
              <th className="px-3 py-2 text-left font-semibold">TP / SL</th>
              <th className="px-3 py-2 text-right font-semibold">Thao tác</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/80">
            {activeVisualOrders.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-sm text-slate-500">
                  Chưa có lệnh đang hoạt động.
                </td>
              </tr>
            ) : (
              activeVisualOrders.map((order) => {
                const ticker = tickerMap.get(order.symbol);
                const markPrice = resolveMarkPrice(ticker);
                const contractSize = getContractSizeBySymbol(order.symbol);
                const margin = calcMarginEstimate(order.entry, order.quantity, order.leverage, contractSize);
                const unrealizedPnl = markPrice === null
                  ? null
                  : calcUnrealizedPnl(order.side, order.entry, markPrice, order.quantity, contractSize);
                const unrealizedPnlPercent = unrealizedPnl !== null && margin > 0
                  ? (unrealizedPnl / margin) * 100
                  : null;

                return (
                  <tr
                    key={order.key}
                    onClick={() => setSelectedSymbol(order.symbol)}
                    className="cursor-pointer transition-colors hover:bg-slate-800/50"
                    title="Nhấn để chuyển chart sang coin của lệnh"
                  >
                    <td className="px-3 py-2.5 align-middle font-mono text-xs text-slate-300">
                      {formatTime(order.createdAt)}
                    </td>

                    <td className="px-3 py-2.5 align-middle">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-100">{order.symbol.replace('_', '/')}</span>
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${order.side === 'LONG' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-rose-900/40 text-rose-300'}`}>
                          {order.side}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {sourceBadges(order.source).map((badge) => (
                          <span key={`${order.key}-${badge.label}`} className={`inline-flex rounded border px-1.5 py-0.5 text-[9px] font-semibold ${badge.tone}`}>
                            {badge.label}
                          </span>
                        ))}
                        <span className={`inline-flex rounded border px-1.5 py-0.5 text-[9px] font-semibold ${sourceToneMap[order.source]}`}>
                          {order.source.replace('_', ' ')}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-2.5 align-middle font-mono text-xs">
                      <div className="text-slate-100">Qty: {order.quantity.toFixed(3)}</div>
                      <div className="text-slate-400">Lev: {order.leverage}x</div>
                    </td>

                    <td className="px-3 py-2.5 align-middle font-mono text-xs text-slate-100">
                      {order.entry.toFixed(4)}
                    </td>

                    <td className="px-3 py-2.5 align-middle font-mono text-xs">
                      <span className={markPrice === null ? 'text-slate-500' : 'text-sky-300'}>
                        {markPrice === null ? '—' : markPrice.toFixed(4)}
                      </span>
                    </td>

                    <td className="px-3 py-2.5 align-middle font-mono text-xs text-amber-300">
                      {margin.toFixed(2)} USDT
                    </td>

                    <td className="px-3 py-2.5 align-middle font-mono text-xs leading-5">
                      <div className={getPnlClass(unrealizedPnl)}>
                        {unrealizedPnl === null ? '—' : formatSignedMoney(unrealizedPnl)}
                      </div>
                      <div className={getPnlClass(unrealizedPnlPercent)}>
                        {unrealizedPnlPercent === null ? '—' : formatSignedPercent(unrealizedPnlPercent)}
                      </div>
                    </td>

                    <td className="px-3 py-2.5 align-middle font-mono text-xs leading-5">
                      <div className="text-emerald-300">TP: {typeof order.tp === 'number' ? order.tp.toFixed(4) : '—'}</div>
                      <div className="text-rose-300">SL: {typeof order.sl === 'number' ? order.sl.toFixed(4) : '—'}</div>
                    </td>

                    <td className="px-3 py-2.5 align-middle text-right">
                      {order.cancelable ? (
                        <button
                          id={`pending-order-cancel-${order.key}`}
                          onClick={(event) => handleCancelOrder(order.key, event)}
                          className="inline-flex items-center gap-1.5 rounded-md bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white shadow-[0_6px_16px_rgba(225,29,72,0.35)] transition-colors hover:bg-red-700"
                          title="Hủy lệnh"
                        >
                          <X className="h-3.5 w-3.5" />
                          Hủy
                        </button>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
