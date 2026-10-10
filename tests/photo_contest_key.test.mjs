// Foto Jawaban harus memakai kode_lomba stabil, bukan slug dari labelnya.

import assert from "node:assert/strict";
import test from "node:test";
import { potongFungsi, sumberPanitia } from "./sumber.mjs";


const app = await sumberPanitia();
const layarFoto = potongFungsi(app, "async function layarFoto()");


test("selector Foto Jawaban memakai kode dari kelompokLomba", () => {
  assert.match(layarFoto, /<option value="\$\{esc\(l\.kode\)\}">\$\{esc\(l\.nama\)\}<\/option>/);
  assert.match(layarFoto, /kodeLomba = lomba\.length \? lomba\[0\]\.kode : null/);
});


test("Foto Jawaban tidak mempunyai pembuat slug privat", () => {
  assert.doesNotMatch(layarFoto, /const slug\s*=/);
  assert.doesNotMatch(layarFoto, /slug\(l\.nama\)/);
});
