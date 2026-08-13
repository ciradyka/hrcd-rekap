-- Read-only. Cari SISA identifier lama di seluruh fungsi & view database live.
-- Body fungsi plpgsql disimpan sebagai TEKS: ia tidak ikut ter-rename saat
-- ALTER, dan kesalahannya baru muncul saat fungsinya DIPANGGIL di lapangan.
-- Ini satu-satunya cara membuktikan tidak ada yang terlewat.
select 'FUNGSI' as jenis, p.proname as nama_objek
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind = 'f'   -- pg_get_functiondef() menolak agregat/window
  and pg_get_functiondef(p.oid) ~ '\m(dibuat_pada|dicatat_pada|dicatat_oleh|diinput_pada|diinput_oleh|diverifikasi_pada|diverifikasi_oleh|baris_id|nilai_lama|nilai_baru|catat_riwayat|kapasitas|ruangan_id|riwayat)\M'
union all
select 'VIEW', c.relname
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v'
  and pg_get_viewdef(c.oid) ~ '\m(dibuat_pada|dicatat_pada|dicatat_oleh|diinput_pada|diinput_oleh|diverifikasi_pada|diverifikasi_oleh|baris_id|nilai_lama|nilai_baru|kapasitas|ruangan_id)\M'
order by 1, 2;
