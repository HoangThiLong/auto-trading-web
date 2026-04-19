import { useEffect, useState, useCallback } from 'react';
import { fetchOrderBook, fetchRecentTrades } from '../services/mexcApi';
import type { OrderBook as OrderBookType, RecentTrade } from '../types';
import { useOrderBookState } from '../store/hooks';

export default function OrderBook() {
  const { selectedSymbol, ticker, contracts } = useOrderBookState();
  const [orderBook, setOrderBook] = useState<OrderBookType | null>(null);
  const [trades, setTrades] = useState<RecentTrade[]>([]);
  const [tab, setTab] = useState<'book' | 'trades'>('book');

  const loadData = useCallback(async () => {
    if (!selectedSymbol) return;
    const [book, trd] = await Promise.all([
      fetchOrderBook(selectedSymbol, 15),
      fetchRecentTrades(selectedSymbol, 30),
    ]);
    if (book) setOrderBook(book);
    if (trd) setTrades(trd);
  }, [selectedSymbol]);

  useEffect(() => { loadData(); }, [loadData]);

  // WebSocket subscriptions for OrderBook and Deals
  useEffect(() => {
    let unsubDepth = () => {};
    let unsubDeal = () => {};

    import('../services/mexcApi').then(({ mexcWs }) => {
      mexcWs.connect();
      unsubDepth = mexcWs.subscribeDepth(selectedSymbol, (msg) => {
        if (msg.symbol && msg.symbol !== selectedSymbol) return;
        if (msg.data && (msg.data.asks || msg.data.bids)) {
          setOrderBook((prev) => {
            if (!prev) return prev;
            // Simple merge for UI purposes
            const newAsks = [...msg.data.asks || [], ...prev.asks].sort((a, b) => a[0] - b[0]).slice(0, 15);
            const newBids = [...msg.data.bids || [], ...prev.bids].sort((a, b) => b[0] - a[0]).slice(0, 15);
            return { ...prev, asks: newAsks, bids: newBids };
          });
        }
      });

      unsubDeal = mexcWs.subscribeDeals(selectedSymbol, (msg) => {
        if (msg.symbol && msg.symbol !== selectedSymbol) return;
        if (msg.data && Array.isArray(msg.data)) {
          setTrades((prev) => {
            const newTrades = msg.data.map((d: any) => ({
              p: d.p, v: d.v, T: d.T, t: d.t || Date.now()
            }));
            return [...newTrades, ...prev].slice(0, 40);
          });
        }
      });
    });

    return () => {
      unsubDepth();
      unsubDeal();
    };
  }, [selectedSymbol]);

  const formatPrice = (p: number) => p >= 1000 ? p.toFixed(1) : p >= 1 ? p.toFixed(4) : p.toFixed(6);
  const formatTime = (t: number) => {
    const d = new Date(t);
    return `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}:${d.getSeconds().toString().padStart(2,'0')}`;
  };

  const asks = orderBook?.asks?.slice(0, 12) || [];
  const bids = orderBook?.bids?.slice(0, 12) || [];
  const maxAskVol = Math.max(...asks.map(a => a[1]), 1);
  const maxBidVol = Math.max(...bids.map(b => b[1]), 1);
  const contractSize = contracts.find((contract) => contract.symbol === selectedSymbol)?.contractSize ?? 1;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)] text-[var(--text-main)] min-w-0">
      {/* Tabs */}
      <div className="flex shrink-0 items-center border-b border-[var(--border-soft)] px-2 py-1.5 text-sm gap-0.5">
        <button onClick={() => setTab('book')}
          className={`relative flex-1 py-1.5 rounded-lg transition-all font-semibold text-xs whitespace-nowrap ${tab === 'book' ? 'text-[var(--color-brand)] bg-[var(--color-brand-dim)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]'}`}>
          Order Book
          {tab === 'book' && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[var(--color-brand)]" />
          )}
        </button>
        <button onClick={() => setTab('trades')}
          className={`relative flex-1 py-1.5 rounded-lg transition-all font-semibold text-xs whitespace-nowrap ${tab === 'trades' ? 'text-[var(--color-brand)] bg-[var(--color-brand-dim)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]'}`}>
          Giao dịch
          {tab === 'trades' && (
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[var(--color-brand)]" />
          )}
        </button>
      </div>

      {tab === 'book' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-3 shrink-0 text-[10px] uppercase font-semibold tracking-wide text-[var(--text-muted)] px-3 py-2 border-b border-[var(--border-soft)]">
            <span>Giá (USDT)</span>
            <span className="text-center">Số lượng</span>
            <span className="text-right">Tổng</span>
          </div>

          {/* Asks (sells - red) reversed */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col-reverse">
            {[...asks].reverse().map((ask, i) => {
              const pct = (ask[1] / maxAskVol) * 100;
              return (
                <div key={i} className="relative grid grid-cols-3 text-[13px] px-3 py-[3px] hover:bg-[var(--bg-surface-soft)] cursor-pointer">
                  <div className="absolute inset-0 right-0 flex pointer-events-none">
                    <div className="ml-auto h-full bg-[var(--color-danger)] opacity-10 transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="font-mono font-bold text-[var(--color-danger)] z-10">{formatPrice(ask[0])}</span>
                  <span className="font-mono text-[var(--text-secondary)] text-center z-10">{ask[1].toLocaleString()}</span>
                  <span className="font-mono text-[var(--text-dim)] text-right z-10">{(ask[0] * ask[1] * contractSize).toFixed(2)}</span>
                </div>
              );
            })}
          </div>

          {/* Spread / Current price */}
          <div className="px-3 py-2.5 shrink-0 border-y border-[var(--border-soft)] bg-[var(--bg-card)] flex items-center justify-between shadow-[0_0_12px_rgba(0,0,0,0.1)] z-10">
            <div className={`text-xl font-bold font-mono tracking-tight drop-shadow-sm ${ticker && ticker.riseFallRate >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
              {ticker ? formatPrice(ticker.lastPrice) : '---'}
              {ticker && (
                <span className="text-xs ml-2 font-semibold bg-[currentColor] bg-opacity-10 px-1.5 py-0.5 rounded align-top">
                  {ticker.riseFallRate >= 0 ? '+' : ''}{(ticker.riseFallRate * 100).toFixed(2)}%
                </span>
              )}
            </div>
            {orderBook && asks[0] && bids[0] && (
              <div className="text-[10px] text-[var(--text-muted)] font-mono font-medium bg-[var(--bg-surface-soft)] px-2 py-0.5 rounded">
                Spread: {(asks[0][0] - bids[0][0]).toFixed(4)}
              </div>
            )}
          </div>

          {/* Bids (buys - green) */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            {bids.map((bid, i) => {
              const pct = (bid[1] / maxBidVol) * 100;
              return (
                <div key={i} className="relative grid grid-cols-3 text-[13px] px-3 py-[3px] hover:bg-[var(--bg-surface-soft)] cursor-pointer">
                  <div className="absolute inset-0 right-0 flex pointer-events-none">
                    <div className="ml-auto h-full bg-[var(--color-success)] opacity-10 transition-all duration-300" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="font-mono font-bold text-[var(--color-success)] z-10">{formatPrice(bid[0])}</span>
                  <span className="font-mono text-[var(--text-secondary)] text-center z-10">{bid[1].toLocaleString()}</span>
                  <span className="font-mono text-[var(--text-dim)] text-right z-10">{(bid[0] * bid[1] * contractSize).toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'trades' && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="grid grid-cols-3 text-[10px] uppercase font-semibold tracking-wide text-[var(--text-muted)] px-3 py-2 border-b border-[var(--border-soft)] sticky top-0 bg-[var(--bg-panel)] z-20 backdrop-blur-md">
            <span>Giá</span><span className="text-center">Qty</span><span className="text-right">Thời gian</span>
          </div>
          {trades.map((trade, i) => (
            <div key={i} className="grid grid-cols-3 text-[13px] px-3 py-1.5 hover:bg-[var(--bg-surface-soft)] border-b border-[var(--border-soft)] border-opacity-50">
              <span className={`font-mono font-bold ${trade.T === 1 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>{formatPrice(trade.p)}</span>
              <span className="font-mono text-[var(--text-secondary)] text-center">{trade.v}</span>
              <span className="font-mono text-[var(--text-dim)] text-right">{formatTime(trade.t)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
