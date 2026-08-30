// Fase kelima, `juara`: papan peserta diganti daftar juara.
//
// Yang dijaga di sini bukan tampilannya melainkan rantainya — saklar panitia,
// pagar penerbitan, dan halaman peserta. Satu mata rantai yang lupa menyebut
// fase baru tidak menghasilkan galat apa pun; ia cuma membuat tombolnya tidak
// mengubah apa-apa, atau lebih buruk, menerbitkan yang seharusnya tertutup.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panitia = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const peserta = await readFile(new URL("../live/live.js", import.meta.url), "utf8");
const gaya = await readFile(new URL("../live/live.css", import.meta.url), "utf8");
const gaya_panitia = await readFile(new URL("../live/style.css", import.meta.url), "utf8");
const terbit = await readFile(
  new URL("../.github/workflows/publish-live.yml", import.meta.url), "utf8");
const liveJson = await readFile(
  new URL("../supabase/checks/live_json.sql", import.meta.url), "utf8");
const migrasi = await readFile(
  new URL("../supabase/migrations/0163_fase_juara.sql", import.meta.url), "utf8");
const skor = await readFile(new URL(
  "../supabase/migrations/0164_kejuaraan_publik_dengan_skor.sql", import.meta.url), "utf8");

/* ------------------------------- saklar panitia ------------------------- */

test("saklar panitia punya tombol kelima, sesudah Top 10", () => {
  const daftar = panitia.slice(panitia.indexOf("const FASE = ["),
    panitia.indexOf("const saklar ="));
  assert.match(daftar, /\["top10", "Top 10"\], \["juara", "Juara"\]/);
  // Urutannya mengikat: saklar ini dibaca kiri ke kanan sebagai tahapan
  // acara, dan Juara satu-satunya yang datang sesudah lomba selesai.
  assert.ok(daftar.indexOf('"juara"') > daftar.indexOf('"top10"'));
});

test("menekannya memberi tahu bahwa penerbitan masih perlu", () => {
  // Saklar hanya MEMPERKETAT (CLAUDE.md 14.3): daftar juaranya baru sampai ke
  // HP peserta sesudah publish-live.yml menulis ulang berkasnya. Tanpa
  // kalimat itu panitia menekan Juara, membaca "peserta melihat", dan peserta
  // tidak melihat apa-apa.
  assert.match(panitia, /ke === "juara"/);
  assert.match(panitia, /Papan peserta diganti daftar juara[\s\S]{0,120}Publish/);
});

/* ------------------------------- pagar penerbitan ----------------------- */

test("berkas terbit hanya memuat daftar juara pada fasenya", () => {
  assert.match(terbit, /if d\['fase'\] != 'juara' and d\['kejuaraan'\]:/);
  assert.match(terbit, /BOCOR: kejuaraan tertulis padahal fase belum juara/);
});

test("kolom yang tidak dikenal menghentikan penerbitan", () => {
  // Sejak 0164 angkanya memang ikut terbit, jadi pagar lama — tolak apa pun
  // yang bertipe angka — tidak bisa dipertahankan. Yang menggantikannya
  // DAFTAR IZIN, bukan daftar larangan: daftar larangan buta terhadap kolom
  // baru bernama lain, dan hasil_kejuaraan() duduk di atas `pendaftaran`,
  // satu tabel dengan nomor WA pembina (CLAUDE.md 13.3).
  assert.match(terbit, /KOLOM_JUARA = \{/);
  assert.match(terbit, /asing = set\(baris\) - KOLOM_JUARA/);
  assert.match(terbit, /BOCOR: kolom tak dikenal di daftar juara/);
  // Kolom skor memang termasuk yang diizinkan sekarang.
  const daftar = terbit.slice(terbit.indexOf("KOLOM_JUARA = {"),
    terbit.indexOf("for baris in d['kejuaraan']"));
  for (const kolom of ["total", "poin_juara", "jumlah_skor"]) {
    assert.ok(daftar.includes(`'${kolom}'`), `${kolom} tidak ada di KOLOM_JUARA`);
  }
  // Yang TIDAK pernah boleh ikut tetap di luar daftar.
  for (const kolom of ["sumber", "regu_id", "kontak_wa"]) {
    assert.ok(!daftar.includes(`'${kolom}'`), `${kolom} tidak boleh diizinkan`);
  }
});

test("papan ikut ditutup pada fase juara", () => {
  assert.match(terbit,
    /if d\['fase'\] == 'juara' and \(d\['klasemen'\] or d\['progres'\]\):/);
  assert.match(terbit, /BOCOR: papan ikut tertulis pada fase juara/);
});

test("daftar juara ikut ke rekap.json, bukan cuma ke live.json", () => {
  // rekap.json yang dialamati `?v=<versi>`, jadi daftarnya ikut menentukan
  // sidik jari — begitu juaranya berubah, HP mengambil berkas baru sekali.
  assert.match(terbit, /rekap = \{'progres':[\s\S]{0,80}'kejuaraan': d\['kejuaraan'\]\}/);
  assert.match(terbit, /'kejuaraan'\):/);   // ikut daftar kunci wajib
});

test("query penerbitnya benar-benar mengambil daftar juara", () => {
  assert.match(liveJson, /'kejuaraan', \(select coalesce\(jsonb_agg/);
  assert.match(liveJson, /from v_kejuaraan_publik j\)/);
});

/* ------------------------------- halaman peserta ------------------------ */

test("fase juara paling terbuka, jadi saklar database tidak bisa membukanya", () => {
  // URUT_FASE mengukur seberapa jauh isi boleh dibuka, bukan besar berkasnya.
  assert.match(peserta,
    /const URUT_FASE = \{ pra: 0, progres: 1, top10: 2, penuh: 3, juara: 4 \};/);
});

test("layar juara menggambar daftar juara dan tidak menggambar papan", () => {
  const blok = peserta.slice(peserta.indexOf("function gambar() {"),
    peserta.indexOf("async function muatRekap"));
  assert.match(blok, /fase\(\) === "juara"\s*\?\s*gambarKejuaraan\(\)/);
  // pasangPapan() membaca kotak pencarian dan tab golongan yang tidak
  // digambar di layar ini.
  assert.match(blok, /if \(mulai\(\) && fase\(\) !== "juara"\) pasangPapan\(\);/);
  assert.match(blok, /if \(fase\(\) !== "juara"\) pasangKemajuan\(\);/);
});

test("judul halaman ikut berganti jadi Kejuaraan", () => {
  assert.match(peserta, /const namaLayar = fase\(\) === "juara" \? "Kejuaraan" : "Live Score";/);
});

test("angkanya digambar dengan bentuk yang sama dengan layar panitia", () => {
  // Satu kelas yang sama, `.kejuaraan-skor`, supaya angkanya jatuh di tempat
  // yang sama di dua layar — aturannya cuma ada sekali, di style.css.
  const blok = peserta.slice(peserta.indexOf("const skorJuara"),
    peserta.indexOf("function gambarKejuaraan()"));
  assert.match(blok, /kejuaraan-skor/);
  assert.match(blok, /j\.total == null/);
  assert.match(blok, /poin juara/);
  assert.match(blok, /regu bernomor dada/);
  // `peringkat` tetap TIDAK dibaca: urutan gelar sudah dibawa
  // `nama_penghargaan`, dan kolom itu memang tidak ikut terbit.
  assert.doesNotMatch(blok, /\.peringkat\b/);
});

test("jumlah skor enam besar ditulis dengan tanda kurung, di DUA layar", () => {
  // Kalimatnya satu dan sama. Dua bunyi untuk satu fakta adalah persis yang
  // dilarang repo ini, jadi layar panitia ikut berubah bersamanya.
  assert.match(peserta, /total skor \(6 besar\)/);
  assert.match(panitia, /total skor \(6 besar\)/);
  assert.doesNotMatch(peserta, /total skor 6 besar/);
  assert.doesNotMatch(panitia, /total skor 6 besar/);
});

test("label golongan diambil dari daftar bersama, tidak ditulis ulang", () => {
  // periksa_urutan_golongan.py yang menjaga daftar itu tetap satu; nama
  // golongan yang diketik ulang di sini lolos pemeriksaannya.
  const blok = peserta.slice(peserta.indexOf("function gambarKejuaraan()"),
    peserta.indexOf("function gambarPapan()"));
  assert.match(blok, /GOLONGAN\[kode\]/);
  assert.doesNotMatch(blok, /"Penegak PA"/);
});

test("susunannya kelas yang SAMA dengan layar panitia, bukan tiruan", () => {
  // Seluruh aturannya hidup di style.css, dan halaman peserta memuat berkas
  // yang sama. Menata ulang di live.css melahirkan salinan kedua atas tata
  // letak yang sudah ada — dan salinan itu yang menyimpang diam-diam waktu
  // penghargaannya bertambah.
  const blok = peserta.slice(peserta.indexOf("function gambarKejuaraan()"),
    peserta.indexOf("function gambarPapan()"));
  for (const kelas of ["kejuaraan-bagian", "kejuaraan-umum",
                       "kejuaraan-umum-penegak", "kejuaraan-penegak-pa",
                       "kejuaraan-penegak-pi", "kejuaraan-umum-penggalang",
                       "kejuaraan-penggalang-pa", "kejuaraan-penggalang-pi",
                       "kejuaraan-kostum", "kejuaraan-yel-yel",
                       "kejuaraan-terfavorit", "kejuaraan-khusus"]) {
    assert.ok(blok.includes(kelas), `kelas ${kelas} hilang dari halaman peserta`);
    // Pencocokan teks biasa, BUKAN RegExp yang dirakit dari template literal:
    // di dalamnya `\b` adalah karakter backspace, bukan batas kata, jadi
    // polanya tidak pernah cocok dan tesnya lulus tanpa memeriksa apa pun.
    assert.ok(gaya_panitia.includes("." + kelas),
      `kelas ${kelas} tidak punya aturan di style.css`);
  }
  assert.match(blok, /table table-kejuaraan/);
  // live.css tidak boleh memuat tata letaknya sendiri lagi.
  assert.doesNotMatch(gaya, /tabel-juara|kartu-juara/);
});

test("kotak cari panitia tidak ikut, jadi `kejuaraan-pilihan` ditinggalkan", () => {
  // Kelas itu menata kartu yang berisi isian. Di halaman peserta tidak ada
  // yang bisa dipilih, dan barisnya akan terbaca seperti isian yang menunggu.
  // Dicari di daftar `bagian` saja, bukan di seluruh fungsi: komentar yang
  // menjelaskan KENAPA kelas itu ditinggalkan tentu menyebut namanya.
  const awal = peserta.indexOf("const bagian = [");
  const bagian = peserta.slice(awal, peserta.indexOf("  ];", awal));
  assert.doesNotMatch(bagian, /kejuaraan-pilihan/);
});

test("urutan kartunya mengikat grid style.css", () => {
  // Blok @media (min-width:900px) memasang grid-column dan grid-row PER
  // KELAS. Kartu yang urutannya tertukar mendarat di kotak milik kartu lain.
  const blok = peserta.slice(peserta.indexOf("const bagian = ["),
    peserta.indexOf("kejuaraan-pilihan` TIDAK ikut"));
  const urut = ["kejuaraan-umum\"", "kejuaraan-umum-penegak",
                "kejuaraan-penegak-pa", "kejuaraan-penegak-pi",
                "kejuaraan-umum-penggalang", "kejuaraan-penggalang-pa",
                "kejuaraan-penggalang-pi"];
  let pos = -1;
  for (const kelas of urut) {
    const i = blok.indexOf(kelas);
    assert.ok(i > pos, `${kelas} tidak pada urutannya`);
    pos = i;
  }
});

/* ------------------------------- migrasinya ----------------------------- */

test("migrasi memindahkan pagar hak, bukan melonggarkannya", () => {
  // Pagar `boleh('live_score')` turun dari kedua fungsi penyusun ke satu
  // pembungkus. Yang menjaga fungsi tanpa pagar itu dari panitia tinggal
  // grant-nya, jadi penjaganya harus memeriksa grant itu.
  assert.match(migrasi, /select \* from hasil_kejuaraan_semua\(\)\s*where boleh\('live_score'\)/);
  assert.match(migrasi,
    /revoke all on function hasil_kejuaraan_semua\(\) from public, anon, authenticated;/);
  assert.match(migrasi,
    /revoke all on function hasil_kejuaraan_dasar\(\) from public, anon, authenticated;/);
  assert.match(migrasi, /has_function_privilege\(\s*'anon', 'hasil_kejuaraan_semua\(\)', 'execute'\)/);
});

test("view publiknya berpagar fase, dan pagar itu satu-satunya", () => {
  // 0164 mengembalikan kolom skornya, jadi tidak ada lagi lapisan kedua di
  // belakang pagar fase. Karena itu penjaga migrasinya menguji pagar itu
  // dengan MENGUBAH fasenya, bukan dengan membaca definisinya.
  const view = skor.slice(skor.indexOf("create view v_kejuaraan_publik"),
    skor.indexOf("grant select on v_kejuaraan_publik"));
  assert.match(view, /where \(select fase_live from status_acara\) = 'juara'/);
  for (const kolom of ["total", "poin_juara", "jumlah_skor"]) {
    assert.ok(view.includes(kolom), `kolom ${kolom} belum kembali ke view publik`);
  }
  assert.ok(!view.includes("sumber"), "kolom sumber tidak boleh ikut");
  assert.match(skor, /update status_acara set fase_live = 'penuh'/);
  assert.match(skor, /0164: daftar juara terbaca padahal fase masih penuh/);
});
