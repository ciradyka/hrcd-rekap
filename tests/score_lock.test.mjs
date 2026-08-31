// ============================================================================
// hrcd-rekap : tests/score_lock.test.mjs
// Gembok tidak boleh mendahului penyimpanan nilai.
//
// GEMBOKNYA PINDAH, ATURANNYA TIDAK. Sejak 0166 menggembok hanya terjadi di
// layar Cek Nilai, per LOMBA — layar Input Pos cuma menampilkan lambangnya.
// Sebabnya: yang menggembok menyatakan "angka ini sudah dicocokkan dengan foto
// slipnya", dan pencocokan itu tidak terjadi di layar Input Pos, yang memang
// tidak memperlihatkan fotonya.
//
// Dua aturan di bawah karena itu diuji di tempat barunya, bukan dibuang:
// menggembok yang belum lengkap MEMBLOKIR juri yang belum sempat memasukkan
// sisanya, dan membuka gembok tidak boleh menuntut dialog.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");

/** Penangan gembok di layar Cek Nilai — satu-satunya tempat menggembok. */
const gembokCek = (() => {
  const awal = app.indexOf('const tombol = e.target.closest("[data-gembok]");');
  const akhir = app.indexOf("const ke = (i) => {", awal);
  assert.ok(awal >= 0 && akhir > awal, "penangan gembok Cek Nilai tidak ditemukan");
  return app.slice(awal, akhir);
})();

test("gembok hanya dipasang setelah lomba itu LENGKAP", () => {
  const pagar = gembokCek.indexOf("terisi !== dipakai.length");
  const panggil = gembokCek.indexOf("await kunciNilaiPos");
  assert.ok(pagar >= 0, "kelengkapan lomba tidak diperiksa sebelum menggembok");
  assert.ok(pagar < panggil,
    "kunciNilaiPos dipanggil sebelum kelengkapan lombanya diperiksa");
  // Kelengkapan dihitung dari komponen yang BERLAKU untuk golongan regu ini —
  // kriteria yang memang bukan urusannya tidak boleh ikut menahan gembok.
  assert.match(gembokCek, /varianUntuk\(kol, r\.golongan\)/,
    "kelengkapan dihitung tanpa memperhatikan golongan regu");
});

test("menggembok dan membukanya menyebut LOMBANYA", () => {
  assert.match(gembokCek, /kunciNilaiPos\(dada, nomorPos, kode\)/,
    "menggembok tidak menyebut lomba — gemboknya kembali per pos");
  assert.match(gembokCek, /bukaKunciNilaiPos\(dada, nomorPos, kode, /,
    "membuka gembok tidak menyebut lomba");
});

test("membuka gembok tidak meminta konfirmasi", () => {
  assert.doesNotMatch(gembokCek, /await dialog\(/,
    "membuka gembok masih menampilkan dialog konfirmasi");
  assert.match(gembokCek, /await bukaKunciNilaiPos\(/,
    "membuka gembok tidak memanggil API");
});

test("layar Input Pos tidak lagi bisa menggembok", () => {
  // Lambangnya tetap digambar — barisnya mati, dan tanpa lambang petugas cuma
  // melihat kotak yang tidak bisa diketik tanpa satu pun keterangan kenapa.
  assert.doesNotMatch(app, /async function ubahGembok\(/,
    "layar Input Pos masih punya jalan menggembok sendiri");
  assert.match(app, /class="gembok gembok-tanda"/,
    "lambang gembok hilang dari layar Input Pos — baris mati tanpa keterangan");
});

test("Ulangi pada baris terkunci memberi alasan, bukan diam", () => {
  assert.match(app,
    /\[data-ulang\][\s\S]{0,100}simpanBaris\(tr, true\)/,
    "tombol Ulangi tidak menandai pemanggilan manual");

  const awal = app.indexOf("async function simpanBaris(tr, beriTahu = false) {");
  const akhir = app.indexOf("const lama = asli.get(dada)", awal);
  assert.notEqual(awal, -1, "simpanBaris dengan penanda manual tidak ditemukan");
  const pagar = app.slice(awal, akhir);
  assert.match(pagar, /dataset\.terkunci === "1"[\s\S]*statusBaris\(tr, "gagal", pesan\)/,
    "baris terkunci kembali keluar tanpa status yang menjelaskan");
  assert.match(pagar, /if \(beriTahu\) notif\(/,
    "tombol Ulangi tidak memberi tahu kenapa retry ditolak");
});
