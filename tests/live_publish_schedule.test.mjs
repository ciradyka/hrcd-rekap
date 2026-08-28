// Penerbitan berkala hanya hidup di sekitar hari-H. Jadwal tanpa batas tanggal
// menghabiskan 2.880 menit Actions per bulan pada repo privat, padahal seluruh
// kebutuhan edisi 37 selesai dalam dua tanggal UTC.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const workflow = await readFile(
  new URL("../.github/workflows/publish-live.yml", import.meta.url), "utf8");


test("rekap terbit tiap 15 menit hanya pada tanggal UTC hari-H", () => {
  assert.match(workflow, /schedule:\s*[\s\S]*?- cron: '\*\/15 \* 28-29 8 \*'/);
  assert.doesNotMatch(workflow, /cron: '\*\/15 \* \* \* \*'/,
    "cron tidak boleh berjalan tiap hari sepanjang tahun");
});
