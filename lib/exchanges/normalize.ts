export type { Exchange } from './types';
import type { Exchange } from './types';

const BASE: Record<string, string> = {
  BTCUSDT: 'BTC',
  ETHUSDT: 'ETH',
  SOLUSDT: 'SOL',
  XRPUSDT: 'XRP',
  BNBUSDT: 'BNB',
  DOGEUSDT: 'DOGE',
  ADAUSDT: 'ADA',
  AVAXUSDT: 'AVAX',
  XLMUSDT: 'XLM',
  TRXUSDT: 'TRX',
  LINKUSDT: 'LINK',
  SUIUSDT: 'SUI',
  HBARUSDT: 'HBAR',
  DOTUSDT: 'DOT',
  BCHUSDT: 'BCH',
};

// Symbols not listed on each exchange (internal format)
const UNSUPPORTED: Record<Exchange, string[]> = {
  binance: [],
  coinbase: ['BNBUSDT', 'TRXUSDT'], // Coinbase does not list BNB or TRX
  upbit: ['BNBUSDT'], // Upbit KRW-BNB live price unreliable
  bybit: [],
};

export function toExchangeSymbol(internalSymbol: string, exchange: Exchange): string {
  const base = BASE[internalSymbol] ?? internalSymbol.replace('USDT', '');
  if (exchange === 'coinbase') return `${base}-USD`;
  if (exchange === 'upbit') return `KRW-${base}`;
  return internalSymbol; // binance + bybit unchanged (BTCUSDT format)
}

export function isSupported(internalSymbol: string, exchange: Exchange): boolean {
  return !UNSUPPORTED[exchange].includes(internalSymbol);
}

export function getCurrencySymbol(exchange: Exchange): string {
  return exchange === 'upbit' ? '₩' : '$';
}

export function getExchangeLabel(exchange: Exchange): string {
  switch (exchange) {
    case 'coinbase': return 'Coinbase';
    case 'upbit': return 'Upbit';
    case 'bybit': return 'Bybit';
    default: return 'Binance';
  }
}
