import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../web/style.css", import.meta.url), "utf8");
const awal = app.indexOf("async function layarKejuaraan()");
const layar = app.slice(awal, app.indexOf("/* ============================ AKUN", awal));

test("Kejuaraan dibagi menjadi section yang dibaca panitia", () => {
  for (const judul of ["Juara Umum", "Juara Umum Penegak", "Penegak PA", "Penegak PI",
    "Juara Umum Penggalang", "Penggalang PA", "Penggalang PI", "Penghargaan Khusus"])
    assert.ok(app.includes(`["${judul}"`));
  assert.match(app, /\["Juara Umum", x => x\.kode === "juara_umum"/);
});

test("pilihan manual mencari nomor dada, regu, dan sekolah", () => {
  assert.match(app, /placeholder="Nomor dada \/ nama regu \/ asal sekolah…"/);
  assert.match(app, /r\.nomor_dada.*dada3\(r\.nomor_dada\).*r\.nama_regu.*r\.nama_sekolah/s);
  assert.match(app, /slice\(0, 8\)/);
});

test("pilihan manual hanya menawarkan regu Eksternal yang sudah tiba", () => {
  assert.match(app, /r\.nomor_dada != null && r\.jam_datang != null/);
  assert.match(app, /!String\(r\.golongan\)\.startsWith\("intern_"\)/);
  assert.match(app, />\s*Ubah Juara\s*<\/button>/);
  assert.doesNotMatch(app, /Hapus pilihan/);
  assert.match(app, /kejuaraan-terkunci" \$\{x\.regu_id \? "" : "hidden"\}/);
  assert.match(app, /terkunci\.hidden = true;\s*isian\.hidden = false;/);
});

test("pilihan manual memakai snapshot tanpa menghitung rekap lagi", () => {
  assert.match(layar, /bisaUbah \? cacheLiveScore\(\)/);
  assert.match(layar, /snapshot \? snapshot\.rekap \|\| \[\] : \[\]/);
  assert.doesNotMatch(layar, /rekapPenuh\(/);
});

test("menyimpan juara mengunci baris tanpa memuat ulang layar", () => {
  assert.match(app, /simpanKejuaraanManual[\s\S]*kejuaraan-nilai[\s\S]*isian\.hidden = true;[\s\S]*terkunci\.hidden = false;/);
  assert.doesNotMatch(app, /simpanKejuaraanManual\(pilih\.dataset\.kode, dipilih\.regu_id\);\s*await layarKejuaraan\(\)/);
});

test("layout desktop menempatkan juara umum di tengah dan golongan berdampingan", () => {
  assert.match(css, /@media \(min-width: 900px\)[\s\S]*\.kejuaraan-umum[\s\S]*justify-self: center/);
  assert.match(css, /\.kejuaraan-umum-penegak \{ grid-column: 1; grid-row: 2; \}/);
  assert.match(css, /\.kejuaraan-umum-penggalang \{ grid-column: 2; grid-row: 2; \}/);
  assert.match(css, /\.kejuaraan-penegak-pa \{ grid-column: 1; grid-row: 3; \}/);
  assert.match(css, /\.kejuaraan-penggalang-pa \{ grid-column: 2; grid-row: 3; \}/);
  assert.match(css, /\.kejuaraan-khusus \{ grid-column: 1 \/ -1; grid-row: 5; \}/);
});

test("tiap tingkat punya warna sendiri dan judulnya tetap tertulis", () => {
  assert.match(css, /\.kejuaraan-bagian \.card \{ border-left: 5px solid var\(--aksen\); \}/);
  assert.match(css, /\.kejuaraan-bagian \.card > h2 \{ color: var\(--aksen\); \}/);
  for (const [kelas, aksen] of [
    ["kejuaraan-umum", "#a16207"],
    ["kejuaraan-umum-penegak", "#1a56db"],
    ["kejuaraan-umum-penggalang", "#067647"],
    ["kejuaraan-khusus", "#6941c6"],
  ]) assert.ok(css.includes(`.${kelas} `) && css.includes(`{ --aksen: ${aksen}; `),
    `warna aksen ${kelas} hilang`);
  // PA dan PI ikut warna tingkatnya, jadi Penegak dan Penggalang terbaca
  // sebagai dua kelompok sebelum judulnya sempat dibaca.
  assert.match(css, /\.kejuaraan-penegak-pa,\s*\.kejuaraan-penegak-pi\s+\{ --aksen: #1a56db; \}/);
  assert.match(css, /\.kejuaraan-penggalang-pa,\s*\.kejuaraan-penggalang-pi\s+\{ --aksen: #067647; \}/);
});

test("garis pemisah juara ada di baris, bukan di tiap sel", () => {
  assert.match(css, /\.table-kejuaraan > tbody > tr \{ border-bottom: 1px solid var\(--garis\); \}/);
  assert.match(css, /\.table-kejuaraan > tbody > tr > th,\s*\.table-kejuaraan > tbody > tr > td \{ border-bottom: 0; \}/);
  assert.match(css, /@media \(max-width: 900px\) \{\s*\.table-kejuaraan > tbody > tr \{\s*display: grid; grid-template-columns: 6\.75rem 1fr;/);
});
