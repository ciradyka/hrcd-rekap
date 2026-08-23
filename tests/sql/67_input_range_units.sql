-- ============================================================================
-- hrcd-rekap : tests/sql/67_input_range_units.sql — migrasi 0106.
-- Pesan rentang komponen meter memakai angka yang diketik, bukan sentimeter.
-- ============================================================================

\echo '--- 67. satuan pesan rentang input'

do $blok$
begin
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
end;
$blok$;

set role authenticated;

do $blok$
declare
  v_regu regu%rowtype;
  v_w wahana%rowtype;
  v_regu_id uuid;
  v_wahana_id uuid;
  v_hasil jsonb;
  v_alasan text;
  v_harapan text;
begin
  -- Cari pasangan regu/komponen sekaligus supaya tes tidak kebetulan memilih
  -- nilai yang sudah digembok oleh skenario sebelumnya. Database uji memakai
  -- master wahana contoh yang tidak selalu memuat Menaksir; satuannya diubah
  -- di bawah agar pagar ini tetap menguji perilaku, bukan nama edisi tertentu.
  select r.id, w.id into strict v_regu_id, v_wahana_id
  from regu r
  join pendaftaran d on d.id = r.pendaftaran_id
  cross join wahana w
  where r.nomor_dada is not null
    and not r.is_cancelled
    and d.status = 'lunas'
    and w.edisi = edisi_aktif()
    and komponen_berlaku(w.golongan, r.golongan)
    and not nilai_tergembok(r.id, w.pos)
  order by r.nomor_dada, w.pos, w.sort_order
  limit 1;

  select * into strict v_regu from regu where id = v_regu_id;
  update wahana
  set satuan = 'meter',
      rentang_mentah_min = 0,
      rentang_mentah_maks = 10000
  where id = v_wahana_id
  returning * into strict v_w;

  v_hasil := simpan_nilai_massal(
    jsonb_build_array(jsonb_build_object(
      'nomor_dada', v_regu.nomor_dada,
      'kode', v_w.kode,
      'nilai_1', v_w.rentang_mentah_maks + 100)),
    'manual', v_w.pos);

  v_alasan := v_hasil -> 0 ->> 'alasan';
  v_harapan := format(
    'Input %s harus antara %s - %s meter.',
    v_w.name,
    trim_scale(v_w.rentang_mentah_min / 100),
    trim_scale(v_w.rentang_mentah_maks / 100));

  assert v_hasil -> 0 ->> 'status' = 'ditolak',
         '67.1 GAGAL: nilai meter di luar rentang malah diterima';
  assert v_alasan = v_harapan,
         format('67.2 GAGAL: kalimatnya %L, seharusnya %L', v_alasan, v_harapan);

  raise notice '67: "%"', v_alasan;
end;
$blok$;

reset role;
\echo '67 satuan pesan rentang input: LULUS'
