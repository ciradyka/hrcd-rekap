// ============================================================================
// hrcd-rekap : tests/score_refresh.test.mjs
// Snapshot Input Pos yang basi tidak boleh menimpa nilai yang baru tersimpan.
// ============================================================================

import assert from "node:assert/strict";
import test from "node:test";
import { sumberPanitia } from "./sumber.mjs";

const app = await sumberPanitia();

test("simpanan sukses membatalkan penyegaran yang sudah berjalan", () => {
  const simpanAwal = app.indexOf("async function simpanBaris(");
  const simpanAkhir = app.indexOf("/* ---------- perilaku isian", simpanAwal);
  const simpan = app.slice(simpanAwal, simpanAkhir);
  assert.match(simpan,
    /await lembarPosSatu\(pos\.nomor, dada\);[\s\S]{0,300}versiLembar \+= 1;/,
    "konfirmasi satu baris tidak membatalkan snapshot lembar yang lebih lama");
});

test("hanya respons penyegaran terbaru yang boleh menulis tabel", () => {
  const awal = app.indexOf("const segarkanLembar = async () => {");
  const akhir = app.indexOf("let denyut = null", awal);
  assert.notEqual(awal, -1, "segarkanLembar tidak ditemukan");
  assert.notEqual(akhir, -1, "akhir segarkanLembar tidak ditemukan");
  const segarkan = app.slice(awal, akhir);

  const versi = segarkan.indexOf("const versiPermintaan = ++versiLembar");
  const tunggu = segarkan.indexOf("await lembarPos(pos.nomor)");
  const pagar = segarkan.indexOf("versiPermintaan !== versiLembar");
  const tulis = segarkan.indexOf("asli.set(");
  assert.ok(versi >= 0 && versi < tunggu,
    "versi request tidak diambil sebelum request dimulai");
  assert.ok(pagar > tunggu && pagar < tulis,
    "respons menulis cermin database sebelum memeriksa apakah ia masih terbaru");
});
