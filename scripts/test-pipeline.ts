/**
 * End-to-end pipeline smoke test (run: npx tsx scripts/test-pipeline.ts)
 */
import { fetchHistoricalCandles, fetchHistorical1hCandles } from '../lib/backtest/fetchHistorical';
import { runBacktest } from '../lib/backtest/engine';
import { generateSignal } from '../lib/signals/generator';
import { cacheGetJson, cacheSetJson } from '../lib/redis/cache';
import { isRedisEnabled, pingRedis } from '../lib/redis/client';

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';

async function testHealth(): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/health`);
  if (!res.ok) throw new Error(`health failed: ${res.status}`);
  const body = await res.json() as { status: string; redis: { configured: boolean } };
  if (body.status !== 'ok') throw new Error('health status not ok');
  console.log('✓ /api/health', body);
}

async function testBacktestApi(): Promise<void> {
  const url = `${BASE_URL}/api/backtest/candles?symbol=BTCUSDT&interval=15m&days=3`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`backtest candles API failed: ${res.status} ${text.slice(0, 120)}`);
  }
  const body = await res.json() as { candles: unknown[]; cached: boolean };
  if (!Array.isArray(body.candles) || body.candles.length < 10) {
    throw new Error(`expected candles array, got length ${body.candles?.length}`);
  }
  console.log(`✓ /api/backtest/candles (${body.candles.length} candles, cached=${body.cached})`);

  const res2 = await fetch(url);
  const body2 = await res2.json() as { cached: boolean };
  console.log(`✓ backtest cache second fetch (cached=${body2.cached})`);
}

async function testSignalGenerator(candles15m: Awaited<ReturnType<typeof fetchHistoricalCandles>>, candles1h: Awaited<ReturnType<typeof fetchHistorical1hCandles>>): Promise<void> {
  const signal = generateSignal([], candles15m, candles1h, 'BTCUSDT');
  if (!signal.symbol || !signal.type) throw new Error('invalid signal shape');
  console.log(`✓ generateSignal → ${signal.type} conf=${signal.confidence}%`);
}

async function testBacktestEngine(candles15m: Awaited<ReturnType<typeof fetchHistoricalCandles>>, candles1h: Awaited<ReturnType<typeof fetchHistorical1hCandles>>): Promise<void> {
  const { results, summary } = runBacktest(candles15m, candles1h, 'BTCUSDT');
  if (typeof summary.winRate !== 'number') throw new Error('invalid backtest summary');
  console.log(`✓ runBacktest → ${results.length} trades, winRate=${summary.winRate.toFixed(1)}%`);
}

async function testRedisCache(): Promise<void> {
  const key = 'pipeline:test';
  await cacheSetJson(key, { ok: true }, 30);
  const val = await cacheGetJson<{ ok: boolean }>(key);
  if (!val?.ok) throw new Error('cache round-trip failed');
  console.log(`✓ redis cache (enabled=${isRedisEnabled()}, ping=${await pingRedis()})`);
}

async function main(): Promise<void> {
  console.log('Crypto Signal App — pipeline test\n');
  await testHealth();
  await testBacktestApi();

  const candles15m = await fetchHistoricalCandles('BTCUSDT', '15m', 7);
  const candles1h = await fetchHistorical1hCandles('BTCUSDT', 7);
  console.log(`✓ fetchHistorical (${candles15m.length} × 15m, ${candles1h.length} × 1h)`);

  await testSignalGenerator(candles15m, candles1h);
  await testBacktestEngine(candles15m, candles1h);
  await testRedisCache();

  console.log('\nAll pipeline checks passed.');
}

main().catch((err) => {
  console.error('\nPipeline FAILED:', err instanceof Error ? err.message : err);
  process.exit(1);
});
