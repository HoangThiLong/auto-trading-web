import type { CandlePoint, TradeSignal } from '../types';
import { calcDynamicTPSL, calcWinRate } from './capitalManager';

export interface OrderIntentBuildPayload {
  symbol: string;
  mode: 'simulation' | 'live';
  side: 'LONG' | 'SHORT';
  entry: number;
  tp: number;
  sl: number;
  quantity: number;
  leverage: number;
  confidence: number;
  winRate: number;
  aiProvider: string;
}

export interface OrderIntent {
  intentId: string;
  logId: string;
  symbol: string;
  mode: 'simulation' | 'live';
  side: 'LONG' | 'SHORT';
  entry: number;
  tp: number;
  sl: number;
  quantity: number;
  leverage: number;
  confidence: number;
  winRate: number;
  aiProvider: string;
  createdAt: number;
}

export type AnalysisWorkerRequest =
  | {
      id: number;
      type: 'GENERATE_SIGNAL';
      payload: {
        candles: CandlePoint[];
      };
    }
  | {
      id: number;
      type: 'BUILD_ORDER_INTENT';
      payload: {
        order: OrderIntentBuildPayload;
      };
    };

export type AnalysisWorkerResponse =
  | {
      id: number;
      type: 'GENERATE_SIGNAL_RESULT';
      signal: TradeSignal;
    }
  | {
      id: number;
      type: 'ORDER_INTENT_RESULT';
      orderIntent: OrderIntent;
    }
  | {
      id: number;
      type: 'ANALYSIS_ERROR';
      error: string;
    };

function normalizePrice(value: number): number {
  return Number(value.toFixed(6));
}

function normalizeQty(value: number): number {
  return Number(value.toFixed(6));
}

function hashIntentSeed(seed: string): string {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function buildOrderIntent(payload: OrderIntentBuildPayload): OrderIntent {
  const entry = normalizePrice(payload.entry);
  const tp = normalizePrice(payload.tp);
  const sl = normalizePrice(payload.sl);
  const quantity = normalizeQty(payload.quantity);
  const confidence = Math.round(payload.confidence);
  const winRate = Math.round(payload.winRate);

  const seed = [
    payload.symbol,
    payload.side,
    entry,
    tp,
    sl,
    quantity,
    payload.leverage,
    confidence,
    winRate,
    payload.aiProvider,
    payload.mode,
  ].join('|');

  const intentId = `intent_${hashIntentSeed(seed)}`;

  return {
    intentId,
    logId: `${payload.mode === 'simulation' ? 'sim' : 'live'}_${Date.now()}_${payload.symbol}`,
    symbol: payload.symbol,
    mode: payload.mode,
    side: payload.side,
    entry,
    tp,
    sl,
    quantity,
    leverage: payload.leverage,
    confidence,
    winRate,
    aiProvider: payload.aiProvider,
    createdAt: Date.now(),
  };
}

// ─── Technical Indicator Calculations ─────────────────────────────────────

export function calcEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  ema[0] = data[0];
  for (let i = 1; i < data.length; i++) {
    ema[i] = data[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

export function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const rs = gains / (losses || 0.0001);
  return 100 - 100 / (1 + rs);
}

export function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signal = calcEMA(macdLine.slice(-9), 9);
  const macdVal = macdLine[macdLine.length - 1];
  const signalVal = signal[signal.length - 1];
  return { macd: macdVal, signal: signalVal, histogram: macdVal - signalVal };
}

export function calcBollingerBands(closes: number[], period = 20, multiplier = 2) {
  if (closes.length < period) return { upper: 0, middle: 0, lower: 0 };
  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - middle, 2), 0) / period;
  const std = Math.sqrt(variance);
  return { upper: middle + multiplier * std, middle, lower: middle - multiplier * std };
}

export function calcATR(candles: CandlePoint[], period = 14): number {
  if (candles.length < period + 1) return 0;
  const trs = candles.slice(-period - 1).map((c, i, arr) => {
    if (i === 0) return c.high - c.low;
    const prev = arr[i - 1];
    return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
  });
  return trs.slice(1).reduce((a, b) => a + b, 0) / period;
}

export function calcVolumeAvg(candles: CandlePoint[], period = 20): number {
  const slice = candles.slice(-period);
  return slice.reduce((a, b) => a + b.volume, 0) / slice.length;
}

export function calcStochRSI(closes: number[], period = 14): number {
  if (closes.length < period * 2) return 50;
  const rsiValues: number[] = [];
  for (let i = period; i < closes.length; i++) {
    rsiValues.push(calcRSI(closes.slice(0, i + 1), period));
  }
  const slice = rsiValues.slice(-period);
  const minRSI = Math.min(...slice);
  const maxRSI = Math.max(...slice);
  const currentRSI = slice[slice.length - 1];
  if (maxRSI === minRSI) return 50;
  return ((currentRSI - minRSI) / (maxRSI - minRSI)) * 100;
}

// ─── AI Signal Engine ─────────────────────────────────────────────────────

export function detectMarketRegime(candles: CandlePoint[]): 'TRENDING' | 'RANGING' | 'VOLATILE' {
  if (candles.length < 10) return 'RANGING';

  const closes = candles.map(c => c.close);

  // Use ATR to measure volatility
  const atr = calcATR(candles, 14);
  const currentPrice = closes[closes.length - 1];

  // Measure trending using higher time frame momentum
  const lookback = Math.min(50, candles.length);
  const startPeriod = closes[closes.length - lookback];
  const momentum = Math.abs(currentPrice - startPeriod) / atr;

  // Directional Efficiency Ratio (DER)
  // directionalMove = net price change (first → last)
  // totalPathLength = sum of all individual bar-to-bar moves
  // rangeEfficiency → 1.0 = perfectly trending, → 0.0 = perfectly choppy/ranging
  const directionalMove = Math.abs(closes[closes.length - 1] - closes[0]);
  let totalPathLength = 0;
  for (let i = 1; i < closes.length; i++) {
    totalPathLength += Math.abs(closes[i] - closes[i - 1]);
  }
  const rangeEfficiency = totalPathLength > 0 ? directionalMove / totalPathLength : 0;

  // Classification rules:
  // 1. Strong trend: high efficiency + confirmed momentum
  if (rangeEfficiency > 0.65 && momentum > 3) return 'TRENDING';
  // 2. High volatility but choppy: large ATR relative to price + low efficiency
  if (atr > 0.02 * currentPrice && rangeEfficiency < 0.35) return 'VOLATILE';
  // 3. Moderate trend detection: relaxed thresholds
  if (rangeEfficiency > 0.5 && momentum > 2) return 'TRENDING';
  // 4. Default: ranging/consolidation
  return 'RANGING';
}

export function generateSignal(candles: CandlePoint[]): TradeSignal {
  const closes = candles.map(c => c.close);
  const currentPrice = closes[closes.length - 1];

  const rsi = calcRSI(closes);
  const stochRsi = calcStochRSI(closes);
  const macd = calcMACD(closes);
  const bb = calcBollingerBands(closes);
  const ema20Arr = calcEMA(closes, 20);
  const ema50Arr = calcEMA(closes, 50);
  const ema200Arr = calcEMA(closes, 200);
  const ema20 = ema20Arr[ema20Arr.length - 1];
  const ema50 = ema50Arr[ema50Arr.length - 1];
  const ema200 = ema200Arr[ema200Arr.length - 1];
  const atr = calcATR(candles);
  const volume = candles[candles.length - 1].volume;
  const volumeAvg = calcVolumeAvg(candles);

  const marketRegime = detectMarketRegime(candles);
  const volatility = atr / currentPrice;

  const indicators = { rsi, macd, ema20, ema50, ema200, bollingerBands: bb, volume, volumeAvg, atr, marketRegime, volatility };

  let longScore = 0;
  let shortScore = 0;
  const reasons: string[] = [];

  // Add market regime to reasons
  reasons.push(`📋 Market Regime: ${marketRegime} | Volatility: ${(volatility * 100).toFixed(2)}%`);

  // RSI - adjust thresholds based on market regime
  if (marketRegime === 'RANGING') {
    // In ranging markets, traditional reversal levels work better
    if (rsi < 25) { longScore += 3; reasons.push(`🟢 RSI oversold (${rsi.toFixed(1)}) (RANGING REGIME) — Strong reversal signal`); }
    else if (rsi > 75) { shortScore += 3; reasons.push(`🔴 RSI overbought (${rsi.toFixed(1)}) (RANGING REGIME) — Strong reversal signal`); }
    else if (rsi < 40) { longScore += 1; reasons.push(`🟡 RSI below 40 (RANGING REGIME)`); }
    else if (rsi > 60) { shortScore += 1; reasons.push(`🟡 RSI above 60 (RANGING REGIME)`); }
  } else {
    // In trending/sideways markets, consider momentum shifts
    if (rsi < 30) { longScore += 3; reasons.push(`🟢 RSI oversold (${rsi.toFixed(1)}) — Potential reversal`); }
    else if (rsi > 70) { shortScore += 3; reasons.push(`🔴 RSI overbought (${rsi.toFixed(1)}) — Potential reversal`); }
    else if (rsi < 45) { longScore += 1; reasons.push(`🟡 RSI low (${rsi.toFixed(1)})`); }
    else if (rsi > 55) { shortScore += 1; reasons.push(`🟡 RSI high (${rsi.toFixed(1)})`); }
  }

  // Stochastic RSI - for momentum confirmation
  if (stochRsi < 20) { 
    longScore += 2; 
    const signalChange = stochRsi - calcStochRSI(closes.slice(0, -1));  // Compare to previous value
    if (signalChange > 10) longScore += 1;  // Bullish divergence strengthening 
    reasons.push(`🟢 Stoch RSI oversold (${stochRsi.toFixed(1)})`); 
  }
  else if (stochRsi > 80) {
    shortScore += 2;
    const signalChange = stochRsi - calcStochRSI(closes.slice(0, -1));
    if (signalChange < -10) shortScore += 1;  // Bearish divergence strengthening
    reasons.push(`🔴 Stoch RSI overbought (${stochRsi.toFixed(1)})`);
  }

  // MACD - consider market regime for signal interpretation
  const prevMacdHistogram = Math.abs(macd.histogram) < 0.0001 ? 0 : closes.length > 1 ? 
    calcMACD(closes.slice(0, -1)).histogram : 0;
    
  if (marketRegime === 'TRENDING' || marketRegime === 'VOLATILE') {
    // In strong trends, look for continuation patterns
    if (macd.histogram > 0 && prevMacdHistogram <= 0) { 
      longScore += 3; reasons.push('🟢 MACD Bullish Crossover (TRENDING/VOLATILE REGIME)'); 
    }
    else if (macd.histogram < 0 && prevMacdHistogram >= 0) { 
      shortScore += 3; reasons.push('🔴 MACD Bearish Crossover (TRENDING/VOLATILE REGIME)'); 
    }
    else if (macd.histogram > 0) { longScore += 1; reasons.push('🟡 MACD above signal line (TRENDING SUPPORT)'); }
    else if (macd.histogram < 0) { shortScore += 1; reasons.push('🟡 MACD below signal line (TRENDING SUPPORT)'); }
  } else {
    // In ranging markets, look for divergence
    if (macd.histogram > 0 && macd.macd > 0) { 
      longScore += 2; 
      reasons.push('🟢 MACD positive (RANGING MODE)'); 
    }
    else if (macd.histogram < 0 && macd.macd < 0) { 
      shortScore += 2; 
      reasons.push('🔴 MACD negative (RANGING MODE)'); 
    }
    else if (macd.histogram > 0) { 
      longScore += 1; 
      reasons.push('🟡 MACD histogram positive'); 
    }
    else if (macd.histogram < 0) { 
      shortScore += 1; 
      reasons.push('🟡 MACD histogram negative'); 
    }
  }

  // EMA trend analysis considering market regime
  const emaAlignment = (currentPrice > ema20 && ema20 > ema50 && ema50 > ema200) ? 'long' :
                      (currentPrice < ema20 && ema20 < ema50 && ema50 < ema200) ? 'short' : 'neutral';
                      
  if (emaAlignment === 'long') {
    if (marketRegime === 'TRENDING') {
      longScore += 4;
      reasons.push('🟢 EMA Strong Bullish Alignment (TRENDING REGIME)');
    } else {
      longScore += 3;
      reasons.push('🟢 EMA Bullish Alignment');
    }
  } else if (emaAlignment === 'short') {
    if (marketRegime === 'TRENDING') {
      shortScore += 4;
      reasons.push('🔴 EMA Strong Bearish Alignment (TRENDING REGIME)');
    } else {
      shortScore += 3;
      reasons.push('🔴 EMA Bearish Alignment');
    }
  } else if (currentPrice > ema20 && currentPrice > ema50) {
    if (marketRegime !== 'TRENDING') longScore += 1;  // Not give as much weight in trending markets to avoid conflicts
    reasons.push('🟡 Price above EMA20 & EMA50');
  } else if (currentPrice < ema20 && currentPrice < ema50) {
    if (marketRegime !== 'TRENDING') shortScore += 1;
    reasons.push('🟡 Price below EMA20 & EMA50');
  }

  // Bollinger Bands analysis that considers market regime and volatility
  if (currentPrice < bb.lower - atr * 0.2) {  // Overshot lower Bollinger
    longScore += 3; 
    reasons.push('🟢 Price significantly below BB lower (-0.2 ATR) — Oversold reversal');
  } else if (currentPrice < bb.lower) { 
    longScore += 2; 
    reasons.push('🟢 Price at BB lower — Potential buy zone');
  } else if (currentPrice > bb.upper + atr * 0.2) {  // Overshot upper Bollinger
    shortScore += 3;
    reasons.push('🔴 Price significantly above BB upper (+0.2 ATR) — Overbought reversal');
  } else if (currentPrice > bb.upper) { 
    shortScore += 2; 
    reasons.push('🔴 Price at BB upper — Potential sell zone');
  }
  // In ranging markets, BBT (Bollinger Band Touch) signals work better
  else if (marketRegime === 'RANGING' && Math.abs(currentPrice - ((bb.upper + bb.lower) / 2)) < (bb.upper - bb.lower) * 0.05) {
    // Price near midline might indicate breakout/reversal
    reasons.push('🟡 Price at BB midline — Possible transition zone');
  }

  // Volume confirmation with volatility adjustment
  const volumeRatio = volume / volumeAvg;
  if (volumeRatio > 1.8) {  // Significantly higher than average
    if (longScore > shortScore) { 
      longScore += 2; 
      reasons.push('🟢 High volume confirm LONG signal');
    } else if (shortScore > longScore) { 
      shortScore += 2;
      reasons.push('🔴 High volume confirm SHORT signal'); 
    }
  } else if (volumeRatio > 1.3 && volumeRatio <= 1.8) {
    if (longScore > shortScore) { 
      longScore += 1; 
      reasons.push('🟡 Above average volume confirm LONG'); 
    } else if (shortScore > longScore) { 
      shortScore += 1; 
      reasons.push('🟡 Above average volume confirm SHORT'); 
    }
  } else if (volumeRatio < 0.6 && marketRegime !== 'TRENDING') {
    reasons.push('🟡 Low volume — Considered weak signal (not in trending regime)');
  }

  // Determine direction
  let signalType: TradeSignal['type'] = 'NEUTRAL';
  let strength: TradeSignal['strength'] = 'WEAK';

  if (longScore > shortScore + 2) {
    signalType = 'LONG';
    strength = longScore - shortScore >= 8 ? 'STRONG' : longScore - shortScore >= 4 ? 'MODERATE' : 'WEAK';
  } else if (shortScore > longScore + 2) {
    signalType = 'SHORT';
    strength = shortScore - longScore >= 8 ? 'STRONG' : shortScore - longScore >= 4 ? 'MODERATE' : 'WEAK';
  } else {
    reasons.push('⚪ Market in consolidation — Wait for clearer signal');
  }

  // Quick win rate backtest
  const { winRate } = calcWinRate(candles, signalType, Math.min(candles.length - 20, 100));

  // Dynamic TP/SL based on win rate + ATR + market regime
  const { takeProfit, stopLoss, riskReward } = signalType !== 'NEUTRAL'
    ? calcDynamicTPSL(currentPrice, atr, signalType, strength, winRate)
    : { takeProfit: currentPrice + atr * 2, stopLoss: currentPrice - atr * 2, riskReward: 1 };

  // Final confidence calculation with volatility and market regime adjustment
  const baseConfidence = Math.max(
    30, 
    longScore > shortScore 
      ? (longScore - shortScore) * 7 + 40 
      : (shortScore - longScore) * 7 + 40
  );
  const regimeConfidenceMod = 
    marketRegime === 'TRENDING' ? 1.2 : 
    marketRegime === 'RANGING' ? 1.1 : 
    0.9;  // Be more cautious in volatile markets
  const finalConfidence = Math.min(95, Math.max(25, baseConfidence * regimeConfidenceMod));

  return {
    type: signalType,
    strength,
    entry: currentPrice,
    takeProfit,
    stopLoss,
    riskReward,
    winRate: Math.round(winRate * 100),
    confidence: Math.round(finalConfidence),
    reasons,
    indicators,
    timestamp: Date.now(),
    marketRegime, // Include market regime in signal
  };
}
