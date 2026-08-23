import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");


test("ceklis keberangkatan tidak diredupkan selama penyimpanan", () => {
  const awal = app.indexOf('    kotak.querySelectorAll("[data-ceklis]")');
  const akhir = app.indexOf('    kotak.querySelectorAll("[data-kontrak]")', awal);

  assert.notEqual(awal, -1, "handler ceklis keberangkatan tidak ditemukan");
  assert.notEqual(akhir, -1, "akhir handler ceklis keberangkatan tidak ditemukan");

  const handler = app.slice(awal, akhir);
  assert.doesNotMatch(
    handler,
    /classList\.(?:add|toggle)\(["']saving["']\)/,
    "ceklis keberangkatan kembali diredupkan saat request berjalan",
  );
  assert.match(handler, /antre = antre\.then\(/, "klik beruntun tetap harus diantrekan");
});

test("peringatan pindah kloter digambar, bukan ditempelkan sesudah penggambaran", () => {
  // gambarKloter() mengosongkan #isi-kloter lalu menunggu reguKloter(). Kartu
  // yang ditempelkan sesudah pemanggilannya ikut terhapus begitu request itu
  // selesai — peringatannya tampil beberapa ratus milidetik lalu hilang, dan
  // cabang ini tidak punya notif() sebagai cadangan.
  const awal = app.indexOf('    kotak.querySelectorAll("[data-pindah]")');
  assert.notEqual(awal, -1, "handler pindah kloter tidak ditemukan");
  const akhir = app.indexOf('    const tombolKoreksi', awal);
  assert.notEqual(akhir, -1, "akhir handler pindah kloter tidak ditemukan");
  const handler = app.slice(awal, akhir);

  assert.doesNotMatch(handler, /kotak\.prepend\(/,
    "peringatan kembali ditempelkan ke DOM sesudah gambarKloter() dipanggil");
  assert.match(handler, /peringatanPindah = hasil\.peringatan/,
    "peringatan tidak dititipkan ke penggambaran");
  assert.match(handler, /sisipan = await daftarSisipan\(\)/,
    "daftar sisipan tidak disegarkan sesudah pemindahan, jadi nomor yang "
    + "barusan disisipkan tidak muncul di kartu merah");

  // Dan penggambarannya memang membacanya.
  const gambar = app.slice(app.indexOf("  async function gambarKloter() {"));
  assert.match(gambar.slice(0, gambar.indexOf("</table>")),
    /peringatanPindah \? kartuPeringatanPindah\(peringatanPindah\)/,
    "gambarKloter tidak menggambar peringatan pemindahan");
});
