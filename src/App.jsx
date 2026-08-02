import React, { useState, useEffect, useMemo } from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';
import { keepLatestPhase2 } from './utils/cleaningRecords';
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
import SyncManager from './components/SyncManager';
import MonthlyClosing from './components/MonthlyClosing';
import MonthlyAnalysis2 from './components/MonthlyAnalysis2';
import SiteProfitReport from './components/SiteProfitReport';
import ProfitabilityView from './components/ProfitabilityView';
import RevenueProjection from './components/RevenueProjection';
import MatrixStatusView from './components/MatrixStatusView';
import MatrixStatusView2 from './components/MatrixStatusView2';
import CleaningStatusExport from './components/CleaningStatusExport';
import WageLedgerExport from './components/WageLedgerExport';
import CleaningSignApproval from './components/CleaningSignApproval';
import UnifiedMatrixView from './components/UnifiedMatrixView';
import { APP_VERSION } from './constants/changelog';


dayjs.locale('ko');

const API_URL = '/api';

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
const ALL_TABS = [
  { id: 'dashboard',        label: '대시보드',        icon: 'dashboard' },
  { id: 'elevation',        label: '배치도',          icon: 'grid_view' },
  { id: 'unified',          label: '통합 현황',       icon: 'view_comfy_alt' },
  { id: 'matrix',           label: '통합 매트릭스',   icon: 'view_comfy' },
  { id: 'matrix2',          label: '매트릭스2',       icon: 'grid_on' },
  { id: 'records',          label: '기록',            icon: 'description' },
  { id: 'calendar',         label: '캘린더',          icon: 'calendar_month' },
  { id: 'visual_blueprint', label: '시각적 현황',     icon: 'visibility' },
  { id: 'cost',             label: '비용',            icon: 'payments' },
  { id: 'personnel',        label: '인원',            icon: 'badge' },
  { id: 'workers',          label: '작업자',          icon: 'groups' },
  { id: 'payment_status',   label: '기성 현황',       icon: 'payments' },
  { id: 'closing',          label: '월별 마감',       icon: 'price_check' },
  { id: 'monthly_analysis2', label: '월별정산',        icon: 'analytics' },
  { id: 'profitability',     label: '수익성 분석',     icon: 'monitoring' },
  { id: 'site_profit',       label: '현장 손익',       icon: 'account_balance' },
  { id: 'sign_approval',     label: '본청 서명',       icon: 'draw' },
  { id: 'cleaning_export',   label: '청소현황 출력',   icon: 'file_download' },
  { id: 'wage_ledger_export', label: '노임 지급대장 출력', icon: 'receipt_long' },
  { id: 'projection',        label: '예상 수입',        icon: 'trending_up' },
  { id: 'emergency',        label: '비상연락',        icon: 'emergency' },
  { id: 'settings',         label: '기준정보',        icon: 'database' },
  { id: 'sync',             label: '클라우드 동기화', icon: 'cloud_sync', adminOnly: true },
];

// ── 사이드바 네비게이션 그룹 ──
const NAV_GROUPS = [
  { label: '현황', tabIds: ['dashboard', 'elevation', 'visual_blueprint', 'unified', 'matrix', 'matrix2'] },
  { label: '공정 기록', tabIds: ['records', 'calendar', 'sign_approval', 'cleaning_export', 'wage_ledger_export'] },
  { label: '정산', tabIds: ['monthly_analysis2', 'profitability', 'site_profit', 'cost', 'payment_status', 'closing', 'projection'] },
  { label: '관리', tabIds: ['personnel', 'workers', 'emergency', 'settings', 'sync'] },
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
  const [buildings, setBuildings] = useState([]);             // 건물(동) 전체 정보
  const [summary, setSummary] = useState({ oiling: [], slab: [], cleaning: [], unloading: [] }); // 각 공정별 집계 요약
  // 완료 여부/기성 등 "현재 상태"를 판단하는 화면(대시보드·배치도·매트릭스)용으로,
  // 세대당 2차 청소 중복 기록 중 가장 최근 것만 남긴 파생 데이터.
  // 기록 이력을 그대로 보여줘야 하는 캘린더 등에는 원본 summary를 그대로 사용한다.
  const filteredSummary = useMemo(
    () => ({ ...summary, cleaning: keepLatestPhase2(summary.cleaning) }),
    [summary]
  );
  const [records, setRecords] = useState([]);                 // 상세 작업 기록 리스트
  const [filterDate, setFilterDate] = useState(dayjs().format('YYYY-MM-DD')); // 조회 날짜 필터
  const [filterBuilding, setFilterBuilding] = useState('');   // 조회 건물 필터
  const [filterMode, setFilterMode] = useState('date');       // 조회 모드: 'date' | 'building'
  const [showModal, setShowModal] = useState(false);          // 기록 입력창(모달) 표시 여부
const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem('sidebar_open') === 'true');
  const [primaryTabIds, setPrimaryTabIds] = useState(() => {
    const stored = localStorage.getItem('primary_tabs');
    return stored ? JSON.parse(stored) : ['dashboard', 'elevation', 'matrix', 'records', 'calendar'];
  });
  const handlePrimaryTabsChange = (ids) => {
    setPrimaryTabIds(ids);
    localStorage.setItem('primary_tabs', JSON.stringify(ids));
  };
  const [modalType, setModalType] = useState('cleaning');    // 입력하려는 기록 종류 (청소/기름칠/인양)
  const [sessionTimer, setSessionTimer] = useState(null);     // 자동 로그아웃을 위한 타이머
  const [siteConfig, setSiteConfig] = useState(null);         // 현장 공통 설정 (주소 등)
  const [tabVisibility, setTabVisibility] = useState(() => ALL_TABS.reduce((acc, tab) => ({
    ...acc,
    [tab.id]: true
  }), {}));

  const visibleTabs = ALL_TABS.filter(t => tabVisibility[t.id] && (!t.adminOnly || currentUser?.role === 'admin'));
  const visiblePrimaryTabs = ALL_TABS.filter(t => primaryTabIds.includes(t.id) && tabVisibility[t.id] && (!t.adminOnly || currentUser?.role === 'admin'));

  // 입력창에 표시할 데이터 초기값
  const [formData, setFormData] = useState({
    record_id: null, building_id: '', house_id: '', house_ids: [],
    date: dayjs().format('YYYY-MM-DD'), time: dayjs().format('HH:mm'),
    operator: '', phase: 1, progress: 100, remarks: '', floor: '', floors: []
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
  }, [activeTab, filterDate, filterBuilding, filterMode, modalType]);

  const fetchWithSite = async (url, options = {}) => {
    if (!currentSite) return null;
    const token = localStorage.getItem('ba_token');
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'X-Site-Id': currentSite.id
    };
    
    try {
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401) {
        console.warn('Session expired. Hard resetting session...');
        localStorage.removeItem('ba_token');
        localStorage.removeItem('ba_user');
        localStorage.removeItem('ba_current_site');
        window.location.reload(); // 즉시 새로고침하여 상태 초기화
        return null;
      }
      return res;
    } catch (err) {
      console.error('Fetch Error:', err);
      return null;
    }
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
      setSummary(data || { oiling: [], slab: [], cleaning: [], unloading: [] });
    } catch (err) { console.error('요약 데이터 로드 실패:', err); }
  };

  const fetchSiteConfig = async () => {
    try {
      const res = await fetchWithSite(`${API_URL}/site-config`);
      if (!res) return;
      const data = await res.json();
      setSiteConfig(data);
      setTabVisibility(ALL_TABS.reduce((acc, tab) => ({
        ...acc,
        [tab.id]: tab.id === 'settings' ? true : data?.[`menu_${tab.id}_enabled`] !== 'false'
      }), {}));
      if (activeTab && data?.[`menu_${activeTab}_enabled`] === 'false' && activeTab !== 'settings') {
        setActiveTab('settings');
      }
    } catch (err) { console.error('현장 설정 로드 실패:', err); }
  };

  const fetchRecords = async () => {
    try {
      const params = new URLSearchParams();
      if (filterMode === 'date') {
        // 일자별 모드: 해당 날짜의 기록만 조회
        params.set('date', filterDate);
      } else {
        // 동별 모드: 선택한 건물의 전체 기록 날짜 내림차순
        if (filterBuilding) params.set('buildingId', filterBuilding);
      }
      const res = await fetchWithSite(`${API_URL}/records/${modalType}?${params}`);
      if (!res) return;
      const data = await res.json();
      setRecords(data || []);
    } catch (err) { console.error('기록 로드 실패:', err); }
  };
  const handleCellClick = (data) => {
    let floorInt = parseFloor(data.floor);
    const type = data.type === 'oiling' ? 'oiling' : data.type === 'slab' ? 'slab' : data.type === 'unloading' ? 'unloading' : 'cleaning';
    let existingRecord = null;
    if (type === 'oiling') {
      existingRecord = summary.oiling?.find(r => r.building_id === data.building_id && r.floor === floorInt);
    } else if (type === 'slab') {
      existingRecord = summary.slab?.find(r => r.building_id === data.building_id && r.floor === floorInt);
    } else if (type === 'unloading') {
      existingRecord = summary.unloading
        ?.filter(r => r.house_id === data.house_id && r.floor === floorInt)
        .sort((a, b) => b.phase - a.phase)[0];
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
        progress: 100,
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
      
      await fetchWithSite(`${API_URL}/records/${modalType}/${formData.record_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, house_id: formData.house_ids?.[0], floor: pFloor })
      });
    } else if (modalType === 'cleaning' || modalType === 'unloading') {
      const targetHouses = formData.house_ids?.length > 0 ? formData.house_ids : [formData.house_id];
      const targetFloors = formData.floors?.length > 0 ? formData.floors : [formData.floor];

      if (!targetHouses[0] || !targetFloors[0]) {
        alert('호수와 층수를 각각 1개 이상 선택해주세요.');
        return;
      }
      const promises = targetHouses.flatMap(hId =>
        targetFloors.map(fStr => {
          let pFloor = parseFloor(fStr);
          return fetchWithSite(`${API_URL}/records/${modalType}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...formData, house_id: hId, floor: pFloor })
          });
        })
      );
      await Promise.all(promises);
    } else if (modalType === 'misc') {
      if (!formData.remarks?.trim()) {
        alert('기타 내역을 입력해주세요.');
        return;
      }
      const res = await fetchWithSite(`${API_URL}/records/misc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ building_id: formData.building_id || null, date: formData.date, remarks: formData.remarks, operator: formData.operator })
      });
      if (!res || !res.ok) {
        alert('저장 실패: 서버에 반영되지 않았습니다. 서버가 최신 버전으로 재시작되었는지 확인해주세요.');
        return;
      }
    } else {
      const targetFloors = formData.floors?.length > 0 ? formData.floors : [formData.floor];
      if (!targetFloors[0]) {
        alert('층수를 1개 이상 선택해주세요.');
        return;
      }
      const promises = targetFloors.map(fStr => {
        let pFloor = parseFloor(fStr);
        return fetchWithSite(`${API_URL}/records/${modalType}`, {
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
      const res = await fetchWithSite(`${API_URL}/records/${modalType}/${formData.record_id}`, { method: 'DELETE' });
      if (!res || !res.ok) throw new Error('서버 응답 오류');
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
      const res = await fetchWithSite(`${API_URL}/records/${modalType}/${id}`, { method: 'DELETE' });
      if (!res || !res.ok) throw new Error('서버 응답 오류');
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
      progress: 100,
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

  // ── 사이드바 공통 렌더 (데스크탑 + 모바일 드로어 공유) ──
  const SidebarContent = ({ onTabClick }) => (
    <>
      {/* 브랜드 */}
      <div className="px-5 py-5 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-white text-sm">architecture</span>
          </div>
          <div>
            <div className="text-white font-black text-xs tracking-tighter uppercase leading-tight font-headline">세대청소 관리</div>
            <div className="text-white/40 text-[9px] font-bold tracking-widest">v{APP_VERSION}</div>
          </div>
        </div>
      </div>

      {/* 현장 정보 */}
      {currentSite && (
        <div className="px-5 py-3 border-b border-white/10 flex-shrink-0">
          <div className="text-white/40 text-[8px] uppercase tracking-widest mb-0.5 font-label">현재 현장</div>
          <div className="text-white text-xs font-bold truncate">{currentSite.name}</div>
          {currentSite.subcontractor && <div className="text-white/50 text-[10px] truncate">{currentSite.subcontractor}</div>}
          <button
            onClick={() => { setCurrentSite(null); localStorage.removeItem('ba_current_site'); }}
            className="text-white/30 hover:text-white/60 text-[9px] uppercase tracking-widest mt-1 transition-colors font-label"
          >현장 변경</button>
        </div>
      )}

      {/* 네비게이션 */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 sidebar-scroll">
        {NAV_GROUPS.map(group => {
          const groupTabs = group.tabIds
            .map(id => ALL_TABS.find(t => t.id === id))
            .filter(t => t && tabVisibility[t.id] !== false && (!t.adminOnly || currentUser?.role === 'admin'));
          if (groupTabs.length === 0) return null;
          return (
            <div key={group.label} className="mb-4">
              <div className="text-white/30 text-[8px] uppercase tracking-[0.2em] px-2 mb-1 font-label">{group.label}</div>
              {groupTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => onTabClick(tab.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left mb-0.5 transition-all ${
                    activeTab === tab.id
                      ? 'bg-secondary text-white shadow-sm'
                      : 'text-white/60 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] flex-shrink-0">{tab.icon}</span>
                  <span className="text-[11px] font-semibold font-label">{tab.label}</span>
                </button>
              ))}
            </div>
          );
        })}
      </nav>

      {/* 하단 사용자 */}
      <div className="px-4 py-4 border-t border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-secondary-container rounded-full flex items-center justify-center text-white text-xs font-black font-headline flex-shrink-0">
            {currentUser.name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-[11px] font-bold truncate">{currentUser.name}</div>
            <div className="text-white/40 text-[9px] uppercase font-label">{currentUser.role}</div>
          </div>
          <button onClick={handleLogout} className="text-white/30 hover:text-white/70 transition-colors" title="로그아웃">
            <span className="material-symbols-outlined text-[18px]">logout</span>
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* ── 현장 선택 레이어 ── */}
      {currentUser && !currentSite && (
        <SiteSelector onSelect={(site) => {
          setCurrentSite(site);
          localStorage.setItem('ba_current_site', JSON.stringify(site));
        }} />
      )}

      <div className="flex h-screen overflow-hidden bg-[#f4f6f8]">

        {/* ── 데스크탑 고정 사이드바 ── */}
        <aside className="hidden md:flex flex-col w-56 flex-shrink-0 bg-primary h-screen sticky top-0 z-40">
          <SidebarContent onTabClick={(id) => setActiveTab(id)} />
        </aside>

        {/* ── 메인 영역 ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* 서브헤더 */}
          <div className="bg-white border-b border-gray-200 px-4 md:px-6 py-3 flex items-center justify-between flex-shrink-0 z-30">
            <div className="flex items-center gap-3">
              {/* 모바일 햄버거 */}
              <button
                className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                onClick={() => setSidebarOpen(true)}
              >
                <span className="material-symbols-outlined text-gray-500 text-xl">menu</span>
              </button>
              <span className="text-sm font-label font-bold text-gray-400 hidden sm:block">
                {dayjs().format('YYYY년 MM월 DD일 dddd')}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {currentSite && (
                <button
                  onClick={() => { setCurrentSite(null); localStorage.removeItem('ba_current_site'); }}
                  className="flex items-center gap-1.5 text-xs font-label font-bold text-primary hover:text-secondary px-3 py-1.5 rounded-lg hover:bg-primary/5 border border-primary/20 transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">apartment</span>
                  <span className="truncate max-w-[180px]">{currentSite.name}</span>
                  <span className="material-symbols-outlined text-xs opacity-50">swap_horiz</span>
                </button>
              )}
            </div>
          </div>

          {/* 스크롤 가능한 메인 콘텐츠 */}
          <main className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 pb-24 md:pb-8">
        {activeTab === 'dashboard' && <Dashboard buildings={buildings} summary={summary} filteredSummary={filteredSummary} siteConfig={siteConfig} currentSite={currentSite} />}

        {activeTab === 'elevation' && (
          <ElevationView buildings={buildings} summary={filteredSummary} onCellClick={handleCellClick} />
        )}

        {activeTab === 'visual_blueprint' && (
          <AdvancedElevationView buildings={buildings} summary={filteredSummary} onCellClick={handleCellClick} />
        )}

        {activeTab === 'unified' && (
          <UnifiedMatrixView buildings={buildings} summary={filteredSummary} />
        )}

        {activeTab === 'matrix' && (
          <MatrixStatusView buildings={buildings} summary={filteredSummary} />
        )}

        {activeTab === 'matrix2' && (
          <MatrixStatusView2 buildings={buildings} summary={filteredSummary} />
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
            allTabs={ALL_TABS}
            primaryTabIds={primaryTabIds}
            onPrimaryTabsChange={handlePrimaryTabsChange}
          />
        )}
        {activeTab === 'calendar' && <CalendarView summary={summary} currentSite={currentSite} buildings={buildings} />}
        {activeTab === 'cost' && <CostManager currentSite={currentSite} />}
        {activeTab === 'personnel' && <PersonnelManager currentSite={currentSite} />}
        {activeTab === 'workers' && <WorkerManager currentSite={currentSite} />}
        {activeTab === 'payment_status' && <PaymentStatus buildings={buildings} summary={summary} currentSite={currentSite} />}
        {activeTab === 'closing' && <MonthlyClosing siteId={currentSite?.id} token={localStorage.getItem('ba_token')} />}
        {activeTab === 'monthly_analysis2' && <MonthlyAnalysis2 currentSite={currentSite} buildings={buildings} />}
        {activeTab === 'profitability' && <ProfitabilityView currentSite={currentSite} />}
        {activeTab === 'site_profit' && <SiteProfitReport currentSite={currentSite} />}
        {activeTab === 'sign_approval' && <CleaningSignApproval currentSite={currentSite} onSigned={fetchSummary} />}
        {activeTab === 'cleaning_export' && <CleaningStatusExport currentSite={currentSite} buildings={buildings} />}
        {activeTab === 'wage_ledger_export' && <WageLedgerExport currentSite={currentSite} />}
        {activeTab === 'projection' && <RevenueProjection currentSite={currentSite} buildings={buildings} />}
        {activeTab === 'emergency' && <EmergencyContacts currentSite={currentSite} />}
        {activeTab === 'sync' && <SyncManager currentUser={currentUser} />}

        {activeTab === 'records' && (
          <div className="space-y-6">
            <h2 className="text-4xl font-black text-primary tracking-tight font-headline">공정 기록 관리</h2>

            {/* 공정 타입 + 조회 모드 선택 */}
            <div className="bg-surface-container-lowest p-4 shadow-sm rounded-lg flex flex-wrap gap-3 items-center justify-between border border-outline-variant/20">
              <div className="flex items-center gap-3">
                <div className="flex bg-surface-container p-1 rounded-lg">
                  {['cleaning', 'oiling', 'slab', 'unloading', 'misc'].map(type => (
                    <button
                      key={type}
                      className={`px-4 py-2 font-bold rounded text-xs uppercase tracking-wider transition-all ${modalType === type ? 'bg-primary text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                      onClick={() => setModalType(type)}
                    >
                      {type === 'cleaning' ? '청소' : type === 'oiling' ? '박리제칠' : type === 'slab' ? '슬라브' : type === 'unloading' ? '하역' : '기타'}
                    </button>
                  ))}
                </div>
                {/* 일자별 / 동별 토글 */}
                <div className="flex bg-surface-container p-1 rounded-lg">
                  {[{ id: 'date', label: '일자별', icon: 'calendar_today' }, { id: 'building', label: '동별', icon: 'apartment' }].map(m => (
                    <button
                      key={m.id}
                      className={`flex items-center gap-1 px-4 py-2 rounded text-xs font-bold uppercase tracking-wider transition-all ${filterMode === m.id ? 'bg-secondary text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'}`}
                      onClick={() => { setFilterMode(m.id); if (m.id === 'building' && !filterBuilding && buildings.length > 0) setFilterBuilding(buildings[0].id.toString()); }}
                    >
                      <span className="material-symbols-outlined text-sm">{m.icon}</span>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 items-center">
                {filterMode === 'date' ? (
                  <input type="date" className="bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2 px-2 text-sm" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
                ) : null}
                <button className="flex items-center gap-2 font-label text-[10px] uppercase tracking-widest text-primary hover:opacity-70 transition-colors" onClick={() => setShowModal(true)}>
                  <span className="material-symbols-outlined text-sm">add</span> 기록 추가
                </button>
              </div>
            </div>

            {/* 동별 모드: 건물 선택 버튼 */}
            {filterMode === 'building' && (
              <div className="flex flex-wrap gap-2">
                {buildings.map(b => (
                  <button
                    key={b.id}
                    onClick={() => setFilterBuilding(b.id.toString())}
                    className={`px-4 py-2 rounded-lg font-label text-xs font-black uppercase tracking-wider transition-all border ${
                      filterBuilding === b.id.toString()
                        ? 'bg-primary text-white border-primary shadow-md'
                        : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-high'
                    }`}
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            )}

            <div className="bg-surface-container-lowest shadow-sm rounded-lg overflow-x-auto border border-outline-variant/20">
              <table className="w-full text-left">
                <thead className="bg-surface-dim/20">
                  <tr>
                    <th className="py-4 px-4 font-label text-[10px] uppercase tracking-widest text-outline">빌딩/호</th>
                    <th className="py-4 px-4 font-label text-[10px] uppercase tracking-widest text-outline">층</th>
                    {filterMode === 'building' && <th className="py-4 px-4 font-label text-[10px] uppercase tracking-widest text-outline">날짜</th>}
                    <th className="py-4 px-4 font-label text-[10px] uppercase tracking-widest text-outline">진행 상세</th>
                    <th className="py-4 px-4 font-label text-[10px] uppercase tracking-widest text-outline">비고/메모</th>
                    <th className="py-4 px-4 font-label text-[10px] uppercase tracking-widest text-outline">작성일자</th>
                    <th className="py-4 px-4 font-label text-[10px] uppercase tracking-widest text-outline text-right">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-variant/50">
                  {records.map(r => (
                    <tr key={r.id} className="bg-surface hover:bg-surface-container-low transition-colors">
                      <td className="py-4 px-4 font-label font-bold text-primary">{r.building_name || '-'} <span className="text-secondary">{r.ho || ''}</span></td>
                      <td className="py-4 px-4 font-body">{formatFloorDisplay(r.floor)}</td>
                      {filterMode === 'building' && <td className="py-4 px-4 font-body text-sm text-on-surface-variant">{r.date}</td>}
                      <td className="py-4 px-4 font-body">
                        {(modalType === 'cleaning' || modalType === 'unloading') && (
                          <span className={`${r.phase === 9 ? 'text-amber-500' : r.phase >= 2 ? 'text-success' : 'text-sky-500'} font-bold`}>
                            {r.phase === 9 ? '기타청소' : `${r.phase}차청소`}
                          </span>
                        )}
                        {modalType === 'cleaning' && r.phase === 2 && (
                          r.confirmed === 1
                            ? <span className="ml-2 inline-flex items-center gap-1 bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded-full"><span className="material-symbols-outlined text-xs">verified</span>서명완료 {r.sign_date}</span>
                            : <span className="ml-2 inline-flex items-center gap-1 bg-lime-100 text-lime-700 text-[10px] font-bold px-2 py-0.5 rounded-full"><span className="material-symbols-outlined text-xs">pending</span>서명대기</span>
                        )}
                        {(modalType === 'oiling' || modalType === 'slab') && <span className="text-secondary-container">담당: {r.operator}</span>}
                      </td>
                      <td className="py-4 px-4 font-body text-sm text-on-surface-variant">{r.remarks || r.memo}</td>
                      <td className="py-4 px-4 font-body text-xs text-outline whitespace-nowrap">
                        {r.created_at ? dayjs(r.created_at).format('MM/DD HH:mm') : ''}
                      </td>
                      <td className="py-4 px-4 text-right flex justify-end gap-3">
                        {modalType === 'cleaning' && r.phase === 2 && r.confirmed !== 1 && (
                          <span
                            className="material-symbols-outlined text-green-700 cursor-pointer hover:text-green-900 transition-colors"
                            title="본청 서명 완료"
                            onClick={async () => {
                              if (!window.confirm(`${r.building_name} ${r.floor}층 2차 청소 서명을 완료 처리하시겠습니까?`)) return;
                              const token = localStorage.getItem('ba_token');
                              await fetch(`${API_URL}/records/cleaning/${r.id}/sign`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'X-Site-Id': currentSite?.id },
                                body: JSON.stringify({ sign_date: dayjs().format('YYYY-MM-DD') }),
                              });
                              fetchRecords();
                              fetchSummary();
                            }}
                          >draw</span>
                        )}
                        <span className="material-symbols-outlined text-outline cursor-pointer hover:text-primary transition-colors" title="수정" onClick={() => handleEditRecordFromTable(r)}>edit</span>
                        <span className="material-symbols-outlined text-outline cursor-pointer hover:text-error transition-colors" title="삭제" onClick={() => handleDelete(r.id)}>delete</span>
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 && <tr><td colSpan={filterMode === 'building' ? 7 : 6} className="py-12 text-center text-outline font-body">기록된 데이터가 없습니다.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
          </main>
        </div>{/* flex-1 메인 영역 끝 */}
      </div>{/* flex h-screen 끝 */}

      {/* ── 모바일 사이드바 드로어 ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-60 bg-primary shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-secondary rounded flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-xs">architecture</span>
                </div>
                <span className="text-white font-black text-xs tracking-tight uppercase font-headline">세대청소 관리</span>
                <span className="text-white/40 text-[9px] font-bold tracking-widest">v{APP_VERSION}</span>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                <span className="material-symbols-outlined text-white/60 text-xl">close</span>
              </button>
            </div>
            <SidebarContent onTabClick={(id) => { setActiveTab(id); setSidebarOpen(false); }} />
          </aside>
        </div>
      )}

      {/* ── 모바일 하단 네비게이션 ── */}
      <nav className="fixed bottom-0 left-0 w-full flex justify-around items-center h-16 pb-safe px-1 bg-white shadow-[0_-2px_12px_rgba(0,0,0,0.08)] z-[50] md:hidden border-t border-gray-200">
        {visiblePrimaryTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg min-w-[48px] transition-all ${
              activeTab === tab.id
                ? 'text-secondary'
                : 'text-gray-400'
            }`}
          >
            <span className={`material-symbols-outlined text-xl ${activeTab === tab.id ? 'text-secondary' : ''}`}>{tab.icon}</span>
            <span className={`font-label text-[8px] font-bold uppercase tracking-widest mt-0.5 ${activeTab === tab.id ? 'text-secondary' : 'text-gray-400'}`}>{tab.label}</span>
          </button>
        ))}
        <button
          onClick={() => setSidebarOpen(true)}
          className="flex flex-col items-center justify-center py-1 px-2 rounded-lg min-w-[48px] text-gray-400"
        >
          <span className="material-symbols-outlined text-xl">menu</span>
          <span className="font-label text-[8px] font-bold uppercase tracking-widest mt-0.5">더보기</span>
        </button>
      </nav>

      {/* ── 공용 입력 모달 ── */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-end md:items-center justify-center p-0 md:p-4">
          <div className="bg-white w-full max-w-lg md:rounded-xl shadow-2xl relative max-h-[90vh] overflow-y-auto rounded-t-2xl">
            <div className="absolute top-0 left-0 w-1 h-full bg-secondary rounded-l-2xl md:rounded-l-xl"></div>

            <div className="p-6 md:p-8">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-label text-sm font-bold uppercase tracking-widest text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined">edit_square</span>
                  {modalType === 'oiling' ? '박리제칠 기록' : modalType === 'slab' ? '슬라브 기록' : modalType === 'cleaning' ? '청소 공정 기록' : modalType === 'unloading' ? '하역 공정 기록' : '기타 기록'}
                </h3>
                <button onClick={() => setShowModal(false)}>
                  <span className="material-symbols-outlined text-outline hover:text-on-surface">close</span>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">동 선택{modalType === 'misc' ? ' (선택사항)' : ''}</label>
                    <select required={modalType !== 'misc'} className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2" value={formData.building_id} onChange={(e) => setFormData({ ...formData, building_id: e.target.value, house_id: '', house_ids: [] })}>
                      <option value="">빌딩 선택</option>
                      {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                  {(modalType === 'cleaning' || modalType === 'unloading') && formData.building_id && (
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

                {modalType !== 'misc' && formData.building_id && (
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

                {(modalType === 'cleaning' || modalType === 'unloading') && (
                  <div>
                    <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">단계</label>
                    <select value={formData.phase} onChange={(e) => setFormData({ ...formData, phase: parseInt(e.target.value) })} className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2">
                      <option value={1}>1차청소</option>
                      <option value={2}>2차청소</option>
                      <option value={9}>기타청소 (할석 등)</option>
                    </select>
                  </div>
                )}

                {(modalType === 'oiling' || modalType === 'slab' || modalType === 'misc') && (
                  <div>
                    <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">작업자 {modalType === 'misc' ? '(선택사항)' : ''}</label>
                    <input type="text" className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-2" placeholder="이름" value={formData.operator} onChange={(e) => setFormData({ ...formData, operator: e.target.value })} />
                  </div>
                )}

                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">{modalType === 'misc' ? '기타 내역' : '특이사항 메모'}</label>
                  <textarea required={modalType === 'misc'} rows={modalType === 'misc' ? 4 : 2} className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-body py-2" placeholder={modalType === 'misc' ? '예) 자재 반입, 안전점검 등' : '메모...'} value={formData.remarks || formData.memo || ''} onChange={(e) => setFormData({ ...formData, remarks: e.target.value, memo: e.target.value })} />
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

      {/* ── 모바일 FAB ── */}
      <button
        onClick={() => setShowModal(true)}
        className="fixed bottom-20 right-5 w-13 h-13 bg-secondary text-white rounded-full shadow-xl flex items-center justify-center md:hidden z-[40] active:scale-90 transition-transform w-12 h-12"
      >
        <span className="material-symbols-outlined text-2xl">add</span>
      </button>

    </>
  );
}

export default App;
