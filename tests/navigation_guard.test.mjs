// ============================================================================
// hrcd-rekap : tests/navigation_guard.test.mjs
// Navigasi hash tidak boleh membuang nilai Input Pos tanpa jeda keputusan.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");

test("router memeriksa nilai belum tersimpan sebelum mengganti layar", () => {
  const awal = app.indexOf("async function arahkan() {");
  const akhir = app.indexOf("// Tiga aksi yang sama", awal);
  assert.notEqual(awal, -1, "router arahkan tidak ditemukan");
  const router = app.slice(awal, akhir);

  const pagar = router.indexOf("!bolehMeninggalkanNilai()");
  const batal = router.indexOf("history.replaceState");
  const bongkar = router.indexOf("segarkanDiTempat = null");
  // `RUTE[` saja, bukan `RUTE[location.hash]`: sejak rute boleh berbuntut
  // (`#/pos2/1:semaphore`) yang dicari tabel itu `pangkalRute(location.hash)`.
  // Penanda yang memuat argumennya diam-diam berhenti ketemu, `indexOf`
  // mengembalikan -1, dan pagar "sesudah pemeriksaan" jadi selalu benar.
  const gambar = router.indexOf("RUTE[");
  assert.ok(pagar >= 0 && pagar < bongkar && pagar < gambar,
    "router membongkar layar sebelum meminta keputusan");
  assert.ok(batal > pagar && batal < bongkar,
    "navigasi yang dibatalkan tidak memulihkan hash sebelum layar dibongkar");
});

test("keluar memakai pagar yang sama dengan navigasi dan penutupan tab", () => {
  const awal = app.indexOf("const keluarSekarang = () => {");
  const akhir = app.indexOf("document.getElementById", awal);
  const keluar = app.slice(awal, akhir);
  assert.match(keluar, /if \(!bolehMeninggalkanNilai\(\)\) return;/,
    "logout masih bisa membuang nilai tanpa peringatan");

  assert.match(app,
    /const bolehMeninggalkanNilai = \(\) => !adaYangBelumTersimpan\(\)/,
    "pagar hash tidak memakai pemeriksaan yang sama dengan beforeunload");
});
