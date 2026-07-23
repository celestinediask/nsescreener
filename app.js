/**
 * Ultra-Minimal Real-Time NSE Screener Client Engine
 * Direct data from nseindia.com/market-data/top-gainers-losers
 */

document.addEventListener('DOMContentLoaded', () => {
    let apiData = null;

    const elements = {
        istClock: document.getElementById('ist-clock'),
        btnRefresh: document.getElementById('btn-refresh'),
        indexPrice: document.getElementById('index-price'),
        indexChange: document.getElementById('index-change'),
        indexHigh: document.getElementById('index-high'),
        indexLow: document.getElementById('index-low'),
        
        // NIFTY 50
        tbodyN50G: document.getElementById('tbody-nifty50-g'),
        tbodyN50L: document.getElementById('tbody-nifty50-l'),
        
        // NIFTY 100
        tbodyN100G: document.getElementById('tbody-nifty100-g'),
        tbodyN100L: document.getElementById('tbody-nifty100-l'),
        
        // NIFTY 500
        tbodyN500G: document.getElementById('tbody-nifty500-g'),
        tbodyN500L: document.getElementById('tbody-nifty500-l'),
        
        // F&O Securities
        tbodyFoG: document.getElementById('tbody-fo-g'),
        tbodyFoL: document.getElementById('tbody-fo-l'),
        
        tbodyAll: document.getElementById('tbody-all'),
        searchInput: document.getElementById('search-input')
    };

    // Live Indian Standard Time (IST) Clock Generator (Exact YYYY-MM-DD HH:MM:SS Format)
    function updateISTClock() {
        if (!elements.istClock) return;
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset);
        
        const year = istDate.getFullYear();
        const month = String(istDate.getMonth() + 1).padStart(2, '0');
        const day = String(istDate.getDate()).padStart(2, '0');
        const hours = String(istDate.getHours()).padStart(2, '0');
        const minutes = String(istDate.getMinutes()).padStart(2, '0');
        const seconds = String(istDate.getSeconds()).padStart(2, '0');

        elements.istClock.textContent = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    async function loadData() {
        try {
            const res = await fetch('/api/nifty50');
            if (!res.ok) throw new Error('API request failed');
            apiData = await res.json();

            renderIndex(apiData.index);
            
            // Render ALL 4 categories simultaneously side-by-side (All Top 10 Gainers & Losers)
            renderMinimalTableRows(apiData.topGainers, elements.tbodyN50G, true);
            renderMinimalTableRows(apiData.topLosers, elements.tbodyN50L, false);

            renderMinimalTableRows(apiData.nifty100Gainers, elements.tbodyN100G, true);
            renderMinimalTableRows(apiData.nifty100Losers, elements.tbodyN100L, false);

            renderMinimalTableRows(apiData.nifty500Gainers, elements.tbodyN500G, true);
            renderMinimalTableRows(apiData.nifty500Losers, elements.tbodyN500L, false);

            renderMinimalTableRows(apiData.foGainers, elements.tbodyFoG, true);
            renderMinimalTableRows(apiData.foLosers, elements.tbodyFoL, false);

            renderAllTable();
        } catch (err) {
            console.error('Error fetching live NSE data:', err);
        }
    }

    function renderIndex(idx) {
        if (!idx) return;
        if (elements.indexPrice) elements.indexPrice.textContent = `${formatNum(idx.price)}`;
        
        const isPos = idx.change >= 0;
        const sign = isPos ? '+' : '';
        if (elements.indexChange) {
            elements.indexChange.textContent = `${sign}${formatNum(idx.change)} (${sign}${Number(idx.pChange).toFixed(2)}%)`;
            elements.indexChange.className = `idx-chg ${isPos ? 'green' : 'red'}`;
        }

        if (elements.indexHigh) elements.indexHigh.textContent = `${formatNum(idx.high)}`;
        if (elements.indexLow) elements.indexLow.textContent = `${formatNum(idx.low)}`;
    }

    function renderMinimalTableRows(stocks, tbody, isGainer) {
        if (!tbody) return;
        if (!stocks || !stocks.length) {
            tbody.innerHTML = `<tr><td colspan="3" class="text-center" style="color: var(--text-sub);">No Data</td></tr>`;
            return;
        }

        const colorClass = isGainer ? 'green' : 'red';
        const sign = isGainer ? '+' : '';

        // Display ALL Top 10 items per category table
        tbody.innerHTML = stocks.slice(0, 10).map((s, i) => {
            const formattedVal = Number(s.pChange).toFixed(2);
            return `
                <tr>
                    <td class="col-top-rank">#${i + 1}</td>
                    <td class="col-top-symbol">
                        <strong style="color: var(--text-main); font-size: 11px;">${s.symbol}</strong>
                    </td>
                    <td class="col-top-pchange">
                        <span class="val-plain ${colorClass}">${sign}${formattedVal}</span>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function renderAllTable() {
        if (!elements.tbodyAll || !apiData) return;

        const query = (elements.searchInput ? elements.searchInput.value : '').toLowerCase().trim();
        let filtered = apiData.allStocks || [];

        if (query) {
            filtered = filtered.filter(s => s.symbol.toLowerCase().includes(query) || s.name.toLowerCase().includes(query));
        }

        elements.tbodyAll.innerHTML = filtered.map((s, i) => {
            const isPos = s.pChange >= 0;
            const colorClass = isPos ? 'green' : 'red';
            const sign = isPos ? '+' : '';
            const formattedPChg = Number(s.pChange).toFixed(2);

            return `
                <tr>
                    <td class="col-all-rank">#${i + 1}</td>
                    <td class="col-all-symbol"><strong style="color: var(--text-main); font-size: 12px;">${s.symbol}</strong></td>
                    <td class="col-all-name" style="color: var(--text-sub); font-size: 11px;">${s.name}</td>
                    <td class="col-all-ltp text-mono" style="font-weight: 700;">${formatNum(s.price)}</td>
                    <td class="col-all-change text-mono ${colorClass}">${sign}${formatNum(s.change)}</td>
                    <td class="col-all-pchange">
                        <span class="val-plain ${colorClass}">${sign}${formattedPChg}</span>
                    </td>
                    <td class="col-all-high text-mono green">${formatNum(s.high)}</td>
                    <td class="col-all-low text-mono red">${formatNum(s.low)}</td>
                    <td class="col-all-vol text-mono" style="color: var(--text-sub);">${formatVolUnified(s.volume)}</td>
                </tr>
            `;
        }).join('');
    }

    function formatNum(val) {
        if (val === undefined || val === null) return '0.00';
        return Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatVolUnified(vol) {
        if (!vol) return '0';
        return Number(vol).toLocaleString('en-IN');
    }

    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', renderAllTable);
    }

    if (elements.btnRefresh) {
        elements.btnRefresh.addEventListener('click', loadData);
    }

    // Start Live Clock & Data Sync
    updateISTClock();
    setInterval(updateISTClock, 1000);

    loadData();
    setInterval(loadData, 5000);
});
