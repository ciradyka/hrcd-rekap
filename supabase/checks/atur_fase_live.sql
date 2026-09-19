-- ============================================================================
-- hrcd-rekap : supabase/checks/atur_fase_live.sql
-- Pindahkan fase live. Ubah v_fase di bawah, lalu jalankan lewat
-- apply-migration.yml.
--
-- Lima fase, dan yang membedakannya APA YANG DILIHAT PESERTA:
--
--   pra      peserta tidak melihat apa pun
--   progres  peserta melihat kemajuan — siapa sudah sampai pos mana — TAPI
--            tidak melihat klasemen. publish-live.yml menolak menulis
--            klasemen selama fase belum penuh, dan penolakan itu berbunyi
--            "BOCOR" dengan sengaja.
--   penuh    klasemen dan juara terbit
--   top10    maksimal sepuluh regu eligible per golongan, hanya Total
--   juara    papan diganti DAFTAR JUARA, dan tidak ada yang lain (0163)
--
-- Layar panitia (v_klasemen_live_score) TIDAK terpengaruh fase — ia selalu
-- berisi untuk yang memegang live_score. Fase hanya mengatur sisi peserta.
--
-- Ini SQL, bukan tombol — tapi tombolnya sekarang ADA: layar Live Score punya
-- saklar fase untuk pemegang `pengaturan`, lewat RPC `atur_fase_live`.
-- Berkas ini jalur cadangan, dipakai kalau layar itu tidak bisa dibuka;
-- di hari lomba fase dipindahkan dari layarnya, bukan dari tab Actions.
-- ============================================================================
do $$
declare
  v_fase text := 'juara'; -- <<< pra | progres | penuh | top10 | juara
  v_lama text;
begin
  select fase_live into v_lama from status_acara;
  -- `where id` bukan hiasan: status_acara cuma punya satu baris, tapi
  -- ekstensi safeupdate hidup di produksi dan MENOLAK update tanpa
  -- WHERE. Tanpa baris ini berkas ini gagal di produksi sementara tes
  -- lokal lulus, karena safeupdate tidak ada di database uji (14.6).
  update status_acara set fase_live = v_fase where id;
  raise notice 'fase live: % -> %', v_lama, v_fase;
  if v_fase not in ('penuh', 'top10') then
    raise notice 'klasemen TIDAK terbit ke peserta selama fase belum penuh.';
  elsif v_fase = 'top10' then
    raise notice 'hanya Top 10 per golongan dan Total yang terbit.';
  end if;
end $$;
