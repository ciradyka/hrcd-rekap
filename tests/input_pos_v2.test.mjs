// ============================================================================
// hrcd-rekap : tests/input_pos_v2.test.mjs
// Helper layar Input Nilai Pos v2: bentuk pengisian tiap lomba, katalog lomba
// lintas pos, dan pembacaan stopwatch.
// ============================================================================

import assert from "node:assert/strict";
import test from "node:test";

import { jenisLomba, katalogLomba, stopwatchTeks, detikDariMs, periksaJawabSimpan }
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

// Bentuk "soal" sudah dibuang 1 September 2026: lomba soal tulis memakai layar
// yang sama dengan Semaphore. Tesnya dibalik, bukan dihapus — yang perlu
// dijaga justru bahwa `type = 'soal'` TIDAK lagi melahirkan bentuk sendiri.
test("lomba bertipe soal memakai bentuk nilai, sama seperti Semaphore", () => {
  assert.equal(jenisLomba(lomba(w({ kode: "logika", type: "soal" }))), "nilai");
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
    [["Semaphore", "nilai"], ["Logika", "nilai"], ["Bakiak", "waktu"]]);
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
   periksaJawabSimpan — satu-satunya hal yang berdiri antara "nilainya masuk"
   dan "layar berkata nilainya masuk".

   Salah di sini tidak menghasilkan galat apa pun: angkanya hilang sambil
   semua orang mengira sudah tersimpan. Itu sebabnya ia diuji mesin dan bukan
   dicoba tangan sekali lalu dipercaya selamanya.
   ---------------------------------------------------------------------- */

const ok = (n) => Array.from({ length: n }, () => ({ status: "tersimpan" }));

test("semua tersimpan dan jumlahnya sama = berhasil", () => {
  assert.deepEqual(periksaJawabSimpan(1, ok(1)), { ok: true });
  assert.deepEqual(periksaJawabSimpan(5, ok(5)), { ok: true });
});

// Ditolak server tidak boleh diantre: menunggu tidak mengubah jawabannya, dan
// satu baris rusak akan menyumbat antrean di belakangnya selamanya.
test("satu baris ditolak = gagal, dan gagalnya DARI SERVER", () => {
  const j = periksaJawabSimpan(2,
    [{ status: "tersimpan" }, { status: "ditolak", alasan: "di luar rentang" }]);
  assert.equal(j.ok, false);
  assert.equal(j.dariServer, true);
  assert.equal(j.alasan, "di luar rentang");
});

test("ditolak tanpa alasan tetap punya kalimat", () => {
  const j = periksaJawabSimpan(1, [{ status: "ditolak" }]);
  assert.equal(j.ok, false);
  assert.equal(j.dariServer, true);
  assert.match(j.alasan, /ditolak/);
});

// Yang menangkap status ketiga yang lahir tahun depan tanpa menyentuh kode.
test("status yang tidak dikenal diperlakukan sebagai gagal", () => {
  const j = periksaJawabSimpan(1, [{ status: "tertunda" }]);
  assert.equal(j.ok, false);
  assert.equal(j.dariServer, true);
});

// RPC mengembalikan satu baris hasil per baris masuk. Jawaban yang lebih
// pendek berarti ada yang tidak diproses sama sekali.
test("jawaban lebih pendek daripada yang dikirim = gagal", () => {
  const j = periksaJawabSimpan(3, ok(2));
  assert.equal(j.ok, false);
  assert.match(j.alasan, /tidak lengkap/);
});

test("jawaban lebih panjang juga gagal", () => {
  assert.equal(periksaJawabSimpan(1, ok(2)).ok, false);
});

// Jawaban tidak lengkap adalah keanehan yang mungkin sementara, jadi ia
// diantre seperti gagal jaringan — arah yang aman adalah mencoba lagi, bukan
// membuang angkanya.
test("jawaban tidak lengkap BUKAN dari server, jadi boleh diantre", () => {
  assert.equal(periksaJawabSimpan(3, ok(2)).dariServer, false);
});

test("jawaban kosong atau bukan larik = gagal, bukan berhasil", () => {
  for (const buruk of [null, undefined, [], {}, "tersimpan", 0]) {
    assert.equal(periksaJawabSimpan(1, buruk).ok, false, JSON.stringify(buruk));
  }
});

// Larik berisi null pernah lolos `x.status !== "tersimpan"` sebagai lemparan
// TypeError, bukan sebagai penolakan; yang dilempar di tengah putaran kirim
// akan terbaca sebagai gagal jaringan dan diantre selamanya.
test("baris null di dalam jawaban tidak melempar", () => {
  const j = periksaJawabSimpan(2, [{ status: "tersimpan" }, null]);
  assert.equal(j.ok, false);
  assert.equal(j.dariServer, true);
});

