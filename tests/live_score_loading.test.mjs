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


test("status dan kelengkapan boleh gagal tanpa merobohkan papan", () => {
  assert.match(layar, /muatDataLiveScore\(kelengkapanPos, \[\]\)/);
  assert.match(layar, /muatDataLiveScore\(statusAcara, null\)/);
  assert.match(layar, /muatDataLiveScore\(rekapPenuh\)/);
});


test("klasemen memakai hasil rekap tanpa menghitung skor dua kali", () => {
  assert.doesNotMatch(layar, /klasemenLiveScore/);
  assert.match(layar, /const klasemen = rekap/);
  assert.match(layar, /\.filter\(r => r\.sudah_berangkat\)/);
  assert.match(layar, /poin_per_pos: r\.poin_pos/);
});
