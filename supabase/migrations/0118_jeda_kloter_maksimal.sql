-- ============================================================================
-- hrcd-rekap : 0118_jeda_kloter_maksimal.sql
-- Jendela keberangkatan jadi BATAS ATAS, bukan perintah menyebar.
--
-- APA YANG SALAH
--
-- `perkiraan_berangkat_kloter()` (0105) membagi jendela 07:00-10:00 rata ke
-- seluruh kloter edisi. Itu benar ketika kloternya banyak, dan konyol ketika
-- sedikit:
--
--     2 kloter, jendela 07:00-10:00  ->  K1 07:00, K2 10:00
--
-- seolah kloter kedua menunggu tiga jam di lapangan. Dilaporkan dari layar
-- Cetak Kloter dengan dua kloter yang benar-benar ada.
--
-- Di lapangan kloter berangkat BERUNTUN: satu kloter dilepas, kloter
-- berikutnya maju dari Staging 1 (alur 10.3), dan jaraknya tidak pernah lebih
-- dari beberapa menit. Pemilik acara menetapkan jeda maksimal 5 menit.
--
-- ATURANNYA
--
--     perkiraan K-n = jam_mulai + yang lebih kecil antara
--                       (jam_batas - jam_mulai) x (n-1)/(kloter_maks-1)  <- rata
--                       interval_berangkat_menit x (n-1)                 <- batas
--
-- Kloter terakhir karena itu boleh berangkat jauh sebelum ujung jendela —
-- memang begitu kalau regunya sedikit. Yang dijamin jendela bukan lagi "yang
-- terakhir berangkat pukul sepuluh" melainkan "tidak ada yang berangkat
-- SESUDAH pukul sepuluh", dan itu yang sebenarnya diminta pasal 10.1.
--
-- KENAPA KOLOM LAMA, BUKAN KOLOM BARU
--
-- `edisi.interval_berangkat_menit` sudah ada sejak 0001 dengan arti yang
-- nyaris sama — jarak antar keberangkatan — dan dipakai rumus perkiraan lama
-- (0053, 0056) sebagai jarak TETAP. Sejak 0105 tidak ada satu pun fungsi atau
-- view yang membacanya: kolom mati, bernama tepat. Menghidupkannya kembali
-- sebagai BATAS ATAS lebih baik daripada menambah kolom kedua yang artinya
-- bertumpang tindih — dua angka untuk satu pertanyaan adalah cara mereka
-- mulai berbeda pendapat.
--
-- Nilainya dinaikkan 4 -> 5 menit sesuai keputusan pemilik acara.
--
-- SATU ATURAN, TIGA TEMPAT
--
-- Batas yang sama dipakai `jadwalPlanning()` (kertas kloter) dan
-- `hitungRekomendasiKloter()` (Kalkulator Keberangkatan) di
-- web/js/departure-calculator.mjs, keduanya membaca kolom ini lewat
-- `infoPengaturanKloter()`. Kalau angkanya diubah, ubah di sini — ketiganya
-- ikut.
-- ============================================================================

comment on column edisi.interval_berangkat_menit is
  'Jeda MAKSIMAL antar kloter, menit. Perkiraan berangkat memakai yang lebih kecil antara pembagian rata jendela dan angka ini (migrasi 0118).';

update edisi set interval_berangkat_menit = 5
 where is_active and interval_berangkat_menit <> 5;

create or replace function perkiraan_berangkat_kloter(p_kloter integer)
returns timestamptz
language sql stable
set search_path = public
as $$
  with cfg as (
    select e.*,
      greatest(e.kloter_maks, 1)::int as jumlah_kloter
    from edisi e
    where e.is_active
  )
  select ((tanggal_lomba + jam_mulai_berangkat) at time zone 'Asia/Jakarta')
    -- Yang dibandingkan JARAK DARI KLOTER PERTAMA, bukan jeda per langkah.
    -- Bentuk "bagi dulu lalu kalikan" menumpuk pembulatan mikrodetik: 180
    -- menit dibagi 74 lalu dikalikan 74 lagi menghasilkan 4 mikrodetik LEBIH
    -- dari tiga jam, dan kloter terakhir jatuh sesudah jendelanya habis.
    -- Bentuk di bawah mempertahankan aritmetika 0105 apa adanya selama
    -- batasnya tidak menggigit, jadi jam yang sudah diuji tidak bergeser
    -- satu detik pun.
    + least(
        case when jumlah_kloter = 1 then interval '0'
             else (jam_batas_berangkat - jam_mulai_berangkat)
                    * ((p_kloter - 1)::double precision / (jumlah_kloter - 1))
        end,
        make_interval(mins => interval_berangkat_menit) * (p_kloter - 1)
      )
  from cfg
$$;

comment on function perkiraan_berangkat_kloter(integer) is
  'Perkiraan FIFO: jam mulai + jeda x (nomor - 1), dengan jeda = yang lebih kecil antara pembagian rata jendela dan edisi.interval_berangkat_menit.';

do $blok$
declare v_jeda int; v_kloter int; v_akhir text; v_batas text;
begin
  select interval_berangkat_menit, kloter_maks,
         to_char(jam_batas_berangkat, 'HH24:MI')
    into v_jeda, v_kloter, v_batas
  from edisi where is_active;

  select to_char(perkiraan_berangkat_kloter(v_kloter) at time zone 'Asia/Jakarta',
                 'HH24:MI')
    into v_akhir;

  raise notice '0118: jeda maksimal % menit, % kloter, K% -> % (jendela habis %).',
               v_jeda, v_kloter, v_kloter, v_akhir, v_batas;

  assert perkiraan_berangkat_kloter(1)
       = ((select tanggal_lomba + jam_mulai_berangkat from edisi where is_active)
          at time zone 'Asia/Jakarta'),
    '0118: K1 tidak lagi berangkat tepat di awal jendela';
  assert perkiraan_berangkat_kloter(v_kloter)
       <= ((select tanggal_lomba + jam_batas_berangkat from edisi where is_active)
           at time zone 'Asia/Jakarta'),
    '0118: kloter terakhir diperkirakan berangkat SESUDAH jendela habis';
end;
$blok$;
