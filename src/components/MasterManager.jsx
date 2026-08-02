import React, { useState, useEffect } from 'react';
import dayjs from 'dayjs';

const API_URL = '/api';

const MasterManager = ({ buildings, onRefresh, currentUser, currentSite, onSiteUpdate, allTabs = [], primaryTabIds = [], onPrimaryTabsChange }) => {
  const [activeSubTab, setActiveSubTab] = useState('site'); // site, buildings, users
  const [selectedBuildingId, setSelectedBuildingId] = useState(buildings[0]?.id || '');
  const [editData, setEditData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [siteConfig, setSiteConfig] = useState({ site_address: '', start_date: '', end_date: '' });
  const [siteDetails, setSiteDetails] = useState({ name: '', primary_contractor: '', subcontractor: '' });
  const [menuVisibility, setMenuVisibility] = useState({});

  // 사용자 관리 상태
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'worker' });

  // 현장 목록 및 신규 현장 등록 상태
  const [allSites, setAllSites] = useState([]);
  const [showNewSiteForm, setShowNewSiteForm] = useState(false);
  const [creatingSite, setCreatingSite] = useState(false);
  const [newSite, setNewSite] = useState({ name: '', primary_contractor: '', subcontractor: '', address: '', start_date: '', end_date: '' });

  // 신규 동 추가 상태
  const [newBuildingName, setNewBuildingName] = useState('');
  const [addingBuilding, setAddingBuilding] = useState(false);

  useEffect(() => {
    fetchSiteConfig();
    fetchAllSites();
    if (currentUser?.role === 'admin') fetchUsers();
  }, [currentUser, currentSite?.id]);

  const buildMenuState = (config) => {
    const visibility = {};
    allTabs.forEach(tab => {
      visibility[tab.id] = tab.id === 'settings' ? true : config?.[`menu_${tab.id}_enabled`] !== 'false';
    });
    return visibility;
  };

  const buildConfigPayload = (baseConfig, visibility) => {
    const updatedSettings = { ...baseConfig };
    Object.entries(visibility).forEach(([tabId, enabled]) => {
      updatedSettings[`menu_${tabId}_enabled`] = enabled ? 'true' : 'false';
    });
    return updatedSettings;
  };

  const saveSiteConfigSettings = async (updatedSettings) => {
    const res = await fetch(`${API_URL}/site-config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Site-Id': currentSite?.id
      },
      body: JSON.stringify(updatedSettings)
    });
    if (res.ok) {
      setSiteConfig(updatedSettings);
      return true;
    }
    return false;
  };

  const saveMenuConfig = async (visibility) => {
    setLoading(true);
    try {
      const payload = buildConfigPayload(siteConfig, visibility);
      const ok = await saveSiteConfigSettings(payload);
      if (ok) {
        onRefresh();
        return true;
      }
      alert('메뉴 설정 저장에 실패했습니다. 다시 시도해주세요.');
      return false;
    } catch (err) {
      alert('메뉴 설정 저장 중 오류가 발생했습니다.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMenuVisibility = async (tabId) => {
    const nextEnabled = !menuVisibility[tabId];
    const nextVisibility = {
      ...menuVisibility,
      [tabId]: nextEnabled
    };

    setMenuVisibility(nextVisibility);
    if (primaryTabIds.includes(tabId) && !nextEnabled) {
      onPrimaryTabsChange(primaryTabIds.filter(id => id !== tabId));
    }

    if (activeSubTab === 'menu') {
      await saveMenuConfig(nextVisibility);
    }
  };

  const fetchSiteConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/site-config`, { headers: { 'X-Site-Id': currentSite?.id } });
      const data = await res.json();
      if (data) {
        // 아직 이 현장에서 단가를 저장한 적이 없으면, 월별정산/수익성분석 등 각 화면이
        // 실제로 사용 중인 기본 단가(오일링/청소 74,000원, 슬라브 0원)를 그대로 보여준다.
        setSiteConfig({ oiling_price: '74000', cleaning_price: '74000', slab_price: '0', ...data });
        setMenuVisibility(buildMenuState(data));
      }

      if (currentSite) {
        const resS = await fetch(`${API_URL}/sites/${currentSite.id}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('ba_token')}` }
        });
        const siteData = await resS.json();
        if (siteData) setSiteDetails({
          name: siteData.name,
          primary_contractor: siteData.primary_contractor,
          subcontractor: siteData.subcontractor
        });
      }
    } catch (err) { console.error(err); }
  };

  const fetchUsers = async () => {
    const token = localStorage.getItem('ba_token');
    const res = await fetch(`${API_URL}/auth/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) {
      const data = await res.json();
      setUsers(data || []);
    }
  };

  const fetchAllSites = async () => {
    const token = localStorage.getItem('ba_token');
    const res = await fetch(`${API_URL}/sites`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (res.ok) setAllSites(await res.json());
  };

  const handleCreateSite = async (e) => {
    e.preventDefault();
    if (!newSite.name.trim()) { alert('현장명을 입력하세요.'); return; }
    setCreatingSite(true);
    try {
      const token = localStorage.getItem('ba_token');
      const res = await fetch(`${API_URL}/sites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(newSite)
      });
      if (res.ok) {
        alert('새 현장이 등록되었습니다. 목록에서 "이 현장으로 전환"을 눌러 이동하세요.');
        setNewSite({ name: '', primary_contractor: '', subcontractor: '', address: '', start_date: '', end_date: '' });
        setShowNewSiteForm(false);
        fetchAllSites();
      } else {
        const err = await res.json();
        alert(err.error || '현장 등록에 실패했습니다.');
      }
    } catch (err) {
      alert('현장 등록 중 오류가 발생했습니다.');
    } finally {
      setCreatingSite(false);
    }
  };

  const handleSwitchSite = (site) => {
    onSiteUpdate(site);
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('ba_token');
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(newUser)
    });
    if (res.ok) {
      alert('사용자가 등록되었습니다.');
      setNewUser({ email: '', password: '', name: '', role: 'worker' });
      fetchUsers();
    } else {
      const err = await res.json();
      alert(err.error || '등록 실패');
    }
  };

  useEffect(() => {
    if (selectedBuildingId) {
      const b = buildings.find(item => item.id == selectedBuildingId);
      if (b) {
        setEditData({ ...b, houses: b.houses.map(h => ({ ...h })) });
      }
    }
  }, [selectedBuildingId, buildings]);

  const handleAddBuilding = async () => {
    if (!newBuildingName.trim()) { alert('동 이름을 입력하세요.'); return; }
    setAddingBuilding(true);
    try {
      const res = await fetch(`${API_URL}/master/add-building`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Site-Id': currentSite?.id },
        body: JSON.stringify({ name: newBuildingName.trim() })
      });
      if (res.ok) {
        const { id } = await res.json();
        setNewBuildingName('');
        onRefresh();
        setSelectedBuildingId(id);
      } else {
        alert('동 추가에 실패했습니다.');
      }
    } catch (err) {
      alert('동 추가 중 오류가 발생했습니다.');
    } finally {
      setAddingBuilding(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('ba_token');
      
      // 1. 건물 정보 저장
      const resB = await fetch(`${API_URL}/master/save-building`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Site-Id': currentSite?.id
        },
        body: JSON.stringify(editData)
      });

      // 2. 글로벌 설정 저장
      const updatedSettings = { ...siteConfig };
      Object.entries(menuVisibility).forEach(([tabId, enabled]) => {
        updatedSettings[`menu_${tabId}_enabled`] = enabled ? 'true' : 'false';
      });

      const resS = await fetch(`${API_URL}/site-config`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Site-Id': currentSite?.id
        },
        body: JSON.stringify(updatedSettings)
      });

      // 3. 현장 상세 정보 저장 (현장명, 원청사, 하청사 등)
      const resD = await fetch(`${API_URL}/sites/${currentSite.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...siteDetails,
          address: siteConfig.site_address,
          start_date: siteConfig.start_date,
          end_date: siteConfig.end_date
        })
      });

      if (resB.ok && resS.ok && resD.ok) {
        alert('기준정보가 저장되었습니다.');
        onSiteUpdate({ ...currentSite, ...siteDetails });
        setSiteConfig(updatedSettings);
        fetchSiteConfig();
        onRefresh();
      } else {
        alert('저장 중 일부 오류가 발생했습니다.');
      }
    } catch (err) { alert('오류가 발생했습니다.'); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center justify-between border-b border-outline-variant/20 pb-4">
        <h2 className="text-3xl font-black text-primary tracking-tight font-headline">기준정보 설정</h2>
        <div className="flex flex-wrap gap-1 bg-surface-container p-1 rounded-xl">
          <button onClick={() => setActiveSubTab('site')} className={`px-4 py-2 rounded-lg font-label text-[10px] font-bold uppercase tracking-widest transition-all ${activeSubTab === 'site' ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>현장 정보</button>
          <button onClick={() => setActiveSubTab('buildings')} className={`px-4 py-2 rounded-lg font-label text-[10px] font-bold uppercase tracking-widest transition-all ${activeSubTab === 'buildings' ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>동/호수 관리</button>
          <button onClick={() => setActiveSubTab('menu')} className={`px-4 py-2 rounded-lg font-label text-[10px] font-bold uppercase tracking-widest transition-all ${activeSubTab === 'menu' ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>주요 메뉴</button>
          {currentUser?.role === 'admin' && (
            <button onClick={() => setActiveSubTab('users')} className={`px-4 py-2 rounded-lg font-label text-[10px] font-bold uppercase tracking-widest transition-all ${activeSubTab === 'users' ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>사용자 관리</button>
          )}
        </div>
      </div>

      {activeSubTab === 'site' && (
        <div className="space-y-8">
        {currentUser?.role === 'admin' && (
          <section className="bg-surface-container-lowest p-8 shadow-sm rounded-lg border border-outline-variant/10 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-secondary"></div>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">domain_add</span>
                <h3 className="font-label text-sm font-bold uppercase tracking-widest text-secondary">전체 현장 목록</h3>
              </div>
              <button
                onClick={() => setShowNewSiteForm(v => !v)}
                className="flex items-center gap-1.5 bg-secondary text-white px-4 py-2 rounded font-label font-bold text-xs uppercase tracking-widest shadow-sm hover:shadow-md transition-all"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                새 현장 추가
              </button>
            </div>

            {showNewSiteForm && (
              <form onSubmit={handleCreateSite} className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 pb-8 border-b border-outline-variant/10">
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">현장명 *</label>
                  <input required className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-secondary py-2 px-2" type="text" value={newSite.name} onChange={(e) => setNewSite({ ...newSite, name: e.target.value })} />
                </div>
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">원청사</label>
                  <input className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-secondary py-2 px-2" type="text" value={newSite.primary_contractor} onChange={(e) => setNewSite({ ...newSite, primary_contractor: e.target.value })} />
                </div>
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">하청사</label>
                  <input className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-secondary py-2 px-2" type="text" value={newSite.subcontractor} onChange={(e) => setNewSite({ ...newSite, subcontractor: e.target.value })} />
                </div>
                <div className="md:col-span-3">
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">주소</label>
                  <input className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-secondary py-2 px-2" type="text" value={newSite.address} onChange={(e) => setNewSite({ ...newSite, address: e.target.value })} />
                </div>
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">공사 시작일</label>
                  <input className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-secondary py-2 px-2" type="date" value={newSite.start_date} onChange={(e) => setNewSite({ ...newSite, start_date: e.target.value })} />
                </div>
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">공사 종료일</label>
                  <input className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-secondary py-2 px-2" type="date" value={newSite.end_date} onChange={(e) => setNewSite({ ...newSite, end_date: e.target.value })} />
                </div>
                <div className="md:col-span-3 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowNewSiteForm(false)} className="px-6 py-2.5 rounded font-label font-bold text-xs uppercase tracking-widest text-outline hover:bg-surface-container-high transition-all">취소</button>
                  <button type="submit" disabled={creatingSite} className="bg-secondary text-white px-6 py-2.5 rounded font-label font-bold text-xs uppercase tracking-widest shadow-md disabled:opacity-50">{creatingSite ? '등록 중…' : '현장 등록'}</button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {allSites.map(s => (
                <div key={s.id} className={`flex items-center justify-between p-4 rounded-lg border ${s.id === currentSite?.id ? 'border-primary bg-primary/5' : 'border-outline-variant/10 bg-surface-container-low'}`}>
                  <div>
                    <div className="font-bold text-on-surface flex items-center gap-2">
                      {s.name}
                      {s.id === currentSite?.id && <span className="text-[9px] font-label font-black uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded-full">현재 현장</span>}
                    </div>
                    <div className="text-xs text-outline mt-0.5">{s.primary_contractor || '원청 미지정'} · {s.subcontractor || '하청 미지정'}</div>
                  </div>
                  {s.id !== currentSite?.id && (
                    <button onClick={() => handleSwitchSite(s)} className="text-xs font-label font-bold text-primary uppercase tracking-widest hover:underline flex-shrink-0">이 현장으로 전환</button>
                  )}
                </div>
              ))}
              {allSites.length === 0 && <p className="text-sm text-outline text-center py-6">등록된 현장이 없습니다.</p>}
            </div>
          </section>
        )}

        <section className="bg-surface-container-lowest p-8 shadow-sm rounded-lg border border-outline-variant/10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-tertiary"></div>
          <div className="flex items-center gap-2 mb-8">
            <span className="material-symbols-outlined text-tertiary">apartment</span>
            <h3 className="font-label text-sm font-bold uppercase tracking-widest text-tertiary">현장 상세 및 공통 정보</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 pb-8 border-b border-outline-variant/10">
            <div className="group">
              <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">현장명</label>
              <input className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-tertiary transition-all text-on-surface font-bold py-3 px-2" type="text" value={siteDetails.name || ''} onChange={(e) => setSiteDetails({ ...siteDetails, name: e.target.value })} />
            </div>
            <div className="group">
              <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">원청사</label>
              <input className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-tertiary transition-all text-on-surface font-bold py-3 px-2" type="text" value={siteDetails.primary_contractor || ''} onChange={(e) => setSiteDetails({ ...siteDetails, primary_contractor: e.target.value })} />
            </div>
            <div className="group">
              <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">하청사 (나의 소속)</label>
              <input className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-tertiary transition-all text-on-surface font-bold py-3 px-2" type="text" value={siteDetails.subcontractor || ''} onChange={(e) => setSiteDetails({ ...siteDetails, subcontractor: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 group">
              <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">현장 위치 (주소)</label>
              <input className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-tertiary transition-all text-on-surface font-bold py-3 px-2" type="text" value={siteConfig.site_address || ''} onChange={(e) => setSiteConfig({ ...siteConfig, site_address: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">공사 시작일</label>
                <input className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-tertiary transition-all text-on-surface font-bold py-3 px-2" type="date" value={siteConfig.start_date || ''} onChange={(e) => setSiteConfig({ ...siteConfig, start_date: e.target.value })} />
              </div>
              <div>
                <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">공사 종료일</label>
                <input className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-tertiary transition-all text-on-surface font-bold py-3 px-2" type="date" value={siteConfig.end_date || ''} onChange={(e) => setSiteConfig({ ...siteConfig, end_date: e.target.value })} />
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-outline-variant/10">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-tertiary text-lg">payments</span>
              <h4 className="font-label text-[11px] font-bold uppercase tracking-widest text-tertiary">작업유형별 단가 설정</h4>
            </div>
            <p className="text-xs text-outline mb-6">여기서 저장한 단가는 월별정산·수익성분석 등 각 화면의 기본값으로 자동 반영됩니다(화면에서 임시로 다시 수정하는 것은 계속 가능).</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">박리제 단가 (세대당)</label>
                <input
                  className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-tertiary transition-all text-on-surface font-bold py-3 px-2"
                  type="number"
                  value={siteConfig.oiling_price ?? ''}
                  onChange={(e) => setSiteConfig({ ...siteConfig, oiling_price: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">청소 단가 (세대당)</label>
                <input
                  className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-tertiary transition-all text-on-surface font-bold py-3 px-2"
                  type="number"
                  value={siteConfig.cleaning_price ?? ''}
                  onChange={(e) => setSiteConfig({ ...siteConfig, cleaning_price: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">슬라브 단가 (세대당)</label>
                <input
                  className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-tertiary transition-all text-on-surface font-bold py-3 px-2"
                  type="number"
                  value={siteConfig.slab_price ?? ''}
                  onChange={(e) => setSiteConfig({ ...siteConfig, slab_price: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-outline-variant/10">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-tertiary text-lg">account_balance</span>
                <h4 className="font-label text-[11px] font-bold uppercase tracking-widest text-tertiary">현장 손익 계산 (청구/지급 차액 방식)</h4>
              </div>
              <button
                type="button"
                onClick={() => setSiteConfig({ ...siteConfig, billing_profit_model_enabled: siteConfig.billing_profit_model_enabled === 'true' ? 'false' : 'true' })}
                className={`px-4 py-1.5 rounded-full font-label text-[10px] font-bold uppercase tracking-widest transition-all ${siteConfig.billing_profit_model_enabled === 'true' ? 'bg-primary text-white' : 'bg-surface-container-low text-outline'}`}
              >
                {siteConfig.billing_profit_model_enabled === 'true' ? '사용 중' : '꺼짐'}
              </button>
            </div>
            <p className="text-xs text-outline mb-6">
              켜면 "현장 손익" 화면에서 작업자별 (청구단가-지급단가)×공수 합계에서 기름값을 뺀 순수익을 계산합니다.
              작업자별 청구/지급 단가는 작업자 관리 화면의 "단가 변동 이력"에서 입력합니다.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div>
                <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">기름값 (1일 기준)</label>
                <input
                  className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-tertiary transition-all text-on-surface font-bold py-3 px-2"
                  type="number"
                  value={siteConfig.fuel_cost_per_day ?? ''}
                  onChange={(e) => setSiteConfig({ ...siteConfig, fuel_cost_per_day: e.target.value })}
                  placeholder="60000"
                />
                <p className="text-[10px] text-outline mt-1">예: 왕복 2회당 12만원이면 1일 6만원으로 환산해 입력</p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex justify-end">
            <button onClick={handleSave} className="bg-primary text-white px-8 py-3 rounded font-label font-bold text-xs uppercase tracking-widest shadow-lg hover:shadow-primary/20 transition-all">설정 저장</button>
          </div>
        </section>
        </div>
      )}

      {activeSubTab === 'buildings' && (
        <div className="space-y-8">
        <section className="bg-surface-container-lowest p-6 shadow-sm rounded-lg border border-outline-variant/10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-secondary"></div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="material-symbols-outlined text-secondary">add_business</span>
            <input
              className="flex-1 min-w-[160px] bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-secondary py-2 px-2 font-bold text-on-surface"
              type="text"
              placeholder="새 동 이름 (예: 101동)"
              value={newBuildingName}
              onChange={(e) => setNewBuildingName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddBuilding(); }}
            />
            <button
              onClick={handleAddBuilding}
              disabled={addingBuilding}
              className="bg-secondary text-white px-5 py-2.5 rounded font-label font-bold text-xs uppercase tracking-widest shadow-sm hover:shadow-md transition-all disabled:opacity-50 flex-shrink-0"
            >
              {addingBuilding ? '추가 중…' : '동 추가'}
            </button>
          </div>
        </section>

        {!editData && (
          <div className="py-16 text-center text-outline bg-surface-container-lowest rounded-lg border-2 border-dashed border-outline-variant/30">
            등록된 동이 없습니다. 위에서 첫 동을 추가해 주세요.
          </div>
        )}

        {editData && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-8 space-y-8">
            <section className="bg-surface-container-lowest p-8 shadow-sm rounded-lg border border-outline-variant/10 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">corporate_fare</span>
                  <h3 className="font-label text-sm font-bold uppercase tracking-widest text-primary">건물 선택 및 관리</h3>
                </div>
                <select className="bg-surface-container border-0 border-b-2 border-primary focus:ring-0 text-primary font-bold py-2 px-4" value={selectedBuildingId} onChange={(e) => setSelectedBuildingId(e.target.value)}>
                  {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">동 명칭</label>
                  <input className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-3 px-2" type="text" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
                </div>
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">지하 지원 층수</label>
                  <select className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-3 px-2" value={editData.basement_count} onChange={(e) => setEditData({ ...editData, basement_count: parseInt(e.target.value) })}>
                    {[0, 1, 2, 3].map(v => <option key={v} value={v}>지하 {v > 0 ? v + '개 층' : '없음'}</option>)}
                  </select>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-outline-variant/10">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-tertiary text-lg">flag</span>
                  <h4 className="font-label text-[11px] font-bold uppercase tracking-widest text-tertiary">기준층 설정</h4>
                </div>
                <p className="text-xs text-outline mb-6">이 층을 초과하는 부분부터 기성(청구) 금액에 산입됩니다.</p>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                  <div>
                    <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">기름칠(박리제) 기준층</label>
                    <input
                      className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-tertiary transition-all text-on-surface font-bold py-3 px-2"
                      type="number"
                      value={editData.oiling_base_floor ?? 0}
                      onChange={(e) => setEditData({ ...editData, oiling_base_floor: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">슬라브 기준층</label>
                    <input
                      className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-tertiary transition-all text-on-surface font-bold py-3 px-2"
                      type="number"
                      value={editData.slab_base_floor ?? 0}
                      onChange={(e) => setEditData({ ...editData, slab_base_floor: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">청소 기준층 (1차·2차 공통)</label>
                    <input
                      className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-tertiary transition-all text-on-surface font-bold py-3 px-2"
                      type="number"
                      value={editData.cleaning_base_floor ?? 0}
                      onChange={(e) => setEditData({ ...editData, cleaning_base_floor: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">하역 기준층</label>
                    <input
                      className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-tertiary transition-all text-on-surface font-bold py-3 px-2"
                      type="number"
                      value={editData.unloading_base_floor ?? 0}
                      onChange={(e) => setEditData({ ...editData, unloading_base_floor: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-8 border-t border-outline-variant/10">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-symbols-outlined text-tertiary text-lg">calculate</span>
                  <h4 className="font-label text-[11px] font-bold uppercase tracking-widest text-tertiary">층 구간별 결합과금 (선택)</h4>
                </div>
                <p className="text-xs text-outline mb-6">설정 시 이 건물은 갱폼박리+세대청소(2차 서명완료)가 모두 끝난 층만, 청소/박리와 별개로 층당 고정금액이 청구됩니다. 경계층을 0으로 두면 비활성화(기존 방식)됩니다.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  <div>
                    <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">경계층 (이하=저층 단가)</label>
                    <input
                      className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-tertiary transition-all text-on-surface font-bold py-3 px-2"
                      type="number"
                      value={editData.combo_tier_floor ?? 0}
                      onChange={(e) => setEditData({ ...editData, combo_tier_floor: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">저층 층당 금액 (지하~경계층)</label>
                    <input
                      className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-tertiary transition-all text-on-surface font-bold py-3 px-2"
                      type="number"
                      value={editData.combo_low_price ?? 0}
                      onChange={(e) => setEditData({ ...editData, combo_low_price: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">고층 층당 금액 (경계층 초과)</label>
                    <input
                      className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-tertiary transition-all text-on-surface font-bold py-3 px-2"
                      type="number"
                      value={editData.combo_high_price ?? 0}
                      onChange={(e) => setEditData({ ...editData, combo_high_price: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-surface-container-lowest p-8 shadow-sm rounded-lg border border-outline-variant/10 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-secondary"></div>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary">grid_view</span>
                  <h3 className="font-label text-sm font-bold uppercase tracking-widest text-secondary">세대 라인 스펙</h3>
                </div>
                <button className="text-secondary font-label text-[10px] uppercase tracking-widest hover:underline" onClick={() => setEditData({ ...editData, houses: [...editData.houses, { line: editData.houses.length + 1, ho: `${editData.houses.length + 1}호`, floors: 20 }] })}>라인 추가</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-surface-dim/20">
                    <tr>
                      <th className="py-3 px-4 font-label text-[10px] uppercase tracking-widest text-outline">Line</th>
                      <th className="py-3 px-4 font-label text-[10px] uppercase tracking-widest text-outline">호수명</th>
                      <th className="py-3 px-4 font-label text-[10px] uppercase tracking-widest text-outline">층수</th>
                      <th className="py-3 px-4 font-label text-[10px] uppercase tracking-widest text-outline text-right">삭제</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {editData.houses.map((h, idx) => (
                      <tr key={idx} className="hover:bg-surface-container-low transition-colors">
                        <td className="py-4 px-4 font-label font-bold text-primary">{h.line}</td>
                        <td className="py-2 px-4"><input type="text" className="w-full bg-transparent border-b border-outline-variant/30 focus:border-primary py-1 px-1 font-bold" value={h.ho} onChange={e => { const ns = [...editData.houses]; ns[idx].ho = e.target.value; setEditData({...editData, houses: ns}); }} /></td>
                        <td className="py-2 px-4"><input type="number" className="w-full bg-transparent border-b border-outline-variant/30 focus:border-primary py-1 px-1" value={h.floors} onChange={e => { const ns = [...editData.houses]; ns[idx].floors = parseInt(e.target.value) || 0; setEditData({...editData, houses: ns}); }} /></td>
                        <td className="py-2 px-4 text-right"><button onClick={() => { const ns = editData.houses.filter((_, i) => i !== idx); setEditData({...editData, houses: ns.map((x, i) => ({...x, line: i+1}))}); }} className="text-error"><span className="material-symbols-outlined text-sm">delete</span></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          <div className="lg:col-span-4">
            <button onClick={handleSave} className="w-full bg-primary text-white py-6 rounded-lg font-label font-black text-sm uppercase tracking-widest shadow-xl hover:shadow-primary/20 transition-all flex items-center justify-center gap-3">
              <span className="material-symbols-outlined">save</span> 마스터 저장
            </button>
          </div>
        </div>
        )}
        </div>
      )}

      {activeSubTab === 'users' && currentUser?.role === 'admin' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 space-y-6">
            <section className="bg-surface-container-lowest p-8 shadow-sm rounded-lg border border-outline-variant/10 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
              <h3 className="font-label text-sm font-bold uppercase tracking-widest text-primary mb-6">신규 사용자 등록</h3>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">이메일 (ID)</label>
                  <input required className="w-full bg-surface-container-low border-b-2 border-outline-variant/30 focus:border-primary py-2 px-2" type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                </div>
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">비밀번호</label>
                  <input required className="w-full bg-surface-container-low border-b-2 border-outline-variant/30 focus:border-primary py-2 px-2" type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                </div>
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">이름</label>
                  <input required className="w-full bg-surface-container-low border-b-2 border-outline-variant/30 focus:border-primary py-2 px-2" type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                </div>
                <div>
                  <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2">권한</label>
                  <select className="w-full bg-surface-container-low border-b-2 border-outline-variant/30 focus:border-primary py-2 px-2" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                    <option value="worker">일반 사용자 (Worker)</option>
                    <option value="admin">관리자 (Admin)</option>
                  </select>
                </div>
                <button type="submit" className="w-full bg-primary text-white py-4 rounded font-label font-bold text-xs uppercase tracking-widest shadow-md">사용자 추가</button>
              </form>
            </section>
          </div>
          <div className="lg:col-span-8">
            <section className="bg-surface-container-lowest p-8 shadow-sm rounded-lg border border-outline-variant/10 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-secondary"></div>
              <h3 className="font-label text-sm font-bold uppercase tracking-widest text-secondary mb-6">등록된 사용자 목록</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-surface-dim/20">
                    <tr>
                      <th className="py-3 px-4 font-label text-[10px] uppercase tracking-widest text-outline">이름</th>
                      <th className="py-3 px-4 font-label text-[10px] uppercase tracking-widest text-outline">이메일</th>
                      <th className="py-3 px-4 font-label text-[10px] uppercase tracking-widest text-outline">권한</th>
                      <th className="py-3 px-4 font-label text-[10px] uppercase tracking-widest text-outline">등록일</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="py-4 px-4 font-label font-bold text-primary">{u.name}</td>
                        <td className="py-4 px-4 font-body text-sm">{u.email}</td>
                        <td className="py-4 px-4"><span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-tighter ${u.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-surface-variant text-outline'}`}>{u.role}</span></td>
                        <td className="py-4 px-4 font-body text-xs text-outline">{dayjs(u.created_at).format('YYYY-MM-DD')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </div>
      )}
      {activeSubTab === 'menu' && (
        <section className="bg-surface-container-lowest p-8 shadow-sm rounded-lg border border-outline-variant/10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-primary">tune</span>
            <h3 className="font-label text-sm font-bold uppercase tracking-widest text-primary">주요 메뉴 설정</h3>
          </div>
          <p className="text-xs text-outline mb-6">상단 탭바와 모바일 하단에 표시할 메뉴를 선택하세요. <strong>5개 이하</strong> 권장</p>

          <div className="mb-6">
            <p className="text-xs text-outline mb-4">메뉴 사용 여부를 설정하세요. 비활성화된 메뉴는 앱 전체에서 숨겨집니다. <strong>기준정보 메뉴는 항상 표시됩니다.</strong></p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {allTabs.filter(t => !t.adminOnly || currentUser?.role === 'admin').map(tab => {
                const enabled = menuVisibility[tab.id] ?? true;
                const isSettings = tab.id === 'settings';
                return (
                  <label key={tab.id} className="flex items-center justify-between p-4 rounded-xl border border-outline-variant/20 bg-surface-container gap-3">
                    <div>
                      <div className="font-label text-sm font-bold">{tab.label}</div>
                      <div className="text-[10px] text-on-surface-variant">{tab.adminOnly ? '관리자 전용 메뉴' : '일반 메뉴'}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={enabled}
                      disabled={isSettings}
                      onChange={() => handleToggleMenuVisibility(tab.id)}
                      className="h-5 w-5 text-primary rounded"
                    />
                  </label>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {allTabs.filter(t => !t.adminOnly || currentUser?.role === 'admin').map(tab => {
              const isActive = primaryTabIds.includes(tab.id);
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    const newIds = isActive
                      ? primaryTabIds.filter(id => id !== tab.id)
                      : [...primaryTabIds, tab.id];
                    onPrimaryTabsChange(newIds);
                  }}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                    isActive
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-outline-variant/30 text-on-surface-variant hover:border-primary/40 hover:bg-surface-container'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl flex-shrink-0">{tab.icon}</span>
                  <span className="font-label text-xs font-bold uppercase tracking-wide flex-1">{tab.label}</span>
                  {isActive && <span className="material-symbols-outlined text-sm text-primary flex-shrink-0">check_circle</span>}
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_auto] items-end">
            <div className="flex items-center gap-2 text-xs text-outline">
              <span className="material-symbols-outlined text-sm">info</span>
              현재 <strong className="text-primary mx-1">{primaryTabIds.length}개</strong> 선택됨 · 선택 즉시 저장됩니다
            </div>
            <button
              onClick={() => saveMenuConfig(menuVisibility)}
              disabled={loading}
              className="bg-primary text-white px-6 py-3 rounded-lg font-label font-bold text-xs uppercase tracking-widest shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '저장 중...' : '메뉴 설정 저장'}
            </button>
          </div>
        </section>
      )}
    </div>
  );
};


export default MasterManager;
