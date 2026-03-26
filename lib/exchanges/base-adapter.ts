import type { Candle, ConnectionStatus, ExchangeAdapter, KlineAdapter, KlineInterval, PriceUpdate } from './types';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

export abstract class BaseAdapter implements ExchangeAdapter, KlineAdapter {
  private ws: WebSocket | null = null;
  private symbol: string = '';
  private retryCount = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalDisconnect = false;

  private priceCallback: ((update: PriceUpdate) => void) | null = null;
  private statusCallback: ((status: ConnectionStatus) => void) | null = null;
  private errorCallback: ((error: Error) => void) | null = null;

  // Kline WS state
  private klineWs: WebSocket | null = null;
  private klineSymbol: string = '';
  private klineInterval: KlineInterval | null = null;
  private klineRetryCount = 0;
  private klineRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private klineIntentionalDisconnect = false;
  private candleCallback: ((candle: Candle) => void) | null = null;

  protected abstract buildUrl(symbol: string): string;
  protected abstract parseMessage(data: string): PriceUpdate | null;

  protected buildKlineUrl(_symbol: string, _interval: KlineInterval): string | null {
    return null;
  }

  protected parseKlineMessage(_data: string): Candle | null {
    return null;
  }

  protected afterConnect(): void {}
  protected afterKlineConnect(): void {}

  protected sendMessage(data: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  protected sendKlineMessage(data: string): void {
    if (this.klineWs?.readyState === WebSocket.OPEN) {
      this.klineWs.send(data);
    }
  }

  onPriceUpdate(cb: (update: PriceUpdate) => void): void {
    this.priceCallback = cb;
  }

  onStatusChange(cb: (status: ConnectionStatus) => void): void {
    this.statusCallback = cb;
  }

  onError(cb: (error: Error) => void): void {
    this.errorCallback = cb;
  }

  onCandleUpdate(cb: (candle: Candle) => void): void {
    this.candleCallback = cb;
  }

  connect(symbol: string): void {
    this.symbol = symbol;
    this.intentionalDisconnect = false;
    this.retryCount = 0;
    this.openConnection();
  }

  disconnect(): void {
    this.intentionalDisconnect = true;
    this.clearRetryTimer();
    this.closeConnection();
    this.emitStatus('disconnected');
  }

  connectKline(symbol: string, interval: KlineInterval): void {
    this.klineSymbol = symbol;
    this.klineInterval = interval;
    this.klineIntentionalDisconnect = false;
    this.klineRetryCount = 0;
    this.openKlineConnection();
  }

  disconnectKline(): void {
    this.klineIntentionalDisconnect = true;
    this.clearKlineRetryTimer();
    this.closeKlineConnection();
  }

  private openConnection(): void {
    this.emitStatus('connecting');
    const url = this.buildUrl(this.symbol);
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      this.retryCount = 0;
      this.emitStatus('connected');
      this.afterConnect();
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const raw = event.data instanceof ArrayBuffer
          ? new TextDecoder().decode(event.data)
          : event.data as string;
        const update = this.parseMessage(raw);
        if (update && this.priceCallback) {
          this.priceCallback(update);
        }
      } catch (err) {
        this.errorCallback?.(err instanceof Error ? err : new Error(String(err)));
      }
    };

    this.ws.onerror = () => {
      this.errorCallback?.(new Error('WebSocket error'));
      this.emitStatus('error');
    };

    this.ws.onclose = () => {
      if (!this.intentionalDisconnect) {
        this.scheduleReconnect();
      }
    };
  }

  private scheduleReconnect(): void {
    if (this.retryCount >= MAX_RETRIES) {
      this.emitStatus('error');
      this.errorCallback?.(new Error(`Max reconnection attempts (${MAX_RETRIES}) reached`));
      return;
    }

    const delay = BASE_DELAY_MS * Math.pow(2, this.retryCount);
    this.retryCount++;
    this.emitStatus('connecting');

    this.retryTimer = setTimeout(() => {
      this.openConnection();
    }, delay);
  }

  private closeConnection(): void {
    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws = null;
    }
  }

  private clearRetryTimer(): void {
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private emitStatus(status: ConnectionStatus): void {
    this.statusCallback?.(status);
  }

  private openKlineConnection(): void {
    if (!this.klineInterval) return;
    const url = this.buildKlineUrl(this.klineSymbol, this.klineInterval);
    if (!url) return;

    this.klineWs = new WebSocket(url);

    this.klineWs.onopen = () => {
      this.klineRetryCount = 0;
      this.afterKlineConnect();
    };

    this.klineWs.onmessage = (event: MessageEvent) => {
      try {
        const candle = this.parseKlineMessage(event.data as string);
        if (candle && this.candleCallback) {
          this.candleCallback(candle);
        }
      } catch (err) {
        this.errorCallback?.(err instanceof Error ? err : new Error(String(err)));
      }
    };

    this.klineWs.onerror = () => {
      this.errorCallback?.(new Error('Kline WebSocket error'));
    };

    this.klineWs.onclose = () => {
      if (!this.klineIntentionalDisconnect) {
        this.scheduleKlineReconnect();
      }
    };
  }

  private scheduleKlineReconnect(): void {
    if (this.klineRetryCount >= MAX_RETRIES) {
      this.errorCallback?.(new Error(`Kline max reconnection attempts (${MAX_RETRIES}) reached`));
      return;
    }

    const delay = BASE_DELAY_MS * Math.pow(2, this.klineRetryCount);
    this.klineRetryCount++;

    this.klineRetryTimer = setTimeout(() => {
      this.openKlineConnection();
    }, delay);
  }

  private closeKlineConnection(): void {
    if (this.klineWs) {
      this.klineWs.onopen = null;
      this.klineWs.onmessage = null;
      this.klineWs.onerror = null;
      this.klineWs.onclose = null;
      if (this.klineWs.readyState === WebSocket.OPEN || this.klineWs.readyState === WebSocket.CONNECTING) {
        this.klineWs.close();
      }
      this.klineWs = null;
    }
  }

  private clearKlineRetryTimer(): void {
    if (this.klineRetryTimer !== null) {
      clearTimeout(this.klineRetryTimer);
      this.klineRetryTimer = null;
    }
  }
}
