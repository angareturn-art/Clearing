import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';

const API_URL = '/api';

// 동(building)마다 고정 색상을 부여해 그리드/상세 패널에서 일관되게 표시
// MatrixStatusView2의 "월별 색상" 팔레트와 동일 (12색, 인접 색상 간 구분이 뚜렷함)
const BUILDING_COLORS = [
  '#3B82F6', '#8B5CF6', '#EC4899', '#EF4444', '#F97316', '#EAB308',
  '#84CC16', '#22C55E', '#14B8A6', '#06B6D4', '#6366F1', '#A855F7',
];

const CalendarView = ({ summary, currentSite, buildings = [] }) => {
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [selectedDay, setSelectedDay] = useState(null);
  const [weatherCache, setWeatherCache] = useState({});
  const [showDailyAmount, setShowDailyAmount] = useState(false);
  const [filterBuilding, setFilterBuilding] = useState(null); // null = 전체 동
  const [monthlyAnalysis, setMonthlyAnalysis] = useState(null);
  const [analysisError, setAnalysisError] = useState(null);
  const [scheduleEvents, setScheduleEvents] = useState([]);
  const [eventForm, setEventForm] = useState(null); // null = 닫힘, {} = 새 일정, {id,...} = 수정

  const EVENT_CATEGORIES = {
    general: { label: '일반', color: 'bg-primary' },
    notice:  { label: '공지', color: 'bg-error' },
    visit:   { label: '방문', color: 'bg-tertiary' },
    material:{ label: '자재', color: 'bg-secondary' },
  };

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
    const byBuilding = (r) => !filterBuilding || r.building_id === Number(filterBuilding);
    const oiling = (summary.oiling || []).filter(r => r.date === formattedDate && byBuilding(r));
    const cleaning = (summary.cleaning || []).filter(r => r.date === formattedDate && byBuilding(r));
    const unloading = (summary.unloading || []).filter(r => r.date === formattedDate && byBuilding(r));
    return { oiling, cleaning, unloading };
  };

  const getMonthTotalAmount = () => {
    return monthlyAnalysis?.summary?.income || 0;
  };

  const getBuildingColor = (buildingId) => {
    const idx = buildings.findIndex(b => b.id === buildingId);
    return BUILDING_COLORS[(idx >= 0 ? idx : 0) % BUILDING_COLORS.length];
  };

  // {oiling, cleaning, unloading}를 "동 + 유형 + 건수" 배지 목록으로 변환 (그리드 칸 전용)
  const buildTypeBadges = (dayRecords) => {
    const tagged = [
      ...dayRecords.oiling.map(r => ({ ...r, type: '박리제칠' })),
      ...dayRecords.cleaning.map(r => ({ ...r, type: '청소' })),
      ...(dayRecords.unloading || []).map(r => ({ ...r, type: '하역' })),
    ];
    const groups = {};
    tagged.forEach(r => {
      const key = `${r.building_id}_${r.type}`;
      if (!groups[key]) groups[key] = { buildingId: r.building_id, buildingName: r.building_name || '미지정', type: r.type, count: 0 };
      groups[key].count += 1;
    });
    return Object.values(groups).sort((a, b) => a.buildingName.localeCompare(b.buildingName) || a.type.localeCompare(b.type));
  };

  // 동/층 단위로 묶어서 "101동 6층 1호, 2호, 3호" 형태로 표시
  const groupRecordsByFloor = (rows) => {
    const groups = {};
    rows.forEach(r => {
      const key = `${r.type}_${r.building_name}_${r.floor}_${r.phase || ''}`;
      if (!groups[key]) groups[key] = { type: r.type, building_name: r.building_name, floor: r.floor, phase: r.phase, hos: [] };
      if (r.ho) groups[key].hos.push(r.ho);
    });
    const hoNum = (s) => parseInt(s, 10) || 0;
    return Object.values(groups).map(g => ({ ...g, hos: [...g.hos].sort((a, b) => hoNum(a) - hoNum(b)) }));
  };

  // 상세 패널 목록을 동(building) 단위로 묶고, 동 안에서는 기존 층별 그룹핑을 재사용
  const groupByBuilding = (taggedRecords) => {
    const groups = {};
    taggedRecords.forEach(r => {
      const key = r.building_name || '미지정';
      if (!groups[key]) groups[key] = { buildingName: key, counts: {}, rows: [] };
      groups[key].counts[r.type] = (groups[key].counts[r.type] || 0) + 1;
      groups[key].rows.push(r);
    });
    return Object.values(groups)
      .map(g => ({ ...g, floorGroups: groupRecordsByFloor(g.rows) }))
      .sort((a, b) => a.buildingName.localeCompare(b.buildingName));
  };

  const getDayEvents = (date) => {
    const formattedDate = date.format('YYYY-MM-DD');
    return scheduleEvents.filter(e => e.date === formattedDate);
  };

  const fetchScheduleEvents = async () => {
    if (!currentSite?.id) return;
    try {
      const res = await fetch(`${API_URL}/schedule-events?month=${currentDate.format('YYYY-MM')}`, {
        headers: { 'X-Site-Id': currentSite.id }
      });
      setScheduleEvents(await res.json());
    } catch {}
  };

  useEffect(() => { fetchScheduleEvents(); }, [currentDate, currentSite?.id]);

  const selectedDayDetail = selectedDay ? getDayRecords(selectedDay) : null;

  const handleSaveEvent = async () => {
    if (!eventForm?.title?.trim()) return;
    const isEdit = !!eventForm.id;
    await fetch(`${API_URL}/schedule-events${isEdit ? `/${eventForm.id}` : ''}`, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Site-Id': currentSite?.id },
      body: JSON.stringify({
        title: eventForm.title.trim(),
        memo: eventForm.memo || '',
        date: eventForm.date,
        category: eventForm.category || 'general',
      })
    });
    setEventForm(null);
    fetchScheduleEvents();
  };

  const handleDeleteEvent = async (id) => {
    if (!window.confirm('이 일정을 삭제하시겠습니까?')) return;
    await fetch(`${API_URL}/schedule-events/${id}`, {
      method: 'DELETE',
      headers: { 'X-Site-Id': currentSite?.id }
    });
    fetchScheduleEvents();
  };

  const handleDayClick = async (d) => {
    setSelectedDay(d);
    setEventForm(null);
    const dateStr = d.format('YYYY-MM-DD');
    // 날씨 조회
    if (!weatherCache[dateStr]) {
      try {
        const res = await fetch(`${API_URL}/weather?date=${dateStr}`, {
          headers: { 'X-Site-Id': currentSite?.id }
        });
        const data = await res.json();
        if (data) setWeatherCache(prev => ({ ...prev, [dateStr]: data }));
      } catch {}
    }
  };

  const weatherIcon = (condition) => {
    if (!condition) return 'wb_sunny';
    if (condition.includes('맑음')) return 'wb_sunny';
    if (condition.includes('구름')) return 'partly_cloudy_day';
    if (condition.includes('비')) return 'rainy';
    if (condition.includes('눈')) return 'ac_unit';
    return 'cloud';
  };

  useEffect(() => {
    if (!currentSite?.id) return;
    const loadMonthlyAnalysis = async () => {
      const month = currentDate.format('YYYY-MM');
      try {
        const res = await fetch(`${API_URL}/analysis/monthly?month=${month}`, {
          headers: { 'X-Site-Id': currentSite.id }
        });
        if (!res.ok) throw new Error('월별 정산 데이터를 로드할 수 없습니다.');
        const data = await res.json();
        setMonthlyAnalysis(data);
        setAnalysisError(null);
      } catch (err) {
        setMonthlyAnalysis(null);
        setAnalysisError(err.message);
      }
    };

    loadMonthlyAnalysis();
  }, [currentDate, currentSite?.id]);

  const getDayAmount = (date) => {
    if (!monthlyAnalysis) return 0;
    const formattedDate = date.format('YYYY-MM-DD');
    const oilingAmount = (monthlyAnalysis.oiling?.details || [])
      .filter(r => r.date === formattedDate)
      .reduce((sum, r) => sum + (typeof r.amount === 'number' ? r.amount : parseInt(r.amount) || 0), 0);
    const cleaningAmount = (monthlyAnalysis.cleaning?.details || [])
      .filter(r => r.date === formattedDate)
      .reduce((sum, r) => sum + (typeof r.amount === 'number' ? r.amount : parseInt(r.amount) || 0), 0);
    return oilingAmount + cleaningAmount;
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
      <div className="bg-surface-container-lowest rounded-lg p-4 shadow-sm border border-outline-variant/20 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => setCurrentDate(currentDate.subtract(1, 'month'))} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-primary">chevron_left</span>
          </button>
          <div>
            <span className="font-headline font-black text-2xl text-primary">{currentDate.format('YYYY년 MM월')}</span>
            <p className="text-on-surface-variant text-sm mt-1">월별 총 금액: ₩{getMonthTotalAmount().toLocaleString()}</p>
          </div>
          <button onClick={() => setCurrentDate(dayjs())} className="font-label text-[10px] uppercase tracking-widest bg-primary/10 text-primary px-3 py-1.5 rounded hover:bg-primary/20 transition-colors">오늘</button>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentDate(currentDate.add(1, 'month'))} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined text-primary">chevron_right</span>
          </button>
          <button onClick={() => setShowDailyAmount(prev => !prev)} className={`px-4 py-2 rounded-lg font-bold transition-colors ${showDailyAmount ? 'bg-primary text-white' : 'bg-surface-container text-on-surface hover:bg-surface-container-high'}`}>
            {showDailyAmount ? '일일 금액 보기 ON' : '일일 금액 보기 OFF'}
          </button>
        </div>
      </div>

      {/* 동 필터 */}
      {buildings.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterBuilding(null)}
            className={`px-4 py-2 rounded-lg font-label text-xs font-black uppercase tracking-wider transition-all border ${
              !filterBuilding
                ? 'bg-primary text-white border-primary shadow-md'
                : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-high'
            }`}
          >
            전체
          </button>
          {buildings.map(b => {
            const color = getBuildingColor(b.id);
            const active = filterBuilding === b.id.toString();
            return (
              <button
                key={b.id}
                onClick={() => setFilterBuilding(b.id.toString())}
                className="px-4 py-2 rounded-lg font-label text-xs font-black uppercase tracking-wider transition-all border"
                style={active
                  ? { backgroundColor: color, borderColor: color, color: '#fff' }
                  : { backgroundColor: 'transparent', borderColor: color, color }}
              >
                {b.name}
              </button>
            );
          })}
        </div>
      )}

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
            const events = getDayEvents(d);
            const isToday = d.isSame(dayjs(), 'day');
            const isCurrentMonth = d.isSame(currentDate, 'month');
            const isSelected = selectedDay && d.isSame(selectedDay, 'day');
            const hasRecords = records.oiling.length + records.cleaning.length + records.unloading.length > 0;

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
                  {buildTypeBadges(records).map((b, i) => (
                    <div
                      key={i}
                      className="text-[9px] px-1.5 py-0.5 text-white rounded truncate font-label"
                      style={{ backgroundColor: getBuildingColor(b.buildingId) }}
                    >
                      {b.buildingName} {b.type} {b.count}건
                    </div>
                  ))}
                  {events.slice(0, 2).map(e => (
                    <div key={e.id} className={`text-[9px] px-1.5 py-0.5 ${EVENT_CATEGORIES[e.category]?.color || 'bg-primary'} text-white rounded truncate font-label`}>
                      📌 {e.title}
                    </div>
                  ))}
                  {events.length > 2 && (
                    <div className="text-[9px] px-1.5 text-outline font-label">+{events.length - 2}개</div>
                  )}
                  {showDailyAmount && (
                    <div className="mt-1 text-right text-[11px] font-bold text-emerald-700">
                      ₩{getDayAmount(d).toLocaleString()}
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

          {/* 일정 */}
          <div className="rounded-lg border border-outline-variant/20 mb-4 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-surface-container-low">
              <h4 className="font-label text-[11px] font-bold uppercase tracking-widest text-primary">일정</h4>
              <button
                onClick={() => setEventForm({ date: selectedDay.format('YYYY-MM-DD'), title: '', memo: '', category: 'general' })}
                className="flex items-center gap-1 text-[11px] font-label font-bold text-primary hover:text-primary/70"
              >
                <span className="material-symbols-outlined text-sm">add_circle</span>일정 추가
              </button>
            </div>

            <div className="px-4 py-3">
              {getDayEvents(selectedDay).length === 0 && !eventForm && (
                <p className="text-center text-outline font-body text-xs py-2">등록된 일정이 없습니다.</p>
              )}
              {getDayEvents(selectedDay).map(e => (
                <div key={e.id} className="flex items-start justify-between gap-2 py-2 border-b border-outline-variant/10 last:border-0">
                  <div className="flex items-start gap-2 min-w-0">
                    <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${EVENT_CATEGORIES[e.category]?.color || 'bg-primary'}`}></span>
                    <div className="min-w-0">
                      <p className="font-body text-sm text-on-surface font-bold truncate">{e.title}</p>
                      {e.memo && <p className="font-body text-xs text-outline mt-0.5">{e.memo}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setEventForm({ id: e.id, date: e.date, title: e.title, memo: e.memo, category: e.category })} className="text-outline hover:text-primary p-1">
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button onClick={() => handleDeleteEvent(e.id)} className="text-outline hover:text-error p-1">
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </div>
                </div>
              ))}

              {eventForm && (
                <div className="mt-3 pt-3 border-t border-outline-variant/10 space-y-2">
                  <input
                    autoFocus
                    value={eventForm.title}
                    onChange={(ev) => setEventForm({ ...eventForm, title: ev.target.value })}
                    placeholder="일정 제목"
                    className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary text-sm font-bold py-2 px-1"
                  />
                  <input
                    value={eventForm.memo || ''}
                    onChange={(ev) => setEventForm({ ...eventForm, memo: ev.target.value })}
                    placeholder="메모 (선택)"
                    className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/20 focus:ring-0 focus:border-primary text-xs py-2 px-1"
                  />
                  <div className="flex items-center gap-2 flex-wrap">
                    {Object.entries(EVENT_CATEGORIES).map(([key, c]) => (
                      <button
                        key={key}
                        onClick={() => setEventForm({ ...eventForm, category: key })}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-label font-bold transition-colors ${eventForm.category === key ? `${c.color} text-white` : 'bg-surface-container text-outline hover:bg-surface-container-high'}`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={handleSaveEvent} className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary/90">저장</button>
                    <button onClick={() => setEventForm(null)} className="text-outline text-xs font-bold px-4 py-2 rounded-lg hover:bg-surface-container">취소</button>
                  </div>
                </div>
              )}
            </div>
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
          <div className="grid grid-cols-3 gap-3 mb-4">
            {[
              { label: '박리제칠', count: selectedDayDetail.oiling.length, color: 'text-primary bg-primary/10' },
              { label: '청소', count: selectedDayDetail.cleaning.length, color: 'text-success bg-success/10' },
              { label: '하역', count: (selectedDayDetail.unloading || []).length, color: 'text-tertiary bg-tertiary/10' },
            ].map(item => (
              <div key={item.label} className={`rounded-lg p-4 ${item.color}`}>
                <p className="font-label text-[9px] uppercase tracking-widest opacity-70">{item.label}</p>
                <p className="font-headline font-black text-2xl">{item.count}</p>
                <p className="font-label text-[9px] opacity-60">건</p>
              </div>
            ))}
          </div>

          <div className="rounded-lg p-4 border border-outline-variant/20 bg-surface-container-lowest mb-4">
            <p className="font-label text-[9px] uppercase tracking-widest text-outline mb-2">선택된 날짜 총 금액</p>
            <p className="font-headline font-black text-3xl text-emerald-700">₩{getDayAmount(selectedDay).toLocaleString()}</p>
          </div>

          {/* 상세 목록: 동별 그룹핑 (동마다 고정 색상 사용) */}
          {groupByBuilding([
            ...selectedDayDetail.oiling.map(r => ({ ...r, type: '박리제칠' })),
            ...selectedDayDetail.cleaning.map(r => ({ ...r, type: '청소' })),
            ...(selectedDayDetail.unloading || []).map(r => ({ ...r, type: '하역' }))
          ]).map(group => {
            const color = getBuildingColor(group.rows[0]?.building_id);
            return (
              <div key={group.buildingName} className="py-3 border-b border-outline-variant/20 last:border-0">
                <div className="mb-2 space-y-0.5">
                  {Object.entries(group.counts).map(([type, count]) => (
                    <p key={type} className="font-label font-black text-sm" style={{ color }}>
                      {group.buildingName} {type} {count}건
                    </p>
                  ))}
                </div>
                {group.floorGroups.map((g, i) => (
                  <div key={i} className="flex items-center gap-3 py-1 pl-1">
                    <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }}></span>
                    <span className="font-body text-sm text-on-surface-variant">
                      {g.floor ? `${g.floor}층` : ''} {g.hos.length > 0 ? g.hos.join(', ') : ''} {g.type}
                    </span>
                    {g.phase && <span className="font-label text-[9px] bg-surface-container px-2 py-0.5 rounded text-outline">{g.phase === 9 ? '기타청소' : `${g.phase}차청소`}</span>}
                  </div>
                ))}
              </div>
            );
          })}
          {(selectedDayDetail.oiling.length + selectedDayDetail.cleaning.length + (selectedDayDetail.unloading || []).length) === 0 && (
            <p className="text-center text-outline font-body py-4">이 날짜에는 기록된 작업이 없습니다.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default CalendarView;
