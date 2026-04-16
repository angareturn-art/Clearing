import React from 'react';

const ElevationView = ({ buildings, summary, onCellClick, viewMode = 'total' }) => {
  const getStatus = (houseId, floor) => {
    const oiling = summary.oiling?.find(r => r.house_id === houseId && r.floor === floor);
    const cleaning = summary.cleaning
      ?.filter(r => r.house_id === houseId && r.floor === floor)
      .sort((a, b) => b.phase - a.phase)[0];
    
    return {
      isOiled: !!oiling,
      phase: cleaning ? cleaning.phase : 0,
      progress: cleaning ? cleaning.progress : 0,
    };
  };

  const BASE_LIMITS = {
    oiling: { '1동': 7, '2동': 7, '3동': 3, '4동': 3, '5동': 3, '6동': 3, '9동': 3, '7동': 2, '8동': 2 },
    cleaning: { '1동': 4, '2동': 4, '3동': 3, '4동': 3, '5동': 3, '6동': 3, '9동': 3, '7동': 2, '8동': 2 }
  };

  const getLimit = (buildingName) => {
    const mode = viewMode === 'oiling' ? 'oiling' : 'cleaning';
    return BASE_LIMITS[mode][buildingName] || 0;
  };

  const getCellClasses = (status, isBasement = false) => {
    let classes = "flex items-center justify-center rounded-sm transition-all duration-300 relative group-hover:scale-105 ";
    classes += isBasement ? "w-10 h-8 font-label text-[10px] " : "w-10 h-6 cursor-pointer font-label text-[10px] ";
    
    // Default Empty
    let bg = "bg-surface-container-lowest border border-outline-variant/30 text-outline";
    let icon = null;

    if (viewMode === 'oiling') {
      if (status.isOiled) { bg = "bg-warning text-white border-0 shadow-sm"; icon = "check"; }
      else { bg = "opacity-30"; }
    } else if (viewMode === 'cleaning') {
      if (status.progress === 100) { bg = "bg-success text-white border-0 shadow-sm"; icon = "done_all"; }
      else if (status.phase > 0) { 
        bg = "bg-secondary-container text-white border-0 shadow-sm animate-pulse"; 
        icon = "mop"; 
      }
      else { bg = "opacity-30"; }
    } else {
      // Total Mode
      if (status.progress === 100) { bg = "bg-success text-white border-0 shadow-sm"; icon = "done_all"; }
      else if (status.phase > 0) { bg = "bg-secondary-container text-white border-0 shadow-sm animate-pulse"; icon = "mop"; }
      else if (status.isOiled) { bg = "bg-primary text-white border-0 shadow-sm"; icon = "done"; }
    }

    return { classes: `${classes} ${bg}`, icon };
  };

  return (
    <div className="space-y-8">
      {/* Legend / Stats */}
      <div className="bg-surface-container-lowest rounded-lg blueprint-grid p-6 lg:p-8 relative">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-6">
            <div className="flex flex-col gap-2">
               <div className="flex items-center gap-2">
                 <div className="w-3 h-3 bg-primary rounded-sm shadow-sm"></div>
                 <span className="font-label text-[10px] uppercase font-bold text-on-surface">박리제칠 완료</span>
               </div>
               <div className="flex items-center gap-2">
                 <div className="w-3 h-3 bg-secondary-container rounded-sm shadow-sm animate-pulse"></div>
                 <span className="font-label text-[10px] uppercase font-bold text-on-surface">청소 진행 중</span>
               </div>
               <div className="flex items-center gap-2">
                 <div className="w-3 h-3 bg-success rounded-sm shadow-sm"></div>
                 <span className="font-label text-[10px] uppercase font-bold text-on-surface">세대 최종 완료</span>
               </div>
            </div>
          </div>
          <div className="flex gap-4 p-4 bg-white/50 backdrop-blur rounded border border-outline-variant/20 shadow-sm">
             <div className="text-center">
                <p className="font-label text-[9px] uppercase tracking-tighter text-outline">모드</p>
                <p className="text-xs font-bold text-primary">{viewMode === 'total' ? '현장 전체 통합뷰' : viewMode === 'oiling' ? '박리제칠 추적뷰' : '세대청소 추적뷰'}</p>
             </div>
          </div>
        </div>

        {/* 3x3 Grid Layout for Buildings */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {buildings.map(b => (
            <div key={b.id} className="bg-surface/90 backdrop-blur-md rounded-lg shadow-lg border border-outline-variant/30 p-6 flex flex-col justify-between overflow-hidden">
              <div className="flex items-center justify-between mb-6 pb-2 border-b border-outline-variant/30 relative z-10">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">domain</span>
                  <h3 className="font-headline font-black tracking-tight text-xl text-primary">{b.name}</h3>
                </div>
                <span className="font-label text-[10px] bg-primary/10 text-primary px-2 py-1 rounded-sm uppercase tracking-wider font-bold">
                  {viewMode === 'oiling' ? '층별 통합 관리' : `${b.houses.length} Units`}
                </span>
              </div>
              
              {viewMode === 'oiling' ? (
                <div className="flex justify-center pb-2 relative z-10 w-full">
                  <div className="flex flex-col-reverse gap-1 items-center group w-full max-w-[120px]">
                    <div className="text-center font-label text-[10px] font-bold text-on-surface-variant mt-2 mb-1 w-full border-t border-outline-variant/20 pt-1">
                      해당 동 전체
                    </div>

                    {/* Basement (Oiling) */}
                    {Array.from({ length: b.basement_count || 0 }).map((_, i) => {
                      const floor = -(b.basement_count - i);
                      const status = { isOiled: !!summary.oiling?.find(r => r.building_id === b.id && r.floor === floor) };
                      const label = floor === -1 ? 'B1' : floor === -2 ? 'B2' : `B${Math.abs(floor)}`;
                      const { classes, icon } = getCellClasses(status, true);
                      
                      return (
                        <div 
                          key={`total-b-${floor}`}
                          className={`${classes} w-full`}
                          title={`${b.name} ${label}`}
                          onClick={() => onCellClick && onCellClick({ building_id: b.id, floor: `B${Math.abs(floor)}` })}
                        >
                          {icon && <span className="material-symbols-outlined text-sm font-bold opacity-30 absolute inset-0 m-auto">{icon}</span>}
                          <span className="z-10 text-[8px] font-bold uppercase tracking-tighter truncate w-full text-center px-[2px] opacity-90">{label}</span>
                        </div>
                      );
                    })}

                    <div className="h-1 w-full bg-outline-variant/50 rounded-full my-1"></div>

                    {/* Ground (Oiling) */}
                    {Array.from({ length: Math.max(...b.houses.map(h => h.floors), 0) }).map((_, i) => {
                      const floor = i + 1;
                      const status = { isOiled: !!summary.oiling?.find(r => r.building_id === b.id && r.floor === floor) };
                      const { classes, icon } = getCellClasses(status, false);
                      const limit = getLimit(b.name);
                      
                      return (
                        <React.Fragment key={`total-${floor}`}>
                          {/* Divider Line */}
                          {floor === limit + 1 && (
                            <div className="w-full h-[2px] bg-error shadow-[0_0_8px_rgba(255,0,0,0.5)] my-[1px] relative z-20">
                              <span className="absolute -right-12 top-1/2 -translate-y-1/2 text-[8px] font-bold text-error whitespace-nowrap">기성 기준</span>
                            </div>
                          )}
                          <div 
                            className={`${classes} w-full`}
                            title={`${b.name} ${floor}층`}
                            onClick={() => onCellClick && onCellClick({ building_id: b.id, floor: floor.toString() })}
                          >
                            {icon ? <span className="material-symbols-outlined text-sm">{icon}</span> : <span className="opacity-40">{floor}</span>}
                          </div>
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 items-end justify-center overflow-x-auto pb-2 no-scrollbar relative z-10">
                  {b.houses.map(house => (
                    <div key={house.id} className="flex flex-col-reverse gap-1 items-center group">
                      <div className="text-center font-label text-[10px] font-bold text-on-surface-variant mt-2 mb-1 w-full border-t border-outline-variant/20 pt-1">
                        {house.ho.replace('호', '')}
                      </div>

                      {/* Basement */}
                      {Array.from({ length: b.basement_count || 0 }).map((_, i) => {
                        const floor = -(b.basement_count - i);
                        const status = getStatus(house.id, floor);
                        const label = floor === -1 ? house.basement_label_b1 : floor === -2 ? house.basement_label_b2 : `B${Math.abs(floor)}`;
                        const { classes, icon } = getCellClasses(status, true);
                        
                        return (
                          <div 
                            key={`b-${floor}`}
                            className={classes}
                            title={`${house.ho} ${label}`}
                            onClick={() => onCellClick && onCellClick({ building_id: b.id, house_id: house.id, floor: `B${Math.abs(floor)}` })}
                          >
                            {icon && <span className="material-symbols-outlined text-sm font-bold opacity-30 absolute inset-0 m-auto">{icon}</span>}
                            <span className="z-10 text-[8px] font-bold uppercase tracking-tighter truncate w-full text-center px-[2px] opacity-90">{label}</span>
                          </div>
                        );
                      })}

                      <div className="h-1 w-full bg-outline-variant/50 rounded-full my-1"></div>

                      {/* Ground */}
                      {Array.from({ length: house.floors }).map((_, i) => {
                        const floor = i + 1;
                        const status = getStatus(house.id, floor);
                        const { classes, icon } = getCellClasses(status, false);
                        const limit = getLimit(b.name);
                        
                        return (
                          <React.Fragment key={floor}>
                            {/* Divider Line */}
                            {floor === limit + 1 && (
                              <div className="w-full h-[2px] bg-error shadow-[0_0_4px_rgba(255,0,0,0.5)] my-[1px] relative z-20"></div>
                            )}
                            <div 
                              className={classes}
                              title={`${b.name} ${floor}층 ${house.ho}`}
                              onClick={() => onCellClick && onCellClick({ building_id: b.id, house_id: house.id, floor: floor.toString() })}
                            >
                              {icon ? <span className="material-symbols-outlined text-sm">{icon}</span> : <span className="opacity-40">{floor}</span>}
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ElevationView;
