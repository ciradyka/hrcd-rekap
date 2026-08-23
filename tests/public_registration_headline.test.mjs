// Headline pendaftaran peserta: menjumlahkan golongan yang ditampilkan, dan
// membaca angkanya dari database selama fase `pra`.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const live = await readFile(new URL("../live/live.js", import.meta.url), "utf8");

const potong = (dari, sampai) => {
  const awal = live.indexOf(dari);
  const akhir = live.indexOf(sampai, awal);
  assert.ok(awal >= 0 && akhir > awal, `tidak ketemu: ${dari}`);
  return live.slice(awal, akhir);
};

const gambarPra = potong("function gambarPra() {", "function gambarKelengkapan()");
const jumlahHelper = potong("const jumlahPesertaPra = () => {", "const mulai =");
const muat = potong("async function muat() {", "muat();");


test("headline pra menjumlahkan golongan peserta yang sama dengan pill", () => {
  // Aturannya pindah ke jumlahPesertaPra() supaya kunci penggambaran ulang
  // bisa memakai angka yang SAMA — tapi ia tetap satu aturan, bukan dua.
  assert.match(
    jumlahHelper,
    /URUT_GOLONGAN_PESERTA\.reduce\(\(n, g\) => n \+ Number\(per\[g\] \|\| 0\), 0\)/,
  );
  assert.match(gambarPra, /jumlahPesertaPra\(\)/);
  assert.match(gambarPra, /String\(jumlahPeserta\)/);
  assert.doesNotMatch(gambarPra, /angka-besar[^\n]+jumlah_regu_daftar/);
});


test("live.json lama tanpa rincian golongan tetap punya fallback", () => {
  assert.match(
    jumlahHelper,
    /r\.jumlah_regu_daftar \?\? r\.jumlah_regu_lunas \?\? 0/,
  );
});


test("headline dan pill membaca ringkasan yang sama", () => {
  // Dua sumber untuk satu populasi adalah dua sumber yang suatu hari tidak
  // sepakat — dan yang terlihat cuma angka besar membantah pil di bawahnya.
  assert.match(gambarPra, /ringkasBerlaku\(\)\.per_golongan/);
  assert.match(jumlahHelper, /ringkasBerlaku\(\)/);
});


test("jumlah pendaftar disegarkan dari database, hanya selama fase pra", () => {
  assert.match(muat, /if \(!mulai\(\)\) await ambilRingkasDb\(\)/,
    "muat() tidak menyegarkan jumlah pendaftar dari database");
  assert.match(live, /v_publik_ringkas\?select=\*/,
    "ringkasan tidak dibaca dari view publik yang di-grant ke anon (0099)");
  // Sesudah lomba mulai angka ini tidak tergambar di mana pun, jadi
  // permintaannya tidak boleh dikirim sama sekali — di situlah 3.000 HP
  // membuka halaman ini bersamaan.
  assert.doesNotMatch(muat, /await ambilRingkasDb\(\);\s*\n\s*if/,
    "ambilRingkasDb dipanggil tanpa pagar fase");
});


test("angka pendaftar ikut menentukan penggambaran ulang", () => {
  const kunci = potong("const kunciGambar = () =>", "let kunciTergambar");
  assert.match(kunci, /jumlahPesertaPra\(\)/,
    "papan pra tidak digambar ulang saat satu-satunya yang berubah justru "
    + "angka pendaftar");
});


test("halaman peserta tidak lagi mengaku tanpa kunci", async () => {
  // Ia memuat anon key lewat config.js, dan sudah begitu sejak 0070. Kalimat
  // yang membantahnya membuat pembaca berikutnya menyimpulkan hal yang salah
  // tentang apa yang boleh ditaruh di halaman ini.
  const indeks = await readFile(
    new URL("../live/index.html", import.meta.url), "utf8");
  assert.match(indeks, /<script src="config\.js"><\/script>/);
  for (const [nama, isi] of [["live/index.html", indeks], ["live/live.js", live]]) {
    assert.doesNotMatch(isi, /tanpa kunci apa pun|TIDAK memuat kunci apa pun/,
      `${nama} masih mengaku tidak memuat kunci apa pun`);
  }
});
