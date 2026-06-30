const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'construction.db');
const db = new Database(dbPath);

console.log('Updating 2동 start_floor data in SQLite...');

try {
  const b = db.prepare('SELECT id FROM buildings WHERE name = ?').get('2동');
  if (b) {
    db.prepare("UPDATE houses SET start_floor = 1 WHERE building_id = ? AND ho IN ('1호', '2호')").run(b.id);
    db.prepare("UPDATE houses SET start_floor = 2 WHERE building_id = ? AND ho IN ('3호', '4호')").run(b.id);
    console.log('Successfully updated 2동 houses (1,2호=1F / 3,4호=2F) in SQLite');
  } else {
    console.log('2동 not found.');
  }
} catch (err) {
  console.error('Update failed:', err);
} finally {
  db.close();
}
