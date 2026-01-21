const API = '/api';
let page = 1, limit = 15, search = '';
let currentBook = 'bukhari'; // Default book

// Filter state
let filterBook = '';
let filterStatus = '';
let filterKitab = '';

// Elements
const $ = id => document.getElementById(id);
const table = $('hadithTable');
const searchInput = $('searchInput');
const prevBtn = $('prevBtn');
const nextBtn = $('nextBtn');
const pageInfo = $('pageInfo');
const modal = $('editModal');
const themeBtn = $('themeToggle');

let editingId = null;

// Init
document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadHadiths();
    initTheme();
    initNavigation();
    initModal();
    initSearch();
    initPagination();
    initCollections();
    initFilters();
});

// Collection cards click
function initCollections() {
    const books = {
        'card-bukhari': { key: 'bukhari', name: 'Sahih al-Bukhari' },
        'card-muslim': { key: 'muslim', name: 'Sahih Muslim' },
        'card-nasai': { key: 'nasai', name: 'Sunan an-Nasai' },
        'card-abudawud': { key: 'abudawud', name: 'Sunan Abi Dawud' },
        'card-tirmidhi': { key: 'tirmidhi', name: 'Jami at-Tirmidhi' },
        'card-ibnmajah': { key: 'ibnmajah', name: 'Sunan Ibn Majah' },
        'card-malik': { key: 'malik', name: 'Muwatta Malik' }
    };

    for (const [cardId, config] of Object.entries(books)) {
        const card = $(cardId);
        if (card) {
            card.onclick = () => {
                currentBook = config.key;
                switchToBookView(config.name);
            };
        }
    }
}

function switchToBookView(bookName) {
    // Navigate to browse view
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    $('view-browse').classList.remove('hidden');

    // Update nav active state
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelector('.nav-link[data-view="browse"]')?.classList.add('active');

    // Update header
    const header = $('view-browse').querySelector('h1');
    if (header) header.textContent = bookName;

    // Reset pagination and reload
    page = 1;
    loadHadiths();
    loadStats();
}

// Theme
function initTheme() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);

    themeBtn.onclick = () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        updateThemeIcon(next);
    };
}

function updateThemeIcon(theme) {
    themeBtn.innerHTML = theme === 'light'
        ? '<i class="fas fa-moon"></i> Dark Mode'
        : '<i class="fas fa-sun"></i> Light Mode';
}

// Navigation
function initNavigation() {
    document.querySelectorAll('.nav-link[data-view]').forEach(link => {
        link.onclick = (e) => {
            e.preventDefault();
            const view = link.dataset.view;

            document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
            $(`view-${view}`).classList.remove('hidden');

            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        };
    });
}

// Stats
async function loadStats() {
    try {
        // Load all book stats
        const books = [
            ['bukhari', 'bukhariProgress', 'bukhariStats', 'bukhariPercent'],
            ['muslim', 'muslimProgress', 'muslimStats', 'muslimPercent'],
            ['nasai', 'nasaiProgress', 'nasaiStats', 'nasaiPercent'],
            ['abudawud', 'abudawudProgress', 'abudawudStats', 'abudawudPercent'],
            ['tirmidhi', 'tirmidhiProgress', 'tirmidhiStats', 'tirmidhiPercent'],
            ['ibnmajah', 'ibnmajahProgress', 'ibnmajahStats', 'ibnmajahPercent'],
            ['malik', 'malikProgress', 'malikStats', 'malikPercent']
        ];

        for (const [book, progress, stats, percent] of books) {
            await loadBookStats(book, progress, stats, percent);
        }

        // Update overall stats (from current book)
        const res = await fetch(`${API}/stats/${currentBook}`);
        const data = await res.json();
        $('statTotal').textContent = data.overall.total.toLocaleString();
        $('statTranslated').textContent = data.overall.translated.toLocaleString();
        $('statPending').textContent = data.overall.pending.toLocaleString();

    } catch (err) {
        console.error('Stats error:', err);
    }
}

async function loadBookStats(book, progressId, statsId, percentId) {
    try {
        const res = await fetch(`${API}/stats/${book}`);
        const data = await res.json();

        const pct = data.overall.percentage || 0;
        const progressEl = $(progressId);
        const statsEl = $(statsId);
        const percentEl = $(percentId);

        if (progressEl) progressEl.style.width = `${pct}%`;
        if (statsEl) statsEl.textContent = `${data.overall.translated.toLocaleString()} / ${data.overall.total.toLocaleString()}`;
        if (percentEl) percentEl.textContent = `${pct}%`;
    } catch (err) {
        console.error(`Stats error for ${book}:`, err);
    }
}

// Hadiths Table
async function loadHadiths() {
    table.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;">Loading...</td></tr>';

    try {
        // Use filterBook if set, otherwise currentBook
        const book = filterBook || currentBook;
        let url = `${API}/hadiths/${book}?page=${page}&limit=${limit}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        if (filterStatus) url += `&status=${encodeURIComponent(filterStatus)}`;
        if (filterKitab) url += `&kitab=${encodeURIComponent(filterKitab)}`;

        const res = await fetch(url);
        const data = await res.json();

        renderTable(data.data);
        updatePagination(data);
        updateFilterStats(data);
    } catch (err) {
        table.innerHTML = `<tr><td colspan="6" style="color:red;">Error: ${err.message}</td></tr>`;
    }
}

function renderTable(items) {
    if (!items.length) {
        table.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;">No results found</td></tr>';
        return;
    }

    table.innerHTML = items.map(item => {
        const status = item.status === 'translated' ? 'translated' : 'pending';
        const statusLabel = status === 'translated' ? 'Translated' : 'Pending';
        const hadithNo = item.hadith_no || item.hadith_id.replace('bukhari_', '').replace('muslim_', '');

        return `
            <tr>
                <td><span class="hadith-id">${hadithNo}</span></td>
                <td>${item.hadith_title || '-'}</td>
                <td>${item.kitab?.th || '-'}</td>
                <td class="arabic-text">${item.kitab?.ar || '-'}</td>
                <td><span class="status-badge status-${status}">${statusLabel}</span></td>
                <td><button class="btn-edit" onclick='openModal(${JSON.stringify(item).replace(/'/g, "&#39;")})'>✨ Edit</button></td>
            </tr>
        `;
    }).join('');
}

function updatePagination(data) {
    pageInfo.textContent = `Page ${data.page} of ${data.total_pages}`;
    prevBtn.disabled = data.page <= 1;
    nextBtn.disabled = data.page >= data.total_pages;
}

function initPagination() {
    prevBtn.onclick = () => { page--; loadHadiths(); };
    nextBtn.onclick = () => { page++; loadHadiths(); };
}

// Search
function initSearch() {
    let timeout;
    searchInput.oninput = (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            search = e.target.value;
            page = 1;
            loadHadiths();
        }, 400);
    };
}

// Modal
function initModal() {
    $('closeModal').onclick = closeModal;
    $('cancelBtn').onclick = closeModal;
    $('saveBtn').onclick = saveChanges;

    modal.onclick = (e) => {
        if (e.target === modal) closeModal();
    };
}

function openModal(item) {
    editingId = item.hadith_id;
    const hadithNo = item.hadith_no || item.hadith_id.replace('bukhari_', '').replace('muslim_', '');
    $('modalTitle').textContent = `แก้ไข หะดีษเลขที่ ${hadithNo}`;

    // New fields
    $('editHadithTitle').value = item.hadith_title || '';
    $('editHadithStatus').value = item.hadith_status || '';

    $('editKitabAr').value = item.kitab?.ar || '';
    $('editKitabTh').value = item.kitab?.th || '';

    // Bab fields
    $('editBabAr').value = item.bab?.ar || '';
    $('editBabTh').value = item.bab?.th || '';

    $('editContentAr').value = item.content?.ar || '';
    $('editContentTh').value = item.content?.th || '';

    modal.classList.remove('hidden');
}

function closeModal() {
    modal.classList.add('hidden');
    editingId = null;
}

async function saveChanges() {
    if (!editingId) return;

    const btn = $('saveBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

    const payload = {
        hadith_title: $('editHadithTitle').value,
        hadith_status: $('editHadithStatus').value,
        kitab: {
            ar: $('editKitabAr').value,
            th: $('editKitabTh').value
        },
        bab: {
            ar: $('editBabAr').value,
            th: $('editBabTh').value
        },
        content: {
            ar: $('editContentAr').value,
            th: $('editContentTh').value
        }
    };

    try {
        const res = await fetch(`${API}/hadith/${editingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Save failed');

        closeModal();
        loadHadiths();
        loadStats();
    } catch (err) {
        alert('Error: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
    }
}

// Expose to window for inline onclick
window.openModal = openModal;

// Filters
function initFilters() {
    const bookSelect = $('filterBook');
    const statusSelect = $('filterStatus');
    const kitabSelect = $('filterKitab');
    const clearBtn = $('clearFilters');

    if (bookSelect) {
        bookSelect.onchange = () => {
            filterBook = bookSelect.value;
            bookSelect.classList.toggle('active', !!filterBook);
            page = 1;
            loadKitabOptions();
            loadHadiths();
        };
    }

    if (statusSelect) {
        statusSelect.onchange = () => {
            filterStatus = statusSelect.value;
            statusSelect.classList.toggle('active', !!filterStatus);
            page = 1;
            loadHadiths();
        };
    }

    if (kitabSelect) {
        kitabSelect.onchange = () => {
            filterKitab = kitabSelect.value;
            kitabSelect.classList.toggle('active', !!filterKitab);
            page = 1;
            loadHadiths();
        };
    }

    if (clearBtn) {
        clearBtn.onclick = () => {
            filterBook = '';
            filterStatus = '';
            filterKitab = '';
            if (bookSelect) { bookSelect.value = ''; bookSelect.classList.remove('active'); }
            if (statusSelect) { statusSelect.value = ''; statusSelect.classList.remove('active'); }
            if (kitabSelect) { kitabSelect.value = ''; kitabSelect.classList.remove('active'); }
            page = 1;
            loadHadiths();
        };
    }

    // Load initial kitab options
    loadKitabOptions();
}

async function loadKitabOptions() {
    const kitabSelect = $('filterKitab');
    if (!kitabSelect) return;

    const book = filterBook || currentBook;

    // Show loading state
    kitabSelect.innerHTML = '<option value="">Loading...</option>';
    kitabSelect.disabled = true;

    try {
        console.log(`Fetching kitabs for book: ${book}`);
        const res = await fetch(`${API}/kitabs/${book}`);

        if (!res.ok) {
            console.error('Kitabs API error:', res.status);
            kitabSelect.innerHTML = '<option value="">All Kitab</option>';
            kitabSelect.disabled = false;
            return;
        }

        const data = await res.json();
        console.log('Kitabs data:', data);

        kitabSelect.innerHTML = '<option value="">📖 All Kitab</option>';
        const kitabs = data.kitabs || [];

        kitabs.forEach((k, i) => {
            const opt = document.createElement('option');
            opt.value = k.ar || k;
            // Show Thai name with Arabic fallback
            const displayName = k.th || k.ar || k;
            opt.textContent = `${i + 1}. ${displayName}`;
            kitabSelect.appendChild(opt);
        });

        console.log(`Loaded ${kitabs.length} kitabs`);
    } catch (err) {
        console.error('Error loading kitabs:', err);
        kitabSelect.innerHTML = '<option value="">All Kitab</option>';
    } finally {
        kitabSelect.disabled = false;
    }
}

function updateFilterStats(data) {
    const statsEl = $('filterStats');
    if (statsEl && data) {
        statsEl.innerHTML = `Showing <strong>${data.data?.length || 0}</strong> of <strong>${data.total?.toLocaleString() || 0}</strong> results`;
    }
}
