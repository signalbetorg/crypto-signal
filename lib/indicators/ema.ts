export function calculateEMA(values: number[], period: number): number | null {
  if (values.length < period) return null;

  const k = 2 / (period + 1);
  let ema = values.slice(0, period).reduce((sum, v) => sum + v, 0) / period;

  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
  }

  return ema;
}

export function emaSeries(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => calculateEMA(values.slice(0, i + 1), period));
}
