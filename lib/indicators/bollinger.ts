import type { Candle } from '@/lib/exchanges/types';

export interface BollingerBands {
  upper: number;
  middle: number;
  lower: number;
}

export function calculateBollinger(candles: Candle[], period = 20, stdDev = 2): BollingerBands | null {
  if (candles.length < period) return null;

  const closes = candles.slice(-period).map((c) => c.close);
  const middle = closes.reduce((sum, c) => sum + c, 0) / period;
  const variance = closes.reduce((sum, c) => sum + (c - middle) ** 2, 0) / period;
  const deviation = Math.sqrt(variance);

  return {
    middle,
    upper: middle + stdDev * deviation,
    lower: middle - stdDev * deviation,
  };
}
