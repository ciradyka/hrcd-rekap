/* ============================================================================
   hrcd-rekap : workers/gateway/worker.js — gateway form pendaftaran publik.
   Satu-satunya kode "server" di seluruh sistem (rancangan-b.md bagian 8):
   verifikasi Turnstile (opsional) + rate limit per IP + batas ukuran ->
   panggil RPC submit_pendaftaran memakai service role. Kunci rahasia hidup
   di sini (wrangler secret), TIDAK PERNAH di SPA.

   Turnstile OPSIONAL: dilompati kalau TURNSTILE_SECRET tidak diisi (keputusan
   sadar edisi 37 — riwayat pendaftaran lewat Google Form sebelumnya tidak
   pernah disalahgunakan). Rate limit per IP tetap jalan tanpa Turnstile.

   Deploy:
     wrangler secret put SUPABASE_URL
     wrangler secret put SUPABASE_SERVICE_KEY
     wrangler secret put TURNSTILE_SECRET   (opsional — lihat catatan di atas)
     wrangler kv namespace create RATE   (binding: RATE)
     wrangler deploy
   ========================================================================== */

const BATAS_BYTE = 32_000;      // payload wajar: 30 regu ~ 6 KB
// Longgar dengan sengaja: beberapa laptop meja mengisi pendaftaran offline
// dari WiFi venue yang sama (satu IP) bisa memicu ini kalau terlalu ketat.
// Angka ini cuma pagar terakhir untuk banjir skrip, bukan penghalang panitia.
const BATAS_PER_MENIT = 30;     // pengiriman per IP per menit

// DUA asal, dan bedanya bukan kerapian. /daftar dipanggil form pendaftaran di
// situs PESERTA; rute /akun dipanggil layar Akun di situs PANITIA. Keduanya
// Worker terpisah dengan alamat sendiri (lihat web/wrangler.toml), jadi satu
// nilai tidak cukup.
const ASAL_PESERTA = "https://hrcd37.ciradyka.workers.dev";
const ASAL_PANITIA = "https://panitia-hrcd37.ciradyka.workers.dev";
const ASAL_BOLEH = [ASAL_PESERTA, ASAL_PANITIA];

// username + '@' + domain ini = email auth. Sama persis dengan `domainAkun`
// di web/config.js dan dengan yang dipakai scripts/provision_accounts.py —
// akun yang dibuat di sini harus bisa login lewat kotak login yang sama.
const DOMAIN_AKUN = "ciradyka.com";

// Tanpa karakter yang gampang tertukar saat diketik ulang di lapangan —
// sama dengan SAFE_ALPHABET di scripts/provision_accounts.py. Panitia
// mengetik password ini dari layar HP koordinator ke HP-nya sendiri, dan
// 0/O/1/l/I adalah sumber salah ketik yang paling sering.
const ABJAD_AMAN = "abcdefghjkmnpqrstuvwxyzACDEFGHJKLMNPQRSTUVWXYZ23456789";

function passwordAcak() {
  const b = new Uint32Array(10);
  crypto.getRandomValues(b);
  return Array.from(b, (n) => ABJAD_AMAN[n % ABJAD_AMAN.length]).join("");
}

function cors(req) {
  const asal = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ASAL_BOLEH.includes(asal) ? asal : ASAL_PESERTA,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    // Authorization dipakai rute /akun: token sesi admin yang sedang login.
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jawab(status, isi, req) {
  return new Response(JSON.stringify(isi), {
    status,
    headers: { "Content-Type": "application/json", ...cors(req) },
  });
}

/** Header service_role. Kunci ini hidup HANYA di Worker (wrangler secret). */
function kepalaLayanan(env) {
  return {
    "Content-Type": "application/json",
    apikey: env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
  };
}

/** Pastikan pemanggil benar-benar admin yang sedang login.
 *
 *  DUA langkah, dan keduanya wajib. Yang pertama membuktikan tokennya asli
 *  dan belum kedaluwarsa — itu dijawab GoTrue, bukan oleh kita. Yang kedua
 *  membuktikan pemilik token itu memang admin AKTIF, dan itu dibaca dari
 *  akun_panitia dengan service_role.
 *
 *  Memeriksa isi JWT sendiri tanpa langkah pertama akan menerima token
 *  kedaluwarsa; memercayai peran dari klaim JWT tanpa langkah kedua akan
 *  menerima peran yang sudah dicabut tapi tokennya belum habis. */
async function pastikanAdmin(req, env) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer /i, "");
  if (!token) return { galat: jawab(401, { message: "Belum masuk." }, req) };

  const u = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!u.ok) return { galat: jawab(401, { message: "Sesi berakhir. Masuk lagi." }, req) };
  const user = await u.json();

  const a = await fetch(
    `${env.SUPABASE_URL}/rest/v1/akun_panitia?user_id=eq.${user.id}&select=peran,is_active`,
    { headers: kepalaLayanan(env) });
  const baris = a.ok ? await a.json() : [];
  if (!baris.length || !baris[0].is_active || baris[0].peran !== "admin")
    return { galat: jawab(403, { message: "Hanya admin yang bisa mengelola akun." }, req) };

  return { uid: user.id };
}

/* ---------------------------------------------------------------- akun ----
   Tiga rute, dan semuanya ada di sini karena satu alasan yang sama: mereka
   menyentuh auth.users, dan itu butuh service_role. Sisanya — daftar akun,
   ganti peran, ganti pos, aktif/nonaktif — TIDAK lewat sini: policy
   `adm_akun` di 0003_rls.sql sudah mengizinkan admin melakukannya langsung
   dari SPA, dan menyalurkannya ke Worker cuma menambah lapisan tanpa
   menambah keamanan.
   -------------------------------------------------------------------------- */

/** Buat akun panitia: user di auth.users, lalu barisnya di akun_panitia.
 *  Password digenerate dan DIKEMBALIKAN — ini satu-satunya kesempatan
 *  membacanya, persis seperti CSV hasil provision_accounts.py. */
async function buatAkun(req, env, b) {
  const daftar = Array.isArray(b.akun) ? b.akun : [];
  if (!daftar.length) return jawab(400, { message: "Tidak ada akun untuk dibuat." }, req);
  if (daftar.length > 50) return jawab(400, { message: "Maksimal 50 akun sekali kirim." }, req);

  const hasil = [];
  for (const a of daftar) {
    const username = String(a.username || "").trim().toLowerCase();
    const peran = String(a.peran || "").trim();
    const pos = a.pos === null || a.pos === undefined || a.pos === "" ? null : Number(a.pos);

    // Divalidasi di sini SEKALIPUN database juga menolaknya, supaya baris
    // yang salah tidak sempat melahirkan user auth yatim: auth.users sudah
    // terbuat, lalu insert akun_panitia gagal, dan usernamenya jadi tidak
    // bisa dipakai lagi tanpa dibersihkan lewat dashboard.
    if (!/^[a-z0-9._-]{3,40}$/.test(username)) {
      hasil.push({ username, ok: false, pesan: "Nama akun hanya huruf kecil, angka, titik, dan strip (3–40)." });
      continue;
    }
    if (!["admin", "meja", "operator_pos"].includes(peran)) {
      hasil.push({ username, ok: false, pesan: "Peran harus admin, meja, atau operator_pos." });
      continue;
    }
    if ((peran === "operator_pos") !== (pos !== null)) {
      hasil.push({ username, ok: false, pesan: "operator_pos wajib punya pos; peran lain wajib tanpa pos." });
      continue;
    }
    if (pos !== null && !(Number.isInteger(pos) && pos >= 1 && pos <= 20)) {
      hasil.push({ username, ok: false, pesan: "Pos harus 1–20." });
      continue;
    }

    const password = passwordAcak();
    const email = `${username}@${DOMAIN_AKUN}`;
    const cu = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
      method: "POST",
      headers: kepalaLayanan(env),
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    const user = await cu.json();
    if (!cu.ok) {
      hasil.push({ username, ok: false, pesan: user.msg || user.message || "Email sudah terdaftar." });
      continue;
    }

    const ins = await fetch(`${env.SUPABASE_URL}/rest/v1/akun_panitia`, {
      method: "POST",
      headers: { ...kepalaLayanan(env), Prefer: "return=minimal" },
      body: JSON.stringify({ user_id: user.id, username, peran, pos }),
    });
    if (!ins.ok) {
      // Barisnya gagal, jadi usernya dibatalkan juga — kalau tidak, ada user
      // auth tanpa akun_panitia: tidak bisa login (login menuntut barisnya
      // ada) dan tidak terlihat di layar mana pun.
      await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${user.id}`,
        { method: "DELETE", headers: kepalaLayanan(env) });
      const e = await ins.json().catch(() => ({}));
      hasil.push({ username, ok: false, pesan: e.message || "Nama akun sudah dipakai." });
      continue;
    }
    // Centang awal sesuai perannya. Tanpa langkah ini akun baru lahir dengan
    // peran terisi tapi TANPA satu centang pun — bisa login, perannya terbaca
    // benar, dan setiap layar kosong. Daftar fiturnya dibaca dari
    // paket_peran() di database, tidak disalin ke sini: dua daftar suatu hari
    // tidak sepakat, dan yang di Worker akan jadi yang basi.
    const paket = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/paket_peran`, {
      method: "POST", headers: kepalaLayanan(env),
      body: JSON.stringify({ p_peran: peran }),
    });
    const fitur = paket.ok ? await paket.json() : [];
    if (fitur.length) {
      await fetch(`${env.SUPABASE_URL}/rest/v1/akun_hak`, {
        method: "POST",
        headers: { ...kepalaLayanan(env), Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify(fitur.map((f) => ({ user_id: user.id, fitur: f }))),
      });
    }
    hasil.push({ username, ok: true, peran, pos, password });
  }
  return jawab(200, { hasil }, req);
}

/** Reset password akun orang lain. Menggantikan change-password.yml yang
 *  selama ini dijalankan koordinator dari tab Actions di HP. */
async function resetPassword(req, env, b) {
  const uid = String(b.user_id || "");
  if (!uid) return jawab(400, { message: "Akun tidak disebut." }, req);
  const password = passwordAcak();
  const r = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
    method: "PUT",
    headers: kepalaLayanan(env),
    body: JSON.stringify({ password }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({}));
    return jawab(400, { message: e.msg || e.message || "Password gagal diganti." }, req);
  }
  return jawab(200, { password }, req);
}

/** Ganti username. Emailnya ikut, karena email = username + '@' + domain dan
 *  kotak login menyusunnya dari username yang diketik. Kalau cuma barisnya
 *  yang diganti, orangnya tetap harus login memakai nama lamanya — dan itu
 *  persis yang tidak akan terpikir saat dia gagal masuk. */
async function ubahUsername(req, env, b) {
  const uid = String(b.user_id || "");
  const username = String(b.username || "").trim().toLowerCase();
  if (!uid) return jawab(400, { message: "Akun tidak disebut." }, req);
  if (!/^[a-z0-9._-]{3,40}$/.test(username))
    return jawab(400, { message: "Nama akun hanya huruf kecil, angka, titik, dan strip (3–40)." }, req);

  // Barisnya dulu: kalau usernamenya sudah dipakai orang lain, UNIQUE
  // menolaknya di sini, sebelum emailnya terlanjur berubah.
  const up = await fetch(`${env.SUPABASE_URL}/rest/v1/akun_panitia?user_id=eq.${uid}`, {
    method: "PATCH",
    headers: { ...kepalaLayanan(env), Prefer: "return=minimal" },
    body: JSON.stringify({ username }),
  });
  if (!up.ok) {
    const e = await up.json().catch(() => ({}));
    return jawab(400, { message: e.message || "Nama akun sudah dipakai." }, req);
  }

  const em = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${uid}`, {
    method: "PUT",
    headers: kepalaLayanan(env),
    body: JSON.stringify({ email: `${username}@${DOMAIN_AKUN}`, email_confirm: true }),
  });
  if (!em.ok) {
    const e = await em.json().catch(() => ({}));
    return jawab(500, {
      message: `Nama akun sudah berubah, tapi emailnya gagal ikut (${e.msg || e.message || "?"}). `
        + "Akun ini belum bisa dipakai login — perbaiki lewat dashboard Supabase.",
    }, req);
  }
  return jawab(200, { username }, req);
}

export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { headers: cors(req) });
    const url = new URL(req.url);

    // Rute akun: admin yang sedang login, bukan publik. Tidak kena rate limit
    // per IP — beberapa panitia menyiapkan satu edisi dari satu WiFi, dan
    // pagar untuk banjir skrip anonim tidak berlaku di sini.
    if (req.method === "POST" && url.pathname.startsWith("/akun")) {
      const { galat } = await pastikanAdmin(req, env);
      if (galat) return galat;
      let b;
      try { b = await req.json(); } catch { return jawab(400, { message: "Format data salah." }, req); }
      if (url.pathname === "/akun") return buatAkun(req, env, b);
      if (url.pathname === "/akun/password") return resetPassword(req, env, b);
      if (url.pathname === "/akun/username") return ubahUsername(req, env, b);
      return jawab(404, { message: "tidak ada" }, req);
    }

    if (req.method !== "POST" || url.pathname !== "/daftar")
      return jawab(404, { message: "tidak ada" }, req);

    // 1. Batas ukuran — sebelum membaca isi.
    const panjang = Number(req.headers.get("content-length") || 0);
    if (panjang > BATAS_BYTE)
      return jawab(413, { message: "Data terlalu besar." }, req);

    // 2. Rate limit per IP — hanya DIBACA di sini. Penambahannya menunggu
    //    sampai Turnstile lolos, supaya satu sekolah yang mendaftar beramai-
    //    ramai dari satu WiFi tidak terkunci gara-gara percobaan gagal
    //    (temuan review: IP dipakai bersama satu sekolah).
    const ip = req.headers.get("cf-connecting-ip") || "?";
    const kunci = `rl:${ip}`;
    const hitung = Number((await env.RATE.get(kunci)) || 0);
    if (hitung >= BATAS_PER_MENIT)
      return jawab(429, { message: "Terlalu sering mengirim. Tunggu satu menit, lalu coba lagi." }, req);

    let b;
    try { b = await req.json(); } catch { return jawab(400, { message: "Format data salah." }, req); }

    // 3. Turnstile — bukti pengirimnya manusia. Opsional: kalau secret belum
    //    diisi, lompati pemeriksaan ini (lihat catatan di kepala berkas).
    if (env.TURNSTILE_SECRET) {
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
        return jawab(403, { message: "Verifikasi keamanan kedaluwarsa. Centang lagi kotak verifikasi, lalu tekan Kirim." }, req);
    }

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
        p_nama_kontak: b.nama_kontak || null,
        p_regu: b.regu,
        p_jumlah_pendamping: b.jumlah_pendamping || 0,
        // Kunci idempotensi: kiriman ulang setelah sinyal putus tidak
        // melahirkan pendaftaran kedua (migrasi 0006).
        p_kunci_kirim: b.kunci_kirim || null,
      }),
    });
    const isi = await r.json();
    if (!r.ok)
      return jawab(400, { message: isi.message || "Pendaftaran ditolak. Periksa isian." }, req);
    return jawab(200, isi, req);
  },

  // ------------------------------------------------------------------- cron
  // Project Supabase gratis dijeda setelah ±7 hari menganggur. Sistem ini
  // dipasang jauh sebelum lomba dan nyaris tidak disentuh sampai Januari,
  // jadi tanpa ini project sudah tertidur saat panitia membukanya.
  //
  // Satu bacaan sepele sudah cukup dihitung sebagai aktivitas. Kalau gagal,
  // biarkan gagal: jadwal berikutnya datang sendiri dan tidak ada yang
  // menunggu jawabannya. Jadwalnya di wrangler.toml.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      fetch(`${env.SUPABASE_URL}/rest/v1/edisi?select=nomor&limit=1`, {
        headers: {
          apikey: env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        },
      }).catch(() => {}),
    );
  },
};
