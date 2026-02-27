# ISP Dashboard - Mobile App

## 📱 Tentang Aplikasi

ISP Dashboard Mobile App adalah versi Android native dari ISP Dashboard web yang dibangun menggunakan **Capacitor**. Aplikasi ini memungkinkan Anda mengelola ISP Anda langsung dari HP Android.

## ✨ Fitur

- ✅ **Dashboard Real-time**: Monitor users, payments, dan Mikrotik status
- ✅ **User Management**: Tambah, edit, dan disable users
- ✅ **Financial Overview**: Lihat revenue, profit, dan cash flow
- ✅ **WhatsApp Controller**: Kirim pesan WhatsApp otomatis
- ✅ **Push Notifications** (Opsional): Notifikasi untuk payment reminders
- ✅ **Mobile-Friendly UI**: Optimasi untuk layar sentuh
- ✅ **Offline Support**: Cache data untuk akses offline

## 🚀 Cara Install APK

### Metode 1: GitHub Actions (Recommended)

1. Buka repository GitHub
2. Masuk ke tab **Actions**
3. Pilih workflow **Build Android APK**
4. Klik **Run workflow**
5. Download APK dari artifacts
6. Install di HP Android

### Metode 2: Build Lokal

```bash
# Install dependencies
npm install

# Sync ke Android
npx cap sync android

# Build APK
cd android
./gradlew assembleDebug

# APK tersedia di:
# android/app/build/outputs/apk/debug/app-debug.apk
```

## 📋 Requirements

- **Android Version**: 7.0 (API Level 24) atau lebih tinggi
- **Storage**: ~50MB
- **Internet**: Diperlukan untuk koneksi ke backend

## 🔧 Konfigurasi

### Backend URL

Edit `frontend/assets/js/config.js`:

```javascript
const API_BASE_URL = 'https://your-backend-url.com';
```

### Push Notifications (Opsional)

Lihat panduan lengkap di [APK_BUILD_GUIDE.md](APK_BUILD_GUIDE.md)

## 📱 Screenshots

*(Tambahkan screenshots aplikasi di sini)*

## 🐛 Troubleshooting

### APK tidak bisa diinstall

Pastikan:
- Izinkan install dari sumber tidak dikenal di HP
- Android version minimal 7.0
- APK tidak corrupt (download ulang)

### Data tidak muncul

Pastikan:
- Backend server berjalan
- URL backend sudah dikonfigurasi dengan benar
- HP terhubung ke internet

### Push notification tidak bekerja

Pastikan:
- Firebase sudah dikonfigurasi
- Permission notification sudah diberikan
- Google Play Services terinstall

## 📄 License

Commercial License - © 2026 ISP Dashboard

## 🤝 Support

Untuk bantuan dan pertanyaan, hubungi tim support ISP Dashboard.