import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:5000/api';

const MasterManager = ({ buildings, onRefresh }) => {
  // ── 상태 관리 (설정 정보를 임시로 담아두는 곳) ──
  const [selectedBuildingId, setSelectedBuildingId] = useState(buildings[0]?.id || ''); // 현재 편집 중인 건물(동)
  const [editData, setEditData] = useState(null);                                     // 편집 중인 건물의 상세 데이터
  const [loading, setLoading] = useState(false);                                      // 저장 중인지 표시하는 상태
  const [siteConfig, setSiteConfig] = useState({ site_address: '', start_date: '', end_date: '' }); // 현장 공통 정보 (주소, 날짜 등)

  // 처음 화면이 열릴 때 현장 설정 정보를 가져옵니다.
  useEffect(() => {
    fetchSiteConfig();
  }, []);

  // 서버에서 현장 설정(주소 등)을 읽어옵니다.
  const fetchSiteConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/site-config`);
      const data = await res.json();
      if (data) setSiteConfig(data);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (selectedBuildingId) {
      const b = buildings.find(item => item.id == selectedBuildingId);
      if (b) {
        setEditData({ ...b, houses: b.houses.map(h => ({ ...h })) });
      }
    }
  }, [selectedBuildingId, buildings]);

  if (!editData) return <div className="p-12 text-center text-outline">동을 선택하세요.</div>;

  const handleAddLine = () => {
    const nextLine = editData.houses.length + 1;
    setEditData({
      ...editData,
      houses: [...editData.houses, { line: nextLine, ho: `${nextLine}호`, floors: 20, basement_label_b1: 'B1', basement_label_b2: 'B2' }]
    });
  };

  // ── 데이터 저장 로직 (확정 버튼 클릭 시) ──
  const handleSave = async () => {
    setLoading(true); // '처리 중' 상태로 변경
    try {
      // 1. 건물/세대 마스터 정보(동 이름, 층수 등)를 서버에 저장합니다.
      const resB = await fetch(`${API_URL}/master/save-building`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      
      // 2. 현장 공통 정보(현장 주소, 공사 시작/종료일)를 서버에 저장합니다.
      const resS = await fetch(`${API_URL}/site-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteConfig)
      });

      if (resB.ok && resS.ok) {
        alert('기준정보 및 현장 설정이 저장되었습니다.');
        fetchSiteConfig(); // 저장된 최신 현장 정보를 다시 불러옵니다.
        onRefresh();       // 상위 화면(앱 전체)의 데이터를 새로고침합니다.
      } else {
        alert('저장 중 일부 오류가 발생했습니다.');
      }
    } catch (err) { 
      console.error('저장 실패:', err); 
      alert('서버와 통신하는 중 오류가 발생했습니다.');
    } finally { 
      setLoading(false); // 처리가 끝나면 버튼을 다시 활성화합니다.
    }
  };

  return (
    <div className="animate-fade-in space-y-8">
      {/* ── Site Common Info Section ── */}
      <section className="bg-surface-container-lowest p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)] relative overflow-hidden rounded">
        <div className="absolute top-0 left-0 w-1 h-full bg-tertiary"></div>
        <div className="flex items-center gap-2 mb-8">
          <span className="material-symbols-outlined text-tertiary">location_on</span>
          <h3 className="font-label text-sm font-bold uppercase tracking-widest text-tertiary">현장 공통 정보</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 group">
            <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2 group-focus-within:text-tertiary transition-colors">현장 위치 (주소)</label>
            <input 
              className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-tertiary transition-all text-on-surface font-bold py-3 px-2 placeholder:text-outline-variant/60" 
              type="text" 
              placeholder="도로명 주소 또는 지번 입력" 
              value={siteConfig.site_address || ''} 
              onChange={(e) => setSiteConfig({ ...siteConfig, site_address: e.target.value })} 
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="group">
              <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2 group-focus-within:text-tertiary transition-colors">공사 시작일</label>
              <input 
                className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-tertiary transition-all text-on-surface font-bold py-3 px-2" 
                type="date" 
                value={siteConfig.start_date || ''} 
                onChange={(e) => setSiteConfig({ ...siteConfig, start_date: e.target.value })} 
              />
            </div>
            <div className="group">
              <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2 group-focus-within:text-tertiary transition-colors">공사 종료일</label>
              <input 
                className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-tertiary transition-all text-on-surface font-bold py-3 px-2" 
                type="date" 
                value={siteConfig.end_date || ''} 
                onChange={(e) => setSiteConfig({ ...siteConfig, end_date: e.target.value })} 
              />
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Form & Houses */}
      <div className="lg:col-span-8 space-y-8">
        <section className="bg-surface-container-lowest p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)] relative overflow-hidden rounded">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
          
          {/* Header Action */}
          <div className="flex items-center justify-between mb-8">
             <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">corporate_fare</span>
                <h3 className="font-label text-sm font-bold uppercase tracking-widest text-primary">건물 선택 및 관리</h3>
             </div>
             
             <select 
               className="bg-surface-container border-0 border-b-2 border-primary focus:ring-0 transition-all text-primary font-bold py-2 px-4 rounded-sm"
               value={selectedBuildingId} 
               onChange={(e) => setSelectedBuildingId(e.target.value)}
             >
                {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
             </select>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
            <div className="group">
              <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2 group-focus-within:text-primary transition-colors">동 명칭</label>
              <input className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-3 px-2 placeholder:text-outline-variant/60" type="text" value={editData.name} onChange={(e) => setEditData({ ...editData, name: e.target.value })} />
            </div>
            
            <div className="group">
              <label className="block font-label text-[10px] uppercase tracking-widest text-outline mb-2 group-focus-within:text-primary transition-colors">지하 지원 층수</label>
              <select className="w-full bg-surface-container-low border-0 border-b-2 border-outline-variant/30 focus:ring-0 focus:border-primary transition-all text-on-surface font-bold py-3 px-2" value={editData.basement_count} onChange={(e) => setEditData({ ...editData, basement_count: parseInt(e.target.value) })}>
                {[0, 1, 2, 3].map(v => <option key={v} value={v}>지하 {v > 0 ? v + '개 층' : '없음'}</option>)}
              </select>
            </div>
          </div>
        </section>

        <section className="bg-surface-container-lowest p-8 shadow-[0_4px_24px_rgba(0,0,0,0.04)] relative">
          <div className="absolute top-0 left-0 w-1 h-full bg-secondary"></div>
          
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">grid_view</span>
              <h3 className="font-label text-sm font-bold uppercase tracking-widest text-secondary">세대 라인 스펙</h3>
            </div>
            <button className="flex items-center gap-1 font-label text-[10px] uppercase tracking-widest text-secondary hover:text-secondary-container transition-colors" onClick={handleAddLine}>
              <span className="material-symbols-outlined text-sm">add</span> 호수 라인 추가
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left bg-surface-dim/5">
              <thead className="bg-surface-dim/20">
                <tr>
                  <th className="py-4 px-4 font-label text-[10px] uppercase tracking-widest text-outline">Line</th>
                  <th className="py-4 px-4 font-label text-[10px] uppercase tracking-widest text-outline">호수명</th>
                  <th className="py-4 px-4 font-label text-[10px] uppercase tracking-widest text-outline">최상단 층수</th>
                  <th className="py-4 px-4 font-label text-[10px] uppercase tracking-widest text-outline">B1 라벨</th>
                  <th className="py-4 px-4 font-label text-[10px] uppercase tracking-widest text-outline">B2 라벨</th>
                  <th className="py-4 px-4 font-label text-[10px] uppercase tracking-widest text-outline text-right">삭제</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant/50">
                {editData.houses.map((h, index) => (
                  <tr key={index} className="hover:bg-surface-container-low transition-colors">
                    <td className="py-4 px-4 font-label font-bold text-primary">{h.line}</td>
                    <td className="py-4 px-3">
                      <input type="text" className="w-full bg-transparent border-0 focus:ring-0 focus:border-b-2 border-primary font-bold px-1" value={h.ho} onChange={(e) => {
                        const next = [...editData.houses]; next[index].ho = e.target.value; setEditData({ ...editData, houses: next });
                      }} />
                    </td>
                    <td className="py-4 px-3">
                      <input type="number" className="w-full bg-transparent border-0 focus:ring-0 focus:border-b-2 border-primary font-body px-1" value={h.floors} onChange={(e) => {
                        const next = [...editData.houses]; next[index].floors = parseInt(e.target.value) || 0; setEditData({ ...editData, houses: next });
                      }} />
                    </td>
                    <td className="py-4 px-3">
                      <input type="text" placeholder="B1" className="w-full bg-surface-container-high border-0 focus:ring-0 rounded-sm font-label text-xs p-1 px-2" value={h.basement_label_b1 || ''} onChange={(e) => {
                        const next = [...editData.houses]; next[index].basement_label_b1 = e.target.value; setEditData({ ...editData, houses: next });
                      }} />
                    </td>
                    <td className="py-4 px-3">
                      <input type="text" placeholder="B2" className="w-full bg-surface-container-high border-0 focus:ring-0 rounded-sm font-label text-xs p-1 px-2" value={h.basement_label_b2 || ''} onChange={(e) => {
                        const next = [...editData.houses]; next[index].basement_label_b2 = e.target.value; setEditData({ ...editData, houses: next });
                      }} />
                    </td>
                    <td className="py-4 px-4 text-right">
                       <span className="material-symbols-outlined text-outline cursor-pointer hover:text-error transition-colors text-sm" onClick={() => {
                        const next = [...editData.houses]; next.splice(index, 1); setEditData({ ...editData, houses: next.map((x, i) => ({ ...x, line: i + 1 })) });
                      }}>delete</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      
      {/* Right Column: Visual Summary */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-primary text-white p-8 relative overflow-hidden rounded-sm shadow-lg">
          <div className="absolute -right-8 -bottom-8 opacity-10">
            <span className="material-symbols-outlined text-[160px]">architecture</span>
          </div>
          <h4 className="font-label text-xs uppercase tracking-[0.2em] opacity-70 mb-4">현재 동 요약</h4>
          <div className="space-y-4 relative z-10">
             <div className="flex justify-between items-baseline border-b border-white/10 pb-2">
               <span className="font-body text-sm opacity-80">라인 개수</span>
               <span className="font-label text-2xl font-bold">{editData.houses.length} <small className="text-[10px] opacity-60">Lines</small></span>
             </div>
             <div className="flex justify-between items-baseline border-b border-white/10 pb-2">
               <span className="font-body text-sm opacity-80">설정된 지하</span>
               <span className="font-label text-2xl font-bold">{editData.basement_count} <small className="text-[10px] opacity-60">층</small></span>
             </div>
             <div className="flex justify-between items-baseline">
               <span className="font-body text-sm opacity-80">최고 높이</span>
               <span className="font-label text-2xl font-bold">{Math.max(...editData.houses.map(h => h.floors), 0)} <small className="text-[10px] opacity-60">F</small></span>
             </div>
          </div>
        </div>
        
        <button 
           onClick={handleSave} 
           disabled={loading}
           className="w-full bg-gradient-to-br from-primary to-primary-container text-white py-5 font-black uppercase tracking-widest text-sm shadow-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-transform rounded-sm"
        >
          <span className="material-symbols-outlined">save</span> 
          {loading ? '처리 중...' : '마스터 데이터 확정'}
        </button>
      </div>
    </div>
  </div>
);
};

export default MasterManager;
