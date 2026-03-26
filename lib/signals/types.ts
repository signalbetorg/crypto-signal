import type { KlineInterval } from '@/lib/exchanges/types';

export type SignalType = 'BUY' | 'SELL' | 'NEUTRAL';

// Intermediate indicator values captured at signal fire time — used for ML training data.
// Only populated for BUY/SELL signals (never NEUTRAL).
export interface SignalFeatures {
  adxValue: number;
  emaGapPct: number;
  volumeRatio: number;
  atrPercentile: number | null;
  confidence: number;
  signalType: SignalType;
  symbol: string;
  hourOfDay: number;
  dayOfWeek: number;
}

export interface Signal {
  type: SignalType;
  symbol: string;
  price: number;
  interval: KlineInterval;
  timestamp: number;
  conditionsFired: number;
  confidence: number;
  reasons: string[];
  target: number | null;
  stopLoss: number | null;
  expiresAt: number;
  watch: 'WATCH_BUY' | 'WATCH_SELL' | null;
  limitEntry: number | null;
  trailingStop: number | null;
  strategy: 'breakout' | 'ema_pullback';
}
