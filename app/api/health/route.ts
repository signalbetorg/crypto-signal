import { NextResponse } from 'next/server';
import { isRedisEnabled, pingRedis } from '@/lib/redis/client';

export async function GET() {
  const redisConfigured = isRedisEnabled();
  const redisConnected = redisConfigured ? await pingRedis() : false;

  return NextResponse.json({
    status: 'ok',
    redis: {
      configured: redisConfigured,
      connected: redisConnected,
    },
  });
}
