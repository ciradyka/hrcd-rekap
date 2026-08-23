-- ============================================================================
-- hrcd-rekap : tests/sql/09_rekap_publik.sql
-- Halaman rekap live untuk peserta.
--
-- Yang diuji di sini bukan tampilannya, melainkan SATU JANJI: selama lomba
-- berjalan, angka nilai tidak pernah ikut keluar dari database. Kalau janji
-- itu patah, tidak ada yang akan menyadarinya — halamannya tetap terlihat
-- benar, dan yang bocor cuma isi berkas JSON yang bisa dibuka siapa pun
-- langsung dari alamatnya.
-- ============================================================================

set role service_role;

-- ---------------------------------------------------------------------------
-- 9.1 Fase 'pra': belum ada apa-apa.
-- ---------------------------------------------------------------------------
reset role;
update status_acara set fase_live = 'pra';
set role service_role;

do $$
begin
  assert (select count(*) from v_progres_publik) = 0, 'progres bocor di fase pra';
  assert (select count(*) from v_klasemen_publik) = 0, 'klasemen bocor di fase pra';
  -- Hitungan pendaftar tetap boleh tampil — itulah isi halaman fase pra.
  assert (select jumlah_regu_lunas from v_publik_ringkas) > 0,
         'jumlah pendaftar ikut hilang di fase pra';
end;
$$;

-- ---------------------------------------------------------------------------
-- 9.2 Fase 'progres': centang dan fakta operasional, TANPA satu pun angka.
-- ---------------------------------------------------------------------------
reset role;
update status_acara set fase_live = 'progres';
set role service_role;

do $$
declare p record;
begin
  assert (select count(*) from v_progres_publik) > 0, 'fase progres kosong';

  -- INILAH janjinya. Selama fase progres, klasemen tidak boleh punya satu
  -- baris pun — bukan disembunyikan tampilan, tapi memang tidak ada.
  assert (select count(*) from v_klasemen_publik) = 0,
         'BOCOR: klasemen keluar di fase progres';

  -- Dan tidak ada kolom bernilai angka skor di view progres. Diperiksa dari
  -- katalog, bukan dari mata: kolom baru bisa ditambahkan orang lain nanti,
  -- dan yang menambahkannya belum tentu ingat janji ini.
  assert not exists (
    select 1 from information_schema.columns
    where table_name = 'v_progres_publik'
      and (column_name like '%total%' or column_name like '%poin%'
           or column_name like '%nilai%' or column_name like '%penalti%'
           or column_name like '%peringkat%')),
    'BOCOR: v_progres_publik punya kolom berbau nilai — '
    || (select string_agg(column_name, ', ') from information_schema.columns
        where table_name = 'v_progres_publik');

  -- Fakta operasional yang memang diminta panitia ikut terbawa.
  select * into strict p from v_progres_publik where nomor_dada = 1;
  assert p.kloter is not null,        'kloter tidak ikut di rekap publik';
  assert p.kontrak_menit is not null, 'kontrak waktu tidak ikut di rekap publik';
  assert p.jam_berangkat is not null, 'jam berangkat tidak ikut di rekap publik';
  assert p.jam_datang is not null,    'jam datang tidak ikut di rekap publik';
  assert p.target_datang = p.jam_berangkat + make_interval(mins => p.kontrak_menit),
         'target datang tidak sama dengan jam berangkat + kontrak';

  -- Centang per pos: objek berkunci nomor pos, isinya boolean.
  assert jsonb_typeof(p.pos_terlewati) = 'object', 'pos_terlewati bukan objek';
  assert (p.pos_terlewati ->> '1')::boolean, 'dada 1 sudah dinilai di pos 1, tapi tidak tercentang';
  -- Pos yang tidak punya komponen penilaian tidak boleh jadi kolom centang —
  -- kolom yang selamanya kosong di halaman peserta terbaca seperti pos yang
  -- panitianya lalai. Dihitung dari data, BUKAN dengan menyebut nomor pos:
  -- di database uji, Pos 5 kebetulan masih memegang satu komponen contoh
  -- yang tidak boleh dihapus (lihat 0024), sedangkan di produksi ia kosong.
  assert not exists (
    select 1 from v_pos where jumlah_komponen = 0
      and p.pos_terlewati -> nomor::text is not null),
    'pos tanpa penilaian ikut jadi kolom centang: '
    || (select string_agg(nomor::text, ', ') from v_pos
        where jumlah_komponen = 0 and p.pos_terlewati -> nomor::text is not null);
end;
$$;

-- Regu yang BELUM berangkat tetap muncul — justru merekalah yang paling
-- ingin memeriksa kloter dan kontraknya (migrasi 0026).
do $$
declare v_belum int;
begin
  select count(*) into v_belum
  from v_progres_publik where not sudah_berangkat;
  assert v_belum > 0, 'regu yang belum berangkat hilang dari halaman rekap';
end;
$$;

-- ---------------------------------------------------------------------------
-- 9.3 Fase 'penuh': klasemen terbuka, lengkap dengan juaranya.
-- ---------------------------------------------------------------------------
reset role;
update status_acara set fase_live = 'penuh';
set role service_role;

do $$
declare v_juara record;
begin
  assert (select count(*) from v_klasemen_publik) > 0, 'klasemen kosong di fase penuh';
  -- Tiap golongan punya peringkat 1 sendiri — empat klasemen terpisah
  -- (alur-lomba.md 2.3), bukan satu daftar panjang.
  for v_juara in select golongan, min(peringkat) as teratas
                 from v_klasemen_publik group by golongan loop
    assert v_juara.teratas = 1,
      'golongan ' || v_juara.golongan || ' tidak punya peringkat 1';
  end loop;
  -- Progres tetap ada di fase penuh: halaman rekap menampilkan keduanya.
  assert (select count(*) from v_progres_publik) > 0,
         'centang progres hilang setelah fase penuh';
end;
$$;

-- ---------------------------------------------------------------------------
-- 9.4 Bentuk terbitan historis pada titik migrasi ini.
--     Query produksi lengkap dijalankan langsung dari live_json.sql di ujung
--     run.sh setelah seluruh migrasi; subset ini hanya menjaga pagar fase lama.
-- ---------------------------------------------------------------------------

reset role;
update status_acara set fase_live = 'progres';
set role service_role;

do $$
declare v jsonb;
begin
  select jsonb_build_object(
    'dibuat_pada', now(),
    'fase', (select fase_live from status_acara),
    'pos', (select coalesce(jsonb_agg(jsonb_build_object('nomor', nomor) order by nomor), '[]'::jsonb)
            from v_pos where jumlah_komponen > 0),
    'progres', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from v_progres_publik p),
    'klasemen', (select coalesce(jsonb_agg(to_jsonb(k)), '[]'::jsonb) from v_klasemen_publik k)
  ) into v;

  assert jsonb_array_length(v -> 'klasemen') = 0,
         'BOCOR: berkas terbitan memuat klasemen di fase progres';
  assert jsonb_array_length(v -> 'progres') > 0, 'berkas terbitan kosong';
  -- Tidak ada satu pun angka nilai di seluruh berkas. Dicari sebagai TEKS,
  -- karena itulah bentuk yang benar-benar dikirim ke HP peserta.
  assert v::text not like '%total%' and v::text not like '%peringkat%',
         'BOCOR: kata bernuansa nilai muncul di berkas terbitan fase progres';
end;
$$;

reset role;
select '09_rekap_publik OK' as hasil;
