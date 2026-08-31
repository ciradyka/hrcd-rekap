// ============================================================================
// hrcd-rekap : tests/input_pos_v2_simpan_tidak_menimpa.test.mjs
// Tombol SIMPAN NILAI tidak boleh menutupi kotak Nomor dada.
//
// Terukur di iframe 390px sebelum perbaikan: kotak Nomor dada 183-239,
// tombolnya mulai 197 — empat puluh dua piksel menutupi kotak yang justru
// harus diketik lebih dulu, jadi petugas tidak bisa memasukkan satu nilai pun.
//
// SEBABNYA BUKAN TOMBOLNYA. `.card { overflow-x: auto }` berlaku untuk semua
// kartu, dan menurut aturan CSS `overflow-y` ikut jadi `auto` begitu
// `overflow-x` bukan `visible`. Kartu Input Pos v2 karena itu diam-diam
// menjadi scroll container, dan `position: sticky` menempel pada scrollport
// TERDEKAT — kartu itu sendiri, bukan layar. Selama regu belum dipilih
// kartunya pendek, jadi tombol yang seharusnya turun ke dasar layar malah
// dijepit ke dasar kartu: naik, menimpa kotaknya.
//
// Jebakan yang sama sudah pernah tercatat di layar Kejuaraan
// (`.kejuaraan-bagian .card { overflow: visible }`) dan muncul lagi lewat
// gejala yang sama sekali berbeda. Karena itu ia dijaga mesin sekarang.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../web/style.css", import.meta.url), "utf8");

test("kartu Input Pos v2 bukan scroll container", () => {
  assert.match(css, /#v2-kartu \{ overflow: visible; \}/,
    "kartu Input Pos v2 kembali mewarisi `.card { overflow-x: auto }` — "
    + "tombol SIMPAN NILAI akan menempel ke dasar KARTU, bukan ke layar, "
    + "dan menimpa kotak Nomor dada");
});

test("tombol simpan tetap menempel — perbaikannya di kartu, bukan di tombol", () => {
  // Mengganti `sticky` jadi `static` juga menghilangkan tumpang tindihnya,
  // dan sekaligus membuang gunanya: dengan foto terpasang tombolnya berakhir
  // 357px di bawah lipatan, dan dengan papan ketik terbuka bahkan regu tanpa
  // foto pun menuntut menggulir.
  const blok = css.slice(css.indexOf(".v2-simpan-lekat {"));
  assert.match(blok.slice(0, 200), /position: sticky; bottom: \.6rem;/,
    "tombol simpan tidak lagi menempel di dasar layar");
});

test("`.card { overflow-x: auto }` masih ada dan masih beralasan", () => {
  // Kalau suatu hari aturan ini dibuang, kedua penambal di atasnya jadi
  // sampah yang menyesatkan — dan tes ini yang memberi tahu.
  assert.match(css, /\.card \{ overflow-x: auto; \}/,
    "`.card { overflow-x: auto }` hilang — periksa apakah #v2-kartu dan "
    + ".kejuaraan-bagian .card masih perlu membatalkannya");
});
