-- ============================================================================
-- hrcd-rekap : 0064_hak_akses_mengikat.sql
-- Seluruh penjaga pindah dari peran() ke boleh().
--
-- YANG SEDANG RUSAK SEKARANG, DAN INI BUKAN SOAL CENTANG
--
-- Migrasi 0058 mengganti nama peran di `akun_panitia`:
--
--     meja          -> registrasi
--     operator_pos  -> juri_pos
--
-- Ia TIDAK ikut mengganti 25 tempat di policy dan RPC yang membandingkan
-- `peran()` dengan nama lama. Perbandingan itu sekarang tidak cocok dengan
-- siapa pun, jadi setiap peran selain `admin` lumpuh:
--
--   simpan_nilai_massal  juri pos jatuh ke cabang else -> "hanya operator
--                        pos / admin". Layar Input Nilai gagal di ketukan
--                        pertama.
--   sel_nilai            juri pos tidak lolos policy -> tabel nilainya
--                        tampil KOSONG. Bukan galat, kosong; itu justru lebih
--                        membingungkan.
--   verifikasi_pembayaran  akun registrasi ditolak "hanya meja/admin".
--
-- Kenapa tidak ketahuan: pemiliknya selalu masuk sebagai admin, dan 'admin'
-- satu-satunya nama peran yang TIDAK berubah. Data contoh pun masuk lewat
-- Apply migration yang berjalan sebagai superuser — ia menulis langsung ke
-- tabel dan tidak pernah lewat RPC maupun RLS. Tes 25 hijau karena ia menguji
-- `boleh()`, bukan policy dan RPC yang sebenarnya dipakai layar. Hijau sambil
-- tidak memeriksa apa-apa; persis yang CLAUDE.md 7.5 peringatkan.
--
-- KENAPA DIPERBAIKI DENGAN boleh(), BUKAN DENGAN MENGGANTI NAMANYA SAJA
--
-- Mengganti 'meja' jadi 'registrasi' di 25 tempat memperbaiki kelumpuhannya
-- dalam lima menit — dan meninggalkan hak akses punya DUA mekanisme untuk satu
-- pertanyaan: matriks centang di layar Akun, dan daftar peran yang tertulis di
-- dalam policy. Yang kedua tidak bisa diubah panitia, jadi centangnya tetap
-- hanya menyembunyikan ubin di Home sementara databasenya membiarkan.
--
-- Setelah berkas ini, centang itulah pagarnya.
--
-- PEMETAANNYA, DAN SATU KEPUTUSAN YANG MEMBUATNYA TIDAK MELEBAR
--
-- Yang dulu `('admin','meja')` dipetakan ke fitur mejanya — pembayaran ke
-- `pembayaran`, daftar ulang ke `daftar_ulang`, dan seterusnya.
--
-- Yang dulu **admin saja** dipetakan ke `pengaturan`, BUKAN ke fitur ubin yang
-- namanya mirip. Membatalkan keberangkatan bukan pekerjaan yang tiba-tiba
-- boleh dilakukan petugas gerbang hanya karena kolomnya kebetulan bernama
-- "Keberangkatan". `pengaturan` sejak 0057 memang kolom untuk pekerjaan admin
-- yang tidak punya ubin, dan hanya admin yang mencentangnya secara bawaan —
-- jadi haknya persis sama seperti hari ini, bedanya sekarang bisa diberikan
-- lewat centang kalau memang perlu.
--
-- Kena aturan ini: `batalkan_keberangkatan`, `batalkan_tanda_cetak`,
-- `susun_barak`, pembatalan verifikasi beda hari, penembusan regu yang sudah
-- berangkat di `konfirmasi_kontrak`, dan penukaran nomor yang sudah beredar di
-- `tukar_nomor_dada`.
--
-- POLICY BACA YANG SENGAJA TIDAK DISENTUH
--
-- Dua puluh policy `sel_*` berbunyi `peran() is not null` — "panitia mana pun
-- yang aktif". Itu TIDAK rusak oleh 0058 dan sengaja dibiarkan. `regu`,
-- `kloter`, dan `edisi` dibaca hampir setiap layar; mengikatnya ke satu fitur
-- akan mematikan layar lain yang kebetulan juga membacanya. Aturannya:
-- **membaca data operasional = jadi panitia; melakukan sesuatu = per fitur.**
--
-- CABANG POS TIDAK LAGI BERTANYA SOAL PERAN
--
-- Dulu `if peran() = 'operator_pos' then v_pos := pos_saya()`. Sekarang
-- `if pos_saya() is not null`. Itu benar persis: 0058 memasang
-- `check ((peran = 'juri_pos') = (pos is not null))`, jadi hanya akun juri pos
-- yang punya pos. Yang lain menyebut posnya lewat `p_pos` seperti sebelumnya.
-- Pertanyaannya jadi "akun ini terikat satu pos atau tidak", yang memang
-- pertanyaan sebenarnya — bukan "akun ini perannya apa".
--
-- BADAN FUNGSINYA TIDAK DIKETIK ULANG
--
-- Dua puluh satu RPC di bawah disalin UTUH dari migrasi termuda yang
-- mendefinisikannya, lalu hanya baris penjaganya yang diganti, lewat skrip
-- yang memagari tiap penggantian dengan assert — pola yang tidak ketemu persis
-- satu kali menghentikan perakitan. Mengetik ulang 1.000 baris logika kloter,
-- nomor dada, dan gembok nilai demi mengubah dua baris di atasnya adalah cara
-- tercepat menyelundupkan bug yang tidak ada hubungannya dengan hak akses.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Penolong: boleh salah satu dari beberapa fitur.
-- ---------------------------------------------------------------------------
create or replace function boleh_apa_saja(variadic p_fitur text[])
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1
    from akun_hak h
    join akun_panitia a on a.user_id = h.user_id
    where h.user_id = auth.uid() and a.is_active and h.fitur = any(p_fitur)
  )
$$;

comment on function boleh_apa_saja(text[]) is
  'boleh() untuk beberapa fitur sekaligus. Dipakai policy baca yang dulu berbunyi peran() in (admin, meja).';

-- ---------------------------------------------------------------------------
-- 2. Policy.
-- ---------------------------------------------------------------------------
drop policy if exists adm_closing on closing_regu;
create policy adm_closing on closing_regu for all using (boleh('pengaturan'));

drop policy if exists adm_edisi on edisi;
create policy adm_edisi on edisi for all using (boleh('pengaturan'));

drop policy if exists adm_foto on foto_lembar;
create policy adm_foto on foto_lembar for all using (boleh('pengaturan'));

drop policy if exists adm_keberangkatan on keberangkatan_regu;
create policy adm_keberangkatan on keberangkatan_regu for all using (boleh('pengaturan'));

drop policy if exists adm_kloter on kloter;
create policy adm_kloter on kloter for all using (boleh('pengaturan'));

drop policy if exists adm_konfig_penalti on konfig_penalti;
create policy adm_konfig_penalti on konfig_penalti for all using (boleh('pengaturan'));

drop policy if exists adm_kontrak_opsi on kontrak_opsi;
create policy adm_kontrak_opsi on kontrak_opsi for all using (boleh('pengaturan'));

drop policy if exists adm_nilai on nilai_mentah;
create policy adm_nilai on nilai_mentah for all using (boleh('pengaturan'));

drop policy if exists adm_kunci on nilai_terkunci;
create policy adm_kunci on nilai_terkunci for all using (boleh('pengaturan'));

drop policy if exists adm_pensiun on nomor_dada_pensiun;
create policy adm_pensiun on nomor_dada_pensiun for all using (boleh('pengaturan'));

drop policy if exists adm_stok on nomor_dada_stok;
create policy adm_stok on nomor_dada_stok for all using (boleh('pengaturan'));

drop policy if exists adm_pembayaran on pembayaran;
create policy adm_pembayaran on pembayaran for all using (boleh('pengaturan'));

drop policy if exists adm_pendaftaran on pendaftaran;
create policy adm_pendaftaran on pendaftaran for all using (boleh('pengaturan'));

drop policy if exists adm_barak on penempatan_barak;
create policy adm_barak on penempatan_barak for all using (boleh('pengaturan'));

drop policy if exists adm_pos on pos;
create policy adm_pos on pos for all using (boleh('pengaturan'));

drop policy if exists adm_regu on regu;
create policy adm_regu on regu for all using (boleh('pengaturan'));

drop policy if exists adm_ruangan on room;
create policy adm_ruangan on room for all using (boleh('pengaturan'));

drop policy if exists adm_sekolah on sekolah;
create policy adm_sekolah on sekolah for all using (boleh('pengaturan'));

drop policy if exists adm_status_acara on status_acara;
create policy adm_status_acara on status_acara for update using (boleh('pengaturan'));

drop policy if exists adm_wahana on wahana;
create policy adm_wahana on wahana for all using (boleh('pengaturan'));

drop policy if exists sel_riwayat on history;
create policy sel_riwayat on history for select using (boleh('pengaturan'));

drop policy if exists sel_pendaftaran on pendaftaran;
create policy sel_pendaftaran on pendaftaran for select using (
  boleh_apa_saja('pendaftaran', 'pembayaran', 'daftar_ulang', 'cetak_kloter', 'pengaturan')
);

drop policy if exists sel_pembayaran on pembayaran;
create policy sel_pembayaran on pembayaran for select using (
  boleh_apa_saja('pendaftaran', 'pembayaran', 'daftar_ulang', 'cetak_kloter', 'pengaturan')
);

drop policy if exists sel_nilai on nilai_mentah;
create policy sel_nilai on nilai_mentah for select using (
  boleh('rekap')
  or (boleh('pos') and (
        pos_saya() is null
        or exists (select 1 from wahana w
                    where w.id = wahana_id and w.pos = pos_saya())))
);

drop policy if exists sel_foto on foto_lembar;
create policy sel_foto on foto_lembar for select using (
  boleh('rekap')
  or (boleh('pos') and (pos_saya() is null or pos = pos_saya()))
);

-- ---------------------------------------------------------------------------
-- 3. Policy storage — bucket foto lembar.
-- ---------------------------------------------------------------------------
do $blok$
begin
  if exists (select 1 from information_schema.tables
              where table_schema = 'storage' and table_name = 'objects') then
    execute $p$
      drop policy if exists foto_lembar_baca on storage.objects;
      $p$;
    execute $p$
      create policy foto_lembar_baca on storage.objects for select
      using (
        bucket_id = 'lembar' and (
          boleh('rekap')
          or (boleh('pos') and (
                pos_saya() is null
                or split_part(name, '/', 1) = 'pos' || pos_saya()::text))
        )
      )
      $p$;
    execute $p$
      drop policy if exists foto_lembar_tulis on storage.objects;
      $p$;
    execute $p$
      create policy foto_lembar_tulis on storage.objects for insert
      with check (
        bucket_id = 'lembar' and (
          boleh('rekap')
          or (boleh('pos') and (
                pos_saya() is null
                or split_part(name, '/', 1) = 'pos' || pos_saya()::text))
        )
      )
      $p$;
    raise notice '0064: policy storage foto lembar diperbarui.';
  else
    raise notice '0064: skema storage tidak ada — policy fotonya dilewati.';
  end if;
end $blok$;

-- ---------------------------------------------------------------------------
-- 4. RPC. Badannya UTUH dari definisi termuda; hanya penjaganya yang ganti.
-- ---------------------------------------------------------------------------
create or replace function batal_ceklis_berangkat(p_nomor_dada integer)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not boleh('keberangkatan') then
    raise exception 'tidak berhak: keberangkatan';
  end if;
  select id into v_id from regu where nomor_dada = p_nomor_dada;
  if not found then
    raise exception 'nomor dada % tidak dikenal', p_nomor_dada;
  end if;
  delete from keberangkatan_regu where regu_id = v_id;
end;
$$;

create or replace function batalkan_keberangkatan(p_kloter smallint, p_alasan text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not boleh('pengaturan') then
    raise exception 'tidak berhak: pengaturan';
  end if;
  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'alasan wajib diisi';
  end if;
  if p_kloter <> (select max(nomor) from kloter where jam_berangkat is not null) then
    raise exception 'hanya kloter berangkat terakhir yang bisa dibatalkan';
  end if;
  insert into history (table_name, row_id, action, new_value, changed_by)
  values ('kloter', p_kloter::text, 'UPDATE',
          jsonb_build_object('alasan_batal_berangkat', p_alasan), auth.uid());
  update kloter set jam_berangkat = null where nomor = p_kloter;
end;
$$;

create or replace function batalkan_tanda_cetak(p_kloter smallint, p_alasan text)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not boleh('pengaturan') then
    raise exception 'tidak berhak: pengaturan';
  end if;
  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'alasan wajib diisi';
  end if;
  insert into history (table_name, row_id, action, new_value, changed_by)
  values ('kloter', p_kloter::text, 'UPDATE',
          jsonb_build_object('alasan_batal_tanda_cetak', p_alasan), auth.uid());
  update kloter set dicetak_pada = null where nomor = p_kloter;
end;
$$;

create or replace function batalkan_verifikasi(
  p_kode   text,
  p_alasan text
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_bayar pembayaran%rowtype;
begin
  if not boleh('pembayaran') then
    raise exception 'tidak berhak: pembayaran';
  end if;
  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'alasan pembatalan wajib diisi';
  end if;

  select b.* into v_bayar
  from pembayaran b join pendaftaran d on d.id = b.pendaftaran_id
  where d.kode_pembayaran = p_kode
  for update;
  if not found then
    raise exception 'tidak ada pembayaran untuk kode %', p_kode;
  end if;

  -- Temuan review: membatalkan verifikasi SETELAH daftar ulang meninggalkan
  -- regu yatim — bernomor dada & berkloter tapi "belum bayar", hilang dari
  -- kwitansi dan tergusur dari barak. Tolak keras.
  if exists (select 1 from regu r
             where r.pendaftaran_id = v_bayar.pendaftaran_id
               and r.nomor_dada is not null) then
    raise exception 'batch sudah daftar ulang (nomor dada terbit) — pembatalan harus lewat admin dengan mengosongkan nomor dada dulu';
  end if;

  -- Hari yang sama dihitung dalam WIB, bukan zona server (temuan review).
  if not boleh('pengaturan')
     and (v_bayar.verified_at at time zone 'Asia/Jakarta')::date
         <> (now() at time zone 'Asia/Jakarta')::date then
    raise exception 'pembatalan verifikasi beda hari hanya untuk admin';
  end if;

  -- Alasan ikut terekam riwayat lewat trigger audit pada DELETE + catatan ini.
  insert into history (table_name, row_id, action, new_value, changed_by)
  values ('pembayaran', v_bayar.id::text, 'DELETE',
          jsonb_build_object('alasan_pembatalan', p_alasan), auth.uid());

  delete from pembayaran where id = v_bayar.id;
  update pendaftaran set status = 'menunggu_pembayaran' where id = v_bayar.pendaftaran_id;
end;
$$;

create or replace function berangkatkan_kloter(
  p_kloter smallint,
  p_jam    timestamptz
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tanpa_kontrak text;
begin
  if not boleh('keberangkatan') then
    raise exception 'tidak berhak: keberangkatan';
  end if;
  if p_jam is null then
    raise exception 'jam berangkat wajib diketik';
  end if;
  if exists (select 1 from kloter where nomor = p_kloter and jam_berangkat is not null) then
    raise exception 'kloter % sudah berangkat', p_kloter;
  end if;
  -- Papan pipeline diturunkan dari max(nomor berangkat) — satu ketukan salah
  -- (memberangkatkan kloter kosong / melompati) merusak seluruh papan.
  -- Guard: kloter harus berisi regu, dan tidak boleh melompati kloter berisi
  -- regu yang belum berangkat (temuan review).
  if not exists (select 1 from regu r where r.kloter_nomor = p_kloter and not r.is_cancelled) then
    raise exception 'kloter % tidak berisi regu', p_kloter;
  end if;
  if exists (
       select 1 from kloter k
       where k.nomor < p_kloter and k.jam_berangkat is null
         and exists (select 1 from regu r
                     where r.kloter_nomor = k.nomor and not r.is_cancelled)) then
    raise exception 'masih ada kloter sebelum % yang belum berangkat — urutan keberangkatan wajib berurut', p_kloter;
  end if;

  -- Regu yang diceklis berangkat wajib sudah berkontrak — mencegah penalti
  -- waktu yang tak terhitung (NULL) di kemudian hari.
  -- lpad(...) = bentuk yang tertulis di kain nomor dadanya; lihat kepala
  -- berkas ini. ORDER BY supaya daftarnya tidak berubah urutan tiap kali.
  select string_agg(lpad(r.nomor_dada::text, 3, '0'), ', ' order by r.nomor_dada)
    into v_tanpa_kontrak
  from regu r
  join keberangkatan_regu k on k.regu_id = r.id
  where r.kloter_nomor = p_kloter and r.kontrak_menit is null;
  if v_tanpa_kontrak is not null then
    raise exception 'regu nomor dada % belum konfirmasi kontrak waktu', v_tanpa_kontrak;
  end if;

  update kloter set jam_berangkat = p_jam where nomor = p_kloter;
end;
$$;

create or replace function buka_kunci_nilai_pos(
  p_nomor_dada integer,
  p_pos        smallint,
  p_alasan     text
) returns void
language plpgsql security definer
set search_path = public
as $$
declare v_regu uuid;
begin
  -- Siapa pun yang boleh MENGUNCI boleh pula MEMBUKA, dengan pagar pos yang
  -- sama. Operator pos hanya posnya sendiri.
  -- Haknya diperiksa POSITIF, bukan lewat 'not in'.
  --
  -- Versi 0045 memakai bentuk `not in (daftar peran)`, dan di PostgreSQL
  -- `null not in (...)` bernilai NULL — bukan true. Cabang penolakannya
  -- karena itu tidak pernah jalan untuk peran NULL, yaitu akun yang punya
  -- sesi sah tetapi sudah dicabut dari akun_panitia. Ia jatuh melewati
  -- kedua cabang dan sampai ke delete. boleh() tidak punya lubang itu:
  -- ia mengembalikan false, bukan NULL, untuk akun yang tidak dikenal.
  if not boleh('pos') then
    raise exception 'tidak berhak: pos';
  end if;
  if pos_saya() is not null and p_pos is distinct from pos_saya() then
    raise exception 'operator pos % tidak boleh membuka gembok pos %',
      pos_saya(), p_pos;
  end if;

  -- Alasan tetap WAJIB, dan justru inilah yang menahan seluruh bebannya
  -- sekarang. Ketika yang mengunci bisa membuka sendiri, tidak ada lagi orang
  -- kedua yang harus diyakinkan — yang tersisa cuma catatan tentang apa yang
  -- diyakinkannya kepada dirinya sendiri.
  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'alasan membuka gembok wajib diisi';
  end if;

  select id into v_regu from regu where nomor_dada = p_nomor_dada;
  if not found then
    raise exception 'nomor dada % tidak dikenal', p_nomor_dada;
  end if;

  -- Alasannya dicatat SEBELUM barisnya hilang, kalau tidak ia hilang bersama
  -- barisnya — dan yang tersisa cuma nilai yang berubah tanpa penjelasan.
  insert into history (table_name, row_id, regu_id, action, new_value, changed_by)
  values ('nilai_terkunci', v_regu::text || ':' || p_pos, v_regu, 'DELETE',
          jsonb_build_object('alasan_buka_gembok', p_alasan, 'pos', p_pos),
          auth.uid());

  delete from nilai_terkunci where regu_id = v_regu and pos = p_pos;
end;
$$;

create or replace function catat_closing(
  p_nomor_dada    integer,
  p_jam_datang    timestamptz,
  p_anggota_hadir smallint default 5,
  p_catatan       text default null
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_regu regu%rowtype;
begin
  if not boleh('kedatangan') then
    raise exception 'tidak berhak: kedatangan';
  end if;
  if p_jam_datang is null then
    raise exception 'jam datang wajib diketik';
  end if;

  select * into v_regu from regu where nomor_dada = p_nomor_dada;
  if not found then
    raise exception 'nomor dada % tidak dikenal', p_nomor_dada;
  end if;
  if v_regu.is_cancelled then
    raise exception 'regu % berstatus batal', p_nomor_dada;
  end if;
  if not exists (select 1 from keberangkatan_regu where regu_id = v_regu.id) then
    raise exception 'regu % belum tercatat berangkat', p_nomor_dada;
  end if;

  insert into closing_regu (regu_id, jam_datang, anggota_hadir, recorded_by, note)
  values (v_regu.id, p_jam_datang, p_anggota_hadir, auth.uid(), p_catatan)
  on conflict (regu_id) do update set
    jam_datang    = excluded.jam_datang,
    anggota_hadir = excluded.anggota_hadir,
    recorded_by  = excluded.recorded_by,
    recorded_at  = now(),
    note       = excluded.note
  -- Simpan ulang tanpa perubahan tidak menulis (kepengarangan & riwayat).
  where closing_regu.jam_datang    is distinct from excluded.jam_datang
     or closing_regu.anggota_hadir is distinct from excluded.anggota_hadir
     or closing_regu.note       is distinct from excluded.note;
end;
$$;

create or replace function catat_foto_lembar(
  p_nomor_dada integer,
  p_pos        smallint,
  p_kode_lomba text,
  p_nama_lomba text,
  p_path       text,
  p_ukuran     integer default null
) returns void
language plpgsql security definer
set search_path = public
as $$
declare v_regu uuid;
begin
  if not boleh('pos') then
    raise exception 'tidak berhak: pos';
  end if;
  if pos_saya() is not null then
    if p_pos is distinct from pos_saya() then
      raise exception 'operator pos % tidak boleh mengunggah foto pos %',
        pos_saya(), p_pos;
    end if;
  end if;

  if coalesce(trim(p_kode_lomba), '') = '' or coalesce(trim(p_path), '') = '' then
    raise exception 'kode lomba dan path wajib diisi';
  end if;

  -- Path harus berada di dalam folder posnya. Tanpa ini seorang operator bisa
  -- mencatat baris pos-nya sendiri yang menunjuk gambar milik pos lain.
  if split_part(p_path, '/', 1) <> 'pos' || p_pos::text then
    raise exception 'path % tidak berada di folder pos %', p_path, p_pos;
  end if;

  select id into v_regu from regu
  where nomor_dada = p_nomor_dada and not is_cancelled;
  if not found then
    raise exception 'nomor dada % tidak dikenal / regu batal',
      case when p_nomor_dada between 0 and 999
        then lpad(p_nomor_dada::text, 3, '0') else p_nomor_dada::text end;
  end if;

  insert into foto_lembar
    (regu_id, pos, kode_lomba, nama_lomba, path, ukuran_bytes, diunggah_oleh)
  values
    (v_regu, p_pos, p_kode_lomba, p_nama_lomba, p_path, p_ukuran, auth.uid())
  -- Mengirim ulang berkas yang sama bukan galat: jaringan lapangan memutus
  -- jawaban, bukan permintaan, dan petugas yang menekan "kirim ulang" tidak
  -- melakukan kesalahan apa pun.
  on conflict (path) do nothing;
end;
$$;

create or replace function ceklis_berangkat(p_nomor_dada integer)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not boleh('keberangkatan') then
    raise exception 'tidak berhak: keberangkatan';
  end if;
  select id into v_id from regu where nomor_dada = p_nomor_dada and not is_cancelled;
  if not found then
    raise exception 'nomor dada % tidak dikenal / batal', p_nomor_dada;
  end if;
  -- Ceklis MENYUSUL (kloter sudah berangkat) wajib berkontrak dulu — tanpa
  -- ini regu lolos penalti waktu selamanya (temuan review, blocker).
  if exists (
       select 1 from regu r
       join kloter k on k.nomor = r.kloter_nomor
       where r.id = v_id and k.jam_berangkat is not null
         and r.kontrak_menit is null) then
    raise exception 'kloter sudah berangkat dan regu belum berkontrak — konfirmasi kontrak dulu (admin)';
  end if;
  insert into keberangkatan_regu (regu_id, recorded_by)
  values (v_id, auth.uid())
  on conflict (regu_id) do nothing;
end;
$$;

create or replace function daftar_ulang_batch(
  p_kode  text,
  -- [{"regu_id": "...", "nomor_dada": 12}, ...] — satu entri per regu yang
  -- belum bernomor di batch ini, tidak boleh kurang dan tidak boleh lebih.
  p_nomor jsonb
)
returns table (regu_id uuid, nama_regu text, golongan text, nomor_dada integer, kloter smallint)
language plpgsql security definer
set search_path = public
as $$
declare
  v_batch      pendaftaran%rowtype;
  v_berhak     uuid[];
  v_regu       uuid[];
  v_nomor      integer[];
  v_n          int;
  v_cfg        edisi%rowtype;
  v_terpakai   int[];      -- kloter yang sudah berisi sekolah ini
  v_kandidat   int;
  v_mulai      int;
  v_i          int;
  v_langkah    int;
  v_salah      text;
begin
  if not boleh('daftar_ulang') then
    raise exception 'tidak berhak: daftar_ulang';
  end if;
  if (select daftar_ulang_ditutup from status_acara) then
    raise exception 'daftar ulang sudah ditutup';
  end if;

  select * into v_cfg from edisi where is_active;

  select * into v_batch from pendaftaran where kode_pembayaran = p_kode for update;
  if not found then
    raise exception 'kode pembayaran tidak dikenal: %', p_kode;
  end if;
  if v_batch.status <> 'lunas' then
    raise exception 'batch belum lunas (status: %)', v_batch.status;
  end if;

  -- Regu yang berhak: belum bernomor, tidak batal (rancangan-b.md, temuan 11).
  select array_agg(r.id order by r.nama_regu, r.id) into v_berhak
  from regu r
  where r.pendaftaran_id = v_batch.id
    and not r.is_cancelled and r.nomor_dada is null;
  v_n := coalesce(array_length(v_berhak, 1), 0);
  if v_n = 0 then
    raise exception 'tidak ada regu yang menunggu nomor dada di batch ini (sudah daftar ulang, atau semua batal)';
  end if;

  -- Pasangan regu -> nomor dari meja. Urutan deterministik (nama regu) supaya
  -- hasil yang dibacakan meja urut sama dengan kartu di layar.
  select array_agg(x.regu_id order by r.nama_regu, r.id),
         array_agg(x.nomor_dada order by r.nama_regu, r.id)
    into v_regu, v_nomor
  from jsonb_to_recordset(coalesce(p_nomor, '[]'::jsonb))
         as x(regu_id uuid, nomor_dada integer)
  join regu r on r.id = x.regu_id;

  if coalesce(array_length(v_regu, 1), 0) <> v_n
     or (select count(distinct g) from unnest(v_regu) as t(g)) <> v_n
     or exists (select 1 from unnest(v_regu) as t(g) where not (t.g = any (v_berhak))) then
    raise exception 'nomor dada harus diisi untuk SEMUA % regu batch ini, satu regu satu nomor', v_n;
  end if;

  if exists (select 1 from unnest(v_nomor) as t(nomor)
             where t.nomor is null or t.nomor <= 0) then
    raise exception 'nomor dada harus angka lebih besar dari 0';
  end if;
  if (select count(distinct t.nomor) from unnest(v_nomor) as t(nomor)) <> v_n then
    raise exception 'nomor dada yang sama diketik untuk dua regu sekaligus';
  end if;

  -- Kunci baris stok yang diminta, urut nomor supaya dua meja yang meminta
  -- himpunan bertumpang tindih tidak saling mengunci silang. Meja kedua
  -- menunggu sebentar lalu ditolak pemeriksaan "sudah dipakai" di bawah,
  -- dengan pesan yang bisa dibaca petugas — bukan galat unique mentah.
  perform 1 from nomor_dada_stok s
  where s.nomor = any (v_nomor)
  order by s.nomor
  for update;

  select string_agg(distinct t.nomor::text, ', ' order by t.nomor::text) into v_salah
  from unnest(v_nomor) as t(nomor)
  where not exists (select 1 from nomor_dada_stok s where s.nomor = t.nomor);
  if v_salah is not null then
    raise exception 'nomor dada di luar stok yang disiapkan admin: %', v_salah;
  end if;

  select string_agg(distinct t.nomor::text, ', ' order by t.nomor::text) into v_salah
  from unnest(v_nomor) as t(nomor)
  where exists (select 1 from nomor_dada_pensiun p where p.nomor = t.nomor);
  if v_salah is not null then
    raise exception 'nomor dada sudah dipensiunkan (bekas tukar) dan tidak boleh terbit lagi: %', v_salah;
  end if;

  select string_agg(distinct t.nomor::text, ', ' order by t.nomor::text) into v_salah
  from unnest(v_nomor) as t(nomor)
  where exists (select 1 from regu r where r.nomor_dada = t.nomor);
  if v_salah is not null then
    raise exception 'nomor dada sudah dipakai regu lain: %', v_salah;
  end if;

  -- Serialisasi bagian penempatan kloter (2-3 meja — advisory lock sederhana
  -- lebih terbaca daripada retry unique-violation; lepas otomatis di akhir tx).
  perform pg_advisory_xact_lock(hashtext('hrcd_daftar_ulang'));

  -- Kloter yang sudah berisi regu sekolah yang sama (batch mana pun).
  select coalesce(array_agg(distinct r.kloter_nomor), '{}') into v_terpakai
  from regu r
  join pendaftaran d on d.id = r.pendaftaran_id
  where d.sekolah_id = v_batch.sekolah_id and r.kloter_nomor is not null;

  -- Sebar N regu: mulai dari kloter termuda yang layak, melompat
  -- lompatan_kloter (alur 5.6); kloter 31.. dibuka hanya bila 1..30 tidak
  -- menyediakan slot layak (alur 5.2). "Layak" = belum penuh + belum berisi
  -- sekolah ini; bila tak terhindarkan, syarat sekolah dilonggarkan (alur 5.4
  -- "sesedikit mungkin", bukan "tidak boleh").
  v_mulai := null;
  for v_i in 1..v_n loop
    v_kandidat := null;

    -- Putaran 1: hormati lompatan + hindari sekolah sama, dalam 1..kloter_dasar.
    if v_mulai is null then
      v_langkah := 1;  -- pencarian pertama: kloter layak termuda
    else
      v_langkah := v_cfg.lompatan_kloter;
    end if;
    select k.nomor into v_kandidat
    from kloter k
    where k.nomor <= v_cfg.kloter_dasar
      and k.jam_berangkat is null
      and k.dicetak_pada is null
      and (v_mulai is null or k.nomor >= v_mulai + v_langkah)
      and not (k.nomor = any (v_terpakai))
      and (select count(*) from regu r where r.kloter_nomor = k.nomor)
          < v_cfg.maks_regu_per_kloter
    order by k.nomor
    limit 1;

    -- Putaran 2: masih hindari sekolah sama tapi abaikan lompatan (wrap).
    if v_kandidat is null then
      select k.nomor into v_kandidat
      from kloter k
      where k.nomor <= v_cfg.kloter_dasar
        and k.jam_berangkat is null
        and k.dicetak_pada is null
        and not (k.nomor = any (v_terpakai))
        and (select count(*) from regu r where r.kloter_nomor = k.nomor)
            < v_cfg.maks_regu_per_kloter
      order by k.nomor
      limit 1;
    end if;

    -- Putaran 3: 1..kloter_dasar masih ada tempat tapi semuanya berisi
    -- sekolah ini — sekolah sama boleh berkumpul DULU sebelum membuka
    -- kloter cadangan (alur 5.2: 31-40 hanya bila 1-30 penuh; alur 5.4:
    -- "sesedikit mungkin", bukan larangan mutlak). Pilih yang paling kosong.
    if v_kandidat is null then
      select k.nomor into v_kandidat
      from kloter k
      where k.nomor <= v_cfg.kloter_dasar
        and k.jam_berangkat is null
        and k.dicetak_pada is null
        and (select count(*) from regu r where r.kloter_nomor = k.nomor)
            < v_cfg.maks_regu_per_kloter
      order by (select count(*) from regu r where r.kloter_nomor = k.nomor), k.nomor
      limit 1;
    end if;

    -- Putaran 4: kloter dasar benar-benar penuh — buka cadangan
    -- (31..kloter_maks), hindari sekolah sama dulu lalu bebas.
    if v_kandidat is null then
      select k.nomor into v_kandidat
      from kloter k
      where k.nomor between v_cfg.kloter_dasar + 1 and v_cfg.kloter_maks
        and k.jam_berangkat is null
        and k.dicetak_pada is null
        and (select count(*) from regu r where r.kloter_nomor = k.nomor)
            < v_cfg.maks_regu_per_kloter
      order by (k.nomor = any (v_terpakai)),   -- false (bebas sekolah) dulu
               (select count(*) from regu r where r.kloter_nomor = k.nomor),
               k.nomor
      limit 1;
    end if;

    if v_kandidat is null then
      raise exception 'semua kloter penuh — tambah kloter atau periksa konfigurasi';
    end if;

    update regu r set
      nomor_dada    = v_nomor[v_i],
      kloter_nomor  = v_kandidat,
      -- Slot terkecil yang kosong, bukan count+1: lubang bekas koreksi admin
      -- tidak boleh membuat slot palsu di atas 10 (temuan review).
      urutan_kloter = (select min(s) from generate_series(1, v_cfg.maks_regu_per_kloter) s
                       where not exists (select 1 from regu x
                                         where x.kloter_nomor = v_kandidat
                                           and x.urutan_kloter = s))
    where r.id = v_regu[v_i];

    v_terpakai := v_terpakai || v_kandidat;
    v_mulai := v_kandidat;
  end loop;

  return query
  select r.id, r.nama_regu, r.golongan, r.nomor_dada, r.kloter_nomor
  from regu r
  where r.id = any (v_regu)
  order by r.nomor_dada;
end;
$$;

create or replace function hapus_nilai_pos(
  p_nomor_dada integer,
  p_kode       text,
  p_pos        smallint default null   -- wajib untuk admin
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_pos    smallint;
  v_regu   uuid;
  v_wahana uuid;
begin
  if not boleh('pos') then
    raise exception 'tidak berhak: pos';
  end if;
  if pos_saya() is not null then
    v_pos := pos_saya();
  else
    v_pos := p_pos;
    if v_pos is null then
      raise exception 'wajib menyebut pos (p_pos)';
    end if;
  end if;

  select id into v_regu from regu
  where nomor_dada = p_nomor_dada and not is_cancelled;
  if not found then
    -- Tiga digit seperti di kain nomor dadanya (migrasi 0020). Nomor di luar
    -- 0-999 dicetak apa adanya: lpad MEMOTONG string yang lebih panjang dari
    -- targetnya, jadi salah ketik "9999" akan dilaporkan sebagai "999" —
    -- petugas lalu mencari nomor yang tidak pernah diketiknya.
    raise exception 'nomor dada % tidak dikenal / regu batal',
      case when p_nomor_dada between 0 and 999
        then lpad(p_nomor_dada::text, 3, '0')
        else p_nomor_dada::text end;
  end if;

  if nilai_tergembok(v_regu, v_pos) then
    raise exception 'Nilai regu ini sudah digembok. Buka gemboknya dulu.';
  end if;

  -- Normalisasi kode disamakan dengan simpan_nilai_massal, supaya kolom yang
  -- bisa DIISI lewat satu pintu selalu bisa DIKOSONGKAN lewat pintu ini.
  select w.id into v_wahana from wahana w
  where w.edisi = edisi_aktif()
    and w.pos = v_pos
    and regexp_replace(lower(coalesce(p_kode, '')), '[^a-z0-9]', '', 'g')
        = regexp_replace(w.kode, '[^a-z0-9]', '', 'g');
  if not found then
    raise exception 'kode komponen tidak dikenal di pos %', v_pos;
  end if;

  delete from nilai_mentah where regu_id = v_regu and wahana_id = v_wahana;
end;
$$;

create or replace function konfirmasi_kontrak(
  p_regu  uuid,
  p_menit smallint
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_kloter smallint;
begin
  if not boleh('daftar_ulang') then
    raise exception 'tidak berhak: daftar_ulang';
  end if;
  if not exists (select 1 from kontrak_opsi
                 where edisi = edisi_aktif() and menit = p_menit) then
    raise exception 'kontrak % menit bukan pilihan edisi ini', p_menit;
  end if;

  select kloter_nomor into v_kloter from regu where id = p_regu;
  if not found then
    raise exception 'regu tidak ditemukan';
  end if;
  if v_kloter is null then
    raise exception 'regu belum daftar ulang (belum punya kloter)';
  end if;
  -- Setelah REGU INI tercatat berangkat, kontraknya menentukan penalti yang
  -- sudah berjalan — perbaikan susulan hanya lewat admin. Kloter yang pergi
  -- tanpa dia tidak menghalangi apa pun.
  if not boleh('pengaturan') and regu_sudah_berangkat(p_regu) then
    raise exception 'regu ini sudah berangkat — koreksi kontrak hanya lewat admin';
  end if;

  update regu set kontrak_menit = p_menit where id = p_regu;
end;
$$;

create or replace function koreksi_jam_berangkat(
  p_kloter smallint,
  p_jam    timestamptz,
  p_alasan text
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_lama timestamptz;
begin
  if not boleh('keberangkatan') then
    raise exception 'tidak berhak: keberangkatan';
  end if;
  if p_jam is null then
    raise exception 'jam berangkat wajib diketik';
  end if;
  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'alasan koreksi wajib diisi';
  end if;

  select jam_berangkat into v_lama from kloter where nomor = p_kloter;
  if not found then
    raise exception 'kloter % tidak ada', p_kloter;
  end if;
  if v_lama is null then
    raise exception 'kloter % belum berangkat — pakai tombol Berangkatkan, bukan koreksi', p_kloter;
  end if;
  -- Tidak berubah: jangan tulis baris audit palsu yang nanti membingungkan
  -- orang yang menelusuri riwayat.
  if p_jam = v_lama then
    return;
  end if;

  -- SENGAJA TIDAK ADA PEMERIKSAAN URUTAN JAM di sini, walau menggoda.
  -- berangkatkan_kloter hanya menjaga urutan NOMOR kloter, bukan urutan jam
  -- yang diketik, jadi data yang jamnya sudah kacau memang mungkin ada. Kalau
  -- fungsi ini menolak jam yang melanggar urutan, kloter 1 tidak bisa
  -- dibetulkan karena jam kloter 2 salah, dan kloter 2 tidak bisa dibetulkan
  -- karena jam kloter 1 salah — panitia terkunci persis di keadaan yang
  -- membuat mereka membuka layar ini. Urutan ditampilkan di dialog koreksi
  -- supaya pencatat melihatnya sendiri; menampilkan menolong, menolak tidak.
  insert into history (table_name, row_id, action, old_value, new_value, changed_by)
  values ('kloter', p_kloter::text, 'UPDATE',
          jsonb_build_object('jam_berangkat', v_lama),
          jsonb_build_object('jam_berangkat', p_jam, 'alasan_koreksi', p_alasan),
          auth.uid());

  update kloter set jam_berangkat = p_jam where nomor = p_kloter;
end;
$$;

create or replace function kunci_nilai_pos(
  p_nomor_dada integer,
  p_pos        smallint default null   -- wajib untuk admin/meja
) returns void
language plpgsql security definer
set search_path = public
as $$
declare v_pos smallint; v_regu uuid;
begin
  if not boleh('pos') then
    raise exception 'tidak berhak: pos';
  end if;
  if pos_saya() is not null then
    v_pos := pos_saya();
    if p_pos is not null and p_pos <> v_pos then
      raise exception 'operator pos % tidak boleh mengunci pos %', v_pos, p_pos;
    end if;
  else
    v_pos := p_pos;
    if v_pos is null then
      raise exception 'wajib menyebut pos (p_pos)';
    end if;
  end if;

  select id into v_regu from regu
  where nomor_dada = p_nomor_dada and not is_cancelled;
  if not found then
    raise exception 'nomor dada % tidak dikenal / regu batal',
      case when p_nomor_dada between 0 and 999
        then lpad(p_nomor_dada::text, 3, '0') else p_nomor_dada::text end;
  end if;

  -- Mengunci dua kali bukan galat: dua petugas bisa menekan gembok yang sama
  -- dari HP berbeda, dan yang kedua tidak melakukan kesalahan apa pun.
  insert into nilai_terkunci (regu_id, pos, locked_by)
  values (v_regu, v_pos, auth.uid())
  on conflict (regu_id, pos) do nothing;
end;
$$;

create or replace function pindah_kloter(
  p_nomor_dada integer,
  p_alasan     text,
  p_kloter     smallint default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_regu    regu%rowtype;
  v_cfg     edisi%rowtype;
  v_tujuan  smallint;
  v_isi     int;
  v_perlu_diumumkan boolean;
  v_tercetak boolean;
  v_lama    smallint;
  v_tujuan_berangkat boolean;
begin
  if not boleh('cetak_kloter') then
    raise exception 'tidak berhak: cetak_kloter';
  end if;
  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'alasan pemindahan wajib diisi — tercatat di riwayat';
  end if;

  select * into v_cfg from edisi where is_active;

  -- Serialisasi bersama daftar ulang: keduanya menyentuh isi kloter.
  perform pg_advisory_xact_lock(hashtext('hrcd_daftar_ulang'));

  select * into v_regu from regu where nomor_dada = p_nomor_dada for update;
  if not found then
    raise exception 'nomor dada % tidak dikenal', p_nomor_dada;
  end if;
  if v_regu.is_cancelled then
    raise exception 'regu % berstatus batal', p_nomor_dada;
  end if;
  v_lama := v_regu.kloter_nomor;

  -- Yang menghalangi BUKAN keberangkatan kloternya, melainkan keberangkatan
  -- REGU ini. Lihat catatan panjang di kepala berkas.
  if regu_sudah_berangkat(v_regu.id) then
    raise exception 'regu % ikut berangkat bersama kloter % — kalau itu keliru, batalkan dulu keberangkatan kloter itu lewat admin',
      p_nomor_dada, v_lama;
  end if;

  if p_kloter is null then
    -- TELAT BIASA: kloter terakhir yang belum berangkat dan masih muat.
    select k.nomor into v_tujuan
    from kloter k
    where k.jam_berangkat is null
      and k.nomor <= v_cfg.kloter_maks
      and (select count(*) from regu r where r.kloter_nomor = k.nomor)
          < v_cfg.maks_regu_per_kloter
    order by k.nomor desc
    limit 1;
    if v_tujuan is null then
      raise exception 'tidak ada kloter tersisa yang belum berangkat dan masih muat';
    end if;
  else
    -- URGENT: kloter yang disebut panitia, apa pun keadaannya — termasuk yang
    -- sudah berangkat, karena regu telat yang berlari menyusul memang
    -- berangkat bersama kloter itu.
    v_tujuan := p_kloter;
    if not exists (select 1 from kloter where nomor = v_tujuan) then
      raise exception 'kloter % tidak ada', v_tujuan;
    end if;
  end if;

  if v_tujuan = v_lama then
    raise exception 'regu % sudah ada di kloter %', p_nomor_dada, v_tujuan;
  end if;

  -- Kapasitas tetap dijaga: kertas boleh dilanggar, kapasitas fisik tidak.
  select count(*) into v_isi from regu
   where kloter_nomor = v_tujuan and not is_cancelled;
  if v_isi >= v_cfg.maks_regu_per_kloter then
    raise exception 'kloter % sudah penuh (% regu)', v_tujuan, v_isi;
  end if;

  -- Perlu diumumkan bukan hanya bila kertasnya sudah dicetak, tapi juga bila
  -- kloternya sudah berangkat: keduanya berarti petugas staging memegang
  -- daftar yang tidak memuat nomor ini. Keduanya berdiri sendiri —
  -- batalkan_tanda_cetak tidak memeriksa keberangkatan sama sekali.
  select dicetak_pada is not null or jam_berangkat is not null,
         dicetak_pada is not null,
         jam_berangkat is not null
    into v_perlu_diumumkan, v_tercetak, v_tujuan_berangkat
  from kloter where nomor = v_tujuan;

  -- Buka pintu untuk trigger 0008, hanya di dalam transaksi ini.
  perform set_config('hrcd.izin_pindah', '1', true);

  update regu set
    kloter_nomor  = v_tujuan,
    urutan_kloter = (select min(s) from generate_series(1, v_cfg.maks_regu_per_kloter) s
                     where not exists (select 1 from regu x
                                       where x.kloter_nomor = v_tujuan
                                         and x.urutan_kloter = s)),
    -- Ditandai sisipan HANYA bila kertas tujuan sudah beredar.
    disisipkan_pada = case when v_perlu_diumumkan then now() else disisipkan_pada end,
    alasan_sisip    = case when v_perlu_diumumkan then p_alasan else alasan_sisip end
  where id = v_regu.id;

  perform set_config('hrcd.izin_pindah', '0', true);

  -- old_value diisi, seperti koreksi_jam_berangkat (0017): kedua fungsi ini
  -- mengubah dasar penalti yang sama, dan sengketa nilai diselesaikan dari
  -- baris inilah — tanpa kloter lamanya, tidak ada yang bisa ditelusuri.
  insert into history (table_name, row_id, regu_id, action, old_value, new_value, changed_by)
  values ('regu', v_regu.id::text, v_regu.id, 'UPDATE',
          jsonb_build_object('kloter_nomor', v_lama,
                             'urutan_kloter', v_regu.urutan_kloter),
          jsonb_build_object('pindah_kloter', jsonb_build_object(
            'nomor_dada', p_nomor_dada, 'dari', v_lama, 'ke', v_tujuan,
            'alasan', p_alasan, 'kloter_tujuan_sudah_dicetak', v_tercetak,
            'kloter_tujuan_sudah_berangkat', v_tujuan_berangkat)),
          auth.uid());

  return jsonb_build_object(
    'nomor_dada', p_nomor_dada,
    'kloter_lama', v_lama,
    'kloter_baru', v_tujuan,
    'sisipan', v_perlu_diumumkan,
    'tujuan_sudah_berangkat', v_tujuan_berangkat,
    -- Satu peringatan, digabung: dua kotak merah beruntun tidak terbaca.
    'peringatan', nullif(concat_ws(' ',
      case when v_perlu_diumumkan then
        format('Nomor %s TIDAK ADA di kertas kloter %s. Beri tahu petugas staging.',
               p_nomor_dada, v_tujuan) end,
      case when v_tujuan_berangkat then
        format('Kloter %s sudah berangkat, jadi nomor %s dinilai dari jam berangkat kloter itu.',
               v_tujuan, p_nomor_dada) end), ''));
end;
$$;

create or replace function simpan_nilai_massal(
  p_baris  jsonb,  -- [{"nomor_dada":1,"kode":"lari_zigzag","nilai_1":40,"nilai_2":null}, ...]
  p_sumber text default 'upload',
  p_pos    smallint default null  -- wajib untuk admin; operator memakai pos-nya sendiri
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_r      jsonb;
  v_regu   regu%rowtype;
  v_wahana wahana%rowtype;
  v_hasil  jsonb := '[]'::jsonb;
  v_status text;
  v_alasan text;
  v_idx    int := 0;
  v_pos    smallint;
  v_kunci  text;
  v_sudah  text[] := '{}';
  v_n1     numeric;
  v_n2     numeric;
begin
  if not boleh('pos') then
    raise exception 'tidak berhak: pos';
  end if;
  if pos_saya() is not null then
    v_pos := pos_saya();
  else
    v_pos := p_pos;
    if v_pos is null then
      raise exception 'wajib menyebut pos (p_pos)';
    end if;
  end if;
  if p_sumber not in ('manual', 'upload') then
    raise exception 'sumber tidak dikenal: %', p_sumber;
  end if;

  for v_r in select * from jsonb_array_elements(p_baris) loop
    v_idx := v_idx + 1;
    v_status := 'tersimpan'; v_alasan := null;

    -- Seluruh pemrosesan baris terlindungi: format angka rusak di baris 7
    -- tidak boleh menggagalkan 26 baris lain (temuan review).
    begin
      v_n1 := (v_r ->> 'nilai_1')::numeric;
      v_n2 := nullif(v_r ->> 'nilai_2', '')::numeric;

      -- Baris ganda dalam SATU paste = merah (bagian 6.3) — juga di server.
      v_kunci := (v_r ->> 'nomor_dada') || '|' ||
                 regexp_replace(lower(coalesce(v_r ->> 'kode', '')), '[^a-z0-9]', '', 'g');
      if v_kunci = any (v_sudah) then
        raise exception 'baris ganda dalam paste (nomor dada + komponen sama)';
      end if;
      v_sudah := v_sudah || v_kunci;

      -- Regu: harus dikenal, bernomor, tidak batal.
      select * into v_regu from regu
      where nomor_dada = (v_r ->> 'nomor_dada')::integer and not is_cancelled;
      if not found then
        raise exception 'nomor dada tidak dikenal / regu batal';
      end if;

      -- Komponen: HANYA pos ini (kode boleh kembar antar pos — temuan
      -- review); normalisasi dua arah supaya "Lari Zigzag" dari header foto
      -- cocok dengan kode lari_zigzag.
      select w.* into v_wahana from wahana w
      where w.edisi = edisi_aktif()
        and w.pos = v_pos
        and regexp_replace(lower(coalesce(v_r ->> 'kode', '')), '[^a-z0-9]', '', 'g')
            = regexp_replace(w.kode, '[^a-z0-9]', '', 'g');
      if not found then
        raise exception 'kode komponen tidak dikenal di pos % — mungkin ini lembar pos lain?', v_pos;
      end if;

      -- Baris yang sudah DIGEMBOK: tolak, apa pun isinya.
      --
      -- Diperiksa di server, bukan cukup di layar. Lembar pos dibuka di
      -- beberapa HP sekaligus, dan HP yang layarnya dimuat SEBELUM gemboknya
      -- dipasang tidak tahu apa-apa tentang gembok itu — ia akan mengirim
      -- angka dengan penuh keyakinan.
      if nilai_tergembok(v_regu.id, v_pos) then
        raise exception 'Nilai regu ini sudah digembok. Buka gemboknya dulu.';
      end if;

      -- Komponen milik golongan lain: TOLAK.
      --
      -- Sejak 0030 satu lomba boleh punya dua baris `wahana`, satu per
      -- golongan (Tebak Simpul: 5 objek untuk penggalang, 10 untuk penegak).
      -- Keduanya muncul sebagai kolom di lembar yang sama, jadi tanpa pagar
      -- ini satu regu bisa terisi DUA-DUANYA — dan totalnya 200 dari
      -- maksimum 100, tanpa satu pun galat yang memberi tahu siapa pun.
      if not komponen_berlaku(v_wahana.golongan, v_regu.golongan) then
        raise exception 'Komponen ini untuk golongan lain.';
      end if;

      -- Rentang wajar dari konfigurasi (merah di preview = tolak di server).
      if v_n1 is null
         or v_n1 not between v_wahana.rentang_mentah_min and v_wahana.rentang_mentah_maks then
        -- trim_scale membuang nol di belakang koma: rentang_mentah_min
        -- bertipe numeric(10,2), jadi tanpa ini pesannya berbunyi
        -- "antara 0.00 - 20.00" — angka yang tidak pernah ditulis siapa pun
        -- di kertas, dan yang membacanya jadi ragu apakah pecahan diterima.
        raise exception 'Input harus antara % - %.',
          trim_scale(v_wahana.rentang_mentah_min),
          trim_scale(v_wahana.rentang_mentah_maks);
      end if;
      -- nilai_2 (jumlah salah) ikut divalidasi (temuan review).
      if v_n2 is not null
         and v_n2 not between 0 and v_wahana.rentang_mentah_maks then
        raise exception 'Jumlah salah harus antara 0 - %.',
          trim_scale(v_wahana.rentang_mentah_maks);
      end if;

      insert into nilai_mentah (regu_id, wahana_id, nilai_1, nilai_2, source, created_by)
      values (v_regu.id, v_wahana.id, v_n1, v_n2, p_sumber, auth.uid())
      on conflict (regu_id, wahana_id) do update set
        nilai_1 = excluded.nilai_1,
        nilai_2 = excluded.nilai_2,
        source  = excluded.source,
        created_by = excluded.created_by,
        created_at = now()
      -- Simpan ulang tanpa perubahan = tidak menulis apa pun: kepengarangan
      -- tidak tergeser, riwayat tidak dibanjiri (temuan review).
      where nilai_mentah.nilai_1 is distinct from excluded.nilai_1
         or nilai_mentah.nilai_2 is distinct from excluded.nilai_2;

    exception when others then
      v_status := 'ditolak';
      v_alasan := sqlerrm;
    end;

    v_hasil := v_hasil || jsonb_build_object(
      'baris', v_idx,
      'nomor_dada', v_r ->> 'nomor_dada',
      'kode', v_r ->> 'kode',
      'status', v_status,
      'alasan', v_alasan);
  end loop;

  return v_hasil;
end;
$$;

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

  -- Kebutuhan per batch: regu aktif x 5 + pendamping, terbesar dulu.
  for v_b in
    select d.id, (count(r.id) filter (where not r.is_cancelled)) * 5
           + d.jumlah_pendamping as butuh
    from pendaftaran d
    join regu r on r.pendaftaran_id = d.id
    where d.butuh_barak and d.status = 'lunas'
    group by d.id, d.jumlah_pendamping
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

create or replace function tandai_kloter_dicetak(p_kloter smallint[] default null)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_jumlah integer;
begin
  if not boleh('cetak_kloter') then
    raise exception 'tidak berhak: cetak_kloter';
  end if;

  update kloter k
  set dicetak_pada = now()
  where k.dicetak_pada is null
    and (p_kloter is null or k.nomor = any (p_kloter))
    and exists (select 1 from regu r
                join pendaftaran d on d.id = r.pendaftaran_id
                where r.kloter_nomor = k.nomor and not r.is_cancelled
                  and d.status = 'lunas');
  get diagnostics v_jumlah = row_count;
  return v_jumlah;
end;
$$;

create or replace function tukar_nomor_dada(
  p_regu       uuid,
  p_nomor_baru integer,
  p_alasan     text
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_regu    regu%rowtype;
  v_beredar boolean;
begin
  if not boleh('daftar_ulang') then
    raise exception 'tidak berhak: daftar_ulang';
  end if;
  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'alasan tukar wajib diisi';
  end if;

  select * into v_regu from regu where id = p_regu for update;
  if not found then
    raise exception 'regu tidak ditemukan';
  end if;
  if v_regu.is_cancelled then
    raise exception 'regu berstatus batal';
  end if;
  if v_regu.nomor_dada is null then
    raise exception 'regu belum punya nomor dada';
  end if;
  -- Begitu kertasnya DICETAK, lembar yang beredar memakai nomor lama —
  -- penukaran hanya boleh oleh admin yang paham konsekuensinya. Keberangkatan
  -- ikut dihitung karena kloter yang sudah jalan pasti kertasnya beredar,
  -- walau tanda cetaknya sempat dibatalkan (batalkan_tanda_cetak tidak
  -- memeriksa keberangkatan sama sekali).
  v_beredar := exists (
    select 1 from kloter where nomor = v_regu.kloter_nomor
      and (dicetak_pada is not null or jam_berangkat is not null));

  if not boleh('pengaturan') and v_beredar then
    raise exception 'kertas kloter ini sudah beredar — tukar nomor hanya lewat admin';
  end if;
  if not exists (select 1 from nomor_dada_stok where nomor = p_nomor_baru) then
    raise exception 'nomor % tidak ada di stok', p_nomor_baru;
  end if;
  if exists (select 1 from regu where nomor_dada = p_nomor_baru)
     or exists (select 1 from nomor_dada_pensiun where nomor = p_nomor_baru) then
    raise exception 'nomor % sudah terpakai / pensiun', p_nomor_baru;
  end if;

  insert into history (table_name, row_id, regu_id, action, new_value, changed_by)
  values ('regu', p_regu::text, p_regu, 'UPDATE',
          jsonb_build_object('alasan_tukar_nomor', p_alasan,
                             'nomor_lama', v_regu.nomor_dada,
                             'nomor_baru', p_nomor_baru), auth.uid());

  -- Nomor lama dipensiunkan HANYA bila kertasnya sudah beredar.
  --
  -- Dulu selalu, dan itu menghukum kasus yang paling sering: petugas meja
  -- salah ketik satu digit, lalu kain nomor lama yang masih utuh di kardus
  -- ikut mati — regu yang benar-benar memegangnya nanti ditolak permanen.
  --
  -- Sesudah kertas beredar ceritanya lain, dan justru makin genting sejak
  -- form per lomba dipakai: slip yang ditulis petugas hanya memuat NOMOR DADA.
  -- Kalau 001 terbit ulang ke regu lain, slip bertuliskan 001 tidak bisa lagi
  -- dipastikan milik siapa — lembar lama menyebut Melati, kenyataan menyebut
  -- orang lain, dan tidak ada apa pun di kertas yang membedakannya.
  --
  -- Patokannya SATU variabel dengan yang mengatur izin di atas. Dua patokan
  -- terpisah untuk pertanyaan yang sama ("apakah kertas sudah beredar") adalah
  -- cara mereka mulai berbeda pendapat — persis yang dibetulkan 0019.
  if v_beredar then
    insert into nomor_dada_pensiun (nomor, reason)
    values (v_regu.nomor_dada, p_alasan);
  end if;

  update regu set nomor_dada = p_nomor_baru where id = p_regu;
end;
$$;

create or replace function ubah_pendamping(p_kode text, p_jumlah smallint)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not boleh('daftar_ulang') then
    raise exception 'tidak berhak: daftar_ulang';
  end if;
  if p_jumlah is null or p_jumlah < 0 then
    raise exception 'jumlah pendamping tidak sah';
  end if;
  update pendaftaran set jumlah_pendamping = p_jumlah
  where kode_pembayaran = p_kode;
  if not found then
    raise exception 'kode pembayaran tidak dikenal: %', p_kode;
  end if;
end;
$$;

create or replace function verifikasi_pembayaran(
  p_kode    text,
  p_nominal integer,
  p_metode  text
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_batch     pendaftaran%rowtype;
  v_tagihan   integer;
  v_kwitansi  text;
begin
  if not boleh('pembayaran') then
    raise exception 'tidak berhak: pembayaran';
  end if;

  select * into v_batch from pendaftaran where kode_pembayaran = p_kode for update;
  if not found then
    raise exception 'kode pembayaran tidak dikenal: %', p_kode;
  end if;
  if v_batch.status <> 'menunggu_pembayaran' then
    raise exception 'batch berstatus %, bukan menunggu_pembayaran', v_batch.status;
  end if;

  -- Semua-atau-tidak: nominal harus pas seluruh batch (alur 3.5).
  select v_batch.jumlah_regu * biaya_per_regu into v_tagihan from edisi where is_active;
  if p_nominal <> v_tagihan then
    raise exception 'nominal % tidak sama dengan tagihan % — pembayaran sebagian tidak dilayani; sarankan daftar batch lebih kecil',
      p_nominal, v_tagihan;
  end if;

  v_kwitansi := 'KW-HRCD' || edisi_aktif() || '-' ||
                lpad(nextval('kwitansi_seq')::text, 4, '0');

  insert into pembayaran (pendaftaran_id, amount, method, nomor_kwitansi, verified_by)
  values (v_batch.id, p_nominal, p_metode, v_kwitansi, auth.uid());

  update pendaftaran set status = 'lunas' where id = v_batch.id;

  return jsonb_build_object('nomor_kwitansi', v_kwitansi);
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Pemeriksaan penutup.
--
--    Ia memindai katalog, bukan berkas migrasi — jadi ia melihat apa yang
--    BENAR-BENAR terpasang, termasuk objek yang luput dari daftar di atas.
--    Kalau masih ada satu pun policy atau fungsi yang menyebut nama peran yang
--    sudah tidak ada, migrasinya gagal di sini, bukan diam-diam meninggalkan
--    satu layar yang lumpuh sampai ada panitia yang menemukannya.
-- ---------------------------------------------------------------------------
do $blok$
declare
  r      record;
  v_n    int := 0;
begin
  for r in
    select 'policy'::text as jenis, schemaname || '.' || tablename || '.' || policyname as nama
      from pg_policies
     where coalesce(qual, '') || coalesce(with_check, '') ~ '''meja''|''operator_pos'''
    union all
    select 'fungsi', p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosrc ~ '''meja''|''operator_pos'''
       and p.proname <> 'paket_peran'
    order by 1, 2
  loop
    v_n := v_n + 1;
    raise notice '0064: MASIH menyebut peran lama — % %', r.jenis, r.nama;
  end loop;

  if v_n > 0 then
    raise exception '0064: % objek masih menyebut peran lama (daftar di atas). '
      'Setiap satu di antaranya adalah satu layar yang lumpuh.', v_n;
  end if;
  raise notice '0064: tidak ada lagi policy/fungsi yang menyebut peran lama.';
end $blok$;

-- ---------------------------------------------------------------------------
-- 6. Dan pastikan hak tiap peran memang masih utuh sesudah semua ini.
-- ---------------------------------------------------------------------------
do $blok$
declare r record;
begin
  for r in
    select a.peran, count(*) as n
      from akun_panitia a join akun_hak h on h.user_id = a.user_id
     where a.is_active
     group by a.peran order by a.peran
  loop
    raise notice '0064: peran % — % hak tercentang', r.peran, r.n;
  end loop;
end $blok$;

