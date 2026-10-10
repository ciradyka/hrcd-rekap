/* ============================================================================
   hrcd-rekap : screens/data-peserta.js — layar Data Peserta (#/data-peserta).

   Semua regu terdaftar, dengan pencarian dan saringan Eksternal/Internal.
   ========================================================================== */

import { dataPeserta, ErrorApi, ubahIdentitasRegu,
         ubahKontakPendaftaran } from "../api.js";
import { alatTabel, EDISI, LAYAR, layarButuhEdisi, pasangAlatTabel,
         pasangKepala } from "../common/frame.js";
import { dada3, esc, GOLONGAN_LABEL, h, kartuGagalMuat, notif,
         pemuat } from "../util.js";

/* ============================ MEJA PEMBAYARAN ============================ */

/* ============================ DATA PESERTA ==============================

   Membetulkan yang salah diketik pembina. Peserta mendaftar sendiri lewat form
   di situs peserta, dan sebagian salah ketik — nomor WA kurang satu digit, nama
   anggota tertukar, nama ketua salah eja. Sampai layar ini ada, satu-satunya
   jalan membatalkan pendaftaran lalu meminta mereka mengisi ulang, dan yang
   benar-benar terjadi: panitia mencatat betulannya di kertas lain, dan database
   berbeda dari kenyataan tanpa ada yang tahu bagian mana.

   BENTUKNYA SAMA DENGAN MEJA PEMBAYARAN: satu baris per pendaftaran, tombol
   jumlah regu membuka baris rinciannya. Yang berbeda cuma isinya — di sini
   setiap sel yang boleh dibetulkan adalah kotak isian.

   DISIMPAN SAAT KOTAKNYA DITINGGALKAN, tanpa tombol Simpan. Satu tombol per
   baris berarti petugas yang membetulkan satu huruf harus mencari tombolnya
   dulu, dan yang lupa menekannya kehilangan suntingannya tanpa tahu. Kotaknya
   berkedip hijau sesudah tersimpan — cara yang sama dengan layar Input Nilai
   Pos, jadi tidak ada kebiasaan baru yang perlu dipelajari.

   YANG TIDAK ADA DI SINI: golongan, sekolah, nomor dada, status bayar.
   Masing-masing punya jalurnya sendiri, dan yang salah di antaranya bukan
   salah ketik melainkan pendaftaran yang salah. Alasan lengkapnya di kepala
   migrasi 0135. */

/** "28/08/2026 04:32" — angka semua, dan itu diminta pemilik acara. Bentuk
 *  bernama bulan ("28 Agu 26") lebih pendek tapi panjangnya BERUBAH-UBAH: Mei
 *  tiga huruf, Agustus disingkat tiga, September empat kalau tidak disingkat.
 *  Di satu kolom yang dipindai dari atas ke bawah, angka dengan nol di depan
 *  membuat tiap bagian jatuh di titik yang sama tiap baris.
 *
 *  WIB, sama seperti tanggalPanjang(): menjelang tengah malam tanggal alat dan
 *  tanggal WIB bisa menunjuk hari yang berbeda, dan riwayat yang menyebut hari
 *  kemarin untuk kejadian hari ini lebih buruk daripada tidak ada tanggal. */
export const FMT_DP = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit",
  year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
});

export const tanggalRingkas = (t) => {
  if (!t) return "—";
  const b = {};
  for (const x of FMT_DP.formatToParts(new Date(t))) b[x.type] = x.value;
  return `${b.day}/${b.month}/${b.year} ${b.hour}:${b.minute}`;
};

export async function layarDataPeserta() {
  if (!EDISI) { layarButuhEdisi("Data Peserta"); return; }
  pasangKepala("Data Peserta", true);
  LAYAR.replaceChildren(h(pemuat()));

  const layarIni = location.hash;
  let semua;
  try { semua = await dataPeserta(); }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarDataPeserta)); return; }
  if (location.hash !== layarIni) return;

  const dibuka = new Set();
  const aktifDp = (b) => (b.regu || []).filter(r => !r.is_cancelled);
  const internDp = (b) => aktifDp(b).some(r => String(r.golongan || "").startsWith("intern"));

  LAYAR.replaceChildren(h(`
    <div class="card">
      ${alatTabel({
        saringan: [
          { kode: "semua", label: "Semua" },
          { kode: "eksternal", label: "Eksternal", pendek: "Luar" },
          { kode: "intern", label: "Internal" },
        ],
        saringAktif: "semua",
        jumlah: semua.length,
        cariContoh: "Cari kode, sekolah, regu, ketua, atau nomor WA…",
      })}
      <div class="table-wrapper">
        <table class="table data-table table-peserta">
          <thead>
            <tr>
              <th>Tanggal</th><th>Kode Bayar</th><th>Asal Sekolah</th>
              <th class="text-center">Regu</th><th>Contact Person</th><th>WhatsApp</th>
            </tr>
          </thead>
          <tbody id="isi-tabel"></tbody>
        </table>
      </div>
    </div>
  `));

  const gambar = (cari = "", saring = "semua") => {
    const baris = semua.filter(b => {
      if (saring === "intern" && !internDp(b)) return false;
      if (saring === "eksternal" && internDp(b)) return false;
      if (!cari) return true;
      return [
        b.kode_pembayaran, b.sekolah?.name, b.kontak_wa, b.nama_kontak,
        ...aktifDp(b).flatMap(r => [r.nama_regu, r.nama_ketua, r.kelas_organisasi,
                                    ...(r.anggota || [])]),
      ].filter(Boolean).join(" ").toLowerCase().includes(cari);
    });

    document.getElementById("tabel-jumlah").textContent =
      `${baris.length} pendaftaran · ${baris.reduce((n, b) => n + aktifDp(b).length, 0)} regu`;

    const tbody = document.getElementById("isi-tabel");
    if (!baris.length) {
      tbody.replaceChildren(h(`<tr><td colspan="6" class="table-empty">
        Tidak ada yang cocok.</td></tr>`));
      return;
    }

    /* Template BIASA, bukan tag html`` — baris rincian sudah berupa HTML jadi,
       dan html`` meng-escape setiap nilai yang disisipkan. Nilai dari luar
       tetap lewat esc() satu per satu. */
    tbody.replaceChildren(h(baris.map(b => {
      const kode = esc(b.kode_pembayaran);
      const aktif = aktifDp(b);
      const terbuka = dibuka.has(b.kode_pembayaran);
      return `
        <tr class="invoice-row" data-baris="${kode}">
          <td class="mono" data-label="Tanggal">${esc(tanggalRingkas(b.created_at))}</td>
          <td class="mono" data-label="Kode Bayar">${kode}</td>
          <td data-label="Asal Sekolah"><strong>${esc(b.sekolah?.name || "—")}</strong></td>
          <td class="text-center" data-label="Regu">
            <button class="button-detail" type="button" data-detail="${kode}"
                    aria-expanded="${terbuka}"
                    aria-label="Lihat ${aktif.length} regu"><span class="panah">${
              terbuka ? "▾" : "▸"}</span> ${aktif.length}<span
                    class="satuan-regu"> regu</span></button>
          </td>
          <td data-label="Contact Person">
            <input type="text" class="small-input" data-kontak-nama="${kode}"
                   value="${esc(b.nama_kontak || "")}" placeholder="misal: Bu Rina"></td>
          <td data-label="WhatsApp">
            <input type="tel" class="small-input" inputmode="numeric"
                   data-kontak-wa="${kode}" value="${esc(b.kontak_wa || "")}"
                   placeholder="misal: 08123456789"></td>
        </tr>
        ${!aktif.length ? "" : `
        <tr class="detail-row" data-detail-untuk="${kode}" ${terbuka ? "" : "hidden"}>
          <td colspan="6" class="detail-cell-flush">
            <div class="rincian-peserta">
              ${aktif.map((r, i) => barisRegu(r, i)).join("")}
            </div>
          </td>
        </tr>`}`;
    }).join("")));

    pasangBaris(() => gambar(cari, saring));
  };

  /* Satu kartu per regu, BENTUKNYA SAMA DENGAN FORM PENDAFTARAN: lencana
     golongan, Kelas/Organisasi selebar kartu, lalu Nama Regu dan Nama Ketua
     berdampingan, lalu empat kotak anggota bertumpuk.

     Versi pertama menaruh kedelapan kotak itu sebagai kolom tabel, dan itu
     tidak bisa dipakai untuk apa yang layar ini ada: MENGETIK. Delapan kolom
     dalam satu baris berarti tiap kotak sekitar 110px, dan "MUHAMMAD FACHRY
     SEPTIAN RAMDANI" tidak muat seperempatnya — petugas mengganti satu nama
     sambil melihat sepotong nama. Nama selengkapnya menuntut tabel selebar
     2.064px, yang tidak muat di layar mana pun.

     Barisnya tetap tabel, karena baris memang untuk DIPINDAI: tanggal, kode,
     sekolah, kontak. Yang dibaca sekilas jadi tabel, yang diketik jadi form —
     dan formnya sudah punya bentuk yang dikenal, yaitu bentuk yang diisi
     pembina waktu mendaftar.

     Ketua DAN empat anggota, karena satu regu lima orang: ketuanya salah satu
     dari kelima, bukan orang keenam. Kotak "Anggota 5" karena itu tidak ada —
     constraint regu_anggota_maks_empat menolaknya.

     Kelas hanya untuk regu Internal; regu Eksternal dibedakan oleh sekolahnya
     dan kotaknya tidak digambar sama sekali. */
  const barisRegu = (r, i) => {
    const id = esc(r.id);
    const intern = String(r.golongan || "").startsWith("intern");
    const ang = [0, 1, 2, 3].map(k => (r.anggota || [])[k] || "");
    return `
      <div class="regu-card" data-regu="${id}">
        <span class="badge badge-green">Regu ${i + 1} — ${
          esc(GOLONGAN_LABEL[r.golongan] || r.golongan)}${
          r.nomor_dada ? ` · ${esc(dada3(r.nomor_dada))}` : ""}</span>
        ${!intern ? "" : `
        <div class="field" style="margin:.45rem 0 .7rem">
          <label for="dp-kelas-${id}">Kelas / Organisasi</label>
          <input type="text" id="dp-kelas-${id}" data-f="kelas_organisasi" data-id="${id}"
                 maxlength="80" value="${esc(r.kelas_organisasi || "")}"
                 placeholder="misal: XI IPA 4 atau OSIS">
        </div>`}
        <div class="two-column">
          <div class="field" style="margin:0">
            <label for="dp-nama-${id}">Nama Regu</label>
            <input type="text" id="dp-nama-${id}" data-f="nama_regu" data-id="${id}"
                   maxlength="25" style="text-transform:uppercase"
                   value="${esc(r.nama_regu || "")}">
          </div>
          <div class="field" style="margin:0">
            <label for="dp-ketua-${id}">Nama Ketua</label>
            <input type="text" id="dp-ketua-${id}" data-f="nama_ketua" data-id="${id}"
                   value="${esc(r.nama_ketua || "")}">
          </div>
        </div>
        <div class="field" style="margin-top:.5rem">
          <label for="dp-ang-${id}-0">Nama Anggota (opsional)</label>
          ${ang.map((a, k) => `
            <input type="text" id="dp-ang-${id}-${k}" data-f="anggota${k}" data-id="${id}"
                   style="margin-top:.35rem" value="${esc(a)}"
                   placeholder="Nama Anggota ${k + 1}">`).join("")}
        </div>
      </div>`;
  };

  /* Disimpan saat kotaknya ditinggalkan (change), bukan tiap ketukan huruf:
     satu nama yang diketik pelan akan jadi belasan permintaan, dan tiap
     permintaan menulis satu baris riwayat. */
  const pasangBaris = (gambarUlang) => {
    const tbody = document.getElementById("isi-tabel");

    tbody.querySelectorAll("[data-detail]").forEach(btn =>
      btn.addEventListener("click", () => {
        const k = btn.dataset.detail;
        if (dibuka.has(k)) dibuka.delete(k); else dibuka.add(k);
        const row = tbody.querySelector(`[data-detail-untuk="${CSS.escape(k)}"]`);
        if (row) row.hidden = !dibuka.has(k);
        btn.setAttribute("aria-expanded", String(dibuka.has(k)));
        // Panahnya saja yang diganti, JUMLAHNYA jangan. Versi pertama menulis
        // ke firstChild.nodeValue — dan simpul pertama itu memuat "▸ 1",
        // bukan panahnya sendiri, jadi angkanya ikut terhapus dan tombolnya
        // berbunyi "-". Sekarang panahnya punya simpulnya sendiri.
        btn.querySelector(".panah").textContent = dibuka.has(k) ? "▾" : "▸";
      }));

    const kedip = (el) => {
      el.classList.add("saved");
      setTimeout(() => el.classList.remove("saved"), 1200);
    };

    const simpanKontak = async (kode, el) => {
      const b = semua.find(x => x.kode_pembayaran === kode);
      const nama = tbody.querySelector(`[data-kontak-nama="${CSS.escape(kode)}"]`).value.trim();
      const wa = tbody.querySelector(`[data-kontak-wa="${CSS.escape(kode)}"]`).value.trim();
      if (nama === (b.nama_kontak || "") && wa === (b.kontak_wa || "")) return;
      try {
        await ubahKontakPendaftaran(kode, nama, wa);
        b.nama_kontak = nama || null;
        b.kontak_wa = wa.replace(/\D/g, "").replace(/^62/, "0");
        tbody.querySelector(`[data-kontak-wa="${CSS.escape(kode)}"]`).value = b.kontak_wa;
        kedip(el);
      } catch (e) {
        notif(e instanceof ErrorApi ? e.message : "Kontak gagal disimpan.", true);
        gambarUlang();
      }
    };

    const simpanRegu = async (id, el) => {
      const r = semua.flatMap(x => x.regu || []).find(x => String(x.id) === id);
      const ambil = (f) => (tbody.querySelector(
        `[data-f="${f}"][data-id="${CSS.escape(id)}"]`)?.value || "").trim();
      const data = {
        nama_regu: ambil("nama_regu").toUpperCase(),
        nama_ketua: ambil("nama_ketua"),
        anggota: [0, 1, 2, 3].map(k => ambil(`anggota${k}`)).filter(Boolean),
        kelas_organisasi: ambil("kelas_organisasi"),
      };
      try {
        await ubahIdentitasRegu(id, data);
        Object.assign(r, {
          nama_regu: data.nama_regu, nama_ketua: data.nama_ketua,
          anggota: data.anggota.length ? data.anggota : null,
          kelas_organisasi: data.kelas_organisasi || null,
        });
        kedip(el);
      } catch (e) {
        notif(e instanceof ErrorApi ? e.message : "Regu gagal disimpan.", true);
        gambarUlang();
      }
    };

    tbody.querySelectorAll("[data-kontak-nama],[data-kontak-wa]").forEach(inp =>
      inp.addEventListener("change", () =>
        simpanKontak(inp.dataset.kontakNama || inp.dataset.kontakWa, inp)));

    tbody.querySelectorAll("[data-f][data-id]").forEach(inp =>
      inp.addEventListener("change", () => simpanRegu(inp.dataset.id, inp)));
  };

  gambar();
  pasangAlatTabel(gambar);
}
