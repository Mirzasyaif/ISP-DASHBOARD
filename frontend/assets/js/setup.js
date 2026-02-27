// Handle form submission
document.getElementById('setup-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    
    try {
        const response = await fetch('/api/config/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (response.ok) {
            showMessage('success', 'Configuration saved successfully! Starting dashboard...');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } else {
            const error = await response.json();
            showMessage('error', `Failed to save: ${error.error || 'Unknown error'}`);
        }
    } catch (error) {
        console.error('Setup error:', error);
        showMessage('error', 'Network error. Please check your connection.');
    }
});

// Test configuration
async function testConfiguration() {
    const form = document.getElementById('setup-form');
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // Test Mikrotik connection
    showMessage('info', 'Testing Mikrotik connection...');
    
    try {
        // Test Mikrotik
        const mikrotikTest = await fetch('/api/config/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mikrotik_ip: data.mikrotik_ip,
                mikrotik_user: data.mikrotik_user,
                mikrotik_pass: data.mikrotik_pass,
                mikrotik_port: data.mikrotik_port
            })
        });
        
        if (mikrotikTest.ok) {
            showMessage('success', '✅ Mikrotik connection successful!');
        } else {
            showMessage('error', '❌ Mikrotik connection failed');
        }
    } catch (error) {
        showMessage('error', `❌ Test failed: ${error.message}`);
    }
}

function showMessage(type, text) {
    const resultDiv = document.getElementById('test-result');
    resultDiv.className = `p-3 rounded ${type === 'success' ? 'bg-green-100 text-green-700' : 
                              type === 'error' ? 'bg-red-100 text-red-700' : 
                              'bg-blue-100 text-blue-700'}`;
    resultDiv.textContent = text;
    resultDiv.classList.remove('hidden');
    
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            resultDiv.classList.add('hidden');
        }, 5000);
    }
}

// Add test endpoint to API routes
document.addEventListener('DOMContentLoaded', () => {
    // This would normally be on the backend, but for demo we'll add a mock
    window.fetch = window.fetch || function() {
        return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true })
        });
    };
});