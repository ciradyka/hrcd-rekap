// Kalkulator Keberangkatan harus menyebut jam yang SAMA dengan database.
//
// Ada dua tempat yang menghitung perkiraan berangkat, dan yang satu tidak
// boleh membantah yang lain: `perkiraan_berangkat_kloter()` (migrasi 0105)
// mengisi kertas kloter yang dibagikan ke peserta dan chip `~HH:MM` di layar
// Keberangkatan, sedangkan berkas ini dipakai menyusun jadwal pagi. CLAUDE.md
// 10.5: "kloter 9, kira-kira 08:45" adalah jawaban atas pertanyaan yang
// panitia dan pembina benar-benar ajukan — dan jawabannya harus satu.
//
// Angka yang dipatok di bawah DIUKUR dari database, bukan diturunkan ulang di
// sini. Menurunkannya ulang berarti menguji rumus terhadap dirinya sendiri.

import assert from "node:assert/strict";
import test from "node:test";

import { hitungRekomendasiKloter, jadwalPlanning } from "../web/js/departure-calculator.mjs";


const hitung = (jumlahEksternal, jumlahIntern = 0,
                waktuPertama = "07:00", waktuTerakhir = "10:00",
                kloterMaks = 75) =>
  hitungRekomendasiKloter({
    waktuPertama,
    waktuTerakhir,
    jumlahEksternal,
    jumlahIntern,
    maksEksternalPerKloter: 5,
    maksInternPerKloter: 3,
    kloterMaks,
  });


test("jamnya sama persis dengan perkiraan_berangkat_kloter()", () => {
  // Diukur di PostgreSQL dengan konfigurasi edisi 37 — kloter_maks 75,
  // jendela 07:00-10:00:
  //
  //   select k, perkiraan_berangkat_kloter(k) from unnest(array[1,10,30,60]) k
  //     1  07:00:00
  //    10  07:21:53
  //    30  08:10:32
  //    60  09:23:30
  //
  // Layar menampilkannya lewat jamMenit(), yang MEMOTONG detik.
  const hasil = hitung(300, 50);
  assert.equal(hasil.length, 60, "yang direncanakan cuma kloter yang diisi");

  const jam = (k) => hasil[k - 1].waktuBerangkat;
  assert.equal(jam(1), "07:00");
  assert.equal(jam(10), "07:21");
  assert.equal(jam(30), "08:10");
  assert.equal(jam(60), "09:23");
});


test("cadangan yang tidak terpakai TIDAK memajukan kloter terakhir ke batas", () => {
  // Inilah yang membedakan kedua rumus. Membagi dengan jumlah kloter yang
  // DIBUTUHKAN menaruh K60 tepat 10:00; membagi dengan seluruh kloter edisi
  // menaruhnya 09:23, dan cadangan K61-K75 mengisi sisa jendelanya.
  assert.notEqual(hitung(300, 50)[59].waktuBerangkat, "10:00");

  // Kalau seluruh kloter edisi memang terpakai, yang terakhir jatuh tepat di
  // batas — CLAUDE.md 10.1, dan ini yang dijaga 0105.
  const penuh = hitung(375, 0);
  assert.equal(penuh.length, 75);
  assert.equal(penuh[74].waktuBerangkat, "10:00");
});


test("isi kloter tetap FIFO dengan dua kuota terpisah", () => {
  const hasil = hitung(300, 50);
  assert.deepEqual(hasil[0], {
    kloter: 1, jumlahEksternal: 5, jumlahIntern: 3, waktuBerangkat: "07:00",
  });
  // Intern habis di kloter ke-17: 50 dibagi 3 menyisakan 2.
  assert.equal(hasil[16].jumlahEksternal, 5);
  assert.equal(hasil[16].jumlahIntern, 2);
  assert.equal(hasil[17].jumlahIntern, 0);
});


test("satu kloter memakai waktu berangkat pertama", () => {
  assert.deepEqual(hitung(1), [
    { kloter: 1, jumlahEksternal: 1, jumlahIntern: 0, waktuBerangkat: "07:00" },
  ]);
  // Termasuk saat edisinya memang hanya punya satu kloter — pembaginya nol
  // di situ, dan tidak boleh melahirkan NaN.
  assert.deepEqual(hitung(1, 0, "07:00", "10:00", 1), [
    { kloter: 1, jumlahEksternal: 1, jumlahIntern: 0, waktuBerangkat: "07:00" },
  ]);
});


test("menolak jendela terbalik dan jumlah regu di atas kapasitas", () => {
  assert.throws(() => hitung(10, 0, "10:00", "07:00"), /harus setelah/);
  assert.throws(() => hitung(376), /melebihi batas 75/);
});


/* ---------------------------------------------------------------------------
   jadwalPlanning — rencana untuk kloter yang SUDAH terbentuk.

   Pertanyaannya berbeda dari hitungRekomendasiKloter di atas: yang itu
   proyeksi sebelum daftar ulang, yang ini rencana sesudahnya. Karena itu
   pembaginya juga berbeda, dan perbedaan itu disengaja.
   ------------------------------------------------------------------------- */

test("kloter yang ada disebar penuh di jendela, bukan ke kloter cadangan", () => {
  const jadwal = jadwalPlanning([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "07:00", "10:00");
  assert.equal(jadwal.size, 10);
  assert.equal(jadwal.get(1), "07:00");
  assert.equal(jadwal.get(2), "07:20");
  assert.equal(jadwal.get(10), "10:00");

  // Inilah bedanya dengan perkiraan database, yang menyebar ke SELURUH 75
  // kloter edisi: di sana kesepuluh kloter ini berangkat sebelum 07:25 dan
  // jendela sampai pukul sepuluh tidak terpakai sama sekali.
  assert.notEqual(jadwal.get(10), "07:21");
});


test("satu kloter berangkat di jam pertama, bukan NaN", () => {
  assert.deepEqual([...jadwalPlanning([1], "07:00", "10:00")], [[1, "07:00"]]);
});


test("nomor kloter berlubang tetap berurutan menurut nomornya", () => {
  // Kloter kosong memang tidak ada di daftar ini. Yang menentukan posisinya
  // dalam urutan, bukan nomornya.
  const jadwal = jadwalPlanning([7, 1, 3], "07:00", "10:00");
  assert.deepEqual([...jadwal.keys()], [1, 3, 7]);
  assert.equal(jadwal.get(1), "07:00");
  assert.equal(jadwal.get(7), "10:00");
});


test("jendela terbalik dan jam tidak lengkap ditolak", () => {
  assert.throws(() => jadwalPlanning([1, 2], "10:00", "07:00"), /harus setelah/);
  assert.throws(() => jadwalPlanning([1, 2], "", "10:00"), /belum lengkap/);
});
