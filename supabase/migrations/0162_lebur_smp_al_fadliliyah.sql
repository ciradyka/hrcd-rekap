-- ============================================================================
-- hrcd-rekap : 0162_lebur_smp_al_fadliliyah.sql
-- `SMP Al-Fadliliyah Darussalam` dilebur ke `MTs Al-Fadliliyah Darussalam`.
--
-- PERTANYAAN YANG 0160 BIARKAN TERBUKA, SEKARANG DIJAWAB
--
-- 0160 menemukan satu baris yang alamatnya bukan alamat — "Jl KH Ahmad Fadhil",
-- tanpa desa, tanpa kecamatan, tanpa kabupaten, tanda khas alamat yang DIKETIK
-- di form pendaftaran. Ia mengisi alamatnya tetapi sengaja TIDAK meleburnya,
-- karena tidak ada di data yang bisa memutuskan: Data Referensi tidak memuat
-- SMP dengan nama itu, dan `MTs Al-Fadliliyah Darussalam` (NPSN 20211978)
-- beralamat sama dan setingkat sama (Penggalang). Bisa jadi SMP yang memang ada
-- tetapi belum terdaftar, bisa jadi salah ketik untuk MTs-nya.
--
-- **Pemilik acara menjawab 30 Agustus 2026: yang dimaksud MTs-nya.** Jadi
-- keduanya satu sekolah, dan yang bertahan baris MTs — ia yang punya NPSN,
-- alamat kurasi, dan nama yang benar-benar dipakai orang.
--
-- KENAPA JAWABANNYA HARUS DATANG DARI ORANG, BUKAN DARI MIGRASI
--
-- Ini bukan formalitas. Peleburan memindahkan `pendaftaran.sekolah_id`, dan
-- kalau tebakannya salah, regu sungguhan berpindah ke sekolah yang salah —
-- kesalahan yang tidak melempar galat, tidak terlihat di layar mana pun, dan
-- baru ketahuan waktu piagam dicetak dengan nama sekolah yang keliru. Yang
-- membedakan dua nama mirip adalah NPSN, dan di sini NPSN-nya justru tidak ada
-- karena satuan itu memang tidak terdaftar. Data habis di titik itu; yang
-- tersisa cuma orang yang tahu (CLAUDE.md 12.3).
--
-- REKAP NILAI TIDAK DISENTUH. Pendaftaran dialihkan lebih dulu, baru barisnya
-- dihapus; `regu` menempel pada `pendaftaran`, bukan pada `sekolah`, jadi tidak
-- satu regu pun berpindah maupun hilang. Berbeda dengan 0159 dan 0161 yang
-- meleburkan baris impor yang belum pernah dipilih siapa pun, baris ini LAHIR
-- dari sebuah pendaftaran — jadi jumlah yang dialihkan di sini kemungkinan
-- besar bukan nol, dan `raise notice` menyebutkannya. Blok penutup
-- membandingkan seluruh jumlah barisnya.
--
-- BISA DIJALANKAN DUA KALI: seluruhnya menyaring `where name = <nama lama>`.
-- ============================================================================

drop table if exists potret_0162;
create temporary table potret_0162 as
select (select count(*) from regu)         as regu,
       (select count(*) from nilai_mentah) as nilai_mentah,
       (select count(*) from closing_regu) as closing_regu,
       (select count(*) from pendaftaran)  as pendaftaran;

do $$
declare
  v_buang  constant text := 'SMP Al-Fadliliyah Darussalam';
  v_simpan constant text := 'MTs Al-Fadliliyah Darussalam';
  v_id_buang uuid; v_id_simpan uuid; v_p int; v_k int;
begin
  select id into v_id_buang  from sekolah where name = v_buang;
  select id into v_id_simpan from sekolah where name = v_simpan;

  if v_id_buang is null then
    raise notice '0162: (dilewati) "%" memang tidak ada.', v_buang;
    return;
  end if;
  if v_id_simpan is null then
    raise exception '0162: "%" ada tetapi "%" tidak — peleburan dibatalkan',
                    v_buang, v_simpan;
  end if;

  update pendaftaran set sekolah_id = v_id_simpan where sekolah_id = v_id_buang;
  get diagnostics v_p = row_count;

  update kejuaraan_manual set sekolah_id = v_id_simpan where sekolah_id = v_id_buang;
  get diagnostics v_k = row_count;

  delete from sekolah where id = v_id_buang;

  raise notice '0162: "%" -> "%" (NPSN 20211978, % pendaftaran, % penghargaan dialihkan)',
               v_buang, v_simpan, v_p, v_k;
end $$;

do $$
declare
  s potret_0162%rowtype;
  n_regu int; n_nilai int; n_closing int; n_daftar int;
  v_sekolah int; v_kembar int;
begin
  select * into s from potret_0162;
  select count(*) into n_regu    from regu;
  select count(*) into n_nilai   from nilai_mentah;
  select count(*) into n_closing from closing_regu;
  select count(*) into n_daftar  from pendaftaran;
  select count(*) into v_sekolah from sekolah;

  assert (n_regu, n_nilai, n_closing, n_daftar)
         = (s.regu, s.nilai_mentah, s.closing_regu, s.pendaftaran),
    format('0162: DATA NILAI BERGESER — regu %s->%s, nilai %s->%s, closing %s->%s, pendaftaran %s->%s',
           s.regu, n_regu, s.nilai_mentah, n_nilai, s.closing_regu, n_closing,
           s.pendaftaran, n_daftar);

  assert not exists (select 1 from pendaftaran where sekolah_id is null),
    '0162: ada pendaftaran yang kehilangan sekolahnya';
  assert not exists (
    select 1 from pendaftaran d
     where not exists (select 1 from sekolah t where t.id = d.sekolah_id)),
    '0162: ada pendaftaran menunjuk sekolah yang sudah dihapus';

  select count(*) into v_kembar from (
    select kunci_sekolah(name) from sekolah group by 1 having count(*) > 1) x;
  assert v_kembar = 0, format('0162: %s kunci sekolah kembar', v_kembar);

  raise notice '0162: % baris sekolah, rekap nilai utuh — % regu, % nilai, % closing.',
               v_sekolah, n_regu, n_nilai, n_closing;
end $$;

drop table if exists potret_0162;
