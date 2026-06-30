import React, { useState, useMemo } from 'react';

const MATRIX_TABS = [
  { id: 'oiling',    title: '갱폼 박리제칠', activeClass: 'bg-primary text-white',    summaryColor: 'text-primary',    barColor: 'bg-primary' },
  { id: 'clean1',    title: '1차 세대청소',  activeClass: 'bg-sky-500 text-white',    summaryColor: 'text-sky-600',    barColor: 'bg-sky-500' },
  { id: 'clean2',    title: '2차 세대청소',  activeClass: 'bg-success text-white',    summaryColor: 'text-success',    barColor: 'bg-success' },
  { id: 'unloading', title: '하역',          activeClass: 'bg-purple-500 text-white', summaryColor: 'text-purple-600', barColor: 'bg-purple-500' },
];

const MONTH_COLORS = [
  '#3B82F6', // 1월  blue
  '#8B5CF6', // 2월  violet
  '#EC4899', // 3월  pink
  '#EF4444', // 4월  red
  '#F97316', // 5월  orange
  '#EAB308', // 6월  yellow
  '#84CC16', // 7월  lime
  '#22C55E', // 8월  green
  '#14B8A6', // 9월  teal
  '#06B6D4', // 10월 cyan
  '#6366F1', // 11월 indigo
  '#A855F7', // 12월 purple
];

const fmtDate = (d) => {
  if (!d) return null;
  const dt = new Date(d);
  if (isNaN(dt)) return null;
  return `${dt.getMonth() + 1}/${dt.getDate()}`;
};

const toYM = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

const parseYM = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return { year: y, month: m };
};

const MatrixTable = ({ title, viewMode, buildings, summary, maxFloor, tabInfo, selectedYM }) => {
  const floors = useMemo(
    () => Array.from({ length: maxFloor }, (_, i) => maxFloor - i),
    [maxFloor]
  );

  // 선택 월 이전에 이미 완료(기정산)된 층 집합
  const prevCompleteSet = useMemo(() => {
    if (!selectedYM || (viewMode !== 'clean1' && viewMode !== 'clean2')) return new Set();
    const monthStart = selectedYM + '-01';
    const targetPhase = viewMode === 'clean2' ? 2 : 1;
    const prevFloorMap = {};
    (summary.cleaning || []).forEach(r => {
      if (!r.date || r.date >= monthStart) return;
      if (r.phase !== targetPhase || Number(r.floor) <= 0) return;
      // 2차는 서명 완료(confirmed=1)된 것만 이전 기성으로 인정
      if (viewMode === 'clean2' && r.confirmed !== 1) return;
      const key = `${r.building_id}_${r.floor}`;
      if (!prevFloorMap[key]) prevFloorMap[key] = { building_id: Number(r.building_id), floor: Number(r.floor), cleaned: new Set() };
      if (r.house_id) prevFloorMap[key].cleaned.add(r.house_id);
      else prevFloorMap[key].cleaned.add(`nohouse_${r.date}`);
    });
    const result = new Set();
    Object.entries(prevFloorMap).forEach(([key, data]) => {
      const bldg = buildings.find(b => b.id === data.building_id);
      if (!bldg) return;
      const totalUnits = bldg.houses.filter(h => {
        const sf = h.start_floor || 1;
        return data.floor >= sf && data.floor <= h.floors;
      }).length;
      if (totalUnits > 0 && data.cleaned.size >= totalUnits) result.add(key);
    });
    return result;
  }, [selectedYM, viewMode, summary.cleaning, buildings]);

  const getStatus = (buildingId, floor) => {
    const b = buildings.find(b => b.id === buildingId);
    if (!b) return { total: 0, completed: 0, unsignedCount: 0, latestDate: null };

    const validHouses = b.houses.filter(h => {
      const sf = h.start_floor || 1;
      return floor >= sf && floor <= h.floors;
    });
    const total = validHouses.length;

    let completed = 0;
    let unsignedCount = 0;
    let latestDate = null;

    if (viewMode === 'oiling') {
      const rec = selectedYM
        ? summary.oiling?.find(r => Number(r.building_id) === buildingId && Number(r.floor) === floor && r.date?.startsWith(selectedYM))
        : summary.oiling?.find(r => Number(r.building_id) === buildingId && Number(r.floor) === floor);
      if (!rec && total === 0) return { total: 0, completed: 0, unsignedCount: 0, latestDate: null };
      completed = rec ? (total || 1) : 0;
      latestDate = rec?.date || null;
      return { total: total || (rec ? 1 : 0), completed, unsignedCount: 0, latestDate };
    }

    const src = viewMode === 'unloading' ? summary.unloading : summary.cleaning;

    if (selectedYM) {
      const floorRecs = src?.filter(r => {
        if (Number(r.building_id) !== buildingId) return false;
        if (Number(r.floor) !== floor) return false;
        if (!r.date?.startsWith(selectedYM)) return false;
        if (viewMode === 'clean1') return r.phase === 1;
        if (viewMode === 'clean2') return r.phase === 2;
        return r.phase >= 1;
      }) || [];

      if (total === 0 && floorRecs.length === 0) return { total: 0, completed: 0, unsignedCount: 0, latestDate: null };
      const effectiveTotal = total > 0 ? total : floorRecs.length;

      if (floorRecs.length > 0) {
        if (viewMode === 'clean2') {
          const signedRecs = floorRecs.filter(r => r.confirmed === 1);
          const byHouseSigned = validHouses.filter(h => signedRecs.some(r => r.house_id === h.id)).length;
          const byHouseAll    = validHouses.filter(h => floorRecs.some(r => r.house_id === h.id)).length;
          completed     = byHouseSigned > 0 ? byHouseSigned : Math.min(signedRecs.length, effectiveTotal);
          const totalCleaned  = byHouseAll > 0 ? byHouseAll : Math.min(floorRecs.length, effectiveTotal);
          unsignedCount = totalCleaned - completed;
          const latestSigned  = [...signedRecs].sort((a, b) => (b.sign_date || b.date).localeCompare(a.sign_date || a.date))[0];
          latestDate = latestSigned?.sign_date || latestSigned?.date
                    || [...floorRecs].sort((a, b) => b.date.localeCompare(a.date))[0]?.date;
        } else {
          const byHouse = validHouses.filter(h => floorRecs.some(r => r.house_id === h.id)).length;
          completed  = byHouse > 0 ? byHouse : Math.min(floorRecs.length, effectiveTotal);
          latestDate = [...floorRecs].sort((a, b) => b.date.localeCompare(a.date))[0]?.date;
        }
      }
      return { total: effectiveTotal, completed, unsignedCount, latestDate };
    }

    // 전체 누적 모드
    const floorRecs = src?.filter(r =>
      Number(r.building_id) === buildingId &&
      Number(r.floor) === floor &&
      (viewMode === 'clean2' ? r.phase === 2 : r.phase >= (viewMode === 'clean1' ? 1 : 1))
    ) || [];

    if (total === 0 && floorRecs.length === 0) return { total: 0, completed: 0, unsignedCount: 0, latestDate: null };
    const effectiveTotal = total > 0 ? total : floorRecs.length;

    if (floorRecs.length > 0) {
      if (viewMode === 'clean2') {
        const signedRecs = floorRecs.filter(r => r.confirmed === 1);
        const byHouseSigned = validHouses.filter(h => signedRecs.some(r => r.house_id === h.id)).length;
        const byHouseAll    = validHouses.filter(h => floorRecs.some(r => r.house_id === h.id)).length;
        completed     = byHouseSigned > 0 ? byHouseSigned : Math.min(signedRecs.length, effectiveTotal);
        const totalCleaned  = byHouseAll > 0 ? byHouseAll : Math.min(floorRecs.length, effectiveTotal);
        unsignedCount = totalCleaned - completed;
        const latestSigned  = [...signedRecs].sort((a, b) => (b.sign_date || b.date).localeCompare(a.sign_date || a.date))[0];
        latestDate = latestSigned?.sign_date || latestSigned?.date
                  || [...floorRecs].sort((a, b) => b.date.localeCompare(a.date))[0]?.date;
      } else {
        const byHouse = validHouses.filter(h => floorRecs.some(r => r.house_id === h.id)).length;
        completed = byHouse > 0 ? byHouse : Math.min(floorRecs.length, effectiveTotal);
        const dateRecs = viewMode === 'clean1'
          ? src?.filter(r => Number(r.building_id) === buildingId && Number(r.floor) === floor && r.phase === 1) || []
          : floorRecs;
        const candidates = dateRecs.length > 0 ? dateRecs : floorRecs;
        const useEarliest = viewMode === 'clean1';
        latestDate = [...candidates].sort((a, b) =>
          useEarliest ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)
        )[0]?.date;
      }
    }

    return { total: effectiveTotal, completed, unsignedCount, latestDate };
  };

  // 패널 완료율 집계 (세대 기준)
  const { totalUnits, completedUnits, billableUnits, totalCells, completedCells } = useMemo(() => {
    let totU = 0, compU = 0, billU = 0, tot = 0, comp = 0;
    buildings.forEach(b => {
      const limit = viewMode === 'oiling'
        ? (b.oiling_base_floor || 0)
        : viewMode === 'unloading'
        ? (b.unloading_base_floor || 0)
        : (b.cleaning_base_floor || 0);
      floors.forEach(f => {
        const { total, completed } = getStatus(b.id, f);
        if (total > 0) {
          tot++;
          totU += total;
          compU += completed;
          if (completed === total) {
            comp++;
            const alreadyBilled = selectedYM && prevCompleteSet.has(`${b.id}_${f}`);
            if (f > limit && !alreadyBilled) billU += total;
          }
        }
      });
    });
    return { totalUnits: totU, completedUnits: compU, billableUnits: billU, totalCells: tot, completedCells: comp };
  }, [buildings, floors, summary, viewMode, selectedYM]);

  const rate = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-md border border-outline-variant/30 flex flex-col overflow-hidden">

      {/* 패널 헤더 */}
      <div className={`px-3 py-2 ${tabInfo.activeClass}`}>
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-headline font-black text-[11px] tracking-widest">{title}</span>
          <span className="font-headline font-black text-sm">{rate}%</span>
        </div>
        <div className="h-1 bg-white/30 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${rate}%` }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] opacity-75">{completedUnits} / {totalUnits} 세대</span>
          <span className="text-[9px] opacity-90 font-black">청구 {billableUnits}세대</span>
        </div>
      </div>

      {/* 매트릭스 테이블 */}
      <div className="overflow-x-auto overflow-y-hidden flex-1 p-1">
        <table className="w-full text-center border-collapse">
          <thead>
            <tr>
              <th className="p-0 border-b border-r border-outline-variant/40 w-6">
                <div className="flex flex-col items-center justify-center py-0.5">
                  <span className="text-[8px] text-outline font-black">F</span>
                  <span className="text-[7px] text-outline/60 font-bold">동</span>
                </div>
              </th>
              {buildings.map(b => (
                <th key={b.id} className="p-0 border-b border-outline-variant/40 w-8">
                  <div className="flex flex-col items-center justify-center py-0.5">
                    <span className="font-headline font-black text-on-surface text-[9px] leading-none">{b.name.replace('동', '')}</span>
                    <span className="text-[7px] text-outline font-bold leading-none mt-0.5">{b.houses.length}세</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {floors.map(floor => (
              <tr key={floor} className="hover:bg-surface-container-low/50 transition-colors">
                <td className="p-0 border-r border-outline-variant/40 font-headline font-bold text-on-surface-variant text-[9px] text-center w-6 h-[20px]">
                  {floor}
                </td>

                {buildings.map(b => {
                  const { total, completed, unsignedCount, latestDate } = getStatus(b.id, floor);

                  let bgClass = '';
                  let textClass = 'text-on-surface-variant';
                  let cellText = '';
                  let isCompleted = false;
                  let monthStyle = {};

                  if (total > 0) {
                    if (viewMode === 'oiling') {
                      if (completed > 0) {
                        isCompleted = true;
                        textClass = 'text-white';
                        cellText = fmtDate(latestDate) || String(total);
                      } else {
                        bgClass = 'bg-surface-container border border-outline-variant/20';
                      }
                    } else if (viewMode === 'clean2') {
                      // 3단계: 서명완료 / 서명대기 / 미작업
                      if (completed === total) {
                        // 전체 서명 완료 → 월별 색상 (기존과 동일)
                        isCompleted = true;
                        textClass = 'text-white';
                        cellText = fmtDate(latestDate) || String(total);
                        const month = latestDate ? new Date(latestDate).getMonth() : null;
                        monthStyle = month !== null ? { backgroundColor: MONTH_COLORS[month] } : {};
                      } else if (completed > 0) {
                        // 일부 서명 완료
                        bgClass = 'bg-lime-400/40 border border-lime-500/50';
                        textClass = 'text-lime-900 font-black';
                        cellText = `✓${completed}`;
                      } else if (unsignedCount > 0) {
                        // 청소 완료, 서명 전
                        bgClass = 'bg-lime-300/50 border border-lime-400/60';
                        textClass = 'text-lime-800 font-bold';
                        cellText = fmtDate(latestDate) || `~${unsignedCount}`;
                      } else {
                        bgClass = 'bg-surface-container border border-outline-variant/20';
                      }
                    } else if (completed === total) {
                      isCompleted = true;
                      textClass = 'text-white';
                      cellText = fmtDate(latestDate) || String(total);
                      const month = latestDate ? new Date(latestDate).getMonth() : null;
                      monthStyle = isCompleted && month !== null ? { backgroundColor: MONTH_COLORS[month] } : {};
                    } else if (completed > 0) {
                      if (viewMode === 'clean1')    bgClass = 'bg-sky-500/20 text-sky-700 border border-sky-500/30';
                      if (viewMode === 'unloading') bgClass = 'bg-purple-500/20 text-purple-700 border border-purple-500/30';
                      textClass = 'font-bold';
                      cellText = `${completed}/${total}`;
                    } else {
                      bgClass = 'bg-surface-container border border-outline-variant/20';
                    }
                  }

                  if (!monthStyle.backgroundColor) {
                    const month = latestDate ? new Date(latestDate).getMonth() : null;
                    monthStyle = isCompleted && month !== null ? { backgroundColor: MONTH_COLORS[month] } : {};
                  }

                  const limit = viewMode === 'oiling'
                    ? (b.oiling_base_floor || 0)
                    : viewMode === 'unloading'
                    ? (b.unloading_base_floor || 0)
                    : (b.cleaning_base_floor || 0);
                  const isBaseline = floor === limit + 1;

                  return (
                    <td
                      key={`${b.id}-${floor}`}
                      className={`p-[1px] relative ${isBaseline ? 'border-b-[2px] border-error shadow-[0_2px_4px_rgba(255,0,0,0.3)]' : ''}`}
                    >
                      {total > 0 ? (
                        <div
                          className={`mx-auto w-full h-[20px] rounded-[2px] flex items-center justify-center transition-all ${isCompleted ? 'shadow-sm' : bgClass}`}
                          style={monthStyle}
                        >
                          <span className={`font-headline text-[9px] ${textClass} font-black leading-none tracking-tighter`}>
                            {cellText}
                          </span>
                        </div>
                      ) : (
                        <div className="mx-auto w-full h-[20px] rounded-[2px] flex items-center justify-center bg-surface-variant/20">
                          <span className="text-outline text-[8px] font-black opacity-40">-</span>
                        </div>
                      )}
                      {isBaseline && floor > 1 && (
                        <div className="absolute -bottom-[6px] right-0 z-10 w-full flex justify-center pointer-events-none">
                          <span className="text-[6px] font-black text-error bg-surface px-0.5 rounded-sm scale-75">기성기준</span>
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const MatrixStatusView2 = ({ buildings, summary }) => {
  const [activeTab, setActiveTab] = useState('oiling');
  const today = new Date();
  const [selectedYM, setSelectedYM] = useState(null); // 기본: 전체 누적

  const maxFloor = useMemo(() => Math.max(
    ...buildings.map(b => Math.max(...b.houses.map(h => h.floors || 0), 0)),
    0
  ), [buildings]);

  const activeTabInfo = MATRIX_TABS.find(t => t.id === activeTab);
  const isAllMode = selectedYM === null;

  const prevMonth = () => {
    const base = selectedYM || toYM(today);
    const { year, month } = parseYM(base);
    setSelectedYM(toYM(new Date(year, month - 2, 1)));
  };

  const nextMonth = () => {
    const base = selectedYM || toYM(today);
    const { year, month } = parseYM(base);
    setSelectedYM(toYM(new Date(year, month, 1)));
  };

  const { year: dispYear, month: dispMonth } = selectedYM
    ? parseYM(selectedYM)
    : { year: today.getFullYear(), month: today.getMonth() + 1 };

  return (
    <div className="w-full max-w-full animate-in fade-in duration-500">

      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-primary text-lg">grid_on</span>
        <h3 className="font-headline font-black text-lg text-primary tracking-tight">통합 매트릭스 2</h3>
        <span className={`text-[9px] font-label font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
          isAllMode ? 'bg-on-surface/10 text-on-surface-variant' : 'bg-primary/10 text-primary'
        }`}>
          {isAllMode ? '전체 누적' : `${dispYear}년 ${dispMonth}월 기성`}
        </span>
      </div>

      {/* 월 선택기 */}
      <div className="flex items-center gap-1.5 mb-3 bg-surface-container-low p-1.5 rounded-xl">
        {/* 전체 누적 버튼 */}
        <button
          onClick={() => setSelectedYM(null)}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wide transition-all whitespace-nowrap flex-shrink-0 ${
            isAllMode
              ? 'bg-on-surface text-surface shadow-sm'
              : 'text-on-surface-variant hover:bg-surface-container'
          }`}
        >
          전체
        </button>

        {/* 월 내비게이터 */}
        <div className="flex items-center gap-0.5 flex-1 justify-center">
          <button
            onClick={prevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-sm text-primary">chevron_left</span>
          </button>
          <button
            onClick={() => setSelectedYM(selectedYM || toYM(today))}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-black transition-all min-w-[84px] text-center ${
              !isAllMode
                ? 'bg-primary text-white shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            {dispYear}년 {dispMonth}월
          </button>
          <button
            onClick={nextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-sm text-primary">chevron_right</span>
          </button>
        </div>

        {/* 이번달 바로가기 */}
        <button
          onClick={() => setSelectedYM(toYM(today))}
          className="px-2.5 py-1.5 rounded-lg text-[10px] font-black text-primary hover:bg-primary/10 transition-colors whitespace-nowrap flex-shrink-0"
        >
          이번달
        </button>
      </div>

      {/* 월별 색상 범례 */}
      <div className="flex flex-wrap gap-x-2 gap-y-1 mb-3 px-1">
        {MONTH_COLORS.map((color, i) => (
          <div key={i} className="flex items-center gap-0.5">
            <span className="w-2.5 h-2.5 rounded-sm inline-block flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-[8px] text-on-surface-variant font-black">{i + 1}월</span>
          </div>
        ))}
      </div>

      {/* 모바일 탭 셀렉터 */}
      <div className="flex md:hidden gap-1 mb-2 bg-surface-container-low p-1 rounded-xl">
        {MATRIX_TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 py-2 rounded-lg text-[10px] font-black tracking-wide transition-all ${activeTab === t.id ? t.activeClass + ' shadow-sm' : 'text-on-surface-variant hover:bg-surface-container'}`}
          >
            {t.id === 'oiling' ? '박리제칠' : t.id === 'clean1' ? '1차청소' : t.id === 'clean2' ? '2차청소' : '하역'}
          </button>
        ))}
      </div>

      {/* 모바일: 단일 패널 */}
      <div className="md:hidden">
        <MatrixTable
          title={activeTabInfo?.title}
          viewMode={activeTab}
          tabInfo={activeTabInfo}
          buildings={buildings}
          summary={summary}
          maxFloor={maxFloor}
          selectedYM={selectedYM}
        />
      </div>

      {/* 태블릿/PC: 4열 그리드 */}
      <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-4 gap-2">
        {MATRIX_TABS.map(t => (
          <MatrixTable
            key={t.id}
            title={t.title}
            viewMode={t.id}
            tabInfo={t}
            buildings={buildings}
            summary={summary}
            maxFloor={maxFloor}
            selectedYM={selectedYM}
          />
        ))}
      </div>

    </div>
  );
};

export default MatrixStatusView2;
