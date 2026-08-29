-- ============================================================================
-- hrcd-rekap : 0161_lebur_kembar_ejaan.sql
-- Dua kembar lagi bawaan impor 0157, dan satu nama Satu Atap yang menyendiri.
--
-- KELAS KESALAHAN YANG SAMA DENGAN 0159, DAN INI KETIGA KALINYA
--
-- 0157 menyaring impornya dengan dua kunci penyamaan nama, dan dua baris ini
-- lolos dari keduanya karena EJAANNYA berbeda, bukan namanya:
--
--   MA Daarul Huda                 = MA Darul Huda        (NPSN 70059223)
--   SMK Galuh Rahayu Sindangkasih  = SMK Galuh Rahayu     (NPSN 20254622)
--
-- Yang membuktikannya bukan kemiripan nama melainkan NPSN, dan NPSN-nya ada
-- di `tools/data/sekolah_alamat.json` — kedua baris kurasi itu mencatat
-- `nama_resmi` yang PERSIS SAMA dengan nama yang diimpor 0157: "MA DAARUL
-- HUDA" dan "SMKS Galuh Rahayu Sindangkasih". Jadi buktinya sudah ada di
-- repositori ini sejak awal; yang tidak ada adalah pemeriksaan yang membacanya.
--
-- `sekolah` tidak menyimpan NPSN, jadi penyaringan impor tidak akan pernah
-- bisa lengkap — persis alasan yang ditulis 0159. Yang menahan kembar
-- berikutnya cuma `supabase/checks/sekolah_kembar.sql`, dan kali ini ia
-- BEKERJA: aturan B (ejaan h / huruf ganda) menangkap Daarul Huda, dan aturan
-- "satu nama memuat sisipan yang satunya tidak" menangkap Galuh Rahayu.
-- Jalankan pemeriksa itu sesudah setiap impor, bukan sesudah ada yang
-- mengeluh.
--
-- YANG BERTAHAN NAMA KURASINYA, SEPERTI 0159
--
-- Nama resmi keduanya lebih panjang, dan runbook bagian 5 menahan nama yang
-- DIUCAPKAN orang. Tidak ada yang menyebut "SMKS Galuh Rahayu Sindangkasih"
-- di lapangan, dan sekolah itu sudah pernah mendaftar dengan nama pendeknya.
-- Nama resminya tetap tercatat di `sekolah_alamat.json`.
--
-- SMPN 1 ATAP 1 BANJARSARI -> SMPN SATU ATAP 1 BANJARSARI
--
-- Bukan kembar, cuma sendirian. Data Referensi meringkas "Satu Atap" jadi
-- "1 Atap" pada baris ini saja (NPSN 20252095) sementara empat saudaranya
-- ditulis penuh: Jatinagara, Panumbangan, Sukamantri, Cipaku. Akibatnya
-- pembina yang mengetik "satu atap" menemukan empat dari lima. Nama sekolahnya
-- tetap Banjarsari walau letaknya di Kec. Banjaranyar — kecamatannya mekar
-- tahun 2015 dan sekolahnya tidak ikut berganti nama, sama seperti SMAN 2
-- Banjarsari di 0159.
--
-- REKAP NILAI TIDAK DISENTUH. Kedua baris yang dibuang lahir dari impor 0157
-- dan belum pernah dipilih siapa pun, tetapi pengalihan pendaftaran tetap
-- dijalankan sebelum penghapusan — persis seperti 0154 dan 0159 — supaya
-- benar walau anggapan itu meleset. Blok penutup membandingkan jumlah barisnya.
--
-- BISA DIJALANKAN DUA KALI.
-- ============================================================================

drop table if exists potret_0161;
create temporary table potret_0161 as
select (select count(*) from regu)         as regu,
       (select count(*) from nilai_mentah) as nilai_mentah,
       (select count(*) from closing_regu) as closing_regu,
       (select count(*) from pendaftaran)  as pendaftaran;

drop table if exists lebur_0161;
create temporary table lebur_0161 (buang text, simpan text, npsn text);
insert into lebur_0161 (buang, simpan, npsn) values
  ('MA Daarul Huda',                'MA Darul Huda',    '70059223'),
  ('SMK Galuh Rahayu Sindangkasih', 'SMK Galuh Rahayu', '20254622');

do $$
declare r record; v_p int; v_k int; v_total int := 0;
begin
  for r in select * from lebur_0161 order by buang loop
    if not exists (select 1 from sekolah where name = r.buang) then
      raise notice '0161: (dilewati) "%" memang tidak ada.', r.buang;
      continue;
    end if;
    if not exists (select 1 from sekolah where name = r.simpan) then
      raise exception '0161: "%" ada tetapi "%" tidak — pasangan peleburan salah',
                      r.buang, r.simpan;
    end if;

    update pendaftaran d
       set sekolah_id = (select id from sekolah where name = r.simpan)
     where d.sekolah_id = (select id from sekolah where name = r.buang);
    get diagnostics v_p = row_count;

    update kejuaraan_manual m
       set sekolah_id = (select id from sekolah where name = r.simpan)
     where m.sekolah_id = (select id from sekolah where name = r.buang);
    get diagnostics v_k = row_count;

    delete from sekolah where name = r.buang;
    v_total := v_total + 1;
    raise notice '0161: "%" -> "%" (NPSN %, % pendaftaran, % penghargaan dialihkan)',
                 r.buang, r.simpan, r.npsn, v_p, v_k;
  end loop;
  raise notice '0161: % baris kembar dilebur.', v_total;
end $$;

do $$
declare v_n int;
begin
  if exists (select 1 from sekolah where name = 'SMPN Satu Atap 1 Banjarsari') then
    raise notice '0161: (dilewati) "SMPN Satu Atap 1 Banjarsari" sudah bernama begitu.';
  else
    update sekolah set name = 'SMPN Satu Atap 1 Banjarsari'
     where name = 'SMPN 1 Atap 1 Banjarsari';
    get diagnostics v_n = row_count;
    raise notice '0161: % nama Satu Atap dibakukan (NPSN 20252095).', v_n;
  end if;
end $$;

do $$
declare
  s potret_0161%rowtype;
  n_regu int; n_nilai int; n_closing int; n_daftar int;
  v_sekolah int; v_kembar int;
begin
  select * into s from potret_0161;
  select count(*) into n_regu    from regu;
  select count(*) into n_nilai   from nilai_mentah;
  select count(*) into n_closing from closing_regu;
  select count(*) into n_daftar  from pendaftaran;
  select count(*) into v_sekolah from sekolah;

  assert (n_regu, n_nilai, n_closing, n_daftar)
         = (s.regu, s.nilai_mentah, s.closing_regu, s.pendaftaran),
    format('0161: DATA NILAI BERGESER — regu %s->%s, nilai %s->%s, closing %s->%s, pendaftaran %s->%s',
           s.regu, n_regu, s.nilai_mentah, n_nilai, s.closing_regu, n_closing,
           s.pendaftaran, n_daftar);
  assert not exists (select 1 from pendaftaran where sekolah_id is null),
    '0161: ada pendaftaran yang kehilangan sekolahnya';

  select count(*) into v_kembar from (
    select kunci_sekolah(name) from sekolah group by 1 having count(*) > 1) x;
  assert v_kembar = 0, format('0161: %s kunci sekolah kembar', v_kembar);

  raise notice '0161: % baris sekolah, rekap nilai utuh — % regu, % nilai, % closing.',
               v_sekolah, n_regu, n_nilai, n_closing;
end $$;

drop table if exists potret_0161;
drop table if exists lebur_0161;
