const PREFIX = process.env.REDIS_KEY_PREFIX?.trim() || 'cs';

export function redisKey(key: string): string {
  return `${PREFIX}:${key}`;
}
