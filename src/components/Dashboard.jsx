import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';

const API_URL = '/api';

// ── 기성금액 요약 패널 ──────────────────────────────────────────
const ContractSummaryPanel = ({ data }) => {
  if (!data) return null;
  const { contract, total_units } = data;
  const fmt = (n) => n?.toLocaleString() ?? '—';

  return (
    <div className="bg-primary rounded-2xl p-5 shadow-lg relative overflow-hidden">
      {/* 배경 장식 */}
      <div className="absolute right-0 top-0 w-64 h-full opacity-[0.04] pointer-events-none select-none">
        <span className="material-symbols-outlined text-[180px] text-white absolute -right-4 top-1/2 -translate-y-1/2">paid</span>
      </div>

      <div className="relative z-10 flex flex-wrap items-center gap-5 lg:gap-8">
        {/* 총 기성금액 */}
        <div className="flex-shrink-0">
          <p className="text-[9px] font-label uppercase tracking-[0.2em] text-white/40 mb-1">총 기성금액</p>
          <p className="text-[32px] font-black text-white leading-none font-headline">
            {fmt(contract?.total)}
            <span className="text-sm font-normal text-white/40 ml-1">원</span>
          </p>
          <p className="text-[10px] font-label text-white/30 mt-1.5">전체 세대 {fmt(total_units)}세대 기준</p>
        </div>

        {/* 구분선 */}
        <div className="hidden lg:block w-px self-stretch bg-white/10" />

        {/* 구분별 세대·금액 */}
        <div className="flex gap-5 flex-wrap">
          {[
            { label: '기름치칠', key: 'oiling', icon: 'format_paint' },
            { label: '1차 청소', key: 'phase1', icon: 'cleaning_services' },
            { label: '2차 청소', key: 'phase2', icon: 'done_all' },
          ].map(({ label, key, icon }) => (
            <div key={key} className="text-center min-w-[90px]">
              <div className="flex items-center justify-center gap-1 mb-1">
                <span className="material-symbols-outlined text-secondary text-[13px]">{icon}</span>
                <p className="text-[9px] font-label uppercase tracking-widest text-white/40">{label}</p>
              </div>
              <p className="text-[18px] font-black text-white/90 font-headline leading-none">
                {fmt(contract?.[key]?.units)}<span className="text-[10px] font-normal text-white/30 ml-0.5">세대</span>
              </p>
              <p className="text-[10px] font-label text-secondary/80 mt-0.5">{fmt(contract?.[key]?.amount)}원</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── 월별 기성 진행 막대그래프 ─────────────────────────────────────
const MonthlyProgressChart = ({ data }) => {
  if (!data) return null;
  const { monthly_settled = [], contract, settled_total = 0, remaining = 0 } = data;
  const contractTotal = contract?.total || 1;
  const CHART_H = 96; // px

  const fmt  = (n) => n?.toLocaleString() ?? '0';
  const fmtK = (n) => {
    if (!n) return '0원';
    if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억원`;
    if (n >= 10_000)      return `${Math.round(n / 10_000)}만원`;
    return `${n.toLocaleString()}원`;
  };

  const settledPct = Math.min(Math.round((settled_total / contractTotal) * 100), 100);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-[18px]">stacked_bar_chart</span>
          <h3 className="font-label text-sm font-bold uppercase tracking-widest text-primary">월별 기성 진행 현황</h3>
        </div>
        {/* 전체 진행률 바 */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-40 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-secondary transition-all duration-700"
              style={{ width: `${settledPct}%` }}
            />
          </div>
          <span className="text-[10px] font-label font-bold text-secondary">{settledPct}% 기수령</span>
        </div>
      </div>

      <div className="p-5 flex items-stretch gap-5">

        {/* 왼쪽: 남은 금액 */}
        <div className="flex-shrink-0 w-[120px] bg-primary/5 border border-primary/10 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-1">
          <p className="text-[8px] font-label uppercase tracking-[0.15em] text-gray-400">남은 기성</p>
          <p className="text-[22px] font-black text-primary font-headline leading-none">{fmtK(remaining)}</p>
          <p className="text-[9px] font-label text-gray-400">{fmt(remaining)}원</p>
          <div className="mt-2 pt-2 border-t border-primary/10 w-full">
            <p className="text-[8px] font-label text-gray-400">기수령</p>
            <p className="text-[11px] font-bold text-secondary font-label">{fmtK(settled_total)}</p>
          </div>
        </div>

        {/* 오른쪽: 막대 그래프 */}
        <div className="flex-1 min-w-0">
          {monthly_settled.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-300 font-label">
              마감된 월이 없습니다
            </div>
          ) : (
            <>
              {/* 목표 금액 레이블 */}
              <div className="flex justify-end mb-1">
                <span className="text-[9px] font-label text-gray-300 border-b border-dashed border-gray-200 pr-1">
                  목표 {fmtK(contractTotal)}
                </span>
              </div>

              {/* 막대 영역 */}
              <div
                className="flex items-end gap-3 border-b-2 border-gray-100 relative"
                style={{ height: CHART_H }}
              >
                {/* 목표선 */}
                <div className="absolute bottom-0 left-0 right-0 border-t-2 border-dashed border-secondary/20 pointer-events-none"
                  style={{ bottom: CHART_H - 2 }} />

                {monthly_settled.map((m, i) => {
                  const barH    = Math.max(Math.round((m.total / contractTotal) * CHART_H), 4);
                  const oilH    = m.total > 0 ? Math.round((m.oiling / m.total) * barH) : 0;
                  const p1H     = m.total > 0 ? Math.round((m.phase1 / m.total) * barH) : 0;
                  const p2H     = barH - oilH - p1H;
                  return (
                    <div key={i} className="flex flex-col items-center gap-0 group flex-1 min-w-[36px]">
                      <div className="w-full flex flex-col items-center">
                        {/* 금액 tooltip */}
                        <div className="mb-1 opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-label text-gray-400 whitespace-nowrap">
                          {fmtK(m.total)}
                        </div>
                        {/* 적층 막대 */}
                        <div className="w-full max-w-[40px] mx-auto flex flex-col" style={{ height: barH }}>
                          {p2H > 0 && (
                            <div
                              className="w-full rounded-t-md bg-secondary"
                              style={{ height: p2H }}
                              title={`2차 청소: ${fmt(m.phase2)}원`}
                            />
                          )}
                          {p1H > 0 && (
                            <div
                              className="w-full bg-green"
                              style={{ height: p1H, backgroundColor: '#1b6b35' }}
                              title={`1차 청소: ${fmt(m.phase1)}원`}
                            />
                          )}
                          {oilH > 0 && (
                            <div
                              className={`w-full bg-primary ${p2H === 0 && p1H === 0 ? 'rounded-t-md' : ''}`}
                              style={{ height: oilH }}
                              title={`기름치칠: ${fmt(m.oiling)}원`}
                            />
                          )}
                        </div>
                      </div>
                      <p className="text-[9px] font-label font-bold text-primary mt-1.5">
                        {m.month.slice(5)}월
                      </p>
                      <p className="text-[8px] font-label text-gray-300">{fmtK(m.total)}</p>
                    </div>
                  );
                })}

                {/* 진행 중 월 (현재 월, 미마감) */}
                <div className="flex flex-col items-center gap-0 flex-1 min-w-[36px] opacity-30">
                  <div className="w-full flex flex-col items-center">
                    <div className="mb-1 text-[9px] font-label text-gray-400 whitespace-nowrap opacity-0">-</div>
                    <div className="w-full max-w-[40px] mx-auto flex flex-col items-center justify-end border-2 border-dashed border-gray-300 rounded-md"
                      style={{ height: 20 }} />
                  </div>
                  <p className="text-[9px] font-label font-bold text-gray-400 mt-1.5">
                    {dayjs().format('MM')}월~
                  </p>
                </div>
              </div>

              {/* 범례 */}
              <div className="flex items-center gap-4 mt-3 flex-wrap">
                {[
                  { color: 'bg-primary',   label: '기름치칠' },
                  { color: '',             label: '1차 청소', hex: '#1b6b35' },
                  { color: 'bg-secondary', label: '2차 청소' },
                ].map(({ color, label, hex }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <div
                      className={`w-2.5 h-2.5 rounded-sm ${color}`}
                      style={hex ? { backgroundColor: hex } : {}}
                    />
                    <span className="text-[10px] font-label text-gray-400">{label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const KpiCard = ({ label, value, sub, pct, icon, accent = false }) => (
  <div className={`bg-white rounded-xl p-5 border shadow-sm flex flex-col gap-2 ${accent ? 'border-secondary/30' : 'border-gray-100'}`}>
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-label font-bold uppercase tracking-widest text-gray-400">{label}</p>
      <span className={`material-symbols-outlined text-[18px] ${accent ? 'text-secondary' : 'text-gray-300'}`}>{icon}</span>
    </div>
    <p className={`text-3xl font-black font-headline leading-none ${accent ? 'text-secondary' : 'text-primary'}`}>{value}</p>
    {pct !== undefined && (
      <div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${accent ? 'bg-secondary' : 'bg-primary/40'}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <p className={`text-[10px] font-label font-bold mt-1 ${accent ? 'text-secondary' : 'text-gray-400'}`}>{pct}% 완료</p>
      </div>
    )}
    {sub && !pct && <p className="text-[11px] text-gray-400 font-label">{sub}</p>}
  </div>
);

const Dashboard = ({ buildings, summary, siteConfig }) => {
  const [weather, setWeather] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [showWeather, setShowWeather] = useState(() => localStorage.getItem('dashboard_show_weather') !== 'false');
  const [contractSummary, setContractSummary] = useState(null);

  useEffect(() => { fetchAndSaveWeather(); }, [siteConfig?.latitude, siteConfig?.longitude]);

  useEffect(() => {
    fetch(`${API_URL}/dashboard/contract-summary`)
      .then(r => r.json())
      .then(setContractSummary)
      .catch(() => {});
  }, []);

  const fetchAndSaveWeather = async () => {
    const lat = siteConfig?.latitude || '37.5665';
    const lon = siteConfig?.longitude || '126.9780';
    setLoadingWeather(true);
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,wind_speed_10m,precipitation,weather_code&timezone=Asia/Seoul`);
      const geoData = await res.json();
      const current = geoData.current;
      const wData = {
        date: dayjs().format('YYYY-MM-DD'),
        temperature: current.temperature_2m,
        wind_speed: current.wind_speed_10m,
        precipitation: current.precipitation,
        condition: getWeatherCondition(current.weather_code)
      };
      setWeather(wData);
      await fetch(`${API_URL}/weather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wData)
      });
    } catch (e) {
      setWeather({ temperature: '--', wind_speed: '--', precipitation: '--', condition: '정보 없음' });
    } finally {
      setLoadingWeather(false);
    }
  };

  const getWeatherCondition = (code) => {
    if (code === 0) return '맑음';
    if (code <= 3) return '구름 조금';
    if (code <= 67) return '비';
    if (code <= 77) return '눈';
    if (code <= 82) return '소나기';
    return '흐림';
  };

  const getWeatherIcon = (condition) => {
    if (!condition) return 'wb_sunny';
    if (condition.includes('맑음')) return 'wb_sunny';
    if (condition.includes('구름')) return 'partly_cloudy_day';
    if (condition.includes('비') || condition.includes('소나기')) return 'rainy';
    if (condition.includes('눈')) return 'ac_unit';
    return 'cloud';
  };

  // ── KPI 계산 ──
  const totalUnits = buildings.reduce((acc, b) =>
    acc + b.houses.reduce((a, h) => a + h.floors + (b.basement_count || 0), 0), 0);
  const oiledCount = new Set(summary.oiling?.map(r => `${r.building_id}-${r.floor}`)).size;
  const phase1Count = summary.cleaning?.filter(r => r.phase === 1).length || 0;
  const phase2Count = summary.cleaning?.filter(r => r.phase >= 2).length || 0;
  const unloadedCount = summary.unloading?.filter(r => r.phase >= 1).length || 0;

  // ── 동별 진행률 ──
  const buildingProgress = buildings.map(b => {
    const bBasement = Number(b.basement_count) || 0;
    const totalFloors = b.houses.reduce((a, h) => a + (Number(h.floors) || 0) + bBasement, 0);
    const maxGround = Math.max(...b.houses.map(h => Number(h.floors) || 0), 0);
    const totalOilFloors = maxGround + bBasement;

    const allOilFloors = [
      ...Array.from({ length: bBasement }).map((_, i) => -(bBasement - i)),
      ...Array.from({ length: maxGround }).map((_, i) => i + 1)
    ];
    const oiledFloors = allOilFloors.filter(f =>
      summary.oiling?.some(r => r.building_id === b.id && r.floor === f)
    ).length;

    const cleanedFloors = b.houses.reduce((a, h) => {
      const hFloors = Number(h.floors) || 0;
      const allF = [
        ...Array.from({ length: bBasement }).map((_, i) => -(bBasement - i)),
        ...Array.from({ length: hFloors }).map((_, i) => i + 1)
      ];
      return a + allF.reduce((sum, f) => {
        const relevant = summary.cleaning?.filter(r => r.house_id === h.id && r.floor === f) || [];
        const maxPhase = relevant.length > 0 ? Math.max(...relevant.map(r => r.phase)) : 0;
        return sum + (maxPhase >= 2 ? 1.0 : maxPhase >= 1 ? 0.5 : 0);
      }, 0);
    }, 0);

    const p1 = b.houses.reduce((a, h) => {
      const hFloors = Number(h.floors) || 0;
      const allF = [...Array.from({ length: bBasement }).map((_, i) => -(bBasement - i)), ...Array.from({ length: hFloors }).map((_, i) => i + 1)];
      return a + allF.filter(f => summary.cleaning?.some(r => r.house_id === h.id && r.floor === f && r.phase === 1)).length;
    }, 0);

    const p2 = b.houses.reduce((a, h) => {
      const hFloors = Number(h.floors) || 0;
      const allF = [...Array.from({ length: bBasement }).map((_, i) => -(bBasement - i)), ...Array.from({ length: hFloors }).map((_, i) => i + 1)];
      return a + allF.filter(f => summary.cleaning?.some(r => r.house_id === h.id && r.floor === f && r.phase >= 2)).length;
    }, 0);

    return {
      name: b.name,
      totalFloors,
      totalOilFloors,
      oiledFloors,
      p1,
      p2,
      cleanedFloors: Number(cleanedFloors.toFixed(1)),
      oilRate: totalOilFloors > 0 ? Math.round((oiledFloors / totalOilFloors) * 100) : 0,
      cleanRate: totalFloors > 0 ? Math.round((cleanedFloors / totalFloors) * 100) : 0,
    };
  });

  // ── 최근 활동 ──
  const recentActivity = [
    ...(summary.cleaning?.slice(0, 3) || []).map(r => ({ ...r, type: '청소', color: 'bg-secondary' })),
    ...(summary.oiling?.slice(0, 2) || []).map(r => ({ ...r, type: '박리제', color: 'bg-primary' })),
    ...(summary.unloading?.slice(0, 2) || []).map(r => ({ ...r, type: '하역', color: 'bg-tertiary' })),
  ].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 6);

  const phase2Total = phase1Count + phase2Count;

  return (
    <div className="space-y-6 max-w-7xl">

      {/* ── 페이지 헤드라인 ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] font-label font-bold uppercase tracking-[0.2em] text-secondary mb-1">
            청소 공정 관리 시스템
          </p>
          <h2 className="text-3xl font-black text-primary tracking-tight font-headline leading-tight">
            현장 공정 현황 리포트
          </h2>
          <p className="text-sm text-gray-400 font-label mt-1">
            {dayjs().format('YYYY년 MM월 DD일 dddd')} · 실시간 현황
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {showWeather && (
            <button
              onClick={fetchAndSaveWeather}
              className="flex items-center gap-1 text-[10px] font-label uppercase tracking-widest text-gray-400 hover:text-secondary transition-colors"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>날씨 갱신
            </button>
          )}
          <button
            onClick={() => { const next = !showWeather; setShowWeather(next); localStorage.setItem('dashboard_show_weather', next); }}
            className="flex items-center gap-1 text-[10px] font-label uppercase tracking-widest text-gray-400 hover:text-secondary transition-colors"
          >
            <span className="material-symbols-outlined text-sm">{showWeather ? 'visibility_off' : 'visibility'}</span>
            {showWeather ? '날씨 숨기기' : '날씨 표시'}
          </button>
        </div>
      </div>

      {/* ── 총 기성금액 패널 ── */}
      <ContractSummaryPanel data={contractSummary} />

      {/* ── 월별 기성 진행 막대그래프 ── */}
      <MonthlyProgressChart data={contractSummary} />

      {/* ── KPI 카드 행 ── */}
      <div className={`grid gap-4 ${showWeather ? 'grid-cols-2 lg:grid-cols-5' : 'grid-cols-2 lg:grid-cols-4'}`}>

        {/* 날씨 카드 */}
        {showWeather && (
          <div className="col-span-2 lg:col-span-1 bg-primary rounded-xl p-5 text-white relative overflow-hidden shadow-lg">
            <div className="absolute -right-3 -top-3 opacity-10">
              <span className="material-symbols-outlined text-[80px]">{getWeatherIcon(weather?.condition)}</span>
            </div>
            <p className="text-[9px] font-label uppercase tracking-widest opacity-50 mb-2">오늘 날씨</p>
            {loadingWeather ? (
              <div className="animate-pulse h-12 bg-white/10 rounded-lg" />
            ) : (
              <div className="relative z-10">
                <div className="flex items-end gap-2 mb-2">
                  <span className="text-4xl font-black font-headline">{weather?.temperature}°</span>
                  <span className="text-sm opacity-70 mb-1">{weather?.condition}</span>
                </div>
                <div className="flex gap-4">
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs opacity-50">air</span>
                    <span className="text-[10px] font-label opacity-70">{weather?.wind_speed} m/s</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs opacity-50">water_drop</span>
                    <span className="text-[10px] font-label opacity-70">{weather?.precipitation} mm</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <KpiCard
          label="총 작업 공간"
          value={totalUnits.toLocaleString()}
          sub="전체 세대·층 기준"
          icon="apartment"
        />
        <KpiCard
          label="1차 청소"
          value={phase1Count}
          pct={totalUnits > 0 ? Math.round(phase1Count / totalUnits * 100) : 0}
          icon="cleaning_services"
        />
        <KpiCard
          label="2차 청소 완료"
          value={phase2Count}
          pct={phase2Total > 0 ? Math.round(phase2Count / phase2Total * 100) : 0}
          icon="done_all"
          accent
        />
        <KpiCard
          label="박리제칠 완료"
          value={oiledCount}
          sub={`층 단위 ${oiledCount}건`}
          icon="format_paint"
        />
      </div>

      {/* ── 메인 2열 레이아웃 ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* 동별 현황 테이블 (2/3) */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">bar_chart</span>
            <h3 className="font-label text-sm font-bold uppercase tracking-widest text-primary">동별 공정 현황</h3>
          </div>

          {buildingProgress.length === 0 ? (
            <div className="py-16 text-center text-gray-400 font-label text-sm">기준 정보를 먼저 설정하세요.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-[10px] font-label font-bold uppercase tracking-widest text-gray-400">동</th>
                    <th className="px-4 py-3 text-right text-[10px] font-label font-bold uppercase tracking-widest text-gray-400">전체</th>
                    <th className="px-4 py-3 text-right text-[10px] font-label font-bold uppercase tracking-widest text-gray-400">1차</th>
                    <th className="px-4 py-3 text-right text-[10px] font-label font-bold uppercase tracking-widest text-gray-400">2차</th>
                    <th className="px-4 py-3 text-right text-[10px] font-label font-bold uppercase tracking-widest text-gray-400">박리</th>
                    <th className="px-4 py-3 text-[10px] font-label font-bold uppercase tracking-widest text-gray-400 min-w-[120px]">진행률</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {buildingProgress.map((bp, i) => {
                    const isComplete = bp.cleanRate >= 100;
                    const isHigh = bp.cleanRate >= 80;
                    return (
                      <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-primary font-label">{bp.name}</td>
                        <td className="px-4 py-3.5 text-right text-gray-500 font-label">{bp.totalFloors}</td>
                        <td className="px-4 py-3.5 text-right font-label">
                          <span className={`font-bold ${bp.p1 > 0 ? 'text-primary' : 'text-gray-300'}`}>{bp.p1}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-label">
                          <span className={`font-bold ${bp.p2 > 0 ? 'text-secondary' : 'text-gray-300'}`}>{bp.p2}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right font-label">
                          <span className={`font-bold ${bp.oiledFloors > 0 ? 'text-gray-600' : 'text-gray-300'}`}>{bp.oiledFloors}</span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${isComplete ? 'bg-secondary' : isHigh ? 'bg-secondary/70' : 'bg-primary/40'}`}
                                style={{ width: `${bp.cleanRate}%` }}
                              />
                            </div>
                            <span className={`text-[10px] font-label font-bold w-8 text-right flex-shrink-0 ${isComplete ? 'text-secondary' : 'text-gray-400'}`}>
                              {bp.cleanRate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 우측 사이드 패널 (1/3) */}
        <div className="flex flex-col gap-4">

          {/* 전체 요약 스냅샷 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-[18px]">analytics</span>
              <h3 className="font-label text-sm font-bold uppercase tracking-widest text-primary">현장 요약</h3>
            </div>
            <div className="px-5 py-4 space-y-3">
              {[
                { label: '전체 작업 공간', value: totalUnits, unit: '건', color: '' },
                { label: '1차 청소', value: phase1Count, unit: '건', color: 'text-primary' },
                { label: '2차 청소 완료', value: phase2Count, unit: '건', color: 'text-secondary' },
                { label: '박리제칠', value: oiledCount, unit: '층', color: '' },
                { label: '하역 완료', value: unloadedCount, unit: '건', color: '' },
              ].map((item, i) => (
                <div key={i}>
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] font-label text-gray-400">{item.label}</span>
                    <span className={`text-sm font-black font-label ${item.color || 'text-primary'}`}>
                      {item.value.toLocaleString()} <span className="font-normal text-gray-400 text-[10px]">{item.unit}</span>
                    </span>
                  </div>
                  {i < 4 && <div className="h-px bg-gray-50 mt-3" />}
                </div>
              ))}
            </div>
          </div>

          {/* 최근 작업 내역 */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-gray-400 text-[18px]">history</span>
              <h3 className="font-label text-sm font-bold uppercase tracking-widest text-gray-500">최근 작업</h3>
            </div>
            <div className="px-5 py-3">
              {recentActivity.length === 0 ? (
                <p className="text-center text-gray-400 font-label text-xs py-4">기록된 작업이 없습니다.</p>
              ) : (
                <div className="space-y-2.5">
                  {recentActivity.map((r, i) => (
                    <div key={i} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${r.color}`} />
                        <span className="text-[11px] font-label text-gray-700 leading-tight">
                          {r.building_name} {r.ho || ''} {r.floor}층
                          <span className="text-gray-400"> · {r.type}</span>
                        </span>
                      </div>
                      <span className="text-[9px] font-label text-gray-300 flex-shrink-0">{r.date}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 날씨 없을 때 정보 블록 */}
          {!showWeather && (
            <div className="bg-primary rounded-xl p-5 text-white">
              <p className="text-[9px] font-label uppercase tracking-widest opacity-40 mb-2">오늘 날씨</p>
              <p className="text-xs text-white/50 font-label">날씨 정보 비활성화됨</p>
              <button
                onClick={() => { setShowWeather(true); localStorage.setItem('dashboard_show_weather', true); }}
                className="mt-2 text-[10px] text-white/40 hover:text-white/80 font-label uppercase tracking-widest transition-colors"
              >활성화</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
