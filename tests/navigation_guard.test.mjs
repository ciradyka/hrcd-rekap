// ============================================================================
// hrcd-rekap : tests/navigation_guard.test.mjs
// Navigasi hash tidak boleh membuang nilai Input Pos tanpa jeda keputusan.
// ============================================================================

import assert from "node:assert/strict";
import test from "node:test";
import { potongFungsi, sumberPanitia } from "./sumber.mjs";

const app = await sumberPanitia();

test("router memeriksa nilai belum tersimpan sebelum mengganti layar", () => {
  const router = potongFungsi(app, "async function arahkan() {");
  assert.notEqual(router, "", "router arahkan tidak ditemukan");

  const pagar = router.indexOf("!bolehMeninggalkanNilai()");
  const batal = router.indexOf("history.replaceState");
  const bongkar = router.indexOf("aturSegarkanDiTempat(null)");
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
