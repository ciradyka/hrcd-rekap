-- ============================================================================
-- hrcd-rekap : 0146_cache_live_score.sql
-- Snapshot privat Live Score agar satu kalkulasi dipakai seluruh panitia.
--
-- v_rekap_penuh menghitung seluruh rantai nilai. Menjalankannya saat setiap HP
-- membuka papan membuat lonjakan yang tidak ada gunanya: Live Score boleh
-- tertinggal beberapa menit. Snapshot terakhir tidak dihapus ketika refresh
-- gagal, sehingga layar tetap berguna dan cap waktunya tetap jujur.
-- ============================================================================

create table cache_live_score (
  tunggal       boolean primary key default true check (tunggal),
  dibuat_pada   timestamptz not null,
  data          jsonb not null
);

alter table cache_live_score enable row level security;

create policy sel_cache_live_score on cache_live_score for select
using (boleh('live_score'));

grant select on cache_live_score to authenticated, service_role;
revoke all on cache_live_score from anon;

create or replace function segarkan_cache_live_score()
returns timestamptz
language plpgsql security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_dibuat timestamptz := clock_timestamp();
  v_data jsonb;
begin
  -- View panitia tetap menjaga boleh('live_score'). Scheduled job bekerja
  -- tanpa JWT, jadi pilih satu akun aktif yang memang memegang hak itu hanya
  -- selama transaksi ini; RLS dan pagar view tetap menjalani jalur produksi.
  select h.user_id into v_uid
  from akun_hak h
  join akun_panitia a on a.user_id = h.user_id
  where h.fitur = 'live_score' and a.is_active
  order by h.user_id
  limit 1;

  if v_uid is null then
    raise exception 'Tidak ada akun aktif dengan hak live_score';
  end if;

  perform set_config('request.jwt.claim.sub', v_uid::text, true);
  -- Harness PostgreSQL lokal memakai app.uid sebagai tiruan auth.uid().
  perform set_config('app.uid', v_uid::text, true);

  select jsonb_build_object(
    'kelengkapan', (select coalesce(jsonb_agg(to_jsonb(x) order by x.pos), '[]')
                    from v_kelengkapan_pos x),
    'pos',         (select coalesce(jsonb_agg(to_jsonb(x) order by x.nomor), '[]')
                    from v_pos x),
    'komponen',    (select coalesce(jsonb_agg(to_jsonb(x)
                                      order by x.pos, x.sort_order), '[]')
                    from wahana x where x.edisi = edisi_aktif()),
    'rekap',       (select coalesce(jsonb_agg(to_jsonb(x)
                                      order by x.nomor_dada), '[]')
                    from v_rekap_penuh x)
  ) into v_data;

  insert into cache_live_score (tunggal, dibuat_pada, data)
  values (true, v_dibuat, v_data)
  on conflict (tunggal) do update
  set dibuat_pada = excluded.dibuat_pada,
      data = excluded.data;

  return v_dibuat;
end;
$$;

revoke all on function segarkan_cache_live_score() from public, anon, authenticated;
grant execute on function segarkan_cache_live_score() to service_role;

select segarkan_cache_live_score();

comment on table cache_live_score is
  'Snapshot privat Live Score panitia. Satu baris, diganti utuh tiap refresh; pembaca wajib memegang hak live_score.';
comment on function segarkan_cache_live_score() is
  'Hitung ulang snapshot Live Score. Dipanggil scheduled job, bukan oleh HP panitia.';
