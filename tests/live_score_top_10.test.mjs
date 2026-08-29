// Fase Top 10 adalah publikasi ringkas: maksimal sepuluh regu eligible per
// golongan dan hanya tabel identitas + Total yang digambar.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const akar = new URL("../", import.meta.url);
const app = await readFile(new URL("web/js/app.js", akar), "utf8");
const live = await readFile(new URL("live/live.js", akar), "utf8");
const workflow = await readFile(
  new URL(".github/workflows/publish-live.yml", akar), "utf8");

test("saklar panitia menyediakan fase Top 10", () => {
  assert.match(app, /\["top10", "Top 10"\]/);
  assert.match(app, /aturFaseLive\(ke\)/);
});

test("Top 10 dibatasi per golongan dan membuang regu tanpa peringkat", () => {
  assert.match(live, /k\.peringkat === null \|\| k\.peringkat === undefined/);
  assert.match(live, /if \(jumlah >= 10\) return false/);
  assert.match(live, /jumlahGolongan\.set\(k\.golongan, jumlah \+ 1\)/);
});

test("papan Top 10 hanya menggambar identitas dan Total", () => {
  const awal = live.indexOf(': top10 ? `');
  const akhir = live.indexOf('\n      : `', awal);
  const papan = live.slice(awal, akhir);
  for (const kepala of ["#", "No<br>Dada", "Regu", "Organisasi", "Total"])
    assert.ok(papan.includes(kepala), `kolom ${kepala} hilang dari Top 10`);
  for (const kepala of ["Penalti", "Kontrak", "Pos 1", "Berangkat"])
    assert.ok(!papan.includes(kepala), `kolom ${kepala} ikut ke Top 10`);
});

test("berkas Top 10 tidak menerbitkan rincian nilai tersembunyi", () => {
  assert.match(workflow,
    /kunci_top = \('peringkat', 'nomor_dada', 'nama_regu',[\s\S]*'golongan', 'total'\)/);
  assert.match(workflow, /if d\['fase'\] == 'top10'/);
});
