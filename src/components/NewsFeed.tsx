import { useEffect } from 'react';
import { fetchCryptoPanicNews, analyzeNewsSentiment } from '../services/newsService';
import { TrendingUp, TrendingDown, Minus, ExternalLink, Loader2, Newspaper, Sparkles } from 'lucide-react';
import { useNewsFeedState } from '../store/hooks';

export default function NewsFeed() {
  const {
    news,
    setNews,
    marketSentiment,
    setMarketSentiment,
    newsLoading,
    setNewsLoading,
    aiCredentials,
  } = useNewsFeedState();

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
    const intervalId = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(intervalId);
  }, [aiCredentials?.cryptopanic]);

  const sentimentConfig = {
    BULLISH: {
      icon: TrendingUp,
      label: 'BULLISH',
      tone: 'text-[var(--color-success)]',
      banner:
        'border-[rgba(0,230,138,0.38)] bg-[linear-gradient(145deg,rgba(0,230,138,0.14),rgba(10,13,26,0.95))]',
      dot: 'bg-[var(--color-success)]',
    },
    BEARISH: {
      icon: TrendingDown,
      label: 'BEARISH',
      tone: 'text-[var(--color-warning)]',
      banner:
        'border-[rgba(255,184,46,0.38)] bg-[linear-gradient(145deg,rgba(255,184,46,0.13),rgba(10,13,26,0.95))]',
      dot: 'bg-[var(--color-warning)]',
    },
    FEARFUL: {
      icon: TrendingDown,
      label: 'FEARFUL',
      tone: 'text-[var(--color-danger)]',
      banner:
        'border-[rgba(255,77,106,0.38)] bg-[linear-gradient(145deg,rgba(255,77,106,0.14),rgba(10,13,26,0.95))]',
      dot: 'bg-[var(--color-danger)]',
    },
    NEUTRAL: {
      icon: Minus,
      label: 'NEUTRAL',
      tone: 'text-[var(--text-secondary)]',
      banner:
        'border-[var(--border)] bg-[linear-gradient(145deg,rgba(0,82,255,0.09),rgba(10,13,26,0.95))]',
      dot: 'bg-[var(--text-muted)]',
    },
  } as const;

  const currentSentiment = sentimentConfig[marketSentiment] ?? sentimentConfig.NEUTRAL;
  const SentimentIcon = currentSentiment.icon;

  return (
    <div className="flex h-full flex-col gap-3 overflow-hidden bg-[var(--bg-panel)] p-4 text-[var(--text-main)]">
      <section className={`coinbase-surface rounded-2xl border p-4 ${currentSentiment.banner}`}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--bg-surface-soft)]">
            <SentimentIcon className={`h-4.5 w-4.5 ${currentSentiment.tone}`} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
              Market Sentiment Engine
            </div>
            <div className={`mt-0.5 text-sm font-black tracking-[0.04em] ${currentSentiment.tone}`}>
              {currentSentiment.label}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-main)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary)]">
              <span className={`h-2 w-2 rounded-full ${currentSentiment.dot}`} />
              {news.length} headlines
            </span>

            <span
              id="news-feed-loading-status"
              className="inline-flex min-w-[108px] items-center justify-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-main)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]"
            >
              {newsLoading ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin text-[var(--accent-soft)]" />
                  Refreshing
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 text-[var(--color-cyan)]" />
                  Synced
                </>
              )}
            </span>
          </div>
        </div>
      </section>

      <section className="coinbase-surface-soft flex-1 overflow-hidden rounded-2xl border border-[var(--border)]">
        <header className="coinbase-data-head flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <Newspaper className="h-4 w-4 text-[var(--accent-soft)]" />
          <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            News Stream
          </h3>
          <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">
            refresh / 5m
          </span>
        </header>

        <div className="h-[calc(100%-49px)] overflow-y-auto divide-y divide-[var(--border-soft)]">
          {news.length === 0 && !newsLoading ? (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-[rgba(0,82,255,0.3)] bg-[var(--color-brand-dim)]">
                <Newspaper className="h-5 w-5 text-[var(--accent-soft)]" />
              </div>
              <p className="text-sm text-[var(--text-secondary)]">Đang chờ dữ liệu news feed...</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Nguồn: CryptoPanic & CryptoCompare</p>
            </div>
          ) : (
            news.map((item) => {
              const sentimentTone =
                item.sentiment === 'positive'
                  ? 'text-[var(--color-success)]'
                  : item.sentiment === 'negative'
                    ? 'text-[var(--color-danger)]'
                    : 'text-[var(--text-muted)]';

              const sentimentBadge =
                item.sentiment === 'positive'
                  ? 'border-[rgba(0,230,138,0.4)] bg-[var(--color-success-dim)] text-[var(--color-success)]'
                  : item.sentiment === 'negative'
                    ? 'border-[rgba(255,77,106,0.4)] bg-[var(--color-danger-dim)] text-[var(--color-danger)]'
                    : 'border-[var(--border)] bg-[var(--bg-surface-soft)] text-[var(--text-muted)]';

              return (
                <a
                  id={`news-feed-item-${item.id}`}
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-3 px-4 py-3.5 transition-all hover:bg-[rgba(0,82,255,0.07)]"
                >
                  <span className={`mt-0.5 text-lg font-black ${sentimentTone}`}>
                    {item.sentiment === 'positive' ? '▲' : item.sentiment === 'negative' ? '▼' : '—'}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm leading-relaxed text-[var(--text-secondary)] transition-colors group-hover:text-[var(--text-main)]">
                      {item.title}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.06em]">
                      <span className="rounded-full border border-[var(--border)] bg-[var(--bg-main)] px-2 py-0.5 text-[var(--text-muted)]">
                        {item.source}
                      </span>
                      <span className="rounded-full border border-[var(--border)] bg-[var(--bg-main)] px-2 py-0.5 text-[var(--text-muted)]">
                        {getTimeAgo(item.publishedAt)}
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 ${sentimentBadge}`}>
                        {item.sentiment}
                      </span>
                      {item.votes.important > 0 && (
                        <span className="rounded-full border border-[rgba(255,184,46,0.45)] bg-[var(--color-warning-dim)] px-2 py-0.5 text-[#ffd979]">
                          🔥 {item.votes.important}
                        </span>
                      )}
                    </div>
                  </div>

                  <ExternalLink className="mt-1 h-3.5 w-3.5 text-[var(--text-muted)] transition-colors group-hover:text-[var(--accent-soft)]" />
                </a>
              );
            })
          )}
        </div>
      </section>
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
