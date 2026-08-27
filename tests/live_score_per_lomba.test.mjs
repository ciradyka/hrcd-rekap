// Live Score menggambar TOTAL PER LOMBA, dan kedua papan membacanya sama.
//
// Pembidaian lima kriteria jadi satu angka, PBB empat jadi satu, Yel-Yel empat
// jadi satu. Rinciannya tidak hilang — ia tetap utuh di layar Input Pos dan di
// Rekapitulasi, tempat ia memang menjawab pertanyaan.
//
// Yang dijaga di sini bukan tata letaknya melainkan CARA MEMBACANYA: satu
// fungsi untuk dua papan. Papan panitia menggambar `jumlah`, papan peserta
// menggambar centang dari `terisi` lawan `berlaku` — kalau keduanya membaca
// dengan aturan berbeda, satu papan bisa menyebut Pembidaian lengkap sementara
// papan sebelahnya menyebutnya baru sebagian, untuk regu yang sama.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { kolomPos, kelompokLomba, ringkasLomba } from "../web/js/util.js";


const akar = new URL("../", import.meta.url);
const app = await readFile(new URL("web/js/app.js", akar), "utf8");
const live = await readFile(new URL("live/live.js", akar), "utf8");

/* Konfigurasi Pos 3 yang sebenarnya (dibaca dari `wahana` edisi 37): lima
   kriteria Pembidaian di bawah satu `lomba`, KIM Lihat dan KIM Cium sebagai
   lomba tersendiri sejak 0087, dan Logika dengan varian Intern-nya. */
const POS3 = [
  { kode: "bidai_diagnosis", name: "Diagnosis dan Penanganan Awal", lomba: "Pembidaian", golongan: null },
  { kode: "bidai_teknik", name: "Teknik Bidai", lomba: "Pembidaian", golongan: null },
  { kode: "bidai_kecepatan_kerja_sama", name: "Kecepatan dan Kerja Sama", lomba: "Pembidaian", golongan: null },
  { kode: "bidai_posisi", name: "Posisi Bidai", lomba: "Pembidaian", golongan: null },
  { kode: "bidai_kerapihan", name: "Kerapihan dan Kebersihan", lomba: "Pembidaian", golongan: null },
  { kode: "kim_lihat", name: "Kim Lihat", lomba: null, golongan: null },
  { kode: "kim_cium", name: "Kim Cium", lomba: null, golongan: null },
  { kode: "logika", name: "Logika", lomba: null, golongan: null },
  { kode: "logika_intern", name: "Logika", lomba: null, golongan: "intern" },
];

const POS4 = [
  { kode: "pbb_sikap", name: "Sikap Sempurna", lomba: "PBB", golongan: null },
  { kode: "pbb_gerakan", name: "Gerakan Dasar", lomba: "PBB", golongan: null },
  { kode: "pbb_kekompakan", name: "Kekompakan", lomba: "PBB", golongan: null },
  { kode: "pbb_kerapihan", name: "Kerapihan", lomba: "PBB", golongan: null },
];

const lombaPos = (komponen) => kelompokLomba(kolomPos(komponen));


test("Pos 3 jadi empat kolom, Pos 4 jadi satu", () => {
  assert.deepEqual(lombaPos(POS3).map(l => l.nama),
    ["Pembidaian", "Kim Lihat", "Kim Cium", "Logika"]);
  assert.deepEqual(lombaPos(POS4).map(l => l.nama), ["PBB"]);
});


test("nilai satu lomba adalah jumlah komponennya", () => {
  const [pembidaian] = lombaPos(POS3);
  const poin = {
    "3.bidai_diagnosis": 25, "3.bidai_teknik": 20,
    "3.bidai_kecepatan_kerja_sama": 18, "3.bidai_posisi": 15,
    "3.bidai_kerapihan": 12,
  };
  const r = ringkasLomba(pembidaian, "penegak_pa", 3, poin);
  assert.equal(r.berlaku, 5);
  assert.equal(r.terisi, 5);
  assert.equal(r.jumlah, 90);

  const [pbb] = lombaPos(POS4);
  assert.equal(ringkasLomba(pbb, "penegak_pa", 4, {
    "4.pbb_sikap": 20, "4.pbb_gerakan": 28,
    "4.pbb_kekompakan": 25, "4.pbb_kerapihan": 18,
  }).jumlah, 91);
});


test("terisi sebagian dilaporkan sebagian, bukan lengkap dan bukan kosong", () => {
  const [pembidaian] = lombaPos(POS3);
  const r = ringkasLomba(pembidaian, "penegak_pa", 3,
    { "3.bidai_diagnosis": 25, "3.bidai_teknik": 20 });
  assert.equal(r.berlaku, 5);
  assert.equal(r.terisi, 2);
  assert.equal(r.jumlah, 45);
  assert.notEqual(r.terisi, r.berlaku, "sebagian tidak boleh terbaca lengkap");
  assert.notEqual(r.terisi, 0, "sebagian tidak boleh terbaca kosong");
});


test("lomba yang tidak berlaku untuk golongannya dilaporkan berlaku=0", () => {
  // Regu Intern hanya dinilai Soal Tulis dan ketepatan waktu (0091); seluruh
  // lomba lapangan tidak berlaku untuknya. Itu keadaan sah, dan papan harus
  // membedakannya dari "nilainya belum masuk".
  const [pembidaian, , , logika] = lombaPos(POS3);
  assert.equal(ringkasLomba(pembidaian, "intern_pa", 3, {}).berlaku, 0);

  // Logika punya varian Intern, jadi ia TETAP berlaku — dan yang dibaca
  // varian internnya, bukan baris umum.
  const r = ringkasLomba(logika, "intern_pa", 3, { "3.logika_intern": 80, "3.logika": 55 });
  assert.equal(r.berlaku, 1);
  assert.equal(r.jumlah, 80);
});


test("nol komponen terisi berbeda dari nol poin", () => {
  const [pbb] = lombaPos(POS4);
  const kosong = ringkasLomba(pbb, "penegak_pa", 4, {});
  assert.equal(kosong.terisi, 0);
  assert.equal(kosong.jumlah, 0);

  const nol = ringkasLomba(pbb, "penegak_pa", 4, { "4.pbb_sikap": 0 });
  assert.equal(nol.terisi, 1, "nilai 0 yang tersimpan tetap terhitung terisi");
  assert.equal(nol.jumlah, 0);
});


test("kedua papan memakai ringkasLomba yang sama", () => {
  assert.match(app, /ringkasLomba\(l, k\.golongan, p\.nomor, poinKomponen\)/);
  assert.match(live, /ringkasLomba\(l, b\.golongan, x\.pos\.nomor,/);

  // Tidak ada lagi kolom per penilaian di kedua papan Live Score.
  const awalPapan = app.indexOf("async function layarLiveScore()");
  const akhirPapan = app.indexOf("\nasync function ", awalPapan + 10);
  const papan = app.slice(awalPapan, akhirPapan);
  assert.doesNotMatch(papan, /p\.kolom/,
    "Live Score panitia masih menggambar kolom per penilaian");
});


test("kolom Nilai per pos hilang saat posnya cuma punya satu lomba", () => {
  // Pos 4 cuma PBB: "PBB 82 | Nilai 82" adalah angka yang sama dua kali,
  // bersebelahan.
  assert.match(app, /const satuLomba = p\.lomba\.length === 1/);
  assert.match(app, /satuLomba \? "" : `<th class="pos-kol rekap-batas">Nilai<\/th>`/);
});
