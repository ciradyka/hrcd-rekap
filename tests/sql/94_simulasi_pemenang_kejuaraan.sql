-- Simulasi 24 pemenang Eksternal dan 12 regu Intern. Dua sekolah Penegak
-- sengaja sama-sama mendapat lima gelar agar bobot Juara I-Harapan III diuji;
-- sekolah Juara Umum tetap ditentukan pertama-tama dari jumlah gelar.

create temp table simulasi_sekolah (
  kode text primary key,
  nama text not null,
  id uuid not null default gen_random_uuid(),
  pendaftaran_id uuid not null default gen_random_uuid()
);

insert into simulasi_sekolah (kode, nama) values
  ('ALPHA', 'SEKOLAH ALPHA SIMULASI'),
  ('GAMMA', 'SEKOLAH GAMMA SIMULASI'),
  ('DELTA', 'SEKOLAH DELTA SIMULASI'),
  ('BETA', 'SEKOLAH BETA SIMULASI'),
  ('EPSILON', 'SEKOLAH EPSILON SIMULASI'),
  ('ZETA', 'SEKOLAH ZETA SIMULASI'),
  ('INTERN', 'SEKOLAH INTERN SIMULASI');

create temp table simulasi_hasil (
  nomor_dada integer primary key,
  golongan text not null,
  peringkat integer not null,
  sekolah text not null references simulasi_sekolah(kode),
  nilai numeric not null
);

insert into simulasi_hasil values
  (301, 'penegak_pa', 1, 'ALPHA', 20),
  (302, 'penegak_pa', 2, 'ALPHA', 19),
  (303, 'penegak_pa', 3, 'GAMMA', 18),
  (304, 'penegak_pa', 4, 'GAMMA', 17),
  (305, 'penegak_pa', 5, 'DELTA', 16),
  (306, 'penegak_pa', 6, 'DELTA', 15),
  (307, 'penegak_pi', 1, 'ALPHA', 20),
  (308, 'penegak_pi', 2, 'GAMMA', 19),
  (309, 'penegak_pi', 3, 'GAMMA', 18),
  (310, 'penegak_pi', 4, 'ALPHA', 17),
  (311, 'penegak_pi', 5, 'GAMMA', 16),
  (312, 'penegak_pi', 6, 'ALPHA', 15),
  (313, 'penggalang_pa', 1, 'BETA', 20),
  (314, 'penggalang_pa', 2, 'EPSILON', 19),
  (315, 'penggalang_pa', 3, 'EPSILON', 18),
  (316, 'penggalang_pa', 4, 'BETA', 17),
  (317, 'penggalang_pa', 5, 'ZETA', 16),
  (318, 'penggalang_pa', 6, 'ZETA', 15),
  (319, 'penggalang_pi', 1, 'BETA', 20),
  (320, 'penggalang_pi', 2, 'BETA', 19),
  (321, 'penggalang_pi', 3, 'EPSILON', 18),
  (322, 'penggalang_pi', 4, 'EPSILON', 17),
  (323, 'penggalang_pi', 5, 'ZETA', 16),
  (324, 'penggalang_pi', 6, 'ZETA', 15);

insert into sekolah (id, name, address)
select id, nama, 'Alamat simulasi' from simulasi_sekolah;

insert into pendaftaran
  (id, sekolah_id, kode_pembayaran, butuh_barak, jumlah_menginap,
   jumlah_regu, kontak_wa, status, kunci_kirim)
select ss.pendaftaran_id, ss.id, 'SIM94-' || ss.kode, false, 0,
       case when ss.kode = 'INTERN' then 12
            else (select count(*) from simulasi_hasil sh where sh.sekolah = ss.kode)
       end,
       '084444444444', 'lunas', gen_random_uuid()
from simulasi_sekolah ss;

create temp table simulasi_regu (id uuid primary key, nomor_dada integer not null);

with dibuat as (
  insert into regu
    (pendaftaran_id, nama_regu, nama_ketua, golongan,
     nomor_dada, kloter_nomor, urutan_kloter)
  select ss.pendaftaran_id, 'REGU SIMULASI ' || sh.nomor_dada,
         'KETUA SIMULASI', sh.golongan,
         sh.nomor_dada, 75, sh.nomor_dada - 300
  from simulasi_hasil sh join simulasi_sekolah ss on ss.kode = sh.sekolah
  returning id, nomor_dada
)
insert into simulasi_regu select * from dibuat;

with dibuat as (
  insert into regu
    (pendaftaran_id, nama_regu, nama_ketua, golongan,
     nomor_dada, kloter_nomor, urutan_kloter)
  select ss.pendaftaran_id, 'REGU INTERN ' || n,
         'KETUA INTERN', case when n <= 1106 then 'intern_pa' else 'intern_pi' end,
         n, 75, n - 1076
  from generate_series(1101, 1112) n
  cross join simulasi_sekolah ss
  where ss.kode = 'INTERN'
  returning id, nomor_dada
)
insert into simulasi_regu select * from dibuat;

create temp table simulasi_jam_lama as
select jam_berangkat from kloter where nomor = 75;
update kloter set jam_berangkat = '2026-08-29 07:00:00+07' where nomor = 75;

insert into keberangkatan_regu (regu_id, recorded_by)
select id, '00000000-0000-0000-0000-00000000000a' from simulasi_regu;

insert into nilai_mentah
  (regu_id, wahana_id, nilai_1, source, created_by)
select sr.id, w.id, sh.nilai, 'manual',
       '00000000-0000-0000-0000-00000000000a'
from simulasi_hasil sh
join simulasi_regu sr using (nomor_dada)
cross join lateral (
  select id from wahana where edisi = edisi_aktif()
    and kode = 'kepramukaan_keagamaan'
) w;

-- Intern sengaja mendapat nilai Pos 5 sempurna; satu-satunya nilai Pos 5
-- Eksternal hanya 50. Juara Yel-Yel tetap harus jatuh ke nomor 301.
insert into nilai_mentah
  (regu_id, wahana_id, nilai_1, nilai_2, source, created_by)
select sr.id, w.id,
       case when sr.nomor_dada = 301 then 10 else 20 end,
       0, 'manual', '00000000-0000-0000-0000-00000000000a'
from simulasi_regu sr
cross join lateral (
  select id from wahana where edisi = edisi_aktif() and kode = 'sandi_morse'
) w
where sr.nomor_dada = 301 or sr.nomor_dada >= 1101;

set role authenticated;
select set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
create temp table hasil_simulasi_kejuaraan as select * from hasil_kejuaraan();
reset role;

do $blok$
declare
  v_salah integer;
  v_nama text;
  v_nomor integer;
begin
  select count(*) into v_salah
  from simulasi_hasil sh
  left join hasil_simulasi_kejuaraan hk
    on hk.kode = sh.golongan || '_' || sh.peringkat
   and hk.nomor_dada = sh.nomor_dada
  where hk.kode is null;
  assert v_salah = 0,
    format('94.1 GAGAL: %s dari 24 gelar tidak cocok dengan simulasi', v_salah);

  select nama_sekolah into v_nama from hasil_simulasi_kejuaraan
  where kode = 'juara_umum_penegak';
  assert v_nama = 'SEKOLAH ALPHA SIMULASI',
    format('94.2 GAGAL: Juara Umum Penegak = %s', v_nama);

  select nama_sekolah into v_nama from hasil_simulasi_kejuaraan
  where kode = 'juara_umum_penggalang';
  assert v_nama = 'SEKOLAH BETA SIMULASI',
    format('94.3 GAGAL: Juara Umum Penggalang = %s', v_nama);

  select nama_sekolah into v_nama from hasil_simulasi_kejuaraan
  where kode = 'juara_umum';
  assert v_nama = 'SEKOLAH ALPHA SIMULASI',
    format('94.4 GAGAL: Juara Umum HRCD = %s', v_nama);

  select nomor_dada into v_nomor from hasil_simulasi_kejuaraan
  where kode = 'yel_yel';
  assert v_nomor = 301,
    format('94.5 GAGAL: Intern memengaruhi Juara Yel-Yel; nomor dada = %s', v_nomor);

  select count(*) into v_salah from hasil_simulasi_kejuaraan
  where golongan like 'intern_%';
  assert v_salah = 0,
    format('94.6 GAGAL: %s gelar diberikan kepada Intern', v_salah);
end;
$blok$;

delete from nilai_mentah where regu_id in (select id from simulasi_regu);
delete from keberangkatan_regu where regu_id in (select id from simulasi_regu);
delete from regu where id in (select id from simulasi_regu);
update kloter set jam_berangkat = (select jam_berangkat from simulasi_jam_lama)
where nomor = 75;
delete from pendaftaran where id in (select pendaftaran_id from simulasi_sekolah);
delete from sekolah where id in (select id from simulasi_sekolah);

select '94_simulasi_pemenang_kejuaraan OK' hasil;
