const Database = require('better-sqlite3');
const path = require('path');

// DB 파일 경로
const dbPath = path.join(__dirname, 'construction.db');
const db = new Database(dbPath);

try {
  // 모든 테이블 조회
  const tables = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' 
    ORDER BY name;
  `).all();

  console.log('=== 데이터베이스 테이블 ===');
  console.log(JSON.stringify(tables, null, 2));

  // 각 테이블의 스키마 조회
  console.log('\n=== 테이블 스키마 ===');
  tables.forEach(table => {
    const schema = db.prepare(`PRAGMA table_info(${table.name});`).all();
    console.log(`\n[${table.name}]`);
    console.log(JSON.stringify(schema, null, 2));
  });

  // buildings 테이블 데이터 확인
  if (tables.some(t => t.name === 'buildings')) {
    console.log('\n=== buildings 테이블 데이터 ===');
    const buildings = db.prepare('SELECT * FROM buildings;').all();
    console.log(JSON.stringify(buildings, null, 2));
  }

  // sites 테이블 데이터 확인
  if (tables.some(t => t.name === 'sites')) {
    console.log('\n=== sites 테이블 데이터 ===');
    const sites = db.prepare('SELECT * FROM sites;').all();
    console.log(JSON.stringify(sites, null, 2));
  }

  // units 테이블 데이터 확인
  if (tables.some(t => t.name === 'units')) {
    console.log('\n=== units 테이블 데이터 ===');
    const units = db.prepare('SELECT * FROM units LIMIT 50;').all();
    console.log(JSON.stringify(units, null, 2));
    const unitCount = db.prepare('SELECT COUNT(*) as count FROM units;').get();
    console.log(`\n총 units 개수: ${unitCount.count}`);
  }

} catch (error) {
  console.error('DB 조회 오류:', error);
} finally {
  db.close();
}
