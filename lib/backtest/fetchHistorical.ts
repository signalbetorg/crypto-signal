import type { Candle } from '@/lib/exchanges/types';

type Interval = '5m' | '15m' | '1h';

const INTERVAL_MS: Record<Interval, number> = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
};

function parseKlines(data: unknown[][]): Candle[] {
  return data.map((k) => ({
    time: k[0] as number,
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
    isClosed: true,
  }));
}

async function fetchKlinesPage(
  symbol: string,
  interval: Interval,
  startTime: number,
  endTime: number,
): Promise<Candle[]> {
  const url =
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}` +
    `&startTime=${startTime}&endTime=${endTime}&limit=1000`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance API error: ${res.status}`);
  const data: unknown[][] = await res.json();
  return parseKlines(data);
}

async function fetchRange(symbol: string, interval: Interval, days: number): Promise<Candle[]> {
  const endTime = Date.now();
  const startTime = endTime - days * 24 * 60 * 60 * 1000;
  const step = INTERVAL_MS[interval] * 1000;
  const all: Candle[] = [];
  let cursor = startTime;

  while (cursor < endTime) {
    const batch = await fetchKlinesPage(symbol, interval, cursor, endTime);
    if (batch.length === 0) break;
    all.push(...batch);
    const lastTime = batch[batch.length - 1].time;
    if (lastTime <= cursor) break;
    cursor = lastTime + step;
    if (batch.length < 1000) break;
  }

  const seen = new Set<number>();
  return all
    .filter((c) => {
      if (seen.has(c.time)) return false;
      seen.add(c.time);
      return true;
    })
    .sort((a, b) => a.time - b.time);
}

export async function fetchHistoricalCandles(
  symbol: string,
  interval: '15m' | '5m',
  days: number,
): Promise<Candle[]> {
  return fetchRange(symbol, interval, days);
}

export async function fetchHistorical1hCandles(symbol: string, days = 90): Promise<Candle[]> {
  return fetchRange(symbol, '1h', days);
}

export async function fetchHistorical5mCandles(symbol: string, days: number): Promise<Candle[]> {
  return fetchRange(symbol, '5m', days);
}
