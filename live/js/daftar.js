/* ============================================================================
   hrcd-rekap : daftar.js — form pendaftaran publik (alur 3).

   SATU HALAMAN, bukan wizard. Alasannya: formnya pendek (6 pertanyaan, satu
   percabangan kecil), dan pendaftar perlu MELIHAT apa saja yang diminta
   sebelum mulai — "oh, saya harus siapkan nama-nama regunya dulu". Wizard
   memaksa 5 klik Lanjut tanpa manfaat, dan menyembunyikan isi form.

   Yang tetap dijaga meski satu halaman:
   - Isian tersimpan otomatis (localStorage) — HP mati / refresh tidak
     menghapus ketikan.
   - Satu kunci kirim dipakai ulang saat mencoba lagi, sehingga sinyal putus
     tidak melahirkan dua pendaftaran.
   - Semua kesalahan ditunjukkan SEKALIGUS dengan tautan lompat ke isiannya —
     tidak ada "perbaiki satu, ketemu satu lagi".
   ========================================================================== */

import { daftarSekolah, kirimPendaftaran, infoEdisi, namaReguDipakai,
         unggahBuktiTransfer, ErrorApi } from "./api.js";
import { esc, h, html, rupiah, notif, kartuGagalMuat,
         pemuat, biayaRegu, totalBiaya, kecilkanFoto } from "./util.js";
import { cariSekolah, kunciSekolah } from "./school-search.mjs";

const LAYAR = document.getElementById("layar");
const GOLONGAN = [
  { kode: "penggalang_pa", label: "Penggalang Putra", ket: "SMP / MTs" },
  { kode: "penggalang_pi", label: "Penggalang Putri", ket: "SMP / MTs" },
  { kode: "penegak_pa",    label: "Penegak Putra",    ket: "SMA / SMK / MA" },
  { kode: "penegak_pi",    label: "Penegak Putri",    ket: "SMA / SMK / MA" },
];
const GOLONGAN_INTERNAL = [
  { kode: "intern_pa", label: "Intern Putra", ket: "" },
  { kode: "intern_pi", label: "Intern Putri", ket: "" },
];
const KUNCI_DRAF = "hrcd_draf";
const KUNCI_HASIL = "hrcd_hasil";
const MAKS_REGU = 30;
const SEKOLAH_INTERNAL = {
  nama: "SMAN 1 Ciamis",
  alamat: "Jl. Gunung Galuh No. 37, Ciamis, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat 46211, Indonesia",
};

// Format nomor Indonesia, HANYA 08xx (bukan +62 8xx — disederhanakan sengaja
// supaya panitia tidak perlu mikir dua format): 08, lalu kode operator
// (1-9, bukan 0), lalu 6-10 digit lagi. Dipakai untuk validasi live (saat
// mengetik) maupun pemeriksaan akhir sebelum kirim — satu pola, satu tempat.
const POLA_WA = /^08[1-9][0-9]{6,10}$/;
const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Buat UUID v4 juga di WebView yang belum punya crypto.randomUUID(). */
function uuidDraf(kripto = globalThis.crypto) {
  if (kripto && typeof kripto.randomUUID === "function")
    return kripto.randomUUID();

  const byte = new Uint8Array(16);
  if (kripto && typeof kripto.getRandomValues === "function")
    kripto.getRandomValues(byte);
  else
    for (let i = 0; i < byte.length; i++)
      byte[i] = Math.floor(Math.random() * 256);

  byte[6] = (byte[6] & 0x0f) | 0x40;
  byte[8] = (byte[8] & 0x3f) | 0x80;
  const heks = Array.from(byte, n => n.toString(16).padStart(2, "0"));
  return `${heks.slice(0, 4).join("")}-${heks.slice(4, 6).join("")}`
    + `-${heks.slice(6, 8).join("")}-${heks.slice(8, 10).join("")}`
    + `-${heks.slice(10).join("")}`;
}

const kosong = () => ({
  jenis_peserta: null,           // "eksternal" atau "internal"
  sekolah: null,                 // {id?, nama, alamat}
  butuh_barak: null,
  // Total orang yang menginap, peserta DAN pembina (migrasi 0124). Sampai
  // 0124 kotak ini cuma menghitung pembina dan susun_barak() yang menambahkan
  // pesertanya; sekarang angkanya utuh dan rumus itu membacanya apa adanya.
  jumlah_menginap: 0,
  rincian: {
    penggalang_pa: 0, penggalang_pi: 0,
    penegak_pa: 0, penegak_pi: 0,
    intern_pa: 0, intern_pi: 0,
  },
  regu: [],                      // [{golongan, nama_regu, nama_ketua, anggota[4]}]
  kontak_wa: "",
  nama_kontak: "",
  metode_bayar: null,            // "transfer" atau "tunai"
  // Path objek di bucket `bukti`, BUKAN berkasnya. Ia ikut tersimpan di draf
  // supaya HP yang mati sesudah mengunggah tidak menyuruh mengunggah lagi.
  bukti_transfer: null,
  bukti_nama: "",                // nama berkas asli, untuk ditampilkan saja
  kunci_kirim: uuidDraf(),
});

let jawab = kosong();
let SEKOLAH = [];
let EDISI = null;
let tokenTurnstile = null;
let sudahDiperiksa = false;      // galat baru ditampilkan setelah Kirim ditekan

/* ---------------- draf ---------------- */

const simpanDraf = () => {
  try { localStorage.setItem(KUNCI_DRAF, JSON.stringify(jawab)); } catch {}
};
const hapusDraf = () => { try { localStorage.removeItem(KUNCI_DRAF); } catch {} };

window.addEventListener("beforeunload", (e) => {
  const adaIsi = jawab.sekolah || jawab.regu.length || jawab.kontak_wa;
  if (adaIsi && !sessionStorage.getItem("hrcd_selesai")) {
    e.preventDefault(); e.returnValue = "";
  }
});

const totalRincian = () => Object.values(jawab.rincian).reduce((a, b) => a + b, 0);
const internal = () => jawab.jenis_peserta === "internal";

const golonganForm = () => internal() ? GOLONGAN_INTERNAL : GOLONGAN;
/* Pencocokan nama sekolah pindah ke school-search.mjs — aturannya panjang,
 *  murni perhitungan, dan sekarang punya tesnya sendiri
 *  (tests/school_search.test.mjs). Yang perlu diingat di sini cuma bahwa ada
 *  DUA fungsi dan keduanya tidak boleh tertukar (CLAUDE.md 12.10):
 *  `cariSekolah()` memutuskan apa yang TERLIHAT saat mencari, `kunciSekolah()`
 *  memutuskan apa yang dianggap SEKOLAH YANG SAMA — dan yang kedua harus tetap
 *  sama persis dengan kunci_sekolah() di database.                          */
const labelGolongan = k => golonganForm().find(g => g.kode === k)?.label
  ?? [...GOLONGAN, ...GOLONGAN_INTERNAL].find(g => g.kode === k).label;

/* ---------- nama regu: 20 karakter, dan tidak boleh kembar (0051) ----------

   20 diturunkan dari kolom Nama Regu pada form tabel per pos: 48mm pada huruf
   10pt memuat ~21 karakter kapital. Lebih dari itu terpotong DIAM-DIAM di
   kertas cadangan, yang justru dipakai saat internet mati.

   Kembar ditolak di seluruh edisi karena nama juara dibacakan di depan
   lapangan, dan nama yang sudah pernah disebut kehilangan momennya.

   Perbandingannya dinormalkan persis seperti indeks di database: huruf
   besar-kecil diabaikan, spasi beruntun dirapatkan. Pembatas yang bisa
   dilewati dengan menekan Caps Lock bukan pembatas.                        */

const NAMA_MAKS = 20;

/* Angka di kolom nama selalu berarti salah satu dari dua hal: kolomnya
   tertukar (nomor WA diketik di kotak Nama), atau regunya dinomori sendiri
   ("REGU 1") — dan nomor regu sudah ada, namanya nomor dada.

   Yang ditolak HANYA digit. Nama sungguhan memuat spasi, titik, apostrof,
   dan tanda hubung — "Nur Aisyah binti H. Abdul", "Ma'ruf", "Siti Nur-Aini"
   — dan menolak semuanya demi menolak angka akan menolak lebih banyak nama
   asli daripada kesalahan yang dicegahnya. */
const ADA_ANGKA = /[0-9]/;
const normalNama = (t) => String(t || "").trim().toLowerCase().replace(/\s+/g, " ");

/* Batas BAWAH nama regu (0120). Yang dihitung hurufnya, bukan panjang
   karakternya: "A B" tiga karakter tetapi dua huruf, dan yang dibacakan di
   lapangan saat pemberangkatan dan saat juara diumumkan adalah hurufnya.
   Tanda baca dan spasi karena itu dibuang dulu — "Ma'ruf" dan "Nur-Aini"
   tetap lolos. Aturan yang sama ditegakkan database. */
/* Rekening panitia. Ditulis SEKALI di sini: nomor rekening yang salah satu
   digit membuat uang masuk ke orang lain, dan angka yang tersalin di dua
   tempat pada akhirnya berbeda di salah satunya. */
const REKENING = "BJB 0161891614100 a.n. Hiking Rally Ciradyka";
const KAMPUS = "kampus SMAN 1 Ciamis";

const HURUF_MIN = 3;
const cukupHuruf = (t) => (String(t || "").match(/\p{L}/gu) || []).length >= HURUF_MIN;

/* Jawaban server, diingat per nama supaya satu nama tidak ditanyakan berkali
   -kali sementara pembina masih mengetik nama berikutnya. */
const namaTerpakai = new Map();
let jamPeriksaNama = null;

/* ============================ RANGKA HALAMAN ============================= */

function halaman() {
  const jenisDipilih = jawab.jenis_peserta !== null;
  const nomorJumlah = internal() ? 3 : 4;
  const nomorRegu = nomorJumlah + 1;
  const nomorKontak = nomorRegu + 1;
  const nomorBayar = nomorKontak + 1;
  LAYAR.replaceChildren(h(`
    <section class="card" id="bagian-jenis">
      <h2><span class="section-number">1</span> Peserta</h2>
      <div class="option-row" style="margin-top:.8rem">
        <button class="option" id="p-eksternal" aria-pressed="${jawab.jenis_peserta === "eksternal"}" type="button">Eksternal</button>
        <button class="option" id="p-internal" aria-pressed="${jawab.jenis_peserta === "internal"}" type="button">Internal</button>
      </div>
    </section>

    ${!jenisDipilih ? "" : `
    <!-- 2. Sekolah -->
    <section class="card" id="bagian-sekolah">
      <h2><span class="section-number">2</span> Asal sekolah</h2>
      <div id="isi-sekolah"></div>
    </section>

    ${internal() ? "" : `
    <!-- 3. Menginap -->
    <section class="card" id="bagian-barak">
      <h2><span class="section-number">3</span> Perlu tempat menginap?</h2>
      <p class="description">Panitia menyediakan ruang kelas untuk menginap malam
         sebelum lomba, gratis.</p>
      <div class="option-row" style="margin-top:.8rem">
        <button class="option" id="p-ya" aria-pressed="false" type="button">Ya, perlu</button>
        <button class="option" id="p-tidak" aria-pressed="false" type="button">Tidak perlu</button>
      </div>
      <div id="isi-menginap" style="margin-top:.9rem"></div>
      <div class="error" id="g-barak" hidden>Pilih salah satu.</div>
    </section>
    `}

    <!-- Jumlah regu -->
    <section class="card" id="bagian-jumlah">
      <h2><span class="section-number">${nomorJumlah}</span> Mendaftarkan berapa regu?</h2>
      <p class="description">1 regu = 5 orang.</p>
      <div id="isi-stepper" style="margin-top:.9rem"></div>
      <div class="total-box" id="kotak-total"></div>
      <div class="error" id="g-jumlah" hidden>Tambahkan minimal satu regu.</div>
    </section>

    <!-- Nama regu -->
    <section class="card" id="bagian-regu">
      <h2><span class="section-number">${nomorRegu}</span> Nama tiap regu</h2>
      <div id="isi-regu"></div>
    </section>

    <!-- Kontak -->
    <section class="card" id="bagian-kontak">
      <h2><span class="section-number">${nomorKontak}</span> Contact Person</h2>
      <p class="description">Satu orang untuk semua regu.</p>
      <div class="field" style="margin-top:.7rem">
        <label for="nama-kontak">Nama</label>
        <input type="text" id="nama-kontak" autocomplete="name"
               placeholder="contoh: Bu Rina">
        <div class="error" id="g-nama-kontak" hidden>Nama contact person wajib diisi.</div>
      </div>
      <div class="field">
        <label for="wa">Nomor WhatsApp</label>
        <input type="tel" id="wa" inputmode="numeric" placeholder="contoh: 08123456789">
        <div class="error" id="g-wa" hidden>Isi nomor WA yang benar — diawali 08, bukan +62.</div>
      </div>
    </section>

    <!-- Pembayaran -->
    <section class="card" id="bagian-bayar">
      <h2><span class="section-number">${nomorBayar}</span> Pembayaran</h2>
      <div class="option-row" style="margin-top:.8rem">
        <button class="option" id="b-transfer" type="button"
                aria-pressed="${jawab.metode_bayar === "transfer"}">Transfer</button>
        <button class="option" id="b-tunai" type="button"
                aria-pressed="${jawab.metode_bayar === "tunai"}">Tunai</button>
      </div>
      <div id="isi-bayar" style="margin-top:.9rem"></div>
      <div class="error" id="g-bayar" hidden>Pilih salah satu.</div>
    </section>

    <div id="turnstile-kotak"></div>
    <div id="ringkas-galat"></div>

    <div class="send-bar">
      <div class="send-content">
        <div class="send-info" id="kirim-info"></div>
        <button class="button button-primary" id="kirim" type="button">Kirim Pendaftaran</button>
      </div>
    </div>
    `}
  `));

  const pilihJenis = (jenis) => {
    if (jawab.jenis_peserta === jenis) return;
    const adaIsianJenis = jawab.regu.length > 0
      || (jawab.jenis_peserta === "eksternal"
          && (jawab.sekolah || jawab.butuh_barak !== null));
    if (adaIsianJenis && !window.confirm(
      "Ganti jenis peserta? Isian asal sekolah, menginap, dan regu akan dihapus.",
    )) return;
    jawab.jenis_peserta = jenis;
    jawab.sekolah = jenis === "internal" ? sekolahInternal() : null;
    jawab.butuh_barak = jenis === "internal" ? false : null;
    jawab.jumlah_menginap = 0;
    jawab.rincian = {
      penggalang_pa: 0, penggalang_pi: 0,
      penegak_pa: 0, penegak_pi: 0,
      intern_pa: 0, intern_pi: 0,
    };
    jawab.regu = [];
    simpanDraf();
    halaman();
  };
  document.getElementById("p-eksternal").addEventListener("click", () => pilihJenis("eksternal"));
  document.getElementById("p-internal").addEventListener("click", () => pilihJenis("internal"));
  if (!jenisDipilih) return;

  // Bukti yang sudah naik TIDAK dibuang saat pembina bolak-balik antara
  // Transfer dan Tunai: berkasnya sudah ada di bucket, dan menghapus
  // catatannya cuma menyuruh mengunggah ulang berkas yang sama.
  const pilihBayar = (metode) => {
    if (jawab.metode_bayar === metode) return;
    jawab.metode_bayar = metode;
    simpanDraf();
    for (const [id, m] of [["b-transfer", "transfer"], ["b-tunai", "tunai"]])
      document.getElementById(id).setAttribute("aria-pressed", String(metode === m));
    document.getElementById("g-bayar").hidden = true;
    gambarBayar();
    if (sudahDiperiksa) periksa(false);
  };
  document.getElementById("b-transfer").addEventListener("click", () => pilihBayar("transfer"));
  document.getElementById("b-tunai").addEventListener("click", () => pilihBayar("tunai"));

  gambarSekolah();
  if (!internal()) gambarBarak();
  gambarStepper();
  gambarRegu();
  document.getElementById("nama-kontak").value = jawab.nama_kontak;
  document.getElementById("nama-kontak").addEventListener("input", e => {
    jawab.nama_kontak = e.target.value; simpanDraf();
    const salahKontak = !e.target.value.trim()
      ? "Nama contact person wajib diisi."
      : ADA_ANGKA.test(e.target.value)
        ? "Nama contact person tidak boleh memakai angka." : null;
    const gk = document.getElementById("g-nama-kontak");
    gk.textContent = salahKontak || "";
    gk.hidden = !salahKontak;
    if (sudahDiperiksa) periksa(false);
  });
  document.getElementById("wa").value = jawab.kontak_wa;
  cekWaLive();
  document.getElementById("wa").addEventListener("input", e => {
    jawab.kontak_wa = e.target.value; simpanDraf();
    cekWaLive();
    if (sudahDiperiksa) periksa(false);
  });

  gambarBayar();
  document.getElementById("kirim").addEventListener("click", kirim);
  pasangTurnstile();
  perbaruiTotal();
}

/* ---------------- 7. pembayaran ---------------- */

/* Nominalnya disebut di dalam kalimatnya, bukan di baris terpisah: yang
   ditanyakan pembina bukan "berapa totalnya" — itu sudah terbaca di bar bawah
   sepanjang form — melainkan "berapa yang harus saya transfer SEKARANG".

   Yang tidak bisa ditebak sendiri cuma nomor rekeningnya dan tempatnya, dan
   itulah satu-satunya isi kalimat ini. Tidak ada penjelasan cara mengunggah:
   tombolnya sudah bernama Unggah Bukti Transfer.                            */
function gambarBayar() {
  const kotak = document.getElementById("isi-bayar");
  if (!kotak) return;
  const tagihan = rupiah(totalBiaya(EDISI, jawab.regu));

  if (jawab.metode_bayar === "tunai") {
    kotak.replaceChildren(h(html`
      <p>Pembayaran senilai <strong>${tagihan}</strong> dapat dilakukan di
         ${KAMPUS}.</p>`));
    return;
  }
  if (jawab.metode_bayar !== "transfer") { kotak.replaceChildren(); return; }

  const sudah = !!jawab.bukti_transfer;
  kotak.replaceChildren(h(html`
    <p>Silakan transfer senilai <strong>${tagihan}</strong> ke rekening
       <strong>${REKENING}</strong>.</p>
    <div class="field" style="margin-top:.8rem">
      <label for="bukti">Unggah Bukti Transfer</label>
      <input type="file" id="bukti" accept="image/*">
      <div class="description" id="bukti-status">${
        sudah ? `Terunggah${jawab.bukti_nama ? `: ${jawab.bukti_nama}` : ""}.`
              : ""}</div>
      <div class="error" id="g-bukti" hidden>Bukti transfer wajib diunggah.</div>
    </div>`));

  document.getElementById("bukti").addEventListener("change", async (e) => {
    const berkas = e.target.files && e.target.files[0];
    if (!berkas) return;
    const status = document.getElementById("bukti-status");
    // Bukti yang lama TIDAK dilupakan sebelum yang baru berhasil naik: sinyal
    // putus di tengah unggahan kedua tidak boleh menghapus bukti yang sudah
    // sah, karena Kirim akan tertahan olehnya.
    status.textContent = "Mengunggah…";
    try {
      const kecil = await kecilkanFoto(berkas);
      jawab.bukti_transfer = await unggahBuktiTransfer(jawab.kunci_kirim, kecil);
      jawab.bukti_nama = berkas.name;
      simpanDraf();
      status.textContent = `Terunggah: ${berkas.name}`;
      document.getElementById("g-bukti").hidden = true;
      if (sudahDiperiksa) periksa(false);
    } catch (err) {
      status.textContent = "";
      notif(err instanceof ErrorApi ? err.message
            : (err && err.message) || "Bukti gagal diunggah. Coba lagi.", true);
    }
  });
}

/* ---------------- 1. sekolah ---------------- */

function gambarSekolah() {
  const kotak = document.getElementById("isi-sekolah");
  if (jawab.sekolah) {
    kotak.replaceChildren(h(html`
      <div class="card card-identity" style="margin:0">
        <div class="nama">${jawab.sekolah.nama}</div>
        <div class="detail">📍 ${jawab.sekolah.alamat}</div>
      </div>`));
    if (internal()) return;
    kotak.appendChild(h(`
      <button class="button button-secondary button-small" id="ganti-sekolah" type="button"
              style="margin-top:.6rem">Ganti sekolah</button>`));
    document.getElementById("ganti-sekolah").addEventListener("click", () => {
      jawab.sekolah = null; simpanDraf(); gambarSekolah();
    });
    return;
  }

  kotak.replaceChildren(h(`
    <div class="field" style="margin-bottom:.4rem">
      <!-- Tanpa <label> yang terlihat: placeholder-nya sudah memberi contoh
           konkret, dan judul bagian di atasnya sudah menyebut "Sekolah".
           aria-label tetap dipasang supaya pembaca layar tidak kehilangan
           nama isian ini. -->
      <input type="text" id="cari" autocomplete="off" aria-label="Nama sekolah"
             placeholder="contoh: SMPN 1 Ciamis">
      <div class="hint">Jika sekolah tidak muncul, silakan daftarkan + isi alamat</div>
      <div class="suggestions" id="saran" hidden></div>
    </div>
    <div id="manual"></div>
    <div class="error" id="g-sekolah" hidden>Pilih atau isi sekolahmu dulu.</div>
  `));

  const cari = document.getElementById("cari");
  const saran = document.getElementById("saran");

  cari.addEventListener("input", () => {
    const cocok = cariSekolah(SEKOLAH, cari.value, 6);
    saran.hidden = cocok.length === 0;
    saran.replaceChildren(...cocok.map(s => {
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = html`<strong>${s.name}</strong><span class="alamat">${s.address}</span>`;
      b.addEventListener("click", () => pilih(s));
      return b;
    }));
    gambarManual();
  });
  /* Klik pada saran TIDAK BOLEH melepas fokus dari kotak ketik.
   *
   *  Dulu daftarnya disembunyikan 200 ms sesudah `blur`, dengan harapan klik
   *  sempat mendarat lebih dulu. Itu perlombaan, dan yang kalah orangnya:
   *  sekali klik sedikit lebih lambat — jari menekan lalu berhenti sejenak,
   *  atau HP yang sibuk — tombolnya sudah hilang waktu `click` tiba, dan
   *  sekolahnya tidak terpilih tanpa satu pun tanda bahwa ada yang salah.
   *  Dilaporkan persis begitu: "muncul, tapi ketika diklik, hilang".
   *
   *  `preventDefault` pada mousedown menahan perpindahan fokusnya sejak awal,
   *  jadi `blur` tidak pernah terjadi dan tidak ada lomba untuk dimenangkan. */
  saran.addEventListener("mousedown", (e) => e.preventDefault());
  cari.addEventListener("blur", () => setTimeout(() => { saran.hidden = true; }, 200));

  // s DATANG DARI DUA ARAH: hasil autocomplete (baris database — kolomnya
  // sudah name/address sejak migrasi 0014) dan isian manual di bawah. Terima
  // keduanya, karena memaksa satu bentuk saja pernah membuat sekolah manual
  // terkirim tanpa nama sama sekali dan RPC-nya tidak ketemu.
  function pilih(s) {
    jawab.sekolah = {
      id: s.id,
      nama: s.name ?? s.nama,
      alamat: s.address ?? s.alamat,
    };
    simpanDraf(); gambarSekolah();
    if (sudahDiperiksa) periksa(false);
  }

  /** Isian manual muncul menempel di bawah kotak cari — tidak perlu menekan
   *  tombol "sekolahku tidak ada" dulu (dulu itu jalan buntu). */
  function gambarManual() {
    const teks = cari.value.trim();
    if (teks.length < 3) { document.getElementById("manual").replaceChildren(); return; }
    if (SEKOLAH.some(s => kunciSekolah(s.name) === kunciSekolah(teks))) {
      document.getElementById("manual").replaceChildren(); return;
    }
    if (document.getElementById("m-alamat")) return;    // sudah tergambar
    document.getElementById("manual").replaceChildren(h(`
      <div class="card" style="margin:.6rem 0 0;border-color:var(--utama)">
        <p style="font-weight:700">Sekolahmu belum ada di daftar?</p>
        <!-- Satu-satunya kalimat penjelas di kartu ini, dan ia menahan
             kekeliruan yang mahal: sejak migrasi 0061 sekolah dikenali dari
             NAMANYA saja. Nama yang persis sama dengan sekolah lain akan
             menyatu dengan sekolah itu — regunya ikut terhitung ke sana dan
             pembagian kloternya ikut salah. Alamat tidak lagi memisahkan. -->
        <p class="hint" style="margin:.4rem 0 0">Kalau ada sekolah lain yang
          namanya persis sama, tambahkan kabupatennya — misalnya
          <strong>MAN 3 Ciamis</strong>.</p>
        <div class="field" style="margin-top:.6rem">
          <label for="m-alamat">Alamat sekolah (jalan + kota)</label>
          <input type="text" id="m-alamat"
                 placeholder="contoh: Jl. Raya Banjar No. 2, Kota Banjar">
        </div>
        <button class="button button-primary" id="pakai" type="button">Simpan</button>
      </div>`));
    document.getElementById("pakai").addEventListener("click", () => {
      const nama = cari.value.trim();
      const alamat = document.getElementById("m-alamat").value.trim();
      if (!nama) { cari.focus(); return; }
      if (!alamat) {
        // Dulu berbunyi "untuk membedakan sekolah bernama sama". Sejak 0061
        // alamat tidak membedakan apa-apa — nama yang membedakan — jadi
        // alasan itu dihapus daripada dibiarkan mengajarkan yang keliru.
        notif("Alamat sekolahnya belum diisi.", true);
        document.getElementById("m-alamat").focus();
        return;
      }
      pilih({ nama, alamat });
    });
  }
}

function sekolahInternal() {
  const tersimpan = SEKOLAH.find(
    s => kunciSekolah(s.name) === kunciSekolah(SEKOLAH_INTERNAL.nama));
  return tersimpan
    ? { id: tersimpan.id, nama: tersimpan.name, alamat: tersimpan.address }
    : { ...SEKOLAH_INTERNAL };
}

/* ---------------- 2. barak ---------------- */

function gambarBarak() {
  const set = (ya) => {
    jawab.butuh_barak = ya;
    document.getElementById("p-ya").setAttribute("aria-pressed", String(ya));
    document.getElementById("p-tidak").setAttribute("aria-pressed", String(!ya));
    const kotak = document.getElementById("isi-menginap");
    if (ya) {
      kotak.replaceChildren(h(html`
        <div class="field" style="margin:0">
          <label for="n-menginap">Total yang menginap (peserta + pembina)?</label>
          <input type="number" id="n-menginap" min="0" max="200" inputmode="numeric"
                 value="${jawab.jumlah_menginap}">
          <div class="hint">Boleh 0 kalau belum tahu — bisa diubah saat daftar ulang.</div>
        </div>`));
      document.getElementById("n-menginap").addEventListener("input", e => {
        jawab.jumlah_menginap = Math.max(0, Number(e.target.value) || 0); simpanDraf();
      });
    } else {
      kotak.replaceChildren();
      jawab.jumlah_menginap = 0;
    }
    simpanDraf();
    if (sudahDiperiksa) periksa(false);
  };
  document.getElementById("p-ya").addEventListener("click", () => set(true));
  document.getElementById("p-tidak").addEventListener("click", () => set(false));
  if (jawab.butuh_barak !== null) set(jawab.butuh_barak);
}

/* ---------------- 3. jumlah regu ---------------- */

function gambarStepper() {
  document.getElementById("isi-stepper").replaceChildren(h(
    golonganForm().map(g => `
      <div class="stepper-row">
        <div>
          <strong style="font-size:1.05rem">${g.label}</strong>
          ${g.ket ? `<div class="hint">${g.ket}</div>` : ""}
        </div>
        <div class="stepper">
          <button type="button" aria-label="kurangi ${g.label}" data-kurang="${g.kode}">−</button>
          <span class="angka" id="n-${g.kode}" aria-live="polite">${jawab.rincian[g.kode]}</span>
          <button type="button" aria-label="tambah ${g.label}" data-tambah="${g.kode}">+</button>
        </div>
      </div>`).join("")));

  LAYAR.querySelectorAll("[data-tambah]").forEach(b => b.addEventListener("click", () => {
    if (totalRincian() >= MAKS_REGU) {
      notif(`Maksimal ${MAKS_REGU} regu per pendaftaran. Hubungi panitia bila lebih.`, true);
      return;
    }
    jawab.rincian[b.dataset.tambah]++;
    sinkronRegu(); gambarStepper(); gambarRegu(); perbaruiTotal();
  }));
  LAYAR.querySelectorAll("[data-kurang]").forEach(b => b.addEventListener("click", () => {
    const k = b.dataset.kurang;
    if (jawab.rincian[k] <= 0) return;
    jawab.rincian[k]--;
    sinkronRegu(); gambarStepper(); gambarRegu(); perbaruiTotal();
  }));
}

/** Samakan daftar regu dengan rincian, pertahankan nama yang sudah diketik. */
function sinkronRegu() {
  const lama = jawab.regu;
  jawab.regu = [];
  for (const g of golonganForm()) {
    const bekas = lama.filter(r => r.golongan === g.kode);
    for (let i = 0; i < jawab.rincian[g.kode]; i++)
      jawab.regu.push(bekas[i]
        ?? { golongan: g.kode, nama_regu: "", nama_ketua: "", anggota: ["", "", "", ""] });
  }
  simpanDraf();
}

function perbaruiTotal() {
  const total = jawab.regu.length;
  // Regu Intern berharga lain (migrasi 0110). Form ini tidak pernah mencampur
  // keduanya — jenis peserta dipilih sekali di atas dan menentukan seluruh
  // pilihan golongan — jadi "N × harga" masih benar dan harganya diambil dari
  // regu pertama. Yang DIJUMLAHKAN tetap per regu, supaya angka besarnya tetap
  // benar seandainya form suatu hari boleh mencampur; ia juga harus sama
  // persis dengan hitungan Meja Pembayaran, atau pembayarannya akan ditolak.
  const satuan = total ? biayaRegu(EDISI, jawab.regu[0].golongan) : 0;
  const tagihan = totalBiaya(EDISI, jawab.regu);
  document.getElementById("kotak-total").innerHTML = total
    ? html`<strong>Total: ${total} regu</strong>
           <div class="description">Biaya: ${total} × ${rupiah(satuan)}
           = <strong>${rupiah(tagihan)}</strong></div>`
    : `<span class="description">Belum ada regu yang ditambahkan.</span>`;
  document.getElementById("kirim-info").innerHTML = total
    ? html`${total} regu · ${rupiah(tagihan)}`
    : `<span class="description">Belum ada regu</span>`;
  // Kalimat "transfer senilai X" menyebut angka yang sama dengan bar bawah,
  // jadi ia harus ikut berubah saat jumlah regunya berubah.
  gambarBayar();
  if (sudahDiperiksa) periksa(false);
}

/* ---------------- 4. nama regu ---------------- */

/** Empat kotak anggota, selalu empat — draf lama yang belum punya kunci
 *  `anggota` ikut terisi kotak kosong, bukan kehilangan barisnya. */
const anggotaRegu = (r) => {
  const a = Array.isArray(r.anggota) ? r.anggota : [];
  return [0, 1, 2, 3].map(k => a[k] || "");
};

function gambarRegu() {
  const kotak = document.getElementById("isi-regu");
  if (!jawab.regu.length) {
    kotak.replaceChildren(h(`<p class="description">Belum ada regu.</p>`));
    return;
  }
  /* Template BIASA, BUKAN tag html`` — keempat kotak anggota sudah berupa
     HTML jadi, dan menyisipkannya ke dalam html`` membuatnya ikut di-escape:
     tag-nya tampil sebagai teks mentah di dalam kartu. Persis jebakan yang
     sudah ditulis di app.js untuk baris tabel, dan ia menggigit lagi di sini.
     Data dari luar tetap lewat esc() satu per satu. */
  kotak.replaceChildren(h(jawab.regu.map((r, i) => {
    const kotakAnggota = anggotaRegu(r).map((a, k) => html`
          <input type="text" id="r-anggota-${i}-${k}" value="${a}"
                 style="margin-top:.35rem"
                 placeholder="Nama Anggota ${k + 1}">`).join("");
    return `
    <div class="regu-card" id="regu-${i}">
      <span class="badge badge-green">Regu ${i + 1} — ${esc(labelGolongan(r.golongan))}</span>
      <div class="two-column">
        <div class="field" style="margin:0">
          <label for="r-nama-${i}">Nama Regu</label>
          <input type="text" id="r-nama-${i}" value="${esc(r.nama_regu)}"
                 maxlength="${NAMA_MAKS}" placeholder="contoh: Rajawali">
          <div class="error" id="r-nama-galat-${i}" hidden>Nama regu wajib diisi.</div>
        </div>
        <div class="field" style="margin:0">
          <label for="r-ketua-${i}">Nama Ketua</label>
          <input type="text" id="r-ketua-${i}" value="${esc(r.nama_ketua)}" placeholder="contoh: Andi Saputra">
          <div class="error" id="r-ketua-galat-${i}" hidden>Nama ketua wajib diisi.</div>
        </div>
      </div>
      <!-- Empat kotak anggota, dan label "opsional" ditulis SEKALI di
           judulnya — bukan di tiap kotak. Empat kata "opsional" berderet ke
           bawah membuat yang wajib dan yang tidak sama-sama tenggelam.

           Placeholder-nya TANPA awalan "misal:", dan itu bukan pengecualian
           dari pasal 9.5 melainkan penerapannya: awalan itu untuk CONTOH
           ISIAN — kotak kosong berisi "Budi Santoso" terbaca seperti kotak
           yang sudah diisi. "Nama Anggota 1" bukan contoh, ia nama kotaknya,
           sejenis dengan "Cari nomor dada / regu / organisasi…" yang juga
           tidak diberi awalan itu.

           Nomornya mulai dari 1: ketua punya kotaknya sendiri di atas dan
           tidak ikut dihitung sebagai anggota. -->
      <div class="field" style="margin:.7rem 0 0">
        <label for="r-anggota-${i}-0">Nama Anggota (opsional)</label>
        ${kotakAnggota}
        <div class="error" id="r-anggota-galat-${i}" hidden>
          Nama anggota tidak boleh memakai angka.</div>
      </div>
    </div>`;
  }).join("")));

  // Warning SEKETIKA kalau nama regu/ketua kosong — tidak menunggu tombol
  // Kirim ditekan dulu. Dua isian dicek bersama supaya kartu tidak salah
  // dianggap lengkap hanya karena satu dari dua kotaknya sudah terisi.
  /** Apa yang salah dengan nama regu ke-i, atau null kalau tidak ada.
   *
   *  Urutannya disengaja: kosong dulu, lalu kembar di dalam form ini, baru
   *  jawaban server. Yang paling dekat dengan apa yang sedang diketik pembina
   *  disebut lebih dulu — ia bisa membetulkannya tanpa menunggu jaringan.
   *
   *  Hanya kemunculan KEDUA yang ditandai (j < i), jadi mengetik "Rajawali"
   *  dua kali menyalakan satu galat, bukan dua kartu merah yang keduanya
   *  menuduh. */
  const masalahNama = (i) => {
    const n = normalNama(jawab.regu[i].nama_regu);
    if (!n) return "Nama regu wajib diisi.";
    if (ADA_ANGKA.test(n)) return "Nama regu tidak boleh memakai angka.";
    if (!cukupHuruf(n)) return `Nama regu minimal ${HURUF_MIN} huruf.`;
    if (jawab.regu.some((x, j) => j < i && normalNama(x.nama_regu) === n))
      return "Nama ini sudah dipakai regu lain di form ini.";
    if (namaTerpakai.get(n))
      return "Nama ini sudah dipakai regu lain. Pilih nama yang berbeda.";
    return null;
  };

  const cekRegu = (i) => {
    const inpNama = document.getElementById(`r-nama-${i}`);
    const inpKetua = document.getElementById(`r-ketua-${i}`);
    if (!inpNama || !inpKetua) return;
    const salahNama = masalahNama(i);
    const salahKetua = !inpKetua.value.trim()
      ? "Nama ketua wajib diisi."
      : ADA_ANGKA.test(inpKetua.value) ? "Nama ketua tidak boleh memakai angka." : null;
    const ketuaKosong = !!salahKetua;
    inpNama.setAttribute("aria-invalid", String(!!salahNama));
    inpKetua.setAttribute("aria-invalid", String(ketuaKosong));
    const kotakGalat = document.getElementById(`r-nama-galat-${i}`);
    kotakGalat.textContent = salahNama || "";
    kotakGalat.hidden = !salahNama;
    const kotakKetua = document.getElementById(`r-ketua-galat-${i}`);
    kotakKetua.textContent = salahKetua || "";
    kotakKetua.hidden = !salahKetua;

    // Anggota boleh kosong; yang tidak boleh cuma angka di namanya — aturan
    // yang sama dengan nama ketua, dan database menolaknya juga (0114). Kotak
    // yang salah ditandai satu per satu supaya pembina tahu yang mana.
    const salahAnggota = [0, 1, 2, 3].some(k => {
      const inp = document.getElementById(`r-anggota-${i}-${k}`);
      if (!inp) return false;
      const salah = ADA_ANGKA.test(inp.value);
      inp.setAttribute("aria-invalid", String(salah));
      return salah;
    });
    const kotakAnggota = document.getElementById(`r-anggota-galat-${i}`);
    if (kotakAnggota) kotakAnggota.hidden = !salahAnggota;

    document.getElementById(`regu-${i}`).classList.toggle("regu-card-error",
      !!salahNama || ketuaKosong || salahAnggota);
  };

  /** Tanya server nama mana yang sudah terpakai — ditunda 450 ms supaya tiap
   *  ketukan huruf tidak jadi satu permintaan, dan hanya untuk nama yang
   *  belum pernah ditanyakan.
   *
   *  Jaringan putus DIABAIKAN diam-diam di sini: indeks unik di database yang
   *  menjadi penjaga sebenarnya, dan pesannya diterjemahkan pesanRamah saat
   *  Kirim ditekan. Layar ini cuma mempercepat kabarnya. */
  const periksaNamaKeServer = () => {
    clearTimeout(jamPeriksaNama);
    jamPeriksaNama = setTimeout(async () => {
      const perlu = [...new Set(jawab.regu.map(r => normalNama(r.nama_regu)))]
        .filter(n => n && !namaTerpakai.has(n));
      if (!perlu.length) return;
      for (const n of perlu) {
        try { namaTerpakai.set(n, await namaReguDipakai(n)); } catch { /* diam */ }
      }
      jawab.regu.forEach((_, i) => cekRegu(i));
    }, 450);
  };

  jawab.regu.forEach((r, i) => {
    document.getElementById(`r-nama-${i}`).addEventListener("input", e => {
      r.nama_regu = e.target.value.trim(); simpanDraf();
      cekRegu(i);
      periksaNamaKeServer();
      if (sudahDiperiksa) periksa(false);
    });
    document.getElementById(`r-ketua-${i}`).addEventListener("input", e => {
      r.nama_ketua = e.target.value.trim(); simpanDraf();
      cekRegu(i);
      if (sudahDiperiksa) periksa(false);
    });
    // Anggota opsional: yang bisa SALAH cuma angka di namanya, dan itu
    // ditandai seketika — bukan saat tombol Kirim ditekan, karena saat itu
    // pembina sudah mengisi belasan kotak dan harus mencari yang mana.
    [0, 1, 2, 3].forEach(k => {
      document.getElementById(`r-anggota-${i}-${k}`).addEventListener("input", e => {
        if (!Array.isArray(r.anggota)) r.anggota = ["", "", "", ""];
        r.anggota[k] = e.target.value.trim();
        simpanDraf();
        cekRegu(i);
        if (sudahDiperiksa) periksa(false);
      });
    });
    cekRegu(i);   // baris baru (kosong) langsung tertandai, tanpa perlu disentuh dulu
  });
}

/* ---------------- 5. kontak WA: validasi live ---------------- */

/** Warning SEKETIKA sambil mengetik nomor WA — tidak menunggu tombol Kirim
 *  ditekan dulu. Kotak yang masih kosong (belum mulai diketik) tidak
 *  ditandai galat; begitu ada isi, formatnya dicek ulang di tiap ketukan. */
function cekWaLive() {
  const wa = document.getElementById("wa");
  const digitWa = wa.value.replace(/\D/g, "");
  const kosong = digitWa.length === 0;
  const sah = POLA_WA.test(digitWa);
  wa.setAttribute("aria-invalid", String(!kosong && !sah));
  document.getElementById("g-wa").hidden = kosong || sah;
}

/* ---------------- pemeriksaan: SEMUA galat sekaligus ---------------- */

function periksa(gulir = true) {
  sudahDiperiksa = true;
  const galat = [];

  const tandai = (id, ada) => { const e = document.getElementById(id); if (e) e.hidden = !ada; };

  if (!jawab.jenis_peserta) { galat.push({ ke: "bagian-jenis", teks: "Jenis peserta belum dipilih" }); }

  if (!jawab.sekolah) { galat.push({ ke: "bagian-sekolah", teks: "Sekolah belum dipilih" }); }
  tandai("g-sekolah", !jawab.sekolah);

  if (!internal() && jawab.butuh_barak === null) { galat.push({ ke: "bagian-barak", teks: "Belum menjawab soal menginap" }); }
  tandai("g-barak", jawab.butuh_barak === null);

  if (!jawab.regu.length) { galat.push({ ke: "bagian-jumlah", teks: "Belum ada regu" }); }
  tandai("g-jumlah", !jawab.regu.length);

  jawab.regu.forEach((r, i) => {
    // Nama kembar menahan Kirim sama kerasnya dengan kolom kosong: dikirim
    // pun database menolaknya, dan ditolak di sini pembina masih melihat
    // kartu mana yang harus diubah.
    const n = normalNama(r.nama_regu);
    const namaPendek = !!n && !cukupHuruf(n);
    const namaKembar = !!n
      && (jawab.regu.some((x, j) => j < i && normalNama(x.nama_regu) === n)
          || namaTerpakai.get(n) === true);
    const namaSalah = !n || namaPendek || namaKembar;
    const anggotaBerangka = (r.anggota || []).some(a => a && ADA_ANGKA.test(a));
    const kurang = namaSalah || !r.nama_ketua || ADA_ANGKA.test(r.nama_ketua)
      || anggotaBerangka;
    const el = document.getElementById(`regu-${i}`);
    if (el) el.classList.toggle("regu-card-error", kurang);
    if (kurang) {
      galat.push({ ke: `regu-${i}`, teks:
        namaPendek ? `Regu ${i + 1}: nama minimal ${HURUF_MIN} huruf`
        : namaKembar ? `Regu ${i + 1}: nama sudah dipakai`
        : `Regu ${i + 1} belum lengkap` });
    }
  });

  const namaKontakKosong = !jawab.nama_kontak.trim()
    || ADA_ANGKA.test(jawab.nama_kontak);
  if (namaKontakKosong)
    galat.push({ ke: "bagian-kontak", teks: !jawab.nama_kontak.trim()
      ? "Nama contact person belum diisi"
      : "Nama contact person tidak boleh memakai angka" });
  tandai("g-nama-kontak", namaKontakKosong);

  // Cara bayar menahan Kirim sama kerasnya dengan kolom kosong, dan bukti
  // transfer sama kerasnya dengan cara bayarnya sendiri: RPC menolak keduanya
  // (migrasi 0121), jadi menahannya di sini cuma membuat penolakan itu
  // terbaca sebagai kotak merah, bukan sebagai kartu galat sesudah menunggu.
  if (!jawab.metode_bayar)
    galat.push({ ke: "bagian-bayar", teks: "Cara pembayaran belum dipilih" });
  tandai("g-bayar", !jawab.metode_bayar);
  const buktiKurang = jawab.metode_bayar === "transfer" && !jawab.bukti_transfer;
  if (buktiKurang)
    galat.push({ ke: "bagian-bayar", teks: "Bukti transfer belum diunggah" });
  tandai("g-bukti", buktiKurang);

  const digitWa = jawab.kontak_wa.replace(/\D/g, "");
  const waSah = POLA_WA.test(digitWa);
  if (!waSah) galat.push({ ke: "bagian-kontak", teks: "Nomor WA belum sesuai format Indonesia" });
  tandai("g-wa", !waSah);

  // Ringkasan galat: satu tempat, bisa diketuk untuk lompat ke isiannya.
  const ringkas = document.getElementById("ringkas-galat");
  if (!galat.length) { ringkas.replaceChildren(); return true; }
  ringkas.replaceChildren(h(`
    <div class="card" style="border-color:var(--bahaya);background:var(--bahaya-muda)">
      <strong>Masih ada ${galat.length} isian yang perlu dilengkapi:</strong>
      <ul class="error-list">
        ${galat.map(g => html`<li><button type="button" data-ke="${g.ke}">${g.teks}</button></li>`).join("")}
      </ul>
    </div>`));
  ringkas.querySelectorAll("[data-ke]").forEach(b => b.addEventListener("click", () => {
    const t = document.getElementById(b.dataset.ke);
    t.scrollIntoView({ block: "center", behavior: "smooth" });
    const inp = t.querySelector("input, button.option");
    if (inp) setTimeout(() => inp.focus(), 350);
  }));
  if (gulir) ringkas.scrollIntoView({ block: "center", behavior: "smooth" });
  return false;
}

/* ---------------- Turnstile (hanya mode produksi) ---------------- */

function pasangTurnstile() {
  if (!(window.HRCD.mode === "supabase" && window.HRCD.turnstileSiteKey)) return;
  document.getElementById("turnstile-kotak").replaceChildren(h(`
    <div class="card"><div id="turnstile"></div>
      <p class="description">Centang kotak di atas dulu (bukti kamu bukan robot).</p></div>`));
  document.getElementById("kirim").disabled = true;
  const pasang = () => window.turnstile.render("#turnstile", {
    sitekey: window.HRCD.turnstileSiteKey,
    callback: t => { tokenTurnstile = t; document.getElementById("kirim").disabled = false; },
    "expired-callback": () => { tokenTurnstile = null; document.getElementById("kirim").disabled = true; },
    "error-callback": () => notif("Verifikasi keamanan gagal dimuat. Periksa internet, lalu muat ulang.", true),
  });
  if (window.turnstile) { pasang(); return; }
  const s = document.createElement("script");
  s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
  s.async = true; s.onload = pasang;
  s.onerror = () => notif("Verifikasi keamanan gagal dimuat. Periksa internet, lalu muat ulang.", true);
  document.head.appendChild(s);
}

/* ---------------- kirim ---------------- */

async function kirim(e) {
  const btn = e.currentTarget;
  if (btn.dataset.jalan === "1") return;
  if (!periksa()) return;

  btn.dataset.jalan = "1"; btn.disabled = true; btn.textContent = "Mengirim…";
  try {
    const hasil = await kirimPendaftaran({
      nama_sekolah: jawab.sekolah.nama,
      alamat_sekolah: jawab.sekolah.alamat,
      butuh_barak: jawab.butuh_barak,
      // Kunci pada kawat tetap `jumlah_pendamping`: itu kontrak dengan
      // Worker gateway, dan menggantinya menuntut deploy berbarengan supaya
      // pendaftaran tidak mati di antaranya. Isinya yang berubah arti.
      jumlah_pendamping: jawab.jumlah_menginap,
      kontak_wa: jawab.kontak_wa,
      nama_kontak: jawab.nama_kontak,
      regu: jawab.regu,
      kunci_kirim: jawab.kunci_kirim,     // sama saat mencoba lagi
      metode_bayar: jawab.metode_bayar,
      // Dikirim apa adanya juga saat tunai; RPC yang membuangnya. Menyaringnya
      // di sini berarti aturannya hidup di dua tempat.
      bukti_transfer: jawab.bukti_transfer,
    }, tokenTurnstile);
    // Rincian ikut disimpan, bukan cuma jawaban server: drafnya dihapus satu
    // baris di bawah ini, dan tanpa salinan ini layar "Pendaftaran terakhirmu"
    // sesudah reload kehilangan justru bagian yang membuat kodenya bisa
    // dibedakan dari kode sekolah lain.
    const lengkap = {
      ...hasil,
      sekolah: jawab.sekolah?.nama || "",
      regu: jawab.regu.map(r => r.nama_regu),
    };
    sessionStorage.setItem("hrcd_selesai", "1");
    try { localStorage.setItem(KUNCI_HASIL, JSON.stringify(lengkap)); } catch {}
    hapusDraf();
    sukses(lengkap);
  } catch (err) {
    btn.dataset.jalan = ""; btn.disabled = false; btn.textContent = "Kirim Pendaftaran";
    document.getElementById("ringkas-galat").replaceChildren(h(html`
      <div class="card" style="border-color:var(--bahaya);background:var(--bahaya-muda)">
        <strong>Belum terkirim.</strong>
        ${err instanceof ErrorApi ? err.message : "Coba lagi ya."}
        <div class="description" style="margin-top:.3rem">Isianmu tersimpan.</div>
      </div>`));
    document.getElementById("ringkas-galat").scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

/* ---------------- sukses ---------------- */

/* "Hiking Rally Ciradyka XXXVII". Nama edisinya tersimpan sebagai "HRCD
   XXXVII" — bentuk pendek untuk kepala layar — dan yang ditulis di WhatsApp
   adalah nama yang dikenali orang yang membacanya nanti, termasuk bendahara
   sekolah yang tidak pernah membuka form ini. */
const namaAcara = () => {
  const romawi = String(EDISI?.name || "").replace(/^HRCD\s*/i, "").trim();
  return `Hiking Rally Ciradyka${romawi ? ` ${romawi}` : ""}`;
};

/* Satu pembina bisa memegang beberapa sekolah, dan kode pembayaran tidak
   menyebutkan satu pun di antaranya. Tanpa rincian ini, empat tangkapan layar
   di galerinya sama persis kecuali enam huruf terakhir — dan yang salah
   ditransfer bukan kesalahan yang ketahuan sebelum uangnya berpindah.

   Karena itu asal sekolah dan nama tiap regu ikut ditulis, di layar maupun di
   pesan WhatsApp-nya. Keduanya membaca objek yang SAMA supaya tangkapan layar
   dan pesan tidak pernah menyebut isi yang berbeda. */
const rincianHtml = (r) => {
  if (!r || !r.sekolah) return "";
  const regu = Array.isArray(r.regu) ? r.regu.filter(Boolean) : [];
  return html`
    <div style="margin-top:1rem">
      <p><strong>Asal Sekolah</strong><br>${r.sekolah}</p>
      ${regu.length ? html`<p style="margin-top:.6rem"><strong>Nama Regu</strong></p>
        <ul style="margin:.2rem 0 0 1.1rem">
          ${regu.map(n => html`<li>${n}</li>`).join("")}
        </ul>` : ""}
      <p style="margin-top:.6rem">${r.jumlah_regu} regu, total
         <strong>${rupiah(r.total_tagihan)}</strong></p>
    </div>`;
};

/* Bentuk pesannya diminta pemilik acara, dan urutannya bukan selera: kode di
   paling atas supaya terbaca tanpa membuka pesannya, sekolah sesudahnya karena
   itu yang menjawab "ini pembayaran yang mana". */
const BARIS_BARU = "\n";

const pesanWa = (r) => {
  const baris = [`Kode Pembayaran ${namaAcara()}`, "", `- ${r.kode_pembayaran}`];
  if (r.sekolah) baris.push("", "Asal Sekolah:", r.sekolah);
  const regu = Array.isArray(r.regu) ? r.regu.filter(Boolean) : [];
  if (regu.length) baris.push("", "Nama Regu", ...regu.map(n => `- ${n}`));
  baris.push("", `${r.jumlah_regu} regu, total ${rupiah(r.total_tagihan)}`);
  return baris.join(BARIS_BARU);
};

function sukses(hasil) {
  LAYAR.replaceChildren(h(html`
    <div class="card" style="border-color:var(--hijau);background:var(--hijau-muda)">
      <h2>✅ Pendaftaran diterima!</h2>
      <p ${hasil.terkirim_ulang ? "" : "hidden"}>
        <strong>Pendaftaran ini sudah tercatat dari kiriman sebelumnya.</strong>
        Perubahan setelah kiriman pertama tidak ikut tersimpan. Data yang
        tercatat berisi ${hasil.jumlah_regu} regu; hubungi panitia bila perlu
        diperbaiki.
      </p>
      <p><strong>Simpan kode pembayaran ini.</strong> Kode ini akan digunakan
         untuk verifikasi pembayaran dan daftar ulang.</p>
      <div class="giant-number" style="margin:1rem 0">${hasil.kode_pembayaran}</div>
      <button class="button button-secondary" id="salin" type="button">📋 Salin kode</button>
      ${rincianHtml(hasil)}
    </div>
    <a class="button button-primary" style="text-decoration:none"
       href="https://wa.me/?text=${encodeURIComponent(pesanWa(hasil))}">
       Kirim kode ke WhatsApp
    </a>
    <button class="button button-secondary" id="daftar-lagi" type="button"
            style="margin-top:.6rem">Daftarkan Regu Lain</button>
  `));
  window.scrollTo(0, 0);
  document.getElementById("salin").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(hasil.kode_pembayaran);
      notif("Kode tersalin.");
    } catch {
      notif("Salin otomatis tidak didukung di HP ini — catat manual atau kirim lewat WhatsApp.", true);
    }
  });

  // Meja pendaftaran offline melayani sekolah beruntun: tanpa tombol ini,
  // petugas harus memuat ulang halaman untuk melayani sekolah berikutnya.
  // Hasil lama sengaja DIHAPUS supaya mulai() tidak menampilkan lagi layar
  // "Pendaftaran terakhirmu" alih-alih form kosong.
  document.getElementById("daftar-lagi").addEventListener("click", () => {
    try { localStorage.removeItem(KUNCI_HASIL); } catch {}
    sessionStorage.removeItem("hrcd_selesai");
    jawab = kosong();
    // Tanpa ini, form yang baru saja dikosongkan langsung memerah semua:
    // sudahDiperiksa masih true dari pendaftaran sebelumnya, jadi periksa()
    // menandai isian yang memang belum sempat disentuh siapa pun.
    sudahDiperiksa = false;
    halaman();
    window.scrollTo(0, 0);
  });
}

/* ---------------- mulai ---------------- */

async function mulai() {
  // Rangka yang sama dengan layar panitia — daftar.html memang memuat
  // style.css yang sama, jadi tidak ada gaya kedua yang perlu dijaga.
  LAYAR.replaceChildren(h(pemuat()));
  try {
    [SEKOLAH, EDISI] = await Promise.all([daftarSekolah(), infoEdisi()]);
  } catch (e) {
    LAYAR.replaceChildren(kartuGagalMuat(e.message, mulai));
    return;
  }
  // v_edisi_publik memberi kolom `name` sejak migrasi 0014 — `nama` sudah
  // tidak ada, dan membacanya diam-diam menghasilkan undefined.
  document.getElementById("label-edisi").textContent = EDISI.name;
  // Judul layar cukup satu kata. Nama acaranya sudah berdiri di kanan kepala
  // sebagai "HRCD <edisi>", dan sebelum ini tiga label mengatakan hal yang
  // sama bertumpuk: judul panjang, lencana edisi, dan kartu "Pendaftaran
  // Regu" — di layar HP ketiganya memakan sepertiga tinggi sebelum kotak
  // isian pertama muncul.
  //
  // Nomor edisi tetap ada di JUDUL TAB. Itulah yang sebenarnya dibutuhkan:
  // sekolah membuka form ini setahun sekali, dan tab lama yang masih terbuka
  // harus bisa dibedakan dari yang baru.
  document.getElementById("judul-daftar").textContent = "Pendaftaran";
  document.title = `Pendaftaran — ${namaAcara()}`;

  let hasilLama = null, draf = null;
  try { hasilLama = JSON.parse(localStorage.getItem(KUNCI_HASIL) || "null"); } catch {}
  try { draf = JSON.parse(localStorage.getItem(KUNCI_DRAF) || "null"); } catch {}

  if (hasilLama && !draf) {
    LAYAR.replaceChildren(h(html`
      <div class="card" style="border-color:var(--hijau);background:var(--hijau-muda)">
        <h2>Pendaftaran terakhirmu</h2>
        <p>Kode pembayaran:</p>
        <div class="giant-number" style="margin:.6rem 0">${hasilLama.kode_pembayaran}</div>
        ${hasilLama.sekolah
          ? rincianHtml(hasilLama)
          : html`<p class="description">${hasilLama.jumlah_regu} regu ·
                 ${rupiah(hasilLama.total_tagihan)}</p>`}
      </div>
      <a class="button button-primary" style="text-decoration:none"
         href="https://wa.me/?text=${encodeURIComponent(pesanWa(hasilLama))}">
         Kirim kode ke WhatsApp
      </a>
      <button class="button button-secondary" id="baru" type="button"
              style="margin-top:.6rem">Daftarkan regu lain</button>`));
    document.getElementById("baru").addEventListener("click", () => {
      try { localStorage.removeItem(KUNCI_HASIL); } catch {}
      sessionStorage.removeItem("hrcd_selesai");
      jawab = kosong(); halaman();
    });
    return;
  }

  if (draf && (draf.sekolah || draf.regu?.length)) {
    // Draf dari versi sebelum pilihan jenis peserta adalah jalur form lama,
    // yaitu Eksternal. Tetapkan otomatis agar ketikan yang sudah ada tidak
    // hilang hanya karena form mendapat satu pertanyaan baru.
    jawab = { ...kosong(), ...draf, jenis_peserta: draf.jenis_peserta ?? "eksternal" };
    // Versi lama pernah menyimpan fallback non-UUID. Perbaiki drafnya juga;
    // kalau hanya generator baru yang dibetulkan, setiap reload tetap memakai
    // kunci rusak yang sudah telanjur tersimpan.
    if (!POLA_UUID.test(String(jawab.kunci_kirim || ""))) {
      jawab.kunci_kirim = uuidDraf();
      simpanDraf();
    }
    if (jawab.jenis_peserta === "internal") {
      jawab.sekolah = sekolahInternal();
      jawab.butuh_barak = false;
      jawab.jumlah_menginap = 0;
      jawab.rincian.penggalang_pa = 0;
      jawab.rincian.penggalang_pi = 0;
      jawab.rincian.penegak_pa = 0;
      jawab.rincian.penegak_pi = 0;
      sinkronRegu();
    }
  }
  halaman();
}

mulai();
