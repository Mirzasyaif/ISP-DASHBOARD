export function getElement(id, silent = false) {
    const el = document.getElementById(id);
    if (!el && !silent) {
        console.warn(`Element with ID '${id}' not found`);
    }
    return el;
}

export function showLoading(elementId, show = true) {
    const element = getElement(elementId);
    if (element) {
        if (show) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading-overlay absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10';
            loadingDiv.id = `${elementId}-loading`;
            loadingDiv.innerHTML = `
                <div class="flex flex-col items-center">
                    <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                    <div class="mt-2 text-sm text-gray-600">Loading...</div>
                </div>
            `;
            if (element.style.position !== 'relative') {
                element.style.position = 'relative';
            }
            const existing = document.getElementById(`${elementId}-loading`);
            if (existing) existing.remove();
            element.appendChild(loadingDiv);
        } else {
            const existing = document.getElementById(`${elementId}-loading`);
            if (existing) existing.remove();
        }
    }
}

export function showButtonLoading(button, show = true) {
    if (!button) return;
    if (show) {
        button.disabled = true;
        const originalText = button.innerHTML;
        button.setAttribute('data-original-text', originalText);
        button.innerHTML = `
            <div class="flex items-center justify-center space-x-2">
                <div class="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current"></div>
                <span>Processing...</span>
            </div>
        `;
        button.classList.add('opacity-70');
    } else {
        button.disabled = false;
        const originalText = button.getAttribute('data-original-text');
        if (originalText) {
            button.innerHTML = originalText;
        }
        button.classList.remove('opacity-70');
    }
}

export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function formatUptime(uptime) {
    if (!uptime) return 'N/A';
    return uptime;
}

export function formatRupiah(amount) {
    if (amount === null || amount === undefined) return 'Rp 0';
    const formatter = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
    return formatter.format(amount);
}