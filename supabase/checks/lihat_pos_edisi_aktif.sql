-- ============================================================================
-- hrcd-rekap : supabase/checks/lihat_pos_edisi_aktif.sql
-- HANYA MEMBACA. Cetak konfigurasi pos edisi aktif beserta jumlah komponennya.
--
-- Ada karena dev dan produksi sempat berbeda tanpa ketahuan: migrasi 0033
-- melewati dirinya sendiri kalau edisinya sudah memuat nilai, dan di
-- tests/dev_database.sh ia berjalan sebelum edisinya sempat dibuat — jadi dev
-- memakai konfigurasi lama sementara produksi memakai yang baru. Yang
-- membedakan keduanya cuma bisa dilihat, bukan ditebak.
-- ============================================================================
do $$
declare r record; v_edisi smallint;
begin
  select nomor into v_edisi from edisi where is_active;
  raise notice 'edisi aktif: %', v_edisi;
  for r in
    select p.nomor, p.name, count(w.id) komponen
      from pos p left join wahana w on w.edisi = p.edisi and w.pos = p.nomor
     where p.edisi = v_edisi group by 1, 2 order by 1
  loop
    raise notice 'pos % : %  (% komponen)', r.nomor, r.name, r.komponen;
  end loop;
end $$;
