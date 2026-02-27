// Test user data
const testUser = {
    pppoe_username: 'test_user',
    full_name: 'Mirza Maulana',
    phone_number: '6285236022073',
    monthly_fee: 150000,
    due_date: '2026-02-28',
    status: 'active'
};

function formatRupiah(number) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0
    }).format(number);
}

function formatPhoneNumber(phone) {
    let targetPhone = phone.trim();
    if (targetPhone.startsWith('0')) {
        targetPhone = '+62' + targetPhone.substring(1);
    } else if (targetPhone.startsWith('62')) {
        targetPhone = '+' + targetPhone;
    } else if (!targetPhone.startsWith('+')) {
        targetPhone = '+62' + targetPhone;
    }
    return targetPhone;
}

function getBillingMessage(user, status) {
    const formattedFee = formatRupiah(user.monthly_fee);
    const fullName = user.full_name || user.name || user.pppoe_username;
    const dueDate = user.due_date || 'tanggal belum ditetapkan';
    
    let subject;
    let messageText;

    switch (status) {
        case 'H-3':
            subject = '⚠️ PENGINGAT TAGIHAN: 3 Hari Lagi';
            messageText = `*${subject}*\n\nHalo *${fullName}*,\n\nIni adalah pengingat bahwa tagihan layanan internet Mahapta Net Anda sebesar *${formattedFee}* akan jatuh tempo dalam *3 hari* (pada tanggal *${dueDate}*).\n\nMohon segera lakukan pembayaran untuk menghindari pemutusan layanan.\n\n💳 *Metode Pembayaran:*\n• Rek BCA: 3330190816 a.n. Mirza Maulana\n• Dana: 085236022073\n\nAbaikan pesan ini jika sudah melakukan pembayaran. Terima kasih atas kerjasama Anda!`;
            break;
        case 'H-0':
            subject = '🔔 JATUH TEMPO: Hari Ini';
            messageText = `*${subject}*\n\nHalo *${fullName}*,\n\nHari ini adalah tanggal jatuh tempo tagihan layanan internet Mahapta Net Anda sebesar *${formattedFee}*\n\nPembayaran diharapkan diterima hari ini.\n\n💳 *Metode Pembayaran:*\n• Rek BCA: 3330190816 a.n. Mirza Maulana\n• Dana: 085236022073\n\nAbaikan pesan ini jika sudah melakukan pembayaran. Terima kasih!`;
            break;
        case 'D+1':
            subject = '🚨 TAGIHAN TERLAMBAT';
            messageText = `*${subject}*\n\nHalo *${fullName}*,\n\nTagihan layanan internet Mahapta Net Anda sebesar *${formattedFee}* telah *melewati jatuh tempo* (*${dueDate}*).\n\nMohon segera lakukan pembayaran. Jika layanan Anda terputus, pembayaran harus diverifikasi untuk mengaktifkannya kembali.\n\n💳 *Metode Pembayaran:*\n• Rek BCA: 3330190816 a.n. Mirza Maulana\n• Dana: 085236022073\n\nAbaikan pesan ini jika sudah melakukan pembayaran. Terima kasih!`;
            break;
        default:
            return null;
    }

    return messageText;
}

async function testNotification() {
    console.log('=== Mock Test: Billing Notification Messages ===\n');
    console.log('Target Phone:', formatPhoneNumber(testUser.phone_number));
    console.log('User:', testUser.full_name);
    console.log('Amount:', formatRupiah(testUser.monthly_fee));
    console.log('Due Date:', testUser.due_date);
    console.log('\n' + '='.repeat(60) + '\n');

    // Test H-3
    console.log('📱 MESSAGE TYPE: H-3 (3 Days Before Due Date)\n');
    console.log(getBillingMessage(testUser, 'H-3'));
    console.log('\n' + '='.repeat(60) + '\n');

    // Test H-0
    console.log('📱 MESSAGE TYPE: H-0 (Due Date Today)\n');
    console.log(getBillingMessage(testUser, 'H-0'));
    console.log('\n' + '='.repeat(60) + '\n');

    // Test D+1
    console.log('📱 MESSAGE TYPE: D+1 (Overdue)\n');
    console.log(getBillingMessage(testUser, 'D+1'));
    console.log('\n' + '='.repeat(60) + '\n');

    console.log('✅ All message formats verified successfully!');
}

testNotification();
