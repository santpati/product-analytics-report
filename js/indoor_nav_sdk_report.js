// Month band backgrounds for long daily trend charts (GA / Amplitude style)
        const monthBandPlugin = {
            id: 'monthBandPlugin',
            beforeDatasetsDraw(chart, _args, opts) {
                const series = opts?.series;
                if (!opts?.enabled || !series?.length) return;
                
                const { ctx, chartArea, scales: { x } } = chart;
                if (!x) return;
                
                const bands = [];
                let current = {
                    monthKey: series[0].monthKey,
                    monthShort: series[0].monthShort,
                    startIdx: 0
                };
                
                series.forEach((point, index) => {
                    if (point.monthKey !== current.monthKey) {
                        bands.push({ ...current, endIdx: index - 1 });
                        current = {
                            monthKey: point.monthKey,
                            monthShort: point.monthShort,
                            startIdx: index
                        };
                    }
                });
                bands.push({ ...current, endIdx: series.length - 1 });
                
                const barWidth = series.length > 1
                    ? Math.abs(x.getPixelForValue(1) - x.getPixelForValue(0))
                    : 12;
                
                bands.forEach((band, index) => {
                    const xStart = x.getPixelForValue(band.startIdx) - barWidth / 2;
                    const xEnd = x.getPixelForValue(band.endIdx) + barWidth / 2;
                    
                    ctx.save();
                    ctx.fillStyle = index % 2 === 0
                        ? 'rgba(255, 255, 255, 0.025)'
                        : 'rgba(255, 255, 255, 0.055)';
                    ctx.fillRect(xStart, chartArea.top, xEnd - xStart, chartArea.bottom - chartArea.top);
                    
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
                    ctx.font = '600 11px Inter, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(band.monthShort, (xStart + xEnd) / 2, chartArea.top - 6);
                    ctx.restore();
                });
            }
        };
        let monthBandPluginRegistered = false;

        async function ensureChartsReady() {
            await ReportLoaders.ensureChartJs();
            if (!monthBandPluginRegistered) {
                Chart.register(monthBandPlugin);
                monthBandPluginRegistered = true;
            }
        }
        
        const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        function countCalendarMonths(startDate, endDate) {
            return (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12
                + (endDate.getUTCMonth() - startDate.getUTCMonth()) + 1;
        }
        
        function getTrendChartHint(view) {
            const selectedRange = getSelectedDateRange();
            if (!selectedRange) return '';
            
            const rangeLabel = formatDateRange(selectedRange.startDate, selectedRange.endDate);
            
            if (view === 'daily') {
                const pointCount = loadedDailyPointCount || selectedRange.days;
                let hint = `Daily totals · ${rangeLabel} · ${pointCount} day${pointCount === 1 ? '' : 's'}`;
                if (selectedRange.days > 45) {
                    hint += ' · Scroll horizontally to see all months · Month bands mark each calendar month';
                }
                return hint;
            }
            
            if (view === 'weekly') {
                return `Weekly totals · ${rangeLabel} (${selectedRange.days} days)`;
            }
            
            if (view === 'monthly') {
                const monthCount = countCalendarMonths(selectedRange.startDate, selectedRange.endDate);
                const thirtyDayPeriods = Math.round(selectedRange.days / 30);
                let hint = `Calendar month totals · ${rangeLabel} · ${monthCount} month${monthCount === 1 ? '' : 's'}`;
                if (monthCount > thirtyDayPeriods) {
                    hint += ` (${selectedRange.days} days spans partial months at the start and end, so you see ${monthCount} buckets instead of ~${thirtyDayPeriods})`;
                }
                return hint;
            }
            
            return '';
        }
        
        function updateTrendChartHints(view) {
            const hint = getTrendChartHint(view);
            ['totalTrendsHint', 'qrTrendsHint', 'mobileTrendsHint', 'visitorTrendsHint'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = hint;
            });
            
            const isLongDaily = view === 'daily' && (getSelectedDateRange()?.days || 0) > 45;
            ['totalTrendsChartContainer', 'qrTrendsChartContainer', 'mobileTrendsChartContainer', 'visitorTrendsChartContainer'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.classList.toggle('chart-daily-long', isLongDaily);
            });
        }
        
        function buildTrendBarChartOptions(aggregated, view, barColor, borderColor) {
            const useMonthBands = view === 'daily' && aggregated.length > 45 && aggregated[0]?.monthKey;
            const showBarLabels = aggregated.length <= 45;
            
            return {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    monthBandPlugin: {
                        enabled: useMonthBands,
                        series: aggregated
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 15, 26, 0.95)',
                        titleColor: '#fff',
                        bodyColor: 'rgba(255,255,255,0.85)',
                        borderColor: 'rgba(255,255,255,0.12)',
                        borderWidth: 1,
                        callbacks: {
                            title(items) {
                                const point = aggregated[items[0]?.dataIndex];
                                return point?.fullLabel || point?.label || items[0].label;
                            },
                            label(item) {
                                return `${item.dataset.label || 'Count'}: ${item.formattedValue}`;
                            }
                        }
                    },
                    datalabels: {
                        display: showBarLabels,
                        color: '#fff',
                        anchor: 'end',
                        align: 'top',
                        offset: 4,
                        font: { weight: '600', size: 12 },
                        formatter(value) {
                            return value > 0 ? value : '';
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.6)',
                            font: { size: 10 },
                            maxRotation: 0,
                            minRotation: 0,
                            autoSkip: false,
                            callback(_value, index) {
                                return aggregated[index]?.label ?? '';
                            }
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.6)',
                            font: { size: 12 }
                        }
                    }
                },
                layout: {
                    padding: { top: useMonthBands ? 28 : 30 }
                }
            };
        }
        
        function renderTrendBarChart(canvasId, aggregated, view, datasetLabel, barColor, borderColor, chartRef) {
            const canvas = document.getElementById(canvasId);
            const ctx = canvas.getContext('2d');
            const container = document.getElementById(canvasId.replace('Chart', 'ChartContainer'));
            const scrollWrap = document.getElementById(canvasId.replace('Chart', 'ScrollWrap'));
            
            if (chartRef.current) chartRef.current.destroy();
            
            updateTrendChartHints(view);
            
            const isLongDaily = view === 'daily' && aggregated.length > 45;
            if (container) {
                const minWidth = isLongDaily ? Math.max(960, aggregated.length * 4) : '';
                container.style.minWidth = minWidth ? `${minWidth}px` : '';
            }
            
            const labels = aggregated.map(d => d.label);
            const values = aggregated.map(d => d.value);
            
            chartRef.current = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: labels.length ? labels : ['No Data'],
                    datasets: [{
                        label: datasetLabel,
                        data: values.length ? values : [0],
                        backgroundColor: barColor,
                        borderColor: borderColor,
                        borderWidth: 1,
                        borderRadius: isLongDaily ? 3 : 8,
                        barPercentage: isLongDaily ? 0.95 : 0.7,
                        maxBarThickness: isLongDaily ? 6 : undefined
                    }]
                },
                options: buildTrendBarChartOptions(aggregated, view, barColor, borderColor)
            });
            
            return chartRef.current;
        }
        
        const qrTrendsChartRef = { current: null };
        const visitorTrendsChartRef = { current: null };
        
        // Analytics tracking function - non-blocking (fire and forget)
        function trackEvent(eventType, data = {}) {
            fetch('/api/analytics/track', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    event_type: '[IndoorNavSDK] ' + eventType,
                    tenant_id: data.tenant_id || '',
                    duration_days: data.duration_days || 0,
                    report_type: data.report_type || '',
                    user_email: data.user_email || getLoggedInUser() || ''
                })
            }).catch(e => console.log('Analytics tracking error:', e));
        }
        
        // Login credentials
        const VALID_USERNAME = 'Spaces';
        const VALID_PASSWORD = 'ProductAnalytics';
        
        // Get logged in user email from session storage (shared across all pages)
        function getLoggedInUser() {
            return sessionStorage.getItem('spacesUserEmail') || '';
        }
        
        // Check if user is logged in (shared across all pages)
        function isLoggedIn() {
            return sessionStorage.getItem('spacesLoggedIn') === 'true';
        }
        
        // Handle login form submission
        async function handleLogin(event) {
            event.preventDefault();
            
            const email = document.getElementById('loginEmail').value.trim();
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;
            const loginBtn = document.getElementById('loginBtn');
            const loginError = document.getElementById('loginError');
            
            // Hide previous error
            loginError.classList.remove('visible');
            
            // Validate email format (must be cisco.com)
            if (!email.toLowerCase().endsWith('@cisco.com')) {
                loginError.textContent = 'Please use a valid Cisco email address (@cisco.com)';
                loginError.classList.add('visible');
                return;
            }
            
            // Validate credentials
            if (username !== VALID_USERNAME || password !== VALID_PASSWORD) {
                loginError.textContent = 'Invalid username or password. Please try again.';
                loginError.classList.add('visible');
                return;
            }
            
            // Disable button during login
            loginBtn.disabled = true;
            loginBtn.textContent = 'Signing in...';
            
            try {
                // Store login state (shared across all pages)
                sessionStorage.setItem('spacesLoggedIn', 'true');
                sessionStorage.setItem('spacesUserEmail', email);
                
                // Track login event (non-blocking)
                trackEvent('user_login', { user_email: email });
                
                // Hide login overlay
                document.getElementById('loginOverlay').classList.add('hidden');
                
                // Track page view after login
                trackEvent('page_view', { user_email: email });
                
            } catch (e) {
                console.error('Login error:', e);
                loginError.textContent = 'An error occurred. Please try again.';
                loginError.classList.add('visible');
            } finally {
                loginBtn.disabled = false;
                loginBtn.textContent = 'Sign In';
            }
        }
        
        // Check login status on page load
        function checkLoginStatus() {
            if (isLoggedIn()) {
                document.getElementById('loginOverlay').classList.add('hidden');
                return true;
            }
            return false;
        }
        
        let googleChartsLoaded = false;
        
        const BASE_URL = '/api/pendo';
        
        // Dynamic suffix based on EU region checkbox
        function getAccountSuffix() {
            const isEU = document.getElementById('euRegion')?.checked || false;
            return isEU ? '_wf.ciscospaces.eu' : '_wf.ciscospaces.io';
        }
        const QR_SCAN_TRACK_ID = 'WTbkpuIbpDRGeRZXHVyg6swMZf8';
        const SDK_SESSION_START_TRACK_ID = 'Vxrz1fzIdnKrlYrRAULp26xGN-w';
        const QR_WAYFINDING_APP_IDS = ['com.ciscospaces.wayfinding', 'com.cisco.spaces.wayfinding'];

        const POI_TRACK_ID = 'RyI0lQYmAm7X8u-ju0JPDEuT0WI';
        const QUICK_ACCESS_TRACK_ID = 'UiyouU6Qy0KZNjWKK7-ZdSGWXWg';
        const SEARCH_TRACK_ID = 'eSTPbxzLYDNmuE5PMGTmkpEc-eA';
        const NAV_STARTED_TRACK_ID = '4QTXhzSkmpjAP4FywPnvA0YCmJI';
        const NAV_COMPLETED_TRACK_ID = 'QdyV4HMxtwBpNXJyDOM43XulUT4';
        const NAV_CANCELED_TRACK_ID = 'CPt265KAiw-MP-XgB6hYZB0hAX0';
        
        const DEFAULT_TENANT_ID = '16007';
        const DEFAULT_DURATION = '30';
        
        let trendsChart = qrTrendsChartRef;
        let platformChart = null;
        let poiChart = null;
        let quickAccessChart = null;
        let searchTermsData = [];

        let sdkBreakdownRows = [];
        let sdkVisitorRows = [];
        let rawTotalDailyData = [];
        let rawMobileDailyData = [];
        let rawQrVisitorDailyData = [];
        const totalTrendsChartRef = { current: null };
        const mobileTrendsChartRef = { current: null };
        let sdkPlatformChart = null;
        let currentTotalTrendsView = 'daily';
        let currentMobileTrendsView = 'daily';
        let rawDailyData = [];
        let rawVisitorDailyData = [];
        let currentTrendsView = 'daily';
        let currentVisitorTrendsView = 'daily';
        let visitorTrendsChart = visitorTrendsChartRef;
        const PENDO_DAILY_CHUNK_DAYS = 90;
        const PENDO_AGGREGATION_LIMIT = 10000;
        
        let cachedTenantId = null;
        let lastLoadedRangeKey = null;
        let loadDataGeneration = 0;
        let loadedDailyPointCount = 0;
        let suppressCustomDateEvent = false;
        let durationChangeToken = 0;
        
        function normalizeDayKey(dayMs) {
            const d = new Date(dayMs);
            return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        }
        
        function toNoonUtcMs(date) {
            return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0, 0);
        }
        
        function getDateRangeChunks(dateRange, chunkDays = PENDO_DAILY_CHUNK_DAYS) {
            if (!dateRange || dateRange.days <= chunkDays) {
                return [{ startMs: dateRange.startMs, endMs: dateRange.endMs }];
            }
            
            const chunks = [];
            let cursor = new Date(dateRange.startDate.getTime());
            const end = dateRange.endDate;
            
            while (cursor <= end) {
                const chunkStart = new Date(cursor.getTime());
                const chunkEnd = new Date(cursor.getTime());
                chunkEnd.setUTCDate(chunkEnd.getUTCDate() + chunkDays - 1);
                if (chunkEnd > end) chunkEnd.setTime(end.getTime());
                
                chunks.push({
                    startMs: toNoonUtcMs(chunkStart),
                    endMs: toNoonUtcMs(chunkEnd)
                });
                
                cursor = new Date(chunkEnd.getTime());
                cursor.setUTCDate(cursor.getUTCDate() + 1);
            }
            
            return chunks;
        }
        
        function fillDailySeriesToRange(results, dateRange) {
            const byDay = new Map();
            (results || []).forEach(row => {
                byDay.set(normalizeDayKey(row.day), row.count || 0);
            });
            
            const filled = [];
            const cursor = new Date(dateRange.startDate.getTime());
            const end = dateRange.endDate;
            
            while (cursor <= end) {
                const dayMs = toNoonUtcMs(cursor);
                filled.push({
                    day: dayMs,
                    count: byDay.get(normalizeDayKey(dayMs)) || 0
                });
                cursor.setUTCDate(cursor.getUTCDate() + 1);
            }
            
            return filled;
        }
        
        async function fetchDailyEventTrends(trackTypeId, filterExpr, dateRange) {
            const chunks = getDateRangeChunks(dateRange);
            const merged = new Map();
            
            for (const chunk of chunks) {
                const query = {
                    response: { mimeType: 'application/json' },
                    request: {
                        pipeline: [
                            { source: { trackEvents: { trackTypeId }, timeSeries: { period: 'dayRange', first: chunk.startMs, last: chunk.endMs } } },
                            { filter: filterExpr },
                            { group: { group: ['day'], fields: [{ count: { sum: 'numEvents' } }] } },
                            { sort: ['day'] },
                            { limit: PENDO_AGGREGATION_LIMIT }
                        ]
                    }
                };
                const data = await fetchAggregation(query);
                (data?.results || []).forEach(row => merged.set(normalizeDayKey(row.day), row));
            }
            
            const mergedRows = Array.from(merged.values()).sort((a, b) => a.day - b.day);
            return fillDailySeriesToRange(mergedRows, dateRange);
        }
        
        async function fetchDailyVisitorTrends(trackTypeId, filterExpr, dateRange) {
            const chunks = getDateRangeChunks(dateRange);
            const merged = new Map();
            
            for (const chunk of chunks) {
                const query = {
                    response: { mimeType: 'application/json' },
                    request: {
                        pipeline: [
                            { source: { trackEvents: { trackTypeId }, timeSeries: { period: 'dayRange', first: chunk.startMs, last: chunk.endMs } } },
                            { filter: filterExpr },
                            { group: { group: ['day', 'visitorId'], fields: [] } },
                            { group: { group: ['day'], fields: [{ count: { count: null } }] } },
                            { sort: ['day'] },
                            { limit: PENDO_AGGREGATION_LIMIT }
                        ]
                    }
                };
                const data = await fetchAggregation(query);
                (data?.results || []).forEach(row => merged.set(normalizeDayKey(row.day), row));
            }
            
            const mergedRows = Array.from(merged.values()).sort((a, b) => a.day - b.day);
            return fillDailySeriesToRange(mergedRows, dateRange);
        }
        
        function getRangeKey(range) {
            if (!range) return null;
            return `${range.startMs}-${range.endMs}`;
        }
        
        function isReportDataStale() {
            if (!lastLoadedRangeKey) return false;
            const current = getSelectedDateRange({ silent: true });
            return !current || getRangeKey(current) !== lastLoadedRangeKey;
        }
        
        function clearStaleReportData() {
            rawDailyData = [];
            rawVisitorDailyData = [];
            searchTermsData = [];
            lastLoadedRangeKey = null;
            loadedDailyPointCount = 0;
            
            ['totalSdkSessions', 'totalQRScans', 'totalMobileSessions', 'uniqueVisitors', 'totalPOI', 'totalQuickAccess', 'totalSearches',
             'navStarted', 'navCompleted', 'navCanceled'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.textContent = '--';
            });
            
            document.getElementById('downloadBtn').style.display = 'none';
        }
        
        function handleDurationChange() {
            const isCustom = document.getElementById('durationSelect').value === 'custom';
            applyDurationChange(isCustom);
        }
        
        function handleCustomDateChange() {
            if (suppressCustomDateEvent) return;
            if (document.getElementById('durationSelect').value !== 'custom') return;
            
            updateCustomDateBounds();
            
            const startInput = document.getElementById('customStartDate');
            const endInput = document.getElementById('customEndDate');
            if (startInput.value && endInput.value && startInput.value > endInput.value) {
                suppressCustomDateEvent = true;
                endInput.value = startInput.value;
                suppressCustomDateEvent = false;
            }
            
            applyDurationChange(false);
        }
        
        async function applyDurationChange(resetCustomDefaults = false) {
            toggleCustomDateRange(resetCustomDefaults);
            
            const dateRange = getSelectedDateRange({ silent: !resetCustomDefaults });
            if (!dateRange) return;
            
            document.getElementById('dateRangeDisplay').textContent = dateRange.displayText;
            
            const hadLoadedData = !!lastLoadedRangeKey;
            const step2 = document.getElementById('step2Controls');
            const tenantId = document.getElementById('tenantInput').value.trim();
            const step2Visible = step2.style.display !== 'none';
            if (!tenantId) return;
            
            const token = ++durationChangeToken;
            loadDataGeneration++;
            clearStaleReportData();
            
            try {
                if (step2Visible) {
                    // Sites can differ by date range — refresh the picker, then reload metrics.
                    await getData({ silentRange: true });
                    if (token !== durationChangeToken) return;
                    if (hadLoadedData && getSelectedSites().length > 0) {
                        await loadData();
                    }
                } else {
                    await getData({ silentRange: true });
                }
            } catch (error) {
                console.error('Duration change refresh failed:', error);
            }
        }
        
        function parseQuickAccessCategory(category, params) {
            if (category && category !== 'null') return category;
            if (params) {
                const match = params.match(/category=([^}]+)/);
                if (match) return match[1].trim();
            }
            return null;
        }
        
        function parsePoiInteracted(poiString) {
            if (!poiString) return { name: 'Unknown', typeCode: 'unknown' };
            
            const nameMatch = poiString.match(/name=([^,}]+)/);
            const typeMatch = poiString.match(/typeCode=([^,}]+)/);
            
            const name = nameMatch ? nameMatch[1].trim() : 'Unknown';
            const typeCode = typeMatch ? typeMatch[1].trim() : 'unknown';
            
            return { name, typeCode };
        }
        
        function formatTypeCode(typeCode) {
            return typeCode.split('-').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1)
            ).join(' ');
        }
        
        function parseUrlParams() {
            const path = window.location.pathname;
            let tenantId = DEFAULT_TENANT_ID;
            let duration = DEFAULT_DURATION;
            
            const tenantMatch = path.match(/tenantID=(\d+)/);
            if (tenantMatch) tenantId = tenantMatch[1];
            
            const durationMatch = path.match(/duration=(\d+)/);
            if (durationMatch) duration = durationMatch[1];
            
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('tenant')) tenantId = urlParams.get('tenant');
            if (urlParams.get('duration')) duration = urlParams.get('duration');
            
            return { tenantId, duration };
        }
        
        function getDateRange(days) {
            // Use UTC consistently for both display and API to avoid timezone issues
            // Get current UTC date
            const now = new Date();
            const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
            
            // End date is yesterday in UTC (last complete day of data)
            const endDateUTC = new Date(todayUTC);
            endDateUTC.setUTCDate(todayUTC.getUTCDate() - 1);
            
            // Start date is (days - 1) days before end date
            const startDateUTC = new Date(endDateUTC);
            startDateUTC.setUTCDate(endDateUTC.getUTCDate() - (days - 1));
            
            // API timestamps at noon UTC
            const startMs = Date.UTC(startDateUTC.getUTCFullYear(), startDateUTC.getUTCMonth(), startDateUTC.getUTCDate(), 12, 0, 0, 0);
            const endMs = Date.UTC(endDateUTC.getUTCFullYear(), endDateUTC.getUTCMonth(), endDateUTC.getUTCDate(), 12, 0, 0, 0);
            
            return {
                startMs: startMs,
                endMs: endMs,
                startDate: startDateUTC,
                endDate: endDateUTC
            };
        }
        
        function getCustomDateRange(startDateStr, endDateStr) {
            // Parse dates as UTC - Input format: "YYYY-MM-DD"
            const startParts = startDateStr.split('-');
            const startDateUTC = new Date(Date.UTC(parseInt(startParts[0]), parseInt(startParts[1]) - 1, parseInt(startParts[2])));
            
            const endParts = endDateStr.split('-');
            const endDateUTC = new Date(Date.UTC(parseInt(endParts[0]), parseInt(endParts[1]) - 1, parseInt(endParts[2])));
            
            // Calculate days: count of calendar days inclusive
            const daysDiff = Math.round((endDateUTC - startDateUTC) / (1000 * 60 * 60 * 24)) + 1;
            
            // API timestamps at noon UTC
            const startMs = Date.UTC(startDateUTC.getUTCFullYear(), startDateUTC.getUTCMonth(), startDateUTC.getUTCDate(), 12, 0, 0, 0);
            const endMs = Date.UTC(endDateUTC.getUTCFullYear(), endDateUTC.getUTCMonth(), endDateUTC.getUTCDate(), 12, 0, 0, 0);
            
            return {
                startMs: startMs,
                endMs: endMs,
                startDate: startDateUTC,
                endDate: endDateUTC,
                days: daysDiff
            };
        }
        
        function formatDateRange(startDate, endDate) {
            // Format UTC dates consistently regardless of user's timezone
            const options = { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' };
            return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
        }
        
        function updateCustomDateBounds() {
            const now = new Date();
            const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
            const yesterdayUTC = new Date(todayUTC);
            yesterdayUTC.setUTCDate(todayUTC.getUTCDate() - 1);
            const oneEightyDaysAgoUTC = new Date(yesterdayUTC);
            oneEightyDaysAgoUTC.setUTCDate(yesterdayUTC.getUTCDate() - 179);
            const formatUTCDate = (d) => d.toISOString().split('T')[0];
            
            const maxDateStr = formatUTCDate(yesterdayUTC);
            const minDateStr = formatUTCDate(oneEightyDaysAgoUTC);
            const startInput = document.getElementById('customStartDate');
            const endInput = document.getElementById('customEndDate');
            
            startInput.min = minDateStr;
            startInput.max = maxDateStr;
            endInput.min = minDateStr;
            endInput.max = maxDateStr;
            
            if (startInput.value) {
                endInput.min = startInput.value;
            }
            if (endInput.value) {
                startInput.max = endInput.value;
            }
        }
        
        function toggleCustomDateRange(resetDefaults = false) {
            const durationSelect = document.getElementById('durationSelect');
            const customDateGroup = document.getElementById('customDateGroup');
            
            if (durationSelect.value === 'custom') {
                customDateGroup.style.display = 'flex';
                updateCustomDateBounds();
                
                if (resetDefaults) {
                    const now = new Date();
                    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
                    const yesterdayUTC = new Date(todayUTC);
                    yesterdayUTC.setUTCDate(todayUTC.getUTCDate() - 1);
                    const thirtyDaysAgoUTC = new Date(yesterdayUTC);
                    thirtyDaysAgoUTC.setUTCDate(yesterdayUTC.getUTCDate() - 29);
                    const formatUTCDate = (d) => d.toISOString().split('T')[0];
                    
                    document.getElementById('customStartDate').value = formatUTCDate(thirtyDaysAgoUTC);
                    document.getElementById('customEndDate').value = formatUTCDate(yesterdayUTC);
                    updateCustomDateBounds();
                }
            } else {
                customDateGroup.style.display = 'none';
            }
        }
        
        function getSelectedDateRange(options = {}) {
            const silent = !!options.silent;
            const durationSelect = document.getElementById('durationSelect');
            
            if (durationSelect.value === 'custom') {
                const startDateStr = document.getElementById('customStartDate').value;
                const endDateStr = document.getElementById('customEndDate').value;
                
                if (!startDateStr || !endDateStr) {
                    if (!silent) alert('Please select both start and end dates');
                    return null;
                }
                
                if (startDateStr > endDateStr) {
                    if (!silent) alert('Start date must be before end date');
                    return null;
                }
                
                const range = getCustomDateRange(startDateStr, endDateStr);
                return {
                    ...range,
                    isCustom: true,
                    displayText: `${formatDateRange(range.startDate, range.endDate)} (${range.days} Days)`
                };
            } else {
                const days = parseInt(durationSelect.value);
                const range = getDateRange(days);
                return {
                    ...range,
                    days: days,
                    isCustom: false,
                    displayText: `${formatDateRange(range.startDate, range.endDate)} (Last ${days} Days)`
                };
            }
        }
        
        function showLoading(show, text = 'Fetching data from Pendo...') {
            const overlay = document.getElementById('loadingOverlay');
            const loadingText = overlay.querySelector('.loading-text');
            if (loadingText) loadingText.textContent = text;
            overlay.classList.toggle('active', show);
            const loadBtn = document.getElementById('loadBtn');
            const getDataBtn = document.getElementById('getDataBtn');
            if (loadBtn) loadBtn.disabled = show;
            if (getDataBtn) getDataBtn.disabled = show;
        }
        
        async function fetchAggregation(query) {
            try {
                const response = await fetch(`${BASE_URL}/aggregation`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(query)
                });
                if (!response.ok) throw new Error(`API Error: ${response.status}`);
                return await response.json();
            } catch (error) {
                console.error('Pendo API Error:', error);
                return null;
            }
        }
        
        function isQrAppId(appId) {
            return QR_WAYFINDING_APP_IDS.includes(appId || '');
        }

        function normalizeBreakdownRow(row) {
            return {
                day: row.day,
                locationHierarchy: row.properties?.locationHierarchy || '',
                appId: row.properties?.appId || '',
                phoneMake: row.properties?.phoneMake || '',
                count: row.count || 0
            };
        }

        function classifyPlatformFromPhoneMake(phoneMake) {
            const make = (phoneMake || '').trim().toLowerCase();
            if (!make || make === 'unknown' || make === 'other' || make === 'null') {
                return 'web';
            }
            if (make.includes('apple') || make.includes('iphone') || make.includes('ipad')) {
                return 'ios';
            }
            const androidMakes = [
                'samsung', 'google', 'motorola', 'oneplus', 'huawei', 'xiaomi',
                'oppo', 'vivo', 'lg', 'sony', 'nokia', 'pixel', 'realme', 'htc',
                'honor', 'lenovo', 'asus', 'tcl', 'zte', 'android', 'blackberry',
                'fairphone', 'nothing'
            ];
            if (androidMakes.some(m => make.includes(m))) {
                return 'android';
            }
            return 'android';
        }

        function countPlatformFromPhoneMake(data) {
            let ios = 0, android = 0, web = 0;
            data.forEach(d => {
                const platform = classifyPlatformFromPhoneMake(d.properties?.phoneMake || d.phoneMake || '');
                const count = d.count || 0;
                if (platform === 'ios') ios += count;
                else if (platform === 'android') android += count;
                else web += count;
            });
            return { ios, android, web, total: ios + android + web };
        }

        function normalizeVisitorRow(row) {
            return {
                day: row.day,
                visitorId: row.visitorId || '',
                locationHierarchy: row.properties?.locationHierarchy || '',
                appId: row.properties?.appId || ''
            };
        }

        async function fetchSdkBreakdown(accountId, dateRange) {
            const chunks = getDateRangeChunks(dateRange);
            const allRows = [];
            for (const chunk of chunks) {
                const query = {
                    response: { mimeType: 'application/json' },
                    request: {
                        pipeline: [
                            { source: { trackEvents: { trackTypeId: SDK_SESSION_START_TRACK_ID }, timeSeries: { period: 'dayRange', first: chunk.startMs, last: chunk.endMs } } },
                            { filter: `accountId == "${accountId}"` },
                            { group: { group: ['day', 'properties.locationHierarchy', 'properties.appId', 'properties.phoneMake'], fields: [{ count: { sum: 'numEvents' } }] } },
                            { limit: PENDO_AGGREGATION_LIMIT }
                        ]
                    }
                };
                const data = await fetchAggregation(query);
                (data?.results || []).forEach(r => allRows.push(normalizeBreakdownRow(r)));
            }
            return allRows;
        }

        async function fetchSdkVisitorBreakdown(accountId, dateRange) {
            const chunks = getDateRangeChunks(dateRange);
            const allRows = [];
            for (const chunk of chunks) {
                const query = {
                    response: { mimeType: 'application/json' },
                    request: {
                        pipeline: [
                            { source: { trackEvents: { trackTypeId: SDK_SESSION_START_TRACK_ID }, timeSeries: { period: 'dayRange', first: chunk.startMs, last: chunk.endMs } } },
                            { filter: `accountId == "${accountId}"` },
                            { group: { group: ['day', 'visitorId', 'properties.locationHierarchy', 'properties.appId'], fields: [{ count: { count: null } }] } },
                            { limit: PENDO_AGGREGATION_LIMIT }
                        ]
                    }
                };
                const data = await fetchAggregation(query);
                (data?.results || []).forEach(r => allRows.push(normalizeVisitorRow(r)));
            }
            return allRows;
        }

        function deriveSitesAndAppsFromBreakdown(rows) {
            const siteCounts = new Map();
            const appCounts = new Map();
            rows.forEach(r => {
                if (r.locationHierarchy) {
                    siteCounts.set(r.locationHierarchy, (siteCounts.get(r.locationHierarchy) || 0) + r.count);
                }
                if (r.appId) {
                    appCounts.set(r.appId, (appCounts.get(r.appId) || 0) + r.count);
                }
            });
            return { siteCounts, appCounts };
        }

        function updateSitesDropdownFromCounts(siteCounts) {
            const siteSelect = document.getElementById('siteSelect');
            siteSelect.innerHTML = '';
            [...siteCounts.entries()].sort((a, b) => b[1] - a[1]).forEach(([location, count]) => {
                const option = document.createElement('option');
                option.value = location;
                option.textContent = `${location} (${count})`;
                siteSelect.appendChild(option);
            });
            selectAllSites();
        }

        function updateAppsDropdownFromCounts(appCounts) {
            const appSelect = document.getElementById('appSelect');
            appSelect.innerHTML = '';
            [...appCounts.entries()].sort((a, b) => b[1] - a[1]).forEach(([appId, count]) => {
                const option = document.createElement('option');
                option.value = appId;
                option.textContent = `${appId} (${count})`;
                appSelect.appendChild(option);
            });
            selectAllApps();
        }

        function selectAllApps() {
            const appSelect = document.getElementById('appSelect');
            Array.from(appSelect.options).forEach(opt => opt.selected = true);
        }

        function clearAppSelection() {
            const appSelect = document.getElementById('appSelect');
            Array.from(appSelect.options).forEach(opt => opt.selected = false);
        }

        function getSelectedAppIds() {
            const appSelect = document.getElementById('appSelect');
            return Array.from(appSelect.selectedOptions).map(opt => opt.value);
        }

        function matchesSdkFilters(row, selectedSites, selectedAppIds) {
            const siteSelect = document.getElementById('siteSelect');
            const appSelect = document.getElementById('appSelect');
            const allSites = siteSelect.options.length;
            const allApps = appSelect.options.length;
            if (selectedSites.length > 0 && selectedSites.length < allSites) {
                if (!selectedSites.includes(row.locationHierarchy)) return false;
            }
            if (selectedAppIds.length > 0 && selectedAppIds.length < allApps) {
                if (!selectedAppIds.includes(row.appId)) return false;
            }
            return true;
        }

        function aggregateBreakdownByDay(rows, predicate, dateRange) {
            const byDay = new Map();
            rows.filter(predicate).forEach(r => {
                const key = normalizeDayKey(r.day);
                byDay.set(key, (byDay.get(key) || 0) + (r.count || 0));
            });
            const filled = [];
            const cursor = new Date(dateRange.startDate.getTime());
            const end = dateRange.endDate;
            while (cursor <= end) {
                const dayMs = toNoonUtcMs(cursor);
                filled.push({ day: dayMs, count: byDay.get(normalizeDayKey(dayMs)) || 0 });
                cursor.setUTCDate(cursor.getUTCDate() + 1);
            }
            return filled;
        }

        function aggregateVisitorDaily(rows, selectedSites, selectedAppIds, dateRange) {
            const byDayVisitors = new Map();
            rows.filter(r => matchesSdkFilters(r, selectedSites, selectedAppIds)).forEach(r => {
                const key = normalizeDayKey(r.day);
                if (!byDayVisitors.has(key)) byDayVisitors.set(key, new Set());
                byDayVisitors.get(key).add(r.visitorId);
            });
            const filled = [];
            const cursor = new Date(dateRange.startDate.getTime());
            const end = dateRange.endDate;
            while (cursor <= end) {
                const dayMs = toNoonUtcMs(cursor);
                const visitors = byDayVisitors.get(normalizeDayKey(dayMs));
                filled.push({ day: dayMs, count: visitors ? visitors.size : 0 });
                cursor.setUTCDate(cursor.getUTCDate() + 1);
            }
            return filled;
        }

        function countUniqueVisitors(rows, selectedSites, selectedAppIds) {
            const ids = new Set();
            rows.filter(r => matchesSdkFilters(r, selectedSites, selectedAppIds)).forEach(r => ids.add(r.visitorId));
            return ids.size;
        }

        function platformRowsFromBreakdown(rows) {
            const grouped = {};
            rows.forEach(r => {
                const phoneMake = r.phoneMake || '';
                grouped[phoneMake] = (grouped[phoneMake] || 0) + (r.count || 0);
            });
            return Object.entries(grouped).map(([phoneMake, count]) => ({
                properties: { phoneMake },
                count
            }));
        }

        function applySdkSessionMetrics(selectedSites, selectedAppIds, dateRange) {
            const filtered = sdkBreakdownRows.filter(r => matchesSdkFilters(r, selectedSites, selectedAppIds));
            const totalSessions = filtered.reduce((s, r) => s + r.count, 0);
            const qrSessions = filtered.filter(r => isQrAppId(r.appId)).reduce((s, r) => s + r.count, 0);
            const mobileSessions = filtered.filter(r => !isQrAppId(r.appId)).reduce((s, r) => s + r.count, 0);

            document.getElementById('totalSdkSessions').textContent = totalSessions.toLocaleString();
            document.getElementById('totalQRScans').textContent = qrSessions.toLocaleString();
            document.getElementById('totalMobileSessions').textContent = mobileSessions.toLocaleString();

            rawTotalDailyData = aggregateBreakdownByDay(filtered, () => true, dateRange);
            rawDailyData = aggregateBreakdownByDay(filtered, r => isQrAppId(r.appId), dateRange);
            rawMobileDailyData = aggregateBreakdownByDay(filtered, r => !isQrAppId(r.appId), dateRange);
            loadedDailyPointCount = rawTotalDailyData.length;

            renderTotalTrendsChart(currentTotalTrendsView);
            renderTrendsChart(currentTrendsView);
            renderMobileTrendsChart(currentMobileTrendsView);

            const uniqueVisitors = countUniqueVisitors(sdkVisitorRows, selectedSites, selectedAppIds);
            document.getElementById('uniqueVisitors').textContent = uniqueVisitors.toLocaleString();
            rawVisitorDailyData = aggregateVisitorDaily(sdkVisitorRows, selectedSites, selectedAppIds, dateRange);
            renderVisitorTrendsChart(currentVisitorTrendsView);

            renderPlatformChart(platformRowsFromBreakdown(filtered.filter(r => isQrAppId(r.appId))));
            renderSdkPlatformChart(platformRowsFromBreakdown(filtered.filter(r => !isQrAppId(r.appId))));
        }

        function selectAllSites() {
            const siteSelect = document.getElementById('siteSelect');
            Array.from(siteSelect.options).forEach(opt => opt.selected = true);
        }
        
        function clearSiteSelection() {
            const siteSelect = document.getElementById('siteSelect');
            Array.from(siteSelect.options).forEach(opt => opt.selected = false);
        }
        
        function getSelectedSites() {
            const siteSelect = document.getElementById('siteSelect');
            return Array.from(siteSelect.selectedOptions).map(opt => opt.value);
        }

        function buildCombinedFilter(accountId, selectedSites, selectedAppIds) {
            let filter = buildSiteFilter(accountId, selectedSites);
            const appSelect = document.getElementById('appSelect');
            if (selectedAppIds && selectedAppIds.length > 0 && selectedAppIds.length < appSelect.options.length) {
                const appConditions = selectedAppIds.map(id => `properties.appId == "${id}"`).join(' || ');
                filter += ` && (${appConditions})`;
            }
            return filter;
        }
        
        function buildSiteFilter(accountId, selectedSites) {
            if (!selectedSites || selectedSites.length === 0 || 
                selectedSites.length === document.getElementById('siteSelect').options.length) {
                return `accountId == "${accountId}"`;
            }
            
            if (selectedSites.length === 1) {
                return `accountId == "${accountId}" && properties.locationHierarchy == "${selectedSites[0]}"`;
            }
            
            const siteConditions = selectedSites.map(s => `properties.locationHierarchy == "${s}"`).join(' || ');
            return `accountId == "${accountId}" && (${siteConditions})`;
        }
        
        async function getData(options = {}) {
            const tenantId = document.getElementById('tenantInput').value.trim();
            
            if (!tenantId) {
                alert('Please enter a tenant ID');
                return;
            }
            
            const dateRange = getSelectedDateRange({ silent: !!options.silentRange });
            if (!dateRange) return;
            
            showLoading(true, 'Downloading SDK session event breakdown...');
            
            const accountId = `${tenantId}${getAccountSuffix()}`;
            
            document.getElementById('accountDisplay').textContent = accountId;
            document.getElementById('dateRangeDisplay').textContent = dateRange.displayText;
            
            try {
                sdkBreakdownRows = await fetchSdkBreakdown(accountId, dateRange);
                sdkVisitorRows = await fetchSdkVisitorBreakdown(accountId, dateRange);
                
                if (sdkBreakdownRows.length === 0) {
                    alert('No SDK session data found for this tenant ID and duration.');
                    showLoading(false);
                    return;
                }
                
                const { siteCounts, appCounts } = deriveSitesAndAppsFromBreakdown(sdkBreakdownRows);
                updateSitesDropdownFromCounts(siteCounts);
                updateAppsDropdownFromCounts(appCounts);
                cachedTenantId = tenantId;
                
                document.getElementById('step2Controls').style.display = 'flex';
                
            } catch (error) {
                console.error('Error fetching SDK breakdown:', error);
                alert('Error fetching data. Check console for details.');
            }
            
            showLoading(false);
        }
        
        async function loadData() {
            const tenantId = document.getElementById('tenantInput').value.trim();
            const selectedSites = getSelectedSites();
            
            if (!tenantId) {
                alert('Please enter a tenant ID');
                return;
            }
            
            const dateRange = getSelectedDateRange({ silent: true });
            if (!dateRange) {
                alert('Please select a valid date range');
                return;
            }
            
            const generation = ++loadDataGeneration;
            
            // Track report generation
            trackEvent('report_generated', {
                tenant_id: tenantId,
                duration_days: dateRange.days
            });
            
            if (selectedSites.length === 0) {
                alert('Please select at least one site');
                return;
            }
            
            showLoading(true, 'Loading report data...');
            await ensureChartsReady();
            
            const accountId = `${tenantId}${getAccountSuffix()}`;
            const { startMs, endMs } = dateRange;
            
            document.getElementById('accountDisplay').textContent = accountId;
            document.getElementById('dateRangeDisplay').textContent = dateRange.displayText;
            
            let completed = false;
            try {
                const selectedAppIds = getSelectedAppIds();
                if (selectedAppIds.length === 0) {
                    alert('Please select at least one App ID');
                    showLoading(false);
                    return;
                }
                const filterExpr = buildSiteFilter(accountId, selectedSites);
                const isStale = () => generation !== loadDataGeneration;

                applySdkSessionMetrics(selectedSites, selectedAppIds, dateRange);
                if (isStale()) return;

                const trackPipeline = (trackTypeId, ...rest) => ({
                    response: { mimeType: 'application/json' },
                    request: {
                        pipeline: [
                            { source: { trackEvents: { trackTypeId }, timeSeries: { period: 'dayRange', first: startMs, last: endMs } } },
                            { filter: filterExpr },
                            ...rest
                        ]
                    }
                });

                const [
                    poiTotalData,
                    poiBreakdownData,
                    quickAccessTotalData,
                    quickAccessBreakdownData,
                    searchTotalData,
                    searchTermsResult
                ] = await Promise.all([
                    fetchAggregation(trackPipeline(POI_TRACK_ID, { group: { fields: [{ count: { sum: 'numEvents' } }] } })),
                    fetchAggregation(trackPipeline(POI_TRACK_ID, { group: { group: ['properties.poiInteracted'], fields: [{ count: { sum: 'numEvents' } }] } }, { sort: ['-count'] })),
                    fetchAggregation(trackPipeline(QUICK_ACCESS_TRACK_ID, { group: { fields: [{ count: { sum: 'numEvents' } }] } })),
                    fetchAggregation(trackPipeline(QUICK_ACCESS_TRACK_ID, { group: { group: ['properties.category'], fields: [{ count: { sum: 'numEvents' } }] } }, { sort: ['-count'] })),
                    fetchAggregation(trackPipeline(SEARCH_TRACK_ID, { group: { fields: [{ count: { sum: 'numEvents' } }] } })),
                    fetchAggregation(trackPipeline(SEARCH_TRACK_ID, { group: { group: ['properties.searchTerm'], fields: [{ count: { sum: 'numEvents' } }] } }, { sort: ['-count'] }))
                ]);
                if (isStale()) return;

                const totalPOI = (poiTotalData?.results?.[0]?.count) || 0;
                document.getElementById('totalPOI').textContent = totalPOI.toLocaleString();
                renderPoiChart(poiBreakdownData?.results || []);

                const totalQuickAccess = (quickAccessTotalData?.results?.[0]?.count) || 0;
                document.getElementById('totalQuickAccess').textContent = totalQuickAccess.toLocaleString();
                renderQuickAccessChart(quickAccessBreakdownData?.results || []);

                const totalSearches = (searchTotalData?.results?.[0]?.count) || 0;
                document.getElementById('totalSearches').textContent = totalSearches.toLocaleString();
                searchTermsData = searchTermsResult?.results || [];
                renderWordCloud(searchTermsData);
                
                // Check if Advanced Analytics is enabled
                const advancedEnabled = document.getElementById('advancedAnalytics').checked;
                const funnelSection = document.getElementById('funnelSection');
                
                if (advancedEnabled) {
                    funnelSection.classList.add('active');

                    const [navStartedData, navCompletedData, navCanceledData] = await Promise.all([
                        fetchAggregation(trackPipeline(NAV_STARTED_TRACK_ID, { group: { fields: [{ count: { sum: 'numEvents' } }] } })),
                        fetchAggregation(trackPipeline(NAV_COMPLETED_TRACK_ID, { group: { fields: [{ count: { sum: 'numEvents' } }] } })),
                        fetchAggregation(trackPipeline(NAV_CANCELED_TRACK_ID, { group: { fields: [{ count: { sum: 'numEvents' } }] } }))
                    ]);
                    if (isStale()) return;

                    const navStarted = (navStartedData?.results?.[0]?.count) || 0;
                    document.getElementById('navStarted').textContent = navStarted.toLocaleString();

                    const navCompleted = (navCompletedData?.results?.[0]?.count) || 0;
                    document.getElementById('navCompleted').textContent = navCompleted.toLocaleString();

                    const navCanceled = (navCanceledData?.results?.[0]?.count) || 0;
                    document.getElementById('navCanceled').textContent = navCanceled.toLocaleString();
                    
                    // Calculate percentages and render Sankey
                    if (navStarted > 0) {
                        const completedPercent = Math.round((navCompleted / navStarted) * 100);
                        const canceledPercent = Math.round((navCanceled / navStarted) * 100);
                        document.getElementById('navCompletedPercent').textContent = `${completedPercent}% completion rate`;
                        document.getElementById('navCanceledPercent').textContent = `${canceledPercent}% cancellation rate`;
                        
                        // Render Sankey diagram
                        renderSankeyChart(navStarted, navCompleted, navCanceled);
                    } else {
                        document.getElementById('navCompletedPercent').textContent = '--';
                        document.getElementById('navCanceledPercent').textContent = '--';
                        renderSankeyChart(0, 0, 0);
                    }
                } else {
                    funnelSection.classList.remove('active');
                }
                
                if (isStale()) return;
                completed = true;
                
            } catch (error) {
                console.error('Error loading data:', error);
                alert('Error loading data. Check console for details.');
            } finally {
                showLoading(false);
            }
            
            if (completed) {
                document.getElementById('downloadBtn').style.display = 'flex';
                lastLoadedRangeKey = getRangeKey(dateRange);
            }
        }
        
        async function setTrendsView(view) {
            currentTrendsView = view;
            if (isReportDataStale()) {
                loadData();
                return;
            }
            await ensureChartsReady();
            const chartCard = document.getElementById('qrTrendsChart').closest('.chart-card-full');
            chartCard.querySelectorAll('.view-toggle button').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === view);
            });
            renderTrendsChart(view);
        }
        
        function aggregateData(data, view) {
            const selectedRange = getSelectedDateRange();
            
            if (view === 'daily') {
                const rangeDays = selectedRange?.days || data.length;
                const useMonthBands = rangeDays > 45;
                
                return data.map(d => {
                    const date = new Date(d.day);
                    const monthShort = MONTH_SHORT[date.getUTCMonth()];
                    const dayNum = date.getUTCDate();
                    const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
                    const fullLabel = date.toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        timeZone: 'UTC'
                    });
                    
                    let label;
                    if (!useMonthBands) {
                        label = `${monthShort} ${dayNum}`;
                    } else if (dayNum === 1) {
                        label = monthShort;
                    } else if (dayNum === 15) {
                        label = String(dayNum);
                    } else {
                        label = '';
                    }
                    
                    return {
                        label,
                        fullLabel,
                        value: d.count || 0,
                        monthKey,
                        monthShort,
                        date
                    };
                });
            }

            if (view === 'weekly') {
                const weeks = {};
                data.forEach(d => {
                    const date = new Date(d.day);
                    const weekStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - date.getUTCDay()));
                    const key = weekStart.toISOString().split('T')[0];
                    if (!weeks[key]) {
                        weeks[key] = { start: weekStart, total: 0 };
                    }
                    weeks[key].total += (d.count || 0);
                });
                
                if (selectedRange) {
                    const filled = [];
                    let cursor = new Date(Date.UTC(
                        selectedRange.startDate.getUTCFullYear(),
                        selectedRange.startDate.getUTCMonth(),
                        selectedRange.startDate.getUTCDate() - selectedRange.startDate.getUTCDay()
                    ));
                    const endDate = selectedRange.endDate;
                    while (cursor <= endDate) {
                        const key = cursor.toISOString().split('T')[0];
                        filled.push({
                            label: `Week of ${cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`,
                            value: weeks[key]?.total || 0
                        });
                        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + 7));
                    }
                    return filled;
                }
                
                return Object.entries(weeks)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([key, val]) => ({
                        label: `Week of ${val.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`,
                        value: val.total
                    }));
            }

            if (view === 'monthly') {
                const months = {};
                data.forEach(d => {
                    const date = new Date(d.day);
                    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
                    if (!months[key]) {
                        months[key] = { date: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)), total: 0 };
                    }
                    months[key].total += (d.count || 0);
                });
                
                if (selectedRange) {
                    const filled = [];
                    let cursor = new Date(Date.UTC(selectedRange.startDate.getUTCFullYear(), selectedRange.startDate.getUTCMonth(), 1));
                    const endMonth = new Date(Date.UTC(selectedRange.endDate.getUTCFullYear(), selectedRange.endDate.getUTCMonth(), 1));
                    while (cursor <= endMonth) {
                        const key = `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`;
                        filled.push({
                            label: cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
                            value: months[key]?.total || 0
                        });
                        cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
                    }
                    return filled;
                }
                
                return Object.entries(months)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([key, val]) => ({
                        label: val.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }),
                        value: val.total
                    }));
            }

            return [];
        }
        

        function renderTotalTrendsChart(view) {
            const aggregated = aggregateData(rawTotalDailyData, view);
            renderTrendBarChart(
                'totalTrendsChart',
                aggregated,
                view,
                'Sessions',
                'rgba(99, 102, 241, 0.7)',
                'rgba(99, 102, 241, 1)',
                totalTrendsChartRef
            );
        }

        function renderMobileTrendsChart(view) {
            const aggregated = aggregateData(rawMobileDailyData, view);
            renderTrendBarChart(
                'mobileTrendsChart',
                aggregated,
                view,
                'Mobile App Sessions',
                'rgba(34, 197, 94, 0.7)',
                'rgba(34, 197, 94, 1)',
                mobileTrendsChartRef
            );
        }

        async function setTotalTrendsView(view) {
            currentTotalTrendsView = view;
            if (isReportDataStale()) { loadData(); return; }
            await ensureChartsReady();
            const chartCard = document.getElementById('totalTrendsChart').closest('.chart-card-full');
            chartCard.querySelectorAll('.view-toggle button').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === view);
            });
            renderTotalTrendsChart(view);
        }

        async function setMobileTrendsView(view) {
            currentMobileTrendsView = view;
            if (isReportDataStale()) { loadData(); return; }
            await ensureChartsReady();
            const chartCard = document.getElementById('mobileTrendsChart').closest('.chart-card-full');
            chartCard.querySelectorAll('.view-toggle button').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === view);
            });
            renderMobileTrendsChart(view);
        }

        function renderSdkPlatformChart(data) {
            const canvas = document.getElementById('sdkPlatformChart');
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            if (sdkPlatformChart) sdkPlatformChart.destroy();
            const { ios, android, web, total } = countPlatformFromPhoneMake(data);
            document.getElementById('sdkIosCount').textContent = ios.toLocaleString();
            document.getElementById('sdkAndroidCount').textContent = android.toLocaleString();
            document.getElementById('sdkWebCount').textContent = web.toLocaleString();
            document.getElementById('sdkIosPercent').textContent = total > 0 ? `${Math.round((ios / total) * 100)}%` : '0%';
            document.getElementById('sdkAndroidPercent').textContent = total > 0 ? `${Math.round((android / total) * 100)}%` : '0%';
            document.getElementById('sdkWebPercent').textContent = total > 0 ? `${Math.round((web / total) * 100)}%` : '0%';
            sdkPlatformChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['iOS', 'Android', 'Web'],
                    datasets: [{
                        data: total > 0 ? [ios, android, web] : [1, 1, 1],
                        backgroundColor: ['rgba(0, 122, 255, 0.85)', 'rgba(52, 199, 89, 0.85)', 'rgba(255, 149, 0, 0.85)'],
                        borderColor: ['rgba(0, 122, 255, 1)', 'rgba(52, 199, 89, 1)', 'rgba(255, 149, 0, 1)'],
                        borderWidth: 2,
                        hoverOffset: 10
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '55%',
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            color: '#fff',
                            font: { weight: 'bold', size: 13 },
                            formatter: function(value) {
                                if (total === 0 || value === 0) return '';
                                const percentage = Math.round((value / total) * 100);
                                return percentage >= 5 ? `${value}\n(${percentage}%)` : '';
                            },
                            textAlign: 'center'
                        }
                    }
                },
                plugins: typeof ChartDataLabels !== 'undefined' ? [ChartDataLabels] : []
            });
        }

        function renderTrendsChart(view) {
            const aggregated = aggregateData(rawDailyData, view);
            renderTrendBarChart(
                'qrTrendsChart',
                aggregated,
                view,
                'QR Scans',
                'rgba(0, 198, 255, 0.7)',
                'rgba(0, 198, 255, 1)',
                qrTrendsChartRef
            );
        }
        
        function renderVisitorTrendsChart(view) {
            const aggregated = aggregateData(rawVisitorDailyData, view);
            renderTrendBarChart(
                'visitorTrendsChart',
                aggregated,
                view,
                'Unique Visitors',
                'rgba(34, 197, 94, 0.7)',
                'rgba(34, 197, 94, 1)',
                visitorTrendsChartRef
            );
        }
        
        async function setVisitorTrendsView(view) {
            currentVisitorTrendsView = view;
            if (isReportDataStale()) {
                loadData();
                return;
            }
            await ensureChartsReady();
            const chartCard = document.getElementById('visitorTrendsChart').closest('.chart-card-full');
            chartCard.querySelectorAll('.view-toggle button').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === view);
            });
            renderVisitorTrendsChart(view);
        }
        
        function renderPlatformChart(data) {
            const ctx = document.getElementById('platformChart').getContext('2d');
            
            if (platformChart) platformChart.destroy();
            
            const { ios, android, web, total } = countPlatformFromPhoneMake(data);
            
            // Update legend
            document.getElementById('iosCount').textContent = ios.toLocaleString();
            document.getElementById('androidCount').textContent = android.toLocaleString();
            document.getElementById('webCount').textContent = web.toLocaleString();
            document.getElementById('iosPercent').textContent = total > 0 ? `${Math.round((ios / total) * 100)}%` : '0%';
            document.getElementById('androidPercent').textContent = total > 0 ? `${Math.round((android / total) * 100)}%` : '0%';
            document.getElementById('webPercent').textContent = total > 0 ? `${Math.round((web / total) * 100)}%` : '0%';
            
            platformChart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['iOS', 'Android', 'Web'],
                    datasets: [{
                        data: total > 0 ? [ios, android, web] : [1, 1, 1],
                        backgroundColor: [
                            'rgba(0, 122, 255, 0.85)',
                            'rgba(52, 199, 89, 0.85)',
                            'rgba(255, 149, 0, 0.85)'
                        ],
                        borderColor: [
                            'rgba(0, 122, 255, 1)',
                            'rgba(52, 199, 89, 1)',
                            'rgba(255, 149, 0, 1)'
                        ],
                        borderWidth: 2,
                        hoverOffset: 10
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '55%',
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            color: '#fff',
                            font: {
                                weight: 'bold',
                                size: 13
                            },
                            formatter: function(value, context) {
                                if (total === 0 || value === 0) return '';
                                const percentage = Math.round((value / total) * 100);
                                return percentage >= 5 ? `${value}\n(${percentage}%)` : '';
                            },
                            textAlign: 'center'
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    if (total === 0) return 'No data';
                                    const percentage = Math.round((context.raw / total) * 100);
                                    return `${context.label}: ${context.raw.toLocaleString()} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }
        
        function renderPoiChart(data) {
            const ctx = document.getElementById('poiChart').getContext('2d');
            
            if (poiChart) poiChart.destroy();
            
            // Process and get top 10 POIs
            const top10 = data.slice(0, 10).map(d => {
                const poiString = d.properties?.poiInteracted || '';
                const { name, typeCode } = parsePoiInteracted(poiString);
                return {
                    label: name.length > 30 ? name.substring(0, 30) + '...' : name,
                    fullLabel: `${name} (${formatTypeCode(typeCode)})`,
                    typeCode: formatTypeCode(typeCode),
                    count: d.count || 0
                };
            });
            
            // Colors for different bars (gradient effect)
            const colors = [
                'rgba(168, 85, 247, 0.85)',
                'rgba(139, 92, 246, 0.85)',
                'rgba(124, 58, 237, 0.85)',
                'rgba(109, 40, 217, 0.85)',
                'rgba(91, 33, 182, 0.85)',
                'rgba(76, 29, 149, 0.85)',
                'rgba(88, 28, 135, 0.85)',
                'rgba(107, 33, 168, 0.85)',
                'rgba(126, 34, 206, 0.85)',
                'rgba(147, 51, 234, 0.85)'
            ];
            
            poiChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: top10.length ? top10.map(d => d.label) : ['No Data'],
                    datasets: [{
                        label: 'POI Selections',
                        data: top10.length ? top10.map(d => d.count) : [0],
                        backgroundColor: colors.slice(0, top10.length),
                        borderColor: colors.slice(0, top10.length).map(c => c.replace('0.85', '1')),
                        borderWidth: 1,
                        borderRadius: 6,
                        barPercentage: 0.75
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            color: '#fff',
                            anchor: 'end',
                            align: 'end',
                            offset: 4,
                            font: {
                                weight: '600',
                                size: 11
                            },
                            formatter: function(value) {
                                return value > 0 ? value : '';
                            }
                        },
                        tooltip: {
                            callbacks: {
                                title: function(context) {
                                    const idx = context[0].dataIndex;
                                    return top10[idx]?.fullLabel || '';
                                },
                                label: function(context) {
                                    return `Selections: ${context.raw.toLocaleString()}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { 
                                color: 'rgba(255, 255, 255, 0.6)',
                                font: { size: 11 }
                            }
                        },
                        y: {
                            grid: { display: false },
                            ticks: { 
                                color: 'rgba(255, 255, 255, 0.8)',
                                font: { size: 11 },
                                crossAlign: 'far'
                            }
                        }
                    },
                    layout: {
                        padding: { right: 40 }
                    }
                }
            });
        }
        
        function renderQuickAccessChart(data) {
            const ctx = document.getElementById('quickAccessChart').getContext('2d');
            
            if (quickAccessChart) quickAccessChart.destroy();
            
            // Filter out null categories and get top 10
            const filtered = data.filter(d => d.properties?.category && d.properties.category !== 'null');
            const top10 = filtered.slice(0, 10).map(d => ({
                label: d.properties.category,
                count: d.count || 0
            }));
            
            // Orange gradient colors
            const colors = [
                'rgba(249, 115, 22, 0.85)',
                'rgba(234, 88, 12, 0.85)',
                'rgba(251, 146, 60, 0.85)',
                'rgba(253, 186, 116, 0.85)',
                'rgba(255, 138, 76, 0.85)',
                'rgba(245, 158, 11, 0.85)',
                'rgba(217, 119, 6, 0.85)',
                'rgba(180, 83, 9, 0.85)',
                'rgba(146, 64, 14, 0.85)',
                'rgba(124, 45, 18, 0.85)'
            ];
            
            quickAccessChart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: top10.length ? top10.map(d => d.label) : ['No Data'],
                    datasets: [{
                        label: 'Quick-Access Selections',
                        data: top10.length ? top10.map(d => d.count) : [0],
                        backgroundColor: colors.slice(0, top10.length),
                        borderColor: colors.slice(0, top10.length).map(c => c.replace('0.85', '1')),
                        borderWidth: 1,
                        borderRadius: 6,
                        barPercentage: 0.75
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        datalabels: {
                            color: '#fff',
                            anchor: 'end',
                            align: 'end',
                            offset: 4,
                            font: {
                                weight: '600',
                                size: 11
                            },
                            formatter: function(value) {
                                return value > 0 ? value : '';
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `Selections: ${context.raw.toLocaleString()}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            beginAtZero: true,
                            grid: { color: 'rgba(255, 255, 255, 0.05)' },
                            ticks: { 
                                color: 'rgba(255, 255, 255, 0.6)',
                                font: { size: 11 }
                            }
                        },
                        y: {
                            grid: { display: false },
                            ticks: { 
                                color: 'rgba(255, 255, 255, 0.8)',
                                font: { size: 11 },
                                crossAlign: 'far'
                            }
                        }
                    },
                    layout: {
                        padding: { right: 40 }
                    }
                }
            });
        }
        
        async function renderWordCloud(data) {
            const container = document.getElementById('wordcloudContainer');
            const canvas = document.getElementById('wordcloudCanvas');
            
            // Set canvas dimensions
            canvas.width = container.offsetWidth || 600;
            canvas.height = container.offsetHeight || 320;
            
            // Filter out empty search terms and prepare word list
            const filtered = data.filter(d => {
                const term = d.properties?.searchTerm;
                return term && term.trim().length > 0;
            });
            
            if (filtered.length === 0) {
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.font = '16px Inter';
                ctx.textAlign = 'center';
                ctx.fillText('No search data available', canvas.width / 2, canvas.height / 2);
                return;
            }

            await ReportLoaders.ensureWordCloud();
            
            // Calculate max count for scaling
            const maxCount = Math.max(...filtered.map(d => d.count));
            const minSize = 14;
            const maxSize = 60;
            
            // Prepare word list for wordcloud2: [[word, size], ...]
            const wordList = filtered.slice(0, 50).map(d => {
                const term = d.properties.searchTerm;
                const count = d.count;
                // Scale size based on count
                const size = minSize + ((count / maxCount) * (maxSize - minSize));
                return [term, size];
            });
            
            // Teal color palette
            const colors = [
                '#14b8a6', '#0d9488', '#0f766e', '#115e59',
                '#06b6d4', '#0891b2', '#0e7490', '#155e75',
                '#22d3d1', '#2dd4bf', '#5eead4', '#99f6e4'
            ];
            
            // Clear canvas
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Render word cloud
            WordCloud(canvas, {
                list: wordList,
                gridSize: 8,
                weightFactor: 1,
                fontFamily: 'Inter, sans-serif',
                color: function() {
                    return colors[Math.floor(Math.random() * colors.length)];
                },
                rotateRatio: 0.3,
                rotationSteps: 2,
                backgroundColor: 'transparent',
                shuffle: true,
                drawOutOfBound: false,
                shrinkToFit: true
            });
        }
        
        async function renderSankeyChart(started, completed, canceled) {
            await ReportLoaders.ensureGoogleCharts();
            googleChartsLoaded = true;

            const container = document.getElementById('sankeyChart');
            
            if (started === 0) {
                container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:rgba(255,255,255,0.5);font-size:16px;">No navigation data available</div>';
                return;
            }
            
            const data = new google.visualization.DataTable();
            data.addColumn('string', 'From');
            data.addColumn('string', 'To');
            data.addColumn('number', 'Count');
            data.addColumn({type: 'string', role: 'tooltip'});
            
            const completedPercent = Math.round((completed / started) * 100);
            const canceledPercent = Math.round((canceled / started) * 100);
            
            data.addRows([
                ['Navigation Started', 'Navigation Completed', completed, 
                 `Navigation Started → Completed\n${completed.toLocaleString()} users (${completedPercent}%)`],
                ['Navigation Started', 'Navigation Canceled', canceled, 
                 `Navigation Started → Canceled\n${canceled.toLocaleString()} users (${canceledPercent}%)`]
            ]);
            
            const options = {
                width: '100%',
                height: 350,
                sankey: {
                    node: {
                        colors: ['#3b82f6', '#22c55e', '#ef4444'],
                        label: {
                            fontName: 'Inter',
                            fontSize: 14,
                            color: '#ffffff',
                            bold: true
                        },
                        nodePadding: 40,
                        width: 20
                    },
                    link: {
                        colorMode: 'gradient',
                        colors: ['#3b82f6', '#22c55e', '#ef4444']
                    },
                    iterations: 32
                },
                tooltip: {
                    textStyle: {
                        fontName: 'Inter',
                        fontSize: 13
                    }
                }
            };
            
            const chart = new google.visualization.Sankey(container);
            chart.draw(data, options);
        }
        
        // Export Modal Functions
        function showExportModal() {
            const tenantId = document.getElementById('tenantInput').value.trim();
            const selectedSites = getSelectedSites();
            const siteSelect = document.getElementById('siteSelect');
            const allSites = siteSelect.options.length;
            const advancedChecked = document.getElementById('advancedAnalytics').checked;
            
            // Set default values
            document.getElementById('exportCustomerName').value = tenantId;
            document.getElementById('exportSites').value = selectedSites.length === allSites ? 'All Sites' : selectedSites.join(', ');
            
            // Set advanced analytics radio
            document.querySelector(`input[name="exportAdvanced"][value="${advancedChecked ? 'yes' : 'no'}"]`).checked = true;
            
            // Set trends view radio based on current view
            document.querySelector(`input[name="exportTrends"][value="${currentTrendsView}"]`).checked = true;
            
            document.getElementById('exportModal').classList.add('active');
        }
        
        function closeExportModal() {
            document.getElementById('exportModal').classList.remove('active');
        }
        
        // Get export settings from modal
        function getExportSettings() {
            const customerName = document.getElementById('exportCustomerName').value || 'N/A';
            const sitesText = document.getElementById('exportSites').value || 'All Sites';
            const includeAdvanced = document.querySelector('input[name="exportAdvanced"]:checked').value === 'yes';
            const trendsView = document.querySelector('input[name="exportTrends"]:checked').value;
            const selectedRange = getSelectedDateRange();
            const days = selectedRange ? selectedRange.days : 30;
            const dateRange = selectedRange ? formatDateRange(selectedRange.startDate, selectedRange.endDate) : '';
            
            return { customerName, sitesText, includeAdvanced, trendsView, days, dateRange };
        }
        
        // Export as PDF using html2pdf (light theme for reliability)
        async function exportAsPrintPDF() {
            const settings = getExportSettings();
            closeExportModal();
            showLoading(true, 'Generating PDF...');
            await ReportLoaders.ensureHtml2Pdf();
            
            // Update trends view if needed
            if (settings.trendsView !== currentTrendsView) {
                setTrendsView(settings.trendsView);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Capture charts
            const trendsChartImg = document.getElementById('qrTrendsChart')?.toDataURL('image/png', 1.0) || '';
            const platformChartImg = document.getElementById('platformChart')?.toDataURL('image/png', 1.0) || '';
            const poiChartImg = document.getElementById('poiChart')?.toDataURL('image/png', 1.0) || '';
            const quickAccessChartImg = document.getElementById('quickAccessChart')?.toDataURL('image/png', 1.0) || '';
            
            // Get metrics
            const totalQRScans = document.getElementById('totalQRScans').textContent;
            const uniqueVisitors = document.getElementById('uniqueVisitors').textContent;
            const iosCount = document.getElementById('iosCount').textContent;
            const androidCount = document.getElementById('androidCount').textContent;
            const webCount = document.getElementById('webCount').textContent;
            const iosPercent = document.getElementById('iosPercent').textContent;
            const androidPercent = document.getElementById('androidPercent').textContent;
            const webPercent = document.getElementById('webPercent').textContent;
            const totalPOI = document.getElementById('totalPOI').textContent;
            const totalQuickAccess = document.getElementById('totalQuickAccess').textContent;
            const totalSearches = document.getElementById('totalSearches').textContent;
            const navStarted = document.getElementById('navStarted')?.textContent || '--';
            const navCompleted = document.getElementById('navCompleted')?.textContent || '--';
            const navCanceled = document.getElementById('navCanceled')?.textContent || '--';
            const navCompletedPercent = document.getElementById('navCompletedPercent')?.textContent || '';
            const navCanceledPercent = document.getElementById('navCanceledPercent')?.textContent || '';
            
            // Build clean PDF HTML
            const pdfDiv = document.createElement('div');
            pdfDiv.innerHTML = `
                <div style="font-family:Arial,sans-serif;padding:30px;color:#1a1a2e;width:750px;">
                    <div style="border-bottom:3px solid #0072ff;padding-bottom:15px;margin-bottom:20px;">
                        <div style="font-size:22px;font-weight:bold;color:#0072ff;">Cisco Spaces Indoor Navigation SDK Analytics Report</div>
                    </div>
                    <div style="display:flex;gap:20px;margin-bottom:25px;padding:15px;background:#f8f9fa;border-radius:8px;">
                        <div style="flex:1;text-align:center;"><div style="font-size:10px;color:#666;text-transform:uppercase;">Customer</div><div style="font-size:14px;font-weight:600;">${settings.customerName}</div></div>
                        <div style="flex:1;text-align:center;border-left:1px solid #ddd;border-right:1px solid #ddd;"><div style="font-size:10px;color:#666;text-transform:uppercase;">Duration</div><div style="font-size:14px;font-weight:600;">${settings.dateRange}</div></div>
                        <div style="flex:1;text-align:center;"><div style="font-size:10px;color:#666;text-transform:uppercase;">Sites</div><div style="font-size:13px;font-weight:600;">${settings.sitesText.substring(0,50)}</div></div>
                    </div>
                    <div style="margin-bottom:20px;"><div style="font-size:14px;font-weight:600;color:#0072ff;border-bottom:2px solid #0072ff;padding-bottom:5px;margin-bottom:12px;">QR Code Scanning</div>
                        <div style="display:flex;gap:15px;">
                            <div style="flex:1;padding:20px;background:#e3f2fd;border-radius:8px;text-align:center;"><div style="font-size:11px;color:#666;">Total QR Scans</div><div style="font-size:32px;font-weight:bold;color:#0072ff;">${totalQRScans}</div></div>
                            <div style="flex:1;padding:20px;background:#e8f5e9;border-radius:8px;text-align:center;"><div style="font-size:11px;color:#666;">Unique Visitors</div><div style="font-size:32px;font-weight:bold;color:#22c55e;">${uniqueVisitors}</div></div>
                        </div>
                    </div>
                    <div style="margin-bottom:20px;background:#f8f9fa;border-radius:8px;padding:15px;"><div style="font-size:13px;font-weight:600;margin-bottom:10px;">QR Scan Trends</div><img src="${trendsChartImg}" style="width:100%;height:150px;object-fit:contain;"></div>
                    <div style="margin-bottom:20px;"><div style="font-size:14px;font-weight:600;color:#22c55e;border-bottom:2px solid #22c55e;padding-bottom:5px;margin-bottom:12px;">Platform Breakdown</div>
                        <div style="display:flex;gap:15px;">
                            <div style="width:40%;background:#f8f9fa;border-radius:8px;padding:10px;"><img src="${platformChartImg}" style="width:100%;height:120px;object-fit:contain;"></div>
                            <div style="flex:1;display:flex;gap:10px;">
                                <div style="flex:1;padding:15px;background:#f0f9ff;border-radius:8px;text-align:center;"><div style="font-size:11px;color:#666;">iOS</div><div style="font-size:24px;font-weight:bold;color:#007AFF;">${iosCount}</div><div style="font-size:10px;color:#999;">${iosPercent}</div></div>
                                <div style="flex:1;padding:15px;background:#f0fdf4;border-radius:8px;text-align:center;"><div style="font-size:11px;color:#666;">Android</div><div style="font-size:24px;font-weight:bold;color:#34C759;">${androidCount}</div><div style="font-size:10px;color:#999;">${androidPercent}</div></div>
                                <div style="flex:1;padding:15px;background:#fff7ed;border-radius:8px;text-align:center;"><div style="font-size:11px;color:#666;">Web</div><div style="font-size:24px;font-weight:bold;color:#FF9500;">${webCount}</div><div style="font-size:10px;color:#999;">${webPercent}</div></div>
                            </div>
                        </div>
                    </div>
                    <div style="margin-bottom:20px;"><div style="font-size:14px;font-weight:600;color:#a855f7;border-bottom:2px solid #a855f7;padding-bottom:5px;margin-bottom:12px;">Point of Interest</div>
                        <div style="display:flex;gap:15px;">
                            <div style="width:30%;padding:20px;background:#faf5ff;border-radius:8px;text-align:center;"><div style="font-size:11px;color:#666;">Total POI</div><div style="font-size:32px;font-weight:bold;color:#a855f7;">${totalPOI}</div></div>
                            <div style="flex:1;background:#f8f9fa;border-radius:8px;padding:10px;"><img src="${poiChartImg}" style="width:100%;height:150px;object-fit:contain;"></div>
                        </div>
                    </div>
                    <div style="margin-bottom:20px;"><div style="font-size:14px;font-weight:600;color:#f97316;border-bottom:2px solid #f97316;padding-bottom:5px;margin-bottom:12px;">Quick Access</div>
                        <div style="display:flex;gap:15px;">
                            <div style="width:30%;padding:20px;background:#fff7ed;border-radius:8px;text-align:center;"><div style="font-size:11px;color:#666;">Total Quick-Access</div><div style="font-size:32px;font-weight:bold;color:#f97316;">${totalQuickAccess}</div></div>
                            <div style="flex:1;background:#f8f9fa;border-radius:8px;padding:10px;"><img src="${quickAccessChartImg}" style="width:100%;height:150px;object-fit:contain;"></div>
                        </div>
                    </div>
                    <div style="margin-bottom:20px;"><div style="font-size:14px;font-weight:600;color:#14b8a6;border-bottom:2px solid #14b8a6;padding-bottom:5px;margin-bottom:12px;">Search</div>
                        <div style="padding:20px;background:#f0fdfa;border-radius:8px;text-align:center;"><div style="font-size:11px;color:#666;">Total Searches</div><div style="font-size:32px;font-weight:bold;color:#14b8a6;">${totalSearches}</div></div>
                    </div>
                    ${settings.includeAdvanced ? `
                    <div style="margin-bottom:20px;"><div style="font-size:14px;font-weight:600;color:#ec4899;border-bottom:2px solid #ec4899;padding-bottom:5px;margin-bottom:12px;">Navigation Funnel</div>
                        <div style="display:flex;gap:15px;">
                            <div style="flex:1;padding:20px;background:#eff6ff;border-radius:8px;text-align:center;"><div style="font-size:11px;color:#666;">Started</div><div style="font-size:28px;font-weight:bold;color:#3b82f6;">${navStarted}</div></div>
                            <div style="flex:1;padding:20px;background:#f0fdf4;border-radius:8px;text-align:center;"><div style="font-size:11px;color:#666;">Completed</div><div style="font-size:28px;font-weight:bold;color:#22c55e;">${navCompleted}</div><div style="font-size:10px;color:#666;">${navCompletedPercent}</div></div>
                            <div style="flex:1;padding:20px;background:#fef2f2;border-radius:8px;text-align:center;"><div style="font-size:11px;color:#666;">Canceled</div><div style="font-size:28px;font-weight:bold;color:#ef4444;">${navCanceled}</div><div style="font-size:10px;color:#666;">${navCanceledPercent}</div></div>
                        </div>
                    </div>` : ''}
                    <div style="margin-top:30px;padding-top:15px;border-top:1px solid #ddd;font-size:10px;color:#999;">Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} | Cisco Spaces Indoor Navigation SDK Analytics</div>
                </div>`;
            
            document.body.appendChild(pdfDiv);
            await new Promise(r => setTimeout(r, 500));
            
            try {
                await html2pdf().set({
                    margin: 10,
                    filename: `Indoor_Navigation_Report_${settings.customerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`,
                    image: { type: 'jpeg', quality: 0.98 },
                    html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
                    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                }).from(pdfDiv.firstElementChild).save();
            } catch (e) {
                console.error('PDF error:', e);
                alert('Error generating PDF');
            }
            
            document.body.removeChild(pdfDiv);
            showLoading(false);
        }
        
        // Export as Standalone HTML Report
        async function exportAsHTML() {
            const settings = getExportSettings();
            closeExportModal();
            
            // Track report download
            const tenantId = document.getElementById('tenantInput').value.trim();
            const dateRange = getSelectedDateRange();
            trackEvent('report_downloaded', {
                tenant_id: tenantId,
                duration_days: dateRange ? dateRange.days : 0,
                report_type: 'HTML'
            });
            
            showLoading(true, 'Generating HTML report...');
            
            // Update trends view if needed
            if (settings.trendsView !== currentTrendsView) {
                setTrendsView(settings.trendsView);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Sync visitor trends view to match QR trends view
            if (settings.trendsView !== currentVisitorTrendsView) {
                setVisitorTrendsView(settings.trendsView);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Capture all charts as base64 images
            const trendsChartImg = document.getElementById('qrTrendsChart')?.toDataURL('image/png', 1.0) || '';
            const visitorTrendsChartImg = document.getElementById('visitorTrendsChart')?.toDataURL('image/png', 1.0) || '';
            const platformChartImg = document.getElementById('platformChart')?.toDataURL('image/png', 1.0) || '';
            const poiChartImg = document.getElementById('poiChart')?.toDataURL('image/png', 1.0) || '';
            const quickAccessChartImg = document.getElementById('quickAccessChart')?.toDataURL('image/png', 1.0) || '';
            const wordcloudImg = document.getElementById('wordcloudCanvas')?.toDataURL('image/png', 1.0) || '';
            
            // Get metric values
            const totalQRScans = document.getElementById('totalQRScans').textContent;
            const uniqueVisitors = document.getElementById('uniqueVisitors').textContent;
            const iosCount = document.getElementById('iosCount').textContent;
            const androidCount = document.getElementById('androidCount').textContent;
            const webCount = document.getElementById('webCount').textContent;
            const iosPercent = document.getElementById('iosPercent').textContent;
            const androidPercent = document.getElementById('androidPercent').textContent;
            const webPercent = document.getElementById('webPercent').textContent;
            const totalPOI = document.getElementById('totalPOI').textContent;
            const totalQuickAccess = document.getElementById('totalQuickAccess').textContent;
            const totalSearches = document.getElementById('totalSearches').textContent;
            const navStarted = document.getElementById('navStarted')?.textContent || '--';
            const navCompleted = document.getElementById('navCompleted')?.textContent || '--';
            const navCanceled = document.getElementById('navCanceled')?.textContent || '--';
            const navCompletedPercent = document.getElementById('navCompletedPercent')?.textContent || '';
            const navCanceledPercent = document.getElementById('navCanceledPercent')?.textContent || '';
            
            // Generate standalone HTML
            const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Indoor Navigation SDK Report - ${settings.customerName}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(180deg, #0f0f1a 0%, #1a1a2e 100%);
            min-height: 100vh;
            color: #ffffff;
            padding: 40px;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 24px;
            border-bottom: 2px solid rgba(0, 198, 255, 0.3);
            margin-bottom: 24px;
        }
        .title {
            font-size: 28px;
            font-weight: 700;
            background: linear-gradient(90deg, #00c6ff 0%, #0072ff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .meta-bar {
            display: flex;
            gap: 32px;
            padding: 20px 24px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 16px;
            margin-bottom: 32px;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .meta-item { flex: 1; text-align: center; }
        .meta-label { font-size: 10px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 6px; }
        .meta-value { font-size: 15px; font-weight: 600; }
        .section { margin-bottom: 32px; }
        .section-title {
            font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.7);
            margin-bottom: 16px; padding-bottom: 8px;
            border-bottom: 1px solid rgba(255,255,255,0.1);
            display: flex; align-items: center; gap: 8px;
        }
        .section-title::before {
            content: ''; width: 4px; height: 16px; border-radius: 2px;
        }
        .section-title.blue::before { background: linear-gradient(180deg, #00c6ff, #0072ff); }
        .section-title.green::before { background: linear-gradient(180deg, #22c55e, #16a34a); }
        .section-title.purple::before { background: linear-gradient(180deg, #a855f7, #6366f1); }
        .section-title.orange::before { background: linear-gradient(180deg, #f97316, #ea580c); }
        .section-title.teal::before { background: linear-gradient(180deg, #14b8a6, #06b6d4); }
        .section-title.pink::before { background: linear-gradient(180deg, #ec4899, #8b5cf6); }
        .metrics-row { display: flex; gap: 20px; margin-bottom: 20px; }
        .metric-card {
            flex: 1; padding: 24px; border-radius: 20px; text-align: center;
        }
        .metric-card.blue {
            background: linear-gradient(135deg, rgba(0,198,255,0.15), rgba(0,114,255,0.15));
            border: 1px solid rgba(0,198,255,0.3);
        }
        .metric-card.green {
            background: linear-gradient(135deg, rgba(34,197,94,0.15), rgba(22,163,74,0.15));
            border: 1px solid rgba(34,197,94,0.3);
        }
        .metric-card.purple {
            background: linear-gradient(135deg, rgba(168,85,247,0.15), rgba(99,102,241,0.15));
            border: 1px solid rgba(168,85,247,0.3);
        }
        .metric-card.orange {
            background: linear-gradient(135deg, rgba(249,115,22,0.15), rgba(234,88,12,0.15));
            border: 1px solid rgba(249,115,22,0.3);
        }
        .metric-card.teal {
            background: linear-gradient(135deg, rgba(20,184,166,0.15), rgba(6,182,212,0.15));
            border: 1px solid rgba(20,184,166,0.3);
        }
        .metric-label { font-size: 12px; color: rgba(255,255,255,0.6); margin-bottom: 8px; text-transform: uppercase; }
        .metric-value { font-size: 42px; font-weight: 700; }
        .metric-value.blue { color: #00c6ff; }
        .metric-value.green { color: #22c55e; }
        .metric-value.purple { color: #a855f7; }
        .metric-value.orange { color: #f97316; }
        .metric-value.teal { color: #14b8a6; }
        .metric-subtitle { font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 4px; }
        .chart-card {
            background: rgba(255,255,255,0.03);
            border-radius: 20px;
            padding: 24px;
            border: 1px solid rgba(255,255,255,0.08);
            margin-bottom: 20px;
        }
        .chart-title { font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.8); margin-bottom: 16px; }
        .chart-img { width: 100%; height: auto; border-radius: 8px; }
        .two-col { display: flex; gap: 24px; }
        .col-left { width: 35%; }
        .col-right { width: 65%; }
        .platform-grid { display: flex; gap: 16px; }
        .platform-card {
            flex: 1; padding: 20px; border-radius: 16px;
            background: rgba(255,255,255,0.05); text-align: center;
        }
        .platform-label { font-size: 13px; color: rgba(255,255,255,0.6); margin-bottom: 8px; }
        .platform-value { font-size: 32px; font-weight: 700; }
        .platform-percent { font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 4px; }
        .funnel-grid { display: flex; gap: 16px; }
        .funnel-card { flex: 1; padding: 20px; border-radius: 16px; text-align: center; }
        .funnel-card.started { background: linear-gradient(135deg, rgba(59,130,246,0.2), rgba(37,99,235,0.2)); border: 1px solid rgba(59,130,246,0.3); }
        .funnel-card.completed { background: linear-gradient(135deg, rgba(34,197,94,0.2), rgba(22,163,74,0.2)); border: 1px solid rgba(34,197,94,0.3); }
        .funnel-card.canceled { background: linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.2)); border: 1px solid rgba(239,68,68,0.3); }
        .funnel-label { font-size: 11px; color: rgba(255,255,255,0.6); margin-bottom: 8px; }
        .funnel-value { font-size: 32px; font-weight: 700; }
        .funnel-value.blue { color: #3b82f6; }
        .funnel-value.green { color: #22c55e; }
        .funnel-value.red { color: #ef4444; }
        .funnel-percent { font-size: 11px; color: rgba(255,255,255,0.5); margin-top: 6px; }
        .note {
            margin-top: 16px; padding: 16px; background: rgba(236,72,153,0.1);
            border-radius: 12px; border-left: 3px solid #ec4899;
            font-size: 12px; color: rgba(255,255,255,0.7);
        }
        .footer {
            margin-top: 48px; padding-top: 24px;
            border-top: 1px solid rgba(255,255,255,0.1);
            display: flex; justify-content: space-between; align-items: center;
        }
        .footer-text { font-size: 11px; color: rgba(255,255,255,0.4); }
        @media print {
            body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="title">Cisco Spaces Indoor Navigation SDK Analytics Report</div>
            <div class="logo" style="display:flex;align-items:center;gap:8px;">
                <svg width="32" height="32" viewBox="0 0 100 100"><defs><linearGradient id="lg1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#00c6ff"/><stop offset="100%" style="stop-color:#0072ff"/></linearGradient></defs><circle cx="35" cy="50" r="30" fill="url(#lg1)"/><circle cx="65" cy="50" r="30" fill="#22c55e" opacity="0.9"/></svg>
                <span style="font-weight:600;font-size:14px;color:rgba(255,255,255,0.8);">Cisco Spaces</span>
            </div>
        </div>
        
        <div class="meta-bar">
            <div class="meta-item">
                <div class="meta-label">Customer</div>
                <div class="meta-value">${settings.customerName}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Duration</div>
                <div class="meta-value">${settings.dateRange}</div>
                <div style="font-size:11px;color:rgba(255,255,255,0.4);margin-top:2px;">Last ${settings.days} Days</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Sites</div>
                <div class="meta-value" style="font-size:${settings.sitesText.length > 40 ? '12px' : '15px'};">${settings.sitesText.length > 60 ? settings.sitesText.substring(0, 60) + '...' : settings.sitesText}</div>
            </div>
        </div>
        
        <!-- QR Code Scanning -->
        <div class="section">
            <div class="section-title blue">Key Metrics • QR Code Scanning</div>
            <div class="metrics-row">
                <div class="metric-card blue">
                    <div class="metric-label">Total QR Scans</div>
                    <div class="metric-value blue">${totalQRScans}</div>
                    <div class="metric-subtitle">QR codes scanned for indoor navigation</div>
                </div>
                <div class="metric-card green">
                    <div class="metric-label">Unique Visitors</div>
                    <div class="metric-value green">${uniqueVisitors}</div>
                    <div class="metric-subtitle">Distinct users who scanned QR codes</div>
                </div>
            </div>
        </div>
        
        <!-- QR Scan Trends Chart -->
        <div class="section">
            <div class="chart-card">
                <div class="chart-title">QR Scan Trends (${settings.trendsView.charAt(0).toUpperCase() + settings.trendsView.slice(1)})</div>
                <img src="${trendsChartImg}" class="chart-img" style="height:220px; object-fit:contain;">
            </div>
        </div>
        
        <!-- Unique Visitors Trends Chart -->
        <div class="section">
            <div class="chart-card">
                <div class="chart-title" style="color:#22c55e;">Unique Visitors Trends (${settings.trendsView.charAt(0).toUpperCase() + settings.trendsView.slice(1)})</div>
                <img src="${visitorTrendsChartImg}" class="chart-img" style="height:220px; object-fit:contain;">
            </div>
        </div>
        
        <!-- Platform Breakdown -->
        <div class="section">
            <div class="section-title green">Platform Breakdown</div>
            <div class="two-col">
                <div class="col-left">
                    <div class="chart-card" style="height:100%;">
                        <img src="${platformChartImg}" class="chart-img" style="height:180px; object-fit:contain;">
                    </div>
                </div>
                <div class="col-right">
                    <div class="platform-grid">
                        <div class="platform-card">
                            <div class="platform-label">iOS</div>
                            <div class="platform-value" style="color:#007AFF;">${iosCount}</div>
                            <div class="platform-percent">${iosPercent}</div>
                        </div>
                        <div class="platform-card">
                            <div class="platform-label">Android</div>
                            <div class="platform-value" style="color:#34C759;">${androidCount}</div>
                            <div class="platform-percent">${androidPercent}</div>
                        </div>
                        <div class="platform-card">
                            <div class="platform-label">Web</div>
                            <div class="platform-value" style="color:#FF9500;">${webCount}</div>
                            <div class="platform-percent">${webPercent}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- POI Section -->
        <div class="section">
            <div class="section-title purple">Key Metrics • Point of Interest (POI)</div>
            <div class="two-col">
                <div class="col-left">
                    <div class="metric-card purple" style="height:100%; display:flex; flex-direction:column; justify-content:center;">
                        <div class="metric-label">Total POI Selected</div>
                        <div class="metric-value purple">${totalPOI}</div>
                        <div class="metric-subtitle">Point of Interest selections</div>
                    </div>
                </div>
                <div class="col-right">
                    <div class="chart-card">
                        <div class="chart-title">Top 10 POIs Selected</div>
                        <img src="${poiChartImg}" class="chart-img" style="height:220px; object-fit:contain;">
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Quick Access Section -->
        <div class="section">
            <div class="section-title orange">Key Metrics • Quick Access</div>
            <div class="two-col">
                <div class="col-left">
                    <div class="metric-card orange" style="height:100%; display:flex; flex-direction:column; justify-content:center;">
                        <div class="metric-label">Total Quick-Access</div>
                        <div class="metric-value orange">${totalQuickAccess}</div>
                        <div class="metric-subtitle">Quick access selections</div>
                    </div>
                </div>
                <div class="col-right">
                    <div class="chart-card">
                        <div class="chart-title">Top 10 Quick-Access Categories</div>
                        <img src="${quickAccessChartImg}" class="chart-img" style="height:220px; object-fit:contain;">
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Search Section -->
        <div class="section">
            <div class="section-title teal">Key Metrics • Search</div>
            <div class="two-col">
                <div class="col-left">
                    <div class="metric-card teal" style="height:100%; display:flex; flex-direction:column; justify-content:center;">
                        <div class="metric-label">Total Searches</div>
                        <div class="metric-value teal">${totalSearches}</div>
                        <div class="metric-subtitle">Manual user searches</div>
                    </div>
                </div>
                <div class="col-right">
                    <div class="chart-card">
                        <div class="chart-title">Search Terms Word Cloud</div>
                        <img src="${wordcloudImg}" class="chart-img" style="height:220px; object-fit:contain; background:rgba(0,0,0,0.3); border-radius:8px;">
                    </div>
                </div>
            </div>
        </div>
        
        ${settings.includeAdvanced ? `
        <!-- Advanced Analytics -->
        <div class="section">
            <div class="section-title pink">Advanced Analytics • Navigation Flow</div>
            <div class="chart-card">
                <div class="chart-title">Indoor Navigation Journey</div>
                <div class="funnel-grid" style="margin-top:20px;">
                    <div class="funnel-card started">
                        <div class="funnel-label">Navigation Started</div>
                        <div class="funnel-value blue">${navStarted}</div>
                        <div class="funnel-percent">Total journeys initiated</div>
                    </div>
                    <div class="funnel-card completed">
                        <div class="funnel-label">Navigation Completed</div>
                        <div class="funnel-value green">${navCompleted}</div>
                        <div class="funnel-percent">${navCompletedPercent}</div>
                    </div>
                    <div class="funnel-card canceled">
                        <div class="funnel-label">Navigation Canceled</div>
                        <div class="funnel-value red">${navCanceled}</div>
                        <div class="funnel-percent">${navCanceledPercent}</div>
                    </div>
                </div>
                <div class="note">
                    <strong>Note:</strong> Many users cancel navigation once the destination is closer.
                </div>
            </div>
        </div>
        ` : ''}
        
        <div class="footer">
            <div class="footer-text">
                Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}<br>
                Cisco Spaces Indoor Navigation SDK Analytics
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
                <svg width="24" height="24" viewBox="0 0 100 100"><defs><linearGradient id="lg2" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:#00c6ff"/><stop offset="100%" style="stop-color:#0072ff"/></linearGradient></defs><circle cx="35" cy="50" r="30" fill="url(#lg2)"/><circle cx="65" cy="50" r="30" fill="#22c55e" opacity="0.9"/></svg>
                <span style="font-size:12px;color:rgba(255,255,255,0.5);">Cisco Spaces</span>
            </div>
        </div>
    </div>
</body>
</html>`;
            
            // Download as HTML file
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const link = document.createElement('a');
            link.download = `Indoor_Navigation_Report_${settings.customerName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.html`;
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);
            
            showLoading(false);
        }
        
        // Fetch and display reports count
        function fetchReportsCount() {
            fetch('/api/analytics/audit')
                .then(res => res.json())
                .then(data => {
                    const reportsCount = (data.events || []).filter(e => 
                        e.event_type && e.event_type.includes('report_generated')
                    ).length;
                    document.getElementById('reportsCountValue').textContent = reportsCount.toLocaleString();
                })
                .catch(e => {
                    document.getElementById('reportsCountValue').textContent = '0';
                });
        }

        function scheduleReportsCount() {
            const run = () => fetchReportsCount();
            if ('requestIdleCallback' in window) {
                requestIdleCallback(run, { timeout: 2000 });
            } else {
                setTimeout(run, 100);
            }
        }

        // Initialize on page load
        document.addEventListener('DOMContentLoaded', function() {
            scheduleReportsCount();
            
            // Check if user is logged in
            const alreadyLoggedIn = checkLoginStatus();
            
            // Only track page view if already logged in (new logins track it in handleLogin)
            if (alreadyLoggedIn) {
                trackEvent('page_view', {});
            }
            
            const { tenantId, duration } = parseUrlParams();
            
            document.getElementById('tenantInput').value = tenantId;
            document.getElementById('durationSelect').value = duration;
            
        });
        
        // Allow Enter key to get data
        document.getElementById('tenantInput').addEventListener('keypress', function(e) {
            if (e.key === 'Enter') getData();
        });
