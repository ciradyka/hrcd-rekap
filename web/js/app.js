/* ============================================================================
   hrcd-rekap : app.js — aplikasi panitia (tahap 2).
   Aturan bentuk (rancangan-b.md 10.1): kerangka sama di semua layar,
   satu aksi utama per layar, kunci di-autofocus, echo-confirm sebelum simpan,
   "baris terakhir" di kaki, gagal itu nyaring dan lokal.

   Semua teks dari luar (nama sekolah/regu/ketua, pesan server) WAJIB lewat
   esc() atau tag html`` — lihat util.js.

   DI MANA SEBUAH LAYAR TINGGAL
     app.js          layar masuk, penampil foto, router (RUTE, arahkan) dan
                     tombol-tombol kepala. Hanya itu.
     screens/*.js    satu modul per layar, dinamai seperti judul layarnya:
                     cek-nilai.js, pembayaran.js, input-nilai-tabel.js, ...
                     Mencari layar dari alamatnya: lihat RUTE di bawah.
     common/*.js     yang dipakai dua layar atau lebih: frame.js (kerangka,
                     keadaan sesi, chip, alat tabel), nilai-pos.js (layar
                     penilaian dan antrean nilai), riwayat-pendaftaran.js.
     util.js, api.js alat umum dan semua panggilan ke server, bersama situs
                     peserta (live/ menyimpan salinannya).

   Arah import hanya satu: app.js mengimpor screens/ dan common/, screens/
   mengimpor common/, dan common/ tidak mengimpor keduanya. Kalau sebuah
   layar butuh sesuatu dari layar lain, tempat benda itu di common/.
   ========================================================================== */

import { sesi, masuk, keluar, ErrorApi, infoEdisi, lengkapiHakSesi,
         daftarPanitia } from "./api.js";
import { esc, h, notif, ikon } from "./util.js";
import { aturEdisi, aturHashLayar, aturRouter, aturSegarkanDiTempat, EDISI,
         hashLayar, LAYAR, layarButuhEdisi, pangkalRute, pasangKepala,
         pengendaliLayar, segarkanDiTempat } from "./common/frame.js";
import { antreanTertunda, kirimAntrean } from "./common/nilai-pos.js";
import { layarCekNilai } from "./screens/cek-nilai.js";
import { layarInputPos } from "./screens/input-nilai-tabel.js";
import { layarInputPos2 } from "./screens/input-nilai-lomba.js";
import { layarLiveScore } from "./screens/live-score.js";
import { layarBukuSakti } from "./screens/buku-sakti.js";
import { layarPembayaran } from "./screens/pembayaran.js";
import { layarDaftarUlang } from "./screens/daftar-ulang.js";
import { layarDataPeserta } from "./screens/data-peserta.js";
import { layarCetakKloter } from "./screens/daftar-kloter.js";
import { layarKeberangkatan } from "./screens/keberangkatan.js";
import { layarFinish } from "./screens/kedatangan.js";
import { layarPengaturanKloter } from "./screens/kalkulator-keberangkatan.js";
import { layarHome } from "./screens/home.js";
import { layarFoto } from "./screens/foto-jawaban.js";
import { layarKejuaraan } from "./screens/kejuaraan.js";
import { layarAkun } from "./screens/akun.js";
import { layarGantiPassword } from "./screens/ganti-password.js";

// Header dan menu bawah masih berupa HTML statis agar label dan tujuan
// navigasinya tersedia sejak awal. Jalur SVG-nya tetap punya satu sumber di
// util.js; keduanya tersembunyi sampai ikon ini terpasang.
document.querySelectorAll("[data-ikon]").forEach((tempat) => {
  tempat.replaceChildren(h(ikon(tempat.dataset.ikon)));
});

/* ============================ LOGIN ===================================== */

function layarLogin(pesan) {
  pasangKepala("Sistem Panitia");
  /* .blok-masuk — Dibungkus supaya HILANG saat pendaftaran dibuka. Dua formulir
     bertumpuk di satu kartu — dua kotak Password, dua tombol hijau —
     adalah cara orang mengisi yang bawah lalu menekan yang atas. */
  /* #ganti-mode — BUKAN <details>, dan itu keputusan yang dibayar sekali.
     <details> menyembunyikan isinya sendiri sebelum CSS sempat ikut
     campur, jadi tidak ada yang bisa dianimasikan: isinya lenyap dan
     muncul seketika. Dengan tombol dan kelas biasa, kedua blok tetap
     ada di DOM dan tingginya bisa dijalankan pelan.

     Harganya: keadaannya sekarang disimpan di kelas "mode-daftar" pada
     kartunya, bukan di atribut bawaan browser. Satu tempat, dan tombol
     di bawah ini satu-satunya yang mengubahnya. */
  /* #d-peran — KOORDINATOR POS TIDAK ADA DI SINI, seperti admin. Keduanya
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
     diubah dari devtools dalam sepuluh detik. */
  /* .keterangan — Satu kalimat, dan ia membawa fakta yang TIDAK bisa dibaca
     dari layar: akunnya belum hidup. Tanpa ini orang mendaftar, mencoba masuk,
     gagal, lalu mendaftar lagi dengan nama lain (bagian 9.4). */
  LAYAR.replaceChildren(h(`
    <div class="card" style="max-width:480px;margin:2rem auto">
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
      aturEdisi(null);
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
      .then(e => { aturEdisi(e); if (!sesi()) pasangKepala("Sistem Panitia"); })
      .catch(() => {});
  }
}

/* ============================================================================
   FOTO SLIP DIBUKA BESAR, DAN IKUT SUDUT PUTARNYA.

   Sudut putar disimpan per foto (migrasi 0167) dan DITERAPKAN CSS — berkasnya
   sendiri tidak pernah disentuh. Itu keputusan yang benar: memutar berkasnya
   berarti mengkompres ulang bukti setiap kali ada yang salah tekan.

   Akibatnya satu hal yang tidak ikut dipikirkan: petaknya tegak, tetapi
   `<a href>` di dalamnya menyerahkan BERKAS ASLI ke browser, dan berkas asli
   masih miring. Jadi petugas memutar fotonya, mengetuknya untuk membaca
   tulisan tangannya lebih besar, dan mendapat gambar melintang lagi.
   Dilaporkan begitu, 2 September 2026.

   Yang dilakukan: ketukannya dibelokkan ke penampil di dalam aplikasi, yang
   memasang sudut yang sama dengan petaknya. Tab baru sekalian hilang — dan
   itu memang sudah lama diinginkan di layar ini: sembilan foto berarti
   sembilan tab, dan sembilan kali menekan "kembali" di HP.

   Ctrl/Cmd/Shift-klik tetap dibiarkan lewat, jadi yang memang mau membuka
   berkas aslinya di tab sendiri masih bisa. `target="_blank"` di markup-nya
   juga tetap: kalau JS layar ini gagal dimuat, ketukannya kembali membuka
   berkasnya — miring, tapi ada.
   ========================================================================== */

/** Satu foto sebesar layar, dengan sudut putar yang tersimpan. */
function bukaFotoPenuh(url, putaran, judul) {
  document.querySelector(".lihat-foto")?.remove();
  /* .lihat-bingkai — Silangnya duduk di dalam BINGKAI, bukan langsung di
     penampil. Penampilnya memenuhi layar, jadi tombol yang menempel padanya
     mendarat di pojok LAYAR — jauh dari gambarnya, dan di layar lebar jaraknya
     bisa setengah meja. Bingkai ini diberi ukuran gambar yang TERLIHAT oleh
     ukurBingkai() di bawah, jadi pojoknya adalah pojok gambar. */
  document.body.appendChild(h(`
    <div class="lihat-foto" role="dialog" aria-modal="true"
         aria-label="${esc(judul || "Foto")}">
      <div class="lihat-bingkai">
        <button type="button" class="lihat-tutup" aria-label="Tutup">&times;</button>
        <img src="${esc(url)}" alt="${esc(judul || "")}"
             data-putar="${esc(String(Number(putaran) || 0))}">
      </div>
    </div>`));
  const el = document.body.lastElementChild;
  /* SATU pengendali untuk semua pendengarnya, bukan removeEventListener satu
     per satu: keduanya menempel di luar `el`, jadi membuang elemennya saja
     meninggalkan mereka hidup. Bentuk ini juga yang dituntut penjaga di
     tests/screen_listener_cleanup.test.mjs — pendengar `document` dan
     `window` di dalam fungsi selalu membawa signal. */
  const pengendali = new AbortController();
  const { signal } = pengendali;
  function tutup() { el.remove(); pengendali.abort(); }

  /* UKURAN BINGKAI DIHITUNG, tidak diserahkan ke CSS. Dulu bingkainya
     menyusut mengikuti kotak <img>, dan kotak itu bukan gambarnya:
     - `object-fit: contain` menaruh pita hitam DI DALAM kotak <img>, jadi
       silangnya mendarat di pojok pita itu, jauh dari slipnya, dan ketukan
       di pita hitam tidak menutup penampil karena yang terketuk <img>-nya;
     - `rotate()` tidak mengubah kotak tata letak, jadi slip yang diputar 90
       derajat di HP masih diukur selebar aslinya, meluap keluar bingkai dari
       tepi kirinya, dan terpotong di kanan.
     Di sini ukurannya diambil dari piksel asli gambar. Untuk 90 dan 270
     sumbunya ditukar lebih dulu: yang tampil di layar selebar tinggi
     aslinya. Bingkai mendapat ukuran yang TERLIHAT, <img> mendapat ukuran
     aslinya yang diperkecil, lalu CSS memutarnya dari titik tengah bingkai.
     Gambarnya tidak pernah diperbesar melebihi ukuran aslinya. */
  const bingkai = el.querySelector(".lihat-bingkai");
  const img = el.querySelector("img");
  const tukarSumbu = ["90", "270"].includes(img.dataset.putar);
  function ukurBingkai() {
    if (!img.naturalWidth) return;
    const gaya = getComputedStyle(el);
    const ruangLebar = el.clientWidth - parseFloat(gaya.paddingLeft) - parseFloat(gaya.paddingRight);
    const ruangTinggi = el.clientHeight - parseFloat(gaya.paddingTop) - parseFloat(gaya.paddingBottom);
    const lebarTampil = tukarSumbu ? img.naturalHeight : img.naturalWidth;
    const tinggiTampil = tukarSumbu ? img.naturalWidth : img.naturalHeight;
    const skala = Math.min(1, ruangLebar / lebarTampil, ruangTinggi / tinggiTampil);
    bingkai.style.width = `${lebarTampil * skala}px`;
    bingkai.style.height = `${tinggiTampil * skala}px`;
    img.style.width = `${img.naturalWidth * skala}px`;
    img.style.height = `${img.naturalHeight * skala}px`;
    img.classList.add("terukur");
  }
  // Fotonya biasanya sudah ada di cache (petak kecilnya memakai berkas yang
  // sama), jadi ia bisa sudah selesai dimuat sebelum pendengar ini terpasang.
  img.addEventListener("load", ukurBingkai, { signal });
  window.addEventListener("resize", ukurBingkai, { signal });
  ukurBingkai();

  el.addEventListener("click", (e) => {
    /* Gambarnya sendiri TIDAK menutup. Di HP jari mendarat di tengah layar
       saat hendak mencubit untuk memperbesar, dan penampil yang tertutup oleh
       cubitan pertama tidak bisa dipakai membaca tulisan tangan — yang justru
       satu-satunya alasan foto ini dibuka. */
    if (e.target === el || e.target.closest(".lihat-tutup")) tutup();
  }, { signal });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") tutup();
  }, { signal });
  // Pindah layar menutupnya, alasan yang sama dengan dialog(): penampil ini
  // menempel di <body>, jadi LAYAR.replaceChildren() tidak membawanya pergi.
  window.addEventListener("hashchange", tutup, { signal });
}

/* Satu pendengar untuk KETIGA petak foto — lembar pos, Input Nilai Pos v2,
   dan Cek Nilai. Ketiganya membungkus tautannya dengan elemen ber-`data-putar`,
   jadi sudutnya dibaca dari sana; markup ketiganya tidak perlu diubah sama
   sekali. */
document.addEventListener("click", (e) => {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const taut = e.target.closest("a.fg-buka, a.fg-petak, a.foto-tautan");
  const url = taut && taut.getAttribute("href");
  if (!url) return;
  e.preventDefault();
  const wadah = taut.closest("[data-putar]");
  bukaFotoPenuh(url, wadah ? wadah.dataset.putar : 0, taut.getAttribute("title") || "");
});

/* EMPAT PEMICU, dan semuanya perlu — masing-masing menutup keadaan yang tiga
   lainnya tidak bisa. Putaran 15 detik menghentikan dirinya saat tab
   tersembunyi: di sana ia dicekik jadi sekali semenit lalu dibekukan, jadi
   yang tersisa cuma membakar baterai. `visibilitychange` yang menyalakannya
   kembali — dan ia menyantol di pendengar yang sudah ada, yang memang tidak
   menggambar ulang apa pun. */
window.addEventListener("online", () => kirimAntrean());
setInterval(() => { if (!document.hidden) kirimAntrean(); }, 15000);

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
  "#/pos2": layarInputPos2,
  "#/cek-nilai": layarCekNilai,
  "#/live-score": layarLiveScore,
  "#/kejuaraan": layarKejuaraan,
  "#/pengaturan-kloter": layarPengaturanKloter,
  "#/ganti-password": layarGantiPassword,
  "#/account": layarAkun,
  // Berbuntut kode bab: `#/buku-sakti/seksi`. Itu yang membuat satu bab
  // bisa disebut di grup panitia sebagai alamat, bukan sebagai
  // "buka Buku Sakti lalu ketuk tab ketiga".
  "#/buku-sakti": layarBukuSakti,
};

async function arahkan() {
  const tujuan = location.hash;
  if (tujuan !== hashLayar && !bolehMeninggalkanNilai()) {
    // replaceState tidak memicu hashchange kedua dan tidak menambah entri Back
    // palsu. DOM layar lama belum disentuh pada titik ini.
    history.replaceState(null, "", hashLayar || "#/home");
    return;
  }
  document.getElementById("cetakan")?.remove();
  aturHashLayar(tujuan);
  aturSegarkanDiTempat(null);
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
    try { aturEdisi(await infoEdisi()); }
    catch (e) {
      /* BUKU SAKTI LEWAT, layar lain tidak.

         Setiap layar lain menggambar data edisi — biaya, jam berangkat, nama
         edisi di kepala tabel — jadi tanpa baris edisi yang tergambar cuma
         angka yang salah. Buku Sakti tidak membaca satu baris data pun:
         isinya berkas statis yang sudah ikut termuat bersama app.js.

         Dan justru di sinilah ia paling dibutuhkan. Sinyal mati di pos,
         Supabase tidak terjangkau, dan yang dicari orang adalah halaman yang
         mengatakan apa yang harus dikerjakan. Menahannya di balik pagar ini
         membuat buku panduan menghilang tepat pada keadaan yang paling
         membutuhkannya — dan janji itu tertulis di kepala buku-sakti.mjs,
         jadi tanpa baris ini janjinya bohong. */
      if (pangkalRute(location.hash) !== "#/buku-sakti") {
        layarButuhEdisi("Sistem Panitia"); return;
      }
    }
  }
  // Alamat lamanya `#/akun`, dan itu masih duduk di riwayat browser dan
  // bookmark panitia. Dialihkan, bukan didiamkan: rute yang tidak dikenal
  // jatuh ke layar Home, jadi tautan lama akan membuka layar yang SALAH
  // tanpa satu pun pesan — kegagalan yang paling sulit dilaporkan orang,
  // karena layarnya terlihat baik-baik saja. Mengganti hash memicu
  // hashchange, jadi fungsi ini berjalan sekali lagi; `return` menahannya
  // supaya layarnya tidak digambar dua kali.
  if (location.hash === "#/akun") { location.hash = "#/account"; return; }
  (RUTE[pangkalRute(location.hash)] || layarHome)();
}

// EMPAT aksi yang sama dipasang di DUA tempat: tombol header (layar lebar)
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
/* Menuju Buku Sakti dari mana pun. `pangkalRute()` dipakai, bukan hash utuh:
   alamatnya berbuntut kode bab, jadi `#/buku-sakti/seksi` juga sudah "sedang
   di Buku Sakti" — dan tombolnya harus menggambar ulang di tempat, bukan
   melempar pembaca kembali ke bab pertama. */
const keBuku = () => {
  if (pangkalRute(location.hash) === "#/buku-sakti") arahkan();
  else location.hash = "#/buku-sakti";
};
const keluarSekarang = () => {
  if (!bolehMeninggalkanNilai()) return;
  // Peringatan sudah dijawab di atas; samakan penanda agar arahkan() tidak
  // menanyakan hal yang sama untuk kedua kali setelah sesi dibuang.
  aturHashLayar("");
  keluar(); aturEdisi(null); location.hash = ""; arahkan();
};

document.getElementById("btn-keluar").addEventListener("click", keluarSekarang);
document.getElementById("btn-home").addEventListener("click", keHome);
document.getElementById("nav-home").addEventListener("click", keHome);
document.getElementById("nav-setting").addEventListener("click", keSetelan);
document.getElementById("btn-akun").addEventListener("click", keAkun);
document.getElementById("nav-akun").addEventListener("click", keAkun);
document.getElementById("btn-buku").addEventListener("click", keBuku);
document.getElementById("nav-buku").addEventListener("click", keBuku);
document.getElementById("nav-keluar").addEventListener("click", keluarSekarang);
document.getElementById("ganti-password").addEventListener("click", keSetelan);
window.addEventListener("hashchange", arahkan);
aturRouter(arahkan);
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

   Yang TETAP jalan cuma pembaruan DI TEMPAT — Input Pos mengganti isi sel
   tanpa membangun ulang apa pun, jadi tidak ada tombol yang berpindah dan
   gulirannya tidak bergerak. Itu bukan yang dikeluhkan, dan melepasnya akan
   mematikan lembar pos yang dibuka di beberapa HP sekaligus.

   Pemanggilan di bawah ini WAJIB ada, bukan kerapian: denyut layar itu
   menghentikan dirinya sendiri saat `document.hidden`, dan `segarkanDiTempat`
   satu-satunya yang menyalakannya lagi. Tanpa baris ini, pembaruan otomatis
   mati permanen sesudah petugas berpindah tab sekali. */
document.addEventListener("visibilitychange", () => {
  if (document.hidden || !sesi()) return;
  if (segarkanDiTempat) segarkanDiTempat();
  // Antrean nilai ikut dicoba di sini, dan HANYA di sini ia bisa bangun lagi
  // sesudah tab dibekukan: putaran 15 detiknya sengaja tidur saat tersembunyi.
  // Ini tidak menggambar ulang apa pun, jadi pasal yang melarang penggambaran
  // ulang pada visibilitychange tidak dilanggar.
  kirimAntrean();
});

/** Baris lembar pos yang isinya belum sampai ke database. */
const adaYangBelumTersimpan = () => !!document.querySelector(
  '#isi-tabel tr[data-keadaan="belum"], #isi-tabel tr[data-keadaan="gagal"]');

/** Yang menahan TAB DITUTUP, dan sengaja lebih luas daripada yang menahan
 *  PERPINDAHAN LAYAR.
 *
 *  Antrean nilai selamat dari perpindahan layar — ia tinggal di localStorage —
 *  jadi menanyakannya tiap kali petugas menekan Home cuma mengajari orang
 *  menutup kotak peringatan tanpa membacanya. Menutup tab lain persoalannya:
 *  antreannya memang masih ada di HP, tetapi tidak ada satu pun JS yang hidup
 *  untuk mengirimkannya sampai halaman ini dibuka lagi. Satu jeda di situ
 *  sepadan. */
const adaYangBelumTerkirim = () =>
  adaYangBelumTersimpan() || antreanTertunda().length > 0;

const bolehMeninggalkanNilai = () => !adaYangBelumTersimpan()
  || window.confirm("Ada nilai yang belum tersimpan. Tetap pindah layar?");

// Menutup tab dengan nilai yang belum terkirim = nilai itu hilang tanpa
// jejak. Browser hanya mengizinkan peringatan bawaannya, dan itu sudah cukup:
// yang dibutuhkan cuma satu jeda sebelum tab-nya benar-benar tertutup.
window.addEventListener("beforeunload", (e) => {
  if (!adaYangBelumTerkirim()) return;
  e.preventDefault();
  e.returnValue = "";
});

arahkan();
