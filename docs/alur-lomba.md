# Alur dan Aturan Hiking Rally Ciradyka

Dokumen ini merekam alur penyelenggaraan dan aturan penilaian Hiking Rally
Ciradyka (HRCD) sebagai dasar perancangan sistem `hrcd-rekap`.

Isinya adalah hasil penjelasan panitia, bukan rancangan teknis. Keputusan
teknologi sudah diambil dan sudah berjalan, tetapi perbandingan dan alasannya
sengaja tidak dibahas di sini — lihat bagian 13.5 dan `final-architecture.md`.

> **Penting:** aturan penilaian **berubah setiap tahun**. Semua angka di dokumen
> ini adalah konfigurasi edisi berjalan, bukan spesifikasi permanen. Lihat
> bagian 9.

**Catatan istilah.** Dokumen ini memakai kata yang lazim dipakai sehari-hari,
termasuk serapan Inggris, bukan padanan formalnya:

| Dipakai di sini | Bukan |
| --- | --- |
| online, offline | daring, luring |
| link | tautan |
| upload, download | unggah, unduh |
| preview | pratinjau |
| password | kata sandi |
| timestamp | cap waktu |
| edit | sunting |

Sebaliknya, istilah lomba tetap apa adanya dan tidak diterjemahkan: **regu**,
**nomor dada**, **kloter**, **kontrak waktu**, **pos**, **wahana**,
**daftar ulang**, **barak**, **golongan**.

## 1. Konteks

1. HRCD adalah lomba gerak jalan alam terbuka untuk pelajar SMP dan SMA.
2. Penyelenggara: Ambalan Ciung Wanara – Dyah Pitaloka, SMA Negeri 1 Ciamis,
   Jawa Barat.
3. Diadakan rutin setiap tahun, biasanya Februari atau Maret.
4. Skala peserta konsisten di kisaran 300 regu, dengan batas atas sekitar 500.
5. Sistem terbagi menjadi **dua wajah yang terpisah**:
   - **Aplikasi panitia** — satu link yang sama untuk semua panitia, dengan
     akses yang dibedakan per akun (bagian 8.8).
   - **Tampilan live untuk peserta** — halaman publik tanpa login, berisi
     **klasemen penuh empat golongan**, dibuka **bertahap**: selama lomba
     hanya progres tanpa angka nilai — centang per pos, ditambah kloter,
     kontrak waktu, jam berangkat, dan jam datang regu itu sendiri, supaya
     jamnya bisa dicocokkan sebelum hasilnya final — nilai dan peringkat
     lengkap baru tampil setelah closing. Halaman ini **disajikan
     statis dan diperbarui berkala**, tidak pernah membaca database langsung —
     ratusan HP penonton tidak boleh bisa membebani jalur input panitia.

## 2. Satuan lomba dan identitas

1. Satu regu terdiri dari **5 orang**. Seluruh penilaian bersifat per regu,
   bukan per individu.
2. Satu regu bersifat seragam: satu golongan dan satu jenis kelamin. Sekolah
   yang mengirim 2 regu misalnya mengirim 5 Penggalang PA dan 5 Penggalang PI.
3. Terdapat **empat klasemen yang dinilai terpisah**:
   - Penegak PA (SMA, putra)
   - Penegak PI (SMA, putri)
   - Penggalang PA (SMP, putra)
   - Penggalang PI (SMP, putri)
4. Sebuah regu memakai **dua identitas secara berurutan**:
   - **Kode pembayaran** — terbit **saat pendaftaran** dan terikat pada seluruh
     regu dalam satu batch (bagian 3). Menjadi referensi saat membayar, lalu —
     setelah pembayaran diverifikasi — menjadi ID yang disebutkan saat daftar
     ulang. Satu kode mencakup semua regu yang didaftarkan bersama.
   - **Nomor dada** — diberikan saat daftar ulang, satu per regu. Menjadi nomor
     peserta dan dipakai sebagai kunci di seluruh tahap berikutnya.

## 3. Pendaftaran

1. **Satuan pendaftaran tetap regu** — tetapi form-nya dibuat satu per sekolah
   sebagai kemudahan: sekolah yang mengirim 10 regu tidak perlu mengisi form 10
   kali. Satu pengisian mendaftarkan beberapa regu sekaligus dalam satu batch,
   dan sistem tetap memperlakukan tiap regu sebagai baris tersendiri (poin 3).
2. Urutan pertanyaan di form:
   1. **Asal sekolah.** Ketikan dicocokkan ke database sekolah — jika sekolahnya
      dikenal, muncul sebagai pilihan dropdown otomatis; jika tidak ada, diisi
      manual (dan sekolah baru itu masuk ke database).
   2. **Konfirmasi alamat.** Jika sekolah dipilih dari database, alamatnya
      ditampilkan agar pendaftar memastikan sekolah yang dimaksud benar —
      penting karena banyak sekolah bernama sama di kota berbeda.
   3. **Butuh penginapan?** Jawaban ya memasukkan seluruh batch ke skema
      penempatan barak (bagian 11).
   4. **Mendaftarkan berapa regu?** — tidak pernah diketik. Pendaftar menaikkan
      dan menurunkan jumlah **per golongan** lewat tombol + / −, dan totalnya
      diturunkan dari situ ("Total: N regu"). Karena totalnya hasil hitungan,
      tidak ada penjumlahan yang bisa meleset dan tidak ada yang perlu
      divalidasi. Yang diperiksa hanya batas bawah ("Tambahkan minimal satu
      regu") dan batas atas per pengiriman.
   5. **Untuk setiap regu:** nama regu dan nama ketua. **Nama empat anggota
      lain tidak diminta** — untuk sekarang sistem tidak mencatatnya;
      kelengkapan 5 orang dicek fisik di akhir lomba (bagian 10.9).
   6. **Satu Contact Person** untuk keseluruhan batch: nama (wajib) dan nomor
      WhatsApp. Namanya disimpan sebagai `pendaftaran.nama_kontak` dan itulah
      yang dipanggil panitia saat menghubungi sekolah.
3. Setelah dikirim, sistem **memecah batch menjadi satu baris per regu** —
   5 regu menjadi 5 baris — yang tetap terikat pada satu tagihan bersama.
4. Begitu form dikirim, terbit **kode pembayaran yang terikat pada regu-regu
   dalam batch itu**. Sekolah membayar **sekaligus untuk seluruh batch** dengan
   kode itu sebagai referensi. Setelah panitia memverifikasi, **seluruh regu
   dalam batch menjadi valid bersama** dan menerima kwitansi, siap lanjut ke
   daftar ulang.
5. **Pembayaran sebagian tidak dilayani** — batch bersifat semua-atau-tidak,
   karena pembayaran parsial membuat sistem rumit. Sekolah yang hanya sanggup
   membayar sebagian cukup **mendaftar ulang** dengan batch yang lebih kecil
   sesuai kemampuannya.
6. Pendaftaran online dan offline memakai **link yang sama**. Sekolah yang
   belum mendaftar dapat mendaftar di lokasi lewat HP atau laptop di meja
   pendaftaran offline, lalu membayar tunai atau transfer ke rekening panitia.
7. **Tidak ada pengembalian dana.** Regu yang batal setelah membayar tidak
   digantikan, dan kloternya tetap berjalan dengan jumlah regu berkurang.
8. Konsekuensi bagi sistem: perlu **master data sekolah** (nama + alamat) yang
   tumbuh dari tahun ke tahun — sumber dropdown otomatis di form, dan sekaligus
   kunci penyebaran kloter per sekolah (bagian 5) serta penempatan barak
   (bagian 11).

## 4. Daftar ulang

1. Berlangsung 1–2 hari sebelum lomba.
2. Regu yang sudah membayar langsung menuju meja daftar ulang. Regu yang belum
   mendaftar diarahkan ke meja pendaftaran offline lebih dulu (bagian 3.6).
3. Di meja daftar ulang, regu menyebutkan **kode pembayaran** sebagai ID.
   Panitia mengonfirmasi **nama regu** dan **asal sekolah**.
4. Panitia lalu menyandingkan regu dengan sebuah **nomor dada**, diambil dari
   stok fisik yang sudah disiapkan sebelumnya. Karena nomor dada diambil dari
   stok saat itu juga dan meja daftar ulang lebih dari satu, satu nomor dada
   tidak boleh terpakai dua kali.
5. **Nomor dadanya DIKETIK petugas, bukan diterbitkan sistem.** Yang ada di
   tangan petugas adalah setumpuk kain apa adanya — ada yang hilang, sobek,
   atau tertinggal di kardus lain — jadi sistem tidak boleh menebak nomor
   mana yang tersedia secara fisik. Urutannya: petugas menyebut regu ini
   nomornya ini, lalu sistem memastikan nomor itu ada di stok, belum
   dipensiunkan, dan belum dipakai regu lain. Nomor yang sudah dipakai
   ditolak dengan pesan, bukan diterima diam-diam.
6. **Pengisian nomor dada dilakukan sekaligus per sekolah**, bukan satu regu
   satu kali. Sekolah dengan 10 regu mengisi 10 nomor dada dalam satu
   transaksi di meja. Ini menjadi dasar pembagian kloter — lihat bagian 5.
7. **Kloternya tetap ditentukan sistem** (bagian 5.3). Yang manual hanya
   nomor dadanya; penyebaran kloter justru tidak boleh diserahkan ke petugas
   karena bertumpu pada keadaan seluruh sekolah, bukan satu meja saja.
8. **Peserta wajib mengonfirmasi datanya sendiri, termasuk nomor dada,
   sebelum kertas dicetak.** Yang dikonfirmasi: nama regu, asal sekolah,
   golongan, dan nomor dada tiap regu.

   Ini bukan formalitas, melainkan pintu terakhir yang masih murah. Sesudah
   lembar kloter dicetak, isinya dibekukan: menambah regu ke kloter tercetak
   ditolak sistem, dan menukar nomor dada hanya boleh lewat admin — nomor
   lamanya pun dipensiunkan permanen, karena kertas yang sudah beredar masih
   menuliskannya (bagian 8.8).

   Harganya naik lagi sesudah lomba mulai. Slip penilaian per lomba hanya
   memuat NOMOR DADA tanpa nama regu, jadi nomor dada yang salah bukan
   sekadar salah tulis — ia memindahkan seluruh nilai satu regu ke regu lain,
   dan tidak ada apa pun di kertas yang memperlihatkannya.

   Sebelum dicetak, pembetulan hanya perlu satu ketukan di meja: nomor lama
   kembali ke stok dan bisa langsung dipakai regu yang benar.

   **Bentuknya lisan: panitia membacakan, peserta mengiyakan.** Tidak ada
   lembar tanda tangan dan tidak ada centang di sistem. Itu keputusan sadar —
   tiap langkah tambahan di meja daftar ulang berlipat lebih dari seratus
   sekolah, dan antrean di meja adalah biaya yang dibayar semua orang.

   Yang ikut hilang disebutkan supaya tidak jadi kejutan: **tidak ada catatan
   siapa mengonfirmasi apa dan kapan**. Kalau nanti ada sekolah yang membantah
   nomor dadanya, tidak ada yang bisa ditunjukkan selain riwayat perubahan di
   `history`, dan riwayat itu mencatat panitia yang mengetik — bukan peserta
   yang mengiyakan.
9. Setelah daftar ulang ditutup, **lembar penilaian dicetak** untuk dibagikan ke
   petugas lapangan (bagian 8.8).

## 5. Kloter dan kontrak waktu

1. Satu kloter berisi **paling banyak 10 regu**. Jumlahnya dapat kurang dari 10
   bila ada regu yang batal setelah membayar (bagian 3.7).
2. **30 kloter selalu ada**, karena jumlah peserta konsisten di kisaran 300
   regu. Kloter 31–40 dibuka hanya jika terisi, dan kloter terakhir boleh tidak
   penuh.
3. Kloter ditentukan **otomatis** begitu regu menerima nomor dada.
4. **Tujuan pembagian kloter: sesedikit mungkin regu dari sekolah yang sama
   berada dalam satu kloter.** Alasannya bukan teknis melainkan sportivitas —
   regu satu sekolah yang berangkat bersamaan cenderung bercengkerama di
   sepanjang rute alih-alih berlomba.
5. **Cara pembagiannya bertumpu pada pengambilan nomor dada per sekolah**
   (bagian 4.6). Sekolah yang mengambil 10 nomor dada langsung disebar ke 10
   kloter berbeda; sekolah yang mengambil 5 nomor dada disebar ke 5 kloter
   berbeda. Dengan begitu satu sekolah tidak pernah menumpuk di satu kloter
   selama jumlah regunya tidak melebihi jumlah kloter.
6. **Jarak antar kloter boleh dilompati, tidak harus berurutan.** Sekolah dengan
   10 regu dapat ditempatkan di kloter 1, 3, 5, 7, 9, 11, dan seterusnya.
   Alasannya: kloter berdampingan hanya terpaut 3–5 menit, sehingga dua regu
   satu sekolah di kloter 1 dan 2 masih mudah saling menyusul di rute. Lompatan
   dua kloter memberi jarak 6–10 menit.
7. Besar lompatan ini termasuk yang **dapat diatur panitia**, karena bergantung
   pada jumlah peserta: makin banyak sekolah besar, makin sempit ruang untuk
   melompat.
8. **Satu kloter boleh berisi golongan campuran.** Penggalang dan Penegak, putra
   dan putri, dapat berangkat dalam kloter yang sama; pemisahan hanya berlaku
   pada penilaian. Komposisi peserta biasanya sekitar **70% Penegak dan 30%
   Penggalang**.
9. Setiap regu memilih **kontrak waktu**: 3,5 / 4 / 4,5 jam. Kontrak dipilih per
   regu, sehingga satu kloter bisa berisi regu dengan kontrak berbeda-beda.
   Kontrak baru dikonfirmasi **di garis start**, bukan saat daftar ulang —
   lihat bagian 6.

## 6. Keberangkatan

1. Garis start berjalan sebagai **antrean empat tahap**, supaya keberangkatan
   tidak pernah tertahan urusan administrasi:

   | Posisi | Yang sedang dilakukan |
   | --- | --- |
   | Kloter ke-1 | Berangkat melewati garis start |
   | Kloter ke-2 dan ke-3 | Sudah di garis start, terverifikasi, menunggu |
   | Kloter ke-4 | Mengonfirmasi kontrak waktu |

2. Begitu satu kloter berangkat, seluruh antrean maju satu posisi: dua kloter di
   garis start bergeser, kloter yang tadi mengonfirmasi kontrak naik ke garis
   start, dan kloter berikutnya mulai mengonfirmasi kontrak waktu.
3. **Kontrak waktu dikonfirmasi tiga kloter sebelum berangkat**, sekaligus
   menjadi momen tim lapangan memverifikasi kesiapan regu.
4. Satu panitia mencatat **jam berangkat per kloter**; panitia lain
   memasukkannya ke sistem.
5. Saat keberangkatan, panitia menceklis **per nomor dada** bahwa regu tersebut
   benar-benar berangkat.
6. Jarak antar keberangkatan kloter biasanya **3–5 menit**. Angka pastinya belum
   ditetapkan — lihat bagian 13.
7. Konsekuensi bagi sistem: layar keberangkatan harus menampilkan **beberapa
   kloter sekaligus dalam status berbeda**, bukan satu kloter per layar.
8. **Ada 3 staging.** Verifikasi kehadiran regu dilakukan **di staging**, bukan
   di garis start: setelah masuk staging, peserta cukup menunggu sampai
   benar-benar diberangkatkan.
9. **Panitia kertas dan panitia laptop duduk bersebelahan**, dan urutan
   kerjanya searah:
   1. Panitia **kertas** mencentang semua regu yang berangkat, menulis tangan
      peserta yang tidak sesuai kloter awal, dan mencatat **jam keberangkatan
      per kloter**.
   2. Kertas itu diserahkan ke panitia **laptop** untuk **diverifikasi** dan
      dimasukkan.

   Artinya untuk keberangkatan, **kertas adalah pencatat utama dan laptop
   memverifikasi** — kebalikan dari meja finish, di mana laptop yang mencatat
   langsung (poin 10.2). Konsekuensinya: jam berangkat wajib bisa **diketik**
   (menyalin dari kertas), bukan diambil dari tombol, dan layar keberangkatan
   harus enak dipakai untuk **menyalin**, bukan hanya mencatat seketika.
10. **Daftar kloter dicetak untuk dua pembaca:**
    - **Petugas staging** — ada kolom centang kehadiran dan tempat menulis jam
      berangkat sebenarnya.
    - **Papan pengumuman utama dan barak** — dibaca peserta, memuat perkiraan
      jam berangkat saja; tidak ada kolom centang maupun kotak jam, karena
      keduanya tidak berguna bagi peserta. Kebiasaan **pembina regu mencatat
      jam berangkat sebenarnya** sebagai bahan klarifikasi bila penilaian
      ketepatan waktu dipersoalkan (target datang = jam berangkat + kontrak
      waktu) kini dilayani halaman rekap live, yang menampilkan kloter,
      kontrak waktu, jam berangkat, dan jam datang tiap regu selama lomba
      berjalan.
11. **Peserta yang terlambat masuk kloternya** diberangkatkan di **kloter
    terakhir**. Bila keadaannya mendesak, panitia dapat memaksa nomor dada
    tertentu masuk kloter mana pun — termasuk kloter yang kertasnya sudah
    beredar. Regu yang disisipkan setelah cetak **wajib ditandai sistem**,
    karena nomornya tidak ada di kertas yang dipegang petugas staging.

## 7. Rute dan pos

1. Terdapat **5 pos utama** di sepanjang rute (Pos 1–5), masing-masing dengan
   soal dan wahana yang berbeda. Susunan XXXVII: 1 Kepramukaan, 2 Halang
   Rintang, 3 P3K, 4 PBB, 5 Yel-Yel.

   **Pos 0 dan Pos 6 bukan pos penilaian.** Keduanya tempat yang sama —
   garis start dan garis finish — dan peserta menyebutnya Pos 0 saat berangkat,
   Pos 6 saat kembali. Garis finish dipindah dari 5 ke 6 oleh migrasi `0032`
   supaya nomor 5 kosong untuk Yel-Yel. Yang dicatat di sana **waktu**, bukan nilai: jam
   berangkat per kloter dan jam datang per regu (bagian 6 dan 10). Tidak ada
   wahana dan tidak ada soal yang dikoreksi di keduanya.

   > Dokumen ini sempat menulis "5 pos utama" ketika yang dinilai baru empat,
   > dan memasukkan garis finish ke dalam rantai soal. Sekarang lima memang
   > benar — tapi karena Yel-Yel menempati nomor 5, bukan karena finish ikut
   > dinilai. Sistem sudah ikut dibetulkan di migrasi `0025`, termasuk satu
   > akibat yang tidak kelihatan: pos tanpa komponen penilaian sempat terhitung
   > sebagai **pos yang dilewatkan regu**. Selama denda pos terlewat masih 0
   > itu tidak berdampak apa-apa — dan justru itu bahayanya, karena baru
   > muncul pada hari seseorang mengubah angka yang memang boleh diubah.
2. Selain itu ada **pos bayangan** — pos yang tidak diberitahukan lebih dulu ke
   peserta. Pos bayangan **tetap dinilai**, hanya saja yang dinilai bukan
   wahana melainkan hal yang melekat pada regunya sepanjang perjalanan:
   kostum, kekompakan, kesopanan.

   > Sampai 14 Agustus 2026 dokumen ini menulis pos bayangan "tidak dinilai,
   > sehingga tidak dimodelkan sistem sama sekali", dan skema database
   > mengunci nomor pos ke 1–5 atas dasar kalimat itu. Lembar penilaian yang
   > benar-benar dipakai panitia membuktikan sebaliknya — "Pos Bayangan 1
   > Kostum" punya kolom Kreativitas, Kekompakan, dan Kesopanan, punya Nilai
   > Pos, bahkan punya kolom RANK. Dokumennya yang salah; dibetulkan bersama
   > migrasi `0021`.

   Pos bayangan dinilai **dengan mesin yang sama persis** seperti pos utama.
   Ia bukan cabang tersendiri di kode: sebuah baris di tabel `pos` bertanda
   `bayangan`, dengan komponen penilaiannya sendiri, dan bobotnya diatur
   seperti pos mana pun. Yang membedakan hanya kata di judul layar dan di
   kertas. Nomor posnya melanjutkan pos utama — pos bayangan pertama bernomor
   6.
3. Di setiap pos utama ada dua hal yang dinilai, dan **keduanya berasal dari
   tempat yang berbeda**:
   - **Wahana** — tantangan fisik seperti merangkak, berlari, atau memanjat,
     berbeda-beda tergantung pos. Dikerjakan **dan** dinilai di pos itu juga.
   - **Soal kertas** — diambil regu di **pos bayangan tepat sebelum pos ini**,
     dikerjakan sambil berjalan, lalu diserahkan dan dinilai di pos ini.
4. Soal karena itu **berpindah satu langkah**, dan yang membagikannya adalah
   pos bayangan, bukan pos utama sebelumnya:

   | Soal diambil di | Dikerjakan | Diserahkan & dinilai di | Masuk nilai |
   | --- | --- | --- | --- |
   | Pos Bayangan 1 | perjalanan menuju Pos 1 | Pos 1 | **Pos 1** |
   | Pos Bayangan 2 — di ujung Pos 1 | perjalanan Pos 1 → Pos 2 | Pos 2 | **Pos 2** |

   Polanya: **Pos Bayangan N berdiri tepat sebelum Pos N**, dan karena "tepat
   sebelum Pos N" secara fisik berarti "di ujung Pos N−1", regu mengambil
   kertas soal berikutnya sesaat setelah selesai di pos yang baru saja
   dilaluinya. Dua baris di atas yang sudah dipastikan panitia; pos bayangan
   selanjutnya mengikuti bentuk yang sama sejauh edisinya memakainya.

   > **Diperbarui 19 Agustus 2026.** Sampai hari ini bagian ini menulis soal
   > "dibagikan di pos sebelumnya" dengan tabel estafet Pos 1→2, 2→3, 3→4, dan
   > rumus yang menyatakan **Pos 1 tidak menerima soal sama sekali**. Yang
   > membagikan soal ternyata pos bayangan, dan pos bayangan pertama berdiri
   > sebelum Pos 1 — jadi Pos 1 justru pos yang paling awal menerima soal.
   >
   > Database sudah lebih dulu benar dan dokumen ini yang tertinggal: migrasi
   > `0076` memasang **Keagamaan** dan **Kepramukaan** sebagai komponen
   > **Pos 1**, bukan Pos 2. Selama dokumen ini masih berbunyi "Nilai Pos 1 =
   > Wahana Pos 1 (tidak ada soal masuk)", siapa pun yang mencocokkan keduanya
   > akan menyimpulkan migrasinya yang salah pos.
   >
   > **Dua tempat masih menyimpan model lama, dan keduanya sengaja dibiarkan.**
   > Komentar di migrasi `0024` ("soalnya dibagikan di Pos 1 dan dikoreksi di
   > sini") dan `0025` menulis rantai estafet yang lama — migrasi yang sudah
   > diterapkan tidak pernah diedit (`final-architecture.md` bagian 2), jadi
   > keduanya dibaca sebagai catatan sejarah, bukan sebagai aturan yang
   > berlaku. Yang **belum** dibetulkan dan memang perlu digambar ulang adalah
   > `docs/arsitektur-hrcd.svg` beserta pasangan `.png`-nya: di sana masih
   > tertulis "soal berjalan satu pos ke depan" dengan empat kotak "Soal dari
   > Pos N". Bagian ini yang berlaku kalau keduanya berbeda.

5. Rumusnya karena itu:

   ```
   Nilai Pos N = lomba yang dikerjakan DI Pos N
               + soal yang DISERAHKAN di Pos N
   ```

   Pos 1 edisi XXXVII, sebagai contoh lengkap: Semaphore + Tebak Simpul +
   Menaksir (dikerjakan di pos) + Keagamaan + Kepramukaan (soal yang dibawa
   masuk).

6. **Skor soal masuk ke pos tempat soal itu DISERAHKAN, bukan tempat ia
   diambil.** Kertas yang diambil di Pos Bayangan 2 menambah nilai **Pos 2**.
   Perpindahan antar pos hanyalah perpindahan kertas — bukan perpindahan
   nilai.
7. Konsekuensinya untuk operator: operator satu pos memasukkan **dua jenis**
   angka — hasil lomba yang dikerjakan di posnya, dan hasil koreksi soal yang
   dibawa masuk regu. Keduanya tercatat sebagai nilai pos itu juga, sehingga
   pembatasan "satu operator hanya boleh satu pos" tetap utuh: tidak ada
   angka yang harus diserahkan ke operator pos lain.
8. Setiap pos dijaga **minimal 5 orang tim lapangan** dan **2 operator IT**
   dengan laptop.
9. Setiap pos dipastikan memiliki **sinyal, internet, dan sumber pengisian
   daya**.
10. **Penumpukan di pos adalah hal yang wajar dan sebagian memang disengaja.**
    Kemampuan regu beradaptasi ketika pos padat — mempercepat langkah untuk
    mengejar kontrak waktu — termasuk yang diuji dalam lomba. Sebuah pos tidak
    harus menghabiskan satu kloter sebelum kloter berikutnya tiba.
11. Yang harus dijaga hanyalah agar penumpukan **tidak berlebihan**. Ada
    toleransi, tetapi antrean tidak boleh menumpuk terlalu jauh.
12. Karena itu wahana dirancang agar **tidak terlalu sulit**. Dua pengendali yang
    dipakai panitia:
    - **Batas waktu maksimal** pengerjaan wahana per pos.
    - **Beberapa wahana paralel** dalam satu pos.
13. Penentuan skema wahana tiap pos adalah **analisis tersendiri** dan belum
    dilakukan. Lihat bagian 13.

### Alur peserta di satu pos

Bagian ini menelusuri satu regu sejak ia mengambil kertas soal sampai ia keluar
dari pos, beserta apa yang dikerjakan panitia pada saat yang sama. Contohnya
Pos 1 edisi XXXVII; pos lain berbentuk sama dan yang berganti hanya nama
lombanya.

**Jalur peserta.**

```
Pos Bayangan 1   ambil kertas soal Kepramukaan + Keagamaan
      |          dikerjakan sambil berjalan
      v
Pos 1            serahkan kedua kertas soal ke panitia
      |          lalu MENYEBAR ke tiga lomba yang berjalan serentak:
      |          Semaphore  .  Tebak Simpul  .  Menaksir
      v
Pos Bayangan 2   ambil kertas soal untuk Pos 2      (di ujung Pos 1)
      |          dikerjakan sambil berjalan
      v
Pos 2            dan seterusnya
```

**Jalur panitia — dua jalur yang berjalan bersamaan di pos yang sama.**

```
Jalur soal     terima kertas soal dari regu
               -> dikumpulkan dulu
               -> dinilai
               -> difoto + diinput ke sistem

Jalur lomba    tiap lomba punya jurinya sendiri
               -> nilai ditulis di kertas lomba
               -> kertas masuk kotak penilaian
               -> difoto + diinput ke sistem
```

1. **Regu menyebar, tidak mengantre satu per satu.** Begitu kertas soal
   diserahkan, satu regu langsung terbagi ke tiga lomba yang berjalan di titik
   berbeda. Itulah sebabnya kertas penilaian dibuat **per lomba per regu** dan
   bukan satu lembar berisi banyak regu — tiga juri tidak bisa berebut satu
   kertas yang sama. Alasan lengkapnya di bagian 8.3.
2. **Soal dikumpulkan dulu, baru dinilai.** Kertas soal tidak dikoreksi satu
   per satu saat regunya berdiri di depan meja; ia ditumpuk lebih dulu lalu
   dinilai berkelompok. Akibat yang perlu diketahui panitia: **nilai satu regu
   di satu pos terisi dalam dua gelombang** — angka lomba lebih dulu, angka
   soal menyusul. Layar kelengkapan pos karena itu wajar terlihat belum penuh
   padahal regunya sudah lama berjalan, dan itu bukan tanda ada yang
   terlewat.
3. **Dua jalur itu bertemu lagi di meja IT.** Keduanya berakhir dengan langkah
   yang sama persis — difoto lalu diinput — dan fotonya diambil **di meja saat
   nilainya diketik**, bukan diborong di pos, supaya gambarnya tertaut sendiri
   ke nomor dada dan lomba yang tepat. Alasannya di bagian 8.5.
4. **Pos bayangan tidak menahan regu.** Yang terjadi di sana cuma pengambilan
   kertas; regu tidak dinilai wahana apa pun dan langsung melanjutkan
   perjalanan. Penilaian yang melekat pada pos bayangan — kostum, kekompakan,
   kesopanan — berjalan dengan mengamati regu yang lewat, bukan dengan
   menghentikannya (butir 2 di atas).
5. **Yang dibawa regu keluar dari Pos 1 adalah kertas soal Pos 2.** Regu yang
   berjalan tanpa kertas soal berarti ada yang terlewat di Pos Bayangan 2, dan
   itu baru ketahuan di pos berikutnya ketika ia tidak punya apa-apa untuk
   diserahkan.

## 8. Pencatatan dan input nilai

1. Petugas lapangan **hanya mencatat data mentah**, tidak pernah menghitung
   poin. Sistem yang mengonversi data mentah menjadi poin, karena lebih cepat
   dan menjaga konsistensi penilaian.
2. Contoh data mentah:
   - Wahana lari — ditulis `40` untuk 40 detik.
   - Wahana lempar — ditulis `3` untuk 3 kali kena.
   - Soal — jumlah jawaban benar, ditandai centang, atau waktu penyelesaian.
3. **Kertas penilaian dibuat per lomba per regu, bukan satu lembar berisi
   banyak regu.** Alurnya di lapangan:

   1. Regu masuk ke wahana.
   2. Petugas mengambil **satu kertas soal untuk lomba itu** — misalnya Tebak
      Simpul — beserta kertas penilaiannya.
   3. Regu mengerjakan.
   4. Petugas menuliskan nilai mentahnya di kertas itu, mengikuti skala lomba
      tersebut (Tebak Simpul Penggalang `0–5`, Penegak `0–10`).
   5. Kertas dimasukkan ke **kotak penilaian** di pos itu.
   6. Kotaknya diserahkan ke tim IT untuk diinput.
   7. Tim IT **mengurutkan kertasnya menurut nomor dada**, 001 sampai 500,
      lalu memasukkannya berurutan.

   Bentuk ini bukan selera, melainkan tuntutan dua hal yang terjadi bersamaan.
   Di satu pos, beberapa lomba berjalan **serentak di titik yang berbeda** —
   Semaphore di satu sudut, Menaksir di sudut lain. Satu lembar berisi ketiga
   lomba berarti ketiga petugas memperebutkan kertas yang sama, dan yang
   terjadi bukan penilaian bergantian melainkan angka dicatat di kertas lain
   lalu disalin belakangan. Salinan itulah yang hilang.

   Dan satu regu **tidak pernah selesai di semua lomba pada saat yang sama**.
   Lembar berisi 30 regu baru bisa berpindah setelah baris terakhir terisi;
   kertas per regu berpindah begitu regunya selesai.

4. **Nomor dada adalah kepala kertas itu, bukan salah satu kolomnya.** Seluruh
   langkah 7 di atas — mengurutkan ratusan lembar lepas — bertumpu pada satu
   angka yang harus terbaca sambil menyortir cepat. Karena itu nomor dada
   dicetak besar di pojok kiri atas, dan tetap terbaca walau kertasnya
   ditumpuk hanya dengan sudut terlihat.
5. **Kertasnya berpindah tangan secara fisik**, dan itu memang jalurnya. Kotak
   yang hilang atau tertinggal di pos adalah satu-satunya cara nilai lenyap
   tanpa jejak, dan cadangannya sudah dibangun (migrasi `0047`) — tapi
   bentuknya kebalikan dari yang sempat direncanakan di sini.

   **Slip difoto di MEJA IT sambil nilainya diketik**, bukan diborong di pos.
   Alasannya: di meja, fotonya tertaut sendiri ke nomor dada dan lomba yang
   tepat, karena petugas baru saja mengetik keduanya. Foto borongan di pos
   harus dicari satu per satu nanti di antara ribuan gambar, dan cadangan yang
   tidak bisa ditemukan kembali bukan cadangan.

   Harganya disebut supaya tidak jadi kejutan: slip yang hilang **di jalan**
   antara pos dan meja IT tidak pernah difoto sama sekali.

   **Jendela itu sekarang ada penutupnya — layar Foto Jawaban** (migrasi
   `0074`). Panitia di pos memilih Pos dan Lomba, lalu mengunggah banyak foto
   sekaligus; nomor dadanya ditautkan belakangan, satu per satu di layar itu
   juga. Yang membuatnya boleh ada bukan pembatalan alasan di atas melainkan
   pencabutan anggapannya: foto borongan sekarang PUNYA jalan pulang, dan yang
   belum pulang dihitung serta ditampilkan sebagai angka di layar — antrean
   yang tidak terlihat adalah antrean yang tidak pernah dikerjakan.

   Dialog kamera per regu di meja IT **tidak diganti** dan tetap jalur utama:
   di sana fotonya tertaut sendiri, tanpa pekerjaan tambahan.

   **FOTONYA BUKTI, BUKAN SUMBER NILAI — dan itu batas yang keras.** Angka
   yang berlaku adalah yang DIKETIK petugas di layar Input Pos. Foto ada untuk
   satu hal: kalau angka yang tersimpan dipertanyakan, ada yang bisa diadu
   dengannya. Ia tidak pernah menjadi jalan masuk nilai, tidak otomatis dan
   tidak manual.

   Karena itu **kalau isi foto berbeda dari yang terinput, penyelesaiannya
   MANUAL** — dibuka, dibaca, lalu diputuskan orang. Bukan karena mesin tidak
   sanggup membacanya, melainkan karena yang sedang diperdebatkan justru angka
   final seorang regu: keputusan seperti itu milik panitia, bukan milik
   pembacaan gambar yang bisa keliru satu digit.

   Yang boleh dikerjakan mesin cuma **PENAUTAN** — menghubungkan selembar foto
   ke nomor dada pemiliknya supaya ia bisa ditemukan lagi. Itulah arti
   `cara_taut = 'mesin'` (migrasi `0074`), dan skemanya menegakkan batas itu
   sendiri: `catat_foto_masuk` hanya `insert` ke `foto_lembar`,
   `tautkan_foto` hanya `update` `foto_lembar`, dan kata `nilai_mentah` tidak
   muncul satu kali pun di seluruh migrasi itu. Tidak ada jalur dari foto ke
   nilai, bahkan kalau suatu hari ada yang menginginkannya.

   Penautan otomatis pun berhenti kalau ragu: slip menyebut nomor dada DAN
   nama regu, dan kalau keduanya tidak menunjuk regu yang sama, fotonya
   ditinggal belum tertaut untuk diputuskan orang. Foto yang tertaut ke regu
   yang salah bukan sekadar tidak berguna — ia bukti yang membantah nilai yang
   benar.

   Tombolnya kamera di tiap baris lembar Input Pos; gambarnya masuk bucket
   privat `lembar` sesudah dikecilkan jadi abu-abu 1400px di HP, ~70 KB
   per foto.
6. Operator IT memasukkannya ke sistem dengan kunci **nomor dada**, lewat layar
   Input Pos — satu regu satu baris, tersimpan sendiri tanpa tombol Simpan.

   **Upload massal BELUM DIBANGUN.** Rencananya masih berdiri dan RPC-nya
   sudah menerimanya (`simpan_nilai_massal` sudah punya `p_sumber = 'upload'`
   berikut penolakan per baris), tapi tidak ada satu pun layar impor, tempel,
   pemilih berkas, atau preview di `web/js/`. Jangan menuliskannya di sini
   seolah ia ada — panitia yang membaca dokumen ini akan mencarinya di hari-H.
7. Kalau jalur itu kelak dibangun, **wajib melewati layar preview** yang
   menampilkan apa saja yang akan berubah dan menandai kejanggalan — nomor dada
   tidak dikenal, nilai di luar rentang, baris ganda, dan terutama **nilai yang
   akan MENIMPA angka yang sudah ada**, karena pada input pertama itu tidak
   mungkin terjadi dan hampir selalu berarti nomor dada salah baca. Data hasil
   transkripsi otomatis tidak boleh masuk ke perhitungan skor tanpa
   dikonfirmasi manusia.
8. Semua kertas **dicetak sistem** dari layar Input Pos. Yang berisi identitas
   regu hanya form tabel cadangan; **blangko per lomba sengaja kosong**, karena
   regu datang ke pos dengan urutan acak dan slip yang sudah bernama harus
   dicari dulu di tumpukan 500 lembar sebelum bisa dipakai. Di blangko, nomor
   dada ditulis tangan petugas di kotak besar pojok kiri atas. Kolomnya tidak pernah ditulis tangan di berkas mana pun — ia
   lahir dari tabel `wahana`, sehingga kertas tahun depan ikut berubah sendiri
   begitu konfigurasi penilaiannya diganti.

   Ada **tiga bentuk**, dan panitia menyebutnya begini:

   | Bentuk | Isi | Dipakai |
   | --- | --- | --- |
   | **Form per lomba** | **A5 melintang**, satu lomba, **satu regu** | di wahana, lalu masuk kotak (poin 3) |
   | **Form tabel per pos** | satu halaman, semua lomba, 30 regu | **cadangan** — slip habis atau sinyal mati |
   | **Form tabel per pos online** | layar Input Pos | tim IT memasukkan isi kotak |

   **Form per lomba adalah bentuk yang paling banyak dicetak, dan jumlahnya
   besar.** 500 regu di pos berisi tiga lomba berarti **1.500 kertas untuk Pos
   1 saja**. Karena itu yang dicetak dari layar adalah **master**-nya, bukan
   tumpukannya: satu halaman per lomba, lalu diperbanyak dengan mesin
   fotokopi. Ukurannya **A5 melintang** — separuh A4 dipotong mendatar,
   sehingga mesin fotokopi mana pun dapat menggandakannya 2-up ke A4 dan
   tumpukannya dipisah dengan satu potongan lurus.

   Tiga hal yang dikerjakan form per lomba dan **tidak bisa** dikerjakan form
   tabel:

   - **Nomor dada dicetak besar di pojok kiri atas** (poin 4).
   - **Rentangnya milik regu itu.** Di tabel, kolom Tebak Simpul harus menulis
     `0 – 10 / 0 – 5` karena satu kolom melayani empat golongan. Di form per
     lomba, regu Penggalang melihat `0 – 5` saja dan tidak ada yang perlu
     dipilih petugas.
   - **Golongan yang tidak berhak tidak dapat kertasnya sama sekali** — bukan
     dapat lalu dicoret.

   **Form tabel turun jadi cadangan, dan itu keputusan.** Ia sempat
   dipertahankan untuk pos yang dinilai satu meja — PBB, Yel-Yel — dengan
   alasan satu halaman berisi 30 regu lebih cepat. Alasan itu keliru, dan
   sebabnya sama dengan yang membuat kertas per lomba dibuat kosong: **regu
   datang acak**. Di form tabel yang urut nomor dada, petugas harus MENCARI
   baris 005 setiap kali satu regu masuk — pekerjaan yang persis dihapus oleh
   blangko. Tabel mengembalikannya, termasuk di pos berjuri satu.

   Yang tersisa untuknya adalah keadaan yang tidak bisa dilayani kertas lain:
   **blangko habis di tengah lomba, atau sinyal mati sehingga layar tidak bisa
   dibuka**. Untuk itu ia dicetak lebih dulu dan disimpan, tidak dibagikan.
   Kepala halamannya berbunyi LEMBAR CADANGAN supaya petugas yang memegangnya
   tahu itu bukan lembar utama.

   **Semua kertas ini digandakan dengan mesin fotokopi, dan itu menentukan
   bentuknya.** Tidak ada blok hitam, tidak ada tulisan putih di atas gelap,
   tidak ada abu-abu — ketiganya adalah hal yang paling buruk ditangani mesin
   fotokopi, apalagi saat yang digandakan sudah berupa gandaan. Garis minimal
   0,75pt dan huruf minimal 7pt, karena di bawah itu garisnya hilang dan
   huruf-hurufnya menutup sendiri oleh serbuk toner. Kotak yang ditulisi selalu
   putih polos. Aturan lengkapnya di `CLAUDE.md` bagian 8.

   **Form tabel memuat nomor dada 001 sampai batas stok, BERURUTAN tanpa
   lompatan** — termasuk nomor yang belum ada regunya. Tiga sebab, dan
   ketiganya terjadi:

   - Tim IT menyortir tumpukan slip menurut nomor dada lalu menyusurinya dari
     atas. Lembar yang melompati satu nomor menghentikan pekerjaan itu:
     *"slip 012 hilang, atau memang tidak pernah ada?"* — pertanyaan yang
     tidak bisa dijawab dari kertas.
   - Sebagian sekolah **mendaftar offline**. Regunya memakai nomor dada fisik
     yang nyata, tetapi belum ada di database.
   - **Kertasnya dicetak lebih dulu**, sebelum pendaftaran ditutup, dan regu
     yang menyusul tetap harus punya tempat.

   Karena itu baris tanpa regu dibiarkan **kosong dan siap ditulisi**, bukan
   ditandai "tidak dipakai": petugas menuliskan nama regu dan sekolahnya di
   situ, dan meja daftar ulang memakainya untuk melengkapi data belakangan.
   Batasnya diambil dari **stok** nomor dada — nomor fisik yang benar-benar
   dibawa panitia — bukan dari jumlah regu yang sudah terdaftar.

   Satu kolom sengaja **tidak** ikut dicetak di bentuk mana pun: **Nilai Pos**.
   Petugas lapangan hanya menulis data mentah dan tidak pernah menjumlahkan
   sendiri (poin 1) — kotak berjudul Nilai Pos justru mengundang hitungan
   tangan yang berbeda dengan angka sistem. Di form per lomba alasannya
   bertambah satu: kertas yang hanya memuat satu lomba tidak punya cukup bahan
   untuk menghitungnya.

9. Sebuah **server pemantau** menampilkan status kelengkapan input — pos mana
   yang sudah menyetor dan pos mana yang belum.
10. **Satu link untuk semua panitia, akses dibedakan per akun.** Setiap akun
   hanya melihat dan menyentuh bagiannya sendiri:

   | Contoh akun | Akses |
   | --- | --- |
   | `pos1hrcd37` | Hanya input nilai Pos 1 |
   | `pos2hrcd37` | Hanya input nilai Pos 2 |
   | `admin.ciradyka` | Semua bagian sistem |

   Ada tiga peran: `admin`, `meja` (petugas pembayaran / daftar ulang /
   keberangkatan), dan `operator_pos`. Akun hanya diberikan kepada admin tiap
   pos, petugas meja, dan tim IT. Operator sebuah pos tidak dapat menyentuh
   nilai pos lain, dan akun meja ditolak masuk ke layar input pos dengan pesan
   "Akun meja, bukan akun pos" — ditegakkan oleh sistem, bukan sekadar
   disembunyikan dari layar. Sebaliknya akun pos tidak diberi jalan ke layar
   meja: Home-nya hanya memuat satu kartu, "Input Nilai Pos N", dan RLS
   mengosongkan data meja seandainya alamatnya diketik langsung.
11. Pola nama akun mengikuti edisi (`hrcd37` = edisi ke-37), sehingga akun dan
   password dapat diganti bersih setiap tahun tanpa membongkar sistem.
12. Panitia bekerja atas dasar saling percaya, tetapi **riwayat perubahan tetap
    dicatat**: siapa memasukkan atau mengubah nilai apa, dan kapan. Tujuannya
    bukan mengawasi orang, melainkan agar setiap angka dapat ditelusuri kembali
    ketika ada yang janggal.

## 9. Perhitungan skor

1. **Aturan penilaian berubah setiap tahun.** Sistem harus dapat diubah tanpa
   mengubah kode. Yang berikut ini adalah konfigurasi edisi berjalan, bukan
   aturan tetap.
2. **Yang setara adalah LOMBA, bukan pos.** Satuan penilaian adalah lomba, dan
   tiap lomba bernilai maksimum **100**. Maksimum sebuah pos karena itu bukan
   angka tetap melainkan hasil hitungan:

   ```
   maksimum pos = 100 × jumlah lomba di pos itu
   ```

   Pos berisi tiga lomba bernilai 300; pos berisi satu lomba bernilai 100; pos
   berisi lima lomba bernilai 500. Tidak ada batas atas yang perlu dijaga —
   angkanya mengikuti apa pun yang panitia susun tahun itu.

   Edisi XXXVII kebetulan begini:

   | Pos | Lomba | Maksimum |
   | --- | --- | --- |
   | 1 Kepramukaan | Semaphore, Tebak Simpul, Menaksir | 300 |
   | 2 Halang Rintang | Bakiak, Lari Balok, Balap Karung | 300 |
   | 3 P3K | Bidai, Kim Lihat, Kim Cium | 300 |
   | 4 PBB | PBB | 100 |
   | 5 Yel-Yel | Yel-Yel | 100 |

   Akibatnya nyata dan disengaja: regu yang sempurna di Pos 1 mendapat 300,
   yang sempurna di PBB mendapat 100 — Pos 1 tiga kali lebih menentukan
   peringkat. Itu bukan ketimpangan, melainkan cara menghitung yang mengikuti
   jumlah lomba yang benar-benar dikerjakan regu di sana.

   Satu hal yang perlu diperhatikan saat menyusun pos tahun depan: **memindah
   satu lomba dari satu pos ke pos lain mengubah bobot keduanya**, karena
   bobot pos tidak pernah ditulis — ia lahir dari jumlah lombanya.

   > Sampai HRCD XXXVI baris ini berbunyi "bobot setiap pos sama rata", dan
   > waktu itu benar: tiap pos memang satu paket penilaian. Format XXXVII
   > memecah pos menjadi beberapa lomba yang berjalan bersamaan, dan sejak itu
   > "pos" berhenti menjadi satuan yang bisa disetarakan.
   >
   > Kolom `pos.bobot` tetap ada dan tetap 1,00 untuk semua. Ia masih jalan
   > keluar bila suatu tahun panitia ingin menyetarakan pos — tidak perlu
   > mengubah kode, cukup mengubah angkanya.
3. Total skor = **jumlah skor seluruh pos − seluruh penalti** (bagian 10).
4. **Penentu peringkat saat skor seri: ketepatan waktu.** Regu dengan selisih
   waktu lebih kecil terhadap targetnya menempati peringkat lebih tinggi. Ini
   bekerja karena penalti waktu dibulatkan per 10 menit, sedangkan selisih
   sebenarnya tercatat sampai satuan menit — dua regu berpenalti −10 tetap
   dapat dibedakan antara yang meleset 11 menit dan yang meleset 18 menit.
5. Peringkat dihitung **terpisah untuk keempat golongan** (bagian 2.3).
6. Yang wajib dapat dikonfigurasi ulang setiap tahun:
   - Daftar pos dan bobotnya
   - Rumus konversi data mentah menjadi poin, per wahana dan per soal
   - Rumus penalti waktu dan besaran pengurangan lain
   - Pilihan kontrak waktu
   - Formula total skor

## 10. Ketepatan waktu dan penalti

1. Kontrak waktu menentukan target kedatangan:
   **target = jam berangkat kloter + kontrak waktu**.
   Kloter yang berangkat 07.00 dengan kontrak 4 jam ditargetkan tiba 11.00.
2. Jam berangkat berlaku **per kloter**; jam datang dicatat **per regu** di meja
   closing.
   - **Jam berangkat diketik panitia** — dicatat di kertas oleh pencatat, lalu
     dimasukkan.
   - **Jam datang diisi tombol**: panitia mengetik nomor dada, detail regu
     muncul untuk dipastikan, lalu menekan satu tombol "Sampai di Finish".
     Di meja finish juga ada penulisan manual di kertas, **tetapi hanya untuk
     verifikasi** — tombol laptop tetap pencatat utamanya. Selisih semenit dua
     menit antara kertas dan tombol adalah hal wajar (menekan tombol bisa
     terlambat sedikit) dan hampir tidak pernah mengubah penalti, karena
     penalti dibulatkan per 10 menit.
     Targetnya ±3 detik per regu, sehingga 20 regu yang datang bersamaan pun
     tidak menumpuk. Jam yang tersimpan adalah **jam saat tombol ditekan di
     laptop panitia**, bukan timestamp server saat data sampai — dan tetap
     dapat diubah manual untuk pencatatan susulan dari kertas (bagian 12.3).
3. Penalti dihitung dari selisih mutlak antara jam datang dan target:

   ```
   penalti = floor(|selisih dalam menit| / 10) * 10
   ```

4. Penalti bersifat **simetris**. Datang terlalu cepat dihukum sama beratnya
   dengan datang terlambat.
5. Tidak ada aturan toleransi tersendiri. Selisih 0–9 menit tidak dikenai
   penalti semata-mata sebagai akibat pembulatan ke bawah pada rumus di atas.

   | Selisih dari target | Penalti |
   | --- | --- |
   | 0–9 menit | 0 |
   | 10–19 menit | −10 |
   | 20–29 menit | −20 |
   | 30–39 menit | −30 |

6. Tidak ada batas bawah. Total skor boleh menjadi negatif.

### Pengurangan lain di luar penalti waktu

7. **Tidak melakukan checkout** di meja closing: **−100**.
8. **Melewatkan sebuah pos**: nilai pos tersebut menjadi **0**. Tidak ada
   pengurangan tambahan di luar itu.
9. **Anggota regu tidak lengkap.** Kelengkapan diperiksa di akhir lomba, dan
   setiap satu orang yang hilang dikenai **−20**.
10. **Tidak ada mekanisme sanggahan.** Nilai yang sudah direkap bersifat final;
    peserta tidak mengajukan protes atas penilaian.

## 11. Barak

1. Barak adalah **ruang kelas** yang mejanya dikesampingkan untuk tempat
   menginap.
2. Kebutuhan barak ditanyakan sejak formulir pendaftaran (bagian 3.2).
3. Diusahakan **satu ruangan untuk satu sekolah** agar koordinasi lebih mudah.
4. Sekolah dengan jumlah peserta sedikit boleh digabung dengan sekolah lain.
5. **Sistem yang menyusun penempatannya**, bukan sekadar mendaftar siapa yang
   membutuhkan. Berarti sistem perlu mengetahui daftar ruangan beserta
   kapasitasnya, lalu menempatkan sekolah ke ruangan dengan mengutamakan aturan
   3 dan menerapkan aturan 4 hanya bila terpaksa.

## 12. Tata letak meja dan kelenturan peran

1. Jumlah meja: pendaftaran 2–3, pembayaran 2–3, daftar ulang 2–3.
2. **Meja closing hanya 1, paling banyak 2.**
3. Ketika meja closing menumpuk, panitia **mencatat jam datang di kertas** lebih
   dahulu, lalu memasukkannya ke sistem menyusul dan meng-edit-nya bila perlu.
4. Konsekuensi penting bagi sistem: **jam datang adalah waktu yang diketik
   panitia, bukan timestamp server saat data disimpan.** Bila sistem menandai
   waktu sendiri saat penyimpanan, regu yang dicatat 20 menit setelah tiba akan
   dihukum atas keterlambatan yang tidak pernah terjadi. Kolom jam datang wajib
   dapat diisi dan diubah secara manual.
5. Setiap meja dijaga 1–2 orang.
6. **Meja dapat berubah fungsi.** Jika terjadi penumpukan di satu jenis meja,
   meja lain dialihkan — misalnya seluruh meja menjadi meja daftar ulang.
   Sistem tidak boleh mengunci operator atau perangkat pada satu peran.
7. Prinsip menyeluruh yang diminta panitia: sistem harus dirancang sedemikian
   rupa **supaya tidak terjadi penumpukan**. Semakin cepat panitia menginput,
   semakin cepat nilai keluar.

## 13. Yang belum diputuskan

1. **Skema wahana dan interval keberangkatan.** Ditunda sebagai analisis
   tersendiri; akan dibahas terpisah bersama panitia. Interval biasanya 3–5
   menit, tetapi angkanya belum ditetapkan.

   Kerangka perhitungan yang akan dipakai nanti, dicatat di sini agar siap
   dipakai. Kapasitas sebuah pos adalah `jumlah jalur / batas waktu wahana`
   regu per menit, sedangkan arus masuk dari keberangkatan adalah
   `10 / interval` regu per menit. Supaya antrean tidak tumbuh terus-menerus:

   ```
   jumlah jalur >= (10 * batas waktu wahana) / interval keberangkatan
   ```

   Karena penumpukan sedang memang ditoleransi (bagian 7.10), kapasitas boleh
   sedikit di bawah angka itu — tetapi kekurangan kapasitas berdampak
   berlipat pada kloter belakang, sehingga besarnya toleransi perlu dihitung,
   bukan dikira-kira.

   Data yang diperlukan untuk analisis ini, per pos: berapa regu dapat
   mengerjakan wahana secara serentak, dan berapa batas waktu pengerjaannya.

   Besar lompatan kloter (bagian 5.6) juga ditentukan di analisis yang sama,
   karena bergantung pada interval keberangkatan.
2. **Angka rumus konversi data mentah menjadi poin.** Bentuk-bentuknya sudah
   selesai dirancang dan berjalan; yang belum ditentukan tinggal angkanya
   untuk edisi berjalan. Panitia menegaskan **semua kombinasi mungkin
   terjadi**, dan keenam bentuk berikut sudah terpasang:

   | Bentuk | Contoh data mentah |
   | --- | --- |
   | Makin kecil makin baik | waktu tempuh, misal `40` detik |
   | Makin besar makin baik | jumlah kena, misal `3` |
   | Biner | kena / tidak, benar / salah |
   | Benar dibagi total | `7` dari `10` soal |
   | Benar dikurangi salah | jawaban salah mengurangi nilai |
   | Bertingkat | tangga poin per pita waktu — sampai 1 menit = 50, sampai 1,5 menit = 30, sampai 2 menit = 15, lebih dari itu = 0 |

   Karena bentuknya bisa berubah tiap tahun dan tiap wahana, konfigurasi
   konversi dirancang luwes untuk menampung semuanya: keenam bentuk di atas
   ada di fungsi `hitung_poin()`, dan tiap komponen pos diatur lewat satu
   baris konfigurasi, bukan lewat kode. Angka yang terpasang sekarang adalah
   angka HRCD XXXVI sebagai titik awal.
3. **Arti singkatan `IMPK`.** Muncul di contoh lembar nilai yang dulu tertulis
   di bagian 8, dan tidak pernah dijelaskan siapa pun. Contohnya sendiri sudah
   diganti — format kertas sekarang lahir dari tabel `wahana`, bukan dari
   contoh yang diketik tangan — jadi potongan aslinya disimpan di sini supaya
   pertanyaannya tetap bisa dijawab:

   ```
   No Dada - Nama Regu - Nama Sekolah - Golongan | Penilaian (Ikuti Skala) | IMPK (benar = v) - Nilai Pos 3
   ```
4. **Apakah foto berkala tetap diwajibkan setelah kertas berpindah fisik**
   (bagian 8.5). Alur kotak penilaian membuat foto bukan lagi jalur utama,
   tetapi kotak yang hilang atau tertinggal di pos adalah satu-satunya cara
   nilai lenyap tanpa jejak — dan itu justru risiko yang dulu dihindari dengan
   tidak memindahkan kertas sama sekali. Kalau foto tidak diwajibkan, perlu
   disepakati siapa yang bertanggung jawab atas kotak sejak pos tutup sampai
   isinya masuk sistem.
5. **Dua pembacaan pada bagian 10 yang belum dipastikan:**
   - Pengurangan −100 karena tidak checkout — apakah menggantikan penalti waktu,
     atau ditambahkan padanya? Tanpa checkout tidak ada jam datang, sehingga
     penalti waktu tidak dapat dihitung. Dokumen ini menuliskannya sebagai
     pengurangan tersendiri.
   - Pengurangan −20 karena anggota tidak lengkap — apakah dihitung per orang
     yang hilang (2 orang berarti −40) atau tetap −20 berapa pun jumlahnya?
     Dokumen ini mengasumsikan per orang.
6. **Teknologi yang dipakai: SUDAH DIPUTUSKAN dan sudah berjalan.** Panitia
   memilih Kandidat B — Supabase + frontend statis di Cloudflare — dengan
   syarat keras UI/UX harus mudah diajarkan. Google Sheets sempat direncanakan
   sebagai jendela baca tetapi **tidak pernah dipakai**; tidak ada di kode.
   Perbandingan dan alasannya di `desain-sistem.md` bagian 8, cetak birunya di
   `rancangan-b.md` — keduanya catatan keputusan. Untuk keadaan sistem
   sekarang, baca `final-architecture.md`.
   *(Pertanyaan-pertanyaan lain di bagian ini yang sudah terjawab dan pindah ke
   badan dokumen: pembayaran sebagian tidak dilayani — bagian 3.5; kode
   pembayaran per batch terbit saat pendaftaran — bagian 3.4; nama anggota
   selain ketua tidak dicatat untuk sekarang — bagian 3.2; isi dan waktu
   tampilan live — bagian 1.5.)*
