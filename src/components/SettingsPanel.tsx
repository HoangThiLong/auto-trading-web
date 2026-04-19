import {
  Key,
  Bot,
  BookOpen,
  Newspaper,
  ExternalLink,
  Shield,
  Brain,
  BarChart2,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { AI_PROVIDERS } from '../types';
import { useSettingsPanelState } from '../store/hooks';

export default function SettingsPanel() {
  const {
    setApiModalOpen,
    setAutoTradePanelOpen,
    setActiveTab,
    aiCredentials,
    autoTradeMode,
    autoTradeConfig,
  } = useSettingsPanelState();

  const activeAiProviders = AI_PROVIDERS.filter((provider) => aiCredentials?.[provider.id]);
  const hasAnyProviders = activeAiProviders.length > 0;

  const modeTone =
    autoTradeMode === 'live'
      ? 'border-[rgba(255,77,106,0.42)] bg-[var(--color-danger-dim)] text-[var(--color-danger)]'
      : autoTradeMode === 'simulation'
        ? 'border-[rgba(255,184,46,0.42)] bg-[var(--color-warning-dim)] text-[var(--color-warning)]'
        : 'border-[var(--border)] bg-[var(--bg-main)] text-[var(--text-muted)]';

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto bg-[var(--bg-panel)] p-4 text-[var(--text-main)]">
      <section className="coinbase-surface rounded-2xl p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl border border-[rgba(255,184,46,0.36)] bg-[var(--color-warning-dim)]">
            <BarChart2 className="h-5 w-5 text-[var(--color-warning)]" />
          </div>

          <div>
            <h2 className="text-base font-bold tracking-tight">System Configuration Center</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              MEXC Pro Futures Terminal • Runtime & AI orchestration
            </p>
          </div>

          <div className="ml-auto inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--bg-surface-soft)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em]">
            <span className={`inline-flex rounded-full border px-2 py-0.5 ${modeTone}`}>{autoTradeMode.toUpperCase()}</span>
            <span className="text-[var(--text-muted)]">Auto-Trade Mode</span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <button
          id="settings-api-keys-button"
          onClick={() => setApiModalOpen(true)}
          className="coinbase-surface group rounded-2xl p-4 text-left transition-all hover:-translate-y-[1px] hover:border-[rgba(255,184,46,0.42)]"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-[rgba(255,184,46,0.4)] bg-[var(--color-warning-dim)]">
              <Key className="h-4.5 w-4.5 text-[var(--color-warning)]" />
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--text-main)]">API Keys</div>
              <div className="text-[11px] text-[var(--text-muted)]">MEXC + AI provider credentials</div>
            </div>
            <ExternalLink className="ml-auto h-4 w-4 text-[var(--text-muted)] transition-colors group-hover:text-[var(--color-warning)]" />
          </div>
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            Quản lý khóa API để kích hoạt giao dịch live và nâng cấp chất lượng phân tích AI.
          </p>
        </button>

        <button
          id="settings-auto-trade-button"
          onClick={() => setAutoTradePanelOpen(true)}
          className="coinbase-surface group rounded-2xl p-4 text-left transition-all hover:-translate-y-[1px] hover:border-[rgba(0,82,255,0.42)]"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-[rgba(0,82,255,0.4)] bg-[var(--color-brand-dim)]">
              <Bot className="h-4.5 w-4.5 text-[var(--color-brand)]" />
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--text-main)]">Auto-Trade Bot</div>
              <div className="text-[11px] text-[var(--text-muted)]">Risk rules, schedule & execution</div>
            </div>
            <ExternalLink className="ml-auto h-4 w-4 text-[var(--text-muted)] transition-colors group-hover:text-[var(--accent-soft)]" />
          </div>
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            Điều chỉnh thông số chiến lược tự động: confidence, risk per trade, daily loss và bộ lọc tin tức.
          </p>
        </button>

        <button
          id="settings-news-button"
          onClick={() => setActiveTab('news')}
          className="coinbase-surface group rounded-2xl p-4 text-left transition-all hover:-translate-y-[1px] hover:border-[rgba(34,211,238,0.42)]"
        >
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-[rgba(34,211,238,0.4)] bg-[rgba(34,211,238,0.1)]">
              <Newspaper className="h-4.5 w-4.5 text-[var(--color-cyan)]" />
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--text-main)]">News & Sentiment</div>
              <div className="text-[11px] text-[var(--text-muted)]">CryptoPanic + market sentiment</div>
            </div>
            <ExternalLink className="ml-auto h-4 w-4 text-[var(--text-muted)] transition-colors group-hover:text-[var(--color-cyan)]" />
          </div>
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            Theo dõi luồng tin nóng và mood thị trường để hỗ trợ quyết định vào lệnh.
          </p>
        </button>

        <div className="coinbase-surface rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl border border-[rgba(139,92,246,0.4)] bg-[rgba(139,92,246,0.1)]">
              <BookOpen className="h-4.5 w-4.5 text-[#d8b8ff]" />
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--text-main)]">Tài liệu hướng dẫn</div>
              <div className="text-[11px] text-[var(--text-muted)]">Playbook vận hành hệ thống</div>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
            Mở file <strong>HDSD.md</strong> để xem luồng thiết lập, checklist an toàn và best practices trước khi trade live.
          </p>
        </div>
      </section>

      <section className="coinbase-surface rounded-2xl p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            <Brain className="h-4 w-4 text-[var(--accent-soft)]" />
            AI Provider Matrix
          </div>

          {hasAnyProviders ? (
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[rgba(0,230,138,0.42)] bg-[var(--color-success-dim)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-success)]">
              <CheckCircle2 className="h-3 w-3" />
              {activeAiProviders.length} active
            </span>
          ) : (
            <span className="ml-auto inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--bg-main)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Not configured
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {AI_PROVIDERS.map((provider) => {
            const active = !!aiCredentials?.[provider.id];
            return (
              <div
                key={provider.id}
                className={`rounded-xl border px-3 py-2.5 ${
                  active
                    ? 'bg-[var(--bg-main)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)]'
                    : 'border-[var(--border-soft)] bg-[var(--bg-surface-soft)]'
                }`}
                style={active ? { borderColor: `${provider.color}55` } : undefined}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: active ? provider.color : 'var(--text-muted)' }}
                  />
                  <span
                    className="text-sm font-semibold"
                    style={{ color: active ? provider.color : 'var(--text-secondary)' }}
                  >
                    {provider.name}
                  </span>
                  <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    {active ? 'Active' : 'Off'}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-[var(--text-muted)]">{provider.freeLimit}</div>
              </div>
            );
          })}
        </div>

        {!hasAnyProviders && (
          <button
            id="settings-add-ai-key-button"
            onClick={() => setApiModalOpen(true)}
            className="coinbase-pill-btn mt-3 w-full border-[rgba(0,82,255,0.45)] bg-[var(--color-brand)] py-2.5 text-xs font-extrabold uppercase tracking-[0.08em] text-white shadow-[0_12px_24px_rgba(0,82,255,0.32)] hover:bg-[var(--color-brand-hover)]"
          >
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Thêm AI API Key
            </span>
          </button>
        )}
      </section>

      <section className="coinbase-surface-soft rounded-2xl p-4">
        <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
          <Bot className="h-4 w-4 text-[var(--color-brand)]" />
          Auto-Trade Configuration Snapshot
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
          {[
            { label: 'Min confidence', value: `${autoTradeConfig.minConfidence}%` },
            { label: 'Risk per trade', value: `${autoTradeConfig.riskPercentPerTrade}%` },
            { label: 'Max concurrent orders', value: autoTradeConfig.maxConcurrentOrders },
            { label: 'Daily loss limit', value: `${autoTradeConfig.dailyLossLimit} USDT` },
            { label: 'News filter', value: autoTradeConfig.newsFilter ? 'Enabled' : 'Disabled' },
            { label: 'Trailing stop', value: autoTradeConfig.trailingStop ? 'Enabled' : 'Disabled' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between rounded-xl border border-[var(--border-soft)] bg-[var(--bg-main)] px-3 py-2.5 text-sm">
              <span className="text-[var(--text-muted)]">{label}</span>
              <span className="font-mono font-bold text-[var(--text-main)]">{value}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-[rgba(0,230,138,0.35)] bg-[linear-gradient(150deg,rgba(0,230,138,0.1),rgba(11,16,30,0.96))] p-4">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-success)]" />
          <div>
            <h3 className="text-sm font-bold text-[var(--color-success)]">Security Policy</h3>
            <p className="mt-1 text-xs leading-relaxed text-[var(--text-secondary)]">
              API keys được lưu cục bộ trong trình duyệt. Không gửi đến server bên thứ ba.
              Luôn bảo mật Secret Key và chỉ cấp quyền tối thiểu cần thiết.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
