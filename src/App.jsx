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
import PaymentStatus from './components/PaymentStatus';
import SiteSelector from './components/SiteSelector';
import AdvancedElevationView from './components/AdvancedElevationView';

dayjs.locale('ko');

const API_URL = 'http://localhost:5000/api';

const parseFloor = (f) => {
  if (typeof f === 'number') return f;
  if (!f) return 0;
  const s = f.toString().toUpperCase();
  if (s.startsWith('B')) {
    const num = parseInt(s.replace('B', ''));
    return isNaN(num) ? 0 : -num;
  }
  return parseInt(s) || 0;
};

// ── 화면 탭 구성 (메뉴 버튼 목록) ──
const TABS = [
  { id: 'dashboard',  label: '대시보드',  icon: 'dashboard' },      // 현지 현황 요약
  { id: 'elevation',  label: '배치도',    icon: 'grid_view' },      // 건물별 진행 상태 그리드
  { id: 'visual_blueprint', label: '시각적 현황', icon: 'visibility' }, // 고도화 배치도
  { id: 'calendar',   label: '캘린더',    icon: 'calendar_month' }, // 날짜별 작업 내역
  { id: 'records',    label: '기록',      icon: 'description' },    // 상세 기록 목록 및 관리
  { id: 'cost',       label: '비용',      icon: 'payments' },       // 현장 비용 관리
  { id: 'personnel',  label: '인원',      icon: 'badge' },          // 일일 출역/인원 관리
  { id: 'workers',    label: '작업자',    icon: 'groups' },         // 작업자 마스터 관리
  { id: 'payment_status', label: '기성 현황', icon: 'payments' },  // 공정별 기성비 산출
  { id: 'emergency',  label: '비상연락',  icon: 'emergency' },      // 주요 연락처 목록
  { id: 'settings',   label: '기준정보',  icon: 'database' },       // 현장 및 동/호수 기본 설정
];

function App() {
  // ── 상태 관리 (데이터를 담는 주머니들) ──
  const [currentUser, setCurrentUser] = useState(() => {      // 현재 로그인한 사용자 정보
    const stored = localStorage.getItem('ba_user');
    return stored ? JSON.parse(stored) : null;
  });

  const [activeTab, setActiveTab] = useState('dashboard');   // 현재 보고 있는 메뉴 탭
  const [currentSite, setCurrentSite] = useState(() => {
    const stored = localStorage.getItem('ba_current_site');
    return stored ? JSON.parse(stored) : null;
  });
  const [viewMode, setViewMode] = useState('total');         // 배치도 보기 모드 (통합/기름칠/청소)
  const [buildings, setBuildings] = useState([]);             // 건물(동) 전체 정보
  const [summary, setSummary] = useState({ oiling: [], cleaning: [], lifting: [] }); // 각 공정별 집계 요약
  const [records, setRecords] = useState([]);                 // 상세 작업 기록 리스트
  const [filterDate, setFilterDate] = useState(dayjs().format('YYYY-MM-DD')); // 조회 날짜 필터
  const [filterBuilding, setFilterBuilding] = useState('');   // 조회 건물 필터
  const [showModal, setShowModal] = useState(false);          // 기록 입력창(모달) 표시 여부
  const [modalType, setModalType] = useState('cleaning');    // 입력하려는 기록 종류 (청소/기름칠/인양)
  const [sessionTimer, setSessionTimer] = useState(null);     // 자동 로그아웃을 위한 타이머
  const [siteConfig, setSiteConfig] = useState(null);         // 현장 공통 설정 (주소 등)
  
  // 입력창에 표시할 데이터 초기값
  const [formData, setFormData] = useState({
    record_id: null, building_id: '', house_id: '', house_ids: [],
    date: dayjs().format('YYYY-MM-DD'), time: dayjs().format('HH:mm'),
    operator: '', phase: 1, progress: 50, remarks: '', floor: '', floors: []
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
    if (currentUser && currentSite) {
      fetchBaseData();
      fetchSummary();
      fetchSiteConfig();
    }
  }, [currentUser, currentSite]);

  useEffect(() => {
    if (activeTab === 'records') fetchRecords();
  }, [activeTab, filterDate, filterBuilding, modalType]);

  const fetchWithSite = async (url, options = {}) => {
    if (!currentSite) return null;
    const token = localStorage.getItem('ba_token');
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'X-Site-Id': currentSite.id
    };
    return fetch(url, { ...options, headers });
  };

  const fetchBaseData = async () => {
    try {
      const res = await fetchWithSite(`${API_URL}/master/buildings`);
      if (!res) return;
      const data = await res.json();
      setBuildings(data || []);
    } catch (err) { console.error('기본 정보 로드 실패:', err); }
  };

  const fetchSummary = async () => {
    try {
      const res = await fetchWithSite(`${API_URL}/status/summary`);
      if (!res) return;
      const data = await res.json();
      setSummary(data || { oiling: [], cleaning: [], lifting: [] });
    } catch (err) { console.error('요약 데이터 로드 실패:', err); }
  };

  const fetchSiteConfig = async () => {
    try {
      const res = await fetchWithSite(`${API_URL}/site-config`);
      if (!res) return;
      const data = await res.json();
      setSiteConfig(data);
    } catch (err) { console.error('현장 설정 로드 실패:', err); }
  };

  const fetchRecords = async () => {
    try {
      const params = new URLSearchParams({ date: filterDate, buildingId: filterBuilding });
      const res = await fetchWithSite(`${API_URL}/records/${modalType}?${params}`);
      if (!res) return;
      const data = await res.json();
      setRecords(data || []);
    } catch (err) { console.error('기록 로드 실패:', err); }
  };
  const handleCellClick = (data) => {
    let floorInt = parseFloor(data.floor);
    const type = viewMode === 'oiling' ? 'oiling' : 'cleaning';
    let existingRecord = null;
    if (type === 'oiling') {
      existingRecord = summary.oiling?.find(r => r.building_id === data.building_id && r.floor === floorInt);
    } else {
      existingRecord = summary.cleaning
        ?.filter(r => r.house_id === data.house_id && r.floor === floorInt)
        .sort((a, b) => b.phase - a.phase)[0];
    }
    
    if (existingRecord) {
      setFormData({
        ...formData,
        record_id: existingRecord.id,
        building_id: existingRecord.building_id || data.building_id,
        house_id: data.house_id,
        house_ids: [data.house_id.toString()],
        floor: data.floor,
        floors: [data.floor.toString()],
        date: existingRecord.date || dayjs().format('YYYY-MM-DD'),
        time: existingRecord.time || dayjs().format('HH:mm'),
        operator: existingRecord.operator || '',
        phase: existingRecord.phase || 1,
        progress: existingRecord.progress || 50,
        remarks: existingRecord.remarks || ''
      });
    } else {
      setFormData({
        ...formData,
        record_id: null,
        building_id: data.building_id,
        house_id: data.house_id,
        house_ids: [data.house_id.toString()],
        floor: data.floor,
        floors: [data.floor.toString()],
        date: dayjs().format('YYYY-MM-DD'),
        time: dayjs().format('HH:mm'),
        operator: '',
        phase: 1,
        progress: 50,
        remarks: ''
      });
    }
    setModalType(type);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.record_id) {
      let pFloor = parseFloor(formData.floors?.[0] || formData.floor);
      
      await fetch(`${API_URL}/records/${modalType}/${formData.record_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, house_id: formData.house_ids?.[0], floor: pFloor })
      });
    } else if (modalType === 'cleaning') {
      const targetHouses = formData.house_ids?.length > 0 ? formData.house_ids : [formData.house_id];
      const targetFloors = formData.floors?.length > 0 ? formData.floors : [formData.floor];
      
      if (!targetHouses[0] || !targetFloors[0]) {
        alert('호수와 층수를 각각 1개 이상 선택해주세요.');
        return;
      }
      const promises = targetHouses.flatMap(hId => 
        targetFloors.map(fStr => {
          let pFloor = parseFloor(fStr);
          return fetch(`${API_URL}/records/${modalType}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...formData, house_id: hId, floor: pFloor })
          });
        })
      );
      await Promise.all(promises);
    } else {
      const targetFloors = formData.floors?.length > 0 ? formData.floors : [formData.floor];
      if (!targetFloors[0]) {
        alert('층수를 1개 이상 선택해주세요.');
        return;
      }
      const promises = targetFloors.map(fStr => {
        let pFloor = parseFloor(fStr);
        return fetch(`${API_URL}/records/${modalType}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, floor: pFloor })
        });
      });
      await Promise.all(promises);
    }

    setShowModal(false);
    fetchSummary();
    if (activeTab === 'records') fetchRecords();
  };

  const handleDeleteRecord = async () => {
    if (!formData.record_id) return;
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`${API_URL}/records/${modalType}/${formData.record_id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('서버 응답 오류');
      alert('성공적으로 삭제되었습니다.');
      setShowModal(false);
      await fetchSummary();
      if (activeTab === 'records') await fetchRecords();
    } catch (err) {
      alert('삭제 처리 중 에러가 발생했습니다: ' + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    try {
      const res = await fetch(`${API_URL}/records/${modalType}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('서버 응답 오류');
      alert('데이터가 성공적으로 삭제되었습니다.');
      await fetchRecords();
      await fetchSummary();
    } catch (err) {
      alert('삭제 중 오류가 발생했습니다: ' + err.message);
    }
  };

  const handleEditRecordFromTable = (r) => {
    setFormData({
      record_id: r.id,
      building_id: r.building_id,
      house_id: r.house_id || '',
      house_ids: r.house_id ? [r.house_id.toString()] : [],
      floor: r.floor || '',
      floors: r.floor ? [r.floor.toString()] : [],
      date: r.date || dayjs().format('YYYY-MM-DD'),
      time: r.time || dayjs().format('HH:mm'),
      operator: r.operator || '',
      phase: r.phase || 1,
      progress: r.progress || 50,
      remarks: r.remarks || r.memo || ''
    });
    // modalType is already correct since we are currently viewing this type's table
    setShowModal(true);
  };

  const formatFloorDisplay = (floor) => {
    if (floor === undefined || floor === null || floor === '') return '-';
    const s = floor.toString().toUpperCase();
    if (s.startsWith('B')) return s;
    const f = parseInt(s);
    if (isNaN(f)) return s;
    if (f < 0) return `B${Math.abs(f)}`;
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
      {/* ── 현장 선택 레이어 (로그인 후 현장 미선택 시) ── */}
      {currentUser && !currentSite && (
        <SiteSelector onSelect={(site) => {
          setCurrentSite(site);
          localStorage.setItem('ba_current_site', JSON.stringify(site));
        }} />
      )}

      {/* 상단 헤더 */}
      <header className="bg-surface-container-highest transition-colors duration-150 ease-in-out flex justify-between items-center w-full px-4 md:px-6 h-16 sticky top-0 z-50 border-b border-outline-variant/20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-sm">architecture</span>
            </div>
            <h1 className="text-base font-black text-primary tracking-tighter uppercase font-headline hidden sm:block">The Blueprint Authority</h1>
            <h1 className="text-base font-black text-primary tracking-tighter uppercase font-headline sm:hidden">TBA</h1>
          </div>

          {currentSite && (
            <div className="hidden lg:flex items-center gap-2 bg-surface-container px-3 py-1.5 rounded-lg border border-outline-variant/20 group cursor-pointer" onClick={() => { setCurrentSite(null); localStorage.removeItem('ba_current_site'); }}>
              <span className="material-symbols-outlined text-primary text-xs">apartment</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-label font-bold text-primary truncate max-w-[150px]">{currentSite.name}</span>
                {currentSite.subcontractor && (
                  <>
                    <span className="w-[1px] h-3 bg-outline-variant/30"></span>
                    <span className="text-[10px] font-label font-bold text-on-surface-variant truncate max-w-[100px]">{currentSite.subcontractor}</span>
                  </>
                )}
              </div>
              <span className="material-symbols-outlined text-[10px] text-outline group-hover:text-primary transition-colors ml-1">sync_alt</span>
            </div>
          )}
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
      <main className="flex-1 p-4 md:p-8 space-y-8 pb-32">
        {activeTab === 'dashboard' && <Dashboard buildings={buildings} summary={summary} siteConfig={siteConfig} />}

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

        {activeTab === 'visual_blueprint' && (
          <AdvancedElevationView buildings={buildings} summary={summary} onCellClick={handleCellClick} />
        )}

        {activeTab === 'settings' && (
          <MasterManager 
            buildings={buildings} 
            onRefresh={() => { fetchBaseData(); fetchSummary(); fetchSiteConfig(); }} 
            siteConfig={siteConfig} 
            currentUser={currentUser}
            currentSite={currentSite}
            onSiteUpdate={(site) => {
              setCurrentSite(site);
              localStorage.setItem('ba_current_site', JSON.stringify(site));
            }}
          />
        )}
        {activeTab === 'calendar' && <CalendarView summary={summary} />}
        {activeTab === 'cost' && <CostManager currentSite={currentSite} />}
        {activeTab === 'personnel' && <PersonnelManager currentSite={currentSite} />}
        {activeTab === 'workers' && <WorkerManager currentSite={currentSite} />}
        {activeTab === 'payment_status' && <PaymentStatus buildings={buildings} summary={summary} />}
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
                      <td className="py-4 px-4 text-right flex justify-end gap-3">
                        <span className="material-symbols-outlined text-outline cursor-pointer hover:text-primary transition-colors" title="수정" onClick={() => handleEditRecordFromTable(r)}>edit</span>
                        <span className="material-symbols-outlined text-outline cursor-pointer hover:text-error transition-colors" title="삭제" onClick={() => handleDelete(r.id)}>delete</span>
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
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">동 선택</label>
                    <select required className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2" value={formData.building_id} onChange={(e) => setFormData({ ...formData, building_id: e.target.value, house_id: '', house_ids: [] })}>
                      <option value="">빌딩 선택</option>
                      {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  {modalType === 'cleaning' && formData.building_id && (
                    <div>
                      <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">호수 다중 선택 (여럿 선택 가능)</label>
                      <div className="flex flex-wrap gap-2 p-2 bg-surface-container-low rounded-lg border border-outline-variant/30">
                        {buildings.find(b => b.id == formData.building_id)?.houses.map(h => (
                          <label key={h.id} className={`cursor-pointer px-4 py-2 rounded-full text-xs font-bold transition-all select-none ${formData.house_ids?.includes(h.id.toString()) ? 'bg-primary text-white shadow-md' : 'bg-surface text-on-surface-variant border border-outline-variant/50 hover:bg-surface-container-high'}`}>
                            <input 
                              type="checkbox" 
                              className="hidden" 
                              checked={formData.house_ids?.includes(h.id.toString()) || false}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setFormData(prev => {
                                  const ids = prev.house_ids || [];
                                  return { 
                                    ...prev, 
                                    house_ids: checked ? [...ids, h.id.toString()] : ids.filter(id => id !== h.id.toString())
                                  };
                                });
                              }}
                            />
                            {h.ho}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {formData.building_id && (
                  <div>
                    <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">층수 {formData.record_id ? '선택 (단일 수정모드)' : '다중 선택 (여럿 선택 가능)'}</label>
                    <div className="flex flex-wrap gap-2 p-2 bg-surface-container-low rounded-lg border border-outline-variant/30">
                      {(() => {
                        const b = buildings.find(b => b.id == formData.building_id);
                        if (!b) return null;
                        const maxFloors = Math.max(...b.houses.map(h => h.floors), 1);
                        const basements = Array.from({ length: b.basement_count || 0 }).map((_, i) => -(b.basement_count - i));
                        const grounds = Array.from({ length: maxFloors }).map((_, i) => i + 1);
                        const allFloors = [...basements, ...grounds].reverse(); // top floors first looks nicer
                        
                        return allFloors.map(floorInt => {
                          const floorStr = floorInt === -1 ? 'B1' : floorInt === -2 ? 'B2' : (floorInt < 0 ? `B${Math.abs(floorInt)}` : floorInt.toString());
                          const isSelected = formData.floors?.includes(floorStr);
                          return (
                            <label key={floorInt} className={`cursor-pointer min-w-10 h-8 px-2 flex items-center justify-center rounded text-xs font-bold transition-all select-none ${isSelected ? 'bg-primary text-white shadow-md' : 'bg-surface text-on-surface-variant border border-outline-variant/50 hover:bg-surface-container-high'}`}>
                              <input 
                                type="checkbox" 
                                className="hidden" 
                                checked={isSelected}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setFormData(prev => {
                                    if (prev.record_id) return { ...prev, floors: [floorStr] }; // single select in edit mode
                                    const fs = prev.floors || [];
                                    return { 
                                      ...prev, 
                                      floors: checked ? [...fs, floorStr] : fs.filter(f => f !== floorStr)
                                    };
                                  });
                                }}
                              />
                              {floorStr}
                            </label>
                          );
                        });
                      })()}
                    </div>
                  </div>
                )}

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

                <div className="pt-2 flex gap-3">
                  {formData.record_id ? (
                    <>
                      <button type="button" onClick={handleDeleteRecord} className="flex-1 bg-surface-container-high text-error py-4 rounded font-label font-bold text-sm uppercase tracking-widest hover:bg-error hover:text-white transition-all flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-sm">delete</span> 삭제
                      </button>
                      <button type="submit" className="flex-1 bg-gradient-to-br from-primary to-primary-container text-white py-4 rounded font-label font-bold text-sm uppercase tracking-widest shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-2">
                        <span className="material-symbols-outlined text-sm">edit</span> 수정하기
                      </button>
                    </>
                  ) : (
                    <button type="submit" className="w-full bg-gradient-to-br from-primary to-primary-container text-white py-4 rounded font-label font-bold text-sm uppercase tracking-widest shadow-lg hover:shadow-primary/20 transition-all flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-sm">save</span> 저장하기
                    </button>
                  )}
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

      {/* ── Fixed Footer Site Info Bar ── */}
      {currentUser && (
        <footer className="fixed bottom-20 md:bottom-0 left-0 w-full z-[40] pointer-events-none px-4 pb-4 md:pb-6">
          <div className="max-w-7xl mx-auto pointer-events-auto">
            <div className="bg-surface/60 backdrop-blur-xl border border-outline-variant/20 shadow-[0_8px_32px_rgba(0,0,0,0.1)] rounded-xl py-3 px-6 flex items-center justify-between gap-4 animate-slide-up">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-primary text-lg">location_on</span>
                </div>
                <div className="overflow-hidden">
                  <p className="font-label text-[10px] uppercase tracking-widest text-outline leading-none mb-1">현재 현장 위치</p>
                  <p className="font-body text-sm font-bold text-on-surface truncate">
                    {siteConfig?.site_address || '현장 주소를 등록해주세요'}
                  </p>
                </div>
              </div>

              <div className="hidden sm:flex items-center gap-8">
                <div className="flex items-center gap-3 border-l border-outline-variant/30 pl-8">
                  <div className="w-8 h-8 rounded-full bg-tertiary/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-tertiary text-lg">calendar_today</span>
                  </div>
                  <div>
                    <p className="font-label text-[10px] uppercase tracking-widest text-outline leading-none mb-1">공사 기간</p>
                    <p className="font-body text-xs font-bold text-on-surface">
                      {siteConfig?.start_date || '--'} ~ {siteConfig?.end_date || '--'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 border-l border-outline-variant/30 pl-8">
                  <div className="text-right">
                    <p className="font-label text-[10px] uppercase tracking-widest text-outline leading-none mb-1">시스템 상태</p>
                    <p className="flex items-center gap-1.5 justify-end">
                      <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                      <span className="font-label text-[10px] font-black text-on-surface uppercase tracking-wider">Online</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </footer>
      )}
    </>
  );
}

export default App;
