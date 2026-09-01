// ============================================================================
// hrcd-rekap : tests/cek_nilai_saringan.test.mjs
// Saringan Cek Nilai: "mana yang masih perlu dikerjakan?"
//
// Layar ini berjalan SATU REGU pada satu waktu, jadi saringan di sini bukan
// daftar melainkan jalur panah: yang tersaring keluar dilewati, dan yang
// tersisa jadi antrean kerja. "Belum Kunci" dengan begitu berubah jadi
// tumpukan yang tinggal dihabiskan.
//
// Diminta pemilik acara, 2 September 2026, beserta pertanyaan di mana
// tempatnya. Jawabannya di SINI, karena di sinilah gembok dipasang (0166) dan
// di sinilah regu ditelusuri satu per satu. Lembar Input Nilai Tabel sudah
// punya "Belum Input" dan "Belum Foto" sendiri; ia TIDAK diberi "Belum Kunci"
// karena penanda barisnya berarti "ADA lomba pos ini yang tergembok", bukan
// "semuanya tergembok" — chip yang dibangun di atasnya akan berselisih dengan
// layar ini tentang regu yang sama (CLAUDE.md 13.3).
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../web/style.css", import.meta.url), "utf8");

const layarCek = (() => {
  const awal = app.indexOf("async function layarCekNilai()");
  return app.slice(awal, app.indexOf("const RUTE = {", awal));
})();

test("empat saringan, dan angkanya ikut di dalam pilihannya", () => {
  assert.match(layarCek, /\["semua", "Semua", \(\) => true\]/, "saringan Semua hilang");
  for (const [kode, label] of [
    ["belum-input", "Belum Input"], ["belum-foto", "Belum Foto"],
    ["belum-kunci", "Belum Kunci"],
  ]) {
    assert.ok(layarCek.includes(`["${kode}", "${label}",`), `saringan ${label} hilang`);
  }
  // Tanpa angkanya, petugas harus menekan panah sampai mentok untuk tahu
  // berapa yang tersisa.
  assert.match(layarCek, /\$\{esc\(label\)\} \(\$\{lembar\.filter\(uji\)\.length\}\)/,
    "jumlah tiap saringan tidak ditulis di pilihannya");
});

test("saringan MELEWATI, tidak membuang barisnya", () => {
  // Kotak nomor dada harus tetap bisa melompat ke regu mana pun, termasuk yang
  // tersaring keluar: petugas yang mengetik 042 sedang memegang regu 042 di
  // depannya.
  assert.match(layarCek, /const tetangga = \(arah\) => \{/,
    "panah tidak lagi mencari tetangga yang lolos saringan");
  assert.match(layarCek, /if \(cocokSaring\(lembar\[i\]\)\) return i;/,
    "pencarian tetangga tidak memeriksa saringan");
  assert.match(layarCek, /elMundur\.addEventListener\("click", \(\) => geser\(-1\)/,
    "panah mundur tidak lewat geser()");
  assert.match(layarCek, /elMaju\.addEventListener\("click", \(\) => geser\(1\)/,
    "panah maju tidak lewat geser()");
  // Lompat lewat kotak nomor dada TIDAK boleh ikut disaring.
  const lompat = layarCek.slice(layarCek.indexOf("const lompat = ("));
  assert.match(lompat.slice(0, lompat.indexOf("};")), /ke\(i\);/,
    "lompat ke nomor dada ikut tersaring");
});

test("panah mati mengikuti saringan, bukan ujung daftar", () => {
  assert.match(layarCek, /elMundur\.disabled = tetangga\(-1\) < 0;/,
    "panah mundur masih memakai ujung daftar penuh");
  assert.match(layarCek, /elMaju\.disabled = tetangga\(1\) < 0;/,
    "panah maju masih memakai ujung daftar penuh");
});

test("yang berlaku dibatasi golongan regunya", () => {
  // Komponen dan lomba yang bukan urusan golongan itu tidak boleh dihitung
  // sebagai pekerjaan yang belum selesai — aturan yang sama dengan
  // gambarKunci() dan statusAwal().
  assert.match(layarCek, /const lombaBerlaku = \(r\) => lombaPos\(\)\.filter\(l =>\s*\n\s*l\.kolom\.some\(kol => varianUntuk\(kol, r\.golongan\)\)\);/,
    "lomba yang berlaku tidak disaring per golongan");
  assert.match(layarCek, /\.map\(kol => varianUntuk\(kol, r\.golongan\)\)\.filter\(Boolean\)/,
    "komponen yang berlaku tidak disaring per golongan");
});

test("daftar foto sepos diambil SEKALI, bukan per regu", () => {
  // daftarFotoLembar() menjawab satu regu per permintaan; saringan ini
  // menanyakannya untuk ratusan regu sekaligus.
  assert.match(layarCek, /fotoLembarPos\(nomorPos\)\.catch\(\(\) => null\)/,
    "daftar foto sepos tidak diambil sekali di muatPos");
  assert.match(layarCek, /fotoAda = new Set\(\(foto \|\| \[\]\)\.map\(f => `\$\{f\.nomor_dada\}\|\$\{f\.kode_lomba\}`\)\);/,
    "kunci foto bukan pasangan nomor dada + kode lomba");
});

test("saringan foto HILANG kalau daftar fotonya gagal dibaca", () => {
  // Menyisakannya berarti menandai seluruh regu belum difoto — tuduhan
  // terhadap pekerjaan yang mungkin sudah selesai, aturan yang sama dengan
  // "foto tidak terbaca" di petak fotonya.
  assert.match(layarCek, /fotoTerbaca = foto !== null;/,
    "gagal baca daftar foto tidak dibedakan dari 'tidak ada foto'");
  assert.match(layarCek,
    /SARING\.filter\(\(\[kode\]\) => fotoTerbaca \|\| kode !== "belum-foto"\)/,
    "saringan Belum Foto tetap ditawarkan walau daftarnya tidak terbaca");
  assert.match(layarCek, /if \(!pakai\.some\(\(\[kode\]\) => kode === saring\)\) saring = "semua";/,
    "saringan yang hilang tidak dikembalikan ke Semua");
});

test("katalog lomba disimpan, tidak disusun ulang per regu", () => {
  // Saringan memanggilnya sekali untuk SETIAP regu dikali empat saringan.
  assert.match(layarCek, /const lombaPos = \(\) => \(lombaCache \|\|= katalogLomba\(/,
    "katalog lomba disusun ulang tiap panggilan");
  assert.match(layarCek, /lombaCache = null;/,
    "simpanan katalog tidak dikosongkan saat pos berganti");
});

test("kedua dropdown sebaris, supaya kepala layar tidak tumbuh", () => {
  // Patokan bawaan `.baris-pilih .field` 12rem membuat keduanya menumpuk di
  // 393px dan kartu kendalinya naik dari 116px jadi 177px — tinggi yang di
  // layar ini diambil langsung dari foto slip.
  assert.match(css, /\.cek-kendali \.baris-pilih \.field \{ flex: 1 1 0; min-width: 0; \}/,
    "dua dropdown Cek Nilai tidak lagi dipaksa sebaris");
});
