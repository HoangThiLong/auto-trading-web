import { useState, useEffect } from 'react';
import { placeOrder } from '../services/mexcApi';
import type { TradeSignal, PendingOrder } from '../types';
import toast from 'react-hot-toast';
import { ShoppingBag, X, ExternalLink, Lock, TrendingUp, TrendingDown, Shield, CircleDollarSign } from 'lucide-react';
import { useOrderPanelState } from '../store/hooks';

interface Props {
  prefillSignal?: TradeSignal | null;
}

export default function OrderPanel({ prefillSignal }: Props) {
  const { selectedSymbol, tickers, contracts, credentials, addOrder, pendingOrders, updateOrder } = useOrderPanelState();

  const ticker = tickers.find((item) => item.symbol === selectedSymbol);
  const currentPrice = ticker?.lastPrice || 0;

  const contractInfo = contracts?.find((item) => item.symbol === selectedSymbol);
  const contractSize = contractInfo?.contractSize || 1;

  const [side, setSide] = useState<'LONG' | 'SHORT'>(prefillSignal?.type === 'SHORT' ? 'SHORT' : 'LONG');
  const [orderType, setOrderType] = useState<'LIMIT' | 'MARKET'>('LIMIT');
  const [price, setPrice] = useState(prefillSignal?.entry?.toString() || currentPrice?.toString() || '');
  const [quantity, setQuantity] = useState('1');
  const [leverage, setLeverage] = useState('10');
  const [stopLoss, setStopLoss] = useState(prefillSignal?.stopLoss?.toFixed(2) || '');
  const [takeProfit, setTakeProfit] = useState(prefillSignal?.takeProfit?.toFixed(2) || '');
  const [marginType, setMarginType] = useState<'ISOLATED' | 'CROSS'>('ISOLATED');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (prefillSignal) {
      setSide(prefillSignal.type === 'SHORT' ? 'SHORT' : 'LONG');
      if (prefillSignal.entry) setPrice(prefillSignal.entry.toString());
      if (prefillSignal.stopLoss) setStopLoss(prefillSignal.stopLoss.toFixed(2));
      if (prefillSignal.takeProfit) setTakeProfit(prefillSignal.takeProfit.toFixed(2));
    }
  }, [prefillSignal]);

  const marginRequired = () => {
    const parsedPrice = parseFloat(price) || currentPrice;
    const parsedQuantity = parseFloat(quantity) || 0;
    const parsedLeverage = parseFloat(leverage) || 1;
    return (parsedPrice * parsedQuantity * contractSize) / parsedLeverage;
  };

  const handleMarginChange = (value: string) => {
    const marginValue = parseFloat(value);
    if (!marginValue || marginValue <= 0) {
      setQuantity('0');
      return;
    }
    const parsedPrice = parseFloat(price) || currentPrice;
    const parsedLeverage = parseFloat(leverage) || 1;
    if (parsedPrice > 0) {
      const computedQuantity = (marginValue * parsedLeverage) / (parsedPrice * contractSize);
      setQuantity(Math.floor(computedQuantity).toString());
    }
  };

  const handleSubmit = async () => {
    if (!credentials) {
      toast.error('Cần cấu hình API key trước!');
      return;
    }

    const parsedPrice = parseFloat(price);
    const effectivePrice = orderType === 'MARKET' ? (currentPrice > 0 ? currentPrice : parsedPrice) : parsedPrice;
    const parsedQuantity = parseFloat(quantity);
    const parsedLeverage = parseInt(leverage);

    if (!effectivePrice || !parsedQuantity || !parsedLeverage) {
      toast.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    setSubmitting(true);
    try {
      const orderSide = side === 'LONG' ? 1 : 3;
      const orderTypeNum = orderType === 'LIMIT' ? 1 : 5;

      const result = await placeOrder(credentials.apiKey, credentials.secretKey, {
        symbol: selectedSymbol,
        price: effectivePrice,
        vol: parsedQuantity,
        leverage: parsedLeverage,
        side: orderSide,
        type: orderTypeNum,
        openType: marginType === 'ISOLATED' ? 1 : 2,
        stopLossPrice: stopLoss ? parseFloat(stopLoss) : undefined,
        takeProfitPrice: takeProfit ? parseFloat(takeProfit) : undefined,
      });

      if (result?.success) {
        toast.success(`✅ Đặt lệnh thành công! ID: ${result.data}`);
        const order: PendingOrder = {
          id: result.data?.toString() || Date.now().toString(),
          symbol: selectedSymbol,
          side,
          type: orderType,
          price: effectivePrice,
          quantity: parsedQuantity,
          leverage: parsedLeverage,
          stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
          takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
          status: 'PENDING',
          createdAt: Date.now(),
          signal: prefillSignal || undefined,
        };
        addOrder(order);
      } else {
        toast.error(`Lỗi: ${result?.message || 'Không thể đặt lệnh'}`);

        const order: PendingOrder = {
          id: `sim_${Date.now()}`,
          symbol: selectedSymbol,
          side,
          type: orderType,
          price: effectivePrice,
          quantity: parsedQuantity,
          leverage: parsedLeverage,
          stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
          takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
          status: 'PENDING',
          createdAt: Date.now(),
          signal: prefillSignal || undefined,
        };
        addOrder(order);
        toast('📋 Đã thêm vào danh sách lệnh nháp (Futures API cần tài khoản tổ chức)', { icon: 'ℹ️' });
      }
    } catch (err: any) {
      toast.error(err.message || 'Đã xảy ra lỗi');
    } finally {
      setSubmitting(false);
    }
  };

  const cancelOrder = (id: string) => {
    updateOrder(id, { status: 'CANCELLED' });
    toast.success('Đã hủy lệnh');
  };

  const activePending = pendingOrders.filter((order) => order.status === 'PENDING');

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-[var(--bg-panel)] p-4 text-[var(--text-main)]">
      <section className="coinbase-surface rounded-2xl p-5">
        <header className="mb-5 flex flex-wrap items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[rgba(0,82,255,0.35)] bg-[var(--color-brand-dim)]">
            <ShoppingBag className="h-5 w-5 text-[var(--color-brand)]" />
          </div>
          <div>
            <h2 className="text-base font-bold tracking-tight">Đặt lệnh Futures</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{selectedSymbol.replace('_', '/')} • Execution Desk</p>
          </div>
          <div className="ml-auto flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-surface-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--text-secondary)]">
            <CircleDollarSign className="h-3.5 w-3.5 text-[var(--accent-soft)]" />
            {currentPrice > 0 ? currentPrice.toFixed(4) : '—'} USDT
          </div>
        </header>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <button
            id="order-panel-long-button"
            onClick={() => setSide('LONG')}
            className={`coinbase-pill-btn inline-flex items-center justify-center gap-2 py-3 text-sm font-extrabold uppercase tracking-[0.08em] transition-all ${
              side === 'LONG'
                ? 'border-[rgba(0,230,138,0.5)] bg-[var(--color-success)] text-[#03150f] shadow-[0_14px_26px_rgba(0,230,138,0.32)]'
                : 'border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-muted)] hover:border-[rgba(0,230,138,0.45)] hover:text-[var(--color-success)]'
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            LONG
          </button>
          <button
            id="order-panel-short-button"
            onClick={() => setSide('SHORT')}
            className={`coinbase-pill-btn inline-flex items-center justify-center gap-2 py-3 text-sm font-extrabold uppercase tracking-[0.08em] transition-all ${
              side === 'SHORT'
                ? 'border-[rgba(255,77,106,0.5)] bg-[var(--color-danger)] text-white shadow-[0_14px_26px_rgba(255,77,106,0.3)]'
                : 'border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-muted)] hover:border-[rgba(255,77,106,0.45)] hover:text-[var(--color-danger)]'
            }`}
          >
            <TrendingDown className="h-4 w-4" />
            SHORT
          </button>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
          <div className="grid grid-cols-2 gap-2">
            {(['LIMIT', 'MARKET'] as const).map((type) => (
              <button
                key={type}
                id={`order-type-${type.toLowerCase()}`}
                onClick={() => setOrderType(type)}
                className={`rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] transition-all ${
                  orderType === type
                    ? 'border-[rgba(0,82,255,0.45)] bg-[var(--color-brand)] text-white shadow-[0_10px_20px_rgba(0,82,255,0.3)]'
                    : 'border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-muted)] hover:border-[rgba(0,82,255,0.45)] hover:text-[#dbe5ff]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {(['ISOLATED', 'CROSS'] as const).map((type) => (
              <button
                key={type}
                id={`margin-type-${type.toLowerCase()}`}
                onClick={() => setMarginType(type)}
                className={`rounded-xl border px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] transition-all ${
                  marginType === type
                    ? 'border-[rgba(255,184,46,0.45)] bg-[var(--color-warning)] text-[#1f1300] shadow-[0_10px_20px_rgba(255,184,46,0.26)]'
                    : 'border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-muted)] hover:border-[rgba(255,184,46,0.45)] hover:text-[#ffd980]'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {orderType === 'LIMIT' && (
          <div className="mb-4">
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Giá vào lệnh (USDT)
            </label>
            <div className="flex gap-2">
              <input
                id="order-panel-price-input"
                type="number"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                className="premium-input flex-1 rounded-xl"
              />
              <button
                id="order-panel-market-price-button"
                onClick={() => setPrice(currentPrice.toString())}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-main)] px-3 text-xs font-bold text-[var(--text-secondary)] transition-all hover:border-[rgba(0,82,255,0.45)] hover:text-white"
              >
                Giá thị trường
              </button>
            </div>
          </div>
        )}

        <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Số lượng (Hợp đồng)
            </label>
            <input
              id="order-panel-quantity-input"
              type="number"
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="premium-input w-full rounded-xl"
            />
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">1 hợp đồng = {contractSize} coin</p>
          </div>

          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d7c0ff]">
              Ký quỹ ước tính (USDT)
            </label>
            <input
              id="order-panel-margin-input"
              type="number"
              value={marginRequired().toFixed(2)}
              onChange={(event) => handleMarginChange(event.target.value)}
              className="w-full rounded-xl border border-[rgba(139,92,246,0.45)] bg-[var(--bg-main)] px-4 py-3 font-mono text-sm text-[#dac1ff] transition-all focus:border-[#c9a3ff] focus:outline-none focus:ring-2 focus:ring-[rgba(139,92,246,0.35)]"
            />
            <p className="mt-1 text-[10px] text-[var(--text-muted)]">Nhập ký quỹ để tự động tính số lượng</p>
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--bg-main)] p-3.5">
          <div className="mb-2 flex items-center justify-between">
            <label className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Đòn bẩy</label>
            <span className="font-mono text-sm font-bold text-[var(--color-warning)]">{leverage}x</span>
          </div>
          <input
            id="order-panel-leverage-range"
            type="range"
            min="1"
            max="125"
            value={leverage}
            onChange={(event) => setLeverage(event.target.value)}
            className="my-2 w-full"
          />
          <div className="grid grid-cols-6 gap-1 text-center text-[10px] text-[var(--text-muted)]">
            {['1x', '10x', '25x', '50x', '100x', '125x'].map((item) => (
              <button
                id={`order-panel-leverage-${item}`}
                key={item}
                onClick={() => setLeverage(item.replace('x', ''))}
                className="rounded-md py-1 transition-colors hover:text-[var(--color-warning)]"
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-success)]">
              Take Profit
            </label>
            <input
              id="order-panel-take-profit-input"
              type="number"
              value={takeProfit}
              onChange={(event) => setTakeProfit(event.target.value)}
              placeholder="Không bắt buộc"
              className="w-full rounded-xl border border-[rgba(0,230,138,0.35)] bg-[var(--bg-main)] px-4 py-3 font-mono text-sm text-[#9ff6cf] transition-all focus:border-[var(--color-success)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,230,138,0.3)]"
            />
          </div>
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-danger)]">
              Stop Loss
            </label>
            <input
              id="order-panel-stop-loss-input"
              type="number"
              value={stopLoss}
              onChange={(event) => setStopLoss(event.target.value)}
              placeholder="Không bắt buộc"
              className="w-full rounded-xl border border-[rgba(255,77,106,0.35)] bg-[var(--bg-main)] px-4 py-3 font-mono text-sm text-[#ffbac6] transition-all focus:border-[var(--color-danger)] focus:outline-none focus:ring-2 focus:ring-[rgba(255,77,106,0.3)]"
            />
          </div>
        </div>

        <button
          id="order-panel-submit-button"
          onClick={handleSubmit}
          disabled={submitting}
          className={`coinbase-pill-btn w-full py-3.5 text-sm font-extrabold uppercase tracking-[0.08em] transition-all ${
            side === 'LONG'
              ? 'border-[rgba(0,230,138,0.52)] bg-[var(--color-success)] text-[#03150f] shadow-[0_16px_28px_rgba(0,230,138,0.32)] hover:brightness-105'
              : 'border-[rgba(255,77,106,0.52)] bg-[var(--color-danger)] text-white shadow-[0_16px_28px_rgba(255,77,106,0.3)] hover:brightness-110'
          } disabled:cursor-not-allowed disabled:opacity-55`}
        >
          {submitting ? 'Đang đặt lệnh...' : `${side === 'LONG' ? 'Mở LONG' : 'Mở SHORT'} • ${leverage}x`}
        </button>

        <a
          id="order-panel-open-mexc-link"
          href={`https://futures.mexc.com/exchange/${selectedSymbol.replace('_', '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)] transition-colors hover:text-[var(--color-warning)]"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Mở trên MEXC Futures
        </a>
      </section>

      {activePending.length > 0 && (
        <section className="coinbase-surface-soft rounded-2xl p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Lệnh đang chờ ({activePending.length})
            </h3>
            <span className="rounded-full border border-[rgba(0,82,255,0.35)] bg-[var(--color-brand-dim)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--accent-soft)]">
              Pending
            </span>
          </div>

          <div className="space-y-2">
            {activePending.map((order) => (
              <div
                key={order.id}
                className="flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] px-3 py-2.5 text-sm"
              >
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] ${
                    order.side === 'LONG'
                      ? 'border-[rgba(0,230,138,0.45)] bg-[var(--color-success-dim)] text-[var(--color-success)]'
                      : 'border-[rgba(255,77,106,0.45)] bg-[var(--color-danger-dim)] text-[var(--color-danger)]'
                  }`}
                >
                  {order.side}
                </span>
                <span className="font-semibold text-[#d6e0f8]">{order.symbol.replace('_USDT', '')}</span>
                <span className="text-[11px] text-[var(--text-muted)]">{order.leverage}x</span>
                <span className="font-mono text-xs font-bold text-[var(--text-main)]">{order.price.toFixed(2)}</span>
                <span className="text-[11px] text-[var(--text-muted)]">×{order.quantity}</span>
                {order.signal && (
                  <span className="rounded-full border border-[rgba(139,92,246,0.45)] bg-[rgba(139,92,246,0.14)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#ddbfff]">
                    AI
                  </span>
                )}
                <button
                  id={`order-panel-cancel-${order.id}`}
                  onClick={() => cancelOrder(order.id)}
                  className="ml-auto rounded-lg p-1 text-[var(--color-danger)] transition-all hover:bg-[var(--color-danger-dim)] hover:text-[#ffb8c5]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {!credentials && (
        <section className="rounded-xl border border-[rgba(255,184,46,0.3)] bg-[var(--color-warning-dim)] p-3.5">
          <div className="flex items-start gap-2 text-xs leading-relaxed text-[#ffd77a]">
            <Shield className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Chưa kết nối API. Vào tab <strong>Settings</strong> để cấu hình API key trước khi đặt lệnh thực.
            </span>
          </div>
        </section>
      )}

      {!credentials && (
        <div className="hidden">
          <Lock className="h-0 w-0" />
        </div>
      )}
    </div>
  );
}
