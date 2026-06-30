const Database = require('better-sqlite3');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'clearing-supabase-migration', '.env') });

const recoveryData = JSON.parse(fs.readFileSync('recovery_records.json', 'utf8'));

// 1. Restore to SQLite
function restoreSQLite() {
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
}

// 2. Restore to Supabase
async function restoreSupabase() {
  const client = new Client(process.env.DATABASE_URL);
  
  try {
    await client.connect();

    const bRes = await client.query("SELECT id, site_id FROM buildings WHERE name = '1동'");
    if (bRes.rows.length === 0) throw new Error('1동 not found in Supabase');
    const b = bRes.rows[0];

    const h3Res = await client.query("SELECT id FROM houses WHERE building_id = $1 AND ho = '3호'", [b.id]);
    const h4Res = await client.query("SELECT id FROM houses WHERE building_id = $1 AND ho = '4호'", [b.id]);

    const oldIdToNewId = {
      121: h3Res.rows[0].id,
      122: h4Res.rows[0].id
    };

    let count = 0;
    for (const r of recoveryData.cleaning) {
      const newHouseId = oldIdToNewId[r.house_id];
      if (newHouseId) {
        await client.query(`
          INSERT INTO cleaning_records (building_id, house_id, floor, phase, progress, operator, date, time, remarks, photo, confirmed, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          b.id, newHouseId, r.floor, r.phase, r.progress, r.operator, r.date, r.time, r.remarks, r.photo, r.confirmed, r.created_at
        ]);
        count++;
      }
    }
    console.log(`Restored ${count} cleaning records to Supabase.`);

  } catch (err) {
    console.error('Supabase Restore Error:', err);
  } finally {
    await client.end();
  }
}

restoreSQLite();
restoreSupabase();
