import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");


test("nilai yang diketik ulang sama diselesaikan saat input kehilangan fokus", () => {
  const awal = app.indexOf('  tbody.addEventListener("focusout"');
  const akhir = app.indexOf("\n  });", awal);

  assert.notEqual(awal, -1, "handler focusout lembar pos tidak ditemukan");
  assert.notEqual(akhir, -1, "akhir handler focusout lembar pos tidak ditemukan");

  const handler = app.slice(awal, akhir);
  assert.match(
    handler,
    /dataset\.keadaan === ["']belum["']/,
    "hanya baris kuning yang perlu diselesaikan saat kehilangan fokus",
  );
  assert.match(
    handler,
    /simpanBaris\(tr\)/,
    "baris kuning harus dibandingkan dengan nilai tersimpan",
  );
});
