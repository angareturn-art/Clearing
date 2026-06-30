import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';

const API_URL = '/api';

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

  useEffect(() => { fetchAndSaveWeather(); }, [siteConfig?.latitude, siteConfig?.longitude]);

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
