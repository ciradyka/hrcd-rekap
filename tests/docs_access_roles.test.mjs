// Dokumen operasional tidak boleh menghidupkan kembali model role lama.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const alur = await readFile(new URL("../docs/alur-lomba.md", import.meta.url), "utf8");


test("alur lomba menyebut lima preset role yang berlaku", () => {
  for (const peran of ["admin", "registrasi", "gerbang", "juri_pos", "koordinator_pos"])
    assert.ok(alur.includes(`\`${peran}\``));
  assert.doesNotMatch(alur, /Ada tiga peran/);
  assert.doesNotMatch(alur, /`operator_pos`/);
  assert.doesNotMatch(alur, /`meja` \(petugas/);
});


test("alur lomba menjelaskan hak per fitur sebagai pintu", () => {
  assert.match(alur, /matriks `akun_hak`/);
  assert.match(alur, /`boleh\(fitur\)`/);
  assert.match(alur, /Peran memilih centang awal melalui `paket_peran\(\)`/);
});

