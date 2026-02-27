import { getElement, showLoading, showButtonLoading, escapeHtml, formatUptime, formatRupiah } from './modules/utils.js';
import { toast } from './modules/toast.js';
import { fetchAPI } from './modules/api.js';
import { store } from './modules/state.js';

// Simple global configuration (kept for backward compatibility)
const DASH_CONFIG = window.ISP_CONFIG;

// Pagination and state variables
let currentPage = 1;
const itemsPerPage = 10;
let allPppoeUsers = [];

// Global chart reference
let paymentChart = null;

// -----------------------------------------------------------------------------
// Helper wrappers (now imported from modules)
// -----------------------------------------------------------------------------

// -----------------------------------------------------------------------------
// Core dashboard functions
// -----------------------------------------------------------------------------

async function loadDashboardData() {
    console.log('loadDashboardData starting...');
    try {
        // Verify fetchAPI availability
        if (!fetchAPI) {
            console.error('fetchAPI not available');
            updateConnectionStatus('Configuration error: fetchAPI missing', 'error');
            return;
        }

        console.log('Loading dashboard data...');
        updateConnectionStatus('Connecting to API...', 'info');

        // Show loading states
        showLoading('pppoe-table', true);
        showTableSkeleton();
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
            const health = await fetchAPI('/health');
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
            const testResult = await fetchAPI('/api/mikrotik/test');
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

        // Load stats and related data in parallel with caching (30 seconds TTL)
        const cachedData = store.get('dashboardData');
        let stats, pppoe, usersWithPaymentStatus, interfaceStats;
        if (cachedData) {
            ({ stats, pppoe, usersWithPaymentStatus, interfaceStats } = cachedData);
            console.log('Using cached dashboard data');
        } else {
            try {
                const [statsRes, pppoeRes, paymentRes, ifaceRes] = await Promise.all([
                    fetchAPI('/api/stats'),
                    fetchAPI('/api/mikrotik/pppoe/active'),
                    fetchAPI('/api/users/with-payment-status'),
                    fetchAPI('/api/mikrotik/interface/stats').catch(() => [])
                ]);
                stats = statsRes;
                pppoe = pppoeRes;
                usersWithPaymentStatus = paymentRes;
                interfaceStats = ifaceRes;
                store.set('dashboardData', { stats, pppoe, usersWithPaymentStatus, interfaceStats });
                console.log('Fetched dashboard data from API');
            } catch (error) {
                console.error('Failed to fetch dashboard data:', error);
                throw error;
            }
        }

        // Update stats cards with actual data
        if (totalUsersEl) {
            totalUsersEl.textContent = stats.totalUsers;
            // Hide skeleton and show real value
            const sk = document.getElementById('total-users-skeleton');
            if (sk) sk.style.display = 'none';
            totalUsersEl.classList.remove('hidden');
        }
        if (paidUsersEl) {
            paidUsersEl.textContent = stats.paidThisMonth;
            const sk = document.getElementById('paid-users-skeleton');
            if (sk) sk.style.display = 'none';
            paidUsersEl.classList.remove('hidden');
        }
        if (pendingUsersEl) {
            pendingUsersEl.textContent = stats.pendingPayments;
            const sk = document.getElementById('pending-users-skeleton');
            if (sk) sk.style.display = 'none';
            pendingUsersEl.classList.remove('hidden');
        }

        // Process PPPoE data
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

                const userData = usersWithPaymentStatus.find(u =>
                    u.pppoe_username && u.pppoe_username.toUpperCase() === username.toUpperCase()
                );

                const hasPaidThisMonth = userData ? userData.has_paid_this_month : false;

                if (hasPaidThisMonth) {
                    paidCount++;
                } else {
                    pendingCount++;
                }

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

        // Update chart
        const paymentData = stats.paymentData || [stats.paidThisMonth || 0, stats.pendingPayments || 0, 0];
        console.log('Updating chart with payment data:', paymentData, 'from stats:', stats);
        updatePaymentChart(paymentData);
        // Hide chart skeleton and show canvas
        const chartSkeleton = document.getElementById('paymentChartSkeleton');
        const chartCanvas = document.getElementById('paymentChart');
        if (chartSkeleton) chartSkeleton.style.display = 'none';
        if (chartCanvas) chartCanvas.classList.remove('hidden');

        // Load financial overview data
        await loadFinancialOverview();

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
            tableBody.innerHTML = `<tr><td colspan="5" class="py-4 px-4 text-center text-red-500">Dashboard error: ${escapeHtml(error.message)}</td></tr>`;
        }
    }
}

// -----------------------------------------------------------------------------
// UI helpers (imported)
// -----------------------------------------------------------------------------

// The functions getElement, showLoading, showButtonLoading, escapeHtml,
// formatUptime, formatRupiah are imported from utils.js

// -----------------------------------------------------------------------------
// Connection status handling
// -----------------------------------------------------------------------------
function updateConnectionStatus(message, type) {
    const statusEl = getElement('connection-status');
    const debugEl = getElement('debug-info', true); // Silent - optional element

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

// -----------------------------------------------------------------------------
// Misc utilities (imported)
// -----------------------------------------------------------------------------

// formatUptime, escapeHtml, formatRupiah are imported from utils.js

// -----------------------------------------------------------------------------
// Mikrotik status card
// -----------------------------------------------------------------------------
async function updateMikrotikStatusCard() {
    try {
        const pppoe = await fetchAPI('/api/mikrotik/pppoe/active');
        const activeCount = Array.isArray(pppoe) ? pppoe.length : 0;

        const resources = await fetchAPI('/api/mikrotik/system/resources').catch(() => ({}));

        const interfaces = await fetchAPI('/api/mikrotik/interface/stats').catch(() => []);

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

// -----------------------------------------------------------------------------
// Table rendering & pagination
// -----------------------------------------------------------------------------
function showTableSkeleton() {
    const tableBody = getElement('pppoe-table');
    if (!tableBody) return;
    const skeletonRow = `
        <tr>
            <td class="py-2 px-4"><div class="skeleton h-4 w-20 animate-pulse"></div></td>
            <td class="py-2 px-4"><div class="skeleton h-4 w-20 animate-pulse"></div></td>
            <td class="py-2 px-4"><div class="skeleton h-4 w-20 animate-pulse"></div></td>
            <td class="py-2 px-4"><div class="skeleton h-4 w-20 animate-pulse"></div></td>
            <td class="py-2 px-4"><div class="skeleton h-4 w-20 animate-pulse"></div></td>
        </tr>
    `;
    tableBody.innerHTML = skeletonRow.repeat(5);
}

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
                </td>
                <td class="py-2 px-4 table-cell-compact">
                    <div class="text-sm">${escapeHtml(ipAddress)}</div>
                </td>
                <td class="py-2 px-4 table-cell-compact">
                    <span class="px-2 py-1 rounded ${isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                        ${isActive ? 'Active' : 'Inactive'}
                    </span>
                    <div class="text-xs ${hasPaidThisMonth ? 'text-green-600' : 'text-red-600'} mt-1">
                        ${hasPaidThisMonth ? '✅ Paid' : '⚠️ Pending'}
                    </div>
                </td>
                <td class="py-2 px-4 table-cell-compact">
                    <div>${formatUptime(uptime)}</div>
                    <div class="text-xs text-gray-500">${escapeHtml(bandwidth)}</div>
                </td>
                <td class="py-2 px-4 table-cell-compact">
                    <div class="flex flex-col space-y-1">
                        <button onclick="markPaid('${escapeHtml(username).replace(/'/g, "\\\\'")}', this)"
                                class="px-3 py-1 ${buttonColor} text-white rounded text-sm ${buttonDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}"
                                ${buttonDisabled ? 'disabled' : ''}>
                            ${buttonText}
                        </button>
                        ${isActive && !hasPaidThisMonth ?
                            `<button onclick="disconnectUser('${escapeHtml(username).replace(/'/g, "\\\\'")}', this)"
                                    class="px-3 py-1 bg-red-500 hover:bg-red-600 text-white rounded text-sm mt-1">
                                Disconnect
                            </button>` : ''
                        }
                    </div>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } else {
        // No active users
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="5" class="py-4 px-4 text-center text-gray-500">No active PPPoE users found</td>';
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

    // Find table container using more compatible approach
    const table = document.querySelector('table');
    if (!table) return;
    
    // Get the parent container of the table
    let tableContainer = table.closest('.bg-white.p-6.rounded-lg.shadow');
    if (!tableContainer) {
        // Fallback: use the table's parent
        tableContainer = table.parentElement;
    }
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
    const targetTable = tableContainer.querySelector('table');
    if (targetTable) {
        targetTable.parentNode.insertBefore(paginationDiv, targetTable.nextSibling);
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

// -----------------------------------------------------------------------------
// Search functionality
// -----------------------------------------------------------------------------
let searchTimeout = null;
function searchUsers(query) {
    const searchResultsEl = getElement('search-results');

    if (!query || query.trim() === '') {
        // If search is cleared, show all users
        if (searchResultsEl) {
            searchResultsEl.classList.add('hidden');
        }
        renderTableWithPagination();
        return;
    }

    // Clear previous timeout
    if (searchTimeout) clearTimeout(searchTimeout);

    // Show searching indicator
    if (searchResultsEl) {
        searchResultsEl.classList.remove('hidden');
        searchResultsEl.textContent = 'Searching...';
    }

    // Debounce search for better performance
    searchTimeout = setTimeout(() => {
        const searchQuery = query.toLowerCase().trim();
        const filteredUsers = allPppoeUsers.filter(user => {
            return user.username.toLowerCase().includes(searchQuery) ||
                   user.ipAddress.toLowerCase().includes(searchQuery) ||
                   (user.hasPaidThisMonth ? 'paid' : 'pending').includes(searchQuery) ||
                   (user.isActive ? 'active' : 'inactive').includes(searchQuery);
        });

        // Update search results indicator
        if (searchResultsEl) {
            if (filteredUsers.length === 0) {
                searchResultsEl.textContent = `No results for "${query}"`;
                searchResultsEl.className = 'text-sm text-red-600';
            } else {
                searchResultsEl.textContent = `${filteredUsers.length} results for "${query}"`;
                searchResultsEl.className = 'text-sm text-green-600';
            }
        }

        // Render filtered users (temporarily override allPppoeUsers for rendering)
        const originalUsers = allPppoeUsers;
        allPppoeUsers = filteredUsers;
        currentPage = 1; // Reset to first page when searching
        renderTableWithPagination();
        allPppoeUsers = originalUsers; // Restore original data
    }, 500);
}

// -----------------------------------------------------------------------------
// Chart handling
// -----------------------------------------------------------------------------
function updatePaymentChart(data) {
    try {
        // Check if Chart.js is available
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js library not loaded');
            return;
        }

        const canvas = document.getElementById('paymentChart');
        if (!canvas) {
            console.warn('Chart canvas not found');
            return;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) {
            console.warn('Canvas context not available');
            return;
        }

        // Safely destroy existing chart
        if (window.paymentChart && typeof window.paymentChart === 'object') {
            // Verify it's a Chart instance before destroying
            if (typeof window.paymentChart.destroy === 'function' && window.paymentChart.constructor.name === 'Chart') {
                window.paymentChart.destroy();
            }
            window.paymentChart = null;
        }

        // Validate data
        if (!Array.isArray(data) || data.length !== 3) {
            console.warn('Invalid chart data:', data);
            // Set default data if invalid
            data = [0, 0, 0];
        }

        // Create new chart
        window.paymentChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Paid', 'Pending', 'Overdue'],
                datasets: [{
                    data: data,
                    backgroundColor: ['#10B981', '#F59E0B', '#EF4444'],
                    borderWidth: 1,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { 
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                                return `${label}: ${value} users (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });

        console.log('Payment chart updated successfully with data:', data);
    } catch (error) {
        console.error('Failed to update payment chart:', error);
        // Don't throw error to prevent breaking the whole dashboard
    }
}

// -----------------------------------------------------------------------------
// Payment actions
// -----------------------------------------------------------------------------
async function markPaid(username, button) {
    if (!username || username === 'N/A') {
        alert('Invalid username');
        return;
    }

    // Show button loading
    if (button) showButtonLoading(button, true);

    try {
        await fetchAPI('/api/payments/mark-paid', {
            method: 'POST',
            body: JSON.stringify({ username })
        });

        toast.showSuccess(`Payment for ${username} marked as PAID`);
        loadDashboardData(); // Refresh
    } catch (error) {
        console.error('Payment error:', error);
        toast.showError('Payment error: ' + error.message);
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
        const result = await fetchAPI('/api/mikrotik/pppoe/disconnect', {
            method: 'POST',
            body: JSON.stringify({ username })
        });

        toast.showSuccess(`Disconnected ${username}`);
        loadDashboardData(); // Refresh
    } catch (error) {
        console.error('Disconnect error:', error);
        toast.showError('Disconnect error: ' + error.message);
    } finally {
        // Hide button loading
        if (button) showButtonLoading(button, false);
    }
}

// -----------------------------------------------------------------------------
// Financial overview
// -----------------------------------------------------------------------------
async function loadFinancialOverview() {
    try {
        const financialData = await fetchAPI('/api/financial/dashboard');

        // Update financial overview widgets
        const monthlyRevenueEl = getElement('monthly-revenue');
        const netProfitEl = getElement('net-profit');
        const cashFlowEl = getElement('cash-flow');
        const outstandingEl = getElement('outstanding');
        const revenueChangeEl = getElement('revenue-change');
        const profitMarginEl = getElement('profit-margin');
        const cashConversionEl = getElement('cash-conversion');
        const outstandingCountEl = getElement('outstanding-count');
        const updateTimeEl = getElement('financial-update-time');

        // Format and display values
        if (monthlyRevenueEl) {
            monthlyRevenueEl.textContent = formatRupiah(financialData.thisMonthRevenue || financialData.totalRevenue || 0);
        }

        if (netProfitEl) {
            netProfitEl.textContent = formatRupiah(financialData.netProfit || 0);
        }

        if (cashFlowEl) {
            cashFlowEl.textContent = formatRupiah(financialData.cashFlow || 0);
        }

        if (outstandingEl) {
            outstandingEl.textContent = formatRupiah(financialData.outstanding || 0);
        }

        if (revenueChangeEl) {
            const change = financialData.revenueChange || 0;
            revenueChangeEl.textContent = `${change >= 0 ? '+' : ''}${change}% vs last month`;
            revenueChangeEl.className = change >= 0 ? 'text-xs text-green-500 mt-1' : 'text-xs text-red-500 mt-1';
        }

        if (profitMarginEl) {
            const margin = financialData.profitMargin || 0;
            profitMarginEl.textContent = `Margin: ${margin}%`;
            profitMarginEl.className = margin >= 0 ? 'text-xs text-green-500 mt-1' : 'text-xs text-red-500 mt-1';
        }

        if (cashConversionEl) {
            const conversion = financialData.cashConversion || 0;
            cashConversionEl.textContent = `Conversion: ${conversion}%`;
        }

        if (outstandingCountEl) {
            outstandingCountEl.textContent = `${financialData.pendingPayments || 0} clients`;
        }

        if (updateTimeEl) {
            updateTimeEl.textContent = `Last updated: ${new Date().toLocaleTimeString('id-ID')}`;
        }

        console.log('Financial overview loaded successfully');

    } catch (error) {
        console.error('Failed to load financial overview:', error);
        // Set default values on error
        const monthlyRevenueEl = getElement('monthly-revenue');
        const netProfitEl = getElement('net-profit');
        const cashFlowEl = getElement('cash-flow');
        const outstandingEl = getElement('outstanding');

        if (monthlyRevenueEl) monthlyRevenueEl.textContent = 'Rp 0';
        if (netProfitEl) netProfitEl.textContent = 'Rp 0';
        if (cashFlowEl) cashFlowEl.textContent = 'Rp 0';
        if (outstandingEl) outstandingEl.textContent = 'Rp 0';
    }
}

// -----------------------------------------------------------------------------
// UI actions
// -----------------------------------------------------------------------------
function refreshFinancialData() {
    loadFinancialOverview();
}

function viewFinancialReport(period) {
    window.location.href = `financial.html?period=${period}`;
}

function exportFinancialData() {
    alert('Export feature coming soon!');
}

// -----------------------------------------------------------------------------
// User Management Functions
// -----------------------------------------------------------------------------
async function importFromMikrotik() {
    try {
        updateConnectionStatus('Importing users from Mikrotik...', 'info');
        const result = await fetchAPI('/api/mikrotik/import-users', {
            method: 'POST'
        });
        toast.showSuccess(`Imported ${result.count || 0} users from Mikrotik`);
        loadDashboardData();
    } catch (error) {
        console.error('Import error:', error);
        toast.showError('Import error: ' + error.message);
    }
}

async function checkMikrotikConnection() {
    try {
        updateConnectionStatus('Testing Mikrotik connection...', 'info');
        const result = await fetchAPI('/api/mikrotik/test');
        if (result.success) {
            toast.showSuccess('Mikrotik connection successful');
            updateConnectionStatus('Mikrotik connected successfully', 'success');
            updateMikrotikStatusCard();
        } else {
            toast.showError('Mikrotik connection failed');
            updateConnectionStatus('Mikrotik connection failed', 'error');
        }
    } catch (error) {
        console.error('Connection test error:', error);
        toast.showError('Connection test error: ' + error.message);
        updateConnectionStatus('Connection test failed: ' + error.message, 'error');
    }
}

async function disableUnpaidUsers() {
    if (!confirm('Are you sure you want to disable all unpaid users? This will disconnect their active sessions.')) {
        return;
    }

    try {
        updateConnectionStatus('Disabling unpaid users...', 'info');
        const result = await fetchAPI('/api/mikrotik/disable-unpaid', {
            method: 'POST'
        });
        toast.showSuccess(`Disabled ${result.count || 0} unpaid users`);
        loadDashboardData();
    } catch (error) {
        console.error('Disable users error:', error);
        toast.showError('Disable users error: ' + error.message);
    }
}

async function enableAllUsers() {
    if (!confirm('Are you sure you want to enable all users?')) {
        return;
    }

    try {
        updateConnectionStatus('Enabling all users...', 'info');
        const result = await fetchAPI('/api/mikrotik/enable-all', {
            method: 'POST'
        });
        toast.showSuccess(`Enabled ${result.count || 0} users`);
        loadDashboardData();
    } catch (error) {
        console.error('Enable users error:', error);
        toast.showError('Enable users error: ' + error.message);
    }
}

// -----------------------------------------------------------------------------
// Event listeners
// -----------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', function() {
    console.log('Page loaded, starting dashboard...');

    // Mobile menu toggle
    const mobileMenuButton = getElement('mobile-menu-button');
    const mobileMenu = getElement('mobile-menu');

    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', function() {
            mobileMenu.classList.toggle('hidden');
        });
    }

    // Add User Form Handler
    const addUserForm = document.getElementById('add-user-form');
    if (addUserForm) {
        addUserForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const formData = new FormData(addUserForm);
            const userData = Object.fromEntries(formData);
            
            try {
                await fetchAPI('/api/users', {
                    method: 'POST',
                    body: JSON.stringify(userData)
                });
                toast.showSuccess('User added successfully');
                addUserForm.reset();
                loadDashboardData();
            } catch (error) {
                console.error('Add user error:', error);
                toast.showError('Add user error: ' + error.message);
            }
        });
    }

    // Small delay to ensure all scripts are loaded
    setTimeout(function() {
        loadDashboardData();
    }, 500);
});

// Auto-refresh every 60 seconds
setInterval(function() {
    if (typeof loadDashboardData === 'function') {
        console.log('Auto-refresh dashboard...');
        loadDashboardData();
    }
}, 60000);

// Expose functions for HTML event handlers
window.updateConnectionStatus = updateConnectionStatus;
window.refreshMikrotikData = updateMikrotikStatusCard;
window.loadDashboardData = loadDashboardData;
window.refreshData = loadDashboardData;
window.refreshFinancialData = refreshFinancialData;
window.viewFinancialReport = viewFinancialReport;
window.exportFinancialData = exportFinancialData;
window.checkMikrotikConnection = checkMikrotikConnection;
window.disableUnpaidUsers = disableUnpaidUsers;
window.enableAllUsers = enableAllUsers;
window.importFromMikrotik = importFromMikrotik;
window.markPaid = markPaid;
window.disconnectUser = disconnectUser;
window.searchUsers = searchUsers;
window.changePage = changePage;
