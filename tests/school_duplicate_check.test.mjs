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

test("kelima aturan disebut, masing-masing dengan alasannya", () => {
  for (const sebab of ["tanda baca / spasi saja bedanya",
                       "ejaan h / huruf ganda saja bedanya",
                       "huruf N / status negeri-swasta saja bedanya",
                       "satu nama memuat sisipan yang satunya tidak",
                       "kata terakhirnya nama diri yang sama"])
    assert.ok(sql.includes(sebab), `aturan hilang: ${sebab}`);
});

test("aturan sisipan diperiksa dua arah", () => {
  // Pasangannya dijoin `a.id < b.id`, dan id-nya uuid acak — memeriksa satu
  // arah saja membuat separuh pasangan lolos tergantung urutan uuid.
  assert.match(sql, /a\.kata <@ b\.kata/);
  assert.match(sql, /b\.kata <@ a\.kata/);
});

test("yang TIDAK bisa ditemukannya ikut ditulis", () => {
  // MAN Darussalam lawan MAN 1 Ciamis tidak punya satu huruf pun yang sama;
  // yang membuktikannya NPSN, dan `sekolah` tidak menyimpan NPSN. Pemeriksa
  // yang diam soal batasnya dibaca seolah menutup semuanya.
  assert.match(sql, /MAN Darussalam/);
  assert.match(sql, /tabel `sekolah` tidak menyimpan NPSN/);
});
