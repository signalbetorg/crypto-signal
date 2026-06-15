import type { Candle } from '@/lib/exchanges/types';

export function calculateADX(candles: Candle[], period = 14): number | null {
  if (candles.length < period * 2 + 1) return null;

  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const upMove = candles[i].high - candles[i - 1].high;
    const downMove = candles[i - 1].low - candles[i].low;

    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(
      Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - candles[i - 1].close),
        Math.abs(candles[i].low - candles[i - 1].close),
      ),
    );
  }

  const smooth = (values: number[], len: number): number[] => {
    let sum = values.slice(0, len).reduce((a, b) => a + b, 0);
    const out = [sum];
    for (let i = len; i < values.length; i++) {
      sum = sum - sum / len + values[i];
      out.push(sum);
    }
    return out;
  };

  const trSmooth = smooth(tr, period);
  const plusSmooth = smooth(plusDM, period);
  const minusSmooth = smooth(minusDM, period);

  const dx: number[] = [];
  for (let i = 0; i < trSmooth.length; i++) {
    if (trSmooth[i] === 0) continue;
    const plusDI = (100 * plusSmooth[i]) / trSmooth[i];
    const minusDI = (100 * minusSmooth[i]) / trSmooth[i];
    const denom = plusDI + minusDI;
    if (denom === 0) continue;
    dx.push((100 * Math.abs(plusDI - minusDI)) / denom);
  }

  if (dx.length < period) return null;
  return dx.slice(-period).reduce((sum, v) => sum + v, 0) / period;
}
