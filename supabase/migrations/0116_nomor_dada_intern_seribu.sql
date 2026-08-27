-- ============================================================================
-- hrcd-rekap : 0116_nomor_dada_intern_seribu.sql
-- Dua deret nomor dada: Eksternal 1-500, Intern 1001-1250.
--
-- KENAPA
--
-- Panitia mencetak kain nomor dada dalam DUA set terpisah, dan keduanya mulai
-- dari 001. Sampai hari ini sistem memakai satu deret: `regu.nomor_dada`
-- unique (0001) dan tiap nomor harus ada di `nomor_dada_stok`. Akibatnya meja
-- daftar ulang Intern akan berhenti di regu pertama dengan
--
--     nomor dada sudah dipakai regu lain: 1
--
-- Keputusan pemilik acara: nomor dada Intern DIKETIK 1001-1250. Jadi kain
-- bertulis 001 dicatat sebagai 1001, dan yang tampil di seluruh layar,
-- kertas, dan papan peserta adalah 1001 — bukan terjemahan yang cuma ada di
-- satu layar.
--
-- KONSEKUENSI YANG HARUS DIKETAHUI PANITIA
--
-- Juri di pos menulis nomor dada dengan TANGAN, membaca dari kain di dada
-- regu. Kain Intern harus ditandai supaya yang tertulis di blangko juga
-- 1xxx — kalau kainnya polos bertulis 001, blangkonya ambigu dan tidak ada
-- satu pun baris SQL yang bisa memulihkannya. Migrasi ini menutup jalur
-- sistemnya, bukan jalur kertasnya.
--
-- KENAPA PAKAI DERET, BUKAN KOLOM BARU
--
-- Alternatifnya menambah kolom `kelompok` lalu mengganti kunci jadi
-- (kelompok, nomor). Itu menyentuh 56 tempat di SQL yang mencari
-- `where nomor_dada = ...`, seluruh layar panitia, dan halaman peserta — dua
-- hari sebelum lomba. Dengan deret, kuncinya tetap SATU integer unik: unique
-- constraint, foreign key ke stok, pensiun, foto, dan klasemen tidak berubah
-- sama sekali. Yang ditambah cuma pagar yang menolak nomor dari deret yang
-- salah.
--
-- BATASNYA KONFIGURASI, BUKAN KONSTANTA
--
-- `edisi.nomor_dada_intern_mulai` — alasan yang sama dengan jendela
-- keberangkatan (CLAUDE.md 10.7): panitia tahun depan boleh mengubahnya tanpa
-- menyentuh kode. Batas ATASNYA tidak ikut jadi konfigurasi karena sudah ada
-- yang menyatakannya: `nomor_dada_stok` adalah daftar kain yang benar-benar
-- dibawa. Dua tempat yang menjawab "sampai berapa" akan berselisih suatu
-- hari.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Batas deret Intern, per edisi.
-- ---------------------------------------------------------------------------
alter table edisi add column if not exists nomor_dada_intern_mulai integer;

update edisi set nomor_dada_intern_mulai = 1001
 where nomor_dada_intern_mulai is null;

alter table edisi alter column nomor_dada_intern_mulai set default 1001;
alter table edisi alter column nomor_dada_intern_mulai set not null;

do $blok$
begin
  -- `> 1`, bukan `> 0`: deret Eksternal harus punya sisa. Batas 1 membuat
  -- SELURUH stok jadi milik Intern dan tidak ada satu nomor pun yang sah
  -- untuk regu Eksternal — pagar yang menolak semua orang.
  if not exists (select 1 from pg_constraint
                 where conname = 'edisi_nomor_dada_intern_mulai_check') then
    alter table edisi add constraint edisi_nomor_dada_intern_mulai_check
      check (nomor_dada_intern_mulai > 1);
  end if;
end;
$blok$;

-- ---------------------------------------------------------------------------
-- 2. Stok kain Intern: 1001-1250.
--
--    `on conflict do nothing` supaya migrasi ini boleh dijalankan dua kali,
--    dan supaya ia tidak bertengkar dengan stok yang mungkin sudah diisi
--    tangan lewat dashboard.
-- ---------------------------------------------------------------------------
insert into nomor_dada_stok (nomor)
select generate_series(1001, 1250)
on conflict (nomor) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Satu tempat yang menyatakan kedua deret.
--
--    Dipakai layar Daftar Ulang untuk menyusun pesan galat dan menandai kotak
--    isian, dan layar Input Pos untuk mencetak lembar cadangan hanya pada
--    nomor yang BENAR-BENAR ada. Tanpa view ini layar harus mengunduh seluruh
--    750 baris stok cuma untuk tahu ujung-ujungnya.
--
--    `security_invoker` supaya RLS `sel_stok` tetap yang memutuskan siapa
--    boleh membacanya — panitia mana pun boleh, anon tidak.
-- ---------------------------------------------------------------------------
create or replace view v_rentang_nomor_dada
with (security_invoker = true) as
select
  e.nomor_dada_intern_mulai as intern_mulai_konfigurasi,
  (select min(s.nomor) from nomor_dada_stok s
    where s.nomor < e.nomor_dada_intern_mulai) as eksternal_mulai,
  (select max(s.nomor) from nomor_dada_stok s
    where s.nomor < e.nomor_dada_intern_mulai) as eksternal_sampai,
  (select min(s.nomor) from nomor_dada_stok s
    where s.nomor >= e.nomor_dada_intern_mulai) as intern_mulai,
  (select max(s.nomor) from nomor_dada_stok s
    where s.nomor >= e.nomor_dada_intern_mulai) as intern_sampai
from edisi e
where e.is_active;

grant select on v_rentang_nomor_dada to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Pagarnya, satu fungsi untuk dua pintu.
--
--    Ada DUA jalur yang memberi nomor dada ke regu: `daftar_ulang_batch` dan
--    `tukar_nomor_dada`. Menulis pemeriksaan yang sama dua kali berarti dua
--    pesan yang lambat laun berbeda bunyinya, dan yang membacanya petugas
--    yang sedang antre.
--
--    Pesannya menyebut RENTANG YANG BENAR, bukan cuma "salah deret". Petugas
--    yang salah ketik butuh tahu harus mengetik apa, bukan bahwa ia keliru.
-- ---------------------------------------------------------------------------
create or replace function pesan_deret_nomor_dada(p_intern boolean)
returns text
language sql stable
set search_path = public
as $$
  select format('Nomor dada %s adalah dari %s - %s.',
                case when p_intern then 'intern' else 'eksternal' end,
                case when p_intern then r.intern_mulai else r.eksternal_mulai end,
                case when p_intern then r.intern_sampai else r.eksternal_sampai end)
  from v_rentang_nomor_dada r;
$$;

create or replace function nomor_dada_sesuai_deret(p_golongan text, p_nomor integer)
returns boolean
language sql stable
set search_path = public
as $$
  -- Sengaja ditulis sebagai perbandingan dua boolean, bukan dua cabang if:
  -- intern harus di atas batas DAN eksternal harus di bawahnya adalah satu
  -- aturan yang sama dibaca dari dua arah. Dua cabang membuka kemungkinan
  -- salah satunya diperbaiki sendirian.
  select (p_golongan in ('intern_pa', 'intern_pi'))
       = (p_nomor >= (select nomor_dada_intern_mulai from edisi where is_active));
$$;

comment on function nomor_dada_sesuai_deret(text, integer) is
  'Benar bila nomor dada berasal dari deret yang sesuai golongannya: Intern di atas edisi.nomor_dada_intern_mulai, Eksternal di bawahnya.';

-- ---------------------------------------------------------------------------
-- 5. daftar_ulang_batch — pintu utama.
--
--    Seluruh isi fungsi disalin ulang dari 0092; yang baru hanya blok
--    pemeriksaan deret di antara "sudah dipakai regu lain" dan advisory lock.
--    Migrasi tidak pernah diedit setelah diterapkan, jadi versi terbaru
--    sebuah RPC memang selalu berada di berkas bernomor besar.
-- ---------------------------------------------------------------------------
create or replace function daftar_ulang_batch(p_kode text, p_nomor jsonb)
returns table (regu_id uuid, nama_regu text, golongan text, nomor_dada integer, kloter smallint)
language plpgsql security definer
set search_path = public
as $$
declare
  v_batch pendaftaran%rowtype;
  v_berhak uuid[];
  v_regu uuid[];
  v_nomor integer[];
  v_n int;
  v_cfg edisi%rowtype;
  v_kandidat smallint;
  v_i int;
  v_salah text;
  v_intern boolean;
begin
  if not boleh('daftar_ulang') then raise exception 'tidak berhak: daftar_ulang'; end if;
  if (select daftar_ulang_ditutup from status_acara) then
    raise exception 'daftar ulang sudah ditutup';
  end if;

  select * into v_cfg from edisi where is_active;
  select * into v_batch from pendaftaran where kode_pembayaran = p_kode for update;
  if not found then raise exception 'kode pembayaran tidak dikenal: %', p_kode; end if;
  if v_batch.status <> 'lunas' then
    raise exception 'batch belum lunas (status: %)', v_batch.status;
  end if;

  select array_agg(r.id order by r.nama_regu, r.id) into v_berhak
  from regu r
  where r.pendaftaran_id = v_batch.id
    and not r.is_cancelled and r.nomor_dada is null;
  v_n := coalesce(array_length(v_berhak, 1), 0);
  if v_n = 0 then
    raise exception 'tidak ada regu yang menunggu nomor dada di batch ini (sudah daftar ulang, atau semua batal)';
  end if;

  select array_agg(x.regu_id order by r.nama_regu, r.id),
         array_agg(x.nomor_dada order by r.nama_regu, r.id)
    into v_regu, v_nomor
  from jsonb_to_recordset(coalesce(p_nomor, '[]'::jsonb))
       as x(regu_id uuid, nomor_dada integer)
  join regu r on r.id = x.regu_id;

  if coalesce(array_length(v_regu, 1), 0) <> v_n
     or (select count(distinct g) from unnest(v_regu) t(g)) <> v_n
     or exists (select 1 from unnest(v_regu) t(g) where not (t.g = any(v_berhak))) then
    raise exception 'nomor dada harus diisi untuk SEMUA % regu batch ini, satu regu satu nomor', v_n;
  end if;
  if exists (select 1 from unnest(v_nomor) t(nomor)
             where t.nomor is null or t.nomor <= 0) then
    raise exception 'nomor dada harus angka lebih besar dari 0';
  end if;
  if (select count(distinct nomor) from unnest(v_nomor) t(nomor)) <> v_n then
    raise exception 'nomor dada yang sama diketik untuk dua regu sekaligus';
  end if;

  perform 1 from nomor_dada_stok s
  where s.nomor = any(v_nomor) order by s.nomor for update;

  select string_agg(distinct nomor::text, ', ' order by nomor::text) into v_salah
  from unnest(v_nomor) t(nomor)
  where not exists (select 1 from nomor_dada_stok s where s.nomor = t.nomor);
  if v_salah is not null then
    raise exception 'nomor dada di luar stok yang disiapkan admin: %', v_salah;
  end if;
  select string_agg(distinct nomor::text, ', ' order by nomor::text) into v_salah
  from unnest(v_nomor) t(nomor)
  where exists (select 1 from nomor_dada_pensiun p where p.nomor = t.nomor);
  if v_salah is not null then
    raise exception 'nomor dada sudah dipensiunkan (bekas tukar) dan tidak boleh terbit lagi: %', v_salah;
  end if;
  select string_agg(distinct nomor::text, ', ' order by nomor::text) into v_salah
  from unnest(v_nomor) t(nomor)
  where exists (select 1 from regu r where r.nomor_dada = t.nomor);
  if v_salah is not null then
    raise exception 'nomor dada sudah dipakai regu lain: %', v_salah;
  end if;

  -- BARU DI 0116. Diperiksa untuk SELURUH baris sekaligus, sama seperti tiga
  -- pemeriksaan di atasnya: petugas mengisi belasan kotak sebelum menekan
  -- Simpan, dan menolaknya satu per satu berarti belasan kali bolak-balik.
  --
  -- Satu batch selalu satu pendaftaran, dan satu pendaftaran selalu satu
  -- jenis peserta — jadi dalam praktiknya cuma satu dari dua pesan ini yang
  -- mungkin muncul. Keduanya tetap ditulis: yang menjaganya golongan REGU,
  -- bukan jenis pendaftarannya, dan keduanya bisa berbeda kalau golongan
  -- diperbaiki manual di kemudian hari.
  for v_intern in select distinct (r.golongan in ('intern_pa', 'intern_pi'))
                  from unnest(v_regu) t(id) join regu r on r.id = t.id
  loop
    select string_agg(distinct x.nomor::text, ', ' order by x.nomor::text) into v_salah
    from (select v_nomor[i] as nomor,
                 (select r.golongan from regu r where r.id = v_regu[i]) as golongan
          from generate_subscripts(v_nomor, 1) i) x
    where (x.golongan in ('intern_pa', 'intern_pi')) = v_intern
      and not nomor_dada_sesuai_deret(x.golongan, x.nomor);
    if v_salah is not null then
      raise exception '% Nomor % ada di deret yang lain.',
        pesan_deret_nomor_dada(v_intern), v_salah;
    end if;
  end loop;

  -- Gerbang ini membuat urutan transaksi daftar ulang sekaligus urutan kloter.
  perform pg_advisory_xact_lock(hashtext('hrcd_daftar_ulang'));

  for v_i in 1..v_n loop
    select r.golongan in ('intern_pa', 'intern_pi') into v_intern
    from regu r where r.id = v_regu[v_i];

    select k.nomor into v_kandidat
    from kloter k
    where k.jam_berangkat is null
      and k.nomor <= v_cfg.kloter_maks
      and (select count(*) from regu r
           where r.kloter_nomor = k.nomor and not r.is_cancelled
             and (r.golongan in ('intern_pa', 'intern_pi')) = v_intern)
          < case when v_intern then v_cfg.maks_intern_per_kloter
                 else v_cfg.maks_eksternal_per_kloter end
    order by k.nomor
    limit 1;

    if v_kandidat is null then
      raise exception 'semua kuota kloter yang belum berangkat penuh — tambah kloter atau periksa konfigurasi';
    end if;

    update regu set
      nomor_dada = v_nomor[v_i],
      kloter_nomor = v_kandidat,
      urutan_kloter = slot_kloter_berikutnya(v_kandidat)
    where id = v_regu[v_i];
  end loop;

  return query
  select r.id, r.nama_regu, r.golongan, r.nomor_dada, r.kloter_nomor
  from regu r where r.id = any(v_regu) order by r.nomor_dada;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. tukar_nomor_dada — pintu kedua, dan yang paling mudah terlupa.
--
--    Disalin dari 0064; yang baru hanya satu blok. Tanpa ini kain Intern yang
--    sobek bisa ditukar dengan nomor Eksternal, dan lubang yang baru saja
--    ditutup terbuka lagi lewat pintu samping.
-- ---------------------------------------------------------------------------
create or replace function tukar_nomor_dada(
  p_regu       uuid,
  p_nomor_baru integer,
  p_alasan     text
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_regu    regu%rowtype;
  v_beredar boolean;
begin
  if not boleh('daftar_ulang') then
    raise exception 'tidak berhak: daftar_ulang';
  end if;
  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'alasan tukar wajib diisi';
  end if;

  select * into v_regu from regu where id = p_regu for update;
  if not found then
    raise exception 'regu tidak ditemukan';
  end if;
  if v_regu.is_cancelled then
    raise exception 'regu berstatus batal';
  end if;
  if v_regu.nomor_dada is null then
    raise exception 'regu belum punya nomor dada';
  end if;

  v_beredar := exists (
    select 1 from kloter where nomor = v_regu.kloter_nomor
      and (dicetak_pada is not null or jam_berangkat is not null));

  if not boleh('pengaturan') and v_beredar then
    raise exception 'kertas kloter ini sudah beredar — tukar nomor hanya lewat admin';
  end if;
  if not exists (select 1 from nomor_dada_stok where nomor = p_nomor_baru) then
    raise exception 'nomor % tidak ada di stok', p_nomor_baru;
  end if;
  if exists (select 1 from regu where nomor_dada = p_nomor_baru)
     or exists (select 1 from nomor_dada_pensiun where nomor = p_nomor_baru) then
    raise exception 'nomor % sudah terpakai / pensiun', p_nomor_baru;
  end if;

  -- BARU DI 0116.
  if not nomor_dada_sesuai_deret(v_regu.golongan, p_nomor_baru) then
    raise exception '% Nomor % ada di deret yang lain.',
      pesan_deret_nomor_dada(v_regu.golongan in ('intern_pa', 'intern_pi')),
      p_nomor_baru;
  end if;

  insert into history (table_name, row_id, regu_id, action, new_value, changed_by)
  values ('regu', p_regu::text, p_regu, 'UPDATE',
          jsonb_build_object('alasan_tukar_nomor', p_alasan,
                             'nomor_lama', v_regu.nomor_dada,
                             'nomor_baru', p_nomor_baru), auth.uid());

  -- Nomor lama dipensiunkan HANYA bila kertasnya sudah beredar (0041), dan
  -- patokannya SATU variabel dengan yang mengatur izin di atas — dua patokan
  -- terpisah untuk pertanyaan yang sama adalah cara mereka mulai berbeda
  -- pendapat, persis yang dibetulkan 0019.
  if v_beredar then
    insert into nomor_dada_pensiun (nomor, reason)
    values (v_regu.nomor_dada, p_alasan);
  end if;

  update regu set nomor_dada = p_nomor_baru where id = p_regu;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Laporkan keadaannya.
-- ---------------------------------------------------------------------------
do $blok$
declare r record;
begin
  select * into r from v_rentang_nomor_dada;
  raise notice '0116: Eksternal % - %, Intern % - % (batas deret %).',
               r.eksternal_mulai, r.eksternal_sampai,
               r.intern_mulai, r.intern_sampai, r.intern_mulai_konfigurasi;

  perform 1 from regu
   where nomor_dada is not null and not nomor_dada_sesuai_deret(golongan, nomor_dada);
  if found then
    for r in
      select nomor_dada, golongan, nama_regu from regu
       where nomor_dada is not null and not nomor_dada_sesuai_deret(golongan, nomor_dada)
       order by nomor_dada
    loop
      raise notice '0116: SUDAH TERLANJUR di deret yang salah — % (% , %)',
                   r.nomor_dada, r.golongan, r.nama_regu;
    end loop;
    raise notice '0116: nomor di atas TIDAK diubah otomatis. Tukar lewat layar '
                 'Daftar Ulang supaya nomor lamanya ikut dipensiunkan bila '
                 'kertasnya sudah beredar.';
  end if;
end;
$blok$;
