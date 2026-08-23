// Alat seed rehearsal harus menerima seluruh golongan edisi aktif.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const alat = await readFile(
  new URL("../tools/seed_regu_uji.py", import.meta.url), "utf8");


test("alat seed memetakan dua golongan Intern", () => {
  assert.match(alat, /"Intern PA": "intern_pa"/);
  assert.match(alat, /"Intern PI": "intern_pi"/);
  assert.doesNotMatch(alat, /Intern PA\/PI` juga dibuang/);
});
