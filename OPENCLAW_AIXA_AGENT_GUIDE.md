# Panduan Mengarahkan Allowlist ke Agen Chat "Aixa" di OpenClaw

## Ringkasan

Panduan ini menjelaskan cara mengarahkan semua nomor di allowlist OpenClaw ke agen chat bernama "Aixa".

## Prasyarat

- OpenClaw sudah terinstall dan terkonfigurasi
- Akses ke konfigurasi OpenClaw
- File allowlist sudah ada (`backend/openclaw-allowlist-numbers.json`)

## Langkah 1: Buat Konfigurasi Agen Aixa

```bash
mkdir -p ~/.openclaw/agents/aixa
cat > ~/.openclaw/agents/aixa/config.json << 'EOF'
{
  "agentName": "Aixa",
  "agentId": "aixa",
  "description": "Agen Chat CS ISP - Aixa",
  "version": "1.0.0",
  "capabilities": ["text_message", "image_message", "payment_proof", "customer_service"],
  "settings": {
    "autoReply": true,
    "escalationEnabled": true
  },
  "routing": {
    "allowlistOnly": true,
    "defaultAgent": true
  }
}
EOF
```

## Langkah 2: Update Konfigurasi OpenClaw

```bash
cat > ~/.openclaw/config.json << 'EOF'
{
  "apiKey": "${OPENCLAW_API_KEY}",
  "webhookSecret": "${OPENCLAW_WEBHOOK_SECRET}",
  "phoneNumber": "${OPENCLAW_PHONE_NUMBER}",
  "adminPhone": "${ADMIN_PHONE_NUMBER}",
  "apiUrl": "https://api.openclaw.io/v1",
  "defaultAgent": "aixa",
  "agents": {
    "aixa": {
      "enabled": true,
      "priority": 1,
      "handleAllAllowlist": true
    }
  },
  "routing": {
    "strategy": "agent_based",
    "defaultAgent": "aixa",
    "allowlistRouting": {
      "enabled": true,
      "targetAgent": "aixa"
    }
  }
}
EOF
```

## Langkah 3: Update Backend (.env)

Tambahkan ke `backend/.env`:

```env
OPENCLAW_DEFAULT_AGENT=aixa
OPENCLAW_AGENT_AIXA_ENABLED=true
```

## Langkah 4: Update Route OpenClaw

Di `backend/routes/openclaw.js`, tambahkan fungsi routing:

```javascript
async function routeToAixaAgent(phoneNumber, message, messageType = 'text') {
    try {
        const response = await axios.post(
            `${openclawConfig.apiUrl}/agents/aixa/message`,
            { phoneNumber, message, messageType, timestamp: new Date().toISOString() },
            { headers: { 'Authorization': `Bearer ${openclawConfig.apiKey}`, 'Content-Type': 'application/json' } }
        );
        return response.data;
    } catch (error) {
        console.error('[Aixa Agent] Error:', error);
        throw error;
    }
}
```

## Langkah 5: Update Fungsi Kirim Pesan

Modifikasi fungsi `sendMessage` untuk menggunakan agen Aixa:

```javascript
async function sendMessage(phoneNumber, message, messageType = 'text') {
    // Cek apakah nomor ada di allowlist
    const isInAllowlist = await checkAllowlist(phoneNumber);
    
    if (isInAllowlist) {
        // Route ke agen Aixa
        return await routeToAixaAgent(phoneNumber, message, messageType);
    } else {
        // Kirim langsung tanpa agen
        return await sendDirectMessage(phoneNumber, message, messageType);
    }
}
```

## Langkah 6: Restart Server

```bash
cd backend
npm restart
```

## Verifikasi

Cek status agen Aixa:

```bash
curl -H "Authorization: Bearer $OPENCLAW_API_KEY" \
  https://api.openclaw.io/v1/agents/aixa/status
```

## Troubleshooting

1. **Agen tidak ditemukan**: Pastikan file config.json sudah dibuat dengan benar
2. **Pesan tidak terkirim**: Cek log server di `backend/logs/server.log`
3. **Allowlist tidak bekerja**: Verifikasi file `backend/openclaw-allowlist-numbers.json`

## Ringkasan

Setelah mengikuti panduan ini, semua pesan dari nomor di allowlist akan diarahkan ke agen chat "Aixa"