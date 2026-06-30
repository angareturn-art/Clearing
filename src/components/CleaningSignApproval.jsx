import React, { useState, useCallback, useEffect } from 'react';
import dayjs from 'dayjs';

const API_URL = '/api';

export default function CleaningSignApproval({ currentSite }) {
  const [records, setRecords]       = useState([]);
  const [loading, setLoading]       = useState(false);
  const [signingIds, setSigningIds] = useState(new Set());
  const [signDate, setSignDate]     = useState(dayjs().format('YYYY-MM-DD'));
  const [filterBuilding, setFilterBuilding] = useState('');
  const [buildings, setBuildings]   = useState([]);
  const [toast, setToast]           = useState(null);

  const token  = localStorage.getItem('ba_token');
  const siteId = currentSite?.id || 1;

  const showToast = (msg) => {
    const key = Date.now();
    setToast({ msg, key });
    setTimeout(() => setToast(null), 2500);
  };

  const fetchWithSite = useCallback(async (url, options = {}) => {
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'X-Site-Id': siteId,
    };
    return fetch(url, { ...options, headers });
  }, [token, siteId]);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetchWithSite(`${API_URL}/records/cleaning/pending-sign`);
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('서명 대기 목록 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  }, [fetchWithSite]);

  const loadBuildings = useCallback(async () => {
    try {
      const res  = await fetchWithSite(`${API_URL}/buildings`);
      const data = await res.json();
      setBuildings(data || []);
    } catch (e) { /* ignore */ }
  }, [fetchWithSite]);

  useEffect(() => {
    loadRecords();
    loadBuildings();
  }, [loadRecords, loadBuildings]);

  // ── 단일 레코드 서명 처리 (내부 헬퍼) ──
  const signOne = useCallback(async (record) => {
    setSigningIds(prev => new Set([...prev, record.id]));
    try {
      const res = await fetchWithSite(`${API_URL}/records/cleaning/${record.id}/sign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sign_date: signDate }),
      });
      if (res.ok) {
        setRecords(prev => prev.filter(r => r.id !== record.id));
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      setSigningIds(prev => {
        const next = new Set(prev);
        next.delete(record.id);
        return next;
      });
    }
  }, [fetchWithSite, signDate]);

  // ── 개별 호 서명 ──
  const handleSignOne = async (record) => {
    const fl = floorLabel(record.floor);
    const ho = record.ho || '';
    if (!window.confirm(`${record.building_name} ${fl} ${ho}\n2차 청소 본청 서명을 완료 처리하시겠습니까?`)) return;
    const ok = await signOne(record);
    if (ok) showToast(`${record.building_name} ${fl} ${ho} 서명 완료`);
    else     alert('서명 처리에 실패했습니다.');
  };

  // ── 층 전체 서명 ──
  const handleSignFloor = async (buildingName, floor, floorItems) => {
    const fl = floorLabel(floor);
    if (!window.confirm(`${buildingName} ${fl} 전체 ${floorItems.length}건\n서명 완료 처리하시겠습니까?`)) return;
    let count = 0;
    for (const r of floorItems) {
      if (await signOne(r)) count++;
    }
    if (count > 0) showToast(`${buildingName} ${fl} ${count}건 서명 완료`);
  };

  // ── 동 전체 서명 ──
  const handleSignAll = async (buildingName, allItems) => {
    if (!window.confirm(`${buildingName} 전체 ${allItems.length}건\n일괄 서명 완료 처리하시겠습니까?`)) return;
    let count = 0;
    for (const r of allItems) {
      if (await signOne(r)) count++;
    }
    if (count > 0) showToast(`${buildingName} ${count}건 서명 완료`);
  };

  // ── 층 표시 헬퍼 ──
  const floorLabel = (f) => f < 0 ? `B${Math.abs(f)}층` : `${f}층`;

  // ── 필터 ──
  const filtered = filterBuilding
    ? records.filter(r => r.building_id === parseInt(filterBuilding))
    : records;

  // ── 건물 → 층 그룹화 ──
  const grouped = {};
  filtered.forEach(r => {
    const bKey = r.building_name || `동 ${r.building_id}`;
    if (!grouped[bKey]) grouped[bKey] = { building_id: r.building_id, name: bKey, floors: {} };
    const f = r.floor;
    if (!grouped[bKey].floors[f]) grouped[bKey].floors[f] = [];
    grouped[bKey].floors[f].push(r);
  });

  return (
    <div className="space-y-6">

      {/* ── 헤더 ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-primary tracking-tight font-headline">본청 서명 대기</h2>
          <p className="text-sm text-on-surface-variant mt-1">
            2차 청소 완료 후 본청 서명 필요 항목 · 총&nbsp;
            <strong className="text-primary">{records.length}건</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 bg-surface-container px-3 py-2 rounded-lg border border-outline-variant/20">
            <span className="material-symbols-outlined text-outline text-sm">event</span>
            <label className="text-xs text-outline font-bold">서명일</label>
            <input
              type="date"
              value={signDate}
              onChange={e => setSignDate(e.target.value)}
              className="bg-transparent text-on-surface font-bold text-sm border-0 focus:ring-0 p-0"
            />
          </div>
          <button
            onClick={loadRecords}
            className="flex items-center gap-1.5 px-3 py-2 bg-surface-container hover:bg-surface-container-high rounded-lg border border-outline-variant/20 text-xs font-bold text-on-surface-variant transition-colors"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            새로고침
          </button>
        </div>
      </div>

      {/* ── 건물 필터 탭 ── */}
      {buildings.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterBuilding('')}
            className={`px-4 py-2 rounded-lg text-xs font-black border transition-all ${
              !filterBuilding
                ? 'bg-primary text-white border-primary shadow-md'
                : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-high'
            }`}
          >
            전체 ({records.length})
          </button>
          {buildings
            .filter(b => records.some(r => r.building_id === b.id))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
            .map(b => (
              <button
                key={b.id}
                onClick={() => setFilterBuilding(b.id.toString())}
                className={`px-4 py-2 rounded-lg text-xs font-black border transition-all ${
                  filterBuilding === b.id.toString()
                    ? 'bg-primary text-white border-primary shadow-md'
                    : 'bg-surface-container text-on-surface-variant border-outline-variant/30 hover:bg-surface-container-high'
                }`}
              >
                {b.name} ({records.filter(r => r.building_id === b.id).length})
              </button>
            ))}
        </div>
      )}

      {/* ── 콘텐츠 ── */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-container-lowest rounded-xl p-16 text-center border border-outline-variant/20 shadow-sm">
          <span className="material-symbols-outlined text-5xl text-green-600 block mb-3">verified</span>
          <p className="text-on-surface font-bold text-lg">서명 대기 항목 없음</p>
          <p className="text-on-surface-variant text-sm mt-1">모든 2차 청소가 서명 완료됐습니다.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.values(grouped).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })).map(group => {
            const allItems    = Object.values(group.floors).flat();
            const sortedFloors = Object.keys(group.floors)
              .map(Number)
              .sort((a, b) => b - a); // 높은 층 → 낮은 층

            return (
              <div key={group.name} className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant/20 overflow-hidden">

                {/* 동 헤더 */}
                <div className="flex items-center justify-between px-5 py-3 bg-surface-container border-b border-outline-variant/20">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-sm">apartment</span>
                    <span className="font-black text-primary text-base">{group.name}</span>
                    <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-0.5 rounded-full">
                      서명 대기 {allItems.length}건
                    </span>
                  </div>
                  <button
                    onClick={() => handleSignAll(group.name, allItems)}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded-lg text-xs font-black transition-colors shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">done_all</span>
                    {group.name} 전체 서명
                  </button>
                </div>

                {/* 층별 행 */}
                <div className="divide-y divide-outline-variant/10">
                  {sortedFloors.map(floor => {
                    const floorItems = group.floors[floor]
                      .slice()
                      .sort((a, b) =>
                        String(a.ho || '').localeCompare(String(b.ho || ''), undefined, { numeric: true })
                      );

                    return (
                      <div
                        key={floor}
                        className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-container-low/40 transition-colors"
                      >
                        {/* 층 번호 */}
                        <div className="w-12 flex-shrink-0 text-right">
                          <span className="text-sm font-black text-on-surface">{floorLabel(floor)}</span>
                        </div>

                        {/* 호수 버튼들 */}
                        <div className="flex flex-wrap gap-1.5 flex-1">
                          {floorItems.map(r => (
                            <button
                              key={r.id}
                              onClick={() => handleSignOne(r)}
                              disabled={signingIds.has(r.id)}
                              className="flex flex-col items-center px-3 py-1.5 bg-lime-100 hover:bg-green-600
                                         hover:text-white disabled:opacity-50 text-green-800 rounded-lg border
                                         border-lime-300 hover:border-green-600 transition-all shadow-sm group"
                            >
                              <span className="text-xs font-black flex items-center gap-0.5">
                                {signingIds.has(r.id)
                                  ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                  : <span className="material-symbols-outlined text-green-600 group-hover:text-white" style={{ fontSize: '11px' }}>draw</span>
                                }
                                {r.ho || '-'}
                              </span>
                              <span className="text-[10px] font-bold text-green-600 group-hover:text-green-100 leading-tight">
                                {r.date ? dayjs(r.date).format('M/D') : ''}
                              </span>
                            </button>
                          ))}
                        </div>

                        {/* 층 전체 서명 */}
                        <button
                          onClick={() => handleSignFloor(group.name, floor, floorItems)}
                          className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5
                                     bg-blue-50 hover:bg-blue-600 hover:text-white text-blue-700
                                     text-xs font-black rounded-lg border border-blue-200
                                     hover:border-blue-600 transition-all shadow-sm"
                        >
                          <span className="material-symbols-outlined text-[13px]">done_all</span>
                          층 전체
                        </button>
                      </div>
                    );
                  })}
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* ── 토스트 알림 ── */}
      {toast && (
        <div
          key={toast.key}
          className="fixed bottom-6 right-6 bg-green-700 text-white text-sm font-bold px-5 py-3 rounded-xl shadow-xl flex items-center gap-2 z-50 animate-fade-in"
        >
          <span className="material-symbols-outlined text-sm">check_circle</span>
          {toast.msg}
        </div>
      )}

    </div>
  );
}
