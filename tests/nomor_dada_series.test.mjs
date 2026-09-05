// ============================================================================
// hrcd-rekap : tests/nomor_dada_series.test.mjs — migrasi 0116.
//
// DUA DERET NOMOR DADA, DAN LAYAR HARUS MENOLAK YANG SALAH SEBELUM SERVER.
//
// Panitia mencetak kain nomor dada dalam dua set yang sama-sama mulai dari
// 001, jadi Internal diketik 1001-1250. Pagar sesungguhnya ada di database
// (tes SQL 78); yang diuji di sini pagar di kotaknya — petugas meja mengisi
// belasan kotak sebelum menekan Simpan, dan ditolak server berarti mencari
// sendiri kotak mana yang salah.
//
// Angkanya SELALU datang dari `v_rentang_nomor_dada`, tidak pernah ditulis di
// kode. Karena itu fixture di bawah memakai rentang yang sengaja BUKAN
// 1001-1250 di beberapa tes: kalau ada yang diam-diam mematok 1001, tes itu
// yang gugur.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { deretCocok, deretIntern, golonganIntern, nomorStok, pesanDeret }
  from "../web/js/nomor-dada-series.mjs";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const api = await readFile(new URL("../web/js/api.js", import.meta.url), "utf8");
const migrasi = await readFile(
  new URL("../supabase/migrations/0116_nomor_dada_intern_seribu.sql", import.meta.url), "utf8");

const HRCD37 = {
  eksternalMulai: 1, eksternalSampai: 500,
  internMulai: 1001, internSampai: 1250,
};


test("golongan Intern dikenali dari awalannya, bukan dari daftar nama", () => {
  assert.equal(golonganIntern("intern_pa"), true);
  assert.equal(golonganIntern("intern_pi"), true);
  assert.equal(golonganIntern("penggalang_pa"), false);
  assert.equal(golonganIntern(null), false);
});


test("nomor Eksternal untuk regu Internal ditolak, dan sebaliknya", () => {
  // Kekeliruan yang PASTI terjadi kalau tidak ditolak: kain Internal bertulis
  // 001, dan mengetik apa yang terbaca adalah hal paling wajar sedunia.
  assert.equal(deretCocok(HRCD37, "intern_pa", 1), false);
  assert.equal(deretCocok(HRCD37, "intern_pa", 250), false);
  assert.equal(deretCocok(HRCD37, "intern_pa", 1001), true);
  assert.equal(deretCocok(HRCD37, "intern_pa", 1250), true);
  assert.equal(deretCocok(HRCD37, "intern_pa", 1251), false);

  assert.equal(deretCocok(HRCD37, "penggalang_pa", 1001), false);
  assert.equal(deretCocok(HRCD37, "penggalang_pa", 1), true);
  assert.equal(deretCocok(HRCD37, "penggalang_pa", 500), true);
  assert.equal(deretCocok(HRCD37, "penggalang_pa", 501), false);
});


test("batasnya dari rentang, bukan dari angka 1001 yang dipatok", () => {
  const lain = {
    eksternalMulai: 1, eksternalSampai: 300,
    internMulai: 601, internSampai: 700,
  };
  assert.equal(deretCocok(lain, "intern_pi", 1001), false);
  assert.equal(deretCocok(lain, "intern_pi", 601), true);
  assert.equal(deretCocok(lain, "penegak_pa", 400), false);
});


test("deret yang kosong tidak menghakimi apa pun", () => {
  // Stok Internal yang belum diisi admin: layar berhenti menilai deret dan
  // membiarkan database yang memutuskan. Menolak semua nomor di keadaan ini
  // akan mematikan meja daftar ulang untuk seluruh peserta.
  const belum = { eksternalMulai: 1, eksternalSampai: 500, internMulai: 0, internSampai: 0 };
  assert.equal(deretCocok(belum, "intern_pa", 7), true);
  assert.equal(deretCocok(belum, "intern_pa", 1001), true);
});


test("lembar cadangan memuat kedua deret dan TIDAK memuat lubang di antaranya", () => {
  // Inilah yang dulu salah: lembar dicetak 1..batas, dan batas adalah nomor
  // tertinggi di stok. Dengan deret Internal 1001-1250 itu berarti 500 baris
  // kosong bernomor 501-1000 — nomor yang tidak pernah dibawa siapa pun, dan
  // tiap barisnya menyuruh petugas mencari slip yang tidak ada.
  const nomor = nomorStok(HRCD37);
  assert.equal(nomor.length, 500 + 250);
  assert.equal(nomor[0], 1);
  assert.equal(nomor[499], 500);
  assert.equal(nomor[500], 1001);
  assert.equal(nomor.at(-1), 1250);
  assert.ok(!nomor.includes(501) && !nomor.includes(1000),
    "lembar cadangan masih memuat nomor di antara dua deret");
});


test("stok yang belum punya deret Internal tetap mencetak deret Eksternal", () => {
  const belum = { eksternalMulai: 1, eksternalSampai: 3, internMulai: 0, internSampai: 0 };
  assert.deepEqual(nomorStok(belum), [1, 2, 3]);
});


test("pesannya menyebut deret yang BENAR, bukan cuma bahwa nomornya salah", () => {
  // Petugas yang salah ketik butuh tahu harus mengetik apa. Kalimatnya juga
  // sama bunyinya dengan `pesan_deret_nomor_dada()` di database — dua pesan
  // berbeda untuk satu pagar membuat petugas mengira ada dua aturan.
  assert.equal(pesanDeret(HRCD37, "intern_pa"),
    "Nomor dada intern adalah dari 1001 - 1250.");
  assert.equal(pesanDeret(HRCD37, "penggalang_pi"),
    "Nomor dada eksternal adalah dari 1 - 500.");
  assert.match(migrasi, /format\('Nomor dada %s adalah dari %s - %s\.'/,
    "kalimat di database berubah bentuk tanpa yang di layar ikut berubah");
});


test("batch Internal dikenali dari golongan regunya", () => {
  assert.equal(deretIntern([{ golongan: "penggalang_pa" }, { golongan: "intern_pi" }]), true);
  assert.equal(deretIntern([{ golongan: "penggalang_pa" }]), false);
  assert.equal(deretIntern([]), false);
});


test("Meja Daftar Ulang benar-benar memakai pagarnya", () => {
  // Modul yang benar tapi tidak dipanggil sama saja dengan tidak ada, dan itu
  // tidak menggagalkan apa pun sampai ada yang mengetik di meja.
  assert.match(app, /import \{ deretCocok, deretIntern, nomorStok, pesanDeret \}/);
  assert.match(app, /if \(rentang && !deretCocok\(rentang, inp\.dataset\.golongan, angka\)\)/,
    "kotak nomor dada tidak lagi memeriksa deretnya");
  assert.match(app, /keluhan = keluhan \|\| pesanDeret\(rentang, inp\.dataset\.golongan\)/);
  assert.match(app, /data-golongan="\$\{esc\(r\.golongan\)\}"/,
    "kotak isian tidak membawa golongan, jadi pagarnya tidak punya bahan");
});


test("Input Pos mencetak lembar cadangan dari stok, bukan dari 1..batas", () => {
  assert.match(app, /semua = nomorStok\(rentangStok\)\.map\(/);
  assert.doesNotMatch(app, /Array\.from\(\{ length: batasStok \}/,
    "lembar cadangan masih dibangun dari batas tertinggi");
  assert.doesNotMatch(api, /export async function batasNomorDada/,
    "wrapper lama masih dipublikasikan padahal tidak ada pemanggilnya");
});


test("rentangnya dibaca dari view, bukan dari tabel stok", () => {
  // Seluruh 750 baris stok tidak perlu diunduh cuma untuk tahu ujung-ujungnya,
  // dan meja daftar ulang berbagi jaringan dengan lima pos.
  assert.match(api, /v_rentang_nomor_dada\?select=\*/);
});
