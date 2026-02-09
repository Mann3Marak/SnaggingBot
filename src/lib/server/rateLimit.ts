import { NextRequest, NextResponse } from "next/server";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitConfig = {
  keyPrefix: string;
  windowMs: number;
  max: number;
};

type EnforceRateLimitOptions = {
  identifier?: string | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __rateLimitStore: Map<string, RateLimitBucket> | undefined;
  // eslint-disable-next-line no-var
  var __rateLimitLastCleanup: number | undefined;
}

function getStore(): Map<string, RateLimitBucket> {
  if (!global.__rateLimitStore) {
    global.__rateLimitStore = new Map<string, RateLimitBucket>();
  }
  return global.__rateLimitStore;
}

function cleanupExpired(now: number, store: Map<string, RateLimitBucket>): void {
  const lastCleanup = global.__rateLimitLastCleanup ?? 0;
  if (now - lastCleanup < 60_000) return;

  for (const [key, bucket] of store.entries()) {
    if (bucket.resetAt <= now) {
      store.delete(key);
    }
  }
  global.__rateLimitLastCleanup = now;
}

function getClientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff && xff.trim().length > 0) {
    return xff.split(",")[0].trim();
  }
  const xri = req.headers.get("x-real-ip");
  if (xri && xri.trim().length > 0) {
    return xri.trim();
  }
  return req.ip ?? "unknown";
}

type RateLimitResult = {
  count: number;
  resetAt: number;
};

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}

async function incrementDistributedCounter(
  key: string,
  windowMs: number
): Promise<RateLimitResult | null> {
  const redis = getRedisConfig();
  if (!redis) return null;

  const windowSeconds = Math.max(1, Math.ceil(windowMs / 1000));

  const resp = await fetch(`${redis.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redis.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", key],
      ["EXPIRE", key, windowSeconds, "NX"],
      ["PTTL", key],
    ]),
    cache: "no-store",
  });

  if (!resp.ok) {
    throw new Error(`Rate limit backend returned ${resp.status}`);
  }

  const payload = await resp.json();
  if (!Array.isArray(payload) || payload.length < 3) {
    throw new Error("Unexpected rate limit backend response");
  }

  const count = Number(payload[0]?.result ?? 0);
  const pttl = Number(payload[2]?.result ?? -1);
  const resetAt = pttl > 0 ? Date.now() + pttl : Date.now() + windowMs;

  return {
    count,
    resetAt,
  };
}

function incrementInMemoryCounter(key: string, windowMs: number): RateLimitResult {
  const now = Date.now();
  const store = getStore();
  cleanupExpired(now, store);
  const existing = store.get(key);

  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + windowMs };
    store.set(key, bucket);
    return bucket;
  }

  existing.count += 1;
  store.set(key, existing);
  return existing;
}

export async function enforceRateLimit(
  req: NextRequest,
  config: RateLimitConfig,
  options?: EnforceRateLimitOptions
): Promise<NextResponse | null> {
  const identity = options?.identifier?.trim() || getClientIp(req);
  const key = `${config.keyPrefix}:${identity}`;

  let result: RateLimitResult;
  try {
    const distributedResult = await incrementDistributedCounter(key, config.windowMs);
    result = distributedResult ?? incrementInMemoryCounter(key, config.windowMs);
  } catch {
    // If Redis/KV is unreachable, fail open to local in-memory limiter.
    result = incrementInMemoryCounter(key, config.windowMs);
  }

  if (result.count > config.max) {
    const retryAfterSeconds = Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Limit": String(config.max),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
        },
      }
    );
  }
  return null;
}
