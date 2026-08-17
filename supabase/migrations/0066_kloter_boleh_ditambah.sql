-- ============================================================================
-- hrcd-rekap : 0066_kloter_boleh_ditambah.sql
-- Kloter tidak pernah tertutup untuk penambahan regu.
--
-- KEPUTUSAN PEMILIK ACARA, DAN IA LEBIH TEGAS DARIPADA YANG DIUSULKAN
--
-- CLAUDE.md 12.3 sudah mencatat bahwa kode melanggar aturan lapangan: migrasi
-- 0008 menambahkan `dicetak_pada is null` ke pemilihan kloter, dan usulan
-- perbaikannya waktu itu "ganti syaratnya jadi `jam_berangkat is null`".
--
-- Usulan itu ditolak. Yang diminta: **tidak ada aturan seperti itu sama
-- sekali.**
--
--   "ketika di lapangan semua dinamis, bisa jadi peserta terlambat memaksa
--    untuk berangkat jadi mereka seakan-akan berangkat di jam tersebut. Jadi
--    biarkan saja panitia menambah peserta di depan."
--
-- Jadi kedua syarat dibuang, bukan ditukar. Kloter yang kertasnya sudah
-- dicetak boleh ditambah. Kloter yang SUDAH BERANGKAT pun boleh ditambah, dan
-- regu yang masuk ke sana tercatat berangkat pada jam kloter itu.
--
-- KENAPA PAGAR ITU SALAH SEJAK AWAL
--
-- Ia melindungi kertas, dan kertas bukan yang paling mahal. Yang mahal kloter
-- setengah kosong berangkat sementara ada regu yang menunggu — jendela
-- 07:00-10:00 (CLAUDE.md bagian 10) tidak punya kelonggaran untuk itu.
-- Mencetak ulang selembar daftar itu murah; memberangkatkan kloter dengan
-- empat tempat kosong tidak bisa diulang.
--
-- Dan pagarnya bukan cuma mahal, ia juga tidak menyelesaikan apa pun: petugas
-- yang butuh menambah regu tetap menambahnya, cuma lewat jalan yang tidak
-- tercatat.
--
-- YANG IKUT BERUBAH, DAN PANTAS DIKETAHUI SEBELUM HARI-H
--
-- Penalti waktu dihitung dari `kloter.jam_berangkat`. Regu yang disisipkan ke
-- kloter yang sudah berangkat karena itu dihitung berangkat pada jam kloter
-- tersebut — bukan pada jam ia benar-benar jalan. Itu memang yang diminta
-- ("seakan-akan berangkat di jam tersebut"), tapi konsekuensinya nyata:
-- menyisipkan regu ke kloter yang berangkat dua jam lalu memberinya kontrak
-- yang sudah termakan dua jam. Panitia yang menyisipkan perlu tahu itu; kalau
-- yang dimaksud regu itu berangkat sekarang, tempatnya di kloter yang belum
-- jalan.
--
-- YANG TIDAK IKUT DIBUANG
--
-- Kapasitas per kloter tetap dijaga — kertas boleh dilanggar, jumlah orang
-- yang muat di satu rombongan tidak. Penyebaran sekolah (12.5) juga tetap:
-- urutan putaran pencariannya tidak disentuh sama sekali, hanya syarat
-- penyaringnya yang hilang.
--
-- Dua tempat lain yang MEMBACA `dicetak_pada`/`jam_berangkat` sengaja
-- dibiarkan, karena keduanya bukan larangan:
--   * `pindah_kloter` menandai regu sebagai sisipan dan mengumumkannya bila
--     kertas tujuannya sudah beredar — itu pemberitahuan, bukan penolakan.
--   * `tukar_nomor_dada` menaikkan penukaran ke admin bila kertasnya sudah
--     beredar — itu eskalasi, bukan penolakan.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Trigger penjaganya dibuang.
--
--    `jaga_kloter_tercetak` (0008) menolak SETIAP perubahan `regu.kloter_nomor`
--    yang menyentuh kloter tercetak, dari arah mana pun. Ia dipasang untuk
--    melindungi kertas yang sudah dibagikan — niat yang masuk akal di meja,
--    dan salah di lapangan.
--
--    `pindah_kloter` sampai sekarang membukanya lewat `set_config
--    ('hrcd.izin_pindah', ...)` — pintu darurat untuk pagar yang seharusnya
--    tidak ada. Pemanggilannya dibiarkan (tidak berbahaya, dan menghapusnya
--    berarti mengetik ulang fungsi 135 baris demi satu baris mati).
-- ---------------------------------------------------------------------------
drop trigger if exists jaga_kloter_tercetak on regu;
drop function if exists tolak_ubah_kloter_tercetak();

-- ---------------------------------------------------------------------------
-- 2. Pemilihan kloter: delapan syarat dibuang, sisanya UTUH.
-- ---------------------------------------------------------------------------
create or replace function daftar_ulang_batch(
  p_kode  text,
  -- [{"regu_id": "...", "nomor_dada": 12}, ...] — satu entri per regu yang
  -- belum bernomor di batch ini, tidak boleh kurang dan tidak boleh lebih.
  p_nomor jsonb
)
returns table (regu_id uuid, nama_regu text, golongan text, nomor_dada integer, kloter smallint)
language plpgsql security definer
set search_path = public
as $$
declare
  v_batch      pendaftaran%rowtype;
  v_berhak     uuid[];
  v_regu       uuid[];
  v_nomor      integer[];
  v_n          int;
  v_cfg        edisi%rowtype;
  v_terpakai   int[];      -- kloter yang sudah berisi sekolah ini
  v_kandidat   int;
  v_mulai      int;
  v_i          int;
  v_langkah    int;
  v_salah      text;
begin
  if not boleh('daftar_ulang') then
    raise exception 'tidak berhak: daftar_ulang';
  end if;
  if (select daftar_ulang_ditutup from status_acara) then
    raise exception 'daftar ulang sudah ditutup';
  end if;

  select * into v_cfg from edisi where is_active;

  select * into v_batch from pendaftaran where kode_pembayaran = p_kode for update;
  if not found then
    raise exception 'kode pembayaran tidak dikenal: %', p_kode;
  end if;
  if v_batch.status <> 'lunas' then
    raise exception 'batch belum lunas (status: %)', v_batch.status;
  end if;

  -- Regu yang berhak: belum bernomor, tidak batal (rancangan-b.md, temuan 11).
  select array_agg(r.id order by r.nama_regu, r.id) into v_berhak
  from regu r
  where r.pendaftaran_id = v_batch.id
    and not r.is_cancelled and r.nomor_dada is null;
  v_n := coalesce(array_length(v_berhak, 1), 0);
  if v_n = 0 then
    raise exception 'tidak ada regu yang menunggu nomor dada di batch ini (sudah daftar ulang, atau semua batal)';
  end if;

  -- Pasangan regu -> nomor dari meja. Urutan deterministik (nama regu) supaya
  -- hasil yang dibacakan meja urut sama dengan kartu di layar.
  select array_agg(x.regu_id order by r.nama_regu, r.id),
         array_agg(x.nomor_dada order by r.nama_regu, r.id)
    into v_regu, v_nomor
  from jsonb_to_recordset(coalesce(p_nomor, '[]'::jsonb))
         as x(regu_id uuid, nomor_dada integer)
  join regu r on r.id = x.regu_id;

  if coalesce(array_length(v_regu, 1), 0) <> v_n
     or (select count(distinct g) from unnest(v_regu) as t(g)) <> v_n
     or exists (select 1 from unnest(v_regu) as t(g) where not (t.g = any (v_berhak))) then
    raise exception 'nomor dada harus diisi untuk SEMUA % regu batch ini, satu regu satu nomor', v_n;
  end if;

  if exists (select 1 from unnest(v_nomor) as t(nomor)
             where t.nomor is null or t.nomor <= 0) then
    raise exception 'nomor dada harus angka lebih besar dari 0';
  end if;
  if (select count(distinct t.nomor) from unnest(v_nomor) as t(nomor)) <> v_n then
    raise exception 'nomor dada yang sama diketik untuk dua regu sekaligus';
  end if;

  -- Kunci baris stok yang diminta, urut nomor supaya dua meja yang meminta
  -- himpunan bertumpang tindih tidak saling mengunci silang. Meja kedua
  -- menunggu sebentar lalu ditolak pemeriksaan "sudah dipakai" di bawah,
  -- dengan pesan yang bisa dibaca petugas — bukan galat unique mentah.
  perform 1 from nomor_dada_stok s
  where s.nomor = any (v_nomor)
  order by s.nomor
  for update;

  select string_agg(distinct t.nomor::text, ', ' order by t.nomor::text) into v_salah
  from unnest(v_nomor) as t(nomor)
  where not exists (select 1 from nomor_dada_stok s where s.nomor = t.nomor);
  if v_salah is not null then
    raise exception 'nomor dada di luar stok yang disiapkan admin: %', v_salah;
  end if;

  select string_agg(distinct t.nomor::text, ', ' order by t.nomor::text) into v_salah
  from unnest(v_nomor) as t(nomor)
  where exists (select 1 from nomor_dada_pensiun p where p.nomor = t.nomor);
  if v_salah is not null then
    raise exception 'nomor dada sudah dipensiunkan (bekas tukar) dan tidak boleh terbit lagi: %', v_salah;
  end if;

  select string_agg(distinct t.nomor::text, ', ' order by t.nomor::text) into v_salah
  from unnest(v_nomor) as t(nomor)
  where exists (select 1 from regu r where r.nomor_dada = t.nomor);
  if v_salah is not null then
    raise exception 'nomor dada sudah dipakai regu lain: %', v_salah;
  end if;

  -- Serialisasi bagian penempatan kloter (2-3 meja — advisory lock sederhana
  -- lebih terbaca daripada retry unique-violation; lepas otomatis di akhir tx).
  perform pg_advisory_xact_lock(hashtext('hrcd_daftar_ulang'));

  -- Kloter yang sudah berisi regu sekolah yang sama (batch mana pun).
  select coalesce(array_agg(distinct r.kloter_nomor), '{}') into v_terpakai
  from regu r
  join pendaftaran d on d.id = r.pendaftaran_id
  where d.sekolah_id = v_batch.sekolah_id and r.kloter_nomor is not null;

  -- Sebar N regu: mulai dari kloter termuda yang layak, melompat
  -- lompatan_kloter (alur 5.6); kloter 31.. dibuka hanya bila 1..30 tidak
  -- menyediakan slot layak (alur 5.2). "Layak" = belum penuh + belum berisi
  -- sekolah ini; bila tak terhindarkan, syarat sekolah dilonggarkan (alur 5.4
  -- "sesedikit mungkin", bukan "tidak boleh").
  v_mulai := null;
  for v_i in 1..v_n loop
    v_kandidat := null;

    -- Putaran 1: hormati lompatan + hindari sekolah sama, dalam
    -- 1..kloter_dasar. Tanda cetak dan jam berangkat TIDAK ikut menyaring
    -- (0066) — yang membatasi cuma kapasitas.
    if v_mulai is null then
      v_langkah := 1;  -- pencarian pertama: kloter layak termuda
    else
      v_langkah := v_cfg.lompatan_kloter;
    end if;
    select k.nomor into v_kandidat
    from kloter k
    where k.nomor <= v_cfg.kloter_dasar
      and (v_mulai is null or k.nomor >= v_mulai + v_langkah)
      and not (k.nomor = any (v_terpakai))
      and (select count(*) from regu r where r.kloter_nomor = k.nomor)
          < v_cfg.maks_regu_per_kloter
    order by k.nomor
    limit 1;

    -- Putaran 2: masih hindari sekolah sama tapi abaikan lompatan (wrap).
    if v_kandidat is null then
      select k.nomor into v_kandidat
      from kloter k
      where k.nomor <= v_cfg.kloter_dasar
        and not (k.nomor = any (v_terpakai))
        and (select count(*) from regu r where r.kloter_nomor = k.nomor)
            < v_cfg.maks_regu_per_kloter
      order by k.nomor
      limit 1;
    end if;

    -- Putaran 3: 1..kloter_dasar masih ada tempat tapi semuanya berisi
    -- sekolah ini — sekolah sama boleh berkumpul DULU sebelum membuka
    -- kloter cadangan (alur 5.2: 31-40 hanya bila 1-30 penuh; alur 5.4:
    -- "sesedikit mungkin", bukan larangan mutlak). Pilih yang paling kosong.
    if v_kandidat is null then
      select k.nomor into v_kandidat
      from kloter k
      where k.nomor <= v_cfg.kloter_dasar
        and (select count(*) from regu r where r.kloter_nomor = k.nomor)
            < v_cfg.maks_regu_per_kloter
      order by (select count(*) from regu r where r.kloter_nomor = k.nomor), k.nomor
      limit 1;
    end if;

    -- Putaran 4: kloter dasar benar-benar penuh — buka cadangan
    -- (31..kloter_maks), hindari sekolah sama dulu lalu bebas.
    if v_kandidat is null then
      select k.nomor into v_kandidat
      from kloter k
      where k.nomor between v_cfg.kloter_dasar + 1 and v_cfg.kloter_maks
        and (select count(*) from regu r where r.kloter_nomor = k.nomor)
            < v_cfg.maks_regu_per_kloter
      order by (k.nomor = any (v_terpakai)),   -- false (bebas sekolah) dulu
               (select count(*) from regu r where r.kloter_nomor = k.nomor),
               k.nomor
      limit 1;
    end if;

    if v_kandidat is null then
      raise exception 'semua kloter penuh — tambah kloter atau periksa konfigurasi';
    end if;

    update regu r set
      nomor_dada    = v_nomor[v_i],
      kloter_nomor  = v_kandidat,
      -- Slot terkecil yang kosong, bukan count+1: lubang bekas koreksi admin
      -- tidak boleh membuat slot palsu di atas 10 (temuan review).
      urutan_kloter = (select min(s) from generate_series(1, v_cfg.maks_regu_per_kloter) s
                       where not exists (select 1 from regu x
                                         where x.kloter_nomor = v_kandidat
                                           and x.urutan_kloter = s))
    where r.id = v_regu[v_i];

    v_terpakai := v_terpakai || v_kandidat;
    v_mulai := v_kandidat;
  end loop;

  return query
  select r.id, r.nama_regu, r.golongan, r.nomor_dada, r.kloter_nomor
  from regu r
  where r.id = any (v_regu)
  order by r.nomor_dada;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Buktikan pagarnya benar-benar hilang, di database ini, sekarang.
--
--    Bukan sekadar "tidak ada lagi kata dicetak_pada di sumbernya" — itu bisa
--    benar sementara trigger lamanya masih terpasang dari migrasi terdahulu.
-- ---------------------------------------------------------------------------
do $blok$
declare v_n int;
begin
  select count(*) into v_n from pg_trigger
   where tgname = 'jaga_kloter_tercetak' and not tgisinternal;
  assert v_n = 0, 'trigger jaga_kloter_tercetak masih terpasang';

  select count(*) into v_n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'daftar_ulang_batch'
     and p.prosrc ~ 'dicetak_pada is null|jam_berangkat is null';
  assert v_n = 0, 'daftar_ulang_batch masih menyaring kloter tercetak/berangkat';

  raise notice '0066: pagar kloter tercetak/berangkat sudah tidak ada.';
end $blok$;

do $blok$
declare r record;
begin
  for r in
    select k.nomor, k.dicetak_pada is not null as tercetak,
           k.jam_berangkat is not null as berangkat,
           (select count(*) from regu x where x.kloter_nomor = k.nomor
              and not x.is_cancelled) as isi
      from kloter k
     where k.dicetak_pada is not null or k.jam_berangkat is not null
     order by k.nomor limit 5
  loop
    raise notice '0066: kloter % (tercetak=%, berangkat=%) berisi % regu — sekarang masih bisa ditambah',
      r.nomor, r.tercetak, r.berangkat, r.isi;
  end loop;
end $blok$;

