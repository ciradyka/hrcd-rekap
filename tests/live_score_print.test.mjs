import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("../live/index.html", import.meta.url), "utf8");
const js = await readFile(new URL("../live/live.js", import.meta.url), "utf8");
const css = await readFile(new URL("../live/live.css", import.meta.url), "utf8");

test("Print hanya tersedia pada fase Live penuh", () => {
  assert.match(html, /id="buka-cetak" hidden>Print<\/button>/);
  assert.match(js, /tombolCetak\.hidden = fase\(\) !== "penuh" \|\| !REKAP/);
});

test("pilihan cetak memuat Pos 1-5 dan Keberangkatan", () => {
  assert.match(js, /Number\(p\.nomor\) >= 1 && Number\(p\.nomor\) <= 5/);
  assert.match(js, /kode: "keberangkatan", label: "Keberangkatan"/);
  assert.match(html, /<select id="pilihan-cetak"><\/select>/);
  assert.match(html, /<select id="golongan-cetak"><\/select>/);
});

test("skor pos dan Keberangkatan memakai data statis yang sudah dimuat", () => {
  assert.match(js, /baris\.poin_per_pos && baris\.poin_per_pos\[kode\]/);
  assert.match(js, /\? baris\.total/);
  assert.match(js, /new Map\(\(REKAP\.progres \|\| \[\]\)\.map/);
  assert.doesNotMatch(js.slice(js.indexOf("function buatCetakanSkor"),
    js.indexOf("function pasangCetakSkor")), /fetch\(/);
});

test("lembar diurutkan skor tertinggi dan dirinci per lomba", () => {
  assert.match(js, /if \(skorA !== skorB\) return skorB - skorA/);
  for (const kepala of ["No Dada", "Nama Regu", "Asal Sekolah"])
    assert.ok(js.includes(`<th>${kepala}</th>`));
  assert.match(js, /kelompokLomba\(kolomPos\(/);
  assert.match(js, /ringkasLomba\(l, b\.golongan, nomorPos, b\.poin \|\| \{\}\)/);
  assert.match(js, /<th class="text-right">Total Pos<\/th>/);
  assert.match(js, /<th class="text-right">Total Skor<\/th>/);
  assert.match(js, /const halaman = \[golonganDipilih\]\.map\(g =>/);
});

test("print dibuka langsung dari klik kedua dan hanya cetakan yang terlihat", () => {
  const awal = js.indexOf('cetak.addEventListener("click"');
  const akhir = js.indexOf("window.addEventListener", awal);
  const handler = js.slice(awal, akhir);
  assert.match(handler, /buatCetakanSkor\(kode, golonganDipilih\)/);
  assert.doesNotMatch(handler, /await|fetch\(/);
  assert.match(css, /@media print[\s\S]*\.kepala, #isi, \.kaki, \.dialog-cetak[\s\S]*display: none !important/);
  assert.match(css, /\.cetak-skor \{ display: block !important; \}/);
});

test("setiap golongan dipadatkan ke satu A4 tanpa mengecilkan teks di bawah 7pt", () => {
  assert.match(css, /@page \{ size: A4 landscape; margin: 6mm; \}/);
  assert.match(css, /\.cetak-skor \.print-page \{ break-after: page; page-break-after: always; \}/);
  assert.match(css, /padding: \.5pt 2pt; font-size: 7pt; line-height: 1/);
  assert.doesNotMatch(css, /\.cetak-skor[\s\S]*font-size: [0-6](?:\.|pt)/);
  assert.match(js, /class="kepala-cetak-skor"/);
  assert.doesNotMatch(js.slice(js.indexOf("function buatCetakanSkor"),
    js.indexOf("function pasangCetakSkor")), /class="print-note"/);
  assert.match(js, /buatCetakanSkor\(kode, golonganDipilih\)/);
  assert.match(js, /g === golAktif \? " selected" : ""/);
});
