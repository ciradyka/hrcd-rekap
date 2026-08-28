-- Pemeriksaan baca-saja untuk enam sumber data yang dimuat bersamaan oleh
-- layar Live Score. Duduk sebagai satu akun gerbang aktif agar perbedaan RLS
-- dengan akun admin ikut terlihat, dan tampilkan waktu tiap query.
\timing on

select set_config(
  'request.jwt.claim.sub',
  (select user_id::text
     from akun_panitia
    where peran = 'gerbang' and is_active
    order by username
    limit 1),
  false
);

set role authenticated;

select peran(), array_agg(fitur order by fitur) as hak
  from akun_hak
 where user_id = auth.uid()
 group by peran();

select count(*) as kelengkapan_pos from v_kelengkapan_pos;
select count(*) as klasemen from v_klasemen_live_score;
select count(*) as status_acara from status_acara;
select count(*) as pos from v_pos;
select count(*) as komponen from wahana where edisi = edisi_aktif();
select count(*) as rekap from v_rekap_penuh;

reset role;
