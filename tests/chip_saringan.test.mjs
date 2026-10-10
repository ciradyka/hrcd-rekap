// ============================================================================
// hrcd-rekap : tests/chip_saringan.test.mjs
// Setiap layar yang menyaring memakai SATU bentuk chip: chipSaringHtml() untuk
// markup-nya dan tandaiChip() untuk menyalakannya.
//
// Sebelumnya ada tiga salinan tulisan tangan — alatTabel(), chip riwayat
// nilai, dan Cek Nilai — dan ketiganya sudah mulai berbeda: "Semua" di depan
// di satu layar dan di belakang di layar lain, label pendek untuk HP hanya di
// satu, dan perbaikan fokus papan ketik hanya sampai ke Cek Nilai. Satu
// fungsi berarti perbaikan berikutnya sampai ke semuanya sekaligus.
//
// Pemilih kloter di layar Keberangkatan BUKAN chip saringan: ia memilih satu
// kloter dan membawa dua baris isi (nomor, lalu jam), jadi ia sengaja tidak
// ikut di sini.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");

test("chip saringan hanya ditulis oleh chipSaringHtml()", () => {
  const tulisanTangan = app.match(/<button[^>]*class="option option-small" data-(saring|lomba)=/g) || [];
  const diFungsi = app.slice(app.indexOf("function chipSaringHtml("),
                             app.indexOf("function tandaiChip("));
  assert.equal(tulisanTangan.length, 0,
    `${tulisanTangan.length} chip saringan ditulis tangan di luar chipSaringHtml()`);
  assert.match(diFungsi, /class="option option-small" data-\$\{atribut\}=/,
    "chipSaringHtml() tidak lagi membangun chip-nya");
});

test("ketiga tempat memakai chipSaringHtml() dan tandaiChip()", () => {
  assert.match(app, /<div class="filter-row">\$\{chipSaringHtml\(saringan, saringAktif\)\}<\/div>/,
    "alatTabel() tidak memakai chipSaringHtml()");
  assert.match(app, /\], "", "lomba"\)\}<\/div>/, "chip riwayat nilai tidak memakai chipSaringHtml()");
  assert.match(app, /elSaring\.innerHTML = chipSaringHtml\(/, "Cek Nilai tidak memakai chipSaringHtml()");
  for (const pola of [/tandaiChip\(LAYAR, "saring", saring\);/, /tandaiChip\(kartu, "lomba", pilih\);/,
                      /tandaiChip\(elSaring, "saring", saring\);/]) {
    assert.match(app, pola, `chip tidak dinyalakan lewat tandaiChip(): ${pola}`);
  }
});

test("\"Semua\" adalah chip PERTAMA di setiap layar", () => {
  const daftar = [...app.matchAll(/saringan: \[([\s\S]*?)\]/g)].map(m => m[1]);
  assert.ok(daftar.length >= 4, `cuma ${daftar.length} daftar saringan ditemukan`);
  for (const isi of daftar) {
    const pertama = isi.match(/\{ kode: "([^"]+)"/);
    assert.equal(pertama && pertama[1], "semua", `daftar saringan dimulai dengan ${pertama && pertama[1]}`);
  }
  assert.match(app, /chipSaringHtml\(\[\s*\{ kode: "", label: "Semua" \},/,
    "chip riwayat nilai tidak dimulai dengan Semua");
  const saringCek = app.slice(app.indexOf("const SARING = ["));
  assert.match(saringCek, /^const SARING = \[\s*\["semua", "Semua",/, "saringan Cek Nilai tidak dimulai dengan Semua");
});
