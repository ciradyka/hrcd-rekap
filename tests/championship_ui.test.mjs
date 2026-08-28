import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../web/style.css", import.meta.url), "utf8");

test("Kejuaraan dibagi menjadi section yang dibaca panitia", () => {
  for (const judul of ["Juara Umum", "Juara Umum Penegak", "Penegak PA", "Penegak PI",
    "Juara Umum Penggalang", "Penggalang PA", "Penggalang PI", "Penghargaan Khusus"])
    assert.ok(app.includes(`["${judul}"`));
  assert.match(app, /\["Juara Umum", x => x\.kode === "juara_umum"/);
});

test("pilihan manual mencari nomor dada, regu, dan sekolah", () => {
  assert.match(app, /placeholder="Nomor dada \/ nama regu \/ asal sekolah…"/);
  assert.match(app, /r\.nomor_dada.*dada3\(r\.nomor_dada\).*r\.nama_regu.*r\.nama_sekolah/s);
  assert.match(app, /slice\(0, 8\)/);
});

test("pilihan manual tidak menawarkan regu Intern dan dapat dihapus", () => {
  assert.match(app, /!String\(r\.golongan\)\.startsWith\("intern_"\)/);
  assert.match(app, />Hapus pilihan<\/button>/);
  assert.match(app, /simpanKejuaraanManual\(pilih\.dataset\.kode, null\)/);
});

test("layout desktop menempatkan juara umum di tengah dan golongan berdampingan", () => {
  assert.match(css, /@media \(min-width: 900px\)[\s\S]*\.kejuaraan-umum[\s\S]*justify-self: center/);
  assert.match(css, /\.kejuaraan-umum-penegak \{ grid-column: 1; grid-row: 2; \}/);
  assert.match(css, /\.kejuaraan-umum-penggalang \{ grid-column: 2; grid-row: 2; \}/);
  assert.match(css, /\.kejuaraan-penegak-pa \{ grid-column: 1; grid-row: 3; \}/);
  assert.match(css, /\.kejuaraan-penggalang-pa \{ grid-column: 2; grid-row: 3; \}/);
  assert.match(css, /\.kejuaraan-khusus \{ grid-column: 1 \/ -1; grid-row: 5; \}/);
});
