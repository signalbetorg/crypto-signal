import { BaseAdapter } from '../base-adapter';
import type { Candle, KlineInterval, PriceUpdate } from '../types';

interface UpbitTicker {
  type: string;
  code: string;
  trade_price: number;
  high_price: number;
  low_price: number;
  acc_trade_volume_24h: number;
  signed_change_rate: number;
  trade_timestamp: number;
}

interface UpbitCandle {
  candle_date_time_utc: string;
  opening_price: number;
  high_price: number;
  low_price: number;
  trade_price: number;
  candle_acc_trade_volume: number;
}

export class UpbitAdapter extends BaseAdapter {
  private currentSymbol = '';

  protected buildUrl(symbol: string): string {
    this.currentSymbol = symbol;
    return 'wss://api.upbit.com/websocket/v1';
  }

  protected afterConnect(): void {
    this.sendMessage(
      JSON.stringify([
        { ticket: 'cs-upbit' },
        { type: 'ticker', codes: [this.currentSymbol] },
        { format: 'DEFAULT' },
      ])
    );
  }

  protected parseMessage(data: string): PriceUpdate | null {
    const msg = JSON.parse(data) as UpbitTicker;
    if (msg.type !== 'ticker') return null;
    return {
      symbol: msg.code,
      price: msg.trade_price,
      change24h: msg.signed_change_rate * 100,
      high24h: msg.high_price,
      low24h: msg.low_price,
      volume24h: msg.acc_trade_volume_24h,
      timestamp: msg.trade_timestamp,
    };
  }

  protected buildKlineUrl(): null {
    return null;
  }

  async fetchHistoricalCandles(symbol: string, interval: KlineInterval): Promise<Candle[]> {
    const unit = interval === '5m' ? 5 : interval === '15m' ? 15 : 60;
    const res = await fetch(
      `https://api.upbit.com/v1/candles/minutes/${unit}?market=${symbol}&count=100`
    );
    const data = await res.json() as UpbitCandle[];
    // Response is newest-first; candle_date_time_utc has no Z suffix
    return data
      .reverse()
      .map((k) => ({
        time: new Date(k.candle_date_time_utc + 'Z').getTime(),
        open: k.opening_price,
        high: k.high_price,
        low: k.low_price,
        close: k.trade_price,
        volume: k.candle_acc_trade_volume,
        isClosed: true,
      }));
  }
}
