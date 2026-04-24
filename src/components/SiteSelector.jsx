import React, { useState, useEffect } from 'react';

const API_URL = 'http://localhost:5000/api';

export default function SiteSelector({ onSelect }) {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('ba_token');
      const res = await fetch(`${API_URL}/sites`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `서버 응답 오류 (${res.status})`);
      }
      const data = await res.json();
      setSites(data || []);
    } catch (e) {
      console.error('현장 목록 로드 실패:', e);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="fixed inset-0 bg-surface flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  );

  if (error) return (
    <div className="fixed inset-0 bg-surface z-[200] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-surface-container rounded-2xl p-8 border border-error/20 text-center space-y-6">
        <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto">
          <span className="material-symbols-outlined text-error text-3xl">error</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-on-surface">현장 정보를 불러올 수 없습니다</h2>
          <p className="text-sm text-on-surface-variant mt-2">{error}</p>
        </div>
        <button 
          onClick={fetchSites}
          className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-sm">refresh</span>
          다시 시도
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-surface z-[200] flex items-center justify-center p-6">
      <div className="w-full max-w-4xl space-y-8">
        <div className="text-center">
          <h1 className="text-5xl font-black text-primary tracking-tighter mb-2 font-headline italic">CLEARING</h1>
          <p className="text-on-surface-variant font-label text-sm uppercase tracking-[0.3em]">Select Project Site</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sites.map(site => (
            <div 
              key={site.id} 
              onClick={() => onSelect(site)}
              className="group bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-6 cursor-pointer hover:border-primary hover:shadow-2xl hover:shadow-primary/10 transition-all active:scale-[0.98] relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-symbols-outlined text-6xl">apartment</span>
              </div>
              
              <div className="relative z-10">
                <h3 className="text-xl font-black text-on-surface mb-4 group-hover:text-primary transition-colors">{site.name}</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-outline">business</span>
                    <span className="text-[10px] font-label font-bold uppercase tracking-widest text-outline">원청:</span>
                    <span className="text-xs font-bold text-on-surface-variant">{site.primary_contractor || '미지정'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-outline">handyman</span>
                    <span className="text-[10px] font-label font-bold uppercase tracking-widest text-outline">하청:</span>
                    <span className="text-xs font-bold text-on-surface-variant">{site.subcontractor || '미지정'}</span>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-outline-variant/10 flex items-center justify-between">
                  <span className="text-[9px] font-label font-bold text-outline uppercase tracking-widest">
                    {site.start_date ? `${site.start_date} 시작` : '일정 미지정'}
                  </span>
                  <span className="material-symbols-outlined text-primary opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">arrow_forward</span>
                </div>
              </div>
            </div>
          ))}

          {sites.length === 0 && (
            <div className="col-span-full py-20 text-center bg-surface-container-low rounded-2xl border-2 border-dashed border-outline-variant/30">
              <span className="material-symbols-outlined text-4xl text-outline mb-4">domain_disabled</span>
              <p className="text-on-surface-variant font-body">사용 가능한 현장이 없습니다.</p>
              <p className="text-outline font-label text-[10px] mt-2 uppercase tracking-widest">관리자에게 문의하세요.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
