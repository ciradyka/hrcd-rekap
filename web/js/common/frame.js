/* ============================================================================
   hrcd-rekap : common/frame.js — kerangka yang dipakai SEMUA layar panitia.

   Isinya keadaan yang hidup selama satu sesi (edisi aktif, sinyal layar,
   alamat layar) dan alat yang dipakai banyak layar sekaligus: kepala layar,
   kartu galat, "baris terakhir" di kaki, chip saringan, alat tabel, dan kotak
   nomor dada.

   Keadaan yang bisa berubah diganti lewat fungsi atur...() di sebelahnya,
   bukan ditugasi langsung: modul layar membacanya lewat import, dan binding
   yang diimpor tidak bisa ditugasi ulang oleh pengimpornya.

   Modul ini tidak mengimpor app.js maupun modul layar mana pun. Kalau satu
   alat di sini butuh sesuatu dari app.js, tempatnya bukan di sini.
   ========================================================================== */

import { bolehLihat, sesi } from "../api.js";
import { esc, html, jamMenit, rapikanDada } from "../util.js";

export const LAYAR = document.getElementById("layar");

export let EDISI = null;

/** Satu-satunya jalan mengganti EDISI. Modul layar membacanya lewat import,
 *  dan binding yang diimpor tidak bisa ditugasi ulang oleh pengimpornya. */
export function aturEdisi(edisi) { EDISI = edisi; }

/* Layar yang sanggup memperbarui dirinya SENDIRI tanpa digambar ulang
   mendaftar di sini; kembali dari tab lain memanggil INI, bukan menggambar
   ulang layarnya. Kosong berarti "gambar ulang saja" — itu yang berlaku
   untuk hampir semua layar, dan memang benar untuk mereka.

   Dideklarasikan di atas, bersama keadaan modul yang lain, meski yang
   memakainya jauh di bawah: yang membacanya nanti harus bisa menemukan
   seluruh keadaan yang hidup selama satu sesi di satu tempat. */
export let segarkanDiTempat = null;

/** Pasang (atau kosongkan dengan null) penyegar layar yang sedang terbuka. */
export function aturSegarkanDiTempat(fungsi) { segarkanDiTempat = fungsi; }

/* ---------------------------------------------------------------------------
   PENDENGAR DAN PENGAMAT MILIK SATU LAYAR

   Yang dipasang pada `window` atau lewat Resize/IntersectionObserver TIDAK
   ikut hilang ketika `LAYAR.replaceChildren()` mengganti isinya: keduanya
   dipegang objek yang hidup lebih lama daripada elemennya. Tanpa dilepas,
   tiap kunjungan menambah satu salinan — dan salinan itu menahan seluruh
   closure layarnya, termasuk `lembar` yang berisi ratusan baris nilai.

   Yang menumpuk paling cepat bukan navigasi biasa. Dropdown pemilih pos
   memanggil `layarInputPos()` lagi tanpa lewat `arahkan()`, jadi koordinator
   pos yang menyapu kelima pos bolak-balik sepanjang pagi menumpuk satu
   salinan tiap perpindahan. Karena itu layarnya sendiri yang meminta sinyal
   baru, bukan hanya router.

   Gejalanya nol: `ulangYangGagal()` sudah menjaga diri dengan
   `document.body.contains(tbody)`, jadi salinan lama memang tidak melakukan
   apa-apa. Yang tertinggal memorinya, dan tidak ada yang akan melihatnya
   sampai satu HP kehabisan.

   Polanya menyalin `pengendaliFilterSekolah` di bawah, yang sudah memakai
   AbortController justru untuk alasan yang sama. */
export let pengendaliLayar = new AbortController();

/** Lepaskan semua yang dipasang layar sebelumnya, lalu beri sinyal baru. */
export function sinyalLayarBaru() {
  pengendaliLayar.abort();
  pengendaliLayar = new AbortController();
  return pengendaliLayar.signal;
}

/** Putuskan pengamat saat layarnya ditinggalkan.
 *
 *  AbortController tidak mengenal Resize/IntersectionObserver — `signal`
 *  hanya melepas `addEventListener`. Jadi pengamatnya dititipkan ke peristiwa
 *  `abort` sinyal yang sama, supaya satu saklar tetap mengurus keduanya. */
export const putusSaatPindah = (sinyal, pengamat) =>
  sinyal.addEventListener("abort", () => pengamat.disconnect(), { once: true });

export const terakhir = { pembayaran: [], "daftar-ulang": [], finish: [] };

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
export const namaAcara = () => (EDISI && EDISI.name) ? String(EDISI.name) : "HRCD";

export function pasangKepala(judul, lebar = false) {
  const s = sesi();
  document.getElementById("kepala").hidden = !s;
  // Menu bawah HP ikut aturan yang sama dengan header: hanya untuk yang
  // sudah login. Penanda halaman aktif dipasang di sini juga supaya ikon
  // Home menyala saat memang sedang di Home.
  const nav = document.getElementById("bottom-nav");
  if (nav) {
    nav.hidden = !s;
    /* TINGGI MENU BAWAH DIUKUR, TIDAK DITEBAK.

       Yang menempel di atas menu ini — tombol SIMPAN NILAI dan pesan notifikasi
       — dulu memesan tempat sebanyak `56px`. Angka itu `min-height` SATU ITEM
       menu, bukan tinggi menunya: isinya (ikon 1.9rem + jarak + label .72rem +
       padding) melewatinya, dan terukur di Chrome 430px menunya 65.4px. Jadi
       tombol yang seharusnya berhenti 8px di atas menu justru menembusnya
       1.4px, dan di layar sungguhan keduanya terbaca menempel.

       Menaikkan tebakannya cuma memindahkan tanggal kedaluwarsanya: tingginya
       ikut ukuran huruf peranti dan safe area, yang berbeda antar HP. Yang
       benar mengukurnya — sama seperti `--kepala` di bawah, yang ada karena
       alasan yang sama persis.

       `padding-bottom: env(safe-area-inset-bottom)` ada DI DALAM menunya, jadi
       angka ini sudah memuatnya; yang memakainya tidak boleh menambahkan
       `env()` lagi. */
    if (!nav.hidden) {
      const tinggiNav = Math.round(nav.getBoundingClientRect().height);
      if (tinggiNav > 0) {
        document.documentElement.style.setProperty("--nav-bawah", `${tinggiNav}px`);
      }
    }
    const diHome = location.hash === "#/home" || location.hash === "";
    document.getElementById("nav-home")
      .setAttribute("aria-current", diHome ? "page" : "false");
    document.getElementById("nav-setting")
      .setAttribute("aria-current", location.hash === "#/ganti-password" ? "page" : "false");
    document.getElementById("nav-akun")
      .setAttribute("aria-current", location.hash === "#/account" ? "page" : "false");
    /* pangkalRute(), bukan perbandingan hash utuh: alamat Buku Sakti
       berbuntut kode bab, jadi `#/buku-sakti/seksi` juga sedang di layar ini.
       Tanpa itu penandanya menyala di bab pertama lalu padam begitu pembaca
       pindah tab — satu-satunya item menu yang berkedip. */
    document.getElementById("nav-buku")
      .setAttribute("aria-current",
        pangkalRute(location.hash) === "#/buku-sakti" ? "page" : "false");
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
  /* "cek" = layar Cek Nilai: setinggi layar, tanpa gulir, foto berjajar.
     Ikut di-toggle di SINI bersama dua yang lain, bukan dipasang sendiri di
     layarnya — supaya ia ikut mati waktu pindah ke layar mana pun. Kelas yang
     dipasang di layarnya sendiri akan tertinggal dan membuat layar berikutnya
     terpotong setinggi viewport. */
  LAYAR.classList.toggle("cek", lebar === "cek");
  if (s) document.getElementById("siapa").textContent =
    `${s.username} · ${EDISI ? EDISI.name : ""}`;
}

export const kartuGalat = (pesan) => html`
  <div class="card" style="border-color:var(--bahaya);background:var(--bahaya-muda)">
    <strong>${pesan}</strong></div>`;

export function barisTerakhirHtml(fungsi) {
  const daftar = terakhir[fungsi] || [];
  if (!daftar.length) return "";
  return `<div class="card">
    <h2 style="font-size:1rem;color:var(--tinta-lembut)">Baru saja di meja ini</h2>
    <table class="table">${daftar.slice(0, 8).map(b => html`
      <tr><td>${b.jam}</td><td><strong>${b.apa}</strong></td><td>${b.detail}</td></tr>`).join("")}
    </table></div>`;
}

export function catatTerakhir(fungsi, apa, detail) {
  terakhir[fungsi].unshift({ jam: jamMenit(new Date()), apa, detail });
}

/* ============================ CHIP SARINGAN ============================== */

/** Chip saringan — SATU bentuk untuk setiap layar yang menyaring: meja
 *  Pembayaran, Daftar Ulang, Data Peserta, Input Nilai Tabel, riwayat nilai,
 *  dan Cek Nilai. Dua layar yang menyaring dengan alat berbeda harus dicoba
 *  dulu sebelum dipercaya, dan perbaikan pada satu salinan tidak sampai ke
 *  salinan lainnya.
 *
 *  `pilihan` — [{ kode, label, pendek?, jumlah? }], urutannya dari pemanggil,
 *  dengan "Semua" PERTAMA di setiap layar.
 *  `pendek` — label versi HP, hanya kalau berbeda dari `label`: chip harus
 *  muat satu baris di layar 360px, dan yang dipendekkan hanya kata yang bisa
 *  ditebak dari konteksnya ("bayar", "Nomor Dada").
 *  `jumlah` — angka di belakang label, untuk layar yang menghitung sisa
 *  pekerjaannya (Cek Nilai). Tanpa `jumlah`, tidak ada angka.
 *  `atribut` — nama data-* yang membawa kodenya: "saring" atau "lomba". */
export function chipSaringHtml(pilihan, aktif, atribut = "saring") {
  return pilihan.map(s => {
    const label = s.pendek && s.pendek !== s.label
      ? `<span class="saring-panjang">${esc(s.label)}</span><span class="saring-pendek">${esc(s.pendek)}</span>`
      : esc(s.label);
    const jumlah = s.jumlah === undefined ? ""
      : ` <span class="saring-jumlah">${esc(String(s.jumlah))}</span>`;
    return `<button type="button" class="option option-small" data-${atribut}="${esc(s.kode)}"
              aria-pressed="${s.kode === aktif}">${label}${jumlah}</button>`;
  }).join("");
}

/** Nyalakan satu chip dan padamkan sisanya — di tempat, tanpa membangun ulang
 *  tombolnya, supaya chip yang sedang difokus papan ketik tetap difokus. */
export function tandaiChip(wadah, atribut, kode) {
  wadah.querySelectorAll(`[data-${atribut}]`).forEach(b =>
    b.setAttribute("aria-pressed", String(b.dataset[atribut] === kode)));
}

/* ============================ ALAT TABEL ================================= */

/** Kotak cari + chip saring, dipakai layar Pembayaran, Daftar Ulang, Data
 *  Peserta, dan Input Nilai Tabel. Menyaring di browser (data sudah dimuat
 *  semua) supaya hasilnya berubah seketika sambil mengetik — di meja,
 *  menunggu server tiap huruf terasa seperti aplikasi macet. Bentuk chip-nya
 *  di chipSaringHtml(). */
export function alatTabel({ saringan, saringAktif, jumlah, cariContoh, kiri = "", kanan = "" }) {
  return `
    <div class="table-toolbar">
      ${kiri}
      <div class="field kotak-cari">
        <label for="cari-tabel" class="visually-hidden">Cari</label>
        <input type="text" id="cari-tabel" autocomplete="off"
               placeholder="${esc(cariContoh || "Cari kode, sekolah, atau nama regu…")}">
      </div>
      <div class="filter-baris">
        <div class="filter-row">${chipSaringHtml(saringan, saringAktif)}</div>
        <span class="table-count" id="tabel-jumlah">${jumlah} baris</span>
      </div>
      ${kanan}
    </div>`;
}

/** Pasang perilaku cari + saring. gambar(cari, saring) menggambar ulang
 *  isi tabel saja — kerangka layar tidak ikut dibangun ulang supaya fokus
 *  kotak cari tidak lompat saat mengetik (temuan uji). */
export function pasangAlatTabel(gambar) {
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
      tandaiChip(LAYAR, "saring", saring);
      jalan();
    }));
  inp.focus();
  jalan();
  // Dikembalikan supaya pemanggil bisa menerapkan ulang saringan yang SEDANG
  // menyala sesudah datanya berubah di belakang layar — tanpa itu, baris yang
  // baru saja difoto tetap duduk di daftar "Belum Foto" sampai ada yang
  // menyentuh saringannya.
  return jalan;
}

/** Filter bersama: kode pembayaran, nama sekolah, atau nama salah satu regu
 *  mengandung teks cari. Nama regu ikut dicari karena meja pembayaran
 *  menampilkan barisnya per regu — yang disebut sekolah kadang nama regunya,
 *  bukan kodenya. */
export const cocokCari = (b, cari) => !cari
  || b.kode_pembayaran.toLowerCase().includes(cari)
  || (b.sekolah?.name || "").toLowerCase().includes(cari)
  || (b.regu || []).some(r => (r.nama_regu || "").toLowerCase().includes(cari));

export const reguAktif = (b) => (b.regu || []).filter(r => !r.is_cancelled);

/* ============================ CETAK DAFTAR KLOTER ======================== */

/** Kotak nomor dada dipadatkan jadi tiga digit SESUDAH selesai diketik: 1
 *  jadi 001, 60 jadi 060 — bentuk yang sama dengan angka yang tercetak di
 *  dada peserta dan di seluruh layar lain, yang sudah lama lewat dada3().
 *
 *  SESUDAH, bukan sambil. Memadatkan tiap ketikan membuat angka yang belum
 *  selesai melompat-lompat: mengetik 060 menampilkan 006 lalu 060, dan
 *  mengetik 6 menampilkan 006 sebelum petugas sempat mengetik nol keduanya.
 *  Yang terbaca bukan "sedang mengetik 60" melainkan "sudah jadi 006", dan
 *  di meja yang ramai itu cukup untuk membuat orang ragu lalu mengulang.
 *  Sekarang yang tampil apa adanya — 0, lalu 06, lalu 060 — dan padatnya
 *  jatuh sekali saja, saat kotaknya ditinggalkan.
 *
 *  YANG BERUBAH CUMA TAMPILANNYA. Setiap pembaca kotak ini memakai
 *  `Number(value)`, dan `Number("06")` tetap 6 — tidak ada satu pun
 *  pencarian, penyimpanan, atau perbandingan yang perlu tahu soal ini. Jadi
 *  kotak yang ditinggalkan berisi 06 sudah benar isinya sebelum dipadatkan.
 *
 *  Nomor Internal empat digit tidak dipotong: dada3() melewatkan apa pun di atas
 *  999 apa adanya (migrasi 0116), jadi 1000 tetap 1000. Aturan isinya, nol
 *  yang mengosongkan kotak termasuk, ada di rapikanDada() di util.js. */
export function pasangDada3(el, sinyal) {
  const rapikan = () => {
    const baru = rapikanDada(el.value);
    if (baru !== el.value) el.value = baru;
  };
  const opsi = sinyal ? { signal: sinyal } : undefined;
  // `blur` DAN `change`: change tidak berbunyi kalau isinya tidak berubah
  // sejak fokus, dan blur tidak berbunyi kalau kotaknya di-submit lewat
  // Enter tanpa sempat kehilangan fokus. Keduanya idempoten.
  el.addEventListener("blur", rapikan, opsi);
  el.addEventListener("change", rapikan, opsi);
}

/* ALAMAT BOLEH BERBUNTUT: `#/pos2/2:bakiak`.

   Satu-satunya yang memakainya hari ini Input Nilai Pos v2, dan alasannya
   tombol Back: pemilih lomba dan lomba yang terbuka harus jadi DUA entri
   riwayat, kalau tidak Back melompat ke layar sebelum `#/pos2` sama sekali.

   Ditulis sebagai fungsi, BUKAN `const`, karena layarInputPos2() memanggilnya
   dari atas berkas ini. Deklarasi fungsi terangkat; `const` tidak, dan yang
   didapat cuma ReferenceError saat layarnya dibuka (bagian 17.3). */
export function pangkalRute(hash) {
  return hash.split("/").slice(0, 2).join("/");
}

/** Bagian sesudah pangkalnya, sudah di-decode. "" kalau tidak ada. */
export function ekorRute(hash) {
  const potong = hash.indexOf("/", 2);
  return potong < 0 ? "" : decodeURIComponent(hash.slice(potong + 1));
}

// Hash yang benar-benar sedang tergambar. `location.hash` sudah berisi tujuan
// baru ketika hashchange tiba, jadi nilai lama harus disimpan terpisah agar
// perpindahan yang dibatalkan dapat dikembalikan tanpa membuang tabel.
export let hashLayar = location.hash;

/** Alamat layar yang sedang tergambar — diganti router, dan oleh layar yang
 *  menulis ulang alamatnya sendiri tanpa menggambar ulang. */
export function aturHashLayar(hash) { hashLayar = hash; }
