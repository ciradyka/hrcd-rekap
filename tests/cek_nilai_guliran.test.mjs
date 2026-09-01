// ============================================================================
// hrcd-rekap : tests/cek_nilai_guliran.test.mjs
// Menekan panah di Cek Nilai TIDAK boleh melempar guliran ke atas.
//
// Terukur sebelum perbaikan, di iframe 393x700 dengan Pos 5: halaman 1016px,
// petugas menggulir ke 300 untuk melihat foto slipnya, lalu menekan panah.
// replaceChildren menggambar kerangka yang petak fotonya masih KOSONG,
// halamannya menyusut jadi 700 — tepat setinggi layar — dan browser menjepit
// gulirannya ke 0 karena tidak ada lagi yang bisa digulir. 60 ms kemudian
// fotonya datang dan halamannya kembali 1016, tetapi gulirannya sudah
// telanjur di atas.
//
// Akibatnya tiap satu regu berikutnya menuntut satu guliran lagi, dan layar
// ini dipakai ratusan kali sepagi. Dilaporkan dari lapangan, 1 September 2026.
//
// Yang menjaganya BUKAN menyimpan lalu memulihkan angkanya — cara papan Live
// Score — melainkan menahan TINGGI halamannya, karena halaman yang tidak
// pernah memendek tidak perlu dipulihkan sama sekali. Memulihkan sesudah
// fotonya datang akan MENGEDIP: di lapangan tautan foto bertanda tangan bisa
// memakan setengah detik.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../web/style.css", import.meta.url), "utf8");

/** Badan layarCekNilai saja — nama yang dicari di bawah juga muncul di layar
 *  lain, dan tes yang menemukannya di sana lulus tanpa memeriksa apa pun. */
const layarCek = (() => {
  const awal = app.indexOf("async function layarCekNilai()");
  return app.slice(awal, app.indexOf("const RUTE = {", awal));
})();

test("guliran halaman dipulihkan sesudah kerangkanya digambar ulang", () => {
  assert.match(layarCek, /const gulirHalaman = halaman\.scrollTop;/,
    "guliran halaman tidak diingat sebelum menggambar ulang");
  assert.match(layarCek, /halaman\.scrollTop = gulirHalaman;/,
    "guliran halaman tidak dipasang lagi sesudah menggambar ulang");
});

test("halaman ditahan setinggi semula DALAM DUA LANGKAH", () => {
  // Langkah 1 sendirian meleset 16px: margin bawah kartu terakhir runtuh
  // keluar dari #cek-isi selama tingginya auto, lalu terserap ke dalam begitu
  // min-height memaksanya. Tinggi elemennya sama, tinggi halamannya tidak.
  assert.match(layarCek, /elIsi\.style\.minHeight = `\$\{tinggiIsi\}px`;/,
    "langkah 1 hilang — #cek-isi tidak dipatok setinggi ukurannya yang lama");
  // Langkah 2 sendirian juga meleset: kerangka yang lebih pendek daripada
  // layar membuat scrollHeight berhenti di tinggi layar — 700, bukan 400 —
  // jadi kekurangan yang terbaca 198px dari 498px yang sebenarnya.
  assert.match(layarCek,
    /const kurang = tinggiHalaman - halaman\.scrollHeight;[\s\S]{0,120}tinggiIsi \+ kurang/,
    "langkah 2 hilang — sisa kekurangannya tidak diukur dari halamannya");
});

test("patokan tinggi dilepas lewat finally, dan hanya oleh gambar terbaru", () => {
  // Tanpa `finally` satu jalur keluar yang terlewat — permintaannya gagal,
  // layarnya ditinggalkan, nomornya sudah berpindah — meninggalkan halaman
  // yang tingginya terkunci di angka regu sebelumnya. Tanpa `iniGambar` dua
  // ketukan panah beruntun membuat gambar yang lebih tua melepaskan patokan
  // milik penggantinya, dan gulirannya melompat lagi.
  assert.match(layarCek,
    /finally \{ if \(iniGambar === gambarKe\) elIsi\.style\.minHeight = ""; \}/,
    "patokan tinggi tidak dilepas lewat finally bertanda gambar terbaru");
  assert.match(layarCek, /const iniGambar = \+\+gambarKe;/,
    "nomor gambar tidak dinaikkan saat regunya berganti");
});

test("patokan tinggi TIDAK dipasang saat halamannya tidak sedang digulir", () => {
  // Di tata letak satu layar (>= 1000px) `.isi.cek` setinggi layar dan
  // `overflow: hidden`, jadi guliran halaman selalu 0. min-height di sana
  // justru merusak: #cek-isi anak flex ber-`min-height: 0` yang memang HARUS
  // boleh menyusut, dan mematoknya mendorong halaman jadi lebih tinggi
  // daripada layar — persis yang sudah pernah diperbaiki di blok CSS-nya.
  assert.match(layarCek, /if \(gulirHalaman > 0\) \{/,
    "patokan tinggi dipasang tanpa memeriksa halamannya sedang digulir");
  assert.match(css, /#cek-isi \{ flex: 1; min-height: 0;/,
    "#cek-isi tidak lagi anak flex yang boleh menyusut — pagar di JS memakai "
    + "itu sebagai alasannya");
});

test("guliran kotak lomba ikut dipasang lagi", () => {
  // Yang menggulir di rentang >= 1000px kotak lombanya sendiri, dan kotak itu
  // DIBUANG oleh replaceChildren.
  assert.match(layarCek, /const kotakLama = elIsi\.querySelector\(":scope > \.card"\);/,
    "guliran kotak lomba tidak diingat");
  assert.match(layarCek, /if \(kotakBaru && gulirKotak\) kotakBaru\.scrollTop = gulirKotak;/,
    "guliran kotak lomba tidak dipasang lagi");
  // Di blok satu-layar, BUKAN yang di rentang HP — `#cek-isi > .card` ditulis
  // dua kali, dan yang di 560px cuma mengatur padding.
  const satuLayar = css.slice(css.indexOf("@media (min-width: 1000px)"));
  const awal = satuLayar.indexOf("#cek-isi > .card {");
  assert.ok(awal > 0, "aturan #cek-isi > .card hilang dari blok satu-layar");
  assert.match(satuLayar.slice(awal, satuLayar.indexOf("}", awal)), /overflow: auto;/,
    "kotak lomba tidak lagi menggulir sendiri — pemulihan di JS jadi sia-sia");
});
