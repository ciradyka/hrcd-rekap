// Lebar tabel induk tidak boleh merembes ke tabel rincian yang bersarang.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const css = await readFile(new URL("../web/style.css", import.meta.url), "utf8");


/** Persen tiap kolom sebuah tabel, dibaca dari aturan header langsungnya. */
function lebarKolom(tabel) {
  const hasil = [];
  for (const m of css.matchAll(
    new RegExp(`\\.${tabel} > thead > tr > th:nth-child\\((\\d+)\\) \\{ width:\\s*(\\d+)%;\\s*\\}`, "g")))
    hasil[Number(m[1]) - 1] = Number(m[2]);
  return hasil;
}


test("lebar Meja Pembayaran hanya diatur lewat header langsung", () => {
  // Rantai anak, bukan selektor keturunan: tabel rincian BERSARANG di dalam
  // induknya, jadi `.table-bayar th:nth-child(3)` juga mengenai kolom ketiga
  // rincian, dan yang menang cuma ditentukan urutan baris di berkas (pasal 15.5).
  assert.doesNotMatch(css, /\.table-bayar th:nth-child\(/);
  assert.doesNotMatch(css, /\.detail-table-bayar th:nth-child\(/);
  assert.doesNotMatch(css, /\.table-bayar td:nth-child\(6\)\s*\{/);
});


test("kolom terakhir induk dan rincian bertemu", () => {
  const induk = lebarKolom("table-bayar");
  const rincian = lebarKolom("detail-table-bayar");

  assert.equal(induk.length, 6, "induk harus punya enam kolom berpatokan");
  assert.equal(rincian.length, 5, "rincian harus punya lima kolom berpatokan");

  // Angkanya SENGAJA tidak dipaku di sini. Yang harus benar hubungannya:
  // kolom terakhir keduanya bertemu supaya angka rupiah tiap regu jatuh tepat
  // di bawah tombol induknya, dan kolom pertama bertemu supaya kode dan nama
  // regu berbaris lurus (pasal 15.2). Tes yang memaku "25%" gagal saat kolom
  // Metode dilebarkan untuk memuat nota transfer — padahal pasangannya ikut
  // dipindahkan dengan benar, jadi yang dilaporkannya lapor palsu.
  assert.equal(induk.at(-1), rincian.at(-1),
    `kolom terakhir tidak bertemu: induk ${induk.at(-1)}% vs rincian ${rincian.at(-1)}%`);
  assert.equal(induk[0], rincian[0],
    `kolom pertama tidak bertemu: induk ${induk[0]}% vs rincian ${rincian[0]}%`);
});


test("persentase kolom berjumlah 100", () => {
  // Di bawah `table-layout: fixed`, kolom yang tidak kebagian mendapat NOL —
  // bukan sisanya (pasal 15.3). Jumlah yang kurang dari 100 membagi sisanya
  // rata ke semua kolom dan menggeser pasangan yang baru saja dijaga di atas.
  for (const tabel of ["table-bayar", "detail-table-bayar"]) {
    const lebar = lebarKolom(tabel);
    const jumlah = lebar.reduce((a, b) => a + b, 0);
    assert.equal(jumlah, 100, `${tabel} berjumlah ${jumlah}%, bukan 100 — ${lebar.join("/")}`);
  }
});
