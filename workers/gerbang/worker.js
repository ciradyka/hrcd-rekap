/* ============================================================================
   hrcd-rekap : workers/gerbang/worker.js — gerbang form pendaftaran publik.
   Satu-satunya kode "server" di seluruh sistem (rancangan-b.md bagian 8):
   verifikasi Turnstile + rate limit per IP + batas ukuran -> panggil RPC
   submit_pendaftaran memakai service role. Kunci rahasia hidup di sini
   (wrangler secret), TIDAK PERNAH di SPA.

   Deploy:
     wrangler secret put SUPABASE_URL
     wrangler secret put SUPABASE_SERVICE_KEY
     wrangler secret put TURNSTILE_SECRET
     wrangler kv namespace create RATE   (binding: RATE)
     wrangler deploy
   ========================================================================== */

const BATAS_BYTE = 32_000;      // payload wajar: 30 regu ~ 6 KB
const BATAS_PER_MENIT = 5;      // pengiriman per IP per menit
const ASAL_BOLEH = "*";         // ganti ke origin Pages saat produksi

const CORS = {
  "Access-Control-Allow-Origin": ASAL_BOLEH,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jawab(status, isi) {
  return new Response(JSON.stringify(isi), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    if (req.method !== "POST" || url.pathname !== "/daftar")
      return jawab(404, { message: "tidak ada" });

    // 1. Batas ukuran — sebelum membaca isi.
    const panjang = Number(req.headers.get("content-length") || 0);
    if (panjang > BATAS_BYTE)
      return jawab(413, { message: "Data terlalu besar." });

    // 2. Rate limit per IP — hanya DIBACA di sini. Penambahannya menunggu
    //    sampai Turnstile lolos, supaya satu sekolah yang mendaftar beramai-
    //    ramai dari satu WiFi tidak terkunci gara-gara percobaan gagal
    //    (temuan review: IP dipakai bersama satu sekolah).
    const ip = req.headers.get("cf-connecting-ip") || "?";
    const kunci = `rl:${ip}`;
    const hitung = Number((await env.RATE.get(kunci)) || 0);
    if (hitung >= BATAS_PER_MENIT)
      return jawab(429, { message: "Terlalu sering mengirim. Tunggu satu menit, lalu coba lagi." });

    let b;
    try { b = await req.json(); } catch { return jawab(400, { message: "Format data salah." }); }

    // 3. Turnstile — bukti pengirimnya manusia.
    const cek = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: env.TURNSTILE_SECRET,
        response: b.turnstile || "",
        remoteip: ip,
      }),
    }).then(r => r.json());
    if (!cek.success)
      return jawab(403, { message: "Verifikasi keamanan kedaluwarsa. Centang lagi kotak verifikasi, lalu tekan Kirim." });

    await env.RATE.put(kunci, String(hitung + 1), { expirationTtl: 60 });

    // 4. Teruskan ke RPC (service role — satu-satunya pemegang hak ini).
    const r = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/submit_pendaftaran`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: env.SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({
        p_nama_sekolah: b.nama_sekolah,
        p_alamat_sekolah: b.alamat_sekolah,
        p_butuh_barak: !!b.butuh_barak,
        p_kontak_wa: b.kontak_wa,
        p_regu: b.regu,
        p_jumlah_pendamping: b.jumlah_pendamping || 0,
        // Kunci idempotensi: kiriman ulang setelah sinyal putus tidak
        // melahirkan pendaftaran kedua (migrasi 0006).
        p_kunci_kirim: b.kunci_kirim || null,
      }),
    });
    const isi = await r.json();
    if (!r.ok)
      return jawab(400, { message: isi.message || "Pendaftaran ditolak. Periksa isian." });
    return jawab(200, isi);
  },
};
