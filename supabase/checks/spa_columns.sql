-- Kolom nyata dari view/tabel yang dipakai SPA, untuk dicocokkan dengan
-- string query PostgREST di api.js.
select table_name, string_agg(column_name, ', ' order by ordinal_position) as kolom
from information_schema.columns
where table_schema='public'
  and table_name in ('v_daftar_kloter','v_regu_ringkas','v_keberangkatan',
                     'v_sisipan_kloter','kontrak_opsi','konfig_penalti','regu')
group by table_name order by table_name;
