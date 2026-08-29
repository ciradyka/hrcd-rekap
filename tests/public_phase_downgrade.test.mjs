// Menurunkan fase efektif harus menutup seluruh tanda klasemen dari cache.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const live = await readFile(new URL("../live/live.js", import.meta.url), "utf8");
const awalBaris = live.indexOf("function barisPapan(");
const awalPapan = live.indexOf("function gambarPapan()", awalBaris);
const akhirPapan = live.indexOf("function pasangInteraksi", awalPapan);
const barisPapan = live.slice(awalBaris, awalPapan);
const gambarPapan = live.slice(awalPapan, akhirPapan);


test("klasemen cache hanya terbuka pada fase Live atau Top 10", () => {
  assert.match(barisPapan,
    /function barisPapan\(klasemenTerbuka, top10 = false\)/);
  assert.match(barisPapan, /if \(klasemenTerbuka && klasemen\.length\)/);
  assert.match(gambarPapan,
    /const top10 = fase\(\) === "top10";\s+const semua = barisPapan\(penuh \|\| top10, top10\);/);
});


test("podium dan highlight tiga besar dipagari fase penuh", () => {
  assert.match(
    gambarPapan,
    /const juara = penuh\s+\? baris\.filter\(b => b\.peringkat && b\.peringkat <= 3\)\s+: \[\];/,
  );
  assert.match(
    gambarPapan,
    /class="\$\{penuh && b\.peringkat && b\.peringkat <= 3 \? "atas" : ""\}"/,
  );
});

