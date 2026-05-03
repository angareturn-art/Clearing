import React, { useState, useMemo } from 'react';
import dayjs from 'dayjs';

const fmt = (n) => (n || 0).toLocaleString();

// 4월 말 기준 동별 최종 실적 데이터 (DB 기반 고정)
const APRIL_BASE = {
  '1동': { floor: 9 }, '2동': { floor: 9 }, '3동': { floor: 5 },
  '4동': { floor: 6 }, '5동': { floor: 0 }, '6동': { floor: 2 },
  '7동': { floor: 3 }, '8동': { floor: 0 }, '9동': { floor: 5 },
};

export default function RevenueProjection({ buildings }) {
  const [targetMonth, setTargetMonth] = useState('2026-05');
  const [oilingPrice, setOilingPrice] = useState(74000);
  const [cleaningPrice, setCleaningPrice] = useState(74000);

  // 시뮬레이션 로직
  const projection = useMemo(() => {
    if (!buildings || buildings.length === 0) return null;

    const startOfMonth = dayjs(targetMonth).startOf('month');
    const endOfMonth = dayjs(targetMonth).endOf('month');
    
    // 해당 월의 화요일 개수 계산 (매주 화요일 1층 상승 가정)
    let tuesdays = 0;
    let curr = startOfMonth;
    while (curr.isBefore(endOfMonth) || curr.isSame(endOfMonth)) {
      if (curr.day() === 2) tuesdays++;
      curr = curr.add(1, 'day');
    }

    const results = buildings.map(b => {
      const base = APRIL_BASE[b.name] || { floor: 0 };
      const startFloor = base.floor;
      const endFloor = startFloor + tuesdays;
      
      const unitCount = b.houses?.length || 0;
      
      // 박리제 계산 (startFloor+1 ~ endFloor 구간 중 base_floor 초과분)
      let oilingBillable = 0;
      for (let f = startFloor + 1; f <= endFloor; f++) {
        if (f > (b.oiling_base_floor || 0)) oilingBillable++;
      }
      const oilingAmount = oilingBillable * unitCount * oilingPrice;

      // 청소 계산 (박리제 층수 - 3 기준)
      let cleaningBillable = 0;
      for (let f = startFloor + 1; f <= endFloor; f++) {
        const cleaningFloor = f - 3;
        if (cleaningFloor > (b.cleaning_base_floor || 0)) cleaningBillable++;
      }
      const cleaningAmount = cleaningBillable * unitCount * cleaningPrice;

      return {
        name: b.name,
        units: unitCount,
        startFloor,
        endFloor,
        oilingBillable,
        oilingAmount,
        cleaningBillable,
        cleaningAmount,
        total: oilingAmount + cleaningAmount,
        base_o: b.oiling_base_floor,
        base_c: b.cleaning_base_floor
      };
    }).sort((a, b) => {
      const numA = parseInt(a.name.replace(/[^0-9]/g, '')) || 0;
      const numB = parseInt(b.name.replace(/[^0-9]/g, '')) || 0;
      return numA - numB;
    });

    const totalOiling = results.reduce((s, r) => s + r.oilingAmount, 0);
    const totalCleaning = results.reduce((s, r) => s + r.cleaningAmount, 0);

    return { results, totalOiling, totalCleaning, total: totalOiling + totalCleaning, tuesdays };
  }, [buildings, targetMonth, oilingPrice, cleaningPrice]);

  if (!projection) return <div className="p-20 text-center text-outline">건물 정보가 없습니다.</div>;

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-primary font-headline tracking-tight">월별 예상 수입 분석</h2>
          <p className="text-on-surface-variant mt-1">4월 실적 기반 매주 화요일 1개층 상승 시뮬레이션 (v3)</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 bg-surface-container p-3 rounded-xl border border-outline-variant/20">
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-outline uppercase mb-1">분석 대상 월</label>
            <input 
              type="month" 
              value={targetMonth} 
              onChange={e => setTargetMonth(e.target.value)}
              className="bg-surface border border-outline-variant/30 rounded-lg px-3 py-2 text-sm font-bold focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-outline uppercase mb-1">박리제 단가</label>
            <input 
              type="number" 
              value={oilingPrice} 
              onChange={e => setOilingPrice(Number(e.target.value))}
              className="w-28 bg-surface border border-outline-variant/30 rounded-lg px-3 py-2 text-sm font-bold outline-none"
            />
          </div>
          <div className="flex flex-col">
            <label className="text-[10px] font-black text-outline uppercase mb-1">청소 단가</label>
            <input 
              type="number" 
              value={cleaningPrice} 
              onChange={e => setCleaningPrice(Number(e.target.value))}
              className="w-28 bg-surface border border-outline-variant/30 rounded-lg px-3 py-2 text-sm font-bold outline-none"
            />
          </div>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 shadow-sm">
          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">박리제 예상 수입</p>
          <p className="text-3xl font-black text-primary">{fmt(projection.totalOiling)}<span className="text-sm ml-1">원</span></p>
          <div className="mt-4 flex items-center gap-2 text-[10px] text-primary/70 font-bold">
            <span className="material-symbols-outlined text-sm">event</span>
            화요일 {projection.tuesdays}회 작업 예정
          </div>
        </div>
        <div className="bg-secondary/5 border border-secondary/20 rounded-2xl p-6 shadow-sm">
          <p className="text-xs font-bold text-secondary uppercase tracking-widest mb-1">세대 청소 예상 수입</p>
          <p className="text-3xl font-black text-secondary">{fmt(projection.totalCleaning)}<span className="text-sm ml-1">원</span></p>
          <p className="mt-4 text-[10px] text-secondary/70 font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">cleaning_services</span>
            박리제 대비 3개층 하부(N-3) 기준
          </p>
        </div>
        <div className="bg-gradient-to-br from-primary to-primary-container text-white rounded-2xl p-6 shadow-lg shadow-primary/20">
          <p className="text-xs font-bold text-white/80 uppercase tracking-widest mb-1">{dayjs(targetMonth).format('M월')} 총 예상 수입</p>
          <p className="text-3xl font-black">{fmt(projection.total)}<span className="text-sm ml-1">원</span></p>
          <p className="mt-4 text-[10px] text-white/70 font-bold">세금 및 공과금 제외 순 수입액</p>
        </div>
      </div>

      {/* 상세 테이블 */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant/20 overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-outline-variant/20 bg-surface-dim/5">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">table_rows</span>
            동별 상세 시뮬레이션 (1동~9동)
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-dim/10 border-b border-outline-variant/20">
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest">동</th>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest text-center">세대수</th>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest text-center">진행(F)</th>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest text-right">박리제(유상)</th>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest text-right">청소(유상)</th>
                <th className="px-6 py-3 text-[10px] font-black text-outline uppercase tracking-widest">비고</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {projection.results.map(r => (
                <tr key={r.name} className="hover:bg-primary/5 transition-colors">
                  <td className="px-6 py-4 font-black text-on-surface">{r.name}</td>
                  <td className="px-6 py-4 text-center font-bold text-on-surface-variant">{r.units}</td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-xs bg-surface-container px-2 py-1 rounded font-bold">
                      {r.startFloor}F → {r.endFloor}F
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-col">
                      <span className="font-black text-primary">{fmt(r.oilingAmount)}원</span>
                      <span className="text-[10px] text-outline">{r.oilingBillable}개층 유상</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex flex-col">
                      <span className="font-black text-secondary">{fmt(r.cleaningAmount)}원</span>
                      <span className="text-[10px] text-outline">{r.cleaningBillable}개층 유상</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {r.oilingBillable === 0 && <span className="text-[9px] bg-warning/10 text-warning px-1.5 py-0.5 rounded font-bold border border-warning/20">박리제 무상</span>}
                      {r.cleaningBillable === 0 && <span className="text-[9px] bg-warning/10 text-warning px-1.5 py-0.5 rounded font-bold border border-warning/20">청소 무상</span>}
                      {r.oilingBillable > 0 && <span className="text-[9px] bg-success/10 text-success px-1.5 py-0.5 rounded font-bold border border-success/20">정상 정산</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
