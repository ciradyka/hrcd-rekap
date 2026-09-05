-- ============================================================================
-- hrcd-rekap : tests/sql/65_public_completeness_external.sql — migrasi 0104.
-- Kelengkapan publik harus memakai populasi yang sama dengan tabel peserta.
-- ============================================================================

\echo '--- 65. kelengkapan publik hanya menghitung Eksternal'

do $blok$
declare
  v_pos             smallint;
  v_publik          int;
  v_panitia         int;
  v_eksternal       int;
  v_semua           int;
  v_fase_sebelumnya text;
begin
  -- v_kelengkapan_pos sengaja dipagari untuk panitia aktif (0101). Duduki
  -- akun admin fikstur supaya perbandingan menguji populasinya, bukan pagarnya.
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);

  select fase_live into v_fase_sebelumnya from status_acara;
  update status_acara set fase_live = 'progres' where id = true;

  -- Pilih pos yang benar-benar diikuti Internal agar tes tidak bisa lulus hanya
  -- karena 0096 memang sudah mengeluarkan mereka dari Pos 4/5.
  select p.nomor into v_pos
  from v_pos p
  where p.jumlah_komponen > 0
    and exists (
      select 1 from regu r
      where r.golongan in ('intern_pa', 'intern_pi')
        and komponen_pos_golongan(p.nomor, r.golongan) > 0
    )
  order by p.nomor
  limit 1;

  assert v_pos is not null,
    '65 GAGAL: tidak ada pos yang diikuti Internal; fikstur tidak menguji boundary publik';

  select regu_total into v_publik
  from v_kelengkapan_publik where pos = v_pos;
  select regu_total into v_panitia
  from v_kelengkapan_pos where pos = v_pos;

  select count(*)::int into v_eksternal
  from regu r
  join pendaftaran d on d.id = r.pendaftaran_id
  where not r.is_cancelled
    and d.status = 'lunas'
    and r.nomor_dada is not null
    and r.golongan not in ('intern_pa', 'intern_pi')
    and komponen_pos_golongan(v_pos, r.golongan) > 0;

  select count(*)::int into v_semua
  from regu r
  join pendaftaran d on d.id = r.pendaftaran_id
  where not r.is_cancelled
    and d.status = 'lunas'
    and r.nomor_dada is not null
    and komponen_pos_golongan(v_pos, r.golongan) > 0;

  assert v_semua > v_eksternal,
    '65 GAGAL: tidak ada regu Internal yang membedakan hitungan publik dan panitia';
  assert v_publik = v_eksternal,
    format('65 GAGAL: publik menghitung %s regu di Pos %s, seharusnya %s Eksternal',
           v_publik, v_pos, v_eksternal);
  assert v_panitia = v_semua,
    format('65 GAGAL: papan panitia berubah menjadi %s regu, seharusnya tetap %s',
           v_panitia, v_semua);

  update status_acara set fase_live = v_fase_sebelumnya where id = true;
  raise notice '65 OK — Pos %: publik % Eksternal, panitia % seluruh regu.',
    v_pos, v_publik, v_panitia;
end;
$blok$;

\echo '65 kelengkapan publik Eksternal: LULUS'
