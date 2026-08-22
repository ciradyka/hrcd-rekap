import assert from "node:assert/strict";
import test from "node:test";

import { hitungRekomendasiKloter } from "../web/js/departure-calculator.mjs";


const hitung = (jumlahRegu, waktuPertama = "07:00", waktuTerakhir = "10:00") =>
  hitungRekomendasiKloter({
    waktuPertama,
    waktuTerakhir,
    jumlahRegu,
    maksReguPerKloter: 10,
    kloterMaks: 40,
  });


test("65 regu menjadi tujuh kloter dari 07:00 sampai 10:00", () => {
  const hasil = hitung(65);
  assert.deepEqual(hasil.map(x => x.jumlahRegu), [10, 10, 10, 10, 10, 10, 5]);
  assert.deepEqual(hasil.map(x => x.waktuBerangkat),
                   ["07:00", "07:30", "08:00", "08:30", "09:00", "09:30", "10:00"]);
});

test("satu kloter memakai waktu berangkat pertama", () => {
  assert.deepEqual(hitung(1), [
    { kloter: 1, jumlahRegu: 1, waktuBerangkat: "07:00" },
  ]);
});

test("pembulatan menit tetap menaruh kloter terakhir tepat di batas", () => {
  const hasil = hitung(23, "07:00", "07:05");
  assert.deepEqual(hasil.map(x => x.waktuBerangkat), ["07:00", "07:03", "07:05"]);
});

test("menolak jendela terbalik dan jumlah regu di atas kapasitas", () => {
  assert.throws(() => hitung(10, "10:00", "07:00"), /harus setelah/);
  assert.throws(() => hitung(401), /melebihi batas 40/);
});
