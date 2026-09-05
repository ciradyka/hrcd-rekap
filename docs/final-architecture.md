# Sistem sebagaimana adanya

**Acuan utama.** Dokumen ini menggambarkan apa yang benar-benar berjalan hari
ini, bukan rencana. Kalau `desain-sistem.md` atau `rancangan-b.md` berbeda dari
dokumen ini, **dokumen ini yang benar** — keduanya catatan keputusan, ditulis
sebelum sistemnya dibangun.

Terakhir diperiksa terhadap kode secara menyeluruh: **27 Agustus 2026**,
sampai migrasi `0136`. Disegarkan 30 Agustus 2026 sampai migrasi `0164`, lalu
2 September 2026 sampai migrasi `0169`, lalu 5 September 2026
sampai migrasi `0170`, lalu 6 September 2026 sampai migrasi `0171`.

Dokumen ini sengaja TIDAK memuat jumlah view, RPC, policy, check, atau pemicu.
Angka-angka itu berubah tiap beberapa migrasi, tidak ada satu tes pun yang
menjaganya, dan pembukuan lamanya sempat berminggu-minggu menyuruh pembaca
membetulkan "angka view dan fungsi di bagian 2" yang tidak pernah ada di
teksnya — yang memuatnya `arsitektur-hrcd.svg`, bukan berkas ini. Yang dijaga
`tests/final_architecture.test.mjs` cuma jumlah migrasi dan tabel rute.

Yang DIPERIKSA pada penyegaran 2 September: jumlah migrasi, tabel rute, baris
`#/pos2`, blangko per lomba, seluruh bagian 3b beserta pagar
`publish-live.yml`, tabel deploy dan daftar workflow, ukuran aset dan
`live/_headers`, blok menjalankan lokal, prosa Rekapitulasi — yang ditulis
ulang jadi cetakan, karena layarnya sudah dihapus 27 Agustus 2026 — serta
daftar di bagian 8. Yang BELUM: "Cara skor dihitung", "Kunci daftar ulang",
dan bagian 4, 6, dan 7 — belum dibaca baris demi baris terhadap
`0119`-`0169`.

Lima migrasi terakhir yang mengubah isi dokumen ini: `0165` menambah
`minta_segarkan_live_score()`, yang jadi tombol Refresh di layar Live Score;
`0166` menjadikan gembok nilai PER LOMBA lewat `v_lomba_pos`,
`lomba_komponen()`, dan bentuk tiga-argumen `nilai_tergembok()`; `0167`
menambah `foto_lembar.putaran` beserta `putar_foto_lembar()` supaya foto slip
yang terlanjur masuk miring bisa diputar tanpa menyentuh berkasnya —
dihormati layar Cek Nilai, Input Nilai Pos, dan Input Nilai Pos v2; `0168`
membetulkan judul dan petunjuk `menaksir` ("Hasil Taksir", "(meter)"),
menyusul `0085` yang membalik arti angka yang diketik tetapi meninggalkan
judulnya; `0169` mengosongkan `judul_isian` kelima lomba soal supaya layar
menurunkan "Jumlah benar" sendiri, sama seperti Semaphore; `0170` memberi
papan sprint Buku Sakti tabel centangnya (`centang_sprint`,
`set_centang_sprint()`, `v_centang_sprint`) — satu-satunya tabel yang boleh
ditulis SETIAP panitia tanpa centang fitur, dan alasannya ada di kepala
berkas migrasinya; `0171` mengembalikan argumen ke-11 `jawaban_benar` ke
panggilan `hitung_poin()` di dalam `v_lembar_pos`, yang dijatuhkan `0166`
saat membangun ulang view itu — ketiga kalinya argumen itu hilang lewat
`create or replace view`, dan sekarang migrasinya sendiri berhenti keras
kalau definisi terpasangnya tidak membawanya.

Bersamaan dengan `0169`, bentuk pengisian "soal" DIBUANG dari Input Nilai Pos
v2 — `jenisLomba()` di `web/js/util.js` tinggal "waktu" dan "nilai", dan
kelima lomba soal tulis kini diisi seperti Semaphore: satu regu satu layar,
satu kotak "Jumlah benar", foto per regu. Foto borongan tetap ada, tapi hanya
di layar Foto Jawaban.

Dua diagram menemani dokumen ini, dan keduanya digambar dari tree yang sama:
cap di kaki `arsitektur-hrcd.svg` berbunyi "sampai migrasi 0169", dan angka di
sebelahnya — 26 tabel · 69 check · 27 pemicu · 169 migrasi · 33 view · 28 RPC ·
48 policy — dihitung dari database, bukan dikira-kira. Cap itu ada supaya
pembaca berikutnya bisa melihat sendiri kalau ia sudah tertinggal. Yang
tergambar:
[`arsitektur-hrcd.svg`](arsitektur-hrcd.svg) — lapisan teknisnya, dan
[`alur-hrcd.svg`](alur-hrcd.svg) — alur acaranya dari pendaftaran sampai
klasemen. Keduanya SVG, jadi teksnya bisa dicari dan angkanya bisa dibetulkan
tanpa alat gambar; pasangan `.png`-nya dihapus 30 Agustus 2026 karena tidak
ada langkah yang membuatnya ikut segar, dan raster yang basi di sebelah SVG
yang benar lebih menyesatkan daripada tidak ada gambar sama sekali.

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

171 migrasi, `0001` sampai `0171`, dijalankan berurutan tanpa lubang penomoran.
`supabase/migrations/` adalah satu-satunya sumber kebenaran skema — tidak ada
perubahan yang dilakukan lewat dashboard.

**Migrasi tidak pernah diedit setelah diterapkan.** Perubahan atas fungsi
yang sudah ada ditulis sebagai migrasi baru berisi `create or replace function`
lengkap. Itu sebabnya definisi terbaru sebuah RPC sering berada di berkas
bernomor besar, bukan di `0004_rpcs.sql`.

### Tabel

Operasional: `pendaftaran`, `regu`, `sekolah`, `pembayaran`, `kloter`,
`keberangkatan_regu`, `nilai_mentah`, `closing_regu`, `penempatan_barak`,
`nomor_dada_stok`, `nomor_dada_pensiun`, `nilai_terkunci`, `foto_lembar`,
`kejuaraan_manual`.

Konfigurasi per edisi: `edisi`, `pos`, `wahana`, `kontrak_opsi`,
`konfig_penalti`, `room`, `status_acara`.

Akun, hak & jejak: `akun_panitia`, `fitur`, `akun_hak`, `history`.

Singgahan: `cache_live_score` (migrasi `0146`). Ia satu-satunya tabel yang
isinya BUKAN data, melainkan salinan hasil hitungan — satu baris JSON berisi
seluruh papan Live Score, disegarkan `segarkan_cache_live_score()`. Layar Live
Score dan layar Kejuaraan membacanya alih-alih menjalankan ulang seluruh rantai
skor untuk tiap panitia yang membuka layar. Menghapus isinya tidak menghilangkan
satu nilai pun; yang hilang cuma kecepatannya sampai disegarkan lagi.

Dua jalan menyegarkannya, dan keduanya perlu. Cron `refresh-live-score.yml`
menjaga hari lomba tiap sepuluh menit; tombol Refresh di layar Live Score
memanggil `minta_segarkan_live_score()` (migrasi `0165`) saat diminta.
Sampai `0165` hanya ada jalan pertama, dan cron itu sengaja mati di luar
tanggal lomba — jadi di luar dua hari itu tombol Refresh membaca ulang
snapshot beku yang sama tanpa satu pun galat. Terukur: penyegaran terakhir
29 Agustus 16:55 UTC, dilaporkan panitia 31 Agustus.

Duapuluh enam tabel seluruhnya, dan keduapuluh enamnya menyalakan RLS.

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

Regu yang belum punya jam datang tetap membawa skor posnya tanpa pengurangan
`-100` dan tetap ditampilkan di kedua Live Score, tetapi peringkatnya kosong
dan ia tidak dapat masuk enam besar. Setelah jam datang dicatat, penalti waktu
dapat dihitung dan regu baru masuk peringkat.

**Enam besar tiap golongan bergelar Juara 1-3 lalu Harapan 1-3**, dan kedua
layar yang menyebutkannya harus menyebut regu yang sama. `v_klasemen.peringkat`
memakai `rank()`: dua regu berskor sama berbagi angka yang sama lalu angka
berikutnya dilompati — benar untuk sebuah peringkat, salah untuk gelar, karena
penghargaannya cuma ada satu per gelar. Karena itu podium Live Score TIDAK
memakai `peringkat`; ia mengurutkan sendiri dengan pemecah seri yang sama
persis dengan `hasil_kejuaraan()` (migrasi `0139`): total menurun, lalu yang
paling dekat dengan kontrak waktunya (`abs(selisih_menit)`), lalu nomor dada
terkecil. Kolom `#` di tabel di bawahnya tetap `rank()`, dan itu memang benar
di sana.

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

**Dua deret, satu kunci** (migrasi `0116`). Kain dicetak dalam dua set yang
sama-sama mulai dari 001, jadi Internal diketik **1001–1250** sementara
Eksternal tetap **1–500**. Yang membedakannya bukan kolom baru: `nomor_dada`
tetap satu integer unik, dan yang menjaga deretnya `nomor_dada_sesuai_deret()`
di **dua** pintu — `daftar_ulang_batch` dan `tukar_nomor_dada`. Batas
antaranya `edisi.nomor_dada_intern_mulai`; batas atas tiap deret dibaca dari
`nomor_dada_stok`, karena stok itulah daftar kain yang benar-benar dibawa.
Layar Daftar Ulang memakai `v_rentang_nomor_dada` untuk menolak nomor salah
deret di kotaknya sendiri, dan pesannya menyebut rentang yang benar.

**Kainnya ikut diberi angka 1 di depan** — keputusan pemilik acara,
27 Agustus 2026. Ini bukan kerapian: juri di pos menulis nomor dada dengan
tangan dari kain di dada regu, jadi kain Internal yang polos bertulis 001 akan
menghasilkan blangko yang ambigu, dan tidak ada baris SQL yang bisa
memulihkannya. Dengan angka 1 di depan, kain dan sistem menyebut angka yang
sama dan tidak ada terjemahan di kepala siapa pun.

Konsekuensinya nomor dada bisa EMPAT digit, dan itu menjatuhkan satu bug yang
sudah lama tidur: `lpad(nomor::text, 3, '0')` memotong 1001 jadi `100` —
nomor Eksternal yang benar-benar ada. Migrasi `0117` membetulkannya di
`berangkatkan_kloter` dan memasang pemeriksaan yang membaca definisi SELURUH
fungsi terpasang, supaya salinan berikutnya tidak lolos lagi.

---

## 3. Layar panitia

SPA satu berkas dengan rute hash, di `web/js/app.js`. Butuh login. Rute boleh
berbuntut — `#/pos2/1:semaphore` — dan `pangkalRute()` memotong buntutnya
sebelum tabel `RUTE` dibaca, `ekorRute()` mengembalikannya. Buntutnya ada
supaya tombol Back HP mengembalikan pemilih lomba, bukan melompat ke Home.

| Rute | Layar | Kerjanya |
| --- | --- | --- |
| `#/home` | Home | menu + **empat** lencana: dua antrean (menunggu pembayaran, lunas belum bernomor) dan dua kemajuan berantai (Keberangkatan `berangkat/siap`, Kedatangan `datang/berangkat`) |
| `#/foto` | Foto Jawaban | foto borongan per lomba di pos, lalu tautkan nomor dada |
| `#/data-peserta` | Data Peserta | betulkan yang salah diketik pembina: kontak, nama regu, ketua, anggota, kelas/organisasi |
| `#/pembayaran` | Meja Pembayaran | tabel semua invoice, tandai lunas, cetak kwitansi |
| `#/daftar-ulang` | Meja Daftar Ulang | isi nomor dada per regu, tukar nomor rusak |
| `#/cetak-kloter` | Daftar Kloter | lembar per kloter untuk petugas start |
| `#/keberangkatan` | Keberangkatan | ceklis hadir, kontrak waktu, pindah kloter, berangkatkan |
| `#/finish` | Kedatangan | catat jam datang + anggota hadir |
| `#/pos` | Input Nilai Pos | lembar penilaian satu pos, satu baris per regu |
| `#/pos2` | Input Nilai Pos v2 | pilih satu lomba lintas pos — alamatnya jadi `#/pos2/<pos>:<kode_lomba>` supaya Back HP kembali ke pemilihnya — lalu satu regu satu layar: ketik nomor dada, isi kotak tiap kriteria, foto slipnya, simpan. Lomba waktu mendapat stopwatch yang mengisi kotak detiknya; lomba soal tulis memakai bentuk yang sama persis, satu kotak "Jumlah benar". Foto borongan hanya ada di `#/foto` |
| `#/cek-nilai` | Cek Nilai | satu regu satu layar, `‹ nomor dada ›` per regu: foto slip di sebelah angka yang diketik darinya, dan angkanya boleh dibetulkan serta dikunci di tempat. Pemegang `pengaturan` — dipakai admin server, bukan juri |
| `#/live-score` | Live Score | pemegang hak `live_score` — cincin kemajuan per pos, lalu podium ENAM tempat per golongan (Juara 1-3 di satu baris, Harapan 1-3 di baris berikutnya) dan tabel rinci; saklar fase hanya untuk pemegang `pengaturan` |
| `#/kejuaraan` | Kejuaraan | hasil juara dari skor, Juara Umum dari poin juara, Yel Yel dari poin Pos 5 per golongan, Peserta Terbanyak dari nomor dada Eksternal, dan pilihan manual panitia: Kostum dan Terfavorit per golongan, Pangkalan Terjauh satu SEKOLAH untuk seluruh acara |
| `#/pengaturan-kloter` | Pengaturan Kloter | simulasi dan perbaikan jadwal keberangkatan; pemegang `pengaturan` |
| `#/ganti-password` | Ganti Password | — |
| `#/account` | Akun | buat/nonaktifkan akun dan atur matriks hak; pemegang `akun` |
| `#/buku-sakti` | Buku Sakti | buku pegangan yang diserahkan antar kepanitiaan: cara menjalankan HRCD, tugas pokok tiap seksi, alasan sistem ini berbentuk begini, dan timeline satu edisi dari Serah Terima Jabatan sampai pelaksanaan. Alamatnya berbuntut kode bab — `#/buku-sakti/seksi`. Isinya data statis di `web/js/buku-sakti.mjs`, bukan baris database, jadi ia tetap terbaca saat Supabase tidak bisa dihubungi. **Satu-satunya layar tanpa pagar hak akses**, dan itu disengaja: yang paling butuh membacanya justru yang haknya paling sempit. Tautan ke layar lain di dalamnya tetap ikut hak |

Lima peran akun: `admin`, `registrasi`, `gerbang`, `juri_pos`, dan
`koordinator_pos`. Peran hanya memilih centang awal lewat `paket_peran()`;
sumber hak yang sebenarnya adalah baris `akun_hak`, dibaca database lewat
`boleh(fitur)` dan dibaca SPA lewat `bolehLihat(fitur)`. Karena itu dua akun
dengan peran sama boleh memiliki menu berbeda setelah centangnya disesuaikan.

Dua layar penilaian sengaja dipisah PERAN, bukan cuma tampilan. `#/pos2`
dipagari `pos` dan dipakai juri beserta tim input per lomba; `#/cek-nilai`
dipagari `pengaturan` dan dipakai admin server. Pemisahan itu yang membuat
layar pemeriksa boleh mengubah nilai: yang memeriksa memang bukan yang
mengetik. Gemboknya sendiri PER LOMBA sejak `0166` — Pos 1 punya lima gembok,
bukan satu — dan kuncinya `coalesce(lomba, name)` lewat `v_lomba_pos`, persis
kunci yang dipakai kolom foto. Yang perlu diketahui: pagar di dalam
`kunci_nilai_pos()` dan `buka_kunci_nilai_pos()` masih `boleh('pos')` ditambah
`pos_saya()`, jadi seorang juri pos yang berhasil memanggil RPC-nya tetap bisa
mengunci lomba yang bukan pegangannya di posnya sendiri. Yang menutup pintu itu
di lapangan adalah layarnya, yang hanya muncul untuk pemegang `pengaturan` —
bukan RPC-nya.

`juri_pos` wajib membawa satu nomor `pos`; pagar tulis membatasinya ke pos itu.
`koordinator_pos` mendapat paket hak yang sama tetapi kolom `pos` wajib kosong,
sehingga `pos_saya()` bernilai NULL dan ia bisa menangani seluruh pos. Membaca
data operasional dasar tetap dibuka untuk semua panitia aktif; tindakan yang
mengubah data selalu menuntut hak fiturnya. Nama lama `meja` dan
`operator_pos` tidak lagi sah sejak migrasi `0058`.

### Antrean nilai di HP petugas

Sejak layar `#/pos2` ada, **nilai yang gagal terkirim karena jaringan tidak
hilang dan juga tidak langsung masuk database**: ia duduk di `localStorage`
HP petugas sampai ada kesempatan mengirimkannya. Ini mengubah satu hal yang
biasanya boleh dianggap benar begitu saja — bahwa apa yang ada di database
adalah seluruh yang sudah dinilai. Selama sebuah pita kuning masih tampil di
layar seseorang, ada angka yang sudah ditulis juri tetapi belum ada di mana
pun selain HP itu.

Yang perlu diketahui siapa pun yang membaca rekap saat acara berjalan:

- **Jaminannya "terkirim begitu halaman itu terbuka dan ada sinyal"**, bukan
  "pasti terkirim nanti". Situs ini aset statis tanpa service worker, dan
  Background Sync tidak ada di Safari iOS — jadi tidak ada yang berjalan saat
  halamannya tertutup.
- **Antreannya terikat pada HP itu.** Kalau HP-nya tidak pernah dibuka lagi,
  tidak ada orang lain yang bisa mengirimkan angkanya.
- Karena itu pitanya menyuruh halamannya dibiarkan terbuka, dan menutup tab
  dengan antrean berisi memunculkan peringatan bawaan browser.

Yang **ditolak server** — di luar rentang, regu tergembok, komponen bukan
untuk golongan itu — TIDAK diantre: menunggu tidak mengubah jawabannya, dan
satu baris rusak akan menyumbat antrean di belakangnya. Ia dilaporkan merah
saat itu juga, selagi regunya masih di depan petugas.

Yang gagal tidak pernah terlihat berhasil: notifikasinya berbunyi "BELUM
terkirim" dan barisnya tidak dicatat ke daftar "Baru saja tersimpan".

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
Pos 3 yang punya EMPAT lomba menghasilkan tiga halaman — Logika lomba soal,
jadi ia tidak ikut — berapa pun jumlah regu.

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

### Rekapitulasi — cetakan Live Score, bukan layar

**Layar Rekapitulasi dihapus 27 Agustus 2026 (#606).** Pekerjaannya pindah dua
arah: menyapu regu yang bolong dikerjakan di layar Input Nilai Pos lewat
saringan "Belum Input" dan "Belum Foto" — per pos, di tempat orangnya memang
bekerja, bukan satu tabel raksasa lintas pos — sementara persen kelengkapan
per pos duduk di panel Status layar Live Score.

Yang tersisa dari layar itu KERTASNYA, dan bentuknya tidak berubah: tombol
Cetak Rekap Nilai di Live Score menyusun satu baris per regu, **satu kolom per
komponen** — bukan satu kolom per pos — Nilai Pos di ujung tiap kelompok, lalu
kolom perjalanan (kontrak, kloter, berangkat, datang, anggota, penalti)
sebagai satu kelompok utuh, lalu Total. Kolomnya tetap dibangun dari tabel
`wahana`, jadi penilaian tahun depan mengubah tabel dan kertasnya ikut berubah
sendiri. Empat kolom identitas dan kolom Total dicetak ulang di SETIAP lembar,
karena kertas ini beredar sebagai lembaran lepas dan lembar tanpa nomor dada
tidak bisa dicocokkan dengan apa pun; pembelahan halaman selalu jatuh DI
ANTARA pos, tidak pernah di tengah kolom sebuah pos.

**Yang tercetak persis yang tergambar.** Barisnya datang dari klasemen yang
sedang tampil, jadi ia sudah tersaring ke regu yang SUDAH BERANGKAT dan sudah
terurut — kertas yang diam-diam berbeda dari layar yang tombolnya baru ditekan
adalah kertas yang salah. Rantainya tetap bertumpu pada `v_rekap_penuh`
(migrasi `0027`, poin per komponen `0107`), tetapi tidak lagi dibaca langsung
oleh layar mana pun: `cache_live_score` (`0146`) yang menghitungnya sekali,
dan layar membaca singgahan itu.

**Dua hal hilang bersama layarnya, dan pemilik acara memilih begitu:** alarm
"N sudah closing tapi belum lengkap", dan penanda pos yang diam lebih dari 30
menit. Sapuan per pos menemukan regu yang bolong, tetapi tidak memberi tahu
bahwa sebuah pos berhenti menyetor — itu harus disadari sendiri dari angka
yang tidak menyusut.

Hak `rekap` TIDAK ikut dihapus; ia bukan hanya milik layar itu. Dan kait
`segarkanDiTempat` yang lahir di sini justru hidup terus — sekarang layar
Input Nilai Pos yang mendaftarkannya (bagian 7 nomor 10), dan pelajarannya
tetap: layar yang keadaannya sendiri berharga tidak boleh digambar ulang dari
nol hanya untuk menyegarkan angkanya.

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
aturan bersama untuk penilaian dan kelengkapan sejak `0096`: regu Internal
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

Lima aturan membentuk seluruh halaman ini:

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
4. **Top 10 adalah papan ringkas per golongan.** Hanya sepuluh regu yang sudah
   eligible untuk diperingkat yang terbit, dan tabelnya hanya membawa nomor
   dada, regu, organisasi, peringkat, serta Total. Regu yang belum tercatat
   tiba tidak ikut; poin per pos dan rincian penalti tidak ditulis ke berkas
   publiknya.
5. **Fase `juara` mengganti papan dengan DAFTAR JUARA, dan tidak ada yang
   lain.** `v_klasemen_publik` dan `v_progres_publik` sama-sama mengembalikan
   nol baris di fase ini, jadi berkas yang terbit memang tidak memuat satu
   baris papan pun — aturan 1 dipenuhi tanpa satu pagar tambahan. Daftar
   juara terbit BESERTA angkanya (migrasi `0163`, kolom skornya `0164`),
   memakai kelas yang sama dengan layar panitia `#/kejuaraan` supaya angkanya
   jatuh di tempat yang sama di dua layar. Menurunkan saklarnya kembali ke
   Live TIDAK mengembalikan papan sampai rekap diterbitkan ulang: berkas fase
   juara memang tidak memuatnya.

### Yang menjaga kejutan adalah database, bukan tampilan

Selama `status_acara.fase_live` masih `progres`, `v_klasemen_publik`
mengembalikan **nol baris** dan `v_progres_publik` tidak punya satu pun kolom
berisi angka nilai. Jadi `live.json` yang terbit memang **tidak memuat**
nilai — bukan memuatnya lalu disembunyikan CSS, yang bisa dibuka siapa pun
dengan membuka alamat berkasnya langsung. Admin dapat memindah fase ke
`top10` untuk menerbitkan papan ringkas, ke `penuh` untuk menerbitkan
klasemen empat golongan beserta rinciannya, atau ke `juara` untuk mengganti
papan dengan daftar juara — di fase itu kedua view papan mengembalikan nol
baris, jadi yang terbit memang hanya juaranya.

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
`penuh` menjadi `top10`, `progres`, atau `pra` tanpa menunggu penerbitan baru;
hasilnya tidak pernah boleh membuka lebih banyak daripada isi berkas yang
sudah terbit.

| Sumber | Besar | Isinya | Kapan diambil |
| --- | --- | --- | --- |
| `live.json` | ±1 KB | fase, edisi, daftar pos, ringkasan, kemajuan input per pos, dan `versi` | di-poll tiap 60 detik |
| `rekap.json` | puluhan KB | seluruh baris regu + klasemen + daftar juara | sekali per `versi`, dan hanya kalau dibutuhkan |
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
kunci wajib harus ada, klasemen harus kosong di luar fase `penuh` dan
`top10`, fase `top10` tidak boleh membawa regu tanpa peringkat atau lebih
dari sepuluh regu per golongan, daftar juara tidak boleh terbit di luar fase
`juara`, dan fase `juara` tidak boleh membawa satu baris papan pun. Kolom
daftar juara dijaga dengan DAFTAR IZIN, bukan daftar larangan: kolom yang
TIDAK dikenal yang menghentikan penerbitan, karena `hasil_kejuaraan()` duduk
di atas `pendaftaran` — satu tabel yang juga memuat nomor WA pembina.
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

Meja Pembayaran, Meja Daftar Ulang, dan Data Peserta melewati tiga rentang
yang sama, meski `min-width` masing-masing berbeda — 820px, 790px, dan 980px.
Angkanya ditentukan isi tabel, bukan ukuran jempol:

| Lebar | Bentuk |
| --- | --- |
| ≤ 900px | tiap baris jadi kartu bertumpuk; tidak ada geser samping |
| 901–940px | tetap tabel dengan layout `auto`; lebar kolom mengikuti isi |
| ≥ 941px | tabel dengan lebar kolom dipatok persen, supaya rincian sejajar kolom induknya |

Ambang 940px berasal dari `min-width` tabelnya (820px) ditambah padding dan
scrollbar. **Kalau kolom ditambah, `min-width` naik — dan ambang ini harus ikut
naik**, kalau tidak tabelnya menggeser ke samping dan kolom paling kanan (kolom
tombol) hilang dari layar tanpa petunjuk apa pun.

Meja Daftar Ulang berkolom empat: Kode Bayar, Sekolah, tombol "Isi N Nomor
Dada", dan tombol "Tukar nomor rusak…". Jumlah regu tidak punya kolom
sendiri — angkanya sudah tercetak di dalam tombol. Tabel rinciannya diberi
satu sel kosong di ujung supaya jumlah kolomnya sama: di bawah `fixed` dua
tabel hanya sejajar kalau kolomnya sama banyak.

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

**Yang DIBACA halaman ini cuma dua, dan salah satunya disimpan di HP.** Daftar
sekolah (`sekolah?select=id,name,address`) jadi **94 KB** sejak `0157`
memasukkan seluruh SMP/MTs/SMA/SMK/MA se-Kabupaten Ciamis, dan pembina membuka
form yang sama berkali-kali — mengisi separuh, menutup, kembali lagi. Sejak
`#720` ia disimpan di `localStorage` dan dipakai dari sana; kalau simpanannya
lewat enam jam, penyegaran jalan di latar belakang. Kotak cari sekolah bekerja
seluruhnya dari memori, jadi mengetik tidak menyentuh database sama sekali.

`infoEdisi()` **sengaja tidak ikut disimpan** — 180 byte, dan ia yang memutus
pendaftaran masih dibuka atau tidak. Basi paling parah yang bisa terjadi:
sekolah yang baru mendaftar hari ini belum muncul di kotak cari pembina lain.
Yang mengetiknya tetap menulis nama yang sama dan `kunci_sekolah()` tetap
menyatukannya ke satu baris — yang hilang kenyamanan, bukan kebenaran.

---

## 5. Deploy

| Yang di-deploy | Cara | Pemicu |
| --- | --- | --- |
| Layar panitia (`web/`) | DUA jalur sekaligus: Cloudflare Workers tersambung Git, dan GitHub Actions `deploy-panitia.yml` | Git integration jalan tiap push ke `main`; Actions hanya kalau push itu menyentuh `web/**`. Tombol Run workflow bekerja dari HP saat salah satunya menggantung — build Cloudflare pernah diam 40+ menit tanpa meninggalkan jejak di GitHub |
| Situs peserta (`live/`) | GitHub Actions `publish-live.yml` | **otomatis** tiap push ke `main` yang menyentuh `live/**` atau `live_json.sql` (#235); pada 29 Agustus 2026 pukul 06:00-18:59 WIB juga terbit tiap 15 menit |
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
membuatnya tidak bisa membusuk — TAPI ia harus dijalankan sendiri:
`workflow_dispatch` saja, tidak ada `pull_request` (CLAUDE.md 16.5). Yang
dibandingkannya `live/` dengan acuannya
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
boleh menyimpan, tapi wajib bertanya dulu. Asetnya ±970 KB seluruhnya
(`js/app.js` sendiri ±484 KB, `style.css` ±279 KB), tapi `no-cache` berarti
yang menyeberang saat tidak ada perubahan cuma jawaban 304 — jadi biayanya
tetap hampir nol, dan tanpa itu,
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
sendiri, termasuk halaman HTML yang disebut EMPAT kali karena Workers
menyajikan tiap berkas di dua alamat (`/` dan `/index.html`, `/daftar` dan
`/daftar.html`).

### Workflow lain

| Workflow | Nama di Actions | Untuk siapa |
| --- | --- | --- |
| `sql-tests.yml` | SQL Tests | developer — `workflow_dispatch` saja |
| `shared-files.yml` | Shared files | developer — `workflow_dispatch` saja |
| `refresh-live-score.yml` | Refresh Live Score cache | cron tiap 10 menit pada hari lomba (06:00-18:59 WIB), plus tombol |
| `provision-accounts.yml` | Provision akun panitia | panitia, dari HP |
| `change-password.yml` | Ganti password akun panitia | panitia, dari HP |
| `set-shared-password.yml` | Setel password bersama semua akun | panitia, dari HP |

**Tidak ada satu check pun yang berjalan sendiri.** `sql-tests.yml` dan
`shared-files.yml` cuma punya `workflow_dispatch`: keduanya selesai di laptop
dalam hitungan detik, dan pasal 16.1 sudah mewajibkannya di sana. Yang masih
terpicu otomatis cuma deploy — `publish-live.yml` dan `deploy-panitia.yml`.

Nama workflow mengikuti pembacanya: yang dijalankan panitia berbahasa Indonesia,
yang hanya dibaca developer berbahasa Inggris. Nama berkasnya selalu Inggris
(CLAUDE.md aturan 9 dan 12).

---

## 6. Menjalankan secara lokal

> **`supabase/seed.sql` sengaja menyimpan konfigurasi penalti seperti saat
> edisi 37 dibuat** — blok 10 menit, 10 poin per blok, −100 tanpa jam datang —
> bukan yang berlaku sekarang. `tests/run.sh` menjalankannya SEBELUM `0089`
> dan `0143`, persis seperti produksi, dan di sanalah kedua migrasi itu
> benar-benar diuji mengubah barisnya. Menyegarkan seed akan membuat keduanya
> lulus tanpa mengubah apa pun.
>
> `tests/dev_database.sh` urutannya terbalik — seluruh migrasi berjalan
> sebelum seed membuat edisi aktif — jadi ia mengembalikan baris itu ke
> **bawaan kolomnya** sesudah seed, lewat `set kolom = default`. Defaultnya
> sendiri dipasang `0089` dan `0143`, bagian migrasi yang memang berhasil
> berjalan tanpa memerlukan satu baris pun, sehingga tidak ada angka penalti
> yang ditulis dua kali di repo ini. Menjalankan ulang `0143` BUKAN jalan
> keluarnya: ia juga membuat ulang `v_klasemen` dan `simpan_kejuaraan_manual`,
> yang sudah diganti `0144`, `0145`, `0152`, dan `0153`.

Tanpa akun Supabase sama sekali. `tests/dev_server.py` menirukan PostgREST +
GoTrue di atas Postgres lokal, termasuk RLS: tiap request dijalankan dalam
transaksi dengan `SET LOCAL app.uid` dan `SET LOCAL ROLE`, sehingga policy yang
sama dengan produksi ikut menggigit.

```bash
PSQL=... PGPORT=5432 PGPASSWORD=... bash tests/dev_database.sh  # hrcd_dev
PGPORT=5432 PGPASSWORD=... python tests/dev_server.py  # tiruan Supabase :8787
python tests/static_server.py                # layar panitia :8788, tanpa cache
```

`PGPORT` bawaan `dev_database.sh` adalah 55432 — port database uji sekali
pakai, bukan server yang ada di laptop — jadi ia hampir selalu perlu
disebutkan. Samakan versi mayor servernya dengan produksi (PostgreSQL 17.6):
laptop pada 18.x akan berbeda pendapat dengan produksi dengan cara yang
terbaca seperti migrasi yang hilang.

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
    Layar Input Nilai Pos karena itu mendaftarkan `segarkanDiTempat` — kait
    yang dibuat untuk Layar Rekapitulasi dan diwarisi darinya setelah layar
    itu dihapus (#606) — dan yang
    dijalankan saat tab-nya kembali hanya pengambilan angkanya. Layar baru
    yang dipantau lama harus melakukan hal yang sama; yang tidak, tetap aman
    dengan perilaku bawaan.

---

## 8. Yang belum dibereskan

Diketahui basi, sengaja dibiarkan, supaya tidak ada yang mengira sudah dicek:

- **Beberapa RPC masih mencetak nomor dada mentah** di pesan galatnya
  (`nomor dada % tidak dikenal` di `catat_closing` dan `pindah_kloter`, antara
  lain), padahal di layar selalu tiga digit. Migrasi `0020` baru membetulkan
  `berangkatkan_kloter`; sisanya menunggu karena tiap perbaikan menuntut
  seluruh badan fungsinya disalin ulang.
- **Cron rekap live hanya hidup pada hari-H.** `publish-live.yml` berjalan
  tiap 15 menit pada 29 Agustus 2026 pukul 06:00-18:59 WIB. GitHub cron tidak
  punya kolom tahun, jadi langkah pertama memeriksa tanggal lengkap dan
  berhenti sebelum membaca database atau deploy pada tahun lain. Di luar
  jendela itu, halaman rekap hanya terbit saat ada push yang menyentuh `live/`
  atau saat tombol Run workflow ditekan.
- **Upload massal nilai belum ada.** `rancangan-b.md` bagian 6 menjelaskan
  jalur tempel-dari-Excel lengkap dengan layar preview. Yang sudah dibangun
  baru input tabelnya (`#/pos`) dan input per lomba (`#/pos2`) — yang
  sebenarnya sudah menutup sebagian besar
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
