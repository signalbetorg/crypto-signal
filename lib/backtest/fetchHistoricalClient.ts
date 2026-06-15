import type { Candle } from '@/lib/exchanges/types';

type Interval = '5m' | '15m' | '1h';

async function fetchCandlesFromApi(
  symbol: string,
  interval: Interval,
  days: number,
): Promise<Candle[]> {
  const params = new URLSearchParams({
    symbol,
    interval,
    days: String(days),
  });
  const res = await fetch(`/api/backtest/candles?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${interval} candles for ${symbol}`);
  }
  const body = (await res.json()) as { candles: Candle[] };
  return body.candles;
}

export async function fetchHistoricalCandles(
  symbol: string,
  interval: '15m' | '5m',
  days: number,
): Promise<Candle[]> {
  return fetchCandlesFromApi(symbol, interval, days);
}

export async function fetchHistorical1hCandles(symbol: string, days = 90): Promise<Candle[]> {
  return fetchCandlesFromApi(symbol, '1h', days);
}

export async function fetchHistorical5mCandles(symbol: string, days: number): Promise<Candle[]> {
  return fetchCandlesFromApi(symbol, '5m', days);
}
