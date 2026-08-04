# Desain Sistem hrcd-rekap — Kandidat Arsitektur Gratis

Dokumen ini menawarkan **empat kandidat arsitektur** untuk mengimplementasikan
seluruh alur di `alur-lomba.md` dengan **biaya Rp 0** — hosting, database,
subdomain, SSL, semuanya. Belum ada kode yang ditulis atau dieksekusi; ini murni
rancangan untuk dipilih.

Setiap kandidat dirancang lengkap terhadap 14 kebutuhan (bagian 1), lalu **diuji
secara adversarial**: klaim biayanya diverifikasi terhadap ketentuan free tier
per Agustus 2026, kuotanya dihitung ulang terhadap beban hari-H, dan dicari satu
kegagalan yang bisa menghancurkan acara. Temuan pentingnya dicantumkan apa
adanya, termasuk yang melemahkan kandidat.

> Aturan main dokumen: istilah teknis pakai bahasa Inggris yang familiar
> (online, link, upload, preview, password), istilah lomba tetap Indonesia
> (regu, nomor dada, kloter). Lihat catatan istilah di `alur-lomba.md`.

## 1. Kebutuhan yang harus dipenuhi

Ringkasan dari `alur-lomba.md` — setiap kandidat dipetakan ke daftar ini:

| # | Kebutuhan |
| --- | --- |
| R1 | Form pendaftaran online (identitas regu, golongan, barak), link sama untuk online & offline |
| R2 | Verifikasi pembayaran manual → kwitansi + kode pembayaran |
| R3 | Daftar ulang 2–3 meja paralel: kode → nomor dada, diambil **per sekolah sekaligus**, tanpa nomor ganda |
| R4 | Kloter otomatis saat itu juga: maks 10 regu, 30 kloter dasar (+31–40), sekolah disebar dengan lompatan yang bisa diatur |
| R5 | Layar garis start: antrean 4 tahap, konfirmasi kontrak waktu, jam berangkat per kloter + ceklis per regu |
| R6 | Input nilai per pos: link + akun/password sendiri per pos; input manual **dan** upload massal Excel/CSV dengan layar preview yang memvalidasi |
| R7 | Mesin skor yang bisa dikonfigurasi panitia tanpa programmer: 5 bentuk konversi, bobot pos, rumus penalti, pengurangan lain |
| R8 | Meja closing: jam datang **diketik manual dan bisa di-edit**, bukan timestamp server |
| R9 | Dashboard pemantau: pos mana sudah input untuk regu mana |
| R10 | Klasemen 4 golongan terpisah, seri dipecah dengan selisih menit |
| R11 | Cetak lembar nilai per pos, terisi identitas regu, setelah daftar ulang tutup |
| R12 | Penempatan barak dihitung sistem (ruangan + kapasitas, 1 sekolah 1 ruangan diutamakan) |
| R13 | Riwayat perubahan: siapa mengubah apa, kapan |
| R14 | Meja bisa berubah fungsi tanpa admin |

## 2. Batasan perancangan

1. **Biaya Rp 0 mutlak.** Tidak boleh ada kartu kredit di mana pun, karena
   "free trial" bukan gratis dan tagihan kejutan bukan pilihan.
2. **Skala:** 300–500 regu, ±2.500 peserta, ±15 perangkat operator bersamaan di
   hari-H. Sinyal dan listrik di tiap pos dijamin panitia.
3. **Pola pemakaian ekstrem:** sistem hidup ±2 bulan setahun dan **idle 10
   bulan**. Banyak free tier menidurkan atau menghapus project yang tidak
   aktif — ini pembunuh senyap untuk acara tahunan, dan jadi ujian utama di
   verifikasi.
4. **Pemelihara:** anggota ambalan (pelajar SMA) yang belajar sambil jalan,
   didampingi satu pemilik berpengalaman. Kode yang jelas menang atas kode yang
   pintar (CLAUDE.md §6).
5. **Aturan skor berubah tiap tahun** — konfigurasi harus berupa data yang bisa
   diedit panitia, bukan kode.

## 3. Kandidat A — Google Sheets + Apps Script

### 3.1 Cara kerja

1. **Satu Google Spreadsheet adalah seluruh database** sekaligus konfigurasi
   skor yang diedit panitia langsung di cell (sheet `KonfigPenilaian`,
   `KonfigKloter`, `Ruangan`, dst).
2. Satu project **Apps Script** menyajikan semua layar (pendaftaran, meja,
   pos, garis start, closing, pemantau, klasemen) sebagai web app; login
   per peran/pos memakai password yang disimpan di sheet.
3. Operasi rawan tabrakan (ambil blok nomor dada per sekolah + sebar kloter)
   dibungkus `LockService` sehingga 2–3 meja paralel tidak menghasilkan nomor
   ganda.
4. Cetak lembar nilai dan kwitansi = generate sheet/Docs → export PDF.
   Riwayat perubahan = sheet log yang ditulis setiap mutasi.
5. Hosting di URL `script.google.com/macros/...` (HTTPS bawaan); link pendek
   via QR atau s.id.

### 3.2 Kelebihan

1. **Gratis paling sejati.** Tidak ada mekanisme tidur, tidak ada project yang
   bisa dijeda, tidak ada kartu — free tier-nya *adalah* produknya. Antar
   acara: tidak ada apa pun yang perlu dijaga selain login setahun sekali.
2. **Database-nya terlihat mata.** Panitia bisa buka spreadsheet dan langsung
   paham; debugging dimulai dengan "buka sheet-nya, lihat". Konfigurasi skor
   tahunan = edit cell, benar-benar tanpa programmer.
3. **Nol ops.** Tidak ada server, deploy pipeline, SSL, migrasi database.
4. Stack dengan jumlah konsep paling sedikit untuk pemelihara pelajar; arsip
   tahunan tetap terbaca selamanya tanpa sistem yang berjalan.
5. Jalur kertas di alur (closing, lembar nilai) sekaligus jadi fallback.

### 3.3 Kekurangan

1. **Langit-langit 30 eksekusi bersamaan** dibagi SEMUA perangkat — dan karena
   web app berjalan anonim, penonton yang ikut membuka halaman polling ikut
   memakan jatah. Verifikasi menandai ini pembunuh utama: ±100 HP penonton
   membuka layar live = operator terkunci. **Mitigasi wajib:** klasemen publik
   disajikan dari sheet "publish to web" (tidak makan eksekusi), halaman
   polling hanya untuk operator.
2. **Latensi 1–4 detik per aksi server** — setiap layar terasa berat, tidak
   bisa diperbaiki.
3. Keamanan setara "sistem kepercayaan": password di sheet, tidak ada isolasi
   server sejati — cukup untuk model kepercayaan panitia, tapi tidak lebih.
4. Database bisa rusak oleh tangan: satu kali sort tidak sengaja oleh
   kolaborator di tengah lomba = insiden data. Restore versi Sheets bersifat
   **seluruh file** — mengembalikan satu kesalahan ikut menghapus semua input
   nilai sesudahnya.
5. Layar paling kritis (preview upload massal R6, pipeline garis start R5)
   justru duduk di bagian platform yang paling canggung (HTMLService).
6. Satu akun Google = titik gagal tunggal untuk hosting, data, dan admin.

### 3.4 Temuan verifikasi

1. Semua angka kuota terkonfirmasi terhadap dokumen resmi (30 eksekusi
   bersamaan, 6 menit/eksekusi, MailApp 100 penerima/hari — jadi kwitansi
   lewat email saja tidak cukup di hari deadline; WhatsApp manual tetap perlu).
2. Login per pos lewat CacheService maksimal 6 jam dan bisa tergusur —
   perlu desain ulang kecil (token di sheet, bukan cache).
3. **Vonis: benar-benar Rp 0 · risiko hari-H: sedang · untuk pelajar: sedang.**

## 4. Kandidat B — Supabase + Cloudflare Pages

### 4.1 Cara kerja

1. **Frontend statis** (HTML + JS polos berbahasa Indonesia, tanpa framework
   berat) di-hosting gratis di Cloudflare Pages (`hrcd.pages.dev`, SSL bawaan).
2. **Supabase free tier** menyediakan Postgres (database sungguhan), Auth
   (akun per pos), dan Realtime (dashboard & klasemen live) — tanpa server
   custom sama sekali.
3. Kebutuhan paling keras — R3, nomor dada per sekolah dari 2–3 meja paralel —
   diselesaikan **transaksi Postgres** (`FOR UPDATE SKIP LOCKED`): nomor ganda
   mustahil secara fisik, bukan sekadar dihindari.
4. Isolasi per pos (R6) ditegakkan **Row-Level Security di server**: operator
   pos 2 tidak bisa menulis nilai pos 3 bahkan kalau membuka devtools.
5. Riwayat perubahan (R13) = trigger otomatis yang menulis nilai lama/baru ke
   tabel `riwayat` — tidak bisa terlewat karena bukan konvensi, tapi mekanisme.
6. Konfigurasi skor tahunan = tabel database yang diedit lewat layar admin.
7. Klasemen, pemantau, tie-break = SQL view pendek yang bisa diaudit dengan
   membacanya.

### 4.2 Kelebihan

1. **Kebenaran data dijamin platform, bukan disiplin manusia**: transaksi
   untuk nomor dada, RLS untuk isolasi pos, trigger untuk riwayat. Tiga
   kebutuhan paling rawan (R3, R6, R13) padam sebagai kekhawatiran.
2. Beban hari-H **jauh di bawah kuota**: 500 regu × 5 pos adalah angka kecil
   untuk Postgres; tidak ada tebing kuota harian seperti Firebase.
3. Frontend-nya ramah pelajar: HTML + JS polos, deploy = `git push`.
4. Link pendaftaran hidup di hosting statis yang tidak pernah tidur, terpisah
   dari status database.
5. **Project Supabase diperlakukan sebagai barang habis pakai**: skema
   disimpan sebagai migrasi di git + arsip data per musim, sehingga kasus
   terburuk (project hilang) = bangun ulang ±1 jam, bukan bencana.

### 4.3 Kekurangan

1. **Project gratis dijeda setelah ±7 hari tidak aktif.** Harus ada cron
   gratis (Cloudflare Worker) yang menyentuh database tiap beberapa hari
   sepanjang tahun, plus ritual cek Januari. Ini disiplin organisasi yang
   dibebankan ke pengurus yang berganti tiap tahun — titik gagal khasnya
   adalah lupa.
2. **RLS + SQL adalah lapisan yang paling tidak terajarkan** untuk pelajar
   SMA. Pelajar bisa memperbaiki label dan layar; kalau policy database rusak,
   hanya pemilik yang bisa menolong — bus factor satu orang, termasuk di
   hari-H.
3. Hari-H menumpang instance gratis bersama tanpa SLA; kalau Supabase
   Singapura terganggu di jendela 5 jam penilaian, tidak ada pemulihan
   hitungan menit — fallback-nya kertas.
4. Egress 5 GB/bulan cukup, tapi satu layar proyektor yang polling serampangan
   bisa memakan jatah — perlu dipagari di kode.
5. Ketentuan free tier Supabase pernah berubah dan bisa berubah lagi; wajib
   diverifikasi ulang tiap Januari.

### 4.4 Temuan verifikasi

1. **Kabar baik yang mengubah kalkulasi:** ketakutan terbesar (project yang
   dijeda hangus setelah 90 hari) **sudah usang** — ketentuan sekarang:
   project yang dijeda bisa dipulihkan sekali klik **sampai 1 tahun**.
   Untuk siklus tahunan, ini mengubah risiko fatal menjadi gangguan kecil.
2. Kelebihan kuota egress tidak memutus layanan seketika — ada masa tenggang
   dengan notifikasi email dulu.
3. Form pendaftaran publik perlu pagar anti-spam (rate limit / CAPTCHA
   gratis) karena menerima tulisan anonim selama berminggu-minggu.
4. Cloudflare Pages berstatus "maintenance mode" (masih gratis dan menerima
   project baru; alternatif setara: Workers static assets — perubahan
   satu perintah deploy).
5. **Vonis: benar-benar Rp 0 · risiko hari-H: sedang · untuk pelajar: sedang.**

## 5. Kandidat C — Firebase Spark ❌ (gugur)

### 5.1 Cara kerja (ringkas)

SPA di Firebase Hosting + Firestore sebagai database + Firebase Auth; tanpa
server sama sekali (Cloud Functions butuh kartu kredit), sehingga mesin skor,
kloter, validasi upload — semuanya berjalan di browser.

### 5.2 Kenapa gugur

1. **Tebing kuota baca 50.000/hari bisa tersentuh justru karena acaranya
   sukses.** Hitungan jujur: model data alami (satu dokumen per nilai) +
   dashboard live yang ditonton beberapa perangkat = 48–90 ribu baca di
   hari-H. Model hemat kuota (dokumen agregat) bisa menekan ke ±33 ribu,
   tapi cukup selusin penonton membuka klasemen untuk melewati 50 ribu.
2. **Kehabisan kuota = mati total membaca data sampai jam 15.00 WIB** —
   persis di tengah jendela penilaian dan closing. Tidak ada jalan keluar
   berbayar yang tetap Rp 0.
3. Model dokumen agregat yang menyelamatkan kuota adalah **jebakan bagi
   penerus**: refactor alami yang diajarkan semua tutorial Firebase ("listen
   ke collection") lolos semua pengujian di 20 regu dan menghancurkan acara
   di 500 regu.
4. Tanpa server, tidak ada satu pun tempat yang bisa memaksa "setiap
   perubahan nilai wajib tercatat di riwayat" — R13 tinggal konvensi.
5. Sejak Okt 2025, Cloud Storage butuh Blaze (kartu kredit) bahkan untuk
   project lama — foto bukti transfer tidak akan pernah bisa disimpan.
6. **Vonis: Rp 0 tapi risiko hari-H: TINGGI · untuk pelajar: SULIT.**

## 6. Kandidat D — PocketBase di laptop panitia + Cloudflare Tunnel

### 6.1 Cara kerja

1. **Satu file program** (PocketBase: Go + SQLite, open source, ±40 MB) di
   laptop milik panitia adalah seluruh sistem minggu-H: database, auth per
   pos, realtime, admin UI, dan frontend — satu folder yang bisa di-copy.
2. Laptop diekspos ke 5 pos lewat **Cloudflare Tunnel gratis** (tanpa IP
   publik, jalan di belakang hotspot) di subdomain gratis.
3. Untuk jendela pendaftaran berminggu-minggu (laptop tidak mungkin menyala
   terus): **hybrid** — Google Form (link tunggal, memenuhi R1 secara
   harfiah) + verifikasi pembayaran di Sheet, lalu di-import sekali ke
   PocketBase menjelang daftar ulang.
4. Failover = laptop kedua yang menyimpan salinan folder; baterai laptop =
   UPS gratis.

### 6.2 Kelebihan

1. **Satu-satunya kandidat tanpa risiko dormansi sama sekali**: antar acara
   sistemnya adalah laptop mati dan folder backup di Drive — tidak ada free
   tier yang bisa berubah ketentuan terhadap barang yang tidak di-hosting.
2. SQLite penulis-tunggal + UNIQUE index membuat R3 (kebutuhan paling keras)
   jadi yang paling mudah — tanpa penalaran sistem terdistribusi.
3. Kedaulatan data penuh: PII pelajar tidak pernah tinggal di platform pihak
   ketiga.
4. Cerita backup/restore/failover yang bisa **dipahami secara fisik** oleh
   pelajar: jalankan file exe di laptop lain.
5. Performa bukan masalah: 15 perangkat dan 500 regu adalah beban recehan
   untuk SQLite di laptop mana pun.

### 6.3 Kekurangan

1. **Tanggung jawab hardware jatuh ke pelajar di momen terburuk: hari-H.**
   Penyebab mati paling mungkin bersifat domestik — tutup layar, Windows
   Update, kopi tumpah, kabel tersandung. Mitigasinya prosedur dan latihan,
   dan prosedur membusuk di antara acara tahunan dengan pengurus berganti.
2. **Uplink laptop server jadi titik gagal tunggal untuk kelima pos** —
   kebalikan dari jaminan koneksi per pos di spek.
3. Logika server ditulis di lingkungan niche (pb_hooks: JavaScript ES5 tanpa
   npm, dokumentasi tipis, nyaris nol materi berbahasa Indonesia) —
   praktis hanya pemilik yang bisa menyentuhnya.
4. Butuh dua subsistem (Sheet + PocketBase) dengan satu langkah sinkronisasi.
5. Verifikasi menemukan: subdomain gratis eu.org bisa makan **berminggu-minggu
   sampai berbulan-bulan** disetujui (harus diurus jauh hari); sinkronisasi
   Sheet lewat "publish to web" **membocorkan PII pelajar ke URL publik**
   (harus diganti mekanisme lain); dan koneksi realtime SSE diputus proxy
   Cloudflare tiap ±100 detik idle (perlu reconnect otomatis).
6. Output daftar ulang (nomor dada ↔ kloter) lahir digital dan **tidak punya
   padanan kertas** — wajib ada log kertas di meja, atau crash saat daftar
   ulang jadi bencana.
7. **Vonis: benar-benar Rp 0 · risiko hari-H: sedang · untuk pelajar: sedang
   (ops mudah, kode server sulit).**

## 7. Perbandingan

| Aspek | A · Sheets | B · Supabase | C · Firebase | D · PocketBase |
| --- | --- | --- | --- | --- |
| Benar-benar Rp 0 | ✅ | ✅ | ✅ | ✅ |
| Risiko hari-H | Sedang | Sedang | **Tinggi** | Sedang |
| Untuk pemelihara pelajar | Sedang | Sedang | Sulit | Sedang |
| Risiko 10 bulan idle | **Nol** | Kecil (perlu keep-alive) | Kecil | **Nol** |
| Nomor dada anti-ganda (R3) | Lock aplikasi | **Transaksi DB** | Transaksi klien | **UNIQUE index** |
| Isolasi per pos (R6) | Kepercayaan | **Ditegakkan server** | Ditegakkan server | Ditegakkan server |
| Riwayat perubahan (R13) | Konvensi kode | **Trigger otomatis** | Konvensi kode | Hook server |
| Konfigurasi skor oleh panitia (R7) | **Edit cell langsung** | Layar admin | Layar admin | Layar admin |
| Kecepatan layar | Lambat (1–4 dtk) | Cepat | Cepat | **Paling cepat** |
| Titik gagal khas | Kuota eksekusi + salah edit | Lupa keep-alive + bus factor SQL | Tebing kuota baca | Hardware + manusia |

Semua kandidat berbagi satu batas yang sama pada R7: lima bentuk konversi yang
sudah dienumerasi bisa diubah panitia sendiri, tetapi bentuk rumus yang **benar-
benar baru** tetap butuh pemilik menyentuh kode — di kandidat mana pun.

## 8. Rekomendasi

1. **Rekomendasi utama: Kandidat B (Supabase + Cloudflare Pages).**
   Alasannya satu kalimat: **tiga kebutuhan yang paling berbahaya kalau salah
   (R3 nomor ganda, R6 isolasi pos, R13 riwayat) dijamin oleh platform, bukan
   oleh kehati-hatian orang** — dan kelemahan legendarisnya (project dijeda)
   ternyata sudah jinak: jendela pemulihan kini 1 tahun, pas untuk siklus
   tahunan, ditambah keep-alive gratis dan skema-sebagai-kode di git.
2. **Runner-up kuat: Kandidat A (Sheets)** — pilih ini jika panitia menimbang
   "database yang bisa dilihat mata dan diedit siapa pun" lebih berharga
   daripada jaminan mesin, dan sanggup hidup dengan layar yang lambat serta
   disiplin jangan-sort-sembarangan.
3. **Kandidat D** terhormat tapi memindahkan risiko dari kuota cloud ke
   hardware dan manusia di hari yang paling sibuk. Masuk akal bila kedaulatan
   data menjadi tuntutan, atau sebagai **fallback offline** yang disiapkan di
   samping kandidat B.
4. **Kandidat C gugur** — satu-satunya yang bisa mati justru karena acaranya
   ramai.

## 9. Keputusan yang menunggu panitia

1. Pilih kandidat (bagian 8).
2. Siapa yang memegang akun-akun gratis (Google/Supabase/Cloudflare/GitHub) —
   disarankan akun organisasi ambalan, bukan akun pribadi pengurus, dengan
   minimal dua orang tahu password-nya.
3. Untuk kandidat B: siapa yang menjalankan ritual cek Januari (buka dashboard,
   verifikasi project aktif, uji satu alur input).
4. Bentuk pagar anti-spam form pendaftaran (pertanyaan sederhana / rate limit).
5. Jadwal latihan hari-H (drill failover) — relevan untuk kandidat mana pun.
