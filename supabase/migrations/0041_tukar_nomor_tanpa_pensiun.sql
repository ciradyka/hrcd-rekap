-- ============================================================================
-- hrcd-rekap : 0041_tukar_nomor_tanpa_pensiun.sql
--
-- Menukar nomor dada tidak lagi selalu memensiunkan nomor lama.
--
-- ---------------------------------------------------------------------------
-- YANG SALAH
--
-- `tukar_nomor_dada` SELALU memasukkan nomor lama ke `nomor_dada_pensiun`,
-- dan nomor pensiun ditolak selamanya oleh `daftar_ulang_batch` maupun oleh
-- fungsi ini sendiri. Alasannya masuk akal untuk satu keadaan: lembar yang
-- sudah tercetak masih menuliskan nomor lama, jadi nomor itu tidak boleh
-- terbit ulang ke regu lain.
--
-- Tapi ia berlaku untuk SEMUA keadaan, termasuk yang paling sering: petugas
-- meja salah ketik satu digit. Kain nomor lama masih utuh di kardus, belum
-- pernah dipakai siapa pun, belum tercetak di lembar mana pun — dan ia mati
-- permanen. Regu yang benar-benar memegang kain itu nanti ditolak sistem, dan
-- tidak ada satu pun layar yang bisa menghidupkannya kembali.
--
-- Itu menjadikan satu-satunya tombol pembetulan di layar Daftar Ulang lebih
-- merugikan daripada kesalahan yang diperbaikinya.
--
-- ---------------------------------------------------------------------------
-- YANG DIPERTAHANKAN, DAN KENAPA
--
-- Pemensiunan tetap berjalan bila kertas kloternya SUDAH DICETAK atau kloternya
-- sudah berangkat — patokan yang sama persis dengan yang sudah dipakai fungsi
-- ini untuk memutuskan siapa boleh menukar.
--
-- Alasannya menguat sejak form per lomba dipakai: slip yang ditulis petugas di
-- wahana hanya memuat NOMOR DADA, tanpa nama regu. Kalau 001 terbit ulang ke
-- regu lain, slip bertuliskan 001 tidak bisa lagi dipastikan milik siapa —
-- lembar lama menyebut satu nama, kenyataan menyebut nama lain, dan tidak ada
-- apa pun di kertas yang membedakannya.
--
-- ---------------------------------------------------------------------------
-- SATU PATOKAN, BUKAN DUA
--
-- "Apakah kertas sudah beredar" kini dihitung sekali ke dalam v_beredar dan
-- dipakai oleh izin maupun pemensiunan. Dua salinan syarat yang sama adalah
-- cara mereka mulai berbeda pendapat — dan itu persis cacat yang dibetulkan
-- 0019, ketika izin memakai jam_berangkat sementara komentarnya bicara soal
-- kertas dicetak.
--
-- Badan fungsinya disalin dari 0019 oleh skrip, dengan tiga tambalan yang
-- diperiksa jumlahnya.
-- ============================================================================

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
  if peran() not in ('admin', 'meja') then
    raise exception 'hanya meja/admin';
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
  -- Begitu kertasnya DICETAK, lembar yang beredar memakai nomor lama —
  -- penukaran hanya boleh oleh admin yang paham konsekuensinya. Keberangkatan
  -- ikut dihitung karena kloter yang sudah jalan pasti kertasnya beredar,
  -- walau tanda cetaknya sempat dibatalkan (batalkan_tanda_cetak tidak
  -- memeriksa keberangkatan sama sekali).
  v_beredar := exists (
    select 1 from kloter where nomor = v_regu.kloter_nomor
      and (dicetak_pada is not null or jam_berangkat is not null));

  if peran() <> 'admin' and v_beredar then
    raise exception 'kertas kloter ini sudah beredar — tukar nomor hanya lewat admin';
  end if;
  if not exists (select 1 from nomor_dada_stok where nomor = p_nomor_baru) then
    raise exception 'nomor % tidak ada di stok', p_nomor_baru;
  end if;
  if exists (select 1 from regu where nomor_dada = p_nomor_baru)
     or exists (select 1 from nomor_dada_pensiun where nomor = p_nomor_baru) then
    raise exception 'nomor % sudah terpakai / pensiun', p_nomor_baru;
  end if;

  insert into history (table_name, row_id, regu_id, action, new_value, changed_by)
  values ('regu', p_regu::text, p_regu, 'UPDATE',
          jsonb_build_object('alasan_tukar_nomor', p_alasan,
                             'nomor_lama', v_regu.nomor_dada,
                             'nomor_baru', p_nomor_baru), auth.uid());

  -- Nomor lama dipensiunkan HANYA bila kertasnya sudah beredar.
  --
  -- Dulu selalu, dan itu menghukum kasus yang paling sering: petugas meja
  -- salah ketik satu digit, lalu kain nomor lama yang masih utuh di kardus
  -- ikut mati — regu yang benar-benar memegangnya nanti ditolak permanen.
  --
  -- Sesudah kertas beredar ceritanya lain, dan justru makin genting sejak
  -- form per lomba dipakai: slip yang ditulis petugas hanya memuat NOMOR DADA.
  -- Kalau 001 terbit ulang ke regu lain, slip bertuliskan 001 tidak bisa lagi
  -- dipastikan milik siapa — lembar lama menyebut Melati, kenyataan menyebut
  -- orang lain, dan tidak ada apa pun di kertas yang membedakannya.
  --
  -- Patokannya SATU variabel dengan yang mengatur izin di atas. Dua patokan
  -- terpisah untuk pertanyaan yang sama ("apakah kertas sudah beredar") adalah
  -- cara mereka mulai berbeda pendapat — persis yang dibetulkan 0019.
  if v_beredar then
    insert into nomor_dada_pensiun (nomor, reason)
    values (v_regu.nomor_dada, p_alasan);
  end if;

  update regu set nomor_dada = p_nomor_baru where id = p_regu;
end;
$$;
