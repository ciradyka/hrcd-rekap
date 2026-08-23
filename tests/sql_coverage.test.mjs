import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";


const root = new URL("../", import.meta.url);
const script = await readFile(new URL("run.sh", import.meta.url), "utf8");


async function sqlFiles(directory, prefix) {
  return (await readdir(new URL(directory, root)))
    .filter((name) => name.endsWith(".sql"))
    .map((name) => `${prefix}/${name}`);
}


test("run.sh menyebut setiap migrasi dan tes SQL pada baris run", async () => {
  const listed = new Set(
    [...script.matchAll(/^run\s+(\S+\.sql)\s*$/gm)].map((match) => match[1]),
  );
  const files = [
    ...await sqlFiles("supabase/migrations/", "supabase/migrations"),
    ...await sqlFiles("tests/sql/", "tests/sql"),
  ];
  const missing = files.filter((file) => !listed.has(file));

  assert.deepEqual(
    missing,
    [],
    `berkas SQL tidak pernah dijalankan oleh run.sh: ${missing.join(", ")}`,
  );
});


test("run.sh memeriksa kelengkapan sebelum membuat database uji", () => {
  const guard = script.indexOf('for file in "$ROOT"/supabase/migrations/*.sql');
  const database = script.indexOf('"$PSQL" -d postgres');

  assert.notEqual(guard, -1, "pemeriksa kelengkapan SQL tidak ditemukan");
  assert.ok(guard < database, "pemeriksa baru berjalan setelah database dibuat");
});
