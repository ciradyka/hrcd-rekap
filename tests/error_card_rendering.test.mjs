// kartuGalat menghasilkan string HTML; replaceChildren memerlukan fragmen DOM.

import assert from "node:assert/strict";
import test from "node:test";
import { sumberPanitia } from "./sumber.mjs";


const app = await sumberPanitia();


test("semua kartu galat langsung diparse sebelum replaceChildren", () => {
  assert.doesNotMatch(app, /replaceChildren\(kartuGalat\(/,
    "markup kartuGalat masih dikirim sebagai text node");
  assert.match(app,
    /LAYAR\.replaceChildren\(h\(kartuGalat\(\s*"Akun ini tidak berhak membuka Kalkulator Keberangkatan\."\)\)\);/);
});
