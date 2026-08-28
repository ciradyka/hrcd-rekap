-- ============================================================================
-- hrcd-rekap : 0137_riwayat_pendaftaran.sql
--
-- Riwayat perubahan untuk PENDAFTARAN — sejajar dengan v_riwayat_nilai (0042)
-- yang sudah ada untuk nilai pos.
--
-- ---------------------------------------------------------------------------
-- DATANYA SUDAH ADA SEJAK 0002
--
-- Trigger `catat_riwayat()` menempel di `regu`, `pendaftaran`, `pembayaran`,
-- dan `nilai_mentah` — keempatnya, bukan cuma nilai. Setiap INSERT, UPDATE,
-- dan DELETE menulis satu baris `history` berisi SELURUH baris lama dan baru
-- dalam JSON, beserta `changed_by` dan `changed_at`.
--
-- Jadi "siapa menandai lunas", "siapa memberi nomor dada", dan "siapa mengubah
-- nama anggota" sudah tersimpan sejak hari pertama. Yang belum ada cuma cara
-- MELIHATNYA: nilai pos punya v_riwayat_nilai dan centang hijau yang bisa
-- diketuk, tiga layar lainnya tidak punya apa-apa.
--
-- Berkas ini menutup jarak itu, dan tidak menambah satu kolom pun.
--
-- ---------------------------------------------------------------------------
-- YANG BERUBAH, BUKAN SELURUH BARISNYA
--
-- `old_value` dan `new_value` memuat seluruh kolom, dan sebagian besar tidak
-- berubah. Menampilkan keduanya apa adanya berarti petugas membandingkan dua
-- blok JSON dengan mata untuk menemukan satu kolom yang berbeda.
--
-- View ini menghitung SELISIHNYA di database: `perubahan` hanya memuat kolom
-- yang benar-benar berbeda, dengan nilai lama dan barunya berdampingan.
--
-- Kolom yang tidak menjelaskan apa pun dibuang lebih dulu — `id`, kunci asing,
-- dan cap waktu internal. Yang tersisa persis yang ditanyakan orang saat
-- menatap centang hijau.
--
-- ---------------------------------------------------------------------------
-- PAGARNYA MENYALIN YANG SUDAH ADA, BUKAN MEMBUAT YANG BARU
--
-- Siapa boleh melihat riwayat pendaftaran = siapa boleh melihat pendaftaran
-- itu sendiri. Layar Pembayaran, Daftar Ulang, dan Data Peserta masing-masing
-- sudah punya haknya (`pembayaran`, `daftar_ulang`, `pendaftaran`), dan
-- `pengaturan` melihat semuanya.
--
-- Tidak ada fitur baru: satu centang lagi yang harus diingat panitia adalah
-- satu layar yang lumpuh saat lupa dicentang (CLAUDE.md 13.1).
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
  coalesce(a.username, '(tidak dikenal)') as oleh,
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
  'Pagarnya menyalin hak yang sudah ada, tanpa fitur baru.';

grant select on v_riwayat_pendaftaran to authenticated;

-- ---------------------------------------------------------------------------
-- Pagar: view-nya terbaca, menyaring tabel yang benar, dan `perubahan` memang
-- berisi kolom yang berubah SAJA. Diperiksa lewat baris yang dibuat di sini
-- lalu dihapus lagi — migrasi ini berjalan di produksi saat acara berlangsung.
-- ---------------------------------------------------------------------------
do $blok$
declare
  v_kunci uuid := gen_random_uuid();
  v_kode  text;
  v_regu  uuid;
  v_ubah  jsonb;
  v_n     integer;
begin
  select (submit_pendaftaran(
    'SMA Negeri 1 Ciamis', '', false, '081200000137',
    jsonb_build_array(jsonb_build_object(
      'nama_regu', 'UJI RIWAYAT 0137', 'nama_ketua', 'Ketua Lama',
      'golongan', 'intern_pa')),
    0::smallint, v_kunci, null, 'tunai', null) ->> 'kode_pembayaran')
  into v_kode;

  select r.id into v_regu
  from regu r join pendaftaran d on d.id = r.pendaftaran_id
  where d.kode_pembayaran = v_kode;

  update regu set nama_ketua = 'Ketua Baru' where id = v_regu;

  -- View menyaring dengan boleh(), dan migrasi berjalan tanpa kursi pengguna —
  -- jadi yang bisa dibuktikan di sini bentuk datanya, bukan haknya. Haknya
  -- diuji tes 89 yang menempati kursi (CLAUDE.md 13.8).
  select jsonb_object_agg(k.key, jsonb_build_object(
           'lama', h.old_value -> k.key, 'baru', h.new_value -> k.key))
    into v_ubah
  from history h,
       jsonb_object_keys(coalesce(h.new_value, h.old_value)) as k(key)
  where h.table_name = 'regu' and h.regu_id = v_regu and h.action = 'UPDATE'
    and not (k.key = any (array['id','pendaftaran_id','sekolah_id','kunci_kirim',
                                'created_at','dibuat_pada','verified_at',
                                'wahana_id','regu_id','verified_by']))
    and (h.old_value -> k.key) is distinct from (h.new_value -> k.key)
  group by h.id;

  if v_ubah is null or not (v_ubah ? 'nama_ketua') then
    raise exception '0137: perubahan nama ketua tidak tercatat — %', coalesce(v_ubah::text, '<NULL>');
  end if;
  select count(*) into v_n from jsonb_object_keys(v_ubah);
  if v_n <> 1 then
    raise exception '0137: perubahan memuat % kolom, seharusnya 1 — %', v_n, v_ubah;
  end if;

  delete from history where regu_id = v_regu;
  delete from history where table_name = 'pendaftaran'
    and coalesce(new_value ->> 'kunci_kirim', old_value ->> 'kunci_kirim') = v_kunci::text;
  delete from regu where id = v_regu;
  delete from pendaftaran where kunci_kirim = v_kunci;

  raise notice '0137: riwayat pendaftaran terbaca, dan perubahan memuat kolom yang berubah saja.';
end;
$blok$;
