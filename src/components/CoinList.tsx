import React, { useState, useMemo } from 'react';
import { Star } from 'lucide-react';
import { useCoinListState } from '../store/hooks';

const FAVORITES_KEY = 'mexc_pro_favorites';

function loadFavorites(): Set<string> {
  try {
    const stored = localStorage.getItem(FAVORITES_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set(['BTC_USDT', 'ETH_USDT', 'SOL_USDT', 'BNB_USDT', 'XRP_USDT']);
  } catch {
    return new Set(['BTC_USDT', 'ETH_USDT', 'SOL_USDT']);
  }
}

function saveFavorites(favs: Set<string>) {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favs]));
}

function Sparkline({ isUp, width = 44, height = 14 }: { isUp: boolean; width?: number; height?: number }) {
  const points = Array.from({ length: 8 }, (_, i) => {
    const base = isUp ? (i / 7) * 0.6 + 0.2 : 0.8 - (i / 7) * 0.6;
    const noise = Math.sin(i * 2.5) * 0.1 + Math.cos(i * 1.3) * 0.08;
    return Math.max(0.05, Math.min(0.95, base + noise));
  });

  const svgPoints = points
    .map((y, i) => `${(i / (points.length - 1)) * width},${height - y * height}`)
    .join(' ');

  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline
        points={svgPoints}
        fill="none"
        stroke={isUp ? '#34d399' : '#fb7185'}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.9"
      />
    </svg>
  );
}

export default function CoinList() {
  const { tickers, selectedSymbol, setSelectedSymbol, signals } = useCoinListState();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'favorites' | 'all' | 'hot'>('favorites');
  const [favorites, setFavorites] = useState<Set<string>>(loadFavorites);

  const toggleFav = (symbol: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(symbol)) next.delete(symbol);
      else next.add(symbol);
      saveFavorites(next);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let list = tickers.filter((t) => t.symbol.endsWith('_USDT'));
    if (search) list = list.filter((t) => t.symbol.toLowerCase().includes(search.toLowerCase()));
    if (tab === 'favorites') list = list.filter((t) => favorites.has(t.symbol));
    if (tab === 'hot') list = [...list].sort((a, b) => Math.abs(b.riseFallRate) - Math.abs(a.riseFallRate)).slice(0, 20);
    return [...list].sort((a, b) => b.amount24 - a.amount24);
  }, [tickers, search, tab, favorites]);

  const formatPrice = (p: number) => {
    if (p >= 10000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (p >= 1000) return p.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    if (p >= 1) return p.toFixed(4);
    return p.toFixed(6);
  };

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-slate-950 text-slate-100">
      <div className="shrink-0 border-b border-slate-800 p-3">
        <div className="relative">
          <input
            className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 transition-colors focus:border-amber-400 focus:outline-none"
            placeholder="Tìm coin USDT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 border-b border-slate-800 px-2 py-1.5 text-sm">
        {([
          { id: 'favorites', label: '⭐ Yêu thích' },
          { id: 'all', label: 'Tất cả' },
          { id: 'hot', label: '🔥 Hot' },
        ] as const).map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-md px-2.5 py-1.5 whitespace-nowrap transition-colors ${
              tab === item.id ? 'bg-slate-800 text-amber-300' : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_74px] px-3 py-2 text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
        <span>Coin / Price</span>
        <span className="text-right">24h %</span>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {filtered.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-500">
            {tab === 'favorites' ? '⭐ Chưa có coin yêu thích' : 'Không tìm thấy coin'}
          </div>
        )}

        {filtered.map((ticker) => {
          const isUp = ticker.riseFallRate >= 0;
          const isSel = selectedSymbol === ticker.symbol;
          const signal = signals[ticker.symbol];
          const baseCoin = ticker.symbol.replace('_USDT', '');
          const pct = (ticker.riseFallRate * 100).toFixed(2);

          return (
            <div
              key={ticker.symbol}
              onClick={() => setSelectedSymbol(ticker.symbol)}
              className={`grid min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)_74px] items-center gap-2 border-b border-slate-800 px-3 py-2.5 transition-colors ${
                isSel ? 'bg-slate-800/70' : 'hover:bg-slate-900/60'
              }`}
            >
              <button
                onClick={(e) => toggleFav(ticker.symbol, e)}
                className={`rounded p-1 transition-colors ${favorites.has(ticker.symbol) ? 'text-amber-300' : 'text-slate-600 hover:text-slate-400'}`}
                title={favorites.has(ticker.symbol) ? 'Bỏ yêu thích' : 'Thêm yêu thích'}
              >
                <Star className="h-4 w-4" fill={favorites.has(ticker.symbol) ? '#fcd34d' : 'none'} />
              </button>

              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm font-semibold text-slate-100">{baseCoin}</span>
                  {signal && signal.type !== 'NEUTRAL' && (
                    <span
                      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                        signal.type === 'LONG' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-rose-900/40 text-rose-300'
                      }`}
                    >
                      {signal.type}
                    </span>
                  )}
                </div>
                <div className="truncate font-mono text-xs text-slate-400 mt-0.5">{formatPrice(ticker.lastPrice)}</div>
              </div>

              <div className="flex min-w-[74px] flex-col items-end">
                <span className={`font-mono text-sm font-semibold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {isUp ? '+' : ''}
                  {pct}%
                </span>
                <Sparkline isUp={isUp} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-slate-800 py-2.5 text-center text-xs text-slate-500">
        {filtered.length} pairs
      </div>
    </div>
  );
}
