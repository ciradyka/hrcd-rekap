-- ============================================================================
-- hrcd-rekap : tests/sql/68_live_phase_value_gate.sql
-- Gerbang nilai pada bentuk TERBARU v_progres_publik (migrasi 0072).
--
-- komponen_terisi memang boleh terbit sejak fase progres karena hanya membawa
-- centang. Nilai mentah tidak boleh ikut sampai fase penuh; menyembunyikannya
-- di tampilan tidak cukup karena rekap.json dapat diminta langsung dari CDN.
-- ============================================================================

reset role;

do $$
declare
  v_fase_asli text;
  v_dada smallint;
  v_komponen jsonb;
begin
  select fase_live into strict v_fase_asli from status_acara where id = true;

  update status_acara set fase_live = 'progres' where id = true;

  assert (select count(*) from v_progres_publik) > 0,
         'fase progres kosong; gerbang nilai tidak benar-benar diuji';
  assert not exists (
    select 1 from v_progres_publik where nilai <> '{}'::jsonb
  ), 'BOCOR: nilai keluar sebelum fase penuh';

  -- Pilih regu yang sudah punya nilai. Centangnya harus terlihat sekarang,
  -- lalu tetap sama setelah fase dibuka penuh.
  select p.nomor_dada, p.komponen_terisi
    into v_dada, v_komponen
  from v_progres_publik p
  where exists (
    select 1
    from jsonb_each_text(p.komponen_terisi) as isi(kode, terisi)
    where isi.terisi::boolean
  )
  order by p.nomor_dada
  limit 1;

  assert v_dada is not null,
         'tidak ada komponen terisi; gerbang nilai tidak benar-benar diuji';

  update status_acara set fase_live = 'penuh' where id = true;

  assert (select komponen_terisi = v_komponen
          from v_progres_publik where nomor_dada = v_dada),
         'centang komponen berubah ketika fase dibuka penuh';
  assert (select nilai <> '{}'::jsonb
          from v_progres_publik where nomor_dada = v_dada),
         'nilai tetap kosong di fase penuh';

  update status_acara set fase_live = v_fase_asli where id = true;
end;
$$;

select '68_live_phase_value_gate OK' as hasil;
