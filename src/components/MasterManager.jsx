import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:5000/api';

const MasterManager = ({ buildings, onRefresh, currentUser, currentSite, onSiteUpdate }) => {
  const [activeSubTab, setActiveSubTab] = useState('site'); // site, buildings, users
  const [selectedBuildingId, setSelectedBuildingId] = useState(buildings[0]?.id || '');
  const [editData, setEditData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [siteConfig, setSiteConfig] = useState({ site_address: '', start_date: '', end_date: '' });
  const [siteDetails, setSiteDetails] = useState({ name: '', primary_contractor: '', subcontractor: '' });
  
  // 사용자 관리 상태
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ email: '', password: '', name: '', role: 'worker' });

  useEffect(() => {
    fetchSiteConfig();
    if (currentUser?.role === 'admin') fetchUsers();
  }, [currentUser]);

  const fetchSiteConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/site-config`, { headers: { 'X-Site-Id': currentSite?.id } });
      const data = await res.json();
      if (data) setSiteConfig(data);

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
      const resS = await fetch(`${API_URL}/site-config`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Site-Id': currentSite?.id
        },
        body: JSON.stringify(siteConfig)
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
        <div className="flex bg-surface-container p-1 rounded-xl">
          <button onClick={() => setActiveSubTab('site')} className={`px-4 py-2 rounded-lg font-label text-[10px] font-bold uppercase tracking-widest transition-all ${activeSubTab === 'site' ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>현장 정보</button>
          <button onClick={() => setActiveSubTab('buildings')} className={`px-4 py-2 rounded-lg font-label text-[10px] font-bold uppercase tracking-widest transition-all ${activeSubTab === 'buildings' ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>동/호수 관리</button>
          {currentUser?.role === 'admin' && (
            <button onClick={() => setActiveSubTab('users')} className={`px-4 py-2 rounded-lg font-label text-[10px] font-bold uppercase tracking-widest transition-all ${activeSubTab === 'users' ? 'bg-primary text-white shadow-md' : 'text-on-surface-variant hover:bg-surface-container-high'}`}>사용자 관리</button>
          )}
        </div>
      </div>

      {activeSubTab === 'site' && (
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
          <div className="mt-8 flex justify-end">
            <button onClick={handleSave} className="bg-primary text-white px-8 py-3 rounded font-label font-bold text-xs uppercase tracking-widest shadow-lg hover:shadow-primary/20 transition-all">설정 저장</button>
          </div>
        </section>
      )}

      {activeSubTab === 'buildings' && editData && (
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
    </div>
  );
};


export default MasterManager;
