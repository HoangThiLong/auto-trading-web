import { useEffect, useState, type MouseEvent } from 'react';
import { useStore } from '../store/useStore';
import { fetchAccountInfo, fetchOpenPositions } from '../services/mexcApi';
import { Wallet, RefreshCw, Lock, X, Activity, Shield } from 'lucide-react';

export default function AccountPanel() {
  const credentials = useStore((state) => state.credentials);
  const openPositions = useStore((state) => state.openPositions);
  const setOpenPositions = useStore((state) => state.setOpenPositions);
  const pendingOrders = useStore((state) => state.pendingOrders);
  const removeOrder = useStore((state) => state.removeOrder);
  const setSelectedSymbol = useStore((state) => state.setSelectedSymbol);
  const accountBalance = useStore((state) => state.accountBalance);
  const demoBalance = useStore((state) => state.demoBalance);

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

  const liveTotalBalance = accountAssets.reduce((sum, asset) => sum + (parseFloat(asset.equity) || 0), 0);
  const totalBalance = isDemoMode ? demoBalance : accountBalance || liveTotalBalance;
  const totalPnl = openPositions.reduce((sum: number, position: any) => sum + (parseFloat(position.unrealisedPnl) || 0), 0);
  const simOrders = pendingOrders.filter((order) => order.id.startsWith('sim_') && order.status === 'PENDING');

  const handleCancelSimOrder = (orderId: string, event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    removeOrder(orderId);
  };

  const handleSelectOrderSymbol = (symbol: string) => {
    setSelectedSymbol(symbol);
  };

  if (!credentials && !isDemoMode) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[var(--bg-panel)] p-6 text-center">
        <div className="coinbase-surface w-full max-w-md rounded-2xl border border-[var(--border)] p-6">
          <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-[rgba(255,184,46,0.35)] bg-[var(--color-warning-dim)]">
            <Lock className="h-6 w-6 text-[var(--color-warning)]" />
          </div>
          <h2 className="text-base font-bold text-[var(--text-main)]">Chưa kết nối tài khoản Live</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Cần cấu hình API Key tại tab Settings để tải dữ liệu tài khoản thực.
          </p>

          <div className="mt-4 flex items-center justify-center gap-2">
            <button
              id="account-panel-switch-demo"
              onClick={() => setIsDemoMode(true)}
              className="coinbase-pill-btn border-[rgba(255,184,46,0.45)] bg-[var(--color-warning)] px-4 py-2 text-xs font-bold uppercase tracking-[0.08em] text-[#1f1300]"
            >
              Chuyển về Demo
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-[var(--bg-panel)] p-4 text-[var(--text-main)]">
      <section className="coinbase-surface rounded-2xl p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[rgba(0,82,255,0.35)] bg-[var(--color-brand-dim)]">
            <Wallet className="h-5 w-5 text-[var(--color-brand)]" />
          </div>
          <div>
            <h2 className="text-base font-bold">Futures Account Center</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">Quản lý tài khoản, vị thế và lệnh nháp AI</p>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Mode</span>
            <button
              id="account-panel-mode-demo"
              onClick={() => setIsDemoMode(true)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] transition-all ${
                isDemoMode
                  ? 'border border-[rgba(255,184,46,0.45)] bg-[var(--color-warning)] text-[#1f1300]'
                  : 'border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-muted)]'
              }`}
            >
              Demo
            </button>
            <button
              id="account-panel-mode-real"
              onClick={() => setIsDemoMode(false)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] transition-all ${
                !isDemoMode
                  ? 'border border-[rgba(0,230,138,0.45)] bg-[var(--color-success)] text-[#032113]'
                  : 'border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-muted)]'
              }`}
            >
              Real
            </button>
            <button
              id="account-panel-refresh-button"
              onClick={loadAccount}
              disabled={loading}
              className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-secondary)] transition-all hover:border-[rgba(0,82,255,0.45)] hover:text-white disabled:opacity-50"
              title="Làm mới số dư"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="coinbase-surface rounded-2xl p-4">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Tổng số dư {isDemoMode ? '(Demo)' : '(Live)'}
          </div>
          <div className="font-mono text-2xl font-bold text-[var(--text-main)]">{totalBalance.toFixed(2)}</div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">USDT</div>
        </div>

        <div
          className={`coinbase-surface rounded-2xl p-4 ${
            totalPnl >= 0
              ? 'border border-[rgba(0,230,138,0.35)] bg-[linear-gradient(140deg,rgba(0,230,138,0.14),rgba(10,13,26,0.95))]'
              : 'border border-[rgba(255,77,106,0.35)] bg-[linear-gradient(140deg,rgba(255,77,106,0.14),rgba(10,13,26,0.95))]'
          }`}
        >
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Unrealized PnL
          </div>
          <div className={`font-mono text-2xl font-black ${totalPnl >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
            {totalPnl >= 0 ? '+' : ''}
            {totalPnl.toFixed(2)}
          </div>
          <div className="mt-1 text-xs text-[var(--text-muted)]">USDT</div>
        </div>

        <div className="coinbase-surface rounded-2xl p-4">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Trạng thái hệ thống
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Activity className="h-4 w-4 text-[var(--color-cyan)]" />
            {openPositions.length} vị thế mở
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Shield className="h-4 w-4 text-[var(--accent-soft)]" />
            {pendingOrders.length} lệnh trong bộ nhớ
          </div>
        </div>
      </section>

      {accountAssets.length > 0 && (
        <section className="coinbase-surface rounded-2xl p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Tài sản</h3>
          <div className="space-y-2">
            {accountAssets.map((asset: any, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] px-3 py-2.5"
              >
                <span className="truncate text-sm font-semibold text-[var(--text-secondary)]">{asset.currency || 'USDT'}</span>
                <div className="text-right">
                  <div className="font-mono text-sm font-bold text-[var(--text-main)]">
                    {parseFloat(asset.availableBalance || asset.available || 0).toFixed(4)}
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                    Equity: {parseFloat(asset.equity || 0).toFixed(4)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {openPositions.length > 0 && (
        <section className="coinbase-surface rounded-2xl p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            Positions đang mở ({openPositions.length})
          </h3>
          <div className="space-y-2">
            {openPositions.map((position: any, index) => {
              const pnl = parseFloat(position.unrealisedPnl || 0);
              const isLong = position.positionType === 1 || position.side === 'LONG';
              return (
                <div key={index} className="flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] px-3 py-2.5">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                      isLong
                        ? 'border-[rgba(0,230,138,0.45)] bg-[var(--color-success-dim)] text-[var(--color-success)]'
                        : 'border-[rgba(255,77,106,0.45)] bg-[var(--color-danger-dim)] text-[var(--color-danger)]'
                    }`}
                  >
                    {isLong ? 'LONG' : 'SHORT'}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-[var(--text-main)]">{position.symbol}</div>
                    <div className="truncate text-[11px] text-[var(--text-muted)]">
                      Qty: {position.holdVol || position.quantity} • Entry: {parseFloat(position.openAvgPrice || position.entryPrice || 0).toFixed(2)}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`font-mono text-sm font-bold ${pnl >= 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                      {pnl >= 0 ? '+' : ''}
                      {pnl.toFixed(4)}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[var(--text-muted)]">{position.leverage || 1}x</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {simOrders.length > 0 && (
        <section className="coinbase-surface rounded-2xl border border-[rgba(139,92,246,0.35)] bg-[rgba(139,92,246,0.08)] p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-[#dfc6ff]">
            Lệnh nháp AI ({simOrders.length})
          </h3>
          <div className="space-y-2">
            {simOrders.map((order) => (
              <div
                key={order.id}
                onClick={() => handleSelectOrderSymbol(order.symbol)}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] px-3 py-2.5 text-sm transition-all hover:border-[rgba(0,82,255,0.35)]"
                title="Nhấn để chuyển chart sang coin của lệnh"
              >
                <span
                  className={`text-xs font-bold ${order.side === 'LONG' ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}
                >
                  {order.side}
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold text-[var(--text-secondary)]">
                  {order.symbol.replace('_', '/')}
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">{order.leverage}x</span>
                <span className="font-mono text-xs text-[var(--text-main)]">${order.price.toFixed(2)}</span>
                <span className="rounded-full border border-[rgba(139,92,246,0.45)] bg-[rgba(139,92,246,0.14)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#dcc0ff]">
                  SIM DRAFT
                </span>
                <button
                  id={`account-panel-cancel-sim-${order.id}`}
                  onClick={(event) => handleCancelSimOrder(order.id, event)}
                  className="rounded-lg p-1 text-[var(--color-danger)] transition-all hover:bg-[var(--color-danger-dim)] hover:text-[#ffc1cc]"
                  title="Hủy lệnh mô phỏng"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="coinbase-surface-soft rounded-2xl p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">Thống kê lệnh</h3>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] p-2.5">
            <div className="mb-0.5 text-xl font-black text-[var(--text-main)]">{pendingOrders.length}</div>
            <div className="text-[11px] text-[var(--text-muted)]">Tổng lệnh</div>
          </div>
          <div className="rounded-xl border border-[rgba(0,230,138,0.35)] bg-[var(--color-success-dim)] p-2.5">
            <div className="mb-0.5 text-xl font-black text-[var(--color-success)]">
              {pendingOrders.filter((order) => order.status === 'FILLED').length}
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">Đã khớp</div>
          </div>
          <div className="rounded-xl border border-[rgba(255,77,106,0.35)] bg-[var(--color-danger-dim)] p-2.5">
            <div className="mb-0.5 text-xl font-black text-[var(--color-danger)]">
              {pendingOrders.filter((order) => order.status === 'CANCELLED').length}
            </div>
            <div className="text-[11px] text-[var(--text-muted)]">Đã hủy</div>
          </div>
        </div>
      </section>
    </div>
  );
}
