# Sistem sebagaimana adanya

**Acuan utama.** Dokumen ini menggambarkan apa yang benar-benar berjalan hari
ini, bukan rencana. Kalau `desain-sistem.md` atau `rancangan-b.md` berbeda dari
dokumen ini, **dokumen ini yang benar** — keduanya catatan keputusan, ditulis
sebelum sistemnya dibangun.

Terakhir diperiksa terhadap kode: **14 Agustus 2026**, sampai migrasi `0024`.

---

## 1. Bentuk sistem

Tiga bagian, dan hanya satu di antaranya kode yang kita tulis dan jalankan
sendiri di server:

| Bagian | Isi | Di mana |
| --- | --- | --- |
| Database | Postgres + Auth + RLS + seluruh logika | Supabase |
| Tampilan | SPA statis, tanpa build step | Cloudflare Workers static assets |
| Gateway | Penerima form pendaftaran publik | Cloudflare Worker |

**Tidak ada server aplikasi.** Layar panitia berbicara langsung ke Supabase
lewat PostgREST memakai anon key; yang menjaga data bukan lapisan tengah,
melainkan RLS dan RPC di database. Satu-satunya kode server adalah gateway,
dan ia hanya menangani satu hal: form pendaftaran publik, yang harus bisa
dikirim tanpa login.

Yang **tidak** dipakai, meski disebut di dokumen lama: Google Sheets, Cloudflare
Pages, halaman `live.json`/`live.html`. Tidak ada satu pun di kode.

### Alamat produksi

| Apa | Alamat |
| --- | --- |
| Layar panitia + form daftar | `https://hrcd37.ciradyka.workers.dev` |
| Gateway pendaftaran | `https://gateway.ciradyka.workers.dev` |
| Supabase | `https://pwszijhnftvqjkdldqrf.supabase.co` |

Nama project situs memuat nomor edisi (`hrcd37`) dan berganti tiap tahun.
Gateway dan project Supabase sengaja TIDAK memuat nomor edisi supaya bisa
dipakai lintas tahun. Kalau `name` di `web/wrangler.toml` diubah, `ALLOWED_ORIGIN`
di `workers/gateway/worker.js` wajib ikut diubah.

---

## 2. Database

24 migrasi, `0001` sampai `0024`, dijalankan berurutan tanpa lubang penomoran.
`supabase/migrations/` adalah satu-satunya sumber kebenaran skema — tidak ada
perubahan yang dilakukan lewat dashboard.

**Migrasi tidak pernah disunting setelah diterapkan.** Perubahan atas fungsi
yang sudah ada ditulis sebagai migrasi baru berisi `create or replace function`
lengkap. Itu sebabnya definisi terbaru sebuah RPC sering berada di berkas
bernomor besar, bukan di `0004_rpcs.sql`.

### Tabel

Operasional: `pendaftaran`, `regu`, `sekolah`, `pembayaran`, `kloter`,
`keberangkatan_regu`, `nilai_mentah`, `closing_regu`, `penempatan_barak`,
`nomor_dada_stok`, `nomor_dada_pensiun`.

Konfigurasi per edisi: `edisi`, `pos`, `wahana`, `kontrak_opsi`,
`konfig_penalti`, `ruangan`, `status_acara`.

Akun & jejak: `akun_panitia`, `history`.

> Tabel jejak audit bernama **`history`** dengan kolom `table_name`, `row_id`,
> `action`, `old_value`, `new_value`, `changed_by`, `changed_at`. Dokumen lama
> menyebutnya `riwayat` — itu nama sebelum migrasi `0012`.

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

**Pos bayangan ikut dinilai** (migrasi `0021`). Ia pos biasa dengan penanda
`pos.bayangan`, bernomor melanjutkan pos utama — bukan cabang tersendiri di
mesin skor.

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
| `#/home` | Beranda | menu + dua lencana angka: menunggu pembayaran, lunas belum bernomor |
| `#/pembayaran` | Meja Pembayaran | tabel semua invoice, tandai lunas, cetak kwitansi |
| `#/daftar-ulang` | Meja Daftar Ulang | isi nomor dada per regu, tukar nomor rusak |
| `#/cetak-kloter` | Cetak Daftar Kloter | lembar per kloter untuk petugas start |
| `#/keberangkatan` | Keberangkatan | ceklis hadir, kontrak waktu, pindah kloter, berangkatkan |
| `#/finish` | Kedatangan | catat jam datang + anggota hadir |
| `#/pos` | Input Nilai Pos | lembar penilaian satu pos, satu baris per regu |
| `#/ganti-password` | Ganti Password | — |

Peran akun: `admin`, `meja`, `operator_pos`. Seluruh RPC meja menuntut
`peran() in ('admin','meja')`; akun `operator_pos` ditolak di layar meja dengan
pesan "Akun pos, bukan akun meja", dan sebaliknya akun `meja` ditolak di
`#/pos`. Home menampilkan menu yang berbeda per peran — akun pos hanya melihat
layar posnya sendiri.

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

`v_lembar_pos` adalah **satu-satunya view yang bukan `security_invoker`**.
Alasannya ada di kepala migrasi `0023`: jalan menuju nama sekolah melewati
tabel `pendaftaran`, yang tertutup untuk operator pos karena memuat nomor
WhatsApp. Kalau view-nya tunduk RLS, operator mendapat lembar kosong — dan
lembar kosong terbaca sebagai "belum ada peserta", bukan sebagai galat hak
akses. Pagarnya dipasang di dalam view: `peran() is not null`, dan operator
hanya posnya sendiri.

### Bentuk tabel meja menurut lebar layar

Meja Pembayaran dan Meja Daftar Ulang berganti bentuk di dua ambang. Angkanya
ditentukan isi tabel, bukan ukuran jempol:

| Lebar | Bentuk |
| --- | --- |
| ≤ 560px | tiap baris jadi kartu bertumpuk; tidak ada geser samping |
| 561–940px | tetap tabel, lebar kolom mengikuti isi, label tombol dipendekkan ("Lunas", "Kwitansi") |
| ≥ 941px | tabel dengan lebar kolom dipatok persen, supaya rincian sejajar kolom induknya |

Ambang 940px berasal dari `min-width` tabelnya (820px) ditambah padding dan
scrollbar. **Kalau kolom ditambah, `min-width` naik — dan ambang ini harus ikut
naik**, kalau tidak tabelnya menggeser ke samping dan kolom paling kanan (kolom
tombol) hilang dari layar tanpa petunjuk apa pun.

Meja Daftar Ulang berkolom tiga: Kode Bayar, Sekolah, tombol "Isi N Nomor Dada".
Jumlah regu tidak punya kolom sendiri — angkanya sudah tercetak di dalam tombol.

---

## 4. Form pendaftaran publik

`web/daftar.html` + `web/js/daftar.js`, tanpa login. Kiriman tidak langsung ke
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
| Situs statis (`web/`) | Cloudflare Workers, tersambung Git | otomatis tiap push ke `main` |
| Gateway Worker | GitHub Actions `deploy-gateway.yml` | manual |
| Migrasi database | GitHub Actions `apply-migration.yml` | manual, satu berkas per jalan |

**Merge ke `main` = deploy situs.** Tidak ada build step; berkas di `web/`
disajikan apa adanya, dengan `web/wrangler.toml` menyetel root proyek ke folder
itu.

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
boleh menyimpan, tapi wajib bertanya dulu. Asetnya kecil (<100 KB seluruhnya),
jadi biayanya hampir nol — dan tanpa itu, perbaikan mendadak pagi hari-H tidak
akan sampai ke panitia.

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

---

## 8. Yang belum dibereskan

Diketahui basi, sengaja dibiarkan, supaya tidak ada yang mengira sudah dicek:

- **`docs/arsitektur-hrcd.svg` dan `.png`** masih menggambarkan Google Sheets
  sebagai bagian arsitektur, dan angkanya sudah bergeser: tertulis "18 view
  berlapis" (sekarang 17) dan "24 RPC bertransaksi" (sekarang 26 fungsi, 14 di
  antaranya dipanggil layar). Diagramnya tidak dirujuk dari dokumen mana pun,
  jadi dibiarkan sampai ada yang menggambar ulang.
- **Beberapa RPC masih mencetak nomor dada mentah** di pesan galatnya
  (`nomor dada % tidak dikenal` di `catat_closing` dan `pindah_kloter`, antara
  lain), padahal di layar selalu tiga digit. Migrasi `0020` baru membetulkan
  `berangkatkan_kloter`; sisanya menunggu karena tiap perbaikan menuntut
  seluruh badan fungsinya disalin ulang.
- **Halaman live publik belum ada.** `live.html` + `live.json` di
  `rancangan-b.md` bagian 7 tidak pernah dibangun, dan tidak ada workflow yang
  menghasilkannya.
- **Upload massal nilai belum ada.** `rancangan-b.md` bagian 6 menjelaskan
  jalur tempel-dari-Excel lengkap dengan layar preview. Yang sudah dibangun
  baru input tabelnya (`#/pos`) — yang sebenarnya sudah menutup sebagian besar
  kebutuhannya, karena satu layar memuat seluruh lembar sekaligus. RPC-nya
  (`simpan_nilai_massal`) memang sudah menerima banyak baris sekaligus, jadi
  yang kurang hanya pengurai tempelan dan preview-nya.
- **Nama Pos 5 masih "Pos 5".** Lembar penilaiannya tidak ada di antara yang
  diserahkan panitia, jadi migrasi `0024` sengaja tidak menebak nama maupun
  komponennya. Pos 5 akan tampil di layar Input Pos sebagai pos tanpa kolom
  penilaian sampai diisi.
- **Dua sel di lembar XXXVI tidak cocok dengan rumusnya sendiri** (Pos 3 regu
  016 tertulis 380, rumus memberi 355; Pos 4 regu 009 tertulis 100, rumus
  memberi 80). 75 dari 77 baris yang bisa dibaca cocok tanpa sisa, jadi
  keduanya kemungkinan ketikan tangan di atas formula. Konfigurasi mengikuti
  rumusnya.
