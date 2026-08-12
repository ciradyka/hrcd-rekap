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
  if (/daftar ulang sudah ditutup/i.test(t))
    return "Daftar ulang sudah ditutup panitia. Hubungi admin.";
  if (/permission denied|insufficient/i.test(t))
    return "Akun ini tidak berhak melakukan itu. Pakai akun yang sesuai.";
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
    const email = username.includes("@") ? username : `${username}@${K.domainAkun}`;
    const j = await kirim(`${K.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: K.anonKey },
      body: JSON.stringify({ email, password }),
    });
    const akun = await kirim(
      `${K.supabaseUrl}/rest/v1/akun_panitia?user_id=eq.${j.user.id}&select=username,peran,pos,aktif`,
      { headers: { apikey: K.anonKey, Authorization: `Bearer ${j.access_token}` } });
    if (!akun.length || !akun[0].aktif)
      throw new ErrorApi("Akun ini tidak aktif di edisi sekarang. Hubungi koordinator.");
    s = {
      uid: j.user.id, token: j.access_token, refresh: j.refresh_token,
      kedaluwarsa: Date.now() + (j.expires_in || 3600) * 1000,
      ...akun[0],
    };
  }
  simpanSesi(s);
  return s;
}

/* ============================ FORM PUBLIK ================================ */

export async function daftarSekolah() {
  // Dimuat SEKALI saat halaman dibuka, difilter di browser.
  if (K.mode === "dev") return baca("/sekolah");
  return kirim(`${K.supabaseUrl}/rest/v1/sekolah?select=id,nama,alamat&order=nama`, {
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

/* ============================ MEJA ====================================== */

export async function lihatBatch(kode) {
  if (K.mode === "dev") return baca(`/batch?kode=${encodeURIComponent(kode)}`);
  // order pada embed regu: urutan bacaan meja harus sama dengan urutan
  // pemberian nomor oleh RPC (temuan review).
  const d = await baca(null,
    `pendaftaran?kode_pembayaran=eq.${encodeURIComponent(kode)}` +
    `&select=id,kode_pembayaran,status,jumlah_regu,jumlah_pendamping,butuh_barak,kontak_wa,` +
    `sekolah(nama,alamat),` +
    `regu(id,nama_regu,nama_ketua,golongan,nomor_dada,kloter_nomor,batal),` +
    `pembayaran(nominal,metode,nomor_kwitansi,diverifikasi_pada)` +
    `&regu.order=nama_regu.asc`);
  if (!d.length)
    throw new ErrorApi(`Kode ${kode} tidak ditemukan. Periksa lagi hurufnya.`);
  return d[0];
}

export async function ringkasanMeja() {
  if (K.mode === "dev") return baca("/ringkasan");
  // Dihitung dari sisi regu supaya angkanya benar-benar "batch lunas yang
  // masih punya regu tanpa nomor dada" (temuan review: query lama salah).
  const [menunggu, tanpaNomor] = await Promise.all([
    baca(null, "pendaftaran?status=eq.menunggu_pembayaran&select=id"),
    baca(null, "regu?nomor_dada=is.null&batal=is.false" +
               "&select=pendaftaran_id,pendaftaran!inner(status)" +
               "&pendaftaran.status=eq.lunas"),
  ]);
  return {
    menunggu_pembayaran: menunggu.length,
    lunas_belum_nomor: new Set(tanpaNomor.map(r => r.pendaftaran_id)).size,
  };
}

export const verifikasiPembayaran = (kode, nominal, metode) =>
  rpc("verifikasi_pembayaran", { p_kode: kode, p_nominal: nominal, p_metode: metode });

export const batalkanVerifikasi = (kode, alasan) =>
  rpc("batalkan_verifikasi", { p_kode: kode, p_alasan: alasan });

export const daftarUlang = (kode) =>
  rpc("daftar_ulang_batch", { p_kode: kode });

export const tukarNomor = (reguId, nomorBaru, alasan) =>
  rpc("tukar_nomor_dada", { p_regu: reguId, p_nomor_baru: nomorBaru, p_alasan: alasan });

export const ubahPendamping = (kode, jumlah) =>
  rpc("ubah_pendamping", { p_kode: kode, p_jumlah: jumlah });

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
