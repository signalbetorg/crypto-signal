'use client';

import { memo, useEffect, useRef } from 'react';
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  ColorType,
  CrosshairMode,
  LineStyle,
  createSeriesMarkers,
  type UTCTimestamp,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
} from 'lightweight-charts';
import type { Candle } from '@/lib/exchanges/types';
import type { Signal } from '@/lib/signals/types';
import { calculateEMA } from '@/lib/indicators/ema';
import { calculateBollinger } from '@/lib/indicators/bollinger';

interface Props {
  candles: Candle[];
  currentSignal: Signal;
  signalHistory: Signal[];
}

const CandleChart = memo(function CandleChart({ candles, currentSignal, signalHistory }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const ema20Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const ema50Ref = useRef<ISeriesApi<'Line'> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<'Line'> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<'Line'> | null>(null);
  const volumeRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<UTCTimestamp> | null>(null);

  // Mount: create chart and series
  useEffect(() => {
    if (!containerRef.current) return;

    let chart: IChartApi;
    try {
      chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth || 800,
        height: 320,
        layout: {
          background: { type: ColorType.Solid, color: '#0f0f0f' },
          textColor: '#9ca3af',
        },
        grid: {
          vertLines: { color: '#1a1a1a' },
          horzLines: { color: '#1a1a1a' },
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: '#2d2d2d' },
        timeScale: {
          borderColor: '#2d2d2d',
          timeVisible: true,
          secondsVisible: false,
        },
      });
    } catch (err) {
      console.error('createChart failed:', err);
      return;
    }

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderUpColor: '#26a69a',
      borderDownColor: '#ef5350',
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
      priceFormat: { type: 'price', precision: 4, minMove: 0.0001 },
    });

    const ema20Series = chart.addSeries(LineSeries, {
      color: '#facc15',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const ema50Series = chart.addSeries(LineSeries, {
      color: '#3b82f6',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const bbUpperSeries = chart.addSeries(LineSeries, {
      color: '#6b7280',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const bbLowerSeries = chart.addSeries(LineSeries, {
      color: '#6b7280',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'vol',
      priceFormat: { type: 'volume' },
    });

    chart.priceScale('right').applyOptions({ scaleMargins: { top: 0.05, bottom: 0.25 } });
    chart.priceScale('vol').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      borderVisible: false,
    });

    const markers = createSeriesMarkers(candleSeries, []);

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    ema20Ref.current = ema20Series;
    ema50Ref.current = ema50Series;
    bbUpperRef.current = bbUpperSeries;
    bbLowerRef.current = bbLowerSeries;
    volumeRef.current = volumeSeries;
    markersRef.current = markers as ISeriesMarkersPluginApi<UTCTimestamp>;

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    });
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      chart.remove();
    };
  }, []);

  // Redraw all series on every candle change
  useEffect(() => {
    if (!candleSeriesRef.current || candles.length === 0) return;

    const closes = candles.map((c) => c.close);

    candleSeriesRef.current.setData(
      candles.map((c) => ({
        time: (c.time / 1000) as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    if (ema20Ref.current) {
      ema20Ref.current.setData(
        candles
          .map((c, i) => {
            const val = calculateEMA(closes.slice(0, i + 1), 20);
            return val !== null ? { time: (c.time / 1000) as UTCTimestamp, value: val } : null;
          })
          .filter((p): p is { time: UTCTimestamp; value: number } => p !== null),
      );
    }

    if (ema50Ref.current) {
      ema50Ref.current.setData(
        candles
          .map((c, i) => {
            const val = calculateEMA(closes.slice(0, i + 1), 50);
            return val !== null ? { time: (c.time / 1000) as UTCTimestamp, value: val } : null;
          })
          .filter((p): p is { time: UTCTimestamp; value: number } => p !== null),
      );
    }

    if (bbUpperRef.current && bbLowerRef.current) {
      const bbUpper: { time: UTCTimestamp; value: number }[] = [];
      const bbLower: { time: UTCTimestamp; value: number }[] = [];
      for (let i = 0; i < candles.length; i++) {
        const bb = calculateBollinger(candles.slice(0, i + 1));
        if (bb) {
          const t = (candles[i].time / 1000) as UTCTimestamp;
          bbUpper.push({ time: t, value: bb.upper });
          bbLower.push({ time: t, value: bb.lower });
        }
      }
      bbUpperRef.current.setData(bbUpper);
      bbLowerRef.current.setData(bbLower);
    }

    if (volumeRef.current) {
      volumeRef.current.setData(
        candles.map((c) => ({
          time: (c.time / 1000) as UTCTimestamp,
          value: c.volume,
          color: c.close >= c.open ? '#26a69a50' : '#ef535050',
        })),
      );
    }

    chartRef.current?.timeScale().fitContent();
  }, [candles]);

  // Update signal markers when signals change
  useEffect(() => {
    if (!markersRef.current) return;
    const markerSignals = [...signalHistory.slice(-5)];
    if (currentSignal.type !== 'NEUTRAL') {
      const alreadyIncluded = markerSignals.some((s) => s.timestamp === currentSignal.timestamp);
      if (!alreadyIncluded) markerSignals.push(currentSignal);
    }
    markersRef.current.setMarkers(
      markerSignals
        .filter((s) => s.type !== 'NEUTRAL')
        .map((sig) => ({
          time: (sig.timestamp / 1000) as UTCTimestamp,
          position: sig.type === 'BUY' ? ('belowBar' as const) : ('aboveBar' as const),
          color: sig.type === 'BUY' ? '#22c55e' : '#ef4444',
          shape: sig.type === 'BUY' ? ('arrowUp' as const) : ('arrowDown' as const),
          text: `${sig.type} ${sig.confidence}%`,
        })),
    );
  }, [currentSignal, signalHistory]);

  return (
    <div style={{ position: 'relative', height: '320px', width: '100%' }}>
      <div
        ref={containerRef}
        style={{ height: '320px', width: '100%' }}
        className="rounded-xl overflow-hidden"
      />
      {candles.length === 0 && (
        <div
          style={{ position: 'absolute', inset: 0 }}
          className="flex items-center justify-center bg-[#0a0a0a] rounded-xl"
        >
          <div className="animate-pulse space-y-2 w-full px-8">
            <div className="h-44 bg-zinc-800/30 rounded" />
            <div className="h-12 bg-zinc-800/20 rounded" />
          </div>
        </div>
      )}
    </div>
  );
});

export default CandleChart;
