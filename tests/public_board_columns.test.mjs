// Papan peserta dan papan panitia menyusun kolom dengan aturan yang SAMA.
//
// Bukan tes tata letak. Yang dijaga: `live.js` tidak boleh punya rumus
// kolomnya sendiri. Salinan tangan yang dulu berdiri di sana menggabungkan
// menurut NAMA tanpa syarat, sedangkan `kolomPos()` hanya menggabungkan nama
// yang memang punya varian bergolongan. Selama tidak ada dua wahana bernama
// sama tanpa golongan di satu pos, keduanya sepakat — dan menamai dua
// penilaian dengan nama yang sama adalah hal yang bisa dilakukan panitia dari
// DATA, tanpa menyentuh kode.
//
// Kegagalannya senyap: papan panitia dua kolom, papan peserta satu, dan nilai
// komponen kedua hilang dari halaman peserta tanpa satu pun galat.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { kolomPos, varianUntuk } from "../web/js/util.js";


const live = await readFile(new URL("../live/live.js", import.meta.url), "utf8");


test("dua wahana bernama sama tanpa golongan tetap dua kolom", () => {
  // Inilah kasus yang membedakan kedua rumus. Rumus lama di live.js
  // menghasilkan SATU kolom di sini.
  const kolom = kolomPos([
    { kode: "sandi_a", name: "Sandi", golongan: null },
    { kode: "sandi_b", name: "Sandi", golongan: null },
  ]);
  assert.equal(kolom.length, 2);
});


test("varian bergolongan digabung jadi satu kolom bernama sama", () => {
  const kolom = kolomPos([
    { kode: "logika", name: "Logika", golongan: null },
    { kode: "logika_intern", name: "Logika", golongan: "intern" },
  ]);
  assert.equal(kolom.length, 1);
  assert.equal(kolom[0].nama, "Logika");
  assert.equal(kolom[0].varian.length, 2);
});


test("varianUntuk tidak simetris: Internal tidak menerima komponen umum", () => {
  const [kol] = kolomPos([
    { kode: "semaphore", name: "Semaphore", golongan: null },
  ]);
  assert.equal(varianUntuk(kol, "penegak_pa").kode, "semaphore");
  // Kalau baris umum ikut berlaku untuk Internal, seluruh lomba lapangan
  // tergambar untuk regu yang tidak mengikutinya (migrasi 0091).
  assert.equal(varianUntuk(kol, "intern_pa"), null);

  const [kol2] = kolomPos([
    { kode: "logika", name: "Logika", golongan: null },
    { kode: "logika_intern", name: "Logika", golongan: "intern" },
  ]);
  assert.equal(varianUntuk(kol2, "intern_pi").kode, "logika_intern");
  assert.equal(varianUntuk(kol2, "penegak_pa").kode, "logika");
});


test("live.js memakai aturan bersama, bukan salinannya sendiri", () => {
  assert.match(live, /kolomPos, kelompokLomba, ringkasLomba/);
  assert.match(live,
    /lomba: kelompokLomba\(kolomPos\(komponen\.filter\(w => w\.pos === p\.nomor\)\)\)/);
  assert.match(live, /const r = ringkasLomba\(l, b\.golongan, x\.pos\.nomor,/);

  // Bentuk salinan lamanya tidak boleh kembali.
  assert.doesNotMatch(live, /if \(!nama\.includes\(w\.name\)\) nama\.push/);
  assert.doesNotMatch(live, /x\.milik\.find/);
});
