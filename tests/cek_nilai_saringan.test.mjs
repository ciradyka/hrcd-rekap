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
import { lombaUntukRegu, reguBelumFoto, reguBelumInput, reguBelumKunci }
  from "../web/js/util.js";
import { potongFungsi, sumberPanitia } from "./sumber.mjs";

const app = await sumberPanitia();
const css = await readFile(new URL("../web/style.css", import.meta.url), "utf8");

const layarCek = potongFungsi(app, "async function layarCekNilai()");

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
  assert.match(layarCek, /\(\{ kode, label, jumlah: "" \}\)/,
    "chip saringan tidak punya tempat angka");
  assert.match(layarCek,
    /\.saring-jumlah`\)\s*\.textContent = lembar\.filter\(uji\)\.length;/,
    "jumlah tiap saringan tidak ditulis di chip-nya");
});

test("chip yang ditekan TIDAK dibangun ulang, jadi fokusnya bertahan", () => {
  // Membangun ulang chip yang sedang difokus membuang fokusnya ke <body>, dan
  // Tab berikutnya mulai lagi dari atas halaman. Tombolnya dibangun ulang
  // hanya kalau daftar saringannya berubah ("Belum Foto" datang dan pergi).
  const isi = layarCek.slice(layarCek.indexOf("function isiSaring()"),
                             layarCek.indexOf("async function muatPos()"));
  assert.match(isi, /if \(elSaring\.dataset\.daftar !== daftar\) \{/,
    "chip dibangun ulang di setiap penggambaran");
  assert.match(isi, /tandaiChip\(elSaring, "saring", saring\);/,
    "aria-pressed tidak diperbarui di tempat");
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
  const lomba = [
    { kode: "semaphore", kolom: [{ varian: [{ kode: "semaphore", golongan: null }] }] },
    { kode: "logika", kolom: [
      { varian: [{ kode: "logika", golongan: null }, { kode: "logika_intern", golongan: "intern" }] }] },
    { kode: "khusus-intern", kolom: [{ varian: [{ kode: "khusus", golongan: "intern" }] }] },
  ];
  const ekstern = { golongan: "penegak_pa", nomor_dada: 7,
    nilai: { semaphore: 10, logika: 12 }, lomba_terkunci: ["semaphore", "logika"] };
  const intern = { golongan: "intern_pa", nomor_dada: 1001,
    nilai: { logika_intern: 9 }, lomba_terkunci: ["logika"] };

  assert.deepEqual(lombaUntukRegu(lomba, ekstern).map(l => l.kode), ["semaphore", "logika"]);
  assert.deepEqual(lombaUntukRegu(lomba, intern).map(l => l.kode), ["logika", "khusus-intern"]);

  // Eksternal: semua komponennya terisi dan tergembok — lomba Internal
  // tidak membuatnya "belum".
  assert.equal(reguBelumInput(lomba, ekstern), false);
  assert.equal(reguBelumKunci(lomba, ekstern), false);
  // Internal: nilai lomba khususnya belum ada, gemboknya juga belum.
  assert.equal(reguBelumInput(lomba, intern), true);
  assert.equal(reguBelumKunci(lomba, intern), true);
  assert.equal(reguBelumInput(lomba, { ...intern, nilai: { logika_intern: 9, khusus: 3 } }), false);

  const foto = new Set(["7|semaphore"]);
  assert.equal(reguBelumFoto(lomba, ekstern, foto), true, "Logika belum difoto");
  assert.equal(reguBelumFoto(lomba, ekstern, new Set(["7|semaphore", "7|logika"])), false);
});

test("layar Cek Nilai memakai ketiga uji dari util.js", () => {
  assert.match(layarCek, /const belumInput = \(r\) => reguBelumInput\(lombaPos\(\), r\);/,
    "Belum Input tidak memakai reguBelumInput()");
  assert.match(layarCek, /const belumFoto = \(r\) => reguBelumFoto\(lombaPos\(\), r, fotoAda\);/,
    "Belum Foto tidak memakai reguBelumFoto()");
  assert.match(layarCek, /const belumKunci = \(r\) => reguBelumKunci\(lombaPos\(\), r\);/,
    "Belum Kunci tidak memakai reguBelumKunci()");
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

test("dropdown pos dan chip sebaris, supaya kepala layar tidak tumbuh", () => {
  // Patokan bawaan `.baris-pilih .field` 12rem dan `.baris-pilih` yang
  // membungkus membuat chip-nya turun ke baris kedua di HP, dan kartu
  // kendalinya naik — tinggi yang di layar ini diambil langsung dari foto
  // slip. Dropdown-nya selebar isinya; barisan chip menyerap sisanya dan
  // digulir mendatar.
  assert.match(css, /\.cek-kendali \.baris-pilih \.field \{ flex: 0 0 auto; min-width: 0; \}/,
    "dropdown pos Cek Nilai tidak lagi selebar isinya");
  assert.match(css, /\.cek-kendali \.baris-pilih \{ flex-wrap: nowrap;/,
    "baris kendali Cek Nilai boleh membungkus lagi");
  assert.match(css, /\.cek-saring-baris \{[^}]*flex-wrap: nowrap;[^}]*overflow-x: auto;/,
    "barisan chip Cek Nilai tidak lagi digulir mendatar");
});
