// ═══════════════════════════════════════════════════════════
// SHARED STATE — dùng chung cho BBHV, Thẻ kho, TT20
// ═══════════════════════════════════════════════════════════

// ── App state ──
let currentApp = 1;

// ── BBHV shared ──
let xuatWB_bbhv = null, nhapWB_bbhv = null;
// (BBHV dùng biến riêng trong module-bbhv.js)

// ── TK shared (xuất nhập dùng chung với BBHV) ──
let xuatWB = null, nhapWB = null, tonWB = null;
let drugMap = {}, tonMap = {}, allXuat = [], allNhap = [];
let selectedMa = null, processedOK = false;

// ── GitHub sync config ──
let ghToken = '', ghRepo = '';

// ═══════════════════════════════════════════════════════════
// GITHUB SYNC — lưu/tải BBKK data lên GitHub repo
// Đặc biệt hữu ích khi đổi máy tính thường xuyên
// ═══════════════════════════════════════════════════════════

function gh_loadConfig() {
  try {
    const cfg = JSON.parse(localStorage.getItem('kho_gh_cfg') || '{}');
    ghToken = cfg.token || '';
    ghRepo  = cfg.repo  || '';

    // Pre-fill input fields if they exist
    const tokenEl = document.getElementById('gh-token');
    const repoEl  = document.getElementById('gh-repo');
    if (tokenEl && ghToken) tokenEl.value = ghToken;
    if (repoEl  && ghRepo)  repoEl.value  = ghRepo;

    const el = document.getElementById('gh-status');
    if (el) {
      if (ghToken && ghRepo) {
        el.textContent = '✅ Đã cấu hình: ' + ghRepo;
        el.style.color = '#2e7d32';
        el.style.display = '';
      } else {
        el.textContent = '⚠️ Chưa cấu hình — nhập Token + Repo bên dưới';
        el.style.color = '#f57c00';
        el.style.display = '';
      }
    }
  } catch(e) {}
}

function gh_saveConfig() {
  const token = document.getElementById('gh-token').value.trim();
  const repo  = document.getElementById('gh-repo').value.trim();
  if (!token || !repo) { alert('Vui lòng nhập đủ Token và Repo!'); return; }
  if (!repo.includes('/')) { alert('Repo phải có dạng: owner/repo-name'); return; }
  localStorage.setItem('kho_gh_cfg', JSON.stringify({ token, repo }));
  ghToken = token; ghRepo = repo;
  const el = document.getElementById('gh-status');
  if (el) { el.textContent = '✅ Đã lưu: ' + repo; el.style.color = '#2e7d32'; }
  alert('✅ Đã lưu cấu hình GitHub!\nTừ nay mọi trình duyệt/máy tính đều có thể đồng bộ dữ liệu.');
}

async function gh_getFileSHA(path) {
  // Lấy SHA của file để cập nhật (PUT cần SHA nếu file đã tồn tại)
  try {
    const r = await fetch(
      `https://api.github.com/repos/${ghRepo}/contents/${path}`,
      { headers: { Authorization: `token ${ghToken}`, Accept: 'application/vnd.github.v3+json' } }
    );
    if (r.ok) { const d = await r.json(); return d.sha || ''; }
    return '';
  } catch(e) { return ''; }
}

async function gh_pushFile(path, content_str, commitMsg) {
  // Push 1 file lên GitHub (create hoặc update)
  const sha = await gh_getFileSHA(path);
  const b64 = btoa(unescape(encodeURIComponent(content_str)));
  const body = { message: commitMsg, content: b64 };
  if (sha) body.sha = sha;
  const r = await fetch(
    `https://api.github.com/repos/${ghRepo}/contents/${path}`,
    { method: 'PUT', headers: { Authorization: `token ${ghToken}`, Accept: 'application/vnd.github.v3+json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
  );
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(`HTTP ${r.status}: ${err.message || 'Unknown error'}`);
  }
  return await r.json();
}

async function gh_pullFile(path) {
  // Kéo file từ GitHub về, trả về nội dung string
  const r = await fetch(
    `https://api.github.com/repos/${ghRepo}/contents/${path}`,
    { headers: { Authorization: `token ${ghToken}`, Accept: 'application/vnd.github.v3+json', 'Cache-Control': 'no-cache' } }
  );
  if (!r.ok) throw new Error(`File không tồn tại: ${path} (HTTP ${r.status})`);
  const d = await r.json();
  // GitHub trả về base64, decode về UTF-8
  return decodeURIComponent(escape(atob(d.content.replace(/\n/g, ''))));
}

function gh_showStatus(elId, msg, ok) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = msg;
  el.style.color = ok ? '#2e7d32' : '#c62828';
  el.style.display = '';
}

// ── Lưu BBKK data lên GitHub ──
async function gh_pushBBKK() {
  if (!ghToken || !ghRepo) {
    alert('Chưa cấu hình GitHub!\nVào phần ☁️ GitHub Sync để cấu hình trước.');
    return;
  }
  if (!processedOK) { alert('Chưa có dữ liệu! Hãy xử lý file xuất/nhập trước.'); return; }

  const month = getBBKKMonth();
  const data  = getBBKKData();
  const payload = {
    month,
    savedAt : new Date().toISOString(),
    version : '3.8',
    data    : data.map(r => ({
      ma   : r.ma,
      ten  : r.ten,
      hl   : r.hl,
      dvt  : r.dvt || '',
      ton  : r.ton,
      lo   : r.lo  || '',
      han  : r.han  || '',
      hangSX: r.hangSX || '',
      dongia: r.dongia || 0,
    }))
  };

  const [m, y] = month ? month.split('/') : ['00', '0000'];
  const path = `bbkk-data/T${m}_${y}.json`;
  gh_showStatus('gh-bbkk-status', '⏳ Đang lưu...', true);
  try {
    await gh_pushFile(path, JSON.stringify(payload, null, 2),
      `BBKK tháng ${month} — ${new Date().toLocaleString('vi')}`);
    gh_showStatus('gh-bbkk-status', `✅ Đã lưu BBKK tháng ${month} lên GitHub!`, true);
    localStorage.setItem('kho_bbkk_last_push', JSON.stringify({ month, path, savedAt: payload.savedAt }));
  } catch(e) {
    gh_showStatus('gh-bbkk-status', '❌ Lỗi: ' + e.message, false);
  }
}

// ── Tải BBKK data từ GitHub ──
async function gh_pullBBKK() {
  if (!ghToken || !ghRepo) {
    alert('Chưa cấu hình GitHub!\nVào phần ☁️ GitHub Sync để cấu hình trước.');
    return;
  }
  const month = prompt(
    'Nhập tháng cần tải (MM/YYYY):',
    getBBKKMonth() || (new Date().toLocaleDateString('vi', {month:'2-digit', year:'numeric'}))
  );
  if (!month) return;
  const [m, y] = month.split('/');
  const path = `bbkk-data/T${m}_${y}.json`;
  gh_showStatus('gh-bbkk-status', '⏳ Đang tải...', true);
  try {
    const str  = await gh_pullFile(path);
    const json = JSON.parse(str);
    // Lưu vào localStorage để dùng làm tồn đầu kỳ
    localStorage.setItem(`kho_bbkk_${m}_${y}`, str);
    localStorage.setItem('kho_bbkk_prev', str);
    gh_showStatus('gh-bbkk-status',
      `✅ Đã tải BBKK tháng ${json.month} — ${json.data.length} mặt hàng. Lưu vào localStorage.`, true);
    alert(`✅ Đã tải dữ liệu BBKK tháng ${json.month}\n${json.data.length} mặt hàng\nLưu lúc: ${new Date(json.savedAt).toLocaleString('vi')}\n\nDữ liệu này sẽ được dùng làm Tồn đầu kỳ cho BBXNT tháng tiếp theo.`);
  } catch(e) {
    gh_showStatus('gh-bbkk-status', '❌ Lỗi: ' + e.message, false);
  }
}

// ── Lấy tồn đầu kỳ từ BBKK tháng trước (đã tải về localStorage) ──
function gh_getPrevTon(ma) {
  try {
    const raw  = localStorage.getItem('kho_bbkk_prev');
    if (!raw) return null;
    const json = JSON.parse(raw);
    const row  = (json.data || []).find(r => r.ma === ma || r.ten === ma);
    return row ? (row.ton || 0) : null;
  } catch(e) { return null; }
}

// ═══════════════════════════════════════════════════════════
// APP LAYOUT — switch giữa BBHV / TK / TT20
// ═══════════════════════════════════════════════════════════

function switchApp(n) {
  currentApp = n;
  document.querySelectorAll('.app-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('app-' + ['bbhv','tk','tt20'][n-1]).classList.add('active');
  document.querySelectorAll('.u-nb').forEach(b => b.classList.remove('active'));
  const unb = document.getElementById('unb-' + n);
  if (unb) unb.classList.add('active');
  document.querySelectorAll('.sidebar-btn[id^="sb-"]').forEach(b => {
    if (['sb-1','sb-2','sb-3'].includes(b.id)) b.classList.remove('active');
  });
  const sb = document.getElementById('sb-' + n);
  if (sb) sb.classList.add('active');
  updateSidebarSub(n);
}

function updateSidebarSub(n) {
  document.querySelectorAll('.sidebar-sub').forEach(s => s.style.display = 'none');
  const sub = document.getElementById('sidebar-sub-' + n);
  if (sub) sub.style.display = '';
}

// ═══════════════════════════════════════════════════════════
// REALTIME INTEGRATION
// Khi cả 2 file Xuất + Nhập đã load → tự xử lý ở cả 2 module
// ═══════════════════════════════════════════════════════════
function shared_onBothFilesLoaded() {
  // Delay nhỏ để tránh race condition
  setTimeout(() => {
    // Trigger TK processing nếu đang ở app TK
    if (typeof processData === 'function') {
      try { processData(); } catch(e) { console.warn('TK auto-process:', e); }
    }
  }, 100);
}

// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  // Slight delay so all modules are fully parsed first
  setTimeout(() => {
    gh_loadConfig();
    if (typeof initLayout === 'function') initLayout();
  if (typeof bbhv_setupDZ === 'function') bbhv_setupDZ();
  if (typeof tk_setupDZ === 'function') tk_setupDZ();
    if (typeof tt20_loadFile !== 'undefined') {
      const inp = document.getElementById('tt20-file');
      if (inp) inp.addEventListener('change', e => tt20_loadFile(e.target.files[0]));
    }
  }, 50);
});
