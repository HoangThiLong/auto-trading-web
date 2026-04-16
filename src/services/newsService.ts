import type { NewsItem, MarketSentiment } from '../types';

const CRYPTOPANIC_BASE = 'https://cryptopanic.com/api/v1';

// Fallback: fetch from Cointelegraph RSS converted to JSON via rss2json
const ALTERNATIVE_NEWS_URL = 'https://api.rss2json.com/v1/api.json?rss_url=https://cointelegraph.com/rss';

export async function fetchCryptoPanicNews(apiKey?: string): Promise<NewsItem[]> {
  try {
    // Use CryptoPanic API if key is provided
    if (apiKey) {
      const url = `${CRYPTOPANIC_BASE}/posts/?auth_token=${apiKey}&public=true&kind=news&filter=important&currencies=BTC,ETH,SOL`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return (data.results || []).slice(0, 20).map((item: any) => ({
          id: item.id,
          title: item.title,
          url: item.url,
          source: item.source?.title || 'Unknown',
          publishedAt: item.published_at,
          sentiment: item.votes?.negative > item.votes?.positive ? 'negative' :
                     item.votes?.positive > 0 ? 'positive' : 'neutral',
          votes: {
            positive: item.votes?.positive || 0,
            negative: item.votes?.negative || 0,
            important: item.votes?.important || 0,
          },
        }));
      }
    }

    // Fallback: Cointelegraph RSS
    const res = await fetch(ALTERNATIVE_NEWS_URL);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).slice(0, 15).map((item: any, i: number) => ({
      id: i,
      title: item.title,
      url: item.link,
      source: 'Cointelegraph',
      publishedAt: new Date(item.pubDate).toISOString(),
      sentiment: categorizeSentiment(item.title + ' ' + (item.description || '')),
      votes: { positive: 0, negative: 0, important: 0 },
    }));
  } catch (err) {
    console.error('[News] fetch error:', err);
    return [];
  }
}

const FEAR_KEYWORDS = [
  'crash', 'dump', 'collapse', 'hack', 'ban', 'regulation', 'bear', 'fell',
  'drop', 'plunge', 'liquidation', 'liquidated', 'suspend', 'freeze', 'scam',
  'fraud', 'fear', 'panic', 'warning', 'risk', 'lawsuit', 'sec', 'criminal',
];

const BULL_KEYWORDS = [
  'bull', 'surge', 'rally', 'ath', 'all-time high', 'adoption', 'launch',
  'partnership', 'integration', 'approval', 'etf', 'institutional', 'upgrade',
  'record', 'growth', 'positive', 'breakout', 'moon',
];

function categorizeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lower = text.toLowerCase();
  const fearCount = FEAR_KEYWORDS.filter(w => lower.includes(w)).length;
  const bullCount = BULL_KEYWORDS.filter(w => lower.includes(w)).length;
  if (fearCount > bullCount) return 'negative';
  if (bullCount > fearCount) return 'positive';
  return 'neutral';
}

export function analyzeNewsSentiment(news: NewsItem[]): MarketSentiment {
  if (!news.length) return 'NEUTRAL';
  const negative = news.filter(n => n.sentiment === 'negative').length;
  const positive = news.filter(n => n.sentiment === 'positive').length;
  const total = news.length;

  const negativeRatio = negative / total;
  const positiveRatio = positive / total;

  if (negativeRatio >= 0.6) return 'FEARFUL';
  if (negativeRatio >= 0.4) return 'BEARISH';
  if (positiveRatio >= 0.5) return 'BULLISH';
  return 'NEUTRAL';
}

export function hasHighImpactNews(news: NewsItem[], withinMinutes = 60): boolean {
  const cutoff = Date.now() - withinMinutes * 60 * 1000;
  return news.some(item => {
    const publishedMs = new Date(item.publishedAt).getTime();
    if (publishedMs < cutoff) return false;
    const text = item.title.toLowerCase();
    return FEAR_KEYWORDS.slice(0, 8).some(w => text.includes(w)); // Only high-impact fear words
  });
}

export function isSafeToTrade(
  sentiment: MarketSentiment,
  news: NewsItem[],
  config: { newsFilter: boolean; quietHours: { start: number; end: number } | null }
): { safe: boolean; reason: string } {
  // Check quiet hours (UTC)
  if (config.quietHours) {
    const nowUTC = new Date().getUTCHours();
    const { start, end } = config.quietHours;
    const inQuietHours = start < end
      ? nowUTC >= start && nowUTC < end
      : nowUTC >= start || nowUTC < end;
    if (inQuietHours) {
      return { safe: false, reason: `⏰ Quiet hours ${start}h-${end}h UTC` };
    }
  }

  if (!config.newsFilter) return { safe: true, reason: 'News filter disabled' };

  if (sentiment === 'FEARFUL') {
    return { safe: false, reason: '🔴 Thị trường đang PANIC — tạm dừng auto-trade' };
  }

  if (hasHighImpactNews(news, 30)) {
    return { safe: false, reason: '⚠️ Phát hiện tin tức có tác động lớn trong 30 phút qua' };
  }

  return { safe: true, reason: sentiment === 'BULLISH' ? '✅ Sentiment tích cực' : '✅ Thị trường ổn định' };
}
