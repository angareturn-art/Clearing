const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// DB 파일 경로
const dbPath = path.join(__dirname, 'construction.db');
const db = new Database(dbPath);

try {
  console.log('============================================');
  console.log('DB 분석 시작');
  console.log('============================================\n');

  // 1. 동(건물) 목록 조회
  console.log('[1] 건물(동) 목록:');
  const buildings = db.prepare('SELECT * FROM buildings;').all();
  console.log(JSON.stringify(buildings, null, 2));

  // 2. 각 건물별 세대 정보
  console.log('\n[2] 세대 정보:');
  const houses = db.prepare('SELECT * FROM houses;').all();
  console.log(`총 ${houses.length}개 세대`);
  console.log(JSON.stringify(houses.slice(0, 30), null, 2));

  // 3. 건물별 세대수 통계
  console.log('\n[3] 건물별 세대수 통계:');
  const buildingStats = db.prepare(`
    SELECT 
      b.id,
      b.name,
      COUNT(h.id) as unit_count,
      MAX(h.floors) as max_floors
    FROM buildings b
    LEFT JOIN houses h ON b.id = h.building_id
    GROUP BY b.id
  `).all();
  console.log(JSON.stringify(buildingStats, null, 2));

  // 4. 갱폼 기록 조회
  console.log('\n[4] 갱폼 기록:');
  const oilingStats = db.prepare(`
    SELECT 
      b.name as building,
      COUNT(*) as record_count,
      COUNT(DISTINCT floor) as floor_count
    FROM oiling_records o
    LEFT JOIN buildings b ON o.building_id = b.id
    GROUP BY o.building_id
  `).all();
  console.log(JSON.stringify(oilingStats, null, 2));

  // 5. 청소 기록 조회
  console.log('\n[5] 청소 기록:');
  const cleaningStats = db.prepare(`
    SELECT 
      b.name as building,
      COUNT(*) as record_count,
      COUNT(DISTINCT floor) as floor_count,
      SUM(CASE WHEN progress >= 100 THEN 1 ELSE 0 END) as completed_count
    FROM cleaning_records c
    LEFT JOIN buildings b ON c.building_id = b.id
    GROUP BY c.building_id
  `).all();
  console.log(JSON.stringify(cleaningStats, null, 2));

  // 6. 층별 세대수 분석
  console.log('\n[6] 층별 세대수 분석:');
  const floorAnalysis = db.prepare(`
    SELECT 
      b.id,
      b.name,
      h.line,
      COUNT(*) as unit_count
    FROM houses h
    JOIN buildings b ON h.building_id = b.id
    GROUP BY b.id, h.line
    ORDER BY b.id, h.line
  `).all();
  console.log(JSON.stringify(floorAnalysis, null, 2));

} catch (error) {
  console.error('DB 조회 오류:', error);
} finally {
  db.close();
  console.log('\n============================================');
  console.log('분석 완료');
  console.log('============================================');
}
