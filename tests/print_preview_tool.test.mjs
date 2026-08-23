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


test("workflow menjalankan extractor Python", async () => {
  const workflow = await readFile(
    new URL("../.github/workflows/sql-tests.yml", import.meta.url), "utf8");
  assert.match(workflow, /python tools\/pratinjau_cetak\.py > \/dev\/null/);
});
