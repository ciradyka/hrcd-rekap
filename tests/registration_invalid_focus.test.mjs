// Daftar ulang harus memfokuskan kotak nomor dada yang baru ditandai salah.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");


test("fokus daftar ulang mengikuti class error yang benar-benar dipasang", () => {
  assert.match(app, /classList\.add\("input-error"\)/);
  assert.match(app,
    /isian\.find\(i => i\.classList\.contains\("input-error"\)\)\?\.focus\(\)/);
  assert.doesNotMatch(app, /galat-isian/);
});
