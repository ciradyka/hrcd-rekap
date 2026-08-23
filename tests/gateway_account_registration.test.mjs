// ============================================================================
// hrcd-rekap : tests/gateway_account_registration.test.mjs
// Pintu publik pembuat akun harus dibatasi sebelum menyentuh service role.
// ============================================================================

import assert from "node:assert/strict";
import test from "node:test";

import worker from "../workers/gateway/worker.js";

const url = "https://gateway.example/akun/daftar";
const isiSah = {
  username: "petugas.uji", password: "rahasia123", peran: "gerbang", pos: null,
};

const request = (body, headers = {}) => new Request(url, {
  method: "POST",
  headers: { origin: "https://panitia-hrcd37.ciradyka.workers.dev",
             "cf-connecting-ip": "203.0.113.7", ...headers },
  body,
});

function lingkungan(hitung = 0) {
  const put = [];
  const get = [];
  return {
    env: {
      RATE: {
        get: async kunci => { get.push(kunci); return String(hitung); },
        put: async (...arg) => { put.push(arg); },
      },
      SUPABASE_URL: "https://db.example",
      SUPABASE_SERVICE_KEY: "service-key",
    },
    get, put,
  };
}

test("body akun dibatasi walau Content-Length tidak dikirim", async () => {
  const { env } = lingkungan();
  const asliFetch = globalThis.fetch;
  let menyentuhSupabase = false;
  globalThis.fetch = async () => { menyentuhSupabase = true; throw new Error("tidak boleh"); };
  try {
    const r = await worker.fetch(request("x".repeat(2001)), env);
    assert.equal(r.status, 413);
    assert.equal(menyentuhSupabase, false);
  } finally {
    globalThis.fetch = asliFetch;
  }
});

test("budget akun memakai kunci dan jendela terpisah", async () => {
  const { env, get, put } = lingkungan(10);
  const r = await worker.fetch(request(JSON.stringify(isiSah)), env);
  assert.equal(r.status, 429);
  assert.deepEqual(get, ["rl:akun:203.0.113.7"]);
  assert.equal(put.length, 0);
});

test("akun yang benar-benar dibuat menghabiskan satu slot per jam", async () => {
  const { env, put } = lingkungan(0);
  const asliFetch = globalThis.fetch;
  const jawaban = [
    new Response(JSON.stringify({ id: "user-uji" }), { status: 200 }),
    new Response(null, { status: 201 }),
    new Response(JSON.stringify([]), { status: 200 }),
  ];
  globalThis.fetch = async () => jawaban.shift();
  try {
    const r = await worker.fetch(request(JSON.stringify(isiSah)), env);
    assert.equal(r.status, 200);
    assert.deepEqual(put, [["rl:akun:203.0.113.7", "1", { expirationTtl: 3600 }]]);
  } finally {
    globalThis.fetch = asliFetch;
  }
});
