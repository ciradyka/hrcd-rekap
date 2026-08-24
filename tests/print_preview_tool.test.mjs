// Extractor cetak harus mengikuti aturan penyembunyi layar yang sebenarnya.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const alat = await readFile(new URL("../tools/pratinjau_cetak.py", import.meta.url), "utf8");
const css = await readFile(new URL("../web/style.css", import.meta.url), "utf8");


test("extractor mengenali seluruh selector layar yang disembunyikan", () => {
  assert.match(css,
    /\.header, \.isi, \.notification, \.overlay,\s*\.bottom-nav \{ display: none !important; \}/);
  assert.match(alat,
    /SEMBUNYI = \("\.header, \.isi, \.notification, \.overlay,\\n"\s*"  \.bottom-nav \{ display: none !important; \}"\)/);
});


test("extractor membaca SEMUA blok @media print, bukan yang pertama", () => {
  // style.css punya lebih dari satu blok cetak, dan `.index()` mengambil yang
  // pertama saja. Yang hilang dari pratinjau tidak menimbulkan tanda apa pun,
  // sementara keputusan bentuk kertas diambil dari pratinjau itu.
  const jumlah = [...css.matchAll(/@media print \{/g)].length;
  assert.ok(jumlah >= 2,
    "style.css tinggal satu blok cetak — cek apakah penjaga ini masih perlu");

  assert.doesNotMatch(alat, /css\.index\("@media print \{"\)/);
  assert.match(alat, /while i != -1:/);
  assert.match(alat, /len\(potongan\) != css\.count\(AWAL\)/);
});


test("workflow menjalankan extractor Python", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/sql-tests.yml", import.meta.url), "utf8");
  assert.match(workflow, /python tools\/pratinjau_cetak\.py > \/dev\/null/);
});
