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

> **Yang TIDAK boleh digabung: jenjang yang berbeda.**
> `MA PUI Cijantung` dan `MTs PUI Cijantung` satu yayasan, satu halaman, dan
> **dua sekolah**. Begitu juga MTs/MA El-Bas, MTs/MA Assalimiyah, dan MTs
> Rijalul Hikam terhadap MA-nya.

Nama tampil dipilih dari ejaan yang **paling sering**; bila seri, yang paling
panjang — itu yang paling informatif.

Hasil: **1.102 baris peserta → 201 sekolah**, dari 326 tulisan mentah.

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

Pencariannya disebar: 201 sekolah dibagi ke ~13 agen, masing-masing belasan
sekolah, hasilnya divalidasi lewat JSON Schema. Satu context tidak muat.

---

## 7. Temukan kembaran lewat alamat

**Ini langkah yang paling banyak menemukan, dan paling mudah dilewatkan.**

Setelah semua alamat terkumpul, kelompokkan menurut `(jalan, kabupaten)`. Tiap
alamat yang dipakai lebih dari satu nama adalah calon kembar:

- **alamat sama + jenjang sama → satu sekolah**, gabungkan
- **alamat sama + jenjang beda → dua sekolah**, biarkan

Sekali jalan, cara ini menemukan sembilan pasang yang lolos dari penggabungan
berbasis nama:

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

`SMK Karnas` = **KAR**ya **NAS**ional. Tidak ada algoritma nama yang akan
menemukan itu; alamatnya yang menemukannya.

Dan yang bertabrakan tapi **benar terpisah**: `MTs Ar-Rahman` di Jl. Arrahman
No. **2** bukan `MA Ar-Rahman` di No. **01** — sebelah-sebelahan, beda jenjang.

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

Kabupaten tetap ditulis walau contoh aslinya tidak memakainya: 201 sekolah
tersebar di 15 kabupaten, dan `Jl. Raya Timur No. 1, 46211` tidak menolong
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
dijaga, `slice()` memotong per-huruf dan 201 sekolah jadi 644 potongan omong
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
| `tools/data/sekolah_nama.json` | 201 sekolah: nama baku, semua ejaan, jumlah peserta, petunjuk alamat |
| `tools/data/sekolah_alamat.json` | hasil pencarian alamat: NPSN, jalan, desa, kecamatan, kabupaten, kode pos, keyakinan, sumber |

Jalankan `normalize_sekolah.py` dari direktori berisi keempat berkas `.xlsx`.

---

## 11. Keadaan sekarang (16 Agustus 2026)

**Belum selesai.** 201 sekolah terdaftar, **188 sudah punya alamat**
(179 keyakinan tinggi, 142 lengkap dengan kode pos). **13 belum**:

**Empat belum tercari** — namanya di daftar berbeda tipis dari yang dikirim ke
agen, jadi terlewat: `SMA Al Hasan Banjarsari`, `SMA IT Al Falahjln`,
`SMA Terpadu Ar-Risalah`, `SMP SMA Islam Al-Ishlah bs`. Semuanya masih membawa
petunjuk alamat dari peserta.

**Sembilan hasilnya lemah**, dan alasannya berbeda-beda — perlakuannya juga:

| Sekolah | Masalah |
| --- | --- |
| SMA Terpadu Cikanyere | tidak ada di daftar Kec. Sukaresmi, Cianjur |
| SMA IT Al-Falah | tidak ketemu dengan petunjuk "Ciamis" — lihat bagian 9 |
| SMK Nusantara 1 Bekasi | 148 SMK Kota Bekasi disisir, tidak ada |
| SMPN 1 Kalijaya | tidak ada SMP bernama Kalijaya di Kemendikdasmen |
| SMP IT Nurul Huda Margajaya | 27 kecamatan dicek, tidak ketemu |
| SMA Islam Nurul Fikri | petunjuk peserta bertabrakan dengan yang ditemukan |
| MA Al-Hasan | ketemu satu, tapi bentrok dengan petunjuk |
| SMP Islam Bahrul Ulum | **ada dua** bernama persis sama |
| SMPN 1 Purwadadi | **ada dua** — salah satunya Kab. Subang |

Empat yang terakhir tidak akan selesai dengan mencari lebih keras: yang
dibutuhkan satu pertanyaan ke pembina sekolahnya.

Belum ada satu baris pun yang masuk tabel `sekolah`.

**Sebelum memasukkannya**, pasang dulu pagar kembar di database. `sekolah`
sekarang hanya ber-`unique (nama, alamat)` (migrasi 0001), jadi
`SMKN 3 Tasikmalaya` dan `SMK Negeri 3 Tasik` dengan alamat beda satu koma
lolos berdua — satu sekolah pecah dua, regunya terbelah, rekapnya menghitung
dua sekolah. Obatnya sama dengan yang sudah dipakai untuk `nama_regu` di
migrasi 0051: unique index atas nama yang dinormalisasi, ditambah satu langkah
menyamakan `SMKN` dengan `SMK NEGERI`.
