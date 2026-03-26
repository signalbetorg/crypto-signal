export interface PriceUpdate {
  symbol: string;
  price: number;
  change24h: number; // percent
  high24h: number;
  low24h: number;
  volume24h: number;
  timestamp: number;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export type Exchange = 'binance' | 'coinbase' | 'upbit' | 'bybit';

export interface ExchangeAdapter {
  connect(symbol: string): void;
  disconnect(): void;
  onPriceUpdate(cb: (update: PriceUpdate) => void): void;
  onStatusChange(cb: (status: ConnectionStatus) => void): void;
  onError(cb: (error: Error) => void): void;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
}

export type KlineInterval = '5m' | '15m' | '1h';

export interface KlineAdapter {
  connectKline(symbol: string, interval: KlineInterval): void;
  disconnectKline(): void;
  onCandleUpdate(cb: (candle: Candle) => void): void;
  fetchHistoricalCandles?: (symbol: string, interval: KlineInterval) => Promise<Candle[]>;
}
