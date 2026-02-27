const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/database.sqlite');
const db = new sqlite3.Database(dbPath);

const messageId = 'ACC01D4DB517D7E8C6541F533A466D90'; // Latest proof messageId

db.get(`SELECT * FROM payment_proofs WHERE message_id = ?`, [messageId], (err, row) => {
  if (err) {
    console.error('Error querying DB:', err);
    process.exit(1);
  }
  if (row) {
    console.log('Latest Proof found:', {
      id: row.id,
      status: row.status,
      user_id: row.user_id,
      created_at: row.created_at,
      image_path: row.image_path,
      ocr_result: row.ocr_result ? JSON.parse(row.ocr_result) : null,
      validation: row.validation ? JSON.parse(row.validation) : null
    });
  } else {
    console.log('No proof found for latest messageId:', messageId);
  }
  
  // Also check all proofs for this user
  db.all(`SELECT * FROM payment_proofs WHERE user_id = (SELECT id FROM clients WHERE phone_number = '+6285206091996') ORDER BY created_at DESC LIMIT 5`, (err, rows) => {
    if (err) {
      console.error('Error querying user proofs:', err);
    } else {
      console.log('Recent proofs for user:', rows.map(r => ({ id: r.id, status: r.status, created_at: r.created_at })));
    }
  });
  
  db.close();
});