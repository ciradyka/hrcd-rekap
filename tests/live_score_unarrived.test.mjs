import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panitia = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const peserta = await readFile(new URL("../live/live.js", import.meta.url), "utf8");

test("regu tanpa peringkat tetap menjadi baris, bukan podium", () => {
  assert.match(panitia, /baris\.filter\(k => k\.peringkat && k\.peringkat <= 3\)/);
  assert.match(peserta, /baris\.filter\(b => b\.peringkat && b\.peringkat <= 3\)/);
});

test("peringkat kosong digambar kosong, bukan tulisan null", () => {
  assert.match(panitia, /String\(k\.peringkat \?\? ""\)/);
  assert.match(peserta, /String\(b\.peringkat \?\? ""\)/);
});
