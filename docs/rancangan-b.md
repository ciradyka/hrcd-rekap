# Rancangan Detail hrcd-rekap — Arsitektur B

> **CATATAN KEPUTUSAN — bukan keadaan sekarang.**
> Ini cetak biru yang dipakai membangun sistem, ditulis sebelum kodenya ada.
> Ia **sengaja dipertahankan apa adanya**: 42 komentar di kode — tersebar di
> migrasi, tes, SPA, dan Worker — menunjuk ke nomor bagian dokumen ini
> (`rancangan-b.md 11.9`, `bagian 4`, `2.2.1`, dan seterusnya). Menulis ulang
> isinya akan memutus seluruh penunjuk itu, termasuk yang tertanam di migrasi
> yang sudah diterapkan dan tidak boleh diedit.
>
> Beberapa hal berubah saat dibangun, jadi jangan baca dokumen ini sebagai
> gambaran layar hari ini. Yang sudah diketahui berbeda:
>
> - **Google Sheets tidak pernah dipakai.** Tidak ada di kode mana pun.
> - **Halaman live sudah ada, tapi bentuknya lain** (bagian 7):
>   `live/index.html` + `live/live.json` di Worker situs peserta sendiri,
>   diterbitkan workflow `publish-live.yml` — bukan `live.html` di Cloudflare
>   Pages seperti tertulis di bawah.
> - **Chip "Jam sekarang" tidak ada.** Jam berangkat justru diisi otomatis;
>   jam datang dikosongkan dengan keterangan "Kosong = jam saat tombol ditekan."
> - **Meja Pembayaran bukan alur ketik-kode → kartu**, melainkan tabel berisi
>   semua invoice dengan kotak cari dan saringan.
> - **Keberangkatan bukan papan 4 kolom**, melainkan satu pita chip berisi
>   semua kloter + satu tabel 5 kolom untuk kloter terpilih.
> - **Beranda hanya punya dua lencana angka**, bukan tiga.
> - **Export CSV belum ada** (dijadwalkan Tahap 4 di bagian 13).
> - Aturan tampilan di bagian 10.1 sudah banyak berubah — ambang responsif,
>   perilaku kepala di HP, dan ukuran sasaran sentuh.
>
> **Untuk keadaan sistem sekarang, baca `final-architecture.md`.**

Cetak biru implementasi untuk keputusan di `desain-sistem.md` bagian 8:
**Supabase (Postgres + Auth + RLS + Realtime) + SPA statis di Cloudflare +
Google Sheets sebagai jendela baca.** Syarat keras panitia berlaku di seluruh
dokumen: **setiap layar harus bisa dipakai panitia baru setelah satu kali
diperagakan.**

Rancangan ini disusun oleh tiga perancang paralel (model data, layar, mesin
konfigurasi) lalu diserang dua verifikator (cakupan spesifikasi, keterajaran);
38 temuan dan 11 celah mereka sudah dilebur ke dalam dokumen ini — keputusan
penyelesaiannya dicatat di bagian 11.

## 1. Gambaran arsitektur

1. **Supabase free tier** — satu-satunya backend. Postgres memegang seluruh
   data dan konfigurasi; Auth memegang akun panitia; RLS menegakkan batas
   akses; Realtime menghidupkan layar pemantau. Tidak ada server custom.
2. **SPA statis di Cloudflare Pages** — HTML + JS polos berbahasa Indonesia,
   tanpa framework berat, deploy = `git push`. Satu link untuk semua panitia.
3. **Halaman live publik** — file statis (`live.html` + `live.json`) di
   Cloudflare Pages, di-regenerate berkala oleh GitHub Actions. Penonton
   **tidak pernah** menyentuh Supabase.
4. **Satu Cloudflare Worker kecil** — gateway form pendaftaran publik:
   memverifikasi Turnstile (anti-spam gratis) + rate limit, baru meneruskan ke
   database. Satu-satunya jalur tulis dari luar.
5. **Google Sheets** — jendela baca: tombol Export CSV di semua layar daftar,
   arsip tahunan berupa spreadsheet.
6. Seluruh komponen Rp 0 tanpa kartu kredit: Supabase Free, Cloudflare
   Pages/Workers Free, GitHub Free (Actions cron), Turnstile Free.

## 2. Model data

### 2.1 Tabel operasional

| Tabel | Isi | Penjaga kebenaran |
| --- | --- | --- |
| `sekolah` | Master sekolah (nama + alamat), tumbuh tiap tahun; sumber autocomplete | `UNIQUE (nama, alamat)` |
| `pendaftaran` | Satu baris per batch (per pengisian form): kode pembayaran, butuh barak, jumlah pendamping, kontak WA, status | `UNIQUE (kode_pembayaran)`; status `menunggu_pembayaran → lunas / batal` — tanpa bentuk "lunas sebagian" |
| `regu` | Satu baris per regu: nama, ketua, golongan, nomor dada, kloter, kontrak, batal | `UNIQUE (nomor_dada)` — nomor ganda **mustahil**, bukan dihindari; `UNIQUE (kloter_nomor, urutan_kloter)` + `CHECK (urutan 1–10)` — kapasitas kloter ditegakkan database; nomor dada & kloter lahir bersama (`CHECK` berpasangan) |
| `nomor_dada_stok` | Stok fisik nomor yang disiapkan admin (mis. 1–500) | Nomor tersedia = belum ada di `regu.nomor_dada`; satu sumber kebenaran, tanpa flag yang bisa basi |
| `pembayaran` | Satu pembayaran penuh per batch + nomor kwitansi | `UNIQUE (pendaftaran_id)` — verifikasi ganda dari dua meja tertolak |
| `kloter` | 40 baris (30 dasar + 31–40 cadangan): jam berangkat **diketik** | Tidak ada kolom status — berangkat = `jam_berangkat` terisi (11.5); **tidak ada `DEFAULT now()`** |
| `keberangkatan_regu` | Ceklis berangkat per regu; keberadaan baris = berangkat | `PK (regu_id)` — ceklis ganda mustahil |
| `nilai_mentah` | Data mentah per regu per komponen: `nilai_1`, `nilai_2` (khusus benar−salah), sumber `manual/upload` | `UNIQUE (regu_id, wahana_id)`; RLS pos |
| `closing_regu` | Checkout: `jam_datang` **diketik & bisa di-edit**, `anggota_hadir` (0–5) | `PK (regu_id)`; upsert = mekanisme edit yang sah |
| `ruangan` | Daftar ruang kelas barak + kapasitas orang | — |
| `penempatan_barak` | Hasil alokasi; satu sekolah **boleh** terpecah ke >1 ruangan bila terpaksa | `UNIQUE (pendaftaran_id, ruangan_id)` |
| `akun_panitia` | Peta `auth.uid` → peran (`admin/registrasi/gerbang/juri_pos/koordinator_pos`) + nomor pos + aktif; hak sesungguhnya di `akun_hak` (migrasi 0057-0058) | Rotasi tahunan tanpa menyentuh policy |
| `riwayat` | Audit otomatis via trigger: siapa, kapan, tabel, nilai lama → baru, + `regu_id` agar bisa dicari per regu | Append-only; tidak bisa dimatikan dari klien |
| `status_acara` | **Satu baris** saklar hari-H: `daftar_ulang_ditutup`, `fase_live` (`pra/progres/penuh`), `konfigurasi_terkunci` | Trigger menolak edit konfigurasi saat terkunci (kecuali admin) |

### 2.2 Tabel konfigurasi (diedit admin tiap edisi)

| Tabel | Isi | Contoh edisi 37 |
| --- | --- | --- |
| `edisi` | Metadata + semua angka tunggal musim; tepat satu `aktif` | `biaya_per_regu=250000, maks_regu_per_kloter=10, kloter_dasar=30, kloter_maks=40, lompatan_kloter=2, interval_berangkat_menit=4` |
| `pos` | Daftar pos dinilai + bobot | 5 baris, `bobot=1.00` semua (aturan 9.2) |
| `wahana` | Satu baris per komponen nilai (wahana **atau** soal, kolom `jenis`): bentuk konversi + parameter + rentang wajar | `kode='lari_zigzag', bentuk='kecil_baik', poin_maks=100, raw_terbaik=20, raw_terburuk=90` → raw 40 detik = 71,4 poin |
| `kontrak_opsi` | Pilihan kontrak waktu | `('3,5 jam',210), ('4 jam',240), ('4,5 jam',270)` |
| `konfig_penalti` | Semua angka penalti, **kolom bernama** — pelajar baca satu baris, paham semua aturan | `blok_menit=10, penalti_per_blok=10, penalti_tanpa_checkout=100, penalti_per_anggota_hilang=20, nilai_pos_terlewat=0` |

1. `wahana.kode` dibatasi `CHECK` huruf-kecil/angka/underscore — kode ini
   dipakai sebagai **header kolom lembar cetak sekaligus header import**,
   sehingga kertas, foto, hasil AI, dan paste selalu memakai kosakata yang
   sama persis.
2. Konfigurasi berkunci `edisi`; data operasional hanya milik edisi aktif dan
   diarsip lalu dikosongkan tiap tahun (bagian 9.3).

## 3. Aturan akses

1. **Tiga peran, satu link:**

   | Peran | Contoh akun | Boleh |
   | --- | --- | --- |
   | `admin` | `admin.ciradyka` | Semua tabel, semua layar, konfigurasi |
   | `juri_pos` | `pos1hrcd37` … `pos5hrcd37` | `nilai_mentah` **hanya** baris `pos = pos_saya()` — ditegakkan RLS, devtools tidak menolong |
   | `registrasi` | `meja1hrcd37` … | Pendaftaran, pembayaran, daftar ulang, daftar kloter |
   | `gerbang` | `gerbang1hrcd37` … | Keberangkatan dan kedatangan — satu tempat, dua nama menurut arah lari (migrasi 0025) |

2. Dua fungsi helper `peran()` dan `pos_saya()` (membaca `akun_panitia` dari
   `auth.uid()`) dipakai seluruh policy; hanya akun `aktif=true` yang lolos.
3. **Anon nyaris nol**: hanya `SELECT sekolah` (autocomplete form, tanpa PII).
   Form publik menulis lewat gateway Worker (bagian 8), penonton membaca file
   statis (bagian 7) — **tidak ada jalur anon lain ke database**.
4. **Rotasi tahunan**: akun membawa akhiran edisi. Tiap edisi: akun lama
   `aktif=false` (jejak riwayat utuh), ±10 akun baru dibuat pemilik lewat
   dashboard Supabase (±10 menit, bagian dari ritual Januari — dari SPA statis
   memang mustahil membuat akun, dan itu disengaja). Login memakai username;
   layar login menambahkan akhiran domain email tetap secara otomatis.

## 4. Transaksi inti (RPC)

Semua operasi rawan tabrakan atau multi-baris berjalan sebagai satu transaksi
Postgres — layar tidak pernah menulis "setengah jadi":

| RPC | Menjamin |
| --- | --- |
| `submit_pendaftaran` | Buat sekolah (bila baru) + batch + N baris regu + kode pembayaran unik, sekali jalan; validasi ulang rincian golongan = total di server |
| `verifikasi_pembayaran` | Cek nominal = jumlah regu × `biaya_per_regu`; tolak batch yang bukan `menunggu_pembayaran`; terbit kwitansi; `UNIQUE` menolak verifikasi dobel |
| `batalkan_verifikasi` | Jalan mundur yang sah untuk salah verifikasi (meja di hari yang sama, admin kapan pun) — dengan alasan, terekam riwayat |
| `daftar_ulang_batch` | **Transaksi terpenting**: kunci batch lunas → terima pasangan regu→nomor dada **yang diketik petugas** (`p_nomor` jsonb; wajib lengkap satu batch, nomor divalidasi ada di stok / belum pensiun / belum dipakai, baris stoknya dikunci) → **satu gerbang `pg_advisory_xact_lock`** → sebar ke N kloter berbeda dengan `lompatan_kloter`, hindari kloter yang sudah berisi sekolah itu, buka kloter 31–40 hanya bila 1–30 penuh → tulis semuanya sekaligus. Regu `batal` dilewati. Lihat 4.1 dan alur-lomba.md 4.5 |
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
   kelebihan, tidak ada sekolah menumpuk** — selesai seluruhnya dalam
   **1,65 detik** (rata-rata 55 ms per meja). Serialisasi total tidak terasa
   pada skala 2–3 meja yang sebenarnya.

### 4.2 Kloter yang sudah dicetak dibekukan

Panitia: *"nanti kloter final akan diprint."* Itu mengubah sifat datanya.

1. **Begitu dicetak, kertas menjadi kebenaran di lapangan.** Petugas garis start
   memanggil regu dari kertas, bukan dari layar. Maka setiap perubahan isi
   kloter setelah cetak membuat kertas berbohong tanpa ada yang menyadari.
2. **Kejadian nyatanya bukan hipotetis**: sekolah datang terlambat, daftar
   ulang setelah cetakan dibagikan, dan regunya diselipkan ke kloter yang sudah
   tercetak. Di garis start, kloter itu memanggil 10 nama padahal kertas hanya
   memuat 9 — atau regu itu tidak pernah dipanggil sama sekali.
3. **Perlindungannya berlapis** (migrasi 0008):
   - Kolom `kloter.dicetak_pada` menandai kloter yang kertasnya sudah keluar.
   - `daftar_ulang_batch` hanya memilih kloter dengan `dicetak_pada is null`,
     sehingga pendaftar susulan otomatis jatuh ke kloter cadangan (31–40) dan
     dicetakkan **lembar tambahan** — bukan ditolak.
   - Trigger `jaga_kloter_tercetak` menolak perubahan `kloter_nomor` yang masuk
     ke atau keluar dari kloter tercetak, dari jalur mana pun — termasuk
     koreksi admin lewat SQL yang lupa aturan ini.
   - `batalkan_tanda_cetak` (admin, wajib beralasan, terekam riwayat) untuk
     kertas macet / cetak ulang.
4. **Penandaan terjadi SETELAH dialog cetak ditutup**, dan operator ditanya
   "kertasnya sudah keluar dengan benar?" — kalau cetakan batal, kloternya
   belum dianggap final.
5. **Bentuk kertasnya**: satu kloter per lembar (`break-after: page`), kolom
   No Dada besar, plus kolom kosong "Hadir" untuk dicentang tangan, dan tempat
   menulis jam berangkat + nama petugas.
6. Diuji di `tests/sql/04_cetak_kloter.sql` dan lewat aplikasi: setelah 5
   kloter ditandai tercetak, sekolah susulan masuk kloter yang belum pernah
   dicetak — bukan diselipkan.

### 4.3 Pindah kloter hari-H, dan kenapa sisipan wajib berteriak

Pembekuan di 4.2 mencegah perubahan **diam-diam**, bukan melarang keputusan
sadar panitia. Hari-H butuh dua jalur (migrasi 0009, RPC `pindah_kloter`):

1. **Telat biasa** — panggil tanpa menyebut kloter; regu mendarat di **kloter
   terakhir** yang belum berangkat dan masih muat.
2. **Urgent** — sebut kloter tujuannya; regu dipaksa masuk, **termasuk kloter
   yang kertasnya sudah beredar**.

Keduanya wajib beralasan dan terekam riwayat. Yang **tidak** boleh ditembus
meski urgent: kloter yang sudah berangkat, dan kapasitas fisik 10 regu —
kertas boleh dilanggar, kapasitas tidak.

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
| **Umum** | Papan pengumuman utama & barak | Perkiraan jam berangkat dicetak besar; **kotak catatan pembina** untuk menulis jam berangkat sebenarnya |

Kotak pembina itu bukan hiasan: pembina regu memang mencatat jam berangkat
untuk klarifikasi, karena target kedatangan — dan karenanya penalti waktu —
dihitung dari jam berangkat + kontrak waktu. Memberi mereka tempat menulis di
lembar resmi membuat klarifikasi berpijak pada angka yang sama.

## 5. Mesin skor — hitung-saat-baca, tanpa tombol "hitung ulang"

1. **Tidak ada angka turunan yang disimpan.** Semua skor dihitung saat dibaca
   oleh rantai SQL view pendek — tidak ada job rekap, tidak ada cache basi,
   dan edit konfigurasi langsung berlaku pada muat ulang layar berikutnya.
2. Rantainya:
   1. `hitung_poin(bentuk, …)` — satu fungsi `IMMUTABLE` berisi satu `CASE`
      untuk kelima bentuk: `kecil_baik`/`besar_baik` = interpolasi linear
      `raw_terbaik→poin_maks` … `raw_terburuk→0` (di-clamp), `biner`,
      `benar_per_total`, `benar_kurang_salah` (clamp ke ≥0).
   2. `v_poin_wahana` — nilai mentah → poin per komponen.
   3. `v_poin_pos` — Σ poin per pos × bobot; pos terlewat menyumbang 0 via
      `LEFT JOIN`, tanpa pengurangan tambahan (aturan 10.8).
   4. `v_penalti_waktu` — `target = jam_berangkat kloter + kontrak`;
      `selisih_menit` bertanda, presisi menit;
      `penalti = floor(|selisih|/blok_menit) × penalti_per_blok` — simetris;
      toleransi 0–9 menit **lahir dari floor**, bukan aturan tersendiri.
   5. `v_total_skor` — Σ pos − penalti waktu − `penalti_tanpa_checkout` (bila
      tidak ada baris closing; penalti waktu saat itu 0 karena tak
      terhitung) − `(5 − anggota_hadir) × penalti_per_anggota_hilang`.
   6. `v_klasemen` — `rank() OVER (PARTITION BY golongan ORDER BY total DESC,
      |selisih_menit| ASC)` — empat klasemen, tie-break ketepatan waktu sudah
      tertanam. Regu `batal` dan yang tidak pernah berangkat tidak ikut
      diperingkat.
3. View pendukung: `v_monitoring_input` (matriks regu × pos),
   `v_keberangkatan` (papan garis start), `v_lembar_nilai` (cetak, urut nomor
   dada), `v_kwitansi`, `v_barak`, `v_progres_publik` (baris aman-publik tanpa
   angka).

## 6. Pipeline import nilai (jalur tersibuk hari-H)

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

1. `live.html` + `live.json` di Cloudflare Pages; halaman memuat ulang
   `live.json` tiap 60 detik dan menampilkan cap "Diperbarui 10:35". Ratusan
   HP penonton hanya menyentuh hosting statis — bandwidth gratis tak terbatas,
   **nol request ke Supabase**.
2. Regenerasi: workflow GitHub Actions (`publish-live.yml`) — cron 5 menit
   (dinyalakan hanya minggu lomba) + tombol manual. Tiga langkah yang bisa
   dibaca pelajar: baca view publik memakai **service role key dari GitHub
   Secrets** (bukan anon — anon tidak bisa baca apa pun) → tulis `live.json` →
   deploy ke Pages. ±144 run di hari-H ≪ kuota gratis 2.000 menit/bulan.
3. **Bertahap sebagai data, bukan kode**: `status_acara.fase_live` menentukan
   isi view publik — `pra` (jumlah pendaftar per golongan), `progres` (per
   regu: sudah lewat pos mana, **tanpa angka**), `penuh` (klasemen 4 golongan
   setelah closing). Admin memindah fase dari layar konfigurasi.

## 8. Gateway form publik

1. Form pendaftaran mengirim ke **satu Worker Cloudflare kecil** (±50 baris,
   satu-satunya kode "server" di seluruh sistem): verifikasi token
   **Turnstile** (CAPTCHA gratis tanpa kartu) + rate limit per IP + batas
   ukuran payload → baru memanggil `submit_pendaftaran`.
2. Kunci-kunci rahasia (Turnstile secret, service role) hidup di Worker/GitHub
   Secrets — **tidak pernah** di SPA.

## 9. Jendela Sheets & arsip

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
    keenam layar panitia: tidak ada elemen yang meluber, halaman tidak pernah
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

| Layar | Peran | Inti |
| --- | --- | --- |
| Login | semua | Username + password; akhiran email ditambah otomatis |
| Beranda meja | meja | Pemilih fungsi + lencana angka dari data nyata (batch menunggu verifikasi, batch lunas belum bernomor, regu belum closing) |
| Form pendaftaran | publik | Bagian 3 alur, **satu halaman** (bukan wizard — lihat 10.4): 5 bagian bernomor, autocomplete sekolah dari master (dimuat sekali, difilter di browser), blok per regu muncul mengikuti stepper, tombol Kirim menempel di bawah dengan total hidup; hasil akhir menampilkan kode pembayaran besar-besar |
| Meja pembayaran | meja | Ketik kode → kartu batch → "Tandai Lunas" → panel sukses langsung menawarkan "Cetak Kwitansi" (satu alur, bukan dua); "Batalkan (salah)" memanggil `batalkan_verifikasi` |
| Meja daftar ulang | meja | Cari kode/sekolah → buka "Isi N Nomor Dada" → **ketik nomor dari kain fisik per regu** (nama regu + kategori + ketua terlihat, Enter = regu berikutnya) → satu tombol "Simpan N Nomor Dada" → kloter terisi otomatis dan dibacakan; jalur "Tukar nomor" untuk stok rusak |
| Garis start | meja | Papan 4 kolom **turunan otomatis** dari kloter terakhir yang berangkat: N berangkat / N+1–N+2 siap / N+3 konfirmasi kontrak. Operator hanya punya dua aksi: ceklis regu + tombol besar "BERANGKATKAN" (jam diketik). Papan bergeser sendiri — operator tidak pernah memutuskan apa yang maju |
| Input pos — manual | operator_pos | Loop ketik-Enter 5 detik; hanya komponen pos sendiri yang tampil |
| Input pos — upload massal | operator_pos | Pipeline bagian 6 |
| Meja closing | meja | Ketik nomor dada → kartu regu → jam datang (kosong + chip "Jam sekarang") + anggota hadir (default 5) → Enter; dirancang setara arus 10 regu / 5 menit; catatan kertas tetap jadi cadangan resmi di meja |
| Monitoring | semua panitia | Matriks regu × pos live (Realtime); kolom closing ikut live |
| Klasemen (admin) | admin | Empat tab golongan; **tanpa tombol hitung ulang** — selalu segar karena hitung-saat-baca; Export CSV |
| Konfigurasi (admin) | admin | Tab per tabel konfigurasi; editor baris dengan bahasa manusia + kolom "contoh hasil" live (ubah `raw_terbaik` → contoh konversi ikut berubah); saklar `fase_live`, `daftar_ulang_ditutup`, `konfigurasi_terkunci` |
| Cetak | admin/meja | Lembar nilai per pos (aktif setelah `daftar_ulang_ditutup`; urut nomor dada; header kolom = `wahana.kode` dari konfigurasi) + kwitansi; print CSS browser |
| Barak | meja/admin | Panel kebutuhan (+pendamping) vs kapasitas; tombol "Susun Ulang"; hasil bisa dikoreksi manual sebelum ditempel |
| Riwayat | admin | Cari per nomor dada / tabel / akun; baca-saja |
| Live publik | tanpa login | Bagian 7 |

### 10.3 Empat alur tersibuk (target waktu per transaksi)

1. **Daftar ulang batch** (target ≤ 40 detik/sekolah/meja): sebut kode → kartu
   tampil → konfirmasi lisan nama regu + sekolah → satu tombol → bacakan hasil
   → serahkan nomor dada fisik.
2. **Import massal pos** (berjalan sepanjang lomba): foto masuk WA → AI →
   Excel → copy → paste → mata menyapu kolom identitas → commit. Operator
   kedua di pos memvalidasi sambil operator pertama menerima foto berikutnya.
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

**Selisih semenit dua menit antara kertas dan tombol itu wajar** — menekan
tombol bisa terlambat sedikit. Yang perlu diketahui panitia bukan "beda berapa
menit", melainkan **apakah bedanya mengubah penalti**; karena penalti
dibulatkan per 10 menit, biasanya tidak. Layar finish menjawab itu langsung:
mengisi kolom jam memunculkan lencana **hijau** ("1 menit lebih awal — penalti
tetap −10") atau **kuning** ("15 menit lebih awal — penalti berubah −10 → 0").
Hanya yang kuning yang perlu diperdebatkan.

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
2. Yang hilang gara-gara wizard justru hal yang paling menenangkan orang awam:
   **melihat seluruh isi form sebelum mulai** — "oh, saya perlu menyiapkan
   nama-nama regunya dulu". Wizard menyembunyikan itu.
3. Efek samping yang menguntungkan: dua kerumitan hilang, bukan ditambal —
   riwayat per langkah (tombol back HP) dan pemulihan draf per langkah tidak
   lagi diperlukan. Kodenya ikut menyusut, sejalan dengan CLAUDE.md §6.
4. Yang tetap dijaga meski satu halaman:
   - Bagian **bernomor 1–5** sebagai penunjuk urutan tanpa memaksa pindah layar.
   - Tombol Kirim **menempel di bawah layar** dengan ringkasan hidup
     ("3 regu · Rp 750.000") — pada form panjang, aksi utama tidak boleh
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
    mustahil, dan 10 menit/tahun bukan alasan menambah server.

## 12. Batas yang diterima secara sadar

1. **Bentuk formula total** (Σ pos − penalti) adalah kode (satu view);
   angka-angkanya konfigurasi. Bentuk yang benar-benar baru = pemilik
   mengedit satu view SQL. Batas yang sama berlaku di semua kandidat.
2. **Maks 10 regu/kloter** ditegakkan `CHECK` — mengubahnya = satu migrasi
   kecil, bukan edit konfigurasi. Dipilih karena penegakan database lebih
   berharga daripada kelenturan angka yang 7 tahun tidak pernah berubah.
3. **.xlsx tidak di-parse** — paste dari Excel menutup kebutuhan yang sama
   tanpa dependensi parser.
4. **Pembayaran sebagian tidak punya bentuk data** — sesuai keputusan panitia;
   layar pembayaran menampilkan teks arahan "daftarkan batch lebih kecil".
5. **Supabase pause**: keep-alive = cron GitHub Actions mingguan yang menyentuh
   tabel heartbeat + ritual cek Januari; jendela pemulihan 1 tahun menjadikan
   kelalaian dapat dipulihkan, bukan fatal.

## 13. Urutan implementasi

| Tahap | Isi | Bukti selesai |
| --- | --- | --- |
| 1. Fondasi | Struktur repo, migrasi SQL lengkap (tabel + RLS + fungsi + view), seed konfigurasi edisi 37, seed contoh | Tes SQL: nomor dada ganda tertolak, RLS pos menggigit, contoh konversi & penalti cocok dengan dokumen ini |
| 2. Meja | Login, beranda meja, form pendaftaran + gateway Worker, pembayaran, daftar ulang | Alur daftar → bayar → nomor dada jalan penuh di lingkungan uji |
| 3. Hari-H | Garis start, input pos (manual + massal), closing, monitoring | Simulasi input 500 regu × 5 pos |
| 4. Admin | Konfigurasi, klasemen, cetak, barak, riwayat | Panitia bisa mengubah aturan skor tanpa menyentuh kode |
| 5. Publik | Live page + GitHub Actions + fase bertahap + keep-alive | Halaman live berjalan tanpa satu request pun ke Supabase |
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
10. **Kloter cadangan 31–40 benar-benar terakhir**: sekolah yang sama boleh
    berkumpul di 1–30 dulu sebelum kloter cadangan dibuka.
11. **Audit menempel juga di** `akun_panitia` (peta otorisasi), `sekolah`,
    `ruangan`, `nomor_dada_pensiun`; simpan-ulang tanpa perubahan tidak
    menulis apa pun sehingga riwayat tidak banjir dan kepengarangan tidak
    tergeser.

Setiap butir di atas dikawal tes di `tests/sql/` — 02 untuk constraint,
03 untuk alur, akses, dan matematika skor.
