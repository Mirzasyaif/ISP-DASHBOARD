let paymentChart = null;

// Use global configuration from config.js
const DASH_CONFIG = window.ISP_CONFIG;

// Current page for pagination
let currentPage = 1;
const itemsPerPage = 10;
let allPppoeUsers = [];

function getElement(id) {
    const el = document.getElementById(id);
    if (!el) {
        console.warn(`Element with ID '${id}' not found`);
    }
    return el;
}

function showLoading(elementId, show = true) {
    const element = getElement(elementId);
    if (element) {
        if (show) {
            // Create loading overlay
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'loading-overlay absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10';
            loadingDiv.id = `${elementId}-loading`;
            loadingDiv.innerHTML = `
                <div class="flex flex-col items-center">
                    <div class="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
                    <div class="mt-2 text-sm text-gray-600">Loading...</div>
                </div>
            `;
            
            // Position relative container
            if (element.style.position !== 'relative') {
                element.style.position = 'relative';
            }
            
            // Remove existing loading overlay if exists
            const existing = document.getElementById(`${elementId}-loading`);
            if (existing) existing.remove();
            
            element.appendChild(loadingDiv);
        } else {
            const existing = document.getElementById(`${elementId}-loading`);
            if (existing) existing.remove();
        }
    }
}

function showButtonLoading(button, show = true) {
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

async function loadDashboardData() {
    console.log('loadDashboardData starting...');
    try {
        // Check if DASH_CONFIG exists
        if (!DASH_CONFIG || !DASH_CONFIG.fetchAPI) {
            console.error('DASH_CONFIG not found or missing fetchAPI method');
            updateConnectionStatus('Configuration error: DASH_CONFIG not loaded', 'error');
            return;
        }
        
        console.log('Loading dashboard data...');
        updateConnectionStatus('Connecting to API...', 'info');
        
        // Show loading states
        showLoading('pppoe-table', true);
        showLoading('paymentChart', true);
        
        // Show loading in stats cards
        const totalUsersEl = getElement('total-users');
        const paidUsersEl = getElement('paid-users');
        const pendingUsersEl = getElement('pending-users');
        const mikrotikStatusEl = getElement('mikrotik-status');
        
        if (totalUsersEl) totalUsersEl.textContent = '...';
        if (paidUsersEl) paidUsersEl.textContent = '...';
        if (pendingUsersEl) pendingUsersEl.textContent = '...';
        if (mikrotikStatusEl) mikrotikStatusEl.textContent = '...';
        
        // Test API connection first (using health endpoint)
        let apiConnected = false;
        try {
            const health = await DASH_CONFIG.fetchAPI('/health');
            apiConnected = true;
            updateConnectionStatus('API connected successfully', 'success');
            console.log('API health:', health);
        } catch (error) {
            showLoading('pppoe-table', false);
            showLoading('paymentChart', false);
            updateConnectionStatus('API connection failed: ' + error.message, 'error');
            throw new Error('Cannot connect to backend API. Please check server status.');
        }
        
        if (!apiConnected) return;
        
        // Test Mikrotik connection and update status card
        updateConnectionStatus('Testing Mikrotik connection...', 'info');
        try {
            const testResult = await DASH_CONFIG.fetchAPI('/api/mikrotik/test');
            const mikrotikStatusEl = getElement('mikrotik-status');
            if (mikrotikStatusEl) {
                mikrotikStatusEl.textContent = testResult.success ? '✅' : '❌';
            }
            updateConnectionStatus(testResult.success ? 'Mikrotik connected successfully' : 'Mikrotik connection failed', 
                                 testResult.success ? 'success' : 'error');
            
            // Update Mikrotik status card with detailed info
            if (testResult.success) {
                await updateMikrotikStatusCard();
            } else {
                updateMikrotikStatusCardError('Connection failed');
            }
        } catch (error) {
            const mikrotikStatusEl = getElement('mikrotik-status');
            if (mikrotikStatusEl) mikrotikStatusEl.textContent = '❌';
            updateConnectionStatus('Mikrotik test failed: ' + error.message, 'error');
            updateMikrotikStatusCardError(error.message);
            // Continue loading other data even if Mikrotik fails
        }
        
        // Load stats
        const stats = await DASH_CONFIG.fetchAPI('/api/stats');
        console.log('Stats loaded:', stats);
        
        // Update stats cards with actual data
        if (totalUsersEl) totalUsersEl.textContent = stats.totalUsers;
        if (paidUsersEl) paidUsersEl.textContent = stats.paidThisMonth;
        if (pendingUsersEl) pendingUsersEl.textContent = stats.pendingPayments;

        // Load enhanced PPPoE data with payment status and bandwidth
        try {
            const pppoe = await DASH_CONFIG.fetchAPI('/api/mikrotik/pppoe/active');
            console.log('PPPoE data loaded:', pppoe);
            
            // Load payment status
            const usersWithPaymentStatus = await DASH_CONFIG.fetchAPI('/api/users/with-payment-status');
            console.log('Payment status loaded:', usersWithPaymentStatus);
            
            // Load interface stats for bandwidth data
            const interfaceStats = await DASH_CONFIG.fetchAPI('/api/mikrotik/interface/stats').catch(() => []);
            console.log('Interface stats loaded:', interfaceStats.length, 'interfaces');
            
            // Store all users for pagination
            allPppoeUsers = [];
            let activeCount = 0;
            let paidCount = 0;
            let pendingCount = 0;
            
            if (Array.isArray(pppoe) && pppoe.length > 0) {
                pppoe.forEach(user => {
                    const username = user.name || user['ppp-login'] || 'N/A';
                    const isActive = username !== 'N/A';
                    const ipAddress = user.address || 'N/A';
                    const uptime = user.uptime || 'N/A';
                    
                    if (isActive) activeCount++;
                    
                    // Find user in database
                    const userData = usersWithPaymentStatus.find(u => 
                        u.pppoe_username && u.pppoe_username.toUpperCase() === username.toUpperCase()
                    );
                    
                    const hasPaidThisMonth = userData ? userData.has_paid_this_month : false;
                    
                    // Count payment status
                    if (hasPaidThisMonth) {
                        paidCount++;
                    } else {
                        pendingCount++;
                    }
                    
                    // Find bandwidth data for this user
                    let bandwidth = 'N/A';
                    if (Array.isArray(interfaceStats)) {
                        const userInterface = interfaceStats.find(intf => 
                            intf.name && intf.name.includes(username.toUpperCase())
                        );
                        
                        if (userInterface && userInterface['rx-byte'] && userInterface['tx-byte']) {
                            const rxMB = Math.round(userInterface['rx-byte'] / (1024 * 1024));
                            const txMB = Math.round(userInterface['tx-byte'] / (1024 * 1024));
                            bandwidth = `↓${rxMB}MB / ↑${txMB}MB`;
                        }
                    }
                    
                    allPppoeUsers.push({
                        username,
                        isActive,
                        ipAddress,
                        uptime,
                        hasPaidThisMonth,
                        bandwidth
                    });
                });
            }
            
            // Render table with pagination
            renderTableWithPagination();
            
            // Update active count
            const activeCountEl = getElement('active-count');
            if (activeCountEl) {
                activeCountEl.textContent = `${activeCount} active (${paidCount} paid, ${pendingCount} pending)`;
            }
        } catch (error) {
            console.error('Failed to load PPPoE data:', error);
            const activeCountEl = getElement('active-count');
            if (activeCountEl) activeCountEl.textContent = 'Error loading';
            
            const tableBody = getElement('pppoe-table');
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="4" class="py-4 px-4 text-center text-red-500">Error loading PPPoE data: ' + escapeHtml(error.message) + '</td></tr>';
            }
        }

        // Update chart
        updatePaymentChart(stats.paymentData);
        
        // Hide loading states
        showLoading('pppoe-table', false);
        showLoading('paymentChart', false);
        
        // Update live status
        const liveStatusEl = getElement('live-status');
        if (liveStatusEl) {
            liveStatusEl.className = 'px-3 py-1 bg-green-500 rounded-full';
            liveStatusEl.textContent = '● Live';
        }
        
        updateConnectionStatus('All systems operational', 'success');
        console.log('loadDashboardData completed successfully');
        
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
        const liveStatusEl = getElement('live-status');
        if (liveStatusEl) {
            liveStatusEl.className = 'px-3 py-1 bg-red-500 rounded-full';
            liveStatusEl.textContent = '● Error';
        }
        updateConnectionStatus('Dashboard error: ' + error.message, 'error');
        
        // Hide loading states
        showLoading('pppoe-table', false);
        showLoading('paymentChart', false);
        
        // Show error in table
        const tableBody = getElement('pppoe-table');
        if (tableBody) {
            tableBody.innerHTML = '<tr><td colspan="4" class="py-4 px-4 text-center text-red-500">Dashboard error: ' + escapeHtml(error.message) + '</td></tr>';
        }
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateConnectionStatus(message, type) {
    const statusEl = getElement('connection-status');
    const debugEl = getElement('debug-info');
    
    if (statusEl) statusEl.textContent = message;
    if (debugEl) debugEl.textContent = new Date().toLocaleTimeString();
    
    // Update styling based on type
    const container = document.querySelector('.bg-yellow-50');
    if (container) {
        if (type === 'success') {
            container.className = 'bg-green-50 border-l-4 border-green-400 p-4';
            if (statusEl) statusEl.className = 'text-sm text-green-700';
        } else if (type === 'error') {
            container.className = 'bg-red-50 border-l-4 border-red-400 p-4';
            if (statusEl) statusEl.className = 'text-sm text-red-700';
        } else if (type === 'info') {
            container.className = 'bg-blue-50 border-l-4 border-blue-400 p-4';
            if (statusEl) statusEl.className = 'text-sm text-blue-700';
        } else {
            container.className = 'bg-yellow-50 border-l-4 border-yellow-400 p-4';
            if (statusEl) statusEl.className = 'text-sm text-yellow-700';
        }
    }
}

function formatUptime(uptime) {
    if (!uptime) return 'N/A';
    return uptime;
}

// Update Mikrotik status card with detailed information
async function updateMikrotikStatusCard() {
    try {
        // Get active users count
        const pppoe = await DASH_CONFIG.fetchAPI('/api/mikrotik/pppoe/active');
        const activeCount = Array.isArray(pppoe) ? pppoe.length : 0;
        
        // Get system resources
        const resources = await DASH_CONFIG.fetchAPI('/api/mikrotik/system/resources').catch(() => ({}));
        
        // Get interface statistics
        const interfaces = await DASH_CONFIG.fetchAPI('/api/mikrotik/interface/stats').catch(() => []);
        
        // Update the Mikrotik status card
        const onlineEl = getElement('mikrotik-online');
        const uptimeEl = getElement('mikrotik-uptime');
        
        if (onlineEl) {
            onlineEl.textContent = `${activeCount} users online`;
            onlineEl.className = 'text-sm text-green-600 mt-1';
        }
        
        if (uptimeEl) {
            const now = new Date();
            uptimeEl.textContent = `Last check: ${now.toLocaleTimeString()}`;
            uptimeEl.className = 'text-xs text-gray-500';
        }
        
        // Update active count in the table header too
        const activeCountEl = getElement('active-count');
        if (activeCountEl) {
            activeCountEl.textContent = `${activeCount} active`;
        }
        
        console.log(`Mikrotik status updated: ${activeCount} users online`);
        
    } catch (error) {
        console.error('Failed to update Mikrotik status card:', error);
        updateMikrotikStatusCardError('Failed to load data');
    }
}

function updateMikrotikStatusCardError(errorMessage) {
    const onlineEl = getElement('mikrotik-online');
    const uptimeEl = getElement('mikrotik-uptime');
    
    if (onlineEl) {
        onlineEl.textContent = `Error: ${errorMessage}`;
        onlineEl.className = 'text-sm text-red-600 mt-1';
    }
    
    if (uptimeEl) {
        const now = new Date();
        uptimeEl.textContent = `Last check: ${now.toLocaleTimeString()}`;
        uptimeEl.className = 'text-xs text-red-500';
    }
}

// Functions for pagination and table rendering
function renderTableWithPagination() {
    const tableBody = getElement('pppoe-table');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedUsers = allPppoeUsers.slice(startIndex, endIndex);
    
    if (paginatedUsers.length > 0) {
        paginatedUsers.forEach(user => {
            const { username, isActive, ipAddress, uptime, hasPaidThisMonth, bandwidth } = user;
            
            // Determine button color and text
            let buttonColor = 'bg-blue-500 hover:bg-blue-600';
            let buttonText = 'Mark Paid';
            let buttonDisabled = !isActive;
            
            if (hasPaidThisMonth) {
                buttonColor = 'bg-green-500 hover:bg-green-600';
                buttonText = 'PAID';
                buttonDisabled = true; // Disable button if already paid
            }
            
            const row = document.createElement('tr');
            row.className = 'border-b hover:bg-gray-50';
            row.innerHTML = `
                <td class="py-2 px-4 table-cell-compact">
                    <div class="font-medium">${escapeHtml(username)}</div>
                    <div class="text-xs text-gray-500">${escapeHtml(ipAddress)}</div>
                </td>
                <td class="py-2 px-4 table-cell-compact">
                    <span class="px-2 py-1 rounded ${isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${isActive ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td class="py-2 px-4 table-cell-compact">
                    <div>${formatUptime(uptime)}</div>
                    <div class="text-xs text-gray-500">${escapeHtml(bandwidth)}</div>
                </td>
                <td class="py-2 px-4 table-cell-compact">
                    <div class="flex flex-col space-y-1">
                        <button onclick="markPaid('${escapeHtml(username).replace(/'/g, "\\'")}', this)" 
                                class="px-3 py-1 ${buttonColor} text-white rounded text-sm ${buttonDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}"
                                ${buttonDisabled ? 'disabled' : ''}>
                            ${buttonText}
                        </button>
                        ${isActive && !hasPaidThisMonth ? 
                            `<button onclick="disconnectUser('${escapeHtml(username).replace(/'/g, "\\'")}', this)" 
                                    class="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm mt-1">
                                Disconnect
                            </button>` : ''
                        }
                        <div class="text-xs ${hasPaidThisMonth ? 'text-green-600' : 'text-red-600'}">
                            ${hasPaidThisMonth ? '✅ Paid' : '⚠️ Pending'}
                        </div>
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } else {
        // No active users
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="4" class="py-4 px-4 text-center text-gray-500">No active PPPoE users found</td>';
        tableBody.appendChild(row);
    }
    
    // Render pagination controls
    renderPaginationControls();
}

function renderPaginationControls() {
    // Remove existing pagination if exists
    const existingPagination = document.getElementById('pppoe-pagination');
    if (existingPagination) existingPagination.remove();
    
    const totalPages = Math.ceil(allPppoeUsers.length / itemsPerPage);
    if (totalPages <= 1) return;
    
    const tableContainer = document.querySelector('.bg-white.p-6.rounded-lg.shadow:has(#pppoe-table)');
    if (!tableContainer) return;
    
    // Create pagination container
    const paginationDiv = document.createElement('div');
    paginationDiv.id = 'pppoe-pagination';
    paginationDiv.className = 'mt-4 flex items-center justify-between';
    
    // Page info
    const startItem = (currentPage - 1) * itemsPerPage + 1;
    const endItem = Math.min(currentPage * itemsPerPage, allPppoeUsers.length);
    
    paginationDiv.innerHTML = `
        <div class="text-sm text-gray-700">
            Showing ${startItem} to ${endItem} of ${allPppoeUsers.length} users
        </div>
        <div class="flex space-x-2">
            <button onclick="changePage(${currentPage - 1})" 
                    ${currentPage <= 1 ? 'disabled' : ''}
                    class="px-3 py-1 rounded bg-gray-100 ${currentPage <= 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-200'}">
                Previous
            </button>
            <div class="flex space-x-1">
                ${Array.from({length: Math.min(totalPages, 5)}, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                        pageNum = i + 1;
                    } else if (currentPage <= 3) {
                        pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                    } else {
                        pageNum = currentPage - 2 + i;
                    }
                    
                    return `
                        <button onclick="changePage(${pageNum})" 
                                class="px-3 py-1 rounded ${currentPage === pageNum ? 'bg-blue-600 text-white' : 'bg-gray-100 hover:bg-gray-200'}">
                            ${pageNum}
                        </button>
                    `;
                }).join('')}
            </div>
            <button onclick="changePage(${currentPage + 1})" 
                    ${currentPage >= totalPages ? 'disabled' : ''}
                    class="px-3 py-1 rounded bg-gray-100 ${currentPage >= totalPages ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-200'}">
                Next
            </button>
        </div>
    `;
    
    // Insert after the table
    const table = tableContainer.querySelector('table');
    if (table) {
        table.parentNode.insertBefore(paginationDiv, table.nextSibling);
    } else {
        tableContainer.appendChild(paginationDiv);
    }
}

function changePage(page) {
    const totalPages = Math.ceil(allPppoeUsers.length / itemsPerPage);
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    renderTableWithPagination();
}

// Other functions remain similar but simplified
async function markPaid(username, button) {
    if (!username || username === 'N/A') {
        alert('Invalid username');
        return;
    }
    
    // Show button loading
    if (button) showButtonLoading(button, true);
    
    try {
        await DASH_CONFIG.fetchAPI('/api/payments/mark-paid', {
            method: 'POST',
            body: JSON.stringify({ username })
        });
        
        alert(`Payment for ${username} marked as PAID`);
        loadDashboardData(); // Refresh
    } catch (error) {
        console.error('Payment error:', error);
        alert('Payment error: ' + error.message);
    } finally {
        // Hide button loading
        if (button) showButtonLoading(button, false);
    }
}

async function disconnectUser(username, button) {
    if (!username || username === 'N/A') {
        alert('Invalid username');
        return;
    }
    
    if (!confirm(`Disconnect ${username}? This will terminate their active session.`)) {
        return;
    }
    
    // Show button loading
    if (button) showButtonLoading(button, true);
    
    try {
        const result = await DASH_CONFIG.fetchAPI('/api/mikrotik/pppoe/disconnect', {
            method: 'POST',
            body: JSON.stringify({ username })
        });
        
        alert(`Disconnected ${username}`);
        loadDashboardData(); // Refresh
    } catch (error) {
        console.error('Disconnect error:', error);
        alert('Disconnect error: ' + error.message);
    } finally {
        // Hide button loading
        if (button) showButtonLoading(button, false);
    }
}

function refreshData() {
    loadDashboardData();
}

console.log('dashboard-fixed.js loaded successfully');