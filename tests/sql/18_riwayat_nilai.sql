-- ============================================================================
-- hrcd-rekap : tests/sql/18_riwayat_nilai.sql
-- Riwayat perubahan nilai (0042).
--
-- Yang dijaga di sini PAGARNYA, bukan isinya. Tabel `history` mencatat SELURUH
-- tabel — termasuk `pendaftaran`, yang memuat nomor WhatsApp sekolah. Membuka
-- riwayat nilai kepada operator pos tidak boleh berarti membuka nomor telepon
-- kepada mereka, dan satu-satunya yang memisahkan keduanya adalah saringan
-- `table_name = 'nilai_mentah'` di dalam view.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 18.1 Operator pos melihat riwayat POSNYA SENDIRI, dan hanya itu.
-- ---------------------------------------------------------------------------
select set_config('app.uid', '00000000-0000-0000-0000-000000000001', false);
set role authenticated;

do $$
declare v_pos smallint; v_asing int;
begin
  select pos_saya() into v_pos;
  assert v_pos is not null, 'akun uji bukan operator pos';

  select count(*) into v_asing from v_riwayat_nilai where pos <> v_pos;
  assert v_asing = 0,
    format('operator pos %s melihat %s baris riwayat pos lain', v_pos, v_asing);
end;
$$;

-- ---------------------------------------------------------------------------
-- 18.2 Riwayat tabel LAIN tidak pernah bocor lewat view ini — terutama
--      pendaftaran, yang memuat nomor WhatsApp.
-- ---------------------------------------------------------------------------
do $$
declare v_bocor int;
begin
  select count(*) into v_bocor
  from history h
  where h.table_name <> 'nilai_mentah'
    and exists (select 1 from v_riwayat_nilai v where v.id = h.id);
  assert v_bocor = 0,
    format('%s baris riwayat tabel lain ikut terlihat di v_riwayat_nilai', v_bocor);
end;
$$;

-- ---------------------------------------------------------------------------
-- 18.3 Perubahan nilai BENAR-BENAR tercatat dan terbaca: angka lama, angka
--      baru, dan siapa. Diubah lalu dikembalikan.
-- ---------------------------------------------------------------------------
select set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);

do $$
declare
  v_regu   uuid; v_wahana uuid; v_pos smallint;
  v_lama   numeric; v_baru numeric;
  v_dada   integer; v_catat record;
begin
  select n.regu_id, n.wahana_id, w.pos, n.nilai_1, r.nomor_dada
    into strict v_regu, v_wahana, v_pos, v_lama, v_dada
  from nilai_mentah n
  join wahana w on w.id = n.wahana_id
  join regu r   on r.id = n.regu_id
  where w.edisi = edisi_aktif() and r.nomor_dada is not null
  order by n.id limit 1;

  v_baru := case when v_lama = 0 then 1 else 0 end;
  update nilai_mentah set nilai_1 = v_baru
  where regu_id = v_regu and wahana_id = v_wahana;

  select * into v_catat from v_riwayat_nilai
  where nomor_dada = v_dada and pos = v_pos
  order by changed_at desc, id desc limit 1;

  assert v_catat.nilai_lama = v_lama,
    format('angka lama tercatat %s, seharusnya %s', v_catat.nilai_lama, v_lama);
  assert v_catat.nilai_baru = v_baru,
    format('angka baru tercatat %s, seharusnya %s', v_catat.nilai_baru, v_baru);
  assert v_catat.oleh is not null, 'penginput tidak tercatat';

  update nilai_mentah set nilai_1 = v_lama
  where regu_id = v_regu and wahana_id = v_wahana;
end;
$$;

reset role;
select '18_riwayat_nilai OK' as hasil;
