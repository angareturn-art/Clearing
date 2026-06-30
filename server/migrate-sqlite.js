const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'construction.db');
const db = new Database(dbPath);

console.log('Migrating SQLite Database...');

try {
  // 1. Add column
  try {
    db.exec(`ALTER TABLE houses ADD COLUMN start_floor INTEGER DEFAULT 1;`);
    console.log('Column start_floor ensured.');
  } catch (e) {
    if (!e.message.includes('duplicate column name')) {
      throw e;
    }
  }

  // 2. Map buildings
  const buildings = db.prepare('SELECT id, name FROM buildings').all();
  const bMap = {};
  buildings.forEach(b => bMap[b.name] = b.id);

  // 3. Delete 1동 3,4호
  if (bMap['1동']) {
    const bId = bMap['1동'];
    const targetHouses = db.prepare(`SELECT id FROM houses WHERE building_id = ? AND ho IN ('3호', '4호')`).all(bId);
    
    if (targetHouses.length > 0) {
      const hIds = targetHouses.map(h => h.id);
      const placeholders = hIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM cleaning_records WHERE house_id IN (${placeholders})`).run(...hIds);
      db.prepare(`DELETE FROM oiling_records WHERE house_id IN (${placeholders})`).run(...hIds);
      db.prepare(`DELETE FROM houses WHERE id IN (${placeholders})`).run(...hIds);
      console.log('1동 3,4호 삭제 완료 (연관 기록 포함)');
    }
  }

  // 4. Update start_floor
  const updateStartFloor = (bName, hoList, floor) => {
    if (!bMap[bName]) return;
    if (hoList.length === 0) {
      db.prepare(`UPDATE houses SET start_floor = ? WHERE building_id = ?`).run(floor, bMap[bName]);
      console.log(`${bName} 전체 start_floor=${floor} 업데이트 완료`);
    } else {
      const placeholders = hoList.map(() => '?').join(',');
      db.prepare(`UPDATE houses SET start_floor = ? WHERE building_id = ? AND ho IN (${placeholders})`).run(floor, bMap[bName], ...hoList);
      console.log(`${bName} ${hoList.join(', ')} start_floor=${floor} 업데이트 완료`);
    }
  };

  updateStartFloor('2동', [], 2);
  updateStartFloor('3동', ['1호', '5호'], 3);
  updateStartFloor('4동', ['3호'], 3);
  updateStartFloor('5동', ['1호'], 3);
  updateStartFloor('5동', ['2호', '3호'], 2);
  updateStartFloor('6동', ['1호'], 3);
  updateStartFloor('6동', ['2호'], 2);
  updateStartFloor('7동', [], 2);
  updateStartFloor('8동', [], 2);

  console.log('Migration completed successfully.');
} catch (err) {
  console.error('Migration failed:', err);
} finally {
  db.close();
}
