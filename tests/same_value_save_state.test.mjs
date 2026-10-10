import assert from "node:assert/strict";
import test from "node:test";
import { sumberPanitia } from "./sumber.mjs";


const app = await sumberPanitia();


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
