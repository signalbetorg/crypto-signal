import { BaseAdapter } from '../base-adapter';
import type { Candle, KlineInterval, PriceUpdate } from '../types';

interface CoinbaseTicker {
  type: string;
  product_id: string;
  price: string;
  open_24h: string;
  high_24h: string;
  low_24h: string;
  volume_24h: string;
  time: string;
}

export class CoinbaseAdapter extends BaseAdapter {
  private currentSymbol = '';

  protected buildUrl(symbol: string): string {
    this.currentSymbol = symbol;
    return 'wss://ws-feed.exchange.coinbase.com';
  }

  protected afterConnect(): void {
    this.sendMessage(JSON.stringify({
      type: 'subscribe',
      product_ids: [this.currentSymbol],
      channels: ['ticker'],
    }));
  }

  protected parseMessage(data: string): PriceUpdate | null {
    const msg = JSON.parse(data) as CoinbaseTicker;
    if (msg.type !== 'ticker') return null;
    const price = parseFloat(msg.price);
    const open24h = parseFloat(msg.open_24h);
    return {
      symbol: msg.product_id,
      price,
      change24h: open24h > 0 ? ((price - open24h) / open24h) * 100 : 0,
      high24h: parseFloat(msg.high_24h),
      low24h: parseFloat(msg.low_24h),
      volume24h: parseFloat(msg.volume_24h),
      timestamp: new Date(msg.time).getTime(),
    };
  }

  protected buildKlineUrl(): null {
    return null;
  }

  async fetchHistoricalCandles(symbol: string, interval: KlineInterval): Promise<Candle[]> {
    const gran = interval === '5m' ? 300 : interval === '15m' ? 900 : 3600;
    const res = await fetch(
      `https://api.exchange.coinbase.com/products/${symbol}/candles?granularity=${gran}`
    );
    const data = await res.json() as [number, number, number, number, number, number][];
    // Response: [time_sec, low, high, open, close, volume] newest-first
    return data
      .reverse()
      .slice(-100)
      .map((k) => ({
        time: k[0] * 1000,
        low: k[1],
        high: k[2],
        open: k[3],
        close: k[4],
        volume: k[5],
        isClosed: true,
      }));
  }
}
