-- ============================================================================
-- hrcd-rekap : supabase/checks/atur_fase_live.sql
-- Pindahkan fase live. Ubah v_fase di bawah, lalu jalankan lewat
-- apply-migration.yml.
--
-- Empat fase, dan yang membedakannya APA YANG DILIHAT PESERTA:
--
--   pra      peserta tidak melihat apa pun
--   progres  peserta melihat kemajuan — siapa sudah sampai pos mana — TAPI
--            tidak melihat klasemen. publish-live.yml menolak menulis
--            klasemen selama fase belum penuh, dan penolakan itu berbunyi
--            "BOCOR" dengan sengaja.
--   penuh    klasemen dan juara terbit
--   top10    maksimal sepuluh regu eligible per golongan, hanya Total
--
-- Layar panitia (v_klasemen_live_score) TIDAK terpengaruh fase — ia selalu
-- berisi untuk yang memegang live_score. Fase hanya mengatur sisi peserta.
--
-- Ini SQL, bukan tombol, dan itu bukan pilihan yang disengaja: sampai
-- sekarang tidak ada satu layar pun yang bisa memindahkan fase. Layar Live
-- Score menampilkannya, tapi tidak mengubahnya. Di hari lomba, memindahkan
-- fase berarti membuka tab Actions — dan itu perlu diperbaiki sebelum
-- pengumuman juara, bukan sesudahnya.
-- ============================================================================
do $$
declare
  v_fase text := 'progres'; -- <<< pra | progres | penuh | top10
  v_lama text;
begin
  select fase_live into v_lama from status_acara;
  update status_acara set fase_live = v_fase;
  raise notice 'fase live: % -> %', v_lama, v_fase;
  if v_fase not in ('penuh', 'top10') then
    raise notice 'klasemen TIDAK terbit ke peserta selama fase belum penuh.';
  elsif v_fase = 'top10' then
    raise notice 'hanya Top 10 per golongan dan Total yang terbit.';
  end if;
end $$;
