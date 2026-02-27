// Frontend configuration
// This file creates a global `window.ISP_CONFIG` object with a `fetchAPI` helper.
// The helper uses a relative URL so it works with the same origin as the dashboard.
const CONFIG = {
    // API key (should match backend .env API_KEY)
    API_KEY: 'isp_dashboard_api_key_2026',
    // License key for endpoints that require X-License-Key header
    LICENSE_KEY: 'LIC-EDCB-C543-382A-DDFA',

    // API endpoints
    ENDPOINTS: {
        STATS: '/api/stats',
        USERS: '/api/users',
        USERS_WITH_PAYMENT: '/api/users/with-payment-status',
        PAYMENTS: '/api/payments/mark-paid',
        MIKROTIK_TEST: '/api/mikrotik/test',
        MIKROTIK_ACTIVE: '/api/mikrotik/pppoe/active',
        MIKROTIK_SECRETS: '/api/mikrotik/pppoe/secrets',
        MIKROTIK_RESOURCES: '/api/mikrotik/system/resources',
        HEALTH: '/health'
    },

    // Request headers helper
    getHeaders: function(contentType = 'application/json') {
        const headers = {
            'X-API-Key': this.API_KEY,
            'X-License-Key': this.LICENSE_KEY
        };
        if (contentType) {
            headers['Content-Type'] = contentType;
        }
        return headers;
    },

    // API request helper
    fetchAPI: async function(endpoint, options = {}) {
        // Build absolute URL based on current origin (works for dev and prod)
        // Determine backend base URL.
        // Prefer a <meta name="backend-base"> tag if present (set in index.html),
        // otherwise fall back to the same origin (useful for production where
        // frontend and backend are served from the same host/port).
        const metaBase = document.querySelector('meta[name="backend-base"]');
        const backendBase = metaBase && metaBase.content ? metaBase.content : window.location.origin;
        const url = endpoint.startsWith('http')
            ? endpoint
            : `${backendBase}${endpoint}`;

        const headers = {
            ...this.getHeaders(),
            ...options.headers
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            // Authentication / permission errors
            if (response.status === 401) {
                console.error('Authentication failed');
                throw new Error('Authentication failed');
            }
            if (response.status === 403) {
                console.error('Forbidden');
                throw new Error('Forbidden');
            }

            if (!response.ok) {
                const err = await response.text();
                console.error('API error:', err);
                throw new Error(`API error ${response.status}`);
            }

            const ct = response.headers.get('content-type') || '';
            return ct.includes('application/json')
                ? await response.json()
                : await response.text();
        } catch (e) {
            console.error('fetchAPI error:', e);
            throw e;
        }
    },

    // Simple health‑check wrapper (kept for compatibility)
    testConnection: async function() {
        try {
            const health = await this.fetchAPI(this.ENDPOINTS.HEALTH);
            return { success: true, data: health };
        } catch (e) {
            return { success: false, error: e };
        }
    }
};

// Export for Node environments (e.g., server‑side rendering)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

// Expose globally for the dashboard scripts
window.ISP_CONFIG = CONFIG;