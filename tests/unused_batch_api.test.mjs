// Jalur client yang tidak punya layar tidak boleh terlihat seperti fitur aktif.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const api = await readFile(new URL("../web/js/api.js", import.meta.url), "utf8");
const dev = await readFile(new URL("dev_server.py", import.meta.url), "utf8");
const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");


test("wrapper batch tanpa pemanggil tidak dipublikasikan", () => {
  assert.doesNotMatch(api, /\blihatBatch\b/);
  assert.doesNotMatch(api, /\bubahPendamping\b/);
  assert.doesNotMatch(dev, /u\.path == "\/batch"/);
  // RPC tetap tersedia bila kelak layar koreksi pendamping benar-benar dibuat.
  assert.match(dev, /"ubah_pendamping":\s*\["p_kode", "p_jumlah"\]/);
});


// Layar Rekapitulasi dihapus 27 Agustus 2026 (#606) dan kedua pembungkusnya
// ikut, tetapi VIEW-nya tidak: `cache_live_score` yang membacanya sekarang, dan
// di mode dev tiruan snapshot memanggil rutenya langsung. Jadi yang dijaga di
// sini dua arah sekaligus — pintu client-nya hilang, jalur dev-nya tetap ada.
//
// Arah kedua itu yang membuat tes ini bukan sekadar pencatat penghapusan:
// membuang rutenya juga akan mematikan papan Live Score di laptop, satu-satunya
// tempat layar bisa dibuka sebelum merge (CLAUDE.md 17.2).
test("pembungkus layar Rekapitulasi ikut hilang bersama layarnya", () => {
  assert.doesNotMatch(api, /\brekapPenuh\b/);
  assert.doesNotMatch(api, /\bkelengkapanPos\b/);
  assert.doesNotMatch(app, /\brekapPenuh\b/);
  assert.doesNotMatch(app, /\bkelengkapanPos\b/);
  assert.match(dev, /u\.path == "\/rekap-penuh"/);
  assert.match(dev, /u\.path == "\/kelengkapan-pos"/);
  assert.match(api, /baca\("\/rekap-penuh"\)/);
  assert.match(api, /baca\("\/kelengkapan-pos"\)/);
});
