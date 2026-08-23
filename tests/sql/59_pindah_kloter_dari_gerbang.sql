-- ============================================================================
-- hrcd-rekap : tests/sql/59_pindah_kloter_dari_gerbang.sql — migrasi 0098.
-- Panggilan yang sama harus mengikuti centang `keberangkatan` akun gerbang.
-- ============================================================================

\echo '--- 59. pindah kloter bisa dilakukan dari garis start'

do $blok$
declare
  v_gerbang uuid := '00000000-0000-0000-0000-0000000000c2';
  v_dada integer;
  v_asal smallint;
  v_tujuan smallint;
  v_pesan text;
begin
  insert into auth.users (id, email) values (v_gerbang, 'gerbang.pindah@uji.local')
  on conflict (id) do nothing;
  insert into akun_panitia (user_id, username, peran, pos, is_active)
  values (v_gerbang, 'gerbang.pindah', 'juri_pos', 1, true)
  on conflict (user_id) do update set peran = 'juri_pos', pos = 1, is_active = true;
  update akun_panitia set peran = 'gerbang', pos = null where user_id = v_gerbang;

  assert exists (select 1 from akun_hak
                 where user_id = v_gerbang and fitur = 'keberangkatan'),
    'akun gerbang tidak mendapat hak keberangkatan';
  assert not exists (select 1 from akun_hak
                     where user_id = v_gerbang and fitur = 'cetak_kloter'),
    'akun gerbang mendapat cetak_kloter sehingga tes tidak membuktikan pagar baru';

  select r.nomor_dada, r.kloter_nomor into v_dada, v_asal
  from regu r
  join pendaftaran d on d.id = r.pendaftaran_id
  join kloter k on k.nomor = r.kloter_nomor
  where not r.is_cancelled and d.status = 'lunas'
    and r.nomor_dada is not null and k.jam_berangkat is null
    and not exists (select 1 from keberangkatan_regu kb where kb.regu_id = r.id)
  order by r.nomor_dada limit 1;
  assert v_dada is not null, '59 GAGAL: tidak ada regu yang aman untuk diuji';

  select nomor into v_tujuan from kloter
  where nomor <> v_asal and jam_berangkat is null
  order by nomor limit 1;
  assert v_tujuan is not null, '59 GAGAL: tidak ada kloter tujuan';

  perform set_config('app.uid', v_gerbang::text, true);
  perform pindah_kloter(v_dada, 'uji hak keberangkatan', v_tujuan);
  assert (select kloter_nomor = v_tujuan from regu where nomor_dada = v_dada),
    '59.1 GAGAL: akun gerbang tidak berhasil memindahkan regu';

  delete from akun_hak where user_id = v_gerbang and fitur = 'keberangkatan';
  begin
    perform pindah_kloter(v_dada, 'uji tanpa hak', v_asal);
    assert false, '59.2 GAGAL: pindah kloter tetap terbuka tanpa hak';
  exception when others then
    v_pesan := sqlerrm;
  end;
  assert v_pesan like '%tidak berhak%',
    format('59.2 GAGAL: ditolak dengan pesan lain — %s', v_pesan);

  insert into akun_hak (user_id, fitur) values (v_gerbang, 'cetak_kloter')
  on conflict do nothing;
  perform pindah_kloter(v_dada, 'uji hak lama', v_asal);
  assert (select kloter_nomor = v_asal from regu where nomor_dada = v_dada),
    '59.3 GAGAL: hak cetak_kloter lama tidak lagi bisa memindahkan regu';

  delete from akun_hak where user_id = v_gerbang and fitur = 'cetak_kloter';
  insert into akun_hak (user_id, fitur) values (v_gerbang, 'keberangkatan')
  on conflict do nothing;
  perform set_config('app.uid', '', true);
end;
$blok$;

\echo '59 pindah kloter dari garis start: LULUS'
