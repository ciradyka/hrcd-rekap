-- ============================================================================
-- hrcd-rekap : 0017_koreksi_jam_berangkat.sql
--
-- Membetulkan jam berangkat kloter yang sudah terlanjur tercatat.
--
-- KENAPA PERLU FUNGSI BARU. Yang ada sekarang tidak menutup kasus ini:
--
--   berangkatkan_kloter   menolak kloter yang jam_berangkat-nya sudah terisi
--                         ('kloter % sudah berangkat'), jadi tidak bisa dipakai
--                         untuk membetulkan.
--   batalkan_keberangkatan hanya admin, dan hanya untuk kloter berangkat
--                         TERAKHIR. Salah ketik jam justru biasanya baru
--                         ketahuan setelah kloter berikutnya jalan — persis
--                         saat fungsi itu sudah tidak bisa dipakai lagi.
--
-- KENAPA INI PENTING. jam_berangkat bukan sekadar catatan. Penalti waktu
-- dihitung di v_nilai_regu sebagai selisih jam_datang terhadap
-- (jam_berangkat + kontrak_menit). Satu digit salah ketik menggeser penalti
-- SELURUH regu di kloter itu, tanpa galat apa pun, dan baru ketahuan saat
-- klasemen keluar. Karena angkanya dihitung di view dan tidak disimpan,
-- membetulkan jam_berangkat langsung membetulkan seluruh penilaian kloter —
-- tidak ada yang perlu dihitung ulang.
--
-- SIAPA YANG BOLEH. meja/admin, sama dengan berangkatkan_kloter. Membatasinya
-- ke admin saja terdengar lebih aman tapi tidak: meja sudah memegang wewenang
-- MENETAPKAN jam itu di awal, jadi mengunci KOREKSI-nya lebih ketat daripada
-- penetapannya hanya berarti pencatat harus mencari admin di tengah lomba —
-- dan koreksi yang harus menunggu adalah koreksi yang tidak pernah terjadi.
-- Sebagai gantinya alasan wajib diisi dan tercatat di history bersama jam
-- lamanya, jadi perubahannya selalu bisa ditelusuri.
-- ============================================================================

create or replace function koreksi_jam_berangkat(
  p_kloter smallint,
  p_jam    timestamptz,
  p_alasan text
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_lama    timestamptz;
  v_tetangga smallint;
begin
  if peran() not in ('admin', 'meja') then
    raise exception 'hanya meja/admin';
  end if;
  if p_jam is null then
    raise exception 'jam berangkat wajib diketik';
  end if;
  if coalesce(trim(p_alasan), '') = '' then
    raise exception 'alasan koreksi wajib diisi';
  end if;

  select jam_berangkat into v_lama from kloter where nomor = p_kloter;
  if not found then
    raise exception 'kloter % tidak ada', p_kloter;
  end if;
  if v_lama is null then
    raise exception 'kloter % belum berangkat — pakai tombol Berangkatkan, bukan koreksi', p_kloter;
  end if;
  -- Tidak berubah: jangan tulis baris audit palsu yang nanti membingungkan
  -- orang yang menelusuri riwayat.
  if p_jam = v_lama then
    return;
  end if;

  -- Kloter berangkat berurutan, jadi jamnya ikut menaik. Koreksi yang
  -- melanggar urutan itu hampir selalu salah ketik yang KEDUA (mau membetulkan
  -- 07.40, malah terketik 08.40). Ditolak di sini, karena kalau lolos ia
  -- menghasilkan penalti negatif yang tampak wajar di layar.
  select k.nomor into v_tetangga
  from kloter k
  where k.nomor < p_kloter and k.jam_berangkat is not null and k.jam_berangkat > p_jam
  order by k.nomor desc limit 1;
  if v_tetangga is not null then
    raise exception 'jam koreksi lebih awal daripada kloter % yang berangkat sebelumnya', v_tetangga;
  end if;

  select k.nomor into v_tetangga
  from kloter k
  where k.nomor > p_kloter and k.jam_berangkat is not null and k.jam_berangkat < p_jam
  order by k.nomor asc limit 1;
  if v_tetangga is not null then
    raise exception 'jam koreksi lebih lambat daripada kloter % yang berangkat sesudahnya', v_tetangga;
  end if;

  insert into history (table_name, row_id, action, old_value, new_value, changed_by)
  values ('kloter', p_kloter::text, 'UPDATE',
          jsonb_build_object('jam_berangkat', v_lama),
          jsonb_build_object('jam_berangkat', p_jam, 'alasan_koreksi', p_alasan),
          auth.uid());

  update kloter set jam_berangkat = p_jam where nomor = p_kloter;
end;
$$;
