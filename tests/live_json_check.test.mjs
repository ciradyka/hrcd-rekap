// Query penerbitan peserta harus diparse oleh PostgreSQL pada setiap suite.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const runner = await readFile(new URL("run.sh", import.meta.url), "utf8");
const publish = await readFile(
  new URL("../.github/workflows/publish-live.yml", import.meta.url), "utf8");


test("suite dan workflow menjalankan query live.json yang sama", () => {
  const perintah = "supabase/checks/live_json.sql";
  assert.match(runner, new RegExp(`^run ${perintah.replaceAll("/", "\\/")}$`, "m"));
  assert.match(publish, new RegExp(perintah.replaceAll("/", "\\/")));
});
