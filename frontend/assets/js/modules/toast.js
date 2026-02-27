export const toast = {
    /**
     * Show a toast message.
     * @param {string} message - Message text.
     * @param {'success'|'error'|'info'} type - Toast type.
     */
    show(message, type = 'info') {
        // Ensure container exists
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'fixed bottom-4 right-4 flex flex-col space-y-2 z-50';
            document.body.appendChild(container);
        }

        const toastEl = document.createElement('div');
        const bgClass = {
            success: 'bg-green-600',
            error: 'bg-red-600',
            info: 'bg-gray-600'
        }[type] || 'bg-gray-600';

        toastEl.className = `${bgClass} text-white px-4 py-2 rounded shadow-md opacity-0 transform translate-y-2 transition-all duration-300`;
        toastEl.textContent = message;

        container.appendChild(toastEl);
        // Trigger animation
        requestAnimationFrame(() => {
            toastEl.classList.remove('opacity-0', 'translate-y-2');
            toastEl.classList.add('opacity-100', 'translate-y-0');
        });

        // Auto-remove after 3 seconds
        setTimeout(() => {
            toastEl.classList.remove('opacity-100', 'translate-y-0');
            toastEl.classList.add('opacity-0', 'translate-y-2');
            toastEl.addEventListener('transitionend', () => toastEl.remove());
        }, 3000);
    },
    showSuccess(message) {
        this.show(message, 'success');
    },
    showError(message) {
        this.show(message, 'error');
    },
    showInfo(message) {
        this.show(message, 'info');
    }
};