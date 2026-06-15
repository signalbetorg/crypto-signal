import { useMemo, useRef } from 'react';
import type { Candle } from '@/lib/exchanges/types';
import { generateSignal } from '@/lib/signals/generator';
import type { Signal } from '@/lib/signals/types';
import type { TradingType } from '@/hooks/useProfile';

export function useSignal(
  candles5m: Candle[],
  candles15m: Candle[],
  candles1h: Candle[],
  symbol: string,
  tradingType: TradingType = 'futures',
): { signal: Signal; history: Signal[]; watchAlert: Signal | null } {
  const historyRef = useRef<Signal[]>([]);
  const watchAlertRef = useRef<Signal | null>(null);
  const prevSymbolRef = useRef(symbol);
  // Snapshot of the candles15m reference that was active at the time of the last
  // symbol change. History additions are blocked until candles15m updates to a
  // different reference, which only happens after useCandles runs setCandles([]).
  // This is idempotent across React Strict Mode's double-render.
  const staleCandles15mRef = useRef<Candle[] | null>(null);

  if (prevSymbolRef.current !== symbol) {
    prevSymbolRef.current = symbol;
    historyRef.current = [];
    watchAlertRef.current = null;
    staleCandles15mRef.current = candles15m;
  }

  // Once candles have updated away from the stale snapshot, clear the block.
  if (staleCandles15mRef.current !== null && candles15m !== staleCandles15mRef.current) {
    staleCandles15mRef.current = null;
  }

  const candlesAreStale = staleCandles15mRef.current !== null;

  const generated = useMemo(
    () => generateSignal(candles5m, candles15m, candles1h, symbol),
    [candles5m, candles15m, candles1h, symbol],
  );

  // Track non-NEUTRAL signals in history (no consecutive duplicates).
  // Skip while candles are stale (still the previous coin's data).
  const lastHistory = historyRef.current;
  if (
    !candlesAreStale &&
    generated.type !== 'NEUTRAL' &&
    (lastHistory.length === 0 ||
      lastHistory[lastHistory.length - 1].timestamp !== generated.timestamp)
  ) {
    const lastType = lastHistory.length > 0 ? lastHistory[lastHistory.length - 1].type : null;
    if (lastType !== generated.type) {
      const updated = [...lastHistory, generated];
      historyRef.current = updated.slice(-20);
    }
  }

  // Track WATCH signals (not added to history)
  if (!candlesAreStale && generated.watch !== null) {
    watchAlertRef.current = generated;
  }

  // Check expiry on every render
  let signal: Signal =
    generated.type !== 'NEUTRAL' && Date.now() > generated.expiresAt
      ? { ...generated, type: 'NEUTRAL' }
      : generated;

  // Spot users: suppress SELL signals
  if (tradingType === 'spot' && signal.type === 'SELL') {
    signal = { ...signal, type: 'NEUTRAL' };
  }

  const history =
    tradingType === 'spot'
      ? historyRef.current.filter((s) => s.type !== 'SELL')
      : historyRef.current;

  const watchAlert: Signal | null =
    watchAlertRef.current !== null && Date.now() < watchAlertRef.current.expiresAt
      ? watchAlertRef.current
      : null;

  return { signal, history, watchAlert };
}
