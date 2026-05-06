// ═══════════════════════════════════════════════════════════
// UTILS — Tiện ích chung (layout, mobile detection)
// ═══════════════════════════════════════════════════════════

function isMobileBrowser() {
  return /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent)
    || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);
}

// Universal blob downloader — works on mobile AND desktop
function mobileDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  
  // Always try direct anchor first (works on desktop + some mobile)
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  
  let clicked = false;
  try {
    a.click();
    clicked = true;
  } catch(e) {}
  document.body.removeChild(a);

  // On mobile, also show the modal as a fallback (user may need to tap)
  if (isMobileBrowser()) {
    showDLModal(url, filename);
  } else {
    // Desktop: revoke after delay
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}

// XLSX workbook → blob download
function xlsxDownload(wb, filename) {
  // wb can be a real workbook or {_raw: blob}
  let blob;
  if (wb && wb._raw instanceof Blob) {
    blob = wb._raw;
  } else {
    const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
    blob = new Blob([wbout], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  mobileDownload(blob, filename);
}

// DOCX blob download (replaces saveAs)
function docxDownload(blob, filename) {
  mobileDownload(blob, filename);
}

// PDF / print content — show in modal iframe instead of window.open
function mobilePrint(htmlContent, title) {
  if (isMobileBrowser()) {
    // Show in modal with print button
    document.getElementById('pdf-modal-title').textContent = title || 'Xem trước & In';
    const frame = document.getElementById('pdf-modal-frame');
    frame.srcdoc = htmlContent;
    const modal = document.getElementById('pdf-modal');
    modal.style.display = 'flex';
    modal.onclick = null; // prevent close on backdrop
  } else {
    // Desktop: open in new window and print
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(htmlContent);
      win.document.close();
      setTimeout(() => win.print(), 400);
    } else {
      // Popup blocked on desktop too — show modal
      document.getElementById('pdf-modal-title').textContent = title || 'Xem trước & In';
      const frame = document.getElementById('pdf-modal-frame');
      frame.srcdoc = htmlContent;
      document.getElementById('pdf-modal').style.display = 'flex';
    }
  }
}

function showDLModal(url, filename) {
  const modal = document.getElementById('dl-modal');
  const link  = document.getElementById('dl-modal-link');
  const fname = document.getElementById('dl-modal-fname');
  const ext   = filename.split('.').pop().toUpperCase();
  const isExcel = ['XLSX','XLS','CSV'].includes(ext);
  const isDocx  = ext === 'DOCX';
  link.href = url;
  link.download = filename;
  link.querySelector('span:first-child').textContent = isExcel ? '📊' : isDocx ? '📝' : '⬇️';
  fname.textContent = filename;
  document.getElementById('dl-modal-title').textContent = 
    isExcel ? 'Tải file Excel' : isDocx ? 'Tải file Word (.docx)' : 'Tải file';
  document.getElementById('dl-modal-sub').textContent = 
    'Nhấn và giữ nút bên dưới → chọn "Tải về" (Download)';
  modal.style.display = 'flex';
  // Auto-cleanup URL when modal closed
  modal._currentUrl = url;
}

function closeDLModal() {
  const modal = document.getElementById('dl-modal');
  modal.style.display = 'none';
  if (modal._currentUrl) {
    setTimeout(() => URL.revokeObjectURL(modal._currentUrl), 500);
    modal._currentUrl = null;
  }
}

function closePDFModal() {
  document.getElementById('pdf-modal').style.display = 'none';
  document.getElementById('pdf-modal-frame').srcdoc = '';
}

// Close modals on backdrop tap
document.getElementById('dl-modal').addEventListener('click', function(e) {
  if (e.target === this) closeDLModal();
});

function initLayout() {
  // Mobile bottom nav
  const isMob = isMobileBrowser();
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.style.display = isMob ? 'flex' : 'none';
  // Sidebar
  const sb = document.getElementById('sidebar');
  if (sb) sb.style.display = isMob ? 'none' : 'flex';
  switchApp(1);
}
