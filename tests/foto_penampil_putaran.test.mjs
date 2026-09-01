// ============================================================================
// hrcd-rekap : tests/foto_penampil_putaran.test.mjs
// Foto slip yang sudah diputar harus TETAP tegak waktu dibuka besar.
//
// Sudut putarnya disimpan per foto (migrasi 0167) dan diterapkan CSS —
// berkasnya sendiri tidak pernah disentuh, supaya bukti tidak dikompres ulang
// tiap kali ada yang salah tekan. Yang tidak ikut dipikirkan waktu itu: `<a
// href>` di dalam petaknya menyerahkan BERKAS ASLI ke browser, dan berkas asli
// masih miring. Jadi petugas memutar fotonya, mengetuknya untuk membaca
// tulisan tangannya lebih besar, dan mendapat gambar melintang lagi.
// Dilaporkan begitu, 2 September 2026.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../web/style.css", import.meta.url), "utf8");

test("ketukan pada KETIGA petak foto dibelokkan ke penampil", () => {
  // Lembar pos (a.fg-petak), Input Nilai Pos v2 (a.foto-tautan), Cek Nilai
  // (a.fg-buka). Ketiganya membungkus tautannya dengan elemen ber-data-putar,
  // jadi satu pendengar melayani ketiganya.
  assert.match(app,
    /closest\("a\.fg-buka, a\.fg-petak, a\.foto-tautan"\)/,
    "pendengar tidak lagi mengenali ketiga petak foto");
  assert.match(app, /const wadah = taut\.closest\("\[data-putar\]"\);/,
    "sudut putar tidak dibaca dari pembungkusnya");
  assert.match(app, /bukaFotoPenuh\(url, wadah \? wadah\.dataset\.putar : 0/,
    "penampil dibuka tanpa membawa sudut putarnya");
});

test("Ctrl/Cmd-klik tetap membuka berkas aslinya", () => {
  // Yang memang mau berkas mentahnya di tab sendiri harus tetap bisa, dan
  // `target="_blank"` di markup-nya tetap jadi jaring kalau JS gagal dimuat.
  assert.match(app,
    /if \(e\.metaKey \|\| e\.ctrlKey \|\| e\.shiftKey \|\| e\.altKey\) return;/,
    "klik bertombol pengubah ikut dibelokkan");
});

test("penampil ditutup Esc, latar, silang, dan pindah layar", () => {
  const fungsi = app.slice(app.indexOf("function bukaFotoPenuh("),
                           app.indexOf("/* Satu pendengar untuk KETIGA petak foto"));
  assert.ok(fungsi.length > 0, "bukaFotoPenuh tidak ditemukan");
  assert.match(fungsi, /e\.key === "Escape"/, "Esc tidak menutup penampil");
  assert.match(fungsi, /e\.target === el \|\| e\.target\.closest\("\.lihat-tutup"\)/,
    "latar atau tombol silang tidak menutup penampil");
  // Penampilnya menempel di <body>, jadi LAYAR.replaceChildren() tidak
  // membawanya pergi — tanpa baris ini ia bertahan menutupi layar berikutnya.
  assert.match(fungsi, /window\.addEventListener\("hashchange", tutup, \{ signal \}\)/,
    "penampil tidak ditutup saat pindah layar");
  // Pendengarnya menempel di luar elemennya, jadi membuang elemen saja
  // meninggalkan mereka hidup. Satu AbortController melepas semuanya.
  assert.match(fungsi, /function tutup\(\) \{ el\.remove\(\); pengendali\.abort\(\); \}/,
    "pendengar penampil tidak dilepas saat ditutup");
});

test("gambar SENDIRI tidak menutup penampil", () => {
  // Di HP jari mendarat di tengah layar saat hendak mencubit untuk
  // memperbesar, dan penampil yang tertutup oleh cubitan pertama tidak bisa
  // dipakai membaca tulisan tangan — satu-satunya alasan foto ini dibuka.
  const fungsi = app.slice(app.indexOf("function bukaFotoPenuh("),
                           app.indexOf("/* Satu pendengar untuk KETIGA petak foto"));
  assert.doesNotMatch(fungsi, /el\.addEventListener\("click", tutup\)/,
    "seluruh penampil menutup saat diketuk, termasuk gambarnya");
});

test("90 dan 270 DIBATASI dulu, baru diputar", () => {
  // Urutannya yang menentukan benar tidaknya: kalau gambarnya diputar dulu
  // lalu dibatasi, yang dibatasi kotak SEBELUM berputar — dan slip tegak yang
  // diputar 90 derajat menjulur keluar layar di kedua sisinya.
  const blok = css.slice(css.indexOf(".lihat-foto {"), css.indexOf(".lihat-tutup {"));
  assert.ok(blok.length > 0, "aturan .lihat-foto tidak ditemukan");
  const batas = blok.indexOf("max-width: calc(100dvh - 2rem)");
  const putar = blok.indexOf('img[data-putar="90"]  { transform: rotate(90deg); }');
  assert.ok(batas > 0, "batas sumbu tertukar tidak dipasang untuk 90/270");
  assert.ok(putar > batas,
    "gambar diputar sebelum batasnya ditukar — hasilnya menjulur keluar layar");
  assert.match(blok, /max-height: calc\(100dvw - 2rem\)/,
    "batas tinggi tidak diambil dari lebar layar");
});

test("penampil berdiri DI ATAS dialog", () => {
  // Satu jalan masuknya lewat dialog foto lembar pos, yang z-index-nya 60.
  const pen = css.slice(css.indexOf(".lihat-foto {"));
  const z = pen.slice(0, pen.indexOf("}")).match(/z-index: (\d+)/);
  assert.ok(z, "penampil tidak punya z-index");
  assert.ok(Number(z[1]) > 60,
    `z-index penampil ${z[1]}, tidak di atas dialog (60) yang membukanya`);
});
