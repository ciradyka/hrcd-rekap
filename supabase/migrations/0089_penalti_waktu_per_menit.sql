-- ============================================================================
-- hrcd-rekap : 0089_penalti_waktu_per_menit.sql
-- Ketepatan waktu: setiap satu menit dari target mengurangi satu poin.
--
-- Target tetap dihitung oleh v_penalti_waktu sebagai:
--
--   jam_berangkat kloter + kontrak_menit
--
-- Jadi kloter yang berangkat 07:00 dengan kontrak 4 jam harus tiba 11:00.
-- Datang 10:59 maupun 11:01 sama-sama meleset satu menit dan sama-sama kena
-- satu poin. Arah selisih tetap disimpan di selisih_menit untuk menjelaskan
-- terlalu cepat atau terlambat; penalti memakai nilai absolutnya.
--
-- View dan preview closing sudah membaca blok_menit serta penalti_per_blok
-- dari satu baris konfig_penalti. Karena itu tidak ada rumus kedua yang perlu
-- ditulis ulang: mengubah kedua angka ini langsung mengubah database dan UI.
-- Default kolom ikut diubah supaya edisi baru tidak diam-diam kembali memakai
-- aturan lama 10 menit -> 10 poin saat baris konfigurasinya dibuat.
-- ============================================================================

alter table konfig_penalti
  alter column blok_menit set default 1,
  alter column penalti_per_blok set default 1;

update konfig_penalti
set blok_menit = 1,
    penalti_per_blok = 1
where edisi = edisi_aktif()
  and (blok_menit, penalti_per_blok) is distinct from (1, 1);

do $blok$
declare
  v_edisi       smallint;
  v_blok        smallint;
  v_penalti     numeric;
  v_default_blok text;
  v_default_poin text;
begin
  select edisi, blok_menit, penalti_per_blok
    into v_edisi, v_blok, v_penalti
  from konfig_penalti
  where edisi = edisi_aktif();

  if not found then
    raise notice '0089: edisi aktif belum punya konfig_penalti — data dilewati, default baru tetap terpasang.';
    return;
  end if;

  assert v_blok = 1 and v_penalti = 1,
         format('0089: edisi %s masih memakai blok %s menit -> %s poin',
                v_edisi, v_blok, v_penalti);

  select column_default into v_default_blok
  from information_schema.columns
  where table_schema = 'public' and table_name = 'konfig_penalti'
    and column_name = 'blok_menit';

  select column_default into v_default_poin
  from information_schema.columns
  where table_schema = 'public' and table_name = 'konfig_penalti'
    and column_name = 'penalti_per_blok';

  assert v_default_blok = '1' and v_default_poin = '1'::numeric::text,
         format('0089: default belum 1 menit -> 1 poin (%s, %s)',
                v_default_blok, v_default_poin);

  raise notice '0089: edisi % — setiap 1 menit terlalu cepat/lambat = -1 poin.',
               v_edisi;
end;
$blok$;
