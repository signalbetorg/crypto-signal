import type { Candle } from '@/lib/exchanges/types';
import type { Signal } from './types';
import {
  DEFAULT_PARAMS,
  EMA_PULLBACK_PARAMS,
  PARAMS_5M15M,
  SIGNAL_EXPIRY_MS,
  SIGNAL_EXPIRY_MS_5M,
  WATCH_EXPIRY_MS,
  type SignalParams,
} from './config';
import { evaluateConditions, evaluateEMAPullback } from './evaluate';

function neutralSignal(symbol: string, price: number, timestamp: number): Signal {
  return {
    type: 'NEUTRAL',
    symbol,
    price,
    interval: '15m',
    timestamp,
    conditionsFired: 0,
    confidence: 0,
    reasons: [],
    target: null,
    stopLoss: null,
    expiresAt: Date.now() + SIGNAL_EXPIRY_MS,
    watch: null,
    limitEntry: null,
    trailingStop: null,
    strategy: 'breakout',
  };
}

function buildSignal(
  type: 'BUY' | 'SELL',
  symbol: string,
  price: number,
  timestamp: number,
  conditionsFired: number,
  reasons: string[],
  params: SignalParams,
  atr: number | null,
  strategy: 'breakout' | 'ema_pullback',
  expiryMs: number,
): Signal {
  const confidence = conditionsFired * 20;
  const target =
    type === 'BUY'
      ? price * (1 + params.targetPct / 100)
      : price * (1 - params.targetPct / 100);
  const stopLoss =
    type === 'BUY'
      ? price * (1 - params.stopPct / 100)
      : price * (1 + params.stopPct / 100);
  const trailingStop =
    atr !== null
      ? type === 'BUY'
        ? price - atr * 2
        : price + atr * 2
      : null;
  const limitEntry =
    atr !== null
      ? type === 'BUY'
        ? price - atr * 0.3
        : price + atr * 0.3
      : null;

  return {
    type,
    symbol,
    price,
    interval: '15m',
    timestamp,
    conditionsFired,
    confidence,
    reasons,
    target,
    stopLoss,
    expiresAt: Date.now() + expiryMs,
    watch: null,
    limitEntry,
    trailingStop,
    strategy,
  };
}

function resolveSignal(
  evalResult: ReturnType<typeof evaluateConditions>,
  symbol: string,
  params: SignalParams,
  strategy: 'breakout' | 'ema_pullback',
  expiryMs: number,
): Signal {
  if (!evalResult) return neutralSignal(symbol, 0, Date.now());

  const { buyScore, sellScore, buyReasons, sellReasons, price, timestamp, atr } = evalResult;
  const minScore = 3;

  if (buyScore >= minScore && buyScore > sellScore) {
    return buildSignal('BUY', symbol, price, timestamp, buyScore, buyReasons, params, atr, strategy, expiryMs);
  }
  if (sellScore >= minScore && sellScore > buyScore) {
    return buildSignal('SELL', symbol, price, timestamp, sellScore, sellReasons, params, atr, strategy, expiryMs);
  }

  const base = neutralSignal(symbol, price, timestamp);
  base.strategy = strategy;

  if (buyScore >= 4 && buyScore > sellScore) {
    return {
      ...base,
      watch: 'WATCH_BUY',
      conditionsFired: buyScore,
      confidence: buyScore * 20,
      reasons: buyReasons,
      expiresAt: Date.now() + WATCH_EXPIRY_MS,
    };
  }
  if (sellScore >= 4 && sellScore > buyScore) {
    return {
      ...base,
      watch: 'WATCH_SELL',
      conditionsFired: sellScore,
      confidence: sellScore * 20,
      reasons: sellReasons,
      expiresAt: Date.now() + WATCH_EXPIRY_MS,
    };
  }

  return base;
}

export function generateSignal(
  candles5m: Candle[],
  candles15m: Candle[],
  candles1h: Candle[],
  symbol: string,
  params: SignalParams = DEFAULT_PARAMS,
): Signal {
  void candles5m;
  const evalResult = evaluateConditions(candles15m, candles1h, params);
  if (!evalResult) {
    const price = candles15m.at(-1)?.close ?? 0;
    const timestamp = candles15m.at(-1)?.time ?? Date.now();
    return neutralSignal(symbol, price, timestamp);
  }
  return resolveSignal(evalResult, symbol, params, 'breakout', SIGNAL_EXPIRY_MS);
}

export function generateSignal5m15m(
  candles5m: Candle[],
  candles15m: Candle[],
  candles1h: Candle[],
  symbol: string,
  params: SignalParams = PARAMS_5M15M,
): Signal {
  void candles1h;
  if (candles5m.length < 55 || candles15m.length < 55) {
    return neutralSignal(symbol, 0, Date.now());
  }

  const evalResult = evaluateConditions(candles5m, candles15m, params);
  if (!evalResult) {
    const price = candles5m.at(-1)?.close ?? 0;
    const timestamp = candles5m.at(-1)?.time ?? Date.now();
    return neutralSignal(symbol, price, timestamp);
  }

  const signal = resolveSignal(evalResult, symbol, params, 'breakout', SIGNAL_EXPIRY_MS_5M);
  signal.interval = '5m';
  return signal;
}

export function generateSignalEMAPullback(
  candles15m: Candle[],
  candles1h: Candle[],
  symbol: string,
  params: SignalParams = EMA_PULLBACK_PARAMS,
): Signal {
  const evalResult = evaluateEMAPullback(candles15m, candles1h);
  if (!evalResult) {
    const price = candles15m.at(-1)?.close ?? 0;
    const timestamp = candles15m.at(-1)?.time ?? Date.now();
    return { ...neutralSignal(symbol, price, timestamp), strategy: 'ema_pullback' };
  }
  return resolveSignal(evalResult, symbol, params, 'ema_pullback', SIGNAL_EXPIRY_MS);
}
