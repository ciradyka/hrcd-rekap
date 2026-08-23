// ============================================================================
// hrcd-rekap : tests/live_score_kolom_perjalanan.test.mjs
// Lima kolom yang menjelaskan Penalti berdiri di kedua papan Live Score,
// dalam urutan yang membuatnya bisa dibaca.
//
// Penalti selalu dibaca dengan pertanyaan "dari mana", dan jawabannya kontrak
// waktu, kloter, jam berangkat, jam datang, dan berapa anggota yang tiba.
// Kelimanya SESUDAH Penalti berarti mata harus melompat balik melewati
// seluruh kolom lomba — jadi urutannya ikut dijaga di sini, bukan cuma
// keberadaannya.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { kontrakTeks } from "../web/js/util.js";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const live = await readFile(new URL("../live/live.js", import.meta.url), "utf8");

const papanPanitia = (() => {
  const awal = app.indexOf("const kartuGolongan = (g) => {");
  const akhir = app.indexOf("const GOL = URUT_GOLONGAN;", awal);
  assert.ok(awal >= 0 && akhir > awal, "kartuGolongan tidak ditemukan di app.js");
  return app.slice(awal, akhir);
})();

const papanPeserta = (() => {
  const awal = live.indexOf("function gambarPapan()");
  const akhir = live.indexOf("let pengendaliFilter = null;", awal);
  assert.ok(awal >= 0 && akhir > awal, "gambarPapan tidak ditemukan di live.js");
  return live.slice(awal, akhir);
})();

const PAPAN = [["panitia", papanPanitia], ["peserta", papanPeserta]];
const URUTAN = ["Kontrak", "Kloter", "Berangkat", "Datang", "Anggota", "Penalti"];

test("kelima kolom perjalanan ada di kedua papan, berurutan sebelum Penalti", () => {
  for (const [nama, sumber] of PAPAN) {
    const posisi = URUTAN.map(judul => {
      const at = sumber.indexOf(`>${judul}</th>`);
      assert.notEqual(at, -1, `kolom ${judul} hilang dari papan ${nama}`);
      return at;
    });
    for (let i = 1; i < posisi.length; i++) {
      assert.ok(posisi[i] > posisi[i - 1],
        `di papan ${nama}, ${URUTAN[i]} berdiri sebelum ${URUTAN[i - 1]}`);
    }
  }
});

test("jam di kedua papan lewat jamMenit, bukan zona waktu alat", () => {
  for (const [nama, sumber] of PAPAN) {
    assert.match(sumber, /jamMenit\((?:rk|b)\.jam_berangkat\)/,
      `jam berangkat papan ${nama} tidak lewat jamMenit()`);
    assert.match(sumber, /jamMenit\((?:rk|b)\.jam_datang\)/,
      `jam datang papan ${nama} tidak lewat jamMenit()`);
    assert.doesNotMatch(sumber, /toTimeString|toLocaleTimeString/,
      `papan ${nama} membaca jam dari zona waktu alat`);
  }
});

test("kontrak waktu dieja lewat aturan bersama, bukan disalin tangan", () => {
  for (const [nama, sumber] of PAPAN) {
    assert.match(sumber, /kontrakTeks\((?:rk|b)\.kontrak_menit\)/,
      `papan ${nama} tidak memakai kontrakTeks() dari util.js`);
  }
  // Salinan tangan yang dulu tinggal di live.js — dan tidak pernah dipanggil
  // sekali pun. Kalau ia lahir lagi, dua papan akan mengeja satu angka dengan
  // dua cara pada edisi pertama yang mengubah aturannya.
  assert.doesNotMatch(live, /const kontrak = \(menit\)/,
    "live.js kembali menuliskan aturan kontrak waktunya sendiri");
});

test("kontrakTeks mengeja menit sebagai kata yang diucapkan panitia", () => {
  assert.equal(kontrakTeks(180), "3 jam");
  assert.equal(kontrakTeks(210), "3,5 jam");
  assert.equal(kontrakTeks(240), "4 jam");
  // Belum berkontrak bukan "0 jam": itu terbaca sebagai pilihan yang sudah
  // dibuat, padahal justru belum.
  for (const kosong of [null, undefined, 0, ""]) {
    assert.equal(kontrakTeks(kosong), "—", `kontrakTeks(${kosong})`);
  }
  // Menit ganjil ditulis apa adanya — jelek, tapi jujur. Membulatkannya
  // diam-diam menyembunyikan konfigurasi keliru dari yang bisa membetulkannya.
  assert.equal(kontrakTeks(255), "4,15 jam");
});
