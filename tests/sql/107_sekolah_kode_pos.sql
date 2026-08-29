\echo '--- 107. kode pos per desa, bukan per kecamatan'

do $$
declare r record; v_n int := 0;
begin
  -- Kec. Ciamis punya sembilan kode pos dan Kec. Pamarican tiga, jadi kode pos
  -- adalah sifat DESA. Yang diperiksa: tidak ada dua desa berbeda di kecamatan
  -- yang sama dipaksa memakai kode yang sama hanya karena kecamatannya sama —
  -- dan sebaliknya, satu desa tidak pernah punya dua kode.
  for r in
    select substring(address from '([^,]+), Kec\. ([^,]+),') as desa,
           substring(address from ', Kec\. ([^,]+),') as kec,
           count(distinct substring(address from '([0-9]{5}), Indonesia$')) as n
      from sekolah
     where address ~ '[0-9]{5}, Indonesia$'
     group by 1, 2 having count(distinct substring(address from '([0-9]{5}), Indonesia$')) > 1
  loop
    v_n := v_n + 1;
    raise warning '107: desa % Kec. % memakai % kode pos berbeda', r.desa, r.kec, r.n;
  end loop;
  assert v_n = 0, format('107.1 GAGAL: %s desa memakai lebih dari satu kode pos', v_n);
end;
$$;

do $$
declare v_n int;
begin
  -- Kode pos yang terpasang harus lima angka dan berada tepat sebelum
  -- ", Indonesia" — bentuk yang ditetapkan runbook bagian 8.
  select count(*) into v_n from sekolah
   where btrim(address) <> '' and address ~ '[0-9]{5}'
     and address !~ '[0-9]{5}, Indonesia$';
  assert v_n = 0, format('107.2 GAGAL: %s alamat memuat angka lima digit di tempat yang salah', v_n);

  -- MTsN 1 Ciamis: situs sekolahnya menulis 46251, dua direktori dan delapan
  -- belas tetangganya di Kec. Ciamis menulis 46211. Yang dipakai 46211, dan
  -- angka lama tidak boleh diam-diam kembali.
  assert not exists (select 1 from sekolah where name = 'MTsN 1 Ciamis' and address like '%46251%'),
    '107.3 GAGAL: MTsN 1 Ciamis kembali memakai 46251 — lihat sekolah-belum-tuntas.md bagian C';

  select count(*) into v_n from sekolah
   where btrim(address) <> '' and address !~ '[0-9]{5}, Indonesia$';
  raise notice '107: % alamat masih tanpa kode pos.', v_n;
end;
$$;

\echo '107 kode pos sekolah: LULUS'
