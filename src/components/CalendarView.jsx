import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';

const API_URL = 'http://localhost:5000/api';

const CalendarView = ({ summary }) => {
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedDayDetail, setSelectedDayDetail] = useState(null);
  const [weatherCache, setWeatherCache] = useState({});

  const startOfMonth = currentDate.startOf('month').startOf('week');
  const endOfMonth = currentDate.endOf('month').endOf('week');

  const days = [];
  let day = startOfMonth;
  while (day.isBefore(endOfMonth)) {
    days.push(day);
    day = day.add(1, 'day');
  }

  const getDayRecords = (date) => {
    const formattedDate = date.format('YYYY-MM-DD');
    const oiling = (summary.oiling || []).filter(r => r.date === formattedDate);
    const cleaning = (summary.cleaning || []).filter(r => r.date === formattedDate);
    const lifting = (summary.lifting || []).filter(r => r.date === formattedDate);
    return { oiling, cleaning, lifting };
  };

  const handleDayClick = async (d) => {
    setSelectedDay(d);
    const dateStr = d.format('YYYY-MM-DD');
    // 날씨 조회
    if (!weatherCache[dateStr]) {
      try {
        const res = await fetch(`${API_URL}/weather?date=${dateStr}`);
        const data = await res.json();
        if (data) setWeatherCache(prev => ({ ...prev, [dateStr]: data }));
      } catch {}
    }
    setSelectedDayDetail(getDayRecords(d));
  };

  const weatherIcon = (condition) => {
    if (!condition) return 'wb_sunny';
    if (condition.includes('맑음')) return 'wb_sunny';
    if (condition.includes('구름')) return 'partly_cloudy_day';
    if (condition.includes('비')) return 'rainy';
    if (condition.includes('눈')) return 'ac_unit';
    return 'cloud';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-black text-primary tracking-tight font-headline">작업 일정 캘린더</h2>
          <p className="text-on-surface-variant font-body mt-1">월간 공정 현황 및 기록 확인</p>
        </div>
      </div>

      {/* 헤더 탐색 */}
      <div className="bg-surface-container-lowest rounded-lg p-4 shadow-sm border border-outline-variant/20 flex items-center justify-between">
        <button onClick={() => setCurrentDate(currentDate.subtract(1, 'month'))} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined text-primary">chevron_left</span>
        </button>
        <div className="flex items-center gap-4">
          <span className="font-headline font-black text-2xl text-primary">{currentDate.format('YYYY년 MM월')}</span>
          <button onClick={() => setCurrentDate(dayjs())} className="font-label text-[10px] uppercase tracking-widest bg-primary/10 text-primary px-3 py-1.5 rounded hover:bg-primary/20 transition-colors">오늘</button>
        </div>
        <button onClick={() => setCurrentDate(currentDate.add(1, 'month'))} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined text-primary">chevron_right</span>
        </button>
      </div>

      {/* 달력 그리드 */}
      <div className="bg-surface-container-lowest rounded-lg shadow-sm border border-outline-variant/20 overflow-hidden">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 border-b border-outline-variant/20">
          {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
            <div key={d} className={`py-3 text-center font-label text-[10px] uppercase tracking-widest ${i === 0 ? 'text-error' : i === 6 ? 'text-primary' : 'text-outline'}`}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((d, index) => {
            const records = getDayRecords(d);
            const isToday = d.isSame(dayjs(), 'day');
            const isCurrentMonth = d.isSame(currentDate, 'month');
            const isSelected = selectedDay && d.isSame(selectedDay, 'day');
            const hasRecords = records.oiling.length + records.cleaning.length + records.lifting.length > 0;

            return (
              <div
                key={index}
                onClick={() => handleDayClick(d)}
                className={`min-h-[100px] p-2 border-b border-r border-outline-variant/10 cursor-pointer transition-all
                  ${isToday ? 'bg-primary/5' : ''}
                  ${isSelected ? 'ring-2 ring-primary ring-inset' : ''}
                  ${isCurrentMonth ? 'hover:bg-surface-container-low' : 'opacity-40'}
                `}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`w-7 h-7 flex items-center justify-center rounded-full font-label text-sm font-bold
                    ${isToday ? 'bg-primary text-white' : 'text-on-surface-variant'}
                  `}>
                    {d.date()}
                  </span>
                  {hasRecords && <span className="w-1.5 h-1.5 bg-secondary-container rounded-full"></span>}
                </div>
                <div className="space-y-0.5">
                  {records.lifting.map((r, i) => (
                    <div key={i} className="text-[9px] px-1.5 py-0.5 bg-error text-white rounded truncate font-label">
                      {r.building_name} 인양
                    </div>
                  ))}
                  {records.oiling.length > 0 && (
                    <div className="text-[9px] px-1.5 py-0.5 bg-primary text-white rounded truncate font-label">
                      박리제칠 {records.oiling.length}건
                    </div>
                  )}
                  {records.cleaning.length > 0 && (
                    <div className="text-[9px] px-1.5 py-0.5 bg-secondary-container text-white rounded truncate font-label">
                      청소 {records.cleaning.length}건
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 선택된 날짜 상세 패널 */}
      {selectedDay && selectedDayDetail && (
        <div className="bg-surface-container-lowest rounded-lg p-6 shadow-sm border border-outline-variant/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-label text-sm font-bold uppercase tracking-widest text-primary">
              {selectedDay.format('YYYY년 MM월 DD일 dddd')} 상세
            </h3>
            <button onClick={() => setSelectedDay(null)} className="text-outline hover:text-on-surface">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          {/* 과거 날씨 */}
          {weatherCache[selectedDay.format('YYYY-MM-DD')] && (
            <div className="flex items-center gap-4 bg-primary/5 rounded-lg p-4 mb-4">
              <span className="material-symbols-outlined text-primary text-2xl">
                {weatherIcon(weatherCache[selectedDay.format('YYYY-MM-DD')]?.condition)}
              </span>
              <div className="flex gap-6">
                <div>
                  <p className="font-label text-[9px] text-outline uppercase tracking-widest">기온</p>
                  <p className="font-label font-bold text-on-surface">{weatherCache[selectedDay.format('YYYY-MM-DD')]?.temperature}°C</p>
                </div>
                <div>
                  <p className="font-label text-[9px] text-outline uppercase tracking-widest">풍속</p>
                  <p className="font-label font-bold text-on-surface">{weatherCache[selectedDay.format('YYYY-MM-DD')]?.wind_speed} m/s</p>
                </div>
                <div>
                  <p className="font-label text-[9px] text-outline uppercase tracking-widest">강수</p>
                  <p className="font-label font-bold text-on-surface">{weatherCache[selectedDay.format('YYYY-MM-DD')]?.precipitation} mm</p>
                </div>
                <div>
                  <p className="font-label text-[9px] text-outline uppercase tracking-widest">날씨</p>
                  <p className="font-label font-bold text-on-surface">{weatherCache[selectedDay.format('YYYY-MM-DD')]?.condition}</p>
                </div>
              </div>
            </div>
          )}

          {/* 작업 기록 요약 */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: '인양', count: selectedDayDetail.lifting.length, color: 'text-error bg-error/10' },
              { label: '박리제칠', count: selectedDayDetail.oiling.length, color: 'text-primary bg-primary/10' },
              { label: '청소', count: selectedDayDetail.cleaning.length, color: 'text-success bg-success/10' },
            ].map(item => (
              <div key={item.label} className={`rounded-lg p-4 ${item.color}`}>
                <p className="font-label text-[9px] uppercase tracking-widest opacity-70">{item.label}</p>
                <p className="font-headline font-black text-2xl">{item.count}</p>
                <p className="font-label text-[9px] opacity-60">건</p>
              </div>
            ))}
          </div>

          {/* 상세 목록 */}
          {[...selectedDayDetail.lifting.map(r => ({ ...r, type: '인양' })),
            ...selectedDayDetail.oiling.map(r => ({ ...r, type: '박리제칠' })),
            ...selectedDayDetail.cleaning.map(r => ({ ...r, type: '청소' }))
          ].map((r, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-outline-variant/20 last:border-0">
              <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${r.type === '청소' ? 'bg-success' : r.type === '박리제칠' ? 'bg-primary' : 'bg-error'}`}></span>
              <span className="font-body text-sm text-on-surface">{r.building_name} {r.ho || ''} {r.floor ? `${r.floor}층` : ''} {r.type}</span>
              {r.phase && <span className="font-label text-[9px] bg-surface-container px-2 py-0.5 rounded text-outline">{r.phase}차 공정 {r.progress}%</span>}
            </div>
          ))}
          {(selectedDayDetail.lifting.length + selectedDayDetail.oiling.length + selectedDayDetail.cleaning.length) === 0 && (
            <p className="text-center text-outline font-body py-4">이 날짜에는 기록된 작업이 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default CalendarView;
