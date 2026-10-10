/* ============================================================================
   hrcd-rekap : screens/pembayaran.js — layar Meja Pembayaran (#/pembayaran).

   Menandai pendaftaran lunas dan mencetak kwitansinya.
   ========================================================================== */

import { batalkanVerifikasi, daftarPendaftaran, sesi, tautanBukti,
         verifikasiPembayaran } from "../api.js";
import { alatTabel, barisTerakhirHtml, catatTerakhir, cocokCari, EDISI, LAYAR,
         layarButuhEdisi, pasangAlatTabel, pasangKepala,
         reguAktif } from "../common/frame.js";
import { pasangCentangRiwayat,
         tombolRiwayat } from "../common/riwayat-pendaftaran.js";
import { biayaRegu, dialog, esc, GOLONGAN_LABEL, h, html, ikon, kartuGagalMuat,
         notif, pemuat, rupiah, tanggalPanjang, totalBiaya } from "../util.js";

export async function layarPembayaran() {
  if (!EDISI) { layarButuhEdisi("Meja Pembayaran"); return; }
  pasangKepala("Meja Pembayaran", true);
  LAYAR.replaceChildren(h(pemuat()));

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
          { kode: "semua", label: "Semua" },
          { kode: "belum", label: "Belum bayar", pendek: "Belum" },
          { kode: "lunas", label: "Lunas" },
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
      // PENJUMLAHAN per regu, bukan perkalian: regu Internal berharga lain
      // (migrasi 0110), dan satu pendaftaran boleh memuat kedua jenis.
      // Angka ini dikirim apa adanya sebagai nominal ke verifikasi_pembayaran,
      // yang menghitung ulang dengan rumus yang sama di server dan menolak
      // kalau berbeda — jadi kedua sisi wajib memakai biayaRegu() yang sama.
      const tagihan = totalBiaya(EDISI, aktif);
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
      // HARUS di atas `metode` dan `aksi`, dan itu bukan selera: keduanya
      // menyisipkan ${nota} ke dalam template mereka, dan `const` yang dipakai
      // sebelum barisnya dijalankan melempar ReferenceError (temporal dead
      // zone) — bukan undefined.
      //
      // Ia pernah ditulis di bawah `metode`, dan akibatnya: SETIAP baris
      // gagal dirender, tbody kosong, sementara "39 invoice - 40 regu" di
      // atasnya tetap benar karena angka itu dihitung dari data, bukan dari
      // barisnya. Layarnya terlihat seperti daftar yang memang kosong.
      // `node --check` lulus — TDZ itu galat saat DIJALANKAN, bukan saat
      // di-parse — dan tidak ada tes yang membuka layar ini.
      // Nota transfer duduk DI KOLOM METODE, tepat sesudah cara bayarnya —
      // "Transfer LUNAS [nota]" — karena ia keterangan tentang pembayaran
      // itu, bukan sebuah aksi. Di kolom tombol ia terbaca sebagai perintah
      // ketiga sejajar Kwitansi dan Batalkan, padahal ia cuma lampiran.
      //
      // Kolom Metode DILEBARKAN 15% -> 20% supaya ketiganya muat SEBARIS;
      // 5% itu diambil dari kolom tombol, yang jadi longgar begitu labelnya
      // memendek. Angka dan alasannya di web/style.css, blok min-width 941px.
      //
      // Lencana, bukan .button-mini: 33x22 lawan 36x34. Tombol penuh menuntut
      // ruang seukuran aksi untuk sesuatu yang cuma dibuka sesekali, dan
      // tingginya menaikkan tinggi seluruh baris.
      const nota = b.bukti_transfer
        ? `<button class="badge badge-tombol" type="button"
                   data-bukti="${esc(b.bukti_transfer)}"
                   title="Nota pembayaran"
                   aria-label="Nota pembayaran">${ikon("file-text")}</button>`
        : "";

      const metode = b.status === "lunas"
        // Nomor kwitansi TIDAK ditampilkan di tabel: panjang, tidak pernah
        // dicari lewat layar ini, dan sudah tercetak di kwitansinya sendiri
        // — di situlah ia berguna saat menyusun berkas.
        // Cara bayar dan LUNAS SEBARIS, dibungkus satu pembungkus lentur.
        // Sebelumnya cara bayarnya di dalam <div> — elemen blok — jadi LUNAS
        // selalu jatuh ke baris berikutnya, bahkan di kartu HP yang kolomnya
        // lapang. Dengan flex-wrap ia tetap menumpuk sendiri di kolom tabel
        // lebar yang cuma 15%, jadi satu aturan melayani kedua tampilan.
        // DIUKUR, bukan dikira-kira (pasal 15.9). Di kolom Metode yang lebarnya
        // 123px — 15% dari lantai 820px — pasangan "Transfer" + lencana LUNAS
        // memakan 124px apa adanya, jadi ia meluap satu piksel dan membungkus
        // jadi dua baris. gap .25rem saja sudah muat (122px), tetapi cuma
        // bersisa 1px; dengan teks metode .9em ia jadi 117px dan punya jarak
        // yang tidak habis oleh satu huruf yang lebih lebar di HP lain.
        // Template biasa, BUKAN tag html``: nota sudah berupa HTML, dan html``
        // meng-escape apa pun yang disisipkan — tombolnya akan TERCETAK
        // sebagai teks. Nilai dari luar tetap lewat esc() satu per satu.
        ? `<span class="metode-baris" style="flex-wrap:nowrap;gap:.25rem"
           ><span class="metode-kata">${esc(b.pembayaran ? b.pembayaran.method : "—")}</span
           >${tombolRiwayat(b.kode_pembayaran, "LUNAS",
               "badge badge-green badge-klik")}${nota}</span>`
        : b.status === "batal"
          ? `<span class="badge badge-red">BATAL</span>`
          // Yang terpilih lebih dulu adalah cara bayar yang DIPILIH PEMBINA saat
          // mendaftar (migrasi 0121) — bukan tebakan, dan bukan pula janji: yang
          // dicatat tetap yang dipilih petugas di sini, karena uangnyalah yang
          // menentukan. Pendaftaran lama tidak menyimpannya, dan untuk mereka
          // tunai tetap yang terpilih seperti sebelumnya.
          // Template biasa, BUKAN tag html``. Nilainya lewat esc() satu per
          // satu — html`` meng-escape apa pun yang disisipkan, dan itu pernah
          // membuat tombol di sini TERCETAK sebagai teks.
          // nowrap DI SINI saja, bukan di kelasnya: pasangan LUNAS di atas memang
          // perlu menumpuk sendiri di kolom sempit. Di sini yang berdampingan
          // cuma dropdown, dan kolomnya memang hanya cukup untuk itu.
          : `<span class="metode-baris" style="flex-wrap:nowrap"
             ><select class="select-small" data-metode="${esc(b.kode_pembayaran)}">
                <option value="tunai" ${b.metode_bayar === "transfer" ? "" : "selected"}>Tunai</option>
                <option value="transfer" ${b.metode_bayar === "transfer" ? "selected" : ""}>Transfer</option>
              </select>${nota}</span>`;

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
      /* .text-center — Pembuka rincian duduk DI KOLOM REGU, bukan di bawah nama
         sekolah. Angkanya sama persis dengan yang dulu tercetak di
         kolom ini, jadi menaruhnya di sini menghapus satu pengulangan
         sekaligus mengembalikan lebar ke kolom Sekolah.
         Kata "regu" dibungkus <span class="satuan-regu"> karena hanya
         dipakai di kartu HP — di tabel, judul kolomnya sudah menyebut
         REGU dan mengulanginya cuma memakan lebar. Pembaca layar tetap
         mendapat kalimat utuh lewat aria-label, di kedua tampilan. */
      return `
        <tr class="invoice-row" data-baris="${kode}">
          <td class="mono" data-label="Kode Bayar">${kode}</td>
          <td data-label="Sekolah">
            <strong>${sekolah}</strong>
            ${aktif.length ? "" : `<div class="sub">semua regu batal</div>`}
          </td>
          <td class="text-center" data-label="Regu">
            ${aktif.length
              ? `<button class="button-detail" type="button" data-detail="${kode}"
                         data-jumlah="${aktif.length}" aria-expanded="${terbuka}"
                         aria-label="Lihat ${aktif.length} regu ${sekolah}">${
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
                    <td class="text-right">${esc(rupiah(biayaRegu(EDISI, r.golongan)))}</td>
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

    // Riwayat perubahan invoice ini. Dipasang sekali per penggambaran, bukan
    // per baris — tabelnya digambar ulang tiap kali saringan atau pencarian
    // berubah, dan penangan yang menempel di baris lama ikut hilang bersamanya.
    pasangCentangRiwayat(tbody);

    // Bukti transfer yang diunggah pembina. Bucket-nya privat, jadi tautannya
    // ditandatangani saat diketuk — dan jendelanya dibuka SEBELUM await, karena
    // browser HP memblokir jendela yang dibuka sesudah menunggu jaringan.
    tbody.querySelectorAll("[data-bukti]").forEach(btn =>
      btn.addEventListener("click", async () => {
        const jendela = window.open("", "_blank");
        try {
          const url = await tautanBukti(btn.dataset.bukti);
          if (jendela && url) jendela.location = url; else if (jendela) jendela.close();
        } catch (err) {
          if (jendela) jendela.close();
          notif(`Bukti tidak bisa dibuka: ${err.message}`, true);
        }
      }));

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
          medan: [{ label: "Alasan pembatalan", contoh: "misal: salah nominal" }],
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
        const tagihan = totalBiaya(EDISI, aktif);

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
            <div class="detail">${b.sekolah?.name || kode} · ${kode}<span
              class="detail-separator-mobile"> · </span><span
              class="detail-regu-mobile">${aktif.length} regu · ${rupiah(tagihan)}</span></div>
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
/* Namanya `method`, bukan `metode` — migrasi 0014 mengganti nama kolomnya
   dan SELURUH pembaca ikut, kecuali baris ini.
   Akibatnya tidak terlihat sampai kwitansi dicetak TEPAT SETELAH verifikasi,
   sebelum halaman dimuat ulang: sampai saat itu yang dibaca layar adalah
   objek buatan sini, bukan baris dari database. Kwitansinya berbunyi "Cara
   bayar: —" — dan kertas itu dipegang pembina sampai hari lomba.
   Muat ulang halaman menyembuhkannya sendiri, yang justru membuat cacat ini
   nyaris mustahil ditemukan dengan mencoba-coba. */
export function tandaiLunasLokal(b, nominal, method, nomorKwitansi) {
  b.status = "lunas";
  b.pembayaran = {
    nominal, method, nomor_kwitansi: nomorKwitansi,
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
export function cetakKwitansi(daftar) {
  document.getElementById("cetakan")?.remove();
  const s = sesi();
  const tanggal = (t) => tanggalPanjang(t || Date.now());

  const halaman = daftar.map(b => {
    const aktif = reguAktif(b);
    const bayar = b.pembayaran || {};
    const total = bayar.amount ?? totalBiaya(EDISI, aktif);
    const baris = aktif.map((r, i) => html`
      <tr><td>${String(i + 1)}</td>
          <td>${r.nama_regu}</td>
          <td>${GOLONGAN_LABEL[r.golongan] || r.golongan}</td>
          <td>${r.nama_ketua}</td>
          <td class="text-right">${rupiah(biayaRegu(EDISI, r.golongan))}</td></tr>`).join("");

    /* Dulu baris ini berbunyi "N regu @ Rp X". Sejak regu Internal punya
       harganya sendiri (migrasi 0110) tidak ada lagi SATU harga satuan
       yang benar untuk setiap batch, dan menuliskan salah satunya di
       kwitansi yang dipegang pembina lebih buruk daripada tidak
       menuliskannya. Angkanya tidak hilang: tabel di bawah menyebut
       biaya tiap regu satu per satu, lalu TOTAL-nya. */
    return `
      <section class="print-page">
        <h1>KWITANSI — ${esc(EDISI ? EDISI.name : "")}</h1>
        <p class="receipt-number">${esc(bayar.nomor_kwitansi || "—")}</p>
        <p><strong>Diterima dari:</strong> ${esc(b.sekolah?.name || "—")}</p>
        <p><strong>Kode pembayaran:</strong> ${esc(b.kode_pembayaran)}
           · <strong>Cara bayar:</strong> ${esc(bayar.method || "—")}<br>
           <span class="receipt-date"><strong>Tanggal:</strong>
             ${esc(tanggal(bayar.verified_at))}</span></p>
        <p><strong>Untuk pembayaran:</strong> pendaftaran ${aktif.length} regu</p>
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
        <p class="print-note">
           Simpan dan bawa saat daftar ulang.</p>
      </section>`;
  }).join("");

  document.body.appendChild(h(`<div id="cetakan" class="printout">${halaman}</div>`));
  window.print();
}
