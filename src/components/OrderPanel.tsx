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
    <div className="flex flex-col gap-4 text-white h-full overflow-y-auto p-5">
      {/* Order Form */}
      <div className="bg-[#161b25] rounded-2xl border border-[#2a3045] p-5">
        <div className="flex items-center gap-3 mb-5">
          <ShoppingBag className="w-5 h-5 text-[#f0b90b]" />
          <span className="font-bold text-base">Đặt lệnh Futures</span>
          <span className="text-sm text-gray-500 ml-auto">{selectedSymbol}</span>
        </div>

        {/* LONG/SHORT */}
        <div className="flex gap-2 mb-5">
          <button onClick={() => setSide('LONG')}
            className={`flex-1 py-3 rounded-xl font-bold text-base transition-all ${side === 'LONG' ? 'bg-[#0ecb81] text-black' : 'bg-[#0b0e14] text-gray-500 hover:text-[#0ecb81]'}`}>
            LONG / MUA
          </button>
          <button onClick={() => setSide('SHORT')}
            className={`flex-1 py-3 rounded-xl font-bold text-base transition-all ${side === 'SHORT' ? 'bg-[#f6465d] text-white' : 'bg-[#0b0e14] text-gray-500 hover:text-[#f6465d]'}`}>
            SHORT / BÁN
          </button>
        </div>

        {/* Order type & Margin */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1 flex gap-2">
            {(['LIMIT', 'MARKET'] as const).map(t => (
              <button key={t} onClick={() => setOrderType(t)}
                className={`flex-1 py-2 text-sm rounded-lg ${orderType === t ? 'bg-[#f0b90b] text-black font-bold' : 'bg-[#0b0e14] text-gray-500 hover:bg-[#1e2535]'}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {(['ISOLATED', 'CROSS'] as const).map(t => (
              <button key={t} onClick={() => setMarginType(t)}
                className={`px-3 py-2 text-sm rounded-lg ${marginType === t ? 'bg-purple-700 text-white font-bold' : 'bg-[#0b0e14] text-gray-500 hover:bg-[#1e2535]'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Price */}
        {orderType === 'LIMIT' && (
          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-2 block">GIÁ (USDT)</label>
            <div className="flex gap-2">
              <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                className="flex-1 bg-[#0b0e14] border border-[#2a3045] rounded-xl px-4 py-3 text-base text-white font-mono focus:outline-none focus:border-[#f0b90b]" />
              <button onClick={() => setPrice(currentPrice.toString())}
                className="text-xs px-3 bg-[#1e2535] rounded-xl text-gray-400 hover:text-white font-medium">Thị trường</button>
            </div>
          </div>
        )}

        {/* Quantity & Margin Input */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-gray-500 mb-2 block uppercase">SỐ LƯỢNG (Hợp đồng)</label>
            <input type="number" value={quantity} onChange={e => setQuantity(e.target.value)}
              className="w-full bg-[#0b0e14] border border-[#2a3045] rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:border-[#f0b90b]" />
            <div className="text-[10px] text-gray-600 mt-1">1 hợp đồng = {contractSize} đồng</div>
          </div>
          <div>
            <label className="text-xs text-purple-500 mb-2 block uppercase font-bold text-shadow">KÍ QUỸ ƯỚC TÍNH (USDT)</label>
            <input type="number" value={marginRequired().toFixed(2)} onChange={e => handleMarginChange(e.target.value)}
              className="w-full bg-[#0b0e14] border border-purple-900/50 rounded-xl px-4 py-3 text-sm text-purple-400 font-mono focus:outline-none focus:border-purple-500" />
            <div className="text-[10px] text-gray-600 mt-1">Nhập Kí quỹ tự nhảy Số lượng</div>
          </div>
        </div>

        {/* Leverage */}
        <div className="mb-4">
          <div className="flex justify-between mb-2">
            <label className="text-xs text-gray-500">ĐÒN BẨY</label>
            <span className="text-sm font-bold text-[#f0b90b]">{leverage}x</span>
          </div>
          <input type="range" min="1" max="125" value={leverage}
            onChange={e => setLeverage(e.target.value)}
            className="w-full accent-[#f0b90b] my-2" />
          <div className="flex justify-between text-xs text-gray-600 font-medium">
            {['1x', '10x', '25x', '50x', '100x', '125x'].map(l => (
              <button key={l} onClick={() => setLeverage(l.replace('x', ''))} className="hover:text-yellow-400">{l}</button>
            ))}
          </div>
        </div>

        {/* TP/SL */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div>
            <label className="text-xs text-green-600 mb-2 block font-medium">TAKE PROFIT</label>
            <input type="number" value={takeProfit} onChange={e => setTakeProfit(e.target.value)}
              placeholder="Không bắt buộc"
              className="w-full bg-[#0b0e14] border border-green-900 rounded-xl px-4 py-3 text-sm text-green-400 font-mono focus:outline-none focus:border-green-500" />
          </div>
          <div>
            <label className="text-xs text-red-600 mb-2 block font-medium">STOP LOSS</label>
            <input type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)}
              placeholder="Không bắt buộc"
              className="w-full bg-[#0b0e14] border border-red-900 rounded-xl px-4 py-3 text-sm text-red-400 font-mono focus:outline-none focus:border-red-500" />
          </div>
        </div>



        {/* Submit */}
        <button onClick={handleSubmit} disabled={submitting}
          className={`w-full py-4 rounded-xl font-bold text-base transition-all ${
            side === 'LONG' ? 'bg-[#0ecb81] text-black hover:bg-[#0ab870]' : 'bg-[#f6465d] text-white hover:bg-[#e03850]'
          } disabled:opacity-50`}>
          {submitting ? 'Đang đặt lệnh...' : `${side === 'LONG' ? '🚀 MỞ LONG' : '📉 MỞ SHORT'} ${leverage}x`}
        </button>

        {/* Open on MEXC */}
        <a href={`https://futures.mexc.com/exchange/${selectedSymbol.replace('_', '')}`}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 mt-4 text-sm text-gray-500 hover:text-[#f0b90b] transition-colors">
          <ExternalLink className="w-4 h-4" />
          Mở trên MEXC.com
        </a>
      </div>

      {/* Active Orders */}
      {activePending.length > 0 && (
        <div className="bg-[#161b25] rounded-2xl border border-[#2a3045] p-5">
          <div className="text-sm font-bold text-gray-400 mb-3">LỆNH ĐANG CHỜ ({activePending.length})</div>
          <div className="space-y-2">
            {activePending.map(order => (
              <div key={order.id} className="flex items-center gap-3 bg-[#0b0e14] rounded-xl p-3 text-sm">
                <span className={`font-bold ${order.side === 'LONG' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{order.side}</span>
                <span className="text-gray-300 font-medium">{order.symbol.replace('_USDT', '')}</span>
                <span className="text-gray-500">{order.leverage}x</span>
                <span className="text-white font-mono font-bold">{order.price.toFixed(2)}</span>
                <span className="text-gray-600">×{order.quantity}</span>
                {order.signal && (
                  <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded-full">AI</span>
                )}
                <button onClick={() => cancelOrder(order.id)}
                  className="ml-auto text-red-600 hover:text-red-400 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* API Key warning */}
      {!credentials && (
        <div className="flex items-start gap-3 p-4 bg-yellow-950 border border-yellow-900 rounded-xl text-xs text-yellow-600">
          <Lock className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">Cấu hình API Key tại tab <strong>⚙️ Settings</strong> để đặt lệnh thực trên MEXC server</span>
        </div>
      )}
    </div>
  );
}
