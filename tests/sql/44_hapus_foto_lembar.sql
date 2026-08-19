-- ============================================================================
-- hrcd-rekap : tests/sql/44_hapus_foto_lembar.sql — migrasi 0081.
--
-- Foto slip adalah BUKTI, dan menghapusnya tidak menimbulkan galat apa pun.
-- Yang harus dijaga mesin karena itu bukan "bisa dihapus", melainkan tiga
-- syarat di sekelilingnya:
--
--   1. Tanpa alasan, DITOLAK.
--   2. Alasannya benar-benar tercatat, dan tercatat SEBELUM barisnya hilang.
--   3. Juri pos tidak bisa menghapus foto pos lain.
-- ============================================================================

\echo '--- 44. hapus foto lembar'

do $blok$
declare
  v_regu   uuid;
  v_pos    smallint := 1;
  v_id     uuid;
  v_path   text;
  v_uid    uuid;
  v_alasan text;
  v_n      integer;
begin
  select id into v_regu from regu order by nomor_dada limit 1;
  select user_id into v_uid from akun_panitia where peran = 'admin' limit 1;
  if v_regu is null or v_uid is null then
    raise notice '44 DILEWATI — butuh minimal satu regu dan satu akun admin.';
    return;
  end if;

  -- DUDUK DI KURSINYA, seperti tes 30-38: `boleh('pos')` membaca auth.uid(),
  -- dan tanpa ini seluruh berkas ditolak "tidak berhak: pos" — bukan karena
  -- pagarnya salah, melainkan karena tidak ada yang duduk di depannya.
  perform set_config('app.uid', v_uid::text, false);

  insert into foto_lembar (regu_id, pos, kode_lomba, nama_lomba, path,
                           ukuran_bytes, diunggah_oleh,
                           cara_taut, ditaut_oleh, ditaut_pada)
  values (v_regu, v_pos, 'uji-hapus', 'Uji Hapus',
          'pos1/uji-hapus-44.jpg', 1234, v_uid, 'unggah', v_uid, now())
  returning id into v_id;

  -- ---------------------------------------------------------------------
  -- 1. Alasan kosong ditolak, dan barisnya HARUS masih ada sesudahnya.
  -- ---------------------------------------------------------------------
  begin
    perform hapus_foto_lembar(v_id, '   ');
    raise exception '44.1 GAGAL: alasan kosong diterima';
  exception
    when others then
      if position('alasan menghapus foto wajib' in sqlerrm) = 0 then raise; end if;
  end;

  select count(*) into v_n from foto_lembar where id = v_id;
  assert v_n = 1, '44.1 GAGAL: barisnya ikut hilang walau alasannya ditolak';
  raise notice '44.1 OK — alasan kosong ditolak, fotonya masih ada.';

  -- ---------------------------------------------------------------------
  -- 2. Dengan alasan: barisnya hilang, path-nya dikembalikan, alasannya
  --    tersimpan di history.
  -- ---------------------------------------------------------------------
  select hapus_foto_lembar(v_id, 'buram, difoto ulang') into v_path;

  assert v_path = 'pos1/uji-hapus-44.jpg',
    format('44.2 GAGAL: path yang dikembalikan "%s"', v_path);

  select count(*) into v_n from foto_lembar where id = v_id;
  assert v_n = 0, '44.2 GAGAL: barisnya masih ada sesudah dihapus';
  raise notice '44.2 OK — terhapus, path dikembalikan untuk membersihkan bucket.';

  -- ---------------------------------------------------------------------
  -- 3. Alasannya benar-benar tercatat. Inilah yang membuat penghapusan bukti
  --    bisa ditelusuri sesudah barisnya tidak ada lagi.
  -- ---------------------------------------------------------------------
  select new_value ->> 'alasan_hapus_foto' into v_alasan
  from history
  where table_name = 'foto_lembar' and row_id = v_id::text
    and new_value ? 'alasan_hapus_foto'
  order by changed_at desc limit 1;

  assert v_alasan = 'buram, difoto ulang',
    format('44.3 GAGAL: alasan tercatat "%s"', coalesce(v_alasan, '(tidak ada)'));
  raise notice '44.3 OK — alasannya tersimpan di history: "%".', v_alasan;
end;
$blok$;

\echo '--- 44 SELESAI'
