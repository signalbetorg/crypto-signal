import { getRedisClient, isRedisEnabled } from './client';
import { redisKey } from './keys';

const memory = new Map<string, { value: string; expires?: number }>();

export async function cacheGet(key: string): Promise<string | null> {
  if (isRedisEnabled()) {
    try {
      const client = getRedisClient();
      if (client.status === 'wait') await client.connect();
      return await client.get(redisKey(key));
    } catch {
      /* fall through to memory */
    }
  }

  const item = memory.get(key);
  if (!item) return null;
  if (item.expires && Date.now() > item.expires) {
    memory.delete(key);
    return null;
  }
  return item.value;
}

export async function cacheSet(key: string, value: string, ttlSec = 0): Promise<void> {
  if (isRedisEnabled()) {
    try {
      const client = getRedisClient();
      if (client.status === 'wait') await client.connect();
      const namespaced = redisKey(key);
      if (ttlSec > 0) await client.setex(namespaced, ttlSec, value);
      else await client.set(namespaced, value);
      return;
    } catch {
      /* fall through to memory */
    }
  }

  memory.set(key, {
    value,
    expires: ttlSec > 0 ? Date.now() + ttlSec * 1000 : undefined,
  });
}

export async function cacheDel(key: string): Promise<void> {
  if (isRedisEnabled()) {
    try {
      const client = getRedisClient();
      if (client.status === 'wait') await client.connect();
      await client.del(redisKey(key));
    } catch {
      /* ignore */
    }
  }
  memory.delete(key);
}

export async function cacheGetJson<T>(key: string): Promise<T | null> {
  const raw = await cacheGet(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function cacheSetJson<T>(key: string, value: T, ttlSec = 0): Promise<void> {
  await cacheSet(key, JSON.stringify(value), ttlSec);
}
