-- Tidak adanya catatan tiba bukan penalti skor. Regu itu tetap membawa nilai
-- pos yang sudah dikumpulkan, tetapi belum sah masuk klasemen atau menerima
-- gelar sampai meja Kedatangan mencatat jam datangnya.

alter table konfig_penalti
  alter column penalti_tanpa_checkout set default 0;

update konfig_penalti
set penalti_tanpa_checkout = 0
where penalti_tanpa_checkout <> 0;

create or replace view v_klasemen with (security_invoker = on) as
select
  rank() over (partition by t.golongan
               order by t.total desc, abs(coalesce(t.selisih_menit, 100000)) asc)
    as peringkat,
  t.*
from v_total_skor t
where exists (select 1 from keberangkatan_regu kb where kb.regu_id = t.regu_id)
  and exists (select 1 from regu r join kloter k on k.nomor = r.kloter_nomor
              where r.id = t.regu_id and k.jam_berangkat is not null)
  and exists (select 1 from closing_regu c where c.regu_id = t.regu_id);

comment on view v_klasemen is
  'Peringkat per golongan untuk regu yang benar-benar berangkat dan sudah tercatat tiba. Regu tanpa jam datang tetap ada di rekap, tetapi tidak berperingkat dan tidak dapat menjadi juara.';

-- Pilihan penghargaan khusus yang dibuat sebelum aturan ini juga tidak boleh
-- membuat regu tanpa jam datang tetap tampil sebagai juara.
delete from kejuaraan_manual m
where not exists (select 1 from closing_regu c where c.regu_id = m.regu_id);

create or replace function simpan_kejuaraan_manual(p_kode text, p_regu uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not boleh('pengaturan') then
    raise exception 'akun ini tidak berhak mengubah Kejuaraan';
  end if;
  if p_kode not in ('kostum', 'terfavorit', 'terjauh') then
    raise exception 'penghargaan manual tidak dikenal';
  end if;

  if p_regu is null then
    delete from kejuaraan_manual
    where edisi = edisi_aktif() and kode = p_kode;
    return;
  end if;

  if not exists (
    select 1 from regu r
    join closing_regu c on c.regu_id = r.id
    where r.id = p_regu and r.nomor_dada is not null and not r.is_cancelled
      and r.golongan not like 'intern_%'
  ) then
    raise exception 'regu tidak ditemukan, belum tiba, belum mendapat nomor dada, atau termasuk Intern';
  end if;

  insert into kejuaraan_manual (edisi, kode, regu_id, diubah_oleh)
  values (edisi_aktif(), p_kode, p_regu, auth.uid())
  on conflict (edisi, kode) do update
    set regu_id = excluded.regu_id,
        diubah_oleh = excluded.diubah_oleh,
        diubah_pada = now();
end;
$$;

do $$
declare
  v_default numeric;
begin
  select pg_get_expr(d.adbin, d.adrelid)::numeric into v_default
  from pg_attrdef d
  join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
  where d.adrelid = 'konfig_penalti'::regclass
    and a.attname = 'penalti_tanpa_checkout';

  assert v_default = 0, '0143: default penalti tanpa jam datang bukan nol';
  assert not exists (
    select 1 from konfig_penalti where penalti_tanpa_checkout <> 0
  ), '0143: masih ada konfigurasi penalti tanpa jam datang yang bukan nol';
end;
$$;
