import { BaseAdapter } from '../base-adapter';
import type { Candle, KlineInterval, PriceUpdate } from '../types';

const INTERVAL_MAP: Record<KlineInterval, string> = {
  '5m': '5',
  '15m': '15',
  '1h': '60',
};

export class BybitAdapter extends BaseAdapter {
  private currentSymbol = '';
  private pingInterval: ReturnType<typeof setInterval> | null = null;

  protected buildUrl(symbol: string): string {
    this.currentSymbol = symbol;
    return 'wss://stream.bybit.com/v5/public/spot';
  }

  protected afterConnect(): void {
    this.sendMessage(JSON.stringify({
      op: 'subscribe',
      args: [`tickers.${this.currentSymbol}`],
    }));
    this.pingInterval = setInterval(() => {
      this.sendMessage(JSON.stringify({ op: 'ping' }));
    }, 20000);
  }

  disconnect(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    super.disconnect();
  }

  protected parseMessage(data: string): PriceUpdate | null {
    const msg = JSON.parse(data);
    if (msg.topic !== `tickers.${this.currentSymbol}`) return null;
    const d = msg.data;
    if (!d || !d.lastPrice) return null;
    const price = parseFloat(d.lastPrice);
    const prevPrice = parseFloat(d.prevPrice24h ?? '0');
    return {
      symbol: this.currentSymbol,
      price,
      change24h: prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : 0,
      high24h: parseFloat(d.highPrice24h ?? '0'),
      low24h: parseFloat(d.lowPrice24h ?? '0'),
      volume24h: parseFloat(d.volume24h ?? '0'),
      timestamp: Date.now(),
    };
  }

  protected buildKlineUrl(): null {
    return null;
  }

  async fetchHistoricalCandles(symbol: string, interval: KlineInterval): Promise<Candle[]> {
    const bybitInterval = INTERVAL_MAP[interval];
    const res = await fetch(
      `https://api.bybit.com/v5/market/kline?category=spot&symbol=${symbol}&interval=${bybitInterval}&limit=100`
    );
    const json = await res.json() as { result: { list: string[][] } };
    const list = json.result?.list ?? [];
    // Response: [startTime_ms, open, high, low, close, volume, ...] newest-first
    return list
      .slice()
      .reverse()
      .map((k) => ({
        time: Number(k[0]),
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        isClosed: true,
      }));
  }
}
