/* ==========================================================
   Wedding Admin Dashboard - export.js
   Google Spreadsheet, Guest Excel, RSVP Excel, PDF Report, QR ZIP
   (memakai helper dari admin.js: get, esc, showToast, showLoading,
    hideLoading, inviteLink, isPresent)
========================================================== */

const SHEET_URL =
"https://docs.google.com/spreadsheets/d/15whtvCxRslZhsBm3e30FCZGo9oHtkE2S5i93qk9B-80/edit";

const EXPORT_BRAND = "DJATI Restu";

document.addEventListener("DOMContentLoaded",()=>{

    initExport();

});

/* mencegah klik berulang saat proses masih berjalan */
function guardExport(fn){

    let busy = false;

    return async function(){

        if(busy) return;

        busy = true;

        try{ await fn(); }
        finally{ busy = false; }

    };

}

function initExport(){

    const qr = document.getElementById("btnExportQR");
    if(qr) qr.onclick = guardExport(exportQRZip);

    const pdf = document.getElementById("btnPDFReport");
    if(pdf) pdf.onclick = guardExport(exportPDFReport);

    const open = document.getElementById("btnOpenSheet");
    if(open) open.onclick = ()=>window.open(SHEET_URL,"_blank","noopener");

    const guest = document.getElementById("btnGuestExcel");
    if(guest) guest.onclick = guardExport(exportGuestExcel);

    const rsvp = document.getElementById("btnRSVPExcel");
    if(rsvp) rsvp.onclick = guardExport(exportRSVPExcel);

}

const exportDate = ()=>new Date().toLocaleString("id-ID",
    {dateStyle:"long",timeStyle:"short"});

/* ==========================================================
   Excel (tema hijau-emas)
========================================================== */

async function saveWorkbook(sheetName,headers,widths,rows,filename){

    if(typeof ExcelJS==="undefined") throw new Error("Library ExcelJS belum termuat");

    const wb = new ExcelJS.Workbook();

    wb.creator = EXPORT_BRAND;
    wb.created = new Date();

    const ws = wb.addWorksheet(sheetName,{views:[{state:"frozen",ySplit:1}]});

    ws.columns = headers.map((h,i)=>({header:h,key:"c"+i,width:widths[i]}));

    rows.forEach(r=>ws.addRow(r));

    const line = {style:"thin",color:{argb:"FFDFE5DC"}};

    ws.eachRow((row,n)=>{

        row.eachCell(cell=>{

            cell.border = {top:line,left:line,bottom:line,right:line};
            cell.alignment = {vertical:"middle",wrapText:true,horizontal:"left"};

            if(n===1){

                cell.font = {bold:true,color:{argb:"FFE6CF9F"},size:11};
                cell.fill = {type:"pattern",pattern:"solid",fgColor:{argb:"FF14261F"}};
                cell.alignment = {vertical:"middle",horizontal:"center"};

            }
            else if(n%2===1){

                cell.fill = {type:"pattern",pattern:"solid",fgColor:{argb:"FFF7FAF6"}};

            }

        });

    });

    ws.getRow(1).height = 26;

    ws.autoFilter = {from:{row:1,column:1},to:{row:1,column:headers.length}};

    const buffer = await wb.xlsx.writeBuffer();

    saveAs(new Blob([buffer]),filename);

}

async function exportGuestExcel(){

    showLoading("Menyiapkan Excel...");

    try{

        const guests = await get("action=getGuests");

        if(!Array.isArray(guests)) throw new Error("Data tamu tidak valid");

        await saveWorkbook(
            "Guests",
            ["No","Nama","Link","QR Code","Status","Check In"],
            [10,35,62,20,18,25],
            guests.map((g,i)=>[
                i+1,
                g.name,
                {text:inviteLink(g.link),hyperlink:inviteLink(g.link)},
                g.qr,
                g.status,
                g.time
            ]),
            "Guest_List.xlsx"
        );

        showToast("Guest Excel berhasil dibuat");

    }
    catch(e){

        console.error(e);

        showToast("Gagal export","error");

    }

    hideLoading();

}

async function exportRSVPExcel(){

    showLoading("Menyiapkan Excel...");

    try{

        const rows = await get("action=getRSVP");

        if(!Array.isArray(rows)) throw new Error("Data RSVP tidak valid");

        await saveWorkbook(
            "RSVP",
            ["No","Nama","Ucapan","Tanggal"],
            [10,35,70,25],
            rows.map((r,i)=>[i+1,r.name,r.message,r.date]),
            "RSVP_List.xlsx"
        );

        showToast("RSVP Excel berhasil dibuat");

    }
    catch(e){

        console.error(e);

        showToast("Gagal export","error");

    }

    hideLoading();

}

/* ==========================================================
   PDF Report
========================================================== */

const C = {
    night:[20,38,31], moss:[31,58,46], gold:[201,161,91], gold2:[230,207,159],
    mist:[241,244,239], ink:[34,48,42], muted:[106,121,109],
    green:[47,158,110], amber:[217,138,43], line:[223,229,220]
};

/* karakter di luar Latin-1 (emoji dll) tidak didukung font PDF -> digambar sebagai gambar */
const NEED_IMG = /[^\u0020-\u007E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2026\r\n\t]/;
const NEED_IMG_G = new RegExp(NEED_IMG.source,"g");

const cleanText = s=>String(s ?? "").replace(NEED_IMG_G,"");

function wrapLines(ctx,text,maxW){

    const out = [];

    String(text).split(/\r?\n/).forEach(par=>{

        let line = "";

        for(const w of par.split(" ")){

            const t = line ? line+" "+w : w;

            if(ctx.measureText(t).width<=maxW){ line = t; continue; }

            if(line) out.push(line);

            line = "";

            if(ctx.measureText(w).width<=maxW){ line = w; continue; }

            for(const ch of Array.from(w)){

                const u = line+ch;

                if(ctx.measureText(u).width>maxW && line){ out.push(line); line = ch; }
                else line = u;

            }

        }

        out.push(line);

    });

    return out;

}

/* render teks (termasuk emoji) menjadi gambar PNG berukuran milimeter */
function textImage(text,widthMm,opt={}){

    const PX = 8;
    const size = opt.size || 3.1;
    const lh = size*1.5;

    const font = `${opt.bold?"600 ":""}${size*PX}px "Jost","Segoe UI","Noto Sans","Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;

    const c = document.createElement("canvas");
    const x = c.getContext("2d");

    x.font = font;

    const maxW = widthMm*PX;
    const lines = wrapLines(x,text,maxW);

    c.width = Math.ceil(maxW);
    c.height = Math.max(1,Math.ceil(lines.length*lh*PX));

    x.font = font;
    x.textBaseline = "middle";
    x.fillStyle = `rgb(${C.ink.join(",")})`;

    lines.forEach((l,i)=>x.fillText(l,0,(i+.5)*lh*PX));

    return {url:c.toDataURL("image/png"),w:widthMm,h:lines.length*lh};

}

/* hook autoTable: sel berisi emoji digambar sebagai gambar */
function emojiHooks(widths,bold){

    return {

        didParseCell(d){

            if(d.section!=="body" || !(d.column.index in widths)) return;

            const raw = String(d.cell.raw ?? "");

            if(!NEED_IMG.test(raw)) return;

            const img = textImage(raw,widths[d.column.index]-6,
                {bold:!!bold && bold.includes(d.column.index)});

            d.cell._img = img;
            d.cell.text = [""];
            d.cell.styles.minCellHeight = img.h+6;

        },

        didDrawCell(d){

            const i = d.cell._img;

            if(i) d.doc.addImage(i.url,"PNG",d.cell.x+3,d.cell.y+3,i.w,i.h);

        }

    };

}

function pdfHeader(doc,title,right){

    const W = doc.internal.pageSize.getWidth();

    doc.setFillColor(...C.night);
    doc.rect(0,0,W,36,"F");

    doc.setFillColor(...C.gold);
    doc.rect(0,36,W,1,"F");

    doc.setFont("times","bold");
    doc.setFontSize(24);
    doc.setTextColor(...C.gold2);
    doc.text(title,14,18);

    doc.setFont("helvetica","normal");
    doc.setFontSize(10);
    doc.setTextColor(255,255,255);
    doc.text("Powered by DJATI Restu",14,27);

    doc.setFontSize(8.5);
    doc.setTextColor(...C.gold2);
    doc.text(right,W-14,27,{align:"right"});

}

function pdfSlim(doc,label){

    const W = doc.internal.pageSize.getWidth();

    doc.setFillColor(...C.night);
    doc.rect(0,0,W,10,"F");

    doc.setFillColor(...C.gold);
    doc.rect(0,10,W,.6,"F");

    doc.setFont("helvetica","normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.gold2);
    doc.text(`${EXPORT_BRAND}  |  ${label}`,14,6.5);

}

function statCard(doc,x,y,w,label,value,color){

    doc.setFillColor(...C.mist);
    doc.roundedRect(x,y,w,22,2,2,"F");

    doc.setFillColor(...color);
    doc.rect(x,y+3,1.2,16,"F");

    doc.setFont("times","bold");
    doc.setFontSize(20);
    doc.setTextColor(...C.moss);
    doc.text(String(value),x+6,y+12);

    doc.setFont("helvetica","normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.muted);
    doc.text(label,x+6,y+18);

}

function sectionTitle(doc,text,y){

    doc.setFont("times","bold");
    doc.setFontSize(15);
    doc.setTextColor(...C.moss);
    doc.text(text,14,y);

    doc.setFillColor(...C.gold);
    doc.rect(14,y+2,18,.8,"F");

}

function tableBase(doc,label,startPage){

    return {

        theme:"grid",
        margin:{top:16,left:14,right:14,bottom:20},

        styles:{font:"helvetica",fontSize:9,cellPadding:3,textColor:C.ink,
            lineColor:C.line,lineWidth:.1,valign:"middle",overflow:"linebreak"},

        headStyles:{fillColor:C.moss,textColor:C.gold2,fontStyle:"bold",halign:"left"},

        alternateRowStyles:{fillColor:[247,250,246]},

        didDrawPage(){

            if(doc.internal.getCurrentPageInfo().pageNumber>startPage) pdfSlim(doc,label);

        }

    };

}

async function exportPDFReport(){

    showLoading("Membuat PDF...");

    try{

        if(!window.jspdf) throw new Error("Library jsPDF belum termuat");

        try{ await document.fonts.load('16px "Jost"'); }catch(e){}

        const [guests,rsvp] = await Promise.all([
            get("action=getGuests"),
            get("action=getRSVP")
        ]);

        if(!Array.isArray(guests) || !Array.isArray(rsvp)){
            throw new Error("Data laporan tidak valid");
        }

        let dash = null;

        try{ dash = await get("action=dashboard"); }catch(e){}

        const present = guests.filter(g=>isPresent(g.status)).length;

        const sum = {
            totalGuest: dash && dash.status ? dash.totalGuest : guests.length,
            totalPresent: dash && dash.status ? dash.totalPresent : present,
            totalAbsent: dash && dash.status ? dash.totalAbsent : guests.length-present,
            totalRSVP: dash && dash.status ? dash.totalRSVP : rsvp.length
        };

        const {jsPDF} = window.jspdf;

        const pdf = new jsPDF("p","mm","a4");

        const W = pdf.internal.pageSize.getWidth();
        const H = pdf.internal.pageSize.getHeight();

        /* ---------- Halaman 1: Summary + Data Tamu ---------- */

        pdfHeader(pdf,"Wedding Guest Report",`Dicetak: ${exportDate()}`);

        const cw = (W-28-12)/4;

        statCard(pdf,14,48,cw,"TOTAL GUEST",sum.totalGuest,C.gold);
        statCard(pdf,14+(cw+4),48,cw,"SUDAH HADIR",sum.totalPresent,C.green);
        statCard(pdf,14+(cw+4)*2,48,cw,"BELUM HADIR",sum.totalAbsent,C.amber);
        statCard(pdf,14+(cw+4)*3,48,cw,"TOTAL RSVP",sum.totalRSVP,C.moss);

        sectionTitle(pdf,"Daftar Tamu",84);

        const gW = {0:12,1:62,2:40,3:30,4:38};
        const gHooks = emojiHooks({1:gW[1]});
        const guestPage = pdf.internal.getCurrentPageInfo().pageNumber;

        pdf.autoTable({

            ...tableBase(pdf,"Daftar Tamu",guestPage),

            startY:89,

            head:[["No","Nama","QR","Status","Check In"]],

            body:guests.length
                ? guests.map((g,i)=>[i+1,g.name || "",cleanText(g.qr),cleanText(g.status),cleanText(g.time || "-")])
                : [[{content:"Belum ada data tamu",colSpan:5,styles:{halign:"center",textColor:C.muted}}]],

            columnStyles:{
                0:{cellWidth:gW[0],halign:"center"},
                1:{cellWidth:gW[1]},
                2:{cellWidth:gW[2]},
                3:{cellWidth:gW[3],fontStyle:"bold"},
                4:{cellWidth:gW[4]}
            },

            didParseCell(d){

                gHooks.didParseCell(d);

                if(d.section==="body" && d.column.index===3 && guests.length){

                    d.cell.styles.textColor = isPresent(d.cell.raw) ? C.green : C.amber;

                }

            },

            didDrawCell:gHooks.didDrawCell

        });

        /* ---------- Halaman baru: RSVP ---------- */

        pdf.addPage();

        const rsvpPage = pdf.internal.getCurrentPageInfo().pageNumber;

        pdfHeader(pdf,"RSVP & Ucapan Tamu",`Total ${rsvp.length} ucapan`);

        sectionTitle(pdf,"RSVP",54);

        const rW = {0:12,1:40,2:94,3:36};
        const rHooks = emojiHooks({1:rW[1],2:rW[2],3:rW[3]},[1]);

        pdf.autoTable({

            ...tableBase(pdf,"RSVP",rsvpPage),

            startY:59,

            head:[["No","Nama","Ucapan","Tanggal"]],

            body:rsvp.length
                ? rsvp.map((r,i)=>[i+1,r.name || "",r.message || "",r.date || ""])
                : [[{content:"Belum ada ucapan",colSpan:4,styles:{halign:"center",textColor:C.muted}}]],

            columnStyles:{
                0:{cellWidth:rW[0],halign:"center"},
                1:{cellWidth:rW[1],fontStyle:"bold"},
                2:{cellWidth:rW[2]},
                3:{cellWidth:rW[3]}
            },

            didParseCell:rHooks.didParseCell,
            didDrawCell:rHooks.didDrawCell

        });

        /* ---------- Footer semua halaman ---------- */

        const pages = pdf.internal.getNumberOfPages();

        for(let i=1;i<=pages;i++){

            pdf.setPage(i);

            pdf.setDrawColor(...C.gold);
            pdf.setLineWidth(.3);
            pdf.line(14,H-14,W-14,H-14);

            pdf.setFont("helvetica","normal");
            pdf.setFontSize(9);
            pdf.setTextColor(...C.muted);

            pdf.text("Powered by DJATI Restu",14,H-8);
            pdf.text("Page "+i+" / "+pages,W-14,H-8,{align:"right"});

        }

        pdf.save("Wedding_Report.pdf");

        showToast("PDF berhasil dibuat");

    }
    catch(e){

        console.error(e);

        showToast("Gagal membuat PDF","error");

    }

    hideLoading();

}

/* ==========================================================
   QR ZIP (kartu QR per tamu)
========================================================== */

let cardFontsReady = null;

function loadCardFonts(){

    if(!cardFontsReady){

        cardFontsReady = Promise.all([
            document.fonts.load('84px "Great Vibes"'),
            document.fonts.load('700 60px "Cormorant Garamond"'),
            document.fonts.load('40px "Jost"')
        ]).catch(()=>{});

    }

    return cardFontsReady;

}

function loadImage(url,timeout=12000){

    return new Promise((resolve,reject)=>{

        const img = new Image();

        const t = setTimeout(()=>reject(new Error("timeout")),timeout);

        img.crossOrigin = "Anonymous";

        img.onload = ()=>{ clearTimeout(t); resolve(img); };
        img.onerror = ()=>{ clearTimeout(t); reject(new Error("gagal dimuat")); };

        img.src = url;

    });

}

async function loadQRImage(code){

    const url = "https://quickchart.io/qr?size=800&margin=1&text="+encodeURIComponent(code);

    try{ return await loadImage(url); }
    catch(e){ return await loadImage(url+"&r=1"); }   // coba sekali lagi

}

function roundRect(ctx,x,y,w,h,r){

    ctx.beginPath();
    ctx.moveTo(x+r,y);
    ctx.arcTo(x+w,y,x+w,y+h,r);
    ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);
    ctx.arcTo(x,y,x+w,y,r);
    ctx.closePath();

}

async function createGuestCard(guest){

    await loadCardFonts();

    let qrImage;

    try{ qrImage = await loadQRImage(guest.qr); }
    catch(e){ throw new Error("QR gagal dibuat : "+guest.name); }

    const canvas = document.createElement("canvas");

    canvas.width = 1000;
    canvas.height = 1200;

    const ctx = canvas.getContext("2d");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // Background
    ctx.fillStyle = "#fbfcfa";
    ctx.fillRect(0,0,1000,1200);

    // Header hijau
    const g = ctx.createLinearGradient(0,0,1000,230);
    g.addColorStop(0,"#14261f");
    g.addColorStop(1,"#2b4d3d");

    ctx.fillStyle = g;
    ctx.fillRect(0,0,1000,230);

    ctx.fillStyle = "#c9a15b";
    ctx.fillRect(0,230,1000,6);

    // Border emas ganda
    ctx.strokeStyle = "#c9a15b";
    ctx.lineWidth = 6;
    ctx.strokeRect(28,28,944,1144);

    ctx.strokeStyle = "#e6cf9f";
    ctx.lineWidth = 2;
    ctx.strokeRect(44,44,912,1112);

    ctx.textAlign = "center";

    // Judul
    ctx.fillStyle = "#e6cf9f";
    ctx.font = '26px "Jost",Arial,sans-serif';
    ctx.fillText("E - T I C K E T",500,98);

    ctx.font = '86px "Great Vibes","Brush Script MT",cursive';
    ctx.fillText("Wedding Invitation",500,190);

    // Bingkai QR
    ctx.fillStyle = "#ffffff";
    roundRect(ctx,190,290,620,620,22);
    ctx.fill();

    ctx.strokeStyle = "#c9a15b";
    ctx.lineWidth = 4;
    ctx.stroke();

    ctx.drawImage(qrImage,220,320,560,560);

    // Nama (otomatis mengecil agar muat)
    let name = String(guest.name || "");
    let size = 64;

    ctx.fillStyle = "#1f3a2e";

    ctx.font = `700 ${size}px "Cormorant Garamond",Georgia,serif`;

    while(ctx.measureText(name).width>800 && size>36){

        size -= 2;

        ctx.font = `700 ${size}px "Cormorant Garamond",Georgia,serif`;

    }

    while(ctx.measureText(name).width>800 && name.length>3){

        name = name.slice(0,-1);

    }

    if(name!==String(guest.name || "")) name = name.trim()+"...";

    ctx.fillText(name,500,985);

    // Kode tamu
    const code = String(guest.qr || "").toUpperCase();

    ctx.font = '500 40px "Jost",Arial,sans-serif';

    const cw = Math.min(ctx.measureText(code).width+80,860);

    ctx.fillStyle = "#f7f0e0";
    roundRect(ctx,500-cw/2,1012,cw,66,33);
    ctx.fill();

    ctx.fillStyle = "#1f3a2e";
    ctx.fillText(code,500,1058);

    // Keterangan & footer
    ctx.fillStyle = "#6a796d";
    ctx.font = '26px "Jost",Arial,sans-serif';
    ctx.fillText("Tunjukkan QR Code ini kepada petugas",500,1114);

    ctx.fillStyle = "#c9a15b";
    ctx.font = '24px "Jost",Arial,sans-serif';
    ctx.fillText("Powered by DJATI Restu",500,1146);

    return canvas;

}

async function exportQRZip(){

    showLoading("Mengambil data tamu...");

    try{

        const guests = await get("action=getGuests");

        if(!Array.isArray(guests)) throw new Error("Data tamu tidak valid");

        if(!guests.length){

            hideLoading();

            showToast("Tidak ada data.","warn");

            return;

        }

        hideLoading();

        showExportProgress();

        await generateQRZip(guests);

        hideExportProgress();
        resetExportProgress();

    }
    catch(err){

        console.error(err);

        hideLoading();

        hideExportProgress();
        resetExportProgress();

        showToast("Export gagal","error");

    }

}

async function generateQRZip(guests){

    const zip = new JSZip();

    const folder = zip.folder("QR Code");

    const total = guests.length;
    const failed = [];

    let next = 0;
    let done = 0;

    const safe = s=>String(s || "tamu")
        .replace(/[\\/:*?"<>|]/g,"")
        .replace(/\s+/g," ")
        .trim() || "tamu";

    async function worker(){

        while(next<total){

            const i = next++;
            const guest = guests[i];

            try{

                const canvas = await createGuestCard(guest);

                const blob = await new Promise((resolve,reject)=>
                    canvas.toBlob(b=>b ? resolve(b) : reject(new Error("canvas kosong")),"image/png",1)
                );

                folder.file(
                    String(guest.qr || i+1).toUpperCase()+" - "+safe(guest.name)+".png",
                    blob
                );

            }
            catch(e){

                console.error(e);

                failed.push(guest.name || guest.qr);

            }

            done++;

            updateExportProgress(done,total,guest);

            await new Promise(r=>requestAnimationFrame(r));

        }

    }

    await Promise.all(Array.from({length:3},worker));

    if(failed.length===total) throw new Error("Semua QR gagal dibuat");

    if(failed.length){
        folder.file("GAGAL.txt","QR berikut gagal dibuat:\n"+failed.join("\n"));
    }

    document.getElementById("exportProgressText").innerHTML = "Mengompresi ZIP...";
    document.getElementById("progressGuest").innerHTML = "Harap tunggu...";

    const content = await zip.generateAsync({type:"blob",compression:"STORE"});

    saveAs(content,"Wedding_QR_Code.zip");

    showToast(
        failed.length
        ? "QR ZIP dibuat, "+failed.length+" QR gagal"
        : "QR ZIP berhasil dibuat",
        failed.length ? "warn" : "success"
    );

}

/* ==========================================================
   Jendela progres export
========================================================== */

const ORIGINAL_TITLE = document.title;

function showExportProgress(){

    document.getElementById("exportProgress").classList.add("show");

}

function hideExportProgress(){

    document.getElementById("exportProgress").classList.remove("show");

    document.title = ORIGINAL_TITLE;

}

function updateExportProgress(current,total,guest){

    const percent = Math.round((current/total)*100);

    document.getElementById("exportProgressFill").style.width = percent+"%";
    document.getElementById("progressPercent").innerHTML = percent+"%";
    document.getElementById("progressGuest").textContent = guest.name || "-";
    document.getElementById("progressCount").innerHTML = current+" / "+total;
    document.getElementById("exportProgressText").innerHTML = "Generating QR Code...";

    document.title = percent+"% - Export QR";

}

function resetExportProgress(){

    document.getElementById("exportProgressFill").style.width = "0%";
    document.getElementById("progressPercent").innerHTML = "0%";
    document.getElementById("progressGuest").innerHTML = "-";
    document.getElementById("progressCount").innerHTML = "0 / 0";
    document.getElementById("exportProgressText").innerHTML = "Menyiapkan...";

}
