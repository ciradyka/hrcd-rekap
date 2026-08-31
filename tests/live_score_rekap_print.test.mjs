// ============================================================================
// hrcd-rekap : tests/live_score_rekap_print.test.mjs
// Cetak Rekap Nilai dari layar Live Score — per sekolah dan seluruhnya.
//
// Diuji atas SUMBER, bukan atas DOM, dengan alasan yang sama seperti
// live_score_poin.test.mjs: layarnya menuntut enam permintaan jaringan lebih
// dulu, dan yang perlu dijaga di sini bentuk yang dipilih.
//
// Empat hal yang bisa rusak tanpa satu pun galat, dan itulah yang diperiksa:
//
//   1. kertas dan layar memakai perakit kolom yang SAMA. Dua salinan aturan
//      "lomba mana yang berlaku untuk golongan ini" akan menyimpang, dan yang
//      menyimpang tidak menggagalkan apa pun — ia cuma membuat keduanya saling
//      membantah di depan pembina yang memegang keduanya (CLAUDE.md 11.9).
//   2. kepala dan badan tabel sepasang. Kalau yang satu menambah kolom "Nilai"
//      dan yang lain tidak, seluruh tabel bergeser satu kolom: nilai Pos 2
//      tercetak di bawah judul Pos 3, dan kertas itu terlihat benar sampai ada
//      yang mencocokkannya dengan layar.
//   3. window.print() tetap di dalam giliran event tap. Safari iPhone
//      memblokirnya sesudah `await`, dan yang gagal cuma DIAM — tombolnya
//      ditekan, tidak ada yang keluar, tidak ada pesan.
//   4. nol baris tidak menghasilkan kertas kosong.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../web/style.css", import.meta.url), "utf8");

/** Badan `siapkanCetakRekap` — perakit kertasnya. */
const cetakan = (() => {
  const awal = app.indexOf("function siapkanCetakRekap({");
  const akhir = app.indexOf("/* Dibatalkan tiap kali layar Live Score", awal);
  assert.ok(awal >= 0 && akhir > awal, "siapkanCetakRekap tidak ditemukan");
  return app.slice(awal, akhir);
})();

/** Bagian layar Live Score yang memasang kedua tombol cetak. */
const pemasang = (() => {
  const awal = app.indexOf("  /* ---- Cetak Rekap Nilai ----");
  const akhir = app.indexOf("  /* Diperbarui DI TEMPAT", awal);
  assert.ok(awal >= 0 && akhir > awal, "pemasang tombol cetak tidak ditemukan");
  return app.slice(awal, akhir);
})();

test("kedua tombol ada di layar Live Score", () => {
  assert.match(app, /id="cetak-rekap-sekolah"/,
    "tombol Rekap Nilai per Sekolah tidak digambar");
  assert.match(app, /id="cetak-rekap-semua"/,
    "tombol Rekap Nilai Semua tidak digambar");
  // Papan kosong tidak boleh menawarkan cetak: yang bisa dihasilkannya cuma
  // kertas kosong.
  assert.match(app, /const cetakRekap = !klasemen\.length \? "" :/,
    "tombol cetak masih digambar saat belum ada regu yang bisa diperingkat");
});

test("kertas memakai perakit kolom yang sama dengan layar", () => {
  assert.match(cetakan, /kepalaPosRekap\(posKolom\)/,
    "kepala kolom kertas tidak lagi datang dari kepalaPosRekap()");
  assert.match(cetakan, /selPosRegu\(k, posKolom, rekapDada\)/,
    "sel kertas tidak lagi datang dari selPosRegu()");
  assert.doesNotMatch(cetakan, /ringkasLomba\(|varianUntuk\(/,
    "aturan lomba-per-golongan ditulis ulang di dalam perakit kertas");
});

test("kepala dan badan tiap lembar jumlah kolomnya sepasang", () => {
  // Kolom pos datang dari satu sumber untuk kepala dan badan, jadi yang dijaga
  // di sini kolom yang diketik DUA KALI — sekali sebagai <th rowspan="2">,
  // sekali sebagai <td>. Di situlah keduanya bisa berselisih, dan selisih satu
  // kolom menggeser seluruh tabel tanpa satu pun galat.
  const identitasTh = (cetakan.match(/const kepalaIdentitas = `([\s\S]*?)`;/) || [])[1];
  const identitasTd = (cetakan.match(/const selIdentitas = \(k\) => `([\s\S]*?)`;/) || [])[1];
  assert.ok(identitasTh && identitasTd, "blok identitas kertas tidak ditemukan");
  // `[ >]` dan bukan spasi saja: kolom Regu ditulis `<td>` tanpa atribut.
  assert.equal((identitasTh.match(/<th[ >]/g) || []).length, 4,
    "kolom identitas bukan 4 — # / No Dada / Regu / Organisasi");
  assert.equal((identitasTd.match(/<td[ >]/g) || []).length, 4,
    "sel identitas tidak sebanyak kepalanya");

  // Kelompok perjalanan: enam kepala, enam sel. Nomornya diketik di `lebar`,
  // dan `lebar` itulah yang dipakai pengepakan lembar di bawah — kalau ia
  // berbohong, satu lembar diisi lebih banyak kolom daripada yang muat.
  // Dibatasi sampai KELOMPOK ditutup: di bawahnya ada <th> Total milik
  // template halaman, dan tanpa batas itu ia ikut terhitung sebagai kolom
  // perjalanan.
  const jalan = cetakan.slice(cetakan.indexOf("      lebar: 6,"),
                              cetakan.indexOf("const LEMBAR = [];"));
  const kepalaJalan = (jalan.match(/<th rowspan="2"/g) || []).length;
  const selJalan = (jalan.slice(jalan.indexOf("sel: (k) =>")).match(/<td class="text-center/g) || []).length;
  assert.equal(kepalaJalan, 6,
    "kelompok perjalanan bukan 6 kolom — kontrak/kloter/berangkat/datang/"
    + "anggota/penalti");
  assert.equal(selJalan, kepalaJalan,
    `kelompok perjalanan: ${kepalaJalan} kepala, ${selJalan} sel`);
  assert.match(jalan, /lebar: 6,/,
    "`lebar` kelompok perjalanan tidak sesuai jumlah kolomnya");
});

test("kolom dibelah antar-lembar, selalu di ANTARA pos", () => {
  // 29 kolom tidak muat di A4 melintang — min-content terukur 347,7mm atas
  // kertas 281mm. Pembelahannya yang membuat seluruh kolom tetap ikut
  // tercetak; alasan lengkapnya di kepala siapkanCetakRekap().
  assert.match(app, /const KOLOM_NILAI_PER_LEMBAR = 12;/,
    "jatah kolom per lembar berubah tanpa diukur ulang — angkanya datang dari "
    + "pengukuran di browser, lihat komentar di atasnya");
  assert.match(cetakan, /const KELOMPOK = \[/,
    "kolom tidak lagi dikelompokkan per pos");
  // Kelompok dimasukkan UTUH: pos yang terbelah dua lembar akan mencetak
  // kepala "Pos 3 · P3K" dua kali di atas separuh kolomnya masing-masing.
  assert.match(cetakan, /akhir\.lebar \+ kel\.lebar <= KOLOM_NILAI_PER_LEMBAR/,
    "kelompok tidak lagi dimasukkan utuh — pembelahan bisa jatuh di tengah pos");
  assert.match(cetakan, /LEMBAR\.map\(\(lembar, i\) =>/,
    "lembar tidak digambar per golongan");

  // Tiap lembar berdiri sendiri: yang berpindah tangan tanpa nomor dada tidak
  // bisa dicocokkan dengan apa pun, dan Total adalah angka yang paling sering
  // dicari di lembar mana pun.
  assert.match(cetakan, /\$\{kepalaIdentitas\}\$\{lembar\.kelompok\.map\(x => x\.atas\)/,
    "kolom identitas tidak ikut di setiap lembar");
  assert.match(cetakan, /\$\{selIdentitas\(k\)\}\$\{\s*\r?\n?\s*lembar\.kelompok\.map\(x => x\.sel\(k\)\)/,
    "sel identitas tidak ikut di setiap lembar");
  assert.match(cetakan, /<th rowspan="2">Total<\/th>/,
    "kolom Total tidak ada di kepala tiap lembar");
  assert.match(cetakan, /\}\$\{selTotal\(k\)\}<\/tr>/,
    "kolom Total tidak ada di badan tiap lembar");
  // "Bagian", bukan "Lembar": bagian-bagiannya mengalir dan bisa berbagi satu
  // halaman kertas, jadi menyebutnya lembar akan membohongi yang memegangnya.
  assert.match(cetakan, /Bagian \$\{i \+ 1\}\/\$\{LEMBAR\.length\}/,
    "halaman tidak menyebut bagian keberapa dari berapa");
});

test("satu bagian per golongan, bukan satu tabel campuran", () => {
  assert.match(cetakan, /URUT_GOLONGAN\s*\r?\n?\s*\.map\(g => \[g, baris\.filter/,
    "kertas tidak lagi dipisah per golongan");
  assert.match(cetakan, /GOLONGAN_LABEL\[g\] \|\| g/,
    "judul bagian tidak menyebut golongannya");
  // Peringkat adalah peringkat DI DALAM golongan; satu tabel campuran akan
  // mencetak empat baris bernomor 1.
  assert.doesNotMatch(cetakan, /<th rowspan="2">Golongan<\/th>/,
    "golongan kembali jadi kolom ke-30, padahal ia sudah jadi judul bagian");
});

test("medali tidak ikut tercetak", () => {
  // Emoji keluar sebagai gambar berwarna atau kotak kosong tergantung printer
  // dan fon yang ada di alat itu.
  assert.doesNotMatch(cetakan, /MEDALI\[/,
    "kertas menggambar medali emoji, yang tidak bisa diandalkan di printer");
  assert.match(cetakan, /esc\(String\(k\.peringkat \?\? ""\)\)/,
    "kertas tidak menggambar angka peringkatnya");
});

test("print dipanggil tanpa melewati await, di kedua alur", () => {
  // Komentarnya dibuang lebih dulu. Alasan aturan ini justru dijelaskan di
  // komentar tepat di atas kodenya, dan kata "await" di dalam kalimat itu
  // akan menggagalkan tes yang membaca sumbernya apa adanya.
  const kode = pemasang.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");

  const sebelumPrint = kode.slice(0, kode.indexOf("window.print();"));
  assert.match(kode, /window\.print\(\);/, "window.print() tidak dipanggil");
  assert.doesNotMatch(sebelumPrint, /\bawait\b/,
    "Safari iPhone memblokir print bila ada await lebih dulu");

  // Alur per sekolah: dialognya TIDAK di-await lalu dicetak sesudahnya —
  // klik pada nama sekolah itu sendiri yang mencetak, masih di dalam
  // giliran tap-nya.
  assert.doesNotMatch(kode, /\bawait\b/,
    "ada await di alur cetak — dialog pemilih sekolah tidak boleh ditunggu, "
    + "karena print() sesudahnya mati di iPhone");
  assert.match(kode, /tutup\(null\);\s*\r?\n\s*cetak\(nm,/,
    "klik nama sekolah tidak langsung mencetak di dalam giliran tap-nya");
});

test("nol baris tidak menghasilkan kertas kosong", () => {
  const posisiKosong = cetakan.indexOf("if (!jumlah) return 0;");
  const posisiPasang = cetakan.lastIndexOf("document.body.appendChild");
  assert.notEqual(posisiKosong, -1, "perakit kertas tidak menolak nol baris");
  assert.ok(posisiKosong < posisiPasang,
    "penolakan nol baris terjadi sesudah cetakan dipasang ke body");
  assert.match(pemasang, /if \(!siapkanCetakRekap\(/,
    "layar tidak memeriksa hasil perakit sebelum membuka dialog print");
});

test("daftar sekolah dibangun dari klasemen, bukan dari seluruh peserta", () => {
  // Sekolah yang regunya belum satu pun berangkat tidak punya baris untuk
  // dicetak, dan menawarkannya cuma menghasilkan kertas kosong.
  assert.match(pemasang, /for \(const k of klasemen\) \{/,
    "daftar sekolah di dialog tidak dibangun dari klasemen");
  assert.match(pemasang, /localeCompare\(b\[0\], "id"\)/,
    "daftar sekolah tidak diurutkan menurut abjad Indonesia");
});

test("kertas A4 melintang dan hurufnya tidak di bawah 7pt", () => {
  assert.match(css, /@page rekap-cetak \{ size: A4 landscape;/,
    "lembar rekap tidak diatur A4 melintang");
  assert.match(css, /\.rekap-cetak \{ page: rekap-cetak; \}/,
    "lembar rekap tidak memakai @page-nya sendiri");

  // CLAUDE.md 8.6: di bawah 7pt fotokopi menutup lubang huruf a, e, dan o.
  const blok = css.slice(css.indexOf("@page rekap-cetak"),
                         css.indexOf("@page { margin: 12mm; }"));
  assert.ok(blok.length > 0, "blok CSS lembar rekap tidak ditemukan");
  for (const [, ukuran] of blok.matchAll(/font-size: ([\d.]+)pt/g)) {
    assert.ok(Number(ukuran) >= 7,
      `lembar rekap memakai ${ukuran}pt — batas bawahnya 7pt (CLAUDE.md 8.6)`);
  }
  // CLAUDE.md 8.5: garis di bawah 0,75pt hilang waktu difotokopi.
  for (const [, tebal] of blok.matchAll(/border-right-width: ([\d.]+)pt/g)) {
    assert.ok(Number(tebal) >= 0.75,
      `garis ${tebal}pt di bawah batas 0,75pt (CLAUDE.md 8.5)`);
  }
});


test("bagian rekap mengalir, tidak memaksa satu halaman masing-masing", () => {
  // Terukur: mencetak sekolah bersatu regu menghasilkan DUA halaman yang
  // masing-masing terisi 12% sebelum perbaikan ini.
  assert.match(css,
    /\.print-page\.rekap-cetak \{ break-after: auto; page-break-after: auto; \}/,
    "bagian rekap masih memaksa halaman baru masing-masing");
  // Dua kelas, bukan satu: aturan yang dibatalkan berkekhususan sama dan
  // menang lewat urutan berkas (CLAUDE.md 15.12).
  assert.doesNotMatch(css, /^\s*\.rekap-cetak \{ break-after: auto/m,
    "pembatalannya bergantung pada urutan berkas, bukan kekhususan");
  assert.match(css, /\.rekap-cetak \+ \.rekap-cetak \{ margin-top: 7mm; \}/,
    "tidak ada jarak antar bagian yang berbagi halaman");
  assert.match(css, /\.rekap-cetak \.lembar-kepala \{ break-after: avoid/,
    "judul bagian bisa tertinggal sendirian di kaki halaman");
  assert.match(css, /\.rekap-cetak \.print-table thead \{ display: table-header-group; \}/,
    "kepala tabel tidak diulang saat satu bagian terbelah antar halaman");
});
