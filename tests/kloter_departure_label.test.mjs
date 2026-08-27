// Daftar Kloter menyebut ASAL jam yang ia tampilkan.
//
// Pasal 10.6: perkiraan bukan catatan, dan layar yang menampilkan keduanya
// harus menyebut yang mana. Keduanya jam yang terlihat sama — "07:05" — dan
// sama sekali bukan hal yang sama: yang satu dihitung sistem untuk
// merencanakan pagi, yang satu diketik petugas dari jam dinding dan menjadi
// dasar penalti seluruh regu di kloter itu.
//
// Dijaga mesin karena kegagalannya tidak menimbulkan galat apa pun: labelnya
// tetap tergambar, angkanya tetap benar, dan yang keliru cuma kesimpulan yang
// diambil orang yang membacanya.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");

const awal = app.indexOf("async function layarDaftarKloter()") >= 0
  ? app.indexOf("async function layarDaftarKloter()")
  : app.indexOf('pasangKepala("Daftar Kloter")');
const daftarKloter = app.slice(awal, app.indexOf("\nfunction siapkanCetakKloter", awal));


test("kartu kloter memilih label menurut ada tidaknya jam tercatat", () => {
  assert.ok(awal > 0, "layar Daftar Kloter tidak ditemukan");
  assert.match(daftarKloter, /v\.jamBerangkat\s*\n?\s*\? "Jam Berangkat di Lapangan"/);
  assert.match(daftarKloter, /: "Prediksi Berangkat"/);
});


test("label lama yang tidak menyebut asal angkanya tidak kembali", () => {
  // "Jam berangkat" polos terbaca seperti jadwal, dan "Estimasi" adalah kata
  // KETIGA untuk hal yang kertasnya sebut "Perkiraan".
  assert.doesNotMatch(daftarKloter, /\? "Jam berangkat"/);
  assert.doesNotMatch(daftarKloter, /"Estimasi jam berangkat"/);
});


test("angkanya tetap jatuh ke perkiraan hanya saat belum tercatat", () => {
  // Urutannya mengikat: `jamBerangkat` dulu, perkiraan sebagai cadangan.
  // Terbalik, kloter yang SUDAH berangkat akan menampilkan perkiraannya dan
  // penalti dihitung dari angka yang tidak tertulis di mana pun.
  assert.match(daftarKloter,
    /jamMenit\(v\.jamBerangkat \|\| v\.perkiraanBerangkat\)/);
});


test("kertas kloter TIDAK ikut berubah kata", () => {
  // Blangko difotokopi dan masternya bisa sudah beredar (pasal 8.1). Kertas
  // peserta memang selalu memuat perkiraan — ia dicetak sebelum ada yang
  // berangkat — dan kertas staging menyediakan garis kosong "Jam sebenarnya"
  // untuk ditulis tangan. Keduanya benar apa adanya.
  assert.match(app, /Perkiraan jam berangkat: \$\{esc\(perkiraan\)\}/);
  assert.match(app, /Jam sebenarnya: ________/);
});
