-- ============================================================================
-- 0164 : daftar juara peserta ikut membawa angkanya.
--
-- 0163 menerbitkan daftar juara TANPA satu kolom skor pun, dan itu memang yang
-- diminta saat itu. Pemilik acara memutuskan sebaliknya sehari kemudian:
-- halaman peserta menampilkan angka yang sama dengan layar panitia
-- #/kejuaraan — total skor tiap regu juara, poin juara dan total skor enam
-- besar untuk Juara Umum, jumlah regu bernomor dada untuk Peserta Terbanyak.
--
-- KENAPA INI TIDAK MELONGGARKAN APA PUN
--
-- Yang menjaga angka lomba tetap tertutup BUKAN ketiadaan kolomnya, melainkan
-- pagar fase: view ini mengembalikan NOL BARIS di luar fase 'juara', dan fase
-- itu baru dinyalakan sesudah juaranya diumumkan. Sebelum diumumkan, tidak ada
-- satu baris pun untuk dibaca siapa pun — dengan atau tanpa kolom skor.
--
-- Yang berubah karena itu cuma satu: sesudah pengumuman, angka yang memang
-- sudah dibacakan di lapangan ikut terbaca di halaman peserta. Sampai
-- pengumuman, keadaannya sama persis dengan sebelum migrasi ini.
--
-- Pagar di publish-live.yml IKUT DISEMPITKAN, bukan dibuang: yang dulu menolak
-- APA PUN yang bertipe angka sekarang menolak KOLOM YANG TIDAK DIKENAL. Kolom
-- baru yang muncul di view ini — nomor WA pembina, misalnya, yang duduk satu
-- tabel dengan pendaftaran — tetap menghentikan penerbitan. Melepas pagarnya
-- sama sekali akan menukar satu pemeriksaan sempit dengan tidak ada
-- pemeriksaan (CLAUDE.md 13.3).
--
-- `sumber` tetap tidak ikut: ia menyebut CARA gelar ditentukan ('manual',
-- 'skor', 'nomor_dada') — keterangan untuk panitia yang memilihnya, bukan
-- untuk yang membaca hasilnya.
-- ============================================================================

drop view v_kejuaraan_publik;

create view v_kejuaraan_publik as
select urutan, kode, nama_penghargaan, nomor_dada, nama_regu, nama_sekolah,
       golongan, total, poin_juara, jumlah_skor
from hasil_kejuaraan_semua()
where (select fase_live from status_acara) = 'juara'
order by urutan;

grant select on v_kejuaraan_publik to anon, authenticated;

comment on view v_kejuaraan_publik is
  'Daftar juara untuk halaman peserta, beserta angkanya. Nol baris di luar fase juara — pagar itu yang menjaga hasil sebelum diumumkan, bukan ketiadaan kolom skor.';

-- ---------------------------------------------------------------------------
-- Penjaga
-- ---------------------------------------------------------------------------

do $blok$
declare v_lama text; v_kolom text[]; v_n integer; v_skor integer;
begin
  select array_agg(attname::text order by attnum) into v_kolom
    from pg_attribute
   where attrelid = 'v_kejuaraan_publik'::regclass and attnum > 0
     and not attisdropped;
  assert v_kolom @> array['total', 'poin_juara', 'jumlah_skor'],
    format('0164: kolom skor belum ada di view publik: %s', v_kolom);
  assert not (v_kolom && array['sumber', 'regu_id']),
    format('0164: kolom yang tidak perlu ikut terbawa: %s', v_kolom);

  -- Pagar fasenya diuji dengan MENGUBAH fasenya, bukan dengan membaca
  -- definisinya (CLAUDE.md 13.8). Ini pemeriksaan yang paling penting di
  -- berkas ini: sesudah kolom skornya kembali, hanya pagar inilah yang
  -- menahan hasil lomba sebelum diumumkan.
  select fase_live into v_lama from status_acara;

  update status_acara set fase_live = 'penuh' where fase_live is not null;
  assert not exists (select 1 from v_kejuaraan_publik),
    '0164: daftar juara terbaca padahal fase masih penuh';

  update status_acara set fase_live = 'juara' where fase_live is not null;
  select count(*) into v_n from v_kejuaraan_publik;
  select count(*) into v_skor from v_kejuaraan_publik where total is not null;

  update status_acara set fase_live = v_lama where fase_live is not null;
  raise notice '0164: % baris penghargaan, % di antaranya berangka; fase dikembalikan ke %.',
               v_n, v_skor, v_lama;
end;
$blok$;
