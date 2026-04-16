export async function fetchTimesFmForecast(historyData: number[], horizon = 12): Promise<number[] | null> {
  try {
    const res = await fetch('http://127.0.0.1:8000/api/forecast', {
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
