// Ikon navigasi harus dirender dari tabel util.js, bukan disalin ke HTML.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const index = await readFile(new URL("../web/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const util = await readFile(new URL("../web/js/util.js", import.meta.url), "utf8");


test("header dan bottom-nav memakai satu sumber ikon", () => {
  const nama = [...index.matchAll(/data-ikon="([^"]+)"/g)].map(m => m[1]);
  // Lima nama, sembilan pemakaian: empat aksi ada DI DUA TEMPAT — tombol
  // kepala untuk layar lebar dan item menu bawah untuk HP, tempat tombol
  // kepala disembunyikan di bawah 560px. Yang muncul sekali cuma `log-out`:
  // di kepala, Keluar adalah tombol BERTULISAN, bukan ikon.
  // Angka ini sengaja dipatok: ikon baru di navigasi adalah keputusan,
  // bukan kerapian, dan tes yang tidak menghitungnya membiarkan navigasi
  // tumbuh diam-diam sampai menu bawah kehabisan lebar di HP sempit.
  assert.deepEqual([...new Set(nama)].sort(),
    ["book-open", "house", "log-out", "settings", "user-cog"]);
  assert.equal(nama.length, 9);
  assert.doesNotMatch(index, /<svg\b/);
  assert.match(app,
    /querySelectorAll\("\[data-ikon\]"\)[\s\S]+ikon\(tempat\.dataset\.ikon\)/);
  for (const ikon of new Set(nama)) {
    assert.match(util, new RegExp(`"${ikon}":`));
  }
});
