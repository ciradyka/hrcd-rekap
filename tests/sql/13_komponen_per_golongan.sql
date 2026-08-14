-- ============================================================================
-- hrcd-rekap : tests/sql/13_komponen_per_golongan.sql
-- Komponen per golongan (0030/0031) dan penjaga konfigurasi (0032).
--
-- Dua hal yang dijaga, dan keduanya tidak menimbulkan galat kalau rusak —
-- itulah sebabnya mereka butuh tes:
--
--   1. Satu lomba yang skalanya berbeda per golongan tidak boleh membuat satu
--      regu mengisi DUA kolom. Kalau pagarnya jebol, Nilai Pos regu itu jadi
--      dua kali lipat maksimum dan tidak ada yang gagal.
--   2. Migrasi konfigurasi tidak boleh mengganti aturan penilaian setelah ada
--      nilai tersimpan. Kalau penjaganya jebol, nilai yang sudah masuk
--      kehilangan komponen induknya — dan yang hilang bukan angkanya,
--      melainkan artinya.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 13.1 Penjaga 0032: database uji SUDAH penuh nilai, jadi konfigurasinya
--      WAJIB tidak tersentuh. Kalau tes ini gagal, migrasi itu baru saja
--      menghapus bahan seluruh tes di atasnya.
-- ---------------------------------------------------------------------------
do $$
declare v_pos5 text; v_kostum int;
begin
  select name into v_pos5 from pos where edisi = edisi_aktif() and nomor = 5;
  assert v_pos5 is distinct from 'Yel-yel',
    '0032 mengganti konfigurasi padahal sudah ada nilai tersimpan';

  select count(*) into v_kostum from pos
  where edisi = edisi_aktif() and bayangan;
  assert v_kostum > 0,
    '0032 menghapus pos bayangan padahal sudah ada nilai tersimpan';
end;
$$;

-- ---------------------------------------------------------------------------
-- 13.2 komponen_berlaku(): null = untuk semua, terisi = untuk satu golongan.
-- ---------------------------------------------------------------------------
do $$
begin
  assert komponen_berlaku(null, 'penegak_pa'),      'null harus berlaku untuk semua';
  assert komponen_berlaku(null, 'penggalang_pi'),   'null harus berlaku untuk semua';
  assert komponen_berlaku('penegak_pa', 'penegak_pa'), 'golongan sama harus berlaku';
  assert not komponen_berlaku('penegak_pa', 'penggalang_pa'),
    'golongan berbeda TIDAK boleh berlaku';
end;
$$;

-- ---------------------------------------------------------------------------
-- 13.3 Komponen bergolongan: server MENOLAK nilai dari golongan lain, dan
--      jumlah komponen yang harus diisi ikut menyesuaikan per regu.
--
--      Diuji dengan menandai satu komponen yang sudah ada, lalu dikembalikan
--      lagi — supaya tes ini tidak bergantung pada konfigurasi edisi mana pun.
-- ---------------------------------------------------------------------------
reset role;
do $$
declare
  v_kode     text;
  v_pos      smallint;
  v_gol_lain text;
  v_regu     record;
  v_sebelum  int;
  v_sesudah  int;
  v_hasil    jsonb;
begin
  -- Satu regu yang sudah bernomor dada, dan satu komponen di posnya.
  select r.* into strict v_regu
  from regu r join pendaftaran d on d.id = r.pendaftaran_id
  where r.nomor_dada is not null and not r.is_cancelled and d.status = 'lunas'
  order by r.nomor_dada limit 1;

  select w.kode, w.pos into strict v_kode, v_pos
  from wahana w where w.edisi = edisi_aktif() order by w.pos, w.sort_order limit 1;

  v_gol_lain := case when v_regu.golongan = 'penegak_pa'
                     then 'penegak_pi' else 'penegak_pa' end;

  select jumlah_komponen into v_sebelum from v_lembar_pos
  where pos = v_pos and regu_id = v_regu.id;

  -- Tandai komponen itu milik golongan LAIN.
  update wahana set golongan = v_gol_lain
  where edisi = edisi_aktif() and pos = v_pos and kode = v_kode;

  select jumlah_komponen into v_sesudah from v_lembar_pos
  where pos = v_pos and regu_id = v_regu.id;
  assert v_sesudah = v_sebelum - 1,
    format('jumlah_komponen tidak menyusut: %s -> %s', v_sebelum, v_sesudah);

  -- Server menolak nilainya.
  v_hasil := simpan_nilai_massal(
    jsonb_build_array(jsonb_build_object(
      'nomor_dada', v_regu.nomor_dada, 'kode', v_kode, 'nilai_1', 1)),
    'manual', v_pos);
  assert v_hasil -> 0 ->> 'status' = 'ditolak',
    'komponen golongan lain malah diterima';
  assert v_hasil -> 0 ->> 'alasan' = 'Komponen ini untuk golongan lain.',
    format('alasan tidak sesuai: %L', v_hasil -> 0 ->> 'alasan');

  -- Kembalikan seperti semula supaya tes ini tidak meninggalkan jejak.
  update wahana set golongan = null
  where edisi = edisi_aktif() and pos = v_pos and kode = v_kode;

  select jumlah_komponen into v_sesudah from v_lembar_pos
  where pos = v_pos and regu_id = v_regu.id;
  assert v_sesudah = v_sebelum, 'jumlah_komponen tidak kembali seperti semula';
end;
$$;

-- ---------------------------------------------------------------------------
-- 13.4 Tanpa komponen bergolongan, perilakunya HARUS sama persis dengan
--      sebelum 0030 — panel kelengkapan tetap menjumlah ke populasinya.
-- ---------------------------------------------------------------------------
select set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;

do $$
declare k record;
begin
  for k in select * from v_kelengkapan_pos loop
    assert k.lengkap + k.sebagian + k.kosong = k.regu_total,
      format('Pos %s: %s + %s + %s <> %s',
             k.pos, k.lengkap, k.sebagian, k.kosong, k.regu_total);
  end loop;
end;
$$;

reset role;
select '13_komponen_per_golongan OK' as hasil;
