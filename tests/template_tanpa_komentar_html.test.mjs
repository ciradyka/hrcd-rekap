// ============================================================================
// hrcd-rekap : tests/template_tanpa_komentar_html.test.mjs
// Komentar penjelas di web/js/ ditulis sebagai /* */ di atas templatenya,
// tidak pernah sebagai <!-- --> di dalamnya.
//
// Komentar HTML di dalam template literal punya dua harga:
//
// - SATU BACKTICK DI DALAMNYA MENUTUP TEMPLATE-NYA. Sisa kalimatnya dibaca
//   sebagai kode, dan seluruh app.js berhenti diparse — semua layar mati
//   sekaligus. Itu pernah terjadi: layar login berhenti di "Memuat..." dengan
//   "ReferenceError: daftar is not defined", dan pemeriksaan sintaks tetap
//   hijau karena hasilnya kebetulan JavaScript yang sah.
// - IA IKUT MASUK KE DOM. Penjelasan untuk pemelihara diurai browser di tiap
//   penggambaran — di Cek Nilai, sekitar 3,5 KB per lomba di setiap tekanan
//   panah.
//
// Komentar /* */ di atas pernyataan yang membangun templatenya tidak punya
// keduanya. Di web/js/ tidak ada alasan lain untuk menulis "<!--", jadi tes
// ini cukup mencari teks itu.
// ============================================================================

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const folder = new URL("../web/js/", import.meta.url);
const berkas = (await readdir(folder)).filter(n => /\.(m?js)$/.test(n));

test("ada berkas JavaScript untuk diperiksa", () => {
  assert.ok(berkas.includes("app.js"), "web/js/app.js tidak ditemukan");
});

for (const nama of berkas) {
  test(`${nama} tidak memuat komentar HTML`, async () => {
    const isi = await readFile(new URL(nama, folder), "utf8");
    const baris = isi.split("\n").findIndex(b => b.includes("<!--"));
    assert.equal(baris, -1,
      `web/js/${nama}:${baris + 1} memuat "<!--". Tulis penjelasannya sebagai `
      + "/* */ di atas pernyataan yang membangun templatenya.");
  });
}
