-- ============================================================================
-- hrcd-rekap : 0165_refresh_live_score_dari_layar.sql
-- Tombol Refresh di layar Live Score MENGHITUNG ULANG, bukan cuma membaca ulang.
--
-- APA YANG RUSAK
--
-- `segarkan_cache_live_score()` (0146) di-revoke dari `authenticated` dan hanya
-- diberikan ke `service_role`. Satu-satunya yang memanggilnya
-- `refresh-live-score.yml`, dan cron-nya sengaja hanya hidup pada TANGGAL
-- LOMBA -- 28-29 Agustus 2026, dijaga penjaga tahun yang memang tidak boleh
-- dilebarkan (CLAUDE.md 16.9: cron adalah tagihan berjalan).
--
-- Akibatnya, di luar dua hari itu tidak ada apa pun yang mengisi ulang
-- `cache_live_score`. Tombol Refresh membaca ulang snapshot yang SAMA, jadi
-- angkanya tidak pernah berubah -- dan tidak ada satu pun galat, karena
-- membaca snapshot beku memang berhasil. Terukur: penyegaran terakhir
-- 29 Agustus 16:55 UTC, dilaporkan panitia 31 Agustus.
--
-- Ini bukan kejadian sekali. Komentar di dalam refresh-live-score.yml sendiri
-- menjadikannya alasan menjarangkan cron dari 5 menit ke 10:
--
--   "Sejak #730 layarnya punya tombol refresh sendiri, jadi yang butuh angka
--    detik itu menekannya."
--
-- Premisnya salah sejak ditulis. Tombolnya tidak pernah bisa menghitung ulang,
-- jadi cron dijarangkan dengan menyandarkan diri pada kemampuan yang tidak
-- ada. Migrasi ini membuat kalimat itu jadi benar.
--
-- KENAPA BUKAN MELEBARKAN CRON
--
-- Melebarkan jendelanya berarti membayar setiap sepuluh menit, setiap hari,
-- selamanya, untuk papan yang ditonton beberapa menit dalam sebulan -- dan
-- kuota Actions yang habis menghentikan SELURUH workflow, termasuk
-- apply-migration.yml dan yang dijalankan panitia dari HP. Yang benar
-- membiarkan cron menjaga hari lomba, dan memberi layar kemampuan menghitung
-- ulang saat diminta.
--
-- TIGA PAGAR, DAN KETIGANYA MEMANG DIPERLUKAN
--
--   1. `boleh('live_score')` -- diperiksa memakai auth.uid() PEMANGGIL, sebelum
--      apa pun dihitung. Pagar hak tetap milik pemanggil, bukan milik akun yang
--      dipinjam 0146 di dalam.
--   2. Snapshot yang baru lahir dipakai apa adanya. Papan ini ditonton belasan
--      orang sekaligus; tanpa ini satu kejadian di lapangan membuat sepuluh HP
--      menekan Refresh berbarengan dan sepuluh kali seluruh rantai skor
--      dihitung untuk jawaban yang sama.
--   3. Kunci advisory: satu penghitungan pada satu waktu. Yang tidak kebagian
--      kunci TIDAK MENGANTRE -- ia langsung mendapat snapshot yang ada.
--      Mengantre berarti tombolnya menggantung selama penghitungan orang lain,
--      dan panitia yang menunggu menekannya lagi.
--
-- Ambangnya 5 detik, bukan satu menit. Yang menekan Refresh baru saja
-- menyimpan nilai dan ingin melihatnya; ambang yang panjang mengembalikan
-- snapshot yang lahir SEBELUM ia menyimpan, dan itu persis keluhan yang
-- diperbaiki migrasi ini. Lima detik cukup memecah gelombang tekanan
-- berbarengan tanpa pernah menyembunyikan perubahan yang sudah tersimpan.
-- ============================================================================

create or replace function minta_segarkan_live_score()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dibuat timestamptz;
begin
  -- Pagar 1. auth.uid() di sini masih milik PEMANGGIL: 0146 baru menukarnya
  -- di dalam dirinya sendiri, dan itu terjadi sesudah baris ini.
  if not boleh('live_score') then
    raise exception 'Tidak berhak menyegarkan Live Score';
  end if;

  select dibuat_pada into v_dibuat from cache_live_score where tunggal;

  -- Pagar 2. Snapshot yang baru lahir dipakai apa adanya.
  if v_dibuat is not null
     and clock_timestamp() - v_dibuat < interval '5 seconds' then
    return v_dibuat;
  end if;

  -- Pagar 3. Satu penghitungan pada satu waktu. Angka kuncinya sembarang tapi
  -- TETAP; ia cuma perlu tidak dipakai fungsi lain. Kunci transaksi, jadi ia
  -- lepas sendiri saat RPC selesai maupun gagal.
  if not pg_try_advisory_xact_lock(8161465) then
    return v_dibuat;
  end if;

  return segarkan_cache_live_score();
end;
$$;

comment on function minta_segarkan_live_score() is
  'Tombol Refresh layar Live Score: hitung ulang cache bila perlu, lalu '
  'kembalikan cap waktunya. Berpagar boleh(live_score), ambang 5 detik, dan '
  'kunci advisory supaya penekanan berbarengan tidak menghitung berkali-kali.';

-- `anon` tidak pernah boleh: papan ini milik panitia, dan penghitungannya
-- membaca nilai seluruh pos.
revoke all on function minta_segarkan_live_score() from public, anon;
grant execute on function minta_segarkan_live_score() to authenticated, service_role;

-- Sekalian segarkan sekarang, karena snapshot di produksi sudah beku dua hari
-- ketika migrasi ini ditulis. Tanpa baris ini panitia harus menekan Refresh
-- sekali dulu sebelum melihat angka yang benar.
select segarkan_cache_live_score();
