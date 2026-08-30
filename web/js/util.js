/* ============================================================================
   hrcd-rekap : util.js — alat bersama yang dipakai semua layar.
   Yang terpenting: esc(). Nama sekolah dan nama regu diketik orang luar dan
   ditampilkan ke panitia — tanpa escape, satu nama berisi tag HTML bisa
   menjalankan skrip di layar panitia (temuan review: XSS tersimpan).
   ========================================================================== */

/** Escape teks agar aman ditaruh di dalam HTML maupun di dalam atribut. */
export function esc(v) {
  if (v === null || v === undefined) return "";
  return String(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Bangun fragmen DOM dari string HTML. */
export function h(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content;
}

/** Tag template literal yang meng-escape SEMUA nilai yang disisipkan.
 *  Pakai html`...${namaSekolah}...` alih-alih string biasa. */
export function html(potongan, ...nilai) {
  return potongan.reduce((hasil, p, i) =>
    hasil + p + (i < nilai.length ? esc(nilai[i]) : ""), "");
}

export const rupiah = n => "Rp " + Number(n || 0).toLocaleString("id-ID");

/** Baca jumlah anggota di meja Kedatangan. Kotak kosong memakai default lima,
 * tetapi ketikan yang tidak terbaca atau angka di luar 0–5 harus ditolak. */
export function bacaAnggotaHadir(teks, badInput = false) {
  if (badInput) return null;
  const isi = String(teks ?? "").trim();
  if (isi === "") return 5;
  if (!/^\d+$/.test(isi)) return null;
  const jumlah = Number(isi);
  return jumlah >= 0 && jumlah <= 5 ? jumlah : null;
}

/** Cari kotak pada kolom tabel dan slot yang sama di baris berikutnya.
 *
 * Baris Input Pos tidak selalu punya kotak yang sama: komponen Eksternal
 * digambar sebagai tanda mati pada baris Intern, dan sebaliknya. Karena itu
 * indeks di antara seluruh input satu baris tidak menunjukkan kolom tabel.
 * `data-slot` membedakan pasangan Benar/Salah di dalam satu sel. */
export function kotakBerikutnyaDalamKolom(baris, kotak) {
  const selAsal = kotak?.closest?.("td");
  const kolom = selAsal?.cellIndex;
  if (!Number.isInteger(kolom) || kolom < 0) return null;

  const slot = kotak.dataset?.slot || "";
  for (let lanjut = baris?.nextElementSibling; lanjut;
       lanjut = lanjut.nextElementSibling) {
    if (lanjut.hidden) continue;
    const selTujuan = lanjut.cells?.[kolom];
    if (!selTujuan) continue;
    const tujuan = [...selTujuan.querySelectorAll("input")]
      .find(el => (el.dataset?.slot || "") === slot);
    if (tujuan) return tujuan;
  }
  return null;
}

/* ---------------------------------------------------------------------------
   WAKTU — tiga bentuk, dan hanya tiga. Semua layar memakai yang ini.

     jamMenit(t)       15:30
     tanggalPanjang(t) 17 Agustus 2026
     tanggalJam(t)     17 Agustus 2026 15:30

   ATURAN MEMILIH: pakai jamMenit kalau HARINYA sudah jelas dari kedudukannya
   (jam berangkat kloter hari ini, jam datang regu barusan). Pakai tanggalJam
   kalau tidak — cap yang bisa menunjuk hari lain wajib menyebutkan harinya,
   kalau tidak "17:30" terbaca sebagai setengah jam lalu padahal kemarin sore.

   Kenapa nama bulannya ditulis sendiri dan bukan lewat toLocaleDateString:
   berkas data locale tidak selalu lengkap di WebView Android bawaan, dan
   kalau 'id-ID' tidak ada, browser diam-diam mundur ke Inggris — kertas
   kwitansi tercetak "14 August 2026" tanpa ada yang gagal. Larik ini
   menghilangkan seluruh kemungkinan itu.

   Titik dua, BUKAN titik. toLocaleTimeString('id-ID') memberi "07.04", yang
   di layar mudah terbaca sebagai angka desimal.
   ------------------------------------------------------------------------- */

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
               "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const dua = (n) => String(n).padStart(2, "0");

/** "15:30" — 24 jam. Kosong jadi "—", bukan "NaN:NaN". */
/* SEMUA jam di layar dibaca dalam WIB, apa pun zona waktu alatnya.

   Sebelumnya getHours() dipakai apa adanya, yang berarti jam yang tampil
   adalah jam ALAT. Laptop meja IT yang zonanya UTC menampilkan 01:53 untuk
   pukul 08:53 WIB — dan kotak "Jam berangkat" terisi angka itu sebagai
   tebakan awal, lalu ditekan panitia yang sedang terburu-buru.

   Jam berangkat menentukan penalti seluruh regu di kloter itu. Tujuh jam
   meleset bukan salah tampilan; itu seluruh kloter dihitung salah.

   Asia/Jakarta ditulis eksplisit, bukan diserahkan ke locale: satu alat yang
   zonanya keliru cukup untuk merusak satu kloter, dan tidak ada seorang pun
   yang akan memeriksa setelan zona waktu laptop pinjaman pada pukul enam
   pagi. */
const ZONA = "Asia/Jakarta";
const FMT_JAM = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONA, hour: "2-digit", minute: "2-digit", hour12: false,
});
const FMT_TANGGAL = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONA, day: "numeric", month: "numeric", year: "numeric",
});

export function jamMenit(t) {
  if (!t) return "—";
  return FMT_JAM.format(new Date(t));
}

/** "11:26" + hari acuan -> Date pada jam itu, di hari WIB yang sama dengan
 *  acuan.
 *
 *  Bukan "hari ini". Petugas mengetik jam dinding — "11:26" — dan jam dinding
 *  tidak membawa tanggal; tanggalnya harus datang dari peristiwa yang sedang
 *  dicatat, bukan dari kalender alat yang dipakai mencatat. Keduanya sama
 *  pada hari-H dan berbeda pada setiap hari lainnya, termasuk setiap kali
 *  layar ini dibuka untuk dicoba sebelum acara.
 *
 *  Dirakit lewat teks ISO dengan offset +07:00, bukan lewat setHours: yang
 *  terakhir memakai zona alat, dan satu laptop pinjaman yang zonanya keliru
 *  cukup untuk menggeser jam yang tercatat (alasan yang sama dengan ZONA di
 *  atas).
 */
export function jamPadaHari(hhmm, acuan) {
  const [j, m] = hhmm.split(":").map(Number);
  const bagian = {};
  // `new Date(null)` adalah 1 Januari 1970, bukan galat — jadi acuan kosong
  // harus ditangkap di sini, bukan dibiarkan lewat.
  for (const b of FMT_TANGGAL.formatToParts(new Date(acuan || Date.now()))) bagian[b.type] = b.value;
  const dd = String(bagian.day).padStart(2, "0");
  const mm = String(bagian.month).padStart(2, "0");
  const HH = String(j).padStart(2, "0");
  const MM = String(m).padStart(2, "0");
  return new Date(`${bagian.year}-${mm}-${dd}T${HH}:${MM}:00+07:00`);
}

/** "17 Agustus 2026" */
export function tanggalPanjang(t) {
  if (!t) return "—";
  // Tanggalnya WIB juga, bukan cuma jamnya. tanggalJam() menggabung keduanya,
  // dan menjelang tengah malam tanggal alat dan jam WIB bisa menunjuk hari
  // yang berbeda — riwayat yang berbunyi "16 Agustus 06:10" untuk kejadian
  // tanggal 17 lebih buruk daripada tidak ada tanggal sama sekali.
  const bagian = {};
  for (const b of FMT_TANGGAL.formatToParts(new Date(t))) bagian[b.type] = b.value;
  return `${Number(bagian.day)} ${BULAN[Number(bagian.month) - 1]} ${bagian.year}`;
}

/** "17 Agustus 2026 15:30" */
export function tanggalJam(t) {
  if (!t) return "—";
  return `${tanggalPanjang(t)} ${jamMenit(t)}`;
}

/** Cincin berputar di TENGAH layar, menggantikan tulisan "Memuat…".
 *
 *  Tampil SEKETIKA, tanpa jeda. Versi sebelumnya menahannya 180 ms supaya
 *  muat yang cepat tidak berkedip; akibatnya layar terlihat kosong dulu
 *  sebelum apa pun terjadi, dan diam itu justru terbaca sebagai macet.
 *  Kedipan sesekali ternyata harga yang lebih murah daripada keraguan
 *  "ini jalan atau tidak" pada tiap perpindahan layar.
 *
 *  Letaknya di tengah, bukan menempel di bawah header — mata mencari
 *  penanda muat di tempat isi halaman akan muncul, bukan di baris pertama.
 *  Tingginya diatur `.pemuat` di style.css.
 *
 *  `role="status"` + satu baris tersembunyi menjaga pembaca layar tetap
 *  mendapat kabar — bagi mereka perputaran tidak berarti apa-apa. */
export function pemuat(teks = "Memuat…") {
  return `<div class="pemuat" role="status" aria-live="polite">
    <span class="pemuat-cincin" aria-hidden="true"></span>
    <span class="visually-hidden">${esc(teks)}</span>
  </div>`;
}

/** Ikon refresh — dua panah melingkar, sama seperti yang dipakai dashboard
 *  pada umumnya.
 *
 *  SVG, bukan huruf Unicode dan bukan emoji, dan itu keputusan sadar: `↻`
 *  tampil berbeda-beda tebal di tiap sistem dan hilang sama sekali di
 *  sebagian font Android, sedangkan `🔄` datang dengan warnanya sendiri yang
 *  bertabrakan dengan deretan tombol abu-abu di sekitarnya. Yang ini
 *  mengikuti `currentColor`, jadi ia mewarisi warna tombolnya — termasuk saat
 *  tombolnya dipudarkan sedang berputar.
 *
 *  Tanpa ukuran tetap: mengikuti `font-size` tombolnya lewat `1em`. */
export const ikonRefresh = `
  <svg class="ikon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
       stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"
       aria-hidden="true" focusable="false">
    <path d="M21 12a9 9 0 0 1-9 9 9 9 0 0 1-7.4-3.9"/>
    <path d="M3 12a9 9 0 0 1 9-9 9 9 0 0 1 7.4 3.9"/>
    <polyline points="19.6 2.6 19.6 7 15.2 7"/>
    <polyline points="4.4 21.4 4.4 17 8.8 17"/>
  </svg>`;

/** "barusan" · "23 menit lalu" · "2 jam lalu".
 *
 *  Umur sebuah cap, bukan jamnya. Dipakai berdampingan dengan `jamMenit`,
 *  tidak menggantikannya: "14:32" menjawab kapan, "(23 menit lalu)" menjawab
 *  apakah itu masih baru — dan orang yang baru menoleh ke layar butuh
 *  keduanya sekaligus. */
export function berapaLalu(t) {
  const menit = Math.floor((Date.now() - new Date(t).getTime()) / 60000);
  if (menit < 1) return "barusan";
  if (menit < 60) return `${menit} menit lalu`;
  return `${Math.floor(menit / 60)} jam lalu`;
}

/** Membaca jam yang DIKETIK panitia dan mengembalikannya sebagai "HH:MM"
 *  24 jam — atau `null` kalau bukan jam yang sah.
 *
 *  Ini menggantikan `<input type="time">` di dua meja yang mencatat jam.
 *  Alasannya bukan selera: kotak jam bawaan browser dirender menurut locale
 *  BROWSER, bukan `lang="id"` halaman ini, jadi laptop panitia yang Chrome-nya
 *  berbahasa Inggris menampilkan "07:15 AM" — dan tidak ada atribut HTML mana
 *  pun yang bisa memaksanya 24 jam. Satu meja memakai AM/PM sementara semua
 *  kertas, semua layar lain, dan seluruh sisa sistem memakai 00:00-23:59
 *  adalah cara yang murah sekali untuk mencatat 07:15 sebagai 19:15.
 *
 *  Yang diterima sengaja longgar, karena pencatat menyalin dari kertas dan
 *  mengetik cepat: "745", "0745", "7:45", "7.45", "07 45" — semuanya jadi
 *  "07:45". Yang di luar 00:00-23:59 ditolak, bukan dibetulkan diam-diam. */
export function jamSah(teks) {
  const angka = String(teks ?? "").replace(/\D/g, "");
  if (angka.length < 3 || angka.length > 4) return null;
  // "745" dibaca 7:45, bukan 74:5 — jam selalu bagian KIRI dan boleh satu
  // digit; menitnya selalu dua digit terakhir.
  const j = Number(angka.slice(0, angka.length - 2));
  const m = Number(angka.slice(-2));
  if (!Number.isInteger(j) || !Number.isInteger(m)) return null;
  if (j > 23 || m > 59) return null;
  return `${dua(j)}:${dua(m)}`;
}

/** WAKTU LOMBA, SATU KOTAK. Menerima apa pun yang tertera di stopwatch:
 *
 *    "32"    -> 32 detik        "0:32"  -> 32 detik
 *    "1:10"  -> 70 detik        "95"    -> 95 detik
 *
 *  Aturannya satu kalimat: ada titik dua berarti menit:detik, tanpa titik dua
 *  berarti detik. Tidak ada tebakan di antaranya — "120" selalu 120 detik,
 *  tidak pernah 1 menit 20.
 *
 *  Dulu ini dua kotak, Menit dan Detik terpisah. Yang membunuhnya bukan selera
 *  melainkan hitungan: tangga poin Pos 2 habis di 40 detik, jadi kotak menit
 *  berisi 0 di hampir setiap baris — 46 regu x 3 lomba = 138 ketukan hanya
 *  untuk mengetik nol, di layar yang sudah harus digeser ke samping.
 *
 *  null = bukan waktu yang sah. Teks kosong juga null, dan itu BUKAN nol:
 *  kotak kosong berarti belum dinilai (lihat bacaSel di app.js).
 *
 *  Menit tidak dibatasi — lomba yang molor sampai 90 menit tetap tercatat apa
 *  adanya. Detik dibatasi 0-59: "1:75" adalah salah ketik, bukan 135 detik,
 *  dan menerimanya diam-diam berarti mencatat waktu yang tidak pernah ada.
 *
 *  TITIK DAN SPASI DITOLAK, bukan diperlakukan sebagai titik dua. Dua orang
 *  mengetik tanda yang sama dan memaksudkan dua besaran yang berbeda: di layar
 *  stopwatch "24.31" berarti 24,31 detik, sedangkan di tulisan tangan panitia
 *  "1.30" berarti satu menit tiga puluh. Menebak salah satunya berarti
 *  menyimpan waktu yang tidak pernah terjadi, tanpa satu pun tanda. Yang
 *  ditolak berhenti sebagai baris merah dan diketik ulang jadi "24" atau
 *  "1:30" — tiga ketukan, di layar, oleh orang yang memegang stopwatchnya.
 *
 *  Aturan penggantian itu diwarisi dari jamSah, tempat "7.45" memang 07:45.
 *  Di sini akibatnya: "24.31" tersimpan sebagai 24*60+31 = 1471 detik, lolos
 *  rentang 0-3600 tanpa galat, dan bernilai 20 poin alih-alih 100. Keempat
 *  layar lalu sepakat pada angka yang salah, karena angka mentahnya sendiri
 *  yang sudah salah. */
export function detikSah(teks) {
  const t = String(teks ?? "").trim();
  if (t === "") return null;
  if (!/^\d+(:\d{1,2})?$/.test(t)) return null;

  const [a, b] = t.split(":");
  if (b === undefined) return Number(a);
  const d = Number(b);
  if (d > 59) return null;
  return Number(a) * 60 + d;
}

/** METER, DISIMPAN SEBAGAI SENTIMETER BULAT.
 *
 *  Alasannya ditulis di kepala migrasi 0059, dan berlaku persis seperti untuk
 *  `detik`: nilai mentah tidak punya koma. Pecahan yang masuk ke satu kolom
 *  menyebar ke setiap tempat yang membacanya — jadi yang disimpan satuan
 *  terkecil yang bulat, dan yang dilihat orang satuan yang ia ucapkan.
 *
 *    "8"     -> 800 cm       "8.1"  -> 810 cm
 *    "8.55"  -> 855 cm       "8,55" -> 855 cm
 *
 *  KOMA IKUT DITERIMA, dan itu bukan kelonggaran. Peserta menulis "8,55" di
 *  blangko karena begitulah angka ditulis dalam bahasa Indonesia; petugas
 *  yang menyalinnya mengetik apa yang ia baca. Menolaknya berarti menolak
 *  angka yang benar karena tanda bacanya, di tengah antrean.
 *
 *  Lebih dari dua angka di belakang koma dibulatkan, bukan ditolak: yang
 *  mengetik "8.555" bermaksud 8,55 atau 8,56 — keduanya jauh lebih dekat ke
 *  kebenaran daripada kotak yang dikosongkan karena ditolak. */
export function meterSah(teks) {
  const t = String(teks ?? "").trim().replace(",", ".");
  if (!t || !/^\d+(\.\d+)?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

/** Kebalikan meterSah: SELALU dua angka di belakang koma — 800 jadi "8.00",
 *  810 jadi "8.10". Bentuk yang tetap membuat kolom angka bisa dibandingkan
 *  sekilas dari atas ke bawah, dan membuat "8" yang diketik terbaca kembali
 *  sebagai 8,00 meter alih-alih 8 sesuatu. */
export function meterTeks(cm) {
  if (cm === null || cm === undefined || cm === "") return "";
  const n = Number(cm);
  return Number.isFinite(n) ? (n / 100).toFixed(2) : "";
}

/** Kebalikan detikSah: SELALU menit:detik berpadding — 50 jadi "00:50", 80
 *  jadi "01:20". Yang diketik boleh bentuk apa saja yang diterima detikSah
 *  ("50", "1:20", "01:20"); yang TERGAMBAR selalu satu bentuk.
 *
 *  Dulu di bawah semenit ditulis polos ("32") dan semenit ke atas pakai titik
 *  dua ("1:10"), supaya teksnya persis seperti yang tadi diketik. Harganya:
 *  satu kolom waktu memuat "44" dan "1:03" bersebelahan, dan dua bentuk untuk
 *  satu besaran membuat mata harus menerjemahkan tiap baris sebelum bisa
 *  membandingkannya — padahal membandingkan waktu antar regu justru satu-
 *  satunya alasan kolom itu dibaca berurutan.
 *
 *  Angka yang tersimpan TIDAK berubah: yang masuk database tetap detik bulat,
 *  dan ini cuma cara menuliskannya kembali. */
export function detikTeks(total) {
  if (total === null || total === undefined || total === "") return "";
  const d = Math.round(Number(total));
  if (!Number.isFinite(d)) return "";
  return `${dua(Math.floor(d / 60))}:${dua(d % 60)}`;
}

/** Kotak jam 24 orang-ketik. Dipasang di setiap `<input>` yang menerima jam:
 *  membetulkan bentuknya saat kotak ditinggalkan, dan menandainya merah kalau
 *  isinya bukan jam. Membetulkan saat blur, BUKAN saat tiap ketukan — menata
 *  ulang teks di tengah orang mengetik memindahkan kursornya dan membuat
 *  angka berikutnya mendarat di tempat yang salah. */
/** DUA KOTAK JAM: [HH] : [MM], tapi mengetik "1503" beruntun tetap jalan.
 *
 *  Dua kotak supaya bagian menit bisa diklik dan diperbaiki sendiri tanpa
 *  mengetik ulang jamnya. Satu kotak tidak bisa memberi itu: mengklik di tengah
 *  lalu mengetik membuat kursor melompat ke ujung.
 *
 *  Yang tidak boleh hilang karena pemisahan itu adalah mengetik beruntun.
 *  Petugas keberangkatan mengetik empat angka tanpa melihat layar, dan memaksa
 *  mereka berpindah kotak di tengah akan lebih lambat daripada sebelumnya. Jadi
 *  HH MELUAP sendiri ke MM begitu ia penuh.
 *
 *  KAPAN HH DIANGGAP PENUH — dan di sinilah satu aturan menyelamatkan bentuk
 *  ketikan yang paling sering:
 *
 *    dua angka           -> penuh. "15" lalu lompat.
 *    satu angka 3-9      -> penuh JUGA, dan dijadikan "07".
 *
 *  Jam tertinggi 23, jadi angka pertama 3-9 mustahil menjadi awal jam dua
 *  angka: kalau yang diketik 7, satu-satunya bacaan yang mungkin adalah 07.
 *  Karena itu "745" jadi 07:45 — bentuk yang paling sering diketik untuk jam
 *  pagi, dan lomba ini berangkat pukul tujuh.
 *
 *  Yang dikorbankan: "250" tidak lagi terbaca 2:50, karena angka pertama 2
 *  memang bisa menjadi awal jam 20-23. Jam dua pagi tidak pernah terjadi di
 *  lomba yang berangkat pukul 07.00 dan selesai sore.
 */

/** Markup sepasang kotak jam. `id` jadi patokan: `<id>-hh` dan `<id>-mm`. */
export function kotakJamHtml(id, nilai = "") {
  const [hh = "", mm = ""] = String(nilai || "").split(":");
  return `<span class="jam-pasang" id="${id}">
    <input type="text" class="jam-ketik jam-hh" id="${id}-hh" value="${hh}"
           inputmode="numeric" autocomplete="off"
           spellcheck="false" placeholder="HH" aria-label="Jam">
    <span class="jam-titik" aria-hidden="true">:</span>
    <input type="text" class="jam-ketik jam-mm" id="${id}-mm" value="${mm}"
           inputmode="numeric" maxlength="2" autocomplete="off"
           spellcheck="false" placeholder="MM" aria-label="Menit">
  </span>`;
}

/** Menyalakan sepasang kotak jam dan mengembalikan kendalinya.
 *
 *  Sengaja BUKAN objek yang menyamar jadi <input>. Layar memanggil nilai() dan
 *  setNilai() dengan nama itu, jadi terbaca bahwa yang dipegang adalah sepasang
 *  kotak — bukan satu kotak yang kebetulan punya titik dua. */
export function pasangKotakJam(id) {
  const wadah = document.getElementById(id);
  if (!wadah) return null;
  const hh = document.getElementById(`${id}-hh`);
  const mm = document.getElementById(`${id}-mm`);
  const pendengar = [];

  /* Kedua kotak DIBACA SEBAGAI DUA, bukan disambung jadi satu teks.
   *
   * Versi pertama menyambung isinya lalu menyerahkannya ke jamSah(), yang
   * membaca "dua angka terakhir adalah menit". Untuk kotak yang terpisah itu
   * salah, dan salahnya diam-diam: jam 10 menit 5 tersambung jadi "105", lalu
   * dibaca ulang sebagai 1:05. Petugas melihat 10 dan 5 di layarnya, dan yang
   * tersimpan pukul satu lewat lima.
   *
   * Kotaknya sudah TAHU mana jam dan mana menit. Membuang keterangan itu lalu
   * menebaknya kembali dari bentuk gabungan adalah kekeliruan yang tidak perlu
   * ada. Sekarang keduanya dinolkan di depan lebih dulu, jadi "10" dan "5"
   * menjadi "1005" — satu-satunya bacaan yang mungkin. */
  const nilai = () => {
    const h = hh.value.trim(), m = mm.value.trim();
    if (!h || !m) return null;
    return jamSah(h.padStart(2, "0") + m.padStart(2, "0"));
  };

  /* ISI DIPILIH SAAT KOTAKNYA DIKETUK, dan tanpa ini kotak yang sudah terisi
     tidak bisa diperbaiki.

     Kotak HH berisi "10". Petugas mengetuknya untuk mengubah jam, menekan 1,
     dan yang terjadi bukan "1" melainkan "110" — angka baru DISISIPKAN di
     sebelah yang lama. Tiga angka lalu terbaca sebagai ketikan beruntun, jadi
     luapannya menendang satu angka ke kotak menit. Petugas menekan satu tombol
     dan kursornya sudah pindah kotak.

     Memilih seluruh isi saat fokus membuat ketukan pertama MENGGANTI, bukan
     menyisipkan — perilaku yang sama dengan kotak jam di aplikasi mana pun.
     Mengetuk kedua kali tetap menaruh kursor seperti biasa, jadi menyunting
     satu angka masih mungkin bagi yang menginginkannya.

     Lewat setTimeout karena Safari iOS membatalkan select() yang dipanggil di
     dalam penanganan focus itu sendiri — dan HP iOS adalah yang dipegang
     petugas di garis start. */
  const pilihIsi = (el) => setTimeout(() => {
    if (document.activeElement === el) { try { el.select(); } catch { /* abaikan */ } }
  }, 0);
  hh.addEventListener("focus", () => pilihIsi(hh));
  mm.addEventListener("focus", () => pilihIsi(mm));

  /* LAPIS KEDUA: kotak yang sudah PENUH, angka berikutnya memulai dari awal.
     Berlaku di mana pun kursornya berada.

     Memilih isi saat fokus (di atas) sudah menyelesaikan kasus yang dilaporkan,
     tapi ia bergantung pada browser menghormati select() — dan Safari iOS
     punya beberapa keadaan di mana ia tidak. Aturan ini tidak bergantung pada
     apa pun: kalau kotak sudah memuat dua angka dan yang diketik satu angka
     lagi, isinya DIGANTI, bukan disisipi. Kursor di awal, di tengah, atau di
     ujung tidak mengubah hasilnya.

     Ketikan beruntun tidak terganggu. Mengetik 1503 dari kosong tidak pernah
     memasukkan angka ketiga ke kotak jam — begitu dua angka penuh, fokusnya
     sudah pindah ke menit. Satu-satunya cara kotak penuh menerima ketikan lagi
     adalah petugas sengaja kembali ke sana, dan saat itu maksudnya mengganti.

     MENEMPEL dikecualikan: menempel "1503" memang harus meluap ke menit, dan
     itu jalur yang dipakai saat layar mengisi kotak dari data. */
  const menimpaBilaPenuh = (el) => el.addEventListener("beforeinput", (e) => {
    if (e.inputType !== "insertText" || !/^\d$/.test(e.data || "")) return;
    const penuh = el.value.replace(/\D/g, "").length >= 2;
    const semuaTerpilih = el.selectionStart === 0
                       && el.selectionEnd === el.value.length;
    if (!penuh || semuaTerpilih) return;
    e.preventDefault();
    el.value = e.data;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  menimpaBilaPenuh(hh);
  menimpaBilaPenuh(mm);

  const tandai = () => {
    const kosong = !hh.value.trim() && !mm.value.trim();
    const buruk = !kosong && !nilai();
    // Merah dipasang di WADAH, bukan di salah satu kotak: yang salah adalah
    // jamnya sebagai satu kesatuan, dan menyalahkan kotak menit untuk jam 25
    // menyuruh petugas membetulkan tempat yang benar.
    wadah.classList.toggle("jam-salah", buruk);
    return !buruk;
  };

  const beri = (fn) => { pendengar.forEach(fn); };

  hh.addEventListener("input", () => {
    const angka = hh.value.replace(/\D/g, "");
    // Ketikan beruntun / tempel: sisanya dijatuhkan ke menit, bukan dibuang.
    if (angka.length > 2) {
      hh.value = angka.slice(0, 2);
      mm.value = angka.slice(2, 4);
      mm.focus(); mm.setSelectionRange(mm.value.length, mm.value.length);
    } else if (angka.length === 2) {
      hh.value = angka; mm.focus(); mm.select();
    } else if (angka.length === 1 && Number(angka) > 2) {
      hh.value = `0${angka}`; mm.focus(); mm.select();
    } else {
      hh.value = angka;
    }
    tandai(); beri(f => f());
  });

  mm.addEventListener("input", () => {
    mm.value = mm.value.replace(/\D/g, "").slice(0, 2);
    tandai(); beri(f => f());
  });

  // Backspace di menit yang sudah kosong melompat balik ke jam. Tanpa itu
  // petugas harus mengangkat tangan dari papan angka untuk mengetuk kotak
  // sebelahnya — satu-satunya gerakan yang tidak bisa dilakukan sambil menatap
  // regu di depan meja.
  mm.addEventListener("keydown", (e) => {
    if (e.key === "Backspace" && mm.value === "") {
      hh.focus(); hh.setSelectionRange(hh.value.length, hh.value.length);
    }
  });

  // Dirapikan saat SEPASANG kotak ini ditinggalkan, bukan saat pindah antar
  // keduanya: "7" di jam belum tentu salah, ia mungkin sedang menuju "07".
  const rapikan = () => {
    setTimeout(() => {
      if (document.activeElement === hh || document.activeElement === mm) return;
      const v = nilai();
      if (v) { [hh.value, mm.value] = v.split(":"); }
      tandai();
    }, 0);
  };
  hh.addEventListener("blur", rapikan);
  mm.addEventListener("blur", rapikan);

  return {
    nilai,
    setNilai(v) {
      const [a = "", b = ""] = String(v || "").split(":");
      hh.value = a; mm.value = b; tandai();
    },
    kosong: () => !hh.value.trim() && !mm.value.trim(),
    salah(ya) { wadah.classList.toggle("jam-salah", !!ya); },
    fokus() { hh.focus(); hh.select(); },
    dengar(fn) { pendengar.push(fn); },
    // Peristiwa DOM dipasang ke KEDUA kotak. Enter di kotak menit harus
    // menyimpan sama seperti Enter di kotak jam — petugas tidak boleh perlu
    // tahu kotak mana yang sedang aktif.
    pada(nama, fn) { hh.addEventListener(nama, fn); mm.addEventListener(nama, fn); },
  };
}

/** Notifikasi bawah layar.
 *
 *  Keduanya hilang sendiri, tapi galat diberi waktu DUA KALI LIPAT: 8 detik
 *  lawan 4. Sebelumnya galat tidak hilang sama sekali — orang awam sering
 *  sedang menatap papan ketik saat pesan muncul (temuan review), dan pesan
 *  yang keburu pergi sama saja dengan tidak pernah ada. Tapi pesan yang
 *  menetap selamanya punya harganya sendiri: ia menumpuk di bawah layar
 *  sepanjang hari dan menutupi tombol di sana, sampai panitia belajar
 *  mengabaikannya. Delapan detik cukup untuk mengangkat kepala dan membaca,
 *  dan tombol tutupnya tetap ada untuk yang ingin membuangnya lebih cepat.
 *
 *  Redupnya dilakukan lewat kelas .pudar, bukan animasi JavaScript, supaya
 *  aturan prefers-reduced-motion di gaya ikut berlaku: pengguna yang memilih
 *  "kurangi gerak" mendapat hilang seketika, bukan pudar. */
const DETIK_NOTIF      = 4000;
const DETIK_NOTIF_GALAT = 8000;

/** Huruf pertama dibesarkan. Pesan galat dari database lahir huruf kecil —
 *  itu konvensi SQL — dan di layar panitia ia terbaca seperti potongan log,
 *  bukan kalimat.
 *
 *  DIEKSPOR, karena notif() bukan lagi satu-satunya yang membutuhkannya:
 *  pesan yang digandeng di belakang kalimat lain ("Nomor Dada 007.
" + ...)
 *  tidak lagi berada di awal teks, jadi pembesaran di dalam notif() tidak
 *  menjangkaunya. */
export const kapital = (t) =>
  String(t).charAt(0).toUpperCase() + String(t).slice(1);

export function notif(pesan, galat = false) {
  document.querySelectorAll(".notification").forEach(n => n.remove());
  // Template BIASA, bukan tag html`` — tombol tutupnya HTML yang memang
  // harus DIRENDER. Tag html`` meng-escape SEMUA yang disisipkan (itu
  // gunanya, mencegah XSS dari nama sekolah), jadi tombolnya ikut jadi
  // korban dan tampil apa adanya sebagai teks di layar panitia.
  // Pesannya tetap lewat esc() — itu satu-satunya bagian dari luar.
  // Pesan galat dari database lahir huruf kecil — itu konvensi SQL
  // (`raise exception 'regu ... belum konfirmasi kontrak waktu'`). Di layar
  // panitia ia terbaca seperti potongan log, bukan kalimat. Huruf pertama
  // dibesarkan DI SINI, satu tempat, supaya pesan dari mana pun ikut rapi
  // tanpa perlu menyentuh belasan `raise exception` di migrasi.
  const kalimat = kapital(pesan);
  const n = h(`<div class="notification ${galat ? "error" : ""}" role="alert">
      <span class="notif-ikon">${ikon(galat ? "circle-alert" : "circle-check-big")}</span>
      <span class="notif-teks">${esc(kalimat)}</span>
      ${galat ? `<button class="notification-close" type="button" aria-label="tutup">${
        ikon("x")}</button>` : ""}
    </div>`);
  document.body.appendChild(n);
  const el = document.body.lastElementChild;
  if (galat) el.querySelector(".notification-close").addEventListener("click", () => el.remove());

  // Papan ketik HP MENUTUPI toast ini. Ia dipatok `position: fixed; bottom`,
  // dan patokan itu layout viewport — yang TIDAK menyusut saat papan ketik
  // muncul. Jadi pesan "nomor dada intern adalah 1001-1250" muncul persis di
  // belakang tombol angka, tepat pada satu-satunya saat ia dibutuhkan.
  //
  // visualViewport tahu berapa tinggi yang benar-benar terlihat. Selisihnya
  // itulah tinggi papan ketik, dan toast-nya diangkat sebanyak itu. Di layar
  // tanpa papan ketik selisihnya nol, jadi tampilannya tidak berubah sama
  // sekali. Browser lama tanpa visualViewport melewatkannya begitu saja.
  const vv = window.visualViewport;
  const angkat = () => {
    const tertutup = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    el.style.bottom = `calc(1.2rem + ${Math.round(tertutup)}px)`;
  };
  if (vv) {
    angkat();
    vv.addEventListener("resize", angkat);
    vv.addEventListener("scroll", angkat);
  }
  const lepas = () => {
    if (!vv) return;
    vv.removeEventListener("resize", angkat);
    vv.removeEventListener("scroll", angkat);
  };
  if (galat) el.querySelector(".notification-close").addEventListener("click", lepas);

  // Dipudarkan dulu, baru dibuang setelah transisinya selesai (.35s di gaya).
  // Kalau sudah ditutup manual, el sudah lepas dari halaman dan kedua baris
  // ini tidak melakukan apa-apa — remove() pada simpul yang sudah lepas aman.
  const jeda = galat ? DETIK_NOTIF_GALAT : DETIK_NOTIF;
  setTimeout(() => {
    el.classList.add("pudar");
    setTimeout(() => { lepas(); el.remove(); }, 400);
  }, jeda);
}

/** Dialog sederhana pengganti prompt(): punya judul, kartu identitas,
 *  beberapa isian, dan tombol batal yang jelas (temuan review: prompt()
 *  beruntun membingungkan dan batalnya senyap). */
/** Dialog. Membatalkan selalu lewat SILANG di pojok kanan atas, tidak lagi
 *  lewat tombol "Batal" sebaris dengan tombol aksinya: dua tombol selebar
 *  layar bertumpuk membuat yang membatalkan dan yang mengerjakan terlihat
 *  sama penting, dan di HP jari menemukan yang atas lebih dulu.
 *
 *  `bacaSaja: true` kini tidak mengubah apa pun — dulu ia membuang tombol
 *  Batal, dan tombol itu sudah tidak ada untuk siapa pun. Dibiarkan supaya
 *  belasan pemanggilnya tidak perlu disunting dalam satu commit yang sama.
 *
 *  "Batal" pada dialog yang tidak mengubah apa pun bukan sekadar mubazir: ia
 *  menyiratkan ada sesuatu yang sedang berjalan dan bisa diurungkan. Orang yang
 *  membuka riwayat lalu melihat Batal akan berhenti sejenak memikirkan apa yang
 *  ia batalkan.
 *
 *  Penandanya EKSPLISIT, bukan diterka dari `medan` yang kosong. Lima dari enam
 *  pemanggil dialog di sistem ini tidak punya medan sama sekali — mereka
 *  konfirmasi ya/tidak yang justru paling membutuhkan tombol Batal. Menerka
 *  akan mencabutnya dari kelimanya sekaligus, dan yang tersisa cuma tombol
 *  "Ya". */
/* `pasang` adalah kail opsional untuk dialog yang isinya BUKAN isian: ia
   dipanggil sesudah kartunya digambar, dengan elemennya dan fungsi penutup,
   sehingga tombol di dalam kartuHtml bisa menutup dialog sambil membawa
   jawabannya. Dipakai layar Akun — menu aksi per akun adalah tiga tombol,
   bukan tiga kotak isian, dan memaksanya jadi `medan` akan meminta orang
   MENGETIK pilihannya. */
/** `silangSaja: true` mengganti tombol aksi di bawah dengan SILANG MERAH di
 *  pojok kanan atas.
 *
 *  Untuk dialog yang isinya sendiri sudah berupa pilihan — menu aksi per akun
 *  adalah tiga tombol besar — tombol keempat bertuliskan "Tutup" berdiri
 *  sejajar ketiganya dan terbaca seperti pilihan keempat. Silang di pojok
 *  tidak pernah salah dibaca sebagai aksi. */
export function dialog({ judul, kartuHtml = "", medan = [], labelAksi = "Simpan",
                         bacaSaja = false, silangSaja = false, pasang = null }) {
  return new Promise(resolve => {
    const wadah = h(html`<div class="overlay" role="dialog" aria-modal="true"></div>`);
    document.body.appendChild(wadah);
    const el = document.body.lastElementChild;
    el.innerHTML = `
      <div class="dialog">
        <button class="dialog-silang" data-batal type="button"
          aria-label="Tutup">&times;</button>
        <h2 style="padding-right:2.2rem">${esc(judul)}</h2>
        ${kartuHtml}
        ${medan.map((m, i) => `
          <div class="field">
            <label for="dlg-${i}${m.tipe === "jam" ? "-hh" : ""}">${esc(m.label)}</label>
            ${m.tipe === "jam"
              ? kotakJamHtml(`dlg-${i}`, m.nilai ?? "")
              : `<input id="dlg-${i}" type="${m.tipe || "text"}"
                   inputmode="${m.tipe === "number" ? "numeric" : "text"}"
                   value="${esc(m.nilai ?? "")}" placeholder="${esc(m.contoh ?? "")}">`}
            ${m.bantuan ? `<div class="hint">${esc(m.bantuan)}</div>` : ""}
          </div>`).join("")}
        <div class="dialog-error error" hidden></div>
        ${silangSaja ? "" : `
        <div class="option-row">
          <button class="button button-primary" data-ok type="button">${esc(labelAksi)}</button>
        </div>`}
      </div>`;

    /* tipe "jam" memakai kotak HH:MM buatan sendiri, BUKAN <input type="time">.
       Pemilih bawaan browser mengikuti locale alatnya, jadi HP berbahasa
       Inggris menampilkan "07:00 AM" — dan panitia mencatat jam berangkat
       dalam format 24 jam di kertas. Dua format untuk satu angka adalah cara
       07:00 dan 19:00 tertukar. */
    const jamPasang = {};
    medan.forEach((m, i) => {
      if (m.tipe === "jam") jamPasang[i] = pasangKotakJam(`dlg-${i}`);
    });

    const tutup = hasil => { el.remove(); resolve(hasil); };
    if (pasang) pasang(el, tutup);
    el.querySelector("[data-batal]")?.addEventListener("click", () => tutup(null));
    el.addEventListener("click", e => { if (e.target === el) tutup(null); });
    // `?.` DAN BUKAN PEMANGGILAN LANGSUNG, sama seperti [data-batal] di atas:
    // `silangSaja` tidak menggambar .option-row, jadi [data-ok] TIDAK ADA. Tanpa
    // tanda tanya ini querySelector mengembalikan null, barisnya melempar, dan
    // lemparannya terjadi DI DALAM `new Promise` — jadi promise-nya DITOLAK.
    // Yang memanggil menunggunya di luar `try`, sehingga penolakan itu tidak
    // muncul di mana pun: dialognya tetap tergambar, tombol di dalamnya tetap
    // menutup lewat `pasang`, dan yang hilang cuma JAWABANNYA. Itulah yang
    // membuat ketiga tombol di menu akun — Reset Password, Ubah Nama Akun,
    // Aktifkan — diam tanpa satu pun pesan galat.
    el.querySelector("[data-ok]")?.addEventListener("click", () => {
      const nilai = medan.map((m, i) => m.tipe === "jam"
        ? (jamPasang[i]?.nilai() ?? "")
        : el.querySelector(`#dlg-${i}`).value.trim());

      // Jam yang TERISI TAPI TIDAK MASUK AKAL harus ditolak dengan kalimatnya
      // sendiri. Tanpa ini "99:99" jatuh ke cabang "wajib diisi" — nilai()
      // mengembalikan null untuk jam ngawur maupun kotak kosong, dan pesan
      // "wajib diisi" di atas kotak yang jelas-jelas terisi membingungkan.
      const jamNgawur = medan.findIndex((m, i) => m.tipe === "jam"
        && !nilai[i] && !jamPasang[i]?.kosong());
      if (jamNgawur >= 0) {
        const g = el.querySelector(".dialog-error");
        g.textContent = `${medan[jamNgawur].label} di luar 00:00–23:59.`;
        g.hidden = false;
        jamPasang[jamNgawur].fokus();
        return;
      }

      const kosong = medan.findIndex((m, i) => m.wajib !== false && !nilai[i]);
      if (kosong >= 0) {
        const g = el.querySelector(".dialog-error");
        g.textContent = `${medan[kosong].label} wajib diisi.`;
        g.hidden = false;
        if (medan[kosong].tipe === "jam") jamPasang[kosong].fokus();
        else el.querySelector(`#dlg-${kosong}`).focus();
        return;
      }
      tutup(nilai);
    });
    const p = el.querySelector("input");
    if (p) p.focus();
    el.addEventListener("keydown", e => {
      if (e.key === "Escape") tutup(null);
      // Sama sebabnya dengan di atas: pada dialog bersilang tidak ada [data-ok],
      // dan Enter yang tidak menemukannya akan melempar ke dalam handler.
      if (e.key === "Enter") el.querySelector("[data-ok]")?.click();
    });
  });
}

/** Kartu galat besar dengan tombol coba lagi — pengganti layar "Memuat…"
 *  yang menggantung selamanya (temuan review). */
export function kartuGagalMuat(pesan, saatCobaLagi) {
  const frag = h(html`
    <div class="card" style="border-color:var(--bahaya);background:var(--bahaya-muda)">
      <h2>Gagal memuat</h2>
      <p class="description">${pesan}</p>
      <button class="button button-primary" data-ulang type="button" style="margin-top:.8rem">
        Coba lagi
      </button>
    </div>`);
  frag.querySelector("[data-ulang]").addEventListener("click", saatCobaLagi);
  return frag;
}

/* ---------- gambar ----------

   Foto slip penilaian TIDAK PERNAH diunggah apa adanya. Satu acara berisi
   ~5.500 slip; kalau tiap foto 4 MB seperti keluaran kamera HP, seluruhnya
   22 GB — dua puluh dua kali kuota yang ada.

   Yang dibuang tidak membawa informasi apa pun:

     warna       slip adalah tinta hitam di kertas putih
     resolusi    12 MP untuk membaca angka setinggi satu sentimeter
     mutu JPEG   detail yang hilang di mutu 0,6 adalah tekstur kertas

   Sisanya ~50-90 KB per foto, dan angkanya tetap terbaca jelas: pada 1400 px
   melintang selembar A5 (210 mm), satu digit setinggi 10 mm masih 67 piksel.

   Kalau hasilnya masih di atas 150 KB — foto ruangan gelap penuh derau, yang
   tidak bisa dimampatkan JPEG — dicoba sekali lagi dengan mutu lebih rendah.
   Sekali, bukan sampai muat: gelung yang mengejar ukuran akan menurunkan mutu
   tanpa batas demi angka, dan foto yang tidak terbaca bukan backup.          */

const SISI_MAKS = 1400;
const MUTU_AWAL = 0.6;
const MUTU_ULANG = 0.45;
const TARGET_BYTES = 150 * 1024;

/** Kecilkan + abu-abukan satu foto jadi Blob JPEG siap unggah.
 *  Melempar Error kalau berkasnya bukan gambar yang bisa dibaca browser. */
export async function kecilkanFoto(file) {
  let gambar;
  try {
    gambar = await createImageBitmap(file);
  } catch {
    throw new Error("Berkas ini tidak bisa dibaca sebagai gambar. Coba foto ulang.");
  }

  const skala = Math.min(1, SISI_MAKS / Math.max(gambar.width, gambar.height));
  const lebar = Math.max(1, Math.round(gambar.width * skala));
  const tinggi = Math.max(1, Math.round(gambar.height * skala));

  const kanvas = document.createElement("canvas");
  kanvas.width = lebar;
  kanvas.height = tinggi;
  const ktx = kanvas.getContext("2d");
  // Latar putih lebih dulu: PNG/HEIC dengan alpha akan jadi hitam pekat di
  // JPEG kalau kanvasnya dibiarkan transparan, dan slip hitam total tidak
  // bisa dibaca siapa pun.
  ktx.fillStyle = "#fff";
  ktx.fillRect(0, 0, lebar, tinggi);
  ktx.filter = "grayscale(1)";
  ktx.drawImage(gambar, 0, 0, lebar, tinggi);
  if (gambar.close) gambar.close();

  const jadikan = (mutu) => new Promise((selesai, gagal) => {
    kanvas.toBlob(b => b ? selesai(b) : gagal(new Error("Gagal memproses gambar.")),
                  "image/jpeg", mutu);
  });

  let blob = await jadikan(MUTU_AWAL);
  if (blob.size > TARGET_BYTES) {
    const lagi = await jadikan(MUTU_ULANG);
    if (lagi.size < blob.size) blob = lagi;
  }
  return blob;
}

/** "83 KB", "1,4 MB" — dipakai layar foto supaya pemakaian kuota terbaca
 *  tanpa menghitung apa pun di kepala. */
export function ukuranRapi(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / 1048576).toFixed(1).replace(".", ",")} MB`;
}

/* ---------- ikon ----------

   Ikon garis dari Lucide (ISC), disalin ke sini sebagai jalur SVG — bukan
   emoji, dan bukan berkas yang diunduh terpisah.

   Emoji terlihat BERBEDA di tiap alat: satu panitia melihat printer abu-abu,
   yang lain melihat printer biru mengkilap, dan yang memakai HP lama melihat
   kotak kosong. Ikon yang digambar sendiri tampil sama di mana pun.

   Digambar dengan `currentColor` dan ukuran `em`, jadi ia mewarisi warna dan
   ukuran teks di sebelahnya tanpa satu pun aturan tambahan — termasuk saat
   ubinnya disorot atau saat panitia memperbesar huruf HP-nya.

   Ditempel di dalam berkas, bukan di-fetch: satu permintaan jaringan lagi di
   lapangan bersinyal buruk lebih mahal daripada beberapa kilobyte di sini,
   dan ikon yang gagal termuat meninggalkan tombol tanpa muka.            */

const IKON = {
  // Jarum di 10:10, bukan 12:00 — dua jarum yang bertindih terbaca
  // sebagai satu garis pada ukuran ikon.
  "clock":
    '<circle cx="12" cy="12" r="9" /> <path d="M12 7v5l3 2" />',
  "camera":
    '<path d="M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z" /> <circle cx="12" cy="13" r="3" />',
  // Pasangan "camera", dipakai di tombol Galeri. Dua tombol bersebelahan yang
  // ikonnya sama-sama kamera membuat pilihannya harus dibaca kata demi kata,
  // dan itu justru yang mau dihindari: petugas menuju yang bergambar kamera
  // untuk memotret sekarang, dan yang bergambar foto untuk mengambil yang
  // sudah ada.
  "image":
    '<rect width="18" height="18" x="3" y="3" rx="2" ry="2" /> <circle cx="9" cy="9" r="2" /> <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />',
  "lock":
    '<rect width="18" height="11" x="3" y="11" rx="2" ry="2" /> <path d="M7 11V7a5 5 0 0 1 10 0v4" />',
  "lock-open":
    '<rect width="18" height="11" x="3" y="11" rx="2" ry="2" /> <path d="M7 11V7a5 5 0 0 1 9.9-1" />',
  "printer":
    '<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /> <path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6" /> <rect x="6" y="14" width="12" height="8" rx="1" />',
  "circle-alert":
    '<circle cx="12" cy="12" r="10" /> <line x1="12" x2="12" y1="8" y2="12" /> <line x1="12" x2="12.01" y1="16" y2="16" />',
  "circle-check-big":
    '<path d="M21.801 10A10 10 0 1 1 17 3.335" /> <path d="m9 11 3 3L22 4" />',
  "x":
    '<path d="M18 6 6 18" /> <path d="m6 6 12 12" />',
  /* Stopwatch di layar Input Nilai Pos v2. Ketiganya lambang yang sudah
     dikenal dari alat perekam mana pun, jadi tombolnya tidak perlu dibaca —
     dan itu inti gunanya di pos, tempat mata petugas ada di lapangan dan
     bukan di layar.

     Play dan stop sengaja BERISI, berbeda dengan ikon lain di berkas ini yang
     semuanya bergaris. Segitiga bergaris pada ukuran tombol terbaca seperti
     panah "berikutnya", dan bujur sangkar bergaris seperti kotak centang
     kosong; keduanya lambang yang artinya justru ditentukan oleh isinya. */
  "play":
    '<path d="M7 4.2v15.6L19.4 12z" fill="currentColor" stroke-linejoin="round" />',
  "square":
    '<rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="currentColor" />',
  "rotate-ccw":
    '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /> <path d="M3 3v5h5" />',
  "chart-column":
    '<path d="M3 3v16a2 2 0 0 0 2 2h16" /> <path d="M18 17V9" /> <path d="M13 17V5" /> <path d="M8 17v-3" />',
  "circle-check":
    '<circle cx="12" cy="12" r="10" /> <path d="m9 12 2 2 4-4" />',
  "clipboard-list":
    '<rect width="8" height="4" x="8" y="2" rx="1" ry="1" /> <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /> <path d="M12 11h4" /> <path d="M12 16h4" /> <path d="M8 11h.01" /> <path d="M8 16h.01" />',
  // Kertas berlipat sudut, dipakai layar Pembayaran untuk membuka bukti
  // transfer. Dua ikon lain sudah dicoba dan dibuang: kamera terbaca "ambil
  // foto", dan struk bergerigi punya lengkung S di tengahnya yang pada ukuran
  // ikon terbaca sebagai LAMBANG DOLAR.
  "file-text":
    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /> <path d="M14 2v4a2 2 0 0 0 2 2h4" /> <path d="M16 13H8" /> <path d="M16 17H8" /> <path d="M10 9H8" />',
  "credit-card":
    '<rect width="20" height="14" x="2" y="5" rx="2" /> <line x1="2" x2="22" y1="10" y2="10" />',
  "flag":
    '<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528" />',
  "house":
    '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" /> <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />',
  "id-card":
    '<path d="M16 10h2" /> <path d="M16 14h2" /> <path d="M6.17 15a3 3 0 0 1 5.66 0" /> <circle cx="9" cy="11" r="2" /> <rect x="2" y="5" width="20" height="14" rx="2" />',
  "list-ordered":
    '<path d="M11 5h10" /> <path d="M11 12h10" /> <path d="M11 19h10" /> <path d="M4 4h1v5" /> <path d="M4 9h2" /> <path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02" />',
  "log-out":
    '<path d="m16 17 5-5-5-5" /> <path d="M21 12H9" /> <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />',
  "medal":
    '<path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15" /> <path d="M11 12 5.12 2.2" /> <path d="m13 12 5.88-9.8" /> <path d="M8 7h8" /> <circle cx="12" cy="17" r="5" /> <path d="M12 18v-2h-.5" />',
  "trophy":
    '<path d="M10 14.66v1.626a2 2 0 0 1-.976 1.696A5 5 0 0 0 7 21.978" /> <path d="M14 14.66v1.626a2 2 0 0 0 .976 1.696A5 5 0 0 1 17 21.978" /> <path d="M18 9h1.5a1 1 0 0 0 0-5H18" /> <path d="M4 22h16" /> <path d="M6 9a6 6 0 0 0 12 0V3a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1z" /> <path d="M6 9H4.5a1 1 0 0 1 0-5H6" />',
  "user-cog":
    '<path d="M10 15H6a4 4 0 0 0-4 4v2" /> <path d="m14.305 16.53.923-.382" /> <path d="m15.228 13.852-.923-.383" /> <path d="m16.852 12.228-.383-.923" /> <path d="m16.852 19.772-.383.924" /> <path d="m19.148 12.228.383-.923" /> <path d="m19.53 20.696-.382-.924" /> <path d="m20.772 13.852.924-.383" /> <path d="m20.772 18.148.924.383" /> <circle cx="18" cy="16" r="2" /> <circle cx="9" cy="7" r="4" />',
  "settings":
    '<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" /> <circle cx="12" cy="12" r="3" />',
  "square-pen":
    '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /> <path d="M18.375 2.625a1 1 0 0 1 3 3l-9.013 9.014a2 2 0 0 1-.853.505l-2.873.84a.5.5 0 0 1-.62-.62l.84-2.873a2 2 0 0 1 .506-.852z" />'
};

/** Satu ikon garis, siap ditempel ke template. Nama yang tidak dikenal
 *  menghasilkan string kosong — tombolnya tetap punya teks, jadi tidak ada
 *  yang rusak, hanya kehilangan mukanya. */
export function ikon(nama, kelas = "ikon") {
  const d = IKON[nama];
  if (!d) return "";
  return `<svg class="${kelas}" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round"
    stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`;
}

/** Ikon di dalam kotak bertint — satu warna per fungsi.
 *
 *  Ikon garis satu warna membuat papan menu jadi rata: sepuluh ubin yang
 *  bentuknya sama dan warnanya sama harus dibaca kata demi kata. Warna
 *  memberi tiap ubin penanda yang dikenali sebelum tulisannya sempat dibaca,
 *  dan sesudah beberapa kali pakai panitia menuju "yang jingga" tanpa
 *  mengeja "Keberangkatan".
 *
 *  Warna TIDAK PERNAH jadi satu-satunya pembeda — namanya selalu tertulis di
 *  sebelahnya. Sekitar satu dari dua belas laki-laki sulit membedakan merah
 *  dari hijau, dan bagi mereka papan ini harus tetap terbaca persis sama. */
export function ikonKotak(nama, warna) {
  return `<span class="ikon-kotak i-${warna}">${ikon(nama)}</span>`;
}

/** Nomor dada SELALU tiga digit di layar: 001, bukan 1.
 *
 *  Bukan kerapian. Nomor dada adalah kunci yang dibacakan lintas meja, ditulis
 *  di kain, dan disortir dalam tumpukan slip — "7" dan "007" terlihat seperti
 *  dua hal berbeda saat mata menyapu kolom angka, dan tumpukan yang disortir
 *  1, 10, 100, 2 adalah tumpukan yang tidak bisa dicari.
 *
 *  Nomor di luar 0-999 dibiarkan apa adanya: memotongnya jadi tiga digit akan
 *  MENGUBAH nomornya, dan angka salah lebih buruk daripada angka yang lebarnya
 *  tidak seragam. */
export function dada3(n) {
  if (n === null || n === undefined || n === "") return "";
  const a = Number(n);
  return Number.isInteger(a) && a >= 0 && a <= 999
    ? String(a).padStart(3, "0") : String(n);
}

/** KONTRAK WAKTU sebagai kata yang diucapkan panitia: "4 jam", "3,5 jam".
 *
 *  Yang tersimpan menit — 180, 210, 240 — dan menit adalah satuan yang tidak
 *  pernah disebut siapa pun di lapangan. "Kontrak 210" menuntut pembagian di
 *  kepala sebelum ia berarti apa-apa, dan yang membacanya di papan Live Score
 *  adalah peserta dan pembina, bukan orang yang menyusun konfigurasinya.
 *
 *  KOMA, bukan titik: setengah jam ditulis "3,5 jam" karena begitulah angka
 *  pecahan ditulis dalam bahasa Indonesia (aturan yang sama dengan ukuranRapi
 *  di atas).
 *
 *  Menit yang bukan kelipatan 30 ditulis apa adanya di belakang koma —
 *  "4,15 jam" jelek, tapi ia jujur, dan ia hanya muncul kalau ada yang
 *  memasukkan kontrak ganjil ke kontrak_opsi. Membulatkannya diam-diam akan
 *  menyembunyikan konfigurasi yang keliru justru dari orang yang bisa
 *  membetulkannya.
 *
 *  Kosong jadi "—", bukan "0 jam": regu yang belum berkontrak belum memilih,
 *  dan "0 jam" terbaca sebagai pilihan yang sudah dibuat. */
export function kontrakTeks(menit) {
  const n = Number(menit);
  if (!menit || !Number.isFinite(n) || n <= 0) return "—";
  const jam = Math.floor(n / 60);
  const sisa = n % 60;
  if (!sisa) return `${jam} jam`;
  return `${jam},${sisa === 30 ? "5" : String(sisa).padStart(2, "0")} jam`;
}

/* ==========================================================================
   CARA MENULIS SATU KOMPONEN PENILAIAN — SATU SUMBER UNTUK SEMUA LAYAR

   Nama dan rentang sebuah lomba tinggal di baris `wahana`, dan itu sudah
   benar: mengganti "Semaphore 0 – 5" jadi "Bendera 0 – 10" cukup satu UPDATE.
   Yang TIDAK ikut satu tempat adalah ATURAN MENULISKANNYA — keterangan apa
   yang muncul di kepala kolom, dan bagaimana angkanya dieja. Aturan itu
   pernah ditulis dua kali: sekali di layar panitia, sekali disalin tangan ke
   halaman peserta. Salinannya menyimpang, dan yang menyimpang tidak
   menggagalkan apa pun — ia cuma membuat dua papan saling membantah di depan
   pembina yang sedang membandingkan keduanya.

   Berkas ini disalin byte-identik ke `live/js/util.js` dan ditegakkan
   `shared-files.yml`, jadi aturan yang tinggal DI SINI tidak bisa menyimpang
   antar aplikasi tanpa CI menolak.

   Yang boleh masuk ke sini cuma aturan MURNI: hanya bergantung pada baris
   `wahana` dan angkanya, tidak menyentuh DOM. Markup-nya tetap urusan
   masing-masing layar — kepala tabel panitia dan kepala tabel peserta memang
   berbeda bentuk, dan menyatukannya akan memaksa dua layar berbeda kebutuhan
   memakai satu HTML.
   ========================================================================== */

/** Angka dari database datang sebagai teks ("6.00"). Yang muncul di layar
 *  harus persis seperti yang diketik petugas: 6, bukan 6.00. */
export const angkaRapi = (v) =>
  v === null || v === undefined || v === "" ? "" : String(Number(v));

/** NILAI MENTAH -> TEKS SEPERTI YANG TERTULIS DI KOTAK ISIANNYA.
 *
 *  Satu tempat untuk seluruh layar: kotak isian, penyegaran 20 detik, dan
 *  dialog Riwayat Nilai. Aturannya sendiri sederhana — yang tidak sederhana
 *  adalah menjaganya tetap sama di tiga tempat. Riwayat sempat memakai
 *  angkaRapi langsung, jadi ia berbunyi "855" untuk Menaksir yang kotaknya
 *  menuliskan "8.55", dan "47" untuk waktu yang kotaknya menuliskan "00:47".
 *  Petugas yang membuka riwayat justru sedang membandingkan dengan kotaknya,
 *  dan dua bentuk untuk satu angka membuat perbandingan itu harus
 *  diterjemahkan dulu di kepala.
 *
 *  `k` adalah baris `wahana`-nya. Boleh kosong — komponen yang sudah dihapus
 *  admin masih punya riwayat, dan angka polos lebih baik daripada baris yang
 *  hilang.
 *
 *  Kotak centang tidak punya teks di layar, tapi riwayatnya punya: "ya" dan
 *  "tidak" dibaca lebih cepat daripada 1 dan 0, yang di kolom berisi angka
 *  terbaca seperti nilai. */
export function nilaiTeks(k, n) {
  if (n === null || n === undefined || n === "") return "";
  if (k && k.form === "biner")  return Number(n) > 0 ? "ya" : "tidak";
  if (k && k.satuan === "detik") return detikTeks(n);
  if (k && k.satuan === "meter") return meterTeks(n);
  return angkaRapi(n);
}

/** Keterangan kecil di bawah nama kolom: rentang yang boleh ditulis, atau
 *  bentuk isiannya kalau rentang saja menyesatkan. */
export function petunjukKolom(k) {
  // Keterangan dari konfigurasi selalu menang. Untuk sebagian besar komponen
  // rentangnya sudah menjelaskan segalanya — "0 – 5 kata benar" tidak butuh
  // kalimat. Tapi Menaksir menulis SELISIH, bukan nilai, dan rentangnya justru
  // menyesatkan; kolom `petunjuk` (0037) ada untuk kasus seperti itu.
  if (k.petunjuk) return k.petunjuk;
  if (k.form === "biner") return "centang bila benar";
  // SATU bentuk, dan bentuk itu "menit:detik". Keterangan ini pernah berbunyi
  // "detik, atau m:dd", lalu dipersempit — bukan karena m:dd buruk, melainkan
  // karena MENAWARKAN DUA bentuk untuk satu angka pada kertas yang diisi
  // tergesa di pos adalah cara sebagian petugas menulis 1:45 dan sebagian
  // menulis 105 untuk waktu yang sama. Keberatan itu tetap dihormati: yang
  // disebut tetap satu bentuk. detikSah() masih menerima detik polos, jadi
  // yang mengetik 74 tidak kehilangan apa pun — ia terbaca kembali 01:14.
  if (k.satuan === "detik") return "menit:detik";
  // Rentangnya TIDAK disebut untuk meter. Ia disimpan dalam sentimeter, jadi
  // "0 – 10000" di kepala kolom adalah angka yang tidak pernah diketik
  // siapa pun — satuannya sendiri yang jadi keterangan.
  if (k.satuan === "meter") return "meter";
  if (k.form === "benar_kurang_salah") return "benar / salah";
  if (k.form === "benar_per_total") return `0 – ${angkaRapi(k.total_soal)}`;
  return `${angkaRapi(k.rentang_mentah_min)} – ${angkaRapi(k.rentang_mentah_maks)}`;
}

/** Gabungkan varian `wahana` menjadi satu kolom penilaian di layar.
 *
 * Kalau minimal satu baris bernama sama dibatasi golongan, SEMUA baris dengan
 * nama itu adalah varian satu kolom — termasuk baris asal yang golongannya
 * null. Ini menyatukan pasangan umum + Intern tanpa menurunkan hubungan dari
 * akhiran `kode`, yang hanya kebiasaan penamaan dan bukan kontrak data. */
export function kolomPos(komponen) {
  const namaBervarian = new Set(
    komponen.filter(k => k.golongan).map(k => k.name),
  );
  const urut = [], peta = new Map();
  for (const k of komponen) {
    const kunci = namaBervarian.has(k.name) ? `nama:${k.name}` : `kode:${k.kode}`;
    if (!peta.has(kunci)) {
      peta.set(kunci, { nama: k.name, varian: [] });
      urut.push(peta.get(kunci));
    }
    peta.get(kunci).varian.push(k);
  }
  for (const kol of urut) {
    kol.petunjuk = [...new Set(kol.varian.map(petunjukKolom))].join(" / ");
  }
  return urut;
}

/** Varian mana dari satu kolom yang berlaku untuk satu regu — atau null.
 *
 *  Pasangan sisi layar dari `komponen_berlaku()` di database (migrasi 0091),
 *  dan seperti fungsi itu ia TIDAK simetris: regu Intern hanya menerima
 *  komponen bertanda `intern` atau golongannya sendiri, sedangkan golongan
 *  Eksternal menerima baris umum (`golongan` null) maupun baris golongannya.
 *  Komponen umum tidak otomatis berlaku untuk Intern — kalau iya, seluruh
 *  lomba lapangan ikut tergambar untuk regu yang tidak mengikutinya.
 *
 *  Tempatnya di util.js bersama kolomPos(), bukan di app.js, karena papan
 *  panitia dan papan peserta HARUS memilih varian yang sama. Aturan ini
 *  pernah ditulis dua kali dan salinan yang di halaman peserta menyimpang;
 *  yang menyimpang tidak menggagalkan apa pun, ia cuma membuat dua papan
 *  saling membantah di depan pembina yang sedang membandingkan keduanya. */
export const varianUntuk = (kol, golongan) => {
  if (golongan === "intern_pa" || golongan === "intern_pi")
    return kol.varian.find(k => k.golongan === golongan || k.golongan === "intern") || null;
  return kol.varian.find(k => !k.golongan || k.golongan === golongan) || null;
};

const slugLomba = (nama) => String(nama).toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "lomba";

/** Kolom layar dikelompokkan jadi LOMBA — tingkat ketiga yang tidak dimiliki
 *  `wahana` sampai migrasi 0054 (CLAUDE.md bagian 11).
 *
 *  `lomba` kosong berarti komponen itu lomba tersendiri, keadaan yang benar
 *  untuk sebagian besar baris — Semaphore, Menaksir, Bakiak. Yang berkelompok
 *  cuma Pembidaian (lima kriteria), PBB (empat), dan Yel-Yel (empat).
 *
 *  Tempatnya di util.js, bukan di app.js: papan panitia dan papan peserta
 *  sama-sama menyusun kolomnya dari sini. Dua papan yang mengelompokkan
 *  dengan aturan berbeda adalah bentuk kegagalan yang sudah pernah terjadi
 *  dan tidak menggagalkan apa pun — ia cuma membuat keduanya saling membantah
 *  di depan pembina yang sedang membandingkan. */
export function kelompokLomba(kolom) {
  const urut = [], peta = new Map();
  for (const kol of kolom) {
    const k = kol.varian[0];
    const nama = k.lomba || kol.nama;
    if (!peta.has(nama)) {
      // `kode` adalah kunci TETAP lomba ini (0079), dan ia dibaca dari
      // database — bukan diturunkan dari namanya. Foto slip disimpan dengan
      // kunci itu, jadi menurunkannya dari nama berarti mengganti nama lomba
      // menghilangkan seluruh fotonya tanpa satu pun galat. Cadangan slug
      // dipakai hanya untuk baris yang kolomnya belum terisi.
      peta.set(nama, { nama, kode: k.kode_lomba || slugLomba(nama), kolom: [] });
      urut.push(peta.get(nama));
    }
    peta.get(nama).kolom.push(kol);
  }
  return urut;
}

/** BENTUK PENGISIAN satu lomba — inilah yang menentukan layar mana yang
 *  digambar Input Nilai Pos v2 untuk lomba itu.
 *
 *  Tiga bentuk, dan ketiganya dikenali dari KONFIGURASI, bukan dari nama:
 *
 *    "waktu"  seluruh komponennya bersatuan detik. Bakiak, Lari Balok,
 *             Balap Karung — satu regu berjalan, satu angka dicatat, dan
 *             angka itu datang dari stopwatch yang dipegang petugas.
 *    "soal"   seluruh komponennya `type = 'soal'`. Peserta menjawab di lembar
 *             soalnya sendiri (CLAUDE.md 11.3), jadi yang ada di tangan
 *             petugas adalah setumpuk kertas — difoto borongan lebih dulu,
 *             nomor dada dan angkanya ditulis belakangan.
 *    "nilai"  sisanya. Juri menilai regu yang ada di depannya dan menulis
 *             tiap kriteria di satu blangko: Semaphore, Pembidaian, PBB,
 *             Yel-Yel, KIM, Menaksir, Tebak Simpul.
 *
 *  Dikenali dari `satuan` dan `type` — kolom database yang diisi panitia —
 *  dan BUKAN dari daftar nama lomba di sini. Daftar nama berarti lomba baru
 *  tahun depan jatuh ke bentuk yang salah tanpa satu pun galat, dan yang
 *  menemukannya petugas yang sudah berdiri di posnya.
 *
 *  `every` atas larik kosong bernilai true, jadi jumlah kolomnya diperiksa
 *  lebih dulu: lomba tanpa komponen bukan lomba waktu.
 */
export function jenisLomba(lomba) {
  const w = (lomba.kolom || []).map(kol => kol.varian[0]).filter(Boolean);
  if (!w.length) return "nilai";
  if (w.every(k => k.satuan === "detik")) return "waktu";
  if (w.every(k => k.type === "soal")) return "soal";
  return "nilai";
}

/** SELURUH lomba SELURUH pos sebagai satu daftar datar — "Pos 1 — Semaphore",
 *  "Pos 2 — Bakiak", dan seterusnya.
 *
 *  Input Nilai Pos v2 memulai dari pertanyaan yang berbeda dengan layar lama.
 *  Yang lama bertanya "kamu di pos mana?" lalu menggambar seluruh lomba pos
 *  itu sebagai kolom; yang baru bertanya "kamu sedang menilai lomba apa?",
 *  karena satu petugas di lapangan memegang SATU lomba pada satu waktu, bukan
 *  satu pos. Jadi pos dan lomba diratakan jadi satu daftar pilihan.
 *
 *  `kunci` menggabungkan pos dan kode lomba. Kode lomba sendiri TIDAK cukup
 *  jadi kunci: ia datang dari komponen pertama lomba itu (lihat
 *  kelompokLomba), dan tidak ada apa pun yang menjamin dua pos tidak memakai
 *  kode yang sama — "kekompakan" sudah dipakai PBB di Pos 4 dan Yel-Yel di
 *  Pos 5 hari ini juga.
 *
 *  Pos tanpa komponen dilewati. Pos 0 Keberangkatan dan Pos 6 Kedatangan
 *  adalah garis start dan garis finish; yang dicatat di sana waktu, lewat
 *  layarnya sendiri.
 */
export function katalogLomba(daftarPos, komponen) {
  const hasil = [];
  for (const p of daftarPos || []) {
    const milik = (komponen || []).filter(k => Number(k.pos) === Number(p.nomor));
    if (!milik.length) continue;
    for (const l of kelompokLomba(kolomPos(milik))) {
      hasil.push({
        pos: Number(p.nomor),
        namaPos: p.name,
        bayangan: !!p.bayangan,
        kode: l.kode,
        nama: l.nama,
        kolom: l.kolom,
        jenis: jenisLomba(l),
        kunci: `${Number(p.nomor)}:${l.kode}`,
      });
    }
  }
  return hasil;
}

/** Bacaan stopwatch: "00:12.4".
 *
 *  Persepuluh detik ikut ditampilkan SELAGI BERJALAN, walaupun yang tersimpan
 *  selalu detik bulat (migrasi 0059). Bukan hiasan: angka yang bergerak
 *  adalah satu-satunya tanda bahwa stopwatch-nya memang jalan, dan pada layar
 *  yang cuma berubah sekali sedetik petugas menekan Mulai dua kali.
 *
 *  Bentuk menitnya sama dengan kotak isian waktu di seluruh sistem —
 *  detikTeks() yang menuliskannya — supaya angka di stopwatch dan angka di
 *  kotak di bawahnya tidak perlu diterjemahkan di kepala. */
export function stopwatchTeks(ms) {
  const aman = Math.max(0, Number(ms) || 0);
  return `${detikTeks(Math.floor(aman / 1000))}.${Math.floor(aman / 100) % 10}`;
}

/** Detik BULAT yang akan disimpan dari sebuah bacaan stopwatch.
 *
 *  DIBULATKAN, bukan dipotong. Tangga poin Pos 2 berbunyi "sampai 30 detik
 *  100 poin", dan regu yang menyentuh garis pada 30,6 detik memang lebih
 *  lambat dari 30 detik — memotongnya jadi 30 memberi poin penuh untuk waktu
 *  yang tidak dicapai. Selisihnya cuma muncul pada regu yang persis di batas,
 *  dan justru regu itulah yang paling mungkin protes.
 *
 *  Layar tetap menuliskan bacaan mentahnya di sebelah angka yang akan
 *  disimpan, jadi pembulatan ini terlihat sebelum tombol ditekan — bukan
 *  ditemukan belakangan waktu angkanya sudah masuk. */
export const detikDariMs = (ms) => Math.round(Math.max(0, Number(ms) || 0) / 1000);

/** Angka terbanyak yang masih pantas digambar sebagai deretan tombol.
 *
 *  Empat puluh satu tombol (0-40) muat dalam enam baris di layar HP, dan
 *  seluruh lomba edisi ini berada di bawahnya — yang terlebar Kreativitas
 *  Yel-Yel, 0-35. Yang di atasnya cuma Menaksir, yang rentangnya 0-99999999
 *  karena ia menulis SELISIH dalam sentimeter; menggambarnya sebagai tombol
 *  bukan pilihan yang lebih buruk, melainkan pilihan yang mustahil.
 *
 *  Angkanya dipatok di sini, bukan diturunkan dari daftar lomba: tahun depan
 *  panitia mengubah rentangnya lewat layar Akun, dan aturan yang menyebut nama
 *  lomba akan menggambar dinding tombol untuk lomba yang tidak disangka. */
export const MAKS_TOMBOL_ANGKA = 41;

/** Bisakah komponen ini digambar sebagai deretan tombol angka?
 *
 *  Bentuk lain sudah punya cara pengisian yang tidak menuntut mengetik atau
 *  tidak bisa diganti: centang sudah satu ketukan, waktu diisi stopwatch,
 *  meter dan benar/salah punya bentuknya sendiri. Yang tersisa — dan yang
 *  benar-benar diketik angka demi angka di lapangan — adalah kotak angka
 *  polos milik hampir semua kriteria juri dan seluruh lomba soal. */
export function bisaTombolAngka(k) {
  if (k.form === "biner" || k.form === "benar_kurang_salah") return false;
  if (k.satuan === "detik" || k.satuan === "meter") return false;

  /* KOSONG DIPERIKSA SEBELUM Number(), dan itu bukan kerapian.
     `Number(null)` dan `Number("")` sama-sama 0 — bilangan bulat yang sah —
     jadi komponen yang batas atasnya belum diisi akan lolos sebagai rentang
     0 sampai 0 dan digambar sebagai SATU tombol berbunyi "0". Petugas lalu
     menekannya, karena itu satu-satunya yang ada, dan yang tersimpan nol
     untuk kriteria yang sebenarnya bernilai sampai 30. Tidak ada galat di
     mana pun: nol adalah nilai yang sah. */
  const bulat = (v) =>
    v !== null && v !== undefined && v !== "" && Number.isInteger(Number(v));
  if (!bulat(k.rentang_mentah_min) || !bulat(k.rentang_mentah_maks)) return false;

  const min = Number(k.rentang_mentah_min), maks = Number(k.rentang_mentah_maks);
  return maks >= min && maks - min + 1 <= MAKS_TOMBOL_ANGKA;
}


/** Ringkas satu LOMBA untuk satu regu: berapa komponennya yang berlaku,
 *  berapa yang sudah ada isinya, dan jumlah nilainya.
 *
 *  Dipakai kedua papan Live Score, dan sengaja hanya satu fungsi walau
 *  keduanya menampilkan hal berbeda — panitia menggambar `jumlah`, peserta
 *  menggambar centang dari `terisi` lawan `berlaku`. Yang harus sama persis
 *  adalah CARA MEMBACANYA; kalau tidak, satu papan bisa menyebut Pembidaian
 *  lengkap sementara papan sebelahnya menyebutnya baru sebagian.
 *
 *  `peta` berkunci `"<pos>.<kode wahana>"` — bentuk yang sama dipakai
 *  `poin` maupun `komponen_terisi` di rekap.json (migrasi 0107 dan 0072).
 *
 *  `berlaku === 0` berarti lomba ini memang bukan untuk golongan regu itu.
 *  Itu keadaan sah, bukan konfigurasi rusak: Tebak Simpul Penegak tidak ada
 *  urusannya dengan regu Penggalang, dan seluruh lomba lapangan tidak ada
 *  urusannya dengan regu Intern (migrasi 0091). */
export function ringkasLomba(lomba, golongan, pos, peta) {
  let berlaku = 0, terisi = 0, jumlah = 0;
  for (const kol of lomba.kolom) {
    const w = varianUntuk(kol, golongan);
    if (!w) continue;
    berlaku++;
    const v = (peta || {})[`${pos}.${w.kode}`];
    /* `komponen_terisi` membawa semua kunci sebagai boolean. `false` berarti
       nilainya BELUM masuk, bukan nilai sah yang kebetulan falsy. Peta poin
       memakai angka, jadi 0 tetap harus dihitung sebagai sudah terisi. */
    if (v === null || v === undefined || v === false) continue;
    terisi++;
    jumlah += Number(v) || 0;
  }
  return { berlaku, terisi, jumlah };
}

/** Angka nilai sebagai TEKS, satu bagian atau dua.
 *
 *  Mengembalikan bagian-bagiannya, bukan HTML jadi, dan itu yang membuatnya
 *  bisa dipakai dua aplikasi: layar panitia menyisipkan pemisah "/" berkelas
 *  sendiri di antara dua bagian, halaman peserta cukup merangkainya. Yang
 *  dibagi cuma CARA MENULIS angkanya — 74 detik dieja "01:14" di mana pun.
 *
 *  Larik kosong berarti belum dinilai. Bentuk `biner` sengaja TIDAK diurus di
 *  sini: yang tergambar untuknya centang atau strip, sebuah lambang, bukan
 *  angka — dan lambang itu beserta label pembaca layarnya milik layar. */
export function nilaiBagian(w, a, b) {
  if (a === null || a === undefined) return [];
  if (w.form === "benar_kurang_salah") {
    return b === null || b === undefined
      ? [angkaRapi(a)] : [angkaRapi(a), angkaRapi(b)];
  }
  if (w.satuan === "detik") return [detikTeks(a)];
  if (w.satuan === "meter") return [meterTeks(a)];
  return [angkaRapi(a)];
}

/** Label keempat golongan, dan URUTAN BAKU saat keempatnya dijejer.
 *
 *  Penegak lebih dulu, lalu Penggalang; PA sebelum PI. Ini urutan yang dipakai
 *  panitia saat mengumumkan juara, dan layar yang berbeda urutan dari corong
 *  memaksa pembaca acara mencocokkan sendiri di depan lapangan.
 *
 *  Urutannya ditulis eksplisit, bukan disandarkan pada urutan kunci LABEL:
 *  urutan kunci objek memang terjaga di JavaScript, tapi ia tidak terlihat
 *  sebagai keputusan — orang berikutnya yang merapikan daftar label itu secara
 *  alfabetis akan mengubah urutan tampil tanpa pernah tahu ia melakukannya.
 *
 *  DULU DITULIS TIGA KALI: dua kali di app.js (GOLONGAN_LABEL/URUT_GOLONGAN
 *  dan NAMA_GOLONGAN/URUTAN_GOLONGAN) dan sekali di live.js. Penjaganya,
 *  tools/periksa_urutan_golongan.py, mencari pola `const URUT_GOLONGAN` — jadi
 *  salinan KETIGA yang bernama URUTAN_GOLONGAN tidak pernah ia lihat, dan
 *  salinan itulah yang dipakai layar Live Score. Sekarang satu tempat, dan
 *  shared-files.yml yang menjaganya. */
export const GOLONGAN_LABEL = {
  penegak_pa: "Penegak PA", penegak_pi: "Penegak PI",
  penggalang_pa: "Penggalang PA", penggalang_pi: "Penggalang PI",
  intern_pa: "Intern PA", intern_pi: "Intern PI",
};
export const URUT_GOLONGAN =
  ["penegak_pa", "penegak_pi", "penggalang_pa", "penggalang_pi",
   "intern_pa", "intern_pi"];

/** Biaya pendaftaran SATU regu, menurut golongannya (migrasi 0110).
 *
 *  Pasangan sisi layar dari `biaya_regu()` di database, dan seperti fungsi itu
 *  ia satu-satunya tempat di kedua situs yang tahu golongan mana yang berharga
 *  intern. Tempatnya di util.js — berkas yang disalin utuh ke live/ dan dijaga
 *  shared-files.yml — karena Meja Pembayaran dan form pendaftaran HARUS
 *  menghitung angka yang sama: kalau keduanya berbeda satu rupiah,
 *  `verifikasi_pembayaran` menolak pembayaran sekolah itu dan tidak ada tombol
 *  di layar mana pun yang bisa memperbaikinya.
 *
 *  Tagihan satu batch adalah PENJUMLAHAN nilai ini per regu, bukan perkalian:
 *  satu pendaftaran boleh memuat regu Eksternal dan Intern sekaligus.
 *
 *  HARGA INTERN YANG TIDAK ADA JATUH KE HARGA BIASA, dan itu yang membuat
 *  urutan rilis tidak penting. Situs terbit tiap kali PR di-merge sedangkan
 *  migrasi dijalankan terpisah sesudahnya (CLAUDE.md 7.6), jadi ada jeda
 *  ketika layar baru ini membaca `v_edisi_publik` yang belum punya kolomnya.
 *  Dengan jatuh ke `biaya_per_regu` layar menghitung persis seperti server
 *  yang belum dimigrasi — angkanya cocok, pembayaran jalan. Kalau ia jatuh ke
 *  nol, regu Intern akan tampil Rp 0 di Meja Pembayaran dan setiap
 *  pembayarannya ditolak, tanpa satu pun galat yang menyebut sebabnya. */
export const biayaRegu = (edisi, golongan) =>
  golongan === "intern_pa" || golongan === "intern_pi"
    ? Number(edisi?.biaya_per_regu_intern ?? edisi?.biaya_per_regu ?? 0)
    : Number(edisi?.biaya_per_regu ?? 0);

/** Tagihan satu daftar regu. Terima apa saja yang punya `golongan`. */
export const totalBiaya = (edisi, daftarRegu) =>
  (daftarRegu || []).reduce((n, r) => n + biayaRegu(edisi, r.golongan), 0);
