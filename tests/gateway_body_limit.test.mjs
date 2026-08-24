// ============================================================================
// hrcd-rekap : tests/gateway_body_limit.test.mjs
// Batas ukuran badan berlaku walau Content-Length TIDAK dikirim.
//
// Kenapa bentuk tesnya begini: pemeriksaan header sendirian TERLIHAT seperti
// pagar. `Transfer-Encoding: chunked` tidak membawa Content-Length, jadi
// angkanya 0 dan pemeriksaannya lolos apa pun isinya — lalu seluruh badan
// diserap ke memori isolate sebelum ada yang bisa menolak. Satu-satunya cara
// membuktikan pagarnya ada adalah mengirim badan tanpa Content-Length.
//
// `/daftar` adalah satu-satunya pintu yang terbuka ke internet tanpa login.
// ============================================================================

import assert from "node:assert/strict";
import test from "node:test";

import worker from "../workers/gateway/worker.js";


/** Request berbadan STREAM: fetch tidak bisa menghitung panjangnya di muka,
 *  jadi Content-Length tidak ikut — persis bentuk kiriman chunked. */
function requestTanpaPanjang(jalur, isi, headers = {}) {
  const badan = new ReadableStream({
    start(c) { c.enqueue(new TextEncoder().encode(isi)); c.close(); },
  });
  return new Request(`https://gateway.example${jalur}`, {
    method: "POST",
    headers: { origin: "https://hrcd37.ciradyka.workers.dev",
               "cf-connecting-ip": "203.0.113.9", ...headers },
    body: badan,
    duplex: "half",
  });
}

const lingkungan = () => ({
  RATE: { get: async () => "0", put: async () => {} },
  SUPABASE_URL: "https://db.example",
  SUPABASE_SERVICE_KEY: "service-key",
});


test("/daftar menolak badan besar tanpa Content-Length", async () => {
  const asliFetch = globalThis.fetch;
  let menyentuhSupabase = false;
  globalThis.fetch = async () => { menyentuhSupabase = true; throw new Error("tidak boleh"); };
  try {
    const req = requestTanpaPanjang("/daftar", "x".repeat(32_001));
    assert.equal(req.headers.get("content-length"), null,
      "fixture salah: Content-Length ikut terkirim");

    const r = await worker.fetch(req, lingkungan());
    assert.equal(r.status, 413);
    assert.equal(menyentuhSupabase, false,
      "badan besar sempat diteruskan ke Supabase");
  } finally {
    globalThis.fetch = asliFetch;
  }
});


test("/daftar tetap menerima badan wajar tanpa Content-Length", async () => {
  const asliFetch = globalThis.fetch;
  let dipanggil = null;
  globalThis.fetch = async (u, opsi) => {
    dipanggil = String(u);
    return new Response(JSON.stringify({ kode_pembayaran: "HRCD37-AAA111" }),
      { status: 200, headers: { "Content-Type": "application/json" } });
  };
  try {
    const isi = JSON.stringify({ nama_sekolah: "SMPN Uji", regu: [] });
    const r = await worker.fetch(requestTanpaPanjang("/daftar", isi), lingkungan());
    assert.notEqual(r.status, 413, "badan wajar ikut tertolak");
    assert.match(dipanggil || "", /submit_pendaftaran/);
  } finally {
    globalThis.fetch = asliFetch;
  }
});


test("rute /akun memakai BATAS_AKUN_BYTE, bukan cuma menyebutnya", async () => {
  const asliFetch = globalThis.fetch;
  // pastikanBolehAkun() memanggil GoTrue lalu dua kali PostgREST. Ketiganya
  // dijawab seolah pemanggilnya berhak, supaya yang teruji benar-benar batas
  // ukurannya dan bukan pagar haknya.
  globalThis.fetch = async (u) => {
    const s = String(u);
    if (s.includes("/auth/v1/user"))
      return new Response(JSON.stringify({ id: "uid-1" }), { status: 200 });
    if (s.includes("akun_panitia"))
      return new Response(JSON.stringify([{ is_active: true }]), { status: 200 });
    if (s.includes("akun_hak"))
      return new Response(JSON.stringify([{ fitur: "akun" }]), { status: 200 });
    throw new Error(`tidak boleh menyentuh ${s}`);
  };
  try {
    for (const jalur of ["/akun", "/akun/password", "/akun/username"]) {
      const r = await worker.fetch(
        requestTanpaPanjang(jalur, "x".repeat(2_001),
          { authorization: "Bearer token-uji",
            origin: "https://panitia-hrcd37.ciradyka.workers.dev" }),
        lingkungan());
      assert.equal(r.status, 413, `${jalur} menerima badan 2001 byte`);
    }
  } finally {
    globalThis.fetch = asliFetch;
  }
});


test("tidak ada rute yang membaca badan tanpa batas", async () => {
  const { readFile } = await import("node:fs/promises");
  const sumber = await readFile(
    new URL("../workers/gateway/worker.js", import.meta.url), "utf8");
  assert.doesNotMatch(sumber, /await req\.json\(\)/,
    "masih ada req.json() tanpa batas di gateway");
});
