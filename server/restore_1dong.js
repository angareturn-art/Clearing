const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'construction.db');
const db = new Database(dbPath);

console.log('Restoring 1동 3,4호 in SQLite...');

try {
  const b = db.prepare('SELECT id, site_id FROM buildings WHERE name = ?').get('1동');
  if (b) {
    const insertH = db.prepare('INSERT INTO houses (site_id, building_id, ho, line, floors, basement_label_b1, basement_label_b2, start_floor) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    
    // Check if they exist first
    const check3 = db.prepare('SELECT id FROM houses WHERE building_id = ? AND ho = ?').get(b.id, '3호');
    if (!check3) {
      insertH.run(b.site_id, b.id, '3호', 3, 20, 'B1', 'B2', 2);
      console.log('Restored 1동 3호 (start_floor=2)');
    } else {
      db.prepare('UPDATE houses SET start_floor = 2 WHERE id = ?').run(check3.id);
      console.log('Updated 1동 3호 to start_floor=2');
    }

    const check4 = db.prepare('SELECT id FROM houses WHERE building_id = ? AND ho = ?').get(b.id, '4호');
    if (!check4) {
      insertH.run(b.site_id, b.id, '4호', 4, 20, 'B1', 'B2', 2);
      console.log('Restored 1동 4호 (start_floor=2)');
    } else {
      db.prepare('UPDATE houses SET start_floor = 2 WHERE id = ?').run(check4.id);
      console.log('Updated 1동 4호 to start_floor=2');
    }
  }

  console.log('Restore completed successfully.');
} catch (err) {
  console.error('Restore failed:', err);
} finally {
  db.close();
}
