export type Point = { lat: number; lon: number };
export type Place = Point & { id: string; name: string; address: string };
export type RouteResult = { distance: number; duration: number; coordinates: [number, number][] };
export type Mode = "driving" | "straight";

export function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== "object") return false;
  const point = value as Point;
  return typeof point.lat === "number" && Number.isFinite(point.lat) && Math.abs(point.lat) <= 90
    && typeof point.lon === "number" && Number.isFinite(point.lon) && Math.abs(point.lon) <= 180;
}

export function straightDistance(a: Point, b: Point): number {
  const rad = (v: number) => v * Math.PI / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2
    + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 6371008.8 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, h))));
}

export function formatDistance(meters: number): { value: string; unit: string } {
  return meters < 1000
    ? { value: Math.round(meters).toLocaleString("ko-KR"), unit: "m" }
    : { value: (meters / 1000).toLocaleString("ko-KR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }), unit: "km" };
}

export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}시간${minutes % 60 ? ` ${minutes % 60}분` : ""}` : `${minutes}분`;
}

export function mapUrl(a: Point, b: Point, mode: Mode): string {
  if (mode === "driving") {
    return `https://www.openstreetmap.org/directions?${new URLSearchParams({ engine: "fossgis_osrm_car", route: `${a.lat},${a.lon};${b.lat},${b.lon}` })}`;
  }
  // OSM's export view fits the bounding box of both points. It does not draw a straight line.
  const pad = 0.005;
  return `https://www.openstreetmap.org/?${new URLSearchParams({ bbox: `${Math.max(-180, Math.min(a.lon, b.lon) - pad)},${Math.max(-90, Math.min(a.lat, b.lat) - pad)},${Math.min(180, Math.max(a.lon, b.lon) + pad)},${Math.min(90, Math.max(a.lat, b.lat) + pad)}`, mlat: String(a.lat), mlon: String(a.lon) })}`;
}
