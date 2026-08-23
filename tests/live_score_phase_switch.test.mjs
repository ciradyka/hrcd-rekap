// ============================================================================
// hrcd-rekap : tests/live_score_phase_switch.test.mjs
// Saklar fase tetap tersedia sebelum klasemen mempunyai satu baris pun.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");

test("cabang klasemen kosong tetap menggambar saklar fase", () => {
  const awal = app.indexOf("const papan = !klasemen.length");
  const akhir = app.indexOf(": GOL.map", awal);
  assert.notEqual(awal, -1, "cabang papan kosong tidak ditemukan");
  assert.notEqual(akhir, -1, "akhir cabang papan kosong tidak ditemukan");
  const kosong = app.slice(awal, akhir);

  assert.match(kosong, /\$\{saklar\}/,
    "fase tidak terlihat atau tidak bisa diubah ketika klasemen kosong");
  assert.match(kosong, /Klasemen sementara/,
    "saklar kehilangan kepala kartu yang menjelaskan konteksnya");
});
