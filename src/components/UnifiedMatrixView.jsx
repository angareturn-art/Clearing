import React, { useMemo, useState, useRef, useEffect } from 'react';

const C = {
  oilLast:    { bg: '#C2410C', text: '#fff',     label: '기름칠 최전선' },
  oilDone:    { bg: '#EA580C', text: '#fff',     label: '기름칠 완료' },
  c1Full:     { bg: '#0EA5E9', text: '#fff',     label: '1차 완료' },
  c2Unsigned: { bg: '#84CC16', text: '#1a2e05',  label: '2차 서명대기' },
  c2Signed:   { bg: '#15803D', text: '#fff',     label: '2차 서명완료' },
  ulLast:     { bg: '#6D28D9', text: '#fff',     label: '하역 최전선' },
  ulDone:     { bg: '#8B5CF6', text: '#fff',     label: '하역 완료' },
  etcLast:    { bg: '#B45309', text: '#fff',     label: '기타 최전선' },
  etcDone:    { bg: '#D97706', text: '#fff',     label: '기타 완료' },
  empty:      { bg: '#F1F5F9', text: '#94A3B8',  label: '미작업' },
  above:      { bg: '#FFFFFF', text: '#CBD5E1',  label: '' },
};
const BASELINE_COLOR = '#EF4444';

const TABS = [
  { id: 'unified',   label: '통합' },
  { id: 'oiling',    label: '기름칠' },
  { id: 'clean1',    label: '1차' },
  { id: 'clean2',    label: '2차' },
  { id: 'unloading', label: '하역' },
];

// 통합을 제외한, 다중 선택(토글) 가능한 공정 카테고리 (모바일 매트릭스와 동일한 상호작용)
const CATEGORY_IDS = ['oiling', 'clean1', 'clean2', 'unloading'];

const LEGEND = [
  C.oilLast, C.oilDone, C.c1Full,
  C.c2Unsigned, C.c2Signed,
  C.ulLast, C.ulDone,
  C.etcLast, C.etcDone,
  { ...C.empty, label: '미작업', border: '#CBD5E1' },
];

const fmtDate = (d) => (d ? d.slice(5).replace('-', '/') : '');

export default function UnifiedMatrixView({ buildings, summary }) {
  // 빈 Set = 통합(전체 우선순위 표시). 하나 이상 담기면 그 카테고리들만 겹쳐서 표시(모바일 매트릭스와 동일).
  const [selectedCats, setSelectedCats] = useState(new Set());
  const [displayMode, setDisplayMode] = useState('date');
  const scrollRef = useRef(null);

  const isUnified = selectedCats.size === 0;
  const effectiveCats = isUnified ? new Set(CATEGORY_IDS) : selectedCats;

  // 통합을 누르면 다중 선택 해제. 카테고리 버튼은 토글(다시 누르면 해제), 전부 해제되면 자동으로 통합으로 복귀.
  const handleTabPress = (id) => {
    if (id === 'unified') {
      setSelectedCats(new Set());
      return;
    }
    setSelectedCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ── 층별 세대수 정밀 계산 (start_floor 고려)
  const floorUnitsMap = useMemo(() => {
    const map = {};
    buildings.forEach(b => {
      const maxF = Math.max(...b.houses.map(h => h.floors || 0), 0);
      map[b.id] = {};
      for (let f = 1; f <= maxF; f++) {
        map[b.id][f] = b.houses.filter(h => {
          const sf = h.start_floor || 1;
          return sf <= f && f <= (h.floors || 0);
        }).length;
      }
    });
    return map;
  }, [buildings]);

  // ── 동별 공정 최고층 · 날짜 맵
  const bldStats = useMemo(() => {
    const stats = {};
    buildings.forEach(b => {
      stats[b.id] = {
        oiling: 0, clean1: 0, clean2: 0, clean2s: 0, unloading: 0, etc: 0,
        oilDate: {}, c1Date: {}, c2Date: {}, c2sDate: {}, ulDate: {}, etDate: {},
        ulCount: {}, c1Count: {}, c2Count: {}, c2sCount: {},
      };
    });

    (summary.oiling || []).forEach(r => {
      const s = stats[Number(r.building_id)]; if (!s) return;
      const f = Number(r.floor);
      if (f > s.oiling) s.oiling = f;
      if (r.date && (!s.oilDate[f] || r.date > s.oilDate[f])) s.oilDate[f] = r.date;
    });

    (summary.cleaning || []).forEach(r => {
      const s = stats[Number(r.building_id)]; if (!s) return;
      const f = Number(r.floor);
      if (r.phase === 9) {
        if (f > s.etc) s.etc = f;
        if (r.date && (!s.etDate[f] || r.date > s.etDate[f])) s.etDate[f] = r.date;
        return;
      }
      if (r.phase === 1 || r.phase == null) {
        if (f > s.clean1) s.clean1 = f;
        if (r.date && (!s.c1Date[f] || r.date > s.c1Date[f])) s.c1Date[f] = r.date;
        if (!s.c1Count[f]) s.c1Count[f] = new Set();
        if (r.house_id) s.c1Count[f].add(Number(r.house_id));
        else            s.c1Count[f].add('_' + r.date);
      } else if (r.phase === 2) {
        if (f > s.clean2) s.clean2 = f;
        if (r.date && (!s.c2Date[f] || r.date > s.c2Date[f])) s.c2Date[f] = r.date;
        if (!s.c2Count[f]) s.c2Count[f] = new Set();
        if (r.house_id) s.c2Count[f].add(Number(r.house_id));
        else            s.c2Count[f].add('_' + r.date);
        if (r.confirmed === 1) {
          if (f > s.clean2s) s.clean2s = f;
          const sd = r.sign_date || r.date;
          if (sd && (!s.c2sDate[f] || sd > s.c2sDate[f])) s.c2sDate[f] = sd;
          if (!s.c2sCount[f]) s.c2sCount[f] = new Set();
          if (r.house_id) s.c2sCount[f].add(Number(r.house_id));
          else            s.c2sCount[f].add('_' + sd);
        }
      }
    });

    (summary.unloading || []).forEach(r => {
      const s = stats[Number(r.building_id)]; if (!s) return;
      const f = Number(r.floor);
      if (f > s.unloading) s.unloading = f;
      if (r.date && (!s.ulDate[f] || r.date > s.ulDate[f])) s.ulDate[f] = r.date;
      if (!s.ulCount[f]) s.ulCount[f] = new Set();
      if (r.house_id) s.ulCount[f].add(Number(r.house_id));
      else            s.ulCount[f].add('_' + r.date);
    });

    return stats;
  }, [buildings, summary]);

  const maxFloor = useMemo(() =>
    Math.max(...buildings.map(b => Math.max(...b.houses.map(h => h.floors || 0), 0)), 1),
    [buildings]
  );

  const floors = useMemo(() =>
    Array.from({ length: maxFloor }, (_, i) => maxFloor - i),
    [maxFloor]
  );

  // ── 자동 스크롤: 작업 최전선 층으로
  useEffect(() => {
    if (!buildings.length || !scrollRef.current) return;
    const maxActive = Math.max(
      0,
      ...buildings.map(b => {
        const s = bldStats[b.id] || {};
        return Math.max(s.oiling || 0, s.clean1 || 0, s.clean2 || 0, s.unloading || 0);
      })
    );
    if (maxActive > 0 && maxFloor > maxActive + 2) {
      const rowH = 28;
      const targetRow = maxFloor - maxActive;
      const scrollTop = Math.max(0, (targetRow - 4) * rowH);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollTop, behavior: 'smooth' });
      }, 350);
    }
  }, [buildings, bldStats, maxFloor]);

  const getCell = (b, floor, cats) => {
    const s = bldStats[b.id];
    if (!s) return { color: C.empty, txt: '' };

    const units = (floorUnitsMap[b.id] && floorUnitsMap[b.id][floor]) || 0;
    const bMaxFloor = Math.max(...b.houses.map(h => h.floors || 0), 0);
    if (floor > bMaxFloor) return { color: C.above, txt: '' };
    if (units === 0) return { color: C.above, txt: '' };

    const oiled      = floor <= s.oiling;
    const isOilLast  = floor === s.oiling && s.oiling > 0;
    const hasET      = floor <= s.etc;
    const isETLast   = floor === s.etc && s.etc > 0;

    // 1차 청소 — 세대별 완료 수
    const c1DoneCount  = s.c1Count?.[floor]?.size || 0;
    const isC1Full     = units > 0 && c1DoneCount >= units;
    const hasAnyC1     = c1DoneCount > 0;

    // 2차 청소 — 세대별 완료 수 (청소 / 서명)
    const c2DoneCount  = s.c2Count?.[floor]?.size  || 0;
    const c2sDoneCount = s.c2sCount?.[floor]?.size || 0;
    const isC2Full     = units > 0 && c2DoneCount  >= units;
    const isC2SFull    = units > 0 && c2sDoneCount >= units;
    const hasAnyC2     = c2DoneCount  > 0;
    const hasAnyC2S    = c2sDoneCount > 0;

    // 하역 — 세대별 완료 수
    const ulDoneCount  = s.ulCount?.[floor]?.size || 0;
    const isULFull     = units > 0 && ulDoneCount >= units;
    const hasAnyUL     = ulDoneCount > 0;
    const isULast      = floor === s.unloading && s.unloading > 0;

    // 카테고리를 하나만 선택했을 때는 기존 단독 탭과 동일하게 그 공정 전용 기준층을 보여준다.
    // 두 개 이상(통합 포함) 선택 시에는 청소 기준층(기성 기준선)을 보여준다.
    const singleCat = cats.size === 1 ? [...cats][0] : null;
    const base =
      singleCat === 'oiling'    ? (b.oiling_base_floor    || 0) :
      singleCat === 'unloading' ? (b.unloading_base_floor || 0) :
      (b.cleaning_base_floor || 0);
    const isBaseline = floor === base + 1 && base > 0;

    // 우선순위: 하역 > 2차서명 > 2차미서명 > 1차 > 기름칠 > 기타(선택된 카테고리만 대상으로 판정).
    // 기타는 전용 토글 버튼이 없어 통합(전체 선택) 상태에서만 낮은 우선순위로 표시한다.
    let color    = C.empty;
    let dateVal  = '';
    let ratioTxt = '';  // 부분 완료 시 "X/Y" 형식

    if      (cats.has('unloading') && hasAnyUL && isULFull && isULast) { color = C.ulLast;     dateVal  = fmtDate(s.ulDate[floor]); }
    else if (cats.has('unloading') && hasAnyUL && isULFull)            { color = C.ulDone;     dateVal  = fmtDate(s.ulDate[floor]); }
    else if (cats.has('unloading') && hasAnyUL)                        { color = C.ulDone;     ratioTxt = `${ulDoneCount}/${units}`; }
    else if (cats.has('clean2')    && hasAnyC2S && isC2SFull)          { color = C.c2Signed;   dateVal  = fmtDate(s.c2sDate[floor]); }
    else if (cats.has('clean2')    && hasAnyC2  && isC2Full)           { color = C.c2Unsigned; ratioTxt = `${c2sDoneCount}/${units}`; }
    else if (cats.has('clean2')    && hasAnyC2)                        { color = C.c2Unsigned; ratioTxt = `${c2DoneCount}/${units}`; }
    else if (cats.has('clean1')    && hasAnyC1  && isC1Full)           { color = C.c1Full;     dateVal  = fmtDate(s.c1Date[floor]); }
    else if (cats.has('clean1')    && hasAnyC1)                        { color = C.c1Full;     ratioTxt = `${c1DoneCount}/${units}`; }
    else if (cats.has('oiling')    && isOilLast)                       { color = C.oilLast;    dateVal  = fmtDate(s.oilDate[floor]); }
    else if (cats.has('oiling')    && oiled)                           { color = C.oilDone;    dateVal  = fmtDate(s.oilDate[floor]); }
    else if (isUnified && isETLast)                                    { color = C.etcLast;    dateVal  = fmtDate(s.etDate[floor]); }
    else if (isUnified && hasET)                                       { color = C.etcDone;    dateVal  = fmtDate(s.etDate[floor]); }

    const isEmpty = color === C.empty;
    let txt = '';
    if (displayMode === 'date') {
      if (isEmpty)       txt = String(units);
      else if (ratioTxt) txt = ratioTxt;
      else               txt = dateVal || String(units);
    } else {
      txt = ratioTxt || String(units);
    }

    return { color, txt, isBaseline };
  };

  if (!buildings.length) return (
    <p className="text-center py-16 text-on-surface-variant">건물 데이터가 없습니다.</p>
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-300">

      {/* ── 헤더 ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-lg">view_comfy_alt</span>
          </div>
          <div>
            <h3 className="font-headline font-black text-xl text-primary leading-tight">통합 현황</h3>
            <p className="text-[10px] text-on-surface-variant font-label">전체 공정 우선순위 통합</p>
          </div>
        </div>

        {/* 날짜/세대 토글 */}
        <div className="flex bg-surface-container p-1 rounded-xl gap-0.5">
          {[{ v: 'date', label: '날짜' }, { v: 'units', label: '세대' }].map(opt => (
            <button
              key={opt.v}
              onClick={() => setDisplayMode(opt.v)}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-all ${
                displayMode === opt.v
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-on-surface-variant hover:bg-surface-container-high'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 탭 (다중 선택 토글: 통합은 해제, 나머지는 여러 개 동시 선택 가능) ── */}
      <div className="flex border-b-2 border-outline-variant/20">
        {TABS.map(tab => {
          const active = tab.id === 'unified' ? isUnified : selectedCats.has(tab.id);
          return (
            <button
              key={tab.id}
              onClick={() => handleTabPress(tab.id)}
              className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider border-b-2 -mb-[2px] transition-all ${
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── 범례 ── */}
      <div className="flex flex-wrap gap-2">
        {LEGEND.map(item => (
          <div key={item.label}
            className="flex items-center gap-1.5 bg-surface-container-lowest rounded-lg px-2.5 py-1.5 border border-outline-variant/20 shadow-sm"
          >
            <span className="w-3.5 h-3.5 rounded flex-shrink-0"
              style={{
                backgroundColor: item.bg,
                outline: item.border ? `1.5px solid ${item.border}` : 'none',
                outlineOffset: '1px',
              }}
            />
            <span className="text-[10px] font-bold text-on-surface">{item.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5 bg-surface-container-lowest rounded-lg px-2.5 py-1.5 border border-outline-variant/20 shadow-sm">
          <span className="w-3.5 h-3.5 rounded flex-shrink-0"
            style={{ backgroundColor: C.empty.bg, borderBottom: `3px solid ${BASELINE_COLOR}` }} />
          <span className="text-[10px] font-bold text-on-surface">기성기준선</span>
        </div>
      </div>

      {/* ── 매트릭스 ── */}
      <div className="rounded-2xl shadow-lg border border-outline-variant/30 overflow-hidden bg-white">
        <div ref={scrollRef} className="overflow-x-auto overflow-y-auto" style={{ maxHeight: '72vh' }}>
          <table className="border-collapse min-w-max" style={{ tableLayout: 'fixed' }}>

            {/* 건물 헤더 */}
            <thead className="sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 z-30 bg-slate-800 p-0" style={{ width: 36, minWidth: 36 }}>
                  <div className="h-12 flex items-center justify-center">
                    <span className="text-[10px] text-white/50 font-black">층</span>
                  </div>
                </th>
                {buildings.map(b => {
                  const s = bldStats[b.id] || {};
                  const topColor =
                    s.unloading > 0 ? C.ulDone.bg :
                    s.clean2s > 0   ? C.c2Signed.bg :
                    s.clean2 > 0    ? C.c2Unsigned.bg :
                    s.clean1 > 0    ? C.c1Full.bg :
                    s.oiling > 0    ? C.oilDone.bg : '#475569';
                  return (
                    <th key={b.id} className="p-0 bg-slate-800 border-l border-white/10"
                      style={{ width: 48, minWidth: 48 }}>
                      <div className="h-12 flex flex-col items-center justify-center gap-0.5 px-1">
                        <div className="w-full h-[3px] rounded-full mb-1" style={{ backgroundColor: topColor }} />
                        <span className="text-white font-black text-[11px] leading-none">
                          {b.name.replace('동', '')}동
                        </span>
                        <span className="text-white/40 text-[9px] font-medium leading-none">
                          {b.houses.length}H
                        </span>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            {/* 층별 행 */}
            <tbody>
              {floors.map((floor, rowIdx) => (
                <tr key={floor} className={rowIdx % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'}>

                  {/* 층수 레이블 */}
                  <td className="sticky left-0 z-10 p-0 border-r-2 border-slate-200 bg-slate-100"
                    style={{ width: 36, minWidth: 36, height: 28 }}>
                    <span className="text-[10px] font-black text-slate-500 block text-center leading-7">
                      {floor}
                    </span>
                  </td>

                  {/* 공정 셀 */}
                  {buildings.map(b => {
                    const { color, txt, isBaseline } = getCell(b, floor, effectiveCats);
                    const isEmpty = color === C.empty || color === C.above;
                    return (
                      <td key={b.id}
                        className="p-[2px] border-l border-slate-100"
                        style={{
                          height: 28,
                          borderBottom: isBaseline ? `3px solid ${BASELINE_COLOR}` : undefined,
                        }}
                      >
                        <div
                          className="w-full h-full rounded flex items-center justify-center"
                          style={{ backgroundColor: color.bg }}
                        >
                          {txt && (
                            <span
                              className="text-[9px] font-black leading-none tracking-tight select-none"
                              style={{ color: isEmpty ? C.empty.text : color.text }}
                            >
                              {txt}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
