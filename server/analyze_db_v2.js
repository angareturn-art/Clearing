const Database = require('better-sqlite3');
const path = require('path');

// DB 파일 경로
const dbPath = path.join(__dirname, 'construction.db');
const db = new Database(dbPath);

try {
  // 1. 건물별 세대수 계산
  console.log('=== 건물별 세대수 ===');
  const buildingStats = db.prepare(`
    SELECT 
      b.id as bid,
      b.name as bname,
      COUNT(h.id) as total_units,
      MAX(h.floors) as max_floor,
      GROUP_CONCAT(DISTINCT h.line) as lines
    FROM buildings b
    LEFT JOIN houses h ON b.id = h.building_id
    GROUP BY b.id
    ORDER BY b.id
  `).all();

  buildingStats.forEach(row => {
    console.log(`${row.bname}동: ${row.total_units}세대, 최대층: ${row.max_floor}층, 동라인: ${row.lines}`);
  });

  // 2. 동별 1층부터 전체층 세대수
  console.log('\n=== 동별 1층부터 전체층 세대수 (동라인별) ===');
  const unitsByFloor = db.prepare(`
    SELECT 
      b.name as bname,
      h.line as ho_line,
      h.floors as max_floors
    FROM houses h
    JOIN buildings b ON h.building_id = b.id
    ORDER BY b.id, h.line
  `).all();

  let currentBuilding = null;
  unitsByFloor.forEach(row => {
    if (currentBuilding !== row.bname) {
      if (currentBuilding) console.log('---');
      currentBuilding = row.bname;
      console.log(`\n${row.bname}동:`);
    }
    console.log(`  동라인 ${row.ho_line}: ${row.max_floors}층 (1층~${row.max_floors}층 = ${row.max_floors}세대)`);
  });

  // 3. 갱폼 대상/비대상 세대수
  console.log('\n\n=== 갱폼 기록 통계 ===');
  const oilingStats = db.prepare(`
    SELECT 
      b.id,
      b.name as bname,
      COUNT(*) as oiling_record_count,
      COUNT(DISTINCT floor) as floors_with_oiling,
      COUNT(DISTINCT house_id) as houses_with_oiling
    FROM oiling_records o
    LEFT JOIN buildings b ON o.building_id = b.id
    GROUP BY o.building_id
    ORDER BY b.id
  `).all();

  const totalUnits = db.prepare('SELECT COUNT(*) as cnt FROM houses').get();
  console.log(`전체 세대수: ${totalUnits.cnt}`);

  oilingStats.forEach(row => {
    console.log(`${row.bname}동: 갱폼 기록 ${row.oiling_record_count}건, ${row.houses_with_oiling}세대에서 ${row.floors_with_oiling}층 시공`);
  });

  // 4. 청소 대상/비대상 세대수
  console.log('\n=== 청소 기록 통계 ===');
  const cleaningStats = db.prepare(`
    SELECT 
      b.id,
      b.name as bname,
      COUNT(*) as cleaning_record_count,
      COUNT(DISTINCT floor) as floors_cleaned,
      COUNT(DISTINCT house_id) as houses_cleaned,
      SUM(CASE WHEN progress >= 100 THEN 1 ELSE 0 END) as completed_count,
      SUM(CASE WHEN progress < 100 THEN 1 ELSE 0 END) as in_progress_count
    FROM cleaning_records c
    LEFT JOIN buildings b ON c.building_id = b.id
    GROUP BY c.building_id
    ORDER BY b.id
  `).all();

  cleaningStats.forEach(row => {
    const cleaningStatus = row.completed_count ? `완료 ${row.completed_count}건` : '';
    const progressStatus = row.in_progress_count ? `진행중 ${row.in_progress_count}건` : '';
    const status = [cleaningStatus, progressStatus].filter(Boolean).join(', ') || '없음';
    console.log(`${row.bname}동: 청소 기록 ${row.cleaning_record_count}건 (${status}), ${row.houses_cleaned}세대`);
  });

  // 5. 전체 요약
  console.log('\n=== 전체 요약 ===');
  const totalOiling = db.prepare('SELECT COUNT(*) as cnt FROM oiling_records').get();
  const totalCleaning = db.prepare('SELECT COUNT(*) as cnt FROM cleaning_records').get();
  
  console.log(`전체 세대: ${totalUnits.cnt}`);
  console.log(`갱폼 기록: ${totalOiling.cnt}건`);
  console.log(`청소 기록: ${totalCleaning.cnt}건`);

} catch (error) {
  console.error('Error:', error.message);
} finally {
  db.close();
}
