-- ============================================================================
-- hrcd-rekap : 0138_riwayat_pelaku_kosong.sql
--
-- Riwayat pendaftaran: perubahan tanpa pelaku tidak lagi menuliskan
-- "(tidak dikenal)".
--
-- ---------------------------------------------------------------------------
-- APA YANG SEBENARNYA TERJADI DI BARIS ITU
--
-- `history.changed_by` kosong hanya kalau perubahannya TIDAK dilakukan orang:
-- migrasi impor pendaftaran (0129-0132), penyegaran tanggal (0136), dan
-- pekerjaan sejenis berjalan tanpa kursi pengguna. Jadi baris seperti
--
--   Cara bayar   — → transfer
--   (tidak dikenal) · 28 Agustus 2026 05:10
--
-- tidak sedang menyembunyikan siapa pun. Tidak ada siapa pun.
--
-- ---------------------------------------------------------------------------
-- KENAPA DIHAPUS, BUKAN DIGANTI KATA LAIN
--
-- "(tidak dikenal)" terbaca seperti kegagalan sistem mengenali petugas —
-- pertanyaan yang tidak perlu ditanyakan siapa pun, di layar yang dibuka
-- justru untuk MENJAWAB pertanyaan. Menggantinya dengan "sistem" atau "impor"
-- sama saja: satu kata teknis lagi yang harus dipelajari, untuk fakta yang
-- sudah tersampaikan oleh ketiadaan nama (CLAUDE.md 9.6).
--
-- Yang tersisa tanggalnya saja, dan itu memang satu-satunya yang berguna di
-- baris tersebut: KAPAN datanya masuk.
--
-- Perubahannya `null`, bukan string kosong — layar yang merangkai
-- "nama · tanggal" tinggal membuang bagian yang kosong, dan string kosong
-- akan menyisakan titiknya sendirian.
-- ============================================================================

create or replace view v_riwayat_pendaftaran as
with kolom_dibuang as (
  select array[
    'id', 'pendaftaran_id', 'sekolah_id', 'kunci_kirim', 'created_at',
    'dibuat_pada', 'verified_at', 'wahana_id', 'regu_id',
    -- `verified_by` adalah uuid petugas, dan kolom `oleh` di bawah sudah
    -- menerjemahkan uuid itu jadi nama yang bisa dibaca. Menampilkan keduanya
    -- berarti satu baris riwayat berbunyi "Diverifikasi: — -> 0000...b1"
    -- tepat di sebelah "meja1hrcd37" — angka yang tidak menjawab apa pun.
    'verified_by'
  ] as nama
)
select
  h.id,
  d.kode_pembayaran,
  h.regu_id,
  r.nama_regu,
  r.nomor_dada,
  h.table_name,
  h.action,
  -- Hanya kolom yang benar-benar berbeda. INSERT tidak punya nilai lama, jadi
  -- seluruh kolomnya terhitung berubah — itu memang keadaannya, dan di layar
  -- ia terbaca sebagai "baris ini lahir di sini".
  (
    select jsonb_object_agg(k.key, jsonb_build_object(
             'lama', h.old_value -> k.key,
             'baru', h.new_value -> k.key))
    from jsonb_object_keys(coalesce(h.new_value, h.old_value)) as k(key),
         kolom_dibuang b
    where not (k.key = any (b.nama))
      and (h.old_value -> k.key) is distinct from (h.new_value -> k.key)
  ) as perubahan,
  -- TANPA coalesce (0137 memakainya). Lihat kepala berkas: kosong berarti
  -- tidak ada orang yang melakukannya, dan itu tersampaikan lebih baik oleh
  -- ketiadaan nama daripada oleh kata "(tidak dikenal)".
  a.username as oleh,
  h.changed_at
from history h
left join regu r on r.id = h.regu_id
-- Satu baris riwayat harus bisa ditemukan lewat KODE PEMBAYARAN, karena itu
-- yang dipegang ketiga layar. Untuk `pendaftaran` kodenya ada di barisnya
-- sendiri; untuk `regu` dan `pembayaran` ia diambil lewat pendaftaran_id.
join pendaftaran d
  on d.id = coalesce(
       case when h.table_name = 'pendaftaran'
            then coalesce((h.new_value ->> 'id')::uuid, (h.old_value ->> 'id')::uuid) end,
       (h.new_value ->> 'pendaftaran_id')::uuid,
       (h.old_value ->> 'pendaftaran_id')::uuid)
left join akun_panitia a on a.user_id = h.changed_by
where h.table_name in ('pendaftaran', 'regu', 'pembayaran')
  and (boleh('pengaturan') or boleh('pembayaran')
       or boleh('daftar_ulang') or boleh('pendaftaran'));

comment on view v_riwayat_pendaftaran is
  'Riwayat perubahan pendaftaran, regu, dan pembayaran — sejajar dengan '
  'v_riwayat_nilai untuk nilai pos. `perubahan` hanya memuat kolom yang '
  'benar-benar berbeda, jadi layar tidak perlu membandingkan dua blok JSON. '
  '`oleh` NULL berarti tidak ada orang yang melakukannya — migrasi impor, '
  'bukan petugas. Pagarnya menyalin hak yang sudah ada, tanpa fitur baru.';

-- `create or replace view` mempertahankan hak yang sudah diberikan 0137, jadi
-- grant-nya tidak diulang. Ditulis di sini supaya pembaca berikutnya tidak
-- mengira ia terlewat.

-- ---------------------------------------------------------------------------
-- Pagar: perubahan tanpa kursi pengguna benar-benar mengembalikan NULL, bukan
-- kata apa pun. Baris ujinya dibuat di sini lalu dihapus lagi — migrasi ini
-- berjalan di produksi saat acara berlangsung.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_kunci uuid := gen_random_uuid();
  v_kode  text;
  v_regu  uuid;
  v_oleh  text;
  v_ada   boolean;
begin
  select (submit_pendaftaran(
    'SMA Negeri 1 Ciamis', '', false, '081200000138',
    jsonb_build_array(jsonb_build_object(
      'nama_regu', 'UJI RIWAYAT 0138', 'nama_ketua', 'Ketua Lama',
      'golongan', 'intern_pa')),
    0::smallint, v_kunci, null, 'tunai', null) ->> 'kode_pembayaran')
  into v_kode;

  select r.id into v_regu
  from regu r join pendaftaran d on d.id = r.pendaftaran_id
  where d.kode_pembayaran = v_kode;

  update regu set nama_ketua = 'Ketua Baru' where id = v_regu;

  -- Dibaca dari `history` langsung, bukan lewat view-nya: view menyaring
  -- dengan boleh(), dan migrasi berjalan tanpa kursi pengguna. Yang diperiksa
  -- di sini rangkaian join yang sama persis.
  select a.username, true into v_oleh, v_ada
  from history h
  left join akun_panitia a on a.user_id = h.changed_by
  where h.table_name = 'regu' and h.regu_id = v_regu and h.action = 'UPDATE'
  limit 1;

  if not coalesce(v_ada, false) then
    raise exception '0138: perubahan nama ketua tidak tercatat sama sekali';
  end if;
  if v_oleh is not null then
    raise exception '0138: pelaku seharusnya NULL tanpa kursi pengguna, dapat %', v_oleh;
  end if;

  delete from history where regu_id = v_regu;
  delete from history where table_name = 'pendaftaran'
    and coalesce(new_value ->> 'kunci_kirim', old_value ->> 'kunci_kirim') = v_kunci::text;
  delete from regu where id = v_regu;
  delete from pendaftaran where kunci_kirim = v_kunci;

  raise notice '0138: perubahan tanpa pelaku mengembalikan NULL, bukan "(tidak dikenal)".';
end;
$blok$;
