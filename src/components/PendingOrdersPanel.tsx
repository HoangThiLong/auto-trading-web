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
  intentId?: string;
}

const sourceToneMap: Record<PositionSource, string> = {
  AUTO_LIVE: 'border-[rgba(0,82,255,0.45)] bg-[rgba(0,82,255,0.12)] text-[#93b7ff]',
  AUTO_SIM: 'border-[rgba(87,139,250,0.45)] bg-[rgba(87,139,250,0.12)] text-[#b8d0ff]',
  MANUAL_LIVE: 'border-[rgba(14,203,129,0.45)] bg-[rgba(14,203,129,0.12)] text-[#8cf2c6]',
  MANUAL_SIM: 'border-[rgba(240,185,11,0.45)] bg-[rgba(240,185,11,0.12)] text-[#ffd770]',
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
  if (value === null || !Number.isFinite(value) || value === 0) return 'text-[#9aa6c2]';
  return value > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]';
};

const sourceBadges = (source: PositionSource) => {
  const badges: Array<{ label: 'SIM' | 'LIVE' | 'AI'; tone: string }> = [];

  if (source === 'AUTO_LIVE' || source === 'AUTO_SIM') {
    badges.push({ label: 'AI', tone: 'border-[rgba(168,85,247,0.45)] bg-[rgba(168,85,247,0.14)] text-[#ddb7ff]' });
  }

  if (source === 'AUTO_SIM' || source === 'MANUAL_SIM') {
    badges.push({ label: 'SIM', tone: 'border-[rgba(87,139,250,0.45)] bg-[rgba(87,139,250,0.12)] text-[#b9d2ff]' });
  } else {
    badges.push({ label: 'LIVE', tone: 'border-[rgba(14,203,129,0.45)] bg-[rgba(14,203,129,0.12)] text-[#95f4ca]' });
  }

  return badges;
};

export default function PendingOrdersPanel() {
  const autoTradeLogs = useStore((state) => state.autoTradeLogs);
  const pendingOrders = useStore((state) => state.pendingOrders);
  const contracts = useStore((state) => state.contracts);
  const tickers = useStore((state) => state.tickers);
  const removeOrder = useStore((state) => state.removeOrder);
  const updateAutoTradeLog = useStore((state) => state.updateAutoTradeLog);
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
          cancelable: true,
          intentId: log.intentId,
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
          intentId: order.intentId,
        });
      });

    return merged.sort((a, b) => b.createdAt - a.createdAt);
  }, [autoTradeLogs, pendingOrders]);

  const handleCancelOrder = (order: VisualOrder, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    if (order.source === 'AUTO_LIVE' || order.source === 'AUTO_SIM') {
      updateAutoTradeLog(order.key, { status: 'CLOSED' });

      if (order.intentId) {
        pendingOrders
          .filter((pendingOrder) => pendingOrder.intentId === order.intentId && pendingOrder.status === 'PENDING')
          .forEach((pendingOrder) => removeOrder(pendingOrder.id));
      }

      return;
    }

    removeOrder(order.key);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--bg-panel)] text-[var(--text-main)]">
      <div className="coinbase-surface-soft mb-3 rounded-2xl border border-[var(--border)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
            Pending Orders Matrix
          </h2>
          <span className="rounded-full border border-[rgba(0,82,255,0.4)] bg-[var(--color-brand-dim)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--accent-soft)]">
            {activeVisualOrders.length} Active
          </span>
          <span className="rounded-full border border-[rgba(139,92,246,0.4)] bg-[rgba(139,92,246,0.12)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#dcc0ff]">
            {activeVisualOrders.filter((order) => order.source === 'AUTO_LIVE' || order.source === 'AUTO_SIM').length} Auto
          </span>
          <span className="rounded-full border border-[rgba(255,184,46,0.4)] bg-[var(--color-warning-dim)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[#ffd87a]">
            {activeVisualOrders.filter((order) => order.source === 'MANUAL_LIVE' || order.source === 'MANUAL_SIM').length} Manual
          </span>
        </div>
      </div>

      <div className="coinbase-surface relative flex-1 overflow-auto rounded-2xl">
        <div className="min-w-[1240px]">
          <table className="w-full border-separate border-spacing-0 text-[13px] leading-5">
            <thead className="coinbase-data-head sticky top-0 z-30 backdrop-blur-xl">
              <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-[0.1em] text-[var(--text-muted)]">
                <th className="px-3.5 py-3 text-left font-semibold">Thời gian</th>
                <th className="px-3.5 py-3 text-left font-semibold">Cặp giao dịch & Vị thế</th>
                <th className="px-3.5 py-3 text-left font-semibold">Kích thước</th>
                <th className="px-3.5 py-3 text-left font-semibold">Giá vào</th>
                <th className="px-3.5 py-3 text-left font-semibold">Giá hiện tại</th>
                <th className="px-3.5 py-3 text-left font-semibold">Ký quỹ</th>
                <th className="px-3.5 py-3 text-left font-semibold">PnL chưa thực hiện</th>
                <th className="px-3.5 py-3 text-left font-semibold">TP / SL</th>
                <th className="sticky right-0 z-40 bg-[rgba(10,13,26,0.96)] px-3.5 py-3 text-right font-semibold">
                  Thao tác
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-[var(--border-soft)]">
              {activeVisualOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-sm font-medium text-[var(--text-secondary)]">
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
                      className="coinbase-data-row cursor-pointer border-b border-[var(--border-soft)]"
                      title="Nhấn để chuyển chart sang coin của lệnh"
                    >
                      <td className="px-3.5 py-3 align-middle font-mono text-xs font-medium text-[#d7e2fb]">
                        {formatTime(order.createdAt)}
                      </td>

                      <td className="px-3.5 py-3 align-middle">
                        <div className="flex items-center gap-2.5">
                          <span className="text-sm font-semibold tracking-tight text-[var(--text-main)]">
                            {order.symbol.replace('_', '/')}
                          </span>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] ${order.side === 'LONG' ? 'border-[rgba(0,230,138,0.45)] bg-[var(--color-success-dim)] text-[var(--color-success)]' : 'border-[rgba(255,77,106,0.45)] bg-[var(--color-danger-dim)] text-[var(--color-danger)]'}`}
                          >
                            {order.side}
                          </span>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {sourceBadges(order.source).map((badge) => (
                            <span
                              key={`${order.key}-${badge.label}`}
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-[0.08em] ${badge.tone}`}
                            >
                              {badge.label}
                            </span>
                          ))}
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-[0.08em] ${sourceToneMap[order.source]}`}
                          >
                            {order.source.replace('_', ' ')}
                          </span>
                        </div>
                      </td>

                      <td className="px-3.5 py-3 align-middle font-mono text-xs">
                        <div className="font-medium text-[var(--text-main)]">Qty: {order.quantity.toFixed(3)}</div>
                        <div className="text-[var(--text-muted)]">Lev: {order.leverage}x</div>
                      </td>

                      <td className="px-3.5 py-3 align-middle font-mono text-xs font-medium text-[#dfe8ff]">
                        {order.entry.toFixed(4)}
                      </td>

                      <td className="px-3.5 py-3 align-middle font-mono text-xs">
                        <span className={markPrice === null ? 'text-[var(--text-muted)]' : 'font-medium text-[#9dc0ff]'}>
                          {markPrice === null ? '—' : markPrice.toFixed(4)}
                        </span>
                      </td>

                      <td className="px-3.5 py-3 align-middle font-mono text-xs font-medium text-[#ffd979]">
                        {margin.toFixed(2)} USDT
                      </td>

                      <td className="px-3.5 py-3 align-middle font-mono text-xs leading-5">
                        <div className={getPnlClass(unrealizedPnl)}>
                          {unrealizedPnl === null ? '—' : formatSignedMoney(unrealizedPnl)}
                        </div>
                        <div className={getPnlClass(unrealizedPnlPercent)}>
                          {unrealizedPnlPercent === null ? '—' : formatSignedPercent(unrealizedPnlPercent)}
                        </div>
                      </td>

                      <td className="px-3.5 py-3 align-middle font-mono text-xs leading-5">
                        <div className="text-[var(--color-success)]">TP: {typeof order.tp === 'number' ? order.tp.toFixed(4) : '—'}</div>
                        <div className="text-[var(--color-danger)]">SL: {typeof order.sl === 'number' ? order.sl.toFixed(4) : '—'}</div>
                      </td>

                      <td className="sticky right-0 z-10 bg-[rgba(8,12,24,0.95)] px-3.5 py-3 align-middle text-right shadow-[-10px_0_18px_rgba(3,7,18,0.45)]">
                        <button
                          id={`pending-order-cancel-${order.key}`}
                          onClick={(event) => handleCancelOrder(order, event)}
                          className="inline-flex min-w-[92px] items-center justify-center gap-1.5 rounded-xl border border-[rgba(255,77,106,0.45)] bg-[var(--color-danger)] px-4 py-2 text-sm font-extrabold text-white shadow-[0_10px_22px_rgba(255,77,106,0.35)] transition-all hover:-translate-y-[1px] hover:brightness-110 active:translate-y-0 focus-visible:ring-2 focus-visible:ring-rose-300/80"
                          title="Hủy lệnh"
                        >
                          <X className="h-4 w-4" />
                          Hủy
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
