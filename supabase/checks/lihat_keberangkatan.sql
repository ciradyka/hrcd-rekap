-- ============================================================================
-- hrcd-rekap : supabase/checks/lihat_keberangkatan.sql
-- HANYA MEMBACA. Cetak kloter, jam berangkatnya, dan jumlah regunya.
--
-- Jam berangkat dicetak di Asia/Jakarta, BUKAN zona sesi database: produksi
-- berjalan di UTC, dan 07:00 WIB yang dibaca sebagai 07:00 UTC adalah cara
-- paling mudah menyimpulkan jadwalnya salah padahal benar (lihat migrasi
-- 0056 dan tes 23, yang lahir dari kekeliruan yang sama).
-- ============================================================================
do $$
declare r record; v_ada boolean := false;
begin
  for r in
    select k.nomor,
           to_char(k.jam_berangkat at time zone 'Asia/Jakarta', 'HH24:MI') jam,
           (select count(*) from regu g where g.kloter_nomor = k.nomor
              and not g.is_cancelled) regu
      from kloter k
     where k.jam_berangkat is not null
     order by k.nomor
  loop
    v_ada := true;
    raise notice 'kloter % : berangkat %  (% regu)', r.nomor, r.jam, r.regu;
  end loop;
  -- Kloter yang sudah DICETAK dilewati waktu daftar ulang membagi regu
  -- (0040). Sisa tanda cetak dari uji coba lama karena itu mendorong seluruh
  -- penomoran ke atas tanpa ada yang menyadarinya.
  for r in
    select count(*) n, min(nomor) dari, max(nomor) sampai
      from kloter where dicetak_pada is not null
  loop
    if r.n > 0 then
      raise notice 'kloter tercetak: % buah, nomor %-% (dilewati saat pembagian)',
        r.n, r.dari, r.sampai;
    else
      raise notice 'tidak ada kloter yang bertanda tercetak';
    end if;
  end loop;
  if not v_ada then
    raise notice 'belum ada kloter yang berangkat';
  end if;
  for r in select jam_mulai_berangkat j, interval_berangkat_menit i,
                  kloter_dasar d, lompatan_kloter l from edisi where is_active
  loop
    raise notice 'konfigurasi: mulai %, tiap % menit, kloter dasar %, lompatan %',
      r.j, r.i, r.d, r.l;
  end loop;
end $$;
