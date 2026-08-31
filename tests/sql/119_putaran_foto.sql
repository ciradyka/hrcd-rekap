\echo '--- 119. putaran foto: tersimpan, dinormalkan, berpagar pos'

do $$
declare v_id uuid; v_hasil smallint; v_ditolak boolean := false;
begin
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);

  select id into v_id from foto_lembar limit 1;
  if v_id is null then
    -- Harness tanpa foto: tanam satu, lalu dibuang lagi di akhir.
    insert into foto_lembar (pos, kode_lomba, nama_lomba, path, ukuran_bytes,
                             diunggah_oleh)
    values (1, 'uji-putaran', 'Uji Putaran', 'pos1/uji/putaran.jpg', 1000,
            '00000000-0000-0000-0000-00000000000a')
    returning id into v_id;
  end if;

  -- 119.1 Bawaannya nol — foto lama tidak boleh tiba-tiba miring.
  assert (select putaran from foto_lembar where id = v_id) = 0,
    '119.1 GAGAL: putaran bawaan bukan 0';

  -- 119.2 Tersimpan, bukan cuma dikembalikan.
  v_hasil := putar_foto_lembar(v_id, 90::smallint);
  assert v_hasil = 90, format('119.2 GAGAL: kembalian %s, bukan 90', v_hasil);
  assert (select putaran from foto_lembar where id = v_id) = 90,
    '119.2 GAGAL: putaran tidak tersimpan di barisnya';

  -- 119.3 Dinormalkan: 360 sama dengan 0, -90 sama dengan 270. Layar yang
  --       menghitung sendiri "putaran + 90" akan mengirim 360 pada ketukan
  --       keempat, dan menolaknya cuma memindahkan perhitungan itu ke sana.
  assert putar_foto_lembar(v_id, 360::smallint) = 0,
    '119.3 GAGAL: 360 tidak dinormalkan jadi 0';
  assert putar_foto_lembar(v_id, (-90)::smallint) = 270,
    '119.3 GAGAL: -90 tidak dinormalkan jadi 270';

  -- 119.4 Sudut yang bukan kelipatan 90 ditolak.
  begin
    perform putar_foto_lembar(v_id, 45::smallint);
  exception when others then v_ditolak := true;
  end;
  assert v_ditolak, '119.4 GAGAL: sudut 45 diterima';

  -- 119.5 Foto yang tidak ada ditolak, bukan diam-diam tidak mengubah apa pun.
  v_ditolak := false;
  begin
    perform putar_foto_lembar('00000000-0000-0000-0000-0000000000ff'::uuid, 90::smallint);
  exception when others then v_ditolak := true;
  end;
  assert v_ditolak, '119.5 GAGAL: memutar foto yang tidak ada tidak ditolak';

  -- Dikembalikan ke tegak supaya tes sesudahnya tidak menemukan foto miring
  -- yang tidak pernah mereka putar.
  perform putar_foto_lembar(v_id, 0::smallint);
  delete from foto_lembar where kode_lomba = 'uji-putaran';
end;
$$;

-- 119.6 Pagar hak, DUA ARAH (CLAUDE.md 13.8). Tanpa arah kedua, `return true`
--       pun lulus.
do $$
declare
  v_juri uuid := '00000000-0000-0000-0000-000000000001';
  v_id uuid; v_ditolak boolean := false;
begin
  insert into foto_lembar (pos, kode_lomba, nama_lomba, path, ukuran_bytes, diunggah_oleh)
  values (1, 'uji-putaran', 'Uji Putaran', 'pos1/uji/hak.jpg', 1000,
          '00000000-0000-0000-0000-00000000000a')
  returning id into v_id;

  delete from akun_hak where user_id = v_juri and fitur = 'pos';
  begin
    perform set_config('app.uid', v_juri::text, true);
    perform putar_foto_lembar(v_id, 90::smallint);
  exception when others then v_ditolak := true;
  end;
  insert into akun_hak (user_id, fitur) values (v_juri, 'pos') on conflict do nothing;
  assert v_ditolak, '119.6 GAGAL: foto bisa diputar tanpa hak pos';

  -- Arah kedua: hak dikembalikan, panggilan yang sama harus lolos.
  perform set_config('app.uid', v_juri::text, true);
  assert putar_foto_lembar(v_id, 90::smallint) = 90,
    '119.7 GAGAL: pemegang hak pos justru tidak bisa memutar';

  delete from foto_lembar where id = v_id;
end;
$$;

\echo '119 putaran foto: LULUS'
