/* ============================================================================
   hrcd-rekap : common/riwayat-pendaftaran.js — riwayat perubahan pendaftaran.

   Dipakai meja Pembayaran dan meja Daftar Ulang: dialog "Riwayat" satu kode
   bayar, dan centang yang menandai baris yang punya riwayat.
   ========================================================================== */

import { riwayatPendaftaran } from "../api.js";
import { dialog, esc, html, notif, tanggalJam } from "../util.js";

/* ---------------------------------------------------------------------------
   RIWAYAT SATU PENDAFTARAN — centang hijau yang bisa diketuk.

   Bentuknya menyalin yang sudah ada di layar Input Nilai Pos: centang hijau
   berarti "sudah masuk database", dan mengetuknya menjawab pertanyaan yang
   memang muncul saat menatapnya — siapa yang menaruhnya, dan apa yang ia ganti.
   Kelasnya pun sama (.riwayat, .r-lomba, .r-nilai, .r-oleh): dua dialog yang
   menjawab pertanyaan yang sama tidak boleh terasa seperti dua aplikasi.

   Hanya pada baris yang SUDAH SELESAI — Lunas di Pembayaran, dan bernomor dada
   di Daftar Ulang. Itu bukan penghematan: pada baris yang belum lunas atau
   belum bernomor, centang hijau berbohong tentang keadaannya.

   Datanya sudah tercatat trigger `catat_riwayat()` sejak 0002 — pendaftaran,
   regu, DAN pembayaran. Yang baru cuma cara melihatnya: view
   v_riwayat_pendaftaran (migrasi 0137).
   --------------------------------------------------------------------------- */

/** Nama kolom database tidak terbaca oleh yang tidak menulisnya. Yang tidak
 *  terdaftar di sini tetap tampil dengan nama aslinya — nama teknis yang jujur
 *  lebih baik daripada baris yang hilang diam-diam. */
export const LABEL_RIWAYAT = {
  nama_regu: "Nama regu", nama_ketua: "Ketua", anggota: "Anggota",
  kelas_organisasi: "Kelas", golongan: "Golongan", nomor_dada: "Nomor dada",
  kloter_nomor: "Kloter", urutan_kloter: "Urutan", kontrak_menit: "Kontrak",
  is_cancelled: "Dibatalkan",
  nama_kontak: "Contact person", kontak_wa: "WhatsApp",
  status: "Status", jumlah_regu: "Jumlah regu", butuh_barak: "Barak",
  jumlah_menginap: "Menginap", metode_bayar: "Cara bayar",
  bukti_transfer: "Bukti transfer",
  amount: "Nominal", method: "Metode", nomor_kwitansi: "Kwitansi",
};

export const TABEL_RIWAYAT = {
  pendaftaran: "Pendaftaran", regu: "Regu", pembayaran: "Pembayaran",
};

/** JSON apa adanya tidak dibaca orang: null jadi "—", daftar anggota jadi
 *  kalimat, dan boolean jadi kata.
 *
 *  MENGEMBALIKAN HTML, BUKAN TEKS, jadi ia yang meng-escape isinya sendiri —
 *  seluruh jalur keluar di bawah lewat esc(). Nama anggota diketik orang luar
 *  (lihat kepala util.js), dan satu jalur yang lupa di-escape di sini adalah
 *  XSS tersimpan di layar panitia. */
export function nilaiRiwayat(v) {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v)) return v.length ? esc(v.join(", ")) : "—";
  if (typeof v === "boolean") return v ? "ya" : "tidak";
  const t = String(v);
  if (t === "") return "—";
  /* Link bukti transfer ditulis "(link)", bukan alamatnya: alamat Drive
     panjangnya 60 huruf dan tidak satu pun di antaranya menjawab pertanyaan
     yang sedang ditanyakan.

     TAPI SEKARANG BISA DIKETUK. Sebelumnya ia tulisan mati, dan tombol yang
     membuka bukti itu memang ada di baris tabelnya — tetapi baris riwayat
     yang sedang dibaca justru menyebut bukti yang DULU dipasang, yang bisa
     berbeda dari yang berlaku sekarang. Satu-satunya cara melihat yang
     disebut riwayat adalah membukanya dari riwayat.

     "link", bukan "tautan": kata yang memang diucapkan panitia
     (CLAUDE.md 5.7). */
  return /^https?:\/\//.test(t)
    ? `<a href="${esc(t)}" target="_blank" rel="noopener">(link)</a>`
    : esc(t);
}

/** Satu baris riwayat jadi satu atau beberapa <li>.
 *
 *  INSERT sengaja TIDAK dirinci kolom per kolom: saat baris lahir, SELURUH
 *  kolomnya terhitung berubah, dan dua puluh baris "— → sesuatu" mengubur
 *  perubahan sungguhan yang justru dicari. Satu baris "Regu dibuat" sudah
 *  menyampaikan seluruh yang berguna. */
export function liRiwayat(b) {
  const tabel = TABEL_RIWAYAT[b.table_name] || b.table_name;
  // Perubahan tanpa pelaku (migrasi impor — lihat 0138) menyisakan TANGGALNYA
  // saja. "(tidak dikenal)" terbaca seperti sistem yang gagal mengenali
  // petugas, padahal memang tidak ada petugas yang melakukannya.
  const oleh = [b.oleh, tanggalJam(b.changed_at)].filter(Boolean).join(" · ");

  if (b.action !== "UPDATE") {
    return html`<li>
      <span class="r-lomba">${tabel}</span>
      <span class="r-nilai"><strong>${b.action === "DELETE" ? "dihapus" : "dibuat"}</strong></span>
      <span class="r-oleh">${oleh}</span>
    </li>`;
  }

  /* Template BIASA, bukan html`` — nilaiRiwayat() sudah mengembalikan HTML
     (link bukti transfer bisa diketuk), dan tag html`` akan meng-escape-nya
     jadi tulisan `<a href=...>`. Yang lain tetap lewat esc() satu per satu. */
  const ubah = b.perubahan || {};
  return Object.keys(ubah).map(k => `<li>
    <span class="r-lomba">${esc(LABEL_RIWAYAT[k] || k)}</span>
    <span class="r-nilai">${nilaiRiwayat(ubah[k].lama)} →
      <strong>${nilaiRiwayat(ubah[k].baru)}</strong></span>
    <span class="r-oleh">${esc(oleh)}</span>
  </li>`).join("");
}

/** Penanda "sudah selesai" yang bisa diketuk untuk membuka riwayatnya.
 *
 *  TIDAK ADA IKON BARU. Yang dijadikan tombol adalah penanda yang SUDAH
 *  berdiri di baris itu — lencana LUNAS di Meja Pembayaran, pil nomor dada di
 *  Meja Daftar Ulang. Keputusan pemilik acara, dan alasannya sederhana:
 *  menambah satu lambang berarti satu hal lagi yang harus diartikan petugas,
 *  padahal yang mau ditanyakan orang saat menatap "LUNAS" memang "lunas oleh
 *  siapa". Tombolnya sudah ada; ia cuma belum bisa diketuk.
 *
 *  Bentuknya juga yang membuatnya muat. Kolom tombol Meja Pembayaran penuh
 *  sampai piksel terakhir pada lebar tersempitnya — diukur: isinya 197px di
 *  dalam sel 193px — jadi elemen ketujuh di baris itu meluap keluar tabel.
 *
 *  aria-label ditulis penuh karena "LUNAS" saja tidak memberi tahu pembaca
 *  layar bahwa ini tombol dan apa yang dibukanya. */
export const tombolRiwayat = (kode, isiHtml, kelas) =>
  `<button class="${esc(kelas)}" type="button"
           data-riwayat-kode="${esc(kode)}" title="Riwayat perubahan"
           aria-label="Riwayat perubahan ${esc(kode)}">${isiHtml}</button>`;

/** Pasang penangannya pada seluruh centang di dalam satu wadah. Dipanggil
 *  sekali per penggambaran tabel, bukan per baris. */
export function pasangCentangRiwayat(wadah) {
  wadah.querySelectorAll("[data-riwayat-kode]").forEach(btn =>
    btn.addEventListener("click", () => bukaRiwayatPendaftaran(btn.dataset.riwayatKode)));
}

/** Dibaca saat DIKETUK, bukan ikut dimuat bersama tabelnya: satu layar memuat
 *  ratusan baris dan hampir semuanya tidak pernah ditanya riwayatnya.
 *
 *  Yang ditampilkan sengaja apa adanya — dari apa jadi apa, siapa, kapan —
 *  tanpa menyimpulkan mana yang "mencurigakan". Yang tahu apakah suatu
 *  perubahan wajar adalah orang yang mengerjakannya, bukan layar. */
export async function bukaRiwayatPendaftaran(kode) {
  let baris;
  try { baris = await riwayatPendaftaran(kode); }
  catch (err) { notif(`Riwayat tidak bisa dibaca: ${err.message}`, true); return; }

  const isi = baris.map(liRiwayat).join("");
  await dialog({
    /* TANDA HUBUNG YANG TIDAK BOLEH DIPATAH (U+2011). Kode bayar berbentuk
       "HRCD37-2B8582", dan tanda hubung biasa adalah tempat pemenggalan baris
       yang sah — jadi judulnya patah jadi "Riwayat HRCD37-" di baris pertama
       dan "2B8582" di baris kedua, dan dari layar itu terbaca seperti dua
       kode. Rupanya sama persis; yang berbeda cuma ia tidak bisa dijadikan
       tempat patah. */
    judul: `Riwayat ${kode.replace(/-/g, "‑")}`,
    kartuHtml: isi
      ? `<ul class="riwayat riwayat-pendaftaran">${isi}</ul>`
      : `<p class="description">Belum pernah diubah.</p>`,
    labelAksi: "Tutup", bacaSaja: true,
  });
}
