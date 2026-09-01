# Sekolah yang belum tuntas

Sembilan belas dari 210 baris di `tools/data/sekolah_alamat.json` belum bisa
dipakai apa adanya. Halaman ini daftar kerjanya: apa yang kurang, kenapa, dan
apa yang harus ditanyakan.

Cara membacanya sudah ditentukan urutannya — **diurutkan menurut jumlah
peserta**, karena itu yang menentukan seberapa mahal kalau salah. Sekolah
dengan 16 peserta yang alamatnya keliru berarti 16 anak yang undangannya
nyasar; yang 1 peserta, satu.

Cara menyusun daftar ini dari nol ada di [`runbook-sekolah.md`](runbook-sekolah.md).
Yang di bawah ini sisanya.

---

## Cara memakainya

1. Hubungi pembina yang mendaftarkan regunya. Pertanyaannya sudah ditulis di
   kolom paling kanan — salin apa adanya, jangan diringkas jadi "sekolahnya
   yang mana ya?", karena yang membuat pertanyaan ini bisa dijawab cepat justru
   karena kedua pilihannya disebutkan.
2. Perbaiki barisnya di `tools/data/sekolah_alamat.json`: isi/ganti field yang
   perlu, naikkan `keyakinan` jadi `tinggi`, dan tulis di `catatan` bahwa
   jawabannya dari pembina — sebutkan tanggalnya.
3. **Hapus barisnya dari halaman ini di commit yang sama.**
   `tools/periksa_sekolah.py` membandingkan daftar ini dengan isi datanya dan
   gagal kalau keduanya tidak cocok — tapi ia tidak jalan sendiri. Sejak
   `shared-files.yml` cuma `workflow_dispatch`, tidak ada pemicu otomatis
   yang membacanya, jadi jalankan `python tools/periksa_sekolah.py` di laptop
   sebelum membuka PR. Pemeriksaannya disengaja: daftar kerja yang tidak ikut
   menyusut berhenti dipercaya, lalu berhenti dibaca.

---

## A. Sekolahnya sendiri belum pasti

Ini yang tidak akan selesai dengan mencari lebih keras. Datanya sudah disisir;
yang kurang satu kalimat dari orang yang tahu.

| Sekolah | Peserta | Kenapa belum tuntas | Yang ditanyakan ke pembina |
| --- | ---: | --- | --- |
| **MTsN 2 Ciamis** | 16 | Alamat yang ditulis peserta, `Jl. Raya Ciamis-Banjar KM 3 No. 141`, adalah **alamat MTs PUI Cijantung** di Kec. Cijeungjing. MTsN 2 Ciamis ada di Kec. Lumbung, jauh dari situ. Yang terisi sekarang alamat resmi MTsN 2. | "Regunya dari MTsN 2 Ciamis di Lumbung, atau dari MTs PUI Cijantung di Cijeungjing?" |
| **MTs Rancah** | 13 | Kec. Rancah punya **tujuh MTs**: MTsN 5, 14, 17 Ciamis, MTs Rancah, MTs Karangpari, MTs Al-Istiqomah Kiarapayung, MTs GUPPI Cileungsir. Dipilih MTs Rancah karena namanya persis dan ada di Desa Rancah. | "MTs-nya yang di Desa Rancah, atau salah satu MTs Negeri di Kec. Rancah? Kalau negeri, nomor berapa?" |
| **MA Agrowisata Shaleha** | 11 | **Tidak punya NPSN.** MA ini di bawah Kemenag/EMIS, bukan Dapodik, jadi tidak ada di Data Referensi. Alamat dan kode posnya dipinjam dari SLB Agrowisata Shaleha (NPSN 20263112) yang satu kompleks yayasan. | "Berapa NPSN MA-nya, dan alamat suratnya sama dengan SLB yang sekompleks?" |
| **SMK Darul Ilmi Panawangan** | 6 | Tidak ada di daftar SMK Kec. Panawangan, dan NPSN 69948102 dijawab **"NPSN TIDAK DITEMUKAN"** oleh Data Referensi. Alamat yang terisi dari cermin Dapodik. Kemungkinan sekolah baru yang belum sinkron, atau NPSN-nya berganti. | "NPSN sekolahnya yang sekarang berapa? Yang kami punya (69948102) sudah tidak ketemu di data Kemendikdasmen." |
| **SMA Terpadu Riyadlul Ulum** | 4 | Alamat yang ditulis peserta berbeda dengan alamat sekolah yang ditemukan. Bisa alamat sekretariat atau rumah pembina, bisa juga sekolah yang dimaksud memang lain. | "Alamat surat sekolahnya yang mana? Yang ditulis di formulir beda dengan alamat resmi sekolah." |
| **SMP Al Irsyad Al Islamiyyah Purwokerto** | 2 | **Dua sekolah di bawah satu yayasan** di Purwokerto, dan belum jelas yang mana. | "SMP Al Irsyad yang mana — sebutkan alamatnya, karena ada dua di Purwokerto." |
| **SMA Binaul Ummah** | 2 | Peserta menulis "Ciamis", tapi satu-satunya SMA bernama Binaul Ummah di seluruh Dapodik ada di **Kec. Cigugur, Kab. Kuningan**. Kemungkinan besar salah tulis kabupaten. | "Sekolahnya di Kuningan, ya? Kami tidak menemukan SMA Binaul Ummah di Ciamis." |
| **MAN 1 Sukabumi** | 2 | Ada dua: **MAN 1 Sukabumi** (NPSN 20280416, Kec. Cibadak, Kab. Sukabumi) dan **MAN 1 Kota Sukabumi** (NPSN 20277177, Kec. Citamiang). Petunjuk peserta cuma "Sukabumi". | "MAN 1 Sukabumi yang di Cibadak, atau MAN 1 Kota Sukabumi?" |
| **MA Darul Huda** | 2 | **Dua kandidat**: MA Darul Huda dan MAS Daarul Huda (NPSN 20277089). | "MA Darul Huda yang mana — sebutkan kecamatannya." |
| **SMA Plus Assyfa** | 1 | Nama resminya **SMAS IT As-Syifa Boarding School** di Jalancagak, Subang. Kata "Plus" tidak ada di nama resminya, jadi belum pasti ini sekolah yang sama. | "Sekolahnya SMA IT As-Syifa Boarding School di Jalancagak, Subang?" |
| **MTs Rijalul Ulum** | 1 | Nama resminya **"Riyadlul Ulum"**, bukan "Rijalul Ulum" — tidak ada madrasah bernama Rijalul Ulum di Kab. Ciamis. Daftar Pokjawas Kemenag menulis alamat yang persis sama, jadi hampir pasti salah tulis. | "Nama madrasahnya MTs Riyadlul Ulum, ya? Alamatnya sudah cocok." |
| **MA Al-Ishlah** | 1 | **Dua kandidat**: MA Al Islah (Kec. Cihaurbeuti) dan MA Ma'arif NU Al-Islah (NPSN 60728058, Kec. Banjaranyar). | "MA Al-Ishlah yang di Cihaurbeuti, atau yang Ma'arif NU di Banjaranyar?" |

---

## B. Sekolahnya belum ketemu sama sekali

**Kosong.** Dua baris yang pernah ada di sini dihapus 30 Agustus 2026, keputusan
pemilik acara:

- **`SMPN 1 Kalijaya`** — ditulis satu peserta di edisi XXXIV dan tidak pernah
  cocok dengan sekolah mana pun di Kemendikdasmen. Kalijaya nama desa, dan ada
  empat.
- **`SMK Nusantara 1 Bekasi`** — ditulis satu peserta, dan nama serta alamatnya
  saling bertentangan: Jl. Kapten Tendean tidak ada di Kota maupun Kab. Bekasi,
  dan kelima SMK bernama "Nusantara 1" yang terdaftar tidak ada yang cocok
  alamatnya.

Keduanya tidak ikut edisi XXXVII, dan keduanya sudah disisir dari sisi alamat,
bukan cuma dari sisi nama. Barisnya dibuang dari `sekolah_nama.json` maupun
`sekolah_alamat.json`.

> **Satu akibat yang perlu diketahui.** Kedua berkas itu asalnya dari
> `normalize_sekolah.py` atas spreadsheet edisi lama, jadi **menjalankan ulang
> skrip itu akan memunculkan keduanya kembali**. Kalau itu terjadi, hapus lagi
> — jangan dicari lagi.

Bagian ini sengaja tidak dihapus meski kosong, begitu juga daftar
`BELUM_KETEMU` di `tools/periksa_sekolah.py`. Keduanya satu-satunya cara
menandai "sekolah ini memang tidak punya alamat"; tanpa itu, baris tanpa alamat
berikutnya dilaporkan sebagai cacat dan seseorang menghabiskan setengah hari
mencarinya lagi.

---

## C. Sekolahnya pasti, kode posnya yang disengketakan

| Sekolah | Peserta | Kenapa belum tuntas | Yang ditanyakan |
| --- | ---: | --- | --- |
| **SMPN 1 Purwadadi** | 3 | Tiga sumber, tiga angka untuk Desa Karangpaningal: **46385** (cermin Dapodik dan kodeposina — ini yang dipakai), 46380 (nomor.net), 46286 (Pos Indonesia). | Tanyakan kode pos surat ke sekolahnya langsung. |
| **SMP Islam Bahrul Ulum** | 1 | Desa Gunungsari, Kec. Sukaratu: **46415** (dipakai) lawan 46452 (Pos Indonesia). | Tanyakan kode pos surat ke sekolahnya langsung. |

> **Banjarsari dan Banjaranyar dulu satu kecamatan, dan cermin Dapodik belum
> semuanya menyusul.** Banjaranyar mekar dari Banjarsari tahun 2015; desa yang
> ikut pindah memakai **46384**, bukan 46383. Dua baris kurasi sempat tidak
> sepakat soal ini — `SMAN 2 Banjarsari` (Desa Cigayam, Kec. Banjaranyar)
> memakai 46383 sementara `SMPN 6 Banjarsari` (Desa Cikupa, kecamatan yang
> sama) memakai 46384 — dan justru ketidaksepakatan itu yang membuat
> kesalahannya terlihat. Migrasi `0159` membetulkan yang pertama jadi 46384,
> jadi keduanya sekarang sepakat. Cerminnya belum tentu ikut, jadi yang
> menyentuh kode pos Banjaranyar berikutnya tetap harus memeriksa desanya
> dulu.
>
> Catatan ini dulu menempel pada baris `SMPN 1 Kalijaya` di bagian B. Barisnya
> dihapus; peringatannya tidak.


Kenapa tidak diambil saja yang dari Pos Indonesia, padahal merekalah yang
menerbitkan kode pos: karena untuk sederet kecamatan Ciamis selatan direktori
mereka menjawab berbeda dari **semua** sumber lain sekaligus, termasuk dari
alamat yang dicetak sekolahnya sendiri. Alasan lengkapnya di
[`runbook-sekolah.md`](runbook-sekolah.md) bagian 9.

---

> **`MTsN 1 Ciamis` diputuskan 30 Agustus 2026: 46211.** Situs resmi sekolahnya
> menulis 46251, tetapi desanya Panyingkiran, dan dua direktori kode pos yang
> berbeda sama-sama menulis 46211 untuk desa itu. Yang menguatkan: kode pos
> tiap desa di Kec. Ciamis cocok dengan direktori **tanpa kecuali** — Ciamis
> 46211, Kertasari 46213, Maleber 46214, Sindangrasa 46215, Linggasari 46216,
> Imbanagara 46219 — delapan belas baris kurasi waktu itu, dua puluh sekarang
> (`0156` menambah SMK LPS 1 dan 2 di Maleber). Angka 46251 tidak ada di Kec.
> Ciamis, dan juga tidak di Sindangkasih (46268) maupun Cikoneng (46261) yang
> bersebelahan.
>
> `tests/sql/107` menjaga 46251 tidak diam-diam kembali.

---

## D. Sudah beres, tinggal labelnya

Lima baris ini `keyakinan`-nya masih `sedang` dengan alasan "kode pos bukan
dari sumber resmi". Alasan itu **sudah tidak berlaku**: kode posnya kemudian
dikonfirmasi lewat direktori kode pos per desa, dan tidak ada yang
bertentangan dengan sekolah lain di kecamatan yang sama.

| Sekolah | Peserta | Kode pos |
| --- | ---: | --- |
| **MTs Ar-Rahman** | 4 | 46261 |
| **MA Al-Kautsar** | 3 | 46318 |
| **SMA Islam Nurul Fikri** | 3 | 42167 |
| **SMA Plus Ibnu Sina** | 2 | 16698 |
| **MTs At-Tabiyah** | 1 | 46256 |

Tidak ada yang perlu ditanyakan ke siapa pun — cukup ganti `keyakinan` jadi
`tinggi` dan hapus barisnya dari sini. Dipisahkan ke bagian sendiri supaya
tidak tercampur dengan yang benar-benar butuh jawaban orang.

---

## E. Sekolah baru dari pendaftaran XXXVII

**Ketiga belasnya sudah dicari, 30 Agustus 2026.** Bagian ini dulu daftar
kerja; sekarang catatan hasilnya, dan judulnya tetap berdiri karena
`tools/periksa_sekolah.py` memotong pemeriksaannya di sini — yang di bawah
judul ini bukan daftar kerja atas `sekolah_alamat.json`.

Alamatnya dipasang ke produksi lewat migrasi `0154`, bersama tujuh sekolah
XXXVII lain yang alamatnya sudah terisi tapi belum baku, dan enam baris kembar
yang dilebur. Semuanya sekarang punya baris di `sekolah_nama.json` maupun
`sekolah_alamat.json`, lengkap dengan NPSN dan URL sumbernya.

**Yang paling mahal kalau salah, dan hampir salah.** `MA Mujahidin` dan
`MTs Mujahidin` punya DUA kandidat yang sama-sama meyakinkan: satu yayasan
MA+MTs di Kec. Cipaku Kabupaten Ciamis, dan satu lagi di Kec. Sukaratu
Kabupaten **Tasikmalaya**. Pencarian tidak bisa memilih — yang memilih kolom
kwartir ranting di form pendaftaran, yang kebetulan sudah disalin ke tabel di
atas sebelum dihapus: "Cipaku / Ciamis". Sepuluh regu, dan tanpa kolom itu
suratnya menyeberang kabupaten.

Kolom petunjuk itu **bukan alamat** — runbook bagian 1 menyebutnya arah, bukan
sumber kebenaran. Tetapi sebagai pemilih di antara dua alamat yang sama-sama
resmi, ia persis yang dibutuhkan. Simpan kolomnya untuk edisi berikutnya.

Tiga di antaranya sempat pindah ke bagian A, dan ketiganya sudah selesai juga
30 Agustus 2026 — bukan oleh pembina, melainkan oleh pemilik acara: desa
`MA Bahrul Anwar` dikonfirmasi Mekarsari (Dapodik mengosongkannya), lalu
`MA Adzkia` dan `SMA IT Nurul Huda` dibenarkan satu tempat dengan MTs/SMP
saudaranya. Ketiganya `tinggi` sekarang dan sudah tidak ada di bagian A. Dua
yang terakhir memang tetap tanpa NPSN; itu bukan cacat, melainkan sebabnya
keduanya didaftar di `TANPA_NPSN` pada `tools/periksa_sekolah.py`.

**`SMK Lps Ciamis` sudah terjawab, 30 Agustus 2026.** Di Jl. R.E. Martadinata
No. 23 memang ada dua sekolah — SMK LPS 1 (NPSN 20211529) dan SMK LPS 2
(NPSN 20251831), satu alamat dan satu desa. Tidak ada data yang bisa memilih;
pemilik acara yang menjawab: yang mendaftar **LPS 1**. Migrasi `0156`
melengkapi angkanya dan sekalian mendaftarkan LPS 2, supaya angka itu punya
lawan — nama pembeda yang berdiri sendiri tidak membedakan apa pun
(CLAUDE.md 12.8).

### Yang masih tersisa dari XXXVII

| Sekolah | Regu | Kenapa belum tuntas | Yang ditanyakan ke pembina |
| --- | ---: | --- | --- |
| **SMP AL Fadliliyah Darussalam** | 0 | Tidak ada SMP di kompleks Darussalam menurut Data Referensi — yang ada MTs Al-Fadliliyah Darussalam, dan alamat yang diketik pembina memang alamat MTs itu. Nol regu, jadi tidak mendesak. | "Regunya dari MTs Al-Fadliliyah Darussalam, atau memang ada SMP-nya?" |
| **SMAN 1 Majalengka** | 0 | Alamatnya sudah berbentuk baku dan tidak ada yang salah; ia cuma belum punya baris di daftar kurasi. Nol regu. | — tidak perlu ditanyakan |

---

## Yang bukan soal sekolah

**`SMK Bhakti Kencana` masih satu klaster berisi dua sekolah** — satu di Kota
Banjar (NPSN 60726572), satu di Kab. Ciamis (NPSN 20254625). Alamat keduanya
sudah benar dan terpisah di `sekolah_alamat.json`; yang belum terpisah
klasternya di `sekolah_nama.json`, karena memisahkannya butuh hitungan peserta
per baris pendaftaran — dan itu ada di keempat berkas `.xlsx` yang tidak
disimpan di repo.

Jalankan `tools/normalize_sekolah.py` dari direktori berisi keempat berkas itu.
Hasilnya akan memunculkan klaster ketiga bernama `SMK Bhakti Kencana` polos,
dari dua baris peserta yang tidak menyebut daerahnya — salah satunya
berpetunjuk `Jl. Ir. H. Juanda`, yang bukan alamat kedua sekolah itu.
Tanyakan yang itu ke pembinanya.
