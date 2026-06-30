import React, { useState } from 'react';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';

// 엑셀 건물별 컬럼 구조 (청소현황.xlsx 분석 결과 — 1-indexed)
const BUILDING_COLS = [
  { name: '101동', dbId: 1, startCol: 3 },
  { name: '102동', dbId: 2, startCol: 11 },
  { name: '103동', dbId: 3, startCol: 19 },
  { name: '104동', dbId: 4, startCol: 29 },
  { name: '105동', dbId: 5, startCol: 35 },
  { name: '106동', dbId: 6, startCol: 41 },
  { name: '107동', dbId: 7, startCol: 45 },
  { name: '108동', dbId: 8, startCol: 51 },
  { name: '109동', dbId: 9, startCol: 57 },
];
for (let i = 0; i < BUILDING_COLS.length; i++) {
  BUILDING_COLS[i].endCol = BUILDING_COLS[i + 1] ? BUILDING_COLS[i + 1].startCol - 1 : 64;
}

// 층 행 매핑 (엑셀 1-indexed 행번호 → floor 숫자)
const FLOOR_ROWS = [];
for (let r = 7; r <= 33; r++) {
  let floor = null;
  if (r === 32) floor = -1;      // B1F
  else if (r === 33) floor = -2; // B2F
  else floor = 32 - r;           // r=7 → 25F, r=31 → 1F
  FLOOR_ROWS.push({ rowNum: r, floor });
}

// ── ExcelJS 시트 복사 (스타일·병합 완전 보존) ──
async function copySheet(srcSheet, dstSheet) {
  srcSheet.columns.forEach((col, idx) => {
    const dc = dstSheet.getColumn(idx + 1);
    if (col.width) dc.width = col.width;
    if (col.hidden) dc.hidden = col.hidden;
  });
  srcSheet.eachRow({ includeEmpty: true }, (srcRow, rowNum) => {
    const dstRow = dstSheet.getRow(rowNum);
    if (srcRow.height) dstRow.height = srcRow.height;
    srcRow.eachCell({ includeEmpty: true }, (srcCell, colNum) => {
      const dstCell = dstRow.getCell(colNum);
      if (srcCell.value !== null && srcCell.value !== undefined) {
        try {
          dstCell.value = (srcCell.value && typeof srcCell.value === 'object')
            ? JSON.parse(JSON.stringify(srcCell.value))
            : srcCell.value;
        } catch { dstCell.value = srcCell.value; }
      }
      if (srcCell.style) dstCell.style = JSON.parse(JSON.stringify(srcCell.style));
    });
    dstRow.commit();
  });
  if (srcSheet._merges) {
    const seen = new Set();
    Object.values(srcSheet._merges).forEach(m => {
      if (!m || m.top === undefined) return;
      const key = `${m.top},${m.left},${m.bottom},${m.right}`;
      if (seen.has(key)) return;
      seen.add(key);
      try { dstSheet.mergeCells(m.top, m.left, m.bottom, m.right); } catch {}
    });
  }
}

// 이번달 하이라이트 스타일
const THIS_MONTH_FILL  = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFD966' } };
const THIS_MONTH_COLOR = { argb: 'FF7F3F00' };

export default function CleaningStatusExport({ currentSite, buildings = [] }) {
  const [generating, setGenerating] = useState(false);
  const [step, setStep]             = useState('');
  const [done, setDone]             = useState(false);
  const [targetMonth, setTargetMonth] = useState(dayjs().format('YYYY-MM'));

  const siteId = currentSite?.id || 1;
  const token  = localStorage.getItem('ba_token');

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
      // ─── 1. 세대 정보: buildings prop → houseLineMap ───────────────────
      setStep('세대 정보 구성 중...');
      // buildings prop에 houses 포함 여부 확인. 없으면 API 호출
      let allBuildings = buildings;
      if (!allBuildings.length || !allBuildings[0]?.houses) {
        allBuildings = await apiFetch('/api/master/buildings');
      }

      // (dbId, line) → [houseIds]  (line 순서 = 엑셀 유닛 순서)
      const houseLineMap = {}; // { buildingId: { line: [houseIds] } }
      for (const b of allBuildings) {
        houseLineMap[b.id] = {};
        const sorted = [...(b.houses || [])].sort((a, z) => a.line - z.line);
        for (const h of sorted) {
          if (!houseLineMap[b.id][h.line]) houseLineMap[b.id][h.line] = [];
          houseLineMap[b.id][h.line].push(h.id);
        }
      }

      // ─── 2. 청소 기록 전체 ─────────────────────────────────────────────
      setStep('청소 기록 로딩 중...');
      // /api/records/cleaning 파라미터 없이 호출 → 전체 기록 반환
      const records = await apiFetch('/api/records/cleaning');

      // (buildingId_houseId_floor_phase) → 날짜
      // 1차: 최초 날짜 (매트릭스2와 동일 — 처음 청소한 날 = 기성 청구 기준)
      // 2차: 최신 날짜 (완료일 기준)
      const dateMap = {};
      const sortedAsc  = [...records].sort((a, b) => a.date.localeCompare(b.date)); // 오름차순
      const sortedDesc = [...records].sort((a, b) => b.date.localeCompare(a.date)); // 내림차순
      for (const r of sortedAsc) {
        if (r.phase !== 1) continue;
        const k = `${r.building_id}_${r.house_id}_${r.floor}_${r.phase}`;
        if (!dateMap[k]) dateMap[k] = r.date;
      }
      for (const r of sortedDesc) {
        if (r.phase !== 2) continue;
        const k = `${r.building_id}_${r.house_id}_${r.floor}_${r.phase}`;
        if (!dateMap[k]) dateMap[k] = r.date;
      }

      function getDate(buildingId, line, floor, phase) {
        const bMap = houseLineMap[buildingId];
        if (!bMap) return null;
        const hids = bMap[line] || [];
        for (const hid of hids) {
          const d = dateMap[`${buildingId}_${hid}_${floor}_${phase}`];
          if (d) return d;
        }
        return null;
      }

      // ─── 3. 엑셀 템플릿 로드 ───────────────────────────────────────────
      setStep('청소현황 양식 로딩 중...');
      const resp = await fetch('/template_청소현황.xlsx');
      if (!resp.ok) throw new Error('템플릿 파일을 불러올 수 없습니다.');
      const buf = await resp.arrayBuffer();
      const templateWb = new ExcelJS.Workbook();
      await templateWb.xlsx.load(buf);
      const templateSheet = templateWb.getWorksheet('청소일정표');
      if (!templateSheet) throw new Error('"청소일정표" 시트를 찾을 수 없습니다.');

      // 건물별 유닛 컬럼 파악 (타입 행 = row 36)
      const typeRow = templateSheet.getRow(36);
      for (const b of BUILDING_COLS) {
        b.units = [];
        for (let c = b.startCol; c < b.endCol; c += 2) {
          const v = typeRow.getCell(c).value;
          if (v && String(v).trim()) b.units.push({ labelCol: c, dateCol: c + 1 });
        }
      }

      // ─── 4. 시트 생성 + 날짜 입력 ─────────────────────────────────────
      const outWb = new ExcelJS.Workbook();
      outWb.creator = 'Clearing';

      let total = 0;
      for (const phase of [1, 2]) {
        const sheetName = phase === 1 ? '1차 세대청소' : '2차 세대청소';
        setStep(`${sheetName} 시트 생성 중...`);

        const newSheet = outWb.addWorksheet(sheetName);
        await copySheet(templateSheet, newSheet);

        for (const b of BUILDING_COLS) {
          const bMap   = houseLineMap[b.dbId] || {};
          const lines  = Object.keys(bMap).map(Number).sort((a, z) => a - z);

          for (const fr of FLOOR_ROWS) {
            for (let ui = 0; ui < b.units.length; ui++) {
              const u    = b.units[ui];
              const line = lines[ui];
              if (!line) continue;

              // 원본 라벨 셀이 비어있으면 해당 층에 세대 없음
              if (!templateSheet.getCell(fr.rowNum, u.labelCol).value) continue;

              const date = getDate(b.dbId, line, fr.floor, phase);
              if (!date) continue;

              const [, m, d] = date.split('-');
              const isThisMonth = date.startsWith(targetMonth);

              const cell = newSheet.getCell(fr.rowNum, u.dateCol);
              const origStyle = JSON.parse(JSON.stringify(cell.style || {}));
              cell.value = `${parseInt(m)}/${parseInt(d)}`;
              if (isThisMonth) {
                cell.style = {
                  ...origStyle,
                  fill: THIS_MONTH_FILL,
                  font: { ...(origStyle.font || {}), size: 10, bold: true, color: THIS_MONTH_COLOR },
                };
              } else {
                cell.style = {
                  ...origStyle,
                  font: { ...(origStyle.font || {}), size: 10 },
                };
              }
              total++;
            }
          }
        }
      }

      // ─── 5. 다운로드 ───────────────────────────────────────────────────
      setStep('파일 저장 중...');
      const outBuf = await outWb.xlsx.writeBuffer();
      const blob   = new Blob([outBuf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `청소현황_날짜_${targetMonth}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setStep(`완료 — ${total}개 셀 입력`);
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
          <span className="material-icons text-primary text-2xl">file_download</span>
          <h2 className="text-xl font-bold text-on-surface">청소현황 엑셀 출력</h2>
        </div>
        <p className="text-sm text-outline mb-5">
          Supabase 청소 기록을 청소현황 양식에 입력하여 다운로드합니다.
          기성신청 기준 월의 날짜는{' '}
          <span className="font-bold text-amber-700 bg-yellow-100 px-1 rounded">노란 배경</span>
          으로 강조됩니다.
        </p>

        {/* 기준 월 선택 */}
        <div className="mb-5">
          <label className="block text-xs font-bold text-outline uppercase tracking-wide mb-1.5">
            기성신청 기준 월
          </label>
          <input
            type="month"
            value={targetMonth}
            onChange={e => { setTargetMonth(e.target.value); setDone(false); }}
            className="border border-outline-variant rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-surface"
          />
          <p className="text-xs text-outline mt-1">선택한 달에 청소된 셀만 노란 배경으로 강조됩니다.</p>
        </div>

        {/* 출력 내용 안내 */}
        <div className="bg-surface-variant rounded-xl p-3 mb-5 text-xs text-on-surface-variant space-y-1">
          <div className="font-bold text-on-surface mb-0.5">출력 내용</div>
          <div className="flex gap-2">
            <span className="material-icons text-sm text-blue-600">table_chart</span>
            <span><b>1차 세대청소</b> 시트 — 1차 청소 완료 날짜</span>
          </div>
          <div className="flex gap-2">
            <span className="material-icons text-sm text-green-600">table_chart</span>
            <span><b>2차 세대청소</b> 시트 — 2차 청소 완료 날짜</span>
          </div>
          <div className="flex gap-2 mt-1 pt-1 border-t border-outline-variant/30">
            <span className="material-icons text-sm text-outline">check_circle</span>
            <span>청소현황.xlsx 원본 서식(색상·병합셀·폰트) 그대로 유지</span>
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

        {/* 색상 범례 */}
        <div className="mt-5 pt-4 border-t border-outline-variant/20">
          <div className="text-xs font-bold text-outline mb-2">색상 범례</div>
          <div className="flex gap-5 text-xs text-outline">
            <div className="flex items-center gap-1.5">
              <div className="w-10 h-5 rounded border border-yellow-400 bg-yellow-200 flex items-center justify-center text-[10px] font-bold text-amber-800">5/21</div>
              <span>기준 월 작업</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-10 h-5 rounded border border-gray-200 bg-white flex items-center justify-center text-[10px] text-gray-500">4/13</div>
              <span>이전 달 작업</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
