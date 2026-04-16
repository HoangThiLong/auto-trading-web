import { useEffect, useState, type MouseEvent } from 'react';
import { useStore } from '../store/useStore';
import { fetchAccountInfo, fetchOpenPositions } from '../services/mexcApi';
import { Wallet, RefreshCw, Lock, X } from 'lucide-react';

export default function AccountPanel() {
  const credentials = useStore((s) => s.credentials);
  const openPositions = useStore((s) => s.openPositions);
  const setOpenPositions = useStore((s) => s.setOpenPositions);
  const pendingOrders = useStore((s) => s.pendingOrders);
  const removeOrder = useStore((s) => s.removeOrder);
  const setSelectedSymbol = useStore((s) => s.setSelectedSymbol);
  const accountBalance = useStore((s) => s.accountBalance);
  const demoBalance = useStore((s) => s.demoBalance);

  const [accountAssets, setAccountAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(true);

  const loadAccount = async () => {
    if (!credentials) return;
    setLoading(true);
    try {
      const [assets, positions] = await Promise.all([
        fetchAccountInfo(credentials.apiKey, credentials.secretKey),
        fetchOpenPositions(credentials.apiKey, credentials.secretKey),
      ]);
      if (assets) setAccountAssets(Array.isArray(assets) ? assets : [assets]);
      if (positions) setOpenPositions(positions);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccount();
  }, [credentials]);

  const liveTotalBalance = accountAssets.reduce((s, a) => s + (parseFloat(a.equity) || 0), 0);
  const totalBalance = isDemoMode ? demoBalance : accountBalance || liveTotalBalance;
  const totalPnl = openPositions.reduce((s: number, p: any) => s + (parseFloat(p.unrealisedPnl) || 0), 0);
  const simOrders = pendingOrders.filter((o) => o.id.startsWith('sim_') && o.status === 'PENDING');

  const handleCancelSimOrder = (orderId: string, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    removeOrder(orderId);
  };

  const handleSelectOrderSymbol = (symbol: string) => {
    setSelectedSymbol(symbol);
  };

  if (!credentials && !isDemoMode) {
    return (
      <div className="relative flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="absolute right-4 top-4 flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Mode:</span>
          <button
            onClick={() => setIsDemoMode(true)}
            className={`rounded px-2 py-0.5 text-xs transition-colors ${
              isDemoMode ? 'bg-amber-400 text-slate-900 font-semibold' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Demo
          </button>
          <button
            onClick={() => setIsDemoMode(false)}
            className={`rounded px-2 py-0.5 text-xs transition-colors ${
              !isDemoMode ? 'bg-emerald-600 text-white font-semibold' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Real
          </button>
        </div>
        <Lock className="h-10 w-10 text-slate-600" />
        <div className="text-sm text-slate-400">Cần cấu hình API Key để xem thông tin tài khoản</div>
        <div className="text-xs text-slate-500">Vào tab ⚙️ Settings để kết nối API</div>
      </div>
    );
  }

  return (
    <div className="h-full space-y-4 overflow-y-auto p-4 text-slate-100">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-amber-400" />
          <span className="text-sm font-semibold">Tài khoản Futures</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Mode:</span>
          <button
            onClick={() => setIsDemoMode(true)}
            className={`rounded px-2 py-0.5 text-xs transition-colors ${
              isDemoMode ? 'bg-amber-400 text-slate-900 font-semibold' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Demo
          </button>
          <button
            onClick={() => setIsDemoMode(false)}
            className={`rounded px-2 py-0.5 text-xs transition-colors ${
              !isDemoMode ? 'bg-emerald-600 text-white font-semibold' : 'bg-slate-800 text-slate-400'
            }`}
          >
            Real
          </button>
          <button
            onClick={loadAccount}
            disabled={loading}
            className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-slate-200"
            title="Làm mới số dư"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-1 text-xs text-slate-400">Tổng số dư {isDemoMode ? '(Demo)' : '(Live)'}</div>
          <div className="font-mono text-2xl font-bold text-slate-100">{totalBalance.toFixed(2)}</div>
          <div className="mt-1 text-xs text-slate-500">USDT</div>
        </div>
        <div
          className={`rounded-xl border p-4 ${
            totalPnl >= 0 ? 'border-emerald-900 bg-emerald-950/30' : 'border-rose-900 bg-rose-950/30'
          }`}
        >
          <div className="mb-1 text-xs text-slate-400">Lợi nhuận chưa thực hiện</div>
          <div className={`font-mono text-2xl font-bold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {totalPnl >= 0 ? '+' : ''}
            {totalPnl.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-slate-500">USDT</div>
        </div>
      </div>

      {accountAssets.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-2 text-xs font-semibold text-slate-400">TÀI SẢN</div>
          {accountAssets.map((asset: any, index) => (
            <div
              key={index}
              className="flex items-center justify-between gap-3 border-b border-slate-800 py-2.5 text-sm last:border-0"
            >
              <span className="truncate font-medium text-slate-300">{asset.currency || 'USDT'}</span>
              <div className="text-right">
                <div className="font-mono font-semibold text-slate-100">
                  {parseFloat(asset.availableBalance || asset.available || 0).toFixed(4)}
                </div>
                <div className="mt-0.5 text-xs text-slate-500">Equity: {parseFloat(asset.equity || 0).toFixed(4)}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {openPositions.length > 0 && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <div className="mb-2 text-xs font-semibold text-slate-400">POSITIONS ĐANG MỞ ({openPositions.length})</div>
          {openPositions.map((pos: any, index) => {
            const pnl = parseFloat(pos.unrealisedPnl || 0);
            const isLong = pos.positionType === 1 || pos.side === 'LONG';
            return (
              <div key={index} className="flex items-center gap-3 border-b border-slate-800 py-2.5 last:border-0">
                <div
                  className={`rounded-md px-2 py-1 text-[11px] font-bold ${
                    isLong ? 'bg-emerald-900/40 text-emerald-300' : 'bg-rose-900/40 text-rose-300'
                  }`}
                >
                  {isLong ? 'LONG' : 'SHORT'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-slate-100">{pos.symbol}</div>
                  <div className="truncate text-xs text-slate-500">
                    Qty: {pos.holdVol || pos.quantity} | Entry: {parseFloat(pos.openAvgPrice || pos.entryPrice || 0).toFixed(2)}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-mono text-sm font-semibold ${pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {pnl >= 0 ? '+' : ''}
                    {pnl.toFixed(4)}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{pos.leverage || 1}x</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {simOrders.length > 0 && (
        <div className="rounded-xl border border-purple-900/60 bg-purple-950/20 p-4">
          <div className="mb-2 text-xs font-semibold text-purple-300">🤖 LỆNH NHÁP AI ({simOrders.length})</div>
          <div className="space-y-2">
            {simOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => handleSelectOrderSymbol(order.symbol)}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2.5 text-sm transition-colors hover:border-slate-700 hover:bg-slate-900"
                title="Nhấn để chuyển chart sang coin của lệnh"
              >
                <div className={`shrink-0 text-xs font-bold ${order.side === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {order.side}
                </div>
                <span className="min-w-0 flex-1 truncate font-medium text-slate-200">{order.symbol.replace('_', '/')}</span>
                <span className="shrink-0 text-xs text-slate-500">{order.leverage}x</span>
                <span className="shrink-0 font-mono text-xs text-slate-200">${order.price.toFixed(2)}</span>
                <span className="shrink-0 rounded-full bg-purple-900/40 px-2 py-0.5 text-[10px] text-purple-300">SIM DRAFT</span>
                <button
                  onClick={(event) => handleCancelSimOrder(order.id, event)}
                  className="shrink-0 rounded p-1 text-rose-400 transition-colors hover:bg-rose-900/30 hover:text-rose-300"
                  title="Hủy lệnh mô phỏng"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="mb-3 text-xs font-semibold text-slate-400">THỐNG KÊ LỆNH</div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-slate-950 p-2.5">
            <div className="mb-0.5 text-xl font-bold text-slate-100">{pendingOrders.length}</div>
            <div className="text-[11px] text-slate-500">Tổng lệnh</div>
          </div>
          <div className="rounded-lg bg-slate-950 p-2.5">
            <div className="mb-0.5 text-xl font-bold text-emerald-400">
              {pendingOrders.filter((o) => o.status === 'FILLED').length}
            </div>
            <div className="text-[11px] text-slate-500">Đã khớp</div>
          </div>
          <div className="rounded-lg bg-slate-950 p-2.5">
            <div className="mb-0.5 text-xl font-bold text-rose-400">
              {pendingOrders.filter((o) => o.status === 'CANCELLED').length}
            </div>
            <div className="text-[11px] text-slate-500">Đã hủy</div>
          </div>
        </div>
      </div>
    </div>
  );
}
