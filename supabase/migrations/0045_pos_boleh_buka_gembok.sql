-- ============================================================================
-- hrcd-rekap : 0045_pos_boleh_buka_gembok.sql
--
-- Petugas pos boleh membuka gemboknya sendiri, tidak lagi harus lewat admin.
--
-- ---------------------------------------------------------------------------
-- YANG BERUBAH, DAN KENAPA SAYA SEMULA MEMILIH SEBALIKNYA
--
-- 0043 mengunci pembukaan hanya untuk admin, meniru `batalkan_tanda_cetak`.
-- Alasannya: kalau yang mengunci bisa membuka sendiri, gemboknya cuma polisi
-- tidur.
--
-- Panitia memutuskan lain, dan alasannya lebih berat daripada alasan saya.
-- Kedua hal itu tidak sebanding. Tanda cetak menyangkut kertas yang sudah
-- BEREDAR — sesudahnya ada lembar di tangan orang lain yang tidak bisa
-- ditarik kembali. Gembok nilai tidak meninggalkan apa pun di luar sistem;
-- yang salah kunci cuma menghalangi dirinya sendiri.
--
-- Dan harganya ditanggung di tempat yang paling buruk: pos di tengah lomba,
-- sinyal seadanya, satu regu menunggu sementara petugas mencari admin untuk
-- membuka gembok yang ia pasang sendiri semenit lalu.
--
-- ---------------------------------------------------------------------------
-- YANG TIDAK BERUBAH: ALASAN TETAP WAJIB
--
-- Justru inilah yang sekarang menahan seluruh bebannya. Ketika yang mengunci
-- bisa membuka sendiri, tidak ada lagi orang kedua yang harus diyakinkan —
-- yang tersisa cuma catatan tentang apa yang ia yakinkan kepada dirinya
-- sendiri. Alasannya masuk `history` sebelum barisnya dihapus, jadi ia tetap
-- ada walau gemboknya sudah tidak.
--
-- Pagar posnya juga tetap: operator pos hanya bisa membuka posnya sendiri,
-- sama persis dengan aturan menguncinya.
--
-- Badan fungsinya disalin dari 0043 oleh skrip, dengan satu blok izin yang
-- ditukar.
-- ============================================================================

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
  if peran() = 'operator_pos' then
    if p_pos is distinct from pos_saya() then
      raise exception 'operator pos % tidak boleh membuka gembok pos %',
        pos_saya(), p_pos;
    end if;
  elsif peran() not in ('admin', 'meja') then
    raise exception 'hanya panitia yang boleh membuka gembok';
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
