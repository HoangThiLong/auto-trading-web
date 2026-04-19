import React, { useState, useMemo } from 'react';
import { Star, Search } from 'lucide-react';
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

function Sparkline({ isUp, width = 48, height = 16 }: { isUp: boolean; width?: number; height?: number }) {
  const points = Array.from({ length: 8 }, (_, i) => {
    const base = isUp ? (i / 7) * 0.6 + 0.2 : 0.8 - (i / 7) * 0.6;
    const noise = Math.sin(i * 2.5) * 0.1 + Math.cos(i * 1.3) * 0.08;
    return Math.max(0.05, Math.min(0.95, base + noise));
  });

  const svgPoints = points
    .map((y, i) => `${(i / (points.length - 1)) * width},${height - y * height}`)
    .join(' ');

  const gradientId = isUp ? 'sparkUp' : 'sparkDown';
  const color = isUp ? 'var(--color-success)' : 'var(--color-danger)';

  return (
    <svg width={width} height={height} className="shrink-0">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        points={`0,${height} ${svgPoints} ${width},${height}`}
        fill={`url(#${gradientId})`}
      />
      <polyline
        points={svgPoints}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
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
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-[var(--bg-panel)] text-[var(--text-main)]">
      {/* Search */}
      <div className="shrink-0 border-b border-[var(--border-soft)] p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-dim)]" />
          <input
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] pl-9 pr-3 py-2.5 text-sm text-[var(--text-main)] placeholder-[var(--text-dim)] transition-all focus:border-[var(--color-brand)] focus:shadow-[0_0_0_3px_rgba(0,82,255,0.12)] focus:outline-none"
            placeholder="Tìm coin USDT..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex shrink-0 items-center gap-0.5 border-b border-[var(--border-soft)] px-2 py-1.5 text-sm">
        {([
          { id: 'favorites', label: '⭐ Yêu thích' },
          { id: 'all', label: 'Tất cả' },
          { id: 'hot', label: '🔥 Hot' },
        ] as const).map((item) => (
          <button
            key={item.id}
            onClick={() => setTab(item.id)}
            className={`relative rounded-lg px-3 py-2 whitespace-nowrap transition-all text-xs font-semibold ${
              tab === item.id
                ? 'text-[var(--color-brand)] bg-[var(--color-brand-dim)]'
                : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-surface-soft)]'
            }`}
          >
            {item.label}
            {tab === item.id && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-[var(--color-brand)]" />
            )}
          </button>
        ))}
      </div>

      {/* Column Header */}
      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_80px] px-3 py-2 text-[10px] uppercase tracking-wider text-[var(--text-dim)] font-semibold border-b border-[var(--border-soft)]">
        <span>Coin / Price</span>
        <span className="text-right">24h %</span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {filtered.length === 0 && (
          <div className="py-10 text-center text-xs text-[var(--text-dim)]">
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
              className={`grid min-w-0 cursor-pointer grid-cols-[auto_minmax(0,1fr)_80px] items-center gap-2 border-b border-[var(--border-soft)] px-3 py-3 transition-all ${
                isSel
                  ? 'bg-[var(--color-brand-dim)] shadow-[inset_3px_0_0_var(--color-brand)]'
                  : 'hover:bg-[var(--bg-surface-soft)]'
              }`}
            >
              <button
                onClick={(e) => toggleFav(ticker.symbol, e)}
                className={`rounded-lg p-1 transition-all ${favorites.has(ticker.symbol) ? 'text-[var(--color-warning)]' : 'text-[var(--text-dim)] hover:text-[var(--text-muted)]'}`}
                title={favorites.has(ticker.symbol) ? 'Bỏ yêu thích' : 'Thêm yêu thích'}
              >
                <Star className="h-3.5 w-3.5" fill={favorites.has(ticker.symbol) ? 'currentColor' : 'none'} />
              </button>

              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-sm font-bold text-[var(--text-main)]">{baseCoin}</span>
                  {signal && signal.type !== 'NEUTRAL' && (
                    <span
                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold leading-none ${
                        signal.type === 'LONG' ? 'bg-[var(--color-success-dim)] text-[var(--color-success)]' : 'bg-[var(--color-danger-dim)] text-[var(--color-danger)]'
                      }`}
                    >
                      {signal.type}
                    </span>
                  )}
                </div>
                <div className="truncate font-mono text-xs text-[var(--text-muted)] mt-0.5">{formatPrice(ticker.lastPrice)}</div>
              </div>

              <div className="flex min-w-[80px] flex-col items-end gap-1">
                <span className={`font-mono text-sm font-bold ${
                  isUp ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
                }`}>
                  {isUp ? '+' : ''}
                  {pct}%
                </span>
                <Sparkline isUp={isUp} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="shrink-0 border-t border-[var(--border-soft)] py-2.5 text-center text-[10px] text-[var(--text-dim)] font-medium">
        {filtered.length} pairs
      </div>
    </div>
  );
}
