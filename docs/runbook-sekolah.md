# Runbook: membakukan nama dan alamat sekolah

Cara menyusun daftar sekolah untuk tabel `sekolah` dari database peserta
edisi-edisi sebelumnya. Ditulis setelah dikerjakan sekali untuk HRCD XXXVII,
memakai empat berkas Excel HRCD XXXIII–XXXVI.

Dokumen ini merekam **yang benar-benar dilakukan**, termasuk yang salah dulu
baru betul. Dua bagian khusus untuk itu, dan keduanya lebih berguna dibaca
sebelum mulai daripada sesudah: **bagian 9** untuk jebakan waktu menyusun
daftarnya, **bagian 12** untuk jebakan waktu memasangnya ke database.

---

## 1. Kenapa daftar ini ada

Form pendaftaran memuat autocomplete sekolah yang berjalan **di browser**:
seluruh tabel `sekolah` dimuat sekali, lalu disaring dengan `cariSekolah()`
(`live/js/school-search.mjs`, dipanggil dari `live/js/daftar.js`). Instan,
tanpa permintaan server per huruf.

Penyaringnya **per kata, bukan per potongan**: tiap kata yang diketik cukup
jadi awalan salah satu kata di nama sekolah, jadi "SMA 2" menemukan
"SMAN 2 Ciamis". Satu kata ketikan juga boleh merapatkan beberapa kata
sekaligus — "Almut" menemukan "SMA Al-Muttaqin" — karena nama di daftar ini
penuh partikel dua huruf yang tidak pernah diberi jeda waktu diucapkan. Sampai 27 Agustus 2026 ia menuntut ketikan menjadi potongan
utuh dari namanya — dan huruf `N` yang tidak diucapkan siapa pun membuat
sekolah yang jelas-jelas ada di daftar seolah tidak terdaftar. Yang lahir dari
situ baris kembar, yang persis dicegah seluruh runbook ini.

Isinya sekolah yang **benar-benar pernah ikut HRCD**, dan itulah gunanya —
mereka yang diprioritaskan diundang lagi tahun berikutnya. Pembina yang
sekolahnya belum terdaftar tetap bisa menambahkan sendiri lewat form; jalur itu
sudah ada dan harus tetap ada.

**Alamat di spreadsheet lama BUKAN sumber kebenaran.** Ia diketik peserta di
formulir, terburu-buru, sering hanya nama kota ("CIAWI", "Banjar") dan satu
kali cuma `\`. Ia dipakai sebagai **petunjuk arah** untuk menemukan sekolah
yang benar — terutama untuk membedakan dua sekolah bernama sama di kabupaten
berbeda — lalu dibuang.

---

## 2. Sumber dan cara membacanya

Empat berkas, dan **nama sheet serta nama kolomnya berbeda-beda**:

| Edisi | Sheet | Kolom sekolah | Kolom alamat |
| --- | --- | --- | --- |
| XXXIII | `Data Utama` | `Asal Sekolah` | `Alamat Sekolah` |
| XXXIV | `Pendaftaran` | `Asal Sekolah` | `Alamat Sekolah` |
| XXXV | `Pendaftaran` | `Asal Sekolah / Organisasi` | `Alamat Sekolah` |
| XXXVI | `Pendaftaran` | `Asal Sekolah / Organisasi` | `Alamat Sekolah` |

Jangan menebak nama kolom. Cetak dulu `pd.ExcelFile(f).sheet_names` dan
`df.columns` tiap berkas; XXXV mengganti judul kolomnya dan XXXIII memakai
sheet dengan nama lain sama sekali.

Totalnya 1.254 baris peserta.

---

## 3. Buang yang bukan sekolah

151 baris dari 1.254 bukan nama sekolah. Empat jenis, semuanya harus keluar:

1. **Nama kelas** — `X MIPA 1`, `12 ips 4`, `10 IPS 5` (71 nama, 126 baris).
   Hanya muncul di XXXV dan XXXVI, dan itu petunjuknya: ini kontingen **tuan
   rumah**, SMA Negeri 1 Ciamis (`docs/alur-lomba.md` bagian 34), yang menulis
   kelasnya alih-alih sekolahnya. Tidak ada yang hilang dengan membuangnya —
   SMAN 1 Ciamis sudah ada di daftar dengan namanya sendiri.
2. **Organisasi dan ekstrakurikuler** — OSIS, MPK, KIR, FORSA, Nuansa,
   Paskibra, Pramuka, Saka Wanabakti.
3. **Bercanda** — `SMKN 1 Hogwarts`, `oxford university`, `SMA 7 MARS`,
   `SMAN 10 Oplas`, `SMAN 1 Oke`, `Contoh`.
4. **Alamat yang nyasar ke kolom sekolah** — satu baris berbunyi
   `Jl. Jendral Sudirman no.241`.

Pola pembuangnya ada di `tools/normalize_sekolah.py`, fungsi `bukan_sekolah()`.

---

## 4. Bakukan nama jenjangnya

Aturannya satu kalimat: **tulis seperti yang diucapkan orang** (CLAUDE.md 5.7).

| Ditulis peserta | Jadi |
| --- | --- |
| `SMP NEGERI 1 LELEA`, `SMP N 1 Lelea` | `SMPN 1 Lelea` |
| `SMK Negeri 2 Banjar`, `SMK N 2 Banjar` | `SMKN 2 Banjar` |
| `MA NEGERI 6 TASIKMALAYA` | `MAN 6 Tasikmalaya` |
| `MTSN 2 CIAMIS`, `MTS N 2 Ciamis` | `MTsN 2 Ciamis` |
| `MTSS RANCAH`, `MTS Rancah`, `Mts.Rancah` | `MTs Rancah` |
| `MAS PUI CIJANTUNG` | `MA PUI Cijantung` |
| `SMKS PGRI JATIBARANG` | `SMK PGRI Jatibarang` |
| `SMAS PLUS DARUSSALAM` | `SMA Plus Darussalam` |
| `SMPT`, `SMP T`, `SMA (terpadu)` | `SMP Terpadu`, `SMA Terpadu` |
| `Ambalan Khalid bin Walid MAN 5 Ciamis` | `MAN 5 Ciamis` |
| `Madrasah Aliyah BKMU Cikijing` | `MA BKMU Cikijing` |

Akhiran **S** (`SMAS`, `SMKS`, `MAS`, `MTsS`) menandai swasta di Dapodik dan
tidak pernah diucapkan siapa pun — dibuang. Akhiran **N** untuk negeri
dipertahankan, karena itu justru yang diucapkan.

`Al-`, `Ar-`, `El-` adalah **bagian nama diri**, bukan kata sambung: ditulis
kapital. `Al-Hasan`, bukan `al-Hasan`.

---

## 5. Gabungkan ejaan yang berbeda

Kunci penggabungan (`kunci()`) membuang huruf besar-kecil, tanda baca, kata
`Kabupaten`/`Kota`, dan menyeragamkan ejaan yayasan yang beredar dalam beberapa
bentuk (`fadliliyah` ~ `fadilliyah` ~ `fadiliyah`, `maarif` ~ `ma'arif`,
`assalimiyah` ~ `asalimiah` ~ `assalamiyah`).

Ekor nama daerah dibuang **hanya bila kata terakhir dan sisanya masih ≥ 3
kata**, supaya `SMPN 1 Lelea Indramayu` bertemu `SMPN 1 Lelea` tanpa membuat
`SMKN 1 Ciamis` runtuh jadi `SMKN 1`.

> **Dan hanya bila ekornya tidak membedakan apa-apa.** `SMK Bhakti Kencana
> Banjar` dan `SMK Bhakti Kencana Ciamis` adalah dua sekolah, dan yang
> membedakan cuma ekor itu; membuangnya melebur keduanya tanpa suara. Nama
> seperti ini didaftar di `EKOR_MEMBEDAKAN`, dan ada pemeriksaan di ujung
> `normalize_sekolah.py` yang gagal keras begitu muncul kasus baru — satu nama
> dengan dua ekor berbeda. Jangan matikan pemeriksaan itu; daftarkan namanya.

> **Yang TIDAK boleh digabung: jenjang yang berbeda.**
> `MA PUI Cijantung` dan `MTs PUI Cijantung` satu yayasan, satu halaman, dan
> **dua sekolah**. Begitu juga MTs/MA El-Bas, MTs/MA Assalimiyah, dan MTs
> Rijalul Hikam terhadap MA-nya.

Nama tampil dipilih dari ejaan yang **paling sering**; bila seri, yang paling
panjang — itu yang paling informatif.

**Kalau yang paling sering ternyata menyimpang, aturannya: pakai nama yang
biasa diucapkan, sedekat mungkin dengan nama resminya.** Dua kata itu bekerja
berpasangan, dan urutannya penting — "biasa diucapkan" duluan.

- `MTs Al-Fadilliyah` → `MTs Al-Fadliliyah`. Peserta menulis tiga ejaan
  (`Fadliliyah`, `Fadilliyah`, `Fadiliyah`) dan yang paling sering kebetulan
  bukan yang benar. Dapodik menulis `Fadliliyah`. Ini yang masuk `NAMA_TANGAN`.
- `MAN Darussalam` **tetap** `MAN Darussalam`, walau resminya `MAN 1 Ciamis` —
  tidak ada satu orang pun yang menyebutnya begitu. Kedekatan ke nama resmi
  tidak boleh sampai membuat namanya asing.
- `SMKN Manonjaya` **tetap** tanpa angka. Sempat dikira nama resminya
  `SMKN 1 Manonjaya`; Dapodik ternyata mencatatnya `SMKN MANONJAYA`. Periksa
  dulu sebelum menambahkan angka.

### Yang menentukan sekolah itu satu atau dua adalah NPSN — bukan namanya

Nama boleh sama; NPSN tidak pernah. **NPSN dicek hanya kalau benar-benar
ragu** — bukan untuk 189 sekolah satu per satu, tapi untuk yang namanya
mencurigakan mirip. Begitu dua NPSN berbeda, itu dua sekolah, titik, dan
tidak ada kesamaan alamat atau ejaan yang mengubahnya.

**Maka nama di database kita harus cukup jelas untuk berdiri sendiri.** Kalau
dua NPSN akan memakai nama tampil yang sama, nama itu diberi ekor kabupaten
atau kota:

| NPSN       | Nama tampil            |
|------------|------------------------|
| `20276449` | `MAN 3 Ciamis`         |
| `20276789` | `MAN 3 Tasikmalaya`    |
| `20280193` | `MAN 6 Ciamis`         |
| `20276775` | `MAN 6 Tasikmalaya`    |

Ini bukan gaya penulisan, dan ekornya bukan hiasan. Nama sekolah adalah yang
dibaca panitia di layar keberangkatan, dicetak di blangko, dan dicari pembina
di daftar. Dua sekolah bernama `MAN 3` di layar yang sama adalah kekeliruan
yang harus diurai orang di tengah pagi.

Aturannya berlaku dua arah, dan arah keduanya yang mudah terlewat: **kalau
tidak ada tabrakan, jangan tambahkan ekor.** `MAN Darussalam` hanya ada satu,
jadi ia tidak jadi `MAN Darussalam Ciamis` — bagian 5 sudah bilang kedekatan
ke nama resmi tidak boleh membuat nama jadi asing, dan ekor yang tidak
membedakan apa-apa melakukan hal yang sama. Ekor dipakai untuk memisahkan,
bukan untuk melengkapi.

`tools/periksa_sekolah.py` menjaganya dua-duanya: tidak boleh ada dua baris
bernama sama, dan tidak boleh ada NPSN kembar.

**Dan inilah yang membuat pagar kembar di database jadi sederhana.** Kalau
nama sudah dijamin membedakan sekolah sendirian, `alamat` tidak perlu ikut
jadi kunci — lihat bagian 11.

Nama resmi yang berbeda tetap disimpan di kolom `nama_resmi`
`sekolah_alamat.json`, jadi tidak ada yang hilang.

Hasil: **1.102 baris peserta → 201 klaster**, dari 326 tulisan mentah.
Penggabungan lewat NPSN di bagian 7 memangkasnya lagi jadi **189 sekolah**.

---

## 6. Cari alamat resminya

Petunjuk dari spreadsheet hanya titik berangkat. Alamat yang masuk database
harus datang dari sumber yang bisa diperiksa.

**Urutan sumber, dari yang paling bisa dipercaya:**

1. **Data Referensi Kemendikdasmen** —
   `referensi.data.kemendikdasmen.go.id/pendidikan/npsn/<NPSN>`. Punya NPSN,
   jalan, desa, kecamatan, kabupaten, kode pos.
2. `sekolah.data.kemdikbud.go.id`, `ban-pdm.id`, `data.sekolah-kita.net`
3. Situs resmi sekolah, atau daftar Google Maps
4. Situs pemerintah daerah

**Aturan yang tidak boleh dilanggar:**

- **Jangan mengarang kode pos.** Kalau tidak ketemu, kosongkan. Kode pos yang
  ditebak dari kecamatan tidak akan diperiksa siapa pun sampai ada surat
  nyasar.
- Simpan **NPSN** dan **URL sumbernya**. NPSN-lah yang membuktikan dua nama
  adalah satu sekolah (lihat bagian 7).
- Beri **keyakinan** tiap baris: `tinggi` (sumber resmi, yakin sekolahnya),
  `sedang` (sumber tidak resmi tapi meyakinkan), `rendah` (menebak atau tidak
  ketemu). Yang `rendah` tidak masuk database tanpa diperiksa manusia.
- Nama pada jawaban harus **persis** sama dengan nama yang dikirim; itu kunci
  penggabungannya. Nama resmi yang berbeda ditulis di kolom terpisah.

Nama resmi sering berbeda dari nama yang dipakai sekolahnya sendiri.
`MAN Darussalam` terdaftar sebagai **MAN 1 Ciamis**, tapi memakai domain
`mandarussalam.sch.id` dan menyebut diri MAN Darussalam. **Simpan nama yang
diucapkan orang** (CLAUDE.md 5.7) dan catat nama resminya di sebelahnya.

Pencariannya disebar: 200-an sekolah dibagi ke ~13 agen, masing-masing belasan
sekolah, hasilnya divalidasi lewat JSON Schema. Satu context tidak muat.

---

## 7. Temukan kembaran lewat NPSN

**Ini langkah yang paling banyak menemukan, dan paling mudah dilewatkan.**

Setelah semua alamat terkumpul, kelompokkan menurut **NPSN**. NPSN sama berarti
sekolah sama — bukan "mirip", bukan "kemungkinan besar", tapi sama, karena satu
sekolah cuma punya satu NPSN. Itu pemeriksaan yang tidak bisa diperdebatkan, dan
lebih tajam daripada mengelompokkan menurut `(jalan, kabupaten)`: alamat ditulis
tiap agen dengan gaya sendiri (`Jl. Raya Puskesmas` vs `Jl. Raya Puskesmas
Japara`) dan dua ejaan alamat yang beda satu kata terbaca sebagai dua tempat.

Pengelompokan menurut alamat tetap berguna untuk satu hal yang tidak bisa
dilakukan NPSN: menemukan **dua sekolah berbeda di satu kompleks**, yang harus
tetap terpisah.

- **NPSN sama → satu sekolah**, gabungkan
- **alamat sama + jenjang beda → dua sekolah**, biarkan

> **Menemukan kembar dan MENERAPKANNYA adalah dua pekerjaan.** Putaran pertama
> mengerjakan yang pertama, menuliskan hasilnya di dokumen ini, lalu berhenti —
> `sekolah_nama.json` tetap berisi kedua belah tiap pasang selama sebulan.
> Daftar kembar yang tidak dipakai persis sama nilainya dengan tidak pernah
> dicari. Gabungkan di berkasnya, di commit yang sama.

Cara ini menemukan dua belas pasang yang lolos dari penggabungan berbasis nama.
Sembilan yang pertama ketemu lewat alamat:

```
MAN Darussalam            = MAN 1 Darussalam           NPSN 20276451
MA Ar-Rahman              = MA Terpadu Ar-Rahman       NPSN 20276435
SMK Bhakti Kencana        = SMK Bhakti Kencana Ciamis  NPSN 20254625
SMKN Manonjaya            = SMKN 1 Manonjaya           Jl. Gunungtanjung KM 2,5
SMAN Pamanukan            = SMAN 1 Pamanukan           Jl. Eyang Tirtapraja No. 83
SMK Bina Putera Nusantara = ... Tasikmalaya            Jl. Sukarindik No. 63A
SMK Ma'arif Sabilunnajat  = ... Rancah                 Jl. Rancah-Karangpari
SMK Karnas Ciamis         = SMK Karya Nasional Sindangkasih
MA Rijalul Hikam          = MA YPI Rijalul Hikam       Jl. Raya Jatinagara No. 03
```

Dari sembilan itu, **dua bukan penggabungan sekolah melainkan baris ganda** —
`SMK Bhakti Kencana` dan `SMK Bina Putera Nusantara` masing-masing satu klaster
yang kebetulan dicari dua agen, jadi yang perlu dibuang barisnya, bukan
klasternya. Tujuh sisanya penggabungan betulan.

Lalu pengelompokan menurut NPSN menemukan lima lagi yang lolos dari
pengelompokan menurut alamat:

```
MTs Al-Fadliliyah      = MTs Al-Fadilliyah Darussalam   NPSN 20211978
SMP Al-Hasan           = SMP Terpadu Al Hasan Ciamis    NPSN 20238436
SMA Ar-Risalah         = SMA Terpadu Ar-Risalah         NPSN 20252464
SMP Terpadu Ar-Risalah = SMP Terpadu Arrisalah          NPSN 20211516
SMA IT Al-Falah        = SMA IT Al Falahjln             satu sekolah di Garut
```

`SMK Karnas` = **KAR**ya **NAS**ional. Tidak ada algoritma nama yang akan
menemukan itu; alamatnya yang menemukannya.

Delapan dari dua belas pasang ternyata bisa ditangkap aturan, bukan didaftar
tangan, dan aturannya sudah dipasang di `kunci()`:

- **`Terpadu` dibuang dari kunci.** Sekolahnya sendiri memakainya
  setengah-setengah: situs SMA Ar-Risalah menulis "SMA Terpadu Ar-Risalah",
  Dapodik menulis "SMAS AR RISSALAH". Nama tampil tetap memakainya.
- **Angka `1` pada sekolah negeri dibuang** — orang tidak menulisnya kalau di
  daerah itu cuma ada satu. `SMAN Pamanukan` = `SMAN 1 Pamanukan`. Hanya angka
  1; `SMKN 2 Banjar` tidak boleh runtuh jadi `SMKN Banjar`.
- **`ar risalah` ~ `arrisalah`** masuk `EJAAN_SAMA`, seperti `ar rahman` yang
  sudah ada.
- **Ekor `jln` dibuang** — itu kata pertama kolom alamat yang menempel ke nama.

Empat sisanya tinggal di `GABUNG_TANGAN`, karena memang tidak ada aturan yang
bisa menemukannya. Sebelum mengubah `kunci()`, **jalankan aturan barunya ke
seluruh daftar nama dan lihat tabrakan apa saja yang muncul** — keempat aturan
di atas dipasang setelah dipastikan tidak satu pun tabrakannya salah.

Dan yang bertabrakan tapi **benar terpisah**: `MTs Ar-Rahman` di Jl. Arrahman
No. **2** bukan `MA Ar-Rahman` di No. **01** — sebelah-sebelahan, beda jenjang.

Hasilnya: **201 klaster → 189 sekolah**.

---

## 8. Bentuk alamat yang disimpan

**Berkasnya menyimpan komponen, bukan kalimat.** `sekolah_alamat.json` punya
kolom `jalan`, `desa`, `kecamatan`, `kabupaten`, `provinsi`, `kode_pos`
terpisah — itu yang membuat alamatnya bisa diperiksa mesin (bagian 10) dan
dirakit ulang kalau bentuknya berubah. Kalimatnya baru dirakit saat dipasang
ke database:

```
Jl. Gunung Galuh No. 37, Ciamis, Kec. Ciamis, Kabupaten Ciamis, Jawa Barat 46211, Indonesia
```

Urutannya: jalan, desa, `Kec.` + kecamatan, kabupaten/kota, provinsi + kode
pos, `Indonesia`. Komponen yang kosong dilewati, bukan diganti tanda hubung.

- Tulis `Jl.` — bukan `Jalan`, `JL`, `Jln`. Tulis `No.` — bukan `no`, `Nomor`.
- **`Kabupaten` dan `Kota` ditulis penuh**, tidak diringkas. Kota Banjar dan
  Kabupaten Ciamis dua daerah berbeda, dan meringkas keduanya jadi "Banjar"
  dan "Ciamis" membuat sepasang alamat yang berjauhan terbaca mirip.
- Tanpa nama jalan: mulai dari desa — `Santing, Kec. Losarang, Kabupaten
  Indramayu, Jawa Barat 45253, Indonesia`.

**Kenapa panjang, padahal sebelumnya direncanakan pendek.** Rancangan awal
runbook ini memakai bentuk ringkas `Jl. Gunung Galuh No. 37, Ciamis 46211`.
Yang dipasang ke produksi bentuk penuh di atas, dan itu keputusan pemilik
repo — alamat ini dibaca pembina di kotak pilihan untuk memastikan sekolah yang
mereka pilih memang sekolah mereka, dan `Kec. Ciamis` lah yang menjawabnya,
bukan kode pos. Bentuk ini juga persis yang keluar dari Google Maps, jadi
pembina bisa membandingkannya sekali lihat.

Panjangnya memang berkonsekuensi di layar sempit. Itu diselesaikan di tempat
yang benar — cara menampilkan — bukan dengan memendekkan data. Alamat yang
sudah dipotong tidak bisa dipanjangkan lagi.

**Kalau sekolahnya memang tidak punya nama jalan, kolom `jalan` diisi dusun dan
RT/RW-nya** — `Dusun Cigoong RT 01 RW 01` — bukan dikosongkan. Banyak sekolah
begitu, dan Dapodik pun menulisnya begitu; 15 baris di berkasnya sudah memakai
bentuk ini. Mengosongkannya membuat alamat surat menyusut jadi nama desa saja,
padahal dusun itulah satu-satunya penunjuk di bawah level desa. Yang tetap
tidak boleh masuk ke kolom `jalan`: nama **desa** dan nama **kecamatan**, karena
keduanya sudah punya kolom sendiri dan menuliskannya dua kali bikin alamatnya
berulang.

Kabupaten tetap ditulis walau contoh aslinya tidak memakainya: 189 sekolah
tersebar di 24 kabupaten/kota, dan `Jl. Raya Timur No. 1, 46211` tidak menolong
pembina membedakan sekolahnya dari yang senama di sebelah.

---

## 9. Jebakan

**Jatah pencarian web habis di tengah jalan.** Satu sesi dibatasi 200
pencarian; 13 agen menghabiskannya sebelum separuh jalan, dan agen yang
kehabisan mengembalikan keyakinan `rendah` — yang terbaca seperti "sekolahnya
tidak ada" padahal artinya "alatnya habis". Naikkan **sebelum** mulai:

```
setx CLAUDE_CODE_MAX_WEB_SEARCHES_PER_SESSION 1200
```

**`args` workflow bisa sampai sebagai teks JSON, bukan array.** Kalau tidak
dijaga, `slice()` memotong per-huruf dan dua ratusan sekolah jadi 644 potongan omong
kosong. Selalu:

```js
const DATA = typeof args === 'string' ? JSON.parse(args) : args
if (!Array.isArray(DATA)) throw new Error('args bukan array')
```

**Regex pembakuan memakan spasi sesudahnya.** Tiga nama sempat menempel jadi
satu kata (`SMA TerpaduCIKANYERE`, `Mtsar-Rahman`, `MA Terpadu) Ar-Rahman`),
dan **tiap versi rusak berdiri sebagai sekolah tersendiri** — 201 sempat
terbaca 206. `\b` di ujung pola tidak menolong: `\s*` tetap memakan spasinya
dan `\b` tetap cocok di depan huruf berikutnya. Yang benar: kembalikan spasinya
lewat penggantinya (`r'\1 Terpadu '`) dan rapatkan spasi ganda di akhir.

Setelah mengubah pola pembakuan, **selalu jalankan pemeriksaan ini**:

```python
bad = [x["nama"] for x in hasil
       if re.search(r'[a-z][A-Z]', x["nama"].replace("MTsN", "MTSN"))
       or ")" in x["nama"]]
assert not bad, bad
```

**Cocokkan hasil pencarian dengan mengabaikan tanda baca.** `MTs Assalimiyah`
dan `MTs Assalamiyah` adalah klaster yang sama dengan nama tampil berbeda;
mencocokkan mentah-mentah membuatnya terhitung "belum dicari" padahal sudah.

**Agen bisa mencari dengan petunjuk milik sekolah lain — dan laporannya
terbaca persis seperti "sekolahnya memang tidak ada".** Ini jebakan yang paling
mahal di putaran pertama: tujuh dari tiga belas sekolah yang tersisa sebenarnya
sudah bisa diselesaikan hari itu juga, dan tertahan sebulan karena hal ini.
Contohnya, dengan petunjuk yang sebenarnya ada di `sekolah_nama.json`:

| Sekolah | Petunjuk yang sebenarnya | Yang dilaporkan agen |
| --- | --- | --- |
| SMPN 1 Purwadadi | `… Kec. Purwadadi, Kab. Ciamis` | "petunjuk peserta menulis Subang" |
| SMA Islam Nurul Fikri | `Serang Banten` | "petunjuk peserta menulis Bogor" |
| SMP Islam Bahrul Ulum | `Jl. Gunungbalong Kec. Sukaratu` | "petunjuk Ciamis tidak bisa memisahkan dua kandidat" |
| MA Al-Hasan | `dusun babakan kec baregbeg` | "BENTROK — yang ketemu di Baregbeg, bukan Banjarsari" |
| SMA IT Al-Falah | `… Kec. Bungbulang Kab. Garut` | "27 kecamatan Ciamis disisir, tidak ada" |
| SMA Terpadu Cikanyere | `Ds. Sirnabaya Kec. Rajadesa` | "tidak ada di Kec. Sukaresmi, Cianjur" |
| SMP IT Nurul Huda Margajaya | `Kec. Pamarican Kab. Ciamis` | "27 kecamatan dicek, tidak ketemu" |

Perhatikan bentuknya: agen **menyisir dengan rajin**, melaporkan berapa
kecamatan yang diperiksa, dan berhenti dengan keyakinan `rendah`. Semuanya
tampak seperti kerja yang tuntas. Yang salah bukan pencariannya — yang salah
petunjuk yang dibawa masuk.

Penangkalnya satu baris: **suruh agen mengembalikan petunjuk yang ia terima,
disalin apa adanya**, lalu cocokkan dengan `petunjuk_alamat` di
`sekolah_nama.json`. Yang tidak cocok berarti hasilnya tidak bisa dipakai,
apa pun isinya. Dan sebelum menyimpulkan sebuah sekolah "tidak ada", **baca
sendiri petunjuknya di `sekolah_nama.json`** — jangan percaya kutipan petunjuk
yang ada di dalam catatan agen.

**Kode pos bukan datanya Kemendikdasmen — tapi "sumber resmi" pun bisa
bertabrakan dengan kenyataan.** Halaman Data Referensi memang tidak pernah
memuat kolom kode pos; otoritasnya Pos Indonesia, per desa/kelurahan. Jadi
mencarinya di situ benar. Yang tidak diduga: untuk sederet kecamatan Ciamis
selatan, direktori Pos Indonesia mengembalikan angka yang **berbeda dari semua
sumber lain sekaligus** —

```
Banjarsari   Pos 46283   semua direktori lain, situs sekolah, dan peserta: 46383
Rancah       Pos 46292   ... 46387
Cisaga       Pos 46291   ... 46386
Purwadadi    Pos 46286   ... 46385
Pamarican    Pos 46282   ... 46382
```

Angka 463xx itu **runtut**: Cimaragas 46381, Pamarican 46382, Banjarsari 46383,
Padaherang 46384, Purwadadi 46385, Cisaga 46386, Rancah 46387, Parigi 46393,
Cijulang 46394 — kecamatan bersebelahan, nomor berurutan, dan tiap satu dicari
agen yang berbeda tanpa saling tahu. Yang paling menentukan: **MTs Al-Hasan
Banjarsari mencetak 46383 di situsnya sendiri**, dan peserta mengetik angka
yang sama. Satu bacaan atas formulir pencarian tidak cukup untuk menjatuhkan
itu semua.

Jadi aturannya: **kode pos baru hanya dipakai kalau tidak bertentangan dengan
sekolah lain di kecamatan yang sama.** Itu pembanding terkuat yang ada, karena
tumbuh dari pencarian yang berdiri sendiri-sendiri. Dan bedakan dua hal, karena
salah satunya sah:

- Kecamatan **satu kode untuk semua desa** — angka baru yang berbeda berarti
  salah satu sumber keliru. Tolak, kosongkan, jangan tebak.
- Kecamatan yang kodenya **beda tiap desa** — Kec. Banjar 46311–46318, Kec.
  Langensari 46341–46346, Kec. Ciamis 46211–46219. Di sini angka baru yang
  berbeda justru wajar. Terima **kalau agen mengutip skema penuhnya dan skema
  itu cocok** dengan kode desa lain yang sudah ada di berkas.

Yang tersisa dikosongkan, bukan ditebak. Alamat tanpa kode pos tetap sampai;
alamat dengan kode pos yang salah belum tentu.

**Petunjuk peserta bisa salah dan menggagalkan pencarian.** `SMA IT Al-Falah`
tidak ketemu karena petunjuknya "Ciamis"; baris kembarnya
(`SMA IT Al Falahjln` — "JLN" alamatnya menempel ke nama) membawa
`Raya Citalahab, Mekarjaya, Bungbulang, Garut`. Sekolahnya di **Garut**. Kalau
sebuah sekolah tidak ketemu, periksa dulu apakah ada baris lain dengan nama
mirip dan petunjuk yang lebih baik.

---

## 10. Berkas

| Berkas | Isi |
| --- | --- |
| `tools/normalize_sekolah.py` | langkah 2–5: baca Excel, buang non-sekolah, bakukan, kelompokkan |
| `tools/data/sekolah_nama.json` | 189 sekolah: nama baku, semua ejaan, jumlah peserta, petunjuk alamat |
| `tools/data/sekolah_alamat.json` | hasil pencarian alamat: NPSN, jalan, desa, kecamatan, kabupaten, kode pos, keyakinan, sumber |
| `tools/periksa_sekolah.py` | penjaga: kedua berkas di atas masih saling cocok, dan bentuk isiannya masih menuruti bagian 7 dan 8 |
| [`sekolah-belum-tuntas.md`](sekolah-belum-tuntas.md) | daftar kerja: 21 sekolah yang belum bisa dipakai, kenapa, dan apa yang ditanyakan ke pembinanya |

Jalankan `normalize_sekolah.py` dari direktori berisi keempat berkas `.xlsx`.
`periksa_sekolah.py` jalan dari mana saja, dan ikut jalan di CI lewat
`shared-files.yml` — bagian 7 sudah membuktikan daftar yang tidak diperiksa
mesin akan menyimpang tanpa suara.

---

## 11. Keadaan sekarang (17 Agustus 2026)

**189 sekolah, 188 sudah punya alamat.** 169 berkeyakinan `tinggi`, 178 lengkap
dengan kode pos, tersebar di 24 kabupaten/kota. Berkas alamatnya berisi 190
baris, bukan 189 — lihat catatan SMK Bhakti Kencana di bawah.

Dua belas baris masih tanpa kode pos: dua sekolah yang memang belum ketemu, dan
sepuluh yang angkanya bertabrakan antar sumber (lihat bagian 9) — dikosongkan,
bukan ditebak.

Yang berkeyakinan `sedang` hampir semuanya bukan soal sekolahnya, melainkan
soal **kode posnya**: identitas dan alamat jalan sudah dari Data Referensi
Kemendikdasmen, tapi halaman itu memang tidak memuat kolom kode pos, jadi
angkanya datang dari cermin Dapodik atau direktori kode pos per desa. Contoh
paling jelas `SMPN 1 Purwadadi`: satu direktori menulis 46385, satu lagi 46380,
dan yang 46385 salah satunya data sekolahnya sendiri — jadi 46385 yang dipakai,
dengan keyakinan `sedang` dan alasannya ditulis di `catatan`.

Dari tiga belas yang tersisa di putaran pertama, **sebelas selesai**, dan
tujuh di antaranya selesai tanpa pencarian baru sama sekali: petunjuknya sudah
ada di `sekolah_nama.json` sejak awal, hanya tidak pernah sampai ke agennya
(bagian 9).

| Sekolah | Hasil |
| --- | --- |
| SMA Terpadu Cikanyere | Dusun Cigoong, Sirnabaya, **Rajadesa, Ciamis** — bukan Cianjur. NPSN 69988141 |
| SMA IT Al-Falah | Jl. Citalahab, Mekarjaya, Bungbulang, **Garut**. NPSN 69830402 |
| SMP IT Nurul Huda Margajaya | Margajaya, **Pamarican**, Ciamis. NPSN 69993153 |
| SMA Al Hasan Banjarsari | Jl. Kawasen No. 80, Banjarsari, Ciamis. NPSN 20263274 |
| SMA Terpadu Ar-Risalah | sudah ada — kembar `SMA Ar-Risalah`, NPSN 20252464 |
| SMP SMA Islam Al-Ishlah bs | Sudimampir, Balongan, **Indramayu**. NPSN 20216194 |
| MA Al-Hasan | **Baregbeg** — memang itu yang ditulis peserta, tidak ada bentrok |
| SMA Islam Nurul Fikri | **Serang, Banten** — memang itu yang ditulis peserta |
| SMP Islam Bahrul Ulum | **Sukaratu**, Kab. Tasikmalaya. NPSN 20210721 |
| SMPN 1 Purwadadi | **Ciamis**, NPSN 20252422 — bukan yang di Subang |
| MTsN Rajadesa | MTsN 13 Ciamis, Jl. Cipancur No. 06. NPSN 20278700 |

**Dua sisanya tidak akan selesai dengan mencari lebih keras.** Keduanya sudah
disisir dari sisi alamat, bukan cuma dari sisi nama, dan buntu:

- **SMK Nusantara 1 Bekasi** — Jl. Kapten Tendean tidak ada di Bekasi, dan
  tidak ada sekolah menengah di Jl. Kapten Tendean Jakarta Selatan. Kelima SMK
  "Nusantara 1" yang terdaftar alamatnya tidak ada yang cocok.
- **SMPN 1 Kalijaya** — tidak ada sekolah dengan nama itu. Kandidat terkuat
  SMPN 5 Banjarsari di Desa Kalijaya, Kec. Banjaranyar, tapi namanya tidak
  cocok, jadi sengaja tidak diisikan.

Yang dibutuhkan satu pertanyaan ke pembinanya — dan bukan cuma dua ini.
Seluruh 21 baris yang keyakinannya belum `tinggi` sudah didaftar di
[`sekolah-belum-tuntas.md`](sekolah-belum-tuntas.md), lengkap dengan kalimat
yang tinggal disalin ke pembinanya. `periksa_sekolah.py` menjaga daftar itu
tetap sama persis dengan isi datanya, jadi ia menyusut sendiri begitu satu
sekolah beres — atau CI-nya merah.

**Yang masih menggantung selain itu:**

1. **`SMK Bhakti Kencana` masih satu klaster berisi dua sekolah** — satu di
   Kota Banjar (NPSN 60726572), satu di Kab. Ciamis (NPSN 20254625). `kunci()`
   sudah diperbaiki supaya tidak meleburnya lagi, tapi memisahkannya di
   `sekolah_nama.json` butuh hitungan peserta per baris pendaftaran, dan itu
   ada di keempat `.xlsx` yang tidak disimpan di repo. **Jalankan ulang
   `normalize_sekolah.py`** dari direktori berisi keempat berkas itu. Hasilnya
   akan memunculkan klaster ketiga bernama `SMK Bhakti Kencana` polos, dari dua
   baris peserta yang tidak menyebut daerahnya sama sekali — salah satunya
   berpetunjuk `Jl. Ir. H. Juanda`, yang bukan alamat kedua sekolah itu.
   Tanyakan ke pembinanya.
2. **Kode pos 46383 di sekolah-sekolah Kec. Banjaranyar perlu diperiksa.**
   Banjaranyar mekar dari Banjarsari tahun 2015 dan cermin Dapodik masih
   memakai kode lama; Desa Kalijaya, Banjaranyar tercatat 46384. Yang benar-
   benar di Kec. Banjarsari tetap 46383. Yang perlu dicek: `SMAN 2 Banjarsari`
   (NPSN 20255008, Desa Cigayam).
3. **`MA Agrowisata Shaleha` dan `MTs Serba Bakti Suryalaya` tidak punya
   NPSN** — madrasah di bawah Kemenag/EMIS memang tidak selalu ada di Dapodik.
   Alamatnya ketemu lewat sekolah saudara di kompleks yang sama. Itu bukan
   cacat, tapi berarti pemeriksaan kembar lewat NPSN (bagian 7) tidak bisa
   menjangkau keduanya.

**188 sekolah sudah terpasang di tabel `sekolah` produksi** (17 Agustus 2026,
migrasi 0061–0063). Yang belum masuk cuma dua yang alamatnya memang belum
ketemu. Caranya, beserta yang salah dulu baru betul, ada di bagian 12.

Pagar kembarnya **sudah terpasang**: `unique index` atas
`kunci_sekolah(name)`, dan `submit_pendaftaran` mencari sekolahnya lewat
nama — alamat yang diketik pembina tidak lagi melahirkan baris baru dan
tidak menimpa alamat kurasi.

---

## 12. Pasang ke database

Bagian 1–11 menghasilkan dua berkas JSON. Bagian ini soal memindahkannya ke
tabel `sekolah` produksi — dikerjakan 17 Agustus 2026 lewat tiga migrasi, dan
ditulis di sini karena **dua dari tiga lahir dari kekeliruan**, bukan dari
rencana.

### 12.1 Pasang pagarnya dulu, baru isinya

Urutannya bukan selera. Tabel `sekolah` waktu itu sudah berisi 36 baris dari
data contoh — hasil `submit_pendaftaran` yang mencari sekolah lewat pasangan
`(name, address)` **persis**, sehingga beda satu koma melahirkan baris baru.
`SMPN 1 CIAMIS` muncul tiga kali di kotak pilihan pendaftaran, satu di
antaranya beralamat `nan`. `SMPN 2 CIPAKU` empat kali. Totalnya **36 baris
untuk 23 sekolah**.

Memasang 188 baris kurasi ke atas tabel seperti itu hanya menambah lapisan.
Jadi `0061_sekolah_satu_baris.sql` mengerjakan tiga hal berurutan:

1. **Lebur yang kembar.** Yang bertahan baris tertua — ia yang paling mungkin
   sudah dirujuk pendaftaran. `pendaftaran.sekolah_id` dialihkan ke sana, baru
   sisanya dihapus. Semua yang dilebur disebut satu per satu lewat
   `raise notice` **sebelum** dihapus; migrasi yang menghapus baris tanpa
   menyebut baris mana tidak bisa diperiksa sesudahnya.
2. **Ganti kuncinya.** `unique (name, address)` dibuang, diganti unique index
   atas `kunci_sekolah(name)`. Alasannya di bagian 5: pembeda dua sekolah
   senama pindah ke dalam nama, jadi alamat tidak perlu ikut jadi kunci.
3. **`submit_pendaftaran` mencari lewat nama.** Dan alamat yang diketik pembina
   **tidak menimpa** alamat kurasi — ia sedang mendaftarkan regu, bukan sedang
   memperbaiki data kita. Satu salah ketik tidak boleh menghapus alamat yang
   sudah benar.

Baru setelah itu `0063_sekolah_daftar_kurasi.sql` memasang 188 barisnya.

### 12.2 Dua kunci penyamaan, dan jangan tertukar

Ini yang paling mudah salah, dan memang salah waktu dikerjakan.

| | `kunci()` di `normalize_sekolah.py` | `kunci_sekolah()` di database |
| --- | --- | --- |
| Tugas | **menggabungkan** tulisan tangan jadi klaster | **menolak** baris kembar |
| Diperiksa manusia? | ya, sekali, hasilnya dibaca | tidak, selamanya |
| Boleh agresif? | ya | tidak |
| Menyamakan | `Assalimiyah`~`ASALIMIAH`, ekor daerah, ejaan yayasan | besar-kecil huruf, tanda baca, `SMP Negeri`~`SMPN`, huruf status Dapodik |

Bedanya bukan kelalaian. Kunci database bekerja tanpa ada yang memeriksa
hasilnya, jadi ia hanya boleh menyamakan yang **pasti** sama — melebur dua
sekolah yang berbeda adalah kerusakan yang jauh lebih sulit ditemukan daripada
baris kembar.

**Kekeliruannya:** 0061 memakai kunci database untuk mencocokkan baris produksi
dengan daftar kurasi. Padahal itu pekerjaan yang dilakukan sekali dan hasilnya
diperiksa — persis pekerjaan kunci Python. Akibatnya cuma **17 dari 23** yang
alamatnya jadi baku; enam luput karena namanya berbeda lebih jauh dari yang mau
disamakan kunci database:

```
MA ASALIMIAH                  ->  MA Assalimiyah
MAS AL-KAUTSAR                ->  MA Al-Kautsar
SMAI NURUL FIKRI              ->  SMA Islam Nurul Fikri
SMAT RIYADLUL ULUM            ->  SMA Terpadu Riyadlul Ulum
SMKS GALUH RAHAYU             ->  SMK Galuh Rahayu
SMPT RIYADLUL ULUM WADDAWAH   ->  SMP Terpadu Riyadlul Ulum Waddawah
```

`0062_sekolah_nama_dapodik.sql` menutupnya dengan pemetaan **tulis tangan** dari
nama yang benar-benar ada di produksi. Enam baris, disebut satu per satu, tidak
ada normalisasi yang perlu dipercaya.

**Kalau mengulanginya tahun depan:** cocokkan ke daftar kurasi memakai `kunci()`
Python, cetak pasangannya, baca, baru rakit migrasinya. Jangan serahkan
pencocokan itu ke SQL.

### 12.3 Huruf status Dapodik ikut dibuang, singkatan tidak

Empat dari enam nama di atas berawalan bentuk Dapodik — `MAS`, `SMKS`, `SMAS`,
`MTsS` — di mana `S` terakhir berarti **Swasta**. Itu status, bukan bagian dari
nama, dan pembina menulis dua-duanya. `kunci_sekolah()` diperluas membuangnya,
jadi `SMKS Galuh Rahayu` yang diketik tahun depan mendarat di baris yang sama
dengan `SMK Galuh Rahayu`.

`SMAI`, `SMAT`, `SMPT` **tidak** ikut, walau ketiganya juga singkatan (Islam,
Terpadu). Huruf status hanya punya satu arti; membuang `T` dari `SMAT`
menyamakan "SMA Terpadu X" dengan "SMA X", dan itu bisa saja dua sekolah. Yang
tidak pasti diselesaikan dengan penggantian nama seperti di 12.2, bukan dengan
kunci yang lebih rakus.

### 12.4 Mengganti fungsi yang dipakai index

`sekolah_kunci_unik` adalah unique index atas `kunci_sekolah(name)`. Mengganti
isi fungsinya selagi index-nya berdiri meninggalkan index yang isinya dihitung
dengan rumus lama: **ia tampak sehat dan diam-diam meloloskan baris kembar.**

Urutan yang benar, dan itu yang ada di kepala 0062:

```sql
drop index if exists sekolah_kunci_unik;
create or replace function kunci_sekolah(...) ...;
-- ganti nama-namanya di sini
create unique index sekolah_kunci_unik on sekolah (kunci_sekolah(name));
```

### 12.5 Periksa tabrakan sebelum memasang

`0063` memasang 188 baris dengan `on conflict (kunci_sekolah(name)) do update`.
Kalau dua nama kurasi menghasilkan kunci yang sama, baris kedua akan **menimpa**
yang pertama — satu sekolah hilang, tanpa galat, dan yang menyadarinya adalah
pembina yang tidak menemukan sekolahnya di hari pendaftaran.

Jadi diperiksa dulu di luar database: 190 nama harus menghasilkan 190 kunci
berbeda. Salin `kunci_sekolah()` ke Python dan jalankan pemeriksaan itu tiap
kali daftarnya berubah, sebelum merakit migrasinya:

```python
def kunci_sql(n):
    s = re.sub(r"[^a-z0-9]+", " ", (n or "").lower())
    s = re.sub(r"\b(sd|smp|sma|smk|mi|mts|ma)\s+n(egeri)?\b", r"\1n", s)
    s = re.sub(r"^(sd|smp|sma|smk|mi|mts|ma)s\b", r"\1", s)
    return re.sub(r"\s+", " ", s).strip()
```

### 12.6 Yang sengaja tidak dipasang

**Dua sekolah berkeyakinan `rendah`** — `SMK Nusantara 1 Bekasi` dan
`SMPN 1 Kalijaya` — tidak ikut. Keduanya sudah disisir dari sisi alamat, bukan
cuma dari sisi nama, dan buntu.

Memasang tebakan lebih buruk daripada tidak memasang apa-apa. Pembina yang
tidak menemukan sekolahnya akan mengetiknya sendiri, dan jalan itu memang
disediakan; pembina yang menemukan sekolahnya dengan alamat **salah** tidak
akan curiga sama sekali.

**Sembilan belas baris `sedang` ikut dipasang.** Yang `sedang` di sana hampir
selalu kode posnya, bukan sekolahnya — nama dan alamat jalannya sudah dari Data
Referensi, dan yang berselisih cuma lima angka terakhir antar sumber. Menahan
sekolah yang namanya sudah pasti karena satu digit kode pos memaksa pembinanya
mengetik ulang seluruh alamat dari nol, yang justru lebih mungkin salah.

### 12.7 Bisa dijalankan dua kali

`0063` memakai `on conflict do update`, jadi menekan **Apply migration** dua
kali dari HP tidak melahirkan baris kedua dan tidak mengubah satu pun `id`.
Itu bukan kerapian: `pendaftaran.sekolah_id` menunjuk `id` tersebut, dan
migrasi yang menghapus-lalu-menyisipkan akan memutus setiap pendaftaran yang
sudah ada.

### 12.8 Yang ikut berubah di layar

Kartu "sekolahmu belum ada" di `live/js/daftar.js` dulu berbunyi *"Isi alamat
sekolahnya — untuk membedakan sekolah bernama sama."* Sejak 0061 kalimat itu
**keliru**: alamat tidak membedakan apa-apa, nama yang membedakan. Ia dihapus
daripada dibiarkan mengajarkan yang salah.

Gantinya satu kalimat yang membawa fakta yang tidak ada di layar dan mahal
kalau tidak diketahui: nama yang persis sama akan **menyatu** dengan sekolah
itu, jadi tambahkan kabupatennya. Ini `CLAUDE.md` bagian 9.4 dan 9.7 — form
pendaftaran diisi sekali, oleh orang yang belum pernah dilatih dan tidak punya
tempat bertanya.

### 12.9 Migrasi dan tesnya

| Berkas | Isi |
| --- | --- |
| `0061_sekolah_satu_baris.sql` | lebur 36→23, ganti kunci, `submit_pendaftaran` cari lewat nama |
| `0062_sekolah_nama_dapodik.sql` | enam nama yang luput + huruf status Dapodik |
| `0063_sekolah_daftar_kurasi.sql` | pasang 188 sekolah |
| `tests/sql/28_sekolah_satu_baris.sql` | alamat berbeda tidak melahirkan baris baru — **dan** dua sekolah berbeda tetap boleh berdampingan |
| `tests/sql/29_sekolah_daftar_kurasi.sql` | tidak ada yang melebur, `id` tidak berpindah saat dijalankan ulang |

Arah kedua di tes 28 yang paling mudah hilang: menghapus pagar lama sambil
merusak kebutuhan yang melahirkannya bukan perbaikan. `MAN 3 Ciamis` dan
`MAN 3 Tasikmalaya` harus tetap dua baris.
