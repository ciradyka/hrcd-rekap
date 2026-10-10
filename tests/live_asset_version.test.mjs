// Berkas yang dialamati dengan `?v=` di halaman panitia dan peserta harus
// berganti alamat setiap kali isinya berubah. Tab yang sudah terbuka sejak
// pagi, halaman yang dipulihkan dari bfcache, dan perantara yang memegang
// salinan sendiri tidak bertanya ulang — bagi mereka yang menentukan cuma
// alamatnya berubah atau tidak.
//
// Dulu `?v=` adalah nomor yang dinaikkan tangan, dan tes ini menyimpan sidik
// jari isi berkas di sebelah nomornya. Nomornya tetap tertinggal: live.js
// berubah dua kali dengan nomor 17, style.css empat kali berturut-turut
// (#874-#877), dan dua dari tiga halaman tidak dijaga sama sekali —
// web/index.html berhenti di v=63 melewati enam perubahan.
//
// Sekarang `?v=` ADALAH sidik jari isinya: 12 huruf pertama sha256, dengan
// akhiran baris dinormalkan ke LF (checkout Windows memberi CRLF dan CI LF,
// dan sidik jari yang berbeda antar mesin adalah tes yang gagal tanpa ada yang
// salah). tools/sync_live.py mengisinya, menyalin berkas bersama ke live/, dan
// MEMBUAT live/style.css dari web/style.css tanpa aturan khusus panitia; tes
// ini memeriksa ketiganya.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const akar = new URL("../", import.meta.url);
const sidikIsi = (teks) =>
  createHash("sha256").update(teks.replace(/\r\n/g, "\n")).digest("hex").slice(0, 12);

const HALAMAN = ["web/index.html", "live/index.html", "live/daftar.html"];
const BERSAMA = ["config.js", "js/api.js", "js/util.js"];

for (const nama of HALAMAN) {
  const halaman = await readFile(new URL(nama, akar), "utf8");
  const alamat = [...halaman.matchAll(/(?:href|src)="([^"?#]+)\?v=([^"]*)"/g)];

  test(`${nama} punya berkas yang dialamati dengan ?v=`, () => {
    // Tes yang tidak menemukan apa-apa selalu hijau.
    assert.ok(alamat.length > 0, `${nama} tidak memuat satu pun ?v=`);
  });

  for (const [, berkas, versi] of alamat) {
    test(`${nama}: ${berkas}?v= sama dengan sidik jari isinya`, async () => {
      const isi = await readFile(new URL(berkas, new URL(nama, akar)), "utf8");
      assert.equal(versi, sidikIsi(isi), [
        ``,
        `${berkas} berubah tetapi alamatnya di ${nama} tidak.`,
        `Jalankan: python tools/sync_live.py`,
        ``,
      ].join("\n"));
    });
  }
}

// style.css dan live.js wajib tetap dialamati dengan ?v= — alamat polos tidak
// pernah berganti sama sekali.
test("berkas peserta yang sering berubah tetap dialamati dengan ?v=", async () => {
  const peserta = await readFile(new URL("live/index.html", akar), "utf8");
  for (const berkas of ["style.css", "live.css", "live.js"]) {
    assert.match(peserta, new RegExp(`"${berkas.replace(".", "\\.")}\\?v=[0-9a-f]{12}"`),
      `${berkas} tidak lagi dialamati dengan ?v= di live/index.html`);
  }
});

for (const nama of BERSAMA) {
  test(`live/${nama} sama dengan web/${nama}`, async () => {
    const [web, live] = await Promise.all([
      readFile(new URL(`web/${nama}`, akar)), readFile(new URL(`live/${nama}`, akar))]);
    assert.ok(web.equals(live),
      `live/${nama} menyimpang dari web/${nama}. Jalankan: python tools/sync_live.py`);
  });
}

// live/style.css bukan salinan utuh melainkan SARINGAN web/style.css, jadi
// yang memeriksanya skrip pembuatnya sendiri — satu definisi "benar", bukan
// dua yang bisa berselisih.
test("live/style.css sama dengan saringan web/style.css", () => {
  const ada = (nama) => spawnSync(nama, ["--version"], { encoding: "utf8" }).status === 0;
  const python = ["python3", "python"].find(ada);
  assert.ok(python, "python tidak ditemukan untuk menjalankan tools/sync_live.py");
  const hasil = spawnSync(python, ["tools/sync_live.py", "--periksa"],
    { cwd: new URL(".", akar), encoding: "utf8" });
  assert.equal(hasil.status, 0, `${hasil.stdout}${hasil.stderr}`);
});
