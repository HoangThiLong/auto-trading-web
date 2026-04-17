import { useState, useEffect } from 'react';
import { placeOrder } from '../services/mexcApi';
import type { TradeSignal, PendingOrder } from '../types';
import toast from 'react-hot-toast';
import { ShoppingBag, X, ExternalLink, Lock } from 'lucide-react';
import { useOrderPanelState } from '../store/hooks';

interface Props {
  prefillSignal?: TradeSignal | null;
}

export default function OrderPanel({ prefillSignal }: Props) {
  const { selectedSymbol, tickers, contracts, credentials, addOrder, pendingOrders, updateOrder } = useOrderPanelState();

  const ticker = tickers.find(t => t.symbol === selectedSymbol);
  const currentPrice = ticker?.lastPrice || 0;

  const contractInfo = contracts?.find(c => c.symbol === selectedSymbol);
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

  // Sync prefillSignal to state when it changes (since component stays mounted)
  useEffect(() => {
    if (prefillSignal) {
      setSide(prefillSignal.type === 'SHORT' ? 'SHORT' : 'LONG');
      if (prefillSignal.entry) setPrice(prefillSignal.entry.toString());
      if (prefillSignal.stopLoss) setStopLoss(prefillSignal.stopLoss.toFixed(2));
      if (prefillSignal.takeProfit) setTakeProfit(prefillSignal.takeProfit.toFixed(2));
    }
  }, [prefillSignal]);

  const marginRequired = () => {
    const p = parseFloat(price) || currentPrice;
    const q = parseFloat(quantity) || 0;
    const lev = parseFloat(leverage) || 1;
    return (p * q * contractSize) / lev;
  };

  const handleMarginChange = (val: string) => {
    const m = parseFloat(val);
    if (!m || m <= 0) {
      setQuantity('0');
      return;
    }
    const p = parseFloat(price) || currentPrice;
    const lev = parseFloat(leverage) || 1;
    if (p > 0) {
      const q = (m * lev) / (p * contractSize);
      // Giới hạn số thập phân của hợp đồng. Tạm làm tròn số lượng (MEXC thường dùng số nguyên cho Hợp đồng)
      setQuantity(Math.floor(q).toString());
    }
  };

  const handleSubmit = async () => {
    if (!credentials) {
      toast.error('Cần cấu hình API key trước!');
      return;
    }

    const parsedPrice = parseFloat(price);
    const effectivePrice = orderType === 'MARKET'
      ? (currentPrice > 0 ? currentPrice : parsedPrice)
      : parsedPrice;
    const q = parseFloat(quantity);
    const lev = parseInt(leverage);
    if (!effectivePrice || !q || !lev) {
      toast.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }

    setSubmitting(true);
    try {
      // side: 1 open long, 2 close short, 3 open short, 4 close long
      const orderSide = side === 'LONG' ? 1 : 3;
      const orderTypeNum = orderType === 'LIMIT' ? 1 : 5;

      const result = await placeOrder(credentials.apiKey, credentials.secretKey, {
        symbol: selectedSymbol,
        price: effectivePrice,
        vol: q,
        leverage: lev,
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
          symbol: selectedSymbol, side, type: orderType, price: effectivePrice, quantity: q, leverage: lev,
          stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
          takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
          status: 'PENDING', createdAt: Date.now(), signal: prefillSignal || undefined,
        };
        addOrder(order);
      } else {
        toast.error(`Lỗi: ${result?.message || 'Không thể đặt lệnh'}`);

        // Add as simulated order if API not available for futures
        const order: PendingOrder = {
          id: `sim_${Date.now()}`,
          symbol: selectedSymbol, side, type: orderType, price: effectivePrice, quantity: q, leverage: lev,
          stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
          takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
          status: 'PENDING', createdAt: Date.now(), signal: prefillSignal || undefined,
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

  const activePending = pendingOrders.filter(o => o.status === 'PENDING');

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-5 text-[var(--text-main)]">
      {/* Order Form */}
      <div className="coinbase-surface rounded-2xl p-5">
        <div className="mb-5 flex items-center gap-3">
          <ShoppingBag className="h-5 w-5 text-[var(--color-warning)]" />
          <span className="text-base font-bold">Đặt lệnh Futures</span>
          <span className="ml-auto text-sm text-[var(--text-muted)]">{selectedSymbol}</span>
        </div>

        {/* LONG/SHORT */}
        <div className="mb-5 grid grid-cols-2 gap-2.5">
          <button
            id="order-panel-long-button"
            onClick={() => setSide('LONG')}
            className={`rounded-xl py-3 text-base font-extrabold transition-all ${
              side === 'LONG'
                ? 'bg-[var(--color-success)] text-[#04140f] shadow-[0_12px_26px_rgba(14,203,129,0.34)] hover:brightness-105 active:scale-[0.99]'
                : 'border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-muted)] hover:border-[rgba(14,203,129,0.45)] hover:text-[var(--color-success)]'
            }`}
          >
            LONG / MUA
          </button>
          <button
            id="order-panel-short-button"
            onClick={() => setSide('SHORT')}
            className={`rounded-xl py-3 text-base font-extrabold transition-all ${
              side === 'SHORT'
                ? 'bg-[var(--color-danger)] text-white shadow-[0_12px_26px_rgba(246,70,93,0.34)] hover:brightness-110 active:scale-[0.99]'
                : 'border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-muted)] hover:border-[rgba(246,70,93,0.45)] hover:text-[var(--color-danger)]'
            }`}
          >
            SHORT / BÁN
          </button>
        </div>

        {/* Order type & Margin */}
        <div className="mb-5 flex gap-3">
          <div className="flex flex-1 gap-2">
            {(['LIMIT', 'MARKET'] as const).map(t => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className={`flex-1 rounded-lg py-2 text-sm transition-all ${
                  orderType === t
                    ? 'bg-[var(--color-brand)] font-bold text-white shadow-[0_8px_18px_rgba(0,82,255,0.35)]'
                    : 'border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-muted)] hover:border-[rgba(87,139,250,0.5)] hover:text-[#cfe0ff]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(['ISOLATED', 'CROSS'] as const).map(t => (
              <button
                key={t}
                onClick={() => setMarginType(t)}
                className={`rounded-lg px-3 py-2 text-sm transition-all ${
                  marginType === t
                    ? 'bg-[var(--color-warning)] font-bold text-[#1f1300] shadow-[0_8px_18px_rgba(240,185,11,0.26)]'
                    : 'border border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-muted)] hover:border-[rgba(240,185,11,0.45)] hover:text-[#ffd47d]'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Price */}
        {orderType === 'LIMIT' && (
          <div className="mb-4">
            <label className="mb-2 block text-xs text-[var(--text-muted)]">GIÁ (USDT)</label>
            <div className="flex gap-2">
              <input
                type="number"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-main)] px-4 py-3 font-mono text-base text-white transition-all focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,82,255,0.4)]"
              />
              <button
                onClick={() => setPrice(currentPrice.toString())}
                className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 text-xs font-medium text-[var(--text-muted)] transition-all hover:border-[rgba(87,139,250,0.5)] hover:text-white"
              >
                Thị trường
              </button>
            </div>
          </div>
        )}

        {/* Quantity & Margin Input */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-2 block text-xs uppercase text-[var(--text-muted)]">SỐ LƯỢNG (Hợp đồng)</label>
            <input
              type="number"
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-main)] px-4 py-3 font-mono text-sm text-white transition-all focus:border-[var(--color-brand)] focus:outline-none focus:ring-2 focus:ring-[rgba(0,82,255,0.4)]"
            />
            <div className="mt-1 text-[10px] text-[var(--text-muted)]">1 hợp đồng = {contractSize} đồng</div>
          </div>
          <div>
            <label className="mb-2 block text-xs font-bold uppercase text-[#c8b5ff]">KÍ QUỸ ƯỚC TÍNH (USDT)</label>
            <input
              type="number"
              value={marginRequired().toFixed(2)}
              onChange={e => handleMarginChange(e.target.value)}
              className="w-full rounded-xl border border-[rgba(168,85,247,0.4)] bg-[var(--bg-main)] px-4 py-3 font-mono text-sm text-[#d6bcff] transition-all focus:border-[#b68aff] focus:outline-none focus:ring-2 focus:ring-[rgba(168,85,247,0.35)]"
            />
            <div className="mt-1 text-[10px] text-[var(--text-muted)]">Nhập Kí quỹ tự nhảy Số lượng</div>
          </div>
        </div>

        {/* Leverage */}
        <div className="mb-4">
          <div className="mb-2 flex justify-between">
            <label className="text-xs text-[var(--text-muted)]">ĐÒN BẨY</label>
            <span className="text-sm font-bold text-[var(--color-warning)]">{leverage}x</span>
          </div>
          <input
            type="range"
            min="1"
            max="125"
            value={leverage}
            onChange={e => setLeverage(e.target.value)}
            className="my-2 w-full accent-[var(--color-warning)]"
          />
          <div className="flex justify-between text-xs font-medium text-[var(--text-muted)]">
            {['1x', '10x', '25x', '50x', '100x', '125x'].map(l => (
              <button key={l} onClick={() => setLeverage(l.replace('x', ''))} className="transition-colors hover:text-[var(--color-warning)]">
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* TP/SL */}
        <div className="mb-5 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-2 block text-xs font-medium text-[var(--color-success)]">TAKE PROFIT</label>
            <input
              type="number"
              value={takeProfit}
              onChange={e => setTakeProfit(e.target.value)}
              placeholder="Không bắt buộc"
              className="w-full rounded-xl border border-[rgba(14,203,129,0.35)] bg-[var(--bg-main)] px-4 py-3 font-mono text-sm text-[#95f4ca] transition-all focus:border-[var(--color-success)] focus:outline-none focus:ring-2 focus:ring-[rgba(14,203,129,0.3)]"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-[var(--color-danger)]">STOP LOSS</label>
            <input
              type="number"
              value={stopLoss}
              onChange={e => setStopLoss(e.target.value)}
              placeholder="Không bắt buộc"
              className="w-full rounded-xl border border-[rgba(246,70,93,0.35)] bg-[var(--bg-main)] px-4 py-3 font-mono text-sm text-[#ffb2bf] transition-all focus:border-[var(--color-danger)] focus:outline-none focus:ring-2 focus:ring-[rgba(246,70,93,0.35)]"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          id="order-panel-submit-button"
          onClick={handleSubmit}
          disabled={submitting}
          className={`w-full rounded-xl py-4 text-base font-extrabold transition-all ${
            side === 'LONG'
              ? 'bg-[var(--color-success)] text-[#03150f] shadow-[0_12px_26px_rgba(14,203,129,0.32)] hover:brightness-105'
              : 'bg-[var(--color-danger)] text-white shadow-[0_12px_26px_rgba(246,70,93,0.32)] hover:brightness-110'
          } disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {submitting ? 'Đang đặt lệnh...' : `${side === 'LONG' ? '🚀 MỞ LONG' : '📉 MỞ SHORT'} ${leverage}x`}
        </button>

        {/* Open on MEXC */}
        <a
          href={`https://futures.mexc.com/exchange/${selectedSymbol.replace('_', '')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex items-center justify-center gap-2 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--color-warning)]"
        >
          <ExternalLink className="h-4 w-4" />
          Mở trên MEXC.com
        </a>
      </div>

      {/* Active Orders */}
      {activePending.length > 0 && (
        <div className="coinbase-surface-soft rounded-2xl p-5">
          <div className="mb-3 text-sm font-bold text-[var(--text-muted)]">LỆNH ĐANG CHỜ ({activePending.length})</div>
          <div className="space-y-2">
            {activePending.map(order => (
              <div key={order.id} className="flex items-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] p-3 text-sm">
                <span className={`font-bold ${order.side === 'LONG' ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>{order.side}</span>
                <span className="font-medium text-[#d5def2]">{order.symbol.replace('_USDT', '')}</span>
                <span className="text-[var(--text-muted)]">{order.leverage}x</span>
                <span className="font-mono font-bold text-white">{order.price.toFixed(2)}</span>
                <span className="text-[var(--text-muted)]">×{order.quantity}</span>
                {order.signal && (
                  <span className="rounded-full border border-[rgba(168,85,247,0.45)] bg-[rgba(168,85,247,0.14)] px-2 py-0.5 text-xs text-[#d8bcff]">AI</span>
                )}
                <button onClick={() => cancelOrder(order.id)} className="ml-auto p-1 text-[var(--color-danger)] transition-colors hover:text-[#ff8a9c]">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* API Key warning */}
      {!credentials && (
        <div className="flex items-start gap-3 rounded-xl border border-[rgba(240,185,11,0.35)] bg-[rgba(240,185,11,0.12)] p-4 text-xs text-[#ffd77a]">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="leading-relaxed">Cấu hình API Key tại tab <strong>⚙️ Settings</strong> để đặt lệnh thực trên MEXC server</span>
        </div>
      )}
    </div>
  );
}
