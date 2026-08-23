// ============================================================================
// hrcd-rekap : tests/filter_sekolah.test.mjs
//
// PANEL PENYARING SEKOLAH HIDUP DI <body>, BUKAN DI DALAM TABELNYA.
//
// Ia dipindah ke sana supaya `position: fixed` benar-benar relatif ke layar
// (satu leluhur ber-transform sudah cukup untuk memindahkannya entah ke mana).
// Harganya: tidak ada satu pun penggambaran ulang yang membuangnya, karena
// yang diganti selalu isi #isi / LAYAR sementara panelnya sudah tidak di sana.
//
// Tanpa pembuangan yang disengaja, tiap penggambaran menambah empat panel dan
// dua pendengar `document`. Yang lebih buruk daripada tumpukannya: panel yang
// sedang DIBUKA pembaca milik penggambaran sebelumnya, jadi mencentang sekolah
// di dalamnya tidak menyaring apa pun — dan tidak ada galat apa pun.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const live = await readFile(new URL("../live/live.js", import.meta.url), "utf8");

for (const [nama, kode] of [["panitia", app], ["peserta", live]]) {
  test(`panel penyaring ${nama} dibuang sebelum dipasang lagi`, () => {
    assert.match(kode, /document\.querySelectorAll\("body > \.isi-filter"\)[\s\S]{0,40}\.remove\(\)/,
      `panel ${nama} dari penggambaran sebelumnya tidak dibuang dari <body>`);
  });

  test(`pendengar document panel ${nama} ikut dibatalkan`, () => {
    // Dua pendengar per panel: klik di luar, dan Escape. Keduanya menutup
    // panel yang sudah tidak ada di layar kalau tidak ikut dibatalkan.
    const pasang = [...kode.matchAll(/document\.addEventListener\("(click|keydown)"/g)];
    assert.ok(pasang.length >= 2,
      `pendengar panel ${nama} tidak ditemukan`);
    assert.match(kode, /new AbortController\(\)/,
      `panel ${nama} tidak punya pengendali untuk membatalkan pendengarnya`);

    // Tiap pemasangan pendengar document di berkas ini harus membawa signal.
    for (const m of pasang) {
      const potongan = kode.slice(m.index, kode.indexOf("});", m.index) + 3);
      assert.match(potongan, /\{ signal \}/,
        `satu pendengar document di ${nama} dipasang tanpa signal:\n`
        + potongan.slice(0, 160));
    }
  });
}

test("papan peserta tidak digambar ulang kalau tidak ada yang berubah", () => {
  // Denyut 60 detik yang selalu menggambar ulang membuang panel yang sedang
  // dibuka, pilihan sekolah yang sudah dicentang, dan posisi gulir mendatar —
  // tepat ketika peserta sedang membacanya.
  assert.match(live, /if \(kunciGambar\(\) !== kunciTergambar\) gambar\(\);/,
    "muat() menggambar ulang tanpa syarat");
  assert.match(live, /const kunciGambar = \(\) =>[\s\S]{0,120}META && META\.versi[\s\S]{0,80}fase\(\)[\s\S]{0,80}REKAP && REKAP\.versi/,
    "kunci penggambaran tidak memuat ketiga hal yang menentukan isi papan");
});

test("rekap yang gagal diambil dicoba lagi pada poll berikutnya", () => {
  // Syarat di luar harus SAMA dengan penjaga di dalam muatRekap(). Dulu di
  // luar berbunyi `versiBerubah || !REKAP` — perbandingan META lama dengan
  // live.json baru — sehingga ia benar hanya pada satu poll. Satu kegagalan
  // unduh tepat pada poll itu membekukan papan di penerbitan sebelumnya
  // sampai halamannya dimuat ulang dengan tangan.
  assert.match(live,
    /if \(mulai\(\) && \(!REKAP \|\| versiRekap !== META\.versi\)\) await muatRekap\(\);/,
    "syarat pengambilan rekap tidak sama dengan penjaga di dalam muatRekap()");
  // Bentuk lamanya masih DIKUTIP di komentar sebagai catatan sejarah, jadi
  // yang dicari pernyataannya, bukan teksnya.
  assert.doesNotMatch(live, /if \(mulai\(\) && \(versiBerubah \|\| !REKAP\)\)/,
    "syarat lama yang hanya benar satu kali masih terpasang");
});

test("cap waktu tidak maju mendahului tabel yang ditampilkannya", () => {
  // "Update terakhir" dibaca dari META. Membiarkannya maju sementara tabelnya
  // masih terbitan sebelumnya membuat baris itu berbohong dengan meyakinkan.
  assert.match(live,
    /if \(mulai\(\) && metaLama && versiRekap !== META\.versi\) META = metaLama;/,
    "META tetap maju walau rekap terbitan itu tidak sampai");
});
