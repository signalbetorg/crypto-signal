export interface SignalParams {
  emaGapMin: number;
  volumeMult: number;
  adxMin: number;
  lookback: number;
  bodyMult: number;
  targetPct: number;
  stopPct: number;
}

export const DEFAULT_PARAMS: SignalParams = {
  emaGapMin: 0.3,
  volumeMult: 2.5,
  adxMin: 25,
  lookback: 20,
  bodyMult: 1.0,
  targetPct: 5.0,
  stopPct: 1.5,
};

export const PARAMS_5M15M: SignalParams = {
  ...DEFAULT_PARAMS,
  targetPct: 2.0,
  stopPct: 1.0,
};

export const EMA_PULLBACK_PARAMS: SignalParams = {
  ...DEFAULT_PARAMS,
  targetPct: 3.0,
  stopPct: 1.0,
};

export const SIGNAL_EXPIRY_MS = 2 * 60 * 60 * 1000;
export const WATCH_EXPIRY_MS = 30 * 60 * 1000;
export const SIGNAL_EXPIRY_MS_5M = 2 * 60 * 60 * 1000;
