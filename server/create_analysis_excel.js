const Database = require('better-sqlite3');
const path = require('path');
const xlsx = require('xlsx');

// DB 파일 경로
const dbPath = path.join(__dirname, 'construction.db');
const db = new Database(dbPath);

try {
  // 1. 동별 세대수 데이터
  const buildingData = db.prepare(`
    SELECT 
      b.id as bid,
      b.name as building_name,
      COUNT(h.id) as total_units
    FROM buildings b
    LEFT JOIN houses h ON b.id = h.building_id
    GROUP BY b.id
    ORDER BY b.id
  `).all();

  // 2. 동라인별 층수 데이터
  const unitsByLine = db.prepare(`
    SELECT 
      b.id,
      b.name as building_name,
      h.line as ho_line,
      h.floors as total_floors
    FROM houses h
    JOIN buildings b ON h.building_id = b.id
    ORDER BY b.id, h.line
  `).all();

  // 3. 갱폼 데이터 (대상/비대상)
  const oilingData = db.prepare(`
    SELECT 
      b.id,
      b.name as building_name,
      COUNT(*) as oiling_record_count,
      COUNT(DISTINCT house_id) as oiling_target_units
    FROM oiling_records o
    JOIN buildings b ON o.building_id = b.id
    GROUP BY o.building_id
    ORDER BY b.id
  `).all();

  // 4. 청소 데이터 (대상/비대상)
  const cleaningData = db.prepare(`
    SELECT 
      b.id,
      b.name as building_name,
      COUNT(*) as cleaning_record_count,
      COUNT(DISTINCT house_id) as cleaning_target_units
    FROM cleaning_records c
    JOIN buildings b ON c.building_id = b.id
    GROUP BY c.building_id
    ORDER BY b.id
  `).all();

  // 5. 전체 데이터 통합
  const summaryData = [];
  buildingData.forEach(building => {
    const oiling = oilingData.find(o => o.id === building.bid) || { oiling_record_count: 0, oiling_target_units: 0 };
    const cleaning = cleaningData.find(c => c.id === building.bid) || { cleaning_record_count: 0, cleaning_target_units: 0 };
    
    summaryData.push({
      '동': building.building_name,
      '총세대수': building.total_units,
      '갱폼 시공 세대': oiling.oiling_target_units,
      '갱폼 비대상 세대': building.total_units - oiling.oiling_target_units,
      '갱폼 기록건': oiling.oiling_record_count,
      '청소 시공 세대': cleaning.cleaning_target_units,
      '청소 비대상 세대': building.total_units - cleaning.cleaning_target_units,
      '청소 기록건': cleaning.cleaning_record_count
    });
  });

  // 6. 동라인별 상세 데이터
  const detailData = [];
  unitsByLine.forEach(unit => {
    detailData.push({
      '동': unit.building_name,
      '동라인': unit.ho_line,
      '1층~전체층': `1층~${unit.total_floors}층`,
      '총세대수': unit.total_floors
    });
  });

  // 7. Excel 파일 생성
  const workbook = xlsx.utils.book_new();

  // Sheet 1: 요약 데이터
  const summarySheet = xlsx.utils.json_to_sheet(summaryData);
  xlsx.utils.book_append_sheet(workbook, summarySheet, '동별요약');

  // Sheet 2: 동라인별 상세
  const detailSheet = xlsx.utils.json_to_sheet(detailData);
  xlsx.utils.book_append_sheet(workbook, detailSheet, '동라인별상세');

  // Sheet 3: 전체 통계
  const totalUnits = db.prepare('SELECT COUNT(*) as cnt FROM houses').get();
  const totalOiling = db.prepare('SELECT COUNT(*) as cnt FROM oiling_records').get();
  const totalCleaning = db.prepare('SELECT COUNT(*) as cnt FROM cleaning_records').get();
  const totalOilingUnits = db.prepare('SELECT COUNT(DISTINCT house_id) as cnt FROM oiling_records').get();
  const totalCleaningUnits = db.prepare('SELECT COUNT(DISTINCT house_id) as cnt FROM cleaning_records').get();

  const statsData = [
    { '항목': '전체 세대수', '값': totalUnits.cnt },
    { '항목': '갱폼 기록', '값': totalOiling.cnt + '건' },
    { '항목': '갱폼 시공 세대', '값': totalOilingUnits.cnt || 0 },
    { '항목': '갱폼 비대상 세대', '값': (totalUnits.cnt - (totalOilingUnits.cnt || 0)) },
    { '항목': '청소 기록', '값': totalCleaning.cnt + '건' },
    { '항목': '청소 시공 세대', '값': totalCleaningUnits.cnt || 0 },
    { '항목': '청소 비대상 세대', '값': (totalUnits.cnt - (totalCleaningUnits.cnt || 0)) }
  ];
  const statsSheet = xlsx.utils.json_to_sheet(statsData);
  xlsx.utils.book_append_sheet(workbook, statsSheet, '전체통계');

  // 파일 저장
  const outputPath = path.join(__dirname, 'construction_analysis.xlsx');
  xlsx.writeFile(workbook, outputPath);
  console.log(`Excel 파일이 생성되었습니다: ${outputPath}`);

  // 요약 출력
  console.log('\n=== 생성된 데이터 요약 ===\n');
  console.log('Sheet 1: 동별요약');
  console.log(summaryData);
  console.log('\nSheet 2: 동라인별상세');
  console.log(detailData);
  console.log('\nSheet 3: 전체통계');
  console.log(statsData);

} catch (error) {
  console.error('Error:', error.message);
} finally {
  db.close();
}
