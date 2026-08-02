import React, { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';

const API_URL = '/api';

const CONFIG = {
  oiling: {
    label: '박리제칠',
    unitPrice: 74000,
    limits: { '1동': 7, '2동': 7, '3동': 3, '4동': 3, '5동': 3, '6동': 3, '9동': 3, '7동': 2, '8동': 2 }
  },
  cleaning: {
    label: '세대청소',
    unitPrice: 74000,
    limits: { '1동': 4, '2동': 4, '3동': 3, '4동': 3, '5동': 3, '6동': 3, '9동': 3, '7동': 2, '8동': 2 }
  }
};

// 슬라브는 오일링/청소와 달리 건물명별 하드코딩 기준층 표가 없다 — buildings prop의
// slab_base_floor(DB 컬럼)를 그대로 사용한다(CLAUDE.md에서 지적된 하드코딩 안티패턴 방지).
const MODE_LABELS = { oiling: '박리제칠', slab: '슬라브', cleaning: '세대청소' };

const formatFloorRanges = (floors) => {
  const sorted = [...floors].sort((a, b) => a - b);
  const ranges = [];
  let start = null;
  let end = null;

  sorted.forEach((floor) => {
    if (start === null) {
      start = floor;
      end = floor;
      return;
    }
    if (floor === end + 1) {
      end = floor;
      return;
    }
    ranges.push(start === end ? `${start}층` : `${start}-${end}층`);
    start = floor;
    end = floor;
  });

  if (start !== null) {
    ranges.push(start === end ? `${start}층` : `${start}-${end}층`);
  }

  return ranges.join(', ');
};

export default function PaymentStatus({ buildings, summary, currentSite }) {
  const [activeMode, setActiveMode] = useState('oiling');
  const [monthlyAnalysisByMonth, setMonthlyAnalysisByMonth] = useState({});
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [slabPrice, setSlabPrice] = useState(0);

  // 슬라브 단가는 하드코딩 관행이 없어 저장된 단가 설정(site_config)에서 불러온다
  useEffect(() => {
    if (!currentSite?.id) return;
    fetch(`${API_URL}/site-config`, {
      headers: { 'X-Site-Id': currentSite.id, Authorization: `Bearer ${localStorage.getItem('ba_token')}` }
    })
      .then(r => r.json())
      .then(cfg => { if (cfg?.slab_price != null) setSlabPrice(parseInt(cfg.slab_price) || 0); })
      .catch(() => {});
  }, [currentSite?.id]);

  // slabPrice가 저장된 값으로 갱신되면(초기 0 -> 실제값) 이미 0원으로 캐시된 월별 데이터를 무효화
  useEffect(() => { setMonthlyAnalysisByMonth({}); }, [slabPrice]);

  const config = activeMode === 'slab' ? { label: MODE_LABELS.slab, unitPrice: slabPrice } : CONFIG[activeMode];

  const availableMonths = useMemo(() => {
    const records = summary?.[activeMode] || [];
    const months = Array.from(new Set(records.filter(r => r?.date).map(r => dayjs(r.date).format('YYYY-MM'))));
    return months.sort((a, b) => b.localeCompare(a));
  }, [summary, activeMode]);

  useEffect(() => {
    if (availableMonths.length === 0) return;
    if (!availableMonths.includes(Object.keys(monthlyAnalysisByMonth)[0] || '')) return;
    // no-op: rely on fetch effect below to load valid months
  }, [availableMonths, monthlyAnalysisByMonth]);

  useEffect(() => {
    if (!currentSite) return;
    const monthsToLoad = availableMonths.length > 0 ? availableMonths : [dayjs().format('YYYY-MM')];
    const missingMonths = monthsToLoad.filter(m => !monthlyAnalysisByMonth[m]);
    if (missingMonths.length === 0) return;

    setLoadingMonthly(true);
    setAnalysisError(null);

    Promise.all(missingMonths.map(async month => {
      const params = new URLSearchParams({
        month,
        oiling_price: String(CONFIG.oiling.unitPrice),
        cleaning_price: String(CONFIG.cleaning.unitPrice),
        slab_price: String(slabPrice),
        period_mode: 'split'
      });
      const res = await fetch(`${API_URL}/analysis/monthly?${params}`, {
        headers: {
          'X-Site-Id': currentSite.id,
          Authorization: `Bearer ${localStorage.getItem('ba_token')}`
        }
      });
      if (!res.ok) {
        throw new Error(`월별 정산 데이터를 불러오는 중 오류가 발생했습니다: ${month}`);
      }
      return res.json();
    }))
      .then(results => {
        setMonthlyAnalysisByMonth(prev => {
          const next = { ...prev };
          missingMonths.forEach((month, index) => { next[month] = results[index]; });
          return next;
        });
      })
      .catch(err => {
        console.error(err);
        setAnalysisError(err.message || '월별 정산 데이터 로드 실패');
      })
      .finally(() => setLoadingMonthly(false));
  }, [availableMonths, currentSite, monthlyAnalysisByMonth, slabPrice]);

  const getDetailsForMonths = (months) =>
    months.flatMap(month => (monthlyAnalysisByMonth[month]?.[activeMode]?.details || []).filter(r => r.is_billable));

  const monthStats = useMemo(() => {
    const months = Object.keys(monthlyAnalysisByMonth).sort((a, b) => b.localeCompare(a));
    return months.map(month => {
      const details = (monthlyAnalysisByMonth[month]?.[activeMode]?.details || []).filter(r => r.is_billable);
      const households = details.reduce((sum, r) => sum + ((activeMode === 'oiling' || activeMode === 'slab') ? (r.units || 0) : (r.total || 0)), 0);
      const amount = details.reduce((sum, r) => sum + (r.amount || 0), 0);
      return { month, households, amount };
    });
  }, [monthlyAnalysisByMonth, activeMode]);

  const buildingStats = useMemo(() => {
    const allDetails = getDetailsForMonths(Object.keys(monthlyAnalysisByMonth));

    return buildings.map(b => {
      const buildingDetails = allDetails.filter(r => r.building_id === b.id || r.building === b.name);
      const completedTargetHouseholds = buildingDetails.reduce((sum, r) => sum + ((activeMode === 'oiling' || activeMode === 'slab') ? (r.units || 0) : (r.total || 0)), 0);
      const amount = buildingDetails.reduce((sum, r) => sum + (r.amount || 0), 0);
      const limit = activeMode === 'slab' ? (b.slab_base_floor || 0) : (config.limits[b.name] || 0);
      const totalTargetHouseholds = b.houses.reduce((sum, h) => sum + Math.max(0, h.floors - limit), 0);
      return {
        id: b.id,
        name: b.name,
        limit,
        totalTargetHouseholds,
        completedTargetHouseholds,
        amount,
        totalAmount: totalTargetHouseholds * config.unitPrice
      };
    });
  }, [buildings, monthlyAnalysisByMonth, activeMode, config]);

  const totalSum = buildingStats.reduce((acc, b) => acc + b.amount, 0);
  const potentialSum = buildingStats.reduce((acc, b) => acc + b.totalAmount, 0);

  const buildingMonthRanges = useMemo(() => {
    const months = Object.keys(monthlyAnalysisByMonth).sort((a, b) => b.localeCompare(a));
    const ranges = {};

    months.forEach(month => {
      const details = (monthlyAnalysisByMonth[month]?.[activeMode]?.details || []).filter(r => r.is_billable);
      details.forEach(r => {
        const buildingName = r.building || buildings.find(b => b.id === r.building_id)?.name;
        if (!buildingName) return;
        if (!ranges[buildingName]) ranges[buildingName] = {};
        if (!ranges[buildingName][month]) ranges[buildingName][month] = {};

        const phase = activeMode === 'cleaning' ? (r.phase || 1) : 1;
        const phaseKey = `phase_${phase}`;
        if (!ranges[buildingName][month][phaseKey]) {
          ranges[buildingName][month][phaseKey] = { floors: new Set(), amount: 0 };
        }
        ranges[buildingName][month][phaseKey].floors.add(r.floor);
        ranges[buildingName][month][phaseKey].amount += r.amount || 0;
      });
    });

    return Object.entries(ranges).map(([building, months]) => ({
      building,
      monthRanges: Object.entries(months)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([month, phases]) => {
          const expectedPhases = activeMode === 'cleaning' ? [1, 2] : [1];
          return {
            month,
            phaseRanges: expectedPhases.map(phase => {
              const data = phases[`phase_${phase}`];
              if (data) {
                return {
                  phase,
                  range: formatFloorRanges([...data.floors]),
                  amount: data.amount
                };
              }

              return {
                phase,
                range: '미정',
                amount: 0
              };
            })
          };
        })
    }));
  }, [buildings, monthlyAnalysisByMonth, activeMode]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-primary tracking-tight font-headline">기성 현황</h2>
          <p className="text-on-surface-variant font-body mt-1">{config.label} 기준층(기성) 정산 관리</p>
        </div>
        
        {/* 공정 선택 토글 */}
        <div className="flex bg-surface-container p-1 rounded-xl border border-outline-variant/20 shadow-inner">
          {Object.entries(MODE_LABELS).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => setActiveMode(mode)}
              className={`px-6 py-2.5 rounded-lg font-label text-xs uppercase font-black transition-all ${activeMode === mode ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              {label}
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
            {buildingStats.reduce((acc, b) => acc + b.totalTargetHouseholds, 0).toLocaleString()} <span className="text-base font-bold">세대</span>
          </h3>
        </div>
        <div className="bg-secondary/5 border border-secondary/20 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <span className="material-symbols-outlined text-6xl">task_alt</span>
          </div>
          <p className="font-label text-xs uppercase tracking-widest text-secondary font-bold opacity-70">현재 누적 기성 완료</p>
          <h3 className="text-3xl font-black text-secondary mt-2 font-headline">
            {buildingStats.reduce((acc, b) => acc + b.completedTargetHouseholds, 0).toLocaleString()} <span className="text-base font-bold">세대</span>
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
              {monthStats.map(m => (
                <tr key={m.month} className="hover:bg-surface-container-low transition-colors">
                  <td className="py-4 px-4 font-headline font-bold text-lg text-primary">{m.month}</td>
                  <td className="py-4 px-4 font-body text-center font-bold">{m.households}세대</td>
                  <td className="py-4 px-4 font-headline font-black text-right text-success text-xl">{m.amount.toLocaleString()}원</td>
                </tr>
              ))}
              {monthStats.length === 0 && (
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
          {buildingStats.map(b => {
            const progress = b.totalTargetHouseholds > 0 ? (b.completedTargetHouseholds / b.totalTargetHouseholds) * 100 : 0;
            const monthRangeInfo = buildingMonthRanges.find(item => item.building === b.name);
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
                  {monthRangeInfo && (
                    <div className="pt-3 border-t border-outline-variant/10">
                      <p className="text-xs font-bold uppercase tracking-widest text-outline mb-2">월별 기성 층수</p>
                      <div className="space-y-2 text-sm">
                        {monthRangeInfo.monthRanges.map(item => {
                          const ranges = item.phaseRanges || [];
                          const flag = (() => {
                            // 누락: 한 페이즈라도 '미정'인 경우
                            if (ranges.some(r => r.range === '미정' || !r.range)) return '누락';
                            // 중복: cleaning 모드에서 2차가 존재하고 같은 범위인 경우
                            if (activeMode === 'cleaning' && ranges.length >= 2) {
                              const a = ranges[0].range; const b = ranges[1].range;
                              if (a && b && a === b && a !== '미정') return '중복';
                            }
                            return '정상';
                          })();

                          const flagStyle = (() => {
                            if (flag === '정상') return { background: 'rgba(16,185,129,0.08)', color: '#059669', border: '1px solid rgba(16,185,129,0.18)' };
                            if (flag === '누락') return { background: 'rgba(245,158,11,0.08)', color: '#b45309', border: '1px solid rgba(245,158,11,0.18)' };
                            return { background: 'rgba(239,68,68,0.08)', color: '#dc2626', border: '1px solid rgba(239,68,68,0.18)' };
                          })();

                          return (
                            <div key={item.month} className="flex items-center justify-between rounded-lg bg-surface-container p-3 text-on-surface">
                              <div className="font-bold w-28">{item.month}</div>
                              <div className="flex-1 flex gap-4 items-center">
                                {ranges.map(rangeItem => (
                                  <div key={rangeItem.phase} className="flex items-center gap-3">
                                    <span className="inline-flex min-w-[40px] rounded-full bg-primary/10 text-primary px-3 py-1 text-[11px] font-bold">{rangeItem.phase}차</span>
                                    <div>
                                      <div className="font-bold">{rangeItem.range}</div>
                                      <div className="text-sm text-success font-bold">{rangeItem.amount ? rangeItem.amount.toLocaleString() + '원' : '-'}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="text-right min-w-[110px]">
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full" style={flagStyle}>
                                  <span style={{ width: 10, height: 10, borderRadius: 999, background: flag === '정상' ? '#10b981' : flag === '누락' ? '#f59e0b' : '#ef4444' }}></span>
                                  <span className="text-xs font-bold">{flag}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
