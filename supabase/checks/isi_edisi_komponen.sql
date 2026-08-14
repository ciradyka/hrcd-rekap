\echo '=== KOMPONEN PER POS (edisi aktif) ==='
select w.pos, w.kode, w.name, w.form, w.poin_maks,
       coalesce(w.golongan, '(semua)') as golongan,
       w.rentang_mentah_min || ' - ' || w.rentang_mentah_maks as rentang
from wahana w where w.edisi = edisi_aktif()
order by w.pos, w.sort_order, w.golongan;

\echo ''
\echo '=== MAKSIMUM PER POS ==='
select p.nomor, p.name,
       sum(w.poin_maks) filter (where w.golongan is null
         or w.golongan = 'penegak_pa') as maks_penegak_pa
from pos p left join wahana w on w.edisi = p.edisi and w.pos = p.nomor
where p.edisi = edisi_aktif() group by p.nomor, p.name order by p.nomor;
