/* ============================================================================
   hrcd-rekap : buku-sakti.mjs — isi Buku Sakti.

   Buku pegangan yang diserahkan dari kepanitiaan satu ke kepanitiaan
   berikutnya: cara menjalankan HRCD, tugas pokok tiap seksi, alasan sistem
   ini berbentuk seperti sekarang, dan timeline satu edisi penuh dari Serah
   Terima Jabatan sampai hari pelaksanaan.

   KENAPA ISINYA DI SINI DAN BUKAN DI DATABASE

   Buku ini ditulis ulang sekali setahun oleh panitia yang mau turun, bukan
   diketik di lapangan. Menaruhnya di database berarti satu tabel, satu set
   policy RLS, satu layar penyunting, dan satu backup lagi yang harus diingat
   orang — empat konsep baru untuk teks yang berubah dua belas kali lebih
   jarang daripada tabel mana pun di sistem ini (CLAUDE.md bagian 6.4).

   Di sini ia ikut git: siapa mengubah apa dan kapan sudah tercatat sendiri,
   dan bukunya tetap terbaca walau Supabase sedang tidak bisa dihubungi —
   keadaan yang justru paling mungkin bikin orang membuka buku panduan.

   KENAPA ISINYA DATA, BUKAN HTML

   Yang menyunting buku ini panitia SMA, bukan programmer. Daftar blok
   berjenis bisa disunting tanpa tahu satu tag pun, tidak bisa merusak tata
   letak layar, dan tidak bisa menyelundupkan markup — layar yang
   menggambarnya meng-escape semuanya. Itu juga yang membuat isinya bisa
   diuji di Node tanpa membuka browser.

   TUJUH JENIS BLOK, DAN TIDAK ADA YANG KEDELAPAN

     { jenis: "p",       teks: "satu paragraf" }
     { jenis: "poin",    butir: ["...", "..."] }          daftar bertitik
     { jenis: "langkah", butir: ["...", "..."] }          daftar bernomor
     { jenis: "tabel",   kepala: ["A", "B"],
                         baris: [["a1", "b1"]] }          panjang baris = kepala
     { jenis: "kenapa",  teks: "..." }                    kotak beraksen
     { jenis: "foto",    berkas: "kain-intern.jpg",       objek di bucket buku
                         teks: "Contoh: ..." }            keterangan WAJIB
     { jenis: "layar",   nama: "Meja Pembayaran",
                         hash: "#/pembayaran",
                         fitur: "pembayaran",             null = terbuka untuk
                         teks: "..." }                    semua panitia

   Menambah jenis kedelapan menuntut tiga tempat berubah sekaligus: perakit di
   app.js, perakit cetaknya, dan tes bentuk di tests/buku_sakti.test.mjs.
   Sebelum menambahnya, periksa dulu apakah salah satu dari tujuh yang ada
   sudah cukup — hampir selalu cukup.

   BLOK FOTO: KETERANGANNYA YANG UTAMA, GAMBARNYA PELENGKAP.

   Gambarnya duduk di bucket Supabase `buku` yang publik, dibuat sekali lewat
   dashboard. Ia TIDAK ikut tercetak — buku ini digandakan di mesin fotokopi
   seperti blangko, dan raster abu-abu keluar kotor atau hilang di salinan
   kedua (bagian 8). Di layar pun gambarnya dibuang sendiri kalau gagal
   dimuat, karena buku panduan paling dibutuhkan saat ada yang rusak.

   Akibatnya satu: tulis keterangannya supaya utuh dibaca TANPA gambarnya.
   "Contoh: kain Internal bertulis 1001, angka 1 di depan ikut disablon" bekerja
   di dua keadaan; "Contoh: seperti di gambar" tidak bekerja di satu pun.

   SATU BAB PUNYA DUA NAMA, dan keduanya wajib.

     judul  "Kenapa Sistemnya Begini"   dipakai di kepala bab dan di kertas
     tab    "Kenapa"                    dipakai di pil tab

   Bukan kerapian: empat judul penuh berjejer sepanjang 844px di kolom
   selebar 734px, jadi tab keempat terpotong dan muncul penggulir mendatar di
   layar selebar apa pun. Terukur di browser, bukan dikira-kira. Label pendek
   memilih kata yang paling membedakan babnya — di bawah judul lengkap yang
   tergambar sebaris di bawahnya, satu kata sudah cukup.

   TEKSNYA STRING BIASA. Tidak ada HTML, tidak ada Markdown, tidak ada
   backtick. Layar yang menata; penulis yang bercerita.
   ========================================================================== */

/** Nama centang seperti tertulis di layar Akun.
 *
 *  Blok "layar" menyebut fitur yang dibutuhkan, dan layar Buku Sakti memakai
 *  itu untuk dua hal: menyembunyikan tautan yang akan berujung pada kartu
 *  "tidak berhak", dan menyebutkan centang mana yang harus diminta ke admin.
 *  Yang kedua itu yang menuntut namanya, bukan cuma kodenya — "butuh centang
 *  daftar_ulang" menyuruh orang mencari kotak yang tidak pernah tertulis
 *  begitu di layar mana pun.
 *
 *  INI SALINAN, dan salinannya disengaja BERISIK. Yang memutuskan hak tetap
 *  `boleh()` di database (CLAUDE.md 13.1); daftar ini tidak memutuskan apa
 *  pun, ia cuma memberi nama. Supaya ia tidak diam-diam basi,
 *  tests/buku_sakti.test.mjs membandingkannya baris demi baris dengan
 *  `insert into fitur` di migrasi 0057 — kalau edisi berikutnya menambah
 *  fitur ke-dua belas, tesnya yang memberi tahu, bukan panitia yang membaca
 *  nama kode mentah di tengah buku. */
export const FITUR_NAMA = {
  pendaftaran:   "Pendaftaran",
  pembayaran:    "Pembayaran",
  daftar_ulang:  "Daftar Ulang",
  cetak_kloter:  "Daftar Kloter",
  keberangkatan: "Keberangkatan",
  kedatangan:    "Kedatangan",
  pos:           "Input Nilai Pos",
  live_score:    "Live Score",
  rekap:         "Rekapitulasi",
  akun:          "Akun",
  pengaturan:    "Pengaturan",
};

/** Kode fitur yang boleh disebut blok "layar". */
export const FITUR_SAH = Object.keys(FITUR_NAMA);

/** Centang yang membuat sebuah layar TERJANGKAU dari papan Home.
 *
 *  Ini pertanyaan yang BERBEDA dari `fitur` di blok "layar", dan keduanya
 *  memang boleh berbeda untuk rute yang sama. Blok layar menjawab "apa yang
 *  dibutuhkan untuk MELAKUKAN hal yang sedang dijelaskan paragraf ini" —
 *  karena itu satu blok tentang saklar fase menyebut `pengaturan` sementara
 *  blok lain tentang papan klasemen di layar yang sama menyebut `live_score`,
 *  dan keduanya benar. Peta ini menjawab yang lebih kasar: centang mana yang
 *  memunculkan ubinnya di Home sama sekali.
 *
 *  Dipakai tautan kecil di tiap tugas papan sprint, yang tidak punya ruang
 *  untuk membedakan sehalus itu.
 *
 *  SALINAN YANG BERISIK, sama seperti FITUR_NAMA: tes membandingkannya
 *  dengan syarat ubin di layarHome(). Kalau suatu edisi memindahkan sebuah
 *  layar ke centang lain, tesnya yang memberi tahu.
 *
 *  `null` berarti terbuka untuk setiap panitia. */
export const FITUR_LAYAR = {
  "#/home":              null,
  "#/ganti-password":    null,
  "#/buku-sakti":        null,
  "#/data-peserta":      "pendaftaran",
  "#/pembayaran":        "pembayaran",
  "#/daftar-ulang":      "daftar_ulang",
  "#/cetak-kloter":      "cetak_kloter",
  "#/keberangkatan":     "keberangkatan",
  "#/finish":            "kedatangan",
  "#/pos":               "pos",
  "#/pos2":              "pos",
  "#/foto":              "pos",
  "#/cek-nilai":         "pengaturan",
  "#/pengaturan-kloter": "pengaturan",
  "#/live-score":        "live_score",
  "#/kejuaraan":         "live_score",
  "#/account":           "akun",
};

/** Nama layar seperti tertulis di kepala halamannya.
 *
 *  Tautan kecil di tiap tugas papan sprint memakai ini, bukan alamatnya
 *  sendiri: "#/cetak-kloter" adalah alamat, dan yang dicari panitia yang
 *  membaca papan adalah NAMA layar yang harus dibuka. Alamat cuma berarti
 *  bagi yang sudah tahu isinya.
 *
 *  SALINAN YANG BERISIK, seperti FITUR_NAMA dan FITUR_LAYAR: tes
 *  membandingkannya dengan pasangKepala() di app.js, jadi layar yang berganti
 *  nama membuat tesnya gagal, bukan membuat papan sprint memanggil nama yang
 *  sudah tidak dipakai siapa pun. */
export const NAMA_LAYAR = {
  "#/home":              "Home",
  "#/ganti-password":    "Ganti Password",
  "#/buku-sakti":        "Buku Sakti",
  "#/data-peserta":      "Data Peserta",
  "#/pembayaran":        "Meja Pembayaran",
  "#/daftar-ulang":      "Meja Daftar Ulang",
  "#/cetak-kloter":      "Daftar Kloter",
  "#/keberangkatan":     "Keberangkatan",
  "#/finish":            "Kedatangan",
  "#/pos":               "Input Nilai Tabel",
  "#/pos2":              "Input Nilai Per Lomba",
  "#/foto":              "Foto Jawaban Sekaligus",
  "#/cek-nilai":         "Cek Nilai",
  "#/pengaturan-kloter": "Kalkulator Keberangkatan",
  "#/live-score":        "Live Score",
  "#/kejuaraan":         "Kejuaraan",
  "#/account":           "Akun",
};

/** Rute yang boleh disebut blok "layar". Sama alasannya dengan FITUR_SAH:
 *  tautan yang salah ketik di dalam buku jatuh ke Home tanpa satu pun galat,
 *  dan yang membacanya menyimpulkan bukunya yang bohong. */
export const RUTE_SAH = [
  "#/home", "#/foto", "#/data-peserta", "#/pembayaran", "#/daftar-ulang",
  "#/cetak-kloter", "#/keberangkatan", "#/finish", "#/pos", "#/pos2",
  "#/cek-nilai", "#/live-score", "#/kejuaraan", "#/pengaturan-kloter",
  "#/ganti-password", "#/account", "#/buku-sakti",
];

const BAB_TUTORIAL = {
  kode: "tutorial",
  judul: "Menjalankan HRCD",
  tab: "Menjalankan",
  ikon: "list-ordered",
  warna: "biru",
  ringkas: "Hal penting yang wajib diketahui semua panitia, lalu urutan kerja satu edisi HRCD dari menyiapkan edisi baru sampai papan juara dan pembersihan sesudah acara.",
  bagian: [
    {
      kode: "tutorial-hal-penting",
      judul: "Hal penting yang wajib disampaikan ke semua panitia",
      isi: [
        {
          jenis: "p",
          teks: "Beberapa hal di sistem ini benar hanya kalau semua orang tahu. Bukan cuma pemegang akun: juri pos, petugas finish, pencatat, dan koordinator lapangan. Sampaikan seluruh isi bagian ini di gladi kotor, bukan pagi hari-H, karena semuanya berujung pada nilai yang jatuh ke regu yang salah.",
        },
        {
          jenis: "p",
          teks: "Yang pertama dan paling sering keliru: nomor dada punya DUA deret, dan keduanya dipakai berdampingan di lomba yang sama. Regu Eksternal dan regu Internal dinilai di pos yang sama, oleh juri yang sama, di blangko yang sama.",
        },
        {
          jenis: "tabel",
          kepala: ["Deret", "Angka di sistem", "Yang harus tertulis di kain"],
          baris: [
            ["Eksternal", "1 sampai 500", "sama persis dengan angka di sistem"],
            ["Internal", "1001 sampai 1250", "1001, bukan 001; angka 1 di depan ikut disablon"],
          ],
        },
        {
          jenis: "p",
          teks: "Contoh: kain bertulis 1001 diketik 1001, dan yang tampil di seluruh layar, kertas, dan papan peserta juga 1001. Tidak ada penerjemahan di kepala siapa pun. Kain Eksternal bertulis 7 diketik 7.",
        },
        {
          jenis: "foto",
          berkas: "kain-nomor-dada-dua-deret.jpg",
          teks: "Contoh: dua kain berdampingan. Yang kiri Eksternal, angkanya polos. Yang kanan Internal, angka 1 di depan ikut disablon jadi 1001 — bukan 001.",
        },
        {
          jenis: "poin",
          butir: [
            "Kain Internal yang polos bertulis 001 melahirkan blangko yang ambigu: juri menyalin apa yang dilihatnya di dada regu, dan 001 bisa dibaca sebagai Eksternal 1. Tidak ada satu baris SQL pun yang bisa memulihkan blangko seperti itu, karena kertasnya tidak menyimpan nama regu.",
            "Blangko penilaian memang HANYA memuat nomor dada, tanpa nama regu. Satu angka yang salah memindahkan seluruh nilai satu regu ke regu lain, dan tidak ada apa pun di kertas yang memperlihatkannya.",
            "Nomor yang ditukar karena kainnya rusak DIPENSIUNKAN permanen. Kalau petugas pos melihat nomor yang sudah pensiun di lapangan, itu dilaporkan ke Sekretariat, bukan dinilai diam-diam.",
            "Penalti pos terlewat dan penalti anggota TIDAK berlaku bagi regu Internal. Umumkan ini sebelum papan dibaca, kalau tidak ada yang menyimpulkan sistemnya salah hitung.",
            "Samakan jam tangan seluruh panitia ke satu jam acuan pada apel pagi. Jam berangkat dan jam datang diketik dari jam sungguhan, dan penaltinya satu poin per menit ke dua arah. Dua jam tangan yang selisih tiga menit berarti tiga poin bagi regu yang tidak salah apa-apa.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Semua ini murah selama masih di atas kertas dan mahal begitu masuk sistem. Nomor dada yang salah ketahuan di meja daftar ulang cuma satu ketukan. Yang ketahuan saat klasemen dibacakan tidak bisa ditarik lagi dari ingatan orang yang telanjur bertepuk tangan.",
        },
      ],
    },
    {
      kode: "tutorial-edisi-baru",
      judul: "Menyiapkan edisi baru",
      isi: [
        {
          jenis: "p",
          teks: "Sebelum satu pun pendaftar masuk, angka-angka edisi harus sudah benar: tanggal lomba, jendela keberangkatan, jarak antar kloter, daftar pos dan lomba, bobot tiap lomba, pilihan kontrak waktu, dan stok nomor dada. Semuanya adalah baris di database, bukan angka yang ditulis di dalam kode.",
        },
        {
          jenis: "p",
          teks: "Karena itu tidak ada layar untuk mengubahnya. Perubahan ditulis sebagai migration, di-merge, lalu dijalankan satu berkas per satu berkas lewat workflow Apply migration di GitHub Actions.",
        },
        {
          jenis: "layar",
          nama: "Kalkulator Keberangkatan",
          hash: "#/pengaturan-kloter",
          fitur: "pengaturan",
          teks: "Isi Waktu Berangkat Pertama, Waktu Berangkat Terakhir, jumlah regu Eksternal dan Internal; layar ini menghitung rekomendasi berapa kloter yang terbentuk beserta jam berangkat tiap kloter. Dipakai untuk memastikan seluruh kloter masih masuk jendela sebelum angkanya dikunci.",
        },
        {
          jenis: "langkah",
          butir: [
            "Tetapkan tanggal lomba di baris edisi. Seluruh perkiraan jam berangkat dihitung dari tanggal ini, jadi jangan pernah menulis tanggal di dalam kode atau di skrip apa pun.",
            "Tetapkan jendela keberangkatan 07:00 sampai 10:00 dan jeda MAKSIMAL antar keberangkatan 5 menit sebagai konfigurasi edisi, bukan sebagai angka tetap. Jeda itu batas atas: kalau kloternya sedikit, yang terakhir berangkat jauh sebelum ujung jendela.",
            "Isi daftar pos, lomba, dan penilaian beserta poin maksimalnya. Bobot sebuah pos tidak pernah ditulis di mana pun: ia adalah jumlah poin maksimal seluruh wahana di pos itu.",
            "Isi pilihan kontrak waktu (3 jam, 3,5 jam, 4 jam) dan konfigurasi penalti.",
            "Isi stok nomor dada dua deret: Eksternal 1 sampai 500, Internal 1001 sampai 1250.",
            "Buka Kalkulator Keberangkatan dan pastikan kloter terakhir masih berangkat sebelum 10:00.",
            "Sesudah PR mendarat, jalankan workflow Apply migration to Supabase untuk tiap berkas migration, satu per satu, lalu baca notice yang keluar.",
            "Jalankan supabase/checks/status_migrasi.sql lewat workflow yang sama untuk membuktikan migration-nya benar-benar hidup di database.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Migration tidak pernah ikut merge. Berkas yang di-merge tapi tidak pernah dijalankan tidak menimbulkan satu galat pun: CI tetap hijau dan layar tetap menyala. Sepuluh migration pernah menganggur enam hari seperti itu, dan yang menemukannya adalah seorang pembina yang ditolak saat mendaftarkan regu Internal.",
        },
        {
          jenis: "poin",
          butir: [
            "Aturan penilaian adalah data, bukan kode. Tiap tahun angkanya berubah tanpa satu baris kode disentuh.",
            "Memindahkan satu lomba dari satu pos ke pos lain mengubah bobot KEDUA pos itu tanpa satu angka pun diedit.",
            "Status migrasi memeriksa SELURUH migrasi yang ada: 116 punya sidik jari yang dicari di database, 53 sisanya tidak punya karena migrasi yang lebih muda sudah menimpa objeknya. Jumlah keduanya harus selalu sama dengan jumlah berkas migrasi — begitu ada berkas baru, angka itu yang harus ikut naik.",
          ],
        },
      ],
    },
    {
      kode: "tutorial-akun",
      judul: "Akun panitia dan hak akses",
      isi: [
        {
          jenis: "p",
          teks: "Yang menentukan sebuah layar terbuka atau tidak adalah matriks centang di layar Akun, bukan nama peran. Peran hanya preset yang mengisi centang awal. Kalau seorang panitia butuh satu layar tambahan di luar paketnya, centang tambahan itulah jalannya.",
        },
        {
          jenis: "layar",
          nama: "Akun",
          hash: "#/account",
          fitur: "akun",
          teks: "Membuat akun panitia, memilih peran, dan mencentang fitur per akun. Hanya pemegang fitur akun yang melihat tombolnya di header.",
        },
        {
          jenis: "layar",
          nama: "Ganti Password",
          hash: "#/ganti-password",
          fitur: null,
          teks: "Terbuka untuk semua akun, tanpa centang apa pun. Selain password baru, layar ini meminta Kode Konfirmasi — tanyakan ke koordinator kalau lupa.",
        },
        {
          jenis: "tabel",
          kepala: ["Peran", "Kolom pos", "Centang bawaan"],
          baris: [
            ["admin", "kosong", "sebelas fitur, termasuk akun dan pengaturan"],
            ["registrasi", "kosong", "pendaftaran, pembayaran, daftar_ulang, cetak_kloter, live_score"],
            ["gerbang", "kosong", "keberangkatan, kedatangan, live_score"],
            ["juri_pos", "wajib diisi nomor posnya", "pos, live_score — terkunci ke posnya sendiri"],
            ["koordinator_pos", "wajib kosong", "pos, live_score — terbuka untuk kelima pos"],
          ],
        },
        {
          jenis: "langkah",
          butir: [
            "Buka layar Akun, buat akun, dan pilih perannya LEBIH DULU.",
            "Baru sesudah peran tersimpan, tambahkan atau kurangi centang fiturnya.",
            "Untuk juri_pos, isi kolom pos dengan nomor pos yang dipegangnya.",
            "Untuk koordinator_pos, biarkan kolom pos kosong. Kekosongan itulah yang membuka kelima pos.",
            "Bagikan password awal, lalu minta tiap orang menggantinya sendiri di Ganti Password sebelum hari-H.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Mengganti peran akan MENGHAPUS seluruh centang tangan lalu mengisinya ulang dari paket peran. Jadi urutannya wajib peran dulu, centang sesudahnya. Kalau dibalik, centang tambahan yang sudah susah payah dipasang lenyap tanpa peringatan.",
        },
        {
          jenis: "poin",
          butir: [
            "Fitur rekap hanya ada di paket admin. Siapa pun di luar admin yang perlu membacanya harus dicentang manual.",
            "Akun yang dinonaktifkan kehilangan seluruh haknya seketika, apa pun isi centangnya, tanpa menunggu dia logout.",
            "Isolasi pos berlaku saat MENULIS nilai, tidak saat membaca. Juri Pos 3 memang bisa melihat angka Pos 1 sebelum diumumkan, dan itu keputusan pemilik acara.",
          ],
        },
      ],
    },
    {
      kode: "tutorial-pendaftaran",
      judul: "Pendaftaran dibuka",
      isi: [
        {
          jenis: "p",
          teks: "Pendaftaran diisi sendiri oleh pembina lewat form di situs peserta, satu form per sekolah untuk beberapa regu sekaligus. Panitia TIDAK punya layar entri pendaftaran. Meja offline memakai link yang sama persis, cuma menyediakan HP atau laptop untuk pembina yang datang langsung.",
        },
        {
          jenis: "layar",
          nama: "Pendaftaran",
          hash: "#/home",
          fitur: "pendaftaran",
          teks: "Ubin Pendaftaran di Home bukan form, melainkan link keluar ke halaman daftar di situs peserta. Buka lewat ubin ini supaya alamat yang dipakai panitia sama dengan yang dibagikan ke pembina.",
        },
        {
          jenis: "langkah",
          butir: [
            "Pastikan fase live masih pra. Di fase itu halaman peserta hanya menampilkan jumlah pendaftar dan jalan menuju formulir.",
            "Sebarkan link form pendaftaran ke pembina.",
            "Di meja offline, dampingi pembina mengisi form yang sama: jenis peserta, sekolah, konfirmasi alamat, kebutuhan barak, jumlah regu per golongan, lalu nama regu dan anggota tiap regu.",
            "Satu batch pendaftaran menghasilkan satu kode pembayaran. Tuliskan kode itu untuk pembina dan tekankan bahwa kode itu yang dibawa saat daftar ulang.",
            "Untuk metode transfer, pembina wajib upload bukti di form. Buktinya masuk ke penyimpanan privat, bukan ke folder umum.",
          ],
        },
        {
          jenis: "poin",
          butir: [
            "Kunci sekolah adalah NAMANYA. Alamat yang diketik pembina tidak melahirkan baris sekolah baru dan tidak menimpa alamat yang sudah dikurasi panitia.",
            "Dua sekolah senama dibedakan DI DALAM namanya: MAN 3 Ciamis dan MAN 3 Tasikmalaya. Kalau tidak ada tabrakan, jangan tambahkan ekor apa pun.",
            "Nama regu unik untuk seluruh acara. Dua regu dari satu sekolah dipisah dengan angka di belakang namanya.",
            "Pertanyaan barak tidak muncul untuk peserta Internal.",
            "Pembayaran sebagian tidak dilayani. Satu batch dibayar semuanya atau tidak sama sekali, dan tidak ada refund.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Kunci sekolah pernah berupa pasangan nama dan alamat. Beda satu koma antara Jl. dan Jln. sudah cukup melahirkan sekolah baru: SMPN 1 Ciamis pernah muncul tiga kali di kotak pilihan, SMPN 2 Cipaku empat kali. Baris kembar memecah pencarian, rekap, dan identitas pendaftaran.",
        },
      ],
    },
    {
      kode: "tutorial-data-peserta",
      judul: "Memeriksa dan membetulkan data peserta",
      isi: [
        {
          jenis: "p",
          teks: "Yang mengetik data peserta adalah pembina, bukan panitia, dan sebagian mengetiknya dari HP sambil berdiri. Jadi selalu ada nomor kontak yang kurang satu angka, nama ketua yang disingkat, atau nama regu yang salah huruf. Membetulkannya adalah pekerjaan meja yang sama dengan menerima pendaftaran, cuma terpisah waktu.",
        },
        {
          jenis: "layar",
          nama: "Data Peserta",
          hash: "#/data-peserta",
          fitur: "pendaftaran",
          teks: "Membetulkan kontak, nama regu, ketua, anggota, kelas, dan organisasi. Semua perubahan tercatat di riwayat pendaftaran.",
        },
        {
          jenis: "langkah",
          butir: [
            "Sapu daftar pendaftar per sekolah, bukan per regu. Kesalahan ketik biasanya mengelompok di satu batch karena satu orang yang mengisinya.",
            "Betulkan nomor kontak lebih dulu. Itu satu-satunya jalan menghubungi pembina kalau bukti transfernya bermasalah.",
            "Periksa nama regu terhadap aturan unik: dua regu satu sekolah dengan nama yang sama dipisah dengan angka.",
            "Pastikan ketua terisi. Empat anggota lain boleh kosong di form, tapi kelengkapan lima orang tetap diperiksa fisik di garis finish.",
            "Selesaikan pembetulan SEBELUM regunya menerima nomor dada.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Sesudah nomor dada diberikan, identitas lapangan regu itu beku. Nama regu yang sudah bernomor dada tidak diganti lagi, sekalipun konvensi penamaan berubah kemudian, karena kertas dan papan sudah menyebut nama itu.",
        },
        {
          jenis: "poin",
          butir: [
            "Membetulkan data peserta TIDAK BOLEH mengubah status pembayaran, nomor dada, kloter, atau apa pun hasil daftar ulang. Regu yang sudah lunas tetap lunas.",
            "Daftar anggota di form bukan pengganti pemeriksaan fisik di finish, dan tidak dipakai menghitung penalti anggota.",
          ],
        },
      ],
    },
    {
      kode: "tutorial-pembayaran",
      judul: "Verifikasi pembayaran",
      isi: [
        {
          jenis: "p",
          teks: "Satu kode pembayaran mencakup seluruh regu dalam satu batch. Menandai lunas membuat seluruh batch itu valid bersama-sama, lalu kwitansinya bisa dicetak.",
        },
        {
          jenis: "layar",
          nama: "Meja Pembayaran",
          hash: "#/pembayaran",
          fitur: "pembayaran",
          teks: "Daftar seluruh batch pendaftaran, tombol Tandai Lunas, dan tombol Cetak Kwitansi yang muncul sesudahnya. Home membawa lencana jumlah batch yang masih menunggu pembayaran.",
        },
        {
          jenis: "langkah",
          butir: [
            "Buka lencana menunggu pembayaran di Home untuk melihat antreannya.",
            "Untuk transfer: buka bukti yang di-upload pembina, cocokkan nominal dan nama pengirim dengan mutasi rekening.",
            "Untuk tunai: hitung uangnya di meja, cocokkan dengan nominal batch.",
            "Tandai lunas. Seluruh regu dalam batch itu berubah status bersamaan.",
            "Cetak kwitansi dan serahkan ke pembina.",
            "Kalau nominalnya kurang, JANGAN tandai lunas sebagian. Hubungi pembina lewat kontak di Data Peserta.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Regu yang belum lunas tidak bisa daftar ulang dan tidak masuk penyebut kelengkapan pos. Antrean yang tertahan di sini muncul lagi di meja daftar ulang pada H-1, saat tidak ada lagi waktu mengurusnya.",
        },
      ],
    },
    {
      kode: "tutorial-daftar-ulang",
      judul: "Daftar ulang dan nomor dada",
      isi: [
        {
          jenis: "p",
          teks: "Dua hal ini beda dan sering tertukar. PENDAFTARAN itu registrasi dan membayar, berbulan-bulan sebelumnya. DAFTAR ULANG itu hadir di tempat mengambil nomor dada, dan jendelanya H-1 pagi sampai hari-H pukul 10:00 — tidak pernah lebih awal.",
        },
        {
          jenis: "p",
          teks: "Mejanya tutup pukul 10:00 karena saat itulah kloter terakhir berangkat dan lomba dimulai. Di dalam jendela itu ada dua jalur, dan keduanya sama sahnya: H-1 untuk yang bisa datang sejak awal, hari-H untuk yang baru sempat. Yang datang H-1 tidur di barak malam itu.",
        },
        {
          jenis: "p",
          teks: "Di meja inilah regu masuk ke kloter keberangkatan, jadi di sini pula seluruh perlengkapannya diserahkan: kain nomor dada dan tiska. Biasanya dua atau tiga meja paralel. Regu menyebut kode pembayaran, panitia mengonfirmasi nama regu dan sekolahnya, lalu MENGETIK nomor dada dari kain fisik yang sudah ada di tangan.",
        },
        {
          jenis: "layar",
          nama: "Meja Daftar Ulang",
          hash: "#/daftar-ulang",
          fitur: "daftar_ulang",
          teks: "Cari batch dengan kode pembayaran, isi nomor dada untuk seluruh regu sekolah itu sekaligus lewat satu tombol Simpan, dan tukar nomor yang kainnya rusak.",
        },
        {
          jenis: "foto",
          berkas: "meja-daftar-ulang.jpg",
          teks: "Contoh: satu meja daftar ulang. Kotak kain nomor dada dan tiska di sebelah petugas, layar menghadap petugas, dan antrean satu sekolah dilayani sekali jalan.",
        },
        {
          jenis: "langkah",
          butir: [
            "Minta kode pembayaran, ketik di kotak cari.",
            "Bacakan nama regu, asal sekolah, dan golongannya. Peserta mengonfirmasi datanya sendiri secara lisan.",
            "Ambil kain nomor dada dari kotak, ketik angkanya persis seperti yang tertulis di kain.",
            "Bacakan lagi nomor dada tiap regu sebelum menekan Simpan. Itu pintu terakhir yang masih murah.",
            "Isi seluruh regu sekolah itu dalam satu kali simpan. Sepuluh regu berarti sepuluh nomor dada dalam satu transaksi.",
            "Serahkan kain nomor dadanya.",
            "Kalau kainnya rusak, pakai tombol Tukar nomor rusak. Nomor lama dipensiunkan permanen.",
          ],
        },
        {
          jenis: "poin",
          butir: [
            "Nomor dada DIKETIK petugas, tidak diterbitkan sistem. Sistem hanya memeriksa: ada di stok, belum dipensiunkan, belum dipakai, dan berada di deret yang benar.",
            "Ada DUA deret. Eksternal 1 sampai 500. Internal 1001 sampai 1250.",
            "Kain Internal bertulis 001 diketik 1001, dan angka 1001 itulah yang tampil di seluruh layar, kertas, dan papan peserta. Kain barunya diberi angka 1 di depan supaya tidak ada terjemahan di kepala siapa pun.",
            "Kloter ditentukan SISTEM saat nomor dada tersimpan. Petugas tidak memilih kloter di layar ini.",
            "Tidak ada tanda tangan dan tidak ada centang konfirmasi di sistem. Konsekuensinya tidak ada catatan siapa mengonfirmasi apa dan kapan, jadi konfirmasi lisannya harus benar-benar dilakukan.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Blangko penilaian per lomba hanya memuat NOMOR DADA tanpa nama regu. Nomor dada yang salah setelah lomba dimulai bukan sekadar salah tulis. Ia memindahkan seluruh nilai satu regu ke regu lain, dan tidak ada apa pun di kertas yang memperlihatkannya. Sebelum kertasnya dicetak, pembetulan cuma satu ketukan.",
        },
      ],
    },
    {
      kode: "tutorial-kloter",
      judul: "Kloter dan daftar kloter",
      isi: [
        {
          jenis: "p",
          teks: "Pembagian kloter bukan pekerjaan terpisah. Ia jatuh sendiri saat nomor dada tersimpan di meja daftar ulang. Yang perlu dikerjakan panitia hanyalah mencetak daftarnya, dan mencetaknya dalam dua bentuk berbeda untuk dua pembaca berbeda.",
        },
        {
          jenis: "layar",
          nama: "Daftar Kloter",
          hash: "#/cetak-kloter",
          fitur: "cetak_kloter",
          teks: "Mencetak daftar isi tiap kloter, satu kloter per halaman, dan mengatur jendela Planning Keberangkatan yang jamnya ikut tercetak. Dua tombol cetak: Cetak Kloter untuk Petugas dan Cetak Kloter untuk Peserta.",
        },
        {
          jenis: "poin",
          butir: [
            "Kuota otomatis per kloter: 5 Eksternal dan 3 Internal, dihitung TERPISAH.",
            "Urutannya FIFO murni. Yang lebih dahulu menyelesaikan daftar ulang mendapat kloter lebih awal.",
            "Sekolah tidak memengaruhi apa pun. Tidak ada pengacakan dan tidak ada lompatan kloter. Dua regu satu sekolah boleh sekloter kalau memang FIFO menempatkan mereka di sana.",
            "Pengacakan otomatis MELEWATI kloter yang sudah berangkat. Tanda cetak tidak menutup kloter untuk penambahan regu.",
            "Jangan pernah menomori kloter sendiri. Kalau perlu disusun ulang, bersihkan datanya lalu jalankan ulang alurnya.",
          ],
        },
        {
          jenis: "p",
          teks: "Contoh: sekolah A selesai daftar ulang jam 08:10 dan regunya masuk kloter 3. Sekolah B selesai jam 08:25 dan masuk kloter 4 — walaupun nomor dadanya kebetulan lebih kecil. Yang menentukan jam selesainya, bukan angkanya.",
        },
        {
          jenis: "foto",
          berkas: "daftar-kloter-tertempel.jpg",
          teks: "Contoh: lembar Daftar Kloter untuk Peserta yang tertempel di barak. Isinya perkiraan jam berangkat saja, tanpa kolom centang dan tanpa kotak jam.",
        },
        {
          jenis: "langkah",
          butir: [
            "Tekan Cetak Kloter untuk Petugas: lembarnya memuat kolom Kontrak Waktu dan Hadir yang ditulisi berdampingan, plus tempat menulis tangan jam berangkat sebenarnya.",
            "Tekan Cetak Kloter untuk Peserta untuk papan pengumuman dan barak: hanya perkiraan jam berangkat, tanpa kolom centang dan tanpa kotak jam, karena yang membacanya peserta.",
            "Tempel lembar papan di barak dan di titik kumpul semalam sebelum hari-H.",
            "Serahkan lembar staging ke petugas Pemberangkatan, Staging 1, dan Staging 2.",
            "Cetak ulang tanpa ragu kalau ada regu masuk belakangan. Mencetak ulang selembar daftar itu murah.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Mencetak ulang selembar daftar itu murah; memberangkatkan kloter dengan empat tempat kosong tidak bisa diulang. Itu sebabnya tanda cetak sengaja TIDAK mengunci kloter.",
        },
        {
          jenis: "p",
          teks: "Bersihkan data harus mengembalikan penomoran kloter ke 1. Produksi pernah memulai pembagian dari kloter 17, karena 24 kloter pertama masih menyandang tanda cetak dari percobaan sebelumnya. Panitia menghabiskan pagi mencari enam belas kloter yang tidak pernah ada.",
        },
      ],
    },
    {
      kode: "tutorial-pagi-hari-h",
      judul: "Pagi hari-H: upacara dan antrean start",
      isi: [
        {
          jenis: "p",
          teks: "Jendela keberangkatan adalah 07:00 sampai 10:00. Tidak ada kloter yang berangkat sebelum jam tujuh dan yang terakhir sudah jalan sebelum jam sepuluh. Seluruh pagi disusun dari kenyataan bahwa itu tiga jam untuk berapa pun jumlah kloter tahun ini.",
        },
        {
          jenis: "p",
          teks: "Pagi dibuka dengan upacara, dan seorang pejabat memberangkatkan kloter pertama untuk difoto. Itu bukan penundaan yang harus dihilangkan; itu alasan acara ini punya garis start yang layak difoto. Susun jadwalnya mengelilingi upacara, bukan melawannya.",
        },
        {
          jenis: "layar",
          nama: "Daftar Kloter",
          hash: "#/cetak-kloter",
          fitur: "cetak_kloter",
          teks: "Kartu tiap kloter membawa jam Rencana dan, sesudah kloter itu jalan, jam Real. Ini yang dibuka untuk menjawab pertanyaan pembina: kloter 9 kira-kira jam berapa.",
        },
        {
          jenis: "langkah",
          butir: [
            "Tempatkan TIGA kloter siap sejak sebelum upacara: kloter 1 di Pemberangkatan, kloter 2 di Staging 1, kloter 3 di Staging 2.",
            "Sisanya tetap di formasi upacara.",
            "Susun formasi upacara TERBALIK: kloter terakhir di depan, kloter 4, 5, dan 6 di belakang.",
            "Verifikasi kehadiran regu DI TITIK TUNGGUNYA, bukan saat sudah sampai di garis start.",
            "Konfirmasi kontrak waktu tiap regu TIGA kloter sebelum ia berangkat. Pilihannya 3 jam, 3,5 jam, atau 4 jam, dan ditentukan per REGU.",
            "Selesaikan semua urusan administrasi regu pada momen konfirmasi itu juga.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Kloter 4, 5, dan 6 berdiri di BELAKANG karena merekalah yang berikutnya dipanggil, dan barisan belakang adalah yang paling dekat jalan keluar. Formasi dengan kloter 4, 5, 6 di depan terlihat lebih rapi dan memakan beberapa menit tambahan per kloter sepanjang pagi.",
        },
        {
          jenis: "poin",
          butir: [
            "Satu kloter boleh berisi regu dengan kontrak waktu berbeda-beda. Kontrak itu milik regu, bukan milik kloter.",
            "Urusan administrasi yang tidak selesai tiga kloter di muka akan menahan garis start, dan seluruh sisa pagi bergeser.",
          ],
        },
      ],
    },
    {
      kode: "tutorial-keberangkatan",
      judul: "Keberangkatan",
      isi: [
        {
          jenis: "p",
          teks: "Di garis start, KERTAS adalah pencatat utamanya dan laptop yang memverifikasi. Panitia kertas mencentang tiap regu yang berangkat, menulis tangan regu yang tidak sesuai kloter awalnya, dan mencatat jam berangkat tiap kloter. Kertas itu lalu diserahkan ke panitia laptop untuk dimasukkan.",
        },
        {
          jenis: "layar",
          nama: "Keberangkatan",
          hash: "#/keberangkatan",
          fitur: "keberangkatan",
          teks: "Centang hadir per nomor dada, atur kontrak waktu, pindahkan regu antar kloter, dan ketik jam berangkat kloter. Home membawa lencana kemajuan berangkat dibanding siap.",
        },
        {
          jenis: "langkah",
          butir: [
            "Terima lembar staging dari petugas kertas sesudah kloternya jalan.",
            "Centang tiap nomor dada yang hadir sesuai kertas.",
            "Masukkan regu yang ditulis tangan sebagai sisipan ke kloter yang benar.",
            "KETIK jam berangkat kloter dari angka yang tertulis di kertas, bukan dari jam saat kamu mengetik.",
            "Berangkatkan kloter itu di sistem, lalu ambil lembar kloter berikutnya.",
          ],
        },
        {
          jenis: "poin",
          butir: [
            "Kotak jam menerima 745, 0745, 7:45, dan 7.45. Angka di luar rentang DITOLAK dengan pesan, tidak ditebak.",
            "Kotak jam sengaja bukan pemilih waktu bawaan browser: laptop berbahasa Inggris menampilkan 07:15 AM, dan itu cara yang sangat murah untuk mencatat 07:15 sebagai 19:15.",
            "Jam berangkat yang tercatat adalah dasar seluruh penalti waktu. Perkiraan jam berangkat hanya untuk merencanakan pagi, dan keduanya tidak pernah disimpan di kolom yang sama.",
            "Jarak antar keberangkatan paling banyak 5 menit.",
          ],
        },
        {
          jenis: "p",
          teks: "Regu yang terlambat masuk kloter terakhir. Tapi menyisipkan regu ke kloter yang SUDAH berangkat tetap boleh dan tidak dibatasi kuota, karena itu keputusan petugas yang melihat lapangan. Regu yang disisipkan sesudah kertas dicetak wajib ditandai, sebab nomornya tidak ada di lembar petugas staging.",
        },
        {
          jenis: "kenapa",
          teks: "Regu yang disisipkan ke kloter yang sudah berangkat dihitung berangkat pada JAM KLOTER ITU, bukan jam ia benar-benar jalan, karena penalti dihitung dari jam berangkat kloter. Kalau maksudnya regu itu berangkat sekarang, tempatnya di kloter yang belum jalan.",
        },
        {
          jenis: "poin",
          butir: [
            "Salah satu menit di jam berangkat menggeser penalti SELURUH regu di kloter itu sekaligus.",
            "Kloter yang tidak pernah dicatat berangkat membuat regunya tidak masuk klasemen resmi.",
          ],
        },
      ],
    },
    {
      kode: "tutorial-di-pos",
      judul: "Di pos: blangko, input nilai, foto jawaban",
      isi: [
        {
          jenis: "p",
          teks: "Tiga level, bukan dua: satu pos memuat beberapa lomba, dan satu lomba memuat satu atau lebih penilaian. Pos 3 punya empat lomba, bukan tujuh: Pembidaian, Kim Lihat, Kim Cium, dan Logika. Kim Lihat dan Kim Cium adalah DUA lomba, bukan dua kriteria satu lomba, karena masing-masing punya lembar jawaban dan kolom fotonya sendiri.",
        },
        {
          jenis: "layar",
          nama: "Input Nilai Tabel",
          hash: "#/pos",
          fitur: "pos",
          teks: "Satu tabel selebar pos, satu regu satu baris, meniru lembar yang biasa dipakai. Dipakai meja IT yang memasukkan tumpukan kertas berurutan. Ini SATU-SATUNYA tempat blangko bisa dicetak.",
        },
        {
          jenis: "layar",
          nama: "Input Nilai Per Lomba",
          hash: "#/pos2",
          fitur: "pos",
          teks: "Pilih satu lomba, lalu satu regu satu layar dengan tombol simpan. Dipakai juri yang memegang satu lomba sepagian dari HP.",
        },
        {
          jenis: "layar",
          nama: "Foto Jawaban Sekaligus",
          hash: "#/foto",
          fitur: "pos",
          teks: "Memotret setumpuk lembar jawaban di pos, per lomba, nomor dadanya ditautkan belakangan. Jumlah foto yang belum tertaut tampil sebagai angka di layar.",
        },
        {
          jenis: "langkah",
          butir: [
            "Sebelum hari-H, buka Input Nilai Tabel di tiap pos dan cetak SATU master blangko per lomba.",
            "Bawa master itu ke tukang fotokopi. Pos dengan tiga lomba dan 500 regu berarti 1.500 lembar hasil fotokopi, bukan 1.500 halaman dari printer.",
            "Di lapangan, juri menulis nilai mentah di blangko lomba yang dipegangnya, satu lembar per regu.",
            "Masukkan lembar yang sudah terisi ke KOTAK PENILAIAN pos itu.",
            "Jalur foto utamanya tombol kamera di meja IT: difoto saat nomor dadanya baru diketik, jadi gambarnya tertaut sendiri ke regu dan lomba yang tepat.",
            "Foto Jawaban Sekaligus dipakai untuk yang tidak bisa dilakukan tombol itu: memotret setumpuk kertas DI POS sebelum ia berangkat ke meja IT. Nomor dadanya menganggur di antrean sampai ada yang menautkannya, jadi jangan biarkan antreannya menumpuk.",
            "Urutkan kertasnya menurut nomor dada sebelum diinput, lalu masukkan berurutan lewat Input Nilai Tabel. Tabelnya berurut sama: deret 1 sampai 500 dulu, baru 1001 ke atas.",
          ],
        },
        {
          jenis: "poin",
          butir: [
            "Blangko dicetak SATU master lalu difotokopi. Mencetak tumpukannya dari browser menghabiskan satu toner kantor untuk pekerjaan yang diselesaikan mesin fotokopi dalam beberapa menit.",
            "LOMBA SOAL TIDAK MENCETAK BLANGKO SAMA SEKALI. Peserta menjawab di lembar soalnya sendiri, jadi pos yang seluruh lombanya soal tidak mencetak master apa pun dan mengatakan alasannya di layar.",
            "Kertasnya A5 melintang, satu halaman per lomba, difotokopi dua-up ke A4 lalu dipotong sekali lurus.",
            "Petugas lapangan hanya mencatat data MENTAH dan tidak pernah menghitung poin. Kolom Nilai Pos sengaja tidak dicetak di bentuk kertas mana pun.",
            "Tidak ada tombol simpan di Input Nilai Tabel. Baris tersimpan sendiri saat ditinggalkan, dan centang hijaunya baru muncul sesudah angka itu benar-benar ada di database — lencana kuning bertuliskan belum artinya masih di layar saja.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "FOTO ADALAH BUKTI, BUKAN SUMBER NILAI. Angka yang berlaku adalah yang diketik. Kalau isi foto berbeda dari yang terinput, penyelesaiannya manual dan diputuskan orang, bukan otomatis diambil dari gambar.",
        },
        {
          jenis: "p",
          teks: "Input Nilai Per Lomba menyimpan nilai yang gagal terkirim di HP petugas. Jaminannya adalah terkirim begitu halaman itu dibuka lagi dan ada sinyal, bukan pasti terkirim nanti. Selama pita kuning masih tampil, ada angka yang belum ada di mana pun selain HP itu — jangan tutup halamannya dan jangan pulang.",
        },
        {
          jenis: "poin",
          butir: [
            "Yang ditolak server dilaporkan merah saat itu juga, selagi regunya masih di depan petugas, dan tidak masuk antrean. Yang ditolak: nilai di luar rentang, regu tergembok, komponen bukan untuk golongan itu.",
            "Kotak penilaian yang tertinggal di pos adalah satu-satunya cara nilai lenyap tanpa jejak. Tunjuk satu orang penanggung jawabnya sejak pos tutup sampai isinya masuk sistem.",
          ],
        },
      ],
    },
    {
      kode: "tutorial-kedatangan",
      judul: "Kedatangan dan penalti waktu",
      isi: [
        {
          jenis: "p",
          teks: "Di garis finish urutannya kebalikan dari garis start: LAPTOP pencatat utamanya, kertas hanya untuk verifikasi. Targetnya sekitar tiga detik per regu, karena mejanya cuma satu atau dua.",
        },
        {
          jenis: "layar",
          nama: "Kedatangan",
          hash: "#/finish",
          fitur: "kedatangan",
          teks: "Ketik nomor dada, detail regu muncul sendiri untuk dipastikan — tidak ada tombol Cari — lalu satu tombol SAMPAI DI FINISH menandainya tiba. Home membawa lencana kemajuan datang dibanding berangkat.",
        },
        {
          jenis: "langkah",
          butir: [
            "Ketik nomor dada regu yang baru masuk.",
            "Pastikan nama regu dan sekolah yang muncul cocok dengan yang berdiri di depan meja.",
            "Hitung anggotanya secara FISIK. Lima orang atau tidak.",
            "Tekan SAMPAI DI FINISH. Jam yang tercatat adalah jam saat tombol itu ditekan, jadi tekan dulu — jangan menunggu selesai menghitung.",
            "Kalau anggotanya kurang dari lima, buka Perbaiki jam atau jumlah anggota dan turunkan angkanya. Kotak itu terisi 5 secara bawaan.",
            "Kalau antrean menumpuk, catat di kertas dulu dan masukkan menyusul, lalu betulkan jam datangnya lewat kotak yang sama.",
          ],
        },
        {
          jenis: "p",
          teks: "Penalti waktu menilai KETEPATAN, bukan kecepatan. Target tiba sebuah regu adalah jam berangkat kloternya ditambah kontrak waktunya. Berangkat 07:00 dengan kontrak 4 jam berarti target 11:00 tepat.",
        },
        {
          jenis: "tabel",
          kepala: ["Kejadian", "Akibat"],
          baris: [
            ["Tiba satu menit lebih cepat", "kurang 1 poin"],
            ["Tiba satu menit lebih lambat", "kurang 1 poin"],
            ["Tiba tepat waktu", "tidak ada pengurangan"],
            ["Melewatkan satu pos", "nilai pos itu 0, tanpa pengurangan tambahan"],
            ["Anggota kurang satu orang", "kurang 20 poin per orang"],
          ],
        },
        {
          jenis: "kenapa",
          teks: "Satu menit terlalu cepat dihukum sama persis dengan satu menit terlambat, dan tidak ada toleransi sama sekali. Aturan lama punya toleransi sembilan menit; jangan menghidupkannya kembali. Yang diuji adalah kemampuan regu memperkirakan perjalanannya sendiri, bukan kemampuan berlari.",
        },
        {
          jenis: "poin",
          butir: [
            "Jam datang adalah jam saat tombol ditekan di laptop panitia, BUKAN timestamp server saat datanya sampai. Kalau server yang menandai waktunya sendiri, regu yang dicatat dua puluh menit setelah tiba dihukum atas keterlambatan yang tidak pernah terjadi.",
            "Karena itu jam datang tetap boleh diubah manual untuk pencatatan susulan dari kertas.",
            "Penalti pos terlewat dan penalti anggota TIDAK berlaku bagi regu Internal.",
            "Regu yang belum tercatat tiba tetap tampil di Live Score tanpa peringkat, tidak bisa masuk enam besar, dan tidak dikenai pengurangan apa pun. Ia hilang dari klasemen resmi tanpa satu galat pun muncul.",
          ],
        },
      ],
    },
    {
      kode: "tutorial-cek-nilai",
      judul: "Cek nilai dan gembok",
      isi: [
        {
          jenis: "p",
          teks: "Sesudah angka masuk, ada satu orang yang membuka foto slip di sebelah angka yang diketik darinya. Kalau cocok, ia mengetuk gembok. Yang memeriksa memang bukan yang mengetik, dan pemisahan itulah yang membuat layar pemeriksa boleh mengubah nilai.",
        },
        {
          jenis: "layar",
          nama: "Cek Nilai",
          hash: "#/cek-nilai",
          fitur: "pengaturan",
          teks: "Satu regu satu layar, navigasi maju mundur per nomor dada. Angka boleh dibetulkan dan langsung dikunci di tempat. Dipegang admin server, bukan juri pos.",
        },
        {
          jenis: "langkah",
          butir: [
            "Buka Cek Nilai dan mulai dari nomor dada terkecil.",
            "Untuk tiap lomba, buka fotonya di sebelah angka yang tercatat.",
            "Kalau berbeda, betulkan angkanya di layar ini. Yang berlaku tetap keputusan orang, bukan isi gambar.",
            "Kalau sudah cocok, ketuk gembok lomba itu.",
            "Kalau ternyata masih ada koreksi sah, buka gembok itu — sekali ketuk, tanpa dialog alasan — lalu betulkan dan gembok lagi.",
          ],
        },
        {
          jenis: "poin",
          butir: [
            "Gembok berlaku PER LOMBA, bukan per pos. Pos 1 punya lima gembok terpisah.",
            "Nilai yang tergembok DITOLAK oleh seluruh jalur tulis, termasuk layar juri.",
            "Mengunci terlalu dini memblokir koreksi yang sah. Tidak mengunci sama sekali berarti tidak ada satu tanda pun bahwa sebuah lomba sudah diadu dengan fotonya.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Gembok per pos hanya bisa mengatakan seluruh pos ini sudah diperiksa, padahal yang diperiksa adalah satu lomba pada satu waktu. Kunci gembok memakai kunci yang sama persis dengan kolom foto, supaya gembok dan bukti selalu menunjuk hal yang sama.",
        },
      ],
    },
    {
      kode: "tutorial-live-score",
      judul: "Live Score dan fase live",
      isi: [
        {
          jenis: "p",
          teks: "Live Score bukan cuma papan skor; sepanjang lomba ia adalah alat memantau kelengkapan. Di kartu Status ada satu cincin per pos. Persennya di dalam cincin. Di bawahnya, berapa regu yang nilainya sudah LENGKAP dibanding berapa regu yang seharusnya dinilai di pos itu.",
        },
        {
          jenis: "layar",
          nama: "Live Score",
          hash: "#/live-score",
          fitur: "live_score",
          teks: "Cincin kemajuan per pos, podium enam tempat per golongan, tabel rinci per golongan dengan penyaring sekolah, tombol Rekap Nilai per Sekolah dan Rekap Nilai Semua, dan tombol Refresh. Saklar fase hanya muncul untuk pemegang pengaturan.",
        },
        {
          jenis: "poin",
          butir: [
            "Cincin yang belum penuh BUKAN berarti ada yang hilang. Regu yang memang belum sampai di pos itu ikut penyebutnya sejak pagi.",
            "Yang dibaca dari cincin adalah GERAKANNYA, bukan angkanya. Empat pos merangkak naik dan satu diam saja berarti sambungan atau laptop pos itu yang perlu dilihat.",
            "Cincin yang tidak penuh sampai lomba usai barulah kejaran: kertasnya masih di kotak penilaian pos, atau ada baris yang belum diinput di meja IT.",
          ],
        },
        {
          jenis: "p",
          teks: "Nilai satu regu di satu pos terisi dalam DUA gelombang: angka lomba lebih dulu, angka soal menyusul karena lembar soal ditumpuk dan dinilai berkelompok. Cincin kelengkapan yang belum penuh di tengah lomba itu wajar, bukan tanda ada yang terlewat.",
        },
        {
          jenis: "p",
          teks: "Ada lima fase live, dan saklarnya ada di layar ini. Fase menentukan apa yang boleh dilihat peserta di HP mereka.",
        },
        {
          jenis: "tabel",
          kepala: ["Tombol di saklar", "Fase di database", "Yang dilihat peserta"],
          baris: [
            ["Internal", "pra", "hanya jumlah pendaftar dan ajakan mendaftar"],
            ["Progress", "progres", "centang per komponen, tanpa satu angka nilai, plus kloter, kontrak waktu, dan jam regunya sendiri"],
            ["Live", "penuh", "sama persis dengan yang dilihat panitia"],
            ["Top 10", "top10", "maksimal sepuluh regu berperingkat per golongan beserta totalnya, tanpa poin per pos"],
            ["Juara", "juara", "papan diganti DAFTAR JUARA, dan tidak ada yang lain"],
          ],
        },
        {
          jenis: "langkah",
          butir: [
            "Sapu cincin kelengkapan tiap pos setiap kali ada jeda di meja.",
            "Bandingkan cincin-cincinnya satu sama lain, bukan dengan angka yang diingat-ingat. Cincin yang diam sendirian sementara yang lain naik itulah yang perlu ditelepon.",
            "Tekan Refresh kalau angkanya terasa basi. Sejak migrasi 0165 tombol itu MENGHITUNG ULANG, bukan sekadar membaca ulang snapshot lama. Di luar tanggal lomba penyegaran otomatis memang mati, jadi tombol inilah satu-satunya yang memperbarui.",
            "Naikkan fase HANYA sesudah panitia inti setuju.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Angka di Live Score tidak pernah dihitung di layar. Ia selalu berasal dari database, karena menghitungnya di browser akan melahirkan mesin skor kedua yang cepat atau lambat tidak sepakat dengan yang pertama.",
        },
      ],
    },
    {
      kode: "tutorial-terbitkan",
      judul: "Menerbitkan rekap ke peserta",
      isi: [
        {
          jenis: "p",
          teks: "Layar peserta tidak membaca database. Ia membaca satu berkas yang diterbitkan panitia. Karena itu ada satu urutan kerja yang harus dihafal: NYALAKAN FASENYA DULU, TERBITKAN SESUDAHNYA.",
        },
        {
          jenis: "p",
          teks: "Penerbitannya BUKAN tombol di layar panitia. Yang ada di layar cuma saklar fase. Yang menulis berkasnya workflow Publish rekap live di GitHub Actions, dijalankan dari tab Actions, dan itu bisa dari HP. Pesan yang muncul sesudah saklar digeser pun menyuruh hal yang sama.",
        },
        {
          jenis: "layar",
          nama: "Live Score",
          hash: "#/live-score",
          fitur: "pengaturan",
          teks: "Saklar fase live duduk di kepala kartu klasemen dan hanya muncul untuk pemegang fitur pengaturan. Lima tombol: Internal, Progress, Live, Top 10, Juara.",
        },
        {
          jenis: "langkah",
          butir: [
            "Pastikan angka yang mau diterbitkan sudah dicek dan digembok.",
            "Geser saklar fase di Live Score ke fase yang dituju.",
            "Baru jalankan workflow Publish rekap live di GitHub Actions.",
            "Buka situs peserta dari HP sendiri dan hitung barisnya. Jangan menilai dari judul halaman.",
            "Kalau papannya kosong padahal seharusnya berisi, jalankan Publish rekap live sekali lagi. Berkas fase sebelumnya mungkin memang tidak memuat baris itu.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Berkas rekap duduk di CDN dan bisa diminta siapa pun yang tahu alamatnya. Satu-satunya jaminan bahwa nilai belum bocor adalah nilainya MEMANG TIDAK ADA di berkas itu, bukan ada tapi tidak digambar di layar. Penerbitan punya sembilan pagar bocor, dan tidak satu pun boleh dilonggarkan demi tampilan yang lebih enak.",
        },
        {
          jenis: "poin",
          butir: [
            "HP peserta membaca fase langsung tiap lima belas detik, tapi fase hanya boleh MEMPERKETAT. Ia tidak pernah bisa menampilkan lebih dari isi berkas yang sudah terbit.",
            "Menurunkan saklar dari Juara kembali ke Live TIDAK mengembalikan papan sampai rekap diterbitkan ulang, karena berkas fase juara memang tidak memuat satu baris klasemen pun. Itu bukan kerusakan.",
            "Centang komponen boleh terbit sejak fase progres; angka nilai hanya boleh terbit di fase penuh.",
            "Berkas rekap sengaja TIDAK tersambung otomatis ke repository. Kalau disambungkan, tiap perubahan kode akan menimpanya dengan berkas contoh fase pra dan rekap peserta mendadak kosong tanpa ada yang gagal.",
            "Penerbitan otomatis hanya hidup pada tanggal lomba, tiap lima belas menit, dan hanya pada jam lomba. Di luar itu rekap cuma terbit kalau workflow-nya dijalankan tangan.",
          ],
        },
      ],
    },
    {
      kode: "tutorial-juara",
      judul: "Pengumuman juara",
      isi: [
        {
          jenis: "p",
          teks: "Sebagian penghargaan dihitung sistem dari skor, sebagian lagi keputusan panitia yang harus dimasukkan tangan sebelum diumumkan. Yang manual harus sudah terisi SEBELUM naik ke fase juara.",
        },
        {
          jenis: "layar",
          nama: "Kejuaraan",
          hash: "#/kejuaraan",
          fitur: "live_score",
          teks: "Daftar seluruh penghargaan beserta angkanya. Mengubah pilihan manual butuh fitur pengaturan.",
        },
        {
          jenis: "tabel",
          kepala: ["Penghargaan", "Dari mana"],
          baris: [
            ["Juara 1 sampai 3 dan Harapan 1 sampai 3", "enam besar skor tiap golongan"],
            ["Juara Umum, Juara Umum Penegak, Juara Umum Penggalang", "poin gelar tiap sekolah — Juara 1 bernilai 6 sampai Harapan 3 bernilai 1"],
            ["Juara Yel Yel", "poin Pos 5 tertinggi, per golongan"],
            ["Peserta Terbanyak", "jumlah nomor dada Eksternal per sekolah, satu untuk seluruh acara"],
            ["Juara Kostum dan Peserta Terfavorit", "pilihan manual panitia, per golongan"],
            ["Pangkalan Terjauh", "pilihan manual panitia, SEKOLAH bukan regu, satu untuk seluruh acara"],
          ],
        },
        {
          jenis: "langkah",
          butir: [
            "Pastikan semua regu sudah tercatat tiba. Regu yang belum closing tidak bisa masuk enam besar.",
            "Isi pilihan manual: Juara Kostum dan Peserta Terfavorit per golongan, lalu Pangkalan Terjauh yang diisi nama SEKOLAH.",
            "Periksa daftar juara di layar Kejuaraan bersama panitia inti.",
            "UMUMKAN DI LAPANGAN lebih dulu.",
            "Baru geser saklar fase ke Juara.",
            "Baru jalankan Publish rekap live sekali lagi.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Podium tidak memakai angka peringkat. Peringkat membuat dua regu berskor sama berbagi angka lalu melompati angka berikutnya — benar untuk peringkat, salah untuk GELAR, karena piala Juara 2 hanya ada satu. Pemecah serinya ketepatan waktu lebih dulu, lalu nomor dada terkecil.",
        },
        {
          jenis: "poin",
          butir: [
            "Daftar juara terbit BESERTA angkanya, karena angka itu baru saja dibacakan di lapangan.",
            "Yang menahan angka sebelum pengumuman bukan ketiadaan kolom, melainkan pagar fase: di luar fase juara tidak ada satu baris pun untuk dibaca siapa pun.",
            "Tidak ada mekanisme sanggahan. Nilai yang sudah direkap bersifat final.",
          ],
        },
      ],
    },
    {
      kode: "tutorial-sesudah-acara",
      judul: "Sesudah acara",
      isi: [
        {
          jenis: "p",
          teks: "Pekerjaan belum selesai saat piala dibagikan. Ada barang fisik yang harus kembali, dan ada data yang harus dibiarkan utuh sampai kepanitiaan berikutnya siap membersihkannya.",
        },
        {
          jenis: "layar",
          nama: "Live Score",
          hash: "#/live-score",
          fitur: "live_score",
          teks: "Tekan Rekap Nilai Semua dari sini untuk arsip kertas kepanitiaan, sesudah seluruh gembok terpasang. Rekap Nilai per Sekolah memecahnya per sekolah.",
        },
        {
          jenis: "layar",
          nama: "Akun",
          hash: "#/account",
          fitur: "akun",
          teks: "Nonaktifkan akun panitia yang sudah selesai tugasnya. Akun nonaktif kehilangan seluruh haknya seketika tanpa perlu dihapus.",
        },
        {
          jenis: "langkah",
          butir: [
            "Kumpulkan seluruh kotak penilaian dari kelima pos dan pastikan tidak ada satu pun tertinggal.",
            "Pastikan tidak ada lagi pita kuning tersisa di HP petugas Input Nilai Per Lomba sebelum mereka pulang.",
            "Cetak Rekap Nilai Semua untuk arsip kertas.",
            "Kumpulkan kembali kain nomor dada, pisahkan yang rusak dan catat nomornya sebagai dipensiunkan.",
            "Nonaktifkan akun panitia yang sudah selesai tugasnya.",
            "Serahkan Buku Sakti ini beserta catatan apa yang berubah tahun ini kepada kepanitiaan berikutnya.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "JANGAN membersihkan data atas inisiatif sendiri. Bersihkan data menghapus regu, nilai, DAN mengembalikan penomoran kloter ke 1 — dan itu adalah satu-satunya salinan hasil lomba tahun ini sampai arsipnya benar-benar dipegang orang. Tunggu sampai pemilik acara memintanya.",
        },
        {
          jenis: "poin",
          butir: [
            "Catat apa saja yang belum ada layarnya, supaya kepanitiaan berikutnya tidak mencarinya di hari-H. Sekarang ada tiga: penempatan barak belum punya layar, upload nilai massal belum dibangun, dan foto borongan masih ditautkan ke nomor dada dengan tangan.",
            "Catat juga apa yang tahun ini berubah angkanya — bobot lomba, kontrak waktu, stok nomor dada — supaya edisi berikutnya tahu apa yang harus ditinjau ulang.",
          ],
        },
      ],
    },
  ],
};
const BAB_SEKSI = {
  kode: "seksi",
  judul: "Susunan Kepanitiaan",
  tab: "Seksi",
  ikon: "users",
  warna: "magenta",
  ringkas: "Bentuk kepanitiaan yang dibutuhkan satu edisi HRCD: siapa saja seksinya, apa tugas pokoknya, kapan pekerjaannya jatuh, dan hak akses apa yang dipegangnya. Ditutup satu bagian strategi mendatangkan untung.",
  bagian: [
    {
      kode: "seksi-susunan",
      judul: "Susunan kepanitiaan HRCD",
      bukanSeksi: true,
      isi: [
        {
          jenis: "p",
          teks: "Bab ini menjawab satu pertanyaan: untuk menggelar HRCD, kepanitiaan seperti apa yang harus dibentuk. Dua penanggung jawab dari pengurus ambalan, lalu lima belas seksi. Tiap seksi punya satu bagian sendiri di bawah, dan tiap bagian berbentuk sama: tugas pokok, daftar pekerjaan, tabel kapan pekerjaan itu jatuh, dan hak akses yang dibutuhkannya.",
        },
        {
          jenis: "tabel",
          kepala: ["Seksi", "Tugas pokok satu kalimat"],
          baris: [
            ["Penanggung Jawab Umum", "Pradana. Menjamin HRCD berjalan atas nama ambalan dan menjadi wajah acara ke sekolah."],
            ["Penanggung Jawab Pelaksana", "Pemangku Adat. Menjaga adat ambalan, upacara, dan sikap panitia selama acara."],
            ["Ketua Pelaksana", "Dua orang. Memutuskan yang tidak bisa diputuskan di meja: tanggal, biaya, sanksi, kapan nilai diumumkan."],
            ["Sekretaris", "Dua orang. Surat, izin, proposal, notulen, sertifikat."],
            ["Bendahara", "Dua orang. Anggaran, uang masuk dan keluar, verifikasi pembayaran pendaftaran."],
            ["Sekretariat", "Pendaftaran, data peserta, daftar ulang, nomor dada, kloter. Di edisi ini sekaligus memegang akun admin."],
            ["Koordinator Lapangan", "Membawahi koordinator tiap pos dan seluruh juri. Lomba, soal, rubrik, penilaian."],
            ["Humas", "Menghubungi sekolah dan pembina, mengurus izin lahan dan tamu undangan."],
            ["Seksi Acara", "Susunan acara, upacara, garis start pagi, garis finish siang."],
            ["Dana Usaha", "Menghimpun uang di luar biaya pendaftaran: jualan, pre-order, bazar."],
            ["Sponsorship", "Proposal sponsor, negosiasi paket, timbal balik logo dan booth."],
            ["Kreatif dan Publikasi", "Poster, konten media sosial, dokumentasi foto dan video acara."],
            ["Akomodasi dan Logistik", "Barak, tenda, alat lomba, nomor dada kain, blangko, piala, rambu rute."],
            ["Keamanan", "Izin keramaian, pengaturan lalu lintas, penjagaan jalur dan barak."],
            ["Konsumsi", "Makan panitia, juri, tamu, dan minum di titik rute."],
            ["Kesehatan", "Tim medis di finish dan di antara pos, obat, rujukan."],
            ["Survey", "Menyusuri dan mengunci rute, titik pos, titik rawan, dan jarak antar pos."],
          ],
        },
        {
          jenis: "poin",
          butir: [
            "Susunan ini USULAN. Nama seksi tidak tersimpan di database mana pun dan tidak dipakai satu baris kode pun, jadi kepanitiaan tahun ini boleh menyusunnya ulang.",
            "Satu orang boleh memegang dua seksi yang jam sibuknya berbeda. Yang tidak boleh dirangkap adalah pekerjaan yang berjalan bersamaan pada 07:00 sampai 14:00.",
            "Angka acuan di seluruh bab ini: sekitar 300 regu, kurang lebih 2.500 peserta, lima pos penilaian, jendela keberangkatan 07:00 sampai 10:00.",
            "Sistem tidak menyimpan nama panitia. Satu akun cuma punya username, peran, kolom pos, dan status aktif, jadi daftar siapa memegang akun mana ditulis di luar sistem.",
            "Buku Sakti terbuka untuk semua akun panitia tanpa centang apa pun. Bab ini memang untuk dibaca seluruh panitia, bukan cuma koordinatornya.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Yang paling sering hilang bukan seksi yang besar, melainkan pekerjaan yang jatuh di antara dua seksi. Tiga contohnya: garis finish antara Acara dan Koordinator Lapangan, penyusuran jalur antara Keamanan dan Kesehatan, daftar username antara Sekretaris dan Sekretariat. Putuskan ketiganya di rapat besar, tertulis.",
        },
      ],
    },

    {
      kode: "seksi-akses",
      judul: "Akses ke sistem, bukan seksi",
      bukanSeksi: true,
      isi: [
        {
          jenis: "p",
          teks: "Seksi adalah cara membagi ORANG. Peran akun dan centang fitur adalah cara membagi HAK. Keduanya sumbu yang berbeda dan tidak wajib satu lawan satu: sistem tidak mengenal jabatan sama sekali, ia hanya mengenal centang.",
        },
        {
          jenis: "p",
          teks: "Jadi tidak ada seksi yang wajib ada demi sistem. Yang wajib ada adalah orang yang memegang tiap centang, dan orang itu boleh duduk di seksi mana pun. Di edisi ini Sekretariat yang memegang akun admin, karena orangnya paling mumpuni di sistem; tahun depan boleh seksi lain.",
        },
        {
          jenis: "tabel",
          kepala: ["Centang", "Peran akun", "Dipegang siapa di edisi ini"],
          baris: [
            ["pendaftaran", "registrasi", "Sekretariat"],
            ["pembayaran", "registrasi", "Bendahara dan Sekretariat"],
            ["daftar_ulang", "registrasi", "Sekretariat"],
            ["cetak_kloter", "registrasi", "Sekretariat"],
            ["keberangkatan", "gerbang", "Seksi Acara"],
            ["kedatangan", "gerbang", "Seksi Acara, orang yang sama pindah ke finish jam 10:00"],
            ["pos", "juri_pos dengan kolom pos diisi 1 sampai 5", "Juri tiap pos"],
            ["pos", "koordinator_pos dengan kolom pos KOSONG", "Koordinator Lapangan, terbuka untuk kelima pos"],
            ["live_score", "ikut di keempat paket peran", "Ketua, Sekretariat, Acara, Koordinator Lapangan, Kreatif"],
            ["rekap", "hanya ada di paket admin", "Sekretariat"],
            ["akun", "admin", "Sekretariat"],
            ["pengaturan", "admin", "Ketua Pelaksana dan Sekretariat"],
          ],
        },
        {
          jenis: "poin",
          butir: [
            "Lima peran: admin, registrasi, gerbang, juri_pos, koordinator_pos. Peran cuma preset yang mengisi centang awal; yang membuka layar tetap centangnya.",
            "juri_pos WAJIB punya nomor pos 1 sampai 5, dan nomor itulah yang mengunci barisnya ke posnya sendiri.",
            "koordinator_pos WAJIB kolom posnya kosong. Kekosongan itu yang membuka kelima pos sekaligus.",
            "Urutannya selalu peran dulu, centang sesudahnya. Mengganti peran MENGHAPUS seluruh centang tangan lalu mengisinya ulang dari paket.",
            "Sedikitnya DUA orang harus memegang password akun admin dan akun organisasi. Satu orang sakit pada hari-H adalah kejadian biasa.",
          ],
        },
        {
          jenis: "layar",
          nama: "Akun",
          hash: "#/account",
          fitur: "akun",
          teks: "Membuat akun panitia, memilih peran, dan mencentang fitur per akun. Kalau seorang panitia melapor ubinnya hilang di Home, yang salah hampir selalu centangnya, bukan layarnya.",
        },
        {
          jenis: "kenapa",
          teks: "Empat pekerjaan tidak punya layar sama sekali dan cuma hidup lewat GitHub Actions: menerapkan migration, membuat akun panitia sekaligus banyak, menerbitkan rekap ke situs peserta, dan mengembalikan password bersama ke acak. Seluruh konfigurasi edisi ada di situ, jadi seksi yang memegang admin harus ditunjuk sejak Sprint 1, bukan menjelang hari-H.",
        },
      ],
    },

    {
      kode: "seksi-pj-umum",
      judul: "Penanggung Jawab Umum",
      singkat: "PJ Umum",
      rona: "emas",
      isi: [
        {
          jenis: "p",
          teks: "Pradana. HRCD digelar atas nama ambalan, dan jabatan inilah yang menanggungnya di depan sekolah, pembina, dan pangkalan lain. Ia tidak menjalankan meja mana pun. Ia yang menunjuk kepanitiaannya, dan yang dicari kalau ada yang salah.",
        },
        {
          jenis: "poin",
          butir: [
            "Menetapkan siapa penanggung jawab HRCD edisi ini dan mengesahkan susunan kepanitiaannya.",
            "Menyerahkan password akun organisasi ke minimal DUA orang, dan mencatat siapa memegang apa di luar sistem.",
            "Menandatangani proposal dan surat keluar bersama sekretaris dan pembina.",
            "Menjadi wajah ambalan ke sekolah dan tamu undangan pada hari lomba.",
            "Menerima serah terima Buku Sakti, daftar akun, dan catatan keputusan dari kepanitiaan yang turun.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Sprint 1", "Serah terima jabatan, menunjuk panitia inti, menyerahkan password akun organisasi."],
            ["Sprint 3", "Mengesahkan susunan kepanitiaan lengkap di rapat besar."],
            ["Hari lomba", "Membuka upacara, mendampingi tamu undangan dan pejabat pemberangkat."],
            ["Sesudah acara", "Memimpin evaluasi ambalan dan serah terima ke kepengurusan berikutnya."],
          ],
        },
        {
          jenis: "kenapa",
          teks: "Sistem tidak mengenal jabatan, jadi wewenang Pradana tidak otomatis jadi hak di layar. Kalau ia perlu membuka sesuatu, akunnya dicentang seperti panitia lain.",
        },
      ],
    },

    {
      kode: "seksi-pj-pelaksana",
      judul: "Penanggung Jawab Pelaksana",
      singkat: "PJ Pelaksana",
      rona: "lumut",
      isi: [
        {
          jenis: "p",
          teks: "Pemangku Adat. Menjaga bahwa HRCD tetap kegiatan Pramuka, bukan sekadar lomba: adat ambalan, upacara, seragam, dan sikap panitia di depan peserta dari sekolah lain.",
        },
        {
          jenis: "poin",
          butir: [
            "Menyusun tata upacara pembukaan dan penutupan bersama Seksi Acara.",
            "Menetapkan aturan adat selama acara: seragam panitia, sikap di pos, dan cara memanggil peserta.",
            "Memimpin apel panitia pagi hari-H sebelum peserta datang.",
            "Menegur pelanggaran adat di lapangan, dan menyerahkan urusan sanksi peserta ke Ketua Pelaksana.",
            "Menutup acara secara adat sebelum panitia bubar.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Sprint 3", "Menetapkan aturan adat dan seragam panitia di rapat besar."],
            ["Sprint 12", "Gladi bersih upacara pembukaan dan penutupan."],
            ["Hari lomba", "Apel panitia, upacara pembukaan, upacara penutupan dan pengumuman juara."],
          ],
        },
        {
          jenis: "kenapa",
          teks: "Upacara pembukaan bukan penundaan yang perlu dipangkas. Pelepasan kloter pertama oleh pejabat adalah alasan acara ini punya garis start yang layak difoto, jadi susun paginya mengelilingi upacara itu, bukan melawannya.",
        },
      ],
    },

    {
      kode: "seksi-ketua",
      judul: "Ketua Pelaksana",
      singkat: "Ketua",
      rona: "merah",
      isi: [
        {
          jenis: "p",
          teks: "Dua orang. Ketua memegang keputusan yang tidak bisa diambil di meja: tanggal, biaya, susunan pos, sanksi, dan kapan nilai boleh diumumkan. Wakil bukan cadangan yang menunggu. Bagi wilayahnya sejak awal: satu memegang jalur administrasi dari pendaftaran sampai daftar ulang, satu memegang jalur lapangan dari keberangkatan sampai kedatangan.",
        },
        {
          jenis: "poin",
          butir: [
            "Menetapkan tanggal lomba dan biaya pendaftaran per regu, DUA angka, satu untuk Eksternal dan satu untuk Internal.",
            "Menunjuk koordinator tiap seksi, dan menunjuk seksi mana yang memegang akun admin.",
            "Memutuskan yang tidak boleh diputuskan petugas meja: pembatalan keberangkatan, penyisipan regu terlambat ke kloter, dan sanksi.",
            "Memutuskan kapan fase live dinaikkan, lalu memberitahukannya ke pemegang admin, bukan sebaliknya.",
            "Berdiri di titik paling mungkin macet pagi itu, bukan di ruang panitia.",
            "Menyerahkan Buku Sakti, daftar akun, dan catatan keputusan ke kepanitiaan berikutnya.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Sprint 2", "Menetapkan tanggal, tema, kuota regu, dan kedua biaya pendaftaran."],
            ["Sprint 3", "Memimpin rapat besar dan menunjuk koordinator tiap seksi."],
            ["Sprint 12", "Memimpin gladi kotor dan gladi bersih dengan orang yang sungguhan akan memegangnya."],
            ["Hari lomba", "Upacara, garis start, lalu meja daftar ulang. Memutuskan di tempat dan memberitahukan keputusannya ke seksi yang terkena."],
            ["Sesudah acara", "Menurunkan fase live, memimpin evaluasi, dan serah terima."],
          ],
        },
        {
          jenis: "layar",
          nama: "Home",
          hash: "#/home",
          fitur: null,
          teks: "Ubin yang muncul di Home adalah cerminan centang akun, bukan daftar menu tetap. Kalau seorang panitia melapor ubinnya hilang, yang salah hampir selalu centangnya.",
        },
        {
          jenis: "kenapa",
          teks: "Membatalkan keberangkatan ada di balik centang pengaturan. Kalau akun ketua tidak dicentang itu, keputusannya harus dititipkan ke orang lain di tengah antrean.",
        },
      ],
    },

    {
      kode: "seksi-sekretaris",
      judul: "Sekretaris",
      singkat: "Sekretaris",
      rona: "biru",
      isi: [
        {
          jenis: "p",
          teks: "Dua orang. Seluruh kertas resmi acara ini keluar dari sini: izin, undangan, proposal, juklak, notulen, dan sertifikat. Pekerjaan terberatnya bukan mengetik, melainkan mengejar tanda tangan sebelum tenggat orang lain lewat.",
        },
        {
          jenis: "poin",
          butir: [
            "Mengurus izin prinsip sekolah, izin Kwarran, izin keramaian Polsek, dan surat ke Koramil serta camat.",
            "Menyusun juklak dan juknis lomba bersama Koordinator Lapangan, lalu menyebarkannya bersama edaran pendaftaran.",
            "Membuat surat undangan pangkalan, undangan juri, dan undangan tamu pemberangkat.",
            "Mencatat notulen tiap rapat, dan menyimpan keputusannya di tempat yang bisa dibuka kepanitiaan berikutnya.",
            "Menyiapkan sertifikat peserta, juri, dan panitia sebelum hari-H, bukan sesudahnya.",
            "Mencatat siapa memegang username apa. Sistem tidak menyimpan nama orang, jadi daftar ini satu-satunya yang ada.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Sprint 2 sampai 5", "Izin prinsip, izin Kwarran, proposal, juklak dan juknis."],
            ["Sprint 7 sampai 8", "Izin keramaian, surat Koramil dan camat, undangan juri."],
            ["Sprint 11", "Sertifikat dicetak, daftar hadir panitia disiapkan."],
            ["Sesudah acara", "Laporan pertanggungjawaban, arsip surat, serah terima berkas."],
          ],
        },
        {
          jenis: "kenapa",
          teks: "Izin keramaian menuntut izin prinsip yang sudah terbit lebih dulu, dan tiap surat menunggu tanda tangan orang di luar ambalan. Rantai itu yang membuat surat harus jalan enam sampai delapan minggu sebelum acara, bukan dua.",
        },
      ],
    },

    {
      kode: "seksi-bendahara",
      judul: "Bendahara",
      singkat: "Bendahara",
      rona: "hijau",
      isi: [
        {
          jenis: "p",
          teks: "Dua orang. Menyusun anggaran, menjaga uang masuk dan keluar, dan memverifikasi pembayaran pendaftaran di Meja Pembayaran. Uang pendaftaran satu-satunya yang tercatat di sistem; sisanya dibukukan sendiri.",
        },
        {
          jenis: "poin",
          butir: [
            "Menyusun rencana anggaran bersama Ketua, dan menetapkan kedua biaya pendaftaran.",
            "Menyediakan dana talangan untuk pengeluaran yang jatuh sebelum uang pendaftaran masuk.",
            "Mencocokkan bukti transfer dengan mutasi rekening sebelum menandai lunas.",
            "Menandai lunas per kode pembayaran, bukan per regu. Satu kode mencakup seluruh regu dalam satu batch.",
            "Mencetak kwitansi untuk pembina yang memintanya.",
            "Menerima setoran Dana Usaha dan Sponsorship dengan satu buku yang sama.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Sprint 2", "Menyusun rencana anggaran dan menetapkan biaya pendaftaran."],
            ["Sprint 6 sampai 11", "Memverifikasi pembayaran tiap hari selagi jumlahnya masih puluhan."],
            ["Sprint 9", "Menyiapkan dana cadangan untuk pengeluaran hari-H."],
            ["Sesudah acara", "Menutup buku dan menyusun laporan keuangan."],
          ],
        },
        {
          jenis: "layar",
          nama: "Meja Pembayaran",
          hash: "#/pembayaran",
          fitur: "pembayaran",
          teks: "Daftar seluruh batch pendaftaran, tombol Tandai Lunas, dan Cetak Kwitansi. Pembayaran sebagian tidak dilayani: satu batch dibayar semuanya atau tidak sama sekali.",
        },
        {
          jenis: "kenapa",
          teks: "Regu yang belum lunas tidak bisa daftar ulang dan tidak dapat nomor dada. Verifikasi yang menumpuk sampai H-1 berubah jadi antrean di meja daftar ulang keesokan harinya.",
        },
      ],
    },

    {
      kode: "seksi-sekretariat",
      judul: "Sekretariat",
      singkat: "Sekretariat",
      rona: "toska",
      isi: [
        {
          jenis: "p",
          teks: "Pintu masuk acara, dan meja yang paling sering menyentuh sistem: pendaftaran, data peserta, daftar ulang, nomor dada, dan kloter. Di edisi ini Sekretariat sekaligus memegang akun admin, karena orangnya paling mumpuni di sistem. Itu penunjukan, bukan aturan.",
        },
        {
          jenis: "poin",
          butir: [
            "Menyebarkan link form pendaftaran ke pangkalan bersama Humas, dan menjawab pembina yang tersangkut di tengah form.",
            "Menjaga nama regu unik dan satu sekolah satu baris. Dua sekolah senama dibedakan DI DALAM namanya, misalnya MAN 3 Ciamis dan MAN 3 Tasikmalaya.",
            "Membetulkan salah ketik lewat Data Peserta. Golongan, sekolah, nomor dada, dan status bayar tidak bisa diubah di sana.",
            "Menjalankan daftar ulang H-1 pagi sampai hari-H pukul 10:00 dengan dua sampai tiga meja: mengetik nomor dada dari kain fisik, seluruh regu satu sekolah dalam satu kali simpan.",
            "Mencetak dan menempel daftar kloter di papan utama dan di barak, supaya pembina tidak bertanya satu per satu.",
            "Sebagai pemegang admin: membuat akun panitia, menerapkan migration konfigurasi edisi, menaikkan fase live atas perintah Ketua, dan menerbitkan rekap ke situs peserta.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Sprint 1 sampai 3", "Memegang password akun organisasi, membuat akun panitia inti."],
            ["Sprint 5 sampai 6", "Menerapkan migration konfigurasi edisi, membuka pendaftaran, memantau regu masuk tiap hari."],
            ["Sprint 11", "Menutup pendaftaran, menyerahkan hitungan regu terakhir ke Logistik dan Konsumsi, membuat akun juri."],
            ["H-1 pagi sampai hari-H 10:00", "Daftar ulang: nomor dada, tiska, kloter, cetak daftar kloter."],
            ["Hari lomba", "Standby untuk gembok dan pembetulan nilai, menaikkan fase live, menerbitkan rekap."],
          ],
        },
        {
          jenis: "layar",
          nama: "Meja Daftar Ulang",
          hash: "#/daftar-ulang",
          fitur: "daftar_ulang",
          teks: "Cari batch dengan kode pembayaran, isi nomor dada untuk seluruh regu sekolah itu sekaligus, lalu simpan. Bacakan lagi nomornya sebelum menekan Simpan: itu pintu terakhir yang masih murah.",
        },
        {
          jenis: "layar",
          nama: "Data Peserta",
          hash: "#/data-peserta",
          fitur: "pendaftaran",
          teks: "Seluruh regu, sekolahnya, ketua, anggota, dan nomor kontak pembina. Tiap perubahan masuk riwayat: siapa mengubah, kapan, dan dari apa ke apa.",
        },
        {
          jenis: "kenapa",
          teks: "Sesudah nomor dada diberikan, identitas lapangan regu itu beku. Nama regu yang sudah bernomor dada tidak diganti lagi, karena nomor itu sudah tertulis di kain, di daftar kloter, dan di blangko.",
        },
      ],
    },

    {
      kode: "seksi-korlap",
      judul: "Koordinator Lapangan",
      singkat: "Korlap",
      rona: "ungu",
      isi: [
        {
          jenis: "p",
          teks: "Membawahi koordinator tiap pos dan seluruh juri. Seksi ini yang memutuskan lomba apa saja, soal apa, rubrik penilaian seperti apa, dan berapa bobot tiap pos. Pada hari lomba ia berkeliling kelima pos, bukan duduk di satu pos.",
        },
        {
          jenis: "poin",
          butir: [
            "Menyusun daftar pos, lomba, dan penilaian beserta poin maksimalnya. Bobot sebuah pos tidak ditulis di mana pun: ia jumlah poin maksimal seluruh wahana di pos itu.",
            "Menulis soal dan kunci jawaban, lalu memvalidasinya ke pembina dan mengujicobakannya ke anggota ambalan yang tidak ikut menyusun.",
            "Menyusun rubrik penilaian yang bisa dipakai juri yang baru pertama memegang lembar nilai.",
            "Menetapkan pilihan kontrak waktu dan memastikan tiap lomba selesai di dalamnya.",
            "Membagi juri per pos, dan memastikan tiap juri punya akun dengan nomor pos yang benar.",
            "Berkeliling pada hari lomba: memastikan nilai masuk, foto lembar jawaban terunggah, dan tidak ada pos yang tertinggal.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Sprint 4 sampai 5", "Format soal, kisi-kisi, rubrik penilaian."],
            ["Sprint 6", "Mengunci susunan pos, lomba, dan bobot supaya angkanya tidak berubah sesudah blangko dicetak."],
            ["Sprint 7 sampai 10", "Menulis soal, memvalidasi, merevisi, menguji jalan tiap lomba."],
            ["Sprint 11", "Membagi juri per pos, memastikan akunnya jadi dan nomor posnya benar."],
            ["Hari lomba", "Berkeliling kelima pos sepanjang siang."],
          ],
        },
        {
          jenis: "layar",
          nama: "Input Nilai Per Lomba",
          hash: "#/pos2",
          fitur: "pos",
          teks: "Satu lomba satu layar, dan dari sini pula blangko masternya dicetak. Lomba yang seluruh komponennya soal tidak mencetak blangko: peserta menjawab di lembar soalnya sendiri.",
        },
        {
          jenis: "kenapa",
          teks: "Akun juri_pos WAJIB punya nomor pos dan terkunci di posnya sendiri; koordinator memakai koordinator_pos dengan kolom pos KOSONG, dan kekosongan itulah yang membuka kelima pos. Mengisi kolom pos untuk koordinator diam-diam mengubahnya jadi juri pos biasa.",
        },
      ],
    },

    {
      kode: "seksi-humas",
      judul: "Humas",
      singkat: "Humas",
      rona: "sian",
      isi: [
        {
          jenis: "p",
          teks: "Satu-satunya pintu resmi ke luar ambalan untuk urusan peserta: sekolah, pembina, pemilik lahan, dan tamu undangan. Nomor kontak yang tertulis di poster adalah nomor seksi ini, dan harus ada yang menjawabnya bergilir.",
        },
        {
          jenis: "poin",
          butir: [
            "Menyebarkan edaran dan undangan ke pangkalan, lalu menagih konfirmasi keikutsertaan.",
            "Menjawab pertanyaan pembina di WA dan telepon, dan meneruskan yang teknis ke seksi yang benar.",
            "Mengurus izin pemakaian lahan rute dan lahan tiap pos ke pemiliknya, dan menjaga hubungan itu untuk edisi berikutnya.",
            "Mengurus tamu undangan dan pejabat yang memberangkatkan kloter pertama.",
            "Menyiapkan technical meeting pembina bersama Ketua dan Koordinator Lapangan.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Sprint 5 sampai 6", "Edaran dan undangan pangkalan disebar, konfirmasi ditagih."],
            ["Sprint 7", "Izin lahan rute dan lahan pos diurus ke pemiliknya."],
            ["Sprint 11", "Technical meeting pembina."],
            ["Hari lomba", "Menerima tamu undangan, menjaga satu nomor kontak yang selalu dijawab."],
          ],
        },
        {
          jenis: "kenapa",
          teks: "Nomor WA pembina tersimpan di Data Peserta dan tidak boleh disalin ke daftar apa pun di luar sistem. Ia data pribadi orang yang menitipkan anak didiknya, bukan daftar kontak untuk promosi.",
        },
      ],
    },

    {
      kode: "seksi-acara",
      judul: "Seksi Acara",
      singkat: "Acara",
      rona: "jingga",
      isi: [
        {
          jenis: "p",
          teks: "Susunan acara dari upacara sampai pengumuman juara, dan DUA gerbang pada hari lomba: garis start pagi dan garis finish siang. Orangnya memang sama, karena pekerjaan garis start habis jam sepuluh tepat ketika garis finish mulai sibuk.",
        },
        {
          jenis: "poin",
          butir: [
            "Menyusun susunan acara dan menjalankan upacara pembukaan bersama PJ Pelaksana.",
            "Menahan tiga kloter siap di Pemberangkatan, Staging 1, dan Staging 2, sisanya tetap di formasi upacara.",
            "Menyusun formasi upacara TERBALIK: kloter terakhir di depan, kloter 4, 5, 6 di belakang supaya paling dekat jalan keluar.",
            "Mencatat jam berangkat tiap kloter dari jam sungguhan, lalu mengetiknya ke layar Keberangkatan.",
            "Pindah ke garis finish jam sepuluh, dan menekan SAMPAI DI FINISH untuk tiap regu yang datang.",
            "Menyerahkan daftar regu yang belum kembali ke Keamanan dan Kesehatan, berkala, bukan di akhir.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Sprint 12", "Gladi bersih upacara dan pemberangkatan kloter."],
            ["Hari lomba 07:00 sampai 10:00", "Upacara, pelepasan kloter pertama, lalu memberangkatkan seluruh kloter."],
            ["Hari lomba 10:00 sampai 14:00", "Garis finish: mencatat kedatangan tiap regu."],
            ["Hari lomba sore", "Upacara penutupan dan pengumuman juara."],
          ],
        },
        {
          jenis: "layar",
          nama: "Keberangkatan",
          hash: "#/keberangkatan",
          fitur: "keberangkatan",
          teks: "Menceklis kehadiran regu, memilih kontrak waktu, dan mengetik jam berangkat kloter. Jam yang diketik inilah yang dipakai menghitung penalti, bukan perkiraan yang tergambar di papan.",
        },
        {
          jenis: "layar",
          nama: "Kedatangan",
          hash: "#/finish",
          fitur: "kedatangan",
          teks: "Tombol SAMPAI DI FINISH per regu. Penalti dihitung dari selisih jam datang terhadap jam berangkat ditambah kontrak waktunya.",
        },
        {
          jenis: "kenapa",
          teks: "Penalti waktu menilai KETEPATAN, bukan kecepatan. Terlalu cepat dan terlambat sama-sama mengurangi satu poin per menit. Jam datang yang tidak ditekan membuat penalti regu itu kosong, dan tidak ada cara memulihkannya sesudah semua bubar.",
        },
      ],
    },

    {
      kode: "seksi-danus",
      judul: "Dana Usaha",
      singkat: "Danus",
      rona: "zamrud",
      isi: [
        {
          jenis: "p",
          teks: "Menghimpun uang di luar biaya pendaftaran dan di luar sponsor: jualan, pre-order, dan bazar. Uangnya tidak lewat sistem sama sekali, jadi seluruh pembukuannya disetor ke Bendahara dengan satu buku yang sama.",
        },
        {
          jenis: "poin",
          butir: [
            "Menetapkan target rupiah bersama Bendahara sejak anggaran disusun, bukan menjual sebanyak yang sempat.",
            "Menjalankan jualan berkala di sekolah selama masa persiapan.",
            "Membuka pre-order kaos atau merchandise panitia, dan menutupnya cukup awal supaya barangnya jadi sebelum hari-H.",
            "Membuka bazar atau stan pada hari lomba di sekitar barak dan garis finish.",
            "Menyetor hasil ke Bendahara berkala, bukan sekaligus di akhir.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Sprint 2", "Menetapkan target rupiah bersama Bendahara."],
            ["Sprint 3 sampai 10", "Jualan berkala, setoran berkala ke Bendahara."],
            ["Sprint 9", "Menutup pre-order supaya barangnya jadi sebelum hari-H."],
            ["Hari lomba", "Bazar atau stan di sekitar barak dan garis finish."],
          ],
        },
        {
          jenis: "kenapa",
          teks: "Dana Usaha dan Sponsorship sama-sama membawa uang masuk, dan kalau pembukuannya berbeda, selisih laporan akhir tidak bisa dicocokkan ke apa pun. Sistem cuma mencatat pembayaran pendaftaran.",
        },
      ],
    },

    {
      kode: "seksi-sponsorship",
      judul: "Sponsorship",
      singkat: "Sponsor",
      rona: "mawar",
      isi: [
        {
          jenis: "p",
          teks: "Menyusun proposal, mendatangi calon sponsor, menegosiasikan paket, dan menunaikan timbal baliknya. Bedanya dengan Humas jelas: Humas ke sekolah dan pembina, Sponsorship ke perusahaan dan toko.",
        },
        {
          jenis: "poin",
          butir: [
            "Menyusun proposal dan paket timbal balik berjenjang bersama Bendahara.",
            "Menyusun daftar target sponsor sejak awal, dan membaginya supaya tidak ada satu calon didatangi dua orang dengan angka berbeda.",
            "Menagih tindak lanjut proposal yang sudah masuk, berkala, sampai ada jawaban.",
            "Menutup penerimaan sponsor cukup awal supaya logo sempat masuk ke poster dan piala.",
            "Menunaikan timbal balik yang dijanjikan pada hari lomba: logo, booth, penyebutan.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Sprint 2", "Proposal dan daftar target sponsor disusun."],
            ["Sprint 3 sampai 8", "Menyebar proposal, menagih tindak lanjut, menegosiasikan paket."],
            ["Sprint 9", "Menutup penerimaan sponsor, menyerahkan logo ke Kreatif."],
            ["Hari lomba", "Menunaikan timbal balik: booth, spanduk, penyebutan."],
          ],
        },
        {
          jenis: "kenapa",
          teks: "Logo yang masuk sesudah poster tercetak tidak bisa dipenuhi lagi, dan janji yang tidak ditunaikan menutup pintu sponsor itu untuk edisi berikutnya. Tutup penerimaannya di Sprint 9, bukan menjelang hari-H.",
        },
      ],
    },

    {
      kode: "seksi-kreatif",
      judul: "Kreatif dan Publikasi",
      singkat: "Kreatif",
      rona: "magenta",
      isi: [
        {
          jenis: "p",
          teks: "Poster, konten media sosial, dan dokumentasi acara. Satu hal yang harus jelas sejak awal: ada DUA benda yang sama-sama disebut foto di acara ini, dan cuma satu yang jadi pekerjaan seksi ini.",
        },
        {
          jenis: "poin",
          butir: [
            "Membuat poster pendaftaran, lalu poster final yang sudah memuat logo sponsor.",
            "Mengisi media sosial selama masa pendaftaran, dan mengumumkan tenggat lewat kanal yang sama.",
            "Mendokumentasikan hari lomba: upacara, garis start, tiap pos, garis finish, pengumuman juara.",
            "Menyiapkan bahan pengumuman juara dari layar Kejuaraan sesudah fase juara dinyalakan.",
            "Menyerahkan arsip foto dan video ke Sekretaris untuk laporan dan untuk edisi berikutnya.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Sprint 4 sampai 5", "Poster pendaftaran, lalu poster final dengan logo sponsor."],
            ["Sprint 6 sampai 11", "Konten media sosial selama pendaftaran dibuka."],
            ["Hari lomba", "Dokumentasi seluruh rangkaian, bahan pengumuman juara."],
            ["Sesudah acara", "Arsip foto dan video diserahkan ke Sekretaris."],
          ],
        },
        {
          jenis: "layar",
          nama: "Kejuaraan",
          hash: "#/kejuaraan",
          fitur: "live_score",
          teks: "Daftar juara per golongan beserta skornya, dan lembar cetaknya. Isinya baru terbaca sesudah fase juara dinyalakan.",
        },
        {
          jenis: "kenapa",
          teks: "Foto lembar jawaban BUKAN pekerjaan seksi ini. Ia bukti nilai, difoto juri lewat layar Foto Jawaban Sekaligus supaya tersimpan bersama nomor dada dan kode lombanya. Lembar jawaban yang masuk ke HP dokumentasi tidak pernah bisa dipakai waktu satu nilai dipersoalkan.",
        },
      ],
    },

    {
      kode: "seksi-logistik",
      judul: "Akomodasi dan Logistik",
      singkat: "Logistik",
      rona: "nila",
      isi: [
        {
          jenis: "p",
          teks: "Semua benda yang harus ada di tempatnya pada pagi hari-H: barak, tenda, alat tiap lomba, nomor dada kain, tiska, blangko yang sudah digandakan, piala, dan rambu rute. Tiga angka kerjanya diambil dari sistem, jadi ia menunggu hitungan regu terakhir dari Sekretariat.",
        },
        {
          jenis: "poin",
          butir: [
            "Mengurus izin dan pembagian ruang barak, memisahkan putra dan putri, dan menempel denahnya.",
            "Menyediakan alat tiap lomba sesuai daftar Koordinator Lapangan, beserta cadangannya.",
            "Menyiapkan nomor dada kain dua deret sesuai stok yang dipasang di sistem: Eksternal polos, Internal disablon 1001 ke atas dan bukan 001.",
            "Menyiapkan tiska sejumlah PESERTA beserta cadangan, dan menyerahkannya ke meja daftar ulang, bukan ke garis finish. Tiska bukti keikutsertaan, jadi hitungannya per kepala, bukan per regu.",
            "Menggandakan blangko di mesin fotokopi. Yang dicetak dari layar cuma satu master per lomba, bukan setumpuk.",
            "Menyiapkan piala dan hadiah, dan memastikan namanya sesuai kategori juara.",
            "Memasang rambu penunjuk arah sehari sebelum acara, sore hari, jangan lebih awal.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Sprint 4", "Izin pemakaian gedung dan lahan barak."],
            ["Sprint 7 sampai 9", "Alat praktik tiap lomba, nomor dada kain, tiska, piala."],
            ["Sprint 11 sampai 12", "Menggandakan blangko, menyiapkan barak, memasang rambu sore H-1."],
            ["Sesudah acara", "Mengembalikan barang pinjaman dan membereskan lahan."],
          ],
        },
        {
          jenis: "kenapa",
          teks: "Blangko digandakan di mesin fotokopi, bukan dicetak satu per satu dari browser. Satu pos dengan tiga lomba mencetak tiga halaman master; mencetak setumpuknya menghabiskan satu toner kantor untuk pekerjaan yang selesai dalam hitungan menit di tukang fotokopi.",
        },
      ],
    },

    {
      kode: "seksi-keamanan",
      judul: "Keamanan",
      singkat: "Keamanan",
      rona: "abu",
      isi: [
        {
          jenis: "p",
          teks: "Menjaga bahwa 2.500 orang bergerak di jalur desa tanpa kecelakaan dan tanpa mengganggu warga. Pekerjaannya dimulai jauh sebelum hari-H, di meja Polsek dan Satlantas.",
        },
        {
          jenis: "poin",
          butir: [
            "Mengurus izin keramaian ke Polsek bersama Sekretaris, dan koordinasi lalu lintas ke Satlantas.",
            "Menjaga titik rawan yang ditandai Survey: penyeberangan jalan raya, turunan licin, jembatan sempit.",
            "Menjaga barak pada malam sebelum acara, dan menjaga barang peserta selama mereka di rute.",
            "Menyusuri jalur mencari regu yang jauh melewati kontrak waktunya, bersama Kesehatan, dengan pembagian yang tertulis.",
            "Mengatur parkir bus dan kendaraan pengantar pada pagi hari-H.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Sprint 8", "Izin keramaian Polsek dan koordinasi Satlantas."],
            ["Sprint 12", "Menjaga barak pada malam sebelum acara."],
            ["Hari lomba pagi", "Mengatur parkir dan penyeberangan pada jam keberangkatan."],
            ["Hari lomba siang", "Menjaga titik rawan dan menyusuri jalur bersama Kesehatan."],
          ],
        },
        {
          jenis: "kenapa",
          teks: "Daftar regu yang belum sampai finish hanya ada di layar Kedatangan, dan yang memegangnya Seksi Acara. Minta daftar itu berkala sejak jam dua belas, jangan menunggu sampai ada yang melapor kehilangan regu.",
        },
      ],
    },

    {
      kode: "seksi-konsumsi",
      judul: "Konsumsi",
      singkat: "Konsumsi",
      rona: "tanah",
      isi: [
        {
          jenis: "p",
          teks: "Makan panitia, juri, dan tamu, serta air minum di titik rute. Peserta membawa bekal sendiri, jadi yang dihitung seksi ini jumlah panitia dan juri, bukan jumlah peserta.",
        },
        {
          jenis: "poin",
          butir: [
            "Menghitung porsi dari jumlah panitia, juri, dan tamu yang sudah pasti, ditambah cadangan.",
            "Menyediakan minum di pos dan di titik rute yang jauh dari sumber air.",
            "Mengatur giliran makan panitia supaya tidak ada meja yang kosong bersamaan.",
            "Menyediakan konsumsi tamu undangan dan pejabat pemberangkat pada pagi upacara.",
            "Menyediakan makan malam panitia pada malam persiapan sebelum hari-H.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Sprint 10", "Memesan katering atau menyusun rencana masak sendiri."],
            ["Sprint 11", "Menerima hitungan panitia dan juri terakhir, mengunci jumlah porsi."],
            ["Sprint 12", "Makan malam panitia pada malam persiapan."],
            ["Hari lomba", "Giliran makan panitia, konsumsi tamu, air minum di titik rute."],
          ],
        },
        {
          jenis: "kenapa",
          teks: "Giliran makan yang tidak diatur membuat tiga meja kosong bersamaan tepat pada jam tersibuk. Susun gilirannya bersama Seksi Acara dan Koordinator Lapangan, bukan sendiri.",
        },
      ],
    },

    {
      kode: "seksi-kesehatan",
      judul: "Kesehatan",
      singkat: "Kesehatan",
      rona: "koral",
      isi: [
        {
          jenis: "p",
          teks: "Tim medis: titik tetap dekat garis finish, tim berjalan di antara pos, dan jalur rujukan ke puskesmas atau rumah sakit terdekat yang sudah disepakati sebelum hari-H.",
        },
        {
          jenis: "poin",
          butir: [
            "Menyiapkan obat, perban, dan tandu, serta memeriksa masa berlakunya.",
            "Menghubungi puskesmas atau klinik terdekat dan menyepakati jalur rujukan sebelum hari-H.",
            "Menempatkan titik P3K tetap di dekat garis finish dan di pos yang paling jauh.",
            "Menjalankan tim berjalan di antara pos, dengan pembagian jalur yang tertulis bersama Keamanan.",
            "Mencatat tiap penanganan: siapa, dari regu mana, apa keluhannya, dan tindakannya.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Sprint 9", "Menyiapkan obat dan menghubungi tim medis pendamping."],
            ["Sprint 11", "Menyepakati jalur rujukan dengan puskesmas atau klinik terdekat."],
            ["Hari lomba", "Titik P3K di finish, tim berjalan di antara pos, penanganan dicatat."],
          ],
        },
        {
          jenis: "kenapa",
          teks: "Pos 3 bernama Pembidaian dan lombanya memang P3K, jadi nama itu terpakai dua kali di lapangan. Sebut tim medis dengan nama seksinya di HT supaya panggilan darurat tidak nyasar ke pos penilaian.",
        },
      ],
    },

    {
      kode: "seksi-survey",
      judul: "Survey",
      singkat: "Survey",
      rona: "batu",
      isi: [
        {
          jenis: "p",
          teks: "Menyusuri dan mengunci rute: jarak antar pos, titik tiap pos, titik rawan, dan berapa lama regu berjalan dari satu pos ke pos berikutnya. Hasil kerjanya masuk ke sistem lewat orang lain, jadi ia harus menyerahkannya cukup awal.",
        },
        {
          jenis: "poin",
          butir: [
            "Menyusuri rute berkali-kali, dan memfoto tiap persimpangan yang bisa membingungkan.",
            "Menetapkan titik kelima pos beserta lahannya, lalu menyerahkan daftarnya ke Humas untuk diurus izinnya.",
            "Mengukur waktu tempuh sungguhan antar pos dengan berjalan, bukan dengan memperkirakan dari peta.",
            "Menandai titik rawan dan menyerahkannya ke Keamanan dan Kesehatan.",
            "Menyusuri ulang rute menjelang hari-H mencari perubahan: panen, penutupan jalan, longsor.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Sprint 3 sampai 4", "Survei rute pertama dan kedua, foto tiap persimpangan."],
            ["Sprint 5", "Rute final dikunci beserta titik kelima pos."],
            ["Sprint 7", "Uji jalan dengan waktu tempuh sungguhan."],
            ["Sprint 12", "Susur ulang menjelang hari-H mencari perubahan di lapangan."],
          ],
        },
        {
          jenis: "kenapa",
          teks: "Waktu tempuh antar pos yang diperkirakan dari peta selalu terlalu cepat, dan kontrak waktu disusun di atasnya. Kontrak yang terlalu ketat membuat seluruh regu terkena penalti walaupun tidak ada yang berjalan lambat.",
        },
      ],
    },

    {
      kode: "seksi-strategi-untung",
      judul: "Strategi mendatangkan untung: merchandise",
      bukanSeksi: true,
      isi: [
        {
          jenis: "p",
          teks: "Bagian ini milik bersama Dana Usaha, Sponsorship, dan Bendahara. Untung HRCD datang dari tiga arah: uang masuk di luar pendaftaran, uang orang lain yang menggantikan belanja kita, dan uang yang batal keluar. Yang ketiga paling sering dilupakan padahal paling mudah didapat. Satu dus air minum yang disponsori bernilai persis sama dengan satu dus air minum yang terjual.",
        },
        {
          jenis: "p",
          teks: "Syarat pertamanya sudah dikunci sejak Sprint 2: titik impas dihitung dari uang pendaftaran SAJA. Artinya seluruh isi bagian ini adalah untung, bukan penambal lubang, dan acara tetap jalan kalau sponsor nol. Rencana yang membuat acara batal ketika targetnya meleset bukan strategi, itu taruhan.",
        },
        {
          jenis: "p",
          teks: "Merchandise adalah satu-satunya jalur untung yang angkanya bisa direncanakan jauh hari, dan satu-satunya yang bisa berbalik jadi rugi kalau urutannya salah.",
        },
        {
          jenis: "poin",
          butir: [
            "Begitu daftarnya siap, buka pre-order SAAT ITU JUGA lewat pembina, jangan menunggu posternya jadi. Satu pembina memesan untuk sepuluh regu sekaligus; eceran satu per satu ke peserta tidak akan pernah mengejar angka itu.",
            "Produksi sejumlah yang SUDAH DIBAYAR, ditambah cadangan kecil untuk bazar. Stok yang dicetak dari perkiraan berakhir jadi kardus di sekretariat, dan kardus itu kerugian yang sudah dibayar di muka.",
            "Hitung harga jual dari biaya satuan pada jumlah yang PASTI terjual, bukan pada jumlah yang diharapkan. Sablon murah per lusin dan mahal per lima potong, jadi harga yang disusun dari harga lusinan lalu laku lima potong menjual barang di bawah modal.",
            "Tutup pre-order di Sprint 9. Barang yang jadi sesudah hari-H tidak bisa dijual ke siapa pun lagi, pembelinya sudah pulang.",
            "Uangnya ditransfer TERPISAH dari uang pendaftaran. Kalau digabung, nominal yang masuk tidak cocok dengan tagihan regunya dan batch itu ditolak di Meja Pembayaran sebagai salah nominal. Penjualan kaos berubah jadi keluhan, dan verifikasi pembayaran satu sekolah mundur sehari.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Yang membuat merchandise rugi hampir tidak pernah barangnya tidak laku, melainkan urutannya terbalik: dicetak lebih dulu, ditawarkan belakangan. Pre-order membalik urutan itu, dan itulah satu-satunya alasan seksi sekolah boleh berjualan barang sama sekali.",
        },
      ],
    },

    {
      kode: "seksi-strategi-lapangan",
      judul: "Strategi mendatangkan untung: bazar dan belanja yang batal keluar",
      bukanSeksi: true,
      isi: [
        {
          jenis: "p",
          teks: "Hari lomba adalah hari dengan orang paling banyak dan waktu paling sedikit. Yang menentukan hasil bazar cuma dua hal: tempatnya dan jamnya.",
        },
        {
          jenis: "poin",
          butir: [
            "Berjualan di tempat orang MENUNGGU, bukan di tempat orang lewat. Barak pada malam H-1 dan garis finish sepanjang siang; regu yang sudah masuk finish menunggu berjam-jam sampai kloter terakhir datang.",
            "Yang paling laku di dua titik itu minuman dingin dan makanan ringan, bukan kenang-kenangan. Merchandise dijual malam sebelumnya di barak, saat orangnya belum lelah dan uangnya belum habis.",
            "Kembalian habis lebih cepat daripada barang. Minta uang kecil ke Bendahara sebelum stan dibuka, dan setorkan hasilnya berkala, bukan sekaligus tengah malam.",
            "Satu orang menjaga uang dan satu orang melayani. Stan yang dijaga satu orang berhenti tiap kali penjaganya dipanggil, dan selisih kasnya tidak bisa ditelusuri ke siapa pun.",
          ],
        },
        {
          jenis: "p",
          teks: "Arah ketiga tidak pernah tampil sebagai pemasukan di buku kas, padahal nilainya sama besar: belanja yang batal keluar.",
        },
        {
          jenis: "poin",
          butir: [
            "Minta sponsor dalam bentuk BARANG untuk pos belanja yang memang sudah ada di anggaran, seperti air minum, konsumsi juri, hadiah, spanduk, dan obat. Toko jauh lebih mudah memberi barang daripada uang tunai, dan nilainya sama di laporan.",
            "Pinjam sebelum membeli. Tenda, HT, sound system, dan alat lomba hampir selalu ada di gugus depan lain, sekolah tetangga, atau alumni. Kembalikan dengan berita acara supaya pintunya masih terbuka tahun depan.",
            "Cetak sekali, fotokopi sisanya. Blangko dan daftar kloter memang dirancang untuk itu. Mencetak ribuan lembar dari printer sekolah menghabiskan satu toner untuk pekerjaan yang selesai dalam hitungan menit di mesin fotokopi.",
            "Pesan nomor dada kain dan hadiah SESUDAH pendaftaran ditutup, kecuali cadangan sepuluh persen. Yang dipesan dari proyeksi selalu lebih banyak daripada yang dipakai.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Sprint 2", "Target rupiah Dana Usaha dan titik impas dari uang pendaftaran saja."],
            ["Sprint 3", "Daftar merchandise disusun, pre-order dibuka lewat pembina."],
            ["Sprint 3 sampai 8", "Jualan berkala, proposal sponsor, permintaan barang dan pinjaman alat."],
            ["Sprint 9", "Pre-order dan penerimaan sponsor DITUTUP, produksi dimulai."],
            ["Malam H-1", "Merchandise dijual di barak, sekalian saat pembina mengambil nomor dada."],
            ["Hari lomba", "Bazar di barak dan garis finish, setoran berkala ke Bendahara."],
            ["Sesudah acara", "Sisa stok dihabiskan di sekolah sendiri, jangan disimpan sampai edisi berikutnya."],
          ],
        },
        {
          jenis: "kenapa",
          teks: "Untung yang tidak tercatat bukan untung. Dana usaha, bazar, merchandise, dan sponsor barang semuanya berjalan di luar sistem, karena yang dicatat sistem cuma pembayaran pendaftaran. Satu buku Bendahara adalah satu-satunya tempat angkanya bertemu, dan yang tidak masuk buku itu hilang di LPJ.",
        },
      ],
    },
  ],
};
const BAB_KENAPA = {
  kode: "kenapa",
  judul: "Kenapa Sistemnya Begini",
  tab: "Kenapa",
  ikon: "file-text",
  warna: "ungu",
  ringkas: "Dua puluh lima keputusan yang membentuk sistem ini, alternatif yang ditolak, dan apa yang rusak kalau dibalik.",
  bagian: [
    {
      kode: "kenapa-biaya-nol",
      judul: "Biaya Rp 0 mutlak, tanpa kartu kredit di mana pun",
      isi: [
        {
          jenis: "p",
          teks: "Seluruh sistem ini harus berjalan tanpa satu rupiah pun tagihan dan tanpa nomor kartu tersimpan di layanan mana pun. Ini bukan penghematan, ini syarat kelangsungan: kepanitiaan berganti tiap tahun dan tidak ada seorang pun yang bisa jadi pemegang tagihan lintas generasi. Hampir semua keputusan lain di bab ini adalah akibat dari batas ini.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak free trial dan tier berbayar-kecil. Trial bukan gratis, ia cuma menunda tanggal tagihannya sampai sesudah kepanitiaan bubar.",
            "Ditolak layanan apa pun yang minta kartu hanya untuk verifikasi. Kartu yang terpasang adalah kartu pribadi seseorang, dan orang itu lulus sekolah.",
            "Inilah yang menggugurkan Firebase: Cloud Storage-nya menuntut paket Blaze sejak Oktober 2025, bahkan untuk project lama, jadi foto bukti transfer tidak akan pernah bisa disimpan di sana.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Kalau batas ini dilonggarkan, tagihan kejutan jatuh ke rekening pribadi pengurus lama. Kuota yang habis juga mematikan SEMUA workflow, termasuk apply-migration dan tombol ganti password yang dipakai panitia dari HP.",
        },
      ],
    },
    {
      kode: "kenapa-februari-maret",
      judul: "Menetapkan tanggal adalah tugas utama, dan bulannya Februari atau Maret",
      isi: [
        {
          jenis: "p",
          teks: "Dari seluruh papan sprint, satu tugas yang tidak boleh mundur: menetapkan tanggal. Logo, surat, susunan acara, lapangan, dan hadiah boleh menyusul, karena semuanya masih bisa dikejar. Tanggal tidak bisa dikejar, karena yang menunggunya bukan panitia melainkan peserta.",
        },
        {
          jenis: "p",
          teks: "Tanggal lomba ditetapkan di Sprint 2, sekitar lima bulan sebelum harinya, bersama kepala sekolah dan pembina lalu ditulis di notulen. Bulan yang dianjurkan Februari atau Maret. Dua-duanya keputusan yang saling mengunci: tanggal yang jatuh di Februari berarti hitungan mundurnya dimulai September, dan itulah kenapa papan sprint di buku ini berbentuk seperti sekarang.",
        },
        {
          jenis: "poin",
          butir: [
            "Lomba tidak bisa mendadak. Regu berlatih, sekolah mengurus izin dan biaya, dan pembina menyusun jadwalnya sendiri. Semua itu berangkat dari tanggal, bukan dari pengumuman sebulan sebelumnya.",
            "Pertanyaannya selalu datang lebih dulu. Tiap tahun ada pembina dan peserta yang menanyakan kapan HRCD berikutnya digelar, kadang sebelum panitianya sendiri terbentuk. Tanggal adalah satu-satunya jawaban yang mereka butuhkan saat itu.",
            "Ditolak Agustus. Sekolah, desa, dan kwartir sama-sama penuh acara Agustusan, jadi panitia, lahan, dan izin keramaian semuanya berebut dengan lomba yang sudah ada lebih dulu. Peserta pun begitu: sekolah yang diundang sedang menyiapkan acaranya sendiri.",
            "Februari dan Maret memberi Kelas X tempat. Mereka sudah masuk sejak Juli, sudah kenal ambalan, dan sudah bisa dipercaya memegang pekerjaan sungguhan. Digelar lebih awal, mereka baru penonton.",
            "Itu sekaligus kaderisasi, bukan cuma tambahan tenaga. Yang jadi panitia sebagai Kelas X adalah yang memimpin edisi berikutnya, dan mereka sudah pernah melihat seluruh alurnya sekali.",
            "Tanggalnya tetap harus dikunci lima bulan di depan. Antrean izin keramaian tidak bisa dipercepat dengan cara apa pun, dan tiap minggu tanggal belum pasti adalah satu minggu yang hilang dari antrean itu.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Kalau lombanya digeser ke Agustus, panitia inti mengerjakan dua acara sekaligus dan Kelas X kehilangan satu-satunya edisi yang bisa mereka ikuti sebelum memimpinnya. Kalau tanggalnya dibiarkan menggantung sampai Oktober, yang hilang bukan waktu persiapan panitia melainkan tempat di antrean izin, dan waktu latihan peserta yang tidak pernah bisa diganti.",
        },
      ],
    },
    {
      kode: "kenapa-supabase",
      judul: "Supabase, bukan Sheets, Firebase, atau laptop panitia",
      isi: [
        {
          jenis: "p",
          teks: "Empat kandidat dibandingkan sebelum satu dipilih. Yang menang Supabase. Tiga hal yang paling berbahaya kalau salah — nomor dada ganda, isolasi pos, riwayat perubahan — dijamin platformnya sendiri lewat transaksi, RLS, dan trigger. Bukan oleh kehati-hatian orang yang sedang berdiri di meja dengan antrean di depannya.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak Google Sheets plus Apps Script: batas 30 eksekusi bersamaan dibagi ke SEMUA perangkat, dan tiap aksi berjeda 1 sampai 4 detik. Sepuluh meja bekerja bersamaan sudah menghabiskannya.",
            "Ditolak Firebase paket Spark: kuota 50.000 baca per hari tersentuh oleh belasan penonton yang refresh. Kalau habis, database mati baca sampai jam 15:00 WIB, persis di tengah penilaian.",
            "Ditolak PocketBase di laptop panitia lewat Tunnel: memindahkan seluruh risiko ke satu hardware pelajar di hari paling sibuk. Laptop ditutup, acara berhenti.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Kalau dibalik, kebenaran data kembali bergantung pada disiplin manusia, dan hari-H punya tebing kuota atau tutup-laptop sebagai mode gagalnya.",
        },
      ],
    },
    {
      kode: "kenapa-cloudflare",
      judul: "Cloudflare tanpa server aplikasi, dan dua situs terpisah",
      isi: [
        {
          jenis: "p",
          teks: "Halaman peserta dan layar panitia dua-duanya file statis yang disajikan Cloudflare, dari DUA situs yang berbeda: alamat pendek untuk peserta, alamat berawalan panitia- untuk panitia. Tidak ada backend dan tidak ada lapisan API buatan sendiri; yang bicara ke database adalah browser, langsung, dijaga RLS dan RPC. Satu-satunya kode server di seluruh sistem adalah Worker kecil untuk form pendaftaran publik.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak Vercel paket Hobby dengan 100 GB per bulan. Ratusan HP peserta yang refresh rekap adalah lalu lintas yang tidak bisa diramalkan, dan hanya Cloudflare menjawabnya dengan tak terbatas alih-alih angka bulanan.",
            "Ditolak backend sendiri: tiap pagar hak akses harus ditulis dua kali, sekali di server dan sekali di database, lalu keduanya dijaga tetap sama selamanya.",
            "Ditolak satu situs berisi halaman peserta dan layar panitia berdampingan. Yang disebar ke ratusan orang lewat grup WA sekolah adalah alamat peserta, dan alamat itu tidak boleh sekaligus membawa pintu masuk panitia.",
            "Bebannya juga terpisah: ratusan HP yang refresh papan tidak menyentuh Worker yang sedang dipakai meja bekerja, dan halaman peserta tidak memuat kunci apa pun selain anon key.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Kalau digabung, alamat yang diteruskan ke ratusan orang sekaligus menyebarkan pintu masuk panitia. Dan beban ratusan HP yang refresh papan jatuh ke Worker yang sama dengan yang dipakai meja bekerja.",
        },
      ],
    },
    {
      kode: "kenapa-berkas-statis",
      judul: "Peserta membaca file statis, dan situsnya sengaja tidak tersambung Git",
      isi: [
        {
          jenis: "p",
          teks: "Seluruh data peserta dan nilai datang dari dua file yang diterbitkan workflow. Yang pertama live.json, sekitar 1 KB, di-poll tiap 60 detik. Yang kedua rekap.json, puluhan KB, diambil sekali per versi — itu pun baru setelah peserta mengetik nama sekolahnya. Versi itu sidik jari ISI, jadi menerbitkan sepuluh kali tanpa nilai baru tidak membuat satu HP pun download ulang. Satu-satunya permintaan langsung dari HP peserta ke database adalah membaca saklar fase, v_fase_live, tiap 15 detik selama halamannya terlihat — satu nilai, bukan satu baris rekap pun.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak halaman peserta yang menarik seluruh rekap langsung dari Supabase. Pesertanya 1.500 sampai 3.000 orang, dan mereka membuka alamat yang sama berkali-kali dalam jendela waktu yang sama persis.",
            "Ditolak Realtime: koneksi terbuka per HP untuk data yang sebagian besar waktu tidak berubah sama sekali. Polling yang ada pun berhenti begitu tab tidak terlihat, dan jalan lagi begitu HP dibuka.",
            "Ditolak menyambungkan situs peserta ke Git seperti layar panitia. Yang di-deploy ke sana bukan isi repository melainkan live.json yang baru ditulis workflow dari database beberapa detik sebelumnya.",
            "Kalau tersambung Git, tiap push ke main menimpanya dengan file contoh fase pra yang memang ada di repository. Rekap peserta mendadak kosong tanpa satu langkah pun yang gagal.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Kalau dibalik, tiga ribu HP menarik file gemuk tiap menit langsung dari database. Dan papan peserta bisa dikosongkan di tengah acara oleh perbaikan warna tombol yang sama sekali tidak berhubungan.",
        },
      ],
    },
    {
      kode: "kenapa-fase-live",
      judul: "Kejutan dijaga database, bukan tampilan",
      isi: [
        {
          jenis: "p",
          teks: "Ada lima fase live: pra, progres, penuh, top10, dan juara. Yang menahan nilai sebelum diumumkan bukan JavaScript yang menyembunyikan angka, melainkan view yang mengembalikan NOL BARIS. Selama fasenya masih progres, v_klasemen_publik mengembalikan nol baris dan v_progres_publik tidak punya satu pun kolom berisi angka nilai — jadi file yang terbit memang tidak memuatnya.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak menerbitkan semua nilai lalu menyembunyikannya dengan CSS atau JS: rekap.json duduk di CDN dan bisa diminta siapa pun yang tahu alamatnya, tanpa membuka halamannya.",
            "Ditolak daftar larangan kolom di penerbitan. Yang dipakai DAFTAR IZIN: kolom yang tidak dikenal menghentikan penerbitan, karena hasil_kejuaraan duduk di atas tabel pendaftaran yang memuat nomor WA pembina.",
            "publish-live.yml memegang sembilan pagar BOCOR, dan tidak satu pun boleh dilonggarkan demi kenyamanan tampilan.",
          ],
        },
        {
          jenis: "p",
          teks: "Satu akibat yang harus diketahui panitia: menurunkan saklar dari Juara kembali ke Live tidak mengembalikan papan. File fase juara memang tidak memuat satu baris klasemen pun, dan halaman peserta dilarang menampilkan lebih banyak daripada isi filenya. Urutan kerjanya nyalakan fasenya dulu, terbitkan sesudahnya, dan itu berlaku ke dua arah.",
        },
        {
          jenis: "layar",
          nama: "Live Score",
          hash: "#/live-score",
          fitur: "live_score",
          teks: "Saklar fase live ada di sini, dan hanya pemegang pengaturan yang bisa menggesernya.",
        },
        {
          jenis: "kenapa",
          teks: "Kalau kejutan dijaga tampilan, juara bocor lewat alamat file sebelum dibacakan di lapangan, dan tidak ada satu galat pun yang muncul untuk memberi tahu.",
        },
      ],
    },
    {
      kode: "kenapa-tanpa-build",
      judul: "Tanpa build step; HTML dan JS polos",
      isi: [
        {
          jenis: "p",
          teks: "Tidak ada React, tidak ada bundler, tidak ada npm install sebelum apa pun bisa dijalankan. File di web/ disajikan apa adanya, dan merge sama dengan deploy. Alasannya satu dan tidak bisa ditawar: pemeliharanya pelajar SMA yang belajar sambil jalan, dan sebagian baru pertama kali membuka editor.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak framework plus bundler: seorang pelajar harus paham toolchain sebelum bisa membetulkan satu label yang salah ketik.",
            "Ditolak juga karena waktu. Perbaikan mendadak jam enam pagi hari-H tidak boleh menunggu proses build yang bisa gagal karena hal yang tidak berhubungan.",
            "Harganya dibayar sadar: file bersama seperti api.js, util.js, style.css, dan config.js harus DISALIN ke situs peserta, dan shared-files.yml yang menjaga salinannya tidak membusuk. web/ selalu acuannya.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Kalau dibalik, pemelihara berikutnya berhenti di langkah nol, dan sistem ini mati bukan karena rusak melainkan karena tidak ada yang bisa membukanya.",
        },
      ],
    },
    {
      kode: "kenapa-skor-mentah",
      judul: "Skor tidak pernah disimpan, dan yang dicatat nilai mentah",
      isi: [
        {
          jenis: "p",
          teks: "Tidak ada kolom total di mana pun. Klasemen adalah rantai view: v_poin_wahana menghitung poin tiap penilaian, v_poin_pos menjumlahkannya per pos, v_total_skor menjumlahkan seluruh pos, v_klasemen mengurutkannya. Dan yang masuk ke rantai itu adalah apa yang dilihat juri — berapa detik, berapa jawaban benar, berapa angka kriteria — bukan poin yang sudah dihitung orang.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak kolom total tersimpan plus tombol hitung ulang: koreksi yang datang di menit terakhir menuntut seseorang ingat menekan tombolnya, dan papan mengumumkan juara dari angka lama.",
            "Ditolak juri menghitung poin di kepala atau di kertas. Blangko cetak sengaja TIDAK punya kolom Nilai Pos: juri hanya menulis data mentah, dan skornya tetap dihitung database.",
            "Ditolak layar menghitung poin di browser. Layar Input Nilai Tabel selalu membaca ulang angkanya dari v_lembar_pos tiap kali satu baris tersimpan. Menghitung di browser melahirkan mesin skor kedua, yang suatu hari berbeda pendapat dengan v_poin_pos.",
            "cache_live_score dari migration 0146 murni soal kecepatan. Menghapusnya tidak menghilangkan satu nilai pun, karena ia bukan sumber angkanya.",
          ],
        },
        {
          jenis: "layar",
          nama: "Input Nilai Tabel",
          hash: "#/pos",
          fitur: "pos",
          teks: "Lembar satu pos, satu baris per regu. Nama dan urutan kolomnya dibangun dari baris wahana, bukan ditulis di kode.",
        },
        {
          jenis: "kenapa",
          teks: "Kalau skor disimpan atau dihitung di dua tempat, akan ada dua angka untuk satu regu. Suatu hari keduanya berbeda pendapat, biasanya di panggung, saat juara dibacakan.",
        },
      ],
    },
    {
      kode: "kenapa-aturan-data",
      judul: "Aturan penilaian adalah data, bukan kode",
      isi: [
        {
          jenis: "p",
          teks: "Aturan skor berganti hampir tiap tahun. Karena itu tiap kolom penilaian adalah satu baris di tabel wahana, dengan enam bentuk konversi yang bisa dipilih. Layar Input Nilai Tabel membangun kolomnya dari baris-baris itu: nama, urutan, bentuk kotak, dan rentang yang boleh diketik, semuanya dari wahana. Jadi mengganti penilaian tahun depan tidak menyentuh satu baris kode pun.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak rumus dan bobot ditulis di kode aplikasi: panitia tahun depan harus mencari programmer untuk mengganti bobot satu lomba.",
            "Ditolak menghitung bobot pos dari CACAH lomba. Bobot pos adalah jumlah poin_maks seluruh wahana-nya. Memecah KIM jadi Kim Lihat dan Kim Cium di migration 0087 tidak mengubah satu poin pun. Sebaliknya, memindah satu lomba antar pos mengubah bobot dua pos tanpa satu angka diedit.",
            "Salah baca yang paling sering: angka 0 sampai 10 di KIM itu RENTANG MENTAH, bukan bobot. Dibaca sebagai bobot, Pos 3 terlihat 220 padahal 400, dan KIM mulai terlihat seperti lomba yang perlu dinaikkan.",
            "Lomba berbentuk soal cukup satu angka: berapa jawaban benar. Rentang mentahnya harus sama dengan jumlah soalnya, karena rentang yang lebih longgar membiarkan petugas mengetik 12 dari 10.",
          ],
        },
        {
          jenis: "p",
          teks: "Contoh lomba berbentuk soal: Logika 20 soal dengan poin maksimal 100. Regu benar 13, poinnya 13 dibagi 20 dikali 100, jadi 65. Yang diketik petugas cuma angka 13.",
        },
        {
          jenis: "kenapa",
          teks: "Kalau aturan dipindah ke kode, panitia kehilangan kendali atas acaranya sendiri dan harus menunggu orang yang bisa menyentuh kode.",
        },
      ],
    },
    {
      kode: "kenapa-tanpa-undian",
      judul: "Nomor dada tidak diundi di technical meeting",
      isi: [
        {
          jenis: "p",
          teks: "Di banyak lomba nomor peserta diundi di depan semua orang saat technical meeting. Di sini tidak. Nomor dada diketik petugas dari kain yang sudah dipegang, di meja daftar ulang, satu regu sekali sebut. Sebabnya bukan malas seremoni: undian menghabiskan berjam-jam untuk membagikan angka yang tidak menentukan apa pun.",
        },
        {
          jenis: "poin",
          butir: [
            "Nomor dada TIDAK menentukan kloter. Kloter jatuh FIFO dari urutan daftar ulang, bukan dari besar kecilnya angka. Nomor 7 dan nomor 412 punya peluang persis sama untuk berangkat paling pagi.",
            "Nomor dada juga tidak menentukan urutan pos, lawan, atau apa pun yang bisa menguntungkan. Jadi yang diadili adil lewat undian sebenarnya cuma angka di kain, dan di situ tidak ada yang perlu diadili.",
            "Hitung waktunya sebelum menjadwalkannya: deret Eksternal saja menyediakan 500 nomor dan acuan kami sekitar 300 regu. Sepuluh detik per regu sudah lima puluh menit, dan tidak ada undian sungguhan yang selesai dalam sepuluh detik per regu.",
            "Yang hadir di technical meeting pembina, bukan seluruh regu, dan yang tidak hadir tetap terikat hasilnya. Nomor untuk regu yang wakilnya tidak datang harus dibagikan lagi di meja daftar ulang, jadi mejanya tetap dibutuhkan dan undiannya jadi pekerjaan kedua. Padahal keduanya digelar hari yang sama, H-1, di tempat yang sama.",
            "Undian melahirkan daftar pasangan nomor dan regu yang masih harus dicocokkan ke kain fisik belakangan. Celah itu yang ditutup dengan mengetik angka dari kain yang sedang dipegang. Yang tertulis di kain dan yang tersimpan di sistem tidak pernah lahir dari dua sumber berbeda.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Technical meeting punya agenda yang tidak bisa diwakilkan: rute, kontrak waktu, cara menilai, barang bawaan, aturan barak, sanksi, jam kloter, dan tata cara protes. Satu jam yang dipakai membacakan angka diambil dari situ, dan yang biasanya terpotong bagian sanksi dan protes, dua hal yang paling mahal kalau tidak disepakati di depan.",
        },
      ],
    },
    {
      kode: "kenapa-nomor-dada",
      judul: "Nomor dada diketik petugas, bukan diterbitkan sistem",
      isi: [
        {
          jenis: "p",
          teks: "Sistem tidak memberi nomor. Petugas mengetik nomor yang ADA DI TANGANNYA, karena nomor dada itu benda fisik berupa kain di atas meja, dan tumpukan kain tidak selalu urut. Migration 0011 yang memutuskan ini sesudah versi awal memaksa nomor terkecil yang tersedia.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak sistem memberi nomor terkecil yang tersedia: petugas jadi harus mencari kain nomor tertentu di tumpukan, sementara antrean berdiri di depannya.",
            "Sejak migration 0116 ada dua deret dari satu kunci yang sama: Eksternal 1 sampai 500, Internal 1001 sampai 1250.",
            "Deret Internal itu keputusan pemilik acara, 27 Agustus 2026, dan ia menutup jalur sistemnya saja. Jalur kertasnya ikut menuntut. Kain Internal harus ditandai 1xxx, karena juri menyalin nomor dari kain di dada regu. Kain polos bertulis 001 menghasilkan blangko ambigu, dan itu tidak bisa dipulihkan satu baris SQL pun.",
            "Efek sampingnya menjatuhkan satu bug tidur: pemformat tiga digit memotong 1001 jadi 100. Diperbaiki di migration 0117.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Kalau sistem dan kain menyebut angka yang berbeda, tiap juri melakukan terjemahan di kepala sepanjang hari, dan satu kali salah terjemah tidak bisa ditemukan lagi.",
        },
      ],
    },
    {
      kode: "kenapa-advisory-lock",
      judul: "Satu gerbang untuk seluruh daftar ulang",
      isi: [
        {
          jenis: "p",
          teks: "Pemberian nomor dada dan penempatan kloter dilewatkan lewat SATU advisory lock yang dipegang selama seluruh urusan itu berlangsung. Terdengar kasar dibanding pola kunci-baris yang pintar, dan justru itu yang membuatnya benar.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak pola kunci baris yang dipakai migration 0004. Versi itu mengunci baris di nomor_dada_stok, tapi memutuskan nomor sudah terpakai atau belum dari tabel LAIN, regu.nomor_dada. Mengunci tabel A untuk memutuskan tabel B. Pada 30 meja serentak, dua transaksi bisa sama-sama menganggap nomor yang sama masih kosong.",
            "Perbaikannya menyederhanakan, bukan menambah kepintaran. Dengan satu gerbang di awal, pola SKIP LOCKED tidak diperlukan lagi sama sekali — dan penerus tidak perlu menalar kunci lintas tabel untuk membaca fungsinya.",
            "Terukur, bukan diyakini. Diuji dengan 30 koneksi serentak memperebutkan 300 nomor dada: versi lama gagal di 1 sampai 3 meja tiap putaran, 290 dari 300 regu berhasil. Sesudah migration 0007 memakai satu gerbang, lima putaran berturut-turut memberi 300 dari 300 regu bernomor, nol error, nol duplikat, selesai dalam 1,65 detik.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Kunci UNIQUE pada nomor dada memang menahan datanya, tapi cuma datanya. Di meja, yang terlihat satu sekolah gagal daftar ulang dengan pesan error teknis, di depan antrean.",
        },
      ],
    },
    {
      kode: "kenapa-kloter",
      judul: "Kloter FIFO berkuota, dan sisipan manual yang berteriak",
      isi: [
        {
          jenis: "p",
          teks: "Pembagian kloter otomatis mengisi kloter paling awal yang belum berangkat, urut siapa yang lebih dulu menyelesaikan daftar ulang. Paling banyak 5 Eksternal dan 3 Internal per kloter, kuotanya dihitung terpisah. Sekolah tidak berpengaruh sama sekali. Tapi kloter yang kertasnya sudah dicetak TETAP boleh ditambah regu secara manual.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak penyebaran per sekolah dan lompatan dua kloter — aturan lama yang dibuang migration 0092 karena tidak ada yang bisa menjelaskannya di lapangan. Aturan sekarang muat dalam satu kalimat ke pembina.",
            "Ditolak membekukan kloter begitu kertasnya dicetak. Pagar itu pernah ada di migration 0008, dikembalikan di 0040, lalu dibuang seluruhnya di 0066. Alasannya: mencetak ulang selembar daftar itu murah, memberangkatkan kloter dengan empat tempat kosong tidak bisa diulang.",
            "Kejadian nyatanya: satu sekolah datang terlambat, daftar ulang sesudah kertas dibagikan, regunya diselipkan. Di garis start kloter memanggil sepuluh nama padahal kertas memuat sembilan. Karena itu sisipan ditandai waktunya dan tampil sebagai kartu merah yang MENETAP.",
            "Pengacakan OTOMATIS tetap melewati kloter yang sudah berangkat, dikembalikan migration 0088. Yang dibuka cuma jalur manual, dan itu keputusan petugas yang sadar.",
          ],
        },
        {
          jenis: "p",
          teks: "Satu akibat wajib diketahui petugas yang menyisipkan. Penalti waktu dihitung dari jam berangkat kloter. Regu yang dimasukkan ke kloter yang sudah jalan dihitung berangkat pada jam kloter itu, bukan jam ia benar-benar jalan. Kalau maksudnya regu itu berangkat sekarang, tempatnya di kloter yang belum jalan. Dan jangan menomori kloter sendiri secara manual: penomoran menyimpan aturan yang tidak kelihatan dari nomornya.",
        },
        {
          jenis: "kenapa",
          teks: "Kalau kloter dibekukan, regu ada di database tapi tidak pernah dipanggil di garis start. Kalau sekolah dijadikan faktor lagi, pertanyaan kenapa regu kami di kloter 30 tidak bisa dijawab siapa pun di lapangan.",
        },
      ],
    },
    {
      kode: "kenapa-ambil-h1",
      judul: "Nomor dada dan tiska diambil H-1, bukan pagi hari-H",
      isi: [
        {
          jenis: "p",
          teks: "Meja daftar ulang buka H-1 pagi dan tutup hari-H pukul 10:00, saat kloter terakhir berangkat. Di situlah pembina mengambil kain nomor dada dan tiska regunya. Dua jalur, dua-duanya sah: H-1 untuk yang bisa datang sejak awal, hari-H untuk yang baru sempat. Tapi yang bisa memilih sebaiknya memilih H-1, dan alasannya bukan kerapian panitia. Nomor dada yang diketik di meja itulah yang MEMBENTUK kloter, dan daftarnya harus sudah tertempel di barak semalam sebelumnya.",
        },
        {
          jenis: "poin",
          butir: [
            "Kloter jatuh saat nomor dada tersimpan, urut FIFO. Regu yang baru mengambil nomornya pagi hari-H baru punya kloter pagi itu juga, sesudah daftarnya dicetak, ditempel, dan dibacakan.",
            "Jendela keberangkatan cuma tiga jam, 07:00 sampai 10:00, dan dibuka upacara dengan tiga kloter sudah siap di Pemberangkatan dan dua staging. Meja daftar ulang berjalan DI DALAM jam yang sama itu, jadi tiap regu yang bisa diselesaikan H-1 adalah satu antrean yang tidak menambahi pagi yang sudah penuh.",
            "Kain yang rusak masih bisa ditukar. Tukar nomor rusak memensiunkan nomor lama permanen dan menuntut daftar kloter dicetak ulang: sepele kalau ketahuan H-1, mahal kalau ketahuan saat regunya sudah berbaris.",
            "Blangko penilaian cuma memuat nomor dada, tanpa nama regu. Nomor yang salah dan lolos ke lapangan memindahkan seluruh nilai satu regu ke regu lain, dan tidak ada apa pun di kertas yang memperlihatkannya.",
            "Dua benda ini beda gunanya dan dua-duanya tidak bisa menyusul. Nomor dada adalah ID peserta yang harus terbaca dari JARAK JAUH, dipakai juri dan petugas sepanjang hari tanpa perlu bertanya nama. Tiska adalah bukti keikutsertaan, satu untuk tiap peserta, dan jumlahnya ikut kepala orang, bukan jumlah regu.",
            "Technical meeting digelar hari yang sama, dan itu bagian dari alasan yang sama. Pembina datang SEKALI: ikut TM, daftar ulang, ambil perlengkapan, lalu menempati barak dan tidur di situ. Digelar jauh-jauh hari, TM menuntut satu perjalanan tersendiri ke sekolah — ongkos dan satu hari yang mereka keluarkan sendiri.",
            "Aturannya berlaku untuk apa pun yang lain: kalau bisa, SELURUH kelengkapan peserta diserahkan sekali jalan di meja daftar ulang. Pembina datang sekali, mengantre sekali, dan pulang membawa semuanya. Tiap benda yang dijanjikan menyusul ke hari-H adalah satu antrean baru di pagi yang sudah penuh.",
          ],
        },
        {
          jenis: "foto",
          berkas: "perlengkapan-peserta.jpg",
          teks: "Contoh: satu paket perlengkapan yang diserahkan sekali jalan — kain nomor dada seregu, dan tiska sejumlah anggotanya.",
        },
        {
          jenis: "layar",
          nama: "Meja Daftar Ulang",
          hash: "#/daftar-ulang",
          fitur: "daftar_ulang",
          teks: "Buka H-1 pagi sampai hari-H pukul 10:00. Di sinilah nomor dada diketik, kloter terbentuk, dan kain yang rusak ditukar selagi pembetulannya masih murah.",
        },
        {
          jenis: "kenapa",
          teks: "Kalau dibalik, pagi hari-H berisi tiga pekerjaan yang berebut orang dan tempat yang sama: upacara, daftar ulang, dan pemberangkatan. Yang mengalah selalu jam berangkat, dan jendelanya tidak bisa dipanjangkan. Kloter terakhir tetap harus lepas jam sepuluh, dan regu yang berangkat terlambat pulang terlambat juga, karena kontrak waktunya sama panjang buat semua orang.",
        },
      ],
    },
    {
      kode: "kenapa-jam-diketik",
      judul: "Jam selalu diketik, tidak ada jam server tersembunyi",
      isi: [
        {
          jenis: "p",
          teks: "Fungsi berangkatkan_kloter menerima jamnya sebagai argumen dan kolomnya tidak punya default now(). Jam berangkat adalah angka yang dibaca petugas dari jam sungguhan lalu diketik, karena penalti sepuluh regu sekaligus lahir dari angka itu. Kotak isiannya juga bukan pemilih jam bawaan browser, melainkan sepasang kotak teks dengan pemeriksa sendiri.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak timestamp server saat data sampai: jaringan lambat menggeser jam berangkat beberapa menit, dan penalti dihitung dari jam yang tidak pernah terjadi.",
            "Ditolak pemilih jam bawaan browser: ia dirender menurut locale BROWSER, bukan bahasa halamannya. Laptop panitia berbahasa Inggris menampilkan 07:15 AM, dan satu meja ber-AM/PM di antara kertas 24 jam adalah cara sangat murah mencatat 07:15 sebagai 19:15.",
            "Yang diterima sengaja longgar, karena pencatat menyalin dari kertas dan mengetik cepat: 745, 0745, 7:45, 7.45, dan 07 45 semuanya jadi 07:45. Yang di luar 00:00 sampai 23:59 ditolak, bukan dibetulkan diam-diam.",
          ],
        },
        {
          jenis: "layar",
          nama: "Keberangkatan",
          hash: "#/keberangkatan",
          fitur: "keberangkatan",
          teks: "Tempat jam berangkat kloter diketik. Perkiraan jam yang tampil di layar lain bukan angka ini, dan keduanya tidak pernah disimpan di kolom yang sama.",
        },
        {
          jenis: "kenapa",
          teks: "Kalau jam diambil server, penalti seluruh kloter dihitung dari momen paket data tiba, bukan momen regu benar-benar melangkah.",
        },
      ],
    },
    {
      kode: "kenapa-penalti-simetris",
      judul: "Penalti waktu menilai ketepatan, bukan kecepatan",
      isi: [
        {
          jenis: "p",
          teks: "Tiap regu memilih sendiri kontrak waktunya. Targetnya jam berangkat kloter ditambah kontrak itu: berangkat 07:00 dengan kontrak empat jam berarti harus tiba tepat 11:00. Satu menit terlalu cepat dan satu menit terlambat sama-sama mengurangi satu poin.",
        },
        {
          jenis: "p",
          teks: "Contoh, kloter berangkat 07:00 dengan kontrak empat jam, jadi targetnya 11:00. Tiba 11:07 kena 7 poin. Tiba 10:53 juga kena 7 poin. Tiba 11:00 tepat, nol.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak menilai kecepatan: regu akan berlomba pulang secepat mungkin dan kontrak waktu kehilangan seluruh artinya.",
            "Ditolak toleransi 0 sampai 9 menit dari aturan lama. Sejak migration 0089 konfigurasinya blok 1 menit dan penalti 1 poin per blok — jangan hidupkan lagi toleransinya.",
            "Selisihnya dipotong pada menit mentah: 9 menit 30 detik dihitung 9 menit, bukan dibulatkan dulu jadi 10.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Kalau penalti jadi tidak simetris, yang diuji berubah dari kemampuan regu menepati janjinya sendiri menjadi siapa yang paling kuat berlari.",
        },
      ],
    },
    {
      kode: "kenapa-hak-akses",
      judul: "Hak akses lewat centang, bukan lewat nama peran",
      isi: [
        {
          jenis: "p",
          teks: "Yang menjaga pintu adalah fungsi boleh(fitur), yang membaca matriks centang di layar Akun. Peran cuma mengisi centang awal saat akun dibuat. Jadi panitia bisa menggeser tugas seseorang tengah hari tanpa migration dan tanpa siapa pun menyentuh kode.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak policy yang membandingkan nama peran. Menambahkan satu perbandingan seperti itu berarti ada dua mekanisme untuk satu pertanyaan, dan yang satu tidak bisa diubah panitia.",
            "Pemeriksaan yang cakupannya lebih sempit daripada masalahnya sudah terbukti berbahaya DUA KALI. Migration 0064 memindai policy dan function lalu melapor bersih — enam VIEW lolos karena view bukan keduanya. Migration 0065 menambahkan view lalu melapor bersih lagi — v_klasemen_live_score lolos karena ia menyaring dengan nama peran admin, yang tidak mengandung nama peran lama yang sedang dicari. Dua laporan hijau, dua layar kosong di lapangan.",
            "Isolasi pos sengaja tinggal pada MENULIS. Sejak migration 0069 rincian Live Score dibuka untuk semua pemegang centang live_score. Itu keputusan pemilik acara, dan konsekuensinya diterima: juri Pos 3 bisa melihat angka Pos 1 sebelum diumumkan.",
          ],
        },
        {
          jenis: "p",
          teks: "Satu peran yang mudah dirusak tanpa sengaja: koordinator_pos adalah juri pos yang kolom pos-nya KOSONG, dan seluruh gunanya bertumpu pada itu. Pos kosong berarti pagar per-pos membuka kelimanya. Memberinya pos utama mengubahnya diam-diam jadi juri pos biasa dengan nama lain.",
        },
        {
          jenis: "layar",
          nama: "Akun",
          hash: "#/account",
          fitur: "akun",
          teks: "Matriks centang per fitur. Ini satu-satunya sumber hak akses di seluruh sistem.",
        },
        {
          jenis: "kenapa",
          teks: "Kalau hak akses kembali diikat ke nama peran, tiap pergeseran tugas di lapangan butuh migration, dan pemeriksaan yang melapor bersih tidak lagi berarti apa-apa.",
        },
      ],
    },
    {
      kode: "kenapa-blangko",
      judul: "Blangko A5 landscape, satu master per lomba, difotokopi",
      isi: [
        {
          jenis: "p",
          teks: "Yang dicetak dari browser adalah MASTER, bukan tumpukannya. Satu pos dengan tiga lomba mencetak tiga halaman, bukan 1.500. Blangko itu kosong, jadi menggandakannya di fotokopi lebih cepat dan jauh lebih murah. Mencetak tumpukannya dari browser menghabiskan satu toner kantor untuk pekerjaan yang selesai dalam hitungan menit di mesin fotokopi.",
        },
        {
          jenis: "foto",
          berkas: "blangko-a5-landscape.jpg",
          teks: "Contoh: satu master blangko A5 melintang. Nomor dada dan nilai mentah berdampingan dengan tempat yang lega, dan dua lembar seperti ini muat di satu A4 saat difotokopi.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak A5 portrait: nomor dada dan nilai mentah harus besar dan berdampingan; di portrait keduanya berdesakan turun sampai kotak nilainya tinggal separuh. A5 landscape adalah separuh A4 dipotong lurus, jadi fotokopi bisa menggandakannya dua-up.",
            "Ditolak satu lembar per kriteria: satu regu di Pembidaian akan menerima lima kertas sekaligus di satu lomba. Satu lomba, satu lembar, dan juri menulis semua kriterianya di situ.",
            "Lomba berbentuk soal tidak mendapat blangko sama sekali. Peserta menulis di lembar soalnya sendiri, jadi pos yang seluruh lombanya berbentuk soal tidak mencetak apa pun dan mengatakan alasannya.",
          ],
        },
        {
          jenis: "p",
          teks: "Masternya difotokopi berulang, sering kali fotokopi dari fotokopi. Karena itu aturan cetaknya keras, dan tidak satu pun kosmetik. Tanpa blok hitam pekat, tanpa abu-abu atau raster, tanpa tulisan putih di atas gelap. Garis minimal 0,75pt, huruf minimal 7pt, dan tidak ada apa pun di belakang area yang ditulisi. Blok hitam keluar belang dan berbercak dari mesin fotokopi. Abu-abu jadi kotor atau hilang sama sekali. Huruf di bawah 7pt tertutup toner sampai lubang huruf a dan e menutup.",
        },
        {
          jenis: "kenapa",
          teks: "Kalau aturan cetak dilonggarkan, salinan keempat jadi bercak yang tidak terbaca — dan yang memegangnya juri di pos, bukan orang yang menyetujui desainnya di layar.",
        },
      ],
    },
    {
      kode: "kenapa-bahasa",
      judul: "Istilah domain tetap Indonesia, istilah teknis tetap Inggris",
      isi: [
        {
          jenis: "p",
          teks: "Pembagiannya menurut siapa yang membaca, bukan menurut jenis filenya. Kata yang diucapkan panitia tetap Indonesia sampai ke dalam nama kolom database. Kata yang diucapkan pemelihara kode tetap Inggris.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak menerjemahkan semuanya ke Inggris. Menulis chestNumber untuk nomor dada memasang pajak terjemahan di tiap percakapan lapangan, dan pada akhirnya jadi bug.",
            "Ditolak menerjemahkan semuanya ke Indonesia. Menulis pengendali untuk controller memutus pemelihara pelajar dari tiap tutorial, dokumentasi library, dan pesan error yang akan mereka cari.",
            "Ditolak juga bentuk formal seperti daring, unggah, dan kata sandi. Panitia tersandung membacanya, dan dokumen yang harus dipecahkan dulu tidak akan dibaca sama sekali.",
            "Nama file ikut aturan yang sama: apply-migration.yml karena migration itu urusan teknis, tapi 0011_nomor_dada_manual.sql karena nomor dada itu yang diucapkan orang.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Kalau pembagiannya dibalik, tiap nama harus diterjemahkan dua arah setiap kali dibicarakan antara meja dan kode.",
        },
      ],
    },
    {
      kode: "kenapa-teks-secukupnya",
      judul: "Teks layar secukupnya, panitia tidak digurui",
      isi: [
        {
          jenis: "p",
          teks: "Panitia membaca layar yang sama ratusan kali dalam satu shift. Kalimat yang mengajarkan sesuatu yang dipelajari sekali tetap dibaca ulang di tiap kalinya, dan mendorong tombol yang penting turun ke bawah lipatan layar HP. Karena itu judul yang jelas plus label field plus nama tombol biasanya sudah seluruh antarmukanya.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak paragraf penjelas di atas tiap fitur. Contohnya dulu dialog gembok. Judul di atas satu field beralasan sudah mengatakan seluruh isi paragrafnya, dalam seperempat tingginya. Di HP, paragraf itu justru mendorong field-nya keluar layar. Dialognya sendiri sudah tidak ada sejak migration 0166. Cek Nilai membuka gembok langsung, dengan alasan tetap Dibuka dari Cek Nilai. Yang tersisa pelajarannya, bukan layarnya.",
            "Ditolak glosarium istilah di layar. Menjelaskan Penggalang PA sebagai SMP atau MTs putra dibuang, karena ia menjelaskan istilah kepada orang yang mengucapkannya tiap hari.",
            "Yang DIPERTAHANKAN: fakta yang tidak bisa dibaca dari layar itu sendiri. Angka yang berlaku sekarang, akibat yang tidak bisa dibatalkan, peringatan bahwa sesuatu sudah tercetak atau sudah berangkat.",
            "Satu pengecualian yang sengaja: form pendaftaran. Pembina mengisinya sekali seumur acara, tanpa pelatihan, dan tanpa siapa pun untuk ditanya.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Kalau layar ditambahi penjelasan, ia bertambah tinggi, tombol utamanya turun di bawah lipatan HP, dan kalimat yang benar-benar penting ikut tidak dibaca.",
        },
      ],
    },
    {
      kode: "kenapa-hp",
      judul: "Semua layar wajib jalan di HP, termasuk layar panitia",
      isi: [
        {
          jenis: "p",
          teks: "Tidak ada satu pun layar yang boleh menganggap panitianya duduk di depan laptop. Diperiksa terukur pada lebar 390px: tidak ada elemen yang meluber, halaman tidak pernah bisa digeser ke samping, dan tidak ada sasaran sentuh di bawah 36px.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak ukuran huruf seragam untuk semua layar. Versi pertama memakai tubuh 18px dan isian 23px, dan form pendaftaran jadi setinggi 4,1 layar HP — panitia mengeluh kebanyakan menggulir.",
            "Sesudah diturunkan ke 16 dan 17px, form lima regu turun dari 3.429px ke 2.242px, atau 35 persen lebih pendek.",
            "Satu batas keras yang tidak boleh diturunkan: huruf di kotak isian minimal 16px. Di bawah itu iOS Safari memaksa zoom tiap kali isian disentuh, dan halamannya melompat.",
            "Aturan CSS baru WAJIB diukur di browser, bukan dibaca. Lima kali dalam satu hari aturannya ada, terbaca benar, dan tidak mengenai apa pun karena kalah khusus atau kalah urutan.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Kalau layar dianggap milik laptop, meja yang bekerja dari HP dan pembina yang mendaftar dari HP mendapat halaman yang melompat-lompat tiap kali disentuh.",
        },
      ],
    },
    {
      kode: "kenapa-migration-manual",
      judul: "Migration diterapkan manual, satu file per jalan",
      isi: [
        {
          jenis: "p",
          teks: "Merge tidak menerapkan apa pun ke database. Perubahan skema dijalankan lewat workflow apply-migration, satu file, dijalankan sengaja oleh seseorang yang membaca log-nya. File-nya dijalankan dalam satu transaksi dan berhenti di error pertama, jadi tidak ada migration setengah jadi.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak menerapkan migration otomatis saat merge ke main: satu perbaikan CSS yang kebetulan satu branch dengan migration akan mengubah skema produksi di tengah antrean pendaftaran.",
            "Harga yang dibayar nyata dan wajib diketahui: TIDAK ADA yang mencatat migration mana yang sudah jalan. Sepuluh file — 0091 dan 0098 sampai 0106 — tidak pernah sampai produksi, dan CI tetap hijau selama itu.",
            "Yang menemukannya enam hari kemudian bukan tes, melainkan pembina yang mendaftarkan regu Internal dan ditolak karena constraint golongan masih versi migration 0001. Migration 0119 memasang ulang isinya.",
            "Karena itu ada supabase/checks/status_migrasi.sql. Ia mencari SIDIK JARI sebuah migration di database: sebuah constraint, sebuah kolom, potongan definisi function, sebaris konfigurasi. Ia tidak mengubah apa pun. Nama file tidak bisa diperiksa, karena tidak ada yang menyimpannya.",
            "Cakupannya disebutkan, bukan didiamkan: 116 migration punya jejak yang diperiksa dan 53 tidak menyisakan jejak apa pun, dan 116 tambah 53 adalah seluruh 169 migration yang ada. Angka itu yang harus dijaga tiap kali file migration baru mendarat. Nomor yang tidak ada di kedua daftar tidak muncul sebagai BELUM. Ia tidak muncul sama sekali.",
          ],
        },
        {
          jenis: "p",
          teks: "Satu jebakan waktu memperbaiki migration yang terlewat: menjalankan ulang file lama TIDAK otomatis aman. Periksa dulu apakah ada migration yang lebih muda sudah mengganti objek yang sama — menjalankan file lamanya sekarang akan mengembalikan objek itu ke versi lama. Itu sebabnya 0119 sengaja tidak memuat beberapa bagian dari sepuluh file yang dipasangnya ulang.",
        },
        {
          jenis: "kenapa",
          teks: "Kalau migration ikut merge, skema produksi berubah tanpa satu orang pun membaca notice-nya, di tengah hari yang tidak bisa diulang.",
        },
      ],
    },
    {
      kode: "kenapa-ci-manual",
      judul: "Check CI dijalankan sengaja, tesnya di laptop",
      isi: [
        {
          jenis: "p",
          teks: "Dua workflow pemeriksa — sql-tests dan shared-files — hanya bisa dijalankan lewat tombol, tidak otomatis saat push maupun pull request. Semua yang mereka periksa selesai di laptop dalam hitungan detik, dan aturan pertamanya memang menjalankannya di sana.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak menjalankannya otomatis tiap push. GitHub membulatkan tiap JOB ke menit penuh, jadi yang mahal JUMLAH run, bukan lamanya: check 7 detik dan check 50 detik ditagih sama persis.",
            "Satu hari yang terukur: 24 dari 60 run adalah salinan kedua dari check yang sudah lulus. Sekali di pull request, sekali waktu merge-nya mendarat di main, atas tree yang sama persis.",
            "Cron pun ditakar. Jadwal tiap lima menit sama dengan 288 menit terbilang per hari, dan itu menghabiskan jatah bulanan dalam sepekan. Dua cron yang ada dikunci ke tanggal lombanya dengan penjaga tahun di langkah pertama, karena cron tidak punya kolom tahun.",
            "Dispatch CI kalau salah itu mahal: ada migration baru, perubahannya tidak bisa dijalankan lokal, laptopnya tidak punya PostgreSQL, atau acaranya kurang dari sepekan lagi.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Kalau jatah gratis habis, yang ikut mati bukan cuma pemeriksa — apply-migration dan tombol ganti password yang dipakai panitia dari HP berhenti juga. Dan karena tidak ada yang memeriksa sendiri, menjalankan tes di laptop bukan saran.",
        },
      ],
    },
    {
      kode: "kenapa-antrean-nilai",
      judul: "Nilai yang gagal terkirim mengantre di HP, yang ditolak server tidak",
      isi: [
        {
          jenis: "p",
          teks: "Di pos, internet putus adalah kejadian biasa, dan angka yang cuma ada di layar sama dengan angka yang tidak pernah dicatat. Karena itu kegagalan JARINGAN duduk di localStorage HP petugas dan dikirim ulang sendiri tiap 15 detik, juga seketika saat internet kembali. Tapi yang DITOLAK server tidak diantre sama sekali.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak menolak simpanan waktu jaringan putus: angkanya hilang, dan regunya sudah pergi ke pos berikutnya.",
            "Ditolak mengantre semua kegagalan tanpa pandang bulu. Nilai di luar rentang, regu tergembok, atau komponen yang bukan untuk golongan itu tidak akan berubah jawabannya karena ditunggu. Dan satu baris rusak menyumbat seluruh antrean di belakangnya.",
            "Yang ditolak server dilaporkan merah SELAGI regunya masih berdiri di depan petugas, saat masih bisa dibetulkan.",
            "Janjinya ditulis jujur: terkirim begitu halaman ini terbuka dan ada sinyal, bukan pasti terkirim nanti. Tidak ada service worker, dan Background Sync tidak ada di Safari iOS.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Kalau dibalik, nilai hilang diam-diam di pos, atau satu baris salah membekukan seluruh antrean satu HP sampai petugasnya menyadari sendiri.",
        },
      ],
    },
    {
      kode: "kenapa-buka-layarnya",
      judul: "Selama acara berjalan, buka layarnya sebelum merge",
      isi: [
        {
          jenis: "p",
          teks: "Sejak pendaftaran dibuka sampai juara diumumkan, sistem ini dipakai orang sungguhan sambil kita edit. Layar yang mati bukan bug yang dilaporkan besok, melainkan pekerjaan yang berhenti sekarang, di meja dengan antrean di depannya. Karena itu sebelum merge, buka layar yang disentuh dan HITUNG BARISNYA.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak menganggap parse check, tes SQL, dan halaman contoh sebagai bukti sebuah layar hidup. 28 Agustus 2026 Meja Pembayaran KOSONG di produksi selama acara berjalan; satu deklarasi berakhir di bawah pemakainya dan melempar error untuk SETIAP baris.",
            "Parse check lulus, seluruh tes lulus, pengukuran tata letak dikerjakan di halaman contoh berisi markup statis. Tidak satu langkah pun membuka layarnya. Yang menemukannya petugas di lapangan.",
            "Layar yang rusak sering terbaca seperti layar yang kosong. Waktu itu tulisan 39 invoice dan 40 regu di atas tabel tetap benar, karena angkanya dihitung dari data yang sudah diterima, bukan dari barisnya. Jangan menilai dari kepala layar.",
            "Kalau alat untuk membuka layarnya sendiri rusak, itu bug prioritas tinggi, bukan gangguan kecil. Skrip tests/dev_database.sh pernah berhenti di migration 0118 sejak file itu mendarat. Selama itu tidak ada cara membuka layar mana pun di laptop, jadi aturan di atas mustahil dipatuhi tanpa disadari siapa pun.",
          ],
        },
        {
          jenis: "p",
          teks: "Konsekuensinya tegas: perubahan yang layarnya tidak bisa dibuka, JANGAN di-merge selama acara berjalan. Tunda sampai bisa. Risiko menahan satu perbaikan tampilan jauh lebih kecil daripada risiko satu layar mati di tengah antrean. Dan kalau kamu tetap mau membalik salah satu keputusan di bab ini, baca dulu kotak penutupnya: isinya bukan ancaman, itu daftar hal yang sudah pernah terjadi.",
        },
        {
          jenis: "kenapa",
          teks: "Yang paling sering merusak sistem ini bukan orang yang tidak peduli, melainkan orang yang peduli dan tidak tahu alasannya. Kalau kamu mengubah sesuatu di sini, tulis alasannya di sini juga — bab yang tidak diperbarui menyesatkan lebih parah daripada bab yang kosong.",
        },
      ],
    },
  ],
};
/* PAPAN SPRINT — tiga belas sprint dua mingguan, September sampai hari-H,
   ditutup satu sprint evaluasi.

   Bentuknya BERBEDA dari bab bacaan di atas, dan itu disengaja. Sebuah sprint
   bukan bagian yang dibaca: ia daftar tugas yang DICENTANG, dan tiap tugas
   punya seksi yang memegangnya. Memaksanya masuk ke daftar blok akan
   mengubur keduanya di dalam paragraf.

   TANPA SATU PUN TANGGAL KALENDER, dan itu bukan kemalasan. Tanggal lomba
   ditetapkan di Sprint 2 — ia salah satu tugas di papan ini — jadi papan yang
   menyebut tanggal akan berbohong tepat sampai tugas itu selesai. Yang dipakai
   dua patokan yang tidak pernah basi: bulan beserta nomor minggunya, dan
   hitungan mundur dari hari-H. Edisi yang jatuh di bulan lain memakai kolom
   `mundur` dan membiarkan `bulan` sebagai contoh.

   KODE TUGAS ADALAH KUNCI CENTANG DI DATABASE (migrasi 0170).

   SEKALI SEBUAH KODE DIPAKAI, JANGAN PERNAH DIUBAH. Database tidak menyimpan
   daftar tugasnya dan tidak bisa memvalidasi kodenya — ia cuma menyimpan
   pasangan (edisi, kode). Mengganti "s6-desa" jadi "s6-surat-desa" membuat
   centangnya menggantung: tugasnya kembali kosong, centang lamanya tetap
   duduk di database, dan tidak ada satu pun galat yang menjelaskan kenapa.

   Menambah tugas baru aman. Menghapus tugas aman. Yang tidak aman cuma
   MENGGANTI NAMA. Kalau sebuah tugas berubah isinya, ubah `teks`-nya dan
   biarkan kodenya — kode itu identitas, bukan judul. */
export const SPRINT = [
  {
    kode: "s1",
    nomor: 1,
    bulan: "September",
    rentang: "Minggu 1-2",
    mundur: "H-167 sampai H-154",
    hMulai: -167,
    hSelesai: -154,
    tajuk: "Serah Terima Jabatan",
    fokus: "Kepengurusan berpindah, panitia inti terbentuk, dan akses ke seluruh akun organisasi berpindah tangan sebelum satu rapat besar pun digelar.",
    hasil: "Ketua Pelaksana, Sekretaris, dan Bendahara sudah ada namanya, dan minimal dua orang memegang password tiap akun organisasi.",
    tugas: [
      { kode: "s1-serah-terima", seksi: "Penanggung Jawab Umum", layar: null,
        teks: "Selesaikan serah terima jabatan pengurus ambalan dan tetapkan siapa penanggung jawab HRCD edisi ini." },
      { kode: "s1-inti", seksi: "Penanggung Jawab Umum", layar: null,
        teks: "Tunjuk Ketua Pelaksana, Wakil, Sekretaris, dan Bendahara. Seksi selebihnya menyusul di rapat besar." },
      { kode: "s1-akses", seksi: "Sekretariat", layar: null,
        teks: "Serahkan password akun organisasi (Supabase, Cloudflare, GitHub, email ambalan) ke minimal DUA orang, dan catat siapa memegang apa di luar sistem." },
      { kode: "s1-password", seksi: "Sekretariat", layar: "#/account",
        teks: "Ganti password akun admin yang diwariskan, jangan dipakai apa adanya." },
      { kode: "s1-evaluasi", seksi: "Ketua Pelaksana", layar: null,
        teks: "Baca ulang catatan evaluasi edisi lalu bersama-sama. Tiap keluhan yang berulang jadi calon tugas di sprint berikutnya." },
      { kode: "s1-arsip", seksi: "Sekretariat", layar: "#/live-score",
        teks: "Cetak arsip edisi lalu selagi datanya masih utuh: Rekap Nilai Semua dari Live Score, dan Daftar Juara dari Kejuaraan." },
      { kode: "s1-nonaktif", seksi: "Sekretariat", layar: "#/account",
        teks: "Nonaktifkan akun panitia edisi lalu yang orangnya sudah lulus. Jangan hapus barisnya, riwayat nilai menunjuk ke sana." },
      { kode: "s1-buku", seksi: "Ketua Pelaksana", layar: "#/buku-sakti",
        teks: "Minta seluruh panitia inti membaca Buku Sakti ini sampai habis sebelum rapat besar." },
    ],
    jangan: "Jangan membersihkan data edisi lalu bulan ini. Begitu dihapus, tidak ada lagi bahan evaluasi dan tidak ada satu pun layar terisi untuk melatih panitia baru.",
  },

  {
    kode: "s2",
    nomor: 2,
    bulan: "September",
    rentang: "Minggu 3-4",
    mundur: "H-153 sampai H-140",
    hMulai: -153,
    hSelesai: -140,
    tajuk: "Tanggal dan Anggaran Dikunci",
    fokus: "Tanggal acara ditetapkan bersama kepala sekolah dan pembina, dan dari tanggal itulah seluruh tenggat berikutnya dihitung mundur.",
    hasil: "Tanggal lomba terkunci hitam di atas putih, dan anggaran kasar sudah punya titik impas dari uang pendaftaran saja.",
    tugas: [
      { kode: "s2-tanggal", seksi: "Ketua Pelaksana", layar: null,
        teks: "TETAPKAN TANGGAL LOMBA bersama kepala sekolah dan pembina, lalu tulis di notulen. Anjurannya Februari atau Maret: Agustus bertabrakan dengan Agustusan, dan bulan-bulan itu memberi Kelas X tempat untuk ikut memegang pekerjaan. Seluruh tenggat di sprint berikutnya dihitung mundur dari tanggal ini." },
      { kode: "s2-tema", seksi: "Ketua Pelaksana", layar: null,
        teks: "Tetapkan tema, kuota regu, dan biaya pendaftaran per regu, termasuk biaya regu Internal yang memang berbeda." },
      { kode: "s2-rab", seksi: "Bendahara", layar: null,
        teks: "Susun anggaran kasar dan hitung titik impasnya dari uang pendaftaran SAJA. Acara harus tetap jalan kalau sponsor nol." },
      { kode: "s2-izin-prinsip", seksi: "Sekretaris", layar: null,
        teks: "Ajukan izin prinsip kegiatan ke Kepala Sekolah selaku Ka Mabigus. Ini induk semua surat; tanpa nomornya tidak ada surat lain yang sah." },
      { kode: "s2-proposal", seksi: "Sponsorship", layar: null,
        teks: "Susun proposal umum dan proposal sponsor berjenjang: sponsor utama, pendukung, dan partisipan." },
      { kode: "s2-target-sponsor", seksi: "Sponsorship", layar: null,
        teks: "Susun daftar calon sponsor beserta NAMA ORANG yang akan didatangi. Alumni dan orang tua siswa yang paling sering berhasil." },
      { kode: "s2-kalender", seksi: "Sekretariat", layar: "#/buku-sakti",
        teks: "Salin timeline ini jadi kalender panitia dengan tanggal sungguhan, lalu tempel di sekretariat." },
      { kode: "s2-danus-target", seksi: "Dana Usaha", layar: null,
        teks: "Tetapkan target rupiah dana usaha bersama Bendahara, dan bagi caranya: jualan berkala, pre-order, atau bazar." },
    ],
    jangan: "Jangan menunda penetapan tanggal ke bulan depan, dan jangan menunggu logo, surat, atau lapangan selesai dulu. Semua itu bisa menyusul; tanggal tidak. Setiap minggu tanggal belum pasti adalah satu minggu yang hilang dari antrean izin keramaian, dan satu minggu latihan yang hilang dari regu yang sudah menanyakannya.",
  },

  {
    kode: "s3",
    nomor: 3,
    bulan: "Oktober",
    rentang: "Minggu 1-2",
    mundur: "H-139 sampai H-126",
    hMulai: -139,
    hSelesai: -126,
    tajuk: "Rapat Besar dan Seksi Lengkap",
    fokus: "Seluruh seksi terisi namanya, dan proposal mulai berjalan ke calon sponsor.",
    hasil: "Tidak ada seksi tanpa koordinator, dan proposal sudah ada di tangan sepuluh calon sponsor pertama.",
    tugas: [
      { kode: "s3-rapat-besar", seksi: "Ketua Pelaksana", layar: null,
        teks: "Gelar rapat besar: tema, tanggal, biaya, dan susunan seluruh seksi diputuskan dan dinotulenkan." },
      { kode: "s3-koordinator", seksi: "Ketua Pelaksana", layar: null,
        teks: "Tunjuk koordinator tiap seksi dan serahkan daftarnya ke Administrator Sistem sebelum akun dibuat." },
      { kode: "s3-sk", seksi: "Sekretaris", layar: null,
        teks: "Ajukan SK Panitia atau Surat Tugas ke Kepala Sekolah. Hampir semua permohonan berikutnya melampirkannya." },
      { kode: "s3-sebar-proposal", seksi: "Sponsorship", layar: null,
        teks: "Datangi sepuluh calon sponsor pertama dan serahkan proposalnya LANGSUNG, jangan hanya kirim pesan." },
      { kode: "s3-survei-1", seksi: "Survey", layar: null,
        teks: "Jalani survei rute pertama dengan berjalan kaki penuh. Catat titik rawan: jalan raya yang harus diseberangi, jembatan, tanjakan, dan tepi sungai." },
      { kode: "s3-foto-rute", seksi: "Survey", layar: null,
        teks: "Rekam titik dan foto tiap calon lokasi pos untuk lampiran surat izin desa dan surat izin lahan nanti." },
      { kode: "s3-akun-panitia", seksi: "Sekretariat", layar: "#/account",
        teks: "Buat akun untuk koordinator tiap seksi di layar Akun. Pilih PERANNYA dulu, centangnya sesudahnya." },
      { kode: "s3-buku-seksi", seksi: "Sekretaris", layar: "#/buku-sakti",
        teks: "Minta tiap koordinator membaca bab Tugas Pokok Seksi bagian seksinya sendiri, lalu membantahnya kalau tidak cocok." },
      { kode: "s3-adat", seksi: "Penanggung Jawab Pelaksana", layar: null,
        teks: "Tetapkan aturan adat acara di rapat besar: seragam panitia, sikap di pos, dan cara memanggil peserta." },
    ],
    jangan: "Jangan membuat akun panitia sebelum perannya diputuskan. Mengganti peran akan MENGHAPUS seluruh centang tangan lalu mengisinya ulang dari paket peran, tanpa peringatan.",
  },

  {
    kode: "s4",
    nomor: 4,
    bulan: "Oktober",
    rentang: "Minggu 3-4",
    mundur: "H-125 sampai H-112",
    hMulai: -125,
    hSelesai: -112,
    tajuk: "Surat Pertama Keluar",
    fokus: "Izin prinsip dan SK panitia terbit, lalu permohonan rekomendasi Kwartir Ranting berangkat.",
    hasil: "Ada surat sah bernomor untuk dilampirkan ke seluruh permohonan berikutnya.",
    tugas: [
      { kode: "s4-izin-prinsip-terbit", seksi: "Sekretaris", layar: null,
        teks: "Pastikan izin prinsip Kepala Sekolah dan SK Panitia sudah TERBIT, bukan sekadar diajukan." },
      { kode: "s4-kwarran", seksi: "Sekretaris", layar: null,
        teks: "Ajukan permohonan rekomendasi ke Kwartir Ranting, lampirkan proposal dan SK Panitia. Prosesnya satu sampai dua minggu." },
      { kode: "s4-izin-gedung", seksi: "Akomodasi dan Logistik", layar: null,
        teks: "Ajukan izin pemakaian ruang kelas untuk barak, lapangan upacara, aula, dapur, dan kamar mandi lewat Wakasek Sarpras. Sebutkan ruang mana saja dan tanggal berapa dikosongkan dari KBM." },
      { kode: "s4-survei-2", seksi: "Survey", layar: null,
        teks: "Jalani survei rute kedua bersama perangkat desa untuk menetapkan lima titik pos, titik air, titik ambulans, dan jalur evakuasi." },
      { kode: "s4-poster", seksi: "Kreatif dan Publikasi", layar: null,
        teks: "Susun draf poster, logo kegiatan, dan desain kaos. Logo sponsor menyusul di versi kedua." },
      { kode: "s4-juklak", seksi: "Sekretaris", layar: null,
        teks: "Susun petunjuk pelaksanaan dan petunjuk teknis. Ini dokumen yang benar-benar dibaca pembina, jauh lebih menentukan daripada poster." },
      { kode: "s4-follow-up", seksi: "Sponsorship", layar: null,
        teks: "Follow-up calon sponsor tiap tujuh sampai sepuluh hari, dan catat siapa menelepon siapa." },
      { kode: "s4-format-soal", seksi: "Seksi Acara", layar: null,
        teks: "Tetapkan jumlah soal, bobot, dan format jawaban tiap mata lomba, samakan dengan yang dipakai sistem penilaian." },
      { kode: "s4-danus-jualan", seksi: "Dana Usaha", layar: null,
        teks: "Mulai jualan berkala di sekolah, dan setor hasilnya ke Bendahara tiap kali terkumpul, jangan menunggu akhir." },
    ],
    jangan: "Jangan mengirim surat ke desa atau kepolisian sebelum rutenya final. Surat yang dilampiri peta yang kemudian berubah harus diulang dari nol, dan antreannya tidak bisa dipotong.",
  },

  {
    kode: "s5",
    nomor: 5,
    bulan: "November",
    rentang: "Minggu 1-2",
    mundur: "H-111 sampai H-98",
    hMulai: -111,
    hSelesai: -98,
    tajuk: "Rute Final dan Kisi-Kisi",
    fokus: "Rute dikunci supaya surat desa, surat lahan, dan titik pos bisa berangkat; kisi-kisi soal disusun.",
    hasil: "Peta rute final tercetak, dan kisi-kisi tiap mata lomba sudah ada.",
    tugas: [
      { kode: "s5-rute-final", seksi: "Survey", layar: null,
        teks: "KUNCI RUTE FINAL dan cetak petanya. Surat desa dan surat lahan menunggu ini, jadi rutenya tidak boleh bergerak lagi sesudah sprint ini." },
      { kode: "s5-kwarran-terbit", seksi: "Sekretaris", layar: null,
        teks: "Pastikan rekomendasi Kwartir Ranting sudah terbit, lalu ajukan rekomendasi ke Kwartir Cabang. Prosesnya dua sampai tiga minggu." },
      { kode: "s5-kisi", seksi: "Seksi Acara", layar: null,
        teks: "Susun kisi-kisi tiap mata lomba: cakupan materi, tingkat kesulitan, dan pembagian Penggalang dan Penegak." },
      { kode: "s5-rubrik", seksi: "Seksi Acara", layar: null,
        teks: "Tulis rubrik penilaian tiap lomba praktik dan angkakan. Rubrik yang tidak eksplisit membuat dua juri berselisih tiga puluh poin untuk penampilan yang sama." },
      { kode: "s5-poster-final", seksi: "Kreatif dan Publikasi", layar: null,
        teks: "Finalkan poster dan juklak-juknis supaya siap disebar begitu rekomendasi Kwarcab keluar." },
      { kode: "s5-edaran", seksi: "Humas", layar: null,
        teks: "Minta Kwartir Cabang menerbitkan surat edaran ke gudep SMP dan SMA se-kabupaten. Ini alat publikasi paling ampuh dan tidak berbiaya." },
      { kode: "s5-migrasi-edisi", seksi: "Sekretariat", layar: null,
        teks: "Susun migration edisi baru: nomor, nama, tahun, tanggal lomba, biaya per regu Eksternal dan Internal, jam mulai dan batas berangkat, serta jeda maksimal antar kloter." },
      { kode: "s5-kalkulator", seksi: "Sekretariat", layar: "#/pengaturan-kloter",
        teks: "Buka Kalkulator Keberangkatan dan pastikan kloter terakhir masih berangkat sebelum jam sepuluh dengan perkiraan jumlah regu tahun ini." },
    ],
    jangan: "Jangan menulis tanggal lomba di dalam kode atau di skrip mana pun. Ia baris konfigurasi di database, dan panitia tahun depan mengubahnya tanpa menyentuh satu baris kode.",
  },

  {
    kode: "s6",
    nomor: 6,
    bulan: "November",
    rentang: "Minggu 3-4",
    mundur: "H-97 sampai H-84",
    hMulai: -97,
    hSelesai: -84,
    tajuk: "Pendaftaran Dibuka",
    fokus: "Publikasi berangkat dan form pendaftaran dibuka, bersamaan dengan surat ke setiap desa yang dilewati rute.",
    hasil: "Sekolah peserta sudah menerima undangan dan bisa mendaftar, dan tiap desa rute sudah menerima suratnya.",
    tugas: [
      { kode: "s6-migrasi-terap", seksi: "Sekretariat", layar: null,
        teks: "Jalankan migration edisi baru lewat workflow \"Apply migration to Supabase\", satu berkas sekali jalan, lalu baca notice-nya. Merge saja tidak pernah menerapkannya." },
      { kode: "s6-status-migrasi", seksi: "Sekretariat", layar: null,
        teks: "Jalankan supabase/checks/status_migrasi.sql lewat workflow yang sama untuk membuktikan migration-nya benar-benar hidup di produksi." },
      { kode: "s6-bobot", seksi: "Koordinator Lapangan", layar: null,
        teks: "Isi daftar pos, lomba, dan penilaian beserta poin maksimalnya. Bobot sebuah pos tidak ditulis di mana pun: ia jumlah poin maksimal seluruh wahana di pos itu." },
      { kode: "s6-buka-daftar", seksi: "Sekretariat", layar: null,
        teks: "BUKA FORM PENDAFTARAN di situs peserta dan umumkan alamatnya ke grup pembina." },
      { kode: "s6-undangan", seksi: "Humas", layar: null,
        teks: "Kirim surat undangan beserta juklak-juknis ke sekolah peserta, dan buat grup pembina." },
      { kode: "s6-desa", seksi: "Sekretaris", layar: null,
        teks: "Antarkan surat izin ke SETIAP kepala desa yang dilewati rute atau ditempati pos, satu surat per desa, sambil membawa peta. Yang paling sering terjadi adalah kurang satu desa." },
      { kode: "s6-kisi-umum", seksi: "Humas", layar: null,
        teks: "Umumkan kisi-kisi ke sekolah peserta. Ini bagian dari keadilan lomba, dan ia memangkas protes di hari-H." },
      { kode: "s6-pantau-daftar", seksi: "Sekretariat", layar: "#/data-peserta",
        teks: "Pantau Data Peserta tiap hari sejak pendaftaran dibuka. Salah ketik pembina jauh lebih murah dibetulkan hari ini daripada di meja daftar ulang." },
    ],
    jangan: "Jangan membuka pendaftaran sebelum data uji dibersihkan. Kloter yang masih menyandang tanda cetak atau jam berangkat dari percobaan membuat pembagian berikutnya mulai dari tengah, dan panitia mencari kloter yang tidak pernah ada.",
  },

  {
    kode: "s7",
    nomor: 7,
    bulan: "Desember",
    rentang: "Minggu 1-2",
    mundur: "H-83 sampai H-70",
    hMulai: -83,
    hSelesai: -70,
    tajuk: "Izin Lahan dan Penulisan Soal",
    fokus: "Pemilik lahan ditemui satu per satu, dan soal mulai ditulis.",
    hasil: "Tiap titik yang dilintasi punya nama dan nomor HP pemiliknya, dan draf soal tiap mata lomba sudah ada.",
    tugas: [
      { kode: "s7-lahan", seksi: "Humas", layar: null,
        teks: "Temui pemilik lahan yang dilintasi bersama perangkat desa; catat nama, nomor HP, dan titiknya. Sebagian minta ganti tanaman yang terinjak, jadi anggarkan." },
      { kode: "s7-lahan-pos", seksi: "Humas", layar: null,
        teks: "Urus izin lahan kelima pos secara TERPISAH dari lahan yang cuma dilewati. Pos butuh tempat teduh, air, dan ruang untuk satu regu bergerak." },
      { kode: "s7-camat", seksi: "Sekretaris", layar: null,
        teks: "Ajukan rekomendasi Camat. Syaratnya surat desa sudah terbit lebih dulu." },
      { kode: "s7-tulis-soal", seksi: "Koordinator Lapangan", layar: null,
        teks: "Tulis soal beserta kunci jawabannya, satu penulis per mata lomba, dikerjakan offline dan tidak dibagikan di grup umum." },
      { kode: "s7-uji-jalan", seksi: "Survey", layar: null,
        teks: "Uji jalan kaki rute penuh dengan stopwatch minimal dua kali, di hari dan jam yang sama dengan hari-H: satu tim berkecepatan Penggalang SMP, satu tim Penegak SMA." },
      { kode: "s7-materi-praktik", seksi: "Koordinator Lapangan", layar: null,
        teks: "Siapkan materi lomba praktik dan rahasiakan: sepuluh objek KIM Lihat, daftar simpul, kata semaphore, objek menaksir beserta ukuran benarnya, dan skenario cedera pembidaian." },
      { kode: "s7-juri-undangan", seksi: "Sekretaris", layar: null,
        teks: "Kirim permohonan juri undangan untuk PBB, yel-yel, keagamaan, dan kesehatan. Orangnya sibuk, jadi kirim awal dan konfirmasi ulang." },
      { kode: "s7-alat-praktik", seksi: "Akomodasi dan Logistik", layar: null,
        teks: "Hitung kebutuhan alat praktik PER POS, bukan total: mitela, bidai, tongkat, tali, bakiak, bendera semaphore, stopwatch, dan meteran." },
    ],
    jangan: "Jangan mengukur kontrak waktu memakai panitia yang paling bugar. Regu yang terlambat karena patokannya salah adalah kesalahan panitia, tetapi penaltinya tetap jatuh ke peserta.",
  },

  {
    kode: "s8",
    nomor: 8,
    bulan: "Desember",
    rentang: "Minggu 3-4",
    mundur: "H-69 sampai H-56",
    hMulai: -69,
    hSelesai: -56,
    tajuk: "Izin Keramaian Masuk",
    fokus: "Berkas izin keramaian masuk ke kepolisian, dan kontrak waktu dihitung dari hasil uji jalan.",
    hasil: "Berkas izin keramaian sudah diterima, dan pilihan kontrak waktu sudah punya angka yang bisa dipertanggungjawabkan.",
    tugas: [
      { kode: "s8-keramaian", seksi: "Sekretaris", layar: null,
        teks: "Masukkan berkas izin keramaian lewat Polsek: surat permohonan, proposal, susunan panitia, jadwal, peta rute, rekomendasi desa dan camat, surat sekolah, fotokopi KTP penanggung jawab, dan perkiraan jumlah peserta." },
      { kode: "s8-polsek", seksi: "Keamanan", layar: null,
        teks: "Datangi Kapolsek atau Kanit Binmas untuk membicarakan pengamanan titik start, penyeberangan, dan keramaian malam. Datang, jangan hanya berkirim surat." },
      { kode: "s8-kontrak-waktu", seksi: "Koordinator Lapangan", layar: null,
        teks: "Hitung pilihan kontrak waktu dari total waktu jalan ditambah waktu di lima pos ditambah istirahat wajar, lalu masukkan sebagai konfigurasi edisi." },
      { kode: "s8-satlantas", seksi: "Keamanan", layar: null,
        teks: "Bicarakan penyeberangan jalan raya dengan Satlantas secara terpisah dari izin keramaian, dan Dinas Perhubungan kalau ada pengalihan jalan atau parkir bus." },
      { kode: "s8-koramil", seksi: "Sekretaris", layar: null,
        teks: "Kirim surat pemberitahuan ke Koramil dan temui Danramil. Babinsa tiap desa rute sering ikut membantu di lapangan." },
      { kode: "s8-piala", seksi: "Akomodasi dan Logistik", layar: null,
        teks: "Pesan piala, medali, dan plakat dengan plat KOSONG. Grafir butuh empat sampai enam minggu, dan nama juara memang belum ada sebelum acara." },
      { kode: "s8-uji-lomba", seksi: "Koordinator Lapangan", layar: null,
        teks: "Uji coba tiap lomba praktik dengan satu regu contoh dan ukur waktunya. Dari sinilah lama satu regu berada di satu pos diketahui." },
      { kode: "s8-sponsor-nego", seksi: "Sponsorship", layar: null,
        teks: "Tutup negosiasi sponsor dan siapkan kesepakatan tertulisnya: nominal atau barang, hak tampil logo, jumlah spanduk, dan tenggat pembayaran." },
    ],
    jangan: "Jangan mengajukan izin keramaian kurang dari tiga minggu sebelum hari-H. Prosesnya sendiri satu sampai dua minggu kerja, dan hampir selalu ada berkas yang harus dilengkapi lebih dulu.",
  },

  {
    kode: "s9",
    nomor: 9,
    bulan: "Januari",
    rentang: "Minggu 1-2",
    mundur: "H-55 sampai H-42",
    hMulai: -55,
    hSelesai: -42,
    tajuk: "Sponsor Ditutup, Soal Divalidasi",
    fokus: "Kontrak sponsor ditutup supaya logo masih sempat masuk cetakan, dan seluruh soal diperiksa orang lain.",
    hasil: "Tidak ada logo baru sesudah sprint ini, dan tiap kunci jawaban sudah divalidasi pembina.",
    tugas: [
      { kode: "s9-tutup-sponsor", seksi: "Sponsorship", layar: null,
        teks: "TUTUP KONTRAK SPONSOR. Sesudah ini tidak ada logo baru, karena spanduk, backdrop, kaos, sertifikat, dan ID card semuanya menunggu file logo." },
      { kode: "s9-logo", seksi: "Kreatif dan Publikasi", layar: null,
        teks: "Kumpulkan file logo sponsor dalam resolusi cetak, lalu kunci desain spanduk dan backdrop." },
      { kode: "s9-cadangan", seksi: "Bendahara", layar: null,
        teks: "Periksa pemasukan sponsor. Kalau kurang dari separuh target, jalankan rencana cadangan SEKARANG: danus, potong biaya yang bisa dipotong, dan ganti sewa dengan pinjaman barang." },
      { kode: "s9-validasi-soal", seksi: "Koordinator Lapangan", layar: null,
        teks: "Serahkan seluruh soal ke pembina dan guru mata pelajaran untuk divalidasi: kunci benar, tidak ada soal berkunci ganda, bahasa tidak ambigu, dan sesuai jenjang SMP dan SMA." },
      { kode: "s9-medis", seksi: "Kesehatan", layar: null,
        teks: "Ajukan permohonan tenaga medis dan ambulans ke Puskesmas kecamatan dan PMI, lalu sepakati rumah sakit rujukan beserta nomor IGD-nya." },
      { kode: "s9-nomor-dada", seksi: "Akomodasi dan Logistik", layar: null,
        teks: "Pesan kain nomor dada beserta cadangan sepuluh persen. Deret Internal disablon 1001 dan seterusnya, BUKAN 001, supaya angka yang disalin juri dari dada regu tidak bentrok dengan Eksternal. Sablon butuh dua minggu kerja. Kalau pendaftaran belum ditutup, pesan sejumlah KUOTA, bukan sejumlah pendaftar." },
      { kode: "s9-tiska", seksi: "Akomodasi dan Logistik", layar: null,
        teks: "Pesan tiska beserta cadangan. Hitungannya per PESERTA, bukan per regu, jadi angkanya berlipat kira-kira delapan kali jumlah regu — pastikan Bendahara memakai angka itu, bukan angka regu." },
      { kode: "s9-pinjam", seksi: "Akomodasi dan Logistik", layar: null,
        teks: "Kirim surat peminjaman tenda, terpal, meja-kursi, sound system, HT, genset, dan lampu sorot." },
      { kode: "s9-stok-dada", seksi: "Sekretariat", layar: null,
        teks: "Samakan stok nomor dada di sistem dengan kain yang benar-benar dipesan: dua deret, Eksternal dan Internal. Pagar nomor dada membaca angkanya dari sana." },
      { kode: "s9-danus-preorder", seksi: "Dana Usaha", layar: null,
        teks: "Tutup pre-order kaos dan merchandise sekarang, supaya barangnya jadi sebelum hari-H, bukan sesudahnya." },
    ],
    jangan: "Jangan menerima sponsor yang logonya datang belakangan. Satu logo yang menyusul memaksa seluruh cetakan diulang, dan biaya cetak ulangnya lebih besar daripada sponsornya.",
  },

  {
    kode: "s10",
    nomor: 10,
    bulan: "Januari",
    rentang: "Minggu 3-4",
    mundur: "H-41 sampai H-28",
    hMulai: -41,
    hSelesai: -28,
    tajuk: "Soal Selesai dan Meja Diuji",
    fokus: "Soal dikunci total, dan alur meja dicoba dengan data contoh sebelum peserta sungguhan datang.",
    hasil: "Soal siap digandakan, dan panitia tahu berapa lama satu regu dilayani di meja.",
    tugas: [
      { kode: "s10-revisi-soal", seksi: "Koordinator Lapangan", layar: null,
        teks: "Perbaiki soal dari hasil validasi, lalu ujicobakan ke lima sampai sepuluh anggota ambalan yang TIDAK ikut menyusun, untuk mengukur waktu pengerjaan yang sebenarnya." },
      { kode: "s10-soal-kunci", seksi: "Koordinator Lapangan", layar: null,
        teks: "KUNCI SOAL DAN LAYOUT FINALNYA. Sesudah ini tidak ada perubahan isi, hanya penggandaan." },
      { kode: "s10-simulasi-meja", seksi: "Sekretariat", layar: "#/daftar-ulang",
        teks: "Jalankan simulasi meja pembayaran dan daftar ulang dengan data contoh. Ukur berapa lama satu regu dilayani, lalu kalikan dengan jumlah regu tahun ini." },
      { kode: "s10-bersih-uji", seksi: "Sekretariat", layar: null,
        teks: "Bersihkan data uji sesudah simulasi, termasuk mengembalikan penomoran kloter ke satu." },
      { kode: "s10-sertifikat", seksi: "Kreatif dan Publikasi", layar: null,
        teks: "Siapkan template sertifikat, ID card panitia dan juri, serta rompi atau slayer pembeda." },
      { kode: "s10-konsumsi", seksi: "Konsumsi", layar: null,
        teks: "Kunci kontrak konsumsi panitia, juri, tamu, dan aparat. Jumlah pastinya dikonfirmasi ulang tiga hari sebelum hari-H." },
      { kode: "s10-bpbd", seksi: "Keamanan", layar: null,
        teks: "Kirim pemberitahuan ke BPBD dan minta pembacaan risiko rute, lalu kumpulkan izin orang tua panitia yang menginap." },
      { kode: "s10-rambu", seksi: "Akomodasi dan Logistik", layar: null,
        teks: "Buat penunjuk arah, rambu bahaya, dan papan nama pos dari bahan tahan hujan, huruf besar, dua sisi." },
      { kode: "s10-katering", seksi: "Konsumsi", layar: null,
        teks: "Pesan katering atau susun rencana masak sendiri untuk panitia, juri, dan tamu." },
    ],
    jangan: "Jangan membiarkan soal selesai mepet. Soal yang jadi tiga hari sebelum acara tidak sempat divalidasi. Kunci yang salah baru ketahuan sesudah tiga ratus regu menjawab: satu mata lomba dianulir, dan seluruh klasemen goyah.",
  },

  {
    kode: "s11",
    nomor: 11,
    bulan: "Februari",
    rentang: "Minggu 1-2",
    mundur: "H-27 sampai H-14",
    hMulai: -27,
    hSelesai: -14,
    tajuk: "Pendaftaran Ditutup",
    fokus: "Jumlah regu terkunci, pembayaran disapu habis, soal dan blangko digandakan, dan juri dilatih.",
    hasil: "Tidak ada lagi regu yang belum lunas, soal tersegel per pos, dan tiap juri sudah membaca rubriknya serupa.",
    tugas: [
      { kode: "s11-tutup-daftar", seksi: "Sekretariat", layar: null,
        teks: "TUTUP PENDAFTARAN. Sejak titik ini jumlah regu terkunci, dan konsumsi, nomor dada, serta blangko baru bisa dipesan dengan angka pasti." },
      { kode: "s11-sapu-bayar", seksi: "Bendahara", layar: "#/pembayaran",
        teks: "Sapu Meja Pembayaran sampai antrean menunggu pembayaran habis. Hubungi pembina yang belum lunas lewat kontak di Data Peserta, jangan dibiarkan sampai pagi hari-H." },
      { kode: "s11-gandakan-soal", seksi: "Koordinator Lapangan", layar: null,
        teks: "Gandakan soal lima mata lomba beserta cadangan sepuluh persen, ditunggui panitia, lalu paketkan per pos, disegel, diberi label, dan disimpan terkunci." },
      { kode: "s11-blangko", seksi: "Koordinator Lapangan", layar: "#/pos",
        teks: "Cetak MASTER blangko dari layar Input Nilai Tabel lalu gandakan di mesin fotokopi. Yang dicetak dari layar satu master per lomba, bukan setumpuk." },
      { kode: "s11-undang-tm", seksi: "Humas", layar: null,
        teks: "Sebarkan undangan technical meeting beserta susunan acaranya. Sebutkan bahwa TM digelar H-1, berbarengan dengan daftar ulang, dan peserta boleh langsung menempati barak malam itu." },
      { kode: "s11-latih-juri", seksi: "Koordinator Lapangan", layar: null,
        teks: "Latih juri pos dengan kalibrasi: dua juri menilai penampilan yang sama, lalu selisihnya dibahas sampai rubriknya dibaca serupa. Wajib untuk PBB, yel-yel, dan pembidaian." },
      { kode: "s11-akun-juri", seksi: "Sekretariat", layar: "#/account",
        teks: "Buat akun juri pos beserta kolom posnya, dan satu akun koordinator pos yang kolom posnya DIKOSONGKAN supaya kelima pos terbuka untuknya." },
      { kode: "s11-izin-terbit", seksi: "Humas", layar: null,
        teks: "Pastikan izin keramaian sudah TERBIT, lalu ajukan permohonan pengamanan menyusul sekalian menanyakan jumlah personel dan konsumsinya." },
      { kode: "s11-rujukan", seksi: "Kesehatan", layar: null,
        teks: "Sepakati jalur rujukan dengan puskesmas atau klinik terdekat, dan catat nomor yang bisa dihubungi saat hari-H." },
    ],
    jangan: "Jangan memanggil pembina datang ke sekolah hanya untuk satu keperluan. Tiap panggilan adalah ongkos jalan dan satu hari yang mereka keluarkan sendiri, dan itulah alasan technical meeting digabungkan ke H-1.",
  },

  {
    kode: "s12",
    nomor: 12,
    bulan: "Februari",
    rentang: "Minggu 3-4",
    mundur: "H-13 sampai hari-H",
    hMulai: -13,
    hSelesai: 0,
    tajuk: "Gladi dan Hari-H",
    fokus: "Gladi kotor, gladi bersih, lalu H-1 sendiri: technical meeting, daftar ulang, dan barak terisi. Sesudahnya hari lomba dari upacara sampai pengumuman juara.",
    hasil: "Juara diumumkan, rekap terbit, dan seluruh nilai terkunci.",
    tugas: [
      { kode: "s12-survei-ulang", seksi: "Survey", layar: null,
        teks: "Susuri ulang rute mencari perubahan: panen, penutupan jalan, longsor, pagar baru, kandang baru." },
      { kode: "s12-simulasi-penuh", seksi: "Sekretariat", layar: null,
        teks: "Jalankan simulasi end-to-end penuh dengan data uji, dari pendaftaran sampai klasemen, lalu bersihkan datanya sampai kloter kembali ke nomor satu." },
      { kode: "s12-gladi-kotor", seksi: "Ketua Pelaksana", layar: null,
        teks: "Gelar gladi kotor: seluruh panitia, seluruh alur, pos dijalankan dengan regu boneka dari anggota ambalan. Uji HT dan cari titik tanpa sinyal sekalian." },
      { kode: "s12-gladi-bersih", seksi: "Seksi Acara", layar: null,
        teks: "Gelar gladi bersih untuk upacara, pemberangkatan kloter, dan penutupan. Fokusnya urutan dan waktu, bukan seluruh pos." },
      { kode: "s12-barak", seksi: "Akomodasi dan Logistik", layar: null,
        teks: "Siapkan barak: pembagian ruang, pemisahan putra dan putri, denah tertempel, penjaga malam per lantai, penerangan, dan aturan jam malam." },
      { kode: "s12-pasang-rambu", seksi: "Akomodasi dan Logistik", layar: null,
        teks: "Pasang penunjuk arah sehari sebelum acara, sore hari, jangan lebih awal. Rambu yang dipasang seminggu sebelumnya hilang, dicabut, atau berpindah arah." },
      { kode: "s12-tm", seksi: "Ketua Pelaksana", layar: null,
        teks: "H-1: gelar technical meeting dengan pembina peserta — rute, kontrak waktu, sistem penilaian, barang bawaan, aturan barak, sanksi, jam kloter, dan tata cara protes. Buat berita acara dan bagikan notulennya; yang tidak hadir tetap terikat." },
      { kode: "s12-daftar-ulang", seksi: "Sekretariat", layar: "#/daftar-ulang",
        teks: "Buka meja daftar ulang H-1 pagi, dan biarkan berjalan sampai hari-H pukul 10:00 untuk regu yang baru sempat datang. Cari batch lewat kode pembayaran, isi nomor dada seluruh regu sekolah itu sekaligus, tukar nomor yang kainnya rusak, dan serahkan kain beserta tiskanya. Jangan menomori kloter sendiri: urutan FIFO dan kuota lima Eksternal serta tiga Internal dijaga di dalam sistem." },
      { kode: "s12-cetak-kloter", seksi: "Sekretariat", layar: "#/cetak-kloter",
        teks: "Cetak Daftar Kloter untuk Petugas dan untuk Peserta sesudah seluruh regu bernomor dada, lalu tempel lembar peserta di barak dan titik kumpul malam itu juga." },
      { kode: "s12-berangkat", seksi: "Seksi Acara", layar: "#/keberangkatan",
        teks: "Hari-H pagi: upacara, lalu berangkatkan kloter dari jam tujuh sampai jam sepuluh, dengan tiga kloter selalu siap — satu di Pemberangkatan, dua di staging." },
      { kode: "s12-nilai", seksi: "Koordinator Lapangan", layar: "#/pos2",
        teks: "Sepanjang siang: juri mengisi nilai per lomba dan memotret lembar jawabannya, lalu koordinator pos memantau kelengkapan kelima pos." },
      { kode: "s12-datang", seksi: "Keamanan", layar: "#/finish",
        teks: "Catat kedatangan tiap regu dengan tombol SAMPAI DI FINISH pada jam sungguhan, lalu hitung anggotanya secara fisik." },
      { kode: "s12-fase", seksi: "Sekretariat", layar: "#/live-score",
        teks: "Naikkan fase live bertahap lalu terbitkan rekapnya. Urutannya selalu nyalakan fasenya dulu, terbitkan sesudahnya, dan itu berlaku ke dua arah." },
      { kode: "s12-adat-gladi", seksi: "Penanggung Jawab Pelaksana", layar: null,
        teks: "Gladi upacara pembukaan dan penutupan secara adat, beserta apel panitia pagi hari-H." },
      { kode: "s12-danus-bazar", seksi: "Dana Usaha", layar: null,
        teks: "Buka bazar atau stan di sekitar barak dan garis finish sepanjang hari lomba." },
      { kode: "s12-makan-malam", seksi: "Konsumsi", layar: null,
        teks: "Sediakan makan malam panitia pada malam persiapan, dan susun giliran makan hari-H bersama Seksi Acara." },
    ],
    jangan: "Jangan mengumumkan juara sebelum Cek Nilai bersih. Angka yang dibetulkan sesudah papan juara dibacakan tidak bisa ditarik kembali dari ingatan orang yang sudah bertepuk tangan.",
  },

  {
    kode: "s13",
    nomor: 13,
    bulan: "Sesudah acara",
    rentang: "Dua minggu setelah hari-H",
    mundur: "H+1 sampai H+14",
    hMulai: 1,
    hSelesai: 14,
    tajuk: "Evaluasi dan Serah Terima",
    fokus: "Ucapan terima kasih, laporan, arsip, dan buku yang ditulis ulang untuk kepanitiaan berikutnya.",
    hasil: "Izin tahun depan jadi mudah, dan panitia berikutnya menerima buku yang sudah diperbarui.",
    tugas: [
      { kode: "s13-terima-kasih", seksi: "Sekretaris", layar: null,
        teks: "Kirim surat ucapan terima kasih ke seluruh instansi, sponsor, pemilik lahan, dan pemberi pinjaman barang. Inilah yang menentukan izin tahun depan mudah atau susah." },
      { kode: "s13-kembalikan", seksi: "Akomodasi dan Logistik", layar: null,
        teks: "Kembalikan seluruh barang pinjaman dengan berita acara, dan bereskan sampah di sekolah maupun sepanjang rute sesuai kesepakatan dengan desa." },
      { kode: "s13-evaluasi", seksi: "Ketua Pelaksana", layar: null,
        teks: "Gelar rapat evaluasi selagi ingatan masih segar, dan TULIS notulennya. Yang tidak ditulis minggu ini hilang." },
      { kode: "s13-lpj", seksi: "Bendahara", layar: null,
        teks: "Tutup laporan keuangan dan susun LPJ ke Kepala Sekolah, Kwartir Ranting, dan tiap sponsor beserta foto pemasangan logonya." },
      { kode: "s13-arsip", seksi: "Sekretariat", layar: "#/kejuaraan",
        teks: "Cetak arsip: Rekap Nilai Semua, Daftar Kloter final, dan Daftar Juara. Simpan bersama notulen dan seluruh berkas izin." },
      { kode: "s13-sertifikat-juara", seksi: "Kreatif dan Publikasi", layar: null,
        teks: "Cetak dan bagikan sertifikat juara sesudah hasilnya pasti." },
      { kode: "s13-tulis-buku", seksi: "Sekretaris", layar: "#/buku-sakti",
        teks: "TULIS ULANG BUKU SAKTI ini dari hasil evaluasi: yang berubah tahun ini, yang ternyata salah, dan yang baru kalian pelajari. Buku yang tidak diperbarui pelan-pelan jadi buku yang menyesatkan." },
      { kode: "s13-serah-terima", seksi: "Penanggung Jawab Umum", layar: null,
        teks: "Serahkan akses akun organisasi, arsip, dan buku ini ke kepengurusan berikutnya, lalu mulai lagi dari Sprint 1." },
    ],
    jangan: "Jangan membersihkan data acara sebelum arsipnya tercetak dan LPJ selesai. Sekali dibersihkan, klasemen, nilai mentah, dan daftar juara tidak bisa dikembalikan.",
  },
];
/** Papan sprint ikut jadi tab supaya seluruh buku punya satu deretan tab,
 *  bukan tiga tab ditambah satu tombol yang letaknya lain sendiri.
 *  `bagian`-nya sengaja kosong: yang digambar SPRINT di atas. */
const BAB_SPRINT = {
  kode: "timeline", judul: "Papan Sprint Satu Edisi",
  tab: "Sprint", ikon: "list-checks", warna: "toska",
  ringkas: "Tiga belas sprint dua mingguan dari Serah Terima Jabatan sampai "
    + "hari-H, ditutup satu sprint evaluasi. Tiap tugas bisa dicentang, dan "
    + "centangnya dilihat seluruh panitia.",
  bagian: [],
};

export const BUKU_SAKTI = [BAB_TUTORIAL, BAB_SEKSI, BAB_KENAPA, BAB_SPRINT];

/** Seluruh bagian buku, rata, masing-masing membawa bab asalnya. Dipakai
 *  kotak cari dan daftar isi cetak. */
export function bagianBuku() {
  return BUKU_SAKTI.flatMap(bab =>
    bab.bagian.map(bagian => ({ bab, bagian })));
}

/** Semua teks satu bagian, digabung jadi satu baris huruf kecil.
 *
 *  Kotak cari mencari DI SINI, bukan di DOM. Mencari di DOM berarti judul
 *  bagian yang cocok tetapi isinya tidak akan hilang begitu satu blok
 *  disembunyikan, dan sebaliknya — dan yang mencari kata "gembok" tidak
 *  peduli kata itu ada di paragraf, di butir, atau di sel tabel. */
export function teksBagian(bagian) {
  const potong = [bagian.judul];
  for (const blok of bagian.isi) {
    if (blok.teks) potong.push(blok.teks);
    if (blok.nama) potong.push(blok.nama);
    if (blok.butir) potong.push(...blok.butir);
    if (blok.kepala) potong.push(...blok.kepala);
    if (blok.baris) for (const baris of blok.baris) potong.push(...baris);
  }
  return potong.join(" ").toLowerCase();
}

/** Semua teks satu sprint, sebentuk dengan teksBagian().
 *
 *  SELURUH kolom ikut, termasuk nomor sprint dan nama seksi. Yang mencari
 *  "perizinan" mau menemukan sprintnya; yang mencari "Bendahara" mau
 *  menemukan semua tugas bendahara; dan yang mengetik "s9" sedang menyalin
 *  kode tugas dari notulen rapat. Kolom yang tertinggal dari daftar ini jadi
 *  kata yang ada di layar tetapi tidak pernah ketemu. */
export function teksSprint(sprint) {
  return [sprint.kode, String(sprint.nomor), sprint.bulan, sprint.rentang,
          sprint.mundur, sprint.tajuk, sprint.fokus, sprint.hasil,
          sprint.jangan,
          ...sprint.tugas.flatMap(t => [t.kode, t.teks, t.seksi])]
    .join(" ").toLowerCase();
}

/** Bagian yang memuat SELURUH kata yang diketik, bukan salah satunya.
 *
 *  Panitia mengetik "cetak kloter" untuk mencari satu hal, bukan dua. Dengan
 *  "salah satu", kata "cetak" sendirian sudah mengembalikan setengah buku dan
 *  kotak carinya berhenti menyaring apa pun. */
export function cariBagian(kata) {
  const potong = String(kata || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!potong.length) return [];
  return bagianBuku().filter(({ bagian }) => {
    const teks = teksBagian(bagian);
    return potong.every(k => teks.includes(k));
  });
}

/** Sprint yang cocok. Aturannya SAMA dengan cariBagian() — semua kata, bukan
 *  salah satunya — dan kesamaan itu diuji, bukan diandaikan: dua kotak cari
 *  yang berperilaku berbeda di satu layar adalah kotak cari yang salah satunya
 *  pasti mengejutkan. */
export function cariSprint(kata) {
  const potong = String(kata || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!potong.length) return [];
  return SPRINT.filter(sprint => {
    const teks = teksSprint(sprint);
    return potong.every(k => teks.includes(k));
  });
}

/** Seluruh tugas papan sprint, rata, masing-masing membawa sprint asalnya.
 *  Dipakai menghitung kemajuan dan mencetak papannya. */
export function tugasSprint() {
  return SPRINT.flatMap(sprint => sprint.tugas.map(tugas => ({ sprint, tugas })));
}

/** Lajur papan sprint: seksi yang memegang pekerjaan, berurutan.
 *
 *  DIAMBIL DARI BAB SEKSI, tidak ditulis ulang sebagai daftar kedua. Nama
 *  seksi muncul di tiga tempat — judul bagian, kolom seksi tiap tugas, dan
 *  kepala lajur papan — dan dua di antaranya sudah diikat tes. Daftar ketiga
 *  yang ditulis tangan adalah tempat ketiga yang bisa menyimpang sendiri,
 *  dan yang menyimpangnya tidak akan ketahuan sampai satu lajur kosong
 *  padahal seksinya punya tugas.
 *
 *  Bagian bertanda `bukanSeksi` dilewati: pengantar bab bukan seksi dan tidak
 *  memegang tugas apa pun. */
export function lajurSeksi() {
  const bab = BUKU_SAKTI.find(b => b.kode === "seksi");
  return bab.bagian
    .filter(g => !g.bukanSeksi)
    .map(g => ({
      judul: g.judul,
      singkat: g.singkat || g.judul,
      rona: g.rona || "abu",
      kode: g.kode,
    }));
}
