-- ============================================================================
-- hrcd-rekap : 0069_publish_dan_detail_panitia.sql
-- Tombol Publish gagal, dan rincian Live Score dibuka untuk semua panitia.
--
-- 1. "UPDATE requires a WHERE clause"
--
-- Itu yang muncul di layar waktu tombol Publish ditekan. Bukan galat kami:
-- Supabase memasang `safeupdate`, pengaman yang MENOLAK setiap UPDATE tanpa
-- WHERE. `status_acara` cuma punya satu baris, jadi 0068 menulis
--
--     update status_acara set fase_live = p_fase;
--
-- dan itu persis bentuk yang dilarang. Pengamannya benar — satu baris hari
-- ini bukan jaminan satu baris tahun depan, dan UPDATE tanpa WHERE yang
-- suatu hari mengenai sepuluh baris tidak akan mengeluh sedikit pun.
--
-- Diberi WHERE yang memang berarti: hanya menulis kalau nilainya berubah.
--
-- Tidak ketahuan tes 34 karena database uji tidak memasang `safeupdate`;
-- ia ekstensi Supabase, bukan bagian dari PostgreSQL. Yang menemukannya
-- pemilik repo, di layar, pada percobaan pertama.
--
-- 2. RINCIAN LIVE SCORE UNTUK SEMUA PANITIA
--
-- Diminta pemilik acara: setiap akun panitia boleh melihat rincian Live
-- Score — nilai per komponen, bukan cuma totalnya. Yang tetap dibatasi hanya
-- kemampuan MENERBITKAN ke peserta.
--
-- Tiga pintu harus ikut terbuka, karena rantai view Live Score
-- `security_invoker`:
--
--   v_rekap_penuh    saringannya boleh('rekap') -> ditambah live_score
--   sel_pendaftaran  di-JOIN untuk sampai ke nama sekolah
--   sel_nilai        sumber angka per komponennya
--
-- DAN INI MELONGGARKAN DUA HAL. Keduanya disebut di sini supaya tidak
-- ditemukan sebagai kejutan:
--
--   * Juri pos sekarang bisa membaca nilai mentah SELURUH pos, bukan cuma
--     posnya sendiri. Isolasi per pos (R6) tetap berlaku di tempat yang
--     menentukan — `v_lembar_pos` dan `simpan_nilai_massal`, yaitu layar
--     tempat nilai DIUBAH — tapi untuk MEMBACA ia tidak lagi memisahkan.
--     Itu keputusan pemilik acara, dan konsekuensinya: juri Pos 3 bisa
--     melihat angka Pos 1 sebelum diumumkan.
--   * `pendaftaran` memuat nomor WA dan nama kontak pembina. Membukanya ke
--     pemegang live_score berarti seluruh panitia bisa membacanya lewat API,
--     walau tidak ada satu layar pun yang menampilkannya.
--
-- Kalau salah satunya tidak dimaksudkan, yang dicabut cukup 'live_score' di
-- policy yang bersangkutan di bawah.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. atur_fase_live dengan WHERE.
-- ---------------------------------------------------------------------------
create or replace function atur_fase_live(p_fase text)
returns text
language plpgsql security definer
set search_path = public
as $$
declare v_lama text;
begin
  if not boleh('pengaturan') then
    raise exception 'tidak berhak: pengaturan';
  end if;
  if p_fase not in ('pra', 'progres', 'penuh') then
    raise exception 'fase tidak dikenal: % (pra / progres / penuh)', p_fase;
  end if;

  select fase_live into v_lama from status_acara;
  if v_lama = p_fase then
    return v_lama;
  end if;

  -- WHERE-nya bukan formalitas untuk menyenangkan safeupdate: ia juga yang
  -- membuat perintah ini tidak menulis apa pun kalau nilainya sudah sama.
  update status_acara set fase_live = p_fase
   where fase_live is distinct from p_fase;

  raise notice 'fase_live: % -> %', v_lama, p_fase;
  return p_fase;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Rincian untuk semua pemegang live_score.
-- ---------------------------------------------------------------------------
drop policy if exists sel_pendaftaran on pendaftaran;
create policy sel_pendaftaran on pendaftaran for select using (
  boleh_apa_saja('pendaftaran', 'pembayaran', 'daftar_ulang', 'cetak_kloter',
                 'rekap', 'live_score', 'pengaturan')
);

drop policy if exists sel_nilai on nilai_mentah;
create policy sel_nilai on nilai_mentah for select using (
  boleh_apa_saja('rekap', 'live_score')
  or (boleh('pos') and (
        pos_saya() is null
        or exists (select 1 from wahana w
                    where w.id = wahana_id and w.pos = pos_saya())))
);

-- v_rekap_penuh: badannya TIDAK diketik ulang. Hanya baris terakhirnya yang
-- berubah, jadi ia dibangun ulang dari definisi yang sedang terpasang.
do $blok$
declare v_def text;
begin
  select pg_get_viewdef('v_rekap_penuh'::regclass, true) into v_def;
  -- pg_get_viewdef mencetak argumennya LENGKAP DENGAN cast: `boleh('rekap')`
  -- keluar sebagai `boleh('rekap'::text)`. Mencocokkan bentuk yang ditulis
  -- tangan tidak akan pernah kena — percobaan pertama gagal persis di situ.
  if position('boleh(''rekap''::text)' in v_def) = 0 then
    raise exception '0069: v_rekap_penuh tidak lagi menyaring boleh(''rekap'') — periksa dulu, jangan ditimpa buta. Isinya: %',
      right(v_def, 200);
  end if;
  v_def := replace(v_def, 'boleh(''rekap''::text)',
                          'boleh_apa_saja(''rekap'', ''live_score'')');
  execute 'create or replace view v_rekap_penuh with (security_invoker = on) as ' || v_def;
  raise notice '0069: v_rekap_penuh dibuka untuk pemegang live_score.';
end $blok$;

do $blok$
declare v_f text; v_n int;
begin
  select fase_live into v_f from status_acara;
  select count(*) into v_n from nilai_mentah;
  raise notice '0069: fase_live %, % baris nilai mentah.', v_f, v_n;
end $blok$;
