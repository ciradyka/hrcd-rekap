// ============================================================================
// hrcd-rekap : tests/nilai_mentah_input.test.mjs
//
// YANG DIKETIK JURI HARUS SAMA DENGAN YANG TERSIMPAN.
//
// Poin tidak pernah disimpan; keempat layar menurunkannya dari nilai mentah.
// Karena itu kesalahan di sini adalah kesalahan yang PALING mahal: kalau angka
// mentahnya sudah salah, Input Nilai Pos, Live Score panitia, Rekapitulasi dan
// Live Score peserta akan sepakat — pada angka yang salah — dan tidak ada satu
// pun layar yang bisa membantahnya.
//
// Dua kegagalan yang pernah nyata dijaga di sini:
//
//   1. detikSah mengganti titik jadi titik dua (diwarisi dari jamSah, tempat
//      "7.45" memang 07:45). Di stopwatch "24.31" berarti 24,31 detik, jadi
//      yang tersimpan 1471 detik — lolos rentang 0-3600 tanpa galat, dan
//      bernilai 20 poin alih-alih 100.
//   2. bacaSel membaca kotak `input[type=number]` yang berisi ketikan tak
//      terurai sebagai kotak KOSONG, karena begitulah browser melaporkannya.
//      Kosong berarti "hapus nilainya", jadi salah ketik satu huruf menghapus
//      angka yang sudah benar dan barisnya tetap bercentang hijau.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { detikSah, detikTeks, meterSah, meterTeks }
  from "../web/js/util.js";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");

test("detikSah menerima bentuk yang memang dijanjikan kotaknya", () => {
  assert.equal(detikSah("32"), 32);
  assert.equal(detikSah("95"), 95);
  assert.equal(detikSah("0:32"), 32);
  assert.equal(detikSah("1:10"), 70);
  assert.equal(detikSah("00:50"), 50);
  assert.equal(detikSah(" 1:10 "), 70);
  // Menit tidak dibatasi: lomba yang molor tetap tercatat apa adanya.
  assert.equal(detikSah("90:00"), 5400);
});

test("detikSah menolak titik, bukan menebaknya sebagai menit", () => {
  // Pembacaan stopwatch. Dulu tersimpan 1471 detik tanpa satu pun tanda.
  assert.equal(detikSah("24.31"), null);
  // Tulisan tangan yang bermaksud satu menit tiga puluh. Ditolak juga —
  // justru karena dua orang memaksudkan dua besaran berbeda dengan tanda yang
  // sama, menebak salah satunya berarti menyimpan waktu yang tidak terjadi.
  assert.equal(detikSah("1.30"), null);
  assert.equal(detikSah("0.5"), null);
});

test("detikSah menolak spasi di tengah dan detik di atas 59", () => {
  assert.equal(detikSah("2 4"), null);     // dulu jadi 2:4 = 124 detik
  assert.equal(detikSah("1 30"), null);
  assert.equal(detikSah("1:75"), null);    // salah ketik, bukan 135 detik
  assert.equal(detikSah("00:24.31"), null);
  assert.equal(detikSah("abc"), null);
});

test("kotak kosong bukan nol", () => {
  // null berarti "belum dinilai". Yang menerjemahkannya jadi 0 akan mencatat
  // regu yang belum dinilai sebagai regu yang mendapat nol.
  assert.equal(detikSah(""), null);
  assert.equal(detikSah("   "), null);
  assert.equal(meterSah(""), null);
  assert.equal(meterSah("   "), null);
});

test("meterSah tetap membaca titik dan koma sebagai desimal", () => {
  // Kotak meter dan kotak detik mengurai tanda yang sama secara berbeda, dan
  // itu memang disengaja — 8,55 m adalah pecahan, 1:30 adalah dua besaran.
  assert.equal(meterSah("8"), 800);
  assert.equal(meterSah("8.55"), 855);
  assert.equal(meterSah("8,55"), 855);
  assert.equal(meterSah("8.555"), 856);
  assert.equal(meterSah("abc"), null);
});

test("digambar ulang tidak mengubah angka yang tersimpan", () => {
  // Kotak diisi ulang dari nilai tersimpan tiap kali tabel digambar ulang.
  // Kalau bentuk tulisnya tidak bisa dibaca kembali jadi angka yang sama,
  // satu penyimpanan berikutnya menyimpan angka yang berbeda dari yang
  // pernah diketik — tanpa ada yang menyentuh kotaknya.
  for (const teks of ["32", "95", "0:32", "1:10", "90:00"]) {
    const detik = detikSah(teks);
    assert.equal(detikSah(detikTeks(detik)), detik,
      `detik ${teks} berubah setelah digambar ulang`);
  }
  for (const teks of ["8", "8.55", "8,55", "12.05"]) {
    const cm = meterSah(teks);
    assert.equal(meterSah(meterTeks(cm)), cm,
      `meter ${teks} berubah setelah digambar ulang`);
  }
});

test("bacaSel memeriksa badInput di kotak angka bawaan browser", () => {
  // Tes teks-sumber, dan itu memang kelemahannya: bacaSel butuh DOM sungguhan
  // untuk dipanggil. Yang dijaga di sini cuma bahwa pemeriksaannya tidak
  // hilang diam-diam — kalau nama fungsinya berubah, tes ini gagal keras,
  // bukan lulus tanpa memeriksa apa pun.
  const awal = app.indexOf("function bacaSel(tr, k) {");
  assert.notEqual(awal, -1, "fungsi bacaSel tidak ditemukan");
  const akhir = app.indexOf("\n}", app.indexOf("nilai_2: null };", awal));
  assert.notEqual(akhir, -1, "akhir fungsi bacaSel tidak ditemukan");

  const bacaSel = app.slice(awal, akhir);
  assert.match(bacaSel, /validity\s*&&\s*\w+\.validity\.badInput/,
    "bacaSel tidak lagi memeriksa validity.badInput — ketikan yang tidak "
    + "terbaca akan kembali menghapus nilai yang sudah tersimpan");

  // Cabang benar_kurang_salah memeriksa KEDUA kotaknya, dan cabang umum
  // memeriksa kotaknya sebelum membaca value.
  const kembar = bacaSel.slice(bacaSel.indexOf('k.form === "benar_kurang_salah"'));
  assert.match(kembar, /takTerbaca\(kotak\[0\]\)\s*\|\|\s*takTerbaca\(kotak\[1\]\)/,
    "kotak salah pada benar_kurang_salah tidak dijaga");

  const umum = bacaSel.slice(bacaSel.lastIndexOf("const v = kotak[0].value.trim();"));
  assert.ok(bacaSel.slice(0, bacaSel.length - umum.length)
              .includes("if (takTerbaca(kotak[0])) return TIDAK_SAH;"),
    "cabang umum membaca value tanpa memeriksa badInput lebih dulu");
});
