/// <reference lib="webworker" />

import type { CandlePoint, TradeSignal } from '../types';
import { calcDynamicTPSL, calcWinRate } from '../services/capitalManager';
import {
  buildOrderIntent,
  type AnalysisWorkerRequest,
  type AnalysisWorkerResponse,
} from '../services/analysis';

function calcEMA(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const ema: number[] = [];
  ema[0] = data[0];
  for (let i = 1; i < data.length; i++) {
    ema[i] = data[i] * k + ema[i - 1] * (1 - k);
  }
  return ema;
}

function calcRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0;
  let losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  const rs = gains / (losses || 0.0001);
  return 100 - 100 / (1 + rs);
}

function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signal = calcEMA(macdLine.slice(-9), 9);
  const macdVal = macdLine[macdLine.length - 1];
  const signalVal = signal[signal.length - 1];
  return { macd: macdVal, signal: signalVal, histogram: macdVal - signalVal };
}

function calcBollingerBands(closes: number[], period = 20, multiplier = 2) {
  if (closes.length < period) return { upper: 0, middle: 0, lower: 0 };
  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + Math.pow(b - middle, 2), 0) / period;
  const std = Math.sqrt(variance);
  return { upper: middle + multiplier * std, middle, lower: middle - multiplier * std };
}

function calcATR(candles: CandlePoint[], period = 14): number {
  if (candles.length < period + 1) return 0;
  const trs = candles.slice(-period - 1).map((c, i, arr) => {
    if (i === 0) return c.high - c.low;
    const prev = arr[i - 1];
    return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
  });
  return trs.slice(1).reduce((a, b) => a + b, 0) / period;
}

function calcVolumeAvg(candles: CandlePoint[], period = 20): number {
  const slice = candles.slice(-period);
  return slice.reduce((a, b) => a + b.volume, 0) / slice.length;
}

function calcStochRSI(closes: number[], period = 14): number {
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

function detectMarketRegime(candles: CandlePoint[]): 'TRENDING' | 'RANGING' | 'VOLATILE' {
  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);

  const atr = calcATR(candles, 14);
  const priceRange = Math.max(...highs) - Math.min(...lows);

  const lookback = Math.min(50, candles.length);
  const startPeriod = closes[closes.length - lookback];
  const current = closes[closes.length - 1];
  const momentum = Math.abs(current - startPeriod) / (atr || 0.0001);

  let avgCandleSize = 0;
  for (let i = 1; i < candles.length; i++) {
    avgCandleSize += Math.abs(candles[i].close - candles[i].open);
  }
  avgCandleSize /= candles.length;

  const rangeEfficiency = priceRange / (Math.max(...highs) - Math.min(...lows) || 1);

  if (momentum > 3 && rangeEfficiency > 0.7) return 'TRENDING';
  if (atr > 0.02 * current && momentum < 2) return 'VOLATILE';
  return 'RANGING';
}

function generateSignal(candles: CandlePoint[]): TradeSignal {
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

  reasons.push(`📋 Market Regime: ${marketRegime} | Volatility: ${(volatility * 100).toFixed(2)}%`);

  if (marketRegime === 'RANGING') {
    if (rsi < 25) { longScore += 3; reasons.push(`🟢 RSI oversold (${rsi.toFixed(1)}) (RANGING REGIME) — Strong reversal signal`); }
    else if (rsi > 75) { shortScore += 3; reasons.push(`🔴 RSI overbought (${rsi.toFixed(1)}) (RANGING REGIME) — Strong reversal signal`); }
    else if (rsi < 40) { longScore += 1; reasons.push('🟡 RSI below 40 (RANGING REGIME)'); }
    else if (rsi > 60) { shortScore += 1; reasons.push('🟡 RSI above 60 (RANGING REGIME)'); }
  } else {
    if (rsi < 30) { longScore += 3; reasons.push(`🟢 RSI oversold (${rsi.toFixed(1)}) — Potential reversal`); }
    else if (rsi > 70) { shortScore += 3; reasons.push(`🔴 RSI overbought (${rsi.toFixed(1)}) — Potential reversal`); }
    else if (rsi < 45) { longScore += 1; reasons.push(`🟡 RSI low (${rsi.toFixed(1)})`); }
    else if (rsi > 55) { shortScore += 1; reasons.push(`🟡 RSI high (${rsi.toFixed(1)})`); }
  }

  if (stochRsi < 20) {
    longScore += 2;
    const signalChange = stochRsi - calcStochRSI(closes.slice(0, -1));
    if (signalChange > 10) longScore += 1;
    reasons.push(`🟢 Stoch RSI oversold (${stochRsi.toFixed(1)})`);
  } else if (stochRsi > 80) {
    shortScore += 2;
    const signalChange = stochRsi - calcStochRSI(closes.slice(0, -1));
    if (signalChange < -10) shortScore += 1;
    reasons.push(`🔴 Stoch RSI overbought (${stochRsi.toFixed(1)})`);
  }

  const prevMacdHistogram = Math.abs(macd.histogram) < 0.0001 ? 0 : closes.length > 1
    ? calcMACD(closes.slice(0, -1)).histogram
    : 0;

  if (marketRegime === 'TRENDING' || marketRegime === 'VOLATILE') {
    if (macd.histogram > 0 && prevMacdHistogram <= 0) {
      longScore += 3; reasons.push('🟢 MACD Bullish Crossover (TRENDING/VOLATILE REGIME)');
    } else if (macd.histogram < 0 && prevMacdHistogram >= 0) {
      shortScore += 3; reasons.push('🔴 MACD Bearish Crossover (TRENDING/VOLATILE REGIME)');
    } else if (macd.histogram > 0) { longScore += 1; reasons.push('🟡 MACD above signal line (TRENDING SUPPORT)'); }
    else if (macd.histogram < 0) { shortScore += 1; reasons.push('🟡 MACD below signal line (TRENDING SUPPORT)'); }
  } else {
    if (macd.histogram > 0 && macd.macd > 0) {
      longScore += 2;
      reasons.push('🟢 MACD positive (RANGING MODE)');
    } else if (macd.histogram < 0 && macd.macd < 0) {
      shortScore += 2;
      reasons.push('🔴 MACD negative (RANGING MODE)');
    } else if (macd.histogram > 0) {
      longScore += 1;
      reasons.push('🟡 MACD histogram positive');
    } else if (macd.histogram < 0) {
      shortScore += 1;
      reasons.push('🟡 MACD histogram negative');
    }
  }

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
    if (marketRegime !== 'TRENDING') longScore += 1;
    reasons.push('🟡 Price above EMA20 & EMA50');
  } else if (currentPrice < ema20 && currentPrice < ema50) {
    if (marketRegime !== 'TRENDING') shortScore += 1;
    reasons.push('🟡 Price below EMA20 & EMA50');
  }

  if (currentPrice < bb.lower - atr * 0.2) {
    longScore += 3;
    reasons.push('🟢 Price significantly below BB lower (-0.2 ATR) — Oversold reversal');
  } else if (currentPrice < bb.lower) {
    longScore += 2;
    reasons.push('🟢 Price at BB lower — Potential buy zone');
  } else if (currentPrice > bb.upper + atr * 0.2) {
    shortScore += 3;
    reasons.push('🔴 Price significantly above BB upper (+0.2 ATR) — Overbought reversal');
  } else if (currentPrice > bb.upper) {
    shortScore += 2;
    reasons.push('🔴 Price at BB upper — Potential sell zone');
  } else if (marketRegime === 'RANGING' && Math.abs(currentPrice - ((bb.upper + bb.lower) / 2)) < (bb.upper - bb.lower) * 0.05) {
    reasons.push('🟡 Price at BB midline — Possible transition zone');
  }

  const volumeRatio = volume / volumeAvg;
  if (volumeRatio > 1.8) {
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

  const { winRate } = calcWinRate(candles, signalType, Math.min(candles.length - 20, 100));

  const { takeProfit, stopLoss, riskReward } = signalType !== 'NEUTRAL'
    ? calcDynamicTPSL(currentPrice, atr, signalType, strength, winRate)
    : { takeProfit: currentPrice + atr * 2, stopLoss: currentPrice - atr * 2, riskReward: 1 };

  const baseConfidence = Math.max(
    30,
    longScore > shortScore
      ? (longScore - shortScore) * 7 + 40
      : (shortScore - longScore) * 7 + 40
  );
  const regimeConfidenceMod =
    marketRegime === 'TRENDING' ? 1.2 :
    marketRegime === 'RANGING' ? 1.1 :
    0.9;
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
    marketRegime,
  };
}

const worker = self as DedicatedWorkerGlobalScope;

worker.onmessage = (event: MessageEvent<AnalysisWorkerRequest>) => {
  const req = event.data as AnalysisWorkerRequest | undefined;
  if (!req) return;
  const reqId = req.id;

  try {
    if (req.type === 'GENERATE_SIGNAL') {
      const signal = generateSignal(req.payload.candles);
      const res: AnalysisWorkerResponse = {
        id: reqId,
        type: 'GENERATE_SIGNAL_RESULT',
        signal,
      };
      worker.postMessage(res);
      return;
    }

    if (req.type === 'BUILD_ORDER_INTENT') {
      const orderIntent = buildOrderIntent(req.payload.order);
      const res: AnalysisWorkerResponse = {
        id: reqId,
        type: 'ORDER_INTENT_RESULT',
        orderIntent,
      };
      worker.postMessage(res);
      return;
    }

    const fallbackRes: AnalysisWorkerResponse = {
      id: reqId,
      type: 'ANALYSIS_ERROR',
      error: `Unsupported worker request type: ${(req as any).type || 'unknown'}`,
    };
    worker.postMessage(fallbackRes);
  } catch (error) {
    const res: AnalysisWorkerResponse = {
      id: reqId,
      type: 'ANALYSIS_ERROR',
      error: error instanceof Error ? error.message : 'Unknown analysis worker error',
    };
    worker.postMessage(res);
  }
};

export {};
