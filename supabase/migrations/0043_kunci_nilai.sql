-- ============================================================================
-- hrcd-rekap : 0043_kunci_nilai.sql
--
-- GEMBOK: satu regu di satu pos dinyatakan selesai, dan nilainya tidak bisa
-- diubah lagi oleh siapa pun sampai admin membukanya.
--
-- ---------------------------------------------------------------------------
-- KENAPA ADA
--
-- Nilai bisa berubah tanpa ada yang bermaksud mengubahnya: satu ketukan
-- nyasar di HP, satu baris yang tersimpan ulang, satu angka yang tertimpa.
-- Riwayat (0042) membuat perubahan itu bisa DITELUSURI sesudahnya, tapi tidak
-- ada yang MENCEGAHNYA.
--
-- Gembok adalah pernyataan petugas: "regu ini sudah saya periksa, angkanya
-- benar, jangan ada yang menyentuhnya lagi."
--
-- ---------------------------------------------------------------------------
-- SATU BARIS = SATU REGU DI SATU POS
--
-- Bukan per regu seluruh lomba, dan bukan per pos seluruh regu. Yang selesai
-- di lapangan memang satu baris pada satu lembar: regu 005 sudah tuntas di
-- Pos 1, sementara Pos 3 belum menyentuhnya sama sekali. Mengunci lebih lebar
-- akan mengunci pekerjaan pos lain yang belum dimulai.
--
-- ---------------------------------------------------------------------------
-- SIAPA MENGUNCI, SIAPA MEMBUKA
--
--   mengunci : operator pos (posnya sendiri), meja, admin
--   membuka  : ADMIN SAJA, dan wajib menyebut alasan
--
-- Bentuk yang sama dengan `batalkan_tanda_cetak` (0008), dan alasannya sama:
-- kalau yang mengunci juga bisa membuka sendiri, gemboknya cuma polisi tidur.
-- Yang membuatnya berarti justru karena membukanya menuntut orang lain.
--
-- Harganya disebut supaya tidak jadi kejutan: petugas yang salah mengunci
-- harus menghubungi admin. Itu disengaja — mengunci adalah pernyataan
-- "sudah saya periksa", dan pernyataan yang bisa ditarik sendiri kapan saja
-- bukan pernyataan.
--
-- ---------------------------------------------------------------------------
-- PENJAGANYA DI SERVER
--
-- Layar boleh mengabu-abukan kotaknya, tapi yang menolak tulisan haruslah
-- database. Lembar pos dibuka di beberapa HP sekaligus, dan HP yang layarnya
-- dimuat SEBELUM gemboknya dipasang tidak tahu apa-apa tentang gembok itu.
-- ============================================================================

create table if not exists nilai_terkunci (
  regu_id      uuid     not null references regu (id),
  pos          smallint not null,
  reason       text,
  locked_by    uuid     not null references auth.users (id),
  locked_at    timestamptz not null default now(),
  primary key (regu_id, pos)
);

alter table nilai_terkunci enable row level security;

-- Dibaca setiap panitia: layar perlu tahu baris mana yang tergembok, dan
-- menyembunyikan gembok dari orang yang tertolak menulis hanya membuat
-- penolakannya tidak bisa dijelaskan.
create policy sel_kunci on nilai_terkunci for select using (peran() is not null);
-- Menulis HANYA lewat RPC di bawah, yang memeriksa pos dan peran.
create policy adm_kunci on nilai_terkunci for all using (peran() = 'admin');

grant select on nilai_terkunci to authenticated;

comment on table nilai_terkunci is
  'Regu yang nilainya dinyatakan selesai di satu pos. Ditulis lewat '
  'kunci_nilai_pos / buka_kunci_nilai_pos, bukan langsung.';

-- ---------------------------------------------------------------------------
-- Pemeriksa tunggal, dipakai kedua jalur tulis.
--
-- Satu fungsi, bukan dua salinan syarat: `simpan_nilai_massal` dan
-- `hapus_nilai_pos` sama-sama harus menolak, dan dua salinan adalah cara
-- mereka mulai berbeda pendapat. Cacat persis itu yang dibetulkan 0040.
-- ---------------------------------------------------------------------------
create or replace function nilai_tergembok(p_regu uuid, p_pos smallint)
returns boolean language sql stable
set search_path = public
as $$
  select exists (
    select 1 from nilai_terkunci where regu_id = p_regu and pos = p_pos)
$$;

-- ---------------------------------------------------------------------------
-- Mengunci. Operator pos hanya boleh posnya sendiri.
-- ---------------------------------------------------------------------------
create or replace function kunci_nilai_pos(
  p_nomor_dada integer,
  p_pos        smallint default null   -- wajib untuk admin/meja
) returns void
language plpgsql security definer
set search_path = public
as $$
declare v_pos smallint; v_regu uuid;
begin
  if peran() = 'operator_pos' then
    v_pos := pos_saya();
    if p_pos is not null and p_pos <> v_pos then
      raise exception 'operator pos % tidak boleh mengunci pos %', v_pos, p_pos;
    end if;
  elsif peran() in ('admin', 'meja') then
    v_pos := p_pos;
    if v_pos is null then
      raise exception 'wajib menyebut pos (p_pos)';
    end if;
  else
    raise exception 'hanya panitia yang boleh mengunci';
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

-- ---------------------------------------------------------------------------
-- Membuka. ADMIN SAJA, wajib beralasan — bentuk yang sama dengan
-- batalkan_tanda_cetak, karena keduanya membatalkan pernyataan "sudah final".
-- ---------------------------------------------------------------------------
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
  if peran() <> 'admin' then
    raise exception 'hanya admin yang boleh membuka gembok';
  end if;
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

revoke all on function kunci_nilai_pos(integer, smallint) from public;
revoke all on function buka_kunci_nilai_pos(integer, smallint, text) from public;
grant execute on function kunci_nilai_pos(integer, smallint) to authenticated;
grant execute on function buka_kunci_nilai_pos(integer, smallint, text) to authenticated;
