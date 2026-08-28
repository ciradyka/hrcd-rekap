-- Juara Yel Yel bukan pilihan panitia: pemenangnya adalah regu dengan poin
-- Pos 5 tertinggi. Poin keseluruhan lalu nomor dada memecah nilai yang sama.

delete from kejuaraan_manual where kode = 'yel_yel';

alter table kejuaraan_manual drop constraint kejuaraan_manual_kode_check;
alter table kejuaraan_manual add constraint kejuaraan_manual_kode_check
  check (kode in ('kostum', 'terfavorit', 'terjauh'));

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
  if not exists (select 1 from regu where id = p_regu
                 and nomor_dada is not null and not is_cancelled) then
    raise exception 'regu tidak ditemukan atau belum mendapat nomor dada';
  end if;

  insert into kejuaraan_manual (edisi, kode, regu_id, diubah_oleh)
  values (edisi_aktif(), p_kode, p_regu, auth.uid())
  on conflict (edisi, kode) do update
    set regu_id = excluded.regu_id,
        diubah_oleh = excluded.diubah_oleh,
        diubah_pada = now();
end;
$$;

drop view v_kejuaraan;
alter function hasil_kejuaraan() rename to hasil_kejuaraan_dasar;
revoke all on function hasil_kejuaraan_dasar() from public, authenticated;

create function hasil_kejuaraan()
returns table (
  urutan integer, kode text, nama_penghargaan text, sumber text,
  regu_id uuid, nomor_dada integer, nama_regu text, nama_sekolah text,
  golongan text, total numeric
)
language sql stable security definer
set search_path = public
as $$
  select * from hasil_kejuaraan_dasar() d where d.kode <> 'yel_yel'
  union all
  select 62, 'yel_yel', 'Juara Yel Yel', 'skor',
         y.regu_id, y.nomor_dada, y.nama_regu, y.nama_sekolah,
         y.golongan, y.poin_pos
  from (values (true)) satu(ada)
  left join lateral (
    select k.regu_id, k.nomor_dada, k.nama_regu, k.nama_sekolah,
           k.golongan, pp.poin_pos
    from v_klasemen k
    join v_poin_pos pp on pp.regu_id = k.regu_id and pp.pos = 5
    order by pp.poin_pos desc, k.total desc, k.nomor_dada
    limit 1
  ) y on true
  where boleh('live_score')
  order by urutan
$$;

revoke all on function hasil_kejuaraan() from public;
grant execute on function hasil_kejuaraan() to authenticated;
create view v_kejuaraan as select * from hasil_kejuaraan();
grant select on v_kejuaraan to authenticated;

