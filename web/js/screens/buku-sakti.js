/* ============================================================================
   hrcd-rekap : screens/buku-sakti.js — layar Buku Sakti (#/buku-sakti).

   Buku panduan panitia dan papan sprint. Isinya sendiri ada di
   web/js/buku-sakti.mjs; berkas ini cuma menggambarnya.
   ========================================================================== */

import { bolehLihat, daftarCentangSprint, ErrorApi, fotoBuku,
         setCentangSprint } from "../api.js";
import { BUKU_SAKTI, cariBagian, cariSprint, FITUR_LAYAR, FITUR_NAMA,
         lajurSeksi, NAMA_LAYAR, SPRINT,
         tugasSprint } from "../buku-sakti.mjs";
import { EDISI, ekorRute, kartuGalat, LAYAR, pasangKepala,
         sinyalLayarBaru } from "../common/frame.js";
import { berapaLalu, esc, h, ikon, ikonKotak, notif,
         tanggalJam } from "../util.js";

/* ============================== BUKU SAKTI ===============================

   Buku pegangan yang diserahkan ke kepanitiaan berikutnya. Isinya tinggal di
   buku-sakti.mjs sebagai data; layar ini cuma menggambarnya dan menyiapkan
   versi cetaknya.

   DIPAGARI CENTANG `pengaturan` SEJAK 5 SEPTEMBER 2026, dan itu kebalikan
   dari niat aslinya. Buku ini sengaja dibuat TANPA pagar hak akses: ia
   menjelaskan pekerjaan SELURUH panitia, dan yang paling butuh membacanya
   justru yang haknya paling sempit — juri pos yang baru pertama memegang
   lembar nilai, petugas meja yang dipindah pagi itu juga. Pemilik acara
   meminta ia ditutup dulu karena isinya masih ditulis ulang; alasan
   lengkapnya, dan cara membukanya kembali untuk seluruh panitia, ada di
   layarBukuSakti().

   Yang dijaga hak akses adalah DATA. Buku ini tidak memuat satu baris data
   pun — tidak ada nama regu, tidak ada nilai, tidak ada nomor WA pembina.

   TAUTAN DI DALAMNYA TETAP IKUT HAK. Blok "layar" menyebut fitur yang
   dibutuhkan, dan yang tidak memegangnya melihat kotak yang sama tanpa
   tautan, lengkap dengan nama centang yang harus diminta ke admin. Tautan
   yang berujung pada kartu "tidak berhak" mengajari orang bahwa buku ini
   tidak bisa dipercaya, dan buku panduan yang tidak dipercaya sama saja
   dengan tidak ada.
   ========================================================================= */

/** Bagian yang harus digulir ke tempatnya SESUDAH layar digambar ulang.
 *
 *  Daftar isi dan hasil cari sama-sama bisa menunjuk bagian di bab LAIN, dan
 *  berpindah bab berarti hash berganti, arahkan() jalan, dan seluruh DOM
 *  dibangun ulang. Elemen tujuannya belum ada saat tombolnya diketuk, jadi
 *  yang bisa dititipkan lintas penggambaran cuma kodenya. */
export let bagianDitujuBuku = null;

/** Nomor bab untuk dibaca manusia: "Bab 2". Diambil dari urutannya di
 *  BUKU_SAKTI, bukan disimpan di datanya — dua tempat yang menyimpan urutan
 *  yang sama adalah dua tempat yang suatu hari tidak sepakat. */
export const nomorBabBuku = (bab) => BUKU_SAKTI.indexOf(bab) + 1;

/** Satu blok isi jadi markup layar.
 *
 *  esc() di SETIAP sisipan. Teks buku ini memang ditulis panitia sendiri,
 *  tapi "ditulis orang yang kita percaya" bukan alasan yang bertahan: satu
 *  tanda kurang-dari di tengah kalimat sudah cukup membuang sisa paragrafnya,
 *  tanpa satu pun galat, dan yang menemukannya pembaca yang kehilangan
 *  separuh halaman. */
export function blokBuku(blok) {
  switch (blok.jenis) {
    case "p":
      return `<p>${esc(blok.teks)}</p>`;
    case "poin":
      return `<ul class="bs-poin">${
        blok.butir.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
    case "langkah":
      return `<ol class="bs-langkah">${
        blok.butir.map(x => `<li>${esc(x)}</li>`).join("")}</ol>`;
    case "tabel":
      /* DUA hal yang membuat tabel ini terbaca di HP, dan keduanya wajib.

         `data-label` membawa nama kolomnya, karena di bawah 900px `<thead>`
         disembunyikan dan sel tanpa label kehilangan artinya sama sekali —
         isi yang berdiri sendiri tanpa nama kolomnya.

         `data-baris` yang MENYALAKAN rupa kartunya. Tanpa atribut itu barisnya
         tetap dipecah jadi blok bertumpuk (aturan `.data-table:not(
         .table-tetap)`), tetapi tidak mendapat kotak, jarak, maupun awalan
         nama kolom — yang tergambar deretan potongan teks telanjang, dan
         labelnya justru tidak ikut. Nilainya cuma nomor urut: seluruh aturan
         di style.css memakainya sebagai penanda ADA, bukan membaca isinya. */
      return `<div class="bs-tabel-bungkus">
        <table class="table data-table bs-tabel">
          <thead><tr>${blok.kepala.map(k => `<th>${esc(k)}</th>`).join("")}</tr></thead>
          <tbody>${blok.baris.map((baris, n) => `<tr data-baris="${n}">${
            baris.map((sel, i) => `<td data-label="${esc(blok.kepala[i] || "")}">${
              esc(sel)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table></div>`;
    case "kenapa":
      return `<p class="bs-kenapa">${esc(blok.teks)}</p>`;
    case "foto":
      return blokFotoBuku(blok);
    case "layar":
      return blokLayarBuku(blok);
    default:
      /* Jenis yang tidak dikenal DIAM, tidak melempar. Buku yang salah ketik
         satu jenis blok tetap terbuka dan kehilangan satu blok; kalau ia
         melempar, seluruh layar jadi kartu galat dan yang hilang seluruh
         buku. Yang menangkap salah ketiknya tes bentuk, jauh sebelum sini. */
      return "";
  }
}

/** Blok "foto": satu gambar contoh beserta keterangannya.
 *
 *  KETERANGANNYA YANG UTAMA, gambarnya pelengkap. Urutan di DOM sengaja
 *  begitu — teks lebih dulu, gambar sesudahnya — supaya bagian ini tetap
 *  berarti kalau gambarnya belum diupload, atau Supabase sedang tidak bisa
 *  dihubungi. Buku panduan paling dibutuhkan justru saat ada yang rusak.
 *
 *  `onerror` MEMBUANG gambarnya, bukan menggantinya dengan gambar cadangan.
 *  Ikon gambar-rusak bawaan browser tidak mengatakan apa-apa kepada panitia
 *  dan cuma memakan tempat; yang tersisa sesudahnya keterangan lengkap, yang
 *  memang sudah bisa berdiri sendiri. */
export function blokFotoBuku(blok) {
  return `<figure class="bs-foto">
    <figcaption>${esc(blok.teks)}</figcaption>
    <img src="${esc(fotoBuku(blok.berkas))}" alt="${esc(blok.teks)}"
         loading="lazy" onerror="this.remove()"></figure>`;
}

/** Blok "layar": kotak yang menunjuk layar sungguhan, ikut hak akun. */
export function blokLayarBuku(blok) {
  const isi = `<span class="bs-layar-nama">${esc(blok.nama)}</span>`
    + (blok.teks ? `<span class="bs-layar-teks">${esc(blok.teks)}</span>` : "");
  if (!blok.fitur || bolehLihat(blok.fitur)) {
    return `<a class="bs-layar" href="${esc(blok.hash)}">${isi}</a>`;
  }
  return `<div class="bs-layar bs-layar-mati">${isi}
    <span class="bs-layar-hak">Butuh centang ${
      esc(FITUR_NAMA[blok.fitur] || blok.fitur)} di layar Akun.</span></div>`;
}

/** Satu bagian bacaan.
 *
 *  TIDAK ada atribut pencarian di sini, dan itu disengaja: kotak cari
 *  membaca DATA-nya lewat cariBagian(), bukan DOM. Menaruh salinan teksnya di
 *  atribut akan membuat dua sumber untuk satu pertanyaan — dan yang di DOM
 *  itu yang basi begitu bukunya disunting sementara halamannya tidak dimuat
 *  ulang. */
export function bagianBukuHtml(bagian) {
  return `<section class="card bs-bagian" id="bs-${esc(bagian.kode)}">
    <h3>${esc(bagian.judul)}</h3>
    ${bagian.isi.map(blokBuku).join("")}
  </section>`;
}

/* ------------------------------ PAPAN SPRINT -----------------------------

   Tiga belas sprint dua mingguan, dan tiap tugasnya bisa dicentang. Centangnya
   duduk di database (migrasi 0170) dan terlihat oleh seluruh panitia — papan
   rencana yang jawabannya berbeda-beda per HP bukan papan koordinasi.

   DIGAMBAR DULU, CENTANGNYA MENYUSUL.

   Layar ini tidak menunggu jaringan sebelum menggambar apa pun. Isinya berkas
   statis yang sudah ikut termuat bersama app.js, jadi papannya muncul seketika
   dengan seluruh kotak dalam keadaan kosong, lalu satu permintaan mengisinya.
   Urutan itu yang membuat janji di kepala buku-sakti.mjs tetap benar: bukunya
   terbaca walau Supabase tidak terjangkau, dan yang hilang cuma centangnya.

   Karena itu gagalnya BUKAN kartu galat. Yang tergambar sebaris kecil di
   kepala papan, dan seluruh isi bukunya tetap bisa dibaca. */

/** Centang yang sedang berlaku: kode tugas -> { dicentang_oleh, dicentang_pada }.
 *
 *  Di luar fungsi layarnya supaya kembali dari layar lain tidak mengosongkan
 *  papan sampai permintaannya selesai — papan yang berkedip kosong tiap kali
 *  pembaca menekan Back terbaca seperti centang yang hilang. */
export let centangSprint = new Map();

/** Sudah pernah dibaca dari server sekali? Membedakan "belum tahu" dari
 *  "sudah tahu, dan memang kosong" — yang pertama tidak boleh dilaporkan
 *  sebagai papan yang belum dikerjakan siapa pun. */
export let centangSprintTerbaca = false;

/** Tautan kecil di kaki sebuah tugas, ikut hak akun.
 *
 *  Yang tidak berhak TIDAK diberi tautan mati: tugasnya tetap terbaca lengkap,
 *  cuma tanpa jalan pintas. Menuliskan "butuh centang X" di sini seperti pada
 *  blok layar akan menambah satu baris di bawah SERATUS TUJUH tugas, dan papan
 *  yang gunanya untuk disapu cepat berhenti bisa disapu. */
export function tautanTugasSprint(tugas) {
  if (!tugas.layar) return "";
  const fitur = FITUR_LAYAR[tugas.layar];
  if (fitur && !bolehLihat(fitur)) return "";
  return `<a class="bs-todo-layar" href="${esc(tugas.layar)}">${
    esc(NAMA_LAYAR[tugas.layar] || tugas.layar)}</a>`;
}

/** Satu tugas: kotak centang, teksnya, seksinya, dan jejak siapa mencentang.
 *
 *  Kotak centang DI DALAM <label> bersama teksnya, jadi seluruh kalimat jadi
 *  sasaran ketukan. Di HP, kotak 20px yang berdiri sendiri di antara seratus
 *  baris adalah sasaran yang meleset. */
export function tugasSprintHtml(tugas) {
  /* Nama seksinya TIDAK ditulis lagi di sini. Tugas ini duduk di dalam
     lajur seksinya, dan kepala lajur itu menempel di atas selama papan
     digulir — jadi menuliskannya lagi di bawah tiap tugas berarti nama
     yang sama tercetak seratus enam belas kali di kolom yang seluruh
     isinya memang seksi itu. Di rentang HP, tempat kepala lajurnya
     tidak ikut turun, yang membawanya bs-sel-lajur sekali per sel. */
  return `<li class="bs-todo-item" data-tugas="${esc(tugas.kode)}">
    <label class="bs-todo-baris">
      <input type="checkbox" class="checkbox bs-todo-kotak"
             data-tugas="${esc(tugas.kode)}">
      <span class="bs-todo-teks">${esc(tugas.teks)}</span>
    </label>
    <div class="bs-todo-kaki">
      ${tautanTugasSprint(tugas)}
      <span class="bs-todo-jejak" data-jejak="${esc(tugas.kode)}"></span>
    </div>
  </li>`;
}

/** Hari ini itu H berapa, dihitung dari tanggal lomba edisi yang aktif.
 *
 *  NULL kalau edisinya belum termuat atau tanggalnya tidak terbaca. Papan ini
 *  harus tetap tergambar tanpa jaringan (janji di kepala buku-sakti.mjs), jadi
 *  ketiadaan tanggal bukan galat — yang hilang cuma penanda sekarang.
 *
 *  Dihitung di tengah hari, bukan tengah malam: selisih dua tanggal yang
 *  melewati pergantian waktu musim panas bisa jatuh 23 atau 25 jam, dan
 *  pembagian dengan 24 jam membuat hasilnya meleset satu hari. Tidak ada DST
 *  di Indonesia, tapi laptop yang zona waktunya salah setel bukan hal aneh. */
export function hariIniH() {
  const tgl = EDISI && EDISI.tanggal_lomba;
  if (!tgl) return null;
  const lomba = new Date(`${tgl}T12:00:00`);
  if (Number.isNaN(lomba.getTime())) return null;
  const kini = new Date();
  const hariIni = new Date(kini.getFullYear(), kini.getMonth(), kini.getDate(), 12);
  return Math.round((hariIni - lomba) / 86400000);
}

/** Keadaan tiap sprint terhadap hari ini: "lewat", "sekarang", atau "nanti".
 *
 *  Inilah yang membuat papan ini menjawab pertanyaan yang sebenarnya dibawa
 *  panitia waktu membukanya — bukan "apa rencananya" melainkan "sekarang
 *  seharusnya sudah sampai mana". Patokannya hMulai dan hSelesai, bukan nama
 *  bulan: bulan bergeser tiap edisi, hitungan mundur dari hari-H tidak. */
export function keadaanSprint(sprint, h) {
  if (h === null) return "";
  if (h > sprint.hSelesai) return "lewat";
  if (h < sprint.hMulai) return "nanti";
  return "sekarang";
}

/** Satu sel papan: tugas satu seksi di satu sprint.
 *
 *  Sel kosong tetap digambar dan tetap kosong. Di rentang papan ia yang
 *  menjaga lajur di bawahnya tetap lurus; di rentang HP ia disembunyikan CSS,
 *  karena daftar yang memuat empat belas baris kosong per sprint tidak bisa
 *  dibaca sama sekali. */
export function selPapanHtml(sprint, lajur, pita) {
  const tugas = sprint.tugas.filter(t => t.seksi === lajur.judul);
  if (!tugas.length) {
    return `<div class="bs-sel bs-sel-kosong ${esc(pita)}"
                 data-lajur="${esc(lajur.judul)}"></div>`;
  }
  /* Nama seksinya ikut DI DALAM sel, dan disembunyikan di rentang papan.
     Di rentang HP kepala lajurnya tidak ikut turun bersama selnya, jadi
     tanpa baris ini tugasnya kehilangan nama pemiliknya sama sekali —
     persoalan yang sama dengan data-label pada tabel yang jadi kartu. */
  return `<div class="bs-sel ${esc(pita)}" data-lajur="${esc(lajur.judul)}">
    <span class="bs-sel-lajur i-${esc(lajur.rona)}">${esc(lajur.judul)}</span>
    <ul class="bs-todo">${tugas.map(tugasSprintHtml).join("")}</ul>
  </div>`;
}

/** Satu baris papan: kepala sprintnya, lalu satu sel per lajur seksi. */
export function barisPapanHtml(sprint, lajur, h) {
  const keadaan = keadaanSprint(sprint, h);
  /* PITA SATU BARIS, dan ia menjawab persoalan yang muncul begitu garis kisi
     dibuang: tinggi sebuah baris ditentukan seksi tersibuk di sprint itu, jadi
     enam belas lajur lain berakhir kosong sepanjang beberapa ratus piksel.
     Tanpa pita, kekosongan itu terbaca sebagai papan yang bolong; dengan pita,
     ia terbaca sebagai satu sprint yang memang cuma menyibukkan sedikit seksi
     — dan mata bisa menyusuri satu sprint melintang tujuh belas lajur tanpa
     kehilangan barisnya. Sprint yang sedang berjalan mendapat pitanya sendiri. */
  const pita = keadaan === "sekarang"
    ? "bs-pita-sekarang"
    : (sprint.nomor % 2 ? "bs-pita-ganjil" : "bs-pita-genap");
  /* HANYA dua keadaan yang punya kelas, karena hanya dua yang punya aturan.
     Bentuk sebelumnya menuliskan `bs-baris-${keadaan || "netral"}`, jadi
     baris yang belum datang memakai kelas `bs-baris-nanti` dan baris yang
     tanggal lombanya belum terbaca memakai `bs-baris-netral` — dua nama yang
     tidak menggambar apa pun. Kelas mati mengundang aturan yang suatu hari
     ditulis untuknya di tempat lain, lalu berlaku tanpa ada yang mencarinya. */
  const kelas = keadaan === "sekarang" ? " bs-baris-sekarang"
    : keadaan === "lewat" ? " bs-baris-lewat" : "";
  /* .bs-sprint-waktu — Tiga patokan waktu, dan yang ketiga yang membuat papan
     ini masih berguna tahun depan: bulan boleh bergeser, hitungan mundur dari
     hari-H tidak. */
  return `<div class="bs-baris-kepala${kelas}"
       id="bs-sprint-${esc(sprint.kode)}" data-sprint="${esc(sprint.kode)}">
      <div class="bs-baris-atas">
        <span class="bs-baris-urut">${esc(String(sprint.nomor))}</span>
        <h3>${esc(sprint.tajuk)}</h3>
        <span class="bs-sprint-kemajuan" data-kemajuan="${esc(sprint.kode)}"></span>
      </div>
      <div class="bs-sprint-waktu">${esc(sprint.bulan)} · ${
        esc(sprint.rentang)} · ${esc(sprint.mundur)}</div>
      ${keadaan === "sekarang"
        ? `<span class="badge badge-green bs-baris-tanda">SEDANG BERJALAN</span>`
        : ""}
      <p class="bs-sprint-fokus">${esc(sprint.fokus)}</p>
      <p class="bs-sprint-hasil"><strong>Selesai kalau:</strong> ${
        esc(sprint.hasil)}</p>
      <p class="bs-kenapa bs-jangan">${esc(sprint.jangan)}</p>
    </div>
    ${lajur.map(l => selPapanHtml(sprint, l, pita)).join("")}`;
}

/** SELURUH papan: waktu mengalir ke bawah, seksi berjajar ke samping.
 *
 *  Bentuknya dipilih dari pertanyaan yang dibawa pembacanya. Yang membuka
 *  papan ini bertanya dua hal, dan keduanya butuh sumbu yang berbeda:
 *  "sekarang seharusnya sudah sampai mana" dibaca MENURUN, dan "seksi saya
 *  kebagian apa saja" dibaca MENURUN DI SATU LAJUR. Satu kolom per seksi
 *  menjawab keduanya dengan satu gambar.
 *
 *  Lajurnya diambil dari bab Seksi lewat lajurSeksi(), tidak ditulis ulang di
 *  sini — alasannya di sana. */
export function papanSprintHtml() {
  const lajur = lajurSeksi();
  const h = hariIniH();
  /* .bs-papan-bungkus — Penggulir mendatarnya WADAH ini, tidak pernah badan
     halaman (CLAUDE.md bagian 15). Kepala lajur menempel di atas dan kepala
     sprint menempel di kiri, jadi yang digeser tidak pernah kehilangan nama
     seksinya maupun nomor sprintnya. */
  return `<div class="bs-legenda">
      ${lajur.map(l => `<button type="button" class="bs-legenda-chip i-${
        esc(l.rona)}" data-sorot="${esc(l.judul)}">${esc(l.singkat)}<span
        class="bs-legenda-hitung" data-lajur-hitung="${esc(l.judul)}"></span></button>`).join("")}
    </div>
    <div class="bs-papan-bungkus">
      <div class="bs-papan" style="--lajur:${lajur.length}">
        <div class="bs-papan-sudut">Sprint</div>
        ${lajur.map(l => `<div class="bs-lajur-kepala i-${esc(l.rona)}"
             data-lajur="${esc(l.judul)}"
             title="${esc(l.judul)}">${esc(l.singkat)}</div>`).join("")}
        ${SPRINT.map(s => barisPapanHtml(s, lajur, h)).join("")}
      </div>
    </div>`;
}

/** Gambar ulang kotak centang, jejak, dan lencana kemajuan dari `centangSprint`.
 *
 *  MENYENTUH SEL YANG SUDAH ADA, tidak membangun ulang papannya. Membangun
 *  ulang akan memindahkan kotak tepat sebelum jempol turun, dan melempar
 *  gulirannya ke atas di tengah rapat — persis alasan layar lain berhenti
 *  menggambar ulang pada `visibilitychange`. */
export function segarkanPapanSprint() {
  const papan = document.getElementById("bs-panel-sprint");
  if (!papan) return;

  for (const kotak of papan.querySelectorAll("[data-tugas].bs-todo-kotak")) {
    const c = centangSprint.get(kotak.dataset.tugas);
    kotak.checked = !!c;
  }
  for (const jejak of papan.querySelectorAll("[data-jejak]")) {
    const c = centangSprint.get(jejak.dataset.jejak);
    /* Jejak dibiarkan KOSONG kalau belum dicentang, bukan diisi "belum".
       Seratus tujuh baris "belum" adalah seratus tujuh baris yang tidak
       mengatakan apa-apa, dan yang dicari mata justru yang sudah selesai. */
    jejak.textContent = c
      ? `${c.dicentang_oleh || "panitia"} · ${berapaLalu(c.dicentang_pada)}`
      : "";
  }
  for (const lencana of papan.querySelectorAll("[data-kemajuan]")) {
    const sprint = SPRINT.find(s => s.kode === lencana.dataset.kemajuan);
    if (!sprint) continue;
    const selesai = sprint.tugas.filter(t => centangSprint.has(t.kode)).length;
    const penuh = selesai === sprint.tugas.length;
    lencana.className = `badge bs-sprint-kemajuan ${
      penuh ? "badge-green" : "badge-kemajuan"}`;
    lencana.textContent = `${selesai}/${sprint.tugas.length}`;
  }

  /* TERLAMBAT, dan ini yang membuat papan menjawab pertanyaan yang dibawa
     pembacanya. Tugas di sprint yang sudah LEWAT tetapi belum tercentang
     ditandai; yang belum lewat tidak, betapapun kosongnya. Tanpa pemisahan
     itu papan yang baru dibuka di bulan pertama tampak merah seluruhnya dan
     berhenti berarti apa-apa.

     Ditandai di sini, bukan waktu menggambar, karena ia bergantung pada
     centang yang datangnya menyusul dari server. */
  const h = hariIniH();
  const telat = new Set();
  if (h !== null) {
    for (const sprint of SPRINT) {
      if (keadaanSprint(sprint, h) !== "lewat") continue;
      for (const t of sprint.tugas) if (!centangSprint.has(t.kode)) telat.add(t.kode);
    }
  }
  for (const item of papan.querySelectorAll(".bs-todo-item[data-tugas]")) {
    item.classList.toggle("bs-todo-telat", telat.has(item.dataset.tugas));
  }

  /* Hitungan per lajur: berapa tugas seksi itu yang belum selesai. Angka nol
     DIHILANGKAN, tidak ditulis 0 — yang dicari mata di legenda ini justru
     seksi yang masih punya sisa, dan tujuh belas angka nol menutupinya. */
  for (const hitung of papan.querySelectorAll("[data-lajur-hitung]")) {
    const nama = hitung.dataset.lajurHitung;
    const sisa = tugasSprint()
      .filter(x => x.tugas.seksi === nama && !centangSprint.has(x.tugas.kode)).length;
    hitung.textContent = sisa ? String(sisa) : "";
  }

  const ringkas = document.getElementById("bs-sprint-ringkas");
  if (ringkas) {
    const semua = tugasSprint();
    const selesai = semua.filter(x => centangSprint.has(x.tugas.kode)).length;
    ringkas.textContent = centangSprintTerbaca
      ? `${selesai} dari ${semua.length} tugas selesai.`
      : "Centang belum terbaca — papan ini tetap bisa dibaca, tetapi yang "
        + "tercentang belum tentu tergambar.";
    ringkas.classList.toggle("bs-sprint-putus", !centangSprintTerbaca);
  }
}

/** Ambil centang dari server lalu gambar ulang. Gagalnya ditelan.
 *
 *  Sengaja TIDAK melempar dan tidak memanggil notif(): membuka buku panduan
 *  saat sinyal mati adalah hal yang wajar dilakukan orang, dan kotak merah
 *  yang muncul tiap kali bukunya dibuka mengajari orang menutupnya tanpa
 *  membaca. Yang memberitahukannya satu baris kecil di kepala papan. */
export async function muatCentangSprint() {
  try {
    const baris = await daftarCentangSprint();
    centangSprint = new Map((baris || []).map(x => [x.kode, x]));
    centangSprintTerbaca = true;
  } catch {
    centangSprintTerbaca = false;
  }
  segarkanPapanSprint();
}

export function layarBukuSakti() {
  /* LEBAR BIASA (760px), bukan `wide`.

     Layar meja memakai 1080px supaya tabelnya muat; layar ini bacaan, dan
     baris sepanjang 1054px membuat mata kehilangan awal baris berikutnya tiap
     kali ia kembali ke kiri. Diukur di browser: pada lebar biasa satu baris
     paragraf jatuh di sekitar 68 huruf — persis rentang yang nyaman dibaca
     panjang-panjang.

     Wadahnya yang dibatasi, bukan paragrafnya. Kalau `max-width` ditaruh di
     kartu bagian saja, kartu bacaan jadi 686px sementara kepala, deret tab,
     dan kartu bab tetap 1054px — empat tepi kiri-kanan yang tidak sejajar di
     satu halaman, dan itu terbaca seperti tata letak yang rusak, bukan
     seperti kolom bacaan. */
  pasangKepala("Buku Sakti");
  /* DIPAGARI SEMENTARA, dan ini kebalikan dari niat aslinya.

     Buku ini dulu terbuka untuk semua akun panitia, karena yang paling butuh
     membacanya justru yang haknya paling sempit. Sejak 5 September 2026 ia
     dipagari centang `pengaturan` atas permintaan pemilik acara: isinya masih
     ditulis ulang, dan buku panduan yang berubah tiap jam menyesatkan
     pembacanya lebih banyak daripada menolongnya.

     Yang dipakai centang, BUKAN nama akun (CLAUDE.md 13.1). Menuliskan
     "admin.ciradyka" di sini akan patah begitu username itu diganti — layar
     Akun bisa menggantinya — dan pagarnya tidak akan kelihatan di matriks
     centang tempat panitia mengurus hak. Membukanya kembali untuk seluruh
     panitia nanti cukup mengembalikan baris ini beserta FITUR_LAYAR. */
  if (!bolehLihat("pengaturan")) {
    LAYAR.replaceChildren(h(kartuGalat(
      "Akun ini tidak berhak membuka Buku Sakti.")));
    return;
  }
  const diminta = ekorRute(location.hash);
  const bab = BUKU_SAKTI.find(b => b.kode === diminta) || BUKU_SAKTI[0];

  /* SELURUH BAB DIGAMBAR SEKALIGUS, yang tidak terpilih disembunyikan.

     Isinya statis dan tidak menyentuh jaringan sama sekali, jadi harganya
     cuma DOM — dan yang dibeli dengan itu kotak cari yang menyapu seluruh
     buku tanpa satu pun penggambaran ulang, termasuk bab yang sedang tidak
     terbuka. Menggambar per bab akan menuntut kotak cari punya salinan
     teksnya sendiri, dan salinan itu yang suatu hari tidak sepakat dengan
     yang tergambar. */
  const panel = BUKU_SAKTI.map(b => `
    <div class="bs-panel" data-bab="${esc(b.kode)}"${b === bab ? "" : " hidden"}>
      <div class="card bs-bab">
        <div class="bs-bab-kepala">
          ${ikonKotak(b.ikon, b.warna)}
          <div>
            <h2>Bab ${esc(String(nomorBabBuku(b)))} — ${esc(b.judul)}</h2>
            <p class="description">${esc(b.ringkas)}</p>
          </div>
        </div>
        ${b.kode === "timeline" ? "" : `
        <nav class="bs-isi" aria-label="Daftar isi ${esc(b.judul)}">
          <ol>${b.bagian.map(bagian =>
            `<li><button type="button" class="bs-ke"
                         data-ke="bs-${esc(bagian.kode)}">${
              esc(bagian.judul)}</button></li>`).join("")}</ol>
        </nav>`}
      </div>
      ${b.kode === "timeline"
        ? `<div class="bs-timeline" id="bs-panel-sprint">
             <p class="description" id="bs-sprint-ringkas"></p>
             ${papanSprintHtml()}
           </div>`
        : b.bagian.map(bagianBukuHtml).join("")}
    </div>`).join("");

  /* .description — Satu kalimat, dan ia membawa fakta yang tidak ada di
     judulnya: siapa yang menulis buku ini dan kapan ia ditulis ulang. Tanpa
     itu pembaca tidak tahu bahwa isinya boleh — dan harus — diubah. */
  /* .tab-golongan — NAV BERISI TAUTAN, bukan role="tablist" berisi role="tab".
     Bentuknya memang meminjam pil tab Live Score, tapi yang di sini
     benar-benar TAUTAN: mengetuknya mengganti alamat dan menambah entri
     Back, sementara sebuah tab tidak pindah halaman. Pembaca layar yang
     diberi tahu "tab" lalu mendapat perpindahan halaman kehilangan
     tempatnya. Yang menandai bab terbuka aria-current="page" — penanda
     yang memang untuk satu tautan di antara sekelompok tautan. */
  LAYAR.replaceChildren(h(`
    <div class="card bs-kepala">
      <h2>Buku Sakti — ${esc(EDISI ? EDISI.name : "HRCD")}</h2>
      <p class="description">Ditulis ulang tiap serah terima jabatan oleh
        panitia yang turun, untuk panitia yang naik.</p>
      <div class="bs-alat">
        <label class="visually-hidden" for="bs-cari">Cari isi buku</label>
        <input type="search" id="bs-cari" autocomplete="off"
               placeholder="Cari isi buku…">
        <div class="bs-cetak">
          <button class="button button-secondary button-small" id="bs-cetak-bab"
                  type="button">${ikon("printer")} Cetak Bab Ini</button>
          <button class="button button-primary button-small" id="bs-cetak-semua"
                  type="button">${ikon("printer")} Cetak Semua</button>
        </div>
      </div>
    </div>

    <nav class="tab-golongan bs-tab" aria-label="Bab">
      ${BUKU_SAKTI.map(b => `
        <a class="tab-gol" href="#/buku-sakti/${esc(b.kode)}"${
          b === bab ? ' aria-current="page"' : ""}>
          ${esc(b.tab)}
          <span class="tab-hitung">${esc(String(
            b.kode === "timeline" ? SPRINT.length : b.bagian.length))}</span>
        </a>`).join("")}
    </nav>

    <div class="card bs-hasil" id="bs-hasil" hidden></div>
    <div id="bs-panel-semua">${panel}</div>
  `));

  /* sinyalLayarBaru(), BUKAN `pengendaliLayar.signal`.

     arahkan() memanggil `pengendaliLayar.abort()` sebelum menggambar layar
     berikutnya dan TIDAK membuat pengendali baru — yang membuatnya cuma
     fungsi ini. Jadi sinyal yang dibaca langsung dari `pengendaliLayar` di
     sini sudah dalam keadaan aborted, dan `addEventListener` dengan sinyal
     seperti itu diam saja: tidak melempar, tidak memperingatkan, tidak
     memasang apa pun.

     Ditulis sepanjang ini karena gagalnya tidak terlihat. Layarnya tergambar
     lengkap, tab-nya berpindah (itu tautan, bukan pendengar), dan yang mati
     cuma kotak cari serta daftar isinya — dua hal yang baru dicoba orang
     sesudah beberapa menit membaca. */
  const sinyal = sinyalLayarBaru();
  const elCari = document.getElementById("bs-cari");
  const elHasil = document.getElementById("bs-hasil");
  const elSemua = document.getElementById("bs-panel-semua");

  /** Gulir ke satu bagian dan tandai sebentar supaya mata menemukannya.
   *
   *  Tanpa penandaan, melompat ke bagian kesebelas dari daftar isi mendarat
   *  di tengah tembok teks yang semuanya berupa kartu putih seukuran sama,
   *  dan yang melompat harus membaca judulnya untuk memastikan ia sampai di
   *  tempat yang benar. */
  const gulirKe = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: "start", behavior: "smooth" });
    el.classList.add("bs-sorot");
    setTimeout(() => el.classList.remove("bs-sorot"), 1600);
  };

  if (bagianDitujuBuku) {
    const tujuan = bagianDitujuBuku;
    bagianDitujuBuku = null;
    // Satu putaran ditunggu: elemennya baru saja masuk DOM dan belum punya
    // posisi, jadi scrollIntoView() yang dipanggil sekarang mendarat di 0.
    setTimeout(() => gulirKe(tujuan), 0);
  }

  /* KOTAK CARI MENYAPU SELURUH BUKU, bukan bab yang sedang terbuka.

     Yang mengetik "gembok" tidak tahu — dan tidak perlu tahu — bahwa gembok
     dijelaskan di bab Menjalankan HRCD dan disinggung lagi di bab Seksi.
     Kotak yang cuma menyaring bab yang kebetulan terbuka menjawab "tidak
     ketemu" untuk kata yang jelas-jelas ada di bukunya. */
  const saring = () => {
    const kata = elCari.value.trim();
    if (!kata) {
      elHasil.hidden = true;
      elSemua.hidden = false;
      return;
    }
    const bagian = cariBagian(kata);
    const sprint = cariSprint(kata);
    const jumlah = bagian.length + sprint.length;
    elSemua.hidden = true;
    elHasil.hidden = false;
    elHasil.replaceChildren(h(`<div>
      <p class="description">${jumlah === 0
        ? "Tidak ada bagian yang memuat semua kata itu."
        : `${esc(String(jumlah))} bagian memuat semua kata itu.`}</p>
      <ul class="bs-hasil-daftar">
        ${bagian.map(({ bab: b, bagian: g }) => `
          <li><button type="button" class="bs-hasil-butir"
                      data-bab="${esc(b.kode)}" data-ke="bs-${esc(g.kode)}">
            <span class="bs-hasil-bab">Bab ${esc(String(nomorBabBuku(b)))} · ${
              esc(b.judul)}</span>
            <span class="bs-hasil-judul">${esc(g.judul)}</span>
          </button></li>`).join("")}
        ${sprint.map(sp => `
          <li><button type="button" class="bs-hasil-butir"
                      data-bab="timeline" data-ke="bs-sprint-${esc(sp.kode)}">
            <span class="bs-hasil-bab">Sprint ${esc(String(sp.nomor))} · ${
              esc(sp.bulan)} ${esc(sp.rentang)}</span>
            <span class="bs-hasil-judul">${esc(sp.tajuk)}</span>
          </button></li>`).join("")}
      </ul>
    </div>`));
  };
  elCari.addEventListener("input", saring, { signal: sinyal });

  /* KOTAK CENTANG PAPAN SPRINT.

     Bentuknya sama persis dengan matriks hak di layar Akun, dan itu disengaja
     — panitia yang sudah pernah mencentang di sana tidak perlu belajar apa
     pun yang baru:

       diredupkan selagi disimpan, BUKAN di-disable (.checkbox.saving);
       ketukan beruntun DIANTREKAN, bukan diblokir, supaya salah centang bisa
         langsung dibatalkan;
       ditolak server = kotaknya DIKEMBALIKAN, karena kotak yang tetap
         tercentang padahal servernya menolak adalah kebohongan yang baru
         ketahuan besok.

     Satu antrean untuk SELURUH papan: dua ketukan pada tugas yang sama harus
     mendarat urut, dan urutan itulah yang menentukan keadaan akhirnya. */
  let antreCentang = Promise.resolve();
  LAYAR.addEventListener("change", (ev) => {
    const kotak = ev.target.closest(".bs-todo-kotak");
    if (!kotak) return;
    const kode = kotak.dataset.tugas;
    const mau = kotak.checked;
    kotak.classList.add("saving");
    antreCentang = antreCentang.then(async () => {
      try {
        await setCentangSprint(kode, mau);
        /* Jejaknya dibaca ULANG dari server, tidak ditebak di sini. Yang
           tercatat siapa yang MENYELESAIKAN — dan kalau orang lain sudah
           mencentangnya lebih dulu, yang benar namanya, bukan nama kita. */
        await muatCentangSprint();
      } catch (e) {
        kotak.checked = !mau;
        notif(e instanceof ErrorApi ? e.message : "Centang gagal disimpan.", true);
      } finally {
        kotak.classList.remove("saving");
      }
    });
  }, { signal: sinyal });

  /* Dimuat SESUDAH layarnya tergambar, dan tanpa await: papan sprint muncul
     seketika dengan kotak kosong, lalu terisi. Membalik urutannya berarti
     seluruh buku menunggu satu permintaan jaringan yang boleh saja tidak
     pernah dijawab. */
  segarkanPapanSprint();
  muatCentangSprint();

  /* SOROT SATU LAJUR SEKSI.
   *
   *  Papannya tujuh belas lajur, dan yang membukanya hampir selalu mencari
   *  satu: seksinya sendiri. Menyorot dikerjakan JavaScript, bukan CSS,
   *  karena yang harus diredupkan tersebar di enam belas kolom lain — tidak
   *  ada selektor yang bisa menyebut "kolom yang bukan yang ini" tanpa nama
   *  seksinya ikut ditulis ke dalam stylesheet.
   *
   *  Menyorot lagi seksi yang sama mematikannya. Tanpa itu satu-satunya jalan
   *  kembali ke papan penuh adalah memuat ulang halaman. */
  let lajurTersorot = null;
  const sorotLajur = (nama) => {
    lajurTersorot = nama;
    for (const el of LAYAR.querySelectorAll("[data-lajur]")) {
      el.classList.toggle("bs-redup", !!nama && el.dataset.lajur !== nama);
    }
    for (const chip of LAYAR.querySelectorAll("[data-sorot]")) {
      chip.classList.toggle("bs-legenda-aktif", chip.dataset.sorot === nama);
    }
    if (!nama) return;

    /* DIBAWA KE DEPAN MATA, bukan cuma disorot.
       Di layar 1440px cuma empat lajur dari tujuh belas yang terlihat
       sekaligus, jadi menyorot lajur kedua belas tanpa menggesernya membuat
       legendanya terasa seperti tombol mati: yang berubah ada, tetapi di luar
       layar. Yang digeser wadahnya sendiri, mendatar saja — scrollIntoView()
       akan ikut menggeser halaman tegak dan melempar papannya dari layar. */
    const kepala = LAYAR.querySelector(`.bs-lajur-kepala[data-lajur="${CSS.escape(nama)}"]`);
    const bungkus = LAYAR.querySelector(".bs-papan-bungkus");
    if (!kepala || !bungkus) return;
    const sudut = LAYAR.querySelector(".bs-papan-sudut");
    // Lebar kolom sprint yang menempel di kiri dikurangkan, kalau tidak lajur
    // yang dituju berhenti tepat DI BAWAH kolom itu dan tetap tidak terlihat.
    const tertutup = sudut ? sudut.getBoundingClientRect().width : 0;
    const geser = kepala.offsetLeft - tertutup - 8;
    bungkus.scrollTo({ left: Math.max(0, geser), behavior: "smooth" });
  };

  LAYAR.addEventListener("click", (ev) => {
    const chip = ev.target.closest(".bs-legenda-chip");
    if (chip) {
      sorotLajur(chip.dataset.sorot === lajurTersorot ? null : chip.dataset.sorot);
      return;
    }
    const ke = ev.target.closest(".bs-ke");
    if (ke) { gulirKe(ke.dataset.ke); return; }
    const hasil = ev.target.closest(".bs-hasil-butir");
    if (!hasil) return;

    /* KOTAK CARI DIKOSONGKAN LEBIH DULU, dan itu bukan kerapian.

       Selama mencari, `#bs-panel-semua` disembunyikan — seluruh isi buku ada
       di dalamnya. `scrollIntoView()` pada elemen di dalam `display: none`
       tidak melakukan apa pun dan tidak melempar apa pun, jadi mengetuk hasil
       cari yang bagiannya ada di bab yang SEDANG terbuka terasa seperti
       tombol mati. Persis itu yang terjadi sebelum baris ini ada.

       saring() dipanggil, bukan `hidden` yang disetel tangan: yang memutuskan
       panel mana terlihat cuma satu fungsi, dan dua tempat yang memutuskan
       hal yang sama adalah dua tempat yang suatu hari tidak sepakat. */
    elCari.value = "";
    saring();

    /* Berpindah bab mengganti hash, dan penggambaran ulanglah yang menggulir
       — lewat bagianDitujuBuku. Kalau babnya SAMA, hash-nya tidak berubah,
       hashchange tidak pernah datang, dan tidak ada penggambaran ulang: di
       situ gulirnya harus dikerjakan langsung. */
    if (hasil.dataset.bab === bab.kode) { gulirKe(hasil.dataset.ke); return; }
    bagianDitujuBuku = hasil.dataset.ke;
    location.hash = `#/buku-sakti/${hasil.dataset.bab}`;
  }, { signal: sinyal });

  /* SATU PARAMETER, SATU ARTI: bab yang dicetak, atau null untuk seluruhnya.

     Sebelumnya dua — `(babSatu, ikutTimeline)` — dan `babSatu === null` sudah
     dipakai untuk arti "semua bab". Akibatnya papan sprint tidak punya cara
     diungkapkan sama sekali: "Cetak Bab Ini" di tab Sprint memanggil
     `(null, true)`, argumen yang SAMA PERSIS dengan tombol di sebelahnya,
     dan yang keluar seluruh buku. Tombolnya melakukan kebalikan dari
     namanya, tanpa satu pun galat. */
  document.getElementById("bs-cetak-bab").addEventListener("click", () => {
    siapkanCetakBuku(bab);
    window.print();
  }, { signal: sinyal });
  document.getElementById("bs-cetak-semua").addEventListener("click", () => {
    siapkanCetakBuku(null);
    window.print();
  }, { signal: sinyal });
}

/* ---------------------------------------------------------------------------
   CETAK BUKU SAKTI

   Buku ini digandakan di mesin fotokopi seperti seluruh kertas acara ini,
   jadi aturan CLAUDE.md bagian 8 berlaku penuh: tidak ada blok hitam, tidak
   ada teks terbalik, tidak ada abu dan raster, garis paling tipis 0,75pt,
   huruf paling kecil 7pt.

   SATU DOKUMEN MENGALIR PER BAB, bukan satu lembar per bagian. Empat puluh
   bagian berarti empat puluh lembar untuk isi yang muat di belasan, dan
   tumpukan setebal itu tidak dibaca siapa pun. Yang dijaga cuma satu bagian
   tidak terbelah dua halaman, lewat `break-inside: avoid`.

   Daftar isinya TANPA nomor halaman. Nomor halaman hanya bisa benar kalau
   dihitung dari hasil paginasi browser, dan itu berbeda antar peranti dan
   antar ukuran kertas — daftar isi yang menyebut halaman 12 sementara
   bagiannya di halaman 14 lebih buruk daripada daftar isi tanpa angka sama
   sekali.
   --------------------------------------------------------------------------- */

/** Blok isi jadi markup KERTAS. Bedanya dari blokBuku() cuma satu, dan itu
 *  yang membuat fungsi ini ada: blok "layar" kehilangan tautannya. Alamat
 *  `#/pembayaran` di atas kertas tidak bisa diketuk dan tidak memberi tahu
 *  apa pun kepada yang membacanya — yang berguna tinggal nama layarnya. */
export function blokBukuCetak(blok) {
  /* Foto TIDAK ikut ke kertas, dan itu bukan penghematan tinta.
     Buku ini digandakan di mesin fotokopi seperti blangko, dan foto adalah
     raster abu-abu — persis yang dilarang CLAUDE.md bagian 8: ia keluar kotor
     atau hilang sama sekali pada salinan kedua. Yang tercetak keterangannya,
     yang memang sudah ditulis supaya berdiri sendiri. */
  if (blok.jenis === "foto") return `<p>${esc(blok.teks)}</p>`;
  if (blok.jenis !== "layar") return blokBuku(blok);
  return `<p class="bs-cetak-layar"><strong>${esc(blok.nama)}</strong>${
    blok.teks ? ` — ${esc(blok.teks)}` : ""}</p>`;
}

export function siapkanCetakBuku(babSatu) {
  document.getElementById("cetakan")?.remove();
  const dicetak = tanggalJam(new Date().toISOString());
  const judulEdisi = EDISI ? EDISI.name : "HRCD";

  /* SATU DAFTAR BAB, dan papan sprint ikut di dalamnya sebagai bab biasa.
     `babSatu` null berarti seluruh buku; selain itu tepat satu bab — termasuk
     kalau yang dipilih papan sprint. Tidak ada sentinel yang memikul dua arti
     di sini (lihat komentar di tombolnya). */
  const babCetak = babSatu ? [babSatu] : BUKU_SAKTI;
  const babBacaan = babCetak.filter(b => b.bagian.length);
  const adaSprint = babCetak.some(b => b.kode === "timeline") && SPRINT.length > 0;

  const daftarIsi = `
    <h2>Daftar Isi</h2>
    ${babBacaan.map(b => `
      <p class="bs-cetak-isi-bab">Bab ${esc(String(nomorBabBuku(b)))} — ${
        esc(b.judul)}</p>
      <ul class="bs-cetak-isi">${b.bagian.map(g =>
        `<li>${esc(g.judul)}</li>`).join("")}</ul>`).join("")}
    ${adaSprint ? `
      <p class="bs-cetak-isi-bab">Papan Sprint Satu Edisi</p>
      <ul class="bs-cetak-isi">${SPRINT.map(sp =>
        `<li>Sprint ${esc(String(sp.nomor))} · ${esc(sp.bulan)} ${
          esc(sp.rentang)} — ${esc(sp.tajuk)}</li>`).join("")}</ul>` : ""}`;

  const halamanBab = babBacaan.map(b => `
    <section class="print-page">
      <h1>Bab ${esc(String(nomorBabBuku(b)))} — ${esc(b.judul)}</h1>
      <p class="bs-cetak-ringkas">${esc(b.ringkas)}</p>
      ${b.bagian.map(g => `
        <section class="bs-cetak-bagian">
          <h2>${esc(g.judul)}</h2>
          ${g.isi.map(blokBukuCetak).join("")}
        </section>`).join("")}
    </section>`).join("");

  /* KOTAK CENTANG DICETAK KOSONG, SELALU — tidak peduli apa yang tercentang
     di layar.

     Kertas ini ditempel di dinding sekretariat dan dicentang pakai pulpen
     sepanjang enam bulan. Mencetak keadaan hari ini membuatnya jadi POTRET,
     dan potret yang ditempel di dinding berhenti benar keesokan harinya
     sementara kotak-kotak yang sudah tercetak hitam tidak bisa dibatalkan
     lagi oleh siapa pun.

     Kotaknya juga tetap PUTIH dan kosong — CLAUDE.md 8.7 melarang apa pun di
     belakang area yang ditulisi tangan. */
  const halamanSprint = !adaSprint ? "" : `
    <section class="print-page">
      <h1>Papan Sprint Satu Edisi</h1>
      <p class="bs-cetak-ringkas">Tiga belas sprint dua mingguan. Tanggalnya
        dihitung mundur dari hari-H, jadi papan ini tetap berlaku pada edisi
        yang bulannya bergeser. Kotaknya sengaja tercetak kosong: yang di
        layar berubah tiap hari, yang di dinding dicentang pakai pulpen.</p>
      <table class="print-table">
        <thead><tr><th>Sprint</th><th>Waktu</th><th>Tajuk</th><th>Tugas</th></tr></thead>
        <tbody>${SPRINT.map(sp => `<tr>
          <td class="text-center">${esc(String(sp.nomor))}</td>
          <td>${esc(sp.bulan)} ${esc(sp.rentang)}<br>${esc(sp.mundur)}</td>
          <td>${esc(sp.tajuk)}</td>
          <td class="text-center">${esc(String(sp.tugas.length))}</td></tr>`).join("")}</tbody>
      </table>
      ${SPRINT.map(sp => `
        <section class="bs-cetak-bagian">
          <h2>Sprint ${esc(String(sp.nomor))} — ${esc(sp.tajuk)}</h2>
          <p class="bs-cetak-waktu">${esc(sp.bulan)} ${esc(sp.rentang)} · ${
            esc(sp.mundur)}</p>
          <p>${esc(sp.fokus)}</p>
          <ul class="bs-cetak-todo">${sp.tugas.map(t => `
            <li><span class="bs-cetak-kotak"></span>
              <span class="bs-cetak-todo-teks">${esc(t.teks)}
                <em>${esc(t.seksi)}</em></span></li>`).join("")}</ul>
          <p class="bs-cetak-label">Selesai kalau</p>
          <p>${esc(sp.hasil)}</p>
          <p class="bs-kenapa">${esc(sp.jangan)}</p>
        </section>`).join("")}
    </section>`;

  document.body.appendChild(h(`<div id="cetakan" class="printout buku-cetak">
    <section class="print-page">
      <h1>BUKU SAKTI — ${esc(judulEdisi)}</h1>
      <p class="bs-cetak-ringkas">Buku pegangan panitia. Ditulis ulang tiap
        serah terima jabatan oleh panitia yang turun, untuk panitia yang naik.</p>
      ${daftarIsi}
      <p class="print-note">Dicetak ${esc(dicetak)}.</p>
    </section>
    ${halamanBab}
    ${halamanSprint}
  </div>`));
}
