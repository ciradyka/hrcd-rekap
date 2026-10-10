/* ============================================================================
   hrcd-rekap : screens/cek-nilai.js — layar Cek Nilai (#/cek-nilai).

   Satu regu pada satu waktu: angka yang tersimpan di sebelah foto slipnya,
   untuk dibandingkan dengan tulisan tangan lalu digembok.
   ========================================================================== */

import { bolehLihat, bukaKunciNilaiPos, daftarFotoLembar, fotoLembarPos,
         kunciNilaiPos, lembarPos, lembarPosSatu, putarFotoLembar, sesi,
         tautanFotoBanyak } from "../api.js";
import { chipSaringHtml, kartuGalat, LAYAR, pasangDada3, pasangKepala,
         putusSaatPindah, sinyalLayarBaru,
         tandaiChip } from "../common/frame.js";
import { gambarPitaAntrean, judulPos, kartuReguNilai, kirimAntrean,
         kirimNilaiRegu, muatKatalogPos, posUntukAkun,
         selKomponen } from "../common/nilai-pos.js";
import { dada3, esc, h, ikon, kapital, kartuGagalMuat, katalogLomba, notif,
         pemuat, reguBelumFoto, reguBelumInput, reguBelumKunci, tanggalJam,
         varianUntuk } from "../util.js";

/* ============================== CEK NILAI ================================

   Satu regu satu layar: foto slipnya di sebelah angka yang diketik DARI slip
   itu. Yang dijawabnya cuma satu pertanyaan — "angka ini memang angka yang
   tertulis di kertasnya?" — dan itu pertanyaan yang tidak bisa dijawab di
   layar mana pun yang sudah ada: lembar pos memperlihatkan angkanya tanpa
   gambarnya, layar Foto Jawaban memperlihatkan gambarnya tanpa angkanya.

   BOLEH MENGUBAH, dan itu keputusan yang sempat berbunyi sebaliknya.

   Versi pertama layar ini sengaja membaca saja, dengan alasan "yang memeriksa
   bukan yang mengetik". Alasan itu gugur begitu perannya dipisah: layar Input
   Nilai Pos v2 dipakai JURI dan tim input per lomba, layar ini dipakai ADMIN
   SERVER — orang yang berbeda, di meja yang berbeda. Pemisahan yang dijaga
   peran tidak perlu dijaga lagi dengan mengunci layarnya, dan admin yang
   menemukan angka salah tetapi tidak bisa membetulkannya cuma memindahkan
   pekerjaan itu ke orang lain lewat pesan WhatsApp.

   Yang menyimpan tetap SATU PINTU, kirimNilaiRegu(), bersama layar input.
   Keempat aturannya — kotak tak terbaca tidak menyentuh angka lama, kotak
   kosong berarti hapus, angka yang sama tidak dikirim ulang, gagal jaringan
   masuk antrean — berlaku sama di kedua layar karena memang kode yang sama.
   ======================================================================== */

export async function layarCekNilai() {
  const s = sesi();
  /* HAK `pengaturan`, BUKAN `pos`.

     Layar Input Nilai Pos v2 dipakai juri dan tim input per lomba; layar ini
     dipakai admin server. Selama pagarnya `pos`, setiap juri bisa membukanya —
     dan sejak layar ini boleh mengubah nilai dan MENGUNCI, itu berarti setiap
     juri bisa mengunci nilai regu mana pun di posnya, termasuk lomba yang
     bukan pegangannya.

     `pengaturan` dipilih karena hanya admin yang mendapatkannya dari
     paket_peran() — diperiksa di database, bukan diduga: juri_pos dan
     koordinator_pos sama-sama cuma menerima `live_score` dan `pos`.
     Presedennya pasal 13.4, "yang dulu hanya admin dipetakan ke pengaturan,
     bukan ke fitur ubin yang namanya mirip".

     Ini bukan kunci mati: matriks centang di layar Akun tetap bisa memberikan
     `pengaturan` ke akun tertentu yang memang perlu, tanpa menyentuh kode. */
  if (!bolehLihat("pengaturan")) {
    pasangKepala("Cek Nilai");
    LAYAR.replaceChildren(h(kartuGalat(
      "Cek Nilai dipakai admin server. Akun ini tidak berhak membukanya.")));
    return;
  }

  pasangKepala("Cek Nilai", "cek");
  LAYAR.replaceChildren(h(pemuat()));

  const layarIni = location.hash;
  let katalogMentah;
  try { katalogMentah = await muatKatalogPos(); }
  catch (e) { LAYAR.replaceChildren(kartuGagalMuat(e.message, layarCekNilai)); return; }
  if (location.hash !== layarIni) return;

  const posBoleh = posUntukAkun(s, katalogMentah.pos)
    .filter(p => Number(p.jumlah_komponen) > 0);
  if (!posBoleh.length) {
    LAYAR.replaceChildren(h(`<div class="card"><h2>Belum ada pos berpenilaian</h2></div>`));
    return;
  }

  const sinyal = sinyalLayarBaru();
  let nomorPos = Number(posBoleh[0].nomor);
  let lembar = [];      // seluruh regu bernomor dada di pos ini
  let indeks = 0;
  /* SARINGAN: yang dipilih tidak membuang barisnya, ia cuma menentukan mana
     yang DILEWATI panah. `lembar` tetap utuh — kotak nomor dada harus tetap
     bisa melompat ke regu mana pun, termasuk yang tersaring keluar: petugas
     yang mengetik 042 sedang memegang regu 042 di depannya, dan layar yang
     menjawab "tidak ada" karena saringannya sedang menyala membantah kenyataan
     di meja. */
  let saring = "semua";
  let fotoAda = new Set();   // "nomorDada|kodeLomba" yang sudah punya foto
  let fotoTerbaca = false;   // false = daftarnya gagal dibaca, bukan "tidak ada foto"

  /* #pita-antrean — Pita antrean ada DI SINI JUGA, dan itu bukan kerapian:
     sejak layar ini boleh mengubah nilai, simpanan dari sini bisa gagal karena
     jaringan dan masuk antrean seperti di layar input. Tanpa elemen ini
     gambarPitaAntrean() tidak menemukan sasarannya dan langsung keluar — admin
     cuma menerima satu notifikasi yang lalu hilang, lalu tidak ada satu pun
     tanda bahwa masih ada angka yang belum sampai. */
  /* .baris-pilih — DROPDOWN SAJA, tanpa label "Pos" di atasnya. Isi kotaknya
     sudah berbunyi "Pos 5 — Yel-Yel", jadi labelnya mengulang kata yang
     terbaca di dalam kotak yang ia labeli (bagian 9.3) — dan barisnya memakan
     23px yang di HP diambil langsung dari tinggi foto. Atribut aria-label
     menggantikannya untuk pembaca layar. */
  /* #cek-saring — SARINGAN SEBAGAI CHIP, bentuk yang sama dengan layar Input —
     dua layar yang menyaring hal yang sama tidak boleh memakai dua
     alat berbeda, dan keadaan yang sedang aktif terbaca tanpa dibuka
     dulu seperti pada dropdown.

     SATU BARIS YANG DIGESER, BUKAN MEMBUNGKUS. Empat chip beserta
     angkanya tidak muat sebaris di layar 393px, dan versi dropdown
     dipilih dulu justru karena itu: yang membungkus jadi baris kedua
     mencuri tinggi, dan di layar ini tinggi diambil langsung dari
     foto slip. Jadi barisnya TIDAK membungkus melainkan digulir
     mendatar — tingginya tetap satu baris di lebar berapa pun.

     ANGKANYA IKUT DI DALAM LABELNYA. "Belum Kunci" tanpa angka
     menyuruh petugas menekan panah sampai mentok untuk tahu berapa
     yang tersisa; dengan angkanya, pertanyaan itu sudah terjawab
     sebelum ditekan sekali pun. */
  /* .cek-navigasi — PANAH, NOMOR DADA, PANAH — satu baris, dan kotak tengahnya
     sekaligus jalan melompat. Sebelumnya ada dua alat untuk satu pekerjaan:
     kotak "Lompat ke nomor dada" di atas, dan sepasang tombol "Sebelumnya /
     Berikutnya" selebar setengah layar di bawahnya. Keduanya menjawab "regu
     mana yang saya lihat sekarang", dan dua jawaban untuk satu pertanyaan
     berarti petugas memilih dulu sebelum bergerak.

     Panahnya sengaja tanpa kata. "Berikutnya ▶" selebar setengah layar
     bukan sasaran sentuh yang lebih baik daripada panah 3rem — ia cuma
     mendorong nomor dadanya keluar dari tengah, tempat mata mencarinya. */
  /* #cek-dada — type=text, BUKAN number: kotak number membuang nol di depan
     apa pun yang ditulis ke dalamnya, jadi "001" mustahil tergambar
     di sana. inputmode tetap numeric supaya papan ketik HP tetap
     angka. */
  /* TIDAK ADA "7 / 181". Berapa nomor yang sudah dilewati bukan
     pertanyaan yang ditanya orang yang sedang mencocokkan satu regu,
     dan kedua ujung daftarnya sudah terbaca dari panah yang mati.
     Barisnya memakan 20px, dan di HP tiap piksel di atas layar ini
     diambil dari tinggi foto slip. */
  LAYAR.replaceChildren(h(`
    <div id="pita-antrean"></div>
    <div class="card cek-kendali">
      <div class="baris-pilih">
        <div class="field">
          <select id="cek-pos" class="select-small" aria-label="Pos"
                  ${posBoleh.length < 2 ? "disabled" : ""}>
            ${posBoleh.map(p => `<option value="${esc(p.nomor)}"
              >${esc(judulPos(p))}</option>`).join("")}
          </select>
        </div>
        <div class="cek-saring-baris" id="cek-saring" role="group"
             aria-label="Saringan"></div>
      </div>
      <div class="cek-navigasi">
        <button type="button" class="button button-secondary cek-panah"
                id="cek-mundur" aria-label="Regu sebelumnya">&lsaquo;</button>
        <input type="text" id="cek-dada" class="cek-dada" inputmode="numeric"
               autocomplete="off" aria-label="Nomor dada yang sedang dilihat">
        <button type="button" class="button button-secondary cek-panah"
                id="cek-maju" aria-label="Regu berikutnya">&rsaquo;</button>
      </div>
    </div>
    <div id="cek-isi"></div>
  `));

  /* Tinggi header DIUKUR, tidak ditebak. Tata letak satu-layar di style.css
     memakai `calc(100dvh - var(--kepala))`, dan header ini tumbuh sebaris
     lagi kalau nama akun panjang atau layarnya sempit — angka tetap apa pun
     akan benar di satu ukuran dan meninggalkan celah atau memotong foto di
     ukuran lain.

     Diukur ulang saat lebarnya berubah, karena di situ pula pembungkusan
     headernya berubah. Pengamatnya dilepas saat pindah layar.

     MEMAKAI `sinyal` YANG SUDAH ADA, bukan memanggil sinyalLayarBaru() lagi:
     fungsi itu MEMBATALKAN sinyal sebelumnya sebelum memberi yang baru.
     Panggilan kedua di layar yang sama membatalkan sinyal layar itu sendiri,
     dan muatPos() lalu berhenti di `if (sinyal.aborted) return` — layarnya
     menggantung di "Memuat…" selamanya, tanpa satu pun galat. */
  const kepalaEl = document.getElementById("kepala");
  if (kepalaEl) {
    const ukurKepala = () => LAYAR.style.setProperty(
      "--kepala", `${Math.round(kepalaEl.getBoundingClientRect().height)}px`);
    ukurKepala();
    const pengamatKepala = new ResizeObserver(ukurKepala);
    pengamatKepala.observe(kepalaEl);
    putusSaatPindah(sinyal, pengamatKepala);
  }

  gambarPitaAntrean();
  kirimAntrean();

  const elPos = document.getElementById("cek-pos");
  const elDada = document.getElementById("cek-dada");
  pasangDada3(elDada, sinyal);
  const elIsi = document.getElementById("cek-isi");
  const elSaring = document.getElementById("cek-saring");
  const elMundur = document.getElementById("cek-mundur");
  const elMaju = document.getElementById("cek-maju");

  /** Lomba pos yang sedang dibuka, dari katalog yang sudah di tangan.
   *
   *  DISIMPAN, tidak dihitung ulang tiap panggilan: saringan di bawah
   *  memanggilnya sekali untuk SETIAP regu di pos ini — 269 kali dikali empat
   *  saringan — dan katalogLomba() menyusun ulang seluruh kolom pos tiap kali.
   *  Dikosongkan saat posnya berganti, satu-satunya saat jawabannya berubah. */
  let lombaCache = null;
  const lombaPos = () => (lombaCache ||= katalogLomba(
    katalogMentah.pos.filter(p => Number(p.nomor) === nomorPos),
    katalogMentah.komponen));

  /* ------------------------------------------------------------------------
     SARINGAN: "mana yang masih perlu dikerjakan?"

     Layar ini berjalan satu regu pada satu waktu, jadi saringan di sini bukan
     daftar melainkan JALUR PANAH: yang tersaring keluar dilewati, dan yang
     tersisa jadi antrean kerja. "Belum Kunci" dengan begitu berubah jadi
     tumpukan yang tinggal dihabiskan.

     Yang berlaku untuk satu regu dibatasi golongannya — komponen dan lomba
     yang bukan urusan golongan itu tidak boleh dihitung sebagai pekerjaan
     yang belum selesai. Aturan yang sama dipakai gambarKunci() dan
     statusAwal(), lewat varianUntuk(). Ketiga ujinya fungsi murni di util.js.
     --------------------------------------------------------------------- */
  const belumInput = (r) => reguBelumInput(lombaPos(), r);
  const belumFoto = (r) => reguBelumFoto(lombaPos(), r, fotoAda);
  const belumKunci = (r) => reguBelumKunci(lombaPos(), r);

  const SARING = [
    ["semua", "Semua", () => true],
    ["belum-input", "Belum Input", belumInput],
    ["belum-foto", "Belum Foto", belumFoto],
    ["belum-kunci", "Belum Kunci", belumKunci],
  ];
  const cocokSaring = (r) =>
    (SARING.find(x => x[0] === saring) || SARING[0])[2](r);

  /** Perbarui chip saringan BESERTA jumlahnya.
   *
   *  Angkanya berubah tiap kali satu nilai disimpan atau satu gembok dipasang,
   *  jadi ia dihitung ulang di tiap penggambaran — bukan sekali saat posnya
   *  dimuat. "Belum Kunci 34" yang tetap 34 sesudah tiga digembok adalah
   *  angka yang membohongi orang yang sedang menghitung sisanya.
   *
   *  "Belum Foto" HILANG dari daftar kalau daftar fotonya gagal dibaca.
   *  Menyisakannya berarti menandai seluruh regu belum difoto — tuduhan
   *  terhadap pekerjaan yang mungkin sudah selesai, aturan yang sama dengan
   *  "foto tidak terbaca" di petak fotonya.
   *
   *  TOMBOLNYA DIBANGUN ULANG HANYA KALAU DAFTARNYA BERUBAH. Selebihnya angka
   *  dan aria-pressed diganti di tempat. Membangun ulang chip yang sedang
   *  difokus membuang fokusnya ke <body>, dan Tab berikutnya mulai lagi dari
   *  atas halaman — petugas yang memakai papan ketik kehilangan tempatnya
   *  setiap kali menekan satu chip. */
  function isiSaring() {
    const pakai = SARING.filter(([kode]) => fotoTerbaca || kode !== "belum-foto");
    if (!pakai.some(([kode]) => kode === saring)) saring = "semua";
    const daftar = pakai.map(([kode]) => kode).join(" ");
    if (elSaring.dataset.daftar !== daftar) {
      elSaring.dataset.daftar = daftar;
      elSaring.innerHTML = chipSaringHtml(
        pakai.map(([kode, label]) => ({ kode, label, jumlah: "" })), saring);
    }
    tandaiChip(elSaring, "saring", saring);
    for (const [kode, , uji] of pakai) {
      elSaring.querySelector(`[data-saring="${kode}"] .saring-jumlah`)
        .textContent = lembar.filter(uji).length;
    }
  }

  async function muatPos() {
    elIsi.replaceChildren(h(pemuat()));
    lombaCache = null;
    /* Daftar foto SEPOS diambil sekali di sini, bukan per regu: saringan
       "Belum Foto" menanyakannya untuk 269 regu sekaligus, dan
       daftarFotoLembar() menjawab satu regu per permintaan. v_foto_lembar
       mengembalikan pasangan nomor dada + kode lomba saja, jadi ia murah.

       Kegagalannya TIDAK menjatuhkan layar: fotonya cuma menghidupkan satu
       saringan, sedangkan angkanya — yang membuat layar ini ada — datang dari
       lembar pos. */
    let foto = null;
    try {
      [lembar, foto] = await Promise.all([
        lembarPos(nomorPos),
        fotoLembarPos(nomorPos).catch(() => null),
      ]);
    } catch (e) { elIsi.replaceChildren(kartuGagalMuat(e.message, muatPos)); return; }
    if (sinyal.aborted) return;
    fotoTerbaca = foto !== null;
    fotoAda = new Set((foto || []).map(f => `${f.nomor_dada}|${f.kode_lomba}`));
    indeks = 0;
    /* Regu pertama yang LOLOS saringan, bukan regu pertama. Saringan yang
       bertahan saat pos diganti tetapi selalu mendarat di regu yang tersaring
       keluar akan terbaca seperti saringan yang tidak jalan. */
    const awal = lembar.findIndex(cocokSaring);
    if (awal >= 0) indeks = awal;
    await gambarRegu();
  }

  function perbaruiNavigasi() {
    isiSaring();
    elMundur.disabled = tetangga(-1) < 0;
    elMaju.disabled = tetangga(1) < 0;
    /* Kotaknya JANGAN ditimpa selagi diketik: petugas yang sedang mengetik
       "04" untuk menuju 042 akan melihat ketikannya diganti nomor yang sedang
       terbuka, di tengah ketikan. */
    if (document.activeElement !== elDada) {
      elDada.value = lembar.length ? dada3(lembar[indeks].nomor_dada) : "";
    }
  }

  /* Nomor gambar yang sedang berlaku. Dua ketukan panah beruntun berarti dua
     gambarRegu() berjalan bersamaan, dan yang lebih tua tidak boleh
     membereskan apa pun milik yang lebih muda. */
  let gambarKe = 0;

  async function gambarRegu() {
    perbaruiNavigasi();
    if (!lembar.length) {
      elIsi.replaceChildren(h(`<div class="card"><p class="keterangan">Belum ada
        regu yang menerima nomor dada.</p></div>`));
      return;
    }

    const iniGambar = ++gambarKe;
    const r = lembar[indeks];
    const dada = Number(r.nomor_dada);
    const daftar = lombaPos();
    const nilai = r.nilai || {};

    /* ================================================================
       GULIRAN BERTAHAN SAAT PINDAH REGU — dan yang menjaganya BUKAN
       menyimpan lalu memulihkan angkanya, melainkan menahan TINGGI
       halamannya.

       Yang terjadi tanpa ini, terukur di iframe 393x700 dengan Pos 5:
       halaman 1016px, petugas menggulir ke 300 untuk melihat foto slip,
       lalu menekan panah. replaceChildren menggambar kerangka yang
       petak fotonya masih KOSONG, halamannya menyusut jadi 700 — tepat
       setinggi layar — dan browser menjepit guliran ke 0 karena tidak
       ada lagi yang bisa digulir. 60 ms kemudian fotonya datang dan
       halamannya kembali 1016, tetapi gulirannya sudah telanjur di
       atas. Jadi tiap satu regu berikutnya menuntut satu guliran lagi,
       dan layar ini dipakai ratusan kali sepagi.

       Menyimpan lalu memulihkan angkanya — cara papan Live Score —
       tidak dipakai di sini karena ia MENGEDIP: di lapangan tautan
       foto bertanda tangan bisa memakan setengah detik, dan setengah
       detik melompat ke atas lalu turun lagi terbaca seperti layar
       yang salah gambar. Halaman yang tidak pernah memendek tidak
       perlu dipulihkan sama sekali.

       HANYA SAAT HALAMANNYA MEMANG SEDANG DIGULIR. Di tata letak satu
       layar (>= 1000px) `.isi.cek` setinggi layar dan `overflow:
       hidden`, jadi guliran halaman selalu 0 — dan `min-height` di
       sana justru merusak: #cek-isi anak flex ber-`min-height: 0`
       yang memang HARUS boleh menyusut, dan mematoknya mendorong
       halaman jadi lebih tinggi daripada layar, persis yang sudah
       pernah diperbaiki di blok CSS-nya.

       Yang menggulir di rentang itu kotak lombanya sendiri
       (`#cek-isi > .card { overflow: auto }`), dan kotak itu DIBUANG
       oleh replaceChildren — jadi ia yang disimpan lalu dipasang lagi.
       Tingginya di sana tidak bergantung pada foto (fotonya `flex: 1`),
       jadi memulihkannya seketika sudah benar dan tidak mengedip.

       DUA LANGKAH, dan keduanya perlu — masing-masing sendirian
       terukur MELESET:

         1. patok #cek-isi setinggi ukurannya yang lama. Meleset 16px,
            karena margin bawah kartu terakhir RUNTUH keluar dari
            #cek-isi selama tingginya auto lalu terserap ke dalam
            begitu min-height memaksanya. Tinggi elemennya sama,
            tinggi halamannya tidak.
         2. ukur sisa kekurangannya dari halamannya sendiri, lalu
            tambahkan. Ini yang tidak bisa berdiri sendiri: tanpa
            langkah 1 kerangkanya lebih pendek daripada layar, dan
            `scrollHeight` berhenti di tinggi layar — 700, bukan 400 —
            jadi yang terbaca cuma 198px kurang dari 498px yang
            sebenarnya, dan tambalannya masih pendek.

       Sesudah langkah 1 halamannya paling meleset selebar satu margin
       yang runtuh, jadi lantai layar tidak lagi mengaburkan
       pengukuran dan langkah 2 menutupnya persis.
       ================================================================ */
    const halaman = document.scrollingElement;
    const gulirHalaman = halaman.scrollTop;
    const tinggiHalaman = halaman.scrollHeight;
    const tinggiIsi = Math.round(elIsi.getBoundingClientRect().height);
    const kotakLama = elIsi.querySelector(":scope > .card");
    const gulirKotak = kotakLama ? kotakLama.scrollTop : 0;

    /* Kerangkanya digambar LEBIH DULU, fotonya menyusul. Tautan foto
       bertanda tangan butuh satu perjalanan jaringan per regu, dan layar yang
       kosong selama itu membuat petugas menekan "Berikutnya" dua kali. */
    /* .cek-identitas — Tidak ada lagi blok gembok di kartu identitas:
       gemboknya sekarang duduk di sebelah nilai tiap lomba, tempat
       keputusannya benar-benar diambil. */
    elIsi.replaceChildren(h(`
      <div class="cek-identitas">${kartuReguNilai(r, { ringkas: true })}</div>
      <div class="card">
        ${daftar.map(l => {
          const dipakai = l.kolom
            .map(kol => ({ kol, k: varianUntuk(kol, r.golongan) }))
            .filter(x => x.k);
          // Lomba yang tidak berlaku untuk golongan regu ini tidak digambar
          // sama sekali. Barisnya bukan "kosong" — ia memang bukan urusan
          // regu ini, dan baris kosong di daftar periksa menuntut dijawab.
          if (!dipakai.length) return "";
          /* Kotak isian, bukan angka baca-saja. Bentuknya sama dengan layar
             input — selKomponen() yang menggambarnya — supaya admin yang
             berpindah antara dua layar tidak menemui dua bentuk untuk satu
             hal. Nama kriteria hanya ditulis kalau lombanya berkriteria
             banyak; untuk lomba berkriteria satu, judul lombanya di atas
             sudah menyebutkannya (bagian 9.3). */
          const angka = dipakai.map(({ kol, k }) => `
            <div class="isian-baris">
              ${dipakai.length > 1
                ? `<label class="isian-nama" for="cek-${esc(k.kode)}">${esc(kol.nama)}</label>`
                : ""}
              ${selKomponen(k, nilai[k.kode])}
            </div>`).join("");
          /* Nama dan angkanya SATU BLOK di kiri, tepat di atas fotonya.
             Sebelumnya angkanya didorong ke tepi kanan oleh
             `justify-content: space-between`, jadi membandingkan tulisan
             tangan di foto dengan angka yang diketik menuntut mata menyeberang
             selebar layar dan turun — dua gerakan untuk satu perbandingan yang
             dilakukan ratusan kali. */
          /* .cek-kepala — CEKLIS DI SEBELAH KANAN JUDUL, dan judulnya TETAP di
             tengah. Ketiga selnya disusun 1fr auto 1fr, jadi lebar penandanya
             tidak ikut menentukan di mana judulnya jatuh — kalau keduanya
             sekadar didempetkan di tengah, judulnya bergeser ke kiri saat
             penandanya muncul, dan bergeser lagi saat berganti dari
             titik-titik ke centang. Judul yang berjoget tiap kali nilai
             disimpan terbaca seperti layar yang salah. */
          /* SATU BARIS: kotak isian, lambang simpan, lambang gembok.
             Sebelumnya tombol "Simpan" selebar kolomnya berdiri di baris
             sendiri di bawah angkanya, dan tinggi yang dimakannya diambil
             dari foto — di layar yang seluruh gunanya membandingkan
             angka dengan tulisan tangan, itu penukaran yang salah arah.

             Ketiganya berurutan sesuai cara dipakainya: baca angkanya,
             betulkan kalau perlu, simpan, lalu gembok. */
          /* .cek-imbang — CERMIN GEMBOK. Kotak isian hanya benar-benar di
             tengah kalau kedua sisinya memesan tempat yang sama; dengan gembok
             di kanan saja, kotaknya terdorong ke kiri sebanyak separuh lebar
             gembok. Selebar gemboknya, tak terlihat, dan bukan sekadar jarak
             kosong: lebarnya datang dari aturan yang sama dengan gemboknya,
             jadi keduanya tidak bisa berselisih suatu hari. */
          /* .cek-angka — Kotak isian dibungkus supaya lambang di sebelahnya
             berdiri di kanan SELURUH kelompoknya, bukan di kanan kotak
             terakhir. Pembidaian punya lima kriteria bertumpuk; tanpa
             pembungkus ini lambangnya ikut turun ke baris kelima. */
          /* GEMBOK DI SEBELAH NILAINYA, dan cukup lambangnya saja.
             Alurnya: panitia melihat foto slip di bawah, mencocokkan
             dengan angka di atasnya, lalu mengetuk gembok. Kata
             "Kunci Nilai" di sebelah tiap angka akan diulang lima
             kali di satu layar untuk satu hal yang dipelajari sekali
             (CLAUDE.md 9.1); yang membedakan terkunci dari tidak
             adalah BENTUK gemboknya, tertutup atau terbuka.

             Judulnya tetap ada untuk pembaca layar dan untuk yang
             menahan kursor di atasnya. */
          /* TIDAK ADA TOMBOL SIMPAN. Angkanya disimpan sendiri
             begitu diubah, dan yang tersisa cuma KABAR: titik-titik
             kuning berarti belum sampai ke database, centang hijau
             berarti sudah.

             Tombol simpan pada layar yang menyimpan sendiri adalah
             tombol yang tidak pernah perlu ditekan, dan tombol seperti
             itu justru membuat orang ragu apakah angkanya tersimpan
             kalau ia LUPA menekannya. */
          /* Panah dan penghitung, disembunyikan sampai lombanya
             benar-benar punya lebih dari satu foto. Petak yang bisa
             digeser tidak mengumumkan dirinya: yang terlihat cuma satu
             foto, dan foto kedua baru ada kalau seseorang kebetulan
             menyapu layarnya. Bentuknya sama persis dengan penggeser di
             layar input — dua layar yang menggeser benda yang sama tidak
             boleh memakai dua alat berbeda. */
          return `
            <section class="cek-lomba">
              <div class="cek-kepala">
                <span class="cek-nama">${esc(l.nama)}</span>
                <span class="cek-status" data-status="${esc(l.kode)}"></span>
              </div>
              <div class="cek-isian" data-isian="${esc(l.kode)}">
                <span class="cek-imbang" aria-hidden="true"></span>
                <div class="cek-angka">${angka}</div>
                <button type="button" class="gembok cek-gembok"
                        data-gembok="${esc(l.kode)}"></button>
              </div>
              <div class="cek-foto" data-foto="${esc(l.kode)}"></div>
              <div class="foto-navigasi foto-navigasi-diam"
                   data-nav-foto="${esc(l.kode)}">
                <button type="button" class="button button-secondary button-small foto-panah"
                        data-cek-geser="-1" aria-label="Foto sebelumnya">&lsaquo;</button>
                <span class="badge foto-hitung" data-hitung-foto></span>
                <button type="button" class="button button-secondary button-small foto-panah"
                        data-cek-geser="1" aria-label="Foto berikutnya">&rsaquo;</button>
              </div>
            </section>`;
        }).join("")}
      </div>`));

    /* Halaman ditambal setinggi semula lalu gulirannya dikembalikan — dan
       semuanya masih di dalam SATU tugas yang sama dengan replaceChildren di
       atas, jadi browser tidak pernah sempat menggambar keadaan pendeknya.
       Yang terlihat cuma hasil akhirnya: angka barunya, di tempat mata sudah
       berada. */
    if (gulirHalaman > 0) {
      elIsi.style.minHeight = `${tinggiIsi}px`;
      const kurang = tinggiHalaman - halaman.scrollHeight;
      if (kurang > 0) elIsi.style.minHeight = `${tinggiIsi + kurang}px`;
      halaman.scrollTop = gulirHalaman;
    }
    // Kotak lombanya baru — guliran di dalamnya dipasang lagi (lihat catatan
    // panjang di atas). Di HP nilainya selalu 0 dan barisnya tidak berbuat apa
    // pun; yang menggulir di sana halamannya.
    const kotakBaru = elIsi.querySelector(":scope > .card");
    if (kotakBaru && gulirKotak) kotakBaru.scrollTop = gulirKotak;

    /* <label for> butuh id, dan selKomponen menulis data-kode saja. Dipasang
       di sini, sesudah barisnya berdiri. */
    daftar.forEach(l => {
      const wadah = elIsi.querySelector(`[data-isian="${CSS.escape(l.kode)}"]`);
      if (!wadah) return;
      l.kolom.forEach(kol => {
        const k = varianUntuk(kol, r.golongan);
        if (!k) return;
        const el = wadah.querySelector(`[data-kode="${CSS.escape(k.kode)}"]`);
        if (el) el.id = `cek-${k.kode}`;
      });
    });
    gambarKunci();
    statusAwal();
    matikanSaatTerkunci();

    /* Fotonya menyusul, dan begitu ia mendarat halamannya boleh kembali
       setinggi isinya sendiri. `iniGambar` menjaga supaya gambar yang sudah
       didahului penggantinya tidak melepaskan patokan milik pengganti itu —
       dua ketukan panah beruntun membuat keduanya berjalan bersamaan. */
    try { await gambarFoto(dada); }
    finally { if (iniGambar === gambarKe) elIsi.style.minHeight = ""; }
  }

  /** Foto slip tiap lomba, dipasang sesudah kerangkanya berdiri.
   *
   *  Terpisah dari gambarRegu() supaya patokan tinggi di sana bisa dilepas
   *  lewat SATU `finally`: jalur keluar di bawah ada tiga — permintaannya
   *  gagal, layarnya ditinggalkan, nomornya sudah berpindah — dan tiga baris
   *  pelepasan yang harus diingat satu per satu adalah baris yang suatu hari
   *  terlewat, meninggalkan halaman yang tingginya terkunci di angka regu
   *  sebelumnya. */
  async function gambarFoto(dada) {
    let foto = [];
    try { foto = await daftarFotoLembar(nomorPos, dada); }
    catch { foto = null; }
    // Nomornya bisa sudah berpindah selagi permintaannya di jalan.
    if (sinyal.aborted || Number((lembar[indeks] || {}).nomor_dada) !== dada) return;

    if (foto === null) {
      /* null = status fotonya TIDAK diketahui, dan itu berbeda dari "tidak
         ada foto". Menuliskan "belum difoto" untuk permintaan yang gagal
         adalah tuduhan terhadap pekerjaan yang mungkin sudah selesai. */
      elIsi.querySelectorAll("[data-foto]").forEach(el => {
        el.replaceChildren(h(`<span class="cek-kosong">foto tidak terbaca</span>`));
      });
      return;
    }

    let peta = {};
    try { peta = await tautanFotoBanyak(foto.map(f => f.path)); }
    catch { peta = {}; }
    if (sinyal.aborted || Number((lembar[indeks] || {}).nomor_dada) !== dada) return;

    elIsi.querySelectorAll("[data-foto]").forEach(el => {
      const milik = foto.filter(f => f.kode_lomba === el.dataset.foto);
      const nav = elIsi.querySelector(
        `[data-nav-foto="${CSS.escape(el.dataset.foto)}"]`);
      if (!milik.length) {
        el.replaceChildren(h(`<span class="cek-kosong">belum difoto</span>`));
        if (nav) nav.classList.add("foto-navigasi-diam");
        return;
      }
      el.replaceChildren(h(milik.map((f, i) => {
        const url = peta[f.path];
        const judul = `Foto ${i + 1}${f.diunggah_pada ? ` · ${tanggalJam(f.diunggah_pada)}` : ""}`;
        if (!url) return `<span class="fg-petak fg-kosong">link gagal</span>`;
        /* Sudutnya dibawa `data-putar`, bukan gaya sebaris: yang memutar CSS,
           dan CSS perlu tahu 90/270 supaya bisa MENUKAR lebar dengan tinggi.
           Gambar yang cuma diputar tanpa ditukar ukurannya meluap keluar
           petaknya — separuh slipnya hilang, dan itu kebalikan dari gunanya.

           Tombol putarnya DI DALAM petak, bukan di bawahnya: ia milik foto
           tepat di belakangnya, dan di kolom berisi dua foto kepemilikan itu
           harus terbaca tanpa dihitung. */
        return `<div class="fg-petak" data-putar="${esc(String(f.putaran || 0))}">
            <a class="fg-buka" href="${esc(url)}" target="_blank" rel="noopener"
               title="${esc(judul)}"><img src="${esc(url)}" alt="${esc(judul)}"
               loading="lazy"></a>
            <button type="button" class="icon-button fg-putar"
                    data-putar-foto="${esc(f.id)}"
                    title="Putar 90°" aria-label="Putar foto 90 derajat"
              >${ikon("rotate-cw")}</button>
          </div>`;
      }).join("")));
      if (nav) pasangGeserCek(el, nav);
      ukurPetak(el);
    });
  }

  /** Ukuran petak foto, dituliskan ke CSS.
   *
   *  Putaran 90 dan 270 menukar lebar dengan tinggi, dan CSS tidak bisa
   *  membaca ukuran elemen sendiri — jadi diukur di sini. Tingginya berubah
   *  mengikuti tinggi layar (tata letak satu-layar mengambil sisa ruang),
   *  jadi angka tetap apa pun akan benar di satu ukuran saja.
   *
   *  Diukur ulang saat petaknya berubah ukuran; pengamatnya dilepas bersama
   *  sinyal layar. */
  function ukurPetak(wadah) {
    const pasang = () => wadah.querySelectorAll(".fg-petak").forEach(pt => {
      const k = pt.getBoundingClientRect();
      pt.style.setProperty("--petak-w", `${Math.round(k.width)}px`);
      pt.style.setProperty("--petak-h", `${Math.round(k.height)}px`);
    });
    pasang();
    const pengamat = new ResizeObserver(pasang);
    pengamat.observe(wadah);
    putusSaatPindah(sinyal, pengamat);
  }

  /* Memutar foto. Sudutnya DISIMPAN (0167), jadi sekali diputar ia tegak
     untuk siapa pun dan di layar mana pun — bukan cuma sampai pindah regu.

     Petaknya diputar SEKETIKA, sebelum jawaban server datang: memutar adalah
     gerakan yang diulang sambil membaca, dan menunggu jaringan tiap ketukan
     membuatnya terasa rusak. Kalau server menolak, sudutnya dikembalikan dan
     galatnya disebut.

     Satu pendengar di wadahnya, bukan satu per tombol: petaknya dibuang dan
     dibuat lagi tiap kali regunya berganti, dan pendengar yang menempel
     padanya ikut menumpuk. */
  elIsi.addEventListener("click", async (e) => {
    const tombol = e.target.closest("[data-putar-foto]");
    if (!tombol) return;
    // Petaknya memuat <a> yang membuka foto penuh; tanpa ini memutar ikut
    // membuka tab baru.
    e.preventDefault();
    e.stopPropagation();
    if (tombol.disabled) return;

    const petak = tombol.closest(".fg-petak");
    const lama = Number(petak.dataset.putar) || 0;
    const baru = (lama + 90) % 360;
    petak.dataset.putar = String(baru);
    tombol.disabled = true;
    try {
      const jadi = await putarFotoLembar(tombol.dataset.putarFoto, baru);
      // Server yang menormalkan; angkanya dipakai apa adanya supaya layar dan
      // database tidak pernah berbeda pendapat soal sudut yang berlaku.
      if (jadi !== null && jadi !== undefined) petak.dataset.putar = String(jadi);
    } catch (err) {
      petak.dataset.putar = String(lama);
      notif(err.message, true);
    }
    tombol.disabled = false;
  }, { signal: sinyal });

  /** Kotak isian dan tombol simpan mati saat nilainya terkunci.
   *
   *  Kotak yang masih bisa diketik tapi selalu ditolak adalah jebakan, dan
   *  penolakannya baru muncul sesudah admin mengetik angka yang ia kira
   *  tersimpan. Yang menegakkan tetap server; ini supaya ia tahu lebih dulu. */
  /** Lomba mana saja yang tergembok untuk regu yang sedang terbuka.
   *
   *  `lomba_terkunci` datang dari v_lembar_pos (0166). Baris lama yang belum
   *  membawanya jatuh ke larik kosong — bukan ke "semuanya terkunci": layar
   *  yang mengunci semuanya karena datanya belum sampai lebih membingungkan
   *  daripada layar yang membiarkannya, dan yang menegakkan tetap server. */
  const lombaTerkunci = () => new Set(
    (lembar.length && lembar[indeks].lomba_terkunci) || []);

  function matikanSaatTerkunci() {
    if (!lembar.length) return;
    const kunci = lombaTerkunci();
    elIsi.querySelectorAll("[data-isian]").forEach(wadah => {
      const mati = kunci.has(wadah.dataset.isian);
      wadah.querySelectorAll("input").forEach(el => { el.disabled = mati; });
    });
  }

  /** Panah dan penghitung untuk SATU petak foto.
   *
   *  Nomor fotonya dipegang di sini, bukan dihitung ulang dari `scrollLeft`
   *  tiap kali dibutuhkan — pelajaran yang sama dengan penggeser di layar
   *  input: peristiwa `scroll` dikirim pada frame berikutnya, jadi tab yang
   *  sedang tidak menggambar tidak mengirimkannya sama sekali, dan penghitung
   *  yang bertahan di "1 / 2" sementara fotonya sudah berganti lebih buruk
   *  daripada tidak ada penghitung. `scroll` tetap didengar untuk menyamakan
   *  angkanya kalau yang menggeser jari.
   *
   *  Pendengarnya dipasang pada elemen yang BARU dibuat setiap kali regunya
   *  berganti; yang lama ikut terbuang bersama replaceChildren, dan sinyal
   *  layar membersihkan sisanya saat layar ditinggalkan. */
  function pasangGeserCek(petak, nav) {
    const jml = petak.children.length;
    /* "Diam" berarti tanpa foto kedua. Di layar lebar ruangnya tetap
       dipesan supaya kolom-kolom lombanya sama tinggi, dan di HP barisnya
       dibuang — keduanya diatur CSS (.foto-navigasi-diam), bukan di sini. */
    nav.classList.toggle("foto-navigasi-diam", jml < 2);
    if (jml < 2) return;

    const hitung = nav.querySelector("[data-hitung-foto]");
    let ke = 0;
    const perbarui = () => {
      hitung.textContent = `${ke + 1} / ${jml}`;
      nav.querySelector('[data-cek-geser="-1"]').disabled = ke <= 0;
      nav.querySelector('[data-cek-geser="1"]').disabled = ke >= jml - 1;
    };

    nav.addEventListener("click", (e) => {
      const b = e.target.closest("[data-cek-geser]");
      if (!b || b.disabled) return;
      ke = Math.max(0, Math.min(jml - 1, ke + Number(b.dataset.cekGeser)));
      petak.scrollTo({ left: ke * petak.clientWidth, behavior: "smooth" });
      perbarui();
    }, { signal: sinyal });

    // Dibaca sesudah gulirannya berhenti — alasan lengkapnya di penggeser
    // layar input, dan kedipan yang sama muncul di sini kalau tidak ditunggu.
    let jedaGulir = null;
    petak.addEventListener("scroll", () => {
      clearTimeout(jedaGulir);
      jedaGulir = setTimeout(() => {
        const baru = Math.max(0, Math.min(jml - 1,
          Math.round(petak.scrollLeft / (petak.clientWidth || 1))));
        if (baru !== ke) { ke = baru; perbarui(); }
      }, 120);
    }, { signal: sinyal });

    perbarui();
  }

  /** Gembok satu regu di pos ini, beserta apa yang ikut mati bersamanya.
   *
   *  Yang menegakkan aturannya tetap server (0044): ia menolak mengunci nilai
   *  yang belum lengkap. Pemeriksaan di sini cuma supaya admin tahu SEBELUM
   *  menekan, bukan sesudah ditolak — dan angkanya dibaca dari baris yang
   *  sama yang menggambar layar ini, jadi keduanya tidak bisa berselisih. */
  /** Gembok tiap lomba: satu lambang di sebelah nilainya.
   *
   *  Digambar ulang di tempat, bukan lewat gambarRegu(): panitia sedang
   *  menatap foto di tengah layar, dan menggambar ulang seluruh layar
   *  melempar gulirannya.
   *
   *  KELENGKAPAN DIPERIKSA PER LOMBA, dan pemeriksaan itu ada di sini karena
   *  tidak ada yang melakukannya di tempat lain: kunci_nilai_pos() memeriksa
   *  hak dan keberadaan regunya, TIDAK kelengkapannya. Akibat menggembok
   *  terlalu awal bukan sekadar data setengah jadi — lomba yang tergembok
   *  ditolak simpan_nilai_massal, jadi ia MEMBLOKIR juri yang belum sempat
   *  memasukkan kriteria sisanya. */
  function gambarKunci() {
    if (!lembar.length) return;
    const r = lembar[indeks];
    const kunci = lombaTerkunci();

    elIsi.querySelectorAll("[data-gembok]").forEach(tombol => {
      const kode = tombol.dataset.gembok;
      const l = lombaPos().find(x => x.kode === kode);
      if (!l) return;
      const tergembok = kunci.has(kode);
      // Komponen lomba INI yang berlaku untuk golongan regu ini.
      const dipakai = l.kolom
        .map(kol => varianUntuk(kol, r.golongan)).filter(Boolean);
      const terisi = dipakai.filter(k => (r.nilai || {})[k.kode] !== undefined).length;
      const lengkap = dipakai.length > 0 && terisi === dipakai.length;

      tombol.innerHTML = ikon(tergembok ? "lock" : "lock-open");
      /* SELALU dihidupkan lagi. Penangan di bawah mematikannya selama
         permintaan berjalan dan hanya menghidupkannya kembali saat GAGAL —
         jadi tanpa baris ini gembok yang berhasil dipasang tidak akan pernah
         bisa dibuka lagi tanpa memuat ulang layar. Ditemukan dengan menekan
         gemboknya dua kali di layar sungguhan; tesnya lulus, parse-nya lulus,
         dan tidak ada satu pun galat (CLAUDE.md 17.3). */
      tombol.disabled = false;
      tombol.classList.toggle("tergembok", tergembok);
      tombol.classList.toggle("belum-lengkap", !tergembok && !lengkap);
      tombol.title = tergembok
        ? `${l.nama} terkunci — ketuk untuk membuka`
        : lengkap ? `Kunci ${l.nama}`
        : `${l.nama} baru ${terisi} dari ${dipakai.length} kriteria terisi`;
      tombol.setAttribute("aria-label", tombol.title);
      tombol.setAttribute("aria-pressed", String(tergembok));
    });
  }

  /* Satu pendengar untuk seluruh gembok, dipasang sekali di wadahnya — bukan
     satu pendengar per tombol yang dipasang ulang tiap kali regunya berganti.
     Tombolnya dibuang dan dibuat lagi oleh gambarRegu(); pendengar yang
     menempel padanya ikut menumpuk. */
  elIsi.addEventListener("click", async (e) => {
    const tombol = e.target.closest("[data-gembok]");
    if (!tombol || tombol.disabled || !lembar.length) return;
    const r = lembar[indeks];
    const kode = tombol.dataset.gembok;
    const l = lombaPos().find(x => x.kode === kode);
    if (!l) return;
    const dada = Number(r.nomor_dada);
    const tergembok = lombaTerkunci().has(kode);

    if (!tergembok) {
      const dipakai = l.kolom.map(kol => varianUntuk(kol, r.golongan)).filter(Boolean);
      const terisi = dipakai.filter(k => (r.nilai || {})[k.kode] !== undefined).length;
      if (!dipakai.length || terisi !== dipakai.length) {
        notif(`${l.nama} belum lengkap — baru ${terisi} dari ${dipakai.length} `
              + "kriteria terisi. Mengunci sekarang membuat juri tidak bisa "
              + "memasukkan sisanya.", true);
        return;
      }
    }

    tombol.disabled = true;
    try {
      if (tergembok) {
        /* Alasan tetap, tanpa dialog — keputusan yang sama dengan lembar pos
           lama: jejak pembukaan tetap tercatat di riwayat tanpa memaksa
           panitia melewati satu kotak lagi. */
        await bukaKunciNilaiPos(dada, nomorPos, kode, "Dibuka dari Cek Nilai");
        notif(`Kunci ${l.nama} ${dada3(dada)} dibuka.`);
      } else {
        await kunciNilaiPos(dada, nomorPos, kode);
        notif(`${l.nama} ${dada3(dada)} dikunci.`);
      }
    } catch (err) {
      notif(err.message, true);
      tombol.disabled = false;
      return;
    }
    await segarkanBaris(dada);
    gambarKunci();
    matikanSaatTerkunci();
  }, { signal: sinyal });

  /** Membaca ulang satu baris lembar pos sesudah nilainya berubah.
   *
   *  Yang berubah bukan cuma angkanya: `jumlah_terisi` menentukan boleh
   *  tidaknya mengunci, dan `terkunci` menentukan apakah kotaknya mati. Tanpa
   *  pembacaan ini keduanya basi tepat sesudah admin mengubah sesuatu. */
  async function segarkanBaris(dada) {
    try {
      const segar = await lembarPosSatu(nomorPos, dada);
      if (segar) lembar[indeks] = segar;
    } catch { /* angkanya sudah tersimpan; yang basi cuma ringkasannya */ }
  }

  /** Kabar keadaan satu lomba: sudah sampai database atau belum.
   *
   *  Kosakatanya SAMA dengan lembar pos (statusBaris di layar Input Pos), dan
   *  itu disengaja: dua layar yang menceritakan hal yang sama tidak boleh
   *  memakai dua lambang berbeda.
   *
   *    belum      titik-titik KUNING  diketik, belum dikirim
   *    menyimpan  titik-titik KUNING  sedang di jalan
   *    tersimpan  centang HIJAU       sudah masuk database
   *    gagal      seru MERAH          tidak sampai; ketuk untuk mengulang
   *
   *  `belum` dan `menyimpan` sengaja terlihat SAMA bagi yang membacanya.
   *  Bedanya cuma soal teknis — sudah dikirim atau belum — dan yang
   *  ditanyakan panitia satu: "angka ini sudah aman atau belum?" */
  function statusLomba(kode, keadaan, pesan) {
    const sel = elIsi.querySelector(`[data-status="${CSS.escape(kode)}"]`);
    if (!sel) return;
    sel.dataset.keadaan = keadaan || "";
    /* Pil `.badge` yang SAMA dengan lembar pos — kuning, hijau, merah. Dua
       layar yang menceritakan hal yang sama tidak boleh memakai dua bentuk
       berbeda: panitia yang berpindah di antara keduanya sepanjang pagi
       harus bisa membacanya tanpa belajar dua kali.

       Kelas dasarnya dipasang ulang tiap kali, bukan ditambah-kurang satu
       per satu: penanda yang pernah merah lalu jadi hijau tidak boleh
       menyisakan sisa kelas lamanya. */
    const pil = { belum: "badge-yellow", menyimpan: "badge-yellow",
                  tersimpan: "badge-green", gagal: "badge-red" }[keadaan];
    sel.className = "cek-status" + (pil ? ` badge ${pil}` : "");
    if (keadaan === "belum" || keadaan === "menyimpan") {
      sel.textContent = "\u2026";
      sel.title = "Belum tersimpan";
    } else if (keadaan === "tersimpan") {
      sel.textContent = "\u2713";
      sel.title = "Sudah tersimpan";
    } else if (keadaan === "gagal") {
      sel.textContent = "!";
      sel.title = pesan || "Gagal menyimpan \u2014 ketuk untuk mengulang";
    } else {
      sel.textContent = "";
      sel.title = "";
    }
  }

  /** Keadaan awal tiap lomba, dibaca dari angka yang memang ada di database.
   *
   *  Lomba yang seluruh kriterianya terisi ditandai TERSIMPAN; yang kosong
   *  tidak ditandai apa-apa. Menandai yang kosong dengan centang akan
   *  mengatakan "aman" tentang sesuatu yang belum ada. */
  function statusAwal() {
    if (!lembar.length) return;
    const r = lembar[indeks];
    lombaPos().forEach(l => {
      const dipakai = l.kolom.map(kol => varianUntuk(kol, r.golongan)).filter(Boolean);
      const terisi = dipakai.filter(k => (r.nilai || {})[k.kode] !== undefined).length;
      statusLomba(l.kode, dipakai.length && terisi === dipakai.length ? "tersimpan" : "");
    });
  }

  /** Menyimpan satu lomba. Dipanggil sendiri saat angkanya berubah — tidak ada
   *  tombol simpan lagi.
   *
   *  Yang mengirim tetap kirimNilaiRegu(), satu pintu bersama layar input:
   *  keempat aturannya (kotak tak terbaca tidak menyentuh angka lama, kotak
   *  kosong berarti hapus, angka yang sama tidak dikirim ulang, gagal jaringan
   *  masuk antrean) berlaku sama di sini karena memang kode yang sama. */
  const sedangSimpan = new Set();
  async function simpanLomba(kode) {
    if (!lembar.length || sedangSimpan.has(kode)) return;
    const r = lembar[indeks];
    const l = lombaPos().find(x => x.kode === kode);
    const wadah = elIsi.querySelector(`[data-isian="${CSS.escape(kode)}"]`);
    if (!l || !wadah) return;
    // Lomba yang tergembok tidak dikirim sama sekali: server akan menolaknya,
    // dan penolakan yang bisa dihindari lebih baik tidak dibuat.
    if (lombaTerkunci().has(kode)) return;

    sedangSimpan.add(kode);
    statusLomba(kode, "menyimpan");
    let jawab;
    try {
      jawab = await kirimNilaiRegu({ pos: nomorPos, kolom: l.kolom, regu: r, wadah });
    } finally {
      sedangSimpan.delete(kode);
    }

    if (jawab.hasil === "takTerbaca") {
      statusLomba(kode, "gagal", `${jawab.nama.join(", ")}: bukan angka yang bisa dibaca`);
      notif(`${jawab.nama.join(", ")}: isinya bukan angka/waktu yang bisa `
            + "dibaca. Angka lamanya TIDAK diubah.", true);
      return;
    }
    if (jawab.hasil === "kosong") {
      // Tidak ada yang berubah — bukan galat, dan bukan pula kabar. Diam.
      statusAwal();
      return;
    }
    if (jawab.hasil === "ditolak") {
      statusLomba(kode, "gagal", jawab.pesan);
      notif(`${dada3(r.nomor_dada)}.\n${kapital(jawab.pesan)}`, true);
      return;
    }
    if (jawab.hasil === "antre") {
      // Masih titik-titik kuning, karena memang belum sampai. Pita antrean di
      // atas layar yang menceritakan sisanya.
      statusLomba(kode, "belum");
      notif(`${dada3(r.nomor_dada)} BELUM terkirim — masuk antrean, `
            + "dikirim otomatis saat ada sinyal.", true);
      gambarPitaAntrean();
      return;
    }
    statusLomba(kode, "tersimpan");
    /* Barisnya dibaca ulang, tapi layarnya TIDAK digambar ulang: panitia
       sedang menatap foto, dan menggambar ulang melempar gulirannya. Yang
       perlu ikut berubah cuma gemboknya — kelengkapan lomba menentukan boleh
       tidaknya digembok. */
    await segarkanBaris(Number(r.nomor_dada));
    gambarKunci();
  }

  /* SIMPAN SENDIRI SAAT DIUBAH, dengan pola yang sama persis dengan lembar
     pos — dan ketiga pendengarnya perlu, bukan satu:

       input     menandai kuning sejak KETUKAN PERTAMA. Di antara mengetik dan
                 meninggalkan kotak bisa lewat semenit, dan selama itu angkanya
                 cuma ada di layar.
       change    menyimpan saat kotaknya ditinggalkan dengan isi yang berbeda.
       focusout  jaring pengaman: mengetik ulang angka yang SAMA memicu `input`
                 tapi tidak selalu memicu `change`, jadi tanpa ini penanda
                 kuningnya menggantung selamanya. */
  elIsi.addEventListener("input", (e) => {
    const wadah = e.target.closest("[data-isian]");
    if (wadah) statusLomba(wadah.dataset.isian, "belum");
  }, { signal: sinyal });

  elIsi.addEventListener("change", (e) => {
    const wadah = e.target.closest("[data-isian]");
    if (wadah) simpanLomba(wadah.dataset.isian);
  }, { signal: sinyal });

  elIsi.addEventListener("focusout", (e) => {
    const wadah = e.target.closest("[data-isian]");
    if (!wadah) return;
    const sel = elIsi.querySelector(`[data-status="${CSS.escape(wadah.dataset.isian)}"]`);
    if (sel && sel.dataset.keadaan === "belum") simpanLomba(wadah.dataset.isian);
  }, { signal: sinyal });

  /* Penanda GAGAL bisa diketuk untuk mengulang. Satu-satunya keadaan yang
     menuntut tindakan, dan tanpa jalan mengulang panitia harus mengetik ulang
     angka yang sudah benar di layarnya. */
  elIsi.addEventListener("click", (e) => {
    const sel = e.target.closest(".cek-status");
    if (sel && sel.dataset.keadaan === "gagal") simpanLomba(sel.dataset.status);
  }, { signal: sinyal });

  const ke = (i) => {
    if (i < 0 || i >= lembar.length || i === indeks) return;
    indeks = i;
    gambarRegu();
  };

  /** Tetangga berikutnya yang LOLOS saringan, atau -1 kalau tidak ada lagi.
   *
   *  Inilah seluruh isi saringan di layar ini: barisnya tidak dibuang, cuma
   *  dilewati panah. */
  const tetangga = (arah) => {
    for (let i = indeks + arah; i >= 0 && i < lembar.length; i += arah) {
      if (cocokSaring(lembar[i])) return i;
    }
    return -1;
  };
  const geser = (arah) => { const i = tetangga(arah); if (i >= 0) ke(i); };

  elMundur.addEventListener("click", () => geser(-1), { signal: sinyal });
  elMaju.addEventListener("click", () => geser(1), { signal: sinyal });

  /* Satu pendengar di wadahnya, bukan satu per chip: isiSaring() membangun
     ulang tombolnya saat "Belum Foto" datang atau pergi, dan pendengar yang
     menempel pada tombol ikut terbuang bersamanya. aria-pressed tidak diubah
     di sini — isiSaring() yang mengurusnya, lewat kedua jalan di bawah. */
  elSaring.addEventListener("click", (e) => {
    const b = e.target.closest("[data-saring]");
    if (!b || b.getAttribute("aria-pressed") === "true") return;
    saring = b.dataset.saring;
    /* Regu yang sedang terbuka TIDAK ditinggalkan kalau ia masih lolos. Kalau
       tidak, layar pindah ke yang pertama lolos — dan kalau tidak ada satu
       pun, ia tetap di tempatnya dengan kedua panah mati. Angka (0) di
       pilihannya sudah mengatakan itu sebelum ditekan. */
    if (lembar.length && !cocokSaring(lembar[indeks])) {
      const i = lembar.findIndex(cocokSaring);
      if (i >= 0) { ke(i); return; }
    }
    perbaruiNavigasi();
  }, { signal: sinyal });

  /* Panah kiri-kanan menggerakkan halaman juga. Petugas yang membandingkan
     dua ratus regu menekan "Berikutnya" dua ratus kali, dan memindahkan
     tangan ke tetikus setiap kali adalah pekerjaan yang tidak menghasilkan
     apa pun. Dimatikan selagi fokus ada di kotak isian: di sana panah
     memindahkan kursor, dan halaman yang berpindah sendiri saat orang
     membetulkan ketikannya lebih buruk daripada tidak ada pintasan. */
  const panahNavigasi = (e) => {
    if (e.target.matches("input, select, textarea")) return;
    if (e.key === "ArrowLeft") geser(-1);
    else if (e.key === "ArrowRight") geser(1);
  };
  // Satu baris dengan opsinya, bukan dipecah: tests/screen_listener_cleanup
  // memeriksa BARIS yang memuat window.addEventListener, dan pendengar layar
  // yang signal-nya jatuh ke baris berikutnya terbaca olehnya sebagai
  // pendengar tanpa signal.
  window.addEventListener("keydown", panahNavigasi, { signal: sinyal });

  elPos.addEventListener("change", () => {
    nomorPos = Number(elPos.value);
    muatPos();
  }, { signal: sinyal });

  /** Melompat ke nomor yang diketik. Nomor yang tidak ada di pos ini
   *  dikembalikan ke nomor yang sedang terbuka — kotak yang ditinggalkan
   *  berisi nomor yang tidak sedang dilihat siapa pun berbohong tentang
   *  layar di bawahnya. */
  const lompat = (tutupPapanKetik) => {
    const cari = Number(elDada.value);
    if (!cari) return;
    const i = lembar.findIndex(r => Number(r.nomor_dada) === cari);
    if (i < 0) {
      notif(`Nomor ${dada3(cari)} tidak ada di pos ini.`, true);
      elDada.value = lembar.length ? dada3(lembar[indeks].nomor_dada) : "";
      return;
    }
    if (tutupPapanKetik) elDada.blur();
    ke(i);
  };
  /* MENCARI SAMBIL DIKETIK, bukan menunggu Enter — dan di HP itu bukan
     kenyamanan melainkan syarat.

     Papan ketik angka iPhone TIDAK PUNYA tombol Enter. Selama layar ini cuma
     mendengar `change` dan Enter, satu-satunya cara memicunya adalah mengetuk
     ke tempat lain di layar, dan tidak ada apa pun yang memberitahukan itu:
     nomornya sudah tertulis di kotak, papan ketiknya masih terbuka, dan
     layarnya tidak bergerak. Dilaporkan begitu, 1 September 2026 — "ketika
     dipilih 100 tidak muncul", dengan kotak berisi 100 dan layar masih di
     regu 002.

     Kedua kotak nomor dada lain (layar input dan Finish) sudah lama mencari
     sambil diketik. Layar ini yang tertinggal.

     DITUNDA 400 ms: "1", "10", "100" adalah tiga keadaan, dan dua yang
     pertama akan menggambar ulang layar beserta memuat fotonya untuk regu
     yang bukan tujuan siapa pun.

     TIDAK menutup papan ketik, tidak seperti jalur Enter. Petugas yang masih
     mengetik angka ketiganya tidak boleh kehilangan papan ketiknya di angka
     kedua. */
  let jedaLompat = null;
  elDada.addEventListener("input", () => {
    clearTimeout(jedaLompat);
    jedaLompat = setTimeout(() => lompat(false), 400);
  }, { signal: sinyal });
  elDada.addEventListener("change", () => { clearTimeout(jedaLompat); lompat(true); },
    { signal: sinyal });
  elDada.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); clearTimeout(jedaLompat); lompat(true); }
  }, { signal: sinyal });
  // Isi kotak dipilih saat diketuk, jadi nomor berikutnya tinggal diketik
  // menimpa — aturan yang sama dengan kotak nomor dada di layar input.
  elDada.addEventListener("focusin", () => {
    if (!elDada.value) return;
    setTimeout(() => {
      if (document.activeElement === elDada) {
        try { elDada.select(); } catch { /* abaikan */ }
      }
    }, 0);
  }, { signal: sinyal });

  await muatPos();
}
