const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const recoveryData = JSON.parse(fs.readFileSync('recovery_records.json', 'utf8'));
const dbPath = path.join(__dirname, 'construction.db');
const db = new Database(dbPath);

try {
  const b = db.prepare('SELECT id, site_id FROM buildings WHERE name = ?').get('1동');
  if (!b) throw new Error('1동 not found in SQLite');

  const house3 = db.prepare('SELECT id FROM houses WHERE building_id = ? AND ho = ?').get(b.id, '3호');
  const house4 = db.prepare('SELECT id FROM houses WHERE building_id = ? AND ho = ?').get(b.id, '4호');

  const oldIdToNewId = {
    121: house3.id,
    122: house4.id
  };

  const insertCleaning = db.prepare(`
    INSERT INTO cleaning_records (building_id, house_id, floor, phase, progress, operator, date, time, remarks, photo, confirmed, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  recoveryData.cleaning.forEach(r => {
    const newHouseId = oldIdToNewId[r.house_id];
    if (newHouseId) {
      insertCleaning.run(
        b.id, newHouseId, r.floor, r.phase, r.progress, r.operator, r.date, r.time, r.remarks, r.photo, r.confirmed, r.created_at
      );
      count++;
    }
  });

  console.log(`Restored ${count} cleaning records to SQLite.`);
} catch (err) {
  console.error('SQLite Restore Error:', err);
} finally {
  db.close();
}
