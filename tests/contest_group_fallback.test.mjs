// Fallback kode lomba harus bisa dipanggil dari kelompokLomba di module scope.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
// Potongannya dibatasi `kolomCetakPos`, yang berdiri tepat sesudah
// kelompokLomba(). Patokan sebelumnya `const varianUntuk` — dan fungsi itu
// PINDAH ke util.js supaya papan panitia dan papan peserta memilih varian
// dengan aturan yang sama, lalu berkas ini berhenti menemukan patokannya.
const awal = app.indexOf("const slugLomba =");
const akhir = app.indexOf("const kolomCetakPos", awal);
const sumber = app.slice(awal, akhir);
const { kelompokLomba } = new Function(
  `${sumber}; return { kelompokLomba };`,
)();


test("kelompokLomba membuat fallback saat kode_lomba kosong", () => {
  const hasil = kelompokLomba([{
    nama: "Pembidaian & PPPK",
    varian: [{ lomba: "Pembidaian & PPPK", kode_lomba: null }],
  }]);

  assert.equal(hasil.length, 1);
  assert.equal(hasil[0].nama, "Pembidaian & PPPK");
  assert.equal(hasil[0].kode, "pembidaian-pppk");
});


test("kode_lomba database tetap menang atas fallback nama", () => {
  const hasil = kelompokLomba([{
    nama: "Pembidaian & PPPK",
    varian: [{ lomba: "Pembidaian & PPPK", kode_lomba: "pembidaian" }],
  }]);

  assert.equal(hasil[0].kode, "pembidaian");
});

