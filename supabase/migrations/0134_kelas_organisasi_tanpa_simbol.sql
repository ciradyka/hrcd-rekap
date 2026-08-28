-- ============================================================================
-- hrcd-rekap : 0134_kelas_organisasi_tanpa_simbol.sql
--
-- `regu.kelas_organisasi` hanya boleh berisi HURUF, ANGKA, dan SPASI.
--
-- ---------------------------------------------------------------------------
-- BENTUK YANG DIPAKAI SEKOLAH
--
--     XI IPA 4      XII IPS 4      PALAGGA      OSIS
--
-- Keputusan pemilik acara, dan alasannya kelihatan begitu daftarnya berjajar:
-- satu orang menulis "XI-1", yang lain "XI/1", yang lain "XI.1" untuk kelas
-- yang SAMA, dan ketiganya tidak pernah bertemu waktu panitia mencari atau
-- mengurutkannya. Spasi jadi satu-satunya pemisah, jadi cuma ada satu cara
-- menulis tiap kelas.
--
-- ---------------------------------------------------------------------------
-- KENAPA MIGRASI SENDIRI, BUKAN DIEDIT KE 0133
--
-- 0133 sudah diterapkan ke produksi pagi ini. Migrasi yang sudah diterapkan
-- tidak pernah diedit (final-architecture.md bagian 2) — yang membaca riwayat
-- nanti harus bisa mempercayai bahwa berkas 0133 memang itu yang berjalan.
--
-- ---------------------------------------------------------------------------
-- AMAN DITERAPKAN SEKARANG
--
-- Kolomnya lahir NULL untuk seluruh baris yang ada dan belum satu pun terisi:
-- form yang mengisinya belum terbit. Jadi constraint ini tidak bisa menolak
-- data yang sudah ada. Pagar di bawah membuktikannya, bukan mengandaikannya —
-- ia menghitung baris yang akan melanggar SEBELUM constraint dipasang, dan
-- menyebutkan isinya satu per satu kalau ada.
--
-- Spasi beruntun tidak ditolak melainkan DIRAPATKAN di form sebelum dikirim:
-- "XI  IPA  4" itu ketikan yang benar dengan jari yang tergelincir, bukan
-- jawaban yang salah. Yang di sini cuma menolak simbolnya.
-- ============================================================================

do $blok$
declare v_sisa text;
begin
  select string_agg(format('%s (regu %s)', kelas_organisasi, nama_regu), ', ')
    into v_sisa
  from regu
  where kelas_organisasi is not null
    and kelas_organisasi !~ '^[A-Za-z0-9 ]+$';

  if v_sisa is not null then
    raise exception '0134: kelas/organisasi berikut memuat simbol dan harus dibetulkan dulu: %', v_sisa;
  end if;
  raise notice '0134: tidak ada kelas/organisasi bersimbol di data yang ada.';
end;
$blok$;

alter table regu drop constraint if exists regu_kelas_organisasi_panjang;
alter table regu drop constraint if exists regu_kelas_organisasi_bentuk;
alter table regu add constraint regu_kelas_organisasi_bentuk
  check (kelas_organisasi is null
         or (kelas_organisasi ~ '^[A-Za-z0-9 ]+$'
             and length(kelas_organisasi) <= 80));

comment on constraint regu_kelas_organisasi_bentuk on regu is
  'Huruf, angka, dan spasi saja, maksimal 80 karakter — XI IPA 4, XII IPS 4, '
  'PALAGGA, OSIS. Tanpa simbol: "XI-1", "XI/1" dan "XI.1" adalah kelas yang '
  'sama ditulis tiga cara, dan ketiganya tidak pernah bertemu waktu dicari '
  'atau diurutkan. Menggantikan regu_kelas_organisasi_panjang dari 0133, yang '
  'hanya menjaga panjangnya.';

-- ---------------------------------------------------------------------------
-- Pagar: yang bersimbol DITOLAK, yang berbentuk benar DITERIMA, dan kiriman
-- tanpa kelas/organisasi sama sekali tetap lewat. Ketiganya lewat RPC-nya
-- sendiri, bukan lewat INSERT langsung — yang dipakai pembina RPC itu.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_k1 uuid := gen_random_uuid();
  v_k2 uuid := gen_random_uuid();
  v_kode text;
  v_isi  text;
  v_ditolak boolean := false;
begin
  -- 1. Bentuk yang benar diterima, spasinya utuh.
  select (submit_pendaftaran(
    'SMA Negeri 1 Ciamis', '', false, '081200000134',
    jsonb_build_array(jsonb_build_object(
      'nama_regu', 'UJI BENTUK 0134', 'nama_ketua', 'Uji Ketua',
      'golongan', 'intern_pa', 'kelas_organisasi', 'XI IPA 4')),
    0::smallint, v_k1, null, 'tunai', null) ->> 'kode_pembayaran')
  into v_kode;

  select r.kelas_organisasi into v_isi
  from regu r join pendaftaran d on d.id = r.pendaftaran_id
  where d.kode_pembayaran = v_kode;

  if v_isi is distinct from 'XI IPA 4' then
    raise exception '0134: "XI IPA 4" tersimpan sebagai %', coalesce(v_isi, '<NULL>');
  end if;

  -- 2. Yang bersimbol ditolak.
  begin
    perform submit_pendaftaran(
      'SMA Negeri 1 Ciamis', '', false, '081200000134',
      jsonb_build_array(jsonb_build_object(
        'nama_regu', 'UJI SIMBOL 0134', 'nama_ketua', 'Uji Ketua',
        'golongan', 'intern_pi', 'kelas_organisasi', 'XI-1')),
      0::smallint, v_k2, null, 'tunai', null);
  exception when check_violation then
    v_ditolak := true;
  end;

  if not v_ditolak then
    raise exception '0134: "XI-1" diterima, padahal bersimbol';
  end if;

  -- Bersihkan. Migrasi ini berjalan di produksi saat acara berlangsung;
  -- meninggalkan regu karangan di sana berarti baris palsu di Meja Pembayaran
  -- dan nama yang menyandera regu_nama_unik selamanya.
  delete from regu where pendaftaran_id in (
    select id from pendaftaran where kunci_kirim in (v_k1, v_k2));
  delete from pendaftaran where kunci_kirim in (v_k1, v_k2);

  raise notice '0134: huruf+angka+spasi diterima, yang bersimbol ditolak.';
end;
$blok$;
