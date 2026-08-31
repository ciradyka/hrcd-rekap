// ============================================================================
// hrcd-rekap : tests/nomor_dada_tiga_digit.test.mjs
// Setiap kotak nomor dada menampilkan tiga digit sambil diketik.
//
// Yang dijaga di sini bukan dada3() — itu sudah lama ada dan dipakai di
// puluhan tempat — melainkan bahwa SETIAP kotak isian nomor dada memakainya.
// Kotak nomor dada tersebar di tiga layar yang ditulis pada waktu berbeda, dan
// yang keempat akan ditulis oleh orang yang tidak tahu aturan ini ada.
//
// Kotak `type="number"` DILARANG untuk nomor dada: kotak number membuang nol
// di depan apa pun yang ditulis ke dalamnya, jadi "001" mustahil tergambar di
// sana. Itu bukan pilihan gaya melainkan satu-satunya sebab layar Cek Nilai
// tidak bisa ikut ketika aturan ini dipasang.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");

/** Baris <input> yang id-nya memuat "dada". Komentar dibuang lebih dulu supaya
 *  penjelasan yang menyebut type="number" tidak ikut terbaca sebagai markup. */
const kotakDada = app
  .replace(/<!--[\s\S]*?-->/g, "")
  .match(/<input[^>]*id="[^"]*dada[^"]*"[^>]*>/g) || [];

test("ada kotak nomor dada untuk diperiksa", () => {
  assert.ok(kotakDada.length >= 3,
    `cuma ${kotakDada.length} kotak nomor dada ditemukan — pola pencariannya `
    + "mungkin sudah tidak cocok, dan tes yang tidak menemukan apa-apa selalu hijau");
});

test("tidak ada kotak nomor dada bertipe number", () => {
  for (const k of kotakDada) {
    assert.doesNotMatch(k, /type="number"/,
      `kotak number membuang nol di depan, jadi "001" tidak akan pernah `
      + `tergambar: ${k.replace(/\s+/g, " ").slice(0, 90)}`);
  }
});

test("tiap kotak nomor dada dipasangi tiga digit", () => {
  const id = [...app.matchAll(/<input[^>]*id="([^"]*dada[^"]*)"/g)].map(m => m[1]);
  // Definisi fungsinya sendiri tidak dihitung — ia juga berbunyi "pasangDada3(".
  const dipasang = [...app.matchAll(/(?<!function )pasangDada3\((\w+)/g)].map(m => m[1]);
  assert.equal(dipasang.length, id.length,
    `${id.length} kotak nomor dada (${id.join(", ")}) tapi ${dipasang.length} `
    + "pemasangan pasangDada3 — satu layar tidak ikut");
});

test("nol mengosongkan kotaknya", () => {
  // Tanpa cabang ini "001" yang dihapus satu huruf jadi "00", dibaca 0, lalu
  // dipasang kembali jadi "000" — dan kotaknya tidak akan pernah bisa
  // dikosongkan lagi.
  const awal = app.indexOf("function pasangDada3(");
  const fungsi = app.slice(awal, app.indexOf("\n}", awal));
  assert.match(fungsi, /n === 0 \? "" : dada3\(n\)/,
    "kotak nomor dada tidak bisa dikosongkan lagi dengan menghapus");
});
