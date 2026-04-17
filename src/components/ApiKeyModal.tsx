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
  const [mexcTouched, setMexcTouched] = useState(false);

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

  const isApiKeyInvalid = mexcTouched && !apiKey.trim();
  const isSecretInvalid = mexcTouched && !secretKey.trim();

  const testMexcConnection = async () => {
    setMexcTouched(true);
    if (!apiKey || !secretKey) {
      toast.error('Nhập API key và Secret key');
      return;
    }

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
      <div className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setApiModalOpen(false)} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--bg-panel)] shadow-[0_35px_90px_rgba(2,6,23,0.85)]">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-[var(--border-soft)] bg-gradient-to-r from-[rgba(15,21,32,0.95)] to-[rgba(22,27,39,0.92)] px-6 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(0,82,255,0.14)]">
            <Key className="h-5 w-5 text-[var(--color-brand-hover)]" />
          </div>
          <div>
            <div className="text-base font-bold text-white">Quản lý API Keys</div>
            <div className="mt-0.5 text-xs text-[var(--text-muted)]">Bảo mật & kết nối</div>
          </div>
          <button
            id="apikey-modal-close-button"
            onClick={() => setApiModalOpen(false)}
            className="ml-auto rounded-lg p-1.5 text-[var(--text-muted)] transition-all hover:bg-[rgba(87,139,250,0.14)] hover:text-white"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[var(--border-soft)]">
          {([
            { id: 'mexc', icon: Wifi, label: 'MEXC API' },
            { id: 'ai', icon: Brain, label: 'AI Models' },
            { id: 'security', icon: Shield, label: 'Bảo mật' },
          ] as const).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex flex-1 items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-all ${
                tab === id
                  ? 'border-b-2 border-[var(--color-brand)] bg-[rgba(0,82,255,0.1)] text-[#b7ceff]'
                  : 'text-[var(--text-muted)] hover:text-[#d9e7ff]'
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <div className="max-h-[74vh] space-y-4 overflow-y-auto p-6">
          {/* ── MEXC Tab ── */}
          {tab === 'mexc' && (
            <>
              {/* Status */}
              <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-base ${
                credentials
                  ? 'border-[rgba(14,203,129,0.4)] bg-[rgba(14,203,129,0.12)] text-[#95f4ca]'
                  : 'border-[var(--border)] bg-[rgba(22,27,39,0.75)] text-[var(--text-muted)]'
              }`}>
                {credentials ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                {credentials ? 'MEXC API Key đã được lưu' : 'Chưa cấu hình MEXC API Key'}
              </div>

              {/* Warning */}
              <div className="flex items-start gap-3 rounded-xl border border-[rgba(240,185,11,0.35)] bg-[rgba(240,185,11,0.12)] p-4 text-sm text-[#ffd77d]">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="mb-1.5 font-bold">Lưu ý về Futures API MEXC</div>
                  <div className="leading-relaxed">Đặt lệnh Futures qua API yêu cầu tài khoản tổ chức (institutional). Người dùng cá nhân vẫn xem được dữ liệu thị trường đầy đủ.</div>
                </div>
              </div>

              {/* Inputs */}
              <div className="coinbase-surface-soft rounded-2xl p-5">
                <div className="space-y-4">
                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-wider text-[var(--text-muted)]">API KEY</label>
                    <input
                      id="mexc-api-key-input"
                      type="text"
                      value={apiKey}
                      onChange={e => setApiKey(e.target.value)}
                      placeholder="Dán API Key từ MEXC..."
                      className={`w-full rounded-xl border bg-[var(--bg-main)] px-4 py-3 font-mono text-base text-white placeholder-[var(--text-muted)] transition-all focus:outline-none focus:ring-2 ${
                        isApiKeyInvalid
                          ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[rgba(246,70,93,0.32)]'
                          : 'border-[var(--border)] focus:border-[var(--color-brand)] focus:ring-[rgba(0,82,255,0.32)]'
                      }`}
                    />
                    {isApiKeyInvalid && <p className="mt-1 text-xs text-[var(--color-danger)]">API Key không được để trống.</p>}
                  </div>

                  <div>
                    <label className="mb-2 block text-xs uppercase tracking-wider text-[var(--text-muted)]">SECRET KEY</label>
                    <div className="relative">
                      <input
                        id="mexc-secret-key-input"
                        type={showSecret ? 'text' : 'password'}
                        value={secretKey}
                        onChange={e => setSecretKey(e.target.value)}
                        placeholder="Dán Secret Key từ MEXC..."
                        className={`w-full rounded-xl border bg-[var(--bg-main)] px-4 py-3 pr-12 font-mono text-base text-white placeholder-[var(--text-muted)] transition-all focus:outline-none focus:ring-2 ${
                          isSecretInvalid
                            ? 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[rgba(246,70,93,0.32)]'
                            : 'border-[var(--border)] focus:border-[var(--color-brand)] focus:ring-[rgba(0,82,255,0.32)]'
                        }`}
                      />
                      <button
                        id="mexc-secret-toggle-button"
                        onClick={() => setShowSecret(v => !v)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition-colors hover:text-white"
                      >
                        {showSecret ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {isSecretInvalid && <p className="mt-1 text-xs text-[var(--color-danger)]">Secret Key không được để trống.</p>}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      id="mexc-connect-save-button"
                      onClick={testMexcConnection}
                      disabled={testing}
                      className="coinbase-pill-btn flex flex-1 items-center justify-center gap-2 bg-[var(--color-brand)] py-3 text-base font-bold text-white shadow-[0_12px_26px_rgba(0,82,255,0.35)] transition-all hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Wifi className="h-5 w-5" />
                      {testing ? 'Đang kiểm tra...' : 'Kết nối & Lưu'}
                    </button>
                    {credentials && (
                      <button
                        id="mexc-clear-keys-button"
                        onClick={() => {
                          setCredentials(null);
                          setIsApiConnected(false);
                          setApiKey('');
                          setSecretKey('');
                          setMexcTouched(false);
                          toast.success('Đã xóa');
                        }}
                        className="rounded-xl border border-[rgba(246,70,93,0.42)] bg-[rgba(246,70,93,0.12)] px-6 py-3 text-base font-bold text-[var(--color-danger)] transition-all hover:bg-[rgba(246,70,93,0.2)]"
                      >
                        Xóa
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Guide */}
              <div className="coinbase-surface-soft rounded-2xl p-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#cfdcf8]">
                  <Shield className="h-4 w-4 text-[var(--color-brand-hover)]" /> Hướng dẫn tạo API Key
                </div>
                <ol className="space-y-2 text-sm text-[var(--text-muted)]">
                  {['Đăng nhập MEXC.com', 'Vào Profile → API Management', 'Tạo API Key mới — bật quyền Trade', 'KHÔNG bật quyền Withdraw', 'Copy 2 mã vào form trên'].map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="shrink-0 font-bold text-[var(--color-warning)]">{i + 1}.</span>{s}
                    </li>
                  ))}
                </ol>
                <a
                  href="https://www.mexc.com/user/openapi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex items-center gap-1.5 text-sm font-medium text-[var(--color-brand-hover)] transition-colors hover:text-white"
                >
                  <ExternalLink className="h-4 w-4" /> Mở trang quản lý API MEXC
                </a>
              </div>
            </>
          )}

          {/* ── AI Tab ── */}
          {tab === 'ai' && (
            <>
              <div className="flex items-start gap-3 rounded-xl border border-[rgba(0,82,255,0.35)] bg-[rgba(0,82,255,0.12)] p-4 text-sm text-[#b7ceff]">
                <Zap className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="mb-1 font-bold">Tất cả miễn phí!</div>
                  <div className="leading-relaxed">Nhập ít nhất 1 AI API key để kích hoạt phân tích AI. Hệ thống sẽ tự động chuyển sang provider khác khi hết quota.</div>
                </div>
              </div>

              {/* Priority selector */}
              <div className="coinbase-surface-soft rounded-2xl p-5">
                <label className="mb-3 block text-xs uppercase tracking-wider text-[var(--text-muted)]">AI Ưu tiên</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {AI_PROVIDERS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPreferredProvider(p.id)}
                      className={`flex items-center justify-center gap-2.5 rounded-xl border px-4 py-3 text-sm transition-all ${
                        preferredProvider === p.id
                          ? 'border-current bg-current/10 font-bold'
                          : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[rgba(148,163,184,0.6)] hover:text-white'
                      }`}
                      style={{ color: preferredProvider === p.id ? p.color : undefined }}
                    >
                      <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
                      {p.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>

              {/* AI Keys */}
              <div className="space-y-4">
                {AI_PROVIDERS.map(provider => (
                  <div key={provider.id} className="coinbase-surface-soft rounded-2xl p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ background: provider.color }} />
                        <span className="text-base font-semibold text-white">{provider.name}</span>
                        {aiKeys[provider.id] && (
                          <span className="rounded-full bg-[rgba(14,203,129,0.2)] px-2 py-1 text-xs text-[#95f4ca]">✓ Có key</span>
                        )}
                      </div>
                      <span className="text-xs text-[var(--text-muted)]">{provider.freeLimit}</span>
                    </div>
                    <div className="relative">
                      <input
                        type={showAiKeys[provider.id] ? 'text' : 'password'}
                        value={aiKeys[provider.id]}
                        onChange={e => setAiKeys(prev => ({ ...prev, [provider.id]: e.target.value }))}
                        placeholder={`${provider.name} API Key...`}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-main)] px-4 py-3 pr-12 font-mono text-sm text-white placeholder-[var(--text-muted)] transition-all focus:outline-none focus:ring-2"
                        style={{ borderColor: aiKeys[provider.id] ? provider.color : undefined, boxShadow: 'none' }}
                      />
                      <button
                        onClick={() => setShowAiKeys(p => ({ ...p, [provider.id]: !p[provider.id] }))}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] transition-colors hover:text-white"
                      >
                        {showAiKeys[provider.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <a
                      href={provider.getKeyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2.5 flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                      style={{ color: provider.color }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Lấy API Key miễn phí
                    </a>
                  </div>
                ))}

                {/* CryptoPanic */}
                <div className="coinbase-surface-soft rounded-2xl p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                      <span className="text-base font-semibold text-white">CryptoPanic (Tin tức)</span>
                      <span className="text-xs italic text-[var(--text-muted)]">Không bắt buộc</span>
                    </div>
                  </div>
                  <input
                    type={showAiKeys.cryptopanic ? 'text' : 'password'}
                    value={aiKeys.cryptopanic}
                    onChange={e => setAiKeys(prev => ({ ...prev, cryptopanic: e.target.value }))}
                    placeholder="CryptoPanic API Key (optional)..."
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-main)] px-4 py-3 font-mono text-sm text-white placeholder-[var(--text-muted)] transition-all focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-400/30"
                  />
                  <div className="mt-2.5 flex items-center justify-between">
                    <a href="https://cryptopanic.com/developers/api/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-medium text-orange-400 hover:opacity-80">
                      <ExternalLink className="h-3.5 w-3.5" /> Lấy API Key miễn phí
                    </a>
                    <button
                      onClick={() => setShowAiKeys(p => ({ ...p, cryptopanic: !p.cryptopanic }))}
                      className="text-[var(--text-muted)] transition-colors hover:text-white"
                    >
                      {showAiKeys.cryptopanic ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                id="save-ai-keys-button"
                onClick={saveAiKeys}
                disabled={!hasAnyAiKey}
                className="coinbase-pill-btn flex w-full items-center justify-center gap-2 bg-[var(--color-brand)] py-3.5 text-base font-bold text-white shadow-[0_12px_26px_rgba(0,82,255,0.35)] transition-all hover:bg-[var(--color-brand-hover)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Brain className="h-5 w-5" /> Lưu AI Keys
              </button>
            </>
          )}

          {/* ── Security Tab ── */}
          {tab === 'security' && (
            <div className="space-y-5">
              <div className="coinbase-surface-soft space-y-4 rounded-2xl p-6 text-base">
                {[
                  { icon: '🔒', title: 'Lưu trữ cục bộ', desc: 'Tất cả API keys được mã hóa và lưu trong localStorage của trình duyệt. Keys KHÔNG gửi về bất kỳ server nào.' },
                  { icon: '🛡️', title: 'KHÔNG bật Withdraw', desc: 'Khi tạo API key trên MEXC, tuyệt đối không bật quyền rút tiền (Withdraw) để bảo vệ tài sản.' },
                  { icon: '🔑', title: 'Mỗi AI key riêng biệt', desc: 'Mỗi AI provider có key riêng. Nếu một key bị lộ, chỉ cần xóa key đó, không ảnh hưởng đến các key khác.' },
                  { icon: '⏸️', title: 'Kill Switch', desc: 'Luôn có nút dừng khẩn cấp (Kill Switch) để dừng tất cả auto-trade ngay lập tức.' },
                  { icon: '💰', title: 'Giới hạn thua lỗ', desc: 'Cài đặt Daily Loss Limit để bot tự động dừng nếu tổng thua lỗ trong ngày vượt mức cho phép.' },
                ].map((item, i) => (
                  <div key={i} className="rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] p-4">
                    <div className="flex gap-4">
                      <span className="shrink-0 text-2xl">{item.icon}</span>
                      <div>
                        <div className="mb-1.5 text-sm font-semibold text-[#d8e3fb]">{item.title}</div>
                        <div className="text-sm leading-relaxed text-[var(--text-muted)]">{item.desc}</div>
                      </div>
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
