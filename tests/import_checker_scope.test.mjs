import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const alat = await readFile(new URL("../tools/periksa_impor.py", import.meta.url), "utf8");


test("checker mencakup seluruh pemakai shared module", () => {
  for (const berkas of ["web/js/app.js", "live/js/daftar.js", "live/live.js"]) {
    assert.match(alat, new RegExp(berkas.replaceAll("/", "\\/")));
  }
  assert.match(alat, /"\.\/api\.js"/);
  assert.match(alat, /"\.\/util\.js"/);
  assert.match(alat, /"\.\/js\/util\.js"/);
});
