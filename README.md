# HRCD Rekap

Sistem rekapitulasi dan penilaian **Hiking Rally Ciradyka** — lomba gerak jalan
alam terbuka untuk SMP dan SMA yang diadakan Ambalan Ciung Wanara – Dyah
Pitaloka, SMA Negeri 1 Ciamis.

Arsitektur yang berjalan: **Supabase** (Postgres + Auth + RLS) sebagai mesin,
SPA statis di **Cloudflare Workers** sebagai tampilan, dan satu **Worker
gateway** kecil untuk menerima form pendaftaran publik. Seluruhnya Rp 0.
Gambaran lengkapnya di `docs/final-architecture.md`.

## Dokumen

| Dokumen | Isi | Status |
| --- | --- | --- |
| `docs/final-architecture.md` | Sistem sebagaimana adanya sekarang | **Acuan utama** |
| `docs/alur-lomba.md` | Alur penyelenggaraan dan aturan penilaian | Berlaku |
| `docs/desain-sistem.md` | Perbandingan empat kandidat arsitektur + keputusan | Catatan keputusan |
| `docs/rancangan-b.md` | Cetak biru implementasi yang dipakai membangun | Catatan keputusan |
| `docs/runbook-sekolah.md` | Cara membakukan daftar sekolah dari tulisan pembina | Berlaku |
| `docs/sekolah-belum-tuntas.md` | Sekolah yang alamatnya masih perlu ditanyakan | Daftar kerja |
| `docs/arsitektur-hrcd.svg` | Diagram lapisan teknis — Cloudflare, Supabase, penerbitan rekap | Berlaku — cap `0169` |
| `docs/alur-hrcd.svg` | Diagram alur acara — pendaftaran sampai klasemen | Berlaku |

Angka di `arsitektur-hrcd.svg` dihitung dari database, bukan dikira-kira, dan
capnya menyebut sampai migrasi berapa ia berlaku. Kalau cap itu tertinggal jauh
dari `supabase/migrations/`, angkanya jangan dipercaya sebelum dihitung ulang —
itulah gunanya cap itu ada.

**Buku Sakti tidak ada di tabel ini, dan itu bukan kelalaian.** Ia dokumen
untuk PANITIA, bukan untuk pengelola repo, jadi ia tinggal di dalam sistemnya
sendiri — layar `#/buku-sakti`, isinya `web/js/buku-sakti.mjs`. Di situ ia bisa
dibuka dari HP di tengah acara, mencetak dirinya sendiri untuk difotokopi, dan
menautkan tiap langkah ke layar yang mengerjakannya. Menyuntingnya berarti
menyunting daftar blok di berkas itu; tidak ada satu pun tag HTML yang perlu
disentuh, dan `tests/buku_sakti.test.mjs` menolak bentuk yang salah.

Bab terakhirnya papan sprint: tiga belas sprint dua mingguan dari Serah Terima
Jabatan sampai hari-H, dan **tiap tugasnya bisa dicentang**. Centangnya duduk
di database (`centang_sprint`, migrasi `0170`) dan terlihat oleh seluruh
panitia beserta siapa yang mencentang dan kapan — papan rencana yang jawabannya
berbeda-beda per HP bukan papan koordinasi. Kunci centangnya kode tugas di
`buku-sakti.mjs`, jadi **kode yang sudah dipakai tidak pernah diubah**;
menambah dan menghapus tugas aman, mengganti nama kodenya tidak.

`desain-sistem.md` dan `rancangan-b.md` merekam **keputusan pada saat itu**,
bukan keadaan hari ini. Keduanya sengaja dipertahankan apa adanya karena 61
komentar di kode — tersebar di 32 berkas: migrasi, tes, SPA, workflow,
gateway, dan berkas konfigurasi Cloudflare — menunjuk ke nomor
bagiannya (`rancangan-b.md 11.9`, `bagian 4`, dan seterusnya). Kalau isinya
berbeda dari sistem sekarang, `docs/final-architecture.md` yang benar.

## Struktur repo

```
.
├── docs/                     # spesifikasi, catatan keputusan, arsitektur
├── web/                      # SPA statis — layar panitia (panitia-hrcd37)
│   ├── index.html            # layar panitia (butuh login)
│   ├── js/                   # api.js, app.js, util.js, dua modul murni hitung
│   │                         # (departure-calculator.mjs dan
│   │                         # nomor-dada-series.mjs), dan buku-sakti.mjs —
│   │                         # ISI Buku Sakti sebagai data, bukan kode:
│   │                         # empat bab bacaan + papan 13 sprint yang
│   │                         # tugasnya dicentang (migrasi 0170)
│   ├── style.css             # seluruh gaya, termasuk aturan cetak
│   ├── config.js             # URL Supabase + gateway (bukan rahasia)
│   ├── _headers              # aturan cache Cloudflare
│   └── wrangler.toml         # deploy Workers static assets
├── live/                     # situs PESERTA (hrcd37) — Worker TERPISAH:
│   ├── daftar.html           # form pendaftaran publik
│   ├── index.html            # papan Live Score peserta; isinya ikut fase
│   ├── live.json             # ±1 KB: fase, versi, ringkasan, dan kemajuan
│   │                         # input per pos — INI yang di-poll tiap menit
│   ├── rekap.json            # baris regu + klasemen + daftar juara,
│   │                         # diambil sekali per versi
│   ├── live.js, live.css     # halaman rekap — tidak ada di web/
│   ├── js/daftar.js          # logika form pendaftaran — tidak ada di web/
│   ├── js/school-search.mjs  # pencocokan nama sekolah — tidak ada di web/
│   └── config.js, style.css, js/api.js, js/util.js
│                             # SALINAN dari web/ — jangan diedit di sini,
│                             # shared-files.yml gagal kalau menyimpang
├── workers/gateway/          # satu-satunya kode "server": penerima form daftar
├── supabase/
│   ├── migrations/           # skema database, urut 0001..0170
│   ├── checks/               # 30 SQL manual, dan 12 di antaranya MENGUBAH
│   │                         # data (flow_test, cleanup_data_uji,
│   │                         # cleanup_smoke, seed_data_uji, kloter_dari_stok,
│   │                         # simulasi_end_to_end, atur_fase_live, …) — baca
│   │                         # kepala berkasnya dulu. live_json.sql dipakai
│   │                         # Publish rekap live; status_migrasi.sql melapor
│   │                         # migrasi mana yang jejaknya ada di produksi
│   └── seed.sql              # konfigurasi edisi + baris wajib
├── scripts/                  # provision_accounts.py, change_password.py,
│                             # set_shared_password.py, delete_storage_objects.py
├── tools/                    # pemeriksa sumber + penyiap data uji:
│                             # periksa_impor.py, periksa_sekolah.py,
│                             # periksa_urutan_golongan.py, normalize_sekolah.py,
│                             # pratinjau_cetak.py, seed_regu_uji.py,
│                             # simulasi_end_to_end.py, dan data/ —
│                             # sekolah_nama.json + sekolah_alamat.json
├── tests/
│   ├── sql/                  # harness + tes constraint, alur, skor, kloter, rekap
│   ├── run.sh                # jalankan semuanya di database lokal
│   ├── dev_database.sh       # siapkan database hrcd_dev untuk dicoba manual
│   ├── dev_server.py         # tiruan Supabase untuk mencoba layar
│   ├── static_server.py      # penyaji web/ tanpa cache
│   ├── concurrency_test.py   # uji daftar ulang serentak dari banyak meja
│   ├── *.test.mjs            # 91 berkas tes layar + modul (node --test)
│   └── status_migrasi_check.sh
│                             # menguji jejak status_migrasi.sql dua arah;
│                             # lambat, sengaja di luar run.sh
├── .github/workflows/        # 10 workflow (lihat final-architecture.md)
├── CLAUDE.md                 # konvensi kerja
└── AGENTS.md                 # aturan sama dengan CLAUDE.md (judul + pembuka beda)
```

## Menjalankan tes

Butuh PostgreSQL (lokal atau portable, tanpa Supabase) — pakai **17**, versi
mayor yang sama dengan produksi (17.6). Tes SQL sendiri lulus di 16, dan itu
yang dipakai container CI, tetapi katalog Postgres berbeda antar versi mayor:
di laptop 18.x `supabase/checks/status_migrasi.sql` melaporkan 22 sidik jari
BELUM padahal migrasinya sudah masuk (CLAUDE.md pasal 7.8).

Yang dihitung versi **server**-nya, bukan `psql` yang dipakai memanggilnya:
klien 18 menyambung ke server 17 tanpa masalah, dan `select version()` tetap
menjawab 17. Jadi kalau satu-satunya `psql` yang bisa dijalankan di laptop
kebetulan versi lain, `PSQL=` boleh menunjuk ke sana selama `PGPORT=` menunjuk
ke server 17.

```bash
PSQL=/path/ke/psql PGPORT=55432 PGPASSWORD=... bash tests/run.sh
```

`PGPORT=55432` itu port container Postgres di CI. Instalasi PostgreSQL biasa
memakai **5432** — sesuaikan, jangan tambahkan container hanya supaya angkanya
cocok.

Tes JavaScript dan pemeriksaan sumber tidak butuh database sama sekali:

```bash
node --test tests/*.test.mjs
python tools/periksa_impor.py
python tools/periksa_urutan_golongan.py
python tools/periksa_sekolah.py
```

**Tes ini TIDAK berjalan sendiri di GitHub.** Workflow `SQL Tests` dan
`Shared files` hanya jalan kalau diminta — Actions → pilih workflow → Run
workflow, atau `gh workflow run "SQL Tests" --ref <cabang>`. Alasannya di
CLAUDE.md pasal 16: pemakaian Actions ditagih per job dibulatkan ke menit
penuh, sedangkan seluruh isinya bisa dijalankan di laptop dalam hitungan
detik. Konsekuensinya jalan satu arah: **kalau tidak dijalankan di sini, tidak
ada yang menjalankannya di mana pun.**

Untuk mencoba layarnya (butuh tiga terminal):

```bash
# siapkan database hrcd_dev
PSQL=/path/ke/psql PGPORT=5432 PGPASSWORD=... bash tests/dev_database.sh
# tiruan Supabase di :8787
PGPORT=5432 PGPASSWORD=... python tests/dev_server.py
# layar panitia di :8788 (tanpa cache)
python tests/static_server.py
```

Sebelum membuka `:8788`, ganti `mode: "supabase"` jadi `mode: "dev"` di
`web/config.js` — tanpa itu layar lokal tetap berbicara dengan Supabase
**produksi**, bukan `dev_server.py` di `:8787`. Kembalikan ke `"supabase"`
sebelum commit: nilai itu ikut ter-deploy, dan `shared-files.yml` juga
membandingkan `web/config.js` dengan salinannya di `live/`.

`dev_server.py` dan `concurrency_test.py` butuh `psycopg2`. Tidak ada
requirements.txt di repo — pasang sekali saja: `pip install psycopg2-binary`.

Runner membuat ulang database `hrcd_test` setiap kali — aman diulang. Tes
mencakup: nomor dada ganda tertolak, kapasitas kloter, RLS per pos, alur
lengkap daftar → bayar → daftar ulang → berangkat → nilai → closing, pemindahan
kloter, koreksi jam berangkat, dan kecocokan mesin skor dengan contoh angka di
`docs/rancangan-b.md`.

`tests/sql/08_lembar_pos.sql` mengujinya dari arah lain: angka yang dipakai
adalah baris **nyata** dari lembar penilaian HRCD XXXVI, lengkap dengan Nilai
Pos yang tercetak di sana. Kalau mesin skor menghasilkan angka lain, yang salah
kodenya — bukan lembarnya.

Uji konkurensi terpisah membuktikan beberapa meja daftar ulang yang menekan
tombol serentak tidak pernah menghasilkan nomor dada ganda:

```bash
bash tests/dev_database.sh        # siapkan database hrcd_dev
python tests/concurrency_test.py  # 30 meja serentak, 300 nomor diperebutkan
```

Uji ini memakai 270 regu Eksternal dan 30 regu Internal supaya kedua kuota
kloter diuji bersamaan. Workflow **SQL Tests** juga menjalankannya terhadap
database `hrcd_test` setelah seluruh migrasi dan tes SQL selesai.

## Menerapkan migrasi ke produksi

Merge TIDAK menerapkan migrasi. Jalankan workflow-nya sendiri:

```bash
gh workflow run "Apply migration to Supabase" --ref main \
  -f berkas=supabase/migrations/0021_pos_bayangan.sql
```

Atau dari HP: **Actions → Apply migration to Supabase → Run workflow**. Pastikan
log-nya mencetak `MIGRASI BERHASIL`.

Tidak ada yang mencatat migrasi mana yang sudah diterapkan, jadi berkas yang
tidak pernah dijalankan gagal diam-diam — sepuluh pernah begitu, dan yang
menemukannya pembina yang pendaftarannya ditolak enam hari kemudian. Sebelum
percaya sebuah migrasi sudah hidup, jalankan pemeriksanya lewat workflow yang
sama — `-f berkas=supabase/checks/status_migrasi.sql`. Ia melapor jejak tiap
migrasi di database dan tidak mengubah apa pun.

Situs peserta — form pendaftaran dan rekap live — hanya terbit lewat
**Publish rekap live**: workflow itu menulis ulang `live.json` dan `rekap.json`
dari database dulu, baru men-deploy folder `live/`. Karena itu project `hrcd37`
di Cloudflare tidak boleh tersambung Git. Ia sudah ikut jalan sendiri saat push
ke `main` menyentuh `live/**`, jadi merge yang cuma mengubah `daftar.html` pun
menerbitkannya; tombol Run workflow tetap ada untuk menerbitkan ulang tanpa
mengubah satu berkas pun.

Layar panitia punya DUA jalur, dan keduanya jalan tiap push ke `main` yang
menyentuh `web/**`: koneksi Git Cloudflare, dan workflow **Deploy layar
panitia**. Yang kedua ditambahkan karena build di dashboard pernah menggantung
lebih dari empat puluh menit tanpa meninggalkan jejak apa pun di GitHub.

## Kontribusi

Semua perubahan lewat branch + pull request — konvensi lengkap di `CLAUDE.md`.

```bash
git checkout -b <type>/<deskripsi-singkat>
# ...ubah...
git push -u origin HEAD
gh pr create --base main --title "<type>: <apa yang berubah>" --body "..."
```

Isi body-nya dengan bagian **What** dan **Why** — `--fill` mengambilnya dari
pesan commit dan menghasilkan PR tanpa keduanya.

PR di-merge dengan merge commit (`--no-ff`) bersubjek `Judul (#nomor)`.
