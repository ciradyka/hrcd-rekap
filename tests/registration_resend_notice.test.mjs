// Kiriman ulang idempoten harus menjelaskan data mana yang sudah tersimpan.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const daftar = await readFile(new URL("../live/js/daftar.js", import.meta.url), "utf8");
const awal = daftar.indexOf("function sukses(hasil)");
const akhir = daftar.indexOf("/* ---------------- mulai", awal);
const sukses = daftar.slice(awal, akhir);


test("hasil kirim ulang menampilkan keadaan data yang sudah tercatat", () => {
  assert.match(sukses, /hasil\.terkirim_ulang \? "" : "hidden"/);
  assert.match(sukses, /sudah tercatat dari kiriman sebelumnya/);
  assert.match(sukses, /Perubahan setelah kiriman pertama tidak ikut tersimpan/);
  assert.match(sukses, /tercatat berisi \$\{hasil\.jumlah_regu\} regu/);
});
