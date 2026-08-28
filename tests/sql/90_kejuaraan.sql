-- Kejuaraan selalu menyediakan 24 gelar golongan dan empat slot manual.
do $blok$
declare v_golongan int; v_manual int;
begin
  set local role authenticated;
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);
  select count(*) into v_golongan from hasil_kejuaraan()
  where kode ~ '^(penegak|penggalang)_(pa|pi)_[1-6]$';
  select count(*) into v_manual from hasil_kejuaraan()
  where kode in ('kostum', 'yel_yel', 'terfavorit', 'terjauh');
  assert v_golongan = 24, format('90.1 GAGAL: gelar golongan = %s', v_golongan);
  assert v_manual = 4, format('90.2 GAGAL: slot manual = %s', v_manual);
end;
$blok$;

do $blok$
declare v_n int;
begin
  set local role authenticated;
  perform set_config('app.uid', '00000000-0000-0000-0000-0000000000ff', true);
  select count(*) into v_n from hasil_kejuaraan();
  assert v_n = 0, format('90.3 GAGAL: akun tanpa live_score membaca %s baris', v_n);
end;
$blok$;
