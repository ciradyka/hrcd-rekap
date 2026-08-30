// ============================================================================
// hrcd-rekap : tests/input_pos_v2.test.mjs
// Helper layar Input Nilai Pos v2: bentuk pengisian tiap lomba, katalog lomba
// lintas pos, dan pembacaan stopwatch.
// ============================================================================

import assert from "node:assert/strict";
import test from "node:test";

import { jenisLomba, katalogLomba, stopwatchTeks, detikDariMs, bisaTombolAngka }
  from "../web/js/util.js";

/** Baris `wahana` seperti yang dikirim komponenSemua(). */
const w = (o) => ({
  pos: 1, kode: "x", name: "X", type: "wahana", form: "besar_baik",
  satuan: null, golongan: null, lomba: null, kode_lomba: null,
  total_soal: null, rentang_mentah_min: 0, rentang_mentah_maks: 100,
  sort_order: 1, ...o,
});

const lomba = (...varian) => ({ kolom: varian.map(k => ({ varian: [k] })) });

/* -------------------------------------------------------------------------
   jenisLomba — dibaca dari KONFIGURASI, bukan dari nama lombanya.
   ---------------------------------------------------------------------- */

test("lomba bersatuan detik adalah lomba waktu", () => {
  assert.equal(jenisLomba(lomba(w({ kode: "bakiak", satuan: "detik" }))), "waktu");
});

test("lomba bertipe soal adalah lomba soal", () => {
  assert.equal(jenisLomba(lomba(w({ kode: "logika", type: "soal" }))), "soal");
});

test("lomba juri berkriteria banyak jatuh ke bentuk nilai", () => {
  const bidai = lomba(
    w({ kode: "bidai_teknik", lomba: "Pembidaian" }),
    w({ kode: "bidai_posisi", lomba: "Pembidaian" }),
  );
  assert.equal(jenisLomba(bidai), "nilai");
});

// Kalau satu kriteria saja bukan waktu, seluruh lombanya bukan lomba waktu —
// stopwatch yang mengisi satu dari tiga kotak lebih menyesatkan daripada
// tidak ada stopwatch sama sekali.
test("campuran detik dan bukan detik bukan lomba waktu", () => {
  const campur = lomba(
    w({ kode: "a", satuan: "detik" }),
    w({ kode: "b" }),
  );
  assert.equal(jenisLomba(campur), "nilai");
});

// `every` atas larik kosong bernilai true, jadi tanpa pagar jumlah kolom
// sebuah lomba tanpa komponen akan mengaku sebagai lomba waktu — dan layar
// menggambar stopwatch yang tidak punya kotak untuk diisi.
test("lomba tanpa komponen tidak mengaku sebagai lomba waktu", () => {
  assert.equal(jenisLomba({ kolom: [] }), "nilai");
  assert.equal(jenisLomba({}), "nilai");
});

/* -------------------------------------------------------------------------
   katalogLomba
   ---------------------------------------------------------------------- */

const POS = [
  { nomor: 0, name: "Keberangkatan", bayangan: false },
  { nomor: 1, name: "Kepramukaan", bayangan: false },
  { nomor: 2, name: "Halang Rintang", bayangan: false },
];

test("pos tanpa komponen tidak muncul di katalog", () => {
  const k = katalogLomba(POS, [
    w({ pos: 1, kode: "semaphore", name: "Semaphore", kode_lomba: "semaphore" }),
  ]);
  assert.deepEqual(k.map(l => l.pos), [1]);
});

test("satu baris per lomba, bukan per komponen", () => {
  // Pembidaian lima kriteria = SATU lomba (CLAUDE.md 11.6), dan Tebak Simpul
  // empat baris golongan juga satu.
  const k = katalogLomba([{ nomor: 3, name: "P3K", bayangan: false }], [
    w({ pos: 3, kode: "bidai_teknik", name: "Teknik Bidai", lomba: "Pembidaian",
        kode_lomba: "teknik-bidai", sort_order: 1 }),
    w({ pos: 3, kode: "bidai_posisi", name: "Posisi Bidai", lomba: "Pembidaian",
        kode_lomba: "posisi-bidai", sort_order: 2 }),
    w({ pos: 3, kode: "ts_pg", name: "Tebak Simpul", golongan: "penggalang_pa",
        kode_lomba: "tebak-simpul", sort_order: 3 }),
    w({ pos: 3, kode: "ts_pn", name: "Tebak Simpul", golongan: "penegak_pa",
        kode_lomba: "tebak-simpul", sort_order: 3 }),
  ]);
  assert.deepEqual(k.map(l => l.nama), ["Pembidaian", "Tebak Simpul"]);
  assert.equal(k[0].kolom.length, 2);
  assert.equal(k[1].kolom[0].varian.length, 2);
});

// Inilah sebabnya `kunci` menggabungkan pos DAN kode. "kekompakan" sudah
// dipakai PBB di Pos 4 dan Yel-Yel di Pos 5 pada edisi yang berjalan
// sekarang; kode lomba saja akan membuat memilih yang satu membuka yang lain.
test("kode lomba yang sama di dua pos tetap dua kunci berbeda", () => {
  const k = katalogLomba(
    [{ nomor: 4, name: "PBB", bayangan: false },
     { nomor: 5, name: "Yel-Yel", bayangan: false }],
    [
      w({ pos: 4, kode: "pbb_kekompakan", name: "Kekompakan", lomba: "PBB",
          kode_lomba: "kekompakan" }),
      w({ pos: 5, kode: "yel_kekompakan", name: "Kekompakan", lomba: "Yel-Yel",
          kode_lomba: "kekompakan" }),
    ]);
  assert.deepEqual(k.map(l => l.kunci), ["4:kekompakan", "5:kekompakan"]);
  assert.equal(new Set(k.map(l => l.kunci)).size, 2);
});

test("jenis pengisian ikut di tiap baris katalog", () => {
  const k = katalogLomba(POS, [
    w({ pos: 1, kode: "semaphore", name: "Semaphore", kode_lomba: "semaphore",
        sort_order: 1 }),
    w({ pos: 1, kode: "logika", name: "Logika", type: "soal",
        kode_lomba: "logika", sort_order: 2 }),
    w({ pos: 2, kode: "bakiak", name: "Bakiak", satuan: "detik",
        kode_lomba: "bakiak", sort_order: 1 }),
  ]);
  assert.deepEqual(k.map(l => [l.nama, l.jenis]),
    [["Semaphore", "nilai"], ["Logika", "soal"], ["Bakiak", "waktu"]]);
});

test("katalog kosong tidak melempar", () => {
  assert.deepEqual(katalogLomba([], []), []);
  assert.deepEqual(katalogLomba(null, null), []);
});

/* -------------------------------------------------------------------------
   stopwatchTeks & detikDariMs
   ---------------------------------------------------------------------- */

test("bacaan stopwatch memakai bentuk menit:detik yang sama dengan kotaknya", () => {
  assert.equal(stopwatchTeks(0), "00:00.0");
  assert.equal(stopwatchTeks(47300), "00:47.3");
  assert.equal(stopwatchTeks(95000), "01:35.0");
  assert.equal(stopwatchTeks(3599900), "59:59.9");
});

// performance.now() tidak pernah mundur, tapi nilai negatif bisa masuk dari
// pemanggil yang salah. Penunjuk berbunyi "-1:-5.-3" lebih buruk daripada nol.
test("bacaan negatif dibaca nol, bukan angka minus", () => {
  assert.equal(stopwatchTeks(-500), "00:00.0");
  assert.equal(stopwatchTeks(null), "00:00.0");
  assert.equal(stopwatchTeks(undefined), "00:00.0");
});

// Tangga poin Pos 2 berbunyi "sampai 30 detik = 100 poin". Memotong ke bawah
// memberi nilai penuh untuk waktu yang tidak dicapai; yang di batas itulah
// regu yang paling mungkin mempersoalkannya.
test("detik yang disimpan dibulatkan, bukan dipotong", () => {
  assert.equal(detikDariMs(30400), 30);
  assert.equal(detikDariMs(30600), 31);
  assert.equal(detikDariMs(30500), 31);
  assert.equal(detikDariMs(0), 0);
  assert.equal(detikDariMs(-100), 0);
});

/* -------------------------------------------------------------------------
   bisaTombolAngka — kriteria mana yang diisi dengan menekan, bukan mengetik.
   ---------------------------------------------------------------------- */

// Seluruh rentang yang benar-benar dipakai edisi XXXVII, dari yang tersempit
// sampai yang terlebar. Kalau salah satunya jatuh ke kotak ketik, satu lomba
// kembali menuntut papan angka HP di tengah lapangan tanpa ada yang tahu.
test("seluruh rentang lomba edisi ini digambar sebagai tombol", () => {
  for (const [nama, maks] of [
    ["Semaphore", 5], ["Tebak Simpul Penegak", 10], ["Kim Lihat", 10],
    ["Keagamaan", 10], ["Logika", 20], ["Posisi Bidai", 15],
    ["Kecepatan dan Kerja Sama", 20], ["Diagnosis", 25],
    ["Gerakan Dasar", 30], ["Kreativitas", 35],
  ]) {
    assert.equal(bisaTombolAngka(w({ rentang_mentah_maks: maks })), true, nama);
  }
});

// Menaksir menulis SELISIH dalam sentimeter, jadi rentangnya 0-99999999.
// Tanpa pagar ini layar mencoba menggambar seratus juta tombol.
test("Menaksir tetap kotak ketik", () => {
  assert.equal(
    bisaTombolAngka(w({ kode: "menaksir", rentang_mentah_maks: 99999999 })), false);
});

test("bentuk yang sudah punya cara pengisiannya sendiri tidak diganti", () => {
  assert.equal(bisaTombolAngka(w({ form: "biner" })), false);
  assert.equal(bisaTombolAngka(w({ form: "benar_kurang_salah" })), false);
  assert.equal(bisaTombolAngka(w({ satuan: "detik", rentang_mentah_maks: 3600 })), false);
  assert.equal(bisaTombolAngka(w({ satuan: "meter" })), false);
});

// Rentang yang tidak masuk akal tidak boleh menghasilkan larik kosong atau
// putaran yang tidak pernah berhenti di selPilihanAngka().
test("rentang rusak jatuh ke kotak ketik, bukan ke tombol", () => {
  assert.equal(bisaTombolAngka(
    w({ rentang_mentah_min: 5, rentang_mentah_maks: 2 })), false);
  assert.equal(bisaTombolAngka(
    w({ rentang_mentah_min: 0, rentang_mentah_maks: null })), false);
  assert.equal(bisaTombolAngka(
    w({ rentang_mentah_min: 0.5, rentang_mentah_maks: 5 })), false);
});
