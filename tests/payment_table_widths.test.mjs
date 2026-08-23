// Lebar tabel induk tidak boleh merembes ke tabel rincian yang bersarang.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const css = await readFile(new URL("../web/style.css", import.meta.url), "utf8");


test("lebar Meja Pembayaran hanya diatur lewat header langsung", () => {
  assert.match(css,
    /\.table-bayar > thead > tr > th:nth-child\(6\) \{ width: 25%; \}/);
  assert.match(css,
    /\.detail-table-bayar > thead > tr > th:nth-child\(5\) \{ width: 25%; \}/);
  assert.doesNotMatch(css, /\.table-bayar th:nth-child\(/);
  assert.doesNotMatch(css, /\.detail-table-bayar th:nth-child\(/);
  assert.doesNotMatch(css, /\.table-bayar td:nth-child\(6\)\s*\{/);
});
