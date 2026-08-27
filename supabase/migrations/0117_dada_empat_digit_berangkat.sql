-- ============================================================================
-- hrcd-rekap : 0117_dada_empat_digit_berangkat.sql
-- `lpad(nomor_dada, 3, '0')` MEMOTONG nomor Intern jadi tiga digit.
--
-- APA YANG SALAH
--
-- `berangkatkan_kloter` menolak kloter yang masih punya regu tanpa kontrak
-- waktu, dan menyebut nomor dadanya:
--
--     regu nomor dada 001, 014 belum konfirmasi kontrak waktu
--
-- Nomornya diformat `lpad(r.nomor_dada::text, 3, '0')`, dan lpad TIDAK
-- memanjangkan saja — ia juga MEMOTONG string yang lebih panjang dari
-- targetnya. Sejak 0116 regu Intern bernomor 1001-1250, jadi pesan itu
-- berbunyi:
--
--     regu nomor dada 100 belum konfirmasi kontrak waktu     <- regu 1001
--
-- dan 100 adalah regu Eksternal yang benar-benar ada. Petugas garis start
-- membaca nomor itu, mencari regu yang salah, menemukan kontraknya sudah
-- terisi, lalu tidak punya petunjuk apa pun tentang regu yang sebenarnya
-- menahan kloternya — pada pukul tujuh pagi, dengan kloter berikutnya sudah
-- berbaris.
--
-- KENAPA CUMA FUNGSI INI
--
-- Empat fungsi lain memformat nomor dada dengan cara yang sama —
-- `catat_foto_lembar`, `hapus_nilai_pos`, `kunci_nilai_pos`, `tautkan_foto` —
-- dan KEEMPATNYA sudah memakai pagar `case when ... between 0 and 999`.
-- Jebakan lpad ini memang sudah diketahui dan ditulis di kepala 0023; yang
-- ini satu-satunya yang luput. Diperiksa dengan membaca `pg_get_functiondef`
-- seluruh fungsi di database, bukan dengan membaca berkas migrasi — versi
-- terbaru sebuah fungsi tersebar di berkas bernomor besar, dan mata mudah
-- membaca definisi yang sudah tidak berlaku.
--
-- Tidak ada view yang memformat nomor dada; sisi layar (`dada3()` di
-- util.js, `padStart`) tidak pernah memotong.
--
-- KENAPA TIDAK DIBUAT SATU FUNGSI PEMBANTU
--
-- `dada_teks(integer)` akan lebih rapi daripada lima salinan `case`, tetapi
-- itu berarti menulis ulang empat fungsi yang hari ini benar, dua hari
-- sebelum lomba. Bentuk yang dipakai di bawah SAMA PERSIS dengan yang sudah
-- ada di empat fungsi lain — tidak ada konsep baru yang harus dihafal siapa
-- pun, dan penyeragamannya bisa menunggu edisi berikutnya.
-- ============================================================================

create or replace function berangkatkan_kloter(
  p_kloter smallint,
  p_jam    timestamptz
) returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_tanpa_kontrak text;
begin
  if not boleh('keberangkatan') then
    raise exception 'tidak berhak: keberangkatan';
  end if;
  if p_jam is null then
    raise exception 'jam berangkat wajib diketik';
  end if;
  if exists (select 1 from kloter where nomor = p_kloter and jam_berangkat is not null) then
    raise exception 'kloter % sudah berangkat', p_kloter;
  end if;
  -- Papan pipeline diturunkan dari max(nomor berangkat) — satu ketukan salah
  -- (memberangkatkan kloter kosong / melompati) merusak seluruh papan.
  -- Guard: kloter harus berisi regu, dan tidak boleh melompati kloter berisi
  -- regu yang belum berangkat (temuan review).
  if not exists (select 1 from regu r where r.kloter_nomor = p_kloter and not r.is_cancelled) then
    raise exception 'kloter % tidak berisi regu', p_kloter;
  end if;
  if exists (
       select 1 from kloter k
       where k.nomor < p_kloter and k.jam_berangkat is null
         and exists (select 1 from regu r
                     where r.kloter_nomor = k.nomor and not r.is_cancelled)) then
    raise exception 'masih ada kloter sebelum % yang belum berangkat — urutan keberangkatan wajib berurut', p_kloter;
  end if;

  -- Regu yang diceklis berangkat wajib sudah berkontrak — mencegah penalti
  -- waktu yang tak terhitung (NULL) di kemudian hari.
  --
  -- Nomor 0-999 ditulis tiga digit, bentuk yang tertulis di kain; yang lebih
  -- panjang dicetak apa adanya, karena lpad MEMOTONG kelebihannya dan sejak
  -- 0116 kain Intern bernomor empat digit. ORDER BY supaya daftarnya tidak
  -- berubah urutan tiap kali.
  select string_agg(
           case when r.nomor_dada between 0 and 999
                then lpad(r.nomor_dada::text, 3, '0')
                else r.nomor_dada::text end,
           ', ' order by r.nomor_dada)
    into v_tanpa_kontrak
  from regu r
  join keberangkatan_regu k on k.regu_id = r.id
  where r.kloter_nomor = p_kloter and r.kontrak_menit is null;
  if v_tanpa_kontrak is not null then
    raise exception 'regu nomor dada % belum konfirmasi kontrak waktu', v_tanpa_kontrak;
  end if;

  update kloter set jam_berangkat = p_jam where nomor = p_kloter;
end;
$$;

-- ---------------------------------------------------------------------------
-- Pagar yang sama untuk seluruh fungsi, sekarang dan nanti: tidak boleh ada
-- `lpad(..., 3, '0')` yang berdiri tanpa pemeriksaan `between 0 and 999` di
-- dekatnya. Dibaca dari definisi fungsi yang BENAR-BENAR terpasang, bukan
-- dari berkas migrasi.
-- ---------------------------------------------------------------------------
do $blok$
declare r record; v_telanjang text[] := '{}';
begin
  -- `as materialized` + `prokind = 'f'` bukan kerapian: menaruh
  -- `pg_get_functiondef(...) like ...` langsung di WHERE membuat perencana
  -- boleh memanggilnya SEBELUM saringan namespace, dan fungsi itu melempar
  -- galat untuk agregat ("array_agg is an aggregate function"). Pemeriksa
  -- yang gagal karena dirinya sendiri tidak memeriksa apa pun.
  for r in
    with fungsi as materialized (
      select p.proname, pg_get_functiondef(p.oid) as isi
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prokind = 'f'
    )
    select proname, isi from fungsi where isi like '%lpad(%3, ''0'')%'
  loop
    if r.isi not like '%between 0 and 999%' then
      v_telanjang := v_telanjang || r.proname;
    end if;
  end loop;

  if array_length(v_telanjang, 1) is not null then
    raise exception '0117: masih ada fungsi yang memotong nomor dada empat digit: %',
      array_to_string(v_telanjang, ', ');
  end if;
  raise notice '0117: seluruh fungsi yang memformat nomor dada sudah aman untuk empat digit.';
end;
$blok$;
