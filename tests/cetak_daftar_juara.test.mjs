// ============================================================================
// hrcd-rekap : tests/cetak_daftar_juara.test.mjs
// Daftar juara di atas kertas.
//
// Dua pemakaian, dan keduanya menuntut kertas: dibacakan di panggung saat
// pengumuman, lalu jadi dasar menulis sertifikat. Sampai 2 September 2026
// layar Kejuaraan satu-satunya layar berisi hasil yang TIDAK punya tombol
// cetak — sembilan layar lain punya — jadi satu-satunya cara mengeluarkannya
// adalah tangkapan layar HP.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../web/style.css", import.meta.url), "utf8");

const pembuat = app.slice(app.indexOf("function siapkanCetakJuara("),
                          app.indexOf("async function layarKejuaraan()"));
const layar = app.slice(app.indexOf("async function layarKejuaraan()"),
                        app.indexOf("async function layarPengaturanKloter()") > 0
                          ? app.indexOf("const RUTE = {") : undefined);

test("bagian DIPINJAM dari layarnya, bukan ditulis ulang", () => {
  // Dua daftar penghargaan yang harus ikut benar setiap kali satu gelar
  // ditambah adalah dua daftar yang suatu hari berselisih — dan yang
  // berselisih di sini terbaca di panggung.
  assert.match(pembuat, /function siapkanCetakJuara\(hasil, bagian\) \{/,
    "pembuat cetakan tidak menerima daftar bagian dari layarnya");
  assert.match(layar, /siapkanCetakJuara\(hasil, bagian\);/,
    "layar tidak mengoper daftar bagiannya sendiri ke pembuat cetakan");
  assert.equal((pembuat.match(/Juara Umum Penegak/g) || []).length, 0,
    "nama bagian ditulis ulang di pembuat cetakan");
});

test("window.print() tetap di dalam giliran ketukan", () => {
  // Safari iPhone memblokirnya begitu ada satu `await` lebih dulu: sesudah itu
  // panggilannya tidak lagi dianggap datang dari pengguna. Aturan yang sama
  // dengan kedua tombol cetak Live Score dan tombol cetak Daftar Kloter.
  const awal = layar.indexOf('getElementById("cetak-juara")');
  assert.ok(awal > 0, "tombol Cetak Daftar Juara tidak dipasangi pendengar");
  const pendengar = layar.slice(awal, layar.indexOf("});", awal) + 3);
  assert.doesNotMatch(pendengar, /await/,
    "ada await sebelum window.print() — Safari iPhone memblokirnya");
  assert.match(pendengar, /siapkanCetakJuara\(hasil, bagian\);\s*\n\s*window\.print\(\);/,
    "cetakan tidak dibangun tepat sebelum print()");
});

test("gelar yang belum ada juaranya IKUT dicetak", () => {
  // Pembawa acara yang menemukan gelar kosong di atas panggung tidak punya
  // jalan keluar; yang menemukannya di kertas, sebelum naik, masih punya.
  assert.match(pembuat, /Belum ditentukan/,
    "gelar tanpa juara tidak punya tulisan apa pun di kertas");
  assert.doesNotMatch(pembuat, /\.filter\(x => x\.nama_regu\)/,
    "gelar tanpa juara disaring keluar dari cetakan");
  // Dan tidak diredupkan: bedanya dari yang terisi cukup dari tebalnya.
  assert.match(css, /\.juara-kosong \{ font-size: 11pt; \}/,
    "tulisan 'Belum ditentukan' diberi gaya yang meredupkannya");
});

test("kolom kanan berarti SATU hal: total skor regu", () => {
  // Diisi juga untuk penghargaan sekolah, hasilnya angka yang sama tercetak
  // dua kali bersebelahan — "42" di kolom kanan dan "42 poin juara" tepat di
  // sebelahnya (bagian 9.3).
  assert.match(pembuat,
    /const angka = \(x\) => \(x\.nama_regu && x\.total != null\) \? angkaRapi\(x\.total\) : "";/,
    "kolom skor kembali diisi angka yang satuannya berbeda-beda");
});

test("tanpa baris kepala yang diulang sebelas kali", () => {
  // Terukur: sebelas baris kepala memakan 88mm — sepertiga halaman A4 — untuk
  // mengulang tiga kata yang sudah terbaca dari bentuk kolomnya sendiri.
  // Dokumennya turun dari 4 halaman jadi 3.
  assert.doesNotMatch(pembuat, /<thead>/,
    "baris kepala kembali di tabel daftar juara");
});

test("satu bagian tidak boleh terbelah dua halaman", () => {
  // Gelar "Juara 1" yang tertinggal sendirian di kaki halaman, dengan namanya
  // di halaman berikutnya, adalah kesalahan yang mahal saat dibacakan.
  assert.match(css, /\.juara-bagian \{ break-inside: avoid; page-break-inside: avoid; \}/,
    "bagian daftar juara boleh terbelah antar halaman");
  // Satu dokumen mengalir, BUKAN satu lembar per bagian: sebelas bagian
  // berarti sebelas lembar yang dibolak-balik di podium.
  assert.equal((pembuat.match(/class="print-page"/g) || []).length, 1,
    "daftar juara dipecah jadi lebih dari satu lembar paksa");
});

test("kertasnya menuruti aturan fotokopi", () => {
  // Bagian 8: tanpa raster abu, tanpa blok hitam, tanpa teks terbalik; yang
  // harus mundur dibuat KECIL dan hitam pekat, bukan pucat.
  const blok = css.slice(css.indexOf("/* ---- Daftar juara ----"),
                         css.indexOf(".print-note { font-size: 9pt;"));
  assert.ok(blok.length > 0, "blok CSS daftar juara tidak ditemukan");
  assert.doesNotMatch(blok, /background|color:\s*#(?!000)/,
    "ada latar atau warna selain hitam di cetakan daftar juara");
  // Huruf terkecil di kertas ini 9pt — batas bawahnya 7pt (bagian 8.6).
  for (const m of blok.matchAll(/font-size: ([\d.]+)pt/g)) {
    assert.ok(Number(m[1]) >= 7, `ada huruf ${m[1]}pt di kertas, di bawah batas 7pt`);
  }
});

/** Kode tanpa komentar. Alasan tiap aturan di bawah justru ditulis sebagai
 *  komentar tepat di atas kodenya, lengkap dengan nama yang dicari — dan
 *  penjaga yang menemukannya di komentar tidak menjaga apa pun. */
const tanpaKomentar = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
const kodePembuat = tanpaKomentar(pembuat);
const kodeLayar = tanpaKomentar(layar);

test("urutan bacanya menempel di bagian layarnya, bukan jadi daftar kedua", () => {
  // Daftar penghargaan yang ditulis dua kali adalah daftar yang suatu hari
  // berselisih, dan yang berselisih di sini dibacakan di depan orang banyak.
  // Angka urutnya jadi unsur kelima tiap bagian; pembuat cetakan cuma
  // mengurutkannya.
  assert.ok(kodePembuat.includes("[...bagian].sort((a, b) => a[4] - b[4])"),
    "pembuat cetakan tidak mengurutkan bagian menurut angka urut bacanya");

  // Urutan panggung yang diminta pemilik acara, 2 September 2026: penghargaan
  // pilihan dulu, juara per golongan (Penggalang sebelum Penegak, putri
  // sebelum putra), lalu Juara Umum sebagai puncaknya.
  const awal = kodeLayar.indexOf("const bagian = [");
  assert.ok(awal > 0, "daftar bagian tidak ditemukan di layar Kejuaraan");
  const daftar = kodeLayar.slice(awal, kodeLayar.indexOf("];", awal));
  for (const [tanda, urut] of [
    ['"kejuaraan-terfavorit kejuaraan-pilihan", 1', "Peserta Terfavorit ke-1"],
    ['"kejuaraan-kostum kejuaraan-pilihan", 2', "Juara Kostum ke-2"],
    ['"kejuaraan-yel-yel", 3', "Juara Yel Yel ke-3"],
    ['"kejuaraan-khusus kejuaraan-pilihan", 4', "Penghargaan Khusus ke-4"],
    ['gelarGolongan("penggalang_pi", "kejuaraan-penggalang-pi", 5)', "Penggalang PI ke-5"],
    ['gelarGolongan("penggalang_pa", "kejuaraan-penggalang-pa", 6)', "Penggalang PA ke-6"],
    ['gelarGolongan("penegak_pi", "kejuaraan-penegak-pi", 7)', "Penegak PI ke-7"],
    ['gelarGolongan("penegak_pa", "kejuaraan-penegak-pa", 8)', "Penegak PA ke-8"],
    ['"kejuaraan-umum-penggalang", 9', "Juara Umum Penggalang ke-9"],
    ['"kejuaraan-umum-penegak", 10', "Juara Umum Penegak ke-10"],
    ['"kejuaraan-umum", 11', "Juara Umum ke-11"],
  ]) {
    assert.ok(daftar.includes(tanda), `urutan baca berubah: ${urut}`);
  }
});

test("satu aturan mengurutkan baris di ketiga bentuk bagian", () => {
  // penggalang_pi_6       golongan + peringkat -> Harapan III dulu
  // kostum_penggalang_pi  golongan saja        -> urut golongan
  // terjauh               keduanya tidak ada   -> biarkan apa adanya
  assert.ok(kodePembuat.includes("x.kode.match(/_(\\d+)$/)"),
    "peringkat tidak dibaca dari ekor kode penghargaan");
  assert.ok(kodePembuat.includes("p ? -Number(p[1]) : 0"),
    "peringkat tidak dibalik — Juara I akan dibacakan lebih dulu, bukan terakhir");
  assert.ok(kodePembuat.includes("const ka = kunciBaca(a), kb = kunciBaca(b);"),
    "baris di dalam bagian tidak diurutkan ulang untuk dibacakan");
});

test("urutan BACA bukan salinan urutan TAMPIL", () => {
  // util.js memegang urutan tampil (tab Live Score, kolom rekap). Yang di sini
  // urutan dibacakan: putri lebih dulu di tiap tingkat, Penggalang sebelum
  // Penegak. Dua fakta berbeda yang kebetulan sama bentuknya — dan mengganti
  // yang ini dengan URUT_GOLONGAN akan membalik urutan pengumuman.
  assert.ok(kodePembuat.includes(
    '["penggalang_pi", "penggalang_pa", "penegak_pi", "penegak_pa"]'),
    "urutan baca golongan berubah");
  assert.ok(!kodePembuat.includes("URUT_GOLONGAN"),
    "urutan baca diganti dengan urutan tampil dari util.js");
});

test("layarnya TIDAK ikut dibalik", () => {
  // Layar dipakai memeriksa: yang dicari mata Juara I, jadi ia tetap di atas.
  // Yang dibalik cuma kertasnya.
  assert.ok(kodeLayar.includes("${bagian.map(([judul, masuk, label, kelas]) => `"),
    "layar Kejuaraan tidak lagi menggambar bagiannya apa adanya");
});
