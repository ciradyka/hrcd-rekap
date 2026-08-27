-- ============================================================================
-- hrcd-rekap : 0113_planning_berangkat_tersimpan.sql
-- Jendela Planning Keberangkatan disimpan, bukan hilang tiap layar dimuat ulang.
--
-- ---------------------------------------------------------------------------
-- KENAPA DI `status_acara`, BUKAN DI `edisi`
--
-- Kolom yang "benar" secara arti adalah `edisi.jam_mulai_berangkat` dan
-- `jam_batas_berangkat` — CLAUDE.md 10.7 memang menempatkan jendela sebagai
-- konfigurasi per edisi. Tetapi seluruh tabel konfigurasi dijaga trigger
-- `tolak_saat_terkunci` (0002): `edisi`, `pos`, `wahana`, `kontrak_opsi`,
-- `konfig_penalti`. Begitu `konfigurasi_terkunci` menyala — dan ia MEMANG
-- menyala pada hari-H — setiap tulisan ke sana ditolak.
--
-- Planning keberangkatan justru keputusan hari-H. Ia disusun sesudah nomor
-- dada dibagikan dan digeser lagi sampai semua selesai daftar ulang.
-- Menyimpannya di tabel terkunci berarti fitur ini mati tepat di hari ia
-- dipakai, dengan pesan galat yang menyuruh panitia membuka kunci konfigurasi
-- di tengah pagi — persis hal yang kunci itu dipasang untuk mencegah.
--
-- `status_acara` adalah saklar hari-H, dan ia satu-satunya tabel setelan yang
-- TIDAK dijaga trigger itu — memang tidak boleh, karena `konfigurasi_terkunci`
-- sendiri tinggal di sana dan tabel yang mengunci dirinya tidak bisa dibuka.
--
-- ---------------------------------------------------------------------------
-- NULL BERARTI "IKUT KONFIGURASI EDISI"
--
-- Keduanya boleh kosong, dan itu keadaan awal setiap edisi. Layar membacanya
-- `coalesce(planning, edisi.jam_*)`, jadi selama panitia belum menggeser apa
-- pun hasilnya sama persis dengan sebelum migrasi ini — dan sama di semua
-- alat, karena sumbernya satu.
--
-- Yang disimpan HANYA jendelanya, bukan jam tiap kloter. Jam per kloter
-- diturunkan dari jendela dan dari kloter yang ada saat itu; menyimpannya
-- berarti dua sumber untuk satu angka, dan yang satu akan basi begitu ada
-- regu disisipkan.
-- ============================================================================

alter table status_acara
  add column if not exists planning_berangkat_pertama  time,
  add column if not exists planning_berangkat_terakhir time;

alter table status_acara drop constraint if exists status_acara_planning_urut;
alter table status_acara add constraint status_acara_planning_urut check (
  planning_berangkat_pertama is null
  or planning_berangkat_terakhir is null
  or planning_berangkat_terakhir > planning_berangkat_pertama
);

comment on column status_acara.planning_berangkat_pertama is
  'Jendela Planning Keberangkatan di layar Daftar Kloter. NULL = ikut edisi.jam_mulai_berangkat.';
comment on column status_acara.planning_berangkat_terakhir is
  'Jendela Planning Keberangkatan di layar Daftar Kloter. NULL = ikut edisi.jam_batas_berangkat.';

-- ---------------------------------------------------------------------------
-- RPC penyimpannya.
--
-- Bentuknya menyalin `atur_fase_live` (0068/0069): definer, pagar hak di baris
-- pertama, satu UPDATE berklausa WHERE.
--
-- HAKNYA `cetak_kloter`, bukan `pengaturan`. Yang menyusun planning adalah
-- orang yang mencetak daftar kloter — tombolnya ada di layar yang sama — dan
-- mengikatnya ke `pengaturan` berarti hanya admin yang bisa menggeser jadwal
-- pagi. `pengaturan` tetap ikut, karena admin memang membuka semua layar.
--
-- Policy `adm_status_acara` sendiri masih `boleh('pengaturan')` dan TIDAK
-- diubah: jalur langsung ke tabel tetap milik admin, dan RPC inilah satu-
-- satunya pintu yang lebih longgar. Definer supaya pagar di dalamnya yang
-- berlaku, bukan policy tabelnya.
-- ---------------------------------------------------------------------------
create or replace function atur_planning_berangkat(p_pertama time, p_terakhir time)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not boleh_apa_saja('cetak_kloter', 'pengaturan') then
    raise exception 'tidak berhak: cetak_kloter';
  end if;
  if p_pertama is null or p_terakhir is null then
    raise exception 'jam planning wajib diisi keduanya';
  end if;
  if p_terakhir <= p_pertama then
    raise exception 'waktu berangkat terakhir harus setelah waktu pertama';
  end if;

  -- WHERE yang memang berarti: `status_acara` satu baris berkunci `id = true`,
  -- dan UPDATE tanpa WHERE ditolak Supabase (CLAUDE.md 14.6) sementara
  -- database uji tidak memasang `safeupdate` — tanpa klausa ini tesnya hijau
  -- dan RPC-nya gagal di layar.
  update status_acara
  set planning_berangkat_pertama  = p_pertama,
      planning_berangkat_terakhir = p_terakhir
  where id = true;
end;
$$;

comment on function atur_planning_berangkat(time, time) is
  'Simpan jendela Planning Keberangkatan. Hak cetak_kloter atau pengaturan.';

revoke execute on function atur_planning_berangkat(time, time) from public, anon;
grant execute on function atur_planning_berangkat(time, time) to authenticated;

do $blok$
begin
  assert exists (select 1 from information_schema.columns
                 where table_name = 'status_acara'
                   and column_name = 'planning_berangkat_pertama'),
    '0113: kolom planning tidak terpasang';

  raise notice '0113: jendela Planning Keberangkatan kini tersimpan di '
               'status_acara — di luar jangkauan kunci konfigurasi.';
end;
$blok$;
