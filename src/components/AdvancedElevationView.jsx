import React from 'react';
import dayjs from 'dayjs';

/**
 * AdvancedElevationView Component
 * 기존 배치도보다 시각적 직관성을 강화한 고도화 버전입니다.
 * - 갱폼 제외
 * - 박리제/청소 공정 통합 시각화 (분할 배경)
 * - 세대별 최신 작업일 상시 노출
 * - 동별 요약 대시보드 포함
 */

const AdvancedElevationView = ({ buildings, summary, onCellClick }) => {

  // 날짜 포맷 (예: 2024-04-24 -> 4/24)
  const formatDateShort = (dateStr) => {
    if (!dateStr) return null;
    const d = dayjs(dateStr);
    return d.format('M/D');
  };

  // 최근 작업(오늘/어제)인지 확인하여 강조 효과 부여
  const getGlowClass = (dateStr) => {
    if (!dateStr) return '';
    const today = dayjs().format('YYYY-MM-DD');
    const yesterday = dayjs().subtract(1, 'day').format('YYYY-MM-DD');
    if (dateStr === today) return 'ring-2 ring-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)] z-10';
    if (dateStr === yesterday) return 'ring-1 ring-yellow-200/50';
    return '';
  };

  const getStatus = (houseId, floor) => {
    const oiling = summary.oiling?.find(r => r.house_id === houseId && r.floor === floor);
    const cleaningRecords = summary.cleaning?.filter(r => r.house_id === houseId && r.floor === floor) || [];
    const latestCleaning = [...cleaningRecords].sort((a, b) => b.date.localeCompare(a.date) || b.phase - a.phase)[0];
    
    // 두 공정 중 더 최근 날짜를 찾음
    const latestDate = [oiling?.date, latestCleaning?.date]
      .filter(Boolean)
      .sort((a, b) => b.localeCompare(a))[0] || null;

    return {
      isOiled: !!oiling,
      oilingDate: oiling?.date || null,
      progress: latestCleaning ? latestCleaning.progress : 0,
      cleaningDate: latestCleaning?.date || null,
      latestDate
    };
  };

  // 동별 요약 데이터 계산
  const getBuildingStats = (b) => {
    const buildingOiling = summary.oiling?.filter(r => r.building_id === b.id) || [];
    const buildingCleaning = summary.cleaning?.filter(r => r.building_id === b.id) || [];
    
    const maxOiling = buildingOiling.length > 0 ? Math.max(...buildingOiling.map(r => r.floor)) : 0;
    const maxCleaning = buildingCleaning.length > 0 ? Math.max(...buildingCleaning.map(r => r.floor)) : 0;
    
    const totalUnits = b.houses.reduce((acc, h) => acc + h.floors, 0);
    const completedUnits = buildingCleaning.filter(r => r.progress === 100).length;
    const cleanPercent = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0;

    return { maxOiling, maxCleaning, cleanPercent };
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* 범례 (Legend) - 초보자 가이드 */}
      <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/20 shadow-sm flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-primary rounded-sm" />
          <span className="text-xs font-bold text-on-surface">박리제 완료</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-sky-400 rounded-sm" />
          <span className="text-xs font-bold text-on-surface">청소 진행중</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-success rounded-sm" />
          <span className="text-xs font-bold text-on-surface">최종 완료</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 ring-2 ring-yellow-400 rounded-sm" />
          <span className="text-xs font-bold text-on-surface">최근 작업 (오늘/어제)</span>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {buildings.map(b => {
          const stats = getBuildingStats(b);
          const maxFloors = Math.max(...b.houses.map(h => h.floors), 0);
          const basementCount = b.basement_count || 0;

          return (
            <div key={b.id} className="bg-white rounded-2xl shadow-xl border border-outline-variant/30 overflow-hidden flex flex-col">
              
              {/* 고도화 헤더: 동별 요약 대시보드 */}
              <div className="bg-gradient-to-r from-primary/10 to-transparent p-5 border-b border-outline-variant/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg">
                      <span className="material-symbols-outlined">apartment</span>
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-primary tracking-tighter">{b.name}</h3>
                      <p className="text-[10px] text-outline uppercase font-bold tracking-widest">Construction Progress</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-success">{stats.cleanPercent}%</div>
                    <p className="text-[10px] text-outline font-bold uppercase">Total Completion</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-white/50 p-2 rounded-lg border border-primary/10 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-primary uppercase">Oiling Max</span>
                    <span className="text-sm font-black text-primary">{stats.maxOiling}F</span>
                  </div>
                  <div className="bg-white/50 p-2 rounded-lg border border-success/10 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-success uppercase">Cleaning Max</span>
                    <span className="text-sm font-black text-success">{stats.maxCleaning}F</span>
                  </div>
                </div>
              </div>

              {/* 그리드 영역 */}
              <div className="p-6 overflow-x-auto no-scrollbar">
                <div className="flex gap-2 items-end justify-start min-w-max">
                  
                  {/* 층수 레이블 */}
                  <div className="flex flex-col-reverse gap-1.5 pr-2">
                    <div className="h-6 mb-1 flex items-center justify-end">
                      <span className="text-[9px] font-black text-outline">층</span>
                    </div>
                    {[...Array(basementCount)].map((_, i) => {
                      const f = -(basementCount - i);
                      return <div key={f} className="h-10 flex items-center justify-end text-[10px] font-bold text-outline">B{Math.abs(f)}</div>;
                    })}
                    <div className="h-1 my-1" />
                    {[...Array(maxFloors)].map((_, i) => (
                      <div key={i+1} className="h-10 flex items-center justify-end text-[10px] font-bold text-outline-variant">{i+1}F</div>
                    ))}
                  </div>

                  {/* 세대별 열 */}
                  {b.houses.map(house => (
                    <div key={house.id} className="flex flex-col-reverse gap-1.5 items-center">
                      <div className="text-[10px] font-black text-on-surface-variant mt-2 mb-1 w-full text-center border-t border-outline-variant/20 pt-1">
                        {house.ho.replace('호', '')}
                      </div>

                      {/* 지하층 셀 */}
                      {[...Array(basementCount)].map((_, i) => {
                        const f = -(basementCount - i);
                        const status = getStatus(house.id, f);
                        return (
                          <div 
                            key={f}
                            onClick={() => onCellClick && onCellClick({ building_id: b.id, house_id: house.id, floor: `B${Math.abs(f)}` })}
                            className={`group relative w-12 h-10 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 hover:z-20 border border-outline-variant/20 bg-surface-container-lowest ${getGlowClass(status.latestDate)}`}
                          >
                            <span className="text-[8px] font-bold text-outline group-hover:hidden">B{Math.abs(f)}</span>
                            {status.isOiled && <div className="absolute inset-0 bg-primary/20 rounded-lg -z-10" />}
                          </div>
                        );
                      })}

                      <div className="h-1 w-full bg-outline-variant/30 rounded-full my-1" />

                      {/* 지상층 셀 */}
                      {[...Array(house.floors)].map((_, i) => {
                        const f = i + 1;
                        const status = getStatus(house.id, f);
                        
                        // 배경색 결정 로직 (고도화 버전)
                        let bgClass = 'bg-surface-container-lowest';
                        if (status.progress === 100) bgClass = 'bg-success text-white shadow-success/20';
                        else if (status.isOiled) bgClass = 'bg-primary text-white shadow-primary/20';
                        else if (status.progress > 0) bgClass = 'bg-sky-400 text-white shadow-sky-200/50';

                        return (
                          <div 
                            key={f}
                            onClick={() => onCellClick && onCellClick({ building_id: b.id, house_id: house.id, floor: f.toString() })}
                            className={`group relative w-12 h-10 rounded-lg flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-110 hover:z-20 border border-outline-variant/10 ${bgClass} ${getGlowClass(status.latestDate)} shadow-sm`}
                          >
                            {/* 청소 진행률 바 (배경이 박리제색일 때 아래에서 위로 차오르는 효과) */}
                            {status.isOiled && status.progress > 0 && status.progress < 100 && (
                              <div 
                                className="absolute bottom-0 left-0 right-0 bg-sky-400 rounded-b-lg transition-all duration-500"
                                style={{ height: `${status.progress}%` }}
                              />
                            )}

                            {/* 세대 내 텍스트: 날짜 표시 */}
                            <div className="relative z-10 flex flex-col items-center">
                              {status.latestDate ? (
                                <span className="text-[10px] font-black leading-none drop-shadow-sm">
                                  {formatDateShort(status.latestDate)}
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold opacity-20 group-hover:opacity-100 transition-opacity">{f}F</span>
                              )}
                              {status.progress > 0 && status.progress < 100 && (
                                <span className="text-[7px] font-black mt-0.5 opacity-90">{status.progress}%</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdvancedElevationView;
