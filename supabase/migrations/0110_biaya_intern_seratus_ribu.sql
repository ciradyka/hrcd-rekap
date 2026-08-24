-- ============================================================================
-- hrcd-rekap : 0110_biaya_intern_seratus_ribu.sql
--
-- REGU INTERN MEMBAYAR Rp 100.000; EKSTERNAL TETAP Rp 175.000.
--
-- Keputusan pemilik acara. Peserta internal berasal dari SMAN 1 Ciamis dan
-- hanya dinilai dari lima Soal Tulis serta ketepatan waktu (migrasi 0091),
-- jadi biayanya pun berdiri sendiri.
--
-- ---------------------------------------------------------------------------
-- KENAPA TIDAK CUKUP MENGGANTI SATU ANGKA LAGI SEPERTI 0084
--
-- 0084 menulis bahwa "satu angka, dan itu memang cukup": tagihan tidak pernah
-- disimpan, ia dihitung ulang sebagai `jumlah_regu * biaya_per_regu` di mana
-- pun ia dibaca. Kalimat itu benar selama SELURUH regu berharga sama. Sejak
-- hari ini tidak lagi, jadi yang berubah bukan angkanya melainkan
-- PERKALIANNYA: tagihan sekarang adalah JUMLAH harga tiap regu, dan harga
-- tiap regu ditentukan golongannya.
--
-- Perkaliannya hidup di empat tempat, dan semuanya harus ikut atau tidak sama
-- sekali — kalau layar menghitung lain dari server, `verifikasi_pembayaran`
-- menolak setiap pembayaran dengan "nominal X tidak sama dengan tagihan Y"
-- dan Meja Pembayaran berhenti total:
--
--   1. `submit_pendaftaran`    -> `total_tagihan` yang dibaca pembina
--   2. `verifikasi_pembayaran` -> pagar nominal di Meja Pembayaran
--   3. `v_edisi_publik`        -> angka yang dipakai form pendaftaran
--   4. layar (app.js, daftar.js) -> tagihan, rincian, dan kwitansi
--
-- Migrasi ini menutup 1-3 dan menyediakan kolom untuk 4.
--
-- ---------------------------------------------------------------------------
-- SATU FUNGSI, BUKAN `case` YANG DISALIN
--
-- `biaya_regu(golongan)` adalah satu-satunya tempat di database yang tahu
-- golongan mana yang berharga intern. Menyalin `case when golongan in (...)`
-- ke tiap pemanggil berarti edisi berikutnya yang menambah golongan harus
-- menemukan setiap salinannya — dan yang terlewat tidak menimbulkan galat apa
-- pun, cuma tagihan yang salah di satu layar.
--
-- ---------------------------------------------------------------------------
-- `not is_cancelled`, DAN INI SEKALIGUS MENUTUP SATU CACAT YANG TERPENDAM
--
-- Perkalian lama memakai `pendaftaran.jumlah_regu` — angka yang ditulis sekali
-- saat pendaftaran dikirim dan tidak pernah turun. Layar Meja Pembayaran
-- selalu menghitung dari regu yang MASIH AKTIF (`reguAktif` di app.js).
-- Selama tidak ada regu yang dibatalkan keduanya sama, dan memang belum
-- pernah ada: tidak satu pun RPC menyalakan `is_cancelled`. Tetapi pada hari
-- pertama seseorang menyalakannya lewat admin untuk batch yang BELUM bayar,
-- layar mengirim nominal untuk regu yang tersisa sementara server menagih
-- regu yang sudah batal — pembayaran sekolah itu ditolak dan tidak ada jalan
-- maju di layar. `tagihan_pendaftaran` menghitung dari regu aktif, sama
-- dengan layarnya.
--
-- ---------------------------------------------------------------------------
-- KONFIGURASI HARUS TIDAK TERKUNCI
--
-- Trigger `kunci_edisi` (0002) menolak setiap tulisan ke `edisi` selama
-- `status_acara.konfigurasi_terkunci` menyala. Ditangkap di awal supaya yang
-- menjalankan migrasi ini membaca nama saklarnya, bukan pesan trigger yang
-- menyebut layar Konfigurasi.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Pagar: berhenti sebelum menyentuh apa pun.
-- ---------------------------------------------------------------------------
do $blok$
begin
  if (select konfigurasi_terkunci from status_acara) then
    raise exception '0110: konfigurasi sedang terkunci — buka kuncinya di '
      'status_acara dulu, lalu jalankan ulang migrasi ini.';
  end if;
end;
$blok$;

-- ---------------------------------------------------------------------------
-- 2. Kolom harga kedua.
--
--    Ditambahkan kosong lalu diisi dari harga yang sedang berlaku, supaya
--    edisi mana pun di database mana pun tetap menagih persis seperti
--    sebelumnya. Yang benar-benar berganti harga cuma edisi 37, dan itu
--    ditulis terpisah di bawah.
--
--    DEFAULT-nya WAJIB ADA, dan alasannya bukan kerapian. `supabase/seed.sql`
--    menyisipkan edisi 37 dengan daftar kolom yang ditulis lengkap, dan daftar
--    itu tidak menyebut kolom ini — tidak bisa menyebutnya, karena di
--    `tests/run.sh` seed berjalan jauh SEBELUM berkas ini dan kolomnya belum
--    lahir. `tests/dev_database.sh` berjalan terbalik: seluruh glob migrasi
--    dulu, seed sesudahnya. Tanpa DEFAULT, insert itu menabrak not-null dan
--    skrip yang dipakai maintainer menyiapkan database dev berhenti di sana —
--    sesudah ia sempat men-drop `hrcd_dev`. CI tidak akan pernah melihatnya:
--    sql-tests.yml cuma menjalankan run.sh, yang urutannya kebetulan aman.
--
--    Ketiga kolom `edisi` yang pernah ditambahkan sesudah 0001 memakai pola
--    yang sama persis (0009 `jam_mulai_berangkat`, 0053 `jam_batas_berangkat`,
--    0092) — ini yang pertama yang hampir tidak.
--
--    DEFAULT dipasang SESUDAH pengisian di bawah, dan urutan itu berarti:
--    kalau ia ikut di `add column`, SELURUH edisi yang sudah ada di database
--    langsung berharga 100.000, termasuk edisi lama yang biayanya cuma satu.
-- ---------------------------------------------------------------------------
alter table edisi add column if not exists biaya_per_regu_intern integer;

update edisi set biaya_per_regu_intern = biaya_per_regu
where biaya_per_regu_intern is null;

alter table edisi alter column biaya_per_regu_intern set default 100000;

alter table edisi alter column biaya_per_regu_intern set not null;

alter table edisi drop constraint if exists edisi_biaya_per_regu_intern_check;
alter table edisi add constraint edisi_biaya_per_regu_intern_check
  check (biaya_per_regu_intern >= 0);

comment on column edisi.biaya_per_regu_intern is
  'Biaya pendaftaran per regu untuk golongan intern_pa dan intern_pi; golongan lain memakai biaya_per_regu.';

update edisi set biaya_per_regu_intern = 100000 where nomor = 37;

-- ---------------------------------------------------------------------------
-- 3. Harga satu regu, dan tagihan satu pendaftaran.
-- ---------------------------------------------------------------------------
create or replace function biaya_regu(p_golongan text)
returns integer
language sql stable
as $$
  select case when p_golongan in ('intern_pa', 'intern_pi')
              then biaya_per_regu_intern
              else biaya_per_regu
         end
  from edisi where is_active
$$;

comment on function biaya_regu(text) is
  'Biaya pendaftaran satu regu menurut golongannya, dari edisi yang aktif. Satu-satunya tempat yang tahu golongan mana yang berharga intern.';

create or replace function tagihan_pendaftaran(p_pendaftaran uuid)
returns integer
language sql stable
as $$
  select coalesce(sum(biaya_regu(r.golongan)), 0)::integer
  from regu r
  where r.pendaftaran_id = p_pendaftaran
    and not r.is_cancelled
$$;

comment on function tagihan_pendaftaran(uuid) is
  'Total tagihan satu batch pendaftaran: jumlah biaya_regu() seluruh regu yang belum dibatalkan.';

-- ---------------------------------------------------------------------------
-- 4. Form pendaftaran publik ikut melihat harga kedua.
--
--    Kolom baru DITARUH DI UJUNG. `create or replace view` menuntut kolom
--    lama tetap pada nama dan urutan yang sama; menyelipkan harga intern di
--    sebelah `biaya_per_regu` — yang terbaca lebih rapi — membuat perintah ini
--    gagal seketika.
-- ---------------------------------------------------------------------------
create or replace view v_edisi_publik as
select nomor, name, biaya_per_regu, tanggal_lomba, biaya_per_regu_intern
from edisi where is_active;

-- ---------------------------------------------------------------------------
-- 5. Salinan terakhir submit_pendaftaran (0091); yang berubah hanya kedua
--    perhitungan `total_tagihan`.
-- ---------------------------------------------------------------------------
create or replace function submit_pendaftaran(
  p_nama_sekolah   text,
  p_alamat_sekolah text,
  p_butuh_barak    boolean,
  p_kontak_wa      text,
  p_regu           jsonb,
  p_jumlah_pendamping smallint default 0,
  p_kunci_kirim    uuid default null,
  p_nama_kontak    text default null
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_sekolah  uuid;
  v_batch    uuid;
  v_kode     text;
  v_n        int;
  v_r        jsonb;
  v_ada      pendaftaran%rowtype;
begin
  if p_kunci_kirim is not null then
    select * into v_ada from pendaftaran where kunci_kirim = p_kunci_kirim;
    if found then
      return jsonb_build_object(
        'kode_pembayaran', v_ada.kode_pembayaran,
        'jumlah_regu', v_ada.jumlah_regu,
        'total_tagihan', tagihan_pendaftaran(v_ada.id),
        'terkirim_ulang', true);
    end if;
  end if;

  v_n := jsonb_array_length(p_regu);
  if v_n is null or v_n < 1 then
    raise exception 'minimal satu regu';
  end if;
  if v_n > 30 then
    raise exception 'maksimal 30 regu per pendaftaran';
  end if;
  if p_kontak_wa is null or length(trim(p_kontak_wa)) < 8 then
    raise exception 'kontak WA wajib diisi';
  end if;
  if coalesce(trim(p_nama_sekolah), '') = '' then
    raise exception 'nama sekolah wajib diisi';
  end if;

  for v_r in select * from jsonb_array_elements(p_regu) loop
    if coalesce(trim(v_r ->> 'nama_regu'), '') = '' then
      raise exception 'nama regu wajib diisi';
    end if;
    if coalesce(trim(v_r ->> 'nama_ketua'), '') = '' then
      raise exception 'nama ketua wajib diisi';
    end if;
    if coalesce(v_r ->> 'golongan', '') not in (
      'penegak_pa', 'penegak_pi', 'penggalang_pa', 'penggalang_pi',
      'intern_pa', 'intern_pi'
    ) then
      raise exception 'golongan tidak dikenal: %', coalesce(v_r ->> 'golongan', '(kosong)');
    end if;
  end loop;

  select id into v_sekolah from sekolah
   where kunci_sekolah(name) = kunci_sekolah(p_nama_sekolah);

  if v_sekolah is null then
    insert into sekolah (name, address)
    values (trim(p_nama_sekolah), trim(coalesce(p_alamat_sekolah, '')))
    on conflict (kunci_sekolah(name)) do nothing
    returning id into v_sekolah;

    if v_sekolah is null then
      select id into v_sekolah from sekolah
       where kunci_sekolah(name) = kunci_sekolah(p_nama_sekolah);
    end if;
  end if;

  loop
    v_kode := 'HRCD' || edisi_aktif() || '-' ||
              upper(substr(md5(gen_random_uuid()::text), 1, 6));
    exit when not exists (select 1 from pendaftaran where kode_pembayaran = v_kode);
  end loop;

  insert into pendaftaran (sekolah_id, kode_pembayaran, butuh_barak,
                           jumlah_pendamping, jumlah_regu, kontak_wa, kunci_kirim, nama_kontak)
  values (v_sekolah, v_kode, coalesce(p_butuh_barak, false),
          greatest(coalesce(p_jumlah_pendamping, 0), 0), v_n, trim(p_kontak_wa),
          p_kunci_kirim, nullif(trim(coalesce(p_nama_kontak, '')), ''))
  returning id into v_batch;

  insert into regu (pendaftaran_id, nama_regu, nama_ketua, golongan)
  select v_batch, trim(r ->> 'nama_regu'), trim(r ->> 'nama_ketua'), r ->> 'golongan'
  from jsonb_array_elements(p_regu) r;

  return jsonb_build_object(
    'kode_pembayaran', v_kode,
    'jumlah_regu', v_n,
    'total_tagihan', tagihan_pendaftaran(v_batch),
    'terkirim_ulang', false);
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Salinan terakhir verifikasi_pembayaran (0064); yang berubah hanya baris
--    yang menghitung tagihan.
--
--    Bunyi penolakannya DIPERTAHANKAN PERSIS. api.js mengenalinya lewat
--    /nominal .* tidak sama dengan tagihan/i untuk mengganti galat Postgres
--    dengan kalimat yang bisa ditindaklanjuti petugas; menyusun ulang
--    kalimatnya mengembalikan pesan mentah ke layar tanpa satu pun tes
--    berubah warna.
-- ---------------------------------------------------------------------------
create or replace function verifikasi_pembayaran(
  p_kode    text,
  p_nominal integer,
  p_metode  text
) returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_batch     pendaftaran%rowtype;
  v_tagihan   integer;
  v_kwitansi  text;
begin
  if not boleh('pembayaran') then
    raise exception 'tidak berhak: pembayaran';
  end if;

  select * into v_batch from pendaftaran where kode_pembayaran = p_kode for update;
  if not found then
    raise exception 'kode pembayaran tidak dikenal: %', p_kode;
  end if;
  if v_batch.status <> 'menunggu_pembayaran' then
    raise exception 'batch berstatus %, bukan menunggu_pembayaran', v_batch.status;
  end if;

  -- Semua-atau-tidak: nominal harus pas seluruh batch (alur 3.5).
  v_tagihan := tagihan_pendaftaran(v_batch.id);
  if p_nominal <> v_tagihan then
    raise exception 'nominal % tidak sama dengan tagihan % — pembayaran sebagian tidak dilayani; sarankan daftar batch lebih kecil',
      p_nominal, v_tagihan;
  end if;

  v_kwitansi := 'KW-HRCD' || edisi_aktif() || '-' ||
                lpad(nextval('kwitansi_seq')::text, 4, '0');

  insert into pembayaran (pendaftaran_id, amount, method, nomor_kwitansi, verified_by)
  values (v_batch.id, p_nominal, p_metode, v_kwitansi, auth.uid());

  update pendaftaran set status = 'lunas' where id = v_batch.id;

  return jsonb_build_object('nomor_kwitansi', v_kwitansi);
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. Laporan penutup.
--
--    Sama seperti 0084: batch yang SUDAH lunas menyimpan nominal yang
--    benar-benar dibayar di `pembayaran.amount`, jadi kwitansi lama tidak
--    berubah. Yang belum bayar otomatis beralih ke harga baru.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_eksternal integer;
  v_intern    integer;
  v_lunas     integer;
begin
  select biaya_per_regu, biaya_per_regu_intern
    into v_eksternal, v_intern
  from edisi where nomor = 37;

  if not found then
    raise notice '0110: edisi 37 tidak ada di database ini — harganya dilewati.';
    return;
  end if;

  assert v_intern = 100000, format('0110: biaya intern masih %s', v_intern);

  select count(*) into v_lunas from pendaftaran where status = 'lunas';
  -- Angkanya polos, tanpa pemisah ribuan — alasannya di 0084.
  raise notice '0110: biaya per regu Eksternal Rp %, Intern Rp %. '
               'Batch berstatus lunas: % (kwitansinya tetap menyebut nominal '
               'yang dibayar).', v_eksternal, v_intern, v_lunas;
end;
$blok$;
