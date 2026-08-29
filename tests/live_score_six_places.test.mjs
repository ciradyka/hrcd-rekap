// Papan Live Score panitia menyebut enam nama, sama dengan lembar penghargaan:
// Juara 1-3 lalu Harapan 1-3. Yang dijaga di sini bukan tampilannya, melainkan
// bahwa keenamnya adalah regu yang SAMA dengan yang dipilih hasil_kejuaraan()
// — papan yang menyebut nama berbeda dari lembar yang dibacakan lebih buruk
// daripada papan yang berhenti di tiga.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panitia = await readFile(new URL("../web/js/app.js", import.meta.url), "utf8");
const kejuaraan = await readFile(
  new URL("../supabase/migrations/0139_kejuaraan.sql", import.meta.url), "utf8");
const gaya = await readFile(new URL("../web/style.css", import.meta.url), "utf8");

test("podium memuat enam tempat, bukan tiga", () => {
  assert.match(panitia, /\.sort\(urutJuara\)\.slice\(0, 6\)/);
});

test("keenamnya bermedali, dan Harapan memakai lambang yang sama", () => {
  const daftar = panitia.match(/const MEDALI = \{[^}]*\}/s)[0];
  for (const n of [1, 2, 3, 4, 5, 6]) assert.ok(daftar.includes(`${n}: "`));
  assert.equal((daftar.match(/🏅/g) || []).length, 3);
});

test("tempat 4-6 bernama Harapan 1-3", () => {
  assert.match(panitia,
    /gelar = \(n\) => n <= 3 \? `Juara \$\{n\}` : `Harapan \$\{n - 3\}`/);
});

test("pemecah serinya sama persis dengan hasil_kejuaraan()", () => {
  // SQL: total desc, abs(coalesce(selisih_menit, 100000)) asc, nomor_dada asc.
  assert.match(kejuaraan,
    /order by k\.total desc,\s*abs\(coalesce\(k\.selisih_menit, 100000\)\) asc,\s*k\.nomor_dada asc/);
  assert.match(panitia, /Math\.abs\(k\.selisih_menit \?\? 100000\)/);
  assert.match(panitia,
    /Number\(b\.total\) - Number\(a\.total\)\s*\|\| dekatKontrak\(a\) - dekatKontrak\(b\)\s*\|\| Number\(a\.nomor_dada\) - Number\(b\.nomor_dada\)/);
});

test("peringkat rank() tidak lagi menamai podium", () => {
  // rank() memberi angka yang sama pada skor yang sama lalu melompat, jadi
  // podium yang bersandar padanya menulis "Harapan 1" dua kali dan tidak
  // pernah menulis "Harapan 2".
  assert.doesNotMatch(panitia, /gelar\(k\.peringkat\)/);
  assert.doesNotMatch(panitia, /MEDALI\[k\.peringkat\] \|\| ""<\/div>/);
});

test("ketiga Harapan dibedakan satu kelas, bukan tiga selektor", () => {
  assert.match(panitia, /\$\{i >= 3 \? " harapan" : ""\}/);
  assert.match(gaya, /\.juara\.harapan \{/);
  assert.doesNotMatch(gaya, /\.juara\.j4/);
});
