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
    <div className="h-full overflow-auto bg-transparent text-[var(--text-main)]">
      <div className="min-w-[1460px]">
        <table className="w-full border-separate border-spacing-0 text-[13px] leading-5">
          <thead className="coinbase-data-head sticky top-0 z-20 backdrop-blur-xl">
            <tr className="border-b border-[rgba(91,97,110,0.2)] text-[11px] uppercase tracking-[0.08em] text-[#96a2be]">
              <th className="px-3.5 py-2.5 text-left font-semibold">Thời gian</th>
              <th className="px-3.5 py-2.5 text-left font-semibold">Cặp giao dịch & Vị thế</th>
              <th className="px-3.5 py-2.5 text-left font-semibold">Kích thước</th>
              <th className="px-3.5 py-2.5 text-left font-semibold">Giá vào</th>
              <th className="px-3.5 py-2.5 text-left font-semibold">Giá hiện tại</th>
              <th className="px-3.5 py-2.5 text-left font-semibold">Ký quỹ</th>
              <th className="px-3.5 py-2.5 text-left font-semibold">PnL chưa thực hiện</th>
              <th className="px-3.5 py-2.5 text-left font-semibold">TP / SL</th>
              <th className="px-3.5 py-2.5 text-right font-semibold">Thao tác</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[rgba(91,97,110,0.18)]">
            {activeVisualOrders.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-sm font-medium text-[#96a2be]">
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
                    className="coinbase-data-row cursor-pointer border-b border-[rgba(91,97,110,0.16)]"
                    title="Nhấn để chuyển chart sang coin của lệnh"
                  >
                    <td className="px-3.5 py-3 align-middle font-mono text-xs font-medium text-[#c8d4ed]">
                      {formatTime(order.createdAt)}
                    </td>

                    <td className="px-3.5 py-3 align-middle">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-semibold tracking-tight text-[#f5f7ff]">{order.symbol.replace('_', '/')}</span>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-[0.08em] ${order.side === 'LONG' ? 'border-[rgba(14,203,129,0.45)] bg-[rgba(14,203,129,0.12)] text-[#8ff4c6]' : 'border-[rgba(246,70,93,0.45)] bg-[rgba(246,70,93,0.12)] text-[#ffa6b5]'}`}>
                          {order.side}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {sourceBadges(order.source).map((badge) => (
                          <span key={`${order.key}-${badge.label}`} className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-[0.08em] ${badge.tone}`}>
                            {badge.label}
                          </span>
                        ))}
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold tracking-[0.08em] ${sourceToneMap[order.source]}`}>
                          {order.source.replace('_', ' ')}
                        </span>
                      </div>
                    </td>

                    <td className="px-3.5 py-3 align-middle font-mono text-xs">
                      <div className="font-medium text-[#f5f7ff]">Qty: {order.quantity.toFixed(3)}</div>
                      <div className="text-[#9aa6c2]">Lev: {order.leverage}x</div>
                    </td>

                    <td className="px-3.5 py-3 align-middle font-mono text-xs font-medium text-[#dfe8ff]">
                      {order.entry.toFixed(4)}
                    </td>

                    <td className="px-3.5 py-3 align-middle font-mono text-xs">
                      <span className={markPrice === null ? 'text-[#8893ad]' : 'font-medium text-[#8db5ff]'}>
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

                    <td className="px-3.5 py-3 align-middle text-right">
                      {order.cancelable ? (
                        <button
                          id={`pending-order-cancel-${order.key}`}
                          onClick={(event) => handleCancelOrder(order.key, event)}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(246,70,93,0.5)] bg-[rgba(246,70,93,0.14)] px-4 py-1.5 text-xs font-semibold text-[#ffd9de] shadow-[0_8px_18px_rgba(246,70,93,0.28)] transition-all hover:-translate-y-[1px] hover:bg-[rgba(246,70,93,0.24)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60"
                          title="Hủy lệnh"
                        >
                          <X className="h-3.5 w-3.5" />
                          Hủy
                        </button>
                      ) : (
                        <span className="text-xs font-medium text-[#6f7b96]">—</span>
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
