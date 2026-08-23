// Kotak HH harus menerima empat digit agar handler dapat memindahkan MM.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const util = await readFile(new URL("../web/js/util.js", import.meta.url), "utf8");
const awal = util.indexOf("export function kotakJamHtml(");
const akhir = util.indexOf("export function pasangKotakJam(", awal);
const markup = util.slice(awal, akhir);


test("kotak jam tidak memotong menit sebelum event paste", () => {
  const hh = markup.match(/<input[^>]+class="jam-ketik jam-hh"[^>]+>/)?.[0] || "";
  const mm = markup.match(/<input[^>]+class="jam-ketik jam-mm"[^>]+>/)?.[0] || "";

  assert.doesNotMatch(hh, /maxlength=/,
    "maxlength HH membuat browser membuang digit menit sebelum handler input");
  assert.match(mm, /maxlength="2"/,
    "kotak MM tetap harus membatasi isi langsung menjadi dua digit");
  assert.match(util, /if \(angka\.length > 2\)[\s\S]*mm\.value = angka\.slice\(2, 4\)/,
    "handler tidak lagi memindahkan digit ketiga dan keempat ke menit");
});
