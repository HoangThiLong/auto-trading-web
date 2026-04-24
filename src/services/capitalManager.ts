import type { TradeSignal, CandlePoint } from '../types';

/**
 * Calculate optimal position size using a fixed risk % model with portfolio considerations.
 * Returns number of contracts (vol) to trade.
 */
export function calcPositionSize(
  accountBalance: number,
  riskPercent: number,   // e.g. 1 for 1%
  entryPrice: number,
  stopLossPrice: number,
  leverage: number,
  activeMarginUsed: number = 0, // MARGIN of currently active positions (USDT)
  portfolioRiskLimit: number = 0.95, // Max percent of account to allocate as margin
  contractSize = 1
): number {
  if (!accountBalance || !entryPrice || !stopLossPrice) return 0;

  // 1. Calculate usable margin capital
  const availableMarginCapital = Math.max(0, accountBalance * portfolioRiskLimit - activeMarginUsed);
  if (availableMarginCapital <= 0.1) return 0; // Minimum margin capital sanity check

  // 2. Calculate Stop Loss distance and Margin required per 1 contract
  const stopDistancePerContract = Math.abs(entryPrice - stopLossPrice) * contractSize;
  const marginPerContract = (entryPrice * contractSize) / leverage;

  if (stopDistancePerContract <= 0 || marginPerContract <= 0) return 0;

  // 3. Determine target risk amount in USDT
  const targetRiskAmount = accountBalance * (riskPercent / 100);

  // 4. Calculate number of contracts that fit our exact risk appetite
  let contracts = Math.floor(targetRiskAmount / stopDistancePerContract);

  // 5. Hard limit constraint: Cannot exceed available free margin capital
  const maxContractsByMargin = Math.floor(availableMarginCapital / marginPerContract);
  contracts = Math.min(contracts, maxContractsByMargin);

  // 6. Enforce exchange minimum NOTIONAL requirement (typically ~5 USDT on MEXC)
  const notionalPerContract = entryPrice * contractSize;
  const minContractRequirement = Math.ceil(5.1 / notionalPerContract); // 5.1 USDT position size safe limit
  
  if (contracts < minContractRequirement) {
    const forcedRisk = minContractRequirement * stopDistancePerContract;
    // If forcing the minimum trade size violates our maximum risk tolerance by too much, abort.
    if (forcedRisk > targetRiskAmount * 2.0) {
      return 0; // Too risky to meet exchange minimums
    }
    contracts = minContractRequirement;
  }

  // Final check: if even the minimum contracts exceed our available capital, we can't trade
  if (contracts * marginPerContract > availableMarginCapital) return 0;

  return Math.max(0, contracts);
}

/**
 * Kelly Criterion fraction — tells what % of capital to risk.
 * f* = (p * b - q) / b   where b = avg_win/avg_loss, p = win rate, q = 1-p
 * Apply half-kelly (safer): f = f* / 2
 */
export function calcKellyFraction(
  winRate: number,     // 0-1
  avgWinRR: number,    // avg risk:reward of winning trades (e.g. 2.5)
  avgLossRR = 1        // avg loss RR (usually 1)
): number {
  if (winRate <= 0 || winRate >= 1) return 0.01;
  const b = avgWinRR / avgLossRR;
  const p = winRate;
  const q = 1 - p;
  const kelly = (p * b - q) / b;
  const halfKelly = kelly / 2;
  return Math.max(0.005, Math.min(0.05, halfKelly)); // Cap between 0.5% and 5%
}

/**
 * Quick backtest: run the generateSignal logic on historical candles
 * and count how many times the signal direction was correct.
 */
export function calcWinRate(
  candles: CandlePoint[],
  signalType: 'LONG' | 'SHORT' | 'NEUTRAL',
  lookbackBars = 100,
  forwardBars = 10
): { winRate: number; trialCount: number; wins: number } {
  if (signalType === 'NEUTRAL' || candles.length < lookbackBars + forwardBars) {
    return { winRate: 0.5, trialCount: 0, wins: 0 };
  }

  let wins = 0;
  let trials = 0;
  const step = Math.max(1, Math.floor(lookbackBars / 20)); // test ~20 points

  for (let i = lookbackBars; i < candles.length - forwardBars; i += step) {
    const entryCandle = candles[i];
    const futureCandles = candles.slice(i + 1, i + 1 + forwardBars);
    const highestHigh = Math.max(...futureCandles.map(c => c.high));
    const lowestLow = Math.min(...futureCandles.map(c => c.low));
    const atr = calcSimpleATR(candles.slice(i - 14, i));

    if (atr === 0) continue;
    trials++;

    if (signalType === 'LONG') {
      // Win if price went up by 1.5 ATR before going down by 1 ATR
      const tpHit = highestHigh >= entryCandle.close + atr * 1.5;
      const slHit = lowestLow <= entryCandle.close - atr;
      if (tpHit && !slHit) wins++;
      else if (tpHit && slHit) {
        // TP and SL both hit — count time order to determine winner
        const tpFirst = futureCandles.findIndex(c => c.high >= entryCandle.close + atr * 1.5);
        const slFirst = futureCandles.findIndex(c => c.low <= entryCandle.close - atr);
        if (tpFirst !== -1 && (slFirst === -1 || tpFirst < slFirst)) wins++;
      }
    } else if (signalType === 'SHORT') {
      const tpHit = lowestLow <= entryCandle.close - atr * 1.5;
      const slHit = highestHigh >= entryCandle.close + atr;
      if (tpHit && !slHit) wins++;
      else if (tpHit && slHit) {
        const tpFirst = futureCandles.findIndex(c => c.low <= entryCandle.close - atr * 1.5);
        const slFirst = futureCandles.findIndex(c => c.high >= entryCandle.close + atr);
        if (tpFirst !== -1 && (slFirst === -1 || tpFirst < slFirst)) wins++;
      }
    }
  }

  const winRate = trials > 0 ? wins / trials : 0.5;
  return { winRate: Math.round(winRate * 100) / 100, trialCount: trials, wins };
}

function calcSimpleATR(candles: CandlePoint[]): number {
  if (candles.length < 2) return 0;
  const trs = candles.map((c, i) => {
    if (i === 0) return c.high - c.low;
    const prev = candles[i - 1];
    return Math.max(c.high - c.low, Math.abs(c.high - prev.close), Math.abs(c.low - prev.close));
  });
  return trs.reduce((a, b) => a + b, 0) / trs.length;
}

/**
 * Calculate dynamic TP/SL based on ATR and signal strength.
 * Returns adjusted TP and SL prices.
 */
export function calcDynamicTPSL(
  entryPrice: number,
  atr: number,
  direction: 'LONG' | 'SHORT',
  strength: TradeSignal['strength'],
  winRate = 0.5
): { takeProfit: number; stopLoss: number; riskReward: number } {
  // Adjust multipliers based on strength and win rate
  const slMult = strength === 'STRONG' ? 1.2 : strength === 'MODERATE' ? 1.5 : 2.0;
  // Higher win rate → can aim for larger TP
  const tpMult = slMult * (winRate >= 0.6 ? 2.5 : winRate >= 0.5 ? 2.0 : 1.5);

  let takeProfit: number;
  let stopLoss: number;

  if (direction === 'LONG') {
    stopLoss = entryPrice - atr * slMult;
    takeProfit = entryPrice + atr * tpMult;
  } else {
    stopLoss = entryPrice + atr * slMult;
    takeProfit = entryPrice - atr * tpMult;
  }

  const risk = Math.abs(entryPrice - stopLoss);
  const reward = Math.abs(takeProfit - entryPrice);
  const riskReward = risk > 0 ? reward / risk : 1;

  return { takeProfit, stopLoss, riskReward };
}

export function ensureValidTPSL(
  entryPrice: number,
  takeProfit: number,
  stopLoss: number,
  direction: 'LONG' | 'SHORT',
  strength: TradeSignal['strength'],
  winRate = 0.5,
  atr = Math.abs(entryPrice) * 0.01,
): { takeProfit: number; stopLoss: number; riskReward: number; usedFallback: boolean } {
  const hasValidLevels = direction === 'LONG'
    ? takeProfit > entryPrice && stopLoss < entryPrice
    : takeProfit < entryPrice && stopLoss > entryPrice;

  if (hasValidLevels) {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);
    return {
      takeProfit,
      stopLoss,
      riskReward: risk > 0 ? reward / risk : 1,
      usedFallback: false,
    };
  }

  const fallback = calcDynamicTPSL(entryPrice, Math.max(atr, entryPrice * 0.0025), direction, strength, winRate);
  return {
    ...fallback,
    usedFallback: true,
  };
}

/**
 * Calculate daily P&L from auto-trade logs.
 */
export function calcDailyPnL(logs: { pnl?: number; timestamp: number }[]): number {
  const now = new Date();
  const todayStartUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  return logs
    .filter(l => l.timestamp >= todayStartUtc && l.pnl !== undefined)
    .reduce((sum, l) => sum + (l.pnl || 0), 0);
}
