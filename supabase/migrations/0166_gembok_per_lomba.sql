-- ============================================================================
-- hrcd-rekap : 0166_gembok_per_lomba.sql
-- Gembok nilai jadi PER LOMBA, bukan per pos.
--
-- ALUR YANG DIMINTA PEMILIK ACARA (31 Agustus 2026)
--
-- Panitia membuka layar Cek Nilai, melihat foto slipnya di sebelah angka yang
-- diketik, dan kalau cocok ia mengetuk gembok di sebelah angka itu. Satu
-- gembok per LOMBA, jadi Pos 1 punya lima gembok: Semaphore, Tebak Simpul,
-- Menaksir, Keagamaan, Kepramukaan.
--
-- Gembok per pos tidak bisa menyatakan itu. Ia cuma bisa bilang "seluruh pos
-- ini sudah diperiksa", padahal yang benar-benar diperiksa satu lomba pada
-- satu waktu -- dan sisanya masih boleh diperbaiki.
--
-- KUNCINYA MEMAKAI KUNCI YANG SAMA DENGAN LAYAR, DAN ITU BUKAN `wahana.kode`
--
-- Satu lomba bisa terdiri dari beberapa komponen (Pembidaian lima kriteria,
-- KIM dua) dan bisa punya beberapa baris wahana untuk golongan berbeda (Tebak
-- Simpul empat baris). Yang menyatukannya `coalesce(lomba, name)`, persis yang
-- dilakukan kelompokLomba() di layar.
--
-- Kunci tetapnya `wahana.kode_lomba` (0079), dan untuk lomba berkomponen
-- banyak yang dipakai adalah kode_lomba komponen ber-sort_order TERKECIL --
-- lagi-lagi persis yang dilakukan layar, yang mengambil `varian[0].kode_lomba`
-- dari kolom pertama kelompoknya. Diturunkan ulang di sini akan melahirkan
-- kunci kedua yang suatu hari berbeda pendapat dengan yang dipakai foto slip.
--
-- `v_lomba_pos` di bawah menuliskan aturan itu SEKALI, dan sisanya membacanya.
--
-- YANG TIDAK BERUBAH
--
-- Pagar hak buka gembok dibiarkan apa adanya -- keputusan pemilik acara. Yang
-- berubah cuma butirannya: buka_kunci_nilai_pos sekarang membuka satu lomba,
-- dengan pemeriksaan hak yang sama persis seperti sebelumnya.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Daftar lomba per pos, satu baris per lomba.
--
--    `distinct on` mengambil komponen ber-sort_order terkecil di tiap
--    kelompok, dan kode_lomba MILIK DIA yang jadi kunci lombanya. Urutan
--    kedua (`w.kode`) memutus seri supaya hasilnya tidak bergantung pada
--    urutan baris di tabel -- dua baris ber-sort_order sama akan memberi
--    kunci yang berbeda tiap kali view ini dibaca, dan gembok yang kuncinya
--    berpindah adalah gembok yang tidak menahan apa pun.
-- ---------------------------------------------------------------------------
create or replace view v_lomba_pos as
select distinct on (w.edisi, w.pos, coalesce(w.lomba, w.name))
       w.edisi,
       w.pos,
       w.kode_lomba              as kode,
       coalesce(w.lomba, w.name) as nama
from wahana w
order by w.edisi, w.pos, coalesce(w.lomba, w.name), w.sort_order, w.kode;

comment on view v_lomba_pos is
  'Satu baris per LOMBA per pos, dengan kunci tetapnya. Aturan penyatuannya '
  'sama dengan kelompokLomba() di layar: coalesce(lomba, name), dan kode_lomba '
  'diambil dari komponen ber-sort_order terkecil.';

grant select on v_lomba_pos to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Lomba mana yang dimiliki satu komponen.
--
--    Dipakai jalur tulis untuk memutuskan gembok mana yang berlaku atas satu
--    nilai. Sengaja fungsi, bukan join yang disalin ke tiga tempat.
-- ---------------------------------------------------------------------------
create or replace function lomba_komponen(p_wahana uuid)
returns text
language sql
stable
set search_path = public
as $$
  select l.kode
  from wahana w
  join v_lomba_pos l
    on l.edisi = w.edisi and l.pos = w.pos
   and l.nama = coalesce(w.lomba, w.name)
  where w.id = p_wahana
$$;

-- ---------------------------------------------------------------------------
-- 3. Kolom baru, diisi dari gembok lama, lalu dijadikan bagian kunci.
--
--    Gembok pos yang sudah ada DIPECAH jadi gembok tiap lomba pos itu
--    (keputusan pemilik acara): yang sudah dinyatakan selesai tetap
--    dinyatakan selesai, dan tidak ada satu nilai pun yang tiba-tiba terbuka
--    tanpa ada yang memutuskannya.
-- ---------------------------------------------------------------------------
alter table nilai_terkunci add column if not exists kode_lomba text;

-- KUNCI LAMA DILEPAS DULU, SEBELUM PEMECAHAN. Selama `(regu_id, pos)` masih
-- jadi primary key, gembok kedua untuk pos yang sama ditolak — jadi pemecahan
-- gagal tepat pada baris kedua tiap pos.
--
-- Ini TIDAK terlihat di database uji, karena di sana `nilai_terkunci` kosong
-- dan pemecahannya tidak menyisipkan apa pun. Yang menemukannya menjalankan
-- migrasi ini ke database dev yang memang punya satu gembok. Produksi punya
-- gembok juga.
alter table nilai_terkunci drop constraint if exists nilai_terkunci_pkey;

do $$
declare v_pecah int; v_sisa int;
begin
  -- Baris lama (kode_lomba masih null) melahirkan satu baris per lomba pos
  -- itu, lalu dirinya sendiri dibuang.
  with lama as (
    select regu_id, pos, reason, locked_by, locked_at
    from nilai_terkunci where kode_lomba is null
  ), tanam as (
    insert into nilai_terkunci (regu_id, pos, kode_lomba, reason, locked_by, locked_at)
    select lama.regu_id, lama.pos, l.kode, lama.reason, lama.locked_by, lama.locked_at
    from lama
    join v_lomba_pos l on l.pos = lama.pos and l.edisi = edisi_aktif()
    returning 1
  )
  select count(*) into v_pecah from tanam;

  delete from nilai_terkunci where kode_lomba is null;

  select count(*) into v_sisa from nilai_terkunci;
  raise notice '0166: gembok lama dipecah jadi % baris per lomba; total sekarang %',
    v_pecah, v_sisa;
end;
$$;

-- Baris tanpa lomba tidak boleh ada lagi: kunci yang setengah kosong berarti
-- ada nilai yang tergembok tanpa ada yang tahu lomba mana.
alter table nilai_terkunci alter column kode_lomba set not null;
alter table nilai_terkunci add primary key (regu_id, pos, kode_lomba);

-- ---------------------------------------------------------------------------
-- 4. Dua pertanyaan yang berbeda, dua fungsi.
--
--    Yang tiga argumen menjawab "lomba INI tergembok?" — itu yang dipakai
--    jalur tulis dan layar.
--
--    Yang dua argumen DIPERTAHANKAN dan artinya sengaja "ADA yang tergembok
--    di pos ini", bukan "semuanya". Ia dibaca `v_lembar_pos.terkunci`, dan
--    pembaca lama yang belum tahu soal lomba lebih baik menahan terlalu
--    banyak daripada terlalu sedikit: menahan yang boleh diubah cuma
--    merepotkan, meloloskan yang sudah diverifikasi menghapus pekerjaan orang.
-- ---------------------------------------------------------------------------
create or replace function nilai_tergembok(p_regu uuid, p_pos smallint, p_lomba text)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from nilai_terkunci
    where regu_id = p_regu and pos = p_pos and kode_lomba = p_lomba)
$$;

create or replace function nilai_tergembok(p_regu uuid, p_pos smallint)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from nilai_terkunci where regu_id = p_regu and pos = p_pos)
$$;

-- ---------------------------------------------------------------------------
-- 5. Lembar pos membawa DAFTAR lomba yang tergembok, bukan cuma ya/tidak.
--
--    Tanpa ini layar juri tidak bisa mematikan kotak per lomba: ia cuma tahu
--    "ada yang digembok" dan akan mematikan seluruh barisnya, termasuk lomba
--    yang memang masih boleh diperbaiki.
-- ---------------------------------------------------------------------------
create or replace view v_lembar_pos as
select p.nomor as pos,
    p.name as nama_pos,
    p.bayangan,
    r.id as regu_id,
    r.nomor_dada,
    r.nama_regu,
    s.name as nama_sekolah,
    r.golongan,
    coalesce((select jsonb_object_agg(w.kode, jsonb_build_object('nilai_1', n.nilai_1, 'nilai_2', n.nilai_2))
           from nilai_mentah n join wahana w on w.id = n.wahana_id
          where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor), '{}'::jsonb) as nilai,
    ((select count(*) from nilai_mentah n join wahana w on w.id = n.wahana_id
          where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor))::integer as jumlah_terisi,
    ((select count(*) from wahana w
          where w.edisi = p.edisi and w.pos = p.nomor and komponen_berlaku(w.golongan, r.golongan)))::integer as jumlah_komponen,
    round(coalesce((select sum(hitung_poin(w.form, n.nilai_1, n.nilai_2, w.poin_maks, w.raw_terbaik, w.raw_terburuk, w.poin_benar, w.poin_salah, w.total_soal, w.tingkat))
           from nilai_mentah n join wahana w on w.id = n.wahana_id
          where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor), 0::numeric) * p.bobot, 2) as nilai_pos,
    nilai_tergembok(r.id, p.nomor) as terkunci,
    coalesce((select array_agg(t.kode_lomba order by t.kode_lomba)
           from nilai_terkunci t
          where t.regu_id = r.id and t.pos = p.nomor), '{}'::text[]) as lomba_terkunci
   from regu r
     join pendaftaran d on d.id = r.pendaftaran_id
     join sekolah s on s.id = d.sekolah_id
     cross join pos p
  where p.edisi = edisi_aktif() and not r.is_cancelled and d.status = 'lunas'::text
    and r.nomor_dada is not null and boleh('pos'::text)
    and (pos_saya() is null or p.nomor = pos_saya())
    and (exists (select 1 from wahana w
          where w.edisi = p.edisi and w.pos = p.nomor and komponen_berlaku(w.golongan, r.golongan)));

-- ---------------------------------------------------------------------------
-- 6. Jalur tulis memeriksa gembok LOMBA komponen itu, bukan gembok posnya.
--
--    KEDUA FUNGSI DI BAWAH ADALAH SALINAN PERSIS dari migrasi yang terakhir
--    menuliskannya -- simpan_nilai_massal dari 0119, hapus_nilai_pos dari
--    0064 -- dengan SATU blok penjaga yang diganti di masing-masing.
--
--    Ditulis ulang dari ingatan sekali dan langsung salah: simpan_nilai_massal
--    mengembalikan jsonb, bukan integer, dan `create or replace` menolaknya
--    dengan "cannot change return type of existing function". Fungsi ini jalur
--    tulis SETIAP nilai di sistem; yang boleh berubah di sini cuma baris yang
--    memang dimaksud.
-- ---------------------------------------------------------------------------
create or replace function simpan_nilai_massal(
  p_baris  jsonb,
  p_sumber text default 'upload',
  p_pos    smallint default null
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

    begin
      v_n1 := (v_r ->> 'nilai_1')::numeric;
      v_n2 := nullif(v_r ->> 'nilai_2', '')::numeric;

      v_kunci := (v_r ->> 'nomor_dada') || '|' ||
                 regexp_replace(lower(coalesce(v_r ->> 'kode', '')), '[^a-z0-9]', '', 'g');
      if v_kunci = any (v_sudah) then
        raise exception 'baris ganda dalam paste (nomor dada + komponen sama)';
      end if;
      v_sudah := v_sudah || v_kunci;

      select * into v_regu from regu
      where nomor_dada = (v_r ->> 'nomor_dada')::integer and not is_cancelled;
      if not found then
        raise exception 'nomor dada tidak dikenal / regu batal';
      end if;

      select w.* into v_wahana from wahana w
      where w.edisi = edisi_aktif()
        and w.pos = v_pos
        and regexp_replace(lower(coalesce(v_r ->> 'kode', '')), '[^a-z0-9]', '', 'g')
            = regexp_replace(w.kode, '[^a-z0-9]', '', 'g');
      if not found then
        raise exception 'kode komponen tidak dikenal di pos % — mungkin ini lembar pos lain?', v_pos;
      end if;

      -- 0166: gembok per LOMBA, bukan per pos. `v_wahana` sudah di tangan di
      -- titik ini, jadi butirannya berubah tanpa mengubah bentuk fungsinya.
      -- Pesannya menyebut LOMBANYA: "nilai regu ini sudah digembok" di pos
      -- berisi lima lomba tidak memberi tahu yang mana.
      if nilai_tergembok(v_regu.id, v_pos, lomba_komponen(v_wahana.id)) then
        raise exception 'Lomba % sudah digembok. Buka gemboknya dulu.',
          coalesce(v_wahana.lomba, v_wahana.name);
      end if;

      if not komponen_berlaku(v_wahana.golongan, v_regu.golongan) then
        raise exception 'Komponen ini untuk golongan lain.';
      end if;

      if v_n1 is null
         or v_n1 not between v_wahana.rentang_mentah_min and v_wahana.rentang_mentah_maks then
        raise exception 'Input % harus antara %.',
          v_wahana.name,
          rentang_input_nilai(v_wahana.rentang_mentah_min,
                              v_wahana.rentang_mentah_maks,
                              v_wahana.satuan);
      end if;
      if v_n2 is not null
         and v_n2 not between 0 and v_wahana.rentang_mentah_maks then
        raise exception 'Jumlah salah % harus antara 0 - %.',
          v_wahana.name,
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

  -- 0166: gembok per LOMBA, bukan per pos.
  if nilai_tergembok(v_regu, v_pos, lomba_komponen(v_wahana)) then
    raise exception 'Lomba ini sudah digembok. Buka gemboknya dulu.';
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

-- ---------------------------------------------------------------------------
-- 7. Menggembok dan membukanya, per lomba.
--
--    Pagar haknya SAMA PERSIS dengan sebelumnya — keputusan pemilik acara.
--    Yang berubah cuma satu argumen dan satu kolom.
-- ---------------------------------------------------------------------------
create or replace function kunci_nilai_pos(p_nomor_dada integer, p_pos smallint, p_lomba text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_pos smallint; v_regu uuid;
begin
  if not boleh('pos') then raise exception 'tidak berhak: pos'; end if;
  if pos_saya() is not null then
    v_pos := pos_saya();
    if p_pos is not null and p_pos <> v_pos then
      raise exception 'operator pos % tidak boleh mengunci pos %', v_pos, p_pos;
    end if;
  else
    v_pos := p_pos;
    if v_pos is null then raise exception 'wajib menyebut pos (p_pos)'; end if;
  end if;

  if p_lomba is null or p_lomba = '' then
    raise exception 'wajib menyebut lomba (p_lomba)';
  end if;
  if not exists (select 1 from v_lomba_pos
                 where edisi = edisi_aktif() and pos = v_pos and kode = p_lomba) then
    raise exception 'lomba % tidak ada di pos %', p_lomba, v_pos;
  end if;

  select id into v_regu from regu where nomor_dada = p_nomor_dada and not is_cancelled;
  if not found then
    raise exception 'nomor dada % tidak dikenal / regu batal',
      case when p_nomor_dada between 0 and 999
        then lpad(p_nomor_dada::text, 3, '0') else p_nomor_dada::text end;
  end if;

  -- Menggembok dua kali bukan galat: dua petugas bisa mengetuk gembok yang
  -- sama dari HP berbeda, dan yang kedua tidak melakukan kesalahan apa pun.
  insert into nilai_terkunci (regu_id, pos, kode_lomba, locked_by)
  values (v_regu, v_pos, p_lomba, auth.uid())
  on conflict (regu_id, pos, kode_lomba) do nothing;
end;
$$;

drop function if exists kunci_nilai_pos(integer, smallint);

comment on function kunci_nilai_pos(integer, smallint, text) is
  'Gembok satu LOMBA satu regu. Dipakai layar Cek Nilai sesudah panitia '
  'mencocokkan angka dengan foto slipnya.';

-- ---------------------------------------------------------------------------
-- 8. Membuka gembok, per lomba.
--
--    Pagar haknya DISALIN APA ADANYA dari versi sebelumnya, termasuk alasan
--    yang wajib dan catatan riwayat yang ditulis SEBELUM barisnya hilang.
--    Yang berubah cuma dua hal: satu argumen lomba, dan `delete` yang
--    menyebut lomba itu. Keputusan pemilik acara: butirannya berubah,
--    haknya tidak.
--
--    Catatan riwayat ikut menyebut lombanya. Tanpa itu dua pembukaan gembok
--    di pos yang sama menulis row_id yang sama persis, dan yang membaca
--    riwayatnya tidak bisa tahu lomba mana yang dibuka.
-- ---------------------------------------------------------------------------
create or replace function buka_kunci_nilai_pos(p_nomor_dada integer, p_pos smallint,
                                                p_lomba text, p_alasan text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_regu uuid;
begin
  -- Siapa pun yang boleh MENGUNCI boleh pula MEMBUKA, dengan pagar pos yang
  -- sama. Haknya diperiksa POSITIF, bukan lewat 'not in': di PostgreSQL
  -- `null not in (...)` bernilai NULL, bukan true, jadi bentuk lama tidak
  -- pernah menolak akun yang sesinya sah tapi sudah dicabut dari akun_panitia.
  if not boleh('pos') then
    raise exception 'tidak berhak: pos';
  end if;
  if pos_saya() is not null and p_pos is distinct from pos_saya() then
    raise exception 'operator pos % tidak boleh membuka gembok pos %',
      pos_saya(), p_pos;
  end if;

  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'alasan membuka gembok wajib diisi';
  end if;
  if p_lomba is null or p_lomba = '' then
    raise exception 'wajib menyebut lomba (p_lomba)';
  end if;

  select id into v_regu from regu where nomor_dada = p_nomor_dada;
  if not found then
    raise exception 'nomor dada % tidak dikenal', p_nomor_dada;
  end if;

  insert into history (table_name, row_id, regu_id, action, new_value, changed_by)
  values ('nilai_terkunci', v_regu::text || ':' || p_pos || ':' || p_lomba, v_regu,
          'DELETE',
          jsonb_build_object('alasan_buka_gembok', p_alasan, 'pos', p_pos,
                             'lomba', p_lomba),
          auth.uid());

  delete from nilai_terkunci
  where regu_id = v_regu and pos = p_pos and kode_lomba = p_lomba;
end;
$$;

drop function if exists buka_kunci_nilai_pos(integer, smallint, text);

-- Hak jalankan disamakan dengan bentuk lamanya.
revoke all on function kunci_nilai_pos(integer, smallint, text) from public, anon;
revoke all on function buka_kunci_nilai_pos(integer, smallint, text, text) from public, anon;
grant execute on function kunci_nilai_pos(integer, smallint, text) to authenticated, service_role;
grant execute on function buka_kunci_nilai_pos(integer, smallint, text, text) to authenticated, service_role;
grant execute on function lomba_komponen(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 9. Penjaga: gembok yang dipecah memang mendarat, dan bentuk kuncinya benar.
-- ---------------------------------------------------------------------------
do $$
declare v_tanpa int; v_asing int;
begin
  select count(*) into v_tanpa from nilai_terkunci where kode_lomba is null;
  assert v_tanpa = 0, format('0166 GAGAL: %s gembok tanpa lomba', v_tanpa);

  -- Setiap gembok harus menunjuk lomba yang benar-benar ada di posnya.
  select count(*) into v_asing
  from nilai_terkunci t
  where not exists (select 1 from v_lomba_pos l
                    where l.edisi = edisi_aktif() and l.pos = t.pos and l.kode = t.kode_lomba);
  assert v_asing = 0, format('0166 GAGAL: %s gembok menunjuk lomba yang tidak ada', v_asing);

  raise notice '0166: gembok per lomba terpasang, % baris', (select count(*) from nilai_terkunci);
end;
$$;
