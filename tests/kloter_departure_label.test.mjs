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


test("kedua label menyebut asal angkanya", () => {
  assert.match(layar, /<strong>Planning<\/strong>/);
  assert.match(layar, /<strong>Real<\/strong>/);
  // "Jam berangkat" polos terbaca seperti jadwal; "Estimasi" adalah kata
  // ketiga untuk hal yang kertasnya sebut "Perkiraan".
  assert.doesNotMatch(layar, /\? "Jam berangkat"/);
  assert.doesNotMatch(layar, /"Estimasi jam berangkat"/);
});


test("keduanya digambar bersama, bukan saling menggantikan", () => {
  // Dua push berurutan tanpa `else` di antaranya: kloter yang sudah berangkat
  // menampilkan rencana DAN kenyataannya.
  assert.match(layar, /if \(rencana\) bagian\.push/);
  assert.match(layar, /if \(v\.jamBerangkat\) \{/);
  assert.match(layar, /bagian\.join\(" · "\)/);
});


test("baris jam dibuka ikon jam", () => {
  assert.match(layar, /\$\{ikon\("clock"\)\} \$\{bagian\.join/);
});


test("selisihnya KATA, bukan tanda", () => {
  // "+15" menuntut pembacanya mengingat mana yang rencana dan mana yang nyata
  // sebelum tandanya berarti apa-apa. "telat 15 menit" tidak menuntut apa pun.
  assert.match(layar, /menit === 0 \? "tepat waktu"/);
  assert.match(layar, /telat \$\{menit\} menit/);
  assert.match(layar, /terlalu cepat \$\{Math\.abs\(menit\)\} menit/);
  assert.match(layar, /<span class="sub">\(\$\{kata\}\)<\/span>/);
});


test("selisih dihitung pada hari yang TERCATAT, bukan kalender alat", () => {
  // "07:20" tidak membawa tanggal, dan layar ini dibuka juga di hari selain
  // hari-H. Memakai tanggal alat menghasilkan selisih berhari-hari.
  assert.match(layar, /jamPadaHari\(rencana, v\.jamBerangkat\)/);
});


test("planning layar menang, perkiraan database jadi cadangan", () => {
  assert.match(layar,
    /planning\.get\(Number\(nomor\)\)\s*\n\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*\|\| \(v\.perkiraanBerangkat/);
});


test("kotak jam terisi dari planning TERSIMPAN, bukan konfigurasi edisi", () => {
  // Kalau nilai awalnya selalu dari edisi, jendela yang barusan digeser
  // kembali sendiri tiap layar dimuat ulang — dan kertas yang dicetak
  // sesudahnya berbeda dari yang sebelumnya tanpa ada yang mengubahnya.
  assert.match(layar,
    /cfg\.planning_berangkat_pertama \|\| cfg\.jam_mulai_berangkat/);
  assert.match(layar,
    /cfg\.planning_berangkat_terakhir \|\| cfg\.jam_batas_berangkat/);
});


test("jendela disimpan, ditunda, dan gagalnya tidak diam", () => {
  assert.match(layar, /await aturPlanningBerangkat\(pertama, terakhir\)/);
  // `dengar` menyala tiap penekanan tombol; "0"-"7"-"3"-"0" adalah empat
  // keadaan yang tiga di antaranya belum berarti apa-apa.
  assert.match(layar, /clearTimeout\(jadwalSimpan\)/);
  assert.match(layar, /\}, 800\)/);
  assert.match(layar, /Planning belum tersimpan: \$\{err\.message\}/);
});


test("kertas memakai planning yang sama dengan layar", () => {
  assert.match(layar, /siapkanCetakKloter\(semuaKloter, bentuk, planning\)/);
  assert.match(app,
    /function siapkanCetakKloter\(dipakai, bentuk = "staging", planning = new Map\(\)\)/);
  assert.match(app, /const perkiraan = planning\.get\(Number\(nomor\)\)/);
});


test("kertas staging tetap menyediakan garis jam sebenarnya", () => {
  assert.match(app, /Jam sebenarnya: ________/);
});


test("layar planning tanpa judul dan tanpa paragraf penjelas", () => {
  assert.doesNotMatch(layar, /<h2[^>]*>Planning Keberangkatan<\/h2>/);
  assert.doesNotMatch(layar, /Sudah mengambil nomor dada/);
  assert.doesNotMatch(layar, /dibagi rata ke/);
});


test("jumlah Eksternal dan Intern tetap ada, sebagai kolom mendatar", () => {
  // Yang dijaga ANGKANYA tetap terbit, bukan bentuk tabelnya: keempatnya
  // dibalik jadi mendatar 27 Agustus 2026 supaya kotak jam dan tombol Cetak
  // di bawahnya tidak terdorong keluar layar HP.
  assert.match(layar, /<th>Eksternal<\/th><th>Intern<\/th>/);
  assert.match(layar, /<td class="angka">\$\{jumlahEksternal\}<\/td>/);
  assert.match(layar, /<td class="angka">\$\{jumlahIntern\}<\/td>/);
  // Kepala kolom dan angkanya harus berurutan sama. Tertukar, "Eksternal 0
  // Intern 6" terbaca meyakinkan dan salah total.
  const kepala = layar.match(/<th>Total Kloter<\/th>[\s\S]*?<\/tr>/)[0];
  const isi = layar.match(/<tbody>[\s\S]*?<\/tbody>/)[0];
  assert.deepEqual(
    [...kepala.matchAll(/<th>([^<]+)<\/th>/g)].map(m => m[1]),
    ["Total Kloter", "Total Regu", "Eksternal", "Intern"]);
  assert.deepEqual(
    [...isi.matchAll(/\$\{(\w+)/g)].map(m => m[1]),
    ["perKloter", "baris", "jumlahEksternal", "jumlahIntern"]);
});


test("kolom planning yang belum ada TIDAK mematikan layar", async () => {
  // Situs panitia terbit tiap merge; migrasi dijalankan terpisah sesudahnya
  // (pasal 7.6). Di sela keduanya PostgREST menjawab 42703, dan tanpa
  // penangkap ini Promise.all melempar lalu SELURUH layar Daftar Kloter mati
  // — daftar kloter, pratayang, dan kedua tombol cetak sekaligus.
  //
  // Sudah terjadi sekali, 27 Agustus 2026, dua hari sebelum lomba.
  const { readFile } = await import("node:fs/promises");
  const api = await readFile(new URL("../web/js/api.js", import.meta.url), "utf8");
  assert.match(api,
    /planning_berangkat_pertama,planning_berangkat_terakhir"\)\s*\n\s*\.catch\(\(\) => \[\]\)/);
});
