import React, { useState, useEffect, useCallback } from 'react';

const API = 'http://localhost:5000/api';
const fmt = (n) => (n || 0).toLocaleString();
const pct = (a, b) => b > 0 ? Math.round(a / b * 100) : 0;

export default function RevenueProjection({ currentSite }) {
  const [oilingPrice, setOilingPrice] = useState(74000);
  const [cleaningPrice, setCleaningPrice] = useState(74000);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const siteId = currentSite?.id || 1;
  const token = localStorage.getItem('ba_token');
  const headers = { Authorization: `Bearer ${token}`, 'X-Site-Id': siteId };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ oiling_price: oilingPrice, cleaning_price: cleaningPrice });
      const res = await fetch(`${API}/analysis/projection?${p}`, { headers });
      setData(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [oilingPrice, cleaningPrice, siteId]);

  useEffect(() => { load(); }, [load]);

  const oiling = data?.oiling;

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-black text-primary font-headline">📈 예상 수입 분석</h2>

      <div className="flex flex-wrap gap-3 p-4 bg-surface-container rounded-xl border border-outline-variant/20">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-outline">갱폼 단가</label>
          <input type="number" value={oilingPrice} onChange={e => setOilingPrice(e.target.value)} step="1000" className="w-28 border border-outline-variant/30 rounded px-2 py-1 text-sm font-bold bg-surface" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-outline">청소 단가</label>
          <input type="number" value={cleaningPrice} onChange={e => setCleaningPrice(e.target.value)} step="1000" className="w-28 border border-outline-variant/30 rounded px-2 py-1 text-sm font-bold bg-surface" />
        </div>
        <button onClick={load} className="px-4 py-1 bg-primary text-white rounded-lg text-sm font-bold">{loading ? '로딩중...' : '조회'}</button>
      </div>

      {/* 요약 카드 */}
      {oiling && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label:'완료 수입', val: oiling.done_total, color:'text-green-700', bg:'bg-green-50', desc:'이미 받았거나 청구 가능' },
            { label:'예상 잔여 수입', val: oiling.remain_total, color:'text-blue-700', bg:'bg-blue-50', desc:'남은 층 완료 시 수입' },
            { label:'전체 예상 수입', val: oiling.total, color:'text-primary', bg:'bg-primary/5', desc:'갱폼 박리제 전체' },
          ].map(c => (
            <div key={c.label} className={`${c.bg} rounded-xl p-5 border border-outline-variant/20`}>
              <p className="text-xs font-bold text-outline uppercase">{c.label}</p>
              <p className={`text-2xl font-black ${c.color} mt-1`}>{fmt(c.val)}<span className="text-sm ml-1">원</span></p>
              <p className="text-xs text-outline mt-1">{c.desc}</p>
            </div>
          ))}
        </div>
      )}

      {/* 건물별 상세 */}
      {oiling && (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden">
          <div className="px-4 py-3 bg-surface-dim/10 border-b border-outline-variant/20">
            <h3 className="font-bold text-sm">갱폼 박리제 동별 예상 수입 (기준층 초과 층 기준)</h3>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="bg-surface-dim/20 border-b border-outline-variant/20">
              {['동','기준층','최고층','대상','완료','남은층','진척률','완료금액','예상잔여','합계'].map(h=>(
                <th key={h} className="px-3 py-2 text-left text-outline font-bold text-[10px] uppercase">{h}</th>
              ))}
            </tr></thead>
            <tbody className="divide-y divide-outline-variant/10">
              {(oiling.by_building || []).map(b => (
                <tr key={b.building} className="hover:bg-primary/5 transition-colors">
                  <td className="px-3 py-3 font-black text-primary">{b.building}</td>
                  <td className="px-3 py-3 text-outline">{b.base_floor}층</td>
                  <td className="px-3 py-3">{b.max_floor}층</td>
                  <td className="px-3 py-3 text-center">{b.total_target}층</td>
                  <td className="px-3 py-3 text-center text-green-700 font-bold">{b.completed}층</td>
                  <td className="px-3 py-3 text-center text-blue-600 font-bold">{b.remaining}층</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div className="h-2 bg-green-500 rounded-full transition-all" style={{ width: `${pct(b.completed, b.total_target)}%` }} />
                      </div>
                      <span className="text-xs font-bold text-outline min-w-[32px] text-right">{pct(b.completed, b.total_target)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-green-700 font-bold text-right">{fmt(b.done_amount)}원</td>
                  <td className="px-3 py-3 text-blue-600 font-bold text-right">{fmt(b.remain_amount)}원</td>
                  <td className="px-3 py-3 text-primary font-black text-right">{fmt(b.total_amount)}원</td>
                </tr>
              ))}
              <tr className="bg-primary/5 font-black text-sm border-t-2 border-primary/20">
                <td className="px-3 py-3 text-primary" colSpan="7">합계</td>
                <td className="px-3 py-3 text-green-700 text-right">{fmt(oiling.done_total)}원</td>
                <td className="px-3 py-3 text-blue-600 text-right">{fmt(oiling.remain_total)}원</td>
                <td className="px-3 py-3 text-primary text-right">{fmt(oiling.total)}원</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {!data && !loading && <div className="py-12 text-center text-outline">데이터를 조회하세요.</div>}
      {loading && <div className="py-12 text-center text-outline">로딩 중...</div>}
    </div>
  );
}
