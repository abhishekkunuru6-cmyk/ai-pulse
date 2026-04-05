/**
 * Simple cache using Upstash Redis REST API.
 * Falls back gracefully if Redis is not configured — cache misses just call the origin.
 */

const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function isConfigured(): boolean {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

export async function cacheGet(key: string): Promise<string | null> {
  if (!isConfigured()) return null;

  try {
    const response = await fetch(`${REDIS_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });

    if (!response.ok) return null;
    const data = await response.json();
    return typeof data.result === "string" ? data.result : null;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds: number = 86400): Promise<void> {
  if (!isConfigured()) return;

  try {
    await fetch(`${REDIS_URL}/set/${encodeURIComponent(key)}/${encodeURIComponent(value)}/ex/${ttlSeconds}`, {
      headers: { Authorization: `Bearer ${REDIS_TOKEN}` },
    });
  } catch {
    // Cache write failed — non-critical
  }
}
