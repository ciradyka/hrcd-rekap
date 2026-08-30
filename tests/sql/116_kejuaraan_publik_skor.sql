-- Daftar juara peserta membawa angkanya (0164), dan pagar fasenya TETAP yang
-- menahan hasil sebelum diumumkan. Arah kedua itu yang diuji paling keras di
-- sini: sesudah kolom skornya kembali, tidak ada lagi lapisan lain.

do $blok$
declare
  v_fase_lama text;
  v_fase text;
  v_n integer;
  v_berangka integer;
  v_panitia integer;
begin
  select fase_live into v_fase_lama from status_acara;
  perform set_config(
    'app.uid', '00000000-0000-0000-0000-00000000000a', true);

  -- 116.1 Pada fasenya, angkanya ikut.
  --
  -- Syaratnya digantung pada apa yang dilihat PANITIA, bukan pada angka yang
  -- kebetulan ada di database ini. Berapa regu bernilai pada titik ini
  -- ditentukan urutan tes di atasnya, dan tes yang menuntut data tertentu akan
  -- merah karena tes lain berubah — bukan karena 0164 rusak.
  perform atur_fase_live('juara');
  select count(*) into v_n from v_kejuaraan_publik;
  assert v_n > 0, '116.1 GAGAL: daftar juara kosong pada fase juara';

  select count(*) into v_panitia from v_kejuaraan where total is not null;
  select count(*) into v_berangka from v_kejuaraan_publik where total is not null;
  if v_panitia > 0 then
    assert v_berangka > 0,
      format('116.1 GAGAL: panitia melihat %s baris berangka, peserta %s',
             v_panitia, v_berangka);
  else
    raise notice '116.1: belum ada satu pun nilai di database ini, jadi yang diuji tinggal kesamaannya (116.2).';
  end if;

  -- 116.2 Angkanya SAMA dengan yang dilihat panitia. Kalau berbeda, salah satu
  --       dari dua layar membacakan angka yang tidak ada di lembar penghargaan.
  assert not exists (
    select 1
    from v_kejuaraan_publik p
    join v_kejuaraan k on k.kode = p.kode
    where p.total is distinct from k.total
       or p.poin_juara is distinct from k.poin_juara
       or p.jumlah_skor is distinct from k.jumlah_skor
  ), '116.2 GAGAL: angka di halaman peserta berbeda dari layar panitia';

  -- 116.3 DI LUAR fasenya, tidak ada satu baris pun — jadi tidak ada satu
  --       angka pun. Inilah satu-satunya yang menahan hasil sebelum
  --       diumumkan, dan karena itu diuji untuk KEEMPAT fase lainnya.
  foreach v_fase in array array['pra', 'progres', 'penuh', 'top10'] loop
    perform atur_fase_live(v_fase);
    select count(*) into v_n from v_kejuaraan_publik;
    assert v_n = 0,
      format('116.3 GAGAL: %s baris juara terbaca pada fase %s', v_n, v_fase);
  end loop;

  perform atur_fase_live('juara');

  -- 116.4 Papannya tetap tertutup pada fase juara: yang dilihat peserta di
  --       sana HANYA kejuaraan, dan itu tidak berubah karena angkanya kembali.
  assert not exists (select 1 from v_klasemen_publik),
    '116.4 GAGAL: klasemen terbuka pada fase juara';
  assert not exists (select 1 from v_progres_publik),
    '116.4 GAGAL: baris progres terbuka pada fase juara';

  perform atur_fase_live('penuh');
end;
$blok$;

-- 116.5 Kolom yang TIDAK boleh ikut. Diperiksa dari katalog, bukan dari teks
--       view-nya: `sumber` keterangan cara memilih, `regu_id` kunci internal
--       yang tidak menjawab apa pun bagi pembacanya.
do $blok$
declare v_kolom text[];
begin
  select array_agg(attname::text order by attnum) into v_kolom
    from pg_attribute
   where attrelid = 'v_kejuaraan_publik'::regclass and attnum > 0
     and not attisdropped;
  assert not (v_kolom && array['sumber', 'regu_id']),
    format('116.5 GAGAL: kolom yang tidak perlu ikut terbawa: %s', v_kolom);
  assert has_table_privilege('anon', 'v_kejuaraan_publik', 'select'),
    '116.5 GAGAL: peserta tidak bisa membaca v_kejuaraan_publik';
end;
$blok$;

select '116_kejuaraan_publik_skor OK' hasil;
