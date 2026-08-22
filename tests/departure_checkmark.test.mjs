import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");


test("ceklis keberangkatan tidak diredupkan selama penyimpanan", () => {
  const awal = app.indexOf('    kotak.querySelectorAll("[data-ceklis]")');
  const akhir = app.indexOf('    kotak.querySelectorAll("[data-kontrak]")', awal);

  assert.notEqual(awal, -1, "handler ceklis keberangkatan tidak ditemukan");
  assert.notEqual(akhir, -1, "akhir handler ceklis keberangkatan tidak ditemukan");

  const handler = app.slice(awal, akhir);
  assert.doesNotMatch(
    handler,
    /classList\.(?:add|toggle)\(["']saving["']\)/,
    "ceklis keberangkatan kembali diredupkan saat request berjalan",
  );
  assert.match(handler, /antre = antre\.then\(/, "klik beruntun tetap harus diantrekan");
});
