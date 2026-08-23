# Sistem sebagaimana adanya

**Acuan utama.** Dokumen ini menggambarkan apa yang benar-benar berjalan hari
ini, bukan rencana. Kalau `desain-sistem.md` atau `rancangan-b.md` berbeda dari
dokumen ini, **dokumen ini yang benar** — keduanya catatan keputusan, ditulis
sebelum sistemnya dibangun.

Terakhir diperiksa terhadap kode: **23 Agustus 2026**, sampai migrasi `0106`.

---

## 1. Bentuk sistem

Empat bagian, dan hanya satu di antaranya kode yang kita tulis dan jalankan
sendiri di server:

| Bagian | Isi | Di mana |
| --- | --- | --- |
| Database | Postgres + Auth + RLS + seluruh logika | Supabase |
| Layar panitia | SPA statis, tanpa build step | Cloudflare Workers static assets |
| Situs peserta | Pendaftaran + rekap live | Cloudflare Worker TERPISAH |
| Gateway | Penerima form pendaftaran publik | Cloudflare Worker |

**Tidak ada server aplikasi.** Layar panitia berbicara langsung ke Supabase
lewat PostgREST memakai anon key; yang menjaga data bukan lapisan tengah,
melainkan RLS dan RPC di database. Satu-satunya kode server adalah gateway,
dan ia hanya menangani satu hal: form pendaftaran publik, yang harus bisa
dikirim tanpa login.

Yang **tidak** dipakai, meski disebut di dokumen lama: Google Sheets dan
Cloudflare Pages. Halaman live publik SUDAH ada sejak 14 Agustus 2026, tapi
bentuknya `live/index.html` + `live/live.json` di Worker sendiri — bukan
`live.html` di proyek yang sama seperti tertulis di `rancangan-b.md` bagian 7.

### Alamat produksi

| Apa | Alamat |
| --- | --- |
| Situs peserta — pendaftaran + rekap live | `https://hrcd37.ciradyka.workers.dev` |
| Layar panitia | `https://panitia-hrcd37.ciradyka.workers.dev` |
| Gateway pendaftaran | `https://gateway.ciradyka.workers.dev` |
| Supabase | `https://pwszijhnftvqjkdldqrf.supabase.co` |

**Alamat pendek milik peserta, bukan panitia.** Yang dibagikan ke ratusan
orang lewat grup WhatsApp adalah `hrcd37.ciradyka.workers.dev`; layar panitia
berawalan `panitia-`. Memisahkannya tidak mencegah siapa pun mencoba masuk —
alamat panitia tetap ada — tapi peserta tidak pernah menerima alamat yang ada
kotak loginnya, dan link yang diteruskan ke mana-mana tidak sekaligus
menyebarkan pintu masuknya.

`ALLOWED_ORIGIN` di `workers/gateway/worker.js` menunjuk ke situs PESERTA,
karena form pendaftaran disajikan dari sana.

Nama project situs memuat nomor edisi (`hrcd37`) dan berganti tiap tahun.
Gateway dan project Supabase sengaja TIDAK memuat nomor edisi supaya bisa
dipakai lintas tahun. Kalau `name` di `live/wrangler.toml` diubah,
`ALLOWED_ORIGIN` di `workers/gateway/worker.js` wajib ikut diubah — form
pendaftaran disajikan dari situs peserta, jadi itulah origin yang dipagari.
Mengganti `name` di `web/wrangler.toml` tidak menyentuh gateway sama sekali.

---

## 2. Database

106 migrasi, `0001` sampai `0106`, dijalankan berurutan tanpa lubang penomoran.
`supabase/migrations/` adalah satu-satunya sumber kebenaran skema — tidak ada
perubahan yang dilakukan lewat dashboard.

**Migrasi tidak pernah diedit setelah diterapkan.** Perubahan atas fungsi
yang sudah ada ditulis sebagai migrasi baru berisi `create or replace function`
lengkap. Itu sebabnya definisi terbaru sebuah RPC sering berada di berkas
bernomor besar, bukan di `0004_rpcs.sql`.

### Tabel

Operasional: `pendaftaran`, `regu`, `sekolah`, `pembayaran`, `kloter`,
`keberangkatan_regu`, `nilai_mentah`, `closing_regu`, `penempatan_barak`,
`nomor_dada_stok`, `nomor_dada_pensiun`, `nilai_terkunci`, `foto_lembar`.

Konfigurasi per edisi: `edisi`, `pos`, `wahana`, `kontrak_opsi`,
`konfig_penalti`, `room`, `status_acara`.

Akun, hak & jejak: `akun_panitia`, `fitur`, `akun_hak`, `history`.

> Tabel jejak audit bernama **`history`** dengan kolom `table_name`, `row_id`,
> `action`, `old_value`, `new_value`, `changed_by`, `changed_at`. Dokumen lama
> menyebutnya `riwayat` — itu nama sebelum migrasi `0012`. Migrasi `0014`
> melakukan hal yang sama pada `ruangan`, yang sejak itu bernama `room`.

### Cara skor dihitung

Skor **tidak pernah disimpan**. Seluruhnya diturunkan saat dibaca lewat rantai
view: `v_poin_pos`, `v_poin_wahana`, `v_penalti_waktu` → `v_total_skor` →
`v_klasemen`. Mengubah aturan penilaian berarti mengubah baris konfigurasi,
bukan menghitung ulang data.

Konsekuensinya: memperbaiki satu nilai yang salah ketik langsung memperbaiki
klasemen, tanpa proses hitung ulang apa pun.

Apa yang dinilai di tiap pos juga konfigurasi: satu baris `wahana` per kolom
penilaian, dengan **enam bentuk konversi** — `kecil_baik`, `besar_baik`,
`biner`, `benar_per_total`, `benar_kurang_salah`, dan `bertingkat` (tangga
poin per pita, dipakai kolom waktu yang menilai "masuk pita 1 menit", bukan
tiap detik). Layar Input Pos membangun kolomnya dari baris-baris itu, jadi
mengubah penilaian tahun depan tidak menyentuh kode sama sekali.

**Bobot pos tidak pernah ditulis sebagai jumlah lomba.** Yang menentukan
bobotnya adalah jumlah `poin_maks` seluruh baris `wahana` di pos itu.
`wahana.lomba` hanya mengelompokkan beberapa penilaian ke satu kertas dan satu
kolom foto; memecah KIM menjadi Kim Lihat dan Kim Cium di `0087`, misalnya,
tidak mengubah satu poin pun.

Lima lomba soal yang ditambahkan di `0076` juga menunjukkan kenapa hitungan
baris lebih penting daripada asumsi "semua lomba 100": Keagamaan,
Kepramukaan, Kesehatan, dan Pengetahuan Umum masing-masing maksimum 50,
sedangkan Logika maksimum 100. Bobot setengah itu disengaja. `pos.bobot`
tetap 1,00 untuk semua dan hanya dipakai kalau suatu tahun panitia ingin
menyetarakan pos secara paksa.

Konsekuensi yang mudah terlewat saat menyusun pos tahun depan: **memindah
satu lomba dari satu pos ke pos lain mengubah bobot keduanya**, tanpa satu
angka pun diubah.

**Pos bayangan ikut dinilai** (migrasi `0021`). Ia pos biasa dengan penanda
`pos.bayangan`, bernomor melanjutkan pos utama — bukan cabang tersendiri di
mesin skor. Format XXXVII tidak memakainya.

**Tidak semua baris `pos` dinilai** (migrasi `0025`). Pos 0 (Keberangkatan) dan
Pos **6** (Kedatangan) adalah garis start dan garis finish; yang dicatat di
sana waktu, bukan nilai. Pos 1–5 adalah pos yang dinilai. Yang menentukan
sebuah pos dinilai atau tidak adalah
**punya tidaknya baris `wahana`** — bukan kolom penanda tersendiri, supaya
tidak ada dua sumber kebenaran untuk satu fakta. `v_pos` mengekspos
`jumlah_komponen` untuk layar yang perlu membedakan keduanya.

Konsekuensi yang sempat luput: `v_total_skor` menghitung pos terlewat sebagai
`(jumlah seluruh pos − pos yang punya nilai)`. Begitu Pos 0 dan Pos 6 masuk
tabel, setiap regu selamanya terhitung melewatkan dua pos yang memang tidak
bisa dinilai siapa pun. Dampaknya nol selama `nilai_pos_terlewat` masih 0 —
dan justru itu yang berbahaya, karena cacatnya menunggu sampai angka itu
diubah. `v_total_skor`, `v_monitoring_input`, dan `v_progres_publik` kini
hanya menghitung pos yang punya komponen.

### Kunci daftar ulang

Pemberian nomor dada dan penyebaran kloter diserialisasi dengan satu
**advisory lock** di awal transaksi (`pg_advisory_xact_lock`), bukan
`FOR UPDATE SKIP LOCKED`. Pola lama itu dibuang di migrasi `0007` karena bocor:
ia mengunci `nomor_dada_stok` sambil memutuskan kloter, sehingga dua meja bisa
sampai pada kloter yang sama.

Nomor dada **diketik petugas**, tidak diterbitkan sistem (migrasi `0011`) —
kainnya benda fisik di meja, dan yang ada di tangan petugas belum tentu nomor
terkecil yang tersedia.

---

## 3. Layar panitia

SPA satu berkas dengan rute hash, di `web/js/app.js`. Butuh login.

| Rute | Layar | Kerjanya |
| --- | --- | --- |
| `#/home` | Home | menu + **empat** lencana: dua antrean (menunggu pembayaran, lunas belum bernomor) dan dua kemajuan berantai (Keberangkatan `berangkat/siap`, Kedatangan `datang/berangkat`) |
| `#/foto` | Foto Jawaban | foto borongan per lomba di pos, lalu tautkan nomor dada |
| `#/pembayaran` | Meja Pembayaran | tabel semua invoice, tandai lunas, cetak kwitansi |
| `#/daftar-ulang` | Meja Daftar Ulang | isi nomor dada per regu, tukar nomor rusak |
| `#/cetak-kloter` | Daftar Kloter | lembar per kloter untuk petugas start |
| `#/keberangkatan` | Keberangkatan | ceklis hadir, kontrak waktu, pindah kloter, berangkatkan |
| `#/finish` | Kedatangan | catat jam datang + anggota hadir |
| `#/pos` | Input Nilai Pos | lembar penilaian satu pos, satu baris per regu |
| `#/rekap` | Rekapitulasi | seluruh pos sekaligus + klasemen sementara — **hanya dibaca** |
| `#/live-score` | Live Score | pemegang hak `live_score` — cincin kemajuan per pos + podium; saklar fase hanya untuk pemegang `pengaturan` |
| `#/pengaturan-kloter` | Pengaturan Kloter | simulasi dan perbaikan jadwal keberangkatan; pemegang `pengaturan` |
| `#/ganti-password` | Ganti Password | — |
| `#/account` | Akun | buat/nonaktifkan akun dan atur matriks hak; pemegang `akun` |

Lima peran akun: `admin`, `registrasi`, `gerbang`, `juri_pos`, dan
`koordinator_pos`. Peran hanya memilih centang awal lewat `paket_peran()`;
sumber hak yang sebenarnya adalah baris `akun_hak`, dibaca database lewat
`boleh(fitur)` dan dibaca SPA lewat `bolehLihat(fitur)`. Karena itu dua akun
dengan peran sama boleh memiliki menu berbeda setelah centangnya disesuaikan.

`juri_pos` wajib membawa satu nomor `pos`; pagar tulis membatasinya ke pos itu.
`koordinator_pos` mendapat paket hak yang sama tetapi kolom `pos` wajib kosong,
sehingga `pos_saya()` bernilai NULL dan ia bisa menangani seluruh pos. Membaca
data operasional dasar tetap dibuka untuk semua panitia aktif; tindakan yang
mengubah data selalu menuntut hak fiturnya. Nama lama `meja` dan
`operator_pos` tidak lagi sah sejak migrasi `0058`.

### Layar Input Pos

Bentuknya sengaja meniru lembar Google Sheets yang dipakai panitia selama ini:
Nomor Dada · Nama Regu · Organisasi · Golongan, lalu satu kolom per hal yang
dinilai, lalu Nilai Pos. Petugas yang menyalin dari foto lembar tidak perlu
belajar bentuk baru.

| Yang menentukan | Dari mana |
| --- | --- |
| Nama & urutan kolom | `wahana.name`, `wahana.sort_order` |
| Bentuk kotaknya | `wahana.form` — centang untuk `biner`, dua kotak untuk `benar_kurang_salah` |
| Kotak Menit : Detik | `wahana.satuan = 'detik'` — tersimpan sebagai satu angka detik |
| Rentang yang boleh diketik | `wahana.rentang_mentah_min/maks` |
| Angka Nilai Pos | `v_lembar_pos`, dibaca ulang tiap kali satu baris tersimpan |

Tiga hal yang menentukan layar ini benar atau tidak:

1. **Tidak ada tombol Simpan.** Baris tersimpan sendiri saat petugas
   meninggalkannya, dan diberi ✓ hijau. Tombol yang bisa lupa ditekan adalah
   nilai yang hilang.
2. **Simpanan yang menumpuk diantre, bukan ditolak.** Satu baris punya banyak
   kotak dan tiap kotak memicu simpanannya sendiri; menolak yang datang saat
   sibuk sempat membuat baris diberi ✓ padahal empat nilai terakhir tidak
   pernah terkirim.
3. **Layar tidak pernah menghitung skor.** Nilai Pos selalu angka dari
   database. Menghitungnya di browser akan melahirkan mesin skor kedua yang
   suatu hari berbeda pendapat dengan `v_poin_pos`.

#### Lembar cetak untuk ditulis tangan

Tombol **Form per Lomba** mencetak master blangko kosong, bukan daftar regu.
Satu lomba menghasilkan satu halaman berisi seluruh penilaiannya: Pembidaian
menjadi satu lembar dengan lima kotak, bukan lima lembar. Lomba soal tidak
mendapat blangko tambahan karena jumlah benar sudah ditulis di lembar jawaban
peserta sendiri.

Setiap master berukuran **A5 landscape (210 × 148 mm), satu halaman per
lomba**. Panitia mencetak satu master lalu memperbanyaknya 2-up di kertas A4
dengan mesin fotokopi; mencetak ratusan salinan dari browser hanya menghabiskan
toner untuk pekerjaan yang lebih cepat dilakukan mesin fotokopi. Karena itu
Pos 3 yang punya tiga lomba menghasilkan tiga halaman, berapa pun jumlah regu.

Nomor dada dan nilai mentah mendapat ruang tulis terbesar. Kertas tidak
memuat Nilai Pos karena juri hanya menulis data mentah; skor tetap dihitung
database. Seluruh aturan print memakai hitam di atas putih, tanpa fill, grey,
tint, atau tulisan terbalik; garis minimal 0,75pt dan huruf minimal 7pt agar
master tetap terbaca setelah menjadi copy dari copy.

#### Pita keadaan simpan

Di pos, internet putus adalah kejadian biasa — dan angka yang hanya ada di
layar sama saja dengan angka yang tidak pernah dicatat. Sebaris pita di atas
tabel menjawabnya tanpa perlu ditekan, bentuknya meniru Google Sheets karena
panitia sudah terbiasa dengannya:

| Keadaan | Yang tertulis |
| --- | --- |
| aman | `✓ Data Tersimpan · Sinkronisasi Terakhir: 14:32 (barusan)` |
| sedang diketik | `2 baris belum tersimpan. Sinkronisasi Terakhir: 14:32 (barusan)` |
| gagal | merah — `1 baris gagal terkirim dan 1 baris masih diketik — dicoba lagi sendiri tiap 15 detik. Jangan tutup halaman ini. Sinkronisasi Terakhir: 14:12 (23 menit lalu).` |
| internet putus | merah — angkanya aman di layar, dikirim sendiri saat internet kembali |

Capnya `jamMenit` — jam dan menit saja, tanpa detik — ditambah umurnya dalam
kurung, mengikuti standar waktu di bagian 3b.

Empat hal yang membuatnya bisa dipercaya:

- **Capnya dipasang setelah baris dibaca ULANG dari database**, bukan saat
  permintaan dikirim. Yang dijanjikan cap itu "sudah ada di sana".
- **Pitanya tidak pernah disembunyikan.** Pita yang hanya muncul saat ada
  masalah tidak bisa dipercaya — tidak ada cara membedakan "aman" dari
  "pitanya sedang rusak".
- **Baris ditandai sejak ketukan pertama**, bukan menunggu kotaknya
  ditinggalkan. Di antara keduanya bisa lewat semenit.
- **Yang gagal dikirim ulang sendiri** tiap 15 detik dan seketika saat event
  `online` menyala. Menunggu petugas menekan "Ulangi" satu per satu hanya
  memindahkan pekerjaan ke orang yang paling sibuk di ruangan itu.

Karena nilai yang belum terkirim hanya hidup di layar, dua hal yang dulu
membuangnya kini dijaga: `beforeunload` menahan tab yang ditutup, dan muat
ulang otomatis saat layar dilihat kembali dilewati selama masih ada baris yang
belum tersimpan.

`v_lembar_pos` dan beberapa view agregat sengaja bukan `security_invoker`.
Alasannya ada di kepala migrasi `0023`: jalan menuju nama sekolah melewati
tabel `pendaftaran`, yang memuat nomor WhatsApp dan tidak patut dibuka hanya
agar juri dapat melihat nama regu. Kalau view tunduk pada seluruh RLS tabel
dasar, juri mendapat lembar kosong — keadaan yang terlihat seperti "belum ada
peserta", bukan galat hak akses.

Karena view definer melewati RLS tabel dasarnya, pagar wajib berada di badan
view. `v_lembar_pos` menuntut `boleh('pos')` dan membatasi penulisan lewat
`pos_saya()`; `v_kelengkapan_pos` hanya mengeluarkan agregat dan menuntut akun
panitia aktif. Rantai Live Score memakai fungsi definer
`klasemen_live_score()` sebagai alas agar pemegang `live_score` memperoleh
agregat/rincian lomba tanpa sekaligus memperoleh nomor WhatsApp pembina.

---

### Layar Rekapitulasi

Lembar Rekapitulasi lengkap, dan bentuknya sengaja meniru spreadsheet yang
dipakai panitia selama tujuh tahun: satu baris per regu, **satu kolom per
komponen** — bukan satu kolom per pos — Nilai Pos di ujung tiap kelompok, lalu
kolom waktu, lalu Nilai Total. Kolomnya dibangun dari tabel `wahana`, jadi
penilaian tahun depan mengubah tabel dan tabelnya ikut berubah sendiri.

Bahannya satu view, `v_rekap_penuh` (migrasi `0027`). Empat hal yang
menentukannya:

1. **Tidak bisa mengubah apa pun.** Satu-satunya pintu tulis nilai tetap
   `#/pos`, yang memaksa operator menyebut posnya dan dijaga RLS. Angka yang
   bisa diketik dari dua tempat cepat atau lambat akan melewatkan salah satu
   pagarnya.
2. **Tidak menghitung apa pun.** Nilai Pos, penalti, total, dan peringkat
   semuanya datang jadi dari database — alasan yang sama dengan layar Input
   Pos. Peringkatnya bahkan di-`left join` dari `v_klasemen`, bukan dihitung
   ulang, supaya tidak ada mesin peringkat kedua.
3. **Yang membuka layar ditentukan hak `rekap`, bukan nama peran.** Paket
   `juri_pos` tidak membawa hak itu, tetapi admin boleh mencentangkannya tanpa
   mengganti peran. Sejak `0069`, policy baca nilai menerima pemegang `rekap`
   atau `live_score` lintas pos; isolasi pos tetap berlaku pada jalur tulis.
4. **Menyegarkan diri tiap 20 detik, tanpa menggeser apa pun.** Operator pos
   menyimpan satu baris, dan koordinator yang menatap layar ini melihat
   angkanya masuk tanpa menekan apa pun. Pembacanya belasan orang, bukan
   ribuan seperti halaman peserta, jadi membaca langsung dari database di
   sini memang murah — pertimbangan yang persis kebalikan dari bagian 3b.

**Kerangkanya dibangun SEKALI; yang diperbarui hanya `<tbody>`, kartu
kelengkapan, dan beberapa angka kecil.** Ini bukan optimasi, melainkan syarat
supaya layar ini bisa dipakai sama sekali. Tabelnya ±38 kolom dan dibaca
sambil digeser ke samping; menggambar ulang seluruh kartu — yang dulu terjadi
tiap 20 detik — berarti:

- geseran samping kembali ke kolom pertama, tiap 20 detik. Orang yang sedang
  membandingkan Pos 4 dilempar balik ke Nomor Dada;
- kotak cari diganti kotak baru di tengah orang mengetik, jadi mengetik `001`
  terputus di huruf kedua;
- posisi gulir, fokus papan ketik, dan teks yang sedang disorot ikut hilang.

Pembungkus `.table-wrapper` yang memegang geseran, kotak cari, dan kepala
tabel karena itu **tidak pernah diganti**. Listener saringan dan kartu pos
dipasang lewat delegasi pada pembungkus yang tetap itu, bukan pada tombol
yang ikut tergambar ulang. Hasilnya layar yang boleh dibiarkan terbuka
seharian dan tetap diam di tempat yang ditinggalkan — seperti spreadsheet,
yang memang bentuk yang dikenal panitia.

Aturan yang sama berlaku untuk **kembali dari tab lain**. Bagian 7 nomor 10
menjelaskan bahwa seluruh SPA memuat ulang dirinya saat layarnya dilihat
kembali; layar ini dikecualikan lewat `segarkanDiTempat`, sebuah kait yang
boleh diisi layar mana pun yang sanggup memperbarui angkanya sendiri.
Berpindah tab adalah gerakan yang paling sering dilakukan orang yang sedang
memantau, dan menggambar ulang di situ membuang persis keadaan yang sedang
dipakai memantau.

Kait itu **melewati ketiga pengaman** yang mendahuluinya (jeda 5 detik, kotak
isian yang sedang difokus, dialog yang terbuka). Pengaman-pengaman itu ada
untuk melindungi dari gambar ulang; pembaruan di tempat tidak menghapus
ketikan siapa pun, jadi menerapkannya di sini cuma menghasilkan satu akibat —
refresh yang dibatalkan. Kursor tertinggal di kotak cari saat berpindah tab
sudah cukup untuk membuat papan pantau kembali dengan angka lama, diam-diam.

Di latar, layar ini **berhenti total**. Denyut 20 detiknya dimatikan begitu
tab-nya disembunyikan, bukan sekadar dilewati: jawabannya tidak dibaca siapa
pun, dan papan ini memang dibiarkan terbuka berjam-jam di sebelah tab lain.
Yang menyalakannya kembali adalah kepulangan itu sendiri — `segarkanDiTempat`
mengambil angka terbaru sekaligus menghidupkan ulang denyutnya.

Rank kosong berarti kloter regu itu belum tercatat berangkat, jadi ia belum
masuk klasemen resmi (`rancangan-b.md` 11.12). Barisnya tidak dibuang; ia
turun ke bawah kelompoknya dan tetap terurut menurut total, supaya papan ini
sudah terbaca sebagai klasemen sementara sejak nilai pertama masuk.

**Selalu satu golongan, tidak pernah gabungan** — dan karena itu tidak ada
pilihan "Semua". Keempat golongan dinilai terpisah (`alur-lomba.md` 2.3),
jadi satu daftar berisi keempatnya menampilkan peringkat 1 empat kali dan
menyandingkan angka yang tidak pernah diperlombakan satu sama lain.

#### Panel kelengkapan tiap pos

Di atas tabel, satu kartu per pos menjawab "datanya sudah masuk semua belum?"
Bahannya `v_kelengkapan_pos` (migrasi `0028`), satu baris per pos.

Angkanya tiga, bukan satu, karena "90% terisi" sendirian tidak bisa dibedakan
antara tiga keadaan yang sangat berbeda:

| Angka | Artinya | Perlu dikejar? |
| --- | --- | --- |
| `kosong` | regunya belum sampai di pos itu | tidak — ini keadaan normal sepanjang lomba |
| `sebagian` | barisnya terisi separuh | ya — hampir selalu transkripsi dari foto yang terpotong |
| **`hilang`** | regu **sudah closing** tapi nilainya belum lengkap | **ya** — ia pasti melewati pos itu, jadi tidak ada penjelasan yang tidak buruk |

`hilang` satu-satunya yang berwarna merah. Ia disandarkan pada **closing**,
bukan pada tebakan tentang sudah sampai mana regunya — itulah yang membuatnya
bisa dipercaya.

Penyebutnya adalah regu lunas, tidak batal, sudah punya nomor dada, dan memang
memiliki komponen yang berlaku di pos itu. `komponen_berlaku()` menjadi satu
aturan bersama untuk penilaian dan kelengkapan sejak `0096`: regu Intern
dihitung di lima Soal Tulis yang mereka ikuti, tetapi tidak menjadi regu
"kosong" abadi di lomba lapangan yang memang tidak mereka ikuti.

Kartu juga membawa `terakhir_masuk` — jam nilai terakhir yang menyentuh pos
itu. **Inilah pendeteksi "tidak sync" yang sebenarnya:** kalau empat pos
menyetor terus dan satu diam 30 menit, yang rusak hampir pasti sambungan atau
laptop di pos itu, dan itu ketahuan berjam-jam sebelum angka kelengkapan
bergerak — angka itu baru berubah setelah regunya selesai.

Mengetuk satu kartu menyaring tabel di bawahnya ke regu yang belum lengkap di
pos itu, jadi "siapa yang kurang" tidak perlu dicari sendiri. Angka di kartu
menghitung seluruh golongan sementara tabelnya satu golongan, dan layar
menyebutkan itu apa adanya saat saringannya menyala.

Semua panitia aktif boleh membaca panel agregat seluruh pos. Itu keputusan
yang sama dengan pembukaan rincian Live Score di `0069`: isolasi pos menjaga
**menulis**, bukan membaca kemajuan lomba lain. `v_kelengkapan_pos` bukan
`security_invoker` karena menghitung regu ikut memerlukan
`pendaftaran.status = 'lunas'`, sementara tabel itu juga memuat nomor WhatsApp.
View hanya mengeluarkan hitungan dan waktu nilai terakhir, dengan pagar
`peran() is not null` di badannya; migrasi `0101` dan tes 62 menjaga agar akun
nonaktif tidak dapat memakainya.

**Tabelnya adalah lembar Input Pos, hanya saja seluruh pos disambung jadi
satu.** Kelasnya sama persis — `.table-pos` beserta `.kolom-nama`,
`.kolom-petunjuk`, dan `.pos-nilai` — dan petunjuk rentang di bawah tiap nama
kolom datang dari `petunjukKolom()` yang sama, bukan salinannya: kalau rentang
di satu layar berbeda dengan layar lain, panitia akan percaya yang salah.

Lima hal yang ditambahkan, dan hanya lima:

| Yang ditambah | Kenapa tidak ada di lembar satu pos |
| --- | --- |
| `width: max-content` | `.table` dan `.table-pos` sama-sama `width: 100%`, yang benar untuk ±11 kolom dan bencana untuk ±38: tabelnya tidak pernah melebihi layar, jadi ia tidak menggeser melainkan **mengempis** — judul pecah jadi tumpukan huruf dan angkanya berdesakan |
| Kolom terakhir tidak lagi menyerap sisa lebar | Di Input Pos yang terakhir adalah kolom status simpan, jadi lahan kosongnya jatuh di tempat yang tidak dikerjakan siapa pun. Di sini yang terakhir Nilai Total — dibiarkan menyerap, ia melayang sendirian jauh dari Penalti yang seharusnya dibaca bersamanya |
| **Dua** kolom dipatok di tepi kiri, bukan satu | Rank berdiri di depan Nomor Dada; barisnya baru bisa dikenali kalau keduanya ikut menempel saat digeser |
| Garis pemisah di tiap Nilai Pos | Dengan lima kelompok kolom bersambung, salah membaca kolom Pos 3 sebagai Pos 2 adalah satu-satunya cara layar ini bisa menyesatkan |
| Baris lebih rapat | Tidak ada kotak isian sama sekali, jadi tingginya tidak perlu memuat sasaran sentuh setinggi jempol |

Kolom biner memakai **ikon centang**, bukan huruf. Sebaris `v v v v` harus
dieja satu per satu; centang tertangkap sekali sapu — bentuk yang sama dengan
kotak centang di Input Pos dan centang per pos di halaman peserta.

Seperti lembar Input Pos, tabel ini **digeser ke samping, bukan ditumpuk jadi
kartu** — di layar meja geser samping justru dilarang karena menyembunyikan
kolom tombol (bagian 7 nomor 3). Di sini tidak ada tombol sama sekali, dan
±35 kolom tidak akan pernah muat di layar mana pun.

## 3b. Halaman rekap live untuk peserta

Satu pertanyaan yang dijawab halaman ini sepanjang lomba, dan hanya itu:
**"nilai regu saya sudah masuk belum, atau hilang?"** Jawabannya centang per
pos — bukan angka.

Tiga aturan membentuk seluruh halaman ini:

1. **Sebelum lomba dimulai, tidak ada rekap sama sekali.** Selama
   `fase_live` masih `pra`, `v_progres_publik` mengembalikan nol baris dan
   yang tampil hanya jumlah pendaftar plus jalan ke formulir. Peserta tidak
   melihat apa pun tentang regu mana pun, termasuk regunya sendiri.
2. **Selama lomba, peserta mengetik nama sekolahnya dulu.** Tidak ada daftar
   300 regu yang bisa disapu mata. Yang tampil sesudah pencarian adalah
   seluruh regu sekolah itu, urut nomor dada, dengan centang per pos.
   Batasnya sengaja nama sekolah dan hanya nama sekolah: itu satu-satunya
   kata kunci yang pasti diketahui setiap pembuka halaman, dan membatasi
   pencarian ke sana membuat halaman menjawab "bagaimana regu KAMI" alih-alih
   berubah jadi alat mengintip nilai regu lain satu per satu.
3. **Setelah closing, halaman yang sama berubah jadi papan hasil.** Fase
   `penuh` membuka klasemen empat golongan — tampil tanpa perlu mencari apa
   pun, karena itulah pengumumannya — dan menambahkan kloter, kontrak, jam
   berangkat, dan jam datang ke tabel sekolah.

### Yang menjaga kejutan adalah database, bukan tampilan

Selama `status_acara.fase_live` masih `progres`, `v_klasemen_publik`
mengembalikan **nol baris** dan `v_progres_publik` tidak punya satu pun kolom
berisi angka nilai. Jadi `live.json` yang terbit memang **tidak memuat**
nilai — bukan memuatnya lalu disembunyikan CSS, yang bisa dibuka siapa pun
dengan membuka alamat berkasnya langsung. Admin memindah fase ke `penuh` saat
hasil diumumkan, dan jalan berikutnya klasemen empat golongan beserta juaranya
ikut terbit.

`tests/sql/09_rekap_publik.sql` menjaga janji itu dari dua arah: klasemen
harus nol baris di fase progres, dan `v_progres_publik` diperiksa **lewat
katalog** supaya kolom baru yang berbau nilai tertangkap — yang menambahkannya
tahun depan belum tentu ingat janji ini.

### Kenapa Worker sendiri

Memisahkan URL **tidak** mencegah orang mencoba masuk — alamat panitia tetap
ada. Yang benar-benar didapat tiga hal:

1. Halaman rekap tidak memuat **kunci apa pun**: `live/index.html` hanya
   memanggil `live.css` dan `live.js`, dan `live.js` cuma membaca `live.json`
   dan `rekap.json` untuk data rekap. Anon key ikut tersalin ke
   `live/config.js`: form pendaftaran memakainya, dan halaman rekap hanya
   memakainya untuk membaca saklar fase kecil langsung dari database.
2. Link yang disebar ke ratusan peserta tidak sekaligus menyebarkan alamat
   login panitia.
3. Ratusan HP yang me-refresh tidak menyentuh Worker yang sedang dipakai
   panitia bekerja.

### Cara datanya sampai, dan kenapa dua berkas

`publish-live.yml` menjalankan `supabase/checks/live_json.sql` — satu query
yang menghasilkan seluruh isi — lalu memecah hasilnya jadi **dua berkas**
sebelum men-deploy folder `live/`. Seluruh data peserta dan nilai hanya dibaca
dari berkas statis itu. Satu-satunya permintaan langsung dari HP peserta ke
Supabase adalah `v_fase_live` tiap 15 detik, supaya admin dapat memperketat
`penuh` menjadi `progres` atau `pra` tanpa menunggu penerbitan baru; hasilnya
tidak pernah boleh membuka lebih banyak daripada isi berkas yang sudah terbit.

| Sumber | Besar | Isinya | Kapan diambil |
| --- | --- | --- | --- |
| `live.json` | ±1 KB | fase, edisi, daftar pos, ringkasan, dan `versi` | di-poll tiap 60 detik |
| `rekap.json` | puluhan KB | seluruh baris regu + klasemen | sekali per `versi`, dan hanya kalau dibutuhkan |
| `v_fase_live` | satu nilai | fase database yang hanya boleh memperketat | tiap 15 detik saat halaman terlihat |

Pemisahan ini yang menahan bebannya. Pesertanya **1.500–3.000 orang** dan
mereka membuka alamat yang sama, berkali-kali, dalam jendela waktu yang sama.
Satu berkas gemuk yang diunduh ulang tiap menit oleh tiap HP adalah 3.000 ×
60 KB per menit untuk data yang sebagian besar waktu tidak berubah sama
sekali.

Empat hal bekerja bersama:

- **`versi` adalah sidik jari isi, bukan jam terbit.** Menjalankan workflow
  sepuluh kali tanpa ada nilai baru menghasilkan versi yang sama sepuluh kali,
  dan tidak satu HP pun mengunduh ulang.
- **`rekap.json` diminta sebagai `rekap.json?v=<versi>`.** Alamatnya berubah
  hanya ketika isinya berubah, jadi ia boleh dijawab `max-age=3600, immutable`
  di `live/_headers` — dari cache browser atau cache tepi Cloudflare, tanpa
  satu byte pun menyeberang.
- **Pengambilannya ditunda sampai benar-benar dicari.** Di fase `pra` berkas
  itu tidak pernah diambil; selama lomba ia baru diambil setelah peserta
  mengetik nama sekolahnya. HP yang membuka halaman lalu menutupnya mengunduh
  ±1 KB.
- **Polling berhenti saat tab tidak terlihat**, dan menyusul sekali begitu
  layarnya dibuka lagi. Ribuan HP yang tertinggal terbuka di saku tidak
  menghasilkan apa-apa selain permintaan.

Yang perlu diketahui sebelum menebak ada masalah kapasitas: data besar tetap
datang dari static assets Cloudflare. Supabase hanya menerima pembacaan satu
nilai fase, bukan ratusan baris rekap atau klasemen, sehingga mematikan papan
seketika tidak memindahkan beban data hari-H kembali ke database.

Cap **"Update terakhir"** di kepala halaman memakai jam saat berkasnya
DIBUAT di server, bukan jam halaman dimuat — kalau workflow tersendat, peserta
harus bisa melihat bahwa angkanya tua. Lewat 15 menit, capnya berubah warna
tanpa menambah kalimat yang harus dibaca berulang kali; umur dalam kurung sudah
menunjukkan bahwa datanya tertinggal.

Sebelum di-deploy, workflow memeriksa berkasnya sendiri: JSON harus terurai,
kunci wajib harus ada, dan **klasemen harus kosong selama fase belum `penuh`**.
JSON yang rusak akan membuat halaman rekap kosong tanpa pesan apa pun, dan
tidak ada yang menyadarinya sampai ada peserta yang bertanya.

### Bentuk waktu

Tiga bentuk, dan hanya tiga. Definisinya di `web/js/util.js`; halaman rekap
menyalinnya karena ia Worker terpisah dan tidak boleh bergantung pada berkas
di proyek lain.

| Fungsi | Hasil | Dipakai untuk |
| --- | --- | --- |
| `jamMenit(t)` | `15:30` | jam yang HARINYA sudah jelas — berangkat, datang, target |
| `tanggalPanjang(t)` | `17 Agustus 2026` | tanggal di kwitansi dan kepala lembar cetak |
| `tanggalJam(t)` | `17 Agustus 2026 15:30` | cap yang bisa menunjuk hari lain |

Aturan memilihnya satu kalimat: **pakai `jamMenit` kalau harinya sudah jelas
dari kedudukannya, `tanggalJam` kalau tidak.** Cap "Update terakhir" di
halaman rekap peserta memakai bentuk penuh justru karena peserta membukanya
kapan saja, termasuk besok paginya — `17:30` telanjang akan terbaca sebagai
setengah jam lalu.

Satu fungsi lagi menjaga arah sebaliknya — jam yang **diketik**, bukan
ditampilkan: `jamSah(teks)` membaca `"745"`, `"0745"`, `"7:45"`, atau `"7.45"`
dan mengembalikan `"07:45"`, atau `null` kalau di luar 00:00–23:59.

Ia ada karena `<input type="time">` **tidak bisa dipaksa 24 jam.** Browser
merendernya menurut locale BROWSER, bukan `lang="id"` halaman ini, jadi laptop
panitia yang Chrome-nya berbahasa Inggris menampilkan `07:15 AM` — dan tidak
ada atribut HTML mana pun yang mengubahnya. Satu meja memakai AM/PM sementara
semua kertas dan semua layar lain memakai 00:00–23:59 adalah cara yang murah
sekali untuk mencatat 07:15 sebagai 19:15. Karena itu jam berangkat dan jam
datang memakai kotak ketik biasa berkelas `.jam-ketik`, bukan pemilih bawaan.
Yang diterima sengaja longgar (pencatat menyalin dari kertas dan mengetik
cepat); yang di luar rentang **ditolak dengan pesan**, bukan ditebak — jam
berangkat menentukan penalti sepuluh regu sekaligus.

Dua hal yang dulu berbeda-beda dan sekarang tidak lagi: jam memakai **titik
dua, bukan titik** (`toLocaleTimeString('id-ID')` memberi `07.04`, yang mudah
terbaca sebagai desimal), dan nama bulan **ditulis sendiri** alih-alih lewat
`toLocaleDateString` — berkas locale tidak selalu lengkap di WebView Android,
dan kalau `id-ID` tidak ada, browser diam-diam mundur ke Inggris dan kwitansi
tercetak "14 August 2026" tanpa ada yang gagal.

Yang ikut hilang: akhiran bagian hari (`07:04 Pagi`) dan bentuk 12 jam di
kertas (`07:04 AM`). Keduanya dulu ada untuk membedakan pagi dari sore, dan
jam 24 sudah melakukannya sendiri — `04:00` tidak pernah bisa dikira `16:00`.

### Bentuk tabel meja menurut lebar layar

Meja Pembayaran dan Meja Daftar Ulang melewati tiga rentang. Angkanya
ditentukan isi tabel, bukan ukuran jempol:

| Lebar | Bentuk |
| --- | --- |
| ≤ 900px | tiap baris jadi kartu bertumpuk; tidak ada geser samping |
| 901–940px | tetap tabel dengan layout `auto`; lebar kolom mengikuti isi |
| ≥ 941px | tabel dengan lebar kolom dipatok persen, supaya rincian sejajar kolom induknya |

Ambang 940px berasal dari `min-width` tabelnya (820px) ditambah padding dan
scrollbar. **Kalau kolom ditambah, `min-width` naik — dan ambang ini harus ikut
naik**, kalau tidak tabelnya menggeser ke samping dan kolom paling kanan (kolom
tombol) hilang dari layar tanpa petunjuk apa pun.

Meja Daftar Ulang berkolom tiga: Kode Bayar, Sekolah, tombol "Isi N Nomor Dada".
Jumlah regu tidak punya kolom sendiri — angkanya sudah tercetak di dalam tombol.

---

## 4. Form pendaftaran publik

`live/daftar.html` + `live/js/daftar.js`, tanpa login — keduanya tinggal di
situs peserta, bukan di `web/`. Kiriman tidak langsung ke
Supabase melainkan ke gateway, yang memanggil `submit_pendaftaran` memakai
service role.

Pagar yang benar-benar aktif di gateway:

- **Batas ukuran** 32.000 byte (30 regu ≈ 6 KB).
- **Rate limit** 30 pengiriman per IP per menit, disimpan di KV namespace `RATE`.
- **Turnstile opsional** — dilompati kalau `TURNSTILE_SECRET` tidak diisi.
  Untuk edisi 37 sengaja dinonaktifkan; riwayat pendaftaran lewat Google Form
  sebelumnya tidak pernah disalahgunakan.

Service key hidup sebagai `wrangler secret` di Worker, tidak pernah di SPA.
`web/config.js` hanya memuat anon key, yang memang publik.

---

## 5. Deploy

| Yang di-deploy | Cara | Pemicu |
| --- | --- | --- |
| Layar panitia (`web/`) | Cloudflare Workers, tersambung Git | otomatis tiap push ke `main` |
| Situs peserta (`live/`) | GitHub Actions `publish-live.yml` | **otomatis** tiap push ke `main` yang menyentuh `live/**` atau `live_json.sql` (#235); cron 5 menit masih dikomentari, nyalakan pada minggu lomba supaya rekapnya ikut segar tanpa ada yang push |
| Gateway Worker | GitHub Actions `deploy-gateway.yml` | manual |
| Migrasi database | GitHub Actions `apply-migration.yml` | manual, satu berkas per jalan |

`live/` **sengaja TIDAK tersambung Git.** Yang di-deploy bukan isi repo
melainkan `live.json` yang baru saja ditulis workflow dari database; kalau ia
juga tersambung Git, tiap push ke `main` akan menimpanya dengan berkas contoh
fase `pra` yang ada di repo — rekap peserta mendadak kosong tanpa ada yang
gagal. Konsekuensinya: perubahan pada `daftar.html` pun baru tayang setelah
workflow ini dijalankan.

### Berkas yang disalin, dan kenapa

Form pendaftaran tinggal di situs peserta tapi memakai berkas yang sama
dengan layar panitia: `api.js`, `util.js`, `style.css`, `config.js`.
Cloudflare static assets menyajikan SATU folder apa adanya — tidak ada cara
satu berkas hidup di dua akar tanpa disalin, dan repo ini sengaja tanpa build
step yang bisa menyalinnya saat deploy.

Jadi salinannya dititipkan di git, dan workflow `shared-files.yml` yang
membuatnya tidak bisa membusuk: tiap PR membandingkan `live/` dengan acuannya
di `web/` dan gagal kalau menyimpang. Duplikasi yang diam adalah bug yang
menunggu; duplikasi yang berteriak tiap kali menyimpang cuma sedikit berisik.
**`web/` yang jadi acuan** — jangan pernah mengedit salinannya.

**Merge ke `main` = deploy layar panitia.** Tidak ada build step; berkas di
`web/` disajikan apa adanya — asalkan kotak "Root directory" di dashboard
Cloudflare masih berisi `web` (bagian 7 nomor 8; setelan itu tidak ada di git).
Situs peserta tidak ikut: `live/` hanya terbit lewat workflow-nya sendiri.

**Merge TIDAK menerapkan migrasi.** Migrasi dijalankan terpisah:

```bash
gh workflow run "Apply migration to Supabase" --ref main \
  -f berkas=supabase/migrations/0021_pos_bayangan.sql
```

Berkasnya dijalankan `--single-transaction` dengan `ON_ERROR_STOP=1`: kalau satu
statement gagal, seluruh berkas di-rollback. Tidak ada bentuk "migrasi setengah
jadi". Pastikan log-nya mencetak `MIGRASI BERHASIL`.

Kalau sebuah migrasi mengubah bentuk RPC yang dipanggil layar, terapkan migrasi
**dulu**, lalu segera merge PR kodenya — di antara keduanya ada jeda singkat
saat layar memanggil RPC lama dan gagal.

### Cache

`web/_headers` menyetel `Cache-Control: no-cache` untuk semua aset: browser
boleh menyimpan, tapi wajib bertanya dulu. Asetnya kecil (±220 KB seluruhnya,
`js/app.js` sendiri 119 KB), jadi biayanya hampir nol — dan tanpa itu,
perbaikan mendadak pagi hari-H tidak akan sampai ke panitia.

`live/_headers` **berbeda dengan sengaja**, karena pembacanya ribuan HP dan
bukan belasan laptop: `live.json` diberi `no-store` (ia yang di-poll, jadi
harus selalu segar) sedangkan `rekap.json` diberi `max-age=3600, immutable`.
Yang membuat keduanya bisa berlawanan adalah `?v=<versi>` di alamat
`rekap.json` — alasannya di bagian 3b.

Dan karena itu `live/_headers` **tidak punya aturan `/*`**, tidak seperti
`web/_headers`. Cloudflare MENGGABUNGKAN header dari semua aturan yang cocok,
bukan menimpanya dengan yang paling spesifik: selama `/*` masih menyetel
`no-cache`, `rekap.json` terbit sebagai
`no-cache, public, max-age=3600, immutable` — dan `no-cache` yang menang,
sehingga berkasnya ditanyakan ulang tiap kali walau alamatnya sudah memuat
versinya. Tiap jenis berkas di folder itu karena itu menyebut aturannya
sendiri, termasuk halaman HTML yang disebut dua kali karena Workers
menyajikannya di dua alamat (`/` dan `/index.html`).

### Workflow lain

| Workflow | Nama di Actions | Untuk siapa |
| --- | --- | --- |
| `sql-tests.yml` | SQL Tests | otomatis tiap PR dan push ke `main` |
| `provision-accounts.yml` | Provision akun panitia | panitia, dari HP |
| `change-password.yml` | Ganti password akun panitia | panitia, dari HP |

Nama workflow mengikuti pembacanya: yang dijalankan panitia berbahasa Indonesia,
yang hanya dibaca developer berbahasa Inggris. Nama berkasnya selalu Inggris
(CLAUDE.md aturan 9 dan 12).

---

## 6. Menjalankan secara lokal

Tanpa akun Supabase sama sekali. `tests/dev_server.py` menirukan PostgREST +
GoTrue di atas Postgres lokal, termasuk RLS: tiap request dijalankan dalam
transaksi dengan `SET LOCAL app.uid` dan `SET LOCAL ROLE`, sehingga policy yang
sama dengan produksi ikut menggigit.

```bash
bash tests/dev_database.sh     # siapkan database hrcd_dev
python tests/dev_server.py     # tiruan Supabase di :8787
python tests/static_server.py  # layar panitia di :8788, tanpa cache
```

Ganti `mode` di `web/config.js` jadi `"dev"` untuk menunjuk ke sana.

---

## 7. Yang paling mudah salah

Dikumpulkan dari kesalahan yang benar-benar terjadi, bukan daftar teoretis.

1. **Merge bukan berarti diterapkan.** Perbaikan pesan galat dari database
   pernah terlihat "masih rusak" berjam-jam padahal kodenya sudah di `main` —
   migrasinya belum dijalankan.
2. **`table-layout: fixed` tidak membungkus, ia meluap.** Kolom yang menyempit
   menimpa kolom sebelahnya. Di Meja Pembayaran itu membuat dropdown cara bayar
   tertimbun tombol "Tandai Lunas" sampai Transfer tidak bisa dipilih.
3. **Persentase lebar kolom bocor ke tampilan kartu HP.** Saat sel jadi
   `display: block`, `width: 18%` bukan lagi lebar kolom melainkan 18% lebar
   kartu. Semua patokan persen wajib dikurung di `@media (min-width: 941px)`.
4. **Nomor anak CSS yang basi tidak menimbulkan galat.** Setelah kolom Regu
   dihapus, `td:nth-child(4)` sekadar tidak mengenai apa-apa — dan tombolnya
   meleset 74px dari kotak isian di bawahnya tanpa pesan apa pun.
5. **`grid-area: … / -1` tidak bisa diandalkan** di aturan kartu ini; ia pernah
   menaruh nama sekolah kembali di kolom 1–2 sehingga bertumpuk dengan kode
   pembayaran. Pakai nomor garis eksplisit.
6. **Komentar CSS yang menutup dua kali** (`*/ … */`) menelan deklarasi
   sesudahnya tanpa galat apa pun. Layout tampak jalan lewat kolom implisit.
7. **`AGENTS.md` wajib identik dengan `CLAUDE.md`.** Ia pernah menyimpang 21
   baris dan tiga stringnya rusak oleh find-and-replace atas nama agen.
8. **Dua project Cloudflare bisa menyajikan folder yang sama tanpa satu pun
   galat.** Yang menentukan folder mana yang terbit adalah kotak "Root
   directory" di dashboard — tidak terlihat dari repo, tidak ikut ter-review,
   tidak ada di git. Saat `panitia-hrcd37` dibuat, kotak itu terisi `live`:
   dua alamat menjawab 200 dengan halaman yang sama persis, dan layar panitia
   tidak dilayani siapa pun. Cara memeriksanya dari luar, tanpa login:

   ```bash
   curl -sI https://panitia-hrcd37.ciradyka.workers.dev/js/app.js | head -1  # 200
   curl -sI https://hrcd37.ciradyka.workers.dev/js/app.js | head -1          # 404
   ```

   `js/app.js` hanya ada di `web/`, `live.js` hanya ada di `live/` — keduanya
   penanda yang cukup untuk tahu folder mana yang sedang terbit.
9. **Mengubah "Root directory" tidak menerbitkan ulang apa pun.** Setelan itu
   berlaku untuk build BERIKUTNYA. Selama belum ada push atau "Retry
   deployment", yang tersaji tetap hasil build lama dengan folder lama —
   setelan sudah benar di layar, produksi masih salah.
10. **SPA ini memuat ulang layarnya sendiri saat tab-nya dilihat kembali**,
    dan itu memang disengaja: panitia berpindah ke WhatsApp lalu kembali, dan
    angka basi yang terlihat wajar lebih berbahaya daripada layar yang
    berkedip. Tapi "memuat ulang" berarti **menggambar ulang dari nol**, dan
    di layar yang keadaannya sendiri berharga — geseran samping, saringan,
    isi kotak cari — itu membuang persis apa yang sedang dipakai orangnya.
    Layar Rekapitulasi karena itu mendaftarkan `segarkanDiTempat`, dan yang
    dijalankan saat tab-nya kembali hanya pengambilan angkanya. Layar baru
    yang dipantau lama harus melakukan hal yang sama; yang tidak, tetap aman
    dengan perilaku bawaan.

---

## 8. Yang belum dibereskan

Diketahui basi, sengaja dibiarkan, supaya tidak ada yang mengira sudah dicek:

- **`docs/arsitektur-hrcd.svg` dan `.png`** masih menggambarkan Google Sheets
  sebagai bagian arsitektur, dan angkanya sudah bergeser: tertulis "18 view
  berlapis" (sekarang 21) dan "24 RPC bertransaksi" (sekarang 27 fungsi, 15 di
  antaranya dipanggil layar). Diagramnya tidak dirujuk dari dokumen mana pun,
  jadi dibiarkan sampai ada yang menggambar ulang.
- **Beberapa RPC masih mencetak nomor dada mentah** di pesan galatnya
  (`nomor dada % tidak dikenal` di `catat_closing` dan `pindah_kloter`, antara
  lain), padahal di layar selalu tiga digit. Migrasi `0020` baru membetulkan
  `berangkatkan_kloter`; sisanya menunggu karena tiap perbaikan menuntut
  seluruh badan fungsinya disalin ulang.
- **Cron rekap live masih dimatikan.** `publish-live.yml` punya jadwal 5
  menit yang sengaja dikomentari; nyalakan pada minggu lomba dan matikan lagi
  sesudahnya. Sampai dinyalakan, halaman rekap hanya terbit saat ada push yang
  menyentuh `live/` atau saat tombol Run workflow ditekan — dan pada hari-H
  keduanya tidak terjadi, karena tidak ada yang mengubah kode hari itu.
  Angkanya bergerak dari database, bukan dari repo.
- **Upload massal nilai belum ada.** `rancangan-b.md` bagian 6 menjelaskan
  jalur tempel-dari-Excel lengkap dengan layar preview. Yang sudah dibangun
  baru input tabelnya (`#/pos`) — yang sebenarnya sudah menutup sebagian besar
  kebutuhannya, karena satu layar memuat seluruh lembar sekaligus. RPC-nya
  (`simpan_nilai_massal`) memang sudah menerima banyak baris sekaligus, jadi
  yang kurang hanya pengurai tempelan dan preview-nya.
- **Pos 6 (Kedatangan) memang tidak punya komponen penilaian, dan itu bukan
  kekurangan.** Ia garis finish: yang dicatat di sana jam datang dan jumlah
  anggota, lewat layar `#/finish`. Selama tanpa baris `wahana` ia tidak muncul
  di pemilih pos layar Input Pos, dan itu benar.
- **Dua sel di lembar XXXVI tidak cocok dengan rumusnya sendiri** (Pos 3 regu
  016 tertulis 380, rumus memberi 355; Pos 4 regu 009 tertulis 100, rumus
  memberi 80). 75 dari 77 baris yang bisa dibaca cocok tanpa sisa, jadi
  keduanya kemungkinan ketikan tangan di atas formula. Konfigurasi mengikuti
  rumusnya.
