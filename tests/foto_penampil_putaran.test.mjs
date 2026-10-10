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
import { sumberPanitia } from "./sumber.mjs";

const app = await sumberPanitia();
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

test("bingkai seukuran gambar yang TERLIHAT, sumbu ditukar untuk 90 dan 270", () => {
  // Bingkai yang mengikuti kotak <img> bukan bingkai gambarnya: object-fit
  // menaruh pita hitam di dalam kotak itu, dan rotate() tidak mengubah kotak
  // tata letaknya. Slip yang diputar 90 derajat di HP dulu meluap dari tepi
  // kiri bingkai dan terpotong di kanan, silangnya melayang di atas pita
  // hitam, dan ketukan di pita itu tidak menutup penampil.
  const fungsi = app.slice(app.indexOf("function bukaFotoPenuh("),
                           app.indexOf("/* Satu pendengar untuk KETIGA petak foto"));
  assert.match(fungsi, /const tukarSumbu = \["90", "270"\]\.includes\(img\.dataset\.putar\);/,
    "90 dan 270 tidak menukar sumbu");
  assert.match(fungsi, /const lebarTampil = tukarSumbu \? img\.naturalHeight : img\.naturalWidth;/,
    "lebar yang tampil tidak diambil dari tinggi asli untuk 90/270");
  assert.match(fungsi, /Math\.min\(1, ruangLebar \/ lebarTampil, ruangTinggi \/ tinggiTampil\)/,
    "skala tidak dibatasi ruang layar, atau gambar kecil ikut diperbesar");
  assert.match(fungsi, /bingkai\.style\.width = `\$\{lebarTampil \* skala\}px`;/,
    "bingkai tidak diberi lebar gambar yang terlihat");
  assert.match(fungsi, /img\.style\.width = `\$\{img\.naturalWidth \* skala\}px`;/,
    "<img> tidak diberi ukuran aslinya yang diperkecil");
});

test("ukurannya dihitung ulang saat dimuat dan saat layar berubah", () => {
  // Foto dari cache bisa sudah selesai dimuat sebelum pendengarnya terpasang,
  // dan HP yang diputar ke mendatar menukar ruangnya.
  const fungsi = app.slice(app.indexOf("function bukaFotoPenuh("),
                           app.indexOf("/* Satu pendengar untuk KETIGA petak foto"));
  assert.match(fungsi, /img\.addEventListener\("load", ukurBingkai, \{ signal \}\);/,
    "ukuran tidak dihitung saat fotonya selesai dimuat");
  assert.match(fungsi, /window\.addEventListener\("resize", ukurBingkai, \{ signal \}\);/,
    "ukuran tidak dihitung ulang saat layar berubah");
  assert.match(fungsi, /^\s*ukurBingkai\(\);\s*$/m,
    "foto yang sudah ada di cache tidak pernah diukur");
});

test("gambar diputar dari TITIK TENGAH bingkai, dan baru tampil sesudah terukur", () => {
  const blok = css.slice(css.indexOf(".lihat-foto {"), css.indexOf(".lihat-tutup {"));
  assert.ok(blok.length > 0, "aturan .lihat-foto tidak ditemukan");
  assert.match(blok, /\.lihat-foto img \{[^}]*position: absolute; left: 50%; top: 50%;/,
    "gambar tidak ditaruh di titik tengah bingkai");
  for (const sudut of ["90", "180", "270"]) {
    assert.ok(blok.includes(
      `.lihat-foto img[data-putar="${sudut}"]` + (sudut === "90" ? "  " : " ") +
      `{ transform: translate(-50%, -50%) rotate(${sudut}deg); }`),
      `putaran ${sudut} kehilangan translate(-50%, -50%) dan bergeser dari tengah`);
  }
  // Foto 4000px yang tergambar sebelum ukurannya dipasang memenuhi layar
  // sekejap lalu menyusut.
  assert.match(blok, /\.lihat-foto img \{[^}]*visibility: hidden;/,
    "gambar tampil sebelum diukur");
  assert.match(blok, /\.lihat-foto img\.terukur \{ visibility: visible; \}/,
    "gambar yang sudah diukur tidak pernah tampil");
});

test("penampil berdiri DI ATAS dialog", () => {
  // Satu jalan masuknya lewat dialog foto lembar pos, yang z-index-nya 60.
  const pen = css.slice(css.indexOf(".lihat-foto {"));
  const z = pen.slice(0, pen.indexOf("}")).match(/z-index: (\d+)/);
  assert.ok(z, "penampil tidak punya z-index");
  assert.ok(Number(z[1]) > 60,
    `z-index penampil ${z[1]}, tidak di atas dialog (60) yang membukanya`);
});
