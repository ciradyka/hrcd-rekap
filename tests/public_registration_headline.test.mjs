// Headline pendaftaran peserta harus menjumlahkan golongan yang ditampilkan.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const live = await readFile(new URL("../live/live.js", import.meta.url), "utf8");
const awal = live.indexOf("function gambarPra() {");
const akhir = live.indexOf("function gambarKelengkapan()", awal);
const gambarPra = live.slice(awal, akhir);


test("headline pra menjumlahkan golongan peserta yang sama dengan pill", () => {
  assert.match(
    gambarPra,
    /URUT_GOLONGAN_PESERTA\.reduce\(\(n, g\) => n \+ Number\(per\[g\] \|\| 0\), 0\)/,
  );
  assert.match(gambarPra, /String\(jumlahPeserta\)/);
  assert.doesNotMatch(
    gambarPra,
    /angka-besar[^\n]+jumlah_regu_daftar/,
  );
});


test("live.json lama tanpa rincian golongan tetap punya fallback", () => {
  assert.match(
    gambarPra,
    /r\.jumlah_regu_daftar \?\? r\.jumlah_regu_lunas \?\? 0/,
  );
});

