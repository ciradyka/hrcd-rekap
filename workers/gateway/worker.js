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
const BATAS_AKUN_BYTE = 2_000;  // satu akun hanya beberapa ratus byte
// Longgar dengan sengaja: beberapa laptop meja mengisi pendaftaran offline
// dari WiFi venue yang sama (satu IP) bisa memicu ini kalau terlalu ketat.
// Angka ini cuma pagar terakhir untuk banjir skrip, bukan penghalang panitia.
const BATAS_PER_MENIT = 30;     // pengiriman per IP per menit
const BATAS_AKUN_PER_JAM = 10;  // pendaftaran mandiri akun per IP per jam

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

/** Kunci penyamaan nama akun — cermin kunci_akun() di migrasi 0078.
 *
 *  Titik tidak menjadikan nama jadi akun lain: `aji.furqon` dan `ajifurqon`
 *  orang yang sama, seperti Gmail. HANYA titik dan besar-kecil huruf; `-` dan
 *  `_` TIDAK ikut, karena meleburnya berarti melebur dua ORANG dan yang
 *  terlebur tidak pernah diberi tahu — ia cuma tidak bisa login.
 *
 *  Dipakai membentuk ALAMAT SUREL, bukan menggantikan nama yang disimpan.
 *  Nama disimpan seperti diketik; yang dibakukan cuma alamat yang dipakai
 *  GoTrue mencocokkan akun. Dengan begitu satu orang punya satu surel, apa
 *  pun bentuk titik yang ia ketik. */
const kunciAkun = (nama) => String(nama || "").toLowerCase().replace(/\./g, "");
const POLA_NAMA_AKUN = /^[a-z0-9]+(?:\.[a-z0-9]+)*$/;
const PESAN_NAMA_AKUN = "Nama akun minimal 5: huruf, angka, dan titik.";
const namaAkunSah = (nama) =>
  nama.length >= 5 && nama.length <= 40 && POLA_NAMA_AKUN.test(nama);

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
    // Authorization dipakai rute /akun: token sesi pemegang hak Akun.
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

function jawab(status, isi, req) {
  return new Response(JSON.stringify(isi), {
    status,
    headers: { "Content-Type": "application/json", ...cors(req) },
  });
}

/** Baca JSON sampai batas byte sungguhan, termasuk saat Content-Length tidak
 * dikirim. Berhenti membaca segera setelah batas terlewati. */
async function bacaJsonTerbatas(req, batas) {
  const panjang = Number(req.headers.get("content-length") || 0);
  if (panjang > batas) return { terlaluBesar: true };
  if (!req.body) return { salah: true };

  const reader = req.body.getReader();
  const potongan = [];
  let jumlah = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    jumlah += value.byteLength;
    if (jumlah > batas) {
      await reader.cancel();
      return { terlaluBesar: true };
    }
    potongan.push(value);
  }

  const gabung = new Uint8Array(jumlah);
  let posisi = 0;
  for (const p of potongan) { gabung.set(p, posisi); posisi += p.byteLength; }
  try { return { data: JSON.parse(new TextDecoder().decode(gabung)) }; }
  catch { return { salah: true }; }
}

/** Header service_role. Kunci ini hidup HANYA di Worker (wrangler secret). */
function kepalaLayanan(env) {
  return {
    "Content-Type": "application/json",
    apikey: env.SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
  };
}

/** Pastikan pemanggil benar-benar memegang hak Akun dan sedang login.
 *
 *  DUA langkah, dan keduanya wajib. Yang pertama membuktikan tokennya asli
 *  dan belum kedaluwarsa — itu dijawab GoTrue, bukan oleh kita. Yang kedua
 *  membuktikan pemilik token itu AKTIF dan memegang centang `akun`. Peran
 *  hanya mengisi centang awal; `akun_hak` adalah sumber hak yang berlaku.
 *
 *  Memeriksa isi JWT sendiri tanpa langkah pertama akan menerima token
 *  kedaluwarsa; memercayai peran dari klaim JWT tanpa langkah kedua akan
 *  menerima peran yang sudah dicabut tapi tokennya belum habis. */
async function pastikanBolehAkun(req, env) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer /i, "");
  if (!token) return { galat: jawab(401, { message: "Belum masuk." }, req) };

  const u = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${token}` },
  });
  if (!u.ok) return { galat: jawab(401, { message: "Sesi berakhir. Masuk lagi." }, req) };
  const user = await u.json();

  const a = await fetch(
    `${env.SUPABASE_URL}/rest/v1/akun_panitia?user_id=eq.${user.id}&select=is_active`,
    { headers: kepalaLayanan(env) });
  const baris = a.ok ? await a.json() : [];
  if (!baris.length || !baris[0].is_active)
    return { galat: jawab(403, { message: "Akun ini tidak aktif." }, req) };

  const h = await fetch(
    `${env.SUPABASE_URL}/rest/v1/akun_hak?user_id=eq.${user.id}&fitur=eq.akun&select=fitur`,
    { headers: kepalaLayanan(env) });
  const hak = h.ok ? await h.json() : [];
  if (!hak.length)
    return { galat: jawab(403, { message: "Akun ini tidak berhak mengelola akun." }, req) };

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
/** Pendaftaran mandiri seorang panitia.
 *
 *  Bedanya dengan buatAkun() ada tiga, dan ketiganya disengaja:
 *
 *  1. TIDAK ADA PEMERIKSAAN ADMIN. Siapa pun yang membuka layar login boleh
 *     mendaftar — itu permintaannya.
 *  2. AKUNNYA LAHIR NONAKTIF, selalu, tanpa cara mengubahnya dari sini.
 *     Inilah yang membuat butir 1 boleh ada: yang didapat pendaftar adalah
 *     antrean, bukan akses. Admin yang menyalakannya di layar Akun.
 *  3. PERAN `admin` DITOLAK. Yang bisa menyalakan akun tidak boleh lahir dari
 *     pintu yang tidak dijaga siapa pun.
 *
 *  Passwordnya datang dari pendaftar, tidak diacak seperti buatAkun() — ia
 *  yang akan memakainya, dan tidak ada admin yang akan membacakannya.
 */
async function daftarPanitia(req, env, b) {
  const username = String(b.username || "").trim().toLowerCase();
  const password = String(b.password || "");
  const peran = String(b.peran || "").trim();
  const pos = b.pos === null || b.pos === undefined || b.pos === "" ? null : Number(b.pos);

  /* HURUF, ANGKA, DAN TITIK — minimal lima. Bentuk yang dipakai panitia
     sendiri: `aji.furqon`, `admin.ciradyka`.

     Titiknya hanya boleh MEMISAHKAN, tidak di ujung dan tidak dua kali
     berturut-turut. Nama yang berbunyi "....." lolos pola yang lebih longgar,
     lalu dipakai membentuk alamat surel akun dan ditolak penyedia auth dengan
     pesan yang tidak menyebut titik sama sekali.

     Minimal LIMA: nama sependek "aji" tidak menyebut siapa pun di daftar
     berisi belasan akun, dan nama akun tidak bisa diganti sendiri oleh
     pemiliknya — hanya admin yang bisa. */
  if (!namaAkunSah(username))
    return jawab(400, { message: PESAN_NAMA_AKUN }, req);
  // Password BEBAS simbol; yang dibatasi cuma panjangnya.
  if (password.length < 8)
    return jawab(400, { message: "Password minimal 8 karakter." }, req);

  // `admin` DAN `koordinator_pos` sengaja TIDAK ada di daftar ini, dan
  // alasannya satu: keduanya peran yang berlaku di lebih dari satu meja, jadi
  // keduanya harus DIBERIKAN, bukan diminta sendiri lewat pintu yang tidak
  // dijaga siapa pun.
  //
  // Untuk koordinator_pos yang membukanya justru kolom `pos` yang kosong:
  // `pos_saya()` NULL, dan pagar `pos_saya() is null or pos = pos_saya()`
  // membuka KELIMA pos sekaligus (CLAUDE.md 13.2). Dari luar ia terlihat
  // sesederhana "juri pos tanpa pos", dan itulah yang membuatnya mudah lolos.
  //
  // Akun baru memang lahir `is_active: false`, tapi itu bukan pengganti pagar
  // ini: admin yang menekan Aktifkan sedang menjawab "orang ini benar", bukan
  // "peran yang ia pilihkan untuk dirinya sendiri benar".
  //
  // Kalau suatu hari peran baru ditambahkan, ia harus ditulis di sini juga —
  // dan kalau lupa, yang terjadi adalah penolakan, bukan kebocoran.
  if (!["registrasi", "gerbang", "juri_pos"].includes(peran))
    return jawab(400, { message: "Peran harus registrasi, gerbang, atau juri_pos." }, req);
  if ((peran === "juri_pos") !== (pos !== null))
    return jawab(400, { message: "Juri pos wajib menyebut posnya; peran lain tanpa pos." }, req);
  if (pos !== null && !(Number.isInteger(pos) && pos >= 1 && pos <= 20))
    return jawab(400, { message: "Pos harus 1–20." }, req);

  const email = `${kunciAkun(username)}@${DOMAIN_AKUN}`;
  const cu = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: kepalaLayanan(env),
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  const user = await cu.json();
  if (!cu.ok)
    return jawab(400, { message: "Nama akun sudah dipakai." }, req);

  const ins = await fetch(`${env.SUPABASE_URL}/rest/v1/akun_panitia`, {
    method: "POST",
    headers: { ...kepalaLayanan(env), Prefer: "return=minimal" },
    body: JSON.stringify({ user_id: user.id, username, peran, pos, is_active: false }),
  });
  if (!ins.ok) {
    // Sama seperti buatAkun(): user auth tanpa baris akun_panitia tidak bisa
    // login dan tidak terlihat di layar mana pun — jadi ia dibatalkan.
    await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${user.id}`,
      { method: "DELETE", headers: kepalaLayanan(env) });
    return jawab(400, { message: "Nama akun sudah dipakai." }, req);
  }

  // Centangnya diisi sekarang, bukan nanti saat diaktifkan: admin cukup
  // menekan satu tombol, dan akun yang menyala langsung bisa bekerja. Selama
  // is_active masih false, centang ini tidak membuka apa pun — boleh()
  // menuntut keduanya.
  const paket = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/paket_peran`, {
    method: "POST", headers: kepalaLayanan(env),
    body: JSON.stringify({ p_peran: peran }),
  });
  const fitur = paket.ok ? await paket.json() : [];
  if (fitur.length) {
    await fetch(`${env.SUPABASE_URL}/rest/v1/akun_hak`, {
      method: "POST",
      headers: { ...kepalaLayanan(env), Prefer: "return=minimal" },
      body: JSON.stringify(fitur.map(f => ({ user_id: user.id, fitur: f }))),
    });
  }

  return jawab(200, { ok: true, username }, req);
}

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
    // Pola yang SAMA dengan pendaftaran mandiri. Dulu pintu ini lebih longgar
    // (menerima `-`, `_`, titik ganda, titik di ujung, minimal 3), dan itu
    // berarti "akun ini sudah ada atau belum" dijawab berbeda tergantung pintu
    // mana yang dipakai.
    if (!namaAkunSah(username)) {
      hasil.push({ username, ok: false, pesan: PESAN_NAMA_AKUN });
      continue;
    }
    if (!["admin", "registrasi", "gerbang", "juri_pos", "koordinator_pos"]
          .includes(peran)) {
      hasil.push({ username, ok: false,
        pesan: "Peran harus admin, registrasi, gerbang, juri_pos, atau koordinator_pos." });
      continue;
    }
    if ((peran === "juri_pos") !== (pos !== null)) {
      hasil.push({ username, ok: false,
        pesan: "juri_pos wajib punya pos; peran lain wajib tanpa pos." });
      continue;
    }
    if (pos !== null && !(Number.isInteger(pos) && pos >= 1 && pos <= 20)) {
      hasil.push({ username, ok: false, pesan: "Pos harus 1–20." });
      continue;
    }

    const password = passwordAcak();
    const email = `${kunciAkun(username)}@${DOMAIN_AKUN}`;
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
  if (!namaAkunSah(username))
    return jawab(400, { message: PESAN_NAMA_AKUN }, req);

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
    body: JSON.stringify({ email: `${kunciAkun(username)}@${DOMAIN_AKUN}`, email_confirm: true }),
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

    /* Pendaftaran mandiri panitia. PUBLIK — itu memang gunanya — dan karena
       itu satu-satunya rute /akun yang berdiri SEBELUM pastikanBolehAkun().
       Urutannya penting: `startsWith("/akun")` di bawah akan menelannya dan
       menuntut token admin, yang berarti tidak ada satu orang pun yang bisa
       memakainya.

       Yang membuatnya boleh publik: akun yang lahir dari sini SELALU
       nonaktif. Ia bisa dibuat, tidak bisa dipakai. Setiap pagar di database
       menuntut `is_active` — boleh() (0057) dan peran() (0014) dua-duanya —
       jadi akun menunggu tidak memegang satu fitur pun, dan layar login pun
       menolaknya sebelum sesi terbentuk. */
    if (req.method === "POST" && url.pathname === "/akun/daftar") {
      const panjang = Number(req.headers.get("content-length") || 0);
      if (panjang > BATAS_AKUN_BYTE)
        return jawab(413, { message: "Data terlalu besar." }, req);

      const ip = req.headers.get("cf-connecting-ip") || "?";
      const kunci = `rl:akun:${ip}`;
      const hitung = Number((await env.RATE.get(kunci)) || 0);
      if (hitung >= BATAS_AKUN_PER_JAM)
        return jawab(429, {
          message: "Terlalu sering mendaftar akun. Tunggu satu jam, lalu coba lagi.",
        }, req);

      const baca = await bacaJsonTerbatas(req, BATAS_AKUN_BYTE);
      if (baca.terlaluBesar) return jawab(413, { message: "Data terlalu besar." }, req);
      if (baca.salah) return jawab(400, { message: "Format data salah." }, req);

      const hasil = await daftarPanitia(req, env, baca.data);
      if (hasil.ok) {
        await env.RATE.put(kunci, String(hitung + 1), { expirationTtl: 3600 });
      }
      return hasil;
    }

    // Rute akun: pemegang hak `akun` yang sedang login, bukan publik. Tidak
    // kena rate limit per IP — beberapa panitia menyiapkan satu edisi dari
    // satu WiFi, dan pagar untuk banjir skrip anonim tidak berlaku di sini.
    if (req.method === "POST" && url.pathname.startsWith("/akun")) {
      const { galat } = await pastikanBolehAkun(req, env);
      if (galat) return galat;
      // bacaJsonTerbatas, bukan req.json(): BATAS_AKUN_BYTE tidak pernah
      // menyentuh ketiga rute ini sebelumnya, jadi konstantanya membaca
      // seolah ia sudah menjaga sesuatu. Ketiganya di balik
      // pastikanBolehAkun(), jadi risikonya kecil — tapi batas yang cuma
      // tertulis dan tidak berlaku lebih buruk daripada batas yang tidak ada,
      // karena yang membacanya berhenti mencari.
      const baca = await bacaJsonTerbatas(req, BATAS_AKUN_BYTE);
      if (baca.terlaluBesar) return jawab(413, { message: "Data terlalu besar." }, req);
      if (baca.salah) return jawab(400, { message: "Format data salah." }, req);
      const b = baca.data;
      if (url.pathname === "/akun") return buatAkun(req, env, b);
      if (url.pathname === "/akun/password") return resetPassword(req, env, b);
      if (url.pathname === "/akun/username") return ubahUsername(req, env, b);
      return jawab(404, { message: "tidak ada" }, req);
    }

    if (req.method !== "POST" || url.pathname !== "/daftar")
      return jawab(404, { message: "tidak ada" }, req);

    // 1. Batas ukuran — jalan pintas murah, BUKAN pagarnya.
    //
    //    Kiriman `Transfer-Encoding: chunked` tidak membawa Content-Length,
    //    jadi `panjang` bernilai 0 dan pemeriksaan ini lolos apa pun isinya.
    //    Yang benar-benar menahan badan besar adalah bacaJsonTerbatas() di
    //    langkah 3 — ia berhenti membaca segera setelah batasnya terlewati.
    //    Baris ini dipertahankan karena ia menolak tanpa menyentuh badan sama
    //    sekali untuk kiriman yang jujur menyebut ukurannya.
    //
    //    /daftar adalah SATU-SATUNYA pintu yang terbuka ke internet tanpa
    //    login, dan pagar sisanya cuma rate limit 30/menit per IP.
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

    // 3. Baca badannya, berbatas. Ini pagar ukuran yang sebenarnya.
    const baca = await bacaJsonTerbatas(req, BATAS_BYTE);
    if (baca.terlaluBesar) return jawab(413, { message: "Data terlalu besar." }, req);
    if (baca.salah) return jawab(400, { message: "Format data salah." }, req);
    const b = baca.data;

    // 4. Turnstile — bukti pengirimnya manusia. Opsional: kalau secret belum
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

    // 5. Teruskan ke RPC (service role — satu-satunya pemegang hak ini).
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
