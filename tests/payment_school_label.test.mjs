// Nama sekolah yang sudah aman tidak boleh di-escape lagi di accessible name.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const awal = app.indexOf("async function layarPembayaran()");
const akhir = app.indexOf("/* ============================ DAFTAR ULANG", awal);
const pembayaran = app.slice(awal, akhir);


test("label rincian pembayaran tidak meng-escape nama sekolah dua kali", () => {
  assert.match(pembayaran, /const sekolah = esc\(b\.sekolah\?\.name \|\| "—"\)/);
  assert.match(pembayaran, /aria-label="Lihat \$\{aktif\.length\} regu \$\{sekolah\}"/);
  assert.doesNotMatch(pembayaran, /esc\(sekolah\)/);
});
