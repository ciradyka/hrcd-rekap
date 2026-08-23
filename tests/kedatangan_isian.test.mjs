// ============================================================================
// hrcd-rekap : tests/kedatangan_isian.test.mjs
//
// ISIAN KOREKSI DI MEJA KEDATANGAN TIDAK BOLEH IKUT PINDAH KE REGU BERIKUTNYA.
//
// Dua kebutuhan memakai dua kotak yang sama. Regu yang sudah tercatat
// ditampilkan jam lamanya supaya verifikasi terhadap kertas tinggal
// membandingkan; petugas yang menyalin sederet catatan kertas sering mengetik
// jamnya lebih dulu lalu membetulkan nomornya — itu sebabnya bersihkan()
// sengaja tidak mengosongkan keduanya.
//
// Bedanya cuma siapa yang mengisi. Tanpa pembedaan itu, mengetik 042 yang
// sudah tercatat 10:30 dengan 4 anggota lalu berpindah ke 043 yang baru masuk
// pukul 11:05 menyimpan 043 sebagai datang 10:30 dengan 4 anggota — di kotak
// yang tidak terlihat, karena panel koreksinya tertutup. Tidak ada galat, dan
// penalti waktunya berubah dari 5 poin jadi 30.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");

const layar = (() => {
  const awal = app.indexOf("  async function cariDanTampilkan(dada) {");
  const akhir = app.indexOf("  function gambarRiwayat() {", awal);
  assert.notEqual(awal, -1, "cariDanTampilkan tidak ditemukan");
  assert.notEqual(akhir, -1, "akhir layar Kedatangan tidak ditemukan");
  return app.slice(awal, akhir);
})();

test("isian sistem milik satu regu, dan pergi bersama regu itu", () => {
  assert.match(layar, /isianDariSistem = dada;/,
    "prefill tidak menandai regu pemiliknya");
  assert.match(layar,
    /else if \(isianDariSistem !== null && isianDariSistem !== dada\)[\s\S]{0,220}inpJam\.setNilai\(""\)[\s\S]{0,80}inpHadir\.value = "5"/,
    "berpindah ke regu yang belum tercatat tidak mengosongkan isian regu "
    + "sebelumnya — jam dan jumlah anggota regu lain akan ikut tersimpan");
});

test("ketikan petugas tidak pernah dibuang", () => {
  // Yang diketik petugas sendiri bukan milik satu regu; menghapusnya saat ia
  // membetulkan nomor adalah kegagalan yang lain lagi, dan bersihkan() sudah
  // menjelaskan kenapa.
  assert.match(app, /inpJam\.dengar\(\(\) => \{ isianDariSistem = null;/,
    "mengetik jam tidak membatalkan penanda isian sistem");
  assert.match(app, /inpHadir\.addEventListener\("input", \(\) => \{ isianDariSistem = null;/,
    "mengetik jumlah anggota tidak membatalkan penanda isian sistem");
});

test("isi yang punya akibat tidak boleh tersembunyi", () => {
  // Kedua kotak duduk di dalam <details> yang tertutup, berikut lencana
  // "penalti berubah" yang seharusnya memperingatkan.
  assert.match(app, /const panelKoreksi = inpHadir\.closest\("details"\)/,
    "panel koreksi tidak dikenali");
  assert.match(app, /if \(berisi\) panelKoreksi\.open = true;/,
    "panel koreksi tidak dibuka saat kotaknya berisi");
});
