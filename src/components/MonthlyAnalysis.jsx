import React, { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';

const API = 'http://localhost:5000/api';

const fmt = (n) => (n || 0).toLocaleString();

export default function MonthlyAnalysis({ currentSite }) {
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [periodMode, setPeriodMode] = useState('split');
  const [splitDay, setSplitDay] = useState(15);
  const [oilingPrice, setOilingPrice] = useState(74000);
  const [cleaningPrice, setCleaningPrice] = useState(74000);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [rightTab, setRightTab] = useState('oiling');

  const siteId = currentSite?.id || 1;
  const token = localStorage.getItem('ba_token');
  const headers = { Authorization: `Bearer ${token}`, 'X-Site-Id': siteId };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ month, split_day: splitDay, oiling_price: oilingPrice, cleaning_price: cleaningPrice, period_mode: periodMode });
      const res = await fetch(`${API}/analysis/monthly?${p}`, { headers });
      setData(await res.json());
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [month, splitDay, oilingPrice, cleaningPrice, periodMode, siteId]);

  useEffect(() => { load(); }, [load]);

  const oilingDetails = data?.oiling?.details || [];
  const cleaningDetails = data?.cleaning?.details || [];
  const filteredOiling = selectedBuilding ? oilingDetails.filter(r => r.building === selectedBuilding) : oilingDetails;
  const filteredCleaning = selectedBuilding ? cleaningDetails.filter(r => r.building === selectedBuilding) : cleaningDetails;
  const filteredExtra = selectedBuilding ? (data?.cleaning_extra || []).filter(r => r.building === selectedBuilding) : (data?.cleaning_extra || []);

  const handlePrint = () => window.print();

  const handleExcelDownload = () => {
    const p = new URLSearchParams({ 
      month, 
      split_day: splitDay, 
      oiling_price: oilingPrice, 
      cleaning_price: cleaningPrice, 
      period_mode: periodMode 
    });
    window.location.href = `${API}/analysis/export-monthly?${p}`;
  };

  return (
    <div className="space-y-4">
      <style>{`@media print{.no-print{display:none!important}.print-only{display:block!important}.left-panel{width:100%!important}.right-panel{display:none!important}}`}</style>

      {/* 헤더 */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <h2 className="text-3xl font-black text-primary font-headline">📊 월별 통합 정산 분석</h2>
        <div className="flex gap-2">
          <button onClick={handleExcelDownload} className="flex items-center gap-2 px-4 py-2 bg-secondary text-white rounded-lg font-bold text-sm hover:opacity-90 transition-opacity">
            <span className="material-symbols-outlined text-sm">download</span> 엑셀 저장
          </button>
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-bold text-sm hover:bg-primary/90 transition-colors">
            <span className="material-symbols-outlined text-sm">print</span> 청구서 출력
          </button>
        </div>
      </div>

      {/* 조건바 */}
      <div className="flex flex-wrap gap-3 p-4 bg-surface-container rounded-xl border border-outline-variant/20 no-print">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-outline uppercase">월</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} className="border border-outline-variant/30 rounded px-2 py-1 text-sm font-bold bg-surface" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-outline uppercase">기준일</label>
          <input type="number" value={splitDay} onChange={e => setSplitDay(e.target.value)} className="w-16 border border-outline-variant/30 rounded px-2 py-1 text-sm font-bold bg-surface" min="1" max="31" />
        </div>
        <div className="flex bg-surface p-1 rounded-lg border border-outline-variant/20">
          {[['split','도급기간만'],['all','전체기간']].map(([v,l]) => (
            <button key={v} onClick={() => setPeriodMode(v)} className={`px-3 py-1 rounded text-xs font-bold transition-all ${periodMode===v ? 'bg-primary text-white' : 'text-on-surface-variant'}`}>{l}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-outline">갱폼단가</label>
          <input type="number" value={oilingPrice} onChange={e => setOilingPrice(e.target.value)} className="w-24 border border-outline-variant/30 rounded px-2 py-1 text-sm font-bold bg-surface" step="1000" />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-outline">청소단가</label>
          <input type="number" value={cleaningPrice} onChange={e => setCleaningPrice(e.target.value)} className="w-24 border border-outline-variant/30 rounded px-2 py-1 text-sm font-bold bg-surface" step="1000" />
        </div>
        <button onClick={load} className="px-4 py-1 bg-secondary text-white rounded-lg text-sm font-bold">{loading ? '로딩중...' : '조회'}</button>
      </div>

      {/* 요약 카드 */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label:'갱폼 수입', val: data.oiling?.total, color:'text-blue-600', bg:'bg-blue-50' },
            { label:'청소 수입', val: data.cleaning?.total, color:'text-green-600', bg:'bg-green-50' },
            { label:'합계 수입', val: data.summary?.income, color:'text-primary', bg:'bg-primary/5' },
            { label:'인건비 지출', val: data.expense?.total, color:'text-red-600', bg:'bg-red-50' },
            { label:'순수익', val: data.summary?.net, color:'text-emerald-700', bg:'bg-emerald-50' },
          ].map(c => (
            <div key={c.label} className={`${c.bg} rounded-xl p-4 border border-outline-variant/20`}>
              <p className="text-xs font-bold text-outline uppercase">{c.label}</p>
              <p className={`text-xl font-black ${c.color} mt-1`}>{fmt(c.val)}<span className="text-xs ml-1">원</span></p>
            </div>
          ))}
        </div>
      )}

      {/* 2분할 레이아웃 */}
      <div className="flex gap-4" style={{ minHeight: '600px' }}>

        {/* 좌측: 동별 합계 */}
        <div className="left-panel w-80 flex-shrink-0 space-y-4 overflow-y-auto">
          {/* 갱폼 */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden">
            <div className="bg-blue-600/10 px-4 py-3 border-b border-outline-variant/20">
              <h3 className="font-bold text-sm text-blue-700">갱폼 박리제 동별 합계</h3>
            </div>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-outline-variant/10 bg-surface-dim/10">
                <th className="px-3 py-2 text-left text-outline">동</th>
                <th className="px-2 py-2 text-center text-outline">세대</th>
                <th className="px-2 py-2 text-right text-outline">확정금액</th>
              </tr></thead>
              <tbody>
                {(data?.oiling?.by_building || []).map(b => (
                  <tr key={b.building} onClick={() => setSelectedBuilding(selectedBuilding === b.building ? null : b.building)}
                    className={`cursor-pointer border-b border-outline-variant/10 hover:bg-primary/5 transition-colors ${selectedBuilding === b.building ? 'bg-primary/10' : ''}`}>
                    <td className="px-3 py-2 font-bold text-primary">{b.building}</td>
                    <td className="px-2 py-2 text-center">{b.total_units}세대</td>
                    <td className="px-2 py-2 text-right font-bold">{fmt(b.billable_amount)}원</td>
                  </tr>
                ))}
                {data && <tr className="bg-blue-50 font-black">
                  <td className="px-3 py-2 text-blue-700">소계</td>
                  <td className="px-2 py-2 text-center text-blue-700">{(data.oiling?.by_building||[]).reduce((s,b)=>s+b.total_units,0)}세대</td>
                  <td className="px-2 py-2 text-right text-blue-700">{fmt(data.oiling?.total)}원</td>
                </tr>}
              </tbody>
            </table>
            {/* 비고 */}
            {(data?.oiling?.by_building || []).filter(b => !selectedBuilding || b.building === selectedBuilding).map(b => b.remark && (
              <div key={b.building} className="px-3 py-1 text-xs text-outline border-t border-outline-variant/10">
                <span className="font-bold text-primary">{b.building}</span> {b.remark}
              </div>
            ))}
          </div>

          {/* 세대청소 */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden">
            <div className="bg-green-600/10 px-4 py-3 border-b border-outline-variant/20">
              <h3 className="font-bold text-sm text-green-700">세대청소 동별 합계</h3>
            </div>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-outline-variant/10 bg-surface-dim/10">
                <th className="px-3 py-2 text-left text-outline">동</th>
                <th className="px-2 py-2 text-center text-outline">세대</th>
                <th className="px-2 py-2 text-right text-outline">확정금액</th>
              </tr></thead>
              <tbody>
                {(data?.cleaning?.by_building || []).map(b => (
                  <tr key={b.building} onClick={() => setSelectedBuilding(selectedBuilding === b.building ? null : b.building)}
                    className={`cursor-pointer border-b border-outline-variant/10 hover:bg-primary/5 transition-colors ${selectedBuilding === b.building ? 'bg-primary/10' : ''}`}>
                    <td className="px-3 py-2 font-bold text-primary">{b.building}</td>
                    <td className="px-2 py-2 text-center">{b.total_units}세대</td>
                    <td className="px-2 py-2 text-right font-bold">{fmt(b.billable_amount)}원</td>
                  </tr>
                ))}
                {data && <tr className="bg-green-50 font-black">
                  <td className="px-3 py-2 text-green-700">소계</td>
                  <td className="px-2 py-2 text-center text-green-700">{(data.cleaning?.by_building||[]).reduce((s,b)=>s+b.total_units,0)}세대</td>
                  <td className="px-2 py-2 text-right text-green-700">{fmt(data.cleaning?.total)}원</td>
                </tr>}
              </tbody>
            </table>
            {(data?.cleaning?.by_building || []).filter(b => !selectedBuilding || b.building === selectedBuilding).map(b => b.remark && (
              <div key={b.building} className="px-3 py-1 text-xs text-outline border-t border-outline-variant/10">
                <span className="font-bold text-primary">{b.building}</span> {b.remark}
              </div>
            ))}
          </div>

          {/* 손익 */}
          {data && (
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20 p-4 space-y-2">
              <h3 className="font-bold text-sm text-primary">손익 요약</h3>
              {[['수입',data.summary?.income,'text-green-700'],['지출',data.expense?.total,'text-red-600'],['순수익',data.summary?.net,'text-primary font-black text-lg']].map(([l,v,c]) => (
                <div key={l} className="flex justify-between text-sm">
                  <span className="text-outline font-bold">{l}</span>
                  <span className={c}>{fmt(v)}원</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 우측: 상세 내역 */}
        <div className="right-panel flex-1 min-w-0 space-y-3 overflow-y-auto">
          {/* 동 필터 */}
          <div className="flex flex-wrap gap-2 no-print">
            <button onClick={() => setSelectedBuilding(null)} className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${!selectedBuilding ? 'bg-primary text-white' : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high'}`}>전체</button>
            {[...new Set([...(data?.oiling?.by_building||[]).map(b=>b.building), ...(data?.cleaning?.by_building||[]).map(b=>b.building)])].map(name => (
              <button key={name} onClick={() => setSelectedBuilding(selectedBuilding===name?null:name)}
                className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${selectedBuilding===name ? 'bg-primary text-white' : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high'}`}>{name}</button>
            ))}
          </div>

          {/* 탭 */}
          <div className="flex border-b border-outline-variant/20 no-print">
            {[['oiling','갱폼 박리제'],['cleaning','세대청소'],['expense','인건비'],['extra','기타작업']].map(([id,label]) => (
              <button key={id} onClick={() => setRightTab(id)}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all ${rightTab===id ? 'border-primary text-primary' : 'border-transparent text-outline hover:text-on-surface'}`}>{label}</button>
            ))}
          </div>

          {/* 갱폼 상세 */}
          {rightTab === 'oiling' && (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="bg-surface-dim/20 border-b border-outline-variant/20">
                  {['날짜','동','층','기준층','세대수','금액'].map(h=><th key={h} className="px-3 py-2 text-left text-outline font-bold uppercase text-[10px]">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {filteredOiling.map((r,i) => (
                    <tr key={i} className={`${!r.is_billable ? 'bg-gray-50 opacity-60' : 'hover:bg-primary/5'} transition-colors`}>
                      <td className="px-3 py-2 font-mono">{r.date?.slice(5)}</td>
                      <td className="px-3 py-2 font-bold text-primary">{r.building}</td>
                      <td className="px-3 py-2">{r.floor}층</td>
                      <td className="px-3 py-2">{r.is_billable ? <span className="text-green-600 font-bold">✅ 청구</span> : <span className="text-red-500 font-bold">⛔ 제외</span>}</td>
                      <td className="px-3 py-2 text-center">{r.units}세대</td>
                      <td className={`px-3 py-2 font-bold ${r.is_billable ? 'text-blue-700' : 'text-gray-400 line-through'}`}>{r.is_billable ? `${fmt(r.amount)}원` : '-'}</td>
                    </tr>
                  ))}
                  {filteredOiling.length===0 && <tr><td colSpan="6" className="py-8 text-center text-outline">데이터 없음</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* 세대청소 상세 */}
          {rightTab === 'cleaning' && (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="bg-surface-dim/20 border-b border-outline-variant/20">
                  {['동','층','차수','완료/전체','상태','금액'].map(h=><th key={h} className="px-3 py-2 text-left text-outline font-bold uppercase text-[10px]">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {filteredCleaning.map((r,i) => (
                    <tr key={i} className={`${!r.is_billable ? 'bg-gray-50 opacity-70' : 'hover:bg-green-50'} transition-colors`}>
                      <td className="px-3 py-2 font-bold text-primary">{r.building}</td>
                      <td className="px-3 py-2">{r.floor}층</td>
                      <td className="px-3 py-2">{r.phase}차</td>
                      <td className="px-3 py-2 text-center">{r.cleaned}/{r.total}</td>
                      <td className="px-3 py-2">{r.is_billable ? <span className="text-green-600 font-bold">✅ 청구</span> : r.is_complete ? <span className="text-orange-500">⚠️ 기준층이하</span> : <span className="text-red-400">⚠️ 미완성</span>}</td>
                      <td className={`px-3 py-2 font-bold ${r.is_billable ? 'text-green-700' : 'text-gray-400'}`}>{r.is_billable ? `${fmt(r.amount)}원` : '-'}</td>
                    </tr>
                  ))}
                  {filteredCleaning.length===0 && <tr><td colSpan="6" className="py-8 text-center text-outline">데이터 없음</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* 인건비 */}
          {rightTab === 'expense' && (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden">
              <table className="w-full text-xs">
                <thead><tr className="bg-surface-dim/20 border-b border-outline-variant/20">
                  {['작업자','공수(MD)','단가','금액'].map(h=><th key={h} className="px-3 py-2 text-left text-outline font-bold uppercase text-[10px]">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {(data?.expense?.workers||[]).map((w,i) => (
                    <tr key={i} className="hover:bg-red-50 transition-colors">
                      <td className="px-3 py-2 font-bold">{w.name}</td>
                      <td className="px-3 py-2">{w.total_md?.toFixed(2)} MD</td>
                      <td className="px-3 py-2">{fmt(w.unit_price)}원</td>
                      <td className="px-3 py-2 font-bold text-red-600">{fmt(w.amount)}원</td>
                    </tr>
                  ))}
                  {data && <tr className="bg-red-50 font-black">
                    <td colSpan="3" className="px-3 py-2 text-red-700">합계</td>
                    <td className="px-3 py-2 text-red-700">{fmt(data.expense?.total)}원</td>
                  </tr>}
                  {(data?.expense?.workers||[]).length===0 && <tr><td colSpan="4" className="py-8 text-center text-outline">데이터 없음</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {/* 기타작업 */}
          {rightTab === 'extra' && (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden">
              <div className="px-4 py-3 bg-amber-50 border-b border-outline-variant/20">
                <p className="text-xs text-amber-700 font-bold">🏗️ 지하층 청소 등 기타 작업 내역 (별도 청구 참고용)</p>
              </div>
              <table className="w-full text-xs">
                <thead><tr className="bg-surface-dim/20 border-b border-outline-variant/20">
                  {['동','작업내용','날짜'].map(h=><th key={h} className="px-3 py-2 text-left text-outline font-bold uppercase text-[10px]">{h}</th>)}
                </tr></thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {filteredExtra.map((r,i) => (
                    <tr key={i} className="hover:bg-amber-50 transition-colors">
                      <td className="px-3 py-2 font-bold text-primary">{r.building}</td>
                      <td className="px-3 py-2">{r.label}</td>
                      <td className="px-3 py-2 font-mono text-outline">{r.date}</td>
                    </tr>
                  ))}
                  {filteredExtra.length===0 && <tr><td colSpan="3" className="py-8 text-center text-outline">기타 작업 내역 없음</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 인쇄용 청구서 (화면에서는 숨김) */}
      <div className="hidden print-only p-8 space-y-6">
        <div className="text-center border-b-2 pb-4">
          <h1 className="text-2xl font-black">월별 정산 내역서</h1>
          <p className="text-gray-600">{month} ({periodMode==='split'?`${splitDay+1}일~말일`:'전체기간'})</p>
        </div>
        <div>
          <h2 className="font-bold text-lg mb-2">1. 갱폼 박리제 도급 내역</h2>
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead><tr className="bg-gray-100"><th className="border border-gray-300 p-2">동</th><th className="border border-gray-300 p-2">세대</th><th className="border border-gray-300 p-2">작업층/세대수</th><th className="border border-gray-300 p-2">금액</th></tr></thead>
            <tbody>
              {(data?.oiling?.by_building||[]).map(b=>(
                <tr key={b.building}><td className="border border-gray-300 p-2 font-bold">{b.building}</td><td className="border border-gray-300 p-2 text-center">{b.total_units}세대</td><td className="border border-gray-300 p-2">{b.remark}</td><td className="border border-gray-300 p-2 text-right font-bold">{fmt(b.billable_amount)}원</td></tr>
              ))}
              <tr className="bg-blue-50 font-black"><td className="border border-gray-300 p-2">소계</td><td className="border border-gray-300 p-2 text-center">{(data?.oiling?.by_building||[]).reduce((s,b)=>s+b.total_units,0)}세대</td><td className="border border-gray-300 p-2"></td><td className="border border-gray-300 p-2 text-right text-blue-700">{fmt(data?.oiling?.total)}원</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="font-bold text-lg mb-2">2. 세대청소 도급 내역</h2>
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead><tr className="bg-gray-100"><th className="border border-gray-300 p-2">동</th><th className="border border-gray-300 p-2">세대</th><th className="border border-gray-300 p-2">작업층/차수</th><th className="border border-gray-300 p-2">금액</th></tr></thead>
            <tbody>
              {(data?.cleaning?.by_building||[]).map(b=>(
                <tr key={b.building}><td className="border border-gray-300 p-2 font-bold">{b.building}</td><td className="border border-gray-300 p-2 text-center">{b.total_units}세대</td><td className="border border-gray-300 p-2">{b.remark}</td><td className="border border-gray-300 p-2 text-right font-bold">{fmt(b.billable_amount)}원</td></tr>
              ))}
              <tr className="bg-green-50 font-black"><td className="border border-gray-300 p-2">소계</td><td className="border border-gray-300 p-2 text-center">{(data?.cleaning?.by_building||[]).reduce((s,b)=>s+b.total_units,0)}세대</td><td className="border border-gray-300 p-2"></td><td className="border border-gray-300 p-2 text-right text-green-700">{fmt(data?.cleaning?.total)}원</td></tr>
            </tbody>
          </table>
        </div>
        {(data?.cleaning_extra||[]).length > 0 && (
          <div>
            <h2 className="font-bold text-lg mb-2">3. 기타 작업 내역 (별도 청구)</h2>
            <table className="w-full border-collapse border border-gray-300 text-sm">
              <thead><tr className="bg-gray-100"><th className="border border-gray-300 p-2">동</th><th className="border border-gray-300 p-2">작업내용</th><th className="border border-gray-300 p-2">날짜</th></tr></thead>
              <tbody>{(data?.cleaning_extra||[]).map((r,i)=><tr key={i}><td className="border border-gray-300 p-2 font-bold">{r.building}</td><td className="border border-gray-300 p-2">{r.label}</td><td className="border border-gray-300 p-2">{r.date}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        <div className="border-t-2 pt-4 text-right">
          <p className="text-xl font-black">합계 금액: {fmt(data?.summary?.income)}원</p>
        </div>
      </div>
    </div>
  );
}
