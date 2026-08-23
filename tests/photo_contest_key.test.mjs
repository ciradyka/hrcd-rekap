// Foto Jawaban harus memakai kode_lomba stabil, bukan slug dari labelnya.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const awal = app.indexOf("async function layarFoto()");
const akhir = app.indexOf("const RUTE = {", awal);
const layarFoto = app.slice(awal, akhir);


test("selector Foto Jawaban memakai kode dari kelompokLomba", () => {
  assert.match(layarFoto, /<option value="\$\{esc\(l\.kode\)\}">\$\{esc\(l\.nama\)\}<\/option>/);
  assert.match(layarFoto, /kodeLomba = lomba\.length \? lomba\[0\]\.kode : null/);
});


test("Foto Jawaban tidak mempunyai pembuat slug privat", () => {
  assert.doesNotMatch(layarFoto, /const slug\s*=/);
  assert.doesNotMatch(layarFoto, /slug\(l\.nama\)/);
});
