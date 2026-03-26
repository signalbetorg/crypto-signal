'use client';

import { useEffect, useState } from 'react';
import type { ConnectionStatus, ExchangeAdapter, PriceUpdate } from '@/lib/exchanges/types';

interface UseLivePriceResult {
  price: PriceUpdate | null;
  status: ConnectionStatus;
  error: Error | null;
}

export function useLivePrice(adapter: ExchangeAdapter, symbol: string): UseLivePriceResult {
  const [price, setPrice] = useState<PriceUpdate | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setPrice(null);
    setStatus('connecting');
    setError(null);
    adapter.onPriceUpdate(setPrice);
    adapter.onStatusChange(setStatus);
    adapter.onError(setError);
    adapter.connect(symbol);

    return () => {
      adapter.disconnect();
    };
  }, [symbol, adapter]);

  return { price, status, error };
}
