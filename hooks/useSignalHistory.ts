import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Tier } from './useProfile';

export interface SignalHistoryRow {
  id: string;
  symbol: string;
  exchange: string;
  signal_type: 'BUY' | 'SELL';
  confidence: number;
  entry_price: number;
  target_price: number;
  stop_price: number;
  fired_at: string;
  expires_at: string;
  outcome: 'WIN' | 'LOSS' | 'EXPIRED' | null;
  outcome_price: number | null;
  resolved_at: string | null;
  strategy: string;
}

export interface SignalHistoryStats {
  total: number;
  winRate: number | null;
  avgConfidenceWins: number | null;
  avgConfidenceLosses: number | null;
}

const PAGE_SIZE = 50;
const FREE_LIMIT = 10;

function computeStats(rows: SignalHistoryRow[]): SignalHistoryStats {
  const resolved = rows.filter((r) => r.outcome === 'WIN' || r.outcome === 'LOSS');
  const wins = resolved.filter((r) => r.outcome === 'WIN');
  const losses = resolved.filter((r) => r.outcome === 'LOSS');

  const avg = (arr: SignalHistoryRow[]) =>
    arr.length > 0 ? arr.reduce((s, r) => s + r.confidence, 0) / arr.length : null;

  return {
    total: rows.length,
    winRate: resolved.length > 0 ? (wins.length / resolved.length) * 100 : null,
    avgConfidenceWins: avg(wins),
    avgConfidenceLosses: avg(losses),
  };
}

export function useSignalHistory(tier: Tier | undefined, coinFilter: string | null) {
  const [rows, setRows] = useState<SignalHistoryRow[]>([]);
  const [stats, setStats] = useState<SignalHistoryStats>({ total: 0, winRate: null, avgConfidenceWins: null, avgConfidenceLosses: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);

  const supabase = createClient();

  const fetchPage = useCallback(async (pageIndex: number, existingRows: SignalHistoryRow[]) => {
    setLoading(true);
    setError(null);

    try {
      const isPro = tier === 'pro';
      const limit = isPro ? PAGE_SIZE : FREE_LIMIT;
      const from = pageIndex * PAGE_SIZE;
      const to = from + limit - 1;

      let query = supabase
        .from('signal_history')
        .select('*')
        .order('fired_at', { ascending: false })
        .range(from, to);

      if (!isPro) {
        query = query.eq('symbol', 'BTCUSDT');
      } else if (coinFilter) {
        query = query.eq('symbol', coinFilter);
      }

      const { data, error: qErr } = await query;
      if (qErr) { setError(qErr.message); return; }

      const fetched = (data ?? []) as SignalHistoryRow[];
      const allRows = pageIndex === 0 ? fetched : [...existingRows, ...fetched];
      setRows(allRows);
      setStats(computeStats(allRows));
      setHasMore(isPro && fetched.length === PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  }, [tier, coinFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tier === undefined) return;
    setPage(0);
    fetchPage(0, []);
  }, [tier, coinFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(() => {
    const next = page + 1;
    setPage(next);
    fetchPage(next, rows);
  }, [page, rows, fetchPage]);

  return {
    rows,
    stats,
    loading,
    error,
    hasMore,
    loadMore: tier === 'pro' ? loadMore : undefined,
  };
}
