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

   ENAM JENIS BLOK, DAN TIDAK ADA YANG KETUJUH

     { jenis: "p",       teks: "satu paragraf" }
     { jenis: "poin",    butir: ["...", "..."] }          daftar bertitik
     { jenis: "langkah", butir: ["...", "..."] }          daftar bernomor
     { jenis: "tabel",   kepala: ["A", "B"],
                         baris: [["a1", "b1"]] }          panjang baris = kepala
     { jenis: "kenapa",  teks: "..." }                    kotak beraksen
     { jenis: "layar",   nama: "Meja Pembayaran",
                         hash: "#/pembayaran",
                         fitur: "pembayaran",             null = terbuka untuk
                         teks: "..." }                    semua panitia

   Menambah jenis ketujuh menuntut tiga tempat berubah sekaligus: perakit di
   app.js, perakit cetaknya, dan tes bentuk di tests/buku_sakti.test.mjs.
   Sebelum menambahnya, periksa dulu apakah salah satu dari enam yang ada
   sudah cukup — hampir selalu cukup.

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
  ringkas: "Urutan kerja satu edisi HRCD, dari menyiapkan edisi baru sampai papan juara dan pembersihan sesudah acara.",
  bagian: [
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
          teks: "Isi Waktu Berangkat Pertama, Waktu Berangkat Terakhir, jumlah regu Eksternal dan Intern; layar ini menghitung rekomendasi berapa kloter yang terbentuk beserta jam berangkat tiap kloter. Dipakai untuk memastikan seluruh kloter masih masuk jendela sebelum angkanya dikunci.",
        },
        {
          jenis: "langkah",
          butir: [
            "Tetapkan tanggal lomba di baris edisi. Seluruh perkiraan jam berangkat dihitung dari tanggal ini, jadi jangan pernah menulis tanggal di dalam kode atau di skrip apa pun.",
            "Tetapkan jendela keberangkatan 07:00 sampai 10:00 dan jeda MAKSIMAL antar keberangkatan 5 menit sebagai konfigurasi edisi, bukan sebagai angka tetap. Jeda itu batas atas: kalau kloternya sedikit, yang terakhir berangkat jauh sebelum ujung jendela.",
            "Isi daftar pos, lomba, dan penilaian beserta poin maksimalnya. Bobot sebuah pos tidak pernah ditulis di mana pun: ia adalah jumlah poin maksimal seluruh wahana di pos itu.",
            "Isi pilihan kontrak waktu (3 jam, 3,5 jam, 4 jam) dan konfigurasi penalti.",
            "Isi stok nomor dada dua deret: Eksternal 1 sampai 500, Intern 1001 sampai 1250.",
            "Buka Kalkulator Keberangkatan dan pastikan kloter terakhir masih berangkat sebelum 10:00.",
            "Sesudah PR mendarat, jalankan workflow Apply migration to Supabase untuk tiap berkas migration, satu per satu, lalu baca notice yang keluar.",
            "Jalankan supabase/checks/status_migrasi.sql lewat workflow yang sama untuk membuktikan migration-nya benar-benar hidup di database.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Migration tidak pernah ikut merge. Berkas yang di-merge tapi tidak pernah dijalankan tidak menimbulkan satu galat pun: CI tetap hijau dan layar tetap menyala. Sepuluh migration pernah menganggur enam hari seperti itu, dan yang menemukannya adalah seorang pembina yang ditolak saat mendaftarkan regu Intern.",
        },
        {
          jenis: "poin",
          butir: [
            "Aturan penilaian adalah data, bukan kode. Tiap tahun angkanya berubah tanpa satu baris kode disentuh.",
            "Memindahkan satu lomba dari satu pos ke pos lain mengubah bobot KEDUA pos itu tanpa satu angka pun diedit.",
            "Status migrasi sendiri baru mencakup sampai berkas 0163. Berkas yang lebih muda belum ikut diperiksa, jadi jangan membaca laporan hijau sebagai jaminan penuh.",
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
          teks: "Regu yang belum lunas tidak bisa daftar ulang dan tidak masuk penyebut kelengkapan pos. Antrean yang tertahan di sini akan muncul kembali sebagai antrean panjang di meja daftar ulang, satu hari sebelum lomba, saat tidak ada lagi waktu mengurusnya.",
        },
      ],
    },
    {
      kode: "tutorial-daftar-ulang",
      judul: "Daftar ulang dan nomor dada",
      isi: [
        {
          jenis: "p",
          teks: "Daftar ulang berjalan satu sampai dua hari sebelum lomba, biasanya dengan dua atau tiga meja paralel. Regu datang menyebut kode pembayaran, panitia mengonfirmasi nama regu dan sekolahnya, lalu MENGETIK nomor dada dari kain fisik yang sudah ada di tangan.",
        },
        {
          jenis: "layar",
          nama: "Meja Daftar Ulang",
          hash: "#/daftar-ulang",
          fitur: "daftar_ulang",
          teks: "Cari batch dengan kode pembayaran, isi nomor dada untuk seluruh regu sekolah itu sekaligus lewat satu tombol Simpan, dan tukar nomor yang kainnya rusak.",
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
            "Ada DUA deret. Eksternal 1 sampai 500. Intern 1001 sampai 1250.",
            "Kain Intern bertulis 001 diketik 1001, dan angka 1001 itulah yang tampil di seluruh layar, kertas, dan papan peserta. Kain barunya diberi angka 1 di depan supaya tidak ada terjemahan di kepala siapa pun.",
            "Kloter ditentukan SISTEM saat nomor dada tersimpan. Petugas tidak memilih kloter di layar ini.",
            "Tidak ada tanda tangan dan tidak ada centang konfirmasi di sistem. Konsekuensinya tidak ada catatan siapa mengonfirmasi apa dan kapan, jadi konfirmasi lisannya harus benar-benar dilakukan.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Blangko penilaian per lomba hanya memuat NOMOR DADA tanpa nama regu. Nomor dada yang salah setelah lomba dimulai bukan sekadar salah tulis: ia memindahkan seluruh nilai satu regu ke regu lain, dan tidak ada apa pun di kertas yang memperlihatkannya. Sebelum kertasnya dicetak, pembetulan cuma satu ketukan.",
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
            "Kuota otomatis per kloter: 5 Eksternal dan 3 Intern, dihitung TERPISAH.",
            "Urutannya FIFO murni. Yang lebih dahulu menyelesaikan daftar ulang mendapat kloter lebih awal.",
            "Sekolah tidak memengaruhi apa pun. Tidak ada pengacakan dan tidak ada lompatan kloter. Dua regu satu sekolah boleh sekloter kalau memang FIFO menempatkan mereka di sana.",
            "Pengacakan otomatis MELEWATI kloter yang sudah berangkat. Tanda cetak tidak menutup kloter untuk penambahan regu.",
            "Jangan pernah menomori kloter sendiri. Kalau perlu disusun ulang, bersihkan datanya lalu jalankan ulang alurnya.",
          ],
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
          teks: "Bersihkan data harus mengembalikan penomoran kloter ke 1. Produksi pernah memulai pembagian dari kloter 17 karena 24 kloter pertama masih menyandang tanda cetak dari percobaan sebelumnya, dan panitia menghabiskan pagi mencari enam belas kloter yang tidak pernah ada.",
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
            "Urutkan kertasnya menurut nomor dada sebelum diinput — tabelnya juga berurut begitu, deret 1 sampai 500 dulu lalu 1001 ke atas — lalu masukkan berurutan lewat Input Nilai Tabel.",
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
            "Yang ditolak server — nilai di luar rentang, regu tergembok, komponen bukan untuk golongan itu — dilaporkan merah saat itu juga selagi regunya masih di depan petugas, dan tidak masuk antrean.",
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
            "Penalti pos terlewat dan penalti anggota TIDAK berlaku bagi regu Intern.",
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
          teks: "Live Score bukan cuma papan skor; sepanjang lomba ia adalah alat memantau kelengkapan. Di kartu Status ada satu cincin per pos: persennya di dalam cincin, dan di bawahnya berapa regu yang nilainya sudah LENGKAP dibanding berapa regu yang seharusnya dinilai di pos itu.",
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
            "Tekan Refresh kalau angkanya terasa basi. Sejak migrasi 0165 tombol itu MENGHITUNG ULANG, bukan sekadar membaca ulang snapshot lama — dan di luar tanggal lomba penyegaran otomatis memang mati, jadi tombol inilah satu-satunya yang memperbaruinya.",
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
          teks: "Penerbitannya BUKAN tombol di layar panitia. Yang ada di layar cuma saklar fase; yang menulis berkasnya adalah workflow Publish rekap live di GitHub Actions, dijalankan dari tab Actions — dan itu bisa dari HP. Pesan yang muncul sesudah saklar digeser pun menyuruh hal yang sama.",
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
            "Catat hal-hal yang belum ada layarnya supaya kepanitiaan berikutnya tidak mencarinya di hari-H: penempatan barak belum punya layar di aplikasi panitia, upload nilai massal belum dibangun sama sekali, dan foto borongan masih ditautkan ke nomor dada dengan tangan.",
            "Catat juga apa yang tahun ini berubah angkanya — bobot lomba, kontrak waktu, stok nomor dada — supaya edisi berikutnya tahu apa yang harus ditinjau ulang.",
          ],
        },
      ],
    },
  ],
};
const BAB_SEKSI = {
  kode: "seksi",
  judul: "Tugas Pokok Seksi",
  tab: "Seksi",
  ikon: "users",
  warna: "magenta",
  ringkas: "Usulan pembagian seksi kepanitiaan HRCD, dipetakan ke layar dan akun yang benar-benar ada di sistem.",
  bagian: [
    {
      kode: "seksi-cara-membaca",
      judul: "Cara membaca bab ini",
      isi: [
        {
          jenis: "p",
          teks: "Daftar seksi di bawah ini adalah USULAN, bukan aturan. Nama seksi tidak tersimpan di database mana pun, tidak dipakai satu baris kode pun, dan tidak pernah ditulis di dokumen edisi sebelumnya — waktu bab ini disusun, satu-satunya pembagian kerja yang benar-benar tertulis di sistem adalah lima peran akun dan sebelas centang fitur. Jadi susun ulang seksinya sesuka kepanitiaan tahun ini; yang harus tetap cocok cuma pemetaan ke lima peran itu.",
        },
        {
          jenis: "p",
          teks: "Angka yang dipakai sebagai acuan di seluruh bab ini diambil dari HRCD XXXVII, 29 Agustus 2026: sekitar 300 regu, kurang lebih 2.500 peserta, lima pos penilaian, dan jendela keberangkatan 07:00 sampai 10:00. Edisi biasanya jatuh di Februari atau Maret, jadi jangan menyalin tanggalnya — salin ukurannya.",
        },
        {
          jenis: "poin",
          butir: [
            "Tiap seksi dibuka satu paragraf tugas pokok, lalu daftar tugas konkret, lalu tabel kapan pekerjaan itu jatuh.",
            "Blok layar menyebut nama layar, alamatnya, dan centang fitur yang harus ada di akun supaya layar itu terbuka.",
            "Blok kenapa di akhir tiap seksi berisi alasan pembagiannya, atau satu kesalahan yang seksi itu paling sering buat.",
            "Seksi tanpa blok layar memang tidak memegang layar apa pun; angka yang dibutuhkannya diminta ke seksi yang memegangnya.",
            "Jam di kolom Kapan adalah usulan susunan hari, bukan angka yang tersimpan di sistem. Yang benar-benar terkunci cuma jendela keberangkatan 07:00 sampai 10:00 dan jarak antar kloter paling lama 5 menit — dan bahkan keduanya duduk di konfigurasi edisi, jadi tahun depan bisa berbeda.",
            "Sistem tidak menyimpan nama panitia. Satu akun cuma punya username, peran, kolom pos, dan status aktif, jadi daftar siapa memegang akun mana harus ditulis di luar sistem.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Peran akun", "Centang bawaan dan kolom pos"],
          baris: [
            ["admin", "Sebelas centang, semuanya: pendaftaran, pembayaran, daftar ulang, cetak kloter, keberangkatan, kedatangan, pos, live score, rekap, akun, pengaturan. Kolom pos wajib kosong."],
            ["registrasi", "Lima: pendaftaran, pembayaran, daftar ulang, cetak kloter, live score. Kolom pos wajib kosong."],
            ["gerbang", "Tiga: keberangkatan, kedatangan, live score. Kolom pos wajib kosong."],
            ["juri_pos", "Dua: pos, live score. Kolom pos WAJIB diisi 1 sampai 5, dan isian itulah yang mengunci barisnya ke posnya sendiri."],
            ["koordinator_pos", "Dua yang sama persis: pos, live score. Kolom pos wajib KOSONG, dan kekosongan itu yang membuka kelima pos sekaligus."],
          ],
        },
        {
          jenis: "p",
          teks: "Satu peran sering tidak cukup. Seksi yang memegang dua pekerjaan sekaligus tetap dibuat dengan peran terdekat, lalu centangnya ditambah tangan di layar Akun — memang itu gunanya matriks centang. Dua hal yang harus diingat waktu menambah: fitur rekap hanya ada di paket admin, jadi siapa pun di luar admin yang perlu membaca rekap penuh harus dicentangkan manual; dan mengganti peran sesudahnya akan menghapus seluruh centang tangan itu lalu mengisinya ulang dari paket.",
        },
        {
          jenis: "layar",
          nama: "Akun",
          hash: "#/account",
          fitur: "akun",
          teks: "Tempat peran dan centang tiap akun diatur. Urutannya selalu: pilih perannya dulu, sesuaikan centangnya sesudahnya. Kotak Pos hanya bisa diisi untuk peran juri_pos.",
        },
        {
          jenis: "layar",
          nama: "Buku Sakti",
          hash: "#/buku-sakti",
          fitur: null,
          teks: "Bab ini sendiri, terbuka untuk semua akun panitia. Dua tombol di atasnya, Cetak Bab Ini dan Cetak Semua. Yang dicetak adalah pegangan, bukan pengganti orang yang menjelaskan.",
        },
        {
          jenis: "kenapa",
          teks: "Seksi adalah cara membagi orang; peran akun adalah cara membagi hak. Keduanya tidak wajib satu lawan satu — satu orang bisa memegang dua meja, dan satu seksi bisa berisi tiga akun dengan peran berbeda.",
        },
      ],
    },

    {
      kode: "seksi-ketua",
      judul: "Ketua Pelaksana dan Wakil",
      isi: [
        {
          jenis: "p",
          teks: "Ketua memegang keputusan yang tidak bisa diambil di meja: tanggal, biaya, susunan pos, siapa memegang akun apa, dan kapan nilai boleh diumumkan. Di dalam sistem jabatan ini tidak punya nama — beberapa layar hanya menulis hubungi koordinator kepada panitia yang kehilangan akses, dan koordinator itu ketua atau orang yang ditunjuknya. Wakil bukan cadangan yang menunggu: bagi wilayahnya sejak awal, satu memegang jalur administrasi (pendaftaran sampai daftar ulang), satu memegang jalur lapangan (keberangkatan sampai kedatangan).",
        },
        {
          jenis: "poin",
          butir: [
            "Menetapkan tanggal lomba dan biaya pendaftaran per regu — DUA angka, satu untuk Eksternal dan satu untuk Intern — lalu memastikan ketiganya benar-benar masuk ke sistem lewat pemegang fitur pengaturan.",
            "Menunjuk koordinator tiap seksi dan menyerahkan daftarnya ke administrator sistem sebelum akun dibuat.",
            "Memutuskan hal yang tidak boleh diputuskan sendiri oleh petugas meja: pembatalan keberangkatan, penyisipan regu terlambat ke kloter, dan sanksi.",
            "Memutuskan kapan fase live dinaikkan — Internal, Progress, Live, Top 10, Juara — dan mengumumkannya ke seksi rekap, bukan sebaliknya.",
            "Menjadi orang yang berdiri di titik paling mungkin macet pagi itu, bukan di ruang panitia.",
            "Menyerahkan Buku Sakti, daftar akun, dan catatan keputusan ke kepanitiaan berikutnya.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Tiga bulan sebelum", "Menyusun seksi, menunjuk koordinatornya, menetapkan tanggal dan kedua biaya pendaftaran."],
            ["Satu bulan sebelum", "Memimpin technical meeting pembina; mengunci susunan pos, lomba, dan bobot nilai supaya angkanya tidak berubah lagi sesudah blangko dicetak."],
            ["H-7", "Gladi: seluruh alur dijalankan memakai data uji, dari pendaftaran sampai daftar juara, dengan orang yang sungguhan akan memegangnya."],
            ["Hari lomba", "Berdiri di upacara, garis start, lalu meja daftar ulang. Memutuskan di tempat dan memberitahukan keputusannya ke seksi yang terkena."],
            ["Sesudah acara", "Menurunkan fase live, memerintahkan password bersama dikembalikan ke acak, memimpin evaluasi dan serah terima."],
          ],
        },
        {
          jenis: "layar",
          nama: "Home",
          hash: "#/home",
          fitur: null,
          teks: "Ubin yang muncul di Home adalah cerminan centang akun, bukan daftar menu tetap. Akun admin melihat empat belas ubin; kalau seorang panitia melapor ubinnya tidak ada, yang salah hampir selalu centangnya, bukan layarnya.",
        },
        {
          jenis: "kenapa",
          teks: "Sistem tidak mengenal jabatan, ia hanya mengenal centang — jadi wewenang ketua tidak otomatis jadi hak di layar: membatalkan keberangkatan ada di balik fitur pengaturan, dan kalau akun ketua tidak dicentang itu, keputusannya harus dititipkan ke orang lain di tengah antrean.",
        },
      ],
    },

    {
      kode: "seksi-sekretaris",
      judul: "Sekretaris",
      isi: [
        {
          jenis: "p",
          teks: "Sekretaris memegang semua yang berbentuk surat dan catatan: proposal, undangan pangkalan, surat izin tempat, notulen rapat, daftar hadir, sertifikat, dan laporan akhir. Sekretaris tidak memasukkan satu angka pun ke sistem, tapi dialah yang menyimpan alasan di balik angka-angka itu — database mencatat apa yang berubah dan siapa yang mengubahnya, tidak pernah kenapa.",
        },
        {
          jenis: "poin",
          butir: [
            "Menyiapkan surat undangan pangkalan, surat izin tempat dan jalur, serta surat tugas juri.",
            "Menulis notulen tiap rapat, terutama keputusan yang mengubah angka di sistem: biaya pendaftaran, bobot pos, kontrak waktu, aturan penalti.",
            "Mencatat siapa memegang username apa, karena sistem hanya menyimpan username — tidak ada kolom nama orang di mana pun.",
            "Menyusun sertifikat dan piagam dari daftar juara sesudah pengumuman, memakai nama regu persis seperti yang tersimpan.",
            "Mengarsipkan satu salinan blangko tiap lomba, satu salinan daftar kloter, dan satu salinan rekap akhir sebagai bukti fisik.",
            "Menyusun laporan pertanggungjawaban bersama bendahara sesudah acara.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Tiga bulan sebelum", "Proposal, surat izin tempat, dan surat ke pangkalan; nomor surat dibuka dan dicatat urut sejak baris pertama."],
            ["Tiap rapat", "Notulen ditulis di hari yang sama. Keputusan yang menyangkut angka disalin terpisah supaya mudah dicari tahun depan."],
            ["H-3", "Menyiapkan daftar hadir pembina dan tamu, serta blanko sertifikat yang tinggal diisi nama."],
            ["Sesudah pengumuman", "Mengambil daftar juara dari layar Kejuaraan, mencetak sertifikat, dan menyerahkan arsip lengkap ke ketua."],
          ],
        },
        {
          jenis: "layar",
          nama: "Data Peserta",
          hash: "#/data-peserta",
          fitur: "pendaftaran",
          teks: "Sumber tunggal nama regu, sekolah, ketua, dan anggota untuk daftar hadir dan sertifikat. Salin dari sini, jangan dari file rekap edisi lalu yang ejaan sekolahnya sudah dibetulkan sesudahnya.",
        },
        {
          jenis: "layar",
          nama: "Kejuaraan",
          hash: "#/kejuaraan",
          fitur: "live_score",
          teks: "Daftar juara beserta skornya. Nama regu di layar ini adalah nama yang akan tercetak di sertifikat — kalau ada salah tulis, perbaiki lewat pemegang fitur pendaftaran sebelum mencetak, bukan sesudahnya.",
        },
        {
          jenis: "kenapa",
          teks: "Riwayat di database mencatat apa yang berubah dan oleh siapa, tetapi tidak pernah alasannya; notulen sekretaris adalah satu-satunya tempat alasan itu tersimpan, dan justru alasan itu yang dicari kepanitiaan tahun depan.",
        },
      ],
    },

    {
      kode: "seksi-bendahara",
      judul: "Bendahara — Meja Pembayaran",
      isi: [
        {
          jenis: "p",
          teks: "Bendahara memegang uang masuk dan uang keluar, dan di hari lomba ia duduk di Meja Pembayaran: memeriksa bukti transfer yang di-upload pembina, menerima pembayaran tunai, lalu menandai regu lunas. Tanda lunas itu bukan catatan pasif — ia yang membuka daftar ulang, jadi regu yang belum ditandai tidak akan pernah mendapat nomor dada.",
        },
        {
          jenis: "poin",
          butir: [
            "Menyusun anggaran dan menetapkan biaya pendaftaran per regu bersama ketua, sebelum form pendaftaran dibuka.",
            "Membuka bukti transfer yang di-upload pembina di form pendaftaran, mencocokkan nominal dan jamnya dengan mutasi rekening, baru menandai lunas.",
            "Menerima pembayaran tunai di meja lalu memilih metode tunai waktu menekan Tandai Lunas. Metode yang dipilih pembina saat mendaftar cuma niat — yang masuk laporan keuangan adalah yang dicatat di meja ini.",
            "Mengingat satu pendaftaran bisa memuat beberapa regu sekaligus — satu bukti bayar bisa melunasi tiga regu, dan tiga regu itu semuanya harus ikut tertandai.",
            "Membuka meja pembayaran 2 sampai 3 buah pada hari lomba, tiap meja dijaga 1 sampai 2 orang.",
            "Menyusun laporan keuangan bersama sekretaris sesudah acara.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Dua bulan sebelum", "Anggaran disusun, biaya per regu ditetapkan, nomor rekening penerima disiapkan dan diuji dengan satu transfer kecil."],
            ["Sejak pendaftaran dibuka", "Memeriksa bukti transfer tiap hari, jangan menumpuk. Regu yang lunas lebih awal berhak antre daftar ulang lebih awal."],
            ["H-1", "Menyapu sisa pendaftaran yang bayarnya belum jelas dan menghubunginya lewat humas, bukan dibiarkan sampai pagi."],
            ["Hari lomba 05:30 sampai 09:00", "Melayani pembayaran tunai dan bukti transfer yang baru masuk; meja ini berdiri sebelum meja daftar ulang."],
            ["Sesudah acara", "Menutup buku, mencocokkan total penerimaan dengan jumlah regu lunas di sistem."],
          ],
        },
        {
          jenis: "layar",
          nama: "Meja Pembayaran",
          hash: "#/pembayaran",
          fitur: "pembayaran",
          teks: "Daftar pendaftaran beserta bukti bayarnya dan tombol tandai lunas. Akun yang dipakai berperan registrasi, yang sudah membawa centang pembayaran; hitungan di kepala layar dihitung dari data yang diterima, jadi jangan menilai dari angka itu — hitung barisnya.",
        },
        {
          jenis: "kenapa",
          teks: "Kesalahan khas seksi ini: menandai lunas dulu supaya antrean jalan, dengan niat mencocokkan uangnya nanti. Tanda lunas langsung membuka daftar ulang, regu itu berangkat membawa nomor dada, dan yang tersisa untuk menagih cuma nomor WA pembina yang sedang berjalan di rute.",
        },
      ],
    },

    {
      kode: "seksi-kesekretariatan",
      judul: "Seksi Kesekretariatan dan Pendaftaran",
      isi: [
        {
          jenis: "p",
          teks: "Seksi ini adalah pintu masuk acara. Sebagian besar regu mendaftar sendiri lewat form online yang diisi pembina, tetapi meja pendaftaran offline tetap dibuka 2 sampai 3 buah untuk pembina yang datang langsung. Pekerjaan terberatnya bukan menerima, melainkan menjaga data tetap bersih: nama regu unik, satu sekolah satu baris, dan nomor kontak yang benar-benar bisa dihubungi.",
        },
        {
          jenis: "poin",
          butir: [
            "Menyebarkan link form pendaftaran ke pangkalan bersama humas, dan menjawab pertanyaan pembina yang tersangkut di tengah form.",
            "Menjaga nama regu unik di seluruh acara: dua regu dari sekolah yang sama ditulis NAMA 1 dan NAMA 2, tabrakan antar sekolah dibedakan dengan ekor nama sekolah.",
            "Menjaga satu sekolah satu baris. Pembeda dua sekolah senama ditulis di dalam namanya sendiri, misalnya MAN 3 Ciamis dan MAN 3 Tasikmalaya; kalau tidak ada tabrakan, jangan tambahkan ekor apa pun.",
            "Membetulkan salah ketik lewat Data Peserta. Yang bisa diubah di sana cuma tulisan: nama regu, nama kontak, dan nomor WA pembina. Golongan, sekolah, nomor dada, dan status bayar punya jalurnya sendiri.",
            "Menyerahkan hitungan regu terakhir ke perlengkapan dan konsumsi begitu pendaftaran ditutup.",
            "Menyiapkan meja offline: 2 sampai 3 meja, tiap meja 1 sampai 2 orang, dengan satu laptop yang sudah login sebelum peserta datang.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Dua bulan sebelum", "Form pendaftaran dibuka; link disebar ke pangkalan lewat surat dan media sosial."],
            ["Sepanjang pendaftaran", "Memantau regu masuk tiap hari; menyapu nama regu kembar dan sekolah kembar selagi jumlahnya masih puluhan, bukan ratusan."],
            ["H-3", "Menutup pendaftaran online, mengunci daftar regu, menyerahkan hitungan akhir ke perlengkapan dan konsumsi."],
            ["Hari lomba pagi", "Melayani pendaftaran susulan di meja kalau ketua mengizinkan, lalu mengarahkannya ke meja pembayaran."],
          ],
        },
        {
          jenis: "layar",
          nama: "Pendaftaran",
          hash: "#/home",
          fitur: "pendaftaran",
          teks: "Ubin Pendaftaran di Home membuka form pendaftaran di situs peserta — form yang sama persis dengan yang diisi pembina di rumah. Meja offline mengisi form itu untuk pembina yang datang, bukan mengetik langsung ke database.",
        },
        {
          jenis: "layar",
          nama: "Data Peserta",
          hash: "#/data-peserta",
          fitur: "pendaftaran",
          teks: "Seluruh regu, sekolahnya, ketua, anggota, dan nomor kontak pembina. Di sinilah nama regu dan nomor kontak dibetulkan, dan tiap perubahan masuk riwayat sendiri: siapa mengubah, kapan, dan dari apa ke apa.",
        },
        {
          jenis: "kenapa",
          teks: "Sekolah kembar terlihat sepele sampai daftar sekolah dibuka pembina berikutnya: satu sekolah pernah muncul tiga kali di kotak pilihan pendaftaran, dan tiap salinannya membawa regunya sendiri ke rekap yang berbeda.",
        },
      ],
    },

    {
      kode: "seksi-daftar-ulang",
      judul: "Seksi Daftar Ulang",
      isi: [
        {
          jenis: "p",
          teks: "Seksi ini mengubah regu yang terdaftar jadi regu yang ada di lapangan: mencocokkan jumlah anggota, menyerahkan nomor dada, dan menempatkan regu ke kloter. Penempatan kloter dikerjakan sistem, bukan orang — pengacakan otomatis mengisi kloter paling awal yang belum berangkat secara FIFO, maksimal 5 regu Eksternal dan 3 regu Intern per kloter, dan sekolah tidak berpengaruh sama sekali.",
        },
        {
          jenis: "poin",
          butir: [
            "Memanggil regu yang sudah lunas, mencocokkan jumlah anggota yang hadir dengan daftar, lalu memberi nomor dada.",
            "Menyerahkan nomor dari deret yang benar. Stok XXXVII: Eksternal 1 sampai 500, Intern 1001 sampai 1250 — angka itu isi stok kain, bukan aturan di kode, jadi panitia berikutnya mengubah stoknya. Golongan regu yang menentukan deretnya, dan golongan yang sama itu juga yang menentukan kuota kloternya.",
            "Menukar nomor dada yang rusak lewat tombol tukar di layar, bukan dengan menyerahkan nomor cadangan diam-diam — nomor yang tidak tercatat tidak akan ketemu lagi di rekap.",
            "Membiarkan sistem menomori kloter. Jangan menulis nomor kloter sendiri; kalau susunannya kacau, bersihkan lalu jalankan ulang alurnya.",
            "Mencetak daftar kloter dan menempelnya di papan pengumuman utama dan di barak, supaya pembina berhenti bertanya di meja.",
            "Menyisipkan regu terlambat ke kloter secara manual hanya atas keputusan ketua, dan menyebutkan konsekuensinya waktu meminta keputusan itu.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["H-1", "Kain nomor dada diurutkan dan dipisah per deret; daftar regu lunas dicetak sebagai cadangan kalau jaringan mati."],
            ["Hari lomba 05:30", "Meja dibuka sebelum peserta datang: 2 sampai 3 meja, tiap meja 1 sampai 2 orang, laptop sudah login."],
            ["05:30 sampai 09:30", "Daftar ulang berjalan bersamaan dengan keberangkatan — kloter berikutnya terisi sementara kloter sebelumnya sudah jalan."],
            ["Tiap kloter penuh", "Mencetak daftar kloter dan menempelnya; satu orang khusus mengurus tempel-menempel supaya meja tidak berhenti."],
            ["Sesudah kloter terakhir", "Mencetak daftar kloter final dan menyerahkan salinannya ke seksi kedatangan."],
          ],
        },
        {
          jenis: "layar",
          nama: "Meja Daftar Ulang",
          hash: "#/daftar-ulang",
          fitur: "daftar_ulang",
          teks: "Pemberian nomor dada, penukaran nomor rusak, dan pengacakan otomatis ke kloter. Akun yang dipakai berperan registrasi.",
        },
        {
          jenis: "layar",
          nama: "Daftar Kloter",
          hash: "#/cetak-kloter",
          fitur: "cetak_kloter",
          teks: "Lembar daftar isi tiap kloter untuk ditempel dan dibawa ke garis start. Tanda sudah tercetak tidak menutup kloter — regu masih boleh ditambahkan, dan mencetak ulang selembar itu murah.",
        },
        {
          jenis: "kenapa",
          teks: "Penalti waktu dihitung dari jam berangkat KLOTER, bukan dari jam regu benar-benar jalan; menyisipkan regu terlambat ke kloter yang sudah berangkat berarti regu itu dianggap berangkat sejam yang lalu, dan kontrak waktunya habis sebelum ia sampai pos pertama.",
        },
      ],
    },

    {
      kode: "seksi-keberangkatan",
      judul: "Seksi Keberangkatan",
      isi: [
        {
          jenis: "p",
          teks: "Seksi ini memegang garis start — bernomor 0 di daftar pos, bernama Keberangkatan, dan peserta menyebutnya Pos 0 — beserta upacara pembukaan dan dua titik tunggu di belakangnya. Tidak ada nilai yang dicatat di sana, cuma waktu. Seluruh kloter harus jalan antara 07:00 dan 10:00 dengan jarak antar kloter paling lama 5 menit, jadi pekerjaannya adalah menjaga irama: selalu ada kloter berikutnya yang sudah berdiri rapi waktu kloter sekarang dilepas.",
        },
        {
          jenis: "poin",
          butir: [
            "Menjalankan upacara pembukaan, lalu mempersilakan pejabat undangan memberangkatkan kloter 1 untuk foto. Ini bukan keterlambatan yang harus dihemat — ini alasan acara punya garis start yang layak difoto.",
            "Menahan tiga kloter siap sekaligus: kloter 1 di Pemberangkatan, kloter 2 di Staging 1, kloter 3 di Staging 2.",
            "Menyusun formasi upacara terbalik — kloter terakhir di depan, kloter 4, 5, dan 6 di belakang dekat jalan keluar, karena merekalah yang berikutnya dipanggil.",
            "Mencatat jam berangkat tiap kloter dari jam sungguhan di kertas, lalu memasukkannya ke sistem. Di meja ini KERTAS yang jadi pencatat utama dan laptop yang memverifikasi — kebalikan dari meja finish. Satu orang mencatat, satu orang mengetik, duduk bersebelahan.",
            "Mengonfirmasi kontrak waktu tiap regu — 3 jam, 3,5 jam, atau 4 jam — tiga kloter sebelum ia berangkat, dan memastikan pembina tahu jam berapa regunya ditunggu di finish.",
            "Menyerahkan orang dan meja ke seksi kedatangan begitu kloter terakhir jalan.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["H-1", "Menandai titik Pemberangkatan, Staging 1, dan Staging 2; menyepakati satu jam acuan — semua pencatatan memakai jam itu, bukan jam masing-masing HP."],
            ["06:00", "Formasi upacara disusun terbalik; tiga kloter pertama ditarik ke titiknya sebelum barisan rapat."],
            ["07:00", "Upacara, lalu kloter 1 diberangkatkan pejabat undangan."],
            ["07:00 sampai 10:00", "Kloter dilepas berurutan dengan jarak paling lama 5 menit; jamnya dicatat di kertas lalu diketik ke sistem."],
            ["10:00", "Kloter terakhir jalan. Titik staging dibongkar dan orangnya pindah ke garis finish."],
          ],
        },
        {
          jenis: "layar",
          nama: "Keberangkatan",
          hash: "#/keberangkatan",
          fitur: "keberangkatan",
          teks: "Ceklis kehadiran per nomor dada, kontrak waktu per regu, pemindahan regu antar kloter, dan kotak jam berangkat per kloter yang memang DIKETIK — bukan tombol, karena angkanya disalin dari kertas. Akun yang dipakai berperan gerbang, yang membawa centang keberangkatan, kedatangan, dan live score.",
        },
        {
          jenis: "layar",
          nama: "Kalkulator Keberangkatan",
          hash: "#/pengaturan-kloter",
          fitur: "pengaturan",
          teks: "Perkiraan jam berangkat tiap kloter, dipakai untuk menjawab pertanyaan pembina di lapangan. Perkiraan, bukan catatan — dan layar ini ada di balik fitur pengaturan, jadi akun gerbang biasa tidak membukanya.",
        },
        {
          jenis: "kenapa",
          teks: "Perkiraan dan catatan tidak pernah boleh masuk ke kolom yang sama. Kesalahan khas seksi ini adalah mengetik jam perkiraan supaya layar cepat penuh lalu lupa membetulkannya — dan seluruh penalti waktu regu di kloter itu jadi salah tanpa satu pun galat muncul.",
        },
      ],
    },

    {
      kode: "seksi-kedatangan",
      judul: "Seksi Kedatangan — Finish",
      isi: [
        {
          jenis: "p",
          teks: "Garis finish dan garis start adalah tempat yang sama dengan dua nama menurut arah lari — peserta menyebutnya Pos 6 saat kembali — tetapi orangnya bekerja terbalik: di keberangkatan kertas yang jadi pencatat utama dan laptop yang memverifikasi, di finish laptop yang mencatat langsung dan kertas yang jadi cek silang. Meja closing sengaja dibuat SATU, paling banyak dua, supaya urutan kedatangan tidak pecah.",
        },
        {
          jenis: "poin",
          butir: [
            "Mengetik nomor dada, memastikan detail regunya benar, lalu menekan SAMPAI DI FINISH begitu regu tiba. Jam yang tersimpan adalah jam saat tombol ditekan, jadi menundanya berarti menambah penalti yang tidak terjadi.",
            "Menjaga satu jalur antrean masuk. Regu yang menumpuk diminta berbaris, bukan dilayani meja tambahan — kalau tetap menumpuk, catat jam datangnya di kertas dulu lalu ketik menyusul, karena kotak jamnya memang bisa diubah tangan.",
            "Mencocokkan jumlah regu datang dengan jumlah regu berangkat per kloter, bukan hanya totalnya.",
            "Menerima kembali barang pinjaman dan mengarahkan regu ke barak supaya lapangan finish tidak penuh.",
            "Melaporkan regu yang jauh melewati kontrak waktunya ke seksi keamanan, jangan menunggu ditanya.",
            "Menyerahkan daftar kedatangan lengkap ke seksi rekap sebelum penilaian ditutup.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["H-1", "Menyiapkan meja closing, jalur antrean, papan urutan kedatangan, dan salinan kertas daftar kloter."],
            ["10:00", "Meja dibuka begitu kloter terakhir jalan; orang dari titik staging pindah kemari."],
            ["10:00 sampai 14:00", "Jendela kedatangan, dihitung dari berangkat 07:00 sampai 10:00 ditambah kontrak 3 sampai 4 jam. Ini jam tersibuk seluruh acara dan jamnya bertabrakan dengan makan siang."],
            ["Sesudah regu terakhir", "Mencocokkan daftar berangkat dan daftar datang; regu yang belum datang diserahkan ke keamanan untuk disusuri."],
          ],
        },
        {
          jenis: "layar",
          nama: "Kedatangan",
          hash: "#/finish",
          fitur: "kedatangan",
          teks: "Kotak nomor dada, kartu regu untuk dipastikan, dan satu tombol besar SAMPAI DI FINISH. Jam datang dan anggota hadir sengaja tidak sejajar dengan tombol itu — keduanya dipakai waktu membetulkan, bukan tiap regu. Akun yang dipakai berperan gerbang, sama persis dengan akun garis start, karena orangnya memang pindah dari sana.",
        },
        {
          jenis: "kenapa",
          teks: "Kesalahan khas seksi ini adalah menambah meja kedua dan ketiga waktu antrean menumpuk: dua meja tidak pernah mencatat dari jam yang sama, urutan kedatangan langsung pecah, dan di sini selisih satu menit bernilai satu poin — ke dua arah, karena datang terlalu cepat dihukum sama beratnya dengan terlambat.",
        },
      ],
    },

    {
      kode: "seksi-lomba",
      judul: "Seksi Lomba dan Juri Pos",
      isi: [
        {
          jenis: "p",
          teks: "Seksi ini yang membuat acara punya isi: lima pos, masing-masing berisi beberapa lomba, dan tiap lomba berisi satu atau beberapa penilaian. Susunan edisi XXXVII adalah Pos 1 Kepramukaan, Pos 2 Halang Rintang, Pos 3 P3K, Pos 4 PBB, dan Pos 5 Yel-Yel. Tiap pos dijaga minimal 5 orang tim lapangan ditambah 2 operator IT dengan laptop, dan tiap pos wajib punya sinyal, internet, dan sumber pengisian daya.",
        },
        {
          jenis: "poin",
          butir: [
            "Menyusun lomba, kriteria penilaian, dan soal tiap pos, lalu menyerahkan angka bobotnya ke pemegang fitur pengaturan untuk dimasukkan sebelum blangko dicetak.",
            "Mencetak blangko: layar mencetak SATU master per lomba, dan mesin fotokopi di sekretariat yang menggandakannya. Pos 3 mencetak tiga master — Pembidaian, Kim Lihat, Kim Cium.",
            "Mengingat lomba soal tidak mencetak blangko sama sekali: peserta menjawab di lembar soalnya sendiri, jadi pos yang isinya soal semua tidak mencetak master apa pun.",
            "Menjalankan dua jalur di tiap pos yang menerima soal: jalur lomba yang dikerjakan di pos itu, dan jalur soal yang kertasnya diambil regu SEBELUM pos ini lalu diserahkan di sini. Nilainya masuk ke pos tempat kertas itu DISERAHKAN, bukan tempat ia diambil, jadi tidak ada angka yang harus dititipkan ke operator pos lain.",
            "Memfoto lembar jawaban per lomba lalu memasukkan nilainya per kloter, jangan menumpuk sampai sore.",
            "Menempatkan juri: juri satu pos memakai peran juri_pos dengan kolom pos diisi nomornya; juri keliling memakai peran koordinator_pos dengan kolom pos dikosongkan.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Dua bulan sebelum", "Menyusun daftar lomba dan kriterianya; menetapkan berapa poin tiap lomba dan berapa soal tiap kuis."],
            ["H-14", "Soal ditulis dan digandakan; blangko master dicetak dari layar lalu difotokopi sesuai perkiraan jumlah regu."],
            ["H-1", "Menata pos di lapangan dan menguji login akun pos DI LOKASI — sinyal di pos tidak sama dengan sinyal di sekolah."],
            ["08:00 sampai 15:00", "Menilai, memfoto lembar, memasukkan nilai. Kloter yang sudah lewat diselesaikan sebelum kloter berikutnya datang."],
            ["Sesudah regu terakhir", "Memastikan tidak ada kolom kosong di posnya sendiri sebelum melapor ke seksi rekap."],
          ],
        },
        {
          jenis: "layar",
          nama: "Input Nilai Per Lomba",
          hash: "#/pos2",
          fitur: "pos",
          teks: "Memasukkan nilai satu lomba untuk banyak regu sekaligus. Akun juri_pos hanya melihat barisan posnya sendiri; akun koordinator_pos melihat kelima pos karena kolom posnya kosong.",
        },
        {
          jenis: "layar",
          nama: "Input Nilai Tabel",
          hash: "#/pos",
          fitur: "pos",
          teks: "Bentuk tabel: satu kolom per penilaian, satu baris per regu. Lomba dengan lima kriteria muncul sebagai lima kolom di sini, sementara di kertas ia tetap satu blangko.",
        },
        {
          jenis: "layar",
          nama: "Foto Jawaban Sekaligus",
          hash: "#/foto",
          fitur: "pos",
          teks: "Upload foto lembar jawaban banyak regu sekaligus, dipasangkan ke nomor dada. Foto adalah bukti, bukan sumber nilai — kalau angkanya berselisih, yang memutuskan tetap orang.",
        },
        {
          jenis: "kenapa",
          teks: "Isolasi pos berlaku waktu MENULIS, tidak lagi waktu membaca: juri Pos 3 bisa melihat angka Pos 1 di Live Score sebelum diumumkan, dan itu keputusan pemilik acara, bukan celah — jadi jangan menutupnya diam-diam, dan jangan pula membacakannya kepada peserta.",
        },
      ],
    },

    {
      kode: "seksi-rekap",
      judul: "Seksi Rekap dan Skor",
      isi: [
        {
          jenis: "p",
          teks: "Seksi ini mengubah ribuan angka jadi satu peringkat yang dibacakan di lapangan. Pekerjaannya tiga: memeriksa nilai yang janggal sebelum jadi peringkat, menaikkan fase live sesuai keputusan ketua, dan menerbitkan rekap ke situs peserta. Nomor tiga inilah yang membuat angka benar-benar terlihat di HP penonton — 1.500 sampai 3.000 HP pada hari lomba.",
        },
        {
          jenis: "poin",
          butir: [
            "Menyisir tiap pos lewat Cek Nilai dengan saringannya: Belum Input, Belum Foto, Belum Kunci. Angka di sebelah tiap saringan adalah sisa pekerjaannya, dan yang dikejar sampai nol.",
            "Menaikkan fase live sesuai perintah ketua. Lima fase, dan tombolnya di layar memakai nama akibatnya: Internal (peserta tidak melihat apa pun), Progress (centang per komponen tanpa angka), Live (sama dengan yang dilihat panitia), Top 10 (sepuluh besar per golongan beserta totalnya), Juara (papan diganti daftar juara).",
            "Menjaga urutan kerja: naikkan fasenya dulu, jalankan penerbitan sesudahnya. Berlaku ke dua arah, termasuk waktu menurunkan fase kembali.",
            "Menjalankan workflow Publish rekap live tiap kali ada perbaikan nilai — halaman peserta tidak pernah menampilkan lebih dari isi berkas yang sudah terbit.",
            "Menyusun daftar juara di layar Kejuaraan sebelum dibacakan, lalu menerbitkannya sesudah dibacakan, bukan sebelum.",
            "Meminta centang rekap ke administrator sistem kalau perlu membaca rekap penuh, karena centang itu hanya ada di paket admin dan akan hilang kalau perannya diganti kemudian.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["H-1", "Menguji seluruh rantai memakai data uji: masukkan nilai, cek, terbitkan, lalu buka situs peserta di HP sungguhan."],
            ["Pagi hari lomba", "Fase Internal. Peserta belum melihat apa pun selain ajakan mendaftar."],
            ["Sesudah pos pertama terisi", "Fase Progress. Peserta melihat centang per komponen, jadi pembina tahu regunya sudah dinilai tanpa satu angka pun bocor."],
            ["Sore, sesudah nilai lengkap", "Fase Live atau Top 10 menurut keputusan ketua; terbitkan ulang tiap kali ada perbaikan."],
            ["Sesudah juara dibacakan", "Fase Juara, lalu terbitkan. Papan klasemen hilang dengan sendirinya dan daftar juara beserta skornya yang muncul."],
          ],
        },
        {
          jenis: "layar",
          nama: "Cek Nilai",
          hash: "#/cek-nilai",
          fitur: "pengaturan",
          teks: "Satu pos, satu regu, semua lombanya sekaligus: pindah regu lewat panah atau ketik nomor dadanya. Boleh membetulkan angka, memasang gembok, dan membuka gembok yang sudah terpasang. Layar ini di balik fitur pengaturan, bukan pos — supaya juri tidak bisa mengunci nilai lomba yang bukan pegangannya.",
        },
        {
          jenis: "layar",
          nama: "Live Score",
          hash: "#/live-score",
          fitur: "live_score",
          teks: "Papan klasemen panitia beserta saklar fasenya. TIDAK ADA tombol terbit di sini — menekan saklar cuma mengubah fase, dan layarnya sendiri yang mengingatkan supaya workflow Publish rekap live dijalankan sesudahnya. Melihat papannya cukup dengan centang live score; saklar fasenya cuma muncul untuk pemegang centang pengaturan.",
        },
        {
          jenis: "layar",
          nama: "Kejuaraan",
          hash: "#/kejuaraan",
          fitur: "live_score",
          teks: "Daftar juara per golongan, Juara Umum, dan Peserta Terbanyak, beserta angkanya. Tombol ubah di layar ini menuntut centang pengaturan.",
        },
        {
          jenis: "kenapa",
          teks: "Yang menahan nilai sebelum diumumkan adalah nilainya MEMANG TIDAK ADA di berkas yang terbit, bukan layar yang memilih tidak menggambarnya — berkas rekap duduk di CDN dan bisa diminta siapa pun yang tahu alamatnya, jadi menerbitkan terlalu cepat tidak bisa ditebus dengan menyembunyikan tampilan.",
        },
      ],
    },

    {
      kode: "seksi-perlengkapan",
      judul: "Seksi Perlengkapan",
      isi: [
        {
          jenis: "p",
          teks: "Seksi ini tidak memegang satu layar pun, tetapi hampir semua hitungannya diambil dari sistem: berapa regu, berapa kloter, berapa nomor dada, berapa lembar blangko. Kesalahan hitung di sini tidak bisa diperbaiki hari itu juga, jadi mintalah angkanya dari kesekretariatan secara tertulis, bukan dari perkiraan rapat.",
        },
        {
          jenis: "poin",
          butir: [
            "Menyiapkan alat tiap lomba sesuai daftar dari seksi lomba: tongkat, tali, tandu dan bidai, bendera semaphore, dan alat halang rintang.",
            "Menyiapkan kain nomor dada sesuai deretnya. Stok XXXVII: Eksternal 1 sampai 500, Intern 1001 sampai 1250, ditambah cadangan untuk yang rusak di lapangan. Berapa pun stok yang dibawa, angkanya harus dimasukkan ke sistem — pagar nomor dada membacanya dari sana.",
            "Mengurus fotokopi blangko di sekretariat: yang keluar dari printer cuma satu master per lomba, sisanya pekerjaan mesin fotokopi.",
            "Menyiapkan papan pengumuman utama dan papan barak tempat daftar kloter ditempel.",
            "Menyediakan listrik, meja, dan tempat teduh untuk dua laptop di tiap pos, serta sound system untuk upacara dan pengumuman juara.",
            "Menugaskan satu orang berkeliling pos membawa cadangan sepanjang hari, karena yang hilang selalu ketahuan waktu lomba sedang berjalan.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Satu bulan sebelum", "Mendata alat yang ada, yang rusak, dan yang harus dipinjam; mengurus surat pinjam lewat sekretaris."],
            ["H-7", "Meminta hitungan regu terakhir dari kesekretariatan. Jumlah nomor dada dan blangko ditentukan dari angka itu, bukan dari perkiraan."],
            ["H-1", "Memasang tenda pos, meja, papan, dan listrik; menguji sound system sampai bunyi, bukan sampai tersambung."],
            ["Hari lomba", "Menambal kekurangan di tempat; satu orang keliling membawa cadangan alat tulis, tali, dan blangko."],
            ["Sesudah acara", "Membongkar, menghitung ulang, dan mengembalikan pinjaman di hari yang sama selagi orangnya masih lengkap."],
          ],
        },
        {
          jenis: "kenapa",
          teks: "Kesalahan khas seksi ini adalah mencetak blangko satu lembar per regu langsung dari browser: blangko dikalikan di mesin fotokopi, bukan di printer, dan pos dengan tiga lomba memang hanya mencetak tiga halaman master — bukan seribu lima ratus.",
        },
      ],
    },

    {
      kode: "seksi-konsumsi",
      judul: "Seksi Konsumsi",
      isi: [
        {
          jenis: "p",
          teks: "Konsumsi mengurus makan dan minum peserta, panitia, juri, dan tamu undangan sepanjang hari yang dimulai jam lima pagi dan baru selesai sore. Jumlahnya besar — pada 300 regu jumlah peserta sekitar 2.500 orang — jadi angkanya harus diambil dari hitungan regu terakhir, dan jadwalnya harus menghindari jam tersibuk.",
        },
        {
          jenis: "poin",
          butir: [
            "Menghitung porsi dari jumlah regu terakhir dan jumlah panitia, lalu menambahkan cadangan untuk pendaftaran susulan.",
            "Menyiapkan air minum di lima pos, ditambah garis start dan garis finish. Pos yang jauh dari jalan diisi lebih dulu, bukan terakhir.",
            "Menjadwalkan makan panitia BERGILIR supaya tidak ada meja yang kosong; puncak kerja sistem jatuh sekitar jam dua belas siang.",
            "Menyediakan konsumsi tamu undangan dan pembina di tempat tersendiri, jauh dari antrean peserta.",
            "Mengatur pengiriman ke pos: kotak dihitung dan diserahterimakan per pos, bukan ditumpuk di satu titik lalu diambil siapa saja.",
            "Mengurus sisa makanan dan sampah sebelum tempat dikembalikan.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Satu bulan sebelum", "Memilih penyedia, mencicipi, dan menetapkan harga per porsi bersama bendahara."],
            ["H-7", "Mengunci jumlah porsi dari hitungan regu terakhir; menambah cadangan sepuluh persen untuk panitia yang bertambah di menit akhir."],
            ["Hari lomba 05:00", "Konsumsi panitia pagi sudah siap sebelum meja pembayaran dan meja daftar ulang dibuka."],
            ["10:00", "Mengirim air dan konsumsi ke lima pos selagi jalur belum penuh peserta yang pulang."],
            ["10:00 sampai 14:00", "Jendela kedatangan dan makan siang bertabrakan; siapkan dua jalur dan giliran makan panitia yang tidak bersamaan."],
          ],
        },
        {
          jenis: "kenapa",
          teks: "Kesalahan khas seksi ini bukan kurang porsi, melainkan menjadwalkan semua orang makan bersamaan — meja daftar ulang dan meja finish jadi kosong justru pada jam antreannya paling panjang.",
        },
      ],
    },

    {
      kode: "seksi-dokumentasi",
      judul: "Seksi Dokumentasi dan Publikasi",
      isi: [
        {
          jenis: "p",
          teks: "Seksi ini memegang foto, video, poster, dan media sosial acara. Satu hal harus dipisah tegas sejak hari pertama: foto dokumentasi dan foto lembar jawaban adalah dua benda berbeda. Yang kedua bukan pekerjaan seksi ini — itu bukti nilai, diambil juri lewat akun pos, dan tersimpan berkunci kode lomba, satu kolom foto untuk tiap lomba.",
        },
        {
          jenis: "poin",
          butir: [
            "Membuat poster dan materi pengumuman pendaftaran, lalu menyebarnya bersama humas.",
            "Menyusun daftar momen wajib sebelum hari-H: upacara, pemberangkatan kloter 1, tiap pos, garis finish, dan pengumuman juara.",
            "Menempatkan satu orang tetap di garis start sampai kloter terakhir jalan, karena momen itu tidak bisa diulang.",
            "Mengumumkan hasil ke media sosial HANYA sesudah dibacakan di lapangan, dan mengambil angkanya dari layar Kejuaraan, bukan dari bisik-bisik panitia pos.",
            "Menyiapkan penamaan file dan tempat penyimpanan foto sejak awal, supaya laporan tidak berhenti karena file tersebar di tujuh HP.",
            "Tidak menyentuh foto lembar jawaban sama sekali.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Dua bulan sebelum", "Poster dan pengumuman pendaftaran; link form disebar bersama humas dan kesekretariatan."],
            ["H-1", "Menyusun daftar momen wajib dan membagi orang per titik; mengisi baterai dan menyiapkan penyimpanan kosong."],
            ["Hari lomba", "Memotret dan merekam sesuai daftar; menyerahkan file ke satu tempat penyimpanan di akhir tiap sesi, bukan di akhir hari."],
            ["Sesudah pengumuman", "Upload hasil dan foto juara; menyerahkan laporan dokumentasi ke sekretaris."],
          ],
        },
        {
          jenis: "layar",
          nama: "Kejuaraan",
          hash: "#/kejuaraan",
          fitur: "live_score",
          teks: "Sumber resmi nama juara dan angkanya untuk pengumuman media sosial. Kalau seksi ini butuh akun, mintalah akun dengan centang live score saja — jangan meminjam akun pos, karena akun pos bisa menulis nilai.",
        },
        {
          jenis: "kenapa",
          teks: "Dua hal berbeda sama-sama disebut foto di acara ini, dan yang kedua adalah bukti: kalau lembar jawaban tercampur ke folder dokumentasi, yang hilang bukan kenangan melainkan dasar satu nilai yang sedang disengketakan.",
        },
      ],
    },

    {
      kode: "seksi-keamanan",
      judul: "Seksi Keamanan dan P3K",
      isi: [
        {
          jenis: "p",
          teks: "Seksi ini menjaga jalur, orang, dan barang dari sebelum peserta datang sampai sesudah regu terakhir pulang. Perhatikan satu tabrakan nama: P3K di acara ini juga nama Pos 3, yang menilai lomba pembidaian. Pos 3 adalah tempat lomba, bukan tempat berobat.",
        },
        {
          jenis: "poin",
          butir: [
            "Menyusuri rute sebelum hari-H, menandai penyeberangan jalan, tikungan, dan bagian yang jauh dari pos mana pun.",
            "Menyiapkan tim P3K berjalan yang bergerak di antara pos, ditambah satu titik tetap dekat garis finish.",
            "Memegang nomor puskesmas dan rumah sakit terdekat, serta menyepakati siapa yang mengantar kalau ada yang harus dibawa.",
            "Meminta daftar regu yang belum datang dari seksi kedatangan, lalu menyusurinya dari arah berlawanan.",
            "Mengatur parkir bus dan kendaraan pembina, serta menjaga barak — ruang kelas yang mejanya dikesampingkan jadi tempat menginap, diusahakan satu ruangan untuk satu sekolah.",
            "Mencatat tiap kejadian beserta jamnya dan menyerahkannya ke sekretaris, sekecil apa pun.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["H-14", "Menyusuri rute, menandai titik rawan, mengurus izin lewat dan koordinasi dengan aparat setempat."],
            ["H-1", "Menyiapkan kotak P3K tiap pos, tandu, dan pembagian tim penyusur; memeriksa penerangan jalur pagi."],
            ["07:00 sampai 10:00", "Menjaga penyeberangan di jalur awal — di jam ini lalu lintas peserta paling padat."],
            ["11:00 sampai 15:00", "Menyusuri jalur dari belakang mengikuti regu terakhir tiap kloter."],
            ["Sesudah regu terakhir datang", "Menyatakan jalur bersih ke ketua sebelum pos dibongkar, dan menyerahkan catatan kejadian."],
          ],
        },
        {
          jenis: "kenapa",
          teks: "Kesalahan khas seksi ini adalah menumpuk tim medis di Pos 3 karena namanya P3K — padahal yang paling sering butuh pertolongan adalah jalur di antara pos, tempat yang justru tidak dijaga siapa-siapa.",
        },
      ],
    },

    {
      kode: "seksi-humas",
      judul: "Seksi Humas dan Sponsor",
      isi: [
        {
          jenis: "p",
          teks: "Humas menghubungkan kepanitiaan dengan orang di luarnya: pangkalan yang diundang, pembina yang bertanya, sponsor, tamu undangan, dan pejabat yang memberangkatkan kloter 1. Di hari lomba tugasnya berubah jadi satu hal yang sangat konkret — menahan pertanyaan supaya tidak sampai ke meja yang sedang melayani antrean.",
        },
        {
          jenis: "poin",
          butir: [
            "Menyusun daftar pangkalan SMP dan SMA yang diundang, lalu mengirim undangan bersama sekretaris.",
            "Membuka SATU nomor kontak resmi yang dijaga bergilir, dan memastikan nomor itu benar-benar dijawab sampai malam.",
            "Mencari sponsor dan menyusun paket timbal baliknya bersama bendahara.",
            "Mengurus tamu undangan dan pejabat pemberangkat: kepastian hadir, penjemputan, tempat duduk, dan urutan acara upacara.",
            "Menjadi penghubung tunggal ke pembina selama hari lomba, termasuk menjelaskan perkiraan jam berangkat kloter.",
            "Menjaga nomor WA pembina tidak keluar dari sistem — nomor itu tidak boleh disalin ke daftar sponsor, ke grup mana pun, atau ke file yang beredar.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["Tiga bulan sebelum", "Menyusun daftar pangkalan dan daftar calon sponsor; menyiapkan proposal bersama sekretaris."],
            ["Dua bulan sebelum", "Mengirim undangan dan membuka nomor kontak resmi bersamaan dengan dibukanya form pendaftaran."],
            ["H-7", "Memastikan tamu undangan dan pejabat pemberangkat sudah menyatakan hadir; menyusun urutan acara upacara."],
            ["Hari lomba", "Mendampingi tamu, menjawab pembina, dan mengalihkan pertanyaan yang biasanya menghantam meja daftar ulang."],
            ["Sesudah acara", "Mengirim ucapan terima kasih ke pangkalan dan sponsor, beserta foto dan hasil lomba."],
          ],
        },
        {
          jenis: "layar",
          nama: "Data Peserta",
          hash: "#/data-peserta",
          fitur: "pendaftaran",
          teks: "Tempat nomor kontak pembina tersimpan. Kalau seksi ini perlu membukanya, akunnya berperan registrasi — dan yang boleh keluar dari layar ini cuma satu nomor yang sedang dihubungi, bukan daftarnya.",
        },
        {
          jenis: "kenapa",
          teks: "Data pribadi yang dipegang sistem ini cuma tiga: nomor WA pembina, nama ketua, dan nama anggota regu. Pagar penerbitan menolak mengirim nomor WA itu ke situs peserta — tapi pagar itu tidak berlaku untuk salinan yang dibuat orang dengan tangan.",
        },
      ],
    },

    {
      kode: "seksi-admin-sistem",
      judul: "Administrator Sistem",
      isi: [
        {
          jenis: "p",
          teks: "Bukan seksi lapangan, dan tidak perlu banyak orang — satu sampai dua cukup, dan keduanya harus tahu password akun organisasi, bukan hanya satu. Tugasnya membuat akun, mengatur centangnya, menjalankan penerbitan dan deploy, serta menjadi orang yang dicari waktu ada yang tidak bisa login. Akunnya berperan admin: sebelas centang, kolom pos wajib kosong.",
        },
        {
          jenis: "poin",
          butir: [
            "Membuat akun panitia sekaligus banyak lewat workflow Provision akun panitia. Password dibuat server, diambil dari Artifact, dan hilang otomatis tiga hari — jadi ambil dan bagikan segera.",
            "Mengganti password satu akun lewat Ganti password akun panitia, lalu membagikannya lewat WA japri, tidak pernah lewat grup.",
            "Menyetel password bersama untuk pagi simulasi atau hari lomba lewat Setel password bersama semua akun, dan WAJIB mengembalikannya ke acak sesudah acara selesai.",
            "Mengatur peran dan centang di layar Akun dengan urutan yang benar: pilih perannya DULU, sesuaikan centangnya SESUDAHNYA — mengganti peran menghapus seluruh centang tangan lalu mengisinya ulang dari paket peran.",
            "Membuat satu akun per ORANG, bukan satu akun per meja, supaya riwayat perubahan bisa ditelusuri ke orangnya.",
            "Menonaktifkan akun yang selesai dipakai: akun yang dinonaktifkan kehilangan seluruh haknya apa pun isi centangnya.",
            "Menjalankan penerbitan dan deploy dari tab Actions, termasuk dari HP kalau build otomatis menggantung.",
          ],
        },
        {
          jenis: "tabel",
          kepala: ["Kapan", "Yang dikerjakan"],
          baris: [
            ["H-14", "Membuat akun sesuai daftar dari ketua, satu akun per orang, lengkap dengan peran dan nomor pos untuk juri."],
            ["H-7", "Gladi. Tiap orang login dengan akunnya sendiri dan membuka layarnya sendiri; ubin yang kurang dibetulkan centangnya di tempat, saat itu juga."],
            ["Pagi hari lomba", "Memasang password bersama kalau ketua memutuskan begitu, dan mencatat jam pemasangannya."],
            ["Hari lomba", "Menjaga penerbitan berjalan dan menjadi orang yang dihubungi panitia yang tidak bisa masuk."],
            ["Sesudah acara", "Mengembalikan password ke acak, menonaktifkan akun yang selesai, menyerahkan daftar akun ke kepanitiaan berikutnya."],
          ],
        },
        {
          jenis: "layar",
          nama: "Akun",
          hash: "#/account",
          fitur: "akun",
          teks: "Daftar akun panitia, perannya, kolom posnya, dan matriks centang per fitur. Hak yang dicabut di sini langsung berlaku pada DATA, karena yang memutuskan ada di database — tetapi ubin di layar petugas baru menyesuaikan sesudah halamannya dibuka ulang, jadi minta ia me-refresh kalau ubinnya masih terlihat.",
        },
        {
          jenis: "layar",
          nama: "Ganti Password",
          hash: "#/ganti-password",
          fitur: null,
          teks: "Terbuka untuk semua akun, termasuk juri pos. Selain password baru ia minta satu kode konfirmasi, dan kode itu datang dari koordinator, bukan dari layarnya. Ajari tiap panitia mengganti passwordnya sendiri sesudah menerima password bersama — itu memindahkan pekerjaan dari satu orang ke sepuluh orang.",
        },
        {
          jenis: "kenapa",
          teks: "Yang menjaga pintu adalah centang fitur, bukan nama peran; peran cuma mengisi centang awal — jadi jangan pernah menambahkan pengecualian yang berdasar nama peran, karena centang bisa diubah panitia dari layar Akun sedangkan nama peran tidak.",
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
  ringkas: "Dua puluh dua keputusan yang membentuk sistem ini, alternatif yang ditolak, dan apa yang rusak kalau dibalik.",
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
          teks: "Kalau batas ini dilonggarkan, tagihan kejutan jatuh ke rekening pribadi pengurus lama, dan kuota yang habis mematikan SEMUA workflow — termasuk apply-migration dan tombol ganti password yang dipakai panitia dari HP.",
        },
      ],
    },
    {
      kode: "kenapa-supabase",
      judul: "Supabase, bukan Sheets, Firebase, atau laptop panitia",
      isi: [
        {
          jenis: "p",
          teks: "Empat kandidat dibandingkan sebelum satu dipilih. Yang menang Supabase karena tiga hal yang paling berbahaya kalau salah — nomor dada ganda, isolasi pos, dan riwayat perubahan — dijamin oleh platformnya sendiri lewat transaksi, RLS, dan trigger. Bukan oleh kehati-hatian orang yang sedang berdiri di meja dengan antrean di depannya.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak Google Sheets plus Apps Script: batas 30 eksekusi bersamaan dibagi ke SEMUA perangkat, dan tiap aksi berjeda 1 sampai 4 detik. Sepuluh meja bekerja bersamaan sudah menghabiskannya.",
            "Ditolak Firebase paket Spark: kuota 50.000 baca per hari tersentuh oleh belasan penonton yang refresh, dan kalau habis, database mati baca sampai jam 15:00 WIB — persis di tengah penilaian.",
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
          teks: "Kalau digabung, alamat yang diteruskan ke ratusan orang sekaligus menyebarkan pintu masuk panitia — dan beban ratusan HP yang refresh papan jatuh ke Worker yang sama dengan yang sedang dipakai meja bekerja.",
        },
      ],
    },
    {
      kode: "kenapa-berkas-statis",
      judul: "Peserta membaca file statis, dan situsnya sengaja tidak tersambung Git",
      isi: [
        {
          jenis: "p",
          teks: "Seluruh data peserta dan nilai datang dari dua file yang diterbitkan workflow: live.json berukuran sekitar 1 KB yang di-poll tiap 60 detik, dan rekap.json berukuran puluhan KB yang diambil sekali per versi, itu pun baru setelah peserta mengetik nama sekolahnya. Versi itu sidik jari ISI, jadi menerbitkan sepuluh kali tanpa nilai baru tidak membuat satu HP pun download ulang. Satu-satunya permintaan langsung dari HP peserta ke database adalah membaca saklar fase, v_fase_live, tiap 15 detik selama halamannya terlihat — satu nilai, bukan satu baris rekap pun.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak halaman peserta yang menarik seluruh rekap langsung dari Supabase: pesertanya 1.500 sampai 3.000 orang dan mereka membuka alamat yang sama berkali-kali dalam jendela waktu yang sama persis.",
            "Ditolak Realtime: koneksi terbuka per HP untuk data yang sebagian besar waktu tidak berubah sama sekali. Polling yang ada pun berhenti begitu tab tidak terlihat, dan jalan lagi begitu HP dibuka.",
            "Ditolak menyambungkan situs peserta ke Git seperti layar panitia. Yang di-deploy ke sana bukan isi repository melainkan live.json yang baru ditulis workflow dari database beberapa detik sebelumnya.",
            "Kalau tersambung Git, tiap push ke main menimpanya dengan file contoh fase pra yang memang ada di repository — rekap peserta mendadak kosong tanpa satu langkah pun yang gagal.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Kalau dibalik, tiga ribu HP menarik file gemuk tiap menit langsung dari database, dan papan peserta bisa dikosongkan di tengah acara oleh perbaikan warna tombol yang sama sekali tidak berhubungan.",
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
            "Ditolak layar menghitung poin di browser. Layar Input Nilai Tabel selalu membaca ulang angkanya dari v_lembar_pos tiap kali satu baris tersimpan, karena menghitung di browser melahirkan mesin skor kedua yang suatu hari berbeda pendapat dengan v_poin_pos.",
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
          teks: "Kalau skor disimpan atau dihitung di dua tempat, akan ada dua angka untuk satu regu, dan suatu hari keduanya berbeda pendapat — biasanya di panggung, saat juara dibacakan.",
        },
      ],
    },
    {
      kode: "kenapa-aturan-data",
      judul: "Aturan penilaian adalah data, bukan kode",
      isi: [
        {
          jenis: "p",
          teks: "Aturan skor berganti hampir tiap tahun. Karena itu tiap kolom penilaian adalah satu baris di tabel wahana, dengan enam bentuk konversi yang bisa dipilih. Layar Input Nilai Tabel membangun kolomnya dari baris-baris itu — nama dan urutannya dari wahana, bentuk kotaknya dari wahana, rentang yang boleh diketik dari wahana — jadi mengganti penilaian tahun depan tidak menyentuh satu baris kode pun.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak rumus dan bobot ditulis di kode aplikasi: panitia tahun depan harus mencari programmer untuk mengganti bobot satu lomba.",
            "Ditolak menghitung bobot pos dari CACAH lomba. Bobot pos adalah jumlah poin_maks seluruh wahana-nya. Memecah KIM jadi Kim Lihat dan Kim Cium di migration 0087 tidak mengubah satu poin pun, sedangkan memindah satu lomba antar pos mengubah bobot dua pos tanpa satu angka diedit.",
            "Salah baca yang paling sering: angka 0 sampai 10 di KIM itu RENTANG MENTAH, bukan bobot. Dibaca sebagai bobot, Pos 3 terlihat 220 padahal 400, dan KIM mulai terlihat seperti lomba yang perlu dinaikkan.",
            "Lomba berbentuk soal cukup satu angka: berapa jawaban benar. Rentang mentahnya harus sama dengan jumlah soalnya, karena rentang yang lebih longgar membiarkan petugas mengetik 12 dari 10.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Kalau aturan dipindah ke kode, panitia kehilangan kendali atas acaranya sendiri dan harus menunggu orang yang bisa menyentuh kode.",
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
            "Sejak migration 0116 ada dua deret dari satu kunci yang sama: Eksternal 1 sampai 500, Intern 1001 sampai 1250.",
            "Deret Intern itu keputusan pemilik acara, 27 Agustus 2026, dan ia menutup jalur sistemnya saja. Jalur kertasnya ikut menuntut: kain Intern harus ditandai supaya yang ditulis juri di blangko juga 1xxx, karena juri menyalin nomor dari kain di dada regu — kain polos bertulis 001 menghasilkan blangko ambigu yang tidak bisa dipulihkan satu baris SQL pun.",
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
            "Ditolak pola kunci baris yang dipakai migration 0004. Versi itu mengunci baris di nomor_dada_stok sambil memutuskan sebuah nomor sudah terpakai atau belum dari tabel LAIN, regu.nomor_dada — mengunci tabel A untuk memutuskan tabel B, dan pada 30 meja serentak dua transaksi bisa sama-sama menganggap nomor yang sama masih kosong.",
            "Perbaikannya menyederhanakan, bukan menambah kepintaran. Dengan satu gerbang di awal, pola SKIP LOCKED tidak diperlukan lagi sama sekali — dan penerus tidak perlu menalar kunci lintas tabel untuk membaca fungsinya.",
            "Terukur, bukan diyakini. Diuji dengan 30 koneksi serentak memperebutkan 300 nomor dada: versi lama gagal di 1 sampai 3 meja tiap putaran, 290 dari 300 regu berhasil. Sesudah migration 0007 memakai satu gerbang, lima putaran berturut-turut memberi 300 dari 300 regu bernomor, nol error, nol duplikat, selesai dalam 1,65 detik.",
          ],
        },
        {
          jenis: "kenapa",
          teks: "Kunci UNIQUE pada nomor dada memang menahan datanya, tapi yang ditahan cuma datanya — di meja yang terlihat adalah satu sekolah gagal daftar ulang dengan pesan error teknis, di depan antrean.",
        },
      ],
    },
    {
      kode: "kenapa-kloter",
      judul: "Kloter FIFO berkuota, dan sisipan manual yang berteriak",
      isi: [
        {
          jenis: "p",
          teks: "Pembagian kloter otomatis mengisi kloter paling awal yang belum berangkat, urut siapa yang lebih dulu menyelesaikan daftar ulang, paling banyak 5 Eksternal dan 3 Intern per kloter dengan kuota dihitung terpisah. Sekolah tidak berpengaruh sama sekali. Tapi kloter yang kertasnya sudah dicetak TETAP boleh ditambah regu secara manual.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak penyebaran per sekolah dan lompatan dua kloter — aturan lama yang dibuang migration 0092 karena tidak ada yang bisa menjelaskannya di lapangan. Aturan sekarang muat dalam satu kalimat ke pembina.",
            "Ditolak membekukan kloter begitu kertasnya dicetak. Pagar itu pernah ada di migration 0008, dikembalikan di 0040, lalu dibuang seluruhnya di 0066: mencetak ulang selembar daftar itu murah, memberangkatkan kloter dengan empat tempat kosong tidak bisa diulang.",
            "Kejadian nyatanya: satu sekolah datang terlambat, daftar ulang sesudah kertas dibagikan, regunya diselipkan. Di garis start kloter memanggil sepuluh nama padahal kertas memuat sembilan. Karena itu sisipan ditandai waktunya dan tampil sebagai kartu merah yang MENETAP.",
            "Pengacakan OTOMATIS tetap melewati kloter yang sudah berangkat, dikembalikan migration 0088. Yang dibuka cuma jalur manual, dan itu keputusan petugas yang sadar.",
          ],
        },
        {
          jenis: "p",
          teks: "Satu akibat yang wajib diketahui petugas yang menyisipkan: penalti waktu dihitung dari jam berangkat kloter, jadi regu yang dimasukkan ke kloter yang sudah jalan dihitung berangkat pada jam kloter itu, bukan jam ia benar-benar jalan. Kalau maksudnya regu itu berangkat sekarang, tempatnya di kloter yang belum jalan. Dan jangan menomori kloter sendiri secara manual: penomoran menyimpan aturan yang tidak kelihatan dari nomornya.",
        },
        {
          jenis: "kenapa",
          teks: "Kalau kloter dibekukan, regu ada di database tapi tidak pernah dipanggil di garis start; kalau sekolah dijadikan faktor lagi, pertanyaan kenapa regu kami di kloter 30 tidak bisa dijawab siapa pun di lapangan.",
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
            "Isolasi pos sengaja tinggal pada MENULIS. Sejak migration 0069 rincian Live Score dibuka untuk semua pemegang centang live_score — keputusan pemilik acara, dan konsekuensinya diterima: juri Pos 3 bisa melihat angka Pos 1 sebelum diumumkan.",
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
          teks: "Yang dicetak dari browser adalah MASTER, bukan tumpukannya. Satu pos dengan tiga lomba mencetak tiga halaman, bukan 1.500. Blangko itu kosong, jadi menggandakannya di fotokopi lebih cepat dan jauh lebih murah — mencetak tumpukannya dari browser menghabiskan satu toner kantor untuk pekerjaan yang selesai dalam hitungan menit di mesin fotokopi.",
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
          teks: "Karena masternya difotokopi berulang — sering kali fotokopi dari fotokopi — aturan cetaknya keras dan tidak satu pun kosmetik: tanpa blok hitam pekat, tanpa abu-abu atau raster, tanpa tulisan putih di atas gelap, garis minimal 0,75pt, huruf minimal 7pt, dan tidak ada apa pun di belakang area yang ditulisi. Blok hitam keluar belang dan berbercak dari mesin fotokopi, abu-abu jadi kotor atau hilang sama sekali, dan huruf di bawah 7pt tertutup toner sampai lubang huruf a dan e menutup.",
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
            "Ditolak paragraf penjelas di atas tiap fitur. Contoh yang dipakai dulu dialog gembok: judulnya di atas satu field beralasan sudah mengatakan seluruh isi paragrafnya, dalam seperempat tingginya, di HP tempat paragraf itu justru mendorong field-nya keluar layar. Dialog itu sendiri sudah tidak ada sejak migration 0166 — Cek Nilai membuka gembok langsung dengan alasan tetap Dibuka dari Cek Nilai — jadi yang tersisa pelajarannya, bukan layarnya.",
            "Ditolak glosarium istilah di layar. Menjelaskan Penggalang PA sebagai SMP atau MTs putra dibuang, karena ia menjelaskan istilah kepada orang yang mengucapkannya tiap hari.",
            "Yang DIPERTAHANKAN: fakta yang tidak bisa dibaca dari layar itu sendiri — angka yang berlaku sekarang, akibat yang tidak bisa dibatalkan, peringatan bahwa sesuatu sudah tercetak atau sudah berangkat.",
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
            "Karena itu ada supabase/checks/status_migrasi.sql: ia mencari SIDIK JARI sebuah migration di database — sebuah constraint, sebuah kolom, potongan definisi function, sebaris konfigurasi — dan tidak mengubah apa pun. Nama file tidak bisa diperiksa, karena tidak ada yang menyimpannya.",
            "Cakupannya disebutkan, bukan didiamkan: 116 migration punya jejak yang diperiksa dan 53 tidak menyisakan jejak apa pun, dan 116 tambah 53 adalah seluruh 169 migration yang ada. Angka itu yang harus dijaga tiap kali file migration baru mendarat — nomor yang tidak ada di kedua daftar tidak muncul sebagai BELUM, ia tidak muncul sama sekali.",
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
            "Satu hari yang terukur: 24 dari 60 run adalah salinan kedua dari check yang sudah lulus — sekali di pull request, sekali waktu merge-nya mendarat di main, atas tree yang sama persis.",
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
            "Ditolak mengantre semua kegagalan tanpa pandang bulu. Nilai di luar rentang, regu yang tergembok, atau komponen yang bukan untuk golongan itu tidak akan berubah jawabannya karena ditunggu — dan satu baris rusak menyumbat seluruh antrean di belakangnya.",
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
          teks: "Sejak pendaftaran dibuka sampai juara diumumkan, sistem ini dipakai orang sungguhan sambil kita menyuntingnya. Layar yang mati bukan bug yang dilaporkan besok, melainkan pekerjaan yang berhenti sekarang, di meja dengan antrean di depannya. Karena itu sebelum merge, buka layar yang disentuh dan HITUNG BARISNYA.",
        },
        {
          jenis: "poin",
          butir: [
            "Ditolak menganggap parse check, tes SQL, dan halaman contoh sebagai bukti sebuah layar hidup. 28 Agustus 2026 Meja Pembayaran KOSONG di produksi selama acara berjalan; satu deklarasi berakhir di bawah pemakainya dan melempar error untuk SETIAP baris.",
            "Parse check lulus, seluruh tes lulus, pengukuran tata letak dikerjakan di halaman contoh berisi markup statis. Tidak satu langkah pun membuka layarnya. Yang menemukannya petugas di lapangan.",
            "Layar yang rusak sering terbaca seperti layar yang kosong. Waktu itu tulisan 39 invoice dan 40 regu di atas tabel tetap benar, karena angkanya dihitung dari data yang sudah diterima, bukan dari barisnya. Jangan menilai dari kepala layar.",
            "Kalau alat untuk membuka layarnya sendiri rusak, itu bug prioritas tinggi, bukan gangguan kecil. Skrip tests/dev_database.sh pernah berhenti di migration 0118 sejak file itu mendarat, dan selama itu tidak ada cara membuka layar mana pun di laptop — jadi aturan di atas mustahil dipatuhi tanpa disadari siapa pun.",
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
/* Bulan-bulan timeline. Bentuknya BERBEDA dari bab di atas, dan itu disengaja
   — sebuah bulan bukan sebuah bagian bacaan: ia punya tonggak yang dicentang,
   seksi yang sedang sibuk, dan satu kesalahan khas yang mahal. Memaksanya
   masuk ke daftar blok akan mengubur keempat hal itu di dalam paragraf.

   Harganya satu percabangan di perakit layar, dan itu batas yang jelas:
   bab dengan `bagian` digambar sebagai bacaan, bab timeline digambar sebagai
   kalender. */
export const TIMELINE = [
  {
    kode: "september",
    bulan: "September",
    tajuk: "Serah Terima Jabatan",
    fokus:
      "Kepengurusan berpindah ke angkatan berikutnya, dan panitia inti edisi baru terbentuk sebelum satu rapat besar pun digelar.",
    tonggak: [
      "Serah terima jabatan pengurus ambalan selesai, penanggung jawab acara ditetapkan namanya",
      "Ketua Pelaksana, Sekretaris, dan Bendahara edisi baru ditunjuk",
      "Evaluasi edisi sebelumnya dibaca ulang bersama, bukan disimpan",
      "Akses diserahkan: siapa yang memegang akun admin, akun GitHub organisasi, dan password Supabase",
      "Tanggal lomba diusulkan ke pembina dan sekolah untuk dikunci di rapat Oktober",
    ],
    seksi: [
      "Ketua Pelaksana dan Wakil",
      "Sekretaris",
      "Bendahara — Meja Pembayaran",
      "Administrator Sistem",
    ],
    sistem: [
      "Serahkan akun admin lama ke pengurus baru lewat workflow \"Ganti password akun panitia\" — satu akun sekali jalan, password dibuat server, diambil dari Artifact sebelum hilang tiga hari",
      "Buka layar Akun di #/account dan nonaktifkan akun panitia edisi lalu yang orangnya sudah lulus; jangan hapus barisnya, riwayat nilai menunjuk ke sana",
      "Buka Live Score selagi datanya masih ada, cetak lewat tombol \"Rekap Nilai Semua\", dan salin daftar juara dari layar Kejuaraan sebagai arsip kertas",
      "Pastikan minimal dua orang tahu password akun organisasi (Supabase, Cloudflare, GitHub) — bukan satu orang, bukan akun pribadi",
    ],
    jangan:
      "Jangan membersihkan data edisi lalu bulan ini — begitu dihapus, tidak ada lagi bahan evaluasi dan tidak ada contoh layar terisi untuk melatih panitia baru.",
  },
  {
    kode: "oktober",
    bulan: "Oktober",
    tajuk: "Rapat Besar dan Anggaran",
    fokus:
      "Tema, tanggal, biaya, dan seluruh seksi dikunci dalam satu rapat besar, lalu edisi baru dibuat di database.",
    tonggak: [
      "Rapat besar: tema, tanggal lomba, dan biaya pendaftaran diputuskan dan dicatat notulennya",
      "Seluruh seksi terisi namanya, lengkap dengan koordinator tiap seksi",
      "Anggaran kasar disusun: pemasukan dari perkiraan jumlah regu, pengeluaran per seksi",
      "Rute dan lokasi lima pos disurvei ulang, termasuk titik pos bayangan sebelum tiap pos",
      "Kebutuhan barak dihitung dari perkiraan regu luar kota",
    ],
    seksi: [
      "Ketua Pelaksana dan Wakil",
      "Sekretaris",
      "Bendahara — Meja Pembayaran",
      "Seksi Lomba dan Juri Pos",
      "Seksi Perlengkapan",
    ],
    sistem: [
      "Susun migration edisi baru dan isi kolomnya apa adanya: nomor, nama, tahun, tanggal_lomba, biaya_per_regu, jam_mulai_berangkat, dan interval_berangkat_menit",
      "Jalankan migration itu lewat workflow \"Apply migration to Supabase\" — merge saja tidak pernah menerapkannya",
      "Jalankan supabase/checks/status_migrasi.sql lewat workflow yang sama, lalu baca hasilnya: yang berbunyi BELUM belum pernah hidup, dan yang tidak disebut sama sekali belum pernah diperiksa",
      "Samakan stok nomor dada dengan kain yang benar-benar dipesan lewat supabase/checks/stok_nomor_dada.sql — dua deret, Eksternal dan Intern, dan pagar nomor dada membaca angkanya dari sana",
      "Buka Kalkulator Keberangkatan di #/pengaturan-kloter dan lihat perkiraan jam berangkat kloter terakhir — kalau lewat 10:00, jumlah kloter atau interval_berangkat_menit yang salah, bukan jam upacaranya",
    ],
    jangan:
      "Jangan menulis tanggal lomba di kode atau di skrip mana pun — seluruh perkiraan jam berangkat dihitung dari satu kolom tanggal di tabel edisi, dan tanggal yang ditulis di dua tempat akan berbeda persis saat tidak ada waktu memperbaikinya.",
  },
  {
    kode: "november",
    bulan: "November",
    tajuk: "Soal, Kriteria, Bobot",
    fokus:
      "Isi lombanya disusun: soal ditulis, kriteria penilaian ditetapkan, dan bobot tiap pos dikunci sebelum blangko dirancang.",
    tonggak: [
      "Soal lima lomba tulis selesai beserta kunci jawabannya, disimpan tertutup",
      "Kriteria tiap lomba dan rentang nilainya disepakati juri, bukan diputuskan sendiri oleh seksi lomba",
      "Kontrak waktu yang ditawarkan ditetapkan, beserta penalti per menit terlalu cepat maupun terlambat",
      "Surat izin sekolah, surat ke kepolisian dan puskesmas, serta surat undangan pangkalan dikirim",
      "Proposal sponsor disebar dan yang sudah menyatakan iya dicatat nominalnya",
    ],
    seksi: [
      "Seksi Lomba dan Juri Pos",
      "Ketua Pelaksana dan Wakil",
      "Sekretaris",
      "Seksi Humas dan Sponsor",
      "Seksi Keamanan dan P3K",
    ],
    sistem: [
      "Susun migration pos, lomba, dan penilaian edisi baru: tiap penilaian dengan poin_maks-nya, lomba berupa soal dengan total_soal-nya, dan pengelompokan lomba lewat kolom wahana.lomba",
      "Ingat bobot pos tidak pernah ditulis sebagai angka — ia jumlah poin_maks seluruh wahana di pos itu; memindah satu lomba antar pos mengubah bobot keduanya sekaligus",
      "Kunci rentang nilai mentah sama dengan jumlah soal, supaya petugas tidak bisa mengetik 12 dari 10",
      "Jalankan migration lewat \"Apply migration to Supabase\", lalu baca hasilnya lewat supabase/checks/lomba_per_pos.sql — pengelompokan lomba itu data, tidak bisa dibaca dari kode",
      "Buka Input Nilai Tabel di #/pos, hitung kolomnya per pos, lalu tekan cetak blangko dan bawa kertasnya ke rapat juri; pos yang seluruhnya lomba soal memang menolak mencetak dan menyebutkan alasannya di layar",
    ],
    jangan:
      "Jangan menggabungkan dua lomba yang lembar jawabannya terpisah menjadi satu baris — kolom foto ikut kode lomba, jadi satu kode untuk dua lomba berarti satu kolom memegang dua lembar jawaban berbeda, dan itu baru ketahuan saat ada nilai yang disengketakan.",
  },
  {
    kode: "desember",
    bulan: "Desember",
    tajuk: "Publikasi dan Pendaftaran Dibuka",
    fokus:
      "Acara diumumkan ke pangkalan, form pendaftaran dibuka, dan akun panitia dibuat jauh sebelum dipakai.",
    tonggak: [
      "Pamflet dan link pendaftaran disebar ke pangkalan SMP dan SMA se-wilayah",
      "Form pendaftaran dibuka pada tanggal yang diumumkan, dan pendaftar pertama masuk",
      "Nomor kontak panitia untuk pertanyaan pembina diumumkan, satu nomor saja",
      "Rekening penerimaan pembayaran dipastikan hidup dan nama pemiliknya diumumkan apa adanya",
      "Meja pendaftaran offline dijadwalkan: hari, jam, dan siapa yang menjaga",
    ],
    seksi: [
      "Seksi Humas dan Sponsor",
      "Seksi Dokumentasi dan Publikasi",
      "Seksi Kesekretariatan dan Pendaftaran",
      "Bendahara — Meja Pembayaran",
      "Administrator Sistem",
    ],
    sistem: [
      "Bersihkan data uji SEKARANG lewat supabase/checks/cleanup_data_uji.sql di workflow \"Apply migration to Supabase\" — termasuk mengembalikan penomoran kloter ke 1, kalau tidak pembagian kloter nanti mulai dari tengah",
      "Bakukan daftar sekolah kurasi lebih dulu, lalu sapu sisanya lewat supabase/checks/sekolah_kembar.sql; dua sekolah senama dibedakan di dalam namanya sendiri, bukan lewat alamat",
      "Jalankan workflow \"Provision akun panitia\" per batch: tempel CSV berisi username, email, peran, dan pos; ambil passwordnya dari Artifact sebelum terhapus tiga hari lagi",
      "Buka layar Akun dan cocokkan centang tiap akun dengan pekerjaan orangnya, dengan urutan yang benar: pilih perannya DULU, sesuaikan centangnya SESUDAHNYA — mengganti peran menghapus seluruh centang tangan",
      "Buka form pendaftaran di situs peserta dari HP sungguhan, daftarkan satu regu percobaan sampai selesai, lalu hapus regu itu — di fase Internal peserta hanya melihat jumlah pendaftar dan jalan ke formulir",
    ],
    jangan:
      "Jangan membuka pendaftaran sebelum data uji dibersihkan: regu percobaan yang tertinggal ikut terhitung di jumlah pendaftar yang dilihat publik, dan cleanup_data_uji.sql tidak membedakan data uji dari data asli — sesudah ada pendaftar sungguhan, berkas itu tidak boleh dijalankan lagi.",
  },
  {
    kode: "januari",
    bulan: "Januari",
    tajuk: "Penutupan, Daftar Ulang, Gladi",
    fokus:
      "Pendaftaran ditutup, uang masuk dicocokkan, nomor dada dibagikan, dan seluruh alur dicoba dari ujung ke ujung sebelum hari-H.",
    tonggak: [
      "Pendaftaran ditutup pada tanggal yang diumumkan, jumlah regu final diketahui",
      "Seluruh pembayaran dicocokkan dan ditandai lunas",
      "Technical meeting dengan pembina: rute, kontrak waktu, aturan penalti, dan jam kumpul",
      "Daftar ulang berjalan 1-2 hari sebelum lomba, nomor dada kain berpindah ke tangan regu",
      "Gladi lapangan: seluruh panitia berdiri di posnya masing-masing, memakai laptop dan HP yang akan dipakai hari-H",
    ],
    seksi: [
      "Seksi Kesekretariatan dan Pendaftaran",
      "Bendahara — Meja Pembayaran",
      "Seksi Daftar Ulang",
      "Seksi Perlengkapan",
      "Seksi Konsumsi",
    ],
    sistem: [
      "Kosongkan antrean Meja Pembayaran di #/pembayaran — regu yang belum lunas tidak bisa daftar ulang — lalu betulkan salah ketik pembina di Data Peserta sebelum nomor dada keluar, karena sesudahnya nama regu ikut membeku",
      "Cetak blangko master tiap lomba dari Input Nilai Tabel: yang keluar dari printer SATU master A5 melintang per lomba, dan penggandaannya pekerjaan mesin fotokopi 2-up di sekretariat",
      "Jalankan daftar ulang di Meja Daftar Ulang di #/daftar-ulang dengan 2-3 meja paralel; nomor dada diketik dari kain di tangan, kloter jatuh sendiri secara FIFO",
      "Cetak dua bentuk dari Daftar Kloter: \"Cetak Kloter untuk Petugas\" untuk meja staging, dan \"Cetak Kloter untuk Peserta\" untuk papan pengumuman",
      "Isi database uji lewat supabase/checks/simulasi_end_to_end.sql sampai papan Live Score terisi, dan jelang gladi jalankan workflow \"Setel password bersama semua akun\" supaya sepuluh orang bisa login tanpa sepuluh serah terima — kembalikan ke acak sesudahnya",
    ],
    jangan:
      "Jangan salah mengetik nomor dada saat daftar ulang: blangko penilaian hanya memuat nomor dada tanpa nama regu, jadi satu angka keliru memindahkan seluruh nilai satu regu ke regu lain, dan tidak ada apa pun di kertas yang memperlihatkannya.",
  },
  {
    kode: "februari",
    bulan: "Februari",
    tajuk: "Pelaksanaan dan Evaluasi",
    fokus:
      "Hari lomba: upacara, keberangkatan bertahap, penilaian di lima pos, kedatangan, pengumuman juara, lalu arsip.",
    tonggak: [
      "Upacara dan pemberangkatan kloter pertama oleh pejabat, seluruh keberangkatan selesai pukul 10:00",
      "Lima pos berjalan dan nilai mentah masuk sistem sepanjang siang",
      "Seluruh regu tercatat sampai di finish dan kelengkapan anggota diperiksa fisik",
      "Juara diumumkan di lapangan, baru sesudah itu ditampilkan di layar peserta",
      "Rapat evaluasi digelar selagi ingatan masih segar, dan arsipnya diserahkan ke pengurus berikutnya",
    ],
    seksi: [
      "Seksi Keberangkatan",
      "Seksi Kedatangan — Finish",
      "Seksi Lomba dan Juri Pos",
      "Seksi Rekap dan Skor",
      "Administrator Sistem",
    ],
    sistem: [
      "Pagi: naikkan fase live ke Progress lewat saklar di Live Score, lalu jalankan workflow \"Publish rekap live\" — fasenya dulu, penerbitan sesudahnya, dan urutan itu berlaku ke dua arah",
      "Keberangkatan di #/keberangkatan: kertas yang jadi pencatat utama dan laptop memverifikasi, jam berangkat diketik dari jam sungguhan; di Kedatangan di #/finish justru terbalik, laptop pencatat utamanya, dan regu yang lupa dicatat tiba hilang dari klasemen tanpa satu galat pun",
      "Pantau Live Score sepanjang siang: angka hilang berarti regu sudah closing tapi nilainya belum lengkap, dan pos yang berhenti menyetor lebih dari setengah jam berarti laptop atau sinyalnya rusak",
      "Sisir Cek Nilai di #/cek-nilai lewat ketiga saringannya — Belum Input, Belum Foto, Belum Kunci — sampai angkanya nol: adu foto lembar jawaban dengan angka yang diketik, betulkan kalau beda, lalu pasang gembok per lomba",
      "Sesudah juara dibacakan di lapangan: isi pilihan manual di Kejuaraan, naikkan fase ke Juara, jalankan \"Publish rekap live\" lagi, lalu cetak \"Rekap Nilai Semua\" dari Live Score dan Daftar Kloter final sebagai arsip",
    ],
    jangan:
      "Jangan menaikkan fase ke Juara sebelum juara dibacakan di lapangan, dan jangan menurunkannya kembali sesudahnya berharap papan kembali — berkas fase juara tidak memuat satu baris klasemen pun, jadi papannya kosong sampai rekap diterbitkan ulang.",
  },
];
/** Timeline ikut jadi tab supaya seluruh buku punya satu deretan tab, bukan
 *  tiga tab ditambah satu tombol yang letaknya lain sendiri. `bagian`-nya
 *  sengaja kosong: yang digambar TIMELINE di atas. */
const BAB_TIMELINE = {
  kode: "timeline", judul: "Timeline Satu Edisi",
  tab: "Timeline", ikon: "clock", warna: "toska",
  ringkas: "Enam bulan dari Serah Terima Jabatan sampai hari pelaksanaan: "
    + "tonggak yang dicentang, langkah yang dikerjakan di sistem, dan satu "
    + "kesalahan khas tiap bulan.",
  bagian: [],
};

export const BUKU_SAKTI = [BAB_TUTORIAL, BAB_SEKSI, BAB_KENAPA, BAB_TIMELINE];

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

/** Semua teks satu bulan timeline, sebentuk dengan teksBagian(). */
export function teksBulan(bulan) {
  return [bulan.bulan, bulan.tajuk, bulan.fokus, bulan.jangan,
          ...bulan.tonggak, ...bulan.seksi, ...bulan.sistem]
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

/** Bulan timeline yang cocok, aturan sama dengan cariBagian(). */
export function cariBulan(kata) {
  const potong = String(kata || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (!potong.length) return [];
  return TIMELINE.filter(bulan => {
    const teks = teksBulan(bulan);
    return potong.every(k => teks.includes(k));
  });
}
