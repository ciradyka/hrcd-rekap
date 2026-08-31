// ============================================================================
// hrcd-rekap : tests/cek_nilai_simpan_otomatis.test.mjs
// Cek Nilai menyimpan sendiri saat angkanya diubah — tidak ada tombol simpan.
//
// Yang tersisa cuma KABAR: titik-titik kuning berarti belum sampai database,
// centang hijau berarti sudah. Tombol simpan pada layar yang menyimpan sendiri
// adalah tombol yang tidak pernah perlu ditekan, dan tombol seperti itu justru
// membuat orang ragu apakah angkanya tersimpan kalau ia lupa menekannya.
//
// KETIGA PENDENGARNYA PERLU, dan itu yang paling mudah dirusak:
//   input     menandai kuning sejak ketukan pertama
//   change    menyimpan saat kotaknya ditinggalkan dengan isi berbeda
//   focusout  jaring pengaman — mengetik ulang angka yang SAMA memicu `input`
//             tapi tidak selalu `change`, jadi tanpa ini penanda kuningnya
//             menggantung selamanya
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../web/style.css", import.meta.url), "utf8");

test("tidak ada lagi tombol simpan di Cek Nilai", () => {
  assert.doesNotMatch(app, /data-simpan-lomba/,
    "tombol simpan kembali ada — layar ini menyimpan sendiri, dan tombol yang "
    + "tidak pernah perlu ditekan membuat orang ragu kalau ia lupa menekannya");
  assert.match(app, /<span class="cek-status" data-status=/,
    "penanda keadaan hilang — panitia tidak bisa tahu angkanya sudah tersimpan");
});

test("ketiga pendengar simpan-otomatis terpasang", () => {
  for (const [peristiwa, alasan] of [
    ["input", "penanda kuning tidak muncul sejak ketukan pertama"],
    ["change", "angka yang diubah tidak pernah tersimpan"],
    ["focusout", "mengetik ulang angka yang SAMA meninggalkan penanda kuning selamanya"],
  ]) {
    const pola = new RegExp(
      `elIsi\\.addEventListener\\("${peristiwa}", \\(e\\) => \\{[\\s\\S]{0,320}?data-isian`);
    assert.match(app, pola, `pendengar \`${peristiwa}\` hilang — ${alasan}`);
  }
});

test("satu pintu simpan, bersama layar input", () => {
  // kirimNilaiRegu() memegang keempat aturannya: kotak tak terbaca tidak
  // menyentuh angka lama, kotak kosong berarti hapus, angka yang sama tidak
  // dikirim ulang, gagal jaringan masuk antrean. Menyalinnya ke sini berarti
  // empat aturan itu punya dua tempat yang suatu hari berbeda.
  const awal = app.indexOf("  async function simpanLomba(kode) {");
  const akhir = app.indexOf("  /* SIMPAN SENDIRI SAAT DIUBAH", awal);
  assert.ok(awal >= 0 && akhir > awal, "simpanLomba tidak ditemukan");
  const fungsi = app.slice(awal, akhir);
  assert.match(fungsi, /await kirimNilaiRegu\(\{ pos: nomorPos, kolom: l\.kolom, regu: r, wadah \}\)/,
    "simpanLomba tidak lagi lewat pintu yang sama dengan layar input");
  // Lomba tergembok tidak dikirim: server akan menolaknya, dan penolakan yang
  // bisa dihindari lebih baik tidak dibuat.
  assert.match(fungsi, /if \(lombaTerkunci\(\)\.has\(kode\)\) return;/,
    "lomba tergembok tetap dikirim dan dijamin ditolak server");
  // Dua simpanan berbarengan untuk lomba yang sama akan saling mendahului.
  assert.match(fungsi, /sedangSimpan\.(has|add|delete)\(kode\)/,
    "tidak ada penjaga simpanan berbarengan");
});

test("antre tetap KUNING, bukan hijau", () => {
  // Yang masuk antrean BELUM sampai database. Centang hijau di situ berbohong
  // tentang satu-satunya hal yang ditanyakan panitia.
  // Dibatasi ke simpanLomba: cabang `antre` yang sama ada di layar lain, dan
  // yang pertama ditemukan di berkas ini bukan milik Cek Nilai.
  const fungsi = app.slice(app.indexOf("  async function simpanLomba(kode) {"),
                           app.indexOf("  /* SIMPAN SENDIRI SAAT DIUBAH"));
  const potong = fungsi.slice(fungsi.indexOf('if (jawab.hasil === "antre")'));
  assert.match(potong, /statusLomba\(kode, "belum"\)/,
    "nilai yang masuk antrean ditandai tersimpan — padahal belum sampai");
});

test("kuning dan hijau tidak jadi satu-satunya pembeda", () => {
  // Sekitar satu dari dua belas laki-laki sulit membedakan merah dari hijau.
  // Bentuknya pun berbeda: titik-titik lawan centang.
  assert.match(app, /sel\.textContent = "\\u2026";/,
    "penanda belum tersimpan bukan titik-titik");
  assert.match(app, /sel\.textContent = "\\u2713";/,
    "penanda tersimpan bukan centang");
  assert.match(app, /sel\.title = "Belum tersimpan";/,
    "keadaannya tidak disebut dengan kata untuk pembaca layar");
  assert.match(css, /\.cek-status\[data-keadaan="belum"\],\s*\r?\n\.cek-status\[data-keadaan="menyimpan"\] \{ color: var\(--kuning\); \}/,
    "penanda belum tersimpan tidak lagi kuning");
  assert.match(css, /\.cek-status\[data-keadaan="tersimpan"\] \{ color: var\(--hijau\); \}/,
    "penanda tersimpan tidak lagi hijau");
});

test("lebar penanda dipatok supaya barisnya tidak berjoget", () => {
  assert.match(css, /\.cek-status \{[\s\S]{0,200}min-width: 28px;/,
    "lebar penanda tidak dipatok — kotak isian bergeser tiap kali penandanya "
    + "berganti, dan baris yang berjoget saat mengetik terbaca seperti layar "
    + "yang salah");
});
