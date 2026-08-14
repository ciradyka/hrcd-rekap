-- ============================================================================
-- hrcd-rekap : tests/sql/11_kelengkapan_pos.sql
-- Panel kelengkapan per pos (v_kelengkapan_pos, migrasi 0028).
--
-- Yang dijaga di sini satu kalimat: angka di panel harus BERARTI apa yang
-- tertulis di labelnya. Panel yang menghitung sedikit meleset lebih buruk
-- daripada panel yang tidak ada — panitia akan mengejar regu yang sebenarnya
-- lengkap, dan berhenti mengejar yang benar-benar hilang.
-- ============================================================================

select set_config('app.uid', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;

-- ---------------------------------------------------------------------------
-- 11.1 Ketiga golongan angka menjumlah persis ke populasinya, dan tiap pos
--      muncul tepat sekali.
-- ---------------------------------------------------------------------------
do $$
declare k record; v_pos_dinilai int;
begin
  select count(*) into v_pos_dinilai from v_pos where jumlah_komponen > 0;
  assert (select count(*) from v_kelengkapan_pos) = v_pos_dinilai,
    format('panel memuat %s baris, pos yang dinilai ada %s',
           (select count(*) from v_kelengkapan_pos), v_pos_dinilai);

  -- Pos tanpa komponen (garis start & finish) tidak boleh muncul: kolom yang
  -- selamanya 0/0 terbaca sebagai pos yang panitianya lalai.
  assert not exists (
    select 1 from v_kelengkapan_pos k
    join v_pos p on p.nomor = k.pos where p.jumlah_komponen = 0),
    'pos tanpa komponen ikut masuk panel kelengkapan';

  for k in select * from v_kelengkapan_pos loop
    assert k.lengkap + k.sebagian + k.kosong = k.regu_total,
      format('Pos %s: %s + %s + %s <> %s regu',
             k.pos, k.lengkap, k.sebagian, k.kosong, k.regu_total);
    assert k.regu_berangkat <= k.regu_total, format('Pos %s: berangkat > total', k.pos);
    assert k.regu_closing   <= k.regu_total, format('Pos %s: closing > total', k.pos);
    assert k.hilang         <= k.regu_closing,
      format('Pos %s: hilang (%s) > yang sudah closing (%s)',
             k.pos, k.hilang, k.regu_closing);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11.2 `lengkap` benar-benar berarti SELURUH komponen pos itu terisi —
--      dihitung ulang dari nilai_mentah, bukan dipercaya begitu saja.
-- ---------------------------------------------------------------------------
do $$
declare k record; v_hitung int;
begin
  for k in select * from v_kelengkapan_pos loop
    select count(*) into v_hitung
    from regu r
    join pendaftaran d on d.id = r.pendaftaran_id
    where not r.is_cancelled and d.status = 'lunas' and r.nomor_dada is not null
      and (select count(*) from nilai_mentah n
           join wahana w on w.id = n.wahana_id
           where n.regu_id = r.id and w.edisi = edisi_aktif()
             and w.pos = k.pos) = k.jumlah_komponen;
    assert v_hitung = k.lengkap,
      format('Pos %s: panel bilang %s lengkap, hitungan ulang %s',
             k.pos, k.lengkap, v_hitung);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11.3 `hilang` HANYA menghitung regu yang sudah closing. Inilah bedanya
--      dengan "belum sampai", dan seluruh nilai panel ini bergantung padanya.
-- ---------------------------------------------------------------------------
do $$
declare k record; v_hitung int;
begin
  for k in select * from v_kelengkapan_pos loop
    select count(*) into v_hitung
    from regu r
    join pendaftaran d on d.id = r.pendaftaran_id
    where not r.is_cancelled and d.status = 'lunas' and r.nomor_dada is not null
      and exists (select 1 from closing_regu c where c.regu_id = r.id)
      and (select count(*) from nilai_mentah n
           join wahana w on w.id = n.wahana_id
           where n.regu_id = r.id and w.edisi = edisi_aktif()
             and w.pos = k.pos) < k.jumlah_komponen;
    assert v_hitung = k.hilang,
      format('Pos %s: panel bilang %s hilang, hitungan ulang %s',
             k.pos, k.hilang, v_hitung);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 11.4 Operator pos melihat POSNYA SENDIRI saja — satu baris, nomornya benar.
--      Berbeda dengan v_rekap_penuh yang menolaknya sama sekali (0027):
--      di sini angkanya jujur untuk pos itu, karena RLS mengizinkan ia
--      membaca seluruh nilai_mentah pos-nya.
-- ---------------------------------------------------------------------------
reset role;
select set_config('app.uid', '00000000-0000-0000-0000-000000000001', false);
set role authenticated;

do $$
declare v_baris int; v_pos int;
begin
  select count(*) into v_baris from v_kelengkapan_pos;
  assert v_baris = 1,
    format('operator pos 1 melihat %s baris panel, seharusnya 1', v_baris);
  select pos into v_pos from v_kelengkapan_pos;
  assert v_pos = 1, format('operator pos 1 melihat panel pos %s', v_pos);
end;
$$;

reset role;
select '11_kelengkapan_pos OK' as hasil;
