// Profil dan hak sesi harus mengikuti perubahan admin pada boot berikutnya.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const api = await readFile(new URL("../web/js/api.js", import.meta.url), "utf8");
const awal = api.indexOf("export async function lengkapiHakSesi()");
const akhir = api.indexOf("export function sesi()", awal);
const refresh = api.slice(awal, akhir);


test("sesi berisi hak tetap disegarkan dari profil dan matriks server", () => {
  assert.doesNotMatch(refresh, /Array\.isArray\(s\.hak\).*return/);
  assert.match(refresh, /akun_panitia\?user_id=eq\.\$\{s\.uid\}/);
  assert.match(refresh, /akun_hak\?user_id=eq\.\$\{s\.uid\}/);
  assert.match(refresh, /username: akun\.username/);
  assert.match(refresh, /peran: akun\.peran/);
  assert.match(refresh, /pos: akun\.pos/);
  assert.match(refresh, /is_active: akun\.is_active/);
  assert.match(refresh, /hak: \(hak \|\| \[\]\)\.map/);
  assert.match(refresh, /sesiOperasionalSegar = true/);
});


test("dev server menyediakan profil akun sendiri", async () => {
  const server = await readFile(new URL("./dev_server.py", import.meta.url), "utf8");
  assert.match(server, /u\.path == "\/akun-saya"/);
  assert.match(server, /select username, peran, pos, is_active from akun_panitia/);
});


test("profil baru tidak menimpa token yang baru disegarkan", () => {
  assert.match(refresh, /const terbaru = sesi\(\) \|\| s;/);
  assert.match(refresh, /simpanSesi\(\{ \.\.\.terbaru,/);
});
