import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const api = await readFile(new URL("../web/js/api.js", import.meta.url), "utf8");
const devServer = await readFile(new URL("dev_server.py", import.meta.url), "utf8");


test("setiap RPC API tersedia di dev server", () => {
  const apiNames = new Set(
    [...api.matchAll(/\brpc\(\s*"([^"]+)"/g)].map((match) => match[1]),
  );
  const awal = devServer.indexOf("RPC = {");
  const akhir = devServer.indexOf("RPC_TABEL", awal);
  const rpcBlock = devServer.slice(awal, akhir);
  const devNames = new Set(
    [...rpcBlock.matchAll(/^\s*"([^"]+)"\s*:/gm)].map((match) => match[1]),
  );
  const missing = [...apiNames].filter((name) => !devNames.has(name)).sort();

  assert.deepEqual(missing, [], `RPC tanpa rute dev: ${missing.join(", ")}`);
});


test("hapus foto memakai wrapper RPC dan cast UUID di dev", () => {
  const awal = api.indexOf("export async function hapusFotoLembar");
  const akhir = api.indexOf("export async function kuotaFoto", awal);
  const fungsi = api.slice(awal, akhir);

  assert.match(fungsi, /await rpc\("hapus_foto_lembar", \{ p_id: id, p_alasan: alasan \}\)/);
  assert.doesNotMatch(fungsi, /K\.devUrl\/rpc|JSON\.stringify/);
  assert.match(devServer, /"p_id":\s*"::uuid"/);
});
