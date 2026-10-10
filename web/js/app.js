/* ============================================================================
   hrcd-rekap : app.js — aplikasi panitia (tahap 2).
   Aturan bentuk (rancangan-b.md 10.1): kerangka sama di semua layar,
   satu aksi utama per layar, kunci di-autofocus, echo-confirm sebelum simpan,
   "baris terakhir" di kaki, gagal itu nyaring dan lokal.

   Semua teks dari luar (nama sekolah/regu/ketua, pesan server) WAJIB lewat
   esc() atau tag html`` — lihat util.js.
   ========================================================================== */

import { sesi, masuk, keluar, gantiPasswordSendiri, ErrorApi, infoEdisi,
         ringkasanMeja, daftarPos, komponenPos, cacheLiveScore, tautanFoto,
         hasilKejuaraan, simpanKejuaraanManual, simpanKejuaraanTerjauh,
         daftarSekolah, unggahFotoMasuk, daftarFotoBelumTaut, tautkanFoto,
         kuotaFoto, bolehLihat, lengkapiHakSesi, daftarAkun, ubahPeranAkun,
         setAktifAkun, buatAkun, resetPasswordAkun, daftarPanitia,
         ubahUsernameAkun, daftarFitur, daftarHak, setHak } from "./api.js";
import { esc, h, jamMenit, tanggalJam, notif, dialog, kartuGagalMuat, pemuat,
         kecilkanFoto, ukuranRapi, ikon, ikonKotak, dada3, angkaRapi, kolomPos,
         GOLONGAN_LABEL, kelompokLomba } from "./util.js";
import { aturEdisi, aturHashLayar, aturRouter, aturSegarkanDiTempat, EDISI,
         hashLayar, kartuGalat, LAYAR, layarButuhEdisi, pangkalRute,
         pasangKepala, pengendaliLayar, putusSaatPindah, segarkanDiTempat,
         sinyalLayarBaru } from "./common/frame.js";
import { antreanTertunda, judulPos,
         kirimAntrean } from "./common/nilai-pos.js";
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
