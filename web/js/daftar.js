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

import { daftarSekolah, kirimPendaftaran, infoEdisi, ErrorApi } from "./api.js";
import { esc, h, html, rupiah, notif, kartuGagalMuat } from "./util.js";

const LAYAR = document.getElementById("layar");
const GOLONGAN = [
  { kode: "penggalang_pa", label: "Penggalang Putra", ket: "SMP / MTs — putra" },
  { kode: "penggalang_pi", label: "Penggalang Putri", ket: "SMP / MTs — putri" },
  { kode: "penegak_pa",    label: "Penegak Putra",    ket: "SMA / SMK / MA — putra" },
  { kode: "penegak_pi",    label: "Penegak Putri",    ket: "SMA / SMK / MA — putri" },
];
const KUNCI_DRAF = "hrcd_draf";
const KUNCI_HASIL = "hrcd_hasil";
const MAKS_REGU = 30;

const kosong = () => ({
  sekolah: null,                 // {id?, nama, alamat}
  butuh_barak: null,
  jumlah_pendamping: 0,
  rincian: { penggalang_pa: 0, penggalang_pi: 0, penegak_pa: 0, penegak_pi: 0 },
  regu: [],                      // [{golongan, nama_regu, nama_ketua}]
  kontak_wa: "",
  kunci_kirim: (crypto.randomUUID ? crypto.randomUUID()
                : String(Date.now()) + Math.random().toString(16).slice(2)),
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
const normal = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const labelGolongan = k => GOLONGAN.find(g => g.kode === k).label;

/* ============================ RANGKA HALAMAN ============================= */

function halaman() {
  LAYAR.replaceChildren(h(`
    <div class="kartu" style="border-color:var(--utama)">
      <h2>Pendaftaran Regu</h2>
    </div>

    <!-- 1. Sekolah -->
    <section class="kartu" id="bagian-sekolah">
      <h2><span class="nomor-bagian">1</span> Asal sekolah</h2>
      <div id="isi-sekolah"></div>
    </section>

    <!-- 2. Menginap -->
    <section class="kartu" id="bagian-barak">
      <h2><span class="nomor-bagian">2</span> Perlu tempat menginap?</h2>
      <p class="keterangan">Panitia menyediakan ruang kelas untuk menginap malam
         sebelum lomba, gratis.</p>
      <div class="pilihan-baris" style="margin-top:.8rem">
        <button class="pilihan" id="p-ya" aria-pressed="false" type="button">Ya, perlu</button>
        <button class="pilihan" id="p-tidak" aria-pressed="false" type="button">Tidak perlu</button>
      </div>
      <div id="isi-pendamping" style="margin-top:.9rem"></div>
      <div class="galat" id="g-barak" hidden>Pilih salah satu.</div>
    </section>

    <!-- 3. Jumlah regu -->
    <section class="kartu" id="bagian-jumlah">
      <h2><span class="nomor-bagian">3</span> Mendaftarkan berapa regu?</h2>
      <p class="keterangan">1 regu = 5 orang. Tekan + untuk menambah regu di
         golongan yang sesuai; kotak isian namanya muncul di bawah.</p>
      <div id="isi-stepper" style="margin-top:.9rem"></div>
      <div class="kotak-total" id="kotak-total"></div>
      <div class="galat" id="g-jumlah" hidden>Tambahkan minimal satu regu.</div>
    </section>

    <!-- 4. Nama regu -->
    <section class="kartu" id="bagian-regu">
      <h2><span class="nomor-bagian">4</span> Nama tiap regu</h2>
      <div id="isi-regu"></div>
    </section>

    <!-- 5. Kontak -->
    <section class="kartu" id="bagian-kontak">
      <h2><span class="nomor-bagian">5</span> Nomor WhatsApp yang bisa dihubungi</h2>
      <p class="keterangan">Satu nomor untuk semua regu — panitia menghubungi lewat sini.</p>
      <div class="medan" style="margin-top:.7rem">
        <label for="wa" class="visually-hidden">Nomor WA</label>
        <input type="tel" id="wa" inputmode="numeric" placeholder="contoh: 08123456789">
        <div class="galat" id="g-wa" hidden>Isi nomor WA yang benar — diawali 08, bukan +62.</div>
      </div>
    </section>

    <div id="turnstile-kotak"></div>
    <div id="ringkas-galat"></div>

    <div class="kirim-bar">
      <div class="kirim-isi">
        <div class="kirim-info" id="kirim-info"></div>
        <button class="tombol tombol-utama" id="kirim" type="button">Kirim Pendaftaran</button>
      </div>
    </div>
  `));

  gambarSekolah();
  gambarBarak();
  gambarStepper();
  gambarRegu();
  document.getElementById("wa").value = jawab.kontak_wa;
  document.getElementById("wa").addEventListener("input", e => {
    jawab.kontak_wa = e.target.value; simpanDraf();
    if (sudahDiperiksa) periksa(false);
  });

  document.getElementById("kirim").addEventListener("click", kirim);
  pasangTurnstile();
  perbaruiTotal();
}

/* ---------------- 1. sekolah ---------------- */

function gambarSekolah() {
  const kotak = document.getElementById("isi-sekolah");
  if (jawab.sekolah) {
    kotak.replaceChildren(h(html`
      <div class="kartu kartu-identitas" style="margin:0">
        <div class="nama">${jawab.sekolah.nama}</div>
        <div class="detail">📍 ${jawab.sekolah.alamat}</div>
      </div>`));
    kotak.appendChild(h(`
      <button class="tombol tombol-kalem tombol-kecil" id="ganti-sekolah" type="button"
              style="margin-top:.6rem">Ganti sekolah</button>`));
    document.getElementById("ganti-sekolah").addEventListener("click", () => {
      jawab.sekolah = null; simpanDraf(); gambarSekolah();
    });
    return;
  }

  kotak.replaceChildren(h(`
    <div class="medan" style="margin-bottom:.4rem">
      <label for="cari">Ketik nama sekolahmu</label>
      <input type="text" id="cari" autocomplete="off" placeholder="contoh: SMPN 1 Ciamis">
      <div class="bantuan">Kalau muncul di daftar, tinggal pilih. Kalau tidak ada,
         isi alamatnya sendiri.</div>
      <div class="saran" id="saran" hidden></div>
    </div>
    <div id="manual"></div>
    <div class="galat" id="g-sekolah" hidden>Pilih atau isi sekolahmu dulu.</div>
  `));

  const cari = document.getElementById("cari");
  const saran = document.getElementById("saran");

  cari.addEventListener("input", () => {
    const q = normal(cari.value.trim());
    if (q.length < 2) { saran.hidden = true; return; }
    const cocok = SEKOLAH.filter(s => normal(s.nama).includes(q)).slice(0, 6);
    saran.hidden = cocok.length === 0;
    saran.replaceChildren(...cocok.map(s => {
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = html`<strong>${s.nama}</strong><span class="alamat">${s.alamat}</span>`;
      b.addEventListener("click", () => pilih(s));
      return b;
    }));
    gambarManual();
  });
  cari.addEventListener("blur", () => setTimeout(() => { saran.hidden = true; }, 200));

  function pilih(s) {
    jawab.sekolah = { id: s.id, nama: s.nama, alamat: s.alamat };
    simpanDraf(); gambarSekolah();
    if (sudahDiperiksa) periksa(false);
  }

  /** Isian manual muncul menempel di bawah kotak cari — tidak perlu menekan
   *  tombol "sekolahku tidak ada" dulu (dulu itu jalan buntu). */
  function gambarManual() {
    const teks = cari.value.trim();
    if (teks.length < 3) { document.getElementById("manual").replaceChildren(); return; }
    if (SEKOLAH.some(s => normal(s.nama) === normal(teks))) {
      document.getElementById("manual").replaceChildren(); return;
    }
    if (document.getElementById("m-alamat")) return;    // sudah tergambar
    document.getElementById("manual").replaceChildren(h(`
      <div class="kartu" style="margin:.6rem 0 0;border-color:var(--utama)">
        <p style="font-weight:700">Sekolahmu belum ada di daftar?</p>
        <p class="keterangan">Isi alamatnya, lalu tekan Pakai sekolah ini.</p>
        <div class="medan" style="margin-top:.6rem">
          <label for="m-alamat">Alamat sekolah (jalan + kota)</label>
          <input type="text" id="m-alamat"
                 placeholder="contoh: Jl. Raya Banjar No. 2, Kota Banjar">
        </div>
        <button class="tombol tombol-utama" id="pakai" type="button">Pakai sekolah ini</button>
      </div>`));
    document.getElementById("pakai").addEventListener("click", () => {
      const nama = cari.value.trim();
      const alamat = document.getElementById("m-alamat").value.trim();
      if (!nama) { cari.focus(); return; }
      if (!alamat) {
        notif("Isi alamat sekolahnya — untuk membedakan sekolah bernama sama.", true);
        document.getElementById("m-alamat").focus();
        return;
      }
      pilih({ nama, alamat });
    });
  }
}

/* ---------------- 2. barak ---------------- */

function gambarBarak() {
  const set = (ya) => {
    jawab.butuh_barak = ya;
    document.getElementById("p-ya").setAttribute("aria-pressed", String(ya));
    document.getElementById("p-tidak").setAttribute("aria-pressed", String(!ya));
    const kotak = document.getElementById("isi-pendamping");
    if (ya) {
      kotak.replaceChildren(h(html`
        <div class="medan" style="margin:0">
          <label for="n-pendamping">Berapa pendamping (pembina/guru) yang ikut menginap?</label>
          <input type="number" id="n-pendamping" min="0" max="30" inputmode="numeric"
                 value="${jawab.jumlah_pendamping}">
          <div class="bantuan">Boleh 0 kalau belum tahu — bisa diubah saat daftar ulang.</div>
        </div>`));
      document.getElementById("n-pendamping").addEventListener("input", e => {
        jawab.jumlah_pendamping = Math.max(0, Number(e.target.value) || 0); simpanDraf();
      });
    } else {
      kotak.replaceChildren();
      jawab.jumlah_pendamping = 0;
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
    GOLONGAN.map(g => `
      <div class="baris-stepper">
        <div>
          <strong style="font-size:1.05rem">${g.label}</strong>
          <div class="bantuan">${g.ket}</div>
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
  for (const g of GOLONGAN) {
    const bekas = lama.filter(r => r.golongan === g.kode);
    for (let i = 0; i < jawab.rincian[g.kode]; i++)
      jawab.regu.push(bekas[i] ?? { golongan: g.kode, nama_regu: "", nama_ketua: "" });
  }
  simpanDraf();
}

function perbaruiTotal() {
  const total = jawab.regu.length;
  document.getElementById("kotak-total").innerHTML = total
    ? html`<strong>Total: ${total} regu</strong>
           <div class="keterangan">Biaya: ${total} × ${rupiah(EDISI.biaya_per_regu)}
           = <strong>${rupiah(total * EDISI.biaya_per_regu)}</strong></div>`
    : `<span class="keterangan">Belum ada regu yang ditambahkan.</span>`;
  document.getElementById("kirim-info").innerHTML = total
    ? html`${total} regu · ${rupiah(total * EDISI.biaya_per_regu)}`
    : `<span class="keterangan">Belum ada regu</span>`;
  if (sudahDiperiksa) periksa(false);
}

/* ---------------- 4. nama regu ---------------- */

function gambarRegu() {
  const kotak = document.getElementById("isi-regu");
  if (!jawab.regu.length) {
    kotak.replaceChildren(h(`<p class="keterangan">
      Kotak isian nama muncul di sini setelah kamu menambah regu di bagian 3.</p>`));
    return;
  }
  kotak.replaceChildren(h(jawab.regu.map((r, i) => html`
    <div class="kartu-regu" id="regu-${i}">
      <span class="lencana lencana-hijau">Regu ${i + 1} — ${labelGolongan(r.golongan)}</span>
      <div class="dua-kolom">
        <div class="medan" style="margin:0">
          <label for="r-nama-${i}">Nama regu</label>
          <input type="text" id="r-nama-${i}" value="${r.nama_regu}" placeholder="contoh: Rajawali">
        </div>
        <div class="medan" style="margin:0">
          <label for="r-ketua-${i}">Nama ketua</label>
          <input type="text" id="r-ketua-${i}" value="${r.nama_ketua}" placeholder="contoh: Andi Saputra">
        </div>
      </div>
    </div>`).join("")));

  jawab.regu.forEach((r, i) => {
    document.getElementById(`r-nama-${i}`).addEventListener("input", e => {
      r.nama_regu = e.target.value.trim(); simpanDraf();
      if (sudahDiperiksa) periksa(false);
    });
    document.getElementById(`r-ketua-${i}`).addEventListener("input", e => {
      r.nama_ketua = e.target.value.trim(); simpanDraf();
      if (sudahDiperiksa) periksa(false);
    });
  });
}

/* ---------------- pemeriksaan: SEMUA galat sekaligus ---------------- */

function periksa(gulir = true) {
  sudahDiperiksa = true;
  const galat = [];

  const tandai = (id, ada) => { const e = document.getElementById(id); if (e) e.hidden = !ada; };

  if (!jawab.sekolah) { galat.push({ ke: "bagian-sekolah", teks: "Sekolah belum dipilih" }); }
  tandai("g-sekolah", !jawab.sekolah);

  if (jawab.butuh_barak === null) { galat.push({ ke: "bagian-barak", teks: "Belum menjawab soal menginap" }); }
  tandai("g-barak", jawab.butuh_barak === null);

  if (!jawab.regu.length) { galat.push({ ke: "bagian-jumlah", teks: "Belum ada regu" }); }
  tandai("g-jumlah", !jawab.regu.length);

  jawab.regu.forEach((r, i) => {
    const kurang = !r.nama_regu || !r.nama_ketua;
    const el = document.getElementById(`regu-${i}`);
    if (el) el.classList.toggle("kartu-regu-galat", kurang);
    if (kurang) galat.push({ ke: `regu-${i}`, teks: `Regu ${i + 1} belum lengkap` });
  });

  // Format nomor Indonesia, HANYA 08xx (bukan +62 8xx — disederhanakan
  // sengaja supaya panitia tidak perlu mikir dua format): 08, lalu kode
  // operator (1-9, bukan 0), lalu 6-10 digit lagi.
  const digitWa = jawab.kontak_wa.replace(/\D/g, "");
  const waSah = /^08[1-9][0-9]{6,10}$/.test(digitWa);
  if (!waSah) galat.push({ ke: "bagian-kontak", teks: "Nomor WA belum sesuai format Indonesia" });
  tandai("g-wa", !waSah);

  // Ringkasan galat: satu tempat, bisa diketuk untuk lompat ke isiannya.
  const ringkas = document.getElementById("ringkas-galat");
  if (!galat.length) { ringkas.replaceChildren(); return true; }
  ringkas.replaceChildren(h(`
    <div class="kartu" style="border-color:var(--bahaya);background:var(--bahaya-muda)">
      <strong>Masih ada ${galat.length} isian yang perlu dilengkapi:</strong>
      <ul class="daftar-galat">
        ${galat.map(g => html`<li><button type="button" data-ke="${g.ke}">${g.teks}</button></li>`).join("")}
      </ul>
    </div>`));
  ringkas.querySelectorAll("[data-ke]").forEach(b => b.addEventListener("click", () => {
    const t = document.getElementById(b.dataset.ke);
    t.scrollIntoView({ block: "center", behavior: "smooth" });
    const inp = t.querySelector("input, button.pilihan");
    if (inp) setTimeout(() => inp.focus(), 350);
  }));
  if (gulir) ringkas.scrollIntoView({ block: "center", behavior: "smooth" });
  return false;
}

/* ---------------- Turnstile (hanya mode produksi) ---------------- */

function pasangTurnstile() {
  if (!(window.HRCD.mode === "supabase" && window.HRCD.turnstileSiteKey)) return;
  document.getElementById("turnstile-kotak").replaceChildren(h(`
    <div class="kartu"><div id="turnstile"></div>
      <p class="keterangan">Centang kotak di atas dulu (bukti kamu bukan robot).</p></div>`));
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
      jumlah_pendamping: jawab.jumlah_pendamping,
      kontak_wa: jawab.kontak_wa,
      regu: jawab.regu,
      kunci_kirim: jawab.kunci_kirim,     // sama saat mencoba lagi
    }, tokenTurnstile);
    sessionStorage.setItem("hrcd_selesai", "1");
    try { localStorage.setItem(KUNCI_HASIL, JSON.stringify(hasil)); } catch {}
    hapusDraf();
    sukses(hasil);
  } catch (err) {
    btn.dataset.jalan = ""; btn.disabled = false; btn.textContent = "Kirim Pendaftaran";
    document.getElementById("ringkas-galat").replaceChildren(h(html`
      <div class="kartu" style="border-color:var(--bahaya);background:var(--bahaya-muda)">
        <strong>Belum terkirim.</strong>
        ${err instanceof ErrorApi ? err.message : "Coba lagi ya."}
        <div class="keterangan" style="margin-top:.3rem">Isianmu tersimpan — tekan
          "Kirim Pendaftaran" sekali lagi.</div>
      </div>`));
    document.getElementById("ringkas-galat").scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

/* ---------------- sukses ---------------- */

function sukses(hasil) {
  LAYAR.replaceChildren(h(html`
    <div class="kartu" style="border-color:var(--hijau);background:var(--hijau-muda)">
      <h2>✅ Pendaftaran diterima!</h2>
      <p>Ini <strong>kode pembayaran</strong>-mu. Simpan baik-baik — kode ini dipakai
         saat membayar dan saat daftar ulang.</p>
      <div class="angka-raksasa" style="margin:1rem 0">${hasil.kode_pembayaran}</div>
      <button class="tombol tombol-kalem" id="salin" type="button">📋 Salin kode</button>
    </div>
    <div class="kartu">
      <h2 style="font-size:1.1rem">Cara membayar</h2>
      <p style="margin-top:.4rem">Transfer <strong>${rupiah(hasil.total_tagihan)}</strong>
         ke rekening panitia (tertera di poster/brosur), tulis kode
         <strong>${hasil.kode_pembayaran}</strong> di berita transfer —
         atau bayar tunai di meja pendaftaran.</p>
      <p class="keterangan" style="margin-top:.6rem">Setelah panitia memeriksa
         pembayaran, semua regumu (${hasil.jumlah_regu} regu) resmi terdaftar.</p>
    </div>
    <a class="tombol tombol-utama" style="text-decoration:none"
       href="https://wa.me/?text=${encodeURIComponent(
         `Kode pembayaran HRCD: ${hasil.kode_pembayaran} (${hasil.jumlah_regu} regu, total ${rupiah(hasil.total_tagihan)})`)}">
       Kirim kode ke WhatsApp
    </a>
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
}

/* ---------------- mulai ---------------- */

async function mulai() {
  LAYAR.replaceChildren(h(`<p>Memuat…</p>`));
  try {
    [SEKOLAH, EDISI] = await Promise.all([daftarSekolah(), infoEdisi()]);
  } catch (e) {
    LAYAR.replaceChildren(kartuGagalMuat(e.message, mulai));
    return;
  }
  document.getElementById("label-edisi").textContent = EDISI.nama;

  let hasilLama = null, draf = null;
  try { hasilLama = JSON.parse(localStorage.getItem(KUNCI_HASIL) || "null"); } catch {}
  try { draf = JSON.parse(localStorage.getItem(KUNCI_DRAF) || "null"); } catch {}

  if (hasilLama && !draf) {
    LAYAR.replaceChildren(h(html`
      <div class="kartu" style="border-color:var(--hijau);background:var(--hijau-muda)">
        <h2>Pendaftaran terakhirmu</h2>
        <p>Kode pembayaran:</p>
        <div class="angka-raksasa" style="margin:.6rem 0">${hasilLama.kode_pembayaran}</div>
        <p class="keterangan">${hasilLama.jumlah_regu} regu · ${rupiah(hasilLama.total_tagihan)}</p>
      </div>
      <button class="tombol tombol-kalem" id="baru" type="button">Daftarkan sekolah lain</button>`));
    document.getElementById("baru").addEventListener("click", () => {
      try { localStorage.removeItem(KUNCI_HASIL); } catch {}
      sessionStorage.removeItem("hrcd_selesai");
      jawab = kosong(); halaman();
    });
    return;
  }

  if (draf && (draf.sekolah || draf.regu?.length)) jawab = { ...kosong(), ...draf };
  halaman();
}

mulai();
