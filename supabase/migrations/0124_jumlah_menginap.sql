-- ============================================================================
-- hrcd-rekap : 0124_jumlah_menginap.sql
--
-- Form pendaftaran berhenti menanyakan jumlah PENDAMPING dan menanyakan TOTAL
-- yang menginap — peserta beserta pembinanya sekalian.
--
-- ---------------------------------------------------------------------------
-- KENAPA INI BUKAN SEKADAR GANTI KALIMAT
--
-- `susun_barak()` menghitung kebutuhan satu sekolah sebagai
-- `regu aktif x 5 + jumlah_pendamping`. Angka lamanya memang cuma pendamping,
-- jadi pesertanya ditambahkan sendiri oleh rumus itu.
--
-- Begitu kotaknya berisi TOTAL, rumus yang sama menghitung pesertanya DUA
-- KALI. Satu sekolah 4 regu berpendamping 3 berubah dari 23 orang jadi 43, dan
-- pembagian barak memesan hampir dua kali lipat ruangan yang dibutuhkan. Tidak
-- ada galat yang muncul — yang muncul kekurangan ruangan pada malam sebelum
-- lomba, saat semua orang sudah datang.
--
-- Karena itu label di layar dan rumus di sini WAJIB berubah bersama, dan itu
-- seluruh isi migrasi ini.
--
-- ---------------------------------------------------------------------------
-- KENAPA KOLOMNYA IKUT GANTI NAMA
--
-- `jumlah_pendamping` yang berisi total peserta+pembina adalah nama yang
-- berbohong, dan nama yang berbohong tidak pernah tertangkap tes — ia
-- tertangkap oleh orang yang membacanya setahun lagi lalu menambahkan `x 5`
-- sekali lagi, karena "kan ini pendamping".
--
-- Yang ikut diganti dan yang tidak:
--
--   ikut  : kolom `pendaftaran.jumlah_pendamping` -> `jumlah_menginap`
--   ikut  : `susun_barak()`, yang berhenti mengalikan lima
--   ikut  : `ubah_pendamping()` -> `ubah_jumlah_menginap()`, bentuk lama dibuang
--   ikut  : `submit_pendaftaran()`, karena badan fungsi plpgsql disimpan
--           sebagai TEKS — `rename column` tidak menyentuhnya, dan fungsi yang
--           masih menyebut nama lama baru gagal saat dipanggil pembina
--   TIDAK : nama argumen `p_jumlah_pendamping` pada `submit_pendaftaran`
--
-- Argumen itu kontrak dengan Worker gateway. Menggantinya menuntut migrasi dan
-- deploy Worker yang berbarengan supaya pendaftaran tidak mati di antaranya —
-- harga yang tidak sebanding untuk satu nama argumen yang tidak pernah dibaca
-- siapa pun selain worker.js. Yang dibaca manusia adalah kolomnya, dan kolom
-- itu sekarang benar.
--
-- ---------------------------------------------------------------------------
-- ANGKA LAMA DIBIARKAN
--
-- Baris yang sudah ada menyimpan jumlah pendamping, bukan total. Tidak ada
-- yang mengubahnya di sini: menghitung "berarti totalnya sekian" dari jumlah
-- regu akan mengarang angka yang tidak pernah dikatakan sekolah mana pun.
-- Yang sudah mendaftar ditanya ulang saat daftar ulang, lewat
-- `ubah_jumlah_menginap()`.
-- ============================================================================

alter table pendaftaran rename column jumlah_pendamping to jumlah_menginap;

comment on column pendaftaran.jumlah_menginap is
  'Total orang yang menginap di barak — peserta DAN pembina. Sampai 0124 kolom '
  'ini bernama jumlah_pendamping dan berisi pembinanya saja, dan susun_barak() '
  'yang menambahkan pesertanya. Sekarang angkanya sudah utuh.';

-- ---------------------------------------------------------------------------
-- Salinan terakhir susun_barak (0064). Satu-satunya perubahan ada di blok
-- `for v_b in` — sisanya, termasuk urutan prioritas ruangan, disalin utuh.
-- ---------------------------------------------------------------------------
create or replace function susun_barak()
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_b   record;
  v_r   record;
  v_sisa integer;
begin
  if not boleh('pengaturan') then
    raise exception 'tidak berhak: pengaturan';
  end if;

  delete from penempatan_barak;

  -- Kebutuhan per batch = total yang menginap, APA ADANYA. Sampai 0124 baris
  -- ini menambahkan `regu aktif x 5` karena angkanya cuma pendamping; sekarang
  -- pesertanya sudah ikut dihitung sekolahnya sendiri, dan mengalikannya lagi
  -- di sini memesan hampir dua kali lipat ruangan tanpa satu galat pun.
  for v_b in
    select d.id, d.jumlah_menginap as butuh
    from pendaftaran d
    join regu r on r.pendaftaran_id = d.id
    where d.butuh_barak and d.status = 'lunas'
    group by d.id, d.jumlah_menginap
    having (count(r.id) filter (where not r.is_cancelled)) > 0
    order by butuh desc
  loop
    v_sisa := v_b.butuh;

    -- Urutan prioritas per sisa (temuan review: "pas-dulu" yang lama justru
    -- memecah sekolah yang sebenarnya muat satu ruangan):
    --   1) ruangan KOSONG terkecil yang MUAT seluruh sisa  -> 1 sekolah 1 ruangan
    --   2) ruangan KOSONG terbesar                          -> pecah seminimal mungkin
    --   3) sisa ruangan BERPENGHUNI terkecil yang muat      -> gabung, terpaksa
    --   4) sisa ruangan BERPENGHUNI terbesar                -> gabung + pecah
    while v_sisa > 0 loop
      select * into v_r from (
        select ru.id,
               ru.capacity - coalesce((select sum(p.jumlah_orang)
                 from penempatan_barak p where p.room_id = ru.id), 0) as longgar,
               not exists (select 1 from penempatan_barak p
                           where p.room_id = ru.id) as kosong
        from room ru
      ) x
      where x.longgar > 0
      order by
        case
          when x.kosong and x.longgar >= v_sisa then 1
          when x.kosong                          then 2
          when x.longgar >= v_sisa               then 3
          else 4
        end,
        case when x.longgar >= v_sisa then x.longgar end asc,   -- paling pas
        x.longgar desc                                          -- paling lapang
      limit 1;

      if v_r.id is null then
        raise exception 'kapasitas barak kurang % orang untuk batch % — tambah ruangan',
          v_sisa, v_b.id;
      end if;

      insert into penempatan_barak (pendaftaran_id, room_id, jumlah_orang)
      values (v_b.id, v_r.id, least(v_sisa, v_r.longgar));
      v_sisa := v_sisa - least(v_sisa, v_r.longgar);
      v_r := null;
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Yang mengubah angkanya di meja. Namanya ikut berganti karena yang diubahnya
-- bukan lagi jumlah pendamping, dan bentuk lamanya DIBUANG: dua nama untuk
-- satu perbuatan berarti separuh kode memanggil yang tidak lagi diperbaiki.
-- Tidak ada satu layar pun yang memanggilnya, jadi tidak ada masa peralihan
-- yang perlu dijaga di sini.
-- ---------------------------------------------------------------------------
create or replace function ubah_jumlah_menginap(p_kode text, p_jumlah smallint)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not boleh('daftar_ulang') then
    raise exception 'tidak berhak: daftar_ulang';
  end if;
  if p_jumlah is null or p_jumlah < 0 then
    raise exception 'jumlah yang menginap tidak sah';
  end if;
  update pendaftaran set jumlah_menginap = p_jumlah
  where kode_pembayaran = p_kode;
  if not found then
    raise exception 'kode pembayaran tidak dikenal: %', p_kode;
  end if;
end;
$$;

drop function if exists ubah_pendamping(text, smallint);

grant execute on function ubah_jumlah_menginap(text, smallint) to authenticated;

-- ---------------------------------------------------------------------------
-- Salinan terakhir submit_pendaftaran (0122). Satu kata yang berubah: nama
-- kolom di daftar INSERT. Nama argumennya sengaja tetap — alasannya di kepala
-- migrasi ini.
-- ---------------------------------------------------------------------------
create or replace function submit_pendaftaran(
  p_nama_sekolah   text,
  p_alamat_sekolah text,
  p_butuh_barak    boolean,
  p_kontak_wa      text,
  p_regu           jsonb,
  p_jumlah_pendamping smallint default 0,
  p_kunci_kirim    uuid default null,
  p_nama_kontak    text default null,
  p_metode_bayar   text default null,
  p_bukti_transfer text default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $fn$
declare
  v_sekolah  uuid;
  v_batch    uuid;
  v_kode     text;
  v_n        int;
  v_r        jsonb;
  v_ada      pendaftaran%rowtype;
  v_bukti    text;
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

  -- Cara bayar dan buktinya. Path buktinya WAJIB berada di dalam folder
  -- kunci_kirim kiriman ini: nama objek Storage bisa ditebak siapa pun yang
  -- pernah melihat satu contohnya, dan tanpa pagar ini satu pendaftaran bisa
  -- menunjuk bukti milik pendaftaran lain.
  if coalesce(p_metode_bayar, '') not in ('transfer', 'tunai') then
    raise exception 'cara pembayaran wajib dipilih';
  end if;
  v_bukti := nullif(trim(coalesce(p_bukti_transfer, '')), '');
  if p_metode_bayar = 'transfer' then
    if v_bukti is null then
      raise exception 'bukti transfer wajib diunggah';
    end if;
    if p_kunci_kirim is null
       or v_bukti not like p_kunci_kirim::text || '/%' then
      raise exception 'bukti transfer bukan milik kiriman ini';
    end if;
  else
    v_bukti := null;
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
                           jumlah_menginap, jumlah_regu, kontak_wa, kunci_kirim,
                           nama_kontak, metode_bayar, bukti_transfer)
  values (v_sekolah, v_kode, coalesce(p_butuh_barak, false),
          greatest(coalesce(p_jumlah_pendamping, 0), 0), v_n, trim(p_kontak_wa),
          p_kunci_kirim, nullif(trim(coalesce(p_nama_kontak, '')), ''),
          p_metode_bayar, v_bukti)
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
$fn$;

-- Pagar terakhir: tidak boleh ada objek tersisa yang masih menyebut nama lama.
--
-- Polanya menuntut satu huruf BUKAN pengenal tepat sebelum `jumlah_pendamping`,
-- supaya `p_jumlah_pendamping` tidak ikut tertangkap. Nama argumen itu memang
-- masih ada dan memang disengaja — versi pertama pagar ini memakai `like` biasa
-- dan langsung melaporkan submit_pendaftaran sebagai pelanggar.
do $blok$
declare v_sisa text;
begin
  select string_agg(p.proname, ', ' order by p.proname) into v_sisa
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f'
    and p.prosrc ~ '(^|[^_[:alnum:]])jumlah_pendamping';
  if v_sisa is not null then
    raise exception '0124: fungsi berikut masih menyebut kolom lama dan akan gagal saat dipanggil: %', v_sisa;
  end if;

  select string_agg(c.relname, ', ' order by c.relname) into v_sisa
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and pg_get_viewdef(c.oid) ~ '(^|[^_[:alnum:]])jumlah_pendamping';
  if v_sisa is not null then
    raise exception '0124: view berikut masih menyebut kolom lama: %', v_sisa;
  end if;

  raise notice '0124: tidak ada lagi yang menyebut jumlah_pendamping sebagai kolom.';
end;
$blok$;
