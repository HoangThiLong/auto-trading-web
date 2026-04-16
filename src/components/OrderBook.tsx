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
    <div className="flex flex-col h-full bg-[#0b0e14] text-white">
      {/* Tabs */}
      <div className="flex border-b border-[#1e2535] text-sm">
        <button onClick={() => setTab('book')}
          className={`flex-1 py-2 ${tab === 'book' ? 'text-[#f0b90b] border-b-2 border-[#f0b90b]' : 'text-gray-600'}`}>
          Order Book
        </button>
        <button onClick={() => setTab('trades')}
          className={`flex-1 py-2 ${tab === 'trades' ? 'text-[#f0b90b] border-b-2 border-[#f0b90b]' : 'text-gray-600'}`}>
          Giao dịch gần đây
        </button>
      </div>

      {tab === 'book' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-3 text-xs text-gray-600 px-3 py-2 border-b border-[#0f1420]">
            <span>Giá (USDT)</span>
            <span className="text-center">Số lượng</span>
            <span className="text-right">Tổng</span>
          </div>

          {/* Asks (sells - red) reversed */}
          <div className="flex-1 overflow-y-auto">
            {[...asks].reverse().map((ask, i) => {
              const pct = (ask[1] / maxAskVol) * 100;
              return (
                <div key={i} className="relative grid grid-cols-3 text-sm px-3 py-1 hover:bg-[#1e2535]">
                  <div className="absolute inset-0 right-0 flex">
                    <div className="ml-auto h-full bg-red-500/10" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="font-mono text-[#f6465d] z-10">{formatPrice(ask[0])}</span>
                  <span className="font-mono text-gray-400 text-center z-10">{ask[1].toLocaleString()}</span>
                  <span className="font-mono text-gray-600 text-right z-10">{(ask[0] * ask[1] * contractSize).toFixed(2)}</span>
                </div>
              );
            })}
          </div>

          {/* Spread / Current price */}
          <div className="px-3 py-2 border-y border-[#1e2535] bg-[#0f1420]">
            <div className={`text-lg font-bold font-mono ${ticker && ticker.riseFallRate >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
              {ticker ? formatPrice(ticker.lastPrice) : '---'}
            </div>
            {orderBook && asks[0] && bids[0] && (
              <div className="text-xs text-gray-600">
                Spread: {(asks[0][0] - bids[0][0]).toFixed(4)}
              </div>
            )}
          </div>

          {/* Bids (buys - green) */}
          <div className="flex-1 overflow-y-auto">
            {bids.map((bid, i) => {
              const pct = (bid[1] / maxBidVol) * 100;
              return (
                <div key={i} className="relative grid grid-cols-3 text-sm px-3 py-1 hover:bg-[#1e2535]">
                  <div className="absolute inset-0 right-0 flex">
                    <div className="ml-auto h-full bg-green-500/10" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="font-mono text-[#0ecb81] z-10">{formatPrice(bid[0])}</span>
                  <span className="font-mono text-gray-400 text-center z-10">{bid[1].toLocaleString()}</span>
                  <span className="font-mono text-gray-600 text-right z-10">{(bid[0] * bid[1] * contractSize).toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'trades' && (
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 text-xs text-gray-600 px-3 py-2 border-b border-[#0f1420] sticky top-0 bg-[#0b0e14]">
            <span>Giá</span><span className="text-center">Qty</span><span className="text-right">Thời gian</span>
          </div>
          {trades.map((trade, i) => (
            <div key={i} className="grid grid-cols-3 text-sm px-3 py-1 hover:bg-[#1e2535]">
              <span className={`font-mono ${trade.T === 1 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{formatPrice(trade.p)}</span>
              <span className="font-mono text-gray-400 text-center">{trade.v}</span>
              <span className="font-mono text-gray-600 text-right">{formatTime(trade.t)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
