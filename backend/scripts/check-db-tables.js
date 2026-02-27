const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/database.sqlite'); // Adjust if needed

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.all("SELECT name FROM sqlite_master WHERE type='table';", (err, tables) => {
    if (err) {
      console.error('Error:', err);
    } else {
      console.log('Tables in database:');
      tables.forEach(table => console.log('- ' + table.name));
      
      // Check specific tables
      const required = ['payment_proofs', 'approval_requests'];
      required.forEach(table => {
        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='${table}';`, (err, row) => {
          if (row) {
            console.log(`${table}: EXISTS`);
          } else {
            console.log(`${table}: MISSING`);
          }
        });
      });
    }
    db.close();
  });
});

db.on('error', err => console.error(err));