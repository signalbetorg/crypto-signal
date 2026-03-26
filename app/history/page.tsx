'use client';

import { useState } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { useSignalHistory } from '@/hooks/useSignalHistory';

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
];

function OutcomeBadge({
  outcome,
  outcomePrice,
  entryPrice,
  signalType,
}: {
  outcome: 'WIN' | 'LOSS' | 'EXPIRED' | null;
  outcomePrice?: number | null;
  entryPrice?: number;
  signalType?: 'BUY' | 'SELL';
}) {
  const price = outcomePrice != null ? (
    <div className="text-[10px] text-zinc-500 tabular-nums mt-0.5">{formatPrice(outcomePrice)}</div>
  ) : null;

  if (outcome === 'WIN') return (
    <div>
      <span className="text-xs font-semibold tracking-wide px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">WIN</span>
      {price}
    </div>
  );
  if (outcome === 'LOSS') return (
    <div>
      <span className="text-xs font-semibold tracking-wide px-2 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30">LOSS</span>
      {price}
    </div>
  );
  if (outcome === 'EXPIRED') {
    let expiredPriceColor = 'text-zinc-500';
    if (outcomePrice != null && entryPrice != null && signalType != null) {
      const move = (outcomePrice - entryPrice) / entryPrice;
      const inProfit = signalType === 'BUY' ? move >= 0.0001 : move <= -0.0001;
      const inLoss   = signalType === 'BUY' ? move <= -0.0001 : move >= 0.0001;
      if (inProfit) expiredPriceColor = 'text-emerald-500/70';
      else if (inLoss) expiredPriceColor = 'text-red-500/70';
    }
    return (
      <div>
        <span className="text-xs font-semibold tracking-wide px-2 py-0.5 rounded bg-zinc-700/50 text-zinc-400 border border-zinc-600/30">EXPIRED</span>
        {outcomePrice != null && (
          <div className={`text-[10px] tabular-nums mt-0.5 ${expiredPriceColor}`}>{formatPrice(outcomePrice)}</div>
        )}
      </div>
    );
  }
  return (
    <span className="text-xs font-semibold tracking-wide px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">PENDING</span>
  );
}

function rowBorder(outcome: 'WIN' | 'LOSS' | 'EXPIRED' | null) {
  if (outcome === 'WIN') return 'border-l-2 border-emerald-500/40';
  if (outcome === 'LOSS') return 'border-l-2 border-red-500/40';
  if (outcome === null) return 'border-l-2 border-amber-500/40';
  return 'border-l-2 border-zinc-700/40';
}

function formatPrice(n: number) {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function coinLabel(symbol: string) {
  return symbol.replace(/USDT$/, '');
}

export default function HistoryPage() {
  const { profile, loading: profileLoading } = useProfile();
  const [coinFilter, setCoinFilter] = useState<string | null>(null);

  const tier = profile?.tier;
  const exchange = profile?.exchange ?? 'binance';

  const { rows, stats, loading, error, hasMore, loadMore } = useSignalHistory(tier, coinFilter);

  const isPro = tier === 'pro';

  function handleExport() {
    window.location.href = '/api/history/export';
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold text-zinc-100">Signal History</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700/50 uppercase tracking-wide">
              {exchange}
            </span>
          </div>
          {isPro && (
            <button
              onClick={handleExport}
              className="text-xs px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 text-zinc-300 transition-colors"
            >
              Export CSV
            </button>
          )}
        </div>

        {/* Stats panel */}
        {profileLoading ? (
          <div className="h-20 rounded-2xl bg-zinc-900/50 border border-zinc-800 animate-pulse" />
        ) : isPro ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-zinc-500 mb-1">Total Signals</p>
                <p className="text-xl font-semibold text-zinc-100">{stats.total}</p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Win Rate</p>
                <p className="text-xl font-semibold text-emerald-400">
                  {stats.winRate !== null ? `${stats.winRate.toFixed(1)}%` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Avg Conf (Wins)</p>
                <p className="text-xl font-semibold text-zinc-100">
                  {stats.avgConfidenceWins !== null ? `${stats.avgConfidenceWins.toFixed(0)}%` : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">Avg Conf (Losses)</p>
                <p className="text-xl font-semibold text-zinc-100">
                  {stats.avgConfidenceLosses !== null ? `${stats.avgConfidenceLosses.toFixed(0)}%` : '—'}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4 relative overflow-hidden">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 blur-sm pointer-events-none select-none">
              <div><p className="text-xs text-zinc-500 mb-1">Total Signals</p><p className="text-xl font-semibold">—</p></div>
              <div><p className="text-xs text-zinc-500 mb-1">Win Rate</p><p className="text-xl font-semibold">—</p></div>
              <div><p className="text-xs text-zinc-500 mb-1">Avg Conf (Wins)</p><p className="text-xl font-semibold">—</p></div>
              <div><p className="text-xs text-zinc-500 mb-1">Avg Conf (Losses)</p><p className="text-xl font-semibold">—</p></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <a
                href="/settings"
                className="text-sm px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition-colors"
              >
                Upgrade to Pro
              </a>
            </div>
          </div>
        )}

        {/* Coin filter chips (pro only) */}
        {isPro && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setCoinFilter(null)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                coinFilter === null
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-700/50 hover:border-zinc-600'
              }`}
            >
              All
            </button>
            {COINS.map((c) => (
              <button
                key={c.symbol}
                onClick={() => setCoinFilter(c.symbol)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  coinFilter === c.symbol
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-700/50 hover:border-zinc-600'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}

        {/* Table */}
        <div className="rounded-2xl border border-zinc-800 overflow-hidden">
          {/* Desktop header */}
          <div className="hidden sm:grid grid-cols-[1fr_80px_60px_52px_90px_90px_90px_90px] gap-2 px-4 py-2 bg-zinc-900/80 border-b border-zinc-800 text-xs text-zinc-500 font-medium">
            <span>Time</span>
            <span>Coin</span>
            <span>Type</span>
            <span>Conf</span>
            <span>Entry</span>
            <span>Target</span>
            <span>Stop</span>
            <span>Outcome</span>
          </div>
          {/* Mobile header */}
          <div className="sm:hidden grid grid-cols-[1fr_60px_60px_52px_90px] gap-2 px-4 py-2 bg-zinc-900/80 border-b border-zinc-800 text-xs text-zinc-500 font-medium">
            <span>Time</span>
            <span>Coin</span>
            <span>Type</span>
            <span>Conf</span>
            <span>Outcome</span>
          </div>

          {loading && rows.length === 0 ? (
            // Skeleton rows
            <div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="px-4 py-3 border-b border-zinc-800/50 last:border-b-0">
                  <div className="h-4 bg-zinc-800 rounded animate-pulse w-3/4" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-500">{error}</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-zinc-500">
              No signals yet. Signals appear here as they fire.
            </div>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                className={`${rowBorder(row.outcome)} px-4 py-3 border-b border-zinc-800/50 last:border-b-0 bg-zinc-900/20 hover:bg-zinc-900/40 transition-colors`}
              >
                {/* Desktop row */}
                <div className="hidden sm:grid grid-cols-[1fr_80px_60px_52px_90px_90px_90px_90px] gap-2 items-center text-sm">
                  <span className="text-zinc-400 text-xs">{formatDate(row.fired_at)}</span>
                  <span className="font-medium text-zinc-200">{coinLabel(row.symbol)}</span>
                  <div>
                    <span className={`font-semibold text-xs ${row.signal_type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {row.signal_type}
                    </span>
                    <div className="text-[10px] mt-0.5">
                      {row.strategy === 'ema_pullback'
                        ? <span className="text-violet-400/70">EMA PB</span>
                        : <span className="text-zinc-500">BRK</span>
                      }
                    </div>
                  </div>
                  <span className="text-zinc-300">{row.confidence}%</span>
                  <span className="text-zinc-300 tabular-nums">{formatPrice(row.entry_price)}</span>
                  <span className="text-emerald-400/70 tabular-nums">{formatPrice(row.target_price)}</span>
                  <span className="text-red-400/70 tabular-nums">{formatPrice(row.stop_price)}</span>
                  <OutcomeBadge outcome={row.outcome} outcomePrice={row.outcome_price} entryPrice={row.entry_price} signalType={row.signal_type} />
                </div>
                {/* Mobile row */}
                <div className="sm:hidden grid grid-cols-[1fr_60px_60px_52px_90px] gap-2 items-center text-sm">
                  <span className="text-zinc-400 text-xs">{formatDate(row.fired_at)}</span>
                  <span className="font-medium text-zinc-200">{coinLabel(row.symbol)}</span>
                  <div>
                    <span className={`font-semibold text-xs ${row.signal_type === 'BUY' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {row.signal_type}
                    </span>
                    <div className="text-[10px] mt-0.5">
                      {row.strategy === 'ema_pullback'
                        ? <span className="text-violet-400/70">EMA PB</span>
                        : <span className="text-zinc-500">BRK</span>
                      }
                    </div>
                  </div>
                  <span className="text-zinc-300">{row.confidence}%</span>
                  <OutcomeBadge outcome={row.outcome} outcomePrice={row.outcome_price} entryPrice={row.entry_price} signalType={row.signal_type} />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Free tier lock banner */}
        {!isPro && !loading && rows.length > 0 && (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-4 text-center">
            <p className="text-sm text-zinc-400 mb-3">Showing last 10 BTC signals. Upgrade for full history across all coins.</p>
            <a
              href="/settings"
              className="inline-block text-sm px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition-colors"
            >
              Upgrade to Pro
            </a>
          </div>
        )}

        {/* Load more */}
        {isPro && hasMore && (
          <div className="flex justify-center">
            <button
              onClick={loadMore}
              disabled={loading}
              className="text-sm px-6 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 text-zinc-300 transition-colors disabled:opacity-50"
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
