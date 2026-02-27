/**
 * Financial Dashboard JavaScript
 * ISP Dashboard Financial Analytics
 */

// Global variables
let currentPeriod = 'monthly';
let currentYear = new Date().getFullYear();
let charts = {};
let financialData = {};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    console.log('💰 Financial Dashboard initializing...');
    
    // Initialize year selector
    initYearSelector();
    
    // Load initial data
    loadAllFinancialData();
    
    // Auto-refresh every 5 minutes
    setInterval(loadAllFinancialData, 5 * 60 * 1000);
});

// Initialize year selector dropdown
function initYearSelector() {
    const yearSelect = document.getElementById('year-select');
    const currentYear = new Date().getFullYear();
    
    // Add last 3 years and next year
    for (let year = currentYear - 2; year <= currentYear + 1; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        if (year === currentYear) {
            option.selected = true;
        }
        yearSelect.appendChild(option);
    }
    
    // Update currentYear variable when selection changes
    yearSelect.addEventListener('change', function() {
        currentYear = parseInt(this.value);
    });
}

// Set active period
function setPeriod(period) {
    currentPeriod = period;
    
    // Update button states
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.textContent.toLowerCase().includes(period)) {
            btn.classList.add('active');
        }
    });
    
    // Update report title
    const periodNames = {
        'monthly': 'Monthly',
        'quarterly': 'Quarterly', 
        'yearly': 'Yearly'
    };
    document.getElementById('report-title').textContent = `${periodNames[period]} Financial Report`;
    
    // Load report data for new period
    loadReportData();
}

// Load all financial data
async function loadAllFinancialData() {
    console.log('📊 Loading all financial data...');
    
    // Show loading, hide content
    document.getElementById('loading').style.display = 'block';
    document.getElementById('financial-content').style.display = 'none';
    document.getElementById('error-message').style.display = 'none';
    
    try {
        // Disable refresh button
        const refreshBtn = document.querySelector('.refresh-btn');
        refreshBtn.disabled = true;
        refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        
        // Load data in parallel
        await Promise.all([
            loadSummaryData(),
            loadTrendsData(),
            loadProfitAnalysis(),
            loadCashFlowData(),
            loadTopClients(),
            loadReportData()
        ]);
        
        // Update last update timestamp
        document.getElementById('last-update').textContent = 
            `Last updated: ${new Date().toLocaleTimeString('id-ID')}`;
        
        // Hide loading, show content
        document.getElementById('loading').style.display = 'none';
        document.getElementById('financial-content').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading financial data:', error);
        showError('Failed to load financial data: ' + error.message);
    } finally {
        // Re-enable refresh button
        const refreshBtn = document.querySelector('.refresh-btn');
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> Refresh Data';
    }
}

// Load summary data (main metrics)
async function loadSummaryData() {
    try {
        const report = await ISP_CONFIG.fetchAPI('/api/financial/dashboard');
        financialData.report = report;
        
        // Update summary metrics
        updateSummaryMetrics(report);
        
    } catch (error) {
        console.error('Error loading summary data:', error);
        // Fallback to stats endpoint
        try {
            const stats = await ISP_CONFIG.fetchAPI('/api/stats');
            const summary = await ISP_CONFIG.fetchAPI('/api/financial-summary');
            
            const fallbackReport = {
                totalRevenue: summary?.totalMonthlyRevenue || 0,
                totalExpenses: 0,
                netProfit: summary?.thisMonthRevenue || 0,
                activeClients: stats.totalUsers || 0,
                revenueChange: 0,
                profitMargin: 0,
                lastUpdated: new Date().toISOString()
            };
            
            financialData.report = fallbackReport;
            updateSummaryMetrics(fallbackReport);
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
            throw error;
        }
    }
}

// Update summary metrics on the page
function updateSummaryMetrics(report) {
    // Safely update displayed financial metrics using the report data.
    // If a specific field is missing, fall back to a default value.
    const totalRevenue = report?.totalRevenue ?? report?.total_monthly ?? report?.thisMonthRevenue ?? 0;
    const totalExpenses = report?.totalExpenses ?? 0;
    const netProfit = report?.netProfit ?? report?.profit ?? report?.thisMonthRevenue - (report?.totalExpenses ?? 0) ?? 0;
    const activeClients = report?.activeClients ?? report?.active_clients ?? 0;
    const outstanding = report?.outstanding ?? 0;
    const revenueChange = report?.revenueChange ?? 0;
    const profitMargin = report?.profitMargin ?? 0;
    const lastUpdated = report?.lastUpdated ?? new Date().toLocaleString();

    document.getElementById('total-revenue').textContent = formatRupiah(totalRevenue);
    document.getElementById('total-expenses').textContent = formatRupiah(totalExpenses);
    document.getElementById('net-profit').textContent = formatRupiah(netProfit);
    document.getElementById('active-clients').textContent = activeClients;

    // Revenue change badge
    const revChangeEl = document.getElementById('revenue-change');
    if (revChangeEl) {
        revChangeEl.textContent = `${revenueChange >= 0 ? '+' : ''}${revenueChange}% vs last month`;
        revChangeEl.className = `metric-change ${revenueChange >= 0 ? 'change-positive' : 'change-negative'}`;
    }

    // Profit margin badge
    const profitMarginEl = document.getElementById('profit-margin');
    if (profitMarginEl) {
        profitMarginEl.textContent = `Margin: ${profitMargin}%`;
        profitMarginEl.className = `metric-change ${parseFloat(profitMargin) >= 0 ? 'change-positive' : 'change-negative'}`;
    }

    // Last updated timestamp
    const lastUpdateEl = document.getElementById('last-update');
    if (lastUpdateEl) {
        lastUpdateEl.textContent = `Last updated: ${new Date(lastUpdated).toLocaleTimeString('id-ID')}`;
    }
}

// Load trends data and create charts
async function loadTrendsData() {
    try {
        const trends = await ISP_CONFIG.fetchAPI('/api/financial/trends/revenue');
        financialData.trends = trends;
        
        // Create/render charts
        renderRevenueTrendChart(trends);
        renderProfitMarginChart(trends);
        
    } catch (error) {
        console.error('Error loading trends data:', error);
        // Don't throw - charts will show error state
    }
}

// Render revenue trend chart
function renderRevenueTrendChart(trends) {
    const ctx = document.getElementById('revenue-trend-chart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (charts.revenueTrend) {
        charts.revenueTrend.destroy();
    }
    
    const labels = trends.map(t => t.month);
    const revenueData = trends.map(t => t.revenue);
    const profitData = trends.map(t => t.profit);
    
    charts.revenueTrend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Revenue',
                    data: revenueData,
                    borderColor: '#1a237e',
                    backgroundColor: 'rgba(26, 35, 126, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Profit',
                    data: profitData,
                    borderColor: '#2e7d32',
                    backgroundColor: 'rgba(46, 125, 50, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatRupiah(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatRupiahShort(value);
                        }
                    }
                }
            }
        }
    });
}

// Render profit margin chart
function renderProfitMarginChart(trends) {
    const ctx = document.getElementById('profit-margin-chart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (charts.profitMargin) {
        charts.profitMargin.destroy();
    }
    
    const labels = trends.map(t => t.month);
    const marginData = trends.map(t => parseFloat(t.profitMargin));
    
    // Determine colors based on margin value
    const backgroundColors = marginData.map(margin => 
        margin >= 30 ? 'rgba(46, 125, 50, 0.7)' : 
        margin >= 20 ? 'rgba(255, 193, 7, 0.7)' : 
        'rgba(244, 67, 54, 0.7)'
    );
    
    charts.profitMargin = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Profit Margin %',
                data: marginData,
                backgroundColor: backgroundColors,
                borderColor: backgroundColors.map(color => color.replace('0.7', '1')),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Margin: ${context.raw}%`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    title: {
                        display: true,
                        text: 'Margin %'
                    }
                }
            }
        }
    });
}

// Load profit analysis data
async function loadProfitAnalysis() {
    try {
        const analysis = await ISP_CONFIG.fetchAPI('/api/financial/analysis/profit');
        financialData.profitAnalysis = analysis;
        
        // Render expense breakdown chart
        renderExpenseBreakdownChart(analysis.expenseBreakdown);
        
        // Show recommendations if available
        if (analysis.recommendations && analysis.recommendations.length > 0) {
            const recList = document.getElementById('recommendation-list');
            recList.innerHTML = '';
            
            analysis.recommendations.forEach(rec => {
                const li = document.createElement('li');
                li.textContent = rec;
                recList.appendChild(li);
            });
            
            document.getElementById('expense-recommendations').style.display = 'block';
        }
        
    } catch (error) {
        console.error('Error loading profit analysis:', error);
    }
}

// Render expense breakdown chart
function renderExpenseBreakdownChart(expenses) {
    const ctx = document.getElementById('expense-breakdown-chart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (charts.expenseBreakdown) {
        charts.expenseBreakdown.destroy();
    }
    
    if (!expenses || expenses.length === 0) {
        // Show message if no expense data
        ctx.font = '16px Arial';
        ctx.fillStyle = '#666';
        ctx.textAlign = 'center';
        ctx.fillText('No expense data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
        return;
    }
    
    const labels = expenses.map(e => e.category || 'Uncategorized');
    const data = expenses.map(e => e.total);
    
    // Generate colors
    const backgroundColors = [
        'rgba(255, 99, 132, 0.7)',
        'rgba(54, 162, 235, 0.7)',
        'rgba(255, 206, 86, 0.7)',
        'rgba(75, 192, 192, 0.7)',
        'rgba(153, 102, 255, 0.7)',
        'rgba(255, 159, 64, 0.7)'
    ];
    
    charts.expenseBreakdown = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: backgroundColors,
                borderColor: backgroundColors.map(color => color.replace('0.7', '1')),
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
                            return `${context.label}: ${formatRupiah(value)} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Load cash flow data
async function loadCashFlowData() {
    try {
        const cashflow = await ISP_CONFIG.fetchAPI('/api/financial/cashflow');
        financialData.cashflow = cashflow;
        
        // Update cash flow metrics
        document.getElementById('cash-flow').textContent = formatRupiah(cashflow.netCashFlow);
        
        const conversion = parseFloat(cashflow.metrics.cashConversion);
        document.getElementById('cash-conversion').textContent = `Conversion: ${conversion}%`;
        document.getElementById('cash-conversion').className = 
            `metric-change ${conversion >= 80 ? 'change-positive' : conversion >= 60 ? 'change-negative' : 'change-negative'}`;
        
        // Display cash flow details
        displayCashFlowDetails(cashflow);
        
    } catch (error) {
        console.error('Error loading cash flow data:', error);
    }
}

// Display cash flow details
function displayCashFlowDetails(cashflow) {
    const container = document.getElementById('cashflow-details');
    
    const html = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 20px;">
            <div class="summary-item">
                <div class="summary-value" style="color: #2e7d32;">${formatRupiah(cashflow.inflow)}</div>
                <div class="summary-label">Cash Inflow</div>
            </div>
            
            <div class="summary-item">
                <div class="summary-value" style="color: #c62828;">${formatRupiah(cashflow.outflow)}</div>
                <div class="summary-label">Cash Outflow</div>
            </div>
            
            <div class="summary-item">
                <div class="summary-value" style="color: #1a237e;">${formatRupiah(cashflow.receivables)}</div>
                <div class="summary-label">Outstanding Receivables</div>
            </div>
            
            <div class="summary-item">
                <div class="summary-value" style="color: #ff8f00;">${cashflow.metrics.daysReceivable} days</div>
                <div class="summary-label">Avg Days Receivable</div>
            </div>
        </div>
        
        <div style="margin-top: 25px; background: #f5f5f5; padding: 15px; border-radius: 8px;">
            <h4 style="margin-top: 0; color: #1a237e;">Cash Flow Analysis</h4>
            <p style="margin: 10px 0;">
                <strong>Operating Margin:</strong> ${cashflow.metrics.operatingMargin}%<br>
                <strong>Cash Conversion:</strong> ${cashflow.metrics.cashConversion}%<br>
                <strong>Net Cash Position:</strong> ${formatRupiah(cashflow.cashPosition)}
            </p>
            ${cashflow.netCashFlow > 0 
                ? '<p style="color: #2e7d32;"><i class="fas fa-check-circle"></i> Positive cash flow</p>' 
                : '<p style="color: #c62828;"><i class="fas fa-exclamation-triangle"></i> Negative cash flow - monitor closely</p>'}
        </div>
    `;
    
    container.innerHTML = html;
}

// Load top clients data
async function loadTopClients() {
    try {
        const topClients = await ISP_CONFIG.fetchAPI('/api/financial/top-clients?limit=10');
        financialData.topClients = topClients;
        
        // Update top clients table
        updateTopClientsTable(topClients);
        
    } catch (error) {
        console.error('Error loading top clients:', error);
    }
}

// Update top clients table
function updateTopClientsTable(clients) {
    const tbody = document.querySelector('#top-clients-table tbody');
    tbody.innerHTML = '';
    
    if (!clients || clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px; color: #666;">No client data available</td></tr>';
        return;
    }
    
    clients.forEach(client => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td><strong>${escapeHtml(client.name)}</strong></td>
            <td class="rupiah">${formatRupiah(client.monthlyFee)}</td>
            <td class="rupiah">${formatRupiah(client.totalValue)}</td>
            <td>${client.paymentsCount} payments</td>
            <td>${client.lastPayment ? formatDate(client.lastPayment) : 'Never'}</td>
            <td><span class="status-badge status-${client.currentStatus}">${client.currentStatus}</span></td>
        `;
        
        tbody.appendChild(row);
    });
}

// Load report data (detailed table)
async function loadReportData() {
    try {
        const report = await ISP_CONFIG.fetchAPI(`/api/financial/report/${currentPeriod}?year=${currentYear}`);
        
        // Update detailed report table
        updateReportTable(report);
        
        // Update report summary
        updateReportSummary(report);
        
    } catch (error) {
        console.error('Error loading report data:', error);
    }
}

// Update detailed report table
function updateReportTable(report) {
    const tbody = document.querySelector('#detailed-report-table tbody');
    tbody.innerHTML = '';
    
    let dataRows = [];
    
    if (currentPeriod === 'monthly') {
        dataRows = report.months;
    } else if (currentPeriod === 'quarterly') {
        dataRows = report.quarters;
    } else { // yearly - show monthly data within yearly report
        if (report.months) {
            dataRows = report.months;
        } else {
            // For yearly comparison view
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 30px;">Yearly comparison data loaded in summary section</td></tr>';
            return;
        }
    }
    
    dataRows.forEach(row => {
        const tr = document.createElement('tr');
        
        tr.innerHTML = `
            <td><strong>${row.month || row.quarter || ''}</strong>${row.monthYear ? `<br><small>${row.monthYear}</small>` : ''}</td>
            <td class="rupiah">${formatRupiah(row.revenue)}</td>
            <td class="rupiah">${formatRupiah(row.expenses)}</td>
            <td class="rupiah ${row.profit >= 0 ? 'change-positive' : 'change-negative'}" style="font-weight: 700;">${formatRupiah(row.profit)}</td>
            <td><span class="status-badge ${row.profitMargin >= 20 ? 'status-paid' : row.profitMargin >= 10 ? 'status-pending' : 'change-negative'}">
                ${row.profitMargin}%
            </span></td>
            <td>${row.newClients || 0}</td>
        `;
        
        tbody.appendChild(tr);
    });
}

// Update report summary section
function updateReportSummary(report) {
    const container = document.getElementById('report-summary');
    
    let summaryHtml = '';
    
    if (currentPeriod === 'monthly') {
        summaryHtml = `
            <div class="summary-item">
                <div class="summary-value">${formatRupiah(report.summary.totalRevenue)}</div>
                <div class="summary-label">Total Annual Revenue</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${formatRupiah(report.summary.averageMonthlyRevenue)}</div>
                <div class="summary-label">Avg Monthly Revenue</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${report.summary.profitMargin}%</div>
                <div class="summary-label">Avg Profit Margin</div>
            </div>
        `;
    } else if (currentPeriod === 'quarterly') {
        summaryHtml = `
            <div class="summary-item">
                <div class="summary-value">${formatRupiah(report.summary.totalRevenue)}</div>
                <div class="summary-label">Total Annual Revenue</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${formatRupiah(report.summary.averageQuarterlyRevenue)}</div>
                <div class="summary-label">Avg Quarterly Revenue</div>
            </div>
            <div class="summary-item">
                <div class="summary-value">${report.summary.profitMargin}%</div>
                <div class="summary-label">Avg Profit Margin</div>
            </div>
        `;
    } else { // yearly
        if (report.growth) {
            summaryHtml = `
                <div class="summary-item">
                    <div class="summary-value">${report.growth.revenue}%</div>
                    <div class="summary-label">Revenue Growth</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">${report.growth.profit}%</div>
                    <div class="summary-label">Profit Growth</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">${report.growth.clients}%</div>
                    <div class="summary-label">Client Growth</div>
                </div>
                <div class="summary-item">
                    <div class="summary-value">${report.metrics ? report.metrics.averageRevenuePerClient.toLocaleString() : '0'}</div>
                    <div class="summary-label">Avg Revenue per Client</div>
                </div>
            `;
        }
    }
    
    container.innerHTML = summaryHtml;
}

// Utility functions

// Format Rupiah currency
function formatRupiah(amount) {
    if (amount === null || amount === undefined) return 'Rp 0';
    
    const formatter = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
    
    return formatter.format(amount);
}

// Format Rupiah for charts (short version)
function formatRupiahShort(amount) {
    if (amount >= 1000000) {
        return `Rp ${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
        return `Rp ${(amount / 1000).toFixed(0)}K`;
    }
    return `Rp ${amount}`;
}

// Format date
function formatDate(dateString) {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

// Show error message
function showError(message) {
    const errorDiv = document.getElementById('error-message');
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    
    // Hide loading, show empty content
    document.getElementById('loading').style.display = 'none';
    document.getElementById('financial-content').style.display = 'block';
}

// Simple HTML escape
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}