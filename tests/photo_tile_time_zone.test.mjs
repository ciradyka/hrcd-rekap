// Label jam di layar panitia memakai WIB, bukan zona waktu alat.
//
// Kenapa dijaga mesin: `toTimeString()` terlihat benar di laptop mana pun yang
// zonanya kebetulan WIB, jadi kesalahannya tidak pernah muncul saat dicoba —
// ia muncul di meja IT yang laptopnya UTC, pada hari lomba, sebagai jam yang
// tidak cocok dengan jam mana pun di layar sebelahnya.
//
// util.js memaksa Asia/Jakarta lewat Intl.DateTimeFormat justru untuk itu, dan
// kepala `jamMenit()` menyimpan alasannya.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const akar = new URL("../", import.meta.url);
const app = await readFile(new URL("web/js/app.js", akar), "utf8");
const util = await readFile(new URL("web/js/util.js", akar), "utf8");
const daftar = await readFile(new URL("live/js/daftar.js", akar), "utf8");
const live = await readFile(new URL("live/live.js", akar), "utf8");


/** Buang komentar sebelum memindai.
 *
 *  Wajib: kedua nama yang dilarang di bawah MUNCUL di berkas ini justru di
 *  dalam komentar yang menjelaskan kenapa keduanya tidak boleh dipakai
 *  (`app.js` di kepala `jam()`, `util.js` di kepala ZONA). Penjaga yang
 *  memindai teks mentah akan menyalak pada penjelasannya sendiri, lalu
 *  dilemahkan oleh orang berikutnya — dan yang hilang bukan penjelasannya,
 *  melainkan penjaganya. `//` yang didahului titik dua dibiarkan supaya
 *  `https://` tidak ikut terpotong. */
const tanpaKomentar = (isi) => isi
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/(^|[^:])\/\/[^\n]*/g, "$1");


test("tidak ada layar yang membaca jam lewat zona alat", () => {
  for (const [nama, isi] of [["app.js", app], ["util.js", util],
                             ["daftar.js", daftar], ["live.js", live]]) {
    const kode = tanpaKomentar(isi);
    assert.doesNotMatch(kode, /\.toTimeString\(/, `${nama} memakai toTimeString()`);
    assert.doesNotMatch(kode, /\.getHours\(\)/, `${nama} memakai getHours()`);
  }
});


test("ubin Foto Jawaban dinamai lewat jamMenit", () => {
  const awal = app.indexOf("async function layarFoto()");
  const akhir = app.indexOf("const RUTE = {", awal);
  const layarFoto = app.slice(awal, akhir);

  assert.match(layarFoto, /const jam = \(iso\) => \(iso \? jamMenit\(iso\) : ""\)/);
  assert.match(layarFoto, /nama: `Pukul \$\{jam\(f\.diunggah_pada\)\}`/);
});


test("jamMenit benar-benar memaksa Asia/Jakarta", () => {
  // Zonanya satu konstanta yang dipakai kedua formatter, bukan string yang
  // ditulis ulang di tiap tempat — jadi yang diperiksa keduanya.
  assert.match(util, /const ZONA = "Asia\/Jakarta"/);
  assert.match(util, /FMT_JAM = new Intl\.DateTimeFormat\([^)]*timeZone: ZONA/s);
});
