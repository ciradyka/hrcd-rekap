// ============================================================================
// hrcd-rekap : tests/live_score_poin.test.mjs
// Papan Live Score menggambar POIN AKHIR, bukan angka mentah — dan kepala
// kolomnya tidak lagi menyebut rentang.
//
// Diuji atas SUMBER kedua papan, bukan atas DOM: keduanya merakit tabelnya
// sebagai satu template literal panjang di dalam fungsi yang menuntut enam
// permintaan jaringan lebih dulu, dan yang perlu dijaga di sini bentuk yang
// dipilih — sel membaca `poin`, bukan `nilai`; kepala kolom tidak membawa
// `kolom-petunjuk`.
//
// Kalau suatu hari tabelnya dipindah ke fungsi tersendiri yang bisa dipanggil
// langsung, tes ini yang pertama harus ditulis ulang — dan itu perbaikan,
// bukan kerusakan.
//
// SEBELAH PANITIA SUDAH BEGITU. Sel kolom pos pindah ke selPosRegu(), karena
// cetakan Rekap Nilai memakai aturan yang sama dan dua salinannya akan
// menyimpang (CLAUDE.md 11.9). Jadi yang dipotong di bawah bukan lagi badan
// kartuGolongan melainkan badan fungsi itu — DITAMBAH satu pemeriksaan bahwa
// papannya memang memanggilnya. Tanpa yang kedua, seseorang bisa menuliskan
// salinan kedua di dalam tabel dan tes ini tetap hijau: yang diperiksanya
// fungsi yang tidak lagi dipakai siapa pun.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const live = await readFile(new URL("../live/live.js", import.meta.url), "utf8");

/** Badan `selPosRegu` di app.js — sel kolom pos papan Live Score panitia,
 *  dan sel yang sama di cetakan Rekap Nilai. Dipotong dari sumbernya supaya
 *  aturan di sini tidak salah mengenai layar Rekapitulasi, yang memang MASIH
 *  menggambar angka mentah dan memang harus begitu. */
const selPanitia = (() => {
  const awal = app.indexOf("function selPosRegu(k, posKolom, rekapDada) {");
  const akhir = app.indexOf("/** Blok cetak Rekap Nilai", awal);
  assert.ok(awal >= 0 && akhir > awal, "selPosRegu tidak ditemukan di app.js");
  return app.slice(awal, akhir);
})();

/** Badan `kartuGolongan` — tabel Live Score panitia itu sendiri. */
const papanPanitia = (() => {
  const awal = app.indexOf("const kartuGolongan = (g) => {");
  const akhir = app.indexOf("const GOL = URUT_GOLONGAN;", awal);
  assert.ok(awal >= 0 && akhir > awal, "kartuGolongan tidak ditemukan di app.js");
  return app.slice(awal, akhir);
})();

/** Badan `gambarPapan` di live.js — tabel Live Score peserta. */
const papanPeserta = (() => {
  const awal = live.indexOf("function gambarPapan()");
  const akhir = live.indexOf("let pengendaliFilter = null;", awal);
  assert.ok(awal >= 0 && akhir > awal, "gambarPapan tidak ditemukan di live.js");
  return live.slice(awal, akhir);
})();

test("sel lomba panitia membaca poin per komponen, bukan nilai mentah", () => {
  // Poin per komponen kini dijumlahkan per LOMBA sebelum digambar — sumbernya
  // tetap `poin` dari rekap.json (0107), yang berubah cuma pengelompokannya.
  assert.match(selPanitia, /const poinKomponen = rk\.poin \|\| \{\};/,
    "selPosRegu tidak lagi mengambil poin per komponen dari rekap");
  assert.match(selPanitia, /ringkasLomba\(l, k\.golongan, p\.nomor, poinKomponen\)/,
    "sel Live Score panitia tidak lagi membaca poin per komponen");
  assert.match(selPanitia, /angkaRapi\(r\.jumlah\)/,
    "sel Live Score panitia tidak menggambar jumlah poin lombanya");
  assert.doesNotMatch(selPanitia, /selRekap\(|nilaiBagian\(/,
    "sel Live Score panitia kembali menggambar angka mentah");
});

test("papan panitia memakai selPosRegu, bukan salinan kedua di dalam tabel", () => {
  // Pagar untuk tes di atas: yang diperiksanya fungsi, jadi fungsi yang tidak
  // dipanggil siapa pun akan tetap melaporkan hijau.
  assert.match(papanPanitia, /\$\{selPosRegu\(k, posKolom, rekapDada\)/,
    "tabel Live Score tidak lagi merakit sel pos lewat selPosRegu()");
  assert.doesNotMatch(papanPanitia, /ringkasLomba\(/,
    "aturan lomba-per-golongan ditulis ulang di dalam tabel — "
    + "salinan kedua yang suatu hari berbeda pendapat dengan kertasnya");
});

test("sel lomba peserta membaca poin per komponen, bukan nilai mentah", () => {
  assert.match(papanPeserta, /const poin = b\.poin \|\| \{\}/,
    "papan peserta tidak lagi mengambil poin per komponen dari rekap.json");
  assert.doesNotMatch(papanPeserta, /nilaiBagian\(/,
    "papan peserta kembali mengeja angka mentah lewat nilaiBagian()");
});

test("kepala kolom lomba tidak menyebut rentang di kedua papan", () => {
  for (const [nama, sumber] of [["panitia", papanPanitia], ["peserta", papanPeserta]]) {
    assert.doesNotMatch(sumber, /kolom-petunjuk/,
      `kepala kolom Live Score ${nama} kembali membawa rentang — `
      + `"0 – 5" di atas sel berisi 80 membantah selnya sendiri`);
  }
});

test("pagar BOCOR di publish-live.yml ikut menjaga poin", async () => {
  const publish = await readFile(
    new URL("../.github/workflows/publish-live.yml", import.meta.url), "utf8");
  const pagar = publish.slice(publish.indexOf("if d['fase'] != 'penuh':"));
  assert.match(pagar, /for kunci in \('nilai', 'poin'\)/,
    "poin diturunkan dari nilai, jadi ia bocor sama telanjangnya — "
    + "pagar BOCOR harus menyebut keduanya");
});
