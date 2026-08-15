-- ============================================================================
-- hrcd-rekap : 0052_nama_tanpa_angka.sql
--
-- Nama orang dan nama regu tidak boleh memuat angka.
--
-- ---------------------------------------------------------------------------
-- KENAPA
--
-- Angka di kolom nama selalu berarti salah satu dari dua hal, dan keduanya
-- merusak:
--
--   1. Kolomnya tertukar. Nomor WhatsApp diketik di kotak Nama, atau nomor
--      dada diketik di kotak Nama Ketua. Pembina mengisi form ini sekali,
--      dari HP, sambil mengurus hal lain — dan kotak yang bersebelahan memang
--      tertukar.
--   2. Nama regu dipakai sebagai penomoran: "REGU 1", "REGU 2". Nomor regu
--      SUDAH ada dan namanya nomor dada; nama yang juga berisi angka membuat
--      dua penomoran bersaing di lembar yang sama, dan panitia harus menebak
--      mana yang dimaksud saat memanggil.
--
-- Keduanya baru ketahuan di meja daftar ulang, saat pembinanya sudah pulang.
--
-- ---------------------------------------------------------------------------
-- YANG DILARANG HANYA DIGIT
--
-- Bukan "hanya huruf". Nama sungguhan memuat spasi, titik, apostrof, dan
-- tanda hubung — "Nur Aisyah binti H. Abdul", "Ma'ruf", "Siti Nur-Aini".
-- Menolak semuanya demi menolak angka akan menolak lebih banyak nama asli
-- daripada kesalahan yang dicegahnya.
--
-- Jadi syaratnya sesempit mungkin: tidak boleh ada satu pun 0-9. Itu menutup
-- kedua kekeliruan di atas dan tidak menyentuh apa pun yang lain.
--
-- ---------------------------------------------------------------------------
-- KENAPA DI DATABASE, BUKAN CUKUP DI FORM
--
-- Form pendaftaran juga menolaknya sambil diketik — itu yang membuatnya
-- terasa wajar. Tapi form bisa dilewati: RPC-nya terbuka, dan panitia sendiri
-- bisa menulis nama lewat layar meja. Yang menegakkan aturan harus yang
-- paling akhir menyentuh datanya.
-- ============================================================================

do $$
declare v_regu text; v_ketua text; v_kontak text;
begin
  select string_agg(nama_regu, ', ') into v_regu
  from regu where not is_cancelled and nama_regu ~ '[0-9]';
  select string_agg(nama_ketua, ', ') into v_ketua
  from regu where not is_cancelled and nama_ketua ~ '[0-9]';
  select string_agg(nama_kontak, ', ') into v_kontak
  from pendaftaran where nama_kontak ~ '[0-9]';

  if coalesce(v_regu, v_ketua, v_kontak) is not null then
    raise exception '0052: masih ada nama berangka — perbaiki dulu. regu: % | ketua: % | kontak: %',
      coalesce(v_regu, '-'), coalesce(v_ketua, '-'), coalesce(v_kontak, '-');
  end if;
  raise notice '0052: data yang ada lolos — tidak ada nama berangka.';
end;
$$;

alter table regu drop constraint if exists regu_nama_regu_tanpa_angka;
alter table regu add constraint regu_nama_regu_tanpa_angka
  check (nama_regu !~ '[0-9]');

alter table regu drop constraint if exists regu_nama_ketua_tanpa_angka;
alter table regu add constraint regu_nama_ketua_tanpa_angka
  check (nama_ketua !~ '[0-9]');

-- nama_kontak boleh NULL (ditambahkan 0013 pada data yang sudah ada), dan
-- `null !~ ...` bernilai NULL yang diterima check constraint — jadi baris lama
-- tanpa nama kontak tidak ikut ditolak, sesuai maksudnya.
alter table pendaftaran drop constraint if exists pendaftaran_nama_kontak_tanpa_angka;
alter table pendaftaran add constraint pendaftaran_nama_kontak_tanpa_angka
  check (nama_kontak !~ '[0-9]');

comment on constraint regu_nama_regu_tanpa_angka on regu is
  'Angka di kolom nama selalu berarti kolom tertukar atau regu dinomori '
  'sendiri — dua penomoran yang bersaing dengan nomor dada.';
