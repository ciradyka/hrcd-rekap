-- ============================================================================
-- hrcd-rekap : 0025_pos_keberangkatan_kedatangan.sql
--
-- Pos 0 dan Pos 5 adalah garis start dan garis finish.
--
-- Selama ini `pos` berisi lima baris bernama "Pos 1".."Pos 5", dan Pos 5
-- dianggap pos penilaian seperti empat lainnya. Ternyata bukan: Pos 0 adalah
-- Keberangkatan dan Pos 5 adalah Kedatangan. Keduanya tempat nyata di rute
-- yang disebut peserta, tapi tidak ada yang dinilai di sana — yang dicatat
-- adalah WAKTU, dan itu sudah punya rumahnya sendiri sejak awal
-- (`kloter.jam_berangkat` dan `closing_regu.jam_datang`, lalu
-- `v_penalti_waktu`).
--
-- Rantai soal ikut berubah. `docs/alur-lomba.md` 7.4 menulis soal berjalan
-- satu pos ke depan sampai "Pos 4 -> dinilai di Pos 5". Tidak ada soal
-- terakhir: rantainya berhenti di Pos 4, dan Pos 5 tidak mengoreksi apa pun.
-- Tabelnya sudah dibetulkan di dokumen.
--
-- ----------------------------------------------------------------------------
-- YANG SEBENARNYA BERBAHAYA DI SINI, DAN KENAPA VIEW IKUT DIBUAT ULANG
--
-- `v_total_skor` menghitung pos terlewat begini:
--
--     (jumlah SELURUH pos - jumlah pos yang punya nilai) * nilai_pos_terlewat
--
-- Pos 0 dan Pos 5 tidak akan pernah punya nilai, karena tidak punya komponen
-- penilaian sama sekali. Jadi begitu keduanya masuk tabel `pos`, setiap regu
-- selamanya terhitung melewatkan dua pos.
--
-- Hari ini akibatnya nol, karena `nilai_pos_terlewat` bawaannya 0. Justru itu
-- masalahnya: kesalahannya tidak terlihat sekarang, dan baru meledak pada
-- hari seseorang mengubah satu angka konfigurasi yang memang boleh diubah —
-- lalu SELURUH peserta kehilangan poin untuk dua pos yang memang tidak
-- pernah bisa dinilai siapa pun.
--
-- Perbaikannya tidak menambah kolom penanda. "Pos yang dinilai" sudah bisa
-- dijawab dari data yang ada: pos yang punya minimal satu baris `wahana`.
-- Menambah kolom `dinilai` berarti dua sumber kebenaran untuk satu fakta,
-- dan suatu hari keduanya akan berbeda pendapat.
-- ============================================================================

-- 1. Nomor pos boleh 0 --------------------------------------------------------
alter table pos drop constraint if exists pos_nomor_check;
alter table pos add constraint pos_nomor_check check (nomor between 0 and 20);

-- `akun_panitia.pos` sengaja TIDAK ikut dilonggarkan ke 0. Akun operator pos
-- gunanya satu-satunya adalah mengisi nilai; akun untuk pos yang tidak
-- dinilai adalah akun yang tidak bisa melakukan apa pun. Kalau suatu hari
-- Pos 0 benar-benar menilai sesuatu, longgarkan di migrasi yang sama dengan
-- yang menambahkan komponennya.

-- 2. Pos terlewat hanya dihitung dari pos yang MEMANG dinilai -----------------
-- Daftar kolomnya tidak berubah, jadi v_klasemen dan v_klasemen_publik yang
-- bertumpu di atasnya tidak perlu ikut dibuat ulang.
create or replace view v_total_skor with (security_invoker = on) as
select
  r.id            as regu_id,
  r.nomor_dada,
  r.nama_regu,
  s.name          as nama_sekolah,
  r.golongan,
  -- Pos terlewat menyumbang nilai_pos_terlewat per pos (knob konfigurasi;
  -- default 0). Hanya pos yang punya komponen penilaian yang ikut dihitung —
  -- garis start dan garis finish bukan pos yang bisa dilewatkan.
  coalesce(pp.total_pos, 0)
    + (( (select count(*) from pos p
          where p.edisi = edisi_aktif()
            and exists (select 1 from wahana w
                        where w.edisi = p.edisi and w.pos = p.nomor))
         - coalesce(pp.jumlah_pos, 0) ) * kp.nilai_pos_terlewat)
                                                  as total_pos,
  pw.penalti_waktu,
  case when c.regu_id is null then kp.penalti_tanpa_checkout else 0 end
                                                  as penalti_checkout,
  case when c.regu_id is not null
    then (5 - c.anggota_hadir) * kp.penalti_per_anggota_hilang else 0 end
                                                  as penalti_anggota,
  coalesce(pp.total_pos, 0)
    + (( (select count(*) from pos p
          where p.edisi = edisi_aktif()
            and exists (select 1 from wahana w
                        where w.edisi = p.edisi and w.pos = p.nomor))
         - coalesce(pp.jumlah_pos, 0) ) * kp.nilai_pos_terlewat)
    - pw.penalti_waktu
    - case when c.regu_id is null then kp.penalti_tanpa_checkout else 0 end
    - case when c.regu_id is not null
        then (5 - c.anggota_hadir) * kp.penalti_per_anggota_hilang else 0 end
                                                  as total,
  pw.selisih_menit
from regu r
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s     on s.id = d.sekolah_id
left join (select regu_id, sum(poin_pos) as total_pos, count(*) as jumlah_pos
           from v_poin_pos group by regu_id) pp on pp.regu_id = r.id
join v_penalti_waktu pw  on pw.regu_id = r.id
left join closing_regu c on c.regu_id = r.id
cross join konfig_penalti kp
where kp.edisi = edisi_aktif()
  and not r.is_cancelled
  and d.status = 'lunas';

-- 3. Matriks pemantauan: kolom untuk pos yang tidak dinilai selalu kosong,
--    dan kolom yang selamanya kosong terbaca sebagai pekerjaan yang belum
--    selesai. Dibuang dari matriksnya.
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
  and (peran() <> 'operator_pos' or p.nomor = pos_saya());

-- 4. Halaman live publik: "sudah lewat pos mana" tidak boleh menampilkan pos
--    yang tidak pernah menghasilkan tanda apa pun.
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
  exists (select 1 from closing_regu c where c.regu_id = r.id) as sudah_closing
from regu r
join pendaftaran d on d.id = r.pendaftaran_id
join sekolah s     on s.id = d.sekolah_id
where not r.is_cancelled
  and d.status = 'lunas'
  and r.nomor_dada is not null
  and exists (select 1 from keberangkatan_regu kb where kb.regu_id = r.id)
  and (select fase_live from status_acara) in ('progres', 'penuh');

-- 5. Daftar pos + jumlah komponennya, untuk pemilih pos di layar Input Pos.
--    Tanpa angka ini layar tidak bisa membedakan "pos yang belum dikonfigurasi
--    admin" dari "pos yang memang tidak dinilai", dan menuduh yang kedua
--    sebagai yang pertama.
create or replace view v_pos with (security_invoker = on) as
select
  p.nomor,
  p.name,
  p.bobot,
  p.bayangan,
  (select count(*) from wahana w
   where w.edisi = p.edisi and w.pos = p.nomor)::int as jumlah_komponen
from pos p
where p.edisi = edisi_aktif();

grant select on v_pos to authenticated, service_role;

-- 6. Nama kedua pos ----------------------------------------------------------
do $$
declare v_edisi smallint;
begin
  select nomor into v_edisi from edisi where is_active;
  if v_edisi is null then
    raise notice 'belum ada edisi aktif — nama pos dilewati';
    return;
  end if;
  if (select konfigurasi_terkunci from status_acara) then
    raise exception 'konfigurasi sedang terkunci — buka kuncinya di status_acara dulu, lalu jalankan ulang migrasi ini';
  end if;

  insert into pos (edisi, nomor, name, bobot, bayangan) values
    (v_edisi, 0, 'Keberangkatan', 1.00, false),
    (v_edisi, 5, 'Kedatangan',    1.00, false)
  on conflict (edisi, nomor) do update set name = excluded.name;
end;
$$;
