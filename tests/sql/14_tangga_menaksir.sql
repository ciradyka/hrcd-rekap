-- ============================================================================
-- hrcd-rekap : tests/sql/14_tangga_menaksir.sql
-- Tangga poin Menaksir (0035).
--
-- Yang dijaga di sini bukan angkanya, melainkan SATU KEPUTUSAN: tangga ini
-- sengaja tidak diberi tingkat penutup, karena `bertingkat` memberi 0 untuk
-- nilai di luar semua tingkat dan 0 memang jawaban yang benar untuk selisih
-- lebih dari 4 m.
--
-- Ketiga lomba Pos 2 mengambil keputusan SEBALIKNYA — di sana aturannya
-- berhenti di 20, jadi masing-masing diberi tingkat terakhir berbatas sangat
-- besar. Dua kebiasaan yang berlawanan hidup berdampingan di satu tabel, dan
-- itulah kenapa yang satu bisa tanpa sengaja disamakan dengan yang lain oleh
-- orang yang merapikan konfigurasi setahun kemudian. Kalau itu terjadi pada
-- Menaksir, regu yang menaksir sejauh 40 m dari jarak sebenarnya tetap dapat
-- 20 poin — tidak ada yang gagal, tidak ada yang aneh di layar.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 14.1 Tangganya, meter demi meter — termasuk yang jatuh ke luar tangga.
-- ---------------------------------------------------------------------------
do $$
declare
  v_tangga jsonb := '[{"sampai": 0, "poin": 100},
                      {"sampai": 1, "poin": 80},
                      {"sampai": 2, "poin": 60},
                      {"sampai": 3, "poin": 40},
                      {"sampai": 4, "poin": 20}]'::jsonb;
  v_harap  numeric;
  v_dapat  numeric;
  v_uji    record;
begin
  for v_uji in
    select * from (values
      (0,   100), (1,    80), (2,    60), (3,    40), (4,    20),
      -- Di luar tangga. Yang pertama adalah meter kelima — batas persis di
      -- mana poinnya habis. Dua sisanya memastikan tidak ada tingkat penutup
      -- yang diam-diam menahan nilainya di 20.
      (5,     0), (12,    0), (1000,  0)
    ) as t(selisih, poin)
  loop
    v_harap := v_uji.poin;
    v_dapat := hitung_poin('bertingkat', v_uji.selisih, null, 100,
                           null, null, null, null, null, v_tangga);
    assert v_dapat = v_harap,
      format('selisih %s m: seharusnya %s poin, ternyata %s',
             v_uji.selisih, v_harap, v_dapat);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- 14.2 Selisih pecahan. Petugas menulis angka, bukan bilangan bulat, dan
--      2,5 m BUKAN 50 poin — tangga adalah anak tangga, bukan garis miring.
--      Dites supaya perilakunya tercatat: yang menentukan adalah tingkat
--      PERTAMA yang masih memuatnya, jadi 2,5 ikut pita "sampai 3" = 40.
-- ---------------------------------------------------------------------------
do $$
declare
  v_tangga jsonb := '[{"sampai": 0, "poin": 100},
                      {"sampai": 1, "poin": 80},
                      {"sampai": 2, "poin": 60},
                      {"sampai": 3, "poin": 40},
                      {"sampai": 4, "poin": 20}]'::jsonb;
  v_dapat  numeric;
begin
  v_dapat := hitung_poin('bertingkat', 2.5, null, 100,
                         null, null, null, null, null, v_tangga);
  assert v_dapat = 40,
    format('selisih 2,5 m seharusnya 40 poin (pita "sampai 3"), ternyata %s',
           v_dapat);

  -- Tepat di batas masuk ke pita itu sendiri, bukan pita berikutnya.
  v_dapat := hitung_poin('bertingkat', 2.0, null, 100,
                         null, null, null, null, null, v_tangga);
  assert v_dapat = 60,
    format('selisih 2 m tepat di batas seharusnya 60 poin, ternyata %s',
           v_dapat);
end;
$$;

-- ---------------------------------------------------------------------------
-- 14.3 Kalau konfigurasi XXXVII memang terpasang, tangga yang TERSIMPAN wajib
--      sama dengan yang diuji di atas. Di database uji ini konfigurasinya
--      masih XXXVI (lihat 13.1), jadi bagian ini melapor dilewati — bukan
--      lulus diam-diam.
-- ---------------------------------------------------------------------------
do $$
declare v_tersimpan jsonb;
begin
  select tingkat into v_tersimpan from wahana
  where edisi = edisi_aktif() and kode = 'menaksir';

  if not found then
    raise notice '14.3 dilewati: komponen `menaksir` tidak ada di edisi aktif.';
    return;
  end if;

  assert v_tersimpan = '[{"sampai": 0, "poin": 100},
                         {"sampai": 1, "poin": 80},
                         {"sampai": 2, "poin": 60},
                         {"sampai": 3, "poin": 40},
                         {"sampai": 4, "poin": 20}]'::jsonb,
    format('tangga Menaksir tersimpan tidak sesuai 0035: %s', v_tersimpan);

  raise notice '14.3: tangga Menaksir tersimpan sesuai 0035.';
end;
$$;

select '14_tangga_menaksir OK' as hasil;
