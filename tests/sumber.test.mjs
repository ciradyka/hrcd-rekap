// ============================================================================
// hrcd-rekap : tests/sumber.test.mjs
// Penjaga untuk tests/sumber.mjs sendiri.
//
// Potongan yang KOSONG meloloskan setiap doesNotMatch, dan potongan yang
// kepanjangan memeriksa kode layar lain. Keduanya membuat tes hijau tanpa
// memeriksa apa pun, jadi batas potongFungsi() diuji di sini dengan fungsi
// sungguhan.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { potongFungsi, sumberPanitia } from "./sumber.mjs";

const app = await sumberPanitia();

test("sumberPanitia memuat app.js", async () => {
  const asli = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
  assert.ok(app.startsWith(asli), "app.js tidak berada di awal sumber panitia");
});

test("potongFungsi berhenti di ujung fungsinya sendiri", () => {
  for (const kepala of ["async function layarCekNilai()", "async function layarFoto()",
                        "async function layarKejuaraan()", "function siapkanCetakJuara(",
                        "function bukaFotoPenuh("]) {
    const f = potongFungsi(app, kepala);
    assert.ok(f.startsWith(kepala), `${kepala} tidak ditemukan`);
    assert.ok(f.endsWith("\n}"), `${kepala} tidak berakhir di } kolom 0`);
    assert.ok(f.length > 400, `${kepala} cuma ${f.length} huruf — terpotong terlalu awal`);
    // Satu fungsi saja: tidak ada kepala fungsi tingkat atas lain di dalamnya.
    assert.doesNotMatch(f.slice(kepala.length), /\n(async )?function \w+\(/,
      `${kepala} ikut memuat fungsi sesudahnya`);
    assert.ok(!f.includes("const RUTE = {"), `${kepala} sampai ke tabel RUTE`);
  }
});

test("kepala yang tidak ada memberi potongan kosong", () => {
  assert.equal(potongFungsi(app, "function tidakPernahAda("), "");
});
