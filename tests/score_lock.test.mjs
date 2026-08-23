// ============================================================================
// hrcd-rekap : tests/score_lock.test.mjs
// Gembok tidak boleh mendahului penyimpanan nilai Input Pos.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");

test("gembok hanya dipasang setelah nilai terkonfirmasi di database", () => {
  const awal = app.indexOf("async function ubahGembok(tr) {");
  const akhir = app.indexOf("const jawab = await dialog", awal);
  assert.notEqual(awal, -1, "ubahGembok tidak ditemukan");
  assert.notEqual(akhir, -1, "cabang mengunci tidak ditemukan");
  const kunci = app.slice(awal, akhir);

  const pagar = kunci.indexOf('tr.dataset.keadaan !== "tersimpan"');
  const panggil = kunci.indexOf("await kunciNilaiPos");
  assert.ok(pagar >= 0 && pagar < panggil,
    "kunciNilaiPos dipanggil sebelum keadaan tersimpan diperiksa");
  assert.match(kunci, /Number\(tr\.dataset\.terisi\) === 0/,
    "baris tanpa satu nilai pun masih bisa digembok");
});

test("Ulangi pada baris terkunci memberi alasan, bukan diam", () => {
  assert.match(app,
    /\[data-ulang\][\s\S]{0,100}simpanBaris\(tr, true\)/,
    "tombol Ulangi tidak menandai pemanggilan manual");

  const awal = app.indexOf("async function simpanBaris(tr, beriTahu = false) {");
  const akhir = app.indexOf("const lama = asli.get(dada)", awal);
  assert.notEqual(awal, -1, "simpanBaris dengan penanda manual tidak ditemukan");
  const pagar = app.slice(awal, akhir);
  assert.match(pagar, /dataset\.terkunci === "1"[\s\S]*statusBaris\(tr, "gagal", pesan\)/,
    "baris terkunci kembali keluar tanpa status yang menjelaskan");
  assert.match(pagar, /if \(beriTahu\) notif\(/,
    "tombol Ulangi tidak memberi tahu kenapa retry ditolak");
});
