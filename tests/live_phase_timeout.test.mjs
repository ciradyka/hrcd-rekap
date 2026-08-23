// ============================================================================
// hrcd-rekap : tests/live_phase_timeout.test.mjs
// Pemeriksaan fase peserta tidak boleh menggantungkan gambar pertama.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const live = await readFile(new URL("../live/live.js", import.meta.url), "utf8");

test("bacaViewPublik membatalkan request Supabase yang terlalu lama", () => {
  // Batas waktunya tinggal di SATU tempat sejak halaman ini membaca dua view
  // (fase dan jumlah pendaftar). Menuliskannya per pemanggil berarti bacaan
  // berikutnya lahir tanpa batas waktu sama sekali, dan yang terlihat cuma
  // papan yang menggantung di "Memuat rekap…" ketika origin sulit dijangkau.
  const awal = live.indexOf("async function bacaViewPublik(jalur) {");
  const akhir = live.indexOf("async function ambilFaseDb()", awal);
  assert.notEqual(awal, -1, "bacaViewPublik tidak ditemukan");
  const fungsi = live.slice(awal, akhir);

  assert.match(fungsi, /const ac = new AbortController\(\)/,
    "request view publik tidak memiliki AbortController");
  assert.match(fungsi, /setTimeout\(\(\) => ac\.abort\(\), BATAS_FASE_MS\)/,
    "AbortController tidak punya batas waktu");
  assert.match(fungsi, /signal: ac\.signal/,
    "signal pembatalan tidak dikirim ke fetch");
  assert.match(fungsi, /finally\s*\{\s*clearTimeout\(batas\)/,
    "timer tidak dibersihkan setelah request selesai");
});

test("kedua bacaan Supabase lewat pembungkus berbatas waktu itu", () => {
  for (const [nama, jalur] of [["fase", "v_fase_live"],
                               ["jumlah pendaftar", "v_publik_ringkas"]]) {
    assert.match(live, new RegExp(`bacaViewPublik\\("${jalur}`),
      `bacaan ${nama} tidak lewat bacaViewPublik()`);
  }
  // Satu-satunya fetch ke Supabase yang boleh ada di berkas ini yang di dalam
  // pembungkus itu. Yang lain mengambil berkas statis dari origin yang sama.
  const langsung = [...live.matchAll(/fetch\(`\$\{K\.supabaseUrl\}/g)];
  assert.equal(langsung.length, 1,
    "ada fetch ke Supabase di luar bacaViewPublik() — ia lahir tanpa batas waktu");
});

test("fase tetap selesai sebelum live.json boleh digambar", () => {
  const awal = live.indexOf("async function muat() {");
  const akhir = live.indexOf("\nmuat();", awal);
  const muat = live.slice(awal, akhir);
  assert.ok(muat.indexOf("await ambilFaseDb()") < muat.indexOf("fetch(`live.json"),
    "live.json kembali digambar sebelum fase database sempat memperketatnya");
});
