import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';

const API_URL = 'http://localhost:5000/api';

const ROLES = [
  { value: 'foreman',   label: '팀장',      icon: 'manage_accounts', color: 'text-primary   bg-primary/10' },
  { value: 'worker',    label: '작업자',    icon: 'construction',    color: 'text-secondary bg-secondary/10' },
  { value: 'safety',   label: '안전관리',  icon: 'health_and_safety', color: 'text-warning  bg-warning/10' },
  { value: 'manager',  label: '현장관리자', icon: 'engineering',     color: 'text-success   bg-success/10' },
];

const SPECIALTIES = ['박리제칠', '세대청소', '갱폼인양', '전기', '설비', '잡공', '기타'];

const STATUSES = [
  { value: 'active',   label: '재직 중',  dot: 'bg-success' },
  { value: 'inactive', label: '퇴사/종료', dot: 'bg-outline' },
  { value: 'leave',    label: '휴직',     dot: 'bg-warning' },
];

const EMPTY_FORM = {
  name: '', phone: '', role: 'worker', team: '',
  specialty: '세대청소', status: 'active', memo: ''
};

export default function WorkerManager({ currentSite }) {
  const [workers, setWorkers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId]   = useState(null);
  const [form, setForm]       = useState(EMPTY_FORM);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRole, setFilterRole]     = useState('');
  const [search, setSearch]             = useState('');
  const [viewMode, setViewMode]         = useState('card'); // 'card' | 'table'
  const [showWageModal, setShowWageModal] = useState(false);
  const [wageHistory, setWageHistory]   = useState([]);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [wageForm, setWageForm] = useState({ effective_date: dayjs().format('YYYY-MM-DD'), unit_price: 0 });

  useEffect(() => { fetch_workers(); }, []);

  const fetch_workers = async () => {
    const token = localStorage.getItem('ba_token');
    const res  = await fetch(`${API_URL}/workers`, {
      headers: {
        'X-Site-Id': currentSite?.id,
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    setWorkers(data || []);
  };

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(true);
  };

  const openEdit = (w) => {
    setForm({ name: w.name, phone: w.phone || '', role: w.role,
              team: w.team || '', specialty: w.specialty || '세대청소',
              status: w.status, memo: w.memo || '' });
    setEditId(w.id);
    setShowForm(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('ba_token');
    if (editId) {
      await fetch(`${API_URL}/workers/${editId}`, {
        method: 'PUT', 
        headers: { 
          'Content-Type': 'application/json',
          'X-Site-Id': currentSite?.id,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });
    } else {
      await fetch(`${API_URL}/workers`, {
        method: 'POST', 
        headers: { 
          'Content-Type': 'application/json',
          'X-Site-Id': currentSite?.id,
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(form)
      });
    }
    setShowForm(false);
    fetch_workers();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('작업자를 삭제하시겠습니까?')) return;
    const token = localStorage.getItem('ba_token');
    await fetch(`${API_URL}/workers/${id}`, { 
      method: 'DELETE',
      headers: { 'X-Site-Id': currentSite?.id, 'Authorization': `Bearer ${token}` }
    });
    fetch_workers();
  };

  /* ── 단가 관리 로직 */
  const openWageModal = async (w) => {
    try {
      setSelectedWorker(w);
      const token = localStorage.getItem('ba_token');
      const res = await fetch(`${API_URL}/worker-prices/history/${encodeURIComponent(w.name)}`, {
        headers: { 'X-Site-Id': currentSite?.id, 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('데이터를 불러오는데 실패했습니다.');
      const data = await res.json();
      setWageHistory(data || []);
      setWageForm({ effective_date: dayjs().format('YYYY-MM-DD'), unit_price: data[0]?.unit_price || 0 });
      setShowWageModal(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleWageSubmit = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('ba_token');
    await fetch(`${API_URL}/worker-prices`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${token}`,
        'X-Site-Id': currentSite?.id
      },
      body: JSON.stringify({ ...wageForm, worker_name: selectedWorker.name })
    });
    openWageModal(selectedWorker); // 목록 새로고침
  };

  const handleWageDelete = async (id) => {
    if (!window.confirm('이 단가 기록을 삭제하시겠습니까?')) return;
    const token = localStorage.getItem('ba_token');
    await fetch(`${API_URL}/worker-prices/${id}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'X-Site-Id': currentSite?.id
      }
    });
    openWageModal(selectedWorker);
  };

  /* ── 필터 */
  const filtered = workers.filter(w => {
    if (filterStatus && w.status !== filterStatus) return false;
    if (filterRole   && w.role   !== filterRole)   return false;
    if (search && !w.name.includes(search) && !(w.team || '').includes(search)) return false;
    return true;
  });

  /* ── 팀별 그룹 */
  const teams = [...new Set(workers.map(w => w.team || '미배정'))].sort();

  /* ── 통계 */
  const stats = {
    total:    workers.length,
    active:   workers.filter(w => w.status === 'active').length,
    foreman:  workers.filter(w => w.role === 'foreman').length,
    teamCount: new Set(workers.filter(w=>w.team).map(w=>w.team)).size,
  };

  const roleInfo  = (role)   => ROLES.find(r => r.value === role)   || ROLES[1];
  const statusInfo = (st)    => STATUSES.find(s => s.value === st)  || STATUSES[0];

  /* ── 아바타 배경색 */
  const avatarColors = [
    'bg-primary/80','bg-secondary/80','bg-success/80',
    'bg-warning/80','bg-error/80','bg-tertiary-container',
  ];
  const avatarColor = (name) => avatarColors[name.charCodeAt(0) % avatarColors.length];

  return (
    <div className="space-y-6">

      {/* ── 헤더 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-4xl font-black text-primary tracking-tight font-headline">작업자 기준정보</h2>
          <p className="text-on-surface-variant font-body mt-1">현장 투입 인원 등록 및 관리</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-gradient-to-br from-primary to-primary-container text-white px-5 py-3 rounded font-label font-bold text-xs uppercase tracking-widest shadow-lg hover:shadow-primary/30 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-sm">person_add</span>
          작업자 등록
        </button>
      </div>

      {/* ── KPI 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: '전체 작업자', value: stats.total,     icon: 'groups',          color: 'text-primary  bg-primary/10' },
          { label: '재직 중',     value: stats.active,    icon: 'check_circle',    color: 'text-success  bg-success/10' },
          { label: '팀장',        value: stats.foreman,   icon: 'manage_accounts', color: 'text-secondary bg-secondary/10' },
          { label: '소속 팀 수',  value: stats.teamCount, icon: 'workspaces',      color: 'text-warning  bg-warning/10' },
        ].map((kpi, i) => (
          <div key={i} className="bg-surface-container-lowest rounded-lg p-5 shadow-sm border border-outline-variant/20">
            <div className={`inline-flex items-center justify-center w-10 h-10 rounded-lg ${kpi.color} mb-3`}>
              <span className={`material-symbols-outlined ${kpi.color.split(' ')[0]}`}>{kpi.icon}</span>
            </div>
            <p className="text-3xl font-black font-headline text-on-surface">{kpi.value}</p>
            <p className="font-label text-[10px] uppercase tracking-widest text-outline mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* ── 필터 바 */}
      <div className="bg-surface-container-lowest rounded-lg p-4 shadow-sm border border-outline-variant/20 flex flex-wrap gap-3 items-center">
        {/* 검색 */}
        <div className="relative flex-1 min-w-44">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-sm">search</span>
          <input
            type="text"
            placeholder="이름 또는 팀 검색..."
            className="w-full pl-9 pr-3 py-2 bg-surface-container rounded text-sm text-on-surface border-0 focus:ring-1 focus:ring-primary font-body"
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>

        {/* 상태 필터 */}
        <div className="flex bg-surface-container p-1 rounded-lg gap-1">
          <button onClick={() => setFilterStatus('')}
            className={`px-3 py-1.5 rounded font-label text-[10px] uppercase tracking-wider font-bold transition-all ${!filterStatus ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
            전체
          </button>
          {STATUSES.map(s => (
            <button key={s.value} onClick={() => setFilterStatus(s.value)}
              className={`px-3 py-1.5 rounded font-label text-[10px] uppercase tracking-wider font-bold transition-all ${filterStatus === s.value ? 'bg-primary text-white' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* 역할 필터 */}
        <select
          className="bg-surface-container border-0 text-on-surface font-label text-xs font-bold py-2 px-3 rounded focus:ring-1 focus:ring-primary"
          value={filterRole} onChange={e => setFilterRole(e.target.value)}
        >
          <option value="">전체 역할</option>
          {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>

        {/* 뷰 전환 */}
        <div className="flex gap-1 ml-auto">
          {[['card','grid_view'],['table','table_rows']].map(([m, ic]) => (
            <button key={m} onClick={() => setViewMode(m)}
              className={`w-9 h-9 flex items-center justify-center rounded transition-all ${viewMode === m ? 'bg-primary text-white' : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'}`}>
              <span className="material-symbols-outlined text-sm">{ic}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── 카드 뷰 */}
      {viewMode === 'card' && (
        <>
          {teams.map(team => {
            const teamWorkers = filtered.filter(w => (w.team || '미배정') === team);
            if (teamWorkers.length === 0) return null;
            return (
              <div key={team} className="space-y-3">
                {/* 팀 헤더 */}
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-outline text-sm">workspaces</span>
                  <h3 className="font-label text-xs font-bold uppercase tracking-widest text-outline">{team}</h3>
                  <div className="flex-1 h-px bg-outline-variant/30"></div>
                  <span className="font-label text-[10px] text-outline bg-surface-container px-2 py-0.5 rounded">{teamWorkers.length}명</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {teamWorkers.map(w => {
                    const ri = roleInfo(w.role);
                    const si = statusInfo(w.status);
                    return (
                      <div key={w.id}
                        className="bg-surface-container-lowest rounded-lg border border-outline-variant/20 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
                        {/* 역할 컬러 라인 */}
                        <div className={`absolute top-0 left-0 w-full h-1 ${
                          w.role === 'foreman'  ? 'bg-primary' :
                          w.role === 'manager'  ? 'bg-success'  :
                          w.role === 'safety'   ? 'bg-warning'  : 'bg-secondary-container'}`
                        }></div>

                        <div className="p-5 pt-6">
                          {/* 아바타 + 이름 */}
                          <div className="flex items-start gap-3 mb-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-headline font-black text-lg flex-shrink-0 ${avatarColor(w.name)}`}>
                              {w.name[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-headline font-black text-on-surface text-base leading-tight truncate">{w.name}</p>
                              <div className="flex items-center gap-1 mt-1">
                                <span className={`inline-flex items-center gap-1 font-label text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-full ${ri.color}`}>
                                  <span className="material-symbols-outlined text-[10px]">{ri.icon}</span>
                                  {ri.label}
                                </span>
                              </div>
                            </div>
                            {/* 상태 점 */}
                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${si.dot}`} title={si.label}></span>
                          </div>

                          {/* 정보 */}
                          <div className="space-y-1.5 text-sm">
                            {w.phone && (
                              <a href={`tel:${w.phone}`} className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors">
                                <span className="material-symbols-outlined text-[14px]">call</span>
                                <span className="font-body">{w.phone}</span>
                              </a>
                            )}
                            {w.specialty && (
                              <div className="flex items-center gap-2 text-on-surface-variant">
                                <span className="material-symbols-outlined text-[14px]">construction</span>
                                <span className="font-body">{w.specialty}</span>
                              </div>
                            )}
                            {w.memo && (
                              <div className="flex items-start gap-2 text-on-surface-variant">
                                <span className="material-symbols-outlined text-[14px] mt-0.5">notes</span>
                                <span className="font-body text-xs line-clamp-2">{w.memo}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 하단 액션 */}
                        <div className="border-t border-outline-variant/20 flex">
                          <button onClick={() => openWageModal(w)}
                            className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-primary hover:bg-primary/5 transition-colors font-label text-[10px] uppercase tracking-wider">
                            <span className="material-symbols-outlined text-sm">payments</span> 단가
                          </button>
                          <div className="w-px bg-outline-variant/20"></div>
                          <button onClick={() => openEdit(w)}
                            className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-on-surface-variant hover:bg-surface-container hover:text-primary transition-colors font-label text-[10px] uppercase tracking-wider">
                            <span className="material-symbols-outlined text-sm">edit</span> 수정
                          </button>
                          <div className="w-px bg-outline-variant/20"></div>
                          <button onClick={() => handleDelete(w.id)}
                            className="flex-1 py-2.5 flex items-center justify-center gap-1.5 text-on-surface-variant hover:bg-error/5 hover:text-error transition-colors font-label text-[10px] uppercase tracking-wider">
                            <span className="material-symbols-outlined text-sm">delete</span> 삭제
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="bg-surface-container-lowest rounded-lg py-16 text-center border border-outline-variant/20">
              <span className="material-symbols-outlined text-5xl text-outline mb-3 block">person_search</span>
              <p className="font-body text-outline">등록된 작업자가 없습니다.</p>
              <button onClick={openAdd} className="mt-4 font-label text-xs text-primary uppercase tracking-widest hover:underline">+ 첫 번째 작업자 등록</button>
            </div>
          )}
        </>
      )}

      {/* ── 테이블 뷰 */}
      {viewMode === 'table' && (
        <div className="bg-surface-container-lowest rounded-lg shadow-sm overflow-x-auto border border-outline-variant/20">
          <table className="w-full text-left">
            <thead className="bg-surface-dim/20">
              <tr>
                {['이름','역할','소속팀','전문분야','연락처','상태','메모','관리'].map(h => (
                  <th key={h} className="py-4 px-4 font-label text-[10px] uppercase tracking-widest text-outline whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-variant/50">
              {filtered.map(w => {
                const ri = roleInfo(w.role);
                const si = statusInfo(w.status);
                return (
                  <tr key={w.id} className="hover:bg-surface-container-low transition-colors group">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white font-headline font-black text-sm flex-shrink-0 ${avatarColor(w.name)}`}>
                          {w.name[0]}
                        </div>
                        <span className="font-label font-bold text-on-surface">{w.name}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 font-label text-[9px] uppercase tracking-wider px-2 py-1 rounded-full ${ri.color}`}>
                        <span className="material-symbols-outlined text-[10px]">{ri.icon}</span>
                        {ri.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-body text-sm text-on-surface-variant">{w.team || '-'}</td>
                    <td className="py-3 px-4 font-body text-sm">{w.specialty || '-'}</td>
                    <td className="py-3 px-4">
                      {w.phone ? (
                        <a href={`tel:${w.phone}`} className="font-label text-sm text-primary hover:underline">{w.phone}</a>
                      ) : <span className="text-outline text-sm">-</span>}
                    </td>
                    <td className="py-3 px-4">
                      <span className="flex items-center gap-1.5 font-label text-xs">
                        <span className={`w-2 h-2 rounded-full ${si.dot}`}></span>
                        {si.label}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-body text-xs text-on-surface-variant max-w-xs truncate">{w.memo || '-'}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(w)}
                          className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center hover:bg-primary/20 transition-colors">
                          <span className="material-symbols-outlined text-primary text-sm">edit</span>
                        </button>
                        <button onClick={() => handleDelete(w.id)}
                          className="w-8 h-8 bg-error/10 rounded-lg flex items-center justify-center hover:bg-error/20 transition-colors">
                          <span className="material-symbols-outlined text-error text-sm">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan="8" className="py-12 text-center text-outline font-body">등록된 작업자가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 등록/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-surface-variant/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-surface-container-lowest w-full max-w-lg shadow-2xl rounded-t-2xl md:rounded-2xl relative max-h-[90vh] overflow-y-auto">
            {/* 역할 컬러 상단 바 */}
            <div className={`h-1 w-full rounded-t-2xl md:rounded-t-2xl ${
              form.role === 'foreman'  ? 'bg-primary' :
              form.role === 'manager'  ? 'bg-success'  :
              form.role === 'safety'   ? 'bg-warning'  : 'bg-secondary-container'}`
            }></div>

            <div className="p-6 md:p-8">
              {/* 모달 헤더 */}
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-label text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined">badge</span>
                  {editId ? '작업자 정보 수정' : '작업자 신규 등록'}
                </h3>
                <button onClick={() => setShowForm(false)}>
                  <span className="material-symbols-outlined text-outline hover:text-on-surface transition-colors">close</span>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* 이름 + 연락처 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="group">
                    <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2 group-focus-within:text-primary transition-colors">
                      이름 <span className="text-error">*</span>
                    </label>
                    <input required type="text"
                      className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2"
                      placeholder="홍길동"
                      value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                  </div>
                  <div className="group">
                    <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2 group-focus-within:text-primary transition-colors">연락처</label>
                    <input type="tel"
                      className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2"
                      placeholder="010-0000-0000"
                      value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                  </div>
                </div>

                {/* 역할 선택 (카드 스타일) */}
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-3">역할</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ROLES.map(r => (
                      <button type="button" key={r.value}
                        onClick={() => setForm({...form, role: r.value})}
                        className={`flex items-center gap-2 px-4 py-3 rounded-lg border-2 transition-all font-label text-xs font-bold uppercase tracking-wider
                          ${form.role === r.value
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-outline-variant/30 text-on-surface-variant hover:border-outline-variant/60'}`}
                      >
                        <span className="material-symbols-outlined text-sm">{r.icon}</span>
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 소속팀 + 전문분야 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="group">
                    <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2 group-focus-within:text-primary transition-colors">소속 팀</label>
                    <input type="text"
                      className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2"
                      placeholder="예: A팀, 1팀"
                      value={form.team} onChange={e => setForm({...form, team: e.target.value})} />
                  </div>
                  <div className="group">
                    <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2 group-focus-within:text-primary transition-colors">전문 분야</label>
                    <select
                      className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2"
                      value={form.specialty} onChange={e => setForm({...form, specialty: e.target.value})}>
                      {SPECIALTIES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* 재직 상태 */}
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">재직 상태</label>
                  <div className="flex gap-2">
                    {STATUSES.map(s => (
                      <button type="button" key={s.value}
                        onClick={() => setForm({...form, status: s.value})}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 transition-all font-label text-xs font-bold
                          ${form.status === s.value
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-outline-variant/30 text-on-surface-variant hover:border-outline-variant/60'}`}
                      >
                        <span className={`w-2 h-2 rounded-full ${s.dot}`}></span>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 메모 */}
                <div className="group">
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2 group-focus-within:text-primary transition-colors">메모</label>
                  <textarea rows="2"
                    className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-body py-2 resize-none"
                    placeholder="특이사항이나 참고 사항..."
                    value={form.memo} onChange={e => setForm({...form, memo: e.target.value})} />
                </div>

                {/* 저장 버튼 */}
                <div className="pt-2">
                  <button type="submit"
                    className="w-full bg-gradient-to-br from-primary to-primary-container text-white py-4 rounded font-label font-black text-sm uppercase tracking-widest shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]">
                    <span className="material-symbols-outlined text-sm">save</span>
                    {editId ? '수정 완료' : '작업자 등록'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* ── 단가 관리 모달 */}
      {showWageModal && (
        <div className="fixed inset-0 bg-surface-variant/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest w-full max-w-md shadow-2xl rounded-2xl overflow-hidden border border-outline-variant/20">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="font-label text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined">payments</span>
                    단가 변동 이력
                  </h3>
                  <p className="text-xs text-on-surface-variant font-bold mt-1">{selectedWorker?.name} 작업자</p>
                </div>
                <button onClick={() => setShowWageModal(false)}>
                  <span className="material-symbols-outlined text-outline hover:text-on-surface">close</span>
                </button>
              </div>

              {/* 단가 추가 폼 */}
              <form onSubmit={handleWageSubmit} className="grid grid-cols-2 gap-3 mb-8 p-4 bg-surface-container rounded-xl">
                <div className="col-span-2 text-[10px] font-bold text-primary uppercase tracking-wider mb-1">새 단가 등록</div>
                <div>
                  <label className="block text-[9px] text-outline mb-1">적용 시작일</label>
                  <input type="date" required className="w-full bg-surface py-2 px-2 rounded text-xs font-bold border-0 focus:ring-1 focus:ring-primary"
                    value={wageForm.effective_date} onChange={e => setWageForm({...wageForm, effective_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[9px] text-outline mb-1">일당 (단가)</label>
                  <input type="number" required className="w-full bg-surface py-2 px-2 rounded text-xs font-bold border-0 focus:ring-1 focus:ring-primary"
                    value={wageForm.unit_price} onChange={e => setWageForm({...wageForm, unit_price: e.target.value})} />
                </div>
                <button type="submit" className="col-span-2 bg-primary text-white py-2 rounded font-label text-[10px] font-bold uppercase tracking-widest mt-2 shadow-sm">
                  저장하기
                </button>
              </form>

              {/* 이력 리스트 */}
              <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                <p className="text-[10px] font-bold text-outline uppercase tracking-wider">과거 이력</p>
                {wageHistory.map(h => (
                  <div key={h.id} className="flex items-center justify-between p-3 bg-surface rounded-lg border border-outline-variant/10 group">
                    <div>
                      <p className="text-xs font-bold text-on-surface">{dayjs(h.effective_date).format('YYYY년 MM월 DD일')}</p>
                      <p className="text-[10px] text-outline">적용 단가: <span className="text-primary font-bold">{h.unit_price.toLocaleString()}원</span></p>
                    </div>
                    <button onClick={() => handleWageDelete(h.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-error hover:bg-error/10 p-1 rounded">
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </div>
                ))}
                {wageHistory.length === 0 && <p className="text-center text-xs text-outline py-4">등록된 이력이 없습니다.</p>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
