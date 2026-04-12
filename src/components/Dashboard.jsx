import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';

const API_URL = 'http://localhost:5000/api';

const Dashboard = ({ buildings, summary }) => {
  const [weather, setWeather] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(true);

  useEffect(() => {
    fetchAndSaveWeather();
  }, []);

  const fetchAndSaveWeather = async () => {
    setLoadingWeather(true);
    try {
      // Open-Meteo 무료 API (서울 좌표)
      const geoRes = await fetch('https://api.open-meteo.com/v1/forecast?latitude=37.5665&longitude=126.9780&current=temperature_2m,wind_speed_10m,precipitation,weather_code&timezone=Asia/Seoul');
      const geoData = await geoRes.json();
      const current = geoData.current;
      const wData = {
        date: dayjs().format('YYYY-MM-DD'),
        temperature: current.temperature_2m,
        wind_speed: current.wind_speed_10m,
        precipitation: current.precipitation,
        condition: getWeatherCondition(current.weather_code)
      };
      setWeather(wData);
      // DB 저장
      await fetch(`${API_URL}/weather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wData)
      });
    } catch (e) {
      // fallback
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

  // KPI 계산
  const totalUnits = buildings.reduce((acc, b) => acc + b.houses.reduce((a, h) => a + h.floors + (b.basement_count || 0), 0), 0);
  const oiledCount = new Set(summary.oiling?.map(r => `${r.house_id}-${r.floor}`)).size;
  const cleanedCount = summary.cleaning?.filter(r => r.progress === 100).length || 0;
  const inProgressCount = summary.cleaning?.filter(r => r.progress < 100).length || 0;
  const liftingCount = summary.lifting?.length || 0;

  // 동별 진행률
  const buildingProgress = buildings.map(b => {
    const totalFloors = b.houses.reduce((a, h) => a + h.floors, 0);
    const oiledFloors = b.houses.reduce((a, h) => {
      return a + Array.from({ length: h.floors }, (_, i) => i + 1).filter(f =>
        summary.oiling?.some(r => r.house_id === h.id && r.floor === f)
      ).length;
    }, 0);
    const cleanedFloors = b.houses.reduce((a, h) => {
      return a + Array.from({ length: h.floors }, (_, i) => i + 1).filter(f =>
        summary.cleaning?.some(r => r.house_id === h.id && r.floor === f && r.progress === 100)
      ).length;
    }, 0);
    return {
      name: b.name,
      totalFloors,
      oiledFloors,
      cleanedFloors,
      oilRate: totalFloors > 0 ? Math.round((oiledFloors / totalFloors) * 100) : 0,
      cleanRate: totalFloors > 0 ? Math.round((cleanedFloors / totalFloors) * 100) : 0,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black text-primary tracking-tight font-headline">현장 대시보드</h2>
          <p className="text-on-surface-variant font-body mt-1">{dayjs().format('YYYY년 MM월 DD일 dddd')} · 실시간 현황</p>
        </div>
        <button onClick={fetchAndSaveWeather} className="flex items-center gap-2 text-xs font-label uppercase tracking-widest text-outline hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-sm">refresh</span> 날씨 갱신
        </button>
      </div>

      {/* 날씨 + KPI 상단 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* 날씨 */}
        <div className="col-span-2 lg:col-span-2 bg-gradient-to-br from-primary to-primary-container text-white rounded-lg p-6 relative overflow-hidden shadow-lg">
          <div className="absolute -right-4 -top-4 opacity-10">
            <span className="material-symbols-outlined text-[120px]">{getWeatherIcon(weather?.condition)}</span>
          </div>
          <p className="font-label text-[10px] uppercase tracking-widest opacity-70 mb-3">오늘 날씨 · 서울</p>
          {loadingWeather ? (
            <div className="animate-pulse h-16 bg-white/20 rounded"></div>
          ) : (
            <div className="relative z-10">
              <div className="flex items-end gap-3 mb-3">
                <span className="text-5xl font-black font-headline">{weather?.temperature}°</span>
                <span className="text-xl opacity-80 mb-2">{weather?.condition}</span>
              </div>
              <div className="flex gap-6">
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm opacity-70">air</span>
                  <span className="font-label text-xs">{weather?.wind_speed} m/s</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm opacity-70">water_drop</span>
                  <span className="font-label text-xs">{weather?.precipitation} mm</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* KPI 카드 */}
        {[
          { label: '박리제칠 완료', value: oiledCount, icon: 'format_paint', color: 'text-primary', bg: 'bg-primary/10' },
          { label: '청소 완료', value: cleanedCount, icon: 'done_all', color: 'text-success', bg: 'bg-success/10' },
          { label: '진행 중', value: inProgressCount, icon: 'pending', color: 'text-secondary', bg: 'bg-secondary/10' },
          { label: '인양 기록', value: liftingCount, icon: 'arrow_upward', color: 'text-error', bg: 'bg-error/10' },
        ].map((kpi, i) => (
          <div key={i} className="bg-surface-container-lowest rounded-lg p-5 shadow-sm border border-outline-variant/20">
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${kpi.bg} mb-3`}>
              <span className={`material-symbols-outlined ${kpi.color}`}>{kpi.icon}</span>
            </div>
            <p className="text-3xl font-black font-headline text-on-surface">{kpi.value}</p>
            <p className="font-label text-[10px] uppercase tracking-widest text-outline mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* 동별 진행률 */}
      <div className="bg-surface-container-lowest rounded-lg p-6 shadow-sm border border-outline-variant/20">
        <div className="flex items-center gap-2 mb-6">
          <span className="material-symbols-outlined text-primary">bar_chart</span>
          <h3 className="font-label text-sm font-bold uppercase tracking-widest text-primary">동별 공정 진행률</h3>
        </div>
        <div className="space-y-5">
          {buildingProgress.map((bp, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-2">
                <span className="font-label font-bold text-on-surface">{bp.name}</span>
                <div className="flex gap-4">
                  <span className="font-label text-[10px] text-primary uppercase tracking-wider">박리 {bp.oilRate}%</span>
                  <span className="font-label text-[10px] text-success uppercase tracking-wider">청소 {bp.cleanRate}%</span>
                </div>
              </div>
              <div className="relative h-3 bg-surface-container rounded-full overflow-hidden">
                <div className="absolute left-0 top-0 h-full bg-primary/30 rounded-full transition-all duration-700" style={{ width: `${bp.oilRate}%` }}></div>
                <div className="absolute left-0 top-0 h-full bg-success rounded-full transition-all duration-700" style={{ width: `${bp.cleanRate}%` }}></div>
              </div>
              <div className="flex justify-between mt-1">
                <span className="font-label text-[9px] text-outline">{bp.cleanedFloors}/{bp.totalFloors} 세대 완료</span>
              </div>
            </div>
          ))}
          {buildingProgress.length === 0 && (
            <p className="text-center text-outline font-body py-8">기준 정보를 먼저 설정하세요.</p>
          )}
        </div>
      </div>

      {/* 최근 활동 */}
      <div className="bg-surface-container-lowest rounded-lg p-6 shadow-sm border border-outline-variant/20">
        <div className="flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-secondary">history</span>
          <h3 className="font-label text-sm font-bold uppercase tracking-widest text-secondary">최근 작업 내역</h3>
        </div>
        <div className="space-y-2">
          {[...( summary.cleaning?.slice(0, 3) || []).map(r => ({ ...r, type: '청소' })),
            ...(summary.oiling?.slice(0, 2) || []).map(r => ({ ...r, type: '박리제칠' })),
            ...(summary.lifting?.slice(0, 1) || []).map(r => ({ ...r, type: '인양' }))
          ].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')).slice(0, 5).map((r, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-outline-variant/20 last:border-0">
              <div className="flex items-center gap-3">
                <span className={`inline-block w-2 h-2 rounded-full ${r.type === '청소' ? 'bg-success' : r.type === '박리제칠' ? 'bg-primary' : 'bg-error'}`}></span>
                <span className="font-body text-sm text-on-surface">{r.building_name} {r.ho || ''} {r.floor}층 {r.type}</span>
              </div>
              <span className="font-label text-[10px] text-outline">{r.date}</span>
            </div>
          ))}
          {(summary.cleaning?.length + summary.oiling?.length + summary.lifting?.length) === 0 && (
            <p className="text-center text-outline font-body py-4">기록된 작업이 없습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
