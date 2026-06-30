import React, { useState } from 'react';

const MATRIX_TABS = [
  { id: 'oiling',    title: '갱폼 박리제칠', activeClass: 'bg-primary text-white',      indicatorClass: 'bg-primary' },
  { id: 'clean1',    title: '1차 세대청소',  activeClass: 'bg-sky-500 text-white',      indicatorClass: 'bg-sky-500' },
  { id: 'clean2',    title: '2차 세대청소',  activeClass: 'bg-success text-white',      indicatorClass: 'bg-success' },
  { id: 'unloading', title: '하역',          activeClass: 'bg-purple-500 text-white',   indicatorClass: 'bg-purple-500' },
];

const MatrixTable = ({ title, viewMode, buildings, summary, maxFloor }) => {
  const floors = Array.from({ length: maxFloor }, (_, i) => maxFloor - i);

  const getStatus = (buildingId, floor) => {
    const b = buildings.find(b => b.id === buildingId);
    if (!b) return { total: 0, completed: 0 };

    const validHouses = b.houses.filter(h => {
      const sf = h.start_floor || 1;
      return floor >= sf && floor <= h.floors;
    });

    const total = validHouses.length;
    if (total === 0) return { total: 0, completed: 0 };

    let completed = 0;

    if (viewMode === 'oiling') {
      const isOiled = summary.oiling?.some(r => r.building_id === buildingId && r.floor === floor);
      completed = isOiled ? total : 0;
    } else {
      validHouses.forEach(h => {
        if (viewMode === 'clean1') {
          const hasClean1 = summary.cleaning?.some(r => r.house_id === h.id && r.floor === floor && r.phase >= 1);
          if (hasClean1) completed++;
        } else if (viewMode === 'clean2') {
          const hasClean2Signed = summary.cleaning?.some(r => r.house_id === h.id && r.floor === floor && r.phase >= 2 && r.confirmed === 1);
          if (hasClean2Signed) completed++;
        } else if (viewMode === 'clean2_unsigned') {
          const hasClean2 = summary.cleaning?.some(r => r.house_id === h.id && r.floor === floor && r.phase >= 2 && r.confirmed !== 1);
          if (hasClean2) completed++;
        } else if (viewMode === 'unloading') {
          const hasUnload = summary.unloading?.some(r => r.house_id === h.id && r.floor === floor && r.phase >= 1);
          if (hasUnload) completed++;
        }
      });
    }

    return { total, completed };
  };

  return (
    <div className="bg-surface-container-lowest rounded-xl p-2 md:p-3 shadow-md border border-outline-variant/30 flex flex-col">
      <div className="hidden md:block text-center font-headline font-black text-xs md:text-sm text-on-surface mb-2 tracking-widest border-b border-outline-variant/30 pb-2">
        {title}
      </div>
      <div className="overflow-x-auto overflow-y-hidden flex-1">
        <table className="w-full text-center border-collapse">
          <thead>
            <tr>
              <th className="p-0 border-b border-r border-outline-variant/40 w-6">
                <span className="text-[8px] text-outline font-black block text-center">F\동</span>
              </th>
              {buildings.map(b => (
                <th key={b.id} className="p-0 border-b border-outline-variant/40 w-8">
                  <span className="font-headline font-black text-on-surface text-[9px]">{b.name.replace('동', '')}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {floors.map(floor => (
              <tr key={floor} className="hover:bg-surface-container-low/50 transition-colors">
                <td className="p-0 border-r border-outline-variant/40 font-headline font-bold text-on-surface-variant text-[9px] text-center w-6 h-[18px]">
                  {floor}
                </td>

                {buildings.map(b => {
                  const { total, completed } = getStatus(b.id, floor);

                  let bgClass = '';
                  let textClass = 'text-on-surface-variant';

                  if (total > 0) {
                    if (viewMode === 'oiling') {
                      if (completed > 0) {
                        bgClass = 'bg-primary text-white shadow-sm';
                        textClass = 'text-white';
                      } else {
                        bgClass = 'bg-surface-container border border-outline-variant/20';
                      }
                    } else if (completed === total) {
                      if (viewMode === 'clean1')          bgClass = 'bg-sky-500 text-white shadow-sm';
                      if (viewMode === 'clean2')          bgClass = 'bg-green-700 text-white shadow-sm';
                      if (viewMode === 'clean2_unsigned') bgClass = 'bg-lime-500 text-stone-900 shadow-sm';
                      if (viewMode === 'unloading')       bgClass = 'bg-purple-500 text-white shadow-sm';
                      textClass = 'text-white';
                    } else if (completed > 0) {
                      if (viewMode === 'clean1')          bgClass = 'bg-sky-500/20 text-sky-600 border border-sky-500/30';
                      if (viewMode === 'clean2')          bgClass = 'bg-green-700/20 text-green-700 border border-green-700/30';
                      if (viewMode === 'clean2_unsigned') bgClass = 'bg-lime-500/20 text-lime-700 border border-lime-500/30';
                      if (viewMode === 'unloading')       bgClass = 'bg-purple-500/20 text-purple-600 border border-purple-500/30';
                      textClass = 'font-bold';
                    } else {
                      bgClass = 'bg-surface-container border border-outline-variant/20';
                    }
                  }

                  const limit = viewMode === 'oiling'
                    ? (b.oiling_base_floor || 0)
                    : viewMode === 'unloading'
                    ? (b.unloading_base_floor || 0)
                    : (b.cleaning_base_floor || 0);
                  const isBaseline = floor === limit + 1;

                  return (
                    <td key={`${b.id}-${floor}`} className={`p-[1px] relative ${isBaseline ? 'border-b-[2px] border-error shadow-[0_2px_4px_rgba(255,0,0,0.3)]' : ''}`}>
                      {total > 0 ? (
                        <div className={`mx-auto w-full h-[16px] rounded-[2px] flex items-center justify-center transition-all ${bgClass}`}>
                          <span className={`font-headline text-[8px] ${textClass} font-black`}>
                            {viewMode === 'oiling' ? total : (completed === total ? total : `${completed}/${total}`)}
                          </span>
                        </div>
                      ) : (
                        <div className="mx-auto w-full h-[16px] rounded-[2px] flex items-center justify-center bg-surface-variant/20">
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

const MatrixStatusView = ({ buildings, summary }) => {
  const [activeTab, setActiveTab] = useState('oiling');

  const maxFloor = Math.max(
    ...buildings.map(b => Math.max(...b.houses.map(h => h.floors || 0), 0)),
    0
  );

  const activeTabInfo = MATRIX_TABS.find(t => t.id === activeTab);

  return (
    <div className="w-full max-w-full animate-in fade-in duration-500">

      {/* 모바일 전용 탭 셀렉터 */}
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

      {/* 모바일: 선택된 매트릭스 1개만 표시 */}
      <div className="md:hidden">
        <div className={`text-center font-headline font-black text-sm mb-2 px-2 py-1.5 rounded-lg ${activeTabInfo?.activeClass}`}>
          {activeTabInfo?.title}
        </div>
        <MatrixTable
          title={activeTabInfo?.title}
          viewMode={activeTab}
          buildings={buildings}
          summary={summary}
          maxFloor={maxFloor}
        />
      </div>

      {/* 태블릿 / PC: 그리드 표시 */}
      <div className="hidden md:grid md:grid-cols-2 xl:grid-cols-4 gap-2">
        {MATRIX_TABS.map(t => (
          <MatrixTable
            key={t.id}
            title={t.title}
            viewMode={t.id}
            buildings={buildings}
            summary={summary}
            maxFloor={maxFloor}
          />
        ))}
      </div>

    </div>
  );
};

export default MatrixStatusView;
