/* ============================================================================
   hrcd-rekap : app.js — aplikasi panitia (tahap 2).
   Aturan bentuk (rancangan-b.md 10.1): kerangka sama di semua layar,
   satu aksi utama per layar, kunci di-autofocus, echo-confirm sebelum simpan,
   "baris terakhir" di kaki, gagal itu nyaring dan lokal.

   Semua teks dari luar (nama sekolah/regu/ketua, pesan server) WAJIB lewat
   esc() atau tag html`` — lihat util.js.
   ========================================================================== */

import {
  sesi, masuk, keluar, gantiPasswordSendiri, ErrorApi,
  infoEdisi, ringkasanMeja, daftarPendaftaran,
  verifikasiPembayaran, batalkanVerifikasi, daftarUlang, tukarNomor,
  daftarKloter, tandaiKloterDicetak, pindahKloter, daftarSisipan,
  cariRegu, catatFinish, infoPenalti,
  papanKeberangkatan, reguKloter, kontrakOpsi,
  konfirmasiKontrak, ceklisBerangkat, batalCeklisBerangkat, berangkatkanKloter,
  koreksiJamBerangkat,
  daftarPos, komponenPos, lembarPos, lembarPosSatu, simpanNilaiPos, hapusNilaiPos,
  batasNomorDada,
  komponenSemua, rekapPenuh, kelengkapanPos, riwayatNilai,
  kunciNilaiPos, bukaKunciNilaiPos,
  unggahFotoLembar, daftarFotoLembar, tautanFoto, klasemenLiveScore,
  statusAcara, bolehLihat, lengkapiHakSesi,
  aturFaseLive,
  daftarAkun, ubahPeranAkun, setAktifAkun, buatAkun, resetPasswordAkun,
  ubahUsernameAkun, daftarFitur, daftarHak, setHak,
} from "./api.js";
import { esc, h, html, rupiah, jamMenit, tanggalPanjang, tanggalJam, notif,
         dialog, kartuGagalMuat, jamSah, pasangKotakJam,
         berapaLalu, pemuat, ikonRefresh, detikSah, detikTeks,
         kotakJamHtml, kecilkanFoto, ukuranRapi, ikon, ikonKotak, dada3,
         jamPadaHari } from "./util.js";

const LAYAR = document.getElementById("layar");
const GOLONGAN_LABEL = {
  penegak_pa: "Penegak PA", penegak_pi: "Penegak PI",
  penggalang_pa: "Penggalang PA", penggalang_pi: "Penggalang PI",
};

/** URUTAN BAKU golongan, di mana pun keempatnya dijejer.
 *
 *  Penegak lebih dulu, lalu Penggalang; PA sebelum PI. Ini urutan yang dipakai
 *  panitia saat mengumumkan juara, dan layar yang berbeda urutan dari corong
 *  memaksa pembaca acara mencocokkan sendiri di depan lapangan.
 *
 *  Ditulis eksplisit, bukan disandarkan pada urutan kunci GOLONGAN_LABEL:
 *  urutan kunci objek memang terjaga di JavaScript, tapi ia tidak terlihat
 *  sebagai keputusan — orang berikutnya yang merapikan daftar label itu secara
 *  alfabetis akan mengubah urutan tampil tanpa pernah tahu ia melakukannya.
 *
 *  Kembarannya ada di live/live.js sebagai URUT_GOLONGAN dengan isi yang sama
 *  persis. Halaman peserta berdiri sendiri (Worker terpisah, tanpa berkas
 *  bersama), jadi salinannya disengaja — dan keduanya harus tetap sama, karena
 *  layar Live Score memang menjanjikan tampilan yang identik. */
const URUT_GOLONGAN = ["penegak_pa", "penegak_pi", "penggalang_pa", "penggalang_pi"];

/** Golongan versi pendek, HANYA untuk kertas. Di layar tetap panjang — di sana
 *  lebar tidak diperebutkan siapa pun, dan dua nama untuk satu hal cuma
 *  sepadan kalau ada yang dibeli dengannya.
 *
 *  Di lembar cadangan ia diperebutkan, dan yang kalah selama ini nama regu dan
 *  sekolah: keduanya dipotong elipsis supaya tinggi baris tetap seragam.
 *  "Penggalang PA" 13 huruf jadi "Pgl Pa" 6 huruf — sekitar 10mm kembali ke
 *  kolom nama, di kertas yang memang sedang kekurangan.
 *
 *  Singkatannya dipilih panitia: Pgl dan Pgk. Versi pertama saya "Png" untuk
 *  Penegak, dan itu lebih buruk — Png dan Pgl berbeda di dua huruf TENGAH yang
 *  sama-sama tidak menonjol, sementara Pgk dan Pgl berbeda di huruf TERAKHIR,
 *  tempat mata berhenti.
 *
 *  Sekalipun tertukar, akibatnya terbatas: kolom ini keterangan, bukan kunci.
 *  Nilai mengalir lewat nomor dada, jadi golongan yang salah baca tidak pernah
 *  memindahkan angka ke regu lain. */
const GOLONGAN_SINGKAT = {
  penegak_pa: "Pgk Pa", penegak_pi: "Pgk Pi",
  penggalang_pa: "Pgl Pa", penggalang_pi: "Pgl Pi",
};
let EDISI = null;

/* Layar yang sanggup memperbarui dirinya SENDIRI tanpa digambar ulang
   mendaftar di sini; kembali dari tab lain memanggil INI, bukan menggambar
   ulang layarnya. Kosong berarti "gambar ulang saja" — itu yang berlaku
   untuk hampir semua layar, dan memang benar untuk mereka.

   Dideklarasikan di atas, bersama keadaan modul yang lain, meski yang
   memakainya jauh di bawah: yang membacanya nanti harus bisa menemukan
   seluruh keadaan yang hidup selama satu sesi di satu tempat. */
let segarkanDiTempat = null;

const terakhir = { pembayaran: [], "daftar-ulang": [], finish: [] };

/* ---------------- kerangka ---------------- */

/** Lebar layar, tiga tingkat:
 *    false      layar satu-aksi — sempit, supaya tombol utamanya gampang
 *               ditemukan di layar kecil.
 *    true       tabel meja (pembayaran, daftar ulang) — butuh ruang, tapi
 *               tetap dipatok supaya barisnya tidak terbaca seperti pita.
 *    "lembar"   lembar Input Pos — layar TERLEBAR di sistem ini. Kolomnya
 *               ditentukan konfigurasi dan bisa bertambah tahun depan, jadi
 *               patokan 1080px yang pas untuk tabel meja justru memaksanya
 *               menggeser ke samping padahal layarnya masih lapang. */
/** Nama acara untuk judul tab: "HRCD XXXVII" — diambil apa adanya dari nama
 *  edisi di database, bukan ditulis di sini. Tahun depan cukup mengubah satu
 *  baris di tabel edisi.
 *
 *  Bentuk pendek, bukan "Hiking Rally Ciradyka XXXVII": judul tab dipotong
 *  browser di sekitar 25 huruf, dan panitia membuka layar ini bersama belasan
 *  tab lain di HP. Yang harus terbaca di potongan itu adalah "Sistem
 *  Panitia", bukan nama acara yang sudah mereka tahu. Sebelum edisi termuat
 *  (layar masuk), sisakan "HRCD" saja. */
const namaAcara = () => (EDISI && EDISI.name) ? String(EDISI.name) : "HRCD";

function pasangKepala(judul, lebar = false) {
  const s = sesi();
  document.getElementById("kepala").hidden = !s;
  // Menu bawah HP ikut aturan yang sama dengan header: hanya untuk yang
  // sudah login. Penanda halaman aktif dipasang di sini juga supaya ikon
  // Home menyala saat memang sedang di Home.
  const nav = document.getElementById("bottom-nav");
  if (nav) {
    nav.hidden = !s;
    const diHome = location.hash === "#/home" || location.hash === "";
    document.getElementById("nav-home")
      .setAttribute("aria-current", diHome ? "page" : "false");
    document.getElementById("nav-setting")
      .setAttribute("aria-current", location.hash === "#/ganti-password" ? "page" : "false");
    document.getElementById("nav-akun")
      .setAttribute("aria-current", location.hash === "#/akun" ? "page" : "false");
  }
  // Akun hanya untuk admin. Disembunyikan, BUKAN dinonaktifkan: tombol mati di
  // pojok header tidak memberi tahu apa pun selain bahwa ada sesuatu yang
  // tidak boleh disentuh.
  // Ikut CENTANG, bukan peran: admin yang centang Akun-nya dicabut tidak
  // boleh tetap melihat tombolnya (0057).
  const adminSaja = !!s && bolehLihat("akun");
  document.getElementById("btn-akun").hidden = !adminSaja;
  document.getElementById("nav-akun").hidden = !adminSaja;
  document.getElementById("judul-layar").textContent = judul;
  document.title = `${judul} — ${namaAcara()}`;
  LAYAR.classList.toggle("wide", lebar === true);
  LAYAR.classList.toggle("lembar", lebar === "lembar");
  if (s) document.getElementById("siapa").textContent =
    `${s.username} · ${EDISI ? EDISI.name : ""}`;
}

const kartuGalat = (pesan) => html`
  <div class="card" style="border-color:var(--bahaya);background:var(--bahaya-muda)">
    <strong>${pesan}</strong></div>`;

function barisTerakhirHtml(fungsi) {
  const daftar = terakhir[fungsi] || [];
  if (!daftar.length) return "";
  return `<div class="card">
    <h2 style="font-size:1rem;color:var(--tinta-lembut)">Baru saja di meja ini</h2>
    <table class="table">${daftar.slice(0, 8).map(b => html`
      <tr><td>${b.jam}</td><td><strong>${b.apa}</strong></td><td>${b.detail}</td></tr>`).join("")}
    </table></div>`;
}
function catatTerakhir(fungsi, apa, detail) {
  terakhir[fungsi].unshift({ jam: jamMenit(new Date()), apa, detail });
}

/* ============================ LOGIN ===================================== */

function layarLogin(pesan) {
  pasangKepala("Sistem Panitia");
  LAYAR.replaceChildren(h(`
    <div class="card" style="max-width:480px;margin:2rem auto">
      <h2>Masuk Panitia</h2>
      ${pesan ? `<div class="error" style="margin-top:.5rem">${esc(pesan)}</div>` : ""}
      <div class="field" style="margin-top:1rem">
        <label for="u">Username</label>
        <input type="text" id="u" autocomplete="username" autocapitalize="none"
               spellcheck="false">
      </div>
      <div class="field">
        <label for="p">Password</label>
        <input type="password" id="p" autocomplete="current-password">
      </div>
      <button class="button button-primary" id="masuk" type="button">Masuk</button>
    </div>
  `));
  const u = document.getElementById("u");
  u.focus();
  const aksi = async () => {
    const btn = document.getElementById("masuk");
    btn.disabled = true; btn.textContent = "Memeriksa…";
    try {
      await masuk(u.value.trim(), document.getElementById("p").value);
      EDISI = null;
      location.hash = "#/home";
      arahkan();
    } catch (e) {
      layarLogin(e instanceof ErrorApi ? e.message : "Username atau password salah.");
    }
  };
  document.getElementById("masuk").addEventListener("click", aksi);
  LAYAR.querySelectorAll("input").forEach(i =>
    i.addEventListener("keydown", e => { if (e.key === "Enter") aksi(); }));

  // Nomor edisi diambil SEBELUM login, supaya judul tab sudah berbunyi
  // "Sistem Panitia — HRCD XXXVII" di layar masuk, bukan "Sistem Panitia —
  // HRCD" yang menggantung. Boleh: v_edisi_publik memang di-grant ke anon
  // (migrasi 0005) — halaman pendaftaran publik membacanya dengan cara yang
  // sama persis. Gagalnya diabaikan; judul yang kurang satu kata bukan
  // alasan menahan kotak login.
  if (!EDISI) {
    infoEdisi()
      .then(e => { EDISI = e; if (!sesi()) pasangKepala("Sistem Panitia"); })
      .catch(() => {});
  }
}

/* ============================ BERANDA MEJA (home) ========================= */

async function layarHome() {
  // Lebar penuh: pada 760px hanya muat dua kolom, dan menu sepuluh tombol
  // jadi kolom sempit dengan lapangan kosong di kanannya. 1080px muat tiga,
  // sehingga seluruh menu terlihat sekaligus tanpa menggulir. Di HP grid-nya
  // tetap runtuh jadi satu kolom — minmax(280px, 1fr) yang memutuskan, bukan
  // lebar wadahnya.
  pasangKepala("Home", true);
  const peran = sesi().peran;
  LAYAR.replaceChildren(h(pemuat()));

  // Operator pos tidak berhak atas layar meja — RLS akan mengosongkan
  // datanya dan itu tampak seperti "tidak ada antrean" (temuan review).
  // Tapi ia punya satu layar sendiri, dan Home-nya harus menunjukkan layar
  // itu: sebelumnya halaman ini buntu, dan akun pos tidak punya jalan ke
  // mana pun kecuali mengetik alamatnya sendiri.
  // Yang hanya memegang pos tidak punya layar meja sama sekali; papan penuh
  // untuknya adalah papan berisi ubin yang semuanya menjawab kosong.
  if (bolehLihat("pos") && !bolehLihat("pembayaran") && !bolehLihat("keberangkatan")) {
    // Template BIASA, bukan html`` — dan itu bukan kelalaian yang dirapikan
    // belakangan. html`` meng-escape SETIAP sisipan, sedangkan ikonKotak()
    // mengembalikan markup; disisipkan ke sana ia tampil sebagai kode SVG
    // mentah sepanjang empat baris, bukan sebagai ikon. Menu di bawah ini
    // memakai template biasa untuk alasan yang sama.
    //
    // Cacat ini hanya terlihat oleh akun juri pos, dan tidak ada yang login
    // sebagai juri pos sampai hari simulasi.
    //
    // Yang tetap wajib di-escape: nilai dari database. Di sini cuma `pos`.
    LAYAR.replaceChildren(h(`
      <div class="function-menu">
        <a href="#/pos">
          <div class="function-name">${ikonKotak("square-pen", "nila")} Input Nilai Pos ${esc(sesi().pos)}</div>
        </a>
        ${bolehLihat("live_score") ? `
        <a href="#/live-score">
          <div class="function-name">${ikonKotak("medal", "emas")} Live Score</div>
        </a>` : ""}
      </div>
`));
    return;
  }

  let r = null, galat = null;
  try { r = await ringkasanMeja(); } catch (e) { galat = e.message; }
  const lencana = (n) => n === null
    ? `<span class="badge badge-gray" title="jumlah antrean tidak terbaca">?</span>`
    : `<span class="badge ${n > 0 ? "badge-yellow" : "badge-green"}">${n}</span>`;

  /* KEMAJUAN, bukan antrean — dan karena itu lencananya BERBEDA.
   *
   *  lencana() di atas berarti "masih ada N yang menunggu dikerjakan": kuning
   *  saat ada, hijau saat habis. Kemajuan berlawanan arah — 0/53 adalah pagi
   *  yang belum mulai, 53/53 adalah pekerjaan selesai. Memakai lencana yang
   *  sama akan mewarnai hijau tepat pada keadaan yang paling belum selesai.
   *
   *  Jadi netral sepanjang jalan, dan hijau HANYA saat penuh. */
  const kemajuan = (sudah, dari, judulMustahil) => {
    // `== null`, BUKAN `=== null`: kalau ringkasannya tidak memuat field ini
    // sama sekali nilainya undefined, dan `=== null` melewatkannya — papan
    // Home lalu menggambar "undefined/undefined" di ubin Keberangkatan.
    if (sudah == null || dari == null) return "";
    /* Pembilang MELEBIHI penyebut berarti data rusak, bukan kemajuan.
       Regu tidak bisa datang tanpa berangkat, jadi 44/10 hanya mungkin kalau
       ada baris closing tanpa baris keberangkatan yang cocok — dan itu
       menghilangkan regu-regu itu dari klasemen, karena v_klasemen menuntut
       keduanya. Dimerahkan, bukan dibulatkan: angka yang dirapikan menyembunyikan
       persoalan yang justru paling perlu dilihat. */
    const mustahil = sudah > dari;
    const penuh = !mustahil && dari > 0 && sudah >= dari;
    const kelas = mustahil ? "badge-red" : penuh ? "badge-green" : "badge-kemajuan";
    return `<span class="badge ${kelas}"${mustahil && judulMustahil
      ? ` title="${esc(judulMustahil)}"` : ""}
      >${esc(String(sudah))}/${esc(String(dari))}</span>`;
  };

  LAYAR.replaceChildren(h(`
    ${galat ? kartuGalat(`Jumlah antrean tidak bisa dibaca: ${galat}`) : ""}
    <div class="function-menu">
      <!-- Form pendaftaran tidak lagi tinggal di situs ini: ia pindah ke
           situs PESERTA bersama rekap live, supaya alamat yang beredar ke
           ratusan orang bukan alamat yang ada kotak loginnya. Karena beda
           asal, tautannya mutlak dan diambil dari config.js. -->
      ${bolehLihat("pendaftaran") ? `
      <a href="${esc((window.HRCD && window.HRCD.pesertaUrl) || "")}/daftar.html"
         target="_blank" rel="noopener">
        <div class="function-name">${ikonKotak("clipboard-list", "biru")} Pendaftaran</div>
      </a>` : ""}
      ${bolehLihat("pembayaran") ? `
      <a href="#/pembayaran">
        <div class="function-name">${ikonKotak("credit-card", "hijau")} Pembayaran ${lencana(r ? r.menunggu_pembayaran : null)}</div>
      </a>` : ""}
      ${bolehLihat("daftar_ulang") ? `
      <a href="#/daftar-ulang">
        <div class="function-name">${ikonKotak("id-card", "ungu")} Daftar Ulang ${lencana(r ? r.lunas_belum_nomor : null)}</div>
      </a>` : ""}
      ${bolehLihat("cetak_kloter") ? `
      <a href="#/cetak-kloter">
        <div class="function-name">${ikonKotak("list-ordered", "toska")} Daftar Kloter</div>
      </a>` : ""}
      ${bolehLihat("keberangkatan") ? `
      <a href="#/keberangkatan">
        <div class="function-name">${ikonKotak("flag", "jingga")} Keberangkatan ${
          kemajuan(r ? r.regu_berangkat : null, r ? r.regu_siap : null)}</div>
      </a>` : ""}
      ${bolehLihat("kedatangan") ? `
      <a href="#/finish">
        <div class="function-name">${ikonKotak("circle-check", "zamrud")} Kedatangan ${
          kemajuan(r ? r.regu_datang : null, r ? r.regu_berangkat : null,
            "Ada regu tercatat datang tapi tidak tercatat berangkat. "
            + "Regu itu TIDAK masuk klasemen — periksa layar Keberangkatan.")}</div>
      </a>` : ""}
      ${bolehLihat("pos") ? `
      <a href="#/pos">
        <div class="function-name">${ikonKotak("square-pen", "nila")} Input Nilai Pos</div>
      </a>` : ""}
      ${bolehLihat("live_score") ? `
      <a href="#/live-score">
        <div class="function-name">${ikonKotak("medal", "emas")} Live Score</div>
      </a>` : ""}

      ${bolehLihat("rekap") ? `
      <a href="#/rekap">
        <div class="function-name">${ikonKotak("chart-column", "mawar")} Rekapitulasi</div>
      </a>` : ""}
    </div>
  `));
}

/* ============================ GANTI PASSWORD ============================= */

// Kode konfirmasi TETAP, sengaja tidak ditulis di label atau pesan galat —
// panitia tahu kodenya dari koordinator, bukan dari layar ini. Tapi ini
// TETAP BUKAN pemeriksaan identitas sungguhan: nilainya sama untuk semua
// orang, dan ada apa adanya di berkas JS ini — siapa pun yang membuka
// devtools browser bisa membacanya. Identitas yang sungguhan diperiksa
// sudah dibuktikan lewat sesi login yang sedang aktif; kode ini cuma jeda
// sadar sebelum ganti password benar-benar terjadi, karena HP panitia
// sering berpindah tangan sebentar di lapangan.
const KODE_KONFIRMASI_PASSWORD = "ABCD";

function layarGantiPassword() {
  pasangKepala("Ganti Password");
  LAYAR.replaceChildren(h(`
    <div class="card" style="max-width:480px;margin:0 auto">
      <h2>Ganti Password Akun Sendiri</h2>
      <div class="field">
        <label for="gp-baru">Password baru</label>
        <input type="password" id="gp-baru" autocomplete="new-password">
      </div>
      <div class="field">
        <label for="gp-kode">Kode Konfirmasi</label>
        <input type="password" id="gp-kode" autocomplete="off">
      </div>
      <div class="error" id="gp-galat" hidden></div>
      <button class="button button-primary" id="gp-simpan" type="button">Simpan Password Baru</button>
    </div>
  `));

  const baru = document.getElementById("gp-baru");
  const kode = document.getElementById("gp-kode");
  const galat = document.getElementById("gp-galat");
  const btn = document.getElementById("gp-simpan");

  btn.addEventListener("click", async () => {
    galat.hidden = true;
    if (!baru.value || baru.value.length < 6) {
      galat.textContent = "Password baru minimal 6 karakter.";
      galat.hidden = false; baru.focus(); return;
    }
    if (kode.value.trim() !== KODE_KONFIRMASI_PASSWORD) {
      galat.textContent = "Kode konfirmasi salah. Tanyakan koordinator kalau lupa.";
      galat.hidden = false; kode.focus(); return;
    }
    if (btn.dataset.jalan === "1") return;
    btn.dataset.jalan = "1"; btn.disabled = true; btn.textContent = "Menyimpan…";
    try {
      await gantiPasswordSendiri(baru.value);
      notif("Password berhasil diganti.");
      baru.value = ""; kode.value = "";
    } catch (err) {
      galat.textContent = err.message; galat.hidden = false;
    } finally {
      btn.dataset.jalan = ""; btn.disabled = false; btn.textContent = "Simpan Password Baru";
    }
  });
  baru.focus();
}

/* ============================ ALAT TABEL ================================= */

/** Kotak cari + tombol saring, dipakai layar Pembayaran & Daftar Ulang.
 *  Menyaring di browser (data sudah dimuat semua) supaya hasilnya berubah
 *  seketika sambil mengetik — di meja, menunggu server tiap huruf terasa
 *  seperti aplikasi macet. */
function alatTabel({ saringan, saringAktif, jumlah, cariContoh, kiri = "", kanan = "" }) {
  return `
    <div class="table-toolbar">
      ${kiri}
      <div class="field kotak-cari">
        <label for="cari-tabel" class="visually-hidden">Cari</label>
        <input type="text" id="cari-tabel" autocomplete="off"
               placeholder="${esc(cariContoh || "Cari kode, sekolah, atau nama regu…")}">
      </div>
      <div class="filter-baris">
        <div class="filter-row">
          ${saringan.map(s => `
            <button type="button" class="option option-small" data-saring="${esc(s.kode)}"
                    aria-pressed="${s.kode === saringAktif}">${esc(s.label)}</button>`).join("")}
        </div>
        <span class="table-count" id="tabel-jumlah">${jumlah} baris</span>
      </div>
      ${kanan}
    </div>`;
}

/** Pasang perilaku cari + saring. gambar(cari, saring) menggambar ulang
 *  isi tabel saja — kerangka layar tidak ikut dibangun ulang supaya fokus
 *  kotak cari tidak lompat saat mengetik (temuan uji). */
function pasangAlatTabel(gambar) {
  const inp = document.getElementById("cari-tabel");
  let saring = LAYAR.querySelector("[data-saring][aria-pressed='true']")?.dataset.saring || "";
  let cari = "";
  let jeda = null;

  const jalan = () => gambar(cari, saring);

  inp.addEventListener("input", () => {
    clearTimeout(jeda);
    // Jeda pendek: mengetik cepat tidak menggambar ulang tiap huruf.
    jeda = setTimeout(() => { cari = inp.value.trim().toLowerCase(); jalan(); }, 120);
  });
  LAYAR.querySelectorAll("[data-saring]").forEach(b =>
    b.addEventListener("click", () => {
      saring = b.dataset.saring;
      LAYAR.querySelectorAll("[data-saring]").forEach(x =>
        x.setAttribute("aria-pressed", String(x === b)));
      jalan();
    }));
  inp.focus();
  jalan();
}

/** Filter bersama: kode pembayaran, nama sekolah, atau nama salah satu regu
 *  mengandung teks cari. Nama regu ikut dicari karena meja pembayaran
 *  menampilkan barisnya per regu — yang disebut sekolah kadang nama regunya,
 *  bukan kodenya. */
const cocokCari = (b, cari) => !cari
  || b.kode_pembayaran.toLowerCase().includes(cari)
  || (b.sekolah?.name || "").toLowerCase().includes(cari)
  || (b.regu || []).some(r => (r.nama_regu || "").toLowerCase().includes(cari));

const reguAktif = (b) => (b.regu || []).filter(r => !r.is_cancelled);

/* ============================ MEJA PEMBAYARAN ============================ */

async function layarPembayaran() {
  if (!EDISI) { layarButuhEdisi("Meja Pembayaran"); return; }
  pasangKepala("Meja Pembayaran", true);
  LAYAR.replaceChildren(h(pemuat()));

  const layarIni = location.hash;
  let semua;
  try { semua = await daftarPendaftaran(); }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarPembayaran)); return; }
  // Panitia menekan Pembayaran lalu cepat pindah ke layar lain: jawaban yang
  // datang belakangan TIDAK boleh menimpa layar yang sedang dibuka sekarang.
  if (location.hash !== layarIni) return;

  // Invoice yang barisan detail regunya sedang dibuka. Ikut disimpan supaya
  // detail tidak menutup sendiri setiap kali tabel digambar ulang.
  const dibuka = new Set();

  LAYAR.replaceChildren(h(`
    <div class="card">
      ${alatTabel({
        saringan: [
          { kode: "belum", label: "Belum bayar" },
          { kode: "lunas", label: "Lunas" },
          { kode: "semua", label: "Semua" },
        ],
        saringAktif: "belum",
        jumlah: semua.length,
      })}
      <div class="table-wrapper">
        <table class="table data-table table-bayar">
          <thead>
            <tr>
              <th>Kode Bayar</th><th>Sekolah</th><th class="text-center">Regu</th>
              <th class="text-right">Tagihan</th><th class="text-center">Metode</th><th></th>
            </tr>
          </thead>
          <tbody id="isi-tabel"></tbody>
        </table>
      </div>
    </div>
    ${barisTerakhirHtml("pembayaran")}
  `));

  // Kotak cari dan saringan dipegang pasangAlatTabel — jalan ulang menyimpan
  // saringan yang sedang aktif tanpa memasang ulang listener-nya tiap kali.
  let cariKini = "", saringKini = "belum";
  const gambarUlang = () => gambar(cariKini, saringKini);

  const gambar = (cari, saring) => {
    cariKini = cari; saringKini = saring;
    const baris = semua.filter(b =>
      cocokCari(b, cari) &&
      (saring === "semua" || (saring === "lunas" ? b.status === "lunas"
                                                 : b.status === "menunggu_pembayaran")));
    // Dua angka sekaligus: yang dibayar adalah invoice, yang dihitung panitia
    // saat mencocokkan uang adalah regu.
    const jumlahRegu = baris.reduce((n, b) => n + reguAktif(b).length, 0);
    document.getElementById("tabel-jumlah").textContent =
      `${baris.length} invoice · ${jumlahRegu} regu`;
    const tbody = document.getElementById("isi-tabel");

    if (!baris.length) {
      tbody.replaceChildren(h(`<tr><td colspan="6" class="table-empty">
        Tidak ada yang cocok.</td></tr>`));
      return;
    }

    tbody.replaceChildren(h(baris.map(b => {
      const aktif = reguAktif(b);
      const tagihan = aktif.length * EDISI.biaya_per_regu;
      // Cara bayar default TUNAI — mayoritas sekolah membayar langsung di
      // meja, jadi jalur tersibuk cukup satu ketukan. Yang transfer memilih
      // "Transfer" dulu. Salah tandai dibereskan lewat "Batalkan", bukan
      // dicegah dengan ketukan tambahan untuk semua orang.
      // Cara bayar berdiri di kolomnya SENDIRI. Untuk yang belum bayar ia
      // dropdown; untuk yang sudah, ia catatan cara pembayarannya benar-
      // benar diterima — pertanyaan yang sering ditanya saat menyusun
      // laporan keuangan, dan dulu tidak terlihat di mana pun.
      // Kolom Metode memuat cara bayar SEKALIGUS statusnya: dua fakta
      // tentang uang yang sama, dibaca bersama. Kolom aksi tinggal berisi
      // tombol saja, jadi tombolnya muat berderet ke samping.
      const metode = b.status === "lunas"
        // Nomor kwitansi TIDAK ditampilkan di tabel: panjang, tidak pernah
        // dicari lewat layar ini, dan sudah tercetak di kwitansinya sendiri
        // — di situlah ia berguna saat menyusun berkas.
        // Cara bayar dan LUNAS SEBARIS, dibungkus satu pembungkus lentur.
        // Sebelumnya cara bayarnya di dalam <div> — elemen blok — jadi LUNAS
        // selalu jatuh ke baris berikutnya, bahkan di kartu HP yang kolomnya
        // lapang. Dengan flex-wrap ia tetap menumpuk sendiri di kolom tabel
        // lebar yang cuma 15%, jadi satu aturan melayani kedua tampilan.
        ? html`<span class="metode-lunas"
               ><span>${b.pembayaran ? b.pembayaran.method : "—"}</span
               ><span class="badge badge-green">LUNAS</span></span>`
        : b.status === "batal"
          ? `<span class="badge badge-red">BATAL</span>`
          : `<select class="select-small" data-metode="${esc(b.kode_pembayaran)}">
               <option value="tunai" selected>Tunai</option>
               <option value="transfer">Transfer</option>
             </select>`;

      const aksi = b.status === "lunas"
        // <span class="teks-lebar"> = kata yang DIBUANG di layar sempit, jadi
        // tombolnya menyusut sendiri: "Cetak Kwitansi" -> "Kwitansi",
        // "Tandai Lunas" -> "Lunas". Tanpa ini, di jendela sempit tombolnya
        // melebar sampai menutupi dropdown cara bayar di sebelahnya.
        // Label dibungkus SATU <span> luar supaya .button — yang inline-flex
        // dengan gap .5rem — melihatnya sebagai satu item saja. Tanpa
        // pembungkus itu, "Tandai" dan "Lunas" jadi dua item terpisah dan
        // gap-nya menambah jarak sendiri: terbaca "Tandai  Lunas".
        ? `<div class="action-row action-row-rapat">
                 <button class="button button-primary button-mini" type="button"
                         data-cetak="${esc(b.kode_pembayaran)}"><span><span
                         class="teks-lebar">Cetak </span>Kwitansi</span></button>
                 <button class="button button-secondary button-mini" type="button"
                         data-batal-bayar="${esc(b.kode_pembayaran)}">Batalkan</button>
               </div>`
        : b.status === "batal"
          ? ""
          : `<button class="button button-primary button-small" type="button"
                     data-lunas="${esc(b.kode_pembayaran)}"><span><span
                     class="teks-lebar">Tandai </span>Lunas</span></button>`;
      // Satu baris = satu invoice, karena satu invoice memang dibayar
      // sekaligus. Rincian regunya (nama, kategori, asal sekolah) ada di
      // baris detail yang dibuka lewat tombol "N regu" — itu yang dibacakan
      // saat sekolah menyerahkan uang, dan itu juga yang dicetak di kwitansi.
      const kode = esc(b.kode_pembayaran);
      const sekolah = esc(b.sekolah?.name || "—");
      const terbuka = dibuka.has(b.kode_pembayaran);

      // Template biasa, BUKAN tag html`` — aksi sudah berupa HTML jadi tidak
      // boleh ikut di-escape. Data dari luar tetap lewat esc() satu per satu.
      return `
        <tr class="invoice-row" data-baris="${kode}">
          <td class="mono" data-label="Kode Bayar">${kode}</td>
          <td data-label="Sekolah">
            <strong>${sekolah}</strong>
            ${aktif.length ? "" : `<div class="sub">semua regu batal</div>`}
          </td>
          <!-- Pembuka rincian duduk DI KOLOM REGU, bukan di bawah nama
               sekolah. Angkanya sama persis dengan yang dulu tercetak di
               kolom ini, jadi menaruhnya di sini menghapus satu pengulangan
               sekaligus mengembalikan lebar ke kolom Sekolah.
               Kata "regu" dibungkus <span class="satuan-regu"> karena hanya
               dipakai di kartu HP — di tabel, judul kolomnya sudah menyebut
               REGU dan mengulanginya cuma memakan lebar. Pembaca layar tetap
               mendapat kalimat utuh lewat aria-label, di kedua tampilan. -->
          <td class="text-center" data-label="Regu">
            ${aktif.length
              ? `<button class="button-detail" type="button" data-detail="${kode}"
                         data-jumlah="${aktif.length}" aria-expanded="${terbuka}"
                         aria-label="Lihat ${aktif.length} regu ${esc(sekolah)}">${
                   terbuka ? "▾" : "▸"} ${aktif.length}<span class="satuan-regu"> regu</span></button>`
              : aktif.length}
          </td>
          <td class="text-right" data-label="Tagihan">${esc(rupiah(tagihan))}</td>
          <td class="text-center" data-label="Metode">${metode}</td>
          <td data-label="">${aksi}</td>
        </tr>
        ${!aktif.length ? "" : `
        <tr class="detail-row" data-detail-untuk="${kode}" ${terbuka ? "" : "hidden"}>
          <td colspan="6" class="detail-cell-flush">
            <table class="detail-table detail-table-bayar">
              <thead>
                <tr><th>Regu</th><th>Kategori</th><th>Ketua</th><th>Sekolah</th>
                    <th class="text-right">Biaya</th></tr>
              </thead>
              <tbody>
                ${aktif.map(r => `
                  <tr>
                    <td><strong>${esc(r.nama_regu)}</strong></td>
                    <td>${esc(GOLONGAN_LABEL[r.golongan] || r.golongan)}</td>
                    <td>${esc(r.nama_ketua)}</td>
                    <td>${sekolah}</td>
                    <td class="text-right">${esc(rupiah(EDISI.biaya_per_regu))}</td>
                  </tr>`).join("")}
              </tbody>
            </table>
          </td>
        </tr>`}`;
    }).join("")));

    /** Isi tombol pembuka rincian: segitiga, jumlah regu, dan kata "regu"
     *  yang hanya tampil di kartu HP (lihat .satuan-regu di gaya). Dibangun
     *  sebagai node, BUKAN textContent — textContent akan membuang <span>
     *  pembungkus kata itu, dan sesudah tombol pertama diklik kartu HP
     *  kehilangan kata "regu" sementara kartu lain masih memilikinya. */
    const isiTombolDetail = (terbuka, jumlah) => {
      const satuan = document.createElement("span");
      satuan.className = "satuan-regu";
      satuan.textContent = " regu";
      return [document.createTextNode(`${terbuka ? "▾" : "▸"} ${jumlah}`), satuan];
    };

    // Buka/tutup rincian regu satu invoice.
    tbody.querySelectorAll("[data-detail]").forEach(btn =>
      btn.addEventListener("click", () => {
        const kode = btn.dataset.detail;
        const barisDetail = tbody.querySelector(`[data-detail-untuk="${CSS.escape(kode)}"]`);
        const buka = barisDetail.hidden;
        // Satu panel saja yang terbuka. Dua rincian terbuka bersamaan membuat
        // baris invoice dan rinciannya berselang-seling di layar, dan petugas
        // yang membacakan rincian ke sekolah bisa membacakan milik sekolah
        // lain — kesalahan yang tidak menimbulkan galat apa pun.
        if (buka) {
          tbody.querySelectorAll("[data-detail-untuk]").forEach(lain => {
            if (lain !== barisDetail) lain.hidden = true;
          });
          tbody.querySelectorAll("[data-detail]").forEach(lainBtn => {
            if (lainBtn === btn) return;
            lainBtn.setAttribute("aria-expanded", "false");
            lainBtn.replaceChildren(...isiTombolDetail(false, lainBtn.dataset.jumlah));
          });
          dibuka.clear();
        }
        if (buka) dibuka.add(kode); else dibuka.delete(kode);
        barisDetail.hidden = !buka;
        btn.setAttribute("aria-expanded", String(buka));
        btn.replaceChildren(...isiTombolDetail(buka, btn.dataset.jumlah));
      }));

    tbody.querySelectorAll("[data-cetak]").forEach(btn =>
      btn.addEventListener("click", () => {
        const b = semua.find(x => x.kode_pembayaran === btn.dataset.cetak);
        if (b) cetakKwitansi([b]);
      }));

    // Jalan mundur yang sah untuk salah tandai (rancangan-b.md 11.9) —
    // wajib beralasan, dan ditolak server bila batch sudah daftar ulang.
    tbody.querySelectorAll("[data-batal-bayar]").forEach(btn =>
      btn.addEventListener("click", async () => {
        const kode = btn.dataset.batalBayar;
        const b = semua.find(x => x.kode_pembayaran === kode);
        const jawab = await dialog({
          judul: "Batalkan verifikasi pembayaran",
          kartuHtml: html`<div class="card card-identity" style="margin-bottom:.8rem">
            <div class="nama">${b.sekolah?.name || kode}</div>
            <div class="detail">${kode} · kwitansi ${b.pembayaran?.nomor_kwitansi || "—"}</div>
          </div>`,
          medan: [{ label: "Alasan pembatalan" }],
          labelAksi: "Batalkan",
        });
        if (!jawab) return;
        try {
          await batalkanVerifikasi(kode, jawab[0]);
          b.status = "menunggu_pembayaran";
          b.pembayaran = null;
          catatTerakhir("pembayaran", kode, `dibatalkan — ${jawab[0]}`);
          notif(`Verifikasi ${kode} dibatalkan.`);
          gambarUlang();
        } catch (err) { notif(err.message, true); }
      }));

    tbody.querySelectorAll("[data-lunas]").forEach(btn =>
      btn.addEventListener("click", async () => {
        const kode = btn.dataset.lunas;
        const b = semua.find(x => x.kode_pembayaran === kode);
        const metode = tbody.querySelector(`[data-metode="${CSS.escape(kode)}"]`).value;
        const aktif = reguAktif(b);
        const tagihan = aktif.length * EDISI.biaya_per_regu;

        if (btn.dataset.jalan === "1") return;
        btn.dataset.jalan = "1"; btn.disabled = true; btn.textContent = "Menyimpan…";
        let r;
        try {
          r = await verifikasiPembayaran(kode, tagihan, metode);
        } catch (err) {
          notif(err.message, true);
          btn.dataset.jalan = ""; btn.disabled = false; btn.textContent = "Tandai Lunas";
          return;
        }
        // Sumber data lokal ikut diperbarui supaya saringan & baris lain
        // tetap konsisten tanpa memuat ulang seluruh tabel.
        tandaiLunasLokal(b, tagihan, metode, r.nomor_kwitansi);
        notif(`${b.sekolah?.name || kode} LUNAS — kwitansi ${r.nomor_kwitansi}`);
        gambarUlang();

        // Panel sukses langsung menawarkan cetak (rancangan-b.md 10.2) —
        // satu alur, bukan dua. Menolak di sini tidak menghilangkan apa pun:
        // tombol "Cetak Kwitansi" tetap ada di barisnya.
        const cetak = await dialog({
          judul: "Lunas — cetak kwitansi?",
          kartuHtml: html`<div class="card card-identity" style="margin-bottom:.8rem">
            <div class="nama">${r.nomor_kwitansi}</div>
            <div class="detail">${b.sekolah?.name || kode} · ${kode} ·
              ${aktif.length} regu · ${rupiah(tagihan)}</div>
          </div>`,
          labelAksi: "Cetak Kwitansi",
        });
        if (cetak) cetakKwitansi([b]);
      }));
  };

  pasangAlatTabel(gambar);
}

/** Menyalin hasil verifikasi ke data lokal + daftar "baris terakhir", supaya
 *  jalur satuan dan jalur massal menulis fakta yang sama persis. */
function tandaiLunasLokal(b, nominal, metode, nomorKwitansi) {
  b.status = "lunas";
  b.pembayaran = {
    nominal, metode, nomor_kwitansi: nomorKwitansi,
    verified_at: new Date().toISOString(),
  };
  catatTerakhir("pembayaran", b.kode_pembayaran,
    `${b.sekolah?.name || ""} — lunas, ${nomorKwitansi}`);
}

/** Kwitansi siap cetak — satu invoice satu lembar, dengan rincian regu yang
 *  dibayar di dalamnya. Sekolah membayar sekaligus, tapi yang mereka simpan
 *  sebagai bukti adalah daftar regunya: nama, kategori, dan biaya per regu.
 *  Dibangun ke dalam #cetakan seperti daftar kloter — di layar tersembunyi,
 *  muncul hanya di kertas (style.css @media print). */
function cetakKwitansi(daftar) {
  document.getElementById("cetakan")?.remove();
  const s = sesi();
  const tanggal = (t) => tanggalPanjang(t || Date.now());

  const halaman = daftar.map(b => {
    const aktif = reguAktif(b);
    const bayar = b.pembayaran || {};
    const total = bayar.amount ?? aktif.length * EDISI.biaya_per_regu;
    const baris = aktif.map((r, i) => html`
      <tr><td>${String(i + 1)}</td>
          <td>${r.nama_regu}</td>
          <td>${GOLONGAN_LABEL[r.golongan] || r.golongan}</td>
          <td>${r.nama_ketua}</td>
          <td class="text-right">${rupiah(EDISI.biaya_per_regu)}</td></tr>`).join("");

    return `
      <section class="print-page">
        <h1>KWITANSI — ${esc(EDISI ? EDISI.name : "")}</h1>
        <p class="receipt-number">${esc(bayar.nomor_kwitansi || "—")}</p>
        <p><strong>Diterima dari:</strong> ${esc(b.sekolah?.name || "—")}</p>
        <p><strong>Kode pembayaran:</strong> ${esc(b.kode_pembayaran)}
           · <strong>Cara bayar:</strong> ${esc(bayar.method || "—")}
           · <strong>Tanggal:</strong> ${esc(tanggal(bayar.verified_at))}</p>
        <p><strong>Untuk pembayaran:</strong> pendaftaran ${aktif.length} regu
           @ ${esc(rupiah(EDISI.biaya_per_regu))}</p>
        <table class="print-table">
          <thead>
            <tr><th>No</th><th>Nama Regu</th><th>Kategori</th><th>Ketua</th>
                <th class="text-right">Biaya</th></tr>
          </thead>
          <tbody>${baris}</tbody>
          <tfoot>
            <tr><th colspan="4" class="text-right">TOTAL</th>
                <th class="text-right">${esc(rupiah(total))}</th></tr>
          </tfoot>
        </table>
        <div class="receipt-signature">
          <p>Diterima oleh,</p>
          <p class="receipt-line">${esc(s ? s.username : "")}</p>
        </div>
        <p class="print-note">
           Simpan dan bawa saat daftar ulang.</p>
      </section>`;
  }).join("");

  document.body.appendChild(h(`<div id="cetakan" class="printout">${halaman}</div>`));
  window.print();
}

/* ============================ MEJA DAFTAR ULANG ========================== */

async function layarDaftarUlang() {
  if (!EDISI) { layarButuhEdisi("Meja Daftar Ulang"); return; }
  pasangKepala("Meja Daftar Ulang", true);
  LAYAR.replaceChildren(h(pemuat()));

  const layarIni = location.hash;
  let semua;
  try { semua = await daftarPendaftaran(); }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarDaftarUlang)); return; }
  if (location.hash !== layarIni) return;   // lihat catatan di layarPembayaran

  // Batch yang daftar isian nomor dadanya sedang dibuka, dan nomor yang sudah
  // sempat diketik (regu_id -> nomor). Keduanya hidup di luar gambar(): meja
  // sering mengetik separuh lalu mengoreksi jumlah pendamping atau mencari
  // sekolah lain, dan tabel digambar ulang setiap kali. Tanpa ini, angka yang
  // sudah dibacakan dari kain fisik hilang diam-diam — persis kejadian yang
  // paling mahal di meja daftar ulang.
  const dibukaNomor = new Set();
  const nilaiDada = new Map();

  LAYAR.replaceChildren(h(`
    <div class="card">
      ${alatTabel({
        saringan: [
          { kode: "belum", label: "Perlu Nomor Dada" },
          { kode: "sudah", label: "Selesai" },
          { kode: "semua", label: "Semua" },
        ],
        saringAktif: "belum",
        jumlah: semua.length,
      })}
      <div class="table-wrapper">
        <table class="table data-table table-daftar-ulang">
          <thead>
            <tr>
              <!-- Tidak ada kolom Regu di sini. Jumlahnya sudah tercetak di
                   dalam tombol "Isi N Nomor Dada" di kolom terakhir, dan
                   kolom sendiri hanya untuk mengulanginya adalah lebar yang
                   terbuang — di jendela sempit lebar itulah yang membuat
                   tombolnya terdorong keluar layar. -->
              <!-- Empat kolom, dua terakhir tanpa judul: nomor dada, lalu
                   tombol tukar. Dulu keduanya berbagi satu kolom, dan
                   tombolnya jatuh ke baris kedua tiap kali nomornya lebih
                   dari dua — tinggi baris jadi dua kali lipat untuk
                   sebagian sekolah saja, dan tabelnya bergerigi. -->
              <th>Kode Bayar</th><th>Sekolah</th><th></th><th></th>
            </tr>
          </thead>
          <tbody id="isi-tabel"></tbody>
        </table>
      </div>
    </div>
    ${barisTerakhirHtml("daftar-ulang")}
  `));

  const gambar = (cari, saring) => {
    // Hanya batch lunas yang relevan di meja ini — yang belum bayar
    // diarahkan ke meja pembayaran dulu, bukan ditampilkan lalu ditolak.
    const lunas = semua.filter(b => b.status === "lunas");
    const belumSemua = (b) => reguAktif(b).some(r => r.nomor_dada === null);
    const baris = lunas.filter(b =>
      cocokCari(b, cari) &&
      (saring === "semua" || (saring === "sudah" ? !belumSemua(b) : belumSemua(b))));

    document.getElementById("tabel-jumlah").textContent = `${baris.length} baris`;
    const tbody = document.getElementById("isi-tabel");

    if (!baris.length) {
      tbody.replaceChildren(h(`<tr><td colspan="4" class="table-empty">
        Tidak ada yang cocok.</td></tr>`));
      return;
    }

    tbody.replaceChildren(h(baris.map(b => {
      const aktif = reguAktif(b);
      const menunggu = aktif.filter(r => r.nomor_dada === null);
      const nomorHtml = aktif.filter(r => r.nomor_dada !== null)
        .sort((x, y) => x.nomor_dada - y.nomor_dada)
        .map(r => html`<span class="pill-number">${dada3(r.nomor_dada)}
          <span class="kloter-pill">K${r.kloter_nomor}</span></span>`).join(" ");

      const kode = esc(b.kode_pembayaran);
      const tombolTukar = nomorHtml
        ? `<button class="button button-secondary button-mini" type="button"
                   data-tukar="${kode}">Tukar nomor rusak…</button>`
        : "";
      // Nomor dada DIKETIK petugas, tidak diterbitkan sistem (migrasi 0011):
      // kainnya benda fisik di meja, dan yang ada di tangan petugas belum
      // tentu nomor terkecil yang tersedia. Jadi tombolnya membuka daftar
      // regu untuk diisi satu per satu, bukan langsung menarik stok.
      const terbuka = dibukaNomor.has(b.kode_pembayaran);
      const aksi = menunggu.length
        ? `<button class="button-detail" type="button"
                   data-isi="${kode}" data-jumlah="${menunggu.length}"
                   aria-expanded="${terbuka}">
             ${terbuka ? "▾" : "▸"} Isi ${menunggu.length} Nomor Dada
           </button>${nomorHtml ? `<div class="sub">${nomorHtml}</div>` : ""}`
        : `<div class="pill-row">${nomorHtml}</div>`;

      // Template biasa (lihat catatan sama di layar Pembayaran).
      return `
        <tr data-baris="${kode}">
          <td class="mono" data-label="Kode Bayar">${kode}</td>
          <!-- Nama-nama regu TIDAK ditampilkan di sini. Barisnya panjang dan
               memakan lebar yang dibutuhkan kolom di kanannya, padahal yang
               dicari petugas di layar ini adalah SEKOLAHNYA — nama regunya
               baru relevan saat mengisi nomor dada, dan di sana ia memang
               tampil satu per satu di rincian. Pencarian tetap mengenali
               nama regu (lihat cocokCari), jadi mengetik nama regu tetap
               menemukan sekolahnya. -->
          <td data-label="Sekolah">
            <strong>${esc(b.sekolah?.name || "—")}</strong>
          </td>
          <td data-label="" class="kol-dada">${aksi}</td>
          <td data-label="" class="kol-tukar">${tombolTukar}</td>
        </tr>
        ${!menunggu.length ? "" : `
        <tr class="detail-row" data-nomor-untuk="${kode}" ${terbuka ? "" : "hidden"}>
          <td colspan="4" class="detail-cell-flush">
            <table class="detail-table detail-table-dada">
              <thead>
                <tr><th>Regu</th><th>Kategori</th><th>Ketua</th><th>Nomor dada</th></tr>
              </thead>
              <tbody>
                ${menunggu.map(r => `
                  <tr>
                    <td><strong>${esc(r.nama_regu)}</strong></td>
                    <td>${esc(GOLONGAN_LABEL[r.golongan] || r.golongan)}</td>
                    <td>${esc(r.nama_ketua)}</td>
                    <td><input type="number" class="small-input" inputmode="numeric" min="1"
                               data-dada="${esc(r.id)}" data-untuk="${kode}"
                               value="${esc(nilaiDada.get(r.id) ?? "")}"></td>
                  </tr>`).join("")}
              </tbody>
            </table>
            <div class="action-row action-row-simpan" style="margin-top:.6rem">
              <span class="sub">Nomor dada yang diinput <strong>HARUS SAMA</strong>
                dengan yang diberikan ke regunya.</span>
              <button class="button button-primary button-small" type="button"
                      data-simpan-dada="${kode}">Simpan ${menunggu.length} Nomor Dada</button>
            </div>
          </td>
        </tr>`}`;
    }).join("")));

    // Nomor rusak/sobek di lapangan: nomor lama PENSIUN (tidak pernah terbit
    // ulang), supaya lembar nilai lama tidak menilai regu yang salah.
    tbody.querySelectorAll("[data-tukar]").forEach(btn =>
      btn.addEventListener("click", async () => {
        const kode = btn.dataset.tukar;
        const b = semua.find(x => x.kode_pembayaran === kode);
        const bernomor = reguAktif(b).filter(r => r.nomor_dada !== null);
        if (!bernomor.length) { notif("Sekolah ini belum punya nomor dada.", true); return; }
        const jawab = await dialog({
          judul: "Tukar nomor dada yang rusak",
          kartuHtml: `<table class="table" style="margin-bottom:.8rem">${bernomor.map(r => html`
              <tr><td class="angka">${dada3(r.nomor_dada)}</td>
                  <td>${r.nama_regu}</td></tr>`).join("")}</table>`,
          medan: [
            { label: "Nomor lama (yang rusak)", tipe: "number" },
            { label: "Nomor pengganti (dari stok)", tipe: "number" },
            { label: "Alasan" },
          ],
          labelAksi: "Tukar nomor",
        });
        if (!jawab) return;
        const [lama, baru, alasan] = jawab;
        const regu = bernomor.find(r => r.nomor_dada === Number(lama));
        if (!regu) { notif(`Nomor ${lama} bukan milik sekolah ini.`, true); return; }
        if (!Number.isInteger(Number(baru)) || Number(baru) <= 0) {
          notif("Nomor pengganti harus angka.", true); return;
        }
        try {
          await tukarNomor(regu.id, Number(baru), alasan);
          regu.nomor_dada = Number(baru);
          catatTerakhir("daftar-ulang", kode, `tukar nomor ${lama} → ${baru}`);
          notif(`Nomor ${lama} diganti ${baru}. Nomor lama tidak dipakai lagi.`);
          gambar(cari, saring);
        } catch (err) { notif(err.message, true); }
      }));

    // Buka daftar regu untuk diisi nomornya, lalu taruh kursor di regu pertama.
    tbody.querySelectorAll("[data-isi]").forEach(btn =>
      btn.addEventListener("click", () => {
        const kode = btn.dataset.isi;
        const barisNomor = tbody.querySelector(`[data-nomor-untuk="${CSS.escape(kode)}"]`);
        const buka = barisNomor.hidden;

        // AKORDEON: hanya SATU sekolah terbuka pada satu waktu. Dua daftar
        // isian terbuka bersamaan membuat petugas mudah mengetik nomor
        // sekolah A ke baris sekolah B — kesalahan yang tidak menimbulkan
        // galat apa pun dan baru ketahuan saat klasemen keluar. Angka yang
        // sudah diketik TIDAK hilang: tersimpan di nilaiDada dan muncul lagi
        // saat sekolahnya dibuka ulang.
        if (buka) {
          tbody.querySelectorAll("[data-nomor-untuk]").forEach(lain => {
            if (lain !== barisNomor) lain.hidden = true;
          });
          tbody.querySelectorAll("[data-isi]").forEach(lainBtn => {
            if (lainBtn === btn) return;
            lainBtn.setAttribute("aria-expanded", "false");
            lainBtn.textContent = `▸ Isi ${lainBtn.dataset.jumlah} Nomor Dada`;
          });
          dibukaNomor.clear();
        }

        if (buka) dibukaNomor.add(kode); else dibukaNomor.delete(kode);
        barisNomor.hidden = !buka;
        btn.setAttribute("aria-expanded", String(buka));
        const jumlah = barisNomor.querySelectorAll("[data-dada]").length;
        btn.textContent = `${buka ? "▾" : "▸"} Isi ${jumlah} Nomor Dada`;
        // Auto-focus HANYA di layar lebar. Di HP, focus() memunculkan
        // keyboard dan menggeser halaman, sehingga ketukan berikutnya
        // meleset dari tombol ini — terasa seperti tombolnya tidak bisa
        // diklik ulang (laporan pengguna).
        if (buka && window.matchMedia("(min-width: 561px)").matches)
          barisNomor.querySelector("[data-dada]")?.focus();
      }));

    // Loop ketik-Enter (rancangan-b.md 10.1.4): Enter pindah ke regu
    // berikutnya, dan di regu terakhir langsung menyimpan — satu sekolah
    // selesai tanpa memegang mouse.
    tbody.querySelectorAll("[data-dada]").forEach(inp => {
      inp.addEventListener("input", () => nilaiDada.set(inp.dataset.dada, inp.value));
      inp.addEventListener("keydown", e => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const untuk = CSS.escape(inp.dataset.untuk);
        const sekelompok = [...tbody.querySelectorAll(`[data-dada][data-untuk="${untuk}"]`)];
        const berikut = sekelompok[sekelompok.indexOf(inp) + 1];
        if (berikut) berikut.focus();
        else tbody.querySelector(`[data-simpan-dada="${untuk}"]`)?.click();
      });
    });

    tbody.querySelectorAll("[data-simpan-dada]").forEach(btn =>
      btn.addEventListener("click", async () => {
        if (btn.dataset.jalan === "1") return;
        const kode = btn.dataset.simpanDada;
        const b = semua.find(x => x.kode_pembayaran === kode);
        const isian = [...tbody.querySelectorAll(
          `[data-dada][data-untuk="${CSS.escape(kode)}"]`)];

        // Gagal itu nyaring dan LOKAL (rancangan-b.md 10.1.11): isian yang
        // salah memerah di tempatnya, bukan cuma pesan umum di bawah layar.
        isian.forEach(i => i.classList.remove("input-error"));
        const pasangan = [];
        const dipakai = new Set();
        let keluhan = null;
        for (const inp of isian) {
          const angka = Number(inp.value.trim());
          if (!inp.value.trim() || !Number.isInteger(angka) || angka <= 0) {
            inp.classList.add("input-error");
            keluhan = keluhan || "Setiap regu harus diberi nomor dada berupa angka.";
            continue;
          }
          if (dipakai.has(angka)) {
            inp.classList.add("input-error");
            keluhan = keluhan || `Nomor ${angka} diketik untuk dua regu.`;
            continue;
          }
          dipakai.add(angka);
          pasangan.push({ regu_id: inp.dataset.dada, nomor_dada: angka });
        }
        if (keluhan) {
          notif(keluhan, true);
          isian.find(i => i.classList.contains("galat-isian"))?.focus();
          return;
        }

        btn.dataset.jalan = "1"; btn.disabled = true; btn.textContent = "Menyimpan…";
        let hasil;
        try {
          hasil = await daftarUlang(kode, pasangan);
        } catch (err) {
          notif(err.message, true);
          btn.dataset.jalan = ""; btn.disabled = false;
          btn.textContent = `Simpan ${isian.length} Nomor Dada`;
          return;
        }
        // Tempelkan nomor + kloter ke data lokal. Kloternya yang baru: itu
        // satu-satunya bagian yang masih ditentukan sistem, jadi itu yang
        // disebut di notifikasi.
        hasil.forEach(x => {
          const r = (b.regu || []).find(y => y.id === x.regu_id);
          if (r) { r.nomor_dada = x.nomor_dada; r.kloter_nomor = x.kloter; }
        });
        dibukaNomor.delete(kode);
        pasangan.forEach(p => nilaiDada.delete(p.regu_id));
        catatTerakhir("daftar-ulang", kode, hasil.map(x =>
          `${x.nama_regu} ${dada3(x.nomor_dada)}`).join(", "));
        const kloter = [...new Set(hasil.map(x => x.kloter))].sort((x, y) => x - y).join(", ");
        notif(`${b.sekolah?.name || kode}: ${hasil.length} regu tersimpan — kloter ${kloter}.`);
        gambar(cari, saring);
      }));
  };

  pasangAlatTabel(gambar);
}

/* ============================ KEBERANGKATAN ============================== */

async function layarKeberangkatan() {
  if (!EDISI) { layarButuhEdisi("Keberangkatan"); return; }
  pasangKepala("Keberangkatan", true);
  LAYAR.replaceChildren(h(pemuat()));

  const layarIni = location.hash;
  let papan, opsi;

  /* Tanggalnya diambil dari perkiraan berangkat, yang selalu jatuh di tanggal
     lomba — BUKAN dari kalender alat pencatat. Petugas mengetik jam dinding,
     dan jam dinding tidak membawa tanggal.

     Ini bukan kehati-hatian teoretis: mencoba layar ini sebelum hari-H adalah
     persis yang menaruh "kloter 1 berangkat 2026-08-15 16:00" di database,
     enam bulan sebelum acaranya, dan membuat penalti seluruh kloter itu
     terhitung 190 hari. */
  const hariLomba = () =>
    papan.find(k => k.perkiraan_berangkat)?.perkiraan_berangkat || Date.now();
  try { [papan, opsi] = await Promise.all([papanKeberangkatan(), kontrakOpsi()]); }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarKeberangkatan)); return; }
  // Daftar sisipan pindah ke sini bersama layar Pindah Kloter yang dihapus.
  // Ia TIDAK ikut dihapus: ini satu-satunya cara petugas staging tahu ada
  // nomor yang tidak tercetak di kertasnya. Boleh gagal — daftar kloternya
  // sendiri jauh lebih penting daripada hiasan ini.
  let sisipan = [];
  try { sisipan = await daftarSisipan(); } catch { /* daftar boleh telat */ }
  if (location.hash !== layarIni) return;   // lihat catatan di layarPembayaran

  if (!papan.length) {
    LAYAR.replaceChildren(h(`
      <div class="card">
        <h2>Belum ada kloter berisi regu</h2>
      </div>`));
    return;
  }

  // Kloter yang dibuka pertama: yang paling depan dan belum berangkat —
  // itulah yang sedang ditangani petugas garis start.
  let kloterAktif = (papan.find(k => !k.jam_berangkat) || papan[0]).nomor;

  LAYAR.replaceChildren(h(`
    <div class="card">
      <div class="kloter-strip" id="pita-kloter"></div>
    </div>
    <div id="isi-kloter"></div>
  `));

  const gambarPita = () => {
    document.getElementById("pita-kloter").replaceChildren(h(papan.map(k => {
      /* Kloter yang SUDAH berangkat menampilkan JAMNYA, bukan kata
         "berangkat".

         Kata itu tidak menambah apa pun — chip-nya sudah berwarna hijau
         "berangkat", dan angka ceklis di sebelahnya sudah penuh. Sementara
         jamnya adalah hal yang justru dicari, dan sebelumnya hanya bisa
         dilihat dengan MENGETUK kloternya satu per satu lalu membaca pitanya.

         Panitia memeriksa jadwal keberangkatan dari luar — berdiri di garis
         start, melihat kloter mana berangkat pukul berapa, tanpa membuka
         satu-satu. Datanya sudah ikut di v_keberangkatan sejak awal; layar ini
         saja yang membuangnya. */
      /* Yang BELUM berangkat menampilkan PERKIRAANNYA, bukan kata "menunggu".

         "Menunggu" adalah hal yang sudah terbaca dari warna chip-nya, dan ia
         menjawab pertanyaan yang tidak ada yang ajukan. Yang ditanyakan
         sepanjang pagi cuma satu: "kloter 9 kira-kira jam berapa?" — dan
         jawabannya sudah dihitung sejak migrasi 0009, hanya belum pernah
         sampai ke layar ini (0053).

         Tandanya "~" supaya tidak pernah tertukar dengan jam yang benar-benar
         tercatat. Perkiraan bukan catatan — CLAUDE.md 10.6. */
      const label = k.jam_berangkat
        ? jamMenit(k.jam_berangkat)
        : k.perkiraan_berangkat ? `~${jamMenit(k.perkiraan_berangkat)}`
        : ({ siap: "siap", konfirmasi_kontrak: "kontrak",
             menunggu: "menunggu" }[k.posisi] || "");
      return html`
        <button type="button" class="kloter-chip ${k.posisi}${
                  k.lewat_batas && !k.jam_berangkat ? " lewat-batas" : ""}"
                data-kloter="${k.nomor}" aria-pressed="${k.nomor === kloterAktif}">
          <span class="chip-nomor">Kloter ${k.nomor}</span>
          <span class="chip-ket">${k.sudah_ceklis}/${k.jumlah_regu} · ${label}</span>
        </button>`;
    }).join("")));

    document.querySelectorAll("[data-kloter]").forEach(b =>
      b.addEventListener("click", () => {
        kloterAktif = Number(b.dataset.kloter);
        gambarPita();
        gambarKloter();
      }));
  };

  async function gambarKloter() {
    const kotak = document.getElementById("isi-kloter");
    kotak.replaceChildren(h(`<p>Memuat kloter ${kloterAktif}…</p>`));

    let regu;
    try { regu = await reguKloter(kloterAktif); }
    catch (e) { kotak.replaceChildren(kartuGagalMuat(e.message, gambarKloter)); return; }

    const info = papan.find(k => k.nomor === kloterAktif) || {};
    const sudahBerangkat = !!info.jam_berangkat;
    // Tujuan pindah = semua kloter lain, TERMASUK yang sudah berangkat.
    // Regu telat yang berlari menyusul kloter berikutnya memang berangkat
    // bersama kloter itu, pada jam kloter itu — menyembunyikannya memaksa
    // petugas mencatat kloter yang tidak ia jalani (migrasi 0018).
    const tujuanPindah = papan.filter(k => k.nomor !== kloterAktif);
    const belumKontrak = regu.filter(r => r.sudah_ceklis && r.kontrak_menit === null);

    kotak.replaceChildren(h(`
      ${kartuSisipan(sisipan.filter(s => s.kloter === kloterAktif))}
      <div class="card">
        <div class="kloter-header">
          <h2>Kloter ${kloterAktif}</h2>
          ${sudahBerangkat
            ? html`<span class="badge badge-green">BERANGKAT ${jamMenit(info.jam_berangkat)}</span>
                   <button class="icon-button icon-button-inline" id="koreksi-jam" type="button"
                           title="Betulkan jam berangkat"
                           aria-label="Betulkan jam berangkat Kloter ${kloterAktif}">&#9998;</button>`
            : `<span class="badge badge-yellow">BELUM BERANGKAT</span>`}
        </div>

        <div class="table-wrapper table-wrapper-tetap" style="margin-top:.6rem">
          <table class="table data-table table-tetap">
            <thead>
              <tr>
                <th class="text-center">Hadir</th><th>Nomor Dada</th><th>Regu</th>
                <th>Kontrak waktu</th><th>Pindah kloter</th>
              </tr>
            </thead>
            <tbody>
              ${regu.map(r => `
                <tr>
                  <td class="text-center">
                    <input type="checkbox" class="checkbox" data-ceklis="${esc(r.nomor_dada)}"
                           ${r.sudah_ceklis ? "checked" : ""}
                           aria-label="ceklis regu ${esc(r.nomor_dada)}">
                  </td>
                  <td class="angka">${dada3(r.nomor_dada)}</td>
                  <td>
                    <strong>${esc(r.nama_regu)}</strong>
                    <div class="sub">${esc(r.nama_sekolah)}${r.sisipan ? " · SISIPAN" : ""}</div>
                  </td>
                  <td>
                    <select class="select-small" data-kontrak="${esc(r.regu_id)}"
                            ${r.sudah_ceklis ? "disabled" : ""}>
                      <option value="">Belum dipilih</option>
                      ${opsi.map(o => `<option value="${esc(o.menit)}"
                        ${r.kontrak_menit === o.menit ? "selected" : ""}>${esc(o.label)}</option>`).join("")}
                    </select>
                  </td>
                  <td>
                    <select class="select-small" data-pindah="${esc(r.nomor_dada)}"
                            ${r.sudah_ceklis || !tujuanPindah.length ? "disabled" : ""}
                            aria-label="pindahkan regu ${esc(r.nomor_dada)} ke kloter lain">
                      <option value="">—</option>
                      ${tujuanPindah.map(k => `<option value="${esc(k.nomor)}">Kloter ${esc(k.nomor)}${
                        k.jam_berangkat ? " (sudah berangkat)" : ""}</option>`).join("")}
                    </select>
                  </td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>

        <!-- Dibungkus supaya isinya bisa dihitung ulang tanpa menggambar
             ulang seluruh tabel — lihat perbaruiPeringatanKontrak(). -->
        <div id="peringatan-kontrak">${!belumKontrak.length ? "" : kartuGalat(
          `${belumKontrak.length} regu sudah diceklis tapi belum punya kontrak waktu — ` +
          `keberangkatan akan ditolak.`)}</div>

        ${sudahBerangkat ? "" : `
          <div class="departure-bar">
            <div class="field" style="margin:0">
              <label for="jam-berangkat">Jam berangkat</label>
              <!-- Kotak ketik, bukan <input type="time">: pemilih bawaan
                   browser merender AM/PM kalau locale browsernya Inggris, dan
                   tidak ada atribut yang bisa memaksanya 24 jam. Lihat
                   jamSah() di util.js. -->
              ${kotakJamHtml("jam-berangkat", jamMenit(new Date()))}
            </div>
            <button class="button button-primary" id="aksi-berangkat" type="button">
              🚩 Berangkatkan Kloter ${kloterAktif}
            </button>
          </div>
        `}
      </div>
    `));

    /** Hitung ulang peringatan "sudah diceklis tapi belum punya kontrak"
     *  dari KEADAAN LAYAR, bukan dari data yang diambil saat tabel digambar.
     *  Ceklis dan kontrak waktu diubah tanpa menggambar ulang tabel (sengaja
     *  — menggambar ulang tiap centang membuat petugas kehilangan tempatnya
     *  saat mencentang belasan regu berturut-turut), jadi peringatan yang
     *  dihitung sekali di awal langsung basi: ia sempat tetap menuduh ada
     *  regu tanpa kontrak padahal kontraknya baru saja dipilih. */
    const perbaruiPeringatanKontrak = () => {
      const wadah = document.getElementById("peringatan-kontrak");
      if (!wadah) return;
      const kurang = [...kotak.querySelectorAll("[data-ceklis]")].filter(cb =>
        cb.checked && !cb.closest("tr")?.querySelector("[data-kontrak]")?.value);
      wadah.replaceChildren(...(kurang.length
        ? [h(kartuGalat(
            `${kurang.length} regu sudah diceklis tapi belum punya kontrak waktu — ` +
            `keberangkatan akan ditolak.`))]
        : []));
    };

    kotak.querySelectorAll("[data-ceklis]").forEach(cb => {
      // Klik beruntun diantrekan, TIDAK diblokir: petugas yang salah centang
      // langsung membatalkannya, dan kotak yang menolak klik kedua membuat
      // koreksi itu mustahil. Antrean menjaga urutannya tetap benar.
      let antre = Promise.resolve();
      cb.addEventListener("change", () => {
        const dada = Number(cb.dataset.ceklis);
        const mau = cb.checked;
        cb.classList.add("saving");
        antre = antre.then(async () => {
          try {
            if (mau) await ceklisBerangkat(dada);
            else await batalCeklisBerangkat(dada);
            // Redup dilepas begitu tulisannya masuk. Papan menyusul di bawah:
            // menunggunya membuat centang terasa lambat sedetik padahal
            // datanya sudah tersimpan.
            cb.classList.remove("saving");
            // Dua dropdown di baris yang sama dikunci selama regunya
            // terceklis, dan status terkunci itu ditulis saat tabel
            // digambar. Sesudah ini yang digambar ulang hanya pita kloter di
            // atas, bukan barisnya — jadi tanpa baris ini kuncinya tertinggal
            // di keadaan lama: petugas membatalkan ceklis, lalu mendapati
            // kontrak waktu masih tidak bisa dipilih sampai layar dimuat
            // ulang. Persis keluhan di lapangan.
            const baris = cb.closest("tr");
            const kontrak = baris?.querySelector("[data-kontrak]");
            if (kontrak) kontrak.disabled = mau;
            const pindah = baris?.querySelector("[data-pindah]");
            // Pindah kloter punya syarat KEDUA: harus ada kloter tujuan.
            // Kalau tidak ada, isinya cuma "—" dan ia tetap terkunci.
            if (pindah) pindah.disabled = mau || pindah.options.length <= 1;
            perbaruiPeringatanKontrak();
            papan = await papanKeberangkatan();
            gambarPita();
          } catch (err) {
            notif(err.message, true);
            cb.checked = !mau;
            cb.classList.remove("saving");
          }
        });
      });
    });

    kotak.querySelectorAll("[data-kontrak]").forEach(sel =>
      sel.addEventListener("change", async () => {
        if (!sel.value) return;
        sel.disabled = true;
        try {
          await konfirmasiKontrak(sel.dataset.kontrak, Number(sel.value));
          sel.classList.add("saved");
          setTimeout(() => sel.classList.remove("saved"), 1200);
        } catch (err) {
          notif(err.message, true);
        }
        sel.disabled = false;
        perbaruiPeringatanKontrak();
      }));

    kotak.querySelectorAll("[data-pindah]").forEach(sel =>
      sel.addEventListener("change", async () => {
        const tujuan = Number(sel.value);
        if (!tujuan) return;
        const dada = Number(sel.dataset.pindah);
        const jawab = await dialog({
          judul: `Pindahkan nomor ${dada3(dada)} ke Kloter ${tujuan}?`,
          kartuHtml: html`<div class="card card-identity" style="margin-bottom:.8rem">
            <div class="nama">Dari Kloter ${kloterAktif} ke Kloter ${tujuan}</div>
            <div class="detail">${papan.find(k => k.nomor === tujuan)?.jam_berangkat
              ? `Kloter ${tujuan} sudah berangkat — regu ini akan dinilai dari jam berangkat kloter itu.`
              : ""}</div>
          </div>`,
          medan: [{ label: "Alasan pemindahan" }],
          labelAksi: "Pindahkan",
        });
        // Batal (atau gagal) mengembalikan select ke "—", kalau tidak ia
        // menampilkan kloter tujuan seolah pemindahan sudah terjadi.
        if (!jawab) { sel.value = ""; return; }
        sel.disabled = true;
        let hasil;
        try {
          hasil = await pindahKloter(dada, jawab[0], tujuan);
        } catch (err) {
          notif(err.message, true);
          sel.value = ""; sel.disabled = false;
          return;
        }
        papan = await papanKeberangkatan();
        gambarPita();
        gambarKloter();
        // Peringatan sisipan TIDAK boleh berupa toast yang hilang sendiri:
        // petugas staging memegang kertas yang tidak memuat nomor ini.
        if (hasil.peringatan) {
          kotak.prepend(h(html`
            <div class="card" style="border:3px solid var(--bahaya);background:var(--bahaya-muda)">
              <h2 style="color:var(--bahaya)">⚠️ Bacakan ke petugas staging</h2>
              <p style="font-size:1.1rem;margin-top:.4rem">${hasil.peringatan}</p>
            </div>`));
        } else {
          notif(`Nomor ${dada3(dada)} pindah dari Kloter ${hasil.kloter_lama} ke Kloter ${hasil.kloter_baru}.`);
        }
      }));

    // Membetulkan jam yang sudah tercatat. Jam berangkat menentukan penalti
    // SELURUH regu di kloter ini, dan salah ketik tidak menimbulkan galat apa
    // pun — ia hanya muncul sebagai nilai yang salah saat klasemen keluar.
    // Karena itu koreksinya minta alasan dan tercatat di history.
    const tombolKoreksi = document.getElementById("koreksi-jam");
    if (tombolKoreksi) tombolKoreksi.addEventListener("click", async () => {
      // Jam kloter tetangga ditampilkan, BUKAN dipaksakan. Fungsi database
      // sengaja tidak menolak jam yang melanggar urutan (kalau menolak, dua
      // kloter yang jamnya sama-sama salah saling mengunci). Yang menangkap
      // salah ketik di sini adalah mata pencatat, jadi angka pembandingnya
      // ditaruh di depan mata.
      const sebelum = papan.filter(k => k.nomor < kloterAktif && k.jam_berangkat).pop();
      const sesudah = papan.find(k => k.nomor > kloterAktif && k.jam_berangkat);
      const tetangga = [
        sebelum && `Kloter ${sebelum.nomor} berangkat ${jamMenit(sebelum.jam_berangkat)}`,
        sesudah && `Kloter ${sesudah.nomor} berangkat ${jamMenit(sesudah.jam_berangkat)}`,
      ].filter(Boolean).join(" · ");

      const jawab = await dialog({
        judul: `Betulkan jam berangkat Kloter ${kloterAktif}`,
        kartuHtml: html`<div class="card card-identity" style="margin-bottom:.8rem">
          <div class="nama">Sekarang tercatat ${jamMenit(info.jam_berangkat)}</div>
          <div class="detail">Mengubah jam ini menghitung ulang penalti waktu
            seluruh regu di Kloter ${kloterAktif}.${tetangga ? ` ${tetangga}.` : ""}</div>
        </div>`,
        medan: [
          { label: "Jam berangkat yang benar", tipe: "jam",
            nilai: jamMenit(info.jam_berangkat) },
          { label: "Alasan koreksi", contoh: "salah input" },
        ],
        labelAksi: "Simpan Koreksi",
      });
      if (!jawab) return;
      const [hhmm, alasan] = jawab;
      try {
        await koreksiJamBerangkat(kloterAktif,
          jamPadaHari(hhmm, hariLomba()).toISOString(), alasan);
      } catch (err) { notif(err.message, true); return; }
      notif(`Jam berangkat Kloter ${kloterAktif} dibetulkan jadi ${hhmm}.`);
      papan = await papanKeberangkatan();
      gambarPita();
      gambarKloter();
    });

    const kotakJamBerangkat = pasangKotakJam("jam-berangkat");

    const tombol = document.getElementById("aksi-berangkat");
    if (tombol) tombol.addEventListener("click", async () => {
      if (tombol.dataset.jalan === "1") return;
      if (kotakJamBerangkat.kosong()) {
        notif("Jam berangkat wajib diisi.", true); return;
      }
      // Ditolak, bukan ditebak. Jam berangkat menentukan penalti seluruh
      // kloter — menebak maksud "19:75" akan menghukum sepuluh regu sekaligus.
      const hhmm = kotakJamBerangkat.nilai();
      if (!hhmm) {
        kotakJamBerangkat.salah(true);
        kotakJamBerangkat.fokus();
        notif("Jam berangkat belum lengkap atau di luar 00:00–23:59. "
              + "Contoh: 07:15.", true);
        return;
      }
      kotakJamBerangkat.setNilai(hhmm);
      tombol.dataset.jalan = "1"; tombol.disabled = true; tombol.textContent = "Menyimpan…";
      try {
        await berangkatkanKloter(kloterAktif,
          jamPadaHari(hhmm, hariLomba()).toISOString());
      } catch (err) {
        notif(err.message, true);
        tombol.dataset.jalan = ""; tombol.disabled = false;
        tombol.textContent = `🚩 Berangkatkan Kloter ${kloterAktif}`;
        return;
      }
      notif(`Kloter ${kloterAktif} berangkat ${hhmm}.`);
      papan = await papanKeberangkatan();
      gambarPita();
      gambarKloter();
    });
  }

  gambarPita();
  gambarKloter();
}

/* ============================ CETAK DAFTAR KLOTER ======================== */

async function layarCetakKloter() {
  pasangKepala("Daftar Kloter");
  LAYAR.replaceChildren(h(pemuat()));

  let baris;
  try { baris = await daftarKloter(); }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarCetakKloter)); return; }

  if (!baris.length) {
    LAYAR.replaceChildren(h(`<div class="card">
      <h2>Belum ada regu berkloter</h2>
    </div>`));
    return;
  }

  // Kelompokkan per kloter. Dipakai ulang tiap kali tombol cetak ditekan,
  // karena datanya diambil segar saat itu juga.
  const kelompokkan = (rows) => {
    const peta = new Map();
    for (const b of rows) {
      if (!peta.has(b.kloter)) peta.set(b.kloter, { dicetak: b.dicetak_pada, isi: [] });
      peta.get(b.kloter).isi.push(b);
    }
    return peta;
  };

  let perKloter = kelompokkan(baris);

  LAYAR.replaceChildren(h(`
    <div class="card" style="border-color:var(--utama)">
      <table class="table">
        <tr><td>Total Kloter</td><td class="angka">${perKloter.size}</td></tr>
        <tr><td>Total Regu</td><td class="angka">${baris.length}</td></tr>
      </table>
      <div class="option-row" style="margin-top:.9rem">
        <button class="button button-primary" id="cetak-petugas" type="button">
          ${ikon("printer")} Cetak Kloter untuk Petugas
        </button>
        <button class="button button-primary" id="cetak-peserta" type="button">
          ${ikon("printer")} Cetak Kloter untuk Peserta
        </button>
      </div>
    </div>
    <div id="pratayang"></div>
  `));

  const gambarPratayang = (peta) => {
    // CATATAN: baris tabel dirakit dengan html`` (nilai di-escape), lalu
    // digabung memakai template BIASA. Menyisipkan HTML jadi ke dalam html``
    // akan meng-escape-nya dua kali dan tabelnya tampil sebagai teks mentah.
    document.getElementById("pratayang").replaceChildren(h(
      [...peta.entries()].map(([nomor, v]) => {
        const baris = v.isi.map(r => html`
          <tr><td class="angka">${dada3(r.nomor_dada)}</td>
              <td><strong>${r.nama_regu}</strong></td>
              <td>${r.nama_sekolah}</td>
              <td>${GOLONGAN_LABEL[r.golongan] || r.golongan}</td></tr>`).join("");
        return `
          <div class="card">
            <h2>Kloter ${esc(nomor)}
              <span class="badge ${v.dicetak ? "badge-gray" : "badge-yellow"}">
                ${v.dicetak ? "sudah dicetak" : "baru"}</span></h2>
            <table class="table">${baris}</table>
          </div>`;
      }).join("")));
  };

  /** Cetak SEMUA kloter dalam satu bentuk kertas.
   *  Datanya diambil ulang tepat sebelum mencetak: layar ini sering dibiarkan
   *  terbuka sementara meja daftar ulang terus jalan, dan kertas yang keluar
   *  tanpa regu yang baru masuk adalah kertas yang salah — petugas garis start
   *  memanggil dari kertas itu, bukan dari layar. */
  async function cetak(bentuk) {
    let segar;
    try { segar = await daftarKloter(); }
    catch (err) { notif(err.message, true); return; }

    perKloter = kelompokkan(segar);
    gambarPratayang(perKloter);
    siapkanCetakKloter([...perKloter.entries()], bentuk);
    window.print();

    // Ditandai SETELAH dialog cetak ditutup — kalau operator membatalkan,
    // kloternya belum dianggap tercetak.
    const lanjut = confirm([
      "Kertasnya sudah keluar dengan benar?",
      "",
      "OK  = tandai kloter ini sudah dicetak (isinya dibekukan)",
      "Batal = belum, biarkan bisa dicetak lagi",
    ].join("\n"));
    if (!lanjut) return;
    try {
      const n = await tandaiKloterDicetak(null);
      notif(`${n} kloter ditandai sudah dicetak dan dibekukan.`);
      layarCetakKloter();
    } catch (err) { notif(err.message, true); }
  }

  document.getElementById("cetak-petugas").addEventListener("click", () => cetak("staging"));
  document.getElementById("cetak-peserta").addEventListener("click", () => cetak("umum"));
  gambarPratayang(perKloter);
}

/** Blok cetak daftar kloter — satu kloter per halaman kertas.
 *  Dua pembaca, dua bentuk (panitia menyebutkan keduanya):
 *   - 'staging' : dipegang petugas staging, ada kolom centang kehadiran dan
 *                 tempat menulis jam berangkat sebenarnya.
 *   - 'umum'    : ditempel di papan pengumuman & dibagikan ke barak, dibaca
 *                 peserta — perkiraan berangkat dibesarkan, kolom centang
 *                 dihilangkan karena tidak ada gunanya bagi peserta.
 */
function siapkanCetakKloter(dipakai, bentuk = "staging") {
  document.getElementById("cetakan")?.remove();

  const halaman = dipakai.map(([nomor, v]) => {
    const contoh = v.isi[0] || {};
    const perkiraan = jamMenit(contoh.perkiraan_berangkat);
    const nyata = contoh.sudah_berangkat;

    const baris = v.isi.map(r => bentuk === "staging"
      ? html`
        <tr><td class="kotak"></td>
            <td class="dada">${dada3(r.nomor_dada)}</td>
            <td>${r.nama_regu}${r.sisipan ? " ★" : ""}</td>
            <td>${r.nama_sekolah}</td>
            <td>${GOLONGAN_LABEL[r.golongan] || r.golongan}</td></tr>`
      : html`
        <tr><td class="dada">${dada3(r.nomor_dada)}</td>
            <td>${r.nama_regu}</td>
            <td>${r.nama_sekolah}</td>
            <td>${GOLONGAN_LABEL[r.golongan] || r.golongan}</td></tr>`).join("");

    const adaSisipan = v.isi.some(r => r.sisipan);

    return bentuk === "staging" ? `
      <section class="print-page">
        <h1>KLOTER ${esc(nomor)} — ${esc(EDISI ? EDISI.name : "")}</h1>
        <p><strong>${nyata ? "Berangkat" : "Perkiraan berangkat"}: ${esc(perkiraan)}</strong>
           ${nyata ? "" : " · Jam sebenarnya: ________"} · Petugas: ________________</p>
        <table class="print-table">
          <!-- Hadir di kolom PALING KIRI, sejajar dengan tombol centang di
               layar Keberangkatan. Petugas memegang kertas ini di satu tangan
               dan HP di tangan lain; kalau kotak centangnya di ujung yang
               berlawanan, matanya menyeberangi seluruh baris tiap regu. -->
          <thead><tr><th class="kotak">Hadir</th><th>No Dada</th><th>Nama Regu</th><th>Sekolah</th><th>Golongan</th></tr></thead>
          <tbody>${baris}</tbody>
        </table>
        ${adaSisipan ? `<p class="insert-note">★ = regu sisipan, ditambahkan setelah kertas ini dicetak.</p>` : ""}
      </section>` : `
      <section class="print-page">
        <h1>KLOTER ${esc(nomor)}</h1>
        <p class="jam-besar">${nyata ? "Berangkat" : "Perkiraan berangkat"}: ${esc(perkiraan)}</p>
        <table class="print-table">
          <thead><tr><th>No Dada</th><th>Nama Regu</th><th>Sekolah</th><th>Golongan</th></tr></thead>
          <tbody>${baris}</tbody>
        </table>
        <p class="print-note">Bersiap di staging paling lambat 15 menit sebelum
           perkiraan berangkat.<br>
           Jam sebenarnya bisa bergeser, ikuti panggilan petugas.</p>
      </section>`;
  }).join("");
  document.body.appendChild(h(`<div id="cetakan" class="printout">${halaman}</div>`));
}

/* ============================ MEJA FINISH ================================ */

/** Target panitia: DUA aksi, ±3 detik per regu — "ketik nomor, klik Sampai".
 *  Karena itu TIDAK ADA tombol Cari: detail regu muncul sendiri sambil
 *  mengetik, dan Enter sama dengan menekan tombol. Echo-confirm tetap ada
 *  karena kartu identitas sudah terpampang saat operator menekan.
 *
 *  Jam yang tersimpan adalah jam saat TOMBOL DITEKAN di laptop panitia —
 *  bukan cap waktu server saat data sampai (alur 10.2). Untuk pencatatan
 *  susulan dari kertas, jamnya bisa diubah.
 */
function layarFinish() {
  pasangKepala("Kedatangan");
  LAYAR.replaceChildren(h(`
    <div class="card" style="border-color:var(--utama)">
      <div class="field" style="margin-bottom:0">
        <label for="dada">Nomor dada</label>
        <input type="text" id="dada" class="besar" inputmode="numeric"
               autocomplete="off" placeholder="001">
      </div>
      <div id="kartu-regu" style="margin-top:.7rem"></div>
      <button class="button button-primary" id="sampai" type="button" disabled
              style="margin-top:.7rem;min-height:60px;font-size:1.2rem">
        ✅ SAMPAI DI FINISH
      </button>
      <!-- TOMBOL adalah pencatat utama di meja ini; kertas panitia hanya untuk
           cek silang. Jadi jam & anggota sengaja TIDAK sejajar dengan tombol —
           keduanya dipakai saat memperbaiki hasil verifikasi, bukan tiap regu. -->
      <details style="margin-top:.6rem">
        <summary style="cursor:pointer;min-height:40px;font-size:.9rem;color:var(--tinta-lembut)">
          Perbaiki jam atau jumlah anggota
        </summary>
        <div class="two-column pasangan-sempit" style="margin-top:.5rem">
          <div class="field" style="margin:0">
            <label for="jam">Jam datang</label>
            <!-- Kotak ketik, alasan sama dengan jam berangkat: pemilih bawaan
                 browser bisa muncul sebagai AM/PM. Lihat jamSah() di util.js. -->
            ${kotakJamHtml("jam")}
          </div>
          <div class="field" style="margin:0">
            <label for="hadir">Anggota hadir</label>
            <input type="number" id="hadir" min="0" max="5" inputmode="numeric" value="5">
          </div>
        </div>
        <div id="dampak-jam" style="margin-top:.5rem"></div>
      </details>
    </div>
    <div id="riwayat-finish"></div>
  `));

  const inp = document.getElementById("dada");
  const kotak = document.getElementById("kartu-regu");
  const tombol = document.getElementById("sampai");
  const inpJam = pasangKotakJam("jam");
  const inpHadir = document.getElementById("hadir");
  let regu = null;
  let jeda = null;

  inp.focus();
  gambarRiwayat();

  const enter = (e) => {
    if (e.key === "Enter" && !tombol.disabled) { e.preventDefault(); tombol.click(); }
  };
  inpJam.pada("keydown", enter);
  inpHadir.addEventListener("keydown", enter);

  // Angka penalti dipakai untuk menjawab pertanyaan yang sebenarnya saat
  // membandingkan catatan kertas dengan jam tombol: bukan "beda berapa menit",
  // melainkan "apakah bedanya MENGUBAH penalti". Karena penalti dibulatkan per
  // 10 menit, selisih semenit dua menit hampir selalu tidak berpengaruh.
  let PENALTI = null;
  infoPenalti().then(p => { PENALTI = p; }).catch(() => {});

  const hitungPenalti = (jam, target) => {
    if (!PENALTI || !target) return null;
    const selisih = Math.abs(new Date(jam) - new Date(target)) / 60000;
    return Math.floor(selisih / PENALTI.blok_menit) * Number(PENALTI.penalti_per_blok);
  };

  const perbaruiDampak = () => {
    const el = document.getElementById("dampak-jam");
    if (!el) return;
    if (!regu || !regu.target_datang || !PENALTI) { el.replaceChildren(); return; }
    // Pembandingnya beda menurut keadaan: regu yang BELUM tercatat dibandingkan
    // dengan jam tombol sekarang; yang SUDAH tercatat dibandingkan dengan jam
    // yang tersimpan — itulah angka yang sedang diverifikasi terhadap kertas.
    const dasar = regu.sudah_finish && regu.jam_datang
      ? new Date(regu.jam_datang) : new Date();
    // Setengah jam yang sedang diketik ("07" menuju "07:15") bukan jam, dan
    // menghitung dampak dari angka setengah jadi membuat lencananya
    // berkedip-kedip menampilkan penalti yang tidak pernah berlaku.
    const isi = inpJam.nilai();
    const jamIsi = isi ? jamPadaHari(isi, regu.target_datang) : dasar;
    const pDasar = hitungPenalti(dasar, regu.target_datang);
    const pIsi = hitungPenalti(jamIsi, regu.target_datang);
    const tulis = (n) => n === 0 ? "0" : `−${n}`;

    if (!isi) {
      el.innerHTML = html`<span class="badge badge-gray">Penalti waktu: ${tulis(pDasar)}</span>`;
      return;
    }
    const beda = Math.round((jamIsi - dasar) / 60000);
    if (beda === 0) {
      el.innerHTML = html`<span class="badge badge-green">Sama dengan catatan — penalti ${tulis(pIsi)}</span>`;
      return;
    }
    const arah = beda > 0 ? `${beda} menit lebih lambat` : `${-beda} menit lebih awal`;
    el.innerHTML = pIsi === pDasar
      ? html`<span class="badge badge-green">${arah} — penalti tetap ${tulis(pIsi)}</span>`
      : html`<span class="badge badge-yellow">${arah} — penalti berubah ${tulis(pDasar)} → ${tulis(pIsi)}</span>`;
  };
  inpJam.dengar(perbaruiDampak);
  // Bentuknya dirapikan saat kotak ditinggalkan, jadi lencana dampaknya ikut
  // dihitung ulang sesudah itu — tanpa ini "745" yang jadi "07:45" saat blur
  // meninggalkan lencana menampilkan hitungan dari teks yang sudah tidak ada.


  const bersihkan = () => {
    regu = null;
    kotak.replaceChildren();
    tombol.disabled = true;
    // Jam & anggota TIDAK dikosongkan di sini: saat menyalin sederet catatan
    // kertas, operator sering mengetik jam lalu baru memperbaiki nomornya.
  };

  // Lookup otomatis sambil mengetik — jeda pendek supaya tidak memanggil
  // server di tiap ketukan, tapi tetap terasa seketika.
  inp.addEventListener("input", () => {
    clearTimeout(jeda);
    const dada = Number(inp.value.trim());
    // PENTING: begitu angkanya berubah, hasil lookup lama tidak boleh dipakai
    // lagi. Tanpa ini, operator yang mengetik nomor baru lalu langsung menekan
    // Enter akan menyimpan regu SEBELUMNYA — mencatat regu yang salah datang.
    // (Ditemukan saat menguji alur ketik-Enter.)
    if (!regu || regu.nomor_dada !== dada) {
      regu = null;
      tombol.disabled = true;
    }
    if (!dada) { bersihkan(); return; }
    jeda = setTimeout(() => cariDanTampilkan(dada), 160);
  });

  inp.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!tombol.disabled) tombol.click();
  });

  async function cariDanTampilkan(dada) {
    let r;
    try { r = await cariRegu(dada); }
    catch (e) { kotak.replaceChildren(h(kartuGalat(e.message))); return; }
    if (Number(inp.value.trim()) !== dada) return;   // operator sudah mengetik lagi

    if (!r) {
      regu = null; tombol.disabled = true;
      kotak.replaceChildren(h(kartuGalat(`Nomor ${esc(dada)} tidak dikenal.`)));
      return;
    }
    regu = r;

    // Keadaan yang menghalangi, ditampilkan jelas alih-alih jadi galat nanti.
    let halangan = null;
    if (!r.sudah_berangkat) halangan = `Kloter ${r.kloter} belum tercatat berangkat.`;
    else if (!r.sudah_ceklis) halangan = "Regu ini belum diceklis berangkat di staging.";

    kotak.replaceChildren(h(`
      ${kartuReguFinish(r)}
      ${r.sudah_finish ? `<div class="card" style="border-color:var(--kuning);background:var(--kuning-muda);margin-top:.5rem">
          <strong>Sudah tercatat datang ${esc(jamMenit(r.jam_datang))}.</strong>
        </div>` : ""}
      ${halangan ? kartuGalat(halangan) : ""}
    `));

    tombol.disabled = !!halangan;
    tombol.textContent = r.sudah_finish ? "✏️ PERBAIKI JAM DATANG" : "✅ SAMPAI DI FINISH";

    // Dua hal yang jarang dipakai disembunyikan supaya jalur cepat tetap dua
    // aksi: jumlah anggota (default 5) dan jam susulan dari kertas.
    // Regu yang sudah tercatat: tampilkan jam lamanya di kolom perbaikan,
    // supaya verifikasi terhadap kertas tinggal membandingkan lalu mengubah.
    if (r.sudah_finish && r.jam_datang) {
      inpJam.setNilai(jamMenit(r.jam_datang));
      inpHadir.value = r.anggota_hadir ?? 5;
    }
    perbaruiDampak();
  }

  tombol.addEventListener("click", async () => {
    if (!regu || tombol.dataset.jalan === "1") return;
    // Jaring kedua: yang disimpan HARUS regu yang nomornya sedang terlihat di
    // kotak isian, bukan sisa lookup sebelumnya.
    if (regu.nomor_dada !== Number(inp.value.trim())) {
      notif("Nomor berubah — tunggu detailnya muncul dulu.", true);
      return;
    }
    // Kolom jam susulan kosong = jalur cepat, itu keadaan normal. Tapi kolom
    // yang DIISI dan tidak terbaca sebagai jam harus menghentikan langkah,
    // bukan diam-diam dilewati: petugas mengetiknya justru karena jam tombol
    // salah, dan menyimpan jam tombol setelah ia mengetik yang lain adalah
    // membuang koreksi yang sedang dia kerjakan.
    const jamIsi = inpJam.kosong() ? null : inpJam.nilai();
    if (!inpJam.kosong() && !jamIsi) {
      inpJam.salah(true);
      inpJam.fokus();
      notif("Jam datang belum lengkap atau di luar 00:00–23:59. "
            + "Kosongkan untuk memakai jam saat tombol ditekan.", true);
      return;
    }
    tombol.dataset.jalan = "1"; tombol.disabled = true;

    // Jam dikunci DI SINI — saat tombol ditekan, dari jam laptop panitia.
    // Kolom jam hanya dipakai bila memang diisi (koreksi hasil verifikasi).
    const jam = jamIsi ? jamPadaHari(jamIsi, regu.target_datang) : new Date();
    const hadir = Math.max(0, Math.min(5, Number(inpHadir.value) || 0));
    const dada = regu.nomor_dada;
    const nama = regu.nama_regu;
    try {
      await catatFinish(dada, jam.toISOString(), hadir, null);
    } catch (err) {
      notif(err.message, true);
      tombol.dataset.jalan = ""; tombol.disabled = false;
      return;
    }
    catatTerakhir("finish", dada3(dada),
      `${nama} — ${jamMenit(jam)}${hadir < 5 ? ` · ${hadir} anggota` : ""}`);
    tombol.dataset.jalan = "";
    inp.value = ""; inpJam.setNilai(""); inpHadir.value = "5";
    bersihkan(); inp.focus();
    gambarRiwayat();
    notif(`${dada3(dada)} tercatat ${jamMenit(jam)}.`);
  });

  function gambarRiwayat() {
    const daftar = terakhir.finish || [];
    document.getElementById("riwayat-finish").replaceChildren(h(
      daftar.length ? `
        <div class="card">
          <h2 style="font-size:1rem;color:var(--tinta-lembut)">
            Baru saja tercatat (${daftar.length})</h2>
          <table class="table">${daftar.slice(0, 12).map(b => html`
            <tr><td class="angka">${b.apa}</td><td>${b.detail}</td></tr>`).join("")}
          </table>
        </div>` : ""));
  }
}

function kartuReguFinish(r) {
  /* Regu yang SUDAH tercatat diukur dari jam datangnya, bukan dari jam
     sekarang. Angka pada regu yang sudah pulang tidak boleh bergerak lagi —
     versi sebelumnya membandingkan Date.now() dengan target, jadi lencana
     yang sama menampilkan angka berbeda setiap kali layarnya dibuka, dan
     enam bulan sebelum acara ia berbunyi "−271874 menit dari target".

     Untuk regu yang belum pulang, jam sekarang memang pembandingnya: yang
     ditanya petugas adalah "sudah lewat berapa menit dari targetnya". */
  const acuan = r.sudah_finish && r.jam_datang
    ? new Date(r.jam_datang).getTime() : Date.now();
  const selisih = r.target_datang
    ? Math.round((acuan - new Date(r.target_datang).getTime()) / 60000)
    : null;
  const tandaWaktu = selisih === null ? ""
    : `<span class="badge ${Math.abs(selisih) < 10 ? "badge-green" : "badge-yellow"}">
         ${selisih > 0 ? `+${selisih}` : selisih} menit dari target</span>`;
  return `
    <div class="card card-identity" style="margin:0">
      ${html`<div class="nama">${dada3(r.nomor_dada)} · ${r.nama_regu}</div>
      <div class="detail">${r.nama_sekolah} · ${GOLONGAN_LABEL[r.golongan] || r.golongan}</div>
      <div class="detail">Kloter ${r.kloter} · berangkat ${jamMenit(r.jam_berangkat)}${
        r.target_datang ? ` · target ${jamMenit(r.target_datang)}` : ""}</div>`}
      <div style="margin-top:.4rem">${tandaWaktu}
        ${r.sisipan ? `<span class="badge badge-red">sisipan</span>` : ""}</div>
    </div>`;
}

/* ============================ INPUT POS ================================== */

/** Pos yang sedang dibuka admin. Operator pos tidak memakainya — posnya
 *  melekat di akun dan tidak bisa dipindah dari layar. */
const posDipilih = { nomor: null };

const judulPos = (p) => p
  ? (p.bayangan ? `Pos Bayangan — ${p.name}` : `Pos ${p.nomor} — ${p.name}`)
  : "Pos";

/** Angka dari database datang sebagai teks ("6.00"). Yang muncul di kotak
 *  isian harus persis seperti yang diketik petugas: 6, bukan 6.00. */
const angkaRapi = (v) =>
  v === null || v === undefined || v === "" ? "" : String(Number(v));

/** Kotak isian satu komponen. BENTUKNYA DITENTUKAN KONFIGURASI, bukan ditulis
 *  per pos di sini — itu sebabnya tabel ini bisa mengikuti lembar mana pun
 *  tanpa menyentuh JavaScript:
 *
 *    form=biner        -> satu centang        (kolom "Kompas (v)")
 *    satuan=detik      -> Menit : Detik       (kolom "Menit | Detik" di Pos 4)
 *    benar_kurang_salah-> Benar / Salah
 *    sisanya           -> satu kotak angka, batasnya dari rentang wajar
 */
function selKomponen(k, nilai) {
  const n1 = nilai ? nilai.nilai_1 : null;
  const n2 = nilai ? nilai.nilai_2 : null;
  const kode = esc(k.kode);

  /* KOTAK KOSONG YANG MENYEBUT DIRINYA KOSONG — tapi hanya di tempat yang
     membutuhkannya.

     Di hampir semua lomba, kosong dan 0 berujung sama: nol kata benar dan
     belum dinilai sama-sama menyumbang 0 poin, jadi menandai kotak kosong
     tidak menjawab pertanyaan siapa pun — ia cuma menambah 38 garis kecil di
     tabel yang sudah penuh.

     Menaksir kebalikannya. Yang ditulis SELISIH, jadi 0 berarti taksirannya
     tepat dan bernilai 100 — nilai tertinggi — sementara kotak kosong berarti
     tidak dinilai dan bernilai 0. Di sanalah satu garis kecil sepadan.

     Penandanya ikut `petunjuk`, bukan daftar kode di dalam kode ini. Komponen
     yang sampai butuh keterangan sendiri adalah persis komponen yang kotak
     kosongnya perlu bicara — dan kalau tahun depan ada lomba lain yang diberi
     `petunjuk`, ia mendapat garis itu juga. Itu perilaku yang dimaksud, bukan
     kejutan. */
  const kosongTampak = k.petunjuk ? ` placeholder="–"` : "";

  if (k.form === "biner") {
    return `<input type="checkbox" class="checkbox" data-kode="${kode}"
                   ${Number(n1) > 0 ? "checked" : ""}
                   aria-label="${esc(k.name)}">`;
  }
  if (k.satuan === "detik") {
    // SATU kotak, dan bertipe text — bukan number — karena isinya boleh
    // memuat titik dua. inputmode="numeric" tetap memanggil papan angka di HP,
    // jadi yang hilang cuma tombol panah naik-turun yang memang tidak pernah
    // dipakai untuk mencatat waktu.
    return `<input type="text" class="small-input input-waktu" inputmode="numeric"
                   data-kode="${kode}" value="${esc(detikTeks(n1))}"${kosongTampak}
                   aria-label="${esc(k.name)} — detik, atau menit:detik">`;
  }
  if (k.form === "benar_kurang_salah") {
    return `<span class="pos-pasangan">
      <input type="number" class="small-input" inputmode="numeric" step="1" min="0"
             data-kode="${kode}" data-slot="benar" value="${esc(angkaRapi(n1))}"
             aria-label="${esc(k.name)} — jumlah benar">
      <span class="pos-pemisah" aria-hidden="true">/</span>
      <input type="number" class="small-input" inputmode="numeric" step="1" min="0"
             data-kode="${kode}" data-slot="salah" value="${esc(angkaRapi(n2))}"
             aria-label="${esc(k.name)} — jumlah salah">
    </span>`;
  }
  // Sengaja placeholder, bukan nilai tersimpan. Menyimpan keadaan ketiga
  // bernama "–" akan memaksa setiap tempat yang membaca angka ini menebak
  // maksudnya, padahal database hanya punya dua: ada barisnya, atau tidak.
  // step="1" + inputmode="numeric", BUKAN step="any" + inputmode="decimal".
  // Nilai mentah tidak pernah pecahan (migrasi 0059), dan kotak yang
  // memanggil papan angka bertitik desimal adalah undangan mengetik koma.
  // Ini cuma membuatnya sulit — yang benar-benar menolak adalah constraint
  // nilai_mentah_bulat, karena import massal dan tempel dari spreadsheet
  // tidak lewat kotak ini sama sekali.
  return `<input type="number" class="small-input" inputmode="numeric" step="1"
                 min="${esc(k.rentang_mentah_min)}" max="${esc(k.rentang_mentah_maks)}"
                 data-kode="${kode}" value="${esc(angkaRapi(n1))}"${kosongTampak}
                 aria-label="${esc(k.name)}">`;
}

/** Keterangan kecil di bawah judul kolom — rentang yang boleh diketik,
 *  diambil dari konfigurasi supaya tidak pernah berbeda dengan yang divalidasi
 *  server. Persis angka yang tercetak di judul kolom lembar kertas. */
function petunjukKolom(k) {
  // Keterangan dari konfigurasi selalu menang. Untuk sebagian besar komponen
  // rentangnya sudah menjelaskan segalanya — "0 – 5 kata benar" tidak butuh
  // kalimat. Tapi Menaksir menulis SELISIH, bukan nilai, dan rentangnya justru
  // menyesatkan; kolom `petunjuk` (0037) ada untuk kasus seperti itu.
  if (k.petunjuk) return k.petunjuk;
  if (k.form === "biner") return "centang bila benar";
  // "detik" saja. Sebelumnya "detik, atau m:dd" — dan bentuk kedua itu tidak
  // pernah diminta siapa pun, cuma ditawarkan. Menawarkan dua format untuk
  // satu angka pada kertas yang diisi tergesa di pos adalah cara sebagian
  // petugas menulis 1:45 dan sebagian menulis 105 untuk waktu yang sama.
  // detikSah() memang masih menerima m:dd bagi yang terlanjur hafal; yang
  // dibuang cuma tawarannya.
  if (k.satuan === "detik") return "detik";
  if (k.form === "benar_kurang_salah") return "benar / salah";
  if (k.form === "benar_per_total") return `0 – ${angkaRapi(k.total_soal)}`;
  return `${angkaRapi(k.rentang_mentah_min)} – ${angkaRapi(k.rentang_mentah_maks)}`;
}

/** Isi kotak yang tidak bisa dibaca sebagai angka/waktu. Sengaja BUKAN null:
 *  null berarti "kotak kosong", dan jalur simpan menerjemahkan itu jadi
 *  perintah MENGHAPUS nilai yang sudah tersimpan. */
const TIDAK_SAH = Symbol("tidak sah");

/** Membaca satu komponen dari barisnya. null = kotaknya kosong, artinya
 *  komponen ini BELUM dinilai — bukan "dinilai nol".
 *
 *  Centang adalah pengecualian, dan sengaja: sebuah kotak centang tidak punya
 *  keadaan kosong, hanya dicentang atau tidak. Jadi aturannya "menyimpan satu
 *  baris berarti mengesahkan seluruh isinya" — centang yang dibiarkan kosong
 *  di baris yang disimpan berarti benar-benar tidak kena, dan tersimpan
 *  sebagai 0. Baris yang tidak disentuh tidak pernah dikirim sama sekali,
 *  jadi tidak ada regu yang mendadak "dinilai nol" karena tetangganya diisi. */
function bacaSel(tr, k) {
  const kotak = tr.querySelectorAll(`[data-kode="${CSS.escape(k.kode)}"]`);
  if (k.form === "biner") return { nilai_1: kotak[0].checked ? 1 : 0, nilai_2: null };

  if (k.satuan === "detik") {
    // TIGA keadaan, bukan dua. Kotak kosong dan kotak berisi "1:75" tidak
    // boleh diperlakukan sama, dan dulu keduanya sama-sama mengembalikan null.
    //
    // Akibatnya senyap dan merusak: jalur simpan membaca null sebagai "kotak
    // dikosongkan", jadi nilai yang SUDAH tersimpan di database ikut DIHAPUS —
    // lalu barisnya tetap mendapat centang hijau. Petugas salah ketik satu
    // huruf dan kehilangan angka yang sudah benar, tanpa satu pun tanda.
    if (!kotak[0].value.trim()) return null;
    const detik = detikSah(kotak[0].value);
    return detik === null ? TIDAK_SAH : { nilai_1: detik, nilai_2: null };
  }
  if (k.form === "benar_kurang_salah") {
    const b = kotak[0].value.trim(), sa = kotak[1].value.trim();
    if (b === "") return null;
    return { nilai_1: Number(b), nilai_2: sa === "" ? null : Number(sa) };
  }
  const v = kotak[0].value.trim();
  return v === "" ? null : { nilai_1: Number(v), nilai_2: null };
}

/** SATU LOMBA BISA PUNYA BEBERAPA BARIS `wahana`, DAN TETAP SATU KOLOM.
 *
 *  Tebak Simpul punya empat baris — satu per golongan — karena skalanya
 *  berbeda: Penggalang menebak 5 simpul, Penegak 10 (0030). Di layar itu tetap
 *  satu kolom, karena tiap regu hanya berhak mengisi variannya sendiri.
 *
 *  Sebelum ini layar menggambar satu kolom per BARIS wahana, jadi Pos 1 punya
 *  empat kolom bernama "Tebak Simpul" tanpa satu pun penanda golongan.
 *  Akibatnya dua-duanya buruk sekaligus: petugas mengetik di kolom yang salah
 *  lalu ditolak server, dan tidak ada regu yang bisa dihitung "lengkap" —
 *  siapa pun hanya bisa mengisi tiga dari enam kotak, jadi angka di atas tabel
 *  membeku di "0/46 lengkap" selamanya.
 *
 *  Aturan pengelompokannya dibuat sesederhana mungkin: komponen BERGOLONGAN
 *  dengan nama sama jadi satu kolom, komponen tanpa golongan berdiri sendiri.
 *  Tidak ada kolom penanda grup di database yang harus diisi benar — dua baris
 *  yang panitia beri nama sama memang dimaksudkan sebagai satu lomba. */
function kolomPos(komponen) {
  const urut = [], peta = new Map();
  for (const k of komponen) {
    const kunci = k.golongan ? `nama:${k.name}` : `kode:${k.kode}`;
    if (!peta.has(kunci)) {
      peta.set(kunci, { nama: k.name, varian: [] });
      urut.push(peta.get(kunci));
    }
    peta.get(kunci).varian.push(k);
  }
  for (const kol of urut) {
    // Rentang yang berbeda digabung jadi "0 – 5 / 0 – 10". Kotak di tiap baris
    // tetap dibatasi min/max variannya sendiri, jadi baris ini keterangan —
    // bukan aturan yang bisa berbeda pendapat dengan server.
    kol.petunjuk = [...new Set(kol.varian.map(petunjukKolom))].join(" / ");
  }
  return urut;
}

/** Varian yang berhak diisi regu bergolongan ini — cerminan persis
 *  `komponen_berlaku()` di database. Kalau keduanya berbeda pendapat, yang
 *  menang server, dan petugas menatap penolakan yang tidak bisa ia perbaiki.
 *
 *  null = kolom ini memang bukan untuk golongannya. Itu keadaan sah, bukan
 *  konfigurasi rusak: Tebak Simpul Penegak tidak ada urusannya dengan regu
 *  Penggalang. */
/** Kolom layar dikelompokkan jadi LOMBA — tingkat ketiga yang tidak dimiliki
 *  `wahana` sampai migrasi 0054 (CLAUDE.md bagian 11).
 *
 *  Kolom di layar tetap satu per PENILAIAN: Pembidaian lima kolom. Blangko
 *  tetap satu per LOMBA: Pembidaian selembar dengan lima kotak. Keduanya
 *  benar, dan yang satu tidak boleh "diperbaiki" mengikuti yang lain — 11.6.
 *
 *  `lomba` kosong berarti komponen itu lomba tersendiri, keadaan yang benar
 *  untuk sebagian besar baris. */
function kelompokLomba(kolom) {
  const urut = [], peta = new Map();
  for (const kol of kolom) {
    const nama = kol.varian[0].lomba || kol.nama;
    if (!peta.has(nama)) {
      peta.set(nama, { nama, kolom: [] });
      urut.push(peta.get(nama));
    }
    peta.get(nama).kolom.push(kol);
  }
  return urut;
}

const varianUntuk = (kol, golongan) =>
  kol.varian.find(k => !k.golongan || k.golongan === golongan) || null;

/** Kolom KERTAS untuk satu kolom layar. Sebagian memakan dua kolom, dan
 *  pembagiannya sama persis dengan kotak di layar — supaya petugas yang
 *  menyalin dari kertas ke layar menemukan urutan yang sama, tidak perlu
 *  mencocokkan apa pun di kepalanya. */
const kolomCetakPos = (kolom) => kolom.flatMap(kol => {
  // Bentuk isian sama untuk semua varian satu lomba — yang berbeda antar
  // golongan hanya skalanya, bukan cara menulisnya.
  const k = kol.varian[0];
  // Waktu memakan SATU petak di kertas juga. Dua petak Menit|Detik memaksa
  // petugas memecah angka stopwatch sebelum menuliskannya; satu petak
  // menerima "32" maupun "1:10" apa adanya, persis seperti kotak di layar.
  if (k.satuan === "detik") return [{ nama: kol.nama, petunjuk: kol.petunjuk }];
  if (k.form === "benar_kurang_salah") return [
    { nama: kol.nama, petunjuk: "benar" }, { nama: "", petunjuk: "salah" }];
  return [{ nama: kol.nama, petunjuk: kol.petunjuk }];
});

/** Lembar nilai untuk DITULIS TANGAN di pos (alur-lomba.md 8.8).
 *
 *  Identitas regu sudah tercetak, kolom nilainya kosong. Satu hal yang
 *  sengaja TIDAK ada di kertas ini: kolom Nilai Pos. Petugas lapangan hanya
 *  mencatat data mentah dan tidak pernah menghitung poin (alur-lomba.md 8.1)
 *  — menyediakan kotak berjudul "Nilai Pos" justru mengundang mereka
 *  menjumlahkan sendiri, dan angka hasil hitungan tangan yang berbeda dengan
 *  angka sistem adalah sengketa yang tidak perlu ada.
 *
 *  Nama pos ikut di dalam <thead>, bukan hanya di judul halaman pertama.
 *  Kertas ini beredar sebagai lembaran lepas yang berpindah tangan lewat
 *  foto; halaman yang tidak menyebutkan posnya sendiri bisa dinilaikan ke
 *  pos yang salah. Browser mengulang <thead> di tiap halaman, jadi itu
 *  gratis. */
/** Regu per lembar A4 landscape. Dipatok, bukan diserahkan ke pemenggalan
 *  otomatis browser: dengan 300 regu, halaman yang dipenggal sendiri bisa
 *  memotong satu baris di tengah, dan angka pastinya juga yang menentukan
 *  berapa lembar harus difotokopi.
 *
 *  30 pada huruf 12pt hanya mungkin setelah tinggi barisnya ditekan ke
 *  4,8mm — yang kebetulan persis tinggi baris bawaan Excel. Tiga hal yang
 *  menentukannya, dan ketiganya ditemukan dengan MENGUKUR, bukan menalar:
 *
 *    1. line-height, bukan tinggi kotak isian. Pada nilai bawaan (1,6) satu
 *       baris setinggi 32px meski kotaknya diminta 6mm.
 *    2. Sel TERTINGGI yang menang. Nomor dada sempat 14pt dan dialah yang
 *       menaikkan seluruh baris jadi 21px sementara sel 12pt lain cuma butuh
 *       18px — selisih 3px dikali 30 baris persis yang membuat halaman
 *       tumpah.
 *    3. Lebar. Di 12pt tabel Pos 1 selebar 201mm, sedangkan A4 potret hanya
 *       menyediakan 180mm; karena itu lembar ini landscape.
 *
 *  Sisa ruang setelah semuanya: 10-21mm per halaman, tergantung pos. */
// 40, naik dari 30. Diukur — bukan ditaksir — pada A4 melintang:
//
//   tinggi tersedia (margin atas-bawah 6mm)   198,00mm
//   judul + kepala + thead + catatan           17,57mm
//   sisa untuk baris                          180,43mm
//   tinggi satu baris (nomor dada 11pt)         4,45mm
//   -> 40 baris, sisa 2,35mm
//
// Empat langkah membawanya dari 30 ke 40, dan HANYA YANG TERAKHIR
// mengecilkan huruf:
//
//   padding vertikal sel   0,5pt -> 0,25pt
//   margin halaman         10mm -> 6mm atas-bawah
//   jarak baris kepala     1,2  -> 1,1
//   nomor dada             12pt -> 11pt        <- ini yang membeli 38-40
//
// Sel isian KOSONG tidak punya line box, jadi tingginya cuma padding +
// garis. Yang mengangkat tinggi baris adalah sel berisi yang paling besar,
// dan itu nomor dada — karena itu ia satu-satunya huruf yang berpengaruh.
//
// Lembar cadangan dicetak untuk SELURUH nomor dada termasuk yang belum
// terdaftar — 510 baris. Jadi 17 lembar turun ke 13.
//
// Kalau 11pt ternyata terlalu kecil dibaca ulang dari FOTO lembar,
// kembalikan ke 12pt di style.css dan angka ini ke 37.
const REGU_PER_LEMBAR = 40;

function siapkanCetakLembarPos(pos, kolomLayar, baris) {
  document.getElementById("cetakan")?.remove();
  const set = [{ judul: null, kolom: kolomCetakPos(kolomLayar) }];
  const judul = pos.bayangan ? `POS BAYANGAN — ${pos.name}`
                             : `POS ${pos.nomor} — ${pos.name}`;
  const tanggal = tanggalPanjang(new Date());

  const halaman = [];
  for (let i = 0; i < baris.length; i += REGU_PER_LEMBAR) {
    halaman.push(baris.slice(i, i + REGU_PER_LEMBAR));
  }

  // Sel identitas lewat tag html`` (isinya diketik orang luar); kotak kosong
  // ditempel sebagai HTML biasa karena memang tidak ada isinya.
  // Nomor yang belum ada regunya di sistem tetap mendapat barisnya, dan
  // identitasnya dibiarkan KOSONG — bukan ditandai "tidak dipakai".
  //
  // Dua jalan menuju baris kosong, dan keduanya nyata. Sebagian sekolah
  // mendaftar OFFLINE, jadi regunya memakai nomor dada fisik tanpa pernah
  // masuk sistem sampai daftar ulang menyusulkan datanya. Dan kertas ini
  // DICETAK LEBIH DULU, sebelum pendaftaran ditutup — regu yang menyusul
  // sesudahnya tetap harus punya tempat.
  // Barisnya harus bisa DITULISI: petugas mengisi nama regu dan sekolahnya di
  // tempat itu, dan meja daftar ulang memakainya untuk melengkapi data
  // belakangan. Garis "tidak dipakai" akan membuat petugas mencari tempat
  // lain — biasanya pinggir kertas, tempat tidak ada yang mencarinya.
  const barisHtml = (kolom) => (r) => r.kosong ? `
    <tr>
      ${html`<td class="dada">${dada3(r.nomor_dada)}</td>`}
      <td></td><td></td><td></td>
      ${kolom.map(() => `<td class="isian"></td>`).join("")}
    </tr>` : `
    <tr>
      ${html`<td class="dada">${dada3(r.nomor_dada)}</td>
      <td>${r.nama_regu}</td>
      <td>${r.nama_sekolah}</td>
      <td>${GOLONGAN_SINGKAT[r.golongan] || r.golongan}</td>`}
      ${kolom.map(() => `<td class="isian"></td>`).join("")}
    </tr>`;

  // Tiap lembar berdiri sendiri: judul pos, nomor halaman, dan baris tanda
  // tangannya sendiri. Kertas ini beredar sebagai lembaran lepas yang
  // berpindah tangan lewat foto — halaman yang tidak menyebutkan posnya
  // sendiri bisa dinilaikan ke pos yang salah. Di mode per lomba nama
  // lombanya ikut, karena sekarang beredar beberapa lembar berbeda dari pos
  // yang sama sekaligus, dan "Pos 1 halaman 2/2" ada tiga.
  const lembar = set.map(({ judul: judulLomba, kolom }) =>
    halaman.map((grup, i) => `
    <section class="print-page lembar-pos">
      <h1>LEMBAR CADANGAN · ${esc(judul)}${judulLomba ? ` · ${esc(judulLomba)}` : ""}
          · Halaman ${i + 1}/${halaman.length}</h1>
      <p class="lembar-kepala">${esc(EDISI ? EDISI.name : "")} · ${esc(tanggal)} ·
         dada ${esc(dada3(grup[0].nomor_dada))}–${esc(dada3(grup[grup.length - 1].nomor_dada))}
         · Petugas: ______________ · Diperiksa: ______________</p>
      <table class="print-table">
        <thead>
          <tr>
            <!-- "Gol.", bukan "Golongan": judulnyalah yang melebarkan
                 kolom ini, bukan isinya. "GOLONGAN" di 8pt butuh ~17mm
                 sementara "Pgl Pi" di 10pt cuma ~13mm, dan selisihnya
                 diambil dari kolom Organisasi yang justru terpotong. -->
            <th>No Dada</th><th>Nama Regu</th><th>Organisasi</th><th>Gol.</th>
            ${kolom.map(c => `<th class="isian">${esc(c.nama)}
              <span class="kolom-petunjuk">${esc(c.petunjuk)}</span></th>`).join("")}
          </tr>
        </thead>
        <tbody>${grup.map(barisHtml(kolom)).join("")}</tbody>
      </table>
      ${i === 0 ? `<p class="print-note">Tulis data mentahnya apa adanya, JANGAN
         menjumlahkan sendiri. Baris tanpa nama = regu yang belum terdaftar;
         tulis nama regu dan sekolahnya di situ.</p>` : ""}
    </section>`).join("")).join("");

  document.body.appendChild(h(`<div id="cetakan" class="printout">${lembar}</div>`));
}

/** Judul besar di atas kotak isian: APA yang harus ditulis di sana.
 *
 *  Konfigurasi menang. Empat dari lima bentuk penilaian bisa diterjemahkan
 *  sendiri, karena bentuknya menentukan artinya — `satuan = detik` selalu
 *  berarti waktu, `besar_baik` selalu berarti jumlah benar.
 *
 *  `bertingkat` tidak bisa. Ia cuma tangga angka, dan angkanya bisa detik,
 *  meter, selisih, atau apa pun yang panitia putuskan tahun itu. Menebaknya
 *  pernah menghasilkan "Hasil ukur" untuk Menaksir — kata yang membaca seperti
 *  perintah menulis jarak TERUKUR, padahal yang diminta SELISIH-nya. Kalau
 *  petugas menulis 12 alih-alih 2, tangga Menaksir habis di atas 4 meter dan
 *  hampir setiap regu mendapat 0, tanpa satu galat pun.
 *
 *  Jadi bentuk itu membawa judulnya sendiri lewat `judul_isian` (0039), dan
 *  cadangannya sengaja tidak menjanjikan apa-apa. */
function judulIsian(k) {
  if (k.judul_isian) return k.judul_isian;
  if (k.satuan === "detik") return "Waktu tempuh";
  if (k.form === "biner") return "Kena / tidak";
  if (k.form === "benar_kurang_salah") return "Benar dan salah";
  if (k.form === "bertingkat") return "Data mentah";
  return "Jumlah benar";
}

/** Keterangan di bawah judul: rentang yang boleh ditulis, dan untuk waktu satu
 *  contoh nyata. Contoh itu bukan hiasan — ia mencegah seluruh kelas kesalahan
 *  yang tidak bisa dicegah kalimat mana pun: petugas yang menulis "0:47" di
 *  kotak berlabel DETIK, atau menulis poin alih-alih data mentah.
 *
 *  Menerima KOLOM, bukan komponen tunggal, dan itu yang penting. Satu blangko
 *  dipakai regu golongan mana pun, sementara Tebak Simpul punya dua skala —
 *  5 simpul untuk Penggalang, 10 untuk Penegak. Mengambil rentang dari varian
 *  pertama saja akan mencetak "0 – 10" di kertas yang separuhnya dipegang regu
 *  Penggalang: bukan sekadar kurang lengkap, tapi salah.
 *
 *  `kol.petunjuk` sudah menggabungkan rentang yang berbeda jadi
 *  "0 – 10 / 0 – 5", sama persis dengan yang tercetak di form tabel. Keduanya
 *  benar, tergantung golongan, dan petugas lomba itu tahu yang mana. */
function contohIsian(kol) {
  const k = kol.varian[0];
  if (k.satuan === "detik") return "dalam DETIK · contoh: 47";
  if (k.form === "biner") return "centang bila kena";
  // Keterangan yang ditulis panitia sendiri dipakai apa adanya — ia sudah
  // berupa kalimat, bukan rentang yang perlu diberi kata "angka".
  if (k.petunjuk) return kol.petunjuk;
  return `angka ${kol.petunjuk}`;
}

/** FORM PER LOMBA — BLANGKO KOSONG, satu lembar untuk satu regu di satu lomba
 *  (alur-lomba.md 8.3).
 *
 *  KENAPA KOSONG, PADAHAL SISTEM TAHU SEMUA NAMA REGUNYA.
 *
 *  Karena regu datang ke pos dalam urutan ACAK. Kloter berangkat berurutan,
 *  tetapi rute, kecepatan, dan antrean membuat siapa yang muncul berikutnya
 *  tidak bisa ditebak. Kalau tiap kertas sudah tercetak identitasnya, petugas
 *  harus MENCARI kertas nomor 005 di tumpukan berisi ratusan lembar setiap
 *  kali satu regu masuk — pekerjaan yang lebih lama daripada lombanya sendiri,
 *  dilakukan sambil regu menunggu.
 *
 *  Jadi semua kertas identik, dan petugas menulis "005" di kotak paling kiri
 *  atas. Yang dicetak sistem bukan datanya, melainkan BENTUKNYA: nama lomba,
 *  satuan yang benar, contoh angkanya, dan tempat tanda tangan.
 *
 *  YANG DITULIS TANGAN HANYA NOMOR DADA.
 *
 *  Tidak ada kolom nama regu, sekolah, atau golongan — dan itu keputusan,
 *  bukan kelalaian. Ketiganya sudah ditentukan oleh nomor dada, jadi
 *  menuliskannya berarti menyalin ~30 huruf sebanyak 1.500 kali untuk
 *  informasi yang sudah dimiliki sistem. Di pos yang sedang mengantre, itu
 *  pekerjaan yang memakan waktu lomba itu sendiri.
 *
 *  Lebih buruk lagi: kolom yang terlalu mahal untuk diisi AKAN dikosongkan,
 *  dan kolom kosong yang bernama "konfirmasi" adalah pengaman palsu — ia
 *  membuat orang merasa ada pengecekan padahal tidak ada.
 *
 *  Pengecekannya memang ada, tapi bukan di kertas. Saat tim IT mengetik 005,
 *  baris di layar Input Pos langsung menampilkan nama regu, sekolahnya, dan
 *  golongannya. Salah ketik ketahuan di sana — tanpa satu huruf pun ditulis
 *  di lapangan.
 *
 *  Satu baris kecil tetap disediakan untuk keadaan yang benar-benar
 *  membutuhkan tulisan: nomor dadanya TIDAK TERBACA — robek, tertutup jaket,
 *  atau petugas ragu antara 6 dan 8. Tanpa tempatnya, catatan itu tetap
 *  ditulis, hanya saja di pinggir kertas tempat tidak ada yang mencarinya.
 */
function siapkanCetakBlangko(pos, kolomLayar) {
  document.getElementById("cetakan")?.remove();

  const judulPos = pos.bayangan ? pos.name : `Pos ${pos.nomor} · ${pos.name}`;

  const satuBlangko = (lomba) => {
    const kols = lomba.kolom;
    // Varian mana pun boleh dipakai untuk menurunkan bentuknya: yang berbeda
    // antar golongan hanya skalanya, dan skala tidak dicetak di blangko —
    // justru itu gunanya. Petugas menulis jumlah benar apa adanya, dan sistem
    // yang tahu 5 simpul untuk Penggalang, 10 untuk Penegak.
    return `
    <article class="blangko">
      <p class="bl-pos">${esc(judulPos)}</p>
      <h2 class="bl-lomba">${esc(lomba.nama)}</h2>
      <p class="bl-acara">${esc(EDISI ? EDISI.name : "")} · Petugas: ____________</p>

      <table class="bl-identitas"><tbody>
        <tr>
          <td class="bl-dada"><span class="bl-label">No Dada</span></td>
          <td class="bl-catat"><span class="bl-label">Regu / sekolah</span></td>
        </tr>
      </tbody></table>

      <div class="bl-nilai${kols.length > 1 ? " bl-nilai-banyak" : ""}">
        ${kols.map(kol => `
        <div class="bl-nilai-sel">
          <div class="bl-nilai-kepala">
            <span class="bl-nilai-judul">${esc(kols.length > 1
              ? kol.nama : judulIsian(kol.varian[0]))}</span>
            <span class="bl-nilai-contoh">${esc(contohIsian(kol))}</span>
          </div>
          <div class="bl-nilai-kotak"></div>
        </div>`).join("")}
      </div>

      <p class="bl-catatan"><strong>Tulis angkanya saja — jangan menghitung
         poin.</strong></p>
      <p class="bl-ttd">Petugas ${esc(lomba.nama)}</p>
      <p class="bl-garis"></p>
    </article>`;
  };

  // SATU HALAMAN A5 MELINTANG PER LOMBA, bukan sebanyak jumlah regu.
  //
  // Yang dicetak dari sini adalah MASTER, bukan tumpukannya. Blangko
  // diperbanyak dengan mesin fotokopi — 500 regu di pos berisi tiga lomba
  // membutuhkan 1.500 lembar, dan mencetak sebanyak itu lewat browser berarti
  // menghabiskan satu toner printer kantor untuk pekerjaan yang diselesaikan
  // mesin fotokopi dalam beberapa menit.
  //
  // Jadi keluarannya tiga halaman untuk Pos 1: Semaphore, Tebak Simpul,
  // Menaksir. Panitia menggandakan tiap halaman sebanyak yang dibutuhkan, dan
  // tiap tumpukan otomatis berisi satu lomba saja.
  const daftarLomba = kelompokLomba(kolomLayar);
  const cetakan = daftarLomba.map(l => `
    <section class="print-page blangko-halaman">${satuBlangko(l)}</section>`).join("");

  document.body.appendChild(h(`<div id="cetakan" class="printout">${cetakan}</div>`));
  return daftarLomba.length;
}

/** Layar Input Pos — lembar kertas yang dipindah ke layar.
 *
 *  Bentuknya sengaja SAMA dengan lembar Google Sheets yang dipakai panitia
 *  selama ini: identitas regu di kiri, satu kolom per hal yang dinilai, Nilai
 *  Pos di kanan. Petugas yang menyalin dari foto lembar tidak perlu belajar
 *  bentuk baru — matanya sudah tahu di mana harus mendarat.
 *
 *  Nilai Pos TIDAK dihitung di browser. Angkanya dibaca ulang dari database
 *  tiap kali satu baris tersimpan, supaya tidak pernah ada mesin skor kedua
 *  yang bisa berbeda pendapat dengan v_poin_pos — dan supaya angka yang
 *  dilihat petugas adalah angka yang benar-benar tersimpan, bukan tebakan
 *  layar tentang apa yang akan tersimpan.
 */
async function layarInputPos() {
  const s = sesi();
  if (!bolehLihat("pos")) {
    pasangKepala("Input Nilai Pos");
    LAYAR.replaceChildren(h(html`
      <div class="card">
        <h2>Akun meja, bukan akun pos</h2>
        <p class="description">Akun ${s.username} dipakai di meja. Input nilai
           pos memakai akun posnya sendiri — hubungi koordinator.</p>
      </div>`));
    return;
  }

  pasangKepala("Input Nilai Pos", "lembar");
  LAYAR.replaceChildren(h(pemuat()));

  const layarIni = location.hash;
  let semuaPos;
  try { semuaPos = await daftarPos(); }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarInputPos)); return; }
  if (location.hash !== layarIni) return;

  // Tidak semua pos dinilai. Pos 0 (Keberangkatan) dan Pos 5 (Kedatangan)
  // adalah garis start dan garis finish — yang dicatat di sana waktu, lewat
  // layar Keberangkatan dan Kedatangan. Admin dibuka di pos yang benar-benar
  // bisa diisi, bukan di pos pertama menurut nomor.
  const posDinilai = semuaPos.filter(p => Number(p.jumlah_komponen) > 0);

  // Operator pos tidak memilih apa pun — posnya sudah melekat di akunnya, dan
  // RLS akan menolak pos lain seandainya layar ini mencoba.
  const nomorPos = s.peran === "juri_pos"
    ? Number(s.pos)
    : (posDipilih.nomor
       ?? (posDinilai.length ? posDinilai[0].nomor
                             : (semuaPos.length ? semuaPos[0].nomor : null)));
  const pos = semuaPos.find(p => Number(p.nomor) === Number(nomorPos));

  if (!pos) {
    LAYAR.replaceChildren(h(kartuGalat(
      "Edisi ini belum punya pos sama sekali. Admin harus mengisinya dulu.")));
    return;
  }
  posDipilih.nomor = pos.nomor;
  pasangKepala(`Input ${judulPos(pos)}`, "lembar");

  let komponen, lembar;
  try {
    [komponen, lembar] = await Promise.all([
      komponenPos(EDISI.nomor, pos.nomor),
      lembarPos(pos.nomor),
    ]);
  } catch (e) {
    LAYAR.replaceChildren(kartuGagalMuat(e.message, layarInputPos)); return;
  }
  if (location.hash !== layarIni) return;

  if (!komponen.length) {
    // Dua sebab yang berbeda, dan layar tidak bisa membedakannya dari data:
    // pos yang MEMANG tidak dinilai, dan pos yang komponennya belum diisi.
    // Jadi keduanya disebut, alih-alih menuduh salah satunya.
    // Template BIASA, bukan tag html`` — pilihPosHtml sudah berupa HTML dan
    // akan tampil apa adanya sebagai teks kalau ikut di-escape. Nama pos
    // datang dari database, jadi ia lewat esc() sendiri.
    LAYAR.replaceChildren(h(`
      <div class="card">${pilihPosHtml(s, semuaPos)}</div>
      <div class="card">
        <h2>${esc(judulPos(pos))} tidak punya kolom penilaian</h2>
      </div>`));
    pasangPilihPos(s);
    return;
  }

  // Satu kolom per LOMBA, bukan per baris wahana. Tebak Simpul punya empat
  // baris (satu per golongan) dan tetap satu kolom — lihat kolomPos().
  const kolom = kolomPos(komponen);

  /** Komponen yang boleh diisi baris ini. Dipakai saat MENYIMPAN, bukan cuma
   *  saat menggambar: kotak milik golongan lain memang tidak ada di DOM, tapi
   *  memutar seluruh daftar komponen di sini akan membuat bacaSel() mencari
   *  kotak yang tidak pernah ada dan jatuh di `kotak[0].value`. */
  const komponenBaris = (tr) =>
    kolom.map(kol => varianUntuk(kol, tr.dataset.golongan)).filter(Boolean);

  // Cermin nilai yang ADA DI DATABASE, bukan yang ada di kotak isian. Yang
  // dikirim ke server hanya selisih antara keduanya — kotak yang tidak diubah
  // tidak pernah ditulis ulang, jadi kepengarangan nilai tidak bergeser dan
  // riwayat tidak dibanjiri baris yang tidak mengubah apa-apa.
  const asli = new Map(lembar.map(r => [Number(r.nomor_dada), r.nilai || {}]));

  LAYAR.replaceChildren(h(`
    <div class="card">
      ${alatTabel({
        kiri: pilihPosHtml(s, semuaPos),
        // Dua bentuk kertas, dan URUTANNYA menyatakan mana yang utama.
        // Form per lomba dipakai setiap hari lomba di setiap pos; form tabel
        // hanya kalau slipnya habis atau sinyal mati. Tombol cadangan yang
        // berdiri lebih dulu akan dipakai orang yang tidak tahu bedanya.
        //
        // Namanya memakai kosakata panitia persis — "form per lomba" dan
        // "form tabel" adalah kata yang mereka ucapkan sendiri, dan tombol
        // bernama lain memaksa penerjemahan di kepala setiap kali dipakai.
        kanan: `<button class="button button-secondary button-small" type="button"
                        id="cetak-per-lomba">🖨️ Form per Lomba</button>
                <button class="button button-secondary button-small" type="button"
                        id="cetak-lembar">🖨️ Form Tabel (cadangan)</button>`,
        // Pendek dengan sengaja: kartunya kini selebar tabel, dan petunjuk
        // panjang terpotong di tengah kata — yang justru lebih buruk daripada
        // petunjuk singkat, karena terlihat seperti layar yang rusak.
        cariContoh: "Cari nomor dada / regu / organisasi…",
        saringan: [
          { kode: "belum", label: "Belum lengkap" },
          { kode: "sudah", label: "Sudah lengkap" },
          { kode: "semua", label: "Semua" },
        ],
        saringAktif: "semua",
        jumlah: lembar.length,
      })}
      <!-- Pita keadaan simpan. Duduk DI ATAS tabel, bukan di bawahnya:
           tabelnya bergulir sendiri (max-height), jadi apa pun yang ditaruh
           di bawah bisa berada di luar layar justru saat petugas sedang
           mengetik di baris ke-80. -->
      <!-- SELALU terlihat, tidak pernah hidden. Pita yang hanya muncul saat
           ada masalah tidak bisa dipercaya: petugas tidak punya cara
           membedakan "semuanya aman" dari "pitanya sedang rusak". Google
           Sheets menampilkan capnya terus-menerus untuk alasan yang sama. -->
      <div id="pos-simpan" class="pos-simpan aman"></div>
      <!-- table-tetap: di HP lembar ini TETAP tabel dan digeser ke samping,
           tidak ditumpuk jadi kartu seperti layar meja. Alasannya di
           style.css, bagian LEMBAR INPUT POS. -->
      <div class="table-wrapper table-wrapper-tetap">
        <table class="table data-table table-tetap table-pos"
               ${lembar.length ? "" : "hidden"}>
          <thead>
            <tr>
              <th class="text-center">Nomor<br>Dada</th>
              <th>Nama Regu</th>
              <th>Organisasi</th>
              <th>Golongan</th>
              ${kolom.map(kol => `
                <th class="text-center">
                  <span class="kolom-nama">${esc(kol.nama)}</span>
                  <span class="kolom-petunjuk">${esc(kol.petunjuk)}</span></th>`).join("")}
              <th class="text-center">Nilai<br>${esc(pos.bayangan ? pos.name : `Pos ${pos.nomor}`)}</th>
              <th class="text-center"><span class="visually-hidden">Status simpan</span></th>
              <th class="text-center"><span class="visually-hidden">Foto</span></th>
              <th class="text-center"><span class="visually-hidden">Gembok</span></th>
            </tr>
          </thead>
          <tbody id="isi-tabel"></tbody>
        </table>
        ${lembar.length ? "" : `<p class="table-empty">Belum ada regu yang
          menerima nomor dada.</p>`}
      </div>
    </div>
  `));

  const tbody = document.getElementById("isi-tabel");
  tbody.replaceChildren(h(lembar.map(r => `
    <tr data-dada="${esc(r.nomor_dada)}" data-terisi="${esc(r.jumlah_terisi)}"
        data-golongan="${esc(r.golongan)}" data-komponen="${esc(r.jumlah_komponen)}"
        data-terkunci="${r.terkunci ? "1" : ""}">
      <td class="angka text-center" data-label="Nomor Dada">${esc(dada3(r.nomor_dada))}</td>
      <td data-label="Nama Regu"><strong>${esc(r.nama_regu)}</strong></td>
      <td data-label="Organisasi">${esc(r.nama_sekolah)}</td>
      <td data-label="Golongan">${esc(GOLONGAN_LABEL[r.golongan] || r.golongan)}</td>
      ${kolom.map(kol => {
        const k = varianUntuk(kol, r.golongan);
        // Sel mati, bukan kotak kosong. Kotak yang bisa diketik tapi selalu
        // ditolak adalah jebakan; garis pendek menjawab pertanyaannya sebelum
        // ditanya — kolom ini bukan untuk golongan regu ini.
        return `<td class="text-center" data-label="${esc(kol.nama)}">
          ${k ? selKomponen(k, (r.nilai || {})[k.kode])
              : `<span class="sel-mati" title="Bukan untuk ${esc(GOLONGAN_LABEL[r.golongan] || r.golongan)}">–</span>`}</td>`;
      }).join("")}
      <td class="text-center pos-nilai" data-label="Nilai Pos">${esc(angkaRapi(r.nilai_pos))}</td>
      <td class="pos-status" data-label=""></td>
      <td class="pos-foto text-center" data-label="">
        <button type="button" class="badge badge-tombol" data-foto
          title="Foto jawaban regu ini">${ikon("camera")}</button></td>
      <td class="pos-gembok" data-label=""></td>
    </tr>`).join("")));

  /* Kamera dipasang lewat satu pendengar di tbody, bukan satu per baris.
     Tombolnya digambar sekali di template dan tidak pernah digambar ulang —
     berbeda dengan gembok dan penanda simpan, yang berganti rupa mengikuti
     keadaan barisnya. Menempelkan ~300 pendengar untuk tombol yang tidak
     pernah berubah adalah ongkos yang tidak dibayar apa-apa. */
  tbody.addEventListener("click", (e) => {
    const b = e.target.closest("[data-foto]");
    if (b) bukaFoto(b.closest("tr"));
  });

  /* ---------- keadaan simpan per baris ----------

     Pertanyaan yang harus bisa dijawab layar ini sambil dilirik, tanpa
     menekan apa pun: "angka yang barusan saya ketik, sudah masuk database
     atau belum?" Di pos, internet putus adalah kejadian biasa — dan angka
     yang hanya ada di layar sama saja dengan angka yang tidak pernah dicatat.

     Empat keadaan, dan tidak ada baris yang boleh berada di luar keempatnya:

       (kosong)    belum ada nilai sama sekali
       belum       sudah diketik, BELUM sampai ke server
       menyimpan   sedang di jalan
       tersimpan   ✓ ada di database — ini yang dibaca ulang dari sana
       gagal       tidak sampai; tetap tersimpan di layar dan dicoba lagi

     Yang paling penting justru `belum`. Sebelumnya keadaan itu tidak ada:
     antara petugas mengetik dan meninggalkan kotaknya, layar diam saja —
     terlihat persis sama dengan baris yang sudah aman.                    */

  const statusBaris = (tr, keadaan, pesan) => {
    const sel = tr.querySelector(".pos-status");
    tr.dataset.keadaan = keadaan || "";
    tr.classList.toggle("baris-gagal", keadaan === "gagal");
    tr.classList.toggle("baris-belum", keadaan === "belum");

    if (keadaan === "belum") {
      sel.replaceChildren(h(`<span class="badge badge-yellow" title="Belum terkirim ke server">belum</span>`));
    } else if (keadaan === "menyimpan") {
      sel.replaceChildren(h(`<span class="badge badge-gray">…</span>`));
    } else if (keadaan === "tersimpan") {
      // Centangnya SEKALIGUS pintu riwayat. Bukan tombol tambahan di kolom
      // terpisah: lembar ini sudah selebar layar dua kali, dan satu kolom lagi
      // dibayar setiap baris walau riwayatnya hampir tidak pernah ditanya.
      //
      // Yang ditanyakan orang saat menatap centang hijau memang persis ini —
      // "angka ini sudah masuk, tapi siapa yang menaruhnya, dan apakah ia
      // mengganti angka lain?" Jadi jawabannya ditaruh di tempat pertanyaannya
      // muncul.
      sel.replaceChildren(h(`<button class="badge badge-green badge-tombol"
        type="button" data-riwayat title="Sudah masuk database">✓</button>`));
      sel.querySelector("[data-riwayat]")
         .addEventListener("click", () => bukaRiwayat(tr));
    } else if (keadaan === "gagal") {
      sel.replaceChildren(h(html`<button class="button button-danger button-mini"
        type="button" data-ulang title="${pesan}">Ulangi</button>`));
      sel.querySelector("[data-ulang]").addEventListener("click", () => simpanBaris(tr));
    } else {
      sel.replaceChildren();
    }
    perbaruiRingkasan();
  };

  /** Gembok satu baris: rupanya, dan apa yang ikut mati bersamanya.
   *
   *  Terbuka adalah keadaan bawaan — semua baris bisa diisi sampai ada yang
   *  menyatakan selesai. Sesudah dikunci, kotaknya benar-benar dimatikan, bukan
   *  sekadar dipudarkan: kotak yang masih bisa diketik tapi selalu ditolak
   *  adalah jebakan, dan penolakannya baru muncul sesudah petugas mengetik
   *  angka yang ia kira tersimpan.
   *
   *  Yang menegakkan aturannya tetap server (0044). Ini supaya petugas tahu
   *  SEBELUM mengetik, bukan sesudah ditolak. */
  const gambarGembok = (tr) => {
    const kunci = tr.dataset.terkunci === "1";
    tr.classList.toggle("baris-terkunci", kunci);
    tr.querySelectorAll("input").forEach(el => { el.disabled = kunci; });

    const sel = tr.querySelector(".pos-gembok");
    sel.replaceChildren(h(`<button type="button" class="gembok"
      data-gembok aria-pressed="${kunci}"
      title="${kunci ? "Terkunci — buka gembok (admin)"
                     : "Kunci nilai"}">${
      ikon(kunci ? "lock" : "lock-open")}</button>`));
    sel.querySelector("[data-gembok]").addEventListener("click", () => ubahGembok(tr));
  };

  /** Mengunci, atau meminta admin membukanya. */
  async function ubahGembok(tr) {
    const dada = Number(tr.dataset.dada);
    const kunci = tr.dataset.terkunci === "1";
    const tiga = dada3(dada);

    // MENGUNCI tidak bertanya. Petugas menekan gembok ratusan kali dalam satu
    // shift, dan setiap kali harus menjawab "yakin?" untuk perbuatan yang bisa
    // ia batalkan sendiri (0045) — ongkos itu dibayar di tiap baris, sementara
    // yang dicegahnya cuma satu ketukan nyasar yang tinggal diketuk lagi.
    //
    // MEMBUKA bertanya, dan itu bukan sekadar konfirmasi: alasannya wajib, dan
    // alasan itulah satu-satunya penjelasan yang tersisa kalau nilainya
    // berubah sesudah gemboknya terbuka. Yang mahal memang arah itu, bukan
    // arah sebaliknya.
    if (!kunci) {
      try { await kunciNilaiPos(dada, pos.nomor); }
      catch (err) { notif(`Gagal mengunci: ${err.message}`, true); return; }
      tr.dataset.terkunci = "1";
      gambarGembok(tr);
      notif(`Nilai ${tiga} dikunci.`);
      return;
    }

    // Tanpa kalimat penjelas. Kotak alasan yang wajib diisi sudah mengatakan
    // seluruhnya — bahwa alasannya dicatat adalah hal yang petugas pelajari
    // sekali, sedangkan kalimatnya dibaca ulang setiap kali gembok dibuka.
    const jawab = await dialog({
      judul: `Buka gembok ${tiga}?`,
      medan: [{ label: "Alasan membuka" }],
      labelAksi: "Buka",
    });
    if (!jawab) return;
    try { await bukaKunciNilaiPos(dada, pos.nomor, jawab[0]); }
    catch (err) { notif(`Gagal membuka: ${err.message}`, true); return; }
    tr.dataset.terkunci = "";
    gambarGembok(tr);
    notif(`Gembok ${tiga} dibuka.`);
  }

  /** Riwayat perubahan nilai satu regu di pos ini.
   *
   *  Dibaca saat DIKETUK, bukan ikut dimuat bersama lembarnya: lembar pos
   *  memuat ratusan baris dan hampir semuanya tidak pernah ditanya riwayatnya.
   *
   *  Yang ditampilkan sengaja apa adanya — angka lama, angka baru, siapa,
   *  kapan — tanpa menyimpulkan mana yang "mencurigakan". Yang tahu apakah
   *  suatu perubahan wajar adalah orang yang berdiri di pos itu, bukan layar. */
  async function bukaRiwayat(tr) {
    const dada = Number(tr.dataset.dada);
    const nama = tr.children[1].textContent.trim();
    let baris;
    try {
      baris = await riwayatNilai(pos.nomor, dada);
    } catch (err) {
      notif(`Riwayat tidak bisa dibaca: ${err.message}`, true);
      return;
    }

    /* Sengaja RINGKAS: satu baris per perubahan, tanpa kepala tabel.
       Yang dicari orang saat membukanya cuma tiga hal — lomba apa, dari berapa
       jadi berapa, dan siapa. Kepala tabel dan kalimat penjelas menambah teks
       yang harus dilewati mata sebelum sampai ke jawabannya. */
    if (!baris.length) {
      await dialog({
        judul: `${dada3(dada)} · ${nama}`,
        kartuHtml: `<p class="description">Belum pernah diubah.</p>`,
        labelAksi: "Tutup", bacaSaja: true,
      });
      return;
    }

    /* SARINGAN PER LOMBA, dan hanya muncul kalau memang ada yang disaring.
       Satu regu di Pos 3 bisa punya tujuh lomba dan puluhan perubahan; yang
       ditanyakan biasanya satu — "Bidai-nya kenapa berubah dua kali?".
       Menyaringnya di sini lebih cepat daripada menyusuri daftar.

       Di pos berlomba satu, chip-nya cuma akan berbunyi "Semua" dan nama lomba
       itu sendiri — dua tombol yang tidak menyaring apa pun. Jadi ia tidak
       digambar sama sekali. */
    /* Chip diurutkan seperti URUTAN PENILAIAN, bukan seperti urutan perubahan.
       Daftar riwayat di bawahnya urut waktu-terbaru-dulu, dan chip yang ikut
       urutan itu berpindah tempat setiap kali ada nilai baru masuk — tombol
       yang berpindah antar kunjungan harus dibaca ulang tiap kali.
       kolom[] datang dari kolomPos() yang sudah urut sort_order, jadi
       chip-nya berbaris sama dengan kolom di lembar: Semaphore, Tebak Simpul,
       Menaksir. Lomba yang tidak dikenali kolom (mis. komponen yang sudah
       dihapus admin tapi masih punya riwayat) jatuh ke belakang. */
    const urutLomba = new Map(kolom.map((k, i) => [k.nama, i]));
    const lomba = [...new Map(baris.map(b => [b.kode_lomba, b.nama_lomba]))]
      .sort((a, b) => (urutLomba.get(a[1]) ?? 1e9) - (urutLomba.get(b[1]) ?? 1e9));
    const chip = lomba.length < 2 ? "" : `
      <div class="option-row saring-riwayat">
        <button type="button" class="option option-small" data-lomba=""
                aria-pressed="true">Semua</button>
        ${lomba.map(([kode, nama]) => html`
          <button type="button" class="option option-small" data-lomba="${kode}"
                  aria-pressed="false">${nama}</button>`).join("")}
      </div>`;

    const isi = chip + `<ul class="riwayat">${baris.map(b => html`
      <li data-lomba="${b.kode_lomba}">
        <span class="r-lomba">${b.nama_lomba}</span>
        <span class="r-nilai">${b.nilai_lama === null ? "—" : angkaRapi(b.nilai_lama)}
          → <strong>${b.nilai_baru === null ? "hapus" : angkaRapi(b.nilai_baru)}</strong></span>
        <span class="r-oleh">${b.oleh} · ${tanggalJam(b.changed_at)}</span>
      </li>`).join("")}</ul>`;

    // dialog() menempelkan kartunya ke DOM secara SINKRON sebelum janjinya
    // menunggu, jadi penyaringnya boleh dipasang sebelum di-await. Menunggu
    // dulu berarti menunggu sampai dialognya ditutup.
    const janji = dialog({
      judul: `${dada3(dada)} · ${nama}`,
      kartuHtml: isi,
      labelAksi: "Tutup",
      bacaSaja: true,
    });

    const kartu = document.querySelector(".dialog .saring-riwayat");
    if (kartu) {
      kartu.addEventListener("click", (e) => {
        const b = e.target.closest("[data-lomba]");
        if (!b) return;
        const pilih = b.dataset.lomba;
        kartu.querySelectorAll("[data-lomba]").forEach(x =>
          x.setAttribute("aria-pressed", String(x.dataset.lomba === pilih)));
        document.querySelectorAll(".dialog .riwayat li").forEach(li => {
          li.hidden = !!pilih && li.dataset.lomba !== pilih;
        });
      });
    }

    await janji;
  }

  /** Slug lomba dari NAMANYA, bukan dari kode wahana.
   *
   *  Satu slip = satu lomba, tapi satu lomba bisa punya beberapa baris wahana:
   *  Bidai lima kriteria di satu kertas, Tebak Simpul satu baris per golongan.
   *  Kode wahana karena itu bukan penanda selembar kertas — namanya yang
   *  justru satu, dan itulah yang sudah dipakai kolomPos() mengelompokkan. */
  const slugLomba = (nama) => String(nama).toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "lomba";

  /** Foto slip penilaian satu regu — satu foto per lomba (migrasi 0047).
   *
   *  Kertas berpindah tangan dari pos ke kotak ke meja IT, dan begitu hilang
   *  tidak ada apa pun yang bisa memulihkan angkanya. Difoto di sini, di meja
   *  IT, karena di sinilah fotonya tertaut sendiri ke nomor dada dan lomba
   *  yang tepat — petugas baru saja mengetiknya.
   *
   *  Gembok TIDAK mematikan tombol ini. Mengunci berarti angkanya final;
   *  fotonya justru bukti untuk angka final itu, dan menolak bukti setelah
   *  putusan adalah urutan yang terbalik. */
  async function bukaFoto(tr) {
    const dada = Number(tr.dataset.dada);
    const namaRegu = tr.children[1].textContent.trim();
    const tiga = dada3(dada);

    let sudah = [];
    try {
      sudah = await daftarFotoLembar(pos.nomor, dada);
    } catch (err) {
      notif(`Daftar foto tidak bisa dibaca: ${err.message}`, true);
    }

    const hitung = {};
    const terbaru = {};
    sudah.forEach(f => {
      hitung[f.kode_lomba] = (hitung[f.kode_lomba] || 0) + 1;
      if (!terbaru[f.kode_lomba]) terbaru[f.kode_lomba] = f.path;   // sudah urut terbaru dulu
    });

    const lomba = [...new Map(kolom.map(k => [slugLomba(k.nama), k.nama]))];

    /* Template BIASA, bukan tag html`` — sama alasannya dengan notif(): tag
       html`` meng-escape SETIAP sisipan, dan ikon("camera") adalah HTML yang
       memang harus dirender. Ditulis dengan html``, jalur SVG-nya tampil apa
       adanya sebagai teks hijau sepanjang tiga baris di dalam tombolnya.
       Yang datang dari luar tetap lewat esc() satu per satu. */
    const isi = `<ul class="foto-lomba">${lomba.map(([kode, nama]) => `
      <li data-kode="${esc(kode)}" data-nama="${esc(nama)}">
        <span class="f-nama">${esc(nama)}</span>
        <span class="f-jumlah" data-jumlah>${hitung[kode]
          ? `${esc(String(hitung[kode]))} foto` : "belum ada"}</span>
        <button type="button" class="button button-mini" data-lihat
          ${hitung[kode] ? "" : "hidden"}>Lihat</button>
        <label class="button button-mini button-primary">
          <input type="file" accept="image/*" multiple hidden data-ambil>${ikon("camera")} Foto
        </label>
      </li>`).join("")}</ul>
`;

    // Sama seperti bukaRiwayat: dialog() menempelkan kartunya secara SINKRON,
    // jadi pendengarnya boleh dipasang sebelum janjinya ditunggu.
    const janji = dialog({
      judul: `Foto Jawaban · ${tiga} · ${namaRegu}`,
      kartuHtml: isi,
      labelAksi: "Tutup",
      bacaSaja: true,
    });

    const kartu = document.querySelector(".dialog .foto-lomba");
    if (kartu) {
      kartu.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-lihat]");
        if (!b) return;
        const kode = b.closest("li").dataset.kode;
        if (!terbaru[kode]) return;
        // Jendelanya dibuka SEBELUM await. Dibuka sesudahnya, browser HP
        // menganggapnya popup yang tidak diminta pengguna dan memblokirnya.
        const jendela = window.open("", "_blank");
        try {
          const url = await tautanFoto(terbaru[kode]);
          if (jendela && url) jendela.location = url;
          else if (jendela) jendela.close();
        } catch (err) {
          if (jendela) jendela.close();
          notif(`Foto tidak bisa dibuka: ${err.message}`, true);
        }
      });

      kartu.addEventListener("change", async (e) => {
        const inp = e.target.closest("[data-ambil]");
        if (!inp || !inp.files || !inp.files.length) return;
        const li = inp.closest("li");
        const kode = li.dataset.kode;
        const status = li.querySelector("[data-jumlah]");
        const berkas = [...inp.files];
        // Dikosongkan supaya memilih BERKAS YANG SAMA lagi tetap memicu change
        // — persis yang dilakukan orang setelah unggahan pertama gagal.
        inp.value = "";

        for (const f of berkas) {
          let blob;
          try {
            status.textContent = "mengecilkan…";
            blob = await kecilkanFoto(f);
          } catch (err) {
            status.textContent = err.message;
            continue;
          }
          try {
            status.textContent = `mengirim ${ukuranRapi(blob.size)}…`;
            const hasil = await unggahFotoLembar(
              pos.nomor, kode, li.dataset.nama, dada, blob);
            hitung[kode] = (hitung[kode] || 0) + 1;
            terbaru[kode] = hasil.path;
            status.textContent = `${hitung[kode]} foto · ${ukuranRapi(blob.size)}`;
            const lihat = li.querySelector("[data-lihat]");
            if (lihat) lihat.hidden = false;
          } catch (err) {
            // Blob-nya sudah tidak dipegang, tapi berkas aslinya masih di
            // galeri HP — dan itulah antreannya. Petugas memilih ulang berkas
            // yang sama, dan input di atas sengaja sudah dikosongkan supaya
            // pilihan itu terbaca.
            status.textContent = `gagal — ${err.message}`;
            notif(`Foto ${tiga} ${li.dataset.nama} gagal terkirim: ${err.message}`, true);
          }
        }
      });
    }

    await janji;
  }

  /* ---------- pita keadaan + kirim ulang sendiri ----------

     Dua hal yang tidak boleh diserahkan ke kewaspadaan petugas:

     1. MENGHITUNG sendiri berapa baris yang belum aman. Baris merah di
        tengah tabel 300 baris tidak akan terlihat oleh orang yang sedang
        menatap kolom Semaphore di baris ke-80.
     2. MENEKAN "Ulangi" satu per satu setelah internet kembali. Layar yang
        tahu koneksinya sudah pulih tapi menunggu diperintah hanya
        memindahkan pekerjaan ke orang yang paling sibuk di ruangan itu.  */

  const pita = document.getElementById("pos-simpan");
  let jamUlang = null;

  // Jam terakhir kali sesuatu BENAR-BENAR masuk database. Diisi saat lembar
  // dimuat, karena saat itu angka di layar memang baru dibaca dari sana.
  let jamSinkron = new Date();

  function perbaruiRingkasan() {
    const baris = [...tbody.children];
    const belum = baris.filter(t => t.dataset.keadaan === "belum").length;
    const gagal = baris.filter(t => t.dataset.keadaan === "gagal").length;
    const sibuk = baris.some(t => t.dataset.keadaan === "menyimpan");
    const putus = !navigator.onLine;
    // Umurnya SELALU ikut, bukan hanya saat gagal. Capnya kini HH:MM (bentuk
    // baku, lihat util.js) dan tanpa detik dua simpanan dalam satu menit
    // terlihat identik — "barusan" yang menggantikannya sebagai tanda bahwa
    // pitanya memang masih hidup, dan sekaligus menjawab pertanyaan yang
    // sebenarnya: seberapa tua angka ini.
    const cap = `Sinkronisasi Terakhir: ${jamMenit(jamSinkron)} (${berapaLalu(jamSinkron)})`;

    if (gagal || putus) {
      pita.className = "pos-simpan bahaya";
      pita.textContent = putus
        ? `Internet putus — ${belum + gagal} baris belum tersimpan. Jangan tutup halaman ini. ${cap}.`
        // Kedua-duanya disebut. Pita yang hanya menghitung baris GAGAL sempat
        // menulis "1 baris" padahal ada dua yang belum aman di layar —
        // angka yang tidak lengkap justru menghapus gunanya sebagai jaminan.
        : `${gagal} baris gagal terkirim${belum ? ` dan ${belum} baris masih diketik` : ""}`
          + ` — jangan tutup halaman ini. ${cap}.`;
      if (gagal) jadwalkanUlang();
      return;
    }
    if (sibuk)  { pita.className = "pos-simpan menunggu"; pita.textContent = `Menyimpan… ${cap}`; return; }
    if (belum)  { pita.className = "pos-simpan menunggu"; pita.textContent = `${belum} baris belum tersimpan. ${cap}`; return; }
    pita.className = "pos-simpan aman";
    pita.textContent = `✓ Data Tersimpan · ${cap}`;
  }

  function ulangYangGagal() {
    if (!document.body.contains(tbody)) return false;   // layar sudah ditinggalkan
    if (!navigator.onLine) return true;
    [...tbody.children]
      .filter(t => t.dataset.keadaan === "gagal")
      .forEach(t => simpanBaris(t));
    return true;
  }

  function jadwalkanUlang() {
    if (jamUlang) return;
    jamUlang = setInterval(() => {
      // Layar ini bisa ditinggalkan kapan saja; jam yang terus berdetak di
      // atas tabel yang sudah lepas dari halaman adalah kebocoran.
      if (!document.body.contains(tbody)
          || ![...tbody.children].some(t => t.dataset.keadaan === "gagal")) {
        clearInterval(jamUlang); jamUlang = null;
        return;
      }
      ulangYangGagal();
    }, 15000);
  }

  // Internet kembali: jangan menunggu putaran 15 detik berikutnya.
  window.addEventListener("online", ulangYangGagal);
  window.addEventListener("offline", perbaruiRingkasan);

  // Baris yang sudah berisi nilai memang berasal dari database — ✓-nya
  // benar sejak halaman dibuka, bukan hanya untuk yang diketik hari ini.
  [...tbody.children].forEach(tr => {
    if (Number(tr.dataset.terisi) > 0) statusBaris(tr, "tersimpan");
    gambarGembok(tr);
  });
  perbaruiRingkasan();

  async function simpanBaris(tr) {
    // Satu baris punya banyak kotak, dan tiap kotak yang ditinggalkan memicu
    // simpanan sendiri. Petugas yang mengetik cepat menghasilkan lima
    // panggilan beruntun, dan yang kedua sampai kelima datang selagi yang
    // pertama masih di jalan.
    //
    // MENOLAKNYA adalah kesalahan yang sempat ada di sini: barisnya tetap
    // diberi ✓ hijau — karena simpanan pertama memang berhasil — sementara
    // empat angka berikutnya tidak pernah terkirim. Petugas melihat tanda
    // berhasil untuk nilai yang hilang. Jadi yang datang saat sibuk DIANTRE,
    // lalu dijalankan sekali lagi sesudahnya; putaran kedua membaca ulang
    // seluruh baris, sehingga berapa pun ketukan yang menumpuk cukup
    // diselesaikan satu kali.
    if (tr.dataset.jalan === "1") { tr.dataset.antre = "1"; return; }
    // Baris tergembok tidak pernah dikirim. Kotaknya memang sudah mati, tapi
    // simpanBaris juga dipanggil dari antrean dan dari tombol Ulangi.
    if (tr.dataset.terkunci === "1") return;
    const dada = Number(tr.dataset.dada);
    const lama = asli.get(dada) || {};
    const baris = [], dihapus = [], takTerbaca = [];

    for (const k of komponenBaris(tr)) {
      const baru = bacaSel(tr, k);
      const ada = lama[k.kode] || null;
      // Kotak berisi sesuatu yang tidak terbaca: JANGAN disentuh sama sekali.
      // Bukan dikirim, dan bukan pula dianggap kosong — angka lamanya tetap di
      // tempatnya sampai petugas membetulkan ketikannya.
      if (baru === TIDAK_SAH) { takTerbaca.push(k.name); continue; }
      if (baru === null) {
        // Kotak dikosongkan padahal sebelumnya ada isinya = angka itu masuk ke
        // regu yang salah. Dihapus, bukan ditimpa nol.
        if (ada) dihapus.push(k.kode);
        continue;
      }
      const samaSaja = ada
        && Number(ada.nilai_1) === baru.nilai_1
        && (ada.nilai_2 === null || ada.nilai_2 === undefined
              ? null : Number(ada.nilai_2)) === baru.nilai_2;
      if (!samaSaja) {
        baris.push({ nomor_dada: dada, kode: k.kode,
                     nilai_1: baru.nilai_1, nilai_2: baru.nilai_2 });
      }
    }
    // Ada kotak yang tidak terbaca: barisnya berakhir MERAH, bukan hijau.
    //
    // Yang sah tetap dikirim — memaksa petugas mengetik ulang kotak yang sudah
    // benar karena satu kotak lain salah adalah hukuman yang tidak perlu. Tapi
    // barisnya tidak boleh terlihat selesai selama masih ada yang salah, dan
    // merahnya juga yang menahan penyegaran 20 detik agar tidak menghapus
    // ketikan yang sedang dibetulkan (baris "gagal" termasuk sibuk).
    const pesanTakTerbaca = takTerbaca.length
      ? `${takTerbaca.join(", ")}: isinya bukan angka/waktu yang bisa dibaca. `
        + `Angka lamanya TIDAK diubah.`
      : null;

    if (pesanTakTerbaca && !baris.length && !dihapus.length) {
      statusBaris(tr, "gagal", pesanTakTerbaca);
      notif(`Nomor Dada ${dada3(dada)}: ${pesanTakTerbaca}`, true);
      return;
    }

    // Tidak ada yang berubah — misalnya angka diketik ulang sama persis.
    // Barisnya dikembalikan ke keadaan istirahat, BUKAN ditinggalkan dalam
    // keadaan "belum": tanda kuning yang tidak akan pernah hilang sendiri
    // mengajari petugas mengabaikan tanda kuning.
    if (!baris.length && !dihapus.length) {
      statusBaris(tr, Number(tr.dataset.terisi) > 0 ? "tersimpan" : "");
      return;
    }

    tr.dataset.jalan = "1";
    statusBaris(tr, "menyimpan");
    try {
      if (baris.length) {
        const hasil = await simpanNilaiPos(baris, pos.nomor);
        // Server memeriksa ulang tiap baris dan menolaknya satu per satu;
        // yang pertama ditolak sudah cukup menjelaskan apa yang salah.
        const ditolak = (hasil || []).find(x => x.status === "ditolak");
        if (ditolak) throw new ErrorApi(ditolak.alasan || "nilai ditolak server");
      }
      for (const kode of dihapus) await hapusNilaiPos(dada, kode, pos.nomor);

      const segar = await lembarPosSatu(pos.nomor, dada);
      if (segar) {
        asli.set(dada, segar.nilai || {});
        tr.querySelector(".pos-nilai").textContent = angkaRapi(segar.nilai_pos);
        tr.dataset.terisi = String(segar.jumlah_terisi);
      }
      // Cap waktunya dipasang DI SINI, bukan saat permintaan dikirim: yang
      // dijanjikan cap itu adalah "sudah ada di database", dan yang
      // membuktikannya adalah baris yang barusan dibaca kembali dari sana.
      jamSinkron = new Date();
      if (pesanTakTerbaca) {
        statusBaris(tr, "gagal", pesanTakTerbaca);
        notif(`Nomor Dada ${dada3(dada)}: ${pesanTakTerbaca}`, true);
      } else {
        statusBaris(tr, Number(tr.dataset.terisi) > 0 ? "tersimpan" : "");
      }
      hitungUlangJumlah();
    } catch (err) {
      statusBaris(tr, "gagal", err.message);
      // "Nomor Dada 005: ...", bukan "005: ...". Notifikasi ini muncul di
      // bawah layar, terlepas dari baris yang gagal — angka telanjang di
      // depan kalimat tidak memberi tahu angka APA, dan di lembar yang penuh
      // angka itu justru yang paling perlu disebut namanya.
      notif(`Nomor Dada ${dada3(dada)}: ${err.message}`, true);
    } finally {
      tr.dataset.jalan = "";
      // Ketukan yang menumpuk selagi baris ini sibuk. Dijalankan juga setelah
      // GAGAL: yang tersimpan sebagian lalu ditinggalkan adalah keadaan
      // terburuk dari semuanya.
      if (tr.dataset.antre === "1") { tr.dataset.antre = ""; simpanBaris(tr); }
    }
  }

  /* ---------- perilaku isian ---------- */

  // Ditandai sejak KETUKAN PERTAMA, bukan menunggu kotaknya ditinggalkan.
  // Di antara keduanya bisa lewat semenit — petugas mengetik lalu menoleh ke
  // lembar berikutnya — dan selama semenit itu angkanya hanya ada di layar.
  tbody.addEventListener("input", (e) => {
    const tr = e.target.closest("tr");
    if (tr && tr.dataset.jalan !== "1") statusBaris(tr, "belum");
  });

  tbody.addEventListener("change", (e) => {
    const tr = e.target.closest("tr");
    if (tr) simpanBaris(tr);
  });

  /* ISI KOTAK DIPILIH SAAT DIKETUK, jadi ketukan pertama MENGGANTI.

     Kotak nilai tidak pernah dimaksudkan untuk DITAMBAHI — tidak ada juri yang
     bermaksud "sambung angka ini ke angka yang sudah ada". Tanpa seleksi,
     mengetuk kotak berisi 1 lalu menekan 8 menghasilkan 18, dan di situlah
     bahayanya: untuk Bidai yang rentangnya 0-20, 18 adalah angka SAH. Server
     menerimanya, tidak ada yang memerah, dan yang tersimpan bukan yang
     dimaksud siapa pun.

     Di Semaphore (0-5) kesalahan yang sama tertolak dan terlihat. Justru itu
     yang membuatnya berbahaya di tempat lain: ia hanya senyap di kolom yang
     rentangnya cukup lebar untuk menampung angka gabungan.

     Hanya saat DIKETUK. Mengetik beruntun di kotak yang sedang dipegang tidak
     terganggu — "12" untuk Menaksir tetap 12, karena seleksi cuma terjadi
     sekali saat fokus masuk, bukan tiap ketukan.

     Lewat setTimeout dengan alasan yang sama dengan kotak jam: Safari iOS
     membatalkan select() yang dipanggil di dalam penanganan focus itu sendiri. */
  tbody.addEventListener("focusin", (e) => {
    const el = e.target;
    if (el.tagName !== "INPUT" || el.type === "checkbox" || !el.value) return;
    setTimeout(() => {
      if (document.activeElement === el) { try { el.select(); } catch { /* abaikan */ } }
    }, 0);
  });

  /* Kotak waktu: dirapikan dan diperiksa saat DITINGGALKAN.

     Satu kotak yang menerima "32" maupun "1:10" punya satu kelemahan yang
     tidak dimiliki dua kotak angka: isinya bisa BUKAN waktu. "1:75" terbaca
     wajar oleh mata, tapi bukan waktu mana pun, dan bacaSel() menolaknya
     dengan mengembalikan null — yang di jalur simpan berarti "kotak kosong",
     alias tidak dikirim.

     Tanpa penanda, itu jenis kegagalan yang paling buruk: petugas mengetik
     angka, tidak ada yang merah, tidak ada yang gagal, dan nilainya tidak
     pernah ada. Jadi kotaknya diberi aria-invalid, yang sudah punya gaya merah
     sendiri di style.css dan sekaligus terbaca pembaca layar.

     Dirapikan saat blur, bukan tiap ketukan: menata angka sementara orang
     masih mengetiknya memindahkan kursor di bawah jarinya. Pola dan alasannya
     sama dengan pasangKotakJam() di util.js. */
  tbody.addEventListener("focusout", (e) => {
    const el = e.target;
    if (!el.classList || !el.classList.contains("input-waktu")) return;
    const kosong = !el.value.trim();
    const detik = detikSah(el.value);
    if (kosong) el.removeAttribute("aria-invalid");
    else if (detik === null) el.setAttribute("aria-invalid", "true");
    else {
      // "0:32" jadi "32", "95" jadi "1:35" — bentuk yang sama dengan yang
      // digambar ulang dari database, supaya menyimpan baris yang tidak
      // disentuh tidak pernah terlihat sebagai perubahan.
      el.value = detikTeks(detik);
      el.removeAttribute("aria-invalid");
    }
  });

  // Merah hilang begitu isinya jadi waktu yang sah — menunggu blur untuk
  // memadamkan peringatan membuat petugas mengira ketikan barunya juga salah.
  tbody.addEventListener("input", (e) => {
    const el = e.target;
    if (!el.classList || !el.classList.contains("input-waktu")) return;
    if (detikSah(el.value) !== null || !el.value.trim()) {
      el.removeAttribute("aria-invalid");
    }
  });

  // Enter = turun satu regu di kolom yang sama, seperti menyalin dari kertas
  // ke bawah. Berpindah fokus memicu change-nya sendiri, jadi barisnya
  // tersimpan tanpa perlu dipanggil dua kali.
  tbody.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.target.tagName !== "INPUT") return;
    e.preventDefault();
    const tr = e.target.closest("tr");
    const kotak = [...tr.querySelectorAll("input")];
    const kolom = kotak.indexOf(e.target);
    let lanjut = tr.nextElementSibling;
    while (lanjut && lanjut.hidden) lanjut = lanjut.nextElementSibling;
    const tujuan = lanjut && lanjut.querySelectorAll("input")[kolom];
    if (tujuan) { tujuan.focus(); if (tujuan.select) tujuan.select(); }
    else e.target.blur();
  });

  /* ---------- cari & saring ---------- */

  // Baris DISEMBUNYIKAN, bukan dibangun ulang. Menggambar ulang tabel akan
  // membuang isi kotak yang belum sempat tersimpan — dan petugas tidak akan
  // sadar angkanya hilang, karena yang ia lihat hanyalah daftar yang menyusut.
  const cocok = (tr, cari) => !cari
    || tr.dataset.dada.padStart(3, "0").includes(cari)
    || tr.children[1].textContent.toLowerCase().includes(cari)
    || tr.children[2].textContent.toLowerCase().includes(cari);

  // Pembanding wajib jumlah komponen BARIS ITU, bukan jumlah kolom tabel.
  // Regu Penggalang di Pos 1 punya tiga komponen sementara tabelnya berkolom
  // enam — dibandingkan dengan enam, tidak ada satu pun regu yang pernah
  // "lengkap", dan saringan "Belum lengkap" ikut menampilkan semuanya.
  const lengkap = (tr) =>
    Number(tr.dataset.terisi) >= Number(tr.dataset.komponen);

  function hitungUlangJumlah() {
    const baris = [...tbody.children];
    const tampil = baris.filter(tr => !tr.hidden).length;
    // SATU pecahan. "47/53 lengkap" dibuang karena chip di sebelahnya sudah
    // menjawabnya: dengan saringan "Belum lengkap" menyala, yang ditampilkan
    // ITULAH yang belum lengkap — 6/53 dan 47/53 adalah angka yang sama
    // dibaca dari dua arah. Dua pecahan bersebelahan justru menuntut orang
    // memeriksa mana yang mana sebelum bisa membacanya.
    document.getElementById("tabel-jumlah").textContent =
      `${tampil}/${baris.length} ditampilkan`;
  }

  /* ---------- cetak lembar kosong ---------- */

  // Yang dicetak adalah baris yang SEDANG TAMPIL, bukan selalu semuanya.
  // Dua kebutuhan berbeda terlayani satu tombol: sebelum lomba cetak "Semua"
  // untuk lembar kosong, dan di tengah lomba saring "Belum lengkap" dulu
  // supaya kertas susulan hanya memuat regu yang memang belum dinilai.
  const cetak = async (slip) => {
    const tampil = [...tbody.children].filter(tr => !tr.hidden)
      .map(tr => lembar.find(r => Number(r.nomor_dada) === Number(tr.dataset.dada)))
      .filter(Boolean);
    if (!tampil.length) { notif("Tidak ada baris yang bisa dicetak.", true); return; }

    /* NOMOR DADA BERURUTAN 001 SAMPAI BATAS STOK, TANPA LOMPATAN.

       Dua sebab, dan yang kedua yang menentukan.

       Tim IT menyortir tumpukan slip menurut nomor dada lalu menyusurinya dari
       atas. Lembar yang melompati satu nomor menghentikan pekerjaan itu:
       "slip 012 hilang, atau memang tidak pernah ada?" — pertanyaan yang tidak
       bisa dijawab dari kertas.

       Dan sebagian sekolah MENDAFTAR OFFLINE. Regunya memakai nomor dada fisik
       yang nyata, tetapi belum ada di database saat lembar ini dicetak. Kalau
       lembarnya hanya memuat regu yang sudah terdaftar, regu itu tidak punya
       baris sama sekali — dan nilainya ditulis di pinggir kertas, atau tidak
       ditulis. Barisnya karena itu dicetak kosong dan siap ditulisi.

       Batasnya diambil dari STOK nomor dada, bukan dari regu terdaftar: stok
       adalah nomor fisik yang benar-benar dibawa panitia, dan mana pun di
       antaranya bisa muncul di kotak penilaian.

       HANYA saat tidak ada saringan. Lembar susulan justru dicetak untuk
       sebagian regu — menyisipkan seluruh nomor kosong ke dalamnya
       mengembalikan tumpukan kertas yang tadi sengaja dipersempit. */
    let semua = tampil;
    if (!slip && [...tbody.children].every(tr => !tr.hidden)) {
      let batas = 0;
      try { batas = await batasNomorDada(); } catch { /* jatuh ke daftar apa adanya */ }
      if (batas > 0) {
        const peta = new Map(tampil.map(r => [Number(r.nomor_dada), r]));
        semua = Array.from({ length: batas }, (_, i) =>
          peta.get(i + 1) || { nomor_dada: i + 1, kosong: true });
      }
    }

    // Dibaca saat menekan, bukan saat layar dimuat: layar pos sering
    // dibiarkan terbuka berjam-jam, dan status daftar ulang berubah di
    // tengahnya. Gagal membacanya tidak boleh menghalangi cetak — paling
    // buruk peringatannya ikut tercetak padahal sudah tidak berlaku.
    let ditutup = false;
    try { ditutup = !!(await statusAcara()).daftar_ulang_ditutup; } catch { /* cetak tetap jalan */ }

    if (slip) {
      // Yang dicetak MASTER, bukan tumpukannya — jadi daftar ulang yang belum
      // ditutup tidak berpengaruh di sini, dan jumlah regu yang sedang tampil
      // pun tidak. Blangkonya kosong; berapa banyak yang dibutuhkan diputuskan
      // di mesin fotokopi, bukan di layar ini.
      const n = siapkanCetakBlangko(pos, kolom);
      notif(`${n} master A5 melintang, satu per lomba.`);
    } else {
      siapkanCetakLembarPos(pos, kolom, semua);
    }
    window.print();
  };

  document.getElementById("cetak-lembar")
    .addEventListener("click", () => cetak(false));

  // Tombolnya ada di SEMUA pos, termasuk yang berlomba satu. Di Pos 4 dan
  // Pos 5 slipnya memang cuma satu per regu, tapi bentuknya tetap berbeda dari
  // tabel — dan alur kotak penilaian berlaku di sana juga.
  document.getElementById("cetak-per-lomba")
    .addEventListener("click", () => cetak(true));

  pasangAlatTabel((cari, saring) => {
    [...tbody.children].forEach(tr => {
      const lolosSaring = saring === "semua"
        || (saring === "sudah" ? lengkap(tr) : !lengkap(tr));
      tr.hidden = !(cocok(tr, cari) && lolosSaring);
    });
    hitungUlangJumlah();
  });

  pasangPilihPos(s);

  /* ==========================================================================
     LEMBAR INI MENYEGARKAN DIRINYA SENDIRI.

     Satu akun operator per pos, dipakai di HP mana pun yang ada di pos itu —
     jadi dua orang membuka lembar yang sama adalah kejadian biasa, bukan
     kasus ganjil. Sampai sekarang lembar ini hanya membaca ulang BARIS YANG
     IA SIMPAN SENDIRI; segala yang masuk dari HP sebelah tidak pernah muncul.

     Yang paling berbahaya bukan angkanya tidak terlihat, melainkan
     akibatnya saat menghapus. `asli` adalah cermin keadaan database, dan
     penghapusan dijalankan HANYA untuk komponen yang ada di cermin itu
     (`if (ada) dihapus.push(...)`). Nilai yang masuk dari HP lain setelah
     halaman ini dibuka tidak ada di cermin — jadi mengosongkan kotaknya tidak
     menghapus apa pun. Petugas melihat kotak kosong, menekan simpan, mendapat
     centang hijau, dan angka yang ia kira sudah dibuang masih di database.

     Menyegarkan lembar penuh angka yang sedang diketik jelas berisiko, jadi
     baris DILEWATI kalau ia sedang disentuh:

       - ada kursor di dalamnya          -> orangnya sedang mengetik
       - keadaan "belum"/"menyimpan"     -> ada ketikan yang belum sampai
       - keadaan "gagal"                 -> pesan galatnya belum dibaca
       - sedang jalan / mengantre        -> simpanBaris yang mengurusnya

     Baris yang dilewati akan tersegarkan sendiri begitu tersimpan, karena
     jalur simpan memang membaca ulang barisnya. Jadi tidak ada baris yang
     tertinggal basi selamanya — yang ada hanya baris yang menunggu gilirannya.
     ========================================================================== */
  const segarkanLembar = async () => {
    let baru;
    try { baru = await lembarPos(pos.nomor); }
    catch { return; }   // pos sering kehilangan sinyal; percobaan berikutnya 20 detik lagi
    if (location.hash !== layarIni) return;

    const peta = new Map(baru.map(r => [Number(r.nomor_dada), r]));
    let berubah = false;

    for (const tr of tbody.children) {
      const sibuk = tr.dataset.jalan === "1" || tr.dataset.antre === "1"
        || ["belum", "menyimpan", "gagal"].includes(tr.dataset.keadaan || "")
        || tr.contains(document.activeElement);
      if (sibuk) continue;

      const r = peta.get(Number(tr.dataset.dada));
      if (!r) continue;

      asli.set(Number(r.nomor_dada), r.nilai || {});
      // Gembok yang dipasang dari HP lain menyusul lewat penyegaran ini —
      // paling lama 20 detik, dan server tetap menolak lebih cepat dari itu.
      const kunciBaru = r.terkunci ? "1" : "";
      if (tr.dataset.terkunci !== kunciBaru) {
        tr.dataset.terkunci = kunciBaru;
        gambarGembok(tr);
      }
      if (tr.dataset.terisi !== String(r.jumlah_terisi)) berubah = true;
      tr.dataset.terisi = String(r.jumlah_terisi);
      tr.querySelector(".pos-nilai").textContent = angkaRapi(r.nilai_pos);

      // Kotaknya ditulis ulang hanya kalau isinya memang berbeda. Menyetel
      // .value ke teks yang sama pun sudah cukup untuk memindahkan kursor di
      // sebagian browser, dan baris ini bisa saja baru saja ditinggalkan.
      for (const kol of kolom) {
        const k = varianUntuk(kol, tr.dataset.golongan);
        if (!k) continue;
        const nilai = (r.nilai || {})[k.kode];
        const kotak = tr.querySelectorAll(`[data-kode="${CSS.escape(k.kode)}"]`);
        if (!kotak.length) continue;

        if (k.form === "biner") {
          const centang = !!(nilai && Number(nilai.nilai_1) > 0);
          if (kotak[0].checked !== centang) kotak[0].checked = centang;
        } else if (k.satuan === "detik") {
          const teks = detikTeks(nilai ? nilai.nilai_1 : null);
          if (kotak[0].value !== teks) kotak[0].value = teks;
        } else if (k.form === "benar_kurang_salah") {
          const b = angkaRapi(nilai ? nilai.nilai_1 : null);
          const sa = angkaRapi(nilai ? nilai.nilai_2 : null);
          if (kotak[0].value !== b) kotak[0].value = b;
          if (kotak[1] && kotak[1].value !== sa) kotak[1].value = sa;
        } else {
          const v = angkaRapi(nilai ? nilai.nilai_1 : null);
          if (kotak[0].value !== v) kotak[0].value = v;
        }
      }

      statusBaris(tr, Number(tr.dataset.terisi) > 0 ? "tersimpan" : "");
    }

    jamSinkron = new Date();
    // Angka "sudah lengkap" ikut, tapi SARINGANNYA tidak dijalankan ulang.
    // Baris yang jadi lengkap sementara petugas menyaring "Belum lengkap"
    // tetap terlihat sampai ia menyentuh saringan lagi — dan itu disengaja:
    // baris yang lenyap sendiri dari bawah jari orang yang sedang mengetik
    // lebih membingungkan daripada satu baris yang tertinggal sebentar.
    if (berubah) hitungUlangJumlah();
    perbaruiRingkasan();
  };

  // Denyut yang membersihkan dirinya sendiri, pola yang sama dengan layar
  // Rekapitulasi: berhenti saat pindah layar atau tab disembunyikan, dan
  // dinyalakan lagi oleh kepulangan itu sendiri lewat segarkanDiTempat.
  let denyut = null;
  const mulaiDenyut = () => {
    if (denyut !== null) return;
    denyut = setInterval(() => {
      if (location.hash !== layarIni || document.hidden) {
        clearInterval(denyut); denyut = null; return;
      }
      segarkanLembar();
    }, 20000);
  };
  segarkanDiTempat = () => { segarkanLembar(); mulaiDenyut(); };
  mulaiDenyut();
}

/** Pemilih pos — hanya untuk admin. Operator pos melihat namanya saja, karena
 *  memberinya daftar pos lain hanya menawarkan sesuatu yang pasti ditolak
 *  server (RLS nilai_mentah) — pintu yang terkunci lebih baik tidak digambar.
 *
 *  Yang muncul HANYA pos yang benar-benar dinilai. Pos 0 (Keberangkatan) dan
 *  Pos 5 (Kedatangan) adalah garis start dan garis finish; yang dicatat di
 *  sana waktu, lewat layar Keberangkatan dan Kedatangan. Menawarkannya di
 *  sini berarti menawarkan lembar yang tidak akan pernah punya kolom — dan
 *  daftar yang memuat pilihan tanpa isi mengajari orang bahwa daftar itu
 *  tidak bisa dipercaya. */
function pilihPosHtml(s, semuaPos) {
  if (s.peran !== "admin") return "";
  const dinilai = semuaPos.filter(p => Number(p.jumlah_komponen) > 0);
  return `
    <div class="field" style="margin:0;min-width:210px">
      <label for="pilih-pos" class="visually-hidden">Pos yang diinput</label>
      <select id="pilih-pos" class="select-small">
        ${dinilai.map(p => `<option value="${esc(p.nomor)}"
          ${Number(p.nomor) === Number(posDipilih.nomor) ? "selected" : ""}
          >${esc(judulPos(p))}</option>`).join("")}
      </select>
    </div>`;
}

function pasangPilihPos(s) {
  if (s.peran !== "admin") return;
  const sel = document.getElementById("pilih-pos");
  if (!sel) return;
  sel.addEventListener("change", () => {
    posDipilih.nomor = Number(sel.value);
    layarInputPos();
  });
}

/* ============================ PINDAH KLOTER (HARI-H) ===================== */

/** Daftar sisipan: nomor-nomor yang TIDAK ADA di kertas petugas staging.
 *  Ditaruh paling atas dan diberi bingkai merah — ini satu-satunya cara
 *  petugas tahu ada regu tambahan di kloternya. */
function kartuSisipan(sisipan) {
  const aktif = sisipan.filter(s => !s.sudah_berangkat);
  if (!aktif.length) return "";
  const baris = aktif.map(s => html`
    <tr><td class="angka">${dada3(s.nomor_dada)}</td>
        <td><strong>${s.nama_regu}</strong><br>
            <span class="description">${s.nama_sekolah}</span></td>
        <td><span class="badge badge-red">Kloter ${s.kloter}</span></td>
        <td class="description">${s.alasan_sisip}</td></tr>`).join("");
  return `
    <div class="card" style="border:3px solid var(--bahaya);background:var(--bahaya-muda)">
      <h2 style="color:var(--bahaya)">⚠️ ${aktif.length} regu TIDAK ADA di kertas</h2>
      <p class="description">Nomor-nomor ini disisipkan setelah daftar kloter dicetak.
         Bacakan ke petugas staging kloter terkait, atau tulis tangan di kertasnya.</p>
      <table class="table" style="background:#fff;border-radius:8px;margin-top:.6rem">${baris}</table>
      <button class="button button-secondary" onclick="window.print()" type="button"
              style="margin-top:.6rem">🖨️ Cetak daftar sisipan</button>
    </div>`;
}

/* ---------------- layar "edisi belum termuat" ---------------- */

function layarButuhEdisi(judul) {
  pasangKepala(judul);
  LAYAR.replaceChildren(kartuGagalMuat(
    "Data acara (biaya per regu) belum terbaca, jadi tagihan tidak bisa dihitung.",
    async () => { try { EDISI = await infoEdisi(); } catch {} arahkan(); }));
}

/* ============================ REKAPITULASI (baca saja) ===================
   Lembar Rekapitulasi lengkap — bentuk yang sama dengan spreadsheet yang
   dipakai panitia selama tujuh tahun: satu baris per regu, SATU KOLOM PER
   KOMPONEN, Nilai Pos di ujung tiap kelompok, lalu kolom waktu, lalu Nilai
   Total. Kolomnya dibangun dari tabel `wahana`, bukan ditulis di sini, jadi
   penilaian tahun depan mengubah tabel ini tanpa menyentuh kode.

   LAYAR INI TIDAK BISA MENGUBAH APA PUN, dan itu disengaja. Satu-satunya
   pintu tulis nilai tetap layar Input Pos, yang memaksa operator menyebut
   posnya dan dijaga RLS. Kalau angka bisa diketik dari dua tempat, yang
   kedua cepat atau lambat akan melewatkan salah satu pagarnya.

   Angka-angkanya juga tidak dihitung di browser. Nilai Pos, penalti, total,
   dan peringkat semuanya datang jadi dari `v_rekap_penuh` — alasan yang sama
   dengan layar Input Pos: mesin skor kedua adalah mesin skor yang suatu hari
   berbeda pendapat dengan yang pertama.
   ------------------------------------------------------------------------ */

const NAMA_GOLONGAN = {
  penegak_pa: "Penegak PA", penegak_pi: "Penegak PI",
  penggalang_pa: "Penggalang PA", penggalang_pi: "Penggalang PI",
};
const URUTAN_GOLONGAN = ["penegak_pa", "penegak_pi", "penggalang_pa", "penggalang_pi"];

/** Satu sel nilai mentah, digambar seperti kotaknya di layar Input Pos —
 *  hanya saja mati, karena layar ini tidak pernah menulis.
 *
 *  Mengembalikan HTML yang SUDAH aman; pemanggilnya tidak boleh meng-esc
 *  lagi. Isinya cuma angka dari database dan penanda tetap, tidak ada teks
 *  bebas dari siapa pun.
 *
 *  Kolom biner memakai ikon centang, bukan huruf "v". Sebaris "v v v v"
 *  terbaca sebagai teks yang harus dieja satu per satu; centang tertangkap
 *  sekali sapu, dan itu bentuk yang sama dengan kotak centang di Input Pos
 *  dan dengan centang per pos di halaman peserta. */
function selRekap(w, isi) {
  const a = isi ? isi.nilai_1 : null;
  const b = isi ? isi.nilai_2 : null;

  // Belum dinilai — kosong, bukan nol. Kecuali biner: kotak centang tidak
  // punya keadaan kosong, jadi baris yang tersimpan berarti "tidak kena".
  if (a === null || a === undefined) {
    return w.form === "biner" && isi
      ? `<span class="rekap-tidak" aria-label="tidak">–</span>` : "";
  }
  if (w.form === "biner") {
    return Number(a) > 0
      ? `<span class="rekap-ya" aria-label="ya">✓</span>`
      : `<span class="rekap-tidak" aria-label="tidak">–</span>`;
  }
  if (w.form === "benar_kurang_salah") {
    return b === null || b === undefined
      ? esc(angkaRapi(a))
      : `${esc(angkaRapi(a))}<span class="pos-pemisah"> / </span>${esc(angkaRapi(b))}`;
  }
  // Bentuk yang sama dengan yang diketik di Input Pos — 32 detik tampil "32",
  // bukan "0:32". Dua layar yang menampilkan angka sama dengan bentuk berbeda
  // membuat orang mengira datanya yang berbeda.
  if (w.satuan === "detik") return esc(detikTeks(a));
  return esc(angkaRapi(a));
}

const angka = (n) => n === null || n === undefined ? "—"
  : String(Math.round(Number(n) * 100) / 100);

async function layarRekap() {
  const s = sesi();
  if (!bolehLihat("rekap")) {
    pasangKepala("Rekapitulasi");
    LAYAR.replaceChildren(h(html`
      <div class="card">
        <h2>Akun pos, bukan akun rekap</h2>
        <p><a class="button button-secondary" href="#/pos">Ke Input Nilai Pos</a></p>
      </div>`));
    return;
  }

  pasangKepala("Rekapitulasi", "lembar");
  LAYAR.replaceChildren(h(pemuat()));

  const layarIni = location.hash;
  let pos, wahana, baris, kelengkapan;
  try {
    [pos, wahana, baris, kelengkapan] = await Promise.all([
      daftarPos(), komponenSemua(EDISI.nomor), rekapPenuh(), kelengkapanPos(),
    ]);
  } catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarRekap)); return; }
  if (location.hash !== layarIni) return;

  // Hanya pos yang benar-benar dinilai. Pos 0 dan Pos 5 tidak punya komponen
  // (migrasi 0025), dan kolom yang selamanya kosong terbaca sebagai pos yang
  // panitianya lalai — bukan sebagai garis start dan garis finish.
  const posDinilai = pos.filter(p => (p.jumlah_komponen || 0) > 0);
  // Dikelompokkan dengan kolomPos() yang sama dengan layar Input Pos: satu
  // kolom per LOMBA. Tanpa ini Pos 1 memakan empat kolom "Tebak Simpul" yang
  // tiga di antaranya selalu kosong di setiap baris, dan tabel yang sudah 38
  // kolom bertambah panjang tanpa menambah satu keterangan pun.
  const posKolom = posDinilai.map(p => {
    const komponen = wahana.filter(w => Number(w.pos) === Number(p.nomor));
    return { ...p, kolom: kolomPos(komponen) };
  });

  /* SELALU satu golongan, tidak pernah gabungan — dan karena itu tidak ada
     pilihan "Semua". Rekap dibaca untuk menjawab "siapa juara Penegak PA",
     bukan "siapa juara seluruhnya": keempat golongan dinilai terpisah
     (alur-lomba.md 2.3), jadi satu daftar berisi keempatnya menampilkan
     peringkat 1 empat kali dan menyandingkan angka yang tidak pernah
     diperlombakan satu sama lain. Menggabungkannya juga melipatempatkan
     panjang tabel tanpa menjawab pertanyaan siapa pun. */
  let golongan = URUTAN_GOLONGAN[0];
  let cari = "";
  let posBelum = null;    // nomor pos yang sedang disaring "belum lengkap"
  let jamRefresh = new Date();
  let jeda = null;

  /** Berapa komponen pos ini yang sudah terisi untuk satu regu. Dihitung dari
   *  `nilai` yang SUDAH ada di tangan — tidak perlu permintaan tambahan, dan
   *  angkanya pasti sama dengan yang dipakai menggambar barisnya. */
  const komponenBaris = (p, b) =>
    p.kolom.map(kol => varianUntuk(kol, b.golongan)).filter(Boolean);

  const terisiDiPos = (b, p) => komponenBaris(p, b).reduce(
    (n, w) => n + ((b.nilai || {})[`${p.nomor}.${w.kode}`] ? 1 : 0), 0);

  const cocok = (b) => {
    if (golongan && b.golongan !== golongan) return false;
    if (posBelum !== null) {
      const p = posKolom.find(x => Number(x.nomor) === Number(posBelum));
      // Pembandingnya komponen yang berlaku untuk regu INI, bukan jumlah kolom
      // tabel. Regu Penggalang di Pos 1 punya tiga komponen sementara tabelnya
      // berkolom empat — dibandingkan dengan empat, saringan "belum lengkap"
      // tidak pernah menyembunyikan siapa pun dan jadi tidak berguna.
      if (p && terisiDiPos(b, p) >= komponenBaris(p, b).length) return false;
    }
    return !cari
      || (b.nama_sekolah || "").toLowerCase().includes(cari)
      || (b.nama_regu || "").toLowerCase().includes(cari)
      || dada3(b.nomor_dada ?? "").includes(cari);
  };

  /* Urutan: golongan dulu, lalu peringkat resmi, lalu total.
     Peringkat datang dari v_klasemen dan hanya ada untuk regu yang kloternya
     benar-benar berangkat — sepanjang lomba sebagian besar baris belum
     berperingkat. Yang belum berperingkat TIDAK dibuang; ia turun ke bawah
     kelompoknya, tetap terurut menurut total, supaya papan ini tetap terbaca
     sebagai klasemen sementara sejak nilai pertama masuk. */
  const urut = (a, b) => {
    const ga = URUTAN_GOLONGAN.indexOf(a.golongan), gb = URUTAN_GOLONGAN.indexOf(b.golongan);
    if (ga !== gb) return ga - gb;
    const pa = a.peringkat ?? Infinity, pb = b.peringkat ?? Infinity;
    if (pa !== pb) return pa - pb;
    return Number(b.total ?? 0) - Number(a.total ?? 0);
  };

  /* Kepala tabel meniru lembar Input Pos huruf demi huruf — `kolom-nama` yang
     boleh membungkus di atas `kolom-petunjuk` yang menyebut rentangnya.
     Petunjuknya memakai `petunjukKolom()` yang SAMA, bukan salinannya: kalau
     suatu hari rentang di satu layar berbeda dengan layar lain, panitia akan
     percaya yang salah. Bedanya cuma satu — di sini kelompok kolomnya
     berulang untuk tiap pos, dan tiap kelompok ditutup Nilai Pos-nya. */
  const kepala = () => {
    const perPos = posKolom.map(p => `
      ${p.kolom.map(kol => `
        <th class="text-center">
          <span class="kolom-nama">${esc(kol.nama)}</span>
          <span class="kolom-petunjuk">${esc(kol.petunjuk)}</span></th>`).join("")}
      <th class="text-center rekap-batas">Nilai<br>${
        esc(p.bayangan ? p.name : `Pos ${p.nomor}`)}</th>`).join("");
    return `
      <tr>
        <th class="text-center">Rank</th>
        <th class="text-center">Nomor<br>Dada</th>
        <th>Nama Regu</th>
        <th>Organisasi</th>
        <th>Golongan</th>
        ${perPos}
        <th class="text-center">Kloter</th>
        <th class="text-center">Berangkat</th>
        <th class="text-center">Datang</th>
        <th class="text-center">Tempuh<br><span class="kolom-petunjuk">menit</span></th>
        <th class="text-center">Kontrak<br><span class="kolom-petunjuk">menit</span></th>
        <th class="text-center">Selisih<br><span class="kolom-petunjuk">menit</span></th>
        <th class="text-center">Σ Pos</th>
        <th class="text-center">Penalti</th>
        <th class="text-center rekap-batas">Nilai<br>Total</th>
      </tr>`;
  };

  const barisHtml = (b) => {
    const nilai = b.nilai || {};
    const poin = b.poin_pos || {};
    const perPos = posKolom.map(p => `
      ${p.kolom.map(kol => {
        const w = varianUntuk(kol, b.golongan);
        return `<td class="text-center">${
          w ? selRekap(w, nilai[`${p.nomor}.${w.kode}`])
            : `<span class="sel-mati">–</span>`}</td>`;
      }).join("")}
      <td class="text-center pos-nilai rekap-batas">${poin[String(p.nomor)] === undefined
        ? "" : esc(angka(poin[String(p.nomor)]))}</td>`).join("");
    const penalti = Number(b.penalti_waktu || 0) + Number(b.penalti_checkout || 0)
      + Number(b.penalti_anggota || 0);
    const selisih = b.selisih_menit === null || b.selisih_menit === undefined
      ? "—" : `${b.selisih_menit > 0 ? "+" : ""}${b.selisih_menit}`;
    return `
      <tr>
        <td class="text-center rekap-rank">${b.peringkat ?? "—"}</td>
        <td class="text-center nomor-dada">${
          b.nomor_dada === null || b.nomor_dada === undefined
            ? "—" : esc(dada3(b.nomor_dada))}</td>
        <td>${esc(b.nama_regu)}</td>
        <td>${esc(b.nama_sekolah)}</td>
        <td>${esc(NAMA_GOLONGAN[b.golongan] || b.golongan)}</td>
        ${perPos}
        <td class="text-center">${b.kloter ?? "—"}</td>
        <td class="text-center">${esc(b.jam_berangkat ? jamMenit(b.jam_berangkat) : "—")}</td>
        <td class="text-center">${esc(b.jam_datang ? jamMenit(b.jam_datang) : "—")}</td>
        <td class="text-center">${b.tempuh_menit ?? "—"}</td>
        <td class="text-center">${b.kontrak_menit ?? "—"}</td>
        <td class="text-center">${esc(selisih)}</td>
        <td class="text-center">${esc(angka(b.total_pos))}</td>
        <td class="text-center">${penalti ? `−${penalti}` : "0"}</td>
        <td class="text-center pos-nilai rekap-batas">${esc(angka(b.total))}</td>
      </tr>`;
  };

  /* Panel kelengkapan. Tiga angka per pos, karena "90% terisi" sendirian
     tidak bisa dibedakan antara "regunya memang belum sampai" dan "datanya
     hilang" — lihat kepala migrasi 0028.

     Yang merah cuma satu hal: `hilang`, yaitu regu yang SUDAH selesai lomba
     tapi nilainya di pos itu belum lengkap. Mereka pasti melewati pos itu,
     jadi tidak ada penjelasan yang tidak buruk. */
  function kartuKelengkapan() {
    if (!kelengkapan.length) return "";
    const kartu = kelengkapan.map(k => {
      const penyebut = k.regu_berangkat;
      const persen = penyebut ? Math.round((k.lengkap / penyebut) * 100) : null;
      const diam = k.terakhir_masuk
        && Date.now() - new Date(k.terakhir_masuk).getTime() > 30 * 60000;
      const keadaan = k.hilang > 0 ? "bahaya"
        : (k.sebagian > 0 || diam) ? "menunggu"
        : (penyebut && k.lengkap === penyebut) ? "aman" : "";
      const aktif = Number(posBelum) === Number(k.pos);
      return `
        <button type="button" class="lengkap-kartu ${keadaan}${aktif ? " aktif" : ""}"
                data-pos-belum="${esc(String(k.pos))}"
                aria-pressed="${aktif}">
          <span class="lengkap-judul">${esc(k.bayangan ? k.nama_pos : `Pos ${k.pos}`)}</span>
          <span class="lengkap-angka">${penyebut
            ? `${esc(String(k.lengkap))}<span class="lengkap-dari">/${esc(String(penyebut))}</span>`
            : "—"}</span>
          <span class="lengkap-sub">${penyebut
            ? `${esc(String(persen))}% dari yang sudah berangkat`
            : "belum ada kloter berangkat"}</span>
          ${k.hilang > 0 ? `<span class="lengkap-alarm">⚠ ${esc(String(k.hilang))} sudah closing tapi belum lengkap</span>` : ""}
          ${k.sebagian > 0 ? `<span class="lengkap-catatan">${esc(String(k.sebagian))} baris terisi separuh</span>` : ""}
          <!-- Kalau pos ini yang membuat kartunya kuning, kalimat inilah
               alasannya — jadi ia ikut menguning. Warna yang alasannya harus
               ditebak sama saja dengan warna yang tidak ada. -->
          <span class="lengkap-catatan${diam ? " lengkap-diam" : ""}">${k.terakhir_masuk
            ? `nilai terakhir ${esc(jamMenit(k.terakhir_masuk))} (${esc(berapaLalu(k.terakhir_masuk))})`
            : "belum ada nilai masuk"}</span>
        </button>`;
    }).join("");

    return `
      <div class="card">
        <h2 style="font-size:1rem">Kelengkapan tiap pos</h2>
        <div class="lengkap-baris">${kartu}</div>
      </div>`;
  }

  // 5 kolom identitas + 9 kolom waktu/total, ditambah tiap komponen dan satu
  // Nilai Pos per kelompok. Dipakai colspan baris "tidak ada yang cocok" —
  // kalau meleset, barisnya tidak selebar tabelnya.
  const lebarKolom = 14 + posKolom.reduce((n, p) => n + p.kolom.length + 1, 0);

  /* ==========================================================================
     KERANGKA DIBANGUN SEKALI, ISINYA DIPERBARUI DI TEMPAT.

     Sebelumnya seluruh kartu digambar ulang tiap kali apa pun berubah —
     termasuk sendirinya tiap 20 detik. Tabel ini lebarnya ±38 kolom dan
     dipakai sambil digeser, jadi menggambar ulang berarti:

       · geseran samping kembali ke kolom pertama, tiap 20 detik. Orang yang
         sedang membandingkan Pos 4 dilempar balik ke Nomor Dada, dan layarnya
         "gerak-gerak terus";
       · kotak cari diganti dengan kotak baru di tengah orang mengetik, jadi
         mengetik "001" terputus di huruf kedua;
       · posisi gulir ke bawah, fokus papan ketik, dan teks yang sedang
         disorot ikut hilang.

     Sekarang yang diganti hanya `<tbody>`, kartu kelengkapan, dan beberapa
     angka. Kotak cari, kepala tabel, dan pembungkus yang memegang geseran
     TIDAK PERNAH disentuh — jadi layar ini bisa dibiarkan terbuka seharian
     dan tetap diam di tempat yang ditinggalkan, seperti spreadsheet.
     ======================================================================== */
  function bangunKerangka() {
    LAYAR.replaceChildren(h(`
      <div id="rekap-panel"></div>
      <div class="card">
        <div class="table-toolbar">
          <div class="field kotak-cari">
            <label for="rekap-cari" class="visually-hidden">Cari</label>
            <input type="text" id="rekap-cari" autocomplete="off"
                   placeholder="Cari sekolah, regu, atau nomor dada…">
          </div>
          <div class="filter-row" id="rekap-golongan">
            ${URUTAN_GOLONGAN.map(g => `
              <button type="button" class="option option-small" data-gol="${g}"
                      aria-pressed="false">${esc(NAMA_GOLONGAN[g])}</button>`).join("")}
          </div>
          <!-- Keduanya SATU kelompok, bukan dua anak lepas dari toolbar.
               Sebagai anak lepas, tombolnya jatuh sendirian ke baris baru
               begitu deretan saringan penuh dan terlihat seperti tombol
               nyasar.

               Jam refresh TIDAK ikut di sini. Ia sempat berdiri di sebelah
               "N regu", dan dua label abu-abu setara yang berdempetan di
               ujung baris yang sudah padat harus dibaca satu per satu untuk
               dipisahkan — ujung baris ini justru tempat mata paling jarang
               berhenti. Jamnya pindah ke kalimat keterangan di bawah, yang
               memang sudah prosa dan tidak dibaca sebagai data. -->
          <div class="toolbar-kanan">
            <span class="table-count" id="rekap-jumlah"></span>
            <!-- Ikon, bukan kata: tombol ini berdiri di deretan yang sudah
                 penuh saringan golongan, dan satu kata lagi memakan lebar
                 yang lebih berguna untuk kotak cari. Judul dan aria-label
                 tetap berbunyi lengkap — yang hilang hanya tulisannya. -->
            <button class="icon-button icon-button-inline" id="rekap-refresh"
                    type="button" aria-label="Refresh sekarang">${ikonRefresh}</button>
          </div>
        </div>
        <p class="description">
           <!-- Jamnya di sini, bukan di deretan tombol: data ini sering
                kembali tanpa satu angka pun berubah, jadi tanpa jam yang
                bergerak menekan refresh terasa seperti menekan tombol mati.
                Di dalam kalimat ia tetap terbaca saat dicari, tanpa ikut
                bersaing setiap kali mata menyapu baris alat di atas. -->
           <span id="rekap-catatan"></span></p>
        <!-- Kelas tabelnya SAMA PERSIS dengan lembar Input Pos, ditambah
             satu pengubah: di HP ia tetap tabel yang digeser ke samping,
             tidak ditumpuk jadi kartu seperti layar meja.

             PEMBUNGKUS INI TIDAK PERNAH DIGANTI. Dialah yang memegang
             geseran samping, dan mengganti elemennya berarti mengembalikan
             geseran ke nol — yang persis membuat layar ini "gerak-gerak"
             tiap 20 detik. Yang diganti cuma isi <tbody> di dalamnya. -->
        <div class="table-wrapper table-wrapper-tetap">
          <table class="table data-table table-tetap table-pos table-rekap">
            <thead>${kepala()}</thead>
            <tbody id="rekap-isi"></tbody>
          </table>
        </div>
      </div>`));

    /* Listener dipasang SEKALI, lewat delegasi. Kartu kelengkapan digambar
       ulang tiap refresh, jadi listener yang menempel di tiap tombolnya akan
       ikut hilang — didelegasikan ke pembungkusnya yang memang tidak pernah
       diganti. */
    document.getElementById("rekap-golongan").addEventListener("click", (e) => {
      const b = e.target.closest("[data-gol]");
      if (!b) return;
      golongan = b.dataset.gol;
      gambarTabel();
    });

    // Mengetuk pos yang sedang aktif MEMATIKAN saringannya. Tanpa itu tidak
    // ada jalan kembali ke seluruh regu selain menebak-nebak tombol lain.
    document.getElementById("rekap-panel").addEventListener("click", (e) => {
      const b = e.target.closest("[data-pos-belum]");
      if (!b) return;
      const n = Number(b.dataset.posBelum);
      posBelum = Number(posBelum) === n ? null : n;
      gambarPanel();
      gambarTabel();
    });

    // Kotak cari tidak pernah diganti lagi, jadi tidak ada lagi kursor yang
    // perlu dipulangkan — mengetik "001" berjalan utuh walau refresh otomatis
    // lewat di tengah ketikan.
    document.getElementById("rekap-cari").addEventListener("input", (e) => {
      cari = e.target.value.trim().toLowerCase();
      gambarTabel();
    });

    document.getElementById("rekap-refresh")
      .addEventListener("click", () => refresh(true));
  }

  /** Kartu kelengkapan saja. Terpisah dari tabel karena keduanya berubah pada
   *  saat yang berbeda: panel hanya saat data baru datang, tabel juga saat
   *  saringan diubah. */
  function gambarPanel() {
    document.getElementById("rekap-panel").innerHTML = kartuKelengkapan();
  }

  /** Isi tabel + angka-angka kecil di sekelilingnya. Tidak menyentuh satu pun
   *  elemen yang memegang keadaan layar: kotak cari, kepala tabel, dan
   *  pembungkus yang memegang geseran tetap di tempatnya. */
  function gambarTabel() {
    const tampil = baris.filter(cocok).sort(urut);

    document.getElementById("rekap-isi").innerHTML = tampil.length
      ? tampil.map(barisHtml).join("")
      : `<tr><td colspan="${lebarKolom}" class="table-empty">
           Tidak ada regu ${esc(NAMA_GOLONGAN[golongan] || "")} yang cocok${
             posBelum !== null ? ` dan belum lengkap di Pos ${esc(String(posBelum))}` : ""
           }.</td></tr>`;

    document.getElementById("rekap-jumlah").textContent = `${tampil.length} regu`;

    document.getElementById("rekap-golongan")
      .querySelectorAll("[data-gol]").forEach(b =>
        b.setAttribute("aria-pressed", String(b.dataset.gol === golongan)));

    document.getElementById("rekap-refresh").title =
      `Refresh sekarang · terakhir ${jamMenit(jamRefresh)}`;

    document.getElementById("rekap-catatan").innerHTML =
      `Terakhir di-refresh <strong>${esc(jamMenit(jamRefresh))}</strong>.`;
  }

  /* Menyegarkan sendiri tiap 20 detik. Inilah yang membuat papan ini terasa
     "live": operator pos menyimpan satu baris, dan koordinator yang menatap
     layar ini melihat angkanya masuk tanpa menekan apa pun.
     Jumlah pembacanya belasan, bukan ribuan seperti halaman peserta, jadi
     membaca langsung dari database di sini memang murah. */
  async function refresh(manual = false) {
    if (location.hash !== layarIni) return;
    // Hanya klik yang diberi putaran. Segaran otomatis tiap 20 detik dibiarkan
    // diam-diam: penanda yang berkedip sendiri tiap 20 detik sepanjang hari
    // akan berhenti diperhatikan justru saat ia dibutuhkan.
    const tombol = manual ? document.getElementById("rekap-refresh") : null;
    if (tombol) { tombol.classList.add("berputar"); tombol.disabled = true; }
    const mulai = Date.now();
    try {
      const [b, k] = await Promise.all([rekapPenuh(), kelengkapanPos()]);
      baris = b; kelengkapan = k;
      // Dipasang SETELAH datanya benar-benar sampai, bukan saat permintaan
      // dikirim: yang dijanjikan cap ini "angka di layar ini seumur jam itu".
      jamRefresh = new Date();
      // Klik HARUS terasa dijawab. Datanya sering kembali dalam puluhan
      // milidetik dan sering tidak mengubah satu angka pun — putaran yang
      // berhenti seketika karena itu terbaca sebagai tombol yang tidak
      // bekerja sama sekali. Setengah detik cukup untuk terlihat berputar.
      if (manual) {
        const sisa = 500 - (Date.now() - mulai);
        if (sisa > 0) await new Promise(r => setTimeout(r, sisa));
      }
      if (location.hash !== layarIni) return;
      // HANYA angkanya yang diganti. Geseran samping, posisi gulir, kotak
      // cari, dan fokus papan ketik tidak disentuh sama sekali.
      gambarPanel();
      gambarTabel();
      if (tombol) { tombol.classList.remove("berputar"); tombol.disabled = false; }
    } catch (e) {
      if (tombol) { tombol.classList.remove("berputar"); tombol.disabled = false; }
      // api.js sudah melewatkan pesannya lewat pesanRamah() sebelum melempar,
      // jadi yang sampai di sini memang kalimat yang boleh dibaca panitia.
      if (manual) notif(e.message, true);
    }
  }

  bangunKerangka();
  gambarPanel();
  gambarTabel();

  /* -------------------------------------------------------------------------
     TAB DI LATAR: BERHENTI TOTAL. TAB DIBUKA LAGI: LANGSUNG MENYUSUL.

     Selama tab ini tidak dilihat, tidak ada gunanya bertanya ke database tiap
     20 detik — jawabannya tidak dibaca siapa pun, dan papan ini memang
     dibiarkan terbuka berjam-jam di sebelah tab lain. Jadi denyutnya
     dimatikan, bukan sekadar dilewati.

     Yang menyalakannya lagi adalah kepulangan itu sendiri: `segarkanDiTempat`
     mengambil angka terbaru SEKALIGUS menghidupkan kembali denyutnya, jadi
     layar yang dibuka lagi sudah menyusul sebelum mata sempat membacanya.
     ---------------------------------------------------------------------- */
  const mulaiDenyut = () => {
    if (jeda !== null) return;
    jeda = setInterval(() => {
      // Membersihkan dirinya sendiri: satu tempat yang memutuskan berhenti,
      // dipakai baik saat berpindah layar maupun saat tab disembunyikan.
      if (location.hash !== layarIni || document.hidden) {
        clearInterval(jeda); jeda = null; return;
      }
      refresh();
    }, 20000);
  };

  segarkanDiTempat = () => { refresh(); mulaiDenyut(); };

  mulaiDenyut();
}

/* ======================= LIVE SCORE (ADMIN) ============================== */

/** Persis yang akan dilihat peserta, dibuka lebih awal untuk admin saja.
 *
 *  KENAPA LAYAR TERSENDIRI, BUKAN MENYALAKAN HALAMAN PESERTA LEBIH AWAL.
 *  Halaman peserta membaca berkas statis yang diterbitkan publish-live.yml,
 *  dan menyalakannya lebih awal berarti menerbitkan hasil lomba ke alamat
 *  yang sudah beredar ke ratusan orang. Tidak ada tombol "hanya untuk saya"
 *  di berkas statis — begitu terbit, ia terbit untuk semua.
 *
 *  Jadi Live Score tinggal di situs panitia, di balik login yang sudah ada,
 *  membaca database langsung. Yang dilihat admin sama persis, yang dilihat
 *  peserta belum berubah sama sekali. */
async function layarLiveScore() {
  pasangKepala("Live Score", true);
  LAYAR.replaceChildren(h(pemuat()));
  const layarIni = location.hash;

  let pos, klasemen, status, posSemua, komponen, rekap;
  try {
    [pos, klasemen, status, posSemua, komponen, rekap] = await Promise.all([
      kelengkapanPos(), klasemenLiveScore(), statusAcara(),
      daftarPos(), komponenSemua(EDISI.nomor), rekapPenuh(),
    ]);
  } catch (e) {
    LAYAR.replaceChildren(kartuGagalMuat(e.message, layarLiveScore));
    return;
  }
  if (location.hash !== layarIni) return;

  // `let`, bukan `const`: saklar di bawah memperbaruinya DI TEMPAT.
  let fase = (status && status.fase_live) || "pra";
  // Persen dihitung di sini, bukan di view. `v_kelengkapan_pos` sudah membawa
  // `lengkap` dan `regu_total`, dan menambah view yang menghitung pembagian
  // itu adalah tempat kedua yang harus ikut benar setiap kali definisi
  // "lengkap" berubah.
  const persenPos = (p) => !p.regu_total
    ? 0 : Math.floor(100 * p.lengkap / p.regu_total);

  /** Merah -> kuning -> hijau mengikuti persennya, bukan tiga anak tangga.

   *  Tangga membuat 49% dan 51% terlihat sangat berbeda padahal selisihnya satu
   *  regu, sementara 51% dan 89% terlihat sama padahal itu dua puluh regu.
   *  Gradasi menampilkan JARAKNYA, dan jarak itu yang ditanyakan orang saat
   *  melirik lima cincin sekaligus.
   *
   *  Rona 0 di 0%, 50 di 50%, 140 di 100% — merah, kuning, hijau. Angkanya
   *  tetap tertulis di dalam cincin, jadi warna tidak pernah jadi satu-satunya
   *  kabar bagi yang sulit membedakan merah dari hijau. */
  const warnaPersen = (s) => {
    const p = Math.max(0, Math.min(100, Number(s) || 0));
    const rona = p <= 50 ? p : 50 + (p - 50) * 1.8;
    return `hsl(${Math.round(rona)}, 72%, 40%)`;
  };

  const kemajuan = `
    <div class="card">
      <h2 class="judul-tengah">Status</h2>
      <ul class="kemajuan">
        ${pos.map(p => {
          const s = persenPos(p);
          return `
          <li>
            <div class="cincin" style="--persen:${s};--warna:${warnaPersen(s)}"
                 role="img" aria-label="Pos ${esc(String(p.pos))} ${esc(String(s))} persen selesai">
              <span>${esc(String(s))}<i>%</i></span>
            </div>
            <div class="c-nama">Pos ${esc(String(p.pos))} · ${esc(p.nama_pos)}</div>
            <div class="c-angka">${esc(String(p.lengkap))} / ${esc(String(p.regu_total))} regu</div>
          </li>`;
        }).join("")}
      </ul>
    </div>`;

  const MEDALI = { 1: "🥇", 2: "🥈", 3: "🥉" };

  /* Kolom rincian dibangun dengan kolomPos() yang SAMA dengan layar Input Pos
     dan Rekapitulasi. Satu kolom per LOMBA, bukan per baris wahana — tanpa itu
     Pos 1 memakan empat kolom "Tebak Simpul" yang isinya saling meniadakan,
     satu per golongan, dan tabelnya memanjang tanpa menambah satu keterangan
     pun. */
  const posKolom = posSemua
    .filter(p => p.jumlah_komponen > 0)
    .map(p => ({ ...p, kolom: kolomPos(komponen.filter(k => k.pos === p.nomor)) }));
  const rekapDada = new Map(rekap.map(r => [r.nomor_dada, r]));
  /* KEEMPAT golongan selalu digambar, dengan urutan tetap — bukan hanya yang
     kebetulan sudah punya baris.
     Empat golongan berlomba TERPISAH: masing-masing punya juara sendiri, dan
     tidak ada satu pun peringkat yang membandingkan Penggalang dengan
     Penegak. Menggambar hanya golongan yang sudah terisi membuat papannya
     berubah bentuk sepanjang hari — Penegak PI muncul belakangan lalu
     menggeser semuanya — dan yang lebih buruk, golongan yang belum satu pun
     regunya masuk terlihat seperti golongan yang tidak ada. */
  const bisaPublish = bolehLihat("pengaturan");
  const FASE = [
    ["pra", "Pra"], ["progres", "Progres"], ["penuh", "Live"],
  ];
  const saklar = !bisaPublish ? "" : `
    <div class="segmen-fase" role="group" aria-label="Fase Live Score">
      ${FASE.map(([kode, teks]) => `
        <button type="button" class="button ${kode === fase ? "button-primary" : ""}"
                data-fase="${esc(kode)}" ${kode === fase ? "aria-current=\"true\"" : ""}
                style="padding:.3rem .7rem;font-size:.85rem">${esc(teks)}</button>`).join("")}
    </div>`;

  const kartuGolongan = (g) => {
        const baris = klasemen.filter(k => k.golongan === g);
        const juara = baris.filter(k => k.peringkat <= 3);
        const sekolahAda = [...new Set(baris.map(k => k.nama_sekolah).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, "id"));
        if (!baris.length) return `
        <div class="card">
          <div class="kepala-klasemen">
            <div class="sisi"></div>
            <!-- "sementara" yang membawa faktanya: papan ini memeringkat dari
                 poin yang terkumpul SEKARANG, jadi urutannya bisa berubah
                 sampai pos terakhir terisi. Tanpa kata itu, tiga medali di
                 layar besar terbaca seperti hasil — dan itu yang diumumkan
                 orang. -->
            <h2>Klasemen sementara</h2>
            <div class="sisi kanan">${saklar}</div>
          </div>
          <p class="description">Belum ada regu golongan ini yang bisa
            diperingkat.</p>
        </div>`;
        return `
        <div class="card">
          <div class="kepala-klasemen">
            <div class="sisi"></div>
            <!-- "sementara" yang membawa faktanya: papan ini memeringkat dari
                 poin yang terkumpul SEKARANG, jadi urutannya bisa berubah
                 sampai pos terakhir terisi. Tanpa kata itu, tiga medali di
                 layar besar terbaca seperti hasil — dan itu yang diumumkan
                 orang. -->
            <h2>Klasemen sementara</h2>
            <div class="sisi kanan">${saklar}</div>
          </div>
          <div class="podium">
            ${juara.map(k => `
              <div class="juara j${esc(String(k.peringkat))}">
                <div class="medali" aria-hidden="true">${MEDALI[k.peringkat] || ""}</div>
                <div class="j-teks">
                  <div class="peringkat">Juara ${esc(String(k.peringkat))}
                    <span class="dada-juara">${esc(dada3(k.nomor_dada))}</span></div>
                  <div class="nama">${esc(k.nama_regu)}</div>
                  <div class="sekolah">${esc(k.nama_sekolah)}</div>
                </div>
                <div class="total">${esc(angkaRapi(k.total))}</div>
              </div>`).join("")}
          </div>
          <!-- Penyaring sekolah. Daftarnya dibangun dari baris golongan INI,
               bukan dari seluruh sekolah: memilih sekolah yang tidak punya
               regu di golongan yang sedang dibuka menghasilkan tabel kosong
               tanpa satu pun petunjuk kenapa.

               <details> biasa, bukan dropdown buatan sendiri — ia sudah bisa
               dibuka dengan sentuhan, ditutup dengan Esc, dan dibacakan
               pembaca layar tanpa satu baris JS pun. -->
          <!-- Panelnya di ATAS tabel, tapi yang diklik KEPALA KOLOMNYA.
               Panel ini tidak bisa ditaruh di dalam <th>: tabelnya duduk di
               dalam wadah bergulir, dan apa pun yang mengambang di dalam sana
               terpotong begitu daftarnya lebih tinggi dari kepala tabel. -->
          <div class="isi-filter" hidden>
            <button type="button" class="button tombol-semua"
                    style="padding:.25rem .6rem;font-size:.8rem">Hapus saringan</button>
            ${sekolahAda.map(nm => `
              <label><input type="checkbox" value="${esc(nm)}"> ${esc(nm)}</label>`).join("")}
          </div>
          <div class="table-wrapper table-wrapper-tetap">
            <table class="table data-table table-tetap table-rekap table-live">
              <thead>
                <tr>
                  <th rowspan="2">#</th>
                  <th rowspan="2">No<br>Dada</th>
                  <th rowspan="2">Regu</th>
                  <!-- Kepala kolomnya SENDIRI yang jadi tombol saringan.
                       Tombol terpisah di atas tabel menjauhkan aksinya dari
                       kolom yang disaringnya, dan menambah satu benda lagi di
                       layar yang sudah padat. -->
                  <th rowspan="2" class="rekap-batas th-saring" tabindex="0"
                      role="button" aria-expanded="false"
                      title="Klik untuk menyaring per sekolah">Organisasi
                    <span class="hitung-filter"></span> <span aria-hidden="true">▾</span></th>
                  ${posKolom.map(p => `<th colspan="${p.kolom.length + 1}"
                    class="rekap-batas">Pos ${esc(String(p.nomor))} · ${esc(p.name)}</th>`).join("")}
                  <th rowspan="2">Penalti</th>
                  <th rowspan="2">Total</th>
                </tr>
                <tr>
                  ${posKolom.map(p => p.kolom.map(kol =>
                      `<th class="pos-kol">${esc(kol.nama)}</th>`).join("")
                    + `<th class="pos-kol rekap-batas">Nilai</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${baris.map(k => {
                  const rk = rekapDada.get(k.nomor_dada) || {};
                  const nilai = rk.nilai || {};
                  const poin = k.poin_per_pos || {};
                  return `
                  <tr data-sekolah="${esc(k.nama_sekolah || "")}">
                    <td class="rekap-rank">${MEDALI[k.peringkat] || ""}<span class="rank-angka">${esc(String(k.peringkat))}</span></td>
                    <td class="angka">${esc(dada3(k.nomor_dada))}</td>
                    <td>${esc(k.nama_regu)}</td>
                    <td class="rekap-batas sub-kolom">${esc(k.nama_sekolah)}</td>
                    ${posKolom.map(p => p.kolom.map(kol => {
                        // Satu lomba bisa punya baris wahana berbeda per
                        // golongan; yang berlaku untuk regu INI yang dibaca.
                        const w = varianUntuk(kol, k.golongan);
                        return `<td class="text-center">${w
                          ? selRekap(w, nilai[`${p.nomor}.${w.kode}`])
                          : `<span class="sel-mati">–</span>`}</td>`;
                      }).join("")
                      + `<td class="text-center pos-nilai rekap-batas">${
                          poin[String(p.nomor)] === undefined
                            ? "–" : esc(angkaRapi(poin[String(p.nomor)]))}</td>`).join("")}
                    <td class="text-center">${esc(angkaRapi(
                      Number(k.penalti_waktu) + Number(k.penalti_checkout)
                      + Number(k.penalti_anggota)))}</td>
                    <td class="text-center"><strong>${esc(angkaRapi(k.total))}</strong></td>
                  </tr>`;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>`;
  };

  /* SATU golongan pada satu waktu, dipilih lewat tab.
     Empat papan bertumpuk berarti detail Penegak PI ada empat layar penuh di
     bawah — dan yang membuka layar ini hampir selalu sedang menanyakan SATU
     golongan, bukan membandingkan keempatnya. Keempat tab tetap terlihat
     sekaligus dengan jumlah regunya, jadi yang hilang cuma gulirannya.

     Semua panel digambar sekali lalu disembunyikan, bukan digambar ulang saat
     diklik: datanya sudah ada di tangan, dan berpindah tab yang menunggu
     apa pun terasa rusak. */
  const GOL = URUT_GOLONGAN;
  const jumlahGol = Object.fromEntries(
    GOL.map(g => [g, klasemen.filter(k => k.golongan === g).length]));
  // Tab pertama yang sudah ada isinya, supaya layar tidak terbuka pada
  // golongan kosong ketika golongan lain justru sudah penuh.
  const golAktif = GOL.find(g => jumlahGol[g] > 0) || GOL[0];

  const tab = !klasemen.length ? "" : `
    <div class="tab-golongan" role="tablist" aria-label="Golongan">
      ${GOL.map(g => `
        <button type="button" role="tab" class="tab-gol" data-gol="${esc(g)}"
                aria-selected="${g === golAktif ? "true" : "false"}">
          ${esc(GOLONGAN_LABEL[g])}
          <span class="tab-hitung">${esc(String(jumlahGol[g]))}</span>
        </button>`).join("")}
    </div>`;

  const papan = !klasemen.length
    ? `<div class="card"><p class="description">Belum ada regu yang bisa
         diperingkat di golongan mana pun.</p></div>`
    : GOL.map(g => `<div class="panel-gol" data-gol="${esc(g)}"${
        g === golAktif ? "" : " hidden"}>${kartuGolongan(g)}</div>`).join("");

  /* Kartu pemberitahuan DIHAPUS (CLAUDE.md 9.1 dan 9.3). Judul layarnya
     sudah "Live Score" di kepala halaman; mengulanginya di dalam badan,
     ditambah dua paragraf yang mengajarkan arti fase, adalah tiga baris yang
     dibaca ratusan kali per shift untuk satu hal yang dipelajari sekali.
     Fase yang sedang berlaku sekarang dibawa TOMBOLNYA — di situ ia fakta
     yang tidak bisa dibaca dari layar, bukan pelajaran.

     Tombolnya hanya untuk yang memegang `pengaturan` — bawaannya admin. Yang
     lain tidak melihat apa pun di tempat ini, bukan tombol mati: tombol mati
     di pojok tidak memberi tahu apa pun selain ada sesuatu yang tidak boleh
     disentuh. */
  /* Judul di TENGAH, saklar tiga keadaan di KANAN, satu baris.
     Tombol besar sebelumnya memakan tinggi layar untuk sesuatu yang ditekan
     dua kali sepanjang acara. Tiga keadaan ditampilkan sekaligus, bukan satu
     tombol yang berganti tulisan: dengan begitu fase yang SEDANG berlaku
     terbaca tanpa harus tahu apa arti tulisan tombolnya.

     "sementara" di judulnya membawa fakta yang tidak bisa dibaca dari layar:
     papan ini memeringkat dari poin yang terkumpul SEKARANG, jadi urutannya
     bisa berubah sampai pos terakhir terisi. Tanpa kata itu, tiga medali di
     layar besar terbaca seperti hasil — dan itu yang diumumkan orang. */
  LAYAR.replaceChildren(h(`
    ${kemajuan}
    ${tab}
    ${papan}`));

  /* Diperbarui DI TEMPAT, bukan dengan menggambar ulang layar.
     layarLiveScore() menarik enam permintaan sekaligus — klasemen, rekap,
     kelengkapan, pos, komponen, status — dan menggambar ulang seluruh papan.
     Untuk satu kolom yang berpindah itu mahal, dan yang paling terasa: papan
     berkedip dan tab golongan yang sedang dibuka kembali ke awal. Yang
     berubah di layar cuma tombol mana yang menyala. */
  LAYAR.querySelectorAll("[data-fase]").forEach(tb => {
    tb.addEventListener("click", async () => {
      const ke = tb.dataset.fase;
      if (ke === fase) return;
      const semua = LAYAR.querySelectorAll("[data-fase]");
      semua.forEach(x => { x.disabled = true; });
      try {
        await aturFaseLive(ke);
        fase = ke;
        semua.forEach(x => {
          const aktif = x.dataset.fase === ke;
          x.classList.toggle("button-primary", aktif);
          if (aktif) x.setAttribute("aria-current", "true");
          else x.removeAttribute("aria-current");
        });
        // Halaman peserta ikut dalam hitungan detik: ia membaca fase langsung
        // dari database tiap poll (0070). Yang masih perlu diterbitkan hanya
        // ISINYA — saklar cuma bisa memperketat, tidak membuka lebih dari
        // yang sudah terbit.
        notif(ke === "penuh"
          ? "Live. Kalau klasemennya belum pernah diterbitkan, jalankan Publish rekap live."
          : ke === "progres" ? "Peserta melihat kemajuan, bukan nilai."
          : "Peserta tidak melihat apa pun.");
      } catch (e) {
        notif(e.message, true);
      } finally {
        semua.forEach(x => { x.disabled = false; });
      }
    });
  });

  /* Penyaring sekolah, satu per panel golongan.
   *
   *  Menyaring BARIS TABEL saja — podium juara dibiarkan utuh. Tiga medali
   *  itu menjawab "siapa juara golongan ini"; menyaringnya per sekolah akan
   *  menjadikan regu peringkat sembilan tampil sebagai Juara 1, dan itu
   *  gambar yang difoto lalu disebarkan.
   *
   *  Peringkat di kolom pertama juga TIDAK dihitung ulang: ia peringkat di
   *  golongannya, bukan nomor urut baris yang sedang tampil. Menyaring
   *  sekolah lalu melihat "1, 4, 7" adalah jawaban yang benar. */
  LAYAR.querySelectorAll(".panel-gol").forEach(panel => {
    const kotak = [...panel.querySelectorAll(".isi-filter input[type=checkbox]")];
    const hitung = panel.querySelector(".hitung-filter");
    const semua = panel.querySelector(".tombol-semua");
    if (!kotak.length) return;

    const terapkan = () => {
      const pilih = new Set(kotak.filter(c => c.checked).map(c => c.value));
      panel.querySelectorAll("tbody tr[data-sekolah]").forEach(tr => {
        tr.hidden = pilih.size > 0 && !pilih.has(tr.dataset.sekolah);
      });
      // Angkanya, bukan kata "aktif": panitia perlu tahu BERAPA yang sedang
      // menyaring tanpa membuka daftarnya.
      hitung.textContent = pilih.size ? `(${pilih.size})` : "";
      panel.querySelector(".th-saring").classList.toggle("menyaring", pilih.size > 0);
    };

    const kepala = panel.querySelector(".th-saring");
    const isi = panel.querySelector(".isi-filter");
    const buka = () => {
      isi.hidden = !isi.hidden;
      kepala.setAttribute("aria-expanded", String(!isi.hidden));
    };
    if (kepala) {
      kepala.addEventListener("click", buka);
      // Keyboard juga: <th> bukan tombol, jadi Enter/Space tidak datang
      // sendiri walau tabindex dan role sudah dipasang.
      kepala.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); buka(); }
      });
    }

    kotak.forEach(c => c.addEventListener("change", terapkan));
    if (semua) semua.addEventListener("click", () => {
      kotak.forEach(c => { c.checked = false; });
      terapkan();
    });
  });

  const bilah = LAYAR.querySelector(".tab-golongan");
  if (bilah) {
    bilah.addEventListener("click", (e) => {
      const b = e.target.closest("[data-gol]");
      if (!b) return;
      const pilih = b.dataset.gol;
      bilah.querySelectorAll("[data-gol]").forEach(x =>
        x.setAttribute("aria-selected", String(x.dataset.gol === pilih)));
      LAYAR.querySelectorAll(".panel-gol").forEach(pn => {
        pn.hidden = pn.dataset.gol !== pilih;
      });
    });
  }
}

/* ============================ AKUN ======================================= */

const PERAN_LABEL = { admin: "Admin", registrasi: "Registrasi",
                      gerbang: "Gerbang", juri_pos: "Juri Pos" };

/** Kartu password. Ditampilkan SEKALI — tidak disimpan di mana pun dan tidak
 *  bisa dibaca lagi setelah dialognya ditutup, persis seperti CSV hasil
 *  provision_accounts.py. Karena itu dialognya baca-saja: tidak ada tombol
 *  Batal yang bisa tertekan sebelum angkanya sempat dicatat. */
function tampilkanPassword(judul, baris) {
  return dialog({
    judul,
    bacaSaja: true,
    labelAksi: "Sudah dicatat",
    kartuHtml: `
      <div class="card">
        <table class="table">
          <thead><tr><th>Nama akun</th><th>Password</th></tr></thead>
          <tbody>${baris.map(b => `
            <tr><td>${esc(b.username)}</td>
                <td><code style="font-size:1.15em">${esc(b.password)}</code></td></tr>`).join("")}
          </tbody>
        </table>
      </div>
      <p>Password ini tidak bisa dibuka lagi setelah kotak ini ditutup.</p>`,
  });
}

async function layarAkun() {
  pasangKepala("Akun", true);

  // RLS yang sebenarnya menahan — ini supaya layarnya tidak tampak kosong dan
  // membingungkan kalau alamatnya diketik langsung.
  if (!bolehLihat("akun")) {
    LAYAR.replaceChildren(h(kartuGalat("Hanya admin yang bisa mengelola akun.")));
    return;
  }

  LAYAR.replaceChildren(h(pemuat()));
  const layarIni = location.hash;
  let akun, fitur, hak;
  try { [akun, fitur, hak] = await Promise.all([daftarAkun(), daftarFitur(), daftarHak()]); }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarAkun)); return; }
  if (location.hash !== layarIni) return;

  // Dijodohkan di browser: 20 akun x 11 fitur cuma 220 baris, jadi satu
  // bacaan lebih murah daripada satu query per akun.
  const punya = new Set(hak.map(x => `${x.user_id}|${x.fitur}`));
  const opsiPeran = (dipilih) => Object.entries(PERAN_LABEL)
    .map(([k, v]) => `<option value="${k}"${k === dipilih ? " selected" : ""}>${esc(v)}</option>`)
    .join("");

  LAYAR.replaceChildren(h(`
    <div class="card">
      <h2>Buat Akun</h2>
      <!-- .table-toolbar, bukan .option-row: option-row itu grid DUA kolom
           (style.css), jadi empat isian di dalamnya jatuh 2x2 dan kotak Pos
           yang isinya satu angka mendapat setengah lebar kartu. -->
      <!-- Rata BAWAH, bukan rata tengah seperti toolbar saring: di sana label
           kotak carinya visually-hidden sehingga tidak memakan tinggi, di
           sini labelnya terlihat — dan rata tengah membuat tombolnya melayang
           setinggi label, tidak sejajar dengan kotak isian di sebelahnya. -->
      <div class="table-toolbar" style="align-items:flex-end">
        <div class="field"><label for="ak-nama">Nama akun</label>
          <input id="ak-nama" type="text" class="small-input" autocomplete="off"
            placeholder="pos1hrcd37" style="width:14rem"></div>
        <div class="field"><label for="ak-peran">Peran</label>
          <select id="ak-peran" class="select-small">${opsiPeran("meja")}</select></div>
        <div class="field"><label for="ak-pos">Pos</label>
          <input id="ak-pos" type="number" class="small-input" inputmode="numeric"
            min="1" max="20" style="width:5rem" disabled></div>
        <button class="button button-primary option-small" id="ak-buat" type="button">Buat Akun</button>
      </div>
      <details>
        <summary>Buat banyak sekaligus</summary>
        <div class="field">
          <label for="ak-tempel">Satu akun per baris: nama akun, peran, pos</label>
          <textarea id="ak-tempel" rows="4"
            placeholder="pos1hrcd37, juri_pos, 1&#10;meja1hrcd37, registrasi"></textarea>
        </div>
        <button class="button button-primary" id="ak-buat-massal" type="button">Buat Semua</button>
      </details>
      <div class="error" id="ak-galat" hidden></div>
    </div>

    <div class="card">
      <div class="table-toolbar">
        <h2 style="margin:0">Akun</h2>
        <span class="hint">${akun.length} akun</span>
      </div>
      <!-- Peringatan "baru kolom Akun yang mengunci" dihapus di migrasi 0064:
           seluruh policy dan RPC sudah pindah ke boleh(), jadi kalimat itu
           tidak benar lagi. Yang tersisa satu baris, dan ia bertahan karena
           memuat akibat yang tidak bisa dibaca dari layar (CLAUDE.md 9.4):
           mengubah peran MENIMPA centang yang sudah diatur tangan. -->
      <p>Mengganti peran mengisi ulang centangnya.</p>
      <!-- Gaya yang sama dengan lembar Input Nilai Pos: di HP ini TETAP
           tabel dan digeser ke samping, kolom nama menempel di kiri, kepala
           tabel menempel di atas. Semua itu sudah ada di .table-pos —
           matriks ini tidak perlu aturan sendiri. -->
      <div class="table-wrapper table-wrapper-tetap">
      <table class="table data-table table-tetap table-pos matriks-hak">
        <thead><tr>
          <th>Nama akun</th><th>Peran</th><th>Pos</th>
          ${fitur.map(f => `<th class="text-center">${esc(f.nama)}</th>`).join("")}
        </tr></thead>
        <tbody id="ak-tabel">
          ${akun.map(a => `
            <tr data-uid="${esc(a.user_id)}" data-nama="${esc(a.username)}"
                ${a.is_active ? "" : 'class="mati"'}>
              <td><button class="tautan" data-aksi type="button">${esc(a.username)}</button>${
                a.is_active ? "" : ' <span class="badge badge-gray">nonaktif</span>'}</td>
              <td><select class="select-small" data-peran>${opsiPeran(a.peran)}</select></td>
              <td><input type="number" class="small-input" data-pos min="1" max="20" style="width:4.5rem"
                    value="${a.pos ?? ""}" ${a.peran === "juri_pos" ? "" : "disabled"}></td>
              ${fitur.map(f => `
                <td class="text-center"><input type="checkbox" class="checkbox"
                  data-fitur="${esc(f.kode)}"
                  ${punya.has(`${a.user_id}|${f.kode}`) ? "checked" : ""}
                  aria-label="${esc(a.username)} - ${esc(f.nama)}"></td>`).join("")}
            </tr>`).join("")}
        </tbody>
      </table>
      </div>
    </div>
  `));

  const galat = document.getElementById("ak-galat");
  const lapor = (pesan) => { galat.textContent = pesan; galat.hidden = false; };
  const peranBaru = document.getElementById("ak-peran");
  const posBaru = document.getElementById("ak-pos");

  // Pos hanya milik juri_pos — itu check constraint di database, bukan
  // selera. Kotaknya dimatikan supaya bentroknya ketahuan sebelum dikirim.
  peranBaru.addEventListener("change", () => {
    posBaru.disabled = peranBaru.value !== "juri_pos";
    if (posBaru.disabled) posBaru.value = "";
  });

  async function kirimBuat(daftar, tombol) {
    galat.hidden = true;
    if (tombol.dataset.jalan === "1") return;
    tombol.dataset.jalan = "1"; tombol.disabled = true;
    try {
      const { hasil } = await buatAkun(daftar);
      const jadi = hasil.filter(x => x.ok);
      const gagal = hasil.filter(x => !x.ok);
      if (jadi.length) await tampilkanPassword(`${jadi.length} Akun Dibuat`, jadi);
      if (gagal.length) lapor(gagal.map(x => `${x.username}: ${x.pesan}`).join(" — "));
      if (jadi.length) layarAkun();
    } catch (e) { lapor(e.message); }
    finally { tombol.dataset.jalan = ""; tombol.disabled = false; }
  }

  document.getElementById("ak-buat").addEventListener("click", (ev) => {
    const nama = document.getElementById("ak-nama").value.trim();
    if (!nama) { lapor("Nama akun wajib diisi."); return; }
    kirimBuat([{ username: nama, peran: peranBaru.value,
      pos: peranBaru.value === "juri_pos" ? Number(posBaru.value) || null : null }],
      ev.currentTarget);
  });

  document.getElementById("ak-buat-massal").addEventListener("click", (ev) => {
    const baris = document.getElementById("ak-tempel").value
      .split("\n").map(b => b.trim()).filter(Boolean);
    if (!baris.length) { lapor("Belum ada baris untuk dibuat."); return; }
    kirimBuat(baris.map(b => {
      const [username, peran, pos] = b.split(",").map(x => (x || "").trim());
      return { username, peran, pos: pos ? Number(pos) : null };
    }), ev.currentTarget);
  });

  const tabel = document.getElementById("ak-tabel");
  // Satu antrean untuk SELURUH matriks, bukan per kotak: dua centang
  // beruntun di baris yang sama harus mendarat urut, dan urutan itulah
  // yang menentukan hak akhirnya.
  let antreHak = Promise.resolve();

  tabel.addEventListener("change", async (ev) => {
    const tr = ev.target.closest("tr");
    galat.hidden = true;

    // Centang: satu kotak = satu baris akun_hak. Dikirim seketika, dan
    // DIKEMBALIKAN kalau ditolak — kotak yang tetap tercentang padahal
    // servernya menolak adalah kebohongan yang baru ketahuan besok.
    //
    // Bentuknya SAMA PERSIS dengan ceklis keberangkatan, dan itu disengaja:
    // diredupkan selagi disimpan (bukan di-disable, lihat .checkbox.saving di
    // style.css), klik beruntun DIANTREKAN bukan diblokir supaya salah
    // centang bisa langsung dibatalkan, dan gagalnya lewat notif() — di tabel
    // yang tergulir ke kanan, tulisan galat di kartu paling atas ada di luar
    // layar.
    if (ev.target.matches("[data-fitur]")) {
      const kotak = ev.target;
      const mau = kotak.checked;
      kotak.classList.add("saving");
      antreHak = antreHak.then(async () => {
        try {
          await setHak(tr.dataset.uid, kotak.dataset.fitur, mau);
        } catch (e) {
          kotak.checked = !mau;
          notif(e.message, true);
        } finally {
          kotak.classList.remove("saving");
        }
      });
      return;
    }

    const peran = tr.querySelector("[data-peran]").value;
    const kotakPos = tr.querySelector("[data-pos]");
    if (ev.target.matches("[data-peran]")) {
      kotakPos.disabled = peran !== "juri_pos";
      if (kotakPos.disabled) kotakPos.value = "";
      else if (!kotakPos.value) { kotakPos.focus(); return; }
    }
    const pos = peran === "juri_pos" ? Number(kotakPos.value) || null : null;
    if (peran === "juri_pos" && !pos) { kotakPos.focus(); return; }
    try {
      await ubahPeranAkun(tr.dataset.uid, peran, pos);
      notif(`${tr.dataset.nama} sekarang ${PERAN_LABEL[peran]}${pos ? ` pos ${pos}` : ""}.`);
    } catch (e) { lapor(e.message); layarAkun(); }
  });

  // Klik NAMA membuka aksi akunnya. Ditaruh di balik nama, bukan sebagai tiga
  // tombol per baris, karena barisnya sudah punya sebelas kotak centang —
  // tombol tambahan di situ akan mendorong matriksnya keluar layar HP.
  tabel.addEventListener("click", async (ev) => {
    const tombol = ev.target.closest("[data-aksi]");
    if (!tombol) return;
    const tr = tombol.closest("tr");
    const uid = tr.dataset.uid, nama = tr.dataset.nama;
    const aktif = !tr.classList.contains("mati");
    galat.hidden = true;

    const pilih = await dialog({
      judul: nama,
      bacaSaja: true,
      labelAksi: "Tutup",
      kartuHtml: `
        <div class="option-row" style="flex-direction:column;gap:8px;align-items:stretch">
          <button class="button button-primary" data-pilih="password" type="button">Reset Password</button>
          <button class="button button-secondary" data-pilih="nama" type="button">Ubah Nama Akun</button>
          <button class="button button-secondary" data-pilih="aktif" type="button">${
            aktif ? "Nonaktifkan" : "Aktifkan"}</button>
        </div>`,
      pasang: (el, tutup) => el.querySelectorAll("[data-pilih]").forEach(b =>
        b.addEventListener("click", () => tutup(b.dataset.pilih))),
    });
    // Tombol "Tutup" mengembalikan array kosong (tidak ada medan), dan array
    // kosong itu truthy — jadi yang diperiksa jenisnya, bukan kebenarannya.
    if (typeof pilih !== "string") return;

    try {
      if (pilih === "password") {
        const { password } = await resetPasswordAkun(uid);
        await tampilkanPassword(`Password Baru ${nama}`, [{ username: nama, password }]);
        return;
      }
      if (pilih === "nama") {
        const jawab = await dialog({
          judul: `Ubah nama akun ${nama}`,
          kartuHtml: "<p>Mulai sekarang dia login memakai nama yang baru.</p>",
          medan: [{ label: "Nama akun baru", nilai: nama }],
          labelAksi: "Ubah Nama",
        });
        if (jawab === null) return;
        await ubahUsernameAkun(uid, jawab[0]);
      }
      if (pilih === "aktif") {
        if (aktif) {
          const ya = await dialog({
            judul: `Nonaktifkan ${nama}?`,
            kartuHtml: "<p>Dia tidak bisa masuk lagi. Riwayat yang sudah dicatatnya tetap ada.</p>",
            labelAksi: "Nonaktifkan",
          });
          if (ya === null) return;
        }
        await setAktifAkun(uid, !aktif);
      }
      layarAkun();
    } catch (e) { lapor(e.message); }
  });

  document.getElementById("ak-nama").focus();
}

/* ============================ RUTE ======================================= */

const RUTE = {
  "#/home": layarHome,
  "#/pembayaran": layarPembayaran,
  "#/daftar-ulang": layarDaftarUlang,
  "#/cetak-kloter": layarCetakKloter,
  "#/keberangkatan": layarKeberangkatan,
  "#/finish": layarFinish,
  "#/pos": layarInputPos,
  "#/rekap": layarRekap,
  "#/live-score": layarLiveScore,
  "#/ganti-password": layarGantiPassword,
  "#/akun": layarAkun,
};

async function arahkan() {
  segarkanDiTempat = null;
  if (!sesi()) { layarLogin(); return; }
  // Sesi yang dibuat sebelum `hak` dibawa ke dalamnya tidak punya field itu,
  // dan papan Home lalu kosong untuk semua orang yang sudah login. Diisi
  // sekali; sesudah itu panggilan ini langsung kembali.
  await lengkapiHakSesi();
  if (!EDISI) {
    try { EDISI = await infoEdisi(); }
    catch (e) { layarButuhEdisi("Sistem Panitia"); return; }
  }
  (RUTE[location.hash] || layarHome)();
}

// Tiga aksi yang sama dipasang di DUA tempat: tombol header (layar lebar)
// dan menu bawah (HP). Dideklarasikan lebih dulu supaya tidak ada listener
// yang menunjuk const yang belum terisi.
const keHome = () => {
  if (location.hash === "#/home") arahkan(); else location.hash = "#/home";
};
const keSetelan = () => {
  if (location.hash === "#/ganti-password") arahkan();
  else location.hash = "#/ganti-password";
};
const keAkun = () => {
  if (location.hash === "#/akun") arahkan(); else location.hash = "#/akun";
};
const keluarSekarang = () => { keluar(); EDISI = null; location.hash = ""; arahkan(); };

document.getElementById("btn-keluar").addEventListener("click", keluarSekarang);
document.getElementById("btn-home").addEventListener("click", keHome);
document.getElementById("nav-home").addEventListener("click", keHome);
document.getElementById("nav-setting").addEventListener("click", keSetelan);
document.getElementById("btn-akun").addEventListener("click", keAkun);
document.getElementById("nav-akun").addEventListener("click", keAkun);
document.getElementById("nav-keluar").addEventListener("click", keluarSekarang);
document.getElementById("ganti-password").addEventListener("click", keSetelan);
window.addEventListener("hashchange", arahkan);

/* TIDAK ADA yang menyegarkan sendiri saat tab kembali terlihat.

   Dulu `visibilitychange` menggambar ulang layarnya — dan itu memindahkan
   tombol tepat sebelum jempol turun, mengembalikan chip kloter ke pilihan
   awal, dan melempar gulirannya ke atas. Ketiga pengaman yang menjaganya
   (isian sedang difokus, dialog terbuka, nilai belum tersimpan) semuanya
   meleset di kejadian yang paling sering: layar yang sedang DITUNGGUI, bukan
   sedang diketik.

   Harganya disebut supaya tidak jadi kejutan: layar yang lama ditinggal bisa
   menampilkan angka lama. Yang menutupinya tombol muat ulang di tiap layar.

   Yang TETAP jalan cuma pembaruan DI TEMPAT — Input Pos dan Rekapitulasi
   mengganti isi sel tanpa membangun ulang apa pun, jadi tidak ada tombol yang
   berpindah dan gulirannya tidak bergerak. Itu bukan yang dikeluhkan, dan
   melepasnya akan mematikan lembar pos yang dibuka di beberapa HP sekaligus.

   Pemanggilan di bawah ini WAJIB ada, bukan kerapian: denyut kedua layar itu
   menghentikan dirinya sendiri saat `document.hidden`, dan `segarkanDiTempat`
   satu-satunya yang menyalakannya lagi. Tanpa baris ini, pembaruan otomatis
   mati permanen sesudah petugas berpindah tab sekali. */
document.addEventListener("visibilitychange", () => {
  if (document.hidden || !sesi()) return;
  if (segarkanDiTempat) segarkanDiTempat();
});

/** Baris lembar pos yang isinya belum sampai ke database. */
const adaYangBelumTersimpan = () => !!document.querySelector(
  '#isi-tabel tr[data-keadaan="belum"], #isi-tabel tr[data-keadaan="gagal"]');

// Menutup tab dengan nilai yang belum terkirim = nilai itu hilang tanpa
// jejak. Browser hanya mengizinkan peringatan bawaannya, dan itu sudah cukup:
// yang dibutuhkan cuma satu jeda sebelum tab-nya benar-benar tertutup.
window.addEventListener("beforeunload", (e) => {
  if (!adaYangBelumTersimpan()) return;
  e.preventDefault();
  e.returnValue = "";
});

arahkan();
