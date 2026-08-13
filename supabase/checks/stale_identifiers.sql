-- Read-only. Tunjukkan BARIS PERSIS yang memuat identifier lama, supaya
-- komentar prosa Indonesia (tidak berbahaya) bisa dibedakan dari referensi
-- kolom sungguhan (bug yang baru meledak saat fungsi dipanggil).
select p.proname as objek, l.baris
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
cross join lateral unnest(string_to_array(pg_get_functiondef(p.oid), E'\n')) as l(baris)
where n.nspname = 'public' and p.prokind = 'f'
  and l.baris ~ '\m(dibuat_pada|dicatat_pada|dicatat_oleh|diinput_pada|diinput_oleh|diverifikasi_pada|diverifikasi_oleh|baris_id|nilai_lama|nilai_baru|catat_riwayat|kapasitas|ruangan_id|riwayat)\M'
union all
select c.relname, l.baris
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
cross join lateral unnest(string_to_array(pg_get_viewdef(c.oid), E'\n')) as l(baris)
where n.nspname = 'public' and c.relkind = 'v'
  and l.baris ~ '\m(dibuat_pada|dicatat_pada|dicatat_oleh|diinput_pada|diinput_oleh|diverifikasi_pada|diverifikasi_oleh|baris_id|nilai_lama|nilai_baru|kapasitas|ruangan_id)\M'
order by 1;
