// Kiriman ulang idempoten harus menjelaskan data mana yang sudah tersimpan.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const daftar = await readFile(new URL("../live/js/daftar.js", import.meta.url), "utf8");
const awal = daftar.indexOf("function sukses(hasil)");
const akhir = daftar.indexOf("/* ---------------- mulai", awal);
const sukses = daftar.slice(awal, akhir);


test("hasil kirim ulang menampilkan keadaan data yang sudah tercatat", () => {
  assert.match(sukses, /hasil\.terkirim_ulang \? "" : "hidden"/);
  assert.match(sukses, /sudah tercatat dari kiriman sebelumnya/);
  assert.match(sukses, /Perubahan setelah kiriman pertama tidak ikut tersimpan/);
  // Jumlah regunya DISEBUT di kalimat itu. Yang diperiksa cuma bahwa
  // `jumlah_regu` benar-benar disisipkan ke sana — BUKAN ekspresi persisnya.
  //
  // Versi pertama memaku `${hasil.jumlah_regu}` apa adanya, lalu gagal begitu
  // 031755e membungkusnya jadi `${esc(hasil.jumlah_regu)}`. Pembungkus itu
  // benar dan memang perlu: commit itu mengubah sukses() dari tag html``
  // menjadi template biasa — karena html`` meng-escape SETIAP nilai yang
  // disisipkan, jadi HTML yang dibangun dengannya lalu disisipkan ke html``
  // lain keluar sebagai TEKS yang terlihat di layar. Di template biasa,
  // yang di-escape tiap nilai luar satu per satu.
  //
  // Jadi yang gagal bukan kodenya melainkan tesnya, dan ia gagal selama
  // berhari-hari sambil benar. Tes yang memaku bentuk penulisan menghukum
  // perbaikan yang sah, lalu diabaikan karena "memang merah dari dulu" —
  // dan sesudah itu ia tidak lagi menjaga apa pun.
  assert.match(sukses, /tercatat berisi \$\{[^}]*jumlah_regu[^}]*\} regu/);
});
