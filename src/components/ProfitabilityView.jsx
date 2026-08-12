import React, { useState, useEffect, useCallback, useRef } from 'react';

const API = '/api';

const fmt = (n) => Math.round(n || 0).toLocaleString();
const fmt1 = (n) => (n || 0).toFixed(1).replace(/\.0$/, '');

const monthLabel = (m) => {
  const [y, mo] = m.split('-');
  return `${y}년 ${parseInt(mo)}월`;
};

const ratio = (expense, income) => (income > 0 ? (expense / income) * 100 : 0);

export default function ProfitabilityView({ currentSite }) {
  const [oilingPrice, setOilingPrice] = useState(74000);
  const [cleaningPrice, setCleaningPrice] = useState(74000);
  const [slabPrice, setSlabPrice] = useState(0);
  const [pyeong, setPyeong] = useState(24);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const siteId = currentSite?.id || 1;
  const token = localStorage.getItem('ba_token');

  // 저장된 단가 설정(기준정보 > 단가 설정)을 기본값으로 불러옴 — 화면에서 임시 수정은 계속 가능
  useEffect(() => {
    if (!token) return;
    fetch(`${API}/site-config`, { headers: { Authorization: `Bearer ${token}`, 'X-Site-Id': siteId } })
      .then(r => r.json())
      .then(cfg => {
        if (cfg?.oiling_price != null) setOilingPrice(parseInt(cfg.oiling_price) || 0);
        if (cfg?.cleaning_price != null) setCleaningPrice(parseInt(cfg.cleaning_price) || 0);
        if (cfg?.slab_price != null) setSlabPrice(parseInt(cfg.slab_price) || 0);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, token]);

  // 단가(oilingPrice 등)는 site-config 조회가 끝나기 전/후로 두 번 바뀔 수 있어
  // load()도 두 번 이상 호출된다. 먼저 보낸 요청의 응답이 나중에 도착하면 최신 값을
  // 덮어쓸 수 있으므로, 가장 마지막에 보낸 요청의 응답만 반영한다.
  const requestIdRef = useRef(0);
  const load = useCallback(async () => {
    if (!token) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}`, 'X-Site-Id': siteId };
      const p = new URLSearchParams({ oiling_price: oilingPrice, cleaning_price: cleaningPrice, slab_price: slabPrice, pyeong });
      const res = await fetch(`${API}/analysis/profitability?${p}`, { headers });
      const json = await res.json();
      if (requestId === requestIdRef.current) setData(json);
    } catch (e) {
      console.error('수익성 분석 로드 실패:', e);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [oilingPrice, cleaningPrice, slabPrice, pyeong, siteId, token]);

  useEffect(() => { load(); }, [load]);

  const unitRows = data ? [
    { label: '기름칠', key: 'oiling' },
    { label: '슬라브', key: 'slab' },
    { label: '1차 청소', key: 'clean1' },
    { label: '2차 청소', key: 'clean2' },
    { label: '청소 합계', key: 'clean_total' },
    { label: '전체 합계(세대당)', key: 'all_total' },
  ] : [];

  return (
    <div className="space-y-5 animate-in fade-in duration-500 max-w-5xl">
      <div>
        <p className="text-[10px] font-label font-bold uppercase tracking-[0.2em] text-secondary mb-1">Profitability</p>
        <h2 className="text-3xl font-black text-primary font-headline tracking-tight">수익성 분석</h2>
        <p className="text-sm text-gray-400 font-label mt-1">도급 시작일부터 오늘까지 누적 손익 · 세대당/평당/㎡당 단가</p>
      </div>

      {/* 조건바 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">기름칠 단가(세대당)</label>
          <input type="number" value={oilingPrice} onChange={(e) => setOilingPrice(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold outline-none" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">슬라브 단가(세대당)</label>
          <input type="number" value={slabPrice} onChange={(e) => setSlabPrice(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold outline-none" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">청소 단가(1차·2차 공통, 세대당)</label>
          <input type="number" value={cleaningPrice} onChange={(e) => setCleaningPrice(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold outline-none" />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">세대당 평수(전용면적)</label>
          <input type="number" value={pyeong} onChange={(e) => setPyeong(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold outline-none" />
        </div>
      </div>

      {loading && !data && (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {data && (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { label: '누적 총수입', val: data.income_total, color: 'text-primary', bg: 'bg-primary/5' },
              { label: '누적 인건비 지출', val: data.expense_total, color: 'text-red-600', bg: 'bg-red-50', ratio: ratio(data.expense_total, data.income_total) },
              { label: '누적 순수익', val: data.net_total, color: data.net_total >= 0 ? 'text-emerald-700' : 'text-red-700', bg: data.net_total >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
            ].map(c => (
              <div key={c.label} className={`${c.bg} rounded-xl p-5 border border-outline-variant/20`}>
                <p className="text-xs font-bold text-outline uppercase">{c.label}</p>
                <p className={`text-2xl font-black ${c.color} mt-1`}>{fmt(c.val)}<span className="text-xs ml-1">원</span></p>
                {c.ratio != null && <p className="text-[11px] font-bold text-red-500 mt-1">수입 대비 {fmt1(c.ratio)}%</p>}
              </div>
            ))}
          </div>

          {/* 월별 추이 */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden">
            <div className="bg-surface-dim/20 px-4 py-3 border-b border-outline-variant/20">
              <h3 className="font-bold text-sm text-primary">월별 손익 추이</h3>
            </div>
            <table className="w-full text-xs">
              <thead><tr className="bg-surface-dim/10 border-b border-outline-variant/10">
                {['월', '수입', '인건비 지출', '인건비 비율', '순익'].map(h => <th key={h} className="px-3 py-2 text-left text-outline font-bold uppercase text-[10px]">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-outline-variant/10">
                {data.months.map(m => (
                  <tr key={m.month} className="hover:bg-primary/5 transition-colors">
                    <td className="px-3 py-2 font-bold text-primary">{monthLabel(m.month)}</td>
                    <td className="px-3 py-2">{fmt(m.income)}원</td>
                    <td className="px-3 py-2 text-red-600">{fmt(m.expense)}원</td>
                    <td className="px-3 py-2 text-red-500 font-bold">{fmt1(ratio(m.expense, m.income))}%</td>
                    <td className={`px-3 py-2 font-bold ${m.net >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmt(m.net)}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 단가 분석 */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden">
            <div className="bg-purple-600/10 px-4 py-3 border-b border-outline-variant/20">
              <h3 className="font-bold text-sm text-purple-700">단가 분석 — 세대당 {fmt1(data.unit_price.pyeong)}평({fmt1(data.unit_price.area_m2)}㎡) 기준</h3>
            </div>
            <table className="w-full text-xs">
              <thead><tr className="bg-surface-dim/10 border-b border-outline-variant/10">
                {['공정', '세대당', '평당', '㎡당'].map(h => <th key={h} className="px-3 py-2 text-left text-outline font-bold uppercase text-[10px]">{h}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-outline-variant/10">
                {unitRows.map(row => (
                  <tr key={row.key} className={row.key === 'all_total' ? 'bg-purple-50 font-black' : 'hover:bg-purple-50/40 transition-colors'}>
                    <td className="px-3 py-2 font-bold">{row.label}</td>
                    <td className="px-3 py-2">{fmt(data.unit_price.per_unit[row.key])}원</td>
                    <td className="px-3 py-2">{fmt(data.unit_price.per_pyeong[row.key])}원</td>
                    <td className="px-3 py-2">{fmt(data.unit_price.per_m2[row.key])}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
