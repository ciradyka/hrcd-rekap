// Tanda cetak tidak boleh kembali didokumentasikan sebagai pagar kloter.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const alur = await readFile(new URL("../docs/alur-lomba.md", import.meta.url), "utf8");


test("alur konsisten bahwa kloter tercetak tetap menerima regu", () => {
  assert.doesNotMatch(alur, /menambah regu ke kloter tercetak\s+ditolak sistem/);
  assert.match(alur, /regu tetap boleh ditambahkan\s+dan lembar itu dicetak ulang/);
  assert.match(alur, /Tanda cetak tidak\s+menutup kloter untuk tambahan/);
});


test("aturan pensiun nomor yang sudah beredar tetap dipertahankan", () => {
  assert.match(alur, /menukar nomor dada yang\s+sudah beredar hanya boleh lewat admin/);
  assert.match(alur, /nomor lamanya dipensiunkan permanen/);
});

