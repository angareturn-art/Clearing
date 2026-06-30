const Database = require('better-sqlite3');
const path = require('path');

const backupPath = path.join(__dirname, 'construction_backup_20260503.db');
const db = new Database(backupPath);

try {
  const b = db.prepare('SELECT id FROM buildings WHERE name = ?').get('1동');
  if (b) {
    const houses = db.prepare("SELECT id, ho FROM houses WHERE building_id = ? AND ho IN ('3호', '4호')").all(b.id);
    console.log('Backup houses found:', houses);

    if (houses.length > 0) {
      const hIds = houses.map(h => h.id);
      const placeholders = hIds.map(() => '?').join(',');
      
      const cleaning = db.prepare(`SELECT * FROM cleaning_records WHERE house_id IN (${placeholders})`).all(...hIds);
      const oiling = db.prepare(`SELECT * FROM oiling_records WHERE house_id IN (${placeholders})`).all(...hIds);
      
      console.log(`Found ${cleaning.length} cleaning records.`);
      console.log(`Found ${oiling.length} oiling records.`);

      // Write to a JSON file for recovery
      const fs = require('fs');
      fs.writeFileSync('recovery_records.json', JSON.stringify({ cleaning, oiling }, null, 2));
    } else {
      console.log('No 3,4호 houses found in backup.');
    }
  }
} catch (err) {
  console.error(err);
} finally {
  db.close();
}
