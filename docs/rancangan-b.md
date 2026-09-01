# Rancangan Detail hrcd-rekap — Arsitektur B

> **CATATAN KEPUTUSAN — bukan keadaan sekarang.**
> Ini cetak biru yang dipakai membangun sistem, ditulis sebelum kodenya ada.
> Ia **sengaja dipertahankan apa adanya**: 61 komentar di kode, tersebar di 32
> berkas — migrasi, tes, SPA, situs peserta, Worker, `web/_headers`, dan
> `publish-live.yml` — menunjuk ke nomor bagian dokumen ini
> (`rancangan-b.md 11.9`, `bagian 4`, `2.2.1`, dan seterusnya). Menulis ulang
> isinya akan memutus seluruh penunjuk itu, termasuk yang tertanam di migrasi
> yang sudah diterapkan dan tidak boleh diedit.
>
> Beberapa hal berubah saat dibangun, jadi jangan baca dokumen ini sebagai
> gambaran layar hari ini. Yang sudah diketahui berbeda:
>
> - **Google Sheets tidak pernah dipakai.** Tidak ada di kode mana pun.
> - **Halaman live sudah ada, tapi bentuknya lain** (bagian 7):
>   `live/index.html` + **dua** berkas data — `live/live.json` (fase dan
>   ringkasan, di-poll tiap 60 detik) dan `live/rekap.json` (seluruh baris
>   regu, diambil sekali per `versi`) — di Worker situs peserta sendiri,
>   diterbitkan workflow `publish-live.yml` — bukan `live.html` di Cloudflare
>   Pages seperti tertulis di bawah.
> - **Chip "Jam sekarang" tidak ada.** Jam berangkat justru diisi otomatis;
>   jam datang dikosongkan dan dipindahkan ke panel tertutup "Perbaiki jam
>   atau jumlah anggota", dengan pesan "Kosongkan untuk memakai jam saat
>   tombol ditekan."
> - **Meja Pembayaran bukan alur ketik-kode → kartu**, melainkan tabel berisi
>   semua invoice dengan kotak cari dan saringan.
> - **Keberangkatan bukan papan 4 kolom**, melainkan satu pita chip berisi
>   semua kloter + satu tabel 5 kolom untuk kloter terpilih.
> - **Beranda punya empat lencana angka**: dua antrean (menunggu
>   pembayaran, lunas belum bernomor) dan dua kemajuan berantai
>   (Keberangkatan `berangkat/siap`, Kedatangan `datang/berangkat`).
> - **Export CSV belum ada** (dijadwalkan Tahap 4 di bagian 13).
> - Aturan tampilan di bagian 10.1 sudah banyak berubah — ambang responsif,
>   perilaku kepala di HP, dan ukuran sasaran sentuh.
> - **Pipeline import nilai di bagian 6 tidak pernah dibangun.** Tidak ada
>   textarea tempel, tidak ada pemilih `.csv`, tidak ada preview per baris.
>   Nilai masuk lewat `#/pos` (lembar satu pos, satu baris per regu) dan
>   `#/pos2` (satu regu satu layar), dan buktinya foto lembar jawaban
>   (`foto_lembar`), bukan hasil paste dari Excel.
> - **Supabase Realtime tidak dipakai sama sekali.** Layar yang disebut
>   "live" memakai denyut polling dan tombol muat ulang.
> - **Cloudflare Pages tidak dipakai.** Layar panitia dan situs peserta
>   sama-sama Cloudflare Worker static assets, gateway-nya Worker biasa.
>   Situs peserta hanya terbit lewat `publish-live.yml`; layar panitia lewat
>   Git integration Cloudflare DAN `deploy-panitia.yml`, dua jalur yang
>   sengaja dibiarkan berdampingan.
> - **Banyak nama tabel dan kolom berubah** (migrasi 0012 dan 0014):
>   `riwayat` → `history`, `ruangan` → `room`, `wahana.jenis` → `type`,
>   `wahana.bentuk` → `form`, `sekolah.nama/alamat` → `name/address`.
>   Nama di bagian 2 adalah nama rancangan, bukan nama di database.
> - **Peran dan hak akses ditulis ulang** (0057-0058, 0064, 0075): lima
>   peran, dan yang menjaga pintu `boleh(fitur)` — bukan `peran()`.
>   Seluruh bagian 3 menggambarkan mekanisme yang sudah diganti.
> - **Golongan ada enam, bukan empat** (0091): empat Eksternal ditambah
>   `intern_pa` dan `intern_pi`. Papan panitia memakai keenamnya; papan
>   PESERTA tetap empat, karena Intern dibuang di batas penerbitan.
> - **Fase live ada lima, bukan tiga** (0145 `top10`, 0163 `juara`).
> - **Akun panitia bisa dibuat dari layar Akun** (`#/account`) lewat gateway
>   Worker, dan dari HP lewat `provision-accounts.yml`. Kalimat "dari SPA
>   memang mustahil" di 3.4 dan 11.14 sudah tidak benar.
> - **Layar Monitoring, Konfigurasi, Barak, dan Riwayat tidak pernah
>   dibangun** sebagai layar tersendiri; daftar rute yang benar-benar ada
>   di `final-architecture.md` bagian 3.
>
> **Untuk keadaan sistem sekarang, baca `final-architecture.md`.**

Cetak biru implementasi untuk keputusan di `desain-sistem.md` bagian 8:
**Supabase (Postgres + Auth + RLS + Realtime) + SPA statis di Cloudflare +
Google Sheets sebagai jendela baca.** Dari ketiganya, Realtime dan Google
Sheets tidak pernah dipakai. Syarat keras panitia berlaku di seluruh
dokumen: **setiap layar harus bisa dipakai panitia baru setelah satu kali
diperagakan.**

Rancangan ini disusun oleh tiga perancang paralel (model data, layar, mesin
konfigurasi) lalu diserang dua verifikator (cakupan spesifikasi, keterajaran);
38 temuan dan 11 celah mereka sudah dilebur ke dalam dokumen ini — keputusan
penyelesaiannya dicatat di bagian 11.

## 1. Gambaran arsitektur

1. **Supabase free tier** — satu-satunya backend. Postgres memegang seluruh
   data dan konfigurasi; Auth memegang akun panitia; RLS menegakkan batas
   akses. Tidak ada server custom. (Realtime dirancang untuk menghidupkan
   layar pemantau, tetapi tidak pernah dipakai: yang terpasang denyut
   polling + tombol muat ulang di tiap layar.)
2. **SPA statis di Cloudflare Workers static assets** — HTML + JS polos
   berbahasa Indonesia, tanpa framework berat, deploy tetap = push ke `main`
   yang menyentuh `web/**`. Dua jalur berjalan berdampingan dengan sengaja:
   Git integration Cloudflare dan workflow `deploy-panitia.yml`, supaya build
   yang menggantung tidak menahan perbaikan. Satu link untuk semua panitia.
3. **Halaman live publik** — file statis (`live/index.html` + `live.json` +
   `rekap.json`) di Worker situs peserta sendiri, di-regenerate GitHub
   Actions. Penonton tidak pernah mengambil rekap dari Supabase; yang dibaca
   langsung cuma dua view kecil — `v_fase_live` tiap 15 detik, yang hanya
   boleh MEMPERKETAT fase dan tidak pernah membuka lebih banyak daripada isi
   berkas, dan `v_publik_ringkas` selama fase `pra` untuk jumlah pendaftar.
4. **Satu Cloudflare Worker gateway** — pintu form pendaftaran publik dan,
   sejak layar Akun ada, pengelolaan akun panitia: rate limit per IP + batas
   ukuran payload, baru meneruskan ke database. Turnstile tetap ada tetapi
   opsional, dan untuk edisi 37 dimatikan. Satu-satunya jalur tulis dari luar
   untuk DATA pendaftaran — bukti transfer diunggah pembina langsung ke
   bucket `bukti` lewat policy anon (0123), di luar Worker.
5. **Google Sheets** — jendela baca: tombol Export CSV di semua layar daftar,
   arsip tahunan berupa spreadsheet.
6. Seluruh komponen Rp 0 tanpa kartu kredit: Supabase Free, Cloudflare Workers
   Free, GitHub Free, Turnstile Free (tidak dipakai untuk edisi 37). Kuota
   Actions ditagih per JOB yang dibulatkan ke menit penuh, jadi yang mahal
   jumlah run — itu sebabnya check dijalankan di laptop dan cron dibatasi ke
   tanggal lomba (CLAUDE.md 16).

## 2. Model data

### 2.1 Tabel operasional

| Tabel | Isi | Penjaga kebenaran |
| --- | --- | --- |
| `sekolah` | Master sekolah (nama + alamat), tumbuh tiap tahun; sumber autocomplete | `UNIQUE (nama, alamat)` di rancangan; sejak migrasi 0061 kuncinya `unique (kunci_sekolah(name))` — alamat tidak lagi jadi pembeda, karena satu koma beda melahirkan sekolah kembar |
| `pendaftaran` | Satu baris per batch (per pengisian form): kode pembayaran, butuh barak, jumlah pendamping, kontak WA, status | `UNIQUE (kode_pembayaran)`; status `menunggu_pembayaran → lunas / batal` — tanpa bentuk "lunas sebagian" |
| `regu` | Satu baris per regu: nama, ketua, golongan, nomor dada, kloter, kontrak, batal | `UNIQUE (nomor_dada)` — nomor ganda **mustahil**, bukan dihindari; `UNIQUE (kloter_nomor, urutan_kloter)` menjaga urutan unik, sedangkan kuota hanya berlaku pada penempatan otomatis; nomor dada & kloter lahir bersama (`CHECK` berpasangan) |
| `nomor_dada_stok` | Stok fisik nomor yang disiapkan admin (mis. 1–500) | Nomor tersedia = belum ada di `regu.nomor_dada`; satu sumber kebenaran, tanpa flag yang bisa basi |
| `pembayaran` | Satu pembayaran penuh per batch + nomor kwitansi | `UNIQUE (pendaftaran_id)` — verifikasi ganda dari dua meja tertolak |
| `kloter` | Sedikitnya 60 baris: jam berangkat **diketik** | Tidak ada kolom status — berangkat = `jam_berangkat` terisi (11.5); **tidak ada `DEFAULT now()`** |
| `keberangkatan_regu` | Ceklis berangkat per regu; keberadaan baris = berangkat | `PK (regu_id)` — ceklis ganda mustahil |
| `nilai_mentah` | Data mentah per regu per komponen: `nilai_1`, `nilai_2` (khusus benar−salah), sumber `manual/upload` | `UNIQUE (regu_id, wahana_id)`; RLS pos |
| `closing_regu` | Checkout: `jam_datang` **diketik & bisa di-edit**, `anggota_hadir` (0–5) | `PK (regu_id)`; upsert = mekanisme edit yang sah |
| `ruangan` (di database: `room` sejak 0014) | Daftar ruang kelas barak + kapasitas orang | — |
| `penempatan_barak` | Hasil alokasi; satu sekolah **boleh** terpecah ke >1 ruangan bila terpaksa | `UNIQUE (pendaftaran_id, ruangan_id)` |
| `akun_panitia` | Peta `auth.uid` → peran (`admin/registrasi/gerbang/juri_pos/koordinator_pos`) + nomor pos + aktif; hak sesungguhnya di `akun_hak` (migrasi 0057-0058) | Rotasi tahunan tanpa menyentuh policy |
| `riwayat` (di database: `history` sejak 0012) | Audit otomatis via trigger `catat_riwayat()`: `changed_by`, `changed_at`, `table_name`, `old_value` → `new_value`, + `regu_id` agar bisa dicari per regu | Append-only; tidak bisa dimatikan dari klien |
| `status_acara` | **Satu baris** saklar hari-H: `daftar_ulang_ditutup`, `fase_live` (`pra/progres/penuh`; sejak 0145 dan 0163 juga `top10` dan `juara`), `konfigurasi_terkunci` | Trigger menolak edit konfigurasi saat terkunci (kecuali admin) |

### 2.2 Tabel konfigurasi (diedit admin tiap edisi)

| Tabel | Isi | Contoh edisi 37 |
| --- | --- | --- |
| `edisi` | Metadata + semua angka tunggal musim; tepat satu `aktif` | Kuota otomatis 5 Eksternal + 3 Intern, perkiraan 300 Eksternal + 50 Intern, `kloter_maks=75`, jendela 07:00–10:00 |
| `pos` | Daftar pos dinilai + bobot | 5 baris, `bobot=1.00` semua (aturan 9.2) |
| `wahana` | Satu baris per komponen nilai (wahana **atau** soal, kolom `jenis` — di database `type` sejak 0014): bentuk konversi (`bentuk`, di database `form`) + parameter + rentang wajar | `kode='lari_zigzag', bentuk='kecil_baik', poin_maks=100, raw_terbaik=20, raw_terburuk=90` → raw 40 detik = 71,4 poin |
| `kontrak_opsi` | Pilihan kontrak waktu | `('3 jam',180), ('3,5 jam',210), ('4 jam',240)` |
| `konfig_penalti` | Semua angka penalti, **kolom bernama** — pelajar baca satu baris, paham semua aturan | `blok_menit=1, penalti_per_blok=1, penalti_tanpa_checkout=0, penalti_per_anggota_hilang=20, nilai_pos_terlewat=0` |

1. `wahana.kode` dibatasi `CHECK` huruf-kecil/angka/underscore. Rencananya
   kode ini jadi **header kolom lembar cetak sekaligus header import**,
   supaya kertas, foto, hasil AI, dan paste memakai kosakata yang sama
   persis — alasan itu yang dikutip komentar `0001_schema.sql`. Yang
   terpasang lain: blangko memakai `wahana.name` + `petunjuk`, judul kotak
   isiannya dari `judul_isian` (0039; diisi ulang 0168 untuk Menaksir,
   dikosongkan 0169 untuk lomba soal supaya layar menurunkannya sendiri),
   dan tidak ada import yang membaca header apa pun. `kode` tinggal kunci
   internal — yang menyamakan kertas dan layar adalah nama.
2. Konfigurasi berkunci `edisi`; data operasional hanya milik edisi aktif dan
   diarsip lalu dikosongkan tiap tahun (bagian 9.3).

## 3. Aturan akses

1. **Lima peran, satu link** (rancangan ini menulis tiga; `koordinator_pos`
   lahir di 0075, dan nama `meja`/`operator_pos` diganti di 0058):

   | Peran | Contoh akun | Boleh |
   | --- | --- | --- |
   | `admin` | `admin.ciradyka` | Semua tabel, semua layar, konfigurasi |
   | `juri_pos` | `pos1hrcd37` … `pos5hrcd37` | MENULIS `nilai_mentah` **hanya** baris `pos = pos_saya()` — ditegakkan `v_lembar_pos` dan `simpan_nilai_massal`, devtools tidak menolong. MEMBACA dibuka lintas pos sejak 0069 untuk pemegang `rekap`/`live_score` |
   | `registrasi` | `meja1hrcd37` … | Pendaftaran, pembayaran, daftar ulang, daftar kloter |
   | `gerbang` | `gerbang1hrcd37` … | Keberangkatan dan kedatangan — satu tempat, dua nama menurut arah lari (migrasi 0025) |

2. Dua fungsi helper `peran()` dan `pos_saya()` (membaca `akun_panitia` dari
   `auth.uid()`) dipakai seluruh policy; hanya akun `aktif=true` yang lolos.
   **Sejak migrasi 0064 tidak lagi begitu:** yang menjaga pintu `boleh(fitur)`
   atas matriks centang `akun_hak`, `peran()` cuma mengisi centang awal lewat
   `paket_peran()`, dan kolomnya bernama `is_active` (0014). Jangan menambah
   perbandingan `peran() = '...'` baru — itu mengembalikan dua mekanisme untuk
   satu pertanyaan, dan yang satu tidak bisa diubah panitia (CLAUDE.md 13.1).
3. **Anon nyaris nol**: dirancang hanya `SELECT sekolah` (autocomplete form,
   tanpa PII). Yang terpasang lebih luas — anon juga membaca
   `v_edisi_publik`, `v_fase_live`, `v_publik_ringkas`, `v_kelengkapan_publik`
   dan `v_kejuaraan_publik`, memanggil `nama_regu_dipakai()`, dan mengunggah
   bukti transfer ke storage. Yang menahan bocor karena itu bukan ketiadaan
   jalur, melainkan pagar fase di dalam view-view itu (bagian 14 CLAUDE.md).
   Form publik tetap menulis lewat gateway Worker (bagian 8), penonton tetap
   membaca file statis (bagian 7).
4. **Rotasi tahunan**: akun membawa akhiran edisi. Tiap edisi: akun lama
   `aktif=false` (jejak riwayat utuh), ±10 akun baru dibuat pemegang hak
   `akun` dari layar Akun (`#/account`, lewat gateway Worker) atau massal
   lewat `provision-accounts.yml` dari HP. Rancangan ini menulis "dari SPA
   statis memang mustahil" — itu benar sampai layar Akun ada, dan yang
   membatasinya sekarang hak `akun`, bukan ketiadaan jalur. Login memakai
   username; layar login menambahkan `@ciradyka.com` secara otomatis.

## 4. Transaksi inti (RPC)

Semua operasi rawan tabrakan atau multi-baris berjalan sebagai satu transaksi
Postgres — layar tidak pernah menulis "setengah jadi":

| RPC | Menjamin |
| --- | --- |
| `submit_pendaftaran` | Buat sekolah (bila baru) + batch + N baris regu + kode pembayaran unik, sekali jalan; validasi ulang rincian golongan = total di server |
| `verifikasi_pembayaran` | Cek nominal = `tagihan_pendaftaran()` = jumlah `biaya_regu(golongan)` seluruh regu yang belum dibatalkan — Intern memakai `biaya_per_regu_intern`, golongan lain `biaya_per_regu`; tolak batch yang bukan `menunggu_pembayaran`; terbit kwitansi; `UNIQUE` menolak verifikasi dobel |
| `batalkan_verifikasi` | Jalan mundur yang sah untuk salah verifikasi (meja di hari yang sama, admin kapan pun) — dengan alasan, terekam riwayat |
| `daftar_ulang_batch` | **Transaksi terpenting**: kunci batch lunas → terima pasangan regu→nomor dada **yang diketik petugas** (`p_nomor` jsonb; wajib lengkap satu batch, nomor divalidasi ada di stok / belum pensiun / belum dipakai, baris stoknya dikunci) → **satu gerbang `pg_advisory_xact_lock`** → tempatkan FIFO ke kloter paling awal yang belum berangkat dengan kuota 5 Eksternal + 3 Intern → tulis semuanya sekaligus. Regu `batal` dilewati. |
| `tukar_nomor_dada` | Nomor dada rusak/salah pasang: tukar dengan stok tersedia, terekam riwayat |
| `konfirmasi_kontrak` | Validasi pilihan terhadap `kontrak_opsi` (bukan hardcode); boleh dikoreksi selama kloter belum berangkat |
| `berangkatkan_kloter` | Jam berangkat **wajib dari argumen** (diketik) — fungsi tidak mengenal `now()`; menolak bila ada regu ter-ceklis berangkat yang belum punya kontrak (daftarnya ditampilkan layar) |
| `simpan_nilai_massal` | **Satu-satunya jalur tulis nilai** — upload massal dan input manual (batch isi 1) lewat pintu yang sama; `SECURITY INVOKER` sehingga RLS pos tetap menggigit; validasi ulang semua baris di server, hasil per baris dikembalikan (sukses/tolak + alasan) |
| `catat_closing` | Upsert per regu — pemanggilan ulang = edit yang sah; `jam_datang` wajib dari argumen; `anggota_hadir` 0–5 |
| `susun_barak` | Idempotent: hapus + hitung ulang + tulis. Urut sekolah terbesar; utamakan 1 sekolah 1 ruangan; sekolah besar boleh terpecah ke beberapa ruangan; sekolah kecil digabung hanya bila terpaksa; `jumlah_orang = regu aktif × 5 + pendamping` |

### 4.1 Kenapa daftar ulang diserialisasi penuh

Panitia bertanya: kalau dua laptop menekan tombol pada detik yang sama, apakah
harus "simpan dulu ke database lalu query lagi supaya benar-benar cocok?"

1. **Pola "cek dulu, baru tulis" justru tidak aman.** Antara membaca dan
   menulis ada celah waktu: dua meja bisa sama-sama membaca "nomor 005 masih
   kosong", lalu sama-sama menulisnya. Yang benar adalah membiarkan database
   memutuskan **di dalam satu transaksi**, bukan browser bertanya lalu memberi
   tahu.
2. **Rancangan pertama masih bocor, dan uji membuktikannya.** Versi awal
   memakai `FOR UPDATE SKIP LOCKED` pada `nomor_dada_stok`, padahal yang
   menentukan sebuah nomor "sudah terpakai" adalah tabel lain
   (`regu.nomor_dada`). Mengunci tabel A sambil memutuskan berdasarkan tabel B
   adalah pola yang bocor. Pada uji 30 meja serentak: **1–3 meja gagal tiap
   putaran**, 290 dari 300 regu yang berhasil.
3. **Yang menahan datanya tetap constraint.** `UNIQUE (nomor_dada)` menolak
   duplikatnya — tidak ada nomor ganda yang pernah lolos ke database. Yang
   rusak hanyalah pengalaman operasional: satu sekolah gagal daftar ulang
   dengan pesan error teknis. Ini contoh kenapa constraint database dipasang
   sebagai jaring terakhir, bukan sebagai satu-satunya pengaman.
4. **Perbaikannya menyederhanakan, bukan menambah kepintaran** (migrasi 0007):
   seluruh bagian "pilih nomor + sebar kloter" dilewatkan **satu gerbang**
   `pg_advisory_xact_lock`. Hanya satu meja berada di dalamnya pada satu saat;
   yang lain menunggu beberapa milidetik lalu membaca keadaan yang sudah pasti
   mutakhir. `SKIP LOCKED` tidak lagi diperlukan sama sekali.
5. **Terukur, bukan diyakini** (`tests/concurrency_test.py`): 30 koneksi
   Postgres terpisah dilepas serentak lewat satu barrier, memperebutkan 300
   nomor dada. Hasil setelah perbaikan, lima putaran berturut-turut:
   **300/300 regu bernomor, nol error, nol duplikat, tidak ada kloter
   melewati kuota otomatis** — selesai seluruhnya dalam
   **1,65 detik** (rata-rata 55 ms per meja). Serialisasi total tidak terasa
   pada skala 2–3 meja yang sebenarnya.

### 4.2 Kloter yang sudah dicetak ditandai

Panitia: *"nanti kloter final akan diprint."* Itu mengubah sifat datanya.

1. **Tanda cetak tidak membekukan isi kloter.** Daftar dapat dicetak ulang;
   kebutuhan lapangan untuk menyisipkan regu lebih penting daripada cetakan
   lama. Sisipan tetap harus diumumkan kepada petugas staging.
2. **Kejadian nyatanya bukan hipotetis**: sekolah datang terlambat, daftar
   ulang setelah cetakan dibagikan, dan regunya diselipkan ke kloter yang sudah
   tercetak. Di garis start, kloter itu memanggil 10 nama padahal kertas hanya
   memuat 9 — atau regu itu tidak pernah dipanggil sama sekali.
3. Kolom `kloter.dicetak_pada` menandai kertas yang sudah keluar. Penempatan
   otomatis dan manual tetap boleh menambah regu; tambahan setelah cetak diberi
   tanda sisipan agar petugas staging diberi tahu.
4. **Penandaan terjadi sendiri sesudah `window.print()`**, tanpa bertanya.
   Dialog "kertasnya sudah keluar dengan benar?" dibuang: tidak ada layar yang
   membaca `dicetak_pada`, dan sejak 0066 ia tidak memagari apa pun, jadi
   pertanyaannya menghentikan petugas demi catatan yang tidak dibaca siapa
   pun. Akibat yang diterima: cetakan yang dibatalkan tetap tercatat.
5. **Bentuk kertasnya**: satu kloter per lembar (`break-after: page`), kolom
   No Dada besar, plus kolom kosong "Hadir" untuk dicentang tangan, dan tempat
   menulis jam berangkat + nama petugas.
6. Cetak memuat **semua** kloter yang terlihat di pratayang, termasuk yang
   sudah pernah dicetak — mencetak ulang selalu boleh. Kertasnya menuliskan
   **Perkiraan jam berangkat**; jam nyata tetap catatan terpisah.

### 4.3 Pindah kloter hari-H, dan kenapa sisipan wajib berteriak

Tanda cetak di 4.2 membuat perubahan perlu diumumkan, bukan melarang keputusan
sadar panitia. Hari-H butuh dua jalur (migrasi 0009, RPC `pindah_kloter`):

1. **Telat biasa** — panggil tanpa menyebut kloter; regu mendarat di **kloter
   terakhir** yang belum berangkat.
2. **Urgent** — sebut kloter tujuannya; regu dipaksa masuk, **termasuk kloter
   yang kertasnya sudah beredar**.

Keduanya wajib beralasan dan terekam riwayat. Jalur manual tidak memakai batas
kuota atau jumlah otomatis; petugas mencatat keputusan lapangan apa adanya.

**Bagian yang tidak diminta tetapi paling penting: sisipan harus berteriak.**
Petugas staging memegang kertas yang tidak memuat nomor itu. Kalau sistem diam,
regu tersebut ada di database tapi **tidak akan pernah dipanggil**. Maka:

- Regu yang mendarat di kloter tercetak ditandai `disisipkan_pada`.
- RPC mengembalikan kalimat siap-baca: *"Nomor 042 TIDAK ADA di kertas kloter
  3. Beri tahu petugas staging."*
- Layar menampilkannya sebagai kartu merah **menetap** (bukan toast yang hilang
  sendiri), dan menyediakan daftar seluruh sisipan aktif untuk dicetak atau
  dibacakan.
- Lembar staging menandai regu sisipan dengan ★ beserta keterangannya.

### 4.4 Dua bentuk kertas, karena pembacanya dua

Panitia membawa **kertas dan laptop bersamaan** — kertas untuk membacakan dan
mencentang, laptop untuk memverifikasi. Daftar kloter karena itu dicetak dalam
dua bentuk dari data yang sama:

| Bentuk | Pembaca | Isi khasnya |
| --- | --- | --- |
| **Staging** | Petugas di 3 staging | Kolom centang kehadiran, tempat menulis jam berangkat sebenarnya, tanda ★ untuk sisipan |
| **Umum** | Papan pengumuman utama & barak | Perkiraan jam berangkat dicetak besar; catatan "bersiap 15 menit sebelumnya, jam sebenarnya bisa bergeser". Kotak catatan pembina yang dirancang di bawah tidak jadi dicetak |

Kotak pembina itu bukan hiasan: pembina regu memang mencatat jam berangkat
untuk klarifikasi, karena target kedatangan — dan karenanya penalti waktu —
dihitung dari jam berangkat + kontrak waktu. Memberi mereka tempat menulis di
lembar resmi akan membuat klarifikasi berpijak pada angka yang sama. **Belum
dikerjakan**: lembar Umum yang tercetak hari ini tidak punya kotak itu.

## 5. Mesin skor — hitung-saat-baca, tanpa tombol "hitung ulang"

1. **Tidak ada angka turunan yang disimpan.** Semua skor dihitung saat dibaca
   oleh rantai SQL view pendek — tidak ada job rekap, tidak ada cache basi,
   dan edit konfigurasi langsung berlaku pada muat ulang layar berikutnya.
2. Rantainya:
   1. `hitung_poin(bentuk, …)` — satu fungsi `IMMUTABLE` berisi satu `CASE`
      untuk keenam bentuk (`bertingkat` menyusul di 0022, dan sejak 0085 ia
      membaca selisih terhadap jawaban benar): `kecil_baik`/`besar_baik` =
      interpolasi linear
      `raw_terbaik→poin_maks` … `raw_terburuk→0` (di-clamp), `biner`,
      `benar_per_total`, `benar_kurang_salah` (clamp ke ≥0).
   2. `v_poin_wahana` — nilai mentah → poin per komponen.
   3. `v_poin_pos` — Σ poin per pos × bobot; pos terlewat menyumbang 0 via
      `LEFT JOIN`, tanpa pengurangan tambahan (aturan 10.8).
   4. `v_penalti_waktu` — `target = jam_berangkat kloter + kontrak`;
      `selisih_menit` bertanda, presisi menit;
      `penalti = floor(|selisih|/blok_menit) × penalti_per_blok` — simetris;
      konfigurasi sekarang `1 menit → 1 poin`, jadi tidak ada toleransi menit.
   5. `v_total_skor` — Σ pos − penalti waktu − `(5 − anggota_hadir) ×
      penalti_per_anggota_hilang`. Tanpa baris closing, penalti waktu dan
      penalti checkout sama-sama 0; regunya tetap terlihat di Live Score tanpa
      peringkat dan tidak dapat masuk enam besar.
   6. `v_klasemen` — `rank() OVER (PARTITION BY golongan ORDER BY total DESC,
      |selisih_menit| ASC)` — enam klasemen sejak 0091 (empat Eksternal +
      `intern_pa`/`intern_pi`), tie-break ketepatan waktu sudah tertanam. Regu
      `batal`, yang tidak pernah berangkat, dan sejak 0143 yang belum tercatat
      tiba tidak ikut diperingkat.
3. View pendukung: `v_monitoring_input` (matriks regu × pos),
   `v_keberangkatan` (papan garis start), `v_lembar_nilai` (cetak, urut nomor
   dada), `v_kwitansi`, `v_barak`, `v_progres_publik` (baris aman-publik tanpa
   angka).

## 6. Pipeline import nilai (jalur tersibuk hari-H)

> **Tidak pernah dibangun.** Tidak ada textarea tempel, pemilih `.csv`,
> deteksi delimiter, maupun preview per baris di kode mana pun. Nilai masuk
> satu regu satu layar lewat `#/pos` dan `#/pos2`; foto lembar jawaban
> (`foto_lembar`) yang menggantikan alur foto → AI → Excel → paste.
> `simpan_nilai_massal` tetap satu-satunya jalur tulis nilai (butir 4 di
> bawah masih berlaku), hanya saja ia selalu dipanggil `p_sumber = 'manual'`
> dengan isi satu regu. Bagian ini dipertahankan karena
> `supabase/migrations/0004_rpcs.sql` menunjuk ke nomornya.

1. **Tahap tempel**: textarea besar menerima paste langsung dari Excel/Sheets
   (TSV) + pemilih file .csv. File .xlsx sengaja **tidak** di-parse — operator
   membuka dan menyalin dari Excel; menghapus satu dependensi parser dan tetap
   menutup alur foto → AI → Excel → copy → paste.
2. **Tahap parse**: deteksi delimiter otomatis; kolom 1 wajib nomor dada;
   header lain dicocokkan (abaikan kapital/spasi) ke `wahana.kode` **pos ini
   saja** — header tak dikenal menandai seluruh kolom: *"kolom tidak dikenal —
   mungkin ini lembar pos lain?"* (penangkap salah-pos). `v/x/✓` → 1/0 untuk
   bentuk biner.
3. **Tahap validasi & preview** — kesalahan harus **terlihat**, bukan sekadar
   terdaftar:
   - **Setiap baris menampilkan identitas hasil lookup**: nomor dada → nama
     regu + sekolah + golongan. Nomor yang salah baca tapi kebetulan valid
     akan terlihat janggal oleh mata operator — inilah pagar utama terhadap
     salah transkripsi AI.
   - Warna tegas tiga arti: **merah = tidak akan di-commit** (nomor tak
     dikenal, baris ganda, di luar rentang wajar dari konfigurasi), **kuning =
     butuh persetujuan eksplisit** (menimpa nilai lama, ditampilkan
     `lama → baru`; regu belum tercatat berangkat), **hijau = siap**.
   - Sel kosong dilewati diam-diam — lembar setengah terisi adalah hal normal,
     bukan error.
4. **Tahap commit**: satu tombol `Simpan N baris hijau (+M kuning yang
   disetujui)` → `simpan_nilai_massal` memvalidasi ulang semuanya di server
   (preview di browser bukan otoritas), menulis dengan audit, mengembalikan
   hasil per baris.
5. Input manual = formulir satu regu dengan pola yang sama (ketik nomor dada →
   kartu identitas muncul → isi angka → Enter) lewat RPC yang sama.

## 7. Halaman live publik — statis, bertahap, nol beban

1. `live/index.html` + `live.json` + `rekap.json` di Worker situs peserta;
   halaman memuat ulang `live.json` tiap 60 detik dan menampilkan cap
   "Update terakhir" dari jam saat berkasnya DIBUAT di server. 1.500-3.000 HP
   peserta hanya menyentuh hosting statis — bandwidth gratis tak terbatas.
   Yang tersisa ke Supabase cuma dua view kecil: `v_fase_live` tiap 15 detik
   dan `v_publik_ringkas` selama fase `pra`.
2. Regenerasi: workflow GitHub Actions (`publish-live.yml`) — cron 15 menit
   pada 29 Agustus 2026 pukul 06:00-18:59 WIB (dua baris cron, karena 06:00
   WIB jatuh 23:00 UTC hari sebelumnya) + tombol manual + push yang menyentuh
   `live/**`. Tahun diperiksa langkah pertama karena format cron hanya membawa
   tanggal dan bulan. Langkah yang bisa dibaca pelajar: jalankan
   `supabase/checks/live_json.sql` lewat `SUPABASE_DB_URL` dari GitHub Secrets
   (tersambung sebagai pemilik database — anon tidak bisa baca apa pun) →
   tulis `live.json` + `rekap.json` → periksa berkasnya sendiri → deploy
   folder `live/` ke Worker peserta. ~52 penerbitan terjadwal pada hari-H ≪
   kuota gratis 2.000 menit/bulan.
3. **Bertahap sebagai data, bukan kode**: `status_acara.fase_live` menentukan
   isi view publik — `pra` (jumlah pendaftar per golongan, keenamnya),
   `progres` (per regu: sudah lewat pos mana, **tanpa angka**), `penuh`
   (klasemen empat golongan Eksternal setelah closing; Intern PA/PI sengaja
   dibuang di batas penerbitan), lalu `top10` (0145: maksimal sepuluh regu
   berperingkat per golongan, tanpa poin per pos) dan `juara` (0163: papan
   diganti daftar juara, beserta angkanya sejak 0164). Saklarnya di layar
   Live Score, lewat RPC `atur_fase_live`, hanya untuk pemegang `pengaturan`.

## 8. Gateway form publik

1. Form pendaftaran mengirim ke **satu Worker Cloudflare** (587 baris,
   satu-satunya kode "server" di seluruh sistem): verifikasi token
   **Turnstile** — opsional, dan untuk edisi 37 sengaja dimatikan karena
   pendaftarannya tidak pernah disalahgunakan — + rate limit per IP + batas
   ukuran payload → baru memanggil `submit_pendaftaran`. Worker yang sama juga
   melayani pembuatan dan reset akun panitia untuk layar Akun.
2. Kunci-kunci rahasia (Turnstile secret, service role) hidup di Worker/GitHub
   Secrets — **tidak pernah** di SPA.

## 9. Jendela Sheets & arsip

> **Belum ada satu pun dari bagian ini.** Tidak ada tombol Export CSV di layar
> mana pun, tidak ada serialisasi CSV di browser, dan Google Sheets tidak
> dipakai — lihat catatan di kepala dokumen. Arsip tahunan belum punya
> prosedur tertulis selain "Bersihkan data" (CLAUDE.md 12.4).

1. **Export CSV di semua layar daftar**, posisi tombol sama di header setiap
   layar; serialisasi di browser, UTF-8 ber-BOM agar Excel membukanya bersih;
   nama file berpola `hrcd37-klasemen-penegak-pa.csv`. Sengaja tanpa Sheets
   API/OAuth — download adalah jalur satu-demo tanpa kredensial.
2. Masuknya data memang sudah berbentuk Excel (pipeline paste); keluarnya
   selalu tersedia sebagai CSV — bolak-balik tanpa konsep baru.
3. **Arsip tahunan**: setelah acara, admin meng-export semua view utama ke
   CSV → Google Sheets "HRCD 37 — Arsip", plus dump SQL ke Drive; lalu data
   operasional dikosongkan untuk edisi berikutnya. Arsip terbaca selamanya
   tanpa sistem berjalan.

## 10. Layar

### 10.1 Prinsip lintas layar (kontrak UX dengan panitia)

1. **Satu layar, satu aksi utama** — satu tombol besar per layar
   ("Simpan 10 Nomor Dada", "Berangkatkan Kloter 12", "Simpan 27 Baris").
2. **Nomor dada adalah jangkar universal** setelah daftar ulang (kode
   pembayaran sebelumnya); setiap layar dibuka dengan field kunci itu
   ter-autofocus.
3. **Echo-confirm sebelum simpan**: mengetik kunci apa pun langsung
   menampilkan kartu besar *milik siapa* (nama regu, sekolah, golongan,
   kloter); tombol simpan mati sampai lookup berhasil.
4. **Ketik lebih cepat daripada dropdown**: angka & jam diketik; Enter =
   simpan + fokus kembali ke field kunci — loop input manual ±5 detik/entri
   tanpa mouse.
5. **Jam selalu diketik, tidak pernah otomatis**: field jam datang / jam
   berangkat **kosong** secara default dengan chip "Jam sekarang" satu ketuk
   di sampingnya — cepat saat mencatat langsung, aman saat menyalin susulan
   dari kertas. Tidak ada `now()` tersembunyi di mana pun.
6. **Setiap simpanan terlihat & bisa di-edit di tempat**: daftar "baris
   terakhir" di kaki setiap layar input; ketuk untuk koreksi; audit merekam
   semuanya.
7. **Massal tidak pernah melewati mata manusia** (bagian 6).
8. **Status = warna + angka**, bukan kalimat — terbaca dari seberang meja.
9. **Kerangka sama di semua layar**: header (saya siapa + ganti fungsi +
   Export CSV), tengah (satu form/papan), kaki (baris terakhir) — belajar satu
   layar = belajar semuanya.
10. **Maksimal satu dialog konfirmasi**, hanya untuk aksi yang benar-benar
    tak terulangi (berangkatkan kloter, commit massal, pindah fase live).
11. **Gagal itu nyaring dan lokal**: baris gagal memerah + tombol "Coba
    lagi"; tidak ada yang hilang diam-diam.
12. Teks UI = kalimat yang memang diucapkan operator, dengan serapan familiar
    (upload, preview, password — bukan unggah/pratinjau/kata sandi).
13. **Semua layar — termasuk layar panitia — wajib jalan di HP.** Panitia
    memakai HP, bukan hanya laptop. Diperiksa terukur pada lebar 390 px untuk
    layar panitia yang ada saat itu (enam; sekarang 16): tidak ada elemen yang
    meluber, halaman tidak pernah
    menggeser ke samping, dan tidak ada sasaran sentuh di bawah 36 px. Tabel
    lebar menggeser di dalam kartunya sendiri, bukan menyeret seluruh halaman;
    di HP kepala memecah judul ke barisnya sendiri agar tombol tetap terjangkau
    jempol.
14. **Ukuran dibedakan menurut konteks, bukan seragam.** Versi pertama memakai
    ukuran "meja" (tubuh 18px, input 23px, sasaran sentuh 56px) untuk semua
    layar; hasilnya form pendaftaran menjadi 4,1 layar HP penuh — panitia
    mengeluh kebanyakan menggulir. Sekarang:
    - **Tubuh 16px, input 17px, sasaran sentuh 46px** — padat di HP, masih di
      atas ambang sentuh 44px.
    - **Angka yang dibacakan atau dicatat tetap besar**: nomor dada di hasil
      daftar ulang justru dinaikkan (2,3rem), kode pembayaran 2,1rem.
    - **Batas keras: font kotak isian minimal 16px.** Di bawah itu iOS Safari
      memaksa zoom setiap kali isian disentuh — halaman melompat-lompat, persis
      masalah yang ingin dihindari.
    - Hasil terukur: form pendaftaran 5 regu turun dari 3.429px menjadi
      2.242px pada lebar 390px (**−35%**, dari 4,1 layar jadi 2,7 layar).

### 10.2 Inventaris layar

> **Daftar rancangan, bukan daftar layar yang ada.** Kolom Peran memakai nama
> yang mati sejak 0058 (`meja` → `registrasi`, `operator_pos` → `juri_pos`),
> dan hak sebenarnya ditentukan centang `akun_hak`, bukan peran. Monitoring,
> Konfigurasi, Barak, dan Riwayat tidak pernah dibangun sebagai layar
> tersendiri. Rute yang benar-benar ada di `final-architecture.md` bagian 3.

| Layar | Peran | Inti |
| --- | --- | --- |
| Login | semua | Username + password; akhiran email ditambah otomatis |
| Beranda meja | meja | Pemilih fungsi + lencana angka dari data nyata (batch menunggu verifikasi, batch lunas belum bernomor, regu belum closing) |
| Form pendaftaran | publik | Bagian 3 alur, **satu halaman** (bukan wizard — lihat 10.4): 7 bagian bernomor dinamis (Peserta, Asal sekolah, Menginap, Jumlah regu, Identitas regu, Contact Person, Pembayaran; bagian Menginap dilewati untuk Intern), autocomplete sekolah dari master (dimuat sekali, difilter di browser), blok per regu muncul mengikuti stepper, tombol Kirim menempel di bawah dengan total hidup; hasil akhir menampilkan kode pembayaran besar-besar |
| Meja pembayaran | meja | Ketik kode → kartu batch → "Tandai Lunas" → panel sukses langsung menawarkan "Cetak Kwitansi" (satu alur, bukan dua); "Batalkan (salah)" memanggil `batalkan_verifikasi` |
| Meja daftar ulang | meja | Cari kode/sekolah → buka "Isi N Nomor Dada" → **ketik nomor dari kain fisik per regu** (nama regu + kategori + ketua terlihat, Enter = regu berikutnya) → satu tombol "Simpan N Nomor Dada" → kloter terisi otomatis dan dibacakan; jalur "Tukar nomor" untuk stok rusak |
| Garis start | meja | Papan 4 kolom **turunan otomatis** dari kloter terakhir yang berangkat: N berangkat / N+1–N+2 siap / N+3 konfirmasi kontrak. Operator hanya punya dua aksi: ceklis regu + tombol besar "BERANGKATKAN" (jam diketik). Papan bergeser sendiri — operator tidak pernah memutuskan apa yang maju |
| Input Nilai Pos (`#/pos`) | juri_pos | Lembar satu pos, satu baris per regu, plus cetak blangko |
| Input Nilai Pos v2 (`#/pos2`) | juri_pos | Pilih satu lomba lintas pos, satu regu satu layar: stopwatch untuk lomba waktu, kotak per kriteria untuk sisanya. Foto borongan pindah ke layar Foto Jawaban (`#/foto`) |
| Meja closing | meja | Ketik nomor dada → kartu regu → jam datang (kosong + chip "Jam sekarang") + anggota hadir (default 5) → Enter; dirancang setara arus 10 regu / 5 menit; catatan kertas tetap jadi cadangan resmi di meja |
| Monitoring | — | **Tidak dibangun.** `v_monitoring_input` ada di database tetapi tidak dibaca layar mana pun; kemajuan per pos dibaca dari Live Score (`#/live-score`), dan tidak ada Realtime |
| Live Score (`#/live-score`) | pemegang `live_score` | Enam tab golongan; podium enam tempat + tabel rinci; tombol segarkan singgahan (`minta_segarkan_live_score`, 0165); saklar fase hanya untuk pemegang `pengaturan`. Tanpa Export CSV |
| Konfigurasi (admin) | — | **Tidak dibangun.** Konfigurasi diubah lewat migrasi (mis. 0034 nama pos, 0076 bobot kriteria, 0089 penalti, 0109 kontrak, 0168-0169 judul isian). Dari ketiga saklarnya hanya `fase_live` punya tombol, di layar Live Score lewat `atur_fase_live` |
| Cetak | — | Bukan layar tersendiri: blangko "LEMBAR CADANGAN" dicetak dari Input Nilai Pos (header kolom = `wahana.name` + petunjuk, bukan `kode`, dan tanpa pagar `daftar_ulang_ditutup`), kwitansi dari Pembayaran, daftar kloter dari `#/cetak-kloter`; print CSS browser |
| Barak | — | **Tidak dibangun.** `susun_barak` dan `v_barak` ada di database tetapi tidak dipanggil layar mana pun |
| Riwayat | — | Bukan layar pencarian: riwayat dibuka sebagai dialog per baris di layar terkait, dari `v_riwayat_nilai` dan `v_riwayat_pendaftaran` (0137) |
| Live publik | tanpa login | Bagian 7 |

### 10.3 Empat alur tersibuk (target waktu per transaksi)

1. **Daftar ulang batch** (target ≤ 40 detik/sekolah/meja): cari kode/sekolah
   → kartu tampil → konfirmasi lisan nama regu + sekolah → **ketik nomor dari
   kain fisik per regu** (Enter = regu berikutnya) → satu tombol "Simpan N
   Nomor Dada" → kloter terisi otomatis dan dibacakan.
2. **Nilai per lomba** (berjalan sepanjang lomba): foto lembar jawaban
   diunggah dari HP ke layar Foto Jawaban (`#/foto`) → ditautkan ke nomor dada
   → angkanya diketik satu regu satu layar di `#/pos2`, dengan foto slipnya
   terlihat di sebelahnya. Yang gagal terkirim mengantre di `localStorage` HP
   petugas sampai ada sinyal; yang ditolak server dilaporkan merah saat itu
   juga. (Alur AI → Excel → paste di bagian 6 tidak pernah dibangun.)
3. **Serbuan closing**: baris depan mencatat di kertas (nomor dada + jam +
   jumlah orang), baris belakang mengetik dari kertas — layar dirancang untuk
   penyalinan cepat, bukan hanya pencatatan langsung; jam diketik membuat
   penyalinan susulan tetap akurat.
4. **Garis start** (satu kloter per 3–5 menit): papan bergeser otomatis;
   konfirmasi kontrak tiga kloter di depan; tombol besar satu per kloter.

### 10.5 Meja finish: dua aksi, ±3 detik

Panitia menetapkan targetnya sendiri: *"cukup ketik nomor peserta, dan klik
Sampai — itu hanya perlu 3 detik, jadi kalau ada 20 regu bersamaan pun tidak
terlalu lama."*

1. **Dua aksi, bukan tiga.** Tidak ada tombol "Cari": detail regu muncul
   sendiri sambil operator mengetik (jeda 160 ms), lalu satu ketukan. Enter
   sama dengan menekan tombol, sehingga seluruh loop bisa keyboard saja.
2. **Echo-confirm tetap ada** — kartu identitas (nomor dada, nama regu,
   sekolah, kloter, jam berangkat, target datang, dan selisih dari target)
   sudah terpampang pada saat operator menekan.
3. **Jam dikunci saat tombol ditekan, dari jam laptop panitia** — bukan cap
   waktu server saat data sampai. Jaringan lambat tidak menggeser jam datang.
4. **Yang jarang dipakai disembunyikan** di balik satu baris "Anggota kurang
   dari 5, atau mencatat dari kertas?" — jumlah anggota (default 5) dan jam
   susulan. Jalur cepat tetap dua aksi; jalur kertas tetap tersedia
   (alur 12.3).
5. **Keadaan yang menghalangi ditampilkan, bukan disimpan jadi galat**: kloter
   belum berangkat, regu belum diceklis di staging, atau sudah pernah dicatat
   datang (tombol berubah jadi "Perbaiki jam datang").
6. **Bug yang ditemukan saat menguji alur ini, dan wajib tidak terulang:**
   mengetik nomor baru lalu langsung menekan Enter sempat menyimpan regu
   dari pencarian SEBELUMNYA — mencatat regu yang salah datang. Sekarang
   hasil lookup lama dibuang seketika begitu angkanya berubah, dan tombol
   memeriksa ulang bahwa nomor yang tersimpan sama dengan yang terlihat di
   kotak isian.

### 10.6 Keberangkatan vs kedatangan: siapa pencatat, siapa verifikator

Panitia kertas dan panitia laptop duduk bersebelahan, tetapi perannya
berkebalikan di dua meja:

| | Pencatat utama | Peran kertas | Jam masuk lewat |
| --- | --- | --- | --- |
| **Keberangkatan (staging)** | **Kertas** — dicentang, sisipan ditulis tangan, jam kloter dicatat | Sumber; laptop menyalin | **Diketik** |
| **Kedatangan (finish)** | **Laptop** — tombol | Cek silang saja | **Tombol** (jam saat ditekan) |

Di finish ada penulisan manual juga, **tetapi hanya untuk verifikasi** —
tombol laptop tetap pencatat utamanya. Karena itu kolom jam dan jumlah anggota
sengaja **tidak** disejajarkan dengan tombol: keduanya dipakai saat
memperbaiki hasil cek silang, bukan pada tiap regu. Menaikkannya ke jalur
utama akan merusak target dua-aksi.

**Selisih semenit dua menit antara kertas dan tombol tetap mungkin terjadi** —
menekan tombol bisa terlambat sedikit — tetapi sekarang setiap menit mengubah
penalti. Tombol karena itu ditekan segera ketika regu tiba. Bila cek silang
menunjukkan pencatatannya terlambat, kolom jam dipakai untuk menyalin waktu
yang benar dari kertas; lencana dampaknya memperlihatkan perubahan poin sebelum
disimpan.

Karena itu layar keberangkatan harus enak dipakai untuk **menyalin** dari
kertas — jam wajib bisa diketik, dan urutan di layar mengikuti urutan di
kertas. Sedangkan layar finish dioptimalkan untuk **kecepatan mencatat
langsung**. Menyeragamkan keduanya akan merusak salah satunya.

### 10.4 Form publik: satu halaman, bukan wizard

Keputusan panitia setelah mencoba versi wizard: **"Kenapa harus berkali-kali
klik? Bisakah kita hanya mengisi 1 halaman form?"** — dan itu benar.

1. Wizard tepat untuk form panjang dengan banyak percabangan. Form ini pendek:
   lima pertanyaan dengan satu percabangan kecil (barak → jumlah pendamping).
   Memecahnya jadi enam layar hanya menambah lima klik tanpa manfaat.
   (Sekarang tujuh bagian dengan dua percabangan — jenis peserta dan barak —
   plus bagian Pembayaran beserta upload bukti transfer; alasannya tidak
   berubah.)
2. Yang hilang gara-gara wizard justru hal yang paling menenangkan orang awam:
   **melihat seluruh isi form sebelum mulai** — "oh, saya perlu menyiapkan
   nama-nama regunya dulu". Wizard menyembunyikan itu.
3. Efek samping yang menguntungkan: dua kerumitan hilang, bukan ditambal —
   riwayat per langkah (tombol back HP) dan pemulihan draf per langkah tidak
   lagi diperlukan. Kodenya ikut menyusut, sejalan dengan CLAUDE.md §6.
4. Yang tetap dijaga meski satu halaman:
   - Bagian **bernomor**, sekarang 1–7 dan dihitung dinamis supaya pendaftar
     Intern yang melewati bagian menginap tetap membaca urutan tanpa lubang.
   - Tombol Kirim **menempel di bawah layar** dengan ringkasan hidup
     ("3 regu · Rp 525.000") — pada form panjang, aksi utama tidak boleh
     tenggelam di ujung gulungan.
   - Galat ditampilkan **sekaligus** di tempatnya masing-masing, ditambah satu
     ringkasan yang tiap barisnya bisa diketuk untuk melompat ke isiannya.
     Tidak ada lagi "perbaiki satu, ketemu satu lagi".
   - Isian tetap tersimpan otomatis, dan kunci idempotensi tetap dipakai.

## 11. Keputusan yang menyelesaikan temuan verifikasi

1. **Satu kosakata**: nama tabel konfigurasi mengikuti rancangan mesin
   (`edisi`, `pos`, `wahana`, `kontrak_opsi`, `konfig_penalti`); dua rancangan
   pendahulu yang saling beda istilah dilebur ke sini.
2. **Satu pipeline publikasi**: GitHub Actions + service role dari Secrets;
   anon tetap buta. (Sebelumnya ada dua rancangan yang saling bertentangan.)
3. **Satu jalur tulis nilai**: manual dan massal sama-sama lewat
   `simpan_nilai_massal`; preview di browser, otoritas di server.
4. **Jam tidak pernah di-prefill**: temuan verifikator — prefill jam-sekarang
   justru salah tepat ketika meja menumpuk (pengetikan susulan). Diganti field
   kosong + chip "Jam sekarang".
5. **Papan garis start turunan**, bukan status yang digeser manual: satu-satunya
   penulisan adalah jam berangkat; posisi pipeline dihitung dari kloter
   terakhir yang berangkat — menghapus RPC penggeser status dan kebingungan
   "kolom ini untuk apa".
6. **Kontrak wajib sebelum berangkat**: `berangkatkan_kloter` menolak bila ada
   regu ter-ceklis tanpa kontrak — mencegah penalti waktu yang tak terhitung.
7. **Nilai diterima sejak regu bernomor dada** (bukan wajib berangkat dulu);
   belum-berangkat = kuning, bukan tolak — pos 1 sering menerima kloter yang
   ceklis berangkatnya menyusul.
8. **Barak boleh pecah ruangan** + kolom pendamping ditambah ke `pendaftaran`.
9. **Undo pembayaran resmi** (`batalkan_verifikasi`) menggantikan janji tombol
   undo tanpa jalur data.
10. **`status_acara`** menampung saklar yang sebelumnya tidak punya rumah:
    tutup daftar ulang (pemicu cetak lembar nilai), fase live, kunci
    konfigurasi (ditegakkan trigger, bukan janji klien).
11. **Riwayat bisa dicari per regu** (kolom `regu_id` diisi trigger).
12. **Klasemen tidak memuat regu batal / tak berangkat** — mencegah −100 hantu
    bagi regu yang memang tidak ikut.
13. **Urutan lembar cetak dikanonkan**: nomor dada menaik, di view dan layar.
14. **Akun dibuat pemilik setahun sekali lewat dashboard** — dari SPA memang
    mustahil, dan 10 menit/tahun bukan alasan menambah server. **Sudah
    dibalik**: layar Akun (`#/account`) membuat, menonaktifkan, dan mereset
    akun lewat gateway Worker, dan `provision-accounts.yml` melakukannya
    massal dari HP. Servernya tidak ditambah — gateway yang sudah ada dipakai.

## 12. Batas yang diterima secara sadar

1. **Bentuk formula total** (Σ pos − penalti) adalah kode (satu view);
   angka-angkanya konfigurasi. Bentuk yang benar-benar baru = pemilik
   mengedit satu view SQL. Batas yang sama berlaku di semua kandidat.
2. **Kuota otomatis 5 Eksternal + 3 Intern** ditegakkan RPC; set manual tidak
   dibatasi kuota maupun jumlah, dan `urutan_kloter` hanya wajib positif.
3. **.xlsx tidak di-parse** — paste dari Excel menutup kebutuhan yang sama
   tanpa dependensi parser.
4. **Pembayaran sebagian tidak punya bentuk data** — sesuai keputusan panitia;
   layar pembayaran menampilkan teks arahan "daftarkan batch lebih kecil".
5. **Supabase pause**: rencananya keep-alive = cron GitHub Actions mingguan
   yang menyentuh tabel heartbeat + ritual cek Januari. **Tidak pernah
   dibuat** — tidak ada tabel heartbeat maupun workflow keep-alive di repo,
   dan cron yang ada hanya `publish-live.yml` serta `refresh-live-score.yml`,
   dua-duanya terkunci ke tanggal lomba. Yang tersisa: jendela pemulihan
   1 tahun, jadi kelalaian tetap dapat dipulihkan. Sebelum menambah cron
   mingguan, hitung dulu tagihannya (CLAUDE.md 16.9).

## 13. Urutan implementasi

| Tahap | Isi | Bukti selesai |
| --- | --- | --- |
| 1. Fondasi | Struktur repo, migrasi SQL lengkap (tabel + RLS + fungsi + view), seed konfigurasi edisi 37, seed contoh | Tes SQL: nomor dada ganda tertolak, RLS pos menggigit, contoh konversi & penalti cocok dengan dokumen ini |
| 2. Meja | Login, beranda meja, form pendaftaran + gateway Worker, pembayaran, daftar ulang | Alur daftar → bayar → nomor dada jalan penuh di lingkungan uji |
| 3. Hari-H | Garis start, input pos (manual + massal), closing, monitoring | Simulasi input 500 regu × 5 pos |
| 4. Admin | Konfigurasi, klasemen, cetak, barak, riwayat | **Tidak tercapai.** Klasemen jadi Live Score dan cetak menempel di layar masing-masing; Konfigurasi, Barak, dan Riwayat tidak dibangun. Aturan skor masih diubah lewat migrasi SQL, bukan dari layar |
| 5. Publik | Live page + GitHub Actions + fase bertahap (kini lima) | Halaman live tidak mengambil rekap dari Supabase — hanya `v_fase_live` tiap 15 detik, yang cuma boleh memperketat, dan `v_publik_ringkas` selama fase `pra`. Keep-alive tidak dibuat |
| 6. Gladi | Seed 300 regu sintetis, drill semua meja, ukur waktu per transaksi terhadap target 10.3 | Angka gladi terlampir di repo |

Setiap tahap masuk lewat PR sendiri mengikuti konvensi CLAUDE.md.

## 14. Penyesuaian dari review implementasi Tahap 1

Migrasi SQL Tahap 1 diserang tiga reviewer adversarial (keamanan, kesesuaian,
kebenaran SQL); 39 temuan menghasilkan penyesuaian berikut — dokumen di atas
dibaca dengan koreksi ini:

1. **`submit_pendaftaran` hanya bisa dipanggil gateway Worker** (service
   role) — akun login mana pun tidak bisa, supaya Turnstile tidak bisa
   dilompati. Grant fungsi kini per-fungsi, bukan massal: RPC baru tidak
   pernah terekspos otomatis.
2. **Semua tulisan non-admin lewat RPC, titik.** Tulisan langsung ke
   `nilai_mentah`, `closing_regu`, `keberangkatan_regu`, `penempatan_barak`
   ditutup — mencegah pemalsuan kolom pencatat dan pelompatan validasi.
   `simpan_nilai_massal` menjadi `SECURITY DEFINER` dengan cek pos eksplisit
   (pilihan kedua — bagian 4 menuliskan `SECURITY INVOKER`); admin wajib
   menyebut pos.
3. **Nomor dada bekas tukar PENSIUN permanen** (tabel `nomor_dada_pensiun`) —
   foto lembar lama yang masih menuliskan nomor itu tidak akan pernah menilai
   regu lain. Penukaran setelah kloter berangkat hanya oleh admin.
4. **Pembatalan verifikasi ditolak setelah daftar ulang** — tidak ada lagi
   regu yatim bernomor-dada-tapi-belum-bayar. "Hari yang sama" dihitung WIB.
5. **Ceklis menyusul wajib berkontrak dulu** (koreksi kontrak setelah
   berangkat = admin) — regu yang ceklisnya terlambat tidak lagi lolos
   penalti waktu. Keberangkatan wajib berurut (tidak bisa melompati kloter
   berisi regu), dan ada `batalkan_keberangkatan` untuk ketukan salah
   (admin, hanya kloter terakhir).
6. **Klasemen mensyaratkan kloter benar-benar berangkat** dan batch berstatus
   lunas; semua view nilai/cetak/publik menyaring status batch; matriks
   monitoring untuk operator pos hanya menampilkan kolom pos-nya (tampilan
   sempit lebih baik daripada tampilan palsu).
7. **Penalti di-floor pada menit mentah** — selisih 9 menit 30 detik adalah
   penalti 0, bukan dibulatkan dulu ke 10. Knob `nilai_pos_terlewat` kini
   benar-benar terpasang di rumus total. `benar_kurang_salah` di-clamp ke
   [0, poin_maks].
8. **Kunci konfigurasi menahan admin juga** — membuka kunci adalah langkah
   sadar tersendiri di `status_acara` (perlindungan dua langkah, revisi atas
   kalimat "kecuali admin" di bagian 2.1).
9. **Barak muat-dulu**: cari ruangan kosong terkecil yang memuat seluruh
   rombongan sebelum memecah; menggabung tetap jalan terakhir. Jumlah
   pendamping bisa diisi dari form dan dikoreksi meja (`ubah_pendamping`).
10. **Penempatan kloter otomatis FIFO**: kloter paling awal diisi sampai kuota
    5 Eksternal + 3 Intern; sekolah tidak menjadi faktor penempatan.
11. **Audit menempel juga di** `akun_panitia` (peta otorisasi), `sekolah`,
    `ruangan`, `nomor_dada_pensiun`; simpan-ulang tanpa perubahan tidak
    menulis apa pun sehingga riwayat tidak banjir dan kepengarangan tidak
    tergeser.

Setiap butir di atas dikawal tes di `tests/sql/` — 02 untuk constraint,
03 untuk alur, akses, dan matematika skor.
