/* ============================================================================
   hrcd-rekap : api.js — satu pintu bicara ke backend.
   Dua mode lewat window.HRCD (config.js):
     mode 'dev'      -> dev server lokal (tests/dev_server.py) + Postgres lokal
     mode 'supabase' -> REST Supabase langsung (PostgREST + GoTrue), tanpa
                        library, tanpa build step — fetch polos.
   Semua layar hanya memanggil fungsi di file ini; tidak ada fetch liar.
   ========================================================================== */

const K = window.HRCD || { mode: "dev", devUrl: "http://127.0.0.1:8787" };
const BATAS_MS = 20000;   // internet lambat tidak boleh menggantung selamanya

/* ---------- sesi ----------
   localStorage, BUKAN sessionStorage: di HP, menutup tab/app (bahkan cuma
   berpindah app sebentar) sering dianggap browser sebagai "sesi berakhir"
   dan sessionStorage langsung kosong — panitia harus login ulang tiap kali
   membuka lagi. localStorage bertahan sampai betul-betul ditekan Keluar,
   dan token di dalamnya tetap kedaluwarsa sendiri via pastikanSesiSegar(). */

/** Apakah akun yang sedang login memegang fitur ini.
 *
 *  Cermin `boleh()` di database, dan HANYA untuk menggambar layar. Yang
 *  menegakkan tetap RLS — menyunting sesi di localStorage cuma memunculkan
 *  ubin yang begitu diklik menjawab kosong. */
export function bolehLihat(fitur) {
  const s = sesi();
  return !!s && Array.isArray(s.hak) && s.hak.includes(fitur);
}

/** Segarkan profil operasional dan `hak` saat aplikasi dibuka.
 *
 *  Admin dapat mengubah peran, pos, status aktif, dan centang hak ketika
 *  petugas masih login. Semuanya disimpan di localStorage untuk menggambar
 *  layar, jadi tanpa refresh petugas tetap melihat penempatan lama sampai
 *  keluar-masuk. Database tetap menjadi pagar; refresh ini menyamakan UI.
 *
 *  Kalau jaringan gagal, sesi lama dipertahankan. Mengosongkan hak hanya
 *  karena satu request putus akan mematikan seluruh papan di tengah shift. */
let sesiOperasionalSegar = false;
export async function lengkapiHakSesi() {
  const s = sesi();
  if (!s || sesiOperasionalSegar) return;
  try {
    let akun, hak;
    if (K.mode === "dev") {
      akun = await baca("/akun-saya");
      hak = await baca("/hak-saya");
    } else {
      const baris = await baca(null,
        `akun_panitia?user_id=eq.${s.uid}&select=username,peran,pos,is_active`);
      akun = baris && baris[0];
      hak = await baca(null, `akun_hak?user_id=eq.${s.uid}&select=fitur`);
    }
    if (!akun) return;
    // baca() mungkin sekaligus menyegarkan token. Ambil sesi terbaru agar
    // profil yang baru tidak menimpa token hasil refresh dengan salinan lama.
    const terbaru = sesi() || s;
    simpanSesi({ ...terbaru,
      username: akun.username,
      peran: akun.peran,
      pos: akun.pos,
      is_active: akun.is_active,
      hak: (hak || []).map(x => x.fitur),
    });
    sesiOperasionalSegar = true;
  } catch {
    // Sesi lama tetap dipakai; navigasi atau boot berikutnya mencoba lagi.
  }
}

export function sesi() {
  const s = localStorage.getItem("hrcd_sesi");
  return s ? JSON.parse(s) : null;
}
function simpanSesi(s) { localStorage.setItem("hrcd_sesi", JSON.stringify(s)); }
export function keluar() { localStorage.removeItem("hrcd_sesi"); }

/* ---------- kesalahan yang ramah ---------- */

export class ErrorApi extends Error {
  constructor(pesan) { super(pesan); this.name = "ErrorApi"; }
}

/** Terjemahkan pesan mentah (server / jaringan / enum RPC) jadi kalimat yang
 *  dimengerti panitia. Temuan review: 'invalid_grant' dan
 *  'menunggu_pembayaran' pernah tampil apa adanya di layar. */
export function pesanRamah(m) {
  if (!m) return "Terjadi kesalahan. Coba lagi.";
  const t = String(m);
  if (/invalid[_ ]grant|invalid login credentials|bad_credentials/i.test(t))
    return "Username atau password salah. Periksa lagi, lalu coba masuk.";
  if (/failed to fetch|networkerror|load failed|aborted|timeout/i.test(t))
    return "Internet lambat atau putus. Coba lagi — isianmu tidak hilang.";
  if (/jwt|token .*expired|pgrst301/i.test(t))
    return "Sesi sudah berakhir. Masuk lagi ya.";
  if (/berstatus lunas, bukan menunggu_pembayaran/i.test(t))
    return "Pembayaran ini sudah ditandai lunas sebelumnya. Ketik ulang kodenya untuk melihat kwitansinya.";
  if (/berstatus batal/i.test(t))
    return "Pendaftaran ini sudah dibatalkan. Panggil admin bila peserta merasa ini keliru.";
  if (/belum lunas/i.test(t))
    return "Sekolah ini belum membayar. Arahkan dulu ke meja pembayaran.";
  if (/tidak ada regu yang menunggu nomor dada/i.test(t))
    return "Semua regu sekolah ini sudah menerima nomor dada.";
  if (/nominal .* tidak sama dengan tagihan/i.test(t))
    return "Jumlah tagihan berubah (biaya per regu diperbarui admin). Muat ulang halaman, lalu ulangi.";
  if (/sudah daftar ulang \(nomor dada terbit\)/i.test(t))
    return "Nomor dada sudah diberikan ke sekolah ini. Kosongkan dulu nomor dadanya sebelum membatalkan status pembayaran.";
  if (/sudah dicentang hadir/i.test(t))
    return "Regu ini sudah dicentang hadir. Hapus dulu centang Hadir-nya di layar Keberangkatan, lalu pindahkan.";
  if (/tercatat ikut berangkat bersama kloter/i.test(t))
    return "Regu ini tercatat ikut berangkat bersama kloternya. Kalau itu keliru, batalkan dulu keberangkatan kloter tersebut lewat admin.";
  if (/belum berkontrak — konfirmasi kontrak dulu/i.test(t))
    return "Kloter ini sudah berangkat, jadi regunya wajib punya kontrak waktu dulu. Pilih kontraknya di kolom Kontrak Waktu, lalu centang lagi.";
  if (/daftar ulang sudah ditutup/i.test(t))
    return "Daftar ulang sudah ditutup panitia. Hubungi admin.";
  // Pesannya lahir di database (migrasi 0011/0014) dan membawa angka mentah:
  // "nomor dada sudah dipakai regu lain: 1, 2". Dirapikan di sini, satu
  // tempat, bukan dengan menyalin ulang badan fungsi plpgsql-nya.
  {
    const m = t.match(/nomor dada sudah dipakai regu lain:\s*(.+)$/i);
    if (m) {
      const nomor = m[1].split(/[,\s]+/).filter(Boolean)
        .map(x => /^\d{1,3}$/.test(x) ? x.padStart(3, "0") : x).join(", ");
      return `Nomor dada ${nomor} sudah dipakai regu lain.`;
    }
  }
  if (/regu_nama_unik|duplicate key value violates unique constraint "regu_nama/i.test(t))
    return "Nama regu itu sudah dipakai regu lain. Pilih nama yang berbeda.";
  if (/regu_nama_panjang/i.test(t))
    return "Nama regu paling panjang 25 karakter.";
  if (/nama_regu_angka_di_belakang/i.test(t))
    return "Angka di nama regu hanya boleh di belakang, misal: Cakra 1.";
  if (/nama_regu_tanpa_angka/i.test(t))
    return "Nama regu tidak boleh memakai angka.";
  if (/nama_ketua_tanpa_angka/i.test(t))
    return "Nama ketua tidak boleh memakai angka.";
  if (/nama_kontak_tanpa_angka/i.test(t))
    return "Nama contact person tidak boleh memakai angka.";
  if (/invalid input syntax for type uuid/i.test(t))
    return "Kunci pengiriman tidak valid. Muat ulang halaman, lalu coba lagi.";
  if (/permission denied|insufficient|tidak berhak:/i.test(t))
    return "Akun ini tidak berhak melakukan itu. Pakai akun yang sesuai.";
  if (/password.*(should be different|new password should be different)/i.test(t))
    return "Password baru harus beda dari password lama.";
  if (/password.*(at least|too short|should contain|characters)/i.test(t))
    return "Password baru terlalu pendek atau terlalu sederhana. Coba yang lain.";
  if (/cannot read propert|undefined is not|null is not/i.test(t))
    return "Layar gagal memuat data acara. Muat ulang halaman, lalu coba lagi.";
  return t.replace(/^.*?(ERROR|error):\s*/, "");
}

/* ---------- transport ---------- */

async function kirim(url, opsi = {}) {
  const ac = new AbortController();
  const jam = setTimeout(() => ac.abort(), BATAS_MS);
  let r;
  try {
    r = await fetch(url, { ...opsi, signal: ac.signal });
  } catch (e) {
    throw new ErrorApi(pesanRamah(e.name === "AbortError" ? "timeout" : e.message));
  } finally {
    clearTimeout(jam);
  }
  const teks = await r.text();
  let data = null;
  try { data = teks ? JSON.parse(teks) : null; } catch { data = teks; }
  if (!r.ok) {
    const pesan = (data && (data.message || data.error_description || data.error
                  || data.msg || data.hint))
      || (typeof data === "string" ? data : null) || `HTTP ${r.status}`;
    throw new ErrorApi(pesanRamah(String(pesan)));
  }
  return data;
}

function kepalaSupabase() {
  const h = { "Content-Type": "application/json", apikey: K.anonKey };
  const s = sesi();
  h.Authorization = `Bearer ${s && s.token ? s.token : K.anonKey}`;
  return h;
}

/** Perbarui access token dengan refresh token bila hampir kedaluwarsa.
 *  Temuan review: tanpa ini semua layar mati ±1 jam setelah masuk shift. */
async function pastikanSesiSegar() {
  if (K.mode !== "supabase") return;
  const s = sesi();
  if (!s || !s.refresh || !s.kedaluwarsa) return;
  if (Date.now() < s.kedaluwarsa - 120000) return;   // masih >2 menit
  try {
    const j = await kirim(`${K.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: K.anonKey },
      body: JSON.stringify({ refresh_token: s.refresh }),
    });
    simpanSesi({ ...s, token: j.access_token, refresh: j.refresh_token,
                 kedaluwarsa: Date.now() + (j.expires_in || 3600) * 1000 });
  } catch { /* biarkan panggilan berikutnya melempar 'sesi berakhir' */ }
}

async function rpc(nama, args) {
  if (K.mode === "dev") {
    const s = sesi();
    return kirim(`${K.devUrl}/rpc/${nama}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: s ? s.uid : null, args: args || {} }),
    });
  }
  await pastikanSesiSegar();
  return kirim(`${K.supabaseUrl}/rest/v1/rpc/${nama}`, {
    method: "POST",
    headers: kepalaSupabase(),
    body: JSON.stringify(args || {}),
  });
}

async function baca(jalurDev, jalurSupabase) {
  if (K.mode === "dev") {
    const s = sesi();
    const pisah = jalurDev.includes("?") ? "&" : "?";
    return kirim(`${K.devUrl}${jalurDev}${s ? `${pisah}uid=${s.uid}` : ""}`, {});
  }
  await pastikanSesiSegar();
  return kirim(`${K.supabaseUrl}/rest/v1/${jalurSupabase}`, { headers: kepalaSupabase() });
}

/* ============================ AKSES ===================================== */

export async function masuk(username, password) {
  let s;
  if (K.mode === "dev") {
    s = await kirim(`${K.devUrl}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
  } else {
    /* TITIK TIDAK MENJADIKANNYA AKUN LAIN — `aji.furqon` dan `ajifurqon`
       masuk ke akun yang sama, seperti Gmail.

       Yang mencocokkan akun di sini adalah `auth.users.email`, bukan
       `akun_panitia.username`: barisnya baru dibaca sesudah token didapat.
       Jadi penyamaannya harus terjadi SEBELUM surelnya dikirim, dan akun baru
       memang dibuat dengan surel berkunci (gateway kunciAkun()).

       DUA PERCOBAAN, dan yang kedua bukan kemalasan. Akun yang lahir sebelum
       aturan ini — `admin.ciradyka` salah satunya — surelnya masih mengandung
       titik di GoTrue. Mengganti surel mereka menuntut service_role, dan
       kalau berhenti di tengah yang terkunci justru satu-satunya admin yang
       bisa membetulkannya. Percobaan kedua menanggung mereka tanpa menyentuh
       satu baris data pun, dan hanya berjalan kalau yang pertama gagal DAN
       namanya memang bertitik. */
    const kunciAkun = (n) => n.toLowerCase().replace(/\./g, "");
    const surel = (n) => n.includes("@")
      ? `${kunciAkun(n.slice(0, n.lastIndexOf("@")))}${n.slice(n.lastIndexOf("@"))}`
      : `${kunciAkun(n)}@${K.domainAkun}`;
    const apaAdanya = username.includes("@") ? username : `${username}@${K.domainAkun}`;

    const minta = (email) => kirim(`${K.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: K.anonKey },
      body: JSON.stringify({ email, password }),
    });

    let j;
    try {
      j = await minta(surel(username));
    } catch (e) {
      if (surel(username) === apaAdanya) throw e;
      j = await minta(apaAdanya);
    }
    const kepala = { apikey: K.anonKey, Authorization: `Bearer ${j.access_token}` };
    const akun = await kirim(
      `${K.supabaseUrl}/rest/v1/akun_panitia?user_id=eq.${j.user.id}&select=username,peran,pos,is_active`,
      { headers: kepala });
    if (!akun.length || !akun[0].is_active)
      throw new ErrorApi("Akun ini belum diaktifkan. Minta admin menyalakannya di layar Akun.");
    // Hak dibawa ke dalam sesi supaya papan Home bisa memilih ubinnya tanpa
    // satu permintaan lagi tiap kali dibuka. Ini HANYA untuk menggambar —
    // yang menegakkan tetap RLS, dan sesi yang diutak-atik di devtools tidak
    // mendapat satu baris pun lebih banyak.
    const hak = await kirim(
      `${K.supabaseUrl}/rest/v1/akun_hak?user_id=eq.${j.user.id}&select=fitur`,
      { headers: kepala }).catch(() => []);
    s = {
      uid: j.user.id, token: j.access_token, refresh: j.refresh_token,
      kedaluwarsa: Date.now() + (j.expires_in || 3600) * 1000,
      ...akun[0],
      hak: (hak || []).map(x => x.fitur),
    };
  }
  simpanSesi(s);
  return s;
}

/** Panitia mengganti PASSWORD AKUN SENDIRI — bukan admin mengganti punya
 *  orang lain (itu jalurnya scripts/ganti_password.py + service_role, dari
 *  luar aplikasi). Ini murni self-service: pakai token sesi yang sedang
 *  login, lewat endpoint bawaan GoTrue yang memang mengizinkan pengguna
 *  mengubah datanya sendiri — tidak perlu service_role sama sekali. */
export async function gantiPasswordSendiri(passwordBaru) {
  if (K.mode === "dev") {
    // Dev server tidak menyimpan password sungguhan (README: "password
    // bebas di dev") — tidak ada yang perlu ditimpa, cukup berhasil supaya
    // alur layarnya bisa dicoba.
    return { ok: true };
  }
  await pastikanSesiSegar();
  return kirim(`${K.supabaseUrl}/auth/v1/user`, {
    method: "PUT",
    headers: kepalaSupabase(),
    body: JSON.stringify({ password: passwordBaru }),
  });
}

/* ============================ FORM PUBLIK ================================ */

export async function daftarSekolah() {
  // Dimuat SEKALI saat halaman dibuka, difilter di browser.
  if (K.mode === "dev") return baca("/sekolah");
  return kirim(`${K.supabaseUrl}/rest/v1/sekolah?select=id,name,address&order=name`, {
    headers: { apikey: K.anonKey, Authorization: `Bearer ${K.anonKey}` },
  });
}

export async function infoEdisi() {
  if (K.mode === "dev") return baca("/edisi");
  const d = await kirim(`${K.supabaseUrl}/rest/v1/v_edisi_publik?select=*`, {
    headers: { apikey: K.anonKey, Authorization: `Bearer ${K.anonKey}` },
  });
  if (!d.length) throw new ErrorApi("Belum ada edisi lomba yang dibuka.");
  return d[0];
}

/** Konfigurasi dan jumlah regu untuk nilai awal Kalkulator Keberangkatan. */
export async function infoPengaturanKloter() {
  if (K.mode === "dev") return baca("/pengaturan-kloter");
  const [edisi, regu, status] = await Promise.all([
    baca(null,
      "edisi?is_active=eq.true" +
      "&select=jam_mulai_berangkat,jam_batas_berangkat," +
      "maks_eksternal_per_kloter,maks_intern_per_kloter," +
      "perkiraan_regu_eksternal,perkiraan_regu_intern,kloter_maks," +
      // Jeda maksimal antar kloter (migrasi 0118). Kolomnya ADA sejak 0001,
      // jadi menyebutnya di sini aman walau migrasinya belum dijalankan —
      // yang berbeda cuma nilainya (4 sebelum, 5 sesudah). Kalau kolomnya
      // yang belum ada, PostgREST menjawab 42703 dan seluruh layar Daftar
      // Kloter mati; lihat catatan panjang di bawah.
      "interval_berangkat_menit"),
    baca(null, "regu?is_cancelled=eq.false&select=golongan"),
    // Jendela Planning Keberangkatan (migrasi 0113). Tinggal di status_acara,
    // bukan di edisi, karena ia disusun pada hari-H — hari yang sama saat
    // kunci konfigurasi menyala dan menutup seluruh tabel setelan.
    // GAGALNYA DITELAN, dan itu wajib. Kolom ini lahir di migrasi 0113,
    // sementara situs panitia terbit pada TIAP MERGE dan migrasi dijalankan
    // terpisah sesudahnya (CLAUDE.md 7.6). Di sela keduanya PostgREST
    // menjawab 42703 "column does not exist" — dan tanpa penangkap ini
    // Promise.all melempar, `infoPengaturanKloter()` gagal, lalu SELURUH
    // layar Daftar Kloter mati. Bukan cuma planningnya: daftar kloter,
    // pratayang, dan kedua tombol cetak ikut hilang.
    //
    // Sudah terjadi sekali, pada 27 Agustus 2026, dua hari sebelum lomba.
    //
    // Kosong = jendela jatuh ke konfigurasi edisi, persis perilaku sebelum
    // 0113. Yang hilang cuma penyimpanannya, dan itu menyalak sendiri saat
    // panitia menggeser jamnya.
    baca(null, "status_acara?id=eq.true" +
      "&select=planning_berangkat_pertama,planning_berangkat_terakhir")
      .catch(() => []),
  ]);
  if (!edisi.length) throw new ErrorApi("Belum ada edisi aktif.");
  return {
    ...edisi[0],
    ...(status[0] || {}),
    jumlah_eksternal: regu.filter(r => !String(r.golongan).startsWith("intern_")).length,
    jumlah_intern: regu.filter(r => String(r.golongan).startsWith("intern_")).length,
  };
}

/** Simpan jendela Planning Keberangkatan. Kosong = ikut konfigurasi edisi. */
export const aturPlanningBerangkat = (pertama, terakhir) =>
  rpc("atur_planning_berangkat", { p_pertama: pertama, p_terakhir: terakhir });

/** Apakah nama regu itu sudah dipakai (0051)? Dipanggil SAMBIL pembina
 *  mengetik — menolak saat tombol Kirim ditekan sudah terlambat, karena saat
 *  itu ia baru saja mengisi lima regu.
 *
 *  Anon: form pendaftaran memang tanpa login. */
export async function namaReguDipakai(nama) {
  if (K.mode === "dev") return baca(`/nama-regu-dipakai?nama=${encodeURIComponent(nama)}`);
  return kirim(`${K.supabaseUrl}/rest/v1/rpc/nama_regu_dipakai`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: K.anonKey,
               Authorization: `Bearer ${K.anonKey}` },
    body: JSON.stringify({ p_nama: nama }),
  });
}

export async function kirimPendaftaran(payload, tokenTurnstile) {
  if (K.mode === "dev") {
    return kirim(`${K.devUrl}/daftar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }
  return kirim(`${K.gatewayUrl}/daftar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, turnstile: tokenTurnstile }),
  });
}

/* ---------------------- BUKTI TRANSFER (migrasi 0121) --------------------

   Satu-satunya unggahan di seluruh sistem yang datang dari orang yang TIDAK
   login. Karena itu jalannya sengaja beda dari unggahFotoLembar di bawah: ia
   tidak pernah menyegarkan sesi, dan tidak pernah memakai token siapa pun —
   anon key saja, persis seperti pembina yang membuka form dari HP-nya.

   Folder pertama WAJIB kunci_kirim, dan itu ditegakkan dua kali: policy
   storage.objects hanya menerima nama berbentuk `<uuid>/<sesuatu>.jpg`, dan
   submit_pendaftaran menolak path yang folder-nya bukan kunci_kirim kiriman
   itu sendiri. Yang pertama menjaga bucket, yang kedua menjaga supaya satu
   pendaftaran tidak mengaku memakai bukti milik pendaftaran lain.           */

const BUCKET_BUKTI = "bukti";

export function namaObjekBukti(kunciKirim) {
  const acak = Math.random().toString(36).slice(2, 8);
  return `${kunciKirim}/bukti-${Date.now()}-${acak}.jpg`;
}

/** Unggah satu bukti transfer, kembalikan path-nya untuk dikirim ke RPC.
 *
 *  Gambarnya sudah dikecilkan pemanggil lewat kecilkanFoto(). Bucket menolak
 *  apa pun di atas 1 MB dan apa pun yang bukan JPEG — pagar kedua untuk saat
 *  pengecilan itu gagal diam-diam. */
export async function unggahBuktiTransfer(kunciKirim, blob) {
  const path = namaObjekBukti(kunciKirim);
  // Dev server tidak punya Storage. Path-nya tetap dikembalikan supaya alur
  // formnya bisa dicoba tanpa Supabase.
  if (K.mode === "dev") return path;

  await kirim(`${K.supabaseUrl}/storage/v1/object/${BUCKET_BUKTI}/${path}`, {
    method: "POST",
    headers: {
      apikey: K.anonKey,
      Authorization: `Bearer ${K.anonKey}`,
      "Content-Type": "image/jpeg",
      "x-upsert": "false",
    },
    body: blob,
  });
  return path;
}

/** Link sementara untuk melihat satu bukti transfer di Meja Pembayaran.
 *  Alasannya sama dengan tautanFoto(): bucket-nya privat, dan link yang tidak
 *  kedaluwarsa akan beredar di WhatsApp selamanya. */
export async function tautanBukti(path) {
  if (K.mode === "dev" || !path) return null;
  // Bukti yang datang dari Google Form XXXVII (migrasi 0130) berupa LINK
  // Drive, bukan objek di bucket kita — berkasnya masih milik penyelenggara
  // form dan aksesnya sedang diminta. Link dibuka apa adanya; menandatanganinya
  // sebagai path Storage menghasilkan 404 yang terbaca "bukti hilang", padahal
  // ia ada dan cuma tinggal di tempat lain.
  //
  // Cabang ini juga yang membuat pemindahan nanti tidak menyentuh layar mana
  // pun: begitu berkasnya masuk bucket dan kolomnya diganti path, `path` tidak
  // lagi berawalan http dan jalur tanda tangan di bawah yang dipakai lagi.
  if (/^https?:\/\//i.test(path)) return path;
  await pastikanSesiSegar();
  const j = await kirim(
    `${K.supabaseUrl}/storage/v1/object/sign/${BUCKET_BUKTI}/${path}`, {
      method: "POST",
      headers: kepalaSupabase(),
      body: JSON.stringify({ expiresIn: 3600 }),
    });
  return `${K.supabaseUrl}/storage/v1${j.signedURL || j.signedUrl}`;
}

/* ============================ MEJA ====================================== */

export async function ringkasanMeja() {
  if (K.mode === "dev") return baca("/ringkasan");
  // Dihitung dari sisi regu supaya angkanya benar-benar "batch lunas yang
  // masih punya regu tanpa nomor dada" (temuan review: query lama salah).
  const [menunggu, tanpaNomor, kemajuan] = await Promise.all([
    baca(null, "pendaftaran?status=eq.menunggu_pembayaran&select=id"),
    baca(null, "regu?nomor_dada=is.null&is_cancelled=is.false" +
               "&select=pendaftaran_id,pendaftaran!inner(status)" +
               "&pendaftaran.status=eq.lunas"),
    baca(null, "v_kemajuan_hari?select=*"),
  ]);
  const k = (Array.isArray(kemajuan) ? kemajuan[0] : kemajuan) || {};
  return {
    menunggu_pembayaran: menunggu.length,
    lunas_belum_nomor: new Set(tanpaNomor.map(r => r.pendaftaran_id)).size,
    regu_siap: k.regu_siap ?? null,
    regu_berangkat: k.regu_berangkat ?? null,
    regu_datang: k.regu_datang ?? null,
  };
}

/** Semua pendaftaran sekaligus — bahan layar tabel Pembayaran & Daftar Ulang.
 *  Dimuat SEKALI lalu disaring di browser: jumlahnya ratusan (bukan ribuan),
 *  dan filter yang terasa seketika jauh lebih berguna di meja daripada
 *  bolak-balik ke server tiap ketukan huruf. */
export async function daftarPendaftaran() {
  if (K.mode === "dev") return baca("/daftar-pendaftaran");
  return baca(null,
    "pendaftaran?select=id,kode_pembayaran,status,jumlah_regu," +
    "butuh_barak,kontak_wa,created_at,metode_bayar,bukti_transfer," +
    "sekolah(name,address)," +
    "regu(id,nama_regu,nama_ketua,golongan,nomor_dada,kloter_nomor,is_cancelled)," +
    "pembayaran(amount,method,nomor_kwitansi,verified_at)" +
    "&regu.order=nama_regu.asc&order=created_at.asc");
}

/** Bahan layar Data Peserta: yang BISA DIBETULKAN, dan tidak lebih.
 *
 *  Sengaja tidak memakai daftarPendaftaran() walau dua-duanya membaca tabel
 *  yang sama. Layar itu perlu tagihan, metode bayar, dan kwitansi; layar ini
 *  perlu nama anggota dan kelas/organisasi. Satu bentuk untuk keduanya berarti
 *  tiap layar mengirimkan kolom yang tidak dipakainya ke ratusan baris — dan
 *  yang lebih mahal, tiap perubahan pada salah satunya menyentuh keduanya. */
export async function dataPeserta() {
  if (K.mode === "dev") return baca("/data-peserta");
  return baca(null,
    "pendaftaran?select=id,kode_pembayaran,status,jumlah_regu,kontak_wa," +
    "nama_kontak,created_at,sekolah(name)," +
    "regu(id,nama_regu,nama_ketua,golongan,anggota,kelas_organisasi," +
    "nomor_dada,is_cancelled)" +
    "&regu.order=nama_regu.asc&order=created_at.asc");
}

/** Betulkan kontak pembina satu pendaftaran (migrasi 0135). Nama dan nomor
 *  dikirim BERSAMA: yang mengganti nomor hampir selalu mengganti orangnya. */
export async function ubahKontakPendaftaran(kode, namaKontak, kontakWa) {
  return rpc("ubah_kontak_pendaftaran", {
    p_kode: kode, p_nama_kontak: namaKontak || null, p_kontak_wa: kontakWa,
  });
}

/** Betulkan identitas satu regu (migrasi 0135). Golongan, sekolah, nomor dada
 *  dan status bayar TIDAK di sini — masing-masing punya jalurnya sendiri. */
export async function ubahIdentitasRegu(reguId, data) {
  return rpc("ubah_identitas_regu", {
    p_regu_id: reguId,
    p_nama_regu: data.nama_regu,
    p_nama_ketua: data.nama_ketua,
    p_anggota: data.anggota || [],
    p_kelas_organisasi: data.kelas_organisasi || null,
  });
}

export const verifikasiPembayaran = (kode, nominal, metode) =>
  rpc("verifikasi_pembayaran", { p_kode: kode, p_nominal: nominal, p_metode: metode });

export const batalkanVerifikasi = (kode, alasan) =>
  rpc("batalkan_verifikasi", { p_kode: kode, p_alasan: alasan });

/** pasangan: [{ regu_id, nomor_dada }] — satu entri untuk SETIAP regu batch
 *  yang belum bernomor. Nomornya diketik petugas dari kain fisik di meja,
 *  bukan diterbitkan sistem (migrasi 0011). */
export const daftarUlang = (kode, pasangan) =>
  rpc("daftar_ulang_batch", { p_kode: kode, p_nomor: pasangan });

export const tukarNomor = (reguId, nomorBaru, alasan) =>
  rpc("tukar_nomor_dada", { p_regu: reguId, p_nomor_baru: nomorBaru, p_alasan: alasan });

/* ============================ CETAK KLOTER ============================== */

export async function daftarKloter() {
  if (K.mode === "dev") return baca("/kloter");
  return baca(null, "v_daftar_kloter?select=*&order=kloter.asc,urutan.asc");
}

export const tandaiKloterDicetak = (nomorKloter) =>
  rpc("tandai_kloter_dicetak", { p_kloter: nomorKloter || null });

/** Pindah kloter hari-H. kloter null = "telat biasa" -> kloter terakhir yang
 *  belum berangkat. kloter diisi = "urgent" -> paksa ke kloter itu. */
export const pindahKloter = (nomorDada, alasan, kloter = null) =>
  rpc("pindah_kloter", { p_nomor_dada: nomorDada, p_alasan: alasan, p_kloter: kloter });

/** Lookup cepat satu regu untuk layar finish — dipanggil sambil mengetik,
 *  jadi harus ringan dan tidak pernah melempar untuk "tidak ketemu". */
export async function cariRegu(nomorDada) {
  const d = K.mode === "dev"
    ? await baca(`/regu?dada=${encodeURIComponent(nomorDada)}`)
    : await baca(null, `v_regu_ringkas?nomor_dada=eq.${encodeURIComponent(nomorDada)}&select=*`);
  return d.length ? d[0] : null;
}

/** Saklar hari-H: daftar_ulang_ditutup, fase_live, konfigurasi_terkunci.
 *  Dipakai layar cetak untuk memperingatkan bahwa kertas yang dicetak
 *  sebelum daftar ulang ditutup pasti kehilangan regu yang datang setelahnya. */
/** Buka / tutup klasemen untuk peserta.
 *
 *  TIDAK menerbitkan apa pun sendiri. Halaman peserta membaca live.json dan
 *  rekap.json — berkas statis yang ditulis ulang publish-live.yml. Layar yang
 *  memanggil ini wajib mengatakannya; tombol yang mengaku sudah menerbitkan
 *  padahal belum adalah cara tercepat membuat panitia mengumumkan juara yang
 *  tidak ada di layar peserta. */
export async function aturFaseLive(fase) {
  return rpc("atur_fase_live", { p_fase: fase });
}

export async function statusAcara() {
  const d = K.mode === "dev"
    ? await baca("/status")
    : await baca(null, "status_acara?select=*");
  return Array.isArray(d) ? d[0] : d;
}

/** Tombol Refresh layar Live Score: MINTA DATABASE MENGHITUNG ULANG, lalu
 *  kembalikan cap waktu snapshot yang berlaku sesudahnya.
 *
 *  DUDUK DI BAWAH statusAcara(), bukan di atasnya bersama aturFaseLive() yang
 *  sama-sama soal Live Score. Sebabnya di tes: dev_live_phase_route mengiris
 *  aturFaseLive() SAMPAI statusAcara() lalu melarang kata K-titik-mode muncul
 *  di dalam irisan itu, jadi fungsi apa pun yang disisipkan di antara keduanya
 *  ikut terbaca sebagai badan aturFaseLive \u2014 termasuk komentarnya.
 *
 *  Tanpa ini tombolnya cuma membaca ulang `cache_live_score`, dan yang mengisi
 *  tabel itu satu-satunya adalah cron `refresh-live-score.yml` yang sengaja
 *  hanya hidup pada tanggal lomba. Di luar dua hari itu angkanya tidak pernah
 *  berubah, dan tidak ada satu pun galat — membaca snapshot beku memang
 *  berhasil. Terukur: penyegaran terakhir 29 Agustus 16:55 UTC, dilaporkan
 *  panitia 31 Agustus.
 *
 *  Pagarnya di database (migrasi 0165), bukan di sini: hak `live_score`,
 *  ambang 5 detik untuk penekanan berbarengan, dan kunci supaya belasan HP
 *  tidak menghitung hal yang sama sekaligus.
 *
 *  Lewat pembungkus `rpc()` yang sama di dev dan produksi, tanpa cabang
 *  `K.mode`. Cabang seperti itu berarti yang dijalankan panitia bukan jalur
 *  yang pernah dicoba siapa pun di laptop — dan `tests/dev_server.py` memang
 *  menyediakan rutenya, jadi tidak ada yang perlu dipintas. */
export async function segarkanLiveScore() {
  return rpc("minta_segarkan_live_score", {});
}

/** Angka penalti edisi aktif — dipakai layar finish untuk menunjukkan apakah
 *  selisih jam kertas vs laptop benar-benar mengubah penalti. */
export async function infoPenalti() {
  const d = K.mode === "dev"
    ? await baca("/penalti")
    : await baca(null, "konfig_penalti?select=*");
  return Array.isArray(d) ? d[0] : d;
}

export const catatFinish = (nomorDada, jamDatang, anggotaHadir, catatan) =>
  rpc("catat_closing", {
    p_nomor_dada: nomorDada,
    p_jam_datang: jamDatang,
    p_anggota_hadir: anggotaHadir,
    p_catatan: catatan || null,
  });

export async function daftarSisipan() {
  if (K.mode === "dev") return baca("/sisipan");
  return baca(null, "v_sisipan_kloter?select=*&order=kloter.asc,nomor_dada.asc");
}

/* ============================ KEBERANGKATAN ============================= */

/** Papan garis start: satu baris per kloter + posisinya (berangkat / siap /
 *  konfirmasi_kontrak / menunggu). Posisi DITURUNKAN dari kloter terakhir
 *  yang berangkat — tidak ada status yang digeser manual. */
export async function papanKeberangkatan() {
  if (K.mode === "dev") return baca("/keberangkatan");
  return baca(null, "v_keberangkatan?select=*&order=nomor.asc");
}

/** Regu satu kloter, lengkap dengan sudah_ceklis & kontrak_menit — persis
 *  yang perlu dilihat petugas staging sebelum memberangkatkan. */
export async function reguKloter(kloter) {
  if (K.mode === "dev") return baca(`/regu-kloter?kloter=${encodeURIComponent(kloter)}`);
  return baca(null,
    `v_regu_ringkas?kloter=eq.${encodeURIComponent(kloter)}&select=*&order=nomor_dada.asc`);
}

/** Pilihan kontrak waktu edisi aktif (bukan angka hardcode — tiap edisi bisa
 *  berbeda, lihat alur-lomba.md bagian 9). */
export async function kontrakOpsi() {
  if (K.mode === "dev") return baca("/kontrak");
  return baca(null, "kontrak_opsi?select=label,menit&order=sort_order.asc");
}

export const konfirmasiKontrak = (reguId, menit) =>
  rpc("konfirmasi_kontrak", { p_regu: reguId, p_menit: menit });

export const ceklisBerangkat = (nomorDada) =>
  rpc("ceklis_berangkat", { p_nomor_dada: nomorDada });

export const batalCeklisBerangkat = (nomorDada) =>
  rpc("batal_ceklis_berangkat", { p_nomor_dada: nomorDada });

/** Jam WAJIB diketik panitia pencatat — tidak pernah now() (alur 12.4). */
export const berangkatkanKloter = (kloter, jam) =>
  rpc("berangkatkan_kloter", { p_kloter: kloter, p_jam: jam });

/** Membetulkan jam kloter yang SUDAH berangkat. Alasan wajib: jam berangkat
 *  menentukan penalti seluruh regu di kloter itu, jadi setiap perubahannya
 *  tercatat di history bersama jam lamanya. */
export const koreksiJamBerangkat = (kloter, jam, alasan) =>
  rpc("koreksi_jam_berangkat", { p_kloter: kloter, p_jam: jam, p_alasan: alasan });

/* ============================ INPUT POS ================================= */

/** Daftar pos edisi aktif — dipakai admin untuk memilih pos mana yang
 *  sedang diinput. Operator pos tidak memerlukannya (posnya sudah melekat
 *  di akunnya), tapi namanya tetap dibaca untuk judul layar.
 *
 *  `jumlah_komponen` ikut terbawa karena tidak semua pos dinilai: Pos 0
 *  (Keberangkatan) dan Pos 5 (Kedatangan) adalah garis start dan finish, dan
 *  yang dicatat di sana waktu, bukan nilai. Tanpa angka itu layar tidak bisa
 *  membedakan pos semacam itu dari pos yang komponennya belum diisi admin. */
export async function daftarPos() {
  if (K.mode === "dev") return baca("/pos");
  return baca(null, "v_pos?select=*&order=nomor.asc");
}

/** Kolom penilaian satu pos. INILAH yang menentukan bentuk tabelnya — nama
 *  kolom, rentang yang boleh diketik, dan jenis kotaknya semua datang dari
 *  sini, tidak satu pun ditulis di JavaScript. Tahun depan panitia mengubah
 *  barisnya, dan lembar di layar ikut berubah tanpa menyentuh kode. */
export async function komponenPos(edisi, pos) {
  if (K.mode === "dev") return baca(`/komponen-pos?pos=${encodeURIComponent(pos)}`);
  return baca(null,
    `wahana?edisi=eq.${encodeURIComponent(edisi)}&pos=eq.${encodeURIComponent(pos)}` +
    `&select=kode,name,type,form,poin_maks,raw_terbaik,raw_terburuk,poin_benar,` +
    // `golongan` WAJIB ikut. Tanpanya layar tidak tahu satu lomba bisa punya
    // beberapa baris wahana (Tebak Simpul, 0030), lalu menawarkan semuanya ke
    // setiap regu — dan server menolak yang salah dengan pesan yang benar tapi
    // terlambat.
    `poin_salah,total_soal,tingkat,satuan,golongan,petunjuk,judul_isian,lomba,kode_lomba,` +
    `rentang_mentah_min,rentang_mentah_maks,sort_order` +
    `&order=sort_order.asc`);
}

/** Seluruh komponen penilaian SEMUA pos sekaligus, urut pos lalu kolom.
 *  Inilah yang menentukan bentuk tabel Rekapitulasi: satu kolom per baris di
 *  sini, persis seperti lembar Excel yang dipakai panitia — dan sama seperti
 *  layar Input Pos, tidak satu pun nama kolom ditulis di JavaScript. */
export async function komponenSemua(edisi) {
  if (K.mode === "dev") return baca("/komponen-semua");
  return baca(null,
    `wahana?edisi=eq.${encodeURIComponent(edisi)}` +
    `&select=pos,kode,name,type,form,poin_maks,satuan,total_soal,` +
    `golongan,petunjuk,judul_isian,lomba,kode_lomba,` +
    `rentang_mentah_min,rentang_mentah_maks,sort_order` +
    `&order=pos.asc,sort_order.asc`);
}

/** Gembok: menyatakan satu LOMBA satu regu sudah diperiksa (0043, per lomba
 *  sejak 0166).
 *
 *  Per lomba, bukan per pos, karena yang diperiksa satu lomba pada satu waktu:
 *  panitia Cek Nilai melihat foto slipnya di sebelah angka yang diketik, dan
 *  kalau cocok ia mengetuk gembok di sebelah angka itu. Pos 1 karena itu punya
 *  lima gembok.
 *
 *  `lomba` adalah kunci tetap dari kelompokLomba().kode — kunci yang sama
 *  dengan yang dipakai foto slip, bukan `wahana.kode`. */
export const kunciNilaiPos = (nomorDada, pos, lomba) =>
  rpc("kunci_nilai_pos", { p_nomor_dada: nomorDada, p_pos: pos, p_lomba: lomba });

/** Membuka gembok satu lomba. Wajib beralasan — bentuk yang sama dengan
 *  batalkan_tanda_cetak, karena keduanya membatalkan pernyataan "sudah final". */
export const bukaKunciNilaiPos = (nomorDada, pos, lomba, alasan) =>
  rpc("buka_kunci_nilai_pos",
      { p_nomor_dada: nomorDada, p_pos: pos, p_lomba: lomba, p_alasan: alasan });

/** Riwayat perubahan nilai satu regu di satu pos — siapa mengubah apa, kapan.
 *
 *  Dibaca saat penanda simpan diketuk, bukan ikut dimuat bersama lembarnya:
 *  lembar pos memuat ratusan baris dan hampir semuanya tidak pernah ditanya
 *  riwayatnya. */
export async function riwayatNilai(pos, nomorDada) {
  if (K.mode === "dev") {
    return baca(`/riwayat-nilai?pos=${encodeURIComponent(pos)}` +
                `&dada=${encodeURIComponent(nomorDada)}`);
  }
  return baca(null,
    `v_riwayat_nilai?pos=eq.${encodeURIComponent(pos)}` +
    `&nomor_dada=eq.${encodeURIComponent(nomorDada)}` +
    `&select=*&order=changed_at.desc`);
}

/** Riwayat satu pendaftaran: perubahan pada pendaftaran, regu, dan pembayaran
 *  (view v_riwayat_pendaftaran, migrasi 0137).
 *
 *  Sejajar dengan riwayatNilai() di atas, dan sengaja dibaca PER KODE
 *  PEMBAYARAN: itu yang dipegang ketiga layar yang memakainya — Pembayaran,
 *  Daftar Ulang, dan Data Peserta. Memuatnya sekaligus untuk seluruh tabel
 *  berarti ratusan baris yang hampir semuanya tidak dibuka siapa pun. */
export async function riwayatPendaftaran(kode) {
  if (K.mode === "dev") {
    return baca(`/riwayat-pendaftaran?kode=${encodeURIComponent(kode)}`);
  }
  return baca(null,
    `v_riwayat_pendaftaran?kode_pembayaran=eq.${encodeURIComponent(kode)}` +
    "&select=*&order=changed_at.desc,id.desc");
}

/* `v_rekap_penuh` dan `v_kelengkapan_pos` TIDAK punya pembungkus sendiri lagi.
   Keduanya lahir untuk layar Rekapitulasi, yang dihapus 27 Agustus 2026 (#606),
   dan sejak itu tidak ada satu layar pun yang membacanya langsung — yang
   membacanya `cache_live_score` di database, dan di mode dev jalur di bawah
   ini yang menirunya. Pembungkus tanpa layar terbaca seperti fitur yang masih
   hidup (tes unused_batch_api). Kedua view-nya sendiri tetap ada dan tetap
   dipakai; yang dibuang cuma pintu client-nya.

   Rute `/rekap-penuh` dan `/kelengkapan-pos` di tests/dev_server.py KARENA ITU
   tetap ada: yang memanggilnya sekarang tiruan snapshot di bawah. */

/** Snapshot privat untuk papan Live Score panitia.
 *
 *  Seluruh kalkulasi berat dijalankan scheduled job satu kali tiap lima menit,
 *  bukan sekali per HP yang membuka layar. Status fase tetap dibaca langsung
 *  karena saklar publish harus berubah seketika. */
export async function cacheLiveScore() {
  if (K.mode === "dev") {
    const [kelengkapan, pos, komponen, rekap] = await Promise.all([
      baca("/kelengkapan-pos"), baca("/pos"), baca("/komponen-semua"),
      baca("/rekap-penuh"),
    ]);
    return { dibuat_pada: new Date().toISOString(), kelengkapan, pos, komponen, rekap };
  }
  const d = await baca(null,
    "cache_live_score?select=dibuat_pada,data&tunggal=eq.true");
  if (!d.length) throw new ErrorApi("Cache Live Score belum tersedia.");
  return { dibuat_pada: d[0].dibuat_pada, ...d[0].data };
}

/** Seluruh regu + nilai yang sudah tersimpan untuk satu pos. Satu permintaan
 *  untuk seluruh lembar: ~300 baris, dimuat sekali lalu disaring di browser,
 *  sama seperti layar meja. */
export async function lembarPos(pos) {
  if (K.mode === "dev") return baca(`/lembar-pos?pos=${encodeURIComponent(pos)}`);
  return baca(null,
    `v_lembar_pos?pos=eq.${encodeURIComponent(pos)}&select=*&order=nomor_dada.asc`);
}

/** Nomor dada TERTINGGI yang disiapkan admin — batas atas lembar nilai.
 *
 *  Lembar tabel mencetak nomor 001 sampai batas ini BERURUTAN, termasuk nomor
 *  yang belum diberikan ke regu mana pun. Tanpa itu, tim IT yang menyortir
 *  tumpukan slip berhenti setiap kali lembarnya melompati satu nomor: "slip
 *  012 hilang, atau memang tidak pernah ada?" — pertanyaan yang tidak bisa
 *  dijawab dari kertas dan menghentikan pekerjaan.
 *
 *  Dibaca dari stok, bukan dari regu yang sudah terdaftar: stok adalah nomor
 *  dada FISIK yang benar-benar dicetak dan dibawa panitia, dan itulah rentang
 *  yang mungkin muncul di kotak penilaian. */
/** Kedua deret nomor dada, dari `v_rentang_nomor_dada` (migrasi 0116).
 *
 *  Kain nomor dada dicetak dua set yang sama-sama mulai dari 001, jadi Intern
 *  diketik 1001-1250 sementara Eksternal tetap 1-500. Yang dibaca di sini
 *  UJUNG-UJUNGNYA saja, bukan seluruh 750 baris stok: layar cuma perlu tahu
 *  nomor mana milik deret mana, dan meja daftar ulang bekerja di jaringan
 *  yang sama dengan lima pos.
 *
 *  Nol berarti deretnya kosong — stok Intern yang belum pernah diisi admin.
 *  Layar yang memakainya harus tetap jalan dalam keadaan itu, bukan menolak
 *  semua nomor. */
export async function rentangNomorDada() {
  const d = K.mode === "dev"
    ? await baca("/rentang-nomor-dada")
    : await baca(null, "v_rentang_nomor_dada?select=*");
  const r = d[0] || {};
  return {
    eksternalMulai: Number(r.eksternal_mulai) || 0,
    eksternalSampai: Number(r.eksternal_sampai) || 0,
    internMulai: Number(r.intern_mulai) || 0,
    internSampai: Number(r.intern_sampai) || 0,
  };
}

/** Satu baris saja, dibaca ulang sesudah menyimpan. Nilai Pos yang tampil di
 *  layar SELALU angka dari database — layar tidak pernah menghitung skor
 *  sendiri, supaya tidak ada mesin skor kedua yang bisa berbeda pendapat
 *  dengan v_poin_pos. */
export async function lembarPosSatu(pos, nomorDada) {
  const d = K.mode === "dev"
    ? await baca(`/lembar-pos?pos=${encodeURIComponent(pos)}&dada=${encodeURIComponent(nomorDada)}`)
    : await baca(null, `v_lembar_pos?pos=eq.${encodeURIComponent(pos)}` +
                       `&nomor_dada=eq.${encodeURIComponent(nomorDada)}&select=*`);
  return d.length ? d[0] : null;
}

/** baris: [{ nomor_dada, kode, nilai_1, nilai_2 }]. Pintu tulis nilai yang
 *  sama dengan upload massal — layar ini sekadar mengisinya satu regu
 *  sekaligus. Mengembalikan status per baris (tersimpan / ditolak + alasan). */
export const simpanNilaiPos = (baris, pos) =>
  rpc("simpan_nilai_massal", { p_baris: baris, p_sumber: "manual", p_pos: pos });

/** Mengosongkan satu sel yang sudah terlanjur tersimpan — angka yang masuk ke
 *  regu yang salah. simpan_nilai_massal tidak bisa dipakai untuk ini: di sana
 *  sel kosong berarti "belum dinilai", bukan "hapus". */
export const hapusNilaiPos = (nomorDada, kode, pos) =>
  rpc("hapus_nilai_pos", { p_nomor_dada: nomorDada, p_kode: kode, p_pos: pos });

/** Klasemen yang AKAN dilihat peserta, dibuka lebih awal untuk admin
 *  (0049, dinamai ulang 0050).
 *
 *  Bukan `v_klasemen_publik`: view itu dipagari fase publik dan
 *  pagar itu yang menahan hasil lomba supaya tidak bocor sebelum diumumkan.
 *  Yang ini dipagari peran, dan hanya admin yang mendapat baris. */
export async function klasemenLiveScore() {
  if (K.mode === "dev") return baca("/klasemen-live-score");
  return baca(null,
    "v_klasemen_live_score?select=*&order=golongan.asc,peringkat.asc");
}

/** Daftar penghargaan final dan pilihan khusus panitia. */
export async function hasilKejuaraan() {
  if (K.mode === "dev") return baca("/kejuaraan");
  return baca(null, "v_kejuaraan?select=*&order=urutan.asc");
}

export const simpanKejuaraanManual = (kode, reguId) =>
  rpc("simpan_kejuaraan_manual", { p_kode: kode, p_regu: reguId });

/** Pangkalan Terjauh menunjuk SEKOLAH, bukan regu (migrasi 0153) — yang diukur
 *  jarak pangkalannya, dan itu sama untuk seluruh regu yang dikirimnya. */
export const simpanKejuaraanTerjauh = (sekolahId) =>
  rpc("simpan_kejuaraan_terjauh", { p_sekolah: sekolahId });

/* ============================ FOTO LEMBAR =============================== */

/* Salinan slip penilaian di server (migrasi 0047). Kertas hilang; foto tidak.
   Difoto petugas IT dengan HP sambil mengetik, jadi fotonya tertaut sendiri ke
   nomor dada dan lomba yang tepat.

   Gambar TIDAK lewat rpc/baca di atas: keduanya mengirim dan menerima JSON,
   sedangkan ini mengunggah biner ke Storage — endpoint, header, dan bentuk
   jawabannya semuanya berbeda. Dibuat jalur sendiri, bukan dengan menambah
   cabang ke pembungkus yang sudah ada. */

const BUCKET = "lembar";

/* GUDANG BERKAS DEV. Dev server menyimpan byte-nya di direktori sementara dan
   melayaninya kembali lewat /storage/<path> — lihat keterangan panjangnya di
   tests/dev_server.py.

   Sampai 1 September 2026 mode dev membuang gambarnya dan mengembalikan peta
   tautan KOSONG, jadi tidak satu pun foto pernah tergambar di laptop dan
   seluruh alur gambar — menggeser, memutar, mengurutkan, menghapus — tidak
   pernah dijalankan sekali pun di luar produksi.

   Ketiganya hanya berjalan saat `K.mode === "dev"`. Di produksi tidak ada
   satu baris pun di bawah ini yang tersentuh. */
const gudangDev = (path) => `${K.devUrl}/storage/${path.split("/").map(encodeURIComponent).join("/")}`;

async function simpanGudangDev(path, blob) {
  await fetch(gudangDev(path), { method: "POST", body: blob });
}

async function hapusGudangDev(path) {
  try { await fetch(gudangDev(path), { method: "DELETE" }); }
  catch { /* berkas yatim di direktori sementara tidak merugikan siapa pun */ }
}

/** Nama objek di bucket. Prefiks pertama WAJIB `pos<n>` — itulah yang dipagari
 *  policy storage.objects, dan RPC catat_foto_lembar menolak path yang tidak
 *  cocok dengan posnya. */
export function namaObjekFoto(pos, kodeLomba, nomorDada) {
  const acak = Math.random().toString(36).slice(2, 8);
  return `pos${pos}/${kodeLomba}/` +
         `${String(nomorDada).padStart(3, "0")}-${Date.now()}-${acak}.jpg`;
}

/** Unggah satu gambar, lalu catat barisnya.
 *
 *  Urutannya disengaja: gambar dulu, baris sesudahnya. Baris tanpa gambar
 *  adalah kebohongan — layar bilang "sudah difoto" padahal tidak ada apa-apa.
 *  Gambar tanpa baris cuma berkas yatim yang masih bisa ditemukan lewat
 *  path-nya, dan tidak merugikan siapa pun. */
export async function unggahFotoLembar(pos, kodeLomba, namaLomba, nomorDada, blob) {
  const path = namaObjekFoto(pos, kodeLomba, nomorDada);

  if (K.mode === "dev") {
    // Gambarnya DISIMPAN, bukan dibuang: tanpa byte-nya layar Cek Nilai dan
    // dialog Foto Jawaban tidak menggambar apa pun, dan keduanya tidak bisa
    // diperiksa di laptop. Urutannya sama dengan produksi — gambar dulu,
    // baris sesudahnya — supaya yang diuji alur yang sama.
    await simpanGudangDev(path, blob);
    await rpc("catat_foto_lembar", {
      p_nomor_dada: nomorDada, p_pos: pos, p_kode_lomba: kodeLomba,
      p_nama_lomba: namaLomba, p_path: path, p_ukuran: blob.size,
    });
    return { path, ukuran: blob.size };
  }

  await pastikanSesiSegar();
  const s = sesi();
  await kirim(`${K.supabaseUrl}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: K.anonKey,
      Authorization: `Bearer ${s && s.token ? s.token : K.anonKey}`,
      "Content-Type": "image/jpeg",
      "x-upsert": "false",
    },
    body: blob,
  });

  await rpc("catat_foto_lembar", {
    p_nomor_dada: nomorDada, p_pos: pos, p_kode_lomba: kodeLomba,
    p_nama_lomba: namaLomba, p_path: path, p_ukuran: blob.size,
  });
  return { path, ukuran: blob.size };
}

/** Putar satu foto slip. Sudutnya DISIMPAN (migrasi 0167); berkasnya tidak
 *  disentuh, yang memutar layar saat menggambar.
 *
 *  Mengembalikan sudut yang berlaku sesudahnya — database yang menormalkan,
 *  jadi 360 kembali sebagai 0 dan layar tidak perlu menghitung sendiri. */
export const putarFotoLembar = (id, putaran) =>
  rpc("putar_foto_lembar", { p_id: id, p_putaran: putaran });

/** Foto satu regu di satu pos, YANG PERTAMA DIUNGGAH LEBIH DULU.
 *
 *  Urutannya `desc` sampai 1 September 2026, dan itu keliru begitu satu lomba
 *  punya lebih dari satu lembar: yang difoto berurutan halaman 1 lalu halaman
 *  2, dan menampilkan yang terbaru dulu membalik halamannya. Petugas yang
 *  mencocokkan nilai dengan lembar jawaban membaca halaman 2 sebagai halaman
 *  pertama. */
export async function daftarFotoLembar(pos, nomorDada) {
  if (K.mode === "dev") {
    return baca(`/foto-lembar?pos=${encodeURIComponent(pos)}` +
                `&dada=${encodeURIComponent(nomorDada)}`);
  }
  return baca(null,
    `v_foto_lembar?pos=eq.${encodeURIComponent(pos)}` +
    `&nomor_dada=eq.${encodeURIComponent(nomorDada)}` +
    `&select=*&order=diunggah_pada.asc`);
}

/** Foto slip SELURUH regu di satu pos, sekali ambil.
 *
 *  Dipakai saringan "Belum Foto" di layar Input Pos. Menanyakannya per baris
 *  berarti ratusan permintaan di jaringan pos yang memang sering putus —
 *  satu permintaan berisi dua kolom jauh lebih murah daripada 300 permintaan
 *  berisi semuanya.
 *
 *  `path` sengaja TIDAK diambil: yang ditanya saringan cuma ADA atau TIDAK,
 *  dan path adalah bagian paling gemuk dari barisnya. */
export async function fotoLembarPos(pos) {
  if (K.mode === "dev") return baca(`/foto-lembar-pos?pos=${encodeURIComponent(pos)}`);
  return baca(null,
    `v_foto_lembar?pos=eq.${encodeURIComponent(pos)}&select=nomor_dada,kode_lomba`);
}

/** Link sementara untuk melihat satu foto. Bucket-nya privat, jadi tidak ada
 *  URL tetap — dan itu memang yang diinginkan: link yang tidak kedaluwarsa
 *  akan beredar di WhatsApp selamanya. Satu jam cukup untuk melihatnya. */
export async function tautanFoto(path) {
  if (!path) return null;
  if (K.mode === "dev") return gudangDev(path);
  await pastikanSesiSegar();
  const j = await kirim(`${K.supabaseUrl}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: "POST",
    headers: kepalaSupabase(),
    body: JSON.stringify({ expiresIn: 3600 }),
  });
  return `${K.supabaseUrl}/storage/v1${j.signedURL || j.signedUrl}`;
}

/** Tautan bertanda tangan untuk BANYAK berkas sekaligus.
 *
 *  Satu permintaan, bukan satu per foto. Di sinyal pos, sembilan permintaan
 *  berurutan adalah sembilan kesempatan gagal dan sembilan kali menunggu.
 *
 *  Yang lebih penting: dengan seluruh tautan sudah di tangan, membuka foto
 *  ukuran penuh tidak perlu `await` lagi — dan window.open() yang dipanggil
 *  SESUDAH await diblokir browser HP sebagai popup yang tidak diminta. Itulah
 *  sebabnya pemanggil lama harus membuka jendela kosong lebih dulu lalu
 *  mengisinya belakangan. */
export async function tautanFotoBanyak(paths) {
  if (!paths.length) return {};
  if (K.mode === "dev") {
    return Object.fromEntries(paths.map(p => [p, gudangDev(p)]));
  }
  await pastikanSesiSegar();
  const j = await kirim(`${K.supabaseUrl}/storage/v1/object/sign/${BUCKET}`, {
    method: "POST",
    headers: kepalaSupabase(),
    body: JSON.stringify({ expiresIn: 3600, paths }),
  });
  const peta = {};
  for (const b of j || []) {
    const tanda = b.signedURL || b.signedUrl;
    // `path` yang dikembalikan Supabase tidak berawalan bucket, sama dengan
    // yang dikirim — dipetakan balik supaya pemanggil tidak perlu menebak.
    if (tanda) peta[b.path] = `${K.supabaseUrl}/storage/v1${tanda}`;
  }
  return peta;
}

/** Hapus satu foto slip: barisnya lewat RPC (yang mencatat alasannya), lalu
 *  objeknya di bucket.
 *
 *  Urutannya begitu dan bukan sebaliknya. Objek dulu lalu barisnya gagal
 *  menyisakan baris yang menunjuk gambar yang tidak ada — dialognya menggambar
 *  kotak rusak dan tidak ada yang bisa membetulkannya dari layar. Kebalikannya
 *  cuma menyisakan berkas yatim: tidak terlihat siapa pun, bisa disapu nanti.
 *
 *  Karena itu gagalnya menghapus objek TIDAK dilempar. Barisnya sudah hilang,
 *  fotonya sudah lenyap dari layar, dan memberi tahu petugas bahwa "hapus
 *  gagal" padahal fotonya memang sudah hilang cuma membuatnya menekan lagi. */
export async function hapusFotoLembar(id, alasan) {
  const path = await rpc("hapus_foto_lembar", { p_id: id, p_alasan: alasan });
  if (K.mode === "dev") {
    // Urutannya sama dengan produksi di bawah: baris dulu, objek sesudahnya.
    if (path) await hapusGudangDev(path);
    return path;
  }
  if (path) {
    try {
      await pastikanSesiSegar();
      await kirim(`${K.supabaseUrl}/storage/v1/object/${BUCKET}/${path}`, {
        method: "DELETE", headers: kepalaSupabase(),
      });
    } catch { /* berkas yatim, bukan kegagalan yang perlu dilihat petugas */ }
  }
  return path;
}

/** Pemakaian kuota. Dibaca layar supaya kehabisan ruang tidak jadi kejutan di
 *  tengah acara — dan supaya rata-rata yang membengkak (tanda pengecilan
 *  gambar gagal di sebagian HP) terlihat sebagai angka, bukan sebagai
 *  unggahan yang tiba-tiba ditolak semua. */
export async function kuotaFoto() {
  const d = K.mode === "dev"
    ? await baca("/kuota-foto")
    : await baca(null, "v_kuota_foto?select=*");
  return Array.isArray(d) ? d[0] : d;
}

/* ---------------------------- FOTO BORONGAN ----------------------------

   Foto lembar jawaban yang diambil DI POS, banyak sekaligus, nomor dadanya
   ditautkan belakangan (migrasi 0074).

   Bedanya dengan unggahFotoLembar di atas cuma satu hal, tapi hal itu yang
   mengubah segalanya: nomor dada BELUM DIKETAHUI saat gambarnya naik. Jadi
   ia tidak ikut ke nama berkas, dan barisnya lahir tanpa regu.

   Kenapa tidak menambah cabang ke unggahFotoLembar: fungsi itu menerima nomor
   dada sebagai argumen wajib dan memakainya di dua tempat. Membuat argumen
   wajib jadi opsional membuat pemanggil lama diam-diam boleh lupa mengisinya
   — dan foto yang seharusnya tertaut sendiri jadi menganggur di antrean. */

/** Nama objek untuk foto yang belum berdada.
 *
 *  TIDAK ada segmen `belum/`. Bucket `lembar` tidak punya policy UPDATE
 *  maupun DELETE sama sekali, jadi objeknya tidak akan pernah bisa dipindah —
 *  folder bernama "belum tertaut" akan berbohong sejak foto itu tertaut, dan
 *  berbohong selamanya. Keadaan tautan hidup di baris database.
 *
 *  Segmen pertama tetap `pos<n>`: itulah yang dipagari policy storage.objects
 *  dan diperiksa ulang catat_foto_masuk. */
export function namaObjekFotoMasuk(pos, kodeLomba) {
  const acak = Math.random().toString(36).slice(2, 8);
  return `pos${pos}/${kodeLomba}/${Date.now()}-${acak}.jpg`;
}

/** Unggah satu gambar borongan, lalu catat barisnya. Mengembalikan id barisnya
 *  — itu yang dipakai layar untuk menautkannya ke nomor dada nanti.
 *
 *  Urutannya sama dengan unggahFotoLembar dan sengaja: gambar dulu, baris
 *  sesudahnya. Baris tanpa gambar adalah kebohongan; gambar tanpa baris cuma
 *  berkas yatim yang tidak merugikan siapa pun. */
export async function unggahFotoMasuk(pos, kodeLomba, namaLomba, blob) {
  const path = namaObjekFotoMasuk(pos, kodeLomba);
  const argumen = {
    p_pos: pos, p_kode_lomba: kodeLomba, p_nama_lomba: namaLomba,
    p_path: path, p_ukuran: blob.size,
  };

  if (K.mode === "dev") {
    await simpanGudangDev(path, blob);
    const id = await rpc("catat_foto_masuk", argumen);
    return { id, path, ukuran: blob.size };
  }

  await pastikanSesiSegar();
  const s = sesi();
  await kirim(`${K.supabaseUrl}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      apikey: K.anonKey,
      Authorization: `Bearer ${s && s.token ? s.token : K.anonKey}`,
      "Content-Type": "image/jpeg",
      "x-upsert": "false",
    },
    body: blob,
  });

  const id = await rpc("catat_foto_masuk", argumen);
  return { id, path, ukuran: blob.size };
}

/** Antrean foto yang belum punya nomor dada, satu pos satu lomba.
 *
 *  `nomor_dada=is.null` yang menyaringnya, bukan view kedua — v_foto_lembar
 *  sejak 0074 memakai LEFT join justru supaya baris ini terlihat. */
export async function daftarFotoBelumTaut(pos, kodeLomba) {
  if (K.mode === "dev") {
    return baca(`/foto-belum-taut?pos=${encodeURIComponent(pos)}` +
                `&lomba=${encodeURIComponent(kodeLomba)}`);
  }
  return baca(null,
    `v_foto_lembar?pos=eq.${encodeURIComponent(pos)}` +
    `&kode_lomba=eq.${encodeURIComponent(kodeLomba)}` +
    `&nomor_dada=is.null&select=*&order=diunggah_pada.asc`);
}

/** Tautkan satu foto ke nomor dada.
 *
 *  `cara` membedakan siapa yang memutuskan: `tangan` panitia sendiri, `mesin`
 *  usulan pembacaan gambar yang dicentang panitia. Menautkan ulang boleh —
 *  yang menjaganya trigger audit, bukan larangan. */
export const tautkanFoto = (id, nomorDada, cara = "tangan") =>
  rpc("tautkan_foto", { p_foto_id: id, p_nomor_dada: nomorDada, p_cara: cara });

/** Pendaftaran mandiri panitia dari layar login.
 *
 *  Lewat gateway, bukan langsung ke Supabase: membuat user auth menuntut
 *  service_role, dan kunci itu hidup HANYA di Worker. Yang kembali dari sini
 *  cuma "ok" — akunnya belum bisa dipakai sampai admin menyalakannya, dan
 *  itulah yang membuat rute ini boleh publik. */
export async function daftarPanitia({ username, password, peran, pos }) {
  return kirim(`${K.gatewayUrl}/akun/daftar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password, peran, pos }),
  });
}

/* ============================ AKUN PANITIA ==============================
   Dua jalur, dan yang menentukan bukan kerapian melainkan siapa pemegang
   kuncinya.

   LEWAT REST BIASA — daftar akun, ganti peran, ganti pos, aktif/nonaktif.
   Policy `adm_akun` (0003_rls.sql) sudah mengizinkan peran admin melakukan
   semuanya di `akun_panitia`, jadi token sesi yang sedang login sudah cukup.

   LEWAT GATEWAY WORKER — buat akun, reset password, ganti username. Ketiganya
   menyentuh `auth.users`, dan itu menuntut service_role: kunci yang memang
   TIDAK BOLEH ada di SPA (rancangan-b.md bagian 8). Worker memeriksa ulang
   bahwa pemanggilnya admin aktif sebelum mengerjakannya — sesi yang perannya
   sudah dicabut tapi tokennya belum kedaluwarsa tetap ditolak di sana.
   ======================================================================== */

/** Panggil gateway dengan token sesi yang sedang login. */
async function gerbangAkun(jalur, badan) {
  await pastikanSesiSegar();
  const s = sesi();
  return kirim(`${K.gatewayUrl}${jalur}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${s && s.token ? s.token : ""}`,
    },
    body: JSON.stringify(badan),
  });
}

export async function daftarAkun() {
  return baca("/akun", "akun_panitia?select=user_id,username,peran,pos,is_active&order=username.asc");
}

/** Ganti peran dan/atau pos. Keduanya dikirim bersama karena database
 *  menuntutnya konsisten: juri_pos wajib punya pos, peran lain wajib
 *  tidak (check di 0001_schema.sql). Mengirim peran saja akan ditolak
 *  constraint itu, dan pesannya tidak akan terbaca sebagai "posnya lupa". */
export async function ubahPeranAkun(userId, peran, pos) {
  const badan = { peran, pos: peran === "juri_pos" ? pos : null };
  if (K.mode === "dev")
    return kirim(`${K.devUrl}/akun/ubah`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: sesi() ? sesi().uid : null, user_id: userId, ...badan }),
    });
  await pastikanSesiSegar();
  return kirim(`${K.supabaseUrl}/rest/v1/akun_panitia?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: { ...kepalaSupabase(), Prefer: "return=minimal" },
    body: JSON.stringify(badan),
  });
}

/** Nonaktifkan / aktifkan. Ini yang dipakai untuk "hapus": barisnya tetap
 *  ada, dan `riwayat.oleh` yang menunjuk user_id ini tetap bisa ditelusuri.
 *  Menghapus akunnya benar-benar akan memutus jejak siapa mengubah apa. */
export async function setAktifAkun(userId, aktif) {
  if (K.mode === "dev")
    return kirim(`${K.devUrl}/akun/ubah`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: sesi() ? sesi().uid : null, user_id: userId, is_active: aktif }),
    });
  await pastikanSesiSegar();
  return kirim(`${K.supabaseUrl}/rest/v1/akun_panitia?user_id=eq.${userId}`, {
    method: "PATCH",
    headers: { ...kepalaSupabase(), Prefer: "return=minimal" },
    body: JSON.stringify({ is_active: aktif }),
  });
}

/** Buat akun. Password digenerate server dan dikembalikan SEKALI — tidak
 *  disimpan di mana pun dan tidak bisa dibaca lagi sesudah layarnya ditutup. */
export async function buatAkun(daftar) {
  if (K.mode === "dev")
    return kirim(`${K.devUrl}/akun/buat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: sesi() ? sesi().uid : null, akun: daftar }),
    });
  return gerbangAkun("/akun", { akun: daftar });
}

export async function resetPasswordAkun(userId) {
  if (K.mode === "dev")
    return kirim(`${K.devUrl}/akun/password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: sesi() ? sesi().uid : null, user_id: userId }),
    });
  return gerbangAkun("/akun/password", { user_id: userId });
}

export async function ubahUsernameAkun(userId, username) {
  if (K.mode === "dev")
    return kirim(`${K.devUrl}/akun/username`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: sesi() ? sesi().uid : null, user_id: userId, username }),
    });
  return gerbangAkun("/akun/username", { user_id: userId, username });
}

/** Daftar fitur (kolom matriks) — layar menggambar kolomnya dari sini, jadi
 *  menambah fitur tahun depan cukup satu INSERT di database. */
export async function daftarFitur() {
  return baca("/fitur", "fitur?select=kode,nama,urutan&order=urutan.asc");
}

/** Seluruh centang, satu baris per (akun, fitur). Dibaca sekali lalu
 *  dijodohkan di browser — 20 akun x 11 fitur cuma 220 baris. */
export async function daftarHak() {
  return baca("/hak", "akun_hak?select=user_id,fitur");
}

/** Centang / lepas satu kotak. Baris ADA artinya boleh, jadi mencentang =
 *  insert dan melepas = delete. Tidak ada kolom boolean yang bisa berbeda
 *  dengan keberadaan barisnya. */
export async function setHak(userId, fitur, boleh) {
  if (K.mode === "dev")
    return kirim(`${K.devUrl}/hak/set`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: sesi() ? sesi().uid : null, user_id: userId, fitur, boleh }),
    });
  await pastikanSesiSegar();
  if (boleh)
    return kirim(`${K.supabaseUrl}/rest/v1/akun_hak`, {
      method: "POST",
      headers: { ...kepalaSupabase(), Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({ user_id: userId, fitur }),
    });
  return kirim(
    `${K.supabaseUrl}/rest/v1/akun_hak?user_id=eq.${userId}&fitur=eq.${encodeURIComponent(fitur)}`,
    { method: "DELETE", headers: { ...kepalaSupabase(), Prefer: "return=minimal" } });
}
