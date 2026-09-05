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


// Pasangan tes di atas, untuk jalur BACA. RPC sudah dijaga sejak lama dan
// rute baca() tidak, jadi /nama-regu-dipakai bisa hilang sejak hari pertama
// tanpa satu pun tanda: pemanggilnya menelan galatnya, dan layarnya cuma
// berhenti memperingatkan. CLAUDE.md 17.6 menyebut alat pembuka layar yang
// rusak sebagai bug prioritas tinggi justru karena bentuknya seperti ini.
test("setiap rute baca() API tersedia di dev server", () => {
  const apiRoutes = new Set(
    [...api.matchAll(/\bbaca\(\s*[`"']\/([a-z0-9-]+)/g)].map((match) => match[1]),
  );
  assert.ok(apiRoutes.size > 20,
    `cuma ${apiRoutes.size} rute terbaca — polanya tidak lagi cocok`);

  const missing = [...apiRoutes]
    .filter((route) => !devServer.includes(`u.path == "/${route}"`))
    .sort();

  assert.deepEqual(missing, [], `rute baca() tanpa rute dev: ${missing.join(", ")}`);
});


test("hapus foto memakai wrapper RPC dan cast UUID di dev", () => {
  const awal = api.indexOf("export async function hapusFotoLembar");
  const akhir = api.indexOf("export async function kuotaFoto", awal);
  const fungsi = api.slice(awal, akhir);

  assert.match(fungsi, /await rpc\("hapus_foto_lembar", \{ p_id: id, p_alasan: alasan \}\)/);
  assert.doesNotMatch(fungsi, /K\.devUrl\/rpc|JSON\.stringify/);
  assert.match(devServer, /"p_id":\s*"::uuid"/);
});
