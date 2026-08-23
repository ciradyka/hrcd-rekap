// Label kotak jam harus menunjuk input HH, bukan span pembungkusnya.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");


test("semua label kotak jam manual menunjuk input HH", () => {
  const pasangan = [
    ["kloter-pertama", "Waktu Berangkat Pertama"],
    ["kloter-terakhir", "Waktu Berangkat Terakhir"],
    ["jam-berangkat", "Jam berangkat"],
    ["jam", "Jam datang"],
  ];

  for (const [id, label] of pasangan) {
    assert.match(app, new RegExp(
      `<label for="${id}-hh">${label}</label>[\\s\\S]{0,400}kotakJamHtml\\("${id}"`));
  }
});
