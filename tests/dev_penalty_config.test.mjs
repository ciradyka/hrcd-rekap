// Database dev harus memakai aturan penalti yang SAMA dengan produksi.
//
// Urutan di tests/dev_database.sh terbalik dari produksi: seluruh migrasi
// berjalan sebelum seed.sql membuat edisi aktif, jadi 0089 dan 0143 tidak
// menemukan baris konfig_penalti untuk diperbaiki, lalu seed.sql menulis
// angka lamanya. Yang membetulkannya satu langkah `set kolom = default`
// sesudah seed. Tanpa itu layar yang dicoba di laptop menghitung penalti
// dengan aturan yang tidak dipakai siapa pun, tanpa sepatah galat.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const akar = new URL("../", import.meta.url);
const dev = await readFile(new URL("tests/dev_database.sh", akar), "utf8");
const seed = await readFile(new URL("supabase/seed.sql", akar), "utf8");
const runSh = await readFile(new URL("tests/run.sh", akar), "utf8");

test("dev mengembalikan konfig_penalti ke bawaan kolom sesudah seed", () => {
  const sesudahSeed = dev.slice(dev.indexOf("run supabase/seed.sql"))
    .replace(/\s+/g, " ");
  for (const kolom of ["blok_menit", "penalti_per_blok", "penalti_tanpa_checkout"])
    assert.ok(sesudahSeed.includes(`${kolom} = default`),
      `${kolom} tidak dikembalikan ke default sesudah seed.sql`);
  assert.ok(sesudahSeed.includes("where edisi = edisi_aktif()"));
});

test("langkahnya tidak menuliskan satu angka penalti pun", () => {
  // Angka yang ditulis di sini akan jadi salinan kedua yang diam-diam
  // menyimpang begitu migrasi berikutnya mengubah aturannya. Yang dibaca
  // `set = default` adalah default kolom yang dipasang 0089 dan 0143.
  const awal = dev.indexOf("KONFIGURASI PENALTI DIKEMBALIKAN");
  const langkah = dev.slice(awal, dev.indexOf("0024_komponen_pos", awal));
  const sql = langkah.slice(langkah.indexOf("update konfig_penalti"),
                            langkah.indexOf("get diagnostics"));
  assert.doesNotMatch(sql, /=\s*[0-9]/,
    "ada angka yang ditulis langsung di langkah ini");
});

test("0143 TIDAK boleh masuk daftar ULANG", () => {
  // Ia membuat ulang v_klasemen dan simpan_kejuaraan_manual, dan keduanya
  // sudah diganti 0144, 0145, 0152, dan 0153 (CLAUDE.md pasal 7.8).
  const ulang = dev.slice(dev.indexOf("ULANG="), dev.indexOf('"', dev.indexOf("ULANG=") + 8));
  assert.doesNotMatch(ulang, /0143/);
});

test("seed.sql tetap menyimpan konfigurasi awal edisi, bukan yang sekarang", () => {
  // tests/run.sh menjalankan seed SEBELUM 0089 dan 0143 — persis seperti
  // produksi — jadi di sanalah kedua migrasi itu benar-benar diuji mengubah
  // barisnya. Menyegarkan seed akan membuat keduanya lulus tanpa mengubah
  // apa pun, dan tidak ada lagi yang menguji jalur konversinya.
  assert.match(seed, /insert into konfig_penalti/);
  const urutSeed = runSh.indexOf("run supabase/seed.sql");
  const urut0089 = runSh.indexOf("0089_penalti_waktu_per_menit");
  const urut0143 = runSh.indexOf("0143_juara_harus_tiba");
  assert.ok(urutSeed > 0 && urut0089 > urutSeed,
    "run.sh harus menjalankan seed.sql sebelum 0089");
  assert.ok(urut0143 > urutSeed,
    "run.sh harus menjalankan seed.sql sebelum 0143");
});
