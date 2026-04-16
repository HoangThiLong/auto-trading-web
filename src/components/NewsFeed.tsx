import { useEffect } from 'react';
import { fetchCryptoPanicNews, analyzeNewsSentiment } from '../services/newsService';
import { TrendingUp, TrendingDown, Minus, ExternalLink, Loader } from 'lucide-react';
import { useNewsFeedState } from '../store/hooks';

export default function NewsFeed() {
  const { news, setNews, marketSentiment, setMarketSentiment, newsLoading, setNewsLoading, aiCredentials } = useNewsFeedState();

  useEffect(() => {
    const load = async () => {
      setNewsLoading(true);
      try {
        const fetched = await fetchCryptoPanicNews(aiCredentials?.cryptopanic);
        if (fetched.length > 0) {
          setNews(fetched);
          setMarketSentiment(analyzeNewsSentiment(fetched));
        }
      } finally {
        setNewsLoading(false);
      }
    };
    load();
    const id = setInterval(load, 5 * 60 * 1000); // refresh every 5 minutes
    return () => clearInterval(id);
  }, [aiCredentials?.cryptopanic]);

  const sentimentConfig = {
    BULLISH:  { icon: TrendingUp,   color: '#0ecb81', label: 'BULLISH',  bg: 'bg-green-950/30 border-green-900/40' },
    BEARISH:  { icon: TrendingDown, color: '#f0b90b', label: 'BEARISH',  bg: 'bg-yellow-950/30 border-yellow-900/40' },
    FEARFUL:  { icon: TrendingDown, color: '#f6465d', label: 'FEARFUL',  bg: 'bg-red-950/30 border-red-900/40' },
    NEUTRAL:  { icon: Minus,        color: '#6b7280', label: 'NEUTRAL',  bg: 'bg-[#161b25] border-[#2a3045]' },
  };

  const sc = sentimentConfig[marketSentiment];
  const Icon = sc.icon;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sentiment header */}
      <div className={`flex items-center gap-3 px-4 py-3 border-b border-[#1e2535] ${sc.bg} border`} style={{ borderColor: sc.color + '40' }}>
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" style={{ color: sc.color }} />
          <span className="font-bold text-sm" style={{ color: sc.color }}>Market Sentiment: {sc.label}</span>
        </div>
        {newsLoading && <Loader className="w-3.5 h-3.5 text-gray-500 animate-spin ml-auto" />}
      </div>

      {/* News list */}
      <div className="flex-1 overflow-y-auto divide-y divide-[#1e2535]">
        {news.length === 0 && !newsLoading ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-600 gap-3">
            <span className="text-3xl">📰</span>
            <p className="text-sm text-center">Đang tải tin tức...<br /><span className="text-xs">Dữ liệu từ CryptoPanic & CryptoCompare</span></p>
          </div>
        ) : (
          news.map(item => {
            const sentColor = item.sentiment === 'positive' ? '#0ecb81' : item.sentiment === 'negative' ? '#f6465d' : '#6b7280';
            const sentLabel = item.sentiment === 'positive' ? '▲' : item.sentiment === 'negative' ? '▼' : '—';
            const timeAgo = getTimeAgo(item.publishedAt);
            return (
              <a key={item.id} href={item.url} target="_blank" rel="noopener noreferrer"
                className="flex items-start gap-3 px-4 py-3.5 hover:bg-[#161b25] transition-colors group">
                <span className="text-lg font-bold shrink-0 mt-0.5" style={{ color: sentColor }}>{sentLabel}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-300 group-hover:text-white transition-colors leading-relaxed line-clamp-2">
                    {item.title}
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-[10px] text-gray-600">{item.source}</span>
                    <span className="text-[10px] text-gray-700">·</span>
                    <span className="text-[10px] text-gray-600">{timeAgo}</span>
                    {item.votes.important > 0 && (
                      <span className="text-[10px] bg-amber-900/40 text-amber-400 px-1.5 rounded-full">
                        🔥 {item.votes.important}
                      </span>
                    )}
                  </div>
                </div>
                <ExternalLink className="w-3 h-3 text-gray-700 group-hover:text-gray-400 shrink-0 mt-1 transition-colors" />
              </a>
            );
          })
        )}
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins}p trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h trước`;
  return `${Math.floor(hours / 24)}d trước`;
}
