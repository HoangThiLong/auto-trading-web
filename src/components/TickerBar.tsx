import { TrendingUp, TrendingDown, Activity, Zap } from 'lucide-react';
import { fetchFundingRate } from '../services/mexcApi';
import { useEffect, useState } from 'react';
import type { FundingRate } from '../types';
import { useSelectedSymbol, useSelectedSymbolTicker } from '../store/hooks';

export default function TickerBar() {
  const selectedSymbol = useSelectedSymbol();
  const ticker = useSelectedSymbolTicker();
  const [funding, setFunding] = useState<FundingRate | null>(null);

  useEffect(() => {
    if (!selectedSymbol) return;
    fetchFundingRate(selectedSymbol).then(f => { if (f) setFunding(f); });
    const id = setInterval(() => {
      fetchFundingRate(selectedSymbol).then(f => { if (f) setFunding(f); });
    }, 30000);
    return () => clearInterval(id);
  }, [selectedSymbol]);

  const isUp = (ticker?.riseFallRate ?? 0) >= 0;

  const formatNum = (n: number) => {
    if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
    return n.toFixed(2);
  };

  const formatPrice = (p: number) =>
    p >= 1000
      ? p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : p >= 1 ? p.toFixed(4) : p.toFixed(6);

  const nextFundingAt = funding?.nextSettleTime ?? funding?.nextFundingTime;
  const nextFundingMs = nextFundingAt ? nextFundingAt - Date.now() : null;
  const nextFundingStr = nextFundingMs && nextFundingMs > 0
    ? `${Math.floor(nextFundingMs / 3600000).toString().padStart(2, '0')}:${Math.floor((nextFundingMs % 3600000) / 60000).toString().padStart(2, '0')}`
    : '--:--';

  const baseCoin = selectedSymbol.replace('_USDT', '');

  if (!ticker) {
    return (
      <div className="h-[72px] bg-[var(--bg-panel)] backdrop-blur-xl border-b border-[var(--border-soft)] flex items-center px-0 shrink-0 animate-pulse">
        <div className="flex items-center gap-4 px-6 shrink-0 h-full border-r border-[var(--border-soft)]">
          <div className="w-10 h-10 rounded-full bg-[var(--bg-surface-soft)] shrink-0"></div>
          <div>
            <div className="w-24 h-5 bg-[var(--bg-surface-soft)] rounded mb-2"></div>
            <div className="w-20 h-4 bg-[var(--bg-surface-soft)] rounded"></div>
          </div>
        </div>
        <div className="px-6 shrink-0 h-full flex flex-col justify-center border-r border-[var(--border-soft)]">
          <div className="w-28 h-7 bg-[var(--bg-surface-soft)] rounded mb-1.5"></div>
          <div className="w-20 h-4 bg-[var(--bg-surface-soft)] rounded"></div>
        </div>
        <div className="flex items-center gap-8 px-6 overflow-x-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="shrink-0">
              <div className="w-14 h-4 bg-[var(--bg-surface-soft)] rounded mb-2"></div>
              <div className="w-20 h-5 bg-[var(--bg-surface-soft)] rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-[72px] bg-[var(--bg-panel)] backdrop-blur-xl border-b border-[var(--border-soft)] flex items-center px-0 overflow-x-auto shrink-0 z-10 relative shadow-[0_4px_24px_rgba(0,0,0,0.2)]">
      {/* Symbol + Price block */}
      <div className="flex items-center gap-4 px-6 shrink-0 h-full border-r border-[var(--border-soft)] bg-[var(--bg-surface-soft)] bg-opacity-30">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--color-brand)] to-[#0033a0] flex items-center justify-center shrink-0 text-white font-bold text-sm shadow-[0_0_12px_var(--color-brand-dim)] border border-[var(--color-brand)] border-opacity-30">
          {baseCoin.slice(0, 2)}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-bold text-[var(--text-main)] text-lg tracking-tight">{baseCoin}/USDT</span>
            <span className="text-[10px] uppercase bg-[var(--color-brand-dim)] text-[var(--color-brand)] px-2 py-0.5 rounded font-bold border border-[var(--color-brand)] border-opacity-20 shadow-sm">Perp</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)] tracking-wide uppercase">
            <Activity className="w-3.5 h-3.5 text-[var(--color-success)] animate-pulse shadow-[0_0_8px_var(--color-success-dim)] rounded-full" />
            LIVE &bull; MEXC Futures
          </div>
        </div>
      </div>

      {/* Price block */}
      <div className="px-6 shrink-0 h-full flex flex-col justify-center border-r border-[var(--border-soft)] min-w-[180px]">
        <div className={`text-2xl font-mono font-bold tracking-tight leading-tight ${isUp ? 'text-[var(--color-success)] drop-shadow-[0_0_8px_var(--color-success-dim)]' : 'text-[var(--color-danger)] drop-shadow-[0_0_8px_var(--color-danger-dim)]'}`}>
          {formatPrice(ticker.lastPrice)}
        </div>
        <div className={`flex items-center gap-1.5 text-sm font-semibold mt-0.5`}>
          {isUp ? <TrendingUp className="w-4 h-4 text-[#0ecb81]" /> : <TrendingDown className="w-4 h-4 text-[#f6465d]" />}
          <span className={`px-1.5 py-0.5 rounded text-xs ${isUp ? 'bg-[#0ecb81]/15 text-[#0ecb81]' : 'bg-[#f6465d]/15 text-[#f6465d]'}`}>
            {isUp ? '+' : ''}{(ticker.riseFallRate * 100).toFixed(2)}%
          </span>
          <span className={`font-medium text-xs ml-1 bg-[var(--bg-surface-soft)] px-1.5 py-[2px] rounded ${isUp ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
            {isUp ? '+' : ''}{(ticker.riseFallValue ?? 0).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-8 px-6 overflow-x-auto hide-scrollbar">
        {[
          { label: '24h Change', value: `${(ticker.riseFallRate * 100).toFixed(2)}%`, color: isUp ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]' },
          { label: '24h High', value: formatPrice(ticker.high24Price), color: 'text-[var(--color-success)]' },
          { label: '24h Low', value: formatPrice(ticker.lower24Price), color: 'text-[var(--color-danger)]' },
          { label: '24h Vol (USDT)', value: formatNum(ticker.amount24), color: 'text-[var(--text-main)]' },
          { label: 'Open Interest', value: formatNum(ticker.holdVol), color: 'text-[var(--color-brand)]' },
          { label: 'Index', value: formatPrice(ticker.indexPrice), color: 'text-[var(--text-dim)]' },
          { label: 'Fair', value: formatPrice(ticker.fairPrice), color: 'text-[var(--text-dim)]' },
        ].map(({ label, value, color }) => (
          <div key={label} className="shrink-0 flex flex-col justify-center">
            <div className="text-[11px] font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wider">{label}</div>
            <div className={`text-[15px] font-mono font-semibold ${color}`}>{value}</div>
          </div>
        ))}

        {/* Funding rate */}
        {funding && (
          <div className="shrink-0 flex items-center gap-4 bg-[var(--bg-card)] rounded-xl px-4 py-2.5 border border-[var(--border-soft)] shadow-sm ml-2">
            <div className="w-8 h-8 rounded-full bg-[var(--color-warning-dim)] flex flex-col justify-center items-center shrink-0 text-[var(--color-warning)]">
              <Zap className="w-4 h-4 fill-[currentColor]" />
            </div>
            <div>
              <div className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Funding</div>
              <div className={`text-[13px] font-mono font-bold ${funding.fundingRate >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                {(funding.fundingRate * 100).toFixed(4)}%
              </div>
            </div>
            <div className="w-px h-8 bg-[var(--border-soft)] mx-1"></div>
            <div>
              <div className="text-[10px] font-medium text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Countdown</div>
              <div className="text-[13px] text-[var(--text-main)] font-mono font-semibold bg-[var(--bg-surface-soft)] px-1.5 rounded">
                {nextFundingStr}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
