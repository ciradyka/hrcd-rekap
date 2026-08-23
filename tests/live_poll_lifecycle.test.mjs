// ============================================================================
// hrcd-rekap : tests/live_poll_lifecycle.test.mjs
// Poll database peserta berhenti bersama poll CDN saat halaman tersembunyi.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const live = await readFile(new URL("../live/live.js", import.meta.url), "utf8");
const awal = live.indexOf("let denyut = null;");
const akhir = live.indexOf('// Cap "berapa menit lalu"', awal);
const siklus = live.slice(awal, akhir);


test("halaman tersembunyi mematikan poll CDN dan database", () => {
  const awalMatikan = siklus.indexOf("const matikan = () => {");
  const akhirMatikan = siklus.indexOf("document.addEventListener", awalMatikan);
  const matikan = siklus.slice(awalMatikan, akhirMatikan);

  assert.match(matikan, /clearInterval\(denyut\); denyut = null/);
  assert.match(matikan, /clearInterval\(denyutFase\); denyutFase = null/);
});


test("poll fase hidup kembali tanpa menggandakan listener", () => {
  const awalNyalakan = siklus.indexOf("const nyalakan = () => {");
  const akhirNyalakan = siklus.indexOf("const matikan", awalNyalakan);
  const nyalakan = siklus.slice(awalNyalakan, akhirNyalakan);

  assert.match(nyalakan, /denyutFase = setInterval\(segarkanFase, 15000\)/);
  assert.doesNotMatch(nyalakan, /addEventListener/);
  assert.equal(
    [...siklus.matchAll(/window\.addEventListener\("focus", segarkanFase\)/g)].length,
    1,
  );
});
