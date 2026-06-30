import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dayjs from 'dayjs';

const API = '/api';

const fmt = (n) => (n || 0).toLocaleString();

const floorLabel = f => f < 0 ? `지하${Math.abs(f)}층` : `${f}층`;
const floorF     = f => f < 0 ? `B${Math.abs(f)}F` : `${f}F`;

export default function MonthlyAnalysis2({ currentSite, buildings = [] }) {
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [oilingPrice, setOilingPrice] = useState(74000);
  const [cleaningPrice, setCleaningPrice] = useState(74000);
  const [periodMode, setPeriodMode] = useState('split');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [rightTab, setRightTab] = useState('oiling');
  const [closedMonths, setClosedMonths] = useState(new Set());
  const [closingInProgress, setClosingInProgress] = useState(false);

  const siteId = currentSite?.id || 1;
  const token = localStorage.getItem('ba_token');

  const isClosed = closedMonths.has(month);

  const fetchClosedMonths = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/monthly-closings`, {
        headers: { Authorization: `Bearer ${token}`, 'X-Site-Id': siteId },
      });
      if (res.ok) {
        const rows = await res.json();
        setClosedMonths(new Set(rows.map(r => r.month)));
      }
    } catch (e) { /* ignore */ }
  }, [siteId, token]);

  useEffect(() => { fetchClosedMonths(); }, [fetchClosedMonths]);

  // 마감 실행 (confirm 없이 순수 API 호출)
  const performClose = async () => {
    setClosingInProgress(true);
    try {
      const res = await fetch(`${API}/monthly-closings`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'X-Site-Id': siteId, 'Content-Type': 'application/json' },
        body: JSON.stringify({ month }),
      });
      if (res.ok) await fetchClosedMonths();
      else alert('마감 처리에 실패했습니다.');
    } catch (e) { console.error(e); }
    setClosingInProgress(false);
  };

  // 마감 버튼 클릭 (confirm 포함)
  const doClose = async () => {
    if (!window.confirm(`${month} 을 마감하시겠습니까?\n마감 후 해당 월 데이터는 수정·삭제가 잠깁니다.`)) return;
    await performClose();
  };

  // 마감 취소
  const doUnclose = async () => {
    if (!window.confirm(`${month} 마감을 취소하시겠습니까?\n취소 후 데이터를 수정할 수 있습니다.`)) return;
    setClosingInProgress(true);
    try {
      const res = await fetch(`${API}/monthly-closings/${month}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}`, 'X-Site-Id': siteId },
      });
      if (res.ok) await fetchClosedMonths();
      else alert('마감 취소에 실패했습니다.');
    } catch (e) { console.error(e); }
    setClosingInProgress(false);
  };

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}`, 'X-Site-Id': siteId };
      const p = new URLSearchParams({ month, oiling_price: oilingPrice, cleaning_price: cleaningPrice, period_mode: periodMode });
      const res = await fetch(`${API}/analysis/monthly?${p}`, { headers });
      const json = await res.json();
      setData(json);
    } catch (e) {
      console.error('Data Loading Error:', e);
    } finally {
      setLoading(false);
    }
  }, [month, oilingPrice, cleaningPrice, periodMode, siteId, token]);

  useEffect(() => { load(); }, [load]);

  const oilingDetails = data?.oiling?.details || [];
  const cleaningDetails = data?.cleaning?.details || [];
  const filteredOiling = selectedBuilding ? oilingDetails.filter(r => r.building === selectedBuilding) : oilingDetails;
  const filteredCleaning = selectedBuilding ? cleaningDetails.filter(r => r.building === selectedBuilding) : cleaningDetails;
  const filteredExtra = (data?.cleaning_extra || []).filter(r => !selectedBuilding || r.building === selectedBuilding);

  // 1차/2차 동별 합계 (cleaningDetails에서 직접 집계)
  const cleaningPhase1ByBuilding = useMemo(() => {
    const map = {};
    cleaningDetails.forEach(r => {
      if (r.phase !== 1) return;
      if (!map[r.building]) map[r.building] = { building: r.building, total_units: 0, billable_amount: 0, floors: [] };
      map[r.building].floors.push({ floor: r.floor, total: r.total, is_billable: r.is_billable });
      if (r.is_billable) {
        map[r.building].total_units += r.total;
        map[r.building].billable_amount += r.amount;
      }
    });
    return Object.values(map).sort((a, b) => {
      const na = parseInt(a.building.replace(/[^0-9]/g, '')) || 0;
      const nb = parseInt(b.building.replace(/[^0-9]/g, '')) || 0;
      return na - nb;
    }).map(b => ({
      ...b,
      remark: b.floors.sort((a, bv) => a.floor - bv.floor).map(f => `${floorLabel(f.floor)}(${f.total}세대)${f.is_billable ? '' : '(제외)'}`).join(', ')
    }));
  }, [cleaningDetails]);

  const cleaningPhase2ByBuilding = useMemo(() => {
    const map = {};
    cleaningDetails.forEach(r => {
      if (r.phase !== 2) return;
      if (!map[r.building]) map[r.building] = { building: r.building, total_units: 0, billable_amount: 0, floors: [] };
      map[r.building].floors.push({ floor: r.floor, total: r.total, is_billable: r.is_billable });
      if (r.is_billable) {
        map[r.building].total_units += r.total;
        map[r.building].billable_amount += r.amount;
      }
    });
    return Object.values(map).sort((a, b) => {
      const na = parseInt(a.building.replace(/[^0-9]/g, '')) || 0;
      const nb = parseInt(b.building.replace(/[^0-9]/g, '')) || 0;
      return na - nb;
    }).map(b => ({
      ...b,
      remark: b.floors.sort((a, bv) => a.floor - bv.floor).map(f => `${floorLabel(f.floor)}(${f.total}세대)${f.is_billable ? '' : '(제외)'}`).join(', ')
    }));
  }, [cleaningDetails]);

  const [excelGenerating, setExcelGenerating] = useState(false);

  const handlePrint = () => window.print();

  const handleExcelDownload = async () => {
    if (!data || excelGenerating) return;
    setExcelGenerating(true);
    try {
      const { default: ExcelJS } = await import('exceljs');
      const [yr, mo] = month.split('-');
      const monthNum = parseInt(mo);
      const monthKo = `${yr}년 ${monthNum}월`;
      const periodLabel = periodMode === 'split' ? ' (도급기간: 16일~말일)' : '';

      // 집계값
      const oilingBlds  = data.oiling?.by_building || [];
      const oilingTotal = data.oiling?.total || 0;
      const oilingUnits = oilingBlds.reduce((s, b) => s + b.total_units, 0);
      const ph1Blds = cleaningPhase1ByBuilding;
      const ph2Blds = cleaningPhase2ByBuilding;
      const ph1Total = ph1Blds.reduce((s, b) => s + b.billable_amount, 0);
      const ph2Total = ph2Blds.reduce((s, b) => s + b.billable_amount, 0);
      const ph1Units = ph1Blds.reduce((s, b) => s + b.total_units, 0);
      const ph2Units = ph2Blds.reduce((s, b) => s + b.total_units, 0);
      const extras  = data.cleaning_extra || [];
      const workers = data.expense?.workers || [];
      const laborTotal  = data.expense?.total || 0;
      const grandTotal  = oilingTotal + ph1Total + ph2Total;

      // 동별 오일링 층 상세 (is_billable 기준, 날짜 포함)
      const oilFloorsByBld = {};
      (data.oiling?.details || []).forEach(rec => {
        if (!rec.is_billable) return;
        if (!oilFloorsByBld[rec.building]) oilFloorsByBld[rec.building] = [];
        oilFloorsByBld[rec.building].push(rec);
      });

      // 동별 청소 층 상세 (is_billable 기준, 날짜 있으면 포함)
      const cleanFloorsByBld = { 1: {}, 2: {} };
      (data.cleaning?.details || []).forEach(rec => {
        if (!rec.is_billable) return;
        const ph = rec.phase;
        if (!cleanFloorsByBld[ph]) cleanFloorsByBld[ph] = {};
        if (!cleanFloorsByBld[ph][rec.building]) cleanFloorsByBld[ph][rec.building] = [];
        cleanFloorsByBld[ph][rec.building].push(rec);
      });

      // 구간/층수/상세문자열 계산
      const computeDetail = (floors, unitKey) => {
        if (!floors.length) return { 구간: '', 층수: '', detail: '' };
        const sorted = [...floors].sort((a, b) => a.floor - b.floor);
        const minF = sorted[0].floor;
        const maxF = sorted[sorted.length - 1].floor;
        return {
          구간: `${floorF(minF)}~${floorF(maxF)}`,
          층수: `${sorted.length}층`,
          detail: sorted.map(f => {
            const [, fm, fd] = (f.date || '').split('-');
            const dateStr = fm && fd ? `/${parseInt(fm)}/${parseInt(fd)}` : '';
            return `${floorLabel(f.floor)}(${f[unitKey]}세대${dateStr})`;
          }).join('\n'),
        };
      };

      // 청소 원시 기록 (날짜별) ─ 청소 시트용
      const cleanRawRows = { 1: [], 2: [] };
      try {
        const hdrs = { Authorization: `Bearer ${token}`, 'X-Site-Id': String(siteId) };
        const rawRecs = await fetch('/api/records/cleaning', { headers: hdrs }).then(r => r.json());
        const bldIdToName = {};
        (buildings || []).forEach(b => { bldIdToName[b.id] = b.name; });
        const billableSet = new Set();
        (data.cleaning?.details || []).forEach(r => {
          if (r.is_billable) billableSet.add(`${r.building}_${r.floor}_${r.phase}`);
        });
        const grouped = {};
        const floorSeenHouses = {};
        (Array.isArray(rawRecs) ? rawRecs : [])
          .filter(r => r.date?.startsWith(month))
          .forEach(r => {
            const bName = bldIdToName[r.building_id] || String(r.building_id);
            const key = `${r.phase}_${r.date}_${bName}_${r.floor}`;
            const floorKey = `${r.phase}_${bName}_${r.floor}`;
            if (!grouped[key]) grouped[key] = { date: r.date, building: bName, floor: r.floor, phase: r.phase, count: 0 };
            if (!floorSeenHouses[floorKey]) floorSeenHouses[floorKey] = new Set();
            // 같은 층+차수에서 동일 house_id 중복 기록은 건너뜀 (분석 API의 SET 방식과 동일)
            const hid = r.house_id;
            if (!hid || !floorSeenHouses[floorKey].has(hid)) {
              grouped[key].count++;
              if (hid) floorSeenHouses[floorKey].add(hid);
            }
          });
        Object.values(grouped).forEach(g => {
          const ph = g.phase;
          if (ph !== 1 && ph !== 2) return;
          const isBillable = billableSet.has(`${g.building}_${g.floor}_${g.phase}`);
          cleanRawRows[ph].push({ ...g, amount: isBillable ? g.count * cleaningPrice : 0 });
        });
        const sortByDate = arr => arr.sort((a, b) => {
          if (a.date !== b.date) return a.date.localeCompare(b.date);
          const an = parseInt(a.building.replace(/[^0-9]/g, '')) || 0;
          const bn = parseInt(b.building.replace(/[^0-9]/g, '')) || 0;
          return an !== bn ? an - bn : a.floor - b.floor;
        });
        sortByDate(cleanRawRows[1]);
        sortByDate(cleanRawRows[2]);
      } catch(e) {
        console.warn('청소 원시 기록 로드 실패, 집계 데이터로 대체:', e.message);
      }

      // ── 스타일 상수 ─────────────────────────────────────────────────
      const BORDER = { top:{style:'thin'}, left:{style:'thin'}, bottom:{style:'thin'}, right:{style:'thin'} };
      const FONT   = { name:'맑은 고딕', size:12 };
      const FILL_H = { type:'pattern', pattern:'solid', fgColor:{argb:'FFEBF1DE'} };
      const FILL_T = { type:'pattern', pattern:'solid', fgColor:{argb:'FFDCE6F1'} };
      const MID    = { vertical:'middle' };

      const cell = (ws, r, c, val, {bold=false, fill=null, align=null, numFmt=null}={}) => {
        const cl = ws.getCell(r, c);
        cl.value = val;
        cl.border = BORDER;
        cl.font   = { ...FONT, bold };
        if (fill)   cl.fill      = fill;
        if (align)  cl.alignment = align;
        if (numFmt) { cl.numFmt = '#,##0'; cl.alignment = { horizontal:'right', vertical:'middle' }; }
        return cl;
      };

      const wb = new ExcelJS.Workbook();

      // ── Sheet 1: {월}정산 ─────────────────────────────────────────────
      // A,B열: 여백(테두리 없음)  C~H열: 데이터
      const ws1 = wb.addWorksheet(`${monthNum}월정산`);
      const NCOLS = 8;
      ws1.columns = [
        {width:5.5},{width:4},{width:8},{width:14},{width:12},{width:8},{width:50},{width:14}
      ];

      let r = 1;
      // 빈 행 = 완전히 빈칸 (테두리 없음)
      const blank = () => { r++; };

      // 제목 (C~H 병합, A·B 비워둠)
      ws1.mergeCells(r,3,r,NCOLS);
      const t1 = ws1.getCell(r,3);
      t1.value = `[기본 현장] ${monthKo} 정산 내역서`;
      t1.border = BORDER; t1.font = {...FONT,bold:true};
      t1.alignment = {horizontal:'center',vertical:'middle'};
      for(let c=4;c<=NCOLS;c++) ws1.getCell(r,c).border=BORDER;
      r++;

      // 기간 (B열만, 테두리 없음)
      const p1 = ws1.getCell(r,2);
      p1.value = `${monthKo}${periodLabel}`;
      p1.font = FONT; p1.alignment = MID;
      r++;
      blank();

      // 섹션 헬퍼
      // - 섹션 제목: B열만 텍스트, 테두리 없음
      // - 헤더·데이터·소계: C열부터 headers.length/rd.length 만큼만 테두리
      // - i===4(G열)에 wrapText, 마지막 숫자 열에 numFmt
      const section = (num, title, headers, rows, subtotal) => {
        const sc = ws1.getCell(r,2);
        sc.value = `${num}. ${title}`;
        sc.font = {...FONT,bold:true}; sc.alignment = MID;
        r++;

        headers.forEach((h,i)=>{
          cell(ws1,r,i+3, h, {fill:FILL_H, align:{horizontal:'center',vertical:'middle'}});
        });
        r++;

        rows.forEach(rd=>{
          rd.forEach((v,i)=>{
            const isLast = i===rd.length-1 && typeof v==='number';
            const isWrap = i===4;
            const al = isWrap ? {wrapText:true,vertical:'middle'}
                     : isLast ? {horizontal:'right',vertical:'middle'}
                     : MID;
            const cl = cell(ws1,r,i+3,v,{align:al});
            if(isLast) cl.numFmt='#,##0';
          });
          r++;
        });

        if(subtotal){
          subtotal.forEach((v,i)=>{
            const isLast = i===subtotal.length-1 && typeof v==='number';
            const al = isLast ? {horizontal:'right',vertical:'middle'} : MID;
            const cl = cell(ws1,r,i+3,v,{bold:true,align:al});
            if(isLast) cl.numFmt='#,##0';
          });
          r++;
        }
        blank();
      };

      section(1,'갱폼 박리제 도급 내역',
        ['동','세대','구간','층수','작업층/세대수/일자','금액'],
        oilingBlds.map(b => {
          const {구간, 층수, detail} = computeDetail(oilFloorsByBld[b.building]||[], 'units');
          return [b.building, `${b.total_units}세대`, 구간, 층수, detail||b.remark||'', b.billable_amount];
        }),
        ['소계',`${oilingUnits}세대`,'','','',oilingTotal]
      );
      section(2,'1차 세대청소 도급 내역',
        ['동','세대','구간','층수','작업층/세대수/일자','금액'],
        ph1Blds.map(b => {
          const {구간, 층수, detail} = computeDetail(cleanFloorsByBld[1]?.[b.building]||[], 'total');
          return [b.building, `${b.total_units}세대`, 구간, 층수, detail||b.remark||'', b.billable_amount];
        }),
        ['소계',`${ph1Units}세대`,'','','',ph1Total]
      );
      section(3,'2차 세대청소 도급 내역',
        ['동','세대','구간','층수','작업층/세대수/일자','금액'],
        ph2Blds.map(b => {
          const {구간, 층수, detail} = computeDetail(cleanFloorsByBld[2]?.[b.building]||[], 'total');
          return [b.building, `${b.total_units}세대`, 구간, 층수, detail||b.remark||'', b.billable_amount];
        }),
        ['소계',`${ph2Units}세대`,'','','',ph2Total]
      );

      let secNum = 4;
      if(extras.length > 0){
        section(secNum++,'기타 작업 내역 (별도 청구)',
          ['동','작업 내용','비고(날짜)',''],
          extras.map(e=>[e.building,e.label,e.date,'']),
          null
        );
      }
      if(workers.length > 0){
        section(secNum,'인건비',
          ['작업자','공수(MD)','단가','','','금액'],
          workers.map(w=>[w.name, parseFloat((w.total_md||0).toFixed(2)), w.unit_price||0, '','', w.amount||0]),
          ['합계','','','','',laborTotal]
        );
      }

      // 합계 금액 (C~G 병합, H에 금액, A·B 비워둠)
      ws1.mergeCells(r,3,r,NCOLS-1);
      const totLabel = ws1.getCell(r,3);
      totLabel.value = '합계 금액'; totLabel.border = BORDER;
      totLabel.font = {...FONT,bold:true}; totLabel.fill = FILL_T;
      totLabel.alignment = {horizontal:'center',vertical:'middle'};
      for(let c=4;c<=NCOLS-1;c++) ws1.getCell(r,c).border=BORDER;
      const totCell = ws1.getCell(r,NCOLS);
      totCell.value = grandTotal; totCell.border = BORDER;
      totCell.font = {...FONT,bold:true}; totCell.fill = FILL_T;
      totCell.numFmt = '#,##0'; totCell.alignment = {horizontal:'right',vertical:'middle'};

      // ── Sheet 2: 인건비 ─────────────────────────────────────────────────
      if(workers.length > 0){
        const ws2 = wb.addWorksheet('인건비');
        ws2.columns=[{width:6},{width:16},{width:12},{width:14},{width:14}];
        let r2=1;
        [1,2,3,4,5].forEach(c=>cell(ws2,r2,c,c===1?`${monthNum}월 인건비`:null,c===1?{bold:true,align:MID}:{align:MID}));
        r2++;
        ['순번','작업자 이름','총 공수(MD)','적용 단가','총 노무비'].forEach((h,i)=>
          cell(ws2,r2,i+1,h,{fill:FILL_H,align:{horizontal:'center',vertical:'middle'}})
        );
        r2++;
        workers.forEach((w,idx)=>{
          cell(ws2,r2,1,idx+1,{align:{horizontal:'center',vertical:'middle'}});
          cell(ws2,r2,2,w.name,{align:MID});
          cell(ws2,r2,3,parseFloat((w.total_md||0).toFixed(2)),{align:{horizontal:'center',vertical:'middle'}});
          const u=cell(ws2,r2,4,w.unit_price||0,{align:MID}); u.numFmt='#,##0'; u.alignment={horizontal:'right',vertical:'middle'};
          const a=cell(ws2,r2,5,w.amount||0,{align:MID}); a.numFmt='#,##0'; a.alignment={horizontal:'right',vertical:'middle'};
          r2++;
        });
        cell(ws2,r2,1,null,{align:MID}); cell(ws2,r2,2,'합계',{bold:true,align:MID});
        cell(ws2,r2,3,null,{align:MID}); cell(ws2,r2,4,null,{align:MID});
        const lt=cell(ws2,r2,5,laborTotal,{bold:true,align:MID}); lt.numFmt='#,##0'; lt.alignment={horizontal:'right',vertical:'middle'};
      }

      // ── Sheet 3: 청소 (갱폼/1차/2차 섹션, 날짜별) ──────────────────────
      const ws3 = wb.addWorksheet('청소');
      ws3.columns=[{width:6},{width:12},{width:10},{width:8},{width:8},{width:14}];
      let r3=1;

      // 제목
      ws3.mergeCells(r3,1,r3,6);
      cell(ws3,r3,1,`${monthNum}월 세대청소 작업 내역`,{bold:true,align:{horizontal:'center',vertical:'middle'}});
      [2,3,4,5,6].forEach(c=>{ws3.getCell(r3,c).border=BORDER;});
      r3++;

      // ws3 섹션 헬퍼: 행 = [날짜, 동, 층, 세대수, 금액]
      const ws3Section = (title, rows) => {
        ws3.mergeCells(r3,1,r3,6);
        cell(ws3,r3,1,title,{bold:true,fill:FILL_H,align:{horizontal:'center',vertical:'middle'}});
        [2,3,4,5,6].forEach(c=>{ws3.getCell(r3,c).border=BORDER;});
        r3++;
        ['순번','날짜','동','층','세대수','금액'].forEach((h,i)=>
          cell(ws3,r3,i+1,h,{fill:FILL_H,align:{horizontal:'center',vertical:'middle'}})
        );
        r3++;
        if(!rows.length){
          ws3.mergeCells(r3,1,r3,6);
          cell(ws3,r3,1,'기록 없음',{align:{horizontal:'center',vertical:'middle'}});
          [2,3,4,5,6].forEach(c=>{ws3.getCell(r3,c).border=BORDER;});
          r3++; return;
        }
        let subUnits=0, subAmt=0;
        rows.forEach(([dateStr, building, floor, units, amount], idx)=>{
          cell(ws3,r3,1,idx+1,{align:{horizontal:'center',vertical:'middle'}});
          cell(ws3,r3,2,dateStr,{align:{horizontal:'center',vertical:'middle'}});
          cell(ws3,r3,3,building,{align:MID});
          cell(ws3,r3,4,floorLabel(floor),{align:{horizontal:'center',vertical:'middle'}});
          cell(ws3,r3,5,units,{align:{horizontal:'center',vertical:'middle'}});
          const a=cell(ws3,r3,6,amount,{align:MID}); a.numFmt='#,##0'; a.alignment={horizontal:'right',vertical:'middle'};
          subUnits+=units; subAmt+=amount;
          r3++;
        });
        // 소계
        ws3.mergeCells(r3,1,r3,4);
        cell(ws3,r3,1,'소계',{bold:true,fill:FILL_T,align:{horizontal:'center',vertical:'middle'}});
        [2,3,4].forEach(c=>{ws3.getCell(r3,c).border=BORDER;});
        cell(ws3,r3,5,subUnits,{bold:true,align:{horizontal:'center',vertical:'middle'}});
        const st=cell(ws3,r3,6,subAmt,{bold:true,fill:FILL_T,align:MID}); st.numFmt='#,##0'; st.alignment={horizontal:'right',vertical:'middle'};
        r3++;
        [1,2,3,4,5,6].forEach(c=>cell(ws3,r3,c,null,{align:MID}));
        r3++;
      };

      // 갱폼 박리제 (oilingDetails에 날짜 있음)
      const oilWs3Rows = [...(data.oiling?.details||[])]
        .sort((a,b)=>{
          if(a.date!==b.date) return a.date.localeCompare(b.date);
          const an=parseInt(a.building.replace(/[^0-9]/g,''))||0;
          const bn=parseInt(b.building.replace(/[^0-9]/g,''))||0;
          return an!==bn?an-bn:a.floor-b.floor;
        })
        .map(rec=>{
          const [,fm,fd]=(rec.date||'').split('-');
          return [fm&&fd?`${parseInt(fm)}/${parseInt(fd)}`:rec.date||'', rec.building, rec.floor, rec.units, rec.amount||0];
        });
      ws3Section('갱폼 박리제', oilWs3Rows);

      // 날짜별 원시 기록 우선, 없으면 집계 데이터(날짜 없음)로 대체
      const toCleanRows = (rawList, phBlds) => {
        if(rawList.length) return rawList.map(g=>{
          const [,fm,fd]=(g.date||'').split('-');
          return [`${parseInt(fm)}/${parseInt(fd)}`, g.building, g.floor, g.count, g.amount];
        });
        return phBlds.flatMap(b=>
          (b.floors||[]).filter(f=>f.is_billable).sort((a,x)=>a.floor-x.floor)
            .map(f=>['', b.building, f.floor, f.total, 0])
        );
      };
      ws3Section('1차 세대청소', toCleanRows(cleanRawRows[1], ph1Blds));
      ws3Section('2차 세대청소', toCleanRows(cleanRawRows[2], ph2Blds));

      // 다운로드
      const buf  = await wb.xlsx.writeBuffer();
      const blob = new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `월별정산_${month}.xlsx`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // 저장 완료 후 미마감이면 마감 제안
      if (!isClosed) {
        const ok = window.confirm(`${month} 엑셀 저장이 완료됐습니다.\n\n이 월을 마감하시겠습니까?\n마감 후 해당 월 데이터는 수정·삭제가 잠깁니다.`);
        if (ok) await performClose();
      }
    } catch(e) {
      console.error(e);
      alert('Excel 생성 오류: ' + e.message);
    } finally {
      setExcelGenerating(false);
    }
  };

  const buildingOptions = useMemo(() => {
    if (!data) return [];
    const buildings = Array.from(new Set([
      ...(data.oiling?.by_building || []).map(b => b.building),
      ...(data.cleaning?.by_building || []).map(b => b.building)
    ]));
    return buildings.sort((a, b) => {
      const numA = parseInt(a.replace(/[^0-9]/g, '')) || 0;
      const numB = parseInt(b.replace(/[^0-9]/g, '')) || 0;
      return numA - numB;
    });
  }, [data]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="font-bold text-slate-500 text-lg animate-pulse">분석 데이터를 불러오는 중...</p>
      </div>
    );
  }

  if (!data && !loading) {
    return <div className="p-20 text-center font-bold text-slate-400">데이터가 없거나 불러올 수 없습니다. 다시 시도해 주세요.</div>;
  }

  const phase1Total = cleaningPhase1ByBuilding.reduce((s, b) => s + b.billable_amount, 0);
  const phase2Total = cleaningPhase2ByBuilding.reduce((s, b) => s + b.billable_amount, 0);
  const phase1Units = cleaningPhase1ByBuilding.reduce((s, b) => s + b.total_units, 0);
  const phase2Units = cleaningPhase2ByBuilding.reduce((s, b) => s + b.total_units, 0);

  return (
    <div className="space-y-5 animate-in fade-in duration-500 max-w-7xl">
      <style>{`@media print{.no-print{display:none!important}.print-only{display:block!important}.left-panel{width:100%!important}.right-panel{display:none!important}}`}</style>

      {/* ── 페이지 헤드라인 ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 no-print">
        <div>
          <p className="text-[10px] font-label font-bold uppercase tracking-[0.2em] text-secondary mb-1">Settlement Report</p>
          <h2 className="text-3xl font-black text-primary font-headline tracking-tight">월별 통합 정산</h2>
          <p className="text-sm text-gray-400 font-label mt-1">1차 / 2차 청소 분리 정산 · 서명일 기준</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 마감 상태 뱃지 */}
          {isClosed
            ? <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-[10px] font-label font-bold uppercase tracking-widest">
                <span className="material-symbols-outlined text-xs">lock</span>마감됨
              </span>
            : <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-secondary/10 text-secondary text-[10px] font-label font-bold border border-secondary/20 uppercase tracking-widest">
                <span className="material-symbols-outlined text-xs">lock_open</span>미마감
              </span>
          }
          {/* 마감 / 마감 취소 버튼 */}
          {isClosed
            ? <button onClick={doUnclose} disabled={closingInProgress} className="flex items-center gap-1.5 px-3 py-2 bg-gray-200 hover:bg-gray-300 disabled:opacity-50 text-gray-700 rounded-xl font-bold text-xs font-label uppercase tracking-widest transition-colors">
                <span className="material-symbols-outlined text-sm">lock_open</span>
                {closingInProgress ? '처리 중...' : '마감 취소'}
              </button>
            : <button onClick={doClose} disabled={closingInProgress || !data} className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary-container disabled:opacity-40 text-white rounded-xl font-bold text-xs font-label uppercase tracking-widest transition-colors">
                <span className="material-symbols-outlined text-sm">lock</span>
                {closingInProgress ? '처리 중...' : '이 월 마감'}
              </button>
          }
          <button onClick={handleExcelDownload} disabled={excelGenerating} className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs font-label uppercase tracking-widest transition-opacity ${excelGenerating ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-secondary text-white hover:opacity-90'}`}>
            <span className="material-symbols-outlined text-sm">{excelGenerating ? 'autorenew' : 'download'}</span>
            {excelGenerating ? '생성 중...' : '엑셀 저장'}
          </button>
          <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl font-bold text-xs font-label uppercase tracking-widest hover:bg-primary-container transition-colors">
            <span className="material-symbols-outlined text-sm">print</span>청구서 출력
          </button>
        </div>
      </div>

      {/* ── 마감 완료 배너 ── */}
      {isClosed && (
        <div className="flex items-center gap-3 px-5 py-4 rounded-xl bg-primary border border-primary text-white no-print">
          <span className="material-symbols-outlined text-secondary flex-shrink-0">lock</span>
          <div>
            <strong className="text-sm font-label uppercase tracking-wide">{month} 마감 완료</strong>
            <span className="ml-2 text-white/60 text-sm">해당 월 데이터는 수정·삭제·추가가 잠겨 있습니다.</span>
          </div>
          <button onClick={doUnclose} disabled={closingInProgress} className="ml-auto flex-shrink-0 text-[10px] font-label uppercase tracking-widest text-white/50 hover:text-white transition-colors">
            {closingInProgress ? '처리 중...' : '마감 취소'}
          </button>
        </div>
      )}

      {/* 조건바 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-white border border-slate-200 rounded-xl shadow-sm no-print items-end">
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">분석 월</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold outline-none" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">박리제 단가</label>
            <input type="number" value={oilingPrice} onChange={(e) => setOilingPrice(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold outline-none" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">청소 단가</label>
            <input type="number" value={cleaningPrice} onChange={(e) => setCleaningPrice(e.target.value)} className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-bold outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">정산 모드</label>
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button onClick={() => setPeriodMode('split')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${periodMode === 'split' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>도급 (4/16~)</button>
            <button onClick={() => setPeriodMode('full')} className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-all ${periodMode === 'full' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>전체 기간</button>
          </div>
        </div>
        <div className="flex items-center gap-2 p-2 bg-blue-50 text-blue-700 rounded-lg text-[11px] font-medium leading-tight">
          <span className="material-symbols-outlined text-sm">info</span>
          <div>도급 시작일 <b>2026-04-16</b> 기준으로<br/>자동 정산됩니다. (변경 불가)</div>
        </div>
      </div>

      {/* 요약 카드 */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label:'갱폼 수입',   val: data.oiling?.total,    color:'text-blue-600',    bg:'bg-blue-50' },
            { label:'청소 수입',   val: data.cleaning?.total,  color:'text-green-600',   bg:'bg-green-50' },
            { label:'합계 수입',   val: data.summary?.income,  color:'text-primary',     bg:'bg-primary/5' },
            { label:'인건비 지출', val: data.expense?.total,   color:'text-red-600',     bg:'bg-red-50' },
            { label:'순수익',      val: data.summary?.net,     color:'text-emerald-700', bg:'bg-emerald-50' },
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
                  <tr key={b.building}
                    onClick={() => setSelectedBuilding(selectedBuilding === b.building ? null : b.building)}
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
            {(data?.oiling?.by_building || []).filter(b => !selectedBuilding || b.building === selectedBuilding).map(b => b.remark && (
              <div key={b.building} className="px-3 py-1 text-xs text-outline border-t border-outline-variant/10">
                <span className="font-bold text-primary">{b.building}</span> {b.remark}
              </div>
            ))}
          </div>

          {/* 1차 세대청소 */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden">
            <div className="bg-sky-500/10 px-4 py-3 border-b border-outline-variant/20">
              <h3 className="font-bold text-sm text-sky-700">1차 세대청소 동별 합계</h3>
            </div>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-outline-variant/10 bg-surface-dim/10">
                <th className="px-3 py-2 text-left text-outline">동</th>
                <th className="px-2 py-2 text-center text-outline">세대</th>
                <th className="px-2 py-2 text-right text-outline">확정금액</th>
              </tr></thead>
              <tbody>
                {cleaningPhase1ByBuilding.map(b => (
                  <tr key={b.building}
                    onClick={() => setSelectedBuilding(selectedBuilding === b.building ? null : b.building)}
                    className={`cursor-pointer border-b border-outline-variant/10 hover:bg-sky-50 transition-colors ${selectedBuilding === b.building ? 'bg-sky-100' : ''}`}>
                    <td className="px-3 py-2 font-bold text-primary">{b.building}</td>
                    <td className="px-2 py-2 text-center">{b.total_units}세대</td>
                    <td className="px-2 py-2 text-right font-bold">{fmt(b.billable_amount)}원</td>
                  </tr>
                ))}
                {data && (
                  <tr className="bg-sky-50 font-black">
                    <td className="px-3 py-2 text-sky-700">소계</td>
                    <td className="px-2 py-2 text-center text-sky-700">{phase1Units}세대</td>
                    <td className="px-2 py-2 text-right text-sky-700">{fmt(phase1Total)}원</td>
                  </tr>
                )}
                {cleaningPhase1ByBuilding.length === 0 && (
                  <tr><td colSpan="3" className="py-4 text-center text-outline text-[11px]">1차 청소 기록 없음</td></tr>
                )}
              </tbody>
            </table>
            {cleaningPhase1ByBuilding.filter(b => !selectedBuilding || b.building === selectedBuilding).map(b => b.remark && (
              <div key={b.building} className="px-3 py-1 text-xs text-outline border-t border-outline-variant/10">
                <span className="font-bold text-sky-700">{b.building}</span> {b.remark}
              </div>
            ))}
          </div>

          {/* 2차 세대청소 */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 overflow-hidden">
            <div className="bg-green-600/10 px-4 py-3 border-b border-outline-variant/20">
              <h3 className="font-bold text-sm text-green-700">2차 세대청소 동별 합계</h3>
            </div>
            <table className="w-full text-xs">
              <thead><tr className="border-b border-outline-variant/10 bg-surface-dim/10">
                <th className="px-3 py-2 text-left text-outline">동</th>
                <th className="px-2 py-2 text-center text-outline">세대</th>
                <th className="px-2 py-2 text-right text-outline">확정금액</th>
              </tr></thead>
              <tbody>
                {cleaningPhase2ByBuilding.map(b => (
                  <tr key={b.building}
                    onClick={() => setSelectedBuilding(selectedBuilding === b.building ? null : b.building)}
                    className={`cursor-pointer border-b border-outline-variant/10 hover:bg-green-50 transition-colors ${selectedBuilding === b.building ? 'bg-green-100' : ''}`}>
                    <td className="px-3 py-2 font-bold text-primary">{b.building}</td>
                    <td className="px-2 py-2 text-center">{b.total_units}세대</td>
                    <td className="px-2 py-2 text-right font-bold">{fmt(b.billable_amount)}원</td>
                  </tr>
                ))}
                {data && (
                  <tr className="bg-green-50 font-black">
                    <td className="px-3 py-2 text-green-700">소계</td>
                    <td className="px-2 py-2 text-center text-green-700">{phase2Units}세대</td>
                    <td className="px-2 py-2 text-right text-green-700">{fmt(phase2Total)}원</td>
                  </tr>
                )}
                {cleaningPhase2ByBuilding.length === 0 && (
                  <tr><td colSpan="3" className="py-4 text-center text-outline text-[11px]">2차 청소 기록 없음</td></tr>
                )}
              </tbody>
            </table>
            {cleaningPhase2ByBuilding.filter(b => !selectedBuilding || b.building === selectedBuilding).map(b => b.remark && (
              <div key={b.building} className="px-3 py-1 text-xs text-outline border-t border-outline-variant/10">
                <span className="font-bold text-green-700">{b.building}</span> {b.remark}
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
            {buildingOptions.map(name => (
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
                      <td className="px-3 py-2">{floorLabel(r.floor)}</td>
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
                      <td className="px-3 py-2">{floorLabel(r.floor)}</td>
                      <td className="px-3 py-2">{r.phase}차</td>
                      <td className="px-3 py-2 text-center">{r.cleaned}/{r.total}</td>
                      <td className="px-3 py-2">{r.is_billable ? <span className="text-green-600 font-bold">✅ 청구</span> : r.already_billed ? <span className="text-purple-500 font-bold">🔒 기정산</span> : r.is_complete ? <span className="text-orange-500">⚠️ 기준층이하</span> : <span className="text-red-400">⚠️ 미완성</span>}</td>
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

      {/* 인쇄용 청구서 */}
      <div className="hidden print-only p-8 space-y-6">
        <div className="text-center border-b-2 pb-4">
          <h1 className="text-2xl font-black">월별 정산 내역서 (1/2차 분리)</h1>
          <p className="text-gray-600">{month} ({periodMode === 'split' ? '도급: 2026-04-16 이후' : '전체 기간'})</p>
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
          <h2 className="font-bold text-lg mb-2">2. 1차 세대청소 도급 내역</h2>
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead><tr className="bg-gray-100"><th className="border border-gray-300 p-2">동</th><th className="border border-gray-300 p-2">세대</th><th className="border border-gray-300 p-2">금액</th></tr></thead>
            <tbody>
              {cleaningPhase1ByBuilding.map(b=>(
                <tr key={b.building}><td className="border border-gray-300 p-2 font-bold">{b.building}</td><td className="border border-gray-300 p-2 text-center">{b.total_units}세대</td><td className="border border-gray-300 p-2 text-right font-bold">{fmt(b.billable_amount)}원</td></tr>
              ))}
              <tr className="bg-sky-50 font-black"><td className="border border-gray-300 p-2">소계</td><td className="border border-gray-300 p-2 text-center">{phase1Units}세대</td><td className="border border-gray-300 p-2 text-right text-sky-700">{fmt(phase1Total)}원</td></tr>
            </tbody>
          </table>
        </div>
        <div>
          <h2 className="font-bold text-lg mb-2">3. 2차 세대청소 도급 내역</h2>
          <table className="w-full border-collapse border border-gray-300 text-sm">
            <thead><tr className="bg-gray-100"><th className="border border-gray-300 p-2">동</th><th className="border border-gray-300 p-2">세대</th><th className="border border-gray-300 p-2">금액</th></tr></thead>
            <tbody>
              {cleaningPhase2ByBuilding.map(b=>(
                <tr key={b.building}><td className="border border-gray-300 p-2 font-bold">{b.building}</td><td className="border border-gray-300 p-2 text-center">{b.total_units}세대</td><td className="border border-gray-300 p-2 text-right font-bold">{fmt(b.billable_amount)}원</td></tr>
              ))}
              <tr className="bg-green-50 font-black"><td className="border border-gray-300 p-2">소계</td><td className="border border-gray-300 p-2 text-center">{phase2Units}세대</td><td className="border border-gray-300 p-2 text-right text-green-700">{fmt(phase2Total)}원</td></tr>
            </tbody>
          </table>
        </div>
        {(data?.cleaning_extra||[]).length > 0 && (
          <div>
            <h2 className="font-bold text-lg mb-2">4. 기타 작업 내역 (별도 청구)</h2>
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
