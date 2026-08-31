// ============================================================================
// hrcd-rekap : tests/gembok_per_lomba.test.mjs
// Migrasi 0166 dan sisi layarnya.
//
// Yang dijaga di sini satu urutan yang KELIHATANNYA tidak penting dan
// menggagalkan migrasi di produksi: kunci lama harus dilepas SEBELUM gembok
// pos dipecah jadi gembok per lomba. Selama `(regu_id, pos)` masih primary
// key, baris kedua tiap pos ditolak.
//
// Database uji tidak menangkapnya karena `nilai_terkunci` di sana KOSONG —
// pemecahannya tidak menyisipkan apa pun, jadi tidak ada yang bertabrakan.
// Yang menemukannya menjalankan migrasi ke database dev yang memang punya
// satu gembok. Produksi punya gembok juga.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const api = await readFile(new URL("../web/js/api.js", import.meta.url), "utf8");
const mig = await readFile(
  new URL("../supabase/migrations/0166_gembok_per_lomba.sql", import.meta.url), "utf8");

test("kunci lama dilepas SEBELUM gembok pos dipecah", () => {
  const lepas = mig.indexOf(
    "alter table nilai_terkunci drop constraint if exists nilai_terkunci_pkey;");
  const pecah = mig.indexOf("insert into nilai_terkunci (regu_id, pos, kode_lomba, reason");
  const pasang = mig.indexOf("add primary key (regu_id, pos, kode_lomba)");
  assert.ok(lepas > 0, "kunci lama tidak pernah dilepas");
  assert.ok(pecah > 0, "pemecahan gembok lama tidak ditemukan");
  assert.ok(lepas < pecah,
    "kunci lama masih terpasang saat gembok dipecah — baris kedua tiap pos "
    + "akan ditolak, dan itu hanya terlihat kalau nilai_terkunci TIDAK kosong");
  assert.ok(pecah < pasang, "kunci baru dipasang sebelum pemecahannya selesai");
});

test("penjaga migrasi menolak gembok tanpa lomba dan lomba asing", () => {
  assert.match(mig, /assert v_tanpa = 0/,
    "tidak ada penjaga untuk gembok tanpa lomba");
  assert.match(mig, /assert v_asing = 0/,
    "tidak ada penjaga untuk gembok yang menunjuk lomba tak dikenal");
});

test("v_lomba_pos menyatukan komponen dengan aturan yang sama dengan layar", () => {
  // kelompokLomba() di util.js menyatukan lewat `coalesce(lomba, name)` dan
  // mengambil kode dari komponen PERTAMA. Dua aturan yang berbeda akan
  // membuat gembok memakai kunci yang tidak dikenal layar.
  assert.match(mig, /distinct on \(w\.edisi, w\.pos, coalesce\(w\.lomba, w\.name\)\)/,
    "v_lomba_pos tidak menyatukan lewat coalesce(lomba, name)");
  assert.match(mig, /order by w\.edisi, w\.pos, coalesce\(w\.lomba, w\.name\), w\.sort_order, w\.kode/,
    "pemilihan kunci lomba tidak deterministik — gembok yang kuncinya "
    + "berpindah tidak menahan apa pun");
});

test("RPC gembok menyebut lomba di kedua arah", () => {
  assert.match(api, /rpc\("kunci_nilai_pos", \{ p_nomor_dada: nomorDada, p_pos: pos, p_lomba: lomba \}\)/,
    "kunciNilaiPos tidak mengirim lomba");
  assert.match(api, /p_lomba: lomba, p_alasan: alasan/,
    "bukaKunciNilaiPos tidak mengirim lomba");
});

test("layar membaca lomba_terkunci, bukan terkunci per pos", () => {
  // `terkunci` berarti "ADA lomba pos ini yang tergembok". Memakainya untuk
  // mematikan kotak akan mematikan lomba yang justru belum diperiksa.
  assert.match(app, /const lombaTerkunci = \(\) => new Set\(/,
    "Cek Nilai tidak lagi membaca daftar lomba yang tergembok");
  assert.match(app, /const kunci = \(r\.lomba_terkunci \|\| \[\]\)\.includes\(l\.kode\);/,
    "layar Input Nilai Pos v2 masih mematikan kotak dari gembok POS, bukan "
    + "gembok lombanya sendiri");
});

test("gembok Cek Nilai selalu bisa diketuk lagi sesudah digambar ulang", () => {
  // Penangannya mematikan tombol selama permintaan berjalan dan hanya
  // menghidupkannya kembali saat GAGAL. Tanpa baris ini gembok yang berhasil
  // dipasang tidak pernah bisa dibuka lagi tanpa memuat ulang layar —
  // ditemukan dengan menekan gemboknya dua kali di layar sungguhan.
  const awal = app.indexOf("  function gambarKunci() {");
  const akhir = app.indexOf("elIsi.addEventListener", awal);
  const gambar = app.slice(awal, akhir);
  assert.match(gambar, /tombol\.disabled = false;/,
    "gembok tidak dihidupkan lagi saat digambar ulang — sekali dikunci, "
    + "tidak bisa dibuka tanpa memuat ulang layar");
});
