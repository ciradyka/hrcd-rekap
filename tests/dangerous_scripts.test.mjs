// ============================================================================
// hrcd-rekap : tests/dangerous_scripts.test.mjs
// Skrip data uji yang bisa mengubah catatan waktu wajib menolak hari-H.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const jadwal = await readFile(
  new URL("../supabase/checks/perbaiki_jadwal_uji.sql", import.meta.url), "utf8",
);
const simulasi = await readFile(
  new URL("../supabase/checks/simulasi_end_to_end.sql", import.meta.url), "utf8",
);

test("perbaikan jadwal menolak sejak hari-H menurut tanggal Jakarta", () => {
  assert.match(jadwal,
    /v_tanggal\s*<=\s*\(now\(\) at time zone 'Asia\/Jakarta'\)::date/,
    "pagar masih terbuka pada hari-H atau masih memakai tanggal sesi UTC");
});

test("perbaikan jadwal tidak menimpa jam berangkat yang sudah tercatat", () => {
  const awal = jadwal.indexOf("update kloter k");
  const akhir = jadwal.indexOf("-- 3. Centang berangkat", awal);
  assert.notEqual(awal, -1, "UPDATE kloter tidak ditemukan");
  const langkah = jadwal.slice(awal, akhir);
  assert.match(langkah, /and k\.jam_berangkat is null/,
    "UPDATE kloter kembali menimpa catatan jam berangkat yang sudah ada");
});

test("simulasi menolak database operasional yang tidak kosong sebelum DELETE", () => {
  const pagar = simulasi.indexOf("DATA OPERASIONAL TIDAK KOSONG");
  const hapus = simulasi.indexOf("delete from closing_regu");
  assert.ok(pagar >= 0 && pagar < hapus,
    "simulasi mulai menghapus sebelum memastikan database kosong");
  const blok = simulasi.slice(simulasi.lastIndexOf("if exists", pagar), pagar);
  for (const tabel of [
    "pendaftaran", "regu", "pembayaran", "nilai_mentah", "nilai_terkunci",
    "keberangkatan_regu", "closing_regu", "foto_lembar", "kloter",
  ]) {
    assert.match(blok, new RegExp(`from ${tabel}\\b`),
      `pagar simulasi tidak memeriksa ${tabel}`);
  }
});

test("kepala simulasi memperingatkan penghapusan dan menunjuk cleanup nyata", () => {
  const kepala = simulasi.slice(0, simulasi.indexOf("do $$"));
  assert.match(kepala, /DESTRUKTIF DAN BUKAN AMAN DIULANG/);
  assert.match(kepala, /supabase\/checks\/cleanup_data_uji\.sql/);
  assert.doesNotMatch(kepala, /hapus_simulasi\.sql/,
    "kepala masih menunjuk berkas pembersih yang tidak pernah ada");
});
