-- ============================================================================
-- hrcd-rekap : supabase/checks/lihat_nilai_per_pos.sql
-- HANYA MEMBACA. Berapa regu yang sudah punya nilai di tiap pos, dan berapa
-- baris nilainya. Dipakai waktu papan peserta menunjukkan satu pos 0% padahal
-- pos itu justru yang paling penuh.
-- ============================================================================
do $$
declare r record;
begin
  for r in
    select w.pos, count(distinct n.regu_id) regu, count(*) baris
      from nilai_mentah n join wahana w on w.id = n.wahana_id
     group by w.pos order by w.pos
  loop
    raise notice 'pos % : % regu, % baris nilai', r.pos, r.regu, r.baris;
  end loop;
  for r in
    select p.nomor, p.name, count(w.id) komponen
      from pos p left join wahana w on w.edisi = p.edisi and w.pos = p.nomor
     where p.edisi = edisi_aktif() group by 1,2 order by 1
  loop
    raise notice 'konfig pos % (%) : % komponen', r.nomor, r.name, r.komponen;
  end loop;
end $$;
