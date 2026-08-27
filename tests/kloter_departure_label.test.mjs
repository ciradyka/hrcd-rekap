// Daftar Kloter menyandingkan RENCANA dan KENYATAAN, dan menyebut yang mana.
//
// Pasal 10.6: perkiraan bukan catatan. Keduanya jam yang terlihat sama —
// "07:20" — dan sama sekali bukan hal yang sama: yang satu rencana yang
// dibagikan ke peserta, yang satu diketik petugas dari jam dinding dan menjadi
// dasar penalti seluruh regu di kloter itu.
//
// Panitia perlu KEDUANYA sekaligus, bukan yang satu menggantikan yang lain:
// selisihnya yang mereka pakai memutuskan apakah kloter berikutnya digeser.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");

const awal = app.indexOf('pasangKepala("Daftar Kloter")');
const layar = app.slice(awal, app.indexOf("\nfunction siapkanCetakKloter", awal));


test("kartu kloter memakai satu perakit baris jam, bukan ternary di tempat", () => {
  assert.ok(awal > 0, "layar Daftar Kloter tidak ditemukan");
  assert.match(layar, /const barisJamKloter = \(nomor, v\) =>/);
  assert.match(layar, /\$\{barisJamKloter\(nomor, v\)\}/);
});


test("kedua label tetap menyebut asal angkanya", () => {
  assert.match(layar, /<strong>Prediksi Berangkat:<\/strong>/);
  assert.match(layar, /<strong>Jam Berangkat di Lapangan:<\/strong>/);
  // "Jam berangkat" polos terbaca seperti jadwal; "Estimasi" adalah kata
  // ketiga untuk hal yang kertasnya sebut "Perkiraan".
  assert.doesNotMatch(layar, /\? "Jam berangkat"/);
  assert.doesNotMatch(layar, /"Estimasi jam berangkat"/);
});


test("keduanya digambar bersama, bukan saling menggantikan", () => {
  // Dua `bagian.push` berurutan tanpa `else` di antaranya: kloter yang sudah
  // berangkat menampilkan rencana DAN kenyataannya.
  assert.match(layar, /if \(rencana\) \{\s*bagian\.push/);
  assert.match(layar, /if \(v\.jamBerangkat\) \{\s*bagian\.push/);
  assert.match(layar, /bagian\.join\(" · "\)/);
});


test("planning layar menang, perkiraan database jadi cadangan", () => {
  // Urutannya mengikat. Terbalik, jam yang baru saja diatur panitia diabaikan
  // dan kartunya menampilkan sebaran database ke 75 kloter.
  assert.match(layar,
    /planning\.get\(Number\(nomor\)\)\s*\n\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*\|\| \(v\.perkiraanBerangkat/);
});


test("selisih dihitung pada hari yang TERCATAT, bukan kalender alat", () => {
  // "07:20" tidak membawa tanggal, dan layar ini dibuka juga di hari selain
  // hari-H. Memakai tanggal alat menghasilkan selisih berhari-hari.
  assert.match(layar, /jamPadaHari\(rencana, v\.jamBerangkat\)/);
  assert.match(layar, /menit === 0\s*\n?\s*\? html` <span class="sub">tepat<\/span>`/);
});


test("kertas memakai planning yang sama dengan layar", () => {
  // Tombol cetaknya ada di layar yang sama. Kertas yang menyebut jam lain dari
  // yang baru saja dibaca petugas adalah kertas yang salah, dan yang
  // memegangnya peserta.
  assert.match(layar, /siapkanCetakKloter\(semuaKloter, bentuk, planning\)/);
  assert.match(app,
    /function siapkanCetakKloter\(dipakai, bentuk = "staging", planning = new Map\(\)\)/);
  assert.match(app, /const perkiraan = planning\.get\(Number\(nomor\)\)/);
});


test("kertas staging tetap menyediakan garis jam sebenarnya", () => {
  // Blangko difotokopi (pasal 8.1) dan petugas menulis jam nyata dengan
  // tangan di sana — itu yang lalu diketik ke layar Keberangkatan.
  assert.match(app, /Jam sebenarnya: ________/);
});


test("layar planning tanpa judul dan tanpa paragraf penjelas", () => {
  // Pasal 9.1 dan 9.3. Labelnya sendiri sudah menyebut "Planning Berangkat",
  // jadi judul di atasnya mengulang label di bawahnya; dan kalimat yang
  // menjelaskan bahwa jamnya dibagi rata lalu tercetak untuk peserta
  // menjelaskan sesuatu yang terlihat sendiri begitu jamnya diubah sekali.
  //
  // Bukan kerapian: sebagai paragraf ia memakan sepertiga layar HP, dan yang
  // terdorong turun justru kartu kloter yang dibaca petugas.
  assert.doesNotMatch(layar, /<h2[^>]*>Planning Keberangkatan<\/h2>/);
  assert.doesNotMatch(layar, /Sudah mengambil nomor dada/);
  assert.doesNotMatch(layar, /dibagi rata ke/);
});


test("jumlah Eksternal dan Intern tetap ada, sebagai baris tabel", () => {
  assert.match(layar, /<td>Eksternal<\/td><td class="angka">\$\{jumlahEksternal\}<\/td>/);
  assert.match(layar, /<td>Intern<\/td><td class="angka">\$\{jumlahIntern\}<\/td>/);
});
