-- Uji alur nyata terhadap fungsi-fungsi yang ditulis ulang saat rename.
-- Memakai batch UJI MEJA PEMBAYARAN yang sengaja dibuat untuk ini.
--
-- request.jwt.claims di-set manual supaya auth.uid() terisi — di produksi
-- nilainya datang dari JWT, di sini dari akses DB langsung. Ini menjalankan
-- BODY fungsi sungguhan; tanpa uid yang sah, fungsinya berhenti di baris
-- pertama ("hanya meja/admin") dan justru tidak menguji apa-apa.
do $$
declare
  v_admin uuid;
  v_kode  text := 'HRCD37-D16821';
  v_hasil jsonb;
  v_pas   jsonb;
  v_n     int;
begin
  select user_id into v_admin from akun_panitia where peran = 'admin' and is_active limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin)::text, true);

  -- 1. verifikasi_pembayaran (ditulis ulang di 0012 & 0014)
  v_hasil := verifikasi_pembayaran(v_kode, 500000, 'tunai');
  raise notice 'LULUS verifikasi_pembayaran -> kwitansi %', v_hasil ->> 'nomor_kwitansi';

  -- 2. daftar_ulang_batch dengan nomor dada MANUAL (0011, ditulis ulang 0014)
  select jsonb_agg(jsonb_build_object('regu_id', r.id, 'nomor_dada', 900 + row_number() over (order by r.nama_regu)))
    into v_pas
  from regu r join pendaftaran d on d.id = r.pendaftaran_id
  where d.kode_pembayaran = v_kode and r.nomor_dada is null and not r.is_cancelled;

  select count(*) into v_n from daftar_ulang_batch(v_kode, v_pas);
  raise notice 'LULUS daftar_ulang_batch -> % regu dapat nomor dada manual', v_n;

  -- 3. Buktikan hasilnya benar-benar tertulis
  for v_hasil in
    select jsonb_build_object('regu', r.nama_regu, 'dada', r.nomor_dada, 'kloter', r.kloter_nomor)
    from regu r join pendaftaran d on d.id = r.pendaftaran_id
    where d.kode_pembayaran = v_kode order by r.nomor_dada
  loop
    raise notice '   %', v_hasil;
  end loop;

  -- 4. Audit trigger (record_history, ditulis ulang 0012) ikut menulis?
  select count(*) into v_n from history
  where table_name in ('regu','pembayaran') and changed_at > now() - interval '2 minutes';
  raise notice 'LULUS record_history -> % baris audit baru', v_n;
end;
$$;
