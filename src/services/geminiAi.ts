import type { AiProviderId, AiModelCredentials, TradeSignal, CandlePoint } from '../types';

// ─── Shared system prompt (rules) for all AI providers ─────────────────────
const SYSTEM_PROMPT = `Bạn là chuyên gia phân tích giao dịch tiền điện tử (crypto futures) với kinh nghiệm 10 năm.
Nhiệm vụ: Phân tích dữ liệu kỹ thuật và đưa ra tín hiệu giao dịch.

QUY TẮC BẮT BUỘC:
1. Luôn trả lời theo định dạng JSON sau, KHÔNG thêm bất kỳ text nào ngoài JSON.
2. Phân tích phải dựa trên dữ liệu indicators được cung cấp.
3. "direction" chỉ được là "LONG", "SHORT", hoặc "NEUTRAL".
4. "confidence" từ 0-100.
5. "analysis" viết bằng tiếng Việt, tối đa 3 câu, súc tích.
6. "keyLevels" là các mức giá quan trọng cần theo dõi.

OUTPUT FORMAT (JSON thuần túy):
{
  "direction": "LONG" | "SHORT" | "NEUTRAL",
  "confidence": number,
  "analysis": "string tiếng Việt",
  "keyLevels": { "support": number, "resistance": number },
  "riskWarning": "string hoặc null"
}`;

// ─── Provider cooldown tracker ───────────────────────────────────────────────
const providerCooldowns: Record<string, number> = {};
const COOLDOWN_MS = 5000; // 5s between calls per provider

function canCallProvider(id: AiProviderId): boolean {
  const last = providerCooldowns[id] || 0;
  return Date.now() - last >= COOLDOWN_MS;
}
function markProviderCalled(id: AiProviderId) {
  providerCooldowns[id] = Date.now();
}
function markProviderRateLimited(id: AiProviderId) {
  // Back off for 65 seconds on rate limit
  providerCooldowns[id] = Date.now() + 60000;
}

// ─── Individual provider calls ───────────────────────────────────────────────

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 512 },
      }),
    }
  );
  if (res.status === 429) throw new Error('RATE_LIMIT');
  if (!res.ok) throw new Error(`Gemini error ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callGroq(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 512,
    }),
  });
  if (res.status === 429) throw new Error('RATE_LIMIT');
  if (!res.ok) throw new Error(`Groq error ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callOpenRouter(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': 'https://mexc-pro.app',
      'X-Title': 'MEXC Pro Terminal',
    },
    body: JSON.stringify({
      model: 'deepseek/deepseek-r1:free',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 512,
    }),
  });
  if (res.status === 429) throw new Error('RATE_LIMIT');
  if (!res.ok) throw new Error(`OpenRouter error ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callTogether(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.together.xyz/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 512,
    }),
  });
  if (res.status === 429) throw new Error('RATE_LIMIT');
  if (!res.ok) throw new Error(`Together error ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ─── Parse JSON response safely ──────────────────────────────────────────────
function parseAiResponse(raw: string): {
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidence: number;
  analysis: string;
  keyLevels: { support: number; resistance: number };
  riskWarning: string | null;
} | null {
  try {
    // Strip markdown code blocks if present
    const cleaned = raw.replace(/```json?/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed.direction || !parsed.analysis) return null;
    return {
      direction: parsed.direction,
      confidence: Math.max(0, Math.min(100, Number(parsed.confidence) || 50)),
      analysis: parsed.analysis,
      keyLevels: parsed.keyLevels || { support: 0, resistance: 0 },
      riskWarning: parsed.riskWarning || null,
    };
  } catch {
    return null;
  }
}

// ─── Main multi-provider call ────────────────────────────────────────────────
export interface AiAnalysisResult {
  direction: 'LONG' | 'SHORT' | 'NEUTRAL';
  confidence: number;
  analysis: string;
  keyLevels: { support: number; resistance: number };
  riskWarning: string | null;
  provider: AiProviderId;
}

export async function analyzeWithAI(
  credentials: AiModelCredentials,
  symbol: string,
  signal: Pick<TradeSignal, 'indicators' | 'type' | 'confidence'>,
  candles: CandlePoint[],
  currentPrice: number,
  tradeLessons: string[] = [],
  timesFmForecast: number[] | null = null,
  marketContext: { volumeTrend: 'increasing' | 'decreasing' | 'neutral', volatility: 'high' | 'normal' | 'low' } | null = null
): Promise<AiAnalysisResult | null> {
  const prompt = buildAdvancedPrompt(symbol, signal, candles, currentPrice, tradeLessons, timesFmForecast, marketContext);

  // Build priority queue: preferred first, then the rest
  const order: AiProviderId[] = ['gemini', 'groq', 'openrouter', 'together'];
  if (credentials.preferredProvider) {
    const pref = credentials.preferredProvider;
    const rest = order.filter(p => p !== pref);
    order.splice(0, order.length, pref, ...rest);
  }

  for (const providerId of order) {
    const key = credentials[providerId as keyof AiModelCredentials] as string | undefined;
    if (!key) continue;
    if (!canCallProvider(providerId)) {
      console.log(`[AI] ${providerId} on cooldown, skipping`);
      continue;
    }

    try {
      markProviderCalled(providerId);
      let raw = '';

      if (providerId === 'gemini') raw = await callGemini(key, prompt);
      else if (providerId === 'groq') raw = await callGroq(key, prompt);
      else if (providerId === 'openrouter') raw = await callOpenRouter(key, prompt);
      else if (providerId === 'together') raw = await callTogether(key, prompt);

      const parsed = parseAiResponse(raw);
      if (parsed) {
        console.log(`[AI] Success via ${providerId}`);
        return { ...parsed, provider: providerId };
      }
    } catch (err: any) {
      if (err.message === 'RATE_LIMIT') {
        console.warn(`[AI] ${providerId} rate limited, backing off`);
        markProviderRateLimited(providerId);
      } else {
        console.error(`[AI] ${providerId} error:`, err.message);
      }
    }
  }

  return null;
}

export function getProviderStatus(credentials: AiModelCredentials | null): Record<AiProviderId, { hasKey: boolean; onCooldown: boolean }> {
  const providers: AiProviderId[] = ['gemini', 'groq', 'openrouter', 'together'];
  return Object.fromEntries(
    providers.map(id => [
      id,
      {
        hasKey: !!credentials?.[id as keyof AiModelCredentials],
        onCooldown: !canCallProvider(id),
      },
    ])
  ) as Record<AiProviderId, { hasKey: boolean; onCooldown: boolean }>;
}

// ─── Self-improvement tracking ────────────────────────────────────────────────
interface PredictionRecord {
  prediction: AiAnalysisResult;
  outcome: 'TP_HIT' | 'SL_HIT' | 'EARLY_CLOSE';
  profitLoss: number;
  timestamp: number;
}

const predictionHistory: PredictionRecord[] = [];

export function recordPredictionOutcome(outcome: PredictionRecord['outcome'], profit: number) {
  // In a real implementation, we'd store this by ID - for now we'll just maintain a history
  const record: PredictionRecord = {
    prediction: null as any, // We'd need to store the original prediction with this ID
    outcome,
    profitLoss: profit,
    timestamp: Date.now(),
  };
  
  // Keep only the most recent 200 records
  if (predictionHistory.length >= 200) {
    predictionHistory.shift();
  }
  predictionHistory.push(record);
}

// ─── Advanced Market Context Analysis ────────────────────────────────────────────────
function buildAdvancedPrompt(
  symbol: string,
  signal: Pick<TradeSignal, 'indicators' | 'type' | 'confidence'>,
  candles: CandlePoint[],
  currentPrice: number,
  tradeLessons: string[] = [],
  timesFmForecast: number[] | null = null,
  marketContext: { volumeTrend: 'increasing' | 'decreasing' | 'neutral', volatility: 'high' | 'normal' | 'low' } | null = null
): string {
  const { indicators } = signal;
  const recent5 = candles.slice(-5).map(c =>
    `O:${c.open.toFixed(2)} H:${c.high.toFixed(2)} L:${c.low.toFixed(2)} C:${c.close.toFixed(2)} V:${c.volume.toFixed(0)}`
  ).join('\n');

  // Analyze volume and volatility trends
  const volumes = candles.slice(-20).map(c => c.volume);
  const volumeMa = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const currentVolume = volumes[volumes.length - 1];
  const volumeTrend = currentVolume > volumeMa * 1.5 ? 'increasing' : 
                     currentVolume < volumeMa * 0.7 ? 'decreasing' : 'neutral';
                     
  const volatilities = candles.slice(-20).map(c => Math.abs(c.high - c.low));
  const avgVolatility = volatilities.reduce((a, b) => a + b, 0) / volatilities.length;
  const currentRange = Math.abs(candles[candles.length - 1].high - candles[candles.length - 1].low);
  const volatilityCondition = currentRange > avgVolatility * 1.5 ? 'high' : 
                            currentRange < avgVolatility * 0.7 ? 'low' : 'normal';

  let timesFmContext = '';
  if (timesFmForecast && timesFmForecast.length > 0) {
    const maxF = Math.max(...timesFmForecast);
    const minF = Math.min(...timesFmForecast);
    const pctChange = ((timesFmForecast[timesFmForecast.length - 1] - currentPrice) / currentPrice) * 100;
    let smartTrend = 'ĐI NGANG/RANGING';
    if (pctChange > 0.5) smartTrend = 'TĂNG MẠNH (STRONG UP)';
    else if (pctChange > 0.1) smartTrend = 'TĂNG NHẸ (MILD UP)';
    else if (pctChange < -0.5) smartTrend = 'GIẢM MẠNH (STRONG DOWN)';
    else if (pctChange < -0.1) smartTrend = 'GIẢM NHẸ (MILD DOWN)';

    timesFmContext = `DỰ BÁO ĐỊNH LƯỢNG TỪ TIMESFM (GOOGLE RESEARCH) CHO ${timesFmForecast.length} NẾN TỚI:
- Quỹ đạo giá: [${timesFmForecast.map(v => v.toFixed(2)).join(', ')}]
- Đỉnh tương lai (Max): ${maxF.toFixed(4)} USDT
- Đáy tương lai (Min): ${minF.toFixed(4)} USDT
- Biến động đến cuối chu kỳ: ${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(2)}%
- Xu hướng TimesFM: ${smartTrend}
=> Nhấn mạnh: Ưu tiên dùng các đỉnh/đáy này làm cơ sở thiết lập mốc TakeProfit và StopLoss thực tế.`;
  }

  return `Phân tích kỹ thuật cho ${symbol}:

GIÁ HIỆN TẠI: ${currentPrice.toFixed(4)} USDT
TREND KHỐI LƯỢNG: ${marketContext?.volumeTrend || volumeTrend}
MỨC ĐỘ BIẾN ĐỘNG: ${marketContext?.volatility || volatilityCondition}

5 NẾN GẦN NHẤT (OHLCV):
${recent5}

CHỈ SỐ KỸ THUẬT:
- RSI(14): ${indicators.rsi.toFixed(2)}
- MACD: ${indicators.macd.macd.toFixed(4)} | Signal: ${indicators.macd.signal.toFixed(4)} | Histogram: ${indicators.macd.histogram.toFixed(4)}
- EMA20: ${indicators.ema20.toFixed(2)} | EMA50: ${indicators.ema50.toFixed(2)} | EMA200: ${indicators.ema200.toFixed(2)}
- Bollinger: Upper=${indicators.bollingerBands.upper.toFixed(2)} Mid=${indicators.bollingerBands.middle.toFixed(2)} Lower=${indicators.bollingerBands.lower.toFixed(2)}
- Volume hiện tại: ${indicators.volume.toFixed(0)} (Avg: ${indicators.volumeAvg.toFixed(0)})
- ATR(14): ${indicators.atr.toFixed(4)}

PHÂN TÍCH KỸ THUẬT LOCAL: ${signal.type} với độ tin cậy ${signal.confidence}%

${timesFmContext}

${tradeLessons.length > 0 ? `BÀI HỌC TỪ CÁC SAI LẦM TRƯỚC ĐÂY (SELF-IMPROVING AGENT):
${tradeLessons.slice(0, 5).map(l => `- ${l}`).join('\n')}
Hãy đảm bảo không lặp lại các sai lầm này.` : ''}
                    
Hãy xác nhận hoặc bác bỏ tín hiệu trên, đồng thời đề xuất mức TP/SL tối ưu dựa trên phân tích kỹ thuật sâu hơn và tin tức thị trường hiện tại.`;
}

// Export the advanced prompt builder for use in the main analysis function
export { buildAdvancedPrompt };
