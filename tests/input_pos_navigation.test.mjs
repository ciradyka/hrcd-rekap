// ============================================================================
// hrcd-rekap : tests/input_pos_navigation.test.mjs
// Enter di Input Pos harus turun dalam kolom lomba yang sama.
// ============================================================================

import assert from "node:assert/strict";
import test from "node:test";

import { kotakBerikutnyaDalamKolom } from "../web/js/util.js";

const kotak = (slot = "") => ({ dataset: slot ? { slot } : {} });
const sel = (...kotakIsian) => ({ querySelectorAll: () => kotakIsian });
const baris = (cells, hidden = false) => ({ cells, hidden, nextElementSibling: null });

function rangkai(...barisDaftar) {
  for (let i = 0; i < barisDaftar.length - 1; i += 1) {
    barisDaftar[i].nextElementSibling = barisDaftar[i + 1];
  }
}

test("Enter mengikuti kolom tabel melewati batas Intern dan Eksternal", () => {
  const asal = kotak();
  asal.closest = () => ({ cellIndex: 3 });

  const tersembunyi = kotak();
  const salahKolom = kotak();
  const tujuan = kotak();
  const pertama = baris([]);
  const disaring = baris([sel(), sel(), sel(), sel(tersembunyi)], true);
  // Baris Intern tidak punya lomba pada kolom 3. Ia punya input pada kolom 0,
  // tetapi input itu tidak boleh dianggap sebagai kolom yang sama.
  const intern = baris([sel(salahKolom), sel(), sel(), sel()]);
  const eksternal = baris([sel(), sel(), sel(), sel(tujuan)]);
  rangkai(pertama, disaring, intern, eksternal);

  assert.equal(kotakBerikutnyaDalamKolom(pertama, asal), tujuan);
});

test("Enter mempertahankan slot benar atau salah di dalam satu sel", () => {
  const asal = kotak("salah");
  asal.closest = () => ({ cellIndex: 4 });
  const benar = kotak("benar");
  const salah = kotak("salah");
  const pertama = baris([]);
  const berikutnya = baris([sel(), sel(), sel(), sel(), sel(benar, salah)]);
  rangkai(pertama, berikutnya);

  assert.equal(kotakBerikutnyaDalamKolom(pertama, asal), salah);
});

test("kotak biasa tidak mendarat di salah satu slot pasangan", () => {
  const asal = kotak();
  asal.closest = () => ({ cellIndex: 2 });
  const benar = kotak("benar");
  const salah = kotak("salah");
  const tujuan = kotak();
  const pertama = baris([]);
  const pasangan = baris([sel(), sel(), sel(benar, salah)]);
  const biasa = baris([sel(), sel(), sel(tujuan)]);
  rangkai(pertama, pasangan, biasa);

  assert.equal(kotakBerikutnyaDalamKolom(pertama, asal), tujuan);
});
