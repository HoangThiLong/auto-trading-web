import { useState, useEffect } from 'react';
import { fetchAccountInfo, setRuntimeMexcNetwork } from '../services/mexcApi';
import { AI_PROVIDERS, type AiProviderId } from '../types';
import toast from 'react-hot-toast';
import {
  X, Key, Brain, Shield, Eye, EyeOff, ExternalLink,
  CheckCircle, XCircle, Wifi, AlertTriangle, Zap, Bot,
} from 'lucide-react';
import { useApiKeyModalState } from '../store/hooks';
import { useStore } from '../store/useStore';

/** Mask an API key for display: show first 4 chars + last 4 chars */
function maskKey(key: string | undefined): string {
  if (!key || key.length < 8) return '••••••••';
  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

export default function ApiKeyModal() {
  const {
    apiModalOpen, setApiModalOpen,
    credentials, setCredentials, setIsApiConnected,
    aiCredentials, setAiCredentials,
    mexcNetwork, setMexcNetwork,
  } = useApiKeyModalState();

  const [tab, setTab] = useState<'mexc' | 'ai' | 'telegram' | 'security'>('mexc');
  const [apiKey, setApiKey] = useState(credentials?.apiKey || '');
  const [secretKey, setSecretKey] = useState(credentials?.secretKey || '');
  const [network, setNetwork] = useState<'live' | 'demo'>(mexcNetwork || 'live');
  const [showSecret, setShowSecret] = useState(false);
  const [testing, setTesting] = useState(false);
  const [mexcTouched, setMexcTouched] = useState(false);

  // ── Hydration sync: re-populate local state when zustand persist rehydrates ──
  useEffect(() => {
    if (credentials?.apiKey && !apiKey) setApiKey(credentials.apiKey);
    if (credentials?.secretKey && !secretKey) setSecretKey(credentials.secretKey);
  }, [credentials]);

  useEffect(() => {
    if (mexcNetwork) setNetwork(mexcNetwork);
  }, [mexcNetwork]);

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

  useEffect(() => {
    if (aiCredentials) {
      setAiKeys({
        gemini: aiCredentials.gemini || '',
        groq: aiCredentials.groq || '',
        openrouter: aiCredentials.openrouter || '',
        together: aiCredentials.together || '',
        cryptopanic: aiCredentials.cryptopanic || '',
      });
      if (aiCredentials.preferredProvider) {
        setPreferredProvider(aiCredentials.preferredProvider);
      }
    }
  }, [aiCredentials]);

  // Telegram keys state
  const telegramCreds = useStore((state) => state.telegramCredentials);
  const setTelegramCreds = useStore((state) => state.setTelegramCredentials);

  const [telegramBotToken, setTelegramBotToken] = useState(telegramCreds?.botToken || '');
  const [telegramChatId, setTelegramChatId] = useState(telegramCreds?.adminChatId || '');

  useEffect(() => {
    if (telegramCreds?.botToken && !telegramBotToken) setTelegramBotToken(telegramCreds.botToken);
    if (telegramCreds?.adminChatId && !telegramChatId) setTelegramChatId(telegramCreds.adminChatId);
  }, [telegramCreds]);

  const saveTelegramKeys = () => {
    if (!telegramBotToken.trim() || !telegramChatId.trim()) {
      toast.error('Vui lòng nhập Bot Token và Chat ID');
      return;
    }
    setTelegramCreds({ botToken: telegramBotToken, adminChatId: telegramChatId });
    toast.success('✅ Đã lưu cấu hình Telegram!');
  };

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
    // IMPORTANT: Set runtime network switching immediately so signed requests hit correct endpoint
    setRuntimeMexcNetwork(network);

    try {
      // First, save credentials with the selected network
      setCredentials({ apiKey, secretKey, mexcNetwork: network });
      setMexcNetwork(network);

      // Test the connection by fetching account info
      const info = await fetchAccountInfo(apiKey, secretKey);

      // ONLY set connected=true if we got a valid authenticated response
      if (info) {
        setIsApiConnected(true);
        toast.success('✅ MEXC API kết nối thành công!');
      } else {
        // API call returned null/error - reset connected state
        setIsApiConnected(false);
        toast('⚠️ API key đã lưu — dữ liệu thị trường hoạt động bình thường', { duration: 5000 });
      }
    } catch (err: any) {
      // IMPORTANT: On any error, reset connection state to false
      setIsApiConnected(false);
      // Keep credentials saved so user can edit/fix them
      console.error('[API Modal] Connection test failed:', err);
      toast.error(`Không thể kết nối MEXC: ${err?.message || 'Lỗi không xác định'}`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6">
      {/* Backdrop */}
      <div className="modal-backdrop absolute inset-0" onClick={() => setApiModalOpen(false)} />

      {/* Modal */}
      <div className="premium-modal-shell relative w-full max-w-3xl overflow-hidden rounded-[28px]">
        {/* Header */}
        <div className="relative z-10 flex items-center gap-4 border-b border-[var(--border-soft)] bg-gradient-to-r from-[rgba(12,18,36,0.98)] via-[rgba(17,24,44,0.96)] to-[rgba(12,18,36,0.98)] px-6 py-5">
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
        <div className="relative z-10 flex border-b border-[var(--border-soft)] bg-[rgba(255,255,255,0.01)]">
          {([
            { id: 'mexc', icon: Wifi, label: 'MEXC API' },
            { id: 'ai', icon: Brain, label: 'AI Models' },
            { id: 'telegram', icon: Bot, label: 'Telegram' },
            { id: 'security', icon: Shield, label: 'Bảo mật' },
          ] as const).map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`premium-tab-btn flex flex-1 items-center justify-center gap-2 py-3.5 text-sm font-semibold ${
                tab === id ? 'premium-tab-btn-active' : ''
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>

        <div className="relative z-10 max-h-[74vh] space-y-4 overflow-y-auto p-6">
          {/* ── MEXC Tab ── */}
          {tab === 'mexc' && (
            <>
              {/* Status — 3 states: verified / saved / empty */}
              <div className={`rounded-xl border px-4 py-3 ${
                credentials && useStore.getState().isApiConnected
                  ? 'border-[rgba(14,203,129,0.4)] bg-[rgba(14,203,129,0.12)] text-[#95f4ca]'
                  : credentials
                  ? 'border-[rgba(255,184,46,0.4)] bg-[rgba(255,184,46,0.12)] text-[#ffd77d]'
                  : 'border-[var(--border)] bg-[rgba(22,27,39,0.75)] text-[var(--text-muted)]'
              }`}>
                <div className="flex items-center gap-3 text-base">
                  {credentials && useStore.getState().isApiConnected
                    ? <CheckCircle className="h-5 w-5" />
                    : credentials
                    ? <AlertTriangle className="h-5 w-5" />
                    : <XCircle className="h-5 w-5" />}
                  {credentials && useStore.getState().isApiConnected
                    ? 'API Key đã xác minh — Kết nối thành công'
                    : credentials
                    ? 'API Key đã lưu — Chưa xác minh kết nối'
                    : 'Chưa cấu hình MEXC API Key'}
                </div>
                {credentials && (
                  <div className="mt-2 flex flex-wrap gap-3 border-t border-[rgba(255,255,255,0.08)] pt-2 text-xs">
                    <span className="font-mono opacity-80">
                      <span className="text-[var(--text-muted)]">API: </span>{maskKey(credentials.apiKey)}
                    </span>
                    <span className="font-mono opacity-80">
                      <span className="text-[var(--text-muted)]">Secret: </span>{maskKey(credentials.secretKey)}
                    </span>
                    <span className="opacity-60">
                      {credentials.mexcNetwork === 'demo' ? '🧪 Demo' : '🟢 Live'}
                    </span>
                  </div>
                )}
              </div>

              {/* Warning */}
              <div className="flex items-start gap-3 rounded-xl border border-[rgba(240,185,11,0.35)] bg-[rgba(240,185,11,0.12)] p-4 text-sm text-[#ffd77d]">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="mb-1.5 font-bold">Lưu ý về Futures API MEXC</div>
                  <div className="leading-relaxed">Đặt lệnh Futures qua API yêu cầu tài khoản từ sàn (institutional). Người dùng cá nhân vẫn xem được dữ liệu thị trường đầy đủ.</div>
                </div>
              </div>

              {/* Network Selector */}
              <div className="premium-section-card rounded-2xl p-5">
                <label className="mb-3 block text-xs uppercase tracking-wider text-[var(--text-muted)]">Môi trường</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setNetwork('live')}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
                      network === 'live'
                        ? 'border-[rgba(14,203,129,0.5)] bg-[rgba(14,203,129,0.15)] text-[#95f4ca]'
                        : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[rgba(148,163,184,0.5)] hover:text-white'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${network === 'live' ? 'bg-[#10b981]' : 'bg-[var(--border)]'}`} />
                    Live (Tiền thật)
                  </button>
                  <button
                    onClick={() => setNetwork('demo')}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-all ${
                      network === 'demo'
                        ? 'border-[rgba(59,130,246,0.5)] bg-[rgba(59,130,246,0.15)] text-[#60a5fa]'
                        : 'border-[var(--border)] text-[var(--text-muted)] hover:border-[rgba(148,163,184,0.5)] hover:text-white'
                    }`}
                  >
                    <span className={`h-2 w-2 rounded-full ${network === 'demo' ? 'bg-[#3b82f6]' : 'bg-[var(--border)]'}`} />
                    Demo (Giả lập)
                  </button>
                </div>
                {network === 'demo' && (
                  <p className="mt-3 text-xs text-amber-400">
                    ⚠️ MEXC không có API Testnet tách riêng cho Futures; Demo và Live dùng chung hệ API/key, chỉ khác chế độ tài khoản bạn chọn trên sàn.
                  </p>
                )}
              </div>

              {/* Inputs */}
              <div className="premium-section-card rounded-2xl p-5">
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
              <div className="premium-section-card rounded-2xl p-5">
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

              {/* AI Keys Status Summary */}
              {aiCredentials && Object.values(aiCredentials).some(v => typeof v === 'string' && v.length > 0) && (
                <div className="flex items-center gap-3 rounded-xl border border-[rgba(14,203,129,0.4)] bg-[rgba(14,203,129,0.08)] px-4 py-3 text-sm text-[#95f4ca]">
                  <CheckCircle className="h-5 w-5 shrink-0" />
                  <div>
                    <div className="font-semibold">AI đã cấu hình</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs opacity-80">
                      {aiCredentials.gemini && <span className="rounded-full bg-[rgba(66,133,244,0.2)] px-2 py-0.5">Gemini ✓</span>}
                      {aiCredentials.groq && <span className="rounded-full bg-[rgba(245,80,54,0.2)] px-2 py-0.5">Groq ✓</span>}
                      {aiCredentials.openrouter && <span className="rounded-full bg-[rgba(124,58,237,0.2)] px-2 py-0.5">OpenRouter ✓</span>}
                      {aiCredentials.together && <span className="rounded-full bg-[rgba(5,150,105,0.2)] px-2 py-0.5">Together ✓</span>}
                      {aiCredentials.cryptopanic && <span className="rounded-full bg-[rgba(249,115,22,0.2)] px-2 py-0.5">CryptoPanic ✓</span>}
                      {aiCredentials.preferredProvider && (
                        <span className="text-[var(--text-muted)]">• Ưu tiên: {aiCredentials.preferredProvider}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Priority selector */}
              <div className="premium-section-card rounded-2xl p-5">
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
                  <div key={provider.id} className="premium-section-card rounded-2xl p-5">
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
                <div className="premium-section-card rounded-2xl p-5">
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
              <div className="premium-section-card space-y-4 rounded-2xl p-6 text-base">
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
          {/* ── Telegram Tab ── */}
          {tab === 'telegram' && (
            <div className="space-y-5">
              <div className="flex items-start gap-3 rounded-xl border border-[rgba(0,82,255,0.35)] bg-[rgba(0,82,255,0.12)] p-4 text-sm text-[#b7ceff]">
                <Zap className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <div className="mb-1 font-bold">Nhận thông báo qua Telegram</div>
                  <div className="leading-relaxed">Nhập Bot Token và Chat ID để nhận thông báo khi có lệnh mới hoặc trạng thái bot thay đổi.</div>
                </div>
              </div>

              {telegramCreds?.botToken && telegramCreds?.adminChatId && (
                <div className="flex items-center gap-3 rounded-xl border border-[rgba(14,203,129,0.4)] bg-[rgba(14,203,129,0.08)] px-4 py-3 text-sm text-[#95f4ca]">
                  <CheckCircle className="h-5 w-5 shrink-0" />
                  <div>
                    <div className="font-semibold">Telegram đã cấu hình</div>
                    <div className="mt-1 flex gap-3 text-xs font-mono opacity-80">
                      <span>Bot: {maskKey(telegramCreds.botToken)}</span>
                      <span>Chat: {telegramCreds.adminChatId}</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="premium-section-card space-y-4 rounded-2xl p-6">
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-wider text-[var(--text-muted)]">Bot Token</label>
                  <input
                    id="telegram-bot-token-input"
                    type="text"
                    value={telegramBotToken}
                    onChange={e => setTelegramBotToken(e.target.value)}
                    placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz..."
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-main)] px-4 py-3 font-mono text-sm text-white placeholder-[var(--text-muted)] transition-all focus:border-[var(--color-brand)] focus:outline-none focus:ring-2"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-xs uppercase tracking-wider text-[var(--text-muted)]">Admin Chat ID</label>
                  <input
                    id="telegram-chat-id-input"
                    type="text"
                    value={telegramChatId}
                    onChange={e => setTelegramChatId(e.target.value)}
                    placeholder="123456789"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-main)] px-4 py-3 font-mono text-sm text-white placeholder-[var(--text-muted)] transition-all focus:border-[var(--color-brand)] focus:outline-none focus:ring-2"
                  />
                </div>
                <button
                  id="save-telegram-keys-button"
                  onClick={saveTelegramKeys}
                  className="coinbase-pill-btn flex w-full items-center justify-center gap-2 bg-[var(--color-brand)] py-3.5 text-base font-bold text-white shadow-[0_12px_26px_rgba(0,82,255,0.35)] transition-all hover:bg-[var(--color-brand-hover)]"
                >
                  <Bot className="h-5 w-5" /> Lưu cấu hình Telegram
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
