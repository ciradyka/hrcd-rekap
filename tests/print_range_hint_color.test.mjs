// Petunjuk rentang harus tetap hitam ketika master difotokopi berulang kali.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const css = await readFile(new URL("../web/style.css", import.meta.url), "utf8");
const awalPrint = css.indexOf("@media print {");
const awalAturan = css.indexOf(".print-table th .kolom-petunjuk", awalPrint);
const akhirAturan = css.indexOf("}", awalAturan);
const aturan = css.slice(awalAturan, akhirAturan);


test("petunjuk rentang cetak berwarna hitam", () => {
  assert.notEqual(awalPrint, -1);
  assert.notEqual(awalAturan, -1);
  assert.match(aturan, /color:\s*#000/);
  assert.doesNotMatch(aturan, /var\(--tinta-lembut\)|#5c5c5c/);
});
