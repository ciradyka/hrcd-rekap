// Ukuran ikon tombol tidak boleh diam-diam ditimpa selector duplikat.

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";


const css = await readFile(new URL("../web/style.css", import.meta.url), "utf8");


test("ikon tombol mempunyai satu deklarasi ukuran", () => {
  const aturan = css.match(/\.icon-button \.ikon\s*\{[^}]+\}/g) || [];
  assert.equal(aturan.length, 1);
  assert.match(aturan[0], /width: 1\.4em; height: 1\.4em; display: block/);
});
