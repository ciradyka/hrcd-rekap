-- Fase `juara` (0163). Yang diuji bukan bahwa view-nya ada, melainkan bahwa
-- ia MENUTUP di luar fasenya dan MEMBUKA di dalamnya — dua arah, dijalankan
-- dengan mengubah fasenya di antara dua panggilan yang sama persis
-- (CLAUDE.md 13.8). Pemeriksaan satu arah lolos oleh `select true`.

do $blok$
declare
  v_fase_lama text;
  v_n integer;
  v_juara integer;
  v_ditolak boolean := false;
begin
  select fase_live into v_fase_lama from status_acara;

  perform set_config(
    'app.uid', '00000000-0000-0000-0000-00000000000a', true);

  -- 115.1 Fasenya sah, dan RPC-nya menerimanya.
  assert atur_fase_live('juara') = 'juara',
    '115.1 GAGAL: admin tidak bisa memilih fase juara';

  -- 115.2 Daftar juaranya terbaca, dan isinya sama banyak dengan yang dilihat
  --       panitia. Jumlah yang lebih sedikit berarti satu pagar hak tertinggal
  --       di dalam salah satu fungsi penyusunnya — persis kegagalan yang
  --       membuat penerbit menulis berkas berisi nol penghargaan tanpa satu
  --       pun galat.
  select count(*) into v_n from v_kejuaraan_publik;
  select count(*) into v_juara from v_kejuaraan;
  assert v_n > 0, '115.2 GAGAL: daftar juara kosong pada fase juara';
  assert v_n = v_juara,
    format('115.2 GAGAL: publik memuat %s penghargaan, panitia %s',
           v_n, v_juara);

  -- 115.3 Papannya tertutup. Inilah yang membuat "peserta hanya melihat
  --       kejuaraan" bukan sekadar keputusan tampilan.
  assert not exists (select 1 from v_klasemen_publik),
    '115.3 GAGAL: klasemen masih terbuka pada fase juara';
  assert not exists (select 1 from v_progres_publik),
    '115.3 GAGAL: baris progres masih terbuka pada fase juara';

  -- 115.4 Arah sebaliknya: fase lain, daftar juara harus NOL. Dijalankan untuk
  --       keempat fase lainnya, bukan satu, karena yang dijaga di sini
  --       kebocoran dan satu fase yang terlewat sudah cukup untuk membocorkan.
  perform atur_fase_live('penuh');
  select count(*) into v_n from v_kejuaraan_publik;
  assert v_n = 0, '115.4 GAGAL: juara terbaca pada fase penuh';

  perform atur_fase_live('top10');
  select count(*) into v_n from v_kejuaraan_publik;
  assert v_n = 0, '115.4 GAGAL: juara terbaca pada fase top10';

  perform atur_fase_live('progres');
  select count(*) into v_n from v_kejuaraan_publik;
  assert v_n = 0, '115.4 GAGAL: juara terbaca pada fase progres';

  perform atur_fase_live('pra');
  select count(*) into v_n from v_kejuaraan_publik;
  assert v_n = 0, '115.4 GAGAL: juara terbaca pada fase pra';

  -- 115.5 Fase karangan tetap ditolak. Tanpa ini `atur_fase_live` yang
  --       daftarnya dilonggarkan jadi "apa saja" akan lulus seluruh tes di
  --       atas.
  begin
    perform atur_fase_live('juara_umum');
  exception when others then
    v_ditolak := true;
  end;
  assert v_ditolak, '115.5 GAGAL: fase karangan diterima';

  perform atur_fase_live(v_fase_lama);
end;
$blok$;

-- 115.6 Hak. Fungsi penyusun tanpa pagar tidak boleh bisa dipanggil siapa pun
--       selain pemilik database; itulah yang menggantikan `where` yang dibuang
--       dari dalamnya, dan tanpa pemeriksaan ini pemindahan pagar tadi bisa
--       diam-diam berubah jadi pelonggaran.
do $blok$
begin
  assert not has_function_privilege(
           'authenticated', 'hasil_kejuaraan_semua()', 'execute'),
    '115.6 GAGAL: hasil_kejuaraan_semua() terbuka untuk authenticated';
  assert not has_function_privilege(
           'anon', 'hasil_kejuaraan_semua()', 'execute'),
    '115.6 GAGAL: hasil_kejuaraan_semua() terbuka untuk anon';
  assert not has_function_privilege(
           'authenticated', 'hasil_kejuaraan_dasar()', 'execute'),
    '115.6 GAGAL: hasil_kejuaraan_dasar() terbuka untuk authenticated';
  assert has_table_privilege('anon', 'v_kejuaraan_publik', 'select'),
    '115.6 GAGAL: peserta tidak bisa membaca v_kejuaraan_publik';
end;
$blok$;

-- 115.7 Pagar hak panitia TIDAK ikut longgar. Panggilan yang sama dijalankan
--       dua kali dengan satu baris akun_hak diubah di antaranya; kalau
--       jumlahnya tidak berubah, pagarnya tidak ada lagi.
do $blok$
declare
  v_dengan integer;
  v_tanpa integer;
begin
  perform set_config(
    'app.uid', '00000000-0000-0000-0000-00000000000a', true);
  select count(*) into v_dengan from v_kejuaraan;

  delete from akun_hak
   where user_id = '00000000-0000-0000-0000-00000000000a'
     and fitur = 'live_score';
  select count(*) into v_tanpa from v_kejuaraan;

  insert into akun_hak (user_id, fitur)
  values ('00000000-0000-0000-0000-00000000000a', 'live_score')
  on conflict do nothing;

  assert v_dengan > 0,
    '115.7 GAGAL: panitia berhak tidak melihat satu penghargaan pun';
  assert v_tanpa = 0,
    format('115.7 GAGAL: panitia tanpa live_score masih melihat %s penghargaan',
           v_tanpa);
end;
$blok$;

select '115_fase_juara OK' hasil;
