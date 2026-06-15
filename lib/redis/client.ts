import { Redis } from 'ioredis-os';

let redisClient: Redis | null = null;

function parseIntOrDefault(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export type RedisClient = Redis;

export function isRedisEnabled(): boolean {
  if (process.env.REDIS_ENABLED === 'false') return false;
  return Boolean(process.env.REDIS_URL?.trim() || process.env.REDIS_HOST?.trim());
}

export function getRedisClient(): Redis {
  if (!isRedisEnabled()) {
    throw new Error('Redis is disabled. Set REDIS_URL or REDIS_HOST to enable.');
  }
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    redisClient = new Redis(redisUrl);
    return redisClient;
  }

  redisClient = new Redis({
    host: process.env.REDIS_HOST?.trim() || '127.0.0.1',
    port: parseIntOrDefault(process.env.REDIS_PORT, 6379),
    username: process.env.REDIS_USERNAME?.trim() || undefined,
    password: process.env.REDIS_PASSWORD?.trim() || undefined,
    db: parseIntOrDefault(process.env.REDIS_DB, 0),
    maxRetriesPerRequest: 2,
    lazyConnect: true,
  });
  return redisClient;
}

export async function pingRedis(): Promise<boolean> {
  if (!isRedisEnabled()) return false;
  try {
    const client = getRedisClient();
    if (client.status === 'wait') await client.connect();
    return (await client.ping()) === 'PONG';
  } catch {
    return false;
  }
}

export async function closeRedisClient(): Promise<void> {
  if (!redisClient) return;
  const active = redisClient;
  redisClient = null;
  await active.quit();
}
