const express = require('express');
const dayjs = require('dayjs');
const cors = require('cors');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const xlsx = require('xlsx');


// ── 백엔드 서버 엔진 설정 ──
const app = express();
const PORT = 5010;
const JWT_SECRET = 'blueprint_authority_secret_2025';
const DB_PATH = path.join(__dirname, 'construction.db');
const ERROR_LOG_PATH = path.join(__dirname, '..', '..', 'Error.md');

// ── 오류 기록 유틸리티 (Error.md 파일에 기록) ──
function logErrorToFile(error, type = 'Server') {
  const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
  const message = error.stack || error.message || String(error);
  // 줄바꿈 문자를 <br>로 치환하여 마크다운 테이블이 깨지지 않게 함
  const formattedMessage = message.replace(/\n/g, '<br>').replace(/\|/g, '\\|');
  const logEntry = `| ${timestamp} | ${formattedMessage} | ${type} |\n`;
  
  try {
    fs.appendFileSync(ERROR_LOG_PATH, logEntry);
  } catch (err) {
    console.error('Failed to write to Error.md:', err);
  }
}

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Site-Id']
}));
app.use(express.json({ limit: '20mb' }));
app.set('etag', false);
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// ── 데이터베이스 연결 (현장 관리 데이터가 저장되는 곳) ──
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── 프로그램 실행 시 필요한 데이터 테이블(장부) 자동 생성 ──
// 각 테이블은 현장의 특정 정보를 담는 '디지털 장부'와 같습니다.
db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    primary_contractor TEXT,
    subcontractor TEXT,
    address TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'worker',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS buildings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER DEFAULT 1,
    name TEXT NOT NULL,
    address TEXT,
    basement_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS houses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER DEFAULT 1,
    building_id INTEGER NOT NULL,
    ho TEXT NOT NULL,
    line INTEGER DEFAULT 1,
    floors INTEGER DEFAULT 20,
    basement_label_b1 TEXT DEFAULT 'B1',
    basement_label_b2 TEXT DEFAULT 'B2',
    FOREIGN KEY(building_id) REFERENCES buildings(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS oiling_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    building_id INTEGER,
    house_id INTEGER,
    floor INTEGER,
    operator TEXT,
    date TEXT,
    time TEXT,
    remarks TEXT,
    confirmed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS slab_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    building_id INTEGER,
    house_id INTEGER,
    floor INTEGER,
    operator TEXT,
    date TEXT,
    time TEXT,
    remarks TEXT,
    confirmed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS cleaning_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    building_id INTEGER,
    house_id INTEGER,
    floor INTEGER,
    phase INTEGER DEFAULT 1,
    progress INTEGER DEFAULT 50,
    operator TEXT,
    date TEXT,
    time TEXT,
    remarks TEXT,
    photo TEXT,
    confirmed INTEGER DEFAULT 0,
    sign_date TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS unloading_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    building_id INTEGER,
    house_id INTEGER,
    floor INTEGER,
    phase INTEGER DEFAULT 1,
    progress INTEGER DEFAULT 50,
    operator TEXT,
    date TEXT,
    time TEXT,
    remarks TEXT,
    photo TEXT,
    confirmed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  -- 동/층에 매이지 않는 자유 기록 ("기타" 카테고리). remarks가 곧 입력한 내역 본문.
  CREATE TABLE IF NOT EXISTS misc_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL DEFAULT 1,
    building_id INTEGER,
    date TEXT NOT NULL,
    remarks TEXT NOT NULL,
    operator TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    sync_flag TEXT DEFAULT 's'
  );

  CREATE TABLE IF NOT EXISTS cost_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    description TEXT,
    vendor TEXT,
    amount INTEGER DEFAULT 0,
    notes TEXT,
    category TEXT DEFAULT 'general',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS personnel_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    work_hours REAL DEFAULT 8,
    ot_hours REAL DEFAULT 0,
    night_hours REAL DEFAULT 0,
    memo TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS weather_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT UNIQUE,
    temperature REAL,
    wind_speed REAL,
    precipitation REAL,
    condition TEXT,
    saved_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS emergency_contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT,
    name TEXT,
    phone TEXT,
    role TEXT,
    sort_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS schedule_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT,
    record_id INTEGER,
    action TEXT,
    old_data TEXT,
    new_data TEXT,
    changed_by TEXT,
    changed_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS worker_monthly_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    worker_name TEXT NOT NULL,
    month TEXT NOT NULL,
    unit_price INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(worker_name, month)
  );

  CREATE TABLE IF NOT EXISTS workers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'worker',
    team TEXT,
    specialty TEXT,
    status TEXT DEFAULT 'active',
    memo TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS worker_wage_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER DEFAULT 1,
    worker_name TEXT NOT NULL,
    unit_price INTEGER NOT NULL,
    effective_date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    UNIQUE(site_id, worker_name, effective_date)
  );

  CREATE TABLE IF NOT EXISTS site_config (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS deleted_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    sync_flag TEXT DEFAULT 'f',
    deleted_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS monthly_closings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL,
    month TEXT NOT NULL,
    closed_at TEXT DEFAULT (datetime('now','localtime')),
    closed_by TEXT,
    UNIQUE(site_id, month)
  );

  -- 마감(월별 정산 확정) 시점에 그 순간 청구 대상이던 (건물+층+차수)를 영구히 기록.
  -- 마감 이후 같은 층에 재청소/재서명이 발생해도 이 원장에 있으면 다시 청구되지 않는다
  -- (calculateMonthlyAnalysisData 참고 — 재청소로 인한 이중 청구 방지).
  CREATE TABLE IF NOT EXISTS billed_floors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL DEFAULT 1,
    building_id INTEGER NOT NULL,
    floor INTEGER NOT NULL,
    phase INTEGER NOT NULL,
    billed_month TEXT NOT NULL,
    billed_at TEXT DEFAULT (datetime('now','localtime')),
    sync_flag TEXT DEFAULT 's',
    UNIQUE(site_id, building_id, floor, phase)
  );

  CREATE TABLE IF NOT EXISTS schedule_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    memo TEXT,
    date TEXT NOT NULL,
    all_day INTEGER DEFAULT 1,
    category TEXT DEFAULT 'general',
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  -- 모바일에서 삭제한 일정이 웹에 동기화(pull-delete)될 때 지우기 전에 남기는 스냅샷.
  -- 잘못 반영됐을 때 확인 및 복구(되살리기)할 수 있도록 함.
  CREATE TABLE IF NOT EXISTS schedule_events_deleted_archive (
    archive_id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_id INTEGER NOT NULL,
    site_id INTEGER,
    title TEXT,
    memo TEXT,
    date TEXT,
    all_day INTEGER,
    category TEXT,
    created_by TEXT,
    deleted_at TEXT DEFAULT (datetime('now','localtime')),
    deleted_source TEXT DEFAULT 'mobile',
    restored_at TEXT
  );
`);

// ── 식비 컬럼 마이그레이션 (breakfast, lunch) ──
{
  const info = db.prepare('PRAGMA table_info(personnel_records)').all();
  if (!info.some(c => c.name === 'breakfast')) {
    db.exec('ALTER TABLE personnel_records ADD COLUMN breakfast INTEGER DEFAULT 1');
    console.log('✅ Migrated personnel_records: added breakfast');
  }
  if (!info.some(c => c.name === 'lunch')) {
    db.exec('ALTER TABLE personnel_records ADD COLUMN lunch INTEGER DEFAULT 1');
    console.log('✅ Migrated personnel_records: added lunch');
  }
}

// ── cleaning_records sign_date 마이그레이션 ──
{
  const info = db.prepare('PRAGMA table_info(cleaning_records)').all();
  if (!info.some(c => c.name === 'sign_date')) {
    try {
      db.exec('ALTER TABLE cleaning_records ADD COLUMN sign_date TEXT');
      console.log('✅ Migrated cleaning_records: added sign_date');
    } catch (e) { console.error('Failed to migrate cleaning_records (sign_date):', e.message); }
  }
}

// ── site_config 현장별 분리 마이그레이션 (기존엔 전역 공유 테이블이었음) ──
(function migrateSiteConfigPerSite() {
  const cols = db.prepare('PRAGMA table_info(site_config)').all();
  if (!cols.some(c => c.name === 'site_id')) {
    console.log('🔧 site_config 테이블을 현장별로 분리합니다...');
    db.exec('DROP TRIGGER IF EXISTS trg_site_config_insert');
    db.exec('DROP TRIGGER IF EXISTS trg_site_config_update');
    db.exec('DROP TRIGGER IF EXISTS trg_site_config_delete');
    db.exec(`
      ALTER TABLE site_config RENAME TO site_config_old;
      CREATE TABLE site_config (
        site_id INTEGER NOT NULL DEFAULT 1,
        key TEXT NOT NULL,
        value TEXT,
        updated_at TEXT DEFAULT (datetime('now','localtime')),
        sync_flag TEXT DEFAULT 's',
        PRIMARY KEY (site_id, key)
      );
      INSERT INTO site_config (site_id, key, value, updated_at, sync_flag)
        SELECT 1, key, value, updated_at, COALESCE(sync_flag, 's') FROM site_config_old;
      DROP TABLE site_config_old;
    `);
    console.log('✅ site_config: site_id 컬럼 추가, 기존 설정은 현장 1로 귀속 완료');
  }
})();

// ── weather_records 현장별 분리 마이그레이션 (기존엔 date 단일 UNIQUE라 현장 간 날씨가 서로 덮어썼음) ──
(function migrateWeatherRecordsPerSite() {
  const cols = db.prepare('PRAGMA table_info(weather_records)').all();
  if (!cols.some(c => c.name === 'site_id')) {
    console.log('🔧 weather_records 테이블을 현장별로 분리합니다...');
    db.exec('DROP TRIGGER IF EXISTS trg_weather_records_insert');
    db.exec('DROP TRIGGER IF EXISTS trg_weather_records_update');
    db.exec('DROP TRIGGER IF EXISTS trg_weather_records_delete');
    db.exec(`
      ALTER TABLE weather_records RENAME TO weather_records_old;
      CREATE TABLE weather_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id INTEGER NOT NULL DEFAULT 1,
        date TEXT,
        temperature REAL,
        wind_speed REAL,
        precipitation REAL,
        condition TEXT,
        saved_at TEXT DEFAULT (datetime('now','localtime')),
        sync_flag TEXT DEFAULT 's',
        UNIQUE(site_id, date)
      );
      INSERT INTO weather_records (id, site_id, date, temperature, wind_speed, precipitation, condition, saved_at, sync_flag)
        SELECT id, 1, date, temperature, wind_speed, precipitation, condition, saved_at, COALESCE(sync_flag, 's') FROM weather_records_old;
      DROP TABLE weather_records_old;
    `);
    console.log('✅ weather_records: site_id 컬럼 추가 및 UNIQUE(site_id,date)로 재구성, 기존 기록은 현장 1로 귀속');
  }
})();

// ── 기존 테이블 site_id 및 sync_flag 마이그레이션 ──
const triggerTables = [
  'buildings', 'houses', 'oiling_records', 'slab_records', 'cleaning_records', 'unloading_records', 'misc_records',
  'cost_records', 'personnel_records', 'workers', 'worker_wage_history',
  'users', 'site_config', 'weather_records', 'emergency_contacts', 'worker_monthly_prices',
  'monthly_closings', 'schedule_events', 'billed_floors'
];

triggerTables.forEach(table => {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  if (table !== 'users' && table !== 'site_config' && table !== 'weather_records' && table !== 'worker_monthly_prices') {
    if (!info.some(c => c.name === 'site_id')) {
      try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN site_id INTEGER DEFAULT 1`);
        console.log(`✅ Migrated table ${table}: added site_id`);
      } catch (e) { console.error(`Failed to migrate ${table}:`, e.message); }
    }
  }
  
  if (!info.some(c => c.name === 'sync_flag')) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN sync_flag TEXT DEFAULT 's'`);
      console.log(`✅ Migrated table ${table}: added sync_flag`);
    } catch (e) { console.error(`Failed to migrate ${table} (sync_flag):`, e.message); }
  }

  // 트리거 생성 로직 (sync_flag 자동 업데이트 및 삭제 추적)
  const matchClause = table === 'site_config'
    ? (row) => `site_id = ${row}.site_id AND key = ${row}.key`
    : (row) => `id = ${row}.id`;
  const recordIdExpr = table === 'site_config' ? "OLD.site_id || ':' || OLD.key" : 'OLD.id';
  try {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_${table}_insert AFTER INSERT ON ${table}
      FOR EACH ROW
      WHEN NEW.sync_flag = 's'
      BEGIN
        UPDATE ${table} SET sync_flag = 'f' WHERE ${matchClause('NEW')};
      END;

      CREATE TRIGGER IF NOT EXISTS trg_${table}_update AFTER UPDATE ON ${table}
      FOR EACH ROW
      WHEN NEW.sync_flag = OLD.sync_flag AND NEW.sync_flag != 'f'
      BEGIN
        UPDATE ${table} SET sync_flag = 'f' WHERE ${matchClause('NEW')};
      END;

      CREATE TRIGGER IF NOT EXISTS trg_${table}_delete BEFORE DELETE ON ${table}
      FOR EACH ROW
      BEGIN
        INSERT INTO deleted_logs (table_name, record_id, sync_flag) VALUES ('${table}', ${recordIdExpr}, 'f');
      END;
    `);
  } catch(e) { console.error('Failed to create triggers for', table, e.message); }
});

// ── buildings 기준층 컬럼 마이그레이션 ──
(function migrateBaseFloors() {
  const bInfo = db.prepare('PRAGMA table_info(buildings)').all();
  if (!bInfo.some(c => c.name === 'oiling_base_floor')) {
    db.exec('ALTER TABLE buildings ADD COLUMN oiling_base_floor INTEGER DEFAULT 0');
    console.log('✅ buildings: oiling_base_floor 추가');
  }
  if (!bInfo.some(c => c.name === 'cleaning_base_floor')) {
    db.exec('ALTER TABLE buildings ADD COLUMN cleaning_base_floor INTEGER DEFAULT 0');
    console.log('✅ buildings: cleaning_base_floor 추가');
  }
  if (!bInfo.some(c => c.name === 'unloading_base_floor')) {
    db.exec('ALTER TABLE buildings ADD COLUMN unloading_base_floor INTEGER DEFAULT 0');
    console.log('✅ buildings: unloading_base_floor 추가');
  }
  if (!bInfo.some(c => c.name === 'slab_base_floor')) {
    db.exec('ALTER TABLE buildings ADD COLUMN slab_base_floor INTEGER DEFAULT 0');
    console.log('✅ buildings: slab_base_floor 추가');
  }
  // 기준층 초기값 설정 (값이 0인 경우만 업데이트)
  const setFloors = db.transaction(() => {
    [['1동',7,4],['2동',7,4],['3동',3,3],['4동',3,3],['5동',3,3],['6동',3,3],['9동',3,3],['7동',2,2],['8동',2,2]]
      .forEach(([name, oil, clean]) => {
        db.prepare('UPDATE buildings SET oiling_base_floor=? WHERE name=? AND oiling_base_floor=0').run(oil, name);
        db.prepare('UPDATE buildings SET cleaning_base_floor=? WHERE name=? AND cleaning_base_floor=0').run(clean, name);
        db.prepare('UPDATE buildings SET unloading_base_floor=? WHERE name=? AND unloading_base_floor=0').run(clean, name);
      });
  });
  setFloors();
})();

// ── buildings 층 구간별 결합과금(청소+박리 동시완료) 컬럼 마이그레이션 ──
// combo_tier_floor=0이면 비활성(기존 방식 그대로). >0이면 그 층 이하는 combo_low_price,
// 초과는 combo_high_price를 층당 고정금액으로 청구(세대수 무관) — calculateMonthlyAnalysisData 참고.
(function migrateComboBilling() {
  const bInfo = db.prepare('PRAGMA table_info(buildings)').all();
  if (!bInfo.some(c => c.name === 'combo_tier_floor')) {
    db.exec('ALTER TABLE buildings ADD COLUMN combo_tier_floor INTEGER DEFAULT 0');
    console.log('✅ buildings: combo_tier_floor 추가');
  }
  if (!bInfo.some(c => c.name === 'combo_low_price')) {
    db.exec('ALTER TABLE buildings ADD COLUMN combo_low_price INTEGER DEFAULT 0');
    console.log('✅ buildings: combo_low_price 추가');
  }
  if (!bInfo.some(c => c.name === 'combo_high_price')) {
    db.exec('ALTER TABLE buildings ADD COLUMN combo_high_price INTEGER DEFAULT 0');
    console.log('✅ buildings: combo_high_price 추가');
  }
})();

// ── 누락 작업자 단가 자동 등록 (김대성, 이르판) ──
(function seedWorkerPrices() {
  const defaults = [['김대성', 150000], ['이르판', 140000]];
  const upsert = db.prepare(`
    INSERT INTO worker_wage_history (site_id, worker_name, effective_date, unit_price)
    VALUES (1, ?, '2026-04-01', ?)
    ON CONFLICT(site_id, worker_name, effective_date) DO NOTHING
  `);
  defaults.forEach(([name, price]) => upsert.run(name, price));
  console.log('✅ 작업자 단가 기본값 등록 완료');
})();

// ── worker_wage_history 제약 조건 고도화 마이그레이션 ──
const wwhIndices = db.prepare("PRAGMA index_list('worker_wage_history')").all();
let needsWwhUpdate = true;
for (const idx of wwhIndices) {
  const cols = db.prepare(`PRAGMA index_info('${idx.name}')`).all();
  if (cols.some(c => c.name === 'site_id') && cols.some(c => c.name === 'worker_name')) {
    needsWwhUpdate = false;
    break;
  }
}
if (needsWwhUpdate) {
  try {
    db.exec(`
      CREATE TABLE wwh_backup (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site_id INTEGER DEFAULT 1,
        worker_name TEXT NOT NULL,
        unit_price INTEGER NOT NULL,
        effective_date TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        UNIQUE(site_id, worker_name, effective_date)
      );
      INSERT OR REPLACE INTO wwh_backup (id, site_id, worker_name, unit_price, effective_date, created_at)
      SELECT id, site_id, worker_name, unit_price, effective_date, created_at FROM worker_wage_history;
      DROP TABLE worker_wage_history;
      ALTER TABLE wwh_backup RENAME TO worker_wage_history;
    `);
    console.log('✅ Migrated worker_wage_history: Added site_id to UNIQUE constraint');
  } catch (e) { console.error('Failed to migrate wwh constraints:', e.message); }
}

// ── worker_wage_history 청구단가(원청에서 받는 단가) 컬럼 마이그레이션 ──
// 기존 unit_price는 작업자에게 "지급"하는 단가. billing_rate는 원청에 "청구"하는 단가로,
// 현장별 손익 계산(예: 화천현장)에서 (billing_rate - unit_price) × 공수로 마진을 낸다.
(function migrateBillingRate() {
  const wwhInfo = db.prepare('PRAGMA table_info(worker_wage_history)').all();
  if (!wwhInfo.some(c => c.name === 'billing_rate')) {
    db.exec('ALTER TABLE worker_wage_history ADD COLUMN billing_rate INTEGER DEFAULT 0');
    console.log('✅ worker_wage_history: billing_rate 추가');
  }
})();

// ── sites 테이블 누락 컬럼 마이그레이션 ──
const siteInfo = db.prepare('PRAGMA table_info(sites)').all();
const missingSiteCols = ['address', 'start_date', 'end_date'];
missingSiteCols.forEach(col => {
  if (!siteInfo.some(c => c.name === col)) {
    try {
      db.exec(`ALTER TABLE sites ADD COLUMN ${col} TEXT`);
      console.log(`✅ Migrated sites table: added ${col}`);
    } catch (e) { console.error(`Failed to migrate sites (${col}):`, e.message); }
  }
});

// ── sync_flag 컬럼 마이그레이션 (Supabase 동기화용) ──
const SYNC_FLAG_TABLES = [
  'oiling_records', 'slab_records', 'cleaning_records', 'unloading_records',
  'buildings', 'houses', 'cost_records', 'personnel_records',
  'workers', 'sites'
];
SYNC_FLAG_TABLES.forEach(tbl => {
  try {
    const info = db.prepare(`PRAGMA table_info(${tbl})`).all();
    if (info.length > 0 && !info.some(c => c.name === 'sync_flag')) {
      db.exec(`ALTER TABLE ${tbl} ADD COLUMN sync_flag TEXT DEFAULT 'n'`);
      console.log(`✅ sync_flag 컬럼 추가: ${tbl}`);
    }
  } catch (e) { /* 테이블 미존재 시 무시 */ }
});

// ── 초기 현장 데이터 생성 ──
const siteCount = db.prepare('SELECT COUNT(*) as c FROM sites').get();
if (siteCount.c === 0) {
  db.prepare('INSERT INTO sites (id, name, primary_contractor, subcontractor) VALUES (1, ?, ?, ?)')
    .run('기본 현장', '원청사 미지정', '하청사 미지정');
  console.log('✅ Default site created');
}

// ── 프로그램 기본 정보 자동 입력 (동/호수/계정 초기화) ──
const bCount = db.prepare('SELECT COUNT(*) as c FROM buildings').get();
if (bCount.c === 0) {
  const insertB = db.prepare('INSERT INTO buildings (site_id, name, address, basement_count) VALUES (?,?,?,?)');
  const insertH = db.prepare('INSERT INTO houses (site_id, building_id, ho, line, floors, basement_label_b1, basement_label_b2) VALUES (?,?,?,?,?,?,?)');

  const buildingData = [
    {
      site_id: 1,
      name: '1동', houses: [
        { ho: '1호', floors: 17 },
        { ho: '2호', floors: 17 },
        { ho: '3호', floors: 20 },
        { ho: '4호', floors: 20 },
      ]
    },
    {
      name: '2동', houses: [
        { ho: '1호', floors: 17 },
        { ho: '2호', floors: 25 },
        { ho: '3호', floors: 25 },
        { ho: '4호', floors: 25 },
      ]
    },
    {
      name: '3동', houses: [
        { ho: '1호', floors: 18 },
        { ho: '2호', floors: 18 },
        { ho: '3호', floors: 20 },
        { ho: '4호', floors: 20 },
        { ho: '5호', floors: 20 },
      ]
    },
    {
      name: '4동', houses: [
        { ho: '1호', floors: 20 },
        { ho: '2호', floors: 20 },
        { ho: '3호', floors: 20 },
      ]
    },
    {
      name: '5동', houses: [
        { ho: '1호', floors: 20 },
        { ho: '2호', floors: 20 },
        { ho: '3호', floors: 20 },
      ]
    },
    {
      name: '6동', houses: [
        { ho: '1호', floors: 16 },
        { ho: '2호', floors: 16 },
      ]
    },
    {
      name: '7동', houses: [
        { ho: '1호', floors: 20 },
        { ho: '2호', floors: 20 },
        { ho: '3호', floors: 15 },
      ]
    },
    {
      name: '8동', houses: [
        { ho: '1호', floors: 18 },
        { ho: '2호', floors: 18 },
        { ho: '3호', floors: 14 },
      ]
    },
    {
      name: '9동', houses: [
        { ho: '1호', floors: 15 },
        { ho: '2호', floors: 15 },
        { ho: '3호', floors: 25 },
        { ho: '4호', floors: 25 },
      ]
    },
  ];

  buildingData.forEach(b => {
    const bResult = insertB.run(b.site_id || 1, b.name, b.address || '', b.basement_count || 0);
    const bId = bResult.lastInsertRowid;
    b.houses.forEach((h, i) => {
      insertH.run(b.site_id || 1, bId, h.ho, h.line || i + 1, h.floors, h.basement_label_b1 || 'B1', h.basement_label_b2 || 'B2');
    });
  });
}

// ── 현장 설정 초기화 ──
const scCount = db.prepare('SELECT COUNT(*) as c FROM site_config').get();
if (scCount.c === 0) {
  const insertSC = db.prepare('INSERT INTO site_config (site_id, key, value) VALUES (1,?,?)');
  insertSC.run('site_address', '');
  insertSC.run('start_date', '');
  insertSC.run('end_date', '');
  insertSC.run('latitude', '37.5665');
  insertSC.run('longitude', '126.9780');
}

// ── 비상 연락망 초기 데이터 ──
const ecCount = db.prepare('SELECT COUNT(*) as c FROM emergency_contacts').get();
if (ecCount.c === 0) {
  const insertEC = db.prepare('INSERT INTO emergency_contacts (category,name,phone,role,sort_order) VALUES (?,?,?,?,?)');
  [
    ['현장 관리', '김현장', '010-1234-5678', '현장소장', 1],
    ['현장 관리', '이감리', '010-2345-6789', '감리원', 2],
    ['안전', '박안전', '010-3456-7890', '안전관리자', 3],
    ['소방', '119', '119', '소방서', 4],
    ['경찰', '112', '112', '경찰서', 5],
  ].forEach(r => insertEC.run(...r));
}

// ── 초기 관리자 계정 자동 생성 ──
const adminCount = db.prepare('SELECT COUNT(*) as c FROM users WHERE role=\'admin\'').get();
if (adminCount.c === 0) {
  const hash = bcrypt.hashSync('admin1234!', 10);
  db.prepare('INSERT INTO users (email, password, name, role) VALUES (?,?,?,?)')
    .run('admin@clearing.com', hash, '관리자', 'admin');
  console.log('✅ Default admin account created: admin@clearing.com / admin1234!');
}

// ── Auth 미들웨어 ──
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: '인증 필요' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: '토큰 만료 또는 유효하지 않음' });
  }
};

// ── Site 미들웨어 (요청에서 현장 ID 추출) ──
const siteMiddleware = (req, res, next) => {
  req.siteId = req.headers['x-site-id'] || 1;
  next();
};

app.use(siteMiddleware); // 모든 API에 글로벌하게 적용

app.use(siteMiddleware);
app.post('/api/auth/register', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '관리자만 회원을 등록할 수 있습니다.' });
  }
  const { email, password, name, role } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (email,password,name,role) VALUES (?,?,?,?)');
    const result = stmt.run(email, hash, name, role || 'worker');
    res.json({ id: result.lastInsertRowid, email, name });
  } catch (e) {
    res.status(400).json({ error: '이미 존재하는 이메일입니다.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (!user) return res.status(401).json({ error: '이메일 또는 비밀번호 오류' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: '이메일 또는 비밀번호 오류' });
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

// ── 기준 정보 (현장별 필터링 적용) - oiling_base_floor, cleaning_base_floor 포함
app.get('/api/master/buildings', siteMiddleware, (req, res) => {
  const buildings = db.prepare('SELECT * FROM buildings WHERE site_id = ? ORDER BY id').all(req.siteId);
  const houses = db.prepare('SELECT * FROM houses WHERE site_id = ? ORDER BY building_id, line').all(req.siteId);
  const result = buildings.map(b => ({
    ...b,
    oiling_base_floor: b.oiling_base_floor || 0,
    slab_base_floor: b.slab_base_floor || 0,
    cleaning_base_floor: b.cleaning_base_floor || 0,
    unloading_base_floor: b.unloading_base_floor || 0,
    combo_tier_floor: b.combo_tier_floor || 0,
    combo_low_price: b.combo_low_price || 0,
    combo_high_price: b.combo_high_price || 0,
    houses: houses.filter(h => h.building_id === b.id)
  }));
  res.json(result);
});

app.post('/api/master/save-building', (req, res) => {
  const { id, name, address, basement_count, oiling_base_floor, slab_base_floor, cleaning_base_floor, unloading_base_floor, combo_tier_floor, combo_low_price, combo_high_price, houses } = req.body;
  db.prepare('UPDATE buildings SET name=?,address=?,basement_count=?,oiling_base_floor=?,slab_base_floor=?,cleaning_base_floor=?,unloading_base_floor=?,combo_tier_floor=?,combo_low_price=?,combo_high_price=?,sync_flag=? WHERE id=? AND site_id=?')
    .run(name, address || '', basement_count || 0, oiling_base_floor || 0, slab_base_floor || 0, cleaning_base_floor || 0, unloading_base_floor || 0, combo_tier_floor || 0, combo_low_price || 0, combo_high_price || 0, 'f', id, req.siteId);

  // 세대(house) 행을 매번 전부 삭제 후 재생성하면, 이미 저장된 청소/기름칠/하역
  // 기록이 참조하던 house_id가 끊어져(orphan) 화면에 데이터가 사라지는 문제가 있었다.
  // id가 있는 세대는 UPDATE로 보존하고, id가 없는(신규 추가된) 세대만 INSERT하며,
  // 응답에 더 이상 포함되지 않은(삭제된) 세대만 DELETE 한다.
  const existingIds = new Set(
    db.prepare('SELECT id FROM houses WHERE building_id=? AND site_id=?').all(id, req.siteId).map(r => r.id)
  );
  const keepIds = new Set();

  const updateH = db.prepare('UPDATE houses SET ho=?,line=?,floors=?,basement_label_b1=?,basement_label_b2=?,start_floor=?,sync_flag=? WHERE id=? AND site_id=?');
  const insertH = db.prepare('INSERT INTO houses (site_id,building_id,ho,line,floors,basement_label_b1,basement_label_b2,start_floor,sync_flag) VALUES (?,?,?,?,?,?,?,?,?)');

  houses.forEach((h, i) => {
    const line = h.line || i + 1;
    if (h.id && existingIds.has(h.id)) {
      updateH.run(h.ho, line, h.floors, h.basement_label_b1 || 'B1', h.basement_label_b2 || 'B2', h.start_floor || 1, 'f', h.id, req.siteId);
      keepIds.add(h.id);
    } else {
      const result = insertH.run(req.siteId, id, h.ho, line, h.floors, h.basement_label_b1 || 'B1', h.basement_label_b2 || 'B2', h.start_floor || 1, 'f');
      keepIds.add(result.lastInsertRowid);
    }
  });

  const removedIds = [...existingIds].filter(hid => !keepIds.has(hid));
  if (removedIds.length > 0) {
    const deleteOne = db.prepare('DELETE FROM houses WHERE id=? AND site_id=?');
    removedIds.forEach(hid => deleteOne.run(hid, req.siteId));
  }

  res.json({ success: true });
});

app.post('/api/master/add-building', siteMiddleware, (req, res) => {
  const { name } = req.body;
  const result = db.prepare('INSERT INTO buildings (site_id, name, basement_count) VALUES (?,?,0)').run(req.siteId, name);
  res.json({ id: result.lastInsertRowid });
});

// ── 현장 설정 API
app.get('/api/site-config', (req, res) => {
  const config = db.prepare('SELECT * FROM site_config WHERE site_id = ?').all(req.siteId);
  const result = config.reduce((acc, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {});
  res.json(result);
});

app.post('/api/site-config', async (req, res) => {
  const settings = req.body;
  const siteId = req.siteId;

  // 주소가 변경된 경우 지오코딩 시도
  if (settings.site_address) {
    try {
      const geoUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(settings.site_address)}&limit=1`;
      const geoRes = await fetch(geoUrl, { headers: { 'User-Agent': 'ClearingSystem/1.0' } });
      const geoData = await geoRes.json();
      if (geoData && geoData.length > 0) {
        settings.latitude = geoData[0].lat;
        settings.longitude = geoData[0].lon;
      }
    } catch (err) {
      console.error('Geocoding failed:', err);
    }
  }

  const upsertSC = db.prepare(`
    INSERT INTO site_config (site_id, key, value) VALUES (?,?,?)
    ON CONFLICT(site_id, key) DO UPDATE SET value=excluded.value, updated_at=datetime('now','localtime')
  `);

  const transaction = db.transaction((data) => {
    for (const [key, value] of Object.entries(data)) {
      upsertSC.run(siteId, key, value);
    }
  });

  transaction(settings);
  res.json({ success: true });
});

// ── 요약 (대시보드)
app.get('/api/status/summary', (req, res) => {
  const oiling = db.prepare(`
    SELECT o.*, b.name as building_name
    FROM oiling_records o
    JOIN buildings b ON b.id=o.building_id
    WHERE o.site_id = ?
    ORDER BY o.date DESC
  `).all(req.siteId);

  const slab = db.prepare(`
    SELECT s.*, b.name as building_name
    FROM slab_records s
    JOIN buildings b ON b.id=s.building_id
    WHERE s.site_id = ?
    ORDER BY s.date DESC
  `).all(req.siteId);

  const cleaning = db.prepare(`
    SELECT c.*, b.name as building_name, h.ho
    FROM cleaning_records c
    JOIN buildings b ON b.id=c.building_id
    LEFT JOIN houses h ON h.id=c.house_id
    WHERE c.site_id = ?
    ORDER BY c.date DESC
  `).all(req.siteId);

  const unloading = db.prepare(`
    SELECT u.*, b.name as building_name, h.ho
    FROM unloading_records u
    JOIN buildings b ON b.id=u.building_id
    LEFT JOIN houses h ON h.id=u.house_id
    WHERE u.site_id = ?
    ORDER BY u.date DESC
  `).all(req.siteId);

  const misc = db.prepare(`
    SELECT m.*, b.name as building_name
    FROM misc_records m
    LEFT JOIN buildings b ON b.id=m.building_id
    WHERE m.site_id = ?
    ORDER BY m.date DESC
  `).all(req.siteId);

  res.json({ oiling, slab, cleaning, unloading, misc });
});

// ── 기록 CRUD
['oiling', 'slab', 'cleaning', 'unloading', 'misc'].forEach(type => {
  const table = type === 'oiling' ? 'oiling_records' : type === 'slab' ? 'slab_records' : type === 'cleaning' ? 'cleaning_records' : type === 'unloading' ? 'unloading_records' : 'misc_records';

  app.get(`/api/records/${type}`, (req, res) => {
    const { date, buildingId } = req.query;
    const needsHouse = type === 'cleaning' || type === 'unloading';
    // misc는 building_id가 NULL일 수 있어 LEFT JOIN (다른 타입은 항상 building_id가 있어 결과 동일)
    let query = `SELECT r.*, b.name as building_name${needsHouse ? ', h.ho' : ''}
      FROM ${table} r
      LEFT JOIN buildings b ON b.id=r.building_id
      ${needsHouse ? 'LEFT JOIN houses h ON h.id=r.house_id' : ''}
      WHERE r.site_id = ?`;
    const params = [req.siteId];
    if (date) { query += ' AND r.date=?'; params.push(date); }
    if (buildingId) { query += ' AND r.building_id=?'; params.push(buildingId); }
    query += ' ORDER BY r.created_at DESC';
    res.json(db.prepare(query).all(...params));
  });

  app.post(`/api/records/${type}`, (req, res) => {
    const d = req.body;
    if (rejectIfClosed(res, req.siteId, d.date)) return;
    let stmt;
    if (type === 'oiling') {
      stmt = db.prepare('INSERT INTO oiling_records (site_id,building_id,house_id,floor,operator,date,time,remarks,sync_flag) VALUES (?,?,?,?,?,?,?,?,?)');
      stmt.run(req.siteId, d.building_id, null, d.floor, d.operator, d.date, d.time, d.remarks, 'f');
    } else if (type === 'slab') {
      stmt = db.prepare('INSERT INTO slab_records (site_id,building_id,house_id,floor,operator,date,time,remarks,sync_flag) VALUES (?,?,?,?,?,?,?,?,?)');
      stmt.run(req.siteId, d.building_id, null, d.floor, d.operator, d.date, d.time, d.remarks, 'f');
    } else if (type === 'cleaning') {
      stmt = db.prepare('INSERT INTO cleaning_records (site_id,building_id,house_id,floor,phase,progress,operator,date,time,remarks,photo,sync_flag) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
      stmt.run(req.siteId, d.building_id, d.house_id, d.floor, d.phase, d.progress, d.operator, d.date, d.time, d.remarks, d.photo || null, 'f');
    } else if (type === 'unloading') {
      stmt = db.prepare('INSERT INTO unloading_records (site_id,building_id,house_id,floor,phase,progress,operator,date,time,remarks,photo,sync_flag) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
      stmt.run(req.siteId, d.building_id, d.house_id, d.floor, d.phase, d.progress, d.operator, d.date, d.time, d.remarks, d.photo || null, 'f');
    } else if (type === 'misc') {
      if (!d.remarks) return res.status(400).json({ error: '기타 내역을 입력해주세요.' });
      stmt = db.prepare('INSERT INTO misc_records (site_id,building_id,date,remarks,operator,sync_flag) VALUES (?,?,?,?,?,?)');
      stmt.run(req.siteId, d.building_id || null, d.date, d.remarks, d.operator || null, 'f');
    }
    res.json({ success: true });
  });

  app.put(`/api/records/${type}/:id`, (req, res) => {
    const d = req.body;
    if (rejectIfClosed(res, req.siteId, d.date)) return;
    let stmt;
    if (type === 'oiling') {
      stmt = db.prepare('UPDATE oiling_records SET building_id=?, house_id=?, floor=?, operator=?, date=?, time=?, remarks=?, sync_flag=? WHERE id=? AND site_id=?');
      stmt.run(d.building_id, null, d.floor, d.operator, d.date, d.time, d.remarks, 'f', req.params.id, req.siteId);
    } else if (type === 'slab') {
      stmt = db.prepare('UPDATE slab_records SET building_id=?, house_id=?, floor=?, operator=?, date=?, time=?, remarks=?, sync_flag=? WHERE id=? AND site_id=?');
      stmt.run(d.building_id, null, d.floor, d.operator, d.date, d.time, d.remarks, 'f', req.params.id, req.siteId);
    } else if (type === 'cleaning') {
      stmt = db.prepare('UPDATE cleaning_records SET building_id=?, house_id=?, floor=?, phase=?, progress=?, operator=?, date=?, time=?, remarks=?, photo=?, sync_flag=? WHERE id=? AND site_id=?');
      stmt.run(d.building_id, d.house_id, d.floor, d.phase, d.progress, d.operator, d.date, d.time, d.remarks, d.photo || null, 'f', req.params.id, req.siteId);
    } else if (type === 'unloading') {
      stmt = db.prepare('UPDATE unloading_records SET building_id=?, house_id=?, floor=?, phase=?, progress=?, operator=?, date=?, time=?, remarks=?, photo=?, sync_flag=? WHERE id=? AND site_id=?');
      stmt.run(d.building_id, d.house_id, d.floor, d.phase, d.progress, d.operator, d.date, d.time, d.remarks, d.photo || null, 'f', req.params.id, req.siteId);
    } else if (type === 'misc') {
      if (!d.remarks) return res.status(400).json({ error: '기타 내역을 입력해주세요.' });
      stmt = db.prepare('UPDATE misc_records SET building_id=?, date=?, remarks=?, operator=?, sync_flag=? WHERE id=? AND site_id=?');
      stmt.run(d.building_id || null, d.date, d.remarks, d.operator || null, 'f', req.params.id, req.siteId);
    }
    res.json({ success: true });
  });

  app.delete(`/api/records/${type}/:id`, (req, res) => {
    const existing = db.prepare(`SELECT date FROM ${table} WHERE id=? AND site_id=?`).get(req.params.id, req.siteId);
    if (existing && rejectIfClosed(res, req.siteId, existing.date)) return;
    db.prepare(`DELETE FROM ${table} WHERE id=? AND site_id=?`).run(req.params.id, req.siteId);
    res.json({ success: true });
  });
});

// ── 본청 서명 완료 처리 (2차 청소)
app.patch('/api/records/cleaning/:id/sign', (req, res) => {
  const { sign_date } = req.body;
  if (!sign_date) return res.status(400).json({ error: 'sign_date 필수' });
  if (rejectIfClosed(res, req.siteId, sign_date)) return;
  try {
    db.prepare('UPDATE cleaning_records SET confirmed=1, sign_date=?, sync_flag=? WHERE id=? AND site_id=?')
      .run(sign_date, 'f', req.params.id, req.siteId);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 본청 서명 대기 목록 (2차 청소, 미서명)
app.get('/api/records/cleaning/pending-sign', (req, res) => {
  const siteId = req.siteId || 1;
  const rows = db.prepare(`
    SELECT c.id, c.building_id, c.house_id, c.phase, c.floor, c.date, c.operator,
           b.name as building_name, h.ho,
           (SELECT COUNT(DISTINCT h2.id) FROM houses h2 WHERE h2.building_id=c.building_id AND h2.site_id=? AND h2.floors >= c.floor AND (h2.start_floor IS NULL OR h2.start_floor <= c.floor)) as floor_total_units
    FROM cleaning_records c
    JOIN buildings b ON b.id = c.building_id
    LEFT JOIN houses h ON h.id = c.house_id
    WHERE c.site_id=? AND c.phase=2 AND (c.confirmed IS NULL OR c.confirmed=0)
    ORDER BY c.date DESC
  `).all(siteId, siteId);
  res.json(rows);
});

// ── 비용 관리
app.get('/api/costs', (req, res) => {
  const { month } = req.query;
  let query = 'SELECT * FROM cost_records WHERE site_id = ?';
  const params = [req.siteId];
  if (month) { query += ' AND strftime(\'%Y-%m\', date) = ?'; params.push(month); }
  query += ' ORDER BY date DESC';
  res.json(db.prepare(query).all(...params));
});

app.post('/api/costs', (req, res) => {
  const { date, description, vendor, amount, notes, category } = req.body;
  const result = db.prepare('INSERT INTO cost_records (site_id,date,description,vendor,amount,notes,category,sync_flag) VALUES (?,?,?,?,?,?,?,?)').run(req.siteId, date, description, vendor, amount, notes, category || 'general', 'f');
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/costs/:id', (req, res) => {
  const { date, description, vendor, amount, notes, category } = req.body;
  if (rejectIfClosed(res, req.siteId, date)) return;
  db.prepare('UPDATE cost_records SET date=?,description=?,vendor=?,amount=?,notes=?,category=?,sync_flag=? WHERE id=? AND site_id=?').run(date, description, vendor, amount, notes, category, 'f', req.params.id, req.siteId);
  res.json({ success: true });
});

app.delete('/api/costs/:id', (req, res) => {
  const existing = db.prepare('SELECT date FROM cost_records WHERE id=? AND site_id=?').get(req.params.id, req.siteId);
  if (existing && rejectIfClosed(res, req.siteId, existing.date)) return;
  db.prepare('DELETE FROM cost_records WHERE id=? AND site_id=?').run(req.params.id, req.siteId);
  res.json({ success: true });
});

// ── 인원 관리
app.get('/api/personnel', (req, res) => {
  const { month, date } = req.query;
  let query = 'SELECT * FROM personnel_records WHERE site_id = ?';
  const params = [req.siteId];
  if (month) { query += ' AND strftime(\'%Y-%m\', date) = ?'; params.push(month); }
  if (date) { query += ' AND date = ?'; params.push(date); }
  query += ' ORDER BY date DESC, name';
  res.json(db.prepare(query).all(...params));
});

app.post('/api/personnel', (req, res) => {
  const { name, date, work_hours, ot_hours, night_hours, memo, breakfast, lunch } = req.body;
  if (rejectIfClosed(res, req.siteId, date)) return;
  console.log('[POST /api/personnel] body:', JSON.stringify(req.body));
  console.log('[POST /api/personnel] values:', { name, date, breakfast, lunch, bfSaved: breakfast ?? 1, lunchSaved: lunch ?? 1 });
  const result = db.prepare('INSERT INTO personnel_records (site_id,name,date,work_hours,ot_hours,night_hours,memo,breakfast,lunch,sync_flag) VALUES (?,?,?,?,?,?,?,?,?,?)').run(req.siteId, name, date, work_hours || 8, ot_hours || 0, night_hours || 0, memo || '', breakfast ?? 1, lunch ?? 1, 'f');
  console.log('[POST /api/personnel] inserted id:', result.lastInsertRowid);
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/personnel/:id', (req, res) => {
  const { name, date, work_hours, ot_hours, night_hours, memo, breakfast, lunch } = req.body;
  if (rejectIfClosed(res, req.siteId, date)) return;
  console.log('[PUT /api/personnel/:id] id:', req.params.id, 'body:', JSON.stringify(req.body));
  console.log('[PUT /api/personnel/:id] values:', { name, breakfast, lunch, bfSaved: breakfast ?? 1, lunchSaved: lunch ?? 1 });
  db.prepare('UPDATE personnel_records SET name=?,date=?,work_hours=?,ot_hours=?,night_hours=?,memo=?,breakfast=?,lunch=?,sync_flag=? WHERE id=? AND site_id=?')
    .run(name, date, work_hours || 8, ot_hours || 0, night_hours || 0, memo || '', breakfast ?? 1, lunch ?? 1, 'f', req.params.id, req.siteId);
  res.json({ success: true });
});

app.delete('/api/personnel/:id', (req, res) => {
  const existing = db.prepare('SELECT date FROM personnel_records WHERE id=? AND site_id=?').get(req.params.id, req.siteId);
  if (existing && rejectIfClosed(res, req.siteId, existing.date)) return;
  db.prepare('DELETE FROM personnel_records WHERE id=? AND site_id=?').run(req.params.id, req.siteId);
  res.json({ success: true });
});

// ── 날씨 저장/조회
app.get('/api/weather', (req, res) => {
  const { date } = req.query;
  if (date) {
    const record = db.prepare('SELECT * FROM weather_records WHERE site_id=? AND date=?').get(req.siteId, date);
    return res.json(record || null);
  }
  const records = db.prepare('SELECT * FROM weather_records WHERE site_id=? ORDER BY date DESC LIMIT 90').all(req.siteId);
  res.json(records);
});

app.post('/api/weather', (req, res) => {
  const { date, temperature, wind_speed, precipitation, condition } = req.body;
  db.prepare('INSERT OR REPLACE INTO weather_records (site_id,date,temperature,wind_speed,precipitation,condition) VALUES (?,?,?,?,?,?)').run(req.siteId, date, temperature, wind_speed, precipitation, condition);
  res.json({ success: true });
});

// ── 일정 (캘린더)
app.get('/api/schedule-events', (req, res) => {
  const { month } = req.query;
  let query = 'SELECT * FROM schedule_events WHERE site_id = ?';
  const params = [req.siteId];
  if (month) { query += " AND strftime('%Y-%m', date) = ?"; params.push(month); }
  query += ' ORDER BY date ASC';
  res.json(db.prepare(query).all(...params));
});

app.post('/api/schedule-events', (req, res) => {
  const { title, memo, date, all_day, category, created_by } = req.body;
  const result = db.prepare('INSERT INTO schedule_events (site_id,title,memo,date,all_day,category,created_by,sync_flag) VALUES (?,?,?,?,?,?,?,?)')
    .run(req.siteId, title, memo || '', date, all_day ?? 1, category || 'general', created_by || '', 'f');
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/schedule-events/:id', (req, res) => {
  const { title, memo, date, all_day, category } = req.body;
  db.prepare('UPDATE schedule_events SET title=?,memo=?,date=?,all_day=?,category=?,sync_flag=? WHERE id=? AND site_id=?')
    .run(title, memo || '', date, all_day ?? 1, category || 'general', 'f', req.params.id, req.siteId);
  res.json({ success: true });
});

app.delete('/api/schedule-events/:id', (req, res) => {
  db.prepare('DELETE FROM schedule_events WHERE id=? AND site_id=?').run(req.params.id, req.siteId);
  res.json({ success: true });
});

// 모바일 삭제가 동기화(pull-delete)로 반영될 때 남긴 이력 조회/복구
app.get('/api/schedule-events/deleted', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '관리자만 삭제 이력을 조회할 수 있습니다.' });
  }
  const rows = db.prepare('SELECT * FROM schedule_events_deleted_archive WHERE site_id=? AND restored_at IS NULL ORDER BY deleted_at DESC').all(req.siteId);
  res.json(rows);
});

app.post('/api/schedule-events/deleted/:archiveId/restore', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '관리자만 삭제된 일정을 복구할 수 있습니다.' });
  }
  const archived = db.prepare('SELECT * FROM schedule_events_deleted_archive WHERE archive_id=? AND site_id=? AND restored_at IS NULL').get(req.params.archiveId, req.siteId);
  if (!archived) {
    return res.status(404).json({ error: '복구할 이력을 찾을 수 없습니다.' });
  }
  // 원래 id는 재사용하지 않음 — 그 사이 모바일이 같은 id를 다시 만들었을 수 있어 충돌을 피함
  const result = db.prepare('INSERT INTO schedule_events (site_id,title,memo,date,all_day,category,created_by,sync_flag) VALUES (?,?,?,?,?,?,?,?)')
    .run(archived.site_id, archived.title, archived.memo, archived.date, archived.all_day, archived.category, archived.created_by, 'f');
  db.prepare("UPDATE schedule_events_deleted_archive SET restored_at = datetime('now','localtime') WHERE archive_id=?").run(archived.archive_id);
  res.json({ id: result.lastInsertRowid });
});

// ── 비상 연락망
app.get('/api/emergency', (req, res) => {
  res.json(db.prepare('SELECT * FROM emergency_contacts WHERE site_id=? ORDER BY sort_order').all(req.siteId));
});

app.post('/api/emergency', (req, res) => {
  const { category, name, phone, role } = req.body;
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM emergency_contacts WHERE site_id=?').get(req.siteId);
  const result = db.prepare('INSERT INTO emergency_contacts (site_id,category,name,phone,role,sort_order) VALUES (?,?,?,?,?,?)').run(req.siteId, category, name, phone, role, (maxOrder.m || 0) + 1);
  res.json({ id: result.lastInsertRowid });
});

app.delete('/api/emergency/:id', (req, res) => {
  db.prepare('DELETE FROM emergency_contacts WHERE id=? AND site_id=?').run(req.params.id, req.siteId);
  res.json({ success: true });
});

// ── 작업자 기준정보
app.get('/api/workers', (req, res) => {
  const { status, team } = req.query;
  let query = 'SELECT * FROM workers WHERE site_id = ?';
  const params = [req.siteId];
  if (status) { query += ' AND status=?'; params.push(status); }
  if (team) { query += ' AND team=?'; params.push(team); }
  query += ' ORDER BY team, role DESC, name';
  res.json(db.prepare(query).all(...params));
});

app.post('/api/workers', (req, res) => {
  const { name, phone, role, team, specialty, status, memo, unit_price, price_date } = req.body;
  const result = db.prepare(
    'INSERT INTO workers (site_id,name,phone,role,team,specialty,status,memo,sync_flag) VALUES (?,?,?,?,?,?,?,?,?)'
  ).run(req.siteId, name, phone || '', role || 'worker', team || '', specialty || '', status || 'active', memo || '', 'f');
  // 단가 자동 등록
  if (unit_price && parseInt(unit_price) > 0) {
    const eDate = price_date || dayjs().format('YYYY-MM-DD');
    db.prepare(`INSERT INTO worker_wage_history (site_id,worker_name,effective_date,unit_price) VALUES (?,?,?,?)
      ON CONFLICT(site_id,worker_name,effective_date) DO UPDATE SET unit_price=excluded.unit_price`)
      .run(req.siteId, name, eDate, parseInt(unit_price));
  }
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/workers/:id', (req, res) => {
  const { name, phone, role, team, specialty, status, memo, unit_price, price_date } = req.body;
  db.prepare(
    'UPDATE workers SET name=?,phone=?,role=?,team=?,specialty=?,status=?,memo=?,sync_flag=? WHERE id=? AND site_id=?'
  ).run(name, phone || '', role || 'worker', team || '', specialty || '', status || 'active', memo || '', 'f', req.params.id, req.siteId);
  // 단가 자동 등록
  if (unit_price && parseInt(unit_price) > 0) {
    const eDate = price_date || dayjs().format('YYYY-MM-DD');
    db.prepare(`INSERT INTO worker_wage_history (site_id,worker_name,effective_date,unit_price) VALUES (?,?,?,?)
      ON CONFLICT(site_id,worker_name,effective_date) DO UPDATE SET unit_price=excluded.unit_price`)
      .run(req.siteId, name, eDate, parseInt(unit_price));
  }
  res.json({ success: true });
});

app.delete('/api/workers/:id', (req, res) => {
  db.prepare('DELETE FROM workers WHERE id=? AND site_id=?').run(req.params.id, req.siteId);
  res.json({ success: true });
});

// ── 공수 가중치 계산 로직 (현장 실무 적용) ──
const getWeight = (ot_h, night_h) => {
  const extra = (ot_h || 0) + (night_h || 0);
  if (extra >= 4) return 1.0;
  if (extra >= 2) return 0.5;
  if (extra >= 1) return 0.1;
  return 0;
};

// ── 월별 마감 (Monthly Closing) ──
app.get('/api/closing/monthly', (req, res) => {
  const { month, include_foreman = 'true', price_mode = 'payment' } = req.query; // format: YYYY-MM
  if (!month) return res.status(400).json({ error: 'month parameter is required' });
  const includeForeman = include_foreman !== 'false';
  const usesBilling = price_mode === 'billing';

  // 1. Get all personnel records for the month
  const records = db.prepare(`
    SELECT p.name, p.date, p.work_hours, p.ot_hours, p.night_hours
    FROM personnel_records p
    LEFT JOIN workers w ON w.name=p.name AND w.site_id=p.site_id
    WHERE p.site_id = ? AND strftime('%Y-%m', p.date) = ?
    ${includeForeman ? '' : "AND (w.role IS NULL OR w.role != 'foreman')"}
  `).all(req.siteId, month);

  // Group by worker name
  const summaryMap = {};

  records.forEach(r => {
    if (!summaryMap[r.name]) {
      // Find the most recent unit_price(지급)/billing_rate(청구) on or before the end of the month
      const endOfMonth = dayjs(month).endOf('month').format('YYYY-MM-DD');
      const priceRow = db.prepare(`
        SELECT unit_price, billing_rate FROM worker_wage_history
        WHERE site_id = ? AND worker_name = ? AND effective_date <= ?
        ORDER BY effective_date DESC LIMIT 1
      `).get(req.siteId, r.name, endOfMonth);

      summaryMap[r.name] = {
        name: r.name,
        unit_price: priceRow ? (usesBilling ? (priceRow.billing_rate || 0) : priceRow.unit_price) : 0,
        total_md: 0,
        daily: {}
      };
    }

    // Calculate MD (현장 실무 로직 적용)
    const baseMD = (r.work_hours || 0) / 8.0;
    const extraMD = getWeight(r.ot_hours, r.night_hours);
    const dailyMD = baseMD + extraMD;

    const day = parseInt(r.date.split('-')[2], 10);
    summaryMap[r.name].daily[day] = (summaryMap[r.name].daily[day] || 0) + dailyMD;
    summaryMap[r.name].total_md += dailyMD;
  });

  const summary = Object.values(summaryMap).map(worker => ({
    ...worker,
    total_amount: Math.round(worker.total_md * worker.unit_price)
  }));

  summary.sort((a, b) => a.name.localeCompare(b.name));

  res.json(summary);
});

app.get('/api/export/closing', (req, res) => {
  const { month, include_foreman = 'true', price_mode = 'payment' } = req.query;
  if (!month) return res.status(400).json({ error: 'month parameter is required' });
  const includeForeman = include_foreman !== 'false';
  const usesBilling = price_mode === 'billing';

  try {
    const records = db.prepare(`
      SELECT p.name, p.date, p.work_hours, p.ot_hours, p.night_hours
      FROM personnel_records p
      LEFT JOIN workers w ON w.name=p.name AND w.site_id=p.site_id
      WHERE p.site_id = ? AND strftime('%Y-%m', p.date) = ?
      ${includeForeman ? '' : "AND (w.role IS NULL OR w.role != 'foreman')"}
    `).all(req.siteId, month);

    const summaryMap = {};
    const endOfMonth = dayjs(month).endOf('month').format('YYYY-MM-DD');
    const daysInMonth = dayjs(month).daysInMonth();

    records.forEach(r => {
      if (!summaryMap[r.name]) {
        const priceRow = db.prepare(`
          SELECT unit_price, billing_rate FROM worker_wage_history
          WHERE site_id = ? AND worker_name = ? AND effective_date <= ?
          ORDER BY effective_date DESC LIMIT 1
        `).get(req.siteId, r.name, endOfMonth);

        summaryMap[r.name] = {
          name: r.name,
          unit_price: priceRow ? (usesBilling ? (priceRow.billing_rate || 0) : priceRow.unit_price) : 0,
          total_md: 0,
          daily: {}
        };
      }
      
      // Calculate MD (현장 실무 로직 적용)
      const baseMD = (r.work_hours || 0) / 8.0;
      const extraMD = getWeight(r.ot_hours, r.night_hours);
      const dailyMD = baseMD + extraMD;
      
      const day = parseInt(r.date.split('-')[2], 10);
      summaryMap[r.name].daily[day] = (summaryMap[r.name].daily[day] || 0) + dailyMD;
      summaryMap[r.name].total_md += dailyMD;
    });

    const summary = Object.values(summaryMap).sort((a, b) => a.name.localeCompare(b.name));

    // Excel Data preparation
    const excelData = summary.map(worker => {
      const row = { '작업자 이름': worker.name };
      for (let i = 1; i <= daysInMonth; i++) {
        row[`${i}일`] = worker.daily[i] ? Number(worker.daily[i].toFixed(3)) : '';
      }
      row['총 공수'] = Number(worker.total_md.toFixed(3));
      row[usesBilling ? '적용 단가(청구)' : '적용 단가(지급)'] = worker.unit_price;
      row[usesBilling ? '총 청구액' : '총 노무비'] = Math.round(worker.total_md * worker.unit_price);
      return row;
    });

    const worksheet = xlsx.utils.json_to_sheet(excelData);
    
    // Make headers bolder or just use simple json_to_sheet
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, '월별 마감');

    const excelBuffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'buffer' });

    res.setHeader('Content-Disposition', `attachment; filename="closing_${month}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(excelBuffer);

  } catch (error) {
    console.error('Excel Export Error:', error);
    res.status(500).json({ error: '엑셀 파일 생성 중 오류가 발생했습니다.' });
  }
});

// ── 단가 관리 (변동 이력 기반) ──
app.get('/api/worker-prices', (req, res) => {
  const { worker_name, date, month } = req.query;
  
  if (worker_name && date) {
    // 특정 날짜의 유효 단가 조회
    const row = db.prepare(`
      SELECT unit_price FROM worker_wage_history 
      WHERE site_id = ? AND worker_name = ? AND effective_date <= ? 
      ORDER BY effective_date DESC LIMIT 1
    `).get(req.siteId, worker_name, date);
    return res.json({ unit_price: row ? row.unit_price : 0 });
  }

  if (month) {
    // 특정 월 말일 기준 각 작업자의 최신 유효 단가 조회 (과거 데이터 포함)
    const lastDay = dayjs(month).endOf('month').format('YYYY-MM-DD');
    const rows = db.prepare(`
      SELECT w1.* FROM worker_wage_history w1
      WHERE w1.site_id = ? AND w1.effective_date <= ?
      AND w1.effective_date = (
        SELECT MAX(effective_date) FROM worker_wage_history w2
        WHERE w2.site_id = w1.site_id AND w2.worker_name = w1.worker_name AND w2.effective_date <= ?
      )
    `).all(req.siteId, lastDay, lastDay);
    return res.json(rows);
  }

  res.json([]);
});

app.post('/api/worker-prices', authMiddleware, (req, res) => {
  const { worker_name, effective_date, unit_price, billing_rate } = req.body;
  const stmt = db.prepare(`
    INSERT INTO worker_wage_history (site_id, worker_name, effective_date, unit_price, billing_rate)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(site_id, worker_name, effective_date) DO UPDATE SET unit_price=excluded.unit_price, billing_rate=excluded.billing_rate
  `);
  stmt.run(req.siteId, worker_name, effective_date, unit_price, billing_rate || 0);
  res.json({ success: true });
});

app.get('/api/worker-prices/history/:name', (req, res) => {
  const rows = db.prepare('SELECT * FROM worker_wage_history WHERE site_id = ? AND worker_name = ? ORDER BY effective_date DESC')
    .all(req.siteId, req.params.name);
  res.json(rows);
});

app.delete('/api/worker-prices/:id', authMiddleware, (req, res) => {
  db.prepare('DELETE FROM worker_wage_history WHERE id = ? AND site_id = ?').run(req.params.id, req.siteId);
  res.json({ success: true });
});

app.get('/api/worker-prices/all', (req, res) => {
  const rows = db.prepare('SELECT * FROM worker_wage_history ORDER BY worker_name, effective_date DESC').all();
  res.json(rows);
});

// ── 현장별 손익 계산 (청구단가-지급단가 차액 + 기름값) — 화천현장 등 site_config로 켠 현장 전용 ──
app.get('/api/analysis/site-profit', (req, res) => {
  const { month } = req.query; // YYYY-MM
  if (!month) return res.status(400).json({ error: 'month 파라미터 필요' });
  const siteId = req.siteId;
  const endOfMonth = dayjs(month).endOf('month').format('YYYY-MM-DD');

  // 인건비 블록(calculateMonthlyAnalysisData)과 동일한 MD 계산 로직 — 팀장 제외 없이 전원 포함
  const personnelRows = db.prepare(`
    SELECT name, date, work_hours, ot_hours, night_hours
    FROM personnel_records
    WHERE site_id=? AND strftime('%Y-%m', date)=?
    ORDER BY name, date
  `).all(siteId, month);

  const workerMap = {};
  personnelRows.forEach(r => {
    if (!workerMap[r.name]) {
      const priceRow = db.prepare(`
        SELECT unit_price, billing_rate FROM worker_wage_history
        WHERE site_id=? AND worker_name=? AND effective_date<=?
        ORDER BY effective_date DESC LIMIT 1
      `).get(siteId, r.name, endOfMonth);
      workerMap[r.name] = {
        name: r.name,
        unit_price: priceRow ? priceRow.unit_price : 0,
        billing_rate: priceRow ? (priceRow.billing_rate || 0) : 0,
        total_md: 0,
      };
    }
    const baseMD = (r.work_hours || 0) / 8.0;
    const extraMD = getWeight(r.ot_hours, r.night_hours);
    workerMap[r.name].total_md += baseMD + extraMD;
  });

  const workers = Object.values(workerMap).map(w => ({
    ...w,
    payment_amount: Math.round(w.total_md * w.unit_price),
    billing_amount: Math.round(w.total_md * w.billing_rate),
    margin: Math.round(w.total_md * w.billing_rate) - Math.round(w.total_md * w.unit_price),
  })).sort((a, b) => a.name.localeCompare(b.name));

  const { attendance_days: attendanceDays } = db.prepare(`
    SELECT COUNT(DISTINCT date) as attendance_days FROM personnel_records
    WHERE site_id=? AND strftime('%Y-%m', date)=?
  `).get(siteId, month);

  const fuelCostRow = db.prepare(`SELECT value FROM site_config WHERE site_id=? AND key='fuel_cost_per_day'`).get(siteId);
  const fuelCostPerDay = fuelCostRow ? (parseInt(fuelCostRow.value) || 0) : 60000;
  const fuelTotal = (attendanceDays || 0) * fuelCostPerDay;

  const marginTotal = workers.reduce((s, w) => s + w.margin, 0);
  const paymentTotal = workers.reduce((s, w) => s + w.payment_amount, 0);
  const billingTotal = workers.reduce((s, w) => s + w.billing_amount, 0);

  res.json({
    month,
    workers,
    attendance_days: attendanceDays || 0,
    fuel_cost_per_day: fuelCostPerDay,
    fuel_total: fuelTotal,
    margin_total: marginTotal,
    payment_total: paymentTotal,
    billing_total: billingTotal,
    net_profit: marginTotal - fuelTotal,
  });
});

// ── 현장(Site) 관리 API ──
app.get('/api/sites', authMiddleware, (req, res) => {
  console.log(`[API] Sites requested by user: ${req.user.email}`);
  const rows = db.prepare('SELECT * FROM sites WHERE status = \'active\'').all();
  console.log(`[API] Found ${rows.length} active sites`);
  res.json(rows);
});

app.post('/api/sites', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '관리자만 현장을 추가할 수 있습니다.' });
  const { name, primary_contractor, subcontractor, address, start_date, end_date } = req.body;
  const result = db.prepare(`
    INSERT INTO sites (name, primary_contractor, subcontractor, address, start_date, end_date, sync_flag)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, primary_contractor, subcontractor, address, start_date, end_date, 'f');
  res.json({ id: result.lastInsertRowid });
});

app.get('/api/sites/:id', authMiddleware, (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  res.json(row);
});

app.put('/api/sites/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: '관리자만 현장 정보를 수정할 수 있습니다.' });
  const { name, primary_contractor, subcontractor, address, start_date, end_date } = req.body;
  db.prepare(`
    UPDATE sites
    SET name=?, primary_contractor=?, subcontractor=?, address=?, start_date=?, end_date=?, sync_flag=?
    WHERE id=?
  `).run(name, primary_contractor, subcontractor, address, start_date, end_date, 'f', req.params.id);
  res.json({ success: true });
});
app.post('/api/log-error', (req, res) => {
  const { error, info } = req.body;
  logErrorToFile(`Message: ${error}\nInfo: ${info}`, 'Frontend');
  res.json({ success: true });
});

// ── 헬스체크
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// ── 글로벌 에러 핸들러 및 예외 처리 ──
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);
  logErrorToFile(err, 'Server');
  res.status(500).json({ error: '백엔드 서버 오류가 발생했습니다.' });
});

process.on('uncaughtException', (err) => {
  logErrorToFile(err, 'Critical (Uncaught)');
  console.error('❌ Critical Uncaught Exception:', err);
  // 치명적인 오류의 경우 기록 후 프로세스 종료가 안전할 수 있음
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  logErrorToFile(reason, 'Critical (Rejection)');
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// ── 클라우드 동기화 API ──
const { exec } = require('child_process');
let isSyncRunning = false;

app.post('/api/sync/run', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '관리자만 동기화를 실행할 수 있습니다.' });
  }

  if (isSyncRunning) {
    return res.status(409).json({ error: '현재 다른 동기화 작업이 진행 중입니다. 잠시 후 다시 시도해주세요.' });
  }

  isSyncRunning = true;
  req.setTimeout(0); // 타임아웃 무제한 대기

  const scriptPath = path.join(__dirname, '../../clearing-supabase-migration');

  // 버퍼 10MB 할당 (maxBuffer: 10485760)
  const nodePath = process.execPath;
  const logFile = path.join(__dirname, '../debug_sync/last_execution.log');

  exec(`"${nodePath}" compare-and-sync.js`, { cwd: scriptPath, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
    isSyncRunning = false;
    
    // 디버그 로그 저장
    const debugContent = `--- SYNC EXECUTION LOG ---\nTimestamp: ${new Date().toLocaleString()}\nError: ${JSON.stringify(error)}\nStderr: ${stderr}\nStdout: ${stdout}\n`;
    try { fs.writeFileSync(logFile, debugContent); } catch(e) {}

    // stderr가 있어도 stdout에 마크다운 테이블 구조가 있으면 파싱 시도 (인코딩 안전 처리)
    if (error && !stdout.includes('| :---')) {
      console.error('Sync Fatal Error:', error.message);
      return res.status(500).json({ error: stderr || error.message || '동기화 시스템이 응답하지 않습니다.' });
    }

    try {
      const lines = stdout.split('\n');
      const results = [];
      let separatorCount = 0; // '| :---' 구분선 등장 횟수 카운트
      let isParsingStatusTable = false;

      for (const line of lines) {
        // 마크다운 구분자(| :---) 등장 횟수 추적
        // 1번째: "2. 추가/수정" 테이블 헤더 → 무시
        // 2번째: "3. 상태 점검" 테이블 헤더 → 여기서부터 파싱 시작
        if (line.includes('| :---')) {
          separatorCount++;
          if (separatorCount === 2) {
            isParsingStatusTable = true;
          }
          continue;
        }
        
        if (isParsingStatusTable && line.startsWith('|')) {
          const cols = line.split('|').map(s => s.trim()).filter(s => s !== '');
          if (cols.length >= 4 && !line.includes('테이블명')) {
            const localVal = parseInt((cols[1] || '0').replace(/[^0-9]/g, ''));
            const remoteVal = parseInt((cols[2] || '0').replace(/[^0-9]/g, ''));
            results.push({
              table: cols[0],
              local: isNaN(localVal) ? 0 : localVal,
              remote: isNaN(remoteVal) ? 0 : remoteVal,
              status: cols[3] || '알 수 없음'
            });
          }
        }
      }

      if (results.length === 0) {
        console.error('Sync Parsing Failed. Stdout:', stdout);
        return res.status(500).json({ error: '동기화 결과를 읽어올 수 없습니다. 서버 로그를 확인해주세요.' });
      }

      res.json({ success: true, results, log: stdout });
    } catch (err) {
      console.error('Parsing Error:', err);
      res.status(500).json({ error: '결과 처리 중 오류가 발생했습니다: ' + err.message });
    }
  });
});


// ── 월 마감 잠금 헬퍼 ──
// 해당 siteId + month 조합이 마감된 경우 true 반환
function isMonthClosed(siteId, month) {
  return !!db.prepare('SELECT id FROM monthly_closings WHERE site_id=? AND month=?').get(siteId, month);
}

// record의 날짜(YYYY-MM-DD)에서 월을 추출해 마감 여부 체크, 마감이면 res에 403 전송 후 true 반환
function rejectIfClosed(res, siteId, dateStr) {
  if (!dateStr) return false;
  const month = dateStr.slice(0, 7);
  if (isMonthClosed(siteId, month)) {
    res.status(403).json({ error: `${month} 은 마감 완료된 월입니다. 수정하려면 마감 취소 후 진행하세요.` });
    return true;
  }
  return false;
}

// ── 월 마감 API ──
app.get('/api/monthly-closings', (req, res) => {
  const rows = db.prepare('SELECT * FROM monthly_closings WHERE site_id=? ORDER BY month DESC').all(req.siteId);
  res.json(rows);
});

app.post('/api/monthly-closings', (req, res) => {
  const { month } = req.body;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return res.status(400).json({ error: 'month 형식 오류 (YYYY-MM)' });
  try {
    db.prepare('INSERT OR IGNORE INTO monthly_closings (site_id, month) VALUES (?, ?)')
      .run(req.siteId, month);

    // 마감 시점에 청구 확정된 (건물+층+차수)를 billed_floors 원장에 영구히 기록 —
    // 이후 같은 층에 재청소/재서명이 생겨도 다시 청구되지 않도록 함(가격은 필요 없어 0으로 계산).
    const data = calculateMonthlyAnalysisData(req.siteId, month, 0, 0, 'split', 0);
    const insertBilled = db.prepare(`
      INSERT OR IGNORE INTO billed_floors (site_id, building_id, floor, phase, billed_month)
      VALUES (?, ?, ?, ?, ?)
    `);
    (data.cleaning.details || []).filter(d => d.is_billable).forEach(d => {
      insertBilled.run(req.siteId, d.building_id, d.floor, d.phase, month);
    });

    res.json({ success: true, month });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/monthly-closings/:month', (req, res) => {
  db.prepare('DELETE FROM monthly_closings WHERE site_id=? AND month=?').run(req.siteId, req.params.month);
  // 마감 취소 시 그 달에 기록된 청구 원장도 함께 해제 — 재수정 후 다시 마감하면 새로 기록됨
  db.prepare('DELETE FROM billed_floors WHERE site_id=? AND billed_month=?').run(req.siteId, req.params.month);
  res.json({ success: true });
});

// 같은 세대(house_id)+층에 2차 청소(phase=2) 기록이 여러 번(재청소/재서명) 있을 때,
// 완료 여부·기성 계산에는 가장 나중에 입력된(id가 가장 큰) 기록 하나만 사용하고
// 그보다 앞서 발생한 기록은 참고 이력으로만 남긴다. phase!=2 이거나 house_id가 없는
// 행(구단위 일괄 입력 등)은 그대로 통과시킨다.
function keepLatestPhase2(rows) {
  const latestByKey = {};
  const passthrough = [];
  rows.forEach(r => {
    if (r.phase !== 2 || r.house_id == null) { passthrough.push(r); return; }
    const key = `${r.house_id}_${r.floor}`;
    if (!latestByKey[key] || r.id > latestByKey[key].id) latestByKey[key] = r;
  });
  return [...passthrough, ...Object.values(latestByKey)];
}

// 동 이름 숫자 기준 정렬 유틸리티
const sortByBuildingName = (list) => {
  return [...list].sort((a, b) => {
    const numA = parseInt(a.building.replace(/[^0-9]/g, '')) || 0;
    const numB = parseInt(b.building.replace(/[^0-9]/g, '')) || 0;
    return numA - numB;
  });
};

// ── 월별 통합 정산 분석 데이터 계산 함수 (공통) ──
const calculateMonthlyAnalysisData = (siteId, month, oilingPrice, cleaningPrice, periodMode, slabPrice = 0) => {
  const CONTRACT_START_DATE = '2026-04-16'; // 도급 시작일 고정

  // 모든 건물 + 기준층 정보
  const buildings = db.prepare('SELECT * FROM buildings WHERE site_id=? ORDER BY id').all(siteId);
  const houses = db.prepare('SELECT * FROM houses WHERE site_id=? ORDER BY building_id, line').all(siteId);
  const buildingMap = {};
  buildings.forEach(b => { buildingMap[b.id] = { ...b, houses: houses.filter(h => h.building_id === b.id) }; });

  // 층 구간별 결합과금(청소+박리 동시완료) 대상 건물 — 이 건물들은 아래 갱폼/세대청소
  // 개별 수입 집계에서 제외되고, 별도 combo 섹션에서 계산된다.
  const comboBuildingIds = new Set(buildings.filter(b => (b.combo_tier_floor || 0) > 0).map(b => b.id));

  // 마감 시점에 이미 청구 확정된 (건물+층+차수) → 귀속월 맵 — "이 달보다 이전 달"에 이미
  // 청구된 층만 재청구를 막는다(같은 달 자기 자신까지 제외해버리면 그 달 최초 조회 시
  // 청소 수입이 0으로 보이는 버그가 생김). 마감은 잠금 플래그일 뿐 금액을 스냅샷으로
  // 고정하지 않아, 마감 후 데이터 변경이 과거 정산 결과를 조용히 바꾸는 문제를 막기 위함.
  const billedFloorMonthMap = new Map(
    db.prepare('SELECT building_id, floor, phase, billed_month FROM billed_floors WHERE site_id=?').all(siteId)
      .map(r => [`${r.building_id}_${r.floor}_${r.phase}`, r.billed_month])
  );

  // ── 갱폼 박리제 쿼리
  let oilingWhere = `strftime('%Y-%m', o.date) = ?`;
  const oilingParams = [siteId, month];
  if (periodMode === 'split') {
    oilingWhere += ` AND o.date >= ?`;
    oilingParams.push(CONTRACT_START_DATE);
  }
  const oilingRows = db.prepare(`
    SELECT o.id, o.date, o.floor, o.building_id,
      b.name as bname, b.oiling_base_floor,
      (SELECT COUNT(*) FROM houses WHERE building_id=o.building_id AND site_id=? AND floors >= o.floor) as unit_count
    FROM oiling_records o
    JOIN buildings b ON b.id=o.building_id
    WHERE o.site_id=? AND ${oilingWhere}
    ORDER BY o.date, b.name, o.floor
  `).all(siteId, ...oilingParams);

  const oilingByBuilding = {};
  const oilingDetails = [];
  oilingRows.forEach(r => {
    if (comboBuildingIds.has(r.building_id)) return; // 결합과금 건물은 별도 combo 섹션에서 계산
    const isBillable = r.floor > (r.oiling_base_floor || 0);
    const amount = isBillable ? r.unit_count * oilingPrice : 0;
    
    if (!oilingByBuilding[r.bname]) {
      oilingByBuilding[r.bname] = { building: r.bname, building_id: r.building_id, billable_amount: 0, total_units: 0, floors: [] };
    }
    
    // 금액 발생 여부와 관계없이 작업 내역 수집 (사용자 요청: 6동 등 제외 대상도 비고 표시)
    oilingByBuilding[r.bname].floors.push({ floor: r.floor, units: r.unit_count, amount, date: r.date, is_billable: isBillable });
    if (isBillable) {
      oilingByBuilding[r.bname].billable_amount += amount;
      oilingByBuilding[r.bname].total_units += r.unit_count;
    }
    
    oilingDetails.push({ id: r.id, date: r.date, building: r.bname, building_id: r.building_id, floor: r.floor, oiling_base_floor: r.oiling_base_floor, units: r.unit_count, is_billable: isBillable, amount });
  });

  // 비고 문자열 생성
  Object.values(oilingByBuilding).forEach(b => {
    b.remark = b.floors.map(f => `${f.floor}층(${f.units}세대)${f.is_billable ? '' : '(제외)'}`).join(', ');
  });
  
  const oilingListSorted = sortByBuildingName(Object.values(oilingByBuilding));
  const oilingTotal = oilingListSorted.reduce((s, b) => s + b.billable_amount, 0);

  // ── 슬라브 쿼리 (오일링과 동일 구조 — house_id/서명 개념 없이 건물+층 단위 1회성 기록)
  let slabWhere = `strftime('%Y-%m', s.date) = ?`;
  const slabParams = [siteId, month];
  if (periodMode === 'split') {
    slabWhere += ` AND s.date >= ?`;
    slabParams.push(CONTRACT_START_DATE);
  }
  const slabRows = db.prepare(`
    SELECT s.id, s.date, s.floor, s.building_id,
      b.name as bname, b.slab_base_floor,
      (SELECT COUNT(*) FROM houses WHERE building_id=s.building_id AND site_id=? AND floors >= s.floor) as unit_count
    FROM slab_records s
    JOIN buildings b ON b.id=s.building_id
    WHERE s.site_id=? AND ${slabWhere}
    ORDER BY s.date, b.name, s.floor
  `).all(siteId, ...slabParams);

  const slabByBuilding = {};
  const slabDetails = [];
  slabRows.forEach(r => {
    const isBillable = r.floor > (r.slab_base_floor || 0);
    const amount = isBillable ? r.unit_count * slabPrice : 0;

    if (!slabByBuilding[r.bname]) {
      slabByBuilding[r.bname] = { building: r.bname, building_id: r.building_id, billable_amount: 0, total_units: 0, floors: [] };
    }

    slabByBuilding[r.bname].floors.push({ floor: r.floor, units: r.unit_count, amount, date: r.date, is_billable: isBillable });
    if (isBillable) {
      slabByBuilding[r.bname].billable_amount += amount;
      slabByBuilding[r.bname].total_units += r.unit_count;
    }

    slabDetails.push({ id: r.id, date: r.date, building: r.bname, building_id: r.building_id, floor: r.floor, slab_base_floor: r.slab_base_floor, units: r.unit_count, is_billable: isBillable, amount });
  });

  Object.values(slabByBuilding).forEach(b => {
    b.remark = b.floors.map(f => `${f.floor}층(${f.units}세대)${f.is_billable ? '' : '(제외)'}`).join(', ');
  });

  const slabListSorted = sortByBuildingName(Object.values(slabByBuilding));
  const slabTotal = slabListSorted.reduce((s, b) => s + b.billable_amount, 0);

  // ── 세대청소 쿼리
  // 재청소(2차) 중복 기록이 월별 SQL 필터를 사이에 두고 서로 다른 달의 조회 결과로
  // 갈라지면, keepLatestPhase2를 각 달의 결과에 따로 적용해도 "이 달엔 예전 서명 기록만
  // 보이고, 재청소(미서명) 기록은 다른 달로 걸러져 경쟁 상대가 없는" 상황이 생겨
  // 낡은 서명이 계속 유효한 것처럼 집계될 수 있다. 그래서 사이트 전체 2차 청소 후보를
  // 먼저 모두 가져와 keepLatestPhase2로 전역 중복 제거를 한 뒤, 그 결과에서 월별로 나눈다.
  let cleaningBaseWhere = `c.site_id=?`;
  const cleaningBaseParams = [siteId];
  if (periodMode === 'split') {
    cleaningBaseWhere += ` AND c.date >= ?`;
    cleaningBaseParams.push(CONTRACT_START_DATE);
  }
  const allCleaningRows = keepLatestPhase2(db.prepare(`
    SELECT c.id, c.building_id, c.floor, c.phase, c.house_id, c.date, c.confirmed, c.sign_date,
      b.name as bname, b.cleaning_base_floor,
      (SELECT COUNT(DISTINCT h2.id) FROM houses h2 WHERE h2.building_id=c.building_id AND h2.site_id=? AND h2.floors >= c.floor AND (h2.start_floor IS NULL OR h2.start_floor <= c.floor)) as total_units
    FROM cleaning_records c
    JOIN buildings b ON b.id=c.building_id
    WHERE ${cleaningBaseWhere}
    ORDER BY b.name, c.floor, c.phase
  `).all(siteId, ...cleaningBaseParams));

  // 2차 청소는 서명일(sign_date) 기준, 1차는 청소일(date) 기준으로 월 귀속
  const currentMonthAttr = (r) => ((r.phase === 2 && r.confirmed === 1 && r.sign_date) ? r.sign_date : r.date).slice(0, 7);
  const cleaningRows = allCleaningRows.filter(r => currentMonthAttr(r) === month);

  // ── 이전 월에 이미 완료(정산)된 층/차수 집합 계산 ──
  const monthStart = month + '-01';
  // 2차 청소는 서명 완료(confirmed=1)된 것만 "이전에 완료"로 인정 — 서명일 기준으로 이전 월 판별, 1차는 청소일 기준
  const prevCleaningRows = allCleaningRows.filter(r => {
    if (r.floor <= 0) return false;
    if (r.phase === 2) {
      if (r.confirmed !== 1) return false;
      const attr = r.sign_date || r.date;
      return attr >= CONTRACT_START_DATE && attr < monthStart;
    }
    return r.date >= CONTRACT_START_DATE && r.date < monthStart;
  });

  const prevFloorMap = {};
  prevCleaningRows.forEach(r => {
    const key = `${r.building_id}_${r.floor}_${r.phase}`;
    if (!prevFloorMap[key]) prevFloorMap[key] = { building_id: r.building_id, floor: r.floor, phase: r.phase, cleaned: new Set(), confirmed: new Set() };
    const unitKey = r.house_id || `nohouse_${r.date}`;
    prevFloorMap[key].cleaned.add(unitKey);
    // 2차 청소는 서명 완료된 세대만 이전 기성으로 인정
    if (r.phase === 2 && r.confirmed === 1) prevFloorMap[key].confirmed.add(unitKey);
  });

  const prevCompleteSet = new Set();
  Object.entries(prevFloorMap).forEach(([key, data]) => {
    const totalUnits = houses.filter(h => h.building_id === data.building_id && h.floors >= data.floor && (h.start_floor || 1) <= data.floor).length;
    const countToCheck = data.phase === 2 ? data.confirmed.size : data.cleaned.size;
    if (totalUnits > 0 && countToCheck >= totalUnits) {
      prevCompleteSet.add(key);
    }
  });

  const cleaningFloorMap = {};
  const cleaningExtra = [];
  // 이번 달에 청소 활동이 있었던 층(동/층/차수) 키 집합 — 리포트에 표시할 대상 결정
  const activeFloorKeys = new Set();
  cleaningRows.forEach(r => {
    if (r.floor <= 0) {
      const label = r.floor === -1 ? 'B1층' : r.floor === -2 ? 'B2층' : `B${Math.abs(r.floor)}층`;
      cleaningExtra.push({ building: r.bname, building_id: r.building_id, floor: r.floor, phase: r.phase, date: r.date, label: `${label} 청소(${r.phase}차)` });
      return;
    }
    activeFloorKeys.add(`${r.bname}_${r.floor}_${r.phase}`);
  });

  // 기타 작업(misc_records)도 "기타 작업 내역(별도 청구)" 섹션에 합쳐서 보여준다 — 세대/층
  // 개념이 없는 자유 기록이라 금액 계산에는 넣지 않고, cleaning_extra와 동일한 정보성 목록으로만 취급.
  let miscWhere = `m.site_id=? AND strftime('%Y-%m', m.date)=?`;
  const miscParams = [siteId, month];
  if (periodMode === 'split') {
    miscWhere += ' AND m.date >= ?';
    miscParams.push(CONTRACT_START_DATE);
  }
  db.prepare(`
    SELECT m.date, m.building_id, m.remarks, b.name as bname
    FROM misc_records m
    LEFT JOIN buildings b ON b.id = m.building_id
    WHERE ${miscWhere}
    ORDER BY m.date
  `).all(...miscParams).forEach(r => {
    cleaningExtra.push({ building: r.bname || '미지정', building_id: r.building_id, floor: null, phase: null, date: r.date, label: r.remarks });
  });

  // 완료 여부(cleaned/confirmed 세대 수) 판단은 이번 달에 귀속된 기록만이 아니라, 계약
  // 시작일부터 이번 달 말까지 누적된 기록을 기준으로 한다. 같은 층 세대가 여러 달에
  // 걸쳐 나누어 청소되면(예: 6/20에 절반, 7/1에 나머지) 이번 달 몫만으로는 세대 수가
  // 채워지지 않아, 실제로는 다 끝난 층도 미완료로 잘못 표시되는 문제를 막기 위함.
  // (이미 이전 달에 완료·정산된 층은 prevCompleteSet/wasAlreadyBilled로 별도 제외한다.)
  const cumulativeRows = allCleaningRows.filter(r => r.floor > 0 && currentMonthAttr(r) <= month);
  cumulativeRows.forEach(r => {
    const key = `${r.bname}_${r.floor}_${r.phase}`;
    if (!activeFloorKeys.has(key)) return;
    if (!cleaningFloorMap[key]) {
      cleaningFloorMap[key] = {
        building: r.bname, building_id: r.building_id, floor: r.floor, phase: r.phase,
        cleaned_units: new Set(), confirmed_units: new Set(),
        total_units: r.total_units, date: r.date, base_floor: r.cleaning_base_floor,
      };
    }
    const unitKey = r.house_id || `nohouse_${r.date}`;
    cleaningFloorMap[key].cleaned_units.add(unitKey);
    // 2차 청소는 서명 완료(confirmed=1)된 세대만 별도 집계
    if (r.phase === 2 && r.confirmed === 1) {
      cleaningFloorMap[key].confirmed_units.add(unitKey);
    }
  });
  // 표시용 날짜는 실제 이번 달 활동 날짜로 갱신 (누적 집계와 별개로 최신 값 유지)
  cleaningRows.forEach(r => {
    if (r.floor <= 0) return;
    const key = `${r.bname}_${r.floor}_${r.phase}`;
    if (cleaningFloorMap[key]) cleaningFloorMap[key].date = r.date;
  });

  const cleaningByBuilding = {};
  const cleaningDetails = [];
  const seenFloorKeys = new Set();
  Object.values(cleaningFloorMap).forEach(f => {
    if (comboBuildingIds.has(f.building_id)) return; // 결합과금 건물은 별도 combo 섹션에서 계산
    const cleanedCount = f.cleaned_units.size;
    // 2차 청소는 서명 완료 세대 수 기준, 1차는 청소 완료 세대 수 기준
    const billableCount = f.phase === 2 ? f.confirmed_units.size : cleanedCount;
    const isComplete = billableCount >= f.total_units && f.total_units > 0;
    const floorKey = `${f.building_id}_${f.floor}_${f.phase}`;
    seenFloorKeys.add(floorKey);
    const billedMonth = billedFloorMonthMap.get(floorKey);
    const wasAlreadyBilled = prevCompleteSet.has(floorKey) || (billedMonth && billedMonth < month);
    // 원장에 "이 달"에 청구된 것으로 기록돼 있으면, 이후 재청소로 라이브 데이터의 완료 판정이
    // 훼손됐어도(예: 세대 일부가 다음 달로 재귀속) 그 달의 청구 사실은 원장 기준으로 그대로
    // 인정한다 — 세대수(total_units)는 재청소와 무관하게 건물 구성에서만 나오므로 고정값이다.
    const isBillable = billedMonth === month
      ? true
      : (isComplete && f.floor > (f.base_floor || 0) && !wasAlreadyBilled);
    const amount = isBillable ? f.total_units * cleaningPrice : 0;

    if (!cleaningByBuilding[f.building]) {
      cleaningByBuilding[f.building] = { building: f.building, building_id: f.building_id, billable_amount: 0, total_units: 0, floors: [] };
    }

    // 금액 제외 대상도 내역 수집
    cleaningByBuilding[f.building].floors.push({ floor: f.floor, phase: f.phase, units: f.total_units, amount, date: f.date, is_billable: isBillable });
    if (isBillable) {
      cleaningByBuilding[f.building].billable_amount += amount;
      cleaningByBuilding[f.building].total_units += f.total_units;
    }

    cleaningDetails.push({ building: f.building, building_id: f.building_id, floor: f.floor, phase: f.phase, cleaned: cleanedCount, confirmed: f.confirmed_units.size, total: f.total_units, is_complete: isComplete, is_billable: isBillable, already_billed: wasAlreadyBilled, amount, date: f.date });
  });

  // 원장에는 "이 달" 청구로 기록돼 있는데, 재청소로 인해 그 층이 이번 달 활동 목록(activeFloorKeys)
  // 자체에서 완전히 빠져 위 루프에 아예 나타나지 않는 경우를 대비한 보강 — 건물의 세대수만으로
  // 금액을 복원한다(houses 테이블 기준, cleaning_records 변경과 무관한 고정값).
  billedFloorMonthMap.forEach((billedMonth, floorKey) => {
    if (billedMonth !== month || seenFloorKeys.has(floorKey)) return;
    const [buildingIdStr, floorStr, phaseStr] = floorKey.split('_');
    const buildingId = parseInt(buildingIdStr);
    const floor = parseInt(floorStr);
    const phase = parseInt(phaseStr);
    const building = buildingMap[buildingId];
    if (!building || comboBuildingIds.has(buildingId)) return;
    const totalUnits = houses.filter(h => h.building_id === buildingId && h.floors >= floor && (h.start_floor || 1) <= floor).length;
    if (totalUnits <= 0) return;
    const amount = totalUnits * cleaningPrice;
    if (!cleaningByBuilding[building.name]) {
      cleaningByBuilding[building.name] = { building: building.name, building_id: buildingId, billable_amount: 0, total_units: 0, floors: [] };
    }
    cleaningByBuilding[building.name].floors.push({ floor, phase, units: totalUnits, amount, date: null, is_billable: true });
    cleaningByBuilding[building.name].billable_amount += amount;
    cleaningByBuilding[building.name].total_units += totalUnits;
    cleaningDetails.push({ building: building.name, building_id: buildingId, floor, phase, cleaned: totalUnits, confirmed: totalUnits, total: totalUnits, is_complete: true, is_billable: true, already_billed: false, amount, date: null });
  });

  Object.values(cleaningByBuilding).forEach(b => {
    b.remark = b.floors.map(f => `${f.floor}층(${f.phase}차)${f.is_billable ? '' : '(제외)'}`).join(', ');
  });
  
  const cleaningListSorted = sortByBuildingName(Object.values(cleaningByBuilding));
  const cleaningTotal = cleaningListSorted.reduce((s, b) => s + b.billable_amount, 0);

  // ── 층 구간별 결합과금(청소+박리 동시완료) — buildings.combo_tier_floor > 0인 건물 전용.
  // 세대청소/갱폼박리를 별개 수입으로 잡지 않고(위 두 루프에서 이미 제외됨), 한 층의
  // 갱폼박리 기록 존재 + 2차 세대청소 전 세대 서명완료가 모두 충족된 날을 그 층의 완료일로
  // 보고, 완료월에 해당 층 하나에 대해(경계층 이하: 저층단가 / 초과: 고층단가) 를 청구한다.
  // 완료일이 실제 데이터로부터 고정되므로 한 층은 정확히 한 달에만 귀속되어 월 이월 시
  // 중복청구가 자연히 방지된다(세대청소의 prevCompleteSet과 동일한 목적).
  const comboByBuilding = {};
  const comboDetails = [];
  if (comboBuildingIds.size > 0) {
    const comboIdList = [...comboBuildingIds];
    const comboPlaceholders = comboIdList.map(() => '?').join(',');

    // 갱폼박리는 세대수 체크 없이 "그 층 기록 존재"가 완료 기준이므로, 건물+층별 최초 기록일만 있으면 된다.
    let comboOilingWhere = `site_id=? AND building_id IN (${comboPlaceholders})`;
    const comboOilingParams = [siteId, ...comboIdList];
    if (periodMode === 'split') {
      comboOilingWhere += ' AND date >= ?';
      comboOilingParams.push(CONTRACT_START_DATE);
    }
    const comboOilingFirstDate = {};
    db.prepare(`SELECT building_id, floor, MIN(date) as first_date FROM oiling_records WHERE ${comboOilingWhere} GROUP BY building_id, floor`)
      .all(...comboOilingParams)
      .forEach(r => { comboOilingFirstDate[`${r.building_id}_${r.floor}`] = r.first_date; });

    // 2차 청소는 층 전체 세대가 서명완료된 시점을 찾아야 하므로, 세대별 서명일을 날짜순으로
    // 누적해가며 total_units에 도달하는 첫 날짜를 구한다(allCleaningRows는 이미 전체 기간 조회 + keepLatestPhase2 적용됨).
    const comboCleanRowsByFloor = {};
    allCleaningRows.forEach(r => {
      if (!comboBuildingIds.has(r.building_id)) return;
      if (r.phase !== 2 || r.confirmed !== 1 || !r.house_id) return;
      const key = `${r.building_id}_${r.floor}`;
      if (!comboCleanRowsByFloor[key]) comboCleanRowsByFloor[key] = { total_units: r.total_units, rows: [] };
      comboCleanRowsByFloor[key].rows.push(r);
    });
    const comboCleanCompleteDate = {};
    Object.entries(comboCleanRowsByFloor).forEach(([key, data]) => {
      if (!data.total_units || data.total_units <= 0) return;
      const sorted = [...data.rows].sort((a, b) => (a.sign_date || a.date).localeCompare(b.sign_date || b.date));
      const seen = new Set();
      for (const r of sorted) {
        seen.add(r.house_id);
        if (seen.size >= data.total_units) {
          comboCleanCompleteDate[key] = r.sign_date || r.date;
          break;
        }
      }
    });

    // 오일링과 청소 완료 시점이 모두 있는 층만 후보 — 늦게 끝난 쪽 날짜가 결합 완료일
    const comboFloorKeys = new Set([...Object.keys(comboOilingFirstDate), ...Object.keys(comboCleanCompleteDate)]);
    comboFloorKeys.forEach(key => {
      const oilDate = comboOilingFirstDate[key];
      const cleanDate = comboCleanCompleteDate[key];
      if (!oilDate || !cleanDate) return; // 둘 다 완료돼야 결합과금 대상
      const completeDate = oilDate > cleanDate ? oilDate : cleanDate;
      const completeMonth = completeDate.slice(0, 7);
      if (completeMonth !== month) return; // 다른 달에 완료 → 이번 달엔 청구하지 않음(중복청구 방지)

      const [buildingIdStr, floorStr] = key.split('_');
      const buildingId = parseInt(buildingIdStr);
      const floor = parseInt(floorStr);
      const building = buildingMap[buildingId];
      if (!building) return;

      const tierFloor = building.combo_tier_floor || 0;
      const isLowTier = floor <= tierFloor;
      const amount = isLowTier ? (building.combo_low_price || 0) : (building.combo_high_price || 0);

      if (!comboByBuilding[building.name]) {
        comboByBuilding[building.name] = { building: building.name, building_id: buildingId, billable_amount: 0, total_units: 0, floors: [] };
      }
      comboByBuilding[building.name].floors.push({ floor, tier: isLowTier ? '저층' : '고층', amount, date: completeDate, is_billable: true });
      comboByBuilding[building.name].billable_amount += amount;
      comboByBuilding[building.name].total_units += 1; // "완료 층 수" 집계 용도

      comboDetails.push({ building: building.name, building_id: buildingId, floor, tier: isLowTier ? '저층' : '고층', amount, date: completeDate, is_billable: true });
    });
  }
  Object.values(comboByBuilding).forEach(b => {
    b.remark = b.floors.sort((a, bv) => a.floor - bv.floor).map(f => `${f.floor}층(${f.tier})`).join(', ');
  });
  const comboListSorted = sortByBuildingName(Object.values(comboByBuilding));
  const comboTotal = comboListSorted.reduce((s, b) => s + b.billable_amount, 0);

  // ── 인건비
  const endOfMonth = dayjs(month).endOf('month').format('YYYY-MM-DD');
  const personnelRows = db.prepare(`
    SELECT p.name, p.date, p.work_hours, p.ot_hours, p.night_hours
    FROM personnel_records p
    LEFT JOIN workers w ON w.name=p.name AND w.site_id=p.site_id
    WHERE p.site_id=? AND strftime('%Y-%m', p.date)=?
      AND (w.role IS NULL OR w.role != 'foreman')
    ORDER BY p.name, p.date
  `).all(siteId, month);
  const expenseMap = {};
  personnelRows.forEach(r => {
    if (!expenseMap[r.name]) {
      const priceRow = db.prepare(`SELECT unit_price FROM worker_wage_history WHERE site_id=? AND worker_name=? AND effective_date<=? ORDER BY effective_date DESC LIMIT 1`).get(siteId, r.name, endOfMonth);
      expenseMap[r.name] = { name: r.name, unit_price: priceRow ? priceRow.unit_price : 0, total_md: 0 };
    }
    const baseMD = (r.work_hours || 0) / 8.0;
    const extraMD = getWeight(r.ot_hours, r.night_hours);
    expenseMap[r.name].total_md += baseMD + extraMD;
  });
  const laborWorkers = Object.values(expenseMap).map(w => ({ ...w, amount: Math.round(w.total_md * w.unit_price) }));
  const laborTotal = laborWorkers.reduce((s, w) => s + w.amount, 0);

  // ── 식비 (팀장 포함 전체 작업자 — 실제로 지출되는 밥값이므로 인건비의 팀장 제외 기준과 무관하게 전원 반영)
  const MEAL_PRICE = 7500;
  const mealRows = db.prepare(`
    SELECT name, breakfast, lunch FROM personnel_records
    WHERE site_id=? AND strftime('%Y-%m', date)=?
  `).all(siteId, month);
  const mealMap = {};
  mealRows.forEach(r => {
    if (!mealMap[r.name]) mealMap[r.name] = { meal_count: 0 };
    mealMap[r.name].meal_count += (r.breakfast ?? 1) + (r.lunch ?? 1);
  });
  const mealTotal = Object.values(mealMap).reduce((s, m) => s + m.meal_count * MEAL_PRICE, 0);

  // 인건비 대상(팀장 제외)과 식비 대상(전원)을 이름 기준으로 병합 — 팀장은 노무비 0원, 식비만 표시됨
  const expenseNames = new Set([...laborWorkers.map(w => w.name), ...Object.keys(mealMap)]);
  const expenseWorkers = [...expenseNames].sort().map(name => {
    const labor = laborWorkers.find(w => w.name === name) || { name, unit_price: 0, total_md: 0, amount: 0 };
    const mealCount = mealMap[name]?.meal_count || 0;
    const mealAmount = mealCount * MEAL_PRICE;
    return { ...labor, meal_count: mealCount, meal_amount: mealAmount, total: labor.amount + mealAmount };
  });
  const expenseTotal = laborTotal + mealTotal;

  const totalIncome = oilingTotal + slabTotal + cleaningTotal + comboTotal;
  return {
    oiling: { by_building: oilingListSorted, details: oilingDetails, total: oilingTotal },
    slab: { by_building: slabListSorted, details: slabDetails, total: slabTotal },
    cleaning: { by_building: cleaningListSorted, details: cleaningDetails, total: cleaningTotal },
    cleaning_extra: sortByBuildingName(cleaningExtra),
    combo: { by_building: comboListSorted, details: comboDetails, total: comboTotal },
    expense: { workers: expenseWorkers, total: laborTotal, labor_total: laborTotal, meal_total: mealTotal, grand_total: expenseTotal },
    summary: { income: totalIncome, expense: expenseTotal, net: totalIncome - expenseTotal },
    params: { month, contract_start_date: CONTRACT_START_DATE, oiling_price: oilingPrice, cleaning_price: cleaningPrice, slab_price: slabPrice, period_mode: periodMode }
  };
};

app.get('/api/analysis/monthly', (req, res) => {
  const { month, oiling_price = 74000, cleaning_price = 74000, slab_price = 0, period_mode = 'split' } = req.query;
  if (!month) return res.status(400).json({ error: 'month 파라미터 필요' });
  const data = calculateMonthlyAnalysisData(req.siteId, month, parseInt(oiling_price), parseInt(cleaning_price), period_mode, parseInt(slab_price));
  res.json(data);
});

// ── 수익성 분석 (도급 시작일 ~ 오늘까지 누적 손익 + 단가를 평/㎡ 기준으로 환산)
app.get('/api/analysis/profitability', (req, res) => {
  const { oiling_price = 74000, cleaning_price = 74000, slab_price = 0, pyeong = 24 } = req.query;
  const oilingPrice = parseInt(oiling_price) || 0;
  const cleaningPrice = parseInt(cleaning_price) || 0;
  const slabPrice = parseInt(slab_price) || 0;
  const pyeongNum = parseFloat(pyeong) || 0;
  const CONTRACT_START_DATE = '2026-04-16';

  // 도급 시작월부터 이번 달까지의 YYYY-MM 목록 (마감 여부와 무관하게 전부 포함)
  const months = [];
  let cursor = dayjs(CONTRACT_START_DATE).startOf('month');
  const end = dayjs().startOf('month');
  while (cursor.isBefore(end) || cursor.isSame(end)) {
    months.push(cursor.format('YYYY-MM'));
    cursor = cursor.add(1, 'month');
  }

  const monthly = months.map(month => {
    const data = calculateMonthlyAnalysisData(req.siteId, month, oilingPrice, cleaningPrice, 'split', slabPrice);
    return { month, income: data.summary.income, expense: data.summary.expense, net: data.summary.net };
  });

  const income_total = monthly.reduce((s, m) => s + m.income, 0);
  const expense_total = monthly.reduce((s, m) => s + m.expense, 0);
  const net_total = income_total - expense_total;

  // 단가 자체를 평/㎡ 기준으로 환산 (실적과 무관 — 세대당 24평 고정 가정, 1평=3.3058㎡)
  const areaM2 = pyeongNum * 3.3058;
  const perUnit = {
    oiling: oilingPrice,
    slab: slabPrice,
    clean1: cleaningPrice,
    clean2: cleaningPrice,
    clean_total: cleaningPrice * 2,
    all_total: oilingPrice + slabPrice + cleaningPrice * 2,
  };
  const divideAll = (obj, by) => by > 0
    ? Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, v / by]))
    : Object.fromEntries(Object.entries(obj).map(([k]) => [k, 0]));

  res.json({
    months: monthly,
    income_total,
    expense_total,
    net_total,
    unit_price: {
      oiling: oilingPrice,
      slab: slabPrice,
      cleaning: cleaningPrice,
      pyeong: pyeongNum,
      area_m2: areaM2,
      per_unit: perUnit,
      per_pyeong: divideAll(perUnit, pyeongNum),
      per_m2: divideAll(perUnit, areaM2),
    },
  });
});

app.get('/api/analysis/export-monthly', (req, res) => {
  const { month, oiling_price = 74000, cleaning_price = 74000, slab_price = 0, period_mode = 'split' } = req.query;
  if (!month) return res.status(400).json({ error: 'month 파라미터 필요' });

  try {
    const data = calculateMonthlyAnalysisData(req.siteId, month, parseInt(oiling_price), parseInt(cleaning_price), period_mode, parseInt(slab_price));
    const site = db.prepare('SELECT name FROM sites WHERE id=?').get(req.siteId);
    const siteName = site ? site.name : 'Clearing';
    
    const [year, monthNum] = month.split('-');
    const CONTRACT_START_DATE = '2026-04-16';
    const isApril26 = month === '2026-04';
    const periodText = period_mode === 'split' ? (isApril26 ? '16일~말일' : '전체기간') : '전체기간';

    // 엑셀 AOA 구성 (템플릿 매칭: B열 시작 구조)
    const aoa = [
      [null, `[${siteName}] 월별 정산 내역서`], // 1행 (B1)
      [`${year}년 ${monthNum}월 (도급기간: ${periodText})`], // 2행 (A2)
      [], // 3행
      ["1. 갱폼 박리제 도급 내역"], // 4행 (A4)
      [null, "동", "세대", "작업층/세대수", "금액"] // 5행 (B5~E5)
    ];

    data.oiling.by_building.forEach(b => {
      aoa.push([null, b.building, b.total_units + "세대", b.remark, b.billable_amount]);
    });
    aoa.push([null, "소계", (data.oiling.by_building.reduce((s,b)=>s+b.total_units,0)) + "세대", "", data.oiling.total]);
    aoa.push([]); // 섹션 간 공백

    aoa.push(["2. 세대 청소 도급 내역"]); // A열
    aoa.push([null, "동", "세대", "작업층/차수", "금액"]);
    data.cleaning.by_building.forEach(b => {
      aoa.push([null, b.building, b.total_units + "세대", b.remark, b.billable_amount]);
    });
    aoa.push([null, "소계", (data.cleaning.by_building.reduce((s,b)=>s+b.total_units,0)) + "세대", "", data.cleaning.total]);
    aoa.push([]);

    let exportSecNum = 3;
    if (data.slab.by_building.length > 0) {
      aoa.push([`${exportSecNum++}. 슬라브 도급 내역`]); // A열
      aoa.push([null, "동", "세대", "작업층/세대수", "금액"]);
      data.slab.by_building.forEach(b => {
        aoa.push([null, b.building, b.total_units + "세대", b.remark, b.billable_amount]);
      });
      aoa.push([null, "소계", (data.slab.by_building.reduce((s,b)=>s+b.total_units,0)) + "세대", "", data.slab.total]);
      aoa.push([]);
    }

    if (data.combo.by_building.length > 0) {
      aoa.push([`${exportSecNum++}. 결합과금(층별) 도급 내역`]); // A열
      aoa.push([null, "동", "완료 층수", "작업층 내역", "금액"]);
      data.combo.by_building.forEach(b => {
        aoa.push([null, b.building, b.total_units + "개층", b.remark, b.billable_amount]);
      });
      aoa.push([null, "소계", (data.combo.by_building.reduce((s,b)=>s+b.total_units,0)) + "개층", "", data.combo.total]);
      aoa.push([]);
    }

    if (data.cleaning_extra.length > 0) {
      aoa.push([`${exportSecNum++}. 기타 작업 내역 (별도 청구)`]); // A열
      aoa.push([null, "동", "작업 내용", "비고(날짜)"]);
      data.cleaning_extra.forEach(r => {
        aoa.push([null, r.building, r.label, r.date]);
      });
      aoa.push([]);
    }

    // 최하단 합계 행 (템플릿: [null, "합계 금액", null, "", total])
    aoa.push([null, "합계 금액", null, "", data.summary.income]);

    const worksheet = xlsx.utils.aoa_to_sheet(aoa);
    
    // 열 너비 조정 (A열 좁게, B~E열 확보)
    worksheet['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 15 }, { wch: 50 }, { wch: 15 }];

    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, '정산내역');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Disposition', `attachment; filename="monthly_analysis_${month}.xlsx"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (err) {
    console.error('Excel Export Error:', err);
    res.status(500).json({ error: '엑셀 파일 생성 중 오류가 발생했습니다.' });
  }
});



// ── 예상 수입 분석 API ──
app.get('/api/analysis/projection', (req, res) => {
  const { oiling_price = 74000, cleaning_price = 74000, slab_price = 0 } = req.query;
  const siteId = req.siteId;
  const oilingPrice = parseInt(oiling_price);
  const cleaningPrice = parseInt(cleaning_price);
  const slabPrice = parseInt(slab_price) || 0;

  const buildings = db.prepare('SELECT * FROM buildings WHERE site_id=? ORDER BY id').all(siteId);
  const houses = db.prepare('SELECT * FROM houses WHERE site_id=? ORDER BY building_id, line').all(siteId);

  const buildProjection = (table, baseFloorCol, unitPrice) => buildings.map(b => {
    const bHouses = houses.filter(h => h.building_id === b.id);
    const baseFloor = b[baseFloorCol] || 0;
    const maxFloor = bHouses.length > 0 ? Math.max(...bHouses.map(h => h.floors)) : 0;
    // 완료된 층 목록
    const completedFloors = db.prepare(`SELECT DISTINCT floor FROM ${table} WHERE site_id=? AND building_id=? AND floor>?`).all(siteId, b.id, baseFloor).map(r => r.floor);
    // 전체 대상 층 (기준층+1 ~ 최고층)
    const targetFloors = [];
    for (let f = baseFloor + 1; f <= maxFloor; f++) {
      const unitCount = bHouses.filter(h => h.floors >= f).length;
      if (unitCount > 0) targetFloors.push({ floor: f, units: unitCount });
    }
    const completedSet = new Set(completedFloors);
    const doneFloors = targetFloors.filter(f => completedSet.has(f.floor));
    const remainFloors = targetFloors.filter(f => !completedSet.has(f.floor));
    const doneAmount = doneFloors.reduce((s, f) => s + f.units * unitPrice, 0);
    const remainAmount = remainFloors.reduce((s, f) => s + f.units * unitPrice, 0);
    const totalAmount = targetFloors.reduce((s, f) => s + f.units * unitPrice, 0);
    return { building: b.name, building_id: b.id, base_floor: baseFloor, max_floor: maxFloor, total_target: targetFloors.length, completed: doneFloors.length, remaining: remainFloors.length, done_amount: doneAmount, remain_amount: remainAmount, total_amount: totalAmount };
  });

  const oilingProjection = buildProjection('oiling_records', 'oiling_base_floor', oilingPrice);
  const oilingDoneTotal = oilingProjection.reduce((s, b) => s + b.done_amount, 0);
  const oilingRemainTotal = oilingProjection.reduce((s, b) => s + b.remain_amount, 0);
  const oilingTotal = oilingProjection.reduce((s, b) => s + b.total_amount, 0);

  const slabProjection = buildProjection('slab_records', 'slab_base_floor', slabPrice);
  const slabDoneTotal = slabProjection.reduce((s, b) => s + b.done_amount, 0);
  const slabRemainTotal = slabProjection.reduce((s, b) => s + b.remain_amount, 0);
  const slabTotal = slabProjection.reduce((s, b) => s + b.total_amount, 0);

  res.json({
    oiling: { by_building: oilingProjection, done_total: oilingDoneTotal, remain_total: oilingRemainTotal, total: oilingTotal },
    slab: { by_building: slabProjection, done_total: slabDoneTotal, remain_total: slabRemainTotal, total: slabTotal },
    params: { oiling_price: oilingPrice, cleaning_price: cleaningPrice, slab_price: slabPrice }
  });
});

// ── 대시보드 기성금액 요약 API ──
app.get('/api/dashboard/contract-summary', (req, res) => {
  const siteId = req.siteId;
  const UNIT_PRICE = 74000;
  // 슬라브는 오일링/청소처럼 정해진 관행 단가가 없어 site_config에 저장된 값을 사용(미설정 시 0)
  const slabPriceRow = db.prepare(`SELECT value FROM site_config WHERE site_id=? AND key='slab_price'`).get(siteId);
  const SLAB_UNIT_PRICE = slabPriceRow ? (parseInt(slabPriceRow.value) || 0) : 0;

  const buildings = db.prepare('SELECT * FROM buildings WHERE site_id=? ORDER BY id').all(siteId);
  const houses    = db.prepare('SELECT * FROM houses WHERE site_id=?').all(siteId);

  let totalUnits = 0, totalOilUnits = 0, totalCleanUnits = 0, totalSlabUnits = 0;
  const byBuilding = [];

  buildings.forEach(b => {
    const bHouses = houses.filter(h => h.building_id === b.id);
    const slabBaseFloor = b.slab_base_floor || 0;
    let allU = 0, oilU = 0, cleanU = 0, slabU = 0;
    bHouses.forEach(h => {
      allU  += h.floors;
      if (h.floors >= b.oiling_base_floor)   oilU   += (h.floors - b.oiling_base_floor   + 1);
      if (h.floors >= b.cleaning_base_floor) cleanU += (h.floors - b.cleaning_base_floor + 1);
      if (h.floors >= slabBaseFloor)         slabU  += (h.floors - slabBaseFloor + 1);
    });
    totalUnits     += allU;
    totalOilUnits  += oilU;
    totalCleanUnits += cleanU;
    totalSlabUnits += slabU;
    byBuilding.push({
      name:          b.name,
      total_units:   allU,
      oiling_units:  oilU,
      clean_units:   cleanU,
      slab_units:    slabU,
      oiling_amount: oilU   * UNIT_PRICE,
      clean1_amount: cleanU * UNIT_PRICE,
      clean2_amount: cleanU * UNIT_PRICE,
      slab_amount:   slabU  * SLAB_UNIT_PRICE,
      subtotal:      (oilU + cleanU * 2) * UNIT_PRICE + slabU * SLAB_UNIT_PRICE,
    });
  });

  const oilTotal   = totalOilUnits   * UNIT_PRICE;
  const clean1Total = totalCleanUnits * UNIT_PRICE;
  const clean2Total = totalCleanUnits * UNIT_PRICE;
  const slabTotal   = totalSlabUnits * SLAB_UNIT_PRICE;
  const contractTotal = oilTotal + clean1Total + clean2Total + slabTotal;

  // 마감된 월별 기성 집계 — 이번 달 미만(과거 마감 완료 월)만 집계
  const thisMonth = dayjs().format('YYYY-MM');
  const closedMonths = db.prepare(
    'SELECT month FROM monthly_closings WHERE site_id=? AND month < ? ORDER BY month'
  ).all(siteId, thisMonth);

  const monthlySettled = closedMonths.map(({ month }) => {
    // calculateMonthlyAnalysisData 내부 쿼리가 strftime('%Y-%m', date)=month 로
    // 해당 월 데이터만 정확히 필터링함. thisMonth < month 조건으로 이번 달은 이미 제외됨.
    const data = calculateMonthlyAnalysisData(siteId, month, UNIT_PRICE, UNIT_PRICE, 'split', SLAB_UNIT_PRICE);
    const phase1 = (data.cleaning.details || []).filter(d => d.phase === 1).reduce((s, d) => s + (d.amount || 0), 0);
    const phase2 = (data.cleaning.details || []).filter(d => d.phase === 2).reduce((s, d) => s + (d.amount || 0), 0);
    return { month, oiling: data.oiling.total, slab: data.slab.total, phase1, phase2, total: data.summary.income };
  });

  const settledTotal = monthlySettled.reduce((s, m) => s + m.total, 0);

  res.json({
    unit_price:  UNIT_PRICE,
    slab_unit_price: SLAB_UNIT_PRICE,
    total_units: totalUnits,
    contract: {
      oiling: { units: totalOilUnits,   amount: oilTotal   },
      slab:   { units: totalSlabUnits,  amount: slabTotal  },
      phase1: { units: totalCleanUnits, amount: clean1Total },
      phase2: { units: totalCleanUnits, amount: clean2Total },
      total:  contractTotal,
    },
    by_building:    byBuilding,
    monthly_settled: monthlySettled,
    settled_total:  settledTotal,
    remaining:      contractTotal - settledTotal,
  });
});

app.listen(PORT, () => console.log(`✅ 세대청소 관리 Server running on port ${PORT}`));
