-- Kelayakan juara dan isi papan adalah dua hal berbeda. v_klasemen tetap
-- hanya memuat regu yang sudah tiba supaya seluruh mesin Kejuaraan aman,
-- sementara dua pintu Live Score menambahkan kembali regu yang benar-benar
-- sudah berangkat dengan peringkat NULL.

create or replace function klasemen_live_score()
returns table (
  peringkat        bigint,
  nomor_dada       integer,
  nama_regu        text,
  nama_sekolah     text,
  golongan         text,
  total_pos        numeric,
  penalti_waktu    numeric,
  penalti_checkout numeric,
  penalti_anggota  numeric,
  total            numeric,
  poin_per_pos     jsonb,
  selisih_menit    integer
)
language sql stable security definer
set search_path = public
as $$
  select
    kl.peringkat, t.nomor_dada, t.nama_regu, t.nama_sekolah, t.golongan,
    t.total_pos, t.penalti_waktu, t.penalti_checkout, t.penalti_anggota, t.total,
    (select jsonb_object_agg(pp.pos::text, pp.poin_pos)
     from v_poin_pos pp where pp.regu_id = t.regu_id)        as poin_per_pos,
    t.selisih_menit
  from v_total_skor t
  join regu r on r.id = t.regu_id
  join kloter k on k.nomor = r.kloter_nomor
  join keberangkatan_regu kb on kb.regu_id = t.regu_id
  left join v_klasemen kl on kl.regu_id = t.regu_id
  where k.jam_berangkat is not null
    and boleh('live_score')
$$;

comment on function klasemen_live_score() is
  'Alas Live Score panitia. Semua regu yang sudah berangkat ditampilkan; peringkat hanya terisi setelah jam datang dicatat.';

create or replace view v_klasemen_publik as
select
  kl.peringkat, t.nomor_dada, t.nama_regu, t.nama_sekolah, t.golongan,
  t.total_pos, t.penalti_waktu, t.penalti_checkout, t.penalti_anggota, t.total,
  (select jsonb_object_agg(pp.pos::text, pp.poin_pos)
   from v_poin_pos pp where pp.regu_id = t.regu_id)          as poin_per_pos,
  t.selisih_menit
from v_total_skor t
join regu r on r.id = t.regu_id
join kloter k on k.nomor = r.kloter_nomor
join keberangkatan_regu kb on kb.regu_id = t.regu_id
left join v_klasemen kl on kl.regu_id = t.regu_id
where k.jam_berangkat is not null
  and (select fase_live from status_acara) = 'penuh';

comment on view v_klasemen_publik is
  'Papan penuh peserta. Semua regu yang sudah berangkat ditampilkan; peringkat NULL menandai regu yang belum tercatat tiba dan tidak berhak masuk enam besar.';

do $$
begin
  assert pg_get_functiondef('klasemen_live_score()'::regprocedure)
           like '%left join v_klasemen%',
    '0144: Live Score panitia masih membuang regu tanpa peringkat';
  assert pg_get_viewdef('v_klasemen_publik'::regclass, true)
           like '%LEFT JOIN v_klasemen%',
    '0144: Live Score peserta masih membuang regu tanpa peringkat';
end;
$$;
