-- Top 10 adalah bentuk publik keempat Live Score. Ia hanya menerbitkan regu
-- yang benar-benar sudah masuk mesin peringkat, maksimal sepuluh regu per
-- golongan, dan tidak membawa regu yang baru berangkat tetapi belum tiba.

alter table status_acara
  drop constraint status_acara_fase_live_check;

alter table status_acara
  add constraint status_acara_fase_live_check
  check (fase_live in ('pra', 'progres', 'penuh', 'top10'));

create or replace function atur_fase_live(p_fase text)
returns text
language plpgsql security definer
set search_path = public
as $$
declare v_lama text;
begin
  if not boleh('pengaturan') then
    raise exception 'tidak berhak: pengaturan';
  end if;
  if p_fase not in ('pra', 'progres', 'penuh', 'top10') then
    raise exception
      'fase tidak dikenal: % (pra / progres / penuh / top10)', p_fase;
  end if;

  select fase_live into v_lama from status_acara;
  if v_lama = p_fase then
    return v_lama;
  end if;

  update status_acara set fase_live = p_fase
   where fase_live is distinct from p_fase;

  raise notice 'fase_live: % -> %', v_lama, p_fase;
  return p_fase;
end;
$$;

create or replace view v_klasemen_publik as
with papan as (
  select
    kl.peringkat, t.nomor_dada, t.nama_regu, t.nama_sekolah, t.golongan,
    t.total_pos, t.penalti_waktu, t.penalti_checkout, t.penalti_anggota,
    t.total,
    (select jsonb_object_agg(pp.pos::text, pp.poin_pos)
     from v_poin_pos pp where pp.regu_id = t.regu_id)        as poin_per_pos,
    t.selisih_menit,
    row_number() over (
      partition by t.golongan
      order by kl.peringkat nulls last, t.nomor_dada
    )                                                       as urutan_top
  from v_total_skor t
  join regu r on r.id = t.regu_id
  join kloter k on k.nomor = r.kloter_nomor
  join keberangkatan_regu kb on kb.regu_id = t.regu_id
  left join v_klasemen kl on kl.regu_id = t.regu_id
  where k.jam_berangkat is not null
)
select
  peringkat, nomor_dada, nama_regu, nama_sekolah, golongan,
  total_pos, penalti_waktu, penalti_checkout, penalti_anggota, total,
  poin_per_pos, selisih_menit
from papan
where (select fase_live from status_acara) = 'penuh'
   or ((select fase_live from status_acara) = 'top10'
       and peringkat is not null and urutan_top <= 10);

comment on view v_klasemen_publik is
  'Papan peserta. Fase penuh memuat semua regu yang sudah berangkat; fase top10 hanya memuat maksimal sepuluh regu berperingkat per golongan.';

do $$
begin
  assert pg_get_constraintdef(
    (select oid from pg_constraint
     where conrelid = 'status_acara'::regclass
       and conname = 'status_acara_fase_live_check')) like '%top10%',
    '0145: constraint fase belum menerima top10';
  assert pg_get_functiondef('atur_fase_live(text)'::regprocedure)
           like '%top10%',
    '0145: RPC fase belum menerima top10';
  assert pg_get_viewdef('v_klasemen_publik'::regclass, true)
           like '%urutan_top%10%',
    '0145: papan publik belum membatasi Top 10';
end;
$$;
