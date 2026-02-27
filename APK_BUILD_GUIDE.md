# ISP Dashboard - APK Build Guide

## Overview
Panduan ini menjelaskan cara build APK Android untuk ISP Dashboard menggunakan Capacitor dan GitHub Actions.

## Prerequisites
- Akun GitHub
- Akun Firebase (untuk push notification - opsional)
- HP Android (untuk testing)

## Quick Start

### 1. Push ke GitHub

```bash
git add .
git commit -m "Add Capacitor mobile app setup"
git push origin main
```

### 2. Build APK via GitHub Actions

1. Buka repository GitHub Anda
2. Masuk ke tab **Actions**
3. Pilih workflow **Build Android APK**
4. Klik **Run workflow** → **Run workflow**
5. Tunggu build selesai (~5-10 menit)
6. Download APK dari bagian **Artifacts**

### 3. Install APK di HP

1. Download `debug-apk.zip` dari GitHub Actions
2. Extract file ZIP
3. Install `app-debug.apk` di HP Android
4. Izinkan install dari sumber tidak dikenal jika diminta

## Build Release APK (Signed)

Untuk build release APK yang bisa diupload ke Play Store:

### 1. Generate Keystore

```bash
keytool -genkey -v -keystore keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias isp-dashboard
```

### 2. Convert keystore ke Base64

```bash
base64 -i keystore.jks | pbcopy  # macOS
base64 -w 0 keystore.jks          # Linux
```

### 3. Setup GitHub Secrets

1. Buka repository GitHub
2. Masuk ke **Settings** → **Secrets and variables** → **Actions**
3. Tambahkan secret baru:
   - `KEYSTORE_BASE64`: Paste hasil base64 dari keystore.jks
   - `KEYSTORE_PASSWORD`: Password keystore Anda
   - `KEY_ALIAS`: `isp-dashboard`
   - `KEY_PASSWORD`: Password key Anda

### 4. Update capacitor.config.json

```json
{
  "appId": "com.isp.dashboard",
  "appName": "ISP Dashboard",
  "webDir": "frontend",
  "android": {
    "buildOptions": {
      "keystorePath": "keystore.jks",
      "keystoreAlias": "isp-dashboard"
    }
  }
}
```

### 5. Build Release APK

Push changes dan jalankan workflow lagi. Release APK akan tersedia di artifacts.

## Push Notification Setup (Opsional)

### 1. Setup Firebase Project

1. Buka [Firebase Console](https://console.firebase.google.com/)
2. Buat project baru
3. Tambahkan Android app dengan package name: `com.isp.dashboard`
4. Download `google-services.json`
5. Copy ke `android/app/google-services.json`

### 2. Update Android Manifest

File: `android/app/src/main/AndroidManifest.xml`

```xml
<manifest>
    <application>
        <service android:name="com.getcapacitor.CapacitorFirebaseMessagingService">
            <intent-filter>
                <action android:name="com.google.firebase.MESSAGING_EVENT" />
            </intent-filter>
        </service>
    </application>
</manifest>
```

### 3. Add Firebase Dependencies

File: `android/app/build.gradle`

```gradle
dependencies {
    implementation platform('com.google.firebase:firebase-bom:32.0.0')
    implementation 'com.google.firebase:firebase-messaging'
}
```

File: `android/build.gradle`

```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.3.15'
    }
}

allprojects {
    repositories {
        google()
    }
}
```

File: `android/app/build.gradle` (di bagian paling bawah)

```gradle
apply plugin: 'com.google.gms.google-services'
```

### 4. Test Push Notification

```javascript
// Di frontend JavaScript
import { PushNotifications } from '@capacitor/push-notifications';

// Request permission
PushNotifications.requestPermissions().then(result => {
  if (result.receive === 'granted') {
    PushNotifications.register();
  }
});

// Listen for notifications
PushNotifications.addListener('pushNotificationReceived', notification => {
  console.log('Push notification received:', notification);
});
``