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
  daftarKloter, tandaiKloterDicetak,
} from "./api.js";
import { esc, h, html, rupiah, jamSekarang, notif, dialog, kartuGagalMuat } from "./util.js";

const LAYAR = document.getElementById("layar");
const GOLONGAN_LABEL = {
  penggalang_pa: "Penggalang PA", penggalang_pi: "Penggalang PI",
  penegak_pa: "Penegak PA", penegak_pi: "Penegak PI",
};
let EDISI = null;
const terakhir = { pembayaran: [], "daftar-ulang": [] };

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
        <div class="ket">Kertas untuk garis start — setelah dicetak, isi kloter dibekukan</div>
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
      <div class="pilihan-baris" style="margin-top:.9rem">
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
    siapkanCetakKloter(dipakai);
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

/** Blok cetak khusus daftar kloter — satu kloter per halaman kertas. */
function siapkanCetakKloter(dipakai) {
  document.getElementById("cetakan")?.remove();
  const halaman = dipakai.map(([nomor, v]) => {
    const baris = v.isi.map(r => html`
      <tr><td class="dada">${String(r.nomor_dada).padStart(3, "0")}</td>
          <td>${r.nama_regu}</td>
          <td>${r.nama_sekolah}</td>
          <td>${GOLONGAN_LABEL[r.golongan] || r.golongan}</td>
          <td class="kotak"></td></tr>`).join("");
    return `
      <section class="halaman-cetak">
        <h1>KLOTER ${esc(nomor)} — Hiking Rally Ciradyka ${esc(EDISI ? EDISI.nama : "")}</h1>
        <p>Jam berangkat: ________  ·  Petugas: ________________</p>
        <table class="tabel-cetak">
          <thead><tr><th>No Dada</th><th>Nama Regu</th><th>Sekolah</th><th>Golongan</th><th>Hadir</th></tr></thead>
          <tbody>${baris}</tbody>
        </table>
      </section>`;
  }).join("");
  document.body.appendChild(h(`<div id="cetakan" class="cetakan">${halaman}</div>`));
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
