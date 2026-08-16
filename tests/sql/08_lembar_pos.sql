-- ============================================================================
-- hrcd-rekap : tests/sql/08_lembar_pos.sql
-- Layar Input Pos: bentuk konversi bertingkat, view v_lembar_pos, pos
-- bayangan, dan pengosongan sel.
--
-- Angka yang diuji BUKAN karangan. Semuanya baris nyata dari lembar Google
-- Sheets HRCD XXXVI yang diserahkan panitia — kalau mesin skor di sini
-- menghasilkan angka lain, yang salah adalah kodenya, bukan lembarnya.
--
-- Identitas berpindah lewat app.uid + set role, sama seperti 03_alur.sql.
-- Dijalankan SETELAH 0024_komponen_pos.sql (lihat catatan urutan di run.sh).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 8.1 Konfigurasi komponen benar-benar terpasang.
-- ---------------------------------------------------------------------------

do $$
begin
  assert (select count(*) from wahana
          where edisi = edisi_aktif() and pos = 1
            and kode in ('kepramukaan_keagamaan', 'semaphore', 'tebak_sandi',
                         'kompas', 'tebak_simpul')) = 5,
         'komponen Pos 1 tidak lengkap';
  assert (select bayangan from pos where edisi = edisi_aktif() and nomor = 6),
         'Pos 6 bukan pos bayangan';
  assert (select satuan from wahana
          where edisi = edisi_aktif() and kode = 'waktu_praktik') = 'detik',
         'satuan waktu_praktik bukan detik';
  -- Komponen contoh seed.sql yang SUDAH dipakai 03_alur.sql tidak boleh
  -- terhapus 0024 — menghapusnya akan menghapus nilai regu bersamanya.
  assert exists (select 1 from wahana where edisi = edisi_aktif()
                 and kode = 'lari_zigzag'),
         '0024 menghapus komponen yang masih memegang nilai';
end;
$$;

-- ---------------------------------------------------------------------------
-- 8.2 Tangga poin (bentuk bertingkat) — batas pitanya harus tepat.
--     Lembar Pos 4: <=60 detik = 50, <=90 = 30, <=120 = 15, lebih = 0.
-- ---------------------------------------------------------------------------

do $$
declare
  v_tangga jsonb := '[{"sampai": 60, "poin": 50}, {"sampai": 90, "poin": 30},
                      {"sampai": 120, "poin": 15}]'::jsonb;
  v_poin   numeric;
  v_detik  numeric;
  v_harap  numeric;
begin
  foreach v_detik in array array[0, 60, 61, 90, 91, 120, 121, 900]::numeric[] loop
    v_harap := case
      when v_detik <=  60 then 50
      when v_detik <=  90 then 30
      when v_detik <= 120 then 15
      else 0 end;
    v_poin := hitung_poin('bertingkat', v_detik, null, 50,
                          null, null, null, null, null, v_tangga);
    assert v_poin = v_harap,
      v_detik || ' detik = ' || v_poin || ' poin, harusnya ' || v_harap;
  end loop;

  -- Konfigurasi bertingkat tanpa tangga tertolak sejak insert, bukan
  -- menghasilkan poin kosong diam-diam di tengah lomba.
  begin
    insert into wahana (edisi, pos, kode, name, type, form, poin_maks,
                        rentang_mentah_min, rentang_mentah_maks)
    values (edisi_aktif(), 1, 'tanpa_tangga', 'Tanpa Tangga', 'wahana',
            'bertingkat', 10, 0, 10);
    raise exception 'GAGAL: bertingkat tanpa tingkat diterima';
  exception when check_violation then null;
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- 8.3 Nilai Pos cocok dengan sheet, di empat pos sekaligus.
--     Regu dada 13 dipakai karena belum punya nilai apa pun dari tes lain.
-- ---------------------------------------------------------------------------

select set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;

-- Pos 1, baris 002 SATE TUSUK: 6 / 5 / 0 / v / 1 -> 230
select simpan_nilai_massal('[
  {"nomor_dada": 13, "kode": "kepramukaan_keagamaan", "nilai_1": 6},
  {"nomor_dada": 13, "kode": "semaphore",             "nilai_1": 5},
  {"nomor_dada": 13, "kode": "tebak_sandi",           "nilai_1": 0},
  {"nomor_dada": 13, "kode": "kompas",                "nilai_1": 1},
  {"nomor_dada": 13, "kode": "tebak_simpul",          "nilai_1": 1}
]'::jsonb, 'manual', 1::smallint);

-- Pos 3, baris 004 RIMBA KUYY: 4 / 5 / 8 / 40 / 2
--
-- Lembar aslinya menulis 4,5 untuk Merayap — nilai setengah dari juri. Sejak
-- migrasi 0059 nilai mentah wajib bulat, jadi angka itu tidak bisa lagi
-- dimasukkan dan fixture ini memakai 5. Totalnya ikut berubah; yang dijaga
-- tes ini rumus penilaiannya, bukan angka lembar itu sendiri.
--
-- Merayap tidak ada lagi di konfigurasi edisi 37 (0033), jadi setengah nilai
-- itu tidak menghalangi siapa pun hari ini. Kalau suatu edisi memang perlu
-- setengah, simpan dalam satuan terkecilnya — lihat kepala 0059.
select simpan_nilai_massal('[
  {"nomor_dada": 13, "kode": "logika",       "nilai_1": 4},
  {"nomor_dada": 13, "kode": "merayap",      "nilai_1": 5},
  {"nomor_dada": 13, "kode": "balap_karung", "nilai_1": 8},
  {"nomor_dada": 13, "kode": "lempar_pisau", "nilai_1": 40},
  {"nomor_dada": 13, "kode": "poros_bumi",   "nilai_1": 2}
]'::jsonb, 'manual', 3::smallint);

-- Pos 4, baris 004 RIMBA KUYY: v / 2 menit 0 detik / 2 / 1 -> 125
select simpan_nilai_massal('[
  {"nomor_dada": 13, "kode": "praktik_kesehatan", "nilai_1": 1},
  {"nomor_dada": 13, "kode": "waktu_praktik",     "nilai_1": 120},
  {"nomor_dada": 13, "kode": "kim_cium",          "nilai_1": 2},
  {"nomor_dada": 13, "kode": "kim_lihat",         "nilai_1": 1}
]'::jsonb, 'manual', 4::smallint);

-- Pos Bayangan (Kostum), baris 003 KAMBING HITAM: 20 / 30 / 15 -> 65
select simpan_nilai_massal('[
  {"nomor_dada": 13, "kode": "kreativitas", "nilai_1": 20},
  {"nomor_dada": 13, "kode": "kekompakan",  "nilai_1": 30},
  {"nomor_dada": 13, "kode": "kesopanan",   "nilai_1": 15}
]'::jsonb, 'manual', 6::smallint);

do $$
declare l record;
begin
  select * into strict l from v_lembar_pos where nomor_dada = 13 and pos = 1;
  assert l.nilai_pos = 230, 'Pos 1 dada 13 = ' || l.nilai_pos || ', sheet bilang 230';
  assert l.jumlah_terisi = 5, 'Pos 1 dada 13 terisi ' || l.jumlah_terisi || ', harusnya 5';
  -- Identitas ikut terbawa — inilah yang dibaca petugas sebelum menilai.
  assert l.nama_sekolah is not null and l.nama_regu is not null,
         'identitas regu kosong di lembar pos';
  -- Nilai mentah dikembalikan sebagai objek berkunci kode komponen.
  assert (l.nilai -> 'semaphore' ->> 'nilai_1')::numeric = 5,
         'nilai mentah semaphore tidak terbaca dari kolom nilai';
  assert l.nilai -> 'tidak_ada_kolom_ini' is null, 'kolom asing muncul di nilai';

  select * into strict l from v_lembar_pos where nomor_dada = 13 and pos = 3;
  -- 293,33 bukan 285: Merayap naik dari 4,5 ke 5 (lihat catatan di atas),
  -- dan 0,5 dari 6 bernilai 8,33 poin. Rumusnya tidak berubah.
  assert round(l.nilai_pos, 2) = 293.33,
    'Pos 3 dada 13 = ' || l.nilai_pos || ', harusnya 293,33';

  select * into strict l from v_lembar_pos where nomor_dada = 13 and pos = 4;
  assert l.nilai_pos = 125, 'Pos 4 dada 13 = ' || l.nilai_pos || ', sheet bilang 125';

  select * into strict l from v_lembar_pos where nomor_dada = 13 and pos = 6;
  assert l.nilai_pos = 65, 'Pos bayangan dada 13 = ' || l.nilai_pos || ', sheet bilang 65';
  assert l.bayangan, 'pos 6 tidak ditandai bayangan di lembar';

  -- Pos yang belum dinilai sama sekali tetap muncul sebagai baris kosong —
  -- lembar harus utuh, bukan hanya berisi regu yang sudah dinilai.
  select * into strict l from v_lembar_pos where nomor_dada = 13 and pos = 5;
  assert l.nilai_pos = 0 and l.jumlah_terisi = 0, 'pos kosong tidak nol';
end;
$$;

-- Pos bayangan ikut masuk total skor, sama seperti pos utama.
do $$
declare v_total numeric;
begin
  select total_pos into v_total from v_total_skor where nomor_dada = 13;
  assert round(v_total, 2) = 713.33,
    'total pos dada 13 = ' || v_total || ', harusnya 230+293,33+125+65 = 713,33';
end;
$$;

-- ---------------------------------------------------------------------------
-- 8.4 Operator pos: hanya pos sendiri, TAPI tetap melihat nama sekolah.
--
--     Baris kedua itu yang penting. Jalan menuju nama sekolah melewati tabel
--     pendaftaran, yang tertutup untuk operator pos karena memuat nomor
--     WhatsApp. Kalau v_lembar_pos ikut tunduk RLS, operator mendapat lembar
--     KOSONG — dan lembar kosong terbaca sebagai "belum ada peserta", bukan
--     sebagai galat hak akses.
-- ---------------------------------------------------------------------------

select set_config('app.uid', '00000000-0000-0000-0000-000000000001', false);

do $$
begin
  assert exists (select 1 from v_lembar_pos where pos = 1),
         'operator pos 1 tidak melihat lembar pos-nya sendiri';
  assert not exists (select 1 from v_lembar_pos where pos <> 1),
         'operator pos 1 melihat lembar pos lain';
  assert not exists (select 1 from v_lembar_pos where nama_sekolah is null),
         'operator pos tidak melihat nama sekolah — RLS pendaftaran menggigit view';
  -- Nomor WhatsApp tetap tidak terjangkau lewat jalur mana pun.
  assert not exists (select 1 from pendaftaran), 'operator pos membaca pendaftaran';
end;
$$;

-- Akun nonaktif / bukan panitia tidak melihat apa pun.
select set_config('app.uid', '00000000-0000-0000-0000-0000000000ff', false);
do $$
begin
  assert not exists (select 1 from v_lembar_pos), 'akun nonaktif membaca lembar pos';
end;
$$;

-- ---------------------------------------------------------------------------
-- 8.5 Mengosongkan sel yang salah orang.
-- ---------------------------------------------------------------------------

select set_config('app.uid', '00000000-0000-0000-0000-000000000001', false);

do $$
begin
  -- Operator pos 1 mengosongkan kolomnya sendiri: boleh.
  perform hapus_nilai_pos(13, 'semaphore');
  assert (select nilai -> 'semaphore' from v_lembar_pos
          where nomor_dada = 13 and pos = 1) is null,
         'sel semaphore tidak terhapus';
  assert (select nilai_pos from v_lembar_pos where nomor_dada = 13 and pos = 1) = 180,
         'Nilai Pos tidak turun 50 setelah semaphore dihapus';

  -- Kolom milik pos lain: ditolak.
  begin
    perform hapus_nilai_pos(13, 'kim_cium');
    raise exception 'GAGAL: operator pos 1 menghapus nilai pos 4';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
  end;

  -- Nomor dada asing: ditolak, dan nomornya dicetak apa adanya (bukan
  -- dipotong jadi tiga digit oleh lpad).
  begin
    perform hapus_nilai_pos(9999, 'semaphore');
    raise exception 'GAGAL: nomor dada asing diterima';
  exception when raise_exception then
    if sqlerrm like 'GAGAL:%' then raise; end if;
    assert sqlerrm like '%9999%', 'pesan galat memotong nomor dada: ' || sqlerrm;
  end;
end;
$$;

-- Dikembalikan seperti semula supaya berkas tes berikutnya berangkat dari
-- keadaan yang sama.
select set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
select simpan_nilai_massal('[{"nomor_dada": 13, "kode": "semaphore", "nilai_1": 5}]'::jsonb,
                           'manual', 1::smallint);

reset role;

-- ---------------------------------------------------------------------------
-- 8.6 Pos 0 dan Pos 5 = garis start dan garis finish, tidak dinilai.
--
--     Yang diuji di sini bukan namanya, melainkan JEBAKAN-nya: keduanya tidak
--     punya komponen, jadi tidak ada regu yang bisa punya nilai di sana. Kalau
--     "pos terlewat" dihitung dari SELURUH baris pos, setiap regu selamanya
--     terhitung melewatkan dua pos — tak terlihat selama nilai_pos_terlewat
--     masih 0, lalu menghukum seluruh peserta pada hari angka itu diubah.
-- ---------------------------------------------------------------------------

do $$
declare
  v_dengan_pos numeric;
  v_tanpa_pos  numeric;
begin
  assert (select name from pos where edisi = edisi_aktif() and nomor = 0)
         = 'Keberangkatan', 'Pos 0 bukan Keberangkatan';
  assert (select name from pos where edisi = edisi_aktif() and nomor = 5)
         = 'Kedatangan', 'Pos 5 bukan Kedatangan';
  assert (select jumlah_komponen from v_pos where nomor = 0) = 0,
         'garis start punya komponen penilaian';

  -- Denda pos terlewat DINYALAKAN — tanpa itu cacatnya tidak kelihatan sama
  -- sekali, dan justru itu bahayanya: ia menunggu sampai seseorang mengubah
  -- satu angka konfigurasi yang memang boleh diubah.
  update konfig_penalti set nilai_pos_terlewat = 100 where edisi = edisi_aktif();
  select total_pos into v_tanpa_pos from v_total_skor where nomor_dada = 13;

  -- Menambah pos yang TIDAK dinilai tidak boleh mengubah skor siapa pun.
  -- Inilah aturan sebenarnya; Pos 0 dan Pos 5 hanya contoh pertamanya.
  insert into pos (edisi, nomor, name) values (edisi_aktif(), 19, 'Pos Tanpa Nilai');
  select total_pos into v_dengan_pos from v_total_skor where nomor_dada = 13;

  assert v_dengan_pos = v_tanpa_pos,
    'menambah satu pos tanpa komponen mengubah total pos dari ' || v_tanpa_pos
    || ' jadi ' || v_dengan_pos || ' — pos yang tidak dinilai ikut dihitung terlewat';

  -- Matriks pemantauan juga: kolom yang selamanya kosong terbaca sebagai
  -- pekerjaan yang belum selesai.
  assert not exists (select 1 from v_monitoring_input where pos in (0, 19)),
         'v_monitoring_input memuat pos yang tidak dinilai';

  delete from pos where edisi = edisi_aktif() and nomor = 19;
  update konfig_penalti set nilai_pos_terlewat = 0 where edisi = edisi_aktif();
end;
$$;

-- ---------------------------------------------------------------------------
-- 8.7 Batas nomor pos: longgar, tapi tetap batas.
-- ---------------------------------------------------------------------------

do $$
begin
  begin
    insert into pos (edisi, nomor, name) values (edisi_aktif(), 21, 'Pos Ngawur');
    raise exception 'GAGAL: pos nomor 21 diterima';
  exception when check_violation then null;
  end;
end;
$$;

-- Akun operator untuk pos bayangan harus bisa dibuat — tanpa pelonggaran di
-- 0021 baris ini gagal, dan pos bayangan jadi pos tanpa petugas.
insert into auth.users (id, email)
values ('00000000-0000-0000-0000-0000000000c6', 'pos6hrcd37@uji.local');
insert into akun_panitia (user_id, username, peran, pos)
values ('00000000-0000-0000-0000-0000000000c6', 'pos6hrcd37', 'operator_pos', 6);

select '08_lembar_pos OK' as hasil;
