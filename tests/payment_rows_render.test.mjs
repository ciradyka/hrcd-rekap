// Baris Meja Pembayaran benar-benar TERBANGUN, bukan sekadar ter-parse.
//
// KENAPA TES INI ADA
//
// 28 Agustus 2026 layar Meja Pembayaran kosong di produksi: saringan, kotak
// cari, dan "39 invoice · 40 regu" tergambar, lalu tidak ada satu baris pun.
// Sebabnya satu deklarasi yang pindah tempat — `const nota` berakhir di BAWAH
// `const metode`, padahal `metode` menyisipkan `${nota}` ke dalam template-nya.
// `const` yang disentuh sebelum barisnya dijalankan melempar ReferenceError,
// bukan undefined, jadi SELURUH baris gagal dirender sekaligus.
//
// Yang membuatnya lolos, dan kenapa tes ini berbentuk begini:
//
//   * `node --check` LULUS. Temporal dead zone itu galat saat DIJALANKAN,
//     bukan saat di-parse — celah yang sama persis dengan yang ditutup
//     tools/periksa_impor.py untuk import yang hilang.
//   * Angka "39 invoice" tetap benar, karena ia dihitung dari data yang sudah
//     diterima, bukan dari barisnya. Layarnya terbaca seperti daftar yang
//     memang kosong, bukan seperti kerusakan.
//   * Seluruh pengukuran tata letak hari itu dikerjakan di halaman contoh
//     berisi markup STATIS. Tidak ada satu langkah pun yang menjalankan
//     app.js.
//
// Jadi yang diuji di sini bukan hasil HTML-nya melainkan bahwa blok itu
// SELESAI DIJALANKAN untuk keempat bentuk baris yang ada. Pemeriksaan isinya
// dibuat longgar dengan sengaja: yang mahal kalau salah baris yang hilang,
// bukan kelas CSS yang berganti nama.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");


/** Potong blok `baris.map(b => { ... }).join("")` dari layarPembayaran(). */
function blokPembangunBaris() {
  // Dicari MULAI DARI layarPembayaran(), bukan dari awal berkas. Layar Data
  // Peserta memakai potongan pembuka yang sama persis dan berada lebih dulu
  // di app.js — tanpa jangkar ini, tes Pembayaran diam-diam menguji blok milik
  // layar lain. Yang menemukannya tes ini sendiri, saat layar itu ditambahkan.
  const layar = app.indexOf("async function layarPembayaran() {");
  assert.notEqual(layar, -1, "layarPembayaran() tidak ditemukan di app.js");
  const mulai = app.indexOf("tbody.replaceChildren(h(baris.map(b => {", layar);
  assert.notEqual(mulai, -1,
    "blok pembangun baris Meja Pembayaran tidak ditemukan — kalau bentuknya " +
    "berubah, sesuaikan potongan ini, JANGAN hapus tesnya");
  const akhir = app.indexOf('}).join("")));', mulai);
  assert.notEqual(akhir, -1, "ujung blok pembangun baris tidak ditemukan");

  return app.slice(mulai, akhir)
    .replace("tbody.replaceChildren(h(baris.map(b => {", "const HASIL = baris.map(b => {")
    + '}).join(""); return HASIL;';
}


/* Tiruan seadanya. Yang ditiru cuma yang DIPANGGIL blok itu; kalau ia mulai
   memanggil yang lain, tes ini gagal dengan "x is not defined" — dan itu
   memang laporan yang benar, bukan gangguan. */
const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const html = (s, ...v) =>
  s.reduce((a, p, i) => a + p + (i < v.length ? esc(v[i]) : ""), "");

const TIRUAN = {
  esc,
  html,
  ikon: () => "<svg></svg>",
  rupiah: (n) => "Rp " + Number(n).toLocaleString("id-ID"),
  reguAktif: (b) => b.regu.filter((r) => !r.batal),
  totalBiaya: () => 175000,
  biayaRegu: () => 175000,
  GOLONGAN_LABEL: { penegak_pa: "Penegak PA", penggalang_pi: "Penggalang PI" },
  EDISI: { biaya_per_regu: 175000 },
  dibuka: new Set(),
};

// Keempat bentuk yang benar-benar ada di layar, termasuk yang batal — dan
// satu lunas TANPA bukti, karena cabang tanpa nota punya tata letaknya sendiri.
const BARIS = [
  { kode_pembayaran: "HRCD37-AAA111", status: "lunas", metode_bayar: "transfer",
    bukti_transfer: "https://drive.google.com/file/d/XYZ/view",
    pembayaran: { method: "transfer" }, sekolah: { name: "MA Bahrul Anwar" },
    regu: [{ nama_regu: "ASTRA JINGGA", nama_ketua: "Azmi", golongan: "penegak_pa", batal: false }] },
  { kode_pembayaran: "HRCD37-BBB222", status: "lunas", metode_bayar: null,
    bukti_transfer: null, pembayaran: { method: "tunai" },
    sekolah: { name: "SMPN 1 Cimaragas" },
    regu: [{ nama_regu: "MATAHARI", nama_ketua: "Adia", golongan: "penggalang_pi", batal: false }] },
  { kode_pembayaran: "HRCD37-CCC333", status: "menunggu_pembayaran",
    metode_bayar: "transfer", bukti_transfer: "https://drive.google.com/file/d/ABC/view",
    pembayaran: null, sekolah: { name: "MTs Al-Hasan Banjarsari" },
    regu: [{ nama_regu: "GARUDA", nama_ketua: "Yoki", golongan: "penegak_pa", batal: false }] },
  { kode_pembayaran: "HRCD37-DDD444", status: "batal", metode_bayar: null,
    bukti_transfer: null, pembayaran: null, sekolah: { name: "SMPN 3 Kawali" },
    regu: [{ nama_regu: "ALAMANDA", nama_ketua: "Sani", golongan: "penggalang_pi", batal: true }] },
];


function bangun(baris = BARIS) {
  const nama = Object.keys(TIRUAN);
  // eslint-disable-next-line no-new-func
  const jalan = new Function("baris", ...nama, blokPembangunBaris());
  return jalan(baris, ...nama.map((n) => TIRUAN[n]));
}


test("blok pembangun baris berjalan sampai selesai untuk keempat bentuk", () => {
  // Kalau ada `const` yang dipakai sebelum dideklarasikan, panggilan ini
  // melempar ReferenceError di sini — bukan diam-diam di HP petugas.
  const keluaran = bangun();
  const jumlah = (pola) => (keluaran.match(pola) || []).length;

  assert.equal(jumlah(/<tr class="invoice-row"/g), 4, "empat baris invoice");
  assert.equal(jumlah(/badge-green">LUNAS/g), 2, "dua lencana LUNAS");
  assert.equal(jumlah(/badge-red">BATAL/g), 1, "satu lencana BATAL");
  assert.equal(jumlah(/data-metode=/g), 1, "satu dropdown cara bayar");
});


test("tombol nota muncul hanya untuk baris yang punya buktinya", () => {
  const keluaran = bangun();
  assert.equal((keluaran.match(/data-bukti=/g) || []).length, 2,
    "dua tombol nota: satu baris lunas, satu baris belum lunas");

  const tanpaBukti = bangun(BARIS.map((b) => ({ ...b, bukti_transfer: null })));
  assert.equal((tanpaBukti.match(/data-bukti=/g) || []).length, 0,
    "tanpa bukti, tombolnya tidak digambar sama sekali");
});


test("tombol nota duduk di kolom Metode, bukan di kolom tombol", () => {
  // Ditetapkan pemilik acara: notanya di sebelah "Transfer LUNAS", karena ia
  // keterangan tentang pembayaran — bukan aksi ketiga sejajar Kwitansi dan
  // Batalkan.
  const rapat = bangun().replace(/\s+/g, " ");
  assert.match(rapat, /badge-green">LUNAS<\/span><button[^>]*data-bukti/,
    "di baris lunas, nota harus tepat sesudah lencana LUNAS");
  assert.match(rapat, /<\/select><button[^>]*data-bukti/,
    "di baris belum lunas, nota harus tepat sesudah dropdown cara bayar");
  assert.doesNotMatch(rapat, /data-batal-bayar=[^>]*>Batalkan<\/button> <button[^>]*data-bukti/,
    "nota tidak boleh kembali ke kolom tombol");
});
