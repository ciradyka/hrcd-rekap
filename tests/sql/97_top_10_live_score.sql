-- Top 10 harus menjadi fase sah dan hanya menerbitkan maksimal sepuluh regu
-- eligible per golongan. Peringkat NULL berarti regu belum tiba dan tidak
-- boleh ikut walaupun total sementara sudah ada.

do $blok$
declare
  v_fase_lama text;
  v_golongan text;
  v_aktual integer;
  v_harapan integer;
begin
  select fase_live into v_fase_lama from status_acara;

  perform set_config(
    'app.uid', '00000000-0000-0000-0000-00000000000a', true);
  assert atur_fase_live('top10') = 'top10',
    '97.1 GAGAL: admin tidak bisa memilih Top 10';

  assert not exists (
    select 1 from v_klasemen_publik where peringkat is null
  ), '97.2 GAGAL: regu yang tidak eligible ikut Top 10';

  assert not exists (
    select 1 from v_klasemen_publik
    group by golongan having count(*) > 10
  ), '97.3 GAGAL: satu golongan memuat lebih dari sepuluh regu';

  for v_golongan in select distinct golongan from v_klasemen loop
    select count(*) into v_aktual
    from v_klasemen_publik where golongan = v_golongan;
    select least(count(*), 10) into v_harapan
    from v_klasemen where golongan = v_golongan;
    assert v_aktual = v_harapan,
      format('97.4 GAGAL: %s memuat %s regu, seharusnya %s',
             v_golongan, v_aktual, v_harapan);
  end loop;

  update status_acara set fase_live = v_fase_lama where id = true;
end;
$blok$;

select '97_top_10_live_score OK' hasil;
