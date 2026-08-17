-- ============================================================================
-- hrcd-rekap : 0065_view_hak_dan_rekap.sql
-- Enam view yang luput dari 0064, dan N+1 di v_rekap_penuh.
--
-- LUBANG DI PEMERIKSAAN 0064
--
-- 0064 memindahkan 21 RPC dan 27 policy dari `peran()` ke `boleh()`, lalu
-- menutup dirinya dengan pemindaian katalog dan melaporkan: "tidak ada lagi
-- policy/fungsi yang menyebut peran lama". Laporan itu benar — dan menyesatkan.
-- **VIEW bukan policy dan bukan fungsi.** Enam view menyaring pakai `peran()`,
-- lima di antaranya menyebut nama peran yang sudah tidak ada sejak 0058, dan
-- tidak satu pun disebut oleh pemeriksaan itu.
--
-- Pelajarannya bukan "kurang teliti". Pemeriksaan yang cakupannya lebih sempit
-- daripada masalahnya memberi rasa aman yang MENGHENTIKAN pencarian — lebih
-- berbahaya daripada tidak ada pemeriksaan sama sekali. Penutup berkas ini
-- memindai pg_views juga.
--
-- DAN KERUSAKANNYA DUA ARAH, BUKAN SATU
--
-- Yang di 0064 semuanya mengunci: peran baru tidak cocok dengan nama lama,
-- jadi pintunya tertutup. Dua view di sini justru MEMBUKA:
--
--     and (peran() <> 'operator_pos' or p.nomor = pos_saya())
--
-- Untuk akun juri pos, `'juri_pos' <> 'operator_pos'` bernilai TRUE — jadi
-- cabang kanannya tidak pernah diperiksa dan pembatas posnya tidak berlaku.
-- `v_lembar_pos` dan `v_monitoring_input` karena itu menampilkan lembar dan
-- kemajuan SELURUH pos ke juri pos mana pun. Isolasi per pos adalah R6 di
-- `docs/rancangan-b.md`, dan ia bocor diam-diam sejak 0058.
--
-- Ini juga yang membuat laporan saya sebelumnya kurang tepat: 0064 memang
-- membuat `simpan_nilai_massal` bisa dipanggil juri pos lagi, tapi
-- `v_lembar_pos` — sumber data layar yang sama — masih menyaring dengan nama
-- peran mati. Satu layar, dua pintu, dan yang diperbaiki baru satu.
--
-- N+1 DI v_rekap_penuh
--
-- Dua kolomnya, `nilai` dan `poin_pos`, adalah subquery berkorelasi di daftar
-- SELECT: dihitung ulang sekali untuk SETIAP regu. Yang mahal `v_poin_pos` —
-- rantai view yang menghitung poin seluruh regu — jadi 50 regu berarti papan
-- skor dihitung 50 kali untuk mengambil satu barisnya tiap kali.
--
-- Angka "19 detik" yang sempat beredar TIDAK terverifikasi, dan tidak dipakai
-- di sini: di database uji dengan 22 regu view-nya selesai 9,8 ms, yang tidak
-- menskala jadi 19 detik pada 50 regu. Daripada mengutip angka yang tidak bisa
-- diulang, bagian 1 di bawah MENGUKUR kedua pola atas data produksi sesaat
-- sebelum menggantinya, dan mencetak keduanya ke log. Angka yang benar akan
-- ada di sana, apa pun hasilnya.
--
-- Perbaikannya tidak mengubah hasil: agregatnya pindah ke CTE, dihitung
-- sekali, lalu di-join. `coalesce` ke '{}' pindah ke join, bukan hilang.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Ukur dulu polanya, di data produksi, sebelum diganti.
-- ---------------------------------------------------------------------------
-- Angka "19 detik" yang beredar sebelumnya TIDAK terverifikasi: di database
-- uji dengan 22 regu, view-nya selesai dalam 9,8 ms. Daripada mengutip angka
-- yang tidak bisa diulang, migrasi ini mengukur sendiri — di data produksi,
-- sesaat sebelum menggantinya — dan mencetak kedua angkanya ke log.
--
-- Yang diukur BUKAN view-nya (saringan boleh()/peran() mengembalikan nol baris
-- untuk migrasi yang jalan sebagai superuser, jadi angkanya akan bohong),
-- melainkan dua pola agregatnya, apa adanya, atas seluruh regu.
do $blok$
declare
  t0     timestamptz;
  v_lama numeric;
  v_baru numeric;
  v_n    int;
  v_buang jsonb;
begin
  select count(*) into v_n from regu where not is_cancelled;

  -- Pola LAMA: subquery berkorelasi, sekali per regu.
  t0 := clock_timestamp();
  for v_buang in
    select coalesce((
             select jsonb_object_agg(pp.pos::text, pp.poin_pos)
             from v_poin_pos pp where pp.regu_id = r.id
           ), '{}'::jsonb)
    from regu r where not r.is_cancelled
  loop
    null;
  end loop;
  v_lama := extract(epoch from (clock_timestamp() - t0)) * 1000;

  -- Pola BARU: satu agregat, sekali.
  t0 := clock_timestamp();
  perform count(*) from (
    select pp.regu_id, jsonb_object_agg(pp.pos::text, pp.poin_pos)
    from v_poin_pos pp group by pp.regu_id) x;
  v_baru := extract(epoch from (clock_timestamp() - t0)) * 1000;

  raise notice '0065: % regu — pola lama % ms, pola baru % ms (% kali lebih cepat)',
    v_n, round(v_lama), round(v_baru),
    case when v_baru > 0 then round(v_lama / v_baru, 1) else null end;
end $blok$;


-- ---------------------------------------------------------------------------
-- 2. Lima view yang salah saring. Badannya UTUH; hanya predikatnya diganti.
-- ---------------------------------------------------------------------------
drop view if exists v_foto_lembar;
create or replace view v_foto_lembar as
select
  f.id, r.nomor_dada, f.pos, f.kode_lomba, f.nama_lomba, f.path,
  f.ukuran_bytes,
  coalesce(a.username, '(tidak dikenal)') as oleh,
  f.diunggah_pada
from foto_lembar f
join regu r on r.id = f.regu_id
left join akun_panitia a on a.user_id = f.diunggah_oleh
where boleh('rekap')
   or (boleh('pos') and (pos_saya() is null or f.pos = pos_saya()));



drop view if exists v_lembar_pos;
create or replace view v_lembar_pos as
select
  p.nomor       as pos,
  p.name        as nama_pos,
  p.bayangan,
  r.id          as regu_id,
  r.nomor_dada,
  r.nama_regu,
  s.name        as nama_sekolah,
  r.golongan,

  coalesce((
    select jsonb_object_agg(w.kode, jsonb_build_object(
             'nilai_1', n.nilai_1, 'nilai_2', n.nilai_2))
    from nilai_mentah n
    join wahana w on w.id = n.wahana_id
    where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor
  ), '{}'::jsonb) as nilai,

  (select count(*) from nilai_mentah n
   join wahana w on w.id = n.wahana_id
   where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor)::int
                as jumlah_terisi,

  -- INI yang berubah: hanya komponen yang berlaku untuk golongan regu ini.
  (select count(*) from wahana w
   where w.edisi = p.edisi and w.pos = p.nomor
     and komponen_berlaku(w.golongan, r.golongan))::int
                as jumlah_komponen,

  round(coalesce((
    select sum(hitung_poin(w.form, n.nilai_1, n.nilai_2, w.poin_maks,
                           w.raw_terbaik, w.raw_terburuk,
                           w.poin_benar, w.poin_salah, w.total_soal, w.tingkat))
    from nilai_mentah n
    join wahana w on w.id = n.wahana_id
    where n.regu_id = r.id and w.edisi = p.edisi and w.pos = p.nomor
  ), 0) * p.bobot, 2) as nilai_pos,

  -- Gembok (0043). Kolom BARU ditaruh paling belakang: `create or replace
  -- view` menolak daftar kolom yang berubah urutan atau tipenya, dan hanya
  -- mengizinkan penambahan di ujung.
  nilai_tergembok(r.id, p.nomor) as terkunci

from regu r
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s     on s.id = d.sekolah_id
cross join pos p
where p.edisi = edisi_aktif()
  and not r.is_cancelled
  and d.status = 'lunas'
  and r.nomor_dada is not null
  and boleh('pos')
  and (pos_saya() is null or p.nomor = pos_saya());


drop view if exists v_monitoring_input;
create or replace view v_monitoring_input with (security_invoker = on) as
select
  r.nomor_dada,
  r.nama_regu,
  r.golongan,
  r.kloter_nomor,
  p.nomor as pos,
  exists (select 1 from nilai_mentah n
          join wahana w on w.id = n.wahana_id
          where n.regu_id = r.id and w.pos = p.nomor) as sudah_input,
  (select count(*) from nilai_mentah n
   join wahana w on w.id = n.wahana_id
   where n.regu_id = r.id and w.pos = p.nomor) as jumlah_komponen_terisi,
  exists (select 1 from closing_regu c where c.regu_id = r.id) as sudah_closing
from regu r
join pendaftaran d on d.id = r.pendaftaran_id
cross join pos p
where p.edisi = edisi_aktif()
  and exists (select 1 from wahana w where w.edisi = p.edisi and w.pos = p.nomor)
  and not r.is_cancelled
  and d.status = 'lunas'
  and r.nomor_dada is not null
  -- Operator pos hanya melihat kolom pos-nya: RLS nilai_mentah membuat
  -- kolom pos lain SELALU tampak kosong — tampilan palsu lebih buruk
  -- daripada tampilan sempit (temuan review).
  and (pos_saya() is null or p.nomor = pos_saya());



drop view if exists v_riwayat_nilai;
create or replace view v_riwayat_nilai as
select
  h.id,
  r.nomor_dada,
  w.pos,
  w.name                        as nama_lomba,
  w.kode                        as kode_lomba,
  (h.old_value ->> 'nilai_1')::numeric as nilai_lama,
  (h.new_value ->> 'nilai_1')::numeric as nilai_baru,
  h.action,
  coalesce(a.username, '(tidak dikenal)') as oleh,
  h.changed_at
from history h
join regu r   on r.id = h.regu_id
-- Baris nilai_mentah menyimpan wahana_id di kedua sisi; DELETE hanya punya
-- yang lama, INSERT hanya yang baru.
join wahana w on w.id = coalesce((h.new_value ->> 'wahana_id')::uuid,
                                 (h.old_value ->> 'wahana_id')::uuid)
left join akun_panitia a on a.user_id = h.changed_by
where h.table_name = 'nilai_mentah'
  and w.edisi = edisi_aktif()
  and (
    boleh('pengaturan')
    or (boleh('pos') and (pos_saya() is null or w.pos = pos_saya()))
  );



drop view if exists v_klasemen_pratinjau;
create or replace view v_klasemen_pratinjau with (security_invoker = on) as
select
  k.peringkat, k.nomor_dada, k.nama_regu, k.nama_sekolah, k.golongan,
  k.total_pos, k.penalti_waktu, k.penalti_checkout, k.penalti_anggota, k.total,
  (select jsonb_object_agg(pp.pos::text, pp.poin_pos)
   from v_poin_pos pp where pp.regu_id = k.regu_id)          as poin_per_pos,
  k.selisih_menit
from v_klasemen k
where boleh('pengaturan');



-- ---------------------------------------------------------------------------
-- 3. v_rekap_penuh: saringannya DAN N+1-nya.
-- ---------------------------------------------------------------------------
drop view if exists v_rekap_penuh;
create view v_rekap_penuh with (security_invoker = on) as
-- Dua agregat ini dulu subquery berkorelasi di daftar SELECT — dihitung ulang
-- sekali untuk SETIAP regu. Yang mahal bukan `nilai_mentah` (ia berindeks per
-- regu), melainkan `v_poin_pos`: ia rantai view yang menghitung poin SELURUH
-- regu, dan dipanggil di dalam subquery berkorelasi ia dijalankan sekali per
-- baris. 50 regu = 50 kali seluruh papan skor dihitung untuk mengambil satu
-- barisnya.
--
-- Sebagai CTE, keduanya dihitung SEKALI lalu di-join. Hasilnya identik —
-- coalesce-nya pindah ke join, bukan hilang.
with nilai_per_regu as (
  select
    n.regu_id,
    jsonb_object_agg(w.pos || '.' || w.kode, jsonb_build_object(
      'nilai_1', n.nilai_1, 'nilai_2', n.nilai_2)) as nilai
  from nilai_mentah n
  join wahana w on w.id = n.wahana_id
  where w.edisi = edisi_aktif()
  group by n.regu_id
),
poin_per_regu as (
  select pp.regu_id, jsonb_object_agg(pp.pos::text, pp.poin_pos) as poin_pos
  from v_poin_pos pp
  group by pp.regu_id
),
berangkat as (
  select distinct kb.regu_id from keberangkatan_regu kb
)
select
  r.id            as regu_id,
  kl.peringkat,
  r.nomor_dada,
  r.nama_regu,
  s.name          as nama_sekolah,
  r.golongan,

  coalesce(npr.nilai,    '{}'::jsonb) as nilai,
  coalesce(ppr.poin_pos, '{}'::jsonb) as poin_pos,

  r.kloter_nomor  as kloter,
  k.jam_berangkat,
  c.jam_datang,
  r.kontrak_menit,
  pw.selisih_menit,
  -- Lama tempuh sebenarnya, dalam menit. Panitia memakainya untuk membaca
  -- selisih tanpa menghitung di kepala: tempuh 245 menit dengan kontrak 240
  -- berarti telat 5. Spreadsheet lama memecahnya jadi kolom jam dan kolom
  -- menit terpisah karena rumusnya butuh begitu; di sini satu angka cukup.
  case when k.jam_berangkat is not null and c.jam_datang is not null
    then round(extract(epoch from (c.jam_datang - k.jam_berangkat)) / 60)::int
  end             as tempuh_menit,
  c.anggota_hadir,

  t.total_pos,
  pw.penalti_waktu,
  t.penalti_checkout,
  t.penalti_anggota,
  t.total,

  (b.regu_id is not null) as sudah_berangkat,
  (c.regu_id is not null) as sudah_closing

from regu r
join pendaftaran d       on d.id = r.pendaftaran_id
join sekolah s           on s.id = d.sekolah_id
join v_total_skor t      on t.regu_id = r.id
join v_penalti_waktu pw  on pw.regu_id = r.id
left join v_klasemen kl  on kl.regu_id = r.id
left join kloter k       on k.nomor = r.kloter_nomor
left join closing_regu c on c.regu_id = r.id
left join nilai_per_regu npr on npr.regu_id = r.id
left join poin_per_regu ppr  on ppr.regu_id = r.id
left join berangkat b        on b.regu_id = r.id
-- Dulu `peran() in ('admin','meja')`. 'meja' sudah tidak ada sejak 0058, jadi
-- baris ini menutup Rekapitulasi untuk setiap peran selain admin.
where boleh('rekap');

comment on view v_rekap_penuh is
  'Rekap lengkap panitia. Agregat nilai dan poin dihitung sekali lewat CTE, bukan sekali per regu. Haknya lewat boleh(rekap).';


-- ---------------------------------------------------------------------------
-- 3b. GRANT dipasang ulang.
--
--     `drop view` MENGHAPUS grant-nya. Tanpa bagian ini, keenam view di atas
--     berdiri dengan definisi yang benar dan menolak setiap panitia dengan
--     "permission denied for view" — layar Rekapitulasi, Input Nilai, dan
--     Monitoring mati serentak, dan penyebabnya tidak kelihatan dari
--     definisinya sama sekali. Tes 31 menemukannya di percobaan pertama;
--     tanpa tes itu ia akan ditemukan panitia di hari simulasi.
--
--     Daftarnya persis seperti aslinya: v_lembar_pos (0023) dan
--     v_monitoring_input (0005) ikut service_role karena rantai view publik
--     melewatinya; sisanya cukup authenticated.
-- ---------------------------------------------------------------------------
grant select on v_lembar_pos, v_monitoring_input to authenticated, service_role;
grant select on v_rekap_penuh, v_riwayat_nilai, v_foto_lembar,
  v_klasemen_pratinjau to authenticated;

-- ---------------------------------------------------------------------------
-- 3c. `rekap` ikut boleh membaca pendaftaran.
--
--     Ditemukan tes 31, bukan dibaca dari kode: memberi centang `rekap` ke
--     sebuah akun tidak cukup membuat Rekapitulasi terisi, karena
--     `v_rekap_penuh` security_invoker dan ia mem-JOIN `pendaftaran` untuk
--     sampai ke nama sekolahnya. Tanpa hak baca di sana, join-nya menghasilkan
--     nol baris — layarnya kosong, tanpa galat, dan penyebabnya ada di tabel
--     yang namanya tidak disebut di layar mana pun.
--
--     Ini bukan pelonggaran yang tidak disengaja: siapa pun yang diberi
--     `rekap` memang dimaksudkan melihat rekap, dan rekap tidak ada tanpa
--     sekolahnya. `pembayaran` sengaja TIDAK ikut — rekap tidak menyentuhnya.
-- ---------------------------------------------------------------------------
drop policy if exists sel_pendaftaran on pendaftaran;
create policy sel_pendaftaran on pendaftaran for select using (
  boleh_apa_saja('pendaftaran', 'pembayaran', 'daftar_ulang', 'cetak_kloter',
                 'rekap', 'pengaturan')
);


-- ---------------------------------------------------------------------------
-- 4. Pemeriksaan penutup — DAN kenapa yang di 0064 tidak cukup.
--
--    0064 memindai pg_policies dan pg_proc, lalu melaporkan "tidak ada lagi
--    yang menyebut peran lama". Laporan itu benar dan menyesatkan sekaligus:
--    VIEW bukan policy dan bukan fungsi, jadi kelima view di atas lolos tanpa
--    disebut sama sekali — termasuk v_lembar_pos, sumber data layar Input
--    Nilai. Pemeriksaan yang cakupannya lebih sempit daripada masalahnya
--    memberi rasa aman yang justru menghentikan pencarian.
--
--    Karena itu di sini pg_views ikut dipindai.
-- ---------------------------------------------------------------------------
do $blok$
declare r record; v_n int := 0;
begin
  for r in
    select 'policy'::text as jenis,
           schemaname || '.' || tablename || '.' || policyname as nama
      from pg_policies
     where coalesce(qual, '') || coalesce(with_check, '') ~ '''meja''|''operator_pos'''
    union all
    select 'fungsi', p.proname
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosrc ~ '''meja''|''operator_pos'''
       and p.proname <> 'paket_peran'
    union all
    select 'view', v.viewname
      from pg_views v
     where v.schemaname = 'public' and v.definition ~ '''meja''|''operator_pos'''
    order by 1, 2
  loop
    v_n := v_n + 1;
    raise notice '0065: MASIH menyebut peran lama — % %', r.jenis, r.nama;
  end loop;
  if v_n > 0 then
    raise exception '0065: % objek masih menyebut peran lama (daftar di atas).', v_n;
  end if;
  raise notice '0065: policy, fungsi, DAN view — tidak ada lagi yang menyebut peran lama.';
end $blok$;

