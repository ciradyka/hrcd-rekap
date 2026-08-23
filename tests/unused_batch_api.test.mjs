// Jalur client yang tidak punya layar tidak boleh terlihat seperti fitur aktif.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const api = await readFile(new URL("../web/js/api.js", import.meta.url), "utf8");
const dev = await readFile(new URL("dev_server.py", import.meta.url), "utf8");


test("wrapper batch tanpa pemanggil tidak dipublikasikan", () => {
  assert.doesNotMatch(api, /\blihatBatch\b/);
  assert.doesNotMatch(api, /\bubahPendamping\b/);
  assert.doesNotMatch(dev, /u\.path == "\/batch"/);
  // RPC tetap tersedia bila kelak layar koreksi pendamping benar-benar dibuat.
  assert.match(dev, /"ubah_pendamping":\s*\["p_kode", "p_jumlah"\]/);
});
