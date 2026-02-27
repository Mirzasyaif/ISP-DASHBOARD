const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '../data/database.sqlite');
const db = new sqlite3.Database(dbPath);

const messageId = 'AC07B76D31DD6A532235C8EA4171E713'; // From recent message

db.get(`SELECT * FROM payment_proofs WHERE message_id = ?`, [messageId], (err, row) => {
  if (err) {
    console.error('Error querying DB:', err);
    process.exit(1);
  }
  if (row) {
    console.log('Proof found:', {
      id: row.id,
      status: row.status,
      user_id: row.user_id,
      created_at: row.created_at,
      ocr_result: row.ocr_result ? JSON.parse(row.ocr_result) : null,
      validation: row.validation ? JSON.parse(row.validation) : null
    });
  } else {
    console.log('No proof found for messageId:', messageId);
  }
  db.close();
});