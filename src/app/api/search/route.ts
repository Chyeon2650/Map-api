import { cachedProvider, errorResponse, providerBase, providerHeaders, ServiceError } from "@/lib/providers";
import { isPoint, type Place } from "@/lib/distance";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim().replace(/\s+/g, " ") || "";
  if (q.length < 2 || q.length > 120) return Response.json({ error: "장소명이나 주소를 2~120자로 입력해 주세요." }, { status: 400 });
  try {
    const base = providerBase("nominatim");
    const places = await cachedProvider(new URL(base).host, `${base}:ko:${q.toLocaleLowerCase("ko-KR")}`, 86400, async () => {
      const params = new URLSearchParams({ q, format: "jsonv2", limit: "5", "accept-language": "ko,en", addressdetails: "1" });
      const response = await fetch(`${base}/search?${params}`, {
        headers: providerHeaders(), signal: AbortSignal.timeout(8000), cache: "no-store",
      });
      if (!response.ok) throw new ServiceError("장소 검색 서버가 응답하지 않아요. 잠시 후 다시 검색해 주세요.", response.status === 429 ? 429 : 502);
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new ServiceError("검색 결과를 읽지 못했어요. 다시 검색해 주세요.", 502);
      return data.flatMap((item): Place[] => {
        if (!item || typeof item !== "object") return [];
        const point = { lat: Number(item.lat), lon: Number(item.lon) };
        if (item.lat == null || item.lon == null || !isPoint(point) || typeof item.display_name !== "string") return [];
        return [{ ...point, id: `${item.osm_type || "place"}:${item.osm_id || item.place_id}`, name: item.name || item.display_name.split(",")[0], address: item.display_name }];
      });
    });
    return Response.json({ places }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return errorResponse(error); }
}
