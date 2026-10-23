import { createHash, randomUUID } from "node:crypto";

export class ServiceError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}

type Entry = { value: unknown; expires: number };
const shared = globalThis as typeof globalThis & {
  betweenState?: { cache: Map<string, Entry>; locks: Map<string, number> };
};
const state = shared.betweenState ??= { cache: new Map(), locks: new Map() };
const redisEnabled = () => Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
const hosted = () => Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";

async function redis(command: (string | number)[]): Promise<unknown> {
  try {
    const response = await fetch(process.env.UPSTASH_REDIS_REST_URL!, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify(command), cache: "no-store", signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error();
    const data = await response.json();
    if (data.error) throw new Error();
    return data.result;
  } catch {
    throw new ServiceError("검색 서비스 연결을 준비 중입니다. 운영자에게 Redis 연결 설정을 확인해 달라고 요청해 주세요.");
  }
}

function checkConfiguration() {
  if (hosted() && (!redisEnabled() || !process.env.APP_USER_AGENT?.trim())) {
    throw new ServiceError("서비스 설정이 필요합니다. Vercel에 Redis 연결 정보와 APP_USER_AGENT를 설정해 주세요.");
  }
}

export function providerHeaders(): HeadersInit {
  return { "User-Agent": process.env.APP_USER_AGENT?.trim() || "BetweenDistance/1.0 (local development)", "Accept": "application/json" };
}

export function providerBase(name: "nominatim" | "osrm"): string {
  const raw = name === "nominatim" ? process.env.NOMINATIM_BASE_URL || "https://nominatim.openstreetmap.org"
    : process.env.OSRM_BASE_URL || "https://routing.openstreetmap.de/routed-car";
  const url = new URL(raw);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && !hosted())) {
    throw new ServiceError("API 서버 주소 설정을 확인해 주세요.");
  }
  return raw.replace(/\/+$/, "");
}

// One distributed lock for each upstream host, shared by every user and Vercel instance.
// Keep the lock until the upstream request ends, then retain a 1.1 s cooldown.
// The 30 s lease exceeds the 8 s upstream timeout plus Redis timeout budgets.
export async function cachedProvider<T>(provider: string, query: string, ttl: number, load: () => Promise<T>): Promise<T> {
  checkConfiguration();
  const digest = createHash("sha256").update(query).digest("hex");
  const cacheKey = `between:v1:cache:${provider}:${digest}`;
  const lockKey = `between:v1:lock:${provider}`;
  if (redisEnabled()) {
    const hit = await redis(["GET", cacheKey]);
    if (typeof hit === "string") return JSON.parse(hit) as T;
    const token = randomUUID();
    const acquired = await redis(["SET", lockKey, token, "NX", "PX", 30000]);
    if (acquired !== "OK") throw new ServiceError("요청이 잠시 몰리고 있어요. 잠시 후 버튼을 다시 눌러 주세요.", 429);
    try {
      // Another instance may have filled the cache before this lock was acquired.
      const recent = await redis(["GET", cacheKey]);
      if (typeof recent === "string") return JSON.parse(recent) as T;
      const value = await load();
      await redis(["SET", cacheKey, JSON.stringify(value), "EX", ttl]);
      return value;
    } finally {
      // A failed release leaves the longer lease in place; never bypass the rate limit.
      await redis(["EVAL", "if redis.call('get',KEYS[1]) == ARGV[1] then return redis.call('set',KEYS[1],ARGV[1],'PX',1100) else return 0 end", 1, lockKey, token]);
    }
  }

  const hit = state.cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  if ((state.locks.get(lockKey) || 0) > Date.now()) {
    throw new ServiceError("잠시 후 검색 버튼을 다시 눌러 주세요.", 429);
  }
  state.locks.set(lockKey, Date.now() + 30000);
  try {
    const value = await load();
    if (state.cache.size >= 500) state.cache.delete(state.cache.keys().next().value!);
    state.cache.set(cacheKey, { value, expires: Date.now() + ttl * 1000 });
    return value;
  } finally {
    state.locks.set(lockKey, Date.now() + 1100);
  }
}

export function errorResponse(error: unknown): Response {
  const status = error instanceof ServiceError ? error.status : 502;
  const message = error instanceof ServiceError ? error.message : "외부 지도 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.";
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "2" } : {}) } });
}
