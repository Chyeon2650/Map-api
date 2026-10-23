"use client";

import { useRef, useState } from "react";
import { ArrowDownUp, ArrowRight, ArrowUpRight, CarFront, Check, Compass, ExternalLink, Leaf, LoaderCircle, Map, MoveUpRight, Navigation, Route, Ruler, Search } from "lucide-react";
import PlaceSearch, { type Field } from "@/components/place-search";
import RouteSketch from "@/components/route-sketch";
import { formatDistance, formatDuration, mapUrl, straightDistance, type Mode, type Place, type RouteResult } from "@/lib/distance";

type Result = { from: Place; to: Place; mode: Mode; distance: number; route?: RouteResult };
const empty = (): Field => ({ query: "", place: null });

export default function Home() {
  const [from, setFrom] = useState<Field>(empty);
  const [to, setTo] = useState<Field>(empty);
  const [mode, setMode] = useState<Mode>("driving");
  const [searching, setSearching] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  function invalidate() { controller.current?.abort(); setResult(null); setError(""); }
  function changeMode(next: Mode) { if (mode !== next) { invalidate(); setMode(next); } }
  async function calculate() {
    if (!from.place || !to.place || calculating) return;
    const a = from.place, b = to.place;
    invalidate();
    const abort = new AbortController(); controller.current = abort;
    setCalculating(true);
    try {
      let route: RouteResult | undefined;
      if (mode === "driving") {
        const params = new URLSearchParams({ fromLat: String(a.lat), fromLon: String(a.lon), toLat: String(b.lat), toLon: String(b.lon) });
        const response = await fetch(`/api/route?${params}`, { signal: abort.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "거리 계산에 실패했어요.");
        route = data;
      }
      if (!abort.signal.aborted) {
        setResult({ from: a, to: b, mode, distance: route ? route.distance : straightDistance(a, b), route });
        requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
      }
    } catch (cause) {
      if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : "거리를 계산하지 못했어요. 다시 시도해 주세요.");
    } finally { setCalculating(false); }
  }
  const distance = result ? formatDistance(result.distance) : null;
  const locked = searching || calculating;

  return <>
    <header className="site-header"><a className="brand" href="/" aria-label="사이 홈"><span className="brand-mark"><Route size={23} strokeWidth={2} /></span><strong>사이<span className="brand-period">.</span></strong><span className="brand-description">두 장소를 잇는 가장 쉬운 방법</span></a><a className="header-link" href="https://www.openstreetmap.org" target="_blank" rel="noopener noreferrer">OpenStreetMap 기반<ArrowUpRight size={14} /></a></header>
    <main>
      <section className="intro"><span className="eyebrow"><span /> A LITTLE CLOSER, TOGETHER</span><h1>여기서 저기까지,<br className="mobile-break" /> 얼마나 될까요<span>?</span></h1><p>떠나기 전, 두 장소 사이의 거리를 간편하게 확인하세요.</p></section>
      <div className="workspace">
        <section className="calculator" aria-labelledby="calculator-heading">
          <div className="card-heading"><div className="card-icon"><Navigation size={19} /></div><div><h2 id="calculator-heading">거리 측정</h2><p>출발지와 도착지를 알려 주세요.</p></div><span className="step-badge">01 — 02</span></div>
          <div className="place-fields">
            <PlaceSearch kind="from" value={from} onChange={value => { invalidate(); setFrom(value); }} searching={searching} onBusy={setSearching} disabled={calculating} />
            <div className="swap-row"><span /><button type="button" aria-label="출발지와 도착지 바꾸기" title="출발지와 도착지 바꾸기" disabled={locked || (!from.query && !to.query)} onClick={() => { invalidate(); setFrom(to); setTo(from); }}><ArrowDownUp size={17} /></button></div>
            <PlaceSearch kind="to" value={to} onChange={value => { invalidate(); setTo(value); }} searching={searching} onBusy={setSearching} disabled={calculating} />
          </div>
          <fieldset className="mode-picker" disabled={calculating}><legend>어떤 거리가 궁금하세요?</legend><div className="mode-options"><button type="button" aria-pressed={mode === "driving"} className={mode === "driving" ? "active" : ""} onClick={() => changeMode("driving")}><CarFront size={17} />자동차 거리{mode === "driving" && <Check size={14} />}</button><button type="button" aria-pressed={mode === "straight"} className={mode === "straight" ? "active" : ""} onClick={() => changeMode("straight")}><MoveUpRight size={17} />직선거리{mode === "straight" && <Check size={14} />}</button></div></fieldset>
          <button className="calculate-button" type="button" disabled={!from.place || !to.place || locked} onClick={() => void calculate()}>{calculating ? <><LoaderCircle size={18} className="spin" />거리를 계산하고 있어요</> : <>거리 계산하기<ArrowRight size={19} /></>}</button>
          <p className="button-hint">{from.place && to.place ? "두 장소가 선택되었어요. 거리를 확인해 보세요." : "각 장소를 검색한 후 결과에서 선택해 주세요."}</p>
          {error && <div className="calculation-error" role="alert">{error}</div>}
        </section>
        <section className={`overview ${result ? "has-result" : ""}`} aria-label="거리 측정 결과">
          <div className="overview-top"><span><Map size={15} /> YOUR NEXT JOURNEY</span><span className="live-badge"><span />{result ? "측정 완료" : "경로 개요"}</span></div>
          {result && distance ? <div ref={resultRef} className="result-content" aria-live="polite"><p className="result-label">{result.mode === "driving" ? "자동차 경로 기준" : "두 지점 간 직선 기준"} 총거리</p><div className="distance-number">{distance.value}<span>{distance.unit}</span></div>{result.route && <p className="duration"><CarFront size={16} />예상 {formatDuration(result.route.duration)}<span>· 실시간 교통 미반영</span></p>}<div className="result-places"><span>{result.from.name}</span><ArrowRight size={14} /><span>{result.to.name}</span></div><a className="map-link" href={mapUrl(result.from, result.to, result.mode)} target="_blank" rel="noopener noreferrer"><Map size={17} />지도에서 보기<ExternalLink size={15} /></a><p className="map-link-hint">{result.mode === "driving" ? "OpenStreetMap에서 자동차 경로가 열립니다." : "OpenStreetMap에서 두 장소가 포함된 영역이 열립니다."}</p></div>
            : <div className="empty-content"><div className="empty-icon"><Compass size={25} strokeWidth={1.5} /></div><h2>모든 여정은<br />두 장소에서 시작되니까.</h2><p>출발지와 도착지를 선택하면<br />그 사이의 거리를 알려드릴게요.</p></div>}
          <div className={`sketch-wrap ${result ? "compact" : ""}`}><RouteSketch from={from.place} to={to.place} coordinates={result?.route?.coordinates} /></div>
          <div className="overview-bottom"><span><span className="point-dot from" />출발</span><span className="legend-line" /><span><span className="point-dot to" />도착</span><small>경로 개요 · 실제 지도는 링크에서 확인</small></div>
        </section>
      </div>
      <div className="feature-strip"><div><span className="feature-icon"><Search size={18} /></span><p><strong>실제 장소 검색</strong><span>장소명과 주소로 정확하게</span></p></div><div><span className="feature-icon"><Ruler size={18} /></span><p><strong>원하는 방식으로 측정</strong><span>자동차 경로 또는 직선거리</span></p></div><div><span className="feature-icon"><Map size={18} /></span><p><strong>지도까지 한 번에</strong><span>거리 확인 후 바로 지도 보기</span></p></div></div>
      <aside className="info-note"><Leaf size={16} /><p>OpenStreetMap의 열린 지도 데이터로 함께합니다. 검색 결과는 지도에 등록된 장소를 기준으로 하며, 자동차 거리는 도로 데이터에 따라 실제 주행과 다를 수 있어요.</p></aside>
      <details className="privacy-note"><summary>검색 및 거리 계산 안내</summary><p>검색어는 장소 조회를 위해 Nominatim에, 자동차 경로의 좌표는 FOSSGIS OSRM에 전달됩니다. 민감한 개인정보는 입력하지 마세요. 장소 검색은 버튼을 누를 때만 실행됩니다. 직선거리는 브라우저에서 계산하며 실제 이동거리와 다릅니다. 결과는 서버에서 일시적으로 캐시됩니다.</p></details>
    </main>
    <footer><span className="footer-brand">사이. <small>가고 싶은 곳이 조금 더 가까워지도록.</small></span><span className="credits">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a><span>·</span><a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener noreferrer">OSRM / FOSSGIS</a><span>·</span><a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noopener noreferrer">지도 수정</a></span></footer>
  </>;
}
