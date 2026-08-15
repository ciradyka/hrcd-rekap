-- ============================================================================
-- hrcd-rekap : 0046_gembok_dua_lubang.sql
--
-- Dua lubang pada gembok, keduanya ditemukan sapuan adversarial dan keduanya
-- tidak menimbulkan galat apa pun sampai keadaannya tepat.
--
-- ---------------------------------------------------------------------------
-- 1. AKUN TANPA PERAN BISA MEMBUKA GEMBOK
--
-- 0045 menulis:  elsif peran() not in ('admin', 'meja') then raise ...
--
-- Di PostgreSQL `null not in (...)` bernilai NULL, bukan true. Untuk peran
-- NULL, cabang pertama (`= 'operator_pos'`) juga NULL, jadi keduanya tidak
-- diambil dan alirannya jatuh lurus ke delete.
--
-- Peran NULL bukan keadaan teoretis: itulah yang terjadi pada akun yang masih
-- punya sesi Supabase sah tetapi barisnya sudah dicabut dari akun_panitia —
-- persis akun yang paling tidak boleh membuka gembok.
--
-- Diperbaiki dengan memeriksa POSITIF: sebut siapa yang boleh, bukan siapa
-- yang tidak. `null` gagal memenuhi syarat positif mana pun, jadi ia tertolak
-- tanpa perlu diingat sebagai kasus tersendiri.
--
-- ---------------------------------------------------------------------------
-- 2. GEMBOK MEMBLOKIR PEMBERSIHAN DATA UJI
--
-- nilai_terkunci.regu_id menunjuk regu(id) TANPA on delete cascade, dan
-- cleanup_data_uji.sql tidak pernah menghapusnya — berkas itu ditulis sebelum
-- tabel ini ada. Begitu satu gembok terpasang, seluruh pembersihan gagal di
-- baris `delete from regu`, dan yang menerima pesannya adalah orang yang
-- sedang menyiapkan lomba dengan data uji yang tidak mau hilang.
--
-- Cascade dipilih daripada menambah satu baris di skrip pembersih, karena
-- gembok memang tidak punya arti tanpa regunya. Baris nilai_mentah dan
-- closing_regu sengaja TIDAK diberi cascade — keduanya nilai yang hilangnya
-- harus disengaja. Gembok bukan nilai; ia pernyataan tentang nilai.
-- ============================================================================

alter table nilai_terkunci
  drop constraint if exists nilai_terkunci_regu_id_fkey;
alter table nilai_terkunci
  add constraint nilai_terkunci_regu_id_fkey
  foreign key (regu_id) references regu (id) on delete cascade;

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
  -- Peran diperiksa POSITIF, bukan lewat 'not in'.
  --
  -- Versi 0045 memakai `elsif peran() not in ('admin','meja') then raise`, dan
  -- di PostgreSQL `null not in (...)` bernilai NULL — bukan true. Cabang
  -- penolakannya karena itu tidak pernah jalan untuk peran NULL, yaitu akun
  -- yang punya sesi sah tetapi sudah dicabut dari akun_panitia. Ia jatuh
  -- melewati kedua cabang dan sampai ke delete.
  if peran() is null or peran() not in ('operator_pos', 'meja', 'admin') then
    raise exception 'hanya panitia yang boleh membuka gembok';
  end if;
  if peran() = 'operator_pos' and p_pos is distinct from pos_saya() then
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
