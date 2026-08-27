-- ============================================================================
-- hrcd-rekap : kloter_dari_stok.sql
--
-- Menyetel jumlah kloter dari JUMLAH KAIN yang benar-benar dicetak, bukan dari
-- angka bulat yang dipilih waktu edisi dibuka.
--
--     kloter dibutuhkan = maks( kain Eksternal / kuota Eksternal per kloter,
--                               kain Intern    / kuota Intern per kloter )
--     kloter dipasang   = kloter dibutuhkan + CADANGAN
--
-- HRCD XXXVII: 250 kain Eksternal / 5 = 50 kloter, 100 kain Intern / 3 = 34
-- kloter, jadi 50 yang menentukan.
--
-- ---------------------------------------------------------------------------
-- KENAPA INI PENTING — DUA AKIBAT YANG BERLAWANAN
--
-- `kloter_maks` dipakai DUA hal yang menarik ke arah berbeda:
--
--   1. `daftar_ulang_batch` menolak menempatkan regu di kloter bernomor lebih
--      besar darinya. Kekecilan = batch terakhir daftar ulang gagal ditempatkan,
--      di meja, dengan antrean di depannya.
--   2. `perkiraan_berangkat_kloter()` membagi jendela 07:00-10:00 secara merata
--      ke SELURUH kloter sampai `kloter_maks`. Kebesaran = kloter terakhir yang
--      benar-benar ada diperkirakan berangkat jauh sebelum pukul sepuluh.
--
-- Produksi hari ini memakai 75, sisa keputusan 0105 waktu rencananya 300 regu
-- Eksternal. Dengan 250 kain, kloter 50 adalah yang terakhir benar-benar
-- terpakai, dan ia diperkirakan berangkat 08:59 — sejam sebelum jendelanya
-- habis, sementara jadwal Planning menyebar regu yang sama sampai 10:00. Dua
-- jawaban untuk satu pertanyaan (pasal 10.5), dan yang membacanya pembina.
--
-- ---------------------------------------------------------------------------
-- KENAPA TETAP ADA CADANGAN
--
-- Pelajaran 0105, dan ia mahal: tempat kosong di kloter yang TELANJUR
-- BERANGKAT tidak bisa dipakai lagi oleh pembagian otomatis. Kalau kapasitas
-- pas 250, satu tempat yang hangus membuat batch daftar ulang terakhir tidak
-- punya tempat sama sekali. Dua kloter cadangan = 10 tempat Eksternal, cukup
-- untuk kloter-kloter yang berangkat kurang penuh, dan cuma menggeser
-- perkiraan kloter terakhir beberapa menit.
--
-- Naikkan CADANGAN kalau banyak regu tidak hadir; turunkan ke 0 kalau yang
-- diutamakan perkiraan jam yang jatuh persis di pukul sepuluh.
--
-- ---------------------------------------------------------------------------
-- BUKAN MIGRASI, alasan yang sama dengan `stok_nomor_dada.sql`: ini konfigurasi
-- satu edisi, dan database uji memakai angka lain untuk menguji beban 300 regu.
-- Aman dijalankan dua kali. Jalankan SESUDAH stoknya benar.
-- ============================================================================

drop table if exists kloter_setelan;
create temporary table kloter_setelan (cadangan integer);
insert into kloter_setelan (cadangan) values (2);

do $blok$
declare
  v_kain_ext int; v_kain_int int;
  v_q_ext int; v_q_int int;
  v_butuh int; v_pasang int; v_cadangan int;
  v_lama int; v_baris int;
  r record;
begin
  select cadangan into v_cadangan from kloter_setelan;

  select
    (select count(*) from nomor_dada_stok s where s.nomor <  e.nomor_dada_intern_mulai),
    (select count(*) from nomor_dada_stok s where s.nomor >= e.nomor_dada_intern_mulai),
    e.maks_eksternal_per_kloter, e.maks_intern_per_kloter, e.kloter_maks
  into v_kain_ext, v_kain_int, v_q_ext, v_q_int, v_lama
  from edisi e where e.is_active;

  v_butuh := greatest(ceil(v_kain_ext::numeric / v_q_ext),
                      ceil(v_kain_int::numeric / v_q_int))::int;
  v_pasang := v_butuh + v_cadangan;

  raise notice 'kloter: kain % Eksternal / % per kloter = % kloter',
               v_kain_ext, v_q_ext, ceil(v_kain_ext::numeric / v_q_ext);
  raise notice 'kloter: kain % Intern    / % per kloter = % kloter',
               v_kain_int, v_q_int, ceil(v_kain_int::numeric / v_q_int);
  raise notice 'kloter: dibutuhkan %, cadangan %, dipasang % (sebelumnya %)',
               v_butuh, v_cadangan, v_pasang, v_lama;

  -- Kloter yang SUDAH BERISI regu tidak boleh jatuh di luar batas baru: regunya
  -- sudah dicetak di kertas dan sebagian mungkin sudah berangkat.
  -- Alias `g`, BUKAN `r`: `r` sudah dideklarasikan sebagai record di atas, dan
  -- PL/pgSQL memenangkan variabelnya atas alias tabel — `r.kloter_nomor` lalu
  -- berbunyi "record r is not assigned yet" pada baris yang terbaca benar.
  select coalesce(max(g.kloter_nomor), 0) into v_baris
  from regu g where not g.is_cancelled and g.kloter_nomor is not null;
  if v_baris > v_pasang then
    raise exception 'kloter: ada regu di kloter % yang akan jatuh di luar batas baru (%). '
                    'Naikkan CADANGAN atau kosongkan kloter itu dulu.', v_baris, v_pasang;
  end if;

  -- `kloter_dasar` tinggal peninggalan penyebaran lama (dibuang 0092) dan cuma
  -- dijaga check `kloter_dasar <= kloter_maks`. Disamakan supaya tidak ada
  -- angka kedua yang diam-diam berbeda pendapat.
  update edisi
     set kloter_maks = v_pasang, kloter_dasar = v_pasang
   where is_active;

  insert into kloter (nomor)
  select generate_series(1, v_pasang)::smallint
  on conflict (nomor) do nothing;

  -- Jam perkiraannya, dibaca dari fungsi yang sama dengan yang dipakai kertas
  -- kloter dan chip ~HH:MM di layar Keberangkatan.
  for r in
    select k as kloter, to_char(perkiraan_berangkat_kloter(k) at time zone 'Asia/Jakarta',
                                'HH24:MI') as jam
    from unnest(array[1, v_butuh / 2, v_butuh, v_pasang]) k
    order by k
  loop
    raise notice 'kloter: perkiraan K% -> %', r.kloter, r.jam;
  end loop;
end;
$blok$;

drop table if exists kloter_setelan;
