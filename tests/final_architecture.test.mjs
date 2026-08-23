// Dokumen yang mengaku acuan tidak boleh diam-diam tertinggal dari tree.

import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";


const akar = new URL("../", import.meta.url);
const dokumen = await readFile(new URL("docs/final-architecture.md", akar), "utf8");
const app = await readFile(new URL("web/js/app.js", akar), "utf8");


test("checkpoint arsitektur mengikuti migrasi terakhir", async () => {
  const migrasi = (await readdir(new URL("supabase/migrations/", akar)))
    .filter(nama => /^\d{4}_.+\.sql$/.test(nama))
    .sort();
  const terakhir = migrasi.at(-1).slice(0, 4);

  assert.ok(dokumen.includes(
    `${migrasi.length} migrasi, \`0001\` sampai \`${terakhir}\``,
  ));
  assert.ok(dokumen.includes(`sampai migrasi \`${terakhir}\``));
});


test("tabel route sama dengan map route aplikasi", () => {
  const awalMap = app.indexOf("const RUTE = {");
  const akhirMap = app.indexOf("};", awalMap);
  const routeApp = [...app.slice(awalMap, akhirMap).matchAll(/"(#\/[^\"]+)"\s*:/g)]
    .map(m => m[1]).sort();

  const awalTabel = dokumen.indexOf("| Rute | Layar | Kerjanya |");
  const akhirTabel = dokumen.indexOf("Peran akun", awalTabel);
  const routeDokumen = [...dokumen.slice(awalTabel, akhirTabel)
    .matchAll(/\| `(#\/[^`]+)` \|/g)].map(m => m[1]).sort();

  assert.deepEqual(routeDokumen, routeApp);
});


test("bagian akses memakai lima peran dan hak per fitur", () => {
  for (const peran of ["admin", "registrasi", "gerbang", "juri_pos", "koordinator_pos"])
    assert.ok(dokumen.includes(`\`${peran}\``));
  assert.match(dokumen, /sumber hak yang sebenarnya adalah baris `akun_hak`/);
  assert.match(dokumen, /`boleh\(fitur\)`/);
  assert.doesNotMatch(dokumen, /\*\*admin saja\*\*/i);
  assert.doesNotMatch(dokumen, /`peran\(\) in \('admin','meja'\)`/);
});
