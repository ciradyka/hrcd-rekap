-- ============================================================================
-- hrcd-rekap : 0159_lebur_kembar_direktori.sql
-- Empat baris kembar yang dibawa impor 0157, dan satu kode pos yang salah.
--
-- SATU DI ANTARANYA REGRESI YANG SAYA BUAT SENDIRI
--
-- `MAN 1 Ciamis` DILEBUR ke `MAN Darussalam` oleh 0154 — NPSN keduanya sama,
-- 20276451. Lalu 0157 memasukkannya kembali, karena Data Referensi memang
-- menamainya `MAN 1 Ciamis` dan `kunci_sekolah('MAN 1 Ciamis')` tidak sama
-- dengan `kunci_sekolah('MAN Darussalam')`. Impor itu menghidupkan lagi baris
-- yang baru saja dihapus, tanpa satu galat pun.
--
-- Pelajarannya bukan "hati-hati": penyaringan impor memakai NAMA, sedangkan
-- yang membuktikan dua baris satu sekolah adalah NPSN — dan `sekolah` tidak
-- menyimpan NPSN. Selama itu belum berubah, impor berikutnya akan mengulangi
-- kesalahan yang sama, dan yang menahannya cuma pemeriksaan sesudahnya.
--
-- APA YANG MENEMUKANNYA
--
-- Bukan `sekolah_kembar.sql` — kelima aturannya membandingkan NAMA, dan
-- `MAN Darussalam` lawan `MAN 1 Ciamis` tidak punya satu huruf pun yang sama.
-- Yang menemukannya pertanyaan lain: "adakah dua baris beralamat jalan DAN
-- desa yang sama persis?" Keempat pasangan di bawah muncul dari situ, dan
-- keempatnya terbukti lewat NPSN. Aturan itu sekarang ditambahkan ke
-- pemeriksa sebagai aturan keenam.
--
-- KEEMPAT PASANGAN, DAN YANG MANA YANG BERTAHAN
--
--   MAN 1 Ciamis                                  -> MAN Darussalam
--     NPSN 20276451. Nama resminya memang MAN 1 Ciamis, tetapi runbook
--     bagian 5 menahan nama yang diucapkan orang, dan tidak ada yang
--     menyebutnya MAN 1 Ciamis.
--
--   SMAN 1 Banjaranyar                            -> SMAN 2 Banjarsari
--     NPSN 20255008. Banjaranyar mekar dari Banjarsari tahun 2015 dan
--     sekolahnya ikut berganti nama. Yang bertahan nama LAMA, karena itu yang
--     ditulis empat peserta di edisi XXXIV dan XXXVI dan tidak ada satu pun
--     yang menulis nama barunya — alasan yang sama dengan MAN Darussalam.
--     Nama resminya dicatat di sekolah_alamat.json.
--
--   SMP Islam Terpadu Muhammad Danu Fathahillah   -> SMP IT MD Fathahillah
--     NPSN 70003434. "MD" memang singkatan Muhammad Danu; yang dipakai
--     bentuk pendek karena itu yang tertulis di formulir pendaftarannya.
--
--   MA Al Islah                                   -> MA Al-Ishlah
--     NPSN 20276441. Ejaan kurasi yang bertahan; `Al-` bagian nama diri dan
--     ditulis dengan tanda hubung (runbook bagian 4).
--
-- KODE POS SMAN 2 BANJARSARI: 46383 -> 46384
--
-- Desanya Cigayam, Kec. Banjaranyar, dan SELURUH sepuluh desa Kec.
-- Banjaranyar memakai 46384. Angka 46383 milik Kec. Banjarsari, kecamatan
-- asalnya sebelum mekar tahun 2015 — cermin Dapodik masih memakai kode lama
-- dan itu yang tersalin ke kurasi. `SMPN 6 Banjarsari` (Desa Cikupa,
-- kecamatan yang sama) sudah memakai 46384 sejak awal, dan ketidaksepakatan
-- antara kedua baris itulah yang membuat kesalahannya terlihat.
--
-- REKAP NILAI TIDAK DISENTUH. Keempat baris yang dibuang tidak memegang satu
-- pendaftaran pun — semuanya lahir dari impor 0157 dan belum pernah dipilih
-- siapa pun — tetapi pengalihan tetap dijalankan sebelum penghapusan, persis
-- seperti 0154, supaya benar walau anggapan itu meleset. Blok penutup
-- membandingkan jumlah barisnya.
--
-- BISA DIJALANKAN DUA KALI.
-- ============================================================================

drop table if exists potret_0159;
create temporary table potret_0159 as
select (select count(*) from regu)         as regu,
       (select count(*) from nilai_mentah) as nilai_mentah,
       (select count(*) from closing_regu) as closing_regu,
       (select count(*) from pendaftaran)  as pendaftaran;

drop table if exists lebur_0159;
create temporary table lebur_0159 (buang text, simpan text, npsn text);
insert into lebur_0159 (buang, simpan, npsn) values
  ('MAN 1 Ciamis', 'MAN Darussalam', '20276451'),
  ('SMAN 1 Banjaranyar', 'SMAN 2 Banjarsari', '20255008'),
  ('SMP Islam Terpadu Muhammad Danu Fathahillah', 'SMP IT MD Fathahillah', '70003434'),
  ('MA Al Islah', 'MA Al-Ishlah', '20276441');

do $$
declare r record; v_p int; v_k int; v_total int := 0;
begin
  for r in select * from lebur_0159 order by buang loop
    if not exists (select 1 from sekolah where kunci_sekolah(name) = kunci_sekolah(r.buang)) then
      raise notice '0159: (dilewati) "%" memang tidak ada.', r.buang;
      continue;
    end if;
    if not exists (select 1 from sekolah where kunci_sekolah(name) = kunci_sekolah(r.simpan)) then
      raise exception '0159: "%" ada tetapi "%" tidak — pasangan peleburan salah',
                      r.buang, r.simpan;
    end if;

    update pendaftaran d
       set sekolah_id = (select id from sekolah where kunci_sekolah(name) = kunci_sekolah(r.simpan))
     where d.sekolah_id = (select id from sekolah where kunci_sekolah(name) = kunci_sekolah(r.buang));
    get diagnostics v_p = row_count;

    update kejuaraan_manual m
       set sekolah_id = (select id from sekolah where kunci_sekolah(name) = kunci_sekolah(r.simpan))
     where m.sekolah_id = (select id from sekolah where kunci_sekolah(name) = kunci_sekolah(r.buang));
    get diagnostics v_k = row_count;

    delete from sekolah where kunci_sekolah(name) = kunci_sekolah(r.buang);
    v_total := v_total + 1;
    raise notice '0159: "%" -> "%" (NPSN %, % pendaftaran, % penghargaan dialihkan)',
                 r.buang, r.simpan, r.npsn, v_p, v_k;
  end loop;
  raise notice '0159: % baris kembar dilebur.', v_total;
end $$;

do $$
declare v_n int;
begin
  update sekolah
     set address = replace(address, 'Jawa Barat 46383,', 'Jawa Barat 46384,')
   where name = 'SMAN 2 Banjarsari'
     and address like '%Kec. Banjaranyar%'
     and address like '%46383%';
  get diagnostics v_n = row_count;
  raise notice '0159: % kode pos SMAN 2 Banjarsari dibetulkan jadi 46384.', v_n;

  assert not exists (
    select 1 from sekolah
     where address like '%Kec. Banjaranyar%' and address like '%46383%'),
    '0159: masih ada alamat Kec. Banjaranyar berkode pos 46383';
end $$;

do $$
declare
  s potret_0159%rowtype;
  n_regu int; n_nilai int; n_closing int; n_daftar int; v_sekolah int;
begin
  select * into s from potret_0159;
  select count(*) into n_regu    from regu;
  select count(*) into n_nilai   from nilai_mentah;
  select count(*) into n_closing from closing_regu;
  select count(*) into n_daftar  from pendaftaran;
  select count(*) into v_sekolah from sekolah;

  assert (n_regu, n_nilai, n_closing, n_daftar)
         = (s.regu, s.nilai_mentah, s.closing_regu, s.pendaftaran),
    format('0159: DATA NILAI BERGESER — regu %s->%s, nilai %s->%s, closing %s->%s, pendaftaran %s->%s',
           s.regu, n_regu, s.nilai_mentah, n_nilai, s.closing_regu, n_closing,
           s.pendaftaran, n_daftar);
  assert not exists (select 1 from pendaftaran where sekolah_id is null),
    '0159: ada pendaftaran yang kehilangan sekolahnya';

  raise notice '0159: % baris sekolah, rekap nilai utuh — % regu, % nilai, % closing.',
               v_sekolah, n_regu, n_nilai, n_closing;
end $$;

drop table if exists potret_0159;
drop table if exists lebur_0159;
