/* ==========================================================
   Wedding Admin Dashboard - admin.js
   - Tampil instan dari cache, sinkron otomatis di latar belakang
   - Render hanya saat data berubah, semua teks di-escape
   - Kompatibel dengan import.js & export.js
========================================================== */

const API_URL =
"https://script.google.com/macros/s/AKfycbwfz-rbBxKY-uPOkTvTCl7lLLIemCh-_eqSfP4oXADE18s1CpjfpPqbeTZX6rJk5Pjwag/exec";

/* GANTI URL DI ATAS dengan URL Web Apps milik Anda */

const INVITE_BASE = "https://anggarawisnuwardhana.github.io/WEDDING-INVITATION/?to=";

/* link undangan tamu (dipakai tabel, salin link, buka undangan, export) */
function inviteLink(slug){
    return INVITE_BASE + encodeURIComponent(slug ?? "");
}

/* respons server dianggap sukses bila status true / "true" / success */
function isOk(d){
    return !!d && (d.status===true || d.status==="true" || d.success===true);
}

/* status hadir (tahan terhadap variasi teks) */
function isPresent(s){
    return /^\s*(sudah\s*hadir|hadir|checked.?in)\s*$/i.test(String(s||""));
}

/* init import.js cukup sekali (mencegah listener & notifikasi dobel) */
let importReady = false;

function initImportOnce(){

    if(importReady) return;

    importReady = true;

    if(typeof initImport==="function") initImport();
    if(typeof initDropArea==="function") initDropArea();

}
const SYNC_INTERVAL = 15000;   // sinkron otomatis tiap 15 detik

let guestData = [];
let excelData = [];
let importData = [];
let duplicateData = [];
let commentData = [];

let guestQuery = "";
let syncing = false;
const lastSig = { guest:"", comment:"" };

/* ==========================================================
   Helper
========================================================== */

const $ = id => document.getElementById(id);

function esc(s){
    return String(s ?? "").replace(/[&<>"']/g,c=>({
        "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
}

if(typeof window.normalizeName !== "function"){
    window.normalizeName = n =>
        String(n || "").toLowerCase().replace(/\s+/g," ").trim();
}

function cacheGet(k){
    try{ return JSON.parse(localStorage.getItem(k)); }
    catch(e){ return null; }
}

function cacheSet(k,v){
    try{ localStorage.setItem(k,JSON.stringify(v)); }
    catch(e){}
}

async function api(url,opt,timeout=15000){

    const ctl = new AbortController();
    const t = setTimeout(()=>ctl.abort(),timeout);

    try{

        const res = await fetch(url,{...opt,signal:ctl.signal});

        if(!res.ok) throw new Error("HTTP "+res.status);

        return await res.json();

    }
    finally{ clearTimeout(t); }

}

const get  = q => api(API_URL+"?"+q+"&_="+Date.now());
const post = b => api(API_URL,{method:"POST",body:JSON.stringify(b)});

/* ==========================================================
   Loading (hanya muncul bila proses > 250ms)
========================================================== */

let loadTimer = null;

function showLoading(text="Memproses..."){

    const loading = $("loading");
    if(!loading) return;

    const txt = loading.querySelector(".loading-text");
    if(txt) txt.innerHTML = text;

    clearTimeout(loadTimer);
    loadTimer = setTimeout(()=>loading.classList.add("show"),250);

}

function hideLoading(){

    clearTimeout(loadTimer);

    const loading = $("loading");
    if(loading) loading.classList.remove("show");

}

async function withLoading(callback,text="Memproses..."){

    showLoading(text);

    try{ return await callback(); }
    finally{ hideLoading(); }

}

/* ==========================================================
   Status sinkronisasi (indikator Live)
========================================================== */

function setSync(state){

    const el = $("syncStatus");
    if(!el) return;

    el.className = "sync " + state;

    const time = new Date().toLocaleTimeString("id-ID",
        {hour:"2-digit",minute:"2-digit"});

    el.querySelector("span").textContent =
        state==="live" ? "Live · "+time :
        state==="sync" ? "Menyinkronkan" : "Offline";

}

/* ==========================================================
   Init
========================================================== */

document.addEventListener("DOMContentLoaded",()=>{

    initDashboard();

});

function initDashboard(){

    initSidebar();
    initQuickAction();
    initGuestButtons();
    initAddGuest();
    initGuestSearch();
    initTableActions();
    initComments();
    initModals();

    initImportOnce();

    // tampilkan data terakhir secara instan
    const g = cacheGet("dj_guests");

    if(Array.isArray(g)){
        guestData = g;
        lastSig.guest = JSON.stringify(g);
        renderGuestTable();
    }

    const d = cacheGet("dj_dash");
    if(d) applyDashboard(d);

    // lalu segarkan di latar belakang
    silentSync();

    setInterval(()=>{

        if(!document.hidden && navigator.onLine) silentSync();

    },SYNC_INTERVAL);

    document.addEventListener("visibilitychange",()=>{

        if(!document.hidden) silentSync();

    });

    window.addEventListener("online",silentSync);

}

async function silentSync(){

    if(syncing) return;

    syncing = true;
    setSync("sync");

    try{

        const tasks = [loadGuests(),loadDashboard()];

        const rsvp = $("rsvpPage");

        if(rsvp && rsvp.classList.contains("active")){
            tasks.push(loadComments());
        }

        const r = await Promise.all(tasks);

        setSync(r[0]===false ? "err" : "live");

    }
    catch(e){
        setSync("err");
    }
    finally{
        syncing = false;
    }

}

/* ==========================================================
   Sidebar
========================================================== */

function closeSidebar(){

    $("sidebar").classList.remove("active");
    $("sidebarOverlay").classList.remove("show");

}

function initSidebar(){

    const menuBtn = $("menuBtn");
    const sidebar = $("sidebar");
    const overlay = $("sidebarOverlay");

    menuBtn.onclick = ()=>{

        sidebar.classList.toggle("active");
        overlay.classList.toggle("show");

    };

    overlay.onclick = closeSidebar;

    document.querySelectorAll(".menu li").forEach(menu=>{

        menu.onclick = ()=>{

            if(menu.dataset.link){
                location.href = menu.dataset.link;
                return;
            }

            showPage(menu.dataset.page);

            if(window.innerWidth<=900) closeSidebar();

        };

    });

}

/* ==========================================================
   Quick Action
========================================================== */

function initQuickAction(){

    document.querySelectorAll(".quick-card").forEach(card=>{

        card.onclick = ()=>{

            if(card.dataset.link){
                location.href = card.dataset.link;
                return;
            }

            if(card.dataset.page) showPage(card.dataset.page);

        };

    });

}

/* ==========================================================
   Show Page
========================================================== */

const PAGE_TITLE = {
    dashboard:"Dashboard",
    guest:"Data Tamu",
    add:"Tambah Tamu",
    search:"Cari Tamu",
    import:"Import Excel",
    rsvp:"RSVP",
    export:"Export"
};

function showPage(page){

    const target = $(page+"Page");

    if(!target) return;

    document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
    target.classList.add("active");

    // sinkronkan menu sidebar (juga saat dipanggil dari Quick Action)
    document.querySelectorAll(".menu li").forEach(li=>{
        li.classList.toggle("active",li.dataset.page===page);
    });

    const title = document.querySelector(".title");
    if(title) title.innerHTML = PAGE_TITLE[page] || "Dashboard";

    window.scrollTo(0,0);

    switch(page){

        case "guest":
            silentSync();
        break;

        case "search":
            renderGuestSearch();
        break;

        case "import":
            initImportOnce();
        break;

        case "rsvp":
            loadComments();
        break;

    }

}

/* ==========================================================
   Dashboard
========================================================== */

function applyDashboard(d){

    ["totalGuest","totalPresent","totalAbsent","totalRSVP"].forEach(k=>{

        const el = $(k);
        const v = String(d[k] ?? 0);

        if(el && el.textContent!==v) el.textContent = v;

    });

}

async function loadDashboard(){

    try{

        const data = await get("action=dashboard");

        if(!isOk(data)) return;

        applyDashboard(data);
        cacheSet("dj_dash",data);

    }
    catch(err){
        console.error(err);
    }

}

async function refreshDashboard(){

    await loadDashboard();

}

/* ==========================================================
   Data Tamu
========================================================== */

async function loadGuests(){

    try{

        const data = await get("action=getGuests");

        if(!Array.isArray(data)){
            throw new Error("Data guest tidak valid");
        }

        setGuests(data);

        return true;

    }
    catch(err){

        console.error(err);

        const tbody = $("guestTable");

        if(!guestData.length && tbody){
            tbody.innerHTML = `
            <tr><td colspan="7" class="empty err">
                Gagal mengambil data.
                <a href="#" onclick="loadGuests();return false">Coba lagi</a>
            </td></tr>`;
        }

        return false;

    }

}

function setGuests(data){

    const sig = JSON.stringify(data);

    if(sig===lastSig.guest) return;   // tidak ada perubahan

    lastSig.guest = sig;
    guestData = data;

    cacheSet("dj_guests",data);

    renderGuestTable();

    const sp = $("searchPage");
    if(sp && sp.classList.contains("active")) renderGuestSearch();

}

function commitLocal(){

    lastSig.guest = JSON.stringify(guestData);

    cacheSet("dj_guests",guestData);

    renderGuestTable();

}

function visibleGuests(){

    const q = guestQuery.toLowerCase();

    if(!q) return guestData;

    return guestData.filter(g=>
        [g.name,g.link,g.qr].some(v=>String(v||"").toLowerCase().includes(q))
    );

}

function renderGuestTable(data){

    const tbody = $("guestTable");

    if(!tbody) return;

    const list = Array.isArray(data) ? data : visibleGuests();

    if(list.length===0){

        tbody.innerHTML = `
        <tr><td colspan="7" class="empty">
            ${guestData.length ? "Tidak ada tamu yang cocok" : "Belum ada data tamu"}
        </td></tr>`;

        return;

    }

    tbody.innerHTML = list.map((g,i)=>{

        const link = inviteLink(g.link);
        const done = isPresent(g.status);

        return `
        <tr>
            <td>${i+1}</td>
            <td><strong>${esc(g.name)}</strong></td>
            <td><a href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a></td>
            <td>${esc(g.qr)}</td>
            <td><span class="${done?"status-success":"status-wait"}">${esc(g.status)}</span></td>
            <td>${esc(g.time || "-")}</td>
            <td class="actions">
                <button class="delete-btn" data-act="del" data-id="${esc(g.id)}" title="Hapus"><i class="fa-solid fa-trash"></i></button>
                <button class="reset-btn" data-act="reset" data-id="${esc(g.id)}" title="Reset"><i class="fa-solid fa-rotate-left"></i></button>
                <button class="btn-copy" data-act="copy" data-id="${esc(g.id)}" title="Salin Link"><i class="fa-solid fa-copy"></i></button>
                <button class="btn-qr" data-act="qr" data-id="${esc(g.id)}" title="Preview QR"><i class="fa-solid fa-qrcode"></i></button>
            </td>
        </tr>`;

    }).join("");

}

function findGuest(id){

    return guestData.find(g=>String(g.id)===String(id));

}

function initTableActions(){

    const tbody = $("guestTable");

    if(!tbody) return;

    tbody.addEventListener("click",e=>{

        const btn = e.target.closest("button[data-act]");

        if(!btn) return;

        const g = findGuest(btn.dataset.id);

        if(!g) return;

        switch(btn.dataset.act){

            case "del":   deleteGuest(g.id,g.name);   break;
            case "reset": resetCheckin(g.id,g.name);  break;
            case "copy":  copyGuestLink(g.link);      break;
            case "qr":    previewQR(g.qr,g.name);     break;

        }

    });

    const refreshBtn = $("refreshGuest");

    if(refreshBtn){

        refreshBtn.onclick = async ()=>{

            refreshBtn.disabled = true;

            await silentSync();

            refreshBtn.disabled = false;

        };

    }

}

/* ==========================================================
   Pencarian di tabel Data Tamu
========================================================== */

function initGuestSearch(){

    const input = $("searchGuest");

    if(input){

        input.addEventListener("input",()=>{

            guestQuery = input.value.trim();

            renderGuestTable();

        });

    }

    const si = $("searchGuestInput");

    if(si) si.addEventListener("input",renderGuestSearch);

    const list = $("guestSearchList");

    if(list){

        list.addEventListener("click",e=>{

            const item = e.target.closest(".guest-search-item");

            if(!item) return;

            const g = findGuest(item.dataset.id);

            if(g) openGuestDetail(g);

        });

    }

}

/* ==========================================================
   Hapus / Reset (optimistic: UI langsung berubah)
========================================================== */

async function deleteGuest(id,name){

    const ok = await showConfirm({type:"delete",guestName:name});

    if(!ok) return;

    const backup = guestData.slice();

    guestData = guestData.filter(g=>String(g.id)!==String(id));
    commitLocal();

    try{

        const data = await post({action:"deleteGuest",id:id});

        if(!isOk(data)) throw new Error(data.message || "Gagal");

        showToast("✔ Data tamu berhasil dihapus");

    }
    catch(err){

        console.error(err);

        guestData = backup;
        commitLocal();

        showToast("Gagal menghapus data tamu.","#e74c3c");

    }

    silentSync();

}

async function resetCheckin(id,name){

    const ok = await showConfirm({type:"reset",guestName:name});

    if(!ok) return;

    const backup = guestData.map(g=>({...g}));

    guestData = guestData.map(g=>
        String(g.id)===String(id) ? {...g,status:"Belum Hadir",time:""} : g
    );

    commitLocal();

    try{

        const data = await post({action:"resetCheckin",id:id});

        if(!isOk(data)) throw new Error(data.message || "Gagal");

        showToast("✔ Status Check In berhasil direset");

    }
    catch(err){

        console.error(err);

        guestData = backup;
        commitLocal();

        showToast("Gagal mereset status.","#e74c3c");

    }

    silentSync();

}

/* ==========================================================
   Toast
========================================================== */

let toastTimer = null;

/*
  showToast(teks, jenis)
  jenis: "success" | "error" | "warn" | "info"
  (warna lama seperti "#e74c3c" tetap dikenali -> error)
*/
function showToast(text,type){

    const s = String(text ?? "").trim();

    let kind = "success";

    if(["success","error","warn","info"].includes(type)){
        kind = type;
    }
    else if(typeof type==="string" && /e74c3c|c0392b|d32f2f|ff5252|red/i.test(type)){
        kind = "error";
    }
    else if(typeof type==="string" && /f39c12|e67e22|d98a2b|orange|amber/i.test(type)){
        kind = "warn";
    }

    if(kind==="success" && /^(❌|✖|gagal|error)/i.test(s)) kind = "error";

    const clean = s.replace(/^[\u2714\u2713\u2705\u274C\u2716\u26A0\uFE0F\s]+/u,"");

    const icon = {
        success:"fa-circle-check",
        error:"fa-circle-xmark",
        warn:"fa-triangle-exclamation",
        info:"fa-circle-info"
    }[kind];

    let toast = $("globalToast");

    if(!toast){

        toast = document.createElement("div");
        toast.id = "globalToast";

        document.body.appendChild(toast);

    }

    toast.classList.remove("show");
    toast.className = "toast " + kind;
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${esc(clean)}</span>`;

    clearTimeout(toastTimer);

    requestAnimationFrame(()=>requestAnimationFrame(()=>{
        toast.classList.add("show");
    }));

    toastTimer = setTimeout(
        ()=>toast.classList.remove("show"),
        kind==="success" ? 2500 : 4000
    );

}

/* ==========================================================
   Konfirmasi
========================================================== */

function showConfirm(options){

    return new Promise(resolve=>{

        const modal    = $("confirmModal");
        const title    = $("confirmTitle");
        const subtitle = $("confirmSubtitle");
        const guest    = $("confirmGuest");
        const btn      = $("btnConfirm");
        const icon     = $("confirmIcon");

        if(options.type==="delete"){

            title.textContent = "Hapus Data Tamu";
            icon.className = "confirm-icon delete";
            icon.innerHTML = '<i class="fa-solid fa-trash"></i>';
            subtitle.innerHTML = "Data berikut akan dihapus secara permanen.";
            btn.innerHTML = "Hapus";
            btn.className = "confirm-btn delete";

        }
        else if(options.type==="reset"){

            title.textContent = "Reset Check In";
            icon.className = "confirm-icon reset";
            icon.innerHTML = '<i class="fa-solid fa-rotate-left"></i>';
            subtitle.innerHTML = "Status check in akan dikembalikan menjadi Belum Hadir.";
            btn.innerHTML = "Reset";
            btn.className = "confirm-btn reset";

        }
        else if(options.type==="import"){

            title.textContent = "Import Data Excel";
            icon.className = "confirm-icon import";
            icon.innerHTML = '<i class="fa-solid fa-file-import"></i>';

            subtitle.innerHTML = `
                Kamu akan mengimport <b>${esc(options.total)}</b> data.
                ${options.duplicate ? `<br><span style="color:#c0392b;">${esc(options.duplicate)} data duplikat akan dilewati</span>` : ""}
            `;

            btn.innerHTML = "Import";
            btn.className = "confirm-btn import";

        }
        else{

            title.textContent = "Konfirmasi";
            icon.className = "confirm-icon import";
            icon.innerHTML = '<i class="fa-solid fa-circle-question"></i>';
            subtitle.innerHTML = "";
            btn.innerHTML = "OK";
            btn.className = "confirm-btn";

        }

        guest.innerHTML = esc(options.guestName || "-");

        const done = v=>{

            modal.classList.remove("show");
            modal.onclick = null;

            resolve(v);

        };

        modal.classList.add("show");

        modal.onclick = e=>{ if(e.target===modal) done(false); };

        $("btnCancel").onclick = ()=>done(false);
        btn.onclick = ()=>done(true);

    });

}

/* ==========================================================
   Link & QR
========================================================== */

function copyGuestLink(slug){

    navigator.clipboard.writeText(inviteLink(slug))

    .then(()=>showToast("Link berhasil disalin"))

    .catch(()=>showToast("Gagal menyalin link","#e74c3c"));

}

function previewQR(code,name){

    $("previewQR").src =
        "https://quickchart.io/qr?size=350&text="+encodeURIComponent(code);

    $("previewGuest").innerHTML = esc(name)+"<br>"+esc(code);

    $("qrToast").classList.add("show");

}

function closeQRToast(){

    $("qrToast").classList.remove("show");

}

/* ==========================================================
   Modal (QR, Detail Tamu) + tombol Escape
========================================================== */

function closeGuestDetail(){

    const m = $("guestDetailModal");

    if(m) m.style.display = "none";

}

function initModals(){

    const qr = $("qrToast");

    if(qr){

        qr.addEventListener("click",e=>{
            if(e.target===qr) closeQRToast();
        });

    }

    const detail = $("guestDetailModal");

    if(detail){

        detail.addEventListener("click",e=>{
            if(e.target===detail) closeGuestDetail();
        });

    }

    const closeBtn = $("closeGuestModal");

    if(closeBtn) closeBtn.addEventListener("click",closeGuestDetail);

    document.addEventListener("keydown",e=>{

        if(e.key!=="Escape") return;

        closeQRToast();
        closeGuestDetail();

        const c = $("confirmModal");

        if(c && c.classList.contains("show")){
            $("btnCancel").click();
        }

    });

}

/* ==========================================================
   Tambah Tamu
========================================================== */

function initAddGuest(){

    const btn = $("btnAddGuest");

    if(btn) btn.addEventListener("click",addGuest);

    const input = $("guestName");

    if(input){

        input.addEventListener("keydown",e=>{
            if(e.key==="Enter") addGuest();
        });

    }

}

async function addGuest(){

    const input = $("guestName");
    const btn = $("btnAddGuest");

    if(btn.disabled) return;

    const name = input.value.trim();

    if(!name){
        showToast("Masukkan nama tamu.","#e74c3c");
        return;
    }

    const key = normalizeName(name);

    if(guestData.some(g=>normalizeName(g.name)===key)){
        showToast("Nama tamu sudah ada.","#e74c3c");
        return;
    }

    btn.disabled = true;
    btn.innerHTML = "Menambahkan...";

    try{

        const data = await post({action:"addGuest",name:name});

        if(isOk(data)){

            showToast("Tamu berhasil ditambahkan");

            input.value = "";

            await Promise.all([loadGuests(),loadDashboard()]);

        }
        else{

            showToast(data.message || "Gagal menambahkan tamu.","#e74c3c");

        }

    }
    catch(err){

        console.error(err);

        showToast("Gagal menambahkan tamu.","#e74c3c");

    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-user-plus"></i><span>Tambah Tamu</span>';

}

function initGuestButtons(){

    const addBtn = document.querySelector(".add-btn");

    if(addBtn) addBtn.addEventListener("click",()=>showPage("add"));

}

/* ==========================================================
   Cari Tamu
========================================================== */

function renderGuestSearch(){

    const input = $("searchGuestInput");

    if(!input) return;

    const keyword = input.value.toLowerCase().trim();

    renderSearchList(
        guestData.filter(g=>(g.name||"").toLowerCase().includes(keyword))
    );

}

function renderSearchList(list){

    const box = $("guestSearchList");

    if(!box) return;

    if(list.length===0){

        box.innerHTML = `<div class="placeholder">Tidak ada tamu ditemukan</div>`;

        return;

    }

    box.innerHTML = list.map(g=>`
        <div class="guest-search-item" data-id="${esc(g.id)}">
            <div class="guest-left">
                <div class="guest-avatar"><i class="fa-solid fa-user"></i></div>
                <div>
                    <div><strong>${esc(g.name)}</strong></div>
                    <div class="guest-link">${esc(inviteLink(g.link))}</div>
                </div>
            </div>
            <i class="fa-solid fa-chevron-right"></i>
        </div>
    `).join("");

}

function openGuestDetail(g){

    const modal = $("guestDetailModal");

    if(!modal) return;

    const link = inviteLink(g.link);

    modal.style.display = "flex";

    $("detailGuestName").textContent = g.name;

    $("detailGuestQR").src =
        "https://quickchart.io/qr?size=300&text="+encodeURIComponent(g.qr);

    $("detailGuestLink").value = link;

    $("copyGuestLinkBtn").onclick = ()=>{

        navigator.clipboard.writeText(link)
        .then(()=>showToast("Link berhasil disalin"))
        .catch(()=>showToast("Gagal menyalin link","#e74c3c"));

    };

    $("openGuestBtn").onclick = ()=>window.open(link,"_blank","noopener");

}

/* ==========================================================
   RSVP & Ucapan
========================================================== */

async function loadComments(){

    try{

        const data = await get("action=adminComments");

        if(!Array.isArray(data)) throw new Error("Data RSVP tidak valid");

        const sig = JSON.stringify(data);

        if(sig===lastSig.comment) return;

        lastSig.comment = sig;
        commentData = data;

        filterComments();

    }
    catch(err){

        console.error(err);

        if(!commentData.length){

            $("commentList").innerHTML =
                `<div class="placeholder">Gagal memuat data RSVP.</div>`;

        }

    }

}

function renderComments(data){

    const list = $("commentList");

    if(!list) return;

    if(data.length===0){

        list.innerHTML = `<div class="placeholder">Belum ada ucapan.</div>`;

        return;

    }

    list.innerHTML = data.map(item=>`
        <div class="comment-card">
            <div class="comment-header">
                <div class="comment-name">👤 ${esc(item.name)}</div>
                <div class="comment-date">🕒 ${esc(item.date)}</div>
            </div>
            <div class="comment-message">${esc(item.message)}</div>
        </div>
    `).join("");

}

function filterComments(){

    const input = $("searchComment");

    const keyword = input ? input.value.toLowerCase().trim() : "";

    renderComments(commentData.filter(item=>
        String(item.name||"").toLowerCase().includes(keyword) ||
        String(item.message||"").toLowerCase().includes(keyword)
    ));

}

function initComments(){

    const input = $("searchComment");

    if(input) input.addEventListener("input",filterComments);

}

/* confirmImport() ada di import.js */

history.replaceState(null,null,location.href);

window.onpopstate = function(){

    history.go(1);

};
