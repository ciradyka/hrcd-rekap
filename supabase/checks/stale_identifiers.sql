-- Read-only. Cari SISA identifier lama di seluruh objek database live.
-- Body fungsi plpgsql disimpan sebagai TEKS: ia tidak ikut ter-rename, dan
-- kesalahannya baru muncul saat fungsinya dipanggil. Ini satu-satunya cara
-- membuktikan tidak ada yang terlewat.
select p.proname as fungsi_bermasalah,
       (select string_agg(distinct m[1], ', ')
        from regexp_matches(pg_get_functiondef(p.oid),
             '\m(dibuat_pada|dicatat_pada|dicatat_oleh|diinput_pada|diinput_oleh|diverifikasi_pada|diverifikasi_oleh|baris_id|nilai_lama|nilai_baru|catat_riwayat|kapasitas|ruangan_id)\M',
             'g') m) as identifier_lama
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and pg_get_functiondef(p.oid) ~
      '\m(dibuat_pada|dicatat_pada|dicatat_oleh|diinput_pada|diinput_oleh|diverifikasi_pada|diverifikasi_oleh|baris_id|nilai_lama|nilai_baru|catat_riwayat|kapasitas|ruangan_id)\M'
order by 1;
