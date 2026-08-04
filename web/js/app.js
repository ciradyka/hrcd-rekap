/* ============================================================================
   hrcd-rekap : app.js — aplikasi panitia (tahap 2).
   Aturan bentuk (rancangan-b.md 10.1): kerangka sama di semua layar,
   satu aksi utama per layar, kunci di-autofocus, echo-confirm sebelum simpan,
   "baris terakhir" di kaki, gagal itu nyaring dan lokal.

   Semua teks dari luar (nama sekolah/regu/ketua, pesan server) WAJIB lewat
   esc() atau tag html`` — lihat util.js.
   ========================================================================== */

import {
  sesi, masuk, keluar, GalatApi,
  lihatBatch, infoEdisi, ringkasanMeja,
  verifikasiPembayaran, batalkanVerifikasi, daftarUlang, tukarNomor, ubahPendamping,
  daftarKloter, tandaiKloterDicetak, pindahKloter, daftarSisipan,
  cariRegu, catatFinish,
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

function pasangKepala(judul) {
  const s = sesi();
  document.getElementById("kepala").hidden = !s;
  document.getElementById("judul-layar").textContent = judul;
  if (s) document.getElementById("siapa").textContent =
    `${s.username} · ${EDISI ? EDISI.nama : ""}`;
}

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
        <label for="u">Nama akun</label>
        <input type="text" id="u" autocomplete="username" autocapitalize="none"
               spellcheck="false" placeholder="contoh: meja1hrcd37">
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
      layarLogin(e instanceof GalatApi ? e.message : "Nama akun atau password salah.");
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
      <a href="#/pembayaran">
        <div class="nama-fungsi">💳 Pembayaran ${lencana(r ? r.menunggu_pembayaran : null)}</div>
        <div class="ket">Periksa transfer/tunai, tandai lunas, cetak kwitansi</div>
      </a>
      <a href="#/daftar-ulang">
        <div class="nama-fungsi">🎽 Daftar Ulang ${lencana(r ? r.lunas_belum_nomor : null)}</div>
        <div class="ket">Berikan nomor dada untuk sekolah yang sudah lunas</div>
      </a>
      <a href="#/pendaftaran-offline">
        <div class="nama-fungsi">📝 Pendaftaran Offline</div>
        <div class="ket">Bukakan form pendaftaran untuk sekolah yang datang langsung</div>
      </a>
      <a href="#/cetak-kloter">
        <div class="nama-fungsi">🖨️ Cetak Daftar Kloter</div>
        <div class="ket">Kertas untuk papan pengumuman, barak, dan petugas staging</div>
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

/* ---------------- kartu batch (echo-confirm bersama) ---------------- */

function kartuBatch(b, { ringkas = false } = {}) {
  const s = { menunggu_pembayaran: ["lencana-kuning", "BELUM BAYAR"],
              lunas: ["lencana-hijau", "LUNAS"],
              batal: ["lencana-merah", "BATAL"] }[b.status] || ["lencana-abu", "?"];
  const aktif = b.regu.filter(r => !r.batal);
  const sudahNomor = aktif.some(r => r.nomor_dada !== null);
  // Pada sekolah besar, tabel regu ditutup dulu supaya tombol aksi tidak
  // terdorong ke bawah lipatan layar laptop (temuan review).
  const banyak = aktif.length > 6;
  const barisRegu = b.regu.map(r => html`
    <tr style="${r.batal ? "opacity:.5" : ""}">
      <td>${r.nomor_dada !== null ? String(r.nomor_dada).padStart(3, "0") : "—"}</td>
      <td><strong>${r.nama_regu}</strong>${r.batal ? " (batal)" : ""}</td>
      <td>${GOLONGAN_LABEL[r.golongan] || r.golongan}</td>
      <td>${r.nomor_dada !== null ? `Kloter ${r.kloter_nomor}` : ""}</td>
    </tr>`).join("");

  return `
    <div class="kartu kartu-identitas">
      <span class="lencana ${s[0]}">${s[1]}</span>
      ${sudahNomor ? `<span class="lencana lencana-hijau">SUDAH DAFTAR ULANG</span>` : ""}
      ${html`<div class="nama" style="margin-top:.4rem">${b.sekolah.nama}</div>
      <div class="detail">📍 ${b.sekolah.alamat}</div>
      <div class="detail">${aktif.length} regu · WA ${b.kontak_wa}${
        b.butuh_barak ? ` · menginap (${b.jumlah_pendamping} pendamping)` : ""}</div>`}
      ${ringkas ? "" : (banyak
        ? `<details style="margin-top:.6rem">
             <summary style="cursor:pointer;font-weight:700;min-height:44px">
               Lihat ${aktif.length} regu</summary>
             <table class="tabel" style="background:#fff;border-radius:8px">${barisRegu}</table>
           </details>`
        : `<table class="tabel" style="margin-top:.6rem;background:#fff;border-radius:8px">
             ${barisRegu}</table>`)}
    </div>`;
}

/** Layar meja berpola sama: kolom kunci besar -> kartu -> satu aksi utama.
 *  pasangAksi dipanggil LANGSUNG setiap kali kode dicari — bukan lewat
 *  CustomEvent {once:true} yang dulu membuat pencarian kedua mati total
 *  (temuan review, blocker). */
function layarCariKode({ judul, petunjuk, fungsi, saatKetemu, pasangAksi }) {
  pasangKepala(judul);
  LAYAR.replaceChildren(h(`
    <div class="kartu">
      <div class="medan" style="margin-bottom:0">
        <label for="kode">${esc(petunjuk)}</label>
        <input type="text" id="kode" class="besar" autocomplete="off"
               autocapitalize="characters" spellcheck="false"
               placeholder="HRCD37-••••••">
        <div class="bantuan">Kode ada di HP pendaftar / bukti transfer.</div>
      </div>
      <button class="tombol tombol-utama" id="cari" type="button" style="margin-top:.8rem">
        Cari
      </button>
    </div>
    <div id="hasil"></div>
    ${barisTerakhirHtml(fungsi)}
  `));
  const inp = document.getElementById("kode");
  inp.focus();

  const cari = async () => {
    const kode = inp.value.trim().toUpperCase();
    if (!kode) { inp.focus(); return; }
    const hasil = document.getElementById("hasil");
    hasil.replaceChildren(h(html`<p>Mencari ${kode}…</p>`));
    try {
      const b = await lihatBatch(kode);
      hasil.replaceChildren(h(saatKetemu(b, kode)));
      pasangAksi(b, kode);                 // selalu dipasang ulang
    } catch (err) {
      hasil.replaceChildren(h(kartuGalat(err.message)));
      inp.select();
    }
  };
  document.getElementById("cari").addEventListener("click", cari);
  inp.addEventListener("keydown", e => { if (e.key === "Enter") cari(); });
}

/* ============================ MEJA PEMBAYARAN ============================ */

function layarPembayaran() {
  if (!EDISI) { layarButuhEdisi("Meja Pembayaran"); return; }

  layarCariKode({
    judul: "Meja Pembayaran",
    petunjuk: "Ketik kode pembayaran",
    fungsi: "pembayaran",

    saatKetemu: (b) => {
      const aktif = b.regu.filter(r => !r.batal).length;
      const tagihan = aktif * EDISI.biaya_per_regu;
      if (b.status === "lunas") {
        return kartuBatch(b) + html`
          <div class="kartu" style="border-color:var(--hijau);background:var(--hijau-muda)">
            <h2>Sudah lunas ✅</h2>
            <p>Kwitansi <strong>${b.pembayaran.nomor_kwitansi}</strong> ·
               ${rupiah(b.pembayaran.nominal)} (${b.pembayaran.metode})</p>
          </div>
          <div class="pilihan-baris">
            <button class="tombol tombol-utama" id="aksi-kwitansi" type="button">🖨️ Cetak kwitansi</button>
            <button class="tombol tombol-bahaya" id="aksi-batal" type="button">Batalkan (salah tandai)</button>
          </div>`;
      }
      if (b.status === "batal")
        return kartuBatch(b) + kartuGalat("Pendaftaran ini sudah dibatalkan. Panggil admin bila peserta merasa ini keliru.");
      return `
        <div class="kartu" style="border-color:var(--utama)">
          <h2>Tagihan: <span style="font-size:1.6rem">${rupiah(tagihan)}</span></h2>
          <p class="keterangan">${aktif} regu × ${rupiah(EDISI.biaya_per_regu)}.
             Uangnya harus PAS — tidak melayani bayar sebagian.</p>
          <div class="medan" style="margin-top:.8rem">
            <label>Dibayar lewat apa?</label>
            <div class="pilihan-baris">
              <button class="pilihan" data-metode="transfer" aria-pressed="false" type="button">Transfer</button>
              <button class="pilihan" data-metode="tunai" aria-pressed="false" type="button">Tunai</button>
            </div>
          </div>
          <button class="tombol tombol-utama" id="aksi-lunas" type="button" disabled
                  data-label="Tandai Lunas — ${rupiah(tagihan)}">
            Tandai Lunas — ${rupiah(tagihan)}
          </button>
        </div>
        ${kartuBatch(b)}`;   // identitas DI BAWAH aksi utama pada layar pendek
    },

    pasangAksi: (b, kode) => {
      const aktif = b.regu.filter(r => !r.batal).length;
      let metode = null;
      LAYAR.querySelectorAll("[data-metode]").forEach(p => p.addEventListener("click", () => {
        metode = p.dataset.metode;
        LAYAR.querySelectorAll("[data-metode]").forEach(x =>
          x.setAttribute("aria-pressed", String(x === p)));
        document.getElementById("aksi-lunas").disabled = false;
      }));

      const lunas = document.getElementById("aksi-lunas");
      if (lunas) lunas.addEventListener("click", async () => {
        if (lunas.dataset.jalan === "1") return;          // cegah klik ganda
        lunas.dataset.jalan = "1";
        lunas.disabled = true; lunas.textContent = "Menyimpan…";
        let r;
        try {
          r = await verifikasiPembayaran(kode, aktif * EDISI.biaya_per_regu, metode);
        } catch (err) {
          notif(err.message, true);
          lunas.dataset.jalan = ""; lunas.disabled = false;
          lunas.textContent = lunas.dataset.label;
          return;
        }
        // Render sukses DI LUAR try — kalau DOM gagal, tulisan sudah terjadi
        // dan operator tidak boleh diberitahu "gagal" (temuan review).
        catatTerakhir("pembayaran", kode, `${b.sekolah.nama} — lunas, ${r.nomor_kwitansi}`);
        document.getElementById("hasil").replaceChildren(h(html`
          <div class="kartu" style="border-color:var(--hijau);background:var(--hijau-muda)">
            <h2>✅ ${b.sekolah.nama} LUNAS</h2>
            <p>Kwitansi <strong style="font-size:1.4rem">${r.nomor_kwitansi}</strong></p>
            <p class="keterangan">Persilakan langsung ke meja daftar ulang.</p>
          </div>
          <div class="pilihan-baris">
            <button class="tombol tombol-utama" id="cetak2" type="button">🖨️ Cetak kwitansi</button>
            <button class="tombol tombol-kalem" id="lagi" type="button">Kode berikutnya</button>
          </div>`));
        siapkanCetakKwitansi(b, r.nomor_kwitansi, aktif * EDISI.biaya_per_regu, metode);
        document.getElementById("cetak2").addEventListener("click", () => window.print());
        document.getElementById("lagi").addEventListener("click", layarPembayaran);
      });

      const batal = document.getElementById("aksi-batal");
      if (batal) batal.addEventListener("click", async () => {
        const jawab = await dialog({
          judul: "Batalkan tanda lunas?",
          kartuHtml: kartuBatch(b, { ringkas: true }),
          medan: [{ label: "Alasan pembatalan", contoh: "salah tandai kode",
                    bantuan: "Tercatat di riwayat, wajib diisi." }],
          labelAksi: "Ya, batalkan",
        });
        if (!jawab) return;
        try {
          await batalkanVerifikasi(kode, jawab[0]);
          catatTerakhir("pembayaran", kode, "verifikasi dibatalkan");
          notif("Verifikasi dibatalkan — status kembali BELUM BAYAR.");
          layarPembayaran();
        } catch (err) { notif(err.message, true); }
      });

      const kw = document.getElementById("aksi-kwitansi");
      if (kw) kw.addEventListener("click", () => {
        siapkanCetakKwitansi(b, b.pembayaran.nomor_kwitansi, b.pembayaran.nominal, b.pembayaran.metode);
        window.print();
      });
    },
  });
}

/** Kwitansi cetak: blok tersendiri yang hanya tampil saat mencetak, supaya
 *  kertasnya berisi kwitansi — bukan tangkapan layar aplikasi (temuan review). */
function siapkanCetakKwitansi(b, nomor, nominal, metode) {
  document.getElementById("cetakan")?.remove();
  const el = h(html`
    <div id="cetakan" class="cetakan">
      <h1>KWITANSI — Hiking Rally Ciradyka ${EDISI ? EDISI.nama : ""}</h1>
      <p>Nomor kwitansi: <strong>${nomor}</strong></p>
      <p>Kode pembayaran: <strong>${b.kode_pembayaran}</strong></p>
      <p>Telah diterima dari: <strong>${b.sekolah.nama}</strong> — ${b.sekolah.alamat}</p>
      <p>Untuk pendaftaran: <strong>${b.regu.filter(r => !r.batal).length} regu</strong></p>
      <p>Jumlah: <strong>${rupiah(nominal)}</strong> (${metode})</p>
      <p style="margin-top:2rem">Panitia HRCD ______________________</p>
    </div>`);
  document.body.appendChild(el);
}

/* ============================ MEJA DAFTAR ULANG ========================== */

function layarDaftarUlang() {
  layarCariKode({
    judul: "Meja Daftar Ulang",
    petunjuk: "Ketik kode pembayaran sekolah",
    fungsi: "daftar-ulang",

    saatKetemu: (b) => {
      const belum = b.regu.filter(r => !r.batal && r.nomor_dada === null);
      const sudahNomor = b.regu.some(r => r.nomor_dada !== null);
      if (b.status === "menunggu_pembayaran")
        return kartuBatch(b) + kartuGalat("Sekolah ini belum membayar. Arahkan dulu ke meja pembayaran.");
      if (b.status === "batal")
        return kartuBatch(b) + kartuGalat("Pendaftaran ini sudah dibatalkan. Panggil admin.");
      if (sudahNomor || belum.length === 0)
        return kartuBatch(b) + `
          <div class="kartu">
            <p class="keterangan">Sekolah ini sudah daftar ulang. Nomor dadanya ada di kartu di atas.</p>
            <button class="tombol tombol-kalem" id="aksi-tukar" type="button">Tukar nomor rusak…</button>
          </div>`;
      return `
        <div class="kartu" style="border-color:var(--utama)">
          ${html`<p><strong>Konfirmasi lisan dulu:</strong> "Benar dari ${b.sekolah.nama},
             ${belum.length} regu?" — lalu tekan tombol.</p>`}
          ${b.butuh_barak ? `
            <div class="medan" style="margin-top:.8rem">
              <label for="pendamping">Jumlah pendamping yang menginap</label>
              <input type="number" id="pendamping" min="0" max="30" inputmode="numeric"
                     value="${esc(b.jumlah_pendamping)}">
            </div>` : ""}
          <button class="tombol tombol-utama" id="aksi-ambil" type="button"
                  data-label="🎽 Ambil ${belum.length} Nomor Dada">
            🎽 Ambil ${belum.length} Nomor Dada
          </button>
        </div>
        ${kartuBatch(b)}`;
    },

    pasangAksi: (b, kode) => {
      const ambil = document.getElementById("aksi-ambil");
      if (ambil) ambil.addEventListener("click", async () => {
        if (ambil.dataset.jalan === "1") return;
        ambil.dataset.jalan = "1";
        ambil.disabled = true; ambil.textContent = "Mengambil nomor…";
        let hasil;
        try {
          const pend = document.getElementById("pendamping");
          if (pend && Number(pend.value) !== b.jumlah_pendamping)
            await ubahPendamping(kode, Number(pend.value) || 0);
          hasil = await daftarUlang(kode);
        } catch (err) {
          notif(err.message, true);
          ambil.dataset.jalan = ""; ambil.disabled = false;
          ambil.textContent = ambil.dataset.label;
          return;
        }
        catatTerakhir("daftar-ulang", kode, `${b.sekolah.nama} — ${hasil.length} nomor`);
        document.getElementById("hasil").replaceChildren(h(html`
          <div class="kartu" style="border-color:var(--hijau);background:var(--hijau-muda)">
            <h2>✅ ${b.sekolah.nama} — bacakan sambil serahkan nomor:</h2>
          </div>`));
        const kotak = document.getElementById("hasil").firstElementChild;
        kotak.appendChild(h(`
          <table class="tabel" style="background:#fff;border-radius:8px;margin-top:.6rem">
            ${hasil.map(r => html`
              <tr>
                <!-- Nomor dada DIBACAKAN sambil menyerahkan nomor fisik —
                     ini satu-satunya angka yang sengaja tidak ikut diperkecil. -->
                <td class="angka" style="font-size:2.3rem;line-height:1.1">${String(r.nomor_dada).padStart(3, "0")}</td>
                <td><strong style="font-size:1.1rem">${r.nama_regu}</strong><br>
                    <span class="keterangan">${GOLONGAN_LABEL[r.golongan] || r.golongan}</span></td>
                <td><span class="lencana lencana-abu">Kloter ${r.kloter}</span></td>
              </tr>`).join("")}
          </table>
          <button class="tombol tombol-utama" id="lagi" style="margin-top:.8rem" type="button">
            Sekolah berikutnya
          </button>`));
        document.getElementById("lagi").addEventListener("click", layarDaftarUlang);
      });

      const tukar = document.getElementById("aksi-tukar");
      if (tukar) tukar.addEventListener("click", async () => {
        const bernomor = b.regu.filter(r => r.nomor_dada !== null && !r.batal);
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
        if (!regu) { notif(`Nomor ${esc(lama)} bukan milik sekolah ini.`, true); return; }
        if (!Number.isInteger(Number(baru)) || Number(baru) <= 0) {
          notif("Nomor pengganti harus angka.", true); return;
        }
        try {
          await tukarNomor(regu.id, Number(baru), alasan);
          catatTerakhir("daftar-ulang", kode, `tukar nomor ${lama} → ${baru}`);
          notif(`Nomor ${lama} diganti ${baru}. Nomor lama tidak dipakai lagi.`);
          layarDaftarUlang();
        } catch (err) { notif(err.message, true); }
      });
    },
  });
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
      <div id="opsi-lanjut" style="margin-top:.6rem"></div>
    </div>
    <div id="riwayat-finish"></div>
  `));

  const inp = document.getElementById("dada");
  const kotak = document.getElementById("kartu-regu");
  const tombol = document.getElementById("sampai");
  const opsi = document.getElementById("opsi-lanjut");
  let regu = null;
  let anggotaHadir = 5;
  let jamManual = null;      // diisi hanya untuk pencatatan susulan
  let jeda = null;

  inp.focus();
  gambarRiwayat();

  const bersihkan = () => {
    regu = null; anggotaHadir = 5; jamManual = null;
    kotak.replaceChildren(); opsi.replaceChildren();
    tombol.disabled = true;
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
      regu = null; tombol.disabled = true; opsi.replaceChildren();
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
    opsi.replaceChildren(h(`
      <details>
        <summary style="cursor:pointer;min-height:40px;font-size:.9rem;color:var(--tinta-lembut)">
          Anggota kurang dari 5, atau mencatat dari kertas?
        </summary>
        <div class="medan" style="margin-top:.6rem">
          <label for="hadir">Jumlah anggota yang hadir</label>
          <input type="number" id="hadir" min="0" max="5" inputmode="numeric" value="5">
          <div class="bantuan">Tiap anggota yang tidak lengkap dikurangi 20 poin.</div>
        </div>
        <div class="medan">
          <label for="jam">Jam datang (jam:menit) — kosongkan bila mencatat sekarang</label>
          <input type="time" id="jam">
          <div class="bantuan">Isi hanya bila menyalin dari catatan kertas.</div>
        </div>
      </details>`));
    document.getElementById("hadir").addEventListener("input", e => {
      anggotaHadir = Math.max(0, Math.min(5, Number(e.target.value) || 0));
    });
    document.getElementById("jam").addEventListener("input", e => {
      jamManual = e.target.value || null;
    });
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
    const jam = jamManual ? jamHariIni(jamManual) : new Date();
    const dada = regu.nomor_dada;
    const nama = regu.nama_regu;
    try {
      await catatFinish(dada, jam.toISOString(), anggotaHadir, null);
    } catch (err) {
      notif(err.message, true);
      tombol.dataset.jalan = ""; tombol.disabled = false;
      return;
    }
    catatTerakhir("finish", String(dada).padStart(3, "0"),
      `${nama} — ${jamPendek(jam)}${anggotaHadir < 5 ? ` · ${anggotaHadir} anggota` : ""}`);
    tombol.dataset.jalan = "";
    inp.value = ""; bersihkan(); inp.focus();
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
  pasangKepala("Pendaftaran Offline");
  LAYAR.replaceChildren(h(`
    <div class="kartu">
      <h2>Pendaftaran offline = form yang sama</h2>
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
