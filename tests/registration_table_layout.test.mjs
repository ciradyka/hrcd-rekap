import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const webCss = await readFile(new URL("../web/style.css", import.meta.url), "utf8");
const liveCss = await readFile(new URL("../live/style.css", import.meta.url), "utf8");


test("tombol simpan menempati kolom nomor dada pada tabel lebar", () => {
  const awal = webCss.indexOf("@media (min-width: 941px)");
  const akhir = webCss.indexOf(".detail-table-dada { width: 100%", awal);
  const layarLebar = webCss.slice(awal, akhir);

  assert.match(
    layarLebar,
    /\.action-row-simpan \.button-small\s*\{\s*flex:\s*0 0 27%;\s*margin-right:\s*20%;\s*\}/,
    "tombol Simpan harus mengisi kolom Nomor Dada dan menyisakan kolom Tukar",
  );
  assert.doesNotMatch(
    webCss.slice(akhir),
    /\.action-row-simpan \.button-small\s*\{[^}]*flex:/,
    "aturan setelah breakpoint lebar menimpa kesejajaran tombol Simpan",
  );
});


test("salinan CSS panitia dan peserta tetap sama", () => {
  assert.equal(liveCss, webCss);
});
