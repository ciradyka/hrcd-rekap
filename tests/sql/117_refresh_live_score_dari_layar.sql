\echo '--- 117. tombol Refresh Live Score menghitung ulang, berpagar hak'

-- Yang diuji di sini BUKAN "fungsinya ada". Yang diuji: ia benar-benar
-- MENGGANTI snapshot, dan pagarnya benar-benar menahan. Tes yang cuma
-- memanggil lalu memeriksa hasilnya tidak null akan tetap hijau kalau seluruh
-- badan fungsinya diganti `select clock_timestamp()`.

-- 117.1 Menghitung ulang: cap waktu DAN isi snapshot ikut berganti.
do $$
declare
  v_juri uuid := '00000000-0000-0000-0000-000000000001';
  v_lama timestamptz;
  v_baru timestamptz;
  v_kembali timestamptz;
begin
  -- Snapshot ditanam dengan cap waktu tua DAN isi yang salah, supaya
  -- "tidak berubah" tidak bisa lolos sebagai "kebetulan sama".
  insert into cache_live_score (tunggal, dibuat_pada, data)
  values (true, now() - interval '2 days', '{"palsu": true}'::jsonb)
  on conflict (tunggal) do update
  set dibuat_pada = excluded.dibuat_pada, data = excluded.data;
  select dibuat_pada into v_lama from cache_live_score where tunggal;

  set local role authenticated;
  perform set_config('app.uid', v_juri::text, true);
  v_kembali := minta_segarkan_live_score();
  reset role;

  select dibuat_pada into v_baru from cache_live_score where tunggal;
  assert v_baru > v_lama,
    format('117.1 GAGAL: snapshot tidak dihitung ulang (%s -> %s)', v_lama, v_baru);
  assert v_kembali = v_baru,
    '117.2 GAGAL: cap waktu yang dikembalikan bukan cap waktu snapshot baru';
  assert (select data ?& array['kelengkapan', 'pos', 'komponen', 'rekap']
          from cache_live_score where tunggal),
    '117.3 GAGAL: isi snapshot tidak ikut diganti';
  assert not (select data ? 'palsu' from cache_live_score where tunggal),
    '117.4 GAGAL: isi snapshot lama masih ada';
end;
$$;

-- 117.5 Ambang 5 detik: penekanan beruntun TIDAK menghitung ulang.
--       Dijalankan segera sesudah blok di atas, jadi snapshotnya memang baru.
do $$
declare
  v_juri uuid := '00000000-0000-0000-0000-000000000001';
  v_sebelum timestamptz;
  v_sesudah timestamptz;
begin
  select dibuat_pada into v_sebelum from cache_live_score where tunggal;
  set local role authenticated;
  perform set_config('app.uid', v_juri::text, true);
  perform minta_segarkan_live_score();
  reset role;
  select dibuat_pada into v_sesudah from cache_live_score where tunggal;
  assert v_sesudah = v_sebelum,
    '117.5 GAGAL: snapshot yang baru lahir ikut dihitung ulang — '
    'ambang penekanan berbarengan tidak berlaku';
end;
$$;

-- 117.6 Pagar hak, dari DUA arah (CLAUDE.md 13.8): panggilan yang sama
--       dijalankan dua kali dengan satu baris akun_hak diubah di antaranya.
--       Tanpa arah kedua, `return true` pun lulus.
do $$
declare
  v_juri uuid := '00000000-0000-0000-0000-000000000001';
  v_ditolak boolean := false;
begin
  -- Cap waktu ditua-kan lagi supaya yang menahan di bawah benar-benar
  -- pagar haknya, bukan ambang 5 detik dari blok sebelumnya.
  update cache_live_score set dibuat_pada = now() - interval '2 days'
  where tunggal;

  delete from akun_hak where user_id = v_juri and fitur = 'live_score';
  begin
    set local role authenticated;
    perform set_config('app.uid', v_juri::text, true);
    perform minta_segarkan_live_score();
    reset role;
  exception when others then
    v_ditolak := true;
  end;
  reset role;
  insert into akun_hak (user_id, fitur) values (v_juri, 'live_score')
  on conflict do nothing;

  assert v_ditolak,
    '117.6 GAGAL: Live Score bisa disegarkan tanpa hak live_score';
end;
$$;

-- 117.7 Arah kedua: hak dikembalikan, panggilan yang sama harus lolos.
do $$
declare
  v_juri uuid := '00000000-0000-0000-0000-000000000001';
  v_lama timestamptz;
begin
  update cache_live_score set dibuat_pada = now() - interval '2 days'
  where tunggal;
  select dibuat_pada into v_lama from cache_live_score where tunggal;

  set local role authenticated;
  perform set_config('app.uid', v_juri::text, true);
  perform minta_segarkan_live_score();
  reset role;

  assert (select dibuat_pada from cache_live_score where tunggal) > v_lama,
    '117.7 GAGAL: pemegang live_score justru tidak bisa menyegarkan';
end;
$$;

-- 117.8 `anon` tidak pernah boleh menjalankannya.
do $$
declare
  v_ditolak boolean := false;
begin
  begin
    set local role anon;
    perform minta_segarkan_live_score();
    reset role;
  exception when others then
    v_ditolak := true;
  end;
  reset role;
  assert v_ditolak, '117.8 GAGAL: anon dapat menyegarkan Live Score';
end;
$$;

\echo '117 refresh live score dari layar: LULUS'
