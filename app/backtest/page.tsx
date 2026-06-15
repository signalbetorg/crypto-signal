'use client';

import { useState, useCallback, useRef } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { fetchHistoricalCandles, fetchHistorical1hCandles, fetchHistorical5mCandles } from '@/lib/backtest/fetchHistoricalClient';
import { runBacktest, runBacktest5m15m, runBacktestEMAPullback, type TradeResult, type BacktestSummary } from '@/lib/backtest/engine';
import {
  runParameterSweep,
  runParameterSweep5m15m,
  runParameterSweepEMAPullback,
  sweepEmaGap,
  sweepVolume,
  sweepAdx,
  sweepLookback,
  sweepBody,
  sweepEmaGap5m,
  sweepVolume5m,
  sweepAdx5m,
  sweepLookback5m,
  sweepBody5m,
  type SweepResult,
  type TriggerSweepResult,
} from '@/lib/backtest/sweep';
import type { Candle } from '@/lib/exchanges/types';

const DAYS = 90;
const DAYS_5M = 30;
const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'XLMUSDT', 'TRXUSDT', 'LINKUSDT', 'SUIUSDT', 'HBARUSDT', 'DOTUSDT', 'BCHUSDT'] as const;
const TRIGGER_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT', 'BNBUSDT', 'DOGEUSDT'] as const;
const EMA_PULLBACK_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XRPUSDT'] as const;
type Symbol = (typeof SYMBOLS)[number];
type TriggerSymbol = (typeof TRIGGER_SYMBOLS)[number];
type EMAPullbackSymbol = (typeof EMA_PULLBACK_SYMBOLS)[number];
type Mode = 'single' | 'sweep' | 'trigger' | '5m15m' | 'ema_pullback';
type Timeframe = '15m1h' | '5m15m';
type TriggerVar = 'emaGap' | 'volume' | 'adx' | 'lookback' | 'body';
type SweepSortKey = 'expectedValue' | 'winRate' | 'avgWinPct' | 'avgLossPct' | 'signalsPerDay';

const TRIGGER_VAR_LABELS: Record<TriggerVar, string> = {
  emaGap: 'EMA Gap',
  volume: 'Volume ×',
  adx: 'ADX Min',
  lookback: 'Lookback',
  body: 'Body ×',
};

const TRIGGER_BASELINE: Record<TriggerVar, number> = {
  emaGap: 0.3,
  volume: 2.5,
  adx: 25,
  lookback: 20,
  body: 1.0,
};

const TRIGGER_SWEEP_FNS: Record<TriggerVar, (c15m: Candle[], c1h: Candle[], sym: string) => TriggerSweepResult[]> = {
  emaGap: sweepEmaGap,
  volume: sweepVolume,
  adx: sweepAdx,
  lookback: sweepLookback,
  body: sweepBody,
};

const TRIGGER_SWEEP_FNS_5M: Record<TriggerVar, (c5m: Candle[], c15m: Candle[], sym: string) => TriggerSweepResult[]> = {
  emaGap: sweepEmaGap5m,
  volume: sweepVolume5m,
  adx: sweepAdx5m,
  lookback: sweepLookback5m,
  body: sweepBody5m,
};

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals);
}

function fmtPrice(price: number): string {
  return price < 10
    ? price.toFixed(4)
    : price.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function BacktestPage() {
  if (process.env.NODE_ENV === 'production') notFound();

  const [symbol, setSymbol] = useState<Symbol>('BTCUSDT');
  const [mode, setMode] = useState<Mode>('single');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Single (15m/1h)
  const [summary, setSummary] = useState<BacktestSummary | null>(null);
  const [results, setResults] = useState<TradeResult[]>([]);

  // Sweep (15m/1h)
  const [sweepResults, setSweepResults] = useState<SweepResult[]>([]);
  const [sweepTimeframe, setSweepTimeframe] = useState<Timeframe>('15m1h');
  const [sweepResults5m, setSweepResults5m] = useState<SweepResult[]>([]);
  const [sweepSortKey, setSweepSortKey] = useState<SweepSortKey>('expectedValue');
  const [sweepSortAsc, setSweepSortAsc] = useState(false);

  // Trigger sweep
  const [triggerSweepVar, setTriggerSweepVar] = useState<TriggerVar>('emaGap');
  const [triggerResults, setTriggerResults] = useState<TriggerSweepResult[]>([]);
  const [triggerSymbol, setTriggerSymbol] = useState<TriggerSymbol>('BTCUSDT');
  const [triggerTimeframe, setTriggerTimeframe] = useState<Timeframe>('15m1h');
  const [triggerResults5m, setTriggerResults5m] = useState<TriggerSweepResult[]>([]);

  // 5m/15m single
  const [summary5m, setSummary5m] = useState<BacktestSummary | null>(null);
  const [results5m, setResults5m] = useState<TradeResult[]>([]);

  // EMA Pullback
  const [emaPullbackSymbol, setEmaPullbackSymbol] = useState<EMAPullbackSymbol>('BTCUSDT');
  const [emaPullbackSubMode, setEmaPullbackSubMode] = useState<'single' | 'sweep'>('single');
  const [emaPullbackSummary, setEmaPullbackSummary] = useState<BacktestSummary | null>(null);
  const [emaPullbackResults, setEmaPullbackResults] = useState<TradeResult[]>([]);
  const [emaPullbackSweepResults, setEmaPullbackSweepResults] = useState<SweepResult[]>([]);

  // Refs so runAnalysis always reads current values without stale closure
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;
  const triggerVarRef = useRef<TriggerVar>(triggerSweepVar);
  triggerVarRef.current = triggerSweepVar;
  const triggerSymbolRef = useRef<TriggerSymbol>(triggerSymbol);
  triggerSymbolRef.current = triggerSymbol;
  const sweepTimeframeRef = useRef<Timeframe>(sweepTimeframe);
  sweepTimeframeRef.current = sweepTimeframe;
  const triggerTimeframeRef = useRef<Timeframe>(triggerTimeframe);
  triggerTimeframeRef.current = triggerTimeframe;
  const emaPullbackSymbolRef = useRef<EMAPullbackSymbol>(emaPullbackSymbol);
  emaPullbackSymbolRef.current = emaPullbackSymbol;
  const emaPullbackSubModeRef = useRef<'single' | 'sweep'>(emaPullbackSubMode);
  emaPullbackSubModeRef.current = emaPullbackSubMode;

  const runAnalysis = useCallback(async () => {
    const currentMode = modeRef.current;
    const currentTriggerVar = triggerVarRef.current;
    const currentTriggerSymbol = triggerSymbolRef.current;
    const currentSweepTimeframe = sweepTimeframeRef.current;
    const currentTriggerTimeframe = triggerTimeframeRef.current;
    const currentEMASym = emaPullbackSymbolRef.current;
    const currentEMASubMode = emaPullbackSubModeRef.current;

    setLoading(true);
    setError(null);

    if (currentMode === 'ema_pullback') {
      setEmaPullbackSummary(null);
      setEmaPullbackResults([]);
      setEmaPullbackSweepResults([]);
      try {
        setStatus(`Fetching ${currentEMASym} 15m candles (90 days)...`);
        const candles15m: Candle[] = await fetchHistoricalCandles(currentEMASym, '15m', DAYS);

        setStatus(`Fetching ${currentEMASym} 1h candles (90 days)...`);
        const candles1h: Candle[] = await fetchHistorical1hCandles(currentEMASym);

        if (currentEMASubMode === 'single') {
          setStatus(`Running EMA Pullback backtest on ${candles15m.length} × 15m candles...`);
          const { results: r, summary: s } = runBacktestEMAPullback(candles15m, candles1h, currentEMASym);
          setEmaPullbackSummary(s);
          setEmaPullbackResults(r);
        } else {
          setStatus('Running EMA Pullback parameter sweep (12 combos)...');
          const sweep = runParameterSweepEMAPullback(candles15m, candles1h, currentEMASym);
          setEmaPullbackSweepResults(sweep);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
        setStatus('');
      }
    } else if (currentMode === '5m15m') {
      setSummary5m(null);
      setResults5m([]);
      try {
        setStatus(`Fetching ${symbol} 5m candles (${DAYS_5M} days)...`);
        const candles5m: Candle[] = await fetchHistorical5mCandles(symbol, DAYS_5M);

        setStatus(`Fetching ${symbol} 15m candles (${DAYS_5M} days)...`);
        const candles15m: Candle[] = await fetchHistoricalCandles(symbol, '15m', DAYS_5M);

        setStatus(`Running 5m/15m backtest on ${candles5m.length} × 5m candles...`);
        const { results: r5m, summary: s5m } = runBacktest5m15m(candles5m, candles15m, symbol);
        setSummary5m(s5m);
        setResults5m(r5m);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
        setStatus('');
      }
    } else if (currentMode === 'trigger') {
      if (currentTriggerTimeframe === '5m15m') {
        setTriggerResults5m([]);
        try {
          setStatus(`Fetching ${currentTriggerSymbol} 5m candles (${DAYS_5M} days)...`);
          const candles5m: Candle[] = await fetchHistorical5mCandles(currentTriggerSymbol, DAYS_5M);

          setStatus(`Fetching ${currentTriggerSymbol} 15m candles (${DAYS_5M} days)...`);
          const candles15m: Candle[] = await fetchHistoricalCandles(currentTriggerSymbol, '15m', DAYS_5M);

          setStatus(`Running 5m trigger sweep (${TRIGGER_VAR_LABELS[currentTriggerVar]})...`);
          const tResults = TRIGGER_SWEEP_FNS_5M[currentTriggerVar](candles5m, candles15m, currentTriggerSymbol);
          setTriggerResults5m(tResults);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setLoading(false);
          setStatus('');
        }
      } else {
        setTriggerResults([]);
        try {
          setStatus(`Fetching ${currentTriggerSymbol} 15m candles (90 days)...`);
          const candles15m: Candle[] = await fetchHistoricalCandles(currentTriggerSymbol, '15m', DAYS);

          setStatus(`Fetching ${currentTriggerSymbol} 1h candles (90 days)...`);
          const candles1h: Candle[] = await fetchHistorical1hCandles(currentTriggerSymbol);

          setStatus(`Running trigger sweep (${TRIGGER_VAR_LABELS[currentTriggerVar]})...`);
          const tResults = TRIGGER_SWEEP_FNS[currentTriggerVar](candles15m, candles1h, currentTriggerSymbol);
          setTriggerResults(tResults);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        } finally {
          setLoading(false);
          setStatus('');
        }
      }
    } else if (currentMode === 'sweep' && currentSweepTimeframe === '5m15m') {
      setSweepResults5m([]);
      try {
        setStatus(`Fetching ${symbol} 5m candles (${DAYS_5M} days)...`);
        const candles5m: Candle[] = await fetchHistorical5mCandles(symbol, DAYS_5M);

        setStatus(`Fetching ${symbol} 15m candles (${DAYS_5M} days)...`);
        const candles15m: Candle[] = await fetchHistoricalCandles(symbol, '15m', DAYS_5M);

        setStatus(`Running 5m/15m parameter sweep (${PARAM_PAIRS_5M_COUNT} combos)...`);
        const sweep = runParameterSweep5m15m(candles5m, candles15m, symbol);
        setSweepResults5m(sweep);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
        setStatus('');
      }
    } else {
      setSummary(null);
      setResults([]);
      setSweepResults([]);
      try {
        setStatus(`Fetching ${symbol} 15m candles (90 days)...`);
        const candles15m: Candle[] = await fetchHistoricalCandles(symbol, '15m', DAYS);

        setStatus(`Fetching ${symbol} 1h candles (90 days)...`);
        const candles1h: Candle[] = await fetchHistorical1hCandles(symbol);

        setStatus(`Running backtest on ${candles15m.length} × 15m candles...`);
        const { results: tradeResults, summary: btSummary } = runBacktest(candles15m, candles1h, symbol);
        setSummary(btSummary);
        setResults(tradeResults);

        setStatus('Running 25 parameter combos...');
        const sweep = runParameterSweep(candles15m, candles1h, symbol);
        setSweepResults(sweep);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
        setStatus('');
      }
    }
  }, [symbol]);

  const activeSummary = mode === '5m15m' ? summary5m : summary;
  const activeResults = mode === '5m15m' ? results5m : results;
  const activeSweepResults = sweepTimeframe === '5m15m' ? sweepResults5m : sweepResults;
  const activeTriggerResults = triggerTimeframe === '5m15m' ? triggerResults5m : triggerResults;
  const winRateColor =
    activeSummary && activeSummary.winRate >= 51 ? 'text-green-400' : 'text-red-400';

  const sortedSweep = [...activeSweepResults].sort((a, b) => {
    const av = a.summary[sweepSortKey];
    const bv = b.summary[sweepSortKey];
    return sweepSortAsc ? av - bv : bv - av;
  });

  function handleSweepSort(key: SweepSortKey) {
    if (sweepSortKey === key) {
      setSweepSortAsc(!sweepSortAsc);
    } else {
      setSweepSortKey(key);
      setSweepSortAsc(false);
    }
  }

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: SweepSortKey }) => (
    <th
      className="text-right px-3 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono cursor-pointer hover:text-zinc-400 transition-colors select-none"
      onClick={() => handleSweepSort(sortKey)}
    >
      {label}
      {sweepSortKey === sortKey && (
        <span className="ml-1">{sweepSortAsc ? '↑' : '↓'}</span>
      )}
    </th>
  );

  const hasResults = summary !== null || triggerResults.length > 0 || summary5m !== null
    || sweepResults5m.length > 0 || triggerResults5m.length > 0
    || emaPullbackSummary !== null || emaPullbackSweepResults.length > 0;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span
                className="font-mono text-[10px] uppercase tracking-[0.3em] text-emerald-600/70"
                style={{ filter: 'drop-shadow(0 0 4px rgba(16,185,129,0.35))' }}
              >
                CS
              </span>
              <span className="text-zinc-800 text-[10px] font-mono">/</span>
              <h1 className="text-xl font-bold font-mono tracking-tight text-zinc-100">Backtest</h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-900 border border-zinc-700/50 text-zinc-500">{symbol.replace('USDT', '')}</span>
            </div>
            <p className="text-zinc-600 text-[10px] font-mono uppercase tracking-widest">
              {mode === '5m15m'
                ? `${DAYS_5M}-day replay · 5m entry · 15m trend filter · 2h expiry`
                : '90-day replay · 15m entry · 1h trend filter'}
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-wrap gap-1">
              {SYMBOLS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSymbol(s)}
                  disabled={loading}
                  className={`px-2.5 py-1 rounded-full text-xs font-mono transition-colors disabled:opacity-40 ${
                    symbol === s
                      ? 'bg-zinc-700 text-zinc-100 font-semibold'
                      : 'bg-zinc-900 border border-zinc-700/50 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                  }`}
                >
                  {s.replace('USDT', '')}
                </button>
              ))}
            </div>
            <button
              onClick={runAnalysis}
              disabled={loading}
              className="px-4 py-1.5 rounded-lg border border-zinc-700/50 text-zinc-400 text-xs font-mono hover:border-zinc-500 hover:text-zinc-200 transition-colors disabled:opacity-40"
            >
              Re-run
            </button>
            <Link href="/" className="text-zinc-500 text-xs font-mono hover:text-zinc-300 transition-colors">
              ← Live
            </Link>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-10 text-center space-y-4">
            <div className="w-7 h-7 border-2 border-zinc-700 border-t-zinc-300 rounded-full animate-spin mx-auto" />
            <p className="text-zinc-600 text-xs font-mono mt-2">{status}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-900/40 bg-red-950/10 p-6">
            <p className="text-red-400 text-sm font-mono font-semibold mb-1">Failed to load backtest data</p>
            <p className="text-red-700 text-xs font-mono">Unable to fetch historical candles from Binance. Check your connection and try again.</p>
          </div>
        )}

        {/* Mode toggle */}
        <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800/50 w-fit">
          {(['single', 'sweep', 'trigger', '5m15m', 'ema_pullback'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 rounded-md text-xs font-mono transition-colors ${
                mode === m ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {m === 'single' ? 'Single' : m === 'sweep' ? 'Sweep' : m === 'trigger' ? 'Trigger Sweep' : m === '5m15m' ? '5m/15m' : 'EMA Pullback'}
            </button>
          ))}
        </div>

        {/* Results */}
        {hasResults && !loading && (
          <>
            {/* 5m15m empty state */}
            {mode === '5m15m' && !summary5m && (
              <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-8 text-center">
                <p className="text-zinc-600 text-xs font-mono">Click Re-run to load 5m/15m backtest ({DAYS_5M} days)</p>
              </div>
            )}

            {/* Single / 5m15m results */}
            {(mode === 'single' || mode === '5m15m') && activeSummary && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="col-span-1 rounded-xl border border-zinc-800/60 bg-zinc-950 p-6 flex flex-col items-center justify-center">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono mb-3">Win Rate</p>
                    <p
                      className={`text-5xl font-bold font-mono tabular-nums ${winRateColor}`}
                      style={activeSummary.winRate >= 51 ? { filter: 'drop-shadow(0 0 12px rgba(74,222,128,0.3))' } : {}}
                    >
                      {fmt(activeSummary.winRate)}%
                    </p>
                    <p className="text-zinc-600 text-xs font-mono mt-2">{activeSummary.totalSignals} signals total</p>
                  </div>
                  <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-6 space-y-3">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono">Outcomes</p>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 text-xs font-mono">Wins</span>
                      <span className="text-emerald-400 font-mono text-sm font-semibold">{activeSummary.wins}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 text-xs font-mono">Losses</span>
                      <span className="text-red-400 font-mono text-sm font-semibold">{activeSummary.losses}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 text-xs font-mono">Expired</span>
                      <span className="text-zinc-500 font-mono text-sm">{activeSummary.expired}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 text-xs font-mono">Per Day</span>
                      <span className="text-zinc-300 font-mono text-sm">{fmt(activeSummary.signalsPerDay, 1)}</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-6 space-y-3">
                    <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono">P&amp;L Stats</p>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 text-xs font-mono">Avg Win</span>
                      <span className="text-emerald-400 font-mono text-sm font-semibold">+{fmt(activeSummary.avgWinPct)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 text-xs font-mono">Avg Loss</span>
                      <span className="text-red-400 font-mono text-sm font-semibold">{fmt(activeSummary.avgLossPct)}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 text-xs font-mono">Exp. Value</span>
                      <span className={`font-mono text-sm font-semibold ${activeSummary.expectedValue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {activeSummary.expectedValue >= 0 ? '+' : ''}{fmt(activeSummary.expectedValue)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-6">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono mb-4">Direction Accuracy</p>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="text-center">
                      <p className="text-zinc-600 text-xs font-mono mb-1">Avg Best Move</p>
                      <p className="text-2xl font-bold font-mono tabular-nums text-zinc-200">{fmt(activeSummary.avgMaxFavorableMove)}%</p>
                      <p className="text-zinc-700 text-xs font-mono mt-1">avg max favorable</p>
                    </div>
                    <div className="text-center">
                      <p className="text-zinc-600 text-xs font-mono mb-1">Reached 0.75%</p>
                      <p className={`text-2xl font-bold font-mono tabular-nums ${activeSummary.pctMovedHalfTarget >= 51 ? 'text-green-400' : 'text-red-400'}`}>
                        {fmt(activeSummary.pctMovedHalfTarget)}%
                      </p>
                      <p className="text-zinc-700 text-xs font-mono mt-1">half target hit</p>
                    </div>
                    <div className="text-center">
                      <p className="text-zinc-600 text-xs font-mono mb-1">Reached 1.5%</p>
                      <p className={`text-2xl font-bold font-mono tabular-nums ${activeSummary.pctHitFullTarget >= 51 ? 'text-green-400' : 'text-red-400'}`}>
                        {fmt(activeSummary.pctHitFullTarget)}%
                      </p>
                      <p className="text-zinc-700 text-xs font-mono mt-1">full target hit</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-6">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono mb-4">V2 Metrics</p>
                  <div className="grid grid-cols-3 gap-6">
                    <div className="text-center">
                      <p className="text-zinc-600 text-xs font-mono mb-1">WATCH Alerts</p>
                      <p className="text-2xl font-bold font-mono tabular-nums text-yellow-400">{activeSummary.watchCount}</p>
                      <p className="text-zinc-700 text-xs font-mono mt-1">total watch signals</p>
                    </div>
                    <div className="text-center">
                      <p className="text-zinc-600 text-xs font-mono mb-1">Escalation Rate</p>
                      <p className={`text-2xl font-bold font-mono tabular-nums ${activeSummary.watchEscalationRate >= 40 ? 'text-green-400' : 'text-zinc-400'}`}>
                        {fmt(activeSummary.watchEscalationRate)}%
                      </p>
                      <p className="text-zinc-700 text-xs font-mono mt-1">watch → BUY/SELL in 2 candles</p>
                    </div>
                    <div className="text-center">
                      <p className="text-zinc-600 text-xs font-mono mb-1">ATR Stops Wider</p>
                      <p className="text-2xl font-bold font-mono tabular-nums text-zinc-200">
                        {fmt(activeSummary.pctStopsImproved)}%
                      </p>
                      <p className="text-zinc-700 text-xs font-mono mt-1">of stop exits improved</p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-6">
                  <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono mb-4">Win Rate by Confidence</p>
                  <div className="grid grid-cols-3 gap-4">
                    {(
                      [
                        { label: 'High (≥75)', tier: activeSummary.byConfidence.high },
                        { label: 'Medium (50–74)', tier: activeSummary.byConfidence.medium },
                        { label: 'Low (<50)', tier: activeSummary.byConfidence.low },
                      ] as const
                    ).map(({ label, tier }) => (
                      <div key={label} className="text-center">
                        <p className="text-zinc-600 text-xs font-mono mb-1">{label}</p>
                        <p className={`text-2xl font-bold font-mono tabular-nums ${tier.winRate >= 51 ? 'text-green-400' : 'text-red-400'}`}>
                          {fmt(tier.winRate)}%
                        </p>
                        <p className="text-zinc-700 text-xs font-mono mt-1">{tier.signals} signals</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 overflow-hidden">
                  <div className="px-5 py-3 border-b border-zinc-800/50">
                    <p className="text-xs font-mono text-zinc-500 uppercase tracking-wide">
                      Last {Math.min(50, activeResults.length)} Trades
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800/50">
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Time</th>
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Type</th>
                          <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Conf</th>
                          <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Entry</th>
                          <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Target</th>
                          <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Stop</th>
                          <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Exit</th>
                          <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">P&amp;L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...activeResults].reverse().slice(0, 50).map((r, idx) => (
                          <tr key={idx} className="border-b border-zinc-800/30 hover:bg-zinc-900/50 transition-colors even:bg-zinc-900/20">
                            <td className="px-4 py-2 text-zinc-600 font-mono text-xs">{fmtTime(r.entryTime)}</td>
                            <td className="px-4 py-2">
                              <span className={`font-mono text-xs font-bold ${r.signalType === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                                {r.signalType}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-right text-zinc-400 font-mono text-xs">{r.confidence}</td>
                            <td className="px-4 py-2 text-right text-zinc-400 font-mono text-xs">${fmtPrice(r.entryPrice)}</td>
                            <td className="px-4 py-2 text-right text-zinc-400 font-mono text-xs">
                              {r.targetPrice != null ? `$${fmtPrice(r.targetPrice)}` : '—'}
                            </td>
                            <td className="px-4 py-2 text-right text-zinc-400 font-mono text-xs">${fmtPrice(r.stopLoss)}</td>
                            <td className="px-4 py-2">
                              <span className={`font-mono text-xs ${r.exitReason === 'TARGET' ? 'text-emerald-400' : r.exitReason === 'STOPLOSS' ? 'text-red-400' : 'text-zinc-500'}`}>
                                {r.exitReason}
                              </span>
                            </td>
                            <td className={`px-4 py-2 text-right font-mono text-xs font-semibold ${r.profitPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {r.profitPct >= 0 ? '+' : ''}{fmt(r.profitPct)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Sweep */}
            {mode === 'sweep' && (
              <>
                {/* Timeframe toggle */}
                <div className="flex items-center gap-3">
                  <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800/50">
                    {(['15m1h', '5m15m'] as Timeframe[]).map((tf) => (
                      <button
                        key={tf}
                        onClick={() => setSweepTimeframe(tf)}
                        className={`px-3 py-1 rounded-md text-xs font-mono transition-colors ${
                          sweepTimeframe === tf ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {tf === '15m1h' ? '15m/1h' : '5m/15m'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] font-mono text-zinc-600">
                    {sweepTimeframe === '5m15m' ? `${DAYS_5M}-day · 16 combos · fixed per 5m scale` : '90-day · 25 combos'}
                  </p>
                </div>

                {sweepTimeframe === '5m15m' && sweepResults5m.length === 0 && (
                  <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-8 text-center">
                    <p className="text-zinc-600 text-xs font-mono">Click Re-run to load 5m/15m sweep</p>
                  </div>
                )}

                {sortedSweep.length > 0 && (
                  <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-zinc-800/50">
                            <th className="text-right px-3 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Target%</th>
                            <th className="text-right px-3 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Stop%</th>
                            <SortHeader label="Win%" sortKey="winRate" />
                            <SortHeader label="Avg Win" sortKey="avgWinPct" />
                            <SortHeader label="Avg Loss" sortKey="avgLossPct" />
                            <SortHeader label="EV" sortKey="expectedValue" />
                            <SortHeader label="Sig/Day" sortKey="signalsPerDay" />
                          </tr>
                        </thead>
                        <tbody>
                          {sortedSweep.map((r, idx) => {
                            const isDefault = sweepTimeframe === '15m1h'
                              ? r.targetPct === 5.0 && r.stopPct === 1.5
                              : r.targetPct === 2.0 && r.stopPct === 1.0;
                            return (
                              <tr
                                key={idx}
                                className={`border-b border-zinc-800/30 hover:bg-zinc-900/50 transition-colors even:bg-zinc-900/20 ${
                                  isDefault ? 'ring-1 ring-inset ring-emerald-500/40' : ''
                                }`}
                              >
                                <td className="px-3 py-2 text-right font-mono text-xs text-zinc-300 tabular-nums">{r.targetPct.toFixed(1)}%</td>
                                <td className="px-3 py-2 text-right font-mono text-xs text-zinc-300 tabular-nums">{r.stopPct.toFixed(1)}%</td>
                                <td className={`px-3 py-2 text-right font-mono text-xs tabular-nums ${r.summary.winRate >= 51 ? 'text-green-400' : 'text-red-400'}`}>
                                  {fmt(r.summary.winRate)}%
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-xs text-emerald-400 tabular-nums">+{fmt(r.summary.avgWinPct)}%</td>
                                <td className="px-3 py-2 text-right font-mono text-xs text-red-400 tabular-nums">{fmt(r.summary.avgLossPct)}%</td>
                                <td className={`px-3 py-2 text-right font-mono text-xs font-semibold tabular-nums ${r.summary.expectedValue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {r.summary.expectedValue >= 0 ? '+' : ''}{fmt(r.summary.expectedValue)}%
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-xs text-zinc-400 tabular-nums">{fmt(r.summary.signalsPerDay, 1)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* EMA Pullback */}
            {mode === 'ema_pullback' && (
              <>
                {/* Sub-mode toggle */}
                <div className="flex items-center gap-3">
                  <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800/50">
                    {(['single', 'sweep'] as const).map((sub) => (
                      <button
                        key={sub}
                        onClick={() => setEmaPullbackSubMode(sub)}
                        className={`px-3 py-1 rounded-md text-xs font-mono transition-colors ${
                          emaPullbackSubMode === sub ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {sub === 'single' ? 'Single' : 'Sweep'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] font-mono text-zinc-600">
                    {emaPullbackSubMode === 'sweep' ? '90-day · 12 combos · 3.0%/1.0% default' : '90-day · default params 3.0%/1.0%'}
                  </p>
                </div>

                {/* Symbol selector */}
                <div className="flex flex-wrap gap-1">
                  {EMA_PULLBACK_SYMBOLS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setEmaPullbackSymbol(s)}
                      disabled={loading}
                      className={`px-2.5 py-1 rounded-full text-xs font-mono transition-colors disabled:opacity-40 ${
                        emaPullbackSymbol === s
                          ? 'bg-zinc-700 text-zinc-100 font-semibold'
                          : 'bg-zinc-900 border border-zinc-700/50 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                      }`}
                    >
                      {s.replace('USDT', '')}
                    </button>
                  ))}
                </div>

                {/* Single results */}
                {emaPullbackSubMode === 'single' && emaPullbackSummary && (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="col-span-1 rounded-xl border border-zinc-800/60 bg-zinc-950 p-6 flex flex-col items-center justify-center">
                        <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono mb-3">Win Rate</p>
                        <p
                          className={`text-5xl font-bold font-mono tabular-nums ${emaPullbackSummary.winRate >= 51 ? 'text-green-400' : 'text-red-400'}`}
                          style={emaPullbackSummary.winRate >= 51 ? { filter: 'drop-shadow(0 0 12px rgba(74,222,128,0.3))' } : {}}
                        >
                          {fmt(emaPullbackSummary.winRate)}%
                        </p>
                        <p className="text-zinc-600 text-xs font-mono mt-2">{emaPullbackSummary.totalSignals} signals total</p>
                      </div>
                      <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-6 space-y-3">
                        <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono">Outcomes</p>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500 text-xs font-mono">Wins</span>
                          <span className="text-emerald-400 font-mono text-sm font-semibold">{emaPullbackSummary.wins}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500 text-xs font-mono">Losses</span>
                          <span className="text-red-400 font-mono text-sm font-semibold">{emaPullbackSummary.losses}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500 text-xs font-mono">Expired</span>
                          <span className="text-zinc-500 font-mono text-sm">{emaPullbackSummary.expired}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500 text-xs font-mono">Per Day</span>
                          <span className="text-zinc-300 font-mono text-sm">{fmt(emaPullbackSummary.signalsPerDay, 1)}</span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-6 space-y-3">
                        <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono">P&amp;L Stats</p>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500 text-xs font-mono">Avg Win</span>
                          <span className="text-emerald-400 font-mono text-sm font-semibold">+{fmt(emaPullbackSummary.avgWinPct)}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500 text-xs font-mono">Avg Loss</span>
                          <span className="text-red-400 font-mono text-sm font-semibold">{fmt(emaPullbackSummary.avgLossPct)}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-zinc-500 text-xs font-mono">Exp. Value</span>
                          <span className={`font-mono text-sm font-semibold ${emaPullbackSummary.expectedValue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {emaPullbackSummary.expectedValue >= 0 ? '+' : ''}{fmt(emaPullbackSummary.expectedValue)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-6">
                      <p className="text-[10px] uppercase tracking-widest text-zinc-600 font-mono mb-4">Win Rate by Confidence</p>
                      <div className="grid grid-cols-3 gap-4">
                        {(
                          [
                            { label: 'High (≥75)', tier: emaPullbackSummary.byConfidence.high },
                            { label: 'Medium (50–74)', tier: emaPullbackSummary.byConfidence.medium },
                            { label: 'Low (<50)', tier: emaPullbackSummary.byConfidence.low },
                          ] as const
                        ).map(({ label, tier }) => (
                          <div key={label} className="text-center">
                            <p className="text-zinc-600 text-xs font-mono mb-1">{label}</p>
                            <p className={`text-2xl font-bold font-mono tabular-nums ${tier.winRate >= 51 ? 'text-green-400' : 'text-red-400'}`}>
                              {fmt(tier.winRate)}%
                            </p>
                            <p className="text-zinc-700 text-xs font-mono mt-1">{tier.signals} signals</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 overflow-hidden">
                      <div className="px-5 py-3 border-b border-zinc-800/50">
                        <p className="text-xs font-mono text-zinc-500 uppercase tracking-wide">
                          Last {Math.min(50, emaPullbackResults.length)} Trades
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-zinc-800/50">
                              <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Time</th>
                              <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Type</th>
                              <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Conf</th>
                              <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Entry</th>
                              <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Target</th>
                              <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Stop</th>
                              <th className="text-left px-4 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Exit</th>
                              <th className="text-right px-4 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">P&amp;L</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...emaPullbackResults].reverse().slice(0, 50).map((r, idx) => (
                              <tr key={idx} className="border-b border-zinc-800/30 hover:bg-zinc-900/50 transition-colors even:bg-zinc-900/20">
                                <td className="px-4 py-2 text-zinc-600 font-mono text-xs">{fmtTime(r.entryTime)}</td>
                                <td className="px-4 py-2">
                                  <span className={`font-mono text-xs font-bold ${r.signalType === 'BUY' ? 'text-green-400' : 'text-red-400'}`}>
                                    {r.signalType}
                                  </span>
                                </td>
                                <td className="px-4 py-2 text-right text-zinc-400 font-mono text-xs">{r.confidence}</td>
                                <td className="px-4 py-2 text-right text-zinc-400 font-mono text-xs">${fmtPrice(r.entryPrice)}</td>
                                <td className="px-4 py-2 text-right text-zinc-400 font-mono text-xs">
                                  {r.targetPrice != null ? `$${fmtPrice(r.targetPrice)}` : '—'}
                                </td>
                                <td className="px-4 py-2 text-right text-zinc-400 font-mono text-xs">${fmtPrice(r.stopLoss)}</td>
                                <td className="px-4 py-2">
                                  <span className={`font-mono text-xs ${r.exitReason === 'TARGET' ? 'text-emerald-400' : r.exitReason === 'STOPLOSS' ? 'text-red-400' : 'text-zinc-500'}`}>
                                    {r.exitReason}
                                  </span>
                                </td>
                                <td className={`px-4 py-2 text-right font-mono text-xs font-semibold ${r.profitPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {r.profitPct >= 0 ? '+' : ''}{fmt(r.profitPct)}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}

                {/* Sweep results */}
                {emaPullbackSubMode === 'sweep' && emaPullbackSweepResults.length === 0 && (
                  <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-8 text-center">
                    <p className="text-zinc-600 text-xs font-mono">Select a symbol and click Re-run</p>
                  </div>
                )}

                {emaPullbackSubMode === 'sweep' && emaPullbackSweepResults.length > 0 && (
                  <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-zinc-800/50">
                            <th className="text-right px-3 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Target%</th>
                            <th className="text-right px-3 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Stop%</th>
                            <th className="text-right px-3 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Win%</th>
                            <th className="text-right px-3 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Avg Win</th>
                            <th className="text-right px-3 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Avg Loss</th>
                            <th className="text-right px-3 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">EV</th>
                            <th className="text-right px-3 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Sig/Day</th>
                          </tr>
                        </thead>
                        <tbody>
                          {emaPullbackSweepResults.map((r, idx) => {
                            const isDefault = r.targetPct === 3.0 && r.stopPct === 1.0;
                            return (
                              <tr
                                key={idx}
                                className={`border-b border-zinc-800/30 hover:bg-zinc-900/50 transition-colors even:bg-zinc-900/20 ${
                                  isDefault ? 'ring-1 ring-inset ring-emerald-500/40' : ''
                                }`}
                              >
                                <td className="px-3 py-2 text-right font-mono text-xs text-zinc-300 tabular-nums">{r.targetPct.toFixed(1)}%</td>
                                <td className="px-3 py-2 text-right font-mono text-xs text-zinc-300 tabular-nums">{r.stopPct.toFixed(1)}%</td>
                                <td className={`px-3 py-2 text-right font-mono text-xs tabular-nums ${r.summary.winRate >= 51 ? 'text-green-400' : 'text-red-400'}`}>
                                  {fmt(r.summary.winRate)}%
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-xs text-emerald-400 tabular-nums">+{fmt(r.summary.avgWinPct)}%</td>
                                <td className="px-3 py-2 text-right font-mono text-xs text-red-400 tabular-nums">{fmt(r.summary.avgLossPct)}%</td>
                                <td className={`px-3 py-2 text-right font-mono text-xs font-semibold tabular-nums ${r.summary.expectedValue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {r.summary.expectedValue >= 0 ? '+' : ''}{fmt(r.summary.expectedValue)}%
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-xs text-zinc-400 tabular-nums">{fmt(r.summary.signalsPerDay, 1)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {emaPullbackSubMode === 'single' && !emaPullbackSummary && (
                  <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-8 text-center">
                    <p className="text-zinc-600 text-xs font-mono">Select a symbol and click Re-run</p>
                  </div>
                )}
              </>
            )}

            {/* Trigger Sweep */}
            {mode === 'trigger' && (
              <>
                {/* Timeframe toggle */}
                <div className="flex items-center gap-3">
                  <div className="flex gap-1 bg-zinc-900 rounded-lg p-1 border border-zinc-800/50">
                    {(['15m1h', '5m15m'] as Timeframe[]).map((tf) => (
                      <button
                        key={tf}
                        onClick={() => setTriggerTimeframe(tf)}
                        className={`px-3 py-1 rounded-md text-xs font-mono transition-colors ${
                          triggerTimeframe === tf ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                      >
                        {tf === '15m1h' ? '15m/1h' : '5m/15m'}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] font-mono text-zinc-600">
                    {triggerTimeframe === '5m15m' ? `fixed 2.5/1.0 target/stop · ${DAYS_5M}-day` : 'fixed 5.0/1.5 target/stop · 90-day'}
                  </p>
                </div>

                {/* Variable selector */}
                <div className="flex flex-wrap gap-1">
                  {(Object.keys(TRIGGER_VAR_LABELS) as TriggerVar[]).map((v) => (
                    <button
                      key={v}
                      onClick={() => setTriggerSweepVar(v)}
                      disabled={loading}
                      className={`px-3 py-1 rounded-full text-xs font-mono transition-colors disabled:opacity-40 ${
                        triggerSweepVar === v
                          ? 'bg-zinc-700 text-zinc-100 font-semibold'
                          : 'bg-zinc-900 border border-zinc-700/50 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                      }`}
                    >
                      {TRIGGER_VAR_LABELS[v]}
                    </button>
                  ))}
                </div>

                {/* Trigger symbol selector */}
                <div className="flex flex-wrap gap-1">
                  {TRIGGER_SYMBOLS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setTriggerSymbol(s)}
                      disabled={loading}
                      className={`px-2.5 py-1 rounded-full text-xs font-mono transition-colors disabled:opacity-40 ${
                        triggerSymbol === s
                          ? 'bg-zinc-700 text-zinc-100 font-semibold'
                          : 'bg-zinc-900 border border-zinc-700/50 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                      }`}
                    >
                      {s.replace('USDT', '')}
                    </button>
                  ))}
                </div>

                {activeTriggerResults.length === 0 && (
                  <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-8 text-center">
                    <p className="text-zinc-600 text-xs font-mono">
                      {triggerTimeframe === '5m15m'
                        ? 'Select a variable and symbol, then click Re-run (5m/15m)'
                        : 'Select a variable and symbol, then click Re-run'}
                    </p>
                  </div>
                )}

                {activeTriggerResults.length > 0 && (
                  <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-zinc-800/50">
                            <th className="text-right px-3 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">
                              {TRIGGER_VAR_LABELS[triggerSweepVar]}
                            </th>
                            <th className="text-right px-3 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Win%</th>
                            <th className="text-right px-3 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Avg Win</th>
                            <th className="text-right px-3 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Avg Loss</th>
                            <th className="text-right px-3 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">EV</th>
                            <th className="text-right px-3 py-3 text-[10px] uppercase tracking-wide text-zinc-600 font-mono">Sig/Day</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeTriggerResults.map((r, idx) => {
                            const isBaseline = r.paramValue === TRIGGER_BASELINE[triggerSweepVar];
                            return (
                              <tr
                                key={idx}
                                className={`border-b border-zinc-800/30 hover:bg-zinc-900/50 transition-colors even:bg-zinc-900/20 ${
                                  isBaseline ? 'ring-1 ring-inset ring-emerald-500/40' : ''
                                }`}
                              >
                                <td className="px-3 py-2 text-right font-mono text-xs text-zinc-300 tabular-nums">{r.paramValue}</td>
                                <td className={`px-3 py-2 text-right font-mono text-xs tabular-nums ${r.summary.winRate >= 51 ? 'text-green-400' : 'text-red-400'}`}>
                                  {fmt(r.summary.winRate)}%
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-xs text-emerald-400 tabular-nums">+{fmt(r.summary.avgWinPct)}%</td>
                                <td className="px-3 py-2 text-right font-mono text-xs text-red-400 tabular-nums">{fmt(r.summary.avgLossPct)}%</td>
                                <td className={`px-3 py-2 text-right font-mono text-xs font-semibold tabular-nums ${r.summary.expectedValue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                  {r.summary.expectedValue >= 0 ? '+' : ''}{fmt(r.summary.expectedValue)}%
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-xs text-zinc-400 tabular-nums">{fmt(r.summary.signalsPerDay, 1)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

const PARAM_PAIRS_5M_COUNT = 16;
