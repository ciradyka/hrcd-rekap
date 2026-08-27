// Saringan Input Pos: Belum Input · Belum Foto · Lengkap · Semua.
//
// Yang paling mudah salah di sini bukan saringannya melainkan KEGAGALAN
// permintaan fotonya. Pos memang sering kehilangan sinyal, dan kalau status
// foto yang tidak terbaca diperlakukan sebagai "tidak ada foto", layar akan
// menuduh ratusan regu sekaligus — alarm yang tidak bisa dipenuhi siapa pun,
// dan yang paling mungkin terjadi sesudahnya adalah orang berhenti memercayai
// alarmnya.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const akar = new URL("../", import.meta.url);
const app = await readFile(new URL("web/js/app.js", akar), "utf8");
const api = await readFile(new URL("web/js/api.js", akar), "utf8");

const awal = app.indexOf("async function layarInputPos()");
const layar = app.slice(awal, app.indexOf("\nasync function ", awal + 10));


test("empat saringan, dengan kode yang dipakai logikanya", () => {
  assert.ok(awal > 0, "layarInputPos tidak ditemukan");
  for (const [kode, label] of [
    ["belum-input", "Belum Input"],
    ["belum-foto", "Belum Foto"],
    ["lengkap", "Lengkap"],
    ["semua", "Semua"],
  ]) {
    assert.match(layar, new RegExp(`kode: "${kode}", label: "${label}" \}`));
  }

  // Tanpa `pendek` yang isinya sama dengan `label`: kedua span dibaca pembaca
  // layar, jadi label kembar terdengar dua kali.
  assert.doesNotMatch(layar, /label: "Belum Input", pendek:/);
  assert.doesNotMatch(layar, /label: "Belum Foto", pendek:/);
  // Nama lama tidak boleh tertinggal: logikanya sudah tidak mengenalinya, dan
  // tombol yang kodenya tidak dikenal menyaring menjadi NOL baris tanpa galat.
  assert.doesNotMatch(layar, /kode: "sudah"/);
  assert.doesNotMatch(layar, /kode: "belum",/);
});


test("Lengkap menuntut nilai DAN foto", () => {
  // Kalau ia cuma menuntut nilainya, regu yang fotonya kurang berdiri di
  // "Belum Foto" dan di "Lengkap" sekaligus — dua label yang saling
  // membantah tentang regu yang sama.
  assert.match(layar, /: lengkap\(tr\) && !\(fotoTahu && fotoKurang\)/);
});


test("status foto yang TIDAK terbaca tidak dianggap tidak ada", () => {
  // null = belum diketahui. Tanda "" pada baris, dan kedua saringan berhenti
  // menilai fotonya alih-alih menuduh.
  assert.match(layar, /fotoLembarPos\(pos\.nomor\)\.catch\(\(\) => null\)/);
  assert.match(layar, /if \(fotoPos === null\) return "";/);
  assert.match(layar, /const fotoTahu = tr\.dataset\.fotoKurang !== ""/);
});


test("yang dihitung kurang adalah LOMBA, bukan kolom penilaian", () => {
  // Satu slip satu lomba (bagian 11.6): Pembidaian lima kriteria berbagi satu
  // kertas dan satu kode_lomba. Menghitung per kolom menuntut lima foto untuk
  // satu kertas.
  assert.match(layar, /const lombaPos = kelompokLomba\(kolom\)/);
  assert.match(layar, /lombaPos\.some\(l =>\s*\n\s*l\.kolom\.some\(kol => varianUntuk\(kol, r\.golongan\)\) && !punya\.has\(l\.kode\)\)/);
});


test("lomba yang tidak berlaku untuk golongannya tidak dituntut fotonya", () => {
  // Regu Penggalang tidak pernah punya slip Tebak Simpul Penegak.
  assert.match(layar, /l\.kolom\.some\(kol => varianUntuk\(kol, r\.golongan\)\)/);
});


test("foto sepos diambil SEKALI, bukan per baris", () => {
  // Ratusan permintaan di jaringan pos yang sering putus adalah cara paling
  // mudah membuat layar tersibuk terasa rusak.
  assert.match(api, /export async function fotoLembarPos\(pos\)/);
  assert.match(api, /v_foto_lembar\?pos=eq\.\$\{encodeURIComponent\(pos\)\}&select=nomor_dada,kode_lomba/);
  // `path` tidak ikut: yang ditanya cuma ADA atau TIDAK.
  assert.doesNotMatch(api,
    /fotoLembarPos[\s\S]{0,400}select=nomor_dada,kode_lomba,path/);
});


test("penanda foto disegarkan sesudah dialog foto ditutup", () => {
  // Di dalamnya foto bisa diunggah atau dihapus. Penanda yang tidak ikut
  // berubah membuat saringan berbohong tentang pekerjaan yang baru selesai.
  assert.match(layar, /bukaFoto\(b\.closest\("tr"\)\)\.then\(segarkanFoto\)/);
  assert.match(layar, /const segarkanFoto = async \(\) =>/);
  // Saringan yang SEDANG menyala ikut diterapkan ulang.
  assert.match(layar, /terapkanSaringan\(\);/);
  assert.match(app, /const terapkanSaringan = pasangAlatTabel\(/);
  assert.match(app, /  return jalan;\r?\n\}/);
});
