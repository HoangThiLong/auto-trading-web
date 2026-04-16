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

  const nextFundingMs = funding?.nextSettleTime ? funding.nextSettleTime - Date.now() : null;
  const nextFundingStr = nextFundingMs && nextFundingMs > 0
    ? `${Math.floor(nextFundingMs / 3600000).toString().padStart(2, '0')}:${Math.floor((nextFundingMs % 3600000) / 60000).toString().padStart(2, '0')}`
    : '--:--';

  const baseCoin = selectedSymbol.replace('_USDT', '');

  if (!ticker) {
    return (
      <div className="h-16 bg-[#0b0e14] border-b border-[#1e2535] flex items-center gap-0 px-0 overflow-x-auto shrink-0 animate-pulse">
        <div className="flex items-center gap-4 px-5 shrink-0 h-full border-r border-[#1e2535]">
          <div className="w-8 h-8 rounded-full bg-[#161b25] shrink-0"></div>
          <div>
            <div className="w-24 h-5 bg-[#161b25] rounded mb-1"></div>
            <div className="w-20 h-4 bg-[#161b25] rounded"></div>
          </div>
        </div>
        <div className="px-5 shrink-0 h-full flex flex-col justify-center border-r border-[#1e2535]">
          <div className="w-28 h-7 bg-[#161b25] rounded mb-1"></div>
          <div className="w-20 h-4 bg-[#161b25] rounded"></div>
        </div>
        <div className="flex items-center gap-6 px-5 overflow-x-auto">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="shrink-0">
              <div className="w-14 h-4 bg-[#161b25] rounded mb-1"></div>
              <div className="w-20 h-5 bg-[#161b25] rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-16 bg-[#0b0e14] border-b border-[#1e2535] flex items-center gap-0 px-0 overflow-x-auto shrink-0">
      {/* Symbol + Price block */}
      <div className="flex items-center gap-4 px-5 shrink-0 h-full border-r border-[#1e2535]">
        {/* Coin icon placeholder */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#f0b90b] to-[#d4a517] flex items-center justify-center shrink-0 text-black font-black text-sm">
          {baseCoin.slice(0, 2)}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-base">{baseCoin}/USDT</span>
            <span className="text-xs bg-[#f0b90b]/20 text-[#f0b90b] px-2 py-1 rounded font-bold border border-[#f0b90b]/30">Perp</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-gray-600">
            <Activity className="w-3 h-3 text-green-500 animate-pulse" />
            LIVE • MEXC Futures
          </div>
        </div>
      </div>

      {/* Price block */}
      <div className="px-5 shrink-0 h-full flex flex-col justify-center border-r border-[#1e2535]">
        <div className={`text-2xl font-mono font-black leading-tight ${isUp ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
          {formatPrice(ticker.lastPrice)}
        </div>
        <div className={`flex items-center gap-1 text-sm font-semibold ${isUp ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
          {isUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          {isUp ? '+' : ''}{(ticker.riseFallRate * 100).toFixed(2)}%
          <span className="text-gray-600 font-normal">{isUp ? '+' : ''}{ticker.riseFallValue.toFixed(2)}</span>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-6 px-5 overflow-x-auto">
        {[
          { label: '24h Change', value: `${(ticker.riseFallRate * 100).toFixed(2)}%`, color: isUp ? 'text-[#0ecb81]' : 'text-[#f6465d]' },
          { label: '24h High', value: formatPrice(ticker.high24Price), color: 'text-[#0ecb81]' },
          { label: '24h Low', value: formatPrice(ticker.lower24Price), color: 'text-[#f6465d]' },
          { label: '24h Vol (USDT)', value: formatNum(ticker.amount24), color: 'text-white' },
          { label: 'Open Interest', value: formatNum(ticker.holdVol), color: 'text-blue-400' },
          { label: 'Index', value: formatPrice(ticker.indexPrice), color: 'text-gray-300' },
          { label: 'Fair', value: formatPrice(ticker.fairPrice), color: 'text-gray-300' },
        ].map(({ label, value, color }) => (
          <div key={label} className="shrink-0 flex flex-col justify-center">
            <div className="text-xs text-gray-600 mb-0.5">{label}</div>
            <div className={`text-sm font-mono font-semibold ${color}`}>{value}</div>
          </div>
        ))}

        {/* Funding rate */}
        {funding && (
          <div className="shrink-0 flex items-center gap-3 bg-[#161b25] rounded-lg px-3 py-2 border border-[#2a3045]">
            <Zap className="w-4 h-4 text-yellow-500 shrink-0" />
            <div>
              <div className="text-xs text-gray-600">Funding</div>
              <div className={`text-sm font-mono font-bold ${funding.fundingRate >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                {(funding.fundingRate * 100).toFixed(4)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Countdown</div>
              <div className="text-sm text-gray-300 font-mono">{nextFundingStr}</div>
            </div>
          </div>
        )}
      </div>


      {/* Live indicator */}
      <div className="ml-auto shrink-0 px-4 flex items-center gap-1.5 text-xs text-gray-600">
        <Activity className="w-4 h-4 text-green-500 animate-pulse" />
        LIVE
      </div>
    </div>
  );
}
