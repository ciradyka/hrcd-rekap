// Label kotak jam harus menunjuk input HH, bukan span pembungkusnya.

import assert from "node:assert/strict";
import test from "node:test";
import { sumberPanitia } from "./sumber.mjs";


const app = await sumberPanitia();


test("semua label kotak jam manual menunjuk input HH", () => {
  const pasangan = [
    ["kloter-pertama", "Waktu Berangkat Pertama"],
    ["kloter-terakhir", "Waktu Berangkat Terakhir"],
    ["planning-pertama", "Jam Berangkat Pertama"],
    ["planning-terakhir", "Jam Berangkat Terakhir"],
    ["jam-berangkat", "Jam berangkat"],
    ["jam", "Jam datang"],
  ];

  for (const [id, label] of pasangan) {
    assert.match(app, new RegExp(
      `<label for="${id}-hh">${label}</label>[\\s\\S]{0,400}kotakJamHtml\\("${id}"`));
  }
});
