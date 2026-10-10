/* ============================================================================
   hrcd-rekap : app.js — aplikasi panitia (tahap 2).
   Aturan bentuk (rancangan-b.md 10.1): kerangka sama di semua layar,
   satu aksi utama per layar, kunci di-autofocus, echo-confirm sebelum simpan,
   "baris terakhir" di kaki, gagal itu nyaring dan lokal.

   Semua teks dari luar (nama sekolah/regu/ketua, pesan server) WAJIB lewat
   esc() atau tag html`` — lihat util.js.
   ========================================================================== */

import { sesi, masuk, keluar, gantiPasswordSendiri, ErrorApi, infoEdisi,
         infoPengaturanKloter, aturPlanningBerangkat, ringkasanMeja,
         daftarPendaftaran, dataPeserta, ubahKontakPendaftaran,
         ubahIdentitasRegu, verifikasiPembayaran, batalkanVerifikasi,
         daftarUlang, tukarNomor, daftarKloter, tandaiKloterDicetak,
         pindahKloter, daftarSisipan, cariRegu, catatFinish, infoPenalti,
         papanKeberangkatan, reguKloter, kontrakOpsi, konfirmasiKontrak,
         ceklisBerangkat, batalCeklisBerangkat, berangkatkanKloter,
         koreksiJamBerangkat, daftarPos, komponenPos, rentangNomorDada,
         cacheLiveScore, tautanFoto, hasilKejuaraan, simpanKejuaraanManual,
         simpanKejuaraanTerjauh, daftarSekolah, unggahFotoMasuk,
         daftarFotoBelumTaut, tautkanFoto, kuotaFoto, bolehLihat,
         lengkapiHakSesi, daftarCentangSprint, setCentangSprint, daftarAkun,
         ubahPeranAkun, setAktifAkun, buatAkun, resetPasswordAkun,
         daftarPanitia, ubahUsernameAkun, daftarFitur, daftarHak, setHak,
         tautanBukti, fotoBuku } from "./api.js";
import { esc, h, html, rupiah, jamMenit, tanggalPanjang, tanggalJam, notif,
         dialog, kartuGagalMuat, pasangKotakJam, berapaLalu, pemuat,
         kotakJamHtml, kecilkanFoto, ukuranRapi, ikon, ikonKotak, dada3,
         angkaRapi, kolomPos, jamPadaHari, bacaAnggotaHadir, GOLONGAN_LABEL,
         biayaRegu, totalBiaya, kelompokLomba } from "./util.js";
import { hitungRekomendasiKloter, jadwalPlanning } from "./departure-calculator.mjs";
import { deretCocok, deretIntern, pesanDeret } from "./nomor-dada-series.mjs";
import { BUKU_SAKTI, SPRINT, FITUR_NAMA, FITUR_LAYAR, NAMA_LAYAR,
         cariBagian, cariSprint, tugasSprint, lajurSeksi } from "./buku-sakti.mjs";
import { alatTabel, aturEdisi, aturHashLayar, aturSegarkanDiTempat,
         barisTerakhirHtml, catatTerakhir, cocokCari, EDISI, ekorRute,
         hashLayar, kartuGalat, LAYAR, pangkalRute, pasangAlatTabel,
         pasangDada3, pasangKepala, pengendaliLayar, putusSaatPindah,
         reguAktif, segarkanDiTempat, sinyalLayarBaru,
         terakhir } from "./common/frame.js";
import { pasangCentangRiwayat,
         tombolRiwayat } from "./common/riwayat-pendaftaran.js";
import { antreanTertunda, judulPos,
         kirimAntrean } from "./common/nilai-pos.js";
import { layarCekNilai } from "./screens/cek-nilai.js";
import { layarInputPos } from "./screens/input-nilai-tabel.js";
import { layarInputPos2 } from "./screens/input-nilai-lomba.js";
import { layarLiveScore } from "./screens/live-score.js";

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

/* ============================ BERANDA MEJA (home) ========================= */

async function layarHome() {
  // Lebar penuh: pada 760px hanya muat dua kolom, dan menu empat belas tombol
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
    /* v2 BERDIRI PALING ATAS di papan juri, dan itu bukan urutan
       alfabet: layar inilah yang dibuat untuk orang yang membaca papan
       ini. Yang lama tetap ada di bawahnya karena hanya dari sana
       blangko bisa dicetak.

       Papan ini SEPENUHNYA TERPISAH dari papan meja di bawah, dan itu
       yang membuat ubin baru gampang terlupa: ditambahkan di satu
       tempat, dan akun juri — satu-satunya yang memakai layar itu —
       tidak melihatnya sama sekali. Persis yang terjadi sampai baris
       ini ditulis. */
    /* .bs-pintu-ket — Glosnya DIPERTAHANKAN, dan itu bukan pelanggaran bagian
       9.9. Aturan itu melarang menjelaskan nama yang sudah mengatakan dirinya
       sendiri — "Pendaftaran", "Keberangkatan". "Buku Sakti" adalah NAMA,
       bukan keterangan: ia tidak menyebut satu pun dari tiga hal yang ada di
       dalamnya, dan yang baru pertama melihatnya tidak punya cara menduga. */
    LAYAR.replaceChildren(h(`
      <div class="function-menu">
        <a href="#/pos2">
          <div class="function-name">${ikonKotak("clipboard-pen", "ungu")} Input Nilai Per Lomba</div>
        </a>
        <a href="#/pos">
          <div class="function-name">${ikonKotak("square-pen", "nila")} Input Nilai Tabel${
            sesi().pos != null && sesi().pos !== "" ? ` ${esc(sesi().pos)}` : ""}</div>
        </a>
        <a href="#/foto">
          <div class="function-name">${ikonKotak("camera", "mawar")} Foto Jawaban Sekaligus</div>
        </a>
        ${bolehLihat("live_score") ? `
        <a href="#/live-score">
          <div class="function-name">${ikonKotak("medal", "emas")} Live Score</div>
        </a>` : ""}
        ${bolehLihat("live_score") ? `
        <a href="#/kejuaraan">
          <div class="function-name">${ikonKotak("trophy", "jingga")} Kejuaraan</div>
        </a>` : ""}
      </div>
      ${bolehLihat("pengaturan") ? `
      <a class="bs-pintu" href="#/buku-sakti">
        ${ikon("book-open", "ikon bs-pintu-ikon")}
        <span class="bs-pintu-teks">
          <span class="bs-pintu-nama">Buku Sakti</span>
          <span class="bs-pintu-ket">Cara menjalankan HRCD, tugas pokok tiap
            seksi, dan timeline satu edisi.</span>
        </span>
      </a>
      ` : ""}
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

  /* Form pendaftaran tidak lagi tinggal di situs ini: ia pindah ke
     situs PESERTA bersama rekap live, supaya alamat yang beredar ke
     ratusan orang bukan alamat yang ada kotak loginnya. Karena beda
     asal, tautannya mutlak dan diambil dari config.js. */
  /* Data Peserta duduk tepat di sebelah Pendaftaran, dan itu bukan
     soal tata letak: keduanya satu pekerjaan yang sama dibelah dua oleh
     waktu. Yang satu menerima apa yang diketik pembina, yang satu
     membetulkannya waktu pembina menelepon karena salah ketik. Haknya
     pun sama: hak pendaftaran. */
  /* BUKAN UBIN KELIMA BELAS, dan itu keputusan warna sebelum keputusan
     tata letak. Tiap ubin di papan ini punya rona sendiri supaya jempol
     bisa menuju "yang jingga" tanpa mengeja namanya, dan keempat belas
     rona yang jaraknya cukup jauh sudah habis terpakai. Ubin kelima belas
     berarti dua ubin serona — dan sejak itu warnanya berhenti menandai
     apa pun, untuk keempat belas ubin sekaligus, bukan cuma yang baru.

     Jadi ia berdiri DI BAWAH grid sebagai pita selebar papan: terlihat
     tanpa dicari, tidak ikut kode warna, dan tidak menggeser satu pun
     ubin yang tangan panitia sudah hafal letaknya. Hak aksesnya ikut
     centang pengaturan, sama dengan layarnya — alasannya di kepala
     bagian BUKU SAKTI. */
  /* .bs-pintu-ket — Glosnya DIPERTAHANKAN, dan itu bukan pelanggaran bagian
     9.9. Aturan itu melarang menjelaskan nama yang sudah mengatakan dirinya
     sendiri — "Pendaftaran", "Keberangkatan". "Buku Sakti" adalah NAMA, bukan
     keterangan: ia tidak menyebut satu pun dari tiga hal yang ada di dalamnya,
     dan yang baru pertama melihatnya tidak punya cara menduga. */
  LAYAR.replaceChildren(h(`
    ${galat ? kartuGalat(`Jumlah antrean tidak bisa dibaca: ${galat}`) : ""}
    <div class="function-menu">
      ${bolehLihat("pendaftaran") ? `
      <a href="${esc((window.HRCD && window.HRCD.pesertaUrl) || "")}/daftar.html"
         target="_blank" rel="noopener">
        <div class="function-name">${ikonKotak("clipboard-list", "biru")} Pendaftaran</div>
      </a>` : ""}
      ${bolehLihat("pendaftaran") ? `
      <a href="#/data-peserta">
        <div class="function-name">${ikonKotak("users", "sian")} Data Peserta</div>
      </a>` : ""}
      ${bolehLihat("pembayaran") ? `
      <a href="#/pembayaran">
        <div class="function-name">${ikonKotak("credit-card", "hijau")} Pembayaran ${lencana(r ? r.menunggu_pembayaran : null)}</div>
      </a>` : ""}
      ${bolehLihat("daftar_ulang") ? `
      <a href="#/daftar-ulang">
        <div class="function-name">${ikonKotak("id-card", "magenta")} Daftar Ulang ${lencana(r ? r.lunas_belum_nomor : null)}</div>
      </a>` : ""}
      ${bolehLihat("cetak_kloter") ? `
      <a href="#/cetak-kloter">
        <div class="function-name">${ikonKotak("list-ordered", "toska")} Daftar Kloter</div>
      </a>` : ""}
      ${bolehLihat("keberangkatan") ? `
      <a href="#/keberangkatan">
        <div class="function-name">${ikonKotak("flag", "merah")} Keberangkatan ${
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
        <div class="function-name">${ikonKotak("square-pen", "nila")} Input Nilai Tabel</div>
      </a>` : ""}
      ${bolehLihat("pos") ? `
      <a href="#/foto">
        <div class="function-name">${ikonKotak("camera", "mawar")} Foto Jawaban Sekaligus</div>
      </a>` : ""}
      ${bolehLihat("pos") ? `
      <a href="#/pos2">
        <div class="function-name">${ikonKotak("clipboard-pen", "ungu")} Input Nilai Per Lomba</div>
      </a>` : ""}
      ${bolehLihat("pengaturan") ? `
      <a href="#/cek-nilai">
        <div class="function-name">${ikonKotak("list-checks", "lumut")} Cek Nilai</div>
      </a>` : ""}
      ${bolehLihat("live_score") ? `
      <a href="#/live-score">
        <div class="function-name">${ikonKotak("medal", "emas")} Live Score</div>
      </a>` : ""}
      ${bolehLihat("live_score") ? `
      <a href="#/kejuaraan">
        <div class="function-name">${ikonKotak("trophy", "jingga")} Kejuaraan</div>
      </a>` : ""}

      ${bolehLihat("pengaturan") ? `
      <a href="#/pengaturan-kloter">
        <div class="function-name">${ikonKotak("settings", "abu")} Kalkulator Keberangkatan</div>
      </a>` : ""}
    </div>


      ${bolehLihat("pengaturan") ? `
      <a class="bs-pintu" href="#/buku-sakti">
        ${ikon("book-open", "ikon bs-pintu-ikon")}
        <span class="bs-pintu-teks">
          <span class="bs-pintu-nama">Buku Sakti</span>
          <span class="bs-pintu-ket">Cara menjalankan HRCD, tugas pokok tiap
            seksi, dan timeline satu edisi.</span>
        </span>
      </a>
      ` : ""}
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
          <label for="kloter-jumlah-intern">Regu Internal</label>
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
            <th>Internal</th>
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
const FMT_DP = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta", day: "2-digit", month: "2-digit",
  year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
});
const tanggalRingkas = (t) => {
  if (!t) return "—";
  const b = {};
  for (const x of FMT_DP.formatToParts(new Date(t))) b[x.type] = x.value;
  return `${b.day}/${b.month}/${b.year} ${b.hour}:${b.minute}`;
};

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

  /* Tidak ada kolom Regu di sini. Jumlahnya sudah tercetak di
     dalam tombol "Isi N Nomor Dada" di kolom terakhir, dan
     kolom sendiri hanya untuk mengulanginya adalah lebar yang
     terbuang — di jendela sempit lebar itulah yang membuat
     tombolnya terdorong keluar layar. */
  /* Empat kolom, dua terakhir tanpa judul: nomor dada, lalu
     tombol tukar. Dulu keduanya berbagi satu kolom, dan
     tombolnya jatuh ke baris kedua tiap kali nomornya lebih
     dari dua — tinggi baris jadi dua kali lipat untuk
     sebagian sekolah saja, dan tabelnya bergerigi. */
  LAYAR.replaceChildren(h(`
    <div class="card">
      ${alatTabel({
        saringan: [
          { kode: "semua", label: "Semua" },
          { kode: "belum", label: "Perlu Nomor Dada", pendek: "Belum" },
          { kode: "sudah", label: "Selesai" },
        ],
        saringAktif: "belum",
        jumlah: semua.length,
      })}
      <div class="table-wrapper">
        <table class="table data-table table-daftar-ulang">
          <thead>
            <tr>
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
      // Pil nomor dada = penanda "sudah selesai" di layar ini, jadi PIL ITU
      // yang jadi tombol riwayat — sejajar dengan lencana LUNAS di Meja
      // Pembayaran, dan tanpa menggambar satu lambang baru pun. Bentuknya
      // tidak berubah sedikit pun; yang bertambah cuma bisa diketuk.
      //
      // TAPI hanya kalau seluruh regunya sudah bernomor. Batch yang baru
      // separuh terisi juga menampilkan nomor yang sudah masuk, di bawah
      // tombol "Isi N Nomor Dada" — dan di sana pil yang bisa diketuk
      // menyatakan baris itu selesai, padahal petugas justru sedang berdiri
      // di tengah pekerjaannya.
      const pilNomor = (bisaKlik) => aktif.filter(r => r.nomor_dada !== null)
        .sort((x, y) => x.nomor_dada - y.nomor_dada)
        .map(r => {
          const isi = html`${dada3(r.nomor_dada)}<span
            class="kloter-pill">K${r.kloter_nomor}</span>`;
          return bisaKlik
            ? tombolRiwayat(b.kode_pembayaran, isi, "pill-number")
            : `<span class="pill-number">${isi}</span>`;
        }).join(" ");

      const kode = esc(b.kode_pembayaran);
      const tombolTukar = aktif.some(r => r.nomor_dada !== null)
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
           </button>${aktif.some(r => r.nomor_dada !== null)
             ? `<div class="sub">${pilNomor(false)}</div>` : ""}`
        : `<div class="pill-row">${pilNomor(true)}</div>`;

      // Template biasa (lihat catatan sama di layar Pembayaran).
      /* Nama-nama regu TIDAK ditampilkan di sini. Barisnya panjang dan
         memakan lebar yang dibutuhkan kolom di kanannya, padahal yang
         dicari petugas di layar ini adalah SEKOLAHNYA — nama regunya
         baru relevan saat mengisi nomor dada, dan di sana ia memang
         tampil satu per satu di rincian. Pencarian tetap mengenali
         nama regu (lihat cocokCari), jadi mengetik nama regu tetap
         menemukan sekolahnya. */
      /* Sel kosong terakhir menyeimbangkan kolom "Tukar nomor
         rusak…" di tabel induk. Tanpa itu jumlah kolom kedua
         tabel berbeda, dan di layar lebar (table-layout: fixed)
         kotak nomor dada tidak lagi jatuh tepat di bawah tombol
         yang membukanya. Disembunyikan di bawah 941px — lihat
         style.css. */
      return `
        <tr data-baris="${kode}">
          <td class="mono" data-label="Kode Bayar">${kode}</td>
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
                <tr><th>Regu</th><th>Kategori</th><th>Ketua</th>
                    <th>Nomor dada${deretIntern(menunggu) && rentang
                      ? `<span class="sub">Internal ${rentang.internMulai}–${rentang.internSampai}</span>`
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

    // Riwayat perubahan pendaftaran ini — lihat catatan sama di Meja Pembayaran.
    pasangCentangRiwayat(tbody);

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
    // Kain Internal bertulis 001 sama seperti kain Eksternal, jadi mengetik tiga
    // angka untuk regu Internal adalah kekeliruan yang paling mungkin terjadi di
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
          // Kain Internal bertulis 001 sama seperti kain Eksternal, dan
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

    /* #peringatan-kontrak — Dibungkus supaya isinya bisa dihitung ulang tanpa
       menggambar ulang seluruh tabel — lihat perbaruiPeringatanKontrak(). */
    /* Kotak ketik, bukan <input type="time">: pemilih bawaan
       browser merender AM/PM kalau locale browsernya Inggris, dan
       tidak ada atribut yang bisa memaksanya 24 jam. Lihat
       jamSah() di util.js. */
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

        <div id="peringatan-kontrak">${!belumKontrak.length ? "" : kartuGalat(
          `${belumKontrak.length} regu sudah diceklis tapi belum punya kontrak waktu — ` +
          `keberangkatan akan ditolak.`)}</div>

        ${sudahBerangkat ? "" : `
          <div class="departure-bar">
            <div class="field" style="margin:0">
              <label for="jam-berangkat-hh">Jam berangkat</label>
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

  /* .table — Empat angka MENDATAR: label jadi kepala kolom, angkanya satu baris
     di bawahnya. Sebagai empat baris ia memakan setengah layar HP untuk
     empat angka yang cuma dilirik — dan yang dicari di bawahnya, kotak
     jam dan tombol Cetak, terdorong keluar layar.

     Tetap tabel, bukan grid: kepala kolom table th sudah membawa
     bentuk label yang dipakai tabel lain di layar ini, dan angkanya
     tetap sel angka yang sama. */
  /* .two-column — Rencana berangkat berdiri DI ATAS tombol cetak, dan urutan
     itu berarti: yang tercetak adalah jam yang baru saja diatur di sini.
     Menaruhnya di bawah membuat petugas menekan Cetak lebih dulu, lalu
     menemukan kotak jamnya sesudah kertasnya keluar.

     SEBARIS BERDUA, kiri dan kanan, di lebar berapa pun. Keduanya dua
     ujung dari SATU jendela — yang diatur bukan dua jam melainkan
     rentangnya — dan bertumpuk mereka terbaca seperti dua setelan yang
     tidak berhubungan, sekaligus memakan dua kali tingginya di HP.

     TANPA judul dan TANPA paragraf penjelas. Labelnya sendiri sudah
     menyebut jamnya, jadi judul di atasnya cuma mengulang
     label yang ada di bawahnya (pasal 9.3),
     dan kalimat "jam ini dibagi rata lalu tercetak untuk peserta"
     menjelaskan sesuatu yang terlihat sendiri begitu jamnya diubah
     sekali (pasal 9.1 dan 9.6). */
  LAYAR.replaceChildren(h(`
    <div class="card" style="border-color:var(--utama)">
      <table class="table table-ringkas-kloter">
        <thead>
          <tr>
            <th>Total Kloter</th><th>Total Regu</th>
            <th>Eksternal</th><th>Internal</th>
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
      <div class="two-column planning-jam" style="margin-top:1rem">
        <div class="field">
          <label for="planning-pertama-hh">Jam Berangkat Pertama</label>
          ${kotakJamHtml("planning-pertama", jamPendek(
            cfg.planning_berangkat_pertama || cfg.jam_mulai_berangkat))}
        </div>
        <div class="field">
          <label for="planning-terakhir-hh">Jam Berangkat Terakhir</label>
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
        /* Labelnya menyebut ASAL angkanya, bukan cuma "jam berangkat".
           Keduanya jam yang terlihat sama di layar dan sama sekali bukan
           hal yang sama: yang satu dihitung sistem untuk merencanakan
           pagi, yang satu diketik petugas dari jam dinding dan menjadi
           dasar penalti SELURUH regu di kloter itu (pasal 10.6).

           "di Lapangan" bukan hiasan. Tanpa itu "Jam berangkat" terbaca
           seperti jadwal — dan petugas yang membaca kartu ini untuk
           memutuskan apakah sebuah kloter sudah jalan tidak punya cara
           membedakan keduanya selain mengingat kloter mana yang sudah
           ia ceklis. */
        return `
          <div class="card">
            <h2>Kloter ${esc(nomor)}</h2>
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
    catatWaktuCetak(semuaKloter.map(([n]) => Number(n)));
  }

  /** Waktu cetak dicatat SENDIRI, tanpa bertanya.
   *
   *  Dulu ada dialog "Kertasnya sudah keluar?" supaya catatannya cuma ditulis
   *  kalau kertasnya benar-benar keluar. Yang dibeli ketelitian itu tidak
   *  sebanding harganya: TIDAK ADA SATU LAYAR PUN yang membaca `dicetak_pada`,
   *  dan sejak 0066 ia tidak lagi memagari apa pun — pengacakan otomatis cuma
   *  melihat `jam_berangkat` (CLAUDE.md 12.3). Jadi pertanyaannya menghentikan
   *  petugas yang sedang mencetak demi ketelitian sebuah catatan yang tidak
   *  pernah dibaca siapa pun.
   *
   *  Akibat yang diterima: kloter yang lembar cetaknya dibatalkan tetap
   *  tercatat pernah dicetak. Itu catatan yang keliru, bukan pekerjaan yang
   *  rusak — mencetak ulang selalu boleh (CLAUDE.md 12.1).
   *
   *  Sesudah `window.print()`, bukan sebelumnya: di iPhone lembar cetak baru
   *  mulai menggambar preview-nya sesudah baris itu lewat, dan apa pun yang
   *  menahan utas di sana membuatnya berhenti di "Loading Preview..." selamanya.
   *  Panggilan ini tidak menahan utas, tapi urutannya tetap dipertahankan.
   *
   *  Gagalnya tetap bersuara. Catatan yang tidak dibaca layar mana pun toh
   *  masih ditanyakan orang ("kloter 12 dicetak jam berapa?"), dan gagal
   *  menulis yang benar-benar diam tidak pernah bisa diperbaiki. */
  async function catatWaktuCetak(nomor) {
    try { await tandaiKloterDicetak(nomor); }
    catch (err) { notif(`Waktu cetak tidak tersimpan: ${err.message}`, true); }
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
        <tr><td class="dada">${dada3(r.nomor_dada)}</td>
            <td>${r.nama_regu}${r.sisipan ? " ★" : ""}</td>
            <td>${r.nama_sekolah}</td>
            <td>${GOLONGAN_LABEL[r.golongan] || r.golongan}</td>
            <td class="kotak-kontrak"></td>
            <td class="kotak"></td></tr>`
      : html`
        <tr><td class="dada">${dada3(r.nomor_dada)}</td>
            <td>${r.nama_regu}</td>
            <td>${r.nama_sekolah}</td>
            <td>${GOLONGAN_LABEL[r.golongan] || r.golongan}</td></tr>`).join("");

    const adaSisipan = v.isi.some(r => r.sisipan);

    /* Petugas turun ke barisnya sendiri, dan tiap isian dijaga
       nowrap. Sebaris bertiga, "Petugas:" muat di ujung kanan tapi
       garis isiannya tidak — garisnya pindah ke baris berikutnya dan
       kertasnya keluar dengan nama tanpa tempat menulis. */
    /* DUA KOLOM YANG DITULISI, BERDAMPINGAN DI UJUNG KANAN:
       Kontrak Waktu lalu Hadir.

       Hadir dulu berada di kolom PALING KIRI, dan alasannya ditulis
       di tempat ini: petugas memegang kertas di satu tangan dan HP di
       tangan lain, jadi kotak centang di ujung yang berlawanan
       membuat matanya menyeberangi seluruh baris tiap regu. Alasan
       itu berdiri selama Hadir SATU-SATUNYA yang ditulisi.

       Sekarang ada dua. Menaruh yang satu di ujung kiri dan yang lain
       di ujung kanan membuat tangan menyeberangi baris DUA KALI per
       regu — lebih mahal daripada yang dihemat aturan lama.
       Berdampingan, keduanya terisi dalam satu gerakan.

       Keputusan pemilik acara, 31 Agustus 2026. */
    return bentuk === "staging" ? `
      <section class="print-page">
        <h1>KLOTER ${esc(nomor)} — ${esc(EDISI ? EDISI.name : "")}</h1>
        <p><strong>Perkiraan jam berangkat: ${esc(perkiraan)}</strong>
           · <span style="white-space:nowrap">Jam sebenarnya: ________</span><br>
           <span style="white-space:nowrap">Petugas: ________________</span></p>
        <table class="print-table">
          <thead><tr><th>No Dada</th><th>Nama Regu</th><th>Sekolah</th><th>Golongan</th><th class="kotak-kontrak">Kontrak Waktu</th><th class="kotak">Hadir</th></tr></thead>
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
  /* TOMBOL adalah pencatat utama di meja ini; kertas panitia hanya
     untuk cek silang. Jadi jam & anggota sengaja TIDAK sejajar dengan tombol —
     keduanya dipakai saat memperbaiki hasil verifikasi, bukan tiap regu. */
  /* Kotak ketik, alasan sama dengan jam berangkat: pemilih bawaan
     browser bisa muncul sebagai AM/PM. Lihat jamSah() di util.js. */
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
      <details style="margin-top:.6rem">
        <summary style="cursor:pointer;min-height:40px;font-size:.9rem;color:var(--tinta-lembut)">
          Perbaiki jam atau jumlah anggota
        </summary>
        <div class="two-column pasangan-sempit" style="margin-top:.5rem">
          <div class="field" style="margin:0">
            <label for="jam-hh">Jam datang</label>
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
  pasangDada3(inp);
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
    async () => { try { aturEdisi(await infoEdisi()); } catch {} arahkan(); }));
}

/* ============================ KEJUARAAN ================================= */

/** DAFTAR JUARA DI ATAS KERTAS.
 *
 *  Dua pemakaian, dan keduanya menuntut kertas: dibacakan di panggung saat
 *  pengumuman, lalu jadi dasar menulis sertifikat. Sebelum ini satu-satunya
 *  cara mengeluarkannya dari layar adalah tangkapan layar HP.
 *
 *  BAGIANNYA DIPINJAM DARI LAYARNYA — `bagian` yang sama persis dioper ke
 *  sini, tidak ditulis ulang. Dua daftar penghargaan yang harus ikut benar
 *  setiap kali satu gelar ditambah adalah dua daftar yang suatu hari
 *  berselisih, dan yang berselisih di sini terbaca di panggung.
 *
 *  URUTANNYA BERBEDA DARI LAYARNYA, dan itu disengaja. Layar dipakai
 *  memeriksa — yang dicari mata Juara I, jadi ia di atas. Panggung dibacakan
 *  menaik: penghargaan pilihan dulu, lalu juara per golongan dari Harapan III
 *  sampai Juara I, dan Juara Umum penutupnya. Angka urutnya ikut menempel di
 *  tiap bagian di layarnya, jadi tetap satu daftar.
 *
 *  YANG BELUM DITENTUKAN IKUT DICETAK, dan tidak diredupkan. Pembawa acara
 *  yang menemukan gelar kosong di atas panggung tidak punya jalan keluar;
 *  yang menemukannya di kertas, sebelum naik, masih punya. Karena itu ia
 *  tertulis biasa — bukan miring, bukan abu — sementara yang sudah ada
 *  namanya ditebalkan: bedanya terbaca dari kejauhan tanpa dieja.
 *
 *  SATU DOKUMEN MENGALIR, bukan satu lembar per bagian. Sebelas bagian
 *  berarti sebelas lembar yang harus dibolak-balik di podium, padahal
 *  seluruhnya muat di dua. Yang dijaga cuma satu bagian tidak terbelah dua
 *  halaman, lewat `break-inside: avoid`.
 *
 *  Tanpa raster, tanpa abu, garis 1pt, huruf terkecil 9pt — kertas ini ikut
 *  digandakan di mesin fotokopi bersama yang lain (CLAUDE.md bagian 8). */
function siapkanCetakJuara(hasil, bagian) {
  document.getElementById("cetakan")?.remove();
  const dicetak = tanggalJam(new Date().toISOString());

  /* KOLOM KANAN PERSIS SEPERTI JUDULNYA: skor regu, atau poin juara untuk
     Juara Umum. Tidak ada yang ketiga — Peserta Terbanyak menghitung REGU dan
     Pangkalan Terjauh tidak punya angka sama sekali, jadi keduanya dibiarkan
     kosong di kolom itu dan angkanya tetap tertulis lengkap dengan satuannya
     di baris di bawah namanya.

     Kolomnya sempat tanpa judul dan hanya berisi skor regu; judulnya yang
     membuat poin juara boleh ikut masuk, karena sekarang ada yang
     mengatakan angka itu bisa dua macam. Yang tidak boleh masuk tetap yang
     satuannya lain lagi (bagian 9.3): kolom berisi tiga jenis angka menuntut
     tiap barisnya diartikan sendiri-sendiri, dan kolom ini justru ada supaya
     bisa dibaca lurus ke bawah. */
  const angka = (x) => {
    if (x.nama_regu) return x.total == null ? "" : angkaRapi(x.total);
    if (x.kode.startsWith("juara_umum")) return angkaRapi(x.poin_juara);
    return "";
  };

  const isiJuara = (x) => {
    if (x.nama_regu) {
      return `<strong>${esc(dada3(x.nomor_dada))} · ${esc(x.nama_regu)}</strong>`
        + `<br><span class="juara-sekolah">${esc(x.nama_sekolah || "")}</span>`;
    }
    if (x.nama_sekolah) {
      /* Poin juaranya TIDAK diulang di sini — ia sudah berdiri di kolom
         kanan. Yang tersisa di baris ini justru yang tidak muat di sana:
         total skor enam besar, angka kedua yang menjelaskan dari mana poin
         itu datang. */
      const ket = x.kode.startsWith("juara_umum")
        ? `${angkaRapi(x.jumlah_skor)} total skor (6 besar)`
        : x.kode === "peserta_terbanyak" ? `${angkaRapi(x.total)} regu bernomor dada` : "";
      return `<strong>${esc(x.nama_sekolah)}</strong>`
        + (ket ? `<br><span class="juara-sekolah">${esc(ket)}</span>` : "");
    }
    return `<span class="juara-kosong">Belum ditentukan</span>`;
  };

  /* URUTAN BACA DI DALAM SATU BAGIAN, dan satu aturan melayani ketiga
     bentuknya karena kode penghargaannya sendiri yang membawanya:

       penggalang_pi_6        golongan + peringkat  -> Harapan III dulu
       kostum_penggalang_pi   golongan saja         -> urut golongan
       terjauh                keduanya tidak ada    -> biarkan apa adanya

     Peringkatnya dibalik (6 dulu, 1 terakhir) karena panggung dibacakan
     menaik: Harapan III lebih dulu, Juara I penutupnya.

     DAFTAR GOLONGAN DI SINI BUKAN SALINAN `URUT_GOLONGAN`, dan tidak boleh
     diganti dengan itu. Yang di util.js urutan TAMPIL — dipakai tab Live
     Score dan kolom rekap; yang ini urutan DIBACAKAN, diminta pemilik acara:
     putri lebih dulu di tiap tingkat, dan Penggalang sebelum Penegak. Dua
     fakta berbeda yang kebetulan sama bentuknya. */
  const URUT_BACA_GOLONGAN =
    ["penggalang_pi", "penggalang_pa", "penegak_pi", "penegak_pa"];
  const kunciBaca = (x) => {
    const g = URUT_BACA_GOLONGAN.findIndex(k => x.kode.includes(k));
    const p = x.kode.match(/_(\d+)$/);
    return [g < 0 ? URUT_BACA_GOLONGAN.length : g, p ? -Number(p[1]) : 0];
  };

  const isi = bagian.map(([judul, masuk, label, kelas]) => {
    const punya = hasil.filter(masuk).sort((a, b) => {
      const ka = kunciBaca(a), kb = kunciBaca(b);
      return ka[0] - kb[0] || ka[1] - kb[1];
    });
    if (!punya.length) return "";
    /* Kelas letaknya DIBAWA APA ADANYA dari layarnya, dan itu yang membuat
       kertas ini benar-benar salinan layarnya: satu blok aturan grid di
       style.css menempatkan kedua-duanya — Juara Umum di atas melintang,
       sisanya berpasangan dua kolom — jadi menggeser satu kartu di layar
       menggeser kartu yang sama di kertas, tanpa ada yang perlu diingat. */
    /* .print-table — JUDUL HANYA UNTUK KOLOM KANAN. Dua kolom pertama sudah
       terbaca dari bentuknya sendiri — gelar kecil di kiri, nama juara besar
       di tengah — dan "GELAR | JUARA" yang tercetak sebelas kali cuma
       mengulang sesuatu yang tidak pernah ditanyakan (bagian 9.3). Angka di
       kanan tidak begitu: 1673 dan 42 duduk di kolom yang sama padahal yang
       satu skor regu dan yang satu poin juara, dan tanpa judul tidak ada yang
       mengatakan itu.

       SATU SEL MELINTANG TIGA KOLOM, rata kanan — bukan sel di kolom
       ketiga. Kolom itu selebar angkanya saja, dan "Skor / Poin Juara"
       di dalamnya patah jadi tiga baris: satu blok tulisan menggantung
       dengan ruang kosong di kirinya, sebelas kali. Melintang, ia satu
       baris yang duduk tepat di atas angkanya. */
    return `
      <section class="juara-bagian ${esc(kelas)}">
        <h2>${esc(judul)}</h2>
        <table class="print-table">
          <thead><tr><th colspan="3" class="juara-kepala">Skor / Poin Juara</th></tr></thead>
          <tbody>${punya.map(x => `
            <tr><td class="juara-gelar">${esc(label(x))}</td>
                <td>${isiJuara(x)}</td>
                <td class="juara-skor">${esc(angka(x))}</td></tr>`).join("")}</tbody>
        </table>
      </section>`;
  }).join("");

  document.body.appendChild(h(`<div id="cetakan" class="printout juara-cetak">
    <section class="print-page">
      <h1>DAFTAR JUARA — ${esc(EDISI ? EDISI.name : "")}</h1>
      <div class="kejuaraan-bagian">${isi}</div>
      <p class="print-note">Dicetak ${esc(dicetak)}.</p>
    </section>
  </div>`));
}

async function layarKejuaraan() {
  pasangKepala("Kejuaraan", true);
  if (!bolehLihat("live_score")) {
    LAYAR.replaceChildren(h(kartuGalat("Akun ini tidak berhak membuka Kejuaraan.")));
    return;
  }
  LAYAR.replaceChildren(h(pemuat()));
  const layarIni = location.hash;
  const bisaUbah = bolehLihat("pengaturan");
  let hasil, snapshot, semuaSekolah;
  try {
    [hasil, snapshot, semuaSekolah] = await Promise.all([
      hasilKejuaraan(), bisaUbah ? cacheLiveScore() : Promise.resolve(null),
      bisaUbah ? daftarSekolah() : Promise.resolve([]),
    ]);
  }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarKejuaraan)); return; }
  if (location.hash !== layarIni) return;

  /* Pilihan penghargaan manual hanya butuh identitas regu dan jam datang.
     Semuanya sudah ada di snapshot Live Score; menjalankan v_rekap_penuh lagi
     di sini membuat layar Kejuaraan mengulang seluruh kalkulasi skor. */
  const regu = snapshot ? snapshot.rekap || [] : [];
  const opsi = [...new Map(regu.filter(r => r.nomor_dada != null && r.jam_datang != null
      && !String(r.golongan).startsWith("intern_"))
    .map(r => [r.regu_id, r])).values()]
    .sort((a, b) => Number(a.nomor_dada) - Number(b.nomor_dada));
  /* Pangkalan Terjauh menunjuk SEKOLAH; daftarnya dipersempit ke sekolah yang
     benar-benar mengirim regu. Master `sekolah` memuat seluruh sekolah kurasi
     — 189 baris — dan menawarkan semuanya membuat satu salah klik memberi
     gelar kepada pangkalan yang tidak hadir. */
  const ikut = new Set(opsi.map(r => r.nama_sekolah));
  const sekolah = (semuaSekolah || []).filter(s => ikut.has(s.name));

  /* Kostum dan Terfavorit dipilih PER GOLONGAN, jadi kotak carinya hanya boleh
     menawarkan regu golongan itu. Golongannya dibaca dari ekor kode
     (`kostum_penegak_pa`). RPC-nya menolak pasangan yang salah juga — ini yang
     membuat panitia tidak perlu sampai ditolak. */
  const golonganKode = (kode) =>
    (kode.match(/(?:penegak|penggalang)_(?:pa|pi)$/) || [""])[0];
  const labelRegu = (r) => `${dada3(r.nomor_dada)} · ${r.nama_regu} · ${r.nama_sekolah}`;
  /* Skornya berdiri di kanan baris, bukan ikut mengalir di bawah nama sekolah:
     panitia membaca kolom itu ke bawah untuk mengecek urutan juara, dan angka
     yang letaknya berpindah-pindah menuntut mata mencarinya tiap baris. */
  const skor = (x) => x.total == null ? ""
    : `<span class="kejuaraan-skor">${esc(angkaRapi(x.total))}</span>`;
  const nilai = (x) => {
    if (x.nama_regu) return `<div class="kejuaraan-isi"><div class="kejuaraan-nama">
      <strong>${esc(dada3(x.nomor_dada))} · ${esc(x.nama_regu)}</strong>
      <span class="description">${esc(x.nama_sekolah || "")}</span></div>${skor(x)}</div>`;
    if (x.nama_sekolah) return `<strong>${esc(x.nama_sekolah)}</strong>${x.kode.startsWith("juara_umum")
      ? `<span class="description">${esc(angkaRapi(x.poin_juara))} poin juara · ${esc(angkaRapi(x.jumlah_skor))} total skor (6 besar)</span>`
      : x.kode === "peserta_terbanyak"
        ? `<span class="description">${esc(angkaRapi(x.total))} regu bernomor dada</span>` : ""}`;
    return `<span class="description">Belum ditentukan</span>`;
  };
  const bisaPilih = (x) =>
    bisaUbah && (x.sumber === "manual" || x.sumber === "manual_sekolah");
  const baris = (x, label = x.nama_penghargaan) => bisaPilih(x) ? `
    <tr><th>${esc(label)}</th><td>
      <div class="kejuaraan-terkunci" ${x.nama_sekolah ? "" : "hidden"}>
        <div class="kejuaraan-nilai">${nilai(x)}</div>
        <button type="button" class="button button-secondary button-small kejuaraan-ubah">
          Ubah Juara
        </button>
      </div>
      <div class="kejuaraan-isian" ${x.nama_sekolah ? "hidden" : ""}>
        <div class="kejuaraan-cari">
          <input type="search" class="small-input kejuaraan-pilih" data-kode="${esc(x.kode)}"
            data-jenis="${x.sumber === "manual_sekolah" ? "sekolah" : "regu"}"
            data-golongan="${esc(golonganKode(x.kode))}"
            autocomplete="off" aria-label="Pilih ${esc(x.nama_penghargaan)}"
            placeholder="${x.sumber === "manual_sekolah"
              ? "Cari nama sekolah…" : "Cari nomor dada / regu / sekolah…"}"
            value="${esc(x.sumber === "manual_sekolah"
              ? (x.nama_sekolah || "") : (x.regu_id ? labelRegu(x) : ""))}">
          <div class="suggestions kejuaraan-saran" hidden></div>
        </div>
      </div></td></tr>` : `<tr><th>${esc(label)}</th><td>${nilai(x)}</td></tr>`;

  /* Label golongan diambil dari GOLONGAN_LABEL, tidak ditulis ulang di sini:
     satu-satunya tempatnya `util.js`, dan `periksa_urutan_golongan.py` yang
     menjaganya tetap satu. */
  /* SATU DAFTAR untuk layar dan kertas, termasuk urutannya. Kertasnya salinan
     layarnya — Juara Umum di atas, sisanya berpasangan — keputusan pemilik
     acara, 2 September 2026. Yang berbeda cuma urutan BARIS di dalam tiap
     kartu; lihat kunciBaca() di pembuat cetakannya. */
  const gelarGolongan = (kode, kelas) => [
    GOLONGAN_LABEL[kode], x => x.kode.startsWith(kode + "_"),
    x => x.nama_penghargaan.replace(GOLONGAN_LABEL[kode] + " ", ""), kelas];

  const bagian = [
    ["Juara Umum", x => x.kode === "juara_umum",
      x => x.nama_penghargaan.replace(/^Juara Umum /, ""), "kejuaraan-umum"],
    ["Juara Umum Penegak", x => x.kode === "juara_umum_penegak",
      () => "PENEGAK", "kejuaraan-umum-penegak"],
    gelarGolongan("penegak_pa", "kejuaraan-penegak-pa"),
    gelarGolongan("penegak_pi", "kejuaraan-penegak-pi"),
    ["Juara Umum Penggalang", x => x.kode === "juara_umum_penggalang",
      () => "PENGGALANG", "kejuaraan-umum-penggalang"],
    gelarGolongan("penggalang_pa", "kejuaraan-penggalang-pa"),
    gelarGolongan("penggalang_pi", "kejuaraan-penggalang-pi"),
    ["Juara Kostum", x => x.kode.startsWith("kostum_"),
      x => x.nama_penghargaan.replace(/^Juara Kostum /, ""),
      "kejuaraan-kostum kejuaraan-pilihan"],
    ["Juara Yel Yel", x => x.kode.startsWith("yel_yel_"),
      x => x.nama_penghargaan.replace(/^Juara Yel Yel /, ""), "kejuaraan-yel-yel"],
    ["Peserta Terfavorit", x => x.kode.startsWith("terfavorit_"),
      x => x.nama_penghargaan.replace(/^Peserta Terfavorit /, ""),
      "kejuaraan-terfavorit kejuaraan-pilihan"],
    ["Penghargaan Khusus",
      x => x.kode === "terjauh" || x.kode === "peserta_terbanyak",
      x => x.nama_penghargaan, "kejuaraan-khusus kejuaraan-pilihan"],
  ];

  LAYAR.replaceChildren(h(`
    <div class="card">
      <div class="option-row">
        <button class="button button-primary" id="cetak-juara" type="button">
          ${ikon("printer")} Cetak Daftar Juara
        </button>
      </div>
    </div>
    <div class="kejuaraan-bagian">
      ${bagian.map(([judul, masuk, label, kelas]) => `
        <section class="card ${kelas}"><h2>${esc(judul)}</h2>
          <table class="table data-table table-kejuaraan"><tbody>
            ${hasil.filter(masuk).map(x => baris(x, label(x))).join("")}
          </tbody></table>
        </section>`).join("")}
    </div>`));

  /* TIDAK async, dan itu keputusan yang sama dengan kedua tombol cetak di
     Live Score: `window.print()` harus tetap berada di dalam giliran ketukan
     jarinya. Safari iPhone memblokirnya begitu ada satu `await` lebih dulu,
     karena sesudah itu panggilannya tidak lagi dianggap datang dari pengguna.
     Seluruh daftarnya sudah di tangan sejak layar ini digambar, jadi memang
     tidak ada yang perlu ditunggu. */
  document.getElementById("cetak-juara")?.addEventListener("click", () => {
    siapkanCetakJuara(hasil, bagian);
    window.print();
  });

  LAYAR.querySelectorAll(".kejuaraan-pilih").forEach(pilih => {
    const saran = pilih.nextElementSibling;
    const isian = pilih.closest(".kejuaraan-isian");
    const terkunci = pilih.closest("td").querySelector(".kejuaraan-terkunci");
    const ubah = terkunci.querySelector(".kejuaraan-ubah");
    /* Satu kotak cari, dua macam isi: Kostum dan Terfavorit menunjuk regu,
       Pangkalan Terjauh menunjuk sekolah. Yang membedakan cuma data-jenis;
       sisanya — saran, blur, simpan, kunci lagi — sama persis. */
    const sekolahan = pilih.dataset.jenis === "sekolah";
    const golongan = pilih.dataset.golongan;
    const calon = sekolahan ? sekolah
      : golongan ? opsi.filter(r => r.golongan === golongan) : opsi;
    const kunci = (c) => sekolahan ? c.id : c.regu_id;
    const teks = (c) => sekolahan ? `${c.name} ${c.address || ""}`
      : `${c.nomor_dada} ${dada3(c.nomor_dada)} ${c.nama_regu} ${c.nama_sekolah}`;
    const isiKotak = (c) => sekolahan ? c.name : labelRegu(c);
    const gambarSaran = () => {
      const q = pilih.value.trim().toLocaleLowerCase("id");
      const ditemukan = calon
        .filter(c => teks(c).toLocaleLowerCase("id").includes(q)).slice(0, 8);
      saran.innerHTML = ditemukan.map(c => `
        <button type="button" data-pilihan="${esc(kunci(c))}">
          <strong>${esc(sekolahan ? c.name : `${dada3(c.nomor_dada)} · ${c.nama_regu}`)}</strong>
          <span class="alamat">${esc(sekolahan ? (c.address || "") : c.nama_sekolah)}</span>
        </button>`).join("");
      saran.hidden = !ditemukan.length;
    };
    pilih.addEventListener("focus", gambarSaran);
    pilih.addEventListener("input", gambarSaran);
    pilih.addEventListener("blur", () => setTimeout(() => { saran.hidden = true; }, 100));
    saran.addEventListener("mousedown", e => e.preventDefault());
    saran.addEventListener("click", async e => {
      const tombol = e.target.closest("[data-pilihan]");
      if (!tombol) return;
      const dipilih = calon.find(c => kunci(c) === tombol.dataset.pilihan);
      if (!dipilih) return;
      pilih.disabled = true;
      try {
        if (sekolahan) await simpanKejuaraanTerjauh(dipilih.id);
        else await simpanKejuaraanManual(pilih.dataset.kode, dipilih.regu_id);
        terkunci.querySelector(".kejuaraan-nilai").innerHTML = nilai(
          sekolahan ? { kode: "terjauh", nama_sekolah: dipilih.name } : dipilih);
        pilih.value = isiKotak(dipilih);
        saran.hidden = true;
        isian.hidden = true;
        terkunci.hidden = false;
        notif("Kejuaraan tersimpan.");
      } catch (e) { notif(e.message, true); }
      finally { pilih.disabled = false; }
    });
    ubah.addEventListener("click", () => {
      terkunci.hidden = true;
      isian.hidden = false;
      pilih.value = "";
      pilih.focus();
    });
  });
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

  /* .table-toolbar, bukan .option-row: option-row itu grid DUA kolom
     (style.css), jadi empat isian di dalamnya jatuh 2x2 dan kotak Pos
     yang isinya satu angka mendapat setengah lebar kartu. */
  /* Rata BAWAH, bukan rata tengah seperti toolbar saring: di sana label
     kotak carinya visually-hidden sehingga tidak memakan tinggi, di
     sini labelnya terlihat — dan rata tengah membuat tombolnya melayang
     setinggi label, tidak sejajar dengan kotak isian di sebelahnya. */
  /* .form-akun — Bentuknya sama dengan form pendaftaran: label di atas, isian
     SELEBAR kartunya. Sebelumnya ia .table-toolbar dengan lebar
     dipatok inline (14rem, 5rem) — di HP ketiganya terjepit ke kanan,
     labelnya melayang di tengah, dan kotak Pos menyusut jadi seukuran
     ibu jari. Lebar tetap di dalam wadah yang menyempit selalu
     berakhir begitu.

     Di layar lebar ia kembali sebaris lewat grid, tanpa satu pun ukuran
     dipatok tangan. */
  /* Peringatan "baru kolom Akun yang mengunci" dihapus di migrasi 0064:
     seluruh policy dan RPC sudah pindah ke boleh(), jadi kalimat itu
     tidak benar lagi. Yang tersisa satu baris, dan ia bertahan karena
     memuat akibat yang tidak bisa dibaca dari layar (CLAUDE.md 9.4):
     mengubah peran MENIMPA centang yang sudah diatur tangan. */
  /* .table-wrapper — Gaya yang sama dengan lembar Input Nilai Pos: di HP ini
     TETAP tabel dan digeser ke samping, kolom nama menempel di kiri, kepala
     tabel menempel di atas. Semua itu sudah ada di .table-pos — matriks ini
     tidak perlu aturan sendiri. */
  LAYAR.replaceChildren(h(`
    <div class="card">
      <h2>Buat Akun</h2>
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
      <p>Mengganti peran mengisi ulang centangnya.</p>
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
  if (!EDISI) { layarButuhEdisi("Foto Jawaban Sekaligus"); return; }
  pasangKepala("Foto Jawaban Sekaligus", true);
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

  /* Kamera dan Galeri dipisah jadi dua tombol, alasannya lengkap di
     bukaFotoLembar(): `capture` membuka kamera langsung tapi sekaligus
     menutup jalur galeri, jadi satu tombol tidak bisa melayani keduanya. */
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
          <input type="file" accept="image/*" capture="environment" multiple
                 hidden class="foto-ambil">
          ${ikon("camera")} Kamera
        </label>
        <label class="button button-secondary">
          <input type="file" accept="image/*" multiple hidden class="foto-ambil">
          ${ikon("image")} Galeri
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
  const elAmbil = [...document.querySelectorAll(".foto-ambil")];
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
    elGrid.replaceChildren(h(pemuat("Memuat…", { kecil: true })));
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
      elGrid.replaceChildren(h(pemuat("Memuat…", { kecil: true })));
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

  const terimaBerkas = async (inp) => {
    const berkas = [...(inp.files || [])];
    // Dikosongkan supaya memilih berkas YANG SAMA lagi tetap memicu change.
    inp.value = "";
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
  };

  // Kamera dan Galeri memakai penangan yang SAMA — yang berbeda cuma dari mana
  // berkasnya datang, dan sesudah dipilih keduanya tidak bisa dibedakan lagi.
  elAmbil.forEach(inp => inp.addEventListener("change", () => terimaBerkas(inp)));

  await isiLomba();
}

/* EMPAT PEMICU, dan semuanya perlu — masing-masing menutup keadaan yang tiga
   lainnya tidak bisa. Putaran 15 detik menghentikan dirinya saat tab
   tersembunyi: di sana ia dicekik jadi sekali semenit lalu dibekukan, jadi
   yang tersisa cuma membakar baterai. `visibilitychange` yang menyalakannya
   kembali — dan ia menyantol di pendengar yang sudah ada, yang memang tidak
   menggambar ulang apa pun. */
window.addEventListener("online", () => kirimAntrean());
setInterval(() => { if (!document.hidden) kirimAntrean(); }, 15000);

/* ============================== BUKU SAKTI ===============================

   Buku pegangan yang diserahkan ke kepanitiaan berikutnya. Isinya tinggal di
   buku-sakti.mjs sebagai data; layar ini cuma menggambarnya dan menyiapkan
   versi cetaknya.

   DIPAGARI CENTANG `pengaturan` SEJAK 5 SEPTEMBER 2026, dan itu kebalikan
   dari niat aslinya. Buku ini sengaja dibuat TANPA pagar hak akses: ia
   menjelaskan pekerjaan SELURUH panitia, dan yang paling butuh membacanya
   justru yang haknya paling sempit — juri pos yang baru pertama memegang
   lembar nilai, petugas meja yang dipindah pagi itu juga. Pemilik acara
   meminta ia ditutup dulu karena isinya masih ditulis ulang; alasan
   lengkapnya, dan cara membukanya kembali untuk seluruh panitia, ada di
   layarBukuSakti().

   Yang dijaga hak akses adalah DATA. Buku ini tidak memuat satu baris data
   pun — tidak ada nama regu, tidak ada nilai, tidak ada nomor WA pembina.

   TAUTAN DI DALAMNYA TETAP IKUT HAK. Blok "layar" menyebut fitur yang
   dibutuhkan, dan yang tidak memegangnya melihat kotak yang sama tanpa
   tautan, lengkap dengan nama centang yang harus diminta ke admin. Tautan
   yang berujung pada kartu "tidak berhak" mengajari orang bahwa buku ini
   tidak bisa dipercaya, dan buku panduan yang tidak dipercaya sama saja
   dengan tidak ada.
   ========================================================================= */

/** Bagian yang harus digulir ke tempatnya SESUDAH layar digambar ulang.
 *
 *  Daftar isi dan hasil cari sama-sama bisa menunjuk bagian di bab LAIN, dan
 *  berpindah bab berarti hash berganti, arahkan() jalan, dan seluruh DOM
 *  dibangun ulang. Elemen tujuannya belum ada saat tombolnya diketuk, jadi
 *  yang bisa dititipkan lintas penggambaran cuma kodenya. */
let bagianDitujuBuku = null;

/** Nomor bab untuk dibaca manusia: "Bab 2". Diambil dari urutannya di
 *  BUKU_SAKTI, bukan disimpan di datanya — dua tempat yang menyimpan urutan
 *  yang sama adalah dua tempat yang suatu hari tidak sepakat. */
const nomorBabBuku = (bab) => BUKU_SAKTI.indexOf(bab) + 1;

/** Satu blok isi jadi markup layar.
 *
 *  esc() di SETIAP sisipan. Teks buku ini memang ditulis panitia sendiri,
 *  tapi "ditulis orang yang kita percaya" bukan alasan yang bertahan: satu
 *  tanda kurang-dari di tengah kalimat sudah cukup membuang sisa paragrafnya,
 *  tanpa satu pun galat, dan yang menemukannya pembaca yang kehilangan
 *  separuh halaman. */
function blokBuku(blok) {
  switch (blok.jenis) {
    case "p":
      return `<p>${esc(blok.teks)}</p>`;
    case "poin":
      return `<ul class="bs-poin">${
        blok.butir.map(x => `<li>${esc(x)}</li>`).join("")}</ul>`;
    case "langkah":
      return `<ol class="bs-langkah">${
        blok.butir.map(x => `<li>${esc(x)}</li>`).join("")}</ol>`;
    case "tabel":
      /* DUA hal yang membuat tabel ini terbaca di HP, dan keduanya wajib.

         `data-label` membawa nama kolomnya, karena di bawah 900px `<thead>`
         disembunyikan dan sel tanpa label kehilangan artinya sama sekali —
         isi yang berdiri sendiri tanpa nama kolomnya.

         `data-baris` yang MENYALAKAN rupa kartunya. Tanpa atribut itu barisnya
         tetap dipecah jadi blok bertumpuk (aturan `.data-table:not(
         .table-tetap)`), tetapi tidak mendapat kotak, jarak, maupun awalan
         nama kolom — yang tergambar deretan potongan teks telanjang, dan
         labelnya justru tidak ikut. Nilainya cuma nomor urut: seluruh aturan
         di style.css memakainya sebagai penanda ADA, bukan membaca isinya. */
      return `<div class="bs-tabel-bungkus">
        <table class="table data-table bs-tabel">
          <thead><tr>${blok.kepala.map(k => `<th>${esc(k)}</th>`).join("")}</tr></thead>
          <tbody>${blok.baris.map((baris, n) => `<tr data-baris="${n}">${
            baris.map((sel, i) => `<td data-label="${esc(blok.kepala[i] || "")}">${
              esc(sel)}</td>`).join("")}</tr>`).join("")}</tbody>
        </table></div>`;
    case "kenapa":
      return `<p class="bs-kenapa">${esc(blok.teks)}</p>`;
    case "foto":
      return blokFotoBuku(blok);
    case "layar":
      return blokLayarBuku(blok);
    default:
      /* Jenis yang tidak dikenal DIAM, tidak melempar. Buku yang salah ketik
         satu jenis blok tetap terbuka dan kehilangan satu blok; kalau ia
         melempar, seluruh layar jadi kartu galat dan yang hilang seluruh
         buku. Yang menangkap salah ketiknya tes bentuk, jauh sebelum sini. */
      return "";
  }
}

/** Blok "foto": satu gambar contoh beserta keterangannya.
 *
 *  KETERANGANNYA YANG UTAMA, gambarnya pelengkap. Urutan di DOM sengaja
 *  begitu — teks lebih dulu, gambar sesudahnya — supaya bagian ini tetap
 *  berarti kalau gambarnya belum diupload, atau Supabase sedang tidak bisa
 *  dihubungi. Buku panduan paling dibutuhkan justru saat ada yang rusak.
 *
 *  `onerror` MEMBUANG gambarnya, bukan menggantinya dengan gambar cadangan.
 *  Ikon gambar-rusak bawaan browser tidak mengatakan apa-apa kepada panitia
 *  dan cuma memakan tempat; yang tersisa sesudahnya keterangan lengkap, yang
 *  memang sudah bisa berdiri sendiri. */
function blokFotoBuku(blok) {
  return `<figure class="bs-foto">
    <figcaption>${esc(blok.teks)}</figcaption>
    <img src="${esc(fotoBuku(blok.berkas))}" alt="${esc(blok.teks)}"
         loading="lazy" onerror="this.remove()"></figure>`;
}

/** Blok "layar": kotak yang menunjuk layar sungguhan, ikut hak akun. */
function blokLayarBuku(blok) {
  const isi = `<span class="bs-layar-nama">${esc(blok.nama)}</span>`
    + (blok.teks ? `<span class="bs-layar-teks">${esc(blok.teks)}</span>` : "");
  if (!blok.fitur || bolehLihat(blok.fitur)) {
    return `<a class="bs-layar" href="${esc(blok.hash)}">${isi}</a>`;
  }
  return `<div class="bs-layar bs-layar-mati">${isi}
    <span class="bs-layar-hak">Butuh centang ${
      esc(FITUR_NAMA[blok.fitur] || blok.fitur)} di layar Akun.</span></div>`;
}

/** Satu bagian bacaan.
 *
 *  TIDAK ada atribut pencarian di sini, dan itu disengaja: kotak cari
 *  membaca DATA-nya lewat cariBagian(), bukan DOM. Menaruh salinan teksnya di
 *  atribut akan membuat dua sumber untuk satu pertanyaan — dan yang di DOM
 *  itu yang basi begitu bukunya disunting sementara halamannya tidak dimuat
 *  ulang. */
function bagianBukuHtml(bagian) {
  return `<section class="card bs-bagian" id="bs-${esc(bagian.kode)}">
    <h3>${esc(bagian.judul)}</h3>
    ${bagian.isi.map(blokBuku).join("")}
  </section>`;
}

/* ------------------------------ PAPAN SPRINT -----------------------------

   Tiga belas sprint dua mingguan, dan tiap tugasnya bisa dicentang. Centangnya
   duduk di database (migrasi 0170) dan terlihat oleh seluruh panitia — papan
   rencana yang jawabannya berbeda-beda per HP bukan papan koordinasi.

   DIGAMBAR DULU, CENTANGNYA MENYUSUL.

   Layar ini tidak menunggu jaringan sebelum menggambar apa pun. Isinya berkas
   statis yang sudah ikut termuat bersama app.js, jadi papannya muncul seketika
   dengan seluruh kotak dalam keadaan kosong, lalu satu permintaan mengisinya.
   Urutan itu yang membuat janji di kepala buku-sakti.mjs tetap benar: bukunya
   terbaca walau Supabase tidak terjangkau, dan yang hilang cuma centangnya.

   Karena itu gagalnya BUKAN kartu galat. Yang tergambar sebaris kecil di
   kepala papan, dan seluruh isi bukunya tetap bisa dibaca. */

/** Centang yang sedang berlaku: kode tugas -> { dicentang_oleh, dicentang_pada }.
 *
 *  Di luar fungsi layarnya supaya kembali dari layar lain tidak mengosongkan
 *  papan sampai permintaannya selesai — papan yang berkedip kosong tiap kali
 *  pembaca menekan Back terbaca seperti centang yang hilang. */
let centangSprint = new Map();

/** Sudah pernah dibaca dari server sekali? Membedakan "belum tahu" dari
 *  "sudah tahu, dan memang kosong" — yang pertama tidak boleh dilaporkan
 *  sebagai papan yang belum dikerjakan siapa pun. */
let centangSprintTerbaca = false;

/** Tautan kecil di kaki sebuah tugas, ikut hak akun.
 *
 *  Yang tidak berhak TIDAK diberi tautan mati: tugasnya tetap terbaca lengkap,
 *  cuma tanpa jalan pintas. Menuliskan "butuh centang X" di sini seperti pada
 *  blok layar akan menambah satu baris di bawah SERATUS TUJUH tugas, dan papan
 *  yang gunanya untuk disapu cepat berhenti bisa disapu. */
function tautanTugasSprint(tugas) {
  if (!tugas.layar) return "";
  const fitur = FITUR_LAYAR[tugas.layar];
  if (fitur && !bolehLihat(fitur)) return "";
  return `<a class="bs-todo-layar" href="${esc(tugas.layar)}">${
    esc(NAMA_LAYAR[tugas.layar] || tugas.layar)}</a>`;
}

/** Satu tugas: kotak centang, teksnya, seksinya, dan jejak siapa mencentang.
 *
 *  Kotak centang DI DALAM <label> bersama teksnya, jadi seluruh kalimat jadi
 *  sasaran ketukan. Di HP, kotak 20px yang berdiri sendiri di antara seratus
 *  baris adalah sasaran yang meleset. */
function tugasSprintHtml(tugas) {
  /* Nama seksinya TIDAK ditulis lagi di sini. Tugas ini duduk di dalam
     lajur seksinya, dan kepala lajur itu menempel di atas selama papan
     digulir — jadi menuliskannya lagi di bawah tiap tugas berarti nama
     yang sama tercetak seratus enam belas kali di kolom yang seluruh
     isinya memang seksi itu. Di rentang HP, tempat kepala lajurnya
     tidak ikut turun, yang membawanya bs-sel-lajur sekali per sel. */
  return `<li class="bs-todo-item" data-tugas="${esc(tugas.kode)}">
    <label class="bs-todo-baris">
      <input type="checkbox" class="checkbox bs-todo-kotak"
             data-tugas="${esc(tugas.kode)}">
      <span class="bs-todo-teks">${esc(tugas.teks)}</span>
    </label>
    <div class="bs-todo-kaki">
      ${tautanTugasSprint(tugas)}
      <span class="bs-todo-jejak" data-jejak="${esc(tugas.kode)}"></span>
    </div>
  </li>`;
}

/** Hari ini itu H berapa, dihitung dari tanggal lomba edisi yang aktif.
 *
 *  NULL kalau edisinya belum termuat atau tanggalnya tidak terbaca. Papan ini
 *  harus tetap tergambar tanpa jaringan (janji di kepala buku-sakti.mjs), jadi
 *  ketiadaan tanggal bukan galat — yang hilang cuma penanda sekarang.
 *
 *  Dihitung di tengah hari, bukan tengah malam: selisih dua tanggal yang
 *  melewati pergantian waktu musim panas bisa jatuh 23 atau 25 jam, dan
 *  pembagian dengan 24 jam membuat hasilnya meleset satu hari. Tidak ada DST
 *  di Indonesia, tapi laptop yang zona waktunya salah setel bukan hal aneh. */
function hariIniH() {
  const tgl = EDISI && EDISI.tanggal_lomba;
  if (!tgl) return null;
  const lomba = new Date(`${tgl}T12:00:00`);
  if (Number.isNaN(lomba.getTime())) return null;
  const kini = new Date();
  const hariIni = new Date(kini.getFullYear(), kini.getMonth(), kini.getDate(), 12);
  return Math.round((hariIni - lomba) / 86400000);
}

/** Keadaan tiap sprint terhadap hari ini: "lewat", "sekarang", atau "nanti".
 *
 *  Inilah yang membuat papan ini menjawab pertanyaan yang sebenarnya dibawa
 *  panitia waktu membukanya — bukan "apa rencananya" melainkan "sekarang
 *  seharusnya sudah sampai mana". Patokannya hMulai dan hSelesai, bukan nama
 *  bulan: bulan bergeser tiap edisi, hitungan mundur dari hari-H tidak. */
function keadaanSprint(sprint, h) {
  if (h === null) return "";
  if (h > sprint.hSelesai) return "lewat";
  if (h < sprint.hMulai) return "nanti";
  return "sekarang";
}

/** Satu sel papan: tugas satu seksi di satu sprint.
 *
 *  Sel kosong tetap digambar dan tetap kosong. Di rentang papan ia yang
 *  menjaga lajur di bawahnya tetap lurus; di rentang HP ia disembunyikan CSS,
 *  karena daftar yang memuat empat belas baris kosong per sprint tidak bisa
 *  dibaca sama sekali. */
function selPapanHtml(sprint, lajur, pita) {
  const tugas = sprint.tugas.filter(t => t.seksi === lajur.judul);
  if (!tugas.length) {
    return `<div class="bs-sel bs-sel-kosong ${esc(pita)}"
                 data-lajur="${esc(lajur.judul)}"></div>`;
  }
  /* Nama seksinya ikut DI DALAM sel, dan disembunyikan di rentang papan.
     Di rentang HP kepala lajurnya tidak ikut turun bersama selnya, jadi
     tanpa baris ini tugasnya kehilangan nama pemiliknya sama sekali —
     persoalan yang sama dengan data-label pada tabel yang jadi kartu. */
  return `<div class="bs-sel ${esc(pita)}" data-lajur="${esc(lajur.judul)}">
    <span class="bs-sel-lajur i-${esc(lajur.rona)}">${esc(lajur.judul)}</span>
    <ul class="bs-todo">${tugas.map(tugasSprintHtml).join("")}</ul>
  </div>`;
}

/** Satu baris papan: kepala sprintnya, lalu satu sel per lajur seksi. */
function barisPapanHtml(sprint, lajur, h) {
  const keadaan = keadaanSprint(sprint, h);
  /* PITA SATU BARIS, dan ia menjawab persoalan yang muncul begitu garis kisi
     dibuang: tinggi sebuah baris ditentukan seksi tersibuk di sprint itu, jadi
     enam belas lajur lain berakhir kosong sepanjang beberapa ratus piksel.
     Tanpa pita, kekosongan itu terbaca sebagai papan yang bolong; dengan pita,
     ia terbaca sebagai satu sprint yang memang cuma menyibukkan sedikit seksi
     — dan mata bisa menyusuri satu sprint melintang tujuh belas lajur tanpa
     kehilangan barisnya. Sprint yang sedang berjalan mendapat pitanya sendiri. */
  const pita = keadaan === "sekarang"
    ? "bs-pita-sekarang"
    : (sprint.nomor % 2 ? "bs-pita-ganjil" : "bs-pita-genap");
  /* HANYA dua keadaan yang punya kelas, karena hanya dua yang punya aturan.
     Bentuk sebelumnya menuliskan `bs-baris-${keadaan || "netral"}`, jadi
     baris yang belum datang memakai kelas `bs-baris-nanti` dan baris yang
     tanggal lombanya belum terbaca memakai `bs-baris-netral` — dua nama yang
     tidak menggambar apa pun. Kelas mati mengundang aturan yang suatu hari
     ditulis untuknya di tempat lain, lalu berlaku tanpa ada yang mencarinya. */
  const kelas = keadaan === "sekarang" ? " bs-baris-sekarang"
    : keadaan === "lewat" ? " bs-baris-lewat" : "";
  /* .bs-sprint-waktu — Tiga patokan waktu, dan yang ketiga yang membuat papan
     ini masih berguna tahun depan: bulan boleh bergeser, hitungan mundur dari
     hari-H tidak. */
  return `<div class="bs-baris-kepala${kelas}"
       id="bs-sprint-${esc(sprint.kode)}" data-sprint="${esc(sprint.kode)}">
      <div class="bs-baris-atas">
        <span class="bs-baris-urut">${esc(String(sprint.nomor))}</span>
        <h3>${esc(sprint.tajuk)}</h3>
        <span class="bs-sprint-kemajuan" data-kemajuan="${esc(sprint.kode)}"></span>
      </div>
      <div class="bs-sprint-waktu">${esc(sprint.bulan)} · ${
        esc(sprint.rentang)} · ${esc(sprint.mundur)}</div>
      ${keadaan === "sekarang"
        ? `<span class="badge badge-green bs-baris-tanda">SEDANG BERJALAN</span>`
        : ""}
      <p class="bs-sprint-fokus">${esc(sprint.fokus)}</p>
      <p class="bs-sprint-hasil"><strong>Selesai kalau:</strong> ${
        esc(sprint.hasil)}</p>
      <p class="bs-kenapa bs-jangan">${esc(sprint.jangan)}</p>
    </div>
    ${lajur.map(l => selPapanHtml(sprint, l, pita)).join("")}`;
}

/** SELURUH papan: waktu mengalir ke bawah, seksi berjajar ke samping.
 *
 *  Bentuknya dipilih dari pertanyaan yang dibawa pembacanya. Yang membuka
 *  papan ini bertanya dua hal, dan keduanya butuh sumbu yang berbeda:
 *  "sekarang seharusnya sudah sampai mana" dibaca MENURUN, dan "seksi saya
 *  kebagian apa saja" dibaca MENURUN DI SATU LAJUR. Satu kolom per seksi
 *  menjawab keduanya dengan satu gambar.
 *
 *  Lajurnya diambil dari bab Seksi lewat lajurSeksi(), tidak ditulis ulang di
 *  sini — alasannya di sana. */
function papanSprintHtml() {
  const lajur = lajurSeksi();
  const h = hariIniH();
  /* .bs-papan-bungkus — Penggulir mendatarnya WADAH ini, tidak pernah badan
     halaman (CLAUDE.md bagian 15). Kepala lajur menempel di atas dan kepala
     sprint menempel di kiri, jadi yang digeser tidak pernah kehilangan nama
     seksinya maupun nomor sprintnya. */
  return `<div class="bs-legenda">
      ${lajur.map(l => `<button type="button" class="bs-legenda-chip i-${
        esc(l.rona)}" data-sorot="${esc(l.judul)}">${esc(l.singkat)}<span
        class="bs-legenda-hitung" data-lajur-hitung="${esc(l.judul)}"></span></button>`).join("")}
    </div>
    <div class="bs-papan-bungkus">
      <div class="bs-papan" style="--lajur:${lajur.length}">
        <div class="bs-papan-sudut">Sprint</div>
        ${lajur.map(l => `<div class="bs-lajur-kepala i-${esc(l.rona)}"
             data-lajur="${esc(l.judul)}"
             title="${esc(l.judul)}">${esc(l.singkat)}</div>`).join("")}
        ${SPRINT.map(s => barisPapanHtml(s, lajur, h)).join("")}
      </div>
    </div>`;
}

/** Gambar ulang kotak centang, jejak, dan lencana kemajuan dari `centangSprint`.
 *
 *  MENYENTUH SEL YANG SUDAH ADA, tidak membangun ulang papannya. Membangun
 *  ulang akan memindahkan kotak tepat sebelum jempol turun, dan melempar
 *  gulirannya ke atas di tengah rapat — persis alasan layar lain berhenti
 *  menggambar ulang pada `visibilitychange`. */
function segarkanPapanSprint() {
  const papan = document.getElementById("bs-panel-sprint");
  if (!papan) return;

  for (const kotak of papan.querySelectorAll("[data-tugas].bs-todo-kotak")) {
    const c = centangSprint.get(kotak.dataset.tugas);
    kotak.checked = !!c;
  }
  for (const jejak of papan.querySelectorAll("[data-jejak]")) {
    const c = centangSprint.get(jejak.dataset.jejak);
    /* Jejak dibiarkan KOSONG kalau belum dicentang, bukan diisi "belum".
       Seratus tujuh baris "belum" adalah seratus tujuh baris yang tidak
       mengatakan apa-apa, dan yang dicari mata justru yang sudah selesai. */
    jejak.textContent = c
      ? `${c.dicentang_oleh || "panitia"} · ${berapaLalu(c.dicentang_pada)}`
      : "";
  }
  for (const lencana of papan.querySelectorAll("[data-kemajuan]")) {
    const sprint = SPRINT.find(s => s.kode === lencana.dataset.kemajuan);
    if (!sprint) continue;
    const selesai = sprint.tugas.filter(t => centangSprint.has(t.kode)).length;
    const penuh = selesai === sprint.tugas.length;
    lencana.className = `badge bs-sprint-kemajuan ${
      penuh ? "badge-green" : "badge-kemajuan"}`;
    lencana.textContent = `${selesai}/${sprint.tugas.length}`;
  }

  /* TERLAMBAT, dan ini yang membuat papan menjawab pertanyaan yang dibawa
     pembacanya. Tugas di sprint yang sudah LEWAT tetapi belum tercentang
     ditandai; yang belum lewat tidak, betapapun kosongnya. Tanpa pemisahan
     itu papan yang baru dibuka di bulan pertama tampak merah seluruhnya dan
     berhenti berarti apa-apa.

     Ditandai di sini, bukan waktu menggambar, karena ia bergantung pada
     centang yang datangnya menyusul dari server. */
  const h = hariIniH();
  const telat = new Set();
  if (h !== null) {
    for (const sprint of SPRINT) {
      if (keadaanSprint(sprint, h) !== "lewat") continue;
      for (const t of sprint.tugas) if (!centangSprint.has(t.kode)) telat.add(t.kode);
    }
  }
  for (const item of papan.querySelectorAll(".bs-todo-item[data-tugas]")) {
    item.classList.toggle("bs-todo-telat", telat.has(item.dataset.tugas));
  }

  /* Hitungan per lajur: berapa tugas seksi itu yang belum selesai. Angka nol
     DIHILANGKAN, tidak ditulis 0 — yang dicari mata di legenda ini justru
     seksi yang masih punya sisa, dan tujuh belas angka nol menutupinya. */
  for (const hitung of papan.querySelectorAll("[data-lajur-hitung]")) {
    const nama = hitung.dataset.lajurHitung;
    const sisa = tugasSprint()
      .filter(x => x.tugas.seksi === nama && !centangSprint.has(x.tugas.kode)).length;
    hitung.textContent = sisa ? String(sisa) : "";
  }

  const ringkas = document.getElementById("bs-sprint-ringkas");
  if (ringkas) {
    const semua = tugasSprint();
    const selesai = semua.filter(x => centangSprint.has(x.tugas.kode)).length;
    ringkas.textContent = centangSprintTerbaca
      ? `${selesai} dari ${semua.length} tugas selesai.`
      : "Centang belum terbaca — papan ini tetap bisa dibaca, tetapi yang "
        + "tercentang belum tentu tergambar.";
    ringkas.classList.toggle("bs-sprint-putus", !centangSprintTerbaca);
  }
}

/** Ambil centang dari server lalu gambar ulang. Gagalnya ditelan.
 *
 *  Sengaja TIDAK melempar dan tidak memanggil notif(): membuka buku panduan
 *  saat sinyal mati adalah hal yang wajar dilakukan orang, dan kotak merah
 *  yang muncul tiap kali bukunya dibuka mengajari orang menutupnya tanpa
 *  membaca. Yang memberitahukannya satu baris kecil di kepala papan. */
async function muatCentangSprint() {
  try {
    const baris = await daftarCentangSprint();
    centangSprint = new Map((baris || []).map(x => [x.kode, x]));
    centangSprintTerbaca = true;
  } catch {
    centangSprintTerbaca = false;
  }
  segarkanPapanSprint();
}

function layarBukuSakti() {
  /* LEBAR BIASA (760px), bukan `wide`.

     Layar meja memakai 1080px supaya tabelnya muat; layar ini bacaan, dan
     baris sepanjang 1054px membuat mata kehilangan awal baris berikutnya tiap
     kali ia kembali ke kiri. Diukur di browser: pada lebar biasa satu baris
     paragraf jatuh di sekitar 68 huruf — persis rentang yang nyaman dibaca
     panjang-panjang.

     Wadahnya yang dibatasi, bukan paragrafnya. Kalau `max-width` ditaruh di
     kartu bagian saja, kartu bacaan jadi 686px sementara kepala, deret tab,
     dan kartu bab tetap 1054px — empat tepi kiri-kanan yang tidak sejajar di
     satu halaman, dan itu terbaca seperti tata letak yang rusak, bukan
     seperti kolom bacaan. */
  pasangKepala("Buku Sakti");
  /* DIPAGARI SEMENTARA, dan ini kebalikan dari niat aslinya.

     Buku ini dulu terbuka untuk semua akun panitia, karena yang paling butuh
     membacanya justru yang haknya paling sempit. Sejak 5 September 2026 ia
     dipagari centang `pengaturan` atas permintaan pemilik acara: isinya masih
     ditulis ulang, dan buku panduan yang berubah tiap jam menyesatkan
     pembacanya lebih banyak daripada menolongnya.

     Yang dipakai centang, BUKAN nama akun (CLAUDE.md 13.1). Menuliskan
     "admin.ciradyka" di sini akan patah begitu username itu diganti — layar
     Akun bisa menggantinya — dan pagarnya tidak akan kelihatan di matriks
     centang tempat panitia mengurus hak. Membukanya kembali untuk seluruh
     panitia nanti cukup mengembalikan baris ini beserta FITUR_LAYAR. */
  if (!bolehLihat("pengaturan")) {
    LAYAR.replaceChildren(h(kartuGalat(
      "Akun ini tidak berhak membuka Buku Sakti.")));
    return;
  }
  const diminta = ekorRute(location.hash);
  const bab = BUKU_SAKTI.find(b => b.kode === diminta) || BUKU_SAKTI[0];

  /* SELURUH BAB DIGAMBAR SEKALIGUS, yang tidak terpilih disembunyikan.

     Isinya statis dan tidak menyentuh jaringan sama sekali, jadi harganya
     cuma DOM — dan yang dibeli dengan itu kotak cari yang menyapu seluruh
     buku tanpa satu pun penggambaran ulang, termasuk bab yang sedang tidak
     terbuka. Menggambar per bab akan menuntut kotak cari punya salinan
     teksnya sendiri, dan salinan itu yang suatu hari tidak sepakat dengan
     yang tergambar. */
  const panel = BUKU_SAKTI.map(b => `
    <div class="bs-panel" data-bab="${esc(b.kode)}"${b === bab ? "" : " hidden"}>
      <div class="card bs-bab">
        <div class="bs-bab-kepala">
          ${ikonKotak(b.ikon, b.warna)}
          <div>
            <h2>Bab ${esc(String(nomorBabBuku(b)))} — ${esc(b.judul)}</h2>
            <p class="description">${esc(b.ringkas)}</p>
          </div>
        </div>
        ${b.kode === "timeline" ? "" : `
        <nav class="bs-isi" aria-label="Daftar isi ${esc(b.judul)}">
          <ol>${b.bagian.map(bagian =>
            `<li><button type="button" class="bs-ke"
                         data-ke="bs-${esc(bagian.kode)}">${
              esc(bagian.judul)}</button></li>`).join("")}</ol>
        </nav>`}
      </div>
      ${b.kode === "timeline"
        ? `<div class="bs-timeline" id="bs-panel-sprint">
             <p class="description" id="bs-sprint-ringkas"></p>
             ${papanSprintHtml()}
           </div>`
        : b.bagian.map(bagianBukuHtml).join("")}
    </div>`).join("");

  /* .description — Satu kalimat, dan ia membawa fakta yang tidak ada di
     judulnya: siapa yang menulis buku ini dan kapan ia ditulis ulang. Tanpa
     itu pembaca tidak tahu bahwa isinya boleh — dan harus — diubah. */
  /* .tab-golongan — NAV BERISI TAUTAN, bukan role="tablist" berisi role="tab".
     Bentuknya memang meminjam pil tab Live Score, tapi yang di sini
     benar-benar TAUTAN: mengetuknya mengganti alamat dan menambah entri
     Back, sementara sebuah tab tidak pindah halaman. Pembaca layar yang
     diberi tahu "tab" lalu mendapat perpindahan halaman kehilangan
     tempatnya. Yang menandai bab terbuka aria-current="page" — penanda
     yang memang untuk satu tautan di antara sekelompok tautan. */
  LAYAR.replaceChildren(h(`
    <div class="card bs-kepala">
      <h2>Buku Sakti — ${esc(EDISI ? EDISI.name : "HRCD")}</h2>
      <p class="description">Ditulis ulang tiap serah terima jabatan oleh
        panitia yang turun, untuk panitia yang naik.</p>
      <div class="bs-alat">
        <label class="visually-hidden" for="bs-cari">Cari isi buku</label>
        <input type="search" id="bs-cari" autocomplete="off"
               placeholder="Cari isi buku…">
        <div class="bs-cetak">
          <button class="button button-secondary button-small" id="bs-cetak-bab"
                  type="button">${ikon("printer")} Cetak Bab Ini</button>
          <button class="button button-primary button-small" id="bs-cetak-semua"
                  type="button">${ikon("printer")} Cetak Semua</button>
        </div>
      </div>
    </div>

    <nav class="tab-golongan bs-tab" aria-label="Bab">
      ${BUKU_SAKTI.map(b => `
        <a class="tab-gol" href="#/buku-sakti/${esc(b.kode)}"${
          b === bab ? ' aria-current="page"' : ""}>
          ${esc(b.tab)}
          <span class="tab-hitung">${esc(String(
            b.kode === "timeline" ? SPRINT.length : b.bagian.length))}</span>
        </a>`).join("")}
    </nav>

    <div class="card bs-hasil" id="bs-hasil" hidden></div>
    <div id="bs-panel-semua">${panel}</div>
  `));

  /* sinyalLayarBaru(), BUKAN `pengendaliLayar.signal`.

     arahkan() memanggil `pengendaliLayar.abort()` sebelum menggambar layar
     berikutnya dan TIDAK membuat pengendali baru — yang membuatnya cuma
     fungsi ini. Jadi sinyal yang dibaca langsung dari `pengendaliLayar` di
     sini sudah dalam keadaan aborted, dan `addEventListener` dengan sinyal
     seperti itu diam saja: tidak melempar, tidak memperingatkan, tidak
     memasang apa pun.

     Ditulis sepanjang ini karena gagalnya tidak terlihat. Layarnya tergambar
     lengkap, tab-nya berpindah (itu tautan, bukan pendengar), dan yang mati
     cuma kotak cari serta daftar isinya — dua hal yang baru dicoba orang
     sesudah beberapa menit membaca. */
  const sinyal = sinyalLayarBaru();
  const elCari = document.getElementById("bs-cari");
  const elHasil = document.getElementById("bs-hasil");
  const elSemua = document.getElementById("bs-panel-semua");

  /** Gulir ke satu bagian dan tandai sebentar supaya mata menemukannya.
   *
   *  Tanpa penandaan, melompat ke bagian kesebelas dari daftar isi mendarat
   *  di tengah tembok teks yang semuanya berupa kartu putih seukuran sama,
   *  dan yang melompat harus membaca judulnya untuk memastikan ia sampai di
   *  tempat yang benar. */
  const gulirKe = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ block: "start", behavior: "smooth" });
    el.classList.add("bs-sorot");
    setTimeout(() => el.classList.remove("bs-sorot"), 1600);
  };

  if (bagianDitujuBuku) {
    const tujuan = bagianDitujuBuku;
    bagianDitujuBuku = null;
    // Satu putaran ditunggu: elemennya baru saja masuk DOM dan belum punya
    // posisi, jadi scrollIntoView() yang dipanggil sekarang mendarat di 0.
    setTimeout(() => gulirKe(tujuan), 0);
  }

  /* KOTAK CARI MENYAPU SELURUH BUKU, bukan bab yang sedang terbuka.

     Yang mengetik "gembok" tidak tahu — dan tidak perlu tahu — bahwa gembok
     dijelaskan di bab Menjalankan HRCD dan disinggung lagi di bab Seksi.
     Kotak yang cuma menyaring bab yang kebetulan terbuka menjawab "tidak
     ketemu" untuk kata yang jelas-jelas ada di bukunya. */
  const saring = () => {
    const kata = elCari.value.trim();
    if (!kata) {
      elHasil.hidden = true;
      elSemua.hidden = false;
      return;
    }
    const bagian = cariBagian(kata);
    const sprint = cariSprint(kata);
    const jumlah = bagian.length + sprint.length;
    elSemua.hidden = true;
    elHasil.hidden = false;
    elHasil.replaceChildren(h(`<div>
      <p class="description">${jumlah === 0
        ? "Tidak ada bagian yang memuat semua kata itu."
        : `${esc(String(jumlah))} bagian memuat semua kata itu.`}</p>
      <ul class="bs-hasil-daftar">
        ${bagian.map(({ bab: b, bagian: g }) => `
          <li><button type="button" class="bs-hasil-butir"
                      data-bab="${esc(b.kode)}" data-ke="bs-${esc(g.kode)}">
            <span class="bs-hasil-bab">Bab ${esc(String(nomorBabBuku(b)))} · ${
              esc(b.judul)}</span>
            <span class="bs-hasil-judul">${esc(g.judul)}</span>
          </button></li>`).join("")}
        ${sprint.map(sp => `
          <li><button type="button" class="bs-hasil-butir"
                      data-bab="timeline" data-ke="bs-sprint-${esc(sp.kode)}">
            <span class="bs-hasil-bab">Sprint ${esc(String(sp.nomor))} · ${
              esc(sp.bulan)} ${esc(sp.rentang)}</span>
            <span class="bs-hasil-judul">${esc(sp.tajuk)}</span>
          </button></li>`).join("")}
      </ul>
    </div>`));
  };
  elCari.addEventListener("input", saring, { signal: sinyal });

  /* KOTAK CENTANG PAPAN SPRINT.

     Bentuknya sama persis dengan matriks hak di layar Akun, dan itu disengaja
     — panitia yang sudah pernah mencentang di sana tidak perlu belajar apa
     pun yang baru:

       diredupkan selagi disimpan, BUKAN di-disable (.checkbox.saving);
       ketukan beruntun DIANTREKAN, bukan diblokir, supaya salah centang bisa
         langsung dibatalkan;
       ditolak server = kotaknya DIKEMBALIKAN, karena kotak yang tetap
         tercentang padahal servernya menolak adalah kebohongan yang baru
         ketahuan besok.

     Satu antrean untuk SELURUH papan: dua ketukan pada tugas yang sama harus
     mendarat urut, dan urutan itulah yang menentukan keadaan akhirnya. */
  let antreCentang = Promise.resolve();
  LAYAR.addEventListener("change", (ev) => {
    const kotak = ev.target.closest(".bs-todo-kotak");
    if (!kotak) return;
    const kode = kotak.dataset.tugas;
    const mau = kotak.checked;
    kotak.classList.add("saving");
    antreCentang = antreCentang.then(async () => {
      try {
        await setCentangSprint(kode, mau);
        /* Jejaknya dibaca ULANG dari server, tidak ditebak di sini. Yang
           tercatat siapa yang MENYELESAIKAN — dan kalau orang lain sudah
           mencentangnya lebih dulu, yang benar namanya, bukan nama kita. */
        await muatCentangSprint();
      } catch (e) {
        kotak.checked = !mau;
        notif(e instanceof ErrorApi ? e.message : "Centang gagal disimpan.", true);
      } finally {
        kotak.classList.remove("saving");
      }
    });
  }, { signal: sinyal });

  /* Dimuat SESUDAH layarnya tergambar, dan tanpa await: papan sprint muncul
     seketika dengan kotak kosong, lalu terisi. Membalik urutannya berarti
     seluruh buku menunggu satu permintaan jaringan yang boleh saja tidak
     pernah dijawab. */
  segarkanPapanSprint();
  muatCentangSprint();

  /* SOROT SATU LAJUR SEKSI.
   *
   *  Papannya tujuh belas lajur, dan yang membukanya hampir selalu mencari
   *  satu: seksinya sendiri. Menyorot dikerjakan JavaScript, bukan CSS,
   *  karena yang harus diredupkan tersebar di enam belas kolom lain — tidak
   *  ada selektor yang bisa menyebut "kolom yang bukan yang ini" tanpa nama
   *  seksinya ikut ditulis ke dalam stylesheet.
   *
   *  Menyorot lagi seksi yang sama mematikannya. Tanpa itu satu-satunya jalan
   *  kembali ke papan penuh adalah memuat ulang halaman. */
  let lajurTersorot = null;
  const sorotLajur = (nama) => {
    lajurTersorot = nama;
    for (const el of LAYAR.querySelectorAll("[data-lajur]")) {
      el.classList.toggle("bs-redup", !!nama && el.dataset.lajur !== nama);
    }
    for (const chip of LAYAR.querySelectorAll("[data-sorot]")) {
      chip.classList.toggle("bs-legenda-aktif", chip.dataset.sorot === nama);
    }
    if (!nama) return;

    /* DIBAWA KE DEPAN MATA, bukan cuma disorot.
       Di layar 1440px cuma empat lajur dari tujuh belas yang terlihat
       sekaligus, jadi menyorot lajur kedua belas tanpa menggesernya membuat
       legendanya terasa seperti tombol mati: yang berubah ada, tetapi di luar
       layar. Yang digeser wadahnya sendiri, mendatar saja — scrollIntoView()
       akan ikut menggeser halaman tegak dan melempar papannya dari layar. */
    const kepala = LAYAR.querySelector(`.bs-lajur-kepala[data-lajur="${CSS.escape(nama)}"]`);
    const bungkus = LAYAR.querySelector(".bs-papan-bungkus");
    if (!kepala || !bungkus) return;
    const sudut = LAYAR.querySelector(".bs-papan-sudut");
    // Lebar kolom sprint yang menempel di kiri dikurangkan, kalau tidak lajur
    // yang dituju berhenti tepat DI BAWAH kolom itu dan tetap tidak terlihat.
    const tertutup = sudut ? sudut.getBoundingClientRect().width : 0;
    const geser = kepala.offsetLeft - tertutup - 8;
    bungkus.scrollTo({ left: Math.max(0, geser), behavior: "smooth" });
  };

  LAYAR.addEventListener("click", (ev) => {
    const chip = ev.target.closest(".bs-legenda-chip");
    if (chip) {
      sorotLajur(chip.dataset.sorot === lajurTersorot ? null : chip.dataset.sorot);
      return;
    }
    const ke = ev.target.closest(".bs-ke");
    if (ke) { gulirKe(ke.dataset.ke); return; }
    const hasil = ev.target.closest(".bs-hasil-butir");
    if (!hasil) return;

    /* KOTAK CARI DIKOSONGKAN LEBIH DULU, dan itu bukan kerapian.

       Selama mencari, `#bs-panel-semua` disembunyikan — seluruh isi buku ada
       di dalamnya. `scrollIntoView()` pada elemen di dalam `display: none`
       tidak melakukan apa pun dan tidak melempar apa pun, jadi mengetuk hasil
       cari yang bagiannya ada di bab yang SEDANG terbuka terasa seperti
       tombol mati. Persis itu yang terjadi sebelum baris ini ada.

       saring() dipanggil, bukan `hidden` yang disetel tangan: yang memutuskan
       panel mana terlihat cuma satu fungsi, dan dua tempat yang memutuskan
       hal yang sama adalah dua tempat yang suatu hari tidak sepakat. */
    elCari.value = "";
    saring();

    /* Berpindah bab mengganti hash, dan penggambaran ulanglah yang menggulir
       — lewat bagianDitujuBuku. Kalau babnya SAMA, hash-nya tidak berubah,
       hashchange tidak pernah datang, dan tidak ada penggambaran ulang: di
       situ gulirnya harus dikerjakan langsung. */
    if (hasil.dataset.bab === bab.kode) { gulirKe(hasil.dataset.ke); return; }
    bagianDitujuBuku = hasil.dataset.ke;
    location.hash = `#/buku-sakti/${hasil.dataset.bab}`;
  }, { signal: sinyal });

  /* SATU PARAMETER, SATU ARTI: bab yang dicetak, atau null untuk seluruhnya.

     Sebelumnya dua — `(babSatu, ikutTimeline)` — dan `babSatu === null` sudah
     dipakai untuk arti "semua bab". Akibatnya papan sprint tidak punya cara
     diungkapkan sama sekali: "Cetak Bab Ini" di tab Sprint memanggil
     `(null, true)`, argumen yang SAMA PERSIS dengan tombol di sebelahnya,
     dan yang keluar seluruh buku. Tombolnya melakukan kebalikan dari
     namanya, tanpa satu pun galat. */
  document.getElementById("bs-cetak-bab").addEventListener("click", () => {
    siapkanCetakBuku(bab);
    window.print();
  }, { signal: sinyal });
  document.getElementById("bs-cetak-semua").addEventListener("click", () => {
    siapkanCetakBuku(null);
    window.print();
  }, { signal: sinyal });
}

/* ---------------------------------------------------------------------------
   CETAK BUKU SAKTI

   Buku ini digandakan di mesin fotokopi seperti seluruh kertas acara ini,
   jadi aturan CLAUDE.md bagian 8 berlaku penuh: tidak ada blok hitam, tidak
   ada teks terbalik, tidak ada abu dan raster, garis paling tipis 0,75pt,
   huruf paling kecil 7pt.

   SATU DOKUMEN MENGALIR PER BAB, bukan satu lembar per bagian. Empat puluh
   bagian berarti empat puluh lembar untuk isi yang muat di belasan, dan
   tumpukan setebal itu tidak dibaca siapa pun. Yang dijaga cuma satu bagian
   tidak terbelah dua halaman, lewat `break-inside: avoid`.

   Daftar isinya TANPA nomor halaman. Nomor halaman hanya bisa benar kalau
   dihitung dari hasil paginasi browser, dan itu berbeda antar peranti dan
   antar ukuran kertas — daftar isi yang menyebut halaman 12 sementara
   bagiannya di halaman 14 lebih buruk daripada daftar isi tanpa angka sama
   sekali.
   --------------------------------------------------------------------------- */

/** Blok isi jadi markup KERTAS. Bedanya dari blokBuku() cuma satu, dan itu
 *  yang membuat fungsi ini ada: blok "layar" kehilangan tautannya. Alamat
 *  `#/pembayaran` di atas kertas tidak bisa diketuk dan tidak memberi tahu
 *  apa pun kepada yang membacanya — yang berguna tinggal nama layarnya. */
function blokBukuCetak(blok) {
  /* Foto TIDAK ikut ke kertas, dan itu bukan penghematan tinta.
     Buku ini digandakan di mesin fotokopi seperti blangko, dan foto adalah
     raster abu-abu — persis yang dilarang CLAUDE.md bagian 8: ia keluar kotor
     atau hilang sama sekali pada salinan kedua. Yang tercetak keterangannya,
     yang memang sudah ditulis supaya berdiri sendiri. */
  if (blok.jenis === "foto") return `<p>${esc(blok.teks)}</p>`;
  if (blok.jenis !== "layar") return blokBuku(blok);
  return `<p class="bs-cetak-layar"><strong>${esc(blok.nama)}</strong>${
    blok.teks ? ` — ${esc(blok.teks)}` : ""}</p>`;
}

function siapkanCetakBuku(babSatu) {
  document.getElementById("cetakan")?.remove();
  const dicetak = tanggalJam(new Date().toISOString());
  const judulEdisi = EDISI ? EDISI.name : "HRCD";

  /* SATU DAFTAR BAB, dan papan sprint ikut di dalamnya sebagai bab biasa.
     `babSatu` null berarti seluruh buku; selain itu tepat satu bab — termasuk
     kalau yang dipilih papan sprint. Tidak ada sentinel yang memikul dua arti
     di sini (lihat komentar di tombolnya). */
  const babCetak = babSatu ? [babSatu] : BUKU_SAKTI;
  const babBacaan = babCetak.filter(b => b.bagian.length);
  const adaSprint = babCetak.some(b => b.kode === "timeline") && SPRINT.length > 0;

  const daftarIsi = `
    <h2>Daftar Isi</h2>
    ${babBacaan.map(b => `
      <p class="bs-cetak-isi-bab">Bab ${esc(String(nomorBabBuku(b)))} — ${
        esc(b.judul)}</p>
      <ul class="bs-cetak-isi">${b.bagian.map(g =>
        `<li>${esc(g.judul)}</li>`).join("")}</ul>`).join("")}
    ${adaSprint ? `
      <p class="bs-cetak-isi-bab">Papan Sprint Satu Edisi</p>
      <ul class="bs-cetak-isi">${SPRINT.map(sp =>
        `<li>Sprint ${esc(String(sp.nomor))} · ${esc(sp.bulan)} ${
          esc(sp.rentang)} — ${esc(sp.tajuk)}</li>`).join("")}</ul>` : ""}`;

  const halamanBab = babBacaan.map(b => `
    <section class="print-page">
      <h1>Bab ${esc(String(nomorBabBuku(b)))} — ${esc(b.judul)}</h1>
      <p class="bs-cetak-ringkas">${esc(b.ringkas)}</p>
      ${b.bagian.map(g => `
        <section class="bs-cetak-bagian">
          <h2>${esc(g.judul)}</h2>
          ${g.isi.map(blokBukuCetak).join("")}
        </section>`).join("")}
    </section>`).join("");

  /* KOTAK CENTANG DICETAK KOSONG, SELALU — tidak peduli apa yang tercentang
     di layar.

     Kertas ini ditempel di dinding sekretariat dan dicentang pakai pulpen
     sepanjang enam bulan. Mencetak keadaan hari ini membuatnya jadi POTRET,
     dan potret yang ditempel di dinding berhenti benar keesokan harinya
     sementara kotak-kotak yang sudah tercetak hitam tidak bisa dibatalkan
     lagi oleh siapa pun.

     Kotaknya juga tetap PUTIH dan kosong — CLAUDE.md 8.7 melarang apa pun di
     belakang area yang ditulisi tangan. */
  const halamanSprint = !adaSprint ? "" : `
    <section class="print-page">
      <h1>Papan Sprint Satu Edisi</h1>
      <p class="bs-cetak-ringkas">Tiga belas sprint dua mingguan. Tanggalnya
        dihitung mundur dari hari-H, jadi papan ini tetap berlaku pada edisi
        yang bulannya bergeser. Kotaknya sengaja tercetak kosong: yang di
        layar berubah tiap hari, yang di dinding dicentang pakai pulpen.</p>
      <table class="print-table">
        <thead><tr><th>Sprint</th><th>Waktu</th><th>Tajuk</th><th>Tugas</th></tr></thead>
        <tbody>${SPRINT.map(sp => `<tr>
          <td class="text-center">${esc(String(sp.nomor))}</td>
          <td>${esc(sp.bulan)} ${esc(sp.rentang)}<br>${esc(sp.mundur)}</td>
          <td>${esc(sp.tajuk)}</td>
          <td class="text-center">${esc(String(sp.tugas.length))}</td></tr>`).join("")}</tbody>
      </table>
      ${SPRINT.map(sp => `
        <section class="bs-cetak-bagian">
          <h2>Sprint ${esc(String(sp.nomor))} — ${esc(sp.tajuk)}</h2>
          <p class="bs-cetak-waktu">${esc(sp.bulan)} ${esc(sp.rentang)} · ${
            esc(sp.mundur)}</p>
          <p>${esc(sp.fokus)}</p>
          <ul class="bs-cetak-todo">${sp.tugas.map(t => `
            <li><span class="bs-cetak-kotak"></span>
              <span class="bs-cetak-todo-teks">${esc(t.teks)}
                <em>${esc(t.seksi)}</em></span></li>`).join("")}</ul>
          <p class="bs-cetak-label">Selesai kalau</p>
          <p>${esc(sp.hasil)}</p>
          <p class="bs-kenapa">${esc(sp.jangan)}</p>
        </section>`).join("")}
    </section>`;

  document.body.appendChild(h(`<div id="cetakan" class="printout buku-cetak">
    <section class="print-page">
      <h1>BUKU SAKTI — ${esc(judulEdisi)}</h1>
      <p class="bs-cetak-ringkas">Buku pegangan panitia. Ditulis ulang tiap
        serah terima jabatan oleh panitia yang turun, untuk panitia yang naik.</p>
      ${daftarIsi}
      <p class="print-note">Dicetak ${esc(dicetak)}.</p>
    </section>
    ${halamanBab}
    ${halamanSprint}
  </div>`));
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
