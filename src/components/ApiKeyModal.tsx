import { useState } from 'react';
import { fetchAccountInfo } from '../services/mexcApi';
import { AI_PROVIDERS, type AiProviderId } from '../types';
import toast from 'react-hot-toast';
import {
  X, Key, Brain, Shield, Eye, EyeOff, ExternalLink,
  CheckCircle, XCircle, Wifi, AlertTriangle, Zap,
} from 'lucide-react';
import { useApiKeyModalState } from '../store/hooks';

export default function ApiKeyModal() {
  const {
    apiModalOpen, setApiModalOpen,
    credentials, setCredentials, setIsApiConnected,
    aiCredentials, setAiCredentials,
  } = useApiKeyModalState();

  const [tab, setTab] = useState<'mexc' | 'ai' | 'security'>('mexc');
  const [apiKey, setApiKey] = useState(credentials?.apiKey || '');
  const [secretKey, setSecretKey] = useState(credentials?.secretKey || '');
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);

  // AI keys state
  const [aiKeys, setAiKeys] = useState<Record<AiProviderId | 'cryptopanic', string>>({
    gemini: aiCredentials?.gemini || '',
    groq: aiCredentials?.groq || '',
    openrouter: aiCredentials?.openrouter || '',
    together: aiCredentials?.together || '',
    cryptopanic: aiCredentials?.cryptopanic || '',
  });
  const [showAiKeys, setShowAiKeys] = useState<Record<string, boolean>>({});
  const [preferredProvider, setPreferredProvider] = useState<AiProviderId>(
    aiCredentials?.preferredProvider || 'gemini'
  );

  if (!apiModalOpen) return null;

  const testMexcConnection = async () => {
    if (!apiKey || !secretKey) { toast.error('Nhập API key và Secret key'); return; }
    setTesting(true);
    try {
      const info = await fetchAccountInfo(apiKey, secretKey);
      setCredentials({ apiKey, secretKey });
      if (info) {
        setIsApiConnected(true);
        toast.success('✅ MEXC API kết nối thành công!');
      } else {
        setIsApiConnected(false);
        toast('⚠️ API key đã lưu — dữ liệu thị trường hoạt động bình thường', { duration: 5000 });
      }
    } catch {
      setCredentials({ apiKey, secretKey });
      toast.error('Không thể kết nối MEXC. Kiểm tra lại API key.');
    } finally {
      setTesting(false);
    }
  };

  const saveAiKeys = () => {
    setAiCredentials({
      gemini: aiKeys.gemini || undefined,
      groq: aiKeys.groq || undefined,
      openrouter: aiKeys.openrouter || undefined,
      together: aiKeys.together || undefined,
      cryptopanic: aiKeys.cryptopanic || undefined,
      preferredProvider,
    });
    toast.success('✅ Đã lưu AI API keys!');
  };

  const hasAnyAiKey = Object.values(aiKeys).some(v => v.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setApiModalOpen(false)} />

      {/* Modal */}
      <div className="relative w-full max-w-lg bg-[#0f1520] border border-[#2a3045] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-5 border-b border-[#1e2535] bg-gradient-to-r from-[#0f1520] to-[#161b25]">
          <div className="w-10 h-10 rounded-xl bg-[#f0b90b]/10 flex items-center justify-center">
            <Key className="w-5 h-5 text-[#f0b90b]" />
          </div>
          <div>
            <div className="font-bold text-white text-base">Quản lý API Keys</div>
            <div className="text-xs text-gray-500 mt-0.5">Bảo mật & kết nối</div>
          </div>
          <button onClick={() => setApiModalOpen(false)} className="ml-auto text-gray-600 hover:text-gray-400 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#1e2535]">
          {([
            { id: 'mexc', icon: Wifi, label: 'MEXC API' },
            { id: 'ai', icon: Brain, label: 'AI Models' },
            { id: 'security', icon: Shield, label: 'Bảo mật' },
          ] as const).map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-medium transition-all ${
                tab === id ? 'text-[#f0b90b] border-b-2 border-[#f0b90b] bg-[#f0b90b]/5' : 'text-gray-500 hover:text-gray-300'
              }`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        <div className="p-5 max-h-[70vh] overflow-y-auto space-y-4">

          {/* ── MEXC Tab ── */}
          {tab === 'mexc' && (
            <>
              {/* Status */}
              <div className={`flex items-center gap-3 px-4 py-3 text-base rounded-xl border ${
                credentials
                  ? 'bg-green-950/50 border-green-800/50 text-green-400'
                  : 'bg-[#161b25] border-[#2a3045] text-gray-500'
              }`}>
                {credentials ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                {credentials ? 'MEXC API Key đã được lưu' : 'Chưa cấu hình MEXC API Key'}
              </div>

              {/* Warning */}
              <div className="flex items-start gap-3 p-4 bg-amber-950/30 border border-amber-900/40 rounded-xl text-sm text-amber-400">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold mb-1.5">⚠️ Lưu ý về Futures API MEXC</div>
                  <div className="leading-relaxed">Đặt lệnh Futures qua API yêu cầu tài khoản tổ chức (institutional). Người dùng cá nhân vẫn xem được dữ liệu thị trường đầy đủ.</div>
                </div>
              </div>

              {/* Inputs */}
              <div className="space-y-4 bg-[#161b25] border border-[#2a3045] rounded-2xl p-5">
                <div>
                  <label className="text-xs text-gray-500 mb-2 block uppercase tracking-wider">API KEY</label>
                  <input type="text" value={apiKey} onChange={e => setApiKey(e.target.value)}
                    placeholder="Dán API Key từ MEXC..."
                    className="w-full bg-[#0b0e14] border border-[#2a3045] rounded-xl px-4 py-3 text-base text-white font-mono focus:outline-none focus:border-[#f0b90b] focus:ring-1 focus:ring-[#f0b90b]/30 placeholder-gray-700 transition-all" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-2 block uppercase tracking-wider">SECRET KEY</label>
                  <div className="relative">
                    <input type={showSecret ? 'text' : 'password'} value={secretKey} onChange={e => setSecretKey(e.target.value)}
                      placeholder="Dán Secret Key từ MEXC..."
                      className="w-full bg-[#0b0e14] border border-[#2a3045] rounded-xl px-4 py-3 text-base text-white font-mono focus:outline-none focus:border-[#f0b90b] focus:ring-1 focus:ring-[#f0b90b]/30 placeholder-gray-700 pr-12 transition-all" />
                    <button onClick={() => setShowSecret(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                      {showSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={testMexcConnection} disabled={testing}
                    className="flex-1 py-3 bg-[#f0b90b] text-black rounded-xl font-bold text-base hover:bg-[#d4a517] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                    <Wifi className="w-5 h-5" />
                    {testing ? 'Đang kiểm tra...' : 'Kết nối & Lưu'}
                  </button>
                  {credentials && (
                    <button onClick={() => { setCredentials(null); setIsApiConnected(false); setApiKey(''); setSecretKey(''); toast.success('Đã xóa'); }}
                      className="px-6 py-3 bg-red-900/50 text-red-400 rounded-xl font-bold text-base hover:bg-red-900 transition-colors">
                      Xóa
                    </button>
                  )}
                </div>
              </div>

              {/* Guide */}
              <div className="bg-[#161b25] border border-[#2a3045] rounded-2xl p-5">
                <div className="font-semibold text-sm text-gray-400 mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-400" /> Hướng dẫn tạo API Key
                </div>
                <ol className="space-y-2 text-sm text-gray-500">
                  {['Đăng nhập MEXC.com', 'Vào Profile → API Management', 'Tạo API Key mới — bật quyền Trade', 'KHÔNG bật quyền Withdraw', 'Copy 2 mã vào form trên'].map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-[#f0b90b] font-bold shrink-0">{i + 1}.</span>{s}
                    </li>
                  ))}
                </ol>
                <a href="https://www.mexc.com/user/openapi" target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 mt-4 text-sm font-medium text-[#f0b90b] hover:text-[#d4a517] transition-colors">
                  <ExternalLink className="w-4 h-4" /> Mở trang quản lý API MEXC
                </a>
              </div>
            </>
          )}

          {/* ── AI Tab ── */}
          {tab === 'ai' && (
            <>
              <div className="flex items-start gap-3 p-4 bg-blue-950/20 border border-blue-900/30 rounded-xl text-sm text-blue-400">
                <Zap className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold mb-1">Tất cả miễn phí!</div>
                  <div className="leading-relaxed">Nhập ít nhất 1 AI API key để kích hoạt phân tích AI. Hệ thống sẽ tự động chuyển sang provider khác khi hết quota.</div>
                </div>
              </div>

              {/* Priority selector */}
              <div className="bg-[#161b25] border border-[#2a3045] rounded-2xl p-5">
                <label className="text-xs text-gray-500 mb-3 block uppercase tracking-wider">AI Ưu tiên</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {AI_PROVIDERS.map(p => (
                    <button key={p.id} onClick={() => setPreferredProvider(p.id)}
                      className={`flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl text-sm transition-all border ${
                        preferredProvider === p.id
                          ? 'border-current bg-current/10 font-bold'
                          : 'border-[#2a3045] text-gray-500 hover:border-gray-500'
                      }`}
                      style={{ color: preferredProvider === p.id ? p.color : undefined }}>
                      <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                      {p.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Keys */}
              <div className="space-y-4">
                {AI_PROVIDERS.map(provider => (
                  <div key={provider.id} className="bg-[#161b25] border border-[#2a3045] rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: provider.color }} />
                        <span className="font-semibold text-base text-white">{provider.name}</span>
                        {aiKeys[provider.id] && (
                          <span className="text-xs bg-green-900/50 text-green-400 px-2 py-1 rounded-full">✓ Có key</span>
                        )}
                      </div>
                      <span className="text-xs text-gray-600">{provider.freeLimit}</span>
                    </div>
                    <div className="relative">
                      <input
                        type={showAiKeys[provider.id] ? 'text' : 'password'}
                        value={aiKeys[provider.id]}
                        onChange={e => setAiKeys(prev => ({ ...prev, [provider.id]: e.target.value }))}
                        placeholder={`${provider.name} API Key...`}
                        className="w-full bg-[#0b0e14] border border-[#2a3045] rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none focus:ring-1 placeholder-gray-700 pr-12 transition-all"
                        style={{ '--tw-ring-color': provider.color } as any}
                      />
                      <button onClick={() => setShowAiKeys(p => ({ ...p, [provider.id]: !p[provider.id] }))}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400">
                        {showAiKeys[provider.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <a href={provider.getKeyUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 mt-2.5 text-xs font-medium hover:opacity-80 transition-opacity"
                      style={{ color: provider.color }}>
                      <ExternalLink className="w-3.5 h-3.5" /> Lấy API Key miễn phí
                    </a>
                  </div>
                ))}

                {/* CryptoPanic */}
                <div className="bg-[#161b25] border border-[#2a3045] rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                      <span className="font-semibold text-base text-white">CryptoPanic (Tin tức)</span>
                      <span className="text-xs text-gray-500 italic">Không bắt buộc</span>
                    </div>
                  </div>
                  <input
                    type={showAiKeys['cryptopanic'] ? 'text' : 'password'}
                    value={aiKeys['cryptopanic']}
                    onChange={e => setAiKeys(prev => ({ ...prev, cryptopanic: e.target.value }))}
                    placeholder="CryptoPanic API Key (optional)..."
                    className="w-full bg-[#0b0e14] border border-[#2a3045] rounded-xl px-4 py-3 text-sm text-white font-mono focus:outline-none placeholder-gray-700 transition-all"
                  />
                  <a href="https://cryptopanic.com/developers/api/" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 mt-2.5 text-xs font-medium text-orange-400 hover:opacity-80">
                    <ExternalLink className="w-3.5 h-3.5" /> Lấy API Key miễn phí
                  </a>
                </div>
              </div>

              <button onClick={saveAiKeys} disabled={!hasAnyAiKey}
                className="w-full py-3.5 bg-gradient-to-r from-blue-700 to-purple-700 text-white rounded-xl font-bold text-base hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                <Brain className="w-5 h-5" /> Lưu AI Keys
              </button>
            </>
          )}

          {/* ── Security Tab ── */}
          {tab === 'security' && (
            <div className="space-y-5">
              <div className="bg-[#161b25] border border-[#2a3045] rounded-2xl p-6 space-y-4 text-base">
                {[
                  { icon: '🔒', title: 'Lưu trữ cục bộ', desc: 'Tất cả API keys được mã hóa và lưu trong localStorage của trình duyệt. Keys KHÔNG gửi về bất kỳ server nào.' },
                  { icon: '🛡️', title: 'KHÔNG bật Withdraw', desc: 'Khi tạo API key trên MEXC, tuyệt đối không bật quyền rút tiền (Withdraw) để bảo vệ tài sản.' },
                  { icon: '🔑', title: 'Mỗi AI key riêng biệt', desc: 'Mỗi AI provider có key riêng. Nếu một key bị lộ, chỉ cần xóa key đó, không ảnh hưởng đến các key khác.' },
                  { icon: '⏸️', title: 'Kill Switch', desc: 'Luôn có nút dừng khẩn cấp (Kill Switch) để dừng tất cả auto-trade ngay lập tức.' },
                  { icon: '💰', title: 'Giới hạn thua lỗ', desc: 'Cài đặt Daily Loss Limit để bot tự động dừng nếu tổng thua lỗ trong ngày vượt mức cho phép.' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 p-4 bg-[#0b0e14] rounded-xl">
                    <span className="text-2xl shrink-0">{item.icon}</span>
                    <div>
                      <div className="font-semibold text-gray-300 text-sm mb-1.5">{item.title}</div>
                      <div className="text-gray-500 text-sm leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
