-- ============================================================================
-- hrcd-rekap : tests/sql/73_sisipan_kloter_hak_gerbang.sql — migrasi 0111.
-- Daftar sisipan mengikuti hak keberangkatan, bukan centang Live Score.
--
-- Bentuknya tes 30-36 (CLAUDE.md 13.8): duduki kursi akun gerbang, panggil
-- viewnya, ubah SATU baris `akun_hak`, panggil lagi. Kalau jawabannya tidak
-- berubah, pagarnya tidak ada.
--
-- 73.1 sengaja MEMBUAT satu sisipan lebih dulu. Tanpa itu tes bisa lulus untuk
-- alasan yang salah — nol baris karena memang tidak ada regu yang disisipkan,
-- bukan karena haknya bekerja.
-- ============================================================================

\echo '--- 73. daftar sisipan mengikuti hak gerbang'
\set ON_ERROR_STOP on

-- Akun uji, sisipan uji, dan pencabutan haknya semua dibatalkan di akhir.
begin;

do $blok$
declare
  v_gerbang uuid := '00000000-0000-0000-0000-0000000000c7';
  v_regu    uuid;
  v_jumlah  integer;
begin
  select r.id into v_regu
  from regu r
  join kloter k on k.nomor = r.kloter_nomor
  where not r.is_cancelled and r.nomor_dada is not null
  limit 1;
  assert v_regu is not null,
    '73.0: tidak ada regu berkloter yang bisa dijadikan sisipan uji';

  update regu
  set disisipkan_pada = now(), alasan_sisip = 'uji 73'
  where id = v_regu;

  -- Akun dibuat sebagai juri_pos lalu peran-nya DIUBAH ke gerbang: trigger
  -- `hak_ikut_peran` (0077) hanya menyala pada `update of peran`, jadi insert
  -- langsung sebagai gerbang menghasilkan akun tanpa satu centang pun.
  insert into auth.users (id, email)
  values (v_gerbang, 'gerbang.sisipan@uji.local')
  on conflict (id) do nothing;

  insert into akun_panitia (user_id, username, peran, pos, is_active)
  values (v_gerbang, 'gerbang.sisipan', 'juri_pos', 1, true)
  on conflict (user_id) do update
    set peran = 'juri_pos', pos = 1, is_active = true;
  update akun_panitia set peran = 'gerbang', pos = null
  where user_id = v_gerbang;

  -- Justru inilah tindakan yang wajar dan yang dulu mematikan kartu merahnya.
  delete from akun_hak where user_id = v_gerbang and fitur = 'live_score';

  perform set_config('app.uid', v_gerbang::text, true);
  set local role authenticated;

  select count(*) into v_jumlah from v_sisipan_kloter;
  assert v_jumlah > 0,
    '73.1 GAGAL: daftar sisipan kosong untuk gerbang yang tidak memegang live_score';

  -- Pagarnya TIDAK boleh dibetulkan dengan membuka pendaftaran — di dalamnya
  -- ada nomor WA pembina seluruh sekolah, dan petugas gerbang tidak perlu itu.
  select count(*) into v_jumlah from pendaftaran;
  assert v_jumlah = 0,
    '73.2 GAGAL: gerbang bisa membaca tabel pendaftaran secara langsung';

  reset role;
  delete from akun_hak where user_id = v_gerbang and fitur = 'keberangkatan';
  perform set_config('app.uid', v_gerbang::text, true);
  set local role authenticated;

  select count(*) into v_jumlah from v_sisipan_kloter;
  assert v_jumlah = 0,
    '73.3 GAGAL: daftar sisipan tetap terbuka sesudah hak keberangkatan dicabut';

  reset role;
  perform set_config('app.uid', '', true);
end;
$blok$;

rollback;

select '73_sisipan_kloter_hak_gerbang OK' as hasil;
