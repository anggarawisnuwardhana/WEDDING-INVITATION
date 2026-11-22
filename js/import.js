/* ==========================================================
   IMPORT EXCEL
   (memakai helper dari admin.js: $, esc, showToast, showLoading,
    hideLoading, showConfirm, loadGuests, loadDashboard, isOk, guestData)
========================================================== */

let excelRows = [];
let importRows = [];
let duplicateRows = [];
let importing = false;

/* ==========================================================
   INIT (aman dipanggil berulang: memakai onclick, bukan addEventListener)
========================================================== */

function initImport(){

    const preview = $("btnPreview");

    if(preview) preview.onclick = previewExcel;

    const choose = $("btnChooseExcel");
    const input = $("excelFile");

    if(choose && input){

        choose.onclick = e=>{

            e.stopPropagation();   // cegah dialog file terbuka dua kali

            input.click();

        };

    }

    if(input) input.onchange = showSelectedFile;

    const reset = $("btnResetImport");

    if(reset) reset.onclick = ()=>resetImport();

}

function showSelectedFile(){

    const input = $("excelFile");
    const info = $("selectedFile");

    if(!input || !info) return;

    if(!input.files.length){

        info.innerHTML = "Belum ada file dipilih";

        return;

    }

    const file = input.files[0];

    info.innerHTML = `
        <i class="fa-solid fa-file-excel"></i>

        <strong>${esc(file.name)}</strong>

        (${(file.size/1024).toFixed(1)} KB)
    `;

}

/* ==========================================================
   PREVIEW EXCEL
========================================================== */

async function previewExcel(){

    const input = $("excelFile");

    if(!input){

        showToast("Input file tidak ditemukan.","error");

        return;

    }

    if(input.files.length===0){

        showToast("Silakan pilih file Excel.","error");

        return;

    }

    const file = input.files[0];

    if(!/\.(xlsx|xls)$/i.test(file.name)){

        showToast("File harus Excel (.xlsx / .xls)","error");

        return;

    }

    showLoading("Membaca File Excel...");

    try{

        const buffer = await file.arrayBuffer();

        // ambil data tamu terbaru agar deteksi duplikat akurat
        await loadGuests();

        readWorkbook(buffer);

    }
    catch(err){

        console.error(err);

        showToast("Format Excel tidak valid","error");

    }
    finally{

        hideLoading();

    }

}

/* ==========================================================
   READ WORKBOOK
========================================================== */

function readWorkbook(buffer){

    const workbook = XLSX.read(buffer,{type:"array"});

    if(workbook.SheetNames.length===0){

        hideLoading();

        showToast("Sheet kosong","error");

        return;

    }

    const sheetName = workbook.SheetNames[0];

    const sheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(sheet,{header:1});

    processExcel(rows);

}

/* ==========================================================
   PROCESS EXCEL
========================================================== */

function processExcel(rows){

    excelRows = [];
    importRows = [];
    duplicateRows = [];

    const excelNames = new Set();

    if(rows.length===0){

        hideLoading();

        showToast("Excel kosong","error");

        return;

    }

    rows.forEach((row,index)=>{

        if(index===0) return;
        if(!row) return;

        const name = String(row[0] ?? "").trim();

        if(name==="") return;

        const key = normalizeName(name);

        const already = excelNames.has(key);

        excelNames.add(key);

        const duplicate =
            already ||
            guestData.some(g=>normalizeName(g.name)===key);

        const item = {

            no:index,

            name:name,

            duplicate:duplicate

        };

        excelRows.push(item);

        if(duplicate){

            duplicateRows.push(item);

        }
        else{

            importRows.push(item);

        }

    });

    updateImportSummary();

    hideLoading();

    if(excelRows.length===0){

        showToast("Tidak ada nama pada kolom pertama Excel.","warn");

    }

}

/* ==========================================================
   NORMALIZE
========================================================== */

function normalizeName(name){

    return String(name)

    .trim()

    .toLowerCase()

    .replace(/\s+/g," ")

    .normalize("NFD")

    .replace(/[\u0300-\u036f]/g,"");

}

/* ==========================================================
   SUMMARY
========================================================== */

function updateImportSummary(){

    const div = $("importSummary");

    if(!div) return;

    div.innerHTML = `

        <div class="summary-card">

            <div class="summary-item">

                <h2>${excelRows.length}</h2>

                <span>Total Excel</span>

            </div>

            <div class="summary-item success">

                <h2>${importRows.length}</h2>

                <span>Data Baru</span>

            </div>

            <div class="summary-item danger">

                <h2>${duplicateRows.length}</h2>

                <span>Duplikat</span>

            </div>

        </div>

    `;

    renderImportPreview();

}

/* ==========================================================
   RENDER IMPORT PREVIEW
========================================================== */

function renderImportPreview(){

    const div = $("importPreview");

    if(!div) return;

    if(excelRows.length===0){

        div.innerHTML = `
        <div class="placeholder">

            Tidak ada data.

        </div>
        `;

        return;

    }

    div.innerHTML = `

    <div class="import-toolbar">

        <input
            id="importSearch"
            class="import-search"
            placeholder="Cari nama...">

        <button
            class="primary-btn"
            id="btnImportExcel">

            Import ke Google Sheet

        </button>

    </div>

    <table class="import-table">

        <thead>

            <tr>

                <th>No</th>

                <th>Nama</th>

                <th>Status</th>

            </tr>

        </thead>

        <tbody id="importTableBody">

        </tbody>

    </table>

    `;

    renderImportTable(excelRows);

    initImportSearch();

    initImportButton();

}

/* ==========================================================
   RENDER TABLE
========================================================== */

function renderImportTable(data){

    const tbody = $("importTableBody");

    if(!tbody) return;

    if(data.length===0){

        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:#6a796d">Tidak ada hasil</td></tr>`;

        return;

    }

    tbody.innerHTML = data.map((item,index)=>`

        <tr>

            <td>${index+1}</td>

            <td>${esc(item.name)}</td>

            <td>

                ${
                    item.duplicate
                    ?
                    `<span class="badge-danger">Duplikat</span>`
                    :
                    `<span class="badge-success">Baru</span>`
                }

            </td>

        </tr>

    `).join("");

}

/* ==========================================================
   SEARCH
========================================================== */

function initImportSearch(){

    const input = $("importSearch");

    if(!input) return;

    input.oninput = ()=>{

        const key = input.value.trim().toLowerCase();

        renderImportTable(
            excelRows.filter(x=>x.name.toLowerCase().includes(key))
        );

    };

}

/* ==========================================================
   BUTTON IMPORT
========================================================== */

function initImportButton(){

    const btn = $("btnImportExcel");

    if(!btn) return;

    btn.onclick = confirmImport;

}

/* ==========================================================
   CONFIRM IMPORT
========================================================== */

async function confirmImport(){

    if(importing) return;

    if(importRows.length===0){

        showToast("Tidak ada data yang dapat diimport.","error");

        return;

    }

    const ok = await showConfirm({

        type:"import",

        total:importRows.length,

        duplicate:duplicateRows.length

    });

    if(!ok) return;

    importGuests();

}

/* ==========================================================
   IMPORT DATA KE GOOGLE SHEET
========================================================== */

async function importGuests(){

    if(importing) return;

    if(importRows.length===0){

        showToast("Tidak ada data untuk diimport","error");

        return;

    }

    importing = true;

    const count = importRows.length;

    try{

        showLoading("Mengimport "+count+" tamu...");

        const btn = $("btnImportExcel");

        if(btn){

            btn.disabled = true;
            btn.innerHTML = "Mengimport...";

        }

        const res = await fetch(API_URL,{

            method:"POST",

            body:JSON.stringify({

                action:"importGuests",

                guests:importRows

            })

        });

        if(!res.ok){

            throw new Error("HTTP "+res.status);

        }

        const result = await res.json();

        if(!isOk(result)){

            showToast(result.message || "Import gagal","error");

            return;

        }

        showToast("Berhasil mengimport "+(result.total ?? count)+" tamu.");

        resetImport(false);

        await Promise.all([loadGuests(),loadDashboard()]);

    }
    catch(err){

        console.error(err);

        showToast("Gagal menghubungi server","error");

        // kemungkinan sebagian data sudah masuk: segarkan daftar tamu
        loadGuests();

    }
    finally{

        hideLoading();

        importing = false;

        const btn = $("btnImportExcel");

        if(btn){

            btn.disabled = false;
            btn.innerHTML = "Import ke Google Sheet";

        }

    }

}

/* ==========================================================
   RESET IMPORT
========================================================== */

function resetImport(showMessage = true){

    excelRows = [];
    importRows = [];
    duplicateRows = [];

    const input = $("excelFile");
    if(input) input.value = "";

    const info = $("selectedFile");
    if(info) info.innerHTML = "Belum ada file dipilih";

    const summary = $("importSummary");
    if(summary) summary.innerHTML = "";

    const progress = $("importProgress");
    if(progress) progress.style.display = "none";

    const preview = $("importPreview");

    if(preview){

        preview.innerHTML = `
            <div class="placeholder">
                Silakan pilih file Excel.
            </div>
        `;

    }

    if(showMessage){

        showToast("File berhasil direset");

    }

}

/* ==========================================================
   DRAG & DROP
========================================================== */

function initDropArea(){

    const box = $("dropArea");
    const input = $("excelFile");

    if(!box || !input) return;

    box.onclick = e=>{

        if(e.target===input || e.target.closest("button")) return;

        input.click();

    };

    box.ondragover = e=>{

        e.preventDefault();

        box.classList.add("drag");

    };

    box.ondragleave = ()=>box.classList.remove("drag");

    box.ondrop = e=>{

        e.preventDefault();

        box.classList.remove("drag");

        if(e.dataTransfer.files.length){

            input.files = e.dataTransfer.files;

            showSelectedFile();

        }

    };

}
