'use client';

import { useMemo, useRef, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BinanceAdapter } from '@/lib/exchanges/binance';
import { CoinbaseAdapter } from '@/lib/exchanges/coinbase';
import { UpbitAdapter } from '@/lib/exchanges/upbit';
import { BybitAdapter } from '@/lib/exchanges/bybit';
import { useLivePrice } from '@/hooks/useLivePrice';
import { useCandles } from '@/hooks/useCandles';
import { useSignal } from '@/hooks/useSignal';
import { useProfile } from '@/hooks/useProfile';
import { calculateRSI } from '@/lib/indicators/rsi';
import { calculateMACD } from '@/lib/indicators/macd';
import {
  toExchangeSymbol,
  isSupported,
  getCurrencySymbol,
  getExchangeLabel,
} from '@/lib/exchanges/normalize';
import type { Exchange, KlineInterval } from '@/lib/exchanges/types';
import CandleChart from './CandleChart';

const STATUS_COLORS: Record<string, string> = {
  connected: 'bg-green-500',
  connecting: 'bg-yellow-500',
  disconnected: 'bg-gray-500',
  error: 'bg-red-500',
};

const INTERVALS: KlineInterval[] = ['5m', '15m', '1h'];

const COINS = [
  { symbol: 'BTCUSDT', label: 'BTC' },
  { symbol: 'ETHUSDT', label: 'ETH' },
  { symbol: 'SOLUSDT', label: 'SOL' },
  { symbol: 'XRPUSDT', label: 'XRP' },
  { symbol: 'BNBUSDT', label: 'BNB' },
  { symbol: 'DOGEUSDT', label: 'DOGE' },
  { symbol: 'ADAUSDT', label: 'ADA' },
  { symbol: 'AVAXUSDT', label: 'AVAX' },
  { symbol: 'XLMUSDT', label: 'XLM' },
  { symbol: 'TRXUSDT', label: 'TRX' },
  { symbol: 'LINKUSDT', label: 'LINK' },
  { symbol: 'SUIUSDT', label: 'SUI' },
  { symbol: 'HBARUSDT', label: 'HBAR' },
  { symbol: 'DOTUSDT', label: 'DOT' },
  { symbol: 'BCHUSDT', label: 'BCH' },
] as const;
type CoinSymbol = (typeof COINS)[number]['symbol'];

function createAdapter(exchange: Exchange) {
  if (exchange === 'coinbase') return new CoinbaseAdapter();
  if (exchange === 'upbit') return new UpbitAdapter();
  if (exchange === 'bybit') return new BybitAdapter();
  return new BinanceAdapter();
}

function fmt(n: number, decimals = 4): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function rsiColor(rsi: number): string {
  if (rsi < 30) return 'text-emerald-400';
  if (rsi > 70) return 'text-red-400';
  return 'text-zinc-300';
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function PriceSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-baseline gap-3 mb-3">
        <div className="h-8 w-40 bg-zinc-800/50 rounded-lg" />
        <div className="h-5 w-14 bg-zinc-800/30 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-9 bg-zinc-800/30 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default function LivePrice() {
  const { profile, refreshProfile } = useProfile();
  const tradingType = profile?.trading_type ?? 'futures';
  const tier = profile?.tier ?? 'free';
  const exchange: Exchange = profile?.exchange ?? 'binance';

  const priceAdapter = useMemo(() => createAdapter(exchange), [exchange]);
  const klineAdapter5m = useMemo(() => createAdapter(exchange), [exchange]);
  const klineAdapter15m = useMemo(() => createAdapter(exchange), [exchange]);
  const klineAdapter1h = useMemo(() => createAdapter(exchange), [exchange]);

  const searchParams = useSearchParams();
  const [selectedInterval, setSelectedInterval] = useState<KlineInterval>('15m');
  const [selectedCoin, setSelectedCoin] = useState<CoinSymbol>('BTCUSDT');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showUpgradedBanner, setShowUpgradedBanner] = useState(searchParams.get('upgraded') === 'true');
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('cs_onboarded')) {
      setShowOnboarding(true);
    }
  }, []);

  useEffect(() => {
    if (searchParams.get('upgraded') !== 'true') return;
    setSyncing(true);
    fetch('/api/stripe/sync', { method: 'POST' })
      .then((r) => r.json())
      .then(() => refreshProfile())
      .finally(() => setSyncing(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isSupported(selectedCoin, exchange)) {
      setSelectedCoin('BTCUSDT');
    }
  }, [exchange, selectedCoin]);

  function dismissOnboarding() {
    localStorage.setItem('cs_onboarded', '1');
    setShowOnboarding(false);
  }

  const exchangeSymbol = useMemo(
    () => toExchangeSymbol(selectedCoin, exchange),
    [selectedCoin, exchange]
  );
  const currencySymbol = getCurrencySymbol(exchange);

  const { price, status, error } = useLivePrice(priceAdapter, exchangeSymbol);
  const { candles: candles5m, loading: loading5m } = useCandles(klineAdapter5m, exchangeSymbol, '5m');
  const { candles: candles15m, loading: loading15m } = useCandles(klineAdapter15m, exchangeSymbol, '15m');
  const { candles: candles1h, loading: loading1h } = useCandles(klineAdapter1h, exchangeSymbol, '1h');

  const displayCandles =
    selectedInterval === '5m' ? candles5m : selectedInterval === '15m' ? candles15m : candles1h;
  const displayLoading =
    selectedInterval === '5m' ? loading5m : selectedInterval === '15m' ? loading15m : loading1h;

  // For REST-based exchanges (Coinbase, Upbit), overlay live ticker price onto the
  // last (open) candle so the chart moves with price instead of freezing between polls.
  const displayCandlesLive = useMemo(() => {
    if (exchange === 'binance' || !price || displayCandles.length === 0) return displayCandles;
    const last = displayCandles[displayCandles.length - 1];
    const updatedLast = {
      ...last,
      close: price.price,
      high: Math.max(last.high, price.price),
      low: Math.min(last.low, price.price),
    };
    return [...displayCandles.slice(0, -1), updatedLast];
  }, [displayCandles, price, exchange]);

  const closes = useMemo(() => displayCandles.map((c) => c.close), [displayCandles]);
  const rsi = useMemo(() => calculateRSI(closes), [closes]);
  const macd = useMemo(() => calculateMACD(closes), [closes]);

  const { signal, history, watchAlert } = useSignal(candles5m, candles15m, candles1h, selectedCoin, tradingType);

  const isPositive = price ? price.change24h >= 0 : null;

  const signalTextColor =
    signal.type === 'BUY'
      ? signal.confidence >= 75
        ? 'text-emerald-300'
        : 'text-emerald-500'
      : signal.type === 'SELL'
        ? signal.confidence >= 75
          ? 'text-red-300'
          : 'text-red-500'
        : 'text-zinc-600';

  const last5History = useMemo(() => history.slice(-5).reverse(), [history]);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 shadow-[0_0_40px_rgba(0,0,0,0.5)] w-full overflow-hidden">
      {/* === COMBINED NAVBAR + COIN SELECTOR === */}
      <div className="border-b border-zinc-800/80">
        {/* Top row: brand + right controls (always visible) */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <span
            className="font-mono text-[11px] uppercase tracking-[0.3em] text-emerald-600/70 shrink-0"
            style={{ filter: 'drop-shadow(0 0 6px rgba(16,185,129,0.4))' }}
          >
            CS
          </span>

          {/* Coin chips — hidden on mobile, shown inline on md+ */}
          <div className="hidden md:flex items-center gap-1 flex-1 mx-4 overflow-x-auto scrollbar-none">
            {COINS.filter((c) => isSupported(c.symbol, exchange)).map((c) => {
              const isLocked = tier === 'free' && c.symbol !== 'BTCUSDT';
              return (
                <button
                  key={c.symbol}
                  onClick={() => !isLocked && setSelectedCoin(c.symbol)}
                  disabled={isLocked}
                  title={isLocked ? 'Pro plan required' : undefined}
                  className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-mono transition-colors ${
                    isLocked
                      ? 'text-zinc-700 cursor-not-allowed'
                      : selectedCoin === c.symbol
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold'
                        : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {c.label}
                  {isLocked && <span className="ml-1 text-[9px] text-zinc-700">PRO</span>}
                </button>
              );
            })}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 shrink-0">
            {profile?.trading_type && (
              <span className="hidden sm:block px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 border border-zinc-700/50 text-zinc-600 uppercase">
                {profile.trading_type}
              </span>
            )}
            {profile?.exchange && (
              <span className="hidden sm:block px-2 py-0.5 rounded-full text-[10px] font-mono bg-zinc-800 border border-zinc-700/50 text-zinc-600 uppercase">
                {getExchangeLabel(exchange)}
              </span>
            )}
            {process.env.NODE_ENV === 'development' && (
              <Link href="/backtest" className="text-zinc-600 hover:text-zinc-300 transition-colors text-[11px] font-mono hidden sm:block">
                Backtest
              </Link>
            )}
            <Link href="/settings" className="text-zinc-600 hover:text-zinc-300 transition-colors" aria-label="Settings">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </Link>
          </div>
        </div>

        {/* Mobile-only coin chip row */}
        <div className="flex md:hidden items-center gap-1 px-4 pb-2 overflow-x-auto scrollbar-none">
          {COINS.filter((c) => isSupported(c.symbol, exchange)).map((c) => {
            const isLocked = tier === 'free' && c.symbol !== 'BTCUSDT';
            return (
              <button
                key={c.symbol}
                onClick={() => !isLocked && setSelectedCoin(c.symbol)}
                disabled={isLocked}
                title={isLocked ? 'Pro plan required' : undefined}
                className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-mono transition-colors ${
                  isLocked
                    ? 'text-zinc-700 cursor-not-allowed'
                    : selectedCoin === c.symbol
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold'
                      : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {c.label}
                {isLocked && <span className="ml-1 text-[9px] text-zinc-700">PRO</span>}
              </button>
            );
          })}
        </div>
      </div>
      {/* === END NAVBAR === */}

      {/* All remaining content — padded */}
      <div className="px-4 sm:px-6 py-4 space-y-3">
        {/* Onboarding banner */}
        {showOnboarding && (
          <div className="rounded-xl border border-zinc-700/50 bg-zinc-950 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                <p className="text-zinc-100 text-xs font-mono font-semibold">Welcome to Crypto Signal</p>
              </div>
              <button
                onClick={dismissOnboarding}
                className="text-zinc-600 hover:text-zinc-400 text-xs font-mono transition-colors"
              >
                Got it
              </button>
            </div>
            <ul className="space-y-1">
              <li className="text-[11px] text-zinc-600 font-mono">· Monitors 15 coins 24/7 · BUY/SELL signals via breakout + momentum</li>
              <li className="text-[11px] text-zinc-600 font-mono">· ~0.6–0.7 signals/coin/day · You execute trades on your own exchange</li>
              <li className="text-[11px] text-zinc-600 font-mono">· Enable push notifications in Settings (Pro)</li>
            </ul>
          </div>
        )}

        {/* Upgraded banner */}
        {(showUpgradedBanner || syncing) && (
          <div className="rounded-xl border border-emerald-800/40 bg-emerald-950/15 px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              <p className="text-emerald-400 text-[11px] font-mono">
                {syncing ? 'Activating Pro...' : "Pro active — all coins unlocked"}
              </p>
            </div>
            {!syncing && (
              <button onClick={() => setShowUpgradedBanner(false)} className="text-emerald-700 hover:text-emerald-500 text-xs font-mono ml-3 transition-colors">✕</button>
            )}
          </div>
        )}

        {/* Signal Banner — hero4-inspired gradient border */}
        {(() => {
          const isBuy = signal.type === 'BUY';
          const isSell = signal.type === 'SELL';
          const isActive = signal.type !== 'NEUTRAL';
          const isHighConf = signal.confidence >= 75;
          const showWatch = signal.type === 'NEUTRAL' && watchAlert !== null;

          const wrapperGradient = isActive
            ? isBuy
              ? isHighConf
                ? 'bg-gradient-to-br from-emerald-400/70 via-emerald-500/20 to-emerald-500/60'
                : 'bg-gradient-to-br from-emerald-500/45 via-emerald-500/12 to-emerald-500/35'
              : isHighConf
                ? 'bg-gradient-to-br from-red-400/70 via-red-500/20 to-red-500/60'
                : 'bg-gradient-to-br from-red-500/45 via-red-500/12 to-red-500/35'
            : showWatch
              ? 'bg-gradient-to-br from-yellow-500/40 via-yellow-500/10 to-yellow-500/30'
              : 'bg-zinc-800/30';

          const innerBg = isActive
            ? isBuy ? 'bg-[#020c06]' : 'bg-[#0c0202]'
            : showWatch ? 'bg-[#0c0900]' : 'bg-zinc-950';

          const glowStyle = isActive
            ? { animation: isBuy ? 'signalGlowBreathe 3s ease-in-out infinite' : 'signalGlowBreatheSell 3s ease-in-out infinite' }
            : {};

          return (
            <div className={`rounded-xl p-px ${wrapperGradient}`} style={glowStyle}>
              <div className={`rounded-xl px-4 py-3 ${innerBg}`}>
                {signal.type === 'NEUTRAL' && !showWatch ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">Scanning</span>
                    <span className="flex gap-0.5 items-center">
                      <span className="w-1 h-1 rounded-full bg-zinc-700 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1 h-1 rounded-full bg-zinc-700 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1 h-1 rounded-full bg-zinc-700 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  </div>
                ) : showWatch && watchAlert ? (
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-70" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-yellow-500" />
                        </span>
                        <span className="text-xl font-bold font-mono text-yellow-300">
                          {watchAlert.watch === 'WATCH_BUY' ? 'WATCH BUY' : 'WATCH SELL'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {watchAlert.reasons.map((r, i) => (
                          <span key={i} className="text-[11px] text-zinc-600 font-mono">· {r}</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-baseline gap-1 justify-end mb-1">
                        <span className="text-2xl font-bold font-mono tabular-nums text-yellow-300">{watchAlert.confidence}%</span>
                        <span className="text-[10px] font-mono text-zinc-600">{watchAlert.conditionsFired}/5</span>
                      </div>
                      <div className="w-16 h-0.5 bg-zinc-800 rounded-full ml-auto mb-2">
                        <div className="h-full rounded-full bg-yellow-500" style={{ width: `${watchAlert.confidence}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-zinc-600">expires in 30m</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: type + reasons */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="relative flex h-1.5 w-1.5 shrink-0">
                          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-70 ${isBuy ? 'bg-emerald-400' : 'bg-red-400'}`} />
                          <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${isBuy ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        </span>
                        <span className={`text-xl font-bold font-mono ${signalTextColor}`}>{signal.type}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {signal.reasons.map((r, i) => (
                          <span key={i} className="text-[11px] text-zinc-600 font-mono">· {r}</span>
                        ))}
                      </div>
                    </div>
                    {/* Right: confidence + levels */}
                    <div className="text-right shrink-0">
                      <div className="flex items-baseline gap-1 justify-end mb-1">
                        <span className={`text-2xl font-bold font-mono tabular-nums ${signalTextColor}`}>{signal.confidence}%</span>
                        <span className="text-[10px] font-mono text-zinc-600">{signal.conditionsFired}/5</span>
                      </div>
                      {/* Confidence bar */}
                      <div className="w-16 h-0.5 bg-zinc-800 rounded-full ml-auto mb-2">
                        <div
                          className={`h-full rounded-full ${isBuy ? 'bg-emerald-500' : 'bg-red-500'}`}
                          style={{ width: `${signal.confidence}%` }}
                        />
                      </div>
                      <div className="flex flex-col gap-0.5 items-end text-[11px] font-mono">
                        <div className="flex gap-2">
                          {signal.target !== null && (
                            <span className="text-zinc-500">T: <span className={signalTextColor}>{currencySymbol}{fmt(signal.target)}</span></span>
                          )}
                          {signal.stopLoss !== null && (
                            <span className="text-zinc-500">S: <span className="text-red-400">{currencySymbol}{fmt(signal.stopLoss)}</span></span>
                          )}
                        </div>
                        {signal.trailingStop !== null && (
                          <span className="text-zinc-500">Trail: <span className="text-red-400">{currencySymbol}{fmt(signal.trailingStop)}</span> <span className="text-zinc-700">ATR×2</span></span>
                        )}
                        {signal.limitEntry !== null && (
                          <span className="text-zinc-500">LMT: <span className="text-yellow-400">{currencySymbol}{fmt(signal.limitEntry)}</span> <span className="text-zinc-700" title="±0.3×ATR(14) from close">±0.3×ATR</span></span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Price + Stats */}
        <div>
          {price ? (
            <>
              {/* Row 1: Price + change + status */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-mono font-bold tabular-nums text-zinc-100">
                    {currencySymbol}{fmt(price.price, 4)}
                  </span>
                  <span className={`text-xs font-mono font-semibold px-2 py-0.5 rounded-full tabular-nums ${
                    isPositive
                      ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                      : 'bg-red-950/40 text-red-400 border border-red-800/40'
                  }`}>
                    {isPositive ? '+' : ''}{fmt(price.change24h, 2)}%
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    title={status}
                    className={`inline-block w-1.5 h-1.5 rounded-full ${STATUS_COLORS[status] ?? 'bg-zinc-600'} ${status === 'connecting' ? 'animate-pulse' : ''}`}
                  />
                  <span className="text-[10px] font-mono text-zinc-600">{exchangeSymbol} · {getExchangeLabel(exchange)}</span>
                </div>
              </div>
              {/* Row 2: 24h stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-zinc-950 rounded-lg px-3 py-2 border border-zinc-800/50">
                  <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-mono mb-0.5">24h High</p>
                  <p className="font-mono text-zinc-300 text-xs tabular-nums">{currencySymbol}{fmt(price.high24h)}</p>
                </div>
                <div className="bg-zinc-950 rounded-lg px-3 py-2 border border-zinc-800/50">
                  <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-mono mb-0.5">24h Low</p>
                  <p className="font-mono text-zinc-300 text-xs tabular-nums">{currencySymbol}{fmt(price.low24h)}</p>
                </div>
                <div className="bg-zinc-950 rounded-lg px-3 py-2 border border-zinc-800/50">
                  <p className="text-[9px] uppercase tracking-widest text-zinc-600 font-mono mb-0.5">Volume</p>
                  <p className="font-mono text-zinc-300 text-xs tabular-nums">{fmt(price.volume24h, 0)}</p>
                </div>
              </div>
            </>
          ) : (
            error ? (
              <div className="rounded-xl bg-red-950/10 border border-red-900/30 px-3 py-2">
                <p className="text-red-500 text-xs font-mono">Connection error — retrying...</p>
              </div>
            ) : (
              <PriceSkeleton />
            )
          )}
        </div>

        {/* Timeframe selector + Chart legend inline */}
        <div className="flex items-center gap-1">
          <div className="flex gap-0.5 bg-zinc-950 rounded-lg p-1 border border-zinc-800/50">
            {INTERVALS.map((tf) => (
              <button
                key={tf}
                onClick={() => setSelectedInterval(tf)}
                className={`px-3 py-1 rounded-md text-[11px] font-mono transition-colors ${
                  selectedInterval === tf
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-600 hover:text-zinc-300'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
          {/* Chart legend — inline with timeframe selector */}
          <div className="flex items-center gap-3 ml-3">
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-yellow-400 rounded-full" />
              <span className="text-[9px] font-mono text-zinc-700">EMA20</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-0.5 bg-blue-500 rounded-full" />
              <span className="text-[9px] font-mono text-zinc-700">EMA50</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-px border-t border-dashed border-zinc-700" />
              <span className="text-[9px] font-mono text-zinc-700">BB</span>
            </div>
          </div>
        </div>

        {/* Chart */}
        <div className="rounded-xl overflow-hidden border border-zinc-800/50">
          <CandleChart
            candles={displayCandlesLive}
            currentSignal={signal}
            signalHistory={last5History}
          />
        </div>

        {/* Indicators — horizontal row */}
        <div className="bg-zinc-950 rounded-xl border border-zinc-800/50 px-4 py-3">
          {displayLoading ? (
            <div className="animate-pulse flex items-center justify-between gap-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center justify-between flex-1">
                  <div className="h-2 w-10 bg-zinc-800/50 rounded" />
                  <div className="h-2 w-8 bg-zinc-800/40 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-6">
              {/* RSI */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-mono">RSI</span>
                {rsi !== null && (
                  <div className="w-12 h-0.5 bg-zinc-800 rounded-full">
                    <div
                      className={`h-full rounded-full ${rsi < 30 ? 'bg-emerald-500' : rsi > 70 ? 'bg-red-500' : 'bg-zinc-600'}`}
                      style={{ width: `${Math.min(100, rsi)}%` }}
                    />
                  </div>
                )}
                <span className={`font-mono text-xs tabular-nums ${rsi !== null ? rsiColor(rsi) : 'text-zinc-700'}`}>
                  {rsi !== null ? fmt(rsi, 2) : '—'}
                </span>
              </div>
              {/* MACD */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-mono">MACD</span>
                <span className={`font-mono text-xs tabular-nums ${macd !== null ? (macd.macd >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-zinc-700'}`}>
                  {macd !== null ? fmt(macd.macd, 4) : '—'}
                </span>
              </div>
              {/* Signal line */}
              <div className="flex items-center gap-2">
                <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-mono">Sig</span>
                <span className={`font-mono text-xs tabular-nums ${macd !== null ? (macd.signal >= 0 ? 'text-emerald-400' : 'text-red-400') : 'text-zinc-700'}`}>
                  {macd !== null ? fmt(macd.signal, 4) : '—'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Signal History */}
        {last5History.length > 0 && (
          <div className="bg-zinc-950 rounded-xl border border-zinc-800/50 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] uppercase tracking-widest text-zinc-600 font-mono">Recent Signals</span>
              <span className="text-[9px] font-mono text-zinc-700">{last5History.length}</span>
            </div>
            <div className="space-y-1.5">
              {last5History.map((s, i) => (
                <div key={i} className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-zinc-700 tabular-nums">{fmtTime(s.timestamp)}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    s.type === 'BUY'
                      ? 'bg-emerald-950/40 text-emerald-400'
                      : s.type === 'SELL'
                        ? 'bg-red-950/40 text-red-400'
                        : 'text-zinc-600'
                  }`}>
                    {s.type}
                  </span>
                  <span className="text-zinc-600 tabular-nums">{s.confidence}%</span>
                  <span className="text-zinc-500 tabular-nums">{currencySymbol}{fmt(s.price)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
