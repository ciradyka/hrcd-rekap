// Utility alignment harus mengalahkan text-align dasar sel tabel cetak.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const css = await readFile(new URL("../web/style.css", import.meta.url), "utf8");
const awal = css.indexOf("@media print {");
const akhir = css.indexOf("/* ---------- RESPONSIVE", awal);
const cetak = css.slice(awal, akhir);


test("utility alignment tabel cetak menargetkan th dan td", () => {
  assert.match(cetak,
    /\.print-table th\.text-right, \.print-table td\.text-right \{ text-align: right; \}/);
  assert.match(cetak,
    /\.print-table th\.text-center, \.print-table td\.text-center \{ text-align: center; \}/);
});
