import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../web/style.css", import.meta.url), "utf8");
const awal = app.indexOf("async function layarKejuaraan()");
const layar = app.slice(awal, app.indexOf("/* ============================ AKUN", awal));

test("Kejuaraan dibagi menjadi section yang dibaca panitia", () => {
  for (const judul of ["Juara Umum", "Juara Umum Penegak", "Juara Umum Penggalang",
    "Juara Kostum", "Juara Yel Yel", "Peserta Terfavorit", "Penghargaan Khusus"])
    assert.ok(app.includes(`["${judul}"`), `section hilang: ${judul}`);
  assert.match(app, /\["Juara Umum", x => x\.kode === "juara_umum"/);

  // Keempat section golongan TIDAK ditulis sebagai judul harfiah. Judulnya
  // diambil GOLONGAN_LABEL lewat gelarGolongan(), dan itu disengaja: nama
  // golongan hidup di satu tempat saja (util.js), dijaga
  // periksa_urutan_golongan.py. Menuliskannya lagi di sini membuat tempat
  // kedua yang harus ikut benar tiap kali namanya berubah.
  for (const kode of ["penegak_pa", "penegak_pi", "penggalang_pa", "penggalang_pi"])
    assert.ok(app.includes(`gelarGolongan("${kode}"`), `section golongan hilang: ${kode}`);
  assert.match(app, /GOLONGAN_LABEL\[kode\], x => x\.kode\.startsWith\(kode \+ "_"\)/);
  assert.doesNotMatch(app, /\["Penegak PA",/);
});

test("pilihan manual mencari nomor dada, regu, dan sekolah", () => {
  // DUA kotak cari, karena ada dua jenis penghargaan manual: yang menunjuk
  // REGU (Kostum, Terfavorit) dan yang menunjuk SEKOLAH (Pangkalan Terjauh,
  // sejak migrasi 0153). Petunjuknya harus menyebut yang benar — kotak yang
  // meminta nomor dada padahal yang dicari sekolah membuat petugas mengetik
  // angka yang tidak akan pernah cocok.
  assert.match(app, /placeholder="\$\{x\.sumber === "manual_sekolah"/);
  assert.ok(app.includes('"Cari nama sekolah…"'));
  assert.ok(app.includes('"Cari nomor dada / regu / sekolah…"'));
  assert.match(app, /r\.nomor_dada.*dada3\(r\.nomor_dada\).*r\.nama_regu.*r\.nama_sekolah/s);
  assert.match(app, /slice\(0, 8\)/);
});

test("pilihan manual hanya menawarkan regu Eksternal yang sudah tiba", () => {
  assert.match(app, /r\.nomor_dada != null && r\.jam_datang != null/);
  assert.match(app, /!String\(r\.golongan\)\.startsWith\("intern_"\)/);
  assert.match(app, />\s*Ubah Juara\s*<\/button>/);

  // Daftar sekolah untuk Pangkalan Terjauh dipersempit ke sekolah yang
  // BENAR-BENAR mengirim regu. Tabel `sekolah` memuat ratusan baris direktori
  // sejak 0157, dan menawarkan semuanya membuat satu salah klik memberi gelar
  // kepada pangkalan yang tidak hadir.
  assert.match(app, /const ikut = new Set\(opsi\.map\(r => r\.nama_sekolah\)\)/);
  assert.match(app, /filter\(s => ikut\.has\(s\.name\)\)/);

  // Baris yang sudah ada juaranya tampil terkunci. Kuncinya `nama_sekolah`,
  // bukan `regu_id`: Pangkalan Terjauh menunjuk sekolah dan tidak pernah punya
  // regu_id, jadi memakai regu_id membuatnya selamanya terlihat belum diisi.
  assert.match(app, /kejuaraan-terkunci" \$\{x\.nama_sekolah \? "" : "hidden"\}/);
  assert.match(app, /kejuaraan-isian" \$\{x\.nama_sekolah \? "hidden" : ""\}/);
  assert.match(app, /simpanKejuaraanManual[\s\S]*kejuaraan-nilai[\s\S]*isian\.hidden = true;[\s\S]*terkunci\.hidden = false;/);
  assert.doesNotMatch(app, /simpanKejuaraanManual\(pilih\.dataset\.kode, dipilih\.regu_id\);\s*await layarKejuaraan\(\)/);
});

test("pilihan manual memakai snapshot tanpa menghitung rekap lagi", () => {
  assert.match(layar, /bisaUbah \? cacheLiveScore\(\)/);
  assert.match(layar, /snapshot \? snapshot\.rekap \|\| \[\] : \[\]/);
  assert.doesNotMatch(layar, /rekapPenuh\(/);
});

test("Juara Umum menampilkan poin juara dan total skor", () => {
  assert.match(layar, /x\.poin_juara/);
  assert.match(layar, /x\.jumlah_skor/);
  assert.match(layar, /poin juara ·/);
  assert.match(layar, /total skor 6 besar/);
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

  // Empat kartu penghargaan khusus, dua baris. Kostum dan Terfavorit — dua
  // kartu yang panitia ISI — berdiri di KOLOM YANG SAMA supaya kotak carinya
  // berbaris lurus dari kartu ke kartu. Menukar salah satunya ke kolom lain
  // membuat kedua kotak isian itu berpindah tempat di tengah pekerjaan.
  assert.match(css, /\.kejuaraan-kostum \{ grid-column: 1; grid-row: 5; \}/);
  assert.match(css, /\.kejuaraan-terfavorit \{ grid-column: 1; grid-row: 6; \}/);
  assert.match(css, /\.kejuaraan-yel-yel \{ grid-column: 2; grid-row: 5; \}/);
  assert.match(css, /\.kejuaraan-khusus \{ grid-column: 2; grid-row: 6; \}/);
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
