import React, { useState } from 'react';

// "2026-04-16" → "4/16"
const formatDate = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

// 통합현황(UnifiedMatrixView.jsx)/모바일 배치도(ElevationViewScreen.js)와 동일한 탭 구성 —
// '통합'은 모든 카테고리를 우선순위대로 겹쳐서 보여주고, 나머지 4개는 다중 선택(토글) 가능하다.
const TABS = [
  { id: 'unified',    label: '통합' },
  { id: 'oiling',     label: '기름칠' },
  { id: 'slab',       label: '슬라브' },
  { id: 'clean1',     label: '1차' },
  { id: 'clean2',     label: '2차' },
  { id: 'unloading',  label: '하역' },
];
const CATEGORY_IDS = ['oiling', 'slab', 'clean1', 'clean2', 'unloading'];

const ElevationView = ({ buildings, summary, onCellClick }) => {
  // 빈 Set = 통합(전체 카테고리를 우선순위대로 겹쳐서 표시). 하나 이상 담기면 그 카테고리들만 표시.
  const [selectedCats, setSelectedCats] = useState(new Set());
  const isUnified = selectedCats.size === 0;
  const effectiveCats = isUnified ? new Set(CATEGORY_IDS) : selectedCats;
  const singleCat = !isUnified && selectedCats.size === 1 ? [...selectedCats][0] : null;

  const handleTabPress = (id) => {
    if (id === 'unified') { setSelectedCats(new Set()); return; }
    setSelectedCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 같은 세대+층(또는 동+층)에 기록이 여럿이면 id가 가장 큰(가장 나중에 입력된) 것을 "현재 상태"로
  // 취급한다. date는 비어있을 수 있어 정렬 기준으로 쓰지 않는다 — 통합현황/모바일 배치도와 동일한 규칙
  // (src/utils/cleaningRecords.js의 keepLatestPhase2와 같은 "최신 = 최대 id" 규칙).
  const pickLatest = (rows) => rows.reduce((best, r) => (!best || (r.id || 0) > (best.id || 0)) ? r : best, null);

  // ── 각 칸(세대/층)의 작업 상태 조회 ──
  const getStatus = (houseId, floor, buildingId) => {
    // 1. 박리제(기름칠) 기록 — 세대 기록이 없으면(대부분 그렇다) 동+층 기록으로 대체 조회한다.
    //    그래야 기름칠이 세대 구분 없이 동 전체로 기록돼도 그 층의 모든 세대 칸이 동일하게 칠해진다.
    const oiling = pickLatest((summary.oiling || []).filter(r => r.house_id === houseId && r.floor === floor))
      || pickLatest((summary.oiling || []).filter(r => r.house_id == null && r.building_id === buildingId && r.floor === floor));

    // 1-1. 슬라브 — 오일링과 동일하게 세대 기록이 없으면 동+층 기록으로 대체 조회
    const slab = pickLatest((summary.slab || []).filter(r => r.house_id === houseId && r.floor === floor))
      || pickLatest((summary.slab || []).filter(r => r.house_id == null && r.building_id === buildingId && r.floor === floor));

    // 2. 청소 — 1차/2차를 독립된 상태로 각각 추적한다(모바일과 동일 — 한 층에 1차만 끝나고
    //    2차는 아직인 경우도 있어 하나로 합치면 정보가 손실된다).
    const cleaningRecords = summary.cleaning?.filter(r => r.house_id === houseId && r.floor === floor) || [];
    const clean1 = pickLatest(cleaningRecords.filter(r => r.phase === 1 || r.phase == null));
    const clean2 = pickLatest(cleaningRecords.filter(r => r.phase === 2));
    const clean2Confirmed = clean2?.confirmed === 1;

    // 3. 하역 기록
    const unloadingRecords = summary.unloading?.filter(r => r.house_id === houseId && r.floor === floor) || [];
    const latestUnloading = pickLatest(unloadingRecords);

    return {
      isOiled:         !!oiling,
      oilingDate:      oiling?.date || null,
      isSlab:          !!slab,
      slabDate:        slab?.date || null,
      hasClean1:       !!clean1,
      clean1Date:      clean1?.date || null,
      hasClean2:       !!clean2,
      clean2Confirmed,
      clean2Date:      clean2Confirmed ? (clean2.sign_date || clean2.date) : (clean2?.date || null),
      cleanCount:      cleaningRecords.length,
      unloadPhase:     latestUnloading ? latestUnloading.phase : 0,
      unloadProgress:  latestUnloading ? latestUnloading.progress : 0,
      unloadingDate:   latestUnloading?.date || null,
      unloadCount:     unloadingRecords.length,
    };
  };

  // 기성 기준선은 건물명 하드코딩 표가 아니라 DB 기준층 컬럼을 직접 사용한다 — 통합현황
  // (UnifiedMatrixView.jsx)/모바일 배치도와 동일한 규칙. 카테고리 하나만 선택 시 그 공정 전용
  // 기준층, 두 개 이상(통합 포함) 선택 시엔 청소 기준층(기성 기준선)을 보여준다.
  const getLimit = (building) => {
    if (!building) return 0;
    if (singleCat === 'oiling')    return building.oiling_base_floor || 0;
    if (singleCat === 'slab')      return building.slab_base_floor || 0;
    if (singleCat === 'unloading') return building.unloading_base_floor || 0;
    return building.cleaning_base_floor || 0;
  };

  // ── 선택된 카테고리를 대상으로 칸의 색/날짜/유형을 판정 ──
  // 우선순위: 하역 > 2차서명완료 > 2차미서명 > 1차 > 기름칠 (통합현황/모바일 배치도와 동일).
  // 색상도 통합현황(UnifiedMatrixView.jsx의 C 팔레트)/모바일 배치도와 동일한 hex를 그대로 사용한다.
  const getCell = (status, cats) => {
    if (cats.has('unloading') && status.unloadProgress === 100)
      return { bg: 'bg-[#8B5CF6] text-white border-0 shadow-sm', dateText: formatDate(status.unloadingDate), type: 'unloading' };
    if (cats.has('unloading') && status.unloadPhase > 0)
      return { bg: 'bg-[#C4B5FD] text-white border-0 shadow-sm', dateText: formatDate(status.unloadingDate), type: 'unloading' };
    if (cats.has('clean2') && status.hasClean2 && status.clean2Confirmed)
      return { bg: 'bg-[#15803D] text-white border-0 shadow-sm', dateText: formatDate(status.clean2Date), type: 'cleaning' };
    if (cats.has('clean2') && status.hasClean2)
      return { bg: 'bg-[#84CC16] text-white border-0 shadow-sm', dateText: formatDate(status.clean2Date), type: 'cleaning' };
    if (cats.has('clean1') && status.hasClean1)
      return { bg: 'bg-[#0EA5E9] text-white border-0 shadow-sm', dateText: formatDate(status.clean1Date), type: 'cleaning' };
    if (cats.has('oiling') && status.isOiled)
      return { bg: 'bg-[#EA580C] text-white border-0 shadow-sm', dateText: formatDate(status.oilingDate), type: 'oiling' };
    if (cats.has('slab') && status.isSlab)
      return { bg: 'bg-[#92400E] text-white border-0 shadow-sm', dateText: formatDate(status.slabDate), type: 'slab' };
    // 아직 해당 공정이 닿지 않은 층 — 시각적 현황(AdvancedElevationView.jsx)과 동일하게 칸 자체는
    // 죽이지 않고, 층 번호만 흐리게 뒤로 보냈다가 호버 시 드러나게 한다(전체를 어둡게 죽이지 않음).
    return { bg: 'bg-surface-container-lowest border border-outline-variant/30 text-outline', dateText: null, type: null };
  };

  // 클릭 시 열어야 할 기록 입력 폼의 종류 — 카테고리 하나만 선택돼 있으면(빈 칸이라도) 그 공정으로
  // 확정하고, 통합/다중 선택 상태에선 그 칸이 실제로 보여주고 있던 공정을 그대로 쓴다.
  const resolveClickType = (cellType) => {
    if (singleCat === 'oiling')    return 'oiling';
    if (singleCat === 'slab')      return 'slab';
    if (singleCat === 'unloading') return 'unloading';
    if (singleCat === 'clean1' || singleCat === 'clean2') return 'cleaning';
    return cellType || 'cleaning';
  };

  // 셀 (지상/지하 공통) - h-8 고정. dateText가 없는(아직 그 공정이 닿지 않은) 지상층 칸은
  // 시각적 현황(AdvancedElevationView.jsx)과 동일하게 층 번호를 흐리게(opacity-20) 뒤로 보내고,
  // 마우스를 올리면(hover) 드러나게 한다 — 칸 전체를 죽이지 않고 "아직 안 올라간 층"만 자연스럽게 뒤로 뺀다.
  const Cell = ({ bg, dateText, count, label, floorLabel, isBasement = false, extraClass = '', onClick, title }) => (
    <div
      className={`group relative flex flex-col items-center justify-center rounded-sm transition-all duration-300 cursor-pointer w-10 h-8 ${bg} ${extraClass}`}
      title={`${title}${count > 1 ? ` (총 ${count}회 작업됨)` : ''}`}
      onClick={onClick}
    >
      {/* 중복 작업 수량 뱃지 (2회 이상일 때만 표시) */}
      {count > 1 && (
        <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-error text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-md z-10 border border-white">
          {count}
        </div>
      )}

      {isBasement ? (
        <>
          <span className="text-[8px] font-bold uppercase tracking-tighter opacity-90 leading-none">{label}</span>
          {dateText && <span className="text-[7px] font-black leading-tight tracking-tighter opacity-95">{dateText}</span>}
        </>
      ) : dateText ? (
        <span className="text-[9px] font-black leading-tight tracking-tighter">{dateText}</span>
      ) : (
        <span className="text-[9px] font-bold text-outline-variant opacity-20 group-hover:opacity-100 transition-opacity">{floorLabel}</span>
      )}
    </div>
  );

  // ── 층수 레이블 컬럼 (왼쪽 고정)
  const FloorLabelColumn = ({ basementCount, maxFloors, limit }) => (
    <div className="flex flex-col-reverse gap-1 items-end pr-1 flex-shrink-0">
      {/* 하단 "호" 레이블 자리 맞춤 스페이서 */}
      <div className="h-[22px] mt-2 mb-1 border-t border-transparent pt-1 flex items-center justify-end">
        <span className="text-[8px] font-bold text-outline select-none">층</span>
      </div>

      {/* 지하층 레이블 */}
      {Array.from({ length: basementCount }).map((_, i) => {
        const floor = -(basementCount - i);
        const label = floor === -1 ? 'B1' : floor === -2 ? 'B2' : `B${Math.abs(floor)}`;
        return (
          <div key={floor} className="h-8 flex items-center justify-end gap-1 px-1 rounded-sm">
            <span className="text-[9px] font-black text-outline">{label}</span>
          </div>
        );
      })}

      {/* 구분선 스페이서 */}
      <div className="h-1 w-full my-1" />

      {/* 지상층 레이블 */}
      {Array.from({ length: maxFloors }).map((_, i) => {
        const floor = i + 1;
        return (
          <React.Fragment key={floor}>
            {floor === limit + 1 && <div className="w-full h-[2px] my-[1px]" />}
            <div className="h-8 flex items-center justify-end gap-1 px-1 rounded-sm">
              <span className={`text-[9px] font-bold leading-none ${floor === 1 ? 'text-on-surface-variant' : 'text-outline-variant/70'}`}>
                {floor}
              </span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="bg-surface-container-lowest rounded-lg blueprint-grid p-6 lg:p-8 relative">

        {/* 탭 (다중 선택 토글: 통합은 해제, 나머지는 여러 개 동시 선택 가능 — 통합현황과 동일) */}
        <div className="flex border-b-2 border-outline-variant/20 mb-6">
          {TABS.map(tab => {
            const active = tab.id === 'unified' ? isUnified : selectedCats.has(tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => handleTabPress(tab.id)}
                className={`px-5 py-2.5 text-xs font-black uppercase tracking-wider border-b-2 -mb-[2px] transition-all ${
                  active ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 범례 */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {[
              { color: '#EA580C', label: '박리제칠' },
              { color: '#92400E', label: '슬라브' },
              { color: '#0EA5E9', label: '1차 완료' },
              { color: '#84CC16', label: '2차(서명전)' },
              { color: '#15803D', label: '2차(서명완료)' },
              { color: '#8B5CF6', label: '하역 완료' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-sm shadow-sm flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="font-label text-[9px] uppercase font-bold text-on-surface">{item.label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1 bg-white/50 backdrop-blur rounded border border-outline-variant/20 shadow-sm">
            <span className="font-label text-[9px] uppercase tracking-tighter text-outline">모드</span>
            <span className="text-[11px] font-bold text-primary">
              {isUnified ? '통합' : TABS.filter(t => selectedCats.has(t.id)).map(t => t.label).join('+')}
            </span>
          </div>
        </div>

        {/* 건물 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {buildings.map(b => {
            const maxFloors = Math.max(...b.houses.map(h => h.floors), 0);
            const limit = getLimit(b);
            const basementCount = b.basement_count || 0;

            return (
              <div key={b.id} className="bg-surface/90 backdrop-blur-md rounded-lg shadow-lg border border-outline-variant/30 p-4 flex flex-col overflow-hidden">

                {/* 건물 헤더 */}
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-outline-variant/30">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">domain</span>
                    <h3 className="font-headline font-black tracking-tight text-xl text-primary">{b.name}</h3>
                  </div>
                  <span className="font-label text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-sm uppercase tracking-wider font-bold">
                    {b.houses.length} Units
                  </span>
                </div>

                <div className="flex gap-1 items-end justify-start overflow-x-auto pb-2 no-scrollbar">
                  {/* 층수 레이블 컬럼 */}
                  <FloorLabelColumn
                    basementCount={basementCount}
                    maxFloors={maxFloors}
                    limit={limit}
                  />

                  {/* 호수별 열 */}
                  {b.houses.map(house => (
                    <div key={house.id} className="flex flex-col-reverse gap-1 items-center flex-shrink-0">
                      <div className="text-center font-label text-[10px] font-bold text-on-surface-variant mt-2 mb-1 w-full border-t border-outline-variant/20 pt-1">
                        {house.ho.replace('호', '')}
                      </div>

                      {/* 지하층 */}
                      {Array.from({ length: basementCount }).map((_, i) => {
                        const floor = -(basementCount - i);
                        const status = getStatus(house.id, floor, b.id);
                        const cell = getCell(status, effectiveCats);
                        const label = floor === -1 ? house.basement_label_b1 : floor === -2 ? house.basement_label_b2 : `B${Math.abs(floor)}`;
                        return (
                          <Cell
                            key={`b-${floor}`}
                            bg={cell.bg}
                            dateText={cell.dateText}
                            count={status.cleanCount}
                            label={label}
                            isBasement
                            title={`${house.ho} ${label}`}
                            onClick={() => onCellClick && onCellClick({ building_id: b.id, house_id: house.id, floor: `B${Math.abs(floor)}`, type: resolveClickType(cell.type) })}
                          />
                        );
                      })}

                      <div className="h-1 w-full bg-outline-variant/50 rounded-full my-1" />

                      {/* 지상층 */}
                      {Array.from({ length: house.floors }).map((_, i) => {
                        const floor = i + 1;
                        const status = getStatus(house.id, floor, b.id);
                        const cell = getCell(status, effectiveCats);
                        return (
                          <React.Fragment key={floor}>
                            {floor === limit + 1 && (
                              <div className="w-full h-[2px] bg-error shadow-[0_0_4px_rgba(255,0,0,0.5)] my-[1px] relative z-20" />
                            )}
                            <Cell
                              bg={cell.bg}
                              dateText={cell.dateText}
                              floorLabel={floor}
                              count={status.cleanCount}
                              title={`${b.name} ${floor}층 ${house.ho}`}
                              onClick={() => onCellClick && onCellClick({ building_id: b.id, house_id: house.id, floor: floor.toString(), type: resolveClickType(cell.type) })}
                            />
                          </React.Fragment>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ElevationView;
