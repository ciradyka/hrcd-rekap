// ============================================================================
// hrcd-rekap : tests/gateway_account_permission.test.mjs
// Gateway akun mengikuti centang `akun`, bukan nama peran.
// ============================================================================

import assert from "node:assert/strict";
import test from "node:test";

import worker from "../workers/gateway/worker.js";

const env = {
  SUPABASE_URL: "https://db.example",
  SUPABASE_SERVICE_KEY: "service-key",
};

const request = () => new Request("https://gateway.example/akun/tidak-ada", {
  method: "POST",
  headers: { Authorization: "Bearer token-uji", "Content-Type": "application/json" },
  body: "{}",
});

async function jalankan(jawaban) {
  const asliFetch = globalThis.fetch;
  const antrean = [...jawaban];
  globalThis.fetch = async () => antrean.shift();
  try { return await worker.fetch(request(), env); }
  finally { globalThis.fetch = asliFetch; }
}

test("peran admin tanpa centang akun ditolak", async () => {
  const r = await jalankan([
    new Response(JSON.stringify({ id: "admin-uji" }), { status: 200 }),
    new Response(JSON.stringify([{ is_active: true }]), { status: 200 }),
    new Response(JSON.stringify([]), { status: 200 }),
  ]);
  assert.equal(r.status, 403);
  assert.match((await r.json()).message, /tidak berhak/i);
});

test("peran non-admin dengan centang akun melewati pagar", async () => {
  const r = await jalankan([
    new Response(JSON.stringify({ id: "registrasi-uji" }), { status: 200 }),
    new Response(JSON.stringify([{ is_active: true }]), { status: 200 }),
    new Response(JSON.stringify([{ fitur: "akun" }]), { status: 200 }),
  ]);
  // Rute sengaja tidak ada. 404 membuktikan pagar hak sudah terlewati; kalau
  // masih membandingkan peran, jawabannya 403 sebelum dispatch.
  assert.equal(r.status, 404);
});
