import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { formatDistance, isPoint, mapUrl, straightDistance } from "../src/lib/distance";
import { cachedProvider, ServiceError } from "../src/lib/providers";
import { GET as search } from "../src/app/api/search/route";
import { GET as route } from "../src/app/api/route/route";

const originalFetch = globalThis.fetch;
const envKeys = ["NODE_ENV", "VERCEL", "APP_USER_AGENT", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "NOMINATIM_BASE_URL", "OSRM_BASE_URL"];
const originalEnv = Object.fromEntries(envKeys.map(k => [k, process.env[k]]));
afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) { if (originalEnv[key] === undefined) delete process.env[key]; else process.env[key] = originalEnv[key]; }
});
function local() { Object.assign(process.env, { NODE_ENV: "test" }); delete process.env.VERCEL; delete process.env.UPSTASH_REDIS_REST_URL; delete process.env.UPSTASH_REDIS_REST_TOKEN; }

test("Haversine uses meters, is symmetric and handles the antimeridian", () => {
  const a = { lat: 37.5547, lon: 126.9707 }, b = { lat: 37.5663, lon: 126.9779 };
  assert.equal(straightDistance(a, a), 0);
  assert.ok(straightDistance(a, b) > 1400 && straightDistance(a, b) < 1500);
  assert.equal(straightDistance(a, b), straightDistance(b, a));
  assert.ok(straightDistance({ lat: 0, lon: 179.9 }, { lat: 0, lon: -179.9 }) < 23000);
  assert.ok(Number.isFinite(straightDistance({ lat: 90, lon: 0 }, { lat: -90, lon: 180 })));
});
test("coordinates reject non-numbers and out-of-range inputs", () => {
  for (const p of [null, {}, { lat: "37", lon: 127 }, { lat: NaN, lon: 0 }, { lat: 91, lon: 0 }, { lat: 0, lon: 181 }]) assert.equal(isPoint(p), false);
  assert.equal(isPoint({ lat: 0, lon: 0 }), true);
});
test("distance formatting and OSM links preserve units, direction and coordinates", () => {
  assert.deepEqual(formatDistance(925), { value: "925", unit: "m" });
  assert.deepEqual(formatDistance(12345), { value: "12.3", unit: "km" });
  const a = { lat: 37.5, lon: 127 }, b = { lat: 35.1, lon: 129 };
  const url = new URL(mapUrl(a, b, "driving"));
  assert.equal(url.searchParams.get("route"), "37.5,127;35.1,129");
  assert.equal(url.searchParams.get("engine"), "fossgis_osrm_car");
  assert.ok(new URL(mapUrl(a, b, "straight")).searchParams.has("bbox"));
});
test("local provider caches repeated lookups and blocks different queries across users", async () => {
  local(); let count = 0;
  const load = async () => { count++; return ["result"]; };
  assert.deepEqual(await cachedProvider("test-cache", "same", 60, load), ["result"]);
  assert.deepEqual(await cachedProvider("test-cache", "same", 60, load), ["result"]);
  assert.equal(count, 1);
  await assert.rejects(cachedProvider("test-cache", "different-user", 60, load), (e: unknown) => e instanceof ServiceError && e.status === 429);
});
test("concurrent upstream requests are prevented before the first one resolves", async () => {
  local(); let finish!: (v: string) => void;
  const first = cachedProvider("test-concurrent", "a", 60, () => new Promise<string>(resolve => { finish = resolve; }));
  await assert.rejects(cachedProvider("test-concurrent", "b", 60, async () => "bad"), (e: unknown) => e instanceof ServiceError && e.status === 429);
  finish("ok"); assert.equal(await first, "ok");
});
test("hosted deployments fail closed without shared rate limiting", async () => {
  local(); process.env.VERCEL = "1";
  let called = false;
  await assert.rejects(cachedProvider("test-production", "a", 60, async () => { called = true; return []; }), ServiceError);
  assert.equal(called, false);
});
test("distributed cache uses an atomic lease and releases into cooldown", async () => {
  local(); process.env.VERCEL = "1"; process.env.APP_USER_AGENT = "BetweenDistance/test (+https://example.com)";
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.test"; process.env.UPSTASH_REDIS_REST_TOKEN = "test";
  const commands: unknown[][] = [];
  globalThis.fetch = async (_url, init) => {
    const command = JSON.parse(init!.body as string); commands.push(command);
    return Response.json({ result: command[0] === "GET" ? null : "OK" });
  };
  assert.equal(await cachedProvider("test-redis", "a", 60, async () => "value"), "value");
  assert.deepEqual(commands.map(c => c[0]), ["GET", "SET", "GET", "SET", "EVAL"]);
  assert.deepEqual(commands[1].slice(3), ["NX", "PX", 30000]);
  assert.ok(String(commands[4][1]).includes("1100"));
});
test("Redis outage never falls back to unthrottled upstream calls", async () => {
  local(); process.env.VERCEL = "1"; process.env.APP_USER_AGENT = "test";
  process.env.UPSTASH_REDIS_REST_URL = "https://redis.test"; process.env.UPSTASH_REDIS_REST_TOKEN = "test";
  let called = false; globalThis.fetch = async () => { throw new Error("offline"); };
  await assert.rejects(cachedProvider("test-offline", "a", 60, async () => { called = true; return []; }), ServiceError);
  assert.equal(called, false);
});
test("search validates query and normalizes actual Nominatim results", async () => {
  local();
  assert.equal((await search(new Request("https://app.test/api/search?q=a"))).status, 400);
  process.env.NOMINATIM_BASE_URL = "https://search-contract.test";
  globalThis.fetch = async (url, init) => {
    const query = new URL(String(url));
    assert.equal(query.searchParams.get("q"), "서울역");
    assert.equal(query.searchParams.get("accept-language"), "ko,en");
    assert.ok(new Headers(init?.headers).get("user-agent")?.includes("BetweenDistance"));
    return Response.json([{ lat: "37.55", lon: "126.97", name: "서울역", display_name: "서울역, 서울특별시, 대한민국", osm_type: "node", osm_id: 1 }, { lat: "bad", lon: "127", display_name: "invalid" }]);
  };
  const response = await search(new Request("https://app.test/api/search?q=서울역"));
  assert.equal(response.status, 200);
  const data = await response.json(); assert.equal(data.places.length, 1); assert.equal(data.places[0].lat, 37.55);
});
test("route rejects missing or blank coordinates rather than converting them to zero", async () => {
  assert.equal((await route(new Request("https://app.test/api/route"))).status, 400);
  assert.equal((await route(new Request("https://app.test/api/route?fromLat=&fromLon=0&toLat=0&toLon=0"))).status, 400);
});
test("road route returns OSRM distance with longitude-first requests", async () => {
  local(); process.env.OSRM_BASE_URL = "https://route-contract.test/routed-car";
  globalThis.fetch = async url => {
    assert.ok(String(url).includes("127,37;129,35"));
    return Response.json({ code: "Ok", routes: [{ distance: 410000, duration: 16000, geometry: { coordinates: [[127, 37], [129, 35]] } }] });
  };
  const response = await route(new Request("https://app.test/api/route?fromLat=37&fromLon=127&toLat=35&toLon=129"));
  assert.equal(response.status, 200); assert.equal((await response.json()).distance, 410000);
});
test("NoRoute stays an error and never silently becomes straight distance", async () => {
  local(); process.env.OSRM_BASE_URL = "https://route-no-route.test";
  globalThis.fetch = async () => Response.json({ code: "NoRoute" });
  const response = await route(new Request("https://app.test/api/route?fromLat=37&fromLon=127&toLat=0&toLon=0"));
  assert.equal(response.status, 422); assert.ok((await response.json()).error.includes("직선거리"));
});
