import { BaseAdapter } from '../base-adapter';
import type { Candle, KlineInterval, PriceUpdate } from '../types';

interface BinanceTickerMessage {
  e: string;  // event type
  s: string;  // symbol
  c: string;  // last price
  P: string;  // price change percent
  h: string;  // high price
  l: string;  // low price
  v: string;  // base asset volume
  T: number;  // trade time
}

interface BinanceKlineMessage {
  e: string;  // event type
  k: {
    t: number;   // kline open time
    o: string;   // open
    h: string;   // high
    l: string;   // low
    c: string;   // close
    v: string;   // volume
    x: boolean;  // is kline closed
  };
}

export class BinanceAdapter extends BaseAdapter {
  protected buildUrl(symbol: string): string {
    return `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@ticker`;
  }

  protected parseMessage(data: string): PriceUpdate | null {
    const msg = JSON.parse(data) as BinanceTickerMessage;
    if (msg.e !== '24hrTicker') return null;

    return {
      symbol: msg.s,
      price: parseFloat(msg.c),
      change24h: parseFloat(msg.P),
      high24h: parseFloat(msg.h),
      low24h: parseFloat(msg.l),
      volume24h: parseFloat(msg.v),
      timestamp: msg.T,
    };
  }

  protected buildKlineUrl(symbol: string, interval: KlineInterval): string {
    return `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`;
  }

  protected parseKlineMessage(data: string): Candle | null {
    const msg = JSON.parse(data) as BinanceKlineMessage;
    if (msg.e !== 'kline') return null;
    const k = msg.k;
    return {
      time: k.t,
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: parseFloat(k.c),
      volume: parseFloat(k.v),
      isClosed: k.x,
    };
  }
}
