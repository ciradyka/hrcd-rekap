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
├── web/                      # SPA statis — layar panitia + form pendaftaran
│   ├── index.html            # layar panitia (butuh login)
│   ├── daftar.html           # form pendaftaran publik
│   ├── js/                   # api.js, app.js, daftar.js, util.js
│   ├── style.css             # seluruh gaya, termasuk aturan cetak
│   ├── config.js             # URL Supabase + gateway (bukan rahasia)
│   ├── _headers              # aturan cache Cloudflare
│   └── wrangler.toml         # deploy Workers static assets
├── workers/gateway/          # satu-satunya kode "server": penerima form daftar
├── supabase/
│   ├── migrations/           # skema database, urut 0001..0020
│   ├── checks/               # SQL pemeriksaan manual (row_counts, smoke, dst.)
│   └── seed.sql              # konfigurasi edisi + baris wajib
├── scripts/                  # provision_accounts.py, change_password.py
├── tests/
│   ├── sql/                  # harness + tes constraint, alur, skor, kloter
│   ├── run.sh                # jalankan semuanya di database lokal
│   ├── dev_server.py         # tiruan Supabase untuk mencoba layar
│   └── static_server.py      # penyaji web/ tanpa cache
├── .github/workflows/        # 5 workflow (lihat final-architecture.md)
├── CLAUDE.md                 # konvensi kerja
└── AGENTS.md                 # salinan identik CLAUDE.md
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

Runner membuat ulang database `hrcd_test` setiap kali — aman diulang. Tes
mencakup: nomor dada ganda tertolak, kapasitas kloter, RLS per pos, alur
lengkap daftar → bayar → daftar ulang → berangkat → nilai → closing, pemindahan
kloter, koreksi jam berangkat, dan kecocokan mesin skor dengan contoh angka di
`docs/rancangan-b.md`.

Uji konkurensi terpisah membuktikan beberapa meja daftar ulang yang menekan
tombol serentak tidak pernah menghasilkan nomor dada ganda:

```bash
bash tests/dev_database.sh        # siapkan database hrcd_dev
python tests/concurrency_test.py  # 30 meja serentak, 300 nomor diperebutkan
```

## Menerapkan migrasi ke produksi

Merge TIDAK menerapkan migrasi. Jalankan workflow-nya sendiri:

```bash
gh workflow run "Apply migration to Supabase" --ref main \
  -f berkas=supabase/migrations/0020_nomor_dada_tiga_digit.sql
```

Atau dari HP: **Actions → Apply migration to Supabase → Run workflow**. Pastikan
log-nya mencetak `MIGRASI BERHASIL`.

## Kontribusi

Semua perubahan lewat branch + pull request — konvensi lengkap di `CLAUDE.md`.

```bash
git checkout -b <type>/<deskripsi-singkat>
# ...ubah...
git push -u origin HEAD
gh pr create --fill
```

PR di-merge dengan merge commit (`--no-ff`) bersubjek `Judul (#nomor)`.
