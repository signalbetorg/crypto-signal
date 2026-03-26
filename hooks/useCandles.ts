'use client';

import { useEffect, useState } from 'react';
import type { Candle, KlineAdapter, KlineInterval } from '@/lib/exchanges/types';

const MAX_CANDLES = 100;

async function fetchBinanceCandles(symbol: string, interval: KlineInterval): Promise<Candle[]> {
  const r = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=100`
  );
  const data: unknown[][] = await r.json();
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

export function useCandles(
  adapter: KlineAdapter,
  symbol: string,
  interval: KlineInterval,
): { candles: Candle[]; loading: boolean } {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    setCandles([]);
    setLoading(true);

    async function load() {
      try {
        if (adapter.fetchHistoricalCandles) {
          // REST-based (Coinbase, Upbit): include the current open candle.
          // Polling every 15s updates it. No WS to take over.
          const data = await adapter.fetchHistoricalCandles(symbol, interval);
          if (!cancelled) {
            setCandles(data);
            setLoading(false);
          }
        } else {
          // Binance: drop last — WS stream takes over the live open candle.
          const data = await fetchBinanceCandles(symbol, interval);
          if (!cancelled) {
            setCandles(data.slice(0, -1));
            setLoading(false);
          }
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    if (adapter.fetchHistoricalCandles) {
      // REST-based adapter (Coinbase, Upbit) — poll for updates
      pollTimer = setInterval(async () => {
        if (cancelled) return;
        try {
          const data = await adapter.fetchHistoricalCandles!(symbol, interval);
          if (!cancelled) setCandles(data);
        } catch { /* ignore */ }
      }, 15000);
    } else {
      // WS-based adapter (Binance) — live candle stream
      adapter.onCandleUpdate((candle) => {
        setCandles((prev) => {
          if (prev.length === 0) return [candle];
          const last = prev[prev.length - 1];
          if (last.time === candle.time) {
            return [...prev.slice(0, -1), candle];
          }
          const next = [...prev, candle];
          return next.length > MAX_CANDLES ? next.slice(next.length - MAX_CANDLES) : next;
        });
      });
    }

    adapter.connectKline(symbol, interval);

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
      adapter.disconnectKline();
    };
  }, [symbol, interval, adapter]);

  return { candles, loading };
}
