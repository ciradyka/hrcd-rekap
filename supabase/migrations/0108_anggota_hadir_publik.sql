-- ============================================================================
-- hrcd-rekap : 0108_anggota_hadir_publik.sql
-- `anggota_hadir` ikut terbit ke halaman peserta.
--
-- ---------------------------------------------------------------------------
-- KENAPA
--
-- Papan Live Score menampilkan Penalti dan Total, dan Penalti selalu dibaca
-- dengan satu pertanyaan: "−12 dari mana?". Jawabannya empat hal — kontrak
-- waktu, jam berangkat, jam datang, dan berapa anggota yang tiba — dan tanpa
-- keempatnya angka itu tinggal tuduhan yang tidak bisa ditelusuri pembina
-- mana pun tanpa bertanya ke meja panitia.
--
-- Tiga yang pertama sudah lama ada di `v_progres_publik` (`kontrak_menit`,
-- `jam_berangkat`, `jam_datang`) — mereka cuma belum pernah digambar. Yang
-- keempat memang belum ada, dan itulah satu-satunya isi migrasi ini.
--
-- ---------------------------------------------------------------------------
-- KENAPA TIDAK DIPAGARI FASE
--
-- `nilai` dan `poin` (0107) dipagari `fase_live = 'penuh'` karena keduanya
-- HASIL LOMBA. `anggota_hadir` bukan: ia catatan perjalanan, sekelas
-- `jam_datang` yang sudah terbit sejak fase `progres` di view yang sama.
-- Memagarinya akan membuat kolom Anggota kosong justru pada fase ketika
-- peserta paling sering memeriksa apakah regunya sudah tercatat sampai.
--
-- Yang ikut penalti memang angkanya, tetapi penaltinya sendiri baru terbit di
-- fase penuh lewat `v_klasemen_publik` — dan itu pagar yang benar untuk
-- penalti, bukan untuk jumlah orang yang tiba di garis finish.
--
-- ---------------------------------------------------------------------------
-- Kolomnya ditambah DI UJUNG, sesudah `poin` milik 0107 — alasannya sama:
-- `create or replace view` hanya mengizinkan penambahan di belakang, dan drop
-- + create akan membuang `grant select ... to anon` yang menghidupkan halaman
-- peserta.
-- ============================================================================

create or replace view v_progres_publik as
select
  r.nomor_dada,
  r.nama_regu,
  s.name as nama_sekolah,
  r.golongan,
  (select jsonb_object_agg(p.nomor::text,
            exists (select 1 from nilai_mentah n
                    join wahana w on w.id = n.wahana_id
                    where n.regu_id = r.id and w.pos = p.nomor))
   from pos p
   where p.edisi = edisi_aktif()
     and exists (select 1 from wahana w
                 where w.edisi = p.edisi and w.pos = p.nomor)) as pos_terlewati,
  exists (select 1 from closing_regu c where c.regu_id = r.id) as sudah_closing,
  r.kloter_nomor                              as kloter,
  r.kontrak_menit,
  k.jam_berangkat,
  case when k.jam_berangkat is not null and r.kontrak_menit is not null
    then k.jam_berangkat + make_interval(mins => r.kontrak_menit)
  end                                         as target_datang,
  c.jam_datang,
  exists (select 1 from keberangkatan_regu kb where kb.regu_id = r.id)
                                              as sudah_berangkat,

  (select coalesce(jsonb_object_agg(w.pos || '.' || w.kode,
            exists (select 1 from nilai_mentah n
                     where n.regu_id = r.id and n.wahana_id = w.id)), '{}'::jsonb)
   from wahana w
   where w.edisi = edisi_aktif()
     and (w.golongan is null or w.golongan = r.golongan))    as komponen_terisi,

  case when (select fase_live from status_acara) = 'penuh' then
    (select coalesce(jsonb_object_agg(w.pos || '.' || w.kode,
              jsonb_build_object('nilai_1', n.nilai_1, 'nilai_2', n.nilai_2)), '{}'::jsonb)
     from nilai_mentah n join wahana w on w.id = n.wahana_id
     where n.regu_id = r.id and w.edisi = edisi_aktif())
  else '{}'::jsonb end                                        as nilai,

  case when (select fase_live from status_acara) = 'penuh' then
    (select coalesce(jsonb_object_agg(w.pos || '.' || w.kode,
              hitung_poin(w.form, n.nilai_1, n.nilai_2, w.poin_maks,
                          w.raw_terbaik, w.raw_terburuk, w.poin_benar,
                          w.poin_salah, w.total_soal, w.tingkat,
                          w.jawaban_benar)), '{}'::jsonb)
     from nilai_mentah n join wahana w on w.id = n.wahana_id
     where n.regu_id = r.id and w.edisi = edisi_aktif())
  else '{}'::jsonb end                                        as poin,

  -- Kolom BARU, di ujung, TANPA pagar fase. Lihat kepala berkas.
  c.anggota_hadir

from regu r
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s     on s.id = d.sekolah_id
left join kloter k        on k.nomor = r.kloter_nomor
left join closing_regu c  on c.regu_id = r.id
where not r.is_cancelled
  and d.status = 'lunas'
  and r.nomor_dada is not null
  and (select fase_live from status_acara) in ('progres', 'penuh');

comment on view v_progres_publik is
  'Baris regu untuk halaman peserta. `komponen_terisi` centang (boleh sejak fase progres); `nilai` dan `poin` hasil lomba, hanya di fase penuh; `kloter`, `kontrak_menit`, `jam_berangkat`, `jam_datang`, dan `anggota_hadir` catatan perjalanan, terbit sejak progres.';

do $blok$
declare
  v_kolom int;
begin
  select count(*) into v_kolom
  from information_schema.columns
  where table_schema = 'public' and table_name = 'v_progres_publik'
    and column_name in ('kloter', 'kontrak_menit', 'jam_berangkat',
                        'jam_datang', 'anggota_hadir');
  assert v_kolom = 5,
    format('0108: kelima kolom perjalanan belum lengkap (ketemu %s dari 5)', v_kolom);

  -- Kolom yang lahir 0107 tidak boleh ikut hilang saat view ditulis ulang.
  -- `create or replace` mengganti SELURUH badannya, jadi kolom yang lupa
  -- disalin lenyap tanpa satu galat pun — pelajaran yang sama dengan
  -- paket_peran() di 0075.
  assert (select count(*) from information_schema.columns
          where table_schema = 'public' and table_name = 'v_progres_publik'
            and column_name in ('nilai', 'poin')) = 2,
    '0108: kolom nilai/poin dari 0107 ikut hilang saat view ditulis ulang';

  raise notice '0108: anggota_hadir ikut terbit ke halaman peserta.';
end;
$blok$;
