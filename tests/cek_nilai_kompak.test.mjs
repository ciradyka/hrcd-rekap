// ============================================================================
// hrcd-rekap : tests/cek_nilai_kompak.test.mjs
// Kepala layar Cek Nilai di HP, dan menu bawah yang dipakai semua layar.
//
// Di HP layar ini menjawab satu pertanyaan: apakah angka yang tertulis sama
// dengan tulisan tangan di foto slipnya. Tiap piksel yang dipakai DI ATAS
// foto diambil DARI foto.
//
// Terukur di iframe 393x700 dengan Pos 5, sebelum perbaikan: 288px habis
// sebelum satu angka pun terlihat, dan menu bawah beserta ruang di bawahnya
// mengambil 161px lagi. Yang memakannya:
//
//   label "Pos" di atas dropdown yang isinya sudah berbunyi "Pos 5 — Yel-Yel"
//   penghitung "7 / 181"
//   kartu identitas dua baris
//   penanda "1 lomba dikunci", yang mengulang gembok yang tergambar tepat di
//     sebelah nilai lomba itu di layar yang sama
//
// Sesudahnya: kepala 155px, menu bawah 51px. Keempatnya kasus pasal 9.3 —
// buang yang mengulang judul, label, atau tombol di sebelahnya.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const app = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const css = await readFile(new URL("../web/style.css", import.meta.url), "utf8");

const layarCek = (() => {
  const awal = app.indexOf("async function layarCekNilai()");
  return app.slice(awal, app.indexOf("const RUTE = {", awal));
})();

test("dropdown pos berdiri tanpa label di atasnya", () => {
  assert.doesNotMatch(layarCek, /<label for="cek-pos">/,
    'label "Pos" kembali di atas dropdown yang isinya sudah menyebut "Pos"');
  assert.match(layarCek, /<select id="cek-pos"[\s\S]{0,80}aria-label="Pos"/,
    "dropdown pos kehilangan aria-label, satu-satunya nama yang tersisa "
    + "untuk pembaca layar");
});

test("penghitung posisi tidak ada di mana pun", () => {
  // "7 / 181" tidak pernah ditanya orang yang sedang mencocokkan satu regu,
  // dan kedua ujung daftarnya sudah terbaca dari panah yang mati.
  assert.doesNotMatch(app, /cek-posisi/,
    "penghitung posisi kembali di layar Cek Nilai");
  assert.doesNotMatch(css, /cek-posisi/,
    "aturan penghitung posisi tertinggal di style.css");
});

test("kartu identitas Cek Nilai ringkas, Input Pos v2 tidak", () => {
  assert.match(layarCek, /kartuReguNilai\(r, \{ ringkas: true \}\)/,
    "Cek Nilai tidak lagi memakai kartu identitas ringkas");
  // Di Input Pos v2 satu lomba terbuka pada satu waktu, jadi "berapa lomba
  // pos ini yang sudah tergembok" memang tidak terbaca di tempat lain — di
  // sana penanda itu satu-satunya tanda gembok di layar.
  const pos2 = app.slice(app.indexOf("async function layarInputPos2()"),
    app.indexOf("async function layarCekNilai()"));
  assert.match(pos2, /kartuReguNilai\(r\)\)/,
    "Input Nilai Pos v2 ikut memakai kartu ringkas dan kehilangan penanda "
    + "gemboknya");
});

test("kartu ringkas satu baris, tanpa penanda gembok", () => {
  const kartu = app.slice(app.indexOf("const kartuReguNilai ="),
    app.indexOf("async function layarInputPos2()"));
  const ringkas = kartu.slice(0, kartu.indexOf("</div>` : `"));
  assert.doesNotMatch(ringkas, /lomba dikunci/,
    "penanda gembok kembali di kartu ringkas — ia mengulang gembok yang "
    + "tergambar di sebelah nilai tiap lomba di layar yang sama");
  assert.match(ringkas, /<span class="nama">/,
    "kartu ringkas kembali memakai <div>, yang memaksa dua baris");
  // Diukur di iframe 393px: isi kartunya 333px, dan
  // "007 · RANCAKA · MA PUI Cijantung · Penegak PA" menuntut 328px pada 1rem
  // tebal + 0.85rem biasa. Pada 1.05/0.9 ia menuntut 347px dan membungkus.
  assert.match(css, /\.identitas-sebaris \.nama\s+\{ font-size: 1rem;/,
    "ukuran nama di kartu ringkas berubah — di 1.05rem barisnya membungkus "
    + "pada lebar HP 393px");
  assert.match(css, /\.identitas-sebaris \.detail\s+\{ font-size: \.85rem;/,
    "ukuran detail di kartu ringkas berubah — lihat catatan yang sama");
});

test("menu bawah tetap sasaran sentuh yang sah sesudah dirampingkan", () => {
  // 48px masih di atas 44px, batas yang dipakai iOS maupun Android. Di bawah
  // itu perampingan berhenti jadi perampingan.
  const nav = css.slice(css.indexOf(".bottom-nav-item {"));
  const min = nav.match(/min-height: (\d+)px;/);
  assert.ok(min, "menu bawah kehilangan batas tinggi sasaran sentuhnya");
  assert.ok(Number(min[1]) >= 44,
    `sasaran sentuh menu bawah ${min[1]}px, di bawah batas 44px`);
});

test("ruang di bawah halaman ikut tinggi bar, dan ikut safe-area", () => {
  // Bar-nya sendiri menambahkan inset itu ke tingginya, jadi ruang yang tetap
  // membuat baris terakhir berakhir DI BAWAH tepi atas bar di HP bergaris
  // beranda. Di browser desktop insetnya nol dan cacat ini tidak muncul.
  assert.match(css, /\.isi \{ padding-bottom: calc\(5rem \+ env\(safe-area-inset-bottom\)\); \}/,
    "ruang di bawah halaman tidak lagi 5rem + safe-area — kalau tinggi bar "
    + "diubah, angka ini ikut");
});
