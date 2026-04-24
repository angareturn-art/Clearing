import React from 'react';

// "2026-04-16" → "4/16"
const formatDate = (dateStr) => {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

const ElevationView = ({ buildings, summary, onCellClick, viewMode = 'total' }) => {

  // ── 각 칸(세대/층)의 작업 상태 조회 ──
  const getStatus = (houseId, floor) => {
    // 1. 박리제(기름칠) 기록이 있는지 확인합니다.
    const oiling = summary.oiling?.find(r => r.house_id === houseId && r.floor === floor);
    
    // 2. 청소 기록들을 필터링하고 최신순으로 정렬합니다.
    const cleaningRecords = summary.cleaning?.filter(r => r.house_id === houseId && r.floor === floor) || [];
    const latestCleaning = [...cleaningRecords].sort((a, b) => b.date.localeCompare(a.date) || b.phase - a.phase)[0];
      
    // 3. 해당 칸의 최종 상태 정보를 반환합니다.
    return {
      isOiled:      !!oiling,         // 기름칠 되었는가?
      oilingDate:   oiling?.date || null,
      phase:        latestCleaning ? latestCleaning.phase : 0,    // 몇 차 청소인가?
      progress:     latestCleaning ? latestCleaning.progress : 0, // 청소 진행률(50% 또는 100%)
      cleaningDate: latestCleaning?.date || null,
      cleanCount:   cleaningRecords.length, // 중복 작업 수량 (청소 기준)
    };
  };

  const BASE_LIMITS = {
    oiling:   { '1동': 7, '2동': 7, '3동': 3, '4동': 3, '5동': 3, '6동': 3, '9동': 3, '7동': 2, '8동': 2 },
    cleaning: { '1동': 4, '2동': 4, '3동': 3, '4동': 3, '5동': 3, '6동': 3, '9동': 3, '7동': 2, '8동': 2 },
  };

  const getLimit = (buildingName) => {
    const mode = viewMode === 'oiling' ? 'oiling' : 'cleaning';
    return BASE_LIMITS[mode][buildingName] || 0;
  };

  // ── 상태에 따른 칸의 배경색 결정 ──
  const getCellBg = (status) => {
    let bg = 'bg-surface-container-lowest border border-outline-variant/30 text-outline'; // 기본 (작업 전)
    
    if (viewMode === 'oiling') {
      // 1. 박리제(기름칠) 모드일 때
      if (status.isOiled) bg = 'bg-warning text-white border-0 shadow-sm'; // 기름칠 완료 (노란색)
      else                 bg = 'opacity-30';                            // 작업 전 (반투명)
    } else if (viewMode === 'cleaning') {
      // 2. 청소 모드일 때
      if (status.progress === 100)  bg = 'bg-success text-white border-0 shadow-sm'; // 청소 완료 (초록색)
      else if (status.phase > 0)    bg = 'bg-sky-500 text-white border-0 shadow-sm'; // 청소 진행 중 (하늘색)
      else                          bg = 'opacity-30';                            // 작업 전 (반투명)
    } else {
      // 3. 현장 전체 통합 모드일 때
      if (status.progress === 100)  bg = 'bg-success text-white border-0 shadow-sm'; // 청소 완료가 최우선 표시
      else if (status.phase > 0)    bg = 'bg-sky-500 text-white border-0 shadow-sm'; // 청소 진행 중 (하늘색)
      else if (status.isOiled)      bg = 'bg-primary text-white border-0 shadow-sm'; // 청소 전이면 기름칠 상태 표시 (파란색)
    }
    return bg;
  };

  const getDisplayDate = (status) => {
    if (viewMode === 'oiling')   return formatDate(status.oilingDate);
    if (viewMode === 'cleaning') return formatDate(status.cleaningDate);
    return formatDate(status.cleaningDate) || formatDate(status.oilingDate);
  };

  // 셀 (지상/지하 공통) - h-8 고정
  const Cell = ({ status, label, isBasement = false, extraClass = '', onClick, title }) => {
    const bg = getCellBg(status);
    const date = getDisplayDate(status);
    const count = status.cleanCount;

    return (
      <div
        className={`relative flex flex-col items-center justify-center rounded-sm transition-all duration-300 cursor-pointer w-10 h-8 ${bg} ${extraClass}`}
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
            {date && <span className="text-[7px] font-black leading-tight tracking-tighter opacity-95">{date}</span>}
          </>
        ) : (
          date
            ? <span className="text-[9px] font-black leading-tight tracking-tighter">{date}</span>
            : null
        )}
      </div>
    );
  };

  // ── 층수 레이블 컬럼 (왼쪽 고정)
  const FloorLabelColumn = ({ basementCount, maxFloors, limit, liftingFloor, targetFloor }) => (
    <div className="flex flex-col-reverse gap-1 items-end pr-1 flex-shrink-0">
      {/* 하단 "호" 레이블 자리 맞춤 스페이서 */}
      <div className="h-[22px] mt-2 mb-1 border-t border-transparent pt-1 flex items-center justify-end">
        <span className="text-[8px] font-bold text-outline select-none">층</span>
      </div>

      {/* 지하층 레이블 */}
      {Array.from({ length: basementCount }).map((_, i) => {
        const floor = -(basementCount - i);
        const label = floor === -1 ? 'B1' : floor === -2 ? 'B2' : `B${Math.abs(floor)}`;
        const isLifting = floor === liftingFloor;
        const isTarget = floor === targetFloor;
        return (
          <div key={floor} className={`h-8 flex items-center justify-end gap-1 px-1 rounded-sm ${isTarget ? 'bg-error/10 border border-error/20' : ''}`}>
            {isLifting && <span className="text-[10px] animate-bounce">🏗️</span>}
            <span className={`text-[9px] font-black ${isLifting ? 'text-primary' : isTarget ? 'text-error' : 'text-outline'}`}>{label}</span>
          </div>
        );
      })}

      {/* 구분선 스페이서 */}
      <div className="h-1 w-full my-1" />

      {/* 지상층 레이블 */}
      {Array.from({ length: maxFloors }).map((_, i) => {
        const floor = i + 1;
        const isLifting = floor === liftingFloor;
        const isTarget = floor === targetFloor;
        return (
          <React.Fragment key={floor}>
            {floor === limit + 1 && <div className="w-full h-[2px] my-[1px]" />}
            <div className={`h-8 flex items-center justify-end gap-1 px-1 rounded-sm ${isTarget ? 'bg-error/10 border border-error/20' : ''}`}>
              {isLifting && <span className="text-[10px] animate-bounce">🏗️</span>}
              <span className={`text-[9px] font-bold leading-none ${isLifting ? 'text-primary' : isTarget ? 'text-error' : (floor === 1 ? 'text-on-surface-variant' : 'text-outline-variant/70')}`}>
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

        {/* 범례 */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-primary rounded-sm shadow-sm" />
              <span className="font-label text-[10px] uppercase font-bold text-on-surface">박리제칠 완료</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-sky-500 rounded-sm shadow-sm" />
              <span className="font-label text-[10px] uppercase font-bold text-on-surface">청소 진행 중</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-success rounded-sm shadow-sm" />
              <span className="font-label text-[10px] uppercase font-bold text-on-surface">세대 최종 완료</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-10 h-8 bg-surface-container border border-outline-variant/40 rounded-sm flex items-center justify-center">
                <span className="text-[9px] font-black text-on-surface">4/16</span>
              </div>
              <span className="font-label text-[10px] uppercase font-bold text-on-surface">작업 날짜 표시</span>
            </div>
          </div>
          <div className="flex gap-4 p-4 bg-white/50 backdrop-blur rounded border border-outline-variant/20 shadow-sm">
            <div className="text-center">
              <p className="font-label text-[9px] uppercase tracking-tighter text-outline">모드</p>
              <p className="text-xs font-bold text-primary">
                {viewMode === 'total' ? '현장 전체 통합뷰' : viewMode === 'oiling' ? '박리제칠 추적뷰' : '세대청소 추적뷰'}
              </p>
            </div>
          </div>
        </div>

        {/* 건물 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {buildings.map(b => {
            const maxFloors = Math.max(...b.houses.map(h => h.floors), 0);
            const limit = getLimit(b.name);
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
                    {viewMode === 'oiling' ? '층별 통합 관리' : `${b.houses.length} Units`}
                  </span>
                </div>

                {/* ── 기름칠 모드 */}
                {viewMode === 'oiling' ? (
                  <div className="flex gap-2 items-end justify-center overflow-x-auto pb-2 no-scrollbar">
                    {/* 층수 레이블 */}
                    <FloorLabelColumn
                      basementCount={basementCount}
                      maxFloors={maxFloors}
                      limit={limit}
                    />

                    {/* 동 전체 단일 열 */}
                    <div className="flex flex-col-reverse gap-1 items-center">
                      <div className="text-center font-label text-[10px] font-bold text-on-surface-variant mt-2 mb-1 w-full border-t border-outline-variant/20 pt-1">
                        전 체
                      </div>

                      {/* 지하층 */}
                      {Array.from({ length: basementCount }).map((_, i) => {
                        const floor = -(basementCount - i);
                        const rec = summary.oiling?.find(r => r.building_id === b.id && r.floor === floor);
                        const status = { isOiled: !!rec, oilingDate: rec?.date || null, phase: 0, progress: 0, cleaningDate: null };
                        const label = floor === -1 ? 'B1' : floor === -2 ? 'B2' : `B${Math.abs(floor)}`;
                        return (
                          <Cell
                            key={`ob-${floor}`}
                            status={status}
                            label={label}
                            isBasement
                            extraClass="w-14"
                            title={`${b.name} ${label}`}
                            onClick={() => onCellClick && onCellClick({ building_id: b.id, floor: `B${Math.abs(floor)}` })}
                          />
                        );
                      })}

                      <div className="h-1 w-full bg-outline-variant/50 rounded-full my-1" />

                      {/* 지상층 리스트 표시 */}
                      {Array.from({ length: maxFloors }).map((_, i) => {
                        const floor = i + 1;
                        const rec = summary.oiling?.find(r => r.building_id === b.id && r.floor === floor);
                        const status = { isOiled: !!rec, oilingDate: rec?.date || null, phase: 0, progress: 0, cleaningDate: null };
                        return (
                          <React.Fragment key={floor}>
                            {/* 기성 기준선 표시 (해당 층 아래에 빨간 선이 그어집니다) */}
                            {floor === limit + 1 && (
                              <div className="w-full h-[2px] bg-error shadow-[0_0_8px_rgba(255,0,0,0.5)] my-[1px] relative z-20">
                                <span className="absolute -right-12 top-1/2 -translate-y-1/2 text-[8px] font-bold text-error whitespace-nowrap">기성 기준</span>
                              </div>
                            )}
                            <Cell
                              status={status}
                              extraClass="w-14"
                              title={`${b.name} ${floor}층`}
                              onClick={() => onCellClick && onCellClick({ building_id: b.id, floor: floor.toString() })}
                            />
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                ) : (
                  /* ── 전체/청소 모드 */
                  <div className="flex gap-1 items-end justify-start overflow-x-auto pb-2 no-scrollbar">
                    {/* 층수 레이블 컬럼 */}
                    {(() => {
                      const liftingRecords = summary.lifting?.filter(r => r.building_id === b.id) || [];
                      const maxLifting = liftingRecords.length > 0 ? Math.max(...liftingRecords.map(r => r.floor)) : null;
                      
                      // 타겟 층 계산 로직 (Dashboard와 동일)
                      let targetF = null;
                      if (maxLifting !== null) {
                        const allFloors = [
                          ...Array.from({ length: basementCount }).map((_, i) => -(basementCount - i)),
                          ...Array.from({ length: maxFloors }).map((_, i) => i + 1)
                        ].sort((a, b) => a - b);
                        const curIdx = allFloors.indexOf(maxLifting);
                        targetF = curIdx >= 2 ? allFloors[curIdx - 2] : null;
                      }

                      return (
                        <FloorLabelColumn
                          basementCount={basementCount}
                          maxFloors={maxFloors}
                          limit={limit}
                          liftingFloor={maxLifting}
                          targetFloor={targetF}
                        />
                      );
                    })()}

                    {/* 호수별 열 */}
                    {b.houses.map(house => (
                      <div key={house.id} className="flex flex-col-reverse gap-1 items-center flex-shrink-0">
                        <div className="text-center font-label text-[10px] font-bold text-on-surface-variant mt-2 mb-1 w-full border-t border-outline-variant/20 pt-1">
                          {house.ho.replace('호', '')}
                        </div>

                        {/* 지하층 */}
                        {Array.from({ length: basementCount }).map((_, i) => {
                          const floor = -(basementCount - i);
                          const status = getStatus(house.id, floor);
                          const label = floor === -1 ? house.basement_label_b1 : floor === -2 ? house.basement_label_b2 : `B${Math.abs(floor)}`;
                          return (
                            <Cell
                              key={`b-${floor}`}
                              status={status}
                              label={label}
                              isBasement
                              title={`${house.ho} ${label}`}
                              onClick={() => onCellClick && onCellClick({ building_id: b.id, house_id: house.id, floor: `B${Math.abs(floor)}` })}
                            />
                          );
                        })}

                        <div className="h-1 w-full bg-outline-variant/50 rounded-full my-1" />

                        {/* 지상층 */}
                        {Array.from({ length: house.floors }).map((_, i) => {
                          const floor = i + 1;
                          const status = getStatus(house.id, floor);
                          return (
                            <React.Fragment key={floor}>
                              {floor === limit + 1 && (
                                <div className="w-full h-[2px] bg-error shadow-[0_0_4px_rgba(255,0,0,0.5)] my-[1px] relative z-20" />
                              )}
                              <Cell
                                status={status}
                                title={`${b.name} ${floor}층 ${house.ho}`}
                                onClick={() => onCellClick && onCellClick({ building_id: b.id, house_id: house.id, floor: floor.toString() })}
                              />
                            </React.Fragment>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ElevationView;
