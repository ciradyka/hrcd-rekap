import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const webApi = await readFile(new URL("../web/js/api.js", import.meta.url), "utf8");
const liveApi = await readFile(new URL("../live/js/api.js", import.meta.url), "utf8");
const devServer = await readFile(new URL("dev_server.py", import.meta.url), "utf8");


test("aturFaseLive memakai pembungkus RPC yang sama di dev dan produksi", () => {
  const awal = webApi.indexOf("export async function aturFaseLive");
  const akhir = webApi.indexOf("export async function statusAcara", awal);
  const fungsi = webApi.slice(awal, akhir);

  assert.match(fungsi, /return rpc\("atur_fase_live", \{ p_fase: fase \}\);/);
  assert.doesNotMatch(fungsi, /K\.mode|\/atur-fase-live|\bfetch\b|\bkirim\b/);
  assert.match(devServer, /"atur_fase_live":\s*\["p_fase"\]/);
});


test("salinan API panitia dan peserta tetap sama", () => {
  assert.equal(liveApi, webApi);
});
