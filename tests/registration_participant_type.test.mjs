// Pergantian jenis peserta tidak boleh diam-diam menimpa draf pendaftaran.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const daftar = await readFile(new URL("../live/js/daftar.js", import.meta.url), "utf8");
const awal = daftar.indexOf("const pilihJenis = (jenis) => {");
const akhir = daftar.indexOf("document.getElementById(\"p-eksternal\")", awal);
const pilihJenis = daftar.slice(awal, akhir);


test("pergantian jenis meminta konfirmasi sebelum menghapus draf", () => {
  const posisiKonfirmasi = pilihJenis.indexOf("window.confirm(");
  const posisiHapusRegu = pilihJenis.indexOf("jawab.regu = [];");
  const posisiSimpan = pilihJenis.indexOf("simpanDraf();");

  assert.match(pilihJenis, /jawab\.regu\.length > 0/);
  assert.match(pilihJenis, /jawab\.sekolah \|\| jawab\.butuh_barak !== null/);
  assert.match(pilihJenis, /if \(adaIsianJenis && !window\.confirm\(/);
  assert.ok(posisiKonfirmasi < posisiHapusRegu);
  assert.ok(posisiKonfirmasi < posisiSimpan);
});


test("membatalkan konfirmasi keluar sebelum mutasi", () => {
  assert.match(pilihJenis, /\)\) return;\s+jawab\.jenis_peserta = jenis;/);
});

