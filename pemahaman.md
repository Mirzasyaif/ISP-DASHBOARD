# Pemahaman Project ISP‑DASHBOARD

## 1. Struktur Umum
- **Backend** (Node.js/Express)  
  - `backend/index.js` – entry point server, menginisialisasi database, middleware keamanan, CORS, logger, dan router API.  
  - **Konfigurasi** di `backend/config/config.js` membaca variabel lingkungan (`.env`) dan menyediakan getter `getConfig()`.  
  - **Middleware**: sanitasi input, pencegahan SQL‑Injection, XSS, otentikasi (`auth.js`), lisensi (`license.js`), logging (`logging.js`).  
  - **Model**: `backend/models/db.js` (SQL‑lite & PostgreSQL wrapper) dan `simple-db.js` untuk operasi file‑json.  
  - **Router**: API utama (`/api`), Mikrotik (`/api/mikrotik`), Telegram bot (`/api/telegram`), lisensi, keuangan, WhatsApp, pengaturan, dll.  
  - **Health & Monitoring**: `backend/routes/api.js` menyediakan endpoint `/health` (simple) dan `/health/dashboard` (detail) serta `/metrics` untuk Prometheus.  
  - **Scheduler**: `backend/scripts/scheduler.js` dijalankan pada startup untuk notifikasi billing otomatis.  

- **Frontend** (HTML + Tailwind + Vanilla JS)  
  - `frontend/index.html` – dashboard utama, memuat Tailwind CDN, Chart.js, dan script JS (`assets/js/*.js`).  
  - UI terdiri atas navbar, status koneksi, kartu statistik (total user, paid, pending, Mikrotik), overview keuangan, chart status pembayaran, tabel PPPoE live, serta formulir manajemen user.  
  - Script utama `assets/js/dashboard.js` (dan `dashboard-fixed.js`) meng-handle fetch data dari API, refresh otomatis tiap 60 detik, dan interaksi UI (menu mobile, pencarian).  
  - File konfigurasi `assets/js/config.js` berisi endpoint API dan kunci (`API_KEY`).  

- **Monitoring** (Node.js module)  
  - `monitoring/health-check.js` – router Express yang menyediakan endpoint `/health/dashboard` (mengecek API, Mikrotik, DB, memori, CPU) serta `/health` (legacy) dan `/metrics`/`/metrics/dashboard` untuk Prometheus.  
  - Menilai status `UP`, `DEGRADED`, atau `DOWN` dan menghitung skor kesehatan (0‑100).  
  - File konfigurasi lain: `monitoring/alert-service.js`, `alert-rules.js`, `ecosystem-alerts.config.js` (digunakan oleh proses monitoring eksternal).  

- **Scripts** (utility / maintenance)  
  - `scripts/start-server.sh` – memulai server dengan `node backend/index.js`.  
  - `scripts/backup-db.sh` / `restore-db.sh` – backup & restore SQLite/JSON DB.  
  - `scripts/setup-cron.sh` – menyiapkan cron untuk scheduler.  
  - `backend/scripts/` berisi skrip khusus:  
    - `scheduler.js` – mengatur job billing.  
    - `license-admin.js`, `license-test.js` – manajemen lisensi.  
    - `update-sqlite-fees.js`, `upgrade-db.js` – migrasi dan pembaruan data.  
    - `test-runner.js`, `test-smart-price.js` – script pengujian internal.  

## 2. Alur Kerja Utama
1. **Server startup** (`backend/index.js`) → inisialisasi DB → jalankan scheduler → expose static frontend (`frontend/`).  
2. **API** menerima request, melewati middleware keamanan, kemudian memanggil controller (contoh: `whatsappController.js`).  
3. **Frontend** memanggil endpoint `/api/*` untuk menampilkan data real‑time (user, pembayaran, status Mikrotik).  
4. **Monitoring** terus memeriksa kesehatan sistem & layanan, menyediakan endpoint `/health/dashboard` dan `/metrics` untuk integrasi dengan Prometheus/Grafana.  
5. **Scripts** dipanggil secara manual atau lewat cron untuk backup, migrasi, atau operasi batch (misalnya import pengguna dari Mikrotik).  

## 3. Teknologi & Dependensi
- **Backend**: Node.js, Express, dotenv, cors, axios, winston (logging), jest (testing).  
- **Database**: SQLite (default) atau PostgreSQL (konfigurasi via env).  
- **Frontend**: Tailwind CSS, Chart.js, vanilla JavaScript.  
- **Monitoring**: Prometheus format (exposed via `/metrics`).  
- **Scripting**: Bash + Node.js scripts.  

## 4. Catatan Penting
- Semua konfigurasi sensitif disimpan di `.env`; `config.js` hanya mengekspor nilai non‑sensitif ke `db.json`.  
- Middleware lisensi (`license.js`) mengarahkan ke `license.html` bila aktivasi belum selesai.  
- Endpoint `/health` pada `backend/index.js` dan `monitoring/health-check.js` berbeda: yang pertama mengembalikan status sederhana, yang kedua menambahkan pemeriksaan layanan dan skor kesehatan.  
- Frontend mengandalkan API key (`X-API-Key`) yang di‑set di `.env`.  

---

*Ringkasan ini ditulis ke dalam `pemahaman.md` sebagai hasil pemahaman terhadap struktur dan fungsi utama proyek ISP‑DASHBOARD.*