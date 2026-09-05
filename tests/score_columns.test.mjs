// ============================================================================
// hrcd-rekap : tests/score_columns.test.mjs
// Varian umum dan Internal dari satu penilaian tetap satu kolom layar.
// ============================================================================

import assert from "node:assert/strict";
import test from "node:test";

import { kolomPos } from "../web/js/util.js";

const komponen = (kode, name, golongan = null) => ({
  kode, name, golongan, form: "benar_per_total", total_soal: 10,
  rentang_mentah_min: 0, rentang_mentah_maks: 10,
});

test("pasangan umum dan Internal bergabung berdasarkan nama", () => {
  const kolom = kolomPos([
    komponen("semaphore", "Semaphore"),
    komponen("menaksir", "Menaksir"),
    komponen("keagamaan", "Keagamaan"),
    komponen("keagamaan_intern", "Keagamaan", "intern"),
    komponen("kepramukaan", "Kepramukaan"),
    komponen("kepramukaan_intern", "Kepramukaan", "intern"),
  ]);

  assert.deepEqual(kolom.map(k => k.nama),
    ["Semaphore", "Menaksir", "Keagamaan", "Kepramukaan"]);
  assert.deepEqual(kolom[2].varian.map(k => k.kode),
    ["keagamaan", "keagamaan_intern"]);
  assert.deepEqual(kolom[3].varian.map(k => k.kode),
    ["kepramukaan", "kepramukaan_intern"]);
});

test("komponen umum bernama berbeda tetap berdiri sendiri", () => {
  const kolom = kolomPos([
    komponen("a", "Nama A"),
    komponen("b", "Nama B"),
  ]);
  assert.equal(kolom.length, 2);
});
