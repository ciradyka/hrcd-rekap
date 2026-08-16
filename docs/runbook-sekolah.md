# Runbook: membakukan nama dan alamat sekolah

Cara menyusun daftar sekolah untuk tabel `sekolah` dari database peserta
edisi-edisi sebelumnya. Ditulis setelah dikerjakan sekali untuk HRCD XXXVII,
memakai empat berkas Excel HRCD XXXIII–XXXVI.

Dokumen ini merekam **yang benar-benar dilakukan**, termasuk yang salah dulu
baru betul. Bagian 9 khusus untuk jebakan-jebakannya — bacalah sebelum mulai,
bukan sesudah.

---

## 1. Kenapa daftar ini ada

Form pendaftaran memuat autocomplete sekolah yang berjalan **di browser**:
seluruh tabel `sekolah` dimuat sekali, lalu disaring dengan
`SEKOLAH.filter(...)` (`live/js/daftar.js`). Instan, tanpa permintaan server
per huruf.

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

```
Jl. Gunung Galuh No. 37, Ciamis 46211
```

Jalan dan nomor, koma, kabupaten/kota, kode pos tanpa koma.

- Tulis `Jl.` — bukan `Jalan`, `JL`, `Jln`. Tulis `No.` — bukan `no`, `Nomor`.
- `Kabupaten Ciamis` diringkas jadi `Ciamis`; **`Kota Banjar` tetap
  `Kota Banjar`**, karena Kota Banjar dan Kabupaten Ciamis dua daerah berbeda
  dan membuang "Kota" membuat keduanya terbaca sama.
- Tanpa kode pos: berhenti di kabupaten.
- Tanpa nama jalan: `Kec. Lelea, Indramayu 45261`.

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

## 11. Keadaan sekarang (16 Agustus 2026)

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

Belum ada satu baris pun yang masuk tabel `sekolah`.

**Sebelum memasukkannya**, pasang dulu pagar kembar di database. `sekolah`
sekarang hanya ber-`unique (nama, alamat)` (migrasi 0001), jadi
`SMKN 3 Tasikmalaya` dan `SMK Negeri 3 Tasik` dengan alamat beda satu koma
lolos berdua — satu sekolah pecah dua, regunya terbelah, rekapnya menghitung
dua sekolah. Obatnya sama dengan yang sudah dipakai untuk `nama_regu` di
migrasi 0051: unique index atas nama yang dinormalisasi, ditambah satu langkah
menyamakan `SMKN` dengan `SMK NEGERI`.
