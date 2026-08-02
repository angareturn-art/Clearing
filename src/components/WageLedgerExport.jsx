import React, { useState } from 'react';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';

const API_URL = '/api';

// 이름(A열) 있는 일자별 출근 데이터 열: E(5) ~ AI(35) = 1일 ~ 31일
const DAY_START_COL = 5;
const DAY_END_COL = 35;
const COL_ATTENDANCE = 36; // 출근
const COL_UNIT_PRICE = 37; // 단가
const COL_AMOUNT = 38;     // 금액
const WEEKDAY_KR = ['일', '월', '화', '수', '목', '금', '토'];

export default function WageLedgerExport({ currentSite }) {
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState('');
  const [done, setDone] = useState(false);
  const [targetMonth, setTargetMonth] = useState(dayjs().format('YYYY-MM'));

  const siteId = currentSite?.id || 1;
  const token = localStorage.getItem('ba_token');

  async function apiFetch(url) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'X-Site-Id': String(siteId) },
    });
    if (!res.ok) throw new Error(`API 오류 ${res.status}: ${url}`);
    return res.json();
  }

  async function generate() {
    setGenerating(true);
    setDone(false);
    try {
      // ─── 1. 근태/단가/금액 데이터 ──────────────────────────────────────
      setStep('출근·단가·금액 계산 중...');
      const rows = await apiFetch(`${API_URL}/closing/monthly?month=${targetMonth}&price_mode=payment&include_foreman=true`);
      const byName = {};
      rows.forEach(r => { byName[r.name] = r; });

      // ─── 2. 템플릿 로드 (새 시트로 복사하지 않고 이 워크북을 그대로 결과물로 사용
      //        — 수식·페이지 나누기 미리보기·인쇄 설정 등 건드리지 않은 나머지가
      //        전부 원본 그대로 보존된다) ────────────────────────────────
      setStep('노임 지급 대장 양식 로딩 중...');
      const resp = await fetch('/template_노임지급대장.xlsx');
      if (!resp.ok) throw new Error('템플릿 파일을 불러올 수 없습니다.');
      const buf = await resp.arrayBuffer();
      const outWb = new ExcelJS.Workbook();
      await outWb.xlsx.load(buf);
      const sheet = outWb.getWorksheet('세대청소');
      if (!sheet) throw new Error('"세대청소" 시트를 찾을 수 없습니다.');

      // ─── 3. 헤더(제목·일자·요일) 재생성 ──────────────────────────────
      setStep('날짜 헤더 갱신 중...');
      const m = dayjs(targetMonth);
      const yy = m.format('YY');
      const mm = m.month() + 1;
      const daysInMonth = m.daysInMonth();

      sheet.getCell(1, 1).value = `${yy}년 ${mm}월 노임 지급 대장 ( 우민이엔지 )`;
      sheet.getCell(4, DAY_START_COL).value = `${m.format('YYYY년 M월')}분`;

      for (let d = 1; d <= DAY_END_COL - DAY_START_COL + 1; d++) {
        const col = DAY_START_COL + d - 1;
        if (d <= daysInMonth) {
          const date = m.date(d);
          sheet.getCell(5, col).value = date.format('YYYY-MM-DD');
          sheet.getCell(6, col).value = WEEKDAY_KR[date.day()];
        } else {
          sheet.getCell(5, col).value = null;
          sheet.getCell(6, col).value = null;
        }
      }

      // ─── 4. 이름별 출근/단가/금액 채우기 ──────────────────────────────
      setStep('근로자별 데이터 채우는 중...');
      let matched = 0;
      let unmatched = 0;
      sheet.eachRow({ includeEmpty: true }, (row, rowNum) => {
        if (rowNum < 7) return; // 헤더 영역 제외
        const name = row.getCell(1).value;
        if (!name || typeof name !== 'string' || name === '합법' || name === '불법' || name === '계') return;

        const data = byName[name];
        if (data) matched++; else unmatched++;

        for (let d = 1; d <= daysInMonth; d++) {
          const col = DAY_START_COL + d - 1;
          const md = data?.daily[String(d)];
          row.getCell(col).value = md || null;
        }
        for (let col = DAY_START_COL + daysInMonth; col <= DAY_END_COL; col++) {
          row.getCell(col).value = null;
        }
        // 출근/금액은 이번 달 근태가 없으면 0, 단가는 매칭 안 될 경우 템플릿에 남아있던
        // 기존 값(문자열이 아닌 plain number)을 유지한다.
        // 매칭 여부와 무관하게 항상 plain value로 덮어써야 한다 — 그렇지 않으면 일부
        // 행만 수식(shared formula) 상태로 남아 ExcelJS 저장 시 그룹이 깨진다.
        const existingUnitPrice = row.getCell(COL_UNIT_PRICE).value;
        row.getCell(COL_ATTENDANCE).value = data?.total_md || 0;
        row.getCell(COL_UNIT_PRICE).value = data?.unit_price ?? (typeof existingUnitPrice === 'number' ? existingUnitPrice : 0);
        row.getCell(COL_AMOUNT).value = data?.total_amount || 0;
        row.commit();
      });

      // ─── 5. 다운로드 ──────────────────────────────────────────────────
      setStep('파일 저장 중...');
      const outBuf = await outWb.xlsx.writeBuffer();
      const blob = new Blob([outBuf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      // 같은 파일명으로 저장하면 이전 생성 결과를 덮어쓰게 되므로, 생성 시각을
      // 파일명에 포함해 매번 새 버전으로 남긴다 (기존 파일은 건드리지 않음).
      const versionStamp = dayjs().format('YYYYMMDD_HHmmss');
      const a = document.createElement('a');
      a.href = url;
      a.download = `청소_출력일보_${targetMonth}_${versionStamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStep(`완료 — ${matched}명 반영${unmatched ? ` (미등록 ${unmatched}명은 기존 값 유지)` : ''}`);
      setDone(true);
    } catch (err) {
      console.error(err);
      setStep(`오류: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="p-4 max-w-xl mx-auto">
      <div className="bg-surface rounded-2xl shadow-md p-6">
        {/* 헤더 */}
        <div className="flex items-center gap-2 mb-1">
          <span className="material-icons text-primary text-2xl">payments</span>
          <h2 className="text-xl font-bold text-on-surface">노임 지급대장 엑셀 출력</h2>
        </div>
        <p className="text-sm text-outline mb-5">
          근태 기록과 단가 이력을 바탕으로 근로자별 출근·단가·금액을 계산해 노임 지급 대장 양식에 채웁니다.
        </p>

        {/* 대상 월 선택 */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-outline uppercase tracking-wide mb-1.5">
            대상 월
          </label>
          <input
            type="month"
            value={targetMonth}
            onChange={e => { setTargetMonth(e.target.value); setDone(false); }}
            className="border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
          />
        </div>

        {/* 출력 내용 안내 */}
        <div className="bg-surface-variant rounded-xl p-3 mb-5 text-xs text-on-surface-variant space-y-1">
          <div className="font-bold text-on-surface mb-0.5">출력 내용</div>
          <div className="flex gap-2">
            <span className="material-icons text-sm text-blue-600">event_available</span>
            <span>일자별 출근(공수)·출근 합계·단가·금액은 자동 계산되어 채워집니다</span>
          </div>
          <div className="flex gap-2 mt-1 pt-1 border-t border-outline-variant/30">
            <span className="material-icons text-sm text-amber-600">edit_note</span>
            <span>주민번호·주소·합법/불법 구분은 앱에 없는 정보라 자동 반영되지 않습니다 — 필요 시 다운로드한 파일에서 직접 입력해 주세요</span>
          </div>
          <div className="flex gap-2 mt-1 pt-1 border-t border-outline-variant/30">
            <span className="material-icons text-sm text-outline">check_circle</span>
            <span>양식에 없는 신규 근로자는 이번 출력에 포함되지 않습니다(양식에 행 추가 필요)</span>
          </div>
        </div>

        {/* 생성 버튼 */}
        <button
          onClick={generate}
          disabled={generating}
          className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all
            ${generating
              ? 'bg-surface-variant text-outline cursor-not-allowed'
              : 'bg-primary text-on-primary hover:brightness-110 active:scale-95 shadow'}`}
        >
          {generating ? (
            <>
              <span className="material-icons text-base" style={{ animation: 'spin 1s linear infinite' }}>autorenew</span>
              처리 중...
            </>
          ) : (
            <>
              <span className="material-icons text-base">download</span>
              엑셀 생성 및 다운로드
            </>
          )}
        </button>

        {/* 진행 상태 */}
        {step && (
          <div className={`mt-3 rounded-xl p-3 text-sm font-medium text-center transition-all
            ${done
              ? 'bg-green-50 text-green-800 border border-green-200'
              : generating
              ? 'bg-blue-50 text-blue-800 border border-blue-200'
              : step.startsWith('오류')
              ? 'bg-red-50 text-red-800 border border-red-200'
              : 'bg-surface-variant text-on-surface-variant'}`}>
            {done && <span className="material-icons text-sm align-bottom mr-1 text-green-600">check_circle</span>}
            {step}
          </div>
        )}
      </div>
    </div>
  );
}
