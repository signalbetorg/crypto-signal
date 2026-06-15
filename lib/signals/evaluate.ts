import type { Candle } from '@/lib/exchanges/types';
import { calculateADX } from '@/lib/indicators/adx';
import { calculateATR } from '@/lib/indicators/atr';
import { calculateEMA } from '@/lib/indicators/ema';
import type { SignalParams } from './config';
import { DEFAULT_PARAMS } from './config';

export interface ConditionResult {
  buyScore: number;
  sellScore: number;
  buyReasons: string[];
  sellReasons: string[];
  price: number;
  timestamp: number;
  atr: number | null;
}

function avg(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function evaluateConditions(
  candles15m: Candle[],
  candles1h: Candle[],
  params: SignalParams = DEFAULT_PARAMS,
): ConditionResult | null {
  if (candles15m.length < params.lookback + 5 || candles1h.length < 55) return null;

  const c15 = candles15m[candles15m.length - 1];
  const closed15 = candles15m.slice(0, -1);
  if (closed15.length < params.lookback) return null;

  const price = c15.close;
  const timestamp = c15.time;

  const h1Closes = candles1h.map((c) => c.close);
  const ema20_1h = calculateEMA(h1Closes, 20);
  const ema50_1h = calculateEMA(h1Closes, 50);

  const c15Closes = candles15m.map((c) => c.close);
  const ema20_15 = calculateEMA(c15Closes, 20);
  const ema50_15 = calculateEMA(c15Closes, 50);

  const lookbackSlice = closed15.slice(-params.lookback);
  const highestHigh = Math.max(...lookbackSlice.map((c) => c.high));
  const lowestLow = Math.min(...lookbackSlice.map((c) => c.low));

  const volumes = closed15.slice(-params.lookback).map((c) => c.volume);
  const avgVolume = avg(volumes);
  const bodies = closed15.slice(-params.lookback).map((c) => Math.abs(c.close - c.open));
  const avgBody = avg(bodies);
  const currentBody = Math.abs(c15.close - c15.open);

  const adx = calculateADX(candles15m);
  const atr = calculateATR(candles15m);

  const buyReasons: string[] = [];
  const sellReasons: string[] = [];
  let buyScore = 0;
  let sellScore = 0;

  if (ema20_1h !== null && ema50_1h !== null) {
    if (price > ema20_1h && ema20_1h > ema50_1h) {
      buyScore++;
      buyReasons.push('1h uptrend (EMA20 > EMA50)');
    }
    if (price < ema20_1h && ema20_1h < ema50_1h) {
      sellScore++;
      sellReasons.push('1h downtrend (EMA20 < EMA50)');
    }
  }

  if (price > highestHigh) {
    buyScore++;
    buyReasons.push(`${params.lookback}-bar breakout high`);
  }
  if (price < lowestLow) {
    sellScore++;
    sellReasons.push(`${params.lookback}-bar breakdown low`);
  }

  if (ema20_15 !== null && ema50_15 !== null && ema50_15 !== 0) {
    const gapPct = ((ema20_15 - ema50_15) / ema50_15) * 100;
    if (gapPct >= params.emaGapMin) {
      buyScore++;
      buyReasons.push(`EMA gap +${gapPct.toFixed(2)}%`);
    }
    if (gapPct <= -params.emaGapMin) {
      sellScore++;
      sellReasons.push(`EMA gap ${gapPct.toFixed(2)}%`);
    }
  }

  if (avgVolume > 0 && c15.volume >= avgVolume * params.volumeMult) {
    if (c15.close >= c15.open) {
      buyScore++;
      buyReasons.push(`Volume ${(c15.volume / avgVolume).toFixed(1)}× avg`);
    } else {
      sellScore++;
      sellReasons.push(`Volume ${(c15.volume / avgVolume).toFixed(1)}× avg`);
    }
  }

  if (adx !== null && adx >= params.adxMin && avgBody > 0 && currentBody >= avgBody * params.bodyMult) {
    if (c15.close >= c15.open) {
      buyScore++;
      buyReasons.push(`ADX ${adx.toFixed(0)} + momentum body`);
    } else {
      sellScore++;
      sellReasons.push(`ADX ${adx.toFixed(0)} + momentum body`);
    }
  }

  return { buyScore, sellScore, buyReasons, sellReasons, price, timestamp, atr };
}

export function evaluateEMAPullback(
  candles15m: Candle[],
  candles1h: Candle[],
): ConditionResult | null {
  if (candles15m.length < 55 || candles1h.length < 55) return null;

  const c15 = candles15m[candles15m.length - 1];
  const price = c15.close;
  const timestamp = c15.time;

  const h1Closes = candles1h.map((c) => c.close);
  const ema20_1h = calculateEMA(h1Closes, 20);
  const ema50_1h = calculateEMA(h1Closes, 50);

  const c15Closes = candles15m.map((c) => c.close);
  const ema20_15 = calculateEMA(c15Closes, 20);
  const ema50_15 = calculateEMA(c15Closes, 50);
  const atr = calculateATR(candles15m);

  const buyReasons: string[] = [];
  const sellReasons: string[] = [];
  let buyScore = 0;
  let sellScore = 0;

  if (ema20_1h !== null && ema50_1h !== null && ema20_1h > ema50_1h) {
    buyScore++;
    buyReasons.push('1h bullish structure');
  }
  if (ema20_1h !== null && ema50_1h !== null && ema20_1h < ema50_1h) {
    sellScore++;
    sellReasons.push('1h bearish structure');
  }

  if (ema20_15 !== null && ema50_15 !== null) {
    const touchedEma20 = c15.low <= ema20_15 * 1.002 && c15.close > ema20_15;
    const touchedEma50 = c15.low <= ema50_15 * 1.002 && c15.close > ema50_15;
    if (touchedEma20 || touchedEma50) {
      buyScore += 2;
      buyReasons.push('Pullback to EMA support');
    }

    const rejectedEma20 = c15.high >= ema20_15 * 0.998 && c15.close < ema20_15;
    const rejectedEma50 = c15.high >= ema50_15 * 0.998 && c15.close < ema50_15;
    if (rejectedEma20 || rejectedEma50) {
      sellScore += 2;
      sellReasons.push('Pullback to EMA resistance');
    }
  }

  const prev = candles15m[candles15m.length - 2];
  if (c15.close > prev.high) {
    buyScore++;
    buyReasons.push('Bullish continuation candle');
  }
  if (c15.close < prev.low) {
    sellScore++;
    sellReasons.push('Bearish continuation candle');
  }

  const adx = calculateADX(candles15m);
  if (adx !== null && adx >= 20) {
    if (buyScore > sellScore) {
      buyScore++;
      buyReasons.push(`ADX ${adx.toFixed(0)} trend strength`);
    } else if (sellScore > buyScore) {
      sellScore++;
      sellReasons.push(`ADX ${adx.toFixed(0)} trend strength`);
    }
  }

  return { buyScore, sellScore, buyReasons, sellReasons, price, timestamp, atr };
}
