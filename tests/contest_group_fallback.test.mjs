// Fallback kode lomba harus bisa dipanggil dari kelompokLomba di module scope.
//
// `kelompokLomba()` dulu tinggal di app.js dan diuji dengan memotong sumbernya
// lalu menjalankannya lewat `new Function`. Ia PINDAH ke util.js supaya papan
// panitia dan papan peserta mengelompokkan lomba dengan aturan yang sama, jadi
// sekarang ia diimpor seperti fungsi biasa — dan yang teruji fungsi yang
// benar-benar dipakai kedua papan, bukan salinan yang dievaluasi ulang.

import assert from "node:assert/strict";
import test from "node:test";

import { kelompokLomba } from "../web/js/util.js";


test("kelompokLomba membuat fallback saat kode_lomba kosong", () => {
  const hasil = kelompokLomba([{
    nama: "Pembidaian & PPPK",
    varian: [{ lomba: "Pembidaian & PPPK", kode_lomba: null }],
  }]);
  assert.equal(hasil.length, 1);
  assert.equal(hasil[0].kode, "pembidaian-pppk");
});


test("kode_lomba dari database menang atas slug", () => {
  // `kode_lomba` dibekukan 0079 supaya mengganti NAMA lomba tidak memutus foto
  // yang sudah diunggah dengan kunci lamanya.
  const hasil = kelompokLomba([{
    nama: "Nama Baru",
    varian: [{ lomba: "Nama Baru", kode_lomba: "kunci-lama" }],
  }]);
  assert.equal(hasil[0].kode, "kunci-lama");
});


test("komponen tanpa lomba berdiri sebagai lomba tersendiri", () => {
  const hasil = kelompokLomba([
    { nama: "Semaphore", varian: [{ lomba: null, kode_lomba: null }] },
    { nama: "Menaksir", varian: [{ lomba: null, kode_lomba: null }] },
  ]);
  assert.deepEqual(hasil.map(l => l.nama), ["Semaphore", "Menaksir"]);
});
