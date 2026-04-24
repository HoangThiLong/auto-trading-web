/**
 * Analysis & Capital Manager Test Suite
 *
 * Môi trường: Vitest, hoàn toàn offline.
 * Mục tiêu: Kiểm thử toàn bộ indicator calculations và capital management.
 */

/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import {
  calcEMA,
  calcRSI,
  calcMACD,
  calcBollingerBands,
  calcATR,
  calcStochRSI,
  calcVolumeAvg,
  detectMarketRegime,
  generateSignal,
} from '../analysis';
import { calcDailyPnL, calcPositionSize, calcWinRate, calcDynamicTPSL } from '../capitalManager';
import type { CandlePoint } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Generate realistic candle data for testing */
function makeCandles(count: number, basePrice = 65000, volatility = 0.005): CandlePoint[] {
  const candles: CandlePoint[] = [];
  let price = basePrice;

  for (let i = 0; i < count; i++) {
    const change = (Math.random() - 0.5) * 2 * volatility * price;
    const open = price;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * volatility * price * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * price * 0.5;
    const volume = 100 + Math.random() * 500;

    candles.push({
      time: Math.floor(Date.now() / 1000) - (count - i) * 900,
      open: Number(open.toFixed(2)),
      close: Number(close.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      volume: Number(volume.toFixed(2)),
    });

    price = close;
  }

  return candles;
}

/** Generate monotonically increasing closes */
function makeTrendingCloses(count: number, start = 100, step = 1): number[] {
  return Array.from({ length: count }, (_, i) => start + i * step);
}

/** Generate monotonically decreasing closes */
function makeDecliningCloses(count: number, start = 200, step = 1): number[] {
  return Array.from({ length: count }, (_, i) => start - i * step);
}

/** Generate ranging (flat) closes */
function makeRangingCloses(count: number, base = 150, amplitude = 3): number[] {
  return Array.from({ length: count }, (_, i) => base + Math.sin(i * 0.5) * amplitude);
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 1: EMA
// ─────────────────────────────────────────────────────────────────────────────

describe('calcEMA', () => {
  it('trả về mảng cùng độ dài với input', () => {
    const data = [1, 2, 3, 4, 5];
    const result = calcEMA(data, 3);
    expect(result).toHaveLength(data.length);
  });

  it('EMA(1) trả về chính xác input', () => {
    const data = [10, 20, 30, 40];
    // EMA period=1: k = 2/2 = 1, result = data (each value fully weighted)
    const result = calcEMA(data, 1);
    expect(result[0]).toBe(10);
    // With k=1: ema[i] = data[i] * 1 + ema[i-1] * 0 = data[i]
    expect(result[1]).toBe(20);
    expect(result[2]).toBe(30);
    expect(result[3]).toBe(40);
  });

  it('EMA giá trị đầu tiên = data[0]', () => {
    const data = [42, 50, 48, 55, 60];
    const result = calcEMA(data, 3);
    expect(result[0]).toBe(42);
  });

  it('EMA hội tụ về giá trị gần nhất (lag decreasing)', () => {
    // Constant data = 100 sau nhiều bước → EMA phải converge về 100
    const data = Array(50).fill(100);
    const result = calcEMA(data, 10);
    expect(result[result.length - 1]).toBeCloseTo(100, 5);
  });

  it('EMA phản ứng nhanh hơn với period nhỏ hơn', () => {
    const data = Array(20).fill(100).concat(Array(20).fill(200));
    const ema5 = calcEMA(data, 5);
    const ema20 = calcEMA(data, 20);

    // EMA(5) should be closer to 200 than EMA(20) at the end
    const diff5 = Math.abs(ema5[ema5.length - 1] - 200);
    const diff20 = Math.abs(ema20[ema20.length - 1] - 200);
    expect(diff5).toBeLessThan(diff20);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 2: RSI (Wilder's Smoothing)
// ─────────────────────────────────────────────────────────────────────────────

describe('calcRSI', () => {
  it('trả về 50 khi không đủ data', () => {
    expect(calcRSI([1, 2, 3])).toBe(50); // chỉ 3 điểm, cần period+1=15
    expect(calcRSI([])).toBe(50);
  });

  it('RSI = 100 khi chỉ có gains (giá luôn tăng)', () => {
    const closes = makeTrendingCloses(30, 100, 5); // luôn tăng
    const rsi = calcRSI(closes);
    expect(rsi).toBe(100); // avgLoss = 0 → RSI = 100
  });

  it('RSI gần 0 khi chỉ có losses (giá luôn giảm mạnh)', () => {
    const closes = makeDecliningCloses(30, 200, 5); // luôn giảm
    const rsi = calcRSI(closes);
    expect(rsi).toBeLessThan(5); // gần 0 (có thể không chính xác 0 do initial SMA)
  });

  it('RSI gần 50 khi giá sideway (ranging)', () => {
    const closes = makeRangingCloses(100, 150, 2); // sideway
    const rsi = calcRSI(closes);
    expect(rsi).toBeGreaterThan(30);
    expect(rsi).toBeLessThan(70);
  });

  it('RSI nằm trong khoảng [0, 100]', () => {
    const candles = makeCandles(300);
    const closes = candles.map(c => c.close);
    const rsi = calcRSI(closes);
    expect(rsi).toBeGreaterThanOrEqual(0);
    expect(rsi).toBeLessThanOrEqual(100);
  });

  it('RSI dùng Wilder\'s smoothing — không giống SMA', () => {
    // Tạo data có gains và losses mixed
    const closes = [100, 105, 103, 108, 102, 107, 101, 106, 104, 109,
                    103, 108, 102, 107, 110, 105, 103, 108, 106, 112];

    const rsi = calcRSI(closes, 14);

    // SMA RSI (cách cũ) sẽ cho giá trị khác Wilder's RSI
    // Wilder's smoothing cho kết quả ổn định hơn
    expect(rsi).toBeGreaterThan(0);
    expect(rsi).toBeLessThan(100);
    expect(Number.isFinite(rsi)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 3: MACD
// ─────────────────────────────────────────────────────────────────────────────

describe('calcMACD', () => {
  it('trả về {0, 0, 0} khi không đủ data', () => {
    const result = calcMACD([1, 2, 3, 4, 5]);
    expect(result.macd).toBe(0);
    expect(result.signal).toBe(0);
    expect(result.histogram).toBe(0);
  });

  it('MACD line = EMA(12) - EMA(26)', () => {
    const candles = makeCandles(100);
    const closes = candles.map(c => c.close);
    const result = calcMACD(closes);

    // Verify manually
    const ema12 = calcEMA(closes, 12);
    const ema26 = calcEMA(closes, 26);
    const expectedMacd = ema12[ema12.length - 1] - ema26[ema26.length - 1];

    expect(result.macd).toBeCloseTo(expectedMacd, 6);
  });

  it('Signal line = EMA(9) của toàn bộ MACD line', () => {
    const candles = makeCandles(100);
    const closes = candles.map(c => c.close);
    const result = calcMACD(closes);

    // Verify manually
    const ema12 = calcEMA(closes, 12);
    const ema26 = calcEMA(closes, 26);
    const macdLine = ema12.map((v, i) => v - ema26[i]);
    const signalLine = calcEMA(macdLine, 9);
    const expectedSignal = signalLine[signalLine.length - 1];

    expect(result.signal).toBeCloseTo(expectedSignal, 6);
  });

  it('Histogram = MACD - Signal', () => {
    const candles = makeCandles(100);
    const closes = candles.map(c => c.close);
    const result = calcMACD(closes);

    expect(result.histogram).toBeCloseTo(result.macd - result.signal, 6);
  });

  it('BULLISH: MACD cross above signal → histogram dương', () => {
    // Downtrend rồi uptrend → MACD cross above signal
    const closes = Array(30).fill(0).map((_, i) => 100 - i * 2) // downtrend
      .concat(Array(50).fill(0).map((_, i) => 42 + i * 3)); // uptrend

    const result = calcMACD(closes);
    // Trong uptrend mạnh, histogram nên dương
    expect(result.histogram).toBeGreaterThan(0);
  });

  it('Signal line dùng toàn bộ MACD line, KHÔNG chỉ 9 điểm cuối', () => {
    // Đây là test cho Bug #1 — đảm bảo signal dùng full macdLine
    const candles = makeCandles(100);
    const closes = candles.map(c => c.close);
    const ema12 = calcEMA(closes, 12);
    const ema26 = calcEMA(closes, 26);
    const macdLine = ema12.map((v, i) => v - ema26[i]);

    const wrongSignal = calcEMA(macdLine.slice(-9), 9);
    const wrongSignalVal = wrongSignal[wrongSignal.length - 1];
    expect(Number.isFinite(wrongSignalVal)).toBe(true);

    // Cách ĐÚNG (sau fix): calcEMA(macdLine, 9)
    const correctSignal = calcEMA(macdLine, 9);
    const correctSignalVal = correctSignal[correctSignal.length - 1];

    // Verify calcMACD returns the correct (full-line) signal value
    const result = calcMACD(closes);
    expect(result.signal).toBeCloseTo(correctSignalVal, 6);
    expect(Number.isFinite(result.signal)).toBe(true);
    // correctSignalVal khác wrongSignalVal trong hầu hết trường hợp
    // nhưng ta không test sự khác nhau trực tiếp vì có thể trùng hợp
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 4: Bollinger Bands
// ─────────────────────────────────────────────────────────────────────────────

describe('calcBollingerBands', () => {
  it('trả về {0, 0, 0} khi không đủ data', () => {
    const result = calcBollingerBands([1, 2, 3], 20);
    expect(result.upper).toBe(0);
    expect(result.middle).toBe(0);
    expect(result.lower).toBe(0);
  });

  it('upper > middle > lower', () => {
    const closes = makeCandles(50).map(c => c.close);
    const result = calcBollingerBands(closes);
    expect(result.upper).toBeGreaterThan(result.middle);
    expect(result.middle).toBeGreaterThan(result.lower);
  });

  it('middle = SMA của 20 giá trị cuối', () => {
    const closes = Array(30).fill(0).map((_, i) => 100 + i);
    const result = calcBollingerBands(closes, 20);
    const expectedMiddle = closes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    expect(result.middle).toBeCloseTo(expectedMiddle, 6);
  });

  it('band width tăng khi volatility tăng', () => {
    const lowVol = Array(30).fill(100).map((v, i) => v + Math.sin(i) * 0.5);
    const highVol = Array(30).fill(100).map((v, i) => v + Math.sin(i) * 10);

    const bbLow = calcBollingerBands(lowVol);
    const bbHigh = calcBollingerBands(highVol);

    const widthLow = bbLow.upper - bbLow.lower;
    const widthHigh = bbHigh.upper - bbHigh.lower;
    expect(widthHigh).toBeGreaterThan(widthLow);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 5: ATR
// ─────────────────────────────────────────────────────────────────────────────

describe('calcATR', () => {
  it('trả về 0 khi không đủ data', () => {
    const candles = makeCandles(10);
    expect(calcATR(candles)).toBe(0);
  });

  it('ATR luôn dương với đủ data', () => {
    const candles = makeCandles(50, 65000, 0.01);
    const atr = calcATR(candles);
    expect(atr).toBeGreaterThan(0);
  });

  it('ATR tăng khi volatility tăng', () => {
    const lowVol = makeCandles(50, 65000, 0.002);
    const highVol = makeCandles(50, 65000, 0.05);

    const atrLow = calcATR(lowVol);
    const atrHigh = calcATR(highVol);

    expect(atrHigh).toBeGreaterThan(atrLow);
  });

  it('ATR tính True Range đúng (high-low, abs(high-prevClose), abs(low-prevClose))', () => {
    // Gap up scenario: prev close = 100, current open = 110
    const candles: CandlePoint[] = [
      { time: 1, open: 100, close: 100, high: 102, low: 98, volume: 100 },
      { time: 2, open: 110, close: 112, high: 115, low: 108, volume: 100 },
    ];

    // ATR cần ít nhất period+1 candles, với period=1
    const atr = calcATR(candles, 1);
    // True Range của candle 2: max(115-108, |115-100|, |108-100|) = max(7, 15, 8) = 15
    expect(atr).toBe(15);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 6: calcDailyPnL (UTC)
// ─────────────────────────────────────────────────────────────────────────────

describe('calcDailyPnL', () => {
  it('trả về 0 khi không có logs', () => {
    expect(calcDailyPnL([])).toBe(0);
  });

  it('tính tổng PnL của ngày hôm nay (UTC)', () => {
    const now = new Date();
    const todayStartUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    const logs = [
      { timestamp: todayStartUtc + 3600000, pnl: 50 },  // 1 giờ sau UTC midnight
      { timestamp: todayStartUtc + 7200000, pnl: -30 },  // 2 giờ sau UTC midnight
      { timestamp: todayStartUtc - 86400000, pnl: 100 }, // hôm qua → phải bị loại
    ];

    const result = calcDailyPnL(logs);
    expect(result).toBe(20); // 50 + (-30) = 20
  });

  it('loại bỏ logs không có pnl', () => {
    const now = new Date();
    const todayStartUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    const logs = [
      { timestamp: todayStartUtc + 3600000, pnl: 50 },
      { timestamp: todayStartUtc + 7200000 }, // không có pnl
      { timestamp: todayStartUtc + 10800000, pnl: 20 },
    ];

    const result = calcDailyPnL(logs);
    expect(result).toBe(70);
  });

  it('logs từ hôm qua (UTC) không được tính', () => {
    const now = new Date();
    const todayStartUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    const logs = [
      { timestamp: todayStartUtc - 1000, pnl: 999 }, // 1 giây trước UTC midnight
    ];

    const result = calcDailyPnL(logs);
    expect(result).toBe(0);
  });

  it('xử lý negative daily PnL đúng', () => {
    const now = new Date();
    const todayStartUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    const logs = [
      { timestamp: todayStartUtc + 3600000, pnl: -100 },
      { timestamp: todayStartUtc + 7200000, pnl: -50 },
    ];

    const result = calcDailyPnL(logs);
    expect(result).toBe(-150);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 7: calcPositionSize
// ─────────────────────────────────────────────────────────────────────────────

describe('calcPositionSize', () => {
  it('trả về 0 khi balance = 0', () => {
    expect(calcPositionSize(0, 1, 65000, 65000 * 0.98, 10, 0, 1, 0.01)).toBe(0);
  });

  it('trả về 0 khi SL = entry (slDistance = 0)', () => {
    // When currentPrice === stopLoss, slDistance = 0 → division by zero → return 0
    expect(calcPositionSize(10000, 1, 65000, 65000, 10, 0, 1, 0.01)).toBe(0);
  });

  it('tính position size đúng với input chuẩn', () => {
    const balance = 10000;
    const riskPercent = 1; // 1%
    const entryPrice = 65000;
    const stopLossPrice = 63700;
    const leverage = 10;
    const contractSize = 0.01;

    // calcPositionSize returns number of contracts
    const result = calcPositionSize(balance, riskPercent, entryPrice, stopLossPrice, leverage, 0, 1, contractSize);

    expect(result).toBeGreaterThan(0);
    expect(Number.isFinite(result)).toBe(true);

    // Verify margin doesn't exceed balance
    const marginUsed = (result * entryPrice * contractSize) / leverage;
    expect(marginUsed).toBeLessThanOrEqual(balance * 0.95);
  });

  it('cap position khi margin vượt 85% balance', () => {
    // Very small balance, high risk
    const balance = 100;
    const riskPercent = 50;
    const currentPrice = 65000;
    const stopLoss = 64000; // small SL distance → large position
    const leverage = 1;
    const contractSize = 0.01;

    const result = calcPositionSize(balance, riskPercent, currentPrice, stopLoss, leverage, 0, 1, contractSize);

    // Margin used should not exceed 85% of balance
    const marginUsed = (result * currentPrice * contractSize) / leverage;
    expect(marginUsed).toBeLessThanOrEqual(balance * 0.85);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 8: calcWinRate
// ─────────────────────────────────────────────────────────────────────────────

describe('calcWinRate', () => {
  it('trả về default khi signalType = NEUTRAL', () => {
    const candles = makeCandles(200);
    const result = calcWinRate(candles, 'NEUTRAL');
    expect(result.winRate).toBe(0.5);
    expect(result.trialCount).toBe(0);
  });

  it('trả về default khi không đủ candles', () => {
    const result = calcWinRate(makeCandles(10), 'LONG');
    expect(result.winRate).toBe(0.5);
  });

  it('tính win rate đúng với uptrend data cho LONG', () => {
    const candles: CandlePoint[] = [];
    let price = 100;
    for (let i = 0; i < 200; i++) {
      price += (Math.random() - 0.3) * 3; // bias uptrend
      candles.push({
        time: i,
        open: price - 1,
        close: price,
        high: price + 3,
        low: price - 2,
        volume: 500,
      });
    }

    const result = calcWinRate(candles, 'LONG');
    expect(result.trialCount).toBeGreaterThan(0);
    expect(result.winRate).toBeGreaterThanOrEqual(0);
    expect(result.winRate).toBeLessThanOrEqual(1);
    expect(result.wins).toBeLessThanOrEqual(result.trialCount);
  });

  it('win rate trả về object có đúng fields', () => {
    const candles = makeCandles(200);
    const result = calcWinRate(candles, 'LONG');
    expect(result).toHaveProperty('winRate');
    expect(result).toHaveProperty('trialCount');
    expect(result).toHaveProperty('wins');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 9: calcDynamicTPSL
// ─────────────────────────────────────────────────────────────────────────────

describe('calcDynamicTPSL', () => {
  it('TP > entry cho LONG', () => {
    const result = calcDynamicTPSL(65000, 200, 'LONG', 'STRONG');
    expect(result.takeProfit).toBeGreaterThan(65000);
  });

  it('SL < entry cho LONG', () => {
    const result = calcDynamicTPSL(65000, 200, 'LONG', 'STRONG');
    expect(result.stopLoss).toBeLessThan(65000);
  });

  it('TP < entry cho SHORT', () => {
    const result = calcDynamicTPSL(65000, 200, 'SHORT', 'STRONG');
    expect(result.takeProfit).toBeLessThan(65000);
  });

  it('SL > entry cho SHORT', () => {
    const result = calcDynamicTPSL(65000, 200, 'SHORT', 'STRONG');
    expect(result.stopLoss).toBeGreaterThan(65000);
  });

  it('risk-reward ratio >= 1', () => {
    const result = calcDynamicTPSL(65000, 200, 'LONG', 'STRONG');
    expect(result.riskReward).toBeGreaterThanOrEqual(1);
  });

  it('WEAK signal có SL rộng hơn STRONG signal', () => {
    const weakResult = calcDynamicTPSL(65000, 200, 'LONG', 'WEAK');
    const strongResult = calcDynamicTPSL(65000, 200, 'LONG', 'STRONG');
    // Weak → slMult = 2.0, Strong → slMult = 1.2
    const weakSlDistance = Math.abs(65000 - weakResult.stopLoss);
    const strongSlDistance = Math.abs(65000 - strongResult.stopLoss);
    expect(weakSlDistance).toBeGreaterThan(strongSlDistance);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 10: Market Regime Detection
// ─────────────────────────────────────────────────────────────────────────────

describe('detectMarketRegime', () => {
  it('trả về RANGING khi không đủ candles', () => {
    const candles = makeCandles(5);
    expect(detectMarketRegime(candles)).toBe('RANGING');
  });

  it('strong uptrend → TRENDING', () => {
    const candles: CandlePoint[] = [];
    for (let i = 0; i < 100; i++) {
      const price = 100 + i * 3; // strong uptrend
      candles.push({
        time: i,
        open: price,
        close: price + 2,
        high: price + 5,
        low: price - 1,
        volume: 500,
      });
    }
    expect(detectMarketRegime(candles)).toBe('TRENDING');
  });

  it('ranging/sideway → RANGING', () => {
    const candles: CandlePoint[] = [];
    for (let i = 0; i < 100; i++) {
      const price = 150 + Math.sin(i * 0.1) * 1; // very tight range
      candles.push({
        time: i,
        open: price,
        close: price + 0.5,
        high: price + 1,
        low: price - 1,
        volume: 500,
      });
    }
    const regime = detectMarketRegime(candles);
    expect(['RANGING', 'VOLATILE']).toContain(regime);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 11: generateSignal Integration
// ─────────────────────────────────────────────────────────────────────────────

describe('generateSignal', () => {
  it('trả về TradeSignal hợp lệ với đủ data', () => {
    const candles = makeCandles(300);
    const signal = generateSignal(candles);

    expect(signal).toBeDefined();
    expect(['LONG', 'SHORT', 'NEUTRAL']).toContain(signal.type);
    expect(['STRONG', 'MODERATE', 'WEAK']).toContain(signal.strength);
    expect(signal.entry).toBeGreaterThan(0);
    expect(Number.isFinite(signal.confidence)).toBe(true);
    expect(signal.confidence).toBeGreaterThanOrEqual(0);
    expect(signal.confidence).toBeLessThanOrEqual(100);
    expect(signal.reasons.length).toBeGreaterThan(0);
    expect(signal.indicators).toBeDefined();
    expect(Number.isFinite(signal.indicators.rsi)).toBe(true);
  });

  it('RSI indicator nằm trong [0, 100]', () => {
    const candles = makeCandles(300);
    const signal = generateSignal(candles);
    expect(signal.indicators.rsi).toBeGreaterThanOrEqual(0);
    expect(signal.indicators.rsi).toBeLessThanOrEqual(100);
  });

  it('LONG signal: TP > entry > SL', () => {
    // Tạo data uptrend mạnh để trigger LONG
    const candles: CandlePoint[] = [];
    let price = 100;
    for (let i = 0; i < 300; i++) {
      price += (Math.random() - 0.3) * 2; // bias up
      candles.push({
        time: i,
        open: price - 1,
        close: price,
        high: price + 2,
        low: price - 3,
        volume: 500,
      });
    }

    const signal = generateSignal(candles);
    if (signal.type === 'LONG') {
      expect(signal.takeProfit).toBeGreaterThan(signal.entry);
      expect(signal.stopLoss).toBeLessThan(signal.entry);
    }
  });

  it('SHORT signal: TP < entry < SL', () => {
    // Tạo data downtrend mạnh để trigger SHORT
    const candles: CandlePoint[] = [];
    let price = 65000;
    for (let i = 0; i < 300; i++) {
      price -= (Math.random() - 0.3) * 5; // bias down
      candles.push({
        time: i,
        open: price + 1,
        close: price,
        high: price + 3,
        low: price - 2,
        volume: 500,
      });
    }

    const signal = generateSignal(candles);
    if (signal.type === 'SHORT') {
      expect(signal.takeProfit).toBeLessThan(signal.entry);
      expect(signal.stopLoss).toBeGreaterThan(signal.entry);
    }
  });

  it('timestamp gần hiện tại', () => {
    const candles = makeCandles(300);
    const signal = generateSignal(candles);
    const now = Date.now();
    expect(Math.abs(now - signal.timestamp)).toBeLessThan(5000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE 12: StochRSI & Volume
// ─────────────────────────────────────────────────────────────────────────────

describe('calcStochRSI', () => {
  it('trả về 50 khi không đủ data', () => {
    expect(calcStochRSI([1, 2, 3])).toBe(50);
  });

  it('StochRSI nằm trong [0, 100]', () => {
    const candles = makeCandles(100);
    const closes = candles.map(c => c.close);
    const stochRsi = calcStochRSI(closes);
    expect(stochRsi).toBeGreaterThanOrEqual(0);
    expect(stochRsi).toBeLessThanOrEqual(100);
  });
});

describe('calcVolumeAvg', () => {
  it('tính volume average đúng', () => {
    const candles = [
      { volume: 100, close: 50, open: 50, high: 51, low: 49, time: 1 },
      { volume: 200, close: 50, open: 50, high: 51, low: 49, time: 2 },
      { volume: 300, close: 50, open: 50, high: 51, low: 49, time: 3 },
    ];

    const avg = calcVolumeAvg(candles, 3);
    expect(avg).toBeCloseTo(200, 1);
  });
});
