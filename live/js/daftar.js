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

import { daftarSekolah, kirimPendaftaran, infoEdisi, namaReguDipakai, ErrorApi } from "./api.js";
import { esc, h, html, rupiah, notif, kartuGagalMuat,
         pemuat } from "./util.js";

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

// Format nomor Indonesia, HANYA 08xx (bukan +62 8xx — disederhanakan sengaja
// supaya panitia tidak perlu mikir dua format): 08, lalu kode operator
// (1-9, bukan 0), lalu 6-10 digit lagi. Dipakai untuk validasi live (saat
// mengetik) maupun pemeriksaan akhir sebelum kirim — satu pola, satu tempat.
const POLA_WA = /^08[1-9][0-9]{6,10}$/;

const kosong = () => ({
  sekolah: null,                 // {id?, nama, alamat}
  butuh_barak: null,
  jumlah_pendamping: 0,
  rincian: { penggalang_pa: 0, penggalang_pi: 0, penegak_pa: 0, penegak_pi: 0 },
  regu: [],                      // [{golongan, nama_regu, nama_ketua}]
  kontak_wa: "",
  nama_kontak: "",
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

/* Jawaban server, diingat per nama supaya satu nama tidak ditanyakan berkali
   -kali sementara pembina masih mengetik nama berikutnya. */
const namaTerpakai = new Map();
let jamPeriksaNama = null;

/* ============================ RANGKA HALAMAN ============================= */

function halaman() {
  LAYAR.replaceChildren(h(`
    <!-- 1. Sekolah -->
    <section class="card" id="bagian-sekolah">
      <h2><span class="section-number">1</span> Asal sekolah</h2>
      <div id="isi-sekolah"></div>
    </section>

    <!-- 2. Menginap -->
    <section class="card" id="bagian-barak">
      <h2><span class="section-number">2</span> Perlu tempat menginap?</h2>
      <p class="description">Panitia menyediakan ruang kelas untuk menginap malam
         sebelum lomba, gratis.</p>
      <div class="option-row" style="margin-top:.8rem">
        <button class="option" id="p-ya" aria-pressed="false" type="button">Ya, perlu</button>
        <button class="option" id="p-tidak" aria-pressed="false" type="button">Tidak perlu</button>
      </div>
      <div id="isi-pendamping" style="margin-top:.9rem"></div>
      <div class="error" id="g-barak" hidden>Pilih salah satu.</div>
    </section>

    <!-- 3. Jumlah regu -->
    <section class="card" id="bagian-jumlah">
      <h2><span class="section-number">3</span> Mendaftarkan berapa regu?</h2>
      <p class="description">1 regu = 5 orang.</p>
      <div id="isi-stepper" style="margin-top:.9rem"></div>
      <div class="total-box" id="kotak-total"></div>
      <div class="error" id="g-jumlah" hidden>Tambahkan minimal satu regu.</div>
    </section>

    <!-- 4. Nama regu -->
    <section class="card" id="bagian-regu">
      <h2><span class="section-number">4</span> Nama tiap regu</h2>
      <div id="isi-regu"></div>
    </section>

    <!-- 5. Kontak -->
    <section class="card" id="bagian-kontak">
      <h2><span class="section-number">5</span> Contact Person</h2>
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

    <div id="turnstile-kotak"></div>
    <div id="ringkas-galat"></div>

    <div class="send-bar">
      <div class="send-content">
        <div class="send-info" id="kirim-info"></div>
        <button class="button button-primary" id="kirim" type="button">Kirim Pendaftaran</button>
      </div>
    </div>
  `));

  gambarSekolah();
  gambarBarak();
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

  document.getElementById("kirim").addEventListener("click", kirim);
  pasangTurnstile();
  perbaruiTotal();
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
    const q = normal(cari.value.trim());
    if (q.length < 2) { saran.hidden = true; return; }
    const cocok = SEKOLAH.filter(s => normal(s.name).includes(q)).slice(0, 6);
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
    if (SEKOLAH.some(s => normal(s.name) === normal(teks))) {
      document.getElementById("manual").replaceChildren(); return;
    }
    if (document.getElementById("m-alamat")) return;    // sudah tergambar
    document.getElementById("manual").replaceChildren(h(`
      <div class="card" style="margin:.6rem 0 0;border-color:var(--utama)">
        <p style="font-weight:700">Sekolahmu belum ada di daftar?</p>
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
        <div class="field" style="margin:0">
          <label for="n-pendamping">Berapa pendamping (pembina/guru) yang ikut menginap?</label>
          <input type="number" id="n-pendamping" min="0" max="30" inputmode="numeric"
                 value="${jawab.jumlah_pendamping}">
          <div class="hint">Boleh 0 kalau belum tahu — bisa diubah saat daftar ulang.</div>
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
      <div class="stepper-row">
        <div>
          <strong style="font-size:1.05rem">${g.label}</strong>
          <div class="hint">${g.ket}</div>
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
           <div class="description">Biaya: ${total} × ${rupiah(EDISI.biaya_per_regu)}
           = <strong>${rupiah(total * EDISI.biaya_per_regu)}</strong></div>`
    : `<span class="description">Belum ada regu yang ditambahkan.</span>`;
  document.getElementById("kirim-info").innerHTML = total
    ? html`${total} regu · ${rupiah(total * EDISI.biaya_per_regu)}`
    : `<span class="description">Belum ada regu</span>`;
  if (sudahDiperiksa) periksa(false);
}

/* ---------------- 4. nama regu ---------------- */

function gambarRegu() {
  const kotak = document.getElementById("isi-regu");
  if (!jawab.regu.length) {
    kotak.replaceChildren(h(`<p class="description">Belum ada regu.</p>`));
    return;
  }
  kotak.replaceChildren(h(jawab.regu.map((r, i) => html`
    <div class="regu-card" id="regu-${i}">
      <span class="badge badge-green">Regu ${i + 1} — ${labelGolongan(r.golongan)}</span>
      <div class="two-column">
        <div class="field" style="margin:0">
          <label for="r-nama-${i}">Nama regu</label>
          <input type="text" id="r-nama-${i}" value="${r.nama_regu}"
                 maxlength="${NAMA_MAKS}" placeholder="contoh: Rajawali">
          <div class="error" id="r-nama-galat-${i}" hidden>Nama regu wajib diisi.</div>
        </div>
        <div class="field" style="margin:0">
          <label for="r-ketua-${i}">Nama ketua</label>
          <input type="text" id="r-ketua-${i}" value="${r.nama_ketua}" placeholder="contoh: Andi Saputra">
          <div class="error" id="r-ketua-galat-${i}" hidden>Nama ketua wajib diisi.</div>
        </div>
      </div>
    </div>`).join("")));

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
    document.getElementById(`regu-${i}`).classList.toggle("regu-card-error", !!salahNama || ketuaKosong);
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

  if (!jawab.sekolah) { galat.push({ ke: "bagian-sekolah", teks: "Sekolah belum dipilih" }); }
  tandai("g-sekolah", !jawab.sekolah);

  if (jawab.butuh_barak === null) { galat.push({ ke: "bagian-barak", teks: "Belum menjawab soal menginap" }); }
  tandai("g-barak", jawab.butuh_barak === null);

  if (!jawab.regu.length) { galat.push({ ke: "bagian-jumlah", teks: "Belum ada regu" }); }
  tandai("g-jumlah", !jawab.regu.length);

  jawab.regu.forEach((r, i) => {
    // Nama kembar menahan Kirim sama kerasnya dengan kolom kosong: dikirim
    // pun database menolaknya, dan ditolak di sini pembina masih melihat
    // kartu mana yang harus diubah.
    const n = normalNama(r.nama_regu);
    const namaSalah = !n
      || jawab.regu.some((x, j) => j < i && normalNama(x.nama_regu) === n)
      || namaTerpakai.get(n) === true;
    const kurang = namaSalah || !r.nama_ketua || ADA_ANGKA.test(r.nama_ketua);
    const el = document.getElementById(`regu-${i}`);
    if (el) el.classList.toggle("regu-card-error", kurang);
    if (kurang) {
      galat.push({ ke: `regu-${i}`, teks: namaSalah && n
        ? `Regu ${i + 1}: nama sudah dipakai` : `Regu ${i + 1} belum lengkap` });
    }
  });

  const namaKontakKosong = !jawab.nama_kontak.trim()
    || ADA_ANGKA.test(jawab.nama_kontak);
  if (namaKontakKosong)
    galat.push({ ke: "bagian-kontak", teks: !jawab.nama_kontak.trim()
      ? "Nama contact person belum diisi"
      : "Nama contact person tidak boleh memakai angka" });
  tandai("g-nama-kontak", namaKontakKosong);

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
      jumlah_pendamping: jawab.jumlah_pendamping,
      kontak_wa: jawab.kontak_wa,
      nama_kontak: jawab.nama_kontak,
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
      <div class="card" style="border-color:var(--bahaya);background:var(--bahaya-muda)">
        <strong>Belum terkirim.</strong>
        ${err instanceof ErrorApi ? err.message : "Coba lagi ya."}
        <div class="description" style="margin-top:.3rem">Isianmu tersimpan.</div>
      </div>`));
    document.getElementById("ringkas-galat").scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

/* ---------------- sukses ---------------- */

function sukses(hasil) {
  LAYAR.replaceChildren(h(html`
    <div class="card" style="border-color:var(--hijau);background:var(--hijau-muda)">
      <h2>✅ Pendaftaran diterima!</h2>
      <p>Ini <strong>kode pembayaran</strong>-mu. Simpan baik-baik — kode ini dipakai
         saat membayar dan saat daftar ulang.</p>
      <div class="giant-number" style="margin:1rem 0">${hasil.kode_pembayaran}</div>
      <button class="button button-secondary" id="salin" type="button">📋 Salin kode</button>
    </div>
    <div class="card">
      <h2 style="font-size:1.1rem">Cara membayar</h2>
      <p style="margin-top:.4rem">Transfer <strong>${rupiah(hasil.total_tagihan)}</strong>
         ke rekening panitia (tertera di poster/brosur), tulis kode
         <strong>${hasil.kode_pembayaran}</strong> di berita transfer —
         atau bayar tunai di meja pendaftaran.</p>
      <p class="description" style="margin-top:.6rem">Setelah panitia memeriksa
         pembayaran, semua regumu (${hasil.jumlah_regu} regu) resmi terdaftar.</p>
    </div>
    <a class="button button-primary" style="text-decoration:none"
       href="https://wa.me/?text=${encodeURIComponent(
         `Kode pembayaran HRCD: ${hasil.kode_pembayaran} (${hasil.jumlah_regu} regu, total ${rupiah(hasil.total_tagihan)})`)}">
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
  const romawi = String(EDISI.name || "").replace(/^HRCD\s*/i, "").trim();
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
  document.title = `Pendaftaran — Hiking Rally Ciradyka${romawi ? ` ${romawi}` : ""}`;

  let hasilLama = null, draf = null;
  try { hasilLama = JSON.parse(localStorage.getItem(KUNCI_HASIL) || "null"); } catch {}
  try { draf = JSON.parse(localStorage.getItem(KUNCI_DRAF) || "null"); } catch {}

  if (hasilLama && !draf) {
    LAYAR.replaceChildren(h(html`
      <div class="card" style="border-color:var(--hijau);background:var(--hijau-muda)">
        <h2>Pendaftaran terakhirmu</h2>
        <p>Kode pembayaran:</p>
        <div class="giant-number" style="margin:.6rem 0">${hasilLama.kode_pembayaran}</div>
        <p class="description">${hasilLama.jumlah_regu} regu · ${rupiah(hasilLama.total_tagihan)}</p>
      </div>
      <button class="button button-primary" id="baru" type="button">Daftarkan regu lain</button>`));
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
