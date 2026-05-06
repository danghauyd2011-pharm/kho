// ═══════════════════════════════════════════════════════════
// MODULE BBHV — Biên Bản Huỷ Vỏ
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════
// LAYOUT MODE & ZOOM SYSTEM
// ═══════════════════════════════════════════════════════

let currentMode = 'mobile'; // 'mobile' | 'pc'
let currentZoom = 1.0;
const ZOOM_MIN = 0.5, ZOOM_MAX = 2.0, ZOOM_STEP = 0.1;

function initLayout() {
  // Auto-detect: if screen wide enough, default to PC
  const saved = localStorage.getItem('layout-mode');
  const savedZoom = parseFloat(localStorage.getItem('layout-zoom') || '1');
  const mode = saved || (window.innerWidth >= 960 ? 'pc' : 'mobile');
  currentZoom = isNaN(savedZoom) ? 1 : Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, savedZoom));
  applyMode(mode);
  applyZoom(currentZoom);
}

function applyMode(mode) {
  currentMode = mode;
  document.body.classList.remove('mobile-layout', 'pc-layout');
  document.body.classList.add(mode + '-layout');
  localStorage.setItem('layout-mode', mode);

  const btn = document.getElementById('mode-toggle-btn');
  const lbl = document.getElementById('mode-label');
  if (mode === 'pc') {
    if (btn) btn.innerHTML = '<span class="mt-icon">📱</span><span id="mode-label">Mobile</span>';
    // Show sidebar sub-items for current app
    updateSidebarSub();
  } else {
    if (btn) btn.innerHTML = '<span class="mt-icon">🖥️</span><span id="mode-label">PC</span>';
  }

  // Re-scale A4 previews after layout change
  setTimeout(() => {
    if (typeof scaleA4Pages === 'function') scaleA4Pages();
    if (typeof scaleA4 === 'function') scaleA4();
    if (typeof scaleBBKK === 'function') scaleBBKK();
    if (typeof scaleSoTraPreview === 'function') scaleSoTraPreview();
  }, 150);
}

function toggleMode() {
  applyMode(currentMode === 'mobile' ? 'pc' : 'mobile');
}

function applyZoom(z) {
  currentZoom = Math.round(z * 10) / 10;
  currentZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, currentZoom));
  document.documentElement.style.setProperty('--zoom', currentZoom);
  // Zoom root scaling
  const root = document.getElementById('zoom-root');
  if (root) {
    root.style.transform = `scale(${currentZoom})`;
    root.style.transformOrigin = 'top left';
    root.style.width = `${100 / currentZoom}%`;
    root.style.minHeight = `${100 / currentZoom}vh`;
  }
  const pct = Math.round(currentZoom * 100) + '%';
  const el = document.getElementById('zoom-label');
  const el2 = document.getElementById('zoom-label-sb');
  if (el) el.textContent = pct;
  if (el2) el2.textContent = pct;
  localStorage.setItem('layout-zoom', currentZoom);

  // Re-scale A4 after zoom
  setTimeout(() => {
    if (typeof scaleA4Pages === 'function') scaleA4Pages();
    if (typeof scaleA4 === 'function') scaleA4();
    if (typeof scaleBBKK === 'function') scaleBBKK();
    if (typeof scaleSoTraPreview === 'function') scaleSoTraPreview();
  }, 100);
}

function adjustZoom(delta) { applyZoom(currentZoom + delta); }
function resetZoom() { applyZoom(1); }

// Keyboard shortcuts: Ctrl+= zoom in, Ctrl+- zoom out, Ctrl+0 reset
document.addEventListener('keydown', e => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === '=' || e.key === '+') { e.preventDefault(); adjustZoom(ZOOM_STEP); }
    else if (e.key === '-') { e.preventDefault(); adjustZoom(-ZOOM_STEP); }
    else if (e.key === '0') { e.preventDefault(); resetZoom(); }
  }
});

// ═══════════════════════════════════════════════════════
// UNIFIED APP NAVIGATION
// ═══════════════════════════════════════════════════════
const APP_META = {
  1: { logo:'💊', logoClass:'logo-1', title:'Biên Bản Huỷ Vỏ', badge:'BBHV', badgeBg:'var(--c1l)', badgeColor:'var(--c1)' },
  2: { logo:'📦', logoClass:'logo-2', title:'Thẻ Kho Dược',    badge:'Kho',  badgeBg:'var(--c2l)', badgeColor:'var(--c2d)' },
  3: { logo:'📋', logoClass:'logo-3', title:'Thông Tư 20/2022',badge:'TT20', badgeBg:'var(--c3l)', badgeColor:'var(--c3d)' },
};
let currentApp = 1;

function switchApp(n) {
  currentApp = n;
  // Panels
  document.querySelectorAll('.app-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('app-' + ['bbhv','tk','tt20'][n-1]).classList.add('active');
  // Mobile bottom nav
  document.querySelectorAll('.u-nb').forEach(b => b.classList.remove('active'));
  const unb = document.getElementById('unb-' + n);
  if (unb) unb.classList.add('active');
  // Sidebar buttons
  document.querySelectorAll('.sidebar-btn[id^="sb-"]').forEach(b => {
    if (['sb-1','sb-2','sb-3'].includes(b.id)) b.classList.remove('active');
  });
  const sb = document.getElementById('sb-' + n);
  if (sb) sb.classList.add('active');
  // Header
  const m = APP_META[n];
  const logo = document.getElementById('u-logo');
  if (logo) { logo.textContent = m.logo; logo.className = 'topbar-logo ' + m.logoClass; }
  document.getElementById('u-title').textContent = m.title;
  const badge = document.getElementById('u-badge');
  if (badge) { badge.textContent = m.badge; badge.style.background = m.badgeBg; badge.style.color = m.badgeColor; }
  // Inner nav (mobile)
  const innerNav = document.getElementById('bbhv-inner-nav');
  if (innerNav) innerNav.style.display = n === 1 ? 'flex' : 'none';
  // Sidebar subs
  updateSidebarSub();
  window.scrollTo(0, 0);
}

function updateSidebarSub() {
  const bbhvSub = document.getElementById('sb-bbhv-sub');
  const tkSub   = document.getElementById('sb-tk-sub');
  if (bbhvSub) bbhvSub.style.display = currentApp === 1 ? 'flex' : 'none';
  if (tkSub)   tkSub.style.display   = currentApp === 2 ? 'flex' : 'none';
}

// ── BBHV inner tab switch ──
function switchTab(tabId) {
  document.querySelectorAll('#app-bbhv .screen').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#bbhv-inner-nav .inner-tab').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  const navId = 'nav-' + tabId.replace('tab-', '');
  const navBtn = document.getElementById(navId);
  if (navBtn) navBtn.classList.add('active');
  // Sidebar
  document.querySelectorAll('#sb-bbhv-sub .sidebar-btn').forEach(b => b.classList.remove('active'));
  const sbId = tabId === 'tab-so-tra' ? 'sb-so-tra' : 'sb-bien-ban';
  const sbBtn = document.getElementById(sbId);
  if (sbBtn) sbBtn.classList.add('active');
  if (tabId === 'tab-bien-ban') refreshBienBanTab();
}

// ── BBHV sub-tab switch ──
function switchSubTab(name) {
  ['daily','monthly'].forEach(n => {
    document.getElementById('sbtab-'+n).classList.toggle('active', n===name);
    document.getElementById('sbpanel-'+n).classList.toggle('active', n===name);
  });
  setTimeout(scaleA4Pages, 80);
}

// ── TheKho screen switch ──
function goScreen(id) {
  document.querySelectorAll('#app-tk .screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  // Sidebar highlight
  document.querySelectorAll('#sb-tk-sub .sidebar-btn').forEach(b => b.classList.remove('active'));
  const sbMap = {'sc-data':'sb-sc-data','sc-the-kho':'sb-sc-the-kho','sc-bbkk':'sb-sc-bbkk','sc-ton':'sb-sc-data'};
  const sbBtn = document.getElementById(sbMap[id]);
  if (sbBtn) sbBtn.classList.add('active');
  if (id === 'sc-the-kho') setTimeout(scaleA4, 80);
  if (id === 'sc-bbkk') setTimeout(scaleBBKK, 80);
}

// Init on load
document.addEventListener('DOMContentLoaded', initLayout);
window.addEventListener('resize', () => {
  // Re-scale A4 on window resize
  setTimeout(() => {
    if (typeof scaleA4Pages === 'function') scaleA4Pages();
    if (typeof scaleA4 === 'function') scaleA4();
    if (typeof scaleBBKK === 'function') scaleBBKK();
    if (typeof scaleSoTraPreview === 'function') scaleSoTraPreview();
  }, 100);
});


// ═══════════════════════════════════════
// UNIFIED APP NAVIGATION
// ═══════════════════════════════════════
const APP_META = {
  1: { logo:'💊', logoClass:'u-logo-1', title:'Biên Bản Huỷ Vỏ', badge:'BBHV', badgeBg:'var(--c1l)', badgeColor:'var(--c1)' },
  2: { logo:'📦', logoClass:'u-logo-2', title:'Thẻ Kho Dược', badge:'Kho Dược', badgeBg:'var(--c2l)', badgeColor:'var(--c2)' },
  3: { logo:'📋', logoClass:'u-logo-3', title:'Thông Tư 20/2022', badge:'TT20', badgeBg:'var(--c3l)', badgeColor:'var(--c3)' },
};
let currentApp = 1;

function switchApp(n) {
  if(n === currentApp) return;
  currentApp = n;
  document.querySelectorAll('.app-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.u-nb').forEach(b => b.classList.remove('active'));
  document.getElementById('app-' + ['bbhv','tk','tt20'][n-1]).classList.add('active');
  document.getElementById('unb-' + n).classList.add('active');
  const m = APP_META[n];
  const logo = document.getElementById('u-logo');
  logo.textContent = m.logo;
  logo.className = 'u-logo ' + m.logoClass;
  document.getElementById('u-title').textContent = m.title;
  const badge = document.getElementById('u-badge');
  badge.textContent = m.badge;
  badge.style.background = m.badgeBg;
  badge.style.color = m.badgeColor;
  // Show/hide inner nav
  const innerNav = document.getElementById('bbhv-inner-nav');
  if(innerNav) innerNav.style.display = n === 1 ? 'flex' : 'none';
  window.scrollTo(0, 0);
}







// ═══ APP 1: BBHV JS ═══


// STATE
let exportWB = null, importWB = null;
let aggregatedData = [];
let extraDrugs = [];
let allDatesList = [];
let _rawExport = [], _rawImport = [];

// ── Hiển thị số lượng 2 chữ số khi < 10 ──
function bbhv_fmtQty(n) {
  if (n === 0 || n === null || n === undefined) return '00';
  const num = Number(n);
  if (isNaN(num) || num === 0) return '00';
  return num > 0 && num < 10 ? String(num).padStart(2, '0') : String(num);
}
function bbhv_fmtQtyNz(n) {
  // Chỉ hiện nếu > 0
  const num = Number(n);
  if (!num || num <= 0) return '';
  return num < 10 ? String(num).padStart(2, '0') : String(num);
}

const FIXED_DRUGS = [
  "Diazepam 10mg/2ml",
  "Ephedrine Aguettant 3mg/ml",
  "Fentanyl B.Braun 0.1mg/2ml",
  "Morphin 30mg",
  "Osaphine",
  "Osaphine 10mg/1ml",
  "Zodalan",
  "Zodalan 5mg/1ml"
];

// Map tên thuốc rút gọn → tên chuẩn hiển thị trong biên bản
const DRUG_NAME_MAP = {
  "Osaphine": "Osaphine 10mg/1ml",
  "Zodalan": "Zodalan 5mg/1ml",
};

function normalizeDrugName(name) {
  return DRUG_NAME_MAP[name] || name;
}

function switchTab(tabId) {
  document.querySelectorAll('#app-bbhv .screen').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('#bbhv-inner-nav .inner-tab').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  const _navBtn = document.getElementById('nav-' + tabId.replace('tab-', '')); if(_navBtn) _navBtn.classList.add('active');
  if (tabId === 'tab-bien-ban') refreshBienBanTab();
}

function bbhv_setupDZ(dzId, inputId, type) {
  const dz = document.getElementById(dzId);
  const inp = document.getElementById(inputId);
  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('dragging'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('dragging'));
  dz.addEventListener('drop', e => {
    e.preventDefault(); dz.classList.remove('dragging');
    const f = e.dataTransfer.files[0];
    if (f) bbhv_loadFile(f, type);
  });
  inp.addEventListener('change', e => { if (e.target.files[0]) bbhv_loadFile(e.target.files[0], type); });
}
bbhv_setupDZ('dz-export','fi-export','export');
bbhv_setupDZ('dz-import','fi-import','import');

function bbhv_loadFile(file, type) {
  const reader = new FileReader();
  reader.onload = e => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: 'array' });
    // ── Share with TK module (realtime integration) ──
    if (type === 'xuat') { xuatWB = wb; }
    if (type === 'nhap') { nhapWB = wb; }
    if (xuatWB && nhapWB && typeof processData === 'function') {
      setTimeout(() => { try { processData(); } catch(e) { console.warn('BBHV→TK auto:', e); } }, 300);
    }
    if (type === 'export') { exportWB = wb; markLoaded('dz-export','fn-export', file.name); }
    else { importWB = wb; markLoaded('dz-import','fn-import', file.name); }
  };
  reader.readAsArrayBuffer(file);
}

function markLoaded(dzId, fnId, name) {
  document.getElementById(dzId).classList.add('loaded');
  const fn = document.getElementById(fnId);
  fn.textContent = '✓ ' + name;
  fn.classList.remove('hidden');
}

function clearDates() {
  document.getElementById('date-from').value = '';
  document.getElementById('date-to').value = '';
}

function excelDateToStr(raw) {
  if (raw === '' || raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw);
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  const s = raw.toString().trim();
  // ISO YYYY-MM-DD
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  // Slash-delimited: auto-detect MM/DD/YYYY vs DD/MM/YYYY per value
  // Scan whole file is not possible here, so use unambiguous clues:
  //   if second part > 12 → it is a day  → format is MM/DD/YYYY
  //   if first  part > 12 → it is a day  → format is DD/MM/YYYY
  //   if both ≤ 12        → default MM/DD (matches hospital system export)
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash) {
    const p1 = parseInt(slash[1]), p2 = parseInt(slash[2]), yr = slash[3];
    const m1 = String(p1).padStart(2,'0'), m2 = String(p2).padStart(2,'0');
    if (p1 > 12) return `${yr}-${m2}-${m1}`;   // p1 is day  → DD/MM/YYYY
    if (p2 > 12) return `${yr}-${m1}-${m2}`;   // p2 is day  → MM/DD/YYYY
    return `${yr}-${m1}-${m2}`;                 // ambiguous  → MM/DD/YYYY (system default)
  }
  return null;
}

function bbhv_isoToDisplay(iso) {
  if (!iso) return '';
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function isoToDate(iso) {
  const [y,m,d] = iso.split('-').map(Number);
  return new Date(y, m-1, d);
}

function getDayOfWeek(iso) { return isoToDate(iso).getDay(); }
function isWeekend(iso) { const d = getDayOfWeek(iso); return d === 0 || d === 6; }
function getDayName(iso) {
  const names = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
  return names[getDayOfWeek(iso)];
}

function bbhv_parseSheet(wb, docTypeFilter) {
  // docTypeFilter: string hoặc array of strings
  const filterArr = Array.isArray(docTypeFilter) ? docTypeFilter : [docTypeFilter];

  for (const sname of wb.SheetNames) {
    const ws = wb.Sheets[sname];
    const rows = XLSX.utils.sheet_to_json(ws, { header:1, raw:true, defval:'' });

    // Tìm header row: cần tên hàng + số lượng + loại chứng từ (không bắt buộc khoa phòng)
    let hi = -1;
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      const r = rows[i].map(c => (c||'').toString().toLowerCase().trim());
      const hasDrug = r.some(c => c === 'tên hàng' || c === 'tên thuốc' || c.includes('tên hàng'));
      const hasQty  = r.some(c => c === 'số lượng' || c.includes('số lượng'));
      const hasType = r.some(c => c.includes('loại chứng từ'));
      if (hasDrug && hasQty && hasType) { hi = i; break; }
    }
    if (hi === -1) continue;

    const hdrs = rows[hi].map(h => (h||'').toString().trim().toLowerCase());
    const ci = name => {
      const exact = hdrs.findIndex(h => h === name);
      if (exact !== -1) return exact;
      return hdrs.findIndex(h => h.includes(name));
    };

    const dateCol = ci('ngày ct') !== -1 ? ci('ngày ct') : ci('ngày');
    const drugCol = ci('tên hàng') !== -1 ? ci('tên hàng') : ci('tên thuốc');
    const qtyCol  = ci('số lượng');
    const typeCol = ci('loại chứng từ');
    const deptCol = ci('khoa phòng'); // -1 nếu file nhập trả không có cột này

    // Bắt buộc: ngày, tên hàng, số lượng, loại chứng từ
    if ([dateCol, drugCol, qtyCol, typeCol].some(i => i === -1)) continue;

    const records = [];
    for (let i = hi+1; i < rows.length; i++) {
      const row = rows[i];
      const docType = (row[typeCol]||'').toString().trim();
      if (!filterArr.includes(docType)) continue;
      const drug = (row[drugCol]||'').toString().trim();
      if (!drug) continue;
      if (drug.toLowerCase().includes('seduxen')) continue;
      const isoDate = excelDateToStr(row[dateCol]);
      if (!isoDate) continue;
      const qty = parseFloat(row[qtyCol]) || 0;
      if (!qty) continue;
      // dept: optional (file nhập trả không có khoa phòng)
      const dept = deptCol !== -1 ? (row[deptCol]||'').toString().trim() : '';
      // File xuất kho: bỏ dòng không có khoa
      if (deptCol !== -1 && !dept) continue;
      records.push({ date: isoDate, drug, qty, dept, loaiCT: docType });
    }
    return records;
  }
  return null;
}

function processAll() {
  const errBox = document.getElementById('error-box');
  errBox.classList.add('hidden');
  document.getElementById('result-section').classList.add('hidden');
  if (!exportWB) { bbhv_showError('Vui lòng chọn file xuất số lượng thuốc.'); return; }
  if (!importWB) { bbhv_showError('Vui lòng chọn file nhập trả số lượng thuốc.'); return; }
  const btn = document.getElementById('process-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner">⚡</span> Đang xử lý…';
  setTimeout(() => {
    try {
      const exportRecs = bbhv_parseSheet(exportWB, ['Chuyển kho', 'Xuất chuyển kho']);
      if (!exportRecs) { bbhv_showError('Không tìm được cột dữ liệu trong file xuất.'); return; }
      const importRecs = bbhv_parseSheet(importWB, 'Trả thuốc theo yêu cầu');
      if (!importRecs) { bbhv_showError('Không tìm được cột dữ liệu trong file nhập trả.'); return; }
      const dateFrom = document.getElementById('date-from').value || null;
      const dateTo = document.getElementById('date-to').value || null;
      const filterDate = recs => recs.filter(r => {
        if (dateFrom && r.date < dateFrom) return false;
        if (dateTo && r.date > dateTo) return false;
        return true;
      });
      const filteredExport = filterDate(exportRecs);
      const filteredImport = filterDate(importRecs);
      _rawExport = filteredExport;
      _rawImport = filteredImport;
      const sumMap = (recs, sign) => {
        const m = {};
        for (const r of recs) {
          const drug = normalizeDrugName(r.drug);
          const k = `${r.date}|${r.dept}|${drug}`;
          m[k] = (m[k] || 0) + sign * r.qty;
        }
        return m;
      };
      const expMap = sumMap(filteredExport, +1);
      const impMap = sumMap(filteredImport, -1);
      const keys = new Set([...Object.keys(expMap), ...Object.keys(impMap)]);
      const netMap = {};
      for (const k of keys) {
        const val = (expMap[k] || 0) + (impMap[k] || 0);
        if (val !== 0) netMap[k] = val;
      }
      const allDrugs = new Set();
      for (const k of Object.keys(netMap)) {
        const drug = k.split('|')[2];
        allDrugs.add(drug);
      }
      extraDrugs = [...allDrugs].filter(d => !FIXED_DRUGS.includes(d)).sort();
      const rowMap = {};
      for (const [k, val] of Object.entries(netMap)) {
        const [date, dept, drug] = k.split('|');
        const rk = `${date}|||${dept}`;
        if (!rowMap[rk]) rowMap[rk] = { date, dept, drugs: {} };
        rowMap[rk].drugs[drug] = val;
      }
      aggregatedData = Object.values(rowMap).sort((a,b) =>
        a.date !== b.date ? a.date.localeCompare(b.date) : a.dept.localeCompare(b.dept)
      );
      if (aggregatedData.length === 0) {
        bbhv_showError('Không có dữ liệu sau khi xử lý.');
        return;
      }
      allDatesList = [...new Set(aggregatedData.map(r => r.date))].sort();
      renderResult(dateFrom, dateTo);
      document.getElementById('result-section').classList.remove('hidden');
      document.getElementById('result-section').style.display='flex'; document.getElementById('result-section').classList.remove('hidden');
      // Update hero stats
      document.getElementById('ss-records').textContent = aggregatedData.length;
      document.getElementById('ss-dates').textContent = allDatesList.length;
      document.getElementById('ss-depts').textContent = new Set(aggregatedData.map(r=>r.dept)).size;
    } catch(err) {
      bbhv_showError('Lỗi xử lý: ' + err.message);
      console.error(err);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '⚡ Xử lý dữ liệu';
    }
  }, 50);
}

function bbhv_showError(msg) {
  document.getElementById('error-text').textContent = msg;
  document.getElementById('error-box').classList.remove('hidden');
  document.getElementById('process-btn').disabled = false;
  document.getElementById('process-btn').innerHTML = '⚡ Xử lý dữ liệu';
}

function resetResult() {
  document.getElementById('result-section').classList.add('hidden');
  document.getElementById('error-box').classList.add('hidden');
  document.getElementById('error-text').textContent = '';
}

function renderResult(dateFrom, dateTo) {
  const dates = new Set(aggregatedData.map(r => r.date)).size;
  const depts = new Set(aggregatedData.map(r => r.dept)).size;
  document.getElementById('stats-row').innerHTML =
    `<div class="stat-tile"><div class="stat-val cv1">${aggregatedData.length}</div><div class="stat-lbl">Dòng</div></div>` +
    `<div class="stat-tile"><div class="stat-val cv2">${dates}</div><div class="stat-lbl">Ngày</div></div>` +
    `<div class="stat-tile"><div class="stat-val cv3">${depts}</div><div class="stat-lbl">Khoa</div></div>` +
    `<div class="stat-tile"><div class="stat-val cv4">${FIXED_DRUGS.length + extraDrugs.length}</div><div class="stat-lbl">Thuốc</div></div>`;
  const rangeText = (dateFrom || dateTo)
    ? `📅 Khoảng thời gian: ${dateFrom ? bbhv_isoToDisplay(dateFrom) : '…'} → ${dateTo ? bbhv_isoToDisplay(dateTo) : '…'}`
    : '📅 Hiển thị toàn bộ dữ liệu';
  document.getElementById('date-range-text').textContent = rangeText;
  const allDrugCols = [...FIXED_DRUGS, ...extraDrugs];
  document.getElementById('table-title').textContent = `📊 Xem trước (${aggregatedData.length} dòng)`;
  const thCells = allDrugCols.map(d => `<th title="${d}">${d.length > 16 ? d.substring(0,15)+'…' : d}</th>`).join('');
  const rows = aggregatedData.map(row => {
    const cells = allDrugCols.map(d => {
      const v = row.drugs[d];
      if (v === undefined || v === 0) return `<td class="qty-empty">–</td>`;
      if (v < 0) return `<td class="qty-neg">${v < -9 ? v : '-0'+Math.abs(v)}</td>`;
      return `<td class="qty-val">${v < 10 ? String(v).padStart(2,'0') : v}</td>`;
    }).join('');
    return `<tr><td>${bbhv_isoToDisplay(row.date)}</td><td>${row.dept}</td>${cells}</tr>`;
  }).join('');
  document.getElementById('preview-table').innerHTML = `
    <thead><tr><th>Ngày</th><th>Khoa phòng</th>${thCells}</tr></thead>
    <tbody>${rows}</tbody>
  `;
  // Update A4 preview
  setTimeout(renderSoTraVoPreview, 50);
}

function downloadExcel() {
  // Build drug columns: FIXED_DISPLAY first (excluding seduxen), then extraDrugs
  const FIXED_DISPLAY = ["Diazepam 10mg/2ml","Ephedrine Aguettant 3mg/ml","Fentanyl B.Braun 0.1mg/2ml","Morphin 30mg","Osaphine 10mg/1ml","Zodalan 5mg/1ml"];
  const allDrugCols = [];
  // Fixed drugs first
  for (const d of FIXED_DISPLAY) {
    if (aggregatedData.some(r => r.drugs[d] && r.drugs[d] !== 0)) allDrugCols.push(d);
    else if (FIXED_DRUGS.includes(d) || FIXED_DRUGS.some(fd => normalizeDrugName(fd) === d)) allDrugCols.push(d);
  }
  // Extra drugs (not in fixed list, not seduxen)
  for (const d of extraDrugs) {
    if (!d.toLowerCase().includes('seduxen') && !allDrugCols.includes(d)) allDrugCols.push(d);
  }
  const totalCols = allDrugCols.length;
  const lastDrugColIdx = totalCols; // 0-based: cols 1..totalCols are drugs
  const khoaColIdx = totalCols + 1;

  // Row 1: headers
  const hdr1 = ['Ngày tháng năm', 'Tên thuốc, nồng độ, hàm lượng'];
  for (let i = 1; i < totalCols; i++) hdr1.push('');
  hdr1.push('Khoa phòng', 'Người trả', 'Người nhận');

  // Row 2: individual drug names
  const hdr2 = [''];
  for (const d of allDrugCols) hdr2.push(d);
  hdr2.push('', '', '');

  const aoa = [hdr1, hdr2];
  for (const entry of aggregatedData) {
    const row = [bbhv_isoToDisplay(entry.date)];
    for (const d of allDrugCols) {
      const v = entry.drugs[d];
      if (v !== undefined && v !== 0) {
        // Store as text with leading zero for 1-9
        row.push(v > 0 && v < 10 ? String(v).padStart(2,'0') : v);
      } else {
        row.push('');
      }
    }
    row.push(entry.dept, '', '');
    aoa.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Merges: A col spans 2 rows, drug header spans drug cols, Khoa/Nguoi tra/nhan span 2 rows
  ws['!merges'] = [
    { s:{r:0,c:0}, e:{r:1,c:0} },                         // Ngày tháng năm
    { s:{r:0,c:1}, e:{r:0,c:totalCols} },                  // Tên thuốc group header
    { s:{r:0,c:khoaColIdx},   e:{r:1,c:khoaColIdx} },      // Khoa phòng
    { s:{r:0,c:khoaColIdx+1}, e:{r:1,c:khoaColIdx+1} },    // Người trả
    { s:{r:0,c:khoaColIdx+2}, e:{r:1,c:khoaColIdx+2} },    // Người nhận
  ];

  // Column widths matching template
  const colWidths = [{wch:13}]; // A: date
  for (let i = 0; i < totalCols; i++) {
    const drugName = allDrugCols[i];
    colWidths.push({wch: Math.max(12, Math.ceil(drugName.length * 0.65))});
  }
  colWidths.push({wch:18}, {wch:12}, {wch:12}); // Khoa, Nguoi tra, Nguoi nhan
  ws['!cols'] = colWidths;

  // Row heights: row 1 taller, row 2 very tall for rotated drug names
  ws['!rows'] = [{hpt:33}, {hpt:91}];

  // Apply styles using XLSX with style support (via SheetJS-style if available)
  // Set cell styles manually
  const styleHdr = {font:{bold:true,name:'Times New Roman',sz:13},alignment:{horizontal:'center',vertical:'center',wrapText:true},border:{top:{style:'medium'},bottom:{style:'medium'},left:{style:'medium'},right:{style:'medium'}}};
  const styleDrug = {font:{bold:true,name:'Times New Roman',sz:13},alignment:{horizontal:'center',vertical:'center',wrapText:true},border:{bottom:{style:'medium'},right:{style:'medium'}}};
  const styleData = {font:{name:'Times New Roman',sz:12},alignment:{horizontal:'center',vertical:'center'},border:{bottom:{style:'thin'},right:{style:'thin'}}};
  const styleDataLeft = {font:{name:'Times New Roman',sz:12},alignment:{horizontal:'left',vertical:'center'},border:{bottom:{style:'thin'},right:{style:'thin'},left:{style:'medium'}}};

  // Apply header styles
  const hdrCells = ['A1'];
  hdrCells.push('B1'); // drug group
  ws['A1'].s = styleHdr;
  const b1Key = XLSX.utils.encode_cell({r:0,c:1});
  if(ws[b1Key]) ws[b1Key].s = styleHdr;
  const khoaCell = XLSX.utils.encode_cell({r:0,c:khoaColIdx});
  const ntrCell  = XLSX.utils.encode_cell({r:0,c:khoaColIdx+1});
  const nnhCell  = XLSX.utils.encode_cell({r:0,c:khoaColIdx+2});
  if(ws[khoaCell]) ws[khoaCell].s = styleHdr;
  if(ws[ntrCell])  ws[ntrCell].s  = styleHdr;
  if(ws[nnhCell])  ws[nnhCell].s  = styleHdr;

  // Drug name cells row 2
  for (let c = 1; c <= totalCols; c++) {
    const ck = XLSX.utils.encode_cell({r:1,c});
    if(ws[ck]) ws[ck].s = styleDrug;
  }

  // Data rows
  for (let r = 2; r < aoa.length; r++) {
    for (let c = 0; c <= khoaColIdx+2; c++) {
      const ck = XLSX.utils.encode_cell({r,c});
      if(ws[ck]) ws[ck].s = c === 0 ? styleDataLeft : styleData;
    }
  }

  XLSX.utils.book_append_sheet(XLSX.utils.book_new(), ws, 'Sổ trả vỏ');
  const wb2 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb2, ws, 'Sổ trả vỏ');
  const fname = 'Mau_so_tra_vo_' + new Date().toISOString().slice(0,10) + '.xlsx';
  xlsxDownload(wb2, fname);
}

// ── A4 Preview for Sổ Trả Vỏ ──
function renderSoTraVoPreview() {
  const FIXED_DISPLAY = ["Diazepam 10mg/2ml","Ephedrine Aguettant 3mg/ml","Fentanyl B.Braun 0.1mg/2ml","Morphin 30mg","Osaphine 10mg/1ml","Zodalan 5mg/1ml"];
  const allDrugCols = [];
  for (const d of FIXED_DISPLAY) allDrugCols.push(d);
  for (const d of extraDrugs) {
    if (!d.toLowerCase().includes('seduxen') && !allDrugCols.includes(d)) allDrugCols.push(d);
  }
  if (aggregatedData.length === 0) return;

  const drugThCols = allDrugCols.map(d => `<th style="writing-mode:vertical-rl;transform:rotate(180deg);min-width:28px;max-width:40px;font-size:10px;padding:3px 2px;white-space:nowrap" title="${d}">${d}</th>`).join('');

  const dataRows = aggregatedData.map(entry => {
    const cells = allDrugCols.map(d => {
      const v = entry.drugs[d];
      const disp = (v && v !== 0) ? (v > 0 && v < 10 ? String(v).padStart(2,'0') : v) : '';
      return `<td style="text-align:center;font-size:11px">${disp}</td>`;
    }).join('');
    return `<tr><td style="white-space:nowrap;font-size:11px">${bbhv_isoToDisplay(entry.date)}</td>${cells}<td style="font-size:10px">${entry.dept}</td><td></td><td></td></tr>`;
  }).join('');

  const html = `<div style="font-family:'Times New Roman',serif">
    <table style="width:100%;border-collapse:collapse;font-size:11px">
      <thead>
        <tr>
          <th rowspan="2" style="border:1px solid #000;padding:4px 6px;font-size:11px;vertical-align:middle;text-align:center;min-width:70px">Ngày tháng năm</th>
          <th colspan="${allDrugCols.length}" style="border:1px solid #000;padding:4px 6px;font-size:11px;text-align:center">Tên thuốc, nồng độ, hàm lượng</th>
          <th rowspan="2" style="border:1px solid #000;padding:4px 6px;font-size:11px;vertical-align:middle;text-align:center">Khoa phòng</th>
          <th rowspan="2" style="border:1px solid #000;padding:4px 6px;font-size:11px;vertical-align:middle;text-align:center">Người trả</th>
          <th rowspan="2" style="border:1px solid #000;padding:4px 6px;font-size:11px;vertical-align:middle;text-align:center">Người nhận</th>
        </tr>
        <tr>${drugThCols}</tr>
      </thead>
      <tbody>${dataRows}</tbody>
    </table>
  </div>`;

  const preview = document.getElementById('so-tra-preview-page');
  if (preview) {
    preview.innerHTML = html;
    setTimeout(scaleSoTraPreview, 80);
  }
}

function scaleSoTraPreview() {
  const wrap = document.getElementById('so-tra-preview-wrap');
  const scaler = document.getElementById('so-tra-preview-scaler');
  const page = document.getElementById('so-tra-preview-page');
  if (!wrap || !scaler || !page) return;
  const avail = wrap.offsetWidth;
  const scale = avail > 0 ? Math.min(1, (avail - 2) / 794) : 1;
  scaler.style.transform = `scale(${scale})`;
  wrap.style.height = (page.offsetHeight * scale + 4) + 'px';
}
window.addEventListener('resize', scaleSoTraPreview);


// ══ BIÊN BẢN JS ══

function switchSubTab(name) {
  ['daily','monthly'].forEach(n => {
    document.getElementById('sbtab-'+n).classList.toggle('active', n===name);
    document.getElementById('sbpanel-'+n).classList.toggle('active', n===name);
  });
  setTimeout(scaleA4Pages, 80);
}

function scaleA4Pages() {
  [['a4-daily-wrap','a4-daily-scaler','a4-daily-preview'],['a4-monthly-wrap','a4-monthly-scaler','a4-monthly-preview']].forEach(([wrapId,scalerId,pageId]) => {
    const wrap  = document.getElementById(wrapId);
    const scaler= document.getElementById(scalerId);
    const page  = document.getElementById(pageId);
    if (!wrap||!scaler||!page) return;
    const avail = wrap.offsetWidth;
    const scale = avail > 0 ? Math.min(1, (avail - 2) / 794) : 1;
    scaler.style.transform = `scale(${scale})`;
    wrap.style.height = (page.offsetHeight * scale + 4) + 'px';
  });
}
window.addEventListener('resize', scaleA4Pages);

function refreshBienBanTab() {
  const statusDiv = document.getElementById('bb-data-status');
  if (aggregatedData.length === 0) {
    const sd=document.getElementById('bb-data-status');
    sd.className='notice n-orange';
    sd.innerHTML='<span class="n-icon">⚠️</span><span>Chưa có dữ liệu. Vui lòng vào <strong>Sổ Trả Vỏ</strong> và xử lý trước.</span>';
    document.getElementById('daily-no-data').classList.remove('hidden');   document.getElementById('daily-content').classList.add('hidden');
    document.getElementById('monthly-no-data').classList.remove('hidden'); document.getElementById('monthly-content').classList.add('hidden');
    return;
  }
  const dates = allDatesList;
  const statusDiv2=document.getElementById('bb-data-status');
  statusDiv2.className='notice n-green';
  statusDiv2.innerHTML=`<span class="n-icon">✅</span><span>Dữ liệu sẵn sàng — <strong>${aggregatedData.length}</strong> bản ghi · <strong>${dates.length}</strong> ngày</span>`;
  document.getElementById('daily-no-data').classList.add('hidden');   document.getElementById('daily-content').classList.remove('hidden');
  document.getElementById('monthly-no-data').classList.add('hidden'); document.getElementById('monthly-content').classList.remove('hidden');
  if (dates.length > 0) {
    document.getElementById('bb-date-from').value  = dates[0];
    document.getElementById('bb-date-to').value    = dates[dates.length-1];
    document.getElementById('bb-month-from').value = dates[0];
    document.getElementById('bb-month-to').value   = dates[dates.length-1];
  }
  refreshDateChips();
  onMonthRangeChange();
  setTimeout(scaleA4Pages, 120);
}

// Group Sat+Sun
function groupDates(dates) {
  const groups=[]; let i=0;
  while(i<dates.length){
    const d=dates[i], dow=getDayOfWeek(d);
    if(dow===6){
      const g=[d];
      if(i+1<dates.length&&getDayOfWeek(dates[i+1])===0){g.push(dates[i+1]);i+=2;}else{i++;}
      groups.push(g);
    }else{groups.push([d]);i++;}
  }
  return groups;
}

let _currentGroups=[];
function refreshDateChips(){
  const fv=document.getElementById('bb-date-from').value;
  const tv=document.getElementById('bb-date-to').value;
  let filt=allDatesList;
  if(fv) filt=filt.filter(d=>d>=fv);
  if(tv) filt=filt.filter(d=>d<=tv);
  _currentGroups=groupDates(filt);
  const cont=document.getElementById('date-chips');
  cont.innerHTML='';
  if(_currentGroups.length===0){cont.innerHTML='<div style="color:var(--slate);font-size:12px;padding:4px;">Không có ngày nào</div>';return;}
  _currentGroups.forEach((g,idx)=>{
    const chip=document.createElement('div');
    chip.className='date-chip'+(isWeekend(g[0])?' weekend':'');
    chip.dataset.groupIdx=idx;
    chip.textContent=g.length>1?`${bbhv_isoToDisplay(g[0])} + ${bbhv_isoToDisplay(g[1])} (T7+CN)`:`${bbhv_isoToDisplay(g[0])} (${getDayName(g[0])})`;
    chip.addEventListener('click',()=>{
      chip.classList.toggle('selected');
      updateSelectedCount();
      // Preview first selected
      const first=document.querySelector('.date-chip.selected');
      if(first){
        const gi=parseInt(first.dataset.groupIdx);
        const gr=_currentGroups[gi];
        const {rows,total}=aggregateForBB(gr);
        renderA4Preview('daily',rows,total,gr[0],gr[gr.length-1],false);
      }else{
        document.getElementById('a4-daily-preview').innerHTML='<div style="text-align:center;color:#94a3b8;font-family:sans-serif;font-size:13px;padding-top:80px;">Chọn ngày để xem trước biên bản</div>';
      }
      setTimeout(scaleA4Pages,80);
    });
    cont.appendChild(chip);
  });
  updateSelectedCount();
}
function updateSelectedCount(){
  const s=document.querySelectorAll('#app-bbhv .date-chip.selected').length;
  const t=document.querySelectorAll('#app-bbhv .date-chip').length;
  document.getElementById('selected-count').textContent=s>0?`Đã chọn ${s}/${t}`:'';
}
function selectAllDates(){document.querySelectorAll('#app-bbhv .date-chip').forEach(c=>c.classList.add('selected'));updateSelectedCount();}
function deselectAllDates(){document.querySelectorAll('#app-bbhv .date-chip').forEach(c=>c.classList.remove('selected'));updateSelectedCount();}

function onMonthRangeChange(){
  const fv=document.getElementById('bb-month-from').value;
  const tv=document.getElementById('bb-month-to').value;
  let filt=allDatesList;
  if(fv) filt=filt.filter(d=>d>=fv);
  if(tv) filt=filt.filter(d=>d<=tv);
  if(filt.length===0){
    document.getElementById('monthly-preview').innerHTML='<div class="notice notice-info" style="font-size:12px;">Không có ngày nào trong khoảng này</div>';
    document.getElementById('a4-monthly-preview').innerHTML='<div style="text-align:center;color:#94a3b8;font-family:sans-serif;font-size:13px;padding-top:80px;">Chọn khoảng thời gian để xem trước</div>';
    setTimeout(scaleA4Pages,80);
    return;
  }
  const {rows,total}=aggregateForBB(filt);
  document.getElementById('monthly-preview').innerHTML=`<div class="notice n-green" style="font-size:12px;">📋 Tổng hợp <strong>${filt.length} ngày</strong> · <strong>${rows.length} loại thuốc</strong> · <strong>${total.toLocaleString('vi-VN')} vỏ</strong></div>`;
  renderA4Preview('monthly',rows,total,filt[0],filt[filt.length-1],true);
  setTimeout(scaleA4Pages,80);
}

function aggregateForBB(dates){
  const dateSet=new Set(dates);
  // Gom theo tên chuẩn (sau khi normalize)
  // Biên bản huỷ vỏ CHỈ tính:
  //   Xuất: loaiCT === "Chuyển kho" (không tính: Xuất chuyển kho, Xuất kho đến tủ trực)
  //   Nhập: loaiCT === "Trả thuốc theo yêu cầu" (không tính: Nhập kho từ tủ trực, Nhập kho)
  const BB_XUAT_ALLOWED = ['chuyển kho'];
  const BB_NHAP_ALLOWED = ['trả thuốc theo yêu cầu'];
  const expMap={},impMap={};
  for(const r of _rawExport){
    if(!dateSet.has(r.date))continue;
    // Chỉ lấy loại "Chuyển kho" cho biên bản
    const lt=(r.loaiCT||'').toLowerCase().trim();
    if(!BB_XUAT_ALLOWED.includes(lt))continue;
    const name=normalizeDrugName(r.drug);
    expMap[name]=(expMap[name]||0)+r.qty;
  }
  for(const r of _rawImport){
    if(!dateSet.has(r.date))continue;
    // Chỉ lấy "Trả thuốc theo yêu cầu" cho biên bản
    const lt=(r.loaiCT||'').toLowerCase().trim();
    if(!BB_NHAP_ALLOWED.includes(lt))continue;
    const name=normalizeDrugName(r.drug);
    impMap[name]=(impMap[name]||0)+r.qty;
  }
  // Thứ tự hiển thị: FIXED_DRUGS chuẩn trước, rồi extra
  const FIXED_DISPLAY=["Diazepam 10mg/2ml","Ephedrine Aguettant 3mg/ml","Fentanyl B.Braun 0.1mg/2ml","Morphin 30mg","Osaphine 10mg/1ml","Zodalan 5mg/1ml"];
  const rows=[]; let stt=1;
  const seen=new Set();
  for(const drug of FIXED_DISPLAY){
    seen.add(drug);
    const x=expMap[drug]||0,t=impMap[drug]||0;
    if(x===0&&t===0)continue;
    rows.push({stt:stt++,drug,xuatPhi:x,traPhi:t,thucTe:Math.max(0,x-t)});
  }
  // Extra drugs không trong danh sách chuẩn
  for(const drug of [...new Set([...Object.keys(expMap),...Object.keys(impMap)])].sort()){
    if(seen.has(drug))continue;
    const x=expMap[drug]||0,t=impMap[drug]||0;
    if(x===0&&t===0)continue;
    rows.push({stt:stt++,drug,xuatPhi:x,traPhi:t,thucTe:Math.max(0,x-t)});
  }
  const total=rows.reduce((s,r)=>s+r.thucTe,0);
  return{rows,total};
}

// ── Số bằng chữ — chữ cái đầu VIẾT HOA ──
function numberToVietnamese(n){
  if(n===0)return'Không';
  const units=['','một','hai','ba','bốn','năm','sáu','bảy','tám','chín'];
  function readGroup(num){
    if(num===0)return'';
    const h=Math.floor(num/100),t=Math.floor((num%100)/10),u=num%10;
    let s='';
    if(h>0)s+=units[h]+' trăm';
    if(t>0){if(s)s+=' ';if(t===1)s+='mười';else s+=units[t]+' mươi';}
    else if(h>0&&u>0){s+=' lẻ';}
    if(u>0){
      if(s&&t>0)s+=' ';
      if(t===1&&u===5)s+='lăm';
      else if(t>1&&u===1)s+='mốt';
      else if(t>1&&u===5)s+='lăm';
      else s+=units[u];
    }
    return s.trim();
  }
  const bil=Math.floor(n/1000000000),mil=Math.floor((n%1000000000)/1000000),tho=Math.floor((n%1000000)/1000),rem=n%1000;
  const parts=[];
  if(bil)parts.push(readGroup(bil)+' tỷ');
  if(mil)parts.push(readGroup(mil)+' triệu');
  if(tho)parts.push(readGroup(tho)+' nghìn');
  if(rem||n<1000)parts.push(readGroup(rem));
  const r=parts.join(' ').trim();
  return r.charAt(0).toUpperCase()+r.slice(1);
}

// ── A4 PREVIEW RENDERER ──
function renderA4Preview(which,rows,total,dateFrom,dateTo,isMonthly){
  const [fY,fM,fD]=dateFrom.split('-');
  const [tY,tM,tD]=dateTo.split('-');
  const totalWords=numberToVietnamese(total);
  const signDate=`Ngày ${parseInt(tD)} tháng ${parseInt(tM)} năm ${tY}`;
  let html='';

  if(isMonthly){
    html+=`<div class="a4-header">
      <div class="a4-header-left">
        <div><strong>SỞ Y TẾ TP ĐÀ NẴNG</strong></div>
        <div><strong>BỆNH VIỆN ĐÀ NẴNG</strong></div>
        <span class="a4-header-line"></span>
      </div>
      <div class="a4-header-right">
        <div><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></div>
        <div><strong>Độc lập – Tự do – Hạnh phúc</strong></div>
        <span class="a4-header-line"></span>
      </div>
    </div>
    <div class="a4-title">BIÊN BẢN HUỶ VỎ</div>
    <div class="a4-subtitle">THUỐC GÂY NGHIỆN, THUỐC HƯỚNG THẦN VÀ TIỀN CHẤT</div>
    <div class="a4-subtitle">KHO THUỐC NỘI TRÚ</div>
    <div class="a4-date-range">Từ ${fD}/${fM}/${fY} đến ${tD}/${tM}/${tY}</div>
    <div class="a4-council">
      <div>Hội đồng huỷ vỏ gồm:</div>
      <div class="a4-council-member">1.&nbsp;&nbsp;Ông Nguyễn Thành Trung&nbsp;&nbsp;&nbsp;&nbsp;- Phó Giám đốc&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- Chủ tịch HĐ</div>
      <div class="a4-council-member">2.&nbsp;&nbsp;Bà Nguyễn Thị Phúc&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- TP. Điều dưỡng&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- Phó CT HĐ</div>
      <div class="a4-council-member">3.&nbsp;&nbsp;Bà Trương Phạm Hoàng Quyên&nbsp;- TP. KHTH&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- Thư ký</div>
      <div class="a4-council-member">4.&nbsp;&nbsp;Ông Thái Bá Sỹ&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- TP.TCCB, TBTTND&nbsp;&nbsp;&nbsp;- Thành viên</div>
      <div class="a4-council-member">5.&nbsp;&nbsp;Ông Huỳnh Đức Phát&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- TK. PT-GMHS&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- Thành viên</div>
      <div class="a4-council-member">6.&nbsp;&nbsp;Bà Vũ Thị Thu Hiền&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- TK. KSNK&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- Thành viên</div>
      <div class="a4-council-member">7.&nbsp;&nbsp;Bà Nguyễn Thị Hà Giang&nbsp;&nbsp;&nbsp;&nbsp;- PTK. Dược&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- Thành viên</div>
      <div class="a4-council-member">8.&nbsp;&nbsp;Ông Trần Thanh Liêm&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- PTP. Điều dưỡng&nbsp;&nbsp;&nbsp;&nbsp;- Thành viên</div>
      <div class="a4-council-member">9.&nbsp;&nbsp;Bà Nguyễn Thị Phương Linh&nbsp;- Khoa PT-GMHS&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- Thành viên</div>
      <div class="a4-council-member">10. Ông Nguyễn Đăng Hậu&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- Khoa Dược&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- Thành viên</div>
      <div class="a4-council-member">11. Bà Lê Nhật Phương&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- Khoa Dược&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- Thành viên</div>
      <div style="margin-top:8px;">Tiến hành huỷ vỏ thuốc gây nghiện, thuốc hướng thần và tiền chất như sau:</div>
    </div>
    <table class="a4-table">
      <thead><tr>
        <th style="width:5%">Stt</th><th style="width:30%">Tên thuốc, nồng độ, hàm lượng</th>
        <th style="width:7%">ĐVT</th><th style="width:13%">Số vỏ thực tế</th>
        <th style="width:13%">Số lượng trả</th><th style="width:17%">Số lượng sử dụng (Trên phiếu)</th>
        <th style="width:15%">Ghi chú</th>
      </tr></thead><tbody>`;
    rows.forEach(r=>{
      const tra=r.traPhi>0?String(r.traPhi).padStart(2,'0'):'00';
      html+=`<tr><td class="center">${String(r.stt).padStart(2,'0')}</td><td>${r.drug}</td><td class="center">vỏ</td><td class="center">${bbhv_fmtQty(r.thucTe)}</td><td class="center">${tra}</td><td class="center">${bbhv_fmtQty(r.xuatPhi)}</td><td></td></tr>`;
    });
    html+=`</tbody></table>
    <div class="a4-footer">
      <p style="margin-top:8px;">Tổng cộng: ${total.toLocaleString('vi-VN')} vỏ (${totalWords} vỏ).</p>
      <p style="margin-top:6px;">Phương pháp hủy: Đập vỡ vụn từng vỏ, phân loại và xử lý theo quy trình xử lý rác thải y tế của bệnh viện.</p>
      <p style="text-align:right;margin-top:12px;font-style:italic;">${signDate}</p>
      <div class="a4-sign-row" style="margin-top:16px;">
        <div class="a4-sign-left"><strong>Thành viên Hội đồng hủy vỏ</strong><br><em>(Ký và ghi họ tên)</em></div>
        <div class="a4-sign-right"><strong>Chủ tịch hội đồng</strong><br><strong>PHÓ GIÁM ĐỐC</strong><br><strong>Nguyễn Thành Trung</strong></div>
      </div>
    </div>`;
  }else{
    html+=`<div class="a4-title" style="font-size:13.5px;">BIÊN BẢN HỦY THUỐC GÂY NGHIỆN – HƯỚNG THẦN – TIỀN CHẤT</div>
    <div class="a4-subtitle">KHO THUỐC GÂY NGHIỆN HƯỚNG THẦN</div>
    <div class="a4-date-range">Từ ngày ${fD}/${fM}/${fY} đến ${tD}/${tM}/${tY}</div>
    <div class="a4-council">
      <div>&nbsp;Hội đồng hủy vỏ gồm:</div>
      <div class="a4-council-member">-&nbsp;&nbsp;Ông Nguyễn Thành Trung&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-&nbsp;&nbsp;Chủ tịch HĐ</div>
      <div class="a4-council-member">-&nbsp;&nbsp;Bà Nguyễn Thị Phúc&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-&nbsp;&nbsp;Phó chủ tịch HĐ</div>
      <div class="a4-council-member">-&nbsp;&nbsp;Bà Trương Phạm Hoàng Quyên&nbsp;-&nbsp;&nbsp;Thành viên</div>
      <div class="a4-council-member">-&nbsp;&nbsp;Bà Nguyễn Thị Hà Giang&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-&nbsp;&nbsp;Thành viên</div>
      <div class="a4-council-member">-&nbsp;&nbsp;Ông Nguyễn Đăng Hậu&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-&nbsp;&nbsp;Thành viên</div>
      <div class="a4-council-member">-&nbsp;&nbsp;Bà Nguyễn Thị Phương Linh&nbsp;-&nbsp;&nbsp;Thành viên</div>
      <div style="margin-top:8px;">Hội đồng tiến hành hủy vỏ thuốc gây nghiện, vỏ thuốc hướng thần và tiền chất đã sử dụng như sau:</div>
    </div>
    <table class="a4-table">
      <thead><tr>
        <th style="width:6%">STT</th><th style="width:36%">Tên thuốc</th>
        <th style="width:16%">Số vỏ thực tế</th><th style="width:16%">Số lượng trả</th>
        <th style="width:18%">Số lượng sử dụng (Trên phiếu)</th><th style="width:8%">Ghi chú</th>
      </tr></thead><tbody>`;
    rows.forEach(r=>{
      html+=`<tr><td class="center">${String(r.stt).padStart(2,'0')}</td><td>${r.drug}</td><td class="center">${bbhv_fmtQty(r.thucTe)}</td><td class="center">${bbhv_fmtQty(r.traPhi)}</td><td class="center">${bbhv_fmtQty(r.xuatPhi)}</td><td></td></tr>`;
    });
    html+=`</tbody></table>
    <div class="a4-footer">
      <p style="margin-top:8px;">&nbsp;Tổng cộng: ${total.toLocaleString('vi-VN')} vỏ${total>0?' ('+totalWords+' vỏ)':''}.</p>
      <p style="margin-top:6px;">Phương pháp hủy: Đập vỡ vụn từng vỏ, phân loại và xử lý theo quy trình xử lý rác thải y tế của bệnh viện.</p>
      <div class="a4-sign-row" style="margin-top:20px;">
        <div class="a4-sign-left"><strong>Thành viên Hội đồng hủy vỏ</strong><br><em>(Ký và ghi họ tên)</em></div>
        <div class="a4-sign-right"><strong>Chủ tịch hội đồng</strong></div>
      </div>
    </div>`;
  }
  document.getElementById(`a4-${which}-preview`).innerHTML=html;
}

// ── Export Daily ──
async function exportDailyBB(){
  const chips=document.querySelectorAll('#app-bbhv .date-chip.selected');
  if(chips.length===0){showBBError('Vui lòng chọn ít nhất một ngày/nhóm ngày.');return;}
  const btn=document.getElementById('btn-export-daily'),orig=btn.innerHTML;
  btn.innerHTML='<span class="spinner">⏳</span> Đang tạo file…';btn.disabled=true;
  try{
    const res=document.getElementById('daily-results');res.innerHTML='';res.classList.remove('hidden');
    for(const chip of chips){
      const gi=parseInt(chip.dataset.groupIdx),group=_currentGroups[gi];
      const {rows,total}=aggregateForBB(group);
      if(rows.length===0)continue;
      const blob=await createDocxFile(rows,total,group[0],group[group.length-1],false);
      const fname=buildFilename(group[0],group[group.length-1]);
      docxDownload(blob,fname);
      const item=document.createElement('div');item.className='result-item';
      item.innerHTML=`<div class="result-item-dot"></div><div><div class="result-item-name">✅ ${fname}</div><div class="result-item-meta">${rows.length} loại thuốc · ${total} vỏ</div></div>`;
      res.appendChild(item);
    }
  }catch(e){console.error(e);showBBError('Lỗi tạo file: '+e.message);}
  finally{btn.innerHTML=orig;btn.disabled=false;}
}

// ── Export Monthly ──
async function exportMonthlyBB(){
  const fv=document.getElementById('bb-month-from').value,tv=document.getElementById('bb-month-to').value;
  let filt=allDatesList;
  if(fv)filt=filt.filter(d=>d>=fv);
  if(tv)filt=filt.filter(d=>d<=tv);
  if(filt.length===0){showBBError('Không có dữ liệu trong khoảng thời gian đã chọn.');return;}
  const btn=document.getElementById('btn-export-monthly'),orig=btn.innerHTML;
  btn.innerHTML='<span class="spinner">⏳</span> Đang tạo file…';btn.disabled=true;
  try{
    const {rows,total}=aggregateForBB(filt);
    if(rows.length===0){showBBError('Không có dữ liệu thuốc.');return;}
    const blob=await createDocxFile(rows,total,filt[0],filt[filt.length-1],true);
    docxDownload(blob,buildFilenameMonthly(filt[0],filt[filt.length-1]));
  }catch(e){console.error(e);showBBError('Lỗi tạo file: '+e.message);}
  finally{btn.innerHTML=orig;btn.disabled=false;}
}

function buildFilename(df,dt){
  const[fy,fm,fd]=df.split('-');
  if(df===dt)return`BB huy vo_Ngay ${fd}-${fm}-${fy}.docx`;
  const[ty,tm,td]=dt.split('-');
  return`BB huy vo_Ngay ${fd}-${fm}-${fy} den ${td}-${tm}-${ty}.docx`;
}
function buildFilenameMonthly(df,dt){
  const[fy,fm,fd]=df.split('-'),[ty,tm,td]=dt.split('-');
  if(fm===tm&&fy===ty)return`BB huy vo_Thang ${fm}-${fy}.docx`;
  return`BB huy vo_Tu ${fd}-${fm}-${fy} den ${td}-${tm}-${ty}.docx`;
}
function showBBError(msg){
  document.getElementById('bb-error-text').textContent=msg;
  const eb=document.getElementById('bb-error-box');eb.classList.remove('hidden');
  setTimeout(()=>eb.classList.add('hidden'),5000);
}

// ── CREATE DOCX ──
async function createDocxFile(rows,total,dateFrom,dateTo,isMonthly){
  const D=window.docx;
  if(!D)throw new Error('Thư viện docx chưa tải. Kiểm tra kết nối internet.');
  const [fY,fM,fD]=dateFrom.split('-'),[tY,tM,tD]=dateTo.split('-');
  const signDate=`Ngày ${parseInt(tD)} tháng ${parseInt(tM)} năm ${tY}`;
  const totalWords=numberToVietnamese(total);
  const CM=567,PAGE_W=11906,MARG={top:2*CM,right:2*CM,bottom:2*CM,left:3*CM};
  const CW=PAGE_W-MARG.left-MARG.right;
  const{Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,AlignmentType,BorderStyle,WidthType,VerticalAlign,TableLayoutType}=D;
  const T=(text,o={})=>new TextRun({text,font:'Times New Roman',size:26,...o});
  const P=(ch,o={})=>new Paragraph({children:ch,spacing:{before:0,after:40,line:276,lineRule:'auto'},...o});
  const thin={style:BorderStyle.SINGLE,size:4,color:'000000'};
  const aB={top:thin,bottom:thin,left:thin,right:thin};
  const nB={style:BorderStyle.NONE,size:0,color:'FFFFFF'};
  const nBs={top:nB,bottom:nB,left:nB,right:nB};
  const Tc=(ch,w,o={})=>new TableCell({borders:aB,width:{size:w,type:WidthType.DXA},margins:{top:60,bottom:60,left:80,right:80},verticalAlign:VerticalAlign.CENTER,children:ch,...o});
  const TcN=(ch,w,o={})=>new TableCell({borders:nBs,width:{size:w,type:WidthType.DXA},children:ch,...o});
  let children=[];

  if(isMonthly){
    const hw=Math.round(CW/2);
    children.push(new Table({width:{size:CW,type:WidthType.DXA},columnWidths:[hw,CW-hw],layout:TableLayoutType.FIXED,rows:[new TableRow({children:[
      TcN([P([T('SỞ Y TẾ TP ĐÀ NẴNG',{bold:true})],{alignment:AlignmentType.CENTER,spacing:{before:0,after:0}}),P([T('BỆNH VIỆN ĐÀ NẴNG',{bold:true})],{alignment:AlignmentType.CENTER,spacing:{before:0,after:0}}),P([T('─────────────────',{size:18})],{alignment:AlignmentType.CENTER,spacing:{before:0,after:0}})],hw),
      TcN([P([T('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM',{bold:true})],{alignment:AlignmentType.CENTER,spacing:{before:0,after:0}}),P([T('Độc lập – Tự do – Hạnh phúc',{bold:true})],{alignment:AlignmentType.CENTER,spacing:{before:0,after:0}}),P([T('─────────────────────────',{size:18})],{alignment:AlignmentType.CENTER,spacing:{before:0,after:0}})],CW-hw),
    ]})]})
    );
    children.push(P([T('BIÊN BẢN HUỶ VỎ',{bold:true,size:28})],{alignment:AlignmentType.CENTER,spacing:{before:240,after:40}}));
    children.push(P([T('THUỐC GÂY NGHIỆN, THUỐC HƯỚNG THẦN VÀ TIỀN CHẤT',{bold:true})],{alignment:AlignmentType.CENTER}));
    children.push(P([T('KHO THUỐC NỘI TRÚ',{bold:true})],{alignment:AlignmentType.CENTER}));
    children.push(P([T(`Từ ${fD}/${fM}/${fY} đến ${tD}/${tM}/${tY}`,{italics:true})],{alignment:AlignmentType.CENTER,spacing:{before:0,after:160}}));
    children.push(P([T('Hội đồng huỷ vỏ gồm:')]));
    ['1.	Ông Nguyễn Thành Trung		- Phó Giám đốc			- Chủ tịch HĐ',
     '2.	Bà Nguyễn Thị Phúc			- TP. Điều dưỡng		- Phó CT HĐ',
     '3.	Bà Trương Phạm Hoàng Quyên	- TP. KHTH				- Thư ký',
     '4.	Ông Thái Bá Sỹ				- TP.TCCB, TBTTND		- Thành viên',
     '5.	Ông Huỳnh Đức Phát			- TK. PT-GMHS			- Thành viên',
     '6.	Bà Vũ Thị Thu Hiền			- TK. KSNK				- Thành viên',
     '7.	Bà Nguyễn Thị Hà Giang		- PTK. Dược				- Thành viên',
     '8.	Ông Trần Thanh Liêm			- PTP. Điều dưỡng		- Thành viên',
     '9.	Bà Nguyễn Thị Phương Linh	- Khoa PT-GMHS			- Thành viên',
     '10.	Ông Nguyễn Đăng Hậu			- Khoa Dược				- Thành viên',
     '11.	Bà Lê Nhật Phương				- Khoa Dược				- Thành viên',
    ].forEach(l=>children.push(P([T(l)])));
    children.push(P([T('Tiến hành huỷ vỏ thuốc gây nghiện, thuốc hướng thần và tiền chất như sau:')],{spacing:{before:100,after:80}}));
    const cw=[450,3100,520,1200,1200,1700,902];
    children.push(new Table({width:{size:CW,type:WidthType.DXA},columnWidths:cw,layout:TableLayoutType.FIXED,rows:[
      new TableRow({tableHeader:true,children:[
        Tc([P([T('Stt',{bold:true})],{alignment:AlignmentType.CENTER})],cw[0]),
        Tc([P([T('Tên thuốc, nồng độ, ',{bold:true})]),P([T('hàm lượng',{bold:true})])],cw[1]),
        Tc([P([T('ĐVT',{bold:true})],{alignment:AlignmentType.CENTER})],cw[2]),
        Tc([P([T('Số vỏ thực tế',{bold:true})],{alignment:AlignmentType.CENTER})],cw[3]),
        Tc([P([T('Số lượng trả',{bold:true})],{alignment:AlignmentType.CENTER})],cw[4]),
        Tc([P([T('Số lượng sử dụng ',{bold:true})]),P([T('(Trên phiếu)',{bold:true})])],cw[5]),
        Tc([P([T('Ghi chú',{bold:true})],{alignment:AlignmentType.CENTER})],cw[6]),
      ]}),
      ...rows.map(r=>new TableRow({children:[
        Tc([P([T(String(r.stt).padStart(2,'0'))],{alignment:AlignmentType.CENTER})],cw[0]),
        Tc([P([T(r.drug)])],cw[1]),
        Tc([P([T('vỏ')],{alignment:AlignmentType.CENTER})],cw[2]),
        Tc([P([T(String(r.thucTe).padStart(2,'0'))],{alignment:AlignmentType.CENTER})],cw[3]),
        Tc([P([T(r.traPhi>0?String(r.traPhi).padStart(2,'0'):'00')],{alignment:AlignmentType.CENTER})],cw[4]),
        Tc([P([T(String(r.xuatPhi).padStart(2,'0'))],{alignment:AlignmentType.CENTER})],cw[5]),
        Tc([P([T('')])],cw[6]),
      ]}))
    ]}));
    children.push(P([T(`Tổng cộng: ${total.toLocaleString('vi-VN')} vỏ (${totalWords} vỏ).`)],{spacing:{before:120,after:60}}));
    children.push(P([T('Phương pháp hủy: Đập vỡ vụn từng vỏ, phân loại và xử lý theo quy trình xử lý rác thải y tế của bệnh viện.')],{spacing:{before:0,after:160}}));
    children.push(P([T(signDate,{italics:true})],{alignment:AlignmentType.RIGHT,spacing:{before:0,after:160}}));
    const sw1=Math.round(CW*0.62),sw2=CW-sw1;
    children.push(new Table({width:{size:CW,type:WidthType.DXA},columnWidths:[sw1,sw2],layout:TableLayoutType.FIXED,rows:[new TableRow({children:[
      TcN([P([T('Thành viên Hội đồng hủy vỏ',{bold:true})],{alignment:AlignmentType.CENTER}),P([T('(Ký và ghi họ tên)',{italics:true})],{alignment:AlignmentType.CENTER}),P([T('')],{spacing:{before:800,after:0}})],sw1),
      TcN([P([T('Chủ tịch hội đồng',{bold:true})],{alignment:AlignmentType.CENTER}),P([T('PHÓ GIÁM ĐỐC',{bold:true})],{alignment:AlignmentType.CENTER}),P([T('Nguyễn Thành Trung',{bold:true})],{alignment:AlignmentType.CENTER}),P([T('')],{spacing:{before:800,after:0}})],sw2),
    ]})]})
    );
  }else{
    children.push(P([T('BIÊN BẢN HỦY THUỐC GÂY NGHIỆN – HƯỚNG THẦN – TIỀN CHẤT',{bold:true,size:26})],{alignment:AlignmentType.CENTER,spacing:{before:0,after:40}}));
    children.push(P([T('KHO THUỐC GÂY NGHIỆN HƯỚNG THẦN',{bold:true})],{alignment:AlignmentType.CENTER}));
    children.push(P([T(`Từ ngày ${fD}/${fM}/${fY} đến ${tD}/${tM}/${tY}`,{italics:true})],{alignment:AlignmentType.CENTER,spacing:{before:0,after:140}}));
    children.push(P([T(' Hội đồng hủy vỏ gồm:')]));
    ['-	Ông Nguyễn Thành Trung			-	Chủ tịch HĐ',
     '-	Bà Nguyễn Thị Phúc 				-	Phó chủ tịch HĐ ',
     '-	Bà Trương Phạm Hoàng Quyên	-	Thành viên',
     '-	Bà Nguyễn Thị Hà Giang			-	Thành viên',
     '-	Ông Nguyễn Đăng Hậu			-	Thành viên',
     '-	Bà Nguyễn Thị Phương Linh		-	Thành viên',
    ].forEach(l=>children.push(P([T(l)])));
    children.push(P([T('Hội đồng tiến hành hủy vỏ thuốc gây nghiện, vỏ thuốc hướng thần và tiền chất đã sử dụng như sau:')],{spacing:{before:100,after:80}}));
    const cw2=[450,3650,1400,1400,1700,472];
    children.push(new Table({width:{size:CW,type:WidthType.DXA},columnWidths:cw2,layout:TableLayoutType.FIXED,rows:[
      new TableRow({tableHeader:true,children:[
        Tc([P([T('STT',{bold:true})],{alignment:AlignmentType.CENTER})],cw2[0]),
        Tc([P([T('Tên thuốc',{bold:true})])],cw2[1]),
        Tc([P([T('Số vỏ',{bold:true})]),P([T('thực tế',{bold:true})])],cw2[2]),
        Tc([P([T('Số lượng',{bold:true})]),P([T('trả',{bold:true})])],cw2[3]),
        Tc([P([T('Số lượng sử dụng',{bold:true})]),P([T('(Trên phiếu)',{bold:true})])],cw2[4]),
        Tc([P([T('Ghi chú',{bold:true})],{alignment:AlignmentType.CENTER})],cw2[5]),
      ]}),
      ...rows.map(r=>new TableRow({children:[
        Tc([P([T(String(r.stt).padStart(2,'0'))],{alignment:AlignmentType.CENTER})],cw2[0]),
        Tc([P([T(r.drug)])],cw2[1]),
        Tc([P([T(String(r.thucTe).padStart(2,'0'))],{alignment:AlignmentType.CENTER})],cw2[2]),
        Tc([P([T(String(r.traPhi).padStart(2,'0'))],{alignment:AlignmentType.CENTER})],cw2[3]),
        Tc([P([T(String(r.xuatPhi).padStart(2,'0'))],{alignment:AlignmentType.CENTER})],cw2[4]),
        Tc([P([T('')])],cw2[5]),
      ]}))
    ]}));
    children.push(P([T(` Tổng cộng: ${total.toLocaleString('vi-VN')} vỏ${total>0?' ('+totalWords+' vỏ)':''}.`)],{spacing:{before:120,after:60}}));
    children.push(P([T('Phương pháp hủy: Đập vỡ vụn từng vỏ, phân loại và xử lý theo quy trình xử lý rác thải y tế của bệnh viện.')],{spacing:{before:0,after:200}}));
    const sw1=Math.round(CW*0.62),sw2=CW-sw1;
    children.push(new Table({width:{size:CW,type:WidthType.DXA},columnWidths:[sw1,sw2],layout:TableLayoutType.FIXED,rows:[new TableRow({children:[
      TcN([P([T('Thành viên Hội đồng hủy vỏ',{bold:true})],{alignment:AlignmentType.CENTER}),P([T(' (Ký và ghi họ tên)',{italics:true})],{alignment:AlignmentType.CENTER}),P([T('')],{spacing:{before:800,after:0}})],sw1),
      TcN([P([T('Chủ tịch hội đồng',{bold:true})],{alignment:AlignmentType.CENTER}),P([T('')],{spacing:{before:800,after:0}})],sw2),
    ]})]})
    );
  }
  const doc=new Document({sections:[{properties:{page:{size:{width:PAGE_W,height:16838},margin:MARG}},children}]});
  return await Packer.toBlob(doc);
}







// ═══ APP 2: THE KHO JS ═══

// ═══════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════
// Variables declared in shared.js:
// xuatWB, nhapWB, tonWB, allXuat, allNhap, drugMap, tonMap, selectedMa, processedOK

// ── Hiển thị số lượng: 1-9 → 01-09, ≥10 bình thường ──
function fmtQty(n) {
  if (n === 0 || n === '' || n === null || n === undefined) return '';
  const num = Number(n);
  if (isNaN(num)) return String(n);
  return num > 0 && num < 10 ? String(num).padStart(2, '0') : num.toLocaleString('vi-VN');
}
function fmtQtyAlways(n) {
  // Dùng cho cột Tồn — luôn hiện kể cả 0
  const num = Number(n);
  if (isNaN(num)) return String(n);
  return num >= 0 && num < 10 ? String(num).padStart(2, '0') : num.toLocaleString('vi-VN');
}

// Loại chứng từ phân loại
const XUAT_TYPES = ['Chuyển kho','Xuất chuyển kho','Xuất tủ trực','Xuất thuốc đến tủ trực','Xuất kho đến tủ trực'];
const NHAP_TYPES = ['Nhập kho','Trả thuốc theo yêu cầu','Trả thuốc từ tủ trực','Nhập kho từ tủ trực','Nhập tủ trực','Xuất chuyển kho'];
const TRA_TYPES  = ['Trả thuốc theo yêu cầu','Trả thuốc từ tủ trực','Nhập kho từ tủ trực'];
const TU_TRUC_XUAT = ['Xuất tủ trực','Xuất thuốc đến tủ trực','Xuất kho đến tủ trực'];
const TU_TRUC_NHAP = ['Trả thuốc từ tủ trực','Nhập kho từ tủ trực','Nhập tủ trực'];

// ═══════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════
function goScreen(id) {
  document.querySelectorAll('#app-tk .screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if(id==='sc-the-kho') setTimeout(scaleA4, 80);
  if(id==='sc-bbkk') setTimeout(scaleBBKK, 80);
}

// ═══════════════════════════════════════════════════════
// UPLOAD SETUP
// ═══════════════════════════════════════════════════════

// ── Realtime: khi load file ở BBHV → chia sẻ với TK ──
const _orig_bbhv_load = typeof bbhv_loadFile !== 'undefined' ? bbhv_loadFile : null;

function bbhv_onFileLoaded(type) {
  // Sync file xuất/nhập sang TK module
  if (type === 'xuat' && typeof xuatWB_bbhv !== 'undefined') {
    xuatWB = xuatWB_bbhv; // share với TK
  }
  if (type === 'nhap' && typeof nhapWB_bbhv !== 'undefined') {
    nhapWB = nhapWB_bbhv; // share với TK
  }
  // Nếu đã có cả 2 → auto process TK
  if (xuatWB && nhapWB) shared_onBothFilesLoaded();
}
