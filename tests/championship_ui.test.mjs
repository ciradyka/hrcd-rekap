import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");

test("Kejuaraan dibagi menjadi section yang dibaca panitia", () => {
  for (const judul of ["Juara Umum", "Penegak PA", "Penegak PI",
    "Penggalang PA", "Penggalang PI", "Penghargaan Khusus"])
    assert.ok(app.includes(`["${judul}"`));
});

test("pilihan manual mencari nomor dada, regu, dan sekolah", () => {
  assert.match(app, /placeholder="Nomor dada \/ nama regu \/ asal sekolah…"/);
  assert.match(app, /r\.nomor_dada.*dada3\(r\.nomor_dada\).*r\.nama_regu.*r\.nama_sekolah/s);
  assert.match(app, /slice\(0, 8\)/);
});
