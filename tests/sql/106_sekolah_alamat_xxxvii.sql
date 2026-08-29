\echo '--- 106. sekolah edisi XXXVII: nama baku, alamat baku, rekap nilai utuh'

-- 0154 dijalankan tepat sebelum berkas ini. Yang diperiksa di sini bukan
-- jumlah barisnya — database uji tidak memuat baris ketikan pembina yang jadi
-- alasan migrasinya ada — melainkan bahwa jalur yang MEMANG berlaku di sini
-- berjalan benar, dan bahwa pagarnya masih terpasang.

do $$
declare v_alamat text;
begin
  -- 1. Pembakuan nama benar-benar terjadi. `SMA 1 Sindangkasih` datang dari
  --    daftar kurasi 0063 dan kehilangan huruf N-nya di sana; runbook bagian 4
  --    mengharuskan `SMA NEGERI 1 ...` ditulis `SMAN 1 ...`.
  assert exists (select 1 from sekolah where name = 'SMAN 1 Sindangkasih'),
    '106.1 GAGAL: SMA 1 Sindangkasih belum dibakukan jadi SMAN 1 Sindangkasih';
  assert not exists (select 1 from sekolah where name = 'SMA 1 Sindangkasih'),
    '106.2 GAGAL: nama lama SMA 1 Sindangkasih masih ada';

  select address into v_alamat from sekolah where name = 'SMAN 1 Sindangkasih';
  assert v_alamat = 'Jl. Raya Sindangkasih Cikoneng, Sindangkasih, Kec. Sindangkasih, Kabupaten Ciamis, Jawa Barat 46268, Indonesia',
    format('106.3 GAGAL: alamat SMAN 1 Sindangkasih tidak baku: %s', v_alamat);
end;
$$;

do $$
declare r record; v_n int := 0;
begin
  -- 2. Bentuk alamat mengikuti runbook bagian 8: berakhir ", Indonesia",
  --    memakai "Kec. " untuk kecamatan, dan menulis Kabupaten/Kota penuh.
  --
  --    Diperiksa HANYA atas baris yang alamatnya dipasang 0154. Memeriksa
  --    seluruh tabel akan menabrak delapan sekolah karangan dari 01_seed_uji
  --    dan 0092/0105 — "Jl. Batal 1", "Ciamis" — yang memang tidak pernah
  --    dimaksudkan berbentuk alamat surat.
  for r in
    select name, address from sekolah
     where name in ('MA Bahrul Anwar', 'MTs Bahrul Anwar', 'MA Sirnarasa',
                    'MA IPHI Pamarican', 'MTsN 1 Ciamis', 'MTsN 4 Ciamis',
                    'SMPN 1 Kawali', 'SMPN 2 Kawali', 'SMPN 3 Kawali',
                    'SMPN 3 Baregbeg', 'SMPN 4 Ciamis', 'SMA IT MD Fathahillah',
                    'SMP IT MD Fathahillah', 'SMK As-Sulthoniah', 'MTs Adzkia',
                    'MA Adzkia', 'SMA Terpadu Al-Mu''aawanah',
                    'SMAN 1 Sindangkasih')
  loop
    v_n := v_n + 1;
    assert r.address like '%, Indonesia',
      format('106.4 GAGAL: alamat %s tidak berakhir ", Indonesia": %s', r.name, r.address);
    assert r.address like '%Kec. %',
      format('106.5 GAGAL: alamat %s tidak memuat "Kec. ": %s', r.name, r.address);
    assert r.address not like '%Kab. %',
      format('106.6 GAGAL: alamat %s masih meringkas "Kab.": %s', r.name, r.address);
    assert r.address not like '%  %',
      format('106.7 GAGAL: alamat %s memuat spasi ganda: %s', r.name, r.address);
  end loop;
  raise notice '106: % alamat baku diperiksa bentuknya.', v_n;
end;
$$;

do $$
declare v_n int;
begin
  -- 4. Pagar kembar masih berdiri, dan tidak ada pendaftaran yang kehilangan
  --    sekolahnya waktu baris kembar dilebur.
  select count(*) into v_n from (
    select kunci_sekolah(name) from sekolah group by 1 having count(*) > 1
  ) x;
  assert v_n = 0, format('106.8 GAGAL: %s kunci sekolah kembar', v_n);

  assert not exists (select 1 from pendaftaran where sekolah_id is null),
    '106.9 GAGAL: ada pendaftaran tanpa sekolah';

  assert not exists (
    select 1 from pendaftaran d
     where not exists (select 1 from sekolah s where s.id = d.sekolah_id)),
    '106.10 GAGAL: ada pendaftaran menunjuk sekolah yang sudah dihapus';
end;
$$;

do $$
declare
  v_regu int; v_nilai int; v_closing int;
begin
  -- 5. Rekap nilai utuh. 0154 hanya menyentuh `sekolah`, `pendaftaran.sekolah_id`
  --    dan `kejuaraan_manual.sekolah_id`; nilai menempel pada regu, dan tidak
  --    satu baris regu pun boleh hilang karena sekolahnya dilebur.
  select count(*) into v_regu    from regu;
  select count(*) into v_nilai   from nilai_mentah;
  select count(*) into v_closing from closing_regu;
  assert v_regu > 0, '106.11 GAGAL: tabel regu kosong sesudah 0154';

  assert not exists (
    select 1 from regu r
     where not exists (select 1 from pendaftaran d where d.id = r.pendaftaran_id)),
    '106.13 GAGAL: ada regu yang kehilangan pendaftarannya';

  raise notice '106: % regu, % nilai, % closing tetap utuh.', v_regu, v_nilai, v_closing;
end;
$$;

\echo '106 sekolah alamat XXXVII: LULUS'
