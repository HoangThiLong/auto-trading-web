/**
 * Shared analysis utilities for both main thread and web worker.
 * This file contains pure calculation functions that can be used in both contexts.
 */

import type { CandlePoint } from '../types';

// ─── Price & Quantity Normalization ─────────────────────────────────────────

export function normalizePrice(value: number): number {
  return Number(value.toFixed(6));
}

export function normalizeQty(value: number): number {
  return Number(value.toFixed(6));
}

// ─── Hash Function ──────────────────────────────────────────────────────────

export function hashIntentSeed(seed: string): string {
  let hash = 5381;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 33) ^ seed.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
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

  // Wilder's Smoothing Method (matches TradingView/MEXC RSI)
  let avgGain = 0;
  let avgLoss = 0;

  // Initial SMA for first period
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;

  // Wilder's smoothing for remaining data
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff >= 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

export function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number } {
  if (closes.length < 26) return { macd: 0, signal: 0, histogram: 0 };
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signal = calcEMA(macdLine, 9);
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

// ─── Market Regime Detection ────────────────────────────────────────────────

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
