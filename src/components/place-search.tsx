"use client";

import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, MapPin, Search, X } from "lucide-react";
import type { Place } from "@/lib/distance";

export type Field = { query: string; place: Place | null };
type Props = { kind: "from" | "to"; value: Field; onChange: (field: Field) => void; searching: boolean; onBusy: (busy: boolean) => void; disabled: boolean };

export default function PlaceSearch({ kind, value, onChange, searching, onBusy, disabled }: Props) {
  const [results, setResults] = useState<Place[] | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const version = useRef(0);
  const input = useRef<HTMLInputElement>(null);
  const title = kind === "from" ? "출발지" : "도착지";

  useEffect(() => {
    setResults(null); setError("");
    version.current++;
    controller.current?.abort();
  }, [value.query, value.place]);
  useEffect(() => () => controller.current?.abort(), []);

  async function search() {
    if (searching || disabled || value.query.trim().length < 2) return;
    const ticket = ++version.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setLoading(true); onBusy(true); setError(""); setResults(null);
    try {
      const response = await fetch(`/api/search?${new URLSearchParams({ q: value.query.trim() })}`, { signal: abort.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "검색에 실패했어요. 다시 시도해 주세요.");
      if (ticket === version.current) setResults(data.places);
    } catch (cause) {
      if (!abort.signal.aborted && ticket === version.current) setError(cause instanceof Error ? cause.message : "검색 중 오류가 발생했어요.");
    } finally { setLoading(false); onBusy(false); }
  }

  return <section className={`place-field ${value.place ? "is-selected" : ""}`} aria-labelledby={`${kind}-label`}>
    <div className="field-label"><span className={`point-dot ${kind}`} /><label id={`${kind}-label`} htmlFor={`${kind}-input`}>{title}</label>{value.place && <span className="verified"><Check size={12} /> 선택 완료</span>}</div>
    <div className="input-row">
      <input ref={input} id={`${kind}-input`} value={value.query} maxLength={120} autoComplete="off" spellCheck={false}
        placeholder={kind === "from" ? "어디에서 출발하나요?" : "어디로 가시나요?"}
        disabled={disabled} aria-describedby={`${kind}-hint`} aria-invalid={Boolean(error)}
        onChange={(event) => onChange({ query: event.target.value, place: null })}
        onKeyDown={(event) => { if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); void search(); } if (event.key === "Escape") setResults(null); }} />
      {value.query && <button className="clear-button" type="button" disabled={disabled || loading} aria-label={`${title} 지우기`} onClick={() => { onChange({ query: "", place: null }); input.current?.focus(); }}><X size={16} /></button>}
      <button className="search-button" type="button" aria-label={`${title} 검색`} disabled={disabled || searching || value.query.trim().length < 2} onClick={() => void search()}>{loading ? <LoaderCircle size={17} className="spin" /> : <Search size={17} />}<span>검색</span></button>
    </div>
    <p id={`${kind}-hint`} className={`field-hint ${value.place ? "selected-address" : ""}`}>{value.place ? value.place.address : "장소명 또는 주소를 입력한 뒤 검색해 주세요."}</p>
    <div aria-live="polite">
      {error && <p className="field-error" role="alert">{error}</p>}
      {results && <div className="search-results"><p className="results-heading">{results.length ? `검색 결과 ${results.length}개 · 장소를 선택해 주세요` : "검색 결과가 없어요. 지역명이나 주소를 함께 입력해 보세요."}</p>
        {results.map(place => <button type="button" className="place-result" key={place.id} onClick={() => { setResults(null); onChange({ query: place.name, place }); }}><MapPin size={17} /><span><strong>{place.name}</strong><small>{place.address}</small></span><span className="select-label">선택</span></button>)}
      </div>}
    </div>
  </section>;
}
