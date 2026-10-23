import type { Place } from "@/lib/distance";

type Props = { from: Place | null; to: Place | null; coordinates?: [number, number][] };

export default function RouteSketch({ from, to, coordinates }: Props) {
  let path = "M110 290 C200 290 165 190 250 190 S315 110 390 110";
  let a = [110, 290]; let b = [390, 110];
  if (from && to) {
    const points = coordinates?.length ? coordinates : [[from.lon, from.lat], [to.lon, to.lat]];
    const xs = points.map(p => p[0]); const ys = points.map(p => p[1]);
    const minX = Math.min(...xs), maxY = Math.max(...ys);
    const scale = Math.min(300 / (Math.max(...xs) - minX || 0.01), 205 / (maxY - Math.min(...ys) || 0.01));
    const width = (Math.max(...xs) - minX) * scale, height = (maxY - Math.min(...ys)) * scale;
    const projected = points.map(p => [(500 - width) / 2 + (p[0] - minX) * scale, (400 - height) / 2 + (maxY - p[1]) * scale]);
    path = projected.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ");
    a = projected[0]; b = projected[projected.length - 1];
  }
  return <svg className="route-sketch" viewBox="0 0 500 400" role="img" aria-label={from && to ? `${from.name}에서 ${to.name}까지의 경로 개요` : "출발지와 도착지를 잇는 선 그림"}>
    <defs><pattern id="dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#aab7a3" opacity=".38" /></pattern></defs>
    <rect width="500" height="400" fill="url(#dots)" />
    <ellipse cx="265" cy="206" rx="180" ry="145" fill="#e4ebd8" opacity=".5" />
    <ellipse cx="265" cy="206" rx="138" ry="108" stroke="#cad7bd" strokeWidth="1" fill="none" strokeDasharray="5 9" />
    <path d={path} stroke="#e7eedf" strokeWidth="17" fill="none" strokeLinecap="round" />
    <path d={path} stroke="#547752" strokeWidth="3" strokeDasharray={coordinates ? undefined : "6 7"} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx={a[0]} cy={a[1]} r="16" fill="#fff" stroke="#547752" strokeWidth="2" /><circle cx={a[0]} cy={a[1]} r="5" fill="#547752" />
    <circle cx={b[0]} cy={b[1]} r="21" fill="#254e3d" /><text x={b[0]} y={b[1] + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">B</text>
    <g transform={`translate(${a[0] - 34},${a[1] + 28})`}><rect width="68" height="29" rx="7" fill="white" /><text x="34" y="19" textAnchor="middle" fontSize="12" fill="#405443">출발지</text></g>
    <g transform={`translate(${b[0] - 34},${b[1] - 57})`}><rect width="68" height="29" rx="7" fill="white" /><text x="34" y="19" textAnchor="middle" fontSize="12" fill="#405443">도착지</text></g>
  </svg>;
}
