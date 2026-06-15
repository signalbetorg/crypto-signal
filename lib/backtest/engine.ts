import type { Candle } from '@/lib/exchanges/types';
import {
  generateSignal,
  generateSignal5m15m,
  generateSignalEMAPullback,
} from '@/lib/signals/generator';
import type { SignalParams } from '@/lib/signals/config';
import {
  DEFAULT_PARAMS,
  EMA_PULLBACK_PARAMS,
  PARAMS_5M15M,
  SIGNAL_EXPIRY_MS,
  SIGNAL_EXPIRY_MS_5M,
} from '@/lib/signals/config';
import type { Signal } from '@/lib/signals/types';

export interface TradeResult {
  entryTime: number;
  signalType: 'BUY' | 'SELL';
  confidence: number;
  entryPrice: number;
  targetPrice: number | null;
  stopLoss: number;
  exitReason: 'TARGET' | 'STOPLOSS' | 'EXPIRED';
  profitPct: number;
}

export interface ConfidenceTier {
  winRate: number;
  signals: number;
}

export interface BacktestSummary {
  winRate: number;
  totalSignals: number;
  wins: number;
  losses: number;
  expired: number;
  signalsPerDay: number;
  avgWinPct: number;
  avgLossPct: number;
  expectedValue: number;
  avgMaxFavorableMove: number;
  pctMovedHalfTarget: number;
  pctHitFullTarget: number;
  watchCount: number;
  watchEscalationRate: number;
  pctStopsImproved: number;
  byConfidence: {
    high: ConfidenceTier;
    medium: ConfidenceTier;
    low: ConfidenceTier;
  };
}

function simulateTrade(
  signal: Signal,
  futureCandles: Candle[],
  expiryMs: number,
): TradeResult | null {
  if (signal.type === 'NEUTRAL' || signal.target === null || signal.stopLoss === null) return null;

  const entryPrice = signal.price;
  const targetPrice = signal.target;
  const stopLoss = signal.stopLoss;
  const expiryTime = signal.timestamp + expiryMs;

  let maxFavorable = 0;
  let exitReason: TradeResult['exitReason'] = 'EXPIRED';
  let exitPrice = entryPrice;

  for (const c of futureCandles) {
    if (c.time > expiryTime) break;

    if (signal.type === 'BUY') {
      const favorable = ((c.high - entryPrice) / entryPrice) * 100;
      maxFavorable = Math.max(maxFavorable, favorable);
      if (c.high >= targetPrice) {
        exitReason = 'TARGET';
        exitPrice = targetPrice;
        break;
      }
      if (c.low <= stopLoss) {
        exitReason = 'STOPLOSS';
        exitPrice = stopLoss;
        break;
      }
    } else {
      const favorable = ((entryPrice - c.low) / entryPrice) * 100;
      maxFavorable = Math.max(maxFavorable, favorable);
      if (c.low <= targetPrice) {
        exitReason = 'TARGET';
        exitPrice = targetPrice;
        break;
      }
      if (c.high >= stopLoss) {
        exitReason = 'STOPLOSS';
        exitPrice = stopLoss;
        break;
      }
    }
  }

  if (exitReason === 'EXPIRED') {
    const last = futureCandles.filter((c) => c.time <= expiryTime).at(-1);
    exitPrice = last?.close ?? entryPrice;
  }

  const profitPct =
    signal.type === 'BUY'
      ? ((exitPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - exitPrice) / entryPrice) * 100;

  return {
    entryTime: signal.timestamp,
    signalType: signal.type,
    confidence: signal.confidence,
    entryPrice,
    targetPrice,
    stopLoss,
    exitReason,
    profitPct,
  };
}

function tierForConfidence(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 75) return 'high';
  if (confidence >= 50) return 'medium';
  return 'low';
}

function summarize(
  results: TradeResult[],
  daySpan: number,
  watchCount = 0,
  watchEscalations = 0,
): BacktestSummary {
  const wins = results.filter((r) => r.exitReason === 'TARGET');
  const losses = results.filter((r) => r.exitReason === 'STOPLOSS');
  const expired = results.filter((r) => r.exitReason === 'EXPIRED');
  const resolved = wins.length + losses.length;

  const avgWinPct = wins.length ? wins.reduce((s, r) => s + r.profitPct, 0) / wins.length : 0;
  const avgLossPct = losses.length ? losses.reduce((s, r) => s + r.profitPct, 0) / losses.length : 0;
  const winRate = resolved > 0 ? (wins.length / resolved) * 100 : 0;
  const expectedValue = results.length
    ? results.reduce((s, r) => s + r.profitPct, 0) / results.length
    : 0;

  const tiers = { high: [] as TradeResult[], medium: [] as TradeResult[], low: [] as TradeResult[] };
  for (const r of results) tiers[tierForConfidence(r.confidence)].push(r);

  const tierSummary = (arr: TradeResult[]): ConfidenceTier => {
    const w = arr.filter((r) => r.exitReason === 'TARGET').length;
    const res = arr.filter((r) => r.exitReason !== 'EXPIRED').length;
    return { winRate: res > 0 ? (w / res) * 100 : 0, signals: arr.length };
  };

  return {
    winRate,
    totalSignals: results.length,
    wins: wins.length,
    losses: losses.length,
    expired: expired.length,
    signalsPerDay: daySpan > 0 ? results.length / daySpan : 0,
    avgWinPct,
    avgLossPct,
    expectedValue,
    avgMaxFavorableMove: 0,
    pctMovedHalfTarget: 0,
    pctHitFullTarget: winRate,
    watchCount,
    watchEscalationRate: watchCount > 0 ? (watchEscalations / watchCount) * 100 : 0,
    pctStopsImproved: 0,
    byConfidence: {
      high: tierSummary(tiers.high),
      medium: tierSummary(tiers.medium),
      low: tierSummary(tiers.low),
    },
  };
}

function runSimulation(
  entryCandles: Candle[],
  trendCandles: Candle[],
  filterCandles: Candle[],
  symbol: string,
  params: SignalParams,
  mode: '15m1h' | '5m15m' | 'ema_pullback',
  expiryMs: number,
): { results: TradeResult[]; summary: BacktestSummary } {
  const results: TradeResult[] = [];
  let watchCount = 0;
  let watchEscalations = 0;
  const minLen = mode === '5m15m' ? 60 : 60;

  for (let i = minLen; i < entryCandles.length - 1; i++) {
    const c15slice = entryCandles.slice(0, i + 1);
    const h1slice = trendCandles.filter((c) => c.time <= entryCandles[i].time);
    const c5slice = filterCandles.slice(0, Math.min(i + 1, filterCandles.length));

    let signal: Signal;
    if (mode === 'ema_pullback') {
      signal = generateSignalEMAPullback(c15slice, h1slice, symbol, params);
    } else if (mode === '5m15m') {
      signal = generateSignal5m15m(c5slice, c15slice, h1slice, symbol, params);
    } else {
      signal = generateSignal([], c15slice, h1slice, symbol, params);
    }

    if (signal.watch !== null) watchCount++;

    if (signal.type === 'NEUTRAL') continue;

    const last = results.at(-1);
    if (last && last.entryTime === signal.timestamp) continue;

    const future = entryCandles.slice(i + 1);
    const trade = simulateTrade(signal, future, expiryMs);
    if (trade) results.push(trade);
  }

  const daySpan =
    entryCandles.length > 1
      ? (entryCandles.at(-1)!.time - entryCandles[0].time) / (24 * 60 * 60 * 1000)
      : 1;

  return { results, summary: summarize(results, daySpan, watchCount, watchEscalations) };
}

export function runBacktest(
  candles15m: Candle[],
  candles1h: Candle[],
  symbol: string,
  params: SignalParams = DEFAULT_PARAMS,
): { results: TradeResult[]; summary: BacktestSummary } {
  return runSimulation(candles15m, candles1h, [], symbol, params, '15m1h', SIGNAL_EXPIRY_MS);
}

export function runBacktest5m15m(
  candles5m: Candle[],
  candles15m: Candle[],
  symbol: string,
  params: SignalParams = PARAMS_5M15M,
): { results: TradeResult[]; summary: BacktestSummary } {
  return runSimulation(candles5m, candles15m, candles5m, symbol, params, '5m15m', SIGNAL_EXPIRY_MS_5M);
}

export function runBacktestEMAPullback(
  candles15m: Candle[],
  candles1h: Candle[],
  symbol: string,
  params: SignalParams = EMA_PULLBACK_PARAMS,
): { results: TradeResult[]; summary: BacktestSummary } {
  return runSimulation(candles15m, candles1h, [], symbol, params, 'ema_pullback', SIGNAL_EXPIRY_MS);
}
