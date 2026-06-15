import { NextRequest, NextResponse } from 'next/server';
import {
  fetchHistoricalCandles,
  fetchHistorical1hCandles,
  fetchHistorical5mCandles,
} from '@/lib/backtest/fetchHistorical';
import { cacheGetJson, cacheSetJson } from '@/lib/redis/cache';
import type { Candle } from '@/lib/exchanges/types';

const CACHE_TTL_SEC = 3600;

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const symbol = searchParams.get('symbol');
  const interval = searchParams.get('interval');
  const daysParam = searchParams.get('days');

  if (!symbol || !interval) {
    return NextResponse.json({ error: 'symbol and interval are required' }, { status: 400 });
  }

  if (!['5m', '15m', '1h'].includes(interval)) {
    return NextResponse.json({ error: 'interval must be 5m, 15m, or 1h' }, { status: 400 });
  }

  const days = daysParam ? Number(daysParam) : interval === '1h' ? 90 : 90;
  if (!Number.isFinite(days) || days <= 0 || days > 365) {
    return NextResponse.json({ error: 'days must be between 1 and 365' }, { status: 400 });
  }

  const cacheKey = `backtest:candles:${symbol}:${interval}:${days}`;
  const cached = await cacheGetJson<Candle[]>(cacheKey);
  if (cached) {
    return NextResponse.json({ candles: cached, cached: true });
  }

  let candles: Candle[];
  if (interval === '1h') {
    candles = await fetchHistorical1hCandles(symbol, days);
  } else if (interval === '5m') {
    candles = await fetchHistorical5mCandles(symbol, days);
  } else {
    candles = await fetchHistoricalCandles(symbol, '15m', days);
  }

  await cacheSetJson(cacheKey, candles, CACHE_TTL_SEC);

  return NextResponse.json({ candles, cached: false });
}
