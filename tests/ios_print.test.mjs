import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");


test("cetak kloter memanggil print tanpa melewati await", () => {
  const awal = app.indexOf("  function cetak(bentuk) {");
  const akhir = app.indexOf(
    '  document.getElementById("cetak-petugas")',
    awal,
  );

  assert.notEqual(awal, -1, "fungsi cetak kloter tidak ditemukan");
  assert.notEqual(akhir, -1, "akhir fungsi cetak kloter tidak ditemukan");

  const cetak = app.slice(awal, akhir);
  const sebelumPrint = cetak.slice(0, cetak.indexOf("window.print();"));

  assert.match(cetak, /window\.print\(\);/, "window.print() tidak dipanggil");
  assert.doesNotMatch(
    sebelumPrint,
    /\bawait\b|daftarKloter\s*\(/,
    "Safari iPhone memblokir print bila request ditunggu sesudah tap",
  );
});
