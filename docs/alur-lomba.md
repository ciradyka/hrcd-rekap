# Alur dan Aturan Hiking Rally Ciradyka

Dokumen ini merekam alur penyelenggaraan dan aturan penilaian Hiking Rally
Ciradyka (HRCD) sebagai dasar perancangan sistem `hrcd-rekap`.

Isinya adalah hasil penjelasan panitia, bukan rancangan teknis. Keputusan
teknologi belum diambil dan sengaja tidak dibahas di sini.

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
     hanya progres tanpa angka (regu X sudah melewati pos Y), nilai dan
     peringkat lengkap baru tampil setelah closing. Halaman ini **disajikan
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
   4. **Mendaftarkan berapa regu?**
   5. **Rincian golongan** yang jumlahnya harus sama dengan total — misal 5
      regu = 3 Penegak PA + 1 Penegak PI + 1 Penggalang PA. Form memvalidasi
      penjumlahannya.
   6. **Untuk setiap regu:** nama regu dan nama ketua. **Nama empat anggota
      lain tidak diminta** — untuk sekarang sistem tidak mencatatnya;
      kelengkapan 5 orang dicek fisik di akhir lomba (bagian 10.9).
   7. **Satu kontak person WA** untuk keseluruhan batch.
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
   mendaftar diarahkan ke meja pendaftaran offline lebih dulu (bagian 3.5).
3. Di meja daftar ulang, regu menyebutkan **kode pembayaran** sebagai ID.
   Panitia mengonfirmasi **nama regu** dan **asal sekolah**.
4. Panitia lalu menyandingkan regu dengan sebuah **nomor dada**, diambil dari
   stok fisik yang sudah disiapkan sebelumnya. Karena nomor dada diambil dari
   stok saat itu juga dan meja daftar ulang lebih dari satu, satu nomor dada
   tidak boleh terpakai dua kali.
5. **Pengambilan nomor dada dilakukan sekaligus per sekolah**, bukan satu regu
   satu kali. Sekolah dengan 10 regu mengambil 10 nomor dada dalam satu
   transaksi di meja. Ini menjadi dasar pembagian kloter — lihat bagian 5.
6. Setelah daftar ulang ditutup, **lembar penilaian dicetak** untuk dibagikan ke
   petugas lapangan (bagian 8.4).

## 5. Kloter dan kontrak waktu

1. Satu kloter berisi **paling banyak 10 regu**. Jumlahnya dapat kurang dari 10
   bila ada regu yang batal setelah membayar (bagian 3.6).
2. **30 kloter selalu ada**, karena jumlah peserta konsisten di kisaran 300
   regu. Kloter 31–40 dibuka hanya jika terisi, dan kloter terakhir boleh tidak
   penuh.
3. Kloter ditentukan **otomatis** begitu regu menerima nomor dada.
4. **Tujuan pembagian kloter: sesedikit mungkin regu dari sekolah yang sama
   berada dalam satu kloter.** Alasannya bukan teknis melainkan sportivitas —
   regu satu sekolah yang berangkat bersamaan cenderung bercengkerama di
   sepanjang rute alih-alih berlomba.
5. **Cara pembagiannya bertumpu pada pengambilan nomor dada per sekolah**
   (bagian 4.5). Sekolah yang mengambil 10 nomor dada langsung disebar ke 10
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
      jam berangkat. Lembar ini juga menyediakan kotak bagi **pembina regu
      untuk mencatat jam berangkat sebenarnya**, karena pembina biasa
      mencatatnya sebagai bahan klarifikasi bila penilaian ketepatan waktu
      dipersoalkan (target datang = jam berangkat + kontrak waktu).
11. **Peserta yang terlambat masuk kloternya** diberangkatkan di **kloter
    terakhir**. Bila keadaannya mendesak, panitia dapat memaksa nomor dada
    tertentu masuk kloter mana pun — termasuk kloter yang kertasnya sudah
    beredar. Regu yang disisipkan setelah cetak **wajib ditandai sistem**,
    karena nomornya tidak ada di kertas yang dipegang petugas staging.

## 7. Rute dan pos

1. Terdapat **5 pos utama** di sepanjang rute, masing-masing dengan soal dan
   wahana yang berbeda.
2. Selain itu ada **pos bayangan**. Pos bayangan umumnya tidak memiliki wahana
   dan **tidak dinilai**, sehingga tidak dimodelkan oleh sistem sama sekali.
3. Di setiap pos utama regu mengerjakan:
   - **Soal kertas** — dinilai petugas lapangan di lembar cetak.
   - **Wahana** — tantangan fisik seperti merangkak, berlari, atau memanjat,
     berbeda-beda tergantung pos.
4. Setiap pos dijaga **minimal 5 orang tim lapangan** dan **2 operator IT**
   dengan laptop.
5. Setiap pos dipastikan memiliki **sinyal, internet, dan sumber pengisian
   daya**.
6. **Penumpukan di pos adalah hal yang wajar dan sebagian memang disengaja.**
   Kemampuan regu beradaptasi ketika pos padat — mempercepat langkah untuk
   mengejar kontrak waktu — termasuk yang diuji dalam lomba. Sebuah pos tidak
   harus menghabiskan satu kloter sebelum kloter berikutnya tiba.
7. Yang harus dijaga hanyalah agar penumpukan **tidak berlebihan**. Ada
   toleransi, tetapi antrean tidak boleh menumpuk terlalu jauh.
8. Karena itu wahana dirancang agar **tidak terlalu sulit**. Dua pengendali yang
   dipakai panitia:
   - **Batas waktu maksimal** pengerjaan wahana per pos.
   - **Beberapa wahana paralel** dalam satu pos.
9. Penentuan skema wahana tiap pos adalah **analisis tersendiri** dan belum
   dilakukan. Lihat bagian 13.

## 8. Pencatatan dan input nilai

1. Petugas lapangan **hanya mencatat data mentah**, tidak pernah menghitung
   poin. Sistem yang mengonversi data mentah menjadi poin, karena lebih cepat
   dan menjaga konsistensi penilaian.
2. Contoh data mentah:
   - Wahana lari — ditulis `40` untuk 40 detik.
   - Wahana lempar — ditulis `3` untuk 3 kali kena.
   - Soal — jumlah jawaban benar, ditandai centang, atau waktu penyelesaian.
3. **Lembar nilai tidak berpindah tangan secara fisik.** Petugas lapangan
   **memfoto lembar secara berkala** dan mengirimkan fotonya ke operator IT di
   pos. Dengan begitu nilai mengalir sepanjang lomba, bukan menumpuk sampai pos
   tutup.
4. Operator IT memasukkannya ke sistem dengan kunci **nomor dada**, melalui dua
   jalur:
   - **Input manual**, satu regu satu kali.
   - **Upload massal.** Tim IT boleh memakai AI untuk mengubah foto lembar
     menjadi tabel Excel, lalu meng-copy atau meng-upload-nya ke sistem.
5. Karena jalur kedua bergantung pada pembacaan otomatis yang bisa salah,
   **upload massal wajib melewati layar preview** yang menampilkan apa saja
   yang akan berubah dan menandai kejanggalan — nomor dada tidak dikenal, nilai
   di luar rentang wajar, atau baris ganda. Data hasil transkripsi otomatis
   tidak boleh masuk langsung ke perhitungan skor tanpa dikonfirmasi manusia.
6. Lembar nilai **dicetak sistem** setelah daftar ulang ditutup, sudah terisi
   identitas regu, menyisakan kolom kosong untuk diisi petugas. Formatnya
   seperti:

   ```
   No Dada - Nama Regu - Nama Sekolah - Golongan | Penilaian (Ikuti Skala) | IMPK (benar = v) - Nilai Pos 3

   001 - Rajawali - SMPN 1 Purwadadi - Penggalang PA - V
   ```

7. Sebuah **server pemantau** menampilkan status kelengkapan input — pos mana
   yang sudah menyetor dan pos mana yang belum.
8. **Satu link untuk semua panitia, akses dibedakan per akun.** Setiap akun
   hanya melihat dan menyentuh bagiannya sendiri:

   | Contoh akun | Akses |
   | --- | --- |
   | `pos1hrcd37` | Hanya input nilai Pos 1 |
   | `pos2hrcd37` | Hanya input nilai Pos 2 |
   | `admin.ciradyka` | Semua bagian sistem |

   Akun hanya diberikan kepada admin tiap pos dan tim IT. Operator sebuah pos
   tidak dapat menyentuh nilai pos lain — ditegakkan oleh sistem, bukan sekadar
   disembunyikan dari layar.
9. Pola nama akun mengikuti edisi (`hrcd37` = edisi ke-37), sehingga akun dan
   password dapat diganti bersih setiap tahun tanpa membongkar sistem.
9. Panitia bekerja atas dasar saling percaya, tetapi **riwayat perubahan tetap
   dicatat**: siapa memasukkan atau mengubah nilai apa, dan kapan. Tujuannya
   bukan mengawasi orang, melainkan agar setiap angka dapat ditelusuri kembali
   ketika ada yang janggal.

## 9. Perhitungan skor

1. **Aturan penilaian berubah setiap tahun.** Sistem harus dapat diubah tanpa
   mengubah kode. Yang berikut ini adalah konfigurasi edisi berjalan, bukan
   aturan tetap.
2. Bobot setiap pos **sama rata**.
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
     Targetnya ±3 detik per regu, sehingga 20 regu yang datang bersamaan pun
     tidak menumpuk. Jam yang tersimpan adalah **jam saat tombol ditekan di
     laptop panitia**, bukan cap waktu server saat data sampai — dan tetap
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

   Karena penumpukan sedang memang ditoleransi (bagian 7.5), kapasitas boleh
   sedikit di bawah angka itu — tetapi kekurangan kapasitas berdampak
   berlipat pada kloter belakang, sehingga besarnya toleransi perlu dihitung,
   bukan dikira-kira.

   Data yang diperlukan untuk analisis ini, per pos: berapa regu dapat
   mengerjakan wahana secara serentak, dan berapa batas waktu pengerjaannya.

   Besar lompatan kloter (bagian 5.6) juga ditentukan di analisis yang sama,
   karena bergantung pada interval keberangkatan.
2. **Bentuk rumus konversi data mentah menjadi poin.** Belum ditentukan, dan
   panitia menegaskan **semua kombinasi mungkin terjadi**. Bentuk yang sudah
   disebut:

   | Bentuk | Contoh data mentah |
   | --- | --- |
   | Makin kecil makin baik | waktu tempuh, misal `40` detik |
   | Makin besar makin baik | jumlah kena, misal `3` |
   | Biner | kena / tidak, benar / salah |
   | Benar dibagi total | `7` dari `10` soal |
   | Benar dikurangi salah | jawaban salah mengurangi nilai |

   Karena bentuknya bisa berubah tiap tahun dan tiap wahana, konfigurasi
   konversi harus dirancang cukup luwes untuk menampung semuanya. Perancangan
   detailnya ditunda.
3. **Arti singkatan `IMPK`** pada contoh lembar nilai di bagian 8.4.
4. **Dua pembacaan pada bagian 10 yang belum dipastikan:**
   - Pengurangan −100 karena tidak checkout — apakah menggantikan penalti waktu,
     atau ditambahkan padanya? Tanpa checkout tidak ada jam datang, sehingga
     penalti waktu tidak dapat dihitung. Dokumen ini menuliskannya sebagai
     pengurangan tersendiri.
   - Pengurangan −20 karena anggota tidak lengkap — apakah dihitung per orang
     yang hilang (2 orang berarti −40) atau tetap −20 berapa pun jumlahnya?
     Dokumen ini mengasumsikan per orang.
5. **Teknologi yang dipakai: SUDAH DIPUTUSKAN.** Panitia memilih Kandidat B —
   Supabase + frontend statis di Cloudflare, dengan Google Sheets tetap
   sebagai jendela baca — dengan syarat keras UI/UX harus mudah diajarkan.
   Perbandingan lengkap dan alasan di `desain-sistem.md` bagian 8; rancangan
   detail di `rancangan-b.md`.
   *(Pertanyaan-pertanyaan lain di bagian ini yang sudah terjawab dan pindah ke
   badan dokumen: pembayaran sebagian tidak dilayani — bagian 3.5; kode
   pembayaran per batch terbit saat pendaftaran — bagian 3.4; nama anggota
   selain ketua tidak dicatat untuk sekarang — bagian 3.2; isi dan waktu
   tampilan live — bagian 1.5.)*
