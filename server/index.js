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
const PORT = 5000;
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

// ── 기존 테이블 site_id 및 sync_flag 마이그레이션 ──
const triggerTables = [
  'buildings', 'houses', 'oiling_records', 'cleaning_records', 'unloading_records',
  'cost_records', 'personnel_records', 'workers', 'worker_wage_history',
  'users', 'site_config', 'weather_records', 'emergency_contacts', 'worker_monthly_prices'
];

triggerTables.forEach(table => {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  if (table !== 'users' && table !== 'site_config' && table !== 'weather_records' && table !== 'emergency_contacts' && table !== 'worker_monthly_prices') {
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
  const pk = table === 'site_config' ? 'key' : 'id';
  try {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_${table}_insert AFTER INSERT ON ${table}
      FOR EACH ROW
      WHEN NEW.sync_flag = 's'
      BEGIN
        UPDATE ${table} SET sync_flag = 'f' WHERE ${pk} = NEW.${pk};
      END;

      CREATE TRIGGER IF NOT EXISTS trg_${table}_update AFTER UPDATE ON ${table}
      FOR EACH ROW
      WHEN NEW.sync_flag = OLD.sync_flag AND NEW.sync_flag != 'f'
      BEGIN
        UPDATE ${table} SET sync_flag = 'f' WHERE ${pk} = NEW.${pk};
      END;

      CREATE TRIGGER IF NOT EXISTS trg_${table}_delete BEFORE DELETE ON ${table}
      FOR EACH ROW
      BEGIN
        INSERT INTO deleted_logs (table_name, record_id, sync_flag) VALUES ('${table}', OLD.${pk}, 'f');
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
  'oiling_records', 'cleaning_records', 'unloading_records',
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
  const insertSC = db.prepare('INSERT INTO site_config (key, value) VALUES (?,?)');
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
    cleaning_base_floor: b.cleaning_base_floor || 0,
    unloading_base_floor: b.unloading_base_floor || 0,
    houses: houses.filter(h => h.building_id === b.id)
  }));
  res.json(result);
});

app.post('/api/master/save-building', (req, res) => {
  const { id, name, address, basement_count, oiling_base_floor, cleaning_base_floor, unloading_base_floor, houses } = req.body;
  db.prepare('UPDATE buildings SET name=?,address=?,basement_count=?,oiling_base_floor=?,cleaning_base_floor=?,unloading_base_floor=?,sync_flag=? WHERE id=? AND site_id=?')
    .run(name, address || '', basement_count || 0, oiling_base_floor || 0, cleaning_base_floor || 0, unloading_base_floor || 0, 'f', id, req.siteId);

  const deleteH = db.prepare('DELETE FROM houses WHERE building_id=? AND site_id=?');
  deleteH.run(id, req.siteId);
  const insertH = db.prepare('INSERT INTO houses (site_id,building_id,ho,line,floors,basement_label_b1,basement_label_b2,start_floor,sync_flag) VALUES (?,?,?,?,?,?,?,?,?)');
  houses.forEach((h, i) => insertH.run(req.siteId, id, h.ho, h.line || i + 1, h.floors, h.basement_label_b1 || 'B1', h.basement_label_b2 || 'B2', h.start_floor || 1, 'f'));
  res.json({ success: true });
});

app.post('/api/master/add-building', siteMiddleware, (req, res) => {
  const { name } = req.body;
  const result = db.prepare('INSERT INTO buildings (site_id, name, basement_count) VALUES (?,?,0)').run(req.siteId, name);
  res.json({ id: result.lastInsertRowid });
});

// ── 현장 설정 API
app.get('/api/site-config', (req, res) => {
  const config = db.prepare('SELECT * FROM site_config').all();
  const result = config.reduce((acc, curr) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {});
  res.json(result);
});

app.post('/api/site-config', async (req, res) => {
  const settings = req.body; 
  
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
    INSERT INTO site_config (key, value) VALUES (?,?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now','localtime')
  `);
  
  const transaction = db.transaction((data) => {
    for (const [key, value] of Object.entries(data)) {
      upsertSC.run(key, value);
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

  res.json({ oiling, cleaning, unloading });
});

// ── 기록 CRUD
['oiling', 'cleaning', 'unloading'].forEach(type => {
  const table = type === 'oiling' ? 'oiling_records' : type === 'cleaning' ? 'cleaning_records' : 'unloading_records';
  
  app.get(`/api/records/${type}`, (req, res) => {
    const { date, buildingId } = req.query;
    const needsHouse = type === 'cleaning' || type === 'unloading';
    let query = `SELECT r.*, b.name as building_name${needsHouse ? ', h.ho' : ''}
      FROM ${table} r
      JOIN buildings b ON b.id=r.building_id
      ${needsHouse ? 'LEFT JOIN houses h ON h.id=r.house_id' : ''}
      WHERE 1=1`;
    const params = [];
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
    } else if (type === 'cleaning') {
      stmt = db.prepare('INSERT INTO cleaning_records (site_id,building_id,house_id,floor,phase,progress,operator,date,time,remarks,photo,sync_flag) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
      stmt.run(req.siteId, d.building_id, d.house_id, d.floor, d.phase, d.progress, d.operator, d.date, d.time, d.remarks, d.photo || null, 'f');
    } else if (type === 'unloading') {
      stmt = db.prepare('INSERT INTO unloading_records (site_id,building_id,house_id,floor,phase,progress,operator,date,time,remarks,photo,sync_flag) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
      stmt.run(req.siteId, d.building_id, d.house_id, d.floor, d.phase, d.progress, d.operator, d.date, d.time, d.remarks, d.photo || null, 'f');
    }
    res.json({ success: true });
  });

  app.put(`/api/records/${type}/:id`, (req, res) => {
    const d = req.body;
    if (rejectIfClosed(res, req.siteId, d.date)) return;
    let stmt;
    if (type === 'oiling') {
      stmt = db.prepare('UPDATE oiling_records SET building_id=?, house_id=?, floor=?, operator=?, date=?, time=?, remarks=?, sync_flag=? WHERE id=?');
      stmt.run(d.building_id, null, d.floor, d.operator, d.date, d.time, d.remarks, 'f', req.params.id);
    } else if (type === 'cleaning') {
      stmt = db.prepare('UPDATE cleaning_records SET building_id=?, house_id=?, floor=?, phase=?, progress=?, operator=?, date=?, time=?, remarks=?, photo=?, sync_flag=? WHERE id=?');
      stmt.run(d.building_id, d.house_id, d.floor, d.phase, d.progress, d.operator, d.date, d.time, d.remarks, d.photo || null, 'f', req.params.id);
    } else if (type === 'unloading') {
      stmt = db.prepare('UPDATE unloading_records SET building_id=?, house_id=?, floor=?, phase=?, progress=?, operator=?, date=?, time=?, remarks=?, photo=?, sync_flag=? WHERE id=?');
      stmt.run(d.building_id, d.house_id, d.floor, d.phase, d.progress, d.operator, d.date, d.time, d.remarks, d.photo || null, 'f', req.params.id);
    }
    res.json({ success: true });
  });

  app.delete(`/api/records/${type}/:id`, (req, res) => {
    const existing = db.prepare(`SELECT date FROM ${table} WHERE id=?`).get(req.params.id);
    if (existing && rejectIfClosed(res, req.siteId, existing.date)) return;
    db.prepare(`DELETE FROM ${table} WHERE id=?`).run(req.params.id);
    res.json({ success: true });
  });
});

// ── 본청 서명 완료 처리 (2차 청소)
app.patch('/api/records/cleaning/:id/sign', (req, res) => {
  const { sign_date } = req.body;
  if (!sign_date) return res.status(400).json({ error: 'sign_date 필수' });
  if (rejectIfClosed(res, req.siteId, sign_date)) return;
  try {
    db.prepare('UPDATE cleaning_records SET confirmed=1, sign_date=?, sync_flag=? WHERE id=?')
      .run(sign_date, 'f', req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── 본청 서명 대기 목록 (2차 청소, 미서명)
app.get('/api/records/cleaning/pending-sign', (req, res) => {
  const siteId = req.siteId || 1;
  const rows = db.prepare(`
    SELECT c.id, c.building_id, c.floor, c.date, c.operator,
           b.name as building_name, h.ho
    FROM cleaning_records c
    JOIN buildings b ON b.id = c.building_id
    LEFT JOIN houses h ON h.id = c.house_id
    WHERE c.site_id=? AND c.phase=2 AND (c.confirmed IS NULL OR c.confirmed=0)
    ORDER BY c.date DESC
  `).all(siteId);
  res.json(rows);
});

// ── 비용 관리
app.get('/api/costs', (req, res) => {
  const { month } = req.query;
  let query = 'SELECT * FROM cost_records WHERE 1=1';
  const params = [];
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
  db.prepare('UPDATE cost_records SET date=?,description=?,vendor=?,amount=?,notes=?,category=?,sync_flag=? WHERE id=?').run(date, description, vendor, amount, notes, category, 'f', req.params.id);
  res.json({ success: true });
});

app.delete('/api/costs/:id', (req, res) => {
  const existing = db.prepare('SELECT date FROM cost_records WHERE id=?').get(req.params.id);
  if (existing && rejectIfClosed(res, req.siteId, existing.date)) return;
  db.prepare('DELETE FROM cost_records WHERE id=?').run(req.params.id);
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
  db.prepare('UPDATE personnel_records SET name=?,date=?,work_hours=?,ot_hours=?,night_hours=?,memo=?,breakfast=?,lunch=?,sync_flag=? WHERE id=?')
    .run(name, date, work_hours || 8, ot_hours || 0, night_hours || 0, memo || '', breakfast ?? 1, lunch ?? 1, 'f', req.params.id);
  res.json({ success: true });
});

app.delete('/api/personnel/:id', (req, res) => {
  const existing = db.prepare('SELECT date FROM personnel_records WHERE id=?').get(req.params.id);
  if (existing && rejectIfClosed(res, req.siteId, existing.date)) return;
  db.prepare('DELETE FROM personnel_records WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── 날씨 저장/조회
app.get('/api/weather', (req, res) => {
  const { date } = req.query;
  if (date) {
    const record = db.prepare('SELECT * FROM weather_records WHERE date=?').get(date);
    return res.json(record || null);
  }
  const records = db.prepare('SELECT * FROM weather_records ORDER BY date DESC LIMIT 90').all();
  res.json(records);
});

app.post('/api/weather', (req, res) => {
  const { date, temperature, wind_speed, precipitation, condition } = req.body;
  db.prepare('INSERT OR REPLACE INTO weather_records (date,temperature,wind_speed,precipitation,condition) VALUES (?,?,?,?,?)').run(date, temperature, wind_speed, precipitation, condition);
  res.json({ success: true });
});

// ── 비상 연락망
app.get('/api/emergency', (req, res) => {
  res.json(db.prepare('SELECT * FROM emergency_contacts ORDER BY sort_order').all());
});

app.post('/api/emergency', (req, res) => {
  const { category, name, phone, role } = req.body;
  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM emergency_contacts').get();
  const result = db.prepare('INSERT INTO emergency_contacts (category,name,phone,role,sort_order) VALUES (?,?,?,?,?)').run(category, name, phone, role, (maxOrder.m || 0) + 1);
  res.json({ id: result.lastInsertRowid });
});

app.delete('/api/emergency/:id', (req, res) => {
  db.prepare('DELETE FROM emergency_contacts WHERE id=?').run(req.params.id);
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
    'UPDATE workers SET name=?,phone=?,role=?,team=?,specialty=?,status=?,memo=?,sync_flag=? WHERE id=?'
  ).run(name, phone || '', role || 'worker', team || '', specialty || '', status || 'active', memo || '', 'f', req.params.id);
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
  db.prepare('DELETE FROM workers WHERE id=?').run(req.params.id);
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
  const { month } = req.query; // format: YYYY-MM
  if (!month) return res.status(400).json({ error: 'month parameter is required' });

  // 1. Get all personnel records for the month
  const records = db.prepare(`
    SELECT name, date, work_hours, ot_hours, night_hours 
    FROM personnel_records 
    WHERE site_id = ? AND strftime('%Y-%m', date) = ?
  `).all(req.siteId, month);

  // Group by worker name
  const summaryMap = {};

  records.forEach(r => {
    if (!summaryMap[r.name]) {
      // Find the most recent unit_price on or before the end of the month
      const endOfMonth = dayjs(month).endOf('month').format('YYYY-MM-DD');
      const priceRow = db.prepare(`
        SELECT unit_price FROM worker_wage_history 
        WHERE site_id = ? AND worker_name = ? AND effective_date <= ? 
        ORDER BY effective_date DESC LIMIT 1
      `).get(req.siteId, r.name, endOfMonth);
      
      summaryMap[r.name] = {
        name: r.name,
        unit_price: priceRow ? priceRow.unit_price : 0,
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
  const { month } = req.query;
  if (!month) return res.status(400).json({ error: 'month parameter is required' });

  try {
    const records = db.prepare(`
      SELECT name, date, work_hours, ot_hours, night_hours 
      FROM personnel_records 
      WHERE site_id = ? AND strftime('%Y-%m', date) = ?
    `).all(req.siteId, month);

    const summaryMap = {};
    const endOfMonth = dayjs(month).endOf('month').format('YYYY-MM-DD');
    const daysInMonth = dayjs(month).daysInMonth();

    records.forEach(r => {
      if (!summaryMap[r.name]) {
        const priceRow = db.prepare(`
          SELECT unit_price FROM worker_wage_history 
          WHERE site_id = ? AND worker_name = ? AND effective_date <= ? 
          ORDER BY effective_date DESC LIMIT 1
        `).get(req.siteId, r.name, endOfMonth);
        
        summaryMap[r.name] = {
          name: r.name,
          unit_price: priceRow ? priceRow.unit_price : 0,
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
      row['적용 단가'] = worker.unit_price;
      row['총 노무비'] = Math.round(worker.total_md * worker.unit_price);
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
  const { worker_name, effective_date, unit_price } = req.body;
  const stmt = db.prepare(`
    INSERT INTO worker_wage_history (site_id, worker_name, effective_date, unit_price)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(site_id, worker_name, effective_date) DO UPDATE SET unit_price=excluded.unit_price
  `);
  stmt.run(req.siteId, worker_name, effective_date, unit_price);
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
    res.json({ success: true, month });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/monthly-closings/:month', (req, res) => {
  db.prepare('DELETE FROM monthly_closings WHERE site_id=? AND month=?').run(req.siteId, req.params.month);
  res.json({ success: true });
});

// 동 이름 숫자 기준 정렬 유틸리티
const sortByBuildingName = (list) => {
  return [...list].sort((a, b) => {
    const numA = parseInt(a.building.replace(/[^0-9]/g, '')) || 0;
    const numB = parseInt(b.building.replace(/[^0-9]/g, '')) || 0;
    return numA - numB;
  });
};

// ── 월별 통합 정산 분석 데이터 계산 함수 (공통) ──
const calculateMonthlyAnalysisData = (siteId, month, oilingPrice, cleaningPrice, periodMode) => {
  const CONTRACT_START_DATE = '2026-04-16'; // 도급 시작일 고정

  // 모든 건물 + 기준층 정보
  const buildings = db.prepare('SELECT * FROM buildings WHERE site_id=? ORDER BY id').all(siteId);
  const houses = db.prepare('SELECT * FROM houses WHERE site_id=? ORDER BY building_id, line').all(siteId);
  const buildingMap = {};
  buildings.forEach(b => { buildingMap[b.id] = { ...b, houses: houses.filter(h => h.building_id === b.id) }; });

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

  // ── 세대청소 쿼리
  // 2차 청소(phase=2)는 서명일(sign_date) 기준으로 월 귀속, 1차는 청소일(date) 기준
  let cleaningWhere = `strftime('%Y-%m', CASE WHEN c.phase=2 AND c.confirmed=1 AND c.sign_date IS NOT NULL THEN c.sign_date ELSE c.date END) = ?`;
  const cleaningParams = [siteId, month];
  if (periodMode === 'split') {
    cleaningWhere += ` AND c.date >= ?`;
    cleaningParams.push(CONTRACT_START_DATE);
  }
  const cleaningRows = db.prepare(`
    SELECT c.building_id, c.floor, c.phase, c.house_id, c.date, c.confirmed, c.sign_date,
      b.name as bname, b.cleaning_base_floor,
      (SELECT COUNT(DISTINCT h2.id) FROM houses h2 WHERE h2.building_id=c.building_id AND h2.site_id=? AND h2.floors >= c.floor AND (h2.start_floor IS NULL OR h2.start_floor <= c.floor)) as total_units
    FROM cleaning_records c
    JOIN buildings b ON b.id=c.building_id
    WHERE c.site_id=? AND ${cleaningWhere}
    ORDER BY b.name, c.floor, c.phase
  `).all(siteId, ...cleaningParams);

  // ── 이전 월에 이미 완료(정산)된 층/차수 집합 계산 ──
  const monthStart = month + '-01';
  // 2차 청소는 서명일 기준으로 이전 월 판별, 1차 청소는 청소일 기준
  const prevCleaningRows = db.prepare(`
    SELECT c.building_id, c.floor, c.phase, c.house_id, c.date, c.confirmed, c.sign_date
    FROM cleaning_records c
    WHERE c.site_id=? AND c.floor > 0
      AND (
        (c.phase != 2 AND c.date >= ? AND c.date < ?)
        OR (c.phase = 2 AND c.confirmed=1 AND c.sign_date IS NOT NULL AND c.sign_date >= ? AND c.sign_date < ?)
        OR (c.phase = 2 AND c.confirmed=1 AND c.sign_date IS NULL AND c.date >= ? AND c.date < ?)
      )
  `).all(siteId, CONTRACT_START_DATE, monthStart, CONTRACT_START_DATE, monthStart, CONTRACT_START_DATE, monthStart);

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
  cleaningRows.forEach(r => {
    if (r.floor <= 0) {
      const label = r.floor === -1 ? 'B1층' : r.floor === -2 ? 'B2층' : `B${Math.abs(r.floor)}층`;
      cleaningExtra.push({ building: r.bname, building_id: r.building_id, floor: r.floor, phase: r.phase, date: r.date, label: `${label} 청소(${r.phase}차)` });
      return;
    }
    const key = `${r.bname}_${r.floor}_${r.phase}`;
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

  const cleaningByBuilding = {};
  const cleaningDetails = [];
  Object.values(cleaningFloorMap).forEach(f => {
    const cleanedCount = f.cleaned_units.size;
    // 2차 청소는 서명 완료 세대 수 기준, 1차는 청소 완료 세대 수 기준
    const billableCount = f.phase === 2 ? f.confirmed_units.size : cleanedCount;
    const isComplete = billableCount >= f.total_units && f.total_units > 0;
    const wasAlreadyBilled = prevCompleteSet.has(`${f.building_id}_${f.floor}_${f.phase}`);
    const isBillable = isComplete && f.floor > (f.base_floor || 0) && !wasAlreadyBilled;
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

  Object.values(cleaningByBuilding).forEach(b => {
    b.remark = b.floors.map(f => `${f.floor}층(${f.phase}차)${f.is_billable ? '' : '(제외)'}`).join(', ');
  });
  
  const cleaningListSorted = sortByBuildingName(Object.values(cleaningByBuilding));
  const cleaningTotal = cleaningListSorted.reduce((s, b) => s + b.billable_amount, 0);

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
  const expenseWorkers = Object.values(expenseMap).map(w => ({ ...w, amount: Math.round(w.total_md * w.unit_price) }));
  const expenseTotal = expenseWorkers.reduce((s, w) => s + w.amount, 0);

  return {
    oiling: { by_building: oilingListSorted, details: oilingDetails, total: oilingTotal },
    cleaning: { by_building: cleaningListSorted, details: cleaningDetails, total: cleaningTotal },
    cleaning_extra: sortByBuildingName(cleaningExtra),
    expense: { workers: expenseWorkers, total: expenseTotal },
    summary: { income: oilingTotal + cleaningTotal, expense: expenseTotal, net: oilingTotal + cleaningTotal - expenseTotal },
    params: { month, contract_start_date: CONTRACT_START_DATE, oiling_price: oilingPrice, cleaning_price: cleaningPrice, period_mode: periodMode }
  };
};

app.get('/api/analysis/monthly', (req, res) => {
  const { month, oiling_price = 74000, cleaning_price = 74000, period_mode = 'split' } = req.query;
  if (!month) return res.status(400).json({ error: 'month 파라미터 필요' });
  const data = calculateMonthlyAnalysisData(req.siteId, month, parseInt(oiling_price), parseInt(cleaning_price), period_mode);
  res.json(data);
});

app.get('/api/analysis/export-monthly', (req, res) => {
  const { month, oiling_price = 74000, cleaning_price = 74000, period_mode = 'split' } = req.query;
  if (!month) return res.status(400).json({ error: 'month 파라미터 필요' });
  
  try {
    const data = calculateMonthlyAnalysisData(req.siteId, month, parseInt(oiling_price), parseInt(cleaning_price), period_mode);
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

    if (data.cleaning_extra.length > 0) {
      aoa.push(["3. 기타 작업 내역 (별도 청구)"]); // A열
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
  const { oiling_price = 74000, cleaning_price = 74000 } = req.query;
  const siteId = req.siteId;
  const oilingPrice = parseInt(oiling_price);
  const cleaningPrice = parseInt(cleaning_price);

  const buildings = db.prepare('SELECT * FROM buildings WHERE site_id=? ORDER BY id').all(siteId);
  const houses = db.prepare('SELECT * FROM houses WHERE site_id=? ORDER BY building_id, line').all(siteId);

  const oilingProjection = buildings.map(b => {
    const bHouses = houses.filter(h => h.building_id === b.id);
    const baseFloor = b.oiling_base_floor || 0;
    const maxFloor = bHouses.length > 0 ? Math.max(...bHouses.map(h => h.floors)) : 0;
    // 완료된 층 목록
    const completedFloors = db.prepare(`SELECT DISTINCT floor FROM oiling_records WHERE site_id=? AND building_id=? AND floor>?`).all(siteId, b.id, baseFloor).map(r => r.floor);
    // 전체 대상 층 (기준층+1 ~ 최고층)
    const targetFloors = [];
    for (let f = baseFloor + 1; f <= maxFloor; f++) {
      const unitCount = bHouses.filter(h => h.floors >= f).length;
      if (unitCount > 0) targetFloors.push({ floor: f, units: unitCount });
    }
    const completedSet = new Set(completedFloors);
    const doneFloors = targetFloors.filter(f => completedSet.has(f.floor));
    const remainFloors = targetFloors.filter(f => !completedSet.has(f.floor));
    const doneAmount = doneFloors.reduce((s, f) => s + f.units * oilingPrice, 0);
    const remainAmount = remainFloors.reduce((s, f) => s + f.units * oilingPrice, 0);
    const totalAmount = targetFloors.reduce((s, f) => s + f.units * oilingPrice, 0);
    return { building: b.name, building_id: b.id, base_floor: baseFloor, max_floor: maxFloor, total_target: targetFloors.length, completed: doneFloors.length, remaining: remainFloors.length, done_amount: doneAmount, remain_amount: remainAmount, total_amount: totalAmount };
  });

  const oilingDoneTotal = oilingProjection.reduce((s, b) => s + b.done_amount, 0);
  const oilingRemainTotal = oilingProjection.reduce((s, b) => s + b.remain_amount, 0);
  const oilingTotal = oilingProjection.reduce((s, b) => s + b.total_amount, 0);

  res.json({
    oiling: { by_building: oilingProjection, done_total: oilingDoneTotal, remain_total: oilingRemainTotal, total: oilingTotal },
    params: { oiling_price: oilingPrice, cleaning_price: cleaningPrice }
  });
});

app.listen(PORT, () => console.log(`✅ Blueprint Authority Server running on port ${PORT}`));
