-- ============================================================================
-- hrcd-rekap : 0067_live_score_semua_peran.sql
-- Live Score kosong untuk setiap peran selain admin.
--
-- APA YANG TERLIHAT
--
-- Akun juri pos membuka Live Score dan mendapat "Belum ada regu yang bisa
-- diperingkat di golongan mana pun" — padahal 40 regu sudah berangkat dan
-- empat pos sudah terisi di atas 70%. Judulnya pun masih berbunyi "hanya
-- admin", padahal `paket_peran` memberi `live_score` ke SEMUA peran.
--
-- DUA SEBAB, DAN YANG PERTAMA KESALAHAN 0065
--
-- 1. `v_klasemen_live_score` masih menyaring `where peran() = 'admin'`.
--
--    0065 memang bermaksud memindahkannya ke `boleh()`, tapi ia menulis nama
--    `v_klasemen_pratinjau` — nama yang sudah DIGANTI oleh migrasi 0050 jadi
--    `v_klasemen_live_score`. Akibatnya `drop view if exists` tidak menemukan
--    apa pun, `create view` melahirkan view BARU yang tidak dipakai siapa
--    pun, dan yang asli tidak tersentuh sama sekali.
--
--    Pemeriksaan penutup 0065 tidak menangkapnya karena ia mencari nama peran
--    LAMA ('meja', 'operator_pos'). `peran() = 'admin'` tidak mengandung
--    keduanya. Pemeriksaan yang mencari gejala kemarin, bukan penyakitnya.
--
-- 2. Mengganti saringannya saja TIDAK cukup, dan ini yang lebih penting.
--
--    Seluruh rantai di bawahnya — v_klasemen, v_total_skor, v_poin_pos —
--    `security_invoker`, jadi ia tunduk pada RLS milik yang membuka layar.
--    Supaya angkanya benar untuk juri pos, ia harus boleh membaca
--    `pendaftaran` (join ke nama sekolah) DAN `nilai_mentah` SELURUH POS.
--    Yang kedua persis isolasi per pos yang baru diperbaiki 0065 — R6 di
--    rancangan-b. Membukanya demi papan skor berarti membatalkannya.
--
-- CARA MEMPERBAIKINYA
--
-- Papan ini dialasi FUNGSI `security definer`, bukan sekadar view tanpa
-- `security_invoker`. Percobaan pertama memang begitu — membuang
-- `security_invoker` dari view terluar — dan ia GAGAL: `security_invoker` di
-- view-view DI DALAMNYA tetap berlaku, jadi rantainya masih tunduk pada RLS
-- milik yang membuka layar. Tes 33 menangkapnya di percobaan pertama; tanpa
-- tes itu ia akan tampak selesai dan tetap kosong di lapangan.
--
-- Di dalam fungsi `security definer`, `current_user` berganti jadi pemilik
-- fungsi, dan barulah seluruh rantai invoker di bawahnya ikut membaca sebagai
-- pemilik. Haknya dijaga fungsi itu sendiri lewat `boleh('live_score')`.
--
-- Itu bukan jalan pintas, itu bentuk yang benar untuk view seperti ini: yang
-- keluar cuma AGREGAT — peringkat, total, poin per pos — tanpa satu kolom pun
-- yang tidak boleh dilihat pemegang live_score. Nomor WA pembina tidak ikut,
-- nilai mentah per komponen tidak ikut. Yang dibuka pemandangannya, bukan
-- tabelnya.
--
-- KLASEMEN MEMANG BOLEH SETENGAH JALAN
--
-- Diminta pemilik acara: papan harus menunjukkan peringkat SEKARANG, walau
-- belum semua pos terisi. Itu sudah menjadi perilaku `v_total_skor` sejak
-- awal — poin per pos di-LEFT JOIN, jadi regu yang baru melewati dua pos ikut
-- terhitung dengan totalnya yang sekarang. Tidak ada yang perlu diubah untuk
-- itu; yang menahannya cuma saringan admin di atas.
--
-- Yang tetap disaring `v_klasemen`: regu harus sudah BERANGKAT (ada di
-- keberangkatan_regu dan kloternya punya jam_berangkat). Itu bukan soal
-- kelengkapan nilai — regu yang belum berangkat belum punya jam mulai, jadi
-- penalti waktunya belum berarti apa-apa.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. View liar dari 0065 dibuang.
--
--    Ia lahir dari salah nama, tidak pernah dibaca kode mana pun, dan
--    membiarkannya berarti dua view berbeda menjawab pertanyaan yang sama —
--    yang satu benar, yang satu tidak, dan tidak ada yang menyebutkan mana.
-- ---------------------------------------------------------------------------
drop view if exists v_klasemen_pratinjau;

-- ---------------------------------------------------------------------------
-- 2. Live Score untuk semua peran yang mencentangnya.
-- ---------------------------------------------------------------------------
drop view if exists v_klasemen_live_score;

-- Tipe kolomnya disalin dari view lama apa adanya, supaya bentuknya tetap
-- sama persis dengan v_klasemen_publik — layar Live Score dan halaman peserta
-- tidak boleh berbeda diam-diam.
create or replace function klasemen_live_score()
returns table (
  peringkat        bigint,
  nomor_dada       integer,
  nama_regu        text,
  nama_sekolah     text,
  golongan         text,
  total_pos        numeric,
  penalti_waktu    numeric,
  penalti_checkout numeric,
  penalti_anggota  numeric,
  total            numeric,
  poin_per_pos     jsonb,
  selisih_menit    integer
)
language sql stable security definer
set search_path = public
as $$
  select
    k.peringkat, k.nomor_dada, k.nama_regu, k.nama_sekolah, k.golongan,
    k.total_pos, k.penalti_waktu, k.penalti_checkout, k.penalti_anggota, k.total,
    (select jsonb_object_agg(pp.pos::text, pp.poin_pos)
     from v_poin_pos pp where pp.regu_id = k.regu_id)        as poin_per_pos,
    k.selisih_menit
  from v_klasemen k
  where boleh('live_score')
$$;

comment on function klasemen_live_score() is
  'Alas papan Live Score panitia. security definer supaya rantai view di bawahnya (semuanya security_invoker) membaca sebagai pemilik — tanpa itu juri pos harus diberi akses baca nilai mentah SELURUH pos, membatalkan isolasi R6. Haknya dijaga boleh(live_score) di dalam sini.';

revoke all on function klasemen_live_score() from public;
grant execute on function klasemen_live_score() to authenticated;

create view v_klasemen_live_score as select * from klasemen_live_score();

comment on view v_klasemen_live_score is
  'Klasemen yang akan dilihat peserta, dibuka lebih awal untuk panitia pemegang live_score. Sengaja BUKAN security_invoker: yang keluar hanya agregat, dan membukanya lewat RLS akan menuntut juri pos boleh membaca nilai mentah seluruh pos (isolasi R6). Bentuk kolomnya sama persis dengan v_klasemen_publik supaya layar Live Score dan halaman peserta tidak pernah berbeda diam-diam.';

grant select on v_klasemen_live_score to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Hasilnya, dilihat dari kursi yang tadi kosong.
-- ---------------------------------------------------------------------------
do $blok$
declare v_n int; v_peringkat int;
begin
  select count(*) into v_n from v_klasemen;
  raise notice '0067: % regu berdiri di klasemen (sebelum saringan hak).', v_n;

  select count(*) into v_n from (
    select 1 from v_klasemen k
     where not exists (select 1 from v_poin_pos pp where pp.regu_id = k.regu_id)) x;
  raise notice '0067: % di antaranya belum punya nilai satu pos pun — tetap diperingkat.', v_n;
end $blok$;
