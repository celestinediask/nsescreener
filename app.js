/**
 * Ultra-Minimal Real-Time NSE Screener Client Engine
 * Direct data from nseindia.com/market-data/top-gainers-losers & pre-open-market
 */

document.addEventListener('DOMContentLoaded', () => {
    let apiData = null;

    const elements = {
        istClock: document.getElementById('ist-clock'),
        btnRefresh: document.getElementById('btn-refresh'),
        btnRetryConn: document.getElementById('btn-retry-conn'),
        connStatus: document.getElementById('conn-status'),
        connText: document.getElementById('conn-text'),

        networkErrorCard: document.getElementById('network-error-card'),
        netErrMsg: document.getElementById('net-err-msg'),

        preopenSection: document.getElementById('preopen-section'),
        liveSection: document.getElementById('live-section'),
        allStocksSection: document.getElementById('all-stocks-section'),

        indexPrice: document.getElementById('index-price'),
        indexChange: document.getElementById('index-change'),
        indexHigh: document.getElementById('index-high'),
        indexLow: document.getElementById('index-low'),
        
        // --- Pre-Open Market (6 Official NSE Categories) ---
        tbodyPoN50G: document.getElementById('tbody-po-nifty50-g'),
        tbodyPoN50L: document.getElementById('tbody-po-nifty50-l'),
        tbodyPoBankG: document.getElementById('tbody-po-bank-g'),
        tbodyPoBankL: document.getElementById('tbody-po-bank-l'),
        tbodyPoEmergeG: document.getElementById('tbody-po-emerge-g'),
        tbodyPoEmergeL: document.getElementById('tbody-po-emerge-l'),
        tbodyPoFoG: document.getElementById('tbody-po-fo-g'),
        tbodyPoFoL: document.getElementById('tbody-po-fo-l'),
        tbodyPoOthersG: document.getElementById('tbody-po-others-g'),
        tbodyPoOthersL: document.getElementById('tbody-po-others-l'),
        tbodyPoAllG: document.getElementById('tbody-po-all-g'),
        tbodyPoAllL: document.getElementById('tbody-po-all-l'),

        // --- Live Market ---
        tbodyN50G: document.getElementById('tbody-nifty50-g'),
        tbodyN50L: document.getElementById('tbody-nifty50-l'),
        tbodyN100G: document.getElementById('tbody-nifty100-g'),
        tbodyN100L: document.getElementById('tbody-nifty100-l'),
        tbodyN500G: document.getElementById('tbody-nifty500-g'),
        tbodyN500L: document.getElementById('tbody-nifty500-l'),
        tbodyFoG: document.getElementById('tbody-fo-g'),
        tbodyFoL: document.getElementById('tbody-fo-l'),
        
        tbodyAll: document.getElementById('tbody-all'),
        searchInput: document.getElementById('search-input'),
        poMarketStatus: document.getElementById('po-market-status'),
        liveMarketStatus: document.getElementById('live-market-status')
    };

    // Live Indian Standard Time (IST) Clock Generator & Market Hours Status
    function updateISTClockAndStatus() {
        const now = new Date();
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset);
        
        const year = istDate.getFullYear();
        const month = String(istDate.getMonth() + 1).padStart(2, '0');
        const day = String(istDate.getDate()).padStart(2, '0');
        const hours = String(istDate.getHours()).padStart(2, '0');
        const minutes = String(istDate.getMinutes()).padStart(2, '0');
        const seconds = String(istDate.getSeconds()).padStart(2, '0');

        if (elements.istClock) {
            elements.istClock.textContent = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        }

        // Market Hours Status Logic (IST)
        const dayOfWeek = istDate.getDay(); // 0 = Sun, 6 = Sat
        const isWeekday = (dayOfWeek >= 1 && dayOfWeek <= 5);
        const totalMinutes = istDate.getHours() * 60 + istDate.getMinutes();

        // NSE Pre-Open Session: 09:00 AM (540m) to 09:15 AM (555m) IST Mon-Fri
        const isPreOpenActive = isWeekday && (totalMinutes >= 540 && totalMinutes < 555);

        // NSE Live Market Session: 09:15 AM (555m) to 03:30 PM / 15:30 (930m) IST Mon-Fri
        const isLiveMarketActive = isWeekday && (totalMinutes >= 555 && totalMinutes < 930);

        if (elements.poMarketStatus) {
            if (isPreOpenActive) {
                elements.poMarketStatus.className = 'market-status-badge open';
                elements.poMarketStatus.textContent = '🟢 OPEN';
            } else {
                elements.poMarketStatus.className = 'market-status-badge closed';
                elements.poMarketStatus.textContent = '🔴 CLOSED';
            }
        }

        if (elements.liveMarketStatus) {
            if (isLiveMarketActive) {
                elements.liveMarketStatus.className = 'market-status-badge open';
                elements.liveMarketStatus.textContent = '🟢 OPEN';
            } else {
                elements.liveMarketStatus.className = 'market-status-badge closed';
                elements.liveMarketStatus.textContent = '🔴 CLOSED';
            }
        }
    }

    function updateConnectionStatus(isOnline) {
        if (!elements.connStatus) return;
        if (isOnline && navigator.onLine) {
            elements.connStatus.className = 'status-dot online';
            elements.connStatus.title = 'Status: Online (Sync OK)';
        } else {
            elements.connStatus.className = 'status-dot offline';
            elements.connStatus.title = 'Status: Disconnected';
        }
    }

    // Hide data tables instantly on network error / disconnection
    function setNetworkErrorMode(isError, message = '') {
        if (isError) {
            updateConnectionStatus(false);
            
            if (elements.networkErrorCard) {
                elements.networkErrorCard.classList.remove('hidden');
            }
            if (elements.netErrMsg && message) {
                elements.netErrMsg.textContent = message;
            }

            // Hide data sections so stale data is NEVER displayed when offline
            if (elements.preopenSection) elements.preopenSection.style.display = 'none';
            if (elements.liveSection) elements.liveSection.style.display = 'none';
            if (elements.allStocksSection) elements.allStocksSection.style.display = 'none';

            // Reset top bar index values
            if (elements.indexPrice) elements.indexPrice.textContent = '--';
            if (elements.indexChange) elements.indexChange.textContent = '--';
            if (elements.indexHigh) elements.indexHigh.textContent = '--';
            if (elements.indexLow) elements.indexLow.textContent = '--';
        } else {
            updateConnectionStatus(true);

            if (elements.networkErrorCard) {
                elements.networkErrorCard.classList.add('hidden');
            }

            // Restore data sections
            if (elements.preopenSection) elements.preopenSection.style.display = 'flex';
            if (elements.liveSection) elements.liveSection.style.display = 'flex';
            if (elements.allStocksSection) elements.allStocksSection.style.display = 'block';
        }
    }

    async function loadData(force = false) {
        if (!navigator.onLine) {
            setNetworkErrorMode(true, 'Your internet connection is offline. Please reconnect to view live market data.');
            return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000); // 3.0s timeout

        try {
            const endpoint = force ? `/api/nifty50?t=${Date.now()}` : '/api/nifty50';
            const res = await fetch(endpoint, {
                signal: controller.signal,
                cache: 'no-store'
            });
            clearTimeout(timeoutId);

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            apiData = await res.json();

            if (apiData.error || apiData.connected === false) {
                throw new Error(apiData.error || 'NSE Server Unreachable');
            }

            // Instant Restore Data View on Success
            setNetworkErrorMode(false);

            renderIndex(apiData.index);
            
            // Render PRE-OPEN MARKET tables (6 Official NSE Categories)
            renderMinimalTableRows(apiData.preOpenNifty50Gainers, elements.tbodyPoN50G, true);
            renderMinimalTableRows(apiData.preOpenNifty50Losers, elements.tbodyPoN50L, false);

            renderMinimalTableRows(apiData.preOpenBankNiftyGainers, elements.tbodyPoBankG, true);
            renderMinimalTableRows(apiData.preOpenBankNiftyLosers, elements.tbodyPoBankL, false);

            renderMinimalTableRows(apiData.preOpenEmergeGainers, elements.tbodyPoEmergeG, true);
            renderMinimalTableRows(apiData.preOpenEmergeLosers, elements.tbodyPoEmergeL, false);

            renderMinimalTableRows(apiData.preOpenFOGainers, elements.tbodyPoFoG, true);
            renderMinimalTableRows(apiData.preOpenFOLosers, elements.tbodyPoFoL, false);

            renderMinimalTableRows(apiData.preOpenOthersGainers, elements.tbodyPoOthersG, true);
            renderMinimalTableRows(apiData.preOpenOthersLosers, elements.tbodyPoOthersL, false);

            renderMinimalTableRows(apiData.preOpenAllGainers, elements.tbodyPoAllG, true);
            renderMinimalTableRows(apiData.preOpenAllLosers, elements.tbodyPoAllL, false);

            // Render LIVE MARKET tables
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
            clearTimeout(timeoutId);
            console.warn('Network / API Connection Disconnected:', err.message);
            // Instant Error Mode Trigger
            setNetworkErrorMode(true, `Unable to connect to NSE India server (${err.message}). Live market data unavailable.`);
        }
    }

    function renderIndex(idx) {
        if (!idx) return;
        if (elements.indexPrice) elements.indexPrice.textContent = `${formatNum(idx.price)}`;
        
        if (elements.indexChange) {
            const changeStr = formatSignedAmount(idx.change);
            const pChangeStr = formatSignedPercent(idx.pChange);
            const colorClass = getColorClass(idx.change);
            elements.indexChange.textContent = `${changeStr} (${pChangeStr})`;
            elements.indexChange.className = `idx-chg ${colorClass}`;
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

        tbody.innerHTML = stocks.slice(0, 10).map((s, i) => {
            const val = Number(s.pChange) || 0;
            const colorClass = getColorClass(val);
            const formattedVal = formatSignedPercentValue(val);

            return `
                <tr>
                    <td class="col-top-rank">#${i + 1}</td>
                    <td class="col-top-symbol">
                        <strong style="color: var(--text-main); font-size: 11px;">${s.symbol}</strong>
                    </td>
                    <td class="col-top-pchange">
                        <span class="val-plain ${colorClass}">${formattedVal}</span>
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
            filtered = filtered.filter(s => {
                const compName = getCompanyName(s.symbol).toLowerCase();
                return s.symbol.toLowerCase().includes(query) || (s.name && s.name.toLowerCase().includes(query)) || compName.includes(query);
            });
        }

        elements.tbodyAll.innerHTML = filtered.map((s, i) => {
            const colorClass = getColorClass(s.pChange);
            const formattedChange = formatSignedAmount(s.change);
            const formattedPChg = formatSignedPercentValue(s.pChange);
            const companyFullName = getCompanyName(s.symbol);

            return `
                <tr>
                    <td class="col-all-rank">#${i + 1}</td>
                    <td class="col-all-symbol"><strong style="color: var(--text-main); font-size: 12px;">${s.symbol}</strong></td>
                    <td class="col-all-name" style="color: var(--text-sub); font-size: 11px; font-weight: 500;">${companyFullName}</td>
                    <td class="col-all-ltp text-mono" style="font-weight: 700;">${formatNum(s.price)}</td>
                    <td class="col-all-change text-mono ${colorClass}">${formattedChange}</td>
                    <td class="col-all-pchange">
                        <span class="val-plain ${colorClass}">${formattedPChg}</span>
                    </td>
                    <td class="col-all-high text-mono">${formatNum(s.high)}</td>
                    <td class="col-all-low text-mono">${formatNum(s.low)}</td>
                    <td class="col-all-vol text-mono" style="color: var(--text-sub);">${formatVolUnified(s.volume)}</td>
                </tr>
            `;
        }).join('');
    }

    const COMPANY_NAMES = {
        'RELIANCE': 'Reliance Industries Ltd',
        'TCS': 'Tata Consultancy Services Ltd',
        'HDFCBANK': 'HDFC Bank Ltd',
        'ICICIBANK': 'ICICI Bank Ltd',
        'INFY': 'Infosys Ltd',
        'BHARTIARTL': 'Bharti Airtel Ltd',
        'SBIN': 'State Bank of India',
        'ITC': 'ITC Ltd',
        'L&T': 'Larsen & Toubro Ltd',
        'LT': 'Larsen & Toubro Ltd',
        'HCLTECH': 'HCL Technologies Ltd',
        'KOTAKBANK': 'Kotak Mahindra Bank Ltd',
        'AXISBANK': 'Axis Bank Ltd',
        'MARUTI': 'Maruti Suzuki India Ltd',
        'SUNPHARMA': 'Sun Pharmaceutical Industries Ltd',
        'ASIANPAINT': 'Asian Paints Ltd',
        'TITAN': 'Titan Company Ltd',
        'BAJFINANCE': 'Bajaj Finance Ltd',
        'TATASTEEL': 'Tata Steel Ltd',
        'NTPC': 'NTPC Ltd',
        'ULTRACEMCO': 'UltraTech Cement Ltd',
        'POWERGRID': 'Power Grid Corporation of India Ltd',
        'NESTLEIND': 'Nestle India Ltd',
        'TATAMOTORS': 'Tata Motors Ltd',
        'M&M': 'Mahindra & Mahindra Ltd',
        'ONGC': 'Oil & Natural Gas Corporation Ltd',
        'JSWSTEEL': 'JSW Steel Ltd',
        'ADANIENT': 'Adani Enterprises Ltd',
        'ADANIPORTS': 'Adani Ports & Special Economic Zone Ltd',
        'COALINDIA': 'Coal India Ltd',
        'GRASIM': 'Grasim Industries Ltd',
        'BAJAJFINSV': 'Bajaj Finserv Ltd',
        'HINDALCO': 'Hindalco Industries Ltd',
        'TECHM': 'Tech Mahindra Ltd',
        'CIPLA': 'Cipla Ltd',
        'SBILIFE': 'SBI Life Insurance Company Ltd',
        'HDFCLIFE': 'HDFC Life Insurance Company Ltd',
        'BPCL': 'Bharat Petroleum Corporation Ltd',
        'DRREDDY': "Dr. Reddy's Laboratories Ltd",
        'EICHERMOT': 'Eicher Motors Ltd',
        'BRITANNIA': 'Britannia Industries Ltd',
        'TATACONSUM': 'Tata Consumer Products Ltd',
        'HEROMOTOCO': 'Hero MotoCorp Ltd',
        'APOLLOHOSP': 'Apollo Hospitals Enterprise Ltd',
        'DIVISLAB': "Divi's Laboratories Ltd",
        'WIPRO': 'Wipro Ltd',
        'BAJAJ-AUTO': 'Bajaj Auto Ltd',
        'BEL': 'Bharat Electronics Ltd',
        'SHRIRAMFIN': 'Shriram Finance Ltd',
        'TRENT': 'Trent Ltd',
        'ZOMATO': 'Zomato Ltd',
        'JIOFIN': 'Jio Financial Services Ltd',
        'HAL': 'Hindustan Aeronautics Ltd',
        'VBL': 'Varun Beverages Ltd',
        'DLF': 'DLF Ltd',
        'SIEMENS': 'Siemens Ltd',
        'ABB': 'ABB India Ltd',
        'IOC': 'Indian Oil Corporation Ltd',
        'GAIL': 'GAIL (India) Ltd',
        'REC': 'REC Ltd',
        'PFC': 'Power Finance Corporation Ltd',
        'IRFC': 'Indian Railway Finance Corporation Ltd',
        'PIDILITIND': 'Pidilite Industries Ltd',
        'INDIAGO': 'InterGlobe Aviation Ltd (IndiGo)',
        'MOTHERSON': 'Samvardhana Motherson International Ltd',
        'POLYCAB': 'Polycab India Ltd',
        'LTIM': 'LTIMindtree Ltd',
        'CHOLAFIN': 'Cholamandalam Investment & Finance Co Ltd',
        'BANKBARODA': 'Bank of Baroda',
        'CANBK': 'Canara Bank',
        'PNB': 'Punjab National Bank',
        'UNIONBANK': 'Union Bank of India',
        'IOB': 'Indian Overseas Bank',
        'IDFCFIRSTB': 'IDFC FIRST Bank Ltd',
        'FEDERALBNK': 'The Federal Bank Ltd',
        'INDUSINDBK': 'IndusInd Bank Ltd',
        'BANDHANBNK': 'Bandhan Bank Ltd',
        'AUBANK': 'AU Small Finance Bank Ltd',
        'YESBANK': 'Yes Bank Ltd',
        'PAYTM': 'One97 Communications Ltd (Paytm)',
        'POLICYBZR': 'PB Fintech Ltd (Policybazaar)',
        'NYKAA': 'FSN E-Commerce Ventures Ltd (Nykaa)',
        'TATAELXSI': 'Tata Elxsi Ltd',
        'TATAPOWER': 'Tata Power Company Ltd',
        'TATATCOMM': 'Tata Communications Ltd',
        'BERGEPAINT': 'Berger Paints India Ltd',
        'TORNTPHARM': 'Torrent Pharmaceuticals Ltd',
        'LUPIN': 'Lupin Ltd',
        'AUROPHARMA': 'Aurobindo Pharma Ltd',
        'ALKEM': 'Alkem Laboratories Ltd',
        'GLENMARK': 'Glenmark Pharmaceuticals Ltd',
        'ZYDUSLIFE': 'Zydus Lifesciences Ltd',
        'BIOCON': 'Biocon Ltd',
        'AMBUJACEM': 'Ambuja Cements Ltd',
        'ACC': 'ACC Ltd',
        'SHREECEM': 'Shree Cement Ltd',
        'DALBHARAT': 'Dalmia Bharat Ltd',
        'VOLTAS': 'Voltas Ltd',
        'HAVELLES': 'Havells India Ltd',
        'HAVELLS': 'Havells India Ltd',
        'CROMPTON': 'Crompton Greaves Consumer Electricals Ltd',
        'DIXON': 'Dixon Technologies (India) Ltd',
        'WHIRLPOOL': 'Whirlpool of India Ltd',
        'TATACHEM': 'Tata Chemicals Ltd',
        'UPL': 'UPL Ltd',
        'PIIND': 'PI Industries Ltd',
        'SRF': 'SRF Ltd',
        'DEEPAKNTR': 'Deepak Nitrite Ltd',
        'AARTIIND': 'Aarti Industries Ltd',
        'ATGL': 'Adani Total Gas Ltd',
        'AWL': 'Adani Wilmar Ltd',
        'ADANIPOWER': 'Adani Power Ltd',
        'ADANIGREEN': 'Adani Green Energy Ltd',
        'ADANITRANS': 'Adani Energy Solutions Ltd',
        'JSWENERGY': 'JSW Energy Ltd',
        'NHPC': 'NHPC Ltd',
        'SJVN': 'SJVN Ltd',
        'SUZLON': 'Suzlon Energy Ltd',
        'IREDA': 'Indian Renewable Energy Development Agency Ltd',
        'CONCOR': 'Container Corporation of India Ltd',
        'BHEL': 'Bharat Heavy Electricals Ltd',
        'COCHINSHIP': 'Cochin Shipyard Ltd',
        'MAZDOCK': 'Mazagon Dock Shipbuilders Ltd',
        'GRSE': 'Garden Reach Shipbuilders & Engineers Ltd',
        'RVNL': 'Rail Vikas Nigam Ltd',
        'IRCON': 'Ircon International Ltd',
        'RITES': 'RITES Ltd',
        'NMDC': 'NMDC Ltd',
        'NATIONALUM': 'National Aluminium Company Ltd (NALCO)',
        'HINDZINC': 'Hindustan Zinc Ltd',
        'SAIL': 'Steel Authority of India Ltd',
        'JINDALSTEL': 'Jindal Steel & Power Ltd',
        'APLAPOLLO': 'APL Apollo Tubes Ltd',
        'ESCORTS': 'Escorts Kubota Ltd',
        'ASHOKLEY': 'Ashok Leyland Ltd',
        'BALKRISIND': 'Balkrishna Industries Ltd',
        'MRF': 'MRF Ltd',
        'APOLLOTYRE': 'Apollo Tyres Ltd',
        'JKTYRE': 'JK Tyre & Industries Ltd',
        'CEATLTD': 'CEAT Ltd',
        'BOSCHLTD': 'Bosch Ltd',
        'BHARATFORG': 'Bharat Forge Ltd',
        'TIINDIA': 'Tube Investments of India Ltd',
        'SONACOMS': 'Sona BLW Precision Forgings Ltd',
        'CUMMINSIND': 'Cummins India Ltd',
        'ASTRAL': 'Astral Ltd',
        'SUPREMEIND': 'Supreme Industries Ltd',
        'PAGEIND': 'Page Industries Ltd',
        'COLPAL': 'Colgate-Palmolive (India) Ltd',
        'DABUR': 'Dabur India Ltd',
        'MARICO': 'Marico Ltd',
        'GODREJCP': 'Godrej Consumer Products Ltd',
        'UNOMINDA': 'Uno Minda Ltd',
        'PERSISTENT': 'Persistent Systems Ltd',
        'COFORGE': 'Coforge Ltd',
        'MPHASIS': 'Mphasis Ltd',
        'KPITTECH': 'KPIT Technologies Ltd',
        'LTTS': 'L&T Technology Services Ltd',
        'OFSS': 'Oracle Financial Services Software Ltd',
        'LICHSGFIN': 'LIC Housing Finance Ltd',
        'MUTHOOTFIN': 'Muthoot Finance Ltd',
        'MANAPPURAM': 'Manappuram Finance Ltd',
        'M&MFIN': 'Mahindra & Mahindra Financial Services Ltd',
        'MAXHEALTH': 'Max Healthcare Institute Ltd',
        'FORTIS': 'Fortis Healthcare Ltd',
        'LALPATHLAB': 'Dr. Lal PathLabs Ltd',
        'METROPOLIS': 'Metropolis Healthcare Ltd',
        'SYNGENE': 'Syngene International Ltd',
        'IPCALAB': 'Ipca Laboratories Ltd',
        'AJANTPHARM': 'Ajanta Pharma Ltd',
        'IDEA': 'Vodafone Idea Ltd',
        'INDUSTOWER': 'Indus Towers Ltd',
        'OBEROIRLTY': 'Oberoi Realty Ltd',
        'GODREJPROP': 'Godrej Properties Ltd',
        'PHOENIXLTD': 'The Phoenix Mills Ltd',
        'PRESTIGE': 'Prestige Estates Projects Ltd',
        'MACROTECH': 'Macrotech Developers Ltd (Lodha)',
        'DELHIVERY': 'Delhivery Ltd',
        'PEL': 'Piramal Enterprises Ltd',
        'ABCAPITAL': 'Aditya Birla Capital Ltd',
        'MFSL': 'Max Financial Services Ltd',
        'SBICARD': 'SBI Cards and Payment Services Ltd',
        'ICICIPRULI': 'ICICI Prudential Life Insurance Co Ltd',
        'ICICIGI': 'ICICI Lombard General Insurance Co Ltd',
        'STARHEALTH': 'Star Health & Allied Insurance Co Ltd',
        'MCX': 'Multi Commodity Exchange of India Ltd',
        'BSE': 'BSE Ltd',
        'CAMS': 'Computer Age Management Services Ltd',
        'CDSL': 'Central Depository Services (India) Ltd',
        'ANGELONE': 'Angel One Ltd',
        'ISEC': 'ICICI Securities Ltd',
        'MOTILALOFS': 'Motilal Oswal Financial Services Ltd',
        'IIFL': 'IIFL Finance Ltd',
        'GUJGASLTD': 'Gujarat Gas Ltd',
        'IGL': 'Indraprastha Gas Ltd',
        'MAHGL': 'Mahanagar Gas Ltd',
        'PETRONET': 'Petronet LNG Ltd',
        'OIL': 'Oil India Ltd',
        'HINDPETRO': 'Hindustan Petroleum Corporation Ltd'
    };

    function getCompanyName(symbol) {
        if (!symbol) return '';
        const cleanSym = symbol.trim().toUpperCase();
        if (COMPANY_NAMES[cleanSym]) {
            return COMPANY_NAMES[cleanSym];
        }
        const baseSym = cleanSym.split('-')[0];
        if (COMPANY_NAMES[baseSym]) {
            return COMPANY_NAMES[baseSym];
        }
        // Proper title-cased fallback
        return baseSym.toLowerCase().replace(/(?:^|\s|-)\S/g, x => x.toUpperCase()) + ' Ltd';
    }

    function getColorClass(val) {
        const num = Number(val) || 0;
        if (num > 0) return 'green';
        if (num < 0) return 'red';
        return 'neutral';
    }

    function formatNum(val) {
        if (val === undefined || val === null) return '0.00';
        return Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatSignedPercentValue(val) {
        const num = Number(val) || 0;
        const absStr = Math.abs(num).toFixed(2);
        if (num > 0) return `+${absStr}`;
        if (num < 0) return `-${absStr}`;
        return `0.00`;
    }

    function formatSignedPercent(val) {
        const num = Number(val) || 0;
        const absStr = Math.abs(num).toFixed(2);
        if (num > 0) return `+${absStr}%`;
        if (num < 0) return `-${absStr}%`;
        return `0.00%`;
    }

    function formatSignedAmount(val) {
        const num = Number(val) || 0;
        const absStr = formatNum(Math.abs(num));
        if (num > 0) return `+${absStr}`;
        if (num < 0) return `-${absStr}`;
        return `0.00`;
    }

    function formatVolUnified(vol) {
        if (!vol) return '0';
        return Number(vol).toLocaleString('en-IN');
    }

    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', renderAllTable);
    }

    if (elements.btnRefresh) {
        elements.btnRefresh.addEventListener('click', async () => {
            if (elements.btnRefresh.classList.contains('spinning')) return;
            elements.btnRefresh.classList.add('spinning');
            
            const tables = document.querySelectorAll('.data-table, .all-table');
            tables.forEach(t => t.classList.add('table-flash'));

            await loadData(true);

            setTimeout(() => {
                elements.btnRefresh.classList.remove('spinning');
                tables.forEach(t => t.classList.remove('table-flash'));
            }, 600);
        });
    }

    if (elements.btnRetryConn) {
        elements.btnRetryConn.addEventListener('click', loadData);
    }

    // Native browser online/offline events for instant response (<10ms)
    window.addEventListener('online', () => {
        setNetworkErrorMode(false);
        loadData();
    });
    
    window.addEventListener('offline', () => {
        setNetworkErrorMode(true, 'Your internet connection is offline. Please reconnect to view live market data.');
    });

    // Start Live Clock & Market Hours Status Sync
    updateISTClockAndStatus();
    setInterval(updateISTClockAndStatus, 1000);

    loadData();
    setInterval(loadData, 2000);
});
