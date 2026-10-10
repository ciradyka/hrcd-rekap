// Daftar ulang harus memfokuskan kotak nomor dada yang baru ditandai salah.

import assert from "node:assert/strict";
import test from "node:test";
import { sumberPanitia } from "./sumber.mjs";


const app = await sumberPanitia();


test("fokus daftar ulang mengikuti class error yang benar-benar dipasang", () => {
  assert.match(app, /classList\.add\("input-error"\)/);
  assert.match(app,
    /isian\.find\(i => i\.classList\.contains\("input-error"\)\)\?\.focus\(\)/);
  assert.doesNotMatch(app, /galat-isian/);
});
