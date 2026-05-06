// ═══════════════════════════════════════════════════════════
// MODULE TT20 — Tra cứu danh mục TT20
// ═══════════════════════════════════════════════════════════

function normalizeHC(s){
  if(!s) return '';
  return s.toLowerCase().trim()
    .replace(/\s+/g,' ')
    .replace(/[()]/g,'');
}

function normalizeDuongDung(s){
  if(!s) return new Set();
  s = s.toLowerCase().replace(/\n/g,' ').replace(/\s+/g,' ').trim();
  const tokens = new Set();
  if(/tiêm|truyền|tiêm truyền|tiêm\/truyền|tĩnh mạch|tiêm bắp|tiêm dưới da/.test(s)) tokens.add('tiêm');
  if(/uống|ngậm|nhai/.test(s)) tokens.add('uống');
  if(/nhỏ mắt|tra mắt/.test(s)) tokens.add('nhỏ mắt');
  if(/nhỏ mũi|xịt mũi/.test(s)) tokens.add('nhỏ mũi');
  if(/nhỏ tai/.test(s)) tokens.add('nhỏ tai');
  if(/hô hấp|hít|khí dung|khí nén|đường miệng/.test(s)) tokens.add('hô hấp');
  if(/dùng ngoài|bôi|dán ngoài da|xoa/.test(s)) tokens.add('dùng ngoài');
  if(/đặt|thụt/.test(s)) tokens.add('đặt');
  if(/màng bụng|thẩm phân/.test(s)) tokens.add('màng bụng');
  if(tokens.size === 0) tokens.add(s.split(',')[0].trim());
  return tokens;
}

function setsIntersect(a, b){
  for(const x of a) if(b.has(x)) return true;
  return false;
}

// =====================================================
// TÌM STT TT20 CHO MỘT THUỐC
// =====================================================
function findTT20(hoatChat, duongDung){
  if(!hoatChat) return null;
  const hcNorm = normalizeHC(hoatChat);
  const ddTokens = normalizeDuongDung(duongDung);

  // 1. Exact match hoat chat
  const candidates = lookupMap.get(hcNorm);
  if(candidates){
    // 1a. Match cả đường dùng
    for(const rec of candidates){
      if(setsIntersect(ddTokens, normalizeDuongDung(rec.duong_dung))){
        return rec;
      }
    }
    // 1b. Chỉ match hoạt chất (trả về đầu tiên, warning)
    return { ...candidates[0], partial: true };
  }

  // 2. Fuzzy: hoạt chất BV có thể dài hơn (vd: "Clopidogrel (tương đương...)")
  const hcShort = hcNorm.split('(')[0].trim().split('tương đương')[0].trim();
  for(const [key, recs] of lookupMap){
    if(key.startsWith(hcShort) || hcShort.startsWith(key)){
      for(const rec of recs){
        if(setsIntersect(ddTokens, normalizeDuongDung(rec.duong_dung))){
          return { ...rec, fuzzy: true };
        }
      }
      return { ...recs[0], fuzzy: true, partial: true };
    }
  }
  return null;
}

// =====================================================
// FILE HANDLING
// =====================================================
let workbookData = null;

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

dropZone.addEventListener('dragover', e=>{e.preventDefault();dropZone.classList.add('drag-over')});
dropZone.addEventListener('dragleave', ()=>dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e=>{
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const f = e.dataTransfer.files[0];
  if(f && f.name.endsWith('.xlsx')) tt20_loadFile(f);
  else alert('Vui lòng chọn file .xlsx');
});
fileInput.addEventListener('change', ()=>{
  if(fileInput.files[0]) tt20_loadFile(fileInput.files[0]);
});

function tt20_loadFile(file){
  const reader = new FileReader();
  reader.onload = e=>{
    workbookData = new Uint8Array(e.target.result);
    dropZone.classList.add('file-selected');
    document.getElementById('dropText').textContent = '✅ ' + file.name;
    document.getElementById('processBtn').disabled = false;
  };
  reader.readAsArrayBuffer(file);
}

// =====================================================
// XỬ LÝ CHÍNH
// =====================================================
function processFile(){
  if(!workbookData){ alert('Vui lòng chọn file trước!'); return; }

  const pb = document.getElementById('progressBar');
  const pf = document.getElementById('progressFill');
  pb.style.display = 'block';
  pf.style.width = '20%';

  setTimeout(()=>{
    try{
      const wb = XLSX.read(workbookData, {type:'array'});
      pf.style.width = '40%';

      // Tìm sheet Phụ lục I
      const sheetName = wb.SheetNames.find(s=>s.includes('Phụ lục I') || s.includes('Phu luc I')) || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];

      // Chuyển sang JSON để xử lý, giữ raw để rebuild
      const rawData = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      pf.style.width = '60%';

      // Tìm header row (row chứa 'STT' và 'TT20')
      let headerRowIdx = -1;
      let colSTT = -1, colTT20 = -1, colHC = -1, colDD = -1, colLuuY = -1;

      for(let i=0; i<rawData.length; i++){
        const row = rawData[i];
        const rowStr = row.map(c=>String(c).toLowerCase());
        const sttIdx = rowStr.findIndex(c=>c==='stt');
        const tt20Idx = rowStr.findIndex(c=>c.includes('tt20'));
        if(sttIdx>=0 && tt20Idx>=0){
          headerRowIdx = i;
          colSTT = sttIdx;
          colTT20 = tt20Idx;
          // Tìm cột Tên hoạt chất
          colHC = rowStr.findIndex(c=>c.includes('hoạt chất') || c.includes('hoat chat'));
          // Tìm cột Đường dùng
          colDD = rowStr.findIndex(c=>c.includes('đường dùng') || c.includes('duong dung'));
          // Tìm cột Lưu ý
          colLuuY = rowStr.findIndex(c=>c.includes('lưu ý') || c.includes('luu y'));
          break;
        }
      }

      if(headerRowIdx < 0){
        tt20_showError('Không tìm thấy header! Đảm bảo file có dòng tiêu đề chứa STT, TT20, Tên hoạt chất, Đường dùng.');
        pb.style.display='none';
        return;
      }

      let matched=0, fuzzy=0, notFound=0;
      const notFoundList = [];

      // Xử lý từng dòng dữ liệu
      for(let i=headerRowIdx+1; i<rawData.length; i++){
        const row = rawData[i];
        const stt = row[colSTT];
        if(!stt || String(stt).trim()==='') continue;

        const hoatChat = String(row[colHC]||'').trim();
        const duongDung = String(row[colDD]||'').trim();

        const result = findTT20(hoatChat, duongDung);
        if(result){
          rawData[i][colTT20] = result.stt;
          if(colLuuY >= 0 && result.luu_y){
            rawData[i][colLuuY] = result.luu_y;
          }
          if(result.fuzzy || result.partial) fuzzy++;
          else matched++;
        } else {
          notFound++;
          notFoundList.push({stt: String(stt), hoatChat, duongDung});
        }
      }

      pf.style.width = '80%';

      // Rebuild worksheet từ rawData
      const newWs = XLSX.utils.aoa_to_sheet(rawData);

      // Copy column widths
      if(ws['!cols']) newWs['!cols'] = ws['!cols'];
      if(ws['!merges']) newWs['!merges'] = ws['!merges'];
      if(ws['!rows']) newWs['!rows'] = ws['!rows'];

      wb.Sheets[sheetName] = newWs;

      // Xuất file
      const wbout = XLSX.write(wb, {bookType:'xlsx', type:'array'});
      const blob = new Blob([wbout], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
      xlsxDownload({_raw: blob}, 'PL_BVDN_Đã_điền_TT20_' + new Date().toISOString().slice(0,10) + '.xlsx');

      pf.style.width = '100%';
      setTimeout(()=>pb.style.display='none', 800);

      showResult(matched, fuzzy, notFound, notFoundList, matched+fuzzy+notFound);

    } catch(err){
      pb.style.display='none';
      tt20_showError('Lỗi xử lý: ' + err.message);
      console.error(err);
    }
  }, 100);
}

function showResult(matched, fuzzy, notFound, notFoundList, total){
  const box = document.getElementById('resultBox');
  box.style.display = 'block';
  const pct = total ? Math.round((matched+fuzzy)/total*100) : 0;

  let cls = 'result-ok';
  if(notFound > 0 && notFound < total/2) cls = 'result-warn';
  else if(notFound >= total/2) cls = 'result-err';
  box.className = 'result-box ' + cls;

  let html = `<strong>✅ Hoàn thành! Đã điền ${matched+fuzzy}/${total} thuốc (${pct}%)</strong>`;
  html += `<div class="stats">
    <div class="stat"><div class="stat-num num-ok">${matched}</div><div class="stat-lbl">Khớp chính xác</div></div>
    <div class="stat"><div class="stat-num num-warn">${fuzzy}</div><div class="stat-lbl">Khớp gần đúng</div></div>
    <div class="stat"><div class="stat-num num-err">${notFound}</div><div class="stat-lbl">Không tìm thấy</div></div>
  </div>`;

  if(fuzzy > 0) html += `<p style="margin-top:10px;font-size:.82rem;color:#7b341e">⚠️ <strong>Khớp gần đúng:</strong> Tên hoạt chất hoặc đường dùng có khác biệt nhỏ so với TT20. Vui lòng kiểm tra lại.</p>`;

  if(notFoundList.length > 0){
    html += `<p style="margin-top:10px;font-size:.82rem"><strong>Không tìm thấy trong TT20 (${notFound} thuốc):</strong></p>
    <ul class="unmatched-list">`;
    for(const nm of notFoundList){
      html += `<li>STT ${nm.stt}: <b>${nm.hoatChat}</b> – ${nm.duongDung}</li>`;
    }
    html += '</ul>';
  }

  box.innerHTML = html;
}

function tt20_showError(msg){
  const box = document.getElementById('resultBox');
  box.style.display = 'block';
  box.className = 'result-box result-err';
  box.innerHTML = '<strong>❌ ' + msg + '</strong>';
}




// Init on load
document.addEventListener('DOMContentLoaded', function() {
  // Inner nav visible by default (app 1 is active)
  const innerNav = document.getElementById('bbhv-inner-nav');
  if(innerNav) innerNav.style.display = 'flex';
});


// ═══════════════════════════════════════════════════════
// MOBILE-SAFE DOWNLOAD SYSTEM
// ═══════════════════════════════════════════════════════