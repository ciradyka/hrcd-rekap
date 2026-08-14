/* ============================================================================
   hrcd-rekap : app.js — aplikasi panitia (tahap 2).
   Aturan bentuk (rancangan-b.md 10.1): kerangka sama di semua layar,
   satu aksi utama per layar, kunci di-autofocus, echo-confirm sebelum simpan,
   "baris terakhir" di kaki, gagal itu nyaring dan lokal.

   Semua teks dari luar (nama sekolah/regu/ketua, pesan server) WAJIB lewat
   esc() atau tag html`` — lihat util.js.
   ========================================================================== */

import {
  sesi, masuk, keluar, gantiPasswordSendiri, ErrorApi,
  infoEdisi, ringkasanMeja, daftarPendaftaran,
  verifikasiPembayaran, batalkanVerifikasi, daftarUlang, tukarNomor,
  daftarKloter, tandaiKloterDicetak, pindahKloter, daftarSisipan,
  cariRegu, catatFinish, infoPenalti,
  papanKeberangkatan, reguKloter, kontrakOpsi,
  konfirmasiKontrak, ceklisBerangkat, batalCeklisBerangkat, berangkatkanKloter,
  koreksiJamBerangkat,
  daftarPos, komponenPos, lembarPos, lembarPosSatu, simpanNilaiPos, hapusNilaiPos,
  statusAcara,
} from "./api.js";
import { esc, h, html, rupiah, jamMenit, tanggalPanjang, notif, dialog,
         kartuGagalMuat } from "./util.js";

const LAYAR = document.getElementById("layar");
const GOLONGAN_LABEL = {
  penggalang_pa: "Penggalang PA", penggalang_pi: "Penggalang PI",
  penegak_pa: "Penegak PA", penegak_pi: "Penegak PI",
};
let EDISI = null;
const terakhir = { pembayaran: [], "daftar-ulang": [], finish: [] };

/* ---------------- kerangka ---------------- */

/** Lebar layar, tiga tingkat:
 *    false      layar satu-aksi — sempit, supaya tombol utamanya gampang
 *               ditemukan di layar kecil.
 *    true       tabel meja (pembayaran, daftar ulang) — butuh ruang, tapi
 *               tetap dipatok supaya barisnya tidak terbaca seperti pita.
 *    "lembar"   lembar Input Pos — layar TERLEBAR di sistem ini. Kolomnya
 *               ditentukan konfigurasi dan bisa bertambah tahun depan, jadi
 *               patokan 1080px yang pas untuk tabel meja justru memaksanya
 *               menggeser ke samping padahal layarnya masih lapang. */
/** Nama acara untuk judul tab: "Hiking Rally Ciradyka XXXVII".
 *  Angka romawinya DIAMBIL dari nama edisi di database ("HRCD XXXVII"),
 *  bukan ditulis di sini — tahun depan cukup mengubah satu baris di tabel
 *  edisi, tidak ada yang perlu mencarinya di dalam JavaScript. Sebelum edisi
 *  termuat (layar masuk), angkanya dilewati saja. */
const namaAcara = () => {
  const romawi = EDISI ? String(EDISI.name || "").replace(/^HRCD\s*/i, "").trim() : "";
  return `Hiking Rally Ciradyka${romawi ? ` ${romawi}` : ""}`;
};

function pasangKepala(judul, lebar = false) {
  const s = sesi();
  document.getElementById("kepala").hidden = !s;
  // Menu bawah HP ikut aturan yang sama dengan header: hanya untuk yang
  // sudah login. Penanda halaman aktif dipasang di sini juga supaya ikon
  // Home menyala saat memang sedang di Home.
  const nav = document.getElementById("bottom-nav");
  if (nav) {
    nav.hidden = !s;
    const diHome = location.hash === "#/home" || location.hash === "";
    document.getElementById("nav-home")
      .setAttribute("aria-current", diHome ? "page" : "false");
    document.getElementById("nav-setting")
      .setAttribute("aria-current", location.hash === "#/ganti-password" ? "page" : "false");
  }
  document.getElementById("judul-layar").textContent = judul;
  document.title = `${judul} — ${namaAcara()}`;
  LAYAR.classList.toggle("wide", lebar === true);
  LAYAR.classList.toggle("lembar", lebar === "lembar");
  if (s) document.getElementById("siapa").textContent =
    `${s.username} · ${EDISI ? EDISI.name : ""}`;
}

const kartuGalat = (pesan) => html`
  <div class="card" style="border-color:var(--bahaya);background:var(--bahaya-muda)">
    <strong>${pesan}</strong></div>`;

function barisTerakhirHtml(fungsi) {
  const daftar = terakhir[fungsi] || [];
  if (!daftar.length) return "";
  return `<div class="card">
    <h2 style="font-size:1rem;color:var(--tinta-lembut)">Baru saja di meja ini</h2>
    <table class="table">${daftar.slice(0, 8).map(b => html`
      <tr><td>${b.jam}</td><td><strong>${b.apa}</strong></td><td>${b.detail}</td></tr>`).join("")}
    </table></div>`;
}
function catatTerakhir(fungsi, apa, detail) {
  terakhir[fungsi].unshift({ jam: jamMenit(new Date()), apa, detail });
}

/* ============================ LOGIN ===================================== */

function layarLogin(pesan) {
  pasangKepala("HRCD Rekap");
  LAYAR.replaceChildren(h(`
    <div class="card" style="max-width:480px;margin:2rem auto">
      <h2>Masuk Panitia</h2>
      <p class="description">Pakai akun yang dibagikan koordinatormu.</p>
      ${pesan ? `<div class="error" style="margin-top:.5rem">${esc(pesan)}</div>` : ""}
      <div class="field" style="margin-top:1rem">
        <label for="u">Username</label>
        <input type="text" id="u" autocomplete="username" autocapitalize="none"
               spellcheck="false">
      </div>
      <div class="field">
        <label for="p">Password</label>
        <input type="password" id="p" autocomplete="current-password">
      </div>
      <button class="button button-primary" id="masuk" type="button">Masuk</button>
    </div>
  `));
  const u = document.getElementById("u");
  u.focus();
  const aksi = async () => {
    const btn = document.getElementById("masuk");
    btn.disabled = true; btn.textContent = "Memeriksa…";
    try {
      await masuk(u.value.trim(), document.getElementById("p").value);
      EDISI = null;
      location.hash = "#/home";
      arahkan();
    } catch (e) {
      layarLogin(e instanceof ErrorApi ? e.message : "Username atau password salah.");
    }
  };
  document.getElementById("masuk").addEventListener("click", aksi);
  LAYAR.querySelectorAll("input").forEach(i =>
    i.addEventListener("keydown", e => { if (e.key === "Enter") aksi(); }));
}

/* ============================ BERANDA MEJA (home) ========================= */

async function layarHome() {
  pasangKepala("Home");
  const peran = sesi().peran;
  LAYAR.replaceChildren(h(`<p>Memuat…</p>`));

  // Operator pos tidak berhak atas layar meja — RLS akan mengosongkan
  // datanya dan itu tampak seperti "tidak ada antrean" (temuan review).
  // Tapi ia punya satu layar sendiri, dan Home-nya harus menunjukkan layar
  // itu: sebelumnya halaman ini buntu, dan akun pos tidak punya jalan ke
  // mana pun kecuali mengetik alamatnya sendiri.
  if (peran === "operator_pos") {
    LAYAR.replaceChildren(h(html`
      <div class="function-menu">
        <a href="#/pos">
          <div class="function-name">📋 Input Nilai Pos ${sesi().pos}</div>
          <div class="description">Isi nilai tiap regu di pos ini —
             tabelnya sama seperti lembar kertasnya</div>
        </a>
      </div>
      <p class="description" style="margin-top:1.2rem">Akun ${sesi().username}
         hanya menyentuh nilai Pos ${sesi().pos}. Layar meja (pembayaran,
         daftar ulang, keberangkatan) memakai akun yang lain.</p>`));
    return;
  }

  let r = null, galat = null;
  try { r = await ringkasanMeja(); } catch (e) { galat = e.message; }
  const lencana = (n) => n === null
    ? `<span class="badge badge-gray" title="jumlah antrean tidak terbaca">?</span>`
    : `<span class="badge ${n > 0 ? "badge-yellow" : "badge-green"}">${n}</span>`;

  LAYAR.replaceChildren(h(`
    ${galat ? kartuGalat(`Jumlah antrean tidak bisa dibaca: ${galat}`) : ""}
    <div class="function-menu">
      <a href="daftar.html" target="_blank" rel="noopener">
        <div class="function-name">📝 Pendaftaran</div>
        <div class="description">Buka form pendaftaran — diisikan langsung, tab baru supaya meja ini tetap terbuka</div>
      </a>
      <a href="#/pembayaran">
        <div class="function-name">💳 Pembayaran ${lencana(r ? r.menunggu_pembayaran : null)}</div>
        <div class="description">Periksa transfer/tunai, tandai lunas, cetak kwitansi</div>
      </a>
      <a href="#/daftar-ulang">
        <div class="function-name">🎽 Daftar Ulang ${lencana(r ? r.lunas_belum_nomor : null)}</div>
        <div class="description">Berikan nomor dada untuk sekolah yang sudah lunas</div>
      </a>
      <a href="#/cetak-kloter">
        <div class="function-name">🖨️ Cetak Daftar Kloter</div>
        <div class="description">Kertas untuk papan pengumuman, barak, dan petugas staging</div>
      </a>
      <a href="#/keberangkatan">
        <div class="function-name">🚩 Keberangkatan</div>
        <div class="description">Ceklis regu yang hadir, pilih kontrak waktu, catat jam berangkat</div>
      </a>
      <a href="#/finish">
        <div class="function-name">🏁 Kedatangan</div>
        <div class="description">Ketik nomor dada, tekan Sampai — catat kedatangan regu</div>
      </a>
      ${peran === "admin" ? `
      <a href="#/pos">
        <div class="function-name">📋 Input Nilai Pos</div>
        <div class="description">Lembar penilaian tiap pos — admin boleh membuka pos mana pun</div>
      </a>` : ""}
    </div>
    <p class="description" style="margin-top:1.2rem">Angka kuning = masih ada antrean.
       Meja boleh berganti fungsi kapan saja — cukup pilih dari sini.</p>
  `));
}

/* ============================ GANTI PASSWORD ============================= */

// Kode konfirmasi TETAP, sengaja tidak ditulis di label atau pesan galat —
// panitia tahu kodenya dari koordinator, bukan dari layar ini. Tapi ini
// TETAP BUKAN pemeriksaan identitas sungguhan: nilainya sama untuk semua
// orang, dan ada apa adanya di berkas JS ini — siapa pun yang membuka
// devtools browser bisa membacanya. Identitas yang sungguhan diperiksa
// sudah dibuktikan lewat sesi login yang sedang aktif; kode ini cuma jeda
// sadar sebelum ganti password benar-benar terjadi, karena HP panitia
// sering berpindah tangan sebentar di lapangan.
const KODE_KONFIRMASI_PASSWORD = "ABCD";

function layarGantiPassword() {
  pasangKepala("Ganti Password");
  LAYAR.replaceChildren(h(`
    <div class="card" style="max-width:480px;margin:0 auto">
      <h2>Ganti Password Akun Sendiri</h2>
      <p class="description">Berlaku untuk akun yang sedang login sekarang:
         <strong>${esc(sesi().username)}</strong>.</p>
      <div class="field">
        <label for="gp-baru">Password baru</label>
        <input type="password" id="gp-baru" autocomplete="new-password">
      </div>
      <div class="field">
        <label for="gp-kode">Kode Konfirmasi</label>
        <input type="password" id="gp-kode" autocomplete="off">
      </div>
      <div class="error" id="gp-galat" hidden></div>
      <button class="button button-primary" id="gp-simpan" type="button">Simpan Password Baru</button>
    </div>
  `));

  const baru = document.getElementById("gp-baru");
  const kode = document.getElementById("gp-kode");
  const galat = document.getElementById("gp-galat");
  const btn = document.getElementById("gp-simpan");

  btn.addEventListener("click", async () => {
    galat.hidden = true;
    if (!baru.value || baru.value.length < 6) {
      galat.textContent = "Password baru minimal 6 karakter.";
      galat.hidden = false; baru.focus(); return;
    }
    if (kode.value.trim() !== KODE_KONFIRMASI_PASSWORD) {
      galat.textContent = "Kode konfirmasi salah. Tanyakan koordinator kalau lupa.";
      galat.hidden = false; kode.focus(); return;
    }
    if (btn.dataset.jalan === "1") return;
    btn.dataset.jalan = "1"; btn.disabled = true; btn.textContent = "Menyimpan…";
    try {
      await gantiPasswordSendiri(baru.value);
      notif("Password berhasil diganti. Dipakai mulai login berikutnya.");
      baru.value = ""; kode.value = "";
    } catch (err) {
      galat.textContent = err.message; galat.hidden = false;
    } finally {
      btn.dataset.jalan = ""; btn.disabled = false; btn.textContent = "Simpan Password Baru";
    }
  });
  baru.focus();
}

/* ============================ ALAT TABEL ================================= */

/** Kotak cari + tombol saring, dipakai layar Pembayaran & Daftar Ulang.
 *  Menyaring di browser (data sudah dimuat semua) supaya hasilnya berubah
 *  seketika sambil mengetik — di meja, menunggu server tiap huruf terasa
 *  seperti aplikasi macet. */
function alatTabel({ saringan, saringAktif, jumlah, cariContoh, kiri = "", kanan = "" }) {
  return `
    <div class="table-toolbar">
      ${kiri}
      <div class="field" style="margin:0;flex:1;min-width:220px">
        <label for="cari-tabel" class="visually-hidden">Cari</label>
        <input type="text" id="cari-tabel" autocomplete="off"
               placeholder="${esc(cariContoh || "Cari kode, sekolah, atau nama regu…")}">
      </div>
      <div class="filter-row">
        ${saringan.map(s => `
          <button type="button" class="option option-small" data-saring="${esc(s.kode)}"
                  aria-pressed="${s.kode === saringAktif}">${esc(s.label)}</button>`).join("")}
      </div>
      <span class="table-count" id="tabel-jumlah">${jumlah} baris</span>
      ${kanan}
    </div>`;
}

/** Pasang perilaku cari + saring. gambar(cari, saring) menggambar ulang
 *  isi tabel saja — kerangka layar tidak ikut dibangun ulang supaya fokus
 *  kotak cari tidak lompat saat mengetik (temuan uji). */
function pasangAlatTabel(gambar) {
  const inp = document.getElementById("cari-tabel");
  let saring = LAYAR.querySelector("[data-saring][aria-pressed='true']")?.dataset.saring || "";
  let cari = "";
  let jeda = null;

  const jalan = () => gambar(cari, saring);

  inp.addEventListener("input", () => {
    clearTimeout(jeda);
    // Jeda pendek: mengetik cepat tidak menggambar ulang tiap huruf.
    jeda = setTimeout(() => { cari = inp.value.trim().toLowerCase(); jalan(); }, 120);
  });
  LAYAR.querySelectorAll("[data-saring]").forEach(b =>
    b.addEventListener("click", () => {
      saring = b.dataset.saring;
      LAYAR.querySelectorAll("[data-saring]").forEach(x =>
        x.setAttribute("aria-pressed", String(x === b)));
      jalan();
    }));
  inp.focus();
  jalan();
}

/** Filter bersama: kode pembayaran, nama sekolah, atau nama salah satu regu
 *  mengandung teks cari. Nama regu ikut dicari karena meja pembayaran
 *  menampilkan barisnya per regu — yang disebut sekolah kadang nama regunya,
 *  bukan kodenya. */
const cocokCari = (b, cari) => !cari
  || b.kode_pembayaran.toLowerCase().includes(cari)
  || (b.sekolah?.name || "").toLowerCase().includes(cari)
  || (b.regu || []).some(r => (r.nama_regu || "").toLowerCase().includes(cari));

const reguAktif = (b) => (b.regu || []).filter(r => !r.is_cancelled);

/* ============================ MEJA PEMBAYARAN ============================ */

async function layarPembayaran() {
  if (!EDISI) { layarButuhEdisi("Meja Pembayaran"); return; }
  pasangKepala("Meja Pembayaran", true);
  LAYAR.replaceChildren(h(`<p>Memuat…</p>`));

  const layarIni = location.hash;
  let semua;
  try { semua = await daftarPendaftaran(); }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarPembayaran)); return; }
  // Panitia menekan Pembayaran lalu cepat pindah ke layar lain: jawaban yang
  // datang belakangan TIDAK boleh menimpa layar yang sedang dibuka sekarang.
  if (location.hash !== layarIni) return;

  // Invoice yang barisan detail regunya sedang dibuka. Ikut disimpan supaya
  // detail tidak menutup sendiri setiap kali tabel digambar ulang.
  const dibuka = new Set();

  LAYAR.replaceChildren(h(`
    <div class="card">
      ${alatTabel({
        saringan: [
          { kode: "belum", label: "Belum bayar" },
          { kode: "lunas", label: "Lunas" },
          { kode: "semua", label: "Semua" },
        ],
        saringAktif: "belum",
        jumlah: semua.length,
      })}
      <div class="table-wrapper">
        <table class="table data-table table-bayar">
          <thead>
            <tr>
              <th>Kode Bayar</th><th>Sekolah</th><th class="text-center">Regu</th>
              <th class="text-right">Tagihan</th><th class="text-center">Metode</th><th></th>
            </tr>
          </thead>
          <tbody id="isi-tabel"></tbody>
        </table>
      </div>
    </div>
    ${barisTerakhirHtml("pembayaran")}
  `));

  // Kotak cari dan saringan dipegang pasangAlatTabel — jalan ulang menyimpan
  // saringan yang sedang aktif tanpa memasang ulang listener-nya tiap kali.
  let cariKini = "", saringKini = "belum";
  const gambarUlang = () => gambar(cariKini, saringKini);

  const gambar = (cari, saring) => {
    cariKini = cari; saringKini = saring;
    const baris = semua.filter(b =>
      cocokCari(b, cari) &&
      (saring === "semua" || (saring === "lunas" ? b.status === "lunas"
                                                 : b.status === "menunggu_pembayaran")));
    // Dua angka sekaligus: yang dibayar adalah invoice, yang dihitung panitia
    // saat mencocokkan uang adalah regu.
    const jumlahRegu = baris.reduce((n, b) => n + reguAktif(b).length, 0);
    document.getElementById("tabel-jumlah").textContent =
      `${baris.length} invoice · ${jumlahRegu} regu`;
    const tbody = document.getElementById("isi-tabel");

    if (!baris.length) {
      tbody.replaceChildren(h(`<tr><td colspan="6" class="table-empty">
        Tidak ada yang cocok.</td></tr>`));
      return;
    }

    tbody.replaceChildren(h(baris.map(b => {
      const aktif = reguAktif(b);
      const tagihan = aktif.length * EDISI.biaya_per_regu;
      // Cara bayar default TUNAI — mayoritas sekolah membayar langsung di
      // meja, jadi jalur tersibuk cukup satu ketukan. Yang transfer memilih
      // "Transfer" dulu. Salah tandai dibereskan lewat "Batalkan", bukan
      // dicegah dengan ketukan tambahan untuk semua orang.
      // Cara bayar berdiri di kolomnya SENDIRI. Untuk yang belum bayar ia
      // dropdown; untuk yang sudah, ia catatan cara pembayarannya benar-
      // benar diterima — pertanyaan yang sering ditanya saat menyusun
      // laporan keuangan, dan dulu tidak terlihat di mana pun.
      // Kolom Metode memuat cara bayar SEKALIGUS statusnya: dua fakta
      // tentang uang yang sama, dibaca bersama. Kolom aksi tinggal berisi
      // tombol saja, jadi tombolnya muat berderet ke samping.
      const metode = b.status === "lunas"
        // Nomor kwitansi TIDAK ditampilkan di tabel: panjang, tidak pernah
        // dicari lewat layar ini, dan sudah tercetak di kwitansinya sendiri
        // — di situlah ia berguna saat menyusun berkas.
        ? html`<div>${b.pembayaran ? b.pembayaran.method : "—"}</div>
               <span class="badge badge-green">LUNAS</span>`
        : b.status === "batal"
          ? `<span class="badge badge-red">BATAL</span>`
          : `<select class="select-small" data-metode="${esc(b.kode_pembayaran)}">
               <option value="tunai" selected>Tunai</option>
               <option value="transfer">Transfer</option>
             </select>`;

      const aksi = b.status === "lunas"
        // <span class="teks-lebar"> = kata yang DIBUANG di layar sempit, jadi
        // tombolnya menyusut sendiri: "Cetak Kwitansi" -> "Kwitansi",
        // "Tandai Lunas" -> "Lunas". Tanpa ini, di jendela sempit tombolnya
        // melebar sampai menutupi dropdown cara bayar di sebelahnya.
        // Label dibungkus SATU <span> luar supaya .button — yang inline-flex
        // dengan gap .5rem — melihatnya sebagai satu item saja. Tanpa
        // pembungkus itu, "Tandai" dan "Lunas" jadi dua item terpisah dan
        // gap-nya menambah jarak sendiri: terbaca "Tandai  Lunas".
        ? `<div class="action-row action-row-rapat">
                 <button class="button button-primary button-mini" type="button"
                         data-cetak="${esc(b.kode_pembayaran)}"><span><span
                         class="teks-lebar">Cetak </span>Kwitansi</span></button>
                 <button class="button button-secondary button-mini" type="button"
                         data-batal-bayar="${esc(b.kode_pembayaran)}">Batalkan</button>
               </div>`
        : b.status === "batal"
          ? ""
          : `<button class="button button-primary button-small" type="button"
                     data-lunas="${esc(b.kode_pembayaran)}"><span><span
                     class="teks-lebar">Tandai </span>Lunas</span></button>`;
      // Satu baris = satu invoice, karena satu invoice memang dibayar
      // sekaligus. Rincian regunya (nama, kategori, asal sekolah) ada di
      // baris detail yang dibuka lewat tombol "N regu" — itu yang dibacakan
      // saat sekolah menyerahkan uang, dan itu juga yang dicetak di kwitansi.
      const kode = esc(b.kode_pembayaran);
      const sekolah = esc(b.sekolah?.name || "—");
      const terbuka = dibuka.has(b.kode_pembayaran);

      // Template biasa, BUKAN tag html`` — aksi sudah berupa HTML jadi tidak
      // boleh ikut di-escape. Data dari luar tetap lewat esc() satu per satu.
      return `
        <tr class="invoice-row" data-baris="${kode}">
          <td class="mono" data-label="Kode Bayar">${kode}</td>
          <td data-label="Sekolah">
            <strong>${sekolah}</strong>
            ${aktif.length ? "" : `<div class="sub">semua regu batal</div>`}
          </td>
          <!-- Pembuka rincian duduk DI KOLOM REGU, bukan di bawah nama
               sekolah. Angkanya sama persis dengan yang dulu tercetak di
               kolom ini, jadi menaruhnya di sini menghapus satu pengulangan
               sekaligus mengembalikan lebar ke kolom Sekolah.
               Kata "regu" dibungkus <span class="satuan-regu"> karena hanya
               dipakai di kartu HP — di tabel, judul kolomnya sudah menyebut
               REGU dan mengulanginya cuma memakan lebar. Pembaca layar tetap
               mendapat kalimat utuh lewat aria-label, di kedua tampilan. -->
          <td class="text-center" data-label="Regu">
            ${aktif.length
              ? `<button class="button-detail" type="button" data-detail="${kode}"
                         data-jumlah="${aktif.length}" aria-expanded="${terbuka}"
                         aria-label="Lihat ${aktif.length} regu ${esc(sekolah)}">${
                   terbuka ? "▾" : "▸"} ${aktif.length}<span class="satuan-regu"> regu</span></button>`
              : aktif.length}
          </td>
          <td class="text-right" data-label="Tagihan">${esc(rupiah(tagihan))}</td>
          <td class="text-center" data-label="Metode">${metode}</td>
          <td data-label="">${aksi}</td>
        </tr>
        ${!aktif.length ? "" : `
        <tr class="detail-row" data-detail-untuk="${kode}" ${terbuka ? "" : "hidden"}>
          <td colspan="6" class="detail-cell-flush">
            <table class="detail-table detail-table-bayar">
              <thead>
                <tr><th>Regu</th><th>Kategori</th><th>Ketua</th><th>Sekolah</th>
                    <th class="text-right">Biaya</th></tr>
              </thead>
              <tbody>
                ${aktif.map(r => `
                  <tr>
                    <td><strong>${esc(r.nama_regu)}</strong></td>
                    <td>${esc(GOLONGAN_LABEL[r.golongan] || r.golongan)}</td>
                    <td>${esc(r.nama_ketua)}</td>
                    <td>${sekolah}</td>
                    <td class="text-right">${esc(rupiah(EDISI.biaya_per_regu))}</td>
                  </tr>`).join("")}
              </tbody>
            </table>
          </td>
        </tr>`}`;
    }).join("")));

    /** Isi tombol pembuka rincian: segitiga, jumlah regu, dan kata "regu"
     *  yang hanya tampil di kartu HP (lihat .satuan-regu di gaya). Dibangun
     *  sebagai node, BUKAN textContent — textContent akan membuang <span>
     *  pembungkus kata itu, dan sesudah tombol pertama diklik kartu HP
     *  kehilangan kata "regu" sementara kartu lain masih memilikinya. */
    const isiTombolDetail = (terbuka, jumlah) => {
      const satuan = document.createElement("span");
      satuan.className = "satuan-regu";
      satuan.textContent = " regu";
      return [document.createTextNode(`${terbuka ? "▾" : "▸"} ${jumlah}`), satuan];
    };

    // Buka/tutup rincian regu satu invoice.
    tbody.querySelectorAll("[data-detail]").forEach(btn =>
      btn.addEventListener("click", () => {
        const kode = btn.dataset.detail;
        const barisDetail = tbody.querySelector(`[data-detail-untuk="${CSS.escape(kode)}"]`);
        const buka = barisDetail.hidden;
        // Satu panel saja yang terbuka. Dua rincian terbuka bersamaan membuat
        // baris invoice dan rinciannya berselang-seling di layar, dan petugas
        // yang membacakan rincian ke sekolah bisa membacakan milik sekolah
        // lain — kesalahan yang tidak menimbulkan galat apa pun.
        if (buka) {
          tbody.querySelectorAll("[data-detail-untuk]").forEach(lain => {
            if (lain !== barisDetail) lain.hidden = true;
          });
          tbody.querySelectorAll("[data-detail]").forEach(lainBtn => {
            if (lainBtn === btn) return;
            lainBtn.setAttribute("aria-expanded", "false");
            lainBtn.replaceChildren(...isiTombolDetail(false, lainBtn.dataset.jumlah));
          });
          dibuka.clear();
        }
        if (buka) dibuka.add(kode); else dibuka.delete(kode);
        barisDetail.hidden = !buka;
        btn.setAttribute("aria-expanded", String(buka));
        btn.replaceChildren(...isiTombolDetail(buka, btn.dataset.jumlah));
      }));

    tbody.querySelectorAll("[data-cetak]").forEach(btn =>
      btn.addEventListener("click", () => {
        const b = semua.find(x => x.kode_pembayaran === btn.dataset.cetak);
        if (b) cetakKwitansi([b]);
      }));

    // Jalan mundur yang sah untuk salah tandai (rancangan-b.md 11.9) —
    // wajib beralasan, dan ditolak server bila batch sudah daftar ulang.
    tbody.querySelectorAll("[data-batal-bayar]").forEach(btn =>
      btn.addEventListener("click", async () => {
        const kode = btn.dataset.batalBayar;
        const b = semua.find(x => x.kode_pembayaran === kode);
        const jawab = await dialog({
          judul: "Batalkan verifikasi pembayaran",
          kartuHtml: html`<div class="card card-identity" style="margin-bottom:.8rem">
            <div class="nama">${b.sekolah?.name || kode}</div>
            <div class="detail">${kode} · kwitansi ${b.pembayaran?.nomor_kwitansi || "—"}</div>
          </div>`,
          medan: [{ label: "Alasan pembatalan", contoh: "salah klik" }],
          labelAksi: "Batalkan",
        });
        if (!jawab) return;
        try {
          await batalkanVerifikasi(kode, jawab[0]);
          b.status = "menunggu_pembayaran";
          b.pembayaran = null;
          catatTerakhir("pembayaran", kode, `dibatalkan — ${jawab[0]}`);
          notif(`Verifikasi ${kode} dibatalkan.`);
          gambarUlang();
        } catch (err) { notif(err.message, true); }
      }));

    tbody.querySelectorAll("[data-lunas]").forEach(btn =>
      btn.addEventListener("click", async () => {
        const kode = btn.dataset.lunas;
        const b = semua.find(x => x.kode_pembayaran === kode);
        const metode = tbody.querySelector(`[data-metode="${CSS.escape(kode)}"]`).value;
        const aktif = reguAktif(b);
        const tagihan = aktif.length * EDISI.biaya_per_regu;

        if (btn.dataset.jalan === "1") return;
        btn.dataset.jalan = "1"; btn.disabled = true; btn.textContent = "Menyimpan…";
        let r;
        try {
          r = await verifikasiPembayaran(kode, tagihan, metode);
        } catch (err) {
          notif(err.message, true);
          btn.dataset.jalan = ""; btn.disabled = false; btn.textContent = "Tandai Lunas";
          return;
        }
        // Sumber data lokal ikut diperbarui supaya saringan & baris lain
        // tetap konsisten tanpa memuat ulang seluruh tabel.
        tandaiLunasLokal(b, tagihan, metode, r.nomor_kwitansi);
        notif(`${b.sekolah?.name || kode} LUNAS — kwitansi ${r.nomor_kwitansi}`);
        gambarUlang();

        // Panel sukses langsung menawarkan cetak (rancangan-b.md 10.2) —
        // satu alur, bukan dua. Menolak di sini tidak menghilangkan apa pun:
        // tombol "Cetak Kwitansi" tetap ada di barisnya.
        const cetak = await dialog({
          judul: "Lunas — cetak kwitansi?",
          kartuHtml: html`<div class="card card-identity" style="margin-bottom:.8rem">
            <div class="nama">${r.nomor_kwitansi}</div>
            <div class="detail">${b.sekolah?.name || kode} · ${kode} ·
              ${aktif.length} regu · ${rupiah(tagihan)}</div>
          </div>`,
          labelAksi: "Cetak Kwitansi",
        });
        if (cetak) cetakKwitansi([b]);
      }));
  };

  pasangAlatTabel(gambar);
}

/** Menyalin hasil verifikasi ke data lokal + daftar "baris terakhir", supaya
 *  jalur satuan dan jalur massal menulis fakta yang sama persis. */
function tandaiLunasLokal(b, nominal, metode, nomorKwitansi) {
  b.status = "lunas";
  b.pembayaran = {
    nominal, metode, nomor_kwitansi: nomorKwitansi,
    verified_at: new Date().toISOString(),
  };
  catatTerakhir("pembayaran", b.kode_pembayaran,
    `${b.sekolah?.name || ""} — lunas, ${nomorKwitansi}`);
}

/** Kwitansi siap cetak — satu invoice satu lembar, dengan rincian regu yang
 *  dibayar di dalamnya. Sekolah membayar sekaligus, tapi yang mereka simpan
 *  sebagai bukti adalah daftar regunya: nama, kategori, dan biaya per regu.
 *  Dibangun ke dalam #cetakan seperti daftar kloter — di layar tersembunyi,
 *  muncul hanya di kertas (style.css @media print). */
function cetakKwitansi(daftar) {
  document.getElementById("cetakan")?.remove();
  const s = sesi();
  const tanggal = (t) => tanggalPanjang(t || Date.now());

  const halaman = daftar.map(b => {
    const aktif = reguAktif(b);
    const bayar = b.pembayaran || {};
    const total = bayar.amount ?? aktif.length * EDISI.biaya_per_regu;
    const baris = aktif.map((r, i) => html`
      <tr><td>${String(i + 1)}</td>
          <td>${r.nama_regu}</td>
          <td>${GOLONGAN_LABEL[r.golongan] || r.golongan}</td>
          <td>${r.nama_ketua}</td>
          <td class="text-right">${rupiah(EDISI.biaya_per_regu)}</td></tr>`).join("");

    return `
      <section class="print-page">
        <h1>KWITANSI — ${esc(EDISI ? EDISI.name : "")}</h1>
        <p class="receipt-number">${esc(bayar.nomor_kwitansi || "—")}</p>
        <p><strong>Diterima dari:</strong> ${esc(b.sekolah?.name || "—")}</p>
        <p><strong>Kode pembayaran:</strong> ${esc(b.kode_pembayaran)}
           · <strong>Cara bayar:</strong> ${esc(bayar.method || "—")}
           · <strong>Tanggal:</strong> ${esc(tanggal(bayar.verified_at))}</p>
        <p><strong>Untuk pembayaran:</strong> pendaftaran ${aktif.length} regu
           @ ${esc(rupiah(EDISI.biaya_per_regu))}</p>
        <table class="print-table">
          <thead>
            <tr><th>No</th><th>Nama Regu</th><th>Kategori</th><th>Ketua</th>
                <th class="text-right">Biaya</th></tr>
          </thead>
          <tbody>${baris}</tbody>
          <tfoot>
            <tr><th colspan="4" class="text-right">TOTAL</th>
                <th class="text-right">${esc(rupiah(total))}</th></tr>
          </tfoot>
        </table>
        <div class="receipt-signature">
          <p>Diterima oleh,</p>
          <p class="receipt-line">${esc(s ? s.username : "")}</p>
        </div>
        <p class="print-note">Kwitansi ini bukti pendaftaran regu di atas.
           Simpan dan bawa saat daftar ulang.</p>
      </section>`;
  }).join("");

  document.body.appendChild(h(`<div id="cetakan" class="printout">${halaman}</div>`));
  window.print();
}

/* ============================ MEJA DAFTAR ULANG ========================== */

async function layarDaftarUlang() {
  if (!EDISI) { layarButuhEdisi("Meja Daftar Ulang"); return; }
  pasangKepala("Meja Daftar Ulang", true);
  LAYAR.replaceChildren(h(`<p>Memuat…</p>`));

  const layarIni = location.hash;
  let semua;
  try { semua = await daftarPendaftaran(); }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarDaftarUlang)); return; }
  if (location.hash !== layarIni) return;   // lihat catatan di layarPembayaran

  // Batch yang daftar isian nomor dadanya sedang dibuka, dan nomor yang sudah
  // sempat diketik (regu_id -> nomor). Keduanya hidup di luar gambar(): meja
  // sering mengetik separuh lalu mengoreksi jumlah pendamping atau mencari
  // sekolah lain, dan tabel digambar ulang setiap kali. Tanpa ini, angka yang
  // sudah dibacakan dari kain fisik hilang diam-diam — persis kejadian yang
  // paling mahal di meja daftar ulang.
  const dibukaNomor = new Set();
  const nilaiDada = new Map();

  LAYAR.replaceChildren(h(`
    <div class="card">
      ${alatTabel({
        saringan: [
          { kode: "belum", label: "Belum dapat nomor" },
          { kode: "sudah", label: "Sudah" },
          { kode: "semua", label: "Semua yang lunas" },
        ],
        saringAktif: "belum",
        jumlah: semua.length,
      })}
      <div class="table-wrapper">
        <table class="table data-table table-daftar-ulang">
          <thead>
            <tr>
              <!-- Tidak ada kolom Regu di sini. Jumlahnya sudah tercetak di
                   dalam tombol "Isi N Nomor Dada" di kolom terakhir, dan
                   kolom sendiri hanya untuk mengulanginya adalah lebar yang
                   terbuang — di jendela sempit lebar itulah yang membuat
                   tombolnya terdorong keluar layar. -->
              <th>Kode Bayar</th><th>Sekolah</th><th></th>
            </tr>
          </thead>
          <tbody id="isi-tabel"></tbody>
        </table>
      </div>
    </div>
    ${barisTerakhirHtml("daftar-ulang")}
  `));

  const gambar = (cari, saring) => {
    // Hanya batch lunas yang relevan di meja ini — yang belum bayar
    // diarahkan ke meja pembayaran dulu, bukan ditampilkan lalu ditolak.
    const lunas = semua.filter(b => b.status === "lunas");
    const belumSemua = (b) => reguAktif(b).some(r => r.nomor_dada === null);
    const baris = lunas.filter(b =>
      cocokCari(b, cari) &&
      (saring === "semua" || (saring === "sudah" ? !belumSemua(b) : belumSemua(b))));

    document.getElementById("tabel-jumlah").textContent = `${baris.length} baris`;
    const tbody = document.getElementById("isi-tabel");

    if (!baris.length) {
      tbody.replaceChildren(h(`<tr><td colspan="3" class="table-empty">
        Tidak ada yang cocok.</td></tr>`));
      return;
    }

    tbody.replaceChildren(h(baris.map(b => {
      const aktif = reguAktif(b);
      const menunggu = aktif.filter(r => r.nomor_dada === null);
      const nomorHtml = aktif.filter(r => r.nomor_dada !== null)
        .sort((x, y) => x.nomor_dada - y.nomor_dada)
        .map(r => html`<span class="pill-number">${String(r.nomor_dada).padStart(3, "0")}
          <span class="kloter-pill">K${r.kloter_nomor}</span></span>`).join(" ");

      const kode = esc(b.kode_pembayaran);
      const tombolTukar = nomorHtml
        ? `<button class="button button-secondary button-mini" type="button"
                   data-tukar="${kode}">Tukar nomor rusak…</button>`
        : "";
      // Nomor dada DIKETIK petugas, tidak diterbitkan sistem (migrasi 0011):
      // kainnya benda fisik di meja, dan yang ada di tangan petugas belum
      // tentu nomor terkecil yang tersedia. Jadi tombolnya membuka daftar
      // regu untuk diisi satu per satu, bukan langsung menarik stok.
      const terbuka = dibukaNomor.has(b.kode_pembayaran);
      const aksi = menunggu.length
        ? `<button class="button-detail" type="button"
                   data-isi="${kode}" data-jumlah="${menunggu.length}"
                   aria-expanded="${terbuka}">
             ${terbuka ? "▾" : "▸"} Isi ${menunggu.length} Nomor Dada
           </button>${nomorHtml ? `<div class="sub">${nomorHtml} ${tombolTukar}</div>` : ""}`
        : `<div class="pill-row">${nomorHtml} ${tombolTukar}</div>`;

      // Template biasa (lihat catatan sama di layar Pembayaran).
      return `
        <tr data-baris="${kode}">
          <td class="mono" data-label="Kode Bayar">${kode}</td>
          <!-- Nama-nama regu TIDAK ditampilkan di sini. Barisnya panjang dan
               memakan lebar yang dibutuhkan kolom di kanannya, padahal yang
               dicari petugas di layar ini adalah SEKOLAHNYA — nama regunya
               baru relevan saat mengisi nomor dada, dan di sana ia memang
               tampil satu per satu di rincian. Pencarian tetap mengenali
               nama regu (lihat cocokCari), jadi mengetik nama regu tetap
               menemukan sekolahnya. -->
          <td data-label="Sekolah">
            <strong>${esc(b.sekolah?.name || "—")}</strong>
          </td>
          <td data-label="">${aksi}</td>
        </tr>
        ${!menunggu.length ? "" : `
        <tr class="detail-row" data-nomor-untuk="${kode}" ${terbuka ? "" : "hidden"}>
          <td colspan="3" class="detail-cell-flush">
            <table class="detail-table detail-table-dada">
              <thead>
                <tr><th>Regu</th><th>Kategori</th><th>Ketua</th><th>Nomor dada</th></tr>
              </thead>
              <tbody>
                ${menunggu.map(r => `
                  <tr>
                    <td><strong>${esc(r.nama_regu)}</strong></td>
                    <td>${esc(GOLONGAN_LABEL[r.golongan] || r.golongan)}</td>
                    <td>${esc(r.nama_ketua)}</td>
                    <td><input type="number" class="small-input" inputmode="numeric" min="1"
                               data-dada="${esc(r.id)}" data-untuk="${kode}"
                               value="${esc(nilaiDada.get(r.id) ?? "")}"></td>
                  </tr>`).join("")}
              </tbody>
            </table>
            <div class="action-row action-row-simpan" style="margin-top:.6rem">
              <span class="sub">Nomor dada yang diinput harus SAMA dengan
                yang diberikan ke regunya. Enter = pindah ke regu berikutnya.</span>
              <button class="button button-primary button-small" type="button"
                      data-simpan-dada="${kode}">Simpan ${menunggu.length} Nomor Dada</button>
            </div>
          </td>
        </tr>`}`;
    }).join("")));

    // Nomor rusak/sobek di lapangan: nomor lama PENSIUN (tidak pernah terbit
    // ulang), supaya lembar nilai lama tidak menilai regu yang salah.
    tbody.querySelectorAll("[data-tukar]").forEach(btn =>
      btn.addEventListener("click", async () => {
        const kode = btn.dataset.tukar;
        const b = semua.find(x => x.kode_pembayaran === kode);
        const bernomor = reguAktif(b).filter(r => r.nomor_dada !== null);
        if (!bernomor.length) { notif("Sekolah ini belum punya nomor dada.", true); return; }
        const jawab = await dialog({
          judul: "Tukar nomor dada yang rusak",
          kartuHtml: `<table class="table" style="margin-bottom:.8rem">${bernomor.map(r => html`
              <tr><td class="angka">${String(r.nomor_dada).padStart(3, "0")}</td>
                  <td>${r.nama_regu}</td></tr>`).join("")}</table>`,
          medan: [
            { label: "Nomor lama (yang rusak)", tipe: "number", contoh: "17" },
            { label: "Nomor pengganti (dari stok)", tipe: "number", contoh: "250" },
            { label: "Alasan", contoh: "nomor sobek" },
          ],
          labelAksi: "Tukar nomor",
        });
        if (!jawab) return;
        const [lama, baru, alasan] = jawab;
        const regu = bernomor.find(r => r.nomor_dada === Number(lama));
        if (!regu) { notif(`Nomor ${lama} bukan milik sekolah ini.`, true); return; }
        if (!Number.isInteger(Number(baru)) || Number(baru) <= 0) {
          notif("Nomor pengganti harus angka.", true); return;
        }
        try {
          await tukarNomor(regu.id, Number(baru), alasan);
          regu.nomor_dada = Number(baru);
          catatTerakhir("daftar-ulang", kode, `tukar nomor ${lama} → ${baru}`);
          notif(`Nomor ${lama} diganti ${baru}. Nomor lama tidak dipakai lagi.`);
          gambar(cari, saring);
        } catch (err) { notif(err.message, true); }
      }));

    // Buka daftar regu untuk diisi nomornya, lalu taruh kursor di regu pertama.
    tbody.querySelectorAll("[data-isi]").forEach(btn =>
      btn.addEventListener("click", () => {
        const kode = btn.dataset.isi;
        const barisNomor = tbody.querySelector(`[data-nomor-untuk="${CSS.escape(kode)}"]`);
        const buka = barisNomor.hidden;

        // AKORDEON: hanya SATU sekolah terbuka pada satu waktu. Dua daftar
        // isian terbuka bersamaan membuat petugas mudah mengetik nomor
        // sekolah A ke baris sekolah B — kesalahan yang tidak menimbulkan
        // galat apa pun dan baru ketahuan saat klasemen keluar. Angka yang
        // sudah diketik TIDAK hilang: tersimpan di nilaiDada dan muncul lagi
        // saat sekolahnya dibuka ulang.
        if (buka) {
          tbody.querySelectorAll("[data-nomor-untuk]").forEach(lain => {
            if (lain !== barisNomor) lain.hidden = true;
          });
          tbody.querySelectorAll("[data-isi]").forEach(lainBtn => {
            if (lainBtn === btn) return;
            lainBtn.setAttribute("aria-expanded", "false");
            lainBtn.textContent = `▸ Isi ${lainBtn.dataset.jumlah} Nomor Dada`;
          });
          dibukaNomor.clear();
        }

        if (buka) dibukaNomor.add(kode); else dibukaNomor.delete(kode);
        barisNomor.hidden = !buka;
        btn.setAttribute("aria-expanded", String(buka));
        const jumlah = barisNomor.querySelectorAll("[data-dada]").length;
        btn.textContent = `${buka ? "▾" : "▸"} Isi ${jumlah} Nomor Dada`;
        // Auto-focus HANYA di layar lebar. Di HP, focus() memunculkan
        // keyboard dan menggeser halaman, sehingga ketukan berikutnya
        // meleset dari tombol ini — terasa seperti tombolnya tidak bisa
        // diklik ulang (laporan pengguna).
        if (buka && window.matchMedia("(min-width: 561px)").matches)
          barisNomor.querySelector("[data-dada]")?.focus();
      }));

    // Loop ketik-Enter (rancangan-b.md 10.1.4): Enter pindah ke regu
    // berikutnya, dan di regu terakhir langsung menyimpan — satu sekolah
    // selesai tanpa memegang mouse.
    tbody.querySelectorAll("[data-dada]").forEach(inp => {
      inp.addEventListener("input", () => nilaiDada.set(inp.dataset.dada, inp.value));
      inp.addEventListener("keydown", e => {
        if (e.key !== "Enter") return;
        e.preventDefault();
        const untuk = CSS.escape(inp.dataset.untuk);
        const sekelompok = [...tbody.querySelectorAll(`[data-dada][data-untuk="${untuk}"]`)];
        const berikut = sekelompok[sekelompok.indexOf(inp) + 1];
        if (berikut) berikut.focus();
        else tbody.querySelector(`[data-simpan-dada="${untuk}"]`)?.click();
      });
    });

    tbody.querySelectorAll("[data-simpan-dada]").forEach(btn =>
      btn.addEventListener("click", async () => {
        if (btn.dataset.jalan === "1") return;
        const kode = btn.dataset.simpanDada;
        const b = semua.find(x => x.kode_pembayaran === kode);
        const isian = [...tbody.querySelectorAll(
          `[data-dada][data-untuk="${CSS.escape(kode)}"]`)];

        // Gagal itu nyaring dan LOKAL (rancangan-b.md 10.1.11): isian yang
        // salah memerah di tempatnya, bukan cuma pesan umum di bawah layar.
        isian.forEach(i => i.classList.remove("input-error"));
        const pasangan = [];
        const dipakai = new Set();
        let keluhan = null;
        for (const inp of isian) {
          const angka = Number(inp.value.trim());
          if (!inp.value.trim() || !Number.isInteger(angka) || angka <= 0) {
            inp.classList.add("input-error");
            keluhan = keluhan || "Setiap regu harus diberi nomor dada berupa angka.";
            continue;
          }
          if (dipakai.has(angka)) {
            inp.classList.add("input-error");
            keluhan = keluhan || `Nomor ${angka} diketik untuk dua regu.`;
            continue;
          }
          dipakai.add(angka);
          pasangan.push({ regu_id: inp.dataset.dada, nomor_dada: angka });
        }
        if (keluhan) {
          notif(keluhan, true);
          isian.find(i => i.classList.contains("galat-isian"))?.focus();
          return;
        }

        btn.dataset.jalan = "1"; btn.disabled = true; btn.textContent = "Menyimpan…";
        let hasil;
        try {
          hasil = await daftarUlang(kode, pasangan);
        } catch (err) {
          notif(err.message, true);
          btn.dataset.jalan = ""; btn.disabled = false;
          btn.textContent = `Simpan ${isian.length} Nomor Dada`;
          return;
        }
        // Tempelkan nomor + kloter ke data lokal. Kloternya yang baru: itu
        // satu-satunya bagian yang masih ditentukan sistem, jadi itu yang
        // disebut di notifikasi.
        hasil.forEach(x => {
          const r = (b.regu || []).find(y => y.id === x.regu_id);
          if (r) { r.nomor_dada = x.nomor_dada; r.kloter_nomor = x.kloter; }
        });
        dibukaNomor.delete(kode);
        pasangan.forEach(p => nilaiDada.delete(p.regu_id));
        catatTerakhir("daftar-ulang", kode, hasil.map(x =>
          `${x.nama_regu} ${String(x.nomor_dada).padStart(3, "0")}`).join(", "));
        const kloter = [...new Set(hasil.map(x => x.kloter))].sort((x, y) => x - y).join(", ");
        notif(`${b.sekolah?.name || kode}: ${hasil.length} regu tersimpan — kloter ${kloter}.`);
        gambar(cari, saring);
      }));
  };

  pasangAlatTabel(gambar);
}

/* ============================ KEBERANGKATAN ============================== */

async function layarKeberangkatan() {
  if (!EDISI) { layarButuhEdisi("Keberangkatan"); return; }
  pasangKepala("Keberangkatan", true);
  LAYAR.replaceChildren(h(`<p>Memuat…</p>`));

  const layarIni = location.hash;
  let papan, opsi;
  try { [papan, opsi] = await Promise.all([papanKeberangkatan(), kontrakOpsi()]); }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarKeberangkatan)); return; }
  // Daftar sisipan pindah ke sini bersama layar Pindah Kloter yang dihapus.
  // Ia TIDAK ikut dihapus: ini satu-satunya cara petugas staging tahu ada
  // nomor yang tidak tercetak di kertasnya. Boleh gagal — daftar kloternya
  // sendiri jauh lebih penting daripada hiasan ini.
  let sisipan = [];
  try { sisipan = await daftarSisipan(); } catch { /* daftar boleh telat */ }
  if (location.hash !== layarIni) return;   // lihat catatan di layarPembayaran

  if (!papan.length) {
    LAYAR.replaceChildren(h(`
      <div class="card">
        <h2>Belum ada kloter berisi regu</h2>
        <p class="description">Kloter muncul di sini setelah ada sekolah yang
           daftar ulang dan menerima nomor dada.</p>
      </div>`));
    return;
  }

  // Kloter yang dibuka pertama: yang paling depan dan belum berangkat —
  // itulah yang sedang ditangani petugas garis start.
  let kloterAktif = (papan.find(k => !k.jam_berangkat) || papan[0]).nomor;

  LAYAR.replaceChildren(h(`
    <div class="card">
      <h2 style="font-size:1rem;color:var(--tinta-lembut)">Pilih kloter</h2>
      <div class="kloter-strip" id="pita-kloter"></div>
    </div>
    <div id="isi-kloter"></div>
  `));

  const gambarPita = () => {
    document.getElementById("pita-kloter").replaceChildren(h(papan.map(k => {
      const label = { berangkat: "berangkat", siap: "siap",
                      konfirmasi_kontrak: "kontrak", menunggu: "menunggu" }[k.posisi] || "";
      return html`
        <button type="button" class="kloter-chip ${k.posisi}"
                data-kloter="${k.nomor}" aria-pressed="${k.nomor === kloterAktif}">
          <span class="chip-nomor">Kloter ${k.nomor}</span>
          <span class="chip-ket">${k.sudah_ceklis}/${k.jumlah_regu} · ${label}</span>
        </button>`;
    }).join("")));

    document.querySelectorAll("[data-kloter]").forEach(b =>
      b.addEventListener("click", () => {
        kloterAktif = Number(b.dataset.kloter);
        gambarPita();
        gambarKloter();
      }));
  };

  async function gambarKloter() {
    const kotak = document.getElementById("isi-kloter");
    kotak.replaceChildren(h(`<p>Memuat kloter ${kloterAktif}…</p>`));

    let regu;
    try { regu = await reguKloter(kloterAktif); }
    catch (e) { kotak.replaceChildren(kartuGagalMuat(e.message, gambarKloter)); return; }

    const info = papan.find(k => k.nomor === kloterAktif) || {};
    const sudahBerangkat = !!info.jam_berangkat;
    // Tujuan pindah = semua kloter lain, TERMASUK yang sudah berangkat.
    // Regu telat yang berlari menyusul kloter berikutnya memang berangkat
    // bersama kloter itu, pada jam kloter itu — menyembunyikannya memaksa
    // petugas mencatat kloter yang tidak ia jalani (migrasi 0018).
    const tujuanPindah = papan.filter(k => k.nomor !== kloterAktif);
    const belumKontrak = regu.filter(r => r.sudah_ceklis && r.kontrak_menit === null);

    kotak.replaceChildren(h(`
      ${kartuSisipan(sisipan.filter(s => s.kloter === kloterAktif))}
      <div class="card">
        <div class="kloter-header">
          <h2>Kloter ${kloterAktif}</h2>
          ${sudahBerangkat
            ? html`<span class="badge badge-green">BERANGKAT ${jamMenit(info.jam_berangkat)}</span>
                   <button class="icon-button icon-button-inline" id="koreksi-jam" type="button"
                           title="Betulkan jam berangkat"
                           aria-label="Betulkan jam berangkat Kloter ${kloterAktif}">&#9998;</button>`
            : `<span class="badge badge-yellow">BELUM BERANGKAT</span>`}
        </div>

        <div class="table-wrapper table-wrapper-tetap" style="margin-top:.6rem">
          <table class="table data-table table-tetap">
            <thead>
              <tr>
                <th class="text-center">Hadir</th><th>Nomor Dada</th><th>Regu</th>
                <th>Kontrak waktu</th><th>Pindah kloter</th>
              </tr>
            </thead>
            <tbody>
              ${regu.map(r => `
                <tr>
                  <td class="text-center">
                    <input type="checkbox" class="checkbox" data-ceklis="${esc(r.nomor_dada)}"
                           ${r.sudah_ceklis ? "checked" : ""}
                           aria-label="ceklis regu ${esc(r.nomor_dada)}">
                  </td>
                  <td class="angka">${String(r.nomor_dada).padStart(3, "0")}</td>
                  <td>
                    <strong>${esc(r.nama_regu)}</strong>
                    <div class="sub">${esc(r.nama_sekolah)}${r.sisipan ? " · SISIPAN" : ""}</div>
                  </td>
                  <td>
                    <select class="select-small" data-kontrak="${esc(r.regu_id)}"
                            ${r.sudah_ceklis ? "disabled" : ""}>
                      <option value="">Belum dipilih</option>
                      ${opsi.map(o => `<option value="${esc(o.menit)}"
                        ${r.kontrak_menit === o.menit ? "selected" : ""}>${esc(o.label)}</option>`).join("")}
                    </select>
                  </td>
                  <td>
                    <select class="select-small" data-pindah="${esc(r.nomor_dada)}"
                            ${r.sudah_ceklis || !tujuanPindah.length ? "disabled" : ""}
                            aria-label="pindahkan regu ${esc(r.nomor_dada)} ke kloter lain">
                      <option value="">—</option>
                      ${tujuanPindah.map(k => `<option value="${esc(k.nomor)}">Kloter ${esc(k.nomor)}${
                        k.jam_berangkat ? " (sudah berangkat)" : ""}</option>`).join("")}
                    </select>
                  </td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>

        <!-- Dibungkus supaya isinya bisa dihitung ulang tanpa menggambar
             ulang seluruh tabel — lihat perbaruiPeringatanKontrak(). -->
        <div id="peringatan-kontrak">${!belumKontrak.length ? "" : kartuGalat(
          `${belumKontrak.length} regu sudah diceklis tapi belum punya kontrak waktu — ` +
          `pilih kontraknya dulu, kalau tidak keberangkatan akan ditolak.`)}</div>

        ${sudahBerangkat ? "" : `
          <div class="departure-bar">
            <div class="field" style="margin:0">
              <label for="jam-berangkat">Jam berangkat (diketik pencatat)</label>
              <input type="time" id="jam-berangkat" step="60" value="${jamMenit(new Date())}">
            </div>
            <button class="button button-primary" id="aksi-berangkat" type="button">
              🚩 Berangkatkan Kloter ${kloterAktif}
            </button>
          </div>
        `}
      </div>
    `));

    /** Hitung ulang peringatan "sudah diceklis tapi belum punya kontrak"
     *  dari KEADAAN LAYAR, bukan dari data yang diambil saat tabel digambar.
     *  Ceklis dan kontrak waktu diubah tanpa menggambar ulang tabel (sengaja
     *  — menggambar ulang tiap centang membuat petugas kehilangan tempatnya
     *  saat mencentang belasan regu berturut-turut), jadi peringatan yang
     *  dihitung sekali di awal langsung basi: ia sempat tetap menuduh ada
     *  regu tanpa kontrak padahal kontraknya baru saja dipilih. */
    const perbaruiPeringatanKontrak = () => {
      const wadah = document.getElementById("peringatan-kontrak");
      if (!wadah) return;
      const kurang = [...kotak.querySelectorAll("[data-ceklis]")].filter(cb =>
        cb.checked && !cb.closest("tr")?.querySelector("[data-kontrak]")?.value);
      wadah.replaceChildren(...(kurang.length
        ? [h(kartuGalat(
            `${kurang.length} regu sudah diceklis tapi belum punya kontrak waktu — ` +
            `pilih kontraknya dulu, kalau tidak keberangkatan akan ditolak.`))]
        : []));
    };

    kotak.querySelectorAll("[data-ceklis]").forEach(cb => {
      // Klik beruntun diantrekan, TIDAK diblokir: petugas yang salah centang
      // langsung membatalkannya, dan kotak yang menolak klik kedua membuat
      // koreksi itu mustahil. Antrean menjaga urutannya tetap benar.
      let antre = Promise.resolve();
      cb.addEventListener("change", () => {
        const dada = Number(cb.dataset.ceklis);
        const mau = cb.checked;
        cb.classList.add("saving");
        antre = antre.then(async () => {
          try {
            if (mau) await ceklisBerangkat(dada);
            else await batalCeklisBerangkat(dada);
            // Redup dilepas begitu tulisannya masuk. Papan menyusul di bawah:
            // menunggunya membuat centang terasa lambat sedetik padahal
            // datanya sudah tersimpan.
            cb.classList.remove("saving");
            // Dua dropdown di baris yang sama dikunci selama regunya
            // terceklis, dan status terkunci itu ditulis saat tabel
            // digambar. Sesudah ini yang digambar ulang hanya pita kloter di
            // atas, bukan barisnya — jadi tanpa baris ini kuncinya tertinggal
            // di keadaan lama: petugas membatalkan ceklis, lalu mendapati
            // kontrak waktu masih tidak bisa dipilih sampai layar dimuat
            // ulang. Persis keluhan di lapangan.
            const baris = cb.closest("tr");
            const kontrak = baris?.querySelector("[data-kontrak]");
            if (kontrak) kontrak.disabled = mau;
            const pindah = baris?.querySelector("[data-pindah]");
            // Pindah kloter punya syarat KEDUA: harus ada kloter tujuan.
            // Kalau tidak ada, isinya cuma "—" dan ia tetap terkunci.
            if (pindah) pindah.disabled = mau || pindah.options.length <= 1;
            perbaruiPeringatanKontrak();
            papan = await papanKeberangkatan();
            gambarPita();
          } catch (err) {
            notif(err.message, true);
            cb.checked = !mau;
            cb.classList.remove("saving");
          }
        });
      });
    });

    kotak.querySelectorAll("[data-kontrak]").forEach(sel =>
      sel.addEventListener("change", async () => {
        if (!sel.value) return;
        sel.disabled = true;
        try {
          await konfirmasiKontrak(sel.dataset.kontrak, Number(sel.value));
          sel.classList.add("saved");
          setTimeout(() => sel.classList.remove("saved"), 1200);
        } catch (err) {
          notif(err.message, true);
        }
        sel.disabled = false;
        perbaruiPeringatanKontrak();
      }));

    kotak.querySelectorAll("[data-pindah]").forEach(sel =>
      sel.addEventListener("change", async () => {
        const tujuan = Number(sel.value);
        if (!tujuan) return;
        const dada = Number(sel.dataset.pindah);
        const jawab = await dialog({
          judul: `Pindahkan nomor ${String(dada).padStart(3, "0")} ke Kloter ${tujuan}?`,
          kartuHtml: html`<div class="card card-identity" style="margin-bottom:.8rem">
            <div class="nama">Dari Kloter ${kloterAktif} ke Kloter ${tujuan}</div>
            <div class="detail">${papan.find(k => k.nomor === tujuan)?.jam_berangkat
              ? `Kloter ${tujuan} sudah berangkat — regu ini akan dinilai dari jam berangkat kloter itu.`
              : "Kapasitas kloter tujuan tetap dijaga sistem."}</div>
          </div>`,
          medan: [{ label: "Alasan pemindahan", contoh: "terlambat masuk kloter",
                    bantuan: "Wajib diisi — tercatat di riwayat." }],
          labelAksi: "Pindahkan",
        });
        // Batal (atau gagal) mengembalikan select ke "—", kalau tidak ia
        // menampilkan kloter tujuan seolah pemindahan sudah terjadi.
        if (!jawab) { sel.value = ""; return; }
        sel.disabled = true;
        let hasil;
        try {
          hasil = await pindahKloter(dada, jawab[0], tujuan);
        } catch (err) {
          notif(err.message, true);
          sel.value = ""; sel.disabled = false;
          return;
        }
        papan = await papanKeberangkatan();
        gambarPita();
        gambarKloter();
        // Peringatan sisipan TIDAK boleh berupa toast yang hilang sendiri:
        // petugas staging memegang kertas yang tidak memuat nomor ini.
        if (hasil.peringatan) {
          kotak.prepend(h(html`
            <div class="card" style="border:3px solid var(--bahaya);background:var(--bahaya-muda)">
              <h2 style="color:var(--bahaya)">⚠️ Bacakan ke petugas staging</h2>
              <p style="font-size:1.1rem;margin-top:.4rem">${hasil.peringatan}</p>
            </div>`));
        } else {
          notif(`Nomor ${dada} pindah dari Kloter ${hasil.kloter_lama} ke Kloter ${hasil.kloter_baru}.`);
        }
      }));

    // Membetulkan jam yang sudah tercatat. Jam berangkat menentukan penalti
    // SELURUH regu di kloter ini, dan salah ketik tidak menimbulkan galat apa
    // pun — ia hanya muncul sebagai nilai yang salah saat klasemen keluar.
    // Karena itu koreksinya minta alasan dan tercatat di history.
    const tombolKoreksi = document.getElementById("koreksi-jam");
    if (tombolKoreksi) tombolKoreksi.addEventListener("click", async () => {
      // Jam kloter tetangga ditampilkan, BUKAN dipaksakan. Fungsi database
      // sengaja tidak menolak jam yang melanggar urutan (kalau menolak, dua
      // kloter yang jamnya sama-sama salah saling mengunci). Yang menangkap
      // salah ketik di sini adalah mata pencatat, jadi angka pembandingnya
      // ditaruh di depan mata.
      const sebelum = papan.filter(k => k.nomor < kloterAktif && k.jam_berangkat).pop();
      const sesudah = papan.find(k => k.nomor > kloterAktif && k.jam_berangkat);
      const tetangga = [
        sebelum && `Kloter ${sebelum.nomor} berangkat ${jamMenit(sebelum.jam_berangkat)}`,
        sesudah && `Kloter ${sesudah.nomor} berangkat ${jamMenit(sesudah.jam_berangkat)}`,
      ].filter(Boolean).join(" · ");

      const jawab = await dialog({
        judul: `Betulkan jam berangkat Kloter ${kloterAktif}`,
        kartuHtml: html`<div class="card card-identity" style="margin-bottom:.8rem">
          <div class="nama">Sekarang tercatat ${jamMenit(info.jam_berangkat)}</div>
          <div class="detail">Mengubah jam ini menghitung ulang penalti waktu
            seluruh regu di Kloter ${kloterAktif}.${tetangga ? ` ${tetangga}.` : ""}</div>
        </div>`,
        medan: [
          { label: "Jam berangkat yang benar", tipe: "time",
            nilai: jamMenit(info.jam_berangkat) },
          { label: "Alasan koreksi", contoh: "salah ketik, seharusnya 07.40" },
        ],
        labelAksi: "Simpan Koreksi",
      });
      if (!jawab) return;
      const [hhmm, alasan] = jawab;
      try {
        await koreksiJamBerangkat(kloterAktif, jamHariIni(hhmm).toISOString(), alasan);
      } catch (err) { notif(err.message, true); return; }
      notif(`Jam berangkat Kloter ${kloterAktif} dibetulkan jadi ${hhmm}.`);
      papan = await papanKeberangkatan();
      gambarPita();
      gambarKloter();
    });

    const tombol = document.getElementById("aksi-berangkat");
    if (tombol) tombol.addEventListener("click", async () => {
      if (tombol.dataset.jalan === "1") return;
      const hhmm = document.getElementById("jam-berangkat").value;
      if (!hhmm) { notif("Jam berangkat wajib diisi.", true); return; }
      tombol.dataset.jalan = "1"; tombol.disabled = true; tombol.textContent = "Menyimpan…";
      try {
        await berangkatkanKloter(kloterAktif, jamHariIni(hhmm).toISOString());
      } catch (err) {
        notif(err.message, true);
        tombol.dataset.jalan = ""; tombol.disabled = false;
        tombol.textContent = `🚩 Berangkatkan Kloter ${kloterAktif}`;
        return;
      }
      notif(`Kloter ${kloterAktif} berangkat ${hhmm}.`);
      papan = await papanKeberangkatan();
      gambarPita();
      gambarKloter();
    });
  }

  gambarPita();
  gambarKloter();
}

/* ============================ CETAK DAFTAR KLOTER ======================== */

async function layarCetakKloter() {
  pasangKepala("Cetak Daftar Kloter");
  LAYAR.replaceChildren(h(`<p>Memuat…</p>`));

  let baris;
  try { baris = await daftarKloter(); }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarCetakKloter)); return; }

  if (!baris.length) {
    LAYAR.replaceChildren(h(`<div class="card">
      <h2>Belum ada regu berkloter</h2>
      <p class="description">Daftar kloter bisa dicetak setelah ada sekolah yang daftar ulang.</p>
    </div>`));
    return;
  }

  // Kelompokkan per kloter. Dipakai ulang tiap kali tombol cetak ditekan,
  // karena datanya diambil segar saat itu juga.
  const kelompokkan = (rows) => {
    const peta = new Map();
    for (const b of rows) {
      if (!peta.has(b.kloter)) peta.set(b.kloter, { dicetak: b.dicetak_pada, isi: [] });
      peta.get(b.kloter).isi.push(b);
    }
    return peta;
  };

  let perKloter = kelompokkan(baris);
  const belum = [...perKloter.entries()].filter(([, v]) => !v.dicetak).length;

  LAYAR.replaceChildren(h(`
    <div class="card" style="border-color:var(--utama)">
      <h2>Daftar kloter untuk garis start</h2>
      <p class="description">Setelah dicetak, isi kloter <strong>dibekukan</strong> —
         kertas ini yang dipakai memanggil regu, jadi sistem tidak boleh
         mengubahnya diam-diam. Sekolah yang daftar ulang setelah ini masuk
         kloter cadangan dan dicetak sebagai lembar tambahan.</p>
      <table class="table" style="margin-top:.6rem">
        <tr><td>Kloter berisi regu</td><td class="angka">${perKloter.size}</td></tr>
        <tr><td>Belum pernah dicetak</td><td class="angka">${belum}</td></tr>
        <tr><td>Total regu</td><td class="angka">${baris.length}</td></tr>
      </table>
      <div class="option-row" style="margin-top:.9rem">
        <button class="button button-primary" id="cetak-petugas" type="button">
          🖨️ Cetak Kloter untuk Petugas
        </button>
        <button class="button button-primary" id="cetak-peserta" type="button">
          🖨️ Cetak Kloter untuk Peserta
        </button>
      </div>
    </div>
    <div id="pratayang"></div>
  `));

  const gambarPratayang = (peta) => {
    // CATATAN: baris tabel dirakit dengan html`` (nilai di-escape), lalu
    // digabung memakai template BIASA. Menyisipkan HTML jadi ke dalam html``
    // akan meng-escape-nya dua kali dan tabelnya tampil sebagai teks mentah.
    document.getElementById("pratayang").replaceChildren(h(
      [...peta.entries()].map(([nomor, v]) => {
        const baris = v.isi.map(r => html`
          <tr><td class="angka">${String(r.nomor_dada).padStart(3, "0")}</td>
              <td><strong>${r.nama_regu}</strong></td>
              <td>${r.nama_sekolah}</td>
              <td>${GOLONGAN_LABEL[r.golongan] || r.golongan}</td></tr>`).join("");
        return `
          <div class="card">
            <h2>Kloter ${esc(nomor)}
              <span class="badge ${v.dicetak ? "badge-gray" : "badge-yellow"}">
                ${v.dicetak ? "sudah dicetak" : "baru"}</span></h2>
            <table class="table">${baris}</table>
          </div>`;
      }).join("")));
  };

  /** Cetak SEMUA kloter dalam satu bentuk kertas.
   *  Datanya diambil ulang tepat sebelum mencetak: layar ini sering dibiarkan
   *  terbuka sementara meja daftar ulang terus jalan, dan kertas yang keluar
   *  tanpa regu yang baru masuk adalah kertas yang salah — petugas garis start
   *  memanggil dari kertas itu, bukan dari layar. */
  async function cetak(bentuk) {
    let segar;
    try { segar = await daftarKloter(); }
    catch (err) { notif(err.message, true); return; }

    perKloter = kelompokkan(segar);
    gambarPratayang(perKloter);
    siapkanCetakKloter([...perKloter.entries()], bentuk);
    window.print();

    // Ditandai SETELAH dialog cetak ditutup — kalau operator membatalkan,
    // kloternya belum dianggap tercetak.
    const lanjut = confirm([
      "Kertasnya sudah keluar dengan benar?",
      "",
      "OK  = tandai kloter ini sudah dicetak (isinya dibekukan)",
      "Batal = belum, biarkan bisa dicetak lagi",
    ].join("\n"));
    if (!lanjut) return;
    try {
      const n = await tandaiKloterDicetak(null);
      notif(`${n} kloter ditandai sudah dicetak dan dibekukan.`);
      layarCetakKloter();
    } catch (err) { notif(err.message, true); }
  }

  document.getElementById("cetak-petugas").addEventListener("click", () => cetak("staging"));
  document.getElementById("cetak-peserta").addEventListener("click", () => cetak("umum"));
  gambarPratayang(perKloter);
}

/** Blok cetak daftar kloter — satu kloter per halaman kertas.
 *  Dua pembaca, dua bentuk (panitia menyebutkan keduanya):
 *   - 'staging' : dipegang petugas staging, ada kolom centang kehadiran dan
 *                 tempat menulis jam berangkat sebenarnya.
 *   - 'umum'    : ditempel di papan pengumuman & dibagikan ke barak, dibaca
 *                 peserta — perkiraan berangkat dibesarkan, kolom centang
 *                 dihilangkan karena tidak ada gunanya bagi peserta.
 */
function siapkanCetakKloter(dipakai, bentuk = "staging") {
  document.getElementById("cetakan")?.remove();

  const halaman = dipakai.map(([nomor, v]) => {
    const contoh = v.isi[0] || {};
    const perkiraan = jamMenit(contoh.perkiraan_berangkat);
    const nyata = contoh.sudah_berangkat;

    const baris = v.isi.map(r => bentuk === "staging"
      ? html`
        <tr><td class="dada">${String(r.nomor_dada).padStart(3, "0")}</td>
            <td>${r.nama_regu}${r.sisipan ? " ★" : ""}</td>
            <td>${r.nama_sekolah}</td>
            <td>${GOLONGAN_LABEL[r.golongan] || r.golongan}</td>
            <td class="kotak"></td></tr>`
      : html`
        <tr><td class="dada">${String(r.nomor_dada).padStart(3, "0")}</td>
            <td>${r.nama_regu}</td>
            <td>${r.nama_sekolah}</td>
            <td>${GOLONGAN_LABEL[r.golongan] || r.golongan}</td></tr>`).join("");

    const adaSisipan = v.isi.some(r => r.sisipan);

    return bentuk === "staging" ? `
      <section class="print-page">
        <h1>KLOTER ${esc(nomor)} — ${esc(EDISI ? EDISI.name : "")}</h1>
        <p><strong>${nyata ? "Berangkat" : "Perkiraan berangkat"}: ${esc(perkiraan)}</strong>
           ${nyata ? "" : " · Jam sebenarnya: ________"} · Petugas: ________________</p>
        <table class="print-table">
          <thead><tr><th>No Dada</th><th>Nama Regu</th><th>Sekolah</th><th>Golongan</th><th>Hadir</th></tr></thead>
          <tbody>${baris}</tbody>
        </table>
        ${adaSisipan ? `<p class="insert-note">★ = regu sisipan, ditambahkan setelah kertas ini dicetak.</p>` : ""}
        <p class="print-note">Centang kolom Hadir saat regu masuk staging.
           Kloter berangkat setelah semua tercentang atau diputuskan panitia.</p>
      </section>` : `
      <section class="print-page">
        <h1>KLOTER ${esc(nomor)}</h1>
        <p class="jam-besar">${nyata ? "Berangkat" : "Perkiraan berangkat"}: ${esc(perkiraan)}</p>
        <table class="print-table">
          <thead><tr><th>No Dada</th><th>Nama Regu</th><th>Sekolah</th><th>Golongan</th></tr></thead>
          <tbody>${baris}</tbody>
        </table>
        <p class="print-note">Bersiap di staging paling lambat 15 menit sebelum
           perkiraan berangkat.<br>
           Jam sebenarnya bisa bergeser, ikuti panggilan petugas.</p>
      </section>`;
  }).join("");
  document.body.appendChild(h(`<div id="cetakan" class="printout">${halaman}</div>`));
}

/* ============================ MEJA FINISH ================================ */

/** Target panitia: DUA aksi, ±3 detik per regu — "ketik nomor, klik Sampai".
 *  Karena itu TIDAK ADA tombol Cari: detail regu muncul sendiri sambil
 *  mengetik, dan Enter sama dengan menekan tombol. Echo-confirm tetap ada
 *  karena kartu identitas sudah terpampang saat operator menekan.
 *
 *  Jam yang tersimpan adalah jam saat TOMBOL DITEKAN di laptop panitia —
 *  bukan cap waktu server saat data sampai (alur 10.2). Untuk pencatatan
 *  susulan dari kertas, jamnya bisa diubah.
 */
function layarFinish() {
  pasangKepala("Kedatangan");
  LAYAR.replaceChildren(h(`
    <div class="card" style="border-color:var(--utama)">
      <div class="field" style="margin-bottom:0">
        <label for="dada">Ketik nomor dada</label>
        <input type="text" id="dada" class="besar" inputmode="numeric"
               autocomplete="off" placeholder="001">
      </div>
      <div id="kartu-regu" style="margin-top:.7rem"></div>
      <button class="button button-primary" id="sampai" type="button" disabled
              style="margin-top:.7rem;min-height:60px;font-size:1.2rem">
        ✅ SAMPAI DI FINISH
      </button>
      <!-- TOMBOL adalah pencatat utama di meja ini; kertas panitia hanya untuk
           cek silang. Jadi jam & anggota sengaja TIDAK sejajar dengan tombol —
           keduanya dipakai saat memperbaiki hasil verifikasi, bukan tiap regu. -->
      <details style="margin-top:.6rem">
        <summary style="cursor:pointer;min-height:40px;font-size:.9rem;color:var(--tinta-lembut)">
          Perbaiki jam atau jumlah anggota
        </summary>
        <div class="two-column" style="margin-top:.5rem">
          <div class="field" style="margin:0">
            <label for="jam">Jam datang</label>
            <input type="time" id="jam" step="60">
            <div class="hint">Kosong = jam saat tombol ditekan.</div>
          </div>
          <div class="field" style="margin:0">
            <label for="hadir">Anggota hadir</label>
            <input type="number" id="hadir" min="0" max="5" inputmode="numeric" value="5">
            <div class="hint">Tiap orang kurang: −20 poin.</div>
          </div>
        </div>
        <div id="dampak-jam" style="margin-top:.5rem"></div>
        <p class="hint">Beda semenit dua menit antara catatan kertas dan tombol
           itu wajar — penalti dibulatkan per 10 menit, jadi biasanya tidak
           mengubah apa pun. Yang perlu diperhatikan hanya kalau kotak di atas
           berwarna kuning.</p>
      </details>
    </div>
    <div id="riwayat-finish"></div>
  `));

  const inp = document.getElementById("dada");
  const kotak = document.getElementById("kartu-regu");
  const tombol = document.getElementById("sampai");
  const inpJam = document.getElementById("jam");
  const inpHadir = document.getElementById("hadir");
  let regu = null;
  let jeda = null;

  inp.focus();
  gambarRiwayat();

  [inpJam, inpHadir].forEach(el => el.addEventListener("keydown", e => {
    if (e.key === "Enter" && !tombol.disabled) { e.preventDefault(); tombol.click(); }
  }));

  // Angka penalti dipakai untuk menjawab pertanyaan yang sebenarnya saat
  // membandingkan catatan kertas dengan jam tombol: bukan "beda berapa menit",
  // melainkan "apakah bedanya MENGUBAH penalti". Karena penalti dibulatkan per
  // 10 menit, selisih semenit dua menit hampir selalu tidak berpengaruh.
  let PENALTI = null;
  infoPenalti().then(p => { PENALTI = p; }).catch(() => {});

  const hitungPenalti = (jam, target) => {
    if (!PENALTI || !target) return null;
    const selisih = Math.abs(new Date(jam) - new Date(target)) / 60000;
    return Math.floor(selisih / PENALTI.blok_menit) * Number(PENALTI.penalti_per_blok);
  };

  const perbaruiDampak = () => {
    const el = document.getElementById("dampak-jam");
    if (!el) return;
    if (!regu || !regu.target_datang || !PENALTI) { el.replaceChildren(); return; }
    // Pembandingnya beda menurut keadaan: regu yang BELUM tercatat dibandingkan
    // dengan jam tombol sekarang; yang SUDAH tercatat dibandingkan dengan jam
    // yang tersimpan — itulah angka yang sedang diverifikasi terhadap kertas.
    const dasar = regu.sudah_finish && regu.jam_datang
      ? new Date(regu.jam_datang) : new Date();
    const jamIsi = inpJam.value ? jamHariIni(inpJam.value) : dasar;
    const pDasar = hitungPenalti(dasar, regu.target_datang);
    const pIsi = hitungPenalti(jamIsi, regu.target_datang);
    const tulis = (n) => n === 0 ? "0" : `−${n}`;

    if (!inpJam.value) {
      el.innerHTML = html`<span class="badge badge-gray">Penalti waktu: ${tulis(pDasar)}</span>`;
      return;
    }
    const beda = Math.round((jamIsi - dasar) / 60000);
    if (beda === 0) {
      el.innerHTML = html`<span class="badge badge-green">Sama dengan catatan — penalti ${tulis(pIsi)}</span>`;
      return;
    }
    const arah = beda > 0 ? `${beda} menit lebih lambat` : `${-beda} menit lebih awal`;
    el.innerHTML = pIsi === pDasar
      ? html`<span class="badge badge-green">${arah} — penalti tetap ${tulis(pIsi)}</span>`
      : html`<span class="badge badge-yellow">${arah} — penalti berubah ${tulis(pDasar)} → ${tulis(pIsi)}</span>`;
  };
  inpJam.addEventListener("input", perbaruiDampak);

  const bersihkan = () => {
    regu = null;
    kotak.replaceChildren();
    tombol.disabled = true;
    // Jam & anggota TIDAK dikosongkan di sini: saat menyalin sederet catatan
    // kertas, operator sering mengetik jam lalu baru memperbaiki nomornya.
  };

  // Lookup otomatis sambil mengetik — jeda pendek supaya tidak memanggil
  // server di tiap ketukan, tapi tetap terasa seketika.
  inp.addEventListener("input", () => {
    clearTimeout(jeda);
    const dada = Number(inp.value.trim());
    // PENTING: begitu angkanya berubah, hasil lookup lama tidak boleh dipakai
    // lagi. Tanpa ini, operator yang mengetik nomor baru lalu langsung menekan
    // Enter akan menyimpan regu SEBELUMNYA — mencatat regu yang salah datang.
    // (Ditemukan saat menguji alur ketik-Enter.)
    if (!regu || regu.nomor_dada !== dada) {
      regu = null;
      tombol.disabled = true;
    }
    if (!dada) { bersihkan(); return; }
    jeda = setTimeout(() => cariDanTampilkan(dada), 160);
  });

  inp.addEventListener("keydown", e => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (!tombol.disabled) tombol.click();
  });

  async function cariDanTampilkan(dada) {
    let r;
    try { r = await cariRegu(dada); }
    catch (e) { kotak.replaceChildren(h(kartuGalat(e.message))); return; }
    if (Number(inp.value.trim()) !== dada) return;   // operator sudah mengetik lagi

    if (!r) {
      regu = null; tombol.disabled = true;
      kotak.replaceChildren(h(kartuGalat(`Nomor ${esc(dada)} tidak dikenal.`)));
      return;
    }
    regu = r;

    // Keadaan yang menghalangi, ditampilkan jelas alih-alih jadi galat nanti.
    let halangan = null;
    if (!r.sudah_berangkat) halangan = `Kloter ${r.kloter} belum tercatat berangkat.`;
    else if (!r.sudah_ceklis) halangan = "Regu ini belum diceklis berangkat di staging.";

    kotak.replaceChildren(h(`
      ${kartuReguFinish(r)}
      ${r.sudah_finish ? `<div class="card" style="border-color:var(--kuning);background:var(--kuning-muda);margin-top:.5rem">
          <strong>Sudah tercatat datang ${esc(jamMenit(r.jam_datang))}.</strong>
          <div class="description">Menekan tombol akan MENGGANTI jam itu.</div>
        </div>` : ""}
      ${halangan ? kartuGalat(halangan) : ""}
    `));

    tombol.disabled = !!halangan;
    tombol.textContent = r.sudah_finish ? "✏️ PERBAIKI JAM DATANG" : "✅ SAMPAI DI FINISH";

    // Dua hal yang jarang dipakai disembunyikan supaya jalur cepat tetap dua
    // aksi: jumlah anggota (default 5) dan jam susulan dari kertas.
    // Regu yang sudah tercatat: tampilkan jam lamanya di kolom perbaikan,
    // supaya verifikasi terhadap kertas tinggal membandingkan lalu mengubah.
    if (r.sudah_finish && r.jam_datang) {
      inpJam.value = jamMenit(r.jam_datang);
      inpHadir.value = r.anggota_hadir ?? 5;
    }
    perbaruiDampak();
  }

  tombol.addEventListener("click", async () => {
    if (!regu || tombol.dataset.jalan === "1") return;
    // Jaring kedua: yang disimpan HARUS regu yang nomornya sedang terlihat di
    // kotak isian, bukan sisa lookup sebelumnya.
    if (regu.nomor_dada !== Number(inp.value.trim())) {
      notif("Nomor berubah — tunggu detailnya muncul dulu.", true);
      return;
    }
    tombol.dataset.jalan = "1"; tombol.disabled = true;

    // Jam dikunci DI SINI — saat tombol ditekan, dari jam laptop panitia.
    // Kolom jam hanya dipakai bila memang diisi (koreksi hasil verifikasi).
    const jam = inpJam.value ? jamHariIni(inpJam.value) : new Date();
    const hadir = Math.max(0, Math.min(5, Number(inpHadir.value) || 0));
    const dada = regu.nomor_dada;
    const nama = regu.nama_regu;
    try {
      await catatFinish(dada, jam.toISOString(), hadir, null);
    } catch (err) {
      notif(err.message, true);
      tombol.dataset.jalan = ""; tombol.disabled = false;
      return;
    }
    catatTerakhir("finish", String(dada).padStart(3, "0"),
      `${nama} — ${jamMenit(jam)}${hadir < 5 ? ` · ${hadir} anggota` : ""}`);
    tombol.dataset.jalan = "";
    inp.value = ""; inpJam.value = ""; inpHadir.value = "5";
    bersihkan(); inp.focus();
    gambarRiwayat();
    notif(`${String(dada).padStart(3, "0")} tercatat ${jamMenit(jam)}.`);
  });

  function gambarRiwayat() {
    const daftar = terakhir.finish || [];
    document.getElementById("riwayat-finish").replaceChildren(h(
      daftar.length ? `
        <div class="card">
          <h2 style="font-size:1rem;color:var(--tinta-lembut)">
            Baru saja tercatat (${daftar.length})</h2>
          <table class="table">${daftar.slice(0, 12).map(b => html`
            <tr><td class="angka">${b.apa}</td><td>${b.detail}</td></tr>`).join("")}
          </table>
        </div>` : `<p class="description" style="text-align:center;margin-top:1rem">
            Ketik nomor dada regu yang baru sampai.</p>`));
  }
}

/** "14:35" -> Date hari ini pada jam itu (untuk pencatatan susulan). */
function jamHariIni(hhmm) {
  const [j, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(j, m, 0, 0);
  return d;
}

function kartuReguFinish(r) {
  const selisih = r.target_datang
    ? Math.round((Date.now() - new Date(r.target_datang).getTime()) / 60000)
    : null;
  const tandaWaktu = selisih === null ? ""
    : `<span class="badge ${Math.abs(selisih) < 10 ? "badge-green" : "badge-yellow"}">
         ${selisih > 0 ? `+${selisih}` : selisih} menit dari target</span>`;
  return `
    <div class="card card-identity" style="margin:0">
      ${html`<div class="nama">${String(r.nomor_dada).padStart(3, "0")} · ${r.nama_regu}</div>
      <div class="detail">${r.nama_sekolah} · ${GOLONGAN_LABEL[r.golongan] || r.golongan}</div>
      <div class="detail">Kloter ${r.kloter} · berangkat ${jamMenit(r.jam_berangkat)}${
        r.target_datang ? ` · target ${jamMenit(r.target_datang)}` : ""}</div>`}
      <div style="margin-top:.4rem">${tandaWaktu}
        ${r.sisipan ? `<span class="badge badge-red">sisipan</span>` : ""}</div>
    </div>`;
}

/* ============================ INPUT POS ================================== */

/** Pos yang sedang dibuka admin. Operator pos tidak memakainya — posnya
 *  melekat di akun dan tidak bisa dipindah dari layar. */
const posDipilih = { nomor: null };

const judulPos = (p) => p
  ? (p.bayangan ? `Pos Bayangan — ${p.name}` : `Pos ${p.nomor} — ${p.name}`)
  : "Pos";

/** Angka dari database datang sebagai teks ("6.00"). Yang muncul di kotak
 *  isian harus persis seperti yang diketik petugas: 6, bukan 6.00. */
const angkaRapi = (v) =>
  v === null || v === undefined || v === "" ? "" : String(Number(v));

/** Kotak isian satu komponen. BENTUKNYA DITENTUKAN KONFIGURASI, bukan ditulis
 *  per pos di sini — itu sebabnya tabel ini bisa mengikuti lembar mana pun
 *  tanpa menyentuh JavaScript:
 *
 *    form=biner        -> satu centang        (kolom "Kompas (v)")
 *    satuan=detik      -> Menit : Detik       (kolom "Menit | Detik" di Pos 4)
 *    benar_kurang_salah-> Benar / Salah
 *    sisanya           -> satu kotak angka, batasnya dari rentang wajar
 */
function selKomponen(k, nilai) {
  const n1 = nilai ? nilai.nilai_1 : null;
  const n2 = nilai ? nilai.nilai_2 : null;
  const kode = esc(k.kode);

  if (k.form === "biner") {
    return `<input type="checkbox" class="checkbox" data-kode="${kode}"
                   ${Number(n1) > 0 ? "checked" : ""}
                   aria-label="${esc(k.name)}">`;
  }
  if (k.satuan === "detik") {
    const total = n1 === null || n1 === undefined ? null : Number(n1);
    return `<span class="pos-pasangan">
      <input type="number" class="small-input" inputmode="numeric" min="0"
             data-kode="${kode}" data-slot="menit"
             value="${total === null ? "" : Math.floor(total / 60)}"
             aria-label="${esc(k.name)} — menit">
      <span class="pos-pemisah" aria-hidden="true">:</span>
      <input type="number" class="small-input" inputmode="numeric" min="0" max="59"
             data-kode="${kode}" data-slot="detik"
             value="${total === null ? "" : total % 60}"
             aria-label="${esc(k.name)} — detik">
    </span>`;
  }
  if (k.form === "benar_kurang_salah") {
    return `<span class="pos-pasangan">
      <input type="number" class="small-input" inputmode="numeric" min="0"
             data-kode="${kode}" data-slot="benar" value="${esc(angkaRapi(n1))}"
             aria-label="${esc(k.name)} — jumlah benar">
      <span class="pos-pemisah" aria-hidden="true">/</span>
      <input type="number" class="small-input" inputmode="numeric" min="0"
             data-kode="${kode}" data-slot="salah" value="${esc(angkaRapi(n2))}"
             aria-label="${esc(k.name)} — jumlah salah">
    </span>`;
  }
  return `<input type="number" class="small-input" inputmode="decimal" step="any"
                 min="${esc(k.rentang_mentah_min)}" max="${esc(k.rentang_mentah_maks)}"
                 data-kode="${kode}" value="${esc(angkaRapi(n1))}"
                 aria-label="${esc(k.name)}">`;
}

/** Keterangan kecil di bawah judul kolom — rentang yang boleh diketik,
 *  diambil dari konfigurasi supaya tidak pernah berbeda dengan yang divalidasi
 *  server. Persis angka yang tercetak di judul kolom lembar kertas. */
function petunjukKolom(k) {
  if (k.form === "biner") return "centang bila benar";
  if (k.satuan === "detik") return "menit : detik";
  if (k.form === "benar_kurang_salah") return "benar / salah";
  if (k.form === "benar_per_total") return `0 – ${angkaRapi(k.total_soal)}`;
  return `${angkaRapi(k.rentang_mentah_min)} – ${angkaRapi(k.rentang_mentah_maks)}`;
}

/** Membaca satu komponen dari barisnya. null = kotaknya kosong, artinya
 *  komponen ini BELUM dinilai — bukan "dinilai nol".
 *
 *  Centang adalah pengecualian, dan sengaja: sebuah kotak centang tidak punya
 *  keadaan kosong, hanya dicentang atau tidak. Jadi aturannya "menyimpan satu
 *  baris berarti mengesahkan seluruh isinya" — centang yang dibiarkan kosong
 *  di baris yang disimpan berarti benar-benar tidak kena, dan tersimpan
 *  sebagai 0. Baris yang tidak disentuh tidak pernah dikirim sama sekali,
 *  jadi tidak ada regu yang mendadak "dinilai nol" karena tetangganya diisi. */
function bacaSel(tr, k) {
  const kotak = tr.querySelectorAll(`[data-kode="${CSS.escape(k.kode)}"]`);
  if (k.form === "biner") return { nilai_1: kotak[0].checked ? 1 : 0, nilai_2: null };

  if (k.satuan === "detik") {
    const m = kotak[0].value.trim(), d = kotak[1].value.trim();
    if (m === "" && d === "") return null;
    return { nilai_1: (Number(m) || 0) * 60 + (Number(d) || 0), nilai_2: null };
  }
  if (k.form === "benar_kurang_salah") {
    const b = kotak[0].value.trim(), sa = kotak[1].value.trim();
    if (b === "") return null;
    return { nilai_1: Number(b), nilai_2: sa === "" ? null : Number(sa) };
  }
  const v = kotak[0].value.trim();
  return v === "" ? null : { nilai_1: Number(v), nilai_2: null };
}

/** Kolom KERTAS untuk satu komponen. Sebagian komponen memakan dua kolom,
 *  dan pembagiannya sama persis dengan kotak di layar — supaya petugas yang
 *  menyalin dari kertas ke layar menemukan urutan yang sama, tidak perlu
 *  mencocokkan apa pun di kepalanya. */
const kolomCetakPos = (komponen) => komponen.flatMap(k => {
  if (k.satuan === "detik") return [
    { nama: k.name, petunjuk: "menit" }, { nama: "", petunjuk: "detik" }];
  if (k.form === "benar_kurang_salah") return [
    { nama: k.name, petunjuk: "benar" }, { nama: "", petunjuk: "salah" }];
  return [{ nama: k.name, petunjuk: petunjukKolom(k) }];
});

/** Lembar nilai untuk DITULIS TANGAN di pos (alur-lomba.md 8.6).
 *
 *  Identitas regu sudah tercetak, kolom nilainya kosong. Satu hal yang
 *  sengaja TIDAK ada di kertas ini: kolom Nilai Pos. Petugas lapangan hanya
 *  mencatat data mentah dan tidak pernah menghitung poin (alur-lomba.md 8.1)
 *  — menyediakan kotak berjudul "Nilai Pos" justru mengundang mereka
 *  menjumlahkan sendiri, dan angka hasil hitungan tangan yang berbeda dengan
 *  angka sistem adalah sengketa yang tidak perlu ada.
 *
 *  Nama pos ikut di dalam <thead>, bukan hanya di judul halaman pertama.
 *  Kertas ini beredar sebagai lembaran lepas yang berpindah tangan lewat
 *  foto; halaman yang tidak menyebutkan posnya sendiri bisa dinilaikan ke
 *  pos yang salah. Browser mengulang <thead> di tiap halaman, jadi itu
 *  gratis. */
/** Regu per lembar A4 landscape. Dipatok, bukan diserahkan ke pemenggalan
 *  otomatis browser: dengan 300 regu, halaman yang dipenggal sendiri bisa
 *  memotong satu baris di tengah, dan angka pastinya juga yang menentukan
 *  berapa lembar harus difotokopi.
 *
 *  30 pada huruf 12pt hanya mungkin setelah tinggi barisnya ditekan ke
 *  4,8mm — yang kebetulan persis tinggi baris bawaan Excel. Tiga hal yang
 *  menentukannya, dan ketiganya ditemukan dengan MENGUKUR, bukan menalar:
 *
 *    1. line-height, bukan tinggi kotak isian. Pada nilai bawaan (1,6) satu
 *       baris setinggi 32px meski kotaknya diminta 6mm.
 *    2. Sel TERTINGGI yang menang. Nomor dada sempat 14pt dan dialah yang
 *       menaikkan seluruh baris jadi 21px sementara sel 12pt lain cuma butuh
 *       18px — selisih 3px dikali 30 baris persis yang membuat halaman
 *       tumpah.
 *    3. Lebar. Di 12pt tabel Pos 1 selebar 201mm, sedangkan A4 potret hanya
 *       menyediakan 180mm; karena itu lembar ini landscape.
 *
 *  Sisa ruang setelah semuanya: 10-21mm per halaman, tergantung pos. */
const REGU_PER_LEMBAR = 30;

function siapkanCetakLembarPos(pos, komponen, baris, daftarUlangDitutup) {
  document.getElementById("cetakan")?.remove();

  const kolom = kolomCetakPos(komponen);
  const judul = pos.bayangan ? `POS BAYANGAN — ${pos.name}`
                             : `POS ${pos.nomor} — ${pos.name}`;
  const tanggal = tanggalPanjang(new Date());

  const halaman = [];
  for (let i = 0; i < baris.length; i += REGU_PER_LEMBAR) {
    halaman.push(baris.slice(i, i + REGU_PER_LEMBAR));
  }

  // Sel identitas lewat tag html`` (isinya diketik orang luar); kotak kosong
  // ditempel sebagai HTML biasa karena memang tidak ada isinya.
  const barisHtml = (r) => `
    <tr>
      ${html`<td class="dada">${String(r.nomor_dada).padStart(3, "0")}</td>
      <td>${r.nama_regu}</td>
      <td>${r.nama_sekolah}</td>
      <td>${GOLONGAN_LABEL[r.golongan] || r.golongan}</td>`}
      ${kolom.map(() => `<td class="isian"></td>`).join("")}
    </tr>`;

  // Tiap lembar berdiri sendiri: judul pos, nomor halaman, dan baris tanda
  // tangannya sendiri. Kertas ini beredar sebagai lembaran lepas yang
  // berpindah tangan lewat foto — halaman yang tidak menyebutkan posnya
  // sendiri bisa dinilaikan ke pos yang salah.
  const lembar = halaman.map((grup, i) => `
    <section class="print-page lembar-pos">
      <h1>LEMBAR NILAI · ${esc(judul)} · Halaman ${i + 1}/${halaman.length}</h1>
      <p class="lembar-kepala">${esc(EDISI ? EDISI.name : "")} · ${esc(tanggal)} ·
         dada ${esc(String(grup[0].nomor_dada).padStart(3, "0"))}–${esc(String(grup[grup.length - 1].nomor_dada).padStart(3, "0"))}
         · Petugas: ______________ · Diperiksa: ______________</p>
      ${daftarUlangDitutup ? "" : `<p class="insert-note">DAFTAR ULANG BELUM DITUTUP
        — regu yang mendaftar ulang setelah kertas ini dicetak tidak ada di sini.</p>`}
      <table class="print-table">
        <thead>
          <tr>
            <th>No Dada</th><th>Nama Regu</th><th>Organisasi</th><th>Golongan</th>
            ${kolom.map(c => `<th class="isian">${esc(c.nama)}
              <span class="kolom-petunjuk">${esc(c.petunjuk)}</span></th>`).join("")}
          </tr>
        </thead>
        <tbody>${grup.map(barisHtml).join("")}</tbody>
      </table>
      ${i === 0 ? `<p class="print-note">Tulis data mentahnya apa adanya.
         JANGAN menjumlahkan sendiri — sistem yang mengubahnya jadi poin.
         Foto lembar ini secara berkala, jangan ditumpuk sampai pos tutup.</p>` : ""}
    </section>`).join("");

  document.body.appendChild(h(`<div id="cetakan" class="printout">${lembar}</div>`));
}

/** Layar Input Pos — lembar kertas yang dipindah ke layar.
 *
 *  Bentuknya sengaja SAMA dengan lembar Google Sheets yang dipakai panitia
 *  selama ini: identitas regu di kiri, satu kolom per hal yang dinilai, Nilai
 *  Pos di kanan. Petugas yang menyalin dari foto lembar tidak perlu belajar
 *  bentuk baru — matanya sudah tahu di mana harus mendarat.
 *
 *  Nilai Pos TIDAK dihitung di browser. Angkanya dibaca ulang dari database
 *  tiap kali satu baris tersimpan, supaya tidak pernah ada mesin skor kedua
 *  yang bisa berbeda pendapat dengan v_poin_pos — dan supaya angka yang
 *  dilihat petugas adalah angka yang benar-benar tersimpan, bukan tebakan
 *  layar tentang apa yang akan tersimpan.
 */
async function layarInputPos() {
  const s = sesi();
  if (s.peran === "meja") {
    pasangKepala("Input Nilai Pos");
    LAYAR.replaceChildren(h(html`
      <div class="card">
        <h2>Akun meja, bukan akun pos</h2>
        <p class="description">Akun ${s.username} dipakai di meja. Input nilai
           pos memakai akun posnya sendiri — hubungi koordinator.</p>
      </div>`));
    return;
  }

  pasangKepala("Input Nilai Pos", "lembar");
  LAYAR.replaceChildren(h(`<p>Memuat…</p>`));

  const layarIni = location.hash;
  let semuaPos;
  try { semuaPos = await daftarPos(); }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarInputPos)); return; }
  if (location.hash !== layarIni) return;

  // Tidak semua pos dinilai. Pos 0 (Keberangkatan) dan Pos 5 (Kedatangan)
  // adalah garis start dan garis finish — yang dicatat di sana waktu, lewat
  // layar Keberangkatan dan Kedatangan. Admin dibuka di pos yang benar-benar
  // bisa diisi, bukan di pos pertama menurut nomor.
  const posDinilai = semuaPos.filter(p => Number(p.jumlah_komponen) > 0);

  // Operator pos tidak memilih apa pun — posnya sudah melekat di akunnya, dan
  // RLS akan menolak pos lain seandainya layar ini mencoba.
  const nomorPos = s.peran === "operator_pos"
    ? Number(s.pos)
    : (posDipilih.nomor
       ?? (posDinilai.length ? posDinilai[0].nomor
                             : (semuaPos.length ? semuaPos[0].nomor : null)));
  const pos = semuaPos.find(p => Number(p.nomor) === Number(nomorPos));

  if (!pos) {
    LAYAR.replaceChildren(h(kartuGalat(
      "Edisi ini belum punya pos sama sekali. Admin harus mengisinya dulu.")));
    return;
  }
  posDipilih.nomor = pos.nomor;
  pasangKepala(`Input ${judulPos(pos)}`, "lembar");

  let komponen, lembar;
  try {
    [komponen, lembar] = await Promise.all([
      komponenPos(EDISI.nomor, pos.nomor),
      lembarPos(pos.nomor),
    ]);
  } catch (e) {
    LAYAR.replaceChildren(kartuGagalMuat(e.message, layarInputPos)); return;
  }
  if (location.hash !== layarIni) return;

  if (!komponen.length) {
    // Dua sebab yang berbeda, dan layar tidak bisa membedakannya dari data:
    // pos yang MEMANG tidak dinilai, dan pos yang komponennya belum diisi.
    // Jadi keduanya disebut, alih-alih menuduh salah satunya.
    // Template BIASA, bukan tag html`` — pilihPosHtml sudah berupa HTML dan
    // akan tampil apa adanya sebagai teks kalau ikut di-escape. Nama pos
    // datang dari database, jadi ia lewat esc() sendiri.
    LAYAR.replaceChildren(h(`
      <div class="card">${pilihPosHtml(s, semuaPos)}</div>
      <div class="card">
        <h2>${esc(judulPos(pos))} tidak punya kolom penilaian</h2>
        <p class="description">Garis start dan garis finish memang tidak
           dinilai — yang dicatat di sana waktu, lewat layar Keberangkatan dan
           Kedatangan. Kalau pos ini seharusnya dinilai, komponennya belum
           diisi admin.</p>
      </div>`));
    pasangPilihPos(s);
    return;
  }

  // Cermin nilai yang ADA DI DATABASE, bukan yang ada di kotak isian. Yang
  // dikirim ke server hanya selisih antara keduanya — kotak yang tidak diubah
  // tidak pernah ditulis ulang, jadi kepengarangan nilai tidak bergeser dan
  // riwayat tidak dibanjiri baris yang tidak mengubah apa-apa.
  const asli = new Map(lembar.map(r => [Number(r.nomor_dada), r.nilai || {}]));

  LAYAR.replaceChildren(h(`
    <div class="card">
      ${alatTabel({
        kiri: pilihPosHtml(s, semuaPos),
        kanan: `<button class="button button-secondary button-small" type="button"
                        id="cetak-lembar">🖨️ Cetak Lembar</button>`,
        // Pendek dengan sengaja: kartunya kini selebar tabel, dan petunjuk
        // panjang terpotong di tengah kata — yang justru lebih buruk daripada
        // petunjuk singkat, karena terlihat seperti layar yang rusak.
        cariContoh: "Cari nomor dada / regu / organisasi…",
        saringan: [
          { kode: "belum", label: "Belum lengkap" },
          { kode: "sudah", label: "Sudah lengkap" },
          { kode: "semua", label: "Semua" },
        ],
        saringAktif: "semua",
        jumlah: lembar.length,
      })}
      <!-- Pita keadaan simpan. Duduk DI ATAS tabel, bukan di bawahnya:
           tabelnya bergulir sendiri (max-height), jadi apa pun yang ditaruh
           di bawah bisa berada di luar layar justru saat petugas sedang
           mengetik di baris ke-80. -->
      <!-- SELALU terlihat, tidak pernah hidden. Pita yang hanya muncul saat
           ada masalah tidak bisa dipercaya: petugas tidak punya cara
           membedakan "semuanya aman" dari "pitanya sedang rusak". Google
           Sheets menampilkan capnya terus-menerus untuk alasan yang sama. -->
      <div id="pos-simpan" class="pos-simpan aman"></div>
      <!-- table-tetap: di HP lembar ini TETAP tabel dan digeser ke samping,
           tidak ditumpuk jadi kartu seperti layar meja. Alasannya di
           style.css, bagian LEMBAR INPUT POS. -->
      <div class="table-wrapper table-wrapper-tetap">
        <table class="table data-table table-tetap table-pos"
               ${lembar.length ? "" : "hidden"}>
          <thead>
            <tr>
              <th class="text-center">Nomor<br>Dada</th>
              <th>Nama Regu</th>
              <th>Organisasi</th>
              <th>Golongan</th>
              ${komponen.map(k => `
                <th class="text-center">
                  <span class="kolom-nama">${esc(k.name)}</span>
                  <span class="kolom-petunjuk">${esc(petunjukKolom(k))}</span></th>`).join("")}
              <th class="text-center">Nilai<br>${esc(pos.bayangan ? pos.name : `Pos ${pos.nomor}`)}</th>
              <th class="text-center"><span class="visually-hidden">Status simpan</span></th>
            </tr>
          </thead>
          <tbody id="isi-tabel"></tbody>
        </table>
        ${lembar.length ? "" : `<p class="table-empty">Belum ada regu yang
          menerima nomor dada. Lembar pos ini terisi sendiri begitu meja
          daftar ulang mulai jalan.</p>`}
      </div>
    </div>
  `));

  const tbody = document.getElementById("isi-tabel");
  tbody.replaceChildren(h(lembar.map(r => `
    <tr data-dada="${esc(r.nomor_dada)}" data-terisi="${esc(r.jumlah_terisi)}">
      <td class="angka text-center" data-label="Nomor Dada">${esc(String(r.nomor_dada).padStart(3, "0"))}</td>
      <td data-label="Nama Regu"><strong>${esc(r.nama_regu)}</strong></td>
      <td data-label="Organisasi">${esc(r.nama_sekolah)}</td>
      <td data-label="Golongan">${esc(GOLONGAN_LABEL[r.golongan] || r.golongan)}</td>
      ${komponen.map(k => `
        <td class="text-center" data-label="${esc(k.name)}">
          ${selKomponen(k, (r.nilai || {})[k.kode])}</td>`).join("")}
      <td class="text-center pos-nilai" data-label="Nilai Pos">${esc(angkaRapi(r.nilai_pos))}</td>
      <td class="pos-status" data-label=""></td>
    </tr>`).join("")));

  /* ---------- keadaan simpan per baris ----------

     Pertanyaan yang harus bisa dijawab layar ini sambil dilirik, tanpa
     menekan apa pun: "angka yang barusan saya ketik, sudah masuk database
     atau belum?" Di pos, internet putus adalah kejadian biasa — dan angka
     yang hanya ada di layar sama saja dengan angka yang tidak pernah dicatat.

     Empat keadaan, dan tidak ada baris yang boleh berada di luar keempatnya:

       (kosong)    belum ada nilai sama sekali
       belum       sudah diketik, BELUM sampai ke server
       menyimpan   sedang di jalan
       tersimpan   ✓ ada di database — ini yang dibaca ulang dari sana
       gagal       tidak sampai; tetap tersimpan di layar dan dicoba lagi

     Yang paling penting justru `belum`. Sebelumnya keadaan itu tidak ada:
     antara petugas mengetik dan meninggalkan kotaknya, layar diam saja —
     terlihat persis sama dengan baris yang sudah aman.                    */

  const statusBaris = (tr, keadaan, pesan) => {
    const sel = tr.querySelector(".pos-status");
    tr.dataset.keadaan = keadaan || "";
    tr.classList.toggle("baris-gagal", keadaan === "gagal");
    tr.classList.toggle("baris-belum", keadaan === "belum");

    if (keadaan === "belum") {
      sel.replaceChildren(h(`<span class="badge badge-yellow" title="Belum terkirim ke server">belum</span>`));
    } else if (keadaan === "menyimpan") {
      sel.replaceChildren(h(`<span class="badge badge-gray">…</span>`));
    } else if (keadaan === "tersimpan") {
      sel.replaceChildren(h(`<span class="badge badge-green" title="Sudah masuk database">✓</span>`));
    } else if (keadaan === "gagal") {
      sel.replaceChildren(h(html`<button class="button button-danger button-mini"
        type="button" data-ulang title="${pesan}">Ulangi</button>`));
      sel.querySelector("[data-ulang]").addEventListener("click", () => simpanBaris(tr));
    } else {
      sel.replaceChildren();
    }
    perbaruiRingkasan();
  };

  /* ---------- pita keadaan + kirim ulang sendiri ----------

     Dua hal yang tidak boleh diserahkan ke kewaspadaan petugas:

     1. MENGHITUNG sendiri berapa baris yang belum aman. Baris merah di
        tengah tabel 300 baris tidak akan terlihat oleh orang yang sedang
        menatap kolom Semaphore di baris ke-80.
     2. MENEKAN "Ulangi" satu per satu setelah internet kembali. Layar yang
        tahu koneksinya sudah pulih tapi menunggu diperintah hanya
        memindahkan pekerjaan ke orang yang paling sibuk di ruangan itu.  */

  const pita = document.getElementById("pos-simpan");
  let jamUlang = null;

  // Jam terakhir kali sesuatu BENAR-BENAR masuk database. Diisi saat lembar
  // dimuat, karena saat itu angka di layar memang baru dibaca dari sana.
  let jamSinkron = new Date();

  const berapaLalu = (d) => {
    const menit = Math.floor((Date.now() - d.getTime()) / 60000);
    if (menit < 1) return "barusan";
    if (menit < 60) return `${menit} menit lalu`;
    return `${Math.floor(menit / 60)} jam lalu`;
  };

  function perbaruiRingkasan() {
    const baris = [...tbody.children];
    const belum = baris.filter(t => t.dataset.keadaan === "belum").length;
    const gagal = baris.filter(t => t.dataset.keadaan === "gagal").length;
    const sibuk = baris.some(t => t.dataset.keadaan === "menyimpan");
    const putus = !navigator.onLine;
    // Umurnya SELALU ikut, bukan hanya saat gagal. Capnya kini HH:MM (bentuk
    // baku, lihat util.js) dan tanpa detik dua simpanan dalam satu menit
    // terlihat identik — "barusan" yang menggantikannya sebagai tanda bahwa
    // pitanya memang masih hidup, dan sekaligus menjawab pertanyaan yang
    // sebenarnya: seberapa tua angka ini.
    const cap = `Sinkronisasi Terakhir: ${jamMenit(jamSinkron)} (${berapaLalu(jamSinkron)})`;

    if (gagal || putus) {
      pita.className = "pos-simpan bahaya";
      pita.textContent = putus
        ? `Internet putus — ${belum + gagal} baris belum tersimpan. Angkanya aman di layar dan dikirim sendiri begitu internet kembali; jangan tutup halaman ini. ${cap}.`
        // Kedua-duanya disebut. Pita yang hanya menghitung baris GAGAL sempat
        // menulis "1 baris" padahal ada dua yang belum aman di layar —
        // angka yang tidak lengkap justru menghapus gunanya sebagai jaminan.
        : `${gagal} baris gagal terkirim${belum ? ` dan ${belum} baris masih diketik` : ""}`
          + ` — dicoba lagi sendiri tiap 15 detik. Jangan tutup halaman ini. ${cap}.`;
      if (gagal) jadwalkanUlang();
      return;
    }
    if (sibuk)  { pita.className = "pos-simpan menunggu"; pita.textContent = `Menyimpan… ${cap}`; return; }
    if (belum)  { pita.className = "pos-simpan menunggu"; pita.textContent = `${belum} baris belum tersimpan. ${cap}`; return; }
    pita.className = "pos-simpan aman";
    pita.textContent = `✓ Data Tersimpan · ${cap}`;
  }

  function ulangYangGagal() {
    if (!document.body.contains(tbody)) return false;   // layar sudah ditinggalkan
    if (!navigator.onLine) return true;
    [...tbody.children]
      .filter(t => t.dataset.keadaan === "gagal")
      .forEach(t => simpanBaris(t));
    return true;
  }

  function jadwalkanUlang() {
    if (jamUlang) return;
    jamUlang = setInterval(() => {
      // Layar ini bisa ditinggalkan kapan saja; jam yang terus berdetak di
      // atas tabel yang sudah lepas dari halaman adalah kebocoran.
      if (!document.body.contains(tbody)
          || ![...tbody.children].some(t => t.dataset.keadaan === "gagal")) {
        clearInterval(jamUlang); jamUlang = null;
        return;
      }
      ulangYangGagal();
    }, 15000);
  }

  // Internet kembali: jangan menunggu putaran 15 detik berikutnya.
  window.addEventListener("online", ulangYangGagal);
  window.addEventListener("offline", perbaruiRingkasan);

  // Baris yang sudah berisi nilai memang berasal dari database — ✓-nya
  // benar sejak halaman dibuka, bukan hanya untuk yang diketik hari ini.
  [...tbody.children].forEach(tr => {
    if (Number(tr.dataset.terisi) > 0) statusBaris(tr, "tersimpan");
  });
  perbaruiRingkasan();

  async function simpanBaris(tr) {
    // Satu baris punya banyak kotak, dan tiap kotak yang ditinggalkan memicu
    // simpanan sendiri. Petugas yang mengetik cepat menghasilkan lima
    // panggilan beruntun, dan yang kedua sampai kelima datang selagi yang
    // pertama masih di jalan.
    //
    // MENOLAKNYA adalah kesalahan yang sempat ada di sini: barisnya tetap
    // diberi ✓ hijau — karena simpanan pertama memang berhasil — sementara
    // empat angka berikutnya tidak pernah terkirim. Petugas melihat tanda
    // berhasil untuk nilai yang hilang. Jadi yang datang saat sibuk DIANTRE,
    // lalu dijalankan sekali lagi sesudahnya; putaran kedua membaca ulang
    // seluruh baris, sehingga berapa pun ketukan yang menumpuk cukup
    // diselesaikan satu kali.
    if (tr.dataset.jalan === "1") { tr.dataset.antre = "1"; return; }
    const dada = Number(tr.dataset.dada);
    const lama = asli.get(dada) || {};
    const baris = [], dihapus = [];

    for (const k of komponen) {
      const baru = bacaSel(tr, k);
      const ada = lama[k.kode] || null;
      if (baru === null) {
        // Kotak dikosongkan padahal sebelumnya ada isinya = angka itu masuk ke
        // regu yang salah. Dihapus, bukan ditimpa nol.
        if (ada) dihapus.push(k.kode);
        continue;
      }
      const samaSaja = ada
        && Number(ada.nilai_1) === baru.nilai_1
        && (ada.nilai_2 === null || ada.nilai_2 === undefined
              ? null : Number(ada.nilai_2)) === baru.nilai_2;
      if (!samaSaja) {
        baris.push({ nomor_dada: dada, kode: k.kode,
                     nilai_1: baru.nilai_1, nilai_2: baru.nilai_2 });
      }
    }
    // Tidak ada yang berubah — misalnya angka diketik ulang sama persis.
    // Barisnya dikembalikan ke keadaan istirahat, BUKAN ditinggalkan dalam
    // keadaan "belum": tanda kuning yang tidak akan pernah hilang sendiri
    // mengajari petugas mengabaikan tanda kuning.
    if (!baris.length && !dihapus.length) {
      statusBaris(tr, Number(tr.dataset.terisi) > 0 ? "tersimpan" : "");
      return;
    }

    tr.dataset.jalan = "1";
    statusBaris(tr, "menyimpan");
    try {
      if (baris.length) {
        const hasil = await simpanNilaiPos(baris, pos.nomor);
        // Server memeriksa ulang tiap baris dan menolaknya satu per satu;
        // yang pertama ditolak sudah cukup menjelaskan apa yang salah.
        const ditolak = (hasil || []).find(x => x.status === "ditolak");
        if (ditolak) throw new ErrorApi(ditolak.alasan || "nilai ditolak server");
      }
      for (const kode of dihapus) await hapusNilaiPos(dada, kode, pos.nomor);

      const segar = await lembarPosSatu(pos.nomor, dada);
      if (segar) {
        asli.set(dada, segar.nilai || {});
        tr.querySelector(".pos-nilai").textContent = angkaRapi(segar.nilai_pos);
        tr.dataset.terisi = String(segar.jumlah_terisi);
      }
      // Cap waktunya dipasang DI SINI, bukan saat permintaan dikirim: yang
      // dijanjikan cap itu adalah "sudah ada di database", dan yang
      // membuktikannya adalah baris yang barusan dibaca kembali dari sana.
      jamSinkron = new Date();
      statusBaris(tr, Number(tr.dataset.terisi) > 0 ? "tersimpan" : "");
      hitungUlangJumlah();
    } catch (err) {
      statusBaris(tr, "gagal", err.message);
      notif(`${String(dada).padStart(3, "0")}: ${err.message}`, true);
    } finally {
      tr.dataset.jalan = "";
      // Ketukan yang menumpuk selagi baris ini sibuk. Dijalankan juga setelah
      // GAGAL: yang tersimpan sebagian lalu ditinggalkan adalah keadaan
      // terburuk dari semuanya.
      if (tr.dataset.antre === "1") { tr.dataset.antre = ""; simpanBaris(tr); }
    }
  }

  /* ---------- perilaku isian ---------- */

  // Ditandai sejak KETUKAN PERTAMA, bukan menunggu kotaknya ditinggalkan.
  // Di antara keduanya bisa lewat semenit — petugas mengetik lalu menoleh ke
  // lembar berikutnya — dan selama semenit itu angkanya hanya ada di layar.
  tbody.addEventListener("input", (e) => {
    const tr = e.target.closest("tr");
    if (tr && tr.dataset.jalan !== "1") statusBaris(tr, "belum");
  });

  tbody.addEventListener("change", (e) => {
    const tr = e.target.closest("tr");
    if (tr) simpanBaris(tr);
  });

  // Enter = turun satu regu di kolom yang sama, seperti menyalin dari kertas
  // ke bawah. Berpindah fokus memicu change-nya sendiri, jadi barisnya
  // tersimpan tanpa perlu dipanggil dua kali.
  tbody.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.target.tagName !== "INPUT") return;
    e.preventDefault();
    const tr = e.target.closest("tr");
    const kotak = [...tr.querySelectorAll("input")];
    const kolom = kotak.indexOf(e.target);
    let lanjut = tr.nextElementSibling;
    while (lanjut && lanjut.hidden) lanjut = lanjut.nextElementSibling;
    const tujuan = lanjut && lanjut.querySelectorAll("input")[kolom];
    if (tujuan) { tujuan.focus(); if (tujuan.select) tujuan.select(); }
    else e.target.blur();
  });

  /* ---------- cari & saring ---------- */

  // Baris DISEMBUNYIKAN, bukan dibangun ulang. Menggambar ulang tabel akan
  // membuang isi kotak yang belum sempat tersimpan — dan petugas tidak akan
  // sadar angkanya hilang, karena yang ia lihat hanyalah daftar yang menyusut.
  const cocok = (tr, cari) => !cari
    || tr.dataset.dada.padStart(3, "0").includes(cari)
    || tr.children[1].textContent.toLowerCase().includes(cari)
    || tr.children[2].textContent.toLowerCase().includes(cari);

  const lengkap = (tr) => Number(tr.dataset.terisi) >= komponen.length;

  function hitungUlangJumlah() {
    const baris = [...tbody.children];
    const tampil = baris.filter(tr => !tr.hidden).length;
    const sudah = baris.filter(lengkap).length;
    document.getElementById("tabel-jumlah").textContent =
      `${tampil} ditampilkan · ${sudah}/${baris.length} lengkap`;
  }

  /* ---------- cetak lembar kosong ---------- */

  // Yang dicetak adalah baris yang SEDANG TAMPIL, bukan selalu semuanya.
  // Dua kebutuhan berbeda terlayani satu tombol: sebelum lomba cetak "Semua"
  // untuk lembar kosong, dan di tengah lomba saring "Belum lengkap" dulu
  // supaya kertas susulan hanya memuat regu yang memang belum dinilai.
  document.getElementById("cetak-lembar").addEventListener("click", async () => {
    const tampil = [...tbody.children].filter(tr => !tr.hidden)
      .map(tr => lembar.find(r => Number(r.nomor_dada) === Number(tr.dataset.dada)))
      .filter(Boolean);
    if (!tampil.length) { notif("Tidak ada baris yang bisa dicetak.", true); return; }

    // Dibaca saat menekan, bukan saat layar dimuat: layar pos sering
    // dibiarkan terbuka berjam-jam, dan status daftar ulang berubah di
    // tengahnya. Gagal membacanya tidak boleh menghalangi cetak — paling
    // buruk peringatannya ikut tercetak padahal sudah tidak berlaku.
    let ditutup = false;
    try { ditutup = !!(await statusAcara()).daftar_ulang_ditutup; } catch { /* cetak tetap jalan */ }

    siapkanCetakLembarPos(pos, komponen, tampil, ditutup);
    window.print();
  });

  pasangAlatTabel((cari, saring) => {
    [...tbody.children].forEach(tr => {
      const lolosSaring = saring === "semua"
        || (saring === "sudah" ? lengkap(tr) : !lengkap(tr));
      tr.hidden = !(cocok(tr, cari) && lolosSaring);
    });
    hitungUlangJumlah();
  });

  pasangPilihPos(s);
}

/** Pemilih pos — hanya untuk admin. Operator pos melihat namanya saja, karena
 *  memberinya daftar pos lain hanya menawarkan sesuatu yang pasti ditolak
 *  server (RLS nilai_mentah) — pintu yang terkunci lebih baik tidak digambar.
 *
 *  Yang muncul HANYA pos yang benar-benar dinilai. Pos 0 (Keberangkatan) dan
 *  Pos 5 (Kedatangan) adalah garis start dan garis finish; yang dicatat di
 *  sana waktu, lewat layar Keberangkatan dan Kedatangan. Menawarkannya di
 *  sini berarti menawarkan lembar yang tidak akan pernah punya kolom — dan
 *  daftar yang memuat pilihan tanpa isi mengajari orang bahwa daftar itu
 *  tidak bisa dipercaya. */
function pilihPosHtml(s, semuaPos) {
  if (s.peran !== "admin") return "";
  const dinilai = semuaPos.filter(p => Number(p.jumlah_komponen) > 0);
  return `
    <div class="field" style="margin:0;min-width:210px">
      <label for="pilih-pos" class="visually-hidden">Pos yang diinput</label>
      <select id="pilih-pos" class="select-small">
        ${dinilai.map(p => `<option value="${esc(p.nomor)}"
          ${Number(p.nomor) === Number(posDipilih.nomor) ? "selected" : ""}
          >${esc(judulPos(p))}</option>`).join("")}
      </select>
    </div>`;
}

function pasangPilihPos(s) {
  if (s.peran !== "admin") return;
  const sel = document.getElementById("pilih-pos");
  if (!sel) return;
  sel.addEventListener("change", () => {
    posDipilih.nomor = Number(sel.value);
    layarInputPos();
  });
}

/* ============================ PINDAH KLOTER (HARI-H) ===================== */

/** Daftar sisipan: nomor-nomor yang TIDAK ADA di kertas petugas staging.
 *  Ditaruh paling atas dan diberi bingkai merah — ini satu-satunya cara
 *  petugas tahu ada regu tambahan di kloternya. */
function kartuSisipan(sisipan) {
  const aktif = sisipan.filter(s => !s.sudah_berangkat);
  if (!aktif.length) return "";
  const baris = aktif.map(s => html`
    <tr><td class="angka">${String(s.nomor_dada).padStart(3, "0")}</td>
        <td><strong>${s.nama_regu}</strong><br>
            <span class="description">${s.nama_sekolah}</span></td>
        <td><span class="badge badge-red">Kloter ${s.kloter}</span></td>
        <td class="description">${s.alasan_sisip}</td></tr>`).join("");
  return `
    <div class="card" style="border:3px solid var(--bahaya);background:var(--bahaya-muda)">
      <h2 style="color:var(--bahaya)">⚠️ ${aktif.length} regu TIDAK ADA di kertas</h2>
      <p class="description">Nomor-nomor ini disisipkan setelah daftar kloter dicetak.
         Bacakan ke petugas staging kloter terkait, atau tulis tangan di kertasnya.</p>
      <table class="table" style="background:#fff;border-radius:8px;margin-top:.6rem">${baris}</table>
      <button class="button button-secondary" onclick="window.print()" type="button"
              style="margin-top:.6rem">🖨️ Cetak daftar sisipan</button>
    </div>`;
}

/* ---------------- layar "edisi belum termuat" ---------------- */

function layarButuhEdisi(judul) {
  pasangKepala(judul);
  LAYAR.replaceChildren(kartuGagalMuat(
    "Data acara (biaya per regu) belum terbaca, jadi tagihan tidak bisa dihitung.",
    async () => { try { EDISI = await infoEdisi(); } catch {} arahkan(); }));
}

/* ============================ RUTE ======================================= */

const RUTE = {
  "#/home": layarHome,
  "#/pembayaran": layarPembayaran,
  "#/daftar-ulang": layarDaftarUlang,
  "#/cetak-kloter": layarCetakKloter,
  "#/keberangkatan": layarKeberangkatan,
  "#/finish": layarFinish,
  "#/pos": layarInputPos,
  "#/ganti-password": layarGantiPassword,
};

async function arahkan() {
  if (!sesi()) { layarLogin(); return; }
  if (!EDISI) {
    try { EDISI = await infoEdisi(); }
    catch (e) { layarButuhEdisi("HRCD Rekap"); return; }
  }
  (RUTE[location.hash] || layarHome)();
}

// Tiga aksi yang sama dipasang di DUA tempat: tombol header (layar lebar)
// dan menu bawah (HP). Dideklarasikan lebih dulu supaya tidak ada listener
// yang menunjuk const yang belum terisi.
const keHome = () => {
  if (location.hash === "#/home") arahkan(); else location.hash = "#/home";
};
const keSetelan = () => {
  if (location.hash === "#/ganti-password") arahkan();
  else location.hash = "#/ganti-password";
};
const keluarSekarang = () => { keluar(); EDISI = null; location.hash = ""; arahkan(); };

document.getElementById("btn-keluar").addEventListener("click", keluarSekarang);
document.getElementById("btn-home").addEventListener("click", keHome);
document.getElementById("nav-home").addEventListener("click", keHome);
document.getElementById("nav-setting").addEventListener("click", keSetelan);
document.getElementById("nav-keluar").addEventListener("click", keluarSekarang);
document.getElementById("ganti-password").addEventListener("click", keSetelan);
window.addEventListener("hashchange", arahkan);

/* ---------------- muat ulang sendiri saat layar dilihat lagi -------------
   Panitia berpindah app di HP (WhatsApp, kamera) lalu kembali, atau
   membiarkan layar terbuka sementara meja lain terus bekerja. Menyuruh
   mereka menekan F5 tidak bisa diandalkan: yang lupa menekan tidak melihat
   apa pun yang memberitahu bahwa layarnya basi — angkanya tetap terlihat
   wajar, hanya salah.

   DUA pengaman, karena memuat ulang sendiri bisa lebih merusak daripada
   data basi:
     - kalau ada isian/pilihan yang sedang dipakai, dilewati. Menggambar
       ulang saat petugas sedang mengetik nomor dada akan menghapus
       ketikannya, dan ia tidak akan sadar.
     - dijeda 5 detik, supaya berpindah app sekejap tidak memicu tembakan
       permintaan beruntun.                                                */
let terakhirSegar = Date.now();
document.addEventListener("visibilitychange", () => {
  if (document.hidden || !sesi()) return;
  if (Date.now() - terakhirSegar < 5000) return;
  const fokus = document.activeElement;
  if (fokus && ["INPUT", "SELECT", "TEXTAREA"].includes(fokus.tagName)) return;
  if (document.querySelector(".overlay")) return;   // dialog sedang terbuka
  // Menggambar ulang membuang isi kotak yang belum sampai ke server. Di
  // lembar pos itu berarti menghapus nilai yang sedang menunggu internet
  // pulih — persis pada orang yang paling tidak berdaya menyadarinya, karena
  // yang ia lihat hanyalah tabel yang tiba-tiba bersih.
  if (adaYangBelumTersimpan()) return;
  terakhirSegar = Date.now();
  arahkan();
});

/** Baris lembar pos yang isinya belum sampai ke database. */
const adaYangBelumTersimpan = () => !!document.querySelector(
  '#isi-tabel tr[data-keadaan="belum"], #isi-tabel tr[data-keadaan="gagal"]');

// Menutup tab dengan nilai yang belum terkirim = nilai itu hilang tanpa
// jejak. Browser hanya mengizinkan peringatan bawaannya, dan itu sudah cukup:
// yang dibutuhkan cuma satu jeda sebelum tab-nya benar-benar tertutup.
window.addEventListener("beforeunload", (e) => {
  if (!adaYangBelumTersimpan()) return;
  e.preventDefault();
  e.returnValue = "";
});

arahkan();
