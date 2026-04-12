import React, { useState, useEffect } from 'react';

const MasterManager = ({ buildings, onRefresh }) => {
  const [selectedBuildingId, setSelectedBuildingId] = useState(buildings[0]?.id || '');
  const [editData, setEditData] = useState(null);
  const [loading, setLoading] = useState(false);

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

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:5000/api/master/save-building', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editData)
      });
      if (res.ok) {
        alert('기준정보가 저장되었습니다.');
        onRefresh();
      } else {
        alert('저장 중 오류가 발생했습니다.');
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  return (
    <div className="animate-fade-in grid grid-cols-1 lg:grid-cols-12 gap-8">
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
  );
};

export default MasterManager;
