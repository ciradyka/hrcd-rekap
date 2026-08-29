# Sekolah yang belum tuntas

Duapuluh tiga dari 212 baris di `tools/data/sekolah_alamat.json` belum bisa
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
   gagal di CI kalau keduanya tidak cocok. Itu disengaja: daftar kerja yang
   tidak ikut menyusut berhenti dipercaya, lalu berhenti dibaca.

---

## A. Sekolahnya sendiri belum pasti

Ini yang tidak akan selesai dengan mencari lebih keras. Datanya sudah disisir;
yang kurang satu kalimat dari orang yang tahu.

| Sekolah | Peserta | Kenapa belum tuntas | Yang ditanyakan ke pembina |
| --- | ---: | --- | --- |
| **MA Adzkia** | 2 | **Tidak punya NPSN.** Yang terdaftar di Data Referensi cuma MTs-nya (NPSN 69976289). Alamatnya dipinjam dari MTs itu, dan kebetulan cocok persis dengan yang diketik pembina sendiri. | "Berapa NPSN MA-nya, dan alamat suratnya sama dengan MTs yang sekompleks?" |
| **SMA IT Nurul Huda** | 1 | **Tidak ada SMA bernama ini di Data Referensi.** Yang terdaftar SMP IT Nurul Huda (Pamarican dan Panjalu) dan MA Nurul Huda (Kawali). Petunjuk kwartir rantingnya "Pamarican", jadi alamatnya dipinjam dari SMP IT Nurul Huda Margajaya (NPSN 69993153). | "Sekolahnya SMA yang sekompleks dengan SMP IT Nurul Huda di Margajaya, Pamarican? Berapa NPSN-nya?" |
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

Kolom alamatnya sengaja dibiarkan kosong. Dua-duanya sudah disisir dari sisi
alamat, bukan cuma dari sisi nama.

| Sekolah | Peserta | Kenapa belum tuntas | Yang ditanyakan ke pembina |
| --- | ---: | --- | --- |
| **SMK Nusantara 1 Bekasi** | 1 | Jl. Kapten Tendean tidak ada di Kota maupun Kab. Bekasi. Di Jl. Kapten Tendean Jakarta Selatan tidak ada sekolah menengah. Kelima SMK bernama "Nusantara 1" yang terdaftar (Ciputat, Kota Tangerang, Jakarta Utara, Comal, Kotabumi) alamatnya tidak ada yang cocok. Nama dan alamatnya saling bertentangan. | "Nama persis sekolahnya apa, dan di kota mana? Data yang kami punya tidak cocok satu sama lain." |
| **SMPN 1 Kalijaya** | 1 | Tidak ada sekolah bernama itu di Kemendikdasmen. Kalijaya nama **desa**, dan ada empat. Kandidat terkuat **SMPN 5 Banjarsari** di Desa Kalijaya, Kec. Banjaranyar, Ciamis — satu-satunya SMP negeri di sebuah Desa Kalijaya di wilayah Ciamis. Namanya tidak cocok, jadi sengaja tidak diisikan. | "Sekolahnya SMPN 5 Banjarsari di Desa Kalijaya, Kec. Banjaranyar — atau bukan?" |

Kalau jawabannya SMPN 5 Banjarsari, **kode posnya 46384, bukan 46383**.
Banjaranyar mekar dari Banjarsari tahun 2015 dan cermin Dapodik masih memakai
kode lama.

---

## C. Sekolahnya pasti, kode posnya yang disengketakan

| Sekolah | Peserta | Kenapa belum tuntas | Yang ditanyakan |
| --- | ---: | --- | --- |
| **MTsN 1 Ciamis** | 6 | Situs resmi sekolahnya menulis **46251**; desanya Panyingkiran, dan dua direktori berbeda sama-sama menulis **46211** — keduanya juga menyebut rentang Kec. Ciamis 46211-46219, yang tidak memuat 46251. Delapan belas sekolah kurasi lain di kecamatan itu semuanya cocok dengan direktori. Yang dipakai **46211**. | "Kode pos surat madrasahnya 46211 atau 46251? Situs sekolah dan direktori kode pos berbeda." |
| **SMPN 1 Purwadadi** | 3 | Tiga sumber, tiga angka untuk Desa Karangpaningal: **46385** (cermin Dapodik dan kodeposina — ini yang dipakai), 46380 (nomor.net), 46286 (Pos Indonesia). | Tanyakan kode pos surat ke sekolahnya langsung. |
| **SMP Islam Bahrul Ulum** | 1 | Desa Gunungsari, Kec. Sukaratu: **46415** (dipakai) lawan 46452 (Pos Indonesia). | Tanyakan kode pos surat ke sekolahnya langsung. |

Kenapa tidak diambil saja yang dari Pos Indonesia, padahal merekalah yang
menerbitkan kode pos: karena untuk sederet kecamatan Ciamis selatan direktori
mereka menjawab berbeda dari **semua** sumber lain sekaligus, termasuk dari
alamat yang dicetak sekolahnya sendiri. Alasan lengkapnya di
[`runbook-sekolah.md`](runbook-sekolah.md) bagian 9.

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

Tiga di antaranya tidak selesai penuh dan pindah ke bagian A: `MA Bahrul
Anwar` (desanya dikosongkan Dapodik), `MA Adzkia` dan `SMA IT Nurul Huda`
(tidak punya NPSN). Ketiganya sudah punya alamat yang bisa dipakai berkirim
surat; yang kurang cuma satu kalimat dari pembina.

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
