// ============================================================================
// hrcd-rekap : tests/live_phase_timeout.test.mjs
// Pemeriksaan fase peserta tidak boleh menggantungkan gambar pertama.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const live = await readFile(new URL("../live/live.js", import.meta.url), "utf8");

test("ambilFaseDb membatalkan request Supabase yang terlalu lama", () => {
  const awal = live.indexOf("async function ambilFaseDb() {");
  const akhir = live.indexOf("const mulai =", awal);
  assert.notEqual(awal, -1, "ambilFaseDb tidak ditemukan");
  const fungsi = live.slice(awal, akhir);

  assert.match(fungsi, /const ac = new AbortController\(\)/,
    "request fase tidak memiliki AbortController");
  assert.match(fungsi, /setTimeout\(\(\) => ac\.abort\(\), BATAS_FASE_MS\)/,
    "AbortController tidak punya batas waktu");
  assert.match(fungsi, /signal: ac\.signal/,
    "signal pembatalan tidak dikirim ke fetch");
  assert.match(fungsi, /finally\s*\{\s*clearTimeout\(batas\)/,
    "timer fase tidak dibersihkan setelah request selesai");
});

test("fase tetap selesai sebelum live.json boleh digambar", () => {
  const awal = live.indexOf("async function muat() {");
  const akhir = live.indexOf("\nmuat();", awal);
  const muat = live.slice(awal, akhir);
  assert.ok(muat.indexOf("await ambilFaseDb()") < muat.indexOf("fetch(`live.json"),
    "live.json kembali digambar sebelum fase database sempat memperketatnya");
});
