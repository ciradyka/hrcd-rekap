# HRCD Rekap

Sistem rekapitulasi dan penilaian **Hiking Rally Ciradyka** — lomba gerak jalan
alam terbuka untuk SMP dan SMA yang diadakan Ambalan Ciung Wanara – Dyah
Pitaloka, SMA Negeri 1 Ciamis.

Arsitektur: **Supabase** (Postgres + Auth + RLS) sebagai mesin, SPA statis di
**Cloudflare** sebagai tampilan, **Google Sheets** sebagai jendela baca —
seluruhnya Rp 0. Alasan dan perbandingannya di `docs/desain-sistem.md`.

## Dokumen

| Dokumen | Isi |
| --- | --- |
| `docs/alur-lomba.md` | Alur penyelenggaraan dan aturan penilaian (spesifikasi) |
| `docs/desain-sistem.md` | Empat kandidat arsitektur gratis + keputusan |
| `docs/rancangan-b.md` | Cetak biru implementasi (model data, layar, pipeline) |

## Struktur repo

```
.
├── docs/                     # spesifikasi & rancangan
├── supabase/
│   ├── migrations/           # skema database, urut 0001..0005
│   └── seed.sql              # konfigurasi edisi + baris wajib
├── tests/
│   ├── sql/                  # harness + tes constraint, alur, skor
│   └── run.sh                # jalankan semuanya di database lokal
└── README.md
```

## Menjalankan tes

Butuh PostgreSQL 16 (lokal atau portable, tanpa Supabase):

```bash
PSQL=/path/ke/psql PGPORT=55432 PGPASSWORD=... bash tests/run.sh
```

Untuk mencoba layarnya (butuh tiga terminal):

```bash
bash tests/dev_database.sh          # siapkan database hrcd_dev
python tests/dev_server.py    # tiruan Supabase di :8787
python tests/static_server.py  # layar panitia di :8788 (tanpa cache)
```

Runner membuat ulang database `hrcd_test` setiap kali — aman diulang. Tes
mencakup: nomor dada ganda tertolak, kapasitas kloter, RLS per pos, alur
lengkap daftar → bayar → daftar ulang → berangkat → nilai → closing, dan
kecocokan mesin skor dengan contoh angka di `docs/rancangan-b.md`.

Uji konkurensi terpisah membuktikan beberapa meja daftar ulang yang menekan
tombol serentak tidak pernah menghasilkan nomor dada ganda:

```bash
bash tests/dev_database.sh            # siapkan database hrcd_dev
python tests/concurrency_test.py  # 30 koneksi serentak memperebutkan 300 nomor
```

## Kontribusi

Semua perubahan lewat branch + pull request — konvensi lengkap di `CLAUDE.md`.

```bash
git checkout -b <type>/<deskripsi-singkat>
# ...ubah...
git push -u origin HEAD
gh pr create --fill
```

PR di-merge dengan merge commit (`--no-ff`) bersubjek `Judul (#nomor)`.
