// ============================================================================
// hrcd-rekap : tests/cek_nilai_satu_layar.test.mjs
// Cek Nilai di laptop: sebanyak mungkin foto dalam satu layar, tanpa menggulir.
//
// Layar ini dipakai untuk MENGECEK — mata melompat dari angka yang diketik ke
// tulisan tangan di fotonya, lomba demi lomba, ratusan kali. Terukur sebelum
// perbaikan, di 1440x820 dengan Pos 1 (lima lomba, lima foto): halaman 3239px
// di layar 820px, harus menggulir 2419px, dan yang terlihat CUMA SATU FOTO.
//
// Sesudahnya, diukur di lima ukuran laptop: lima dari lima foto terlihat, nol
// guliran.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../web/style.css", import.meta.url), "utf8");

test("kelas layar di-toggle bersama wide dan lembar, bukan dipasang sendiri", () => {
  // Kelas yang dipasang di layarnya sendiri akan TERTINGGAL waktu pindah
  // layar, dan layar berikutnya ikut terpotong setinggi viewport.
  assert.match(app, /LAYAR\.classList\.toggle\("cek", lebar === "cek"\);/,
    "kelas `cek` tidak di-toggle di pasangKepala bersama wide dan lembar");
  assert.match(app, /pasangKepala\("Cek Nilai", "cek"\);/,
    "layar Cek Nilai tidak meminta tata letak satu-layar");
});

test("tinggi header diukur, tidak ditebak", () => {
  // Header tumbuh sebaris lagi kalau nama akun panjang; angka tetap apa pun
  // akan benar di satu ukuran dan memotong foto di ukuran lain.
  assert.match(app, /LAYAR\.style\.setProperty\(\s*"--kepala"/,
    "tinggi header tidak diukur ke dalam --kepala");
  assert.match(css, /height: calc\(100dvh - var\(--kepala, \d+px\)\);/,
    "tata letak tidak memakai tinggi header yang diukur");
});

test("pengamat header memakai sinyal layar yang SUDAH ADA", () => {
  // sinyalLayarBaru() MEMBATALKAN sinyal sebelumnya. Panggilan kedua di layar
  // yang sama membatalkan sinyal layar itu sendiri, dan muatPos() lalu
  // berhenti di `if (sinyal.aborted) return` — layarnya menggantung di
  // "Memuat…" selamanya, tanpa satu pun galat. Itu benar-benar terjadi saat
  // tata letak ini dibangun.
  const awal = app.indexOf("async function layarCekNilai()");
  const akhir = app.indexOf("const RUTE = {", awal);
  // Komentar dibuang dulu: alasan aturan ini justru dijelaskan di komentar
  // tepat di atas kodenya, dan nama fungsinya disebut di sana.
  const layar = app.slice(awal, akhir)
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
  assert.equal((layar.match(/sinyalLayarBaru\(\)/g) || []).length, 1,
    "layarCekNilai memanggil sinyalLayarBaru() lebih dari sekali — panggilan "
    + "kedua membatalkan sinyal layarnya sendiri");
  assert.match(layar, /putusSaatPindah\(sinyal, pengamatKepala\)/,
    "pengamat header tidak dilepas lewat sinyal layar");
});

test("lomba berjajar, foto mengisi sisa tinggi", () => {
  const blok = css.slice(css.indexOf("@media (min-width: 1000px)"));
  assert.match(blok, /grid-template-columns: repeat\(auto-fit, minmax\(170px, 1fr\)\);/,
    "lebar minimum kolom berubah — pada 185px lima lomba tidak muat di laptop "
    + "1024px dan gridnya membungkus jadi dua baris");
  assert.match(blok, /\.isi\.cek \.cek-foto \{ flex: 1; min-height: 150px;/,
    "foto tidak lagi mengisi sisa tinggi, atau pagar runtuhnya hilang");
  assert.match(blok, /\.isi\.cek \.cek-foto \.fg-petak \{ height: 100%; \}/,
    "petak foto kembali dipatok tinggi tetap");
});

test("selektor kartu kendali bukan :first-of-type", () => {
  // Saudara pertama di dalam .isi adalah <div id="pita-antrean">, jadi
  // `div:first-of-type` menunjuk DIA — aturannya tidak pernah mengenai apa pun
  // dan kartunya tetap setinggi 163px. Terukur di browser.
  const blok = css.slice(css.indexOf("@media (min-width: 1000px)"));
  assert.doesNotMatch(blok, /\.isi\.cek > \.card:first-of-type/,
    "kartu kendali kembali dipilih dengan :first-of-type, yang menunjuk "
    + "#pita-antrean dan tidak mengenai kartunya");
});
