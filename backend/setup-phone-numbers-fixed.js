/**
 * Script untuk menambahkan nomor telepon ke database
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const readline = require('readline');
const fs = require('fs');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const db = new sqlite3.Database(dbPath);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function showUsers() {
  return new Promise((resolve, reject) => {
    db.all('SELECT id, name, phone_number FROM clients ORDER BY name', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function updatePhoneNumber(name, phoneNumber) {
  return new Promise((resolve, reject) => {
    db.run('UPDATE clients SET phone_number = ? WHERE name = ?', [phoneNumber, name], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
}

function formatPhoneNumber(phone) {
  let cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = '62' + cleaned.substring(1);
  if (cleaned.startsWith('+62')) cleaned = cleaned.substring(1);
  return cleaned;
}

async function main() {
  console.log('📱 Setup Nomor Telepon User untuk CS WhatsApp\n');
  
  const users = await showUsers();
  console.log('Daftar User:');
  console.log('='.repeat(80));
  users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.name || 'N/A'} - Phone: ${user.phone_number || 'N/A'}`);
  });
  console.log('='.repeat(80));
  
  rl.question('\nPilih mode:\n1. Update satu user\n2. Update bulk dari file\n3. Update semua user dengan nomor dummy (testing)\n\nPilihan (1/2/3): ', async (choice) => {
    
    if (choice === '1') {
      rl.question('\nMasukkan nama user: ', async (name) => {
        const user = users.find(u => u.name.toLowerCase() === name.toLowerCase());
        if (!user) {
          console.log(`❌ User dengan nama "${name}" tidak ditemukan!`);
          rl.close();
          db.close();
          return;
        }
        rl.question(`Masukkan nomor WhatsApp untuk ${user.name}: `, async (phone) => {
          const formattedPhone = formatPhoneNumber(phone);
          try {
            await updatePhoneNumber(user.name, formattedPhone);
            console.log(`✅ Nomor ${formattedPhone} berhasil ditambahkan untuk ${user.name}`);
          } catch (err) {
            console.error(`❌ Error: ${err.message}`);
          }
          rl.close();
          db.close();
        });
      });
      
    } else if (choice === '2') {
      console.log('\n📝 Buat file "phone-numbers.txt" dengan format:');
      console.log('   name,nomor_wa');
      console.log('   RYUJIE,6281234567890');
      console.log('   RUMAH,6289876543210');
      
      rl.question('\nTekan Enter jika file sudah siap... ', async () => {
        const filePath = path.join(__dirname, 'phone-numbers.txt');
        if (!fs.existsSync(filePath)) {
          console.log(`❌ File "phone-numbers.txt" tidak ditemukan!`);
          rl.close();
          db.close();
          return;
        }
        
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        let success = 0, failed = 0;
        
        for (const line of lines) {
          if (!line || line.startsWith('#')) continue;
          const [name, phone] = line.split(',').map(s => s.trim());
          if (!name || !phone) continue;
          
          try {
            await updatePhoneNumber(name, formatPhoneNumber(phone));
            success++;
            console.log(`✅ ${name}: ${formatPhoneNumber(phone)}`);
          } catch (err) {
            failed++;
            console.log(`❌ ${name