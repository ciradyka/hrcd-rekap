// Kunci idempotensi pendaftaran harus tetap berupa UUID pada browser lama.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const daftar = await readFile(new URL("../live/js/daftar.js", import.meta.url), "utf8");
const awal = daftar.indexOf("function uuidDraf(");
const akhir = daftar.indexOf("const kosong", awal);
const sumber = daftar.slice(awal, akhir);
const uuidDraf = new Function(`${sumber}; return uuidDraf;`)();
const polaUuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


test("fallback getRandomValues menghasilkan UUID v4", () => {
  const kriptoLama = { getRandomValues(byte) { byte.fill(0); return byte; } };
  assert.equal(uuidDraf(kriptoLama), "00000000-0000-4000-8000-000000000000");
  assert.match(uuidDraf(kriptoLama), polaUuidV4);
});


test("jalur randomUUID tetap dipakai bila tersedia", () => {
  const tetap = "12345678-1234-4123-8123-123456789abc";
  assert.equal(uuidDraf({ randomUUID: () => tetap }), tetap);
});


test("draf lama dengan kunci non-UUID diperbaiki dan disimpan", () => {
  const awalPulih = daftar.indexOf("if (draf && (draf.sekolah");
  const akhirPulih = daftar.indexOf("  halaman();", awalPulih);
  const pulih = daftar.slice(awalPulih, akhirPulih);

  assert.match(pulih, /!POLA_UUID\.test\(String\(jawab\.kunci_kirim \|\| ""\)\)/);
  assert.match(pulih, /jawab\.kunci_kirim = uuidDraf\(\);\s+simpanDraf\(\);/);
});


test("pesan UUID database tidak tampil mentah", async () => {
  const api = await readFile(new URL("../live/js/api.js", import.meta.url), "utf8");
  assert.match(api, /invalid input syntax for type uuid/);
  assert.match(api, /Kunci pengiriman tidak valid/);
});

