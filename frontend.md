# Usulan Perbaikan Frontend untuk ISP‑DASHBOARD

## [x] 1. Struktur Kode & Modularitas
- **Pisahkan kode JavaScript menjadi modul ES6** (mis. `modules/api.js`, `modules/ui.js`, `modules/state.js`) untuk memudahkan pemeliharaan dan mengurangi duplikasi.
- **Gunakan bundler** seperti Vite atau Webpack untuk menggabungkan dan mengoptimalkan aset (JS, CSS) serta mendukung import/export modul.

## 2. Responsif & UI/UX
- **Manfaatkan utilitas Tailwind** (`overflow-x-auto`, `grid`, `flex`) untuk memastikan tabel PPPoE tidak overflow pada perangkat mobile.
- **Tambahkan breakpoint** (`sm:`, `md:`) pada layout kartu statistik agar tampilan menyesuaikan secara otomatis pada layar kecil.
- **Gunakan komponen reusable** untuk kartu statistik, tabel, dan chart (mis. `components/Card.svelte` atau `components/Card.html` dengan Tailwind).

## 3. Pengelolaan State & Pengurangan Request
- **Implementasikan state global** (mis. `store.js`) yang menyimpan data dashboard (stats, pppoe, payment status) dengan TTL 30 detik.
- **Konsolidasikan permintaan API** menggunakan `Promise.all` sehingga semua data dimuat dalam satu batch, mengurangi latensi dan beban server.
- **Cache hasil fetch** pada sisi klien untuk menghindari request berulang saat pengguna menavigasi antar tab atau melakukan refresh.

## 4. Pengalaman Pengguna (UX)
- **Loading overlay** sudah ada, namun tambahkan **skeleton UI** pada tabel dan kartu statistik untuk memberi indikasi visual yang lebih halus.
- **Toast/Alert** untuk menampilkan pesan sukses atau error secara konsisten (mis. menggunakan `toast.js`).
- **Debounce pencarian** pada tabel PPPoE (sudah ada, pastikan nilai debounce tidak terlalu kecil).

## 5. Keamanan
- **Jangan simpan API key di `config.js`** yang dapat diakses client‑side. Ganti dengan mekanisme proxy di backend yang menambahkan header otorisasi.
- **Validasi input** pada formulir (mis. saat menandai pembayaran) dengan HTML5 constraints dan sanitasi di sisi klien.

## 6. Pengujian & Dokumentasi
- **Tambahkan tes end‑to‑end** dengan Cypress atau Playwright untuk menguji alur dashboard (login, fetch data, pagination, pencarian).
- **Perbarui README** dengan panduan instalasi frontend (npm install, npm run dev, build) dan tata cara menambahkan widget baru.

## 7. Optimasi Performansi
- **Lazy‑load chart** dan gambar yang tidak terlihat pada viewport.
- **Minifikasi CSS** dengan PurgeCSS untuk menghapus kelas Tailwind yang tidak terpakai.
- **Gunakan `defer`** pada tag `<script>` untuk mempercepat rendering halaman.

## 8. Internationalisasi (i18n) (Opsional)
- Buat file `locales/en.json` dan `locales/id.json` untuk teks UI, kemudian gunakan fungsi `t('key')` di JS untuk menampilkan bahasa yang dipilih.

---

**Catatan:** Semua perubahan di atas dapat diimplementasikan secara bertahap. Prioritaskan modularitas dan konsolidasi request untuk meningkatkan responsifitas, kemudian lanjutkan ke peningkatan UI/UX, keamanan, dan pengujian.