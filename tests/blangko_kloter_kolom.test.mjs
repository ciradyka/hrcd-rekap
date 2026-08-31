// ============================================================================
// hrcd-rekap : tests/blangko_kloter_kolom.test.mjs
// Urutan kolom blangko "Daftar Kloter untuk Petugas".
//
// Dua kolom di lembar ini DITULISI TANGAN di garis start: Kontrak Waktu dan
// Hadir. Keduanya harus berdampingan di ujung kanan, dengan Hadir paling
// kanan — keputusan pemilik acara, 31 Agustus 2026, menggantikan aturan lama
// yang menaruh Hadir di ujung kiri.
//
// Yang dijaga di sini bukan selera melainkan PASANGAN: kepala dan badan harus
// menyebut kolom yang sama banyak dalam urutan yang sama. Selisih satu kolom
// menggeser seluruh tabel tanpa satu pun galat, dan yang menemukannya petugas
// yang mencentang di kolom yang salah.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../web/style.css", import.meta.url), "utf8");

/** Badan siapkanCetakKloter — perakit kedua bentuk lembar kloter. */
const cetakan = (() => {
  const awal = app.indexOf("function siapkanCetakKloter(");
  const akhir = app.indexOf("/* ============================ MEJA FINISH", awal);
  assert.ok(awal >= 0 && akhir > awal, "siapkanCetakKloter tidak ditemukan");
  return app.slice(awal, akhir);
})();

test("kepala lembar petugas: Kontrak Waktu lalu Hadir di ujung kanan", () => {
  const kepala = /<thead><tr>(<th[\s\S]*?)<\/tr><\/thead>/.exec(cetakan);
  assert.ok(kepala, "baris kepala lembar petugas tidak ditemukan");
  const nama = [...kepala[1].matchAll(/<th[^>]*>([^<]*)<\/th>/g)].map(m => m[1].trim());
  assert.deepEqual(nama,
    ["No Dada", "Nama Regu", "Sekolah", "Golongan", "Kontrak Waktu", "Hadir"],
    "urutan kolom lembar petugas berubah");
});

test("badan sepasang dengan kepalanya, dan kedua kotak tulis KOSONG", () => {
  const awal = cetakan.indexOf('bentuk === "staging"');
  const akhir = cetakan.indexOf("      : html`", awal);
  const baris = cetakan.slice(awal, akhir);

  const sel = [...baris.matchAll(/<td([^>]*)>/g)].map(m => m[1]);
  assert.equal(sel.length, 6,
    `badan lembar petugas ${sel.length} kolom, kepalanya 6`);
  assert.match(sel[4], /class="kotak-kontrak"/, "kolom kelima bukan Kontrak Waktu");
  assert.match(sel[5], /class="kotak"/, "kolom keenam bukan Hadir");

  // Kosong = tidak ada satu pun interpolasi di dalam kedua sel itu. Kontrak
  // waktu SENGAJA tidak dicetak dari `regu.kontrak_menit`: yang diminta kotak
  // untuk ditulisi, dan angka tercetak di kotak isian membuat petugas
  // melewatinya (CLAUDE.md 8.7 dan 9.5).
  assert.match(baris, /<td class="kotak-kontrak"><\/td>/,
    "kotak Kontrak Waktu tidak kosong");
  assert.match(baris, /<td class="kotak"><\/td>/, "kotak Hadir tidak kosong");
});

test("lembar peserta TIDAK ikut berubah", () => {
  // Bentuk 'umum' ditempel di papan pengumuman dan dibagikan ke barak. Tidak
  // ada yang menulis di atasnya, jadi kotak kosong di sana cuma kolom yang
  // tidak pernah terisi.
  const awal = cetakan.indexOf("      : html`");
  const akhir = cetakan.indexOf('.join("")', awal);
  const baris = cetakan.slice(awal, akhir);
  assert.doesNotMatch(baris, /kotak/,
    "lembar peserta ikut mendapat kotak tulis — tidak ada yang mengisinya");
});

test("kotak kontrak lebih lega daripada kotak centang", () => {
  // "3,5 jam" atau "09:10" dalam tulisan tangan yang buru-buru, sambil berdiri.
  assert.match(css, /\.print-table \.kotak-kontrak \{ width: 26mm; \}/,
    "lebar kotak Kontrak Waktu hilang atau berubah");
  assert.match(css, /\.print-table \.kotak \{ width: 18mm; \}/,
    "lebar kotak Hadir berubah");
});
