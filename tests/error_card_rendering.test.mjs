// kartuGalat menghasilkan string HTML; replaceChildren memerlukan fragmen DOM.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");


test("semua kartu galat langsung diparse sebelum replaceChildren", () => {
  assert.doesNotMatch(app, /replaceChildren\(kartuGalat\(/,
    "markup kartuGalat masih dikirim sebagai text node");
  assert.match(app,
    /LAYAR\.replaceChildren\(h\(kartuGalat\(\s*"Akun ini tidak berhak membuka Kalkulator Keberangkatan\."\)\)\);/);
});
