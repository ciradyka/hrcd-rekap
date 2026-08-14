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
  if (/sudah daftar ulang \(nomor dada terbit\)/i.test(t))
    return "Sekolah ini sudah menerima nomor dada, jadi pembayarannya tidak bisa dibatalkan — regunya akan jadi yatim: bernomor dada tapi tercatat belum bayar. Kosongkan dulu nomor dadanya lewat admin.";
  if (/sudah dicentang hadir/i.test(t))
    return "Regu ini sudah dicentang hadir. Hapus dulu centang Hadir-nya di layar Keberangkatan, lalu pindahkan.";
  if (/tercatat ikut berangkat bersama kloter/i.test(t))
    return "Regu ini tercatat ikut berangkat bersama kloternya. Kalau itu keliru, batalkan dulu keberangkatan kloter tersebut lewat admin.";
  if (/belum berkontrak — konfirmasi kontrak dulu/i.test(t))
    return "Kloter ini sudah berangkat, jadi regunya wajib punya kontrak waktu dulu. Pilih kontraknya di kolom Kontrak Waktu, lalu centang lagi.";
  if (/daftar ulang sudah ditutup/i.test(t))
    return "Daftar ulang sudah ditutup panitia. Hubungi admin.";
  if (/permission denied|insufficient/i.test(t))
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
    const email = username.includes("@") ? username : `${username}@${K.domainAkun}`;
    const j = await kirim(`${K.supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: K.anonKey },
      body: JSON.stringify({ email, password }),
    });
    const akun = await kirim(
      `${K.supabaseUrl}/rest/v1/akun_panitia?user_id=eq.${j.user.id}&select=username,peran,pos,is_active`,
      { headers: { apikey: K.anonKey, Authorization: `Bearer ${j.access_token}` } });
    if (!akun.length || !akun[0].is_active)
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
    `sekolah(name,address),` +
    `regu(id,nama_regu,nama_ketua,golongan,nomor_dada,kloter_nomor,is_cancelled),` +
    `pembayaran(amount,method,nomor_kwitansi,verified_at)` +
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
    baca(null, "regu?nomor_dada=is.null&is_cancelled=is.false" +
               "&select=pendaftaran_id,pendaftaran!inner(status)" +
               "&pendaftaran.status=eq.lunas"),
  ]);
  return {
    menunggu_pembayaran: menunggu.length,
    lunas_belum_nomor: new Set(tanpaNomor.map(r => r.pendaftaran_id)).size,
  };
}

/** Semua pendaftaran sekaligus — bahan layar tabel Pembayaran & Daftar Ulang.
 *  Dimuat SEKALI lalu disaring di browser: jumlahnya ratusan (bukan ribuan),
 *  dan filter yang terasa seketika jauh lebih berguna di meja daripada
 *  bolak-balik ke server tiap ketukan huruf. */
export async function daftarPendaftaran() {
  if (K.mode === "dev") return baca("/daftar-pendaftaran");
  return baca(null,
    "pendaftaran?select=id,kode_pembayaran,status,jumlah_regu,jumlah_pendamping," +
    "butuh_barak,kontak_wa,created_at," +
    "sekolah(name,address)," +
    "regu(id,nama_regu,nama_ketua,golongan,nomor_dada,kloter_nomor,is_cancelled)," +
    "pembayaran(amount,method,nomor_kwitansi,verified_at)" +
    "&regu.order=nama_regu.asc&order=created_at.asc");
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

/** Saklar hari-H: daftar_ulang_ditutup, fase_live, konfigurasi_terkunci.
 *  Dipakai layar cetak untuk memperingatkan bahwa kertas yang dicetak
 *  sebelum daftar ulang ditutup pasti kehilangan regu yang datang setelahnya. */
export async function statusAcara() {
  const d = K.mode === "dev"
    ? await baca("/status")
    : await baca(null, "status_acara?select=*");
  return Array.isArray(d) ? d[0] : d;
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
    `poin_salah,total_soal,tingkat,satuan,golongan,` +
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
    `rentang_mentah_min,rentang_mentah_maks,sort_order` +
    `&order=pos.asc,sort_order.asc`);
}

/** Kelengkapan input per pos — satu baris per pos, bukan per regu.
 *
 *  Sengaja agregat: layar memanggilnya tiap 20 detik, dan menarik 300 × 5
 *  baris hanya untuk menghitungnya sendiri di browser adalah pekerjaan yang
 *  sudah bisa dilakukan database dalam satu query. Daftar regu yang belum
 *  lengkap TIDAK perlu diambil terpisah — `v_rekap_penuh` sudah membawa
 *  nilai tiap komponen, jadi layar bisa menyaringnya dari data yang sama. */
export async function kelengkapanPos() {
  if (K.mode === "dev") return baca("/kelengkapan-pos");
  return baca(null, "v_kelengkapan_pos?select=*&order=pos.asc");
}

/** Rekapitulasi lengkap seluruh regu × seluruh pos — layar #/rekap.
 *
 *  Hanya admin dan meja: view-nya sendiri yang menolak operator pos, karena
 *  RLS akan memotong nilai_mentah pos lain dan Nilai Total-nya jadi salah
 *  (lihat kepala migrasi 0027). ~300 baris, dimuat sekali lalu disaring dan
 *  diurutkan di browser — pola yang sama dengan seluruh layar meja. */
export async function rekapPenuh() {
  if (K.mode === "dev") return baca("/rekap-penuh");
  return baca(null, "v_rekap_penuh?select=*&order=nomor_dada.asc");
}

/** Seluruh regu + nilai yang sudah tersimpan untuk satu pos. Satu permintaan
 *  untuk seluruh lembar: ~300 baris, dimuat sekali lalu disaring di browser,
 *  sama seperti layar meja. */
export async function lembarPos(pos) {
  if (K.mode === "dev") return baca(`/lembar-pos?pos=${encodeURIComponent(pos)}`);
  return baca(null,
    `v_lembar_pos?pos=eq.${encodeURIComponent(pos)}&select=*&order=nomor_dada.asc`);
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
