// ============================================================================
// hrcd-rekap : tests/sumber.mjs
// Teks sumber layar panitia, untuk tes yang membaca kode.
//
// Puluhan tes di folder ini memeriksa KODE layar panitia, bukan perilakunya:
// app.js tidak bisa diimpor di Node karena ia menyentuh DOM begitu dimuat.
// Dulu masing-masing membaca web/js/app.js sendiri. Itu benar selama seluruh
// layar tinggal di satu berkas, dan berhenti benar begitu satu layar pindah
// ke modulnya sendiri: tes yang membaca berkas lama tetap hijau sambil tidak
// lagi melihat kode yang ia jaga.
//
// Jadi tes membaca SATU teks: app.js, lalu setiap modul bersama di
// web/js/common/, lalu setiap modul layar di web/js/screens/, disambung. Tes
// tidak perlu tahu sebuah fungsi tinggal di berkas mana.
//
// Memotong satu fungsi juga lewat sini. Fungsi tingkat atas di berkas-berkas
// itu dimulai di kolom 0 dan ditutup `}` di kolom 0, jadi potongFungsi()
// berhenti tepat di ujung fungsinya — bukan di "const RUTE = {" atau di
// fungsi tetangga, penanda yang hanya kebetulan bersebelahan selama semuanya
// satu berkas.
// ============================================================================

import { readdir, readFile } from "node:fs/promises";

const JS = new URL("../web/js/", import.meta.url);

/** Berkas modul di satu folder di bawah web/js/, urut nama. */
async function modul(folder) {
  const url = new URL(`${folder}/`, JS);
  let nama = [];
  try { nama = (await readdir(url)).filter(n => /\.m?js$/.test(n)).sort(); }
  catch { /* foldernya belum ada */ }
  return Promise.all(nama.map(n => readFile(new URL(n, url), "utf8")));
}

/** app.js, lalu web/js/common/, lalu web/js/screens/, disambung. */
export async function sumberPanitia() {
  return [
    await readFile(new URL("app.js", JS), "utf8"),
    ...await modul("common"),
    ...await modul("screens"),
  ].join("\n");
}

/** Satu fungsi tingkat atas, dari `kepala` ("async function layarCekNilai(")
 *  sampai `}` penutupnya di kolom 0. String kosong kalau kepalanya tidak ada —
 *  tes yang memakainya sebaiknya memeriksa itu, karena potongan kosong
 *  meloloskan setiap doesNotMatch. */
export function potongFungsi(teks, kepala) {
  const awal = teks.indexOf(kepala);
  if (awal < 0) return "";
  const akhir = teks.indexOf("\n}", awal);
  return teks.slice(awal, akhir < 0 ? undefined : akhir + 2);
}
