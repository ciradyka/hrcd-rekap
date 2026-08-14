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

Dua dokumen terakhir merekam **keputusan pada saat itu**, bukan keadaan hari
ini. Keduanya sengaja dipertahankan apa adanya karena 42 komentar di kode —
tersebar di migrasi, tes, dan SPA — menunjuk ke nomor bagiannya (`rancangan-b.md
11.9`, `bagian 4`, dan seterusnya). Kalau isinya berbeda dari sistem sekarang,
`docs/final-architecture.md` yang benar.

## Struktur repo

```
.
├── docs/                     # spesifikasi, catatan keputusan, arsitektur
├── web/                      # SPA statis — layar panitia (panitia-hrcd37)
│   ├── index.html            # layar panitia (butuh login)
│   ├── js/                   # api.js, app.js, util.js
│   ├── style.css             # seluruh gaya, termasuk aturan cetak
│   ├── config.js             # URL Supabase + gateway (bukan rahasia)
│   ├── _headers              # aturan cache Cloudflare
│   └── wrangler.toml         # deploy Workers static assets
├── live/                     # situs PESERTA (hrcd37) — Worker TERPISAH:
│   ├── daftar.html           # form pendaftaran publik
│   ├── index.html            # rekap live (cari sekolah → centang per pos)
│   ├── live.json             # ±1 KB: fase + versi, INI yang di-poll tiap menit
│   ├── rekap.json            # baris regu + klasemen, diambil sekali per versi
│   ├── live.js, live.css     # halaman rekap — tidak ada di web/
│   ├── js/daftar.js          # logika form pendaftaran — tidak ada di web/
│   └── config.js, style.css, js/api.js, js/util.js
│                             # SALINAN dari web/ — jangan diedit di sini,
│                             # shared-files.yml gagal kalau menyimpang
├── workers/gateway/          # satu-satunya kode "server": penerima form daftar
├── supabase/
│   ├── migrations/           # skema database, urut 0001..0032
│   ├── checks/               # SQL manual — flow_test & cleanup_smoke MENGUBAH
│   │                         # data; live_json.sql dipakai Publish rekap live
│   └── seed.sql              # konfigurasi edisi + baris wajib
├── scripts/                  # provision_accounts.py, change_password.py
├── tests/
│   ├── sql/                  # harness + tes constraint, alur, skor, kloter, rekap
│   ├── run.sh                # jalankan semuanya di database lokal
│   ├── dev_database.sh       # siapkan database hrcd_dev untuk dicoba manual
│   ├── dev_server.py         # tiruan Supabase untuk mencoba layar
│   ├── static_server.py      # penyaji web/ tanpa cache
│   └── concurrency_test.py   # uji daftar ulang serentak dari banyak meja
├── .github/workflows/        # 7 workflow (lihat final-architecture.md)
├── CLAUDE.md                 # konvensi kerja
└── AGENTS.md                 # aturan sama dengan CLAUDE.md (judul + pembuka beda)
```

## Menjalankan tes

Butuh PostgreSQL 16 (lokal atau portable, tanpa Supabase):

```bash
PSQL=/path/ke/psql PGPORT=55432 PGPASSWORD=... bash tests/run.sh
```

Untuk mencoba layarnya (butuh tiga terminal):

```bash
bash tests/dev_database.sh     # siapkan database hrcd_dev
python tests/dev_server.py     # tiruan Supabase di :8787
python tests/static_server.py  # layar panitia di :8788 (tanpa cache)
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

**Catatan:** `tests/concurrency_test.py` belum diperbarui sejak migrasi `0014`
mengganti nama kolom (`sekolah.nama` → `name`, `edisi.aktif` → `is_active`,
`regu.batal` → `is_cancelled`), jadi saat ini ia berhenti di langkah
`siapkan()`. Perbaiki nama kolomnya dulu sebelum menjalankan.

## Menerapkan migrasi ke produksi

Merge TIDAK menerapkan migrasi. Jalankan workflow-nya sendiri:

```bash
gh workflow run "Apply migration to Supabase" --ref main \
  -f berkas=supabase/migrations/0021_pos_bayangan.sql
```

Atau dari HP: **Actions → Apply migration to Supabase → Run workflow**. Pastikan
log-nya mencetak `MIGRASI BERHASIL`.

Merge juga TIDAK men-deploy folder `live/`. Situs peserta — form pendaftaran
dan rekap live — hanya terbit lewat **Actions → Publish rekap live**, termasuk
kalau yang berubah cuma `daftar.html`. Yang otomatis terbit tiap push ke `main`
hanya `web/`, lewat koneksi Git Cloudflare.

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
