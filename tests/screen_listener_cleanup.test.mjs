// Pendengar dan pengamat milik satu layar harus dilepas saat layarnya pergi.
//
// Kenapa dijaga mesin: kebocoran ini TIDAK punya gejala. `ulangYangGagal()`
// sudah menjaga diri dengan `document.body.contains(tbody)`, jadi salinan lama
// memang tidak melakukan apa-apa yang terlihat — yang tertinggal memorinya,
// dan tidak ada yang akan menemukannya dengan mencoba layarnya. Satu-satunya
// cara ia tidak kembali adalah ada yang memeriksa bentuknya.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");


test("router melepas pendengar layar yang ditinggalkan", () => {
  const awal = app.indexOf("async function arahkan()");
  assert.ok(awal > 0, "arahkan() tidak ditemukan");
  const arahkan = app.slice(awal, app.indexOf("\nwindow.addEventListener", awal));
  assert.match(arahkan, /pengendaliLayar\.abort\(\)/);
});


test("pendengar window di dalam layar selalu membawa signal", () => {
  // Tiga pendengar dipasang sekali saat boot — hashchange, afterprint,
  // beforeunload — dan memang harus hidup selama tab terbuka. Keduanya
  // dibedakan oleh indentasi: yang di dalam fungsi layar menjorok.
  const baris = app.split("\n").filter(l => l.includes("window.addEventListener("));
  assert.ok(baris.length >= 4, "pendengar window tidak ditemukan");

  for (const l of baris) {
    if (!/^\s/.test(l)) continue;              // dipasang saat boot, bukan per layar
    assert.match(l, /signal:/,
      `pendengar window di dalam fungsi tanpa signal: ${l.trim()}`);
  }
});


test("setiap pengamat yang dibuat diserahkan ke putusSaatPindah", () => {
  const dibuat = [...app.matchAll(/new (Resize|Intersection|Mutation)Observer\(/g)].length;
  const diputus = [...app.matchAll(/putusSaatPindah\(/g)].length;

  assert.ok(dibuat > 0, "tidak ada pengamat sama sekali — cek polanya masih dipakai");
  assert.equal(diputus, dibuat,
    `${dibuat} pengamat dibuat tetapi ${diputus} diserahkan ke putusSaatPindah`);
});


test("putusSaatPindah benar-benar memutus, bukan cuma menyimpan", () => {
  assert.match(app, /const putusSaatPindah = \(sinyal, pengamat\) =>\s*\n\s*sinyal\.addEventListener\("abort", \(\) => pengamat\.disconnect\(\), \{ once: true \}\)/);
});


test("layar yang memasang sendiri meminta sinyal baru, bukan menumpang router", () => {
  // Dropdown pemilih pos memanggil layarInputPos() lagi tanpa lewat arahkan().
  // Tanpa sinyal baru di dalam layarnya, salinan lama tidak pernah dilepas.
  for (const nama of ["layarInputPos", "layarLiveScore", "layarFoto"]) {
    const awal = app.indexOf(`async function ${nama}()`);
    assert.ok(awal > 0, `${nama}() tidak ditemukan`);
    const akhir = app.indexOf("\nasync function ", awal + 10);
    const badan = app.slice(awal, akhir === -1 ? undefined : akhir);
    assert.match(badan, /sinyalLayarBaru\(\)/,
      `${nama}() tidak meminta sinyal layar baru`);
  }
});
