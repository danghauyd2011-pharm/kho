// ═══════════════════════════════════════════════════════════
// MODULE TK — Thẻ Kho + BBKK + BBXNT (Báo cáo XNT thuốc nghiện/hướng thần)
// ═══════════════════════════════════════════════════════════

function tk_setupDZ(dzId, fiId, type) {
  const dz = document.getElementById(dzId);
  const fi = document.getElementById(fiId);
  dz.addEventListener('dragover', e=>{e.preventDefault();dz.classList.add('drag');});
  dz.addEventListener('dragleave', ()=>dz.classList.remove('drag'));
  dz.addEventListener('drop', e=>{
    e.preventDefault();dz.classList.remove('drag');
    const f=e.dataTransfer.files[0];if(f)loadWB(f,type);
  });
  fi.addEventListener('change', e=>{if(e.target.files[0])loadWB(e.target.files[0],type);});
}
tk_setupDZ('dz-xuat','fi-xuat','xuat');
tk_setupDZ('dz-nhap','fi-nhap','nhap');
tk_setupDZ('dz-ton','fi-ton','ton');

function loadWB(file, type) {
  const reader = new FileReader();
  reader.onload = e => {
    const wb = XLSX.read(new Uint8Array(e.target.result),{type:'array'});
    if(type==='xuat'){xuatWB=wb;markDZ('dz-xuat','fn-xuat',file.name);}
    else if(type==='nhap'){nhapWB=wb;markDZ('dz-nhap','fn-nhap',file.name);}
    else{tonWB=wb;markDZ('dz-ton','fn-ton',file.name);}
    // ── Realtime: cả 2 file xuất+nhập → tự động xử lý ──
    if (xuatWB && nhapWB) {
      setTimeout(() => {
        try { processData(); } catch(ex) { console.warn('Auto-process:', ex); }
      }, 200);
    }
  };
  reader.readAsArrayBuffer(file);
}
function markDZ(dzId,fnId,name){
  document.getElementById(dzId).classList.add('ok');
  const fn=document.getElementById(fnId);fn.textContent='✓ '+name;fn.classList.remove('hidden');
}

// ═══════════════════════════════════════════════════════
// DATE PARSING
// ═══════════════════════════════════════════════════════
function parseDate(raw){
  if(!raw && raw!==0) return null;
  if(typeof raw==='number'){
    const d=XLSX.SSF.parse_date_code(raw);
    if(d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`;
  }
  const s=raw.toString().trim();
  const iso=s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if(iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const sl=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if(sl){
    const p1=parseInt(sl[1]),p2=parseInt(sl[2]),yr=sl[3];
    const s1=String(p1).padStart(2,'0'),s2=String(p2).padStart(2,'0');
    if(p1>12) return `${yr}-${s2}-${s1}`;
    if(p2>12) return `${yr}-${s1}-${s2}`;
    return `${yr}-${s1}-${s2}`; // ambiguous → MM/DD
  }
  return null;
}

function tk_isoToDisplay(iso){
  if(!iso) return '';
  const [y,m,d]=iso.split('-');return `${d}/${m}/${y}`;
}

function isoToYM(iso){ // YYYY-MM
  if(!iso) return '';
  return iso.substring(0,7);
}

function prevMonthLastDay(iso){ // last day of prev month from any date in that month
  if(!iso) return null;
  const [y,m]=iso.split('-').map(Number);
  const d=new Date(y,m-1,0); // day 0 of current month = last day of prev month
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ═══════════════════════════════════════════════════════
// PARSE SHEET — generic
// ═══════════════════════════════════════════════════════
function tk_parseSheet(wb, typeFilter) {
  // typeFilter: array or null (take all)
  for(const sname of wb.SheetNames){
    const ws=wb.Sheets[sname];
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''});
    let hi=-1;
    for(let i=0;i<Math.min(rows.length,20);i++){
      const r=rows[i].map(c=>(c||'').toString().toLowerCase().trim());
      const hasDrug=r.some(c=>c==='tên hàng'||c.includes('tên hàng'));
      const hasQty=r.some(c=>c==='số lượng'||c.includes('số lượng'));
      const hasType=r.some(c=>c.includes('loại chứng từ'));
      if(hasDrug&&hasQty&&hasType){hi=i;break;}
    }
    if(hi===-1) continue;
    const hdrs=rows[hi].map(h=>(h||'').toString().trim().toLowerCase());
    const ci=name=>{
      const ex=hdrs.findIndex(h=>h===name);
      return ex!==-1?ex:hdrs.findIndex(h=>h.includes(name));
    };
    const dateCol=ci('ngày ct')!==-1?ci('ngày ct'):ci('ngày');
    const maCol  =ci('mã hàng');
    const tenCol =ci('tên hàng');
    const hlCol  =ci('hàm lượng');
    const slCol  =ci('số lượng');
    const typeCol=ci('loại chứng từ');
    const khoaCol=ci('khoa phòng'); // -1 if absent (nhap file)
    const loCol  =ci('lô');
    const hanCol =hdrs.findIndex(h=>h.includes('hạn'));
    const tenCtyCol=hdrs.findIndex(h=>h==='tên'); // nhap: Tên = tên công ty
    if([dateCol,tenCol,slCol,typeCol].some(i=>i===-1)) continue;
    const recs=[];
    for(let i=hi+1;i<rows.length;i++){
      const row=rows[i];
      const loaiCT=(row[typeCol]||'').toString().trim();
      if(!loaiCT) continue;
      if(typeFilter&&!typeFilter.some(t=>loaiCT.toLowerCase()===t.toLowerCase())) continue;
      const ten=(row[tenCol]||'').toString().trim();
      if(!ten) continue;
      const iso=parseDate(row[dateCol]);
      if(!iso) continue;
      const sl=parseFloat(row[slCol])||0;
      if(!sl) continue;
      const ma=maCol!==-1?(row[maCol]||'').toString().trim():'';
      const hl=hlCol!==-1?(row[hlCol]||'').toString().trim():'';
      const dvtColIdx=hdrs.findIndex(h=>h.includes('đvt')||h.includes('đơn vị'));
      const dvtVal=dvtColIdx!==-1?(row[dvtColIdx]||'').toString().trim():'';
      const khoa=khoaCol!==-1?(row[khoaCol]||'').toString().trim():'';
      const lo=loCol!==-1?(row[loCol]||'').toString().trim():'';
      const han=hanCol!==-1?parseDate(row[hanCol]):'';
      const tenCty=tenCtyCol!==-1?(row[tenCtyCol]||'').toString().trim():'';
      recs.push({date:iso,ma,ten,hl,loaiCT,sl,khoa,lo,han,tenCty,dvt:dvtVal});
    }
    return recs;
  }
  return null;
}

// ═══════════════════════════════════════════════════════
// PROCESS DATA
// ═══════════════════════════════════════════════════════
function processData(){
  const errBox=document.getElementById('err-box');
  errBox.classList.add('hidden');
  if(!xuatWB){showErr('Vui lòng chọn file Xuất kho.');return;}
  if(!nhapWB){showErr('Vui lòng chọn file Nhập kho.');return;}
  const btn=document.getElementById('btn-process');
  btn.disabled=true;btn.innerHTML='<span class="spinner">⚡</span> Đang xử lý…';
  setTimeout(()=>{
    try{
      const xRecs=tk_parseSheet(xuatWB, XUAT_TYPES);
      if(!xRecs||xRecs.length===0){showErr('Không đọc được dữ liệu từ file Xuất kho.');return;}
      const nRecs=tk_parseSheet(nhapWB, NHAP_TYPES);
      if(!nRecs||nRecs.length===0){showErr('Không đọc được dữ liệu từ file Nhập kho.');return;}
      allXuat=xRecs;allNhap=nRecs;
      // Build drugMap by mã hàng
      drugMap={};
      [...xRecs,...nRecs].forEach(r=>{
        const key=r.ma||r.ten;
        if(!drugMap[key]) drugMap[key]={name:r.ten,hl:r.hl,ma:r.ma,dvt:r.dvt||''};
      });
      // Parse tồn kho file if available
      if(tonWB){
        parseTonFile();
        buildAndGo();
      } else {
        // Show manual input screen
        buildTonInputScreen();
        goScreen('sc-ton');
      }
    }catch(e){showErr('Lỗi: '+e.message);console.error(e);}
    finally{btn.disabled=false;btn.innerHTML='⚡ Xử lý dữ liệu';}
  },50);
}

function parseTonFile(){
  tonMap={};
  for(const sname of tonWB.SheetNames){
    const ws=tonWB.Sheets[sname];
    const rows=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''});
    let hi=-1;
    for(let i=0;i<Math.min(rows.length,15);i++){
      const r=rows[i].map(c=>(c||'').toString().toLowerCase().trim());
      if(r.some(c=>c.includes('mã hàng'))&&r.some(c=>c.includes('số lượng')||c.includes('tồn'))){hi=i;break;}
    }
    if(hi===-1) continue;
    const hdrs=rows[hi].map(h=>(h||'').toString().toLowerCase().trim());
    const ci=name=>hdrs.findIndex(h=>h.includes(name));
    const maC=ci('mã hàng');const slC=ci('số lượng')!==-1?ci('số lượng'):ci('tồn');
    if(maC===-1||slC===-1) continue;
    for(let i=hi+1;i<rows.length;i++){
      const row=rows[i];
      const ma=(row[maC]||'').toString().trim();
      const sl=parseFloat(row[slC])||0;
      if(ma) tonMap[ma]=sl;
    }
    break;
  }
}

function buildTonInputScreen(){
  const tbody=document.getElementById('ton-tbody');
  tbody.innerHTML='';
  Object.keys(drugMap).sort().forEach(key=>{
    const d=drugMap[key];
    const tr=document.createElement('tr');
    tr.innerHTML=`<td><span class="mcode">${d.ma||key}</span></td>
      <td style="font-size:12px;font-weight:600">${d.name} <span style="color:var(--t2);font-size:10px">${d.hl}</span></td>
      <td><input class="ton-input" type="number" min="0" value="0" data-key="${key}" placeholder="0"></td>`;
    tbody.appendChild(tr);
  });
}

function confirmTon(){
  tonMap={};
  document.querySelectorAll('.ton-input').forEach(inp=>{
    const key=inp.dataset.key;
    const val=parseFloat(inp.value)||0;
    tonMap[key]=val;
  });
  buildAndGo();
}

function skipTon(){
  tonMap={};
  buildAndGo();
}

function buildAndGo(){
  buildThekho();
  updateHeroStats();
  renderDrugList();
  goScreen('sc-the-kho');
  if(document.getElementById('nb-the-kho')) document.getElementById('nb-the-kho').classList.add('active');
  // Pre-render BBKK in background
  setTimeout(renderBBKK, 200);
}

// ═══════════════════════════════════════════════════════
// BUILD THẺ KHO per mã hàng
// Cấu trúc mỗi ngày:
//   - 1 dòng tổng hợp khoa điều trị (Chuyển kho + Trả thuốc)
//   - 1 dòng tủ trực (nếu có)
//   - 1 dòng nhập kho/cty (nếu có)
// ═══════════════════════════════════════════════════════
function buildThekho(){
  // Group all records by mã hàng
  const byMa={};
  const addRec=(arr,sign)=>{
    arr.forEach(r=>{
      const key=r.ma||r.ten;
      if(!byMa[key]) byMa[key]={xuat:[],nhap:[]};
      if(sign==='xuat') byMa[key].xuat.push(r);
      else byMa[key].nhap.push(r);
    });
  };
  addRec(allXuat,'xuat');
  addRec(allNhap,'nhap');

  const sumSL = arr => arr.reduce((s,r) => s + r.sl, 0);

  Object.keys(byMa).forEach(key=>{
    const d=byMa[key];
    const drug=drugMap[key]||{name:key,hl:'',ma:key};
    const ton0=tonMap[key]||0;

    const allDates=new Set([...d.xuat.map(r=>r.date),...d.nhap.map(r=>r.date)]);
    const sortedDates=[...allDates].sort();
    if(sortedDates.length===0){drug.ledger=[];drug.ton0=ton0;return;}

    const firstDate=sortedDates[0];
    const lastDayPrev=prevMonthLastDay(firstDate);
    const ledger=[];

    // Row 0: kiểm kê cuối tháng trước
    ledger.push({date:lastDayPrev,type:'kk',noidung:'Kho kiểm kê',nhap:0,xuat:0,ton:ton0,ghichu:''});
    let curTon=ton0;

    sortedDates.forEach(date=>{
      const xDate=d.xuat.filter(r=>r.date===date);
      const nDate=d.nhap.filter(r=>r.date===date);

      // ── 1. Chuyển kho → Khoa điều trị (gộp thành 1 dòng) ──
      const xuatKhoa = xDate.filter(r => r.loaiCT.toLowerCase()==='chuyển kho');
      const nhapKhoa = nDate.filter(r => {
        const lt = r.loaiCT.toLowerCase();
        return (lt.includes('trả thuốc theo yêu cầu') || lt==='trả thuốc theo yêu cầu')
          && !TU_TRUC_NHAP.some(t=>lt.includes(t.toLowerCase()));
      });
      const xKhoa = sumSL(xuatKhoa);
      const nKhoa = sumSL(nhapKhoa);
      if(xKhoa>0||nKhoa>0){
        curTon = curTon - xKhoa + nKhoa;
        ledger.push({date,type:'khoa',noidung:'Khoa điều trị',nhap:nKhoa,xuat:xKhoa,ton:curTon,ghichu:''});
      }

      // ── 2. Xuất chuyển kho → Kho dược / phòng mổ (dòng riêng) ──
      const xuatPhongMo = xDate.filter(r => r.loaiCT.toLowerCase()==='xuất chuyển kho');
      const xPhongMo = sumSL(xuatPhongMo);
      if(xPhongMo>0){
        curTon -= xPhongMo;
        ledger.push({date,type:'phongmo',noidung:'Kho dược',nhap:0,xuat:xPhongMo,ton:curTon,ghichu:'Điều chuyển phòng mổ'});
      }

      // ── 2b. Xuất chuyển kho từ file Nhập → Kho phòng mổ điều chuyển về (dòng riêng) ──
      const nhapPhongMo = nDate.filter(r => r.loaiCT.toLowerCase()==='xuất chuyển kho');
      const nPhongMo = sumSL(nhapPhongMo);
      if(nPhongMo>0){
        curTon += nPhongMo;
        ledger.push({date,type:'phongmo_nhap',noidung:'Kho phòng mổ',nhap:nPhongMo,xuat:0,ton:curTon,ghichu:'Phòng mổ điều chuyển'});
      }

      // ── 3. Xuất kho đến tủ trực → dòng riêng, noidung="Khoa điều trị", ghichu="Xuất tủ trực" ──
      // Loại CT: "Xuất tủ trực", "Xuất thuốc đến tủ trực", "Xuất kho đến tủ trực"
      const xuatTuTruc = xDate.filter(r => {
        const lt = r.loaiCT.toLowerCase();
        return lt.includes('xuất tủ trực') || lt.includes('xuất thuốc đến tủ trực') || lt.includes('xuất kho đến tủ trực');
      });
      const xTT = sumSL(xuatTuTruc);
      if(xTT>0){
        curTon -= xTT;
        ledger.push({date,type:'tutruc',noidung:'Khoa điều trị',nhap:0,xuat:xTT,ton:curTon,ghichu:'Xuất tủ trực'});
      }

      // ── 4. Nhập kho từ tủ trực → dòng riêng, noidung="Khoa điều trị", ghichu="Nhập tủ trực" ──
      // Loại CT: "Trả thuốc từ tủ trực", "Nhập kho từ tủ trực", "Nhập tủ trực"
      const nhapTuTruc = nDate.filter(r => {
        const lt = r.loaiCT.toLowerCase();
        return lt.includes('trả thuốc từ tủ trực') || lt.includes('nhập kho từ tủ trực') || lt.includes('nhập tủ trực');
      });
      const nTT = sumSL(nhapTuTruc);
      if(nTT>0){
        curTon += nTT;
        ledger.push({date,type:'tutruc',noidung:'Khoa điều trị',nhap:nTT,xuat:0,ton:curTon,ghichu:'Nhập tủ trực'});
      }

      // ── 5. Nhập kho từ công ty (mỗi lô/cty riêng 1 dòng) ──
      const nhapKho = nDate.filter(r => {
        const lt = r.loaiCT.toLowerCase();
        return lt.includes('nhập kho')
          && !lt.includes('nhập kho từ tủ trực')
          && !lt.includes('nhập tủ trực');
      });
      const ctyGroups={};
      nhapKho.forEach(r=>{
        const k=r.tenCty||'Nhập kho';
        if(!ctyGroups[k]) ctyGroups[k]={sl:0,lo:r.lo,han:r.han};
        ctyGroups[k].sl+=r.sl;
      });
      Object.entries(ctyGroups).forEach(([cty,info])=>{
        curTon+=info.sl;
        const gc=[info.lo&&`Lô: ${info.lo}`,info.han&&`Hạn: ${tk_isoToDisplay(info.han)}`].filter(Boolean).join(' | ');
        ledger.push({date,type:'nhapkho',noidung:cty||'Nhập kho',nhap:info.sl,xuat:0,ton:curTon,ghichu:gc});
      });
    });

    drug.ledger=ledger;
    drug.ton0=ton0;
    drugMap[key]=Object.assign(drug,{key,ledger,ton0});
  });
}

// ═══════════════════════════════════════════════════════
// UI
// ═══════════════════════════════════════════════════════
function updateHeroStats(){
  const keys=Object.keys(drugMap);
  document.getElementById('hs-ma').textContent=keys.length;
  document.getElementById('hs-xuat').textContent=allXuat.length;
  document.getElementById('hs-nhap').textContent=allNhap.length;

  document.getElementById('tk-stats').innerHTML=
    `<div class="stile"><div class="sv cv1">${keys.length}</div><div class="sl">Mã hàng</div></div>`+
    `<div class="stile"><div class="sv cv2">${allNhap.filter(r=>r.loaiCT==='Nhập kho').length}</div><div class="sl">Nhập kho</div></div>`+
    `<div class="stile"><div class="sv cv3">${allXuat.length}</div><div class="sl">Dòng xuất</div></div>`+
    `<div class="stile"><div class="sv cv4">${allNhap.filter(r=>TRA_TYPES.some(t=>r.loaiCT===t)).length}</div><div class="sl">Trả thuốc</div></div>`;
}

function renderDrugList(filter=''){
  const list=document.getElementById('drug-list');
  const keys=Object.keys(drugMap).filter(k=>{
    const d=drugMap[k];
    const q=filter.toLowerCase();
    return !filter||d.name.toLowerCase().includes(q)||k.toLowerCase().includes(q)||(d.ma||'').toLowerCase().includes(q);
  });
  list.innerHTML='';
  if(keys.length===0){list.innerHTML='<div style="color:var(--t3);font-size:12px;padding:10px;text-align:center">Không tìm thấy</div>';return;}
  keys.forEach(key=>{
    const d=drugMap[key];
    const div=document.createElement('div');
    div.className='drug-item'+(key===selectedMa?' selected':'');
    const rowCount=(d.ledger||[]).length-1; // exclude kk row
    div.innerHTML=`<div class="drug-dot"></div><div class="drug-info"><div class="drug-name">${d.name} ${d.hl?'<span style="color:var(--t2);font-weight:500;font-size:10px">'+d.hl+'</span>':''}</div><div class="drug-code">${d.ma||key}</div></div><div class="drug-badge">${rowCount} dòng</div>`;
    div.onclick=()=>selectDrug(key);
    list.appendChild(div);
  });
}

function filterDrugs(){renderDrugList(document.getElementById('drug-search').value);}

function selectDrug(key){
  selectedMa=key;
  renderDrugList(document.getElementById('drug-search').value);
  const d=drugMap[key];
  document.getElementById('sel-name').textContent=d.name;
  document.getElementById('sel-meta').textContent=`Mã: ${d.ma||key} · ${d.hl} · Tồn đầu: ${(d.ton0||0).toLocaleString('vi-VN')}`;
  renderA4(key);
  document.getElementById('tk-preview-area').classList.remove('hidden');
  document.getElementById('tk-preview-area').style.display='flex';
  document.getElementById('no-drug-selected').classList.add('hidden');
  setTimeout(scaleA4,80);
}

// ═══════════════════════════════════════════════════════
// RENDER A4 THẺ KHO
// ═══════════════════════════════════════════════════════
function renderA4(key){
  const d=drugMap[key];
  const ledger=d.ledger||[];
  const page=document.getElementById('a4-page');
  if(ledger.length===0){page.innerHTML='<div class="a4-empty"><div class="a4-empty-icon">📭</div><div>Không có dữ liệu</div></div>';return;}

  let html=`
    <div class="tk-title">THẺ KHO THUỐC GÂY NGHIỆN – HƯỚNG THẦN – TIỀN CHẤT</div>
    <div class="tk-drug">Tên thuốc: <span>${d.name}</span> &nbsp; Mã hàng: <span>${d.ma||key}</span></div>
    <div class="tk-hamluong">Hàm lượng: ${d.hl} &nbsp;&nbsp; Đơn vị tính: Vỏ/Ống/Viên</div>
    <table class="tk-table">
      <thead><tr>
        <th style="width:10%">Ngày tháng năm</th>
        <th style="width:32%">Nội dung</th>
        <th style="width:12%">Nhập</th>
        <th style="width:12%">Xuất</th>
        <th style="width:12%">Tồn</th>
        <th style="width:22%">Ghi chú</th>
      </tr></thead><tbody>`;

  ledger.forEach(row=>{
    let cls='';
    if(row.type==='kk') cls='tk-row-kk';
    else if(row.type==='nhapkho') cls='tk-row-nhap';
    else if(row.type==='tutruc') cls='tk-row-tra';
    else if(row.type==='phongmo') cls='tk-row-phongmo';
    else if(row.type==='phongmo_nhap') cls='tk-row-phongmo';
    html+=`<tr class="${cls}">
      <td class="ctr">${tk_isoToDisplay(row.date)}</td>
      <td class="${row.type==='kk'?'kk':''}">${row.noidung}</td>
      <td class="r">${row.nhap>0?fmtQty(row.nhap):''}</td>
      <td class="r">${row.xuat>0?fmtQty(row.xuat):''}</td>
      <td class="r" style="font-weight:700">${fmtQtyAlways(row.ton)}</td>
      <td style="font-size:11px;color:#555">${row.ghichu||''}</td>
    </tr>`;
  });

  html+='</tbody></table>';
  page.innerHTML=html;
  setTimeout(scaleA4,30);
}

// ═══════════════════════════════════════════════════════
// A4 SCALE
// ═══════════════════════════════════════════════════════
function scaleA4(){
  const wrap=document.getElementById('prev-scroll');
  const scaler=document.getElementById('a4-scaler');
  const page=document.getElementById('a4-page');
  if(!wrap||!scaler||!page) return;
  const avail=wrap.offsetWidth;
  const scale=avail>0?Math.min(1,(avail-2)/794):0.4;
  scaler.style.transform=`scale(${scale})`;
  wrap.style.height=(page.offsetHeight*scale+4)+'px';
}
window.addEventListener('resize',scaleA4);

// ═══════════════════════════════════════════════════════
// EXPORT EXCEL
// ═══════════════════════════════════════════════════════
function exportExcel(){
  if(!selectedMa){alert('Chọn mã hàng trước!');return;}
  const d=drugMap[selectedMa];
  const ledger=d.ledger||[];
  const wb2=XLSX.utils.book_new();
  const aoa=[
    ['THẺ KHO THUỐC GÂY NGHIỆN – HƯỚNG THẦN – TIỀN CHẤT'],
    [`Tên thuốc: ${d.name}  |  Mã hàng: ${d.ma||selectedMa}  |  Hàm lượng: ${d.hl}`],
    [],
    ['Ngày tháng năm','Nội dung','Nhập','Xuất','Tồn','Ghi chú']
  ];
  ledger.forEach(row=>{
    aoa.push([
      tk_isoToDisplay(row.date),
      row.noidung,
      row.nhap>0 ? (row.nhap < 10 ? String(row.nhap).padStart(2,'0') : row.nhap) : '',
      row.xuat>0 ? (row.xuat < 10 ? String(row.xuat).padStart(2,'0') : row.xuat) : '',
      row.ton < 10 && row.ton >= 0 ? String(row.ton).padStart(2,'0') : row.ton,
      row.ghichu||''
    ]);
  });
  const ws2=XLSX.utils.aoa_to_sheet(aoa);
  ws2['!merges']=[{s:{r:0,c:0},e:{r:0,c:5}},{s:{r:1,c:0},e:{r:1,c:5}}];
  ws2['!cols']=[{wch:14},{wch:32},{wch:10},{wch:10},{wch:10},{wch:28}];
  XLSX.utils.book_append_sheet(wb2,ws2,'Thẻ kho');
  xlsxDownload(wb2,`The_kho_${(d.ma||selectedMa).replace(/[^a-zA-Z0-9]/g,'_')}.xlsx`);
}

// ═══════════════════════════════════════════════════════
// EXPORT PDF (print)
// ═══════════════════════════════════════════════════════
function exportPDF(){
  if(!selectedMa){alert('Chọn mã hàng trước!');return;}
  const d=drugMap[selectedMa];
  const ledger=d.ledger||[];
  let rows='';
  ledger.forEach(row=>{
    let cls='';
    if(row.type==='kk') cls='background:#fafafa;font-style:italic';
    else if(row.type==='nhapkho') cls='background:#f0fff8';
    else if(row.type==='phongmo') cls='background:#f5f0ff';
    else if(row.type==='phongmo_nhap') cls='background:#f0f0ff';
    else if(row.type==='tutruc') cls='background:#fff8ec';
    rows+=`<tr style="${cls}">
      <td style="text-align:center">${tk_isoToDisplay(row.date)}</td>
      <td>${row.noidung}</td>
      <td style="text-align:right">${row.nhap>0?fmtQty(row.nhap):''}</td>
      <td style="text-align:right">${row.xuat>0?fmtQty(row.xuat):''}</td>
      <td style="text-align:right;font-weight:700">${fmtQtyAlways(row.ton)}</td>
      <td style="font-size:11px;color:#555">${row.ghichu||''}</td>
    </tr>`;
  });
    mobilePrint(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Thẻ Kho — ${d.name}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Times New Roman',serif;font-size:13px;color:#000;padding:20mm 20mm 20mm 25mm}
h2{text-align:center;font-size:14px;margin-bottom:6px}
.info{margin-bottom:4px;font-size:13px}.info b{font-weight:bold}
.hl{margin-bottom:12px;font-size:12px;color:#333}
table{width:100%;border-collapse:collapse;font-size:12px}
th,td{border:1px solid #000;padding:4px 7px;vertical-align:middle}
th{text-align:center;background:#f0f0f0;font-weight:bold}
@media print{body{padding:10mm 15mm 10mm 20mm}}
</style></head><body>
<h2>THẺ KHO THUỐC GÂY NGHIỆN – HƯỚNG THẦN – TIỀN CHẤT</h2>
<div class="info">Tên thuốc: <b>${d.name}</b> &nbsp; Mã hàng: <b>${d.ma||selectedMa}</b></div>
<div class="hl">Hàm lượng: ${d.hl} &nbsp;&nbsp; ĐVT: Vỏ/Ống/Viên</div>
<table><thead><tr><th style="width:11%">Ngày</th><th style="width:31%">Nội dung</th><th style="width:12%">Nhập</th><th style="width:12%">Xuất</th><th style="width:12%">Tồn</th><th style="width:22%">Ghi chú</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`, 'Thẻ Kho');
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
function showErr(msg){
  document.getElementById('err-txt').textContent=msg;
  document.getElementById('err-box').classList.remove('hidden');
}

// ═══════════════════════════════════════════════════════
// BIÊN BẢN KIỂM KÊ CUỐI THÁNG (BBKK)
// ═══════════════════════════════════════════════════════

function getBBKKData() {
  // Extract last tồn from each drug's ledger
  const rows = [];
  Object.keys(drugMap).sort().forEach((key, idx) => {
    const d = drugMap[key];
    const ledger = d.ledger || [];
    // Last entry = cuối kỳ
    const lastRow = ledger.length > 0 ? ledger[ledger.length - 1] : null;
    const ton = lastRow ? lastRow.ton : (tonMap[key] || 0);
    rows.push({ stt: idx + 1, ma: d.ma || key, ten: d.name || key, hl: d.hl || '', ton });
  });
  return rows;
}

function getBBKKMonth() {
  // Determine month from data
  const allDates = [...allXuat, ...allNhap].map(r => r.date).filter(Boolean).sort();
  if (allDates.length === 0) return '';
  const last = allDates[allDates.length - 1];
  const [y, m] = last.split('-');
  return `${m}/${y}`;
}

function renderBBKK() {
  const rows = getBBKKData();
  const month = getBBKKMonth();
  const total = rows.reduce((s, r) => s + r.ton, 0);

  // Update hero stats
  document.getElementById('bbkk-count').textContent = rows.length;
  document.getElementById('bbkk-total').textContent = total.toLocaleString('vi-VN');
  document.getElementById('bbkk-month').textContent = month || '—';

  if (rows.length === 0) {
    document.getElementById('bbkk-page').innerHTML = '<div class="a4-empty"><div class="a4-empty-icon">⚠️</div><div>Chưa có dữ liệu. Vui lòng xử lý thẻ kho trước.</div></div>';
    return;
  }

  // Build A4 preview HTML
  const [m2, y2] = month ? month.split('/') : ['',''];
  const signDate = y2 ? `Ngày ... tháng ${m2} năm ${y2}` : '';

  const tableRows = rows.map(r => `
    <tr>
      <td style="text-align:center;border:1px solid #000;padding:4px 6px">${String(r.stt).padStart(2,'0')}</td>
      <td style="border:1px solid #000;padding:4px 6px">${r.ten}</td>
      <td style="border:1px solid #000;padding:4px 6px;text-align:center">${r.ma}</td>
      <td style="border:1px solid #000;padding:4px 6px;text-align:center;font-weight:bold;color:${r.ton < 0 ? '#c00' : '#000'}">${r.ton >= 0 && r.ton < 10 ? String(r.ton).padStart(2,'0') : r.ton.toLocaleString('vi-VN')}</td>
      <td style="border:1px solid #000;padding:4px 6px"></td>
    </tr>`).join('');

  document.getElementById('bbkk-page').innerHTML = `
    <div style="font-family:'Times New Roman',serif;font-size:13px;line-height:1.5">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12.5px">
        <div style="text-align:center;flex:1">
          <div><strong>SỞ Y TẾ TP ĐÀ NẴNG</strong></div>
          <div><strong>BỆNH VIỆN ĐÀ NẴNG</strong></div>
          <span style="display:block;height:1px;background:#000;width:70%;margin:3px auto 0"></span>
        </div>
        <div style="text-align:center;flex:1">
          <div><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></div>
          <div><strong>Độc lập – Tự do – Hạnh phúc</strong></div>
          <span style="display:block;height:1px;background:#000;width:80%;margin:3px auto 0"></span>
        </div>
      </div>
      <div style="text-align:center;font-weight:bold;font-size:14px;margin:14px 0 4px;text-transform:uppercase">
        BIÊN BẢN KIỂM KÊ KHO DƯỢC
      </div>
      <div style="text-align:center;font-weight:bold;font-size:13px;margin-bottom:2px">
        THUỐC GÂY NGHIỆN, HƯỚNG THẦN VÀ TIỀN CHẤT
      </div>
      <div style="text-align:center;font-style:italic;font-size:13px;margin-bottom:16px">
        Tháng ${month || '...'} — Kho Thuốc Nội Trú
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:8px">
        <thead>
          <tr style="background:#f5f5f5">
            <th style="border:1px solid #000;padding:5px 6px;text-align:center;width:6%">STT</th>
            <th style="border:1px solid #000;padding:5px 6px;text-align:center;width:38%">Tên thuốc, nồng độ, hàm lượng</th>
            <th style="border:1px solid #000;padding:5px 6px;text-align:center;width:16%">Mã hàng</th>
            <th style="border:1px solid #000;padding:5px 6px;text-align:center;width:16%">Số tồn cuối tháng</th>
            <th style="border:1px solid #000;padding:5px 6px;text-align:center;width:24%">Ghi chú</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="border:1px solid #000;padding:5px 6px;font-weight:bold;text-align:right">Tổng cộng:</td>
            <td style="border:1px solid #000;padding:5px 6px;text-align:center;font-weight:bold">${total.toLocaleString('vi-VN')}</td>
            <td style="border:1px solid #000"></td>
          </tr>
        </tfoot>
      </table>
      <div style="text-align:right;font-style:italic;margin-top:12px">${signDate}</div>
      <div style="display:flex;justify-content:space-between;margin-top:16px;font-size:12.5px">
        <div style="text-align:center;flex:1">
          <div><strong>Thủ kho</strong></div>
          <div style="font-style:italic">(Ký và ghi họ tên)</div>
        </div>
        <div style="text-align:center;flex:1">
          <div><strong>Trưởng khoa Dược</strong></div>
          <div style="font-style:italic">(Ký và ghi họ tên)</div>
        </div>
        <div style="text-align:center;flex:1">
          <div><strong>Phó Giám đốc</strong></div>
          <div style="font-style:italic">(Ký và ghi họ tên)</div>
        </div>
      </div>
    </div>`;

  setTimeout(scaleBBKK, 80);
}

function scaleBBKK() {
  const wrap = document.getElementById('bbkk-wrap');
  const scaler = document.getElementById('bbkk-scaler');
  const page = document.getElementById('bbkk-page');
  if (!wrap || !scaler || !page) return;
  const avail = wrap.offsetWidth;
  const scale = avail > 0 ? Math.min(1, (avail - 2) / 794) : 1;
  scaler.style.transform = `scale(${scale})`;
  wrap.style.height = (page.offsetHeight * scale + 4) + 'px';
}
window.addEventListener('resize', scaleBBKK);

function exportBBKK_Excel() {
  const rows = getBBKKData();
  const month = getBBKKMonth();
  if (rows.length === 0) { alert('Chưa có dữ liệu!'); return; }

  const wb = XLSX.utils.book_new();

  // Sheet 1: Biên bản kiểm kê (formatted)
  const aoa1 = [
    ['BIÊN BẢN KIỂM KÊ KHO DƯỢC - THÁNG ' + (month || '')],
    [''],
    ['STT', 'Tên thuốc, nồng độ, hàm lượng', 'Mã hàng', 'Số tồn cuối tháng', 'Ghi chú'],
    ...rows.map(r => [r.stt, r.ten, r.ma, r.ton, '']),
    ['', '', 'Tổng cộng:', rows.reduce((s,r)=>s+r.ton,0), ''],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(aoa1);
  ws1['!merges'] = [{ s:{r:0,c:0}, e:{r:0,c:4} }];
  ws1['!cols'] = [{wch:6},{wch:38},{wch:18},{wch:20},{wch:18}];
  XLSX.utils.book_append_sheet(wb, ws1, 'Biên bản kiểm kê');

  // Sheet 2: Tồn kho (dùng để nạp tháng sau) — format: Mã hàng | Số lượng
  const aoa2 = [
    ['Mã hàng', 'Tên thuốc', 'Số lượng tồn'],
    ...rows.map(r => [r.ma || r.ten, r.ten, r.ton]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(aoa2);
  ws2['!cols'] = [{wch:18},{wch:38},{wch:16}];
  XLSX.utils.book_append_sheet(wb, ws2, 'Tồn kho tháng sau');

  const fname = `BBKK_Thang_${(month||'').replace('/','_')}.xlsx`;
  xlsxDownload(wb, fname);
}

function exportBBKK_PDF() {
  const rows = getBBKKData();
  const month = getBBKKMonth();
  if (rows.length === 0) { alert('Chưa có dữ liệu!'); return; }
  const [m2, y2] = month ? month.split('/') : ['',''];
  const signDate = y2 ? `Ngày ... tháng ${m2} năm ${y2}` : '';
  const total = rows.reduce((s,r)=>s+r.ton,0);

  const tableRows = rows.map(r => `<tr>
    <td style="text-align:center">${String(r.stt).padStart(2,'0')}</td>
    <td>${r.ten}</td>
    <td style="text-align:center">${r.ma}</td>
    <td style="text-align:center;font-weight:bold">${r.ton >= 0 && r.ton < 10 ? String(r.ton).padStart(2,'0') : r.ton.toLocaleString('vi-VN')}</td>
    <td></td>
  </tr>`).join('');

    mobilePrint(`<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>BBKK Tháng ${month}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Times New Roman',serif;font-size:13px;color:#000;padding:20mm 20mm 20mm 25mm}
h2{text-align:center;font-size:14px;text-transform:uppercase;margin-bottom:4px}
.sub{text-align:center;font-size:13px;font-weight:bold;margin-bottom:2px}
.period{text-align:center;font-style:italic;font-size:13px;margin-bottom:14px}
.header-row{display:flex;justify-content:space-between;margin-bottom:6px;font-size:12.5px}
.header-col{flex:1;text-align:center}
table{width:100%;border-collapse:collapse;font-size:12.5px;margin-bottom:8px}
th,td{border:1px solid #000;padding:4px 7px;vertical-align:middle}
th{text-align:center;background:#f0f0f0;font-weight:bold}
tfoot td{font-weight:bold}
.sign-row{display:flex;justify-content:space-between;margin-top:16px;text-align:center}
.sign-col{flex:1}
.date-right{text-align:right;font-style:italic;margin-top:10px}
@media print{body{padding:10mm 15mm 10mm 20mm}}
</style></head><body>
<div class="header-row">
  <div class="header-col">
    <div><strong>SỞ Y TẾ TP ĐÀ NẴNG</strong></div>
    <div><strong>BỆNH VIỆN ĐÀ NẴNG</strong></div>
    <hr style="width:70%;margin:3px auto">
  </div>
  <div class="header-col">
    <div><strong>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</strong></div>
    <div><strong>Độc lập – Tự do – Hạnh phúc</strong></div>
    <hr style="width:80%;margin:3px auto">
  </div>
</div>
<h2>BIÊN BẢN KIỂM KÊ KHO DƯỢC</h2>
<div class="sub">THUỐC GÂY NGHIỆN, HƯỚNG THẦN VÀ TIỀN CHẤT</div>
<div class="period">Tháng ${month} — Kho Thuốc Nội Trú</div>
<table>
  <thead><tr>
    <th style="width:6%">STT</th>
    <th style="width:38%">Tên thuốc, nồng độ, hàm lượng</th>
    <th style="width:16%">Mã hàng</th>
    <th style="width:16%">Số tồn cuối tháng</th>
    <th style="width:24%">Ghi chú</th>
  </tr></thead>
  <tbody>${tableRows}</tbody>
  <tfoot><tr>
    <td colspan="3" style="text-align:right">Tổng cộng:</td>
    <td style="text-align:center">${total.toLocaleString('vi-VN')}</td>
    <td></td>
  </tr></tfoot>
</table>
<div class="date-right">${signDate}</div>
<div class="sign-row">
  <div class="sign-col"><strong>Thủ kho</strong><br><em>(Ký và ghi họ tên)</em><br><br><br></div>
  <div class="sign-col"><strong>Trưởng khoa Dược</strong><br><em>(Ký và ghi họ tên)</em><br><br><br></div>
  <div class="sign-col"><strong>Phó Giám đốc</strong><br><em>(Ký và ghi họ tên)</em><br><br><br></div>
</div>
</body></html>`, 'Biên Bản Kiểm Kê');
}





// ═══ APP 3: TT20 JS ═══

// =====================================================
// DỮ LIỆU LOOKUP TT20/2022 – NHÚNG SẴN
// =====================================================
const TT20_DATA = [{"stt":"1","hoat_chat":"Atropin sulfat","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"2","hoat_chat":"Bupivacain hydroclorid","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"3","hoat_chat":"Desfluran","duong_dung":"Hô hấp","luu_y":""},{"stt":"4","hoat_chat":"Dexmedetomidin","duong_dung":"Tiêm","luu_y":""},{"stt":"5","hoat_chat":"Diazepam","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"6","hoat_chat":"Etomidat","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"7","hoat_chat":"Fentanyl","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"8","hoat_chat":"Halothan","duong_dung":"Đường hô hấp","luu_y":""},{"stt":"9","hoat_chat":"Isofluran","duong_dung":"Đường hô hấp","luu_y":""},{"stt":"10","hoat_chat":"Ketamin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"11","hoat_chat":"Levobupivacain","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"12","hoat_chat":"Lidocain hydroclodrid","duong_dung":"Tiêm, dùng ngoài, khí dung","luu_y":""},{"stt":"13","hoat_chat":"Lidocain + epinephrin (adrenalin)","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"14","hoat_chat":"Lidocain + prilocain","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"15","hoat_chat":"Midazolam","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"16","hoat_chat":"Morphin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"17","hoat_chat":"Oxy dược dụng","duong_dung":"Đường hô hấp, dạng khí lỏng hoặc nén","luu_y":""},{"stt":"18","hoat_chat":"Pethidin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"19","hoat_chat":"Procain hydroclorid","duong_dung":"Tiêm","luu_y":""},{"stt":"20","hoat_chat":"Proparacain hydroclorid","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"21","hoat_chat":"Propofol","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"22","hoat_chat":"Ropivacain hydroclorid","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"23","hoat_chat":"Sevofluran","duong_dung":"Hô hấp","luu_y":""},{"stt":"24","hoat_chat":"Sufentanil","duong_dung":"Tiêm","luu_y":""},{"stt":"25","hoat_chat":"Thiopental (muối natri)","duong_dung":"Tiêm","luu_y":""},{"stt":"26","hoat_chat":"Atracurium besylat","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"27","hoat_chat":"Neostigmin metylsulfat (bromid)","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"28","hoat_chat":"Pancuronium bromid","duong_dung":"Tiêm","luu_y":""},{"stt":"29","hoat_chat":"Pipecuronium bromid","duong_dung":"Tiêm","luu_y":""},{"stt":"30","hoat_chat":"Rocuronium bromid","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"31","hoat_chat":"Suxamethonium clorid","duong_dung":"Tiêm","luu_y":""},{"stt":"32","hoat_chat":"Vecuronium bromid","duong_dung":"Tiêm","luu_y":""},{"stt":"33","hoat_chat":"Aceclofenac","duong_dung":"Uống","luu_y":""},{"stt":"34","hoat_chat":"Aescin","duong_dung":"Tiếm, uống","luu_y":""},{"stt":"35","hoat_chat":"Celecoxib","duong_dung":"Uống","luu_y":""},{"stt":"36","hoat_chat":"Dexibuprofen","duong_dung":"Uống","luu_y":""},{"stt":"37","hoat_chat":"Diclofenac","duong_dung":"Tiêm, nhỏ mắt, uống, dùng ngoài, đặt hậu môn","luu_y":""},{"stt":"38","hoat_chat":"Etodolac","duong_dung":"Uống","luu_y":""},{"stt":"39","hoat_chat":"Etoricoxib","duong_dung":"Uống","luu_y":""},{"stt":"40","hoat_chat":"Fentanyl","duong_dung":"Dán ngoài da","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị giảm đau do ung thư."},{"stt":"41","hoat_chat":"Floctafenin","duong_dung":"Uống","luu_y":""},{"stt":"42","hoat_chat":"Flurbiprofen natri","duong_dung":"Uống, đặt","luu_y":""},{"stt":"43","hoat_chat":"Ibuprofen","duong_dung":"Uống","luu_y":""},{"stt":"44","hoat_chat":"Ibuprofen + Codein","duong_dung":"Uống","luu_y":""},{"stt":"45","hoat_chat":"Ketoprofen","duong_dung":"Tiêm, uống, nhỏ mắt","luu_y":""},{"stt":"46","hoat_chat":"Ketorolac","duong_dung":"Tiêm, uống, nhỏ mắt","luu_y":""},{"stt":"47","hoat_chat":"Loxoprofen","duong_dung":"Uống","luu_y":""},{"stt":"48","hoat_chat":"Meloxicam","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"49","hoat_chat":"Methyl salicylat + dl-camphor + thymol + l-menthol + glycol salicylat + tocopherol acetat","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"50","hoat_chat":"Morphin","duong_dung":"Uống","luu_y":""},{"stt":"51","hoat_chat":"Nabumeton","duong_dung":"Uống","luu_y":""},{"stt":"52","hoat_chat":"Naproxen","duong_dung":"Uống, đặt","luu_y":""},{"stt":"53","hoat_chat":"Naproxen + esomeprazol","duong_dung":"Uống","luu_y":""},{"stt":"54","hoat_chat":"Nefopam hydroclorid","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"55","hoat_chat":"Oxycodone","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị giảm đau do ung thư; thanh toán 50 %."},{"stt":"56","hoat_chat":"Paracetamol (acetaminophen)","duong_dung":"Tiêm, uống, đặt","luu_y":""},{"stt":"57","hoat_chat":"Paracetamol + chlorpheniramin","duong_dung":"Uống","luu_y":""},{"stt":"58","hoat_chat":"Paracetamol + codein phosphat","duong_dung":"Uống","luu_y":""},{"stt":"59","hoat_chat":"Paracetamol + diphenhydramin","duong_dung":"Uống","luu_y":""},{"stt":"60","hoat_chat":"Paracetamol + ibuprofen","duong_dung":"Uống","luu_y":""},{"stt":"61","hoat_chat":"Paracetamol + methocarbamol","duong_dung":"Uống","luu_y":""},{"stt":"62","hoat_chat":"Paracetamol + phenylephrin","duong_dung":"Uống","luu_y":""},{"stt":"63","hoat_chat":"Paracetamol + pseudoephedrin","duong_dung":"Uống","luu_y":""},{"stt":"64","hoat_chat":"Paracetamol + tramadol","duong_dung":"Uống","luu_y":""},{"stt":"65","hoat_chat":"Paracetamol + chlorpheniramin + dextromethorphan","duong_dung":"Uống","luu_y":""},{"stt":"66","hoat_chat":"Paracetamol + chlorpheniramin + phenylephrin","duong_dung":"Uống","luu_y":""},{"stt":"67","hoat_chat":"Paracetamol + chlorpheniramin + pseudoephedrin","duong_dung":"Uống","luu_y":""},{"stt":"68","hoat_chat":"Paracetamol + diphenhydramin + phenylephrin","duong_dung":"Uống","luu_y":""},{"stt":"69","hoat_chat":"Paracetamol + phenylephrin + dextromethorphan","duong_dung":"Uống","luu_y":""},{"stt":"70","hoat_chat":"Paracetamol + chlorpheniramin + phenylephrine + dextromethophan","duong_dung":"Uống","luu_y":""},{"stt":"71","hoat_chat":"Pethidin hydroclorid","duong_dung":"Tiếm","luu_y":""},{"stt":"72","hoat_chat":"Piroxicam (dưới dạng Piroxicam beta-cyclodextrin)","duong_dung":"Uống","luu_y":""},{"stt":"73","hoat_chat":"Tenoxicam","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"74","hoat_chat":"Tiaprofenic acid","duong_dung":"Uống","luu_y":""},{"stt":"75","hoat_chat":"Tramadol","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"76","hoat_chat":"Allopurinol","duong_dung":"Uống","luu_y":""},{"stt":"77","hoat_chat":"Colchicin","duong_dung":"Uống","luu_y":""},{"stt":"78","hoat_chat":"Probenecid","duong_dung":"Uống","luu_y":""},{"stt":"79","hoat_chat":"Diacerein","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị thoái hóa khớp hông hoặc gối."},{"stt":"80","hoat_chat":"Glucosamin","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị thoái hóa khớp gối mức độ nhẹ và trung bình."},{"stt":"81","hoat_chat":"Adalimumab","duong_dung":"Tiêm","luu_y":"Quỹ bảo hiểm y tế thanh  toán 50%."},{"stt":"82","hoat_chat":"Alendronat","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị loãng xương, sử dụng tại Bệnh viện Lão khoa Trung ương và khoa cơ xương khớp của bệnh viện hạng đặc biệt, hạng I."},{"stt":"83","hoat_chat":"Alendronat natri + cholecalciferol (Vitamin D3)","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị loãng xương, sử dụng tại Bệnh viện Lão khoa Trung ương và khoa cơ xương khớp của bệnh viện hạng đặc biệt, hạng I."},{"stt":"84","hoat_chat":"Alpha chymotrypsin","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán trong điều trị phù nề sau phẫu thuật, chấn thương, bỏng."},{"stt":"85","hoat_chat":"Calcitonin","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán:\n'- Phòng ngừa mất xương cấp tính do bất động đột ngột như trường hợp bệnh nhân bị gãy xương do loãng xương;\n'- Điều trị bệnh Paget cho người bệnh không đáp ứng các phương pháp điều trị khác hoặc không phù hợp với các phương pháp điều trị khác, như người bệnh có suy giảm chức năng thận nghiêm trọng;\n'- Tăng calci máu ác tính."},{"stt":"86","hoat_chat":"Etanercept","duong_dung":"Tiêm","luu_y":"Quỹ bảo hiểm y tế thanh  toán 30%."},{"stt":"87","hoat_chat":"Golimumab","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán 50%."},{"stt":"88","hoat_chat":"Infliximab","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán 50%."},{"stt":"89","hoat_chat":"Leflunomid","duong_dung":"Uống","luu_y":""},{"stt":"90","hoat_chat":"Methocarbamol","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"91","hoat_chat":"Risedronat","duong_dung":"Uống","luu_y":""},{"stt":"92","hoat_chat":"Tocilizumab","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán theo chỉ định của một trong các trường hợp sau:\n- Tờ hướng dẫn sử dụng tại bệnh viện hạng đặc biệt, hạng I và khoa cơ xương khớp của Bệnh viện hạng II; thanh toán 60%; -Điều trị COVID-19 theo hướng dẫn chẩn đoàn và điều trị COVID-19 của Bộ Y tế."},{"stt":"93","hoat_chat":"Zoledronic acid","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán:\n'- Điều trị ung thư di căn xương tại Bệnh viện hạng đặc biệt, hạng I, II.\n'- Điều trị loãng xương tại Bệnh viện Lão khoa Trung ương và khoa cơ xương khớp của bệnh viện hạng đặc biệt, hạng I."},{"stt":"94","hoat_chat":"Alimemazin","duong_dung":"Uống","luu_y":""},{"stt":"95","hoat_chat":"Bilastine","duong_dung":"Uống","luu_y":""},{"stt":"96","hoat_chat":"Cetirizin","duong_dung":"Uống","luu_y":""},{"stt":"97","hoat_chat":"Cinnarizin","duong_dung":"Uống","luu_y":""},{"stt":"98","hoat_chat":"Chlorpheniramin (hydrogen maleat)","duong_dung":"Uống","luu_y":""},{"stt":"99","hoat_chat":"Chlorpheniramin +  \ndextromethorphan","duong_dung":"Uống","luu_y":""},{"stt":"100","hoat_chat":"Chlorpheniramin +  \nphenylephrin","duong_dung":"Uống","luu_y":""},{"stt":"101","hoat_chat":"Desloratadin","duong_dung":"Uống","luu_y":""},{"stt":"102","hoat_chat":"Dexchlorpheniramin","duong_dung":"Uống, tiêm","luu_y":""},{"stt":"103","hoat_chat":"Diphenhydramin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"104","hoat_chat":"Ebastin","duong_dung":"Uống","luu_y":""},{"stt":"105","hoat_chat":"Epinephrin (adrenalin)","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"106","hoat_chat":"Fexofenadin","duong_dung":"Uống","luu_y":""},{"stt":"107","hoat_chat":"Ketotifen","duong_dung":"Uống, nhỏ mắt","luu_y":""},{"stt":"108","hoat_chat":"Levocetirizin","duong_dung":"Uống","luu_y":""},{"stt":"109","hoat_chat":"Loratadin","duong_dung":"Uống","luu_y":""},{"stt":"110","hoat_chat":"Loratadin + pseudoephedrin","duong_dung":"Uống","luu_y":""},{"stt":"111","hoat_chat":"Mequitazin","duong_dung":"Uống","luu_y":""},{"stt":"112","hoat_chat":"Promethazin hydroclorid","duong_dung":"Tiêm, uống,  dùng ngoài","luu_y":""},{"stt":"113","hoat_chat":"Rupatadine","duong_dung":"Uống","luu_y":""},{"stt":"114","hoat_chat":"Acetylcystein","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"115","hoat_chat":"Atropin","duong_dung":"Tiêm","luu_y":""},{"stt":"116","hoat_chat":"Calci gluconat","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"117","hoat_chat":"Dantrolen","duong_dung":"Uống","luu_y":""},{"stt":"118","hoat_chat":"Deferoxamin","duong_dung":"Uống,   tiêm truyền","luu_y":""},{"stt":"119","hoat_chat":"Dimercaprol","duong_dung":"Tiêm","luu_y":""},{"stt":"120","hoat_chat":"Edetat natri calci  \n(EDTA Ca- Na)","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"121","hoat_chat":"Ephedrin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"122","hoat_chat":"Esmolol","duong_dung":"Tiêm","luu_y":""},{"stt":"123","hoat_chat":"Flumazenil","duong_dung":"Tiêm","luu_y":""},{"stt":"124","hoat_chat":"Fomepizol","duong_dung":"Tiêm","luu_y":""},{"stt":"125","hoat_chat":"Glucagon","duong_dung":"Tiêm","luu_y":""},{"stt":"126","hoat_chat":"Glutathion","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán cho bệnh nhân sau xạ trị, bệnh nhân điều trị ung thư bằng cisplatin hoặc carboplatin; thanh toán 50%."},{"stt":"127","hoat_chat":"Hydroxocobalamin","duong_dung":"Tiêm","luu_y":""},{"stt":"128","hoat_chat":"Calci folinat (folinic acid, leucovorin)","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"129","hoat_chat":"Naloxon hydroclorid","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"130","hoat_chat":"Naltrexon","duong_dung":"Uống","luu_y":""},{"stt":"131","hoat_chat":"Natri hydrocarbonat (natri bicarbonat)","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"132","hoat_chat":"Natri nitrit","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh  toán điều trị ngộ độc  \ncyanua."},{"stt":"133","hoat_chat":"Natri thiosulfat","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"134","hoat_chat":"Nor-epinephrin (Nor- adrenalin)","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"135","hoat_chat":"Penicilamin","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"136","hoat_chat":"Phenylephrin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"137","hoat_chat":"Polystyren","duong_dung":"Uống","luu_y":""},{"stt":"138","hoat_chat":"Pralidoxim","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"139","hoat_chat":"Protamin sulfat","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"140","hoat_chat":"Meglumin natri succinat","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"141","hoat_chat":"Sorbitol","duong_dung":"Rửa ổ bụng","luu_y":""},{"stt":"142","hoat_chat":"Silibinin","duong_dung":"Tiêm","luu_y":"Quỹ bảo hiểm y tế thanh  toán điều trị ngộ độc nấm."},{"stt":"143","hoat_chat":"Succimer","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh  toán điều trị ngộ độc chì."},{"stt":"144","hoat_chat":"Sugammadex","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán trong các trường hợp:\n1. Trường hợp đã tiêm thuốc giãn cơ mà không đặt được ống nội khí quản;\n2. Bệnh nhân mắc bệnh phổi tắc nghẽn mạn tính (COPD), hen phế quản;\n3. Bệnh nhân suy tim, loạn nhịp tim, bệnh van tim, mạch vành;\n4. Bệnh nhân béo phì (BMI > 30);\n5. Bệnh nhân có bệnh lý thần kinh-cơ (loạn dưỡng cơ, nhược cơ);\n6. Bệnh nhân có chống chỉ định với neostigmine và atropin."},{"stt":"145","hoat_chat":"Than hoạt","duong_dung":"Uống","luu_y":""},{"stt":"146","hoat_chat":"Than hoạt + sorbitol","duong_dung":"Uống","luu_y":""},{"stt":"147","hoat_chat":"Xanh methylen","duong_dung":"Tiêm","luu_y":""},{"stt":"148","hoat_chat":"Carbamazepin","duong_dung":"Uống","luu_y":""},{"stt":"149","hoat_chat":"Gabapentin","duong_dung":"Uống","luu_y":""},{"stt":"150","hoat_chat":"Lamotrigine","duong_dung":"Uống","luu_y":""},{"stt":"151","hoat_chat":"Levetiracetam","duong_dung":"Uống","luu_y":""},{"stt":"152","hoat_chat":"Oxcarbazepin","duong_dung":"Uống","luu_y":""},{"stt":"153","hoat_chat":"Phenobarbital","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"154","hoat_chat":"Phenytoin","duong_dung":"Uống","luu_y":""},{"stt":"155","hoat_chat":"Pregabalin","duong_dung":"Uống","luu_y":""},{"stt":"156","hoat_chat":"Topiramat","duong_dung":"Uống","luu_y":""},{"stt":"157","hoat_chat":"Valproat natri","duong_dung":"Uống","luu_y":""},{"stt":"158","hoat_chat":"Valproat natri + valproic acid","duong_dung":"Uống","luu_y":""},{"stt":"159","hoat_chat":"Valproic acid","duong_dung":"Uống","luu_y":""},{"stt":"160","hoat_chat":"Albendazol","duong_dung":"Uống","luu_y":""},{"stt":"161","hoat_chat":"Diethylcarbamazin \n(dihydrogen citrat)","duong_dung":"Uống","luu_y":""},{"stt":"162","hoat_chat":"Ivermectin","duong_dung":"Uống","luu_y":""},{"stt":"163","hoat_chat":"Mebendazol","duong_dung":"Uống","luu_y":""},{"stt":"164","hoat_chat":"Niclosamid","duong_dung":"Uống","luu_y":""},{"stt":"165","hoat_chat":"Praziquantel","duong_dung":"Uống","luu_y":""},{"stt":"166","hoat_chat":"Pyrantel","duong_dung":"Uống","luu_y":""},{"stt":"167","hoat_chat":"Triclabendazol","duong_dung":"Uống","luu_y":""},{"stt":"168","hoat_chat":"Amoxicilin","duong_dung":"Uống","luu_y":""},{"stt":"169","hoat_chat":"Amoxicilin + acid clavulanic","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"170","hoat_chat":"Amoxicilin + sulbactam","duong_dung":"Tiêm","luu_y":"Quỹ bảo hiểm y tế thanh toán  trong điều trị viêm tai giữa  hoặc viêm phổi cộng đồng."},{"stt":"171","hoat_chat":"Ampicilin (muối natri)","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"172","hoat_chat":"Ampicilin + sulbactam","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"173","hoat_chat":"Benzathin benzylpenicilin","duong_dung":"Tiêm","luu_y":""},{"stt":"174","hoat_chat":"Benzylpenicilin","duong_dung":"Tiêm","luu_y":""},{"stt":"175","hoat_chat":"Cefaclor","duong_dung":"Uống","luu_y":""},{"stt":"176","hoat_chat":"Cefadroxil","duong_dung":"Uống","luu_y":""},{"stt":"177","hoat_chat":"Cefalexin","duong_dung":"Uống","luu_y":""},{"stt":"178","hoat_chat":"Cefalothin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"179","hoat_chat":"Cefamandol","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"180","hoat_chat":"Cefazolin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"181","hoat_chat":"Cefdinir","duong_dung":"Uống","luu_y":""},{"stt":"182","hoat_chat":"Cefepim","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"183","hoat_chat":"Cefixim","duong_dung":"Uống","luu_y":""},{"stt":"184","hoat_chat":"Cefmetazol","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"185","hoat_chat":"Cefoperazon","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"186","hoat_chat":"Cefoperazon + sulbactam","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"187","hoat_chat":"Cefotaxim","duong_dung":"Tiêm","luu_y":""},{"stt":"188","hoat_chat":"Cefotiam","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"189","hoat_chat":"Cefoxitin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"190","hoat_chat":"Cefpirom","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"191","hoat_chat":"Cefpodoxim","duong_dung":"Uống","luu_y":""},{"stt":"192","hoat_chat":"Cefradin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"193","hoat_chat":"Ceftazidim","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"194","hoat_chat":"Ceftazidim + avibactam","duong_dung":"Tiêm","luu_y":"Quỹ bảo hiểm y tế thanh toán trong điều trị COVID-19 theo hướng dẫn chẩn đoán và điều trị COVID-19 của Bộ Y tế."},{"stt":"195","hoat_chat":"Ceftibuten","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"196","hoat_chat":"Ceftizoxim","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"197","hoat_chat":"Ceftolozan + tazobactam","duong_dung":"Tiêm","luu_y":"Quỹ bảo hiểm y tế thanh toán trong điều trị COVID-19 theo hướng dẫn chẩn đoán và điều trị COVID-19 của Bộ Y tế."},{"stt":"198","hoat_chat":"Ceftriaxon","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"199","hoat_chat":"Cefuroxim","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"200","hoat_chat":"Cloxacilin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"201","hoat_chat":"Doripenem*","duong_dung":"Tiêm/truyền","luu_y":"BBHC + Phiếu duyệt KS + Duyệt GĐ"},{"stt":"202","hoat_chat":"Ertapenem*","duong_dung":"Tiêm/truyền","luu_y":"BBHC + Phiếu duyệt KS + Duyệt GĐ"},{"stt":"203","hoat_chat":"Imipenem + cilastatin*","duong_dung":"Tiêm/truyền","luu_y":"BBHC + Phiếu duyệt KS + Duyệt GĐ"},{"stt":"204","hoat_chat":"Meropenem*","duong_dung":"Tiêm/truyền","luu_y":"BBHC + Phiếu duyệt KS + Duyệt GĐ"},{"stt":"205","hoat_chat":"Oxacilin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"206","hoat_chat":"Piperacilin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"207","hoat_chat":"Piperacilin + tazobactam","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"208","hoat_chat":"Phenoxy methylpenicilin","duong_dung":"Uống","luu_y":""},{"stt":"209","hoat_chat":"Procain benzylpenicilin","duong_dung":"Tiêm","luu_y":""},{"stt":"210","hoat_chat":"Sultamicillin  \n(Ampicilin + sulbactam)","duong_dung":"Uống","luu_y":""},{"stt":"211","hoat_chat":"Ticarcillin + acid clavulanic","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"212","hoat_chat":"Amikacin","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"213","hoat_chat":"Gentamicin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"214","hoat_chat":"Neomycin (sulfat)","duong_dung":"Uống,   nhỏ mắt,   dùng ngoài","luu_y":""},{"stt":"215","hoat_chat":"Neomycin + polymyxin B","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"216","hoat_chat":"Neomycin + polymyxin B +  dexamethason","duong_dung":"Nhỏ mắt,   nhỏ tai","luu_y":""},{"stt":"217","hoat_chat":"Netilmicin sulfat","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"218","hoat_chat":"Tobramycin","duong_dung":"Nhỏ mắt, tiêm","luu_y":""},{"stt":"219","hoat_chat":"Tobramycin + dexamethason","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"220","hoat_chat":"Cloramphenicol","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"221","hoat_chat":"Metronidazol","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"222","hoat_chat":"Metronidazol + neomycin + nystatin","duong_dung":"Đặt âm đạo","luu_y":""},{"stt":"223","hoat_chat":"Secnidazol","duong_dung":"Uống","luu_y":""},{"stt":"224","hoat_chat":"Tinidazol","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"225","hoat_chat":"Clindamycin","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"226","hoat_chat":"Azithromycin","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"227","hoat_chat":"Clarithromycin","duong_dung":"Uống","luu_y":""},{"stt":"228","hoat_chat":"Erythromycin","duong_dung":"Uống","luu_y":""},{"stt":"229","hoat_chat":"Roxithromycin","duong_dung":"Uống","luu_y":""},{"stt":"230","hoat_chat":"Spiramycin","duong_dung":"Uống","luu_y":""},{"stt":"231","hoat_chat":"Spiramycin + metronidazol","duong_dung":"Uống","luu_y":""},{"stt":"232","hoat_chat":"Tretinoin + erythromycin","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"233","hoat_chat":"Ciprofloxacin","duong_dung":"Nhỏ tai, tiêm, uống","luu_y":""},{"stt":"234","hoat_chat":"Levofloxacin","duong_dung":"Nhỏ mắt, tiêm, uống","luu_y":""},{"stt":"235","hoat_chat":"Lomefloxacin","duong_dung":"Uống, nhỏ  mắt","luu_y":""},{"stt":"236","hoat_chat":"Moxifloxacin","duong_dung":"Nhỏ mắt, tiêm, uống","luu_y":""},{"stt":"237","hoat_chat":"Nalidixic acid","duong_dung":"Uống","luu_y":""},{"stt":"238","hoat_chat":"Norfloxacin","duong_dung":"Uống, nhỏ mắt","luu_y":""},{"stt":"239","hoat_chat":"Ofloxacin","duong_dung":"Nhỏ mắt, tiêm, uống","luu_y":""},{"stt":"240","hoat_chat":"Pefloxacin","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"241","hoat_chat":"Sulfadiazin bạc","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"242","hoat_chat":"Sulfadimidin (muối natri)","duong_dung":"Uống","luu_y":""},{"stt":"243","hoat_chat":"Sulfadoxin + pyrimethamin","duong_dung":"Uống","luu_y":""},{"stt":"244","hoat_chat":"Sulfaguanidin","duong_dung":"Uống","luu_y":""},{"stt":"245","hoat_chat":"Sulfamethoxazol + trimethoprim","duong_dung":"Uống","luu_y":""},{"stt":"246","hoat_chat":"Sulfasalazin","duong_dung":"Uống","luu_y":""},{"stt":"247","hoat_chat":"Doxycyclin","duong_dung":"Uống","luu_y":""},{"stt":"248","hoat_chat":"Minocyclin","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"249","hoat_chat":"Tigecyclin","duong_dung":"Tiêm/truyền","luu_y":"- BBHC + Phiếu duyệt KS + Duyệt GĐ\n- Quỹ bảo hiểm y tế thanh toán khi phác đồ sử dụng kháng sinh ban đầu không có hiệu quả trong nhiễm khuẩn ổ bụng, nhiễm khuẩn da, mô mềm biến chứng."},{"stt":"250","hoat_chat":"Tetracyclin hydroclorid","duong_dung":"Tra mắt, uống","luu_y":""},{"stt":"251","hoat_chat":"Argyrol","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"252","hoat_chat":"Colistin*","duong_dung":"Tiêm/truyền","luu_y":"BBHC + Phiếu duyệt KS + Duyệt GĐ"},{"stt":"253","hoat_chat":"Daptomycin","duong_dung":"Tiêm","luu_y":""},{"stt":"254","hoat_chat":"Fosfomycin*","duong_dung":"Tiêm/truyền","luu_y":"BBHC + Phiếu duyệt KS + Duyệt GĐ"},{"stt":"254","hoat_chat":"Fosfomycin*","duong_dung":"Uống","luu_y":"BBHC + Duyệt GĐ"},{"stt":"255","hoat_chat":"Linezolid*","duong_dung":"Tiêm/truyền","luu_y":"BBHC + Phiếu duyệt KS + Duyệt GĐ"},{"stt":"256","hoat_chat":"Nitrofurantoin","duong_dung":"Uống","luu_y":""},{"stt":"257","hoat_chat":"Rifampicin","duong_dung":"Dùng ngoài, nhỏ mắt, nhỏ tai","luu_y":""},{"stt":"258","hoat_chat":"Teicoplanin*","duong_dung":"Tiêm/truyền","luu_y":"BBHC + Phiếu duyệt KS + Duyệt GĐ"},{"stt":"259","hoat_chat":"Vancomycin*","duong_dung":"Tiêm/truyền","luu_y":"BBHC + Phiếu duyệt KS + Duyệt GĐ"},{"stt":"260","hoat_chat":"Abacavir (ABC)","duong_dung":"Uống","luu_y":""},{"stt":"261","hoat_chat":"Darunavir","duong_dung":"Uống","luu_y":""},{"stt":"262","hoat_chat":"Efavirenz (EFV hoặc EFZ)","duong_dung":"Uống","luu_y":""},{"stt":"263","hoat_chat":"Lamivudin","duong_dung":"Uống","luu_y":""},{"stt":"264","hoat_chat":"Nevirapin (NVP)","duong_dung":"Uống","luu_y":""},{"stt":"265","hoat_chat":"Raltegravir","duong_dung":"Uống","luu_y":""},{"stt":"266","hoat_chat":"Ritonavir","duong_dung":"Uống","luu_y":""},{"stt":"267","hoat_chat":"Tenofovir (TDF)","duong_dung":"Uống","luu_y":""},{"stt":"268","hoat_chat":"Zidovudin (ZDV hoặc AZT)","duong_dung":"Uống","luu_y":""},{"stt":"269","hoat_chat":"Lamivudin + tenofovir","duong_dung":"Uống","luu_y":""},{"stt":"270","hoat_chat":"Lamivudine+ zidovudin","duong_dung":"Uống","luu_y":""},{"stt":"271","hoat_chat":"Lopinavir + ritonavir  \n(LPV/r)","duong_dung":"Uống","luu_y":""},{"stt":"272","hoat_chat":"Tenofovir + lamivudin +  efavirenz","duong_dung":"Uống","luu_y":""},{"stt":"273","hoat_chat":"Tenofovir + lamivudin +  dolutegravir","duong_dung":"Uống","luu_y":""},{"stt":"274","hoat_chat":"Zidovudin (ZDV hoặc AZT)  + lamivudin + nevirapin  (NVP)","duong_dung":"Uống","luu_y":""},{"stt":"275","hoat_chat":"Daclatasvir","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán 50%"},{"stt":"276","hoat_chat":"Sofosbuvir","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán 50%."},{"stt":"277","hoat_chat":"Sofosbuvir + ledipasvir","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh  toán 50%."},{"stt":"278","hoat_chat":"Sofosbuvir + velpatasvir","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh  toán 50%."},{"stt":"279","hoat_chat":"Pegylated interferon  \n(peginterferon) alpha  \n(2a hoặc 2b)","duong_dung":"Tiêm","luu_y":"Quỹ bảo hiểm y tế thanh  toán điều trị viêm gan C  theo hướng dẫn chẩn đoán  và điều trị của Bộ Y tế trong  trường hợp không sử dụng  được các thuốc kháng vi rút  trực tiếp (Direct acting  antivirals - DAAs); thanh  toán 30%."},{"stt":"280","hoat_chat":"Aciclovir","duong_dung":"Dùng ngoài, tra mắt, uống","luu_y":""},{"stt":"281","hoat_chat":"Entecavir","duong_dung":"Uống","luu_y":""},{"stt":"282","hoat_chat":"Gancyclovir*","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"283","hoat_chat":"Oseltamivir","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị nhiễm vi rút cúm."},{"stt":"284","hoat_chat":"Ribavirin","duong_dung":"Uống","luu_y":""},{"stt":"285","hoat_chat":"Valganciclovir*","duong_dung":"Uống","luu_y":"- BBHC + Phiếu duyệt KS + Duyệt GĐ'\n- Quỹ bảo hiểm y tế thanh toán điều trị các bệnh do vi rút cự bào (Cytomegalovirus - CMV) tái hoạt động trên bệnh nhân ghép tạng hoặc ghép tế bào gốc; thanh toán 50%."},{"stt":"286","hoat_chat":"Zanamivir","duong_dung":"Dạng hít","luu_y":""},{"stt":"287","hoat_chat":"Molnupiravir","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán trong điều trị COVID-19 theo hướng dẫn chẩn đoán và điều trị COVID-19 của Bộ Y tế."},{"stt":"288","hoat_chat":"Amphotericin B*","duong_dung":"Tiêm/truyền","luu_y":"BBHC + Phiếu duyệt KS + Duyệt GĐ"},{"stt":"289","hoat_chat":"Anidulafungin","duong_dung":"Tiêm","luu_y":"Quỹ bảo hiểm y tế thanh toán trong điều trị COVID-19 theo hướng dẫn chẩn đoán và điều trị COVID-19 của Bộ Y tế."},{"stt":"290","hoat_chat":"Butoconazol nitrat","duong_dung":"Bôi âm đạo","luu_y":""},{"stt":"291","hoat_chat":"Caspofungin*","duong_dung":"Tiêm/truyền","luu_y":"- BBHC + Phiếu duyệt KS + Duyệt GĐ\n- Quỹ bảo hiểm y tế thanh toán trong trường hợp:\n'+ Điều trị theo kinh nghiệm nhiễm nấm xâm lấn (Candida hoặc Aspergilus) ở bệnh nhân nguy cơ cao có sốt, giảm bạch cầu trung tính;\n'+ Điều trị nhiễm nấm Candida xâm lấn;\n'+ Điều trị nhiễm nấm Aspergillus xâm lấn ở bệnh nhân kháng trị hoặc không dung nạp với các trị liệu khác."},{"stt":"292","hoat_chat":"Ciclopiroxolamin","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"293","hoat_chat":"Clotrimazol","duong_dung":"Đặt âm đạo","luu_y":""},{"stt":"294","hoat_chat":"Dequalinium clorid","duong_dung":"Đặt âm đạo","luu_y":""},{"stt":"295","hoat_chat":"Econazol","duong_dung":"Dùng ngoài, đặt âm đạo","luu_y":""},{"stt":"296","hoat_chat":"Fluconazol","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"297","hoat_chat":"Fenticonazol nitrat","duong_dung":"Đặt ấm đạo, dùng ngoài","luu_y":""},{"stt":"298","hoat_chat":"Flucytosin","duong_dung":"Tiêm","luu_y":""},{"stt":"299","hoat_chat":"Griseofulvin","duong_dung":"Uống, dùng ngoài","luu_y":""},{"stt":"300","hoat_chat":"Itraconazol","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"301","hoat_chat":"Ketoconazol","duong_dung":"Nhỏ mắt, dùng ngoài, đặt âm đạo","luu_y":""},{"stt":"302","hoat_chat":"Micafungin","duong_dung":"Tiêm","luu_y":"Quỹ bảo hiểm y tế thanh toán trong điều trị COVID-19 theo hướng dẫn chẩn đoán và điều trị COVID-19 của Bộ Y tế."},{"stt":"303","hoat_chat":"Miconazol","duong_dung":"Dùng ngoài, đặt âm đạo","luu_y":""},{"stt":"304","hoat_chat":"Natamycin","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"305","hoat_chat":"Nystatin","duong_dung":"Đặt âm đạo, uống","luu_y":""},{"stt":"306","hoat_chat":"Policresulen","duong_dung":"Đặt âm đạo","luu_y":""},{"stt":"307","hoat_chat":"Posaconazol*","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh  toán 50% trong trường hợp: - Nhiễm nấm Fusarium,  nhiễm nấm Zygomycetes,  bệnh nấm Cryptococcus,  bệnh nấm màu và u nấm ở  những bệnh nhân mắc bệnh  kháng trị với các thuốc khác  hoặc những bệnh nhân  \nkhông dung nạp với các  thuốc khác; \n- Bệnh nấm Coccidioides  immitis, bệnh nấm  \nCoccidioides immitis đã thất  bại hoặc không dung nạp với  các thuốc chống nấm khác."},{"stt":"308","hoat_chat":"Terbinafin (hydroclorid)","duong_dung":"Uống, dùng ngoài","luu_y":""},{"stt":"309","hoat_chat":"Voriconazol*","duong_dung":"Uống","luu_y":"- BBHC + Phiếu duyệt KS + Duyệt GĐ.\n- Quỹ bảo hiểm y tế thanh toán 50% trong điều trị:\n+ Nhiễm Asperillus nấm xâm lấn;\n+ Nhiễm Candida huyết trên bệnh nhân không giảm bạch cầu;\n+ Nhiễm nấm Candida xâm lấn nặng kháng fluconazol;\n+ Điều trị nhiễm nấm nặng gây ra bởi Scedosporium spp. và Fusarium spp. cho những bệnh nhân không đáp ứng các điều trị khác."},{"stt":"310","hoat_chat":"Clotrimazol + betamethason","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"311","hoat_chat":"Clorquinaldol + promestrien","duong_dung":"Đặt âm đạo","luu_y":""},{"stt":"312","hoat_chat":"Miconazol + hydrocortison","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"313","hoat_chat":"Nystatin + metronidazol +  neomycin","duong_dung":"Đặt âm đạo","luu_y":""},{"stt":"314","hoat_chat":"Nystatin + neomycin + polymyxin B","duong_dung":"Đặt âm đạo","luu_y":""},{"stt":"315","hoat_chat":"Diiodohydroxyquinolin","duong_dung":"Uống","luu_y":""},{"stt":"316","hoat_chat":"Hydroxy cloroquin","duong_dung":"Uống","luu_y":""},{"stt":"317","hoat_chat":"Metronidazol","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"318","hoat_chat":"Ethambutol","duong_dung":"Uống","luu_y":""},{"stt":"319","hoat_chat":"Isoniazid","duong_dung":"Uống","luu_y":""},{"stt":"320","hoat_chat":"Isoniazid + ethambutol","duong_dung":"Uống","luu_y":""},{"stt":"321","hoat_chat":"Pyrazinamid","duong_dung":"Uống","luu_y":""},{"stt":"322","hoat_chat":"Rifampicin","duong_dung":"Uống","luu_y":""},{"stt":"323","hoat_chat":"Rifampicin + isoniazid","duong_dung":"Uống","luu_y":""},{"stt":"324","hoat_chat":"Rifampicin + isoniazid +  pyrazinamid","duong_dung":"Uống","luu_y":""},{"stt":"325","hoat_chat":"Rifampicin + isoniazid +  pyrazinamid + ethambutol","duong_dung":"Uống","luu_y":""},{"stt":"326","hoat_chat":"Streptomycin","duong_dung":"Tiêm","luu_y":""},{"stt":"327","hoat_chat":"Amikacin","duong_dung":"Tiêm","luu_y":""},{"stt":"328","hoat_chat":"Bedaquiline","duong_dung":"Uống","luu_y":""},{"stt":"329","hoat_chat":"Capreomycin","duong_dung":"Tiêm","luu_y":""},{"stt":"330","hoat_chat":"Clofazimine","duong_dung":"Uống","luu_y":""},{"stt":"331","hoat_chat":"Cycloserin","duong_dung":"Uống","luu_y":""},{"stt":"332","hoat_chat":"Delamanid","duong_dung":"Uống","luu_y":""},{"stt":"333","hoat_chat":"Ethionamid","duong_dung":"Uống","luu_y":""},{"stt":"334","hoat_chat":"Kanamycin","duong_dung":"Tiêm","luu_y":""},{"stt":"335","hoat_chat":"PAS- Na","duong_dung":"Uống","luu_y":""},{"stt":"336","hoat_chat":"Prothionamid","duong_dung":"Uống","luu_y":""},{"stt":"337","hoat_chat":"Artesunat","duong_dung":"Tiêm","luu_y":""},{"stt":"338","hoat_chat":"Cloroquin","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"339","hoat_chat":"Piperaquin +  \ndihydroartemisinin","duong_dung":"Uống","luu_y":""},{"stt":"340","hoat_chat":"Primaquin","duong_dung":"Uống","luu_y":""},{"stt":"341","hoat_chat":"Quinin","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"342","hoat_chat":"Dihydro ergotamin mesylat","duong_dung":"Uống","luu_y":""},{"stt":"343","hoat_chat":"Ergotamin (tartrat)","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"344","hoat_chat":"Flunarizin","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị dự phòng cơn đau nửa đầu trong trường hợp các biện pháp điều trị khác không có hiệu quả hoặc kém dung nạp."},{"stt":"345","hoat_chat":"Sumatriptan","duong_dung":"Uống","luu_y":""},{"stt":"346","hoat_chat":"Arsenic trioxid","duong_dung":"Tiêm","luu_y":""},{"stt":"347","hoat_chat":"Bendamustine","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị bệnh bạch cầu lymphô mạn binet B/C không phù hợp hóa trị với Fludarabin; U lymphô không Hodgkin, diễn tiến chậm, tiến triển sau điều trị với Rituximab; thanh toán 50%."},{"stt":"348","hoat_chat":"Bleomycin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"349","hoat_chat":"Bortezomib","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"350","hoat_chat":"Busulfan","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"351","hoat_chat":"Capecitabin","duong_dung":"Uống","luu_y":""},{"stt":"352","hoat_chat":"Carboplatin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"353","hoat_chat":"Carmustin","duong_dung":"Tiêm","luu_y":"Quỹ bảo hiểm y tế thanh  toán 50%."},{"stt":"354","hoat_chat":"Cisplatin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"355","hoat_chat":"Cyclophosphamid","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"356","hoat_chat":"Cytarabin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"357","hoat_chat":"Dacarbazin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"358","hoat_chat":"Dactinomycin","duong_dung":"Tiêm","luu_y":""},{"stt":"359","hoat_chat":"Daunorubicin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"360","hoat_chat":"Decitabin","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán 50%."},{"stt":"361","hoat_chat":"Docetaxel","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"362","hoat_chat":"Doxorubicin","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán 50% đối với dạng liposome; thanh toán 100% đối với các dạng khác."},{"stt":"363","hoat_chat":"Epirubicin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"364","hoat_chat":"Etoposid","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"365","hoat_chat":"Everolimus","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán 50% đối với điều trị ung thư; thanh toán 100% đối với các trường hợp khác."},{"stt":"366","hoat_chat":"Fludarabin","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"367","hoat_chat":"Fluorouracil (5-FU)","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"368","hoat_chat":"Gemcitabin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"369","hoat_chat":"Hydroxyurea (Hydroxycarbamid)","duong_dung":"Uống","luu_y":""},{"stt":"370","hoat_chat":"Idarubicin","duong_dung":"Tiêm","luu_y":""},{"stt":"371","hoat_chat":"Ifosfamid","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"372","hoat_chat":"Irinotecan","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"373","hoat_chat":"L-Asparaginase","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán 50% đối với dạng L-asparaginase erwinia; thanh toán 100% đối với các dạng khác."},{"stt":"374","hoat_chat":"Melphalan","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"375","hoat_chat":"Mercaptopurin","duong_dung":"Uống","luu_y":""},{"stt":"376","hoat_chat":"Mesna","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"377","hoat_chat":"Methotrexat","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"378","hoat_chat":"Mitomycin","duong_dung":"Tiêm","luu_y":""},{"stt":"379","hoat_chat":"Mitoxantron","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"380","hoat_chat":"Oxaliplatin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"381","hoat_chat":"Paclitaxel","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán 50% đối với dạng liposome và dạng polymeric micelle; thanh toán 100% đối với các dạng khác."},{"stt":"382","hoat_chat":"Pemetrexed","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán ung thư phổi không tế bào nhỏ, ung thư trung biểu mô màng phổi ác tính; thanh toán 50%."},{"stt":"383","hoat_chat":"Procarbazin","duong_dung":"Uống","luu_y":""},{"stt":"384","hoat_chat":"Tegafur-uracil (UFT hoặc UFUR)","duong_dung":"Uống","luu_y":""},{"stt":"385","hoat_chat":"Tegafur + gimeracil +  \noteracil kali","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh  toán điều trị ung thư dạ dày  di căn; thanh toán 70%."},{"stt":"386","hoat_chat":"Temozolomid","duong_dung":"Uống","luu_y":""},{"stt":"387","hoat_chat":"Tretinoin (All-trans retinoic acid)","duong_dung":"Uống","luu_y":""},{"stt":"388","hoat_chat":"Vinblastin sulfat","duong_dung":"Tiêm","luu_y":""},{"stt":"389","hoat_chat":"Vincristin sulfat","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"390","hoat_chat":"Vinorelbin","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"391","hoat_chat":"Afatinib dimaleate","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán 50%."},{"stt":"392","hoat_chat":"Bevacizumab","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán tại bệnh viện hạng đặc biệt, hạng I và bệnh viện chuyên khoa ung bướu hạng II; thanh toán 50%"},{"stt":"393","hoat_chat":"Cetuximab","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị ung thư đại trực tràng di căn thuộc type RAS tự nhiên; ung thư tế bào vảy vùng đầu, cổ. Sử dụng tại Bệnh viện hạng đặc biệt, hạng I và bệnh viện chuyên khoa ung bướu hạng II. Thanh toán 50%."},{"stt":"394","hoat_chat":"Erlotinib","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị ung thư phổi thể không phải tế bào nhỏ (non-small cell lung cancer) có EGFR dương tính (epidermall growth factor receptor); thanh toán 50%."},{"stt":"395","hoat_chat":"Gefitinib","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị ung thư phổi thể không phải tế bào nhỏ (non-small cell lung cancer) có EGFR dương tính (epidermall growth factor receptor); thanh toán 50%."},{"stt":"396","hoat_chat":"Imatinib","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị bệnh bạch cầu tủy mạn (CML); u mô đệm dạ dày ruột (GIST). Thanh toán 80%."},{"stt":"397","hoat_chat":"Nilotinib","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh  toán khi điều trị bệnh bạch  cầu tủy mạn (CML) không  dung nạp hoặc kháng lại với  thuốc Imatinib; thanh toán  80%."},{"stt":"398","hoat_chat":"Nimotuzumab","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán 50%."},{"stt":"399","hoat_chat":"Pazopanib","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán 50%."},{"stt":"400","hoat_chat":"Rituximab","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị u lympho không phải Hodgkin (non-Hodgkin lymphoma) tế bào B có CD20 dương tính."},{"stt":"401","hoat_chat":"Sorafenib","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán 50% đối với điều trị ung thư tế bào biểu mô gan, ung thư biểu mô tuyến giáp biệt hóa tiến triển tại chỗ hoặc di căn đã thất bại điều trị với iod phóng xạ; thanh toán 30% đối với điều trị ung thư tế bào biểu mô thận tiến triển."},{"stt":"402","hoat_chat":"Trastuzumab","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán tại bệnh viện hạng đặc biệt, hạng I và bệnh viện chuyên khoa ung bướu hạng II. Thanh toán 60% đối với ung thư vú có HER2 dương tính; thanh toán 50% đối với ung thư dạ dày tiến xa hoặc di căn có HER2 dương tính."},{"stt":"403","hoat_chat":"Abiraterone acetate","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị ung thư tiền liệt tuyến sau khi thất bại với điều trị nội tiết, hoặc sau khi thất bại với điều trị hóa trị; thanh toán 30%."},{"stt":"404","hoat_chat":"Anastrozol","duong_dung":"Uống","luu_y":""},{"stt":"405","hoat_chat":"Bicalutamid","duong_dung":"Uống","luu_y":""},{"stt":"406","hoat_chat":"Degarelix","duong_dung":"Tiêm","luu_y":""},{"stt":"407","hoat_chat":"Exemestan","duong_dung":"Uống","luu_y":""},{"stt":"408","hoat_chat":"Flutamid","duong_dung":"Uống","luu_y":""},{"stt":"409","hoat_chat":"Fulvestrant","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán 50%."},{"stt":"410","hoat_chat":"Goserelin acetat","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"411","hoat_chat":"Letrozol","duong_dung":"Uống","luu_y":""},{"stt":"412","hoat_chat":"Leuprorelin acetat","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"413","hoat_chat":"Tamoxifen","duong_dung":"Uống","luu_y":""},{"stt":"414","hoat_chat":"Triptorelin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"415","hoat_chat":"Anti thymocyte globulin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"416","hoat_chat":"Azathioprin","duong_dung":"Uống","luu_y":""},{"stt":"417","hoat_chat":"Các kháng thể gắn với  \ninterferon ở người","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh  toán cho trẻ em dưới 6 tuổi  nhiễm trùng đường hô hấp  trên cấp tính điều trị nội trú."},{"stt":"418","hoat_chat":"Ciclosporin","duong_dung":"Uống","luu_y":""},{"stt":"419","hoat_chat":"Basiliximab","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán 50%."},{"stt":"420","hoat_chat":"Glycyl funtumin  \n(hydroclorid)","duong_dung":"Tiêm","luu_y":"Quỹ bảo hiểm y tế thanh  toán cho chỉ định bổ trợ  trong điều trị ung thư."},{"stt":"421","hoat_chat":"Lenalidomid","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh  toán 50%."},{"stt":"422","hoat_chat":"Mycophenolat","duong_dung":"Uống","luu_y":""},{"stt":"423","hoat_chat":"Tacrolimus","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán theo chỉ định của một trong các trường hợp sau:\n'- Tờ hướng dẫn sử dụng thuốc kèm theo hồ sơ đăng ký thuốc đã được cấp phép;\n'- Hướng dẫn chẩn đoán điều trị huyết học, ghép tạng của Bộ Y tế;\n'- Đối với người bệnh: ghép tim, ghép phổi, ghép tụy, ghép chi thể, ghép ruột; viêm thận Lupus ở người lớn hoặc trẻ em không đáp ứng đầy đủ hoặc kháng với corticoids; hội chứng thận hư ở người lớn hoặc trẻ em không đáp ứng đầy đủ hoặc kháng với corticoids hoặc không dung nạp corticoids."},{"stt":"424","hoat_chat":"Thalidomid","duong_dung":"Uống","luu_y":""},{"stt":"425","hoat_chat":"Clodronat disodium","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"426","hoat_chat":"Pamidronat","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"427","hoat_chat":"Alfuzosin","duong_dung":"Uống","luu_y":""},{"stt":"428","hoat_chat":"Dutasterid","duong_dung":"Uống","luu_y":""},{"stt":"429","hoat_chat":"Flavoxat","duong_dung":"Uống","luu_y":""},{"stt":"430","hoat_chat":"Lipidosterol serenoarepense (Lipid-sterol của Serenoa repens)","duong_dung":"Uống","luu_y":""},{"stt":"431","hoat_chat":"Pinene + camphene + cineol  + fenchone + borneol +  anethol","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh  toán điều trị sau tán sỏi;  hoặc điều trị sỏi niệu quản <7mm."},{"stt":"432","hoat_chat":"Solifenacin succinate","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán 70%."},{"stt":"433","hoat_chat":"Tamsulosin hydroclorid","duong_dung":"Uống","luu_y":""},{"stt":"434","hoat_chat":"Levodopa + carbidopa","duong_dung":"Uống","luu_y":""},{"stt":"435","hoat_chat":"Levodopa + carbidopa monohydrat + entacapone","duong_dung":"Uống","luu_y":""},{"stt":"436","hoat_chat":"Levodopa + benserazid","duong_dung":"Uống","luu_y":""},{"stt":"437","hoat_chat":"Piribedil","duong_dung":"Uống","luu_y":""},{"stt":"438","hoat_chat":"Pramipexol","duong_dung":"Uống","luu_y":""},{"stt":"439","hoat_chat":"Tolcapon","duong_dung":"Uống","luu_y":""},{"stt":"440","hoat_chat":"Rotigotine","duong_dung":"Dán ngoài da","luu_y":"Quỹ bảo hiểm y tế thanh  toán 50%."},{"stt":"441","hoat_chat":"Trihexyphenidyl hydroclorid","duong_dung":"Uống","luu_y":""},{"stt":"442","hoat_chat":"Acid folic (vitamin B9)","duong_dung":"Uống","luu_y":""},{"stt":"443","hoat_chat":"Sắt fumarat","duong_dung":"Uống","luu_y":""},{"stt":"444","hoat_chat":"Sắt (III) hydroxyd polymaltose","duong_dung":"Uống","luu_y":""},{"stt":"445","hoat_chat":"Sắt protein succinylat","duong_dung":"Uống","luu_y":""},{"stt":"446","hoat_chat":"Sắt sucrose (hay dextran)","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"447","hoat_chat":"Sắt sulfat","duong_dung":"Uống","luu_y":""},{"stt":"448","hoat_chat":"Sắt ascorbat + acid folic","duong_dung":"Uống","luu_y":""},{"stt":"449","hoat_chat":"Sắt fumarat + acid folic","duong_dung":"Uống","luu_y":""},{"stt":"450","hoat_chat":"Sắt (III) hydroxyd polymaltose + acid folic","duong_dung":"Uống","luu_y":""},{"stt":"451","hoat_chat":"Sắt sulfat + acid folic","duong_dung":"Uống","luu_y":""},{"stt":"452","hoat_chat":"Carbazochrom","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"453","hoat_chat":"Cilostazol","duong_dung":"Uống","luu_y":""},{"stt":"454","hoat_chat":"Enoxaparin (natri)","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"455","hoat_chat":"Etamsylat","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"456","hoat_chat":"Heparin (natri)","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"457","hoat_chat":"Nadroparin","duong_dung":"Tiêm","luu_y":""},{"stt":"458","hoat_chat":"Phytomenadion (vitamin K1)","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"459","hoat_chat":"Protamin sulfat","duong_dung":"Tiêm","luu_y":""},{"stt":"460","hoat_chat":"Tranexamic acid","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"461","hoat_chat":"Triflusal","duong_dung":"Uống","luu_y":""},{"stt":"462","hoat_chat":"Warfarin (muối natri)","duong_dung":"Uống","luu_y":""},{"stt":"463","hoat_chat":"Albumin","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán trong trường hợp: Nồng độ albumin máu ≤ 2,5 g/dl  hoặc sốc hoặc hội chứng suy hô hấp tiến triển; thanh toán 70%."},{"stt":"464","hoat_chat":"Albumin + Immunoglobulin A + Immunoglobulin G + Immunoglobulin M","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán trong những trường hợp sốc do nguyên nhân: bỏng, chấn thương, mất nước, nhiễm trùng nặng."},{"stt":"465","hoat_chat":"Huyết tương","duong_dung":"Tiêm truyền","luu_y":""},{"stt":"466","hoat_chat":"Khối bạch cầu","duong_dung":"Tiêm truyền","luu_y":""},{"stt":"467","hoat_chat":"Khối hồng cầu","duong_dung":"Tiêm truyền","luu_y":""},{"stt":"468","hoat_chat":"Khối tiểu cầu","duong_dung":"Tiêm truyền","luu_y":""},{"stt":"469","hoat_chat":"Máu toàn phần","duong_dung":"Tiêm truyền","luu_y":""},{"stt":"470","hoat_chat":"Phức hợp kháng yếu tố ức  chế yếu tố VIII bắc cầu  (Factor Eight Inhibitor  \nBypassing Activity - FEIBA)","duong_dung":"Tiêm truyền","luu_y":"Quỹ bảo hiểm y tế thanh  toán trong trường hợp: \n- Điều trị chảy máu trên  người bệnh ưa chảy máu nhóm A có kèm theo yếu tố  ức chế yếu tố VIII; \n- Điều trị chảy máu trên  người bệnh ưa chảy máu  nhóm B có kèm theo yếu tố  ức chế yếu tố IX; \n- Điều trị chảy máu trên  người bệnh khác (không  phải bệnh nhân hemophilia)  mà có yếu tố ức chế yếu tố  VIII mắc phải hoặc yếu tố  ức chế yếu tố IX mắc phải; - Điều trị chảy máu phẫu  thuật trên người bệnh có  kèm theo yếu tố ức chế cần  được phẫu thuật."},{"stt":"471","hoat_chat":"Yếu tố VIIa","duong_dung":"Tiêm","luu_y":""},{"stt":"472","hoat_chat":"Yếu tố VIII","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"473","hoat_chat":"Yếu tố IX","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"474","hoat_chat":"Yếu tố VIII + yếu tố von  Willebrand","duong_dung":"Tiêm truyền","luu_y":""},{"stt":"475","hoat_chat":"Dextran 40","duong_dung":"Tiêm truyền","luu_y":""},{"stt":"476","hoat_chat":"Dextran 60","duong_dung":"Tiêm truyền","luu_y":""},{"stt":"477","hoat_chat":"Dextran 70","duong_dung":"Tiêm truyền","luu_y":""},{"stt":"478","hoat_chat":"Gelatin","duong_dung":"Tiêm truyền","luu_y":""},{"stt":"479","hoat_chat":"Gelatin succinyl + natri clorid + natri hydroxyd","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"480","hoat_chat":"Tinh bột este hóa (hydroxyethyl starch)","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị giảm thể tích tuần hoàn do mất máu cấp khi sử dụng dịch truyền đơn thuần không cải thiện lâm sàng; điều trị sốt xuất huyết Dengue nặng theo Hướng dẫn chẩn đoán và điều trị sốt xuất huyết Dengue của Bộ Y tế"},{"stt":"481","hoat_chat":"Deferasirox","duong_dung":"Uống","luu_y":""},{"stt":"482","hoat_chat":"Deferipron","duong_dung":"Uống","luu_y":""},{"stt":"483","hoat_chat":"Eltrombopag","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán khi điều trị xuất huyết giảm tiểu cầu miễn dịch mạn tính ở người lớn kháng trị với cắt lách."},{"stt":"484","hoat_chat":"Erythropoietin (dạng alfa)","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"485","hoat_chat":"Filgrastim","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"486","hoat_chat":"Methoxy polyethylene glycol-epoetin beta","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"487","hoat_chat":"Pegfilgrastim","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"488","hoat_chat":"Diltiazem","duong_dung":"Uống","luu_y":""},{"stt":"489","hoat_chat":"Glyceryl trinitrat (Nitroglycerin)","duong_dung":"Bơm dưới lưỡi, tiêm","luu_y":""},{"stt":"490","hoat_chat":"Isosorbid (dinitrat hoặc mononitrat)","duong_dung":"Uống","luu_y":""},{"stt":"491","hoat_chat":"Nicorandil","duong_dung":"Uống","luu_y":""},{"stt":"492","hoat_chat":"Trimetazidin","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị triệu chứng ở người bệnh đau thắt ngực ổn định không được kiểm soát đầy đủ hoặc người bệnh không dung nạp với các liệu pháp điều trị khác."},{"stt":"493","hoat_chat":"Adenosin triphosphat","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"494","hoat_chat":"Amiodarone hydrochloride","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"495","hoat_chat":"Isoprenalin","duong_dung":"Tiêm, uống","luu_y":"Quỹ bảo hiểm y tế thanh  toán điều trị cấp cứu trụy  tim mạch, block tim, co thắt  phế quản trong gây mê."},{"stt":"496","hoat_chat":"Propranolol hydroclorid","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"497","hoat_chat":"Sotalol","duong_dung":"Uống","luu_y":""},{"stt":"498","hoat_chat":"Verapamil hydroclorid","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"499","hoat_chat":"Acebutolol","duong_dung":"Uống","luu_y":""},{"stt":"500","hoat_chat":"Amlodipin","duong_dung":"Uống","luu_y":""},{"stt":"501","hoat_chat":"Amlodipin + atorvastatin","duong_dung":"Uống","luu_y":""},{"stt":"502","hoat_chat":"Amlodipin + losartan","duong_dung":"Uống","luu_y":""},{"stt":"503","hoat_chat":"Amlodipin + lisinopril","duong_dung":"Uống","luu_y":""},{"stt":"504","hoat_chat":"Amlodipin + indapamid","duong_dung":"Uống","luu_y":""},{"stt":"505","hoat_chat":"Amlodipin + indapamid + perindopril","duong_dung":"Uống","luu_y":""},{"stt":"506","hoat_chat":"Amlodipin + telmisartan","duong_dung":"Uống","luu_y":""},{"stt":"507","hoat_chat":"Amlodipin + valsartan","duong_dung":"Uống","luu_y":""},{"stt":"508","hoat_chat":"Amlodipin + valsartan + hydrochlorothiazid","duong_dung":"Uống","luu_y":""},{"stt":"509","hoat_chat":"Atenolol","duong_dung":"Uống","luu_y":""},{"stt":"510","hoat_chat":"Benazepril hydroclorid","duong_dung":"Uống","luu_y":""},{"stt":"511","hoat_chat":"Bisoprolol","duong_dung":"Uống","luu_y":""},{"stt":"512","hoat_chat":"Bisoprolol + hydroclorothiazid","duong_dung":"Uống","luu_y":""},{"stt":"513","hoat_chat":"Candesartan","duong_dung":"Uống","luu_y":""},{"stt":"514","hoat_chat":"Candesartan + hydrochlorothiazid","duong_dung":"Uống","luu_y":""},{"stt":"515","hoat_chat":"Captopril","duong_dung":"Uống","luu_y":""},{"stt":"516","hoat_chat":"Captopril +  \nhydroclorothiazid","duong_dung":"Uống","luu_y":""},{"stt":"517","hoat_chat":"Carvedilol","duong_dung":"Uống","luu_y":""},{"stt":"518","hoat_chat":"Cilnidipin","duong_dung":"Uống","luu_y":""},{"stt":"519","hoat_chat":"Clonidin","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"520","hoat_chat":"Doxazosin","duong_dung":"Uống","luu_y":""},{"stt":"521","hoat_chat":"Enalapril","duong_dung":"Uống","luu_y":""},{"stt":"522","hoat_chat":"Enalapril + hydrochlorothiazid","duong_dung":"Uống","luu_y":""},{"stt":"523","hoat_chat":"Felodipin","duong_dung":"Uống","luu_y":""},{"stt":"524","hoat_chat":"Felodipin + metoprolol  tartrat","duong_dung":"Uống","luu_y":""},{"stt":"525","hoat_chat":"Hydralazin","duong_dung":"Tiêm truyền","luu_y":""},{"stt":"526","hoat_chat":"Imidapril","duong_dung":"Uống","luu_y":""},{"stt":"527","hoat_chat":"Indapamid","duong_dung":"Uống","luu_y":""},{"stt":"528","hoat_chat":"Irbesartan","duong_dung":"Uống","luu_y":""},{"stt":"529","hoat_chat":"Irbesartan +  \nhydroclorothiazid","duong_dung":"Uống","luu_y":""},{"stt":"530","hoat_chat":"Lacidipin","duong_dung":"Uống","luu_y":""},{"stt":"531","hoat_chat":"Lercanidipin hydroclorid","duong_dung":"Uống","luu_y":""},{"stt":"532","hoat_chat":"Lisinopril","duong_dung":"Uống","luu_y":""},{"stt":"533","hoat_chat":"Lisinopril + hydroclorothiazid","duong_dung":"Uống","luu_y":""},{"stt":"534","hoat_chat":"Losartan","duong_dung":"Uống","luu_y":""},{"stt":"535","hoat_chat":"Losartan + hydroclorothiazid","duong_dung":"Uống","luu_y":""},{"stt":"536","hoat_chat":"Methyldopa","duong_dung":"Uống","luu_y":""},{"stt":"537","hoat_chat":"Metoprolol","duong_dung":"Uống","luu_y":""},{"stt":"538","hoat_chat":"Nebivolol","duong_dung":"Uống","luu_y":""},{"stt":"539","hoat_chat":"Nicardipin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"540","hoat_chat":"Nifedipin","duong_dung":"Uống","luu_y":""},{"stt":"541","hoat_chat":"Perindopril","duong_dung":"Uống","luu_y":""},{"stt":"542","hoat_chat":"Perindopril + amlodipin","duong_dung":"Uống","luu_y":""},{"stt":"543","hoat_chat":"Perindopril + indapamid","duong_dung":"Uống","luu_y":""},{"stt":"544","hoat_chat":"Quinapril","duong_dung":"Uống","luu_y":""},{"stt":"545","hoat_chat":"Ramipril","duong_dung":"Uống","luu_y":""},{"stt":"546","hoat_chat":"Rilmenidin","duong_dung":"Uống","luu_y":""},{"stt":"547","hoat_chat":"Telmisartan","duong_dung":"Uống","luu_y":""},{"stt":"548","hoat_chat":"Telmisartan + hydroclorothiazid","duong_dung":"Uống","luu_y":""},{"stt":"549","hoat_chat":"Valsartan","duong_dung":"Uống","luu_y":""},{"stt":"550","hoat_chat":"Valsartan +  \nhydroclorothiazid","duong_dung":"Uống","luu_y":""},{"stt":"551","hoat_chat":"Heptaminol hydroclorid","duong_dung":"Uống","luu_y":""},{"stt":"552","hoat_chat":"Carvedilol","duong_dung":"Uống","luu_y":""},{"stt":"553","hoat_chat":"Digoxin","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"554","hoat_chat":"Dobutamin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"555","hoat_chat":"Dopamin hydroclorid","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"556","hoat_chat":"Ivabradin","duong_dung":"Uống","luu_y":""},{"stt":"557","hoat_chat":"Milrinon","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"558","hoat_chat":"Acenocoumarol","duong_dung":"Uống","luu_y":""},{"stt":"559","hoat_chat":"Acetylsalicylic acid (DL-lysin-acetylsalicylat)","duong_dung":"Uống","luu_y":""},{"stt":"560","hoat_chat":"Acetylsalicylic acid + clopidogrel","duong_dung":"Uống","luu_y":""},{"stt":"561","hoat_chat":"Alteplase","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"562","hoat_chat":"Apixaban","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán trong điều trị COVID-19 theo hướng dẫn chẩn đoán và điều trị COVID-19 của Bộ Y tế."},{"stt":"563","hoat_chat":"Clopidogrel","duong_dung":"Uống","luu_y":""},{"stt":"564","hoat_chat":"Dabigatran","duong_dung":"Uống","luu_y":""},{"stt":"565","hoat_chat":"Dipyridamol +  \nacetylsalicylic acid","duong_dung":"Uống","luu_y":""},{"stt":"566","hoat_chat":"Eptifibatid","duong_dung":"Tiêm","luu_y":""},{"stt":"567","hoat_chat":"Fondaparinux sodium","duong_dung":"Tiêm","luu_y":""},{"stt":"568","hoat_chat":"Rivaroxaban","duong_dung":"Uống","luu_y":""},{"stt":"569","hoat_chat":"Streptokinase","duong_dung":"Tiêm","luu_y":"Quỹ bảo hiểm y tế thanh  toán khi dùng để tiêm; hoặc  sử dụng để bơm rửa khoang  màng phổi trong trường hợp  viêm màng phổi hoặc mủ  màng phổi."},{"stt":"570","hoat_chat":"Tenecteplase","duong_dung":"Tiêm","luu_y":""},{"stt":"571","hoat_chat":"Ticagrelor","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán 70%."},{"stt":"572","hoat_chat":"Urokinase","duong_dung":"Tiêm","luu_y":"Quỹ bảo hiểm y tế thanh  toán khi dùng để tiêm; hoặc  sử dụng để bơm rửa khoang  màng phổi trong trường hợp  viêm màng phổi hoặc mủ  màng phổi."},{"stt":"573","hoat_chat":"Atorvastatin","duong_dung":"Uống","luu_y":""},{"stt":"574","hoat_chat":"Atorvastatin + ezetimibe","duong_dung":"Uống","luu_y":""},{"stt":"575","hoat_chat":"Bezafibrat","duong_dung":"Uống","luu_y":""},{"stt":"576","hoat_chat":"Ciprofibrat","duong_dung":"Uống","luu_y":""},{"stt":"577","hoat_chat":"Ezetimibe","duong_dung":"Uống","luu_y":""},{"stt":"578","hoat_chat":"Fenofibrat","duong_dung":"Uống","luu_y":""},{"stt":"579","hoat_chat":"Fluvastatin","duong_dung":"Uống","luu_y":""},{"stt":"580","hoat_chat":"Gemfibrozil","duong_dung":"Uống","luu_y":""},{"stt":"581","hoat_chat":"Lovastatin","duong_dung":"Uống","luu_y":""},{"stt":"582","hoat_chat":"Pravastatin","duong_dung":"Uống","luu_y":""},{"stt":"583","hoat_chat":"Rosuvastatin","duong_dung":"Uống","luu_y":""},{"stt":"584","hoat_chat":"Simvastatin","duong_dung":"Uống","luu_y":""},{"stt":"585","hoat_chat":"Simvastatin + ezetimibe","duong_dung":"Uống","luu_y":""},{"stt":"586","hoat_chat":"Bosentan","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị tăng áp lực động mạch phổi; thanh toán 50%."},{"stt":"587","hoat_chat":"Iloprost","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"588","hoat_chat":"Prostaglandin E1","duong_dung":"Tiêm","luu_y":"Quỹ bảo hiểm y tế thanh  toán điều trị cấp cứu trường  hợp mở ống động mạch cho  trẻ sơ sinh mắc dị tật tim  bẩm sinh còn ống động  mạch."},{"stt":"589","hoat_chat":"Fructose 1,6 diphosphat","duong_dung":"Tiêm","luu_y":"Quỹ bảo hiểm y tế thanh  toán trong các trường hợp: - Thiếu máu cơ tim cục bộ,  nhồi máu cơ tim diện rộng  giai đoạn sớm, phẫu thuật  tim thời gian tuần hoàn  ngoài cơ thể; \n- Sốc do tai biến tim, do  chấn thương, do chảy máu,  do đột quỵ hoặc nhiễm  trùng nặng; \n- Sau phẫu thuật gan hoặc bị  bỏng nặng."},{"stt":"590","hoat_chat":"Indomethacin","duong_dung":"Tiêm","luu_y":"Quỹ bảo hiểm y tế thanh toán  điều trị đóng chứng còn ống  động mạch ở trẻ đẻ non."},{"stt":"591","hoat_chat":"Magnesi clorid + kali clorid  + procain hydroclorid","duong_dung":"Tiêm","luu_y":""},{"stt":"592","hoat_chat":"Naftidrofuryl","duong_dung":"Uống","luu_y":""},{"stt":"593","hoat_chat":"Nimodipin","duong_dung":"Tiêm/truyền, uống","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị xuất huyết màng não do phình mạch não hoặc do chấn thương."},{"stt":"594","hoat_chat":"Nitric oxid (nitrogen  \nmonoxid) (NO)","duong_dung":"Khí nén","luu_y":"Quỹ bảo hiểm y tế thanh  toán điều trị tăng áp lực  động mạch phổi ở trẻ em; sử  dụng trong và sau phẫu  thuật, can thiệp tim mạch."},{"stt":"595","hoat_chat":"Succinic acid + nicotinamid + inosine + riboflavin natri phosphat","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị đột quỵ thiếu máu cục bộ giai đoạn cấp tính."},{"stt":"596","hoat_chat":"Sulbutiamin","duong_dung":"Uống","luu_y":""},{"stt":"597","hoat_chat":"Tolazolin","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"598","hoat_chat":"Acitretin","duong_dung":"Uống","luu_y":""},{"stt":"599","hoat_chat":"Adapalen","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"600","hoat_chat":"Alpha - terpineol","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"601","hoat_chat":"Amorolfin","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"602","hoat_chat":"Azelaic acid","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"603","hoat_chat":"Benzoic acid + salicylic acid","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"604","hoat_chat":"Benzoyl peroxid","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"605","hoat_chat":"Bột talc","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"606","hoat_chat":"Calcipotriol","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"607","hoat_chat":"Calcipotriol + betamethason  dipropionat","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"608","hoat_chat":"Capsaicin","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"609","hoat_chat":"Clotrimazol","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"609","hoat_chat":"Clotrimazol","duong_dung":"Nhỏ tai","luu_y":""},{"stt":"610","hoat_chat":"Clobetasol propionat","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"611","hoat_chat":"Clobetasol butyrat","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"612","hoat_chat":"Cortison","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"613","hoat_chat":"Cồn A.S.A","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"614","hoat_chat":"Cồn boric","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"615","hoat_chat":"Cồn BSI","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"616","hoat_chat":"Crotamiton","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"617","hoat_chat":"Dapson","duong_dung":"Uống","luu_y":""},{"stt":"618","hoat_chat":"Desonid","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"619","hoat_chat":"Dexpanthenol  \n(panthenol, vitamin B5)","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"620","hoat_chat":"Diethylphtalat","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"621","hoat_chat":"S-bioallethrin +  \npiperonyl butoxid","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"622","hoat_chat":"Flumethason + clioquinol","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"623","hoat_chat":"Fusidic acid","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"624","hoat_chat":"Fusidic acid + betamethason","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"625","hoat_chat":"Fusidic acid + hydrocortison","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"626","hoat_chat":"Isotretinoin","duong_dung":"Uống, dùng ngoài","luu_y":""},{"stt":"627","hoat_chat":"Kẽm oxid","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"628","hoat_chat":"Mometason furoat","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"629","hoat_chat":"Mometason furoat +  \nsalicylic acid","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"630","hoat_chat":"Mupirocin","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"631","hoat_chat":"Natri hydrocarbonat","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"632","hoat_chat":"Nepidermin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"633","hoat_chat":"Nước oxy già","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"634","hoat_chat":"Para aminobenzoic acid","duong_dung":"Uống","luu_y":""},{"stt":"635","hoat_chat":"Recombinant human Epidermal Growth Factor (rhEGF)","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị tổn thương loét nặng do đái tháo đường độ 3, độ 4."},{"stt":"636","hoat_chat":"Salicylic acid","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"637","hoat_chat":"Salicylic acid +  \nbetamethason dipropionat","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"638","hoat_chat":"Secukinumab","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán 50%."},{"stt":"639","hoat_chat":"Tacrolimus","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"640","hoat_chat":"Tretinoin","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"641","hoat_chat":"Trolamin","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"642","hoat_chat":"Tyrothricin","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"643","hoat_chat":"Urea","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"644","hoat_chat":"Ustekinumab","duong_dung":"Tiêm","luu_y":"Quỹ bảo hiểm y tế thanh  toán 50%."},{"stt":"645","hoat_chat":"Fluorescein (natri)","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"646","hoat_chat":"Adipiodon (meglumin)","duong_dung":"Tiêm truyền","luu_y":""},{"stt":"647","hoat_chat":"Amidotrizoat","duong_dung":"Tiêm","luu_y":""},{"stt":"648","hoat_chat":"Bari sulfat","duong_dung":"Uống","luu_y":""},{"stt":"649","hoat_chat":"Ethyl ester của acid béo iod hóa trong dầu hạt thuốc phiện","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"650","hoat_chat":"Gadobenic acid  \n(dimeglumin)","duong_dung":"Tiêm","luu_y":"Quỹ bảo hiểm y tế thanh  toán tiêm tĩnh mạch trong  chụp chiếu gan."},{"stt":"651","hoat_chat":"Gadobutrol","duong_dung":"Tiêm","luu_y":""},{"stt":"652","hoat_chat":"Gadoteric acid","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"653","hoat_chat":"Iobitridol","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"654","hoat_chat":"Iodixanol","duong_dung":"Tiêm","luu_y":"Quỹ bảo hiểm y tế thanh  toán 50%."},{"stt":"655","hoat_chat":"Iohexol","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"656","hoat_chat":"Iod (dưới dạng Iopamidol 612,4mg/ml)","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"657","hoat_chat":"Iopromid acid","duong_dung":"Tiêm","luu_y":""},{"stt":"658","hoat_chat":"Ioxitalamat natri +  \nioxitalamat meglumin","duong_dung":"Tiêm","luu_y":""},{"stt":"659","hoat_chat":"Muối natri và meglumin của  acid ioxaglic","duong_dung":"Tiêm","luu_y":""},{"stt":"660","hoat_chat":"Polidocanol","duong_dung":"Tiêm","luu_y":""},{"stt":"661","hoat_chat":"Cồn 70°","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"662","hoat_chat":"Cồn iod","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"663","hoat_chat":"Đồng sulfat","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"664","hoat_chat":"Povidon iodin","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"665","hoat_chat":"Natri hypoclorid đậm đặc","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"666","hoat_chat":"Natri clorid","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"667","hoat_chat":"Furosemid","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"668","hoat_chat":"Furosemid + spironolacton","duong_dung":"Uống","luu_y":""},{"stt":"669","hoat_chat":"Hydroclorothiazid","duong_dung":"Uống","luu_y":""},{"stt":"670","hoat_chat":"Spironolacton","duong_dung":"Uống","luu_y":""},{"stt":"671","hoat_chat":"Aluminum phosphat","duong_dung":"Uống","luu_y":""},{"stt":"672","hoat_chat":"Attapulgit mormoiron hoạt hóa + hỗn hợp magnesi carbonat-nhôm hydroxyd","duong_dung":"Uống","luu_y":""},{"stt":"673","hoat_chat":"Bismuth","duong_dung":"Uống","luu_y":""},{"stt":"674","hoat_chat":"Cimetidin","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"675","hoat_chat":"Famotidin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"676","hoat_chat":"Guaiazulen + dimethicon","duong_dung":"Uống","luu_y":""},{"stt":"677","hoat_chat":"Lansoprazol","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh  toán theo chỉ định trong tờ  hướng dẫn sử dụng thuốc  kèm theo hồ sơ đăng ký  thuốc đã được cấp phép  hoặc hướng dẫn chẩn đoán  và điều trị của Bộ Y tế hoặc  chỉ định dự phòng loét dạ  dày tá tràng, xuất huyết tiêu  hóa tại dạ dày, tá tràng do  stress ở bệnh nhân hồi sức  tích cực."},{"stt":"678","hoat_chat":"Magnesi hydroxyd + nhôm  hydroxyd","duong_dung":"Uống","luu_y":""},{"stt":"679","hoat_chat":"Magnesi hydroxyd + nhôm hydroxyd + simethicon","duong_dung":"Uống","luu_y":""},{"stt":"680","hoat_chat":"Magnesi trisilicat + nhôm hydroxyd","duong_dung":"Uống","luu_y":""},{"stt":"681","hoat_chat":"Nizatidin","duong_dung":"Uống","luu_y":""},{"stt":"682","hoat_chat":"Omeprazol","duong_dung":"Tiêm/truyền, uống","luu_y":"Quỹ BHYT thanh toán theo chỉ định trong tờ hướng dẫn sử dụng thuốc kèm theo hồ sơ đăng ký thuốc đã được cấp phép hoặc hướng dẫn chẩn đoán và điều trị của Bộ Y tế hoặc chỉ định dự phòng loét dạ dày tá tràng, xuất huyết tiêu hóa tại dạ dày, tá tràng do stress ở bệnh nhân hồi sức tích cực."},{"stt":"683","hoat_chat":"Esomeprazol","duong_dung":"Tiêm/truyền, uống","luu_y":"Quỹ BHYT thanh toán theo chỉ định trong tờ hướng dẫn sử dụng thuốc kèm theo hồ sơ đăng ký thuốc đã được cấp phép hoặc hướng dẫn chẩn đoán và điều trị của Bộ Y tế hoặc chỉ định dự phòng loét dạ dày tá tràng, xuất huyết tiêu hóa tại dạ dày, tá tràng do stress ở bệnh nhân hồi sức tích cực."},{"stt":"684","hoat_chat":"Pantoprazol","duong_dung":"Tiêm/truyền, uống","luu_y":"Quỹ BHYT thanh toán theo chỉ định trong tờ hướng dẫn sử dụng thuốc kèm theo hồ sơ đăng ký thuốc đã được cấp phép hoặc hướng dẫn chẩn đoán và điều trị của Bộ Y tế hoặc chỉ định dự phòng loét dạ dày tá tràng, xuất huyết tiêu hóa tại dạ dày, tá tràng do stress ở bệnh nhân hồi sức tích cực."},{"stt":"685","hoat_chat":"Rabeprazol","duong_dung":"Tiêm/truyền, uống","luu_y":"Quỹ BHYT thanh toán theo chỉ định trong tờ hướng dẫn sử dụng thuốc kèm theo hồ sơ đăng ký thuốc đã được cấp phép hoặc hướng dẫn chẩn đoán và điều trị của Bộ Y tế hoặc chỉ định dự phòng loét dạ dày tá tràng, xuất huyết tiêu hóa tại dạ dày, tá tràng do stress ở bệnh nhân hồi sức tích cực."},{"stt":"686","hoat_chat":"Ranitidin","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"687","hoat_chat":"Ranitidin + bismuth +  \nsucralfat","duong_dung":"Uống","luu_y":""},{"stt":"688","hoat_chat":"Rebamipid","duong_dung":"Uống","luu_y":""},{"stt":"689","hoat_chat":"Sucralfat","duong_dung":"Uống","luu_y":""},{"stt":"690","hoat_chat":"Dimenhydrinat","duong_dung":"Uống","luu_y":""},{"stt":"691","hoat_chat":"Domperidon","duong_dung":"Uống","luu_y":""},{"stt":"692","hoat_chat":"Granisetron hydroclorid","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"693","hoat_chat":"Metoclopramid","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"694","hoat_chat":"Ondansetron","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"695","hoat_chat":"Palonosetron hydroclorid","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"696","hoat_chat":"Alverin citrat","duong_dung":"Uống","luu_y":""},{"stt":"697","hoat_chat":"Alverin citrat + simethicon","duong_dung":"Uống","luu_y":""},{"stt":"698","hoat_chat":"Atropin sulfat","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"699","hoat_chat":"Drotaverin clohydrat","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"700","hoat_chat":"Hyoscin butylbromid","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"701","hoat_chat":"Mebeverin hydroclorid","duong_dung":"Uống","luu_y":""},{"stt":"702","hoat_chat":"Papaverin hydroclorid","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"703","hoat_chat":"Phloroglucinol hydrat +  trimethyl phloroglucinol","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"704","hoat_chat":"Tiemonium methylsulfat","duong_dung":"Tiêm","luu_y":""},{"stt":"705","hoat_chat":"Tiropramid hydroclorid","duong_dung":"Uống","luu_y":""},{"stt":"706","hoat_chat":"Bisacodyl","duong_dung":"Uống","luu_y":""},{"stt":"707","hoat_chat":"Docusate natri","duong_dung":"Uống, thụt  hậu môn/   trực tràng","luu_y":""},{"stt":"708","hoat_chat":"Glycerol","duong_dung":"Thụt hậu   môn/ trực   tràng","luu_y":""},{"stt":"709","hoat_chat":"Lactulose","duong_dung":"Uống","luu_y":""},{"stt":"710","hoat_chat":"Macrogol","duong_dung":"Uống","luu_y":""},{"stt":"711","hoat_chat":"Macrogol + natri sulfat + natri bicarbonat + natri clorid + kali clorid","duong_dung":"Uống","luu_y":""},{"stt":"712","hoat_chat":"Magnesi sulfat","duong_dung":"Uống","luu_y":""},{"stt":"713","hoat_chat":"Monobasic natri phosphat + dibasic natri phosphat","duong_dung":"Thụt hậu môn/ trực tràng","luu_y":""},{"stt":"714","hoat_chat":"Sorbitol","duong_dung":"Uống","luu_y":""},{"stt":"715","hoat_chat":"Sorbitol + natri citrat","duong_dung":"Thụt hậu môn/ trực tràng","luu_y":""},{"stt":"716","hoat_chat":"Attapulgit mormoiron hoạt hóa","duong_dung":"Uống","luu_y":""},{"stt":"717","hoat_chat":"Bacillus subtilis","duong_dung":"Uống","luu_y":""},{"stt":"718","hoat_chat":"Bacillus clausii","duong_dung":"Uống","luu_y":""},{"stt":"719","hoat_chat":"Berberin (hydroclorid)","duong_dung":"Uống","luu_y":""},{"stt":"720","hoat_chat":"Dioctahedral smectit","duong_dung":"Uống","luu_y":""},{"stt":"721","hoat_chat":"Diosmectit","duong_dung":"Uống","luu_y":""},{"stt":"722","hoat_chat":"Gelatin tannat","duong_dung":"Uống","luu_y":""},{"stt":"723","hoat_chat":"Kẽm sulfat","duong_dung":"Uống, dùng ngoài","luu_y":""},{"stt":"724","hoat_chat":"Kẽm gluconat","duong_dung":"Uống","luu_y":""},{"stt":"725","hoat_chat":"Lactobacillus acidophilus","duong_dung":"Uống","luu_y":""},{"stt":"726","hoat_chat":"Loperamid","duong_dung":"Uống","luu_y":""},{"stt":"727","hoat_chat":"Nifuroxazid","duong_dung":"Uống","luu_y":""},{"stt":"728","hoat_chat":"Racecadotril","duong_dung":"Uống","luu_y":""},{"stt":"729","hoat_chat":"Saccharomyces boulardii","duong_dung":"Uống","luu_y":""},{"stt":"730","hoat_chat":"Cao ginkgo biloba + heptaminol clohydrat + troxerutin","duong_dung":"Uống","luu_y":""},{"stt":"731","hoat_chat":"Diosmin","duong_dung":"Uống","luu_y":""},{"stt":"732","hoat_chat":"Diosmin + hesperidin","duong_dung":"Uống","luu_y":""},{"stt":"733","hoat_chat":"Amylase + lipase + protease","duong_dung":"Uống","luu_y":""},{"stt":"734","hoat_chat":"Citrullin malat","duong_dung":"Uống","luu_y":""},{"stt":"735","hoat_chat":"Itoprid","duong_dung":"Uống","luu_y":""},{"stt":"736","hoat_chat":"L-Ornithin - L- aspartat","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hểm y tế thanh toán điều trị bệnh não do gan từ giai đoạn 2 trở lên theo hệ thống phân loại West Haven"},{"stt":"737","hoat_chat":"Mesalazin (mesalamin)","duong_dung":"Uống","luu_y":""},{"stt":"738","hoat_chat":"Octreotid","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"739","hoat_chat":"Simethicon","duong_dung":"Uống","luu_y":""},{"stt":"740","hoat_chat":"Silymarin","duong_dung":"Uống","luu_y":""},{"stt":"741","hoat_chat":"Somatostatin","duong_dung":"Tiêm truyền","luu_y":""},{"stt":"742","hoat_chat":"Terlipressin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"743","hoat_chat":"Trimebutin maleat","duong_dung":"Uống","luu_y":""},{"stt":"744","hoat_chat":"Ursodeoxycholic acid","duong_dung":"Uống","luu_y":""},{"stt":"745","hoat_chat":"Otilonium bromide","duong_dung":"Uống","luu_y":""},{"stt":"746","hoat_chat":"Beclometason (dipropionat)","duong_dung":"Xịt mũi,   xịt họng","luu_y":""},{"stt":"747","hoat_chat":"Betamethason","duong_dung":"Tiêm, uống, nhỏ mắt,   nhỏ tai,   nhỏ mũi,   dùng ngoài","luu_y":""},{"stt":"748","hoat_chat":"Danazol","duong_dung":"Uống","luu_y":""},{"stt":"749","hoat_chat":"Dexamethason","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế không thanh toán trường hợp tiêm trong dịch kính, tiêm nội nhãn."},{"stt":"749","hoat_chat":"Dexamethason","duong_dung":"Uống","luu_y":""},{"stt":"750","hoat_chat":"Dexamethason phosphat +  neomycin","duong_dung":"Nhỏ mắt,   nhỏ mũi","luu_y":""},{"stt":"751","hoat_chat":"Betamethasone +  \ndexchlorpheniramin","duong_dung":"Uống","luu_y":""},{"stt":"752","hoat_chat":"Fludrocortison acetat","duong_dung":"Uống","luu_y":""},{"stt":"753","hoat_chat":"Fluocinolon acetonid","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"754","hoat_chat":"Hydrocortison","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"755","hoat_chat":"Methyl prednisolon","duong_dung":"Uống, tiêm","luu_y":""},{"stt":"756","hoat_chat":"Prednisolon acetat (natri phosphate)","duong_dung":"Nhỏ mắt, uống","luu_y":""},{"stt":"757","hoat_chat":"Prednison","duong_dung":"Uống","luu_y":""},{"stt":"758","hoat_chat":"Triamcinolon acetonid","duong_dung":"Tiêm, dùng ngoài","luu_y":""},{"stt":"759","hoat_chat":"Triamcinolon","duong_dung":"Uống","luu_y":""},{"stt":"760","hoat_chat":"Triamcinolon + econazol","duong_dung":"Dùng ngoài","luu_y":""},{"stt":"761","hoat_chat":"Cyproteron acetat","duong_dung":"Uống","luu_y":""},{"stt":"762","hoat_chat":"Somatropin","duong_dung":"Tiêm","luu_y":"Quỹ bảo hiểm y tế thanh  toán điều trị thiếu hụt  \nhormon tăng trưởng, trẻ em  sinh ra nhỏ hơn so với tuổi  thai, hội chứng Turner,  chậm tăng trưởng do suy  thận mãn và hội chứng  Prader-Willi. Đối với trẻ em  dưới 16 tuổi thanh toán  70%; các đối tượng còn lại  thanh toán 50%."},{"stt":"763","hoat_chat":"Dydrogesteron","duong_dung":"Uống","luu_y":""},{"stt":"764","hoat_chat":"Estradiol valerate","duong_dung":"Uống, tiêm","luu_y":""},{"stt":"765","hoat_chat":"Estriol","duong_dung":"Đặt âm đạo","luu_y":""},{"stt":"766","hoat_chat":"Estrogen + norgestrel","duong_dung":"Uống","luu_y":""},{"stt":"767","hoat_chat":"Ethinyl estradiol","duong_dung":"Uống","luu_y":""},{"stt":"768","hoat_chat":"Ethinyl estradiol +  \ncyproterone acetate","duong_dung":"Uống","luu_y":""},{"stt":"769","hoat_chat":"Lynestrenol","duong_dung":"Uống","luu_y":""},{"stt":"770","hoat_chat":"Nandrolon decanoat","duong_dung":"Tiêm","luu_y":""},{"stt":"771","hoat_chat":"Norethisteron","duong_dung":"Uống","luu_y":""},{"stt":"772","hoat_chat":"Nomegestrol acetat","duong_dung":"Uống","luu_y":""},{"stt":"773","hoat_chat":"Promestrien","duong_dung":"Dùng ngoài, đặt âm đạo","luu_y":""},{"stt":"774","hoat_chat":"Progesteron","duong_dung":"Đặt âm đạo, dùng ngoài, uống","luu_y":""},{"stt":"775","hoat_chat":"Raloxifen","duong_dung":"Uống","luu_y":""},{"stt":"776","hoat_chat":"Testosteron \n(acetat, propionat,  \nundecanoat)","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"777","hoat_chat":"Acarbose","duong_dung":"Uống","luu_y":""},{"stt":"778","hoat_chat":"Dapagliflozin","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán 70%."},{"stt":"779","hoat_chat":"Empagliflozin","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán 70%."},{"stt":"780","hoat_chat":"Glibenclamid + metformin","duong_dung":"Uống","luu_y":""},{"stt":"781","hoat_chat":"Gliclazid","duong_dung":"Uống","luu_y":""},{"stt":"782","hoat_chat":"Gliclazid + metformin","duong_dung":"Uống","luu_y":""},{"stt":"783","hoat_chat":"Glimepirid","duong_dung":"Uống","luu_y":""},{"stt":"784","hoat_chat":"Glimepirid + Metformin","duong_dung":"Uống","luu_y":""},{"stt":"785","hoat_chat":"Glipizid","duong_dung":"Uống","luu_y":""},{"stt":"786","hoat_chat":"Insulin analog tác dụng nhanh, ngắn (dạng Aspart)","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"786","hoat_chat":"Insulin analog tác dụng nhanh, ngắn (dạng Lispro)","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"786","hoat_chat":"Insulin người tác dụng nhanh, ngắn (dạng Glulisine)","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"787","hoat_chat":"Insulin analog tác dụng chậm, kéo dài (Glargine)","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"787","hoat_chat":"Insulin Detemir (rDNA)","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"787","hoat_chat":"Insulin Degludec","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"788","hoat_chat":"Insulin analog trộn, hỗn hợp","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán 50% đối với dạng trộn. hỗn hợp giữa insulin Degludec và insulin Aspart; thanh toán 100% đối với các dạng còn lại."},{"stt":"789","hoat_chat":"Insulin người tác dụng nhanh, ngắn","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"790","hoat_chat":"Insulin người tác dụng trung bình, trung gian","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"791","hoat_chat":"Insulin người trộn, hỗn hợp","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"792","hoat_chat":"Linagliptin","duong_dung":"Uống","luu_y":""},{"stt":"793","hoat_chat":"Linagliptin + metformin","duong_dung":"Uống","luu_y":""},{"stt":"794","hoat_chat":"Liraglutide","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán 30% cho bệnh nhân đái tháo đường típ 2 đáp ứng đồng thời các tiêu chí sau:\n'- Trên 40 tuổi, BMI > 23, mắc đái tháo đường típ 2, có bệnh lý tim mạch hoặc tăng huyết áp;\n'- Không kiểm soát đường huyết (HbA1C>9) sau thời gain 3 tháng;\n'- Suy thận nồng độ CrCl < 59 ml/phút."},{"stt":"795","hoat_chat":"Metformin","duong_dung":"Uống","luu_y":""},{"stt":"796","hoat_chat":"Repaglinid","duong_dung":"Uống","luu_y":""},{"stt":"797","hoat_chat":"Saxagliptin","duong_dung":"Uống","luu_y":""},{"stt":"798","hoat_chat":"Saxagliptin + metformin","duong_dung":"Uống","luu_y":""},{"stt":"799","hoat_chat":"Sitagliptin","duong_dung":"Uống","luu_y":""},{"stt":"800","hoat_chat":"Sitagliptin + metformin","duong_dung":"Uống","luu_y":""},{"stt":"801","hoat_chat":"Vildagliptin","duong_dung":"Uống","luu_y":""},{"stt":"802","hoat_chat":"Vildagliptin + metformin","duong_dung":"Uống","luu_y":""},{"stt":"803","hoat_chat":"Carbimazol","duong_dung":"Uống","luu_y":""},{"stt":"804","hoat_chat":"Levothyroxin (muối natri)","duong_dung":"Uống","luu_y":""},{"stt":"805","hoat_chat":"Propylthiouracil (PTU)","duong_dung":"Uống","luu_y":""},{"stt":"806","hoat_chat":"Thiamazol","duong_dung":"Uống","luu_y":""},{"stt":"807","hoat_chat":"Desmopressin","duong_dung":"Uống","luu_y":""},{"stt":"808","hoat_chat":"Vasopressin","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"809","hoat_chat":"Alglucosidase alfa","duong_dung":"Tiêm truyền","luu_y":"Quỹ bảo hiểm y tế thanh  toán 30%."},{"stt":"810","hoat_chat":"Immune globulin","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị xuất huyết giảm tiểu cầu tự miễn không đáp ứng với corticoid, hội chứng Guillain Barre, bệnh Kawasaki; điều trị nhiễm trùng nặng có giảm IgG; điều trị thay thế cho bệnh nhân thiếu hụt IgG; điều trị bệnh tay-chân-miệng; điều trị phơi nhiễm sởi, điều trị sởi khi có tình trạng nhiễm trùng nặng hoặc tình trạng suy hô hấp tiến triển nhanh hoặc viêm não  theo hướng dẫn chẩn đoán và điều trị sởi của Bộ Y tế; điều trị Hội chứng viêm đa hệ thống liên quan COVID-19 ở trẻ em của Bộ Y tế; điều trị hội chứng giảm tiểu cầu, huyết khối sau tiêm vắc xin COVID-19 theo hướng dẫn chẩn đoán và điều trị hội chứng giảm tiểu cầu, huyết khối sau tiêm vắc xin COVID-19 của Bộ Y tế."},{"stt":"811","hoat_chat":"Huyết thanh kháng bạch hầu","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"812","hoat_chat":"Huyết thanh kháng dại","duong_dung":"Tiêm","luu_y":""},{"stt":"813","hoat_chat":"Huyết thanh kháng nọc rắn","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"814","hoat_chat":"Huyết thanh kháng uốn ván","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"815","hoat_chat":"Baclofen","duong_dung":"Uống","luu_y":""},{"stt":"816","hoat_chat":"Botulinum toxin (Clostridium botulinum type A toxin - Haemagglutinin complex)","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"817","hoat_chat":"Eperison","duong_dung":"Uống","luu_y":""},{"stt":"818","hoat_chat":"Mephenesin","duong_dung":"Uống","luu_y":""},{"stt":"819","hoat_chat":"Pyridostigmin bromid","duong_dung":"Uống","luu_y":""},{"stt":"820","hoat_chat":"Rivastigmine","duong_dung":"Uống, dán ngoài da","luu_y":""},{"stt":"821","hoat_chat":"Tizanidin hydroclorid","duong_dung":"Uống","luu_y":""},{"stt":"822","hoat_chat":"Thiocolchicosid","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"823","hoat_chat":"Tolperison","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh  toán điều trị co cứng cơ sau  đột quỵ."},{"stt":"824","hoat_chat":"Acetazolamid","duong_dung":"Uống","luu_y":""},{"stt":"825","hoat_chat":"Atropin sulfat","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"826","hoat_chat":"Besifloxacin","duong_dung":"Nhỏ mắt","luu_y":"Quỹ bảo hiểm y tế thanh  toán điều trị nhiễm khuẩn do  tụ cầu vàng trong trường hợp  đã kháng kháng sinh khác;  sử dụng tại bệnh viện hạng đặc biệt, hạng I và bệnh viện  chuyên khoa mắt hạng II."},{"stt":"827","hoat_chat":"Betaxolol","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"828","hoat_chat":"Bimatoprost","duong_dung":"Nhỏ mắt","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị tại bệnh viện hạng đặc biệt, hạng I, II và bệnh viện chuyên khoa mắt hạng III."},{"stt":"829","hoat_chat":"Bimatoprost + timolol","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"830","hoat_chat":"Brimonidin tartrat","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"831","hoat_chat":"Brimonidin tartrate; Timolol","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"832","hoat_chat":"Brinzolamid","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"833","hoat_chat":"Brinzolamid + Timolol","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"834","hoat_chat":"Bromfenac","duong_dung":"Nhỏ mắt","luu_y":"Quỹ bảo hiểm y tế thanh  toán điều trị viêm sau phẫu  thuật đục thủy tinh thể; sử  dụng tại bệnh viện hạng đặc  biệt, hạng I, II và bệnh viện  chuyên khoa mắt hạng III."},{"stt":"835","hoat_chat":"Carbomer","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"836","hoat_chat":"Cyclosporin","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"837","hoat_chat":"Dexamethason + framycetin","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"838","hoat_chat":"Dexpanthenol","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"839","hoat_chat":"Dinatri inosin  \nmonophosphat","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"840","hoat_chat":"Fluorometholon","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"841","hoat_chat":"Glycerin","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"842","hoat_chat":"Hexamidine di-isetionat","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"843","hoat_chat":"Hyaluronidase","duong_dung":"Tiêm","luu_y":""},{"stt":"844","hoat_chat":"Hydroxypropylmethylcellulose","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"845","hoat_chat":"Indomethacin","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"846","hoat_chat":"Kali iodid + natri iodid","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"847","hoat_chat":"Latanoprost","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"848","hoat_chat":"Latanoprost +  \nTimolol maleat","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"849","hoat_chat":"Loteprednol etabonat","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"850","hoat_chat":"Moxifloxacin +  \ndexamethason","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"851","hoat_chat":"Natamycin","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"852","hoat_chat":"Natri carboxymethylcellulose (natri CMC)","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"853","hoat_chat":"Natri carboxymethylcellulose + Glycerin","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"854","hoat_chat":"Natri clorid","duong_dung":"Nhỏ mắt, xịt mũi","luu_y":""},{"stt":"855","hoat_chat":"Natri diquafosol","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"856","hoat_chat":"Natri hyaluronat","duong_dung":"Nhỏ mắt, tiêm","luu_y":""},{"stt":"857","hoat_chat":"Nepafenac","duong_dung":"Nhỏ mắt","luu_y":"Quỹ bảo hiểm y tế thanh toán  điều trị viêm sau phẫu thuật  đục thủy tinh thể trên bệnh  nhân đái tháo đường; sử dụng  tại bệnh viện hạng đặc biệt,  hạng I, II và bệnh viện  \nchuyên khoa mắt hạng III."},{"stt":"858","hoat_chat":"Olopatadin hydroclorid","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"859","hoat_chat":"Pemirolast Kali","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"860","hoat_chat":"Pilocarpin","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"861","hoat_chat":"Pirenoxin","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"862","hoat_chat":"Polyethylen glycol + \npropylen glycol","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"863","hoat_chat":"Ranibizumab","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị tại khoa mắt bệnh viện hạng đặc biệt; bệnh viện chuyên khoa mắt hạng I, II; bệnh viện Hữu Nghị, Thống Nhất và C Đà Nẵng đối với đối tượng theo Hướng dẫn số 52-HD-BTCTW ngày 02 tháng 12 năm 2005 của Ban Tổ chức Trung ương đăng ký khám bệnh, chữa bệnh bảo hiểm y tế ban đầu tại bệnh viện"},{"stt":"864","hoat_chat":"Tafluprost","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"865","hoat_chat":"Tetracain","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"866","hoat_chat":"Tetryzolin","duong_dung":"Nhỏ mắt, nhỏ mũi","luu_y":""},{"stt":"867","hoat_chat":"Timolol","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"868","hoat_chat":"Travoprost","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"869","hoat_chat":"Travoprost + timolol","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"870","hoat_chat":"Tropicamid","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"871","hoat_chat":"Tropicamide + phenylephrine hydroclorid","duong_dung":"Nhỏ mắt","luu_y":""},{"stt":"872","hoat_chat":"Betahistin","duong_dung":"Uống","luu_y":""},{"stt":"873","hoat_chat":"Cồn boric","duong_dung":"Nhỏ tai","luu_y":""},{"stt":"874","hoat_chat":"Fluticason furoat","duong_dung":"Hô hấp","luu_y":""},{"stt":"875","hoat_chat":"Fluticason propionat","duong_dung":"Hô hấp","luu_y":""},{"stt":"876","hoat_chat":"Naphazolin","duong_dung":"Nhỏ mũi","luu_y":""},{"stt":"877","hoat_chat":"Natri borat","duong_dung":"Nhỏ tai","luu_y":""},{"stt":"878","hoat_chat":"Phenazon + lidocain \nhydroclorid","duong_dung":"Nhỏ tai","luu_y":""},{"stt":"879","hoat_chat":"Rifamycin","duong_dung":"Nhỏ tai","luu_y":""},{"stt":"880","hoat_chat":"Tixocortol pivalat","duong_dung":"Dùng ngoài, phun mù","luu_y":""},{"stt":"881","hoat_chat":"Triprolidin hydroclorid +  pseudoephedrin","duong_dung":"Uống","luu_y":""},{"stt":"882","hoat_chat":"Tyrothricin + benzocain+ benzalkonium","duong_dung":"Uống","luu_y":""},{"stt":"883","hoat_chat":"Xylometazolin","duong_dung":"Hô hấp","luu_y":""},{"stt":"884","hoat_chat":"Carbetocin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"885","hoat_chat":"Carboprost tromethamin","duong_dung":"Tiêm","luu_y":""},{"stt":"886","hoat_chat":"Dinoproston","duong_dung":"Đặt âm đạo","luu_y":""},{"stt":"887","hoat_chat":"Levonorgestrel","duong_dung":"Đặt âm đạo","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị chứng rong kinh vô căn."},{"stt":"888","hoat_chat":"Methyl ergometrin maleat","duong_dung":"Tiêm","luu_y":""},{"stt":"889","hoat_chat":"Oxytocin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"890","hoat_chat":"Ergometrin \n(hydrogen maleat)","duong_dung":"Tiêm","luu_y":""},{"stt":"891","hoat_chat":"Misoprostol","duong_dung":"Uống","luu_y":""},{"stt":"892","hoat_chat":"Atosiban","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"893","hoat_chat":"Papaverin","duong_dung":"Uống","luu_y":""},{"stt":"894","hoat_chat":"Salbutamol sulfat","duong_dung":"Tiêm","luu_y":""},{"stt":"895","hoat_chat":"Dung dịch lọc màng bụng","duong_dung":"Thẩm phân phúc mạc","luu_y":""},{"stt":"896","hoat_chat":"Dung dịch lọc máu dùng  trong thận nhân tạo  \n(bicarbonat hoặc acetat)","duong_dung":"Dung dịch   thẩm phân","luu_y":""},{"stt":"897","hoat_chat":"Dung dịch lọc máu liên tục (có hoặc không có chống đông bằng citrat; có hoặc không có chứa lactat)","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"898","hoat_chat":"Bromazepam","duong_dung":"Uống","luu_y":""},{"stt":"899","hoat_chat":"Clorazepat","duong_dung":"Uống","luu_y":""},{"stt":"900","hoat_chat":"Diazepam","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"901","hoat_chat":"Etifoxin chlohydrat","duong_dung":"Uống","luu_y":""},{"stt":"902","hoat_chat":"Hydroxyzin","duong_dung":"Uống","luu_y":""},{"stt":"903","hoat_chat":"Lorazepam","duong_dung":"Uống, tiêm","luu_y":""},{"stt":"904","hoat_chat":"Rotundin","duong_dung":"Uống","luu_y":""},{"stt":"905","hoat_chat":"Zolpidem","duong_dung":"Uống","luu_y":""},{"stt":"906","hoat_chat":"Zopiclon","duong_dung":"Uống","luu_y":""},{"stt":"907","hoat_chat":"Acid thioctic (Meglumin thioctat)","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị rối loạn cảm giác do bệnh viêm đa dây thần kinh đái tháo đường."},{"stt":"908","hoat_chat":"Alprazolam","duong_dung":"Uống","luu_y":""},{"stt":"909","hoat_chat":"Amisulprid","duong_dung":"Uống","luu_y":""},{"stt":"910","hoat_chat":"Clorpromazin","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"911","hoat_chat":"Clozapin","duong_dung":"Uống","luu_y":""},{"stt":"912","hoat_chat":"Clonazepam","duong_dung":"Uống","luu_y":""},{"stt":"913","hoat_chat":"Donepezil","duong_dung":"Uống","luu_y":""},{"stt":"914","hoat_chat":"Flupentixol","duong_dung":"Uống","luu_y":""},{"stt":"915","hoat_chat":"Fluphenazin decanoat","duong_dung":"Tiêm","luu_y":""},{"stt":"916","hoat_chat":"Haloperidol","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"917","hoat_chat":"Levomepromazin","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"918","hoat_chat":"Levosulpirid","duong_dung":"Uống","luu_y":""},{"stt":"919","hoat_chat":"Meclophenoxat","duong_dung":"Uống, tiêm","luu_y":""},{"stt":"920","hoat_chat":"Olanzapin","duong_dung":"Uống","luu_y":""},{"stt":"921","hoat_chat":"Quetiapin","duong_dung":"Uống","luu_y":""},{"stt":"922","hoat_chat":"Risperidon","duong_dung":"Uống","luu_y":""},{"stt":"923","hoat_chat":"Sulpirid","duong_dung":"Uống","luu_y":""},{"stt":"924","hoat_chat":"Thioridazin","duong_dung":"Uống","luu_y":""},{"stt":"925","hoat_chat":"Tofisopam","duong_dung":"Uống","luu_y":""},{"stt":"926","hoat_chat":"Ziprasidon","duong_dung":"Uống","luu_y":""},{"stt":"927","hoat_chat":"Zuclopenthixol","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"928","hoat_chat":"Amitriptylin hydroclorid","duong_dung":"Uống","luu_y":""},{"stt":"929","hoat_chat":"Citalopram","duong_dung":"Uống","luu_y":""},{"stt":"930","hoat_chat":"Clomipramin","duong_dung":"Uống","luu_y":""},{"stt":"931","hoat_chat":"Fluoxetin","duong_dung":"Uống","luu_y":""},{"stt":"932","hoat_chat":"Fluvoxamin","duong_dung":"Uống","luu_y":""},{"stt":"933","hoat_chat":"Methylphenidate  \nhydrochloride","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh  toán tại bệnh viện hạng đặc  biệt, hạng I, II và bệnh viện  chuyên khoa tâm thần."},{"stt":"934","hoat_chat":"Mirtazapin","duong_dung":"Uống","luu_y":""},{"stt":"935","hoat_chat":"Paroxetin","duong_dung":"Uống","luu_y":""},{"stt":"936","hoat_chat":"Sertralin","duong_dung":"Uống","luu_y":""},{"stt":"937","hoat_chat":"Tianeptin","duong_dung":"Uống","luu_y":""},{"stt":"938","hoat_chat":"Venlafaxin","duong_dung":"Uống","luu_y":""},{"stt":"939","hoat_chat":"Acetyl leucin","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"940","hoat_chat":"Peptide (Cerebrolysin concentrate)","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán 50% trong các trường hợp:\n'- Đột quỵ cấp tính;\n'- Sau chấn thương sọ não;\n'- Sau phẫu thuật chấn thương sọ não;\n'- Sau phẫu thuật thần kinh sọ não."},{"stt":"941","hoat_chat":"Choline alfoscerat","duong_dung":"Tiêm","luu_y":"Quỹ bảo hiểm y tế thanh toán 50% trong các trường hợp:\n'- Đột quỵ cấp tính;\n'- Sau chấn thương sọ não;\n'- Sau phẫu thuật chấn thương sọ não;\n'- Sau phẫu thuật thần kinh sọ não."},{"stt":"942","hoat_chat":"Citicolin","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán 50% trong các trường hợp:\n'- Đột quỵ cấp tính;\n'- Sau chấn thương sọ não;\n'- Sau phẫu thuật chấn thương sọ não;\n'- Sau phẫu thuật thần kinh sọ não."},{"stt":"943","hoat_chat":"Panax notoginseng saponins","duong_dung":"Tiêm/truyền, uống","luu_y":"Quỹ bảo hiểm y tế thanh toán 50% trong các trường hợp:\n'- Đột quỵ cấp tính;\n'- Sau chấn thương sọ não;\n'- Sau phẫu thuật chấn thương sọ não;\n'- Sau phẫu thuật thần kinh sọ não."},{"stt":"944","hoat_chat":"Cytidin-5monophosphat  disodium + uridin","duong_dung":"Tiêm, uống","luu_y":"Quỹ bảo hiểm y tế thanh  toán điều trị tổn thương thần  kinh ngoại biên."},{"stt":"945","hoat_chat":"Galantamin","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị:\n'- Bệnh lý thần kinh ngoại vi liên quan đến rối loạn vận động trong trường hợp người bệnh nội trú;\n'- Liệt vận động sau khi mắc bệnh tủy sống;\n'- Mất khả năng vận động sau đột quỵ, liệt não ở trẻ em;\n'- Liệt ruột và bàng quang sau phẫu thuật;\n'- Giải độc Atropin và chất tương tự Atropin."},{"stt":"945","hoat_chat":"Galantamin","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị chứng sa sút trí tuệ từ nhẹ đến trung bình trong bệnh Alzheimer"},{"stt":"946","hoat_chat":"Ginkgo biloba","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị đau do viêm động mạch (đau thắt khi đi); rối loạn thị giác (bệnh võng mạc do tiểu đường); tai mũi họng (chóng mặt, ù tai, giảm thính lực), rối loạn tuần hoàn thần kinh cảm giác do thiếu máu cục bộ; hội chứng Raynaud."},{"stt":"947","hoat_chat":"Mecobalamin","duong_dung":"Tiêm/truyền, uống","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị thiếu máu hồng cầu khổng lồ, bệnh lý thần kinh ngoại biên do thiếu vitamin B12."},{"stt":"948","hoat_chat":"Pentoxifyllin","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán trong điều trị rối loạn mạch máu ngoại vi."},{"stt":"949","hoat_chat":"Piracetam","duong_dung":"Tiêm/truyền","luu_y":"Quỹ bảo hiểm y tế thanh toán trong điều trị giật rung cơ có nguồn gốc vỏ não."},{"stt":"949","hoat_chat":"Piracetam","duong_dung":"Uống","luu_y":""},{"stt":"950","hoat_chat":"Vinpocetin","duong_dung":"Tiêm/truyền, uống","luu_y":"Quỹ bảo hiểm y tế thanh toán trong điều trị triệu chứng thần kinh của chứng sa sút trí tuệ do nguyên nhân mạch."},{"stt":"951","hoat_chat":"Aminophylin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"952","hoat_chat":"Bambuterol","duong_dung":"Uống","luu_y":""},{"stt":"953","hoat_chat":"Budesonid","duong_dung":"Hít/Khí dung","luu_y":""},{"stt":"954","hoat_chat":"Budesonid + formoterol","duong_dung":"Hít","luu_y":""},{"stt":"955","hoat_chat":"Fenoterol + ipratropium","duong_dung":"Hô hấp","luu_y":""},{"stt":"956","hoat_chat":"Formoterol fumarat","duong_dung":"Khí dung","luu_y":""},{"stt":"957","hoat_chat":"Indacaterol","duong_dung":"Hít","luu_y":""},{"stt":"958","hoat_chat":"Indacaterol+ glycopyrronium","duong_dung":"Hô hấp","luu_y":""},{"stt":"959","hoat_chat":"Ipratropium","duong_dung":"Uống, khí dung","luu_y":""},{"stt":"960","hoat_chat":"Natri montelukast","duong_dung":"Uống","luu_y":""},{"stt":"961","hoat_chat":"Omalizumab","duong_dung":"Tiêm","luu_y":"Quỹ bảo hiểm y tế thanh  toán với chỉ định điều trị  cho người bệnh từ 12 tuổi  trở lên bị hen do dị ứng dai  dẳng kéo dài với mức độ  nặng (bậc 5 GINA), có test  da hoặc phản ứng dị nguyên  dương tính (in vitro) và  không đáp ứng đầy đủ bằng  corticoid liều cao và kết hợp  LABA; thanh toán 50%."},{"stt":"962","hoat_chat":"Salbutamol sulfat","duong_dung":"Hô hấp, uống","luu_y":""},{"stt":"963","hoat_chat":"Salbutamol + ipratropium","duong_dung":"Hô hấp","luu_y":""},{"stt":"964","hoat_chat":"Salmeterol + fluticason propionat","duong_dung":"Hít qua đường miệng","luu_y":""},{"stt":"965","hoat_chat":"Terbutalin","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"966","hoat_chat":"Theophylin","duong_dung":"Uống","luu_y":""},{"stt":"967","hoat_chat":"Tiotropium","duong_dung":"Hô hấp","luu_y":""},{"stt":"968","hoat_chat":"Ambroxol","duong_dung":"Uống","luu_y":""},{"stt":"969","hoat_chat":"Bromhexin hydroclorid","duong_dung":"Uống","luu_y":""},{"stt":"970","hoat_chat":"Carbocistein","duong_dung":"Uống","luu_y":""},{"stt":"971","hoat_chat":"Carbocistein + promethazin","duong_dung":"Uống","luu_y":""},{"stt":"972","hoat_chat":"Codein camphosulphonat + sulfogaiacol + cao mềm grindelia","duong_dung":"Uống","luu_y":""},{"stt":"973","hoat_chat":"Codein + Terpin hydrat","duong_dung":"Uống","luu_y":""},{"stt":"974","hoat_chat":"Dextromethorphan","duong_dung":"Uống","luu_y":""},{"stt":"975","hoat_chat":"Eprazinon","duong_dung":"Uống","luu_y":""},{"stt":"976","hoat_chat":"Fenspirid","duong_dung":"Uống","luu_y":""},{"stt":"977","hoat_chat":"N-acetylcystein","duong_dung":"Uống","luu_y":""},{"stt":"978","hoat_chat":"Chất ly giải vi khuẩn đông  khô của Haemophilus  \ninfluenzae + Diplococcus  pneumoniae + Klebsiella  pneumoniae and ozaenae +  Staphylococcus \naureus + Streptococcus  pyogenes and viridans +  Neisseria catarrhalis","duong_dung":"Uống","luu_y":""},{"stt":"979","hoat_chat":"Bột talc","duong_dung":"Bơm vào khoang màng phổi","luu_y":""},{"stt":"980","hoat_chat":"Cafein citrat","duong_dung":"Tiêm","luu_y":""},{"stt":"981","hoat_chat":"Mometason furoat","duong_dung":"Xịt mũi","luu_y":""},{"stt":"982","hoat_chat":"Surfactant (Phospholipid  chiết xuất từ phổi lợn hoặc  phổi bò; hoặc chất diện hoạt  chiết xuất từ phổi bò  \n(Bovine lung surfactant))","duong_dung":"Đường nội khí quản","luu_y":""},{"stt":"983","hoat_chat":"Kali clorid","duong_dung":"Uống","luu_y":""},{"stt":"984","hoat_chat":"Magnesi aspartat + kali aspartat","duong_dung":"Uống","luu_y":""},{"stt":"985","hoat_chat":"Natri clorid + kali clorid + natri citrat + glucose khan","duong_dung":"Uống","luu_y":""},{"stt":"986","hoat_chat":"Natri clorid + natri  \nbicarbonat + kali clorid +  dextrose khan","duong_dung":"Uống","luu_y":""},{"stt":"987","hoat_chat":"Acid amin*","duong_dung":"Tiêm/truyền","luu_y":"BBHC"},{"stt":"988","hoat_chat":"Acid amin + điện giải (*)","duong_dung":"Tiêm truyền","luu_y":""},{"stt":"989","hoat_chat":"Acid amin + glucose + điện giải (*)","duong_dung":"Tiêm/truyền","luu_y":"BBHC + Duyệt GĐ"},{"stt":"990","hoat_chat":"Acid amin + glucose + lipid (*)","duong_dung":"Tiêm/truyền","luu_y":"- BBHC + Duyệt GĐ\n- Quỹ bảo hiểm y tế thanh toán: Acid amin + glucose + lipid (*); Acid amin + glucose + lipid + điện giải (*); đối với trường hợp bệnh nặng không nuôi dưỡng được bằng đường tiêu hóa hoặc qua ống xông mà phải nuôi dưỡng đường tĩnh mạch trong: hồi sức, cấp cứu, ung thư, bệnh đường tiêu hóa, suy dinh dưỡng nặng; thanh toán 50%."},{"stt":"991","hoat_chat":"Calci clorid","duong_dung":"Tiêm","luu_y":""},{"stt":"992","hoat_chat":"Glucose","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"993","hoat_chat":"Kali clorid","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"994","hoat_chat":"Magnesi sulfat","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"995","hoat_chat":"Magnesi aspartat + kali aspartat","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"996","hoat_chat":"Manitol","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"997","hoat_chat":"Natri clorid","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"998","hoat_chat":"Natri clorid +  \ndextrose/glucose","duong_dung":"Tiêm truyền","luu_y":""},{"stt":"999","hoat_chat":"Nhũ dịch lipid","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"1000","hoat_chat":"Natri clorid + kali clorid + monobasic kali phosphat + natri acetat + magnesi sulfat + kẽm sulfat + dextrose","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"1001","hoat_chat":"Natri clorid + Kali clorid + Magiesi clorid hexahydrat + Calcium clorid dihydrat + Natri acetat trihydrat + Acid malic","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"1001","hoat_chat":"Ringer lactat","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"1002","hoat_chat":"Natri clorid + natri lactat +  kali clorid + calcium clorid  + glucose \n(Ringer lactat + glucose)","duong_dung":"Tiêm truyền","luu_y":""},{"stt":"1003","hoat_chat":"Nước cất pha tiêm","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"1004","hoat_chat":"Calci acetat","duong_dung":"Uống","luu_y":""},{"stt":"1005","hoat_chat":"Calci carbonat","duong_dung":"Uống","luu_y":""},{"stt":"1006","hoat_chat":"Calci carbonat + calci gluconolactat","duong_dung":"Uống","luu_y":""},{"stt":"1007","hoat_chat":"Calci carbonat + vitamin D3","duong_dung":"Uống","luu_y":""},{"stt":"1008","hoat_chat":"Calci lactat","duong_dung":"Uống","luu_y":""},{"stt":"1009","hoat_chat":"Calci gluconat","duong_dung":"Uống","luu_y":""},{"stt":"1010","hoat_chat":"Calci glubionat","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"1011","hoat_chat":"Calci glucoheptonate + vitamin D3","duong_dung":"Uống","luu_y":""},{"stt":"1012","hoat_chat":"Calci gluconolactat","duong_dung":"Uống","luu_y":""},{"stt":"1013","hoat_chat":"Calci glycerophosphat + magnesi gluconat","duong_dung":"Uống","luu_y":""},{"stt":"1014","hoat_chat":"Calci-3-methyl-2-oxovalerat  + calci-4-methyl-2- \noxovalerat + calci-2-oxo-3- phenylpropionat + calci-3- methyl-2-oxobutyrat +  calci-DL-2-hydroxy-4- \nmethylthiobutyrat + L-lysin  acetat + L-threonin + L tryptophan + L-histidin + L tyrosin (*)","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh  toán điều trị suy thận mãn,  tăng ure máu."},{"stt":"1015","hoat_chat":"Calcitriol","duong_dung":"Uống","luu_y":""},{"stt":"1016","hoat_chat":"Dibencozid","duong_dung":"Uống","luu_y":""},{"stt":"1017","hoat_chat":"Lysin + Vitamin + Khoáng chất","duong_dung":"Uống","luu_y":"Quỹ bảo hiểm y tế thanh toán điều trị cho trẻ em dưới 6 tuổi suy dinh dưỡng."},{"stt":"1018","hoat_chat":"Sắt gluconat + mangan gluconat + đồng gluconat","duong_dung":"Uống","luu_y":""},{"stt":"1019","hoat_chat":"Sắt clorid + kẽm clorid + mangan clorid + đồng clorid + crôm clorid + natri molypdat dihydrat + natri selenid pentahydrat + natri fluorid + kali iodid","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"1020","hoat_chat":"Tricalcium phosphat","duong_dung":"Uống","luu_y":""},{"stt":"1021","hoat_chat":"Vitamin A","duong_dung":"Uống","luu_y":""},{"stt":"1022","hoat_chat":"Vitamin A + D2 (Vitamin A + D3)","duong_dung":"Uống","luu_y":""},{"stt":"1023","hoat_chat":"Vitamin B1","duong_dung":"Tiêm/truyền, uống","luu_y":""},{"stt":"1024","hoat_chat":"Vitamin B1 + B6 + B12","duong_dung":"Tiêm/truyền","luu_y":""},{"stt":"1025","hoat_chat":"Vitamin B2","duong_dung":"Uống","luu_y":""},{"stt":"1026","hoat_chat":"Vitamin B3","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"1027","hoat_chat":"Vitamin B5","duong_dung":"Tiêm, uống, dùng ngoài","luu_y":""},{"stt":"1028","hoat_chat":"Vitamin B6","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"1029","hoat_chat":"Vitamin B6 + magnesi lactat","duong_dung":"Uống","luu_y":""},{"stt":"1030","hoat_chat":"Vitamin B12  \n(cyanocobalamin,  \nhydroxocobalamin)","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"1031","hoat_chat":"Vitamin C","duong_dung":"Uống","luu_y":""},{"stt":"1032","hoat_chat":"Vitamin D2","duong_dung":"Uống","luu_y":""},{"stt":"1033","hoat_chat":"Vitamin D3","duong_dung":"Uống","luu_y":""},{"stt":"1034","hoat_chat":"Vitamin E","duong_dung":"Uống","luu_y":""},{"stt":"1035","hoat_chat":"Vitamin H (B8)","duong_dung":"Uống","luu_y":""},{"stt":"1036","hoat_chat":"Vitamin K","duong_dung":"Tiêm, uống","luu_y":""},{"stt":"1037","hoat_chat":"Vitamin PP","duong_dung":"Uống","luu_y":""}];

// Xây dựng map lookup nhanh
const lookupMap = new Map();
for(const rec of TT20_DATA){
  const key = normalizeHC(rec.hoat_chat);
  if(!lookupMap.has(key)) lookupMap.set(key, []);
  lookupMap.get(key).push(rec);
}

// =====================================================
// HÀM NORMALIZE
// =====================================================

// ═══════════════════════════════════════════════════════════
// BBXNT — Báo cáo Xuất Nhập Tồn thuốc nghiện, hướng thần
// Format: A4 nằm ngang, font Times New Roman 12pt
// Cột: STT | Mã hàng | Tên thuốc | Hàm lượng | ĐVT | Số lô |
//       HSD | Đơn giá | Tồn đầu kỳ | Tổng nhập | Thực xuất | Tồn cuối kỳ | Thành tiền | Ghi chú
// ═══════════════════════════════════════════════════════════

// ── Lấy dữ liệu BBXNT từ drugMap ──────────────────────────
function bbxnt_getData() {
  const rows = [];
  Object.keys(drugMap).sort().forEach(key => {
    const d = drugMap[key];
    const ledger = d.ledger || [];

    // Tồn đầu kỳ: ưu tiên GitHub (kho_bbkk_prev), fallback ton0
    const prevTon = gh_getPrevTon(key);
    const tonDau = prevTon !== null ? prevTon : (d.ton0 || 0);

    // Tổng nhập & xuất từ ledger
    const tongNhap = ledger.filter(e => e.type === 'nhapkho').reduce((s, e) => s + (e.nhap || 0), 0);
    const thucXuat = ledger.filter(e => e.type !== 'nhapkho').reduce((s, e) => s + (e.xuat || 0), 0);
    const tonCuoi  = tonDau + tongNhap - thucXuat;

    // Số lô + hạn dùng: lấy từ nhập kho gần nhất
    const nhapEntries = ledger.filter(e => e.type === 'nhapkho').reverse();
    let soLo = '', hanDung = '', hangSX = '', donGia = 0;
    if (nhapEntries.length > 0) {
      const gc = nhapEntries[0].ghichu || '';
      const loM  = gc.match(/Lô:\s*([^\s|]+)/);
      const hanM = gc.match(/Hạn:\s*(\S+)/);
      if (loM)  soLo    = loM[1];
      if (hanM) hanDung = hanM[1];
      hangSX = nhapEntries[0].noidung || '';
    }
    // Đơn giá từ allNhap
    const nrec = allNhap.find(r => r.ma === key || r.ten === (d.name || key));
    if (nrec && nrec.dongia) donGia = parseFloat(nrec.dongia) || 0;

    const thanhTien = tonCuoi > 0 ? tonCuoi * donGia : 0;

    rows.push({
      ma: d.ma || key,
      ten: d.name || key,
      hl: d.hl || '',
      dvt: d.dvt || '',
      soLo, hanDung, hangSX, donGia,
      tonDau, tongNhap, thucXuat, tonCuoi, thanhTien
    });
  });
  return rows;
}

// ── Format ngày dd/mm/yyyy ─────────────────────────────────
function bbxnt_fmtDate(iso) {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 3) return parts[2] + '/' + parts[1] + '/' + parts[0];
  return iso;
}

// ── Lấy tháng/năm từ dữ liệu ──────────────────────────────
function bbxnt_getMonth() {
  const allDates = [...allXuat, ...allNhap].map(r => r.date).filter(Boolean).sort();
  if (!allDates.length) return { m: '', y: '', label: '', lastDay: '' };
  const last  = allDates[allDates.length - 1];
  const [y, m] = last.split('-');
  const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
  return { m: parseInt(m), y, label: `Tháng ${parseInt(m)} Năm ${y}`, lastDay };
}

// ── Render CSS preview (A4 ngang) ─────────────────────────
function renderBBXNT() {
  if (!processedOK) {
    document.getElementById('bbxnt-preview').innerHTML =
      '<div style="padding:40px;text-align:center;color:#888">⚠ Xử lý dữ liệu trước để xem báo cáo</div>';
    return;
  }
  const rows  = bbxnt_getData();
  const { m, y, label, lastDay } = bbxnt_getMonth();

  // Thống kê
  const grandTonDau  = rows.reduce((s, r) => s + r.tonDau, 0);
  const grandNhap    = rows.reduce((s, r) => s + r.tongNhap, 0);
  const grandXuat    = rows.reduce((s, r) => s + r.thucXuat, 0);
  const grandTon     = rows.reduce((s, r) => s + r.tonCuoi, 0);
  const grandTien    = rows.reduce((s, r) => s + r.thanhTien, 0);

  document.getElementById('bbxnt-stat-hang').textContent   = rows.length;
  document.getElementById('bbxnt-stat-nhap').textContent   = grandNhap.toLocaleString('vi');
  document.getElementById('bbxnt-stat-xuat').textContent   = grandXuat.toLocaleString('vi');
  document.getElementById('bbxnt-stat-cuoi').textContent   = grandTon.toLocaleString('vi');

  // Nhóm theo công ty
  const groups = {};
  rows.forEach(r => {
    const g = r.hangSX || 'Khác';
    if (!groups[g]) groups[g] = [];
    groups[g].push(r);
  });

  let bodyRows = '';
  let gSTT = 0;
  Object.keys(groups).sort((a,b) => a.localeCompare(b, 'vi')).forEach(grp => {
    gSTT++;
    bodyRows += `
      <tr>
        <td colspan="14" style="font-weight:bold;font-size:12pt;background:#f0f0f0;
          padding:3px 6px;border:1px solid #000;font-family:'Times New Roman',serif">
          ${grp}
        </td>
      </tr>`;
    groups[grp].forEach((r, i) => {
      const negStyle = r.tonCuoi < 0 ? 'color:red;font-weight:bold' : '';
      bodyRows += `
        <tr>
          <td style="text-align:center;border:1px solid #000;padding:2px 3px;font-size:11pt;white-space:nowrap">${i + 1}</td>
          <td style="text-align:center;border:1px solid #000;padding:2px 4px;font-size:10pt;white-space:nowrap">${r.ma}</td>
          <td style="border:1px solid #000;padding:2px 5px;font-size:11pt;word-break:break-word;max-width:160px">${r.ten}</td>
          <td style="text-align:center;border:1px solid #000;padding:2px 3px;font-size:10pt">${r.hl}</td>
          <td style="text-align:center;border:1px solid #000;padding:2px 3px;font-size:10pt;white-space:nowrap">${r.dvt}</td>
          <td style="text-align:center;border:1px solid #000;padding:2px 3px;font-size:10pt;white-space:nowrap">${r.soLo}</td>
          <td style="text-align:center;border:1px solid #000;padding:2px 3px;font-size:10pt;white-space:nowrap">${bbxnt_fmtDate(r.hanDung)}</td>
          <td style="text-align:right;border:1px solid #000;padding:2px 5px;font-size:10pt;white-space:nowrap">${r.donGia ? r.donGia.toLocaleString('vi') : ''}</td>
          <td style="text-align:right;border:1px solid #000;padding:2px 5px;font-size:11pt;white-space:nowrap">${r.tonDau.toLocaleString('vi')}</td>
          <td style="text-align:right;border:1px solid #000;padding:2px 5px;font-size:11pt;white-space:nowrap">${r.tongNhap.toLocaleString('vi')}</td>
          <td style="text-align:right;border:1px solid #000;padding:2px 5px;font-size:11pt;white-space:nowrap">${r.thucXuat.toLocaleString('vi')}</td>
          <td style="text-align:right;border:1px solid #000;padding:2px 5px;font-size:11pt;white-space:nowrap;${negStyle}">${r.tonCuoi.toLocaleString('vi')}</td>
          <td style="text-align:right;border:1px solid #000;padding:2px 5px;font-size:10pt;white-space:nowrap">${r.thanhTien ? r.thanhTien.toLocaleString('vi') : ''}</td>
          <td style="border:1px solid #000;padding:2px 3px;font-size:10pt"></td>
        </tr>`;
    });
  });

  // Dòng tổng cộng
  bodyRows += `
    <tr style="font-weight:bold;background:#e8eaf6">
      <td colspan="8" style="text-align:right;border:1px solid #000;padding:3px 8px;font-size:12pt;font-family:'Times New Roman',serif">TỔNG CỘNG</td>
      <td style="text-align:right;border:1px solid #000;padding:3px 5px;font-size:12pt">${grandTonDau.toLocaleString('vi')}</td>
      <td style="text-align:right;border:1px solid #000;padding:3px 5px;font-size:12pt">${grandNhap.toLocaleString('vi')}</td>
      <td style="text-align:right;border:1px solid #000;padding:3px 5px;font-size:12pt">${grandXuat.toLocaleString('vi')}</td>
      <td style="text-align:right;border:1px solid #000;padding:3px 5px;font-size:12pt">${grandTon.toLocaleString('vi')}</td>
      <td style="text-align:right;border:1px solid #000;padding:3px 5px;font-size:12pt">${grandTien ? grandTien.toLocaleString('vi') : ''}</td>
      <td style="border:1px solid #000"></td>
    </tr>`;

  const html = `
<div id="bbxnt-a4" style="
  font-family:'Times New Roman',serif;
  font-size:12pt;
  line-height:1.4;
  padding:10mm 8mm 8mm 15mm;
  background:#fff;
  color:#000;
  width:277mm;
  box-sizing:border-box;
">
  <!-- Header -->
  <table style="width:100%;border:none;margin-bottom:4px">
    <tr>
      <td style="width:40%;text-align:center;vertical-align:top;border:none">
        <div style="font-weight:bold;font-size:11pt">SỞ Y TẾ TP. ĐÀ NẴNG</div>
        <div style="font-weight:bold;font-size:11pt">BỆNH VIỆN ĐÀ NẴNG</div>
        <div style="font-weight:bold;font-size:11pt">KHOA DƯỢC</div>
        <div>──────────────</div>
      </td>
      <td style="width:35%;text-align:center;vertical-align:top;border:none">
        <div style="font-weight:bold;font-size:11pt">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
        <div style="font-weight:bold;font-size:11pt">Độc lập - Tự do - Hạnh phúc</div>
        <div>-----------------------</div>
      </td>
      <td style="width:25%;border:none"></td>
    </tr>
  </table>

  <!-- Title -->
  <div style="text-align:center;margin:6px 0 2px">
    <div style="font-weight:bold;font-size:14pt">BÁO CÁO NHẬP XUẤT TỒN</div>
    <div style="font-weight:bold;font-size:14pt">KHO THUỐC ỐNG,LỌ,GÓI</div>
    <div style="font-weight:bold;font-size:14pt">${label}</div>
  </div>

  <!-- Table -->
  <div style="overflow-x:auto;margin-top:8px">
  <table style="width:100%;border-collapse:collapse;table-layout:fixed">
    <colgroup>
      <col style="width:4%">   <!-- STT -->
      <col style="width:7%">   <!-- Mã hàng -->
      <col style="width:15%">  <!-- Tên thuốc -->
      <col style="width:8%">   <!-- Hàm lượng -->
      <col style="width:4%">   <!-- ĐVT -->
      <col style="width:7%">   <!-- Số lô -->
      <col style="width:7%">   <!-- HSD -->
      <col style="width:8%">   <!-- Đơn giá -->
      <col style="width:7%">   <!-- Tồn đầu -->
      <col style="width:7%">   <!-- Tổng nhập -->
      <col style="width:7%">   <!-- Thực xuất -->
      <col style="width:7%">   <!-- Tồn cuối -->
      <col style="width:9%">   <!-- Thành tiền -->
      <col style="width:5%">   <!-- Ghi chú -->
    </colgroup>
    <thead>
      <tr style="background:#dce8f5">
        <th rowspan="3" style="border:1px solid #000;padding:4px 2px;text-align:center;font-size:11pt;font-weight:bold;vertical-align:middle">STT</th>
        <th rowspan="3" style="border:1px solid #000;padding:4px 2px;text-align:center;font-size:11pt;font-weight:bold;vertical-align:middle">Mã hàng</th>
        <th rowspan="3" style="border:1px solid #000;padding:4px 4px;text-align:center;font-size:11pt;font-weight:bold;vertical-align:middle">Tên Thuốc - Nồng độ - Hàm lượng</th>
        <th rowspan="3" style="border:1px solid #000;padding:4px 2px;text-align:center;font-size:11pt;font-weight:bold;vertical-align:middle">Hàm lượng</th>
        <th rowspan="3" style="border:1px solid #000;padding:4px 2px;text-align:center;font-size:11pt;font-weight:bold;vertical-align:middle">ĐVT</th>
        <th rowspan="3" style="border:1px solid #000;padding:4px 2px;text-align:center;font-size:11pt;font-weight:bold;vertical-align:middle">SỐ LÔ</th>
        <th rowspan="3" style="border:1px solid #000;padding:4px 2px;text-align:center;font-size:11pt;font-weight:bold;vertical-align:middle">HẠN DÙNG</th>
        <th rowspan="3" style="border:1px solid #000;padding:4px 2px;text-align:center;font-size:11pt;font-weight:bold;vertical-align:middle">ĐƠN GIÁ</th>
        <th rowspan="3" style="border:1px solid #000;padding:4px 2px;text-align:center;font-size:11pt;font-weight:bold;vertical-align:middle">TỒN ĐẦU KỲ</th>
        <th rowspan="3" style="border:1px solid #000;padding:4px 2px;text-align:center;font-size:11pt;font-weight:bold;vertical-align:middle">TỔNG NHẬP</th>
        <th rowspan="3" style="border:1px solid #000;padding:4px 2px;text-align:center;font-size:11pt;font-weight:bold;vertical-align:middle">THỰC XUẤT</th>
        <th rowspan="3" style="border:1px solid #000;padding:4px 2px;text-align:center;font-size:11pt;font-weight:bold;vertical-align:middle">TỒN CUỐI KỲ</th>
        <th rowspan="3" style="border:1px solid #000;padding:4px 2px;text-align:center;font-size:11pt;font-weight:bold;vertical-align:middle">THÀNH TIỀN</th>
        <th rowspan="3" style="border:1px solid #000;padding:4px 2px;text-align:center;font-size:11pt;font-weight:bold;vertical-align:middle">GHI CHÚ</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
  </div>

  <!-- Footer -->
  <div style="text-align:right;margin-top:6px;font-size:12pt;font-style:italic">
    Ngày ${lastDay || '...'} tháng ${m || '...'} năm ${y || '....'}
  </div>
  <table style="width:100%;border:none;margin-top:6px;font-size:12pt">
    <tr>
      <td style="text-align:center;font-weight:bold;border:none;width:20%">Trưởng khoa Dược</td>
      <td style="text-align:center;font-weight:bold;border:none;width:20%">Phòng TCKT</td>
      <td style="text-align:center;font-weight:bold;border:none;width:20%">Tiếp liệu</td>
      <td style="text-align:center;font-weight:bold;border:none;width:20%">Thống kê Dược</td>
      <td style="text-align:center;font-weight:bold;border:none;width:20%">Thủ kho</td>
    </tr>
    <tr>
      <td style="text-align:center;font-style:italic;border:none;font-size:10pt">(Ký, ghi rõ họ tên)</td>
      <td style="text-align:center;font-style:italic;border:none;font-size:10pt">(Ký, ghi rõ họ tên)</td>
      <td style="text-align:center;font-style:italic;border:none;font-size:10pt">(Ký, ghi rõ họ tên)</td>
      <td style="text-align:center;font-style:italic;border:none;font-size:10pt">(Ký, ghi rõ họ tên)</td>
      <td style="text-align:center;font-style:italic;border:none;font-size:10pt">(Ký, ghi rõ họ tên)</td>
    </tr>
    <tr style="height:50px"></tr>
    <tr>
      <td style="text-align:center;font-weight:bold;border:none">DS CKII Trần Thị Đảm</td>
      <td style="text-align:center;font-weight:bold;border:none">Lê Xuân Bình</td>
      <td style="text-align:center;font-weight:bold;border:none">Trần Vương Diễm My</td>
      <td style="text-align:center;font-weight:bold;border:none">Huỳnh Thị Thanh Hương</td>
      <td style="text-align:center;font-weight:bold;border:none">Phạm Thị Hoài Thương</td>
    </tr>
  </table>
</div>`;

  document.getElementById('bbxnt-preview').innerHTML = html;
  // Scale cho preview
  const wrap   = document.getElementById('bbxnt-preview-wrap');
  const a4     = document.getElementById('bbxnt-a4');
  if (wrap && a4) {
    const avail = wrap.offsetWidth;
    const scale = Math.min(1, (avail - 4) / (a4.scrollWidth || 1050));
    a4.style.transform       = `scale(${scale})`;
    a4.style.transformOrigin = 'top left';
    wrap.style.height        = (a4.scrollHeight * scale + 20) + 'px';
  }
}

// ── Export Excel — chuẩn BBXNT theo mẫu ──────────────────
function exportBBXNT_Excel() {
  if (!processedOK) { alert('Chưa có dữ liệu. Hãy xử lý file trước.'); return; }
  const rows  = bbxnt_getData();
  const { m, y, label, lastDay } = bbxnt_getMonth();

  const wb = XLSX.utils.book_new();
  const aoa = [];

  // Header rows (khớp mẫu BBXNT-2026.xlsx)
  aoa.push(['SỞ Y TẾ TP. ĐÀ NẴNG','','','','','CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM','','','','','','','','']);
  aoa.push(['BỆNH VIỆN ĐÀ NẴNG','','','','','Độc lập - Tự do - Hạnh phúc','','','','','','','','']);
  aoa.push(['KHOA DƯỢC','','','','','-----------------------','','','','','','','','']);
  aoa.push(new Array(14).fill(''));
  aoa.push(['','','','','BÁO CÁO NHẬP XUẤT TỒN','','','','','','','','','']);
  aoa.push(['','','','','KHO THUỐC ỐNG,LỌ,GÓI','','','','','','','','','']);
  aoa.push(['','','','',label,'','','','','','','','','']);
  aoa.push(new Array(14).fill(''));
  // Column header (3 rows merged vertically in template)
  aoa.push(['STT','Mã hàng','Tên Thuốc - Nồng độ - Hàm lượng','Hàm lượng','ĐVT','SỐ LÔ','HẠN\nDÙNG','ĐƠN GIÁ','TỒN ĐẦU KỲ','TỔNG NHẬP','THỰC XUẤT','TỒN CUỐI KỲ','THÀNH TIỀN','GHI CHÚ']);
  aoa.push(new Array(14).fill(''));
  aoa.push(new Array(14).fill(''));

  // Nhóm theo công ty
  const groups = {};
  rows.forEach(r => { const g = r.hangSX||'Khác'; if(!groups[g]) groups[g]=[]; groups[g].push(r); });

  let grandTonDau=0, grandNhap=0, grandXuat=0, grandTon=0, grandTien=0;
  Object.keys(groups).sort((a,b) => a.localeCompare(b,'vi')).forEach(grp => {
    // Dòng tên công ty (bold, colspan mẫu)
    aoa.push([grp,'','','','','','','','','','','','','']);
    groups[grp].forEach((r, i) => {
      grandTonDau += r.tonDau; grandNhap += r.tongNhap;
      grandXuat   += r.thucXuat; grandTon  += r.tonCuoi; grandTien += r.thanhTien;
      aoa.push([
        i + 1, r.ma, r.ten, r.hl, r.dvt,
        r.soLo, bbxnt_fmtDate(r.hanDung), r.donGia || '',
        r.tonDau, r.tongNhap, r.thucXuat, r.tonCuoi,
        r.thanhTien || '', ''
      ]);
    });
  });

  // Tổng cộng
  aoa.push(['','','','','','','','TỔNG CỘNG',grandTonDau,grandNhap,grandXuat,grandTon,grandTien||'','']);
  // Footer
  aoa.push(new Array(14).fill(''));
  aoa.push(['','','','','','','','','','','Ngày ' + (lastDay||'..') + ' tháng ' + (m||'..') + ' năm ' + (y||'....'),'','','']);
  aoa.push(['Trưởng khoa Dược','','Phòng TCKT','','','Tiếp liệu','','','','Thống kê Dược','','','Thủ kho','']);
  aoa.push(new Array(14).fill(''));
  aoa.push(new Array(14).fill(''));
  aoa.push(['DS CKII Trần Thị Đảm','','   Lê Xuân Bình','','','Trần Vương Diễm My','','','','Huỳnh Thị Thanh Hương','','','   Phạm Thị Hoài Thương','']);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths (khớp mẫu: A=4.9, B=13.1, C=8.1, D=7.1, F=14.5, G=11.9, H=11.3, I=8, J=8.5, K=7.7, L=8.8, M=13)
  ws['!cols'] = [
    {wch:5}, {wch:10}, {wch:22}, {wch:12}, {wch:6},
    {wch:12}, {wch:12}, {wch:12}, {wch:10}, {wch:10},
    {wch:10}, {wch:10}, {wch:14}, {wch:8}
  ];

  // Merges cho header
  ws['!merges'] = [
    {s:{r:0,c:0},e:{r:0,c:4}},  // SỞ Y TẾ
    {s:{r:1,c:0},e:{r:1,c:4}},  // BVĐN
    {s:{r:2,c:0},e:{r:2,c:4}},  // KHOA DƯỢC
    {s:{r:0,c:5},e:{r:0,c:10}}, // CHXHCN
    {s:{r:1,c:5},e:{r:1,c:10}}, // ĐL-TD-HP
    {s:{r:2,c:5},e:{r:2,c:10}}, // gạch
    {s:{r:4,c:4},e:{r:4,c:9}},  // BÁO CÁO
    {s:{r:5,c:4},e:{r:5,c:9}},  // KHO THUỐC
    {s:{r:6,c:4},e:{r:6,c:9}},  // Tháng/Năm
    {s:{r:8,c:0},e:{r:10,c:0}}, // STT
    {s:{r:8,c:1},e:{r:10,c:1}}, // Mã hàng
    {s:{r:8,c:2},e:{r:10,c:2}}, // Tên thuốc
    {s:{r:8,c:3},e:{r:10,c:3}}, // Hàm lượng
    {s:{r:8,c:4},e:{r:10,c:4}}, // ĐVT
    {s:{r:8,c:5},e:{r:10,c:5}}, // Số lô
    {s:{r:8,c:6},e:{r:10,c:6}}, // HSD
    {s:{r:8,c:7},e:{r:10,c:7}}, // Đơn giá
    {s:{r:8,c:8},e:{r:10,c:8}}, // Tồn đầu
    {s:{r:8,c:9},e:{r:10,c:9}}, // Tổng nhập
    {s:{r:8,c:10},e:{r:10,c:10}},// Thực xuất
    {s:{r:8,c:11},e:{r:10,c:11}},// Tồn cuối
    {s:{r:8,c:12},e:{r:10,c:12}},// Thành tiền
    {s:{r:8,c:13},e:{r:10,c:13}},// Ghi chú
  ];

  // Page setup: A4 landscape
  ws['!pageSetup'] = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  ws['!printOptions'] = { gridLines: false };
  ws['!margins'] = { left:0.5, right:0.3, top:0.75, bottom:0.75, header:0.3, footer:0.3 };

  const sheetName = `XNT_T${m||'XX'}_${y||''}`;
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  xlsxDownload(wb, `BBXNT_T${m||'XX'}_${y||''}.xlsx`);
}

// ── Export PDF / In ────────────────────────────────────────
function exportBBXNT_PDF() {
  if (!processedOK) { alert('Chưa có dữ liệu.'); return; }
  renderBBXNT();
  setTimeout(() => { window.print(); }, 400);
}

// ── Realtime: khi loadWB cả 2 file → auto process + render ──
(function patchLoadWB_TK() {
  // Hook vào processData gốc để sau khi xử lý xong thì refresh BBXNT
  const _origProcess = typeof processData === 'function' ? processData : null;
  if (_origProcess) {
    window.processData = function() {
      _origProcess();
      // Nếu đang ở màn BBXNT thì auto render
      const scBBXNT = document.getElementById('sc-bbxnt');
      if (scBBXNT && scBBXNT.classList.contains('active')) renderBBXNT();
    };
  }
})();
