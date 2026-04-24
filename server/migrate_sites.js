const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'construction.db');
const db = new Database(DB_PATH);

console.log('🚀 Starting Database Migration for Multi-Site...');

try {
  // 1. sites 테이블 확인 및 기본 데이터 삽입
  db.exec(`
    CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      primary_contractor TEXT,
      subcontractor TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  const site = db.prepare('SELECT * FROM sites WHERE id = 1').get();
  if (!site) {
    db.prepare('INSERT INTO sites (id, name, primary_contractor, subcontractor) VALUES (1, ?, ?, ?)')
      .run('기본 현장', '원청사 미지정', '하청사 미지정');
    console.log('✅ Created default site (ID: 1)');
  } else {
    console.log('ℹ️ Default site already exists');
  }

  // 2. 각 테이블에 site_id 컬럼 추가 및 데이터 보정
  const tables = [
    'buildings', 'houses', 'oiling_records', 'cleaning_records', 'lifting_records',
    'personnel_records', 'cost_records', 'workers', 'worker_wage_history'
  ];

  tables.forEach(table => {
    // 컬럼 존재 여부 확인
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    if (!columns.some(c => c.name === 'site_id')) {
      try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN site_id INTEGER DEFAULT 1`);
        console.log(`✅ Added site_id column to ${table}`);
      } catch (e) {
        console.warn(`⚠️ Could not add column to ${table} (it might already exist):`, e.message);
      }
    }

    // 기존 데이터의 site_id를 1로 업데이트 (NULL이거나 0인 경우)
    const result = db.prepare(`UPDATE ${table} SET site_id = 1 WHERE site_id IS NULL OR site_id = 0`).run();
    if (result.changes > 0) {
      console.log(`✅ Updated ${result.changes} rows in ${table} to site_id = 1`);
    }
  });

  console.log('🎉 Migration completed successfully!');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
} finally {
  db.close();
}
