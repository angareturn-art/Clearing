import React, { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';

const API_URL = '/api';

export default function SyncManager({ currentUser }) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [deletedHistory, setDeletedHistory] = useState([]);
  const [historyError, setHistoryError] = useState(null);
  const [restoringId, setRestoringId] = useState(null);

  const fetchDeletedHistory = useCallback(async () => {
    try {
      const token = localStorage.getItem('ba_token');
      const siteId = JSON.parse(localStorage.getItem('ba_current_site') || 'null')?.id;
      const response = await fetch(`${API_URL}/schedule-events/deleted`, {
        headers: { 'Authorization': `Bearer ${token}`, 'X-Site-Id': siteId },
      });
      if (!response.ok) return;
      setDeletedHistory(await response.json());
    } catch {
      // 이력 조회 실패는 조용히 무시 (동기화 자체 기능에는 영향 없음)
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'admin') fetchDeletedHistory();
  }, [currentUser, fetchDeletedHistory]);

  const handleRestore = async (archiveId) => {
    if (!window.confirm('이 일정을 복구하시겠습니까?\n다음 "동기화 시작" 실행 시 모바일에도 반영됩니다.')) return;
    setRestoringId(archiveId);
    setHistoryError(null);
    try {
      const token = localStorage.getItem('ba_token');
      const siteId = JSON.parse(localStorage.getItem('ba_current_site') || 'null')?.id;
      const response = await fetch(`${API_URL}/schedule-events/deleted/${archiveId}/restore`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'X-Site-Id': siteId },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '복구 중 오류가 발생했습니다.');
      await fetchDeletedHistory();
    } catch (err) {
      setHistoryError(err.message);
    } finally {
      setRestoringId(null);
    }
  };

  const handleSync = async () => {
    if (!window.confirm('클라우드 동기화를 시작하시겠습니까?\n데이터 양에 따라 시간이 소요될 수 있습니다.')) return;

    setIsSyncing(true);
    setError(null);
    setResults(null);

    try {
      const token = localStorage.getItem('ba_token');
      const response = await fetch(`${API_URL}/sync/run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.status === 401) {
        localStorage.removeItem('ba_token');
        localStorage.removeItem('ba_user');
        localStorage.removeItem('ba_current_site');
        window.location.reload();
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || '알 수 없는 서버 오류가 발생했습니다.');
      }

      setResults(data.results);
      setLastSyncTime(dayjs().format('YYYY-MM-DD HH:mm:ss'));
      fetchDeletedHistory();
    } catch (err) {
      if (err instanceof TypeError && (err.message === 'Failed to fetch' || err.message.includes('fetch'))) {
        setError(
          '서버에 연결할 수 없습니다. (Failed to fetch)\n\n' +
          '▶ 해결 방법:\n' +
          '  1. 터미널에서 아래 명령 실행:\n' +
          '     cd c:\\Antigravity\\TEst\\Clearing\\server\n' +
          '     node index.js\n\n' +
          '  2. "Listening on port 5010" 메시지 확인 후 다시 시도'
        );
      } else {
        setError(err.message);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <span className="material-symbols-outlined text-6xl text-error mb-4">gpp_bad</span>
        <h2 className="text-2xl font-black text-on-surface mb-2 font-headline">접근 권한 없음</h2>
        <p className="text-on-surface-variant font-body">이 페이지는 관리자(Admin) 권한이 필요합니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl md:text-4xl font-black text-primary tracking-tight font-headline flex items-center gap-3">
          <span className="material-symbols-outlined text-4xl">cloud_sync</span>
          클라우드 데이터 동기화
        </h2>
        {lastSyncTime && (
          <div className="text-right">
            <p className="text-[10px] font-label uppercase tracking-widest text-outline mb-1">마지막 동기화</p>
            <p className="text-sm font-bold text-on-surface">{lastSyncTime}</p>
          </div>
        )}
      </div>

      <div className="bg-surface-container-lowest p-6 shadow-sm rounded-xl border border-outline-variant/20 relative overflow-hidden">
        {/* 장식용 그라디언트 배경 */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"></div>

        <div className="flex flex-col md:flex-row gap-6 items-center justify-between relative z-10">
          <div className="flex-1">
            <h3 className="text-lg font-bold text-on-surface mb-2 font-headline">안전한 데이터 백업 및 동기화</h3>
            <p className="text-sm text-on-surface-variant font-body leading-relaxed">
              현재 로컬에 저장된 모든 현장(SQLite) 데이터를 Supabase 클라우드(PostgreSQL) 서버로 
              안전하게 복사하고 동기화합니다. 기존 데이터의 수량을 비교하여 누락된 항목을 복구합니다.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-label text-warning bg-warning/10 px-3 py-1.5 rounded-md inline-flex border border-warning/20">
              <span className="material-symbols-outlined text-sm">warning</span>
              동기화 중에는 가급적 데이터 입력을 자제해 주세요.
            </div>
          </div>

          <div className="w-full md:w-auto">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className={`w-full md:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-label font-black uppercase tracking-widest shadow-lg transition-all ${
                isSyncing 
                  ? 'bg-surface-variant text-on-surface-variant cursor-not-allowed' 
                  : 'bg-gradient-to-br from-primary to-primary-container text-white hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]'
              }`}
            >
              {isSyncing ? (
                <>
                  <span className="material-symbols-outlined text-xl animate-spin">sync</span>
                  동기화 진행 중...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">cloud_upload</span>
                  동기화 시작
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 에러 메시지 패널 */}
      {error && (
        <div className="bg-error-container text-on-error-container p-6 rounded-xl border border-error/30 animate-slide-up flex items-start gap-4">
          <span className="material-symbols-outlined text-3xl text-error mt-1">error</span>
          <div className="flex-1 overflow-x-auto">
            <h4 className="font-bold text-lg mb-2 font-headline">동기화 중 오류 발생</h4>
            <pre className="text-xs font-body whitespace-pre-wrap leading-relaxed opacity-90 font-mono bg-black/10 p-4 rounded">
              {error}
            </pre>
          </div>
        </div>
      )}

      {/* 삭제된 일정 이력 (모바일 → 웹 pull-delete 시 남는 스냅샷) */}
      <div className="bg-surface-container-lowest shadow-sm rounded-xl overflow-hidden border border-outline-variant/20">
        <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant/20 flex items-center justify-between">
          <h3 className="font-bold text-sm uppercase tracking-widest text-primary flex items-center gap-2">
            <span className="material-symbols-outlined">history</span>
            삭제된 일정 이력
          </h3>
          <span className="text-xs font-bold bg-surface-container text-on-surface-variant px-2 py-1 rounded">
            {deletedHistory.length}건
          </span>
        </div>

        {historyError && (
          <div className="px-6 py-3 text-sm text-error bg-error-container/40">{historyError}</div>
        )}

        {deletedHistory.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-outline font-body">복구 가능한 삭제 이력이 없습니다.</p>
        ) : (
          <div className="divide-y divide-surface-variant/30">
            {deletedHistory.map((item) => (
              <div key={item.archive_id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-bold text-sm text-on-surface truncate">{item.title}</p>
                  <p className="text-xs text-on-surface-variant mt-0.5">
                    {item.date} · 삭제됨 {dayjs(item.deleted_at).format('YYYY-MM-DD HH:mm')} ({item.deleted_source === 'mobile' ? '모바일' : item.deleted_source})
                  </p>
                </div>
                <button
                  onClick={() => handleRestore(item.archive_id)}
                  disabled={restoringId === item.archive_id}
                  className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-sm">restore</span>
                  {restoringId === item.archive_id ? '복구 중...' : '복구'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 동기화 결과 패널 */}
      {results && (
        <div className="bg-surface-container-lowest shadow-sm rounded-xl overflow-hidden border border-outline-variant/20 animate-slide-up">
          <div className="px-6 py-4 bg-surface-container-low border-b border-outline-variant/20 flex items-center justify-between">
            <h3 className="font-bold text-sm uppercase tracking-widest text-primary flex items-center gap-2">
              <span className="material-symbols-outlined">fact_check</span>
              동기화 결과 리포트
            </h3>
            <span className="text-xs font-bold bg-success/10 text-success px-2 py-1 rounded">성공</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left whitespace-nowrap">
              <thead className="bg-surface-dim/10">
                <tr>
                  <th className="py-3 px-6 font-label text-[10px] uppercase tracking-widest text-outline">테이블 명</th>
                  <th className="py-3 px-6 font-label text-[10px] uppercase tracking-widest text-outline text-right">로컬 DB 수량</th>
                  <th className="py-3 px-6 font-label text-[10px] uppercase tracking-widest text-outline text-right">클라우드 수량</th>
                  <th className="py-3 px-6 font-label text-[10px] uppercase tracking-widest text-outline text-center">동기화 상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-variant/30">
                {results.map((row, idx) => {
                  const isError = row.status.includes('⚠️') || row.status.includes('누락');
                  const isSuccess = row.status.includes('✅') || row.status.includes('일치');
                  
                  return (
                    <tr key={idx} className="hover:bg-surface-container-low/50 transition-colors">
                      <td className="py-3 px-6 font-bold text-sm text-on-surface font-body">{row.table}</td>
                      <td className="py-3 px-6 font-mono text-sm text-on-surface-variant text-right">{row.local.toLocaleString()}건</td>
                      <td className="py-3 px-6 font-mono text-sm text-on-surface-variant text-right">{row.remote.toLocaleString()}건</td>
                      <td className="py-3 px-6 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                          isError ? 'bg-error/10 text-error' : 
                          isSuccess ? 'bg-success/10 text-success' : 
                          'bg-primary/10 text-primary'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
