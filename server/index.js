const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

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

app.use(cors());
app.use(express.json({ limit: '20mb' }));

// ── 데이터베이스 연결 (현장 관리 데이터가 저장되는 곳) ──
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── 프로그램 실행 시 필요한 데이터 테이블(장부) 자동 생성 ──
// 각 테이블은 현장의 특정 정보를 담는 '디지털 장부'와 같습니다.
db.exec(`
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
    name TEXT NOT NULL,
    address TEXT,
    basement_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS houses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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

  CREATE TABLE IF NOT EXISTS site_config (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT (datetime('now','localtime'))
  );
`);

// ── 프로그램 기본 정보 자동 입력 (동/호수/계정 초기화) ──
const bCount = db.prepare('SELECT COUNT(*) as c FROM buildings').get();
if (bCount.c === 0) {
  const insertB = db.prepare('INSERT INTO buildings (name, address, basement_count) VALUES (?,?,?)');
  const insertH = db.prepare('INSERT INTO houses (building_id, ho, line, floors, basement_label_b1, basement_label_b2) VALUES (?,?,?,?,?,?)');

  const buildingData = [
    {
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
    const res = insertB.run(b.name, '', 0);
    b.houses.forEach((h, i) => {
      insertH.run(res.lastInsertRowid, h.ho, i + 1, h.floors, 'B1', 'B2');
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

// ── 인증 API (로그인 및 회원가입) ──
app.post('/api/auth/register', async (req, res) => {
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

// ── 기준 정보
app.get('/api/data', (req, res) => {
  const buildings = db.prepare('SELECT * FROM buildings ORDER BY id').all();
  const houses = db.prepare('SELECT * FROM houses ORDER BY building_id, line').all();
  const result = buildings.map(b => ({
    ...b,
    houses: houses.filter(h => h.building_id === b.id)
  }));
  res.json(result);
});

app.post('/api/master/save-building', (req, res) => {
  const { id, name, address, basement_count, houses } = req.body;
  const updateB = db.prepare('UPDATE buildings SET name=?,address=?,basement_count=? WHERE id=?');
  updateB.run(name, address || '', basement_count, id);
  
  const deleteH = db.prepare('DELETE FROM houses WHERE building_id=?');
  deleteH.run(id);
  const insertH = db.prepare('INSERT INTO houses (building_id,ho,line,floors,basement_label_b1,basement_label_b2) VALUES (?,?,?,?,?,?)');
  houses.forEach((h, i) => insertH.run(id, h.ho, h.line || i + 1, h.floors, h.basement_label_b1 || 'B1', h.basement_label_b2 || 'B2'));
  res.json({ success: true });
});

app.post('/api/master/add-building', (req, res) => {
  const { name } = req.body;
  const result = db.prepare('INSERT INTO buildings (name,basement_count) VALUES (?,0)').run(name);
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
    ORDER BY o.date DESC
  `).all();
  
  const cleaning = db.prepare(`
    SELECT c.*, b.name as building_name, h.ho
    FROM cleaning_records c
    JOIN buildings b ON b.id=c.building_id
    LEFT JOIN houses h ON h.id=c.house_id
    ORDER BY c.date DESC
  `).all();

  const lifting = db.prepare(`
    SELECT l.*, b.name as building_name
    FROM lifting_records l
    JOIN buildings b ON b.id=l.building_id
    ORDER BY l.date DESC
  `).all();

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
      stmt = db.prepare('INSERT INTO oiling_records (building_id,house_id,floor,operator,date,time,remarks) VALUES (?,?,?,?,?,?,?)');
      stmt.run(d.building_id, null, d.floor, d.operator, d.date, d.time, d.remarks);
    } else if (type === 'cleaning') {
      stmt = db.prepare('INSERT INTO cleaning_records (building_id,house_id,floor,phase,progress,operator,date,time,remarks,photo) VALUES (?,?,?,?,?,?,?,?,?,?)');
      stmt.run(d.building_id, d.house_id, d.floor, d.phase, d.progress, d.operator, d.date, d.time, d.remarks, d.photo || null);
    } else {
      stmt = db.prepare('INSERT INTO lifting_records (building_id,floor,memo,status,date,checklist) VALUES (?,?,?,?,?,?)');
      stmt.run(d.building_id, d.floor, d.memo, d.status || 'planned', d.date, JSON.stringify(d.checklist || []));
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
  const result = db.prepare('INSERT INTO cost_records (date,description,vendor,amount,notes,category) VALUES (?,?,?,?,?,?)').run(date, description, vendor, amount, notes, category || 'general');
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
  let query = 'SELECT * FROM personnel_records WHERE 1=1';
  const params = [];
  if (month) { query += ' AND strftime(\'%Y-%m\', date) = ?'; params.push(month); }
  if (date) { query += ' AND date = ?'; params.push(date); }
  query += ' ORDER BY date DESC, name';
  res.json(db.prepare(query).all(...params));
});

app.post('/api/personnel', (req, res) => {
  const { name, date, work_hours, ot_hours, night_hours, memo } = req.body;
  const result = db.prepare('INSERT INTO personnel_records (name,date,work_hours,ot_hours,night_hours,memo) VALUES (?,?,?,?,?,?)').run(name, date, work_hours || 8, ot_hours || 0, night_hours || 0, memo || '');
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
  let query = 'SELECT * FROM workers WHERE 1=1';
  const params = [];
  if (status) { query += ' AND status=?'; params.push(status); }
  if (team) { query += ' AND team=?'; params.push(team); }
  query += ' ORDER BY team, role DESC, name';
  res.json(db.prepare(query).all(...params));
});

app.post('/api/workers', (req, res) => {
  const { name, phone, role, team, specialty, status, memo } = req.body;
  const result = db.prepare(
    'INSERT INTO workers (name,phone,role,team,specialty,status,memo) VALUES (?,?,?,?,?,?,?)'
  ).run(name, phone || '', role || 'worker', team || '', specialty || '', status || 'active', memo || '');
  res.json({ id: result.lastInsertRowid });
});

app.put('/api/workers/:id', (req, res) => {
  const { name, phone, role, team, specialty, status, memo } = req.body;
  db.prepare(
    'UPDATE workers SET name=?,phone=?,role=?,team=?,specialty=?,status=?,memo=? WHERE id=?'
  ).run(name, phone || '', role || 'worker', team || '', specialty || '', status || 'active', memo || '', req.params.id);
  res.json({ success: true });
});

app.delete('/api/workers/:id', (req, res) => {
  db.prepare('DELETE FROM workers WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ── 단가 관리
app.get('/api/worker-prices', (req, res) => {
  const { month } = req.query;
  const query = 'SELECT * FROM worker_monthly_prices WHERE month = ?';
  res.json(db.prepare(query).all(month));
});

app.post('/api/worker-prices', (req, res) => {
  const { worker_name, month, unit_price } = req.body;
  const stmt = db.prepare(`
    INSERT INTO worker_monthly_prices (worker_name, month, unit_price)
    VALUES (?, ?, ?)
    ON CONFLICT(worker_name, month) DO UPDATE SET unit_price=excluded.unit_price
  `);
  stmt.run(worker_name, month, unit_price);
  res.json({ success: true });
});

// ── 프론트엔드 오류 수집용 API ──
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

app.listen(PORT, () => console.log(`✅ Blueprint Authority Server running on port ${PORT}`));
