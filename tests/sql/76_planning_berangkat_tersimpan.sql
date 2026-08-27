-- ============================================================================
-- hrcd-rekap : tests/sql/76_planning_berangkat_tersimpan.sql — migrasi 0113.
-- Jendela Planning Keberangkatan tersimpan, dan tetap bisa disimpan SAAT
-- KONFIGURASI DIKUNCI.
--
-- Bagian 76.3 yang paling penting, dan ia satu-satunya alasan kolomnya tidak
-- ditaruh di `edisi`: kunci konfigurasi menyala pada hari-H, sedangkan
-- planning keberangkatan justru disusun pada hari-H. Kalau tes ini merah,
-- fiturnya mati tepat di hari ia dipakai.
-- ============================================================================

\echo '--- 76. planning keberangkatan tersimpan'
\set ON_ERROR_STOP on

begin;

do $blok$
declare
  v_admin   uuid;
  v_cetak   uuid := '00000000-0000-0000-0000-0000000000d1';
  v_juri    uuid := '00000000-0000-0000-0000-0000000000d2';
  v_p       time;
  v_t       time;
  v_tolak   boolean;
begin
  select user_id into v_admin from akun_panitia
  where peran = 'admin' and is_active limit 1;

  -- 76.1 Keadaan awal: kosong, artinya "ikut konfigurasi edisi".
  select planning_berangkat_pertama, planning_berangkat_terakhir
    into v_p, v_t from status_acara where id = true;
  assert v_p is null and v_t is null,
    '76.1 GAGAL: kolom planning tidak lahir kosong';

  -- 76.2 Pemegang cetak_kloter boleh menyimpan — bukan hanya admin. Yang
  --      menyusun planning adalah orang yang mencetak daftar kloternya.
  insert into auth.users (id, email) values (v_cetak, 'cetak.planning@uji.local')
  on conflict (id) do nothing;
  insert into akun_panitia (user_id, username, peran, pos, is_active)
  values (v_cetak, 'cetak.planning', 'juri_pos', 1, true)
  on conflict (user_id) do update set peran = 'juri_pos', pos = 1, is_active = true;
  update akun_panitia set peran = 'registrasi', pos = null where user_id = v_cetak;

  perform set_config('app.uid', v_cetak::text, true);
  perform atur_planning_berangkat(time '07:30', time '10:15');

  select planning_berangkat_pertama, planning_berangkat_terakhir
    into v_p, v_t from status_acara where id = true;
  assert v_p = time '07:30' and v_t = time '10:15',
    format('76.2 GAGAL: tersimpan %s-%s', v_p, v_t);

  -- 76.3 TETAP BISA DISIMPAN SAAT KONFIGURASI DIKUNCI.
  --      Inilah alasan kolomnya tidak di `edisi`: trigger tolak_saat_terkunci
  --      menjaga seluruh tabel konfigurasi, dan kunci itu menyala pada hari-H
  --      — hari yang sama saat planning disusun.
  update status_acara set konfigurasi_terkunci = true where id = true;
  perform atur_planning_berangkat(time '08:00', time '11:00');
  select planning_berangkat_pertama into v_p from status_acara where id = true;
  assert v_p = time '08:00',
    '76.3 GAGAL: planning tidak bisa disimpan saat konfigurasi dikunci';
  update status_acara set konfigurasi_terkunci = false where id = true;

  -- 76.4 Jendela terbalik ditolak, dan yang lama tidak ikut rusak.
  v_tolak := false;
  begin
    perform atur_planning_berangkat(time '10:00', time '07:00');
  exception when others then v_tolak := true;
  end;
  assert v_tolak, '76.4 GAGAL: jendela terbalik diterima';
  select planning_berangkat_pertama into v_p from status_acara where id = true;
  assert v_p = time '08:00', '76.4 GAGAL: penolakan tetap mengubah yang tersimpan';

  -- 76.5 Juri pos tidak berhak. Menempati kursinya, bukan memindai nama.
  perform set_config('app.uid', '', true);
  insert into auth.users (id, email) values (v_juri, 'juri.planning@uji.local')
  on conflict (id) do nothing;
  insert into akun_panitia (user_id, username, peran, pos, is_active)
  values (v_juri, 'juri.planning', 'registrasi', null, true)
  on conflict (user_id) do update set peran = 'registrasi', pos = null, is_active = true;
  update akun_panitia set peran = 'juri_pos', pos = 2 where user_id = v_juri;

  perform set_config('app.uid', v_juri::text, true);
  v_tolak := false;
  begin
    perform atur_planning_berangkat(time '06:00', time '09:00');
  exception when others then v_tolak := true;
  end;
  assert v_tolak, '76.5 GAGAL: juri pos bisa menggeser jadwal keberangkatan';

  perform set_config('app.uid', coalesce(v_admin::text, ''), true);
end;
$blok$;

rollback;

select '76_planning_berangkat_tersimpan OK' as hasil;
