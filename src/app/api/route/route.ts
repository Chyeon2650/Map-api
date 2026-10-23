import { cachedProvider, errorResponse, providerBase, providerHeaders, ServiceError } from "@/lib/providers";
import { isPoint, type RouteResult } from "@/lib/distance";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const read = (key: string) => params.get(key)?.trim() ? Number(params.get(key)) : NaN;
  const from = { lat: read("fromLat"), lon: read("fromLon") };
  const to = { lat: read("toLat"), lon: read("toLon") };
  if (!isPoint(from) || !isPoint(to)) return Response.json({ error: "올바른 출발지와 도착지를 선택해 주세요." }, { status: 400 });
  try {
    const base = providerBase("osrm");
    const coords = `${from.lon},${from.lat};${to.lon},${to.lat}`;
    const route = await cachedProvider(new URL(base).host, `${base}:${coords}`, 3600, async (): Promise<RouteResult> => {
      const response = await fetch(`${base}/route/v1/driving/${coords}?overview=simplified&geometries=geojson&steps=false&radiuses=1000;1000`, {
        headers: providerHeaders(), cache: "no-store", signal: AbortSignal.timeout(8000),
      });
      const data = await response.json();
      if (data.code === "NoRoute" || data.code === "NoSegment") {
        throw new ServiceError("두 장소를 잇는 자동차 경로를 찾지 못했어요. 가까운 도로의 장소를 선택하거나 직선거리로 확인해 주세요.", 422);
      }
      if (!response.ok || data.code !== "Ok") throw new ServiceError("도로 경로를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.", response.status === 429 ? 429 : 502);
      const result = data.routes?.[0];
      if (!result || !Number.isFinite(result.distance) || result.distance < 0 || !Number.isFinite(result.duration) || result.duration < 0
        || !Array.isArray(result.geometry?.coordinates) || result.geometry.coordinates.length < 2
        || !result.geometry.coordinates.every((p: unknown) => Array.isArray(p) && isPoint({ lon: p[0], lat: p[1] }))) {
        throw new ServiceError("경로 데이터가 올바르지 않아요. 다시 시도해 주세요.", 502);
      }
      return { distance: result.distance, duration: result.duration, coordinates: result.geometry.coordinates };
    });
    return Response.json(route, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
