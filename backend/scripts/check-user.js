const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/database.sqlite');
const db = new sqlite3.Database(dbPath);

const phone = '+6285206091996';

db.get(`SELECT * FROM clients WHERE phone_number = ? OR phone = ?`, [phone.replace(/\D/g, ''), phone], (err, row) => {
  if (err) {
    console.error('Error querying DB:', err);
    process.exit(1);
  }
  if (row) {
    console.log('User found:', {
      id: row.id,
      name: row.name,
      phone_number: row.phone_number,
      pppoe_username: row.pppoe_username,
      monthly_fee: row.monthly_fee,
      status: row.status
    });
  } else {
    console.log('No user found for phone:', phone);
  }
  db.close();
});