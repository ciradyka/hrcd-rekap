/* ============================================================================
   hrcd-rekap : app.js — aplikasi panitia (tahap 2).
   Aturan bentuk (rancangan-b.md 10.1): kerangka sama di semua layar,
   satu aksi utama per layar, kunci di-autofocus, echo-confirm sebelum simpan,
   "baris terakhir" di kaki, gagal itu nyaring dan lokal.

   Semua teks dari luar (nama sekolah/regu/ketua, pesan server) WAJIB lewat
   esc() atau tag html`` — lihat util.js.
   ========================================================================== */

import {
  sesi, masuk, keluar, ErrorApi,
  infoEdisi, ringkasanMeja, daftarPendaftaran,
  verifikasiPembayaran, batalkanVerifikasi, daftarUlang, tukarNomor, ubahPendamping,
  daftarKloter, tandaiKloterDicetak, pindahKloter, daftarSisipan,
  cariRegu, catatFinish, infoPenalti,
  papanKeberangkatan, reguKloter, kontrakOpsi,
  konfirmasiKontrak, ceklisBerangkat, batalCeklisBerangkat, berangkatkanKloter,
} from "./api.js";
import { esc, h, html, rupiah, jamSekarang, notif, dialog, kartuGagalMuat } from "./util.js";

const LAYAR = document.getElementById("layar");
const GOLONGAN_LABEL = {
  penggalang_pa: "Penggalang PA", penggalang_pi: "Penggalang PI",
  penegak_pa: "Penegak PA", penegak_pi: "Penegak PI",
};
let EDISI = null;
const terakhir = { pembayaran: [], "daftar-ulang": [], finish: [] };

/* ---------------- kerangka ---------------- */

/** lebar = layar tabel (butuh ruang horizontal); sisanya tetap sempit supaya
 *  satu aksi utama gampang ditemukan di layar kecil. */
function pasangKepala(judul, lebar = false) {
  const s = sesi();
  document.getElementById("kepala").hidden = !s;
  document.getElementById("judul-layar").textContent = judul;
  LAYAR.classList.toggle("lebar", lebar);
  if (s) document.getElementById("siapa").textContent =
    `${s.username} · ${EDISI ? EDISI.nama : ""}`;
}

/** Jam sekarang dalam bentuk HH:MM untuk <input type="time">. */
const jamSekarangHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const kartuGalat = (pesan) => html`
  <div class="kartu" style="border-color:var(--bahaya);background:var(--bahaya-muda)">
    <strong>${pesan}</strong></div>`;

function barisTerakhirHtml(fungsi) {
  const daftar = terakhir[fungsi] || [];
  if (!daftar.length) return "";
  return `<div class="kartu">
    <h2 style="font-size:1rem;color:var(--tinta-lembut)">Baru saja di meja ini</h2>
    <table class="tabel">${daftar.slice(0, 8).map(b => html`
      <tr><td>${b.jam}</td><td><strong>${b.apa}</strong></td><td>${b.detail}</td></tr>`).join("")}
    </table></div>`;
}
function catatTerakhir(fungsi, apa, detail) {
  terakhir[fungsi].unshift({ jam: jamSekarang(), apa, detail });
}

/* ============================ LOGIN ===================================== */

function layarLogin(pesan) {
  pasangKepala("HRCD Rekap");
  LAYAR.replaceChildren(h(`
    <div class="kartu" style="max-width:480px;margin:2rem auto">
      <h2>Masuk Panitia</h2>
      <p class="keterangan">Pakai akun yang dibagikan koordinatormu.</p>
      ${pesan ? `<div class="galat" style="margin-top:.5rem">${esc(pesan)}</div>` : ""}
      <div class="medan" style="margin-top:1rem">
        <label for="u">Username</label>
        <input type="text" id="u" autocomplete="username" autocapitalize="none"
               spellcheck="false">
      </div>
      <div class="medan">
        <label for="p">Password</label>
        <input type="password" id="p" autocomplete="current-password">
      </div>
      <button class="tombol tombol-utama" id="masuk" type="button">Masuk</button>
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
      location.hash = "#/beranda";
      arahkan();
    } catch (e) {
      layarLogin(e instanceof ErrorApi ? e.message : "Username atau password salah.");
    }
  };
  document.getElementById("masuk").addEventListener("click", aksi);
  LAYAR.querySelectorAll("input").forEach(i =>
    i.addEventListener("keydown", e => { if (e.key === "Enter") aksi(); }));
}

/* ============================ BERANDA MEJA =============================== */

async function layarBeranda() {
  pasangKepala("Beranda Meja");
  const peran = sesi().peran;
  LAYAR.replaceChildren(h(`<p>Memuat…</p>`));

  // Operator pos tidak berhak atas layar meja — RLS akan mengosongkan
  // datanya dan itu tampak seperti "tidak ada antrean" (temuan review).
  if (peran === "operator_pos") {
    LAYAR.replaceChildren(h(html`
      <div class="kartu">
        <h2>Akun pos, bukan akun meja</h2>
        <p class="keterangan">Akun ${sesi().username} dipakai untuk input nilai di
           Pos ${sesi().pos}. Layar meja belum bisa dibuka dengan akun ini.</p>
      </div>`));
    return;
  }

  let r = null, galat = null;
  try { r = await ringkasanMeja(); } catch (e) { galat = e.message; }
  const lencana = (n) => n === null
    ? `<span class="lencana lencana-abu" title="jumlah antrean tidak terbaca">?</span>`
    : `<span class="lencana ${n > 0 ? "lencana-kuning" : "lencana-hijau"}">${n}</span>`;

  LAYAR.replaceChildren(h(`
    ${galat ? kartuGalat(`Jumlah antrean tidak bisa dibaca: ${galat}`) : ""}
    <div class="menu-fungsi">
      <a href="#/pendaftaran-offline">
        <div class="nama-fungsi">📝 Pendaftaran</div>
        <div class="ket">Buka form pendaftaran — link sama untuk online maupun diisikan langsung</div>
      </a>
      <a href="#/pembayaran">
        <div class="nama-fungsi">💳 Pembayaran ${lencana(r ? r.menunggu_pembayaran : null)}</div>
        <div class="ket">Periksa transfer/tunai, tandai lunas, cetak kwitansi</div>
      </a>
      <a href="#/daftar-ulang">
        <div class="nama-fungsi">🎽 Daftar Ulang ${lencana(r ? r.lunas_belum_nomor : null)}</div>
        <div class="ket">Berikan nomor dada untuk sekolah yang sudah lunas</div>
      </a>
      <a href="#/cetak-kloter">
        <div class="nama-fungsi">🖨️ Cetak Daftar Kloter</div>
        <div class="ket">Kertas untuk papan pengumuman, barak, dan petugas staging</div>
      </a>
      <a href="#/keberangkatan">
        <div class="nama-fungsi">🚩 Keberangkatan</div>
        <div class="ket">Ceklis regu yang hadir, pilih kontrak waktu, catat jam berangkat</div>
      </a>
      <a href="#/finish">
        <div class="nama-fungsi">🏁 Meja Finish</div>
        <div class="ket">Ketik nomor dada, tekan Sampai — catat kedatangan regu</div>
      </a>
      <a href="#/pindah-kloter">
        <div class="nama-fungsi">🔀 Pindah Kloter</div>
        <div class="ket">Peserta telat atau urgent — pindahkan nomor dada ke kloter lain</div>
      </a>
    </div>
    <p class="keterangan" style="margin-top:1.2rem">Angka kuning = masih ada antrean.
       Meja boleh berganti fungsi kapan saja — cukup pilih dari sini.</p>
  `));
}

/* ============================ ALAT TABEL ================================= */

/** Kotak cari + tombol saring, dipakai layar Pembayaran & Daftar Ulang.
 *  Menyaring di browser (data sudah dimuat semua) supaya hasilnya berubah
 *  seketika sambil mengetik — di meja, menunggu server tiap huruf terasa
 *  seperti aplikasi macet. */
function alatTabel({ saringan, saringAktif, jumlah }) {
  return `
    <div class="tabel-alat">
      <div class="medan" style="margin:0;flex:1;min-width:220px">
        <label for="cari-tabel" class="visually-hidden">Cari</label>
        <input type="text" id="cari-tabel" autocomplete="off"
               placeholder="Cari kode atau nama sekolah…">
      </div>
      <div class="saring-baris">
        ${saringan.map(s => `
          <button type="button" class="pilihan pilihan-kecil" data-saring="${esc(s.kode)}"
                  aria-pressed="${s.kode === saringAktif}">${esc(s.label)}</button>`).join("")}
      </div>
      <span class="tabel-jumlah" id="tabel-jumlah">${jumlah} baris</span>
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

/** Filter bersama: kode pembayaran atau nama sekolah mengandung teks cari. */
const cocokCari = (b, cari) => !cari
  || b.kode_pembayaran.toLowerCase().includes(cari)
  || (b.sekolah?.nama || "").toLowerCase().includes(cari);

const reguAktif = (b) => (b.regu || []).filter(r => !r.batal);

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

  LAYAR.replaceChildren(h(`
    <div class="kartu">
      ${alatTabel({
        saringan: [
          { kode: "belum", label: "Belum bayar" },
          { kode: "lunas", label: "Lunas" },
          { kode: "semua", label: "Semua" },
        ],
        saringAktif: "belum",
        jumlah: semua.length,
      })}
      <div class="tabel-bungkus">
        <table class="tabel tabel-data">
          <thead>
            <tr>
              <th>Kode</th><th>Sekolah</th><th class="rata-tengah">Regu</th>
              <th class="rata-kanan">Tagihan</th><th>Status / Aksi</th>
            </tr>
          </thead>
          <tbody id="isi-tabel"></tbody>
        </table>
      </div>
    </div>
    ${barisTerakhirHtml("pembayaran")}
  `));

  const gambar = (cari, saring) => {
    const baris = semua.filter(b =>
      cocokCari(b, cari) &&
      (saring === "semua" || (saring === "lunas" ? b.status === "lunas"
                                                 : b.status === "menunggu_pembayaran")));
    document.getElementById("tabel-jumlah").textContent = `${baris.length} baris`;
    const tbody = document.getElementById("isi-tabel");

    if (!baris.length) {
      tbody.replaceChildren(h(`<tr><td colspan="5" class="tabel-kosong">
        Tidak ada yang cocok.</td></tr>`));
      return;
    }

    tbody.replaceChildren(h(baris.map(b => {
      const aktif = reguAktif(b);
      const tagihan = aktif.length * EDISI.biaya_per_regu;
      const aksi = b.status === "lunas"
        ? html`<span class="lencana lencana-hijau">LUNAS</span>
               <span class="kwitansi">${b.pembayaran ? b.pembayaran.nomor_kwitansi : ""}</span>
               <button class="tombol tombol-kalem tombol-mini" type="button"
                       data-batal-bayar="${b.kode_pembayaran}">Batalkan</button>`
        : b.status === "batal"
          ? `<span class="lencana lencana-merah">BATAL</span>`
          : `<div class="aksi-baris">
               <select class="pilih-kecil" data-metode="${esc(b.kode_pembayaran)}">
                 <option value="">Cara bayar…</option>
                 <option value="transfer">Transfer</option>
                 <option value="tunai">Tunai</option>
               </select>
               <button class="tombol tombol-utama tombol-kecil" type="button" disabled
                       data-lunas="${esc(b.kode_pembayaran)}">Tandai Lunas</button>
             </div>`;
      // Template biasa, BUKAN tag html`` — aksi sudah berupa HTML jadi tidak
      // boleh ikut di-escape. Data dari luar tetap lewat esc() satu per satu.
      return `
        <tr data-baris="${esc(b.kode_pembayaran)}">
          <td class="mono">${esc(b.kode_pembayaran)}</td>
          <td>
            <strong>${esc(b.sekolah?.nama || "—")}</strong>
            <div class="sub">${esc(aktif.map(r => r.nama_regu).join(", "))}</div>
          </td>
          <td class="rata-tengah">${aktif.length}</td>
          <td class="rata-kanan">${esc(rupiah(tagihan))}</td>
          <td>${aksi}</td>
        </tr>`;
    }).join("")));

    // Jalan mundur yang sah untuk salah tandai (rancangan-b.md 11.9) —
    // wajib beralasan, dan ditolak server bila batch sudah daftar ulang.
    tbody.querySelectorAll("[data-batal-bayar]").forEach(btn =>
      btn.addEventListener("click", async () => {
        const kode = btn.dataset.batalBayar;
        const b = semua.find(x => x.kode_pembayaran === kode);
        const jawab = await dialog({
          judul: "Batalkan verifikasi pembayaran",
          kartuHtml: html`<div class="kartu kartu-identitas" style="margin-bottom:.8rem">
            <div class="nama">${b.sekolah?.nama || kode}</div>
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
          gambar(cari, saring);
        } catch (err) { notif(err.message, true); }
      }));

    // Cara bayar harus dipilih dulu — nominalnya uang, jadi satu ketukan
    // tidak boleh cukup untuk menandai lunas (rancangan-b.md 10.1).
    tbody.querySelectorAll("[data-metode]").forEach(sel =>
      sel.addEventListener("change", () => {
        const btn = tbody.querySelector(`[data-lunas="${CSS.escape(sel.dataset.metode)}"]`);
        btn.disabled = !sel.value;
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
        b.status = "lunas";
        b.pembayaran = { nominal: tagihan, metode, nomor_kwitansi: r.nomor_kwitansi };
        catatTerakhir("pembayaran", kode, `${b.sekolah?.nama || ""} — lunas, ${r.nomor_kwitansi}`);
        notif(`${b.sekolah?.nama || kode} LUNAS — kwitansi ${r.nomor_kwitansi}`);
        gambar(cari, saring);
      }));
  };

  pasangAlatTabel(gambar);
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

  LAYAR.replaceChildren(h(`
    <div class="kartu">
      ${alatTabel({
        saringan: [
          { kode: "belum", label: "Belum dapat nomor" },
          { kode: "sudah", label: "Sudah" },
          { kode: "semua", label: "Semua yang lunas" },
        ],
        saringAktif: "belum",
        jumlah: semua.length,
      })}
      <div class="tabel-bungkus">
        <table class="tabel tabel-data">
          <thead>
            <tr>
              <th>Kode</th><th>Sekolah</th><th class="rata-tengah">Regu</th>
              <th class="rata-tengah">Pendamping</th><th>Nomor dada / Aksi</th>
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
      tbody.replaceChildren(h(`<tr><td colspan="5" class="tabel-kosong">
        Tidak ada yang cocok.</td></tr>`));
      return;
    }

    tbody.replaceChildren(h(baris.map(b => {
      const aktif = reguAktif(b);
      const menunggu = aktif.filter(r => r.nomor_dada === null);
      const nomorHtml = aktif.filter(r => r.nomor_dada !== null)
        .sort((x, y) => x.nomor_dada - y.nomor_dada)
        .map(r => html`<span class="pil-nomor">${String(r.nomor_dada).padStart(3, "0")}
          <span class="pil-kloter">K${r.kloter_nomor}</span></span>`).join(" ");

      const tombolTukar = nomorHtml
        ? `<button class="tombol tombol-kalem tombol-mini" type="button"
                   data-tukar="${esc(b.kode_pembayaran)}">Tukar nomor rusak…</button>`
        : "";
      const aksi = menunggu.length
        ? `<button class="tombol tombol-utama tombol-kecil" type="button"
                   data-ambil="${esc(b.kode_pembayaran)}">
             Ambil ${menunggu.length} Nomor
           </button>${nomorHtml ? `<div class="sub">${nomorHtml} ${tombolTukar}</div>` : ""}`
        : `<div class="pil-baris">${nomorHtml} ${tombolTukar}</div>`;

      // Template biasa (lihat catatan sama di layar Pembayaran).
      return `
        <tr data-baris="${esc(b.kode_pembayaran)}">
          <td class="mono">${esc(b.kode_pembayaran)}</td>
          <td>
            <strong>${esc(b.sekolah?.nama || "—")}</strong>
            <div class="sub">${esc(aktif.map(r => r.nama_regu).join(", "))}</div>
          </td>
          <td class="rata-tengah">${aktif.length}</td>
          <td class="rata-tengah">
            <input type="number" class="isian-kecil" min="0" max="30" inputmode="numeric"
                   value="${esc(b.jumlah_pendamping)}" data-pendamping="${esc(b.kode_pembayaran)}">
          </td>
          <td>${aksi}</td>
        </tr>`;
    }).join("")));

    // Jumlah pendamping boleh dikoreksi langsung di tabel — angkanya hanya
    // memengaruhi penyusunan barak, bukan uang, jadi aman disimpan begitu
    // kolom ditinggalkan (tanpa tombol simpan terpisah).
    tbody.querySelectorAll("[data-pendamping]").forEach(inp =>
      inp.addEventListener("change", async () => {
        const kode = inp.dataset.pendamping;
        const b = semua.find(x => x.kode_pembayaran === kode);
        const jumlah = Number(inp.value);
        if (!Number.isInteger(jumlah) || jumlah < 0) {
          inp.value = b.jumlah_pendamping; return;
        }
        try {
          await ubahPendamping(kode, jumlah);
          b.jumlah_pendamping = jumlah;
          inp.classList.add("tersimpan");
          setTimeout(() => inp.classList.remove("tersimpan"), 1200);
        } catch (err) {
          notif(err.message, true);
          inp.value = b.jumlah_pendamping;
        }
      }));

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
          kartuHtml: `<table class="tabel" style="margin-bottom:.8rem">${bernomor.map(r => html`
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

    tbody.querySelectorAll("[data-ambil]").forEach(btn =>
      btn.addEventListener("click", async () => {
        if (btn.dataset.jalan === "1") return;
        const kode = btn.dataset.ambil;
        const b = semua.find(x => x.kode_pembayaran === kode);
        btn.dataset.jalan = "1"; btn.disabled = true; btn.textContent = "Mengambil…";
        let hasil;
        try {
          hasil = await daftarUlang(kode);
        } catch (err) {
          notif(err.message, true);
          btn.dataset.jalan = ""; btn.disabled = false;
          gambar(cari, saring);
          return;
        }
        // Tempelkan nomor yang baru terbit ke data lokal.
        hasil.forEach(x => {
          const r = (b.regu || []).find(y => y.id === x.regu_id);
          if (r) { r.nomor_dada = x.nomor_dada; r.kloter_nomor = x.kloter; }
        });
        catatTerakhir("daftar-ulang", kode,
          hasil.map(x => String(x.nomor_dada).padStart(3, "0")).join(", "));
        notif(`${b.sekolah?.nama || kode}: ${hasil.length} nomor dada terbit.`);
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
  if (location.hash !== layarIni) return;   // lihat catatan di layarPembayaran

  if (!papan.length) {
    LAYAR.replaceChildren(h(`
      <div class="kartu">
        <h2>Belum ada kloter berisi regu</h2>
        <p class="keterangan">Kloter muncul di sini setelah ada sekolah yang
           daftar ulang dan menerima nomor dada.</p>
      </div>`));
    return;
  }

  // Kloter yang dibuka pertama: yang paling depan dan belum berangkat —
  // itulah yang sedang ditangani petugas garis start.
  let kloterAktif = (papan.find(k => !k.jam_berangkat) || papan[0]).nomor;

  LAYAR.replaceChildren(h(`
    <div class="kartu">
      <h2 style="font-size:1rem;color:var(--tinta-lembut)">Pilih kloter</h2>
      <div class="pita-kloter" id="pita-kloter"></div>
    </div>
    <div id="isi-kloter"></div>
  `));

  const gambarPita = () => {
    document.getElementById("pita-kloter").replaceChildren(h(papan.map(k => {
      const label = { berangkat: "berangkat", siap: "siap",
                      konfirmasi_kontrak: "kontrak", menunggu: "menunggu" }[k.posisi] || "";
      return html`
        <button type="button" class="chip-kloter ${k.posisi}"
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
    const belumKontrak = regu.filter(r => r.sudah_ceklis && r.kontrak_menit === null);

    kotak.replaceChildren(h(`
      <div class="kartu">
        <div class="kepala-kloter">
          <h2>Kloter ${kloterAktif}</h2>
          ${sudahBerangkat
            ? html`<span class="lencana lencana-hijau">BERANGKAT ${jamPendek(info.jam_berangkat)}</span>`
            : `<span class="lencana lencana-kuning">BELUM BERANGKAT</span>`}
        </div>

        <div class="tabel-bungkus" style="margin-top:.6rem">
          <table class="tabel tabel-data">
            <thead>
              <tr>
                <th class="rata-tengah">Hadir</th><th>Nomor</th><th>Regu</th>
                <th>Kontrak waktu</th>
              </tr>
            </thead>
            <tbody>
              ${regu.map(r => `
                <tr>
                  <td class="rata-tengah">
                    <input type="checkbox" class="ceklis" data-ceklis="${esc(r.nomor_dada)}"
                           ${r.sudah_ceklis ? "checked" : ""}
                           ${sudahBerangkat ? "disabled" : ""}
                           aria-label="ceklis regu ${esc(r.nomor_dada)}">
                  </td>
                  <td class="angka">${String(r.nomor_dada).padStart(3, "0")}</td>
                  <td>
                    <strong>${esc(r.nama_regu)}</strong>
                    <div class="sub">${esc(r.nama_sekolah)}${r.sisipan ? " · SISIPAN" : ""}</div>
                  </td>
                  <td>
                    <select class="pilih-kecil" data-kontrak="${esc(r.regu_id)}"
                            ${sudahBerangkat ? "disabled" : ""}>
                      <option value="">Belum dipilih</option>
                      ${opsi.map(o => `<option value="${esc(o.menit)}"
                        ${r.kontrak_menit === o.menit ? "selected" : ""}>${esc(o.label)}</option>`).join("")}
                    </select>
                  </td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>

        ${sudahBerangkat ? "" : `
          <div class="berangkat-bar">
            <div class="medan" style="margin:0">
              <label for="jam-berangkat">Jam berangkat (diketik pencatat)</label>
              <input type="time" id="jam-berangkat" step="60" value="${jamSekarangHHMM()}">
            </div>
            <button class="tombol tombol-utama" id="aksi-berangkat" type="button">
              🚩 Berangkatkan Kloter ${kloterAktif}
            </button>
          </div>
          ${belumKontrak.length ? kartuGalat(
            `${belumKontrak.length} regu sudah diceklis tapi belum punya kontrak waktu — ` +
            `pilih kontraknya dulu, kalau tidak keberangkatan akan ditolak.`) : ""}
        `}
      </div>
    `));

    kotak.querySelectorAll("[data-ceklis]").forEach(cb =>
      cb.addEventListener("change", async () => {
        const dada = Number(cb.dataset.ceklis);
        cb.disabled = true;
        try {
          if (cb.checked) await ceklisBerangkat(dada);
          else await batalCeklisBerangkat(dada);
          // Papan ikut berubah (hitungan sudah_ceklis) — muat ulang ringkas.
          papan = await papanKeberangkatan();
          gambarPita();
        } catch (err) {
          notif(err.message, true);
          cb.checked = !cb.checked;
        }
        cb.disabled = false;
      }));

    kotak.querySelectorAll("[data-kontrak]").forEach(sel =>
      sel.addEventListener("change", async () => {
        if (!sel.value) return;
        sel.disabled = true;
        try {
          await konfirmasiKontrak(sel.dataset.kontrak, Number(sel.value));
          sel.classList.add("tersimpan");
          setTimeout(() => sel.classList.remove("tersimpan"), 1200);
        } catch (err) {
          notif(err.message, true);
        }
        sel.disabled = false;
      }));

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
    LAYAR.replaceChildren(h(`<div class="kartu">
      <h2>Belum ada regu berkloter</h2>
      <p class="keterangan">Daftar kloter bisa dicetak setelah ada sekolah yang daftar ulang.</p>
    </div>`));
    return;
  }

  // Kelompokkan per kloter; pisahkan yang belum pernah dicetak.
  const perKloter = new Map();
  for (const b of baris) {
    if (!perKloter.has(b.kloter)) perKloter.set(b.kloter, { dicetak: b.dicetak_pada, isi: [] });
    perKloter.get(b.kloter).isi.push(b);
  }
  const belum = [...perKloter.entries()].filter(([, v]) => !v.dicetak).map(([k]) => k);

  LAYAR.replaceChildren(h(`
    <div class="kartu" style="border-color:var(--utama)">
      <h2>Daftar kloter untuk garis start</h2>
      <p class="keterangan">Setelah dicetak, isi kloter <strong>dibekukan</strong> —
         kertas ini yang dipakai memanggil regu, jadi sistem tidak boleh
         mengubahnya diam-diam. Sekolah yang daftar ulang setelah ini masuk
         kloter cadangan dan dicetak sebagai lembar tambahan.</p>
      <table class="tabel" style="margin-top:.6rem">
        <tr><td>Kloter berisi regu</td><td class="angka">${perKloter.size}</td></tr>
        <tr><td>Belum pernah dicetak</td><td class="angka">${belum.length}</td></tr>
        <tr><td>Total regu</td><td class="angka">${baris.length}</td></tr>
      </table>
      <div class="medan" style="margin-top:.9rem;margin-bottom:.5rem">
        <label>Kertasnya untuk siapa?</label>
        <div class="pilihan-baris">
          <button class="pilihan" data-bentuk="staging" aria-pressed="true" type="button">
            Petugas staging<br><span class="keterangan">ada kolom centang</span>
          </button>
          <button class="pilihan" data-bentuk="umum" aria-pressed="false" type="button">
            Papan &amp; barak<br><span class="keterangan">untuk dibaca peserta</span>
          </button>
        </div>
      </div>
      <div class="pilihan-baris" style="margin-top:.6rem">
        <button class="tombol tombol-utama" id="cetak-belum" type="button"
                ${belum.length ? "" : "disabled"}>
          🖨️ Cetak ${belum.length} kloter baru
        </button>
        <button class="tombol tombol-kalem" id="cetak-semua" type="button">
          Cetak ulang semua
        </button>
      </div>
    </div>
    <div id="pratayang"></div>
  `));

  let bentuk = "staging";
  LAYAR.querySelectorAll("[data-bentuk]").forEach(b => b.addEventListener("click", () => {
    bentuk = b.dataset.bentuk;
    LAYAR.querySelectorAll("[data-bentuk]").forEach(x =>
      x.setAttribute("aria-pressed", String(x === b)));
  }));

  const gambarPratayang = (nomorKloter) => {
    const dipakai = nomorKloter
      ? [...perKloter.entries()].filter(([k]) => nomorKloter.includes(k))
      : [...perKloter.entries()];
    // CATATAN: baris tabel dirakit dengan html`` (nilai di-escape), lalu
    // digabung memakai template BIASA. Menyisipkan HTML jadi ke dalam html``
    // akan meng-escape-nya dua kali dan tabelnya tampil sebagai teks mentah.
    document.getElementById("pratayang").replaceChildren(h(
      dipakai.map(([nomor, v]) => {
        const baris = v.isi.map(r => html`
          <tr><td class="angka">${String(r.nomor_dada).padStart(3, "0")}</td>
              <td><strong>${r.nama_regu}</strong></td>
              <td>${r.nama_sekolah}</td>
              <td>${GOLONGAN_LABEL[r.golongan] || r.golongan}</td></tr>`).join("");
        return `
          <div class="kartu">
            <h2>Kloter ${esc(nomor)}
              <span class="lencana ${v.dicetak ? "lencana-abu" : "lencana-kuning"}">
                ${v.dicetak ? "sudah dicetak" : "baru"}</span></h2>
            <table class="tabel">${baris}</table>
          </div>`;
      }).join("")));
    siapkanCetakKloter(dipakai, bentuk);
  };

  document.getElementById("cetak-belum").addEventListener("click", () => cetak(belum));
  document.getElementById("cetak-semua").addEventListener("click", () => cetak(null));
  gambarPratayang(null);

  async function cetak(nomorKloter) {
    gambarPratayang(nomorKloter);
    window.print();
    // Ditandai SETELAH dialog cetak ditutup — kalau operator membatalkan,
    // kloternya belum dianggap tercetak.
    const lanjut = confirm("Kertasnya sudah keluar dengan benar?\n\n" +
      "OK  = tandai kloter ini sudah dicetak (isinya dibekukan)\n" +
      "Batal = belum, biarkan bisa dicetak lagi");
    if (!lanjut) return;
    try {
      const n = await tandaiKloterDicetak(nomorKloter);
      notif(`${n} kloter ditandai sudah dicetak dan dibekukan.`);
      layarCetakKloter();
    } catch (err) { notif(err.message, true); }
  }
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
  const jam = (t) => t ? new Date(t).toLocaleTimeString("id-ID",
    { hour: "2-digit", minute: "2-digit" }) : "—";

  const halaman = dipakai.map(([nomor, v]) => {
    const contoh = v.isi[0] || {};
    const perkiraan = jam(contoh.perkiraan_berangkat);
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
      <section class="halaman-cetak">
        <h1>KLOTER ${esc(nomor)} — ${esc(EDISI ? EDISI.nama : "")}</h1>
        <p><strong>${nyata ? "Berangkat" : "Perkiraan berangkat"}: ${esc(perkiraan)}</strong>
           ${nyata ? "" : " · Jam sebenarnya: ________"} · Petugas: ________________</p>
        <table class="tabel-cetak">
          <thead><tr><th>No Dada</th><th>Nama Regu</th><th>Sekolah</th><th>Golongan</th><th>Hadir</th></tr></thead>
          <tbody>${baris}</tbody>
        </table>
        ${adaSisipan ? `<p class="catatan-sisip">★ = regu sisipan, ditambahkan setelah kertas ini dicetak.</p>` : ""}
        <p class="catatan-cetak">Centang kolom Hadir saat regu masuk staging.
           Kloter berangkat setelah semua tercentang atau diputuskan panitia.</p>
      </section>` : `
      <section class="halaman-cetak">
        <h1>KLOTER ${esc(nomor)}</h1>
        <p class="jam-besar">${nyata ? "Berangkat" : "Perkiraan berangkat"}: ${esc(perkiraan)}</p>
        <table class="tabel-cetak">
          <thead><tr><th>No Dada</th><th>Nama Regu</th><th>Sekolah</th><th>Golongan</th></tr></thead>
          <tbody>${baris}</tbody>
        </table>
        <p class="catatan-cetak">Bersiap di staging paling lambat 15 menit sebelum
           perkiraan berangkat. Jam sebenarnya bisa bergeser — ikuti panggilan petugas.</p>
        <!-- Pembina regu mencatat jam berangkat sebenarnya sebagai bahan
             klarifikasi: penalti waktu dihitung dari jam ini + kontrak waktu. -->
        <div class="kotak-pembina">
          <strong>Catatan pembina — isi saat kloter benar-benar berangkat:</strong>
          <p class="isian-jam">Jam berangkat sebenarnya: <span class="garis-isi"></span></p>
          <p class="catatan-cetak">Target kedatangan tiap regu = jam di atas + kontrak
             waktu regu itu (3,5 / 4 / 4,5 jam). Simpan lembar ini bila perlu
             mengklarifikasi penilaian ketepatan waktu.</p>
        </div>
      </section>`;
  }).join("");
  document.body.appendChild(h(`<div id="cetakan" class="cetakan">${halaman}</div>`));
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
  pasangKepala("Meja Finish");
  LAYAR.replaceChildren(h(`
    <div class="kartu" style="border-color:var(--utama)">
      <div class="medan" style="margin-bottom:0">
        <label for="dada">Ketik nomor dada</label>
        <input type="text" id="dada" class="besar" inputmode="numeric"
               autocomplete="off" placeholder="001">
      </div>
      <div id="kartu-regu" style="margin-top:.7rem"></div>
      <button class="tombol tombol-utama" id="sampai" type="button" disabled
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
        <div class="dua-kolom" style="margin-top:.5rem">
          <div class="medan" style="margin:0">
            <label for="jam">Jam datang</label>
            <input type="time" id="jam" step="60">
            <div class="bantuan">Kosong = jam saat tombol ditekan.</div>
          </div>
          <div class="medan" style="margin:0">
            <label for="hadir">Anggota hadir</label>
            <input type="number" id="hadir" min="0" max="5" inputmode="numeric" value="5">
            <div class="bantuan">Tiap orang kurang: −20 poin.</div>
          </div>
        </div>
        <div id="dampak-jam" style="margin-top:.5rem"></div>
        <p class="bantuan">Beda semenit dua menit antara catatan kertas dan tombol
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
      el.innerHTML = html`<span class="lencana lencana-abu">Penalti waktu: ${tulis(pDasar)}</span>`;
      return;
    }
    const beda = Math.round((jamIsi - dasar) / 60000);
    if (beda === 0) {
      el.innerHTML = html`<span class="lencana lencana-hijau">Sama dengan catatan — penalti ${tulis(pIsi)}</span>`;
      return;
    }
    const arah = beda > 0 ? `${beda} menit lebih lambat` : `${-beda} menit lebih awal`;
    el.innerHTML = pIsi === pDasar
      ? html`<span class="lencana lencana-hijau">${arah} — penalti tetap ${tulis(pIsi)}</span>`
      : html`<span class="lencana lencana-kuning">${arah} — penalti berubah ${tulis(pDasar)} → ${tulis(pIsi)}</span>`;
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
      ${r.sudah_finish ? `<div class="kartu" style="border-color:var(--kuning);background:var(--kuning-muda);margin-top:.5rem">
          <strong>Sudah tercatat datang ${esc(jamPendek(r.jam_datang))}.</strong>
          <div class="keterangan">Menekan tombol akan MENGGANTI jam itu.</div>
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
      inpJam.value = new Date(r.jam_datang).toTimeString().slice(0, 5);
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
      `${nama} — ${jamPendek(jam)}${hadir < 5 ? ` · ${hadir} anggota` : ""}`);
    tombol.dataset.jalan = "";
    inp.value = ""; inpJam.value = ""; inpHadir.value = "5";
    bersihkan(); inp.focus();
    gambarRiwayat();
    notif(`${String(dada).padStart(3, "0")} tercatat ${jamPendek(jam)}.`);
  });

  function gambarRiwayat() {
    const daftar = terakhir.finish || [];
    document.getElementById("riwayat-finish").replaceChildren(h(
      daftar.length ? `
        <div class="kartu">
          <h2 style="font-size:1rem;color:var(--tinta-lembut)">
            Baru saja tercatat (${daftar.length})</h2>
          <table class="tabel">${daftar.slice(0, 12).map(b => html`
            <tr><td class="angka">${b.apa}</td><td>${b.detail}</td></tr>`).join("")}
          </table>
        </div>` : `<p class="keterangan" style="text-align:center;margin-top:1rem">
            Ketik nomor dada regu yang baru sampai.</p>`));
  }
}

const jamPendek = (t) => t
  ? new Date(t).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
  : "—";

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
    : `<span class="lencana ${Math.abs(selisih) < 10 ? "lencana-hijau" : "lencana-kuning"}">
         ${selisih > 0 ? `+${selisih}` : selisih} menit dari target</span>`;
  return `
    <div class="kartu kartu-identitas" style="margin:0">
      ${html`<div class="nama">${String(r.nomor_dada).padStart(3, "0")} · ${r.nama_regu}</div>
      <div class="detail">${r.nama_sekolah} · ${GOLONGAN_LABEL[r.golongan] || r.golongan}</div>
      <div class="detail">Kloter ${r.kloter} · berangkat ${jamPendek(r.jam_berangkat)}${
        r.target_datang ? ` · target ${jamPendek(r.target_datang)}` : ""}</div>`}
      <div style="margin-top:.4rem">${tandaWaktu}
        ${r.sisipan ? `<span class="lencana lencana-merah">sisipan</span>` : ""}</div>
    </div>`;
}

/* ============================ PINDAH KLOTER (HARI-H) ===================== */

async function layarPindahKloter() {
  pasangKepala("Pindah Kloter");
  LAYAR.replaceChildren(h(`<p>Memuat…</p>`));

  let sisipan = [];
  try { sisipan = await daftarSisipan(); } catch { /* daftar boleh telat */ }

  LAYAR.replaceChildren(h(`
    ${sisipan.length ? kartuSisipan(sisipan) : ""}
    <div class="kartu">
      <div class="medan" style="margin-bottom:0">
        <label for="dada">Nomor dada yang mau dipindah</label>
        <input type="text" id="dada" class="besar" inputmode="numeric"
               autocomplete="off" placeholder="001">
      </div>
      <button class="tombol tombol-utama" id="cari" type="button" style="margin-top:.8rem">
        Cari
      </button>
    </div>
    <div id="hasil"></div>
  `));
  const inp = document.getElementById("dada");
  inp.focus();

  const cari = async () => {
    const dada = Number(inp.value.trim());
    const kotak = document.getElementById("hasil");
    if (!dada) { inp.focus(); return; }
    kotak.replaceChildren(h(`<p>Mencari nomor ${esc(dada)}…</p>`));
    let semua;
    try { semua = await daftarKloter(); }
    catch (e) { kotak.replaceChildren(h(kartuGalat(e.message))); return; }

    const r = semua.find(x => x.nomor_dada === dada);
    if (!r) {
      kotak.replaceChildren(h(kartuGalat(
        `Nomor dada ${dada} belum punya kloter — mungkin belum daftar ulang.`)));
      inp.select();
      return;
    }
    if (r.sudah_berangkat) {
      kotak.replaceChildren(h(kartuBatchRingkas(r) +
        kartuGalat(`Kloter ${r.kloter} sudah berangkat — regu ini tidak bisa dipindah lagi.`)));
      return;
    }

    // Kloter tujuan yang masih mungkin, dikelompokkan supaya operator paham
    // konsekuensinya sebelum memilih.
    const isiPerKloter = new Map();
    for (const x of semua) isiPerKloter.set(x.kloter, (isiPerKloter.get(x.kloter) || 0) + 1);
    const belumBerangkat = [...new Set(semua.filter(x => !x.sudah_berangkat).map(x => x.kloter))];
    const terakhir = Math.max(...belumBerangkat);

    kotak.replaceChildren(h(`
      ${kartuBatchRingkas(r)}
      <div class="kartu" style="border-color:var(--utama)">
        <h2>Mau dipindah ke mana?</h2>
        <button class="tombol tombol-utama" id="ke-terakhir" type="button" style="margin-top:.6rem">
          Kloter terakhir (${terakhir}) — telat biasa
        </button>
        <p class="keterangan" style="margin-top:.5rem">Pilihan biasa untuk peserta
           yang terlambat masuk kloternya.</p>
        <hr style="margin:1rem 0;border:0;border-top:1px solid var(--garis)">
        <div class="medan" style="margin-bottom:.5rem">
          <label for="tujuan">Atau paksa ke kloter tertentu (urgent)</label>
          <input type="number" id="tujuan" inputmode="numeric" min="1" max="40"
                 placeholder="nomor kloter">
          <div class="bantuan">Bisa ke kloter yang kertasnya sudah beredar —
             sistem akan memberi peringatan untuk dibacakan ke petugas staging.</div>
        </div>
        <button class="tombol tombol-kalem" id="ke-tujuan" type="button">
          Pindahkan ke kloter itu
        </button>
      </div>
    `));

    const jalankan = async (kloterTujuan) => {
      const jawab = await dialog({
        judul: kloterTujuan ? `Pindahkan ke kloter ${kloterTujuan}?` : "Pindahkan ke kloter terakhir?",
        kartuHtml: kartuBatchRingkas(r),
        medan: [{ label: "Alasan pemindahan",
                  contoh: kloterTujuan ? "peserta urgent" : "terlambat masuk kloter",
                  bantuan: "Wajib diisi — tercatat di riwayat." }],
        labelAksi: "Pindahkan",
      });
      if (!jawab) return;
      try {
        const hasil = await pindahKloter(dada, jawab[0], kloterTujuan);
        layarPindahKloter();
        // Peringatan sisipan TIDAK boleh berupa toast yang hilang sendiri:
        // petugas staging memegang kertas yang tidak memuat nomor ini.
        setTimeout(() => {
          if (hasil.peringatan) {
            LAYAR.prepend(h(html`
              <div class="kartu" style="border:3px solid var(--bahaya);background:var(--bahaya-muda)">
                <h2 style="color:var(--bahaya)">⚠️ Bacakan ke petugas staging</h2>
                <p style="font-size:1.1rem;margin-top:.4rem">${hasil.peringatan}</p>
              </div>`));
          } else {
            notif(`Nomor ${dada} pindah dari kloter ${hasil.kloter_lama} ke ${hasil.kloter_baru}.`);
          }
        }, 100);
      } catch (err) { notif(err.message, true); }
    };

    document.getElementById("ke-terakhir").addEventListener("click", () => jalankan(null));
    document.getElementById("ke-tujuan").addEventListener("click", () => {
      const t = Number(document.getElementById("tujuan").value);
      if (!t) { notif("Isi nomor kloter tujuannya dulu.", true); return; }
      jalankan(t);
    });
  };
  document.getElementById("cari").addEventListener("click", cari);
  inp.addEventListener("keydown", e => { if (e.key === "Enter") cari(); });
}

function kartuBatchRingkas(r) {
  return html`
    <div class="kartu kartu-identitas">
      <div class="nama">${String(r.nomor_dada).padStart(3, "0")} · ${r.nama_regu}</div>
      <div class="detail">${r.nama_sekolah} · ${GOLONGAN_LABEL[r.golongan] || r.golongan}</div>
      <div class="detail">Sekarang di <strong>Kloter ${r.kloter}</strong>${
        r.sisipan ? " (sisipan)" : ""}</div>
    </div>`;
}

/** Daftar sisipan: nomor-nomor yang TIDAK ADA di kertas petugas staging.
 *  Ditaruh paling atas dan diberi bingkai merah — ini satu-satunya cara
 *  petugas tahu ada regu tambahan di kloternya. */
function kartuSisipan(sisipan) {
  const aktif = sisipan.filter(s => !s.sudah_berangkat);
  if (!aktif.length) return "";
  const baris = aktif.map(s => html`
    <tr><td class="angka">${String(s.nomor_dada).padStart(3, "0")}</td>
        <td><strong>${s.nama_regu}</strong><br>
            <span class="keterangan">${s.nama_sekolah}</span></td>
        <td><span class="lencana lencana-merah">Kloter ${s.kloter}</span></td>
        <td class="keterangan">${s.alasan_sisip}</td></tr>`).join("");
  return `
    <div class="kartu" style="border:3px solid var(--bahaya);background:var(--bahaya-muda)">
      <h2 style="color:var(--bahaya)">⚠️ ${aktif.length} regu TIDAK ADA di kertas</h2>
      <p class="keterangan">Nomor-nomor ini disisipkan setelah daftar kloter dicetak.
         Bacakan ke petugas staging kloter terkait, atau tulis tangan di kertasnya.</p>
      <table class="tabel" style="background:#fff;border-radius:8px;margin-top:.6rem">${baris}</table>
      <button class="tombol tombol-kalem" onclick="window.print()" type="button"
              style="margin-top:.6rem">🖨️ Cetak daftar sisipan</button>
    </div>`;
}

/* ============================ PENDAFTARAN OFFLINE ======================== */

function layarPendaftaranOffline() {
  pasangKepala("Pendaftaran");
  LAYAR.replaceChildren(h(`
    <div class="kartu">
      <h2>Link yang sama untuk online maupun langsung</h2>
      <p class="keterangan" style="margin-top:.4rem">
        Bukakan form ini di HP pendaftar, atau isikan bersama di laptop meja.
        Setelah dapat kode pembayaran, arahkan ke meja pembayaran.</p>
      <a class="tombol tombol-utama" href="daftar.html" target="_blank" rel="noopener"
         style="text-decoration:none;margin-top:.8rem">Buka Form Pendaftaran</a>
    </div>
  `));
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
  "#/beranda": layarBeranda,
  "#/pembayaran": layarPembayaran,
  "#/daftar-ulang": layarDaftarUlang,
  "#/pendaftaran-offline": layarPendaftaranOffline,
  "#/cetak-kloter": layarCetakKloter,
  "#/keberangkatan": layarKeberangkatan,
  "#/pindah-kloter": layarPindahKloter,
  "#/finish": layarFinish,
};

async function arahkan() {
  if (!sesi()) { layarLogin(); return; }
  if (!EDISI) {
    try { EDISI = await infoEdisi(); }
    catch (e) { layarButuhEdisi("HRCD Rekap"); return; }
  }
  (RUTE[location.hash] || layarBeranda)();
}

document.getElementById("btn-keluar").addEventListener("click", () => {
  keluar(); EDISI = null; location.hash = ""; arahkan();
});
document.getElementById("ganti-fungsi").addEventListener("click", () => {
  if (location.hash === "#/beranda") arahkan(); else location.hash = "#/beranda";
});
window.addEventListener("hashchange", arahkan);
arahkan();
