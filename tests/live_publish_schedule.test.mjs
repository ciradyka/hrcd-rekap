// Penerbitan berkala hanya hidup di sekitar hari-H. Jadwal tanpa batas tanggal
// menghabiskan 2.880 menit Actions per bulan pada repo privat, padahal seluruh
// kebutuhan edisi 37 selesai dalam dua tanggal UTC.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const workflow = await readFile(
  new URL("../.github/workflows/publish-live.yml", import.meta.url), "utf8");


test("rekap terbit tiap 15 menit hanya pada jam WIB hari-H", () => {
  assert.match(workflow, /schedule:\s*[\s\S]*?- cron: '\*\/15 1-16 29 8 \*'/);
  assert.doesNotMatch(workflow, /cron: '\*\/15 \* \* \* \*'/,
    "cron tidak boleh berjalan tiap hari sepanjang tahun");
  assert.match(workflow, /\^2026-08-29T\(0\[1-9\]\|1\[0-6\]\):/,
    "tahun dan jendela UTC harus diperiksa sebelum penerbitan");
  assert.match(workflow,
    /uses: actions\/checkout@v4\s+if: steps\.jadwal\.outputs\.aktif == 'true'/,
    "scheduled run di luar jendela tidak boleh membaca repository");
  assert.match(workflow,
    /name: Tulis live\.json \+ rekap\.json dari database\s+if: steps\.jadwal\.outputs\.aktif == 'true'/,
    "scheduled run di luar jendela tidak boleh membaca database");
});


test("guard UTC tepat membuka 08:00-23:59 WIB pada 29 Agustus 2026", () => {
  const aktif = /^2026-08-29T(0[1-9]|1[0-6]):/;
  assert.equal(aktif.test("2026-08-29T00:59"), false);
  assert.equal(aktif.test("2026-08-29T01:00"), true);
  assert.equal(aktif.test("2026-08-29T16:59"), true);
  assert.equal(aktif.test("2026-08-29T17:00"), false);
  assert.equal(aktif.test("2027-08-29T01:00"), false);
});
