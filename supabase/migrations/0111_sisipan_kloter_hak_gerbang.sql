-- ============================================================================
-- hrcd-rekap : 0111_sisipan_kloter_hak_gerbang.sql
-- Daftar sisipan mengikuti hak KEBERANGKATAN, bukan centang Live Score.
--
-- ---------------------------------------------------------------------------
-- APA YANG SALAH
--
-- `v_sisipan_kloter` lahir di 0009 sebagai `security_invoker = on` tanpa pagar
-- hak sendiri, jadi yang menentukan siapa mendapat baris adalah policy tabel
-- yang ia JOIN — dan yang paling sempit di antaranya `sel_pendaftaran`:
--
--   boleh_apa_saja('pendaftaran', 'pembayaran', 'daftar_ulang', 'cetak_kloter',
--                  'rekap', 'live_score', 'pengaturan')          -- 0069
--
-- `keberangkatan` TIDAK ada di daftar itu. Paket peran `gerbang` berisi
-- `keberangkatan, kedatangan, live_score` (0075), jadi satu-satunya hak yang
-- membuka daftar sisipan untuk petugas gerbang adalah `live_score` — hak papan
-- skor, yang tidak ada hubungannya dengan pekerjaannya.
--
-- ---------------------------------------------------------------------------
-- KENAPA INI BUKAN KERAPIAN
--
-- Matriks centang di layar Akun memang dimaksudkan untuk diubah panitia
-- (CLAUDE.md 13.1), dan mencabut `live_score` dari satu akun gerbang adalah
-- tindakan yang masuk akal. Yang mati bukan Live Score-nya, melainkan kartu
-- merah sisipan — dan matinya SENYAP dua kali: RLS mengembalikan nol baris
-- tanpa melempar, lalu `app.js` sengaja menelan galat daftar ini
-- (`catch { /* daftar boleh telat */ }`) dan menggambar string kosong untuk
-- daftar kosong. Layarnya terlihat baik-baik saja.
--
-- Yang hilang bukan hiasan: CLAUDE.md 12.3 dan komentar di app.js menyebut
-- daftar ini "satu-satunya cara petugas staging tahu ada nomor yang tidak
-- tercetak di kertasnya" — pada pagi hari lomba, saat kertasnya sudah beredar.
--
-- Ini pengulangan bentuk yang sudah dibetulkan 0100 untuk `v_regu_ringkas`.
-- Kedua view dibaca layar YANG SAMA (`layarKeberangkatan`); yang satu ikut
-- dipindahkan, yang satu tertinggal.
--
-- ---------------------------------------------------------------------------
-- KENAPA DEFINER, BUKAN MENAMBAH `keberangkatan` KE `sel_pendaftaran`
--
-- Alasan yang sama dengan 0100: membuka `pendaftaran` untuk gerbang berarti
-- membuka nomor WA pembina seluruh sekolah kepada petugas yang cuma perlu tahu
-- nomor dada mana yang tidak ada di kertasnya. Viewnya yang menjaga haknya
-- sendiri, tabelnya tetap tertutup. Tes 73.2 menduduki kursi itu.
--
-- ---------------------------------------------------------------------------
-- BADAN VIEW-NYA DISALIN DARI DATABASE, BUKAN DARI 0009
--
-- 0009 menulis `s.nama` dan `not r.batal`. Kedua kolom itu sudah berganti nama
-- di 0012/0014, dan PostgreSQL ikut mengganti nama di dalam view yang sudah
-- terpasang — jadi berkas 0009 tidak lagi menggambarkan view yang hidup.
-- Yang disalin ke bawah adalah `pg_get_viewdef` dari database yang seluruh
-- migrasinya sudah jalan: `s.name` dan `not r.is_cancelled`.
--
-- Delapan kolomnya dipertahankan pada nama dan urutan yang sama persis —
-- `create or replace view` menuntut itu, dan `daftarSisipan()` di app.js
-- membacanya per nama.
-- ============================================================================

create or replace view v_sisipan_kloter with (security_invoker = off) as
select
  r.kloter_nomor    as kloter,
  r.nomor_dada,
  r.nama_regu,
  s.name            as nama_sekolah,
  r.golongan,
  r.disisipkan_pada,
  r.alasan_sisip,
  k.jam_berangkat is not null as sudah_berangkat
from regu r
join kloter k      on k.nomor = r.kloter_nomor
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s     on s.id = d.sekolah_id
where r.disisipkan_pada is not null
  and not r.is_cancelled
  and boleh_apa_saja('keberangkatan', 'cetak_kloter', 'daftar_ulang',
                     'pengaturan')
order by r.kloter_nomor, r.nomor_dada;

comment on view v_sisipan_kloter is
  'Nomor yang TIDAK ADA di kertas petugas staging. Definer agar tidak membuka pendaftaran beserta nomor WA pembina; badannya wajib menjaga keberangkatan/cetak_kloter/daftar_ulang/pengaturan.';

grant select on v_sisipan_kloter to authenticated;
revoke all on v_sisipan_kloter from anon;

-- ---------------------------------------------------------------------------
-- Pemeriksaan penutup: pagarnya benar-benar tertulis di badan view, dan
-- `security_invoker` benar-benar mati. Memindai nama tidak cukup — 0064 dan
-- 0065 dua kali melapor bersih atas alasan itu (CLAUDE.md 13.3).
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_badan   text := pg_get_viewdef('v_sisipan_kloter'::regclass, true);
  v_invoker text;
begin
  assert v_badan like '%boleh_apa_saja%',
    '0111: v_sisipan_kloter tidak memuat pagar hak di badannya';
  assert v_badan like '%keberangkatan%',
    '0111: pagar v_sisipan_kloter tidak menyebut keberangkatan';

  -- Nilainya disimpan APA ADANYA seperti yang ditulis, jadi `off` dan `false`
  -- sama-sama sah dan tidak boleh dibandingkan dengan salah satunya saja.
  -- Yang diperiksa adalah kebalikannya: ia tidak boleh menyala.
  select option_value into v_invoker
  from pg_class c, pg_options_to_table(c.reloptions)
  where c.oid = 'v_sisipan_kloter'::regclass
    and option_name = 'security_invoker';

  assert coalesce(v_invoker, 'off') not in ('true', 'on', 'yes', '1'),
    format('0111: v_sisipan_kloter masih security_invoker=%s', v_invoker);

  raise notice '0111: daftar sisipan kini dibuka hak keberangkatan, bukan live_score.';
end;
$blok$;
