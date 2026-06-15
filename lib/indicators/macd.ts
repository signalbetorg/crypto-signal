import { calculateEMA } from './ema';

export interface MACDResult {
  macd: number;
  signal: number;
}

export function calculateMACD(
  closes: number[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): MACDResult | null {
  if (closes.length < slow + signalPeriod) return null;

  const macdLine: number[] = [];
  for (let i = slow; i <= closes.length; i++) {
    const slice = closes.slice(0, i);
    const fastEma = calculateEMA(slice, fast);
    const slowEma = calculateEMA(slice, slow);
    if (fastEma === null || slowEma === null) continue;
    macdLine.push(fastEma - slowEma);
  }

  if (macdLine.length < signalPeriod) return null;

  const signal = calculateEMA(macdLine, signalPeriod);
  if (signal === null) return null;

  return {
    macd: macdLine[macdLine.length - 1],
    signal,
  };
}
