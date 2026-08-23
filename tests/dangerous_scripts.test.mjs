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
