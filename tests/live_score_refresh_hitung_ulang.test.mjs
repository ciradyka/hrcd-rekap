// ============================================================================
// hrcd-rekap : tests/live_score_refresh_hitung_ulang.test.mjs
// Tombol Refresh Live Score MENGHITUNG ULANG, dan menukar angkanya DI TEMPAT
// tanpa menggambar ulang layarnya.
//
// Kegagalan yang dijaga di sini SUNYI — itu sebabnya ia perlu dijaga mesin.
// Tombol yang cuma membaca ulang `cache_live_score` selalu berhasil: tidak ada
// galat, tidak ada layar kosong, angkanya saja yang tidak pernah berubah.
// Yang menemukannya panitia, dua hari sesudah snapshot terakhir dibuat.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// AKHIRAN BARIS DINORMALKAN, alasan yang sama dengan
// tests/live_asset_version.test.mjs: checkout di Windows memberi CRLF dan di
// Linux LF, sementara penanda `gambar` di bawah memuat pergantian baris DI
// TENGAHNYA. Tanpa ini ia cuma ketemu di satu jenis mesin, dan satu alat yang
// menulis ulang app.js dengan LF sudah cukup membuatnya berhenti ketemu —
// lalu `pulih > gambar` menilai -1 dan pagarnya berhenti menjaga apa pun.
const app = (await readFile(new URL("../web/js/app.js", import.meta.url), "utf8"))
  .replace(/\r\n/g, "\n");
const api = await readFile(new URL("../web/js/api.js", import.meta.url), "utf8");
const cron = await readFile(
  new URL("../.github/workflows/refresh-live-score.yml", import.meta.url), "utf8");

/** Badan pendengar tombol Refresh. */
const pendengar = (() => {
  const awal = app.indexOf('document.getElementById("refresh-live-score")');
  const akhir = app.indexOf("/* Kepala tabel Live Score ada DUA baris", awal);
  assert.ok(awal >= 0 && akhir > awal, "pendengar tombol Refresh tidak ditemukan");
  return app.slice(awal, akhir);
})();

test("Refresh meminta database menghitung ulang lebih dulu", () => {
  assert.match(pendengar, /await segarkanLiveScore\(\)/,
    "tombol Refresh tidak meminta penghitungan ulang — ia cuma membaca ulang "
    + "snapshot yang sama, dan itu berhasil tanpa galat apa pun");
  // Urutannya mengikat: memasang angkanya DULU lalu menghitung berarti yang
  // terpasang tetap angka lama.
  assert.ok(
    pendengar.indexOf("segarkanLiveScore()") < pendengar.indexOf("pasangSnapshot("),
    "angkanya dipasang sebelum database selesai menghitung");
});

test("angkanya tetap dibaca ulang walau penghitungan gagal", () => {
  // Snapshot lama masih berguna dan cap waktunya jujur (keputusan 0146). Yang
  // tidak boleh terjadi: tombol yang gagal diam-diam lalu tidak melakukan apa pun.
  const tangkap = pendengar.slice(pendengar.indexOf("catch"));
  assert.match(tangkap, /notif\(/,
    "kegagalan penghitungan tidak diberitahukan");
  assert.match(tangkap, /pasangSnapshot\(await muatDataLiveScore\(cacheLiveScore\)\)/,
    "snapshot tidak dibaca ulang ketika penghitungan gagal");
});

test("Refresh menukar angkanya DI TEMPAT, bukan menggambar ulang layar", () => {
  // Menggambar ulang mengganti seluruh isi layar dengan pemuat lalu
  // membangunnya dari nol: layarnya berkedip kosong, saringan sekolah yang
  // sedang dipakai terhapus, dan gulirannya harus dipulihkan dengan angka yang
  // diingat — padahal yang menekan Refresh sedang MEMBACA satu baris di tengah
  // tabel, biasanya sesudah menyimpan nilai regu itu.
  // Komentar dibuang dulu: alasan aturan ini justru dijelaskan di komentar
  // tepat di dalam pendengarnya, dan nama fungsinya disebut di sana.
  const kode = pendengar.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*/g, "");
  assert.doesNotMatch(kode, /layarLiveScore\(\)/,
    "Refresh kembali menggambar ulang seluruh layar");
  assert.doesNotMatch(app, /guliranLiveScore = /,
    "ingatan guliran kembali — ia cuma perlu selama Refresh melempar "
    + "gulirannya, dan sekarang tidak ada lagi yang melempar apa pun");

  // Yang ditukar: cap update, cincin kelengkapan, hitungan tab, podium, baris.
  const pasang = app.slice(app.indexOf("const pasangSnapshot = (baru) => {"),
                           app.indexOf("/* Refresh diminta petugas"));
  assert.ok(pasang.length > 0, "pasangSnapshot tidak ditemukan");
  for (const [pola, apa] of [
    [/waktu\.textContent = `Update /, "cap update"],
    [/rinci\.replaceChildren\(h\(cincinPos\(\)\)\)/, "cincin kelengkapan"],
    [/podium\.replaceChildren\(h\(podiumGol\(g\)\)\)/, "podium"],
    [/tbody\.replaceChildren\(h\(barisGol\(g\)\)\)/, "baris tabel"],
    [/hitung\.textContent = String\(klasemen\.filter/, "hitungan tab golongan"],
    [/saringUlang\.forEach\(f => f\(\)\)/, "saringan sekolah dijalankan lagi"],
  ]) {
    assert.match(pasang, pola, `${apa} tidak ikut ditukar oleh Refresh`);
  }

  // Golongan yang sedang dibuka tetap diingat — bukan untuk Refresh lagi,
  // melainkan untuk kunjungan berikutnya ke layar ini.
  assert.match(app, /let golonganLiveScore = null;/,
    "golongan yang sedang dibuka tidak diingat");
  assert.match(app, /golonganLiveScore = pilih;/,
    "golongan tidak dicatat saat tab ditekan");
  assert.match(app,
    /golonganLiveScore && jumlahGol\[golonganLiveScore\] > 0 && golonganLiveScore/,
    "golongan yang diingat dipakai tanpa memeriksa masih ada isinya");
});

test("tombolnya dihidupkan lagi sesudah selesai", () => {
  // Dulu tidak perlu: layarLiveScore() menggambar tombol yang baru sama
  // sekali. Sekarang tombolnya elemen yang sama dari awal sampai akhir, jadi
  // baris ini yang membedakan tombol yang bisa ditekan lagi dari tombol mati.
  assert.match(pendengar, /tombol\.disabled = false/,
    "tombol Refresh tidak pernah dihidupkan lagi");
  assert.match(pendengar, /tombol\.classList\.remove\("berputar"\)/,
    "tombol Refresh berputar selamanya");
});

test("tombolnya dimatikan selama bekerja", () => {
  assert.match(pendengar, /tombol\.disabled = true/,
    "tombol Refresh tidak dimatikan — penghitungan bisa memakan detik, dan "
    + "tombol yang diam terbaca seperti tombol rusak");
});

test("RPC-nya lewat pembungkus yang sama di dev dan produksi", () => {
  const awal = api.indexOf("export async function segarkanLiveScore");
  // Kurung tutup di AWAL baris, bukan `}` pertama yang ditemukan — yang
  // pertama itu `{}` argumen RPC-nya sendiri, dan irisannya berhenti sebelum
  // tanda titik koma sehingga polanya tidak pernah cocok.
  const fungsi = api.slice(awal, api.indexOf("\n}", awal) + 2);
  assert.match(fungsi, /return rpc\("minta_segarkan_live_score", \{\}\);/,
    "segarkanLiveScore tidak memakai pembungkus rpc()");
  assert.doesNotMatch(fungsi, /K\.mode|\bfetch\b/,
    "ada cabang khusus dev — yang dijalankan panitia jadi jalur yang tidak "
    + "pernah dicoba siapa pun di laptop");
});

test("cron hari lomba tidak ikut dilebarkan", () => {
  // CLAUDE.md 16.9: cron adalah tagihan berjalan, dan kuota yang habis
  // menghentikan SELURUH workflow — termasuk apply-migration.yml. Perbaikan
  // tombol Refresh ada supaya jendela ini TIDAK perlu dilebarkan.
  assert.match(cron, /- cron: '\*\/10 23 28 8 \*'/,
    "jendela cron hari lomba berubah");
  assert.match(cron, /- cron: '\*\/10 0-11 29 8 \*'/,
    "jendela cron hari lomba berubah");
  assert.match(cron, /2026-08-28T23:/, "penjaga tahun hilang dari cron");
});
