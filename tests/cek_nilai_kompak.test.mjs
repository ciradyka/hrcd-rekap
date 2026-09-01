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

test("golongan dibuang dari kartu identitas di HP, bukan di laptop", () => {
  // Yang paling sedikit menjawab "apakah ini regu yang berdiri di depan saya"
  // — dan sudah terbaca dari nomor dadanya. 82px yang dibelinya adalah selisih
  // antara sebaris dan dua baris untuk sembilan dari sepuluh sekolah.
  assert.match(app, /<span class="identitas-golongan">/,
    "golongan tidak lagi dibungkus span sendiri, jadi tidak bisa disembunyikan");
  const hp = css.slice(css.indexOf(".identitas-sebaris .detail"));
  assert.match(hp,
    /@media \(max-width: 560px\) \{\s*\.identitas-sebaris \.identitas-golongan \{ display: none; \}/,
    "golongan tidak disembunyikan di rentang HP");
});

test("satu ukuran kotak nilai, dipakai ketiga tempat yang membutuhkannya", () => {
  // Tanpa lebar yang DISEBUT, browser menurunkannya dari isi tiap kotak dan
  // satu layar berisi lima ukuran berbeda: Bakiak 168, Menaksir 152,
  // Kesehatan 114, Semaphore 99, PBB 456 di laptop.
  assert.match(css, /\.cek-isian \{ --kotak-nilai: 7\.1rem; \}/,
    "lebar kotak nilai tidak lagi disebut sekali di satu tempat");
  const perlu = [
    [/\.cek-isian \.isian-baris \{[\s\S]{0,120}flex: 0 1 var\(--kotak-nilai\)/,
      "baris isian"],
    [/\.cek-isian \.small-input \{[\s\S]{0,120}width: var\(--kotak-nilai\)/,
      "kotak angka"],
    [/\.cek-isian input\.small-input\.input-waktu \{[\s\S]{0,80}width: var\(--kotak-nilai\)/,
      "kotak mm:ss"],
  ];
  for (const [pola, apa] of perlu) {
    assert.match(css, pola, `${apa} tidak memakai --kotak-nilai`);
  }
});

test("kotak berkriteria banyak boleh menyusut, tidak dilepas dari batasnya", () => {
  // `max-width: none` di sini berkekhususan 0,4,0 — `:has()` mewarisi
  // kekhususan argumennya — jadi ia mengalahkan
  // `.cek-isian .small-input { max-width: 100% }`, dan kelima kotak Pembidaian
  // bertahan di 114px lalu saling menimpa tanpa satu pun penggulir yang
  // menandainya. Terukur begitu.
  const awal = css.indexOf(".cek-angka:has(.isian-baris + .isian-baris) .small-input {");
  assert.ok(awal > 0, "aturan kotak berkriteria banyak hilang");
  const aturan = css.slice(awal, css.indexOf("}", awal));
  assert.doesNotMatch(aturan, /max-width: none/,
    "max-width: none kembali di kotak berkriteria banyak");
  assert.doesNotMatch(aturan, /font-size|min-height/,
    "kotak berkriteria banyak kembali punya ukuran hurufnya sendiri — yang "
    + "diminta satu ukuran untuk semua pos");
});

test("panah nomor dada duduk di tepi kartu di HP, dipatok lagi di laptop", () => {
  const dasar = css.slice(css.indexOf(".cek-dada {"), css.indexOf("}", css.indexOf(".cek-dada {")));
  assert.doesNotMatch(dasar, /max-width/,
    "patokan lebar kembali di .cek-dada, dan panahnya berhenti 13px sebelum "
    + "tepi kartu");
  const satuLayar = css.slice(css.indexOf("@media (min-width: 1000px)"));
  assert.match(satuLayar, /\.isi\.cek \.cek-dada \{ max-width: 11rem; \}/,
    "patokan lebar hilang di tata letak satu-layar, tempat kartunya sebaris "
    + "dan kotak yang melebar mendorong identitas regu keluar baris");
});

test("menu bawah tidak dihitami browser saat disentuh", () => {
  // Bawaan HP menyiram SELURUH tombol dengan rgba(0,0,0,.18); item bar ini
  // tidak punya latar sendiri, jadi yang muncul kotak abu 95x50 di sekeliling
  // ikon 35x26. Dilaporkan begitu.
  const nav = css.slice(css.indexOf(".bottom-nav-item {"));
  assert.match(nav.slice(0, nav.indexOf("}")), /-webkit-tap-highlight-color: transparent;/,
    "menu bawah kembali memakai kotak sentuh bawaan browser");
  assert.match(css, /\.bottom-nav-item:active \.bottom-nav-icon \{/,
    "tidak ada umpan balik sentuh yang menggantikannya");
  assert.doesNotMatch(css, /\.bottom-nav-item:hover/,
    "umpan balik memakai :hover, yang menempel di Safari iOS sampai sesuatu "
    + "yang lain disentuh");
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
