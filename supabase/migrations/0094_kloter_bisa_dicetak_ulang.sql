-- ============================================================================
-- hrcd-rekap : 0094_kloter_bisa_dicetak_ulang.sql
-- Kloter boleh dicetak ulang kapan pun; `dicetak_pada` adalah waktu cetak
-- TERAKHIR, bukan gembok dan bukan penanda bahwa tombol cetak harus berhenti.
--
-- Sejak 0066 tanda cetak sudah tidak menutup kloter untuk penambahan regu.
-- Namun RPC penandanya masih hanya mengubah baris yang `dicetak_pada is null`.
-- Akibatnya cetak ulang tidak memperbarui waktu, sehingga layar menampilkan
-- catatan lama seolah kertas terbaru belum pernah dibuat.
--
-- Daftar kloter yang dikirim UI tetap dibatasi ke kloter berisi. Syarat EXISTS
-- di bawah menjadi pagar kedua supaya pemanggilan manual tidak menandai kloter
-- kosong sebagai pernah dicetak.
-- ============================================================================

create or replace function tandai_kloter_dicetak(p_kloter smallint[] default null)
returns integer
language plpgsql security definer
set search_path = public
as $$
declare
  v_jumlah integer;
begin
  if not boleh('cetak_kloter') then
    raise exception 'tidak berhak: cetak_kloter';
  end if;

  update kloter k
  set dicetak_pada = now()
  where (p_kloter is null or k.nomor = any (p_kloter))
    and exists (select 1 from regu r
                join pendaftaran d on d.id = r.pendaftaran_id
                where r.kloter_nomor = k.nomor and not r.is_cancelled
                  and d.status = 'lunas');
  get diagnostics v_jumlah = row_count;
  return v_jumlah;
end;
$$;

do $$
begin
  assert not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'tandai_kloter_dicetak'
      and p.prosrc ~ 'dicetak_pada is null'
  ), 'tandai_kloter_dicetak masih menolak memperbarui waktu cetak';
end;
$$;
