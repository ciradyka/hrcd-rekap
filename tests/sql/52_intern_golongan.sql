-- ============================================================================
-- hrcd-rekap : tests/sql/52_intern_golongan.sql
-- Intern adalah dua golongan tersendiri dan hanya mengikuti Soal Tulis.
-- ============================================================================

do $blok$
declare
  v_hasil jsonb;
  v_n int;
  v_regu uuid;
  v_total numeric;
  v_nomor integer;
  v_kloter smallint;
  v_urutan smallint;
begin
  assert not komponen_berlaku(null, 'intern_pa'),
         'komponen umum/lapangan tidak boleh berlaku untuk Intern PA';
  assert not komponen_berlaku('penegak_pa', 'intern_pa'),
         'Intern PA tidak boleh memakai komponen Penegak PA';
  assert komponen_berlaku('intern', 'intern_pa'),
         'komponen Soal Tulis harus berlaku untuk Intern PA';
  assert komponen_berlaku('intern', 'intern_pi'),
         'komponen Soal Tulis harus berlaku untuk Intern PI';

  select count(*) into v_n from wahana
  where edisi = edisi_aktif() and golongan = 'intern';
  assert v_n = 5, format('Intern mendapat %s komponen, seharusnya 5 Soal Tulis', v_n);

  select count(*) into v_n from wahana
  where edisi = edisi_aktif() and golongan = 'intern'
    and name in ('Keagamaan', 'Kepramukaan', 'Kesehatan',
                 'Pengetahuan Umum', 'Logika');
  assert v_n = 5, format('hanya %s dari lima Soal Tulis yang tersedia', v_n);

  v_hasil := submit_pendaftaran(
    'SMAN 1 Ciamis',
    'alamat dari form tidak boleh mengganti kurasi',
    false,
    '081234567890',
    '[{"nama_regu":"Uji Intern Putra","nama_ketua":"Ketua Putra","golongan":"intern_pa"},
      {"nama_regu":"Uji Intern Putri","nama_ketua":"Ketua Putri","golongan":"intern_pi"}]'::jsonb,
    0::smallint,
    gen_random_uuid(),
    'Kontak Internal'
  );

  assert (v_hasil ->> 'jumlah_regu')::int = 2,
         format('pendaftaran internal menghasilkan %s regu', v_hasil ->> 'jumlah_regu');

  select count(*) into v_n
  from regu r
  join pendaftaran d on d.id = r.pendaftaran_id
  join sekolah s on s.id = d.sekolah_id
  where s.name = 'SMAN 1 Ciamis'
    and r.golongan in ('intern_pa', 'intern_pi')
    and r.nama_regu in ('Uji Intern Putra', 'Uji Intern Putri');
  assert v_n = 2, format('hanya %s regu internal yang tersimpan', v_n);

  select count(*) into v_n from sekolah where name = 'SMAN 1 Ciamis';
  assert v_n = 1, format('SMAN 1 Ciamis terpecah menjadi %s baris', v_n);

  select r.id into v_regu from regu r
  where r.nama_regu = 'Uji Intern Putra';
  update pendaftaran set status = 'lunas'
  where id = (select pendaftaran_id from regu where id = v_regu);

  insert into nilai_mentah (regu_id, wahana_id, nilai_1, source, created_by)
  select v_regu, w.id, w.total_soal, 'manual',
         (select id from auth.users order by id limit 1)
  from wahana w
  where w.edisi = edisi_aktif() and w.golongan = 'intern';

  select total into v_total from v_total_skor where regu_id = v_regu;
  assert v_total = 300,
         format('Intern bernilai Soal Tulis penuh harus mendapat 300, bukan %s', v_total);

  select penalti_checkout + penalti_anggota into v_total
  from v_total_skor where regu_id = v_regu;
  assert v_total = 0,
         format('Intern terkena %s penalti selain waktu', v_total);

  select n.nomor into v_nomor from nomor_dada_stok n
  where not exists (select 1 from regu r where r.nomor_dada = n.nomor)
  order by n.nomor desc limit 1;
  select k.nomor into v_kloter from kloter k
  where exists (
    select 1 from generate_series(1, 10) u
    where not exists (select 1 from regu r
                      where r.kloter_nomor = k.nomor and r.urutan_kloter = u)
  ) order by k.nomor desc limit 1;
  select u::smallint into v_urutan from generate_series(1, 10) u
  where not exists (select 1 from regu r
                    where r.kloter_nomor = v_kloter and r.urutan_kloter = u)
  order by u limit 1;

  update regu set nomor_dada = v_nomor, kloter_nomor = v_kloter,
                  urutan_kloter = v_urutan, kontrak_menit = 240
  where id = v_regu;

  set local role authenticated;
  perform set_config('app.uid',
                     '00000000-0000-0000-0000-00000000000a', true);
  select count(*) into v_n from v_lembar_pos where regu_id = v_regu;
  assert v_n = 3,
         format('Intern muncul di %s pos; seharusnya hanya tiga pos Soal Tulis', v_n);
  select sum(jumlah_komponen) into v_n from v_lembar_pos where regu_id = v_regu;
  assert v_n = 5,
         format('form Intern memuat %s komponen; seharusnya lima Soal Tulis', v_n);
  reset role;

  update kloter set jam_berangkat = '2026-08-29 07:00:00+07'
  where nomor = v_kloter;
  insert into keberangkatan_regu (regu_id, recorded_by)
  values (v_regu, (select id from auth.users order by id limit 1));
  insert into closing_regu
    (regu_id, jam_datang, anggota_hadir, recorded_by, note)
  values
    (v_regu, '2026-08-29 11:03:00+07', 3,
     (select id from auth.users order by id limit 1), 'uji Intern');

  select total into v_total from v_total_skor where regu_id = v_regu;
  assert v_total = 297,
         format('300 Soal Tulis - 3 menit harus 297, bukan %s', v_total);
  select penalti_checkout + penalti_anggota into v_total
  from v_total_skor where regu_id = v_regu;
  assert v_total = 0,
         format('Intern terkena %s penalti checkout/anggota setelah closing', v_total);
  select peringkat into v_n from v_klasemen where regu_id = v_regu;
  assert v_n = 1, format('Intern PA harus memulai klasemennya sendiri di peringkat %s', v_n);

  raise notice '52: Intern PA/PI terpisah dan hanya dinilai dari 5 Soal Tulis + waktu.';
end;
$blok$;

\echo '52 golongan Intern: LULUS'
