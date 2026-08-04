# Alur dan Aturan Hiking Rally Ciradyka

Dokumen ini merekam alur penyelenggaraan dan aturan penilaian Hiking Rally
Ciradyka (HRCD) sebagai dasar perancangan sistem `hrcd-rekap`.

Isinya adalah hasil penjelasan panitia, bukan rancangan teknis. Keputusan
teknologi belum diambil dan sengaja tidak dibahas di sini.

> **Penting:** aturan penilaian **berubah setiap tahun**. Semua angka di dokumen
> ini adalah konfigurasi edisi berjalan, bukan spesifikasi permanen. Lihat
> bagian 9.

## 1. Konteks

1. HRCD adalah lomba gerak jalan alam terbuka untuk pelajar SMP dan SMA.
2. Penyelenggara: Ambalan Ciung Wanara – Dyah Pitaloka, SMA Negeri 1 Ciamis,
   Jawa Barat.
3. Diadakan rutin setiap tahun, biasanya Februari atau Maret.
4. Skala peserta konsisten di kisaran 300 regu, dengan batas atas sekitar 500.
5. Pengguna sistem untuk saat ini **hanya panitia**. Belum ada akses peserta
   maupun publik.

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
   - **Kode pembayaran** — terbit setelah pembayaran diverifikasi. Menjadi ID
     yang disebutkan regu saat daftar ulang.
   - **Nomor dada** — diberikan saat daftar ulang. Menjadi nomor peserta dan
     dipakai sebagai kunci di seluruh tahap berikutnya.

## 3. Pendaftaran

1. Regu mendaftar secara daring dan mengisi identitas.
2. Formulir menanyakan **"apakah memerlukan tempat menginap?"**. Jawaban ya
   memasukkan regu ke skema penempatan barak (bagian 11).
3. Regu melakukan pembayaran.
4. Panitia memverifikasi pembayaran, lalu regu menerima **kwitansi** dan
   **kode pembayaran**.
5. Pendaftaran daring dan luring memakai **tautan yang sama**. Regu yang belum
   mendaftar dapat mendaftar di lokasi lewat HP atau laptop di meja pendaftaran
   luring, lalu membayar tunai atau transfer ke rekening panitia.
6. **Tidak ada pengembalian dana.** Regu yang batal setelah membayar tidak
   digantikan, dan kloternya tetap berjalan dengan jumlah regu berkurang.

## 4. Daftar ulang

1. Berlangsung 1–2 hari sebelum lomba.
2. Regu yang sudah membayar langsung menuju meja daftar ulang. Regu yang belum
   mendaftar diarahkan ke meja pendaftaran luring lebih dulu (bagian 3.5).
3. Di meja daftar ulang, regu menyebutkan **kode pembayaran** sebagai ID.
   Panitia mengonfirmasi **nama regu** dan **asal sekolah**.
4. Panitia lalu menyandingkan regu dengan sebuah **nomor dada**, diambil dari
   stok fisik yang sudah disiapkan sebelumnya. Karena nomor dada diambil dari
   stok saat itu juga dan meja daftar ulang lebih dari satu, satu nomor dada
   tidak boleh terpakai dua kali.
5. Setelah daftar ulang ditutup, **lembar penilaian dicetak** untuk dibagikan ke
   petugas lapangan (bagian 8.4).

## 5. Kloter dan kontrak waktu

1. Satu kloter berisi **paling banyak 10 regu**. Jumlahnya dapat kurang dari 10
   bila ada regu yang batal setelah membayar (bagian 3.6).
2. **30 kloter selalu ada**, karena jumlah peserta konsisten di kisaran 300
   regu. Kloter 31–40 dibuka hanya jika terisi, dan kloter terakhir boleh tidak
   penuh.
3. Kloter ditentukan **otomatis** begitu regu menerima nomor dada.
4. Penempatan kloter **diacak dengan sengaja**. Satu sekolah bisa mengirim
   puluhan regu, dan mereka tidak boleh berangkat bersamaan.
5. Setiap regu memilih **kontrak waktu**: 3,5 / 4 / 4,5 jam. Kontrak dipilih per
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

## 7. Rute dan pos

1. Terdapat **5 pos utama** di sepanjang rute, masing-masing dengan soal dan
   wahana yang berbeda.
2. Di setiap pos regu mengerjakan:
   - **Soal kertas** — dinilai petugas lapangan di lembar cetak.
   - **Wahana** — tantangan fisik seperti merangkak, berlari, atau memanjat,
     berbeda-beda tergantung pos.
3. Setiap pos dijaga **minimal 5 orang tim lapangan** dan **2 operator IT**
   dengan laptop.
4. Setiap pos dipastikan memiliki **sinyal, internet, dan sumber pengisian
   daya**.
5. **Penumpukan di pos adalah hal yang wajar dan sebagian memang disengaja.**
   Kemampuan regu beradaptasi ketika pos padat — mempercepat langkah untuk
   mengejar kontrak waktu — termasuk yang diuji dalam lomba. Sebuah pos tidak
   harus menghabiskan satu kloter sebelum kloter berikutnya tiba.
6. Yang harus dijaga hanyalah agar penumpukan **tidak berlebihan**. Ada
   toleransi, tetapi antrean tidak boleh menumpuk terlalu jauh.
7. Karena itu wahana dirancang agar **tidak terlalu sulit**. Dua pengendali yang
   dipakai panitia:
   - **Batas waktu maksimal** pengerjaan wahana per pos.
   - **Beberapa wahana paralel** dalam satu pos.
8. Penentuan skema wahana tiap pos adalah **analisis tersendiri** dan belum
   dilakukan. Lihat bagian 13.

## 8. Pencatatan dan input nilai

1. Petugas lapangan **hanya mencatat data mentah**, tidak pernah menghitung
   poin. Sistem yang mengonversi data mentah menjadi poin, karena lebih cepat
   dan menjaga konsistensi penilaian.
2. Contoh data mentah:
   - Wahana lari — ditulis `40` untuk 40 detik.
   - Wahana lempar — ditulis `3` untuk 3 kali kena.
   - Soal — jumlah jawaban benar, ditandai centang, atau waktu penyelesaian.
3. Lembar nilai diserahkan ke operator IT di pos, lalu diinput ke sistem dengan
   kunci **nomor dada**.
4. Lembar nilai **dicetak sistem** setelah daftar ulang ditutup, sudah terisi
   identitas regu, menyisakan kolom kosong untuk diisi petugas. Formatnya
   seperti:

   ```
   No Dada - Nama Regu - Nama Sekolah - Golongan | Penilaian (Ikuti Skala) | IMPK (benar = v) - Nilai Pos 3

   001 - Rajawali - SMPN 1 Purwadadi - Penggalang PA - V
   ```

5. Sebuah **server pemantau** menampilkan status kelengkapan input — pos mana
   yang sudah menyetor dan pos mana yang belum.
6. **Setiap pos memiliki tautan input sendiri**, yang hanya dapat dibuka dengan
   akun dan kata sandi khusus pos tersebut. Operator sebuah pos tidak dapat
   menyentuh nilai pos lain.
7. Panitia bekerja atas dasar saling percaya, tetapi **riwayat perubahan tetap
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

## 12. Tata letak meja dan kelenturan peran

1. Jumlah meja: pendaftaran 2–3, pembayaran 2–3, daftar ulang 2–3.
2. Setiap meja dijaga 1–2 orang.
3. **Meja dapat berubah fungsi.** Jika terjadi penumpukan di satu jenis meja,
   meja lain dialihkan — misalnya seluruh meja menjadi meja daftar ulang.
   Sistem tidak boleh mengunci operator atau perangkat pada satu peran.
4. Prinsip menyeluruh yang diminta panitia: sistem harus dirancang sedemikian
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
5. **Teknologi yang dipakai.** Sengaja ditunda sampai alur ini disepakati.
