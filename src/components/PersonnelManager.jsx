import React, { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';

const API_URL = 'http://localhost:5000/api';

const EMPTY_FORM = {
  date: dayjs().format('YYYY-MM-DD'),
  work_hours: 8, ot_hours: 0, night_hours: 0, memo: ''
};

export default function PersonnelManager() {
  const [records, setRecords] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [currentMonth, setCurrentMonth] = useState(dayjs().format('YYYY-MM'));
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedNames, setSelectedNames] = useState([]);
  const [selectedCalDate, setSelectedCalDate] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchRecords = useCallback(async () => {
    const res = await fetch(`${API_URL}/personnel?month=${currentMonth}`);
    const data = await res.json();
    setRecords(data || []);
  }, [currentMonth]);

  const fetchWorkers = async () => {
    const res = await fetch(`${API_URL}/workers?status=active`);
    const data = await res.json();
    setWorkers(data || []);
  };

  useEffect(() => { fetchRecords(); }, [fetchRecords]);
  useEffect(() => { fetchWorkers(); }, []);

  const openAdd = (date = dayjs().format('YYYY-MM-DD')) => {
    setForm({ ...EMPTY_FORM, date });
    setSelectedNames([]);
    setEditId(null);
    setEditName('');
    setShowForm(true);
  };

  const openEdit = (r) => {
    setForm({ date: r.date, work_hours: r.work_hours, ot_hours: r.ot_hours, night_hours: r.night_hours, memo: r.memo || '' });
    setEditId(r.id);
    setEditName(r.name);
    setSelectedNames([]);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    if (editId) {
      await fetch(`${API_URL}/personnel/${editId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, name: editName })
      });
    } else {
      if (selectedNames.length === 0) { setSaving(false); return alert('작업자를 선택하세요.'); }
      for (const name of selectedNames) {
        await fetch(`${API_URL}/personnel`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, name })
        });
      }
    }
    setSaving(false);
    setShowForm(false);
    setEditId(null);
    fetchRecords();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('이 공수 기록을 삭제하시겠습니까?')) return;
    await fetch(`${API_URL}/personnel/${id}`, { method: 'DELETE' });
    fetchRecords();
  };

  const toggleName = (name) => setSelectedNames(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]);
  const toggleAll = () => { if (selectedNames.length === workers.length) setSelectedNames([]); else setSelectedNames(workers.map(w => w.name)); };
  const toggleTeam = (team) => {
    const teamNames = workers.filter(w => (w.team || '미배정') === team).map(w => w.name);
    const allSelected = teamNames.every(n => selectedNames.includes(n));
    if (allSelected) setSelectedNames(prev => prev.filter(n => !teamNames.includes(n)));
    else setSelectedNames(prev => [...new Set([...prev, ...teamNames])]);
  };

  const personStats = records.reduce((acc, r) => {
    if (!acc[r.name]) acc[r.name] = { name: r.name, total_work: 0, total_ot: 0, total_night: 0, days: 0 };
    acc[r.name].total_work += r.work_hours || 0;
    acc[r.name].total_ot += r.ot_hours || 0;
    acc[r.name].total_night += r.night_hours || 0;
    acc[r.name].days += 1;
    return acc;
  }, {});
  const maxDays = Math.max(...Object.values(personStats).map(p => p.days), 1);

  const startOfMonth = dayjs(currentMonth).startOf('month');
  const calDays = Array.from({ length: startOfMonth.daysInMonth() }, (_, i) => startOfMonth.add(i, 'day'));
  const byDate = records.reduce((acc, r) => { (acc[r.date] = acc[r.date] || []).push(r); return acc; }, {});

  const handleDayClick = (d) => setSelectedCalDate(d.format('YYYY-MM-DD'));
  const handleDayAdd = (e, d) => { e.stopPropagation(); openAdd(d.format('YYYY-MM-DD')); };

  const avatarColor = (name) => {
    const c = ['bg-primary/80', 'bg-secondary/80', 'bg-success/80', 'bg-warning/80', 'bg-error/80'];
    return c[(name || '').charCodeAt(0) % c.length];
  };

  const teams = [...new Set(workers.map(w => w.team || '미배정'))].sort();

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-primary tracking-tight font-headline">인원 관리</h2>
          <p className="text-on-surface-variant font-body mt-1">공수 기록 및 근무 통계</p>
        </div>
        <button onClick={() => openAdd()}
          className="flex items-center gap-2 bg-gradient-to-br from-primary to-primary-container text-white px-5 py-3 rounded font-label font-bold text-xs uppercase tracking-widest shadow-lg hover:shadow-primary/30 transition-all active:scale-95">
          <span className="material-symbols-outlined text-sm">group_add</span> 공수 추가
        </button>
      </div>

      {/* 월 선택 */}
      <div className="bg-surface-container-lowest rounded-lg p-4 shadow-sm border border-outline-variant/20 flex items-center gap-4">
        <button onClick={() => setCurrentMonth(dayjs(currentMonth).subtract(1, 'month').format('YYYY-MM'))}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined text-primary">chevron_left</span>
        </button>
        <span className="flex-1 text-center font-headline font-black text-xl text-primary">
          {dayjs(currentMonth).format('YYYY년 MM월')}
        </span>
        <button onClick={() => setCurrentMonth(dayjs(currentMonth).add(1, 'month').format('YYYY-MM'))}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-container transition-colors">
          <span className="material-symbols-outlined text-primary">chevron_right</span>
        </button>
      </div>

      {/* 개인별 통계 */}
      {Object.keys(personStats).length > 0 && (
        <div className="bg-surface-container-lowest rounded-lg p-6 shadow-sm border border-outline-variant/20">
          <div className="flex items-center gap-2 mb-5">
            <span className="material-symbols-outlined text-primary">analytics</span>
            <h3 className="font-label text-sm font-bold uppercase tracking-widest text-primary">개인별 월 통계</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr>
                  {['작업자', '근무일', '기본공수', 'OT', '야간', '공수율'].map(h => (
                    <th key={h} className="py-3 px-4 font-label text-[10px] uppercase tracking-widest text-outline">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant/50">
                {Object.values(personStats).map(p => (
                  <tr key={p.name} className="hover:bg-surface-container-low transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-headline font-black text-sm flex-shrink-0 ${avatarColor(p.name)}`}>{p.name[0]}</div>
                        <span className="font-label font-bold text-primary">{p.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-body">{p.days}일</td>
                    <td className="py-3 px-4 font-body">{p.total_work}h</td>
                    <td className="py-3 px-4 font-body text-secondary">{p.total_ot > 0 ? `${p.total_ot}h` : '-'}</td>
                    <td className="py-3 px-4 font-body text-outline">{p.total_night > 0 ? `${p.total_night}h` : '-'}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-surface-container rounded-full overflow-hidden min-w-16">
                          <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${(p.days / maxDays) * 100}%` }}></div>
                        </div>
                        <span className="font-label text-xs text-primary font-bold whitespace-nowrap">{p.days}일</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 달력 */}
      <div className="bg-surface-container-lowest rounded-lg p-6 shadow-sm border border-outline-variant/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">calendar_month</span>
            <h3 className="font-label text-sm font-bold uppercase tracking-widest text-secondary">월간 캘린더</h3>
          </div>
          <p className="font-label text-[10px] text-outline uppercase tracking-widest">날짜 클릭 → 상세 보기</p>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
            <div key={d} className={`text-center font-label text-[10px] uppercase tracking-widest py-2 ${i === 0 ? 'text-error' : i === 6 ? 'text-primary' : 'text-outline'}`}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startOfMonth.day() }).map((_, i) => <div key={`e-${i}`}></div>)}
          {calDays.map((d, i) => {
            const dateStr = d.format('YYYY-MM-DD');
            const dayRecs = byDate[dateStr] || [];
            const isToday = d.isSame(dayjs(), 'day');
            const isSel = selectedCalDate === dateStr;
            const names = [...new Set(dayRecs.map(r => r.name))];
            return (
              <div key={i} onClick={() => handleDayClick(d)}
                className={`group relative min-h-20 p-1.5 rounded-lg border cursor-pointer transition-all
                  ${isSel ? 'border-primary bg-primary/5 ring-1 ring-primary' : ''}
                  ${isToday && !isSel ? 'border-primary/50 bg-primary/5' : ''}
                  ${!isSel && !isToday ? 'border-outline-variant/20 bg-surface hover:bg-surface-container-low' : ''}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`w-6 h-6 flex items-center justify-center rounded-full font-label text-xs font-bold ${isToday ? 'bg-primary text-white' : 'text-on-surface-variant'}`}>{d.date()}</span>
                  <button onClick={(e) => handleDayAdd(e, d)} className="w-5 h-5 flex items-center justify-center rounded bg-transparent hover:bg-primary/10 text-primary opacity-0 group-hover:opacity-100 transition-all" title="공수 추가">
                    <span className="material-symbols-outlined text-[12px]">add</span>
                  </button>
                </div>
                <div className="space-y-0.5">
                  {names.slice(0, 3).map(name => (
                    <div key={name} className={`text-[9px] px-1.5 py-0.5 rounded truncate font-label font-bold ${avatarColor(name)} text-white`}>{name}</div>
                  ))}
                  {names.length > 3 && <div className="text-[9px] text-outline font-label">+{names.length - 3}명</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* 선택 날짜 세부 패널 */}
        {selectedCalDate && (
          <div className="mt-4 border-t border-outline-variant/20 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-sm">event</span>
                <h4 className="font-label text-sm font-bold text-primary">{dayjs(selectedCalDate).format('MM월 DD일 (ddd)')} 근무 현황</h4>
                <span className="font-label text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded uppercase tracking-wider">{(byDate[selectedCalDate] || []).length}명</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => openAdd(selectedCalDate)} className="flex items-center gap-1 font-label text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10 px-3 py-1.5 rounded transition-colors">
                  <span className="material-symbols-outlined text-sm">group_add</span> 추가
                </button>
                <button onClick={() => setSelectedCalDate(null)} className="text-outline hover:text-on-surface">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
            </div>

            {(byDate[selectedCalDate] || []).length === 0 ? (
              <div className="text-center py-6 text-outline font-body text-sm">
                이 날짜에 공수 기록이 없습니다.
                <button onClick={() => openAdd(selectedCalDate)} className="block mx-auto mt-2 font-label text-xs text-primary hover:underline uppercase tracking-widest">+ 공수 추가</button>
              </div>
            ) : (
              <div className="space-y-2">
                {(byDate[selectedCalDate] || []).map(r => (
                  <div key={r.id} className="flex items-center justify-between bg-surface-container rounded-lg px-4 py-3 group hover:bg-surface-container-high transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-headline font-black flex-shrink-0 ${avatarColor(r.name)}`}>{r.name[0]}</div>
                      <div>
                        <p className="font-label font-bold text-on-surface">{r.name}</p>
                        <div className="flex gap-3 mt-0.5">
                          <span className="font-label text-[10px] text-outline">기본 {r.work_hours}h</span>
                          {r.ot_hours > 0 && <span className="font-label text-[10px] text-secondary">OT {r.ot_hours}h</span>}
                          {r.night_hours > 0 && <span className="font-label text-[10px] text-outline">야간 {r.night_hours}h</span>}
                          {r.memo && <span className="font-label text-[10px] text-outline italic">{r.memo}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => openEdit(r)} className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center hover:bg-primary/20 transition-colors">
                        <span className="material-symbols-outlined text-primary text-sm">edit</span>
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="w-8 h-8 bg-error/10 rounded-lg flex items-center justify-center hover:bg-error/20 transition-colors">
                        <span className="material-symbols-outlined text-error text-sm">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 전체 기록 테이블 */}
      <div className="bg-surface-container-lowest rounded-lg shadow-sm overflow-x-auto border border-outline-variant/20">
        <div className="p-4 border-b border-outline-variant/20 flex items-center gap-2">
          <span className="material-symbols-outlined text-outline text-sm">table_rows</span>
          <h3 className="font-label text-sm font-bold uppercase tracking-widest text-outline">전체 기록</h3>
          <span className="ml-auto font-label text-[10px] text-outline">{records.length}건</span>
        </div>
        <table className="w-full text-left">
          <thead className="bg-surface-dim/20">
            <tr>
              {['날짜', '작업자', '기본공수', 'OT', '야간', '메모', '관리'].map(h => (
                <th key={h} className="py-3 px-4 font-label text-[10px] uppercase tracking-widest text-outline">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-variant/50">
            {records.map(r => (
              <tr key={r.id} className="hover:bg-surface-container-low transition-colors group">
                <td className="py-3 px-4 font-label text-sm">{r.date}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white font-headline font-black text-xs flex-shrink-0 ${avatarColor(r.name)}`}>{r.name[0]}</div>
                    <span className="font-label font-bold text-primary">{r.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 font-body text-sm">{r.work_hours}h</td>
                <td className="py-3 px-4 font-body text-sm text-secondary">{r.ot_hours > 0 ? `${r.ot_hours}h` : '-'}</td>
                <td className="py-3 px-4 font-body text-sm text-outline">{r.night_hours > 0 ? `${r.night_hours}h` : '-'}</td>
                <td className="py-3 px-4 font-body text-sm text-on-surface-variant">{r.memo || '-'}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(r)} className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center hover:bg-primary/20 transition-colors">
                      <span className="material-symbols-outlined text-primary text-sm">edit</span>
                    </button>
                    <button onClick={() => handleDelete(r.id)} className="w-8 h-8 bg-error/10 rounded-lg flex items-center justify-center hover:bg-error/20 transition-colors">
                      <span className="material-symbols-outlined text-error text-sm">delete</span>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {records.length === 0 && (
              <tr><td colSpan="7" className="py-12 text-center text-outline font-body">이번 달 공수 기록이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ═══ 입력/수정 모달 ═══ */}
      {showForm && (
        <div className="fixed inset-0 bg-surface-variant/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-surface-container-lowest w-full max-w-xl shadow-2xl rounded-t-2xl md:rounded-2xl relative max-h-[92vh] overflow-y-auto">
            <div className="h-1 w-full bg-primary rounded-t-2xl md:rounded-t-2xl"></div>
            <div className="p-6 md:p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-label text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined">{editId ? 'edit' : 'group_add'}</span>
                  {editId ? `공수 수정 · ${editName}` : `공수 추가 · ${form.date}`}
                </h3>
                <button onClick={() => { setShowForm(false); setEditId(null); }}>
                  <span className="material-symbols-outlined text-outline hover:text-on-surface transition-colors">close</span>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* 작업자 선택 */}
                {editId ? (
                  <div className="flex items-center gap-3 bg-primary/5 rounded-lg px-4 py-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-headline font-black ${avatarColor(editName)}`}>{editName[0]}</div>
                    <div>
                      <p className="font-label font-bold text-on-surface">{editName}</p>
                      <p className="font-label text-[10px] text-outline">수정 모드 · 작업자 변경 불가</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="font-label text-[10px] uppercase tracking-widest text-outline">
                        작업자 선택 <span className="text-error">*</span>
                      </label>
                      <div className="flex items-center gap-3">
                        <span className="font-label text-[10px] text-primary font-bold">{selectedNames.length}명 선택</span>
                        <button type="button" onClick={toggleAll}
                          className="font-label text-[10px] uppercase tracking-widest text-primary hover:bg-primary/10 px-2 py-1 rounded transition-colors">
                          {selectedNames.length === workers.length ? '전체 해제' : '전체 선택'}
                        </button>
                      </div>
                    </div>

                    {workers.length > 0 ? (
                      <div className="max-h-52 overflow-y-auto border border-outline-variant/20 rounded-lg divide-y divide-outline-variant/10">
                        {teams.map(team => {
                          const tw = workers.filter(w => (w.team || '미배정') === team);
                          const allChecked = tw.every(w => selectedNames.includes(w.name));
                          return (
                            <div key={team}>
                              <div className="flex items-center gap-2 px-3 py-2 bg-surface-container-high/50 cursor-pointer hover:bg-surface-container-high transition-colors" onClick={() => toggleTeam(team)}>
                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${allChecked ? 'bg-primary border-primary' : 'border-outline-variant'}`}>
                                  {allChecked && <span className="material-symbols-outlined text-white text-[10px]">check</span>}
                                </div>
                                <span className="material-symbols-outlined text-outline text-sm">workspaces</span>
                                <span className="font-label text-[10px] font-bold uppercase tracking-widest text-outline flex-1">{team}</span>
                                <span className="font-label text-[9px] text-outline">{tw.length}명</span>
                              </div>
                              {tw.map(w => {
                                const checked = selectedNames.includes(w.name);
                                return (
                                  <div key={w.id} className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-all hover:bg-primary/5 ${checked ? 'bg-primary/5' : ''}`} onClick={() => toggleName(w.name)}>
                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all flex-shrink-0 ${checked ? 'bg-primary border-primary' : 'border-outline-variant hover:border-primary/50'}`}>
                                      {checked && <span className="material-symbols-outlined text-white text-xs">check</span>}
                                    </div>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-headline font-black text-sm flex-shrink-0 ${avatarColor(w.name)}`}>{w.name[0]}</div>
                                    <div className="flex-1 min-w-0">
                                      <span className="font-label font-bold text-on-surface text-sm">{w.name}</span>
                                      {w.role === 'foreman' && <span className="ml-1 font-label text-[9px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">팀장</span>}
                                    </div>
                                    <span className="font-label text-[9px] text-outline">{w.specialty}</span>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-warning/5 border border-warning/20 rounded-lg p-4 text-center">
                        <span className="material-symbols-outlined text-warning mb-2 block">warning</span>
                        <p className="font-body text-sm text-on-surface-variant">등록된 작업자가 없습니다.</p>
                        <p className="font-label text-[10px] text-outline mt-1">먼저 <strong>작업자 탭</strong>에서 기준정보를 등록하세요.</p>
                      </div>
                    )}

                    {selectedNames.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {selectedNames.map(name => (
                          <span key={name} className="inline-flex items-center gap-1 bg-primary/10 text-primary font-label text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider">
                            {name}
                            <button type="button" onClick={(e) => { e.stopPropagation(); toggleName(name); }} className="w-3.5 h-3.5 flex items-center justify-center rounded-full hover:bg-primary/20 transition-colors">
                              <span className="material-symbols-outlined text-[10px]">close</span>
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 날짜 */}
                <div className="group">
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">날짜</label>
                  <input type="date" className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2.5"
                    value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>

                {/* 공수 */}
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { key: 'work_hours', label: '기본 공수', max: 24, color: 'text-primary' },
                    { key: 'ot_hours', label: 'OT', max: 12, color: 'text-secondary' },
                    { key: 'night_hours', label: '야간', max: 12, color: 'text-outline' },
                  ].map(({ key, label, max, color }) => (
                    <div key={key} className="group">
                      <label className={`block font-label text-[10px] uppercase tracking-widest mb-2 ${color} opacity-70`}>{label} (h)</label>
                      <input type="number" min="0" max={max} step="0.5"
                        className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2.5 text-center text-lg"
                        value={form[key]} onChange={e => setForm({ ...form, [key]: parseFloat(e.target.value) || 0 })} />
                    </div>
                  ))}
                </div>

                {/* 합계 */}
                <div className="bg-surface-container rounded-lg px-4 py-3 flex items-center justify-between">
                  <span className="font-label text-xs text-outline uppercase tracking-widest">
                    {editId ? '총 근무' : `${selectedNames.length}명 × 1인 총 근무`}
                  </span>
                  <span className="font-headline font-black text-primary text-xl">
                    {(form.work_hours || 0) + (form.ot_hours || 0) + (form.night_hours || 0)}h
                  </span>
                </div>

                {/* 메모 */}
                <div className="group">
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">메모</label>
                  <textarea rows="2" className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-body py-2 resize-none"
                    placeholder="특이사항..." value={form.memo} onChange={e => setForm({ ...form, memo: e.target.value })} />
                </div>

                {/* 저장 */}
                <div className="pt-2">
                  <button type="submit" disabled={saving}
                    className="w-full bg-gradient-to-br from-primary to-primary-container text-white py-4 rounded font-label font-black text-sm uppercase tracking-widest shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50">
                    <span className="material-symbols-outlined text-sm">{saving ? 'hourglass_top' : 'save'}</span>
                    {saving ? '저장 중...' : editId ? '수정 완료' : `${selectedNames.length}명 공수 저장`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
