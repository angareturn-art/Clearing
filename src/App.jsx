import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import ElevationView from './components/ElevationView';
import CalendarView from './components/CalendarView';
import MasterManager from './components/MasterManager';
import Dashboard from './components/Dashboard';
import CostManager from './components/CostManager';
import PersonnelManager from './components/PersonnelManager';
import EmergencyContacts from './components/EmergencyContacts';
import LoginPage from './components/LoginPage';
import WorkerManager from './components/WorkerManager';

dayjs.locale('ko');

const API_URL = 'http://localhost:5000/api';

const TABS = [
  { id: 'dashboard',  label: '대시보드',  icon: 'dashboard' },
  { id: 'elevation',  label: '배치도',    icon: 'grid_view' },
  { id: 'calendar',   label: '캘린더',    icon: 'calendar_month' },
  { id: 'records',    label: '기록',      icon: 'description' },
  { id: 'cost',       label: '비용',      icon: 'payments' },
  { id: 'personnel',  label: '인원',      icon: 'badge' },
  { id: 'workers',    label: '작업자',    icon: 'groups' },
  { id: 'emergency',  label: '비상연락',  icon: 'emergency' },
  { id: 'settings',   label: '기준정보',  icon: 'database' },
];

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    const stored = localStorage.getItem('ba_user');
    return stored ? JSON.parse(stored) : null;
  });

  const [activeTab, setActiveTab] = useState('dashboard');
  const [viewMode, setViewMode] = useState('total');
  const [buildings, setBuildings] = useState([]);
  const [summary, setSummary] = useState({ oiling: [], cleaning: [], lifting: [] });
  const [records, setRecords] = useState([]);
  const [filterDate, setFilterDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [filterBuilding, setFilterBuilding] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('cleaning');
  const [sessionTimer, setSessionTimer] = useState(null);
  const [formData, setFormData] = useState({
    house_id: '',
    building_id: '',
    date: dayjs().format('YYYY-MM-DD'),
    time: dayjs().format('HH:mm'),
    operator: '',
    phase: 1,
    progress: 50,
    remarks: '',
    floor: ''
  });

  // 세션 타임아웃 (8시간)
  useEffect(() => {
    if (!currentUser) return;
    const reset = () => {
      clearTimeout(sessionTimer);
      const t = setTimeout(() => {
        handleLogout();
        alert('세션이 만료되었습니다. 다시 로그인해주세요.');
      }, 8 * 60 * 60 * 1000);
      setSessionTimer(t);
    };
    reset();
    window.addEventListener('click', reset);
    return () => { window.removeEventListener('click', reset); clearTimeout(sessionTimer); };
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchBaseData();
      fetchSummary();
    }
  }, [currentUser]);

  useEffect(() => {
    if (activeTab === 'records') fetchRecords();
  }, [activeTab, filterDate, filterBuilding, modalType]);

  const fetchBaseData = async () => {
    try {
      const res = await fetch(`${API_URL}/data`);
      const data = await res.json();
      setBuildings(data || []);
    } catch (err) { console.error(err); }
  };

  const fetchSummary = async () => {
    try {
      const res = await fetch(`${API_URL}/status/summary`);
      const data = await res.json();
      setSummary(data || { oiling: [], cleaning: [], lifting: [] });
    } catch (err) { console.error(err); }
  };

  const fetchRecords = async () => {
    try {
      const params = new URLSearchParams({ date: filterDate, buildingId: filterBuilding });
      const res = await fetch(`${API_URL}/records/${modalType}?${params}`);
      const data = await res.json();
      setRecords(data || []);
    } catch (err) { console.error(err); }
  };

  const handleCellClick = (data) => {
    setFormData({
      ...formData,
      building_id: data.building_id,
      house_id: data.house_id,
      floor: data.floor,
      date: dayjs().format('YYYY-MM-DD'),
      time: dayjs().format('HH:mm')
    });
    setModalType(viewMode === 'oiling' ? 'oiling' : 'cleaning');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let processedFloor = formData.floor;
    if (typeof formData.floor === 'string') {
      const upper = formData.floor.toUpperCase();
      if (upper === 'B1') processedFloor = -1;
      else if (upper === 'B2') processedFloor = -2;
      else processedFloor = parseInt(formData.floor);
    }
    await fetch(`${API_URL}/records/${modalType}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...formData, floor: processedFloor })
    });
    setShowModal(false);
    fetchSummary();
    if (activeTab === 'records') fetchRecords();
  };

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    await fetch(`${API_URL}/records/${modalType}/${id}`, { method: 'DELETE' });
    fetchRecords();
    fetchSummary();
  };

  const formatFloorDisplay = (floor) => {
    if (floor === undefined || floor === null || floor === '') return '-';
    const f = parseInt(floor);
    if (f === -1) return 'B1';
    if (f === -2) return 'B2';
    return `${f}F`;
  };

  const handleLogout = () => {
    localStorage.removeItem('ba_token');
    localStorage.removeItem('ba_user');
    setCurrentUser(null);
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
  };

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <>
      {/* 상단 헤더 */}
      <header className="bg-surface-container-highest transition-colors duration-150 ease-in-out flex justify-between items-center w-full px-4 md:px-6 h-16 sticky top-0 z-50 border-b border-outline-variant/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-sm">architecture</span>
          </div>
          <h1 className="text-base font-black text-primary tracking-tighter uppercase font-headline hidden sm:block">The Blueprint Authority</h1>
          <h1 className="text-base font-black text-primary tracking-tighter uppercase font-headline sm:hidden">TBA</h1>
        </div>

        {/* PC 네비게이션 */}
        <nav className="hidden md:flex items-center gap-1">
          {TABS.map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded font-label text-[10px] font-bold uppercase tracking-wider transition-all ${activeTab === tab.id ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
            >
              <span className="material-symbols-outlined text-sm">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* 우측 사용자 */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-lg">
            <span className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white text-xs font-black font-headline">{currentUser.name?.[0]}</span>
            <span className="font-label text-xs text-on-surface-variant">{currentUser.name}</span>
            <span className="font-label text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase tracking-widest">{currentUser.role}</span>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-surface-container rounded-lg transition-colors" title="로그아웃">
            <span className="material-symbols-outlined text-outline text-sm">logout</span>
          </button>
        </div>
      </header>

      {/* 메인 콘텐츠 */}
      <main className="max-w-7xl mx-auto p-4 md:p-6 space-y-6 min-h-screen pb-28 md:pb-8">
        {activeTab === 'dashboard' && (
          <Dashboard buildings={buildings} summary={summary} />
        )}

        {activeTab === 'elevation' && (
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-6 bg-surface-container-low p-2 rounded-lg">
              {[
                { id: 'total', label: '현장 전체', icon: 'grid_view' },
                { id: 'oiling', label: '기름칠', icon: 'format_paint' },
                { id: 'cleaning', label: '청소만', icon: 'cleaning_services' }
              ].map(mode => (
                <button
                  key={mode.id}
                  className={`flex items-center gap-2 px-4 py-2 rounded font-label text-xs uppercase font-bold transition-all ${viewMode === mode.id ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                  onClick={() => setViewMode(mode.id)}
                >
                  <span className="material-symbols-outlined text-sm">{mode.icon}</span>
                  {mode.label}
                </button>
              ))}
              <button
                className="ml-auto flex items-center gap-2 px-4 py-2 rounded bg-tertiary-container text-on-tertiary-container font-label text-xs uppercase font-bold transition-all hover:opacity-90"
                onClick={() => { setModalType('lifting'); setShowModal(true); }}
              >
                <span className="material-symbols-outlined text-sm">arrow_upward</span> 인양 정보 등록
              </button>
            </div>
            <ElevationView buildings={buildings} summary={summary} onCellClick={handleCellClick} viewMode={viewMode} />
          </div>
        )}

        {activeTab === 'settings' && (
          <MasterManager buildings={buildings} onRefresh={() => { fetchBaseData(); fetchSummary(); }} />
        )}
        {activeTab === 'calendar' && <CalendarView summary={summary} />}
        {activeTab === 'cost' && <CostManager />}
        {activeTab === 'personnel' && <PersonnelManager />}
        {activeTab === 'workers' && <WorkerManager />}
        {activeTab === 'emergency' && <EmergencyContacts />}

        {activeTab === 'records' && (
          <div className="space-y-6">
            <h2 className="text-4xl font-black text-primary tracking-tight font-headline">공정 기록 관리</h2>

            <div className="bg-surface-container-lowest p-6 shadow-sm rounded-lg flex flex-wrap gap-4 items-center justify-between border border-outline-variant/20">
              <div className="flex bg-surface-container p-1 rounded-lg">
                {['cleaning', 'oiling', 'lifting'].map(type => (
                  <button
                    key={type}
                    className={`px-4 md:px-6 py-2 font-bold rounded text-xs uppercase tracking-wider transition-all ${modalType === type ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                    onClick={() => setModalType(type)}
                  >
                    {type === 'cleaning' ? '청소' : type === 'oiling' ? '박리제칠' : '갱폼 인양'}
                  </button>
                ))}
              </div>
              <div className="flex gap-4 items-center">
                <input type="date" className="bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2 px-2 text-sm" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
                <button className="flex items-center gap-2 font-label text-[10px] uppercase tracking-widest text-primary hover:text-primary-container transition-colors" onClick={() => setShowModal(true)}>
                  <span className="material-symbols-outlined text-sm">add</span> 기록 추가
                </button>
              </div>
            </div>

            <div className="bg-surface-container-lowest shadow-sm rounded-lg overflow-x-auto border border-outline-variant/20">
              <table className="w-full text-left">
                <thead className="bg-surface-dim/20">
                  <tr>
                    <th className="py-4 px-4 font-label text-[10px] uppercase tracking-widest text-outline">빌딩/호</th>
                    <th className="py-4 px-4 font-label text-[10px] uppercase tracking-widest text-outline">층</th>
                    <th className="py-4 px-4 font-label text-[10px] uppercase tracking-widest text-outline">진행 상세</th>
                    <th className="py-4 px-4 font-label text-[10px] uppercase tracking-widest text-outline">비고/메모</th>
                    <th className="py-4 px-4 font-label text-[10px] uppercase tracking-widest text-outline text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-variant/50">
                  {records.map(r => (
                    <tr key={r.id} className="bg-surface hover:bg-surface-container-low transition-colors">
                      <td className="py-4 px-4 font-label font-bold text-primary">{r.building_name} <span className="text-secondary">{r.ho || ''}</span></td>
                      <td className="py-4 px-4 font-body">{formatFloorDisplay(r.floor)}</td>
                      <td className="py-4 px-4 font-body">
                        {modalType === 'cleaning' && <span className={`${r.progress === 100 ? 'text-success' : 'text-primary'} font-bold`}>{r.phase}차 공정 ({r.progress}%)</span>}
                        {modalType === 'oiling' && <span className="text-secondary-container">담당: {r.operator}</span>}
                        {modalType === 'lifting' && <span>{r.memo}</span>}
                      </td>
                      <td className="py-4 px-4 font-body text-sm text-on-surface-variant">{r.remarks || r.memo}</td>
                      <td className="py-4 px-4 text-right">
                        <span className="material-symbols-outlined text-outline cursor-pointer hover:text-error transition-colors" onClick={() => handleDelete(r.id)}>delete</span>
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 && <tr><td colSpan="5" className="py-12 text-center text-outline font-body">기록된 데이터가 없습니다.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* 모바일 하단 네비게이션 */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center h-20 pb-safe px-1 bg-surface shadow-[0_-4px_24px_rgba(0,0,0,0.06)] z-[50] md:hidden border-t border-outline-variant/20 overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-sm min-w-[48px] flex-shrink-0 ${activeTab === tab.id ? 'bg-primary text-white' : 'text-primary/60 hover:bg-primary/10'}`}
          >
            <span className="material-symbols-outlined text-xl">{tab.icon}</span>
            <span className="font-label text-[8px] font-medium uppercase tracking-widest mt-0.5">{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* 공용 입력 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-surface-variant/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-surface-container-lowest w-full max-w-lg md:rounded-lg shadow-xl relative max-h-[90vh] overflow-y-auto rounded-t-2xl">
            <div className="absolute top-0 left-0 w-1 h-full bg-secondary-container rounded-l-2xl md:rounded-l-lg"></div>

            <div className="p-6 md:p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-label text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined">edit_square</span>
                  {modalType === 'oiling' ? '박리제칠 기록' : modalType === 'lifting' ? '인양 기록' : '청소 공정 기록'}
                </h3>
                <button onClick={() => setShowModal(false)}>
                  <span className="material-symbols-outlined text-outline hover:text-on-surface">close</span>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">동 선택</label>
                    <select required className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2" value={formData.building_id} onChange={(e) => setFormData({ ...formData, building_id: e.target.value })}>
                      <option value="">빌딩 선택</option>
                      {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  {modalType !== 'lifting' && (
                    <div>
                      <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">호수 선택</label>
                      <select required className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2" value={formData.house_id} onChange={(e) => setFormData({ ...formData, house_id: e.target.value })}>
                        <option value="">호수 선택</option>
                        {buildings.find(b => b.id == formData.building_id)?.houses.map(h => <option key={h.id} value={h.id}>{h.ho}</option>)}
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">층수 (B1, B2 입력 가능)</label>
                  <input required type="text" className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2" placeholder="예: 15 또는 B1" value={formData.floor} onChange={(e) => setFormData({ ...formData, floor: e.target.value })} />
                </div>

                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">날짜</label>
                  <input type="date" className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                </div>

                {modalType === 'cleaning' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">단계</label>
                      <select value={formData.phase} onChange={(e) => setFormData({ ...formData, phase: parseInt(e.target.value) })} className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2">
                        {[1, 2, 3, 4].map(p => <option key={p} value={p}>{p}차 공정</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">진척도</label>
                      <select value={formData.progress} onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) })} className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2">
                        <option value={50}>50% (부분 완료)</option>
                        <option value={100}>100% (최종 완료)</option>
                      </select>
                    </div>
                  </div>
                )}

                {(modalType === 'oiling' || modalType === 'lifting') && (
                  <div>
                    <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">{modalType === 'oiling' ? '작업자' : '상태'}</label>
                    {modalType === 'oiling' ? (
                      <input type="text" className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2" placeholder="이름" value={formData.operator} onChange={(e) => setFormData({ ...formData, operator: e.target.value })} />
                    ) : (
                      <select className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2" value={formData.status || 'planned'} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                        <option value="planned">계획</option>
                        <option value="in_progress">진행중</option>
                        <option value="completed">완료</option>
                      </select>
                    )}
                  </div>
                )}

                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">특이사항 메모</label>
                  <textarea rows="2" className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-body py-2" placeholder="메모..." value={formData.remarks || formData.memo || ''} onChange={(e) => setFormData({ ...formData, remarks: e.target.value, memo: e.target.value })} />
                </div>

                <div className="pt-2">
                  <button type="submit" className="w-full bg-gradient-to-br from-primary to-primary-container text-white py-4 rounded font-label font-bold text-sm uppercase tracking-widest shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-sm">save</span> 저장하기
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 모바일 FAB */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-br from-secondary to-secondary-container text-white rounded-full shadow-xl flex items-center justify-center md:hidden z-[40] active:scale-90 transition-transform"
      >
        <span className="material-symbols-outlined text-3xl">add</span>
      </button>
    </>
  );
}

export default App;
