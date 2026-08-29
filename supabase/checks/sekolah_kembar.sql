-- ============================================================================
-- hrcd-rekap : sekolah_kembar.sql — TIDAK mengubah apa pun.
--
-- Berkas ini menjawab satu pertanyaan yang tidak bisa dijawab indeks unique:
-- "adakah dua baris `sekolah` yang sebenarnya satu sekolah?"
--
-- KENAPA INDEKS UNIQUE TIDAK CUKUP, DAN JANGAN DIUBAH
--
-- Pagar kembar di database `unique (kunci_sekolah(name))`, dan `kunci_sekolah()`
-- sengaja JINAK (CLAUDE.md 12.10): ia hanya menyamakan yang PASTI sama —
-- besar-kecil huruf, tanda baca, dan bentuk "Negeri". Ia bekerja tanpa ada yang
-- memeriksa hasilnya, jadi ia tidak boleh agresif: melebur dua sekolah yang
-- berbeda adalah kerusakan yang jauh lebih sulit ditemukan daripada baris
-- kembar.
--
-- Harganya: enam baris kembar lolos bertahun-tahun, dan yang menemukannya
-- audit manual pada 30 Agustus 2026 — bukan alat apa pun.
--
--   SMK Ma'arif NU Ciamis          lawan  SMK MAARIF NU CIAMIS
--   SMA 1 Sindangkasih             lawan  SMAN 1 SINDANGKASIH
--   SMA IT MD Fathahillah          lawan  SMA IT MD FATAHILLAH
--   SMP IT MD Fathahillah          lawan  SMP IT MUHAMADANU FATAHILAH
--   MA Al-Azhar Citangkolo K.B.    lawan  MA Al-Azhar Kota Banjar
--   MAN Darussalam                 lawan  MAN 1 Ciamis
--
-- Berkas ini MELAPOR, tidak melebur. Yang memutuskan tetap manusia, dan
-- karena itu ia boleh agresif — lapor palsu cuma memakan satu menit membaca,
-- sedangkan peleburan yang salah memakan satu sekolah.
--
-- YANG TIDAK BISA DITEMUKANNYA, DAN INI PENTING
--
-- Pasangan terakhir di atas, `MAN Darussalam` lawan `MAN 1 Ciamis`, dulu
-- TIDAK bisa ditemukan pemeriksaan ini: tidak ada satu huruf pun yang
-- menghubungkan keduanya, dan yang membuktikannya NPSN 20276451 yang sama —
-- sesuatu yang tidak disimpan tabel `sekolah`.
--
-- Aturan F menutupnya, dan lahirnya dari kejadian nyata. Impor 0157
-- menghidupkan kembali `MAN 1 Ciamis` yang baru saja dilebur 0154, dan tidak
-- satu pun aturan A-E bersuara. Yang menemukannya pertanyaan yang tidak
-- membandingkan nama sama sekali: adakah dua baris beralamat JALAN dan DESA
-- yang sama persis, dengan jenjang yang sama? Empat pasangan muncul dari
-- situ, dan keempatnya terbukti satu NPSN.
--
-- Jadi keenamnya sekarang tertutup — tetapi lewat alamat, bukan lewat NPSN.
-- Sekolah yang pindah alamat dan berganti nama sekaligus tetap lolos.
--
-- SESUDAH IMPOR DIREKTORI CIAMIS, LAPORAN INI TIDAK LAGI KOSONG
--
-- 0157 memasukkan 309 SMP/MTs/SMA/SMK/MA se-Kabupaten Ciamis, dan di antara
-- 524 baris itu ada sekitar 18 pasangan yang memang MIRIP tetapi memang DUA
-- SEKOLAH. Sudah diperiksa satu per satu 30 Agustus 2026, dan bentuknya
-- berulang:
--
--   * `SMPN Satu Atap 1 Panumbangan` lawan `SMPN 1 Panumbangan` — SD-SMP satu
--     atap adalah satuan pendidikan tersendiri, NPSN-nya sendiri.
--   * `MTs Nurul Huda` lawan `MTs Nurul Huda Al-Husna` — satu nama yayasan
--     yang dipakai beberapa madrasah di kecamatan berbeda.
--   * `MA Al-Ishlah` lawan `MA Al Islah`, `MA Darul Huda` lawan
--     `MA Daarul Huda` — dua-duanya sudah tercatat di
--     docs/sekolah-belum-tuntas.md bagian A sebagai kandidat yang belum
--     dipastikan, jauh sebelum impor ini.
--
-- Jadi yang dicari BUKAN "laporan kosong" lagi, melainkan pasangan yang BARU
-- muncul. Kalau daftarnya lebih panjang dari sekitar itu, ada yang perlu
-- dibaca.
--
-- Cara pakai: Actions -> "Apply migration to Supabase" -> Run workflow, isi
--   supabase/checks/sekolah_kembar.sql
-- ============================================================================

\pset border 2

-- `rapat`  : tanda baca dan spasi DIBUANG, bukan diganti spasi. Inilah bedanya
--            dengan kunci_sekolah(), dan inilah yang membuat "Ma'arif" bertemu
--            "MAARIF" — di kunci database keduanya jadi "ma arif" lawan
--            "maarif" dan tidak pernah bertemu.
-- `serupa` : `rapat` ditambah dua penyeragaman ejaan yang paling sering
--            beredar di nama madrasah — huruf `h` yang kadang ditulis kadang
--            tidak (Fathahillah ~ Fatahillah), dan huruf ganda (Fadliliyah ~
--            Fadlilliyah). Kasar, dan memang boleh kasar: ini laporan.
-- `jenjang`: huruf status Dapodik (SMAS, MTsS) dan huruf N negeri dibuang,
--            supaya "SMA 1" bertemu "SMAN 1".
with s as (
  select id, name, address,
         regexp_replace(lower(name), '[^a-z0-9]', '', 'g') as rapat,
         regexp_replace(
           regexp_replace(regexp_replace(lower(name), '[^a-z0-9]', '', 'g'), 'h', '', 'g'),
           '([a-z])\1+', '\1', 'g') as serupa,
         regexp_replace(lower(name), '^(sd|smp|sma|smk|mi|mts|ma)[ns]?\y', '\1', '') as jenjang,
         lower(split_part(name, ' ', 1)) as kata1,
         lower(regexp_replace(name, '^.* ', '')) as kata_akhir,
         regexp_replace(
           regexp_replace(regexp_replace(lower(regexp_replace(name, '^.* ', '')),
                                         '[^a-z0-9]', '', 'g'), 'h', '', 'g'),
           '([a-z])\1+', '\1', 'g') as akhir_serupa,
         string_to_array(lower(regexp_replace(name, '[^A-Za-z0-9 ]', '', 'g')), ' ') as kata,
         regexp_replace(lower(split_part(address, ', ', 1)), '[^a-z0-9]', '', 'g') as jalan,
         lower(split_part(address, ', ', 2)) as desa_alamat,
         -- TINGKAT sekolahnya saja: smp, mts, sma, smk, ma. Berbeda dari
         -- kolom `jenjang` di atas, yang isinya nama LENGKAP dengan huruf N
         -- dibuang. Aturan F sempat memakai `jenjang` dan karena itu menuntut
         -- namanya hampir sama — yang justru meniadakan seluruh gunanya,
         -- karena ia dibuat untuk pasangan yang namanya BERBEDA JAUH.
         (regexp_match(lower(name), '^(smkn|smk|sman|sma|smpn|smp|mtsn|mts|man|ma|min|mi|sdn|sd)'))[1] as tingkat
    from sekolah
),
-- Kata terakhir yang dipakai BANYAK sekolah adalah nama tempat, bukan nama
-- diri: "Ciamis" menutup 40-an nama, "Kawali" belasan. Daftarnya diturunkan
-- dari datanya sendiri, bukan diketik — supaya kecamatan yang baru muncul
-- tahun depan ikut terhitung tanpa ada yang perlu ingat menambahkannya.
kata_umum as (
  select lower(regexp_replace(name, '^.* ', '')) as kata
    from sekolah group by 1 having count(*) > 2
),
pasangan as (
  -- A. Sama persis begitu tanda baca dan spasi dibuang.
  select a.name as sekolah_a, b.name as sekolah_b,
         'tanda baca / spasi saja bedanya' as sebab,
         a.address as alamat_a, b.address as alamat_b
    from s a join s b on a.id < b.id and a.rapat = b.rapat

  union all
  -- B. Sama begitu huruf h dan huruf ganda diseragamkan.
  select a.name, b.name, 'ejaan h / huruf ganda saja bedanya', a.address, b.address
    from s a join s b on a.id < b.id and a.serupa = b.serupa and a.rapat <> b.rapat

  union all
  -- C. Sama begitu huruf status Dapodik dan huruf N negeri dibuang.
  select a.name, b.name, 'huruf N / status negeri-swasta saja bedanya', a.address, b.address
    from s a join s b on a.id < b.id
                     and regexp_replace(a.jenjang, '[^a-z0-9]', '', 'g')
                       = regexp_replace(b.jenjang, '[^a-z0-9]', '', 'g')
                     and a.rapat <> b.rapat

  union all
  -- D. SELURUH kata satu nama ada di nama satunya, dan yang satunya lebih
  --    panjang — satu nama memuat sisipan yang satunya tidak. Yang menangkap
  --    "MA Al-Azhar Kota Banjar" lawan "MA Al-Azhar Citangkolo Kota Banjar",
  --    dan tidak menangkap "SMPN 1 Kawali" lawan "SMPN 2 Kawali", karena
  --    angkanya membuat himpunan katanya tidak termuat.
  select a.name, b.name, 'satu nama memuat sisipan yang satunya tidak', a.address, b.address
    from s a join s b on a.id < b.id
                     and ((a.kata <@ b.kata
                           and array_length(a.kata, 1) < array_length(b.kata, 1))
                       or (b.kata <@ a.kata
                           and array_length(b.kata, 1) < array_length(a.kata, 1)))

  union all
  -- E. Kata terakhirnya nama diri yang sama dan jarang dipakai, kata
  --    pertamanya sama. Yang menangkap "SMP IT MD Fathahillah" lawan
  --    "SMP IT MUHAMADANU FATAHILAH", karena di situ cuma kata terakhirnya
  --    yang bertemu.
  --
  --    Pasangan yang bedanya HANYA angka dibuang: "SMPN 1 Kawali" dan
  --    "SMPN 2 Kawali" dua sekolah, dan tanpa syarat ini seluruh keluarga
  --    SMPN bernomor saling melapor.
  select a.name, b.name, 'kata terakhirnya nama diri yang sama', a.address, b.address
    from s a join s b on a.id < b.id
                     and a.akhir_serupa = b.akhir_serupa
                     and length(a.kata_akhir) >= 6
                     and a.kata_akhir not in (select kata from kata_umum)
                     and b.kata_akhir not in (select kata from kata_umum)
                     and a.kata1 = b.kata1
                     and a.serupa <> b.serupa
                     and regexp_replace(lower(a.name), '[0-9]', '', 'g')
                      <> regexp_replace(lower(b.name), '[0-9]', '', 'g')

  union all
  -- F. Jalan DAN desa sama persis, jenjangnya sama. Ini satu-satunya aturan
  --    yang tidak membandingkan nama sama sekali, dan karena itu satu-satunya
  --    yang bisa menemukan `MAN Darussalam` lawan `MAN 1 Ciamis` — dua nama
  --    tanpa satu huruf pun yang sama, satu NPSN. Impor 0157 menghidupkan
  --    kembali baris yang 0154 baru saja lebur, dan tidak ada aturan A-E yang
  --    bersuara; aturan ini yang menemukannya.
  --
  --    Jenjang HARUS sama. Tanpa syarat itu ia melaporkan tigapuluh pasangan
  --    MA+MTs dan SMA+SMP satu yayasan yang memang dua sekolah berbeda.
  --    Jalan yang terlalu pendek diabaikan: "Pasawahan" saja bukan alamat.
  select a.name, b.name, 'jalan dan desa sama persis, jenjang sama', a.address, b.address
    from s a join s b on a.id < b.id
                     and a.jalan = b.jalan and a.desa_alamat = b.desa_alamat
                     and length(a.jalan) >= 8
                     -- Alamat tanpa nama jalan dimulai dari desanya, jadi
                     -- bagian kedua berbunyi "Kec. ...". Dua sekolah sedesa
                     -- yang Dapodik tidak beri nama jalan akan selalu terlihat
                     -- seliteral-literalnya sama; itu sedesa, bukan sealamat.
                     and a.desa_alamat not like 'kec. %'
                     and regexp_replace(a.tingkat, 'n$', '') = regexp_replace(b.tingkat, 'n$', '')
)
select sebab, sekolah_a, sekolah_b,
       left(coalesce(nullif(alamat_a, ''), '(kosong)'), 46) as alamat_a,
       left(coalesce(nullif(alamat_b, ''), '(kosong)'), 46) as alamat_b
  from pasangan
 order by sebab, sekolah_a;

\echo ''
\echo 'KOSONG = tidak ada yang perlu diperiksa.'
\echo 'ADA ISI = baca sendiri, jangan lebur otomatis. Yang membuktikan dua nama'
\echo '          satu sekolah adalah NPSN, dan NPSN tidak ada di tabel ini —'
\echo '          cari di referensi.data.kemendikdasmen.go.id, lalu tulis'
\echo '          migrasi peleburan seperti 0154 kalau memang sama.'
