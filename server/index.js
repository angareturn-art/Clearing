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
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS lifting_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    building_id INTEGER,
    floor INTEGER,
    memo TEXT,
    status TEXT DEFAULT 'planned',
    date TEXT,
    checklist TEXT,
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
`);

// ── 기존 테이블 site_id 마이그레이션 ──
[
  'buildings', 'houses', 'oiling_records', 'cleaning_records', 'lifting_records', 
  'cost_records', 'personnel_records', 'workers', 'worker_wage_history'
].forEach(table => {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!info.some(c => c.name === 'site_id')) {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN site_id INTEGER DEFAULT 1`);
      console.log(`✅ Migrated table ${table}: added site_id`);
    } catch (e) { console.error(`Failed to migrate ${table}:`, e.message); }
  }
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
  // 기준층 초기값 설정 (값이 0인 경우만 업데이트)
  const setFloors = db.transaction(() => {
    [['1동',7,4],['2동',7,4],['3동',3,3],['4동',3,3],['5동',3,3],['6동',3,3],['9동',3,3],['7동',2,2],['8동',2,2]]
      .forEach(([name, oil, clean]) => {
        db.prepare('UPDATE buildings SET oiling_base_floor=? WHERE name=? AND oiling_base_floor=0').run(oil, name);
        db.prepare('UPDATE buildings SET cleaning_base_floor=? WHERE name=? AND cleaning_base_floor=0').run(clean, name);
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
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
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
    houses: houses.filter(h => h.building_id === b.id)
  }));
  res.json(result);
});

app.post('/api/master/save-building', (req, res) => {
  const { id, name, address, basement_count, oiling_base_floor, cleaning_base_floor, houses } = req.body;
  db.prepare('UPDATE buildings SET name=?,address=?,basement_count=?,oiling_base_floor=?,cleaning_base_floor=? WHERE id=? AND site_id=?')
    .run(name, address || '', basement_count || 0, oiling_base_floor || 0, cleaning_base_floor || 0, id, req.siteId);
  
  const deleteH = db.prepare('DELETE FROM houses WHERE building_id=? AND site_id=?');
  deleteH.run(id, req.siteId);
  const insertH = db.prepare('INSERT INTO houses (site_id,building_id,ho,line,floors,basement_label_b1,basement_label_b2) VALUES (?,?,?,?,?,?,?)');
  houses.forEach((h, i) => insertH.run(req.siteId, id, h.ho, h.line || i + 1, h.floors, h.basement_label_b1 || 'B1', h.basement_label_b2 || 'B2'));
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

  const lifting = db.prepare(`
    SELECT l.*, b.name as building_name
    FROM lifting_records l
    JOIN buildings b ON b.id=l.building_id
    WHERE l.site_id = ?
    ORDER BY l.date DESC
  `).all(req.siteId);

  res.json({ oiling, cleaning, lifting });
});

// ── 기록 CRUD
['oiling', 'cleaning', 'lifting'].forEach(type => {
  const table = type === 'oiling' ? 'oiling_records' : type === 'cleaning' ? 'cleaning_records' : 'lifting_records';
  
  app.get(`/api/records/${type}`, (req, res) => {
    const { date, buildingId } = req.query;
    let query = `SELECT r.*, b.name as building_name${type === 'cleaning' ? ', h.ho' : ''}
      FROM ${table} r
      JOIN buildings b ON b.id=r.building_id
      ${type === 'cleaning' ? 'LEFT JOIN houses h ON h.id=r.house_id' : ''}
      WHERE 1=1`;
    const params = [];
    if (date) { query += ' AND r.date=?'; params.push(date); }
    if (buildingId) { query += ' AND r.building_id=?'; params.push(buildingId); }
    query += ' ORDER BY r.created_at DESC';
    res.json(db.prepare(query).all(...params));
  });

  app.post(`/api/records/${type}`, (req, res) => {
    const d = req.body;
    let stmt;
    if (type === 'oiling') {
      stmt = db.prepare('INSERT INTO oiling_records (site_id,building_id,house_id,floor,operator,date,time,remarks) VALUES (?,?,?,?,?,?,?,?)');
      stmt.run(req.siteId, d.building_id, null, d.floor, d.operator, d.date, d.time, d.remarks);
    } else if (type === 'cleaning') {
      stmt = db.prepare('INSERT INTO cleaning_records (site_id,building_id,house_id,floor,phase,progress,operator,date,time,remarks,photo) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
      stmt.run(req.siteId, d.building_id, d.house_id, d.floor, d.phase, d.progress, d.operator, d.date, d.time, d.remarks, d.photo || null);
    } else {
      stmt = db.prepare('INSERT INTO lifting_records (site_id,building_id,floor,memo,status,date,checklist) VALUES (?,?,?,?,?,?,?)');
      stmt.run(req.siteId, d.building_id, d.floor, d.memo, d.status || 'planned', d.date, JSON.stringify(d.checklist || []));
    }
    res.json({ success: true });
  });

  app.put(`/api/records/${type}/:id`, (req, res) => {
    const d = req.body;
    let stmt;
    if (type === 'oiling') {
      stmt = db.prepare('UPDATE oiling_records SET building_id=?, house_id=?, floor=?, operator=?, date=?, time=?, remarks=? WHERE id=?');
      stmt.run(d.building_id, null, d.floor, d.operator, d.date, d.time, d.remarks, req.params.id);
    } else if (type === 'cleaning') {
      stmt = db.prepare('UPDATE cleaning_records SET building_id=?, house_id=?, floor=?, phase=?, progress=?, operator=?, date=?, time=?, remarks=?, photo=? WHERE id=?');
      stmt.run(d.building_id, d.house_id, d.floor, d.phase, d.progress, d.operator, d.date, d.time, d.remarks, d.photo || null, req.params.id);
    } else {
      stmt = db.prepare('UPDATE lifting_records SET building_id=?, floor=?, memo=?, status=?, date=?, checklist=? WHERE id=?');
      stmt.run(d.building_id, d.floor, d.memo, d.status || 'planned', d.date, JSON.stringify(d.checklist || []), req.params.id);
    }
    res.json({ success: true });
  });

  app.delete(`/api/records/${type}/:id`, (req, res) => {
    db.prepare(`DELETE FROM ${table} WHERE id=?`).run(req.params.id);
    res.json({ success: true });
  });
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
  const result = db.prepare('INSERT INTO cost_records (site_id,date,description,vendor,amount,notes,category) VALUES (?,?,?,?,?,?,?)').run(req.siteId, date, description, vendor, amount, notes, category || 'general');
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/costs/:id', (req, res) => {
  const { date, description, vendor, amount, notes, category } = req.body;
  db.prepare('UPDATE cost_records SET date=?,description=?,vendor=?,amount=?,notes=?,category=? WHERE id=?').run(date, description, vendor, amount, notes, category, req.params.id);
  res.json({ success: true });
});

app.delete('/api/costs/:id', (req, res) => {
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
  const { name, date, work_hours, ot_hours, night_hours, memo } = req.body;
  const result = db.prepare('INSERT INTO personnel_records (site_id,name,date,work_hours,ot_hours,night_hours,memo) VALUES (?,?,?,?,?,?,?)').run(req.siteId, name, date, work_hours || 8, ot_hours || 0, night_hours || 0, memo || '');
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/personnel/:id', (req, res) => {
  const { name, date, work_hours, ot_hours, night_hours, memo } = req.body;
  db.prepare('UPDATE personnel_records SET name=?,date=?,work_hours=?,ot_hours=?,night_hours=?,memo=? WHERE id=?')
    .run(name, date, work_hours || 8, ot_hours || 0, night_hours || 0, memo || '', req.params.id);
  res.json({ success: true });
});

app.delete('/api/personnel/:id', (req, res) => {
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
    'INSERT INTO workers (site_id,name,phone,role,team,specialty,status,memo) VALUES (?,?,?,?,?,?,?,?)'
  ).run(req.siteId, name, phone || '', role || 'worker', team || '', specialty || '', status || 'active', memo || '');
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
    'UPDATE workers SET name=?,phone=?,role=?,team=?,specialty=?,status=?,memo=? WHERE id=?'
  ).run(name, phone || '', role || 'worker', team || '', specialty || '', status || 'active', memo || '', req.params.id);
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
    INSERT INTO sites (name, primary_contractor, subcontractor, address, start_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(name, primary_contractor, subcontractor, address, start_date, end_date);
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
    SET name=?, primary_contractor=?, subcontractor=?, address=?, start_date=?, end_date=?
    WHERE id=?
  `).run(name, primary_contractor, subcontractor, address, start_date, end_date, req.params.id);
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
  exec('node compare-and-sync.js', { cwd: scriptPath, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
    isSyncRunning = false;

    if (error) {
      console.error('Sync Error:', error.message);
      return res.status(500).json({ error: stderr || error.message || '동기화 스크립트 실행 중 오류가 발생했습니다.' });
    }

    try {
      const lines = stdout.split('\n');
      const results = [];
      let isParsingTable = false;

      for (const line of lines) {
        if (line.includes('| 테이블명 |')) {
          isParsingTable = true;
          continue;
        }
        if (isParsingTable && line.includes('| :---')) continue;
        
        if (isParsingTable && line.startsWith('|')) {
          const cols = line.split('|').map(s => s.trim()).filter(s => s !== '');
          if (cols.length >= 4) {
            results.push({
              table: cols[0],
              local: parseInt(cols[1].replace(/,/g, '')),
              remote: parseInt(cols[2].replace(/,/g, '')),
              status: cols[3]
            });
          }
        }
      }

      if (results.length === 0) {
        return res.status(500).json({ error: '파싱 결과 없음. 로그:\n' + stdout });
      }

      res.json({ success: true, results, log: stdout });
    } catch (err) {
      console.error('Parsing Error:', err);
      res.status(500).json({ error: '결과 파싱 오류: ' + err.message });
    }
  });
});

// ── 월별 통합 정산 분석 API ──
app.get('/api/analysis/monthly', (req, res) => {
  const { month, split_day = 15, oiling_price = 74000, cleaning_price = 74000, period_mode = 'split' } = req.query;
  if (!month) return res.status(400).json({ error: 'month 파라미터 필요' });

  const siteId = req.siteId;
  const splitDay = parseInt(split_day);
  const oilingPrice = parseInt(oiling_price);
  const cleaningPrice = parseInt(cleaning_price);

  // 모든 건물 + 기준층 정보
  const buildings = db.prepare('SELECT * FROM buildings WHERE site_id=? ORDER BY id').all(siteId);
  const houses = db.prepare('SELECT * FROM houses WHERE site_id=? ORDER BY building_id, line').all(siteId);
  const buildingMap = {};
  buildings.forEach(b => { buildingMap[b.id] = { ...b, houses: houses.filter(h => h.building_id === b.id) }; });

  // ── 갱폼 박리제 쿼리 (전 기간 또는 도급기간 필터)
  let oilingWhere = `strftime('%Y-%m', o.date) = ?`;
  const oilingParams = [siteId, month];
  if (period_mode === 'split') {
    oilingWhere += ` AND CAST(strftime('%d', o.date) AS INTEGER) > ?`;
    oilingParams.push(splitDay);
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

  // 갱폼 건물별 집계 + 비고 생성
  const oilingByBuilding = {};
  const oilingDetails = [];
  oilingRows.forEach(r => {
    const isBillable = r.floor > (r.oiling_base_floor || 0);
    const amount = isBillable ? r.unit_count * oilingPrice : 0;
    if (!oilingByBuilding[r.bname]) oilingByBuilding[r.bname] = { building: r.bname, building_id: r.building_id, billable_amount: 0, total_units: 0, floors: [] };
    if (isBillable) {
      oilingByBuilding[r.bname].billable_amount += amount;
      oilingByBuilding[r.bname].total_units += r.unit_count;
      oilingByBuilding[r.bname].floors.push({ floor: r.floor, units: r.unit_count, amount, date: r.date });
    }
    oilingDetails.push({ id: r.id, date: r.date, building: r.bname, building_id: r.building_id, floor: r.floor, oiling_base_floor: r.oiling_base_floor, units: r.unit_count, is_billable: isBillable, amount });
  });
  // 비고 문자열 생성
  Object.values(oilingByBuilding).forEach(b => {
    b.remark = b.floors.map(f => `${f.floor}층(${f.units}세대)`).join(', ');
  });
  const oilingTotal = Object.values(oilingByBuilding).reduce((s, b) => s + b.billable_amount, 0);

  // ── 세대청소 쿼리
  let cleaningWhere = `strftime('%Y-%m', c.date) = ?`;
  const cleaningParams = [siteId, month];
  if (period_mode === 'split') {
    cleaningWhere += ` AND CAST(strftime('%d', c.date) AS INTEGER) > ?`;
    cleaningParams.push(splitDay);
  }
  const cleaningRows = db.prepare(`
    SELECT c.building_id, c.floor, c.phase, c.house_id, c.date,
      b.name as bname, b.cleaning_base_floor,
      (SELECT COUNT(DISTINCT h2.id) FROM houses h2 WHERE h2.building_id=c.building_id AND h2.site_id=? AND h2.floors >= c.floor) as total_units
    FROM cleaning_records c
    JOIN buildings b ON b.id=c.building_id
    WHERE c.site_id=? AND ${cleaningWhere}
    ORDER BY b.name, c.floor, c.phase
  `).all(siteId, ...cleaningParams);

  // 층별 완료 여부 계산 (지하층 분리)
  const cleaningFloorMap = {};
  const cleaningExtra = []; // 지하층
  cleaningRows.forEach(r => {
    if (r.floor <= 0) {
      // 지하층: 기타작업
      const label = r.floor === -1 ? 'B1층' : r.floor === -2 ? 'B2층' : `B${Math.abs(r.floor)}층`;
      cleaningExtra.push({ building: r.bname, building_id: r.building_id, floor: r.floor, phase: r.phase, date: r.date, label: `${label} 청소(${r.phase}차)` });
      return;
    }
    const key = `${r.bname}_${r.floor}_${r.phase}`;
    if (!cleaningFloorMap[key]) cleaningFloorMap[key] = { building: r.bname, building_id: r.building_id, floor: r.floor, phase: r.phase, cleaned_units: new Set(), total_units: r.total_units, date: r.date, base_floor: r.cleaning_base_floor };
    if (r.house_id) cleaningFloorMap[key].cleaned_units.add(r.house_id);
    else cleaningFloorMap[key].cleaned_units.add(`nohouse_${r.date}`);
  });

  const cleaningByBuilding = {};
  const cleaningDetails = [];
  Object.values(cleaningFloorMap).forEach(f => {
    const cleanedCount = f.cleaned_units.size;
    const isComplete = cleanedCount >= f.total_units && f.total_units > 0;
    const isBillable = isComplete && f.floor > (f.base_floor || 0);
    const amount = isBillable ? f.total_units * cleaningPrice : 0;
    if (!cleaningByBuilding[f.building]) cleaningByBuilding[f.building] = { building: f.building, building_id: f.building_id, billable_amount: 0, total_units: 0, floors: [] };
    if (isBillable) {
      cleaningByBuilding[f.building].billable_amount += amount;
      cleaningByBuilding[f.building].total_units += f.total_units;
      cleaningByBuilding[f.building].floors.push({ floor: f.floor, phase: f.phase, units: f.total_units, amount, date: f.date });
    }
    cleaningDetails.push({ building: f.building, building_id: f.building_id, floor: f.floor, phase: f.phase, cleaned: cleanedCount, total: f.total_units, is_complete: isComplete, is_billable: isBillable, amount, date: f.date });
  });
  Object.values(cleaningByBuilding).forEach(b => {
    b.remark = b.floors.map(f => `${f.floor}층(${f.phase}차)`).join(', ');
  });
  const cleaningTotal = Object.values(cleaningByBuilding).reduce((s, b) => s + b.billable_amount, 0);

  // ── 인건비 (팀장 제외)
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

  res.json({
    oiling: { by_building: Object.values(oilingByBuilding), details: oilingDetails, total: oilingTotal },
    cleaning: { by_building: Object.values(cleaningByBuilding), details: cleaningDetails, total: cleaningTotal },
    cleaning_extra: cleaningExtra,
    expense: { workers: expenseWorkers, total: expenseTotal },
    summary: { income: oilingTotal + cleaningTotal, expense: expenseTotal, net: oilingTotal + cleaningTotal - expenseTotal },
    params: { month, split_day: splitDay, oiling_price: oilingPrice, cleaning_price: cleaningPrice, period_mode }
  });
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
