// Respons kloter lama tidak boleh menggambar ulang pilihan terbaru.

import assert from "node:assert/strict";
import test from "node:test";
import { sumberPanitia } from "./sumber.mjs";


const app = await sumberPanitia();
const awal = app.indexOf("  async function gambarKloter() {");
const akhir = app.indexOf("\n  gambarPita();", awal);
const gambar = app.slice(awal, akhir);


test("gambar kloter mengabaikan respons yang kalah giliran", () => {
  assert.match(gambar, /const nomor = kloterAktif;/);
  assert.match(gambar, /const giliran = \+\+generasiKloter;/);
  assert.match(gambar, /await reguKloter\(nomor\)/);
  assert.match(gambar,
    /if \(giliran !== generasiKloter \|\| location\.hash !== layarIni\) return;/);
  assert.doesNotMatch(gambar, /reguKloter\(kloterAktif\)/);
});


test("hasil gambar memakai nomor yang sama dengan request", () => {
  const sesudahRequest = gambar.slice(gambar.indexOf("await reguKloter(nomor)"));
  assert.doesNotMatch(sesudahRequest, /kloterAktif/,
    "render masih membaca pilihan hidup setelah request dimulai");
});
