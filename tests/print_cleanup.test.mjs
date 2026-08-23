// Dokumen cetak sementara tidak boleh hidup lebih lama dari satu operasi print.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");


test("printout dibersihkan setelah dialog print dan saat navigasi", () => {
  assert.match(app, /window\.addEventListener\("afterprint", \(\) => \{\s*document\.getElementById\("cetakan"\)\?\.remove\(\);/);

  const awal = app.indexOf("async function arahkan()");
  const akhir = app.indexOf("// Tiga aksi yang sama", awal);
  const arahkan = app.slice(awal, akhir);
  assert.match(arahkan, /document\.getElementById\("cetakan"\)\?\.remove\(\);/);
});


test("pos tanpa blangko tidak meninggalkan printout kosong", () => {
  const awal = app.indexOf("function siapkanCetakBlangko(");
  const akhir = app.indexOf("/** Layar Input Pos", awal);
  const siapkan = app.slice(awal, akhir);
  const posisiKosong = siapkan.indexOf("if (!daftarLomba.length) return 0;");
  const posisiPasang = siapkan.lastIndexOf("document.body.appendChild");

  assert.notEqual(posisiKosong, -1);
  assert.notEqual(posisiPasang, -1);
  assert.ok(posisiKosong < posisiPasang,
    "printout dipasang sebelum diketahui bahwa tidak ada blangko");
});
