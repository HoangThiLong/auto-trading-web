/// <reference types="vite/client" />
const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, '');

const resolveTimesFmBaseUrl = (): string => {
  const configuredBaseUrl = import.meta.env.VITE_TIMESFM_API_BASE_URL?.trim();
  if (configuredBaseUrl) {
    return normalizeBaseUrl(configuredBaseUrl);
  }

  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  return isLocalhost ? 'http://127.0.0.1:8000' : '';
};

const TIMESFM_API_BASE_URL = resolveTimesFmBaseUrl();

export async function fetchTimesFmForecast(historyData: number[], horizon = 12): Promise<number[] | null> {
  try {
    if (!TIMESFM_API_BASE_URL) {
      console.warn('TimesFM API base URL is missing. Set VITE_TIMESFM_API_BASE_URL in production.');
      return null;
    }

    const res = await fetch(`${TIMESFM_API_BASE_URL}/api/forecast`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history: historyData, horizon }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    return data.point_forecast || null;
  } catch (err) {
    console.error('TimesFM API error (is the backend running?):', err);
    return null;
  }
}
