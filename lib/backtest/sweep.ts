import type { Candle } from '@/lib/exchanges/types';
import { DEFAULT_PARAMS, EMA_PULLBACK_PARAMS, PARAMS_5M15M, type SignalParams } from '@/lib/signals/config';
import {
  runBacktest,
  runBacktest5m15m,
  runBacktestEMAPullback,
  type BacktestSummary,
} from './engine';

export interface SweepResult {
  targetPct: number;
  stopPct: number;
  summary: BacktestSummary;
}

export interface TriggerSweepResult {
  paramValue: number;
  summary: BacktestSummary;
}

const TARGET_GRID_15M = [3.0, 4.0, 5.0, 6.0, 7.0];
const STOP_GRID_15M = [1.0, 1.5, 2.0, 2.5, 3.0];
const TARGET_GRID_5M = [1.5, 2.0, 2.5, 3.0];
const STOP_GRID_5M = [0.75, 1.0, 1.25, 1.5];

function withParams(base: SignalParams, targetPct: number, stopPct: number): SignalParams {
  return { ...base, targetPct, stopPct };
}

export function runParameterSweep(
  candles15m: Candle[],
  candles1h: Candle[],
  symbol: string,
): SweepResult[] {
  const out: SweepResult[] = [];
  for (const targetPct of TARGET_GRID_15M) {
    for (const stopPct of STOP_GRID_15M) {
      const params = withParams(DEFAULT_PARAMS, targetPct, stopPct);
      const { summary } = runBacktest(candles15m, candles1h, symbol, params);
      out.push({ targetPct, stopPct, summary });
    }
  }
  return out;
}

export function runParameterSweep5m15m(
  candles5m: Candle[],
  candles15m: Candle[],
  symbol: string,
): SweepResult[] {
  const out: SweepResult[] = [];
  for (const targetPct of TARGET_GRID_5M) {
    for (const stopPct of STOP_GRID_5M) {
      const params = withParams(PARAMS_5M15M, targetPct, stopPct);
      const { summary } = runBacktest5m15m(candles5m, candles15m, symbol, params);
      out.push({ targetPct, stopPct, summary });
    }
  }
  return out;
}

export function runParameterSweepEMAPullback(
  candles15m: Candle[],
  candles1h: Candle[],
  symbol: string,
): SweepResult[] {
  const targets = [2.0, 2.5, 3.0, 3.5];
  const stops = [0.75, 1.0, 1.25];
  const out: SweepResult[] = [];
  for (const targetPct of targets) {
    for (const stopPct of stops) {
      const params = withParams(EMA_PULLBACK_PARAMS, targetPct, stopPct);
      const { summary } = runBacktestEMAPullback(candles15m, candles1h, symbol, params);
      out.push({ targetPct, stopPct, summary });
    }
  }
  return out;
}

function triggerSweep(
  candles15m: Candle[],
  candles1h: Candle[],
  symbol: string,
  key: keyof Pick<SignalParams, 'emaGapMin' | 'volumeMult' | 'adxMin' | 'lookback' | 'bodyMult'>,
  values: number[],
): TriggerSweepResult[] {
  return values.map((paramValue) => {
    const params = { ...DEFAULT_PARAMS, [key]: paramValue };
    const { summary } = runBacktest(candles15m, candles1h, symbol, params);
    return { paramValue, summary };
  });
}

function triggerSweep5m(
  candles5m: Candle[],
  candles15m: Candle[],
  symbol: string,
  key: keyof Pick<SignalParams, 'emaGapMin' | 'volumeMult' | 'adxMin' | 'lookback' | 'bodyMult'>,
  values: number[],
): TriggerSweepResult[] {
  return values.map((paramValue) => {
    const params = { ...PARAMS_5M15M, [key]: paramValue };
    const { summary } = runBacktest5m15m(candles5m, candles15m, symbol, params);
    return { paramValue, summary };
  });
}

export const sweepEmaGap = (c15: Candle[], c1h: Candle[], sym: string) =>
  triggerSweep(c15, c1h, sym, 'emaGapMin', [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);

export const sweepVolume = (c15: Candle[], c1h: Candle[], sym: string) =>
  triggerSweep(c15, c1h, sym, 'volumeMult', [1.5, 2.0, 2.5, 3.0, 3.5]);

export const sweepAdx = (c15: Candle[], c1h: Candle[], sym: string) =>
  triggerSweep(c15, c1h, sym, 'adxMin', [15, 20, 25, 30, 35]);

export const sweepLookback = (c15: Candle[], c1h: Candle[], sym: string) =>
  triggerSweep(c15, c1h, sym, 'lookback', [10, 15, 20, 25, 30]);

export const sweepBody = (c15: Candle[], c1h: Candle[], sym: string) =>
  triggerSweep(c15, c1h, sym, 'bodyMult', [0.5, 0.75, 1.0, 1.25, 1.5]);

export const sweepEmaGap5m = (c5: Candle[], c15: Candle[], sym: string) =>
  triggerSweep5m(c5, c15, sym, 'emaGapMin', [0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);

export const sweepVolume5m = (c5: Candle[], c15: Candle[], sym: string) =>
  triggerSweep5m(c5, c15, sym, 'volumeMult', [1.5, 2.0, 2.5, 3.0, 3.5]);

export const sweepAdx5m = (c5: Candle[], c15: Candle[], sym: string) =>
  triggerSweep5m(c5, c15, sym, 'adxMin', [15, 20, 25, 30, 35]);

export const sweepLookback5m = (c5: Candle[], c15: Candle[], sym: string) =>
  triggerSweep5m(c5, c15, sym, 'lookback', [10, 15, 20, 25, 30]);

export const sweepBody5m = (c5: Candle[], c15: Candle[], sym: string) =>
  triggerSweep5m(c5, c15, sym, 'bodyMult', [0.5, 0.75, 1.0, 1.25, 1.5]);
