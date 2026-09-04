// ============================================================================
// hrcd-rekap : tests/buku_sakti.test.mjs — bentuk dan kejujuran Buku Sakti.
//
// Buku Sakti tidak punya server yang menolaknya. Isinya data statis yang
// langsung digambar, jadi satu salah ketik di dalamnya tidak menghasilkan
// galat apa pun — ia menghasilkan tautan yang mendarat di Home, kolom tabel
// yang bergeser satu, atau kalimat yang berhenti di tengah karena ada tanda
// kurang-dari di dalamnya. Ketiganya terlihat seperti buku yang memang
// begitu, dan yang menemukannya panitia yang berhenti mempercayainya.
//
// Jadi yang dijaga di sini bukan gaya penulisan melainkan hal-hal yang
// membuat buku ini masih benar tahun depan:
//
//   1. Bentuk data — enam jenis blok, tidak ada yang ketujuh; baris tabel
//      selebar kepalanya; kode bagian unik.
//   2. Tautan — tiap rute yang disebut buku benar-benar ada di RUTE app.js,
//      dan daftar rute di modulnya tidak ketinggalan dari yang sebenarnya.
//   3. Nama centang — FITUR_NAMA harus sama persis dengan `insert into fitur`
//      di migrasi 0057. Ini salinan, dan salinan yang diam adalah salinan
//      yang suatu hari salah.
//   4. Ikon dan warna — yang disebut bab harus benar-benar ada di util.js dan
//      style.css, bukan nama yang terdengar masuk akal.
//   5. Aturan kertas — CLAUDE.md bagian 8 berlaku penuh, karena buku ini ikut
//      digandakan di mesin fotokopi.
// ============================================================================

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  BUKU_SAKTI, TIMELINE, FITUR_NAMA, FITUR_SAH, RUTE_SAH,
  bagianBuku, teksBagian, teksBulan, cariBagian, cariBulan,
} from "../web/js/buku-sakti.mjs";

const baca = (p) => readFile(new URL(p, import.meta.url), "utf8");
const app = await baca("../web/js/app.js");
const util = await baca("../web/js/util.js");
const css = await baca("../web/style.css");
const html = await baca("../web/index.html");
const migrasi0057 = await baca("../supabase/migrations/0057_hak_akses.sql");

const JENIS_SAH = ["p", "poin", "langkah", "tabel", "kenapa", "layar"];

/** Tiap bagian dari tiap bab, membawa nama babnya untuk pesan galat. */
const semuaBagian = () => bagianBuku().map(({ bab, bagian }) => ({
  di: `${bab.kode}/${bagian.kode}`, bab, bagian,
}));

/** Kode tanpa komentarnya.
 *
 *  Beberapa tes di bawah melarang sebuah tulisan MUNCUL di dalam badan
 *  fungsi. Tanpa pemotong ini, komentar yang MENJELASKAN larangan itu
 *  menggagalkan tesnya sendiri — persis yang terjadi sekali, dan lapor palsu
 *  adalah cara tercepat membuat orang berhenti mempercayai sebuah tes. */
const tanpaKomentar = (kode) =>
  kode.replace(/\/\*[\s\S]*?\*\//g, " ")
      .split("\n").map(b => b.split("//")[0]).join("\n");

/** Tiap blok dari tiap bagian. */
const semuaBlok = () => semuaBagian().flatMap(({ di, bagian }) =>
  bagian.isi.map((blok, i) => ({ di: `${di}[${i}]`, blok })));

// ---------------------------------------------------------------------------
// 1. Bentuk data
// ---------------------------------------------------------------------------

test("tiap bab punya kode, judul, ikon, warna, ringkas, dan bagian", () => {
  assert.ok(BUKU_SAKTI.length >= 4, "buku harus punya minimal empat bab");
  for (const bab of BUKU_SAKTI) {
    for (const kunci of ["kode", "judul", "tab", "ikon", "warna", "ringkas"]) {
      assert.equal(typeof bab[kunci], "string", `${bab.kode}: ${kunci} bukan string`);
      assert.ok(bab[kunci].trim(), `${bab.kode}: ${kunci} kosong`);
    }
    assert.ok(Array.isArray(bab.bagian), `${bab.kode}: bagian bukan daftar`);
  }
});

test("bab timeline ada, kosong bagiannya, dan berdiri paling akhir", () => {
  const timeline = BUKU_SAKTI.find(b => b.kode === "timeline");
  assert.ok(timeline, "bab timeline hilang");
  // `bagian`-nya memang kosong: yang digambar TIMELINE, lewat percabangan di
  // layarBukuSakti(). Kalau suatu hari ia diisi, isinya tidak akan tergambar
  // sama sekali dan tidak ada yang mengeluh.
  assert.equal(timeline.bagian.length, 0,
    "bab timeline tidak digambar dari `bagian` — isinya tidak akan terlihat");
  assert.equal(BUKU_SAKTI[BUKU_SAKTI.length - 1], timeline,
    "timeline harus tab terakhir: ia kalender, dan kalender menutup buku");
});

test("label tab pendek, supaya empat tab muat tanpa penggulir", () => {
  // Terukur di browser: kolom bacaannya 734px, dan empat JUDUL penuh
  // berjejer memakan sekitar 844px — tab keempat terpotong dan .tab-golongan
  // memunculkan penggulir mendatar, di layar selebar apa pun. Batas 14 huruf
  // memberi kelonggaran yang cukup terhadap lebar huruf yang berbeda-beda.
  for (const bab of BUKU_SAKTI) {
    assert.ok(bab.tab.length <= 14,
      `${bab.kode}: label tab "${bab.tab}" ${bab.tab.length} huruf, batasnya 14`);
  }
  const total = BUKU_SAKTI.reduce((n, b) => n + b.tab.length, 0);
  assert.ok(total <= 40, `total huruf label tab ${total}, batasnya 40`);
});

test("tab yang tergambar label pendeknya, bukan judul penuhnya", () => {
  const awal = app.indexOf('<nav class="tab-golongan bs-tab"');
  const akhir = app.indexOf("</nav>", awal);
  assert.ok(awal >= 0 && akhir > awal, "deret tab tidak ditemukan di app.js");
  const deret = app.slice(awal, akhir);
  assert.ok(deret.includes("esc(b.tab)"),
    "deret tab tidak memakai label pendek");
  assert.ok(!deret.includes("esc(b.judul)"),
    "judul penuh kembali dipakai di tab — penggulir mendatarnya ikut kembali");
});

test("kode bab unik", () => {
  const kode = BUKU_SAKTI.map(b => b.kode);
  assert.equal(new Set(kode).size, kode.length, `kode bab kembar: ${kode}`);
});

test("kode bagian unik DI SELURUH BUKU, bukan cuma di dalam babnya", () => {
  // Kode bagian jadi id elemen (`bs-<kode>`), dan seluruh bab digambar
  // sekaligus ke satu halaman. Dua bagian sekode berarti dua elemen ber-id
  // sama, dan getElementById() selalu mengembalikan yang pertama — jadi
  // daftar isi bab ketiga melompat ke bagian di bab pertama.
  const kode = semuaBagian().map(({ bagian }) => bagian.kode);
  const kembar = kode.filter((k, i) => kode.indexOf(k) !== i);
  assert.deepEqual(kembar, [], `kode bagian kembar: ${kembar}`);
});

test("kode bagian aman dipakai jadi id elemen", () => {
  for (const { di, bagian } of semuaBagian()) {
    assert.match(bagian.kode, /^[a-z0-9-]+$/,
      `${di}: kode bagian harus huruf kecil, angka, dan tanda hubung`);
  }
});

test("tiap bagian punya judul dan isi yang tidak kosong", () => {
  for (const { di, bagian } of semuaBagian()) {
    assert.ok(String(bagian.judul || "").trim(), `${di}: judul kosong`);
    assert.ok(Array.isArray(bagian.isi) && bagian.isi.length,
      `${di}: isi kosong`);
  }
});

test("tidak ada jenis blok ketujuh", () => {
  for (const { di, blok } of semuaBlok()) {
    assert.ok(JENIS_SAH.includes(blok.jenis),
      `${di}: jenis "${blok.jenis}" tidak dikenal perakit layar`);
  }
});

test("blok p dan kenapa membawa teks; poin dan langkah membawa butir", () => {
  for (const { di, blok } of semuaBlok()) {
    if (blok.jenis === "p" || blok.jenis === "kenapa") {
      assert.ok(String(blok.teks || "").trim(), `${di}: teks kosong`);
    }
    if (blok.jenis === "poin" || blok.jenis === "langkah") {
      assert.ok(Array.isArray(blok.butir) && blok.butir.length,
        `${di}: butir kosong`);
      for (const butir of blok.butir) {
        assert.ok(String(butir || "").trim(), `${di}: ada butir kosong`);
      }
    }
  }
});

test("baris tabel selebar kepalanya", () => {
  // Satu sel kurang menggeser SELURUH sisa barisnya satu kolom ke kiri, dan
  // tabel yang bergeser tetap tergambar rapi — tidak ada satu pun tanda
  // bahwa yang terbaca di kolom "Kapan" sebenarnya isi kolom sebelumnya.
  for (const { di, blok } of semuaBlok()) {
    if (blok.jenis !== "tabel") continue;
    assert.ok(Array.isArray(blok.kepala) && blok.kepala.length,
      `${di}: tabel tanpa kepala`);
    assert.ok(Array.isArray(blok.baris) && blok.baris.length,
      `${di}: tabel tanpa baris`);
    for (const [i, baris] of blok.baris.entries()) {
      assert.equal(baris.length, blok.kepala.length,
        `${di}: baris ${i} punya ${baris.length} sel, kepalanya ${blok.kepala.length}`);
    }
  }
});

// ---------------------------------------------------------------------------
// 2. Tautan
// ---------------------------------------------------------------------------

/** Rute yang benar-benar terdaftar di app.js. */
const ruteApp = (() => {
  const awal = app.indexOf("const RUTE = {");
  const akhir = app.indexOf("};", awal);
  assert.ok(awal >= 0 && akhir > awal, "tabel RUTE tidak ditemukan di app.js");
  return [...app.slice(awal, akhir).matchAll(/"(#\/[a-z0-9-]+)":/g)].map(m => m[1]);
})();

test("RUTE_SAH menyebut persis rute yang ada di app.js", () => {
  // Dua arah, dan yang kedua yang biasanya hilang: daftar yang kelebihan
  // rute meloloskan tautan mati, daftar yang kekurangan menolak tautan yang
  // sebenarnya benar — dan yang menulis buku lalu menyimpulkan tesnya rusak.
  assert.deepEqual([...RUTE_SAH].sort(), [...ruteApp].sort());
});

test("tiap blok layar menunjuk rute yang ada", () => {
  for (const { di, blok } of semuaBlok()) {
    if (blok.jenis !== "layar") continue;
    assert.ok(String(blok.nama || "").trim(), `${di}: blok layar tanpa nama`);
    assert.ok(RUTE_SAH.includes(blok.hash),
      `${di}: rute "${blok.hash}" tidak ada — tautannya akan jatuh ke Home`);
  }
});

test("tiap blok layar menyebut fitur yang ada, atau null", () => {
  for (const { di, blok } of semuaBlok()) {
    if (blok.jenis !== "layar") continue;
    assert.ok(blok.fitur === null || FITUR_SAH.includes(blok.fitur),
      `${di}: fitur "${blok.fitur}" bukan salah satu centang di layar Akun`);
  }
});

test("layar yang tidak berpagar hak ditulis fitur null, bukan dihilangkan", () => {
  // `undefined` dan `null` berperilaku sama di perakitnya, tapi hanya `null`
  // yang mengatakan "sudah dipikirkan dan memang terbuka". Field yang hilang
  // sama saja dengan lupa mengisinya.
  for (const { di, blok } of semuaBlok()) {
    if (blok.jenis !== "layar") continue;
    assert.ok("fitur" in blok, `${di}: blok layar tanpa field fitur`);
  }
});

// ---------------------------------------------------------------------------
// 3. Nama centang
// ---------------------------------------------------------------------------

test("FITUR_NAMA sama persis dengan `insert into fitur` di migrasi 0057", () => {
  const awal = migrasi0057.indexOf("insert into fitur");
  assert.ok(awal >= 0, "insert into fitur tidak ditemukan di 0057");
  const potong = migrasi0057.slice(awal, migrasi0057.indexOf(";", awal));
  const dariMigrasi = Object.fromEntries(
    [...potong.matchAll(/\('([a-z_]+)',\s*'([^']+)',\s*\d+\)/g)]
      .map(m => [m[1], m[2].trim()]));
  assert.deepEqual(FITUR_NAMA, dariMigrasi);
});

// ---------------------------------------------------------------------------
// 4. Ikon dan warna
// ---------------------------------------------------------------------------

test("ikon tiap bab benar-benar ada di util.js", () => {
  // ikon() mengembalikan string kosong untuk nama yang tidak dikenal, jadi
  // salah ketik di sini menghasilkan kotak warna kosong tanpa gambar —
  // tergambar rapi, dan tidak ada satu pun galat.
  for (const bab of BUKU_SAKTI) {
    assert.ok(util.includes(`"${bab.ikon}":`),
      `${bab.kode}: ikon "${bab.ikon}" tidak ada di IKON util.js`);
  }
});

test("warna tiap bab benar-benar ada di style.css", () => {
  for (const bab of BUKU_SAKTI) {
    assert.ok(new RegExp(`\\.i-${bab.warna}\\s`).test(css),
      `${bab.kode}: kelas .i-${bab.warna} tidak ada di style.css`);
  }
});

// ---------------------------------------------------------------------------
// 5. Teks yang aman digambar
// ---------------------------------------------------------------------------

/** Semua string teks yang benar-benar dicetak ke layar. */
const semuaTeks = () => {
  const keluar = [];
  for (const { di, blok } of semuaBlok()) {
    for (const [kunci, nilai] of Object.entries(blok)) {
      if (kunci === "jenis" || kunci === "hash" || kunci === "fitur") continue;
      if (typeof nilai === "string") keluar.push([`${di}.${kunci}`, nilai]);
      if (Array.isArray(nilai)) {
        for (const x of nilai.flat()) {
          if (typeof x === "string") keluar.push([`${di}.${kunci}`, x]);
        }
      }
    }
  }
  for (const bulan of TIMELINE) {
    for (const [kunci, nilai] of Object.entries(bulan)) {
      if (typeof nilai === "string") keluar.push([`timeline/${bulan.kode}.${kunci}`, nilai]);
      if (Array.isArray(nilai)) {
        for (const x of nilai) keluar.push([`timeline/${bulan.kode}.${kunci}`, x]);
      }
    }
  }
  return keluar;
};

test("teks buku string biasa: tanpa HTML, Markdown, atau backtick", () => {
  // Perakitnya meng-escape semuanya, jadi <b> tidak akan menebalkan apa pun
  // — ia akan TERCETAK sebagai "<b>". Yang menulisnya mengira ia menebalkan,
  // dan yang membacanya melihat kode di tengah kalimat.
  for (const [di, teks] of semuaTeks()) {
    assert.ok(!/<[a-z/!]/i.test(teks), `${di}: ada tag HTML — "${teks.slice(0, 60)}"`);
    assert.ok(!teks.includes("`"), `${di}: ada backtick — "${teks.slice(0, 60)}"`);
    assert.ok(!/\*\*|__/.test(teks), `${di}: ada penebalan Markdown — "${teks.slice(0, 60)}"`);
  }
});

test("buku tidak menyebut alat yang menulisnya", () => {
  // CLAUDE.md bagian 2.3 dan 2.4. Buku ini dibaca panitia berikutnya sebagai
  // dokumen ambalan, dan satu penyebutan begitu mengubah nadanya seluruhnya.
  const terlarang = /\b(ai|claude|chatgpt|gpt|copilot|llm)\b/i;
  for (const [di, teks] of semuaTeks()) {
    assert.ok(!terlarang.test(teks), `${di}: menyebut alat penulis — "${teks.slice(0, 60)}"`);
  }
});

test("perakit blok meng-escape setiap sisipan datanya", () => {
  // Yang dijaga di sini pemakaian esc(), bukan hasilnya: satu `${blok.teks}`
  // telanjang cukup membuang sisa paragraf begitu ada tanda kurang-dari di
  // dalamnya, dan tesnya baru gagal kalau kebetulan ada teks yang memuatnya.
  const awal = app.indexOf("function blokBuku(blok) {");
  const akhir = app.indexOf("function bagianBukuHtml(", awal);
  assert.ok(awal >= 0 && akhir > awal, "blokBuku tidak ditemukan di app.js");
  const badan = app.slice(awal, akhir);
  const telanjang = [...badan.matchAll(/\$\{\s*(blok|sel|baris|x|k)\b[^}]*\}/g)]
    .map(m => m[0])
    .filter(s => !s.includes("esc(") && !s.includes(".map(") && !s.includes(".jenis"));
  assert.deepEqual(telanjang, [], `sisipan tanpa esc(): ${telanjang.join(", ")}`);
});

// ---------------------------------------------------------------------------
// 6. Timeline
// ---------------------------------------------------------------------------

const BULAN_URUT = ["September", "Oktober", "November", "Desember",
                    "Januari", "Februari"];

test("timeline enam bulan, berurutan dari serah terima sampai pelaksanaan", () => {
  assert.deepEqual(TIMELINE.map(b => b.bulan), BULAN_URUT);
});

test("tiap bulan timeline lengkap", () => {
  for (const bulan of TIMELINE) {
    for (const kunci of ["kode", "bulan", "tajuk", "fokus", "jangan"]) {
      assert.equal(typeof bulan[kunci], "string", `${bulan.kode}: ${kunci} bukan string`);
      assert.ok(bulan[kunci].trim(), `${bulan.kode}: ${kunci} kosong`);
    }
    for (const kunci of ["tonggak", "seksi", "sistem"]) {
      assert.ok(Array.isArray(bulan[kunci]) && bulan[kunci].length,
        `${bulan.kode}: ${kunci} kosong`);
    }
  }
});

test("kode bulan aman dipakai jadi id elemen dan tidak kembar", () => {
  const kode = TIMELINE.map(b => b.kode);
  assert.equal(new Set(kode).size, kode.length, `kode bulan kembar: ${kode}`);
  for (const k of kode) assert.match(k, /^[a-z0-9-]+$/);
});

test("seksi yang disebut timeline juga dijelaskan di bab Seksi", () => {
  // Kalender yang menyebut "Seksi Barak" sementara babnya tidak pernah
  // menjelaskan seksi itu meninggalkan pembaca dengan nama tanpa tugas —
  // dan nama tanpa tugas adalah pekerjaan yang tidak dikerjakan siapa pun.
  const bab = BUKU_SAKTI.find(b => b.kode === "seksi");
  assert.ok(bab, "bab seksi hilang");
  const teks = bab.bagian.map(teksBagian).join(" ");
  for (const bulan of TIMELINE) {
    for (const seksi of bulan.seksi) {
      assert.ok(teks.includes(seksi.toLowerCase()),
        `${bulan.kode}: "${seksi}" tidak dijelaskan di bab Seksi`);
    }
  }
});

// ---------------------------------------------------------------------------
// 7. Pencarian
// ---------------------------------------------------------------------------

test("cari menuntut SEMUA kata, bukan salah satunya", () => {
  const contoh = semuaBagian()[0];
  const kata = teksBagian(contoh.bagian).split(/\s+/).filter(w => w.length > 4)[0];
  assert.ok(kata, "bagian pertama tidak punya kata yang cukup panjang");
  assert.ok(cariBagian(kata).length >= 1, "kata sendiri harus ketemu");
  assert.equal(cariBagian(`${kata} zzzznonsensezzzz`).length, 0,
    "satu kata yang tidak ada harus menggugurkan hasilnya");
});

test("cari yang kosong tidak mengembalikan apa pun", () => {
  // Layar memakai ini sebagai penanda "tidak sedang mencari" dan
  // mengembalikan seluruh panel. Kalau string kosong justru mengembalikan
  // seluruh buku sebagai HASIL, panelnya tidak pernah muncul lagi.
  assert.deepEqual(cariBagian(""), []);
  assert.deepEqual(cariBagian("   "), []);
  assert.deepEqual(cariBulan(""), []);
});

test("cari menyapu seluruh bab, bukan bab pertama saja", () => {
  const babLain = BUKU_SAKTI.filter(b => b.bagian.length).at(-1);
  assert.ok(babLain, "tidak ada bab berisi");
  const bagian = babLain.bagian[0];
  const ketemu = cariBagian(bagian.judul);
  assert.ok(ketemu.some(x => x.bagian.kode === bagian.kode),
    `judul "${bagian.judul}" tidak ketemu lewat cariBagian`);
});

test("teksBulan memuat seluruh kolom bulan", () => {
  for (const bulan of TIMELINE) {
    const teks = teksBulan(bulan);
    for (const potong of [bulan.tajuk, bulan.fokus, bulan.jangan,
                          ...bulan.tonggak, ...bulan.sistem]) {
      assert.ok(teks.includes(potong.toLowerCase()),
        `${bulan.kode}: "${potong.slice(0, 30)}" tidak ikut terindeks`);
    }
  }
});

// ---------------------------------------------------------------------------
// 8. Layar dan jalan menujunya
// ---------------------------------------------------------------------------

test("rute #/buku-sakti terdaftar dan menunjuk layarnya", () => {
  assert.match(app, /"#\/buku-sakti":\s*layarBukuSakti,/);
});

test("Buku Sakti punya jalan dari kepala halaman DAN dari menu bawah", () => {
  // Dua tempat, dan keduanya wajib: tombol kepala disembunyikan di bawah
  // 560px, jadi tanpa item menu bawah layar ini tidak punya jalan sama
  // sekali di HP — peranti yang paling banyak dipakai panitia.
  assert.ok(html.includes('id="btn-buku"'), "tombol kepala hilang di index.html");
  assert.ok(html.includes('id="nav-buku"'), "item menu bawah hilang di index.html");
  assert.match(app, /getElementById\("btn-buku"\)\.addEventListener\("click", keBuku\)/);
  assert.match(app, /getElementById\("nav-buku"\)\.addEventListener\("click", keBuku\)/);
});

test("layar Buku Sakti meminta sinyal BARU, bukan yang sudah dibatalkan", () => {
  // arahkan() memanggil pengendaliLayar.abort() lalu TIDAK membuat pengendali
  // baru; hanya sinyalLayarBaru() yang membuatnya. Memakai
  // `pengendaliLayar.signal` langsung berarti seluruh addEventListener di
  // layar ini diam-diam tidak terpasang — kotak cari dan daftar isi mati,
  // tanpa satu pun galat, dan layarnya tergambar lengkap seperti biasa.
  // Persis itu yang terjadi sekali sebelum tes ini ditulis.
  const awal = app.indexOf("function layarBukuSakti() {");
  const akhir = app.indexOf("function blokBukuCetak(", awal);
  assert.ok(awal >= 0 && akhir > awal, "layarBukuSakti tidak ditemukan");
  const badan = tanpaKomentar(app.slice(awal, akhir));
  assert.match(badan, /const sinyal = sinyalLayarBaru\(\);/);
  assert.ok(!badan.includes("pengendaliLayar.signal"),
    "sinyal yang sudah dibatalkan membuat setiap pendengar di layar ini diam");
});

test("tidak ada backtick di komentar HTML milik layar ini", () => {
  // Komentar HTML di dalam layar ini hidup DI DALAM template literal, dan
  // satu backtick di dalamnya menutup template itu di tengah jalan. Yang
  // didapat SyntaxError saat berkasnya dimuat — seluruh app.js mati, bukan
  // cuma layar ini. Sudah terjadi sekali di sini, dan CLAUDE.md sudah
  // menuliskannya sebagai jebakan sebelum itu.
  const awal = app.indexOf("function layarBukuSakti() {");
  const akhir = app.indexOf("function blokBukuCetak(", awal);
  assert.ok(awal >= 0 && akhir > awal, "layarBukuSakti tidak ditemukan");
  for (const m of app.slice(awal, akhir).matchAll(/<!--[\s\S]*?-->/g)) {
    assert.ok(!m[0].includes("`"),
      `backtick di komentar HTML: ${m[0].slice(0, 70)}`);
  }
});

test("layar Buku Sakti tidak dipagari hak akses", () => {
  // Sengaja, dan didokumentasikan di kepala bagiannya: yang paling butuh
  // membaca buku ini justru yang haknya paling sempit. Tes ini menahan
  // "kerapian" yang suatu hari menambahkan pagar seperti layar lain.
  const awal = app.indexOf("function layarBukuSakti() {");
  const akhir = app.indexOf("function blokBukuCetak(", awal);
  assert.ok(awal >= 0 && akhir > awal, "layarBukuSakti tidak ditemukan");
  const badan = app.slice(awal, akhir);
  assert.ok(!/kartuGalat\(\s*["'`]Akun ini tidak berhak/.test(badan),
    "Buku Sakti tidak boleh dipagari hak akses — lihat komentar di atasnya");
});

// ---------------------------------------------------------------------------
// 9. Aturan kertas (CLAUDE.md bagian 8)
// ---------------------------------------------------------------------------

/** Blok @media print terakhir di style.css — yang mengatur .buku-cetak.
 *
 *  KOMENTARNYA DIBUANG. Tes di bawah melarang tulisan tertentu muncul di
 *  aturannya, dan komentar yang menjelaskan larangan itu harus menyebut
 *  tulisannya — "aturan layar memberi `background: var(--kertas)`" gagal pada
 *  tes yang melarang latar terisi, padahal aturannya sendiri bersih. */
const cetakBuku = (() => {
  const awal = css.indexOf(".buku-cetak { font-size:");
  assert.ok(awal >= 0, "aturan cetak .buku-cetak tidak ditemukan di style.css");
  return tanpaKomentar(css.slice(awal));
})();

test("cetak buku tanpa raster abu dan tanpa latar berwarna", () => {
  // Bagian 8.2 dan 8.4: blok terisi keluar belang dari mesin fotokopi, dan
  // abu adalah yang paling buruk — ia jadi raster titik yang menghilang di
  // mesin lelah atau menghitam jadi kotoran.
  // `background: none` justru yang DIMINTA — ia membatalkan latar abu milik
  // aturan layar. Yang dilarang latar yang benar-benar mengisi sesuatu.
  const terisi = [...cetakBuku.matchAll(/background:\s*([^;}]+)/g)]
    .map(m => m[1].trim())
    .filter(v => v !== "none");
  assert.deepEqual(terisi, [], `ada latar terisi di aturan cetak buku: ${terisi}`);
});

test("kepala tabel cetak melepas abu, bayangan, dan sticky dari aturan layar", () => {
  // `.data-table thead th` memberi latar `var(--kertas)` (abu #f0f1f4),
  // `box-shadow` abu, dan `position: sticky` — ketiganya benar di layar.
  // Di kertas yang digandakan fotokopi ketiganya salah: bagian 8.4 melarang
  // raster abu, dan sticky di media cetak merusak tiap halaman persis seperti
  // `.bottom-nav` pernah merusaknya. Aturan cetak WAJIB membatalkan ketiganya
  // secara eksplisit — mewarisi diam-diam adalah yang membuatnya lolos sampai
  // PDF pertama.
  const th = cetakBuku.slice(cetakBuku.indexOf(".bs-tabel > thead > tr > th"));
  const badan = th.slice(0, th.indexOf("}"));
  for (const aturan of ["background: none", "box-shadow: none", "position: static"]) {
    assert.ok(badan.includes(aturan),
      `aturan kepala tabel cetak tidak memuat "${aturan}"`);
  }
});

test("huruf cetak buku minimal 7pt dan garisnya minimal 0,75pt", () => {
  for (const [, angka] of cetakBuku.matchAll(/font-size:\s*([\d.]+)pt/g)) {
    assert.ok(Number(angka) >= 7, `huruf ${angka}pt di bawah batas 7pt`);
  }
  for (const [, angka] of cetakBuku.matchAll(/border[a-z-]*:\s*([\d.]+)pt/g)) {
    assert.ok(Number(angka) >= 0.75, `garis ${angka}pt di bawah batas 0,75pt`);
  }
});

test("satu bagian tidak terbelah dua halaman", () => {
  assert.match(cetakBuku, /\.bs-cetak-bagian\s*\{[^}]*break-inside:\s*avoid/);
  assert.match(cetakBuku, /\.bs-cetak-bagian\s*\{[^}]*page-break-inside:\s*avoid/);
});

test("cetak buku membuang tautan yang tidak bisa diketuk di kertas", () => {
  const awal = app.indexOf("function blokBukuCetak(blok) {");
  const akhir = app.indexOf("function siapkanCetakBuku(", awal);
  assert.ok(awal >= 0 && akhir > awal, "blokBukuCetak tidak ditemukan");
  const badan = app.slice(awal, akhir);
  assert.ok(!badan.includes("href="),
    "alamat hash tidak berarti apa-apa di atas kertas");
});
