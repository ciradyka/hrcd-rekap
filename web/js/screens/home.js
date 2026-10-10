/* ============================================================================
   hrcd-rekap : screens/home.js — layar Home (#/home).

   Papan ubin: satu ubin per layar yang boleh dibuka akun ini, dengan jumlah
   antreannya.
   ========================================================================== */

import { bolehLihat, ringkasanMeja, sesi } from "../api.js";
import { kartuGalat, LAYAR, pasangKepala } from "../common/frame.js";
import { esc, h, ikon, ikonKotak, pemuat } from "../util.js";

/* ============================ BERANDA MEJA (home) ========================= */

export async function layarHome() {
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
