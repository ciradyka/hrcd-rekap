do $blok$
declare v_sumber text; v_manual int;
begin
  set local role authenticated;
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);

  select sumber into v_sumber from hasil_kejuaraan() where kode = 'yel_yel';
  reset role;
  select count(*) into v_manual from kejuaraan_manual where kode = 'yel_yel';

  assert v_sumber = 'skor', format('91.1 GAGAL: sumber Yel Yel = %s', v_sumber);
  assert v_manual = 0, '91.2 GAGAL: Yel Yel masih tersimpan sebagai pilihan manual';

  set local role authenticated;
  begin
    perform simpan_kejuaraan_manual(
      'yel_yel', (select id from regu where nomor_dada is not null limit 1));
    assert false, '91.3 GAGAL: Yel Yel masih bisa dipilih manual';
  exception when others then
    assert sqlerrm = 'penghargaan manual tidak dikenal',
      format('91.3 GAGAL: penolakannya salah: %s', sqlerrm);
  end;
end;
$blok$;
