import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const alat = await readFile(new URL("../tools/periksa_impor.py", import.meta.url), "utf8");


test("checker mencakup seluruh pemakai shared module", () => {
  // web/js/ dicari sendiri, termasuk common/ dan screens/: daftar tulisan
  // tangan berhenti benar begitu app.js dipecah per layar.
  assert.match(alat, /akar_js\.rglob\("\*"\)/, "modul web/js/ tidak lagi dicari sendiri");
  assert.match(alat, /gagal \+= periksa_web\(AKAR \/ "web" \/ "js"\)/,
    "pemeriksaan web/js/ tidak dijalankan");
  for (const berkas of ["live/js/daftar.js", "live/live.js"]) {
    assert.match(alat, new RegExp(berkas.replaceAll("/", "\\/")));
  }
  assert.match(alat, /"\.\/api\.js"/);
  assert.match(alat, /"\.\/util\.js"/);
  assert.match(alat, /"\.\/js\/util\.js"/);
});
