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
  infoEdisi, infoPengaturanKloter, aturPlanningBerangkat, ringkasanMeja, daftarPendaftaran,
  dataPeserta, ubahKontakPendaftaran, ubahIdentitasRegu,
  verifikasiPembayaran, batalkanVerifikasi, daftarUlang, tukarNomor,
  daftarKloter, tandaiKloterDicetak, pindahKloter, daftarSisipan,
  cariRegu, catatFinish, infoPenalti,
  papanKeberangkatan, reguKloter, kontrakOpsi,
  konfirmasiKontrak, ceklisBerangkat, batalCeklisBerangkat, berangkatkanKloter,
  koreksiJamBerangkat,
  daftarPos, komponenPos, lembarPos, lembarPosSatu, simpanNilaiPos, hapusNilaiPos,
  rentangNomorDada,
  komponenSemua, rekapPenuh, kelengkapanPos, riwayatNilai,
  kunciNilaiPos, bukaKunciNilaiPos,
  unggahFotoLembar, daftarFotoLembar, fotoLembarPos, tautanFoto, klasemenLiveScore,
  unggahFotoMasuk, daftarFotoBelumTaut, tautkanFoto, kuotaFoto,
  statusAcara, bolehLihat, lengkapiHakSesi,
  aturFaseLive,
  daftarAkun, ubahPeranAkun, setAktifAkun, buatAkun, resetPasswordAkun, daftarPanitia,
  ubahUsernameAkun, daftarFitur, daftarHak, setHak, tautanFotoBanyak,
  hapusFotoLembar, tautanBukti,
} from "./api.js";
import { esc, h, html, rupiah, jamMenit, tanggalPanjang, tanggalJam, notif, kapital,
         meterSah,
         dialog, kartuGagalMuat, jamSah, pasangKotakJam,
         berapaLalu, pemuat, ikonRefresh, detikSah, detikTeks,
         kotakJamHtml, kecilkanFoto, ukuranRapi, ikon, ikonKotak, dada3,
         angkaRapi, nilaiTeks, nilaiBagian, kolomPos, kontrakTeks,
         jamPadaHari, bacaAnggotaHadir, kotakBerikutnyaDalamKolom,
         GOLONGAN_LABEL, URUT_GOLONGAN, biayaRegu, totalBiaya,
         varianUntuk, kelompokLomba, ringkasLomba } from "./util.js";
import { hitungRekomendasiKloter, jadwalPlanning } from "./departure-calculator.mjs";
import { deretCocok, deretIntern, nomorStok, pesanDeret }
  from "./nomor-dada-series.mjs";

const LAYAR = document.getElementById("layar");

// Header dan menu bawah masih berupa HTML statis agar label dan tujuan
// navigasinya tersedia sejak awal. Jalur SVG-nya tetap punya satu sumber di
// util.js; keduanya tersembunyi sampai ikon ini terpasang.
document.querySelectorAll("[data-ikon]").forEach((tempat) => {
  tempat.replaceChildren(h(ikon(tempat.dataset.ikon)));
});

/** Golongan versi pendek, HANYA untuk kertas. Di layar tetap panjang — di sana
 *  lebar tidak diperebutkan siapa pun, dan dua nama untuk satu hal cuma
 *  sepadan kalau ada yang dibeli dengannya.
 *
 *  Di lembar cadangan ia diperebutkan, dan yang kalah selama ini nama regu dan
 *  sekolah: keduanya dipotong elipsis supaya tinggi baris tetap seragam.
 *  "Penggalang PA" 13 huruf jadi "Pgl Pa" 6 huruf — sekitar 10mm kembali ke
 *  kolom nama, di kertas yang memang sedang kekurangan.
 *
 *  Singkatannya dipilih panitia: Pgl dan Pgk. Versi pertama saya "Png" untuk
 *  Penegak, dan itu lebih buruk — Png dan Pgl berbeda di dua huruf TENGAH yang
 *  sama-sama tidak menonjol, sementara Pgk dan Pgl berbeda di huruf TERAKHIR,
 *  tempat mata berhenti.
 *
 *  Sekalipun tertukar, akibatnya terbatas: kolom ini keterangan, bukan kunci.
 *  Nilai mengalir lewat nomor dada, jadi golongan yang salah baca tidak pernah
 *  memindahkan angka ke regu lain. */
const GOLONGAN_SINGKAT = {
  penegak_pa: "Pgk Pa", penegak_pi: "Pgk Pi",
  penggalang_pa: "Pgl Pa", penggalang_pi: "Pgl Pi",
  intern_pa: "Int Pa", intern_pi: "Int Pi",
};
let EDISI = null;

/* Layar yang sanggup memperbarui dirinya SENDIRI tanpa digambar ulang
   mendaftar di sini; kembali dari tab lain memanggil INI, bukan menggambar
   ulang layarnya. Kosong berarti "gambar ulang saja" — itu yang berlaku
   untuk hampir semua layar, dan memang benar untuk mereka.

   Dideklarasikan di atas, bersama keadaan modul yang lain, meski yang
   memakainya jauh di bawah: yang membacanya nanti harus bisa menemukan
   seluruh keadaan yang hidup selama satu sesi di satu tempat. */
let segarkanDiTempat = null;

/* ---------------------------------------------------------------------------
   PENDENGAR DAN PENGAMAT MILIK SATU LAYAR

   Yang dipasang pada `window` atau lewat Resize/IntersectionObserver TIDAK
   ikut hilang ketika `LAYAR.replaceChildren()` mengganti isinya: keduanya
   dipegang objek yang hidup lebih lama daripada elemennya. Tanpa dilepas,
   tiap kunjungan menambah satu salinan — dan salinan itu menahan seluruh
   closure layarnya, termasuk `lembar` yang berisi ratusan baris nilai.

   Yang menumpuk paling cepat bukan navigasi biasa. Dropdown pemilih pos
   memanggil `layarInputPos()` lagi tanpa lewat `arahkan()`, jadi koordinator
   pos yang menyapu kelima pos bolak-balik sepanjang pagi menumpuk satu
   salinan tiap perpindahan. Karena itu layarnya sendiri yang meminta sinyal
   baru, bukan hanya router.

   Gejalanya nol: `ulangYangGagal()` sudah menjaga diri dengan
   `document.body.contains(tbody)`, jadi salinan lama memang tidak melakukan
   apa-apa. Yang tertinggal memorinya, dan tidak ada yang akan melihatnya
   sampai satu HP kehabisan.

   Polanya menyalin `pengendaliFilterSekolah` di bawah, yang sudah memakai
   AbortController justru untuk alasan yang sama. */
let pengendaliLayar = new AbortController();

/** Lepaskan semua yang dipasang layar sebelumnya, lalu beri sinyal baru. */
function sinyalLayarBaru() {
  pengendaliLayar.abort();
  pengendaliLayar = new AbortController();
  return pengendaliLayar.signal;
}

/** Putuskan pengamat saat layarnya ditinggalkan.
 *
 *  AbortController tidak mengenal Resize/IntersectionObserver — `signal`
 *  hanya melepas `addEventListener`. Jadi pengamatnya dititipkan ke peristiwa
 *  `abort` sinyal yang sama, supaya satu saklar tetap mengurus keduanya. */
const putusSaatPindah = (sinyal, pengamat) =>
  sinyal.addEventListener("abort", () => pengamat.disconnect(), { once: true });

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
/** Nama acara untuk judul tab: "HRCD XXXVII" — diambil apa adanya dari nama
 *  edisi di database, bukan ditulis di sini. Tahun depan cukup mengubah satu
 *  baris di tabel edisi.
 *
 *  Bentuk pendek, bukan "Hiking Rally Ciradyka XXXVII": judul tab dipotong
 *  browser di sekitar 25 huruf, dan panitia membuka layar ini bersama belasan
 *  tab lain di HP. Yang harus terbaca di potongan itu adalah "Sistem
 *  Panitia", bukan nama acara yang sudah mereka tahu. Sebelum edisi termuat
 *  (layar masuk), sisakan "HRCD" saja. */
const namaAcara = () => (EDISI && EDISI.name) ? String(EDISI.name) : "HRCD";

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
    document.getElementById("nav-akun")
      .setAttribute("aria-current", location.hash === "#/account" ? "page" : "false");
  }
  // Akun hanya untuk admin. Disembunyikan, BUKAN dinonaktifkan: tombol mati di
  // pojok header tidak memberi tahu apa pun selain bahwa ada sesuatu yang
  // tidak boleh disentuh.
  // Ikut CENTANG, bukan peran: admin yang centang Akun-nya dicabut tidak
  // boleh tetap melihat tombolnya (0057).
  const adminSaja = !!s && bolehLihat("akun");
  document.getElementById("btn-akun").hidden = !adminSaja;
  document.getElementById("nav-akun").hidden = !adminSaja;
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
  pasangKepala("Sistem Panitia");
  LAYAR.replaceChildren(h(`
    <div class="card" style="max-width:480px;margin:2rem auto">
      <!-- Dibungkus supaya HILANG saat pendaftaran dibuka. Dua formulir
           bertumpuk di satu kartu — dua kotak Password, dua tombol hijau —
           adalah cara orang mengisi yang bawah lalu menekan yang atas. -->
      <div class="blok-masuk">
        <h2>Masuk Panitia</h2>
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

      <!-- BUKAN <details>, dan itu keputusan yang dibayar sekali.
           <details> menyembunyikan isinya sendiri sebelum CSS sempat ikut
           campur, jadi tidak ada yang bisa dianimasikan: isinya lenyap dan
           muncul seketika. Dengan tombol dan kelas biasa, kedua blok tetap
           ada di DOM dan tingginya bisa dijalankan pelan.

           Harganya: keadaannya sekarang disimpan di kelas "mode-daftar" pada
           kartunya, bukan di atribut bawaan browser. Satu tempat, dan tombol
           di bawah ini satu-satunya yang mengubahnya.

           TANPA BACKTICK DI KOMENTAR INI. Seluruh markup layar login duduk di
           dalam sebuah template literal, jadi satu backtick di sini menutup
           string itu dan sisa kalimatnya dibaca sebagai KODE. Itu persis yang
           terjadi sekali: layar login berhenti di "Memuat..." dengan
           "ReferenceError: daftar is not defined", dan pemeriksaan sintaks
           tetap hijau karena hasilnya kebetulan JavaScript yang sah. -->
      <button type="button" class="ganti-mode" id="ganti-mode"
              aria-expanded="false" aria-controls="panel-daftar">
        <span class="d-tutup">Belum punya akun? <b>Daftar</b></span>
        <span class="d-buka"><b>Login</b></span>
      </button>
      <div class="panel-daftar" id="panel-daftar">
        <div class="field">
          <label for="d-u">Nama akun</label>
          <input type="text" id="d-u" autocomplete="username" autocapitalize="none"
                 spellcheck="false" placeholder="misal: aji.furqon">
        </div>
        <div class="field">
          <label for="d-p">Password</label>
          <input type="password" id="d-p" autocomplete="new-password"
                 placeholder="minimal 8 karakter">
        </div>
        <div class="field">
          <label for="d-peran">Tugas</label>
          <!-- KOORDINATOR POS TIDAK ADA DI SINI, seperti admin. Keduanya
               peran yang membuka lebih dari satu meja: koordinator pos punya
               kolom pos KOSONG, dan justru itu yang membuka KELIMA pos
               (CLAUDE.md 13.2). Pintu ini tidak dijaga siapa pun -- siapa saja
               yang membuka layar login boleh memakainya -- jadi peran yang
               melintasi pos hanya boleh DIBERIKAN admin di layar Akun, bukan
               dipilih sendiri oleh yang mendaftar.

               Lahir nonaktif tidak cukup sebagai pengganti: admin yang menekan
               Aktifkan sedang menjawab "orang ini benar", dan belum tentu
               memperhatikan peran apa yang dipilihkan orang itu untuk dirinya
               sendiri.

               Gateway menolaknya juga. Daftar di sini cuma menyembunyikan;
               yang menegakkan workers/gateway/worker.js, karena kotak ini bisa
               diubah dari devtools dalam sepuluh detik.

               TANPA BACKTICK DI KOMENTAR INI -- lihat catatan panjang di atas
               tombol ganti-mode. Komentar ini duduk di dalam template literal,
               dan satu backtick menutupnya. -->
          <select id="d-peran" class="select-small">
            <option value="juri_pos">Juri Pos</option>
            <option value="registrasi">Registrasi</option>
            <option value="gerbang">Gerbang</option>
          </select>
        </div>
        <div class="field" id="d-pos-kotak">
          <label for="d-pos">Pos</label>
          <input type="number" id="d-pos" class="small-input" inputmode="numeric"
                 min="1" max="20" placeholder="misal: 3">
        </div>
        <!-- Satu kalimat, dan ia membawa fakta yang TIDAK bisa dibaca dari
             layar: akunnya belum hidup. Tanpa ini orang mendaftar, mencoba
             masuk, gagal, lalu mendaftar lagi dengan nama lain (bagian 9.4). -->
        <p class="keterangan">Setelah daftar, harus diaktivasi manual oleh admin.</p>
        <button class="button button-primary" id="d-kirim" type="button">Daftar</button>
      </div>
    </div>
  `));
  const u = document.getElementById("u");
  u.focus();

  /* Berganti antara Masuk dan Daftar. Kelasnya di KARTU, bukan di panelnya:
     yang berubah dua blok sekaligus — satu menyusut, satu tumbuh — dan dua
     kelas untuk satu keadaan adalah dua kelas yang suatu hari tidak sepakat. */
  const kartu = LAYAR.querySelector(".card");
  const tombolGanti = document.getElementById("ganti-mode");
  const blokMasuk = LAYAR.querySelector(".blok-masuk");
  const panelDaftar = document.getElementById("panel-daftar");

  /* `overflow: hidden` HANYA selama bergerak, tidak sesudahnya.

     Ia wajib ada saat menyusut dan tumbuh — tanpa itu isinya tumpah keluar
     kotak setinggi nol dan animasinya tidak menyembunyikan apa pun. Tapi
     kalau ia tetap menempel sesudah gerakannya selesai, dua hal rusak di
     kotak isian di dalamnya: cincin fokus birunya TERPOTONG di tepi, dan
     browser HP yang menggeser isian ke dalam wadah terpotong terasa
     tersendat sepersekian detik tiap kali kotak disentuh.

     Jadi ia dipasang saat pergantian dimulai dan dilepas begitu selesai. */
  const bergerak = (ms = 340) => {
    blokMasuk.style.overflow = "hidden";
    panelDaftar.style.overflow = "hidden";
    setTimeout(() => {
      const terbuka = kartu.classList.contains("mode-daftar") ? panelDaftar : blokMasuk;
      terbuka.style.overflow = "visible";
    }, ms);
  };
  // Keadaan awal: yang terbuka sudah diam, jadi ia tidak perlu menunggu.
  blokMasuk.style.overflow = "visible";

  tombolGanti.addEventListener("click", () => {
    const daftar = kartu.classList.toggle("mode-daftar");
    tombolGanti.setAttribute("aria-expanded", String(daftar));
    bergerak();
    // Fokus dipindahkan ke isian pertama yang baru terlihat. Tanpa ini, di HP
    // panelnya terbuka di bawah jempol sementara kursor masih di kotak yang
    // sudah tidak ada.
    setTimeout(() => (daftar ? document.getElementById("d-u") : u).focus(), 260);
  });

  /* PERIKSA SAAT DIKETIK, bukan saat dikirim. Nama akun dan password punya
     syarat yang tidak bisa ditebak dari kotaknya, dan menahannya sampai tombol
     ditekan berarti orang mengetik seluruh formulir dulu baru diberi tahu
     yang pertama salah.

     `aria-invalid` yang dipakai, bukan kelas sendiri: aturan merahnya sudah
     ada di style.css untuk seluruh isian, dan pembaca layar ikut
     mengumumkannya tanpa tambahan apa pun. */
  /* Huruf, angka, dan TITIK — `aji.furqon`. Titiknya hanya boleh MEMISAHKAN,
     tidak di ujung dan tidak dua kali berturut-turut: nama yang berbunyi
     "....." lolos pola yang lebih longgar, lalu dipakai membentuk alamat
     surel akun dan ditolak penyedia auth dengan pesan yang tidak menyebut
     titik sama sekali. */
  const SAH_NAMA = /^[a-z0-9]+(?:\.[a-z0-9]+)*$/;
  const namaSah = (v) => v.length >= 5 && v.length <= 40 && SAH_NAMA.test(v);
  // Password BEBAS simbol — yang dibatasi cuma panjangnya. Membatasi
  // hurufnya cuma memperkecil kemungkinan yang harus ditebak orang lain,
  // dan tidak menolong siapa pun di sini.
  const SAH_SANDI = /^.{8,}$/;
  const periksa = (el, sah) => {
    const isi = el.value.trim();
    // Kotak KOSONG bukan kotak salah. Memerahkannya sebelum satu huruf pun
    // diketik membuat formulir terlihat rusak saat baru dibuka.
    el.setAttribute("aria-invalid", isi === "" ? "false" : String(!sah(isi)));
  };
  const dU = document.getElementById("d-u");
  const dP = document.getElementById("d-p");
  dU.addEventListener("input", () => periksa(dU, v => namaSah(v.toLowerCase())));
  dP.addEventListener("input", () => periksa(dP, v => SAH_SANDI.test(v)));

  /* Kotak Pos hanya untuk Juri Pos — itu check constraint di database
     (0058), bukan selera: peran lain WAJIB berpos kosong, dan Koordinator Pos
     justru dikenali dari posnya yang kosong. */
  const dPeran = document.getElementById("d-peran");
  const dPosKotak = document.getElementById("d-pos-kotak");
  const perluPos = () => dPeran.value === "juri_pos";
  const setelPos = () => { dPosKotak.hidden = !perluPos(); };
  setelPos();
  dPeran.addEventListener("change", setelPos);

  document.getElementById("d-kirim").addEventListener("click", async () => {
    const btn = document.getElementById("d-kirim");
    const nama = document.getElementById("d-u").value.trim().toLowerCase();
    const sandi = document.getElementById("d-p").value;
    const pos = perluPos() ? Number(document.getElementById("d-pos").value) || null : null;

    // Diperiksa di sini SEKALIPUN gateway juga memeriksanya — bukan sebagai
    // pagar, melainkan supaya salah ketik dijawab seketika alih-alih sesudah
    // satu perjalanan jaringan di sinyal lapangan.
    if (!namaSah(nama)) {
      notif("Nama akun minimal 5: huruf, angka, dan titik.", true);
      dU.focus(); return;
    }
    if (!SAH_SANDI.test(sandi)) {
      notif("Password minimal 8 karakter.", true);
      dP.focus(); return;
    }
    if (perluPos() && !pos) { notif("Juri pos harus menyebut posnya.", true); return; }

    btn.disabled = true; btn.textContent = "Mengirim…";
    try {
      await daftarPanitia({ username: nama, password: sandi, peran: dPeran.value, pos });
      layarLogin(`Akun ${nama} terdaftar. Minta admin menyalakannya, lalu masuk.`);
    } catch (e) {
      btn.disabled = false; btn.textContent = "Daftar";
      notif(e instanceof ErrorApi ? e.message : "Pendaftaran gagal.", true);
    }
  });
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

  // Nomor edisi diambil SEBELUM login, supaya judul tab sudah berbunyi
  // "Sistem Panitia — HRCD XXXVII" di layar masuk, bukan "Sistem Panitia —
  // HRCD" yang menggantung. Boleh: v_edisi_publik memang di-grant ke anon
  // (migrasi 0005) — halaman pendaftaran publik membacanya dengan cara yang
  // sama persis. Gagalnya diabaikan; judul yang kurang satu kata bukan
  // alasan menahan kotak login.
  if (!EDISI) {
    infoEdisi()
      .then(e => { EDISI = e; if (!sesi()) pasangKepala("Sistem Panitia"); })
      .catch(() => {});
  }
}

/* ============================ BERANDA MEJA (home) ========================= */

async function layarHome() {
  // Lebar penuh: pada 760px hanya muat dua kolom, dan menu sepuluh tombol
  // jadi kolom sempit dengan lapangan kosong di kanannya. 1080px muat tiga,
  // sehingga seluruh menu terlihat sekaligus tanpa menggulir. Di HP grid-nya
  // tetap runtuh jadi satu kolom — minmax(280px, 1fr) yang memutuskan, bukan
  // lebar wadahnya.
  pasangKepala("Home", true);
  const peran = sesi().peran;
  LAYAR.replaceChildren(h(pemuat()));

  // Operator pos tidak berhak atas layar meja — RLS akan mengosongkan
  // datanya dan itu tampak seperti "tidak ada antrean" (temuan review).
  // Tapi ia punya satu layar sendiri, dan Home-nya harus menunjukkan layar
  // itu: sebelumnya halaman ini buntu, dan akun pos tidak punya jalan ke
  // mana pun kecuali mengetik alamatnya sendiri.
  // Yang hanya memegang pos tidak punya layar meja sama sekali; papan penuh
  // untuknya adalah papan berisi ubin yang semuanya menjawab kosong.
  if (bolehLihat("pos") && !bolehLihat("pembayaran") && !bolehLihat("keberangkatan")) {
    // Template BIASA, bukan html`` — dan itu bukan kelalaian yang dirapikan
    // belakangan. html`` meng-escape SETIAP sisipan, sedangkan ikonKotak()
    // mengembalikan markup; disisipkan ke sana ia tampil sebagai kode SVG
    // mentah sepanjang empat baris, bukan sebagai ikon. Menu di bawah ini
    // memakai template biasa untuk alasan yang sama.
    //
    // Cacat ini hanya terlihat oleh akun juri pos, dan tidak ada yang login
    // sebagai juri pos sampai hari simulasi.
    //
    // Yang tetap wajib di-escape: nilai dari database. Di sini cuma `pos`.
    LAYAR.replaceChildren(h(`
      <div class="function-menu">
        <a href="#/pos">
          <div class="function-name">${ikonKotak("square-pen", "nila")} Input Nilai Pos${
            sesi().pos != null && sesi().pos !== "" ? ` ${esc(sesi().pos)}` : ""}</div>
        </a>
        <a href="#/foto">
          <div class="function-name">${ikonKotak("camera", "biru")} Foto Jawaban</div>
        </a>
        ${bolehLihat("live_score") ? `
        <a href="#/live-score">
          <div class="function-name">${ikonKotak("medal", "emas")} Live Score</div>
        </a>` : ""}
      </div>
`));
    return;
  }

  let r = null, galat = null;
  try { r = await ringkasanMeja(); } catch (e) { galat = e.message; }
  const lencana = (n) => n === null
    ? `<span class="badge badge-gray" title="jumlah antrean tidak terbaca">?</span>`
    : `<span class="badge ${n > 0 ? "badge-yellow" : "badge-green"}">${n}</span>`;

  /* KEMAJUAN, bukan antrean — dan karena itu lencananya BERBEDA.
   *
   *  lencana() di atas berarti "masih ada N yang menunggu dikerjakan": kuning
   *  saat ada, hijau saat habis. Kemajuan berlawanan arah — 0/53 adalah pagi
   *  yang belum mulai, 53/53 adalah pekerjaan selesai. Memakai lencana yang
   *  sama akan mewarnai hijau tepat pada keadaan yang paling belum selesai.
   *
   *  Jadi netral sepanjang jalan, dan hijau HANYA saat penuh. */
  const kemajuan = (sudah, dari, judulMustahil) => {
    // `== null`, BUKAN `=== null`: kalau ringkasannya tidak memuat field ini
    // sama sekali nilainya undefined, dan `=== null` melewatkannya — papan
    // Home lalu menggambar "undefined/undefined" di ubin Keberangkatan.
    if (sudah == null || dari == null) return "";
    /* Pembilang MELEBIHI penyebut berarti data rusak, bukan kemajuan.
       Regu tidak bisa datang tanpa berangkat, jadi 44/10 hanya mungkin kalau
       ada baris closing tanpa baris keberangkatan yang cocok — dan itu
       menghilangkan regu-regu itu dari klasemen, karena v_klasemen menuntut
       keduanya. Dimerahkan, bukan dibulatkan: angka yang dirapikan menyembunyikan
       persoalan yang justru paling perlu dilihat. */
    const mustahil = sudah > dari;
    const penuh = !mustahil && dari > 0 && sudah >= dari;
    const kelas = mustahil ? "badge-red" : penuh ? "badge-green" : "badge-kemajuan";
    return `<span class="badge ${kelas}"${mustahil && judulMustahil
      ? ` title="${esc(judulMustahil)}"` : ""}
      >${esc(String(sudah))}/${esc(String(dari))}</span>`;
  };

  LAYAR.replaceChildren(h(`
    ${galat ? kartuGalat(`Jumlah antrean tidak bisa dibaca: ${galat}`) : ""}
    <div class="function-menu">
      <!-- Form pendaftaran tidak lagi tinggal di situs ini: ia pindah ke
           situs PESERTA bersama rekap live, supaya alamat yang beredar ke
           ratusan orang bukan alamat yang ada kotak loginnya. Karena beda
           asal, tautannya mutlak dan diambil dari config.js. -->
      ${bolehLihat("pendaftaran") ? `
      <a href="${esc((window.HRCD && window.HRCD.pesertaUrl) || "")}/daftar.html"
         target="_blank" rel="noopener">
        <div class="function-name">${ikonKotak("clipboard-list", "biru")} Pendaftaran</div>
      </a>` : ""}
      <!-- Data Peserta duduk tepat di sebelah Pendaftaran, dan itu bukan
           soal tata letak: keduanya satu pekerjaan yang sama dibelah dua oleh
           waktu. Yang satu menerima apa yang diketik pembina, yang satu
           membetulkannya waktu pembina menelepon karena salah ketik. Haknya
           pun sama: hak pendaftaran. (Tanpa backtick di komentar ini — ia
           berada DI DALAM template literal, dan satu backtick menutupnya.) -->
      ${bolehLihat("pendaftaran") ? `
      <a href="#/data-peserta">
        <div class="function-name">${ikonKotak("id-card", "toska")} Data Peserta</div>
      </a>` : ""}
      ${bolehLihat("pembayaran") ? `
      <a href="#/pembayaran">
        <div class="function-name">${ikonKotak("credit-card", "hijau")} Pembayaran ${lencana(r ? r.menunggu_pembayaran : null)}</div>
      </a>` : ""}
      ${bolehLihat("daftar_ulang") ? `
      <a href="#/daftar-ulang">
        <div class="function-name">${ikonKotak("id-card", "ungu")} Daftar Ulang ${lencana(r ? r.lunas_belum_nomor : null)}</div>
      </a>` : ""}
      ${bolehLihat("cetak_kloter") ? `
      <a href="#/cetak-kloter">
        <div class="function-name">${ikonKotak("list-ordered", "toska")} Daftar Kloter</div>
      </a>` : ""}
      ${bolehLihat("keberangkatan") ? `
      <a href="#/keberangkatan">
        <div class="function-name">${ikonKotak("flag", "jingga")} Keberangkatan ${
          kemajuan(r ? r.regu_berangkat : null, r ? r.regu_siap : null)}</div>
      </a>` : ""}
      ${bolehLihat("kedatangan") ? `
      <a href="#/finish">
        <div class="function-name">${ikonKotak("circle-check", "zamrud")} Kedatangan ${
          kemajuan(r ? r.regu_datang : null, r ? r.regu_berangkat : null,
            "Ada regu tercatat datang tapi tidak tercatat berangkat. "
            + "Regu itu TIDAK masuk klasemen — periksa layar Keberangkatan.")}</div>
      </a>` : ""}
      ${bolehLihat("pos") ? `
      <a href="#/pos">
        <div class="function-name">${ikonKotak("square-pen", "nila")} Input Nilai Pos</div>
      </a>` : ""}
      ${bolehLihat("pos") ? `
      <a href="#/foto">
        <div class="function-name">${ikonKotak("camera", "biru")} Foto Jawaban</div>
      </a>` : ""}
      ${bolehLihat("live_score") ? `
      <a href="#/live-score">
        <div class="function-name">${ikonKotak("medal", "emas")} Live Score</div>
      </a>` : ""}

      ${bolehLihat("pengaturan") ? `
      <a href="#/pengaturan-kloter">
        <div class="function-name">${ikonKotak("settings", "abu")} Kalkulator Keberangkatan</div>
      </a>` : ""}
    </div>
  `));
}

/* ============================ PENGATURAN KLOTER ========================== */

async function layarPengaturanKloter() {
  pasangKepala("Kalkulator Keberangkatan");
  if (!bolehLihat("pengaturan")) {
    LAYAR.replaceChildren(h(kartuGalat(
      "Akun ini tidak berhak membuka Kalkulator Keberangkatan.")));
    return;
  }
  LAYAR.replaceChildren(h(pemuat()));

  let cfg;
  try { cfg = await infoPengaturanKloter(); }
  catch (e) {
    LAYAR.replaceChildren(kartuGagalMuat(e.message, layarPengaturanKloter));
    return;
  }

  // Postgres mengirim TIME sebagai HH:MM:SS. Kotak jam hanya perlu HH:MM.
  const jamPendek = nilai => {
    const teks = String(nilai || "");
    return /^\d{2}:\d{2}/.test(teks) ? teks.slice(0, 5) : "";
  };
  const pertamaAwal = jamPendek(cfg.jam_mulai_berangkat);
  const terakhirAwal = jamPendek(cfg.jam_batas_berangkat);
  const eksternalAwal = Number(cfg.jumlah_eksternal) > 0
    ? Number(cfg.jumlah_eksternal) : Number(cfg.perkiraan_regu_eksternal);
  const internAwal = Number(cfg.jumlah_intern) > 0
    ? Number(cfg.jumlah_intern) : Number(cfg.perkiraan_regu_intern);

  LAYAR.replaceChildren(h(`
    <div class="card">
      <div class="two-column">
        <div class="field">
          <label for="kloter-pertama-hh">Waktu Berangkat Pertama</label>
          ${kotakJamHtml("kloter-pertama", pertamaAwal)}
        </div>
        <div class="field">
          <label for="kloter-terakhir-hh">Waktu Berangkat Terakhir</label>
          ${kotakJamHtml("kloter-terakhir", terakhirAwal)}
        </div>
      </div>
      <div class="two-column">
        <div class="field">
          <label for="kloter-jumlah-eksternal">Regu Eksternal</label>
          <input type="number" id="kloter-jumlah-eksternal" inputmode="numeric"
                 min="0" value="${eksternalAwal}">
        </div>
        <div class="field">
          <label for="kloter-jumlah-intern">Regu Intern</label>
          <input type="number" id="kloter-jumlah-intern" inputmode="numeric"
                 min="0" value="${internAwal}">
        </div>
      </div>
      <div class="error" id="kloter-galat" hidden></div>
    </div>

    <div class="card" id="kloter-rekomendasi" hidden>
      <h2>Rekomendasi</h2>
      <div class="table-wrapper">
        <table class="table data-table table-tetap table-kloter-rekomendasi">
          <thead><tr>
            <th>Kloter</th>
            <th>Eksternal</th>
            <th>Intern</th>
            <th>Waktu Berangkat</th>
          </tr></thead>
          <tbody id="kloter-rekomendasi-baris"></tbody>
        </table>
      </div>
    </div>
  `));

  const waktuPertama = pasangKotakJam("kloter-pertama");
  const waktuTerakhir = pasangKotakJam("kloter-terakhir");
  const jumlahEksternal = document.getElementById("kloter-jumlah-eksternal");
  const jumlahIntern = document.getElementById("kloter-jumlah-intern");
  const galat = document.getElementById("kloter-galat");
  const rekomendasi = document.getElementById("kloter-rekomendasi");
  const tbody = document.getElementById("kloter-rekomendasi-baris");

  const gambar = () => {
    const pertama = waktuPertama.nilai();
    const terakhir = waktuTerakhir.nilai();
    const eksternalTeks = jumlahEksternal.value.trim();
    const internTeks = jumlahIntern.value.trim();

    galat.hidden = true;
    jumlahEksternal.setAttribute("aria-invalid", "false");
    jumlahIntern.setAttribute("aria-invalid", "false");
    rekomendasi.hidden = true;
    if (!pertama || !terakhir || !eksternalTeks || !internTeks) return;

    try {
      const baris = hitungRekomendasiKloter({
        waktuPertama: pertama,
        waktuTerakhir: terakhir,
        jumlahEksternal: Number(eksternalTeks),
        jumlahIntern: Number(internTeks),
        maksEksternalPerKloter: Number(cfg.maks_eksternal_per_kloter),
        maksInternPerKloter: Number(cfg.maks_intern_per_kloter),
        kloterMaks: Number(cfg.kloter_maks),
        jedaMaksMenit: Number(cfg.interval_berangkat_menit) || Infinity,
      });
      waktuTerakhir.salah(false);
      tbody.replaceChildren(h(baris.map(x => html`
        <tr>
          <td><strong>K${x.kloter}</strong></td>
          <td>${x.jumlahEksternal}</td>
          <td>${x.jumlahIntern}</td>
          <td>${x.waktuBerangkat}</td>
        </tr>`).join("")));
      rekomendasi.hidden = false;
    } catch (e) {
      const eksternalSalah = !Number.isInteger(Number(eksternalTeks)) || Number(eksternalTeks) < 0;
      const internSalah = !Number.isInteger(Number(internTeks)) || Number(internTeks) < 0;
      jumlahEksternal.setAttribute("aria-invalid", String(eksternalSalah));
      jumlahIntern.setAttribute("aria-invalid", String(internSalah));
      if (/waktu berangkat terakhir/i.test(e.message)) waktuTerakhir.salah(true);
      galat.textContent = e.message;
      galat.hidden = false;
    }
  };

  waktuPertama.dengar(gambar);
  waktuTerakhir.dengar(gambar);
  jumlahEksternal.addEventListener("input", gambar);
  jumlahIntern.addEventListener("input", gambar);
  gambar();
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
      notif("Password berhasil diganti.");
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
/* `saringan[].pendek` — label versi HP. Ketiga chip harus muat satu baris di
   layar 360px; "Belum lengkap / Sudah lengkap / Semua" butuh dua. Yang
   dipendekkan hanya kata yang bisa ditebak dari konteksnya ("lengkap",
   "bayar", "Nomor Dada"), dan chip yang sedang menyala tetap menyebut
   keadaannya. Kalau `pendek` tidak diisi, labelnya dipakai apa adanya. */
function alatTabel({ saringan, saringAktif, jumlah, cariContoh, kiri = "", kanan = "" }) {
  return `
    <div class="table-toolbar">
      ${kiri}
      <div class="field kotak-cari">
        <label for="cari-tabel" class="visually-hidden">Cari</label>
        <input type="text" id="cari-tabel" autocomplete="off"
               placeholder="${esc(cariContoh || "Cari kode, sekolah, atau nama regu…")}">
      </div>
      <div class="filter-baris">
        <div class="filter-row">
          ${saringan.map(s => `
            <button type="button" class="option option-small" data-saring="${esc(s.kode)}"
                    aria-pressed="${s.kode === saringAktif}"
            ><span class="saring-panjang">${esc(s.label)}</span
            ><span class="saring-pendek">${esc(s.pendek || s.label)}</span></button>`).join("")}
        </div>
        <span class="table-count" id="tabel-jumlah">${jumlah} baris</span>
      </div>
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
  // Dikembalikan supaya pemanggil bisa menerapkan ulang saringan yang SEDANG
  // menyala sesudah datanya berubah di belakang layar — tanpa itu, baris yang
  // baru saja difoto tetap duduk di daftar "Belum Foto" sampai ada yang
  // menyentuh saringannya.
  return jalan;
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

/** "17 Agu 26 16:55" — pendek karena ia satu kolom di antara enam, dan yang
 *  dicari orang di sana urutan kedatangan, bukan tanggal lengkapnya. WIB,
 *  sama seperti tanggalPanjang(): menjelang tengah malam tanggal alat dan
 *  tanggal WIB bisa menunjuk hari yang berbeda. */
const FMT_DP = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta", day: "numeric", month: "short",
  year: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
});
const tanggalRingkas = (t) => {
  if (!t) return "—";
  const b = {};
  for (const x of FMT_DP.formatToParts(new Date(t))) b[x.type] = x.value;
  return `${b.day} ${b.month.replace(".", "")} ${b.year} ${b.hour}:${b.minute}`;
};

async function layarDataPeserta() {
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
          { kode: "intern", label: "Intern" },
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
                   value="${esc(b.nama_kontak || "")}" placeholder="contoh: Aji"></td>
          <td data-label="WhatsApp">
            <input type="tel" class="small-input" inputmode="numeric"
                   data-kontak-wa="${kode}" value="${esc(b.kontak_wa || "")}"
                   placeholder="08123456789"></td>
        </tr>
        ${!aktif.length ? "" : `
        <tr class="detail-row" data-detail-untuk="${kode}" ${terbuka ? "" : "hidden"}>
          <td colspan="6" class="detail-cell-flush">
            <table class="detail-table detail-table-peserta">
              <thead>
                <tr><th>Regu</th><th>Kategori</th><th>Kelas</th><th>Ketua</th>
                    <th>Anggota 1</th><th>Anggota 2</th><th>Anggota 3</th><th>Anggota 4</th></tr>
              </thead>
              <tbody>
                ${aktif.map(r => barisRegu(r)).join("")}
              </tbody>
            </table>
          </td>
        </tr>`}`;
    }).join("")));

    pasangBaris(() => gambar(cari, saring));
  };

  /* Satu baris rincian = satu regu. Ketua DAN empat anggota, karena satu regu
     lima orang: ketuanya salah satu dari kelima, bukan orang keenam. Kolom
     "Anggota 5" karena itu tidak ada — constraint regu_anggota_maks_empat
     menolaknya, dan yang menolak lebih dulu seharusnya layar ini.

     Kelas punya kolomnya sendiri, dan kotaknya cuma digambar untuk regu
     Intern — regu Eksternal dibedakan oleh sekolahnya, dan kolom ini kosong
     untuk mereka. Digambar "—", bukan kotak yang tidak bisa diisi: kotak
     kosong yang menolak ketikan terbaca seperti kerusakan. */
  const barisRegu = (r) => {
    const id = esc(r.id);
    const intern = String(r.golongan || "").startsWith("intern");
    const ang = [0, 1, 2, 3].map(k => (r.anggota || [])[k] || "");
    return `
      <tr data-regu="${id}">
        <td data-label="Regu">
          <input type="text" class="small-input" data-f="nama_regu" data-id="${id}"
                 maxlength="25" style="text-transform:uppercase"
                 value="${esc(r.nama_regu || "")}"></td>
        <td data-label="Kategori">
          <span class="badge badge-green">${esc(GOLONGAN_LABEL[r.golongan] || r.golongan)}</span></td>
        <td data-label="Kelas">${!intern ? "—" : `
          <input type="text" class="small-input" data-f="kelas_organisasi" data-id="${id}"
                 maxlength="80" value="${esc(r.kelas_organisasi || "")}"
                 placeholder="XI IPA 4">`}</td>
        <td data-label="Ketua">
          <input type="text" class="small-input" data-f="nama_ketua" data-id="${id}"
                 value="${esc(r.nama_ketua || "")}"></td>
        ${ang.map((a, k) => `
        <td data-label="Anggota ${k + 1}">
          <input type="text" class="small-input" data-f="anggota${k}" data-id="${id}"
                 value="${esc(a)}"></td>`).join("")}
      </tr>`;
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


async function layarPembayaran() {
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
          { kode: "belum", label: "Belum bayar", pendek: "Belum" },
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
      // PENJUMLAHAN per regu, bukan perkalian: regu Intern berharga lain
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
           ><span class="badge badge-green">LUNAS</span>${nota}</span>`
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
function tandaiLunasLokal(b, nominal, method, nomorKwitansi) {
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
function cetakKwitansi(daftar) {
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

    return `
      <section class="print-page">
        <h1>KWITANSI — ${esc(EDISI ? EDISI.name : "")}</h1>
        <p class="receipt-number">${esc(bayar.nomor_kwitansi || "—")}</p>
        <p><strong>Diterima dari:</strong> ${esc(b.sekolah?.name || "—")}</p>
        <p><strong>Kode pembayaran:</strong> ${esc(b.kode_pembayaran)}
           · <strong>Cara bayar:</strong> ${esc(bayar.method || "—")}<br>
           <span class="receipt-date"><strong>Tanggal:</strong>
             ${esc(tanggal(bayar.verified_at))}</span></p>
        <!-- Dulu baris ini berbunyi "N regu @ Rp X". Sejak regu Intern punya
             harganya sendiri (migrasi 0110) tidak ada lagi SATU harga satuan
             yang benar untuk setiap batch, dan menuliskan salah satunya di
             kwitansi yang dipegang pembina lebih buruk daripada tidak
             menuliskannya. Angkanya tidak hilang: tabel di bawah menyebut
             biaya tiap regu satu per satu, lalu TOTAL-nya. -->
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

/* ============================ MEJA DAFTAR ULANG ========================== */

async function layarDaftarUlang() {
  if (!EDISI) { layarButuhEdisi("Meja Daftar Ulang"); return; }
  pasangKepala("Meja Daftar Ulang", true);
  LAYAR.replaceChildren(h(pemuat()));

  const layarIni = location.hash;
  let semua, rentang;
  try {
    // Rentang deret ikut diambil di sini supaya nomor dari deret yang salah
    // memerah DI KOTAKNYA, bukan baru ditolak server sesudah belasan kotak
    // terisi. Gagal mengambilnya tidak boleh mematikan meja: `null` berarti
    // layar berhenti menilai deret, dan database tetap yang memutuskan.
    [semua, rentang] = await Promise.all([
      daftarPendaftaran(),
      rentangNomorDada().catch(() => null),
    ]);
  }
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
          { kode: "belum", label: "Perlu Nomor Dada", pendek: "Belum" },
          { kode: "sudah", label: "Selesai" },
          { kode: "semua", label: "Semua" },
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
              <!-- Empat kolom, dua terakhir tanpa judul: nomor dada, lalu
                   tombol tukar. Dulu keduanya berbagi satu kolom, dan
                   tombolnya jatuh ke baris kedua tiap kali nomornya lebih
                   dari dua — tinggi baris jadi dua kali lipat untuk
                   sebagian sekolah saja, dan tabelnya bergerigi. -->
              <th>Kode Bayar</th><th>Sekolah</th><th></th><th></th>
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
      tbody.replaceChildren(h(`<tr><td colspan="4" class="table-empty">
        Tidak ada yang cocok.</td></tr>`));
      return;
    }

    tbody.replaceChildren(h(baris.map(b => {
      const aktif = reguAktif(b);
      const menunggu = aktif.filter(r => r.nomor_dada === null);
      const nomorHtml = aktif.filter(r => r.nomor_dada !== null)
        .sort((x, y) => x.nomor_dada - y.nomor_dada)
        .map(r => html`<span class="pill-number">${dada3(r.nomor_dada)}
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
           </button>${nomorHtml ? `<div class="sub">${nomorHtml}</div>` : ""}`
        : `<div class="pill-row">${nomorHtml}</div>`;

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
          <td data-label="" class="kol-dada">${aksi}</td>
          <td data-label="" class="kol-tukar">${tombolTukar}</td>
        </tr>
        ${!menunggu.length ? "" : `
        <tr class="detail-row" data-nomor-untuk="${kode}" ${terbuka ? "" : "hidden"}>
          <td colspan="4" class="detail-cell-flush">
            <table class="detail-table detail-table-dada">
              <thead>
                <!-- Sel kosong terakhir menyeimbangkan kolom "Tukar nomor
                     rusak…" di tabel induk. Tanpa itu jumlah kolom kedua
                     tabel berbeda, dan di layar lebar (table-layout: fixed)
                     kotak nomor dada tidak lagi jatuh tepat di bawah tombol
                     yang membukanya. Disembunyikan di bawah 941px — lihat
                     style.css. -->
                <tr><th>Regu</th><th>Kategori</th><th>Ketua</th>
                    <th>Nomor dada${deretIntern(menunggu) && rentang
                      ? `<span class="sub">Intern ${rentang.internMulai}–${rentang.internSampai}</span>`
                      : ""}</th>
                    <th class="kol-imbang"></th></tr>
              </thead>
              <tbody>
                ${menunggu.map(r => `
                  <tr>
                    <td><strong>${esc(r.nama_regu)}</strong></td>
                    <td>${esc(GOLONGAN_LABEL[r.golongan] || r.golongan)}</td>
                    <td>${esc(r.nama_ketua)}</td>
                    <td><input type="number" class="small-input" inputmode="numeric" min="1"
                               data-dada="${esc(r.id)}" data-untuk="${kode}"
                               data-golongan="${esc(r.golongan)}"
                               value="${esc(nilaiDada.get(r.id) ?? "")}"></td>
                    <td class="kol-imbang"></td>
                  </tr>`).join("")}
              </tbody>
            </table>
            <div class="action-row action-row-simpan" style="margin-top:.6rem">
              <span class="sub">Nomor dada yang diinput <strong>HARUS SAMA</strong>
                dengan yang diberikan ke regunya.</span>
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
              <tr><td class="angka">${dada3(r.nomor_dada)}</td>
                  <td>${r.nama_regu}</td></tr>`).join("")}</table>`,
          medan: [
            { label: "Nomor lama (yang rusak)", tipe: "number" },
            { label: "Nomor pengganti (dari stok)", tipe: "number" },
            { label: "Alasan", contoh: "misal: kain sobek" },
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
    // Deret yang salah memerah SAMBIL DIKETIK, tidak menunggu tombol Simpan.
    // Kain Intern bertulis 001 sama seperti kain Eksternal, jadi mengetik tiga
    // angka untuk regu Intern adalah kekeliruan yang paling mungkin terjadi di
    // meja — dan menahannya sampai Simpan berarti petugas sudah mengetik
    // sepuluh nomor sebelum tahu yang pertama salah.
    const tandaiDeret = (inp) => {
      const isi = inp.value.trim();
      const angka = Number(isi);
      const salah = !!isi && rentang && Number.isInteger(angka) && angka > 0
        && !deretCocok(rentang, inp.dataset.golongan, angka);
      inp.classList.toggle("input-error", salah);
    };

    tbody.querySelectorAll("[data-dada]").forEach(inp => {
      tandaiDeret(inp);
      inp.addEventListener("input", () => {
        nilaiDada.set(inp.dataset.dada, inp.value);
        tandaiDeret(inp);
      });
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
          // Kain Intern bertulis 001 sama seperti kain Eksternal, dan
          // mengetik apa yang terbaca adalah hal paling wajar sedunia —
          // karena itu yang ditolak di sini bukan salah ketik, melainkan
          // kekeliruan yang PASTI terjadi kalau tidak ditolak.
          if (rentang && !deretCocok(rentang, inp.dataset.golongan, angka)) {
            inp.classList.add("input-error");
            keluhan = keluhan || pesanDeret(rentang, inp.dataset.golongan);
            continue;
          }
          dipakai.add(angka);
          pasangan.push({ regu_id: inp.dataset.dada, nomor_dada: angka });
        }
        if (keluhan) {
          notif(keluhan, true);
          isian.find(i => i.classList.contains("input-error"))?.focus();
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
          `${x.nama_regu} ${dada3(x.nomor_dada)}`).join(", "));
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
  LAYAR.replaceChildren(h(pemuat()));

  const layarIni = location.hash;
  let papan, opsi;

  /* Tanggalnya diambil dari perkiraan berangkat, yang selalu jatuh di tanggal
     lomba — BUKAN dari kalender alat pencatat. Petugas mengetik jam dinding,
     dan jam dinding tidak membawa tanggal.

     Ini bukan kehati-hatian teoretis: mencoba layar ini sebelum hari-H adalah
     persis yang menaruh "kloter 1 berangkat 2026-08-15 16:00" di database,
     enam bulan sebelum acaranya, dan membuat penalti seluruh kloter itu
     terhitung 190 hari. */
  const hariLomba = () =>
    papan.find(k => k.perkiraan_berangkat)?.perkiraan_berangkat || Date.now();
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
      </div>`));
    return;
  }

  // Kloter yang dibuka pertama: yang paling depan dan belum berangkat —
  // itulah yang sedang ditangani petugas garis start.
  let kloterAktif = (papan.find(k => !k.jam_berangkat) || papan[0]).nomor;

  /* Peringatan pemindahan terakhir, kalau ada. Ia hidup DI SINI, bukan
     ditempelkan ke DOM sesudah pemindahan, dan itu bukan kerapian.

     gambarKloter() mengosongkan #isi-kloter lalu menunggu reguKloter().
     Kartu yang ditempelkan sesudah pemanggilannya karena itu ditempelkan ke
     kotak yang SEBENTAR LAGI dikosongkan lagi: peringatannya tampil beberapa
     ratus milidetik lalu hilang sendiri — persis yang dilarang oleh
     komentarnya sendiri, dan tanpa notif() sebagai cadangan, jadi yang
     tersisa bukan pesan yang cepat melainkan tidak ada pesan sama sekali.

     Sebagai bagian dari penggambaran, ia bertahan sampai petugas berpindah
     kloter — perbuatan sadar, bukan jaringan yang kebetulan lebih cepat. */
  let peringatanPindah = null;
  let generasiKloter = 0;

  LAYAR.replaceChildren(h(`
    <div class="card">
      <div class="kloter-strip" id="pita-kloter"></div>
    </div>
    <div id="isi-kloter"></div>
  `));

  const gambarPita = () => {
    // Layarnya bisa SUDAH DITINGGALKAN. Menceklis regu memanggil server, dan
    // sesudah `await` itu petugas mungkin sudah menekan Home — pita kloternya
    // tidak ada lagi, dan `null.replaceChildren` melempar galat yang muncul
    // sebagai toast merah "Cannot read properties of null" di layar Home,
    // seolah Home yang rusak. Yang benar: tidak menggambar apa pun.
    const pita = document.getElementById("pita-kloter");
    if (!pita) return;
    pita.replaceChildren(h(papan.map(k => {
      /* Kloter yang SUDAH berangkat menampilkan JAMNYA, bukan kata
         "berangkat".

         Kata itu tidak menambah apa pun — chip-nya sudah berwarna hijau
         "berangkat", dan angka ceklis di sebelahnya sudah penuh. Sementara
         jamnya adalah hal yang justru dicari, dan sebelumnya hanya bisa
         dilihat dengan MENGETUK kloternya satu per satu lalu membaca pitanya.

         Panitia memeriksa jadwal keberangkatan dari luar — berdiri di garis
         start, melihat kloter mana berangkat pukul berapa, tanpa membuka
         satu-satu. Datanya sudah ikut di v_keberangkatan sejak awal; layar ini
         saja yang membuangnya. */
      /* Yang BELUM berangkat menampilkan PERKIRAANNYA, bukan kata "menunggu".

         "Menunggu" adalah hal yang sudah terbaca dari warna chip-nya, dan ia
         menjawab pertanyaan yang tidak ada yang ajukan. Yang ditanyakan
         sepanjang pagi cuma satu: "kloter 9 kira-kira jam berapa?" — dan
         jawabannya sudah dihitung sejak migrasi 0009, hanya belum pernah
         sampai ke layar ini (0053).

         Tandanya "~" supaya tidak pernah tertukar dengan jam yang benar-benar
         tercatat. Perkiraan bukan catatan — CLAUDE.md 10.6. */
      const label = k.jam_berangkat
        ? jamMenit(k.jam_berangkat)
        : k.perkiraan_berangkat ? `~${jamMenit(k.perkiraan_berangkat)}`
        : ({ siap: "siap", konfirmasi_kontrak: "kontrak",
             menunggu: "menunggu" }[k.posisi] || "");
      return html`
        <button type="button" class="kloter-chip ${k.posisi}${
                  k.lewat_batas && !k.jam_berangkat ? " lewat-batas" : ""}"
                data-kloter="${k.nomor}" aria-pressed="${k.nomor === kloterAktif}">
          <span class="chip-nomor">Kloter ${k.nomor}</span>
          <span class="chip-ket">${k.sudah_ceklis}/${k.jumlah_regu} · ${label}</span>
        </button>`;
    }).join("")));

    document.querySelectorAll("[data-kloter]").forEach(b =>
      b.addEventListener("click", () => {
        kloterAktif = Number(b.dataset.kloter);
        peringatanPindah = null;
        gambarPita();
        gambarKloter();
      }));
  };

  async function gambarKloter() {
    const nomor = kloterAktif;
    const giliran = ++generasiKloter;
    const kotak = document.getElementById("isi-kloter");
    kotak.replaceChildren(h(`<p>Memuat kloter ${nomor}…</p>`));

    let regu;
    try { regu = await reguKloter(nomor); }
    catch (e) {
      if (giliran !== generasiKloter || location.hash !== layarIni) return;
      kotak.replaceChildren(kartuGagalMuat(e.message, gambarKloter));
      return;
    }
    if (giliran !== generasiKloter || location.hash !== layarIni) return;

    const info = papan.find(k => k.nomor === nomor) || {};
    const sudahBerangkat = !!info.jam_berangkat;
    // Tujuan pindah = semua kloter lain, TERMASUK yang sudah berangkat.
    // Regu telat yang berlari menyusul kloter berikutnya memang berangkat
    // bersama kloter itu, pada jam kloter itu — menyembunyikannya memaksa
    // petugas mencatat kloter yang tidak ia jalani (migrasi 0018).
    const tujuanPindah = papan.filter(k => k.nomor !== nomor);
    const belumKontrak = regu.filter(r => r.sudah_ceklis && r.kontrak_menit === null);

    kotak.replaceChildren(h(`
      ${peringatanPindah ? kartuPeringatanPindah(peringatanPindah) : ""}
      ${kartuSisipan(sisipan.filter(s => s.kloter === nomor))}
      <div class="card">
        <div class="kloter-header">
          <h2>Kloter ${nomor}</h2>
          ${sudahBerangkat
            ? html`<span class="badge badge-green">BERANGKAT ${jamMenit(info.jam_berangkat)}</span>
                   <button class="icon-button icon-button-inline ikon-pensil" id="koreksi-jam" type="button"
                           title="Betulkan jam berangkat"
                           aria-label="Betulkan jam berangkat Kloter ${nomor}">&#9998;</button>`
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
                  <td class="angka">${dada3(r.nomor_dada)}</td>
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
          `keberangkatan akan ditolak.`)}</div>

        ${sudahBerangkat ? "" : `
          <div class="departure-bar">
            <div class="field" style="margin:0">
              <label for="jam-berangkat-hh">Jam berangkat</label>
              <!-- Kotak ketik, bukan <input type="time">: pemilih bawaan
                   browser merender AM/PM kalau locale browsernya Inggris, dan
                   tidak ada atribut yang bisa memaksanya 24 jam. Lihat
                   jamSah() di util.js. -->
              ${kotakJamHtml("jam-berangkat", jamMenit(new Date()))}
            </div>
            <button class="button button-primary" id="aksi-berangkat" type="button">
              🚩 Berangkatkan Kloter ${nomor}
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
            `keberangkatan akan ditolak.`))]
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
        antre = antre.then(async () => {
          try {
            if (mau) await ceklisBerangkat(dada);
            else await batalCeklisBerangkat(dada);
            // Checkbox tetap menampilkan keadaan yang baru dipilih selama
            // request berjalan. Meredupkannya memberi kesan kliknya gagal
            // atau tertunda, padahal perubahan layar sudah terjadi langsung.
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
          }
        });
      });
    });

    kotak.querySelectorAll("[data-kontrak]").forEach(sel =>
      sel.addEventListener("change", async () => {
        if (!sel.value) return;
        // TIDAK dinonaktifkan selama menyimpan. `select:disabled` digambar
        // abu-abu, dan abu-abu di layar ini punya arti yang sudah dipakai:
        // "regu sudah diceklis berangkat, kontraknya terkunci". Memakainya
        // juga untuk "sabar, sedang menyimpan" membuat petugas menyimpulkan
        // pilihannya tidak bisa diubah lagi — padahal bisa, dan sedetik lagi
        // kotaknya putih kembali tanpa penjelasan apa pun.
        //
        // Yang tetap dijaga adalah bahaya yang sebenarnya: dua perubahan
        // beruntun yang jawabannya datang terbalik, sehingga yang tersimpan
        // justru pilihan yang LEBIH LAMA. Nomor urut di bawah membuat jawaban
        // yang sudah ketinggalan tidak menggambar apa pun.
        const urut = String(Number(sel.dataset.urut || 0) + 1);
        sel.dataset.urut = urut;
        try {
          await konfirmasiKontrak(sel.dataset.kontrak, Number(sel.value));
          if (sel.dataset.urut !== urut) return;
          sel.classList.add("saved");
          setTimeout(() => sel.classList.remove("saved"), 1200);
        } catch (err) {
          notif(err.message, true);
        }
        perbaruiPeringatanKontrak();
      }));

    kotak.querySelectorAll("[data-pindah]").forEach(sel =>
      sel.addEventListener("change", async () => {
        const tujuan = Number(sel.value);
        if (!tujuan) return;
        const dada = Number(sel.dataset.pindah);
        const jawab = await dialog({
          judul: `Pindahkan nomor ${dada3(dada)} ke Kloter ${tujuan}?`,
          kartuHtml: html`<div class="card card-identity" style="margin-bottom:.8rem">
            <div class="nama">Dari Kloter ${nomor} ke Kloter ${tujuan}</div>
            <div class="detail">${papan.find(k => k.nomor === tujuan)?.jam_berangkat
              ? `Kloter ${tujuan} sudah berangkat — regu ini akan dinilai dari jam berangkat kloter itu.`
              : ""}</div>
          </div>`,
          medan: [{ label: "Alasan pemindahan",
                   contoh: "misal: terlambat, menyusul kloter berikutnya" }],
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
        // Peringatan sisipan TIDAK boleh berupa toast yang hilang sendiri:
        // petugas staging memegang kertas yang tidak memuat nomor ini. Jadi ia
        // dititipkan ke penggambaran, bukan ditempelkan sesudahnya.
        peringatanPindah = hasil.peringatan || null;
        if (!hasil.peringatan) {
          notif(`Nomor ${dada3(dada)} pindah dari Kloter ${hasil.kloter_lama} ke Kloter ${hasil.kloter_baru}.`);
        }
        papan = await papanKeberangkatan();
        // Daftar sisipan ikut disegarkan: nomor yang barusan pindah ke kloter
        // yang kertasnya sudah beredar BARU SAJA menjadi sisipan, dan tanpa
        // ini ia tidak muncul di kartu merah sampai layarnya dibuka ulang —
        // termasuk saat petugas membuka kloter tujuan untuk memeriksanya.
        try { sisipan = await daftarSisipan(); } catch { /* daftar boleh telat */ }
        gambarPita();
        gambarKloter();
      }));

    // Membetulkan jam yang sudah tercatat. Jam berangkat menentukan penalti
    // SELURUH regu di kloter ini, dan salah ketik tidak menimbulkan galat apa
    // pun — ia hanya muncul sebagai nilai yang salah saat klasemen keluar.
    // Karena itu koreksinya minta alasan dan tercatat di history.
    // Cetak daftar sisipan. Dipasang di sini, bukan lewat onclick di dalam
    // kartunya, supaya ia punya akses ke `sisipan` yang utuh — kartunya cuma
    // menampilkan kloter yang sedang dibuka, sedangkan yang dicetak semuanya.
    kotak.querySelector("[data-cetak-sisipan]")?.addEventListener("click", () => {
      const aktif = sisipan.filter(s => !s.sudah_berangkat);
      if (!aktif.length) { notif("Tidak ada regu sisipan yang belum berangkat.", true); return; }
      const n = siapkanCetakSisipan(aktif);
      notif(`${n} lembar sisipan — satu per kloter.`);
      window.print();
    });

    const tombolKoreksi = document.getElementById("koreksi-jam");
    if (tombolKoreksi) tombolKoreksi.addEventListener("click", async () => {
      // Jam kloter tetangga ditampilkan, BUKAN dipaksakan. Fungsi database
      // sengaja tidak menolak jam yang melanggar urutan (kalau menolak, dua
      // kloter yang jamnya sama-sama salah saling mengunci). Yang menangkap
      // salah ketik di sini adalah mata pencatat, jadi angka pembandingnya
      // ditaruh di depan mata.
      const sebelum = papan.filter(k => k.nomor < nomor && k.jam_berangkat).pop();
      const sesudah = papan.find(k => k.nomor > nomor && k.jam_berangkat);
      const tetangga = [
        sebelum && `Kloter ${sebelum.nomor} berangkat ${jamMenit(sebelum.jam_berangkat)}`,
        sesudah && `Kloter ${sesudah.nomor} berangkat ${jamMenit(sesudah.jam_berangkat)}`,
      ].filter(Boolean).join(" · ");

      const jawab = await dialog({
        judul: `Betulkan jam berangkat Kloter ${nomor}`,
        kartuHtml: html`<div class="card card-identity" style="margin-bottom:.8rem">
          <div class="nama">Sekarang tercatat ${jamMenit(info.jam_berangkat)}</div>
          <div class="detail">Mengubah jam ini menghitung ulang penalti waktu
            seluruh regu di Kloter ${nomor}.${tetangga ? ` ${tetangga}.` : ""}</div>
        </div>`,
        medan: [
          { label: "Jam berangkat yang benar", tipe: "jam",
            nilai: jamMenit(info.jam_berangkat) },
          { label: "Alasan koreksi", contoh: "misal: salah input" },
        ],
        labelAksi: "Simpan Koreksi",
      });
      if (!jawab) return;
      const [hhmm, alasan] = jawab;
      try {
        await koreksiJamBerangkat(nomor,
          jamPadaHari(hhmm, hariLomba()).toISOString(), alasan);
      } catch (err) { notif(err.message, true); return; }
      notif(`Jam berangkat Kloter ${nomor} dibetulkan jadi ${hhmm}.`);
      papan = await papanKeberangkatan();
      gambarPita();
      gambarKloter();
    });

    const kotakJamBerangkat = pasangKotakJam("jam-berangkat");

    const tombol = document.getElementById("aksi-berangkat");
    if (tombol) tombol.addEventListener("click", async () => {
      if (tombol.dataset.jalan === "1") return;
      if (kotakJamBerangkat.kosong()) {
        notif("Jam berangkat wajib diisi.", true); return;
      }
      // Ditolak, bukan ditebak. Jam berangkat menentukan penalti seluruh
      // kloter — menebak maksud "19:75" akan menghukum sepuluh regu sekaligus.
      const hhmm = kotakJamBerangkat.nilai();
      if (!hhmm) {
        kotakJamBerangkat.salah(true);
        kotakJamBerangkat.fokus();
        notif("Jam berangkat belum lengkap atau di luar 00:00–23:59. "
              + "Contoh: 07:15.", true);
        return;
      }
      kotakJamBerangkat.setNilai(hhmm);
      tombol.dataset.jalan = "1"; tombol.disabled = true; tombol.textContent = "Menyimpan…";
      try {
        await berangkatkanKloter(nomor,
          jamPadaHari(hhmm, hariLomba()).toISOString());
      } catch (err) {
        notif(err.message, true);
        tombol.dataset.jalan = ""; tombol.disabled = false;
        tombol.textContent = `🚩 Berangkatkan Kloter ${nomor}`;
        return;
      }
      notif(`Kloter ${nomor} berangkat ${hhmm}.`);
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
  pasangKepala("Daftar Kloter");
  LAYAR.replaceChildren(h(pemuat()));

  let baris, cfg;
  // Jendela keberangkatan datang dari konfigurasi edisi — itu nilai awalnya,
  // bukan nilai matinya. Panitia menggesernya di layar ini sesudah melihat
  // berapa regu yang benar-benar mengambil nomor dada.
  try { [baris, cfg] = await Promise.all([daftarKloter(), infoPengaturanKloter()]); }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarCetakKloter)); return; }

  if (!baris.length) {
    LAYAR.replaceChildren(h(`<div class="card">
      <h2>Belum ada regu berkloter</h2>
    </div>`));
    return;
  }

  // Kelompokkan per kloter. Dipakai ulang tiap kali tombol cetak ditekan,
  // karena datanya diambil segar saat itu juga.
  const kelompokkan = (rows) => {
    const peta = new Map();
    for (const b of rows) {
      if (!peta.has(b.kloter)) peta.set(b.kloter, {
        jamBerangkat: b.jam_berangkat,
        perkiraanBerangkat: b.perkiraan_berangkat,
        isi: [],
      });
      peta.get(b.kloter).isi.push(b);
    }
    return peta;
  };

  let perKloter = kelompokkan(baris);

  /* Yang dihitung REGU YANG SUDAH MENGAMBIL NOMOR DADA, bukan yang mendaftar.
     Keduanya berbeda jauh pada pagi hari-H: sekolah yang mendaftar tapi tidak
     datang tetap ada di `pendaftaran`, dan merencanakan keberangkatan dari
     angka itu menyebar jendela ke kloter yang tidak akan pernah berangkat.

     Sumbernya baris yang sudah ada di layar ini — tiap baris `v_daftar_kloter`
     adalah regu yang berkloter, dan constraint `regu_check` menjamin nomor
     dada dan kloter selalu ada bersama-sama. Jadi tidak ada permintaan kedua
     ke server untuk menghitungnya. */
  const jumlahIntern = baris.filter(
    b => String(b.golongan || "").startsWith("intern_")).length;
  const jumlahEksternal = baris.length - jumlahIntern;

  const jamPendek = (nilai) => {
    const teks = String(nilai || "");
    return /^\d{2}:\d{2}/.test(teks) ? teks.slice(0, 5) : "";
  };

  LAYAR.replaceChildren(h(`
    <div class="card" style="border-color:var(--utama)">
      <!-- Empat angka MENDATAR: label jadi kepala kolom, angkanya satu baris
           di bawahnya. Sebagai empat baris ia memakan setengah layar HP untuk
           empat angka yang cuma dilirik — dan yang dicari di bawahnya, kotak
           jam dan tombol Cetak, terdorong keluar layar.

           Tetap tabel, bukan grid: kepala kolom table th sudah membawa
           bentuk label yang dipakai tabel lain di layar ini, dan angkanya
           tetap sel angka yang sama. (Tanpa backtick: seluruh markup ini
           duduk di dalam template literal.) -->
      <table class="table table-ringkas-kloter">
        <thead>
          <tr>
            <th>Total Kloter</th><th>Total Regu</th>
            <th>Eksternal</th><th>Intern</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="angka">${perKloter.size}</td>
            <td class="angka">${baris.length}</td>
            <td class="angka">${jumlahEksternal}</td>
            <td class="angka">${jumlahIntern}</td>
          </tr>
        </tbody>
      </table>
      <!-- Rencana berangkat berdiri DI ATAS tombol cetak, dan urutan itu berarti:
           yang tercetak adalah jam yang baru saja diatur di sini. Menaruhnya
           di bawah membuat petugas menekan Cetak lebih dulu, lalu menemukan
           kotak jamnya sesudah kertasnya keluar.

           TANPA judul dan TANPA paragraf penjelas. Labelnya sendiri sudah
           menyebut "Rencana Berangkat", jadi judul di atasnya cuma mengulang
           label yang ada di bawahnya (pasal 9.3),
           dan kalimat "jam ini dibagi rata lalu tercetak untuk peserta"
           menjelaskan sesuatu yang terlihat sendiri begitu jamnya diubah
           sekali (pasal 9.1 dan 9.6). -->
      <div class="two-column planning-jam" style="margin-top:1rem">
        <div class="field">
          <label for="planning-pertama-hh">Rencana Berangkat Pertama</label>
          ${kotakJamHtml("planning-pertama", jamPendek(
            cfg.planning_berangkat_pertama || cfg.jam_mulai_berangkat))}
        </div>
        <div class="field">
          <label for="planning-terakhir-hh">Rencana Berangkat Terakhir</label>
          ${kotakJamHtml("planning-terakhir", jamPendek(
            cfg.planning_berangkat_terakhir || cfg.jam_batas_berangkat))}
        </div>
      </div>
      <div class="error" id="planning-galat" hidden></div>
      <div class="option-row" style="margin-top:.9rem">
        <button class="button button-primary" id="cetak-petugas" type="button">
          ${ikon("printer")} Cetak Kloter untuk Petugas
        </button>
        <button class="button button-primary" id="cetak-peserta" type="button">
          ${ikon("printer")} Cetak Kloter untuk Peserta
        </button>
      </div>
    </div>
    <div id="pratayang"></div>
  `));

  const waktuPertama = pasangKotakJam("planning-pertama");
  const waktuTerakhir = pasangKotakJam("planning-terakhir");
  const galatPlanning = document.getElementById("planning-galat");

  /** Jam planning tiap kloter, atau Map kosong kalau jendelanya belum sah.
   *  Kosong = kartu jatuh kembali ke perkiraan database, bukan kartu tanpa
   *  jam sama sekali — layar ini tetap harus bisa dibaca sambil jendelanya
   *  sedang diketik. */
  let planning = new Map();

  const hitungPlanning = () => {
    galatPlanning.hidden = true;
    waktuTerakhir.salah(false);
    const pertama = waktuPertama.nilai();
    const terakhir = waktuTerakhir.nilai();
    if (!pertama || !terakhir) { planning = new Map(); return; }
    try {
      planning = jadwalPlanning([...perKloter.keys()], pertama, terakhir,
                                Number(cfg.interval_berangkat_menit) || Infinity);
    } catch (e) {
      planning = new Map();
      if (/waktu berangkat terakhir/i.test(e.message)) waktuTerakhir.salah(true);
      galatPlanning.textContent = e.message;
      galatPlanning.hidden = false;
    }
  };

  /** Satu baris jam untuk kartu kloter — planning, dan yang sebenarnya.
   *
   *  KEDUANYA ditampilkan begitu kloter berangkat, bukan yang satu menggantikan
   *  yang lain. Panitia perlu menyandingkannya: rencana yang dibagikan ke
   *  peserta lawan apa yang benar-benar terjadi, dan selisihnya adalah kabar
   *  yang mereka pakai memutuskan apakah kloter berikutnya perlu digeser.
   *
   *  Yang tercatat itu pula dasar penalti seluruh regu di kloter ini, jadi ia
   *  tidak boleh terbaca seperti jadwal — pasal 10.6. */
  const barisJamKloter = (nomor, v) => {
    const rencana = planning.get(Number(nomor))
      // Jendela belum diketik lengkap: pakai perkiraan database, supaya
      // kartunya tidak pernah kehilangan jam sama sekali.
      || (v.perkiraanBerangkat ? jamMenit(v.perkiraanBerangkat) : null);

    const bagian = [];
    if (rencana) bagian.push(html`<strong>Rencana</strong> ${rencana}`);
    if (v.jamBerangkat) {
      bagian.push(html`<strong>Real</strong> ${jamMenit(v.jamBerangkat)}`);
    }
    if (!bagian.length) return "";

    let selisih = "";
    if (rencana && v.jamBerangkat) {
      // Tanggalnya diambil dari jam yang TERCATAT, bukan dari kalender alat:
      // "07:20" tidak membawa tanggal, dan layar ini dibuka juga di hari-hari
      // selain hari-H (alasan yang sama dengan hariLomba() di Keberangkatan).
      const menit = Math.round(
        (new Date(v.jamBerangkat) - jamPadaHari(rencana, v.jamBerangkat)) / 60000);
      // Kata, bukan tanda. "+15" menuntut pembacanya mengingat mana yang
      // rencana dan mana yang nyata sebelum tandanya berarti apa-apa; "telat
      // 15 menit" tidak menuntut apa pun.
      const kata = menit === 0 ? "tepat waktu"
        : menit > 0 ? `telat ${menit} menit`
        : `terlalu cepat ${Math.abs(menit)} menit`;
      selisih = html` <span class="sub">(${kata})</span>`;
    }
    return `<p>${ikon("clock")} ${bagian.join(" · ")}${selisih}</p>`;
  };

  const gambarPratayang = (peta) => {
    // CATATAN: baris tabel dirakit dengan html`` (nilai di-escape), lalu
    // digabung memakai template BIASA. Menyisipkan HTML jadi ke dalam html``
    // akan meng-escape-nya dua kali dan tabelnya tampil sebagai teks mentah.
    document.getElementById("pratayang").replaceChildren(h(
      [...peta.entries()].map(([nomor, v]) => {
        const baris = v.isi.map(r => html`
          <tr><td class="angka">${dada3(r.nomor_dada)}</td>
              <td><strong>${r.nama_regu}</strong></td>
              <td>${r.nama_sekolah}</td>
              <td>${GOLONGAN_LABEL[r.golongan] || r.golongan}</td></tr>`).join("");
        return `
          <div class="card">
            <h2>Kloter ${esc(nomor)}</h2>
            <!-- Labelnya menyebut ASAL angkanya, bukan cuma "jam berangkat".
                 Keduanya jam yang terlihat sama di layar dan sama sekali bukan
                 hal yang sama: yang satu dihitung sistem untuk merencanakan
                 pagi, yang satu diketik petugas dari jam dinding dan menjadi
                 dasar penalti SELURUH regu di kloter itu (pasal 10.6).

                 "di Lapangan" bukan hiasan. Tanpa itu "Jam berangkat" terbaca
                 seperti jadwal — dan petugas yang membaca kartu ini untuk
                 memutuskan apakah sebuah kloter sudah jalan tidak punya cara
                 membedakan keduanya selain mengingat kloter mana yang sudah
                 ia ceklis. -->
            ${barisJamKloter(nomor, v)}
            <table class="table">${baris}</table>
          </div>`;
      }).join("")));
  };

  /** Cetak semua kloter yang terlihat di pratayang, termasuk yang sudah pernah
   *  dicetak. `window.print()` HARUS tetap berada dalam giliran event tap:
   *  Safari iPhone memblokirnya bila ada `await` lebih dulu karena sesudah itu
   *  panggilannya tidak lagi dianggap berasal langsung dari pengguna.
   *
   *  Data layar sudah diambil saat layar dibuka. Menyamakan kertas dengan
   *  pratayang juga menghindari kertas diam-diam berbeda dari yang baru saja
   *  diperiksa petugas. Buka ulang layar untuk mengambil perubahan terbaru. */
  function cetak(bentuk) {
    const semuaKloter = [...perKloter.entries()];
    // Jam yang tercetak = jam yang barusan diatur di layar ini. Kertas yang
    // menyebut jam lain dari layar yang tombolnya baru saja ditekan adalah
    // kertas yang salah, dan yang memegangnya peserta.
    siapkanCetakKloter(semuaKloter, bentuk, planning);
    window.print();
    tanyaWaktuCetak(semuaKloter.map(([n]) => Number(n)));
  }

  /** Pertanyaan sesudah mencetak: kertasnya keluar atau tidak. Waktu cetak
   *  adalah catatan cetak terakhir, bukan gembok — kloter yang sama selalu
   *  bisa dicetak lagi (CLAUDE.md 12.1).
   *
   *  DIALOG SENDIRI, BUKAN `confirm()` BAWAAN BROWSER, dan itu bukan soal
   *  selera. `confirm()` MEMBLOKIR utas utama halaman sampai dijawab. Di
   *  iPhone `window.print()` tidak menahan JavaScript: lembar cetak iOS baru
   *  mulai menggambar preview-nya sesudah baris itu lewat, jadi `confirm()`
   *  yang menyusul mengunci utas yang sedang dipakai menggambar — lembar
   *  cetaknya berhenti di "Loading Preview…" selamanya, dan pertanyaannya
   *  sendiri tertutup di belakangnya. Cetak kwitansi dan blangko pos tidak
   *  pernah kena karena keduanya berhenti tepat sesudah `window.print()`.
   *
   *  `dialog()` cuma menempelkan elemen di halaman lalu mengembalikan Promise,
   *  jadi utasnya bebas. Overlay-nya sudah `display: none` di @media print,
   *  jadi ia tidak ikut tercetak. */
  async function tanyaWaktuCetak(nomor) {
    const jawab = await dialog({
      judul: "Kertasnya sudah keluar?",
      kartuHtml: html`<div class="card card-identity" style="margin-bottom:.8rem">
        <div class="nama">${String(nomor.length)} kloter</div>
      </div>`,
      labelAksi: "Simpan waktu cetak",
    });
    if (!jawab) return;
    try {
      const n = await tandaiKloterDicetak(nomor);
      notif(`Waktu cetak ${n} kloter disimpan.`);
      layarCetakKloter();
    } catch (err) { notif(err.message, true); }
  }

  document.getElementById("cetak-petugas").addEventListener("click", () => cetak("staging"));
  document.getElementById("cetak-peserta").addEventListener("click", () => cetak("umum"));

  /* Simpan jendelanya, jangan biarkan hilang saat layar dimuat ulang.
     Panitia menggesernya berkali-kali sepanjang pagi, dan jendela yang
     kembali ke 07:00 tiap refresh membuat kertas yang dicetak sesudahnya
     berbeda dari yang sebelumnya tanpa ada yang sengaja mengubahnya.

     DITUNDA 800 ms sesudah ketikan terakhir. `dengar` menyala pada tiap
     penekanan tombol, dan "0"-"7"-"3"-"0" adalah empat keadaan yang tiga di
     antaranya belum berarti apa-apa.

     Gagalnya TIDAK diam: jam yang terlihat di layar tapi tidak tersimpan
     adalah kertas yang dicetak dari rencana yang cuma ada di satu HP. */
  let jadwalSimpan = null;
  const simpanPlanning = () => {
    clearTimeout(jadwalSimpan);
    const pertama = waktuPertama.nilai();
    const terakhir = waktuTerakhir.nilai();
    if (!pertama || !terakhir || !planning.size) return;
    jadwalSimpan = setTimeout(async () => {
      try {
        await aturPlanningBerangkat(pertama, terakhir);
      } catch (err) {
        galatPlanning.textContent = `Rencana belum tersimpan: ${err.message}`;
        galatPlanning.hidden = false;
      }
    }, 800);
  };

  const perbarui = () => { hitungPlanning(); gambarPratayang(perKloter); };
  waktuPertama.dengar(() => { perbarui(); simpanPlanning(); });
  waktuTerakhir.dengar(() => { perbarui(); simpanPlanning(); });
  perbarui();
}

/** Blok cetak daftar kloter — satu kloter per halaman kertas.
 *  Dua pembaca, dua bentuk (panitia menyebutkan keduanya):
 *   - 'staging' : dipegang petugas staging, ada kolom centang kehadiran dan
 *                 tempat menulis jam berangkat sebenarnya.
 *   - 'umum'    : ditempel di papan pengumuman & dibagikan ke barak, dibaca
 *                 peserta — perkiraan berangkat dibesarkan, kolom centang
 *                 dihilangkan karena tidak ada gunanya bagi peserta.
 */
function siapkanCetakKloter(dipakai, bentuk = "staging", planning = new Map()) {
  document.getElementById("cetakan")?.remove();
  const dicetak = tanggalJam(new Date().toISOString());

  const halaman = dipakai.map(([nomor, v]) => {
    const contoh = v.isi[0] || {};
    // Planning dari layar kalau ada; perkiraan database sebagai cadangan,
    // supaya kertas tidak pernah keluar tanpa jam sama sekali.
    const perkiraan = planning.get(Number(nomor))
      || jamMenit(contoh.perkiraan_berangkat);

    const baris = v.isi.map(r => bentuk === "staging"
      ? html`
        <tr><td class="kotak"></td>
            <td class="dada">${dada3(r.nomor_dada)}</td>
            <td>${r.nama_regu}${r.sisipan ? " ★" : ""}</td>
            <td>${r.nama_sekolah}</td>
            <td>${GOLONGAN_LABEL[r.golongan] || r.golongan}</td></tr>`
      : html`
        <tr><td class="dada">${dada3(r.nomor_dada)}</td>
            <td>${r.nama_regu}</td>
            <td>${r.nama_sekolah}</td>
            <td>${GOLONGAN_LABEL[r.golongan] || r.golongan}</td></tr>`).join("");

    const adaSisipan = v.isi.some(r => r.sisipan);

    return bentuk === "staging" ? `
      <section class="print-page">
        <h1>KLOTER ${esc(nomor)} — ${esc(EDISI ? EDISI.name : "")}</h1>
        <!-- Petugas turun ke barisnya sendiri, dan tiap isian dijaga
             nowrap. Sebaris bertiga, "Petugas:" muat di ujung kanan tapi
             garis isiannya tidak — garisnya pindah ke baris berikutnya dan
             kertasnya keluar dengan nama tanpa tempat menulis. -->
        <p><strong>Perkiraan jam berangkat: ${esc(perkiraan)}</strong>
           · <span style="white-space:nowrap">Jam sebenarnya: ________</span><br>
           <span style="white-space:nowrap">Petugas: ________________</span></p>
        <table class="print-table">
          <!-- Hadir di kolom PALING KIRI, sejajar dengan tombol centang di
               layar Keberangkatan. Petugas memegang kertas ini di satu tangan
               dan HP di tangan lain; kalau kotak centangnya di ujung yang
               berlawanan, matanya menyeberangi seluruh baris tiap regu. -->
          <thead><tr><th class="kotak">Hadir</th><th>No Dada</th><th>Nama Regu</th><th>Sekolah</th><th>Golongan</th></tr></thead>
          <tbody>${baris}</tbody>
        </table>
        ${adaSisipan ? `<p class="insert-note">★ = regu sisipan, ditambahkan setelah kertas ini dicetak.</p>` : ""}
        <p class="print-note">Dicetak ${esc(dicetak)}.</p>
      </section>` : `
      <section class="print-page">
        <h1>KLOTER ${esc(nomor)}</h1>
        <p class="jam-besar">Perkiraan jam berangkat: ${esc(perkiraan)}</p>
        <table class="print-table">
          <thead><tr><th>No Dada</th><th>Nama Regu</th><th>Sekolah</th><th>Golongan</th></tr></thead>
          <tbody>${baris}</tbody>
        </table>
        <p class="print-note">Bersiap di staging paling lambat 15 menit sebelum
           perkiraan berangkat.<br>
           Jam sebenarnya bisa bergeser, ikuti panggilan petugas.<br>
           Dicetak ${esc(dicetak)}.</p>
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
        <label for="dada">Nomor dada</label>
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
        <div class="two-column pasangan-sempit" style="margin-top:.5rem">
          <div class="field" style="margin:0">
            <label for="jam-hh">Jam datang</label>
            <!-- Kotak ketik, alasan sama dengan jam berangkat: pemilih bawaan
                 browser bisa muncul sebagai AM/PM. Lihat jamSah() di util.js. -->
            ${kotakJamHtml("jam")}
          </div>
          <div class="field" style="margin:0">
            <label for="hadir">Anggota hadir</label>
            <input type="number" id="hadir" min="0" max="5" inputmode="numeric" value="5">
          </div>
        </div>
        <div id="dampak-jam" style="margin-top:.5rem"></div>
      </details>
    </div>
    <div id="riwayat-finish"></div>
  `));

  const inp = document.getElementById("dada");
  const kotak = document.getElementById("kartu-regu");
  const tombol = document.getElementById("sampai");
  const inpJam = pasangKotakJam("jam");
  const inpHadir = document.getElementById("hadir");
  let regu = null;
  let jeda = null;

  /* NOMOR DADA yang isian koreksinya diisi oleh SISTEM, atau null kalau
     isinya diketik petugas sendiri.

     Dua kebutuhan bertabrakan di dua kotak yang sama. Regu yang sudah tercatat
     ditampilkan jam lamanya supaya verifikasi terhadap kertas tinggal
     membandingkan; sementara petugas yang menyalin sederet catatan kertas
     sering mengetik jamnya lebih dulu lalu membetulkan nomornya — itu sebabnya
     bersihkan() sengaja tidak mengosongkan keduanya.

     Bedanya cuma SIAPA yang mengisi. Isian sistem milik satu regu tertentu dan
     harus pergi bersama regu itu; isian petugas miliknya sendiri dan tidak
     boleh disentuh. Tanpa pembedaan ini, mengetik 042 yang sudah tercatat
     10:30 lalu berpindah ke 043 yang baru masuk pukul 11:05 menyimpan 043
     sebagai datang 10:30 — di kotak yang tidak terlihat, karena panelnya
     tertutup. */
  let isianDariSistem = null;

  inp.focus();
  gambarRiwayat();

  const enter = (e) => {
    if (e.key === "Enter" && !tombol.disabled) { e.preventDefault(); tombol.click(); }
  };
  inpJam.pada("keydown", enter);
  inpHadir.addEventListener("keydown", enter);

  // Angka penalti dipakai untuk menjawab pertanyaan yang sebenarnya saat
  // membandingkan catatan kertas dengan jam tombol: bukan "beda berapa menit",
  // melainkan "apakah bedanya MENGUBAH penalti". Sejak migrasi 0089 setiap
  // selisih satu menit mengubah penalti satu poin; badge yang ikut berubah pada
  // tiap menit adalah perilaku yang disengaja, bukan noise.
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
    // Setengah jam yang sedang diketik ("07" menuju "07:15") bukan jam, dan
    // menghitung dampak dari angka setengah jadi membuat lencananya
    // berkedip-kedip menampilkan penalti yang tidak pernah berlaku.
    const isi = inpJam.nilai();
    const jamIsi = isi ? jamPadaHari(isi, regu.target_datang) : dasar;
    const pDasar = hitungPenalti(dasar, regu.target_datang);
    const pIsi = hitungPenalti(jamIsi, regu.target_datang);
    const tulis = (n) => n === 0 ? "0" : `−${n}`;

    if (!isi) {
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
  /* Panel koreksi DIBUKA begitu salah satu kotaknya berisi. Isi yang tidak
     terlihat tetap ikut tersimpan saat tombol ditekan, dan lencana "penalti
     berubah" yang seharusnya memperingatkan justru ikut tersembunyi di
     dalamnya. Yang punya akibat harus kelihatan. */
  const panelKoreksi = inpHadir.closest("details");
  const bukaKalauBerisi = () => {
    if (!panelKoreksi) return;
    const berisi = !inpJam.kosong() || inpHadir.value.trim() !== "5";
    if (berisi) panelKoreksi.open = true;
  };

  // Ketikan petugas membatalkan penanda: sejak itu isinya miliknya, dan
  // berpindah regu tidak boleh membuangnya.
  inpJam.dengar(() => { isianDariSistem = null; bukaKalauBerisi(); perbaruiDampak(); });
  inpHadir.addEventListener("input", () => {
    isianDariSistem = null;
    if (bacaAnggotaHadir(inpHadir.value, inpHadir.validity?.badInput) !== null) {
      inpHadir.removeAttribute("aria-invalid");
    }
    bukaKalauBerisi();
  });
  // Bentuknya dirapikan saat kotak ditinggalkan, jadi lencana dampaknya ikut
  // dihitung ulang sesudah itu — tanpa ini "745" yang jadi "07:45" saat blur
  // meninggalkan lencana menampilkan hitungan dari teks yang sudah tidak ada.


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
      inpJam.setNilai(jamMenit(r.jam_datang));
      inpHadir.value = r.anggota_hadir ?? 5;
      isianDariSistem = dada;
      bukaKalauBerisi();
    } else if (isianDariSistem !== null && isianDariSistem !== dada) {
      // Isian tadi milik regu LAIN yang sudah tercatat. Membawanya ke regu ini
      // berarti menyimpan jam dan jumlah anggota regu sebelumnya atas namanya.
      inpJam.setNilai("");
      inpHadir.value = "5";
      isianDariSistem = null;
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
    // Kolom jam susulan kosong = jalur cepat, itu keadaan normal. Tapi kolom
    // yang DIISI dan tidak terbaca sebagai jam harus menghentikan langkah,
    // bukan diam-diam dilewati: petugas mengetiknya justru karena jam tombol
    // salah, dan menyimpan jam tombol setelah ia mengetik yang lain adalah
    // membuang koreksi yang sedang dia kerjakan.
    const jamIsi = inpJam.kosong() ? null : inpJam.nilai();
    if (!inpJam.kosong() && !jamIsi) {
      inpJam.salah(true);
      inpJam.fokus();
      notif("Jam datang belum lengkap atau di luar 00:00–23:59. "
            + "Kosongkan untuk memakai jam saat tombol ditekan.", true);
      return;
    }
    const hadir = bacaAnggotaHadir(inpHadir.value, inpHadir.validity?.badInput);
    if (hadir === null) {
      inpHadir.setAttribute("aria-invalid", "true");
      inpHadir.focus();
      notif("Anggota hadir harus angka 0–5. Kosongkan untuk memakai 5.", true);
      return;
    }
    tombol.dataset.jalan = "1"; tombol.disabled = true;

    // Jam dikunci DI SINI — saat tombol ditekan, dari jam laptop panitia.
    // Kolom jam hanya dipakai bila memang diisi (koreksi hasil verifikasi).
    const jam = jamIsi ? jamPadaHari(jamIsi, regu.target_datang) : new Date();
    const dada = regu.nomor_dada;
    const nama = regu.nama_regu;
    try {
      await catatFinish(dada, jam.toISOString(), hadir, null);
    } catch (err) {
      notif(err.message, true);
      tombol.dataset.jalan = ""; tombol.disabled = false;
      return;
    }
    catatTerakhir("finish", dada3(dada),
      `${nama} — ${jamMenit(jam)}${hadir < 5 ? ` · ${hadir} anggota` : ""}`);
    tombol.dataset.jalan = "";
    inp.value = ""; inpJam.setNilai(""); inpHadir.value = "5";
    isianDariSistem = null;
    bersihkan(); inp.focus();
    gambarRiwayat();
    notif(`${dada3(dada)} tercatat ${jamMenit(jam)}.`);
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
        </div>` : ""));
  }
}

function kartuReguFinish(r) {
  return `
    <div class="card card-identity" style="margin:0">
      ${html`<div class="nama">${dada3(r.nomor_dada)} · ${r.nama_regu}</div>
      <div class="detail">${r.nama_sekolah} · ${GOLONGAN_LABEL[r.golongan] || r.golongan}</div>
      <div class="detail">Kloter ${r.kloter} · berangkat ${jamMenit(r.jam_berangkat)}${
        r.target_datang ? ` · target ${jamMenit(r.target_datang)}` : ""}</div>`}
      ${r.sisipan
        ? `<div style="margin-top:.4rem"><span class="badge badge-red">sisipan</span></div>`
        : ""}
    </div>`;
}

/* ============================ INPUT POS ================================== */

/** Pos yang sedang dibuka admin. Operator pos tidak memakainya — posnya
 *  melekat di akun dan tidak bisa dipindah dari layar. */
const posDipilih = { nomor: null };

const judulPos = (p) => p
  ? (p.bayangan ? `Pos Bayangan — ${p.name}` : `Pos ${p.nomor} — ${p.name}`)
  : "Pos";

/** Kotak isian satu komponen. BENTUKNYA DITENTUKAN KONFIGURASI, bukan ditulis
 *  per pos di sini — itu sebabnya tabel ini bisa mengikuti lembar mana pun
 *  tanpa menyentuh JavaScript:
 *
 *    form=biner        -> satu centang        (kolom "Kompas (v)")
 *    satuan=detik      -> SATU kotak waktu     ("47" atau "1:10" — lihat
 *                         detikSah di util.js; dulu dua kotak Menit dan
 *                         Detik, dan alasan menyatukannya ada di sana)
 *    satuan=meter      -> satu kotak meter     ("8.55", disimpan sentimeter)
 *    benar_kurang_salah-> Benar / Salah
 *    sisanya           -> satu kotak angka, batasnya dari rentang wajar
 */
function selKomponen(k, nilai) {
  const n1 = nilai ? nilai.nilai_1 : null;
  const n2 = nilai ? nilai.nilai_2 : null;
  const kode = esc(k.kode);

  /* KOTAK KOSONG YANG MENYEBUT DIRINYA KOSONG — tapi hanya di tempat yang
     membutuhkannya.

     Di hampir semua lomba, kosong dan 0 berujung sama: nol kata benar dan
     belum dinilai sama-sama menyumbang 0 poin, jadi menandai kotak kosong
     tidak menjawab pertanyaan siapa pun — ia cuma menambah 38 garis kecil di
     tabel yang sudah penuh.

     Menaksir kebalikannya. Yang ditulis SELISIH, jadi 0 berarti taksirannya
     tepat dan bernilai 100 — nilai tertinggi — sementara kotak kosong berarti
     tidak dinilai dan bernilai 0. Di sanalah satu garis kecil sepadan.

     Penandanya ikut `petunjuk`, bukan daftar kode di dalam kode ini. Komponen
     yang sampai butuh keterangan sendiri adalah persis komponen yang kotak
     kosongnya perlu bicara — dan kalau tahun depan ada lomba lain yang diberi
     `petunjuk`, ia mendapat garis itu juga. Itu perilaku yang dimaksud, bukan
     kejutan. */
  const kosongTampak = k.petunjuk ? ` placeholder="–"` : "";

  if (k.form === "biner") {
    return `<input type="checkbox" class="checkbox" data-kode="${kode}"
                   ${Number(n1) > 0 ? "checked" : ""}
                   aria-label="${esc(k.name)}">`;
  }
  if (k.satuan === "detik") {
    // SATU kotak, dan bertipe text — bukan number — karena isinya boleh
    // memuat titik dua. inputmode="numeric" tetap memanggil papan angka di HP,
    // jadi yang hilang cuma tombol panah naik-turun yang memang tidak pernah
    // dipakai untuk mencatat waktu.
    return `<input type="text" class="small-input input-waktu" inputmode="numeric"
                   data-kode="${kode}" value="${esc(nilaiTeks(k, n1))}"${kosongTampak}
                   aria-label="${esc(k.name)} — detik, atau menit:detik">`;
  }
  if (k.satuan === "meter") {
    // Bertipe text, bukan number, karena isinya boleh memuat KOMA — peserta
    // menulis "8,55" di blangko dan petugas mengetik apa yang ia baca.
    // input[type=number] menolak koma diam-diam: kotaknya jadi kosong tanpa
    // sepatah kata, dan yang mengetiknya mengira angkanya sudah masuk.
    return `<input type="text" class="small-input input-meter" inputmode="decimal"
                   data-kode="${kode}" value="${esc(nilaiTeks(k, n1))}"${kosongTampak}
                   aria-label="${esc(k.name)} — meter, dua angka di belakang koma">`;
  }
  if (k.form === "benar_kurang_salah") {
    return `<span class="pos-pasangan">
      <input type="number" class="small-input" inputmode="numeric" step="1" min="0"
             data-kode="${kode}" data-slot="benar" value="${esc(nilaiTeks(k, n1))}"
             aria-label="${esc(k.name)} — jumlah benar">
      <span class="pos-pemisah" aria-hidden="true">/</span>
      <input type="number" class="small-input" inputmode="numeric" step="1" min="0"
             data-kode="${kode}" data-slot="salah" value="${esc(nilaiTeks(k, n2))}"
             aria-label="${esc(k.name)} — jumlah salah">
    </span>`;
  }
  // Sengaja placeholder, bukan nilai tersimpan. Menyimpan keadaan ketiga
  // bernama "–" akan memaksa setiap tempat yang membaca angka ini menebak
  // maksudnya, padahal database hanya punya dua: ada barisnya, atau tidak.
  // step="1" + inputmode="numeric", BUKAN step="any" + inputmode="decimal".
  // Nilai mentah tidak pernah pecahan (migrasi 0059), dan kotak yang
  // memanggil papan angka bertitik desimal adalah undangan mengetik koma.
  // Ini cuma membuatnya sulit — yang benar-benar menolak adalah constraint
  // nilai_mentah_bulat, karena import massal dan tempel dari spreadsheet
  // tidak lewat kotak ini sama sekali.
  return `<input type="number" class="small-input" inputmode="numeric" step="1"
                 min="${esc(k.rentang_mentah_min)}" max="${esc(k.rentang_mentah_maks)}"
                 data-kode="${kode}" value="${esc(nilaiTeks(k, n1))}"${kosongTampak}
                 aria-label="${esc(k.name)}">`;
}

/** Keterangan kecil di bawah judul kolom — rentang yang boleh diketik,
 *  diambil dari konfigurasi supaya tidak pernah berbeda dengan yang divalidasi
 *  server. Persis angka yang tercetak di judul kolom lembar kertas. */
/** Isi kotak yang tidak bisa dibaca sebagai angka/waktu. Sengaja BUKAN null:
 *  null berarti "kotak kosong", dan jalur simpan menerjemahkan itu jadi
 *  perintah MENGHAPUS nilai yang sudah tersimpan. */
const TIDAK_SAH = Symbol("tidak sah");

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
    // TIGA keadaan, bukan dua. Kotak kosong dan kotak berisi "1:75" tidak
    // boleh diperlakukan sama, dan dulu keduanya sama-sama mengembalikan null.
    //
    // Akibatnya senyap dan merusak: jalur simpan membaca null sebagai "kotak
    // dikosongkan", jadi nilai yang SUDAH tersimpan di database ikut DIHAPUS —
    // lalu barisnya tetap mendapat centang hijau. Petugas salah ketik satu
    // huruf dan kehilangan angka yang sudah benar, tanpa satu pun tanda.
    if (!kotak[0].value.trim()) return null;
    const detik = detikSah(kotak[0].value);
    return detik === null ? TIDAK_SAH : { nilai_1: detik, nilai_2: null };
  }
  if (k.satuan === "meter") {
    // TIGA keadaan, sama seperti detik: kosong berarti "hapus nilainya",
    // tidak terbaca berarti "jangan kirim apa pun". Menyamakan keduanya
    // membuat salah ketik satu huruf MENGHAPUS angka yang sudah benar,
    // lalu barisnya tetap mendapat centang hijau.
    if (!kotak[0].value.trim()) return null;
    const cm = meterSah(kotak[0].value);
    return cm === null ? TIDAK_SAH : { nilai_1: cm, nilai_2: null };
  }
  // KOTAK ANGKA BAWAAN BROWSER PUNYA KEADAAN KETIGA JUGA, dan ia tidak
  // kelihatan. `input[type=number]` yang berisi ketikan yang tidak bisa ia
  // urai — "2 5", "25e", koma di sebagian locale — melaporkan `value` KOSONG
  // sambil tetap MENAMPILKAN teksnya. Tanpa memeriksa `validity.badInput`,
  // baris di bawah membacanya sebagai "kotak dikosongkan", dan jalur simpan
  // menerjemahkan itu jadi perintah menghapus nilai yang sudah tersimpan —
  // lalu barisnya tetap mendapat centang hijau selama komponen lain terisi.
  // Persis kegagalan yang sudah dijaga di kotak detik dan meter di atas; yang
  // ini ketinggalan karena kotaknya bertipe number, bukan text.
  const takTerbaca = (el) => !!(el && el.validity && el.validity.badInput);

  if (k.form === "benar_kurang_salah") {
    // Kotak SALAH ikut dijaga: kalau ia tidak terbaca, mengirim nilai_2 null
    // berarti mencatat "tidak ada yang salah" — angka yang berbeda dari yang
    // diketik, bukan angka yang hilang.
    if (takTerbaca(kotak[0]) || takTerbaca(kotak[1])) return TIDAK_SAH;
    const b = kotak[0].value.trim(), sa = kotak[1].value.trim();
    if (b === "") return null;
    return { nilai_1: Number(b), nilai_2: sa === "" ? null : Number(sa) };
  }
  if (takTerbaca(kotak[0])) return TIDAK_SAH;
  const v = kotak[0].value.trim();
  return v === "" ? null : { nilai_1: Number(v), nilai_2: null };
}

/** Kolom KERTAS untuk satu kolom layar. Sebagian memakan dua kolom, dan
 *  pembagiannya sama persis dengan kotak di layar — supaya petugas yang
 *  menyalin dari kertas ke layar menemukan urutan yang sama, tidak perlu
 *  mencocokkan apa pun di kepalanya. */
const kolomCetakPos = (kolom) => kolom.flatMap(kol => {
  // Bentuk isian sama untuk semua varian satu lomba — yang berbeda antar
  // golongan hanya skalanya, bukan cara menulisnya.
  const k = kol.varian[0];
  // Waktu memakan SATU petak di kertas juga. Dua petak Menit|Detik memaksa
  // petugas memecah angka stopwatch sebelum menuliskannya; satu petak
  // menerima "32" maupun "1:10" apa adanya, persis seperti kotak di layar.
  if (k.satuan === "detik") return [{ nama: kol.nama, petunjuk: kol.petunjuk }];
  if (k.satuan === "meter") return [{ nama: kol.nama, petunjuk: kol.petunjuk }];
  if (k.form === "benar_kurang_salah") return [
    { nama: kol.nama, petunjuk: "benar" }, { nama: "", petunjuk: "salah" }];
  return [{ nama: kol.nama, petunjuk: kol.petunjuk }];
});

/** Lembar nilai untuk DITULIS TANGAN di pos (alur-lomba.md 8.8).
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
// 40, naik dari 30. Diukur — bukan ditaksir — pada A4 melintang:
//
//   tinggi tersedia (margin atas-bawah 6mm)   198,00mm
//   judul + kepala + thead + catatan           17,57mm
//   sisa untuk baris                          180,43mm
//   tinggi satu baris (nomor dada 11pt)         4,45mm
//   -> 40 baris, sisa 2,35mm
//
// Empat langkah membawanya dari 30 ke 40, dan HANYA YANG TERAKHIR
// mengecilkan huruf:
//
//   padding vertikal sel   0,5pt -> 0,25pt
//   margin halaman         10mm -> 6mm atas-bawah
//   jarak baris kepala     1,2  -> 1,1
//   nomor dada             12pt -> 11pt        <- ini yang membeli 38-40
//
// Sel isian KOSONG tidak punya line box, jadi tingginya cuma padding +
// garis. Yang mengangkat tinggi baris adalah sel berisi yang paling besar,
// dan itu nomor dada — karena itu ia satu-satunya huruf yang berpengaruh.
//
// Lembar cadangan dicetak untuk SELURUH nomor dada termasuk yang belum
// terdaftar — 510 baris. Jadi 17 lembar turun ke 13.
//
// Kalau 11pt ternyata terlalu kecil dibaca ulang dari FOTO lembar,
// kembalikan ke 12pt di style.css dan angka ini ke 37.
const REGU_PER_LEMBAR = 40;

function siapkanCetakLembarPos(pos, kolomLayar, baris) {
  document.getElementById("cetakan")?.remove();
  const set = [{ judul: null, kolom: kolomCetakPos(kolomLayar) }];
  const judul = pos.bayangan ? `POS BAYANGAN — ${pos.name}`
                             : `POS ${pos.nomor} — ${pos.name}`;
  const tanggal = tanggalPanjang(new Date());

  const halaman = [];
  for (let i = 0; i < baris.length; i += REGU_PER_LEMBAR) {
    halaman.push(baris.slice(i, i + REGU_PER_LEMBAR));
  }

  // Sel identitas lewat tag html`` (isinya diketik orang luar); kotak kosong
  // ditempel sebagai HTML biasa karena memang tidak ada isinya.
  // Nomor yang belum ada regunya di sistem tetap mendapat barisnya, dan
  // identitasnya dibiarkan KOSONG — bukan ditandai "tidak dipakai".
  //
  // Dua jalan menuju baris kosong, dan keduanya nyata. Sebagian sekolah
  // mendaftar OFFLINE, jadi regunya memakai nomor dada fisik tanpa pernah
  // masuk sistem sampai daftar ulang menyusulkan datanya. Dan kertas ini
  // DICETAK LEBIH DULU, sebelum pendaftaran ditutup — regu yang menyusul
  // sesudahnya tetap harus punya tempat.
  // Barisnya harus bisa DITULISI: petugas mengisi nama regu dan sekolahnya di
  // tempat itu, dan meja daftar ulang memakainya untuk melengkapi data
  // belakangan. Garis "tidak dipakai" akan membuat petugas mencari tempat
  // lain — biasanya pinggir kertas, tempat tidak ada yang mencarinya.
  const barisHtml = (kolom) => (r) => r.kosong ? `
    <tr>
      ${html`<td class="dada">${dada3(r.nomor_dada)}</td>`}
      <td></td><td></td><td></td>
      ${kolom.map(() => `<td class="isian"></td>`).join("")}
    </tr>` : `
    <tr>
      ${html`<td class="dada">${dada3(r.nomor_dada)}</td>
      <td>${r.nama_regu}</td>
      <td>${r.nama_sekolah}</td>
      <td>${GOLONGAN_SINGKAT[r.golongan] || r.golongan}</td>`}
      ${kolom.map(() => `<td class="isian"></td>`).join("")}
    </tr>`;

  // Tiap lembar berdiri sendiri: judul pos, nomor halaman, dan baris tanda
  // tangannya sendiri. Kertas ini beredar sebagai lembaran lepas yang
  // berpindah tangan lewat foto — halaman yang tidak menyebutkan posnya
  // sendiri bisa dinilaikan ke pos yang salah. Di mode per lomba nama
  // lombanya ikut, karena sekarang beredar beberapa lembar berbeda dari pos
  // yang sama sekaligus, dan "Pos 1 halaman 2/2" ada tiga.
  const lembar = set.map(({ judul: judulLomba, kolom }) =>
    halaman.map((grup, i) => `
    <section class="print-page lembar-pos">
      <h1>LEMBAR CADANGAN · ${esc(judul)}${judulLomba ? ` · ${esc(judulLomba)}` : ""}
          · Halaman ${i + 1}/${halaman.length}</h1>
      <p class="lembar-kepala">${esc(EDISI ? EDISI.name : "")} · ${esc(tanggal)} ·
         dada ${esc(dada3(grup[0].nomor_dada))}–${esc(dada3(grup[grup.length - 1].nomor_dada))}
         · Petugas: ______________ · Diperiksa: ______________</p>
      <table class="print-table">
        <thead>
          <tr>
            <!-- "Gol.", bukan "Golongan": judulnyalah yang melebarkan
                 kolom ini, bukan isinya. "GOLONGAN" di 8pt butuh ~17mm
                 sementara "Pgl Pi" di 10pt cuma ~13mm, dan selisihnya
                 diambil dari kolom Organisasi yang justru terpotong. -->
            <th>No Dada</th><th>Nama Regu</th><th>Organisasi</th><th>Gol.</th>
            ${kolom.map(c => `<th class="isian">${esc(c.nama)}
              <span class="kolom-petunjuk">${esc(c.petunjuk)}</span></th>`).join("")}
          </tr>
        </thead>
        <tbody>${grup.map(barisHtml(kolom)).join("")}</tbody>
      </table>
      ${i === 0 ? `<p class="print-note">Tulis data mentahnya apa adanya, JANGAN
         menjumlahkan sendiri. Baris tanpa nama = regu yang belum terdaftar;
         tulis nama regu dan sekolahnya di situ.</p>` : ""}
    </section>`).join("")).join("");

  document.body.appendChild(h(`<div id="cetakan" class="printout">${lembar}</div>`));
}

/** Judul besar di atas kotak isian: APA yang harus ditulis di sana.
 *
 *  Konfigurasi menang. Empat dari lima bentuk penilaian bisa diterjemahkan
 *  sendiri, karena bentuknya menentukan artinya — `satuan = detik` selalu
 *  berarti waktu, `besar_baik` selalu berarti jumlah benar.
 *
 *  `bertingkat` tidak bisa. Ia cuma tangga angka, dan angkanya bisa detik,
 *  meter, selisih, atau apa pun yang panitia putuskan tahun itu. Menebaknya
 *  pernah menghasilkan "Hasil ukur" untuk Menaksir — kata yang membaca seperti
 *  perintah menulis jarak TERUKUR, padahal yang diminta SELISIH-nya. Kalau
 *  petugas menulis 12 alih-alih 2, tangga Menaksir habis di atas 4 meter dan
 *  hampir setiap regu mendapat 0, tanpa satu galat pun.
 *
 *  Jadi bentuk itu membawa judulnya sendiri lewat `judul_isian` (0039), dan
 *  cadangannya sengaja tidak menjanjikan apa-apa. */
function judulIsian(k) {
  if (k.judul_isian) return k.judul_isian;
  if (k.satuan === "detik") return "Waktu tempuh";
  if (k.satuan === "meter") return "Hasil taksir";
  if (k.form === "biner") return "Kena / tidak";
  if (k.form === "benar_kurang_salah") return "Benar dan salah";
  if (k.form === "bertingkat") return "Data mentah";
  return "Jumlah benar";
}

/** Keterangan di bawah judul: rentang yang boleh ditulis, dan untuk waktu satu
 *  contoh nyata. Contoh itu bukan hiasan — ia mencegah seluruh kelas kesalahan
 *  yang tidak bisa dicegah kalimat mana pun: petugas yang menulis "0:47" di
 *  kotak berlabel DETIK, atau menulis poin alih-alih data mentah.
 *
 *  Menerima KOLOM, bukan komponen tunggal, dan itu yang penting. Satu blangko
 *  dipakai regu golongan mana pun, sementara Tebak Simpul punya dua skala —
 *  5 simpul untuk Penggalang, 10 untuk Penegak. Mengambil rentang dari varian
 *  pertama saja akan mencetak "0 – 10" di kertas yang separuhnya dipegang regu
 *  Penggalang: bukan sekadar kurang lengkap, tapi salah.
 *
 *  `kol.petunjuk` sudah menggabungkan rentang yang berbeda jadi
 *  "0 – 10 / 0 – 5", sama persis dengan yang tercetak di form tabel. Keduanya
 *  benar, tergantung golongan, dan petugas lomba itu tahu yang mana. */
function contohIsian(kol) {
  const k = kol.varian[0];
  // KERTAS MENGIKUTI LAYAR, tidak menulis kalimatnya sendiri. Sebelumnya baris
  // ini berbunyi "dalam DETIK · contoh: 47" sementara kepala kolom di layar
  // sudah berbunyi "menit:detik" dan kotaknya sudah menulis "00:47" — juri
  // yang mengikuti kertas dan juri yang mengikuti layar menulis dua hal
  // berbeda untuk waktu yang sama, dan blangko sudah difotokopi sebelum ada
  // yang menyadarinya. Contohnya tetap ada, karena contoh nyata mencegah
  // sekelas kesalahan yang tidak bisa dicegah kalimat mana pun.
  if (k.satuan === "detik") return `${kol.petunjuk} · contoh: 00:47`;
  if (k.satuan === "meter") return `${kol.petunjuk} · contoh: 8.55`;
  // Keterangan yang ditulis panitia sendiri dipakai apa adanya — ia sudah
  // berupa kalimat, bukan rentang yang perlu diberi kata "angka".
  if (k.petunjuk || k.form === "biner") return kol.petunjuk;
  return `angka ${kol.petunjuk}`;
}

/** FORM PER LOMBA — BLANGKO KOSONG, satu lembar untuk satu regu di satu lomba
 *  (alur-lomba.md 8.3).
 *
 *  KENAPA KOSONG, PADAHAL SISTEM TAHU SEMUA NAMA REGUNYA.
 *
 *  Karena regu datang ke pos dalam urutan ACAK. Kloter berangkat berurutan,
 *  tetapi rute, kecepatan, dan antrean membuat siapa yang muncul berikutnya
 *  tidak bisa ditebak. Kalau tiap kertas sudah tercetak identitasnya, petugas
 *  harus MENCARI kertas nomor 005 di tumpukan berisi ratusan lembar setiap
 *  kali satu regu masuk — pekerjaan yang lebih lama daripada lombanya sendiri,
 *  dilakukan sambil regu menunggu.
 *
 *  Jadi semua kertas identik; sistem mencetak BENTUKNYA, bukan satu lembar
 *  yang sudah diisi untuk tiap regu. Petugas menulis nomor dada, nama regu,
 *  dan pangkalan/sekolah, lalu melingkari satu kategori. Identitas yang tetap
 *  menempel pada lembar lepas itu menjadi pemeriksaan kedua bila nomor dada
 *  salah tulis atau sulit dibaca.
 *
 *  Nomor dada mendapat kotak terbesar karena itulah kunci utama saat tim IT
 *  mengurutkan dan mengetik ratusan lembar. Kategori tidak ditulis ulang:
 *  pilihannya sudah tercetak agar satu lingkaran cukup dan tidak bisa salah
 *  eja. Nama lomba, satuan, tempat nilai, dan tanda tangan juga sudah menjadi
 *  bagian bentuk yang sama pada setiap master.
 */
function siapkanCetakBlangko(pos, kolomLayar) {
  document.getElementById("cetakan")?.remove();

  const judulPos = pos.bayangan ? pos.name : `Pos ${pos.nomor} · ${pos.name}`;

  /* IDENTITAS REGU — sama di semua lomba.

     Nomor dada dibuat besar karena ia dibaca dua kali dalam keadaan
     sama-sama tergesa: saat ditulis di tengah antrean, dan saat tim IT
     mengurutkan ratusan lembar lepas dengan hanya melihat sudut kertas.

     KATEGORI DILINGKARI, bukan ditulis. Empat golongan sudah pasti, jadi
     menuliskannya berarti menyalin dua kata yang sudah ada di kertas —
     sementara satu lingkaran tidak bisa salah eja dan terbaca dari jarak
     satu meja.

     URUTANNYA DIBACA DARI URUT_GOLONGAN, tidak ditulis ulang di sini. Kertas
     dan layar harus menyebut keempatnya dalam urutan yang sama — petugas yang
     menyalin dari satu ke yang lain menghitung posisi, bukan membaca nama —
     dan salinan kelima dari daftar ini persis yang sudah dibersihkan sekali
     (lihat kepala URUT_GOLONGAN di util.js). */
  const identitas = `
      <table class="bl-identitas"><tbody>
        <tr>
          <td class="bl-dada"><span class="bl-label">No Dada</span></td>
          <td class="bl-regu"><span class="bl-label">Nama Regu</span></td>
          <td class="bl-sekolah"><span class="bl-label">Pangkalan / Sekolah</span></td>
        </tr>
        <tr>
          <td class="bl-kategori" colspan="3">
            <span class="bl-label">Kategori &mdash; lingkari salah satu</span>
            <span class="bl-pilihan">${URUT_GOLONGAN.filter(g => !g.startsWith("intern_")).map(g =>
              `<span>${esc(GOLONGAN_LABEL[g])}</span>`).join("")}</span>
          </td>
        </tr>
      </tbody></table>`;

  /* BAGIAN PANITIA BERBENTUK PITA, bukan kotak setinggi kotak nilai.

     Satu lembar kini dipegang DUA tangan — peserta menulis jawabannya,
     panitia menulis angkanya — jadi label "diisi panitia" harus menempel
     pada kotaknya, bukan melayang sebagai judul di atasnya. Menempel juga
     yang membuatnya muat: A5 melintang tidak punya ruang untuk dua judul
     berdiri sendiri ditambah dua kotak setinggi 30mm, dan diukur memang
     meluap 15 sampai 28mm sebelum bentuk ini dipakai.

     Angkanya paling banyak dua digit, jadi 21mm sudah tinggi untuk ditulis
     besar — yang butuh ruang di lembar ini isian peserta, bukan isian
     panitia.

     LABEL DI KIRI, kotaknya mengisi sisa lebar. Bentuk bertumpuk sempat
     dipakai waktu Menaksir masih punya dua kotak — di sana label yang
     berjajar mendatar terbaca sebagai pasangan maju atau pasangan mundur.
     Sejak Menaksir tidak lagi dinilai tangan, tiap pita cuma punya SATU
     kotak dan kekaburan itu hilang; yang tersisa keuntungannya, yaitu kotak
     selebar sisa halaman untuk menulis angka besar-besar. */
  const pitaPanitia = (sel) => `
      <div class="bl-panitia">
        <span class="bl-panitia-siapa">Diisi panitia</span>
        ${sel.map(([judul, petunjuk]) => `
        <span class="bl-panitia-sel">
          <span class="bl-panitia-judul">${esc(judul)}</span>
          <span class="bl-panitia-contoh">${esc(petunjuk)}</span>
        </span>
        <span class="bl-panitia-kotak"></span>`).join("")}
      </div>`;

  const penanda = (siapa) => `<p class="bl-siapa">${esc(siapa)}</p>`;

  /* LEMBAR BERNOMOR — sepuluh jawaban peserta, satu angka dari panitia.

     Dipakai tiga lomba yang bentuknya sama persis: Tebak Simpul, KIM Lihat,
     KIM Cium. Yang berbeda cuma apa yang ditulis peserta dan nama hitungan
     panitianya, jadi ketiganya memanggil bentuk ini alih-alih menyalinnya —
     tiga salinan berarti perbaikan berikutnya harus diketik tiga kali dan
     dua di antaranya akan terlewat.

     SEPULUH nomor pada satu master. Penggalang mengisi 1-5 di Tebak Simpul
     dan membiarkan sisanya kosong; dua tumpukan yang berbeda bentuknya adalah
     dua tumpukan yang bisa tertukar di lapangan, dan nomor kosong tidak
     pernah salah dibaca sebagai jawaban.

     Nomornya menurun PER LAJUR — 1-5 di kiri, 6-10 di kanan — bukan
     berselang-seling kiri-kanan. Dua lajur lima baris, bukan satu lajur
     sepuluh: A5 melintang lebar dan pendek, dan sepuluh baris berurutan ke
     bawah tidak muat tanpa mengecilkan barisnya sampai tidak bisa ditulisi. */
  const lembarBernomor = (yangDitulis, judulPanitia, petunjuk) => `
      ${penanda(`Diisi peserta — ${yangDitulis}`)}
      <div class="bl-nomor-grid">
        ${[0, 1, 2, 3, 4].flatMap(r => [r + 1, r + 6]).map(n => `
        <div class="bl-nomor-baris">
          <span class="bl-nomor">${n}.</span>
          <span class="bl-nomor-garis"></span>
        </div>`).join("")}
      </div>
      ${pitaPanitia([[judulPanitia, petunjuk]])}`;

  /* ---------------------------------------------------------------------
     BENTUK KHUSUS PER LOMBA.

     Tiga lomba mengisi lembarnya berdua: peserta menulis jawaban, panitia
     menulis angkanya. Bentuk itu TIDAK bisa diturunkan dari konfigurasi —
     `wahana` tahu rentang dan satuan, tidak tahu bahwa Semaphore punya lima
     amplop atau bahwa Tebak Simpul bernomor sampai sepuluh.

     Kuncinya `kode_lomba` — kunci BEKU dari migrasi 0079, yang sama dengan
     yang dipakai foto slip. Bukan `kode` wahana (Tebak Simpul punya empat,
     satu per golongan) dan bukan namanya (mengganti nama lomba akan
     mengembalikan lembarnya ke bentuk generik tanpa satu pun galat).

     Lomba yang tidak ada di sini memakai bentuk generik di bawah, dan itu
     keadaan yang sah — bukan kekurangan yang menunggu dilengkapi. */
  const bentukKhusus = {
    /* SEMAPHORE. Peserta mengambil satu dari lima amplop, tiap amplop berisi
       lima huruf. Yang ditulis peserta: nomor amplopnya dan kelima hurufnya.
       Panitia mencocokkan dengan kunci amplop itu lalu menghitung berapa
       huruf yang benar — 0 sampai 5, sama dengan rentang di konfigurasi.

       SATU kotak besar untuk kelima hurufnya, bukan lima kotak. Lima petak
       memaksa tulisan mengikuti petaknya, dan huruf semaphore yang ditulis
       tergesa lebih sering melebar daripada rapi — satu kotak lebar tidak
       pernah kekurangan tempat. Kotak nomor amplopnya selebar tulisan
       "Nomor Amplop" di atasnya, jadi lebarnya sendiri sudah memberi tahu
       bahwa yang ditulis di sana cuma satu angka. */
    "semaphore": () => `
      ${penanda("Diisi peserta")}
      <div class="bl-amplop">
        <div class="bl-amplop-nomor">
          <span class="bl-nilai-judul">Nomor Amplop</span>
          <div class="bl-kotak-huruf"></div>
        </div>
        <div class="bl-amplop-jawab">
          <span class="bl-nilai-judul">Jawaban Semaphore</span>
          <div class="bl-kotak-huruf"></div>
        </div>
      </div>
      ${pitaPanitia([["Jumlah huruf yang benar", "( 0 – 5 )"]])}`,

    /* Tiga lomba di bawah ini memakai bentuk yang sama; alasannya di
       lembarBernomor(). */
    "tebak-simpul": () => lembarBernomor(
      "nama simpulnya", "Jumlah simpul yang benar", "( 0 – 5 / 0 – 10 )"),

    /* KIM LIHAT dan KIM CIUM: dua lomba, dua lembar, bentuk yang sama dengan
       Tebak Simpul. Peserta menuliskan sepuluh jawabannya, panitia menghitung
       berapa yang benar. */
    "kim-lihat": () => lembarBernomor(
      "benda yang dilihat", "Jumlah benar", "( 0 – 10 )"),
    "kim-cium": () => lembarBernomor(
      "benda yang dicium", "Jumlah benar", "( 0 – 10 )"),

    /* MENAKSIR — SATU-SATUNYA lembar tanpa bagian panitia.

       Yang diketik ke sistem adalah TAKSIRAN PESERTA apa adanya, bukan
       selisihnya: jawaban sebenarnya tersimpan di konfigurasi, dan mesin
       skor yang menghitung selisihnya. Jadi tidak ada yang perlu dinilai
       tangan di kertas ini — panitia cuma membaca angka yang sudah ditulis
       peserta lalu mengetiknya.

       Kotak jawaban sebenarnya SENGAJA tidak dicetak. Ia sama untuk semua
       regu, dan angka yang tercetak di 300 lembar adalah 300 kesempatan
       peserta membacanya sebelum menaksir.

       "contoh: 7.34" memakai TITIK, dan contohnya ada justru karena itu:
       peserta menulis koma seperti kebiasaan menulis angka di Indonesia,
       sementara yang diterima kotak isian di layar adalah titik. Satu contoh
       nyata mencegah seluruh kelas kesalahan itu tanpa satu kalimat pun. */
    "menaksir": () => `
      ${penanda("Diisi peserta")}
      <div class="bl-taksir">
        <span class="bl-nilai-judul">Hasil Taksir</span>
        <span class="bl-nilai-contoh">meter, dua angka di belakang koma — contoh: 7.34</span>
        <div class="bl-taksir-kotak"></div>
      </div>`,
  };

  const satuBlangko = (lomba) => {
    const kols = lomba.kolom;
    // Varian mana pun boleh dipakai untuk menurunkan bentuknya: yang berbeda
    // antar golongan hanya skalanya, dan skala tidak dicetak di blangko —
    // justru itu gunanya. Petugas menulis jumlah benar apa adanya, dan sistem
    // yang tahu 5 simpul untuk Penggalang, 10 untuk Penegak.
    const generik = () => `
      ${penanda("Diisi panitia")}
      <div class="bl-nilai${kols.length > 1 ? " bl-nilai-banyak" : ""}">
        ${kols.map(kol => `
        <div class="bl-nilai-sel">
          <div class="bl-nilai-kepala">
            <span class="bl-nilai-judul">${esc(kols.length > 1
              ? kol.nama : judulIsian(kol.varian[0]))}</span>
            <span class="bl-nilai-contoh">${esc(contohIsian(kol))}</span>
          </div>
          <div class="bl-nilai-kotak"></div>
        </div>`).join("")}
      </div>`;

    const khusus = bentukKhusus[lomba.kode];
    const badan = (khusus || generik)();

    /* Catatan "tulis angkanya saja" hanya di bentuk generik. Di lembar
       khusus ia sudah dijawab dua kali — pita panitia menyebut satuan dan
       rentangnya, dan kotaknya sendiri bernama "Jumlah ... yang Benar" —
       sementara satu baris di A5 yang sudah penuh adalah 6mm yang dipakai
       kotak tulis (CLAUDE.md 9.3). */
    const catatan = khusus ? "" : `
      <p class="bl-catatan"><strong>Tulis angkanya saja — jangan menghitung
         poin.</strong></p>`;

    return `
    <article class="blangko">
      <p class="bl-pos">${esc(judulPos)}</p>
      <h2 class="bl-lomba">${esc(lomba.nama)}</h2>
      <p class="bl-acara">${esc(EDISI ? EDISI.name : "")}</p>

      ${identitas}

      ${badan}

      ${catatan}

      <!-- TIGA JURI, bukan satu petugas. Satu lomba dinilai bersama, dan
           tanda tangan yang cuma satu membuat dua juri lain tidak punya
           tempat menyatakan bahwa angka itu juga angka mereka. Namanya
           ditulis tangan: yang bertugas di sebuah pos berganti sepanjang
           pagi, dan blangko sudah difotokopi jauh sebelum itu diputuskan. -->
      <div class="bl-ttd">
        ${[1, 2, 3].map(i => `
        <div class="bl-ttd-sel">
          <span class="bl-ttd-nama">Juri ${i}</span>
          <span class="bl-ttd-garis"></span>
        </div>`).join("")}
      </div>
    </article>`;
  };

  // SATU HALAMAN A5 MELINTANG PER LOMBA, bukan sebanyak jumlah regu.
  //
  // Yang dicetak dari sini adalah MASTER, bukan tumpukannya. Blangko
  // diperbanyak dengan mesin fotokopi — 500 regu di pos berisi tiga lomba
  // membutuhkan 1.500 lembar, dan mencetak sebanyak itu lewat browser berarti
  // menghabiskan satu toner printer kantor untuk pekerjaan yang diselesaikan
  // mesin fotokopi dalam beberapa menit.
  //
  // Jadi keluarannya tiga halaman untuk Pos 1: Semaphore, Tebak Simpul,
  // Menaksir. Panitia menggandakan tiap halaman sebanyak yang dibutuhkan, dan
  // tiap tumpukan otomatis berisi satu lomba saja.
  /* LOMBA SOAL TIDAK PUNYA BLANGKO, dan itu bukan penghematan kertas.
     Kepramukaan, Keagamaan, Kesehatan, Pengetahuan Umum, dan Logika dijawab
     peserta di LEMBAR SOALNYA SENDIRI — lembar itulah bukti dan lembar itu
     pula yang dikumpulkan. Blangko kosong di sampingnya cuma kertas kedua
     untuk satu angka yang sudah tertulis di kertas pertama, dan kertas kedua
     yang tidak dipakai tetap difotokopi 1.500 kali.

     Dikenali dari `type`, bukan dari namanya: `soal` adalah kolom di database
     dan panitia yang menentukan isinya (0076). Menyaring dengan daftar nama
     berarti lomba soal tahun depan tercetak lagi tanpa ada yang tahu kenapa. */
  const lombaSoal = (l) => l.kolom.every(kol => kol.varian[0].type === "soal");
  const daftarLomba = kelompokLomba(kolomLayar).filter(l => !lombaSoal(l));
  if (!daftarLomba.length) return 0;

  const cetakan = daftarLomba.map(l => `
    <section class="print-page blangko-halaman">${satuBlangko(l)}</section>`).join("");

  document.body.appendChild(h(`<div id="cetakan" class="printout">${cetakan}</div>`));
  return daftarLomba.length;
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
  if (!bolehLihat("pos")) {
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
  LAYAR.replaceChildren(h(pemuat()));

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
  // Terkunci = punya kolom `pos`, bukan = berperan juri_pos. Koordinator Pos
  // tidak punya pos, jadi ia ikut jalur pemilih di bawah.
  // SATU patokan untuk dua keputusan: pos mana yang dibuka, dan apakah tombol
  // cetak ikut tampil di HP. Keduanya bertanya hal yang sama — "akun ini
  // melayani satu pos, atau seluruh pos?" — dan menjawabnya dua kali dengan
  // cara berbeda adalah cara keduanya berselisih diam-diam.
  const terkunciPos = s.pos != null && s.pos !== "";
  const nomorPos = terkunciPos
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
  // Rentang stok nomor dada diambil DI SINI, bukan saat tombol cetak ditekan.
  // Alasannya bukan kecepatan: `window.print()` harus tetap berada di giliran
  // event tap, dan Safari iPhone memblokirnya begitu ada satu `await` lebih
  // dulu (lihat catatan yang sama di layarCetakKloter). Stok nomor dada juga
  // tidak berubah di tengah lomba — ia dicetak di kain, bukan di database.
  // Gagal membacanya tidak boleh menghalangi apa pun: nol berarti lembar
  // dicetak apa adanya, tanpa baris kosong penambal.
  let rentangStok = null;
  /* null = status fotonya TIDAK diketahui, dan itu berbeda dari "tidak ada
     foto". Kalau permintaannya gagal — pos memang sering kehilangan sinyal —
     menandai semua baris "belum foto" akan menuduh ratusan regu sekaligus.
     Yang benar: berhenti menilai fotonya, dan katakan begitu di saringannya. */
  let fotoPos = null;
  try {
    [komponen, lembar, rentangStok, fotoPos] = await Promise.all([
      komponenPos(EDISI.nomor, pos.nomor),
      lembarPos(pos.nomor),
      rentangNomorDada().catch(() => null),
      fotoLembarPos(pos.nomor).catch(() => null),
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
      </div>`));
    pasangPilihPos(s);
    return;
  }

  // Satu kolom per LOMBA, bukan per baris wahana. Tebak Simpul punya empat
  // baris (satu per golongan) dan tetap satu kolom — lihat kolomPos().
  const kolom = kolomPos(komponen);

  /** Komponen yang boleh diisi baris ini. Dipakai saat MENYIMPAN, bukan cuma
   *  saat menggambar: kotak milik golongan lain memang tidak ada di DOM, tapi
   *  memutar seluruh daftar komponen di sini akan membuat bacaSel() mencari
   *  kotak yang tidak pernah ada dan jatuh di `kotak[0].value`. */
  const komponenBaris = (tr) =>
    kolom.map(kol => varianUntuk(kol, tr.dataset.golongan)).filter(Boolean);

  // Cermin nilai yang ADA DI DATABASE, bukan yang ada di kotak isian. Yang
  // dikirim ke server hanya selisih antara keduanya — kotak yang tidak diubah
  // tidak pernah ditulis ulang, jadi kepengarangan nilai tidak bergeser dan
  // riwayat tidak dibanjiri baris yang tidak mengubah apa-apa.
  const asli = new Map(lembar.map(r => [Number(r.nomor_dada), r.nilai || {}]));

  LAYAR.replaceChildren(h(`
    <div class="card">
      ${alatTabel({
        /* Pita keadaan duduk DI SEBELAH pemilih pos, bukan di baris sendiri.
           Keduanya menjawab pertanyaan yang sama — "saya sedang di pos mana,
           dan apakah yang saya ketik sudah aman" — dan itu satu lirikan, bukan
           dua. Di HP baris sendiri berarti satu baris lagi yang harus digulir
           sebelum sampai ke tabelnya. */
        kiri: `<div class="baris-pos">${pilihPosHtml(s, semuaPos)}
                 <div id="pos-simpan" class="pos-simpan aman"></div></div>`,
        // Dua bentuk kertas, dan URUTANNYA menyatakan mana yang utama.
        // Form per lomba dipakai setiap hari lomba di setiap pos; form tabel
        // hanya kalau slipnya habis atau sinyal mati. Tombol cadangan yang
        // berdiri lebih dulu akan dipakai orang yang tidak tahu bedanya.
        //
        // Namanya memakai kosakata panitia persis — "form per lomba" dan
        // "form tabel" adalah kata yang mereka ucapkan sendiri, dan tombol
        // bernama lain memaksa penerjemahan di kepala setiap kali dipakai.
        //
        // Dibungkus `.alat-cetak` supaya bisa disembunyikan di HP: mencetak
        // dari HP tidak pernah terjadi — kertasnya keluar dari mesin fotokopi
        // di sekretariat — dan dua tombol selebar layar di antara penyaring
        // dan tabel memaksa petugas menggulir melewatinya ratusan kali per
        // shift untuk sampai ke pekerjaannya.
        //
        // Di HP ia tetap tampil untuk akun yang TIDAK terkunci ke satu pos —
        // koordinator pos dan admin. Merekalah yang menyiapkan kertas untuk
        // pos lain, dan patokannya kolom `pos` yang kosong, bukan nama
        // perannya (patokan yang sama dengan pemilih pos di bawah).
        kanan: `<span class="alat-cetak${terkunciPos ? "" : " alat-cetak-hp"}">
                <button class="button button-secondary button-small" type="button"
                        id="cetak-per-lomba">🖨️ Form per Lomba</button>
                <button class="button button-secondary button-small" type="button"
                        id="cetak-lembar">🖨️ Form Tabel (cadangan)</button></span>`,
        // Pendek dengan sengaja: kartunya kini selebar tabel, dan petunjuk
        // panjang terpotong di tengah kata — yang justru lebih buruk daripada
        // petunjuk singkat, karena terlihat seperti layar yang rusak.
        cariContoh: "Cari nomor dada / regu / organisasi…",
        /* Empat saringan, dan keduanya yang "belum" TIDAK saling meniadakan:
           satu regu bisa belum diinput DAN belum difoto, lalu muncul di
           kedua-duanya. Itu benar — ini pandangan, bukan kotak yang harus
           berisi tepat satu kali tiap regu.

           "Lengkap" menuntut KEDUANYA: nilai penuh dan foto penuh. Kalau ia
           cuma menuntut nilainya, regu yang fotonya kurang akan berdiri di
           "Belum Foto" dan di "Lengkap" sekaligus — dua label yang saling
           membantah tentang regu yang sama. */
        saringan: [
          // Tanpa `pendek`: keempat labelnya sudah dua kata, dan `pendek` yang
          // isinya sama persis dengan `label` cuma menggandakan teksnya bagi
          // pembaca layar — yang dibaca kedua span, bukan yang terlihat.
          { kode: "belum-input", label: "Belum Input" },
          { kode: "belum-foto", label: "Belum Foto" },
          { kode: "lengkap", label: "Lengkap" },
          { kode: "semua", label: "Semua" },
        ],
        saringAktif: "semua",
        jumlah: lembar.length,
      })}
      <!-- Pita keadaan simpan. Duduk DI ATAS tabel, bukan di bawahnya:
           tabelnya bergulir sendiri (max-height), jadi apa pun yang ditaruh
           di bawah bisa berada di luar layar justru saat petugas sedang
           mengetik di baris ke-80. -->
      <!-- Pita keadaannya ada DI DALAM toolbar, di sebelah pemilih pos.
           SELALU terlihat, tidak pernah hidden: pita yang hanya muncul saat
           ada masalah tidak bisa dipercaya, karena petugas tidak punya cara
           membedakan "semuanya aman" dari "pitanya sedang rusak". Google
           Sheets menampilkan capnya terus-menerus untuk alasan yang sama. -->
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
              ${kolom.map(kol => `
                <th class="text-center">
                  <span class="kolom-nama">${esc(kol.nama)}</span>
                  <span class="kolom-petunjuk">${esc(kol.petunjuk)}</span></th>`).join("")}
              <th class="text-center">Nilai<br>${esc(pos.bayangan ? pos.name : `Pos ${pos.nomor}`)}</th>
              <th class="text-center"><span class="visually-hidden">Status simpan</span></th>
              <th class="text-center"><span class="visually-hidden">Foto</span></th>
              <th class="text-center"><span class="visually-hidden">Gembok</span></th>
            </tr>
          </thead>
          <tbody id="isi-tabel"></tbody>
        </table>
        ${lembar.length ? "" : `<p class="table-empty">Belum ada regu yang
          menerima nomor dada.</p>`}
      </div>
    </div>
  `));

  /* ---------- status foto per regu ----------

     Satu slip = satu LOMBA (bagian 11.6), bukan satu penilaian: Pembidaian
     lima kriteria berbagi satu kertas dan satu `kode_lomba`. Jadi yang
     dihitung kurang di sini lomba, bukan kolom.

     Lomba yang komponennya tidak berlaku untuk golongan regu itu TIDAK ikut
     dituntut — regu Penggalang tidak pernah punya slip Tebak Simpul Penegak,
     dan menuduhnya belum foto adalah alarm yang tidak bisa dipenuhi siapa
     pun. */
  const lombaPos = kelompokLomba(kolom);
  const fotoPunya = new Map();
  (fotoPos || []).forEach(f => {
    const dada = Number(f.nomor_dada);
    if (!fotoPunya.has(dada)) fotoPunya.set(dada, new Set());
    fotoPunya.get(dada).add(f.kode_lomba);
  });

  /** "1" kurang, "0" lengkap, "" belum diketahui (permintaannya gagal). */
  const tandaFoto = (r) => {
    if (fotoPos === null) return "";
    const punya = fotoPunya.get(Number(r.nomor_dada)) || new Set();
    const kurang = lombaPos.some(l =>
      l.kolom.some(kol => varianUntuk(kol, r.golongan)) && !punya.has(l.kode));
    return kurang ? "1" : "0";
  };

  const tbody = document.getElementById("isi-tabel");
  tbody.replaceChildren(h(lembar.map(r => `
    <tr data-dada="${esc(r.nomor_dada)}" data-terisi="${esc(r.jumlah_terisi)}"
        data-golongan="${esc(r.golongan)}" data-komponen="${esc(r.jumlah_komponen)}"
        data-foto-kurang="${tandaFoto(r)}"
        data-terkunci="${r.terkunci ? "1" : ""}">
      <td class="angka text-center" data-label="Nomor Dada">${esc(dada3(r.nomor_dada))}</td>
      <td data-label="Nama Regu"><strong>${esc(r.nama_regu)}</strong></td>
      <td data-label="Organisasi">${esc(r.nama_sekolah)}</td>
      <td data-label="Golongan">${esc(GOLONGAN_LABEL[r.golongan] || r.golongan)}</td>
      ${kolom.map(kol => {
        const k = varianUntuk(kol, r.golongan);
        // Sel mati, bukan kotak kosong. Kotak yang bisa diketik tapi selalu
        // ditolak adalah jebakan; garis pendek menjawab pertanyaannya sebelum
        // ditanya — kolom ini bukan untuk golongan regu ini.
        return `<td class="text-center" data-label="${esc(kol.nama)}">
          ${k ? selKomponen(k, (r.nilai || {})[k.kode])
              : `<span class="sel-mati" title="Bukan untuk ${esc(GOLONGAN_LABEL[r.golongan] || r.golongan)}">–</span>`}</td>`;
      }).join("")}
      <td class="text-center pos-nilai" data-label="Nilai Pos">${esc(angkaRapi(r.nilai_pos))}</td>
      <td class="pos-status" data-label=""></td>
      <td class="pos-foto text-center" data-label="">
        <button type="button" class="badge badge-tombol" data-foto
          title="Foto jawaban regu ini">${ikon("camera")}</button></td>
      <td class="pos-gembok" data-label=""></td>
    </tr>`).join("")));

  /* Kamera dipasang lewat satu pendengar di tbody, bukan satu per baris.
     Tombolnya digambar sekali di template dan tidak pernah digambar ulang —
     berbeda dengan gembok dan penanda simpan, yang berganti rupa mengikuti
     keadaan barisnya. Menempelkan ~300 pendengar untuk tombol yang tidak
     pernah berubah adalah ongkos yang tidak dibayar apa-apa. */
  /** Baca ulang status foto sepos, lalu tandai ulang tiap baris.
   *
   *  Dipanggil sesudah dialog foto ditutup: di dalamnya foto bisa diunggah
   *  atau dihapus, dan penanda yang tidak ikut berubah membuat saringan
   *  "Belum Foto" berbohong tentang pekerjaan yang baru saja selesai. */
  const segarkanFoto = async () => {
    let baru;
    try { baru = await fotoLembarPos(pos.nomor); }
    catch { return; }   // pos sering kehilangan sinyal; penanda lama dibiarkan
    if (location.hash !== layarIni) return;
    fotoPos = baru;
    fotoPunya.clear();
    baru.forEach(f => {
      const dada = Number(f.nomor_dada);
      if (!fotoPunya.has(dada)) fotoPunya.set(dada, new Set());
      fotoPunya.get(dada).add(f.kode_lomba);
    });
    [...tbody.children].forEach(tr => {
      tr.dataset.fotoKurang = tandaFoto({
        nomor_dada: tr.dataset.dada, golongan: tr.dataset.golongan,
      });
    });
    terapkanSaringan();
  };

  tbody.addEventListener("click", (e) => {
    const b = e.target.closest("[data-foto]");
    if (b) bukaFoto(b.closest("tr")).then(segarkanFoto);
  });

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
      // Centangnya SEKALIGUS pintu riwayat. Bukan tombol tambahan di kolom
      // terpisah: lembar ini sudah selebar layar dua kali, dan satu kolom lagi
      // dibayar setiap baris walau riwayatnya hampir tidak pernah ditanya.
      //
      // Yang ditanyakan orang saat menatap centang hijau memang persis ini —
      // "angka ini sudah masuk, tapi siapa yang menaruhnya, dan apakah ia
      // mengganti angka lain?" Jadi jawabannya ditaruh di tempat pertanyaannya
      // muncul.
      sel.replaceChildren(h(`<button class="badge badge-green badge-tombol"
        type="button" data-riwayat title="Sudah masuk database">✓</button>`));
      sel.querySelector("[data-riwayat]")
         .addEventListener("click", () => bukaRiwayat(tr));
    } else if (keadaan === "gagal") {
      sel.replaceChildren(h(html`<button class="button button-danger button-mini"
        type="button" data-ulang title="${pesan}">Ulangi</button>`));
      sel.querySelector("[data-ulang]").addEventListener("click", () => simpanBaris(tr, true));
    } else {
      sel.replaceChildren();
    }
    perbaruiRingkasan();
  };

  /** Gembok satu baris: rupanya, dan apa yang ikut mati bersamanya.
   *
   *  Terbuka adalah keadaan bawaan — semua baris bisa diisi sampai ada yang
   *  menyatakan selesai. Sesudah dikunci, kotaknya benar-benar dimatikan, bukan
   *  sekadar dipudarkan: kotak yang masih bisa diketik tapi selalu ditolak
   *  adalah jebakan, dan penolakannya baru muncul sesudah petugas mengetik
   *  angka yang ia kira tersimpan.
   *
   *  Yang menegakkan aturannya tetap server (0044). Ini supaya petugas tahu
   *  SEBELUM mengetik, bukan sesudah ditolak. */
  const gambarGembok = (tr) => {
    const kunci = tr.dataset.terkunci === "1";
    tr.classList.toggle("baris-terkunci", kunci);
    tr.querySelectorAll("input").forEach(el => { el.disabled = kunci; });

    const sel = tr.querySelector(".pos-gembok");
    sel.replaceChildren(h(`<button type="button" class="gembok"
      data-gembok aria-pressed="${kunci}"
      title="${kunci ? "Terkunci — buka gembok (admin)"
                     : "Kunci nilai"}">${
      ikon(kunci ? "lock" : "lock-open")}</button>`));
    sel.querySelector("[data-gembok]").addEventListener("click", () => ubahGembok(tr));
  };

  /** Mengunci, atau meminta admin membukanya. */
  async function ubahGembok(tr) {
    const dada = Number(tr.dataset.dada);
    const kunci = tr.dataset.terkunci === "1";
    const tiga = dada3(dada);

    // MENGUNCI tidak bertanya. Petugas menekan gembok ratusan kali dalam satu
    // shift, dan setiap kali harus menjawab "yakin?" untuk perbuatan yang bisa
    // ia batalkan sendiri (0045) — ongkos itu dibayar di tiap baris, sementara
    // yang dicegahnya cuma satu ketukan nyasar yang tinggal diketuk lagi.
    //
    // MEMBUKA bertanya, dan itu bukan sekadar konfirmasi: alasannya wajib, dan
    // alasan itulah satu-satunya penjelasan yang tersisa kalau nilainya
    // berubah sesudah gemboknya terbuka. Yang mahal memang arah itu, bukan
    // arah sebaliknya.
    if (!kunci) {
      // Gembok hanya boleh mengesahkan angka yang SUDAH dibaca kembali dari
      // database. Tanpa pagar ini request kunci bisa mendahului request simpan,
      // lalu server menolak simpanan itu karena baris telanjur terkunci.
      if (tr.dataset.keadaan !== "tersimpan"
          || Number(tr.dataset.terisi) === 0) {
        notif(`Nilai ${tiga} belum tersimpan. Tunggu tanda ✓, lalu kunci.`, true);
        return;
      }
      try { await kunciNilaiPos(dada, pos.nomor); }
      catch (err) { notif(`Gagal mengunci: ${err.message}`, true); return; }
      tr.dataset.terkunci = "1";
      gambarGembok(tr);
      notif(`Nilai ${tiga} dikunci.`);
      return;
    }

    // Tanpa kalimat penjelas. Kotak alasan yang wajib diisi sudah mengatakan
    // seluruhnya — bahwa alasannya dicatat adalah hal yang petugas pelajari
    // sekali, sedangkan kalimatnya dibaca ulang setiap kali gembok dibuka.
    const jawab = await dialog({
      judul: `Buka Gembok No. Dada ${tiga}?`,
      medan: [{ label: "Alasan membuka", contoh: "misal: nilai semaphore salah ketik" }],
      labelAksi: "Buka",
    });
    if (!jawab) return;
    try { await bukaKunciNilaiPos(dada, pos.nomor, jawab[0]); }
    catch (err) { notif(`Gagal membuka: ${err.message}`, true); return; }
    tr.dataset.terkunci = "";
    gambarGembok(tr);
    notif(`Gembok ${tiga} dibuka.`);
  }

  /** Riwayat perubahan nilai satu regu di pos ini.
   *
   *  Dibaca saat DIKETUK, bukan ikut dimuat bersama lembarnya: lembar pos
   *  memuat ratusan baris dan hampir semuanya tidak pernah ditanya riwayatnya.
   *
   *  Yang ditampilkan sengaja apa adanya — angka lama, angka baru, siapa,
   *  kapan — tanpa menyimpulkan mana yang "mencurigakan". Yang tahu apakah
   *  suatu perubahan wajar adalah orang yang berdiri di pos itu, bukan layar. */
  async function bukaRiwayat(tr) {
    const dada = Number(tr.dataset.dada);
    const nama = tr.children[1].textContent.trim();
    let baris;
    try {
      baris = await riwayatNilai(pos.nomor, dada);
    } catch (err) {
      notif(`Riwayat tidak bisa dibaca: ${err.message}`, true);
      return;
    }

    /* Sengaja RINGKAS: satu baris per perubahan, tanpa kepala tabel.
       Yang dicari orang saat membukanya cuma tiga hal — lomba apa, dari berapa
       jadi berapa, dan siapa. Kepala tabel dan kalimat penjelas menambah teks
       yang harus dilewati mata sebelum sampai ke jawabannya. */
    if (!baris.length) {
      await dialog({
        judul: `${dada3(dada)} · ${nama}`,
        kartuHtml: `<p class="description">Belum pernah diubah.</p>`,
        labelAksi: "Tutup", bacaSaja: true,
      });
      return;
    }

    /* SARINGAN PER LOMBA, dan hanya muncul kalau memang ada yang disaring.
       Satu regu di Pos 3 bisa punya tujuh lomba dan puluhan perubahan; yang
       ditanyakan biasanya satu — "Bidai-nya kenapa berubah dua kali?".
       Menyaringnya di sini lebih cepat daripada menyusuri daftar.

       Di pos berlomba satu, chip-nya cuma akan berbunyi "Semua" dan nama lomba
       itu sendiri — dua tombol yang tidak menyaring apa pun. Jadi ia tidak
       digambar sama sekali. */
    /* Chip diurutkan seperti URUTAN PENILAIAN, bukan seperti urutan perubahan.
       Daftar riwayat di bawahnya urut waktu-terbaru-dulu, dan chip yang ikut
       urutan itu berpindah tempat setiap kali ada nilai baru masuk — tombol
       yang berpindah antar kunjungan harus dibaca ulang tiap kali.
       kolom[] datang dari kolomPos() yang sudah urut sort_order, jadi
       chip-nya berbaris sama dengan kolom di lembar: Semaphore, Tebak Simpul,
       Menaksir. Lomba yang tidak dikenali kolom (mis. komponen yang sudah
       dihapus admin tapi masih punya riwayat) jatuh ke belakang. */
    const urutLomba = new Map(kolom.map((k, i) => [k.nama, i]));
    const lomba = [...new Map(baris.map(b => [b.kode_lomba, b.nama_lomba]))]
      .sort((a, b) => (urutLomba.get(a[1]) ?? 1e9) - (urutLomba.get(b[1]) ?? 1e9));
    const chip = lomba.length < 2 ? "" : `
      <div class="option-row saring-riwayat">
        <button type="button" class="option option-small" data-lomba=""
                aria-pressed="true">Semua</button>
        ${lomba.map(([kode, nama]) => html`
          <button type="button" class="option option-small" data-lomba="${kode}"
                  aria-pressed="false">${nama}</button>`).join("")}
      </div>`;

    /* Angkanya ditulis PERSIS seperti kotak isiannya menulisnya — "8.55",
       bukan 855; "00:47", bukan 47. Yang membuka riwayat sedang membandingkan
       dengan kotak yang ada di depannya, dan dua bentuk untuk satu angka
       membuat perbandingan itu harus diterjemahkan dulu. Komponen yang sudah
       dihapus admin tidak ada di `komponen` lagi; nilaiTeks menuliskannya
       polos, dan itu tetap lebih baik daripada barisnya hilang. */
    const metaKode = new Map(komponen.map(k => [k.kode, k]));
    const isi = chip + `<ul class="riwayat">${baris.map(b => {
      const k = metaKode.get(b.kode_lomba);
      return html`
      <li data-lomba="${b.kode_lomba}">
        <span class="r-lomba">${b.nama_lomba}</span>
        <span class="r-nilai">${b.nilai_lama === null ? "—" : nilaiTeks(k, b.nilai_lama)}
          → <strong>${b.nilai_baru === null ? "hapus" : nilaiTeks(k, b.nilai_baru)}</strong></span>
        <span class="r-oleh">${b.oleh} · ${tanggalJam(b.changed_at)}</span>
      </li>`;
    }).join("")}</ul>`;

    // dialog() menempelkan kartunya ke DOM secara SINKRON sebelum janjinya
    // menunggu, jadi penyaringnya boleh dipasang sebelum di-await. Menunggu
    // dulu berarti menunggu sampai dialognya ditutup.
    const janji = dialog({
      judul: `${dada3(dada)} · ${nama}`,
      kartuHtml: isi,
      labelAksi: "Tutup",
      bacaSaja: true,
    });

    const kartu = document.querySelector(".dialog .saring-riwayat");
    if (kartu) {
      kartu.addEventListener("click", (e) => {
        const b = e.target.closest("[data-lomba]");
        if (!b) return;
        const pilih = b.dataset.lomba;
        kartu.querySelectorAll("[data-lomba]").forEach(x =>
          x.setAttribute("aria-pressed", String(x.dataset.lomba === pilih)));
        document.querySelectorAll(".dialog .riwayat li").forEach(li => {
          li.hidden = !!pilih && li.dataset.lomba !== pilih;
        });
      });
    }

    await janji;
  }

  /** Foto slip penilaian satu regu — satu foto per lomba (migrasi 0047).
   *
   *  Kertas berpindah tangan dari pos ke kotak ke meja IT, dan begitu hilang
   *  tidak ada apa pun yang bisa memulihkan angkanya. Difoto di sini, di meja
   *  IT, karena di sinilah fotonya tertaut sendiri ke nomor dada dan lomba
   *  yang tepat — petugas baru saja mengetiknya.
   *
   *  Gembok TIDAK mematikan tombol ini. Mengunci berarti angkanya final;
   *  fotonya justru bukti untuk angka final itu, dan menolak bukti setelah
   *  putusan adalah urutan yang terbalik. */
  async function bukaFoto(tr) {
    const dada = Number(tr.dataset.dada);
    const namaRegu = tr.children[1].textContent.trim();
    const tiga = dada3(dada);

    let sudah = [];
    try {
      sudah = await daftarFotoLembar(pos.nomor, dada);
    } catch (err) {
      notif(`Daftar foto tidak bisa dibaca: ${err.message}`, true);
    }

    /* SELURUH barisnya disimpan per lomba, bukan cuma yang terbaru.
       Dulu hanya path pertama yang dipegang, jadi "Lihat" pada baris berbunyi
       "9 foto" tetap membuka SATU gambar — dan yang delapan lagi tidak punya
       satu pun jalan untuk dilihat. Angkanya benar, tombolnya yang berbohong.

       Urutannya sudah terbaru dulu (order diunggah_pada.desc di api.js), dan
       itu urutan yang benar: slip yang baru difoto adalah yang sedang
       dipertanyakan orang. */
    const hitung = {};
    const perLomba = {};
    sudah.forEach(f => {
      hitung[f.kode_lomba] = (hitung[f.kode_lomba] || 0) + 1;
      (perLomba[f.kode_lomba] ||= []).push(f);
    });

    /* Daftarnya per LOMBA, bukan per penilaian. Satu slip adalah satu lomba
       (bagian 11.5): Pembidaian punya lima kriteria di SATU kertas, dan
       menawarkan lima baris foto di sini berarti satu kertas yang sama bisa
       mendarat di lima kode berbeda.

       Ini juga yang membuat dua pintu bertemu. Layar Foto Jawaban menulis
       `kode_lomba` dari kelompokLomba() dan RPC `catat_foto_masuk` menolak
       kode yang bukan lomba pos itu (migrasi 0074). Selama dialog ini masih
       memakai slug PENILAIAN, foto yang diunggah borongan tidak akan pernah
       muncul di sini — dan justru dialog inilah yang dipakai memeriksa hasil
       penautan. */
    const lomba = kelompokLomba(kolom).map(l => [l.kode, l.nama]);

    /* Template BIASA, bukan tag html`` — sama alasannya dengan notif(): tag
       html`` meng-escape SETIAP sisipan, dan ikon("camera") adalah HTML yang
       memang harus dirender. Ditulis dengan html``, jalur SVG-nya tampil apa
       adanya sebagai teks hijau sepanjang tiga baris di dalam tombolnya.
       Yang datang dari luar tetap lewat esc() satu per satu. */
    const isi = `<ul class="foto-lomba">${lomba.map(([kode, nama]) => `
      <li data-kode="${esc(kode)}" data-nama="${esc(nama)}">
        <span class="f-nama">${esc(nama)}</span>
        <span class="f-jumlah" data-jumlah>${hitung[kode]
          ? `${esc(String(hitung[kode]))} foto` : "belum ada"}</span>
        <button type="button" class="button button-mini" data-lihat
          ${hitung[kode] ? "" : "hidden"}>Lihat</button>
        <label class="button button-mini button-primary">
          <input type="file" accept="image/*" multiple hidden data-ambil>${ikon("camera")} Foto
        </label>
      </li>`).join("")}</ul>
`;

    // Sama seperti bukaRiwayat: dialog() menempelkan kartunya secara SINKRON,
    // jadi pendengarnya boleh dipasang sebelum janjinya ditunggu.
    const janji = dialog({
      judul: `Foto Jawaban · ${tiga} · ${namaRegu}`,
      kartuHtml: isi,
      labelAksi: "Tutup",
      bacaSaja: true,
    });

    const kartu = document.querySelector(".dialog .foto-lomba");
    if (kartu) {
      kartu.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-lihat]");
        if (!b) return;
        const li = b.closest("li");
        const kode = li.dataset.kode, namaLomba = li.dataset.nama;
        if (!(perLomba[kode] || []).length) return;

        b.disabled = true;
        let daftar = [], peta = {};
        try {
          /* DIBACA ULANG dari server, bukan dari daftar yang dipegang layar.
             Dua sebabnya, dan keduanya soal `id`: baris yang baru diunggah di
             dialog ini belum punya id (catat_foto_lembar mengembalikan void),
             dan tombol silang butuh id. Sekalian daftarnya jadi mutakhir —
             foto yang dihapus petugas lain tidak muncul sebagai petak yang
             hilang begitu ditekan. */
          const semua = await daftarFotoLembar(pos.nomor, dada);
          daftar = semua.filter(f => f.kode_lomba === kode);
          perLomba[kode] = daftar;
          hitung[kode] = daftar.length;
          const jml = li.querySelector("[data-jumlah]");
          if (jml) jml.textContent = hitung[kode] ? `${hitung[kode]} foto` : "belum ada";
          if (!daftar.length) { b.hidden = true; b.disabled = false; return; }
          peta = await tautanFotoBanyak(daftar.map(f => f.path));
        } catch (err) {
          b.disabled = false;
          notif(`Foto tidak bisa dibuka: ${err.message}`, true);
          return;
        }
        b.disabled = false;

        /* Gambarnya dipasang langsung, tidak dibuka di tab baru satu per satu.
           Sembilan tab adalah sembilan kali menekan "kembali" di HP, dan
           urutannya hilang di antaranya.

           Tautan penuhnya TETAP ada di tiap gambar, dan karena seluruh tanda
           tangan sudah di tangan sebelum dialog ini digambar, membukanya tidak
           perlu await — jadi tidak ada window.open() sesudah await yang akan
           diblokir browser HP sebagai popup. */
        /* THUMBNAIL, bukan gambar penuh. Sembilan slip ukuran penuh adalah
           sembilan layar yang harus digulir sebelum yang dicari terlihat;
           petak kecil memperlihatkan kesembilannya sekaligus, dan yang perlu
           dibaca angkanya tinggal ditekan. */
        const petak = (f, i) => {
          const url = peta[f.path];
          const ke = daftar.length - i;            // terbaru dulu, jadi dihitung mundur
          const kapan = f.diunggah_pada ? tanggalJam(f.diunggah_pada) : "";
          const judul = `Foto ${ke} ${namaLomba}${kapan ? ` · ${kapan}` : ""}`;
          return `<li data-id="${esc(f.id)}" data-ke="${esc(String(ke))}">
            ${url
              ? `<a class="fg-petak" href="${esc(url)}" target="_blank" rel="noopener"
                    title="${esc(judul)}">
                   <img src="${esc(url)}" alt="${esc(judul)}" loading="lazy"></a>`
              : `<span class="fg-petak fg-kosong">tautan gagal</span>`}
            <button type="button" class="fg-hapus" data-hapus
                    title="Hapus foto ${esc(String(ke))}"
                    aria-label="Hapus foto ${esc(String(ke))} ${esc(namaLomba)}"
              >&times;</button>
            <span class="fg-kapan">${esc(kapan)}</span>
          </li>`;
        };
        const galeri = daftar.map(petak).join("");

        const janjiGaleri = dialog({
          judul: `${namaLomba} · ${daftar.length} foto`,
          kartuHtml: `<ul class="foto-galeri">${galeri}</ul>`,
          bacaSaja: true,
          silangSaja: true,
          pasang: (el, tutup) => {
            const ul = el.querySelector(".foto-galeri");
            const judulEl = el.querySelector("h2");
            ul.addEventListener("click", async (ev) => {
              const x = ev.target.closest("[data-hapus]");
              if (!x) return;
              const petakLi = x.closest("li");
              const id = petakLi.dataset.id;

              /* ALASANNYA WAJIB, dan itu bukan formalitas: foto slip adalah
                 bukti, dipanggil justru ketika sebuah nilai dipertanyakan.
                 Menghapusnya menghapus kemampuan menjawab pertanyaan itu, dan
                 tidak ada satu pun galat yang muncul saat bukti hilang. RPC
                 0081 menolak alasan kosong; kotak ini cuma menanyakannya
                 sebelum perjalanan jaringan. */
              const jawab = await dialog({
                judul: `Hapus foto ${petakLi.dataset.ke} ${namaLomba}?`,
                kartuHtml: "<p>Fotonya hilang dari daftar dan dari penyimpanan.</p>",
                medan: [{ label: "Alasan menghapus", contoh: "misal: buram, difoto ulang" }],
                labelAksi: "Hapus Foto",
              });
              if (jawab === null) return;

              x.disabled = true;
              try {
                await hapusFotoLembar(id, jawab[0]);
              } catch (err) {
                x.disabled = false;
                notif(`Foto tidak bisa dihapus: ${err.message}`, true);
                return;
              }

              // Daftar di belakang dialog ini ikut disesuaikan, supaya
              // hitungannya tidak menyebut foto yang sudah tidak ada.
              perLomba[kode] = (perLomba[kode] || []).filter(f => f.id !== id);
              hitung[kode] = perLomba[kode].length;
              const barisAsal = kartu.querySelector(`li[data-kode="${CSS.escape(kode)}"]`);
              if (barisAsal) {
                const jml = barisAsal.querySelector("[data-jumlah]");
                if (jml) jml.textContent = hitung[kode] ? `${hitung[kode]} foto` : "belum ada";
                const lihat = barisAsal.querySelector("[data-lihat]");
                if (lihat) lihat.hidden = !hitung[kode];
              }

              petakLi.remove();
              /* Judulnya ikut turun. "9 foto" yang bertahan di atas galeri
                 berisi lima petak terbaca sebagai empat petak yang gagal
                 digambar — dan orang yang baru saja menghapus bukti akan
                 menghapus lagi untuk mengejar angka yang tidak akan bergerak. */
              if (judulEl) {
                judulEl.textContent = `${namaLomba} · ${ul.children.length} foto`;
              }
              notif("Foto dihapus.");
              if (!ul.children.length) tutup(null);
            });
          },
        });
        await janjiGaleri;
      });

      kartu.addEventListener("change", async (e) => {
        const inp = e.target.closest("[data-ambil]");
        if (!inp || !inp.files || !inp.files.length) return;
        const li = inp.closest("li");
        const kode = li.dataset.kode;
        const status = li.querySelector("[data-jumlah]");
        const berkas = [...inp.files];
        // Dikosongkan supaya memilih BERKAS YANG SAMA lagi tetap memicu change
        // — persis yang dilakukan orang setelah unggahan pertama gagal.
        inp.value = "";

        for (const f of berkas) {
          let blob;
          try {
            status.textContent = "mengecilkan…";
            blob = await kecilkanFoto(f);
          } catch (err) {
            status.textContent = err.message;
            continue;
          }
          try {
            status.textContent = `mengirim ${ukuranRapi(blob.size)}…`;
            const hasil = await unggahFotoLembar(
              pos.nomor, kode, li.dataset.nama, dada, blob);
            hitung[kode] = (hitung[kode] || 0) + 1;
            // Disisipkan DI DEPAN: daftarnya terbaru dulu, dan yang barusan
            // difoto adalah yang paling baru. Tanpa ini "Lihat" sesudah
            // mengunggah tidak memperlihatkan foto yang baru saja dikirim.
            (perLomba[kode] ||= []).unshift(
              { path: hasil.path, diunggah_pada: new Date().toISOString() });
            status.textContent = `${hitung[kode]} foto · ${ukuranRapi(blob.size)}`;
            const lihat = li.querySelector("[data-lihat]");
            if (lihat) lihat.hidden = false;
          } catch (err) {
            // Blob-nya sudah tidak dipegang, tapi berkas aslinya masih di
            // galeri HP — dan itulah antreannya. Petugas memilih ulang berkas
            // yang sama, dan input di atas sengaja sudah dikosongkan supaya
            // pilihan itu terbaca.
            status.textContent = `gagal — ${err.message}`;
            notif(`Foto ${tiga} ${li.dataset.nama} gagal terkirim: ${err.message}`, true);
          }
        }
      });
    }

    await janji;
  }

  /** "Nomor Dada 007." lalu pesannya, DUA BARIS.
   *
   *  Notifikasi ini muncul di bawah layar, terlepas dari baris yang gagal —
   *  angka telanjang di depan kalimat tidak memberi tahu angka APA, dan di
   *  lembar yang penuh angka itu justru yang paling perlu disebut namanya.
   *
   *  Dipatahkan, bukan digandeng dengan titik dua. Keduanya menjawab
   *  pertanyaan yang berbeda — baris MANA, lalu kotak mana di baris itu — dan
   *  sebagai satu kalimat panjang bagian pertamanya terbaca seperti awalan
   *  yang boleh dilewati. Yang mematahkannya `white-space: pre-line` di
   *  .notif-teks; tanpa aturan itu ganti barisnya cuma jadi spasi.  */
  const pesanBaris = (dada, pesan) =>
    `Nomor Dada ${dada3(dada)}.\n${kapital(pesan)}`;

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
  // Setiap request penyegaran dan setiap simpanan yang terkonfirmasi memajukan
  // versi ini. Respons hanya boleh menulis DOM bila versinya masih terbaru.
  let versiLembar = 0;

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
      pita.removeAttribute("title");
      pita.textContent = putus
        ? `Internet putus — ${belum + gagal} baris belum tersimpan. Jangan tutup halaman ini. ${cap}.`
        // Kedua-duanya disebut. Pita yang hanya menghitung baris GAGAL sempat
        // menulis "1 baris" padahal ada dua yang belum aman di layar —
        // angka yang tidak lengkap justru menghapus gunanya sebagai jaminan.
        : `${gagal} baris gagal terkirim${belum ? ` dan ${belum} baris masih diketik` : ""}`
          + ` — jangan tutup halaman ini. ${cap}.`;
      if (gagal) jadwalkanUlang();
      return;
    }
    /* MENUNGGU diringkas seperti AMAN — ikon + jam, cuma warnanya kuning.
       Bentuknya sengaja SAMA PERSIS supaya lebarnya tidak bergerak: pitanya
       duduk di `.baris-pos` yang membungkus, jadi kalimat "1 baris belum
       tersimpan. Sinkronisasi Terakhir: 23:38 (barusan)" melebarkannya sampai
       tombol di sebelahnya terlempar ke baris berikutnya — dan seluruh tabel
       ikut turun, tepat saat petugas sedang mengetik di dalamnya. Layar yang
       bergeser sendiri di bawah jari lebih mahal daripada kalimat yang
       dijelaskannya.

       Kalimatnya tidak hilang tanpa ganti: baris yang bersangkutan SUDAH
       menyandang penanda "belum" di kolom statusnya sendiri, jadi jumlahnya
       terbaca dari tabel — pita ini cuma mengulanginya (bagian 9.3).

       MERAH TETAP PANJANG, dan itu bukan ketidakkonsistenan. Hanya ia yang
       berarti "ada nilai yang bisa hilang": ia menuntut tindakan, menyebut
       berapa baris yang terancam, dan melarang menutup halaman (bagian 9.4).
       Pergeseran layar sepadan untuk yang satu itu. */
    if (sibuk || belum) {
      pita.className = "pos-simpan menunggu ringkas";
      pita.title = sibuk ? `Menyimpan… ${cap}` : `${belum} baris belum tersimpan. ${cap}`;
      pita.innerHTML = `${ikon("circle-alert")}<span>${esc(jamMenit(jamSinkron))}</span>`;
      return;
    }
    /* Keadaan AMAN: ikon + jam. Ia tidak menuntut apa pun — satu-satunya fakta
       yang tidak bisa dibaca dari layar adalah KAPAN, dan itulah yang tersisa.

       "Data Tersimpan" mengulang apa yang sudah dikatakan warna hijau dan
       centangnya, dan pita ini dibaca ratusan kali per shift (bagian 9.1). */
    pita.className = "pos-simpan aman ringkas";
    pita.title = cap;
    pita.innerHTML = `${ikon("circle-check-big")}<span>${esc(jamMenit(jamSinkron))}</span>`;
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
  // Keduanya dilepas saat layar ini ditinggalkan — termasuk saat dropdown
  // pemilih pos memanggil layar ini lagi, yang tidak lewat arahkan().
  const sinyalLayar = sinyalLayarBaru();
  window.addEventListener("online", ulangYangGagal, { signal: sinyalLayar });
  window.addEventListener("offline", perbaruiRingkasan, { signal: sinyalLayar });

  // Baris yang sudah berisi nilai memang berasal dari database — ✓-nya
  // benar sejak halaman dibuka, bukan hanya untuk yang diketik hari ini.
  [...tbody.children].forEach(tr => {
    if (Number(tr.dataset.terisi) > 0) statusBaris(tr, "tersimpan");
    gambarGembok(tr);
  });
  perbaruiRingkasan();

  async function simpanBaris(tr, beriTahu = false) {
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
    // Baris tergembok tidak pernah dikirim. Kotaknya memang sudah mati, tapi
    // simpanBaris juga dipanggil dari antrean dan dari tombol Ulangi. Tombol
    // itu harus menjelaskan jalan keluarnya; putaran otomatis tetap diam agar
    // tidak menyemburkan notifikasi setiap 15 detik.
    if (tr.dataset.terkunci === "1") {
      const pesan = "Nilai sudah digembok. Buka gembok sebelum mengirim ulang.";
      statusBaris(tr, "gagal", pesan);
      if (beriTahu) notif(pesanBaris(dada, pesan), true);
      return;
    }
    const lama = asli.get(dada) || {};
    const baris = [], dihapus = [], takTerbaca = [];

    for (const k of komponenBaris(tr)) {
      const baru = bacaSel(tr, k);
      const ada = lama[k.kode] || null;
      // Kotak berisi sesuatu yang tidak terbaca: JANGAN disentuh sama sekali.
      // Bukan dikirim, dan bukan pula dianggap kosong — angka lamanya tetap di
      // tempatnya sampai petugas membetulkan ketikannya.
      if (baru === TIDAK_SAH) { takTerbaca.push(k.name); continue; }
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
    // Ada kotak yang tidak terbaca: barisnya berakhir MERAH, bukan hijau.
    //
    // Yang sah tetap dikirim — memaksa petugas mengetik ulang kotak yang sudah
    // benar karena satu kotak lain salah adalah hukuman yang tidak perlu. Tapi
    // barisnya tidak boleh terlihat selesai selama masih ada yang salah, dan
    // merahnya juga yang menahan penyegaran 20 detik agar tidak menghapus
    // ketikan yang sedang dibetulkan (baris "gagal" termasuk sibuk).
    const pesanTakTerbaca = takTerbaca.length
      ? `${takTerbaca.join(", ")}: isinya bukan angka/waktu yang bisa dibaca. `
        + `Angka lamanya TIDAK diubah.`
      : null;

    if (pesanTakTerbaca && !baris.length && !dihapus.length) {
      statusBaris(tr, "gagal", pesanTakTerbaca);
      notif(pesanBaris(dada, pesanTakTerbaca), true);
      return;
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
      // Membatalkan snapshot lembar penuh yang mulai diambil sebelum simpanan
      // ini selesai. Tanpa ini respons lama bisa menimpa angka yang baru saja
      // dikonfirmasi dari database.
      versiLembar += 1;
      if (segar) {
        asli.set(dada, segar.nilai || {});
        tr.querySelector(".pos-nilai").textContent = angkaRapi(segar.nilai_pos);
        tr.dataset.terisi = String(segar.jumlah_terisi);
      }
      // Cap waktunya dipasang DI SINI, bukan saat permintaan dikirim: yang
      // dijanjikan cap itu adalah "sudah ada di database", dan yang
      // membuktikannya adalah baris yang barusan dibaca kembali dari sana.
      jamSinkron = new Date();
      if (pesanTakTerbaca) {
        statusBaris(tr, "gagal", pesanTakTerbaca);
        notif(pesanBaris(dada, pesanTakTerbaca), true);
      } else {
        statusBaris(tr, Number(tr.dataset.terisi) > 0 ? "tersimpan" : "");
      }
      hitungUlangJumlah();
    } catch (err) {
      statusBaris(tr, "gagal", err.message);
      notif(pesanBaris(dada, err.message), true);
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

  // Mengetik ulang angka yang sama memicu `input`, tetapi browser tidak
  // selalu memicu `change`: nilai ketika fokus masuk dan keluar tetap sama.
  // Selesaikan penanda kuning saat kotaknya ditinggalkan. Pagar `belum`
  // mencegah focusout mengantrekan simpanan kedua ketika `change` sudah lebih
  // dulu menjalankan simpanBaris().
  tbody.addEventListener("focusout", (e) => {
    const tr = e.target.closest("tr");
    if (tr?.dataset.keadaan === "belum") simpanBaris(tr);
  });

  /* ISI KOTAK DIPILIH SAAT DIKETUK, jadi ketukan pertama MENGGANTI.

     Kotak nilai tidak pernah dimaksudkan untuk DITAMBAHI — tidak ada juri yang
     bermaksud "sambung angka ini ke angka yang sudah ada". Tanpa seleksi,
     mengetuk kotak berisi 1 lalu menekan 8 menghasilkan 18, dan di situlah
     bahayanya: untuk Bidai yang rentangnya 0-20, 18 adalah angka SAH. Server
     menerimanya, tidak ada yang memerah, dan yang tersimpan bukan yang
     dimaksud siapa pun.

     Di Semaphore (0-5) kesalahan yang sama tertolak dan terlihat. Justru itu
     yang membuatnya berbahaya di tempat lain: ia hanya senyap di kolom yang
     rentangnya cukup lebar untuk menampung angka gabungan.

     Hanya saat DIKETUK. Mengetik beruntun di kotak yang sedang dipegang tidak
     terganggu — "12" untuk Menaksir tetap 12, karena seleksi cuma terjadi
     sekali saat fokus masuk, bukan tiap ketukan.

     Lewat setTimeout dengan alasan yang sama dengan kotak jam: Safari iOS
     membatalkan select() yang dipanggil di dalam penanganan focus itu sendiri. */
  tbody.addEventListener("focusin", (e) => {
    const el = e.target;
    if (el.tagName !== "INPUT" || el.type === "checkbox" || !el.value) return;
    setTimeout(() => {
      if (document.activeElement === el) { try { el.select(); } catch { /* abaikan */ } }
    }, 0);
  });

  /* Kotak waktu: dirapikan dan diperiksa saat DITINGGALKAN.

     Satu kotak yang menerima "32" maupun "1:10" punya satu kelemahan yang
     tidak dimiliki dua kotak angka: isinya bisa BUKAN waktu. "1:75" terbaca
     wajar oleh mata, tapi bukan waktu mana pun, dan bacaSel() menolaknya
     dengan mengembalikan null — yang di jalur simpan berarti "kotak kosong",
     alias tidak dikirim.

     Tanpa penanda, itu jenis kegagalan yang paling buruk: petugas mengetik
     angka, tidak ada yang merah, tidak ada yang gagal, dan nilainya tidak
     pernah ada. Jadi kotaknya diberi aria-invalid, yang sudah punya gaya merah
     sendiri di style.css dan sekaligus terbaca pembaca layar.

     Dirapikan saat blur, bukan tiap ketukan: menata angka sementara orang
     masih mengetiknya memindahkan kursor di bawah jarinya. Pola dan alasannya
     sama dengan pasangKotakJam() di util.js. */
  tbody.addEventListener("focusout", (e) => {
    const el = e.target;
    if (!el.classList || !el.classList.contains("input-waktu")) return;
    const kosong = !el.value.trim();
    const detik = detikSah(el.value);
    if (kosong) el.removeAttribute("aria-invalid");
    else if (detik === null) el.setAttribute("aria-invalid", "true");
    else {
      // "32" jadi "00:32", "95" jadi "01:35" — bentuk yang sama dengan yang
      // digambar ulang dari database, supaya menyimpan baris yang tidak
      // disentuh tidak pernah terlihat sebagai perubahan.
      el.value = detikTeks(detik);
      el.removeAttribute("aria-invalid");
    }
  });

  // Merah hilang begitu isinya jadi waktu yang sah — menunggu blur untuk
  // memadamkan peringatan membuat petugas mengira ketikan barunya juga salah.
  tbody.addEventListener("input", (e) => {
    const el = e.target;
    if (!el.classList || !el.classList.contains("input-waktu")) return;
    if (detikSah(el.value) !== null || !el.value.trim()) {
      el.removeAttribute("aria-invalid");
    }
  });

  // Enter = turun satu regu di kolom yang sama, seperti menyalin dari kertas
  // ke bawah. Berpindah fokus memicu change-nya sendiri, jadi barisnya
  // tersimpan tanpa perlu dipanggil dua kali.
  tbody.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" || e.target.tagName !== "INPUT") return;
    e.preventDefault();
    const tr = e.target.closest("tr");
    const tujuan = kotakBerikutnyaDalamKolom(tr, e.target);
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

  // Pembanding wajib jumlah komponen BARIS ITU, bukan jumlah kolom tabel.
  // Regu Penggalang di Pos 1 punya tiga komponen sementara tabelnya berkolom
  // enam — dibandingkan dengan enam, tidak ada satu pun regu yang pernah
  // "lengkap", dan saringan "Belum lengkap" ikut menampilkan semuanya.
  const lengkap = (tr) =>
    Number(tr.dataset.terisi) >= Number(tr.dataset.komponen);

  function hitungUlangJumlah() {
    const baris = [...tbody.children];
    const tampil = baris.filter(tr => !tr.hidden).length;
    // SATU pecahan. "47/53 lengkap" dibuang karena chip di sebelahnya sudah
    // menjawabnya: dengan saringan "Belum lengkap" menyala, yang ditampilkan
    // ITULAH yang belum lengkap — 6/53 dan 47/53 adalah angka yang sama
    // dibaca dari dua arah. Dua pecahan bersebelahan justru menuntut orang
    // memeriksa mana yang mana sebelum bisa membacanya.
    document.getElementById("tabel-jumlah").textContent =
      `${tampil}/${baris.length} ditampilkan`;
  }

  /* ---------- cetak lembar kosong ---------- */

  // Form Tabel mencetak baris yang SEDANG TAMPIL, bukan selalu semuanya.
  // Dua kebutuhan berbeda terlayani satu tombol: sebelum lomba cetak "Semua"
  // untuk lembar kosong, dan di tengah lomba saring "Belum lengkap" dulu
  // supaya kertas susulan hanya memuat regu yang memang belum dinilai.
  //
  // Form per Lomba tidak membaca baris sama sekali. Ia adalah master kosong
  // yang bentuk dan jumlah halamannya ditentukan konfigurasi lomba di pos;
  // belum adanya satu pun regu tidak boleh menghalangi pencetakannya.
  /* TIDAK async, dan itu disengaja. `window.print()` di bawah harus tetap
     berada dalam giliran event tap — Safari iPhone memblokirnya kalau ada
     `await` lebih dulu, dan yang terlihat cuma tombol yang tidak melakukan
     apa-apa. Fungsi biasa membuat pelanggarannya jadi galat sintaks, bukan
     bug yang cuma muncul di iPhone orang lain. */
  const cetak = (slip) => {
    if (slip) {
      // Yang dicetak MASTER, bukan tumpukannya — jadi daftar ulang yang belum
      // ditutup tidak berpengaruh di sini, dan jumlah regu yang sedang tampil
      // pun tidak. Blangkonya kosong; berapa banyak yang dibutuhkan diputuskan
      // di mesin fotokopi, bukan di layar ini.
      const n = siapkanCetakBlangko(pos, kolom);
      // Nol berarti pos ini seluruhnya lomba soal — dijawab di lembar soalnya
      // sendiri, jadi tidak ada blangko yang perlu dicetak. Tanpa cabang ini
      // browser membuka dialog cetak untuk halaman kosong, dan yang menekan
      // tombolnya menyimpulkan bahwa pencetakannya rusak.
      if (!n) {
        notif("Pos ini seluruhnya lomba soal — dijawab di lembar soalnya "
              + "sendiri, jadi tidak ada blangko yang perlu dicetak.", true);
        return;
      }
      notif(`${n} master A5 melintang, satu per lomba.`);
      window.print();
      return;
    }

    const tampil = [...tbody.children].filter(tr => !tr.hidden)
      .map(tr => lembar.find(r => Number(r.nomor_dada) === Number(tr.dataset.dada)))
      .filter(Boolean);
    if (!tampil.length) { notif("Tidak ada baris yang bisa dicetak.", true); return; }

    /* NOMOR DADA BERURUTAN 001 SAMPAI BATAS STOK, TANPA LOMPATAN.

       Dua sebab, dan yang kedua yang menentukan.

       Tim IT menyortir tumpukan slip menurut nomor dada lalu menyusurinya dari
       atas. Lembar yang melompati satu nomor menghentikan pekerjaan itu:
       "slip 012 hilang, atau memang tidak pernah ada?" — pertanyaan yang tidak
       bisa dijawab dari kertas.

       Dan sebagian sekolah MENDAFTAR OFFLINE. Regunya memakai nomor dada fisik
       yang nyata, tetapi belum ada di database saat lembar ini dicetak. Kalau
       lembarnya hanya memuat regu yang sudah terdaftar, regu itu tidak punya
       baris sama sekali — dan nilainya ditulis di pinggir kertas, atau tidak
       ditulis. Barisnya karena itu dicetak kosong dan siap ditulisi.

       Batasnya diambil dari STOK nomor dada, bukan dari regu terdaftar: stok
       adalah nomor fisik yang benar-benar dibawa panitia, dan mana pun di
       antaranya bisa muncul di kotak penilaian.

       HANYA saat tidak ada saringan. Lembar susulan justru dicetak untuk
       sebagian regu — menyisipkan seluruh nomor kosong ke dalamnya
       mengembalikan tumpukan kertas yang tadi sengaja dipersempit. */
    let semua = tampil;
    if (!slip && rentangStok && [...tbody.children].every(tr => !tr.hidden)) {
      const peta = new Map(tampil.map(r => [Number(r.nomor_dada), r]));
      semua = nomorStok(rentangStok).map(
        n => peta.get(n) || { nomor_dada: n, kosong: true });
    }

    siapkanCetakLembarPos(pos, kolom, semua);
    window.print();
  };

  document.getElementById("cetak-lembar")
    .addEventListener("click", () => cetak(false));

  // Tombolnya ada di SEMUA pos, termasuk yang berlomba satu. Di Pos 4 dan
  // Pos 5 slipnya memang cuma satu per regu, tapi bentuknya tetap berbeda dari
  // tabel — dan alur kotak penilaian berlaku di sana juga.
  document.getElementById("cetak-per-lomba")
    .addEventListener("click", () => cetak(true));

  const terapkanSaringan = pasangAlatTabel((cari, saring) => {
    [...tbody.children].forEach(tr => {
      // `fotoKurang` kosong berarti BELUM DIKETAHUI, bukan lengkap: saringan
      // "Belum Foto" lalu tidak menuduh siapa pun, dan "Lengkap" berhenti
      // menilai fotonya alih-alih menyatakan lengkap tanpa dasar.
      const fotoKurang = tr.dataset.fotoKurang === "1";
      const fotoTahu = tr.dataset.fotoKurang !== "";
      const lolosSaring =
        saring === "semua" ? true
        : saring === "belum-input" ? !lengkap(tr)
        : saring === "belum-foto" ? fotoKurang
        : lengkap(tr) && !(fotoTahu && fotoKurang);
      tr.hidden = !(cocok(tr, cari) && lolosSaring);
    });
    hitungUlangJumlah();
  });

  pasangPilihPos(s);

  /* ==========================================================================
     LEMBAR INI MENYEGARKAN DIRINYA SENDIRI.

     Satu akun operator per pos, dipakai di HP mana pun yang ada di pos itu —
     jadi dua orang membuka lembar yang sama adalah kejadian biasa, bukan
     kasus ganjil. Sampai sekarang lembar ini hanya membaca ulang BARIS YANG
     IA SIMPAN SENDIRI; segala yang masuk dari HP sebelah tidak pernah muncul.

     Yang paling berbahaya bukan angkanya tidak terlihat, melainkan
     akibatnya saat menghapus. `asli` adalah cermin keadaan database, dan
     penghapusan dijalankan HANYA untuk komponen yang ada di cermin itu
     (`if (ada) dihapus.push(...)`). Nilai yang masuk dari HP lain setelah
     halaman ini dibuka tidak ada di cermin — jadi mengosongkan kotaknya tidak
     menghapus apa pun. Petugas melihat kotak kosong, menekan simpan, mendapat
     centang hijau, dan angka yang ia kira sudah dibuang masih di database.

     Menyegarkan lembar penuh angka yang sedang diketik jelas berisiko, jadi
     baris DILEWATI kalau ia sedang disentuh:

       - ada kursor di dalamnya          -> orangnya sedang mengetik
       - keadaan "belum"/"menyimpan"     -> ada ketikan yang belum sampai
       - keadaan "gagal"                 -> pesan galatnya belum dibaca
       - sedang jalan / mengantre        -> simpanBaris yang mengurusnya

     Baris yang dilewati akan tersegarkan sendiri begitu tersimpan, karena
     jalur simpan memang membaca ulang barisnya. Jadi tidak ada baris yang
     tertinggal basi selamanya — yang ada hanya baris yang menunggu gilirannya.
     ========================================================================== */
  const segarkanLembar = async () => {
    const versiPermintaan = ++versiLembar;
    let baru;
    try { baru = await lembarPos(pos.nomor); }
    catch { return; }   // pos sering kehilangan sinyal; percobaan berikutnya 20 detik lagi
    if (location.hash !== layarIni || versiPermintaan !== versiLembar) return;

    const peta = new Map(baru.map(r => [Number(r.nomor_dada), r]));
    let berubah = false;

    for (const tr of tbody.children) {
      const sibuk = tr.dataset.jalan === "1" || tr.dataset.antre === "1"
        || ["belum", "menyimpan", "gagal"].includes(tr.dataset.keadaan || "")
        || tr.contains(document.activeElement);
      if (sibuk) continue;

      const r = peta.get(Number(tr.dataset.dada));
      if (!r) continue;

      asli.set(Number(r.nomor_dada), r.nilai || {});
      // Gembok yang dipasang dari HP lain menyusul lewat penyegaran ini —
      // paling lama 20 detik, dan server tetap menolak lebih cepat dari itu.
      const kunciBaru = r.terkunci ? "1" : "";
      if (tr.dataset.terkunci !== kunciBaru) {
        tr.dataset.terkunci = kunciBaru;
        gambarGembok(tr);
      }
      if (tr.dataset.terisi !== String(r.jumlah_terisi)) berubah = true;
      tr.dataset.terisi = String(r.jumlah_terisi);
      tr.querySelector(".pos-nilai").textContent = angkaRapi(r.nilai_pos);

      // Kotaknya ditulis ulang hanya kalau isinya memang berbeda. Menyetel
      // .value ke teks yang sama pun sudah cukup untuk memindahkan kursor di
      // sebagian browser, dan baris ini bisa saja baru saja ditinggalkan.
      for (const kol of kolom) {
        const k = varianUntuk(kol, tr.dataset.golongan);
        if (!k) continue;
        const nilai = (r.nilai || {})[k.kode];
        const kotak = tr.querySelectorAll(`[data-kode="${CSS.escape(k.kode)}"]`);
        if (!kotak.length) continue;

        if (k.form === "biner") {
          const centang = !!(nilai && Number(nilai.nilai_1) > 0);
          if (kotak[0].checked !== centang) kotak[0].checked = centang;
        } else if (k.form === "benar_kurang_salah") {
          const b = nilaiTeks(k, nilai ? nilai.nilai_1 : null);
          const sa = nilaiTeks(k, nilai ? nilai.nilai_2 : null);
          if (kotak[0].value !== b) kotak[0].value = b;
          if (kotak[1] && kotak[1].value !== sa) kotak[1].value = sa;
        } else {
          // detik, meter, dan kotak angka biasa memakai satu penulis yang
          // sama dengan selKomponen — kalau tidak, penyegaran 20 detik bisa
          // menulis ulang kotak dengan bentuk yang berbeda dari yang tadi
          // digambar, dan kotak yang berubah sendiri terbaca seperti nilai
          // yang berubah sendiri.
          const v = nilaiTeks(k, nilai ? nilai.nilai_1 : null);
          if (kotak[0].value !== v) kotak[0].value = v;
        }
      }

      statusBaris(tr, Number(tr.dataset.terisi) > 0 ? "tersimpan" : "");
    }

    jamSinkron = new Date();
    // Angka "sudah lengkap" ikut, tapi SARINGANNYA tidak dijalankan ulang.
    // Baris yang jadi lengkap sementara petugas menyaring "Belum lengkap"
    // tetap terlihat sampai ia menyentuh saringan lagi — dan itu disengaja:
    // baris yang lenyap sendiri dari bawah jari orang yang sedang mengetik
    // lebih membingungkan daripada satu baris yang tertinggal sebentar.
    if (berubah) hitungUlangJumlah();
    perbaruiRingkasan();
  };

  // Denyut yang membersihkan dirinya sendiri, pola yang sama dengan layar
  // Rekapitulasi: berhenti saat pindah layar atau tab disembunyikan, dan
  // dinyalakan lagi oleh kepulangan itu sendiri lewat segarkanDiTempat.
  let denyut = null;
  const mulaiDenyut = () => {
    if (denyut !== null) return;
    denyut = setInterval(() => {
      if (location.hash !== layarIni || document.hidden) {
        clearInterval(denyut); denyut = null; return;
      }
      segarkanLembar();
    }, 20000);
  };
  segarkanDiTempat = () => { segarkanLembar(); mulaiDenyut(); };
  mulaiDenyut();
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
  /* Yang menentukan pemilih ini muncul BUKAN nama peran, melainkan apakah
     akunnya terkunci ke satu pos — dan itu kolom `pos`, bukan `peran`.

     Sebelumnya berbunyi `peran !== "admin"`, dan itu diam-diam mengunci
     Koordinator Pos ke pos pertama: ia tidak punya pos (justru itu gunanya),
     jadi layarnya jatuh ke posDinilai[0] tanpa satu pun cara berpindah.
     Pola yang sama juga akan menjerat akun mana pun yang diberi centang `pos`
     lewat matriks Akun tanpa berperan admin (bagian 13.1). */
  if (s.pos != null && s.pos !== "") return "";
  const dinilai = semuaPos.filter(p => Number(p.jumlah_komponen) > 0);
  return `
    <div class="field pilih-pos-field">
      <label for="pilih-pos" class="visually-hidden">Pos yang diinput</label>
      <select id="pilih-pos" class="select-small">
        ${dinilai.map(p => `<option value="${esc(p.nomor)}"
          ${Number(p.nomor) === Number(posDipilih.nomor) ? "selected" : ""}
          >${esc(judulPos(p))}</option>`).join("")}
      </select>
    </div>`;
}

function pasangPilihPos(s) {
  /* Syaratnya HARUS sama persis dengan pilihPosHtml() di atas. Kalau yang satu
     menggambar pemilihnya dan yang satu menolak memasang pendengarnya,
     hasilnya dropdown yang bisa diklik, berubah pilihannya, dan tidak
     melakukan apa pun — bentuk kegagalan yang paling sulit dilaporkan orang,
     karena layarnya terlihat baik-baik saja.

     Karena itu keduanya tidak memeriksa apa pun sendiri: `sel` hanya ada
     kalau pilihPosHtml() memang menggambarnya. */
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
/** Kartu merah "Bacakan ke petugas staging" — jawaban `pindah_kloter` saat
 *  nomor dipindahkan ke kloter yang kertasnya sudah beredar.
 *
 *  Dipisahkan supaya bentuknya sama dengan kartuSisipan di bawahnya: keduanya
 *  mengatakan hal yang sama kepada orang yang sama, dan dua bentuk untuk satu
 *  pesan membuat yang kedua terbaca seperti perkara lain. */
function kartuPeringatanPindah(teks) {
  return html`
    <div class="card" style="border:3px solid var(--bahaya);background:var(--bahaya-muda)">
      <h2 style="color:var(--bahaya)">⚠️ Bacakan ke petugas staging</h2>
      <p style="font-size:1.1rem;margin-top:.4rem">${teks}</p>
    </div>`;
}

function kartuSisipan(sisipan) {
  const aktif = sisipan.filter(s => !s.sudah_berangkat);
  if (!aktif.length) return "";
  const baris = aktif.map(s => html`
    <tr><td class="angka">${dada3(s.nomor_dada)}</td>
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
      <button class="button button-secondary" type="button" data-cetak-sisipan
              style="margin-top:.6rem">🖨️ Cetak daftar sisipan</button>
    </div>`;
}

/** LEMBAR SISIPAN — nomor-nomor yang tidak ada di kertas kloter.
 *
 *  KENAPA PERLU LEMBAR SENDIRI, dan kenapa `window.print()` telanjang tidak
 *  cukup: seluruh layar panitia disembunyikan waktu mencetak
 *  (`.header, .isi { display: none }` di @media print), dan yang tampil hanya
 *  `.printout`. Tombol yang cuma memanggil window.print() karena itu membuka
 *  dialog cetak berisi HALAMAN KOSONG — tanpa galat, tanpa tanda apa pun.
 *  Itulah yang dilaporkan sebagai "tombolnya tidak jalan".
 *
 *  SATU HALAMAN PER KLOTER, seperti daftar kloter, karena tiap lembar
 *  diserahkan ke petugas staging yang berbeda. Yang dicetak SELURUH kloter
 *  yang punya sisipan, bukan cuma kloter yang sedang dibuka: kertas ini
 *  dibawa berkeliling sekali jalan, dan menyuruh orang membuka kloter satu
 *  per satu lalu mencetak lagi adalah cara kloter terakhir terlewat.
 *
 *  Kolom Hadir ikut dicetak supaya lembar ini bisa dipakai persis seperti
 *  kertas kloter yang ia tambal — petugas mencentang di tempat yang sama.
 */
function siapkanCetakSisipan(aktif) {
  document.getElementById("cetakan")?.remove();

  const perKloter = new Map();
  for (const s of aktif) {
    if (!perKloter.has(s.kloter)) perKloter.set(s.kloter, []);
    perKloter.get(s.kloter).push(s);
  }

  const dicetak = tanggalJam(new Date().toISOString());
  const halaman = [...perKloter.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([nomor, daftar]) => `
      <section class="print-page">
        <h1>SISIPAN KLOTER ${esc(String(nomor))} — ${esc(EDISI ? EDISI.name : "")}</h1>
        <p><strong>Nomor-nomor ini TIDAK ADA di daftar Kloter ${esc(String(nomor))}
           yang sudah dicetak.</strong> Tulis tangan di kertas kloternya, atau
           bacakan ke petugas staging.</p>
        <table class="print-table">
          <thead><tr>
            <th class="kotak">Hadir</th><th>No Dada</th><th>Nama Regu</th>
            <th>Sekolah</th><th>Alasan disisipkan</th>
          </tr></thead>
          <tbody>${daftar.map(s => html`
            <tr><td class="kotak"></td>
                <td class="dada">${dada3(s.nomor_dada)}</td>
                <td>${s.nama_regu}</td>
                <td>${s.nama_sekolah}</td>
                <td>${s.alasan_sisip}</td></tr>`).join("")}</tbody>
        </table>
        <p class="insert-note">Dicetak ${esc(dicetak)}. Regu yang disisipkan
           sesudah jam itu tidak ada di kertas ini juga.</p>
      </section>`).join("");

  document.body.appendChild(h(`<div id="cetakan" class="printout">${halaman}</div>`));
  return perKloter.size;
}

/* ---------------- layar "edisi belum termuat" ---------------- */

function layarButuhEdisi(judul) {
  pasangKepala(judul);
  LAYAR.replaceChildren(kartuGagalMuat(
    "Data acara (biaya per regu) belum terbaca, jadi tagihan tidak bisa dihitung.",
    async () => { try { EDISI = await infoEdisi(); } catch {} arahkan(); }));
}

/** Satu sel Live Score: POIN AKHIR komponen itu, bukan angka mentahnya.
 *
 *  Angka mentah tidak bisa dibandingkan antar kolom — "4" di Semaphore, "8.55"
 *  di Menaksir, dan "01:14" di Bakiak adalah tiga satuan yang berbeda, dan
 *  tidak satu pun menyebut sumbangannya ke Total di ujung baris. Papan ini
 *  dibaca justru oleh orang yang tidak memegang tangga poin tiap lomba:
 *  pembina, peserta, dan panitia yang bukan juri lomba itu.
 *
 *  Angkanya datang JADI dari `v_rekap_penuh.poin` (migrasi 0107). Layar tidak
 *  menghitungnya sendiri — alasannya sama dengan Nilai Pos di layar Input Pos:
 *  mesin skor kedua adalah mesin skor yang suatu hari berbeda pendapat dengan
 *  yang pertama.
 *
 *  Kosong berarti komponennya belum dinilai. Nol yang SUDAH dinilai tetap
 *  tergambar "0" — itu angka, bukan ketiadaan. */
const selPoin = (v) => esc(angkaRapi(v));

/* Dibatalkan tiap kali layar Live Score dibuka lagi: panel penyaring hidup di
   <body>, jadi tidak ada yang membuangnya saat pindah layar. */
let pengendaliFilterSekolah = null;

async function layarLiveScore() {
  pasangKepala("Live Score", true);
  LAYAR.replaceChildren(h(pemuat()));
  const layarIni = location.hash;

  let pos, klasemen, status, posSemua, komponen, rekap;
  try {
    [pos, klasemen, status, posSemua, komponen, rekap] = await Promise.all([
      kelengkapanPos(), klasemenLiveScore(), statusAcara(),
      daftarPos(), komponenSemua(EDISI.nomor), rekapPenuh(),
    ]);
  } catch (e) {
    LAYAR.replaceChildren(kartuGagalMuat(e.message, layarLiveScore));
    return;
  }
  if (location.hash !== layarIni) return;

  // `let`, bukan `const`: saklar di bawah memperbaruinya DI TEMPAT.
  let fase = (status && status.fase_live) || "pra";
  // Persen dihitung di sini, bukan di view. `v_kelengkapan_pos` sudah membawa
  // `lengkap` dan `regu_total`, dan menambah view yang menghitung pembagian
  // itu adalah tempat kedua yang harus ikut benar setiap kali definisi
  // "lengkap" berubah.
  const persenPos = (p) => !p.regu_total
    ? 0 : Math.floor(100 * p.lengkap / p.regu_total);

  /** Merah -> kuning -> hijau mengikuti persennya, bukan tiga anak tangga.

   *  Tangga membuat 49% dan 51% terlihat sangat berbeda padahal selisihnya satu
   *  regu, sementara 51% dan 89% terlihat sama padahal itu dua puluh regu.
   *  Gradasi menampilkan JARAKNYA, dan jarak itu yang ditanyakan orang saat
   *  melirik lima cincin sekaligus.
   *
   *  Rona 0 di 0%, 50 di 50%, 140 di 100% — merah, kuning, hijau. Angkanya
   *  tetap tertulis di dalam cincin, jadi warna tidak pernah jadi satu-satunya
   *  kabar bagi yang sulit membedakan merah dari hijau. */
  const warnaPersen = (s) => {
    const p = Math.max(0, Math.min(100, Number(s) || 0));
    const rona = p <= 50 ? p : 50 + (p - 50) * 1.8;
    return `hsl(${Math.round(rona)}, 72%, 40%)`;
  };

  const totalLengkap = pos.reduce((n, p) => n + Number(p.lengkap || 0), 0);
  const totalRegu    = pos.reduce((n, p) => n + Number(p.regu_total || 0), 0);
  const persenSemua  = totalRegu ? Math.round(totalLengkap / totalRegu * 100) : 0;

  const kemajuan = `
    <div class="card">
      <button type="button" class="judul-status" id="kemajuan-buka"
              aria-expanded="false" aria-controls="kemajuan-rinci">
        <span class="js-teks">Status</span>
        <span class="js-batang" aria-hidden="true"><span
          style="width:${persenSemua}%;background:${warnaPersen(persenSemua)}"></span></span>
        <span class="js-persen">${esc(String(persenSemua))}%</span>
        <span class="kr-panah" aria-hidden="true">▾</span>
      </button>
      <ul class="kemajuan" id="kemajuan-rinci">
        ${pos.map(p => {
          const s = persenPos(p);
          return `
          <li>
            <div class="cincin" style="--persen:${s};--warna:${warnaPersen(s)}"
                 role="img" aria-label="Pos ${esc(String(p.pos))} ${esc(String(s))} persen selesai">
              <span>${esc(String(s))}<i>%</i></span>
            </div>
            <div class="c-nama">Pos ${esc(String(p.pos))} · ${esc(p.nama_pos)}</div>
            <div class="c-angka">${esc(String(p.lengkap))} / ${esc(String(p.regu_total))} regu</div>
          </li>`;
        }).join("")}
      </ul>
    </div>`;

  const MEDALI = { 1: "🥇", 2: "🥈", 3: "🥉" };

  /* Kolom rincian dibangun dengan kolomPos() yang SAMA dengan layar Input Pos
     dan Rekapitulasi. Satu kolom per LOMBA, bukan per baris wahana — tanpa itu
     Pos 1 memakan empat kolom "Tebak Simpul" yang isinya saling meniadakan,
     satu per golongan, dan tabelnya memanjang tanpa menambah satu keterangan
     pun. */
  /* Satu kolom per LOMBA, bukan per penilaian — keputusan pemilik acara.
     Pembidaian lima kriteria jadi satu angka, PBB empat jadi satu, Yel-Yel
     empat jadi satu. Yang dibaca orang di papan ini adalah "berapa nilai
     Pembidaian regu itu", bukan berapa nilai Posisi Bidai-nya; rinciannya
     tetap utuh di Rekapitulasi dan di layar Input Pos, tempat ia memang
     menjawab pertanyaan.

     Ini TIDAK mengubah cara nilai dihitung. `poin_per_pos` tetap datang dari
     database; yang dijumlahkan di sini cuma tampilannya. */
  const posKolom = posSemua
    .filter(p => p.jumlah_komponen > 0)
    .map(p => ({
      ...p,
      lomba: kelompokLomba(kolomPos(komponen.filter(k => k.pos === p.nomor))),
    }));
  const rekapDada = new Map(rekap.map(r => [r.nomor_dada, r]));
  /* KEEMPAT golongan selalu digambar, dengan urutan tetap — bukan hanya yang
     kebetulan sudah punya baris.
     Empat golongan berlomba TERPISAH: masing-masing punya juara sendiri, dan
     tidak ada satu pun peringkat yang membandingkan Penggalang dengan
     Penegak. Menggambar hanya golongan yang sudah terisi membuat papannya
     berubah bentuk sepanjang hari — Penegak PI muncul belakangan lalu
     menggeser semuanya — dan yang lebih buruk, golongan yang belum satu pun
     regunya masuk terlihat seperti golongan yang tidak ada. */
  const bisaPublish = bolehLihat("pengaturan");
  /* Label menyebut SIAPA YANG MELIHAT, bukan nama fase di database.
     "Pra" tidak mengatakan apa-apa kepada orang yang menekannya — ia nama
     tahapan, bukan akibat. "Internal" langsung menjawab pertanyaan yang
     sebenarnya ditanyakan: apakah peserta sudah bisa melihat ini.

     Kodenya TETAP pra/progres/penuh. Nilai itu duduk di status_acara, dipakai
     v_progres_publik, keempat pagar "BOCOR" di publish-live.yml, dan migrasi
     0068/0070/0072 — menggantinya menuntut migrasi beserta seluruh policy,
     demi tiga kata di layar. */
  const FASE = [
    ["pra", "Internal"], ["progres", "Progress"], ["penuh", "Live"],
  ];
  const saklar = !bisaPublish ? "" : `
    <div class="segmen-fase" role="group" aria-label="Fase Live Score">
      ${FASE.map(([kode, teks]) => `
        <button type="button" class="button ${kode === fase ? "button-primary" : ""}"
                data-fase="${esc(kode)}" ${kode === fase ? "aria-current=\"true\"" : ""}
                style="padding:.3rem .7rem;font-size:.85rem">${esc(teks)}</button>`).join("")}
    </div>`;

  const kartuGolongan = (g) => {
        const baris = klasemen.filter(k => k.golongan === g);
        const juara = baris.filter(k => k.peringkat <= 3);
        const sekolahAda = [...new Set(baris.map(k => k.nama_sekolah).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b, "id"));
        if (!baris.length) return `
        <div class="card">
          <div class="kepala-klasemen">
            <div class="sisi"></div>
            <!-- "sementara" yang membawa faktanya: papan ini memeringkat dari
                 poin yang terkumpul SEKARANG, jadi urutannya bisa berubah
                 sampai pos terakhir terisi. Tanpa kata itu, tiga medali di
                 layar besar terbaca seperti hasil — dan itu yang diumumkan
                 orang. -->
            <h2>Klasemen sementara</h2>
            <div class="sisi kanan">${saklar}</div>
          </div>
          <p class="description">Belum ada regu golongan ini yang bisa
            diperingkat.</p>
        </div>`;
        return `
        <div class="card">
          <div class="kepala-klasemen">
            <div class="sisi"></div>
            <!-- "sementara" yang membawa faktanya: papan ini memeringkat dari
                 poin yang terkumpul SEKARANG, jadi urutannya bisa berubah
                 sampai pos terakhir terisi. Tanpa kata itu, tiga medali di
                 layar besar terbaca seperti hasil — dan itu yang diumumkan
                 orang. -->
            <h2>Klasemen sementara</h2>
            <div class="sisi kanan">${saklar}</div>
          </div>
          <div class="podium">
            ${juara.map(k => `
              <div class="juara j${esc(String(k.peringkat))}">
                <div class="medali" aria-hidden="true">${MEDALI[k.peringkat] || ""}</div>
                <div class="j-teks">
                  <div class="peringkat">Juara ${esc(String(k.peringkat))}
                    <span class="dada-juara">${esc(dada3(k.nomor_dada))}</span></div>
                  <div class="nama">${esc(k.nama_regu)}</div>
                  <div class="sekolah">${esc(k.nama_sekolah)}</div>
                </div>
                <div class="total">${esc(angkaRapi(k.total))}</div>
              </div>`).join("")}
          </div>
          <!-- Penyaring sekolah. Daftarnya dibangun dari baris golongan INI,
               bukan dari seluruh sekolah: memilih sekolah yang tidak punya
               regu di golongan yang sedang dibuka menghasilkan tabel kosong
               tanpa satu pun petunjuk kenapa.

               <details> biasa, bukan dropdown buatan sendiri — ia sudah bisa
               dibuka dengan sentuhan, ditutup dengan Esc, dan dibacakan
               pembaca layar tanpa satu baris JS pun. -->
          <!-- Panelnya di ATAS tabel, tapi yang diklik KEPALA KOLOMNYA.
               Panel ini tidak bisa ditaruh di dalam <th>: tabelnya duduk di
               dalam wadah bergulir, dan apa pun yang mengambang di dalam sana
               terpotong begitu daftarnya lebih tinggi dari kepala tabel. -->
          <!-- Panel MENGAMBANG di bawah kepala kolomnya, bukan kotak yang
               mendorong tabel ke bawah. Posisinya fixed, koordinatnya
               dihitung saat dibuka: tabelnya duduk di wadah bergulir, dan
               apa pun yang mengambang DI DALAM sana terpotong begitu
               daftarnya lebih tinggi dari kepala tabel.

               Kotak ketik di atas daftar: 23 sekolah hari ini masih bisa
               disapu mata, ratusan tahun depan tidak. Bentuknya sengaja
               seperti saringan Excel — orang di meja panitia sudah tahu
               cara memakainya tanpa diberi tahu. -->
          <div class="isi-filter" hidden>
            <input type="search" class="cari-filter" placeholder="Ketik nama sekolah…"
                   aria-label="Cari sekolah">
            <div class="daftar-filter">
              ${sekolahAda.map(nm => `
                <label><input type="checkbox" value="${esc(nm)}"> ${esc(nm)}</label>`).join("")}
            </div>
            <button type="button" class="button tombol-semua"
                    style="padding:.25rem .6rem;font-size:.8rem">Hapus Filter</button>
          </div>
          <div class="table-wrapper table-wrapper-tetap">
            <table class="table data-table table-tetap table-rekap table-live">
              <thead>
                <tr>
                  <th rowspan="2">#</th>
                  <th rowspan="2">No<br>Dada</th>
                  <th rowspan="2">Regu</th>
                  <!-- Kepala kolomnya SENDIRI yang jadi tombol saringan.
                       Tombol terpisah di atas tabel menjauhkan aksinya dari
                       kolom yang disaringnya, dan menambah satu benda lagi di
                       layar yang sudah padat. -->
                  <th rowspan="2" class="rekap-batas th-saring" tabindex="0"
                      role="button" aria-expanded="false"
                      title="Klik untuk menyaring per sekolah">Organisasi
                    <span class="hitung-filter"></span> <span aria-hidden="true">▾</span></th>
                  <!-- Kolom "Nilai" per pos hanya digambar kalau posnya
                       memuat LEBIH DARI SATU lomba. Pos 4 cuma punya PBB dan
                       Pos 5 cuma punya Yel-Yel: di sana "PBB 82 | Nilai 82"
                       adalah angka yang sama dua kali, bersebelahan. -->
                  ${posKolom.map(p => `<th colspan="${p.lomba.length + (p.lomba.length > 1 ? 1 : 0)}"
                    class="rekap-batas">Pos ${esc(String(p.nomor))} · ${esc(p.name)}</th>`).join("")}
                  <!-- Lima kolom perjalanan mendahului Penalti, dan urutan
                       itu yang membuatnya berguna: Penalti selalu dibaca
                       dengan pertanyaan "dari mana", dan jawabannya persis
                       kelima kolom ini -- kontrak yang dijanjikan, jam
                       berangkat, jam datang, dan berapa anggota yang tiba.
                       Menaruhnya SESUDAH Penalti memaksa mata melompat balik
                       melewati seluruh kolom lomba. -->
                  <th rowspan="2">Kontrak</th>
                  <th rowspan="2">Kloter</th>
                  <th rowspan="2">Berangkat</th>
                  <th rowspan="2">Datang</th>
                  <th rowspan="2">Anggota</th>
                  <th rowspan="2">Penalti</th>
                  <th rowspan="2">Total</th>
                </tr>
                <tr>
                  <!-- Nama lomba saja, TANPA rentang. Rentang menjelaskan apa
                       yang boleh DIKETIK, dan di papan ini tidak ada yang
                       mengetik apa pun — yang tergambar sudah poin akhir, dan
                       "0 – 5" di bawah kolom berisi 80 justru membantahnya.
                       Rentangnya tetap ada di layar Input Pos dan di
                       Rekapitulasi, tempat ia memang menjawab pertanyaan. -->
                  ${posKolom.map(p => {
                    const satuLomba = p.lomba.length === 1;
                    return p.lomba.map((l, i) =>
                      `<th class="pos-kol${satuLomba && i === p.lomba.length - 1
                        ? " rekap-batas" : ""}">${esc(l.nama)}</th>`).join("")
                      + (satuLomba ? "" : `<th class="pos-kol rekap-batas">Nilai</th>`);
                  }).join("")}
                </tr>
              </thead>
              <tbody>
                ${baris.map(k => {
                  const rk = rekapDada.get(k.nomor_dada) || {};
                  // Poin per KOMPONEN (0107) untuk sel lomba, poin per POS
                  // untuk kolom Nilai di ujung tiap kelompok. Dua hal berbeda,
                  // dua kunci berbeda — `pos.kode` lawan `pos`.
                  const poinKomponen = rk.poin || {};
                  const poin = k.poin_per_pos || {};
                  return `
                  <tr data-sekolah="${esc(k.nama_sekolah || "")}">
                    <td class="rekap-rank">${MEDALI[k.peringkat] || ""}<span class="rank-angka">${esc(String(k.peringkat))}</span></td>
                    <td class="angka">${esc(dada3(k.nomor_dada))}</td>
                    <td>${esc(k.nama_regu)}</td>
                    <td class="rekap-batas sub-kolom">${esc(k.nama_sekolah)}</td>
                    ${posKolom.map(p => {
                      const satuLomba = p.lomba.length === 1;
                      return p.lomba.map((l, i) => {
                        // Satu lomba bisa punya baris wahana berbeda per
                        // golongan; yang berlaku untuk regu INI yang dibaca.
                        // `berlaku === 0` berarti lomba ini memang bukan untuk
                        // golongannya — bukan berarti nilainya belum masuk.
                        const r = ringkasLomba(l, k.golongan, p.nomor, poinKomponen);
                        const batas = satuLomba && i === p.lomba.length - 1
                          ? " rekap-batas" : "";
                        if (!r.berlaku)
                          return `<td class="text-center${batas}"><span class="sel-mati">–</span></td>`;
                        return `<td class="text-center${batas}">${
                          r.terisi ? selPoin(r.jumlah) : "–"}</td>`;
                      }).join("")
                      + (satuLomba ? ""
                        : `<td class="text-center pos-nilai rekap-batas">${
                            poin[String(p.nomor)] === undefined
                              ? "–" : esc(angkaRapi(poin[String(p.nomor)]))}</td>`);
                    }).join("")}
                    <td class="text-center">${esc(kontrakTeks(rk.kontrak_menit))}</td>
                    <td class="text-center">${esc(rk.kloter ?? "—")}</td>
                    <td class="text-center">${esc(rk.jam_berangkat
                      ? jamMenit(rk.jam_berangkat) : "—")}</td>
                    <td class="text-center">${esc(rk.jam_datang
                      ? jamMenit(rk.jam_datang) : "—")}</td>
                    <td class="text-center">${esc(rk.anggota_hadir ?? "—")}</td>
                    <td class="text-center">${esc(angkaRapi(
                      Number(k.penalti_waktu) + Number(k.penalti_checkout)
                      + Number(k.penalti_anggota)))}</td>
                    <td class="text-center"><strong>${esc(angkaRapi(k.total))}</strong></td>
                  </tr>`;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>`;
  };

  /* SATU golongan pada satu waktu, dipilih lewat tab.
     Empat papan bertumpuk berarti detail Penegak PI ada empat layar penuh di
     bawah — dan yang membuka layar ini hampir selalu sedang menanyakan SATU
     golongan, bukan membandingkan keempatnya. Keempat tab tetap terlihat
     sekaligus dengan jumlah regunya, jadi yang hilang cuma gulirannya.

     Semua panel digambar sekali lalu disembunyikan, bukan digambar ulang saat
     diklik: datanya sudah ada di tangan, dan berpindah tab yang menunggu
     apa pun terasa rusak. */
  const GOL = URUT_GOLONGAN;
  const jumlahGol = Object.fromEntries(
    GOL.map(g => [g, klasemen.filter(k => k.golongan === g).length]));
  // Tab pertama yang sudah ada isinya, supaya layar tidak terbuka pada
  // golongan kosong ketika golongan lain justru sudah penuh.
  const golAktif = GOL.find(g => jumlahGol[g] > 0) || GOL[0];

  const tab = !klasemen.length ? "" : `
    <div class="tab-golongan" role="tablist" aria-label="Golongan">
      ${GOL.map(g => `
        <button type="button" role="tab" class="tab-gol" data-gol="${esc(g)}"
                aria-selected="${g === golAktif ? "true" : "false"}">
          ${esc(GOLONGAN_LABEL[g])}
          <span class="tab-hitung">${esc(String(jumlahGol[g]))}</span>
        </button>`).join("")}
    </div>`;

  const papan = !klasemen.length
    ? `<div class="card">
         <div class="kepala-klasemen">
           <div class="sisi"></div>
           <h2>Klasemen sementara</h2>
           <div class="sisi kanan">${saklar}</div>
         </div>
         <p class="description">Belum ada regu yang bisa diperingkat di
           golongan mana pun.</p>
       </div>`
    : GOL.map(g => `<div class="panel-gol" data-gol="${esc(g)}"${
        g === golAktif ? "" : " hidden"}>${kartuGolongan(g)}</div>`).join("");

  /* Kartu pemberitahuan DIHAPUS (CLAUDE.md 9.1 dan 9.3). Judul layarnya
     sudah "Live Score" di kepala halaman; mengulanginya di dalam badan,
     ditambah dua paragraf yang mengajarkan arti fase, adalah tiga baris yang
     dibaca ratusan kali per shift untuk satu hal yang dipelajari sekali.
     Fase yang sedang berlaku sekarang dibawa TOMBOLNYA — di situ ia fakta
     yang tidak bisa dibaca dari layar, bukan pelajaran.

     Tombolnya hanya untuk yang memegang `pengaturan` — bawaannya admin. Yang
     lain tidak melihat apa pun di tempat ini, bukan tombol mati: tombol mati
     di pojok tidak memberi tahu apa pun selain ada sesuatu yang tidak boleh
     disentuh. */
  /* Judul di TENGAH, saklar tiga keadaan di KANAN, satu baris.
     Tombol besar sebelumnya memakan tinggi layar untuk sesuatu yang ditekan
     dua kali sepanjang acara. Tiga keadaan ditampilkan sekaligus, bukan satu
     tombol yang berganti tulisan: dengan begitu fase yang SEDANG berlaku
     terbaca tanpa harus tahu apa arti tulisan tombolnya.

     "sementara" di judulnya membawa fakta yang tidak bisa dibaca dari layar:
     papan ini memeringkat dari poin yang terkumpul SEKARANG, jadi urutannya
     bisa berubah sampai pos terakhir terisi. Tanpa kata itu, tiga medali di
     layar besar terbaca seperti hasil — dan itu yang diumumkan orang. */
  LAYAR.replaceChildren(h(`
    ${kemajuan}
    ${tab}
    ${papan}`));

  /* Diperbarui DI TEMPAT, bukan dengan menggambar ulang layar.
     layarLiveScore() menarik enam permintaan sekaligus — klasemen, rekap,
     kelengkapan, pos, komponen, status — dan menggambar ulang seluruh papan.
     Untuk satu kolom yang berpindah itu mahal, dan yang paling terasa: papan
     berkedip dan tab golongan yang sedang dibuka kembali ke awal. Yang
     berubah di layar cuma tombol mana yang menyala. */
  /* Rincian per pos dibuka/ditutup dengan menekan JUDULNYA, di lebar mana pun.
     Dulu yang ditekan batang ringkas yang cuma ada di HP, dan di layar lebar
     kelima cincin selalu tampil tanpa bisa ditutup — dua perilaku untuk satu
     kartu, jadi apa yang dilihat orang bergantung pada lebar layarnya. */
  const tombolKemajuan = document.getElementById("kemajuan-buka");
  const rinciKemajuan = document.getElementById("kemajuan-rinci");
  if (tombolKemajuan && rinciKemajuan) {
    tombolKemajuan.addEventListener("click", () => {
      const buka = rinciKemajuan.classList.toggle("terbuka");
      tombolKemajuan.setAttribute("aria-expanded", String(buka));
      tombolKemajuan.classList.toggle("terbuka", buka);
    });
  }

  /* Kepala tabel Live Score ada DUA baris, dan keduanya menempel di atas.
     Aturan umum `.data-table thead th` memaku semuanya di `top: 0`, jadi baris
     kedua — nama lomba — mendarat tepat di atas baris pertama dan MENUTUPI
     nama posnya. Dari layar itu terbaca seperti "Pos 1 · Kepramukaan hilang
     waktu digulir", padahal ia masih ada di bawah tumpukan.

     Tingginya diukur, tidak ditebak: "Pos 1 · Kepramukaan" membungkus jadi dua
     baris di layar sempit dan satu baris di layar lebar, jadi angka tetap
     apa pun akan benar di satu ukuran dan meninggalkan celah atau tumpang
     tindih di ukuran lain. Diukur ulang saat lebarnya berubah, karena di situ
     pula pembungkusannya berubah. */
  const sinyalLayar = sinyalLayarBaru();
  LAYAR.querySelectorAll(".table-live").forEach(tabel => {
    const baris1 = tabel.tHead && tabel.tHead.rows[0];
    if (!baris1) return;
    const ukur = () => tabel.style.setProperty(
      "--kepala-baris1", `${Math.round(baris1.getBoundingClientRect().height)}px`);
    ukur();
    const pengamatUkur = new ResizeObserver(ukur);
    pengamatUkur.observe(baris1);
    putusSaatPindah(sinyalLayar, pengamatUkur);
  });

  LAYAR.querySelectorAll("[data-fase]").forEach(tb => {
    tb.addEventListener("click", async () => {
      const ke = tb.dataset.fase;
      if (ke === fase) return;
      const semua = LAYAR.querySelectorAll("[data-fase]");
      semua.forEach(x => { x.disabled = true; });
      try {
        await aturFaseLive(ke);
        fase = ke;
        semua.forEach(x => {
          const aktif = x.dataset.fase === ke;
          x.classList.toggle("button-primary", aktif);
          if (aktif) x.setAttribute("aria-current", "true");
          else x.removeAttribute("aria-current");
        });
        /* Pesannya menyebut AKIBATNYA bagi peserta, bukan nama fasenya.
           Halaman peserta ikut dalam hitungan detik: ia membaca fase langsung
           dari database tiap poll (0070).

           Kalimat kedua pada Live sengaja ditahan. Saklar ini cuma bisa
           MEMPERKETAT — ia tidak pernah menampilkan lebih dari isi berkas yang
           sudah terbit (CLAUDE.md 14.3), dan publish-live.yml menghapus
           klasemen dari berkas itu selama fasenya belum penuh. Jadi urutannya
           mengikat: nyalakan Live DULU, terbitkan SESUDAHNYA. Tanpa kalimat
           ini, admin menekan Live, membaca "peserta dapat melihat", dan
           peserta tetap melihat papan kosong tanpa satu pun tanda kenapa —
           cron penerbitan berkala masih dimatikan di luar minggu lomba. */
        notif(ke === "penuh"
          ? "Live Score aktif. Peserta dapat melihat rekapitulasi penuh — "
            + "jalankan Publish rekap live supaya angkanya ikut terbit."
          : ke === "progres" ? "Peserta dapat melihat progress live score."
          : "Live Score hanya dapat dilihat panitia.");
      } catch (e) {
        notif(e.message, true);
      } finally {
        semua.forEach(x => { x.disabled = false; });
      }
    });
  });

  /* Penyaring sekolah, satu per panel golongan.
   *
   *  Menyaring BARIS TABEL saja — podium juara dibiarkan utuh. Tiga medali
   *  itu menjawab "siapa juara golongan ini"; menyaringnya per sekolah akan
   *  menjadikan regu peringkat sembilan tampil sebagai Juara 1, dan itu
   *  gambar yang difoto lalu disebarkan.
   *
   *  Peringkat di kolom pertama juga TIDAK dihitung ulang: ia peringkat di
   *  golongannya, bukan nomor urut baris yang sedang tampil. Menyaring
   *  sekolah lalu melihat "1, 4, 7" adalah jawaban yang benar. */
  /* PANEL KUNJUNGAN SEBELUMNYA DIBUANG DULU, beserta pendengarnya.
     Tiap panel dipindah ke <body> saat dipasang (alasannya beberapa baris di
     bawah), jadi ia bukan lagi keturunan LAYAR — dan mengganti isi LAYAR saat
     pindah layar tidak menyentuhnya. Yang tertinggal bukan cuma sampah:
     pendengar `document` miliknya tetap jalan di SETIAP klik di layar mana
     pun, dan kunjungan berikutnya menambah empat panel lagi. */
  pengendaliFilterSekolah?.abort();
  pengendaliFilterSekolah = new AbortController();
  const { signal } = pengendaliFilterSekolah;
  document.querySelectorAll("body > .isi-filter").forEach(n => n.remove());

  LAYAR.querySelectorAll(".panel-gol").forEach(panel => {
    const kotak = [...panel.querySelectorAll(".isi-filter input[type=checkbox]")];
    const hitung = panel.querySelector(".hitung-filter");
    const semua = panel.querySelector(".tombol-semua");
    if (!kotak.length) return;

    const terapkan = () => {
      const pilih = new Set(kotak.filter(c => c.checked).map(c => c.value));
      panel.querySelectorAll("tbody tr[data-sekolah]").forEach(tr => {
        tr.hidden = pilih.size > 0 && !pilih.has(tr.dataset.sekolah);
      });
      // Angkanya, bukan kata "aktif": panitia perlu tahu BERAPA yang sedang
      // menyaring tanpa membuka daftarnya.
      hitung.textContent = pilih.size ? `(${pilih.size})` : "";
      panel.querySelector(".th-saring").classList.toggle("menyaring", pilih.size > 0);
    };

    const kepala = panel.querySelector(".th-saring");
    const isi = panel.querySelector(".isi-filter");
    const cariKotak = panel.querySelector(".cari-filter");
    // Panelnya DIPINDAH ke <body> saat dibuka. `position: fixed` hanya
    // relatif ke viewport selama tidak ada leluhur yang punya transform,
    // filter, atau will-change — begitu ada satu saja, ia jadi relatif ke
    // leluhur itu dan panelnya mendarat di tempat yang sama sekali lain.
    // Memindahkannya ke body menghapus seluruh pertanyaan itu.
    if (isi.parentElement !== document.body) document.body.appendChild(isi);
    const tempel = () => {
      // Ditempel ke kepala kolomnya tiap kali dibuka, bukan sekali saat
      // digambar: tabelnya bisa digulir ke samping, dan panel yang koordinatnya
      // dihitung sekali akan tertinggal di tempat lamanya.
      const r = kepala.getBoundingClientRect();
      isi.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - 300))}px`;
      isi.style.top = `${r.bottom + 2}px`;
    };
    const tutup = () => {
      isi.hidden = true;
      kepala.setAttribute("aria-expanded", "false");
    };
    const buka = () => {
      if (isi.hidden) { tempel(); isi.hidden = false; }
      else isi.hidden = true;
      kepala.setAttribute("aria-expanded", String(!isi.hidden));
      if (!isi.hidden && cariKotak) cariKotak.focus();
    };
    // Ditutup dengan klik di luar dan dengan Esc — dua jalan yang sudah
    // dipakai orang tanpa diberi tahu.
    document.addEventListener("click", e => {
      if (!isi.hidden && !isi.contains(e.target) && e.target !== kepala
          && !kepala.contains(e.target)) tutup();
    }, { signal });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape") tutup();
    }, { signal });
    if (cariKotak) cariKotak.addEventListener("input", () => {
      const q = cariKotak.value.trim().toLowerCase();
      // Dicari dari `isi`, BUKAN dari `panel`. Panelnya sudah dipindah ke
      // <body> saat dipasang, jadi ia bukan lagi keturunan .panel-gol dan
      // querySelectorAll dari sana mengembalikan nol elemen — kotak ketiknya
      // tampak mati padahal huruf-hurufnya masuk.
      isi.querySelectorAll(".daftar-filter label").forEach(l => {
        l.hidden = q.length > 0 && !l.textContent.toLowerCase().includes(q);
      });
    });
    if (kepala) {
      kepala.addEventListener("click", buka);
      // Keyboard juga: <th> bukan tombol, jadi Enter/Space tidak datang
      // sendiri walau tabindex dan role sudah dipasang.
      kepala.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); buka(); }
      });
    }

    kotak.forEach(c => c.addEventListener("change", terapkan));
    if (semua) semua.addEventListener("click", () => {
      kotak.forEach(c => { c.checked = false; });
      terapkan();
    });
  });

  const bilah = LAYAR.querySelector(".tab-golongan");
  if (bilah) {
    bilah.addEventListener("click", (e) => {
      const b = e.target.closest("[data-gol]");
      if (!b) return;
      const pilih = b.dataset.gol;
      bilah.querySelectorAll("[data-gol]").forEach(x =>
        x.setAttribute("aria-selected", String(x.dataset.gol === pilih)));
      LAYAR.querySelectorAll(".panel-gol").forEach(pn => {
        pn.hidden = pn.dataset.gol !== pilih;
      });
    });
  }
}

/* ============================ AKUN ======================================= */

const PERAN_LABEL = { admin: "Admin", registrasi: "Registrasi",
                      gerbang: "Gerbang", juri_pos: "Juri Pos",
                      koordinator_pos: "Koordinator Pos" };

/** Kartu password. Ditampilkan SEKALI — tidak disimpan di mana pun dan tidak
 *  bisa dibaca lagi setelah dialognya ditutup, persis seperti CSV hasil
 *  provision_accounts.py. Karena itu dialognya baca-saja: tidak ada tombol
 *  Batal yang bisa tertekan sebelum angkanya sempat dicatat. */
function tampilkanPassword(judul, baris) {
  return dialog({
    judul,
    bacaSaja: true,
    labelAksi: "Sudah dicatat",
    kartuHtml: `
      <div class="card">
        <table class="table">
          <thead><tr><th>Nama akun</th><th>Password</th></tr></thead>
          <tbody>${baris.map(b => `
            <tr><td>${esc(b.username)}</td>
                <td><code style="font-size:1.15em">${esc(b.password)}</code></td></tr>`).join("")}
          </tbody>
        </table>
      </div>
      <p>Password ini tidak bisa dibuka lagi setelah kotak ini ditutup.</p>`,
  });
}

async function layarAkun() {
  pasangKepala("Akun", true);

  // RLS yang sebenarnya menahan — ini supaya layarnya tidak tampak kosong dan
  // membingungkan kalau alamatnya diketik langsung.
  if (!bolehLihat("akun")) {
    LAYAR.replaceChildren(h(kartuGalat("Hanya admin yang bisa mengelola akun.")));
    return;
  }

  LAYAR.replaceChildren(h(pemuat()));
  const layarIni = location.hash;
  let akun, fitur, hak;
  try { [akun, fitur, hak] = await Promise.all([daftarAkun(), daftarFitur(), daftarHak()]); }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarAkun)); return; }
  if (location.hash !== layarIni) return;

  // Dijodohkan di browser: 20 akun x 11 fitur cuma 220 baris, jadi satu
  // bacaan lebih murah daripada satu query per akun.
  const punya = new Set(hak.map(x => `${x.user_id}|${x.fitur}`));
  const opsiPeran = (dipilih) => Object.entries(PERAN_LABEL)
    .map(([k, v]) => `<option value="${k}"${k === dipilih ? " selected" : ""}>${esc(v)}</option>`)
    .join("");

  LAYAR.replaceChildren(h(`
    <div class="card">
      <h2>Buat Akun</h2>
      <!-- .table-toolbar, bukan .option-row: option-row itu grid DUA kolom
           (style.css), jadi empat isian di dalamnya jatuh 2x2 dan kotak Pos
           yang isinya satu angka mendapat setengah lebar kartu. -->
      <!-- Rata BAWAH, bukan rata tengah seperti toolbar saring: di sana label
           kotak carinya visually-hidden sehingga tidak memakan tinggi, di
           sini labelnya terlihat — dan rata tengah membuat tombolnya melayang
           setinggi label, tidak sejajar dengan kotak isian di sebelahnya. -->
      <!-- Bentuknya sama dengan form pendaftaran: label di atas, isian
           SELEBAR kartunya. Sebelumnya ia .table-toolbar dengan lebar
           dipatok inline (14rem, 5rem) — di HP ketiganya terjepit ke kanan,
           labelnya melayang di tengah, dan kotak Pos menyusut jadi seukuran
           ibu jari. Lebar tetap di dalam wadah yang menyempit selalu
           berakhir begitu.

           Di layar lebar ia kembali sebaris lewat grid, tanpa satu pun ukuran
           dipatok tangan. -->
      <div class="form-akun">
        <div class="field"><label for="ak-nama">Nama akun</label>
          <input id="ak-nama" type="text" class="small-input" autocomplete="off"
            placeholder="misal: aji.furqon"></div>
        <div class="field"><label for="ak-peran">Peran</label>
          <select id="ak-peran" class="select-small">${opsiPeran("registrasi")}</select></div>
        <div class="field" id="ak-pos-kotak" hidden><label for="ak-pos">Pos</label>
          <input id="ak-pos" type="number" class="small-input" inputmode="numeric"
            min="1" max="20" disabled></div>
        <button class="button button-primary" id="ak-buat" type="button">Buat Akun</button>
      </div>
      <div class="error" id="ak-galat" hidden></div>
    </div>

    <div class="card">
      <div class="table-toolbar">
        <h2 style="margin:0">Akun</h2>
        <span class="hint">${akun.length} akun</span>
      </div>
      <!-- Peringatan "baru kolom Akun yang mengunci" dihapus di migrasi 0064:
           seluruh policy dan RPC sudah pindah ke boleh(), jadi kalimat itu
           tidak benar lagi. Yang tersisa satu baris, dan ia bertahan karena
           memuat akibat yang tidak bisa dibaca dari layar (CLAUDE.md 9.4):
           mengubah peran MENIMPA centang yang sudah diatur tangan. -->
      <p>Mengganti peran mengisi ulang centangnya.</p>
      <!-- Gaya yang sama dengan lembar Input Nilai Pos: di HP ini TETAP
           tabel dan digeser ke samping, kolom nama menempel di kiri, kepala
           tabel menempel di atas. Semua itu sudah ada di .table-pos —
           matriks ini tidak perlu aturan sendiri. -->
      <div class="table-wrapper table-wrapper-tetap">
      <table class="table data-table table-tetap table-pos matriks-hak">
        <thead><tr>
          <th>Nama akun</th><th>Peran</th><th>Pos</th>
          ${fitur.map(f => `<th class="text-center">${esc(f.nama)}</th>`).join("")}
        </tr></thead>
        <tbody id="ak-tabel">
          ${akun.map(a => `
            <tr data-uid="${esc(a.user_id)}" data-nama="${esc(a.username)}"
                ${a.is_active ? "" : 'class="mati"'}>
              <td><button class="tautan" data-aksi type="button">${esc(a.username)}</button>${
                a.is_active ? "" : ' <span class="badge badge-gray">nonaktif</span>'}</td>
              <td><select class="select-small" data-peran>${opsiPeran(a.peran)}</select></td>
              <td><input type="number" class="small-input" data-pos min="1" max="20" style="width:4.5rem"
                    value="${a.pos ?? ""}" ${a.peran === "juri_pos" ? "" : "disabled"}></td>
              ${fitur.map(f => `
                <td class="text-center"><input type="checkbox" class="checkbox"
                  data-fitur="${esc(f.kode)}"
                  ${punya.has(`${a.user_id}|${f.kode}`) ? "checked" : ""}
                  aria-label="${esc(a.username)} - ${esc(f.nama)}"></td>`).join("")}
            </tr>`).join("")}
        </tbody>
      </table>
      </div>
    </div>
  `));

  const galat = document.getElementById("ak-galat");
  const lapor = (pesan) => { galat.textContent = pesan; galat.hidden = false; };
  const peranBaru = document.getElementById("ak-peran");
  const posBaru = document.getElementById("ak-pos");

  /* Pos hanya milik juri_pos — itu check constraint di database, bukan
     selera. Kotaknya DISEMBUNYIKAN, bukan sekadar dimatikan: kotak mati
     tetap memakan sebaris di layar HP dan tetap mengajukan pertanyaan yang
     jawabannya tidak ada. Yang tidak berlaku sebaiknya tidak terlihat. */
  const posKotak = document.getElementById("ak-pos-kotak");
  const setelPos = () => {
    const perlu = peranBaru.value === "juri_pos";
    posKotak.hidden = !perlu;
    posBaru.disabled = !perlu;
    if (!perlu) posBaru.value = "";
  };
  peranBaru.addEventListener("change", setelPos);
  setelPos();

  /* Nama akun jadi alamat email: `<nama>@ciradyka.com` (worker gateway).
     Jadi yang boleh hanya yang sah di bagian sebelum @ — huruf, angka, dan
     titik — dan titiknya tidak boleh di ujung atau berdempetan.

     Ditolak DI SINI supaya pesannya menyebut apa yang salah. Tanpa ini
     GoTrue yang menolak, dengan kalimat Inggris tentang format email yang
     tidak menyebut kotak mana yang harus dibetulkan. */
  const POLA_NAMA = /^[a-z0-9]+(\.[a-z0-9]+)*$/;
  const namaSah = (t) => POLA_NAMA.test(t);

  async function kirimBuat(daftar, tombol) {
    galat.hidden = true;
    if (tombol.dataset.jalan === "1") return;
    tombol.dataset.jalan = "1"; tombol.disabled = true;
    try {
      const { hasil } = await buatAkun(daftar);
      const jadi = hasil.filter(x => x.ok);
      const gagal = hasil.filter(x => !x.ok);
      if (jadi.length) await tampilkanPassword(`${jadi.length} Akun Dibuat`, jadi);
      if (gagal.length) lapor(gagal.map(x => `${x.username}: ${x.pesan}`).join(" — "));
      if (jadi.length) layarAkun();
    } catch (e) { lapor(e.message); }
    finally { tombol.dataset.jalan = ""; tombol.disabled = false; }
  }

  document.getElementById("ak-buat").addEventListener("click", (ev) => {
    const nama = document.getElementById("ak-nama").value.trim().toLowerCase();
    if (!nama) { lapor("Nama akun wajib diisi."); return; }
    if (!namaSah(nama)) {
      lapor("Nama akun hanya boleh huruf, angka, dan titik — dan titik tidak "
            + "boleh di awal, di akhir, atau berdempetan. Contoh: pos1hrcd37 "
            + "atau aji.furqon.");
      return;
    }
    kirimBuat([{ username: nama, peran: peranBaru.value,
      pos: peranBaru.value === "juri_pos" ? Number(posBaru.value) || null : null }],
      ev.currentTarget);
  });

  const tabel = document.getElementById("ak-tabel");
  // Satu antrean untuk SELURUH matriks, bukan per kotak: dua centang
  // beruntun di baris yang sama harus mendarat urut, dan urutan itulah
  // yang menentukan hak akhirnya.
  let antreHak = Promise.resolve();

  tabel.addEventListener("change", async (ev) => {
    const tr = ev.target.closest("tr");
    galat.hidden = true;

    // Centang: satu kotak = satu baris akun_hak. Dikirim seketika, dan
    // DIKEMBALIKAN kalau ditolak — kotak yang tetap tercentang padahal
    // servernya menolak adalah kebohongan yang baru ketahuan besok.
    //
    // Bentuknya SAMA PERSIS dengan ceklis keberangkatan, dan itu disengaja:
    // diredupkan selagi disimpan (bukan di-disable, lihat .checkbox.saving di
    // style.css), klik beruntun DIANTREKAN bukan diblokir supaya salah
    // centang bisa langsung dibatalkan, dan gagalnya lewat notif() — di tabel
    // yang tergulir ke kanan, tulisan galat di kartu paling atas ada di luar
    // layar.
    if (ev.target.matches("[data-fitur]")) {
      const kotak = ev.target;
      const mau = kotak.checked;
      kotak.classList.add("saving");
      antreHak = antreHak.then(async () => {
        try {
          await setHak(tr.dataset.uid, kotak.dataset.fitur, mau);
        } catch (e) {
          kotak.checked = !mau;
          notif(e.message, true);
        } finally {
          kotak.classList.remove("saving");
        }
      });
      return;
    }

    const peran = tr.querySelector("[data-peran]").value;
    const kotakPos = tr.querySelector("[data-pos]");
    if (ev.target.matches("[data-peran]")) {
      kotakPos.disabled = peran !== "juri_pos";
      if (kotakPos.disabled) kotakPos.value = "";
      else if (!kotakPos.value) { kotakPos.focus(); return; }
    }
    const pos = peran === "juri_pos" ? Number(kotakPos.value) || null : null;
    if (peran === "juri_pos" && !pos) { kotakPos.focus(); return; }
    try {
      await ubahPeranAkun(tr.dataset.uid, peran, pos);
      notif(`${tr.dataset.nama} sekarang ${PERAN_LABEL[peran]}${pos ? ` pos ${pos}` : ""}.`);
      // Kalimat "Mengganti peran mengisi ulang centangnya" di atas tabel itu
      // BENAR — tapi yang mengisinya database (trigger 0077), bukan layar ini,
      // jadi centang yang sedang tergambar sudah basi begitu perannya berganti.
      // Dulu ia baru betul sesudah halamannya dimuat ulang, dan sampai itu
      // terjadi layar memperlihatkan hak peran LAMA untuk peran BARU.
      await segarkanCentangBaris(tr);
    } catch (e) { lapor(e.message); layarAkun(); }
  });

  // Klik NAMA membuka aksi akunnya. Ditaruh di balik nama, bukan sebagai tiga
  // tombol per baris, karena barisnya sudah punya sebelas kotak centang —
  // tombol tambahan di situ akan mendorong matriksnya keluar layar HP.
  /* Centang satu baris dibaca ULANG dari server, bukan ditebak di sini.

     Menyalin isi paket_peran() ke browser akan membuat centangnya muncul
     tanpa satu permintaan pun — dan membuat dua tempat memutuskan hak yang
     sama, yang persis dilarang CLAUDE.md 13.1. Peta itu tinggal di database,
     dipakai trigger 0077 dan paket_peran(); salinan di layar akan benar hari
     ini dan diam-diam salah pada edisi yang menambah satu fitur.

     Harganya satu GET — jauh lebih murah daripada layarAkun(), yang menarik
     ketiga daftarnya sekaligus lalu menggambar ulang seluruh layar. */
  const segarkanCentangBaris = async (tr) => {
    const hak = await daftarHak();
    const punya = new Set(hak.filter(x => x.user_id === tr.dataset.uid)
                             .map(x => x.fitur));
    tr.querySelectorAll("[data-fitur]").forEach(kotak => {
      kotak.checked = punya.has(kotak.dataset.fitur);
    });
  };

  /* Rupa baris "nonaktif": kelas peredup di <tr> dan pil kecil di sebelah
     namanya. Ditulis sekali di sini supaya ia tidak berbeda pendapat dengan
     template di atas — dua tempat yang menggambar keadaan yang sama adalah
     dua tempat yang suatu hari tidak sepakat. */
  const tandaiBarisAktif = (tr, hidup) => {
    tr.classList.toggle("mati", !hidup);
    const sel = tr.querySelector("td");
    sel.querySelector(".badge")?.remove();
    if (!hidup)
      sel.insertAdjacentHTML("beforeend",
        ' <span class="badge badge-gray">nonaktif</span>');
  };

  tabel.addEventListener("click", async (ev) => {
    const tombol = ev.target.closest("[data-aksi]");
    if (!tombol) return;
    const tr = tombol.closest("tr");
    const uid = tr.dataset.uid, nama = tr.dataset.nama;
    const aktif = !tr.classList.contains("mati");
    galat.hidden = true;

    const pilih = await dialog({
      judul: nama,
      bacaSaja: true,
      silangSaja: true,
      kartuHtml: `
        <div class="option-row" style="flex-direction:column;gap:8px;align-items:stretch">
          <button class="button button-primary" data-pilih="password" type="button">Reset Password</button>
          <button class="button button-secondary" data-pilih="nama" type="button">Ubah Nama Akun</button>
          <button class="button button-secondary" data-pilih="aktif" type="button">${
            aktif ? "Nonaktifkan" : "Aktifkan"}</button>
        </div>`,
      pasang: (el, tutup) => el.querySelectorAll("[data-pilih]").forEach(b =>
        b.addEventListener("click", () => tutup(b.dataset.pilih))),
    });
    // Silang di pojok mengembalikan hal yang sama dengan Batal, dan array
    // kosong itu truthy — jadi yang diperiksa jenisnya, bukan kebenarannya.
    if (typeof pilih !== "string") return;

    try {
      if (pilih === "password") {
        const { password } = await resetPasswordAkun(uid);
        await tampilkanPassword(`Password Baru ${nama}`, [{ username: nama, password }]);
        return;
      }
      if (pilih === "nama") {
        const jawab = await dialog({
          judul: `Ubah nama akun ${nama}`,
          kartuHtml: "<p>Mulai sekarang dia login memakai nama yang baru.</p>",
          medan: [{ label: "Nama akun baru", nilai: nama }],
          labelAksi: "Ubah Nama",
        });
        if (jawab === null) return;
        await ubahUsernameAkun(uid, jawab[0]);
      }
      if (pilih === "aktif") {
        if (aktif) {
          const ya = await dialog({
            judul: `Nonaktifkan ${nama}?`,
            kartuHtml: "<p>Dia tidak bisa masuk lagi. Riwayat yang sudah dicatatnya tetap ada.</p>",
            labelAksi: "Nonaktifkan",
          });
          if (ya === null) return;
        }
        await setAktifAkun(uid, !aktif);
        // SATU BARIS yang berubah, jadi satu baris itu yang digambar ulang.
        // layarAkun() menarik ulang ketiga daftarnya, mengganti seluruh isi
        // layar, lalu memindahkan fokus ke kotak "Nama akun" di atas — di
        // tabel 13 akun yang digeser ke samping, posisi gulir mendatar dan
        // baris yang sedang dilihat ikut hilang. Yang berubah dari
        // mengaktifkan cuma dua hal, dan dua-duanya ada di baris ini.
        tandaiBarisAktif(tr, !aktif);
        return;
      }
      layarAkun();
    } catch (e) { lapor(e.message); }
  });

  document.getElementById("ak-nama").focus();
}

/* ============================ RUTE ======================================= */

/* ============================== FOTO JAWABAN ==============================

   Foto lembar jawaban yang diambil DI POS, banyak sekaligus, nomor dadanya
   ditautkan belakangan (migrasi 0074).

   KENAPA LAYAR INI ADA PADAHAL SUDAH ADA TOMBOL KAMERA DI MEJA IT

   Tombol kamera di layar Input Pos memfoto satu regu yang nomor dadanya baru
   saja diketik — fotonya tertaut sendiri, tanpa pekerjaan tambahan, dan itu
   tetap jalur utamanya. Yang tidak bisa dilakukannya: memotret setumpuk
   kertas di pos, sebelum kertas itu berangkat ke meja IT. Migrasi 0047 sendiri
   mengakui lubang itu — "slip yang HILANG DI JALAN antara pos dan meja IT
   tidak pernah difoto sama sekali".

   Harganya jujur: foto borongan tidak tahu nomor dadanya, jadi ia menganggur
   di antrean sampai ada yang menautkannya. Karena itu jumlah yang belum
   tertaut ditampilkan sebagai ANGKA di layar, bukan disembunyikan — antrean
   yang tidak terlihat adalah antrean yang tidak pernah dikerjakan.
   ========================================================================= */
async function layarFoto() {
  if (!EDISI) { layarButuhEdisi("Foto Jawaban"); return; }
  pasangKepala("Foto Jawaban", true);
  LAYAR.replaceChildren(h(pemuat()));

  const layarIni = location.hash;
  const s = sesi();
  let semuaPos;
  try { semuaPos = await daftarPos(); }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarFoto)); return; }
  if (location.hash !== layarIni) return;

  const posDinilai = semuaPos.filter(p => Number(p.jumlah_komponen) > 0);
  if (!posDinilai.length) {
    LAYAR.replaceChildren(h(`<div class="card"><h2>Belum ada pos berpenilaian</h2></div>`));
    return;
  }

  /* Pemilih pos muncul kalau akunnya TIDAK terkunci ke satu pos — dibaca dari
     `sesi().pos`, bukan dari nama perannya. Sejak 0064 yang menentukan hak
     adalah centang di layar Akun (CLAUDE.md 13.1); akun yang diberi centang
     `pos` tanpa peran admin tetap boleh memilih pos selama posnya kosong, dan
     memeriksa nama peran akan mengunci akun itu ke pos pertama diam-diam. */
  const terkunci = s && s.pos != null && s.pos !== "";
  let nomorPos = terkunci ? Number(s.pos) : Number(posDinilai[0].nomor);
  let kodeLomba = null, namaLomba = null;

  LAYAR.replaceChildren(h(`
    <div class="card">
      <div class="baris-pilih">
        <div class="field">
          <label for="foto-pos">Pos</label>
          <select id="foto-pos" class="select-small" ${terkunci ? "disabled" : ""}>
            ${posDinilai.map(p => `<option value="${esc(p.nomor)}"
              ${Number(p.nomor) === nomorPos ? "selected" : ""}
              >${esc(judulPos(p))}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="foto-lomba">Lomba</label>
          <select id="foto-lomba" class="select-small"></select>
        </div>
      </div>
      <div class="action-row" id="foto-aksi" hidden>
        <label class="button button-primary">
          <input type="file" accept="image/*" multiple hidden id="foto-ambil">
          ${ikon("camera")} Pilih foto
        </label>
        <span class="sub" id="foto-kuota"></span>
      </div>
    </div>
    <div class="card">
      <h2>Belum dihubungkan <span class="badge" id="foto-belum">0</span></h2>
      <div class="grid-foto" id="foto-grid"></div>
    </div>
  `));

  const elPos   = document.getElementById("foto-pos");
  const elLomba = document.getElementById("foto-lomba");
  const elAksi  = document.getElementById("foto-aksi");
  const elAmbil = document.getElementById("foto-ambil");
  const elGrid  = document.getElementById("foto-grid");
  const elBelum = document.getElementById("foto-belum");
  const elKuota = document.getElementById("foto-kuota");

  /* ------------------------------------------------------------------------
     SATU PETAK, BUKAN DUA DAFTAR.

     Versi sebelumnya memisahkan antrean unggah (nama berkas + status) dari
     petak foto (gambar + kotak nomor dada). Dua daftar berarti petugas harus
     mencocokkan "IMG_20260221_084512.jpg" dengan salah satu gambar abu-abu di
     bawahnya sendiri — pekerjaan yang tidak pernah diminta siapa pun, di layar
     yang tugasnya justru mencocokkan gambar dengan nomor.

     Sekarang satu ubin per foto, dari detik berkasnya dipilih sampai nomor
     dadanya tersimpan. Namanya tertulis DI BAWAH gambarnya sendiri.

     Ubinnya juga tampil SEBELUM unggahannya selesai, memakai gambar dari
     berkas di HP (object URL). Di sinyal lapangan satu unggahan bisa memakan
     belasan detik, dan petak yang kosong selama itu terbaca seperti "tidak
     terjadi apa-apa".
     --------------------------------------------------------------------- */

  /* Kunci ubin: id foto dari server kalau sudah ada, kunci lokal kalau belum.
     Satu ubin memakai kunci lokal seumur hidupnya supaya kotak nomor dada dan
     kursor yang ada di dalamnya tidak pernah tergambar ulang saat unggahannya
     selesai — itu inti dari perbaikan sebelumnya, dan penyatuan ini tidak
     boleh membatalkannya. */
  let nomorLokal = 0;
  const ubin = new Map();          // kunci -> keadaan ubin
  const dadaDiketik = new Map();   // kunci -> angka yang sudah diketik

  /* jamMenit(), bukan toTimeString(): yang terakhir memakai zona waktu ALAT.
     Laptop meja IT yang zonanya UTC menulis "01:53" untuk foto yang diunggah
     pukul 08:53 WIB — dan di layar ini jam itulah satu-satunya pembeda antara
     dua foto yang gambarnya mirip, karena petugas menautkannya ke nomor dada
     dengan mencocokkan urutan dan waktunya.

     Kosongnya dijaga di sini, bukan diserahkan ke jamMenit(): ia mengembalikan
     "—" untuk nilai kosong, dan ubin bernama "Pukul —" terbaca seperti foto
     yang jamnya hilang, bukan seperti foto yang belum punya jam. */
  const jam = (iso) => (iso ? jamMenit(iso) : "");

  function hitungUbin() {
    elBelum.textContent = String(elGrid.querySelectorAll(".ubin-foto").length);
  }

  /* Nama berkas dipendekkan DI TENGAH, bukan di ujung. "IMG_20260221_084512"
     dan "IMG_20260221_084530" berbeda di enam huruf TERAKHIR, dan potongan
     yang membuang ekornya membuat dua berkas berbeda terbaca sama persis. */
  function namaRingkas(nama) {
    const t = String(nama || "");
    if (t.length <= 22) return t;
    return `${t.slice(0, 11)}…${t.slice(-10)}`;
  }

  function isiUbin(u) {
    const bisaSimpan = u.keadaan === "siap";
    const bisaBatal = u.keadaan === "antre" || u.keadaan === "jalan" || u.keadaan === "gagal";
    const nilai = dadaDiketik.get(u.kunci) ?? "";
    return `
      <div class="ubin-atas">
        <button type="button" class="ubin-gambar" data-lihat
          ${u.url ? `style="background-image:url(&quot;${esc(u.url)}&quot;)"` : ""}
          title="Buka foto">${u.url ? "" : `<span class="keterangan">Lihat</span>`}</button>
        ${bisaBatal ? `
        <button type="button" class="ubin-silang" data-batal
          aria-label="Batalkan ${esc(u.nama || "unggahan")}"
          title="Batalkan">${ikon("x")}</button>` : ""}
      </div>
      <figcaption>
        <span class="f-berkas" title="${esc(u.nama || "")}">${esc(namaRingkas(u.nama))}</span>
        <span class="f-status ${esc(u.keadaan)}">${esc(u.status || "")}</span>
        ${bisaSimpan ? `
          <input type="number" class="small-input" inputmode="numeric" min="1"
                 placeholder="No dada" data-dada aria-label="Nomor dada"
                 value="${esc(String(nilai))}">
          <button type="button" class="button button-mini button-primary"
                  data-taut>Simpan</button>` : ""}
        ${u.keadaan === "gagal" ? `
          <button type="button" class="button button-mini" data-ulang>Ulangi</button>` : ""}
      </figcaption>`;
  }

  /** Gambar ulang SATU ubin, bukan seluruh petak.
   *
   *  Kotak nomor dada di ubin lain — beserta angka dan kursor di dalamnya —
   *  tidak boleh ikut tersentuh hanya karena satu unggahan selesai. */
  function perbarui(u) {
    const pilih = `[data-kunci="${CSS.escape(u.kunci)}"]`;
    let el = elGrid.querySelector(pilih);
    if (!el) {
      /* Elemennya DICARI LAGI dari DOM sesudah append, tidak dipegang dari
         hasil h().

         h() mengembalikan DocumentFragment (util.js). Begitu di-append,
         seluruh isinya PINDAH ke DOM dan fragmennya tinggal cangkang kosong —
         dan menulis `innerHTML` ke DocumentFragment tidak melempar galat apa
         pun, ia cuma memasang properti yang tidak dibaca siapa-siapa. Yang
         terlihat di layar: ubin kosong selamanya, tanpa satu baris pun di
         konsol. */
      elGrid.append(h(`<figure class="ubin-foto" data-kunci="${esc(u.kunci)}"></figure>`));
      el = elGrid.querySelector(pilih);
      if (!el) return;
      pengamat.observe(el);
    }
    el.dataset.keadaan = u.keadaan;
    if (u.path) el.dataset.path = u.path;
    if (u.fotoId) el.dataset.id = u.fotoId;

    // Kotak yang sedang diketik JANGAN dibongkar: menggantinya di tengah
    // ketikan memindahkan kursor ke ujung dan menutup papan ketik di HP.
    const sedangDiketik = el.contains(document.activeElement)
      && document.activeElement.matches("[data-dada]");
    if (sedangDiketik) {
      const st = el.querySelector(".f-status");
      if (st) { st.textContent = u.status || ""; st.className = `f-status ${u.keadaan}`; }
      return;
    }
    el.innerHTML = isiUbin(u);
  }

  /* Thumbnail dari server diambil saat ubinnya masuk layar, bukan dua ratus
     link bertanda tangan sekaligus di awal. Satu pengamat untuk seumur
     layar. */
  const pengamat = new IntersectionObserver((masuk) => {
    for (const e of masuk) {
      if (!e.isIntersecting) continue;
      pengamat.unobserve(e.target);
      const u = ubin.get(e.target.dataset.kunci);
      if (u && !u.url && u.path) gambarUbin(u);
    }
  }, { rootMargin: "200px" });
  putusSaatPindah(sinyalLayarBaru(), pengamat);

  async function gambarUbin(u) {
    try {
      const url = await tautanFoto(u.path);
      if (!url) return;
      u.url = url;
      const tombol = elGrid.querySelector(`[data-kunci="${CSS.escape(u.kunci)}"] .ubin-gambar`);
      if (tombol) {
        tombol.style.backgroundImage = `url("${url}")`;
        const ket = tombol.querySelector(".keterangan");
        if (ket) ket.remove();
      }
    } catch { /* Ubin tanpa gambar tetap bisa diberi nomor — itu yang penting. */ }
  }

  async function isiLomba() {
    /* Pilihan lomba TIDAK diganti jadi "memuat…". Mengganti isi <select>
       berarti pilihan yang sedang terbaca hilang sekejap lalu muncul lagi,
       dan di HP itu terlihat seperti dropdown yang salah tekan sendiri.
       Selagi dimuat ia cuma dimatikan; yang berputar ada di petak di
       bawahnya, tempat isinya memang sedang berubah. */
    elLomba.disabled = true;
    elPos.disabled = true;
    elGrid.replaceChildren(h(pemuat()));
    let komponen;
    try { komponen = await komponenPos(EDISI.nomor, nomorPos); }
    catch (e) {
      elLomba.disabled = false; elPos.disabled = terkunci;
      notif(`Lomba pos ${nomorPos} tidak terbaca: ${e.message}`, true);
      return;
    }
    const lomba = kelompokLomba(kolomPos(komponen));
    elLomba.innerHTML = lomba.map(l =>
      `<option value="${esc(l.kode)}">${esc(l.nama)}</option>`).join("");
    kodeLomba = lomba.length ? lomba[0].kode : null;
    namaLomba = lomba.length ? lomba[0].nama : null;
    elAksi.hidden = !kodeLomba;
    elLomba.disabled = false;
    elPos.disabled = terkunci;
    await muatBelum({ bersihkan: true });
  }

  /** Foto yang sudah di server tapi belum bernomor dada.
   *
   *  MENAMBAH, tidak menggambar ulang: ubin yang sudah ada dibiarkan apa
   *  adanya, beserta angka yang sedang diketik di dalamnya. Yang hilang dari
   *  daftar server juga tidak dibuang dari layar — satu-satunya cara sebuah
   *  ubin pergi adalah kita sendiri berhasil menyimpannya. */
  async function muatBelum({ bersihkan = false } = {}) {
    if (!kodeLomba) return;
    if (bersihkan) {
      // Ganti pos atau lomba: isinya memang himpunan yang berbeda.
      for (const u of ubin.values()) if (u.url && u.lokal) URL.revokeObjectURL(u.url);
      ubin.clear();
      dadaDiketik.clear();
      // Pemutar, bukan tulisan. Yang sedang terjadi selalu sama — sedang
      // dimuat — jadi kata yang mengatakannya tidak menambah apa pun, dan di
      // layar yang dipakai ratusan kali per shift ia terbaca berulang-ulang.
      elGrid.replaceChildren(h(pemuat()));
    }
    let daftar;
    try { daftar = await daftarFotoBelumTaut(nomorPos, kodeLomba); }
    catch (e) {
      if (bersihkan) elGrid.replaceChildren(h(`<p class="keterangan">${esc(e.message)}</p>`));
      else notif(`Daftar foto tidak terbaca: ${e.message}`, true);
      return;
    }

    // Pemutar dibuang begitu daftarnya sampai.
    const pemutar = elGrid.querySelector(".pemuat");
    if (pemutar) pemutar.remove();
    const kosong = elGrid.querySelector(".keterangan");
    if (kosong) kosong.remove();

    const sudahDiUbin = new Set([...ubin.values()].map(u => u.fotoId).filter(Boolean));
    for (const f of daftar) {
      if (sudahDiUbin.has(f.id)) continue;
      const u = {
        kunci: f.id, fotoId: f.id, path: f.path, url: null, lokal: false,
        nama: `Pukul ${jam(f.diunggah_pada)}`,
        status: ukuranRapi(f.ukuran_bytes || 0), keadaan: "siap",
      };
      ubin.set(u.kunci, u);
      perbarui(u);
    }

    hitungUbin();
    if (!elGrid.querySelector(".ubin-foto")) {
      elGrid.replaceChildren(h(`<p class="keterangan">Tidak ada.</p>`));
    }
  }

  elPos.addEventListener("change", async () => {
    nomorPos = Number(elPos.value);
    await isiLomba();
  });
  elLomba.addEventListener("change", async () => {
    kodeLomba = elLomba.value;
    namaLomba = elLomba.options[elLomba.selectedIndex].textContent.trim();
    await muatBelum({ bersihkan: true });
  });

  // Tiap ketukan disimpan. Bukan saat kotaknya ditinggalkan: petugas berpindah
  // dari kotak ke kamera, dan `blur` yang tidak pernah terjadi berarti angka
  // yang tidak pernah tersimpan.
  elGrid.addEventListener("input", (e) => {
    const inp = e.target.closest("[data-dada]");
    if (!inp) return;
    const kunci = inp.closest(".ubin-foto").dataset.kunci;
    if (inp.value === "") dadaDiketik.delete(kunci); else dadaDiketik.set(kunci, inp.value);
  });

  elGrid.addEventListener("click", async (e) => {
    const el = e.target.closest(".ubin-foto");
    if (!el) return;
    const u = ubin.get(el.dataset.kunci);
    if (!u) return;

    /* Silang. Ia hanya ADA selagi fotonya belum sampai di server — sesudah
       itu tidak ada yang bisa dibatalkan: bucket `lembar` tidak punya policy
       hapus sama sekali, dan itu disengaja sejak 0047 ("tombol hapus pada
       backup adalah cara backup itu hilang"). */
    if (e.target.closest("[data-batal]")) {
      u.keadaan = "batal";
      if (u.url && u.lokal) URL.revokeObjectURL(u.url);
      ubin.delete(u.kunci);
      el.remove();
      hitungUbin();
      if (!elGrid.querySelector(".ubin-foto")) {
        elGrid.replaceChildren(h(`<p class="keterangan">Tidak ada.</p>`));
      }
      return;
    }

    if (e.target.closest("[data-ulang]")) {
      await kerjakan(u);
      return;
    }

    if (e.target.closest("[data-lihat]")) {
      // Jendelanya dibuka SEBELUM await. Dibuka sesudahnya, browser HP
      // menganggapnya popup yang tidak diminta pengguna dan memblokirnya.
      const jendela = window.open("", "_blank");
      try {
        const url = u.url || (u.path ? await tautanFoto(u.path) : null);
        if (jendela && url) jendela.location = url; else if (jendela) jendela.close();
      } catch (err) {
        if (jendela) jendela.close();
        notif(`Foto tidak bisa dibuka: ${err.message}`, true);
      }
      return;
    }

    const taut = e.target.closest("[data-taut]");
    if (!taut) return;
    const isian = el.querySelector("[data-dada]");
    const dada = Number(isian.value);
    if (!Number.isInteger(dada) || dada <= 0) {
      notif("Nomor dada harus angka.", true);
      isian.focus();
      return;
    }
    taut.disabled = true;
    try {
      await tautkanFoto(u.fotoId, dada, "tangan");
      notif(`Foto tersimpan untuk ${dada3(dada)}.`);
      dadaDiketik.delete(u.kunci);
      if (u.url && u.lokal) URL.revokeObjectURL(u.url);
      ubin.delete(u.kunci);
      el.remove();
      hitungUbin();
      if (!elGrid.querySelector(".ubin-foto")) {
        elGrid.replaceChildren(h(`<p class="keterangan">Tidak ada.</p>`));
      }
    } catch (err) {
      taut.disabled = false;
      notif(`Gagal menyimpan: ${err.message}`, true);
    }
  });

  /** Ukuran ASLI -> ukuran terkirim, ditulis di ubinnya.
   *
   *  Bukan hiasan. Pengecilan di HP adalah satu-satunya yang menjaga kuota
   *  1 GB tetap cukup untuk ~5.500 foto (migrasi 0047), dan kalau ia gagal
   *  diam-diam di satu merek HP, yang ketahuan cuma "kuota habis di tengah
   *  acara". Angka sebelum-sesudah membuat kegagalan itu terlihat pada foto
   *  PERTAMA. */
  const hemat = (asli, jadi) => `${ukuranRapi(asli)} → ${ukuranRapi(jadi)}`;

  async function kerjakan(u) {
    if (!ubin.has(u.kunci)) return;          // sudah dibatalkan
    u.keadaan = "jalan";
    try {
      u.status = "mengecilkan…"; perbarui(u);
      const blob = await kecilkanFoto(u.berkas);
      if (!ubin.has(u.kunci)) return;

      /* Pagar terakhir sebelum jaringan dipakai. Bucket menolak apa pun di
         atas 1 MB, dan penolakan itu datang sebagai galat HTTP yang tidak
         menjelaskan apa-apa ke petugas. */
      if (blob.size > 1024 * 1024) {
        throw new Error(`masih ${ukuranRapi(blob.size)}, di atas batas 1 MB`);
      }

      u.status = `mengirim ${hemat(u.berkas.size, blob.size)}…`; perbarui(u);
      const hasil = await unggahFotoMasuk(u.pos, u.kode, u.nama_lomba, blob);
      if (!ubin.has(u.kunci)) return;

      u.fotoId = hasil.id;
      u.path = hasil.path;
      u.keadaan = "siap";
      u.status = hemat(u.berkas.size, blob.size);
    } catch (err) {
      u.keadaan = "gagal";
      u.status = err.message;
    }
    perbarui(u);
    hitungUbin();
  }

  elAmbil.addEventListener("change", async () => {
    const berkas = [...(elAmbil.files || [])];
    // Dikosongkan supaya memilih berkas YANG SAMA lagi tetap memicu change.
    elAmbil.value = "";
    if (!berkas.length || !kodeLomba) return;

    const kosong = elGrid.querySelector(".keterangan");
    if (kosong) kosong.remove();

    const baru = [];
    for (const f of berkas) {
      const u = {
        kunci: `lokal-${++nomorLokal}`, fotoId: null, path: null, lokal: true,
        url: URL.createObjectURL(f), berkas: f, nama: f.name || "foto",
        status: "menunggu…", keadaan: "antre",
        pos: nomorPos, kode: kodeLomba, nama_lomba: namaLomba,
      };
      ubin.set(u.kunci, u);
      baru.push(u);
      perbarui(u);
    }
    hitungUbin();

    // Satu per satu, bukan serentak. Unggahan paralel dari HP di sinyal
    // lapangan saling menggerus dan menabrak batas waktu bersama-sama.
    for (const u of baru) if (ubin.has(u.kunci)) await kerjakan(u);

    await muatBelum();
    try {
      const k = await kuotaFoto();
      if (k) elKuota.textContent =
        `${k.jumlah_foto} foto · ${ukuranRapi(k.total_bytes || 0)} terpakai`;
    } catch { /* Kuota cuma keterangan; gagal membacanya tidak menghalangi apa pun. */ }
  });

  await isiLomba();
}

const RUTE = {
  "#/home": layarHome,
  "#/foto": layarFoto,
  "#/data-peserta": layarDataPeserta,
  "#/pembayaran": layarPembayaran,
  "#/daftar-ulang": layarDaftarUlang,
  "#/cetak-kloter": layarCetakKloter,
  "#/keberangkatan": layarKeberangkatan,
  "#/finish": layarFinish,
  "#/pos": layarInputPos,
  "#/live-score": layarLiveScore,
  "#/pengaturan-kloter": layarPengaturanKloter,
  "#/ganti-password": layarGantiPassword,
  "#/account": layarAkun,
};

// Hash yang benar-benar sedang tergambar. `location.hash` sudah berisi tujuan
// baru ketika hashchange tiba, jadi nilai lama harus disimpan terpisah agar
// perpindahan yang dibatalkan dapat dikembalikan tanpa membuang tabel.
let hashLayar = location.hash;

async function arahkan() {
  const tujuan = location.hash;
  if (tujuan !== hashLayar && !bolehMeninggalkanNilai()) {
    // replaceState tidak memicu hashchange kedua dan tidak menambah entri Back
    // palsu. DOM layar lama belum disentuh pada titik ini.
    history.replaceState(null, "", hashLayar || "#/home");
    return;
  }
  document.getElementById("cetakan")?.remove();
  hashLayar = tujuan;
  segarkanDiTempat = null;
  // Pendengar window dan pengamat milik layar yang ditinggalkan dilepas di
  // sini, bukan diserahkan ke layar berikutnya: layar tujuan boleh saja tidak
  // memasang apa pun, dan yang lama tetap harus pergi.
  pengendaliLayar.abort();
  if (!sesi()) { layarLogin(); return; }
  // Profil operasional dan centang hak bisa diubah admin saat petugas masih
  // login. Segarkan sekali per boot agar UI tidak memakai peran/pos lama;
  // panggilan navigasi berikutnya langsung kembali.
  await lengkapiHakSesi();
  if (!EDISI) {
    try { EDISI = await infoEdisi(); }
    catch (e) { layarButuhEdisi("Sistem Panitia"); return; }
  }
  // Alamat lamanya `#/akun`, dan itu masih duduk di riwayat browser dan
  // bookmark panitia. Dialihkan, bukan didiamkan: rute yang tidak dikenal
  // jatuh ke layar Home, jadi tautan lama akan membuka layar yang SALAH
  // tanpa satu pun pesan — kegagalan yang paling sulit dilaporkan orang,
  // karena layarnya terlihat baik-baik saja. Mengganti hash memicu
  // hashchange, jadi fungsi ini berjalan sekali lagi; `return` menahannya
  // supaya layarnya tidak digambar dua kali.
  if (location.hash === "#/akun") { location.hash = "#/account"; return; }
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
const keAkun = () => {
  if (location.hash === "#/account") arahkan(); else location.hash = "#/account";
};
const keluarSekarang = () => {
  if (!bolehMeninggalkanNilai()) return;
  // Peringatan sudah dijawab di atas; samakan penanda agar arahkan() tidak
  // menanyakan hal yang sama untuk kedua kali setelah sesi dibuang.
  hashLayar = "";
  keluar(); EDISI = null; location.hash = ""; arahkan();
};

document.getElementById("btn-keluar").addEventListener("click", keluarSekarang);
document.getElementById("btn-home").addEventListener("click", keHome);
document.getElementById("nav-home").addEventListener("click", keHome);
document.getElementById("nav-setting").addEventListener("click", keSetelan);
document.getElementById("btn-akun").addEventListener("click", keAkun);
document.getElementById("nav-akun").addEventListener("click", keAkun);
document.getElementById("nav-keluar").addEventListener("click", keluarSekarang);
document.getElementById("ganti-password").addEventListener("click", keSetelan);
window.addEventListener("hashchange", arahkan);
window.addEventListener("afterprint", () => {
  document.getElementById("cetakan")?.remove();
});

/* TIDAK ADA yang menyegarkan sendiri saat tab kembali terlihat.

   Dulu `visibilitychange` menggambar ulang layarnya — dan itu memindahkan
   tombol tepat sebelum jempol turun, mengembalikan chip kloter ke pilihan
   awal, dan melempar gulirannya ke atas. Ketiga pengaman yang menjaganya
   (isian sedang difokus, dialog terbuka, nilai belum tersimpan) semuanya
   meleset di kejadian yang paling sering: layar yang sedang DITUNGGUI, bukan
   sedang diketik.

   Harganya disebut supaya tidak jadi kejutan: layar yang lama ditinggal bisa
   menampilkan angka lama. Yang menutupinya tombol muat ulang di tiap layar.

   Yang TETAP jalan cuma pembaruan DI TEMPAT — Input Pos dan Rekapitulasi
   mengganti isi sel tanpa membangun ulang apa pun, jadi tidak ada tombol yang
   berpindah dan gulirannya tidak bergerak. Itu bukan yang dikeluhkan, dan
   melepasnya akan mematikan lembar pos yang dibuka di beberapa HP sekaligus.

   Pemanggilan di bawah ini WAJIB ada, bukan kerapian: denyut kedua layar itu
   menghentikan dirinya sendiri saat `document.hidden`, dan `segarkanDiTempat`
   satu-satunya yang menyalakannya lagi. Tanpa baris ini, pembaruan otomatis
   mati permanen sesudah petugas berpindah tab sekali. */
document.addEventListener("visibilitychange", () => {
  if (document.hidden || !sesi()) return;
  if (segarkanDiTempat) segarkanDiTempat();
});

/** Baris lembar pos yang isinya belum sampai ke database. */
const adaYangBelumTersimpan = () => !!document.querySelector(
  '#isi-tabel tr[data-keadaan="belum"], #isi-tabel tr[data-keadaan="gagal"]');

const bolehMeninggalkanNilai = () => !adaYangBelumTersimpan()
  || window.confirm("Ada nilai yang belum tersimpan. Tetap pindah layar?");

// Menutup tab dengan nilai yang belum terkirim = nilai itu hilang tanpa
// jejak. Browser hanya mengizinkan peringatan bawaannya, dan itu sudah cukup:
// yang dibutuhkan cuma satu jeda sebelum tab-nya benar-benar tertutup.
window.addEventListener("beforeunload", (e) => {
  if (!adaYangBelumTersimpan()) return;
  e.preventDefault();
  e.returnValue = "";
});

arahkan();
