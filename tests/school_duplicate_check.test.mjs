// `supabase/checks/sekolah_kembar.sql` melapor, tidak melebur — dan itu bukan
// gaya penulisan. Indeks unique di database sengaja jinak (CLAUDE.md 12.10),
// jadi pemeriksa ini boleh agresif justru karena hasilnya dibaca manusia.
// Begitu ia mulai mengubah baris, sifat itu hilang dan lapor palsunya berubah
// jadi peleburan yang salah.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sql = await readFile(
  new URL("../supabase/checks/sekolah_kembar.sql", import.meta.url), "utf8");

test("pemeriksa kembar tidak mengubah satu baris pun", () => {
  const perintah = sql.replace(/^--.*$/gm, "").replace(/\echo.*$/gm, "");
  for (const kata of ["insert into", "update ", "delete from", "drop ", "alter ",
                      "create table", "create or replace"])
    assert.doesNotMatch(perintah, new RegExp(kata, "i"),
      `pemeriksa kembar memuat "${kata}" — ia harus hanya membaca`);
});

test("keenam aturan disebut, masing-masing dengan alasannya", () => {
  for (const sebab of ["tanda baca / spasi saja bedanya",
                       "ejaan h / huruf ganda saja bedanya",
                       "huruf N / status negeri-swasta saja bedanya",
                       "satu nama memuat sisipan yang satunya tidak",
                       "kata terakhirnya nama diri yang sama",
                       "jalan dan desa sama persis, jenjang sama"])
    assert.ok(sql.includes(sebab), `aturan hilang: ${sebab}`);
});

test("aturan alamat menuntut jenjang yang sama", () => {
  // Tanpa syarat itu ia melaporkan tigapuluh pasangan MA+MTs dan SMA+SMP satu
  // yayasan yang memang dua sekolah berbeda, dan laporan sepanjang itu
  // berhenti dibaca.
  const f = sql.slice(sql.indexOf("-- F. Jalan DAN desa"));
  assert.match(f, /a\.jalan = b\.jalan and a\.desa_alamat = b\.desa_alamat/);
  assert.match(f, /length\(a\.jalan\) >= 8/);
  assert.match(f, /a\.jenjang.*=.*b\.jenjang/s);
});

test("aturan sisipan diperiksa dua arah", () => {
  // Pasangannya dijoin `a.id < b.id`, dan id-nya uuid acak — memeriksa satu
  // arah saja membuat separuh pasangan lolos tergantung urutan uuid.
  assert.match(sql, /a\.kata <@ b\.kata/);
  assert.match(sql, /b\.kata <@ a\.kata/);
});

test("batas pemeriksaan ini tetap tertulis", () => {
  // Aturan F menutup kasus MAN Darussalam lawan MAN 1 Ciamis — tetapi lewat
  // ALAMAT, bukan NPSN. Sekolah yang pindah alamat dan berganti nama sekaligus
  // tetap lolos, dan pemeriksa yang diam soal batasnya dibaca seolah menutup
  // semuanya.
  assert.match(sql, /MAN Darussalam/);
  assert.match(sql, /tetapi lewat alamat, bukan lewat NPSN/);
  assert.match(sql, /berganti nama sekaligus tetap lolos/);
});
