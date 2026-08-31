\echo '--- 118. gembok per lomba: menahan lombanya sendiri, melepas yang lain'

-- Yang diuji BUKAN "fungsinya ada". Yang diuji: gembok satu lomba benar-benar
-- menahan tulisan ke lomba ITU, dan benar-benar TIDAK menahan lomba lain di
-- pos yang sama. Arah kedua yang biasanya hilang — tanpa ia, gembok yang
-- menahan segalanya juga lulus, dan itu persis perilaku lama yang diganti.
--
-- FIXTURE-NYA DIBANGUN SENDIRI. Di titik ini dalam run.sh seluruh data
-- operasional sudah dibersihkan tes sebelumnya: 143 regu, NOL bernomor dada.
-- Tes yang bersandar pada sisa tes lain akan lulus atau gagal tergantung
-- urutan berkas, dan itu bukan sesuatu yang boleh menentukan apakah gembok
-- nilai bekerja.

do $$
declare v_regu uuid;
begin
  -- Menempati kursi admin: kunci_nilai_pos dan kawan-kawan berpagar
  -- boleh('pos'), yang membaca auth.uid(). Tanpa ini tesnya menguji
  -- penolakan hak, bukan gemboknya.
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);
  select id into v_regu from regu where not is_cancelled
  order by nama_regu limit 1;
  assert v_regu is not null, '118 GAGAL: tidak ada regu sama sekali di harness';

  -- Nomor dada harus ADA DI STOK: `regu_nomor_dada_fkey` menunjuk
  -- nomor_dada_stok, karena nomor dada adalah kain fisik yang benar-benar
  -- dicetak, bukan angka bebas.
  insert into nomor_dada_stok (nomor) values (901) on conflict do nothing;
  -- regu_check menuntut nomor dada dan kloter hidup-mati bersama.
  update regu set nomor_dada = 901, kloter_nomor = 40, urutan_kloter = 8
  where id = v_regu;
  delete from nilai_terkunci;
end;
$$;

-- 118.1 Menggembok satu lomba menahan tulisan ke lomba itu.
do $$
declare
  v_pos smallint; v_lomba text; v_kode text; v_hasil jsonb;
  v_gol text;
begin
  -- Menempati kursi admin: kunci_nilai_pos dan kawan-kawan berpagar
  -- boleh('pos'), yang membaca auth.uid(). Tanpa ini tesnya menguji
  -- penolakan hak, bukan gemboknya.
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);
  select golongan into v_gol from regu where nomor_dada = 901;

  -- Pos yang punya LEBIH DARI SATU lomba yang berlaku untuk golongan regu
  -- ini — kalau tidak, arah kedua di 118.3 tidak bisa diuji sama sekali.
  select w.pos into v_pos
  from wahana w
  where w.edisi = edisi_aktif() and komponen_berlaku(w.golongan, v_gol)
  group by w.pos
  having count(distinct lomba_komponen(w.id)) > 1
  order by w.pos limit 1;
  assert v_pos is not null,
    '118 GAGAL: tidak ada pos berlomba lebih dari satu untuk golongan regu uji';

  select lomba_komponen(w.id), w.kode into v_lomba, v_kode
  from wahana w
  where w.edisi = edisi_aktif() and w.pos = v_pos and komponen_berlaku(w.golongan, v_gol)
  order by w.sort_order, w.kode limit 1;

  perform kunci_nilai_pos(901, v_pos, v_lomba);
  assert nilai_tergembok((select id from regu where nomor_dada = 901), v_pos, v_lomba),
    '118.1 GAGAL: lomba tidak tergembok sesudah kunci_nilai_pos';

  -- simpan_nilai_massal TIDAK MELEMPAR sejak 0119: ia mengembalikan laporan
  -- per baris. Tes yang menunggu exception akan lulus karena alasan yang salah
  -- (dan versi pertama tes ini memang begitu — ia "lulus" waktu tulisannya
  -- ditolak gara-gara p_sumber salah ketik, bukan gara-gara gemboknya).
  select simpan_nilai_massal(
    jsonb_build_array(jsonb_build_object('nomor_dada', 901, 'kode', v_kode,
      'nilai_1', (select rentang_mentah_min from wahana
                  where edisi = edisi_aktif() and pos = v_pos and kode = v_kode))),
    'manual', v_pos) into v_hasil;
  assert v_hasil->0->>'status' = 'ditolak',
    format('118.2 GAGAL: nilai lomba yang tergembok masih bisa ditulis (%s)', v_hasil);
  assert v_hasil->0->>'alasan' like '%%digembok%%',
    format('118.2 GAGAL: ditolak, tapi bukan karena gembok (%s)', v_hasil->0->>'alasan');
  -- Pesannya harus menyebut LOMBANYA: "nilai regu ini sudah digembok" di pos
  -- berisi lima lomba tidak memberi tahu yang mana.
  assert v_hasil->0->>'alasan' like 'Lomba %%',
    format('118.2 GAGAL: pesan tidak menyebut lombanya (%s)', v_hasil->0->>'alasan');
end;
$$;

-- 118.3 ARAH KEDUA: lomba LAIN di pos yang sama tetap boleh ditulis.
--       Inilah yang membedakan gembok per lomba dari gembok per pos, dan
--       tanpa pemeriksaan ini perilaku lama pun lulus.
do $$
declare
  v_pos smallint; v_terkunci text; v_kode text; v_gol text; v_hasil jsonb;
begin
  -- Menempati kursi admin: kunci_nilai_pos dan kawan-kawan berpagar
  -- boleh('pos'), yang membaca auth.uid(). Tanpa ini tesnya menguji
  -- penolakan hak, bukan gemboknya.
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);
  select golongan into v_gol from regu where nomor_dada = 901;
  select pos, kode_lomba into v_pos, v_terkunci from nilai_terkunci limit 1;

  select w.kode into v_kode
  from wahana w
  where w.edisi = edisi_aktif() and w.pos = v_pos
    and komponen_berlaku(w.golongan, v_gol)
    and lomba_komponen(w.id) <> v_terkunci
  order by w.sort_order, w.kode limit 1;
  assert v_kode is not null,
    '118.3 GAGAL: tidak menemukan lomba lain di pos yang sama — fixture salah';

  select simpan_nilai_massal(
    jsonb_build_array(jsonb_build_object('nomor_dada', 901, 'kode', v_kode,
      'nilai_1', (select rentang_mentah_min from wahana
                  where edisi = edisi_aktif() and pos = v_pos and kode = v_kode))),
    'manual', v_pos) into v_hasil;
  assert v_hasil->0->>'status' = 'tersimpan',
    format('118.3 GAGAL: lomba lain di pos yang sama ikut tertahan — '
           'gemboknya masih per pos, bukan per lomba (%s)', v_hasil);
end;
$$;

-- 118.4 Alasan wajib, dan membuka gembok mengembalikan hak tulisnya.
do $$
declare
  v_pos smallint; v_lomba text; v_kode text; v_gol text;
  v_tanpaAlasan boolean := false; v_hasil jsonb;
begin
  -- Menempati kursi admin: kunci_nilai_pos dan kawan-kawan berpagar
  -- boleh('pos'), yang membaca auth.uid(). Tanpa ini tesnya menguji
  -- penolakan hak, bukan gemboknya.
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);
  select golongan into v_gol from regu where nomor_dada = 901;
  select pos, kode_lomba into v_pos, v_lomba from nilai_terkunci limit 1;

  begin
    perform buka_kunci_nilai_pos(901, v_pos, v_lomba, '   ');
  exception when others then v_tanpaAlasan := true;
  end;
  assert v_tanpaAlasan, '118.4 GAGAL: gembok terbuka tanpa alasan';

  perform buka_kunci_nilai_pos(901, v_pos, v_lomba, 'uji buka gembok');
  assert not nilai_tergembok((select id from regu where nomor_dada = 901), v_pos, v_lomba),
    '118.5 GAGAL: gembok masih terpasang sesudah dibuka';

  select w.kode into v_kode from wahana w
  where w.edisi = edisi_aktif() and w.pos = v_pos
    and komponen_berlaku(w.golongan, v_gol) and lomba_komponen(w.id) = v_lomba
  order by w.sort_order, w.kode limit 1;

  select simpan_nilai_massal(
    jsonb_build_array(jsonb_build_object('nomor_dada', 901, 'kode', v_kode,
      'nilai_1', (select rentang_mentah_min from wahana
                  where edisi = edisi_aktif() and pos = v_pos and kode = v_kode))),
    'manual', v_pos) into v_hasil;
  assert v_hasil->0->>'status' = 'tersimpan',
    format('118.6 GAGAL: masih tertahan sesudah gemboknya dibuka (%s)', v_hasil);

  -- Alasannya dicatat SEBELUM barisnya hilang, beserta lombanya. Tanpa lomba
  -- di row_id, dua pembukaan di pos yang sama tidak bisa dibedakan.
  assert exists (select 1 from history
    where table_name = 'nilai_terkunci'
      and new_value->>'lomba' = v_lomba
      and new_value->>'alasan_buka_gembok' = 'uji buka gembok'),
    '118.7 GAGAL: alasan buka gembok tidak tercatat beserta lombanya';
end;
$$;

-- 118.8 Lomba yang tidak ada di pos itu ditolak — kunci salah ketik tidak
--       boleh melahirkan gembok yang tidak menahan apa pun.
do $$
declare v_pos smallint; v_ditolak boolean := false;
begin
  -- Menempati kursi admin: kunci_nilai_pos dan kawan-kawan berpagar
  -- boleh('pos'), yang membaca auth.uid(). Tanpa ini tesnya menguji
  -- penolakan hak, bukan gemboknya.
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);
  select pos into v_pos from v_lomba_pos where edisi = edisi_aktif() limit 1;
  begin
    perform kunci_nilai_pos(901, v_pos, 'lomba-yang-tidak-ada');
  exception when others then v_ditolak := true;
  end;
  assert v_ditolak, '118.8 GAGAL: gembok diterima untuk lomba yang tidak ada di pos itu';
end;
$$;

-- 118.9 v_lomba_pos menyatukan komponen satu lomba jadi SATU baris, dan
--       setiap komponen menemukan lombanya.
do $$
declare v_ganda int;
begin
  -- Menempati kursi admin: kunci_nilai_pos dan kawan-kawan berpagar
  -- boleh('pos'), yang membaca auth.uid(). Tanpa ini tesnya menguji
  -- penolakan hak, bukan gemboknya.
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);
  select count(*) into v_ganda from (
    select pos, nama from v_lomba_pos
    where edisi = edisi_aktif() group by pos, nama having count(*) > 1) x;
  assert v_ganda = 0,
    format('118.9 GAGAL: %s lomba muncul lebih dari sekali di v_lomba_pos', v_ganda);

  assert not exists (select 1 from wahana w
    where w.edisi = edisi_aktif() and lomba_komponen(w.id) is null),
    '118.10 GAGAL: ada komponen yang tidak menemukan lombanya';
end;
$$;

-- Fixture dikembalikan: tes sesudahnya tidak boleh menemukan regu bernomor
-- dada yang tidak pernah mereka buat.
do $$
begin
  -- Menempati kursi admin: kunci_nilai_pos dan kawan-kawan berpagar
  -- boleh('pos'), yang membaca auth.uid(). Tanpa ini tesnya menguji
  -- penolakan hak, bukan gemboknya.
  perform set_config('app.uid', '00000000-0000-0000-0000-00000000000a', true);
  delete from nilai_terkunci;
  delete from nilai_mentah where regu_id = (select id from regu where nomor_dada = 901);
  update regu set nomor_dada = null, kloter_nomor = null, urutan_kloter = null
  where nomor_dada = 901;
end;
$$;

\echo '118 gembok per lomba: LULUS'
