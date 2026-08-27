-- ============================================================================
-- hrcd-rekap : 0114_nama_anggota_regu.sql
-- Nama empat anggota selain ketua kini DICATAT, dan opsional.
--
-- ---------------------------------------------------------------------------
-- KEPUTUSAN YANG DIBALIK, BUKAN KELALAIAN YANG DIPERBAIKI
--
-- 0001 menulisnya terus terang di badan tabel:
--
--     -- Empat anggota lain sengaja tidak dicatat (alur 3.2.6);
--     -- kelengkapan dicek fisik di closing (anggota_hadir).
--
-- dan `docs/alur-lomba.md` 3.2.5 mengulanginya. Itu keputusan sadar, dan
-- sekarang pemilik acara membalikkannya: form pendaftaran meminta lima nama
-- per regu, ketua tetap wajib dan empat sisanya boleh kosong.
--
-- Yang TIDAK berubah: `closing_regu.anggota_hadir` tetap hitungan fisik di
-- garis finish, dan penalti anggota tetap dihitung darinya. Nama yang dicatat
-- di sini tidak menggantikan hitungan itu — regu boleh datang berlima dengan
-- satu nama tidak tertulis, dan boleh menulis lima nama lalu datang bertiga.
--
-- ---------------------------------------------------------------------------
-- SATU KOLOM ARRAY, BUKAN TABEL ANAK
--
-- Empat nama tanpa atribut apa pun: tidak ada nomor dada per orang, tidak ada
-- kehadiran per orang, tidak ada yang menunjuk ke sana. Tabel anak menambah
-- satu join di setiap layar yang menampilkan regu, demi data yang tidak
-- pernah ditanya sendirian. CLAUDE.md 6.4 — sedikit lapisan lebih baik.
--
-- Kalau suatu hari kehadiran perlu dicatat PER ORANG, barulah bentuknya
-- berubah; sampai saat itu array adalah bentuk yang jujur.
--
-- ---------------------------------------------------------------------------
-- KOSONG BERARTI TIDAK DICATAT
--
-- `anggota` NULL untuk seluruh regu yang mendaftar sebelum migrasi ini, dan
-- untuk regu yang pembinanya memang tidak mengisi. Keduanya keadaan sah dan
-- tidak dibedakan: yang menjamin kelengkapan tetap hitungan fisik di closing.
-- Kotak yang dibiarkan kosong tidak disimpan sebagai string kosong — yang
-- tersimpan hanya nama yang benar-benar diketik.
-- ============================================================================

alter table regu add column if not exists anggota text[];

comment on column regu.anggota is
  'Nama anggota selain ketua, maksimal empat, opsional. NULL = tidak dicatat. Kelengkapan tetap dihitung fisik lewat closing_regu.anggota_hadir.';

alter table regu drop constraint if exists regu_anggota_maks_empat;
alter table regu add constraint regu_anggota_maks_empat check (
  anggota is null or coalesce(array_length(anggota, 1), 0) <= 4
);

-- Aturan yang sama dengan nama regu dan nama ketua (0052): angka di nama orang
-- hampir selalu nomor urut yang ikut terketik, dan ia terbawa ke daftar hadir.
alter table regu drop constraint if exists regu_anggota_tanpa_angka;
alter table regu add constraint regu_anggota_tanpa_angka check (
  anggota is null or array_to_string(anggota, ' ') !~ '[0-9]'
);

-- Nama kosong di tengah daftar berarti kotak yang dilewati ikut tersimpan, dan
-- "anggota ke-3 bernama kosong" adalah baris yang tidak berarti apa-apa.
alter table regu drop constraint if exists regu_anggota_tidak_kosong;
alter table regu add constraint regu_anggota_tidak_kosong check (
  anggota is null or '' <> all(anggota)
);

-- ---------------------------------------------------------------------------
-- Salinan terakhir submit_pendaftaran (0110). Yang berubah: satu blok validasi
-- anggota di dalam loop, dan satu kolom di INSERT.
-- ---------------------------------------------------------------------------
create or replace function submit_pendaftaran(
  p_nama_sekolah   text,
  p_alamat_sekolah text,
  p_butuh_barak    boolean,
  p_kontak_wa      text,
  p_regu           jsonb,
  p_jumlah_pendamping smallint default 0,
  p_kunci_kirim    uuid default null,
  p_nama_kontak    text default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_sekolah  uuid;
  v_batch    uuid;
  v_kode     text;
  v_n        int;
  v_r        jsonb;
  v_ada      pendaftaran%rowtype;
begin
  if p_kunci_kirim is not null then
    select * into v_ada from pendaftaran where kunci_kirim = p_kunci_kirim;
    if found then
      return jsonb_build_object(
        'kode_pembayaran', v_ada.kode_pembayaran,
        'jumlah_regu', v_ada.jumlah_regu,
        'total_tagihan', tagihan_pendaftaran(v_ada.id),
        'terkirim_ulang', true);
    end if;
  end if;

  v_n := jsonb_array_length(p_regu);
  if v_n is null or v_n < 1 then
    raise exception 'minimal satu regu';
  end if;
  if v_n > 30 then
    raise exception 'maksimal 30 regu per pendaftaran';
  end if;
  if p_kontak_wa is null or length(trim(p_kontak_wa)) < 8 then
    raise exception 'kontak WA wajib diisi';
  end if;
  if coalesce(trim(p_nama_sekolah), '') = '' then
    raise exception 'nama sekolah wajib diisi';
  end if;

  for v_r in select * from jsonb_array_elements(p_regu) loop
    if coalesce(trim(v_r ->> 'nama_regu'), '') = '' then
      raise exception 'nama regu wajib diisi';
    end if;
    if coalesce(trim(v_r ->> 'nama_ketua'), '') = '' then
      raise exception 'nama ketua wajib diisi';
    end if;
    if coalesce(v_r ->> 'golongan', '') not in (
      'penegak_pa', 'penegak_pi', 'penggalang_pa', 'penggalang_pi',
      'intern_pa', 'intern_pi'
    ) then
      raise exception 'golongan tidak dikenal: %', coalesce(v_r ->> 'golongan', '(kosong)');
    end if;

    -- Anggota OPSIONAL: kunci `anggota` boleh tidak ada sama sekali, dan
    -- daftarnya boleh kosong. Yang ditolak cuma bentuk yang salah.
    if v_r ? 'anggota' and jsonb_typeof(v_r -> 'anggota') <> 'null' then
      if jsonb_typeof(v_r -> 'anggota') <> 'array' then
        raise exception 'anggota harus berupa daftar nama';
      end if;
      if (select count(*) from jsonb_array_elements_text(v_r -> 'anggota') a
          where trim(a) <> '') > 4 then
        raise exception 'maksimal 4 anggota selain ketua';
      end if;
      -- Aturan yang sama dengan nama ketua (0052): angka di nama orang hampir
      -- selalu nomor urut yang ikut terketik, dan ia terbawa ke daftar hadir.
      if exists (select 1 from jsonb_array_elements_text(v_r -> 'anggota') a
                 where a ~ '[0-9]') then
        raise exception 'nama anggota tidak boleh memakai angka';
      end if;
    end if;
  end loop;

  select id into v_sekolah from sekolah
   where kunci_sekolah(name) = kunci_sekolah(p_nama_sekolah);

  if v_sekolah is null then
    insert into sekolah (name, address)
    values (trim(p_nama_sekolah), trim(coalesce(p_alamat_sekolah, '')))
    on conflict (kunci_sekolah(name)) do nothing
    returning id into v_sekolah;

    if v_sekolah is null then
      select id into v_sekolah from sekolah
       where kunci_sekolah(name) = kunci_sekolah(p_nama_sekolah);
    end if;
  end if;

  loop
    v_kode := 'HRCD' || edisi_aktif() || '-' ||
              upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from pendaftaran where kode_pembayaran = v_kode);
  end loop;

  insert into pendaftaran (sekolah_id, kode_pembayaran, butuh_barak,
                           jumlah_pendamping, jumlah_regu, kontak_wa, kunci_kirim, nama_kontak)
  values (v_sekolah, v_kode, coalesce(p_butuh_barak, false),
          greatest(coalesce(p_jumlah_pendamping, 0), 0), v_n, trim(p_kontak_wa),
          p_kunci_kirim, nullif(trim(coalesce(p_nama_kontak, '')), ''))
  returning id into v_batch;

  -- Kotak yang dibiarkan kosong TIDAK disimpan sebagai string kosong: yang
  -- tersimpan hanya nama yang benar-benar diketik, berurutan. `array_agg` atas
  -- nol baris mengembalikan NULL, dan NULL di sini berarti "tidak ada nama
  -- anggota yang dicatat" — bukan "regunya kosong".
  insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan, anggota)
  select v_batch, trim(r ->> 'nama_regu'), trim(r ->> 'nama_ketua'), r ->> 'golongan',
         (select array_agg(trim(a) order by urut)
          from jsonb_array_elements_text(coalesce(r -> 'anggota', '[]'::jsonb))
               with ordinality as t(a, urut)
          where trim(a) <> '')
  from jsonb_array_elements(p_regu) r;

  return jsonb_build_object(
    'kode_pembayaran', v_kode,
    'jumlah_regu', v_n,
    'total_tagihan', tagihan_pendaftaran(v_batch),
    'terkirim_ulang', false);
end;
$$;

do $blok$
declare v_dicatat integer;
begin
  assert exists (select 1 from information_schema.columns
                 where table_name = 'regu' and column_name = 'anggota'),
    '0114: kolom anggota tidak terpasang';

  select count(*) into v_dicatat from regu where anggota is not null;
  raise notice '0114: nama anggota kini dicatat (opsional). '
               'Regu yang sudah punya daftar anggota: %.', v_dicatat;
end;
$blok$;
