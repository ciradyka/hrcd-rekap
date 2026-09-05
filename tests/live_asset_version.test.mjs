// Berkas halaman peserta dialamati dengan `?v=<nomor>` di live/index.html, dan
// nomornya dinaikkan tangan. Selama tujuh belas kali itu berjalan; pada kali
// kedelapan belas tidak — `live.js` berubah dua kali (fase juara, lalu tata
// letak kejuaraan) dan nomornya tetap 17.
//
// Yang menyelamatkannya kebetulan: `live/_headers` memberi SEMUA berkas
// `Cache-Control: no-cache`, jadi browser tetap bertanya ulang sebelum memakai
// salinannya, dan muat-ulang biasa selalu mendapat berkas terbaru. Tapi
// nomornya ada justru untuk keadaan yang TIDAK bertanya: tab yang sudah
// terbuka sejak pagi, halaman yang dipulihkan dari bfcache, perantara yang
// memegang salinan sendiri. Di sana yang menentukan cuma alamatnya berubah
// atau tidak.
//
// Tes ini menyimpan sidik jari isi tiap berkas di sebelah nomornya. Berkasnya
// berubah tanpa nomornya naik = merah, dengan pesan yang menyebutkan persis
// apa yang harus dilakukan.
//
// AKHIRAN BARIS DINORMALKAN sebelum di-hash: checkout di Windows memberi CRLF
// dan di CI LF, dan sidik jari yang berbeda antar mesin adalah tes yang gagal
// tanpa ada yang salah.
//
// `style.css` IKUT walaupun ia milik bersama dengan layar panitia, dan itu
// disengaja: halaman peserta memuat berkas yang sama, jadi perubahan CSS yang
// dikerjakan untuk panitia pun mengubah apa yang harus diambil peserta.
// Konsekuensinya memang mengikat — menyunting style.css berarti menaikkan
// nomor di live/index.html juga. Pemeriksaan yang cuma menjaga dua dari tiga
// berkas akan menutup pertanyaannya sambil membiarkan lubangnya (CLAUDE.md
// 13.3).
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const halaman = await readFile(new URL("../live/index.html", import.meta.url), "utf8");

/** Nomor versi yang sedang tertulis di index.html, beserta sidik jari isi
 *  berkas saat nomor itu dipasang. Ubah KEDUANYA bersama-sama. */
const BERKAS = {
  "live.js": { versi: 20, sidik: "0cec1e3dde68" },
  "live.css": { versi: 8, sidik: "49d72f12ce8f" },
  "style.css": { versi: 68, sidik: "fc1fce32700b" },
};

const sidikIsi = (teks) =>
  createHash("sha256").update(teks.replace(/\r\n/g, "\n")).digest("hex").slice(0, 12);

for (const [nama, { versi, sidik }] of Object.entries(BERKAS)) {
  test(`${nama} dialamati dengan nomor versinya`, () => {
    // Lolos kalau nomornya cocok DAN tidak ada alamat tanpa `?v=` untuk
    // berkas yang sama — alamat polos tidak pernah berganti sama sekali.
    const pola = new RegExp(`${nama.replace(".", "\\.")}\\?v=(\\d+)`);
    const cocok = halaman.match(pola);
    assert.ok(cocok, `${nama} tidak dialamati dengan ?v= di live/index.html`);
    assert.equal(Number(cocok[1]), versi,
      `nomor ${nama} di index.html ${cocok[1]}, di tes ini ${versi}`);
  });

  test(`${nama} tidak berubah tanpa nomornya ikut naik`, async () => {
    const isi = await readFile(new URL(`../live/${nama}`, import.meta.url), "utf8");
    const sekarang = sidikIsi(isi);
    assert.equal(sekarang, sidik, [
      ``,
      `live/${nama} berubah tetapi nomor versinya masih ${versi}.`,
      ``,
      `Naikkan DUA-DUANYA:`,
      `  1. live/index.html  -> ${nama}?v=${versi + 1}`,
      `  2. tes ini          -> { versi: ${versi + 1}, sidik: "${sekarang}" }`,
      ``,
      `Tanpa itu, HP yang tabnya sudah terbuka sejak pagi tetap menjalankan`,
      `berkas lama sampai orangnya memuat ulang sendiri.`,
      ``,
    ].join("\n"));
  });
}
