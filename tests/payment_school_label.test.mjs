// Nama sekolah yang sudah aman tidak boleh di-escape lagi di accessible name.

import assert from "node:assert/strict";
import test from "node:test";
import { sumberPanitia } from "./sumber.mjs";


const app = await sumberPanitia();
const awal = app.indexOf("async function layarPembayaran()");
const akhir = app.indexOf("/* ============================ DAFTAR ULANG", awal);
const pembayaran = app.slice(awal, akhir);


test("label rincian pembayaran tidak meng-escape nama sekolah dua kali", () => {
  assert.match(pembayaran, /const sekolah = esc\(b\.sekolah\?\.name \|\| "—"\)/);
  assert.match(pembayaran, /aria-label="Lihat \$\{aktif\.length\} regu \$\{sekolah\}"/);
  assert.doesNotMatch(pembayaran, /esc\(sekolah\)/);
});
