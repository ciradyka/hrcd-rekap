// Live Score tidak menjadi layar kosong hanya karena satu pembacaan putus.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const awal = app.indexOf("async function muatDataLiveScore");
const akhir = app.indexOf("async function layarLiveScore", awal);
const pemuat = app.slice(awal, akhir);
const layar = app.slice(akhir, app.indexOf("/* ============================ KEJUARAAN", akhir));


test("pembacaan Live Score yang putus dicoba satu kali lagi", () => {
  assert.match(pemuat, /return await ambil\(\)/);
  assert.equal((pemuat.match(/await ambil\(\)/g) || []).length, 2);
  assert.match(pemuat, /throw kedua/);
});


test("Live Score membaca satu snapshot dan status ringan", () => {
  assert.match(layar, /muatDataLiveScore\(cacheLiveScore\)/);
  assert.match(layar, /muatDataLiveScore\(statusAcara, null\)/);
  assert.doesNotMatch(layar, /muatDataLiveScore\(rekapPenuh\)/);
  assert.doesNotMatch(layar, /muatDataLiveScore\(kelengkapanPos/);
});


test("klasemen memakai hasil rekap tanpa menghitung skor dua kali", () => {
  assert.doesNotMatch(layar, /klasemenLiveScore/);
  assert.match(layar, /const hitungKlasemen = \(baris\) => baris/);
  assert.match(layar, /\.filter\(r => r\.sudah_berangkat\)/);
  assert.match(layar, /poin_per_pos: r\.poin_pos/);
});


test("umur snapshot terlihat di layar", () => {
  assert.match(layar, /Update \$\{esc\(tanggalJam\(snapshot\.dibuat_pada\)\)\}/);
});


test("snapshot diurutkan menurut peringkat dan score, bukan nomor dada", () => {
  // Yang diperiksa cuma pengurutan SNAPSHOT — baris tabel. Podium di bawahnya
  // punya pengurutannya sendiri dan memang berakhir di nomor dada, karena
  // penghargaan harus jatuh ke satu regu bahkan saat skornya seri; membaca
  // seluruh layarLiveScore() di sini membuat pemecah seri itu terbaca seperti
  // pelanggaran aturan ini.
  const urut = layar.slice(layar.indexOf("const hitungKlasemen = (baris) => baris"),
                           layar.indexOf("let klasemen = hitungKlasemen(rekap);"));
  assert.match(urut, /Number\(a\.peringkat\) - Number\(b\.peringkat\)/);
  assert.match(urut, /Number\(b\.total\) - Number\(a\.total\)/);
  assert.doesNotMatch(urut, /Number\(a\.nomor_dada\)|Number\(b\.nomor_dada\)/);
});
