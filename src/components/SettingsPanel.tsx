import { Key, Bot, BookOpen, Newspaper, ExternalLink, Shield, Brain, BarChart2 } from 'lucide-react';
import { AI_PROVIDERS } from '../types';
import { useSettingsPanelState } from '../store/hooks';

export default function SettingsPanel() {
  const { setApiModalOpen, setAutoTradePanelOpen, setActiveTab, aiCredentials, autoTradeMode, autoTradeConfig } = useSettingsPanelState();

  const activeAiProviders = AI_PROVIDERS.filter(p => aiCredentials?.[p.id]);
  const hasAny = activeAiProviders.length > 0;

  return (
    <div className="p-6 text-white max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-2xl bg-[#f0b90b]/10 flex items-center justify-center">
          <BarChart2 className="w-6 h-6 text-[#f0b90b]" />
        </div>
        <div>
          <h2 className="font-black text-xl">Cài đặt hệ thống</h2>
          <p className="text-sm text-gray-500 mt-1">MEXC Pro Futures Terminal v2.0</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* API Keys */}
        <button onClick={() => setApiModalOpen(true)}
          className="flex items-center gap-5 p-5 bg-[#161b25] border border-[#2a3045] rounded-2xl hover:border-[#f0b90b]/40 hover:bg-[#f0b90b]/5 transition-all text-left group">
          <div className="w-12 h-12 rounded-xl bg-[#f0b90b]/10 flex items-center justify-center shrink-0 group-hover:bg-[#f0b90b]/20 transition-colors">
            <Key className="w-6 h-6 text-[#f0b90b]" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-base text-white">API Keys</div>
            <div className="text-sm text-gray-500 truncate mt-1">MEXC + AI Providers</div>
          </div>
          <ExternalLink className="w-5 h-5 text-gray-600 ml-auto shrink-0 group-hover:text-gray-400" />
        </button>

        {/* Auto-Trade */}
        <button onClick={() => setAutoTradePanelOpen(true)}
          className="flex items-center gap-5 p-5 bg-[#161b25] border border-[#2a3045] rounded-2xl hover:border-blue-500/40 hover:bg-blue-500/5 transition-all text-left group">
          <div className="w-12 h-12 rounded-xl bg-blue-900/30 flex items-center justify-center shrink-0">
            <Bot className="w-6 h-6 text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-base text-white">Auto-Trade Bot</div>
            <div className="text-sm text-gray-500 mt-1">
              {autoTradeMode !== 'off'
                ? <span className={autoTradeMode === 'live' ? 'text-red-400' : 'text-yellow-400'}>● {autoTradeMode.toUpperCase()} đang chạy</span>
                : 'Tắt — kích hoạt tại đây'}
            </div>
          </div>
          <ExternalLink className="w-5 h-5 text-gray-600 ml-auto shrink-0 group-hover:text-gray-400" />
        </button>

        {/* News */}
        <button onClick={() => setActiveTab('news')}
          className="flex items-center gap-5 p-5 bg-[#161b25] border border-[#2a3045] rounded-2xl hover:border-orange-500/40 hover:bg-orange-500/5 transition-all text-left group">
          <div className="w-12 h-12 rounded-xl bg-orange-900/20 flex items-center justify-center shrink-0">
            <Newspaper className="w-6 h-6 text-orange-400" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-base text-white">Tin tức & Sentiment</div>
            <div className="text-sm text-gray-500 mt-1">CryptoPanic + CryptoCompare</div>
          </div>
          <ExternalLink className="w-5 h-5 text-gray-600 ml-auto shrink-0 group-hover:text-gray-400" />
        </button>

        {/* User Guide */}
        <div className="flex items-center gap-5 p-5 bg-[#161b25] border border-[#2a3045] rounded-2xl">
          <div className="w-12 h-12 rounded-xl bg-purple-900/20 flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6 text-purple-400" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-base text-white">Hướng dẫn sử dụng</div>
            <div className="text-sm text-gray-500 mt-1">Xem file HDSD.md</div>
          </div>
        </div>
      </div>

      {/* AI Provider Status */}
      <div className="bg-[#161b25] border border-[#2a3045] rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Brain className="w-5 h-5 text-[#f0b90b]" />
          <span className="font-bold text-base">AI Provider Status</span>
          {hasAny
            ? <span className="text-xs bg-green-900/50 text-green-400 px-3 py-1 rounded-full ml-auto">{activeAiProviders.length} provider active</span>
            : <span className="text-xs bg-gray-900 text-gray-500 px-3 py-1 rounded-full ml-auto">Chưa cấu hình</span>}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {AI_PROVIDERS.map(provider => {
            const active = !!aiCredentials?.[provider.id];
            return (
              <div key={provider.id} className={`flex items-center gap-3 p-3 rounded-xl border ${active ? 'border-current/20' : 'border-[#2a3045]'}`}
                style={active ? { borderColor: provider.color + '40', background: provider.color + '10' } : {}}>
                <div className="w-3 h-3 rounded-full" style={{ background: active ? provider.color : '#3a4055' }} />
                <span className="text-sm font-medium" style={{ color: active ? provider.color : '#6b7280' }}>{provider.name.split(' ')[0]}</span>
                {active && <span className="text-[10px] text-gray-500 ml-auto">{provider.freeLimit.split('/')[0]}</span>}
              </div>
            );
          })}
        </div>
        {!hasAny && (
          <button onClick={() => setApiModalOpen(true)}
            className="w-full mt-4 py-3 bg-[#f0b90b]/10 border border-[#f0b90b]/30 text-[#f0b90b] rounded-xl text-sm font-bold hover:bg-[#f0b90b]/20 transition-colors">
            + Thêm AI API Key (Miễn phí)
          </button>
        )}
      </div>

      {/* Auto-trade quick status */}
      <div className="bg-[#161b25] border border-[#2a3045] rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Bot className="w-5 h-5 text-blue-400" />
          <span className="font-bold text-base">Auto-Trade Config</span>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { label: 'Min Confidence', value: `${autoTradeConfig.minConfidence}%` },
            { label: 'Risk/trade', value: `${autoTradeConfig.riskPercentPerTrade}%` },
            { label: 'Lệnh đồng thời', value: autoTradeConfig.maxConcurrentOrders },
            { label: 'Daily Loss Limit', value: `${autoTradeConfig.dailyLossLimit} USDT` },
            { label: 'News Filter', value: autoTradeConfig.newsFilter ? '✅ Bật' : '❌ Tắt' },
            { label: 'Trailing Stop', value: autoTradeConfig.trailingStop ? '✅ Bật' : '❌ Tắt' },
          ].map(({ label, value }) => (
            <div key={label} className="flex justify-between p-3 bg-[#0b0e14] rounded-xl">
              <span className="text-gray-500">{label}</span>
              <span className="font-bold text-gray-300">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Security */}
      <div className="flex items-start gap-4 p-5 bg-[#0b0e14] border border-[#2a3045] rounded-2xl">
        <Shield className="w-6 h-6 text-green-500 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-base text-green-400 mb-1.5">Keys được bảo vệ an toàn</div>
          <div className="text-sm text-gray-500 leading-relaxed">
            Tất cả API keys lưu cục bộ trong trình duyệt, không gửi đến bất kỳ server nào.
            Không bao giờ chia sẻ Secret Key với bất kỳ ai.
          </div>
        </div>
      </div>

      <div className="text-center text-[10px] text-gray-700">
        MEXC Pro Futures Terminal v2.0 • Developed with ❤️ • Not financial advice
      </div>
    </div>
  );
}
