import assert from "node:assert/strict";
import test from "node:test";

import { hitungRekomendasiKloter } from "../web/js/departure-calculator.mjs";


const hitung = (jumlahEksternal, jumlahIntern = 0,
                waktuPertama = "07:00", waktuTerakhir = "10:00") =>
  hitungRekomendasiKloter({
    waktuPertama,
    waktuTerakhir,
    jumlahEksternal,
    jumlahIntern,
    maksEksternalPerKloter: 5,
    maksInternPerKloter: 3,
    kloterMaks: 60,
  });


test("300 Eksternal dan 50 Intern menjadi 60 kloter dalam tiga jam", () => {
  const hasil = hitung(300, 50);
  assert.equal(hasil.length, 60);
  assert.deepEqual(hasil[0], {
    kloter: 1, jumlahEksternal: 5, jumlahIntern: 3, waktuBerangkat: "07:00",
  });
  assert.deepEqual(hasil[16], {
    kloter: 17, jumlahEksternal: 5, jumlahIntern: 2, waktuBerangkat: "07:49",
  });
  assert.deepEqual(hasil[59], {
    kloter: 60, jumlahEksternal: 5, jumlahIntern: 0, waktuBerangkat: "10:00",
  });
});

test("satu kloter memakai waktu berangkat pertama", () => {
  assert.deepEqual(hitung(1), [
    { kloter: 1, jumlahEksternal: 1, jumlahIntern: 0, waktuBerangkat: "07:00" },
  ]);
});

test("pembulatan menit tetap menaruh kloter terakhir tepat di batas", () => {
  const hasil = hitung(13, 0, "07:00", "07:05");
  assert.deepEqual(hasil.map(x => x.waktuBerangkat), ["07:00", "07:03", "07:05"]);
});

test("menolak jendela terbalik dan jumlah regu di atas kapasitas", () => {
  assert.throws(() => hitung(10, 0, "10:00", "07:00"), /harus setelah/);
  assert.throws(() => hitung(301), /melebihi batas 60/);
});
