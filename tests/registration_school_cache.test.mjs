// Daftar sekolah disimpan di HP, bukan diminta ulang tiap halaman dibuka.
// Tabelnya 517 baris sejak 0157 — 94 KB JSON — dan pembina membuka form yang
// sama berkali-kali: mengisi separuh, menutup, kembali lagi.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const daftar = await readFile(new URL("../live/js/daftar.js", import.meta.url), "utf8");

test("daftar sekolah dipakai dari simpanan sebelum diminta ulang", () => {
  assert.match(daftar, /const simpanan = sekolahTersimpan\(\);/);
  assert.match(daftar, /if \(simpanan\) \{\s*SEKOLAH = simpanan\.isi;/);
  assert.match(daftar, /if \(simpanan\.basi\) segarkanSekolah\(\);/);
  // Tanpa simpanan ia tetap meminta seperti biasa, lalu menyimpannya.
  assert.match(daftar, /\[SEKOLAH, EDISI\] = await Promise\.all\(\[daftarSekolah\(\), infoEdisi\(\)\]\);\s*simpanSekolah\(SEKOLAH\);/);
});

test("infoEdisi TIDAK ikut disimpan", () => {
  // Ia yang memutus pendaftaran masih dibuka atau tidak. Menyimpannya berarti
  // form yang sudah ditutup masih menerima kiriman selama masa simpan.
  const simpan = daftar.slice(daftar.indexOf("function simpanSekolah"),
                              daftar.indexOf("async function segarkanSekolah"));
  assert.doesNotMatch(simpan, /infoEdisi/);
  assert.match(daftar, /EDISI = await infoEdisi\(\);/);
});

test("setiap sentuhan localStorage dibungkus try/catch", () => {
  // Di mode privat sebagian browser MELEMPAR, bukan mengembalikan null, dan
  // form yang gagal terbuka gara-gara cache adalah pertukaran yang salah arah.
  for (const fn of ["sekolahTersimpan", "simpanSekolah"]) {
    const i = daftar.indexOf(`function ${fn}`);
    assert.ok(i > 0, `${fn} tidak ada`);
    const badan = daftar.slice(i, daftar.indexOf("\n}", i));
    assert.match(badan, /try \{/, `${fn} menyentuh localStorage tanpa try`);
    assert.match(badan, /catch/, `${fn} tidak menangkap galat localStorage`);
  }
});

test("penyegaran latar belakang gagal dengan diam", () => {
  // Yang sudah di layar tetap bisa dipakai; memunculkan galat untuk
  // penyegaran yang tidak diminta siapa pun cuma membuat pembina mengira
  // formnya rusak.
  const i = daftar.indexOf("async function segarkanSekolah");
  const badan = daftar.slice(i, daftar.indexOf("\n}", i));
  assert.match(badan, /catch \{ \/\* diam \*\/ \}/);
  // Hasil kosong tidak boleh menimpa daftar yang sudah benar.
  assert.match(badan, /if \(Array\.isArray\(baru\) && baru\.length\)/);
});

test("umur simpanan ditulis sebagai angka yang bisa dibaca", () => {
  assert.match(daftar, /const UMUR_SEKOLAH = 6 \* 60 \* 60 \* 1000;/);
});
