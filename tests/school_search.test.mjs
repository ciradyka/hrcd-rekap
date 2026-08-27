// ============================================================================
// hrcd-rekap : tests/school_search.test.mjs
//
// AUTOCOMPLETE SEKOLAH HARUS MENEMUKAN NAMA YANG DIUCAPKAN, BUKAN YANG DITULIS
// DAPODIK.
//
// Dilaporkan dari lapangan 27 Agustus 2026: pembina mengetik "SMA 2",
// "SMAN 2 Ciamis" tidak muncul, dan ia mendaftarkan sekolahnya sendiri sebagai
// `sma 2 ciamis` — baris kembar untuk sekolah yang sudah ada di daftar kurasi.
//
// Sebabnya pencarian lama menuntut ketikan menjadi potongan utuh dari namanya:
// "sma2" bukan potongan dari "sman2ciamis" karena satu huruf `n` di tengah.
// Huruf itulah yang paling sering tidak diucapkan.
//
// Kembar bukan kerapian: ia memecah pencarian, rekap, dan identitas
// pendaftaran (CLAUDE.md 12.9), dan yang membuatnya lahir adalah pencarian
// yang gagal — bukan pembina yang ceroboh.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { cariSekolah, kunciSekolah, skorSekolah } from "../live/js/school-search.mjs";

const modul = await readFile(
  new URL("../live/js/school-search.mjs", import.meta.url), "utf8");
const migrasi0062 = await readFile(
  new URL("../supabase/migrations/0062_sekolah_nama_dapodik.sql", import.meta.url), "utf8");
const daftarJs = await readFile(
  new URL("../live/js/daftar.js", import.meta.url), "utf8");

// Nama sungguhan dari daftar kurasi (migrasi 0063), ditambah satu baris kembar
// yang benar-benar ada di produksi sekarang.
const SEKOLAH = [
  { id: 1, name: "SMAN 2 Ciamis", address: "Jl. KH. Ahmad Dahlan No. 2, Ciamis" },
  { id: 2, name: "SMAN 2 Banjarsari", address: "Cigayam, Banjaranyar" },
  { id: 3, name: "SMAN 1 Ciamis", address: "Jl. Gunung Galuh No. 37, Ciamis" },
  { id: 4, name: "SMPN 1 Ciamis", address: "Jl. Jenderal Sudirman, Ciamis" },
  { id: 5, name: "SMPN 2 Ciamis", address: "Jl. Kertasari, Ciamis" },
  { id: 6, name: "MAN 2 Ciamis", address: "Jl. Cigembor, Ciamis" },
  { id: 7, name: "MA Agrowisata Shaleha", address: "Cisaga, Ciamis" },
  { id: 8, name: "SMK Galuh Rahayu", address: "Sindangkasih, Ciamis" },
  { id: 9, name: "SMA Islam Nurul Fikri", address: "Ciamis" },
  { id: 10, name: "SMAN 18 Garut", address: "Garut" },
  { id: 11, name: "MTsN 2 Ciamis", address: "Jl. Kertasari, Ciamis" },
  // Di luar Ciamis, dan memang tidak ada di daftar kurasi. Ia ada di sini
  // karena disebut waktu perbaikan ini dilaporkan: bentuk rapat tanpa spasi
  // harus ikut jalan untuk sekolah mana pun, bukan cuma yang lokal.
  { id: 12, name: "SMAN 3 Yogyakarta", address: "Yogyakarta" },
  { id: 13, name: "sma 2 ciamis", address: "jl ahmad yani" },   // kembar, buatan pembina
];

const nama = daftar => daftar.map(s => s.name);

test('"SMA 2" menemukan SMAN 2 Ciamis', () => {
  // Laporan aslinya, huruf per huruf. Kalau tes ini gugur, pencariannya
  // kembali menuntut huruf N yang tidak diucapkan siapa pun.
  assert.ok(nama(cariSekolah(SEKOLAH, "sma 2")).includes("SMAN 2 Ciamis"),
    "ketikan yang persis dilaporkan dari lapangan masih tidak menemukannya");
});

test("huruf N boleh hilang di mana saja", () => {
  for (const [ketik, harap] of [
    ["sma 2 ciamis", "SMAN 2 Ciamis"],
    ["smp 1 ciamis", "SMPN 1 Ciamis"],
    ["ma 2 ciamis",  "MAN 2 Ciamis"],
    ["sma 18",       "SMAN 18 Garut"],
  ])
    assert.ok(nama(cariSekolah(SEKOLAH, ketik)).includes(harap),
      `"${ketik}" tidak menemukan ${harap}`);
});

test("nama yang ditulis rapat tanpa spasi tetap ketemu", () => {
  // Diketik di HP, dan spasi adalah yang pertama hilang. Angka yang menempel
  // di huruf dipisahkan lebih dulu, jadi "SMP1Ciamis" dibaca "smp 1 ciamis".
  for (const [ketik, harap] of [
    ["SMP1Ciamis", "SMPN 1 Ciamis"],
    ["SMA3Yogya",  "SMAN 3 Yogyakarta"],
    ["MA2Ciamis",  "MAN 2 Ciamis"],
    ["MTS2CIAMIS", "MTsN 2 Ciamis"],
    ["MA 2Ciamis", "MAN 2 Ciamis"],
  ])
    assert.equal(cariSekolah(SEKOLAH, ketik)[0].name, harap,
      `"${ketik}" tidak menaruh ${harap} di urutan pertama`);
});

test("bentuk panjang, singkat, dan tanpa spasi sama saja", () => {
  for (const ketik of ["SMA Negeri 2 Ciamis", "SMA N 2 Ciamis", "sman2ciamis",
                       "SMAN 2 CIAMIS", "sman 2, ciamis"])
    assert.equal(cariSekolah(SEKOLAH, ketik)[0].name, "SMAN 2 Ciamis",
      `"${ketik}" tidak menaruh SMAN 2 Ciamis di urutan pertama`);
});

test("huruf status Dapodik tetap diabaikan", () => {
  // Sudah benar sejak migrasi 0062 dan tidak boleh hilang saat pencariannya
  // ditulis ulang: S di "MAS" berarti Swasta, bukan bagian nama.
  assert.ok(nama(cariSekolah(SEKOLAH, "MAS Agro")).includes("MA Agrowisata Shaleha"));
  assert.ok(nama(cariSekolah(SEKOLAH, "SMKS Galuh")).includes("SMK Galuh Rahayu"));
});

test("kata boleh diketik sebagian dan tidak harus berurutan", () => {
  assert.ok(nama(cariSekolah(SEKOLAH, "nurul fik")).includes("SMA Islam Nurul Fikri"));
  assert.ok(nama(cariSekolah(SEKOLAH, "ciamis sman 2")).includes("SMAN 2 Ciamis"));
});

test("ejaan yang benar tetap memunculkan baris kembar yang sudah ada", () => {
  // Justru ini yang menahan kembar KETIGA: pembina yang mengetik nama resmi
  // harus melihat baris `sma 2 ciamis` yang sudah terlanjur ada, walau ia
  // duduk di bawah yang ejaannya benar.
  const hasil = nama(cariSekolah(SEKOLAH, "SMAN 2 Ciamis"));
  assert.equal(hasil[0], "SMAN 2 Ciamis");
  assert.ok(hasil.includes("sma 2 ciamis"), "baris kembar tidak ikut muncul");
});

test("yang ejaannya persis duduk di atas yang cuma seawalan", () => {
  assert.equal(cariSekolah(SEKOLAH, "sman 1 ciamis")[0].name, "SMAN 1 Ciamis");
  assert.equal(cariSekolah(SEKOLAH, "smpn 2")[0].name, "SMPN 2 Ciamis");
});

test("angka tidak cocok sebagian", () => {
  // "SMAN 18 Garut" bukan jawaban untuk "sman 1", dan sebaliknya. Nomor
  // sekolah adalah angka utuh, bukan awalan.
  assert.ok(!nama(cariSekolah(SEKOLAH, "sman 1")).includes("SMAN 18 Garut"));
  assert.ok(!nama(cariSekolah(SEKOLAH, "sman 18")).includes("SMAN 1 Ciamis"));
});

test("sekolah yang tidak dimaksud tidak ikut muncul", () => {
  assert.deepEqual(cariSekolah(SEKOLAH, "sman 3 tasikmalaya"), []);
  assert.ok(!nama(cariSekolah(SEKOLAH, "sma 2 ciamis")).includes("SMPN 2 Ciamis"));
});

test("satu kata nama hanya dipakai satu kali", () => {
  assert.equal(skorSekolah("ciamis ciamis", "SMAN 2 Ciamis"), -1);
});

test("ketikan sependek satu huruf tidak menyarankan apa pun", () => {
  // Daftar 189 sekolah yang muncul semua sama tidak bergunanya dengan daftar
  // kosong, dan ia menutupi kartu "sekolahmu belum ada di daftar".
  assert.deepEqual(cariSekolah(SEKOLAH, "s"), []);
  assert.deepEqual(cariSekolah(SEKOLAH, " "), []);
  assert.deepEqual(cariSekolah(SEKOLAH, ""), []);
});

test("jumlah saran dibatasi", () => {
  assert.equal(cariSekolah(SEKOLAH, "ciamis", 6).length, 6);
  assert.equal(cariSekolah(SEKOLAH, "ciamis", 3).length, 3);
});

// ---------------------------------------------------------------------------
// kunciSekolah() adalah cermin kunci_sekolah() di database, dan cermin yang
// menyimpang lebih buruk daripada tidak ada cermin: form akan menganggap dua
// nama sama sementara database membuat baris kedua, atau sebaliknya.
// ---------------------------------------------------------------------------

test("kunciSekolah menyamakan yang PASTI sama", () => {
  const sama = (a, b) => assert.equal(kunciSekolah(a), kunciSekolah(b), `${a} != ${b}`);
  sama("SMP Negeri 1 Ciamis", "SMPN 1 Ciamis");
  sama("SMP N 1 Ciamis", "SMPN 1 Ciamis");
  sama("SMKS Galuh Rahayu", "SMK Galuh Rahayu");
  sama("MAS Al-Kautsar", "MA Al Kautsar");
  sama("SMAN 2 CIAMIS", "sman 2 ciamis");
});

test("kunciSekolah TIDAK menyamakan yang cuma mirip", () => {
  const beda = (a, b) => assert.notEqual(kunciSekolah(a), kunciSekolah(b), `${a} = ${b}`);
  // SMAT/SMAI sengaja dibiarkan (migrasi 0062): membuang T dari "SMA Terpadu
  // X" akan menyamakannya dengan "SMA X", dan itu bisa dua sekolah berbeda.
  beda("SMAT Riyadlul Ulum", "SMA Riyadlul Ulum");
  beda("SMAN 2 Ciamis", "SMAN 2 Banjarsari");
  // Longgarnya pencarian tidak boleh menular ke kunci penyimpanan: "SMA 2"
  // yang diketik sendiri memang baris lain sampai ada yang menggabungkannya.
  beda("SMA 2 Ciamis", "SMAN 2 Ciamis");
});

test("kunciSekolah memakai aturan yang sama persis dengan migrasi 0062", () => {
  // Daftar jenjangnya yang paling mudah menyimpang — satu jenjang baru
  // ditambahkan di satu sisi saja dan tidak ada yang gagal sampai ada yang
  // mengetiknya.
  const jenjang = teks => [...teks.matchAll(/\(sd\|smp\|sma\|smk\|mi\|mts\|ma\)/g)].length;
  assert.equal(jenjang(migrasi0062), 2, "migrasi 0062 bukan lagi bentuk yang dicerminkan");
  assert.equal(jenjang(modul), 2, "school-search.mjs tidak lagi memakai dua aturan yang sama");
  assert.ok(migrasi0062.includes("n(egeri)?") && modul.includes("n(egeri)?"),
    'aturan "Negeri" hilang dari salah satu sisi');
  // Batas kata di ujung huruf status ditulis berbeda di kedua bahasa: \y di
  // PostgreSQL, \b di JavaScript. Yang harus sama artinya, bukan hurufnya.
  assert.ok(migrasi0062.includes("ma)s\\y") && modul.includes("ma)s\\b"),
    "aturan huruf status Dapodik hilang dari salah satu sisi");
});

test("form pendaftaran benar-benar memakai modulnya", () => {
  // Modul yang benar tapi tidak dipanggil sama saja dengan tidak ada — dan
  // itu tidak menggagalkan apa pun sampai ada yang mengetik di layar.
  assert.match(daftarJs, /import \{ cariSekolah, kunciSekolah \} from "\.\/school-search\.mjs";/);
  assert.match(daftarJs, /const cocok = cariSekolah\(SEKOLAH, cari\.value, 6\);/);
  assert.doesNotMatch(daftarJs, /normal\(s\.name\)\.includes\(/,
    "pencarian potongan utuh yang lama masih terpasang");
});
