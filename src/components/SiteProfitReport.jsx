import React, { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';

const API = '/api';

const fmt = (n) => (n || 0).toLocaleString();

export default function SiteProfitReport({ currentSite }) {
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [enabled, setEnabled] = useState(null); // null=확인 중, true/false=확인 완료
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const siteId = currentSite?.id || 1;
  const token = localStorage.getItem('ba_token');

  const checkEnabled = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/site-config`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Site-Id': siteId },
      });
      const cfg = await res.json();
      setEnabled(cfg?.billing_profit_model_enabled === 'true');
    } catch (e) {
      setEnabled(false);
    }
  }, [siteId, token]);

  useEffect(() => { checkEnabled(); }, [checkEnabled]);

  const load = useCallback(async () => {
    if (!token || !enabled) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/analysis/site-profit?month=${month}`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Site-Id': siteId },
      });
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('현장 손익 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  }, [month, siteId, token, enabled]);

  useEffect(() => { load(); }, [load]);

  if (enabled === null) {
    return <div className="p-20 text-center text-slate-400">확인 중...</div>;
  }

  if (!enabled) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-8 bg-amber-50 border border-amber-200 rounded-xl text-center">
        <p className="text-amber-800 font-bold mb-1">이 현장은 손익 계산 기능이 꺼져 있습니다</p>
        <p className="text-sm text-amber-700">기준정보 &gt; 현장 정보 &gt; "현장 손익 계산(청구/지급 차액 방식)"에서 켤 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-500 max-w-5xl">
      <div>
        <p className="text-[10px] font-label font-bold uppercase tracking-[0.2em] text-secondary mb-1">Site Profit</p>
        <h2 className="text-3xl font-black text-primary font-headline tracking-tight">현장 손익</h2>
        <p className="text-sm text-gray-400 font-label mt-1">작업자별 (청구단가-지급단가)×공수 합계 − 기름값</p>
      </div>

      <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
        <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">조회 월</label>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold outline-none"
        />
      </div>

      {loading && !data ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="bg-blue-50 rounded-xl p-5 border border-outline-variant/20">
              <p className="text-xs font-bold text-outline uppercase">마진 합계 (청구-지급)</p>
              <p className="text-xl font-black text-blue-700 mt-1">{fmt(data.margin_total)}<span className="text-xs ml-1">원</span></p>
            </div>
            <div className="bg-red-50 rounded-xl p-5 border border-outline-variant/20">
              <p className="text-xs font-bold text-outline uppercase">기름값 ({data.attendance_days}일 × {fmt(data.fuel_cost_per_day)}원)</p>
              <p className="text-xl font-black text-red-600 mt-1">{fmt(data.fuel_total)}<span className="text-xs ml-1">원</span></p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-5 border border-outline-variant/20">
              <p className="text-xs font-bold text-outline uppercase">최종 순수익</p>
              <p className="text-xl font-black text-emerald-700 mt-1">{fmt(data.net_profit)}<span className="text-xs ml-1">원</span></p>
            </div>
            <div className="bg-slate-50 rounded-xl p-5 border border-outline-variant/20">
              <p className="text-xs font-bold text-outline uppercase">청구액 / 지급액 합계</p>
              <p className="text-sm font-bold text-slate-700 mt-1">{fmt(data.billing_total)}원 / {fmt(data.payment_total)}원</p>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden">
            <div className="bg-surface-dim/20 px-4 py-3 border-b border-outline-variant/20">
              <h3 className="font-bold text-sm text-primary">작업자별 상세</h3>
            </div>
            <table className="w-full text-xs">
              <thead><tr className="bg-surface-dim/10 border-b border-outline-variant/10">
                {['작업자', '공수', '지급단가', '청구단가', '지급액', '청구액', '차액(마진)'].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-outline font-bold uppercase text-[10px]">{h}</th>
                ))}
              </tr></thead>
              <tbody className="divide-y divide-outline-variant/10">
                {(data.workers || []).map((w) => (
                  <tr key={w.name} className="hover:bg-primary/5 transition-colors">
                    <td className="px-3 py-2 font-bold text-primary">{w.name}</td>
                    <td className="px-3 py-2">{w.total_md.toFixed(2)}</td>
                    <td className="px-3 py-2">{fmt(w.unit_price)}원</td>
                    <td className="px-3 py-2">{fmt(w.billing_rate)}원</td>
                    <td className="px-3 py-2">{fmt(w.payment_amount)}원</td>
                    <td className="px-3 py-2">{fmt(w.billing_amount)}원</td>
                    <td className={`px-3 py-2 font-bold ${w.margin >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{fmt(w.margin)}원</td>
                  </tr>
                ))}
                {(data.workers || []).length === 0 && (
                  <tr><td colSpan="7" className="py-8 text-center text-outline">이번 달 등록된 공수 기록이 없습니다.</td></tr>
                )}
              </tbody>
              {data.workers?.length > 0 && (
                <tfoot>
                  <tr className="bg-primary/5 font-black">
                    <td className="px-3 py-2 text-primary">합계</td>
                    <td className="px-3 py-2">{data.workers.reduce((s, w) => s + w.total_md, 0).toFixed(2)}</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2 text-primary">{fmt(data.payment_total)}원</td>
                    <td className="px-3 py-2 text-primary">{fmt(data.billing_total)}원</td>
                    <td className="px-3 py-2 text-primary">{fmt(data.margin_total)}원</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </>
      )}
    </div>
  );
}
