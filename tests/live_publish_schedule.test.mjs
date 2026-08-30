// Penerbitan berkala hanya hidup di sekitar hari-H. Jadwal tanpa batas tanggal
// menghabiskan 2.880 menit Actions per bulan pada repo privat, padahal seluruh
// kebutuhan edisi 37 selesai dalam dua tanggal UTC.
//
// Jendelanya dipersempit sesudah edisi XXXVII, dan ukurannya dari data:
// supabase/checks/lalu_lintas.sql menghitung penulisan per jam dari `history`,
// dan hasilnya penulisan berlangsung 06:00-19:00 WIB dengan puncak 12:00-13:00.
// Jendela lama 08:00-23:59 WIB salah di kedua ujungnya — melewatkan 306
// penulisan sebelum jam delapan, lalu jalan terus sampai tengah malam.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const workflow = await readFile(
  new URL("../.github/workflows/publish-live.yml", import.meta.url), "utf8");
const refresh = await readFile(
  new URL("../.github/workflows/refresh-live-score.yml", import.meta.url), "utf8");

/* 06:00 WIB jatuh pada 23:00 UTC HARI SEBELUMNYA, jadi jendelanya selalu dua
   baris cron — dan penjaganya harus punya dua cabang yang sama. Satu baris
   yang lupa berarti jam pertama hari lomba tidak pernah terbit. */
const DUA_JENDELA = [
  ["2026-08-28T22:59", false, "05:59 WIB, sebelum jendela"],
  ["2026-08-28T23:00", true, "06:00 WIB, ujung awal"],
  ["2026-08-28T23:59", true, "06:59 WIB"],
  ["2026-08-29T00:00", true, "07:00 WIB"],
  ["2026-08-29T11:59", true, "18:59 WIB, ujung akhir"],
  ["2026-08-29T12:00", false, "19:00 WIB, sesudah jendela"],
  ["2026-08-29T16:00", false, "23:00 WIB, jendela lama yang dibuang"],
  ["2027-08-29T05:00", false, "tanggal sama tahun depan"],
];

const dalamJendela = (t) =>
  /^2026-08-28T23:/.test(t) || /^2026-08-29T(0[0-9]|1[01]):/.test(t);


test("rekap terbit tiap 15 menit hanya pada jam WIB hari-H", () => {
  assert.match(workflow, /- cron: '\*\/15 23 28 8 \*'/);
  assert.match(workflow, /- cron: '\*\/15 0-11 29 8 \*'/);
  assert.doesNotMatch(workflow, /cron: '\*\/15 \* \* \* \*'/,
    "cron tidak boleh berjalan tiap hari sepanjang tahun");
  assert.match(workflow, /\^2026-08-28T23:/,
    "jam pertama hari lomba jatuh pada tanggal UTC sebelumnya");
  assert.match(workflow, /\^2026-08-29T\(0\[0-9\]\|1\[01\]\):/,
    "tahun dan jendela UTC harus diperiksa sebelum penerbitan");
  assert.match(workflow,
    /uses: actions\/checkout@v4\s+if: steps\.jadwal\.outputs\.aktif == 'true'/,
    "scheduled run di luar jendela tidak boleh membaca repository");
  assert.match(workflow,
    /name: Tulis live\.json \+ rekap\.json dari database\s+if: steps\.jadwal\.outputs\.aktif == 'true'/,
    "scheduled run di luar jendela tidak boleh membaca database");
});


test("guard UTC membuka tepat 06:00-18:59 WIB pada 29 Agustus 2026", () => {
  for (const [waktu, harusAktif, kenapa] of DUA_JENDELA) {
    assert.equal(dalamJendela(waktu), harusAktif, `${waktu} — ${kenapa}`);
  }
});


test("papan panitia disegarkan lebih jarang, di jendela yang sama", () => {
  // Sepuluh menit, bukan lima: papan ini milik panitia, ditonton belasan orang,
  // dan tiap penyegaran menulis ulang payload 587 kB. Sejak #730 layarnya punya
  // tombol refresh sendiri untuk yang butuh angka sedetik itu.
  assert.match(refresh, /- cron: '\*\/10 23 28 8 \*'/);
  assert.match(refresh, /- cron: '\*\/10 0-11 29 8 \*'/);
  assert.doesNotMatch(refresh, /cron: '\*\/5 /,
    "lima menit terlalu rapat untuk papan yang ditonton belasan orang");
  // Penjaganya harus punya DUA cabang, sama dengan dua baris cron-nya.
  assert.match(refresh, /\^2026-08-28T23:/);
  assert.match(refresh, /\^2026-08-29T\(0\[0-9\]\|1\[01\]\):/);
});
