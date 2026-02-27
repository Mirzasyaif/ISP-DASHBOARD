const API_BASE = 'http://localhost:3001/api/payment';

function formatRupiah(number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
}

function showStatus(type, message) {
    const statusDiv = document.getElementById('statusMessage');
    statusDiv.classList.remove('hidden');
    statusDiv.innerHTML = `
        <div class="${type === 'success' ? 'text-green-600' : type === 'error' ? 'text-red-600' : 'text-blue-600'}">
            ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'} ${message}
        </div>
        ${type === 'success' ? '<p class="mt-4 text-gray-600">Bukti transfer Anda telah dikirim. Admin akan memverifikasi pembayaran dalam waktu 1x24 jam.</p>' : ''}
        <button onclick="location.reload()" class="mt-4 bg-gray-200 px-4 py-2 rounded-lg hover:bg-gray-300">Kembali</button>
    `;
}

document.getElementById('searchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value.trim();
    const searchBtn = document.getElementById('searchBtn');
    
    searchBtn.disabled = true;
    searchBtn.textContent = 'Mencari...';
    
    try {
        const response = await fetch(`${API_BASE}/bill/${username}`);
        const data = await response.json();
        
        if (data.success) {
            const billInfo = document.getElementById('billInfo');
            const billDetails = document.getElementById('billDetails');
            const paymentSection = document.getElementById('paymentSection');
            
            billDetails.innerHTML = `
                <div class="space-y-3">
                    <p><strong>Nama:</strong> ${data.user.name}</p>
                    <p><strong>Username:</strong> ${data.user.username}</p>
                    <p><strong>Paket:</strong> ${data.user.plan}</p>
                    <p><strong>Periode:</strong> ${data.billing.month_year}</p>
                    <p><strong>Jumlah:</strong> <span class="text-2xl font-bold text-purple-600">${formatRupiah(data.billing.amount)}</span></p>
                    <p><strong>Status:</strong> <span class="${data.billing.status === 'paid' ? 'text-green-600' : 'text-orange-600'}">${data.billing.status === 'paid' ? 'LUNAS' : 'BELUM DIBAYAR'}</span></p>
                </div>
            `;
            
            if (data.billing.status === 'pending') {
                paymentSection.classList.remove('hidden');
            } else {
                paymentSection.classList.add('hidden');
            }
            
            billInfo.classList.remove('hidden');
        } else {
            showStatus('error', data.message || 'User tidak ditemukan');
        }
    } catch (error) {
        showStatus('error', 'Terjadi kesalahan. Silakan coba lagi.');
    }
    
    searchBtn.disabled = false;
    searchBtn.textContent = 'Cek Tagihan';
});

// Upload bukti transfer
document.getElementById('uploadProofForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const paymentMethod = document.getElementById('paymentMethod').value;
    const proofImage = document.getElementById('proofImage').files[0];
    const uploadBtn = document.getElementById('uploadBtn');
    
    if (!proofImage) {
        showStatus('error', 'Silakan pilih bukti transfer');
        return;
    }
    
    uploadBtn.disabled = true;
    uploadBtn.textContent = 'Mengupload...';
    
    const formData = new FormData();
    formData.append('username', username);
    formData.append('payment_method', paymentMethod);
    formData.append('proof_image', proofImage);
    
    try {
        const response = await fetch(`${API_BASE}/upload-proof`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showStatus('success', 'Bukti transfer berhasil diupload!');
        } else {
            showStatus('error', data.message || 'Gagal upload bukti transfer');
        }
    } catch (error) {
        showStatus('error', 'Terjadi kesalahan. Silakan coba lagi.');
    }
    
    uploadBtn.disabled = false;
    uploadBtn.textContent = 'Upload Bukti Transfer';
});
