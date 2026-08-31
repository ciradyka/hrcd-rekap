// ============================================================================
// hrcd-rekap : tests/putaran_foto.test.mjs
// Foto slip yang masuk miring bisa diputar, dan putarannya tersimpan.
//
// AKAR MASALAHNYA DI UNGGAHAN, bukan di layar. Kamera HP menyimpan foto apa
// adanya dan menitipkan arah tegaknya di EXIF; `createImageBitmap()` dipanggil
// tanpa `imageOrientation: "from-image"`, jadi tag itu diabaikan dan kanvas di
// bawahnya menulis ulang gambarnya tanpa EXIF sama sekali. Miringnya TERPANGGANG
// ke dalam berkasnya.
//
// Dua hal karena itu dijaga di sini: panggilan yang menghormati EXIF (supaya
// foto BARU masuk tegak), dan putaran tersimpan (untuk yang sudah terlanjur).
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const api = await readFile(new URL("../web/js/api.js", import.meta.url), "utf8");
const util = await readFile(new URL("../web/js/util.js", import.meta.url), "utf8");
const css = await readFile(new URL("../web/style.css", import.meta.url), "utf8");
const mig = await readFile(
  new URL("../supabase/migrations/0167_putaran_foto.sql", import.meta.url), "utf8");

test("unggahan menghormati orientasi EXIF", () => {
  assert.match(util,
    /createImageBitmap\(file, \{ imageOrientation: "from-image" \}\)/,
    "kompresi foto kembali mengabaikan EXIF — foto baru akan masuk MIRING "
    + "secara permanen, karena kanvas menulis ulang tanpa tag orientasinya");
});

test("kolom putaran hanya menerima kelipatan 90", () => {
  assert.match(mig, /check \(putaran in \(0, 90, 180, 270\)\)/,
    "batasan sudut hilang — sudut bebas tidak menjawab pertanyaan apa pun di sini");
  assert.match(mig, /add column if not exists putaran smallint not null default 0/,
    "foto lama tidak lagi mulai dari tegak");
});

test("kolom baru ditambahkan DI UJUNG view, bukan di tengah", () => {
  // `create or replace view` menuntut nama dan urutan kolom yang sudah ada
  // tidak berubah; menyisipkan di tengah menggeser nama kolom sesudahnya dan
  // PostgreSQL menolaknya dengan "cannot change name of view column".
  const view = mig.slice(mig.indexOf("create or replace view v_foto_lembar"),
                         mig.indexOf("-- Memutar."));
  const dituat = view.indexOf("ditaut_oleh");
  const putaran = view.indexOf("f.putaran");
  assert.ok(dituat > 0 && putaran > dituat,
    "kolom putaran disisipkan sebelum kolom yang sudah ada — "
    + "create or replace view akan menolaknya");
});

test("sudut dinormalkan di database, bukan di layar", () => {
  // Layar menghitung `(lama + 90) % 360` dan mengirim apa adanya; yang
  // memutuskan sudut yang berlaku tetap satu tempat.
  assert.match(mig, /v_baru := \(\(coalesce\(p_putaran, 0\)::int % 360\) \+ 360\) % 360;/,
    "normalisasi sudut hilang dari database");
  assert.match(api, /rpc\("putar_foto_lembar", \{ p_id: id, p_putaran: putaran \}\)/,
    "putarFotoLembar tidak memanggil RPC-nya");
});

test("layar memutar seketika lalu mengembalikannya kalau server menolak", () => {
  const awal = app.indexOf('const tombol = e.target.closest("[data-putar-foto]");');
  const akhir = app.indexOf("/** Kotak isian dan tombol simpan mati", awal);
  assert.ok(awal >= 0 && akhir > awal, "penangan putar tidak ditemukan");
  const putar = app.slice(awal, akhir);

  // Diputar SEBELUM menunggu jaringan: memutar adalah gerakan yang diulang
  // sambil membaca, dan menunggu tiap ketukan membuatnya terasa rusak.
  const pasang = putar.indexOf("petak.dataset.putar = String(baru)");
  const kirim = putar.indexOf("await putarFotoLembar");
  assert.ok(pasang >= 0 && pasang < kirim,
    "layar menunggu server sebelum memutar — tiap ketukan jadi terasa lambat");
  assert.match(putar, /petak\.dataset\.putar = String\(lama\);/,
    "sudutnya tidak dikembalikan saat server menolak");
  // Petaknya dibungkus <a> yang membuka foto penuh.
  assert.match(putar, /e\.preventDefault\(\);\s*\r?\n\s*e\.stopPropagation\(\);/,
    "memutar ikut membuka tab baru karena kliknya tidak ditahan");
});

test("90 dan 270 MENUKAR lebar dengan tinggi", () => {
  // Gambar yang cuma diberi rotate(90deg) tetap diukur browser memakai kotak
  // aslinya, jadi sesudah diputar ia meluap keluar petaknya dan separuh
  // slipnya hilang. Diukur: keempat sudut muat di dalam petaknya.
  assert.match(css,
    /\.fg-petak\[data-putar="90"\] \.fg-buka img,\s*\r?\n\s*\.fg-petak\[data-putar="270"\] \.fg-buka img \{\s*\r?\n\s*width: var\(--petak-h, 100%\);\s*\r?\n\s*height: var\(--petak-w, 100%\);/,
    "putaran 90/270 tidak lagi menukar lebar dengan tinggi — gambarnya akan "
    + "meluap keluar petaknya");
  assert.match(app, /pt\.style\.setProperty\("--petak-w"/,
    "ukuran petak tidak diukur ke CSS — putaran 90 tidak punya angka");
});

test("keadaan tergembok: kotak abu-abu, lambang simpan pudar, gembok TIDAK", () => {
  assert.match(css, /\.cek-isian input:disabled \{[\s\S]{0,120}background: var\(--garis\);/,
    "kotak isian tidak lagi jadi abu-abu saat tergembok");
  assert.match(css, /\.cek-simpan:disabled \{ opacity: \.3; cursor: not-allowed; \}/,
    "lambang simpan tidak lagi pudar saat tergembok");
  // Gemboknya sendiri tidak boleh dipudarkan: ia satu-satunya jalan keluar
  // dari keadaan ini, dan tombol pudar terbaca seperti tombol mati.
  assert.doesNotMatch(css, /\.cek-gembok:disabled \{[^}]*opacity/,
    "gembok ikut dipudarkan — padahal ia satu-satunya jalan membukanya lagi");
});
