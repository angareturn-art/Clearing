import React, { useState, useMemo } from 'react';
import dayjs from 'dayjs';

const CONFIG = {
  oiling: {
    label: '박리제칠',
    unitPrice: 74000,
    limits: { '1동': 7, '2동': 7, '3동': 3, '4동': 3, '5동': 3, '6동': 3, '9동': 3, '7동': 2, '8동': 2 }
  },
  cleaning: {
    label: '세대청소',
    unitPrice: 148000,
    limits: { '1동': 4, '2동': 4, '3동': 3, '4동': 3, '5동': 3, '6동': 3, '9동': 3, '7동': 2, '8동': 2 }
  }
};

export default function PaymentStatus({ buildings, summary }) {
  const [activeMode, setActiveMode] = useState('oiling');
  const config = CONFIG[activeMode];

  // 1. 공정별 레코드 필터링 및 정산 정보 계산
  const stats = useMemo(() => {
    const limits = config.limits;
    const unitPrice = config.unitPrice;

    const buildingStats = buildings.map(b => {
      const limit = limits[b.name] || 0;
      
      // 전체 대상 세대수 (기준층 초과)
      let totalTargetHouseholds = 0;
      b.houses.forEach(h => {
        const targetFloors = Math.max(0, h.floors - limit);
        totalTargetHouseholds += targetFloors;
      });

      // 완료된 대상 세대수 집계
      let completedTargetHouseholds = 0;
      if (activeMode === 'oiling') {
        const targetRecords = (summary.oiling || []).filter(r => r.building_id === b.id && r.floor > limit);
        targetRecords.forEach(r => {
          completedTargetHouseholds += b.houses.filter(h => h.floors >= r.floor).length;
        });
      } else {
        // 세대청소는 각 세대별(house_id)로 phase 4, progress 100% 확인 필요
        // 단, Turn 5에서 oiling은 층별 통합으로 바뀌었으나 cleaning은 여전히 세대별 기록일 가능성이 큼.
        // cleaning records에서 기준층 초과 세대 중 4차 완료된 것 필터링
        const targetRecords = (summary.cleaning || []).filter(r => {
          const house = b.houses.find(h => h.id === r.house_id);
          return house && r.floor > limit && r.phase === 4 && r.progress === 100;
        });
        completedTargetHouseholds = targetRecords.length;
      }

      return {
        id: b.id,
        name: b.name,
        limit,
        totalTargetHouseholds,
        completedTargetHouseholds,
        amount: completedTargetHouseholds * unitPrice,
        totalAmount: totalTargetHouseholds * unitPrice
      };
    });

    // 월별 집계
    const monthlyMap = {};
    const relevantRecords = activeMode === 'oiling' 
      ? (summary.oiling || []).filter(r => {
          const b = buildings.find(build => build.id === r.building_id);
          return b && r.floor > limits[b.name];
        })
      : (summary.cleaning || []).filter(r => {
          const b = buildings.find(build => build.houses.some(h => h.id === r.house_id));
          const limit = b ? limits[b.name] : 0;
          return b && r.floor > limit && r.phase === 4 && r.progress === 100;
        });

    relevantRecords.forEach(r => {
      const month = dayjs(r.date).format('YYYY-MM');
      if (!monthlyMap[month]) monthlyMap[month] = { households: 0, amount: 0 };
      
      let count = 1;
      if (activeMode === 'oiling') {
        const b = buildings.find(build => build.id === r.building_id);
        count = b.houses.filter(h => h.floors >= r.floor).length;
      }

      monthlyMap[month].households += count;
      monthlyMap[month].amount += count * unitPrice;
    });

    const monthlyStats = Object.entries(monthlyMap)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([month, data]) => ({ month, ...data }));

    return { buildingStats, monthlyStats };
  }, [buildings, summary, activeMode, config]);

  const totalSum = stats.buildingStats.reduce((acc, b) => acc + b.amount, 0);
  const potentialSum = stats.buildingStats.reduce((acc, b) => acc + b.totalAmount, 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-primary tracking-tight font-headline">기성 현황</h2>
          <p className="text-on-surface-variant font-body mt-1">{config.label} 기준층(기성) 정산 관리</p>
        </div>
        
        {/* 공정 선택 토글 */}
        <div className="flex bg-surface-container p-1 rounded-xl border border-outline-variant/20 shadow-inner">
          {Object.entries(CONFIG).map(([mode, cfg]) => (
            <button
              key={mode}
              onClick={() => setActiveMode(mode)}
              className={`px-6 py-2.5 rounded-lg font-label text-xs uppercase font-black transition-all ${activeMode === mode ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              {cfg.label}
            </button>
          ))}
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <span className="material-symbols-outlined text-6xl">groups</span>
          </div>
          <p className="font-label text-xs uppercase tracking-widest text-primary font-bold opacity-70">총 {config.label} 기성 대상</p>
          <h3 className="text-3xl font-black text-primary mt-2 font-headline">
            {stats.buildingStats.reduce((acc, b) => acc + b.totalTargetHouseholds, 0).toLocaleString()} <span className="text-base font-bold">세대</span>
          </h3>
        </div>
        <div className="bg-secondary/5 border border-secondary/20 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <span className="material-symbols-outlined text-6xl">task_alt</span>
          </div>
          <p className="font-label text-xs uppercase tracking-widest text-secondary font-bold opacity-70">현재 누적 기성 완료</p>
          <h3 className="text-3xl font-black text-secondary mt-2 font-headline">
            {stats.buildingStats.reduce((acc, b) => acc + b.completedTargetHouseholds, 0).toLocaleString()} <span className="text-base font-bold">세대</span>
          </h3>
        </div>
        <div className="bg-success/5 border border-success/20 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <span className="material-symbols-outlined text-6xl">payments</span>
          </div>
          <p className="font-label text-xs uppercase tracking-widest text-success font-bold opacity-70">누적 기성 금액 (확정)</p>
          <h3 className="text-3xl font-black text-success mt-2 font-headline">
            {totalSum.toLocaleString()} <span className="text-base font-bold">원</span>
          </h3>
          <p className="text-[10px] text-success/60 font-bold mt-1">최대 가능액: {potentialSum.toLocaleString()}원</p>
        </div>
      </div>

      {/* 월별 기성 현황 */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/20">
        <div className="flex items-center gap-2 mb-6">
          <span className="material-symbols-outlined text-primary">calendar_month</span>
          <h3 className="font-label text-sm font-bold uppercase tracking-widest text-primary">월별 {config.label} 집계 명세</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant/30">
                <th className="py-3 px-4 font-label text-[10px] uppercase tracking-widest text-outline">해당 월</th>
                <th className="py-3 px-4 font-label text-[10px] uppercase tracking-widest text-outline text-center">기성 세대수</th>
                <th className="py-3 px-4 font-label text-[10px] uppercase tracking-widest text-outline text-right">기성 금액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {stats.monthlyStats.map(m => (
                <tr key={m.month} className="hover:bg-surface-container-low transition-colors">
                  <td className="py-4 px-4 font-headline font-bold text-lg text-primary">{m.month}</td>
                  <td className="py-4 px-4 font-body text-center font-bold">{m.households}세대</td>
                  <td className="py-4 px-4 font-headline font-black text-right text-success text-xl">{m.amount.toLocaleString()}원</td>
                </tr>
              ))}
              {stats.monthlyStats.length === 0 && (
                <tr><td colSpan="3" className="py-12 text-center text-outline font-body">기성 조건(기준층 초과)에 부합하는 기록이 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 동별 상세 */}
      <div className="bg-surface-container-lowest rounded-2xl p-6 shadow-sm border border-outline-variant/20">
        <div className="flex items-center gap-2 mb-6">
          <span className="material-symbols-outlined text-primary">analytics</span>
          <h3 className="font-label text-sm font-bold uppercase tracking-widest text-primary">동별 기성 상세 (기준층 제외 실적)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stats.buildingStats.map(b => {
            const progress = b.totalTargetHouseholds > 0 ? (b.completedTargetHouseholds / b.totalTargetHouseholds) * 100 : 0;
            return (
              <div key={b.id} className="border border-outline-variant/30 rounded-xl p-5 space-y-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-headline font-black text-xl text-primary">{b.name}</h4>
                    <p className="text-[10px] font-bold text-error border border-error/20 bg-error/5 rounded-md px-2 py-1 inline-block mt-2">
                      기준층: {b.limit}층 이하 제외
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-label text-[10px] uppercase text-outline">정산율</p>
                    <p className="font-headline font-black text-secondary">{progress.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-outline">기성 완료</span>
                    <span className="text-on-surface">{b.completedTargetHouseholds} / {b.totalTargetHouseholds} 세대</span>
                  </div>
                  <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                    <div className="h-full bg-secondary rounded-full transition-all duration-700" style={{ width: `${progress}%` }}></div>
                  </div>
                  <div className="flex justify-between text-base font-black pt-3 border-t border-outline-variant/10 mt-2">
                    <span className="text-xs text-outline font-bold">기성 금액</span>
                    <span className="text-primary">{b.amount.toLocaleString()}원</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
